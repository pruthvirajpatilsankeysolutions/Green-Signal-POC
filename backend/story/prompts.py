"""What the model is asked at every step. The text comes from the Story Studio references (stages, canon rules, validation).
Every prompt starts with a TASK line: it names the step in logs and lets tests tell the steps apart."""
from story import bible
from story.options import FORMAT_NOTES, MAX_FACTS, MAX_SCENES, STAGE_READS, STAGE_TITLES, STRUCTURE_HINTS, WORDS_PER_PAGE, sizes

CANON_RULES = """CANON RULES (stories, repairs and screenplays must follow these)
- Approved material is binding. Do not change any character's motivation, relationship, arc, backstory facts (for example how someone died) or the approved ending.
- Do not introduce new major characters, organizations, plot devices, threats or deadlines that are not in the approved material.
- Every important event needs an on-page cause: if someone is captured, arrested, killed, betrayed or arrives somewhere that matters, show or state how.
- Every important object or piece of information (documents, evidence, money, weapons, records, secrets) must be shown being obtained before it is used.
- Keep each character's location consistent; a character who dies or is last seen in one place cannot later be described in another without explanation.
- Causes come before effects: consequences (arrests, investigations, collapses) happen only after the event that triggers them.
- Writer directions in the Story Bible still apply; anything the writer asked to remove must not come back.
- Minor sensory and descriptive details not in the approved material are fine."""

WRITER = ("You are the writer in Story Studio, a tool where a writer develops a story one stage at a time and approves every stage. "
          "Approved stages are canon. Write with craft: concrete, specific, fresh, no cliches. Output ONLY the requested content in clean Markdown, "
          "with no preamble, no commentary and no closing remarks.")
EDITOR = ("You are a strict continuity editor. You did not write this text. Judge it only against the approved canon and against itself. "
          "Be precise, quote evidence, never invent problems, and do not flag anything the story or the canon actually establishes.")

FREE_TO_INVENT = """FREE TO INVENT (encouraged, and it is how the story comes alive)
- The exact words of every dialogue line, gestures, small incidents, minor background characters with no plot role, sensory texture,
  and HOW each approved event is dramatized on the page. The canon fixes WHAT happens and to WHOM, not how it looks and sounds."""

CRAFT_RULES = """CRAFT (what makes the story good, not only consistent)
- Dramatize, do not summarize. Play each outline scene as a scene of about {per_scene} words: action, dialogue, physical detail.
- Every scene has a character who wants something concrete, an obstacle, and a turn at the end (a decision, reveal, reversal or cost). Enter late, leave early.
- Play the key moment of each scene in action and dialogue; use summary only to bridge time.
- Give each character their own voice (see their Voice line). People do not say exactly what they mean, and nobody explains the plot in speeches.
- Show feeling through behaviour and objects, not by naming the emotion.
- One specific, unexpected sensory detail per scene. No cliches, no stock phrases.
- Let the genres and tones shape word choice, rhythm and imagery.
- Write natural, idiomatic {language}, as native speakers talk and write, not a translation from English."""

STAGE_GUIDE = {
    "concept": "150-220 words of prose: the world, the central situation, what makes this take fresh, and the emotional core. No headings. "
               "State the concrete facts plainly: the city or town where the story happens, where each main character lives now, the time frame, "
               "and what happened in the past (who did what, and why). Vague settings are the most common source of later contradictions.",
    "logline": "ONE sentence, max 35 words: who, wants what, what stands in the way, and what happens if they fail. "
               "Then one short line starting with *Why it works:*.",
    "characters": "A cast of one protagonist, one opposing force (the antagonist, or in a family drama the person or pressure that stands against the want) "
                "and 5-6 supporting characters. Write the opposing force's goal first. Each character: a bold name + role line, with age and family relationship "
                "stated plainly (they are canon). For the protagonist and the opposing force, one line each: Want (concrete, playable in a scene); Why; "
                "Need (what they do not know they need); Flaw; Past (one event before page 1 that explains the flaw); Contradiction; Habit (a ritual that shows "
                "them without dialogue); Voice; Never (one thing they would never do); Relationships (closest to / should be close but is not / who has power "
                "over whom); Pressure (three tactics from mild to extreme, then a final choice between two costly options); Arc (a situation from the start "
                "that repeats at the end and shows the change). Supporting characters: Want, Flaw, Contradiction, and what they do to the protagonist. "
                "Bold names matter: the tool reads them. Use bold ONLY for character names.",
                
    "conflict": "Short labelled sections: External, Internal, Relationship, Stakes, Ticking clock.",
    "ending": "Write the chosen ending in about 120 words, including the final image. Then list 2 alternative endings, one line each (as a bulleted list), "
              "with why they are weaker for this story.",
    "structure": "{structure_hint} For each act or part: its purpose, the key turning points, and roughly what share of the story it takes.",
    "beats": "A numbered beat sheet from Opening Image to Final Image ({beats} beats, numbered 1., 2., ...). Each beat: a bold name, then 1-2 sentences. "
             "Include a beat that pays off every character arc in the Story Bible, and include the approved ending's key actions exactly as approved.",
    "outline": "A scene-by-scene outline ({scenes_lo}-{scenes_hi} scenes), grouped under act headings. Each scene: a short bold title, the location, and 1-2 sentences. "
               "Every approved beat appears in at least one scene, and every important event has its cause shown in an earlier scene.",
    "story": "The complete story at about {words} words, following the approved outline scene by scene, with every outline scene played out as a scene. "
             "Start with the title as a level-1 heading (`# Title`). End on a strong final image. Format: {format_note}. "
             "If the format note asks for something other than scene-driven prose (for example narration in a documentary), follow the format note.",
}


