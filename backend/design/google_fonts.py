"""
Download a missing font automatically from Google Fonts (Google's open-licence font repository on GitHub).
Only open-licence fonts are fetched (OFL, Apache, UFL): Canva's own and other commercial fonts are not
there, so those keep a similar substitute (or the user uploads a licensed file).
"""
import re
import urllib.error
import urllib.parse
import urllib.request

from storage import fonts

REPO = "https://raw.githubusercontent.com/google/fonts/main"
LICENCE_DIRS = ("ofl", "apache", "ufl")
TIMEOUT = 15


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "postcraft-font-fetch"}), timeout=TIMEOUT) as r:
        return r.read()


class Unreachable(Exception):
    """Google Fonts couldn't be reached (offline / network error): different from "this font isn't there"."""


def find(family):
    """Google Fonts' description of a family (name, licence, files), or None if it isn't there."""
    slug = re.sub(r"[^a-z0-9]", "", (family or "").lower())
    if not slug:
        return None
    for folder in LICENCE_DIRS:
        try:
            meta = _get(f"{REPO}/{folder}/{slug}/METADATA.pb").decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue                                   # not in this licence folder
            raise Unreachable(str(e))
        except Exception as e:
            raise Unreachable(str(e))
        name = re.search(r'^name: "([^"]+)"', meta, re.M)
        if not name or name.group(1).lower().replace(" ", "") != slug:
            continue
        files = [{"style": s, "weight": w, "filename": f} for s, w, f in
                 re.findall(r'fonts \{\s*name: "[^"]*"\s*style: "(\w+)"\s*weight: (\d+)\s*filename: "([^"]+)"', meta)]
        axis = re.search(r'tag: "wght"\s*min_value: ([\d.]+)\s*max_value: ([\d.]+)', meta)
        licence = re.search(r'^license: "([^"]+)"', meta, re.M)
        return {"family": name.group(1), "folder": f"{folder}/{slug}", "licence": licence.group(1) if licence else folder.upper(),
                "files": files, "weights": (int(float(axis.group(1))), int(float(axis.group(2)))) if axis else None}
    return None


def download(family):
    """Download and register a family's upright (non-italic) files. Returns the registered fonts ([] if none)."""
    info = find(family)
    if not info:
        return []
    upright = [f for f in info["files"] if f["style"] == "normal"]
    added, seen = [], set()
    for f in upright:
        if f["filename"] in seen:
            continue
        seen.add(f["filename"])
        data = _get(f"{REPO}/{info['folder']}/{urllib.parse.quote(f['filename'])}")
        variable = "[" in f["filename"]
        weight = f"{info['weights'][0]} {info['weights'][1]}" if variable and info["weights"] else str(f["weight"])
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", f"{info['family']}-{f['filename']}")      # no clashes between families
        added.append({**fonts.add(info["family"], weight, safe_name, data), "licence": info["licence"]})
        if variable:
            break                                        # one variable file covers every weight
    return added
