"""Tests of the Story Studio API (routes, order rules, the access key, downloads) with the stand-in model.
Run from the backend folder:   python -m tests.test_story_api"""
import io
import sys
import time
import uuid
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append(bool(ok))
    print(("PASS" if ok else "FAIL") + "  " + name + (f"   [{extra}]" if extra and not ok else ""), flush=True)


def main():
    from fastapi.testclient import TestClient
    from api.main import app
    import config
    from storage.db import Session, StudioStory, init_db
    from story import llm
    from tests import fake_story_llm as fake
    llm.complete = fake.complete
    init_db()
    made = []
    api = TestClient(app)
    BRIEF = {"content_type": "Short Story", "idea": "A fisherman finds a radio that plays tomorrow's news.", "genres": ["Drama"], "tones": ["Hopeful"], "language": "English", "length": "Short"}
    fake.reset()

    def wait(pid, seconds=30):
        end = time.time() + seconds
        while time.time() < end:
            v = api.get(f"/api/studio/stories/{pid}").json()
            if v["job"].get("status") != "running":
                return v
            time.sleep(0.15)
        return v

    def post(path, body=None):
        return api.post(path, json=body or {})

    try:
        o = api.get("/api/studio/options").json()
        check("options: content types, genres, tones, languages, lengths, quick revisions (and no client)", len(o["content_types"]) == 7 and len(o["genres"]) == 20 and len(o["tones"]) == 20 and len(o["languages"]) == 10 and o["lengths"] == ["Short", "Medium", "Long"] and len(o["revisions"]) == 6 and "client_language" not in o, str(o)[:200])
        r = post("/api/studio/stories", {**BRIEF, "idea": "tiny"})
        check("a bad brief is refused with a plain message (400)", r.status_code == 400 and "idea" in r.json()["detail"].lower(), r.text[:150])
        r = post("/api/studio/stories", BRIEF)
        pid = r.json()["id"]
        made.append(pid)
        check("create: a story with the 9 stages, concept next", r.status_code == 200 and [s["key"] for s in r.json()["stages"]] == ["concept", "logline", "characters", "conflict", "ending", "structure", "beats", "outline", "story"] and r.json()["next_stage"] == "concept")
        check("   it is listed, with its state, focus stage and counts", any(x["id"] == pid and x["state"] == "your" and x["focus"] == "concept" and x["approved"] == 0 for x in api.get("/api/studio/stories").json()["stories"]))
        check("a story that doesn't exist is a 404 (open, change, delete)", api.get("/api/studio/stories/nope").status_code == 404 and post("/api/studio/stories/nope/stages/concept/generate").status_code == 404 and api.delete("/api/studio/stories/nope").status_code == 404)
        # ---- the access key
        config.STUDIO_ACCESS_KEY = "agency-secret"
        check("with a key set: /status says so without needing it", api.get("/api/studio/status").json() == {"protected": True})
        check("   every other call is refused without the key (401)", api.get("/api/studio/stories").status_code == 401 and post("/api/studio/stories", BRIEF).status_code == 401 and api.get("/api/studio/options").status_code == 401)
        check("   and with a wrong key", api.get("/api/studio/stories", headers={"X-Studio-Key": "guess"}).status_code == 401)
        check("   the right key works, and /session confirms it", api.get("/api/studio/stories", headers={"X-Studio-Key": "agency-secret"}).status_code == 200 and api.get("/api/studio/session", headers={"X-Studio-Key": "agency-secret"}).json() == {"ok": True})
        check("   the story files need it too", api.get(f"/api/studio/stories/{pid}/export").status_code == 401)
        config.STUDIO_ACCESS_KEY = ""
        check("with no key set: it is open, and /status says so", api.get("/api/studio/status").json() == {"protected": False} and api.get("/api/studio/stories").status_code == 200)
        check("the client app is untouched: no client is needed and the old address is gone", api.get("/api/stories").status_code == 404)

        r = post(f"/api/studio/stories/{pid}/stages/logline/generate")
        check("writing a stage out of order is refused at once (400)", r.status_code == 400 and "Approve the Concept first" in r.json()["detail"], r.text[:150])
        check("an unknown stage is a 404", post(f"/api/studio/stories/{pid}/stages/poem/generate").status_code == 404)
        check("the final story has its own button", post(f"/api/studio/stories/{pid}/stages/story/generate").status_code == 400)
        check("accepting before writing is refused", post(f"/api/studio/stories/{pid}/stages/concept/accept").status_code == 400)

        fake.CONTROL["delay"] = 0.8
        r = post(f"/api/studio/stories/{pid}/stages/concept/generate")
        check("generate returns at once with the step running", r.status_code == 200 and r.json()["job"]["status"] == "running" and r.json()["job"]["kind"] == "stage:concept", str(r.json()["job"]))
        r2 = post(f"/api/studio/stories/{pid}/stages/concept/generate")
        check("a second click while it runs is refused (409)", r2.status_code == 409, r2.text[:150])
        v = wait(pid)
        fake.CONTROL["delay"] = 0
        concept = next(s for s in v["stages"] if s["key"] == "concept")
        check("the page polls until the step is done: a draft with progress finished", v["job"]["status"] == "done" and concept["status"] == "draft" and concept["content"], str(v["job"]))

        post(f"/api/studio/stories/{pid}/stages/concept/generate", {"direction": "Set it in Ratnagiri", "retry": True}); v = wait(pid)
        check("retry with a direction: recorded in the Bible", v["directions"] == [{"stage": "concept", "text": "Set it in Ratnagiri"}] and "(Concept) Set it in Ratnagiri" in v["bible"])
        r = post(f"/api/studio/stories/{pid}/stages/concept/accept")
        check("accept: approved, next stage is the logline", r.status_code == 200 and r.json()["next_stage"] == "logline" and next(s for s in r.json()["stages"] if s["key"] == "concept")["status"] == "approved")
        r = post(f"/api/studio/stories/{pid}/stages/concept/accept", {"content": "changed"})
        check("an approved stage can't be changed (400)", r.status_code == 400)
        r = post(f"/api/studio/stories/{pid}/stages/logline/accept", {"content": "   "})
        check("an empty edit is refused", r.status_code == 400)

        for s_ in ("logline", "characters", "conflict", "ending", "structure", "beats", "outline"):
            post(f"/api/studio/stories/{pid}/stages/{s_}/generate"); wait(pid)
            post(f"/api/studio/stories/{pid}/stages/{s_}/accept", {"content": "Raghu, a fisherman in Ratnagiri, must stop the flood before dawn." if s_ == "logline" else None})
        v = api.get(f"/api/studio/stories/{pid}").json()
        check("walked through the eight stages: only the story is left", v["next_stage"] == "story" and all(s["status"] == "approved" for s in v["stages"][:8]))
        check("   the Bible carries the facts of every stage", all(f"### {n}" in v["bible"] for n in ("Concept", "Logline", "Characters", "Outline")))

        check("no story file yet (404)", api.get(f"/api/studio/stories/{pid}/files/story.md").status_code == 404)
        post(f"/api/studio/stories/{pid}/story/generate"); v = wait(pid)
        check("story written and validated in the background", v["job"]["status"] == "done" and v["validation"]["status"] == "PASS" and next(s for s in v["stages"] if s["key"] == "story")["content"].startswith("# The Fisherman"), str(v["job"]))
        check("   objective checks are in the page's data", {c["key"] for c in v["checks"]} == {"length", "language", "cast", "repetition", "title"})
        r = api.get(f"/api/studio/stories/{pid}/files/story.md")
        check("story.md downloads with the right file name", r.status_code == 200 and "attachment" in r.headers["content-disposition"] and r.text.startswith("# The Fisherman"))
        check("   other files are not served", api.get(f"/api/studio/stories/{pid}/files/secret.txt").status_code == 404 and api.get(f"/api/studio/stories/{pid}/files/..%2F..%2F.env").status_code == 404)

        fake.CONTROL["reports"] = [fake.report(hard=1), fake.report(hard=0)]
        post(f"/api/studio/stories/{pid}/story/validate"); v = wait(pid)
        check("validate again: a hard failure is repaired once and the page shows what happened", v["validation"]["repair"]["kept"] == "repaired" and v["can_undo"] is True, str(v["validation"]["repair"]))
        check("a revision needs words (400)", post(f"/api/studio/stories/{pid}/story/revise", {"instruction": ""}).status_code == 400)
        post(f"/api/studio/stories/{pid}/story/revise", {"instruction": "Make it more emotional"}); v = wait(pid)
        check("revise runs in the background and validates again", v["job"]["status"] == "done" and v["validation"]["status"] == "PASS")
        r = post(f"/api/studio/stories/{pid}/story/undo")
        check("undo goes back one version", r.status_code == 200 and "(revised)" not in next(s for s in r.json()["stages"] if s["key"] == "story")["content"])
        r = post(f"/api/studio/stories/{pid}/story/accept")
        check("the story can be accepted", r.status_code == 200 and next(s for s in r.json()["stages"] if s["key"] == "story")["status"] == "approved")

        check("no screenplay file yet (404)", api.get(f"/api/studio/stories/{pid}/files/screenplay.fountain").status_code == 404)
        post(f"/api/studio/stories/{pid}/screenplay/generate"); v = wait(pid)
        sp = v["screenplay"]
        check("screenplay: 5 scenes written one at a time, assembled", v["job"]["status"] == "done" and sp["written"] == 5 and sp["planned"] == 5 and sp["fountain"].startswith("Title:"), str(v["job"]))
        check("   the page gets the scene warnings (heading added, speaker not in the cast)", any("heading was missing" in w for w in sp["warnings"]) and any("STRANGER" in w for w in sp["warnings"]), str(sp["warnings"]))
        r = api.get(f"/api/studio/stories/{pid}/files/screenplay.fountain")
        check("screenplay.fountain downloads", r.status_code == 200 and r.text.rstrip().endswith("FADE OUT."))
        r = api.get(f"/api/studio/stories/{pid}/export")
        z = zipfile.ZipFile(io.BytesIO(r.content))
        check("the whole project downloads as one zip", r.status_code == 200 and {"story-project/story.md", "story-project/story_bible.md", "story-project/screenplay/screenplay.fountain", "story-project/stages/outline.md"} <= set(z.namelist()), str(z.namelist())[:200])
        check("deleting removes it", api.delete(f"/api/studio/stories/{pid}").status_code == 200 and api.get(f"/api/studio/stories/{pid}").status_code == 404)
    finally:
        config.STUDIO_ACCESS_KEY = ""
        with Session() as s:
            for p in s.query(StudioStory).filter(StudioStory.id.in_(made)).all():
                s.delete(p)
            s.commit()
    print(f"\n{sum(RESULTS)} of {len(RESULTS)} checks passed")
    return 0 if all(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
