import streamlit as st

from storage import drafts

st.set_page_config(page_title="History", page_icon="📋", layout="wide")
st.title("📋 History")

rows = [{
    "Created": d["created_at"],
    "Type": d["type"],
    "Title": d["title"],
    "Status": d["status"],
    "Version": d["version"],
    "Approved": d["approved_at"],
} for d in drafts.load_all()]

if rows:
    st.dataframe(rows, hide_index=True)
else:
    st.info("No posts yet.")
