from email.policy import default
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
)


from sqlalchemy import JSON, URL, Boolean, Float, ForeignKey, Integer, String, Text, create_engine

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


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    client_type: Mapped[str] = mapped_column(String(40), default="politician")
    handle: Mapped[str] = mapped_column(String(100), default="")
    designation_lines: Mapped[list] = mapped_column(JSON, default=list)
    accent_color: Mapped[str] = mapped_column(String(20), default="#F26B0F")
    fixed_hashtag: Mapped[list] = mapped_column(JSON, default=list)
    show_ai_label: Mapped[bool] = mapped_column(Boolean, default=True)
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


def init_db():
    Base.metadata.create_all(engine)
