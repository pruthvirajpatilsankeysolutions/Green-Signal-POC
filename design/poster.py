"""
Turns an HTML template into a PNG poster.

How: fill the template with data (Jinja), open it in a hidden Chrome
(Playwright), wait for fonts and text-fitting, take a screenshot.
"""
import asyncio
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image
from playwright.sync_api import sync_playwright

from config import (AI_LABEL_TEXT, ASSETS_DIR, CLIENT, LEADER_BUST, OUTPUT_DIR, ROOT,
                    SHOW_AI_LABEL, SIZES, TEMPLATES_DIR)

_env = Environment(loader=FileSystemLoader(TEMPLATES_DIR),
                   autoescape=select_autoescape(["html"]))

IMAGE_TYPES = (".png", ".jpg", ".jpeg", ".webp")


def file_uri(path):
    """Local file -> file:// link the browser can load ('' if missing)."""
    if not path:
        return ""
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / p
    return p.resolve().as_uri() if p.exists() else ""


FONTS = {
    "mukta": file_uri(ASSETS_DIR / "fonts" / "Mukta-Regular.ttf"),
    "mukta_semibold": file_uri(ASSETS_DIR / "fonts" / "Mukta-SemiBold.ttf"),
    "mukta_extrabold": file_uri(ASSETS_DIR / "fonts" / "Mukta-ExtraBold.ttf"),
    "rozha": file_uri(ASSETS_DIR / "fonts" / "RozhaOne-Regular.ttf"),
}


def leader_photos():
    folder = ROOT / CLIENT["leader_photos_dir"]
    if not folder.exists():
        return []
    return sorted(str(p) for p in folder.iterdir() if p.suffix.lower() in IMAGE_TYPES)


def pick_leader_photo(turn):
    """Rotate through the leader photos so the same one doesn't repeat."""
    photos = leader_photos()
    return photos[turn % len(photos)] if photos else ""


def _content_box(img, pad_ratio=0.03):
    """Box around the non-white content of an image, with a little padding."""
    box = img.convert("L").point(lambda v: 255 if v < 235 else 0).getbbox()
    if not box:
        return (0, 0, img.width, img.height)
    pad = int(img.height * pad_ratio)
    return (max(0, box[0] - pad), max(0, box[1] - pad),
            min(img.width, box[2] + pad), min(img.height, box[3] + pad))


def _white_to_transparent(img):
    """Make the near-white background of a banner part transparent (soft edges)."""
    rgba = img.convert("RGBA")
    light = img.convert("L")
    # brightness 225 or less stays solid, 250+ becomes fully transparent
    alpha = light.point(lambda v: 255 if v <= 225 else (0 if v >= 250 else int((250 - v) * 255 / 25)))
    rgba.putalpha(alpha)
    return rgba


def prepare_footer_image():
    """
    Split the footer banner into its two parts, like the client's posts:
      logo part (left)  +  name/designation text (shown centred on the poster).
    Returns dict with paths and width/height ratios, or {} if no banner.
    If the banner can't be split, the whole banner is returned as "full".
    """
    src = CLIENT.get("footer_image") or ""
    if not src:
        return {}
    p = Path(src) if Path(src).is_absolute() else ROOT / src
    if not p.exists():
        return {}

    cache = OUTPUT_DIR / "_cache"
    cache.mkdir(parents=True, exist_ok=True)
    stamp = f"{p.stem}_{int(p.stat().st_mtime)}"
    logo_path, text_path = cache / f"footer_logo2_{stamp}.png", cache / f"footer_text2_{stamp}.png"
    full_path = cache / f"footer_full2_{stamp}.png"

    if not (full_path.exists()):
        img = Image.open(p).convert("RGB")
        img = img.crop(_content_box(img, 0.015))
        img.save(full_path)

        # find the empty vertical gap between the logo and the text (15%-55% of width)
        mask = img.convert("L").point(lambda v: 255 if v < 235 else 0)
        has_ink = [mask.crop((x, 0, x + 1, img.height)).getbbox() is not None
                   for x in range(img.width)]
        best, start = (0, 0), None
        for x in range(int(img.width * 0.15), int(img.width * 0.55)):
            if not has_ink[x]:
                start = x if start is None else start
                if x - start > best[1] - best[0]:
                    best = (start, x)
            else:
                start = None
        if best[1] - best[0] > img.width * 0.02:
            logo = img.crop((0, 0, best[0], img.height))
            text = img.crop((best[1], 0, img.width, img.height))
            _white_to_transparent(logo.crop(_content_box(logo, 0.02))).save(logo_path)
            _white_to_transparent(text.crop(_content_box(text, 0.02))).save(text_path)

    def ratio(path):
        with Image.open(path) as im:
            return im.width / im.height

    # the banner's own background colour (from its corner), used behind a full banner
    with Image.open(full_path) as im:
        r, g, b = im.convert("RGB").getpixel((2, 2))
    bg = f"#{r:02x}{g:02x}{b:02x}"

    if logo_path.exists() and text_path.exists():
        return {"logo": str(logo_path), "logo_ratio": ratio(logo_path),
                "text": str(text_path), "text_ratio": ratio(text_path), "bg": "#ffffff"}
    return {"full": str(full_path), "bg": bg}