def _lang(project):
    return (project.get("brief") or {}).get("language", "English")


def _bible_block(project):
    rules = bible.brief_rules(project.get("brief"))
    block = f"<story_bible>\n{bible.render(project)}</story_bible>"
    return block + (f"\n\n<brief_rules>\nThe writer's rules for this story. They apply to every stage, the story and the screenplay:\n{rules}\n</brief_rules>" if rules else "")


def _reads_block(project, stage):
    parts = []
    for name in STAGE_READS[stage]:
        text = bible.approved_text(project, name)
        if text:
            parts.append(f'<approved stage="{name}">\n{text.strip()}\n</approved>')
    return "\n\n".join(parts)


def _guide(project, stage):
    s = sizes(project.get("brief"))
    brief = project.get("brief") or {}
    return STAGE_GUIDE[stage].format(beats=s["beats"], scenes_lo=s["scenes"][0], scenes_hi=s["scenes"][1], words=s["words"],
                                     format_note=FORMAT_NOTES.get(brief.get("content_type"), ""),
                                     structure_hint=STRUCTURE_HINTS.get(brief.get("content_type"), STRUCTURE_HINTS["default"]))


# ---------------------------------------------------------------- notes and stages
def notes_prompt(project):
    brief = project["brief"]
    user = (f"TASK: notes\n\nThe writer's brief:\n{bible.render({'brief': brief, 'stages': {}, 'directions': []}).split('## Approved stages')[0]}\n"
            f"Idea: {brief['idea']}\n\nWrite brief INTERNAL notes on the idea for the next stages: the premise, the protagonist's want, "
            f"clichés to avoid, and 2-3 fresh angles. About 150 words. These are guidance only and are not canon. Write them in English.")
    return WRITER, user


def stage_prompt(project, stage, direction="", rejected=""):
    brief = project["brief"]
    parts = [f"TASK: stage={stage}", f"Write the {STAGE_TITLES[stage].upper()} stage. Write it in {_lang(project)}.", _bible_block(project)]
    if stage == "concept" and project.get("notes"):
        parts.append(f"<idea_notes>\n{project['notes']}\n</idea_notes>")
    reads = _reads_block(project, stage)
    if reads:
        parts.append(reads)
    parts.append(f"INSTRUCTIONS FOR THIS STAGE\n{_guide(project, stage)}")
    if stage != "concept":
        parts.append("Stay consistent with the Story Bible and the approved stages above. Do not contradict a single approved fact.")
    if rejected:
        parts.append(f"The writer REJECTED this earlier draft:\n<rejected>\n{rejected.strip()}\n</rejected>\nWrite a CLEARLY DIFFERENT version, not a light rephrase. "
                     "Keep everything already approved.")
    if direction:
        parts.append(f"The writer's direction for this stage (follow it exactly): {direction.strip()}")
    parts.append(f"Content type: {brief['content_type']}. Genres: {', '.join(brief['genres'])}. Tones: {', '.join(brief['tones'])}.")
    return WRITER, "\n\n".join(parts)


def check_prompt(project, stage, draft):
    extra = {"beats": " Also check that every character arc in the Story Bible has a payoff beat, and that the approved ending's key actions appear exactly as approved.",
             "outline": " Also check that every approved beat appears in a scene, and that every important event has its cause shown in an earlier scene."}.get(stage, "")
    user = (f"TASK: check={stage}\n\n{_bible_block(project)}\n\n{_reads_block(project, stage)}\n\n<draft stage=\"{stage}\">\n{draft.strip()}\n</draft>\n\n"
            "Compare the draft with the Story Bible and the approved stages.\n"
            "1. CONFLICTS: every place the draft contradicts the Bible or itself (two causes for one event, one person in two places, an effect before its cause, "
            f"an object or event with no origin).{extra}\n"
            "2. WARNINGS: important facts that are vague or missing (for example which city), and anything unrealistic for the setting.\n"
            'Reply as JSON: {"conflicts": ["..."], "warnings": ["..."]}. Only real problems; empty lists are a good result. Each item one short sentence.')
    return EDITOR, user


