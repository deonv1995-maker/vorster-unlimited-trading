(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const norm=value=>String(value||'').trim().toUpperCase();

  function button(){return document.getElementById('mergeNativeBtn')}
  function close(){const d=document.getElementById('dialog');if(d?.open)d.close();if(d){d.innerHTML='';delete d.dataset.productSetupLocked}}

  async function openMerge(options={}){
    const sourceId=String(options?.sourceId||'');
    const products=(await getAll('products')).filter(product=>product.isActive!==false).sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
    const optionsHtml=products.map(product=>`<option value="${esc(product.id)}">${esc(product.code||'')} · ${esc(product.name||'')}</option>`).join('');
    const dialog=document.getElementById('dialog');
    if(!dialog)return;
    delete dialog.dataset.productSetupLocked;
    dialog.innerHTML=`<form method="dialog" class="modal-form" style="padding:22px;max-height:88vh;overflow:auto"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div class="eyebrow">PRODUCT DATABASE</div><h2 style="margin:4px 0 0">Merge products</h2></div><button value="cancel" class="icon-btn" aria-label="Close">×</button></div><p class="muted">${sourceId?'The incomplete imported product is already selected. Choose the correct existing catalogue product to keep.':'Choose the duplicate imported product first, then choose the correct existing product to keep.'}</p><label class="field"><span>Duplicate product to remove</span><select id="mergeSourceNative" class="input"><option value="">Select duplicate product</option>${optionsHtml}</select></label><label class="field"><span>Correct product to keep</span><select id="mergeTargetNative" class="input"><option value="">Select correct product</option>${optionsHtml}</select></label><div id="mergeNativePreview" class="card" style="margin-top:16px"><p class="muted">Select two different products.</p></div><button id="mergeNativeConfirm" type="button" class="primary-btn" disabled>Merge products</button></form>`;
    if(!dialog.open)dialog.showModal();
    const source=document.getElementById('mergeSourceNative');
    const target=document.getElementById('mergeTargetNative');
    const confirmButton=document.getElementById('mergeNativeConfirm');
    const preview=document.getElementById('mergeNativePreview');
    if(sourceId&&products.some(product=>String(product.id)===sourceId)){
      source.value=sourceId;
      source.disabled=true;
      source.style.opacity='.8';
    }
    const refresh=async()=>{
      const sourceProduct=products.find(product=>String(product.id)===String(source.value||sourceId));
      const targetProduct=products.find(product=>String(product.id)===String(target.value));
      if(!sourceProduct||!targetProduct||String(sourceProduct.id)===String(targetProduct.id)){confirmButton.disabled=true;preview.innerHTML='<p class="muted">Choose the correct existing product to keep.</p>';return}
      const orders=await getAll('orders');
      const affectedOrders=orders.filter(order=>(order.lines||[]).some(line=>String(line.productId)===String(sourceProduct.id))).length;
      preview.innerHTML=`<strong>${esc(sourceProduct.code)} · ${esc(sourceProduct.name)}</strong><p style="margin:8px 0">will be merged into</p><strong>${esc(targetProduct.code)} · ${esc(targetProduct.name)}</strong><p class="muted" style="margin-bottom:0">${affectedOrders} order${affectedOrders===1?'':'s'} currently use the duplicate. Existing aliases, stock, quotes and production links will be moved to the product you keep.</p>`;
      confirmButton.disabled=false;
    };
    source.onchange=refresh;target.onchange=refresh;
    confirmButton.onclick=()=>execute(source.value||sourceId,target.value,{returnToProducts:true});
    await refresh();
  }

  async function execute(sourceId,targetId,options={}){
    const [source,target,orders,quotes,jobs,balances,mappings]=await Promise.all([
      getOne('products',sourceId),getOne('products',targetId),getAll('orders'),getAll('quotes'),getAll('productionJobs'),getAll('inventoryBalances'),getAll('importMappings')
    ]);
    if(!source||!target||String(source.id)===String(target.id))return false;
    if(!confirm(`Merge ${source.code} into ${target.code}? The duplicate product will be removed after its references are transferred.`))return false;
    const now=new Date().toISOString();

    for(const order of orders){
      let changed=false;
      const lines=(order.lines||[]).map(line=>{
        if(String(line.productId)!==String(source.id))return line;
        changed=true;
        return {...line,sourceProductCode:line.sourceProductCode||source.code,sourceProductName:line.sourceProductName||source.name,productId:target.id,productCode:target.code,productName:target.name};
      });
      if(changed)await putOne('orders',{...order,lines,updatedAt:now});
    }

    for(const quote of quotes){
      let changed=false;
      const lines=(quote.lines||[]).map(line=>{
        if(String(line.productId)!==String(source.id))return line;
        changed=true;
        return {...line,productId:target.id,productCode:target.code,productName:target.name};
      });
      if(changed)await putOne('quotes',{...quote,lines,updatedAt:now});
    }

    for(const job of jobs){
      if(String(job.productId)===String(source.id))await putOne('productionJobs',{...job,productId:target.id,productCode:target.code,productName:target.name,updatedAt:now});
    }

    for(const balance of balances.filter(item=>String(item.productId)===String(source.id))){
      const colour=balance.colourName||balance.colorName||'Standard';
      const existing=balances.find(item=>String(item.productId)===String(target.id)&&(item.colourName||item.colorName||'Standard')===colour);
      const id=existing?.id||`${target.id}::${String(colour).toLowerCase()}`;
      await putOne('inventoryBalances',{...(existing||{}),id,productId:target.id,productCode:target.code,productName:target.name,colourName:colour,quantity:Number(existing?.quantity||0)+Number(balance.quantity||0),updatedAt:now});
      await deleteOne('inventoryBalances',balance.id);
    }

    const aliases=[...(target.aliases||[]),...(source.aliases||[]),source.code,source.name].map(value=>String(value||'').trim()).filter(Boolean);
    await putOne('products',{...target,aliases:[...new Set(aliases)],updatedAt:now});
    for(const alias of [source.code,source.name,...(source.aliases||[])].filter(Boolean)){
      await putOne('importMappings',{id:`product:${norm(alias)}`,type:'product',source:alias,targetId:target.id,targetLabel:`${target.code} · ${target.name}`,updatedAt:now});
    }
    for(const mapping of mappings.filter(item=>item.type==='product'&&String(item.targetId)===String(source.id))){
      await putOne('importMappings',{...mapping,targetId:target.id,targetLabel:`${target.code} · ${target.name}`,updatedAt:now});
    }

    await deleteOne('products',source.id);
    close();
    alert(`Merged ${source.code} into ${target.code}. Orders, quotes, stock and production records now use ${target.code}.`);
    if(options?.returnToProducts!==false){
      if(typeof window.navigate==='function')await window.navigate('products');
      else location.reload();
    }
    return true;
  }

  window.openNativeProductMerge=openMerge;
  window.VUNativeProductMerge={open:openMerge,execute};
  const bind=()=>{if(button())button().onclick=()=>openMerge()};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
