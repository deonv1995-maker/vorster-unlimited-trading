/* Version 8 workflow bootstrap: one confirmed-order entry rule for the production pipeline. */
const VU_WORKFLOW_VERSION='8.0.1';

async function syncConfirmedOrdersToProductionV8(){
  const orders=await getAll('orders');
  const now=new Date().toISOString();
  let changed=0;

  for(const order of orders){
    const status=String(order.status||'').trim().toLowerCase();
    const hasDemand=(order.lines||[]).some(line=>Number(line.qty||0)>0);
    if(status!=='confirmed'||!hasDemand)continue;

    await putOne('orders',{
      ...order,
      status:'In Production',
      workflowStage:order.workflowStage||'raw',
      productionEnteredAt:order.productionEnteredAt||now,
      updatedAt:now
    });
    changed++;
  }

  return changed;
}

if(typeof buildIntegratedWorkflow==='function'){
  const buildIntegratedWorkflowV8Base=buildIntegratedWorkflow;
  buildIntegratedWorkflow=async function buildIntegratedWorkflowV8(){
    await syncConfirmedOrdersToProductionV8();
    return buildIntegratedWorkflowV8Base();
  };
}

window.syncConfirmedOrdersToProduction=syncConfirmedOrdersToProductionV8;

(async()=>{
  try{
    const changed=await syncConfirmedOrdersToProductionV8();
    if(changed&&typeof route!=='undefined'&&route==='dashboard'&&typeof dashboard==='function')await dashboard();
  }catch(error){
    console.warn('Confirmed-order workflow startup failed',error);
  }
})();
