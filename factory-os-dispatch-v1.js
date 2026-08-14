/* Factory OS 2.4.6 — delivery and collection readiness with canonical code+colour stock matching. */
(function(){'use strict';if(window.VUFactoryDispatch)return;
const CLOSED=new Set(['cancelled','completed','delivered','collected','invoiced']);
const n=v=>Math.max(0,Number(v||0)),norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' '),code=v=>String(v||'').trim().toUpperCase();
const COLOUR_ALIASES=Object.freeze({
 'DB':'Dry brush',
 'DRY BRUSH':'Dry brush',
 'G/DB':'Grey dry brush',
 'GDB':'Grey dry brush',
 'GREY DRY BRUSH':'Grey dry brush',
 'GRAY DRY BRUSH':'Grey dry brush',
 'R/C/DB':'Rust cream dry brush',
 'RCDB':'Rust cream dry brush',
 'RUST CREAM DRY BRUSH':'Rust cream dry brush',
 'STANDARD':'Standard',
 '0125':'Mixed colours',
 'MIXED COLOURS':'Mixed colours',
 'MIXED COLORS':'Mixed colours',
 'C10':'Silver wing',
 'SILVER WING':'Silver wing',
 'RUST':'Rust',
 'R/DB':'Rust dry brush',
 'RDB':'Rust dry brush',
 'RUST DRY BRUSH':'Rust dry brush',
 'CHAR':'Charkha wash',
 'CHARKHA WASH':'Charkha wash',
 'CHARKA WASH':'Charkha wash',
 'CHARKA WASHED':'Charkha wash'
});
const colourToken=v=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
const canonicalColour=v=>{const raw=String(v??'Standard').trim()||'Standard',token=colourToken(raw);return COLOUR_ALIASES[token]||raw.replace(/\s+/g,' ')};
const stockKey=(productCode,colour)=>`${code(productCode)}::${norm(canonicalColour(colour))}`;
const colourOf=line=>canonicalColour(line?.colour?.name||line?.colourName||'Standard');
const modeOf=order=>/collect/i.test(String(order.fulfilmentType||order.preference||''))?'Collection':'Delivery';
function unitPriceOf(line,product){for(const value of [line?.unitPrice,line?.price,line?.sellingPrice,line?.unitSellingPrice,product?.price]){const x=n(value);if(x>0)return x}return 0}
async function build(){const [products,orders,balances,cfg]=await Promise.all([getAll('products'),getAll('orders'),getAll('inventoryBalances'),VUFactoryOS.settings()]);const byId=new Map(products.map(p=>[String(p.id),p])),byCode=new Map(products.map(p=>[code(p.code),p]));const stock=new Map();for(const b of balances){const product=byId.get(String(b.productId))||byCode.get(code(b.productCode));const productCode=code(b.productCode||product?.code);if(!productCode)continue;const k=stockKey(productCode,b.colourName);stock.set(k,n(stock.get(k))+n(b.quantity))}const active=orders.filter(o=>!CLOSED.has(norm(o.status))).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))),result=[];for(const order of active){const lines=[];let remainingValue=0,readyValue=0,totalRemaining=0,totalReady=0,missingPriceLines=0;for(const line of order.lines||[]){const required=VUFactoryOS.lineRequired(line);if(!required)continue;const lineCode=code(line.productCode);const product=(lineCode&&byCode.get(lineCode))||byId.get(String(line.productId));if(!product&&!lineCode)continue;const canonicalCode=code(lineCode||product?.code);if(!canonicalCode)continue;const colour=colourOf(line),k=stockKey(canonicalCode,colour),available=n(stock.get(k)),ready=Math.min(required,available),unitPrice=unitPriceOf(line,product);stock.set(k,available-ready);totalRemaining+=required;totalReady+=ready;remainingValue+=required*unitPrice;readyValue+=ready*unitPrice;if(ready>0&&unitPrice<=0)missingPriceLines++;lines.push({productId:product?.id||line.productId||null,productCode:canonicalCode,productName:product?.name||line.productName||canonicalCode,colour,required,ready,waiting:required-ready,unitPrice,readyValue:ready*unitPrice,priceAvailable:unitPrice>0})}if(lines.length)result.push({orderId:order.id,orderNumber:order.orderNumber,customerId:order.customerId,customerName:order.customerName,mode:modeOf(order),dueDate:order.dueDate||null,location:order.deliveryAddress||order.address||order.customerAddress||'',remainingValue,readyValue,totalRemaining,totalReady,missingPriceLines,complete:totalReady>=totalRemaining&&totalRemaining>0,partial:totalReady>0&&totalReady<totalRemaining,lines})}return{settings:cfg,orders:result,deliveries:result.filter(x=>x.mode==='Delivery'),collections:result.filter(x=>x.mode==='Collection')}}
function health(value,cfg){return VUFactoryOS.dispatchHealth(value,cfg)}
window.VUFactoryDispatch={version:'2.4.6',build,health,modeOf,stockKey,unitPriceOf,canonicalColour};
})();