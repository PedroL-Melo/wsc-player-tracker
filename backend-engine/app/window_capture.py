"""Módulo de captura de janela de emuladores e janelas do Windows (Background & MSS Fallback)."""
import ctypes
from typing import List, Optional
import numpy as np
import mss
import pygetwindow as gw
import win32gui
import win32ui
import win32con

PW_RENDERFULLCONTENT = 2


class EmulatorWindowCapture:
    """Responsável por localizar janelas ativas e capturar frames em segundo plano via Win32 PrintWindow (com fallback para MSS)."""

    def __init__(self):
        self._sct = mss.mss()

    @staticmethod
    def list_open_windows() -> List[str]:
        """Retorna uma lista ordenada com os títulos de todas as janelas visíveis não-vazias."""
        windows = gw.getAllWindows()
        titles = []
        for w in windows:
            title = w.title.strip()
            if title and w.visible and title not in titles:
                titles.append(title)
        return sorted(titles, key=lambda s: s.lower())

    def _find_window(self, window_title_substring: str):
        """Busca uma janela pelo substring do título."""
        matches = gw.getWindowsWithTitle(window_title_substring)
        if not matches:
            all_windows = gw.getAllWindows()
            sub_lower = window_title_substring.lower()
            matches = [w for w in all_windows if sub_lower in w.title.lower()]
        return matches[0] if matches else None

    def _capture_with_print_window(self, hwnd: int, width: int, height: int) -> Optional[np.ndarray]:
        """Captura o buffer de vídeo da janela diretamente via Win32 PrintWindow (funciona em segundo plano)."""
        hwnd_dc = None
        mfc_dc = None
        save_dc = None
        save_bitmap = None

        try:
            hwnd_dc = win32gui.GetWindowDC(hwnd)
            mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
            save_dc = mfc_dc.CreateCompatibleDC()

            save_bitmap = win32ui.CreateBitmap()
            save_bitmap.CreateCompatibleBitmap(mfc_dc, width, height)
            save_dc.SelectObject(save_bitmap)

            # PW_RENDERFULLCONTENT (2) permite capturar contextos DirectX/OpenGL como no OBS
            result = ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), PW_RENDERFULLCONTENT)
            if result != 1:
                result = ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 0)

            bmpinfo = save_bitmap.GetInfo()
            bmpstr = save_bitmap.GetBitmapBits(True)

            frame = np.frombuffer(bmpstr, dtype=np.uint8).reshape((bmpinfo["bmHeight"], bmpinfo["bmWidth"], 4))
            frame_bgr = np.ascontiguousarray(frame[:, :, :3])

            # Verifica se o frame capturado não é totalmente preto
            if result == 1 and np.mean(frame_bgr) > 1.0:
                return frame_bgr
            return None
        except Exception:
            return None
        finally:
            if save_bitmap is not None:
                try:
                    win32gui.DeleteObject(save_bitmap.GetHandle())
                except Exception:
                    pass
            if save_dc is not None:
                try:
                    save_dc.DeleteDC()
                except Exception:
                    pass
            if mfc_dc is not None:
                try:
                    mfc_dc.DeleteDC()
                except Exception:
                    pass
            if hwnd_dc is not None:
                try:
                    win32gui.ReleaseDC(hwnd, hwnd_dc)
                except Exception:
                    pass

    def _capture_with_mss(self, left: int, top: int, width: int, height: int) -> Optional[np.ndarray]:
        """Fallback: captura a região física da tela usando MSS."""
        try:
            monitor = {
                "top": max(0, top),
                "left": max(0, left),
                "width": width,
                "height": height,
            }
            raw_shot = self._sct.grab(monitor)
            frame = np.array(raw_shot, dtype=np.uint8)
            return np.ascontiguousarray(frame[:, :, :3])
        except Exception:
            return None

    def capture_window(self, window_title_substring: str) -> Optional[np.ndarray]:
        """Localiza a janela pelo título, restaura se minimizada e captura o frame em array NumPy (BGR)."""
        window = self._find_window(window_title_substring)
        if not window:
            return None

        hwnd = window._hWnd

        # Restaurar se estiver minimizada (sem roubar foco quando possível)
        if win32gui.IsIconic(hwnd) or window.isMinimized:
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

        try:
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        except Exception:
            return None

        width = right - left
        height = bottom - top

        if width <= 0 or height <= 0:
            return None

        # 1. Tenta captura em segundo plano via PrintWindow (PW_RENDERFULLCONTENT = 2)
        frame_bgr = self._capture_with_print_window(hwnd, width, height)
        if frame_bgr is not None:
            return frame_bgr

        # 2. Fallback automático para MSS caso PrintWindow retorne frame preto ou falhe
        return self._capture_with_mss(left, top, width, height)

    def close(self):
        """Libera recursos da instância MSS."""
        if hasattr(self, "_sct") and self._sct:
            self._sct.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
