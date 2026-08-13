/* V9.3.4 — applies synced manager target overrides only while a Digital Factory leader queue is built. */
(function(){
'use strict';
if(window.VUDigitalFactoryTargetBridge)return;
const RAW=new Set(['Casting','Packing','Resin']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const keyOf=x=>norm(x?.productCode)||String(x?.productId||'');
const df=window.VUDigitalFactory;if(!df?.openRaw)return;
const originalOpenRaw=df.openRaw;
async function apply(plan,date,division){
  const byDivision={...(plan?.productionByDivision||{})},items=[...(byDivision[division]||[])],overrides=await window.VUDigitalFactoryTargetOverrides?.map?.(date,division)||new Map(),seen=new Set();
  for(const [k,o] of overrides){
    const matching=[];for(let i=0;i<items.length;i++)if(keyOf(items[i])===k)matching.push(i);
    if(matching.length){matching.forEach((idx,pos)=>{items[idx]={...items[idx],quantity:pos===0?n(o.targetQty):0,managerTargetOverride:true,algorithmQuantity:items[idx].quantity}});seen.add(k)}
  }
  for(const [k,o] of overrides){if(seen.has(k)||n(o.targetQty)<=0)continue;items.push({productId:o.productId||'',productCode:o.productCode||'',productName:o.productName||'',quantity:n(o.targetQty),managerTargetOverride:true,algorithmQuantity:0,source:'Manager target override'})}
  byDivision[division]=items;return{...plan,productionByDivision:byDivision,digitalFactoryTargetOverridesApplied:true}
}
async function openRaw(division,date){
  if(!RAW.has(division)||!window.VUStrictDivisionWorksheets?.strictPlan)return originalOpenRaw(division,date);
  const holder=window.VUStrictDivisionWorksheets,base=holder.strictPlan;
  holder.strictPlan=async d=>apply(await base(d),d||date||new Date(),division);
  try{return await originalOpenRaw(division,date)}finally{holder.strictPlan=base}
}
async function openMyWork(){const r=df.role?.()||'Manager';if(RAW.has(r))return openRaw(r);if(r==='Painting')return window.openPaintingOrderCapture?.();if(r==='Delivery')return window.openDailyDispatchCapture?.(new Date());return df.openRoleSetup?.()}
window.VUDigitalFactory={...df,version:'9.3.4',openRaw,openMyWork};
window.VUDigitalFactoryTargetBridge={version:'9.3.4',apply,openRaw};
})();