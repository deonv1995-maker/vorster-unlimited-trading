/* V9.0.42 — browser-safe Supabase project defaults for Vorster Unlimited shared data.
   These are intentionally public client credentials. Never place service-role/secret keys here. */
(function(){
'use strict';
const KEY='vu-shared-data-config';
const PROJECT_URL='https://ccdmwcxcpszqdzoetqkc.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_PNO81WcLLMLjUSH7c955Tg_YwWpXHK4';
let cfg={};
try{cfg=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const next={...cfg,projectUrl:PROJECT_URL,publishableKey:PUBLISHABLE_KEY};
localStorage.setItem(KEY,JSON.stringify(next));
window.VU_SHARED_DATA_PROJECT={projectUrl:PROJECT_URL};
})();
