"""
Turns an HTML template into a PNG poster.

How: fill the template with data (Jinja), open it in a hidden Chrome
(Playwright), wait for fonts and text-fitting, take a screenshot.
"""

import asyncio
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image
from playwright.sync_api import sync_playwright

from config import (
    AI_LABEL_TEXT,
    ASSETS_DIR,
    LEADER_BUST,
    OUTPUT_DIR,
    ROOT,
    SIZES,
    TEMPLATES_DIR,
)
from storage.clients import current
from storage.languages import poster_words

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR), autoescape=select_autoescape(["html"])
)

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
    "baloo": file_uri(
        ASSETS_DIR / "fonts" / "Baloo2-Variable.ttf"
    ),  # bold festive titles
    "kalam": file_uri(ASSETS_DIR / "fonts" / "Kalam-Bold.ttf"),  # calligraphic wishes
}


def leader_photos():
    """The current client's leader photos (uploaded on the Clients page)."""
    return [p for p in current()["leader_photos"] if Path(p).exists()]


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
    return (
        max(0, box[0] - pad),
        max(0, box[1] - pad),
        min(img.width, box[2] + pad),
        min(img.height, box[3] + pad),
    )


def _white_to_transparent(img):
    """Make the near-white background of a banner part transparent (soft edges)."""
    rgba = img.convert("RGBA")
    light = img.convert("L")
    # brightness 225 or less stays solid, 250+ becomes fully transparent
    alpha = light.point(
        lambda v: 255 if v <= 225 else (0 if v >= 250 else int((250 - v) * 255 / 25))
    )
    rgba.putalpha(alpha)
    return rgba


def prepare_footer_image():
    """
    Split the footer banner into its two parts, like the client's posts:
      logo part (left)  +  name/designation text (shown centred on the poster).
    Returns dict with paths and width/height ratios, or {} if no banner.
    If the banner can't be split, the whole banner is returned as "full".
    """
    client = current()
    src = client.get("footer_image") or ""
    if not src:
        return {}
    p = Path(src) if Path(src).is_absolute() else ROOT / src
    if not p.exists():
        return {}

    cache = OUTPUT_DIR / "_cache"
    cache.mkdir(parents=True, exist_ok=True)
    stamp = f"{client['id']}_{p.stem}_{int(p.stat().st_mtime)}"
    logo_path, text_path = (
        cache / f"footer_logo2_{stamp}.png",
        cache / f"footer_text2_{stamp}.png",
    )
    full_path = cache / f"footer_full2_{stamp}.png"

    if not (full_path.exists()):
        img = Image.open(p).convert("RGB")
        img = img.crop(_content_box(img, 0.015))
        img.save(full_path)

        # find the empty vertical gap between the logo and the text (15%-55% of width)
        mask = img.convert("L").point(lambda v: 255 if v < 235 else 0)
        has_ink = [
            mask.crop((x, 0, x + 1, img.height)).getbbox() is not None
            for x in range(img.width)
        ]
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
        return {
            "logo": str(logo_path),
            "logo_ratio": ratio(logo_path),
            "text": str(text_path),
            "text_ratio": ratio(text_path),
            "bg": "#ffffff",
        }
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
        img, alpha = img.crop((0, 0, img.width, bust_h)), alpha.crop(
            (0, 0, img.width, bust_h)
        )

        # 2) centre the width on the head (found just below the top of the head)
        head = alpha.crop(
            (0, int(bust_h * 0.03), img.width, int(bust_h * 0.15))
        ).getbbox()
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
    client = current()
    banner = prepare_footer_image()
    leader_path, leader_ratio = prepare_leader_photo(leader_photo)
    return {
        "client": client,
        "accent": client["accent_color"],
        "logo_uri": file_uri(client["logo"]),
        "leader_uri": file_uri(leader_path),
        "leader_ratio": leader_ratio,  # photo width / height
        "initial": client["name"][:1],
        # banner: either split into logo + centred text, or one full image
        "footer_img_uri": file_uri(banner.get("full") or banner.get("text", "")),
        "footer_logo_uri": file_uri(banner.get("logo", "")),
        "footer_logo_ratio": banner.get("logo_ratio", 1),
        "footer_text_uri": file_uri(banner.get("text", "")),
        "footer_text_ratio": banner.get("text_ratio", 1),
        "footer_bg": banner.get("bg", "#ffffff"),
        **poster_words(client["language"]),
    }


