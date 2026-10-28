# ⚽ WSC Player Career Tracker (Zero-Click AI Edition)

> **Rastreador autônomo de carreira de jogador para World Soccer Champs (WSC)** utilizando **Visão Computacional na GPU (EasyOCR + CUDA)**, **FastAPI**, **WebSockets**, **SQLite** e uma interface desktop moderna inspirada no EA FC / Sofascore construída em **Electron + React + TailwindCSS**.

---

## 🌟 Visão Geral do Projeto

No *World Soccer Champs*, não existe um histórico detalhado que acompanhe gol a gol, jogo a jogo e a evolução de Overall de um jogador ao longo de múltiplas temporadas.

O **WSC Player Career Tracker** resolve isso de forma **100% autônoma (Zero-Click)**:
- Você **não precisa tirar prints** nem apertar botões para atualizar.
- O motor em segundo plano captura silenciosamente a janela do emulador (MuMu Player / LDPlayer / BlueStacks) via API nativa do Windows (DirectX/OBS Style), sem roubar o foco da sua tela.
- Através de **Inteligência Artificial (EasyOCR com aceleração por GPU NVIDIA via CUDA)** e algoritmos de ancoragem horizontal, o sistema reconhece quando a partida acaba, extrai gols, assistências, jogos e evolução de Overall, deduplica os dados e atualiza o dashboard em tempo real via **WebSockets**.

---

## 🚀 Funcionalidades Principais

1. **Captura Real em Segundo Plano (OBS Style):**
   - Utiliza `PrintWindow` com `PW_RENDERFULLCONTENT = 2` para capturar frames da janela do emulador mesmo que ela esteja coberta pelo VS Code, pelo navegador ou pelo próprio dashboard.
2. **Motor de Visão com Filtro Anti-Ruído:**
   - Detecta e ignora frames durante a partida em andamento, intervalos ou comemorações.
   - Extrai estatísticas exclusivamente nas telas oficiais pós-jogo e telas de treino/elenco.
3. **Deduplicação Inteligente (Anti-Spam):**
   - Compara leituras com o último estado conhecido em memória RAM e no banco SQLite antes de persistir, evitando eventos duplicados.
4. **Dashboard Gamer / Streamer (Electron + React):**
   - **Hero Card EA FC:** Badge dinâmico de Overall (Bronze, Prata, Ouro e Elite Esmeralda).
   - **Métricas da Carreira:** Total de jogos, gols, assistências, média de G+A e troféus conquistados.
   - **Gráficos Recharts:** Evolução de Overall por temporada/idade e gráfico de produção ofensiva (Gols vs Assistências).
   - **Histórico e Edição Manual Rápida:** Tabela completa de temporadas, botão para iniciar nova temporada e edição inline para eventuais correções manuais.
   - **Feed de Evolução Ao Vivo:** Notificações em tempo real (toasts animados e histórico lateral) a cada gol, assistência, subida de overall ou transferência detectada.

---

## 📁 Estrutura de Pastas e Arquivos

```text
wsc-player-tracker/
│
├── .agents/                          # Regras e habilidades do agente de IA
│   └── skills/
│       ├── wsc-architecture/         # Padrões de arquitetura Electron + FastAPI
│       ├── wsc-database-dedup/       # Modelagem SQLAlchemy e regras anti-spam
│       └── wsc-vision-engine/        # Diretrizes de captura de tela e OCR
│
├── backend-engine/                   # Motor Back-end em Python
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py               # Conexão SQLite (wsc_tracker.db) e Sessão
│   │   ├── models.py                 # Modelos: CareerProfile, SeasonLog, EvolutionEvent
│   │   ├── window_capture.py         # Captura em segundo plano (PrintWindow + MSS Fallback)
│   │   ├── ocr_scanner.py            # EasyOCR Singleton + Ancoragem Horizontal e Filtro de Telas
│   │   ├── watcher_service.py        # Serviço em loop assíncrono (1.5s) e WebSocket Manager
│   │   └── main.py                   # API FastAPI REST e rotas WebSocket (/ws/live)
│   ├── requirements.txt              # Dependências Python
│   ├── test_capture.py               # Script interativo de teste visual de janelas
│   └── test_ocr_live.py              # Script interativo de teste do OCR no terminal
│
├── desktop-ui/                       # Interface Desktop Nativa
│   ├── electron/
│   │   └── main.js                   # Janela Desktop 1280x800 sem menu padrão
│   ├── src/
│   │   ├── App.jsx                   # Dashboard completo com WebSockets e Recharts
│   │   ├── index.css                 # Estilos globais e scrollbar personalizada
│   │   └── main.jsx                  # Ponto de montagem React 18
│   ├── index.html                    # HTML base com tema Dark Mode
│   ├── package.json                  # Dependências React, Tailwind, Lucide, Electron
│   ├── tailwind.config.js            # Configuração de temas e cores
│   └── vite.config.js                # Configuração do Vite
│
├── start-tracker.bat                 # Inicializador automático em 1 clique (Windows)
├── .gitignore                        # Arquivos ignorados pelo Git (venv, node_modules, db)
└── README.md                         # Documentação completa do projeto
```

