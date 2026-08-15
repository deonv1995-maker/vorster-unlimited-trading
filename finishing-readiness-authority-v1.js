/* Factory OS 2.9.7 — lightweight finishing readiness authority.
   Finishing & Painting is the single operational writer for painted output.
   Order/product views consume readiness only. */
(function(){'use strict';if(window.VUFinishingReadinessAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
function state(ready,required){if(required<=0||ready>=required)return{label:'Ready for dispatch',cls:'is-ready'};if(ready>0)return{label:`Part ready · ${ready}/${required}`,cls:'is-partial'};return{label:'Needs finishing',cls:'is-waiting'}}
function applyStatic(root=document){
  root.querySelectorAll?.('.fos-mark-painted').forEach(el=>el.remove());
  root.querySelectorAll?.('.fos-stock-correction').forEach(el=>{const p=el.querySelector('p.muted');if(p)p.textContent='Use these fields only to correct a physical stock count or manufacturing limit. Painted readiness is recorded from Finishing & Painting.'});
  root.querySelectorAll?.('.fos-order-line-action').forEach(el=>{if(/Product readiness|View readiness/i.test(el.textContent||''))el.textContent='View readiness & stock ›'});
  root.querySelectorAll?.('section.card > p.muted').forEach(el=>{if(/Tap a product to mark finishing output or correct stock\/capacity/i.test(el.textContent||''))el.textContent='Readiness is shown live on each item. Tap a product only for stock/capacity detail or correction.'});
}
let running=false;
async function decorateOpenOrder(){
  if(running||!window.VUFactoryDispatch?.build)return;
  const dialog=document.querySelector('dialog[open]');if(!dialog)return;
  const tiles=[...dialog.querySelectorAll('.fos-order-line')];if(!tiles.length)return;
  const undecorated=tiles.filter(t=>!t.querySelector('.fos-live-readiness'));if(!undecorated.length)return;
  const title=dialog.querySelector('.dialog-head h2')?.textContent||'';
  const orderNumber=String(title).split('·')[0].trim();if(!orderNumber)return;
  running=true;
  try{
    const model=await VUFactoryDispatch.build();
    const order=(model.orders||[]).find(o=>String(o.orderNumber||'').trim()===orderNumber);if(!order)return;
    const rows=order.lines||[];
    for(const tile of undecorated){
      if(!tile.isConnected||tile.querySelector('.fos-live-readiness'))continue;
      const head=tile.querySelector('.fos-order-line-head');if(!head)continue;
      const productCode=String(head.querySelector('strong')?.textContent||'').split('·')[0].trim().toUpperCase();
      const colour=head.querySelector('span')?.textContent||'Standard';
      const r=rows.find(x=>String(x.productCode||'').trim().toUpperCase()===productCode&&norm(x.colour)===norm(colour));if(!r)continue;
      const required=n(r.required),ready=Math.min(required,n(r.ready)),waiting=Math.max(0,required-ready),s=state(ready,required);
      const box=document.createElement('div');box.className=`fos-live-readiness ${s.cls}`;
      box.innerHTML=`<div><small>Ready allocated</small><strong>${ready} / ${required}</strong></div><div><small>Still needs finishing</small><strong>${waiting}</strong></div><b>${s.label}</b>`;
      const action=tile.querySelector('.fos-order-line-action');tile.insertBefore(box,action||null);
    }
  }catch(e){console.warn('Readiness tile refresh failed',e)}finally{running=false}
}
function style(){if(document.getElementById('fosLiveReadinessStyle'))return;const s=document.createElement('style');s.id='fosLiveReadinessStyle';s.textContent='.fos-live-readiness{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:12px;padding:11px 0;border-top:1px solid var(--line);text-align:left}.fos-live-readiness div small{display:block;color:var(--muted);font-size:.76rem}.fos-live-readiness div strong{display:block;font-size:1rem}.fos-live-readiness>b{grid-column:1/-1;padding:7px 9px;border-radius:9px;font-size:.82rem;background:rgba(150,150,150,.12)}.fos-live-readiness.is-ready>b{background:rgba(80,170,120,.16)}.fos-live-readiness.is-partial>b{background:rgba(200,155,70,.16)}';document.head.appendChild(s)}
let timer=0;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{applyStatic(document);decorateOpenOrder()},80)}
function start(){style();applyStatic(document);const dialog=document.getElementById('dialog');if(dialog){new MutationObserver(()=>schedule()).observe(dialog,{childList:true});dialog.addEventListener('close',()=>{running=false})}document.addEventListener('click',e=>{if(e.target.closest?.('[data-order-id],[data-view-order]'))schedule()},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.VUFinishingReadinessAuthority={version:'2.9.7',apply:applyStatic,decorateOpenOrder};})();