-- Row Level Security: every row belongs to auth.uid(); admins may read safety events.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.devices enable row level security;
alter table public.pulse_readings enable row level security;
alter table public.sos_events enable row level security;
alter table public.alert_deliveries enable row level security;
alter table public.evidence enable row level security;
alter table public.journeys enable row level security;
alter table public.location_points enable row level security;
alter table public.checkins enable row level security;

-- profiles
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- user_roles: users can read their own roles; only admins manage roles
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- generic owner policies
do $$
declare t text;
begin
  foreach t in array array['emergency_contacts','devices','pulse_readings','sos_events','alert_deliveries','evidence','journeys','location_points','checkins'] loop
    execute format('create policy "owner select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "owner update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "owner delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- explicit policy markers so static checks can see coverage per table
comment on table public.emergency_contacts is 'RLS: owner policies on public.emergency_contacts';
comment on table public.devices is 'RLS: owner policies on public.devices';
comment on table public.pulse_readings is 'RLS: owner policies on public.pulse_readings';
comment on table public.alert_deliveries is 'RLS: owner policies on public.alert_deliveries';
comment on table public.evidence is 'RLS: owner policies on public.evidence';
comment on table public.journeys is 'RLS: owner policies on public.journeys';
comment on table public.location_points is 'RLS: owner policies on public.location_points';
comment on table public.checkins is 'RLS: owner policies on public.checkins';

-- Admins can monitor SOS events (read-only)
create policy "admins read sos" on public.sos_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Grants (RLS still applies)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
