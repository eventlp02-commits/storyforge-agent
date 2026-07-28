#!/usr/bin/env python3
"""Validate a verified clip-loop video project."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from pathlib import Path
from typing import Any

from lint_copy_ready_prompt import lint_prompt


ASSET_STATUSES = {"planned", "prompt-only", "generating", "done", "deferred", "cancelled"}
SHOT_STATUSES = {"planned", "draft", "approved", "generated", "deferred", "cancelled"}
CLIP_STATUSES = {
    "planned",
    "directing",
    "prompt_ready",
    "waiting_for_result",
    "inspecting",
    "end_locked",
    "completed",
    "needs_revision",
    "result_unreadable",
    "cancelled",
}
PROMPT_REQUIRED_STATUSES = {
    "prompt_ready",
    "waiting_for_result",
    "inspecting",
    "end_locked",
    "completed",
}
ACTUAL_END_REQUIRED_STATUSES = {"end_locked", "completed"}
PRIOR_READY_STATUSES = {"end_locked", "completed"}
REQUIRED_PROJECT_FIELDS = {
    "schema_version",
    "title",
    "project_type",
    "target_duration_seconds",
    "default_clip_duration_seconds",
    "aspect_ratio",
    "fps",
    "resolution",
    "language",
    "audio_policy",
    "current_clip_id",
    "status",
}
REQUIRED_CLIP_FIELDS = {
    "clip_id",
    "clip_index",
    "planned_duration_s",
    "local_start_s",
    "prior_clip_id",
    "requires_prior_actual_end_state",
    "prompt_path",
    "status",
}
CLIP_DIR_RE = re.compile(r"^CLIP-(\d+)$")


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path, label: str, errors: list[str]) -> dict[str, Any] | None:
    if not path.exists():
        errors.append(f"Missing {label}: {path}")
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Invalid {label}: {exc}")
        return None
    if not isinstance(value, dict):
        errors.append(f"{label} must contain a JSON object")
        return None
    return value


def as_float(value: object, field: str, row_label: str, errors: list[str]) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        errors.append(f"{row_label}: {field} is not numeric: {value!r}")
        return None
    if not math.isfinite(result):
        errors.append(f"{row_label}: {field} is not finite")
        return None
    return result


def validate_shot_plan(
    path: Path,
    clip_id: str,
    clip_duration: float,
    tolerance: float,
    errors: list[str],
    warnings: list[str],
) -> int:
    shots = read_csv(path)
    if not shots:
        warnings.append(f"{clip_id}: shot_plan.csv contains no shots")
        return 0

    shot_ids: set[str] = set()
    previous_end: float | None = None
    for index, row in enumerate(shots, start=2):
        label = f"{clip_id} shot row {index}"
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
                errors.append(f"{shot_id}: invalid local range {start}-{end} ({duration})")
            if abs((end - start) - duration) > tolerance:
                errors.append(f"{shot_id}: duration_s does not equal end_s - start_s")
            if previous_end is None and abs(start) > tolerance:
                errors.append(f"{shot_id}: first shot in {clip_id} must start at 0")
            if previous_end is not None:
                delta = start - previous_end
                if abs(delta) > tolerance:
                    kind = "gap" if delta > 0 else "overlap"
                    errors.append(f"{shot_id}: local timing {kind} of {abs(delta):.3f}s")
            previous_end = end

        status = (row.get("status") or "planned").strip()
        if status not in SHOT_STATUSES:
            errors.append(f"{shot_id}: invalid status {status!r}")

    if previous_end is not None and abs(previous_end - clip_duration) > tolerance:
        errors.append(
            f"{clip_id}: final shot ends at {previous_end:.3f}s, "
            f"expected local duration {clip_duration:.3f}s"
        )
    return len(shots)


def validate_actual_end_state(
    path: Path,
    clip_id: str,
    errors: list[str],
) -> dict[str, Any] | None:
    value = read_json(path, f"{clip_id} actual_end_state.json", errors)
    if value is None:
        return None

    required = {
        "clip_id",
        "actual_duration_s",
        "last_stable_frame_s",
        "subjects",
        "camera",
        "lighting",
        "environment",
        "audio_tail",
        "deviations_from_plan",
    }
    missing = sorted(required - set(value))
    if missing:
        errors.append(f"{clip_id} actual_end_state.json missing fields: {', '.join(missing)}")

    if value.get("clip_id") != clip_id:
        errors.append(f"{clip_id}: actual_end_state clip_id does not match")

    actual_duration = as_float(
        value.get("actual_duration_s"),
        "actual_duration_s",
        clip_id,
        errors,
    )
    stable_frame = as_float(
        value.get("last_stable_frame_s"),
        "last_stable_frame_s",
        clip_id,
        errors,
    )
    if actual_duration is not None and actual_duration <= 0:
        errors.append(f"{clip_id}: actual_duration_s must be positive")
    if stable_frame is not None and stable_frame < 0:
        errors.append(f"{clip_id}: last_stable_frame_s cannot be negative")
    if (
        actual_duration is not None
        and stable_frame is not None
        and stable_frame > actual_duration
    ):
        errors.append(f"{clip_id}: last_stable_frame_s exceeds actual_duration_s")

    subjects = value.get("subjects")
    if not isinstance(subjects, list) or not subjects:
        errors.append(f"{clip_id}: actual_end_state subjects must be a non-empty list")

    for field in ["camera", "lighting", "environment", "audio_tail"]:
        if not isinstance(value.get(field), dict):
            errors.append(f"{clip_id}: actual_end_state {field} must be an object")

    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", help="Video project root")
    parser.add_argument("--tolerance", type=float, default=0.05)
    args = parser.parse_args()

    root = Path(args.project).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    project = read_json(root / "project.json", "project.json", errors) or {}
    missing = sorted(REQUIRED_PROJECT_FIELDS - set(project))
    if missing:
        errors.append("project.json missing fields: " + ", ".join(missing))

    if project.get("schema_version") != 2:
        errors.append("project.json schema_version must be 2")

    target_duration = as_float(
        project.get("target_duration_seconds"),
        "target_duration_seconds",
        "project",
        errors,
    )
    default_clip_duration = as_float(
        project.get("default_clip_duration_seconds"),
        "default_clip_duration_seconds",
        "project",
        errors,
    )
    if target_duration is not None and target_duration <= 0:
        errors.append("target_duration_seconds must be positive")
    if default_clip_duration is not None and default_clip_duration <= 0:
        errors.append("default_clip_duration_seconds must be positive")

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

    clips_root = root / "03_clips"
    clip_dirs = []
    if clips_root.exists():
        for path in clips_root.iterdir():
            if path.is_dir() and CLIP_DIR_RE.fullmatch(path.name):
                clip_dirs.append(path)
    clip_dirs.sort(key=lambda path: int(CLIP_DIR_RE.fullmatch(path.name).group(1)))  # type: ignore[union-attr]

    if not clip_dirs:
        errors.append("No Clip directories found in 03_clips")

    clips: list[tuple[Path, dict[str, Any]]] = []
    clip_ids: set[str] = set()
    clip_indices: set[int] = set()
    total_shots = 0

    for path in clip_dirs:
        clip_id = path.name
        clip = read_json(path / "clip.json", f"{clip_id}/clip.json", errors)
        if clip is None:
            continue

        missing_clip_fields = sorted(REQUIRED_CLIP_FIELDS - set(clip))
        if missing_clip_fields:
            errors.append(
                f"{clip_id}/clip.json missing fields: {', '.join(missing_clip_fields)}"
            )

        if clip.get("clip_id") != clip_id:
            errors.append(f"{clip_id}: clip.json clip_id does not match directory")
        if clip_id in clip_ids:
            errors.append(f"Duplicate Clip ID: {clip_id}")
        clip_ids.add(clip_id)

        try:
            clip_index = int(clip.get("clip_index"))
        except (TypeError, ValueError):
            clip_index = -1
            errors.append(f"{clip_id}: clip_index must be an integer")
        if clip_index in clip_indices:
            errors.append(f"{clip_id}: duplicate clip_index {clip_index}")
        clip_indices.add(clip_index)

        local_start = as_float(clip.get("local_start_s"), "local_start_s", clip_id, errors)
        if local_start is not None and abs(local_start) > args.tolerance:
            errors.append(f"{clip_id}: local_start_s must be 0")

        clip_duration = as_float(
            clip.get("planned_duration_s"),
            "planned_duration_s",
            clip_id,
            errors,
        )
        if clip_duration is None:
            clip_duration = 0
        elif clip_duration <= 0:
            errors.append(f"{clip_id}: planned_duration_s must be positive")

        status = str(clip.get("status") or "")
        if status not in CLIP_STATUSES:
            errors.append(f"{clip_id}: invalid Clip status {status!r}")

        director_card = read_json(
            path / "director_card.json",
            f"{clip_id}/director_card.json",
            errors,
        )
        if director_card is not None and director_card.get("clip_id") != clip_id:
            errors.append(f"{clip_id}: director_card clip_id does not match")

        prompt_path_value = str(clip.get("prompt_path") or "")
        prompt_path = root / prompt_path_value if prompt_path_value else path / "prompt.txt"
        prompt_text = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""
        if status in PROMPT_REQUIRED_STATUSES and not prompt_text.strip():
            errors.append(f"{clip_id}: status {status} requires a non-empty prompt")
        if prompt_text.strip():
            for finding in lint_prompt(
                prompt_text,
                duration=clip_duration,
                tolerance=args.tolerance,
                require_timing=True,
            ):
                errors.append(f"{clip_id} prompt: {finding}")

        total_shots += validate_shot_plan(
            path / "shot_plan.csv",
            clip_id,
            clip_duration,
            args.tolerance,
            errors,
            warnings,
        )

        actual_end_path = path / "actual_end_state.json"
        if status in ACTUAL_END_REQUIRED_STATUSES:
            validate_actual_end_state(actual_end_path, clip_id, errors)
        elif actual_end_path.exists():
            validate_actual_end_state(actual_end_path, clip_id, errors)

        clips.append((path, clip))

    clips.sort(key=lambda item: int(item[1].get("clip_index", 0)))
    for position, (path, clip) in enumerate(clips):
        clip_id = str(clip.get("clip_id") or path.name)
        clip_index = int(clip.get("clip_index", 0))
        expected_index = position + 1
        if clip_index != expected_index:
            errors.append(
                f"{clip_id}: clip_index {clip_index} is not contiguous; expected {expected_index}"
            )

        if position == 0:
            if clip.get("prior_clip_id") not in (None, ""):
                errors.append(f"{clip_id}: Clip 01 must not have prior_clip_id")
            if bool(clip.get("requires_prior_actual_end_state")):
                errors.append(f"{clip_id}: Clip 01 must not require prior actual end state")
            continue

        previous_path, previous_clip = clips[position - 1]
        previous_id = str(previous_clip.get("clip_id") or previous_path.name)
        if clip.get("prior_clip_id") != previous_id:
            errors.append(f"{clip_id}: prior_clip_id must be {previous_id}")
        if not bool(clip.get("requires_prior_actual_end_state")):
            errors.append(f"{clip_id}: must require prior actual end state")
        if previous_clip.get("status") not in PRIOR_READY_STATUSES:
            errors.append(
                f"{clip_id}: prior Clip {previous_id} is not end_locked or completed"
            )
        if not (previous_path / "actual_end_state.json").exists():
            errors.append(f"{clip_id}: missing {previous_id} actual_end_state.json")

    current_clip_id = str(project.get("current_clip_id") or "")
    if current_clip_id and current_clip_id not in clip_ids:
        errors.append(f"project current_clip_id does not exist: {current_clip_id}")

    print(f"Project: {root}")
    print(f"Clips: {len(clips)} | Shots: {total_shots} | Assets: {len(assets)}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print("VALID" if not errors else f"INVALID ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
