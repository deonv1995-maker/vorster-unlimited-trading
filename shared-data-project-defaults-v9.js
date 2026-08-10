/* V9.0.43 — browser-safe Supabase project defaults + bootstrap recovery loader.
   These are intentionally public client credentials. Never place service-role/secret keys here. */
(function(){
'use strict';
const KEY='vu-shared-data-config';
const PROJECT_URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
let cfg={};
try{cfg=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
localStorage.setItem(KEY,JSON.stringify({...cfg,projectUrl:PROJECT_URL,publishableKey:PUBLISHABLE_KEY}));
window.VU_SHARED_DATA_PROJECT={projectUrl:PROJECT_URL};
window.VU_BUILD='V9.0.43';
const label=document.getElementById('runtimeBuild');if(label)label.textContent='V9.0.43';
if(!document.querySelector('script[data-vu-bootstrap-fix]')){
  const s=document.createElement('script');s.dataset.vuBootstrapFix='1';s.src='shared-data-bootstrap-fix-v9.js?v=9.0.43';s.async=false;document.body.appendChild(s);
}
})();
