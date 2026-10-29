# Architecture

```text
Browser (HTML/CSS/Vanilla JS)
  |  Supabase Auth (email/password) -> access token (JWT)
  |  Realtime subscription: sos_events, devices
  v
Flask REST API  /api/*      (backend/app)
  - auth.py        verifies token with Supabase /auth/v1/user; require_admin checks user_roles
  - routes/*       dashboard, contacts, sos, evidence, travel, devices, profile, admin
  - services/      repository (PostgREST with the USER's token -> RLS applies),
                   storage (private 'evidence' bucket), notifier (Twilio SMS, optional)
  v
Supabase Postgres (RLS on every table) + Storage + Realtime
```

Key decisions
- The API forwards the caller's JWT to Postgres, so Row Level Security is the final authority on data ownership.
- The service-role key is used only by admin aggregate reads, after the caller is confirmed admin.
- Roles live in a separate `user_roles` table checked by a `security definer` `has_role()` function (avoids recursive RLS and privilege escalation via profile edits).
- PINs are stored hashed (Werkzeug PBKDF2). The duress PIN returns the same response as a real cancel but keeps the event active and re-alerts; a trigger prevents clearing the duress flag.
- `DATA_BACKEND=memory` gives an identical in-process implementation for tests and offline demos.
- Device data is tagged `source: real|demo` end to end; the UI always shows a DEMO badge.
