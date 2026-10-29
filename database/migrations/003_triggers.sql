create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','emergency_contacts','devices','sos_events','journeys'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Create profile + default 'user' role for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name') on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Users must not flip the duress flag off or edit an event after it is resolved
create or replace function public.guard_sos_update()
returns trigger language plpgsql as $$
begin
  if old.duress and not new.duress then raise exception 'duress flag cannot be cleared'; end if;
  if old.status <> 'active' and new.status = 'active' then raise exception 'resolved SOS cannot be reactivated'; end if;
  return new;
end $$;
drop trigger if exists trg_guard_sos on public.sos_events;
create trigger trg_guard_sos before update on public.sos_events for each row execute function public.guard_sos_update();
