"""Browser test of Story Studio (/studio) against the real backend with a scripted stand-in model (no AI key needed).
It starts two servers (one open, one with an access key), then writes a story through the page from an empty studio to a screenplay.
Needs the built front end (cd frontend; npm run build), Playwright (pip install playwright; playwright install chromium) and the database settings.
Run from the backend folder:   python -m tests.e2e_studio
WARNING: it removes every story in Story Studio first, so use a test database."""
import os, sys, tempfile, time, subprocess, requests, zipfile, io
from pathlib import Path
from playwright.sync_api import sync_playwright
BACKEND = Path(__file__).resolve().parent.parent
LOGS = Path(tempfile.gettempdir())
sys.path.insert(0, str(BACKEND))
from storage.db import Session, StudioStory, init_db
init_db()
with Session() as s:
    for r in s.query(StudioStory).all(): s.delete(r)
    s.commit()
base = {**os.environ, "STORY_FAKE_DELAY": "0.3"}
def serve(port, extra={}):
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "tests.story_fake_app:app", "--port", str(port)], cwd=str(BACKEND), env={**base, **extra}, stdout=subprocess.DEVNULL, stderr=open(LOGS / f"studio_test_{port}.log", "w"))
    for _ in range(90):
        try: requests.get(f"http://localhost:{port}/api/studio/status", timeout=1); return p
        except requests.RequestException: time.sleep(1)
    raise RuntimeError(port)
