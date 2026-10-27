"""The Story Studio workflow. The writer approves every stage before the next one is written; approved stages are canon
and are carried forward in the Story Bible. Functions that call the model take a `progress` callback (they run as background jobs)."""
import io
import json
import re
import time
import zipfile

from story import bible, checks, fountain, llm, prompts, shape, store, validation
from story.llm import ModelError
from story.options import MAX_SCENES, STAGE_TITLES, STAGES, clean_brief

PRE = STAGES[:-1]                      # the stages before the story itself


class StoryError(ValueError):
    """Something the writer can fix (wrong order, nothing to approve ...)."""


def _title_from(idea):
    first = re.split(r"(?<=[.!?])\s", idea.strip())[0]
    return (first[:60] + "…") if len(first) > 60 else first


def create(raw_brief):
    brief = clean_brief(raw_brief)
    return store.create(brief, _title_from(brief["idea"]))


# ---------------------------------------------------------------- order and state
def next_stage(p):
    return next((s for s in STAGES if (p["stages"].get(s) or {}).get("status") != "approved"), None)


def _ready(p, stage):
    return all((p["stages"].get(s) or {}).get("status") == "approved" for s in STAGES[:STAGES.index(stage)])


def _ensure_ready(p, stage):
    if stage not in PRE:
        raise StoryError("That is not a stage you can write here.")
    if (p["stages"].get(stage) or {}).get("status") == "approved":
        raise StoryError(f"The {STAGE_TITLES[stage]} is already approved.")
    for earlier in STAGES[:STAGES.index(stage)]:
        if (p["stages"].get(earlier) or {}).get("status") != "approved":
            raise StoryError(f"Approve the {STAGE_TITLES[earlier]} first: every stage is built on the one before it.")


def _require_outline(p):
    for s in PRE:
        if (p["stages"].get(s) or {}).get("status") != "approved":
            raise StoryError(f"Approve every stage up to the Outline first ({STAGE_TITLES[s]} is not approved yet).")


def _require_story(p):
    if not p["story"].strip():
        raise StoryError("Write the story first.")


# ---------------------------------------------------------------- stages 1-8
def _check(p, stage, draft):
    r = llm.complete_json(*prompts.check_prompt(p, stage, draft), max_tokens=2500)
    pick = lambda key: [str(x).strip() for x in (r.get(key) or []) if str(x).strip()]
    return pick("conflicts"), pick("warnings")


def _check_and_fix(p, stage, draft):
    """Compare a new draft with the Story Bible. If it contradicts the Bible or itself, fix it ONCE (smallest change).
    What is still unresolved, and every warning, is shown to the writer. A check that can't run never blocks the stage."""
    try:
        conflicts, warnings = _check(p, stage, draft)
        if conflicts:
            fixed = llm.clean_text(llm.complete(*prompts.fix_prompt(p, stage, draft, conflicts), temperature=0.3))
            if fixed:
                again, warn2 = _check(p, stage, fixed)
                if len(again) <= len(conflicts):
                    draft, conflicts, warnings = fixed, again, warn2
        return draft, [{"kind": "conflict", "text": c} for c in conflicts] + [{"kind": "warning", "text": w} for w in warnings]
    except ModelError as e:
        return draft, [{"kind": "warning", "text": f"The consistency check could not run ({e}). Read this stage carefully before accepting it."}]


def generate_stage(pid, stage, direction="", retry=False, progress=lambda m: None):
    p = store.get(pid)
    _ensure_ready(p, stage)
    st = p["stages"].get(stage) or {}
    retry = bool(retry and st.get("draft"))
    direction = (direction or "").strip()[:1000]
    if direction:                                                   # a direction still applies to the later stages, so it goes in the Bible
        p, _ = store.mutate(pid, lambda q: q["directions"].append({"stage": stage, "text": direction}))
    if stage == "concept" and not p["notes"]:
        progress("Thinking about the idea…")
        try:
            notes = llm.clean_text(llm.complete(*prompts.notes_prompt(p), temperature=0.8))
        except ModelError:
            notes = ""                                              # the notes are only guidance
        p, _ = store.mutate(pid, lambda q: q.update(notes=notes))
    progress(f"Writing the {STAGE_TITLES[stage]}…")
    draft = llm.clean_text(llm.complete(*prompts.stage_prompt(p, stage, direction, rejected=st.get("draft", "") if retry else ""), temperature=0.9))
    if not draft:
        raise StoryError("The AI returned nothing. Try again.")
    progress("Checking it against the Story Bible…")
    draft, notes = _check_and_fix(p, stage, draft)
    notes += [{"kind": "shape", "text": t} for t in shape.check(stage, draft, p["brief"])]
    retries = st.get("retries", 0) + (1 if retry else 0)

    def save(q):
        q["stages"][stage] = {"status": "draft", "draft": draft, "approved": "", "warnings": notes, "facts": [], "facts_error": "",
                              "retries": retries, "edited": False, "updated": time.time()}
    store.mutate(pid, save)


