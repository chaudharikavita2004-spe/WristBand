# REST API

Base URL: `/api`. All endpoints except `/health` require `Authorization: Bearer <supabase access token>`.
Errors: `{"error": "...", "details": {...}}` with 400/401/403/404/409/415/422/5xx.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | /health | — | Reports which integrations are configured |
| GET | /me | — | Profile (PIN hashes never returned), `is_admin` |
| PATCH | /me | full_name, phone, blood_group, allergies, medications, lang, pulse_low, pulse_high, cancel_pin, duress_pin | PINs 4-8 digits, hashed |
| GET | /dashboard | — | status, safety_score, devices, active_journey, recent_sos |
| GET/POST | /contacts | name*, phone*, email, relation, priority, notify_sms | max 10 |
| PATCH/DELETE | /contacts/{id} | partial | |
| POST | /sos | trigger* (button/shake/checkin/pulse/device/voice), lat, lng, accuracy_m, note | Returns alert delivery summary |
| GET | /sos | — | History (duress flag hidden) |
| POST | /sos/{id}/location | lat, lng, accuracy_m | |
| POST | /sos/{id}/cancel | pin* | Cancel PIN cancels; duress PIN silently keeps alert active |
| POST | /checkins | ok*, note | |
| GET/POST | /evidence | multipart `file`*, note, sos_event_id | 25 MB, images/audio/video/pdf/txt |
| GET | /evidence/{id}/url | — | 5-minute signed URL |
| DELETE | /evidence/{id} | — | |
| GET/POST | /journeys | destination*, expected_minutes*, mode, vehicle_info, share_with_contacts | one active journey |
| POST | /journeys/{id}/points | lat*, lng*, accuracy_m | |
| POST | /journeys/{id}/end | status: completed/cancelled | |
| GET/POST | /devices | name*, hardware_id*, source* (real/demo), status, battery | |
| PATCH/DELETE | /devices/{id} | name, status, battery | |
| POST | /devices/{id}/readings | bpm* (20-250), source* | |
| GET | /admin/stats | — | admin only |
| GET | /admin/sos | — | admin only |
