/* Factory OS 2.7.4 — narrow Sage customer header repair.
   Repairs blank customer names only from the exact header slot between VAT No and Due Date.
   This preserves the existing importer and reconciliation safety rules. */
(function(){
'use strict';
if(window.VUJobCardCustomerHeaderPatch)return;
const original=window.parseSagePdfFiles;
if(typeof original!=='function')return;
const txt=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const code=v=>txt(v).toUpperCase().replace(/\s+/g,'');
const structural=/\b(SALES\s*REP|NUMBER|REFERENCE|DATE|DUE DATE|VAT NO|CUSTOMER VAT NO|PAGE|DESCRIPTION|TOTAL|SUB TOTAL|GRAND TOTAL|BALANCE DUE|PHYSICAL ADDRESS|POSTAL ADDRESS|TEL|FAX|BUYER|FROM|TO)\b/i;
function toLines(items){const rows=[];for(const item of items){const value=txt(item.str);if(!value)continue;const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.4);if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,value})}rows.sort((a,b)=>b.y-a.y);return rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.value).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean)}
function orderNo(lines){for(const line of lines){const m=line.match(/\b(QUO?\d{5,})\b/i);if(m)return code(m[1])}return''}
function trustedCustomerSlot(lines){const desc=lines.findIndex(l=>/^Description\b/i.test(l)),header=lines.slice(0,desc>=0?desc:lines.length),vat=header.findIndex(l=>/^VAT\s*No\s*:/i.test(l)),due=header.findIndex(l=>/^Due\s*Date\s*:/i.test(l));if(vat<0||due<=vat+1)return'';for(let i=vat+1;i<due;i++){let value=txt(header[i]).replace(/\s*:\s*$/,'').trim();if(!value||value.length<3)continue;if(structural.test(value))continue;if(/[@]/.test(value)||/R\s*[\d,.]+/i.test(value)||/\b\d{7,}\b/.test(value))continue;if(!/[A-Za-z]/.test(value))continue;return value}return''}
async function headerMap(files){const map=new Map();if(!window.pdfjsLib)return map;for(const file of files||[]){const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent(),lines=toLines(content.items),no=orderNo(lines);if(!no||map.has(no))continue;const name=trustedCustomerSlot(lines);if(name)map.set(no,name)}}return map}
async function parseWithRepair(files){const cards=await original(files);if(!(cards||[]).some(c=>!txt(c.customerName)))return cards;const names=await headerMap(files);return (cards||[]).map(card=>{if(txt(card.customerName))return card;const name=names.get(code(card.orderNumber));return name?{...card,customerName:name,customerIdentitySource:'sage-header-slot'}:card})}
window.parseSagePdfFiles=parseWithRepair;
window.VUJobCardCustomerHeaderPatch={version:'2.7.4',trustedCustomerSlot,parseWithRepair};
})();