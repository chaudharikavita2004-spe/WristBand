-- Realtime: dashboard and admin console subscribe to SOS changes (RLS still filters rows).
alter publication supabase_realtime add table public.sos_events;
alter publication supabase_realtime add table public.devices;
alter table public.sos_events replica identity full;
