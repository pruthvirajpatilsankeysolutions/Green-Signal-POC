"""
Prepares real photos for Instagram without any design on top
(used for sports wins, achievements, events and personal condolence posts).
"""
import uuid

from PIL import Image, ImageOps

from config import OUTPUT_DIR

MIN_RATIO, MAX_RATIO = 0.8, 1.91     # Instagram allows 4:5 (tall) to 1.91:1 (wide)


def prepare_for_instagram(path, width=1080):
    """Fix rotation, crop only if Instagram would reject the shape, resize, save as JPG."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    ratio = img.width / img.height

    if ratio < MIN_RATIO:            # too tall: keep the upper part (faces)
        new_h = int(img.width / MIN_RATIO)
        top = int((img.height - new_h) * 0.3)
        img = img.crop((0, top, img.width, top + new_h))
    elif ratio > MAX_RATIO:          # too wide: keep the centre
        new_w = int(img.height * MAX_RATIO)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))

    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)

    out_dir = OUTPUT_DIR / "posters"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"photo_{uuid.uuid4().hex[:8]}.jpg"
    img.save(out, quality=92)
    return str(out)