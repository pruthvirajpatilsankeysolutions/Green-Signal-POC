"""The only place Story Studio talks to the model (Gemini, through the app's client). Tests replace `complete`."""
import logging
import re
import time

import config

log = logging.getLogger("story")


class ModelError(Exception):
    """A problem with the model's answer that the writer can understand."""


def complete(system, user, *, json_mode=False, temperature=0.7, max_tokens=None):
    """One call. Refuses an answer that was cut off (a half story is worse than an error) and retries rate limits."""
    from google.genai import types
    from ai.claude import MODEL, _get_client
    model = config.STORY_MODEL or MODEL
    cfg = types.GenerateContentConfig(system_instruction=system, max_output_tokens=max_tokens or config.STORY_MAX_TOKENS, temperature=temperature,
                                      response_mime_type="application/json" if json_mode else "text/plain")
    last = None
    for attempt in range(4):
        try:
            response = _get_client().models.generate_content(model=model, contents=user, config=cfg)
            break
        except Exception as e:  # noqa: BLE001 - the SDK raises many kinds
            last = e
            if ("429" in str(e) or "RESOURCE_EXHAUSTED" in str(e) or "503" in str(e)) and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue
            raise ModelError(f"The AI service did not answer: {e}") from e
    else:
        raise ModelError(f"The AI service is busy: {last}")
    text = (response.text or "").strip()
    if not text:
        raise ModelError("The AI returned an empty answer (it may have blocked the request). Try again or change the wording.")
    try:
        reason = str(response.candidates[0].finish_reason)
    except (AttributeError, IndexError, TypeError):
        reason = ""
    if "MAX_TOKENS" in reason:
        raise ModelError("The AI's answer was cut off because it was too long. Try a shorter length, or set a higher STORY_MAX_TOKENS.")
    return text


def complete_json(system, user, **kw):
    """A JSON answer (code fences and small mistakes repaired); asks once more if it can't be read."""
    from ai.claude import _parse_json
    system = system + "\n\nReply with ONLY one valid JSON object: double quotes, no trailing commas, no comments."
    temperature, max_tokens = kw.get("temperature", 0.2), kw.get("max_tokens")
    err = None
    for _ in range(2):
        text = complete(system, user, json_mode=True, temperature=temperature, max_tokens=max_tokens)
        try:
            return _parse_json(text)
        except ValueError as e:                                   # json.JSONDecodeError is a ValueError too
            err = e
            user += "\n\nYour previous reply was not valid JSON. Reply again with ONLY the complete JSON object."
    raise ModelError(f"The AI's reply could not be read (not valid JSON): {err}")


def clean_text(text):
    """The model sometimes wraps its answer in a code fence or adds a short lead-in; take the content only."""
    text = text.strip()
    fence = re.match(r"^```(?:markdown|md|fountain|text)?\s*\n(.*?)\n```\s*$", text, re.S)
    return (fence.group(1) if fence else text).strip()
