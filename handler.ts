import {createClient} from 'npm:@supabase/supabase-js@2.50.0';
import {verify,same,minor,paymentMatches,checkoutURL} from './security.ts';
const env=(n:string)=>Deno.env.get(n)||'',db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const SITE=env('SITE_URL').replace(/\/$/,'')+'/',origin=()=>{try{return new URL(SITE).origin}catch{return 'null'}};
const data=(r:any)=>{if(r.error)throw r.error;return r.data;};
const rpc=async(n:string,p:Record<string,unknown>={})=>data(await db.rpc(n,p));
const available=()=>({stripe:env('PAYMENTS_ENABLED')==='true'&&!!env('STRIPE_SECRET_KEY')&&!!env('STRIPE_WEBHOOK_SECRET'),waafi:env('PAYMENTS_ENABLED')==='true'&&!!env('WAAFI_MERCHANT_UID')&&!!env('WAAFI_STORE_ID')&&!!env('WAAFI_HPP_KEY')&&!!env('WAAFI_WEBHOOK_SECRET')&&!!env('WAAFI_API_URL')});
async function api(url:string,init:RequestInit){const r=await fetch(url,{...init,signal:AbortSignal.timeout(18000)});const v=await r.json();if(!r.ok)throw Error('Provider request failed '+r.status);return v;}
async function stripe(path:string,body?:URLSearchParams,key?:string){return api('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env('STRIPE_SECRET_KEY'),...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?.toString()});}
async function waafi(serviceName:string,params:Record<string,unknown>,requestId=crypto.randomUUID()){const url=env('WAAFI_API_URL');if(url!==(env('PAYMENT_MODE')==='live'?'https://api.waafipay.net/asm':'https://sandbox.waafipay.com/asm'))throw Error('Configure approved Waafi API URL');const v=await api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'1.0',requestId,timestamp:new Date().toISOString(),channelName:'WEB',serviceName,serviceParams:{merchantUid:env('WAAFI_MERCHANT_UID'),storeId:Number(env('WAAFI_STORE_ID')),hppKey:env('WAAFI_HPP_KEY'),...params}})});if(String(v.responseCode)!=='2001'||String(v.errorCode)!=='0')throw Error('Waafi response requires reconciliation');return v.params;}
async function attempt(id:string){const a=data(await db.from('akram_payment_attempts').select('*').eq('id',id).single());const o=data(await db.from('akram_payment_orders').select('*').eq('id',a.order_id).single());return {a,o};}
async function reconcile(a:any,o:any,event?:string){
 if(a.provider==='stripe'){
  if(!a.provider_payment_id)return o;
  const s=await stripe('checkout/sessions/'+encodeURIComponent(a.provider_payment_id));
  if(s.client_reference_id!==o.id||s.metadata?.attempt_id!==a.id||s.metadata?.user_id!==o.user_id||s.metadata?.book_id!==o.book_id)throw Error('Provider identity mismatch');
  if(s.livemode!==(env('PAYMENT_MODE')==='live'))throw Error('Payment mode mismatch');
  paymentMatches(o,s.amount_total,s.currency);
  if(s.payment_status==='paid'){const txn=typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id;if(!txn)throw Error('Missing payment identity');data(await db.from('akram_provider_transactions').upsert({provider:'stripe',transaction_id:txn,attempt_id:a.id},{onConflict:'provider,transaction_id',ignoreDuplicates:true}));const bound=data(await db.from('akram_provider_transactions').select('attempt_id').eq('provider','stripe').eq('transaction_id',txn).single());if(bound.attempt_id!==a.id)throw Error('Transaction belongs to another order');await rpc('akram_settle_verified_payment',{p_provider:'stripe',p_event:event||'reconcile:'+s.id,p_payment:s.id,p_amount:s.amount_total,p_currency:s.currency.toUpperCase()});}
  else if(s.status==='expired')await rpc('akram_payment_terminal',{p_attempt:a.id,p_status:'cancelled'});
 }else{
  const s=await waafi('HPP_GETTRANINFO',{referenceId:a.id});
  if(String(s.referenceId)!==a.id)throw Error('Waafi reference mismatch');
  paymentMatches(o,minor(s.tranAmount??s.amount),String(s.currency));
  const status=String(s.status||s.tranStatusDesc).toUpperCase();
  if(status==='APPROVED'){
   if(!s.transactionId)throw Error('Missing transaction ID');
   // Transaction identity is stored separately from the hosted checkout order id.
   const txn=String(s.transactionId);data(await db.from('akram_provider_transactions').upsert({provider:'waafi',transaction_id:txn,attempt_id:a.id},{onConflict:'provider,transaction_id',ignoreDuplicates:true}));
   const bound=data(await db.from('akram_provider_transactions').select('attempt_id').eq('provider','waafi').eq('transaction_id',txn).single());if(bound.attempt_id!==a.id)throw Error('Transaction belongs to another order');
   if(!a.provider_payment_id)await rpc('akram_bind_checkout',{p_attempt:a.id,p_payment:'ref:'+a.id,p_url:''});
   await rpc('akram_settle_verified_payment',{p_provider:'waafi',p_event:event||'reconcile:'+txn,p_payment:a.provider_payment_id||'ref:'+a.id,p_amount:minor(s.tranAmount??s.amount),p_currency:String(s.currency).toUpperCase()});
  }else if(['DECLINED','FAILED','CANCELED','CANCELLED','EXPIRED'].includes(status))await rpc('akram_payment_terminal',{p_attempt:a.id,p_status:['FAILED','DECLINED'].includes(status)?'failed':'cancelled'});
 }
 data(await db.from('akram_payment_orders').update({last_checked_at:new Date().toISOString()}).eq('id',o.id));return data(await db.from('akram_payment_orders').select('*').eq('id',o.id).single());
}
async function pool(items:any[],size:number,work:(item:any)=>Promise<void>){let cursor=0;await Promise.all(Array.from({length:Math.min(size,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];await work(item)}}));}
async function emails(){if(!env('RESEND_API_KEY')||!env('RECEIPT_FROM'))return {blocked:'Email provider not configured'};const jobs=await rpc('akram_claim_emails');let sent=0;
 await pool(jobs,2,async q=>{try{let payload=q.payload;if(!payload){const r=data(await db.from('akram_receipts').select('*').eq('id',q.receipt_id).single()),u=data(await db.auth.admin.getUserById(r.user_id)).user,b=data(await db.from('akram_books').select('data').eq('id',r.book_id).single());if(!u.email)throw Error('Account has no email');payload={from:env('RECEIPT_FROM'),to:[u.email],reply_to:'cadeakram72@gmail.com',subject:'Your Akram Library purchase / Iibsashadaada',text:`AKRAM LIBRARY\n\n${b.data.title}\n${(r.amount_minor/100).toFixed(2)} ${r.currency}\nReceipt: ${r.id}\nOrder: ${r.order_key}\n\nRead your book / Akhri buuggaaga:\n${SITE}read.html?book=${encodeURIComponent(r.book_id)}&start=1\n\nSign in with the account used for this purchase. / Ku soo gal akoonkii aad ku iibsatay.\nSupport: cadeakram72@gmail.com\nRefund information: ${SITE}refund.html`};data(await db.from('akram_email_queue').update({payload}).eq('receipt_id',q.receipt_id).eq('lease_token',q.lease_token));}
 await api('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'receipt/'+q.receipt_id},body:JSON.stringify(payload)});
 data(await db.from('akram_email_queue').update({sent_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('receipt_id',q.receipt_id).eq('lease_token',q.lease_token));sent++;
 }catch{await db.from('akram_email_queue').update({last_error:'Delivery failed; retry scheduled',lease_until:new Date(Date.now()+Math.min(3600000,60000*2**q.attempts)).toISOString()}).eq('receipt_id',q.receipt_id).eq('lease_token',q.lease_token);}});
 return {sent};}
async function limitedBody(req:Request,limit:number){const reader=req.body?.getReader();if(!reader)return '';let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Object.assign(Error('Body too large'),{status:413})}chunks.push(value)}const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
export async function handler(req:Request){const path=new URL(req.url).pathname.split('/').pop()||'',cors={'Access-Control-Allow-Origin':origin(),'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json'}});
 try{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(path==='capabilities'&&req.method==='GET')return json({providers:available(),currency:'USD',country:null});
 if(path==='stripe-webhook'||path==='waafi-webhook'){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);const raw=await limitedBody(req,262144);const provider=path==='stripe-webhook'?'stripe':'waafi';
  const e=JSON.parse(raw);if(provider==='waafi'&&e.event==='webhook.test')return json({received:true});
  await verify(provider,req.headers,raw,env(provider==='stripe'?'STRIPE_WEBHOOK_SECRET':'WAAFI_WEBHOOK_SECRET'));
  if((provider==='stripe'&&['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(e.type))||(provider==='waafi'&&e.event==='refund')){
   if(provider==='waafi'&&String(e.merchant_uid)!==env('WAAFI_MERCHANT_UID'))throw Error('Wrong merchant');
   if(provider==='stripe'&&e.livemode!==(env('PAYMENT_MODE')==='live'))throw Error('Wrong payment mode');
   // Signed financial adjustments are retained for merchant review, never silently discarded.
   data(await db.from('akram_payment_alerts').upsert({provider,event_id:provider==='stripe'?e.id:req.headers.get('x-webhook-event-id'),kind:provider==='stripe'?e.type:'refund',reference:String(provider==='stripe'?(e.data.object.payment_intent||e.data.object.id):(e.payment?.transaction_id||''))},{onConflict:'provider,event_id',ignoreDuplicates:true}));return json({received:true,review:true});
  }
  if(provider==='stripe'){
   if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(e.type))return json({received:true});
   const s=e.data.object;if(!s.metadata?.attempt_id)throw Error('Unbound payment');const {a,o}=await attempt(s.metadata.attempt_id);if(a.provider!=='stripe')throw Error('Provider mismatch');
   // Retrieve through merchant API, do not trust return URL or webhook amounts.
   const canonical=await stripe('checkout/sessions/'+encodeURIComponent(s.id));if(canonical.metadata?.attempt_id!==a.id||canonical.client_reference_id!==o.id||canonical.metadata?.user_id!==o.user_id||canonical.metadata?.book_id!==o.book_id)throw Error('Wrong order');paymentMatches(o,canonical.amount_total,canonical.currency);
   if(!a.provider_payment_id){await rpc('akram_bind_checkout',{p_attempt:a.id,p_payment:canonical.id,p_url:canonical.url||''});a.provider_payment_id=canonical.id;}else if(a.provider_payment_id!==s.id)throw Error('Wrong session');
   await reconcile(a,o,e.id);
   if(e.type==='checkout.session.async_payment_failed'&&canonical.payment_status!=='paid')await rpc('akram_payment_terminal',{p_attempt:a.id,p_status:'failed'});
  }else{
   if(String(e.merchant_uid)!==env('WAAFI_MERCHANT_UID'))throw Error('Wrong merchant');if(e.event!=='authorization')return json({received:true});const {a,o}=await attempt(String(e.payment?.reference_id||''));if(a.provider!=='waafi')throw Error('Provider mismatch');await reconcile(a,o,req.headers.get('x-webhook-event-id')!);
  }return json({received:true});
 }
 if(path==='jobs'){
  if(req.method!=='POST'||!env('CRON_SECRET')||!same(req.headers.get('authorization')||'','Bearer '+env('CRON_SECRET')))return json({error:'Forbidden'},403);
  const orders=data(await db.from('akram_payment_orders').select('*').eq('status','pending').order('last_checked_at',{ascending:true,nullsFirst:true}).limit(4));let checked=0,errors=0;await pool(orders,4,async o=>{const a=data(await db.from('akram_payment_attempts').select('*').eq('order_id',o.id).eq('generation',o.generation).maybeSingle());if(a)try{await reconcile(a,o);checked++;}catch{errors++;await db.from('akram_payment_orders').update({last_checked_at:new Date().toISOString()}).eq('id',o.id);await db.from('akram_payment_attempts').update({last_error:'Provider reconciliation requires review'}).eq('id',a.id);}});return json({checked,errors,receipts:await emails()});
 }
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin())return json({error:'Origin not allowed'},403);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const {data:auth,error}=await db.auth.getUser(token);if(error||!auth.user)return json({error:'Sign in required'},401);const user=auth.user;
 if(req.method!=='POST')return json({error:'Method not allowed'},405);const raw=await limitedBody(req,4096);const body=JSON.parse(raw||'{}');
 if(path==='checkout'){
  if(origin()==='null'||!SITE.startsWith('https://')||!['test','live'].includes(env('PAYMENT_MODE')))return json({error:'Merchant configuration incomplete'},503);
  const provider=String(body.provider);if(!(available() as any)[provider])return json({error:'Payment provider not activated'},503);
  if(provider==='waafi'&&!/^\d{8,15}$/.test(body.phone||''))return json({error:'Enter your mobile number with country code, without +'},400);
  const {order:o,attempt:a,claimed}=await rpc('akram_begin_checkout',{p_user:user.id,p_book:String(body.book_id),p_provider:provider});
  if(body.expected_amount_minor!==o.amount_minor)return json({error:'The order total changed. Reload checkout and review the total before paying.'},409);
  if(a.checkout_url&&!a.terminal)return json({order:o,url:a.checkout_url});if(!claimed)return json({order:o,pending:true});
  let payment:string,url:string;
  if(provider==='stripe'){
   const p=new URLSearchParams({mode:'payment',client_reference_id:o.id,customer_email:user.email||'',success_url:SITE+'checkout.html?book='+encodeURIComponent(o.book_id),cancel_url:SITE+'checkout.html?book='+encodeURIComponent(o.book_id)+'&return=cancelled','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(o.amount_minor),'line_items[0][price_data][product_data][name]':o.book_title||'Akram Library book','line_items[0][quantity]':'1','metadata[attempt_id]':a.id,'metadata[user_id]':o.user_id,'metadata[book_id]':o.book_id});
   const s=await stripe('checkout/sessions',p,'akram/'+a.id);if(s.livemode!==(env('PAYMENT_MODE')==='live'))throw Error('Merchant key mode mismatch');payment=s.id;url=checkoutURL(s.url,['checkout.stripe.com']);
  }else{
   const s=await waafi('HPP_PURCHASE',{paymentMethod:'MWALLET_ACCOUNT',hppSuccessCallbackUrl:SITE+'checkout.html?book='+encodeURIComponent(o.book_id),hppFailureCallbackUrl:SITE+'checkout.html?book='+encodeURIComponent(o.book_id)+'&return=cancelled',hppRespDataFormat:2,payerInfo:{subscriptionId:body.phone},transactionInfo:{referenceId:a.id,amount:o.amount_minor/100,currency:o.currency,description:'Akram Library '+o.id}},a.id);if(String(s.referenceId)!==a.id)throw Error('Waafi binding mismatch');payment='ref:'+a.id;url=checkoutURL(s.directPaymentLink||s.hppUrl,['sandbox.waafipay.com','waafipay.com','hpp.waafipay.com']);
  }
  await rpc('akram_bind_checkout',{p_attempt:a.id,p_payment:payment,p_url:url});return json({order:o,url});
 }
 if(path==='admin-reconcile'){
  const admin=data(await db.from('akram_admins').select('user_id').eq('user_id',user.id).maybeSingle());if(!admin)return json({error:'Admin only'},403);
  const o=data(await db.from('akram_payment_orders').select('*').eq('id',body.order_id).single()),a=data(await db.from('akram_payment_attempts').select('*').eq('order_id',o.id).eq('generation',o.generation).maybeSingle());return json({order:a?await reconcile(a,o):o});
 }
 if(path==='status'||path==='cancel'||path==='resume'){
  const o=data(await db.from('akram_payment_orders').select('*').eq('id',body.order_id).eq('user_id',user.id).single());const a=data(await db.from('akram_payment_attempts').select('*').eq('order_id',o.id).eq('generation',o.generation).maybeSingle());
  if(!a)return json({order:o});if(path==='resume')return json({order:o,url:o.status==='pending'&&!a.terminal&&a.checkout_url?checkoutURL(a.checkout_url,a.provider==='stripe'?['checkout.stripe.com']:['sandbox.waafipay.com','waafipay.com','hpp.waafipay.com']):null});if(path==='cancel'){
   if(a.provider!=='stripe'||!a.provider_payment_id)return json({error:'Contact support to resolve this payment safely'},409);
   const s=await stripe('checkout/sessions/'+encodeURIComponent(a.provider_payment_id));if(s.status==='open')await stripe('checkout/sessions/'+encodeURIComponent(a.provider_payment_id)+'/expire',new URLSearchParams(),'cancel/'+a.id);
  }
  if(path==='status'&&o.last_checked_at&&Date.now()-Date.parse(o.last_checked_at)<15000)return json({order:o});
  return json({order:await reconcile(a,o)});
 }
 return json({error:'Not found'},404);
 }catch(e){console.error('commerce_error',path,e instanceof Error?e.name:'error');return json({error:'Unable to complete this request. Check purchase history before retrying; no new payment should be sent until its status is known.'},(e as any)?.status===413?413:502);}
}

