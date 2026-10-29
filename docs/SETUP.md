# Setup

## 1. Supabase project
1. Create a project at supabase.com. Copy **Project URL** and **anon/publishable key** (Settings → API).
2. In the SQL editor, run every file in `database/migrations/` in numeric order (001 → 005).
3. Auth → Providers: enable Email. Optionally disable "Confirm email" for local testing.
4. Sign up through `frontend/login.html`, then run `database/seed/001_make_admin.sql` with your email to become admin.

## 2. Backend
```bash
cp .env.example .env   # set DATA_BACKEND=supabase and the Supabase values
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
flask --app wsgi run --port 5000
```
`SUPABASE_SERVICE_ROLE_KEY` is needed only for the admin statistics endpoints.

## 3. Frontend
```bash
cd frontend && cp js/config.example.js js/config.js   # edit values
python -m http.server 5500
```
Add `http://localhost:5500` to `CORS_ORIGINS` in `.env`. Web Bluetooth and geolocation need `localhost` or HTTPS.

## 4. Optional SMS alerts
Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Without them, SOS records alerts as `not_sent` and tells the user to call contacts directly.

## 5. Original React app (`web-app/`)
```bash
cd web-app && npm install && npm run dev
```
