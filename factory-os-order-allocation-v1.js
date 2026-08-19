/* Factory OS 2.9.0 — per-order raw stock nomination authority. */
(function(){'use strict';if(window.VUFactoryOrderAllocation)return;
const n=v=>Math.max(0,Math.round(Number(v||0)));
function ordered(line){return n(line?.qty||line?.quantity||line?.orderedQty)}
function dispatched(line){return n(line?.deliveredQty||line?.dispatchedQty)}
function required(line){return Math.max(0,ordered(line)-dispatched(line))}
function allocated(line){return Math.min(required(line),n(line?.rawStockAllocated))}
function shortage(line){return Math.max(0,required(line)-allocated(line))}
async function set(orderId,lineIndex,value){const order=await getOne('orders',orderId);if(!order)throw new Error('Order not found.');const lines=[...(order.lines||[])],i=Number(lineIndex),line=lines[i];if(!line)throw new Error('Order line not found.');lines[i]={...line,rawStockAllocated:Math.min(required(line),n(value)),rawStockAllocatedAt:new Date().toISOString()};await putOne('orders',{...order,lines,updatedAt:new Date().toISOString()});return lines[i]}
async function change(orderId,lineIndex,delta){const order=await getOne('orders',orderId);if(!order)throw new Error('Order not found.');const line=(order.lines||[])[Number(lineIndex)];if(!line)throw new Error('Order line not found.');return set(orderId,lineIndex,allocated(line)+Number(delta||0))}
window.VUFactoryOrderAllocation={version:'2.9.0',ordered,dispatched,required,allocated,shortage,set,change};})();