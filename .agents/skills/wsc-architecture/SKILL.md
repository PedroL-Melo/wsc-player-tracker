---
name: wsc-architecture
description: Use esta skill sempre que for criar a estrutura do projeto, configurar o servidor FastAPI, WebSockets, SQLite ou construir a interface Desktop com Electron, React e TailwindCSS para o WSC Player Career Tracker.
---

# Arquitetura Híbrida Desktop (Electron + React + FastAPI)

## Stack Tecnológica Obrigatória
1. **Motor Back-end (`backend-engine/`):**
   - Python 3.11+ com **FastAPI** e **Uvicorn**.
   - **WebSockets** nativos do FastAPI para enviar atualizações em tempo real para o front-end assim que um gol, assistência ou mudança de Overall for detectado.
   - **SQLite** com **SQLAlchemy** para salvar o histórico localmente (`wsc_tracker.db`).
2. **Interface Desktop (`desktop-ui/`):**
   - **Electron** + **React (Vite)** + **TailwindCSS** + **Lucide Icons** + **Recharts**.
   - Tema obrigatoriamente Dark Mode (estilo dashboard gamer/streamer, cores baseadas em `slate-950`, `emerald-500` para evolução positiva e `amber-400` para destaques/títulos).
3. **Padrão de Comunicação:**
   - O front-end React consome a API REST local (`http://127.0.0.1:8000`) para carregar dados históricos e mantém conexão WebSocket (`ws://127.0.0.1:8000/ws/live`) para receber eventos ao vivo do jogo.
