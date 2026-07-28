#!/usr/bin/env python3
"""Create the next Clip only after the prior real ending has been locked."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


PRIOR_READY_STATUSES = {"end_locked", "completed"}
CLIP_DIR_RE = re.compile(r"^CLIP-(\d+)$")
SHOT_FIELDS = [
    "shot_id",
    "start_s",
    "end_s",
    "duration_s",
    "scene_job",
    "shot_size",
    "camera_position",
    "camera_motion",
    "blocking_and_action",
    "lighting",
    "dialogue",
    "voiceover",
    "ambience",
    "sfx",
    "music",
    "transition",
    "continuity",
    "status",
]


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Missing file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", help="Video project root")
    parser.add_argument(
        "--duration",
        type=float,
        help="Planned duration for the next Clip; defaults to project setting",
    )
    args = parser.parse_args()

    root = Path(args.project).expanduser().resolve()
    project = read_json(root / "project.json")
    clips_root = root / "03_clips"

    clip_dirs = [
        path
        for path in clips_root.iterdir()
        if path.is_dir() and CLIP_DIR_RE.fullmatch(path.name)
    ]
    if not clip_dirs:
        raise ValueError("No prior Clip exists")
    clip_dirs.sort(key=lambda path: int(CLIP_DIR_RE.fullmatch(path.name).group(1)))  # type: ignore[union-attr]

    prior_path = clip_dirs[-1]
    prior = read_json(prior_path / "clip.json")
    prior_id = str(prior.get("clip_id") or prior_path.name)
    if prior.get("status") not in PRIOR_READY_STATUSES:
        raise ValueError(
            f"{prior_id} must be end_locked or completed before creating the next Clip"
        )

    actual_end_path = prior_path / "actual_end_state.json"
    actual_end = read_json(actual_end_path)
    if actual_end.get("clip_id") != prior_id:
        raise ValueError(f"{prior_id} actual_end_state.json has a mismatched clip_id")
    if not actual_end.get("subjects"):
        raise ValueError(f"{prior_id} actual_end_state.json has no subject state")

    next_index = int(prior.get("clip_index", 0)) + 1
    next_id = f"CLIP-{next_index:02d}"
    next_path = clips_root / next_id
    if next_path.exists():
        raise ValueError(f"Next Clip already exists: {next_path}")

    duration = args.duration
    if duration is None:
        duration = float(project.get("default_clip_duration_seconds", 0))
    if duration <= 0:
        raise ValueError("Next Clip duration must be positive")

    (next_path / "result").mkdir(parents=True)
    write_json(
        next_path / "clip.json",
        {
            "clip_id": next_id,
            "clip_index": next_index,
            "planned_duration_s": duration,
            "local_start_s": 0,
            "prior_clip_id": prior_id,
            "requires_prior_actual_end_state": True,
            "prompt_path": f"03_clips/{next_id}/prompt.txt",
            "status": "directing",
        },
    )
    write_json(
        next_path / "director_card.json",
        {
            "clip_id": next_id,
            "scene_job": "",
            "scene_intent": "",
            "camera_strategy": "",
            "lighting_strategy": "",
            "sound_strategy": "",
            "start_state": actual_end,
            "target_end_state": {},
            "continuity_risks": list(actual_end.get("deviations_from_plan") or []),
        },
    )
    (next_path / "prompt.txt").write_text("", encoding="utf-8")
    with (next_path / "shot_plan.csv").open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        csv.DictWriter(handle, fieldnames=SHOT_FIELDS).writeheader()

    project["current_clip_id"] = next_id
    project["status"] = "directing"
    write_json(root / "project.json", project)

    print(next_path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"ERROR: {exc}")
        raise SystemExit(1)
