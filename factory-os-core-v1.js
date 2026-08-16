/* Factory OS v1 — stable domain core. Keeps existing IndexedDB data intact. */
(function(){
'use strict';
if(window.VUFactoryOS)return;

const ROLES=Object.freeze({MANAGEMENT:'Management',OFFICE:'Office',CASTING:'Casting',PACKING:'Packing',RESIN:'Resin',PAINTING:'Painting',DELIVERY:'Delivery'});
const ROLE_KEY='vu-factory-os-role';
const DEFAULTS=Object.freeze({vehicleCount:2,vehiclePlanningLow:15000,vehiclePlanningHigh:30000,dailyDispatchMinimum:21000,dailyProfitTarget:31000,allowPartialDispatch:true});
const money=n=>Number(n||0);
const actualRole=()=>window.VUSharedAccess?.currentRole?.()||localStorage.getItem(ROLE_KEY)||ROLES.MANAGEMENT;
const role=()=>window.VUManagementPreview?.role?.()||actualRole();
const setRole=value=>{if(!Object.values(ROLES).includes(value))throw new Error('Unknown Factory OS role');if(window.VUSharedAccess?.membership?.())throw new Error('This device role is controlled by Shared Access Management.');localStorage.setItem(ROLE_KEY,value)};
const settings=async()=>{const row=await getOne('settings','factory-os-operating');return{...DEFAULTS,...(row||{})}};
const saveSettings=async patch=>putOne('settings',{id:'factory-os-operating',...(await settings()),...patch,updatedAt:new Date().toISOString()});
const openOrders=orders=>(orders||[]).filter(o=>!['Cancelled','Completed'].includes(o.status));
const lineDelivered=l=>money(l.deliveredQty||l.dispatchedQty||0);
const lineRequired=l=>Math.max(0,money(l.qty)-lineDelivered(l));
const lineValue=l=>lineRequired(l)*money(l.unitPrice);
const orderRemainingValue=o=>(o.lines||[]).reduce((s,l)=>s+lineValue(l),0);
const divisionOf=p=>String(p?.worksheetDivision||p?.primaryDivision||'Unclassified').trim();

async function snapshot(){
 const [products,customers,orders,balances,transactions,productionJobs,deliveries,cfg]=await Promise.all([
  getAll('products'),getAll('customers'),getAll('orders'),getAll('inventoryBalances'),getAll('inventoryTransactions'),getAll('productionJobs'),getAll('deliveries'),settings()
 ]);
 const active=openOrders(orders);
 return{products,customers,orders,activeOrders:active,inventoryBalances:balances,inventoryTransactions:transactions,productionJobs,deliveries,settings:cfg,
  outstandingOrderValue:active.reduce((s,o)=>s+orderRemainingValue(o),0)};
}

function requirements(snapshotData){
 const productMap=new Map(snapshotData.products.map(p=>[p.id,p]));
 const out={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]};
 for(const order of snapshotData.activeOrders){for(const line of order.lines||[]){const remaining=lineRequired(line);if(!remaining)continue;const product=productMap.get(line.productId)||{};const division=divisionOf(product);const row={orderId:order.id,orderNumber:order.orderNumber,customerId:order.customerId,customerName:order.customerName,productId:line.productId,productCode:line.productCode,productName:line.productName,qtyRequired:remaining,colour:line?.colour?.name||'Standard',dueDate:order.dueDate||null,fulfilmentType:order.fulfilmentType||order.preference||'Delivery',unitPrice:money(line.unitPrice),remainingValue:remaining*money(line.unitPrice)};(out[division]||out.Unclassified).push(row)}}
 return out;
}

function dispatchHealth(plannedValue,cfg=DEFAULTS){const value=money(plannedValue);return{value,belowMinimum:value<cfg.dailyDispatchMinimum,belowProfitTarget:value<cfg.dailyProfitTarget,minimumGap:Math.max(0,cfg.dailyDispatchMinimum-value),profitTargetGap:Math.max(0,cfg.dailyProfitTarget-value)}};

window.VUFactoryOS={version:'1.2.0',ROLES,DEFAULTS,role,actualRole,setRole,settings,saveSettings,snapshot,requirements,dispatchHealth,orderRemainingValue,lineRequired};
})();