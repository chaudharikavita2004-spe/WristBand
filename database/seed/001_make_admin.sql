-- Run manually after you sign up, replacing the email.
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com'
on conflict do nothing;
