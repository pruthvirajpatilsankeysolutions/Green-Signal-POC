"""
Reads the festival calendar from data/festivals.csv.

Languages: the base columns (occasion_mr, line_small, line_big, line_end) are Marathi.
For another language add columns with its code, e.g. occasion_hi, line_small_hi, line_big_hi,
line_end_hi (or _en). If a client's language has no poster text, the AI writes it when the
post is made ("needs_text").

Regions: an optional "regions" column (e.g. "MH" or "MH,HI") limits an occasion to clients in
those regions; empty = every region.

Tip: if you edit the CSV in Excel, save it as "CSV UTF-8",
otherwise Indian-language text turns into junk characters.
"""

import csv
from datetime import date, datetime

from config import DATA_DIR
from storage.clients import current

FESTIVALS_FILE = DATA_DIR / "festivals.csv"
REQUIRED = ["id", "date", "occasion_mr", "tone", "line_small", "line_big", "line_end"]
TONES = ["greeting", "tribute", "solemn"]


def _localise(row, lang):
    """Occasion name and poster text in the client's language."""
    row["occasion_marathi"] = row["occasion_mr"]
    if lang == "mr":
        row["occasion_local"], row["needs_text"] = row["occasion_mr"], False
    else:
        row["occasion_local"] = (
            row.get(f"occasion_{lang}") or row.get("occasion_en") or row["occasion_mr"]
        )
        lines = {
            k: row.get(f"{k}_{lang}", "")
            for k in ("line_small", "line_big", "line_end")
        }
        row["needs_text"] = not lines["line_big"]
        row.update(lines)  # empty lines -> the AI writes them in this language
    row["occasion_mr"] = row[
        "occasion_local"
    ]  # older code shows this name: now in the client's language
    row["regions"] = [r.strip() for r in row.get("regions", "").split(",") if r.strip()]
    return row


def load(lang=None):
    """Return (festivals, errors) in the current client's language. Each festival is a dict, sorted by date."""
    lang = lang or current()["language"]
    festivals, errors = [], []
    if not FESTIVALS_FILE.exists():
        return [], [f"File not found: {FESTIVALS_FILE}"]

    # utf-8-sig also handles the hidden marker Excel adds at the start
    with open(FESTIVALS_FILE, encoding="utf-8-sig", newline="") as f:
        for line_no, raw in enumerate(csv.DictReader(f), start=2):
            row = {k.strip(): (v or "").strip() for k, v in raw.items() if k}

            missing = [col for col in REQUIRED if not row.get(col)]
            if missing:
                errors.append(f"Row {line_no}: missing {', '.join(missing)}")
                continue
            try:
                day = datetime.strptime(row["date"], "%Y-%m-%d").date()
            except ValueError:
                errors.append(f"Row {line_no}: date must look like 2026-11-08")
                continue
            if row["tone"] not in TONES:
                errors.append(f"Row {line_no}: tone must be one of {', '.join(TONES)}")
                continue

            row["date_obj"] = day
            row["days_left"] = (day - date.today()).days
            row["lead_days"] = int(row.get("lead_days") or 2)
            festivals.append(_localise(row, lang))

    festivals.sort(key=lambda r: r["date_obj"])
    return festivals, errors


def due_now(festivals):
    """Festivals whose poster should be made now (inside the lead days)."""
    return [f for f in festivals if 0 <= f["days_left"] <= f["lead_days"]]
