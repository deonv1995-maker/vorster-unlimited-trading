/* Factory OS bootstrap bridge. */
(function(){
'use strict';const BUILD='FACTORY-OS-1.0.2';window.VU_BUILD=BUILD;
function label(){const el=document.getElementById('runtimeBuild');if(el)el.textContent=BUILD}
function load(src,mark){return new Promise((resolve,reject)=>{const existing=document.querySelector(`script[data-${mark}]`);if(existing)return resolve();const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(`data-${mark}`,'1');s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
async function start(){
 await load('factory-os-core-v1.js?v=1.0.0','factory-core');
 await load('factory-os-roles-v1.js?v=1.0.0','factory-roles');
 await load('factory-os-home-v1.js?v=1.0.0','factory-home');
 await load('factory-os-office-intake-v1.js?v=1.0.0','factory-office-intake');
 await load('factory-os-office-intake-bridge-v1.js?v=1.0.0','factory-office-intake-bridge');
 label();
 const oldDashboard=window.dashboard;
 window.dashboard=async function(){if(window.VUFactoryOSHome?.render)return window.VUFactoryOSHome.render();if(typeof oldDashboard==='function')return oldDashboard()};
 try{dashboard=window.dashboard}catch{}
 const role=window.VUFactoryOS?.role?.()||'Management';
 const nav=document.querySelector('.bottom-nav');if(nav)nav.style.display='none';
 const calendar=document.getElementById('calendarQuickBtn');if(calendar)calendar.style.display=['Management','Office','Delivery'].includes(role)?'':'none';
 const merge=document.getElementById('mergeNativeBtn');if(merge)merge.style.display=role==='Management'?'':'none';
 if(typeof window.navigate==='function')await window.navigate('dashboard');
}
label();start().catch(e=>console.error('Factory OS bootstrap failed',e));
window.VUOperationalBuild={version:'factory-os-1.0.2'};
})();