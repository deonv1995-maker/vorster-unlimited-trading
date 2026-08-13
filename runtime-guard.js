/* Factory OS first-paint gate. */
(function(){
'use strict';
try{
 document.documentElement.classList.add('vu-booting');
 let s=document.getElementById('vuBootGateStyle');
 if(!s){s=document.createElement('style');s.id='vuBootGateStyle';s.textContent='html.vu-booting #app{visibility:hidden!important;pointer-events:none!important}';document.head.appendChild(s)}
}catch{}
let released=false;
window.VUReleaseBootGate=function(force=false){if(released)return;if(!force&&!window.__VU_FACTORY_OS_READY)return;released=true;document.documentElement.classList.remove('vu-booting')};
window.addEventListener('vu:factory-os-ready',()=>window.VUReleaseBootGate(true),{once:true});
setTimeout(()=>window.VUReleaseBootGate(true),12000);
})();