def fix_prompt(project, stage, draft, conflicts):
    items = "\n".join(f"- {c}" for c in conflicts)
    user = (f"TASK: fix={stage}\n\n{_bible_block(project)}\n\n{_reads_block(project, stage)}\n\n<draft stage=\"{stage}\">\n{draft.strip()}\n</draft>\n\n"
            f"These conflicts were found:\n{items}\n\nFix the draft ONCE. Change only what each conflict requires; keep every other word. "
            f"Keep the format and the language ({_lang(project)}). Output ONLY the corrected stage.")
    return WRITER, user


def facts_prompt(project, stage, text):
    user = (f"TASK: facts={stage}\n\n<approved stage=\"{stage}\">\n{text.strip()}\n</approved>\n\n"
            f"Extract up to {MAX_FACTS} short, concrete statements from this approved text that later stages must not contradict: places (which city or town), "
            "who lives where, ages, dates and the time frame; past events and their causes; relationships; how things end; character arcs that must pay off; "
            "important objects and where they came from. One fact per item, no opinions. Use the text exactly as written, do not improve it. "
            f'Write the facts in {_lang(project)}. Reply as JSON: {{"facts": ["..."]}}')
    return EDITOR, user


# ---------------------------------------------------------------- the story, validation, repair, revision
def _per_scene(project):
    s = sizes(project.get("brief"))
    lo, hi = s["scenes"]
    return max(100, int(round(s["words"] / ((lo + hi) / 2), -1)))


def story_prompt(project):
    brief = project["brief"]
    craft = CRAFT_RULES.format(per_scene=_per_scene(project), language=_lang(project))
    parts = ["TASK: story", f"Write the complete STORY. Write it in {_lang(project)}.", _bible_block(project), _reads_block(project, "story"),
             CANON_RULES, FREE_TO_INVENT, f"INSTRUCTIONS\n{_guide(project, 'story')}", craft,
             f"Content type: {brief['content_type']}. Genres: {', '.join(brief['genres'])}. Tones: {', '.join(brief['tones'])}."]
    return WRITER, "\n\n".join(parts)


def _all_approved(project):
    from story.options import STAGES
    return "\n\n".join(f'<approved stage="{s}">\n{bible.approved_text(project, s).strip()}\n</approved>' for s in STAGES if bible.approved_text(project, s))


def judge_prompt(project, story):
    user = f"""TASK: validate

{_bible_block(project)}

{_all_approved(project)}

<story>
{story.strip()}
</story>

Validation answers "does the story faithfully follow the approved canon?", not "is it a good story?". Beautiful writing never compensates for a continuity failure.

1. Build a LEDGER while reading: every named character's status changes (alive/injured/dead and the stated cause) and important locations, in story order; every plot-important object or piece of information (where it first appears, how it is obtained, who has it later); key events as CAUSE -> ACTION -> CONSEQUENCE.
2. Check in this order: a) canon fidelity (motivations, relationships, arcs, backstory facts, conflict and the approved ending match; nothing major added); b) contradictions (the same fact stated two ways); c) causal continuity (capture, arrest, death, rescue or a meaningful arrival with no shown cause is missing_causal_event); d) object/information origin (missing_object_origin / missing_information_origin); e) locations (only plot-important movements or contradictions); f) time order (no consequence before its cause); g) writer directions (nothing the writer removed has come back); h) the brief rules, if there are any (anything the writer asked to avoid, or a break of the audience rule, is brief_violation); i) then prose, emotional development, pacing and escalation.
3. Hard failure types (any one means FAIL): character_contradiction, relationship_contradiction, ending_contradiction, major_event_contradiction, location_contradiction, temporal_contradiction, missing_causal_event, missing_object_origin, missing_information_origin, unauthorized_major_character, unauthorized_major_plot_device, reintroduced_rejected_element, brief_violation. Unclear emotional motivation, pacing and style are WARNINGS, not hard failures. Every hard failure needs evidence (a short quote or paraphrase) and the smallest fix.
4. Score 0-100. With any hard failure the score must be 60 or lower.

Reply as JSON:
{{"ledger": {{"characters": ["..."], "objects_and_information": ["..."], "key_events": ["..."]}},
 "hard_failures": [{{"type": "missing_causal_event", "issue": "...", "evidence": "...", "fix": "..."}}],
 "warnings": [{{"type": "motivation", "issue": "...", "evidence": "...", "fix": "..."}}],
 "strengths": ["..."], "rewrite_notes": ["one concrete instruction per hard failure"], "score": 0, "status": "PASS or FAIL"}}"""
    return EDITOR, user


