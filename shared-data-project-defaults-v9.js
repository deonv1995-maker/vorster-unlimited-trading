/* V9.0.47 — browser-safe Supabase project defaults.
   These are intentionally public client credentials. Never place service-role/secret keys here.
   Runtime build/version ownership remains with index.html; this module only supplies connection defaults. */
(function(){
'use strict';
const KEY='vu-shared-data-config';
const PROJECT_URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
let cfg={};
try{cfg=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
localStorage.setItem(KEY,JSON.stringify({...cfg,projectUrl:PROJECT_URL,publishableKey:PUBLISHABLE_KEY}));
window.VU_SHARED_DATA_PROJECT={projectUrl:PROJECT_URL};
})();
