"""
Talks to Google Gemini (free tier). Used for captions, picture descriptions
and fact extraction.
Needs GEMINI_API_KEY in .env  (get one free at https://aistudio.google.com)

File name kept as claude.py so the rest of the project works unchanged.
"""

import json
import os
import re
import time

from google import genai
from google.genai import types

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client()  # reads GEMINI_API_KEY
    return _client


def _call(system, user, max_tokens, as_json):
    config = types.GenerateContentConfig(
        system_instruction=system,
        # Gemini "thinks" before answering and that uses tokens too,
        # so keep this high or answers get cut off.
        max_output_tokens=max(max_tokens, 8192),
        temperature=0.7,
        response_mime_type="application/json" if as_json else "text/plain",
    )

    # Free tier allows only a few requests per minute: wait and retry
    for attempt in range(4):
        try:
            response = _get_client().models.generate_content(
                model=MODEL, contents=user, config=config
            )
            break
        except Exception as e:
            if ("429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)) and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue
            raise

    text = response.text
    if not text:
        raise ValueError(
            "Gemini returned an empty answer (it may have blocked the request). "
            "Try again or change the wording."
        )
    return text.strip()


def ask(system, user, max_tokens=1200):
    """Send a prompt, get plain text back."""
    return _call(system, user, max_tokens, as_json=False)


def _parse_json(text):
    """Read the AI's JSON reply, repairing the small mistakes models often make
    (code fences, trailing commas, // comments, a missing comma between lines)."""
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found")
    body = cleaned[start : end + 1]
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        pass
    fixed = re.sub(r",\s*([}\]])", r"\1", body)  # trailing commas: {"a": 1,}  [1, 2,]
    fixed = re.sub(
        r'(^|[\s{,\[])//[^\n"]*(?=\n)', r"\1", fixed
    )  # // comments on their own
    fixed = re.sub(
        r"(?<=[}\]\"\d])\s*\n\s*(?=\")", ",\n", fixed
    )  # missing comma between lines
    return json.loads(fixed)


def ask_json(system, user, max_tokens=1200):
    """Send a prompt, get a Python dict back. If the reply isn't valid JSON (even after
    repairing small mistakes), ask once more before giving up."""
    system = (
        system
        + "\n\nReply with ONLY one valid JSON object: double quotes, no trailing commas, no comments."
    )
    last_error = None
    for attempt in range(2):
        text = _call(system, user, max_tokens, as_json=True)
        try:
            return _parse_json(text)
        except (ValueError, json.JSONDecodeError) as e:
            last_error = e
            user = (
                user + "\n\nYour previous reply was not valid JSON. "
                "Reply again with ONLY the complete JSON object."
            )
    raise ValueError(
        "The AI's reply could not be read (it was not valid JSON). Please click again. "
        f"Details: {last_error}"
    )