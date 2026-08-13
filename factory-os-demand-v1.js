/* Factory OS v1 — order-to-production demand engine. */
(function(){
'use strict';
if(window.VUFactoryDemand)return;
const CLOSED=new Set(['cancelled','completed','delivered','collected','invoiced']);
const n=v=>Math.max(0,Number(v||0));
const norm=v=>String(v||'').trim().toLowerCase();
const colourOf=l=>l?.colour?.name||l?.colourName||'Standard';
const divisionOf=p=>String(p?.worksheetDivision||p?.primaryDivision||'Unclassified').trim()||'Unclassified';
const componentsOf=p=>String(p?.manufacturingComponentsSpec||'').split(/\n|,/).map(x=>{const [code,qty]=x.split(':').map(v=>String(v||'').trim());return code?{code,qty:Math.max(0,n(qty||1))}:null}).filter(Boolean);
function outstandingQty(line){return Math.max(0,n(line.qty)-n(line.deliveredQty||line.dispatchedQty||0));}
function balanceMap(rows){const m=new Map();for(const b of rows||[]){if(!b?.productId)continue;m.set(b.productId,n(m.get(b.productId))+n(b.quantity));}return m;}
function dueSort(a,b){return String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31'))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));}
async function build(){
 const [products,orders,balances]=await Promise.all([getAll('products'),getAll('orders'),getAll('inventoryBalances')]);
 const productById=new Map(products.map(p=>[p.id,p])),productByCode=new Map(products.map(p=>[String(p.code||'').toUpperCase(),p]));
 const stock=balanceMap(balances),warnings=[],divisions={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]},componentDemand=[];
 const active=orders.filter(o=>!CLOSED.has(norm(o.status))&&(o.lines||[]).some(l=>outstandingQty(l)>0)).sort(dueSort);
 for(const order of active){
  for(const line of order.lines||[]){
   const required=outstandingQty(line);if(!required)continue;
   const product=productById.get(line.productId)||productByCode.get(String(line.productCode||'').toUpperCase())||null;
   if(!product){warnings.push(`${order.orderNumber||'Order'} · ${line.productCode||line.productName||'Unknown product'} is not matched to a product.`);continue;}
   const available=n(stock.get(product.id)),used=Math.min(available,required),toMake=Math.max(0,required-used);stock.set(product.id,Math.max(0,available-used));
   const division=divisionOf(product);
   const base={orderId:order.id,orderNumber:order.orderNumber,customerId:order.customerId,customerName:order.customerName,productId:product.id,productCode:product.code,productName:product.name,colour:colourOf(line),dueDate:order.dueDate||null,fulfilmentType:order.fulfilmentType||order.preference||'Delivery',orderedQty:required,stockAllocated:used,toMake,unitPrice:n(line.unitPrice),remainingValue:required*n(line.unitPrice)};
   if(toMake>0)(divisions[division]||divisions.Unclassified).push(base);
   if(division==='Painting'||String(product.inventoryStage||'').toLowerCase().includes('finished'))divisions.Painting.push({...base,toMake:required,stockAllocated:0,paintInstruction:true});
   if(toMake>0){for(const c of componentsOf(product)){const cp=productByCode.get(String(c.code).toUpperCase());componentDemand.push({parentProductId:product.id,parentProductCode:product.code,parentProductName:product.name,componentProductId:cp?.id||null,componentCode:c.code,componentName:cp?.name||c.code,qtyPerUnit:c.qty,requiredQty:toMake*c.qty,sourceDivision:division,orderId:order.id,orderNumber:order.orderNumber,customerName:order.customerName,dueDate:order.dueDate||null});if(!cp)warnings.push(`${product.code||product.name} requires component ${c.code}, but that component code is not matched to a product.`)}}
  }
 }
 for(const d of Object.keys(divisions))divisions[d].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||String(a.orderNumber||'').localeCompare(String(b.orderNumber||'')));
 return{generatedAt:new Date().toISOString(),activeOrders:active.length,divisions,componentDemand,warnings:[...new Set(warnings)],remainingStock:stock};
}
window.VUFactoryDemand={version:'1.0.0',build,outstandingQty,divisionOf,componentsOf};
})();