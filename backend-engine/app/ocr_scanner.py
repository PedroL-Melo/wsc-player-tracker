"""Motor de Visão Computacional Autônomo com Reconhecimento Completo de Telas do WSC."""
import re
import unicodedata
from typing import Dict, Any, List, Optional
import numpy as np
import cv2
import torch
import easyocr

VALID_POSITIONS = {"GL", "ZG", "LD", "LE", "PD", "VL", "MO", "PE", "AT", "GOL", "ZAG", "LAT", "VOL", "MEI", "ATA", "PON"}


def normalize_text(text: str) -> str:
    """Remove acentos e converte para minúsculas para comparação tolerante a falhas de OCR."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


class OCRScanner:
    """Singleton para leitura de frames do emulador com validação estrita de telas de tabela."""

    _instance: Optional["OCRScanner"] = None
    _reader: Optional[easyocr.Reader] = None

    def __new__(cls) -> "OCRScanner":
        if cls._instance is None:
            cls._instance = super(OCRScanner, cls).__new__(cls)
            cls._instance._initialize_reader()
        return cls._instance

    def _initialize_reader(self) -> None:
        """Inicializa o EasyOCR Reader na GPU NVIDIA via CUDA."""
        cuda_available = torch.cuda.is_available()
        device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU"
        print(f"[OCRScanner] Inicializando EasyOCR Singleton | CUDA Ativo: {cuda_available} ({device_name})")
        self._reader = easyocr.Reader(["pt", "en"], gpu=cuda_available)

    @property
    def reader(self) -> easyocr.Reader:
        if self._reader is None:
            self._initialize_reader()
        return self._reader

    @staticmethod
    def _get_box_metrics(bbox: List[List[float]]) -> Dict[str, float]:
        xs = [float(pt[0]) for pt in bbox]
        ys = [float(pt[1]) for pt in bbox]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        return {
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
            "center_x": (min_x + max_x) / 2.0,
            "center_y": (min_y + max_y) / 2.0,
            "width": max(1.0, max_x - min_x),
            "height": max(1.0, max_y - min_y),
        }

    def _read_cell_digit(self, frame: np.ndarray, y1: int, y2: int, x1: int, x2: int) -> Optional[int]:
        H, W, _ = frame.shape
        y1_c = max(0, min(H - 1, y1))
        y2_c = max(0, min(H, y2))
        x1_c = max(0, min(W - 1, x1))
        x2_c = max(0, min(W, x2))

        if y2_c <= y1_c or x2_c <= x1_c:
            return None

        cell = frame[y1_c:y2_c, x1_c:x2_c]
        cell_big = cv2.resize(cell, (0, 0), fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
        cell_pad = cv2.copyMakeBorder(cell_big, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=[220, 220, 220])

        res = self.reader.readtext(cell_pad, allowlist="0123456789")
        if not res:
            return None

        for _, text, conf in res:
            digits = re.findall(r"\d+", text)
            if digits and conf >= 0.2:
                return int(digits[0])

        return None

    def scan_frame_for_player(
        self, frame: np.ndarray, target_player_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Só lê dados se a tela for comprovadamente uma tabela oficial do WSC:
        - Tabela de Treinamento / Elenco / Transferências (extrai Overall, Idade, Posição e Clube)
        - Tabela de Estatísticas Pós-Jogo (extrai Jogos, Gols, Assistências, Posição e Clube)
        Em partida rolando ou intervalo, DESCARTA o frame!
        """
        if frame is None or not target_player_name.strip():
            return None

        results = self.reader.readtext(frame)
        if not results:
            return None

        H, W, _ = frame.shape
        all_screen_texts = [text.strip() for _, text, _ in results if text.strip()]
        full_screen_norm = normalize_text(" ".join(all_screen_texts))

        # 1. TRAVA ANTI-JOGO: Se for partida rolando ou intervalo (ex: "VEL 60 PAS 59" ou "Posse de Bola")
        if any(k in full_screen_norm for k in ["posse de bola", "intervalo", "fase de grupos"]):
            return None
        if re.search(r"\b(vel|pas|chu|des)\s+\d+", full_screen_norm):
            return None

        # 2. IDENTIFICAÇÃO DE TELAS VÁLIDAS
        is_squad_or_training = any(
            k in full_screen_norm
            for k in [
                "treinamento",
                "potencial",
                "melhorar",
                "pontuacao",
                "pontua",
                "ida.",
                "transferencia",
                "venda rapida",
                "ofertas",
                "titulares",
                "reservas",
            ]
        )

        # A tela de estatísticas da partida tem "JOGADOR" e "VOLTAR", mas NÃO tem "PONTUAÇÃO" nem "TREINAMENTO"
        is_stats_table = (
            not is_squad_or_training
            and "jogador" in full_screen_norm
            and "voltar" in full_screen_norm
        )

        if not (is_squad_or_training or is_stats_table):
            return None

        target_norm = normalize_text(target_player_name)
        candidate_anchors: List[Dict[str, Any]] = []
        parsed_items: List[Dict[str, Any]] = []
        detected_club: Optional[str] = None

        for bbox, text, conf in results:
            clean_text = text.strip()
            if not clean_text:
                continue
            metrics = self._get_box_metrics(bbox)
            item = {
                "text": clean_text,
                "norm_text": normalize_text(clean_text),
                "confidence": round(float(conf), 3),
                "bbox": bbox,
                **metrics,
            }
            parsed_items.append(item)

            # Detecta o nome do clube no cabeçalho superior esquerdo (ao lado do escudo)
            if metrics["center_y"] < H * 0.11 and (W * 0.10 < metrics["center_x"] < W * 0.45):
                if clean_text.upper() not in {"VOLTAR", "JOGADOR"} and len(clean_text) >= 2:
                    detected_club = clean_text

            if target_norm in item["norm_text"]:
                # Ignora caso esteja colado na borda inferior extrema (y > 96%)
                if item["center_y"] < H * 0.96:
                    candidate_anchors.append(item)

        if not candidate_anchors:
            return None

        # Ordena candidatos de baixo para cima se for tela de Transferências (para preferir a tabela "Venda Rápida" que tem Overall e Idade)
        # ou pela confiança
        best_result: Optional[Dict[str, Any]] = None

        for player_anchor in candidate_anchors:
            player_y = player_anchor["center_y"]
            player_height = player_anchor["height"]
            player_min_y = int(player_anchor["min_y"])
            player_max_y = int(player_anchor["max_y"])
            vertical_threshold = max(12.0, player_height * 0.85)

            row_items = [
                item
                for item in parsed_items
                if abs(item["center_y"] - player_y) < vertical_threshold
            ]
            row_items.sort(key=lambda x: x["min_x"])
            raw_row_tokens = [item["text"] for item in row_items]

            # Detecta a posição na linha (à esquerda do nome do jogador)
            detected_position: Optional[str] = None
            for item in row_items:
                if item["center_x"] < player_anchor["center_x"]:
                    token_up = item["text"].strip().upper()
                    if token_up in VALID_POSITIONS:
                        detected_position = token_up

            age: Optional[int] = None
            overall: Optional[int] = None
            matches: Optional[int] = None
            goals: Optional[int] = None
            assists: Optional[int] = None

            cell_y1 = player_min_y - 3
            cell_y2 = player_max_y + 5

            # CENÁRIO 1: TELA DE TREINAMENTO, ELENCO OU TRANSFERÊNCIAS (Overall e Idade)
            if is_squad_or_training:
                screen_type = "TRAINING_OR_SQUAD"
                right_items = [item for item in row_items if item["center_x"] > player_anchor["center_x"]]

                clean_integers = []
                for item in right_items:
                    t = item["text"]
                    # Ignora valores em dinheiro ($160K, $87K, S80K) e faixas de potencial (79 - 97)
                    if "$" in t or "k" in t.lower() or "-" in t:
                        continue
                    nums = [int(n) for n in re.findall(r"\b\d+\b", t)]
                    clean_integers.extend(nums)

                for val in clean_integers:
                    if overall is None and 30 <= val <= 99:
                        overall = val
                    elif age is None and 15 <= val <= 45:
                        age = val

                # Fallback por célula isolada caso o OCR da tela cheia tenha pulado o número de Pontuação ou Idade
                if overall is None:
                    cell_ovr = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.560), int(W * 0.618))
                    if cell_ovr is not None and 30 <= cell_ovr <= 99:
                        overall = cell_ovr

                if age is None:
                    cell_age = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.620), int(W * 0.675))
                    if cell_age is not None and 15 <= cell_age <= 45:
                        age = cell_age

            # CENÁRIO 2: TELA DE ESTATÍSTICAS DA PARTIDA / TEMPORADA
            else:
                screen_type = "MATCH_STATS"
                matches = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.475), int(W * 0.520))
                goals = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.520), int(W * 0.565))
                assists = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.565), int(W * 0.610))

            candidate_res = {
                "screen_type": screen_type,
                "player_matched": player_anchor["text"],
                "confidence": player_anchor["confidence"],
                "raw_row_tokens": raw_row_tokens,
                "position": detected_position,
                "club_name": detected_club,
                "age": age,
                "overall": overall,
                "matches": matches,
                "goals": goals,
                "assists": assists,
            }

            best_result = candidate_res
            # Se já encontrou Overall/Idade válidos ou Jogos/Gols válidos, pode parar de procurar outras ocorrências
            if (screen_type == "TRAINING_OR_SQUAD" and overall is not None) or (
                screen_type == "MATCH_STATS" and matches is not None
            ):
                break

        return best_result


# Alias de compatibilidade
WSCVisionScanner = OCRScanner
