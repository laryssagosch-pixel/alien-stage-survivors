"""Inicia o Alien Stage: Survivors e abre no navegador.
Uso: python run.py [porta]      (padrão: 8000)
"""
import gzip, http.server, os, pathlib, shutil, socketserver, subprocess, sys, threading, time, webbrowser

BASE = pathlib.Path(__file__).resolve().parent
import socket


def porta_ocupada(p):
    with socket.socket() as s:
        s.settimeout(.4)
        return s.connect_ex(("127.0.0.1", p)) == 0


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
while porta_ocupada(PORT):  # servidor antigo ainda ligado: usa a próxima porta livre
    print(f"Porta {PORT} já está em uso (provavelmente a versão antiga). Tentando {PORT + 1}...")
    PORT += 1
URL = f"http://localhost:{PORT}"


def init_db():
    subprocess.run([sys.executable, str(BASE / "python" / "init_db.py")], check=False)


def open_browser():
    time.sleep(1.2)
    webbrowser.open(URL)


def run_with_php(php):
    print(f"Servidor PHP rodando em {URL}  (Ctrl+C para parar)")
    threading.Thread(target=open_browser, daemon=True).start()
    try:
        subprocess.run([php, "-S", f"localhost:{PORT}", "-t", str(BASE)], cwd=BASE)
    except KeyboardInterrupt:
        print("\nServidor encerrado.")


def run_without_php():
    print("PHP não encontrado: iniciando só com Python.")
    print("Modo CONVIDADO funciona; login/cadastro e ranking precisam do PHP.\n")
    os.chdir(BASE)
    GZ = {}                                   # cache dos arquivos de texto já comprimidos: {caminho: (mtime, bytes)}
    TEXTO = (".html", ".js", ".css", ".json", ".svg", ".txt", ".sql")

    class handler(http.server.SimpleHTTPRequestHandler):
        protocol_version = "HTTP/1.1"            # conexões persistentes: carrega dezenas de arquivos bem mais rápido
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".webp": "image/webp", ".js": "text/javascript"}

        def end_headers(self):
            # imagens/áudio mudam pouco: cache de 1h. Código (html/js/css): sempre revalida, então edições aparecem na hora.
            self.send_header("Cache-Control", "public, max-age=3600" if self.path.startswith("/assets/") else "no-cache")
            self.send_header("Accept-Ranges", "bytes")
            super().end_headers()

        def do_GET(self):
            path = self.translate_path(self.path.split("?")[0].split("#")[0])
            if os.path.isfile(path):
                try:
                    rng = self.headers.get("Range")
                    if rng and rng.startswith("bytes="):               # áudio/vídeo: o navegador pede pedaços (e para buscar no meio)
                        return self.enviar_faixa(path, rng[6:])
                    if path.lower().endswith(TEXTO) and "gzip" in (self.headers.get("Accept-Encoding") or ""):
                        return self.enviar_gzip(path)                   # js/css/html ~4x menores
                except (BrokenPipeError, ConnectionResetError):
                    return
            try:
                super().do_GET()
            except (BrokenPipeError, ConnectionResetError):
                pass

        def enviar_gzip(self, path):
            mt = os.path.getmtime(path); c = GZ.get(path)
            if not c or c[0] != mt:
                with open(path, "rb") as f: c = GZ[path] = (mt, gzip.compress(f.read(), 6))
            self.send_response(200); self.send_header("Content-Type", self.guess_type(path)); self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(c[1]))); self.end_headers(); self.wfile.write(c[1])

        def enviar_faixa(self, path, spec):
            size = os.path.getsize(path)
            try:
                a, b = spec.split(",")[0].split("-", 1)
                start = size - int(b) if not a else int(a); end = size - 1 if (not a or not b) else min(int(b), size - 1)
                if not a: end = size - 1
            except ValueError:
                return super().do_GET()
            if start < 0 or start >= size or start > end:
                self.send_response(416); self.send_header("Content-Range", f"bytes */{size}"); self.send_header("Content-Length", "0"); self.end_headers(); return
            self.send_response(206); self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}"); self.send_header("Content-Length", str(end - start + 1)); self.end_headers()
            with open(path, "rb") as f:
                f.seek(start); resto = end - start + 1
                while resto > 0:
                    pedaco = f.read(min(65536, resto))
                    if not pedaco: break
                    self.wfile.write(pedaco); resto -= len(pedaco)

    http.server.ThreadingHTTPServer.allow_reuse_address = (os.name != "nt")
    with http.server.ThreadingHTTPServer(("localhost", PORT), handler) as srv:
        print(f"Servidor rodando em {URL}  (Ctrl+C para parar)")
        threading.Thread(target=open_browser, daemon=True).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")


NECESSARIOS = ["index.html", "css/style.css", "js/api.js", "js/chars.js", "assets/chars/sua/0.png", "assets/ui/poster.webp", "js/game.js", "js/ui.js", "js/maps.js", "js/fx.js", "js/combos.js", "js/tarot.js", "assets/combo/sua.webp", "assets/tarot/sua.webp", "assets/maps/clementis.webp", "assets/ui/select.webp",
               "php/api.php", "php/config.php", "database/schema.sql", "python/init_db.py"]


def checar_arquivos():
    faltando = [f for f in NECESSARIOS if not (BASE / f).exists()]
    if faltando:
        print("ERRO: arquivos faltando na estrutura de pastas:")
        for f in faltando:
            print("  -", f)
        print("\nMantenha as subpastas css/, js/, php/, database/ e python/ como no ZIP original.")
        sys.exit(1)


if __name__ == "__main__":
    checar_arquivos()
    init_db()
    php = shutil.which("php")
    run_with_php(php) if php else run_without_php()
