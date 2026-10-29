#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f frontend/js/config.js ] || cp frontend/js/config.example.js frontend/js/config.js
(cd backend && flask --app wsgi run --port 5000) &
(cd frontend && python3 -m http.server 5500) &
echo "API http://localhost:5000/api/health  |  App http://localhost:5500/login.html"
wait
