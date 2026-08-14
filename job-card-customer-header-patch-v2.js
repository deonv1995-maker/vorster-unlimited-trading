/* Factory OS 2.7.6 — robust Sage customer header repair.
   Repairs only a blank customer name using the exact Sage customer slot between VAT No and Due Date.
   Sage sometimes places the next header label on the same PDF text row; strip that label safely. */
(function(){
'use strict';
if(window.VUJobCardCustomerHeaderPatchV2)return;
const original=window.parseSagePdfFiles;
if(typeof original!=='function')return;
const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const txt=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const code=v=>txt(v).toUpperCase().replace(/\s+/g,'');
const structural=/^(?:SALES\s*REP|REFERENCE|DATE|DUE\s*DATE|VAT\s*NO|CUSTOMER\s*VAT\s*NO|PAGE|DESCRIPTION|TOTAL|SUB\s*TOTAL|GRAND\s*TOTAL|BALANCE\s*DUE|PHYSICAL\s*ADDRESS|POSTAL\s*ADDRESS|TEL|FAX|BUYER|FROM|TO)\b/i;
const trailingHeader=/\s*:\s*(?:REFERENCE|SALES\s*REP|DATE|DUE\s*DATE|VAT\s*NO|CUSTOMER\s*VAT\s*NO|PAGE|DESCRIPTION|PHYSICAL\s*ADDRESS|POSTAL\s*ADDRESS|TEL|FAX|BUYER|FROM|TO)\b.*$/i;
function cleanCustomer(v){return txt(v).replace(trailingHeader,'').replace(/\s*:\s*$/,'').trim()}
async function ensurePdf(){
 if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib}
 await new Promise((ok,no)=>{const s=document.createElement('script');s.src=PDFJS_URL;s.onload=ok;s.onerror=()=>no(new Error('Could not load PDF reader for customer verification.'));document.head.appendChild(s)});
 if(!window.pdfjsLib)throw new Error('PDF customer verification reader did not initialise.');
 window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;
}
function toLines(items){const rows=[];for(const item of items||[]){const value=txt(item.str);if(!value)continue;const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.4);if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,value})}rows.sort((a,b)=>b.y-a.y);return rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.value).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean)}
function orderNo(lines){for(const line of lines){const m=line.match(/\b(QUO?\d{5,})\b/i);if(m)return code(m[1])}return''}
function customerFromHeader(lines){
 const desc=lines.findIndex(l=>/^Description\b/i.test(l));
 const header=lines.slice(0,desc>=0?desc:lines.length);
 const vat=header.findIndex(l=>/^VAT\s*No\s*:/i.test(l));
 const due=header.findIndex((l,i)=>i>vat&&/^Due\s*Date\s*:/i.test(l));
 if(vat<0)return'';
 const stop=due>vat?due:Math.min(header.length,vat+5);
 for(let i=vat+1;i<stop;i++){
  const value=cleanCustomer(header[i]);
  if(value.length<3||structural.test(value))continue;
  if(/@/.test(value)||/R\s*[\d,.]+/i.test(value)||/\b\d{7,}\b/.test(value)||!/[A-Za-z]/.test(value))continue;
  return value;
 }
 return'';
}
async function readNames(files){
 const lib=await ensurePdf(),map=new Map();
 for(const file of files||[]){
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),content=await page.getTextContent(),lines=toLines(content.items),no=orderNo(lines);
   if(!no||map.has(no))continue;
   const name=customerFromHeader(lines);if(name)map.set(no,name);
  }
 }
 return map;
}
async function parseWithRepair(files){
 const namesPromise=readNames(files).catch(e=>{console.warn('Sage customer header repair unavailable',e);return new Map()});
 const cards=await original(files),names=await namesPromise;
 return (cards||[]).map(card=>{
  const repaired=names.get(code(card.orderNumber));
  const current=cleanCustomer(card.customerName);
  const needsRepair=!current||trailingHeader.test(txt(card.customerName));
  if(repaired&&needsRepair)return{...card,customerName:repaired,customerIdentitySource:'sage-header-slot-v2.7.6'};
  if(current&&current!==txt(card.customerName))return{...card,customerName:current,customerIdentitySource:'sage-header-clean-v2.7.6'};
  return card;
 });
}
window.parseSagePdfFiles=parseWithRepair;
window.VUJobCardCustomerHeaderPatchV2={version:'2.7.6',customerFromHeader,cleanCustomer,parseWithRepair};
})();