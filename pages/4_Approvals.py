from pathlib import Path

import streamlit as st

from posts.rewrite import rewrite
from storage import drafts
from ui import show_draft, show_images

st.set_page_config(page_title="Approvals", page_icon="✅", layout="wide")
st.title("✅ Approvals")

waiting = drafts.by_status("waiting")
if not waiting:
    st.info("Nothing is waiting. New posts appear here after you create them.")

for d in waiting:
    with st.container(border=True):
        st.subheader(d["title"])
        st.caption(f"{d['type']} post  |  version {d['version']}  |  created {d['created_at']}")
        show_draft(d)

        left, right = st.columns([1, 3])
        if left.button("Approve", key=f"approve_{d['id']}", type="primary"):
            drafts.approve(d["id"])
            st.rerun()
        if left.button("Reject", key=f"reject_{d['id']}"):
            drafts.reject(d["id"])
            st.rerun()

        change = right.text_input("What should change in the caption?", key=f"change_{d['id']}",
                                  placeholder="उदा. शेतकऱ्यांचा उल्लेख करा")
        if right.button("Rewrite caption", key=f"rewrite_{d['id']}"):
            if not change.strip():
                right.warning("Type what should change first.")
            else:
                with st.spinner("Rewriting..."):
                    try:
                        rewrite(d, change.strip())
                        st.rerun()
                    except Exception as e:
                        right.error(f"Could not rewrite: {e}")
        right.caption("To change text on the poster itself, edit festivals.csv and create it again.")

st.divider()
st.header("Approved, ready to post")
approved = drafts.by_status("approved")
if not approved:
    st.caption("No approved posts yet.")

for d in approved[:15]:
    with st.expander(f"{d['title']}  (approved {d['approved_at']})"):
        show_images(d["images"])
        st.code(d["caption"] + "\n\n" + " ".join(d["hashtags"]), language=None)  # has a copy button
        for i, path in enumerate(d["images"]):
            p = Path(path)
            if p.exists():
                st.download_button(f"Download {p.name}", data=p.read_bytes(), file_name=p.name,
                                   mime="image/png", key=f"dl_{d['id']}_{i}")
