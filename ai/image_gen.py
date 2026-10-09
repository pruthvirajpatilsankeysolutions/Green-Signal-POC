"""
Makes background pictures with OpenAI's image model.
Needs OPENAI_API_KEY in .env

The AI only paints the background. Text, leader photo and logo are
added later by design/poster.py, so they are always correct.
"""
import base64
import uuid

from openai import OpenAI

from config import IMAGE_MODEL, IMAGE_QUALITY, OUTPUT_DIR

PICTURE_RULES = """
STRICT RULES FOR THIS IMAGE:
- Absolutely NO text, letters, numbers, logos, signboards or watermarks anywhere.
- Do not show any living politician or any modern identifiable person.
- {space}
- Keep the bottom 20% of the image simple and uncluttered; a footer will cover it.
- Square format, fine detail, poster-quality artwork.
"""

SPACE = {
    "left": ("Keep the LEFT half of the image calm and mostly empty (soft sky, plain wall, "
             "gentle glow) so large text can be placed there later."),
    "right": ("Keep the RIGHT half of the image calm and mostly empty (soft sky, plain wall, "
              "gentle glow) so large text can be placed there later."),
    "center": ("Put the main object in the CENTRE (middle 45% of the height). Keep the TOP 30% "
               "of the image plain and light, and keep a plain light strip between the object "
               "and the bottom 20%, so text can be placed above and below the object. "
               "Decorations only along the left and right edges."),
}


def generate_backgrounds(scene, empty_side="right", count=4):
    """Return (list of image paths, full prompt used)."""
    prompt = scene.strip() + "\n" + PICTURE_RULES.format(space=SPACE.get(empty_side, SPACE["right"]))

    client = OpenAI()   # reads OPENAI_API_KEY
    result = client.images.generate(
        model=IMAGE_MODEL,
        prompt=prompt,
        n=count,
        size="1024x1024",          # square, same as the feed poster
        quality=IMAGE_QUALITY,
    )

    folder = OUTPUT_DIR / "candidates"
    folder.mkdir(parents=True, exist_ok=True)
    batch = uuid.uuid4().hex[:6]

    paths = []
    for i, item in enumerate(result.data, start=1):
        if not getattr(item, "b64_json", None):
            continue
        path = folder / f"{batch}_{i}.png"
        path.write_bytes(base64.b64decode(item.b64_json))
        paths.append(str(path))

    if not paths:
        raise RuntimeError("The image model returned no pictures. Try a different description.")
    return paths, prompt