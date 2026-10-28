"""Ponto de entrada para empacotamento executável (PyInstaller) do motor WSC."""
import multiprocessing
import os
import sys
import uvicorn

# Garante que os módulos locais da pasta app sejam encontrados
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app  # noqa: E402


if __name__ == "__main__":
    multiprocessing.freeze_support()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
