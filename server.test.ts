// Contract fixtures only: no requests reach real providers; no live credentials are used.
import {hmac} from '../supabase/functions/akram-commerce/security.ts';
Deno.env.set('SUPABASE_URL','https://database.invalid');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture-only');Deno.env.set('SITE_URL','https://library.invalid/');Deno.env.set('PAYMENT_MODE','test');Deno.env.set('PAYMENTS_ENABLED','true');Deno.env.set('STRIPE_SECRET_KEY','fixture-only');Deno.env.set('STRIPE_WEBHOOK_SECRET','fixture-webhook-only');Deno.env.set('CRON_SECRET','fixture-job-only');Deno.env.set('RESEND_API_KEY','fixture-only');Deno.env.set('RECEIPT_FROM','Fixture <receipts@library.invalid>');
let settled=0,claims=0,binds=0,emails=0,mailSaved=false,settledState=false,createHeaders:Headers|undefined;
const user={id:'00000000-0000-0000-0000-000000000001',email:'reader@example.invalid'},order={id:'order-a',user_id:user.id,book_id:'book-a',amount_minor:500,currency:'USD',book_title:'Fixture',generation:1,status:'pending'},attempt={id:'attempt-a',order_id:'order-a',provider:'stripe',provider_payment_id:'cs_fixture',generation:1},session={id:'cs_fixture',client_reference_id:'order-a',metadata:{attempt_id:'attempt-a',user_id:user.id,book_id:'book-a'},amount_total:500,currency:'usd',livemode:false,payment_status:'paid',payment_intent:'pi_fixture',status:'complete',url:'https://checkout.stripe.com/fixture'};
const wallet={referenceId:'attempt-a',tranAmount:'5.00',currency:'USD',status:'Approved',transactionId:'txn-fixture'};
const response=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(input,init={})=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),headers=new Headers(init.headers),body=init.body?JSON.parse(typeof init.body==='string'&&init.body.startsWith('{')?init.body:'{}'):{};
 if(u.hostname==='database.invalid'){
  if(u.pathname==='/auth/v1/user')return headers.get('authorization')==='Bearer reader-token'?response(user):response({message:'Invalid token'},401);
  if(u.pathname.startsWith('/auth/v1/admin/users/'))return response(user);
  const p=u.pathname.split('/').pop();if(u.pathname.includes('/rpc/')){
   if(p==='akram_begin_checkout'){claims++;return response({order,attempt:{...attempt,checkout_url:null},claimed:true})}
   if(p==='akram_bind_checkout'){binds++;return response(null)}
   if(p==='akram_settle_verified_payment'){settled++;settledState=true;return response(order.id)}
   if(p==='akram_claim_emails')return response(mailSaved?[]:[{receipt_id:'receipt-a',lease_token:'lease-a',attempts:1,payload:null}]);
   throw Error('Unexpected RPC '+p);
  }
  if(p==='akram_payment_orders')return response(init.method==='PATCH'?null:u.searchParams.has('limit')?[]:{...order,status:settledState?'paid':'pending'});
  if(p==='akram_payment_attempts')return response(attempt);
  if(p==='akram_receipts')return response({id:'receipt-a',order_key:order.id,user_id:user.id,book_id:order.book_id,amount_minor:500,currency:'USD'});
  if(p==='akram_books')return response({data:{title:'Fixture'}});
  if(p==='akram_email_queue'){if(body.sent_at)mailSaved=true;return response(null)}
  if(p==='akram_provider_transactions')return response(init.method==='POST'?null:{attempt_id:attempt.id});
  if(p==='akram_admins')return response(null);
  if(p==='akram_payment_alerts')return response(null);
 }
 if(u.hostname==='api.stripe.com'){
  if(init.method==='POST'&&u.pathname==='/v1/checkout/sessions'){createHeaders=headers;const form=new URLSearchParams(String(init.body));if(form.get('line_items[0][price_data][unit_amount]')!=='500')throw Error('Client price trusted');return response(session)}
  if(u.pathname==='/v1/checkout/sessions/cs_fixture')return response(session);
 }
 if(u.hostname==='sandbox.waafipay.com'){const params=body.serviceName==='HPP_PURCHASE'?{referenceId:attempt.id,directPaymentLink:'https://sandbox.waafipay.com/hpp/fixture'}:wallet;return response({responseCode:'2001',errorCode:'0',params})}
 if(u.hostname==='api.resend.com'){if(headers.get('idempotency-key')!=='receipt/receipt-a')throw Error('No receipt dedup');if(!body.text.includes('Receipt: receipt-a')||!body.text.includes('read.html?book=book-a'))throw Error('Incomplete receipt');emails++;return response({id:'email-fixture'})}
 throw Error('Unexpected external request '+u.origin+u.pathname);
};
const {handler}=await import('../supabase/functions/akram-commerce/handler.ts');
let checks=0;const ok=(v:unknown,m:string)=>{if(!v)throw Error(m);checks++};const call=(path:string,body:unknown={},token='reader-token')=>handler(new Request('https://database.invalid/functions/v1/akram-commerce/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://library.invalid','Content-Type':'application/json'},body:JSON.stringify(body)}));
Deno.test('server checkout, signature verification, confirmation, receipt contracts',async()=>{
 let r=await call('checkout',{provider:'stripe',book_id:'book-a',expected_amount_minor:500,amount:1,user_id:'reader-b'});ok(r.status===200,'checkout response');ok(claims===1&&binds===1,'bound server order');ok(createHeaders?.get('idempotency-key')==='akram/attempt-a','provider idempotency');ok(settled===0,'checkout creation cannot unlock');
 r=await call('checkout',{provider:'stripe',book_id:'book-a'},'invalid');ok(r.status===401,'authentication required');
 r=await handler(new Request('https://database.invalid/functions/v1/akram-commerce/checkout',{method:'POST',headers:{Origin:'https://evil.invalid',Authorization:'Bearer reader-token'},body:'{}'}));ok(r.status===403,'origin rejection');
 Object.assign(attempt,{checkout_url:'https://checkout.stripe.com/fixture',terminal:false});const beforeResume=claims;r=await call('resume',{order_id:order.id});ok(r.status===200&&(await r.json()).url==='https://checkout.stripe.com/fixture'&&claims===beforeResume,'resume reuses hosted checkout');r=await call('admin-reconcile',{order_id:order.id});ok(r.status===403,'admin reconciliation denied to customer');
 const e={id:'event-fixture',type:'checkout.session.completed',data:{object:session}},raw=JSON.stringify(e),ts=String(Math.floor(Date.now()/1000)),sig=await hmac('fixture-webhook-only',ts+'.'+raw);
 const webhook=(value:string,signature=sig)=>handler(new Request('https://database.invalid/functions/v1/akram-commerce/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${ts},v1=${signature}`},body:value}));
 r=await webhook(raw,'bad');ok(r.status!==200&&settled===0,'invalid webhook cannot unlock');
 session.amount_total=1;r=await webhook(raw);ok(r.status!==200&&settled===0,'canonical amount mismatch rejected');session.amount_total=500;
 session.metadata.user_id='reader-b';r=await webhook(raw);ok(r.status!==200&&settled===0,'wrong buyer rejected');session.metadata.user_id=user.id;
 r=await webhook(raw);ok(r.status===200&&settled===1,'verified canonical provider payment settles');
 r=await call('jobs',{},'invalid');ok(r.status===403,'cron secret required');r=await call('jobs',{},'fixture-job-only');ok(r.status===200&&emails===1&&mailSaved,'receipt queued and delivered with purchase link');
 r=await call('jobs',{},'fixture-job-only');ok(r.status===200&&emails===1,'no duplicate sent receipt');
 Deno.env.set('WAAFI_MERCHANT_UID','merchant-fixture');Deno.env.set('WAAFI_STORE_ID','1');Deno.env.set('WAAFI_HPP_KEY','fixture-only');Deno.env.set('WAAFI_WEBHOOK_SECRET','fixture-wallet-secret');Deno.env.set('WAAFI_API_URL','https://sandbox.waafipay.com/asm');attempt.provider='waafi';attempt.provider_payment_id='ref:'+attempt.id;
 r=await call('checkout',{provider:'waafi',book_id:'book-a',expected_amount_minor:500,phone:'invalid'});ok(r.status===400,'wallet validates phone');
 r=await call('checkout',{provider:'waafi',book_id:'book-a',expected_amount_minor:500,phone:'252611111111'});ok(r.status===200,'wallet binds hosted payment');
 const wraw=JSON.stringify({event:'authorization',merchant_uid:'merchant-fixture',payment:{reference_id:attempt.id}}),wsig=await hmac('fixture-wallet-secret',ts+'.wallet-event.'+wraw);
 const walletHook=()=>handler(new Request('https://database.invalid/functions/v1/akram-commerce/waafi-webhook',{method:'POST',headers:{'x-webhook-timestamp':ts,'x-webhook-event-id':'wallet-event','x-webhook-signature':wsig},body:wraw}));
 wallet.referenceId='wrong';r=await walletHook();ok(r.status!==200,'wallet canonical reference enforced');wallet.referenceId=attempt.id;
 const previous=settled;r=await walletHook();ok(r.status===200&&settled===previous+1,'wallet verified success settles');
 r=await handler(new Request('https://database.invalid/functions/v1/akram-commerce/waafi-webhook',{method:'POST',body:JSON.stringify({event:'webhook.test'})}));ok(r.status===200&&settled===previous+1,'unsigned registration ping never grants access');
 Deno.env.set('PAYMENTS_ENABLED','false');r=await call('checkout',{provider:'stripe',book_id:'book-a'});ok(r.status===503,'disabled provider fails closed');
 console.log('PASS '+checks+' handler contract assertions (mock transports; not provider sandbox tests)');
});
