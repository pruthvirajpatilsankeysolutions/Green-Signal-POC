"""
Run once after installing:   python setup_assets.py
Creates folders and downloads the free Marathi fonts (Mukta, Rozha One).
"""
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
FONTS = {
    "Mukta-Regular.ttf": "mukta/Mukta-Regular.ttf",
    "Mukta-SemiBold.ttf": "mukta/Mukta-SemiBold.ttf",
    "Mukta-ExtraBold.ttf": "mukta/Mukta-ExtraBold.ttf",
    "RozhaOne-Regular.ttf": "rozhaone/RozhaOne-Regular.ttf",
    "Baloo2-Variable.ttf": "baloo2/Baloo2%5Bwght%5D.ttf",
    "Kalam-Bold.ttf": "kalam/Kalam-Bold.ttf",
}
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

for folder in ["assets/fonts", "assets/leader", "assets/logo", "assets/backgrounds",
               "data", "output"]:
    (ROOT / folder).mkdir(parents=True, exist_ok=True)

for name, path in FONTS.items():
    target = ROOT / "assets" / "fonts" / name
    if target.exists():
        print(f"ok      {name}")
        continue
    r = requests.get(BASE + path, timeout=30)
    r.raise_for_status()
    target.write_bytes(r.content)
    print(f"saved   {name}")

if not (ROOT / ".env").exists():
    print("\nNext: copy .env.example to .env and add your API keys.")
print("Done.")