def ai_label(ai_generated):
    return AI_LABEL_TEXT if (ai_generated and current()["show_ai_label"]) else ""


# Measures the finished poster for the design editor: every text (position, font, size after
# auto-fit, colour, gradient, shadow) and every image (exact drawn position). Then it hides them,
# so a second screenshot gives the clean background (photo, shading, ornaments, footer strip).
MEASURE_JS = r"""
() => {
  const items = [];
  const shown = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0; };
  const colors = (s) => (s.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/g) || []);
  const shadowOf = (cs) => {
    const src = cs.textShadow !== "none" ? cs.textShadow : (cs.filter.match(/drop-shadow\((.*)\)\s*$/) || [])[1];
    if (!src) return null;
    const last = src.split(/,(?![^(]*\))/).pop().trim();
    const color = colors(last)[0] || "rgba(0,0,0,0.5)";
    const nums = (last.replace(color, "").match(/-?[\d.]+px/g) || []).map(parseFloat);
    return { color, offsetX: nums[0] || 0, offsetY: nums[1] || 0, blur: nums[2] || 0 };
  };

  // images: the area actually drawn (object-fit contain / cover and object-position)
  const images = [...document.querySelectorAll("img")].filter((img) => shown(img) && img.naturalWidth);
  images.forEach((img) => {
    const r = img.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(img);
    let w = r.width, h = r.height, x = r.left, y = r.top;
    if (["contain", "scale-down"].includes(cs.objectFit)) {
      const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      w = img.naturalWidth * s; h = img.naturalHeight * s;
      const pos = cs.objectPosition.split(" ");
      const frac = (v, free) => v.endsWith("%") ? parseFloat(v) / 100 * free : parseFloat(v) || 0;
      x = r.left + frac(pos[0] || "50%", r.width - w); y = r.top + frac(pos[1] || "50%", r.height - h);
    }
    items.push({ type: "image", src: img.src, left: x, top: y, width: w, height: h,
                 name: img.className || "Image", z: parseInt(getComputedStyle(img.closest("[style], div") || img).zIndex) || 0 });
  });

  // texts: elements that hold their own words (with <br> line breaks)
  const texts = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (["SCRIPT", "STYLE", "IMG", "BR", "SVG", "PATH"].includes(el.tagName.toUpperCase()) || !shown(el)) return;
    if (texts.some((t) => t.contains(el))) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    texts.push(el);
  });
  texts.forEach((el) => {
    const box = el.getBoundingClientRect(); if (!box.width || !box.height) return;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === "normal" ? size * 1.25 : parseFloat(cs.lineHeight);
    // where the letters themselves are drawn (not the box: pills, chips and badges have padding and icons)
    let r = box;
    const lines = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const range = document.createRange(); range.selectNodeContents(n);
      [...range.getClientRects()].forEach((q) => { if (q.width && q.height) lines.push(q); });
    });
    if (lines.length) {
      const left = Math.min(...lines.map((q) => q.left)), right = Math.max(...lines.map((q) => q.right));
      const top = Math.min(...lines.map((q) => q.top)), bottom = Math.max(...lines.map((q) => q.bottom));
      const first = lines.find((q) => q.top === top);
      const lead = Math.max(0, (lh - first.height) / 2);   // the line box is taller than the letters
      const centred = ["center"].includes(cs.textAlign);
      r = { left: centred ? box.left : left, width: centred ? box.width : right - left,
            top: top - lead, height: bottom - top + 2 * lead };
    }
    const clipText = cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text";
    const grad = clipText && cs.backgroundImage.includes("gradient") ? colors(cs.backgroundImage) : null;
    items.push({
      type: "text", text: el.innerText.trim(), name: (el.className || el.tagName).toString().split(" ")[0] || "Text",
      left: r.left, top: r.top, width: r.width, height: r.height,
      fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), fontSize: size,
      fontWeight: cs.fontWeight, lineHeightPx: lh, textAlign: ["center", "right", "left"].includes(cs.textAlign) ? cs.textAlign
        : (cs.textAlign === "end" ? "right" : "left"),
      color: grad ? grad[grad.length - 1] : cs.color, gradient: grad, shadow: shadowOf(cs),
      letterSpacing: parseFloat(cs.letterSpacing) || 0,
    });
  });

  // hide what became layers, so the next screenshot is the clean background
  // hide only the letters: the element's own background (pills, badges, price boxes), its icons
  // and bullets stay in the background picture, so a white text on a coloured pill keeps its pill
  texts.forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text") el.style.backgroundImage = "none";
    el.style.color = "transparent";
    el.style.webkitTextFillColor = "transparent";
    el.style.webkitTextStroke = "0";
    el.style.textShadow = "none";
    el.style.filter = "none";
  });
  images.forEach((img) => { img.style.visibility = "hidden"; });
  return items;
}
"""


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
                    warnings.append(
                        f"Text did not fit ({Path(out_path).name}): {problem}"
                    )
                page.screenshot(path=str(out_path))
                # editor layers: measure, then screenshot the clean background
                try:
                    _measure_page(page, out_path, width, height)
                except (
                    Exception
                ) as e:  # noqa: BLE001 - the poster itself is fine; the editor falls back
                    warnings.append(
                        f"Could not prepare editor layers ({Path(out_path).name}): {e}"
                    )
                page.close()
        finally:
            browser.close()
    return warnings


