/* V9.0.21 — target rescue data augmentation only. Page rendering is handled by the operations page. */
(function(){
'use strict';
const THRESHOLD=.70;
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const stages=['production','finishing','painting','delivery'];
function pct(v){return Math.max(0,Math.min(1,Number(v||0)))}
function stageProgress(order,stage,allocation){
  const p=order?.workflowProgress?.[stage];
  if(p){const required=n(p.required),completed=n(p.completed);return required?Math.min(1,completed/required):pct(p.ratio)}
  if(stage==='production'&&allocation?.required)return pct(allocation.covered/allocation.required);
  if(stage==='finishing'&&norm(order?.finishingStatus)==='completed')return 1;
  if(stage==='painting'&&norm(order?.paintingStatus)==='completed')return 1;
  return 0;
}
function nextStage(stage){const i=stages.indexOf(stage);return i>=0&&i<stages.length-1?stages[i+1]:stage}
function cloneForStage(row,stage,ratio){return{...row,predictedStage:stage,rescueEligible:true,rescueFrom:row.actualStage,rescueRatio:ratio,partialAdvance:true}}
async function saveProgress(orderId,stage,completed,required,source='worksheet'){
  if(!stages.includes(stage)||stage==='delivery')throw new Error('Invalid workflow stage');
  const order=await getOne('orders',orderId);if(!order)return null;
  const req=Math.max(0,n(required)),done=Math.min(req||n(completed),n(completed)),now=new Date().toISOString();
  const workflowProgress={...(order.workflowProgress||{}),[stage]:{completed:done,required:req,ratio:req?done/req:0,source,updatedAt:now}};
  const updated={...order,workflowProgress,updatedAt:now};await putOne('orders',updated);return updated;
}
window.vuSaveWorkflowProgress=saveProgress;
window.VUTargetRescue={threshold:THRESHOLD,saveProgress};
const original=window.buildWorkflowForecast;
if(typeof original!=='function')return;
window.buildWorkflowForecast=async function(selected){
  const p=await original(selected),gap=n(p.target)-n(p.deliveryValue);
  if(gap<=0)return{...p,rescueCandidates:[],rescueThreshold:THRESHOLD};
  const rescue=[];
  for(const row of p.rows||[]){
    if(!row.targetOrder)continue;
    const stage=row.actualStage;if(!['production','finishing','painting'].includes(stage))continue;
    const ratio=stageProgress(row.order,stage,row.allocation);if(ratio<THRESHOLD)continue;
    const advance=nextStage(stage);rescue.push({...row,rescueRatio:ratio,rescueFrom:stage,rescueTo:advance});
    const exists=(p[advance]||[]).some(x=>x.order?.id===row.order?.id&&x.partialAdvance);
    if(!exists)(p[advance]||(p[advance]=[])).unshift(cloneForStage(row,advance,ratio));
  }
  p.rescueCandidates=rescue;p.rescueThreshold=THRESHOLD;return p;
};
})();