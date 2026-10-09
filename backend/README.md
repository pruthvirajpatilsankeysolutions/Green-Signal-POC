# Social post assistant (POC)

Makes festival, event and news-reaction posts in Marathi for a politician.
Claude writes captions, OpenAI paints background pictures, the app builds the
poster, and the client approves before anything is used.

## Setup (once)

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium        # hidden browser that makes the PNGs
python setup_assets.py             # folders + Marathi fonts
cp .env.example .env               # then put your API keys in .env
```

## Add the client's details

| What | Where |
|---|---|
| Name, designation, handle, colour, past captions | `config.py` |
| Party logo (PNG, transparent) | `assets/logo/logo.png` |
| 5-10 leader cutout photos (PNG, transparent) | `assets/leader/` |
| Festival dates and poster text | `data/festivals.csv` (save as **CSV UTF-8**) |
| Ready background pictures (optional) | `assets/backgrounds/<festival-id>.png` |

## Run

```bash
streamlit run app.py
```

Opens in your browser at http://localhost:8501

## Folder map

```
app.py            home page
pages/            one file per screen (festival, event, reaction, approvals, history)
posts/            what to make for each post type
ai/               Claude (text) and OpenAI (pictures)
design/           poster templates (HTML) and the PNG maker
storage/          festivals.csv reader, drafts.json saver
```

## Rules built in

- The AI paints only the background. Text, leader photo and logo are added by code.
- Solemn days (punyatithi) get a muted poster and no "शुभेच्छा".
- News posts: facts come only from the article, numbers are checked by code,
  political/controversial topics are blocked.
- AI backgrounds get a small "AI-Generated" label (switch in `config.py`).
