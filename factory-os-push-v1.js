/* Factory OS push notifications — Office registration and delivery invoice alerts. */
(function(){
'use strict';
if(window.VUFactoryPush)return;
const URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
const VAPID_PUBLIC='BHsnAq8altvlh25u2iMc25599IBpC_X28Hy0rUw545locee96ENX_QvBhTkvm5SDPM9psFwZKQgqX92bLDjU73Q';
const WORKSPACE='66e69e45-b949-45a3-8162-a7a01d93cb84';
function supported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window}
function b64ToBytes(s){const pad='='.repeat((4-s.length%4)%4),raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function session(){return window.VUSharedAccess?.getSession?.()||null}
async function call(body){const s=await session();if(!s?.access_token)throw new Error('Shared Factory OS sign-in is required.');const r=await fetch(`${URL}/functions/v1/factory-push`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,workspaceId:WORKSPACE})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`Push service error ${r.status}`);return data}
async function register(){if(!supported())throw new Error('This device/browser does not support background notifications.');let permission=Notification.permission;if(permission!=='granted')permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notification permission was not granted.');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(VAPID_PUBLIC)});const json=sub.toJSON();await call({action:'register',subscription:json});localStorage.setItem('vu-office-push-enabled','1');return true}
async function autoRegister(){if(!supported()||Notification.permission!=='granted'||!window.VUSharedAccess?.membership?.())return false;try{return await register()}catch(e){console.warn('Push auto-registration failed',e);return false}}
async function notifyLoadingCompleted(info){return call({action:'loading_completed',...info})}
function enabled(){return supported()&&Notification.permission==='granted'&&localStorage.getItem('vu-office-push-enabled')==='1'}
window.VUFactoryPush={version:'1.0.0',supported,register,autoRegister,notifyLoadingCompleted,enabled};
})();