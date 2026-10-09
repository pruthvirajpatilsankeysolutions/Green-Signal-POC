"""
Rewrites a caption when the client asks for a change on the Approvals page.
"""
from ai.claude import ask_json
from posts import COMMON_RULES, client_intro, final_hashtags, marathi_digits, style_kind
from posts.reaction.checks import unknown_numbers
from storage import drafts


def rewrite(draft, instruction):
    kind = style_kind(draft["type"], draft["details"].get("tone", ""))
    system = client_intro(kind) + COMMON_RULES + (
        "\nYou are editing an existing caption. Apply the client's change exactly. "
        "Keep everything else the same, including the structure and hashtag language. "
        'Return JSON: {"caption": "...", "hashtags": ["#..."]}'
    )
    user = (
        f"Current caption:\n{draft['caption']}\n\n"
        f"Current hashtags: {' '.join(draft['hashtags'])}\n\n"
        f"Client's change: {instruction}"
    )
    allowed = {}
    if draft["type"] == "reaction":
        allowed = {**draft["details"].get("facts", {}),
                   "memories": draft["details"].get("memories", ""),
                   "current": draft["caption"]}
        user += f"\n\nAllowed facts (use nothing else): {allowed}"

    result = ask_json(system, user)
    caption = result["caption"].strip()

    # For news posts: never let a new number slip in that isn't in the news
    if draft["type"] == "reaction":
        bad = unknown_numbers(caption, allowed)
        if bad:
            raise ValueError(f"Rewrite added numbers not in the news: {', '.join(bad)}. Try again.")

    hashtags = [] if draft["details"].get("tone") == "condolence" else final_hashtags(result.get("hashtags"))
    return drafts.update(
        draft["id"],
        event=f"rewritten: {instruction}",
        caption=marathi_digits(caption),
        hashtags=hashtags,
        version=draft["version"] + 1,
    )