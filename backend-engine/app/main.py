"""API Principal FastAPI + WebSockets do WSC Player Career Tracker."""
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import CareerProfile, EvolutionEvent, SeasonLog
from app.ocr_scanner import WSCVisionScanner
from app.watcher_service import BackgroundWatcherService, ConnectionManager
from app.window_capture import EmulatorWindowCapture

ws_manager = ConnectionManager()
watcher_service = BackgroundWatcherService(ws_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa o banco SQLite e aquece o Singleton do EasyOCR na GPU durante o startup."""
    print("[FastAPI Startup] Criando tabelas SQLite (se não existirem)...")
    Base.metadata.create_all(bind=engine)

    print("[FastAPI Startup] Aquecendo WSCVisionScanner Singleton na GPU...")
    WSCVisionScanner()

    yield

    print("[FastAPI Shutdown] Encerrando BackgroundWatcherService...")
    if watcher_service.is_running:
        await watcher_service.stop()


app = FastAPI(
    title="WSC Player Career Tracker API",
    description="Motor Back-end Autônomo (FastAPI + EasyOCR + SQLite + WebSockets) para World Soccer Champs",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Schemas Pydantic
# ============================================================================

class CareerCreateRequest(BaseModel):
    player_name: str = Field(..., min_length=1, examples=["Endrick"])
    nationality: Optional[str] = Field(default="Brasil", examples=["Brasil"])
    position: Optional[str] = Field(default="ATA", examples=["ATA"])
    target_window_title: str = Field(..., min_length=1, examples=["MuMu Player"])
    club_name: str = Field(default="Clube Inicial", examples=["Palmeiras"])
    age: int = Field(default=17, ge=15, le=45, examples=[17])
    overall: int = Field(default=65, ge=30, le=99, examples=[65])


class NewSeasonRequest(BaseModel):
    club_name: Optional[str] = Field(default=None, description="Novo clube caso tenha ocorrido transferência")
    increment_age: bool = Field(default=True, description="Se verdadeiro, soma +1 na idade do jogador")


class SeasonPatchRequest(BaseModel):
    club_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=15, le=45)
    overall: Optional[int] = Field(default=None, ge=30, le=99)
    matches: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    trophies_count: Optional[int] = Field(default=None, ge=0)


# ============================================================================
# Helpers de Serialização
# ============================================================================

def serialize_career(career: CareerProfile) -> Dict[str, Any]:
    return {
        "id": career.id,
        "player_name": career.player_name,
        "nationality": career.nationality,
        "position": career.position,
        "target_window_title": career.target_window_title,
        "created_at": career.created_at.isoformat() if career.created_at else None,
    }


def serialize_season(season: SeasonLog) -> Dict[str, Any]:
    return {
        "id": season.id,
        "career_id": season.career_id,
        "season_number": season.season_number,
        "club_name": season.club_name,
        "age": season.age,
        "overall": season.overall,
        "matches": season.matches,
        "goals": season.goals,
        "assists": season.assists,
        "trophies_count": season.trophies_count,
        "updated_at": season.updated_at.isoformat() if season.updated_at else None,
    }


def serialize_event(event: EvolutionEvent) -> Dict[str, Any]:
    return {
        "id": event.id,
        "career_id": event.career_id,
        "event_type": event.event_type,
        "old_value": event.old_value,
        "new_value": event.new_value,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
    }


# ============================================================================
# Endpoints REST
# ============================================================================

@app.get("/windows", tags=["Sistema"])
def get_open_windows() -> Dict[str, List[str]]:
    """Retorna a lista de janelas abertas e visíveis no Windows."""
    windows = EmulatorWindowCapture.list_open_windows()
    return {"windows": windows}


@app.post("/careers", tags=["Carreiras"], status_code=201)
def create_career(payload: CareerCreateRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Cria um novo perfil de jogador (CareerProfile) e inicializa a Temporada 1 (SeasonLog)."""
    career = CareerProfile(
        player_name=payload.player_name.strip(),
        nationality=payload.nationality,
        position=payload.position,
        target_window_title=payload.target_window_title.strip(),
    )
    db.add(career)
    db.flush()

    season_one = SeasonLog(
        career_id=career.id,
        season_number=1,
        club_name=payload.club_name.strip(),
        age=payload.age,
        overall=payload.overall,
        matches=0,
        goals=0,
        assists=0,
        trophies_count=0,
    )
    db.add(season_one)
    db.commit()
    db.refresh(career)
    db.refresh(season_one)

    return {
        "career": serialize_career(career),
        "current_season": serialize_season(season_one),
    }


@app.get("/careers", tags=["Carreiras"])
def list_careers(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Lista todas as carreiras salvas com resumo da temporada atual."""
    careers = db.query(CareerProfile).order_by(CareerProfile.created_at.desc()).all()
    result = []
    for c in careers:
        latest_season = (
            db.query(SeasonLog)
            .filter(SeasonLog.career_id == c.id)
            .order_by(SeasonLog.season_number.desc())
            .first()
        )
        item = serialize_career(c)
        item["current_season"] = serialize_season(latest_season) if latest_season else None
        result.append(item)
    return result


@app.get("/careers/{career_id}/dashboard", tags=["Carreiras"])
def get_career_dashboard(career_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retorna o perfil do jogador, todas as temporadas, totais da carreira e os últimos 20 EvolutionEvents."""
    career = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
    if not career:
        raise HTTPException(status_code=404, detail="Carreira não encontrada.")

    seasons = (
        db.query(SeasonLog)
        .filter(SeasonLog.career_id == career_id)
        .order_by(SeasonLog.season_number.asc())
        .all()
    )

    events = (
        db.query(EvolutionEvent)
        .filter(EvolutionEvent.career_id == career_id)
        .order_by(EvolutionEvent.timestamp.desc(), EvolutionEvent.id.desc())
        .limit(20)
        .all()
    )

    total_matches = sum(s.matches for s in seasons)
    total_goals = sum(s.goals for s in seasons)
    total_assists = sum(s.assists for s in seasons)
    total_trophies = sum(s.trophies_count for s in seasons)
    peak_overall = max((s.overall for s in seasons), default=0)
    current_season = seasons[-1] if seasons else None

    return {
        "career": serialize_career(career),
        "current_season": serialize_season(current_season) if current_season else None,
        "seasons": [serialize_season(s) for s in seasons],
        "totals": {
            "seasons_count": len(seasons),
            "matches": total_matches,
            "goals": total_goals,
            "assists": total_assists,
            "goal_contributions": total_goals + total_assists,
            "trophies_count": total_trophies,
            "peak_overall": peak_overall,
            "current_overall": current_season.overall if current_season else 0,
        },
        "recent_events": [serialize_event(e) for e in events],
        "watcher": watcher_service.get_status(),
    }


@app.post("/careers/{career_id}/new-season", tags=["Carreiras"], status_code=201)
async def start_new_season(
    career_id: int,
    payload: Optional[NewSeasonRequest] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Fecha a temporada atual e abre uma nova temporada mantendo clube e Overall e zerando estatísticas."""
    career = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
    if not career:
        raise HTTPException(status_code=404, detail="Carreira não encontrada.")

    current_season = (
        db.query(SeasonLog)
        .filter(SeasonLog.career_id == career_id)
        .order_by(SeasonLog.season_number.desc())
        .first()
    )
    if not current_season:
        raise HTTPException(status_code=400, detail="Carreira não possui temporada inicial.")

    req = payload or NewSeasonRequest()
    next_club = req.club_name.strip() if req.club_name and req.club_name.strip() else current_season.club_name
    next_age = min(45, current_season.age + 1) if req.increment_age else current_season.age

    if next_club != current_season.club_name:
        transfer_ev = EvolutionEvent(
            career_id=career_id,
            event_type="TRANSFER",
            old_value=current_season.club_name,
            new_value=next_club,
        )
        db.add(transfer_ev)

    new_season = SeasonLog(
        career_id=career_id,
        season_number=current_season.season_number + 1,
        club_name=next_club,
        age=next_age,
        overall=current_season.overall,
        matches=0,
        goals=0,
        assists=0,
        trophies_count=0,
    )
    db.add(new_season)
    db.commit()
    db.refresh(new_season)

    if watcher_service.active_career_id == career_id:
        watcher_service.last_known_state = {
            "age": new_season.age,
            "overall": new_season.overall,
            "matches": 0,
            "goals": 0,
            "assists": 0,
        }

    serialized = serialize_season(new_season)
    await ws_manager.broadcast({
        "type": "NEW_SEASON_CREATED",
        "career_id": career_id,
        "season": serialized,
    })

    return {"new_season": serialized}


@app.patch("/careers/{career_id}/season/current", tags=["Carreiras"])
async def update_current_season(
    career_id: int,
    payload: SeasonPatchRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Permite edição rápida manual (mudar clube, adicionar troféu ou ajustar estatísticas da temporada atual)."""
    current_season = (
        db.query(SeasonLog)
        .filter(SeasonLog.career_id == career_id)
        .order_by(SeasonLog.season_number.desc())
        .first()
    )
    if not current_season:
        raise HTTPException(status_code=404, detail="Temporada atual não encontrada para esta carreira.")

    created_events: List[Dict[str, Any]] = []

    if payload.club_name is not None and payload.club_name.strip() != current_season.club_name:
        new_club = payload.club_name.strip()
        ev = EvolutionEvent(
            career_id=career_id,
            event_type="TRANSFER",
            old_value=current_season.club_name,
            new_value=new_club,
        )
        db.add(ev)
        db.flush()
        created_events.append(serialize_event(ev))
        current_season.club_name = new_club

    if payload.overall is not None and payload.overall != current_season.overall:
        ev = EvolutionEvent(
            career_id=career_id,
            event_type="OVR_UP",
            old_value=str(current_season.overall),
            new_value=str(payload.overall),
        )
        db.add(ev)
        db.flush()
        created_events.append(serialize_event(ev))
        current_season.overall = payload.overall

    if payload.age is not None:
        current_season.age = payload.age
    if payload.matches is not None:
        current_season.matches = payload.matches
    if payload.goals is not None:
        current_season.goals = payload.goals
    if payload.assists is not None:
        current_season.assists = payload.assists
    if payload.trophies_count is not None:
        current_season.trophies_count = payload.trophies_count

    current_season.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_season)

    if watcher_service.active_career_id == career_id:
        watcher_service.last_known_state = {
            "age": current_season.age,
            "overall": current_season.overall,
            "matches": current_season.matches,
            "goals": current_season.goals,
            "assists": current_season.assists,
        }

    serialized = serialize_season(current_season)
    await ws_manager.broadcast({
        "type": "STATS_UPDATED",
        "career_id": career_id,
        "season": serialized,
        "events": created_events,
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "season": serialized,
        "events": created_events,
    }


# ============================================================================
# Endpoints do Watcher
# ============================================================================

@app.post("/watcher/start/{career_id}", tags=["Watcher"])
async def start_watcher(career_id: int) -> Dict[str, Any]:
    """Inicia o monitoramento automático em segundo plano para a carreira informada."""
    try:
        status = await watcher_service.start(career_id)
        return status
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/watcher/stop", tags=["Watcher"])
async def stop_watcher() -> Dict[str, Any]:
    """Pausa o loop de monitoramento automático."""
    return await watcher_service.stop()


@app.get("/watcher/status", tags=["Watcher"])
def get_watcher_status() -> Dict[str, Any]:
    """Retorna o status atual do serviço de monitoramento."""
    return watcher_service.get_status()


# ============================================================================
# WebSocket Ao Vivo
# ============================================================================

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    """Canal WebSocket em tempo real para notificar gols, assistências, evolução de OVR e status."""
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "CONNECTED",
            "watcher": watcher_service.get_status(),
            "timestamp": datetime.utcnow().isoformat(),
        })
        while True:
            # Mantém a conexão viva aguardando pings ou mensagens do cliente
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