def _extract_facts(p, stage, text):
    return bible.clean_facts(llm.complete_json(*prompts.facts_prompt(p, stage, text), max_tokens=2000).get("facts") or [])


def accept_stage(pid, stage, content=None):
    """Accept (the draft as written) or Edit (the writer's own text, canon exactly as they wrote it)."""
    p = store.get(pid)
    _ensure_ready(p, stage)
    st = p["stages"].get(stage) or {}
    text = (content if content is not None else st.get("draft", "")).strip()
    if not text:
        raise StoryError("There is nothing to approve yet. Write this stage first.")
    if len(text) > 60000:
        raise StoryError("That text is too long for one stage.")
    edited = content is not None and text != (st.get("draft") or "").strip()
    facts, error = [], ""
    try:
        facts = _extract_facts(p, stage, text)
    except ModelError as e:                                         # approving must not be lost because the AI is busy
        error = f"The facts could not be written down yet ({e}). Use 'Write the facts again'."

    def save(q):
        q["stages"][stage] = {**st, "status": "approved", "approved": text, "facts": facts, "facts_error": error, "edited": edited,
                              "warnings": [] if edited else st.get("warnings", []), "updated": time.time()}
    store.mutate(pid, save)


def refresh_facts(pid, stage):
    p = store.get(pid)
    st = p["stages"].get(stage) or {}
    if st.get("status") != "approved" or stage == "story":
        raise StoryError("Only an approved stage has facts.")
    facts = _extract_facts(p, stage, st["approved"])

    def save(q):
        q["stages"][stage]["facts"], q["stages"][stage]["facts_error"] = facts, ""
    store.mutate(pid, save)


# ---------------------------------------------------------------- the story: checks, validation, repair
def _run_checks(p):
    return checks.run(p["brief"], p["story"], bible.approved_text(p, "characters"))


def _judge(p, story):
    last = None
    for _ in range(2):
        try:
            return validation.normalize(llm.complete_json(*prompts.judge_prompt(p, story), max_tokens=8000))
        except ValueError as e:
            last = e
    raise ModelError(f"The validator's report could not be read ({last}). Run the validation again.")


def _title_of(story):
    m = re.match(r"\s*#\s+(.+)", story)
    return m.group(1).strip() if m else ""


def _validate_and_repair(pid, progress):
    """Validate as a separate step; on a hard failure repair ONCE with the smallest changes, validate again,
    and go back to the draft if the repair made things worse."""
    p = store.get(pid)
    story = p["story"]
    progress("Validating the story against the canon…")
    report = _judge(p, story)
    repair = {"attempted": False}
    if report["hard_failures"]:
        progress("Repairing the problems that were found…")
        fixed = llm.clean_text(llm.complete(*prompts.repair_prompt(p, story, report), temperature=0.3))
        progress("Validating the repaired story…")
        report2 = _judge(p, fixed)
        h1, h2 = len(report["hard_failures"]), len(report2["hard_failures"])
        w1, w2 = checks.word_count(story), checks.word_count(fixed)
        changed_too_much = w1 and abs(w2 - w1) / w1 > 0.25
        worse = h2 > h1 or (h2 == h1 and report2["score"] < report["score"]) or changed_too_much or w2 < 50
        repair = {"attempted": True, "kept": "draft" if worse else "repaired", "before": {"score": report["score"], "hard": h1},
                  "after": {"score": report2["score"], "hard": h2}, "reason": "the repair changed too much" if changed_too_much else ""}
        if not worse:
            story, report = fixed, report2

    def save(q):
        if story != q["story"]:
            q["story_prev"] = q["story"]
        q["story"] = story
        q["title"] = _title_of(story) or q["title"]
        q["validation"] = {**report, "repair": repair, "at": time.time()}
        q["checks"] = _run_checks({**q, "story": story})
    store.mutate(pid, save)


def write_story(pid, progress=lambda m: None):
    p = store.get(pid)
    _require_outline(p)
    progress("Writing the story…")
    story = llm.clean_text(llm.complete(*prompts.story_prompt(p), temperature=0.8))
    if checks.word_count(story) < 50:
        raise StoryError("The AI's story was far too short. Try again.")

    def save(q):
        q.update(story=story, story_prev="", validation={}, screenplay={}, title=_title_of(story) or q["title"])
        q["checks"] = _run_checks(q)
    store.mutate(pid, save)
    _validate_and_repair(pid, progress)


def validate_story(pid, progress=lambda m: None):
    _require_story(store.get(pid))
    _validate_and_repair(pid, progress)


