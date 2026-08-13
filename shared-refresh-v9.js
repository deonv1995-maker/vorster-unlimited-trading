/* V9.4.3 — passive shared-data freshness marker.
   Shared sync updates IndexedDB only. The active page is never redrawn automatically. */
(function(){
'use strict';
if(window.VUSharedRefresh)return;
const dirtyStores=new Set();let pending=false;
function schedule(store){if(store)dirtyStores.add(String(store));pending=dirtyStores.size>0;try{window.dispatchEvent(new CustomEvent('vu:shared-data-dirty',{detail:{stores:[...dirtyStores]}}))}catch{}}
async function refresh(){if(!pending)return true;const fn=window.VUNavigationAuthority?.refreshCurrent;if(typeof fn!=='function'||window.VUNavigationAuthority?.isBusy?.())return false;const ok=await fn();if(ok){dirtyStores.clear();pending=false}return !!ok;}
function clear(){dirtyStores.clear();pending=false}
window.addEventListener('vu:page-rendered',clear);
window.VUSharedRefresh={version:'9.4.3',schedule,refresh,clear,dirtyStores,pending:()=>pending};
})();