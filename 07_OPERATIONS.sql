begin;
create table if not exists public.akram_payment_alerts(id uuid primary key default gen_random_uuid(),provider text not null,event_id text not null,kind text not null,order_id uuid references akram_payment_orders(id),reference text,created_at timestamptz not null default now(),resolved_at timestamptz,resolution text,unique(provider,event_id));
create table if not exists public.akram_verified_settlements(attempt_id uuid primary key references akram_payment_attempts(id),amount_minor bigint not null,currency text not null,verified_at timestamptz not null default now());
create table if not exists public.akram_access_holds(user_id uuid references auth.users(id),book_id text references akram_books(id),reason text not null,created_at timestamptz not null default now(),primary key(user_id,book_id));
alter table public.akram_payment_alerts enable row level security;
alter table public.akram_verified_settlements enable row level security;
alter table public.akram_access_holds enable row level security;
revoke all on public.akram_payment_alerts,public.akram_verified_settlements,public.akram_access_holds from public,anon,authenticated;
grant select on public.akram_payment_alerts,public.akram_verified_settlements,public.akram_access_holds to authenticated;
grant all on public.akram_payment_alerts,public.akram_verified_settlements,public.akram_access_holds to service_role;
drop policy if exists alert_admin on public.akram_payment_alerts;
create policy alert_admin on public.akram_payment_alerts for select to authenticated using(akram_is_admin());
drop policy if exists settlement_admin on public.akram_verified_settlements;
create policy settlement_admin on public.akram_verified_settlements for select to authenticated using(akram_is_admin());
drop policy if exists holds_owner on public.akram_access_holds;
create policy holds_owner on public.akram_access_holds for select to authenticated using(user_id=auth.uid() or akram_is_admin());
create or replace function public.akram_settle_verified_payment(p_provider text,p_event text,p_payment text,p_amount bigint,p_currency text) returns uuid language plpgsql security definer set search_path=public as $$
declare a akram_payment_attempts;o akram_payment_orders;existing_attempt uuid;already_settled boolean;
begin
 select * into a from akram_payment_attempts where provider=p_provider and provider_payment_id=p_payment;
 if not found then raise exception 'Unbound provider payment';end if;
 select * into o from akram_payment_orders where id=a.order_id;
 perform pg_advisory_xact_lock(hashtextextended(o.user_id::text||':'||o.book_id,0));
 select * into o from akram_payment_orders where id=a.order_id for update;
 if o.amount_minor<>p_amount or o.currency<>p_currency then raise exception 'Amount or currency mismatch';end if;
 insert into akram_payment_events(provider,event_id,attempt_id) values(p_provider,p_event,a.id) on conflict do nothing;
 select attempt_id into existing_attempt from akram_payment_events where provider=p_provider and event_id=p_event;
 if existing_attempt<>a.id then raise exception 'Event belongs to another payment';end if;
 already_settled:=exists(select 1 from akram_verified_settlements where attempt_id=a.id);
 insert into akram_verified_settlements(attempt_id,amount_minor,currency) values(a.id,p_amount,p_currency) on conflict do nothing;
 if o.status='paid' then
 if not already_settled and exists(select 1 from akram_verified_settlements s join akram_payment_attempts x on x.id=s.attempt_id where x.order_id=o.id and x.id<>a.id) then
 insert into akram_payment_alerts(provider,event_id,kind,order_id,reference) values(p_provider,'duplicate:'||a.id,'multiple_successful_attempts',o.id,p_payment) on conflict do nothing;
 end if;return o.id;end if;
 if not exists(select 1 from akram_access_holds where user_id=o.user_id and book_id=o.book_id) then
 insert into akram_entitlements(user_id,book_id) values(o.user_id,o.book_id) on conflict(user_id,book_id) do nothing;end if;
 update akram_payment_orders set status='paid',paid_at=now() where id=o.id;
 insert into akram_purchase_notifications(order_id,user_id) values(o.id,o.user_id) on conflict do nothing;
 return o.id;
end $$;
revoke all on function public.akram_settle_verified_payment(text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.akram_settle_verified_payment(text,text,text,bigint,text) to service_role;
create or replace function public.akram_admin_access(p_receipt uuid,p_hold boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare r akram_receipts;begin
 if not akram_is_admin() then raise exception 'Admin only';end if;
 if p_reason is null or length(trim(p_reason))<10 then raise exception 'Document provider verification and reason';end if;
 select * into r from akram_receipts where id=p_receipt;
 if not found then raise exception 'Receipt missing';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.user_id::text||':'||r.book_id,0));
 if p_hold then
 insert into akram_access_holds(user_id,book_id,reason) values(r.user_id,r.book_id,left(p_reason,2000)) on conflict(user_id,book_id) do update set reason=excluded.reason;
 delete from akram_entitlements where user_id=r.user_id and book_id=r.book_id;
 else
 delete from akram_access_holds where user_id=r.user_id and book_id=r.book_id;
 insert into akram_entitlements(user_id,book_id) values(r.user_id,r.book_id) on conflict do nothing;
 end if;
 insert into akram_audit(actor,action,entity) values(auth.uid(),case when p_hold then 'access_hold:' else 'access_restore:' end||left(p_reason,2000),p_receipt::text);
end $$;
create or replace function public.akram_resolve_alert(p_id uuid,p_note text) returns void language plpgsql security definer set search_path=public as $$begin
 if not akram_is_admin() then raise exception 'Admin only';end if;
 if p_note is null or length(trim(p_note))<10 then raise exception 'Resolution details required';end if;
 update akram_payment_alerts set resolved_at=now(),resolution=left(p_note,2000) where id=p_id;
 insert into akram_audit(actor,action,entity) values(auth.uid(),'payment_alert_resolved',p_id::text);
end $$;
revoke all on function public.akram_admin_access(uuid,boolean,text),public.akram_resolve_alert(uuid,text) from public;
grant execute on function public.akram_admin_access(uuid,boolean,text),public.akram_resolve_alert(uuid,text) to authenticated;
commit;

begin;
grant select on public.akram_books,public.akram_orders,public.akram_entitlements,public.akram_admins to service_role;
create or replace function public.akram_admin_close_pending(p_order uuid,p_reference text) returns void language plpgsql security definer set search_path=public as $$declare o akram_payment_orders;begin
 if not akram_is_admin() then raise exception 'Admin only';end if;
 if p_reference is null or length(trim(p_reference))<15 then raise exception 'Record provider cancellation verification';end if;
 select * into o from akram_payment_orders where id=p_order for update;
 if not found or o.status<>'pending' then raise exception 'Only pending orders can be closed';end if;
 update akram_payment_attempts set terminal=true where order_id=o.id and generation=o.generation;
 update akram_payment_orders set status='cancelled',last_checked_at=now() where id=o.id;
 insert into akram_audit(actor,action,entity) values(auth.uid(),'verified_cancellation:'||left(p_reference,2000),o.id::text);
end $$;
revoke all on function public.akram_admin_close_pending(uuid,text) from public;
grant execute on function public.akram_admin_close_pending(uuid,text) to authenticated;
commit;
