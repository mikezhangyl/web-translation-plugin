#!/usr/bin/env python3
"""
Deterministically suggest a branch name using:
type/scope-short-topic
"""

from __future__ import annotations

import argparse
import re

VALID_TYPES = {"feat", "fix", "chore", "docs", "refactor", "test"}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value


def shorten_topic(topic: str, max_len: int) -> str:
    if len(topic) <= max_len:
        return topic
    return topic[:max_len].rstrip("-")


def build_name(branch_type: str, scope: str | None, summary: str, max_total: int) -> str:
    if branch_type not in VALID_TYPES:
        raise ValueError(f"Invalid type '{branch_type}'. Must be one of: {', '.join(sorted(VALID_TYPES))}")

    scope_slug = slugify(scope) if scope else ""
    topic_slug = slugify(summary)
    if not topic_slug:
        raise ValueError("Summary must contain at least one alphanumeric character.")

    prefix = f"{branch_type}/"
    if scope_slug:
        prefix += f"{scope_slug}-"

    remaining = max_total - len(prefix)
    if remaining < 8:
        raise ValueError("max-total is too small for the selected type/scope.")

    topic_slug = shorten_topic(topic_slug, remaining)
    return f"{prefix}{topic_slug}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suggest a normalized git branch name.")
    parser.add_argument("--type", required=True, choices=sorted(VALID_TYPES), help="Branch type prefix.")
    parser.add_argument("--summary", required=True, help="One-line task summary for the branch topic.")
    parser.add_argument("--scope", help="Optional scope segment.")
    parser.add_argument(
        "--max-total",
        type=int,
        default=40,
        help="Max total branch name length (default: 40).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    branch_name = build_name(args.type, args.scope, args.summary, args.max_total)
    print(branch_name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
