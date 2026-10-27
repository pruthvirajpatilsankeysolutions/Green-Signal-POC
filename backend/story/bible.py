"""The Story Bible: the brief, the approved stages, their facts, and the writer's directions.
Approved stages are canon. Facts of a stage are REPLACED (not added to) whenever that stage is approved again."""
import re

from story.options import MAX_FACTS, STAGES

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
