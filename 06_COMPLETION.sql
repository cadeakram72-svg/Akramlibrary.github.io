begin;
-- Additive migration: never reseeds books, prices, authors, or users.
alter table public.akram_payment_orders add column if not exists book_title text;
alter table public.akram_payment_orders add column if not exists generation integer not null default 1;
alter table public.akram_payment_orders add column if not exists last_checked_at timestamptz;
alter table public.akram_payment_attempts alter column provider_payment_id drop not null;
alter table public.akram_payment_attempts add column if not exists generation integer not null default 1;
alter table public.akram_payment_attempts add column if not exists checkout_url text;
alter table public.akram_payment_attempts add column if not exists lease_until timestamptz;
alter table public.akram_payment_attempts add column if not exists terminal boolean not null default false;
alter table public.akram_payment_attempts add column if not exists last_error text;
create unique index if not exists payment_attempt_generation on public.akram_payment_attempts(order_id,generation);
alter table public.akram_purchase_notifications add column if not exists payload jsonb;
alter table public.akram_purchase_notifications add column if not exists first_attempt_at timestamptz;
alter table public.akram_purchase_notifications add column if not exists lease_until timestamptz;
alter table public.akram_purchase_notifications add column if not exists lease_token uuid;
alter table public.akram_purchase_notifications add column if not exists last_error text;
alter table public.akram_purchase_notifications add column if not exists needs_review boolean not null default false;
create table if not exists public.akram_receipts(id uuid primary key default gen_random_uuid(),source text not null,order_key uuid not null,user_id uuid not null references auth.users(id),book_id text not null references public.akram_books(id),amount_minor bigint not null,currency text not null default 'USD',created_at timestamptz not null default now(),unique(source,order_key));
create table if not exists public.akram_email_queue(receipt_id uuid primary key references public.akram_receipts(id),payload jsonb,first_attempt_at timestamptz,lease_until timestamptz,lease_token uuid,attempts integer not null default 0,sent_at timestamptz,last_error text,needs_review boolean not null default false);
create table if not exists public.akram_audit(id bigint generated always as identity primary key,actor uuid,action text not null,entity text not null,created_at timestamptz not null default now());
create table if not exists public.akram_reading_positions(user_id uuid not null references auth.users(id) on delete cascade,book_id text not null references public.akram_books(id),format text not null check(format in('pdf','text')),page integer not null check(page>=0 and page<=1000000),revision bigint not null default 1,updated_at timestamptz not null default now(),primary key(user_id,book_id,format));
alter table public.akram_receipts enable row level security;
alter table public.akram_email_queue enable row level security;
alter table public.akram_audit enable row level security;
alter table public.akram_reading_positions enable row level security;
revoke all on public.akram_receipts,public.akram_email_queue,public.akram_audit,public.akram_reading_positions from public,anon,authenticated;
grant select on public.akram_receipts,public.akram_audit,public.akram_reading_positions to authenticated;
grant all on public.akram_receipts,public.akram_email_queue,public.akram_audit,public.akram_reading_positions to service_role;
grant usage,select on sequence public.akram_audit_id_seq to service_role;
drop policy if exists receipt_owner on public.akram_receipts;
create policy receipt_owner on public.akram_receipts for select to authenticated using(user_id=auth.uid() or public.akram_is_admin());
drop policy if exists audit_admin on public.akram_audit;
create policy audit_admin on public.akram_audit for select to authenticated using(public.akram_is_admin());
drop policy if exists position_owner on public.akram_reading_positions;
create policy position_owner on public.akram_reading_positions for select to authenticated using(user_id=auth.uid());
drop policy if exists payment_order_owner on public.akram_payment_orders;
drop policy if exists payment_order_owner on public.akram_payment_orders;
create policy payment_order_owner on public.akram_payment_orders for select to authenticated using(user_id=auth.uid() or public.akram_is_admin());
create or replace function public.akram_save_position(p_book text,p_format text,p_page integer,p_revision bigint) returns public.akram_reading_positions language plpgsql security definer set search_path=public as $$
declare r public.akram_reading_positions;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if p_revision is null or p_revision<0 then raise exception 'Valid revision required';end if;
 if not exists(select 1 from akram_books b where b.id=p_book and ((b.price=0 and b.published and not b.archived) or exists(select 1 from akram_entitlements e where e.user_id=auth.uid() and e.book_id=b.id))) then raise exception 'Book access required';end if;
 insert into akram_reading_positions(user_id,book_id,format,page) values(auth.uid(),p_book,p_format,p_page) on conflict do nothing;
 select * into r from akram_reading_positions where user_id=auth.uid() and book_id=p_book and format=p_format for update;
 if p_revision<>0 and r.revision<>p_revision then return r;end if;
 if p_revision=0 and r.page<>p_page then return r;end if;
 update akram_reading_positions set page=p_page,revision=revision+1,updated_at=now() where user_id=auth.uid() and book_id=p_book and format=p_format returning * into r;
 return r;