---

## 🛠️ Tecnologias Utilizadas

### Back-end
- **Python 3.11+ / 3.13**
- **FastAPI** + **Uvicorn**
- **WebSockets** nativos
- **SQLAlchemy** + **SQLite**
- **PyTorch (CUDA 12.4)** + **EasyOCR** (reconhecimento óptico acelerado por GPU)
- **OpenCV** + **MSS** + **PyWin32** + **PyGetWindow**

### Front-end / Desktop
- **Electron 33**
- **React 18** + **Vite**
- **TailwindCSS** (Tema Dark Mode Streamer)
- **Recharts** (Gráficos de evolução e barras)
- **Lucide Icons**

---

## 💻 Como Iniciar o Projeto na sua Máquina

### Pré-requisitos
1. **Python 3.11 ou superior** instalado no Windows (com a opção *Add to PATH* marcada).
2. **Node.js 18 ou superior** instalado.
3. Placa de vídeo NVIDIA (opcional, mas altamente recomendada para OCR em tempo real via CUDA).
4. Emulador Android (MuMu Player 12, LDPlayer ou BlueStacks) rodando o World Soccer Champs.

---

### Passo 1: Configurar o Back-end Python

Abra o terminal PowerShell na pasta `backend-engine`:

```powershell
cd backend-engine

# 1. Crie o ambiente virtual
py -3.13 -m venv venv

# 2. Instale o PyTorch com suporte a CUDA (GPU NVIDIA)
.\venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 3. Instale as demais dependências
.\venv\Scripts\pip install -r requirements.txt
```

---

### Passo 2: Configurar o Front-end Desktop

Em outro terminal, acesse a pasta `desktop-ui`:

```powershell
cd desktop-ui

# Instale os pacotes npm
npm install
```

---

### Passo 3: Executar a Aplicação

Você tem duas maneiras de iniciar:

#### Opção A: Inicialização Automática (1 Clique - Recomendado)
Dê um duplo clique no arquivo:
```text
start-tracker.bat
```
Ele verificará se o servidor FastAPI já está rodando (iniciando-o caso necessário) e abrirá a janela do aplicativo Desktop automaticamente!

#### Opção B: Inicialização Manual (Dois Terminais)

**Terminal 1 (Back-end):**
```powershell
cd backend-engine
.\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```
*(Documentação Swagger disponível em `http://127.0.0.1:8000/docs`)*

**Terminal 2 (Desktop):**
```powershell
cd desktop-ui
npm run desktop
```

---

## 🎮 Como Usar

1. Abra o seu emulador (ex: **MuMu Player**) com o **World Soccer Champs**.
2. Abra o **WSC Player Career Tracker**.
3. Clique em **"+ Nova Carreira"**:
   - Digite o nome do jogador exatamente como aparece no jogo (ex: `Maicon Ramos`).
   - Selecione a janela do emulador detectada (ex: `Android Device` ou `MuMu Player`).
   - Defina posição, clube inicial, idade e overall inicial.
4. Clique no botão **"Iniciar Olho Biônico"** no topo da tela:
   - O indicador mudará para **"OLHO BIÔNICO ATIVO"** pulsando em verde.
5. Jogue normalmente! Ao final de cada partida, quando a tela de notas/estatísticas for exibida, o tracker registrará os jogos, gols e assistências instantaneamente no dashboard!

---

## 📄 Licença
Distribuído sob a licença MIT. Sinta-se livre para customizar e aprimorar para suas gameplays e lives!
