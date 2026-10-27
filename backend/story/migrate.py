"""Stories made before Story Studio became its own tool were saved in `story_projects`, tied to a client.
They are copied into `studio_stories` once (only if that table is still empty). The old table is left untouched."""
import logging

from sqlalchemy import func, inspect, select, text

from storage.db import Session, StudioStory, engine

log = logging.getLogger("story")
COLUMNS = "id, title, brief, notes, directions, stages, story, story_prev, checks, validation, screenplay, job, created_at, updated_ts"


def copy_legacy():
    """Returns how many stories were copied."""
    if "story_projects" not in inspect(engine).get_table_names():
        return 0
    with Session() as s:
        if s.scalar(select(func.count()).select_from(StudioStory)):
            return 0
        rows = s.execute(text(f"SELECT {COLUMNS} FROM story_projects")).mappings().all()
        for r in rows:
            s.add(StudioStory(**dict(r)))
        s.commit()
    if rows:
        log.info("Story Studio: copied %s stories from the earlier version", len(rows))
    return len(rows)
