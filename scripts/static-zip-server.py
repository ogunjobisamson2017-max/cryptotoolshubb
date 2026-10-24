#!/usr/bin/env python3
"""Minimal static server that serves only the ZIP archive.
Serves exactly one file: artifacts/cryptotoolshubb-src.zip
Bound to 0.0.0.0:3000. No workspace listing, no other paths.
Streams the file in chunks so large archives are not fully buffered.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ARCHIVE_NAME = "cryptotoolshubb-src.zip"
ARCHIVE_DIR = Path(__file__).resolve().parent.parent / "artifacts"
ARCHIVE_PATH = ARCHIVE_DIR / ARCHIVE_NAME
HOST = "0.0.0.0"
PORT = 3000
CHUNK = 1024 * 1024  # 1 MB


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        if self.path == "/":
            # Redirect, but include a tiny body so curl does not see an
            # empty 302 response and stop short of following the redirect.
            self.send_response(302)
            self.send_header("Location", f"/{ARCHIVE_NAME}")
            body = b""
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == f"/{ARCHIVE_NAME}":
            if not ARCHIVE_PATH.is_file():
                self.send_error(404, "Archive not found on disk")
                return
            try:
                size = ARCHIVE_PATH.stat().st_size
            except Exception as exc:
                self.send_error(500, f"Cannot stat archive: {exc}")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{ARCHIVE_NAME}"',
            )
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if not head_only:
                try:
                    with ARCHIVE_PATH.open("rb") as fh:
                        while True:
                            chunk = fh.read(CHUNK)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                except Exception as exc:
                    # Best-effort: we already sent headers; log and stop.
                    print(f"Error streaming archive: {exc}")
            return

        self.send_error(404, "Only the ZIP archive is served by this server")

    def log_message(self, format, *args):
        # Quiet by default; we verify with curl separately.
        pass


def main():
    if not ARCHIVE_PATH.is_file():
        raise SystemExit(f"Archive missing: {ARCHIVE_PATH}")
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Serving archive at http://{HOST}:{PORT}/{ARCHIVE_NAME}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
