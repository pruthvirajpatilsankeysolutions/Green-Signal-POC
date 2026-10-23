"""
HD downloads (2x / 3x) of a post:
  - posts with a saved design (template posts, posts edited in the editor) are re-drawn from their layers;
  - standard posts are re-rendered from their saved HTML page at a higher pixel density.
Texts and shapes come out sharp at the larger size (like a PDF); pictures use their full resolution.
"""
import asyncio
import base64
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from playwright.sync_api import sync_playwright

from config import OUTPUT_DIR
from design import template_fill


def _in_thread(fn):
    def run():
        if sys.platform.startswith("win"):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        return fn()
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(run).result()


def from_design(design, scale, out_path):
    """A saved Fabric design -> PNG at scale x its size."""
    from api.routes.designs import all_fonts
    design = json.loads(json.dumps(design))
    for o in design.get("objects", []):
        if isinstance(o.get("src"), str):
            o["src"] = template_fill._to_file(o["src"])
    page_file = template_fill._page(all_fonts())

    def work():
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--allow-file-access-from-files"])
            try:
                pg = browser.new_page()
                pg.goto(page_file.as_uri())
                pg.wait_for_function("window.__ready === true")
                return pg.evaluate("([d, m]) => renderDesign(d, m)", [design, scale])
            finally:
                browser.close()

    data_url = _in_thread(work)
    Path(out_path).write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
    return str(out_path)


def html_page_for(png_path):
    """The HTML page a standard poster was rendered from (output/_html/<name>.html), if it still exists."""
    page = OUTPUT_DIR / "_html" / (Path(png_path).stem + ".html")
    return page if page.exists() else None


def from_html(html_path, width, height, scale, out_path):
    """A standard poster's HTML page -> PNG at scale x the pixel density."""
    def work():
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                pg = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
                pg.goto(Path(html_path).as_uri())
                pg.wait_for_function("window.__layoutDone === true", timeout=20000)
                pg.screenshot(path=str(out_path))
            finally:
                browser.close()

    _in_thread(work)
    return str(out_path)
