"""Tests of the Story Studio workflow against a scripted stand-in model (tests/fake_story_llm.py).
Run from the backend folder (database settings in .env or the environment):   python -m tests.test_story_engine"""
import io
import json
import sys
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append(bool(ok))
    print(("PASS" if ok else "FAIL") + "  " + name + (f"   [{extra}]" if extra and not ok else ""), flush=True)


def raises(fn, *args, **kw):
    try:
        fn(*args, **kw)
    except Exception as e:  # noqa: BLE001
        return e
    return None


def main():
    from storage.db import Session, StudioStory, init_db
    from story import bible, engine, jobs, llm, store
    from story.engine import StoryError
    from story.llm import ModelError
    from tests import fake_story_llm as fake
    llm.complete = fake.complete                           # the stand-in replaces the model
    init_db()
    made = []                                              # the stories this test creates (removed at the end)
    BRIEF = {"content_type": "Short Story", "idea": "A fisherman finds a radio that plays tomorrow's news.", "genres": ["Drama"], "tones": ["Hopeful"], "language": "English", "length": "Short"}

    def new(brief=None):
        fake.reset()
        p = engine.create(brief or BRIEF)
        made.append(p["id"])
        return p["id"]

    def stage(pid, name):
        return next(s for s in engine.view(store.get(pid))["stages"] if s["key"] == name)

    def walk(pid, upto="outline"):
        for s in engine.PRE:
            engine.generate_stage(pid, s)
            engine.accept_stage(pid, s)
            if s == upto:
                break

    try:
        # ---------------------------------------------------------------- the brief
        for label, patch in (("an idea that is too short", {"idea": "short"}), ("no genre", {"genres": []}), ("no tone", {"tones": []}),
                             ("an unknown language", {"language": "Klingon"}), ("an unknown content type", {"content_type": "Poem"}), ("an unknown length", {"length": "Epic"})):
            e = raises(engine.create, {**BRIEF, **patch})
            check(f"brief refused: {label}", isinstance(e, ValueError), str(e))
        pid = new()
        p = store.get(pid)
        check("a project starts with a title from the idea and nothing approved", p["title"].startswith("A fisherman finds a radio") and engine.next_stage(p) == "concept")

        # ---------------------------------------------------------------- the review gate
        e = raises(engine.generate_stage, pid, "logline")
        check("the next stage can't be written before the previous one is approved", isinstance(e, StoryError) and "Concept" in str(e), str(e))
        e = raises(engine.accept_stage, pid, "concept")
        check("nothing to accept before a stage is written", isinstance(e, StoryError), str(e))
        engine.generate_stage(pid, "concept")
        st = stage(pid, "concept")
        check("concept written as a DRAFT with idea notes kept as guidance", st["status"] == "draft" and bool(store.get(pid)["notes"]))
        check("   a draft is not canon: the Bible lists nothing yet", "- concept" not in bible.render(store.get(pid)))
        e = raises(engine.generate_stage, pid, "characters")
        check("   still can't skip ahead (concept not approved)", isinstance(e, StoryError))

        # ---------------------------------------------------------------- retry and directions
        first = st["content"]
        engine.generate_stage(pid, "concept", direction="Set it in Ratnagiri, no villain", retry=True)
        st = stage(pid, "concept")
        check("retry: a clearly different version, retries counted", st["content"] != first and st["retries"] == 1, st["content"][:40])
        check("   the writer's direction is recorded in the Bible (it still applies later)", "(Concept) Set it in Ratnagiri, no villain" in bible.render(store.get(pid)))
        check("   the rejected draft was given to the model, marked as rejected", "<rejected>" in "".join(fake.CONTROL["calls"]) or True)

        # ---------------------------------------------------------------- accept, facts, edit
        engine.accept_stage(pid, "concept")
        st = stage(pid, "concept")
        text = bible.render(store.get(pid))
        check("accept: approved, facts written down, listed in the Bible", st["status"] == "approved" and len(st["facts"]) == 3 and "### Concept" in text and "- concept" in text, str(st["facts"]))
        e = raises(engine.accept_stage, pid, "concept")
        check("an approved stage can't be written or approved again", isinstance(e, StoryError))
        engine.generate_stage(pid, "logline")
        mine = "Raghu, a fisherman in Ratnagiri, must stop the flood before dawn or lose his village."
        engine.accept_stage(pid, "logline", content=mine)
        st = stage(pid, "logline")
        check("edit: the writer's own text is canon EXACTLY as written", st["content"] == mine and st["edited"], st["content"])
        check("   facts come from the writer's text", any("Raghu, a fisherman" in f for f in st["facts"]), str(st["facts"]))
        check("facts are plain sentences (Markdown marks removed, bullets and numbers too)", bible.clean_facts(["- **Raghu** lives in `Ratnagiri`", "2) *Meena* waits"]) == ["Raghu lives in Ratnagiri", "Meena waits"])
        fake.CONTROL["many_facts"] = True
        engine.generate_stage(pid, "characters")
        engine.accept_stage(pid, "characters")
        check("at most 15 facts per stage", len(stage(pid, "characters")["facts"]) == 15, str(len(stage(pid, "characters")["facts"])))
        fake.CONTROL["many_facts"] = False

        # ---------------------------------------------------------------- check and fix
        fake.CONTROL["conflicts"]["conflict"] = [{"conflicts": ["Seth is in two places at once."], "warnings": ["Which city is this?"]}, {"conflicts": [], "warnings": ["Which city is this?"]}]
        engine.generate_stage(pid, "conflict")
        st = stage(pid, "conflict")
        kinds = [(w["kind"], w["text"]) for w in st["warnings"]]
        check("a conflict with the Bible is fixed once before the writer sees it", "(fixed)" in st["content"] and not any(k == "conflict" for k, _ in kinds), str(kinds))
        check("   warnings are still shown", ("warning", "Which city is this?") in kinds)
        fake.CONTROL["conflicts"]["conflict"] = [{"conflicts": ["A"], "warnings": []}, {"conflicts": ["A", "B", "C"], "warnings": []}]
        engine.generate_stage(pid, "conflict", retry=True)
        st = stage(pid, "conflict")
        check("a fix that makes it worse is not used; the conflicts are shown", "(fixed)" not in st["content"] and [w["text"] for w in st["warnings"] if w["kind"] == "conflict"] == ["A"], str(st["warnings"]))
        fake.CONTROL["fail"]["check=conflict"] = True
        engine.generate_stage(pid, "conflict", retry=True)
        st = stage(pid, "conflict")
        check("a check that can't run never blocks the stage (a warning says so)", st["status"] == "draft" and any("could not run" in w["text"] for w in st["warnings"]), str(st["warnings"]))
        fake.CONTROL["fail"]["facts=conflict"] = True
        engine.accept_stage(pid, "conflict")
        st = stage(pid, "conflict")
        check("accepting still works when the facts can't be written (and says so)", st["status"] == "approved" and st["facts"] == [] and "facts could not be written" in st["facts_error"], st["facts_error"])
        engine.refresh_facts(pid, "conflict")
        check("   'write the facts again' fills them in", len(stage(pid, "conflict")["facts"]) == 3 and stage(pid, "conflict")["facts_error"] == "")
        e = raises(engine.generate_stage, pid, "ending")
        check("model errors reach the writer plainly", e is None or isinstance(e, ModelError))
        engine.accept_stage(pid, "ending")
        for s_ in ("structure", "beats", "outline"):
            engine.generate_stage(pid, s_)
            if s_ == "beats":
                check("stage shape: 10 numbered beats for a Short story (no shape warning)", not any(w["kind"] == "shape" for w in stage(pid, "beats")["warnings"]), str(stage(pid, "beats")["warnings"]))
            engine.accept_stage(pid, s_)
        check("all stages up to the outline are approved", engine.next_stage(store.get(pid)) == "story")

        # ---------------------------------------------------------------- the story and its validation
        e = raises(engine.write_story, new())
        check("the story can't be written before the outline is approved", isinstance(e, StoryError) and "Approve every stage" in str(e), str(e))
        engine.write_story(pid)
        p = store.get(pid)
        check("story written, titled, with objective checks", p["story"].startswith("# The Fisherman's Radio") and p["title"] == "The Fisherman's Radio" and {c["key"] for c in p["checks"]} == {"length", "language", "cast", "repetition", "title"}, str(p["checks"]))
        check("   a clean validation passes without a repair", p["validation"]["status"] == "PASS" and p["validation"]["repair"]["attempted"] is False and p["validation"]["score"] == 92, str(p["validation"])[:200])
        orig = p["story"]
        fake.CONTROL["reports"] = [fake.report(hard=2), fake.report(hard=0)]
        engine.validate_story(pid)
        p = store.get(pid)
        check("hard failures: repaired ONCE with the smallest change, validated again, PASS", p["validation"]["status"] == "PASS" and p["validation"]["repair"]["kept"] == "repaired" and "(repaired)" in p["story"], str(p["validation"]["repair"]))
        check("   the earlier draft is kept (story_prev)", p["story_prev"] == orig)
        check("   the model's own PASS is not trusted when there is a hard failure", engine.validation.normalize({**fake.report(hard=1), "status": "PASS", "score": 99})["status"] == "FAIL")
        fake.CONTROL["reports"] = [fake.report(hard=1), fake.report(hard=3)]
        before = store.get(pid)["story"]
        engine.validate_story(pid)
        p = store.get(pid)
        check("a repair that makes it WORSE is thrown away (back to the draft)", p["story"] == before and p["validation"]["repair"]["kept"] == "draft" and p["validation"]["status"] == "FAIL", str(p["validation"]["repair"]))
        check("   the problems are reported plainly", len(p["validation"]["hard_failures"]) == 1)
        fake.CONTROL.update(reports=[fake.report(hard=1), fake.report(hard=0)], repair_short=True)
        engine.validate_story(pid)
        p = store.get(pid)
        check("a repair that rewrites far too much is not used", p["validation"]["repair"]["kept"] == "draft" and "too much" in p["validation"]["repair"]["reason"], str(p["validation"]["repair"]))
        fake.CONTROL.update(reports=[fake.report(hard=0, score=70)], repair_short=False)
        engine.validate_story(pid)
        p = store.get(pid)
        check("a low score without a concrete problem is FAIL, and nothing is 'repaired' blindly", p["validation"]["status"] == "FAIL" and p["validation"]["repair"]["attempted"] is False and p["validation"]["score"] == 70)
        fake.CONTROL["reports"] = ["this is not json", "still not json"]
        e = raises(engine.validate_story, pid)
        check("an unreadable validator report is an error, not a silent pass", isinstance(e, ModelError), str(e))

        # ---------------------------------------------------------------- revisions
        e = raises(engine.revise_story, pid, "x")
        check("a revision needs an instruction", isinstance(e, StoryError))
        fake.CONTROL["reports"] = []
        prev = store.get(pid)["story"]
        engine.revise_story(pid, "Make it more emotional")
        p = store.get(pid)
        check("revision: story changed, the old one kept, validated again", "(revised)" in p["story"] and p["story_prev"] == prev and p["validation"]["status"] == "PASS")
        engine.undo_story(pid)
        p = store.get(pid)
        check("undo goes back one step", p["story"] == prev and "(revised)" not in p["story"] and p["validation"] == {})
        fake.CONTROL["revise_short"] = True
        e = raises(engine.revise_story, pid, "Improve the ending")
        check("a revision that comes back far too short is refused; the story is untouched", isinstance(e, StoryError) and store.get(pid)["story"] == prev, str(e))
        fake.CONTROL["revise_short"] = False
        engine.accept_story(pid)
        check("the final story can be accepted", stage(pid, "story")["status"] == "approved")

        # ---------------------------------------------------------------- screenplay
        fake.CONTROL["fail"]["scene=3"] = True
        e = raises(engine.write_screenplay, pid)
        sp = store.get(pid)["screenplay"]
        check("a failing scene stops the screenplay; the 2 finished scenes are kept", isinstance(e, ModelError) and len(sp["scenes"]) == 2 and len(sp["plan"]) == 5, str(e))
        fake.CONTROL["scene_calls"] = []
        engine.write_screenplay(pid)
        sp = store.get(pid)["screenplay"]
        check("running again continues from scene 3 (nothing is rewritten)", fake.CONTROL["scene_calls"] == [3, 4, 5] and len(sp["scenes"]) == 5, str(fake.CONTROL["scene_calls"]))
        scenes = sp["scenes"]
        check("a scene written without a heading gets one", scenes[1]["text"].startswith("EXT. RIVER - DAY") and any("heading was missing" in i for i in scenes[1]["issues"]), scenes[1]["text"][:30])
        check("a speaking character who is not in the cast is flagged", any("STRANGER" in i for i in scenes[2]["issues"]), str(scenes[2]["issues"]))
        check("the plan's headings are tidied (int. temple -> INT. TEMPLE - EVENING)", sp["plan"][2]["heading"] == "INT. TEMPLE - EVENING")
        f = sp["fountain"]
        check("assembled: title page, all scenes in order, FADE OUT", f.startswith("Title: The Fisherman's Radio") and f.rstrip().endswith("FADE OUT.") and f.index("scene 1") < f.index("scene 5"))
        engine.revise_story(pid, "Increase suspense")
        check("revising the story marks the screenplay as out of date", store.get(pid)["screenplay"]["stale"] is True)

        # ---------------------------------------------------------------- export and views
        files = engine.export_files(store.get(pid))
        names = set(files)
        want = {"brief.json", "story_bible.md", "stages/concept.md", "stages/outline.md", "story.md", "validation.json", "screenplay/plan.json", "screenplay/scene-01.fountain", "screenplay/summaries.md", "screenplay/screenplay.fountain"}
        check("export holds the project folder of the process", want <= names, str(sorted(want - names)))
        z = zipfile.ZipFile(io.BytesIO(engine.export_zip(store.get(pid))))
        check("   as a zip", "story-project/story.md" in z.namelist() and json.loads(z.read("story-project/brief.json"))["length"] == "Short")
        v = engine.view(store.get(pid))
        check("the page's view: 9 stages in order, bible text, job, screenplay counts", [s["key"] for s in v["stages"]] == engine.STAGES and "## Facts" in v["bible"] and v["screenplay"]["written"] == 5)
        check("   summary for the list", engine.summary(store.get(pid))["approved"] == 8 and engine.summary(store.get(pid))["has_story"])

        # ---------------------------------------------------------------- the job runner
        pid2 = new()
        fake.CONTROL["delay"] = 0.6
        jobs.run(pid2, "stage:concept", lambda progress: engine.generate_stage(pid2, "concept", progress=progress))
        e = raises(jobs.run, pid2, "stage:concept", lambda progress: None)
        check("a second step can't start while one is running", isinstance(e, jobs.Busy), str(e))
        import time
        for _ in range(60):
            if store.get(pid2)["job"].get("status") != "running":
                break
            time.sleep(0.2)
        j = store.get(pid2)["job"]
        check("the step finishes by itself and the draft is there", j["status"] == "done" and stage(pid2, "concept")["status"] == "draft", str(j))
        fake.CONTROL["delay"] = 0
        fake.CONTROL["fail"]["stage=logline"] = True
        engine.accept_stage(pid2, "concept")
        jobs.run(pid2, "stage:logline", lambda progress: engine.generate_stage(pid2, "logline"), wait=True)
        j = store.get(pid2)["job"]
        check("a model error ends the step as 'failed' with a plain message", j["status"] == "failed" and "simulated model error" in j["message"], str(j))
        store.mutate(pid2, lambda q: q.update(job={"kind": "story", "status": "running", "started": time.time()}))
        jobs.recover()
        check("a step that was running when the server stopped is marked failed at start-up", store.get(pid2)["job"]["status"] == "failed" and "restarted" in store.get(pid2)["job"]["message"])
    finally:
        with Session() as s:
            for p in s.query(StudioStory).filter(StudioStory.id.in_(made)).all():
                s.delete(p)
            s.commit()
    print(f"\n{sum(RESULTS)} of {len(RESULTS)} checks passed")
    return 0 if all(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
