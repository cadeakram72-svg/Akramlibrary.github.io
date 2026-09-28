-- Future provider integration foundation. NOT required for the manual checkout.
-- Deploy only alongside an authenticated server adapter and verified webhook handler.
begin;
create table if not exists public.akram_payment_orders(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 book_id text not null references public.akram_books(id), amount_minor bigint not null check(amount_minor>0),
 currency text not null check(currency='USD'), status text not null default 'pending' check(status in('pending','paid','failed','cancelled')),
 created_at timestamptz not null default now(), paid_at timestamptz, unique(user_id,book_id));
create table if not exists public.akram_payment_attempts(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.akram_payment_orders(id),
 provider text not null, provider_payment_id text not null,created_at timestamptz not null default now(),
 unique(provider,provider_payment_id));
create table if not exists public.akram_payment_events(
 provider text not null,event_id text not null,attempt_id uuid not null references public.akram_payment_attempts(id),
 received_at timestamptz not null default now(),primary key(provider,event_id));
create table if not exists public.akram_purchase_notifications(
 order_id uuid primary key references public.akram_payment_orders(id),user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),sent_at timestamptz,attempts integer not null default 0);
alter table public.akram_payment_orders enable row level security;
alter table public.akram_payment_attempts enable row level security;
alter table public.akram_payment_events enable row level security;
alter table public.akram_purchase_notifications enable row level security;
drop policy if exists payment_order_owner on public.akram_payment_orders;
create policy payment_order_owner on public.akram_payment_orders for select to authenticated using(user_id=auth.uid());
revoke all on public.akram_payment_orders,public.akram_payment_attempts,public.akram_payment_events,public.akram_purchase_notifications from public,anon,authenticated;
grant select on public.akram_payment_orders to authenticated;
grant all on public.akram_payment_orders,public.akram_payment_attempts,public.akram_payment_events,public.akram_purchase_notifications to service_role;
-- Called only by the trusted server after validating the user's JWT. Never accept user_id from browser input.
create or replace function public.akram_provider_order(p_user uuid,p_book text) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid; b public.akram_books;
begin
 select * into b from public.akram_books where id=p_book and published and not archived for share;
 if not found or b.price<=0 or b.file_path is null then raise exception 'Book not available';end if;
 if not exists(select 1 from storage.objects where bucket_id='akram-books' and name=b.file_path) then raise exception 'Book file missing';end if;
 if exists(select 1 from public.akram_entitlements where user_id=p_user and book_id=p_book) then raise exception 'Already owned';end if;
 insert into public.akram_payment_orders(user_id,book_id,amount_minor,currency) values(p_user,p_book,round(b.price*100),'USD') on conflict(user_id,book_id) do nothing returning id into oid;
 if oid is null then select id into oid from public.akram_payment_orders where user_id=p_user and book_id=p_book;end if;
 return oid;
end $$;
-- Call ONLY after verifying webhook authenticity AND provider-side successful settlement.
-- Bind attempt.provider_payment_id at session creation, never from client return URL metadata.
create or replace function public.akram_settle_verified_payment(p_provider text,p_event text,p_payment text,p_amount bigint,p_currency text) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.akram_payment_attempts;o public.akram_payment_orders;existing_attempt uuid;
begin
 select * into a from public.akram_payment_attempts where provider=p_provider and provider_payment_id=p_payment;
 if not found then raise exception 'Unbound provider payment';end if;
 select * into o from public.akram_payment_orders where id=a.order_id for update;
 if o.amount_minor<>p_amount or o.currency<>p_currency then raise exception 'Amount or currency mismatch';end if;
 insert into public.akram_payment_events(provider,event_id,attempt_id) values(p_provider,p_event,a.id) on conflict do nothing;
 select attempt_id into existing_attempt from public.akram_payment_events where provider=p_provider and event_id=p_event;
 if existing_attempt<>a.id then raise exception 'Event belongs to another payment';end if;
 if o.status='paid' then return o.id;end if;
 insert into public.akram_entitlements(user_id,book_id) values(o.user_id,o.book_id) on conflict(user_id,book_id) do nothing;
 update public.akram_payment_orders set status='paid',paid_at=now() where id=o.id;
 insert into public.akram_purchase_notifications(order_id,user_id) values(o.id,o.user_id) on conflict do nothing;
 return o.id;
end $$;
revoke all on function public.akram_provider_order(uuid,text),public.akram_settle_verified_payment(text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.akram_provider_order(uuid,text),public.akram_settle_verified_payment(text,text,text,bigint,text) to service_role;
commit;
