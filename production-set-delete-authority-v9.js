/* V9.1.03 — safe delete/rollback authority for manual production sets.
   Adds a Delete set button to saved manualProductionSet history. Deleting reverses raw stock,
   daily production totals and matching PRODUCTION_OUTPUT transactions, then deletes the set itself. */
(function(){
'use strict';
if(window.VUProductionSetDeleteAuthority)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const rawId=productId=>typeof window.vuRawBalanceId==='function'?window.vuRawBalanceId(productId):`${productId}::raw`;
function rawWorkId(date,division,item){
  if(window.VUDivisionDailyWork&&typeof window.VUDivisionDailyWork.rawWorkId==='function'){
    return window.VUDivisionDailyWork.rawWorkId(date,division,item.productId,item.productCode);
  }
  return `rawday:${date}:${String(division||'').toLowerCase()}:${item.productId}`;
}
async function reverseSet(set){
  if(!set||set.kind!=='manualProductionSet')throw new Error('Production set was not found.');
  const now=new Date().toISOString();
  const items=Array.isArray(set.items)?set.items:[];
  for(const item of items){
    const qty=n(item.quantity);if(!qty)continue;
    const bid=rawId(item.productId),bal=await getOne('inventoryBalances',bid);
    if(bal){
      const before=n(bal.quantity),after=Math.max(0,before-qty);
      await putOne('inventoryBalances',{...bal,quantity:after,updatedAt:now});
    }
    const dayId=rawWorkId(set.workDate,set.division,item),day=await getOne('productionJobs',dayId);
    if(day){
      const produced=Math.max(0,n(day.producedQty)-qty),applied=Math.max(0,n(day.inventoryAppliedQty)-qty);
      await putOne('productionJobs',{...day,producedQty:produced,completedQty:produced,inventoryAppliedQty:applied,status:produced>0?'In progress':'Not started',updatedAt:now});
    }
  }
  const txs=await getAll('inventoryTransactions');
  for(const tx of txs.filter(t=>String(t.reference||'')===String(set.id)&&norm(t.type)==='production_output')){
    await deleteOne('inventoryTransactions',tx.id);
  }
  await deleteOne('productionJobs',set.id);
  try{if(typeof window.buildOptimizedOrderJobs==='function')await window.buildOptimizedOrderJobs()}catch(e){console.warn('Planner recalc after deleting production set',e)}
  return true;
}
async function decorateHistory(){
  const host=document.getElementById('prodSetHistory'),dateEl=document.getElementById('prodSetDate'),divEl=document.getElementById('prodSetDivision');
  if(!host||!dateEl||!divEl)return;
  const date=dateEl.value,division=divEl.value;
  const sets=(await getAll('productionJobs')).filter(j=>j&&j.kind==='manualProductionSet'&&j.workDate===date&&j.division===division).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  const cards=[...host.querySelectorAll('.card')];
  cards.forEach((card,i)=>{
    const set=sets[i];if(!set||card.querySelector('[data-delete-production-set]'))return;
    const btn=document.createElement('button');btn.type='button';btn.dataset.deleteProductionSet='1';btn.className='secondary';btn.style.cssText='width:100%;margin-top:10px;min-height:44px;border-color:#b45c55;color:#d87a70;font-weight:800';btn.textContent='Delete this production set';
    btn.onclick=async()=>{
      const units=n(set.totalUnits),products=(set.items||[]).length;
      if(!confirm(`Delete this ${division} production set?\n\n${units} units · ${products} products\n\nThis will subtract the set from raw stock and from today's production totals.`))return;
      btn.disabled=true;const old=btn.textContent;btn.textContent='Deleting…';
      try{await reverseSet(set);if(typeof window.notify==='function')window.notify(`${division} production set deleted · ${units} units reversed`);dateEl.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(decorateHistory,200)}catch(e){console.error('Delete production set',e);alert(e&&e.message?e.message:'Could not delete production set.');btn.disabled=false;btn.textContent=old;}
    };
    card.appendChild(btn);
  });
}
let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>decorateHistory().catch(e=>console.warn('Production set delete decoration',e)),80)};
const obs=new MutationObserver(schedule);obs.observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(e.target&&(/prodSetDate|prodSetDivision/.test(e.target.id||'')))schedule()},true);
setTimeout(schedule,300);
window.VUProductionSetDeleteAuthority={version:'9.1.03',reverseSet,decorateHistory};
})();