const CONFIRMED_PRODUCTION_VERSION='1.0 Alpha 7.9.1';

async function syncConfirmedOrdersToProduction(){
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
  const buildIntegratedWorkflowBeforeConfirmedSync=buildIntegratedWorkflow;
  buildIntegratedWorkflow=async function(){
    await syncConfirmedOrdersToProduction();
    return buildIntegratedWorkflowBeforeConfirmedSync();
  };
}

window.syncConfirmedOrdersToProduction=syncConfirmedOrdersToProduction;
