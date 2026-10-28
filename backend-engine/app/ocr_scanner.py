"""Motor de Visão Computacional Autônomo com Validação Rigorosa de Telas Oficiais do WSC."""
import re
from typing import Dict, Any, List, Optional
import numpy as np
import cv2
import torch
import easyocr


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
        Só lê dados se a tela for comprovadamente uma tabela oficial:
        - Tabela de Estatísticas Pós-Jogo (precisa ter 'JOGADOR' e 'VOLTAR')
        - Tabela de Treinamento / Elenco (precisa ter 'TREINAMENTO' ou 'POTENCIAL' ou 'TRANSFER')
        Em jogo, intervalo ou animações, DESCARTA o frame para evitar falsos positivos!
        """
        if frame is None or not target_player_name.strip():
            return None

        results = self.reader.readtext(frame)
        if not results:
            return None

        all_screen_texts = [text.strip().lower() for _, text, _ in results if text.strip()]
        full_screen_str = " ".join(all_screen_texts)

        # 1. TRAVA ANTI-JOGO: Se for partida rolando, intervalo ou posse de bola, ignora na hora!
        is_in_match = any(k in full_screen_str for k in [
            "posse de bola", "intervalo", "fase de grupos", "vel ", "pas ", "chu ", "des "
        ])
        if is_in_match:
            return None

        # 2. IDENTIFICAÇÃO DE TELAS VÁLIDAS
        is_training_screen = any(k in full_screen_str for k in ["treinamento", "potencial", "melhorar"])
        is_transfer_screen = any(k in full_screen_str for k in ["transferencias", "transferências", "venda rápida", "ofertas"])
        
        # A tela de estatísticas da partida precisa obrigatoriamente ter a palavra "JOGADOR" e "VOLTAR"
        is_stats_table = "jogador" in full_screen_str and any(k in full_screen_str for k in ["voltar", "ortri"])

        # Se não for nenhuma tela de tabela reconhecida, não lê nada
        if not (is_training_screen or is_transfer_screen or is_stats_table):
            return None

        target_lower = target_player_name.strip().lower()
        player_anchor = None
        parsed_items = []

        for bbox, text, conf in results:
            clean_text = text.strip()
            if not clean_text:
                continue
            metrics = self._get_box_metrics(bbox)
            item = {
                "text": clean_text,
                "confidence": round(float(conf), 3),
                "bbox": bbox,
                **metrics,
            }
            parsed_items.append(item)

            if target_lower in clean_text.lower():
                # No campo de futebol o nome aparece no canto inferior em y > 80% da tela.
                # Numa tabela de jogadores, a lista fica no meio da tela (y entre 15% e 80%).
                H, _, _ = frame.shape
                if item["center_y"] < H * 0.85:
                    if player_anchor is None or conf > player_anchor["confidence"]:
                        player_anchor = item

        if player_anchor is None:
            return None

        H, W, _ = frame.shape
        player_y = player_anchor["center_y"]
        player_height = player_anchor["height"]
        player_min_y = int(player_anchor["min_y"])
        player_max_y = int(player_anchor["max_y"])
        vertical_threshold = player_height * 0.8

        row_items = [
            item
            for item in parsed_items
            if abs(item["center_y"] - player_y) < vertical_threshold
        ]
        row_items.sort(key=lambda x: x["min_x"])
        raw_row_tokens = [item["text"] for item in row_items]

        age: Optional[int] = None
        overall: Optional[int] = None
        matches: Optional[int] = None
        goals: Optional[int] = None
        assists: Optional[int] = None

        # CENÁRIO 1: TELA DE TREINAMENTO OU TRANSFERÊNCIAS (Overall e Idade)
        if is_training_screen or is_transfer_screen:
            screen_type = "TRAINING_OR_SQUAD"
            right_items = [item for item in row_items if item["center_x"] > player_anchor["center_x"]]

            clean_integers = []
            for item in right_items:
                t = item["text"]
                if "$" in t or "k" in t.lower() or "-" in t:
                    continue
                nums = [int(n) for n in re.findall(r"\b\d+\b", t)]
                clean_integers.extend(nums)

            for val in clean_integers:
                if overall is None and 30 <= val <= 99:
                    overall = val
                elif age is None and 15 <= val <= 45:
                    age = val

        # CENÁRIO 2: TELA DE ESTATÍSTICAS DA PARTIDA / TEMPORADA
        elif is_stats_table:
            screen_type = "MATCH_STATS"
            cell_y1 = player_min_y - 2
            cell_y2 = player_max_y + 4

            matches = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.475), int(W * 0.520))
            goals = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.520), int(W * 0.565))
            assists = self._read_cell_digit(frame, cell_y1, cell_y2, int(W * 0.565), int(W * 0.610))
        else:
            return None

        return {
            "screen_type": screen_type,
            "player_matched": player_anchor["text"],
            "confidence": player_anchor["confidence"],
            "raw_row_tokens": raw_row_tokens,
            "age": age,
            "overall": overall,
            "matches": matches,
            "goals": goals,
            "assists": assists,
        }


# Alias de compatibilidade
WSCVisionScanner = OCRScanner
