"""
Prompt for event coverage posts (inauguration, meeting, visit, rally...).
"""
from posts import COMMON_RULES, client_intro


def caption_prompt(event):
    system = client_intro() + COMMON_RULES + (
        "\nThis is a post about an event the leader attended.\n"
        "Structure: what happened and where -> why it matters for people -> thanks.\n"
        "Length: 3 to 6 short lines, maximum 90 words.\n"
        "Also give a short poster title (max 6 words) for the first photo.\n"
        "List any important missing details in 'confirm' (empty list if none).\n"
        'Return JSON: {"caption": "...", "hashtags": ["#..."], '
        '"poster_title": "...", "confirm": ["..."]}'
    )
    user = (
        f"Event: {event['name']}\n"
        f"Place: {event['place']}\n"
        f"Date: {event['date']}\n"
        f"Chief guests / who attended: {event.get('guests') or 'not given'}\n"
        f"Key points (from the team):\n{event['points']}\n"
        f"People to thank: {event.get('thanks') or 'not given'}"
    )
    return system, user
