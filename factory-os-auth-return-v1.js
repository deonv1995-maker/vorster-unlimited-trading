/* Factory OS 2.7.1 — production auth redirect + callback handling. */
(function(){
'use strict';
const SUPABASE_URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
const SESSION_KEY='vu-shared-session';
const LIVE_APP='https://deonv1995-maker.github.io/vorster-unlimited-trading/';

async function consumeAuthReturn(){
 const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
 const accessToken=hash.get('access_token');
 const refreshToken=hash.get('refresh_token');
 if(!accessToken||!refreshToken)return false;
 try{
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`}});
  if(!r.ok)throw new Error('Could not complete Factory OS sign-in.');
  const user=await r.json();
  const expiresIn=Number(hash.get('expires_in')||3600);
  localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:accessToken,refresh_token:refreshToken,token_type:hash.get('token_type')||'bearer',expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,user}));
  history.replaceState(null,'',location.pathname+location.search);
  return true;
 }catch(e){console.error('Factory OS auth callback failed',e);return false}
}

async function createAccount(email,password){
 const redirect=encodeURIComponent(LIVE_APP);
 const r=await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${redirect}`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:String(email||'').trim(),password:String(password||'')})});
 const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}
 if(!r.ok)throw new Error(body?.msg||body?.message||body?.error_description||body?.error||`Account creation failed (${r.status})`);
 return body;
}

document.addEventListener('click',async e=>{
 const b=e.target.closest?.('#fosSharedCreate');if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 const email=document.getElementById('fosSharedEmail')?.value||'';
 const password=document.getElementById('fosSharedPassword')?.value||'';
 if(!email||password.length<6){alert('Enter the staff email and a password of at least 6 characters first.');return}
 b.disabled=true;
 try{
  const r=await createAccount(email,password);
  if(r?.access_token){alert('Account created and signed in. Management can now add this email.');}
  else{alert('Account created. Open the confirmation email. After confirmation you will return to Factory OS, then sign in if needed.');}
 }catch(err){alert(err.message||err)}finally{b.disabled=false}
},true);

window.VUFactoryAuthReturn={version:'2.7.1',LIVE_APP,consumeAuthReturn,createAccount};
consumeAuthReturn();
})();