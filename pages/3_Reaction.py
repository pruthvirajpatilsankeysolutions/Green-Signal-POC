import uuid

import streamlit as st

from config import OUTPUT_DIR
from posts.reaction import create
from ui import key_warning, show_draft

st.set_page_config(page_title="Reaction post", page_icon="🏆", layout="wide")
st.title("🏆 Reaction post")
st.caption("For sports wins, awards, national achievements or condolences. "
           "Political or controversial news is blocked; write those by hand.")
no_claude = key_warning("anthropic")

TONE_NAMES = {"congratulate": "Congratulate", "condolence": "Condolence", "support": "Support"}
tone = st.radio("Type", create.TONES, format_func=TONE_NAMES.get, horizontal=True)
team_line = st.text_input("What happened (one line) *",
                          placeholder="India won Asian Games hockey gold, beat Japan 5-1")
url = st.text_input("News link")
pasted = st.text_area("Or paste the news text (if the link does not open)", height=110)
mention = st.text_input("Mention specially (optional)", placeholder="e.g. players from Maharashtra")

memories = ""
if tone == "condolence":
    memories = st.text_area(
        "Leader's personal memories (optional)",
        height=120,
        placeholder="Only real memories from the leader or his office, e.g. when they last met, "
                    "what the person said to him. Leave empty if he did not know them personally.",
        help="The AI only arranges these words. It never invents memories.")

photo_help = ("Condolence: a real photo of the leader with the person works best. "
              if tone == "condolence" else
              "Use the real photo(s) of the win: official team/federation photos. ")
photos = st.file_uploader("Photos (recommended, up to 10)", type=["jpg", "jpeg", "png", "webp"],
                          accept_multiple_files=True,
                          help=photo_help + "Without photos, a simple card with the banner is made.")
rights = True
if photos:
    rights = st.checkbox("We have the right to use these photos (not TV or broadcast screenshots)")

# ---------------- step 1: facts ----------------
if st.button("1. Check facts", disabled=no_claude):
    if not team_line.strip() or not (url.strip() or pasted.strip()):
        st.error("Add the one-line summary and a news link (or paste the news text).")
    else:
        with st.spinner("Reading the news..."):
            try:
                checked = create.check_facts(team_line, url.strip(), pasted)
                st.session_state["reaction"] = {"line": team_line, "checked": checked}
            except Exception as e:
                st.error(f"Could not check the news: {e}")

state = st.session_state.get("reaction")
if state and state["line"] == team_line:
    checked = state["checked"]
    if checked["blocked"]:
        st.error(f"Blocked: {checked['blocked']}. This topic needs a hand-written post.")
    else:
        st.subheader("Facts found in the news")
        for key, value in checked["facts"].items():
            if value not in (None, "", []):
                st.markdown(f"**{key}:** {', '.join(value) if isinstance(value, list) else value}")
        for m in checked["mismatches"]:
            st.warning(f"You wrote {m}, but the news does not mention it. Check before continuing.")

        # ---------------- step 2: post ----------------
        if photos and not rights:
            st.info("Tick the photo-rights box, or remove the photos.")
        st.caption("With photos: the post uses the real photos only (no banner, no text). "
                   "Without photos: a simple card with the banner.")
        if st.button("2. Create post", type="primary", disabled=bool(photos and not rights)):
            photo_paths = []
            if photos:
                folder = OUTPUT_DIR / "uploads"
                folder.mkdir(parents=True, exist_ok=True)
                for p in photos[:10]:
                    path = folder / f"reaction_{uuid.uuid4().hex[:6]}_{p.name}"
                    path.write_bytes(p.getvalue())
                    photo_paths.append(str(path))
            with st.spinner("Writing caption..."):
                try:
                    draft = create.make_post(team_line, tone, mention, checked,
                                             photo_paths, memories)
                except Exception as e:
                    st.error(f"Could not create the post: {e}")
                else:
                    st.success("Post created. It is waiting on the Approvals page.")
                    show_draft(draft)