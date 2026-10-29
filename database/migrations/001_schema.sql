-- WristBand core schema
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'moderator', 'user');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid generated always as (id) stored,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 25),
  blood_group text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies text, medications text,
  lang text not null default 'en' check (lang in ('en','hi')),
  pulse_low int not null default 50 check (pulse_low between 30 and 120),
  pulse_high int not null default 120 check (pulse_high between 80 and 220),
  cancel_pin_hash text, duress_pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pulse_low < pulse_high)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  email text, relation text,
  priority int not null default 1 check (priority between 1 and 10),
  notify_sms boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, hardware_id text not null,
  source text not null check (source in ('real','demo')),
  status text not null default 'connected' check (status in ('connected','disconnected')),
  battery int check (battery between 0 and 100),
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hardware_id)
);

create table if not exists public.pulse_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  bpm int not null check (bpm between 20 and 250),
  source text not null check (source in ('real','demo')),
  created_at timestamptz not null default now()
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null check (trigger in ('button','shake','checkin','pulse','device','voice')),
  status text not null default 'active' check (status in ('active','cancelled','resolved')),
  duress boolean not null default false,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy_m double precision, note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  contact_id uuid references public.emergency_contacts(id) on delete set null,
  channel text not null check (channel in ('sms','none')),
  status text not null check (status in ('sent','failed','not_sent','skipped')),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sos_event_id uuid references public.sos_events(id) on delete set null,
  storage_path text not null unique,
  file_name text not null, mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  mode text check (mode in ('walk','cab','bus','train','car','other')),
  vehicle_info text,
  expected_minutes int not null check (expected_minutes between 1 and 1440),
  share_with_contacts boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','cancelled','overdue')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.location_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid not null references public.journeys(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ok boolean not null, note text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_contacts_user on public.emergency_contacts(user_id, priority);
create index if not exists idx_devices_user on public.devices(user_id);
create index if not exists idx_pulse_user_time on public.pulse_readings(user_id, created_at desc);
create index if not exists idx_sos_user_time on public.sos_events(user_id, created_at desc);
create index if not exists idx_sos_active on public.sos_events(status) where status = 'active';
create index if not exists idx_alerts_event on public.alert_deliveries(sos_event_id);
create index if not exists idx_evidence_user on public.evidence(user_id, created_at desc);
create index if not exists idx_journeys_user on public.journeys(user_id, status);
create unique index if not exists one_active_journey on public.journeys(user_id) where status = 'active';
create index if not exists idx_points_journey on public.location_points(journey_id, created_at);
create index if not exists idx_checkins_user on public.checkins(user_id, created_at desc);