def repair_prompt(project, story, report):
    problems = "\n".join(f"- [{h['type']}] {h['issue']}" + (f" (evidence: {h['evidence']})" if h["evidence"] else "") + (f" Fix: {h['fix']}" if h["fix"] else "")
                         for h in report["hard_failures"])
    notes = "\n".join(f"- {n}" for n in report["rewrite_notes"])
    words = sizes(project["brief"])["words"]
    user = f"""TASK: repair

{_bible_block(project)}

{_all_approved(project)}

<story>
{story.strip()}
</story>

Validation found these problems:
{problems}
{notes}

REPAIR ONLY THESE PROBLEMS with the smallest necessary correction:
- keep every other sentence exactly as it is;
- fix a missing cause or origin with a 1-3 sentence transition using characters, places and objects already in the canon or the story;
- fix a contradiction by making the story agree with the approved canon (if the canon is silent, with the story's first mention);
- never add a new major character, organization, subplot, chase, threat or deadline;
- keep characters, relationships, motivations, conflict, setting, the approved ending, tone, language ({_lang(project)}) and length (within 10% of the current length; target about {words} words).

{CANON_RULES}

Output ONLY the complete repaired story in Markdown, starting with the `# Title` heading."""
    return WRITER, user


def revise_prompt(project, story, instruction):
    user = f"""TASK: revise

{_bible_block(project)}

{_all_approved(project)}

<story>
{story.strip()}
</story>

The writer asks: {instruction.strip()}

Change ONLY what this instruction requires. Keep canon intact (characters, relationships, motivations, conflict, setting, the approved ending), the language ({_lang(project)}) and the title heading.
{CANON_RULES}

Output ONLY the complete revised story in Markdown, starting with the `# Title` heading."""
    return WRITER, user


# ---------------------------------------------------------------- screenplay
def plan_prompt(project, story):
    pages = sizes(project["brief"])["pages"]
    user = f"""TASK: screenplay-plan

{_bible_block(project)}

{_reads_block(project, 'story')}

<story>
{story.strip()}
</story>

Turn the approved outline into a SCENE LIST for a screenplay of about {pages} pages (maximum {MAX_SCENES} scenes). Keep the outline's order and content; merge tiny moments where natural.
Scene headings and character names in English; summaries in {_lang(project)}.
Reply as JSON: {{"scenes": [{{"heading": "INT. HOMEROOM - NIGHT", "title": "...", "summary": "1-2 lines", "characters": ["NAME"]}}]}}"""
    return EDITOR, user


def scene_prompt(project, plan, i, summaries, prev_tail, words):
    scene = plan[i]
    nxt = plan[i + 1]["title"] if i + 1 < len(plan) else "(this is the last scene)"
    earlier = "\n".join(f"{n + 1}. {s}" for n, s in enumerate(summaries)) or "(none yet: this is the first scene)"
    user = f"""TASK: scene={i + 1}

{_bible_block(project)}

{_reads_block(project, 'story')}

<earlier_scenes>
{earlier}
</earlier_scenes>

<previous_scene_ending>
{prev_tail or '(none)'}
</previous_scene_ending>

Write ONLY scene {i + 1} of {len(plan)}: heading {scene['heading']}, "{scene['title']}": {scene['summary']}
Characters: {', '.join(scene.get('characters') or [])}. Next scene (do not write it): {nxt}. About {words} words. Do not jump ahead.

FORMAT RULES (Fountain)
- Scene heading on its own line, in capitals: INT. or EXT., LOCATION - DAY or NIGHT.
- Action: present tense, short paragraphs (1-4 lines), only what the camera can see or hear. No thoughts or backstory explanations.
- First appearance of a character: NAME IN CAPITALS with age, for example AARAV (25).
- Dialogue: CHARACTER NAME in capitals on its own line, dialogue on the next line. Parentheticals such as (quietly) on their own line, only when needed.
- (V.O.) for voice-over, (O.S.) for off-screen. Transitions (CUT TO:) only when they add meaning.
- Scene headings, character names and action in English; dialogue in {_lang(project)}.
- No markdown, bold, bullets, scene numbers or notes.
{CANON_RULES}"""
    return WRITER, user


def scene_words(project, count):
    pages = sizes(project["brief"])["pages"]
    return max(40, min(1500, round(pages * WORDS_PER_PAGE / max(count, 1))))        # 40 so that a one-page advertisement is not padded to three pages