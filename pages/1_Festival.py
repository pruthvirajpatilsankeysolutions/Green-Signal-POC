import uuid

import streamlit as st

from config import OUTPUT_DIR
from posts.festival import create
from storage import festivals as festival_store
from ui import key_warning, missing_keys, show_draft

st.set_page_config(page_title="Festival posts", page_icon="🪔", layout="wide")
st.title("🪔 Festival posts")
no_claude = key_warning("anthropic")

rows, errors = festival_store.load()
for error in errors:
    st.warning(f"festivals.csv: {error}")
if not rows:
    st.info("Add occasions to data/festivals.csv to start.")
    st.stop()

due = festival_store.due_now(rows)
if due:
    st.success(
        "Due now: " + ", ".join(f"{f['occasion_mr']} ({f['date']})" for f in due)
    )


def label(f):
    d = f["days_left"]
    when = "today" if d == 0 else (f"in {d} days" if d > 0 else f"{-d} days ago")
    return f"{f['occasion_mr']}  |  {f['date']}  |  {when}"


# upcoming first, past ones at the end
ordered = sorted(rows, key=lambda f: (f["days_left"] < 0, abs(f["days_left"])))
fest = st.selectbox("Occasion", ordered, format_func=label)
fid = fest["id"]

info, note = st.columns([2, 1])
info.markdown(
    f"**Tone:** {fest['tone']}  \n"
    f"**Poster text:** {fest['line_small']} / {fest['line_big']} / {fest['line_end']}"
)
if fest.get("notes"):
    note.info(fest["notes"])

LAYOUTS = {
    "text_right": "Text right",
    "text_left": "Text left",
    "text_center": "Centre (light design)",
}
default_layout = {
    "right": "text_right",
    "left": "text_left",
    "center": "text_center",
}.get(fest.get("layout", "").lower(), "text_right")
if fest["tone"] in ("tribute", "solemn"):
    st.caption(
        "Jayanti / punyatithi posts always use the tribute design (portrait right, text left)."
    )
layout = st.radio(
    "Layout",
    list(LAYOUTS),
    format_func=LAYOUTS.get,
    horizontal=True,
    index=list(LAYOUTS).index(default_layout),
    key=f"layout_{fid}",
)
# ---------------- step 1: background ----------------
st.subheader("1. Choose the background picture")
options_key = f"bg_{fid}"
st.session_state.setdefault(options_key, [])

gen_col, up_col = st.columns([1, 2])
no_openai = bool(missing_keys("openai"))
if gen_col.button(
    "✨ Make 4 AI pictures",
    disabled=no_openai or no_claude,
    help="Needs OPENAI_API_KEY" if no_openai else None,
):
    with st.spinner("Painting 4 pictures, about 1 minute..."):
        try:
            paths = create.generate_background_options(fest, layout)
            st.session_state[options_key] = paths + st.session_state[options_key]
        except Exception as e:
            st.error(f"Could not make pictures: {e}")

upload = up_col.file_uploader(
    "Or upload a picture", type=["png", "jpg", "jpeg", "webp"], key=f"upload_{fid}"
)
if upload:
    folder = OUTPUT_DIR / "uploads"
    folder.mkdir(parents=True, exist_ok=True)
    path = (
        folder
        / f"bg_{upload.file_id if hasattr(upload, 'file_id') else uuid.uuid4().hex[:6]}_{upload.name}"
    )
    if not path.exists():
        path.write_bytes(upload.getvalue())
    if str(path) not in st.session_state[options_key]:
        st.session_state[options_key].insert(0, str(path))

all_options = st.session_state[options_key] + [
    p for p in create.ready_backgrounds(fest) if p not in st.session_state[options_key]
]

if not all_options:
    st.info(
        f"No picture yet. Make AI pictures, upload one, or save a file named "
        f"'{fid}.png' in assets/backgrounds."
    )
else:
    cols = st.columns(4)
    for i, path in enumerate(all_options[:8]):
        with cols[i % 4]:
            st.image(path)
            if st.button("Use this", key=f"use_{fid}_{i}"):
                st.session_state[f"chosen_{fid}"] = path

# ---------------- step 2: poster ----------------
st.subheader("2. Create the poster")
chosen = st.session_state.get(f"chosen_{fid}")
if not chosen:
    st.caption("Pick a picture above first.")
else:
    st.image(chosen, width=220)
    ai_made = st.checkbox(
        "This picture was made by AI (adds a small 'AI-Generated' label)", value=True
    )
    if st.button("Create poster", type="primary", disabled=no_claude):
        with st.spinner("Writing caption and making the poster..."):
            try:
                draft = create.make_post(fest, chosen, ai_made, layout)
            except Exception as e:
                st.error(f"Could not create the poster: {e}")
            else:
                st.success("Poster created. It is waiting on the Approvals page.")
                show_draft(draft)
