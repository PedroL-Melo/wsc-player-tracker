"""Script de teste ao vivo do OCR com Ancoragem Horizontal em segundo plano."""
import time
from datetime import datetime

from app.window_capture import EmulatorWindowCapture
from app.ocr_scanner import OCRScanner


def main():
    print("=" * 70)
    print("   TESTE DE OCR AO VIVO (ZERO-CLICK / BACKGROUND) - WSC TRACKER")
    print("=" * 70)

    capturer = EmulatorWindowCapture()
    windows = capturer.list_open_windows()

    if not windows:
        print("[!] Nenhuma janela ativa encontrada.")
        return

    print("\nJanelas visíveis encontradas:")
    for idx, title in enumerate(windows, start=1):
        print(f"  [{idx:2d}] {title}")

    selected_title = None
    while True:
        try:
            choice = input("\nDigite o número da janela do emulador (ou 'q' para sair): ").strip()
            if choice.lower() == "q":
                print("Operação cancelada.")
                return
            idx = int(choice)
            if 1 <= idx <= len(windows):
                selected_title = windows[idx - 1]
                break
            else:
                print(f"[!] Digite um número válido entre 1 e {len(windows)}.")
        except ValueError:
            print("[!] Entrada inválida. Digite um número ou 'q'.")

    target_player = ""
    while not target_player:
        target_player = input("\nDigite o nome (ou sobrenome) do jogador visível na tela: ").strip()
        if not target_player:
            print("[!] O nome do jogador não pode ser vazio.")

    print(f"\n[+] Janela selecionada : '{selected_title}'")
    print(f"[+] Jogador monitorado : '{target_player}'")
    print("[*] Inicializando motor EasyOCR (Singleton)...")

    scanner = OCRScanner()

    print("\n[*] Monitoramento iniciado em segundo plano (intervalo: 1.5s).")
    print("    Você pode deixar esta janela por cima do emulador! Pressione Ctrl+C para encerrar.\n")
    print("-" * 70)

    try:
        while True:
            start_t = time.time()
            timestamp = datetime.now().strftime("%H:%M:%S")

            frame = capturer.capture_window(selected_title)
            if frame is None:
                print(f"[{timestamp}] [!] Não foi possível capturar a janela '{selected_title}'.")
                time.sleep(1.5)
                continue

            data = scanner.scan_frame_for_player(frame, target_player)
            elapsed = time.time() - start_t

            if data is None:
                print(f"[{timestamp}] ({elapsed:.2f}s) Jogador '{target_player}' não detectado na tela atual.")
            else:
                print(f"[{timestamp}] ({elapsed:.2f}s) JOGADOR DETECTADO: '{data['player_matched']}' (conf: {data['confidence']})")
                print(f"   ├─ Linha (Esq -> Dir) : {' | '.join(data['raw_row_tokens'])}")
                print(f"   ├─ Números Extraídos  : {data['numbers_extracted']} (Todos na linha: {data['all_row_numbers']})")
                print(
                    f"   └─ Estatísticas       : "
                    f"Idade={data['age']} | OVR={data['overall']} | "
                    f"Jogos={data['matches']} | Gols={data['goals']} | Assist={data['assists']}"
                )
                print("-" * 70)

            # Aguarda até completar o ciclo de 1.5s
            sleep_time = max(0.1, 1.5 - (time.time() - start_t))
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n[!] Monitoramento encerrado pelo usuário.")
    finally:
        capturer.close()


if __name__ == "__main__":
    main()
