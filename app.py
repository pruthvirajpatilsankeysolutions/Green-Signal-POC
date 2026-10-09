"""
Start the app:   streamlit run app.py
"""
import streamlit as st

from config import CLIENT
from storage import drafts, festivals
from ui import missing_keys

st.set_page_config(page_title="Social post assistant", page_icon="🪔", layout="wide")

st.title("Social post assistant")
st.write(f"Festival, event and news posts for **{CLIENT['name']}**. "
         "Every post waits for approval before it is used.")

missing = missing_keys("anthropic", "openai")
if missing:
    st.warning(f"Missing in .env: {', '.join(missing)}. "
               "Claude is needed for captions; OpenAI only for AI pictures.")

rows, errors = festivals.load()
for error in errors:
    st.warning(f"festivals.csv: {error}")

c1, c2, c3 = st.columns(3)
c1.metric("Waiting for approval", len(drafts.by_status("waiting")))
c2.metric("Approved", len(drafts.by_status("approved")))
c3.metric("Festivals due now", len(festivals.due_now(rows)))

st.markdown("""
#### How to use
1. **Festival** – pick an occasion, choose or generate a background picture, create the poster.
2. **Event** – fill in what happened, upload photos, create the post.
3. **Reaction** – type one line about the news, add the link, check facts, create the post.
4. **Approvals** – the client approves, or asks for a change and the caption is rewritten.
5. **History** – every post and its status.

Use the menu on the left to open a page.
""")
