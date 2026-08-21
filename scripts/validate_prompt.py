#!/usr/bin/env python3
"""Validate purity and local timing for a copy-ready AI video prompt."""

from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass
from pathlib import Path


FORBIDDEN_PHRASES = {
    "asset calls",
    "prompt-only",
    "直接引用",
    "复制以下",
    "复制到模型",
    "制作说明",
    "工作状态",
    "资产引用",
    "项目总时长",
    "这是给用户的说明",
}
INTERNAL_ID_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9])(?:REF|CHR|LOC|PRP|FX|AST|SCN|CLIP)[-_]?\d{2,}(?![A-Za-z0-9])"
)
FILE_RE = re.compile(
    r"(?i)(?:[^\s/\\]+\.(?:png|jpe?g|webp|gif|bmp|tiff?|mp4|mov|mkv|avi|wav|mp3|m4a|aac|docx?|pdf))\b"
)
PATH_RE = re.compile(r"(?i)(?:file://|/Users/|/home/|[A-Z]:\\|\\\\[A-Za-z0-9_.-]+\\)")
HEADING_RE = re.compile(r"(?m)^\s{0,3}#{1,6}\s+\S")
TIME_RE = re.compile(
    r"(?<![\d:])(?P<start>\d+(?:\.\d+)?)\s*(?:秒)?\s*"
    r"(?:-|–|—|~|～|至)\s*(?P<end>\d+(?:\.\d+)?)\s*秒"
)


@dataclass(frozen=True)
class TimeRange:
    start: float
    end: float
    raw: str


def validate_prompt(
    text: str,
    duration: float | None = None,
    tolerance: float = 0.05,
) -> list[str]:
    errors: list[str] = []
    if not text.strip():
        return ["prompt is empty"]

    lowered = text.casefold()
    for phrase in sorted(FORBIDDEN_PHRASES):
        if phrase.casefold() in lowered:
            errors.append(f"forbidden production phrase: {phrase}")

    checks = [
        ("Markdown heading", HEADING_RE),
        ("internal ID", INTERNAL_ID_RE),
        ("filename", FILE_RE),
        ("filesystem path", PATH_RE),
    ]
    for label, pattern in checks:
        match = pattern.search(text)
        if match:
            errors.append(f"forbidden {label}: {match.group(0)!r}")
    if "`" in text:
        errors.append("backticks are not allowed")

    ranges = [
        TimeRange(float(match.group("start")), float(match.group("end")), match.group(0))
        for match in TIME_RE.finditer(text)
    ]
    if not ranges:
        errors.append("no local time ranges found")
        return errors

    if abs(ranges[0].start) > tolerance:
        errors.append(f"first time range must start at 0, found {ranges[0].start:g}")

    previous_end: float | None = None
    for item in ranges:
        if not math.isfinite(item.start) or not math.isfinite(item.end):
            errors.append(f"non-finite range: {item.raw}")
            continue
        if item.start < 0 or item.end <= item.start:
            errors.append(f"invalid range: {item.raw}")
        if previous_end is not None:
            delta = item.start - previous_end
            if delta > tolerance:
                errors.append(f"time gap of {delta:.3f}s before {item.raw}")
            elif delta < -tolerance:
                errors.append(f"time overlap of {abs(delta):.3f}s at {item.raw}")
        previous_end = item.end

    if duration is not None:
        if not math.isfinite(duration) or duration <= 0:
            errors.append("duration must be positive and finite")
        else:
            for item in ranges:
                if item.end > duration + tolerance:
                    errors.append(f"range exceeds duration {duration:g}s: {item.raw}")
            if abs(ranges[-1].end - duration) > tolerance:
                errors.append(
                    f"final range ends at {ranges[-1].end:g}s, expected {duration:g}s"
                )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", help="Path to the prompt text file")
    parser.add_argument("--duration", type=float, help="Requested video duration in seconds")
    parser.add_argument("--tolerance", type=float, default=0.05)
    args = parser.parse_args()

    path = Path(args.prompt).expanduser().resolve()
    if not path.is_file():
        print(f"ERROR: prompt file does not exist: {path}")
        return 1

    errors = validate_prompt(
        path.read_text(encoding="utf-8"),
        duration=args.duration,
        tolerance=args.tolerance,
    )
    for error in errors:
        print(f"ERROR: {error}")
    print("VALID" if not errors else f"INVALID ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
