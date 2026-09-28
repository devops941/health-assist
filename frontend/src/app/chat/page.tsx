"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageSquarePlus, Search, Send, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RedFlagAlert } from "@/components/health/RedFlagAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { getToken, http } from "@/lib/api";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { ChatMessage, Conversation, RedFlag } from "@/types";

const SUGGESTIONS = [
  "What foods help lower blood pressure?",
  "How much water should I drink each day?",
  "I have a headache and mild fever for two days",
  "Tips to improve my sleep quality",
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [redFlag, setRedFlag] = useState<RedFlag | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await http.get<Conversation[]>("/api/chat/conversations");
      setConversations(list);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setRedFlag(null);
    setLoadingHistory(true);
    try {
      const history = await http.get<ChatMessage[]>(`/api/chat/conversations/${id}`);
      setMessages(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that conversation.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setRedFlag(null);
    setError("");
  };

  const deleteConversation = async (id: string) => {
    try {
      await http.del(`/api/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) newConversation();
    } catch {
      /* silent */
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;

    setError("");
    setRedFlag(null);
    setInput("");
    setStreaming(true);

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const token = getToken();
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, conversationId: activeId ?? undefined }),
      });

      if (!response.ok || !response.body) {
        throw new Error("The assistant is unavailable right now. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let event: { type: string; value?: string; message?: string; conversationId?: string; redFlag?: RedFlag; messageId?: string };
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (event.type === "meta") {
            if (event.conversationId) setActiveId(event.conversationId);
            if (event.redFlag?.triggered) setRedFlag(event.redFlag);
          } else if (event.type === "token" && event.value) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.value } : m,
              ),
            );
          } else if (event.type === "error") {
            setError(event.message ?? "The assistant is unavailable right now.");
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, id: event.messageId ?? m.id } : m)),
            );
          }
        }
      }
      void loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  };

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      void loadConversations();
      return;
    }
    try {
      const results = await http.get<Conversation[]>(
        `/api/chat/search?q=${encodeURIComponent(query.trim())}`,
      );
      setConversations(results);
    } catch {
      /* silent */
    }
  };

  return (
    <AppShell>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <Button className="w-full gap-2" onClick={newConversation}>
            <MessageSquarePlus className="h-4 w-4" />
            New conversation
          </Button>

          <form onSubmit={runSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="pl-9"
            />
          </form>

          <div className="max-h-[60vh] space-y-1 overflow-y-auto scrollbar-thin">
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex items-start gap-2 rounded-md border px-3 py-2 transition-colors",
                    activeId === conversation.id
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-accent",
                  )}
                >
                  <button
                    onClick={() => void openConversation(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium">{conversation.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(conversation.updatedAt ?? conversation.createdAt)} ·{" "}
                      {conversation.messageCount} messages
                    </p>
                  </button>
                  <button
                    onClick={() => void deleteConversation(conversation.id)}
                    aria-label="Delete conversation"
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <Card className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin">
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center">
                <Spinner className="h-5 w-5 text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-5">
                <EmptyState
                  icon={<Bot className="h-8 w-8" />}
                  title="Ask a health question"
                  description="I can explain symptoms, share general wellness guidance and help you decide when to see a doctor."
                />
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => void send(suggestion)}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border bg-muted/40",
                      )}
                    >
                      {message.content ? (
                        <div className="prose-health whitespace-pre-wrap">{message.content}</div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Spinner className="h-3.5 w-3.5" />
                          Thinking...
                        </div>
                      )}
                      {message.role === "assistant" && message.content && (
                        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                          General information only — not a diagnosis.
                        </p>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <UserRound className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {redFlag?.triggered && <RedFlagAlert redFlag={redFlag} />}
              </>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <CardContent className="border-t p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Describe how you feel or ask a health question..."
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="icon" disabled={streaming || !input.trim()} aria-label="Send">
                {streaming ? <Spinner /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Not medical advice</Badge>
              <span className="text-xs text-muted-foreground">
                Press Enter to send · Shift + Enter for a new line
              </span>
              {activeId && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Started {formatTime(new Date().toISOString())}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
