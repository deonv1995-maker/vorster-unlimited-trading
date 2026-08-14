/* Factory OS 2.6.1 — order-to-production demand engine with upstream component dependencies. */
(function(){
'use strict';
if(window.VUFactoryDemand)return;
const CLOSED=new Set(['cancelled','completed','delivered','collected','invoiced']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const code=v=>String(v||'').trim().toUpperCase();
const colourOf=l=>l?.colour?.name||l?.colourName||'Standard';
function divisionOf(p){if(!p||p.catalogueStatus==='setup-required'||p.importedJobCardOnly===true)return'Unclassified';return String(p?.worksheetDivision||p?.primaryDivision||'Unclassified').trim()||'Unclassified'}
const componentsOf=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(x=>{const [componentCode,qty]=x.split(':').map(v=>String(v||'').trim());return componentCode?{code:code(componentCode),qty:Math.max(0,n(qty||1))}:null}).filter(x=>x&&x.qty>0);
function outstandingQty(line){return Math.max(0,n(line.qty)-n(line.deliveredQty||line.dispatchedQty||0));}
function balanceMap(rows){const m=new Map();for(const b of rows||[]){if(!b?.productId)continue;m.set(b.productId,n(m.get(b.productId))+n(b.quantity));}return m;}
function dueSort(a,b){return String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31'))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));}
async function build(){
 const [products,orders,balances]=await Promise.all([getAll('products'),getAll('orders'),getAll('inventoryBalances')]);
 const productById=new Map(products.map(p=>[p.id,p])),productByCode=new Map(products.map(p=>[code(p.code),p]));
 const stock=balanceMap(balances),warnings=[],divisions={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]},componentDemand=[];
 const active=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>outstandingQty(l)>0)).sort(dueSort);
 function allocateComponents(parent,parentShortage,context,stack){
  if(parentShortage<=0)return;
  for(const c of componentsOf(parent)){
   const cp=productByCode.get(c.code),required=n(parentShortage*c.qty),parentCode=code(parent.code);
   if(!cp){warnings.push(`${parent.code||parent.name} requires component ${c.code}, but that component code is not matched to a product.`);componentDemand.push({parentProductId:parent.id,parentProductCode:parent.code,parentProductName:parent.name,componentProductId:null,componentCode:c.code,componentName:c.code,qtyPerUnit:c.qty,requiredQty:required,stockAllocated:0,toMake:required,sourceDivision:'Unclassified',parentDivision:divisionOf(parent),...context});continue;}
   const cpCode=code(cp.code);
   if(stack.includes(cpCode)){warnings.push(`Component cycle detected: ${[...stack,cpCode].join(' → ')}. No recursive demand was created for that cycle.`);continue;}
   const available=n(stock.get(cp.id)),used=Math.min(available,required),toMake=Math.max(0,required-used);stock.set(cp.id,Math.max(0,available-used));
   const componentDivision=divisionOf(cp),dep={parentProductId:parent.id,parentProductCode:parent.code,parentProductName:parent.name,componentProductId:cp.id,componentCode:cp.code,componentName:cp.name,qtyPerUnit:c.qty,requiredQty:required,stockAllocated:used,toMake,sourceDivision:componentDivision,parentDivision:divisionOf(parent),...context};componentDemand.push(dep);
   if(toMake>0){const row={orderId:context.orderId,orderNumber:context.orderNumber,customerId:context.customerId,customerName:context.customerName,productId:cp.id,productCode:cp.code,productName:cp.name,colour:'Raw component',dueDate:context.dueDate||null,fulfilmentType:context.fulfilmentType||'Delivery',orderedQty:required,stockAllocated:used,toMake,unitPrice:0,remainingValue:0,isComponentDemand:true,parentProductId:parent.id,parentProductCode:parent.code,parentProductName:parent.name,qtyPerParent:c.qty};(divisions[componentDivision]||divisions.Unclassified).push(row);allocateComponents(cp,toMake,context,[...stack,cpCode]);}
  }
 }
 for(const order of active){
  for(const line of order.lines||[]){
   const required=outstandingQty(line);if(!required)continue;
   const product=productById.get(line.productId)||productByCode.get(code(line.productCode))||null;
   if(!product){warnings.push(`${order.orderNumber||'Order'} · ${line.productCode||line.productName||'Unknown product'} is not matched to a product.`);continue;}
   const available=n(stock.get(product.id)),used=Math.min(available,required),toMake=Math.max(0,required-used);stock.set(product.id,Math.max(0,available-used));
   const division=divisionOf(product),context={orderId:order.id,orderNumber:order.orderNumber,customerId:order.customerId,customerName:order.customerName,dueDate:order.dueDate||null,fulfilmentType:order.fulfilmentType||order.preference||'Delivery'};
   const base={...context,productId:product.id,productCode:product.code,productName:product.name,colour:colourOf(line),orderedQty:required,stockAllocated:used,toMake,unitPrice:n(line.unitPrice),remainingValue:required*n(line.unitPrice)};
   if(toMake>0)(divisions[division]||divisions.Unclassified).push(base);
   if(division==='Painting'||String(product.inventoryStage||'').toLowerCase().includes('finished'))divisions.Painting.push({...base,toMake:required,stockAllocated:0,paintInstruction:true});
   if(toMake>0)allocateComponents(product,toMake,context,[code(product.code)]);
  }
 }
 for(const d of Object.keys(divisions))divisions[d].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||String(a.orderNumber||'').localeCompare(String(b.orderNumber||''))||Number(b.isComponentDemand)-Number(a.isComponentDemand));
 return{generatedAt:new Date().toISOString(),activeOrders:active.length,divisions,componentDemand,warnings:[...new Set(warnings)],remainingStock:stock};
}
window.VUFactoryDemand={version:'2.6.1',build,outstandingQty,divisionOf,componentsOf};
})();