/* Factory OS 2.7.5 — robust Sage customer header repair.
   Self-contained PDF header reader. Repairs only a blank customer name using the exact
   Sage customer slot between VAT No and Due Date, before reconciliation sees the cards. */
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
 if(vat<0||due<0||due<=vat+1)return'';
 for(let i=vat+1;i<due;i++){
  let value=txt(header[i]).replace(/\s*:\s*$/,'').trim();
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
  if(txt(card.customerName))return card;
  const name=names.get(code(card.orderNumber));
  return name?{...card,customerName:name,customerIdentitySource:'sage-header-slot-v2'}:card;
 });
}
window.parseSagePdfFiles=parseWithRepair;
window.VUJobCardCustomerHeaderPatchV2={version:'2.7.5',customerFromHeader,parseWithRepair};
})();