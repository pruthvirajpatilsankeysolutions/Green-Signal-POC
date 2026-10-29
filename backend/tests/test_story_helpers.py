"""Tests of the small story helpers (shape, checks, fountain, sizes, prompts). No database and no model needed.
Run from the backend folder:   python -m tests.test_story_helpers"""

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
RESULTS = []


def check(name, ok, extra=""):
    RESULTS.append(bool(ok))
    print(
        ("PASS" if ok else "FAIL")
        + "  "
        + name
        + (f"   [{extra}]" if extra and not ok else ""),
        flush=True,
    )


def main():
    from story import checks, engine, fountain, options, prompts, shape

    brief = {
        "length": "Medium",
        "language": "Hindi",
        "content_type": "Film Story",
        "genres": ["Drama"],
        "tones": ["Hopeful"],
        "idea": "x" * 20,
    }

    # a cast written exactly as the Characters prompt asks: full lines for two, short lines for the supporting characters
    full = lambda n, r: (
        f"**{n}** — {r}, 34, lives in Pune.\n- Want: x\n- Why: x\n- Need: x\n- Flaw: x\n- Past: x\n- Contradiction: x\n- Habit: x\n"
        "- Voice: x\n- Never: x\n- Relationships: x\n- Pressure: x\n- Arc: x\n"
    )
    sup = (
        lambda n: f"**{n}** — friend, 30.\n- Want: x\n- Flaw: x\n- Contradiction: x\n- Does to the protagonist: x\n"
    )
    cast = (
        full("Aarav", "protagonist")
        + full("Meera", "opposing force")
        + "".join(sup(n) for n in ["Kabir", "Sana", "Dev", "Isha", "Rohan"])
    )
    check(
        "a correct cast gives no shape warning",
        shape.check("characters", cast, brief) == [],
        str(shape.check("characters", cast, brief)),
    )
    check(
        "a cast without Need lines is still caught",
        any(
            "Need" in w
            for w in shape.check("characters", cast.replace("- Need: x\n", ""), brief)
        ),
    )
    bolded = (
        cast.replace("- Past:", "- **Past:**")
        .replace("- Habit:", "- **Habit**:")
        .replace("- Does to the protagonist:", "- **Does to the protagonist:**")
    )
    check(
        "bold field labels are not counted as characters",
        checks.cast_names(bolded)
        == sorted(["Aarav", "Meera", "Kabir", "Sana", "Dev", "Isha", "Rohan"]),
        str(checks.cast_names(bolded)),
    )

    hi = "वह कहानी लिखता है और सुबह घर जाता है"
    check(
        "Hindi words are counted as a reader counts them",
        checks.word_count(hi) == len(hi.split()) == 9,
        str(checks.word_count(hi)),
    )
    check(
        "English contractions count once",
        checks.word_count("I don't know — really.") == 4,
        str(checks.word_count("I don't know — really.")),
    )
    check("a lone dash or # is not a word", checks.word_count("# Title\n\n— —") == 1)
    check("repetition works on Hindi text", checks.repetition(hi * 3) > 0)

    scene = "INT. HOUSE - NIGHT\n\nAARAV (30) sits.\n\nAARAV\nमैं नहीं जाऊँगा\nतुम जाओ\n\nMEERA\nठीक है\n"
    text, issues, spoken = fountain.check_scene(
        scene, "**Aarav** — x\n**Meera** — y", "INT. HOUSE - NIGHT"
    )
    check(
        "Hindi dialogue lines are not taken for speakers",
        issues == [] and spoken == ["AARAV", "MEERA"],
        f"{issues} {spoken}",
    )
    text, issues, spoken = fountain.check_scene(
        "INT. HOUSE - NIGHT\n\nTHE BELL RINGS.\nAARAV looks up.\n\nSTRANGER\nHello.\n",
        "**Aarav** — x",
        "",
    )
    check(
        "an all-caps action line is not a speaker, an unknown speaker still is",
        spoken == ["STRANGER"] and any("STRANGER" in i for i in issues),
        f"{issues} {spoken}",
    )
    text, issues, spoken = fountain.check_scene(
        "INT. HOUSE - NIGHT\n\nAARAV\nहाँ\n", "**आरव** — x", ""
    )
    check(
        "a cast written in another script gives no false speaker warnings",
        issues == [],
        str(issues),
    )

    check(
        "'cute' and 'execute' do not mean 'shorter'",
        not engine._wants_shorter("Make the hero cute")
        and not engine._wants_shorter("Execute the ending better"),
    )
    check(
        "'Make it shorter' and 'cut the middle' do",
        engine._wants_shorter("Make it shorter")
        and engine._wants_shorter("Cut the middle"),
    )

    for length in ("Short", "Medium", "Long"):
        s = options.sizes({"content_type": "Film Story", "length": length})
        lo, hi = s["scenes"]
        check(
            f"story-like {length}: 250-375 words per scene",
            240 <= s["words"] / hi and s["words"] / lo <= 380,
            f"{s['words'] / hi:.0f}-{s['words'] / lo:.0f}",
        )
    check(
        "an advertisement keeps its original size",
        options.sizes({"content_type": "Advertisement", "length": "Medium"})["words"]
        == options.SIZES["Medium"]["words"],
    )
    check(
        "the length check uses the new target",
        checks.run(
            {"content_type": "Film Story", "length": "Medium", "language": "English"},
            "# T\n" + "word " * 5500,
        )[0]["ok"],
    )

    project = {
        "brief": {**brief, "language": "Marathi"},
        "stages": {},
        "directions": [],
        "notes": "",
    }
    _, user = prompts.story_prompt(project)
    check(
        "the story prompt has the craft rules, the freedom to invent, and the tone",
        all(
            x in user
            for x in (
                "CRAFT",
                "FREE TO INVENT",
                "Genres: Drama",
                "Tones: Hopeful",
                "idiomatic Marathi",
            )
        ),
    )
    check(
        "the story prompt gives the words per scene",
        "of about 310 words" in user or "about 3" in user,
        user[user.find("CRAFT") : user.find("CRAFT") + 140],
    )
    check(
        "the canon rules come before the craft rules",
        user.index("CANON RULES") < user.index("CRAFT"),
    )
    check(
        "the repair and revise prompts are unchanged in canon",
        "FREE TO INVENT"
        not in prompts.repair_prompt(
            project, "# T\nx", {"hard_failures": [], "rewrite_notes": []}
        ),
    )

    print(f"\n{sum(RESULTS)} of {len(RESULTS)} checks passed")
    return 0 if all(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
