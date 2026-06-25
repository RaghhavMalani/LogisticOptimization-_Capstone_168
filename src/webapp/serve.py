"""Serve the web app locally (so index.html can fetch data.json).

    python -m src.webapp.serve          # http://localhost:8000
"""

from __future__ import annotations

import http.server
import os
import socketserver
from pathlib import Path


def serve(port: int = 8000) -> None:
    os.chdir(Path(__file__).resolve().parent)
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"\n  India PortWatch web app  ->  http://localhost:{port}\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    serve()