procs = [serve(8000), serve(8001, {"STUDIO_ACCESS_KEY": "agency-secret"})]
RESULTS = []
def check(n, ok, extra=""):
    RESULTS.append(bool(ok)); print(("PASS" if ok else "FAIL") + "  " + n + (f"   [{extra}]" if extra and not ok else ""), flush=True)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(25000)
        pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: errs.append(m.text[:300]) if m.type == "error" and "ERR_NAME_NOT_RESOLVED" not in m.text else None)
        pg.on("dialog", lambda d: d.accept())
        U = "http://localhost:8000/studio/"
        # ---- an empty studio
        pg.goto(U); pg.wait_for_selector(".blank"); 
        check("empty: a welcome with 'New story', and the list says there are none", "No stories yet" in pg.inner_text(".blank") and "No stories yet" in pg.inner_text(".sl"))
        check("it is its own page: the client app's menu and header are not there", pg.title() == "Story Studio" and pg.locator("a.nav-link").count() == 0 and "Postcraft" not in pg.content())
        # ---- a new story
        pg.click(".add"); pg.wait_for_selector(".modal")
        check("new story: 'Start the story' is disabled and says why", pg.locator(".mf .btn.k").is_disabled() and "Describe the idea" in pg.inner_text(".mf"))
        pg.fill("#idea", "A fisherman finds an old radio that plays tomorrow's news.")
        for g in ("Drama", "Fantasy", "Comedy"): pg.locator("[aria-label=Genre] .chipb", has_text=g).first.click()
        check("   at most 3 genres (the next is disabled)", pg.locator("[aria-label=Genre] .chipb.on").count() == 3 and pg.locator("[aria-label=Genre] .chipb", has_text="Crime").first.is_disabled())
        pg.locator("[aria-label=Genre] .chipb.on", has_text="Comedy").click(); pg.locator("[aria-label=Tone] .chipb", has_text="Hopeful").click()
        pg.locator("[role=radio]", has_text="Short").click(); pg.select_option("#lg", "Marathi"); pg.click(".mf .btn.k")
        pg.wait_for_url("**/studio/story/*"); pg.wait_for_selector(".ttl")
        sid = pg.url.rstrip("/").split("/")[-1]
        check("created: the story opens at its own address, titled from the idea, with the Concept ready", "A fisherman finds an old radio" in pg.inner_text(".ttl") and "Write the Concept" in pg.inner_text(".right"))
        check("   the list shows it as 'Your turn'", "Your turn" in pg.inner_text(".row.on"))
        # ---- stage 1: write, retry with a direction, edit, accept
        pg.click("#primary-action"); pg.wait_for_selector(".run"); check("writing a stage shows what it is doing (and the buttons wait)", len(pg.inner_text(".run")) > 5 and pg.locator("#primary-action").is_disabled())
        pg.wait_for_selector(".draft", timeout=40000); pg.wait_for_function("() => !document.querySelector('.run')", timeout=40000)
        first = pg.inner_text(".draft")
        check("the draft arrives with Retry and Accept, and the check against the Bible", pg.locator(".rh .btn").all_inner_texts() == ["Retry", "Accept"] and "No problems found" in pg.inner_text(".right"))
        pg.fill("[aria-label=Direction]", "Set it in Ratnagiri, keep it gentle"); pg.click(".rh .btn:has-text('Retry')"); pg.wait_for_selector(".run"); pg.wait_for_function("() => !document.querySelector('.run')", timeout=40000)
        check("retry: a different version; the direction is remembered in the Story Bible", pg.inner_text(".draft") != first and "Set it in Ratnagiri" in pg.inner_text(".two"))
        pg.click(".sl2 .lk"); mine = "A fisherman in Ratnagiri finds an old radio that plays tomorrow's news, and must decide whether to warn the village."
        check("edit: the draft becomes a box and the header offers Cancel / Save as approved", pg.is_visible("textarea.draft") and "Save as approved" in pg.inner_text(".rh"))
        pg.fill("textarea.draft", mine); pg.click("text=Save as approved"); pg.wait_for_selector("text=Write the Logline")
        check("saved as approved: the next stage is ready; the concept is in 'Approved so far' as the writer's words", "Concept" in pg.inner_text(".two") and pg.locator(".pipe li.done").count() == 1)
        # ---- the rest, quickly, through the page
        for name in ("Logline", "Characters", "Conflict", "Ending", "Structure", "Beats", "Outline"):
            if name != "Logline": pg.wait_for_selector(f"text=Write the {name}")
            pg.click("#primary-action"); pg.wait_for_selector(".draft", timeout=40000); pg.wait_for_function("() => !document.querySelector('.run')", timeout=40000)
            pg.click("#primary-action"); pg.wait_for_function("(n) => !document.querySelector('.right .draft') || document.querySelector('.rh h2').textContent !== n", arg=name, timeout=40000)
        pg.wait_for_selector("text=Write the story")
        check("all eight stages approved: the Story is next", pg.locator(".pipe li.done").count() == 8 and "Write the story" in pg.inner_text(".right"))
        pg.click("#primary-action"); pg.wait_for_selector(".run"); pg.wait_for_selector("text=Read story", timeout=60000); pg.wait_for_function("() => !document.querySelector('.run')", timeout=40000)
        check("the story is written, checked and validated: 'Validated', with a score", "Validated" in pg.inner_text(".chip.ok") and "92" in pg.inner_text(".right .score"))
        check("   the checks on the text are shown", "Length" in pg.inner_text(".two") and "Title" in pg.inner_text(".two"))
        # ---- read, revise, undo
        pg.click("text=Read story"); pg.wait_for_url("**/read"); pg.wait_for_selector(".read")
        check("the reader shows the whole story", "The Fisherman's Radio" in pg.inner_text(".read") and "Seth took" not in pg.inner_text(".read"))
        pg.click(".rh .btn:has-text('Revise')"); pg.wait_for_selector(".modal"); pg.click(".chipb:has-text('Make it more emotional')"); pg.wait_for_selector(".run"); pg.wait_for_function("() => !document.querySelector('.run')", timeout=60000)
        check("revise (a quick change): the story changes and is checked again", "(revised)" in pg.inner_text(".read") and "92" in pg.inner_text(".right .score"))
        pg.click("text=Go back one version"); pg.wait_for_function("() => !document.querySelector('.read').textContent.includes('(revised)')")
        check("'Go back one version' returns to the earlier text", "(revised)" not in pg.inner_text(".read"))
        check("   and the story is no longer marked validated (the text changed)", "Not validated yet" in pg.inner_text(".right"))
        pg.click(".rh .btn.k"); pg.wait_for_selector(".run"); pg.wait_for_function("() => !document.querySelector('.run')", timeout=60000); pg.wait_for_selector(".right .btnrow .btn:has-text('Screenplay')")
        check("   validating again brings the result and the Screenplay button back", "92" in pg.inner_text(".right .score"))
        # ---- downloads
        with pg.expect_download() as d1: pg.click("text=story.md")
        txt = open(d1.value.path(), encoding="utf-8").read(); check("story.md downloads", d1.value.suggested_filename == "story.md" and txt.startswith("# The Fisherman"))
        # ---- screenplay
        pg.click(".right .btnrow .btn:has-text('Screenplay')"); pg.wait_for_url("**/screenplay"); pg.wait_for_selector("text=Write the screenplay")
        pg.click(".rh .btn.k"); pg.wait_for_selector(".run"); pg.wait_for_selector(".scene", timeout=60000); pg.wait_for_function("() => !document.querySelector('.run')", timeout=90000)
        check("screenplay: 5 scenes written, with the warnings for the heading added and the speaker not in the cast", pg.locator(".scene").count() == 5 and "STRANGER" in pg.inner_text(".right") and "heading was missing" in pg.inner_text(".right"))
        pg.locator(".scene > button").first.click(); check("a scene opens as a script page", "RAGHU" in pg.inner_text("pre.fountain"))
        with pg.expect_download() as d2: pg.click("text=.fountain")
        check("screenplay.fountain downloads", d2.value.suggested_filename == "screenplay.fountain" and open(d2.value.path(), encoding="utf-8").read().rstrip().endswith("FADE OUT."))
        pg.go_back(); pg.go_back()
        # ---- the whole project, a deep link after a reload, delete
        pg.goto(U + f"story/{sid}/read"); pg.wait_for_selector(".read")
        check("a reload on a deep link (/studio/story/<id>/read) still opens the story", "Fisherman" in pg.inner_text(".read"))
        pg.goto(U + f"story/{sid}"); pg.wait_for_selector(".ttl")
        with pg.expect_download() as d3: pg.click("[aria-label='Download project']")
        z = zipfile.ZipFile(d3.value.path()); check("the whole project downloads as a zip", {"story-project/story.md", "story-project/story_bible.md", "story-project/screenplay/screenplay.fountain"} <= set(z.namelist()), str(z.namelist())[:160])
        pg.click("[aria-label=More]"); pg.click("text=Delete story"); pg.wait_for_selector(".blank")
        check("delete: the story is gone and the studio is empty again", requests.get("http://localhost:8000/api/studio/stories").json()["stories"] == [])
        check("an address that doesn't exist is handled (no crash)", pg.goto(U + "story/nope").status == 200)
        # ---- the access key
        k = ctx.new_page(); k.set_default_timeout(20000); k.on("pageerror", lambda e: errs.append("key page: " + str(e)[:200]))
        K = "http://localhost:8001/studio/"; k.goto(K); k.wait_for_selector(".sicard")
        check("with a key set: nothing is shown until it is entered (a sign-in screen)", "Enter the access key" in k.inner_text(".sicard") and k.locator(".rail").count() == 0)
        k.fill("#key", "wrong"); k.click(".sicard .btn.k"); k.wait_for_selector(".sicard .err")
        check("   a wrong key is refused with a plain message", "isn't right" in k.inner_text(".sicard .err") and k.locator(".rail").count() == 0)
        k.fill("#key", "agency-secret"); k.click(".sicard .btn.k"); k.wait_for_selector(".rail")
        check("   the right key opens it", k.locator(".lh h2").inner_text() == "Stories")
        k.reload(); k.wait_for_selector(".rail"); check("   and a reload stays signed in", k.locator(".rail").count() == 1)
        k.click("[aria-label=Settings]"); check("   Settings says it is protected and offers Sign out", "Protected by an access key" in k.inner_text(".pop") and "Sign out" in k.inner_text(".pop"))
        k.click("text=Sign out"); k.wait_for_selector(".sicard"); check("   Sign out returns to the sign-in screen", k.locator(".rail").count() == 0)
        check("   the server also refuses calls without the key", requests.get("http://localhost:8001/api/studio/stories").status_code == 401)
        print("page errors:", errs); b.close()
finally:
    for pr in procs: pr.terminate()
print(f"\n{sum(RESULTS)} of {len(RESULTS)} checks passed")
sys.exit(0 if RESULTS and all(RESULTS) else 1)
