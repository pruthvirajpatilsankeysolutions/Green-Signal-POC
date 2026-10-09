from datetime import date

import streamlit as st

from posts.event import create
from ui import key_warning, show_draft

st.set_page_config(page_title="Event post", page_icon="📸", layout="wide")
st.title("📸 Event post")
no_claude = key_warning("anthropic")

with st.form("event_form"):
    name = st.text_input("Event name *", placeholder="नवीन आरोग्य केंद्राचे उद्घाटन")
    place = st.text_input("Place *", placeholder="पुणे")
    day = st.date_input("Date *", value=date.today(), format="DD/MM/YYYY")
    guests = st.text_input("Chief guests / who attended")
    points = st.text_area("Key points * (3-5 lines: what happened, what the leader said)", height=140)
    thanks = st.text_input("People to thank")
    photos = st.file_uploader("Photos * (best photo first, up to 10)",
                              type=["jpg", "jpeg", "png", "webp"], accept_multiple_files=True)
    submitted = st.form_submit_button("Create post", type="primary", disabled=no_claude)

if submitted:
    problems = []
    if not name.strip():
        problems.append("Add the event name.")
    if not place.strip():
        problems.append("Add the place.")
    if not points.strip():
        problems.append("Add the key points.")
    if not photos:
        problems.append("Upload at least one photo.")

    if problems:
        for p in problems:
            st.error(p)
    else:
        event = {"name": name.strip(), "place": place.strip(), "date": day.strftime("%d/%m/%Y"),
                 "guests": guests.strip(), "points": points.strip(), "thanks": thanks.strip()}
        with st.spinner("Writing caption and preparing photos..."):
            try:
                paths = create.save_uploads(photos)
                draft = create.make_post(event, paths)
            except Exception as e:
                st.error(f"Could not create the post: {e}")
            else:
                st.success("Post created. It is waiting on the Approvals page.")
                show_draft(draft)
