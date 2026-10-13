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
    "Kalam-Regular.ttf": "kalam/Kalam-Regular.ttf",
    "Kalam-Bold.ttf": "kalam/Kalam-Bold.ttf",
    # more Marathi fonts for the editor (tested: they join Marathi letters correctly)
    "Poppins-Regular.ttf": "poppins/Poppins-Regular.ttf",
    "Poppins-Bold.ttf": "poppins/Poppins-Bold.ttf",
    "Hind-Regular.ttf": "hind/Hind-Regular.ttf",
    "Hind-Bold.ttf": "hind/Hind-Bold.ttf",
    "NotoSansDevanagari-Variable.ttf": "notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf",
    "Yantramanav-Bold.ttf": "yantramanav/Yantramanav-Bold.ttf",
    "Khand-Bold.ttf": "khand/Khand-Bold.ttf",
    "Rajdhani-Bold.ttf": "rajdhani/Rajdhani-Bold.ttf",
    "Modak-Regular.ttf": "modak/Modak-Regular.ttf",
    "BalooBhai2-Variable.ttf": "baloobhai2/BalooBhai2%5Bwght%5D.ttf",
    "Laila-Bold.ttf": "laila/Laila-Bold.ttf",
    "TiroDevanagariMarathi-Regular.ttf": "tirodevanagarimarathi/TiroDevanagariMarathi-Regular.ttf",
    "NotoSerifDevanagari-Variable.ttf": "notoserifdevanagari/NotoSerifDevanagari%5Bwdth,wght%5D.ttf",
    "Halant-Bold.ttf": "halant/Halant-Bold.ttf",
    "Gotu-Regular.ttf": "gotu/Gotu-Regular.ttf",
    "Glegoo-Bold.ttf": "glegoo/Glegoo-Bold.ttf",
    # English-only display fonts
    "Montserrat-Variable.ttf": "montserrat/Montserrat%5Bwght%5D.ttf",
    "PlayfairDisplay-Variable.ttf": "playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
    "Oswald-Variable.ttf": "oswald/Oswald%5Bwght%5D.ttf",
    "BebasNeue-Regular.ttf": "bebasneue/BebasNeue-Regular.ttf",
    "Lobster-Regular.ttf": "lobster/Lobster-Regular.ttf",
    "Pacifico-Regular.ttf": "pacifico/Pacifico-Regular.ttf",
    "DancingScript-Variable.ttf": "dancingscript/DancingScript%5Bwght%5D.ttf",
    "GreatVibes-Regular.ttf": "greatvibes/GreatVibes-Regular.ttf",
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
