"""Script de teste interativo para captura de tela em tempo real."""
import sys
import time
import cv2

from app.window_capture import EmulatorWindowCapture


def main():
    print("=" * 60)
    print("   TESTE DE CAPTURA DE JANELA - WSC PLAYER TRACKER")
    print("=" * 60)

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
            choice = input("\nDigite o número da janela para capturar (ou 'q' para sair): ").strip()
            if choice.lower() == 'q':
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

    print(f"\n[+] Alvo selecionado: '{selected_title}'")
    print("[*] Iniciando loop de captura... Pressione 'q' na janela do vídeo para encerrar.\n")

    window_display_name = f"Captura Ao Vivo: {selected_title[:30]}"
    cv2.namedWindow(window_display_name, cv2.WINDOW_NORMAL)

    try:
        fps_time = time.time()
        frames_count = 0
        fps = 0.0

        while True:
            frame = capturer.capture_window(selected_title)

            if frame is None:
                # Janela pode ter sido fechada ou minimizada
                time.sleep(0.1)
                continue

            frames_count += 1
            if time.time() - fps_time >= 1.0:
                fps = frames_count / (time.time() - fps_time)
                frames_count = 0
                fps_time = time.time()

            # Renderiza FPS no canto do frame
            display_frame = frame.copy()
            cv2.putText(
                display_frame,
                f"FPS: {fps:.1f} | 'q' para sair",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow(window_display_name, display_frame)

            # Aguarda 1ms por tecla 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except KeyboardInterrupt:
        print("\n[!] Interrompido pelo teclado.")
    finally:
        capturer.close()
        cv2.destroyAllWindows()
        print("[+] Teste finalizado.")


if __name__ == "__main__":
    main()
