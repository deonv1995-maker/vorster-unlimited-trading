/* V9.0.36 — safely archive once-off job-card products from the catalogue.
   Keeps order/job-card references intact while excluding the record from active catalogue workflows. */
(function(){
'use strict';

const baseShowProductForm=window.showProductForm||showProductForm;
window.showProductForm=async function showProductFormWithJobCardOnlyAction(id='',context={}){
  await baseShowProductForm(id,context);
  if(!id||!context?.productSetupQueue)return;
  const form=document.getElementById('productForm');
  if(!form||form.querySelector('[data-job-card-only-action]'))return;
  const product=await getOne('products',id);
  if(!product)return;

  const block=document.createElement('div');
  block.dataset.jobCardOnlyAction='1';
  block.style.margin='12px 0';
  block.style.padding='12px';
  block.style.border='1px solid var(--border)';
  block.style.borderRadius='14px';
  block.style.background='var(--surface-2)';
  block.innerHTML=`
    <strong style="display:block;margin-bottom:4px">Once-off / job-card-only item?</strong>
    <small style="display:block;color:var(--muted);margin-bottom:10px">Use this when the item came from a once-off job card and should not be maintained as a normal catalogue product.</small>
    <button type="button" class="ghost" id="markJobCardOnlyProduct">Not a catalogue product</button>`;

  const submit=form.querySelector('button[type="submit"]');
  if(submit)form.insertBefore(block,submit);else form.appendChild(block);

  document.getElementById('markJobCardOnlyProduct').onclick=async()=>{
    const ok=confirm(`Archive ${product.code||product.name||'this item'} from the catalogue?\n\nThe original job-card/order information will be kept.`);
    if(!ok)return;
    const now=new Date().toISOString();
    await putOne('products',{
      ...product,
      isActive:false,
      catalogueStatus:'job-card-only',
      jobCardOnly:true,
      archivedReason:'Once-off item imported from job card',
      archivedAt:now,
      updatedAt:now
    });
    const dialog=document.getElementById('dialog');
    if(dialog)delete dialog.dataset.productSetupLocked;
    closeDialog();
    notify('Removed from catalogue · job-card data kept');
    if(typeof productsPage==='function')await productsPage();
  };
};
try{showProductForm=window.showProductForm}catch{}
})();
