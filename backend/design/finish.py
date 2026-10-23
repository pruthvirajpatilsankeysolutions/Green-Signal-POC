"""
Final image quality for every post (like Canva's export): the post is drawn at 2x, then shrunk to its
real size with a high-quality Lanczos filter and given a light sharpening. Text edges, shapes and photos
come out crisper than when drawn directly at the final size.
"""
import io

from PIL import Image, ImageFilter

RENDER_SCALE = 2                                   # posts are drawn at 2x, then finished to their size
SHARPEN = ImageFilter.UnsharpMask(radius=0.6, percent=50, threshold=2)   # light: crisp edges, no halos


def finish(source, size, out_path):
    """source: PNG bytes, a path or a PIL image drawn at RENDER_SCALE x; size: (width, height) of the post."""
    im = Image.open(io.BytesIO(source)) if isinstance(source, (bytes, bytearray)) else (
        Image.open(source) if not isinstance(source, Image.Image) else source)
    im = im.convert("RGBA")
    if im.size != tuple(size):
        im = im.resize(tuple(size), Image.LANCZOS)
    rgb = im.convert("RGB").filter(SHARPEN)
    if im.getchannel("A").getextrema()[0] < 255:          # keep any transparency
        rgb.putalpha(im.getchannel("A"))
    rgb.save(out_path, "PNG", compress_level=6)
    return str(out_path)
