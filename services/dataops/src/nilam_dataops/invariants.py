from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, date, datetime, timedelta
from typing import Any

MONETARY_TOKENS = (
    "amount",
    "benefit",
    "capital",
    "cost",
    "grant",
    "incentive",
    "investment",
    "loan",
    "paise",
    "rate",
    "rupee",
    "subsidy",
)


class InvariantViolation(ValueError):
    """Raised when unverified source data would enter review or publication."""


def _is_money_path(path: str, value: Any) -> bool:
    leaf = path.rsplit(".", 1)[-1].lower()
    return (
        value is not None
        and not isinstance(value, bool)
        and any(token in leaf for token in MONETARY_TOKENS)
    )


def monetary_paths(value: Any, path: str = "") -> list[str]:
    paths: list[str] = []
    if isinstance(value, Mapping):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            if _is_money_path(child_path, child):
                paths.append(child_path)
            paths.extend(monetary_paths(child, child_path))
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for index, child in enumerate(value):
            paths.extend(monetary_paths(child, f"{path}[{index}]"))
    return paths


def require_citations_for_money(data: Mapping[str, Any]) -> None:
    paths = monetary_paths(data)
    if not paths:
        return
    citation = data.get("citation_url") or data.get("source_url")
    verified_on = data.get("verified_on")
    if not isinstance(citation, str) or not citation.startswith(("https://", "http://")):
        raise InvariantViolation(f"monetary fields require a citation URL: {', '.join(paths)}")
    if not isinstance(verified_on, str):
        raise InvariantViolation(f"monetary fields require verified_on: {', '.join(paths)}")
    try:
        date.fromisoformat(verified_on)
    except ValueError as error:
        raise InvariantViolation("verified_on must be an ISO date") from error


def _position_valid(position: Any) -> bool:
    return (
        isinstance(position, Sequence)
        and not isinstance(position, (str, bytes, bytearray))
        and len(position) >= 2
        and isinstance(position[0], (int, float))
        and isinstance(position[1], (int, float))
        and -180 <= position[0] <= 180
        and -90 <= position[1] <= 90
    )


def _ring_valid(ring: Any) -> bool:
    return (
        isinstance(ring, Sequence)
        and len(ring) >= 4
        and all(_position_valid(position) for position in ring)
        and list(ring[0]) == list(ring[-1])
    )


def require_valid_geometry(data: Mapping[str, Any]) -> None:
    geometry = data.get("geometry") or data.get("geom") or data.get("boundary")
    if geometry is None:
        return
    if not isinstance(geometry, Mapping):
        raise InvariantViolation("geometry must be a GeoJSON object")
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    valid = False
    if geometry_type == "Point":
        valid = _position_valid(coordinates)
    elif geometry_type == "Polygon":
        valid = (
            isinstance(coordinates, Sequence)
            and bool(coordinates)
            and all(_ring_valid(ring) for ring in coordinates)
        )
    elif geometry_type == "MultiPolygon":
        valid = (
            isinstance(coordinates, Sequence)
            and bool(coordinates)
            and all(
                isinstance(polygon, Sequence)
                and bool(polygon)
                and all(_ring_valid(ring) for ring in polygon)
                for polygon in coordinates
            )
        )
    if not valid:
        raise InvariantViolation("geometry must be a valid Point, Polygon, or MultiPolygon")


def validate_record(data: Mapping[str, Any]) -> None:
    require_citations_for_money(data)
    require_valid_geometry(data)


def freshness_flags(
    data: Mapping[str, Any],
    *,
    today: date | None = None,
    stale_after_days: int = 90,
    deadline_window_days: int = 30,
) -> dict[str, Any]:
    current = today or datetime.now(UTC).date()
    flags: dict[str, Any] = {"is_stale": False, "deadline_state": None}
    verified_raw = data.get("verified_on")
    if isinstance(verified_raw, str):
        verified = date.fromisoformat(verified_raw)
        flags["is_stale"] = current - verified > timedelta(days=stale_after_days)
    deadline_raw = data.get("deadline_on")
    if isinstance(deadline_raw, str):
        deadline = date.fromisoformat(deadline_raw)
        remaining = (deadline - current).days
        if remaining < 0:
            flags["deadline_state"] = "expired"
        elif remaining <= deadline_window_days:
            flags["deadline_state"] = "due_soon"
    return flags
