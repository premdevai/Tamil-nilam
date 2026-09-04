from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from nilam_dataops.models import FieldDiff

_MISSING = object()


def field_diff(before: Any, after: Any, path: str = "$") -> tuple[FieldDiff, ...]:
    """Return deterministic leaf-level changes between JSON-compatible values."""
    changes: list[FieldDiff] = []
    if isinstance(before, Mapping) and isinstance(after, Mapping):
        for key in sorted(set(before) | set(after)):
            old = before.get(key, _MISSING)
            new = after.get(key, _MISSING)
            child_path = f"{path}.{key}"
            if old is _MISSING:
                changes.append(FieldDiff(child_path, None, new, "add"))
            elif new is _MISSING:
                changes.append(FieldDiff(child_path, old, None, "remove"))
            else:
                changes.extend(field_diff(old, new, child_path))
        return tuple(changes)
    if (
        isinstance(before, Sequence)
        and isinstance(after, Sequence)
        and not isinstance(before, (str, bytes, bytearray))
        and not isinstance(after, (str, bytes, bytearray))
    ):
        for index in range(max(len(before), len(after))):
            old = before[index] if index < len(before) else _MISSING
            new = after[index] if index < len(after) else _MISSING
            child_path = f"{path}[{index}]"
            if old is _MISSING:
                changes.append(FieldDiff(child_path, None, new, "add"))
            elif new is _MISSING:
                changes.append(FieldDiff(child_path, old, None, "remove"))
            else:
                changes.extend(field_diff(old, new, child_path))
        return tuple(changes)
    if before != after:
        changes.append(FieldDiff(path, before, after, "replace"))
    return tuple(changes)
