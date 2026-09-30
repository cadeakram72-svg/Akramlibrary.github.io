-- AKRAM LIBRARY: optional reviews + newsletter storage. Run AFTER 01_SETUP.sql.
-- This does not change your books, payments, accounts, or owner role.
begin;
create table if not exists public.akram_reviews (
 book_id text not null references public.akram_books(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 rating integer not null check (rating between 1 and 5),
 body text not null check (char_length(body) between 10 and 2000),
 display_name text not null,
 created_at timestamptz not null default now(),
 primary key(book_id,user_id)
);
alter table public.akram_reviews enable row level security;
revoke all on public.akram_reviews from anon, authenticated;
grant select (book_id,rating,body,display_name,created_at) on public.akram_reviews to anon,authenticated;
drop policy if exists akram_reviews_public on public.akram_reviews;
create policy akram_reviews_public on public.akram_reviews for select using (
 exists(select 1 from public.akram_books b where b.id=book_id and b.published and not b.archived)
);
create or replace function public.akram_write_review(p_book text,p_rating integer,p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
 if auth.uid() is null then raise exception 'Sign in to review'; end if;
 if p_rating not between 1 and 5 or char_length(trim(p_body)) not between 10 and 2000 then raise exception 'Invalid review'; end if;
 if not exists(select 1 from public.akram_books where id=p_book and published and not archived) then raise exception 'Book unavailable';end if;
 if exists(select 1 from public.akram_books where id=p_book and price>0) and not exists(select 1 from public.akram_entitlements where user_id=auth.uid() and book_id=p_book) then raise exception 'Purchase this book before reviewing';end if;
 select left(split_part(coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Reader'),' ',1),40) into v_name from auth.users where id=auth.uid();
 insert into public.akram_reviews(book_id,user_id,rating,body,display_name) values(p_book,auth.uid(),p_rating,trim(p_body),coalesce(v_name,'Reader'))
 on conflict(book_id,user_id) do update set rating=excluded.rating,body=excluded.body,display_name=excluded.display_name;
end;$$;
revoke all on function public.akram_write_review(text,integer,text) from public,anon;
grant execute on function public.akram_write_review(text,integer,text) to authenticated;
create table if not exists public.akram_newsletter (
 email text primary key check(char_length(email)<=254),
 subscribed_at timestamptz not null default now(),
 consent_version text not null default '2026-09-27'
);
alter table public.akram_newsletter enable row level security;
revoke all on public.akram_newsletter from anon,authenticated;
grant select,delete on public.akram_newsletter to authenticated;
drop policy if exists akram_newsletter_owner_read on public.akram_newsletter;
create policy akram_newsletter_owner_read on public.akram_newsletter for select to authenticated using(public.akram_is_admin());
drop policy if exists akram_newsletter_owner_delete on public.akram_newsletter;
create policy akram_newsletter_owner_delete on public.akram_newsletter for delete to authenticated using(public.akram_is_admin());
create or replace function public.akram_subscribe(p_email text)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text=lower(trim(p_email));
begin
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 insert into public.akram_newsletter(email) values(v_email) on conflict(email) do nothing;
end;$$;
revoke all on function public.akram_subscribe(text) from public;
grant execute on function public.akram_subscribe(text) to anon,authenticated;
commit;
