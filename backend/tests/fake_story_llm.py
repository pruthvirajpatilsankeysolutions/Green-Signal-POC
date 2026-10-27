"""A scripted stand-in for the model, so Story Studio can be tested without an AI key. It reads the TASK line of each prompt and
returns correctly SHAPED output. `CONTROL` lets a test make it find conflicts, fail validation, repair badly, or raise errors."""
import json
import re
import threading
import time

from story.llm import ModelError

LOCK = threading.Lock()
CONTROL = {"conflicts": {}, "reports": [], "fail": {}, "delay": 0.0, "calls": []}
VERSION = {}


def reset(**kw):
    with LOCK:
        CONTROL.update(conflicts={}, reports=[], fail={}, delay=0.0, calls=[], **kw)
        VERSION.clear()


def _task(user):
    m = re.match(r"TASK: (\S+)", user)
    return m.group(1) if m else ""


def _block(user, tag):
    m = re.search(rf"<{tag}(?:\s[^>]*)?>\n(.*?)\n</{tag}>", user, re.S)       # exactly this tag (<story_bible> is not <story>)
    return m.group(1) if m else ""


def _words(n, seed):
    base = ("The river slowly turned silver as Raghu carried the old radio home through the village, past the temple steps and the tea stall, "
            "while Meena waited by the door and Tukaram counted the nets. ").split()
    out = []
    while len(out) < n:
        out += base
    out = out[:n]
    out[0] = out[0] + f" ({seed})"
    return " ".join(out)


STAGE_TEXT = {
    "concept": lambda v, s: _words(180, f"concept v{v}") + ".",
    "logline": lambda v, s: f"A poor fisherman named Raghu must rescue his village from a flood while his greedy landlord Seth blocks the only boat (v{v}).\n\n*Why it works:* a clear want, a clear obstacle and a ticking clock.",
    "characters": lambda v, s: (f"**Raghu** — protagonist, fisherman (v{v})\n- Want: save the village\n- Need: trust others\n- Fear: losing his family\n- Flaw: pride\n- Arc: learns to ask for help\n\n"
                                "**Meena** — his wife\n- Want: safety\n- Need: to be heard\n- Fear: the river\n- Flaw: silence\n- Arc: speaks up\n\n"
                                "**Seth** — antagonist, landlord\n- Want: the land\n- Need: respect\n- Fear: poverty\n- Flaw: greed\n- Arc: stays selfish\n\n"
                                "**Tukaram** — friend, boatman\n- Want: his boat\n- Need: courage\n- Fear: Seth\n- Flaw: weakness\n- Arc: stands up"),
    "conflict": lambda v, s: f"**External:** the flood and Seth (v{v}).\n\n**Internal:** pride.\n\n**Relationship:** Raghu and Meena.\n\n**Stakes:** the village.\n\n**Ticking clock:** the river rises by dawn.",
    "ending": lambda v, s: _words(120, f"ending v{v}") + ".\n\nAlternatives:\n- Raghu fails: too bleak for this story.\n- Seth is punished: too neat.",
    "structure": lambda v, s: f"**Act I** (25%): setup (v{v}).\n\n**Act II** (50%): the flood rises.\n\n**Act III** (25%): the rescue.",
    "beats": lambda v, s: "\n".join(f"{i}. **Beat {i}** — Raghu and Meena move the story forward (v{v})." for i in range(1, s["beats"] + 1)),
    "outline": lambda v, s: "## Act I\n" + "\n".join(f"{i}. **Scene {i}** — Village. Raghu acts, Meena reacts (v{v})." for i in range(1, s["scenes"][0] + 1)),
}


def _stage_params(user):
    length = re.search(r"\*\*Length:\*\* (\w+)", user)
    from story.options import SIZES
    return SIZES[length.group(1)] if length else SIZES["Medium"]


def _story(version=1):
    body = " ".join(_words(150, f"part {i}") for i in range(1, 8))
    return f"# The Fisherman's Radio\n\n{body}\n\nRaghu, Meena, Seth and Tukaram stood together as the river went quiet. Version {version}."


REPORT_PASS = {"score": 92, "status": "PASS", "hard_failures": [], "warnings": [{"type": "pacing", "issue": "The middle is slow."}], "strengths": ["Clear voice"], "rewrite_notes": [],
               "ledger": {"characters": ["Raghu: alive"], "objects_and_information": ["Radio: found in scene 1"], "key_events": ["Flood -> rescue"]}}


