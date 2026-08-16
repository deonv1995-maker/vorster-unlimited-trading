/* Factory OS 2.10.8 — adaptive low-data sync scheduler. */
(function(){
'use strict';
if(!window.VUSharedAccess||window.VUAdaptiveSync)return;
const ACTIVE_MS=60000;
const BACKGROUND_MS=300000;
let timer=null,started=false;
function delay(){return document.visibilityState==='visible'?ACTIVE_MS:BACKGROUND_MS}
function schedule(){clearTimeout(timer);timer=setTimeout(tick,delay())}
async function tick(){try{if(navigator.onLine)await window.VUSharedAccess.sync({reason:document.visibilityState==='visible'?'adaptive-active':'adaptive-background'})}catch(e){console.warn('Adaptive shared sync failed',e)}finally{schedule()}}
async function init(){if(started)return;started=true;const s=window.VUSharedAccess.getSession?.();if(!s)return;await window.VUSharedAccess.loadMembership?.();if(!window.VUSharedAccess.membership?.())return;setTimeout(()=>window.VUSharedAccess.sync({reason:'boot'}),250);schedule()}
document.addEventListener('visibilitychange',()=>{if(!started)return;clearTimeout(timer);if(document.visibilityState==='visible'&&navigator.onLine)window.VUSharedAccess.sync({reason:'resume'}).finally(schedule);else schedule()});
window.VUSharedAccess.init=init;
window.VUAdaptiveSync={version:'1.0.0',activeIntervalMs:ACTIVE_MS,backgroundIntervalMs:BACKGROUND_MS};
})();