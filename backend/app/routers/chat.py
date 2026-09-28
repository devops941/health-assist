"""Module 3 - Health Q&A Chatbot (Groq) + Module 9 history endpoints."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Response
from fastapi.responses import StreamingResponse

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut
from app.services import groq_service
from app.services.safety import check_red_flags
from app.utils.helpers import to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Health Q&A Chatbot"])

HISTORY_LIMIT = 12


async def _load_profile(db, user_id: str) -> dict | None:
    profile = await db.healthprofile.find_unique(where={"userId": user_id})
    return to_dict(profile) if profile else None


async def _recent_history(db, conversation_id: str) -> list[dict]:
    messages = await db.message.find_many(
        where={"conversationId": conversation_id},
        order={"createdAt": "asc"},
    )
    return [{"role": m.role, "content": m.content} for m in messages[-HISTORY_LIMIT:]]


async def _record_red_flag(db, *, user_id: str, conversation_id: str, message_id: str | None, text: str, result) -> None:
    if not result.triggered:
        return
    await db.flaggedchat.create(
        data={
            "userId": user_id,
            "conversationId": conversation_id,
            "messageId": message_id,
            "content": text[:1000],
            "matchedRules": result.matched,
            "severity": result.severity,
            "source": "chat",
        }
    )


async def _get_or_create_conversation(db, user_id: str, conversation_id: str | None, first_message: str):
    if conversation_id:
        conversation = await db.conversation.find_unique(where={"id": conversation_id})
        if conversation is None or conversation.userId != user_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        return conversation

    title = first_message.strip().split("\n")[0][:60] or "New conversation"
    return await db.conversation.create(data={"userId": user_id, "title": title})


@router.post("", response_model=ChatResponse)
async def send_message(payload: ChatRequest, user: dict = Depends(get_current_user)) -> ChatResponse:
    """Non-streaming chat: safety check -> Groq -> persist -> reply."""
    db = get_client()
    conversation = await _get_or_create_conversation(
        db, user["id"], payload.conversationId, payload.message
    )

    red_flag = check_red_flags(payload.message)

    user_msg = await db.message.create(
        data={
            "conversationId": conversation.id,
            "role": "user",
            "content": payload.message,
            "flagged": red_flag.triggered,
        }
    )
    await _record_red_flag(
        db,
        user_id=user["id"],
        conversation_id=conversation.id,
        message_id=user_msg.id,
        text=payload.message,
        result=red_flag,
    )

    history = await _recent_history(db, conversation.id)
    profile = await _load_profile(db, user["id"])

    try:
        reply = groq_service.chat_reply(
            user_message=payload.message,
            history=history[:-1],  # exclude the just-saved message
            profile=profile,
            red_flag_advice=red_flag.advice if red_flag.triggered else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Groq chat failed: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The AI assistant is temporarily unavailable. Please try again.",
        ) from exc

    assistant_msg = await db.message.create(
        data={"conversationId": conversation.id, "role": "assistant", "content": reply}
    )
    await db.conversation.update(
        where={"id": conversation.id},
        data={"updatedAt": assistant_msg.createdAt},
    )

    return ChatResponse(
        conversationId=conversation.id,
        userMessage=MessageOut(**to_dict(user_msg)),
        assistantMessage=MessageOut(**to_dict(assistant_msg)),
        redFlag=red_flag.as_dict(),
    )


@router.post("/stream")
async def stream_message(payload: ChatRequest, user: dict = Depends(get_current_user)):
    """Server-sent events streaming chat."""
    db = get_client()
    conversation = await _get_or_create_conversation(
        db, user["id"], payload.conversationId, payload.message
    )
    red_flag = check_red_flags(payload.message)

    user_msg = await db.message.create(
        data={
            "conversationId": conversation.id,
            "role": "user",
            "content": payload.message,
            "flagged": red_flag.triggered,
        }
    )
    await _record_red_flag(
        db,
        user_id=user["id"],
        conversation_id=conversation.id,
        message_id=user_msg.id,
        text=payload.message,
        result=red_flag,
    )

    history = await _recent_history(db, conversation.id)
    profile = await _load_profile(db, user["id"])
    conversation_id = conversation.id
    disclaimer = groq_service.DISCLAIMER

    async def event_stream():
        yield f"data: {json.dumps({'type': 'meta', 'conversationId': conversation_id, 'redFlag': red_flag.as_dict()})}\n\n"
        collected: list[str] = []
        try:
            async for token in groq_service.stream_reply(
                user_message=payload.message,
                history=history[:-1],
                profile=profile,
                red_flag_advice=red_flag.advice if red_flag.triggered else None,
            ):
                collected.append(token)
                yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.error("Groq stream failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'The AI assistant is temporarily unavailable.'})}\n\n"
            return

        full = "".join(collected).strip()
        if disclaimer.split(",")[0] not in full:
            full = f"{full}\n\n_{disclaimer}_"
            yield f"data: {json.dumps({'type': 'token', 'value': chr(10) + chr(10) + '_' + disclaimer + '_'})}\n\n"

        assistant_msg = await db.message.create(
            data={"conversationId": conversation_id, "role": "assistant", "content": full}
        )
        await db.conversation.update(
            where={"id": conversation_id}, data={"updatedAt": assistant_msg.createdAt}
        )
        yield f"data: {json.dumps({'type': 'done', 'messageId': assistant_msg.id})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ------------------------------------------------------------- history
@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user: dict = Depends(get_current_user)) -> list[ConversationOut]:
    db = get_client()
    conversations = await db.conversation.find_many(
        where={"userId": user["id"]}, order={"updatedAt": "desc"}
    )
    out: list[ConversationOut] = []
    for convo in conversations:
        data = to_dict(convo)
        count = await db.message.count(where={"conversationId": convo.id})
        last = await db.message.find_first(
            where={"conversationId": convo.id}, order={"createdAt": "desc"}
        )
        out.append(
            ConversationOut(
                id=convo.id,
                title=convo.title,
                createdAt=data.get("createdAt"),
                updatedAt=data.get("updatedAt"),
                messageCount=count,
                preview=(last.content[:90] if last else None),
            )
        )
    return out


@router.get("/conversations/{conversation_id}", response_model=list[MessageOut])
async def get_conversation(
    conversation_id: str, user: dict = Depends(get_current_user)
) -> list[MessageOut]:
    db = get_client()
    conversation = await db.conversation.find_unique(where={"id": conversation_id})
    if conversation is None or conversation.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    messages = await db.message.find_many(
        where={"conversationId": conversation_id}, order={"createdAt": "asc"}
    )
    return [MessageOut(**to_dict(m)) for m in messages]


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    conversation = await db.conversation.find_unique(where={"id": conversation_id})
    if conversation is None or conversation.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    await db.message.delete_many(where={"conversationId": conversation_id})
    await db.conversation.delete(where={"id": conversation_id})


@router.get("/search", response_model=list[ConversationOut])
async def search_conversations(
    q: str = "", user: dict = Depends(get_current_user)
) -> list[ConversationOut]:
    db = get_client()
    term = q.strip()
    if not term:
        return await list_conversations(user)

    messages = await db.message.find_many(
        where={"content": {"contains": term, "mode": "insensitive"}},
        order={"createdAt": "desc"},
    )
    seen: dict[str, ConversationOut] = {}
    for message in messages:
        if message.conversationId in seen:
            continue
        convo = await db.conversation.find_unique(where={"id": message.conversationId})
        if convo is None or convo.userId != user["id"]:
            continue
        data = to_dict(convo)
        seen[convo.id] = ConversationOut(
            id=convo.id,
            title=convo.title,
            createdAt=data.get("createdAt"),
            updatedAt=data.get("updatedAt"),
            messageCount=await db.message.count(where={"conversationId": convo.id}),
            preview=message.content[:90],
        )
    return list(seen.values())
