"""Gerenciador de WebSockets e Serviço de Monitoramento Autônomo em Segundo Plano (Watcher)."""
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

from app.database import SessionLocal
from app.models import CareerProfile, SeasonLog, EvolutionEvent
from app.window_capture import EmulatorWindowCapture
from app.ocr_scanner import WSCVisionScanner


class ConnectionManager:
    """Gerencia conexões WebSocket ativas e faz broadcast de eventos em tempo real."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        disconnected: List[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


class BackgroundWatcherService:
    """Serviço assíncrono que monitora a janela do emulador a cada 1.5s com deduplicação de estado."""

    def __init__(self, ws_manager: ConnectionManager) -> None:
        self.ws_manager = ws_manager
        self.is_running: bool = False
        self.active_career_id: Optional[int] = None
        self.target_window_title: Optional[str] = None
        self.target_player_name: Optional[str] = None
        self.last_known_state: Optional[Dict[str, int]] = None
        self.last_raw_ocr: Optional[Dict[str, Any]] = None
        self.last_check_at: Optional[str] = None
        self._task: Optional[asyncio.Task] = None
        self._capturer = EmulatorWindowCapture()

    def get_status(self) -> Dict[str, Any]:
        """Retorna o estado atual do monitoramento."""
        return {
            "is_running": self.is_running,
            "active_career_id": self.active_career_id,
            "target_window_title": self.target_window_title,
            "target_player_name": self.target_player_name,
            "last_known_state": self.last_known_state,
            "last_raw_ocr": self.last_raw_ocr,
            "last_check_at": self.last_check_at,
        }

    async def start(self, career_id: int) -> Dict[str, Any]:
        """Inicia o loop de monitoramento para a carreira informada."""
        if self.is_running:
            await self.stop()

        db = SessionLocal()
        try:
            career = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
            if not career:
                raise ValueError(f"Carreira ID {career_id} não encontrada.")

            current_season = (
                db.query(SeasonLog)
                .filter(SeasonLog.career_id == career_id)
                .order_by(SeasonLog.season_number.desc())
                .first()
            )

            self.active_career_id = career.id
            self.target_window_title = career.target_window_title
            self.target_player_name = career.player_name

            if current_season:
                self.last_known_state = {
                    "age": current_season.age,
                    "overall": current_season.overall,
                    "matches": current_season.matches,
                    "goals": current_season.goals,
                    "assists": current_season.assists,
                }
            else:
                self.last_known_state = None
        finally:
            db.close()

        self.is_running = True
        self._task = asyncio.create_task(self._watch_loop())

        await self.ws_manager.broadcast({
            "type": "WATCHER_STATUS",
            "data": self.get_status(),
        })
        return self.get_status()

    async def stop(self) -> Dict[str, Any]:
        """Pausa o loop de monitoramento automático."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

        await self.ws_manager.broadcast({
            "type": "WATCHER_STATUS",
            "data": self.get_status(),
        })
        return self.get_status()

    def _capture_and_scan_sync(self, window_title: str, player_name: str) -> Optional[Dict[str, Any]]:
        """Executa captura de tela e OCR de forma síncrona (chamado via asyncio.to_thread)."""
        frame = self._capturer.capture_window(window_title)
        if frame is None:
            return None
        scanner = WSCVisionScanner()
        return scanner.scan_frame_for_player(frame, player_name)

    async def _watch_loop(self) -> None:
        """Loop contínuo (1.5s) de captura, OCR, deduplicação e persistência."""
        while self.is_running and self.active_career_id is not None:
            loop_start = asyncio.get_running_loop().time()
            try:
                ocr_data = await asyncio.to_thread(
                    self._capture_and_scan_sync,
                    self.target_window_title or "",
                    self.target_player_name or "",
                )
                self.last_check_at = datetime.utcnow().isoformat()

                if ocr_data is not None:
                    self.last_raw_ocr = {
                        "player_matched": ocr_data.get("player_matched"),
                        "confidence": ocr_data.get("confidence"),
                        "raw_row_tokens": ocr_data.get("raw_row_tokens"),
                        "numbers_extracted": ocr_data.get("numbers_extracted"),
                    }
                    await self._process_ocr_reading(ocr_data)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                print(f"[WatcherService] Erro no ciclo de monitoramento: {exc}")

            elapsed = asyncio.get_running_loop().time() - loop_start
            await asyncio.sleep(max(0.1, 1.5 - elapsed))

    async def _process_ocr_reading(self, ocr_data: Dict[str, Any]) -> None:
        """Valida outliers, respeita o tipo de tela detectada e aplica deduplicação no SQLite + WebSocket."""
        if self.active_career_id is None:
            return

        screen_type = ocr_data.get("screen_type", "MATCH_STATS")

        db = SessionLocal()
        try:
            current_season = (
                db.query(SeasonLog)
                .filter(SeasonLog.career_id == self.active_career_id)
                .order_by(SeasonLog.season_number.desc())
                .first()
            )
            if not current_season:
                return

            new_age = current_season.age
            new_ovr = current_season.overall
            new_matches = current_season.matches
            new_goals = current_season.goals
            new_assists = current_season.assists

            # 1. Se for tela de Treinamento/Elenco/Venda: só atualiza Overall e Idade
            if screen_type == "TRAINING_OR_SQUAD":
                if ocr_data.get("overall") is not None and (30 <= ocr_data["overall"] <= 99):
                    new_ovr = ocr_data["overall"]
                if ocr_data.get("age") is not None and (15 <= ocr_data["age"] <= 45):
                    new_age = ocr_data["age"]

            # 2. Se for tela de Estatísticas: só atualiza Jogos, Gols e Assistências
            elif screen_type == "MATCH_STATS":
                if ocr_data.get("matches") is not None and ocr_data["matches"] >= 0:
                    new_matches = ocr_data["matches"]
                if ocr_data.get("goals") is not None and ocr_data["goals"] >= 0:
                    new_goals = ocr_data["goals"]
                if ocr_data.get("assists") is not None and ocr_data["assists"] >= 0:
                    new_assists = ocr_data["assists"]

            new_state = {
                "age": new_age,
                "overall": new_ovr,
                "matches": new_matches,
                "goals": new_goals,
                "assists": new_assists,
            }

            db_state = {
                "age": current_season.age,
                "overall": current_season.overall,
                "matches": current_season.matches,
                "goals": current_season.goals,
                "assists": current_season.assists,
            }

            # Anti-Spam: se nada mudou, ignora
            if self.last_known_state == new_state and db_state == new_state:
                return

            if db_state == new_state:
                self.last_known_state = new_state
                return

            created_events: List[Dict[str, Any]] = []

            # Eventos de Evolução
            if new_state["goals"] > current_season.goals:
                ev = EvolutionEvent(
                    career_id=self.active_career_id,
                    event_type="GOAL",
                    old_value=str(current_season.goals),
                    new_value=str(new_state["goals"]),
                )
                db.add(ev)
                db.flush()
                created_events.append({
                    "id": ev.id,
                    "career_id": ev.career_id,
                    "event_type": ev.event_type,
                    "old_value": ev.old_value,
                    "new_value": ev.new_value,
                    "timestamp": ev.timestamp.isoformat(),
                })

            if new_state["assists"] > current_season.assists:
                ev = EvolutionEvent(
                    career_id=self.active_career_id,
                    event_type="ASSIST",
                    old_value=str(current_season.assists),
                    new_value=str(new_state["assists"]),
                )
                db.add(ev)
                db.flush()
                created_events.append({
                    "id": ev.id,
                    "career_id": ev.career_id,
                    "event_type": ev.event_type,
                    "old_value": ev.old_value,
                    "new_value": ev.new_value,
                    "timestamp": ev.timestamp.isoformat(),
                })

            if new_state["overall"] != current_season.overall:
                ev = EvolutionEvent(
                    career_id=self.active_career_id,
                    event_type="OVR_UP",
                    old_value=str(current_season.overall),
                    new_value=str(new_state["overall"]),
                )
                db.add(ev)
                db.flush()
                created_events.append({
                    "id": ev.id,
                    "career_id": ev.career_id,
                    "event_type": ev.event_type,
                    "old_value": ev.old_value,
                    "new_value": ev.new_value,
                    "timestamp": ev.timestamp.isoformat(),
                })

            # Atualiza SeasonLog
            current_season.age = new_state["age"]
            current_season.overall = new_state["overall"]
            current_season.matches = new_state["matches"]
            current_season.goals = new_state["goals"]
            current_season.assists = new_state["assists"]
            current_season.updated_at = datetime.utcnow()

            db.commit()
            db.refresh(current_season)

            self.last_known_state = new_state

            payload = {
                "type": "STATS_UPDATED",
                "career_id": self.active_career_id,
                "season": {
                    "id": current_season.id,
                    "season_number": current_season.season_number,
                    "club_name": current_season.club_name,
                    "age": current_season.age,
                    "overall": current_season.overall,
                    "matches": current_season.matches,
                    "goals": current_season.goals,
                    "assists": current_season.assists,
                    "trophies_count": current_season.trophies_count,
                    "updated_at": current_season.updated_at.isoformat(),
                },
                "events": created_events,
                "timestamp": datetime.utcnow().isoformat(),
            }
            print(f"[WatcherService] ({screen_type}) Atualizado com sucesso: {new_state} | Eventos: {len(created_events)}")
            await self.ws_manager.broadcast(payload)

        finally:
            db.close()
