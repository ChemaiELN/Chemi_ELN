"""
Laurus ELN - static file server for the built frontend (dist/).

Serves the React single-page app with SPA fallback: any path that does not
map to a real file is served index.html, so client-side routes like /login
and browser refreshes work correctly.

    python serve.py            (serves on 0.0.0.0:9091)
"""
import http.server
import os

PORT = 9091
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRECTORY = os.path.join(BASE_DIR, "dist")


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_head(self):
        # Serve real files/assets as-is; fall back to index.html for SPA routes.
        path = self.translate_path(self.path)
        if not os.path.isdir(path) and not os.path.exists(path):
            self.path = "/index.html"
        return super().send_head()


if __name__ == "__main__":
    if not os.path.isfile(os.path.join(DIRECTORY, "index.html")):
        print("ERROR: dist\\index.html not found. The frontend is not built.")
        raise SystemExit(1)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), SPAHandler)
    print("Serving Laurus ELN frontend on http://0.0.0.0:%d" % PORT)
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