def revise_story(pid, instruction, progress=lambda m: None):
    """'Make it more emotional', 'improve the ending' ...: change only what is asked, keep canon, then validate again."""
    instruction = (instruction or "").strip()[:1000]
    if len(instruction) < 3:
        raise StoryError("Say what should change.")
    p = store.get(pid)
    _require_story(p)
    progress("Revising the story…")
    new = llm.clean_text(llm.complete(*prompts.revise_prompt(p, p["story"], instruction), temperature=0.7))
    old_w, new_w = checks.word_count(p["story"]), checks.word_count(new)
    shorter = "shorter" in instruction.lower() or "cut" in instruction.lower()
    if new_w < 50 or (not shorter and new_w < 0.5 * old_w):
        raise StoryError("The revised story came back far too short, so it was not used. Try again.")

    def save(q):
        q["story_prev"], q["story"], q["validation"] = q["story"], new, {}
        q["title"] = _title_of(new) or q["title"]
        q["checks"] = _run_checks(q)
        if q["screenplay"]:
            q["screenplay"]["stale"] = True                         # the screenplay was written from the older story
    store.mutate(pid, save)
    _validate_and_repair(pid, progress)


def undo_story(pid):
    p = store.get(pid)
    if not p["story_prev"]:
        raise StoryError("There is no earlier version to go back to.")

    def save(q):
        q["story"], q["story_prev"], q["validation"] = q["story_prev"], q["story"], {}
        q["title"] = _title_of(q["story"]) or q["title"]
        q["checks"] = _run_checks(q)
    store.mutate(pid, save)


def accept_story(pid):
    p = store.get(pid)
    _require_story(p)

    def save(q):
        q["stages"]["story"] = {"status": "approved", "approved": q["story"], "draft": "", "warnings": [], "facts": [], "facts_error": "",
                                "retries": 0, "edited": False, "updated": time.time()}
    store.mutate(pid, save)


# ---------------------------------------------------------------- screenplay (Fountain)
def _clean_plan(raw):
    scenes = []
    for s in (raw.get("scenes") or [])[:MAX_SCENES]:
        if not isinstance(s, dict):
            continue
        title = str(s.get("title") or "").strip() or f"Scene {len(scenes) + 1}"
        heading = re.sub(r"\s+", " ", str(s.get("heading") or "")).strip().upper()
        if not fountain.HEADING.match(heading + " "):
            heading = f"INT. {heading or title.upper()} - DAY"
        scenes.append({"heading": heading, "title": title, "summary": str(s.get("summary") or "").strip(),
                       "characters": [str(c).strip() for c in (s.get("characters") or []) if str(c).strip()]})
    if len(scenes) < 3:
        raise ModelError("The scene plan was too short. Try again.")
    return scenes


def write_screenplay(pid, progress=lambda m: None, restart=False):
    """Plan the scenes from the outline, write ONE scene at a time (saved as it goes, so a stopped run continues), assemble."""
    p = store.get(pid)
    _require_outline(p)
    _require_story(p)
    sp = p["screenplay"] or {}
    if restart or not sp.get("plan") or sp.get("stale"):
        progress("Planning the scenes…")
        plan = _clean_plan(llm.complete_json(*prompts.plan_prompt(p, p["story"]), max_tokens=8000))
        sp = {"plan": plan, "scenes": [], "fountain": "", "stale": False}
        store.mutate(pid, lambda q: q.update(screenplay=sp))
    plan, scenes = sp["plan"], list(sp["scenes"])
    cast_md = bible.approved_text(p, "characters")
    words = prompts.scene_words(p, len(plan))
    for i in range(len(scenes), len(plan)):
        progress(f"Writing scene {i + 1} of {len(plan)}…")
        tail = "\n".join(scenes[-1]["text"].splitlines()[-25:]) if scenes else ""
        raw = llm.clean_text(llm.complete(*prompts.scene_prompt(p, plan, i, [s["summary"] for s in scenes], tail, words), temperature=0.8))
        text, issues, spoken = fountain.check_scene(raw, cast_md, plan[i]["heading"])
        scene = {"n": i + 1, "heading": plan[i]["heading"], "title": plan[i]["title"], "summary": plan[i]["summary"], "text": text, "issues": issues, "speakers": spoken}
        scenes.append(scene)
        store.mutate(pid, lambda q, scene=scene: q["screenplay"].setdefault("scenes", []).append(scene))
    progress("Putting the screenplay together…")
    title = _title_of(p["story"]) or p["title"]
    text = fountain.assemble([s["text"] for s in scenes], title)

    def save(q):
        q["screenplay"]["fountain"], q["screenplay"]["stale"] = text, False
    store.mutate(pid, save)


