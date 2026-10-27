"""Long steps (writing a stage, the story, the screenplay) run in a background thread with progress; the page polls the project.
One step at a time per project. If the server restarts during a step, it is marked failed and can simply be run again."""
import logging
import threading
import time

from story import store
from story.llm import ModelError

log = logging.getLogger("story")
STALE = 45 * 60                       # a step "running" for longer than this is considered dead


class Busy(ValueError):
    pass


def _claim(project_id, kind):
    def fn(p):
        job = p["job"]
        if job.get("status") == "running" and time.time() - job.get("started", 0) < STALE:
            raise Busy("Another step of this story is still running. Wait for it to finish.")
        p["job"] = {"kind": kind, "status": "running", "message": "Starting…", "started": time.time()}
    store.mutate(project_id, fn)


def _set(project_id, **fields):
    def fn(p):
        p["job"] = {**p["job"], **fields}
    store.mutate(project_id, fn)


def progress(project_id, message):
    _set(project_id, message=message)


def run(project_id, kind, work, wait=False):
    """work(progress_fn) does the step. Returns at once (the work continues in a thread) unless wait=True."""
    _claim(project_id, kind)

    def target():
        try:
            work(lambda m: progress(project_id, m))
            _set(project_id, status="done", message="Done", finished=time.time())
        except (ValueError, ModelError) as e:                     # problems the writer can act on
            _set(project_id, status="failed", message=str(e), finished=time.time())
        except Exception as e:  # noqa: BLE001 - never leave a job "running" forever
            log.exception("story step %s failed", kind)
            _set(project_id, status="failed", message=f"Something went wrong: {e}", finished=time.time())

    if wait:
        target()
    else:
        threading.Thread(target=target, daemon=True, name=f"story-{kind}").start()


def recover():
    """At server start: steps that were running died with the old process."""
    from sqlalchemy import select
    from storage.db import Session, StudioStory
    with Session() as s:
        ids = [p.id for p in s.scalars(select(StudioStory)).all() if (p.job or {}).get("status") == "running"]
    for pid in ids:
        _set(pid, status="failed", message="The server restarted while this step was running. Run it again.", finished=time.time())
