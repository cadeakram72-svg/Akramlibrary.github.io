-- Run ONLY in your Supabase SQL Editor. Grants owner rights to an existing verified account.
do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users where lower(email)='cadeakram72@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then raise exception 'First sign in and verify cadeakram72@gmail.com on the website';end if;
 insert into public.akram_admins(user_id) values(owner_id) on conflict do nothing;
end $$;
