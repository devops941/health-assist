"""Small helpers shared by the routers."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def today_str() -> str:
    return date.today().isoformat()


def iso(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def to_dict(model: Any, *, exclude: set[str] | None = None) -> dict[str, Any]:
    """Convert a Prisma model instance to a plain, JSON-safe dict."""
    if model is None:
        return {}
    if hasattr(model, "model_dump"):
        data = model.model_dump()
    elif hasattr(model, "dict"):
        data = model.dict()
    elif isinstance(model, dict):
        data = dict(model)
    else:  # pragma: no cover
        data = dict(getattr(model, "__dict__", {}))

    if exclude:
        for key in exclude:
            data.pop(key, None)

    for key, value in list(data.items()):
        if isinstance(value, (datetime, date)):
            data[key] = value.isoformat()
        elif hasattr(value, "model_dump") or hasattr(value, "dict"):
            data[key] = to_dict(value)
    return data


def clean_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    for item in values:
        text = str(item).strip()
        if text and text not in out:
            out.append(text)
    return out


def date_range(days: int) -> list[str]:
    today = date.today()
    return [(today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]
