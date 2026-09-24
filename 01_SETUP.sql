begin;
create table if not exists public.akram_admins(user_id uuid primary key references auth.users(id));
alter table public.akram_admins enable row level security;
create or replace function public.akram_is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.akram_admins where user_id=auth.uid())$$;
revoke all on function public.akram_is_admin() from public;
grant execute on function public.akram_is_admin() to anon,authenticated;
create table if not exists public.akram_books(id text primary key check(id ~ '^[a-zA-Z0-9_-]+$'), data jsonb not null, price numeric(10,2) not null default 0 check(price>=0 and price<=10000), published boolean not null default false, archived boolean not null default false, file_path text, updated_at timestamptz not null default now());
create table if not exists public.akram_orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),book_id text not null references public.akram_books(id),amount numeric(10,2) not null check(amount>0),method text not null check(method in ('evc','edahab','sim')),reference text not null check(length(reference) between 4 and 100),status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id),unique(user_id,book_id));
create unique index if not exists akram_approved_reference on public.akram_orders((case when method='sim' then 'evc' else method end),lower(reference)) where status='approved';
create table if not exists public.akram_entitlements(user_id uuid references auth.users(id),book_id text references public.akram_books(id),order_id uuid unique references public.akram_orders(id),granted_at timestamptz not null default now(),primary key(user_id,book_id));
alter table public.akram_books enable row level security;
alter table public.akram_orders enable row level security;
alter table public.akram_entitlements enable row level security;
drop policy if exists akram_books_read on public.akram_books;
create policy akram_books_read on public.akram_books for select using(public.akram_is_admin() or (published and not archived) or exists(select 1 from public.akram_entitlements e where e.book_id=id and e.user_id=auth.uid()));
drop policy if exists akram_books_admin on public.akram_books;
create policy akram_books_admin on public.akram_books for all to authenticated using(public.akram_is_admin()) with check(public.akram_is_admin());
drop policy if exists akram_orders_read on public.akram_orders;
create policy akram_orders_read on public.akram_orders for select to authenticated using(user_id=auth.uid() or public.akram_is_admin());
drop policy if exists akram_access_read on public.akram_entitlements;
create policy akram_access_read on public.akram_entitlements for select to authenticated using(user_id=auth.uid() or public.akram_is_admin());
revoke all on public.akram_admins,public.akram_books,public.akram_orders,public.akram_entitlements from anon,authenticated;
grant select on public.akram_books to anon,authenticated;
grant insert,update on public.akram_books to authenticated;
grant select on public.akram_orders,public.akram_entitlements to authenticated;
grant select on public.akram_entitlements to anon; -- RLS grants anonymous users no rows
create or replace function public.akram_submit_order(p_book text,p_method text,p_reference text) returns uuid language plpgsql security definer set search_path=public as $$
declare b public.akram_books; oid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first / Marka hore soo gal';end if;
 if p_method not in ('evc','edahab','sim') or length(trim(p_reference)) not between 4 and 100 then raise exception 'Invalid payment reference';end if;
 select * into b from public.akram_books where id=p_book and published and not archived for share;
 if not found or b.price<=0 or b.file_path is null then raise exception 'Book is not ready for payment';end if;
 if not exists(select 1 from storage.objects where bucket_id='akram-books' and name=b.file_path) then raise exception 'Book file missing';end if;
 if exists(select 1 from public.akram_entitlements where user_id=auth.uid() and book_id=p_book) then raise exception 'Already purchased';end if;
 insert into public.akram_orders(user_id,book_id,amount,method,reference) values(auth.uid(),p_book,b.price,p_method,trim(p_reference))
 on conflict(user_id,book_id) do update set amount=excluded.amount,method=excluded.method,reference=excluded.reference,status='pending',reviewed_at=null,reviewed_by=null where akram_orders.status='rejected'
 returning id into oid;
 if oid is null then select id into oid from public.akram_orders where user_id=auth.uid() and book_id=p_book;end if;
 return oid;
end $$;
create or replace function public.akram_review_order(p_order uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare o public.akram_orders; f text;
begin
 if not public.akram_is_admin() then raise exception 'Admin only';end if;
 select * into o from public.akram_orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if o.status='approved' then return;end if;
 if o.status<>'pending' then raise exception 'Only pending orders can be reviewed';end if;
 if p_approve then
 select file_path into f from public.akram_books where id=o.book_id;
 if f is null or not exists(select 1 from storage.objects where bucket_id='akram-books' and name=f) then raise exception 'Upload the private PDF first';end if;
 insert into public.akram_entitlements(user_id,book_id,order_id) values(o.user_id,o.book_id,o.id) on conflict(user_id,book_id) do nothing;
 end if;
 update public.akram_orders set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid() where id=o.id;
end $$;
revoke all on function public.akram_submit_order(text,text,text),public.akram_review_order(uuid,boolean) from public;
grant execute on function public.akram_submit_order(text,text,text),public.akram_review_order(uuid,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('akram-books','akram-books',false,52428800,array['application/pdf']),('akram-covers','akram-covers',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists akram_file_admin on storage.objects;
create policy akram_file_admin on storage.objects for all to authenticated using(bucket_id in ('akram-books','akram-covers') and public.akram_is_admin()) with check(bucket_id in ('akram-books','akram-covers') and public.akram_is_admin());
drop policy if exists akram_file_read on storage.objects;
create policy akram_file_read on storage.objects for select to anon,authenticated using(bucket_id='akram-books' and exists(select 1 from public.akram_books b where b.file_path=name and ((b.price=0 and b.published and not b.archived) or exists(select 1 from public.akram_entitlements e where e.book_id=b.id and e.user_id=auth.uid()))));
commit;
-- After signing into the website with cadeakram72@gmail.com, run 03_OWNER.sql.
