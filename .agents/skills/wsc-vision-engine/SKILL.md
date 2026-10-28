---
name: wsc-vision-engine
description: Use esta skill ao programar captura de tela de emuladores (MuMu/LDPlayer), processamento de imagem com OpenCV ou extração automática de textos e números de jogadores com EasyOCR.
---

# Motor de Visão Computacional Autônomo (Zero-Click OCR)

## Regra Absoluta de UX
O usuário NUNCA deve precisar enviar prints ou apertar botões para atualizar estatísticas. O Python deve monitorar silenciosamente a janela do emulador em segundo plano.

## Pipeline Técnico de Captura e Leitura
1. **Captura de Janela (`window_capture.py`):**
   - Use `pygetwindow` (ou `win32gui`) para listar janelas abertas e localizar o emulador escolhido pelo usuário.
   - Use `mss` para capturar os frames da janela em memória RAM (array NumPy BGR) a cada 1.5 segundos.
2. **Varredura por Âncora Horizontal (`ocr_scanner.py`):**
   - Inicialize o `easyocr.Reader(['pt', 'en'], gpu=True)` apenas UMA vez no startup (Singleton) para aproveitar a GPU NVIDIA via CUDA.
   - Use a técnica de **Horizontal Row Anchoring**:
     a) Procure na imagem o texto correspondente ao `target_player_name`.
     b) Ao encontrar a Bounding Box do nome do jogador, pegue a coordenada vertical central (`center_y`) e a altura (`height`) dessa caixa.
     c) Agrupe todos os outros blocos de texto/números detectados no mesmo frame cujo `center_y` esteja na mesma faixa horizontal (`abs(item_y - player_y) < height * 0.8`).
     d) Ordene esses itens da esquerda para a direita (pelo eixo `X`) para extrair automaticamente Idade, Overall, Jogos, Gols e Assistências.
