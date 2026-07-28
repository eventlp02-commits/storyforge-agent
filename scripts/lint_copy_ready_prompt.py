#!/usr/bin/env python3
"""Lint a copy-ready video prompt for purity and clip-local timing."""

from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass
from pathlib import Path


FORBIDDEN_PHRASES = {
    "资产引用",
    "asset calls",
    "prompt-only",
    "直接使用用户图",
    "直接引用",
    "上图只是",
    "以下正文保留",
    "实际生成时必须分别引用",
    "这是给用户的说明",
    "复制以下",
    "复制到模型",
    "项目总时长",
    "全片时间码",
    "累计时间",
}

INTERNAL_ID_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9])(?:REF|CHR|LOC|PRP|FX|AST|SCN)[-_]?\d{2,}(?![A-Za-z0-9])"
)
FILE_EXTENSION_RE = re.compile(
    r"(?i)\.(?:png|jpe?g|webp|gif|bmp|tiff?|mp4|mov|mkv|avi|wav|mp3|m4a|aac|docx?|pdf)\b"
)
PATH_RE = re.compile(r"(?i)(?:file://|/Users/|/home/|[A-Z]:\\|\\\\[A-Za-z0-9_.-]+\\)")
MARKDOWN_HEADING_RE = re.compile(r"(?m)^\s{0,3}#{1,6}\s+\S")
EXPLANATION_LABEL_RE = re.compile(
    r"(?im)^\s*(?:说明|备注|制作说明|给用户|工作状态|资产状态|引用说明)\s*[：:]"
)
SECONDS_RANGE_RE = re.compile(
    r"(?<![\d:])"
    r"(?P<start>\d+(?:\.\d+)?)\s*(?:秒)?\s*"
    r"(?:-|–|—|~|～|至)\s*"
    r"(?P<end>\d+(?:\.\d+)?)\s*秒"
)
CLOCK_RANGE_RE = re.compile(
    r"(?<!\d)"
    r"(?P<start_m>\d{1,2}):(?P<start_s>\d{2}(?:\.\d+)?)\s*"
    r"(?:-|–|—|~|～|至)\s*"
    r"(?P<end_m>\d{1,2}):(?P<end_s>\d{2}(?:\.\d+)?)"
)


@dataclass(frozen=True)
class TimeRange:
    start: float
    end: float
    position: int
    raw: str


def extract_time_ranges(text: str) -> list[TimeRange]:
    ranges: list[TimeRange] = []
    for match in SECONDS_RANGE_RE.finditer(text):
        ranges.append(
            TimeRange(
                start=float(match.group("start")),
                end=float(match.group("end")),
                position=match.start(),
                raw=match.group(0),
            )
        )
    for match in CLOCK_RANGE_RE.finditer(text):
        ranges.append(
            TimeRange(
                start=float(match.group("start_m")) * 60 + float(match.group("start_s")),
                end=float(match.group("end_m")) * 60 + float(match.group("end_s")),
                position=match.start(),
                raw=match.group(0),
            )
        )
    return sorted(ranges, key=lambda item: item.position)


def lint_prompt(
    text: str,
    duration: float | None = None,
    tolerance: float = 0.05,
    require_timing: bool = True,
) -> list[str]:
    errors: list[str] = []
    lowered = text.casefold()

    if not text.strip():
        return ["Prompt is empty"]

    for phrase in sorted(FORBIDDEN_PHRASES):
        if phrase.casefold() in lowered:
            errors.append(f"Forbidden prompt phrase: {phrase}")

    for label, pattern in [
        ("internal asset ID", INTERNAL_ID_RE),
        ("filename or file extension", FILE_EXTENSION_RE),
        ("filesystem path", PATH_RE),
        ("Markdown heading", MARKDOWN_HEADING_RE),
        ("explanatory label", EXPLANATION_LABEL_RE),
    ]:
        match = pattern.search(text)
        if match:
            errors.append(f"Forbidden {label}: {match.group(0)!r}")

    if "`" in text:
        errors.append("Backticks are not allowed in copy-ready prompts")

    ranges = extract_time_ranges(text)
    if require_timing and not ranges:
        errors.append("No local time ranges found")
        return errors

    if not ranges:
        return errors

    first = ranges[0]
    if abs(first.start) > tolerance:
        errors.append(
            f"First time range must start at 0, found {first.start:g} in {first.raw!r}"
        )

    previous_end: float | None = None
    for item in ranges:
        if not math.isfinite(item.start) or not math.isfinite(item.end):
            errors.append(f"Non-finite time range: {item.raw!r}")
            continue
        if item.start < 0 or item.end <= item.start:
            errors.append(f"Invalid time range: {item.raw!r}")
        if previous_end is not None:
            delta = item.start - previous_end
            if abs(delta) > tolerance:
                kind = "gap" if delta > 0 else "overlap or accumulated duplicate"
                errors.append(
                    f"Time range {item.raw!r} has a {kind} of {abs(delta):.3f}s"
                )
        previous_end = item.end

    if duration is not None:
        if duration <= 0 or not math.isfinite(duration):
            errors.append("Clip duration must be a positive finite number")
        else:
            for item in ranges:
                if item.end - duration > tolerance:
                    errors.append(
                        f"Time range exceeds Clip duration {duration:g}s: {item.raw!r}"
                    )
            final_end = ranges[-1].end
            if abs(final_end - duration) > tolerance:
                errors.append(
                    f"Final time range ends at {final_end:g}s, expected {duration:g}s"
                )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", help="Path to a copy-ready prompt text file")
    parser.add_argument("--duration", type=float, help="Current Clip duration in seconds")
    parser.add_argument("--tolerance", type=float, default=0.05)
    parser.add_argument(
        "--allow-untimed",
        action="store_true",
        help="Allow prompts without time ranges, for still-image prompts",
    )
    args = parser.parse_args()

    path = Path(args.prompt).expanduser().resolve()
    if not path.exists():
        print(f"ERROR: Prompt file does not exist: {path}")
        return 1

    text = path.read_text(encoding="utf-8")
    errors = lint_prompt(
        text,
        duration=args.duration,
        tolerance=args.tolerance,
        require_timing=not args.allow_untimed,
    )

    print(f"Prompt: {path}")
    for error in errors:
        print(f"ERROR: {error}")
    print("VALID" if not errors else f"INVALID ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
