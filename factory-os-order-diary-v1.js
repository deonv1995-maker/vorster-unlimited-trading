/* Factory OS 2.9.1 — Order-only planning diary. The order is the working record; no stock ledger is used here. */
(function(){
'use strict';
if(window.VUOrderDiary)return;

const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Math.max(0,Number(v||0));
const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(Number(v||0));
const now=()=>new Date().toISOString();
const code=v=>String(v??'').trim().toUpperCase();

/*
  This small seed list is the bridge between Deon's planning conversations and the app.
  New customer/order details can be added here without disturbing nomination progress already
  recorded in IndexedDB. seedKnownOrders() only fills known order facts and preserves live fields.
*/
const KNOWN_ORDERS=[{
  id:'planning-qu125071',
  orderNumber:'QU125071',
  customerName:'GARDEN FACTORY / PRO PLANT',
  customerCode:'GF024',
  source:'planning-diary',
  status:'In progress',
  orderDate:'2026-08-13',
  dueDate:'2026-08-20',
  fulfilmentType:'Collection',
  preference:'Collection',
  planningNote:'Committed for Thursday morning collection. Use nominated quantity only to show how many ordered items are put aside/selected for this order.',
  orderTotalInclVat:11160.06,
  orderTotalExVat:9704.39,
  lines:[
    {productCode:'FISH001',productName:'FISH MINI',quantity:6,unitPrice:20.09,colourName:'Mixed colours'},
    {productCode:'FISH004',productName:'FISH LARGE',quantity:6,unitPrice:40.17,colourName:'Mixed colours'},
    {productCode:'FISH002',productName:'FISH SMALL',quantity:6,unitPrice:26.79,colourName:'Mixed colours'},
    {productCode:'FISH005',productName:'CLOWN FISH',quantity:6,unitPrice:18.15,colourName:'Mixed colours'},
    {productCode:'FISH006',productName:'PUFFER FISH',quantity:6,unitPrice:26.79,colourName:'Mixed colours'},
    {productCode:'FISH008',productName:'STAR FISH',quantity:6,unitPrice:40.17,colourName:'Mixed colours'},
    {productCode:'FISH003',productName:'FISH MEDIUM',quantity:6,unitPrice:33.47,colourName:'Mixed colours'},
    {productCode:'TW001',productName:'tuin wagen',quantity:1,unitPrice:531.39,colourName:'Mixed colours'},
    {productCode:'TM001',productName:'tuin mini',quantity:1,unitPrice:394.24,colourName:'Mixed colours'},
    {productCode:'TK001',productName:'tuin kewer',quantity:2,unitPrice:520.82,colourName:'Mixed colours'},
    {productCode:'TK02',productName:'tuin kewer convertable',quantity:2,unitPrice:520.82,colourName:'Mixed colours'},
    {productCode:'TK001/S',productName:'tuin kewer small',quantity:3,unitPrice:115.75,colourName:'Mixed colours'},
    {productCode:'TK02/S',productName:'tuin kewer convertable small',quantity:3,unitPrice:127.33,colourName:'Mixed colours'},
    {productCode:'TW001/S',productName:'tuin wagen small',quantity:3,unitPrice:127.33,colourName:'Mixed colours'},
    {productCode:'PSD002',productName:'cup and saucer small',quantity:2,unitPrice:21.98,colourName:'Dry brush'},
    {productCode:'PSD003',productName:'cup and saucer large',quantity:2,unitPrice:31.25,colourName:'Dry brush'},
    {productCode:'WFCUPS',productName:'CUP & SAUCER WF SMALL',quantity:1,unitPrice:269.70,colourName:'Dry brush'},
    {productCode:'WFCUPL',productName:'cup and saucer water feature large',quantity:1,unitPrice:291.68,colourName:'Dry brush'},
    {productCode:'FISHS',productName:'FISH SMALL',quantity:6,unitPrice:121.97,colourName:'Dry brush'},
    {productCode:'FISHL',productName:'FISH LARGE',quantity:6,unitPrice:245.21,colourName:'Dry brush'},
    {productCode:'RPF001',productName:'DIVING LADY',quantity:6,unitPrice:72.60,colourName:'Dry brush'},
    {productCode:'MC001',productName:'MINI CAR 001',quantity:2,unitPrice:33.47,colourName:'Dry brush'},
    {productCode:'MC002',productName:'MINI CAR 002',quantity:2,unitPrice:33.47,colourName:'Dry brush'},
    {productCode:'MC003',productName:'MINI CAR 003',quantity:2,unitPrice:33.47,colourName:'Dry brush'},
    {productCode:'MC004',productName:'MINI CAR 004',quantity:2,unitPrice:33.47,colourName:'Dry brush'},
    {productCode:'MC005',productName:'MINI CAR 005',quantity:2,unitPrice:33.47,colourName:'Dry brush'},
    {productCode:'WORMSET',productName:'SET OF WORMS : 7 IN A SET',quantity:2,unitPrice:113.81,colourName:'Dry brush'},
    {productCode:'HFPL',productName:'HEART FANCY PLAIN LARGE',quantity:3,unitPrice:17.35,colourName:'Dry brush'},
    {productCode:'HFP',productName:'HEART FANCY PLAIN',quantity:3,unitPrice:12.36,colourName:'Dry brush'},
    {productCode:'SCP009',productName:'SUITCASE POT 430 X 450 X 220 HAT BOX',quantity:1,unitPrice:122.51,colourName:'Cream'},
    {productCode:'SCP005',productName:'MEDIUM 330 X 510 X 185 FLAT SUITCASE',quantity:1,unitPrice:118.03,colourName:'Cream'},
    {productCode:'SCP004',productName:'SMALL FLAT 410 X 270 X 160 SUITCASE POT',quantity:1,unitPrice:92.79,colourName:'Terracotta'},
    {productCode:'SCP003',productName:'suitcase pot school bag',quantity:1,unitPrice:59.17,colourName:'Terracotta'}
  ]
}];

function orderedQty(line){return n(line?.quantity||line?.qty||line?.orderedQty)}
function nominatedQty(line){return Math.min(orderedQty(line),n(line?.nominatedQty))}
function shortQty(line){return Math.max(0,orderedQty(line)-nominatedQty(line))}
function stats(order){
 let ordered=0,nominated=0,short=0;
 for(const line of order.lines||[]){const q=orderedQty(line),a=nominatedQty(line);ordered+=q;nominated+=a;short+=Math.max(0,q-a)}
 return{ordered,nominated,short,complete:ordered>0&&short===0,percent:ordered?Math.round((nominated/ordered)*100):0};
}

function mergeSeed(existing,seed){
 const byCode=new Map((existing?.lines||[]).map(l=>[code(l.productCode||l.code),l]));
 const lines=(seed.lines||[]).map(s=>{const old=byCode.get(code(s.productCode));return{...s,...(old||{}),productCode:s.productCode,productName:s.productName,quantity:s.quantity,unitPrice:s.unitPrice,colourName:s.colourName,nominatedQty:Math.min(n(s.quantity),n(old?.nominatedQty))}});
 return{...(existing||{}),...seed,id:existing?.id||seed.id,lines,createdAt:existing?.createdAt||now(),updatedAt:existing?.updatedAt||now()};
}

async function seedKnownOrders(){
 for(const seed of KNOWN_ORDERS){
  const all=await getAll('orders');
  const existing=all.find(o=>String(o.orderNumber||'').toUpperCase()===String(seed.orderNumber||'').toUpperCase());
  if(!existing){await putOne('orders',mergeSeed(null,seed));continue}
  if(String(existing.source||'').toLowerCase().includes('planning-diary')){
   const merged=mergeSeed(existing,seed);
   await putOne('orders',merged);
  }
 }
}

function lineMarkup(line,index,orderId){
 const q=orderedQty(line),a=nominatedQty(line),short=shortQty(line);
 return `<div class="vu-nom-line${short===0?' is-complete':''}">
  <div class="vu-nom-main"><strong>${safe(line.productCode||line.code||'—')} · ${safe(line.productName||line.description||'Product')}</strong><small>${safe(line.colourName||line.colour||'Standard')} · Ordered ${q}${short===0?' · Complete':` · ${short} short`}</small></div>
  <div class="vu-stepper" aria-label="Nominated quantity"><button type="button" data-nom-change="-1" data-order-id="${safe(orderId)}" data-line-index="${index}" ${a<=0?'disabled':''}>−</button><strong>${a}</strong><button type="button" data-nom-change="1" data-order-id="${safe(orderId)}" data-line-index="${index}" ${a>=q?'disabled':''}>+</button></div>
 </div>`;
}

async function changeNomination(orderId,lineIndex,delta){
 const order=await getOne('orders',orderId);if(!order)return;
 const lines=[...(order.lines||[])],i=Number(lineIndex),line={...(lines[i]||{})};if(!lines[i])return;
 const q=orderedQty(line);line.nominatedQty=Math.max(0,Math.min(q,nominatedQty(line)+Number(delta||0)));lines[i]=line;
 const s=stats({...order,lines});
 const status=s.complete?'Ready':(s.nominated>0?'In progress':(order.status||'In progress'));
 await putOne('orders',{...order,lines,status,updatedAt:now()});
 await openOrder(orderId);
}

async function openOrder(orderId){
 const order=await getOne('orders',orderId);if(!order)return;
 const s=stats(order);
 pageTitle.textContent='Order';
 backBtn.classList.remove('hidden');
 backBtn.onclick=()=>open();
 main.innerHTML=`<section class="vu-order-diary">
  <div class="card vu-order-hero"><div><div class="eyebrow">ORDER PLANNING</div><h2>${safe(order.customerName||'Customer')}</h2><p>${safe(order.orderNumber||'Order details pending')} · ${safe(order.fulfilmentType||order.preference||'Not scheduled')}</p></div><div class="vu-progress-ring"><strong>${s.percent}%</strong><small>nominated</small></div></div>
  <div class="vu-order-kpis"><div><small>Ordered</small><strong>${s.ordered}</strong></div><div><small>Nominated</small><strong>${s.nominated}</strong></div><div><small>Short</small><strong>${s.short}</strong></div><div><small>Order value</small><strong>${order.orderTotalInclVat?money(order.orderTotalInclVat):'—'}</strong></div></div>
  ${order.planningNote?`<div class="card vu-order-note"><strong>Planning note</strong><p>${safe(order.planningNote)}</p></div>`:''}
  <div class="card"><div class="section-head"><div><h3>Order items</h3><p class="muted">Use − / + only to record how many items have been nominated or put aside for this order.</p></div></div><div class="vu-nom-lines">${(order.lines||[]).map((l,i)=>lineMarkup(l,i,order.id)).join('')||'<div class="empty">Order details have not been supplied yet.</div>'}</div></div>
 </section>`;
 bindNominationButtons();
}

function bindNominationButtons(){document.querySelectorAll('[data-nom-change]').forEach(b=>b.onclick=()=>changeNomination(b.dataset.orderId,b.dataset.lineIndex,b.dataset.nomChange).catch(err=>alert(err?.message||String(err))))}

async function open(){
 await seedKnownOrders();
 const orders=(await getAll('orders')).filter(o=>String(o.source||'').toLowerCase().includes('planning-diary')).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
 pageTitle.textContent='Orders';backBtn.classList.remove('hidden');backBtn.onclick=()=>navigate('dashboard');
 main.innerHTML=`<section class="vu-order-diary"><div class="card"><div class="section-head"><div><div class="eyebrow">PLANNING DATABASE</div><h2>Orders</h2><p class="muted">Customer orders we are actively tracking together. No stock system is used here.</p></div><span class="badge">${orders.length}</span></div></div><div class="vu-order-list">${orders.map(o=>{const s=stats(o);return`<button class="card vu-order-card" type="button" data-diary-order="${safe(o.id)}"><div><strong>${safe(o.customerName||'Customer')}</strong><small>${safe(o.orderNumber||'Order details pending')} · ${safe(o.fulfilmentType||o.preference||'Plan not set')}</small></div><div class="vu-order-card-progress"><span><i style="width:${s.percent}%"></i></span><b>${s.nominated}/${s.ordered}</b><small>${s.short} short</small></div></button>`}).join('')||'<div class="card empty">No tracked orders yet.</div>'}</div></section>`;
 document.querySelectorAll('[data-diary-order]').forEach(b=>b.onclick=()=>openOrder(b.dataset.diaryOrder).catch(err=>alert(err?.message||String(err))));
}

function style(){if(document.getElementById('vuOrderDiaryStyle'))return;const s=document.createElement('style');s.id='vuOrderDiaryStyle';s.textContent=`
.vu-order-diary{display:grid;gap:12px;padding-bottom:90px}.vu-order-list{display:grid;gap:10px}.vu-order-card{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left}.vu-order-card>div:first-child{display:grid;gap:5px}.vu-order-card strong{font-size:1rem}.vu-order-card small{color:var(--muted)}.vu-order-card-progress{display:grid;grid-template-columns:110px auto;gap:5px 10px;align-items:center;text-align:right}.vu-order-card-progress>span{height:8px;border-radius:999px;background:var(--line);overflow:hidden}.vu-order-card-progress i{display:block;height:100%;background:var(--accent,#315b4d)}.vu-order-card-progress small{grid-column:1/-1}.vu-order-hero{display:flex;justify-content:space-between;align-items:center;gap:16px}.vu-order-hero h2{margin:4px 0}.vu-progress-ring{display:grid;place-items:center;min-width:88px;min-height:88px;border:1px solid var(--line);border-radius:50%}.vu-progress-ring small{color:var(--muted)}.vu-order-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.vu-order-kpis>div{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.vu-order-kpis small{display:block;color:var(--muted);margin-bottom:4px}.vu-order-note p{margin-bottom:0;color:var(--muted)}.vu-nom-lines{display:grid;gap:8px}.vu-nom-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px}.vu-nom-line.is-complete{opacity:.72}.vu-nom-main{display:grid;gap:4px}.vu-nom-main small{color:var(--muted)}.vu-stepper{display:grid;grid-template-columns:42px 44px 42px;align-items:center;text-align:center}.vu-stepper button{height:42px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-size:1.4rem;border-radius:10px}.vu-stepper button:disabled{opacity:.3}.vu-stepper strong{font-size:1.05rem}@media(max-width:680px){.vu-order-card{grid-template-columns:1fr}.vu-order-card-progress{grid-template-columns:1fr auto;text-align:left}.vu-order-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.vu-nom-line{grid-template-columns:1fr}.vu-stepper{justify-content:start}.vu-order-hero{align-items:flex-start}.vu-progress-ring{min-width:72px;min-height:72px}}
`;document.head.appendChild(s)}
style();
window.VUOrderDiary={version:'2.9.1',open,openOrder,seedKnownOrders,knownOrders:KNOWN_ORDERS};
})();