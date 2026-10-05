"""Servidor de desenvolvimento com cache desativado + salvamento de peças.

Uso:
    python serve.py

- Serve os arquivos da pasta atual em http://localhost:8000 (sem cache).
- Aceita POST em /api/save-room com o JSON de uma peça de sala: valida,
  grava em map/<nome>.json (nome automático) e adiciona ao map/index.json.
"""
import http.server
import socketserver
import socket
import json
import os
import re

PORT = 8000
MAP_DIR = "map"
INDEX_FILE = os.path.join(MAP_DIR, "index.json")

# Nome amigável do prefixo do arquivo conforme tipo + assinatura de portas.
# A assinatura usa as letras das portas ativas na ordem N,E,S,W.
def _door_sig(doors):
    letters = ""
    if doors.get("N"):
        letters += "N"
    if doors.get("E"):
        letters += "E"
    if doors.get("S"):
        letters += "S"
    if doors.get("W"):
        letters += "W"
    return letters or "none"


def _base_name(piece):
    """Prefixo do arquivo (sem índice nem extensão) por tipo + forma."""
    ptype = piece.get("type", "normal")
    doors = piece.get("doors", {})
    sig = _door_sig(doors)

    if ptype == "start":
        return "room_start_hub"
    if ptype == "boss":
        return "room_boss"

    # Corredores retos têm nomes próprios reconhecíveis.
    if sig == "EW":
        return "corridor_horizontal_ew"
    if sig == "NS":
        return "corridor_vertical_ns"

    kind = piece.get("kind", "room")
    prefix = "corridor" if kind == "corridor" else "room"
    return f"{prefix}_{sig.lower()}"


def _load_index():
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            rooms = data.get("rooms", [])
            return rooms if isinstance(rooms, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_index(rooms):
    os.makedirs(MAP_DIR, exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump({"rooms": rooms}, f, indent=2, ensure_ascii=False)


def _next_filename(base):
    """Próximo nome livre base_0.json, base_1.json, ... (não sobrescreve)."""
    i = 0
    while True:
        name = f"{base}_{i}.json"
        if not os.path.exists(os.path.join(MAP_DIR, name)):
            return name
        i += 1


def _validate(piece):
    """Validação mínima da peça. Retorna (ok, mensagem)."""
    if not isinstance(piece, dict):
        return False, "payload não é um objeto JSON"
    doors = piece.get("doors")
    if not isinstance(doors, dict):
        return False, "campo 'doors' ausente ou inválido"
    if not any(doors.get(d) for d in ("N", "E", "S", "W")):
        return False, "a peça precisa ter ao menos uma porta"
    floor = piece.get("floor")
    if not isinstance(floor, list) or not floor or not isinstance(floor[0], list):
        return False, "campo 'floor' ausente ou inválido (matriz esperada)"
    return True, "ok"


class RoomServerHandler(http.server.SimpleHTTPRequestHandler):
    def address_string(self):
        # Desativa lookup de DNS reverso lento no log que bloqueia requisições locais
        return self.client_address[0]

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length > 0 else b""
        return json.loads(raw.decode("utf-8"))

    def _handle_delete(self):
        """Remove uma peça: apaga map/<file>.json e tira do index.json."""
        try:
            body = self._read_json_body()
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {"ok": False, "error": f"JSON inválido: {e}"})
            return

        filename = (body or {}).get("file", "")
        # Segurança: só um nome de arquivo .json simples, sem subpastas/traversal.
        if not filename or not re.fullmatch(r"[A-Za-z0-9_\-]+\.json", filename):
            self._send_json(400, {"ok": False, "error": "nome de arquivo inválido"})
            return

        target = os.path.join(MAP_DIR, filename)
        existed = os.path.exists(target)
        if existed:
            try:
                os.remove(target)
            except OSError as e:
                self._send_json(500, {"ok": False, "error": f"falha ao apagar: {e}"})
                return

        # Remove do index (mesmo se o arquivo já não existia, para limpar refs).
        rooms = _load_index()
        if filename in rooms:
            rooms = [r for r in rooms if r != filename]
            _save_index(rooms)

        if not existed:
            self._send_json(404, {"ok": False, "error": "arquivo não encontrado", "count": len(rooms)})
            return
        self._send_json(200, {"ok": True, "file": filename, "count": len(rooms)})

    def do_POST(self):
        route = self.path.rstrip("/")
        if route == "/api/delete-room":
            self._handle_delete()
            return
        if route != "/api/save-room":
            self._send_json(404, {"ok": False, "error": "rota não encontrada"})
            return

        try:
            piece = self._read_json_body()
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {"ok": False, "error": f"JSON inválido: {e}"})
            return

        ok, msg = _validate(piece)
        if not ok:
            self._send_json(400, {"ok": False, "error": msg})
            return

        # Gera o nome e grava o arquivo.
        filename = _next_filename(_base_name(piece))
        os.makedirs(MAP_DIR, exist_ok=True)
        with open(os.path.join(MAP_DIR, filename), "w", encoding="utf-8") as f:
            json.dump(piece, f, ensure_ascii=False)

        # Adiciona ao index (sem duplicar).
        rooms = _load_index()
        if filename not in rooms:
            rooms.append(filename)
            _save_index(rooms)

        self._send_json(200, {"ok": True, "file": filename, "count": len(rooms)})


class DualStackServer(http.server.ThreadingHTTPServer):
    """Servidor multithread com suporte simultâneo a IPv4 e IPv6 e fila de conexão aumentada."""
    request_queue_size = 128
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


if __name__ == "__main__":
    try:
        httpd = DualStackServer(("::", PORT), RoomServerHandler)
    except OSError:
        httpd = http.server.ThreadingHTTPServer(("", PORT), RoomServerHandler)

    with httpd:
        print(f"Servindo em http://localhost:{PORT}/ (multithread, IPv4/IPv6, sem cache, com /api/save-room)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor finalizado.")