# ---------------------------------------------------------------- what the page and the writer receive
def focus(p):
    """The stage the writer is dealing with: the one waiting for an answer, else the next one to write, else the story."""
    waiting = next((x for x in STAGES if (p["stages"].get(x) or {}).get("status") == "draft"), None)
    return waiting or next_stage(p) or "story"


def state_of(p):
    """your = the writer has something to do; bad = the validator found problems; ok = validated."""
    if p["story"].strip():
        status = (p["validation"] or {}).get("status")
        return "ok" if status == "PASS" else "bad" if status == "FAIL" else "your"
    return "your"


def view(p):
    stages = []
    for s in STAGES:
        st = p["stages"].get(s) or {}
        if s == "story":
            status = "approved" if st.get("status") == "approved" else ("draft" if p["story"].strip() else "empty")
            content = p["story"]
        else:
            status = st.get("status") or "empty"
            content = st.get("approved") or st.get("draft") or ""
        stages.append({"key": s, "title": STAGE_TITLES[s], "status": status, "ready": _ready(p, s), "content": content, "warnings": st.get("warnings") or [],
                       "facts": st.get("facts") or [], "facts_error": st.get("facts_error", ""), "retries": st.get("retries", 0), "edited": bool(st.get("edited"))})
    sp = p["screenplay"] or {}
    return {
        "id": p["id"], "title": p["title"], "brief": p["brief"], "created_at": p["created_at"], "updated_ts": p["updated_ts"], "stages": stages,
        "next_stage": next_stage(p), "focus": focus(p), "state": state_of(p), "words": checks.word_count(p["story"]),
        "bible": bible.render(p), "directions": p["directions"], "checks": p["checks"], "validation": p["validation"], "job": p["job"],
        "can_undo": bool(p["story_prev"]),
        "screenplay": {"planned": len(sp.get("plan") or []), "written": len(sp.get("scenes") or []), "scenes": sp.get("scenes") or [],
                       "fountain": sp.get("fountain", ""), "stale": bool(sp.get("stale")),
                       "warnings": [f"Scene {s['n']}: {i}" for s in sp.get("scenes") or [] for i in s["issues"]]},
    }


def summary(p):
    done = [s for s in PRE if (p["stages"].get(s) or {}).get("status") == "approved"]
    f = focus(p)
    job = p["job"] or {}
    sp = p["screenplay"] or {}
    return {"id": p["id"], "title": p["title"], "content_type": p["brief"].get("content_type"), "language": p["brief"].get("language"),
            "length": p["brief"].get("length"), "genres": p["brief"].get("genres", []), "tones": p["brief"].get("tones", []),
            "approved": len(done), "stages": len(PRE), "has_story": bool(p["story"].strip()), "words": checks.word_count(p["story"]),
            "validation": (p["validation"] or {}).get("status", ""), "score": (p["validation"] or {}).get("score"),
            "has_screenplay": bool(sp.get("fountain")), "scenes": len(sp.get("scenes") or []),
            "state": state_of(p), "focus": f, "focus_title": STAGE_TITLES[f], "working": job.get("status") == "running", "job_message": job.get("message", "") if job.get("status") == "running" else "",
            "facts": sum(len((p["stages"].get(x) or {}).get("facts") or []) for x in PRE if (p["stages"].get(x) or {}).get("status") == "approved"),
            "updated_ts": p["updated_ts"]}


def export_files(p):
    """The project folder of the Story Studio process: brief, bible, approved stages, story, validation, screenplay."""
    files = {"brief.json": json.dumps(p["brief"], ensure_ascii=False, indent=2), "story_bible.md": bible.render(p)}
    for s in PRE:
        text = bible.approved_text(p, s)
        if text:
            files[f"stages/{s}.md"] = text.strip() + "\n"
    if p["story"].strip():
        files["story.md"] = p["story"].strip() + "\n"
    if p["validation"]:
        files["validation.json"] = json.dumps(p["validation"], ensure_ascii=False, indent=2)
    sp = p["screenplay"] or {}
    if sp.get("plan"):
        files["screenplay/plan.json"] = json.dumps({"scenes": sp["plan"]}, ensure_ascii=False, indent=2)
    for s in sp.get("scenes") or []:
        files[f"screenplay/scene-{s['n']:02d}.fountain"] = s["text"].strip() + "\n"
    if sp.get("scenes"):
        files["screenplay/summaries.md"] = "\n".join(f"{s['n']}. {s['summary']}" for s in sp["scenes"]) + "\n"
    if sp.get("fountain"):
        files["screenplay/screenplay.fountain"] = sp["fountain"]
    return files


def export_zip(p):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in export_files(p).items():
            z.writestr(f"story-project/{name}", content)
    return buf.getvalue()
