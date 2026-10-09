"""
Reads the festival calendar from data/festivals.csv.

Tip: if you edit the CSV in Excel, save it as "CSV UTF-8",
otherwise Marathi text turns into junk characters.
"""
import csv
from datetime import date, datetime

from config import DATA_DIR

FESTIVALS_FILE = DATA_DIR / "festivals.csv"
REQUIRED = ["id", "date", "occasion_mr", "tone", "line_small", "line_big", "line_end"]
TONES = ["greeting", "tribute", "solemn"]


def load():
    """Return (festivals, errors). Each festival is a dict, sorted by date."""
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
            festivals.append(row)

    festivals.sort(key=lambda r: r["date_obj"])
    return festivals, errors


def due_now(festivals):
    """Festivals whose poster should be made now (inside the lead days)."""
    return [f for f in festivals if 0 <= f["days_left"] <= f["lead_days"]]