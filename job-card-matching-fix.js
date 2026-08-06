window.linkImportedCustomer=async function(importedId,targetId){
  const [imported,target,orders]=await Promise.all([getOne("customers",importedId),getOne("customers",targetId),getAll("orders")]);
  if(!imported||!target)return notify("Customer link could not be completed");
  const now=new Date().toISOString();
  let changedOrders=0;
  for(const order of orders){
    if(order.customerId!==importedId)continue;
    await putOne("orders",{...order,customerId:target.id,customerName:target.name,updatedAt:now});
    changedOrders++;
  }
  const source=imported.accountCode||imported.name;
  await saveImportMapping("customer",source,target.id,target.name);
  await deleteOne("customers",imported.id);
  closeDialog();
  notify(`Customer linked in ${changedOrders} order${changedOrders===1?"":"s"}`);
  openImportMatching();
};

async function ensureImportMatchingEntry(){
  if(typeof openImportMatching!=="function"||!main||!pageTitle)return;
  const title=pageTitle.textContent||"";
  if(!["Settings","Orders"].includes(title))return;
  if(document.getElementById("permanentImportMatchingEntry"))return;

  let unmatchedCount=0;
  try{
    const [products,customers]=await Promise.all([importedProductCandidates(),importedCustomerCandidates()]);
    unmatchedCount=products.length+customers.length;
  }catch(error){
    console.warn("Could not count unmatched imports",error);
  }

  const panel=document.createElement("section");
  panel.id="permanentImportMatchingEntry";
  panel.className="card import-matching-panel";
  panel.style.margin="12px 0";
  panel.innerHTML=`
    <div class="section-head">
      <div><h2>Match imported records</h2><p class="muted">Link job-card products and customers to records already in the app.</p></div>
      <span class="badge">${unmatchedCount}</span>
    </div>
    <div class="actions"><button id="permanentImportMatchingButton" class="primary" type="button">Open matching</button></div>`;
  main.prepend(panel);
  document.getElementById("permanentImportMatchingButton").onclick=()=>openImportMatching();
}

const matchingEntryObserver=new MutationObserver(()=>{
  clearTimeout(window.__matchingEntryTimer);
  window.__matchingEntryTimer=setTimeout(ensureImportMatchingEntry,60);
});
matchingEntryObserver.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("load",()=>setTimeout(ensureImportMatchingEntry,250));
setTimeout(ensureImportMatchingEntry,250);
