"""Design templates (Fabric JSON imported from PPTX files)."""
from sqlalchemy import select

from storage.db import Session, Template, now_text


def _out(t):
    return {"id": t.id, "name": t.name, "width": t.width, "height": t.height, "design": t.design, "thumbnail": t.thumbnail,
            "occasions": t.occasions or [], "client_types": t.client_types or [], "client_id": t.client_id or "",
            "source": t.source, "ready": t.ready, "created_at": t.created_at, "updated_at": t.updated_at}


def list_all():
    with Session() as s:
        rows = s.scalars(select(Template).order_by(Template.updated_at.desc())).all()
        return [{k: v for k, v in _out(t).items() if k != "design"} for t in rows]


def get(template_id):
    with Session() as s:
        t = s.get(Template, template_id)
        return _out(t) if t else None


def create(template_id, name, width, height, design, source):
    with Session() as s:
        t = Template(id=template_id, name=name, width=width, height=height, design=design, source=source)
        s.add(t)
        s.commit()
        return _out(t)


def save(template_id, **fields):
    with Session() as s:
        t = s.get(Template, template_id)
        if not t:
            raise KeyError(template_id)
        for key, value in fields.items():
            setattr(t, key, value)
        t.updated_at = now_text()
        s.commit()
        return _out(t)


def delete(template_id):
    with Session() as s:
        t = s.get(Template, template_id)
        if t:
            s.delete(t)
            s.commit()