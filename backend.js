(()=>{'use strict';
const config=window.AKRAM_AUTH_CONFIG||{};let promise;
const check=r=>{if(r.error)throw r.error;return r.data};
const client=()=>promise||(promise=import('./supabase-client.js?v=20260929').then(({createClient})=>createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})));
const safeURL=s=>{if(!s)return null;try{const u=new URL(s,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
function book(r){const d=r.data;return {...d,id:r.id,title:String(d.title||''),cover:safeURL(d.cover)||'assets--books--dhis-naftaada.jpg',source:safeURL(d.source),price:Number(r.price),paid:Number(r.price)>0,published:r.published,archived:r.archived,privatePath:r.file_path,pdf:Number(r.price)>0?null:safeURL(d.pdf),text:Number(r.price)>0?null:safeURL(d.text),download:Number(r.price)>0?false:d.download!==false};}
async function rows(){return check(await (await client()).from('akram_books').select('*').order('updated_at',{ascending:false}));}
async function file(b){if(!b.privatePath)return b.pdf||b.text;const c=await client();const d=check(await c.storage.from('akram-books').createSignedUrl(b.privatePath,900));return d.signedUrl;}
// Public shelves do not depend on the authentication SDK loading or its session lock.
async function publicRequest(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(config.supabaseUrl.replace(/\/$/,'')+path,{...options,headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json',...options.headers},signal:controller.signal});
 if(!response.ok)throw Error('Library request failed ('+response.status+')');return await response.json();
 }finally{clearTimeout(timer)}
}
async function catalog(){
 if(!config.backendEnabled){const r=await fetch('./catalog.json');if(!r.ok)throw Error('Catalog unavailable');return r.json()}
 const data=await publicRequest('/rest/v1/akram_books?select=*&published=eq.true&archived=eq.false&order=updated_at.desc');
 return Promise.all(data.map(async r=>{const b=book(r);if(!b.paid&&b.privatePath){
 try{const signed=await publicRequest('/storage/v1/object/sign/akram-books/'+b.privatePath.split('/').map(encodeURIComponent).join('/'),{method:'POST',body:JSON.stringify({expiresIn:900})});
 const path=signed.signedURL||signed.signedUrl;if(!path)throw Error('Missing file URL');b.pdf=new URL(path.startsWith('/object/')?'/storage/v1'+path:path,config.supabaseUrl).href;b.text=b.pdf;
 }catch{b.pdf='./read.html?book='+encodeURIComponent(b.id);b.text=b.pdf;b.download=false;b.fileUnavailable=true}
 }return b}));
}
window.Akram={client,check,safeURL,book,rows,file,catalog,enabled:!!config.backendEnabled,
 async user(){return (await (await client()).auth.getSession()).data.session?.user||null},
 async admin(){return !!check(await (await client()).rpc('akram_is_admin'))},
 async access(id){const c=await client();if(!await this.user())return false;return !!check(await c.from('akram_entitlements').select('book_id').eq('user_id',(await this.user()).id).eq('book_id',id).maybeSingle())},
 async one(id){const r=check(await (await client()).from('akram_books').select('*').eq('id',id).single());return book(r)},
 async orders(){return check(await (await client()).from('akram_orders').select('*').order('created_at',{ascending:false}))}
};
})();
/* Additive production services. Missing deployment never produces a successful payment. */
(()=>{const A=window.Akram;A.commerce=async(action,body)=>{const c=await A.client(),session=(await c.auth.getSession()).data.session;if(!session)throw Error('Sign in required');const r=await fetch(window.AKRAM_AUTH_CONFIG.supabaseUrl+'/functions/v1/akram-commerce/'+action,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:window.AKRAM_AUTH_CONFIG.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;};A.capabilities=async()=>{try{const r=await fetch(window.AKRAM_AUTH_CONFIG.supabaseUrl+'/functions/v1/akram-commerce/capabilities',{headers:{apikey:window.AKRAM_AUTH_CONFIG.supabasePublishableKey},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();return await r.json()}catch{return {providers:{stripe:false,waafi:false},currency:'USD'}}};
A.providerOrders=async()=>A.check(await (await A.client()).from('akram_payment_orders').select('*').order('created_at',{ascending:false}));
A.position=async(book,format)=>{if(!await A.user())return null;return A.check(await (await A.client()).from('akram_reading_positions').select('*').eq('book_id',book).eq('format',format).maybeSingle())};
A.savePosition=async(book,format,page,revision)=>A.check(await (await A.client()).rpc('akram_save_position',{p_book:book,p_format:format,p_page:page,p_revision:revision}));
})();

(()=>{const A=window.Akram;A.allRows=async(table,order='id')=>{const c=await A.client();let result=[];for(let from=0;;from+=1000){const rows=A.check(await c.from(table).select('*').order(order).range(from,from+999));result.push(...rows);if(rows.length<1000)return result}};A.orders=()=>A.allRows('akram_orders');A.providerOrders=()=>A.allRows('akram_payment_orders');})();
