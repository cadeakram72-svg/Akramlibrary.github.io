(()=>{'use strict';
const config=window.AKRAM_AUTH_CONFIG||{};let promise;
const check=r=>{if(r.error)throw r.error;return r.data};
const client=()=>promise||(promise=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm').then(({createClient})=>createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})));
const safeURL=s=>{if(!s)return null;try{const u=new URL(s,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
function book(r){const d=r.data;return {...d,id:r.id,title:String(d.title||''),cover:safeURL(d.cover)||'assets--books--dhis-naftaada.jpg',source:safeURL(d.source),price:Number(r.price),paid:Number(r.price)>0,published:r.published,archived:r.archived,privatePath:r.file_path,pdf:Number(r.price)>0?null:safeURL(d.pdf),text:Number(r.price)>0?null:safeURL(d.text),download:Number(r.price)>0?false:d.download!==false};}
async function rows(){return check(await (await client()).from('akram_books').select('*').order('updated_at',{ascending:false}));}
async function file(b){if(!b.privatePath)return b.pdf||b.text;const c=await client();const d=check(await c.storage.from('akram-books').createSignedUrl(b.privatePath,900));return d.signedUrl;}
async function catalog(){if(!config.backendEnabled){const r=await fetch('./catalog.json');if(!r.ok)throw Error('Catalog unavailable');return r.json()}return Promise.all((await rows()).filter(r=>r.published&&!r.archived).map(async r=>{const b=book(r);if(!b.paid&&b.privatePath){b.pdf=await file(b);b.text=b.pdf}return b}));}
window.Akram={client,check,safeURL,book,rows,file,catalog,enabled:!!config.backendEnabled,
 async user(){return (await (await client()).auth.getSession()).data.session?.user||null},
 async admin(){return !!check(await (await client()).rpc('akram_is_admin'))},
 async access(id){const c=await client();if(!await this.user())return false;return !!check(await c.from('akram_entitlements').select('book_id').eq('book_id',id).maybeSingle())},
 async one(id){const r=check(await (await client()).from('akram_books').select('*').eq('id',id).single());return book(r)},
 async orders(){return check(await (await client()).from('akram_orders').select('*').order('created_at',{ascending:false}))}
};
})();
