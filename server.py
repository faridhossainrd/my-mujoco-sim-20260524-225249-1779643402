#!/usr/bin/env python3
"""
MuJoCo Volcano - Simple HTTP Server
Serves the MuJoCo WebAssembly viewer on a specified port.
Works from any directory without hardcoded paths.
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

def main():
    # Get port from command line argument or environment variable
    port = 8100  # Default port

    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Error: Invalid port number '{sys.argv[1]}'", file=sys.stderr)
            sys.exit(1)
    elif 'PORT' in os.environ:
        try:
            port = int(os.environ['PORT'])
        except ValueError:
            print(f"Error: Invalid PORT environment variable '{os.environ['PORT']}'", file=sys.stderr)
            sys.exit(1)

    # Change to the directory where this script is located
    script_dir = Path(__file__).parent.resolve()
    os.chdir(script_dir)

    # Set up the HTTP request handler with CORS support
    class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add CORS headers
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')

            # Add cache-busting headers for JSON and XML files
            if self.path.endswith('.json') or self.path.endswith('.xml'):
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')

            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, format, *args):
            # Custom log format
            sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")
            sys.stdout.flush()

    # Create the server
    try:
        with socketserver.TCPServer(("", port), CORSRequestHandler) as httpd:
            print(f"MuJoCo Volcano server running at http://localhost:{port}")
            print(f"Serving directory: {script_dir}")
            print("Press Ctrl+C to stop")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Error: Port {port} is already in use", file=sys.stderr)
            sys.exit(1)
        else:
            raise
    except KeyboardInterrupt:
        print("\nServer stopped")
        sys.exit(0)

if __name__ == "__main__":
    main()
