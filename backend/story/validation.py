"""The validator's report is written by the model but judged HERE: any hard failure, a score below 80, or a FAIL
status means FAIL, whatever the model says. A hard failure also caps the score at 60."""
import json
import re

from story.options import PASS_SCORE

HARD_TYPES = {"character_contradiction", "relationship_contradiction", "ending_contradiction", "major_event_contradiction",
              "location_contradiction", "temporal_contradiction", "missing_causal_event", "missing_object_origin",
              "missing_information_origin", "unauthorized_major_character", "unauthorized_major_plot_device", "reintroduced_rejected_element", "brief_violation"}


def _items(value, default):
    out = []
    for it in value or []:
        if isinstance(it, str):
            it = {"type": default, "issue": it}
        if isinstance(it, dict) and str(it.get("issue", "")).strip():
            out.append({"type": str(it.get("type") or default), "issue": str(it["issue"]).strip(),
                        "evidence": str(it.get("evidence", "")).strip(), "fix": str(it.get("fix", "")).strip()})
    return out


def normalize(data):
    """Returns the report with the final status and score. Raises ValueError if the report is not usable."""
    if isinstance(data, str):
        m = re.search(r"\{.*\}", data, re.S)
        try:
            data = json.loads(m.group(0)) if m else None
        except json.JSONDecodeError:
            data = None
    if not isinstance(data, dict):
        raise ValueError("The validator's report could not be read.")
    try:
        score = int(float(data.get("score", 0) or 0))
    except (TypeError, ValueError):
        score = 0
    if 0 < score <= 10:                                   # a score out of 10
        score *= 10
    score = max(0, min(100, score))
    hard = _items(data.get("hard_failures"), "other")
    for h in hard:
        if h["type"] not in HARD_TYPES:
            h["type"] = "other"
    warnings = _items(data.get("warnings"), "warning")
    fail = bool(hard) or score < PASS_SCORE or str(data.get("status", "")).upper() == "FAIL"
    if hard and score > 60:
        score = 60
    return {
        "status": "FAIL" if fail else "PASS", "score": score, "hard_failures": hard, "warnings": warnings,
        "strengths": [str(x) for x in data.get("strengths") or []][:10],
        "rewrite_notes": [str(x) for x in data.get("rewrite_notes") or []][:20],
        "ledger": data.get("ledger") if isinstance(data.get("ledger"), dict) else {},
    }
