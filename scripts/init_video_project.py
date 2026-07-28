#!/usr/bin/env python3
"""Create a verified clip-loop video project scaffold."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


PROJECT_TYPES = {
    "narrative-short",
    "commercial",
    "promo",
    "music-video",
    "trailer",
    "documentary",
    "explainer",
    "social-short",
    "world-showcase",
    "hybrid",
}

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

ASSET_FIELDS = [
    "asset_id",
    "type",
    "name",
    "description",
    "variant",
    "views_needed",
    "used_in_clips",
    "reference_paths",
    "output_path",
    "status",
    "notes",
]


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w.-]+", "-", value.strip(), flags=re.UNICODE).strip("-._")
    return slug or "video-project"


def write_csv(path: Path, fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        csv.DictWriter(handle, fieldnames=fields).writeheader()


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Parent folder for the project")
    parser.add_argument("--title", required=True)
    parser.add_argument("--type", default="hybrid", choices=sorted(PROJECT_TYPES))
    parser.add_argument(
        "--duration",
        required=True,
        type=float,
        help="Editorial target runtime for the complete project in seconds",
    )
    parser.add_argument(
        "--clip-duration",
        default=15,
        type=float,
        help="Planned duration for Clip 01 in seconds",
    )
    parser.add_argument("--aspect", default="16:9")
    parser.add_argument("--language", default="zh-CN")
    parser.add_argument("--fps", default=24, type=float)
    parser.add_argument("--resolution", default="4K")
    parser.add_argument("--folder-name", help="Override the generated folder name")
    args = parser.parse_args()

    if args.duration <= 0:
        parser.error("--duration must be positive")
    if args.clip_duration <= 0:
        parser.error("--clip-duration must be positive")
    if args.clip_duration > args.duration:
        parser.error("--clip-duration cannot exceed --duration")

    root = Path(args.output).expanduser().resolve() / (args.folder_name or slugify(args.title))
    root.mkdir(parents=True, exist_ok=False)

    for relative in [
        "01_brief",
        "02_writing",
        "03_clips/CLIP-01/result",
        "04_assets/references",
        "04_assets/generated",
        "05_deliverables",
        "99_work",
    ]:
        (root / relative).mkdir(parents=True)

    project = {
        "schema_version": 2,
        "title": args.title,
        "project_type": args.type,
        "target_duration_seconds": args.duration,
        "default_clip_duration_seconds": args.clip_duration,
        "aspect_ratio": args.aspect,
        "fps": args.fps,
        "resolution": args.resolution,
        "language": args.language,
        "target_platforms": [],
        "target_models": [],
        "visual_style": "",
        "audio_policy": "",
        "delivery_mode": "full-production",
        "current_clip_id": "CLIP-01",
        "status": "planning",
    }
    write_json(root / "project.json", project)

    (root / "01_brief/creative_brief.md").write_text(
        f"# {args.title}\n\n"
        "## Goal\n\n"
        "## Audience And Platform\n\n"
        "## Core Promise Or Logline\n\n"
        "## Tone And Visual Thesis\n\n"
        "## Audio And Language\n\n"
        "## Required Deliverables\n\n"
        "## References And Rights\n\n"
        "## Assumptions And Open Decisions\n",
        encoding="utf-8",
    )
    (root / "02_writing/story_route.md").write_text(
        "# Story Route\n\n"
        "Describe ordered Clip jobs only. Do not prewrite future executable prompts.\n\n"
        "## Clip 01 Job\n\n",
        encoding="utf-8",
    )
    (root / "02_writing/creative_bible.md").write_text(
        "# Creative Bible\n\n"
        "## Story, Brand, Or Subject Rules\n\n"
        "## Characters Or Presenters\n\n"
        "## Locations And Geography\n\n"
        "## Visual Style Lock\n\n"
        "## Camera And Motion Grammar\n\n"
        "## Lighting Grammar\n\n"
        "## Audio Grammar\n\n"
        "## Continuity Locks\n",
        encoding="utf-8",
    )
    (root / "02_writing/script.md").write_text(
        "# Script\n\n## Story Summary\n\n## Full Script\n",
        encoding="utf-8",
    )

    clip_root = root / "03_clips/CLIP-01"
    write_json(
        clip_root / "clip.json",
        {
            "clip_id": "CLIP-01",
            "clip_index": 1,
            "planned_duration_s": args.clip_duration,
            "local_start_s": 0,
            "prior_clip_id": None,
            "requires_prior_actual_end_state": False,
            "prompt_path": "03_clips/CLIP-01/prompt.txt",
            "status": "planned",
        },
    )
    write_json(
        clip_root / "director_card.json",
        {
            "clip_id": "CLIP-01",
            "scene_job": "",
            "scene_intent": "",
            "camera_strategy": "",
            "lighting_strategy": "",
            "sound_strategy": "",
            "start_state": {},
            "target_end_state": {},
            "continuity_risks": [],
        },
    )
    (clip_root / "prompt.txt").write_text("", encoding="utf-8")
    write_csv(clip_root / "shot_plan.csv", SHOT_FIELDS)
    write_csv(root / "04_assets/asset_manifest.csv", ASSET_FIELDS)

    (root / "05_deliverables/delivery_checklist.md").write_text(
        "# Delivery Checklist\n\n"
        "- [ ] Only the current Clip has an executable prompt\n"
        "- [ ] Current Clip timing starts at 0 and ends at its own duration\n"
        "- [ ] Previous real result was inspected before continuing\n"
        "- [ ] Prompt purity validation passed\n"
        "- [ ] Action, camera, light, and sound continuity reviewed\n"
        "- [ ] Internal asset names do not appear in prompt text\n"
        "- [ ] Final document rendered and visually inspected\n"
        "- [ ] Final archive extracted successfully\n",
        encoding="utf-8",
    )

    print(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
