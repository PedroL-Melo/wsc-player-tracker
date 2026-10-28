@echo off
chcp 65001 >nul
title WSC Player Career Tracker - Gerador de Instalador (.exe)
echo ============================================================================
echo   WSC PLAYER CAREER TRACKER - GERADOR DE INSTALADOR (.EXE)
echo ============================================================================
echo.

REM 1. Empacotar o motor Python (FastAPI + EasyOCR + OpenCV) com PyInstaller
echo [1/3] Preparando e compilando o motor de Visao Computacional (wsc-backend.exe)...
cd /d "%~dp0backend-engine"

if not exist "venv\Scripts\python.exe" (
    echo [ERRO] Ambiente virtual venv nao encontrado em backend-engine\venv!
    pause
    exit /b 1
)

call venv\Scripts\pip.exe install pyinstaller
if errorlevel 1 (
    echo [ERRO] Falha ao instalar o PyInstaller.
    pause
    exit /b 1
)

venv\Scripts\pyinstaller.exe --noconfirm --onedir --name wsc-backend ^
    --collect-all easyocr ^
    --hidden-import uvicorn.logging ^
    --hidden-import uvicorn.loops ^
    --hidden-import uvicorn.loops.auto ^
    --hidden-import uvicorn.protocols ^
    --hidden-import uvicorn.protocols.http ^
    --hidden-import uvicorn.protocols.http.auto ^
    --hidden-import uvicorn.protocols.websockets ^
    --hidden-import uvicorn.protocols.websockets.auto ^
    --hidden-import uvicorn.lifespan ^
    --hidden-import uvicorn.lifespan.on ^
    --hidden-import win32gui ^
    --hidden-import win32ui ^
    --hidden-import win32con ^
    run_server.py

if errorlevel 1 (
    echo [ERRO] Falha ao gerar o executavel do backend Python.
    pause
    exit /b 1
)

echo.
echo [2/3] Verificando electron-builder no projeto Desktop...
cd /d "%~dp0desktop-ui"

if not exist "node_modules\electron-builder" (
    call npm install -D electron-builder
)

echo.
echo [3/3] Gerando o Instalador Windows (.exe) com Electron Builder...
call npm run dist

if errorlevel 1 (
    echo [ERRO] Falha ao empacotar o instalador Electron.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   CONCLUIDO COM SUCESSO!
echo   O instalador (.exe) foi gerado na pasta:
echo   desktop-ui\release\
echo ============================================================================
pause
