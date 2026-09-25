"""Servidor de desenvolvimento simples com cache desativado.

Uso:
    python serve.py

Serve os arquivos da pasta atual em http://localhost:8000 e envia
cabeçalhos no-cache para que o navegador sempre pegue a versao mais
recente dos modulos JS e assets (evita o problema de 304 Not Modified).
"""
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Servindo em http://localhost:{PORT}/ (sem cache)")
        httpd.serve_forever()
