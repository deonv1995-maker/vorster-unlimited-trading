/* Factory OS v1 — Office intake tile bridge. */
(function(){
'use strict';
if(window.VUOfficeIntakeBridge)return;
function intercept(e){const btn=e.target.closest?.('[data-fos-action="order-intake"]');if(!btn)return;if(!window.VUOfficeIntake?.open)return;e.preventDefault();e.stopImmediatePropagation();window.VUOfficeIntake.open();}
document.addEventListener('click',intercept,true);
window.VUOfficeIntakeBridge={version:'1.0.0'};
})();