end $$;
revoke all on function public.akram_save_position(text,text,integer,bigint) from public;
grant execute on function public.akram_save_position(text,text,integer,bigint) to authenticated;
-- Receipt creation is in the same DB transaction as entitlement approval.
create or replace function public.akram_queue_receipt() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 if tg_table_name='akram_orders' and new.status='approved' and old.status<>'approved' then
 insert into akram_receipts(source,order_key,user_id,book_id,amount_minor) values('manual',new.id,new.user_id,new.book_id,round(new.amount*100)) on conflict do nothing returning id into rid;
 elsif tg_table_name='akram_payment_orders' and new.status='paid' and old.status<>'paid' then
 insert into akram_receipts(source,order_key,user_id,book_id,amount_minor,currency) values('provider',new.id,new.user_id,new.book_id,new.amount_minor,new.currency) on conflict do nothing returning id into rid;
 end if;
 if rid is not null then insert into akram_email_queue(receipt_id) values(rid) on conflict do nothing;end if;
 return new;
end $$;
drop trigger if exists manual_receipt on public.akram_orders;
create trigger manual_receipt after update on public.akram_orders for each row execute function public.akram_queue_receipt();
drop trigger if exists provider_receipt on public.akram_payment_orders;
create trigger provider_receipt after update on public.akram_payment_orders for each row execute function public.akram_queue_receipt();
create or replace function public.akram_log_change() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='akram_payment_orders' then
 if new.status=old.status and new.generation=old.generation then return new;end if;end if;
 insert into akram_audit(actor,action,entity) values(auth.uid(),tg_table_name||':'||tg_op,new.id::text);return new;end $$;
drop trigger if exists book_audit on public.akram_books;
create trigger book_audit after insert or update on public.akram_books for each row execute function public.akram_log_change();
drop trigger if exists manual_order_audit on public.akram_orders;
create trigger manual_order_audit after update on public.akram_orders for each row execute function public.akram_log_change();
drop trigger if exists provider_order_audit on public.akram_payment_orders;
create trigger provider_order_audit after update on public.akram_payment_orders for each row execute function public.akram_log_change();
-- Serialize creation per user/book and exclude simultaneous manual/provider orders.
create or replace function public.akram_begin_checkout(p_user uuid,p_book text,p_provider text) returns jsonb language plpgsql security definer set search_path=public as $$
declare oid uuid;o public.akram_payment_orders;a public.akram_payment_attempts;
begin
 if p_provider not in('stripe','waafi') then raise exception 'Unsupported provider';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_book,0));
 if exists(select 1 from akram_orders where user_id=p_user and book_id=p_book and status in('pending','approved')) then raise exception 'Existing manual order; resolve it first';end if;
 if (select count(*) from akram_payment_orders where user_id=p_user and created_at>now()-interval '1 hour')>=20 and not exists(select 1 from akram_payment_orders where user_id=p_user and book_id=p_book) then raise exception 'Checkout limit reached';end if;
 oid:=akram_provider_order(p_user,p_book);
 select * into o from akram_payment_orders where id=oid for update;
 if o.status='paid' then raise exception 'Already paid';end if;
 select * into a from akram_payment_attempts where order_id=oid and generation=o.generation;
 if found and a.provider<>p_provider and not(a.terminal and o.status in('failed','cancelled')) then raise exception 'Use existing payment method until resolved';end if;
 if a.terminal and o.status in('failed','cancelled') then
 update akram_payment_orders set generation=generation+1,status='pending' where id=oid returning * into o;
 a:=null;
 end if;
 if a.id is null then
 insert into akram_payment_attempts(order_id,provider,generation) values(oid,p_provider,o.generation) returning * into a;
 update akram_payment_orders set book_title=(select data->>'title' from akram_books where id=p_book) where id=oid returning * into o;
 end if;
 if a.checkout_url is not null then return jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'claimed',false);end if;
 if a.lease_until>now() then return jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'claimed',false);end if;
 -- Unknown Waafi creation must be reconciled; no blind charge retries.
 if a.lease_until is not null and p_provider='waafi' then return jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'claimed',false);end if;
 -- Stripe idempotency window: never recreate blindly after 23 hours.
 if a.created_at<now()-interval '23 hours' then raise exception 'Checkout needs reconciliation';end if;
 update akram_payment_attempts set lease_until=now()+interval '90 seconds' where id=a.id returning * into a;
 return jsonb_build_object('order',to_jsonb(o),'attempt',to_jsonb(a),'claimed',true);
