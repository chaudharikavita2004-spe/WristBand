# Deployment

## Backend (any container host: Render, Railway, Fly.io, Cloud Run)
- `backend/Dockerfile` runs gunicorn on `$PORT`. `render.yaml` at the repo root is a ready Render blueprint.
- Set every variable from `.env.example` in the host's secret settings. Never commit `.env`.
- Set `CORS_ORIGINS` to your frontend's HTTPS origin.

## Frontend (any static host: Netlify, Vercel, GitHub Pages, Cloudflare Pages)
- Publish the `frontend/` folder. Create `js/config.js` with production `API_BASE`, `SUPABASE_URL`, anon key.
- HTTPS is required for Web Bluetooth and geolocation.

## Database
- Apply `database/migrations/*.sql` in order, or `supabase link && supabase db push` after copying them into `supabase/migrations/`.

## Script
`scripts/run_local.sh` starts backend and frontend together for local testing.
