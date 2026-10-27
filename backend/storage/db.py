import os
import time
from datetime import datetime

from sqlalchemy import (
    JSON,
    URL,
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    text,
)


from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

import config


def database_url():
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")

    if os.getenv("DB_HOST"):
        return URL.create(
            "postgresql+psycopg",
            username=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "postdesk"),
        )
    raise RuntimeError(
        "Database not set. Add DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD to .env"
    )


engine = create_engine(database_url(), pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)


def now_text():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


class Base(DeclarativeBase):
    pass


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    client_type: Mapped[str] = mapped_column(String(40), default="politician")
    handle: Mapped[str] = mapped_column(String(100), default="")
    designation_lines: Mapped[list] = mapped_column(JSON, default=list)
    accent_color: Mapped[str] = mapped_column(String(20), default="#F26B0F")
    fixed_hashtags: Mapped[list] = mapped_column(JSON, default=list)
    show_ai_label: Mapped[bool] = mapped_column(Boolean, default=False)
    phone: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    post_types: Mapped[list] = mapped_column(JSON, default=list)
    language: Mapped[str] = mapped_column(
        String(8), default="mr"
    )  # language of the posts
    second_language: Mapped[str] = mapped_column(
        String(8), default=""
    )  # optional extra line in this language
    digit_style: Mapped[str] = mapped_column(
        String(10), default=""
    )  # native / latin ("" = language default)
    region: Mapped[str] = mapped_column(
        String(10), default="MH"
    )  # decides regional festivals and picture style
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # banner / logo / leader
    path: Mapped[str] = mapped_column(Text)  # relative to the backend folder
    original_name: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)


class StyleExample(Base):
    __tablename__ = "style_examples"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)


class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))  # festival / event / reaction
    title: Mapped[str] = mapped_column(Text, default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    images: Mapped[list] = mapped_column(JSON, default=list)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="waiting", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)
    created_ts: Mapped[float] = mapped_column(Float, default=time.time)  # exact order
    approved_at: Mapped[str] = mapped_column(String(20), default="")
    history: Mapped[list] = mapped_column(JSON, default=list)
    design: Mapped[dict] = mapped_column(JSON, default=dict)


class Template(Base):
    """A design template (Fabric JSON) imported from a PPTX; its texts are marked as slots the app fills."""
    __tablename__ = "templates"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(Text, default="")
    width: Mapped[int] = mapped_column(Integer, default=1080)
    height: Mapped[int] = mapped_column(Integer, default=1080)
    design: Mapped[dict] = mapped_column(JSON, default=dict)          # Fabric JSON with "slot" on texts/images
    thumbnail: Mapped[str] = mapped_column(Text, default="")          # file path of a small PNG
    occasions: Mapped[list] = mapped_column(JSON, default=list)       # festival ids; [] = any
    client_types: Mapped[list] = mapped_column(JSON, default=list)    # e.g. ["school"]; [] = all
    client_id: Mapped[str] = mapped_column(String(60), default="")    # set = only this client may use it
    source: Mapped[str] = mapped_column(Text, default="")             # the imported file name
    ready: Mapped[bool] = mapped_column(Boolean, default=False)       # slots marked and saved
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)
    updated_at: Mapped[str] = mapped_column(String(20), default=now_text)


class PostPlan(Base):
    __tablename__ = "post_plans"
    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), index=True)
    festival_id: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(20), default="options")
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    chosen: Mapped[dict] = mapped_column(JSON, default=dict)
    draft_id: Mapped[str] = mapped_column(String(12), default="")
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)
    updated_at: Mapped[str] = mapped_column(String(20), default=now_text)


class StudioStory(Base):
    """A story in Story Studio, the agency's own tool: it belongs to no client. Stages, bible, story, validation and screenplay are JSON."""
    __tablename__ = "studio_stories"
    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    title: Mapped[str] = mapped_column(Text, default="")
    brief: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")                     # internal notes on the idea (guidance for the concept only)
    directions: Mapped[list] = mapped_column(JSON, default=list)             # the writer's directions from retries: [{"stage","text"}]
    stages: Mapped[dict] = mapped_column(JSON, default=dict)                 # {stage: {status, draft, approved, warnings, facts, retries, edited}}
    story: Mapped[str] = mapped_column(Text, default="")
    story_prev: Mapped[str] = mapped_column(Text, default="")                # the draft before a repair or revision (one step back)
    checks: Mapped[list] = mapped_column(JSON, default=list)                 # objective checks on the story
    validation: Mapped[dict] = mapped_column(JSON, default=dict)             # the validator's normalized report
    screenplay: Mapped[dict] = mapped_column(JSON, default=dict)             # {plan, scenes, fountain, warnings}
    job: Mapped[dict] = mapped_column(JSON, default=dict)                    # the running or last background step
    created_at: Mapped[str] = mapped_column(String(20), default=now_text)
    updated_ts: Mapped[float] = mapped_column(Float, default=time.time, index=True)


NEW_COLUMNS = [
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone VARCHAR(40) DEFAULT ''",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''",
    "ALTER TABLE drafts ADD COLUMN IF NOT EXISTS design JSON",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS post_types JSON",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS language VARCHAR(8) DEFAULT 'mr'",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS second_language VARCHAR(8) DEFAULT ''",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS digit_style VARCHAR(10) DEFAULT ''",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'MH'",
]


def init_db():
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for statement in NEW_COLUMNS:
            conn.execute(text(statement))
