#!/usr/bin/env python3
"""Create a reusable video-production project scaffold."""

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
    "segment_id",
    "start_s",
    "end_s",
    "duration_s",
    "scene",
    "purpose",
    "shot_size",
    "camera",
    "motion",
    "action",
    "dialogue",
    "voiceover",
    "sfx",
    "music",
    "transition",
    "continuity",
    "asset_refs",
    "prompt",
    "status",
]

ASSET_FIELDS = [
    "asset_id",
    "type",
    "name",
    "description",
    "variant",
    "views_needed",
    "related_shots",
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Parent folder for the project")
    parser.add_argument("--title", required=True)
    parser.add_argument("--type", default="hybrid", choices=sorted(PROJECT_TYPES))
    parser.add_argument("--duration", required=True, type=float, help="Total runtime in seconds")
    parser.add_argument("--aspect", default="16:9")
    parser.add_argument("--language", default="zh-CN")
    parser.add_argument("--fps", default=24, type=float)
    parser.add_argument("--resolution", default="4K")
    parser.add_argument("--folder-name", help="Override the generated folder name")
    args = parser.parse_args()

    if args.duration <= 0:
        parser.error("--duration must be positive")

    root = Path(args.output).expanduser().resolve() / (args.folder_name or slugify(args.title))
    root.mkdir(parents=True, exist_ok=False)

    for relative in [
        "01_brief",
        "02_writing",
        "03_shots",
        "04_assets/references",
        "04_assets/generated",
        "05_deliverables",
        "99_work",
    ]:
        (root / relative).mkdir(parents=True)

    project = {
        "title": args.title,
        "project_type": args.type,
        "duration_seconds": args.duration,
        "aspect_ratio": args.aspect,
        "fps": args.fps,
        "resolution": args.resolution,
        "language": args.language,
        "target_platforms": [],
        "visual_style": "",
        "audio_policy": "",
        "delivery_mode": "full-production",
        "status": "planning",
    }
    (root / "project.json").write_text(
        json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

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
    (root / "02_writing/creative_bible.md").write_text(
        "# Creative Bible\n\n"
        "## Story, Brand, Or Subject Rules\n\n"
        "## Characters Or Presenters\n\n"
        "## Locations And Geography\n\n"
        "## Visual Style Lock\n\n"
        "## Continuity Locks\n\n"
        "## Audio Motifs\n",
        encoding="utf-8",
    )
    (root / "02_writing/script.md").write_text(
        "# Script\n\n## Timing Summary\n\n## Full Script\n", encoding="utf-8"
    )
    (root / "03_shots/segment_prompts.md").write_text(
        "# Consolidated Segment Prompts\n", encoding="utf-8"
    )
    write_csv(root / "03_shots/shots.csv", SHOT_FIELDS)
    write_csv(root / "04_assets/asset_manifest.csv", ASSET_FIELDS)
    (root / "05_deliverables/delivery_checklist.md").write_text(
        "# Delivery Checklist\n\n"
        "- [ ] Runtime and shot timing validated\n"
        "- [ ] Script, prompts, and audio policy aligned\n"
        "- [ ] Asset manifest matches files and shot calls\n"
        "- [ ] Originality and sensitive-content review completed\n"
        "- [ ] Final document rendered and visually inspected\n"
        "- [ ] Final archive extracted successfully\n",
        encoding="utf-8",
    )

    print(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
