(()=>{'use strict';
const config=window.AKRAM_AUTH_CONFIG||{};
const login=document.querySelector('.login-link'),signup=document.querySelector('.signup-link');
if(!login||!signup||!config.supabaseUrl||!config.supabasePublishableKey)return;
let client,user;
const so=()=>document.documentElement.lang==='so';
const dialog=document.createElement('dialog');dialog.className='member-dialog';
dialog.innerHTML='<button class="member-close" aria-label="Close">×</button><div class="member-avatar" aria-hidden="true"></div><h2></h2><p class="member-name"></p><p class="member-email"></p><p class="member-note"></p><p><a href="purchases.html">My purchases / Buugaagtayda</a></p><p><a href="admin.html">Owner dashboard / Maamulka</a></p><button class="member-logout"></button><p class="member-error" role="status"></p>';
document.body.append(dialog);
const q=s=>dialog.querySelector(s);
q('.member-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function render(){
 signup.hidden=!!user;signup.style.display=user?'none':'';
 login.textContent=user?(so()?'Akoonkayga':'My Profile'):(so()?'Soo gal':'Log in');
 login.dataset.en=user?'My Profile':'Log in';login.dataset.so=user?'Akoonkayga':'Soo gal';
 login.href=user?'#my-profile':'account.html?view=signin';
 const create=document.querySelector('.side-note a');if(create)create.hidden=!!user;
 if(user){q('h2').textContent=so()?'Akoonkayga':'My Profile';q('.member-name').textContent=user.user_metadata?.full_name||user.user_metadata?.name||'';q('.member-email').textContent=user.email||'';q('.member-avatar').textContent=(user.user_metadata?.full_name||user.email||'A').slice(0,1).toUpperCase();q('.member-note').textContent=so()?'Akhriska iyo favorites-ka hadda qalabkan ayay ku kaydsan yihiin.':'Reading progress and favorites are currently saved on this device.';q('.member-logout').textContent=so()?'Ka bax':'Sign out';}
}
login.addEventListener('click',e=>{if(user){e.preventDefault();render();dialog.showModal()}});
document.querySelector('.platform-sidebar nav a[href="account.html"]')?.addEventListener('click',e=>{if(user){e.preventDefault();render();dialog.showModal()}});
q('.member-logout').onclick=async()=>{const b=q('.member-logout');b.disabled=true;q('.member-error').textContent='';try{const {error}=await client.auth.signOut();if(error)throw error;user=null;render();dialog.close()}catch{q('.member-error').textContent=so()?'Ka bixiddu ma dhammaan. Mar kale isku day.':'Could not sign out. Please try again.'}finally{b.disabled=false}};
let lastLanguage=document.documentElement.lang;
new MutationObserver(()=>{const nextLanguage=document.documentElement.lang;if(nextLanguage===lastLanguage)return;lastLanguage=nextLanguage;render()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
(async()=>{try{client=await window.Akram.client();client.auth.onAuthStateChange((event,session)=>{user=session?.user||null;render()});const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;render()}catch{login.title='Account connection unavailable; open sign in to retry.'}})();
})();
