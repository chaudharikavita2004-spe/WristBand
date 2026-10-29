# WristBand — Intelligent Women's Safety & Emergency Response System

This package contains two implementations of WristBand:

| Folder | What it is | Status |
|---|---|---|
| `web-app/` | The original WristBand app (React + TanStack Start), exactly as built in Lovable. Stores data in the browser only. | Working, preserved unchanged |
| `frontend/` + `backend/` + `database/` | The requested stack: HTML/CSS/Vanilla JS frontend, Python Flask REST API, Supabase (Auth, Postgres, RLS, Realtime, Storage). | Working against the in-memory backend and tests; needs your Supabase project for real use |

## Quick start (Flask stack)

```bash
cp .env.example .env            # fill in Supabase values, or set DATA_BACKEND=memory to try locally
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                          # runs unit + API tests
flask --app wsgi run --port 5000
# in another terminal
cd frontend && cp js/config.example.js js/config.js && python -m http.server 5500
```
Open http://localhost:5500/login.html.

Apply database migrations in order from `database/migrations/` (Supabase SQL editor or `supabase db push`). See `docs/SETUP.md`.

## What is real vs. what needs external setup
- **Works now:** dashboard, SOS trigger/cancel with PIN and duress PIN, emergency contacts, evidence vault upload/list/delete, travel journeys + location points, devices, admin stats, role-protected admin endpoints, Web Bluetooth heart-rate pairing in Chrome/Edge.
- **Requires credentials:** SMS alerts need Twilio keys; without them, alerts are recorded as `not_sent` and the UI says so.
- **Not implemented:** phone calls, emergency-services dispatch, background GPS tracking when the browser is closed. Location only works while the page is open and permission is granted.

Docs: `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/VALIDATION_REPORT.md`.