def _measure_page(page, out_path, width, height):
    """Save the editor layers (measured texts and images) + the clean background for one poster."""
    items = page.evaluate(MEASURE_JS)
    base = Path(out_path).with_name(Path(out_path).stem + "_base.png")
    page.screenshot(path=str(base))
    Path(out_path).with_suffix(".layers.json").write_text(
        json.dumps(
            {"width": width, "height": height, "base": str(base), "items": items},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def measure_existing(png_path):
    """For posters made before editor layers existed: measure them from their saved HTML page.
    Returns True when the layers file now exists."""
    png = Path(png_path)
    html = OUTPUT_DIR / "_html" / f"{png.stem}.html"
    if png.with_suffix(".layers.json").exists():
        return True
    if not html.exists():
        return False

    def work():
        if sys.platform.startswith("win"):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        size = "story" if png.stem.endswith("_story") else "feed"
        width, height = SIZES[size]
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": width, "height": height})
                page.goto(html.as_uri())
                page.wait_for_function("window.__layoutDone === true", timeout=20000)
                _measure_page(page, png, width, height)
            finally:
                browser.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(work).result()
    return png.with_suffix(".layers.json").exists()


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
            **data, W=width, H=height, size=size, fonts=FONTS
        )
        # the page language picks the right letter shapes (Hindi and Marathi draw some letters differently)
        html = html.replace(
            '<html lang="mr">', f'<html lang="{current()["language"]}">', 1
        )
        html_path = html_dir / f"{name}_{size}.html"
        html_path.write_text(html, encoding="utf-8")
        out_path = out_dir / f"{name}_{size}.png"
        jobs.append((html_path, out_path, width, height))
        outputs.append(str(out_path))

    with ThreadPoolExecutor(max_workers=1) as pool:
        warnings = pool.submit(_screenshot_all, jobs).result()
    return outputs, warnings
