"""Fill Story Studio with sample stories in every state (a draft waiting, nothing written yet, problems found, validated with a screenplay),
written through the real engine with a scripted stand-in model (no AI key needed). Handy to see the page populated.
WARNING: it removes every story in Story Studio first.      Run from the backend folder:   python -m tests.seed_studio_demo"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from storage.db import Session, StudioStory, init_db
from story import engine, llm, store
from tests import fake_story_llm as fake
llm.complete = fake.complete
init_db()
with Session() as s:
    for r in s.query(StudioStory).all(): s.delete(r)
    s.commit()
B = lambda **k: {"content_type": "Short Story", "idea": "A fisherman finds an old radio that plays tomorrow's news.", "genres": ["Drama"], "tones": ["Hopeful"], "language": "Marathi", "length": "Short", **k}
def walk(pid, upto):
    for st in engine.PRE:
        engine.generate_stage(pid, st); 
        if st == upto: return
        engine.accept_stage(pid, st)
def fresh(brief):
    fake.reset(); return engine.create(brief)["id"]
# 1: two stages approved, Characters waiting, with a conflict and a warning
a = fresh(B(idea="A fisherman finds an old radio that plays tomorrow's news.")); fake.CONTROL["conflicts"]["characters"] = [{"conflicts": ["Seth is in two places at once."], "warnings": ["Which city is this?"]}, {"conflicts": ["Seth is in two places at once."], "warnings": ["Which city is this?"]}]
engine.generate_stage(a, "concept"); engine.accept_stage(a, "concept"); engine.generate_stage(a, "logline"); engine.accept_stage(a, "logline", content="Raghu, a fisherman in Ratnagiri, must stop the flood before dawn."); engine.generate_stage(a, "characters")
store.mutate(a, lambda p: p.update(title="The Fisherman's Radio"))
# 2: validated story with a screenplay
b = fresh(B(content_type="Film Story", idea="Two strangers share the last bus out of a storm.", genres=["Drama", "Romance"], language="English", length="Medium"))
walk(b, "outline"); engine.accept_stage(b, "outline"); engine.write_story(b); engine.write_screenplay(b)
store.mutate(b, lambda p: p.update(title="Last Bus to Pune", updated_ts=time.time() - 3 * 86400))
# 3: story with problems
c = fresh(B(content_type="Web Series Pilot", idea="A young agronomist exposes a seed cartel.", genres=["Drama", "Political"], language="English", length="Long"))
walk(c, "outline"); engine.accept_stage(c, "outline"); fake.CONTROL["reports"] = [fake.report(hard=2), fake.report(hard=3)]; engine.write_story(c)
store.mutate(c, lambda p: p.update(title="Seeds of Change", updated_ts=time.time() - 2 * 86400))
# 4: nothing written yet
d = fresh(B(content_type="Social Media", idea="A family decides what to keep as the old house is sold.", genres=["Family", "Emotional"], language="Hindi"))
store.mutate(d, lambda p: p.update(title="Diwali Reunion", updated_ts=time.time() - 86400))
# 5: outline ready to be reviewed
e = fresh(B(content_type="Advertisement", idea="A daughter brings her family together before Gudi Padwa.", genres=["Family", "Feel-good"], length="Medium"))
walk(e, "outline"); store.mutate(e, lambda p: p.update(title="Gudi Padwa: A New Beginning", updated_ts=time.time() - 86400 * 1.2))
print("seeded", [x["title"] + " -> " + engine.summary(store.get(x["id"]))["state"] for x in store.list_all()])
