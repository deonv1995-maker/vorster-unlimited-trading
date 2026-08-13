/* Factory OS finishing module */
(function(){
'use strict';
if(window.VUFactoryFinishing)return;
const RAW='Raw';
const balanceId=(productId,colour)=>`${productId}::${String(colour||'Standard').trim().toLowerCase()}`;
async function balance(productId,colour){const row=await getOne('inventoryBalances',balanceId(productId,colour));return Number(row?.quantity||0)}
window.VUFactoryFinishing={version:'2.2.0',RAW,balanceId,balance};
})();
