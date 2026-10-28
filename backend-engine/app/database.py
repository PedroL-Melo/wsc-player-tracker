"""Configuração do banco de dados SQLite com SQLAlchemy."""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

if getattr(sys, "frozen", False):
    # Quando empacotado em .exe, salva o banco em %APPDATA%/WSCPlayerTracker
    appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
    db_dir = Path(appdata) / "WSCPlayerTracker"
    db_dir.mkdir(parents=True, exist_ok=True)
    DB_PATH = db_dir / "wsc_tracker.db"
    DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
else:
    DATABASE_URL = "sqlite:///./wsc_tracker.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency para obter sessão do banco."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
