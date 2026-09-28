"""Prisma (MongoDB) client lifecycle helpers.

The generated client lives in the top-level ``prisma_client`` package
(see ``prisma/schema.prisma``). It is imported lazily so that the API can
still boot (and serve ``/health``) when the client has not been generated yet.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_client = None


def get_client():
    """Return the singleton Prisma client instance (not yet connected)."""
    global _client
    if _client is None:
        from prisma_client import Prisma  # type: ignore

        _client = Prisma()
    return _client


def is_client_generated() -> bool:
    try:
        import prisma_client  # noqa: F401

        return True
    except Exception:
        return False


async def connect() -> Optional[object]:
    client = get_client()
    try:
        await client.connect()
        logger.info("Connected to MongoDB via Prisma")
        return client
    except Exception as exc:  # pragma: no cover - startup diagnostics
        logger.error("Failed to connect to MongoDB: %s", exc)
        return None


async def disconnect() -> None:
    client = _client
    if client is not None:
        try:
            if client.is_connected():
                await client.disconnect()
        except Exception as exc:  # pragma: no cover
            logger.warning("Error while disconnecting Prisma client: %s", exc)
