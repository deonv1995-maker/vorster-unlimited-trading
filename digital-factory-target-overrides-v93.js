/* V9.3.4 — synced Digital Factory target overrides.
   Manager overrides affect only the Digital Factory effective target; algorithm targets and physical actuals remain intact. */
(function(){
'use strict';
if(window.VUDigitalFactoryTargetOverrides)return;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';
const dk=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=new Date(v||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const key=(date,division,productCode,productId)=>`digitaltarget:${dk(date)}:${slug(division)}:${slug(productCode||productId)}`;
async function all(date,division){const d=dk(date),jobs=await getAll('productionJobs');return jobs.filter(j=>j?.kind==='digitalTargetOverride'&&j.workDate===d&&(!division||j.division===division));}
async function map(date,division){const rows=await all(date,division),m=new Map();for(const j of rows)m.set(norm(j.productCode)||String(j.productId||''),j);return m}
async function set({date,division,productId='',productCode='',productName='',targetQty,algorithmTargetQty=0,note=''}){const d=dk(date),id=key(d,division,productCode,productId),now=new Date().toISOString(),old=await getOne('productionJobs',id);const row={...(old||{}),id,kind:'digitalTargetOverride',workDate:d,division,productId,productCode,productName,targetQty:Math.round(n(targetQty)),algorithmTargetQty:Math.round(n(algorithmTargetQty)),note:String(note||''),status:'Active',source:'Manager Control Today',createdAt:old?.createdAt||now,updatedAt:now};await putOne('productionJobs',row);return row}
async function clear({date,division,productId='',productCode=''}){const id=key(date,division,productCode,productId),old=await getOne('productionJobs',id);if(!old)return false;await deleteOne('productionJobs',id);return true}
async function effective(date,division,item,algorithmTargetQty){const m=await map(date,division),o=m.get(norm(item?.productCode)||String(item?.productId||''));return{algorithmTargetQty:Math.round(n(algorithmTargetQty)),targetQty:o?Math.round(n(o.targetQty)):Math.round(n(algorithmTargetQty)),override:o||null}}
window.VUDigitalFactoryTargetOverrides={version:'9.3.4',key,all,map,set,clear,effective};
})();