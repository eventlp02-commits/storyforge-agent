#!/usr/bin/env python3
"""Validate timing, identifiers, asset calls, and declared video-project outputs."""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path


ASSET_STATUSES = {"planned", "prompt-only", "generating", "done", "deferred", "cancelled"}
SHOT_STATUSES = {"planned", "draft", "approved", "generated", "deferred", "cancelled"}
REQUIRED_PROJECT_FIELDS = {
    "title",
    "project_type",
    "duration_seconds",
    "aspect_ratio",
    "fps",
    "resolution",
    "language",
    "audio_policy",
    "status",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def split_ids(raw: str) -> set[str]:
    return {item.strip() for item in raw.replace(";", ",").split(",") if item.strip()}


def as_float(value: str, field: str, row_label: str, errors: list[str]) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        errors.append(f"{row_label}: {field} is not numeric: {value!r}")
        return None
    if not math.isfinite(result):
        errors.append(f"{row_label}: {field} is not finite")
        return None
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", help="Video project root")
    parser.add_argument("--tolerance", type=float, default=0.05, help="Timing tolerance in seconds")
    args = parser.parse_args()

    root = Path(args.project).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    project_path = root / "project.json"
    if not project_path.exists():
        errors.append("Missing project.json")
        project = {}
    else:
        try:
            project = json.loads(project_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"Invalid project.json: {exc}")
            project = {}

    missing = sorted(REQUIRED_PROJECT_FIELDS - set(project))
    if missing:
        errors.append("project.json missing fields: " + ", ".join(missing))

    try:
        total_duration = float(project.get("duration_seconds", 0))
        if total_duration <= 0:
            errors.append("duration_seconds must be positive")
    except (TypeError, ValueError):
        total_duration = 0
        errors.append("duration_seconds must be numeric")

    assets = read_csv(root / "04_assets/asset_manifest.csv")
    asset_ids: set[str] = set()
    for index, row in enumerate(assets, start=2):
        label = f"asset row {index}"
        asset_id = (row.get("asset_id") or "").strip()
        if not asset_id:
            errors.append(f"{label}: missing asset_id")
            continue
        if asset_id in asset_ids:
            errors.append(f"{label}: duplicate asset_id {asset_id}")
        asset_ids.add(asset_id)
        status = (row.get("status") or "planned").strip()
        if status not in ASSET_STATUSES:
            errors.append(f"{label}: invalid status {status!r}")
        output = (row.get("output_path") or "").strip()
        if status == "done":
            if not output:
                errors.append(f"{label}: done asset {asset_id} has no output_path")
            elif not (root / output).exists() and not Path(output).expanduser().exists():
                errors.append(f"{label}: done asset file does not exist: {output}")

    shots = read_csv(root / "03_shots/shots.csv")
    if not shots:
        warnings.append("shots.csv contains no shots")

    shot_ids: set[str] = set()
    previous_end: float | None = None
    final_end = 0.0
    for index, row in enumerate(shots, start=2):
        label = f"shot row {index}"
        shot_id = (row.get("shot_id") or "").strip()
        if not shot_id:
            errors.append(f"{label}: missing shot_id")
            shot_id = label
        elif shot_id in shot_ids:
            errors.append(f"{label}: duplicate shot_id {shot_id}")
        shot_ids.add(shot_id)

        start = as_float(row.get("start_s", ""), "start_s", shot_id, errors)
        end = as_float(row.get("end_s", ""), "end_s", shot_id, errors)
        duration = as_float(row.get("duration_s", ""), "duration_s", shot_id, errors)
        if None not in (start, end, duration):
            assert start is not None and end is not None and duration is not None
            if start < 0 or end <= start or duration <= 0:
                errors.append(f"{shot_id}: invalid time range {start}-{end} ({duration})")
            if abs((end - start) - duration) > args.tolerance:
                errors.append(f"{shot_id}: duration_s does not equal end_s - start_s")
            if previous_end is not None:
                delta = start - previous_end
                if abs(delta) > args.tolerance:
                    kind = "gap" if delta > 0 else "overlap"
                    errors.append(f"{shot_id}: timing {kind} of {abs(delta):.3f}s")
            previous_end = end
            final_end = end

        status = (row.get("status") or "planned").strip()
        if status not in SHOT_STATUSES:
            errors.append(f"{shot_id}: invalid status {status!r}")
        unknown_assets = split_ids(row.get("asset_refs") or "") - asset_ids
        if unknown_assets:
            errors.append(f"{shot_id}: unknown asset IDs: {', '.join(sorted(unknown_assets))}")

    if shots and abs(final_end - total_duration) > args.tolerance:
        errors.append(
            f"Final shot ends at {final_end:.3f}s but project duration is {total_duration:.3f}s"
        )

    print(f"Project: {root}")
    print(f"Shots: {len(shots)} | Assets: {len(assets)}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print("VALID" if not errors else f"INVALID ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
