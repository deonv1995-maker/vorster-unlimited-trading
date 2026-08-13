/* V9.4.4 — final page-position stability. UI only. */
(function(){
'use strict';
if(window.VUNavigationMotionStability)return;
const s=document.createElement('style');s.id='vuNavigationMotionStability';s.textContent='html{scroll-behavior:auto!important}#main{overflow-anchor:none}';document.head.appendChild(s);
try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch{}
window.addEventListener('vu:page-rendered',e=>{if(e?.detail?.refresh)return;requestAnimationFrame(()=>{try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{window.scrollTo(0,0)}})});
window.VUNavigationMotionStability={version:'9.4.4'};
})();