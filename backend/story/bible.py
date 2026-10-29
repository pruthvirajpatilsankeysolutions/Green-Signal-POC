"""The Story Bible: the brief, the approved stages, their facts, and the writer's directions.
Approved stages are canon. Facts of a stage are REPLACED (not added to) whenever that stage is approved again."""
import re

from story.options import AUDIENCE_RULES, MAX_FACTS, STAGES

HEADER = "# Story Bible\n\n<!-- Approved facts are canon: every later stage, the story and the screenplay must stay consistent with them. -->\n"


def approved_stages(stages):
    return [s for s in STAGES if (stages.get(s) or {}).get("status") == "approved"]


def clean_facts(lines):
    """One fact per line: bullets and numbering removed, at most MAX_FACTS."""
    if isinstance(lines, str):
        lines = lines.splitlines()
    facts = []
    for line in lines:
        text = re.sub(r"^[\s\-•*0-9.)]+", "", str(line)).strip()
        text = re.sub(r"\*+|`", "", text).strip()                    # facts are plain sentences: no Markdown marks
        if text and text not in facts:
            facts.append(text)
    return facts[:MAX_FACTS]


def brief_rules(brief):
    """The writer's optional brief fields as plain instructions for the model. Empty when they were all left blank."""
    brief = brief or {}
    lines = []
    if brief.get("audience"):
        lines.append(f"Audience: {brief['audience']}. " + AUDIENCE_RULES.get(brief["audience"], "Match the humor, themes, emotional intensity and language to this audience."))
    if brief.get("setting"):
        lines.append(f"Setting: {brief['setting']}. Ground the story in it with real places, everyday detail, the way people speak, food, customs and the period. No generic backdrop and no stereotypes.")
    if brief.get("preferred_ending"):
        lines.append(f"Preferred ending: {brief['preferred_ending']}. The Ending stage should follow it unless it contradicts the approved story, and earlier stages should lead toward it.")
    if brief.get("protagonist_type"):
        lines.append(f"Protagonist: {brief['protagonist_type']}. The Characters stage should make the protagonist this kind of person.")
    if brief.get("avoid_themes"):
        lines.append(f"Avoid: {brief['avoid_themes']}. None of this may appear anywhere, not even as a joke, a background detail or an alternative ending.")
    return "\n".join(f"- {line}" for line in lines)


def render(project):
    """story_bible.md, as given to the model and exported to the writer."""
    brief = project.get("brief") or {}
    stages = project.get("stages") or {}
    out = [HEADER, "## Brief\n"]
    for key, value in brief.items():
        value = ", ".join(value) if isinstance(value, list) else value
        out.append(f"- **{key.replace('_', ' ').title()}:** {value}")
    out += ["", "## Approved stages\n"]
    out += [f"- {s}" for s in approved_stages(stages)]
    out += ["", "## Facts\n"]
    for s in STAGES:
        facts = (stages.get(s) or {}).get("facts") or []
        if facts and (stages.get(s) or {}).get("status") == "approved":
            out += [f"### {s.title()}"] + [f"- {f}" for f in facts] + [""]
    out += ["## Writer directions\n"]
    out += [f"- ({d['stage'].title()}) {d['text']}" for d in project.get("directions") or []]
    return "\n".join(out).rstrip() + "\n"


def approved_text(project, stage):
    return ((project.get("stages") or {}).get(stage) or {}).get("approved", "")
