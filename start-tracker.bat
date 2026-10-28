@echo off
chcp 65001 >nul
title WSC Player Career Tracker - Inicializador

echo ====================================================================
echo          WSC PLAYER CAREER TRACKER - MODO STREAMER / PRO
echo ====================================================================
echo.

set "ROOT_DIR=%~dp0"

:: Verifica se a porta 8000 ja esta em uso (caso o backend ja esteja aberto)
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo [OK] Servidor FastAPI ja esta rodando na porta 8000.
) else (
    echo [*] Iniciando Motor Back-end FastAPI + EasyOCR CUDA...
    start "WSC Backend Engine (FastAPI)" cmd /k "cd /d "%ROOT_DIR%backend-engine" && .\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000"
    timeout /t 3 /nobreak >nul
)

echo [*] Iniciando Interface Desktop (Vite + React + Electron)...
cd /d "%ROOT_DIR%desktop-ui"
call npm run desktop