def report(hard=0, score=None):
    r = json.loads(json.dumps(REPORT_PASS))
    r["hard_failures"] = [{"type": "missing_causal_event", "issue": f"Seth's arrest has no cause ({i})", "evidence": "Seth is arrested.", "fix": "Show the bribe."} for i in range(hard)]
    r["rewrite_notes"] = [f"Add the cause of arrest {i}" for i in range(hard)]
    r["score"] = score if score is not None else (92 if not hard else 55)
    r["status"] = "FAIL" if hard else "PASS"
    return r


def complete(system, user, *, json_mode=False, temperature=0.7, max_tokens=None):
    task = _task(user)
    kind, _, arg = task.partition("=")
    with LOCK:
        CONTROL["calls"].append(task)
        if CONTROL["delay"]:
            pass
    if CONTROL["delay"]:
        time.sleep(CONTROL["delay"])
    with LOCK:
        failing = CONTROL["fail"].get(task) or CONTROL["fail"].get(kind)
        if failing:
            if failing is True or failing == 1:
                CONTROL["fail"].pop(task, None) or CONTROL["fail"].pop(kind, None)
            elif isinstance(failing, int) and failing > 1:
                CONTROL["fail"][task if task in CONTROL["fail"] else kind] = failing - 1
            raise ModelError(f"simulated model error in {task}")
    if kind == "notes":
        return "Premise: a fisherman and a radio. Avoid cliches. Fresh angles: the radio only plays the future."
    if kind == "stage":
        with LOCK:
            VERSION[arg] = VERSION.get(arg, 0) + 1
            v = VERSION[arg]
        return STAGE_TEXT[arg](v, _stage_params(user))
    if kind == "check":
        with LOCK:
            queue = CONTROL["conflicts"].get(arg)
            item = queue.pop(0) if queue else {"conflicts": [], "warnings": []}
        return json.dumps(item)
    if kind == "fix":
        return _block(user, "draft").strip() + "\n\n(fixed)"
    if kind == "facts":
        text = _block(user, "approved").strip()
        with LOCK:
            many = CONTROL.get("many_facts")
        n = 30 if many else 3
        return json.dumps({"facts": [f"- {arg} fact {i}: {' '.join(text.split()[:6])}" for i in range(1, n + 1)]})
    if kind == "story":
        return _story()
    if kind == "validate":
        with LOCK:
            r = CONTROL["reports"].pop(0) if CONTROL["reports"] else REPORT_PASS
        return r if isinstance(r, str) else json.dumps(r)
    if kind == "repair":
        with LOCK:
            short = CONTROL.get("repair_short")
        return "# The Fisherman's Radio\n\nA much shorter story." if short else _block(user, "story").strip() + "\n\nSeth took the bribe before the arrest. (repaired)"
    if kind == "revise":
        with LOCK:
            short = CONTROL.get("revise_short")
        return "# The Fisherman's Radio\n\nToo short." if short else _block(user, "story").strip() + "\n\n(revised)"
    if kind == "screenplay-plan":
        scenes = [{"heading": h, "title": t, "summary": f"{t}: Raghu and Meena act.", "characters": ["RAGHU", "MEENA"]} for h, t in
                  (("INT. HUT - NIGHT", "The radio"), ("EXT. RIVER - DAY", "The river rises"), ("int. temple - evening", "The meeting"), ("EXT. BOAT - NIGHT", "The rescue"), ("EXT. SHORE - DAWN", "Morning"))]
        return json.dumps({"scenes": scenes})
    if kind == "scene":
        n = int(arg)
        head = "" if n == 2 else {1: "INT. HUT - NIGHT", 3: "INT. TEMPLE - EVENING", 4: "EXT. BOAT - NIGHT", 5: "EXT. SHORE - DAWN"}.get(n, "EXT. RIVER - DAY") + "\n\n"
        stranger = "\n\nSTRANGER\nWho are you?" if n == 3 else ""
        with LOCK:
            CONTROL.setdefault("scene_calls", []).append(n)
        return f"{head}RAGHU (30) listens to the radio.\n\nRAGHU\nIt knows what comes next (scene {n}).\n\nMEENA\nThen listen.{stranger}"
    raise ModelError(f"the stand-in model does not know the task '{task}'")
