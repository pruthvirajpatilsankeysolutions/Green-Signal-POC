"""
Small helpers used by the app pages (not a page itself).
"""

import os
from pathlib import Path

import streamlit as st

import config  # noqa: F401  (loads .env)

KEY_NAMES = {"anthropic": "GEMINI_API_KEY", "openai": "OPENAI_API_KEY"}


def missing_keys(*services):
    return [KEY_NAMES[s] for s in services if not os.getenv(KEY_NAMES[s])]


def key_warning(*services):
    """Show a warning if API keys are missing. Returns True if something is missing."""
    missing = missing_keys(*services)
    if missing:
        st.warning(f"Add {', '.join(missing)} to the .env file, then restart the app.")
    return bool(missing)


def show_images(paths):
    paths = [p for p in paths if Path(p).exists()]
    if not paths:
        st.caption("Image files not found.")
        return
    cols = st.columns(min(len(paths), 4))
    for i, path in enumerate(paths):
        cols[i % len(cols)].image(path)


def show_draft(draft):
    show_images(draft["images"])
    st.markdown("**Caption**")
    # escape '#' so Marathi hashtags at the start of a line don't become big headings
    st.markdown(draft["caption"].replace("#", "\\#").replace("\n", "  \n"))
    if draft["hashtags"]:
        st.markdown(" ".join(draft["hashtags"]).replace("#", "\\#"))
    for warning in draft.get("warnings", []):
        st.warning(warning)
