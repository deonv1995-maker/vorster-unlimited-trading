/* V8.9.1 — matching behaviour fixes only.
   The matching entry is rendered by job-card-matching.js; do not inject a second panel.
*/
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
