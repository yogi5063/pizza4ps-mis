import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pizza4ps_mis.db")

# For SQLite, need connect_args
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Import all models then create all tables."""
    from models import user, upload, settings, masters  # noqa: F401
    Base.metadata.create_all(bind=engine)
    run_light_migrations()


def run_light_migrations():
    """Add columns that were introduced after a table already existed.

    create_all() never ALTERs an existing table, so new columns on tables that
    already hold data (e.g. store_code on uploaded_months) must be added here.
    Idempotent: only adds a column when it is missing. Works on SQLite and
    PostgreSQL.
    """
    from sqlalchemy import inspect, text

    wanted = {
        "uploaded_months": [("store_code", "VARCHAR")],
        "users": [
            ("full_name", "VARCHAR"),
            ("role", "VARCHAR DEFAULT 'user'"),
            ("allowed_pages", "TEXT"),
            ("allowed_outlets", "TEXT"),
            ("must_change_password", "BOOLEAN DEFAULT 0"),
        ],
    }
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, cols in wanted.items():
            if table not in existing_tables:
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for col_name, col_type in cols:
                if col_name not in have:
                    conn.execute(text(
                        f'ALTER TABLE {table} ADD COLUMN {col_name} {col_type}'
                    ))
