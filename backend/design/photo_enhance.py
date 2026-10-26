"""
AI enlargement of template photos (FSRCNN super-resolution, OpenCV; models in assets/models, Apache 2.0).
Photos stored small in a PPTX (Canva shrinks them) look soft when a post is exported in HD. On import,
each photo that would be enlarged is enhanced once to the size it needs: cleaner edges and texture than
normal enlarging. Transparent photos keep clean cut-out edges.
"""

import numpy as np
from PIL import Image, ImageFilter

from config import ASSETS_DIR

MODELS = ASSETS_DIR / "models"
MIN_GAIN = 1.15                      # enhance only photos that would be enlarged by more than 15%
MAX_PIXELS = 16_000_000              # never make an enhanced photo bigger than this (memory, file size)
TILE = 512                           # the model works on pieces of this size, so memory stays low
_models = {}


def _model(k):
    import cv2
    if k not in _models:
        sr = cv2.dnn_superres.DnnSuperResImpl_create()
        sr.readModel(str(MODELS / f"FSRCNN_x{k}.pb"))
        sr.setModel("fsrcnn", k)
        _models[k] = sr
    return _models[k]


def _fill_hidden_colours(rgb, alpha):
    """Pixels hidden by transparency often hold black or junk; give them nearby visible colours so
    enlarging doesn't pull a dark fringe into the edges."""
    import cv2
    a = alpha.astype(np.float32) / 255
    if a.min() > 0.99:
        return rgb
    out = rgb.astype(np.float32)
    weight = cv2.GaussianBlur(a, (0, 0), 6) + 1e-6
    spread = np.dstack([cv2.GaussianBlur(out[..., i] * a, (0, 0), 6) / weight for i in range(3)])
    hidden = a[..., None] < 0.5
    return np.where(hidden, spread, out).clip(0, 255).astype(np.uint8)


def available():
    try:
        import cv2
        return hasattr(cv2, "dnn_superres") and (MODELS / "FSRCNN_x2.pb").exists()
    except ImportError:
        return False


def _upsample_tiled(model, k, bgr):
    """Run the model piece by piece (with a small overlap, cut away afterwards) to keep memory low."""
    h, w = bgr.shape[:2]
    out = np.zeros((h * k, w * k, 3), dtype=np.uint8)
    pad = 8
    for y in range(0, h, TILE):
        for x in range(0, w, TILE):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1, x1 = min(h, y + TILE + pad), min(w, x + TILE + pad)
            up = model.upsample(np.ascontiguousarray(bgr[y0:y1, x0:x1]))
            ty, tx = (y - y0) * k, (x - x0) * k
            th, tw = (min(h, y + TILE) - y) * k, (min(w, x + TILE) - x) * k
            out[y * k:y * k + th, x * k:x * k + tw] = up[ty:ty + th, tx:tx + tw]
    return out


def enhance(src_path, gain, out_path):
    """Enlarge the photo by the smallest model factor (2, 3 or 4) that covers 'gain', within MAX_PIXELS.
    Returns the factor, or None when even 2x would be too big (the original photo is kept)."""
    import cv2
    k = 2 if gain <= 2 else 3 if gain <= 3 else 4
    with Image.open(src_path) as probe:
        w0, h0 = probe.size
    while k > 1 and w0 * h0 * k * k > MAX_PIXELS:
        k -= 1
    if k < 2:
        return None
    im = Image.open(src_path).convert("RGBA")
    rgba = np.asarray(im)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    rgb = _fill_hidden_colours(rgb, alpha)
    up = cv2.cvtColor(_upsample_tiled(_model(k), k, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)), cv2.COLOR_BGR2RGB)
    out = Image.fromarray(up)
    if alpha.min() < 255:                                       # the cut-out mask: a high-quality normal enlargement is enough
        out.putalpha(Image.fromarray(alpha).resize(out.size, Image.LANCZOS))
    out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=40, threshold=2))
    out.save(out_path, "PNG", compress_level=6)              # "optimize" is 4x slower for a few % smaller files
    return k
