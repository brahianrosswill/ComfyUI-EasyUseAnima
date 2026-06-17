"""Danbooru-style prompt parsing."""

from __future__ import annotations

from .models import ParsedPrompt


def parse_prompt(text: str, *, profile: str = "prompt") -> ParsedPrompt:
    """Parse prompt text into raw tag tokens.

    ComfyUI/NovelAI prompt parentheses are syntax unless escaped. Commas inside
    unescaped parentheses are kept in the same token so weighted prompt groups
    are not split incorrectly.
    """

    profile = (profile or "prompt").strip().lower()
    delimiter = ", "
    tokens = _split_prompt_tokens(text)
    tokens = [part for part in tokens if part]
    return ParsedPrompt(
        text=text,
        tokens=tuple(tokens),
        delimiter=delimiter,
        profile=profile,
    )


def _is_escaped(text: str, index: int) -> bool:
    slash_count = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        slash_count += 1
        cursor -= 1
    return slash_count % 2 == 1


def _split_prompt_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    start = 0
    depth = 0
    for index, char in enumerate(text):
        if char == "(" and not _is_escaped(text, index):
            depth += 1
        elif char == ")" and not _is_escaped(text, index):
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            tokens.append(text[start:index].strip())
            start = index + 1
    tokens.append(text[start:].strip())
    return tokens


def render_tags(tags: list[str], delimiter: str) -> str:
    return ", ".join(tags)