end $$;
create or replace function public.akram_bind_checkout(p_attempt uuid,p_payment text,p_url text) returns void language plpgsql security definer set search_path=public as $$
declare a public.akram_payment_attempts;
begin
 select * into a from akram_payment_attempts where id=p_attempt for update;
 if not found then raise exception 'Attempt not found';end if;
 if a.provider_payment_id is not null and a.provider_payment_id<>p_payment then raise exception 'Payment binding mismatch';end if;
 update akram_payment_attempts set provider_payment_id=p_payment,checkout_url=p_url,lease_until=null where id=a.id;
end $$;
create or replace function public.akram_payment_terminal(p_attempt uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare a public.akram_payment_attempts;begin
 if p_status not in('failed','cancelled') then raise exception 'Invalid terminal state';end if;
 select * into a from akram_payment_attempts where id=p_attempt;
 perform 1 from akram_payment_orders where id=a.order_id for update;
 update akram_payment_attempts set terminal=true where id=a.id;
 update akram_payment_orders set status=p_status,last_checked_at=now() where id=a.order_id and generation=a.generation and status<>'paid';
end $$;
create or replace function public.akram_claim_emails() returns setof public.akram_email_queue language plpgsql security definer set search_path=public as $$begin
 update akram_email_queue set needs_review=true,last_error='Idempotency window exceeded; check provider before resending' where sent_at is null and first_attempt_at<now()-interval '23 hours';
 return query with picked as(select receipt_id from akram_email_queue where sent_at is null and not needs_review and (lease_until is null or lease_until<now()) and attempts<12 order by receipt_id for update skip locked limit 10) update akram_email_queue q set lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 from picked where q.receipt_id=picked.receipt_id returning q.*;
end $$;
revoke all on function public.akram_begin_checkout(uuid,text,text),public.akram_bind_checkout(uuid,text,text),public.akram_payment_terminal(uuid,text),public.akram_claim_emails() from public,anon,authenticated;
grant execute on function public.akram_begin_checkout(uuid,text,text),public.akram_bind_checkout(uuid,text,text),public.akram_payment_terminal(uuid,text),public.akram_claim_emails() to service_role;
create or replace function public.akram_submit_order(p_book text,p_method text,p_reference text) returns uuid language plpgsql security definer set search_path=public as $$
declare b public.akram_books; oid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first / Marka hore soo gal';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_book,0));
 if exists(select 1 from akram_payment_orders where user_id=auth.uid() and book_id=p_book and status in('pending','paid')) then raise exception 'Existing provider payment; resolve it first';end if;
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

create table if not exists public.akram_provider_transactions(provider text not null,transaction_id text not null,attempt_id uuid not null references public.akram_payment_attempts(id),primary key(provider,transaction_id));
alter table public.akram_provider_transactions enable row level security;
revoke all on public.akram_provider_transactions from public,anon,authenticated;
grant all on public.akram_provider_transactions to service_role;
commit;
begin;
create table if not exists public.akram_refund_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),receipt_id uuid not null references public.akram_receipts(id),reason text not null check(length(reason) between 10 and 2000),status text not null default 'open' check(status in('open','resolved','declined')),admin_note text,created_at timestamptz not null default now(),unique(user_id,receipt_id));
alter table public.akram_refund_requests enable row level security;
revoke all on public.akram_refund_requests from public,anon,authenticated;
grant select on public.akram_refund_requests to authenticated;
grant all on public.akram_refund_requests to service_role;
drop policy if exists refund_owner on public.akram_refund_requests;
create policy refund_owner on public.akram_refund_requests for select to authenticated using(user_id=auth.uid() or public.akram_is_admin());
create or replace function public.akram_request_refund(p_receipt uuid,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$declare rid uuid;begin
 if not exists(select 1 from akram_receipts where id=p_receipt and user_id=auth.uid()) then raise exception 'Own receipt required';end if;
 insert into akram_refund_requests(user_id,receipt_id,reason) values(auth.uid(),p_receipt,p_reason) on conflict(user_id,receipt_id) do nothing returning id into rid;
 if rid is null then select id into rid from akram_refund_requests where user_id=auth.uid() and receipt_id=p_receipt;end if;return rid;end $$;
create or replace function public.akram_resolve_refund(p_id uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.akram_is_admin() then raise exception 'Admin only';end if;
 if p_status not in('resolved','declined') or length(trim(p_note))<5 then raise exception 'Document the resolution';end if;
 update akram_refund_requests set status=p_status,admin_note=left(p_note,2000) where id=p_id;
 insert into akram_audit(actor,action,entity) values(auth.uid(),'refund_case:'||p_status,p_id::text);
end $$;
create or replace function public.akram_sales_report(p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 if not public.akram_is_admin() then raise exception 'Admin only';end if;
 if p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid reporting window';end if;
 with sales as(select book_id,amount_minor,created_at,source from akram_receipts where created_at>=p_from and created_at<p_to),totals as(select count(*) purchases,coalesce(sum(amount_minor),0) gross_usd_cents from sales),daily as(select created_at::date as day,sum(amount_minor) gross_usd_cents,count(*) purchases from sales group by 1 order by 1)
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'daily',coalesce((select jsonb_agg(d) from daily d),'[]'::jsonb),'manual_pending',(select count(*) from akram_orders where status='pending'),'provider_pending',(select count(*) from akram_payment_orders where status='pending'),'receipt_failures',(select count(*) from akram_email_queue where sent_at is null and (needs_review or attempts>=12)),'refund_open',(select count(*) from akram_refund_requests where status='open')) into result;
 return result;end $$;
revoke all on function public.akram_request_refund(uuid,text),public.akram_resolve_refund(uuid,text,text),public.akram_sales_report(timestamptz,timestamptz) from public;
grant execute on function public.akram_request_refund(uuid,text),public.akram_resolve_refund(uuid,text,text),public.akram_sales_report(timestamptz,timestamptz) to authenticated;
commit;

-- Historical receipts support accurate reports without sending old emails again.
begin;
insert into public.akram_receipts(source,order_key,user_id,book_id,amount_minor,currency,created_at)
 select 'manual',id,user_id,book_id,round(amount*100),'USD',coalesce(reviewed_at,created_at) from public.akram_orders where status='approved' on conflict do nothing;
insert into public.akram_receipts(source,order_key,user_id,book_id,amount_minor,currency,created_at)
 select 'provider',id,user_id,book_id,amount_minor,currency,coalesce(paid_at,created_at) from public.akram_payment_orders where status='paid' on conflict do nothing;
create index if not exists akram_pending_reconciliation on public.akram_payment_orders(last_checked_at) where status='pending';
create index if not exists akram_receipts_date on public.akram_receipts(created_at);
commit;