def prepare_leader_photo(path):
    """
    Make a chest-up "bust" of the leader cutout, like the client's banner:
    cut empty transparent space, keep head to chest (LEADER_BUST of the height),
    and centre the width on the face. Returns (path, width/height).
    """
    if not path or not Path(path).exists():
        return "", 1
    p = Path(path)
    keep = LEADER_BUST
    cache = OUTPUT_DIR / "_cache"
    cache.mkdir(parents=True, exist_ok=True)
    trimmed = cache / f"leader_{p.stem}_{int(p.stat().st_mtime)}_{int(keep * 100)}.png"

    if not trimmed.exists():
        img = Image.open(p).convert("RGBA")
        alpha = img.getchannel("A").point(lambda a: 255 if a > 20 else 0)
        box = alpha.getbbox()
        if box:
            img, alpha = img.crop(box), alpha.crop(box)

        # 1) keep head to chest
        bust_h = int(img.height * keep)
        img, alpha = img.crop((0, 0, img.width, bust_h)), alpha.crop((0, 0, img.width, bust_h))

        # 2) centre the width on the head (found just below the top of the head)
        head = alpha.crop((0, int(bust_h * 0.03), img.width, int(bust_h * 0.15))).getbbox()
        centre = (head[0] + head[2]) // 2 if head else img.width // 2
        width = min(img.width, int(bust_h * 1.15))
        left = max(0, min(img.width - width, centre - width // 2))
        img = img.crop((left, 0, left + width, bust_h))
        img.save(trimmed)

    with Image.open(trimmed) as im:
        width, height = im.size
    return str(trimmed), width / height


def footer_data(leader_photo=""):
    """Data every template needs for the footer."""
    banner = prepare_footer_image()
    leader_path, leader_ratio = prepare_leader_photo(leader_photo)
    return {
        "client": CLIENT,
        "accent": CLIENT["accent_color"],
        "logo_uri": file_uri(CLIENT["logo"]),
        "leader_uri": file_uri(leader_path),
        "leader_ratio": leader_ratio,          # photo width / height
        "initial": CLIENT["name"][:1],
        # banner: either split into logo + centred text, or one full image
        "footer_img_uri": file_uri(banner.get("full") or banner.get("text", "")),
        "footer_logo_uri": file_uri(banner.get("logo", "")),
        "footer_logo_ratio": banner.get("logo_ratio", 1),
        "footer_text_uri": file_uri(banner.get("text", "")),
        "footer_text_ratio": banner.get("text_ratio", 1),
        "footer_bg": banner.get("bg", "#ffffff"),
    }


def ai_label(ai_generated):
    return AI_LABEL_TEXT if (ai_generated and SHOW_AI_LABEL) else ""


def _screenshot_all(jobs):
    """Runs in its own thread so it doesn't clash with Streamlit."""
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    warnings = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for html_path, out_path, width, height in jobs:
                page = browser.new_page(viewport={"width": width, "height": height})
                page.goto(Path(html_path).as_uri())
                page.wait_for_function("window.__layoutDone === true", timeout=20000)
                for problem in page.evaluate("window.__overflow || []"):
                    warnings.append(f"Text did not fit ({Path(out_path).name}): {problem}")
                page.screenshot(path=str(out_path))
                page.close()
        finally:
            browser.close()
    return warnings


def render(template, data, name, sizes=("feed",)):
    """
    Make PNG posters from one template.
    Returns (list of PNG paths, list of warnings).
    """
    html_dir = OUTPUT_DIR / "_html"
    out_dir = OUTPUT_DIR / "posters"
    html_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    name = f"{name}_{uuid.uuid4().hex[:5]}"
    jobs, outputs = [], []
    for size in sizes:
        width, height = SIZES[size]
        html = _env.get_template(template).render(
            **data, W=width, H=height, size=size, fonts=FONTS)
        html_path = html_dir / f"{name}_{size}.html"
        html_path.write_text(html, encoding="utf-8")
        out_path = out_dir / f"{name}_{size}.png"
        jobs.append((html_path, out_path, width, height))
        outputs.append(str(out_path))

    with ThreadPoolExecutor(max_workers=1) as pool:
        warnings = pool.submit(_screenshot_all, jobs).result()
    return outputs, warnings