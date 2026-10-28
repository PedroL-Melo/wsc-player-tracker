"""Modelos de dados SQLAlchemy para o WSC Player Career Tracker."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class CareerProfile(Base):
    """Perfil da carreira do jogador."""
    __tablename__ = "career_profiles"

    id = Column(Integer, primary_key=True, index=True)
    player_name = Column(String, nullable=False, index=True)
    nationality = Column(String, nullable=True)
    position = Column(String, nullable=True)
    target_window_title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    season_logs = relationship("SeasonLog", back_populates="career", cascade="all, delete-orphan")
    evolution_events = relationship("EvolutionEvent", back_populates="career", cascade="all, delete-orphan")


class SeasonLog(Base):
    """Histórico de temporada do jogador."""
    __tablename__ = "season_logs"

    id = Column(Integer, primary_key=True, index=True)
    career_id = Column(Integer, ForeignKey("career_profiles.id"), nullable=False, index=True)
    season_number = Column(Integer, nullable=False)
    club_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    overall = Column(Integer, nullable=False)
    matches = Column(Integer, default=0, nullable=False)
    goals = Column(Integer, default=0, nullable=False)
    assists = Column(Integer, default=0, nullable=False)
    trophies_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    career = relationship("CareerProfile", back_populates="season_logs")


class EvolutionEvent(Base):
    """Eventos de evolução (gol, assistência, ovr_up, transferência)."""
    __tablename__ = "evolution_events"

    id = Column(Integer, primary_key=True, index=True)
    career_id = Column(Integer, ForeignKey("career_profiles.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # "GOAL", "ASSIST", "OVR_UP", "TRANSFER"
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    career = relationship("CareerProfile", back_populates="evolution_events")
