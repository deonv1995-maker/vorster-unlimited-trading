/* Version 8.8.0 — direct Sage PDF job-card import.
   Reads digitally-generated Sage job-card PDFs in the browser with PDF.js, converts them to the
   same internal card shape used by the JSON importer, then hands them to the existing safe import flow.
   Supports individual PDFs, multi-page orders, combined PDFs, and multiple selected PDF files.
*/
(function(){
  const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const text=v=>String(v??'').replace(/\u00a0/g,' ').trim();
  const moneyNumber=v=>Number(String(v??'0').replace(/R/gi,'').replace(/\s/g,'').replace(/,/g,''))||0;
  const normalCode=v=>text(v).toUpperCase();

  const colourCodes={
    'DB':'Dry brush','G/DB':'Grey dry brush','R/C/DB':'Rust cream dry brush','STANDARD':'Standard',
    '0125':'Mixed colours','C10':'Silver wing','RUST':'Rust','R/DB':'Rust dry brush','CHAR':'Charkha wash'
  };
  const serviceCodes=new Set(['C+R','CR','DEL']);

  async function ensurePdfJs(){
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;}
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[src="${PDFJS_URL}"]`);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.src=PDFJS_URL;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load the PDF reader. Check your internet connection and try again.'));document.head.appendChild(s);
    });
    if(!window.pdfjsLib)throw new Error('PDF reader did not initialise.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    return window.pdfjsLib;
  }

  function itemsToLines(items){
    const rows=[];
    for(const item of items){
      const value=text(item.str);if(!value)continue;
      const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
      let row=rows.find(r=>Math.abs(r.y-y)<=2.4);
      if(!row){row={y,items:[]};rows.push(row);}
      row.items.push({x,value});
    }
    rows.sort((a,b)=>b.y-a.y);
    return rows.map(row=>row.items.sort((a,b)=>a.x-b.x).map(i=>i.value).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  }

  async function extractPdfPages(file){
    const pdfjs=await ensurePdfJs();
    const data=new Uint8Array(await file.arrayBuffer());
    const pdf=await pdfjs.getDocument({data}).promise;
    const pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo);
      const content=await page.getTextContent();
      pages.push({fileName:file.name,pageNo,lines:itemsToLines(content.items)});
    }
    return pages;
  }

  function orderNumberFrom(lines){
    for(const line of lines){
      const m=line.match(/\b(?:NUMBER|Number)\s*:\s*(QU\d{5,})\b/i)||line.match(/\b(QU\d{5,})\b/i);
      if(m)return normalCode(m[1]);
    }
    return '';
  }

  function fieldFrom(lines,label){
    const rx=new RegExp(`\\b${label}\\s*:\\s*(.+)$`,'i');
    for(const line of lines){const m=line.match(rx);if(m)return text(m[1]);}
    return '';
  }

  function dateField(lines,label){
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rx=new RegExp(`\\b${escaped}\\s*:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})`,'i');
    for(const line of lines){const m=line.match(rx);if(m)return m[1];}
    return '';
  }

  function customerIdentity(lines){
    const rejects=/^(?:NUMBER|REFERENCE|DATE|DUE DATE|SALES REP|VAT NO|CUSTOMER VAT NO|PAGE|DESCRIPTION|TOTAL|SUB TOTAL|GRAND TOTAL|BALANCE DUE)/i;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      // Customer account codes in these Sage job cards appear at the end of the customer-name line.
      const m=line.match(/^(.*?)\s*:\s*([A-Z]{2,}[A-Z0-9]{2,})\s*$/i);
      if(!m||rejects.test(line))continue;
      let name=text(m[1]).replace(/^DK\s+POTS\s+ONE\s+CC\s+/i,'').trim();
      if(!name||/^(?:FROM|TO)$/i.test(name))continue;
      return{name,code:normalCode(m[2]),index:i};
    }
    // Some PDF text engines place FROM/TO/company/customer tokens on one row.
    const joined=lines.join(' ');
    const m=joined.match(/DK\s+POTS\s+ONE\s+CC\s+(.+?)\s*:\s*([A-Z]{2,}[A-Z0-9]{2,})\b/i);
    return m?{name:text(m[1]),code:normalCode(m[2]),index:0}:{name:'',code:'',index:-1};
  }

  function customerVat(lines){
    const joined=lines.join(' ');
    return text(joined.match(/CUSTOMER\s+VAT\s+NO\s*:\s*([0-9]+)/i)?.[1]||joined.match(/Customer\s+VAT\s+No\s*:\s*([0-9]+)/i)?.[1]||'');
  }

  function contactData(lines){
    const joined=lines.join(' ');
    const phone=text(joined.match(/\bTEL\s*[:.]?\s*([0-9 ()+\-]{7,})/i)?.[1]||'').replace(/\s+(?:FAX|BUYER).*$/i,'').trim();
    const buyer=text(joined.match(/\bBUYER\s*[.:]?\s*([^|]+?)(?=\s+Description\b|\s+FAX\b|$)/i)?.[1]||'').replace(/\s{2,}.*/,'').trim();
    return{phone,buyer};
  }

  function cleanAddressCandidate(line){
    let s=text(line);
    if(!s)return '';
    // Sage's two-column header can flatten company banking text and the customer's address onto one text row.
    s=s.replace(/^Our Account Details:\s*/i,'');
    s=s.replace(/^ABSA\s+\d{2,4}\s+\d{2,4}\s*/i,'');
    s=s.replace(/^ACC\s+NUMBER\s+\d+\s*/i,'');
    s=s.trim();
    if(!s)return '';
    if(/^(?:JOBCARD|FROM|TO|DK POTS ONE CC|PHYSICAL ADDRESS|NUMBER|REFERENCE|DATE|DUE DATE|SALES REP|OVERALL DISCOUNT|DISCOUNT|PAGE|VAT NO|CUSTOMER VAT NO|Description|Quantity|Excl\.|Notes|Total|Sub Total|Grand Total|BALANCE DUE)/i.test(s))return '';
    if(/(?:Please use your company code|as ref when making a payment|deonvorster@dkpots\.com|Deon Vorster|Vorster 0\d|\bTEL\b|\bFAX\b|\bBUYER\b)/i.test(s))return '';
    if(/^(?:COLLECTION|DELIVERY|PAY\s+\d+|10% DELIVERY FEE)/i.test(s))return '';
    if(/^R?[\d,.]+$/.test(s))return '';
    return s;
  }

  function customerAddress(lines,identity){
    if(identity.index<0)return '';
    const end=lines.findIndex((l,i)=>i>identity.index&&/^Description\b/i.test(l));
    const stop=end>identity.index?end:Math.min(lines.length,identity.index+18);
    const candidates=[];
    for(let i=identity.index+1;i<stop;i++){
      const raw=lines[i];
      if(/\bDUE DATE\s*:/i.test(raw)||/\bDISCOUNT\s*:/i.test(raw))continue;
      const cleaned=cleanAddressCandidate(raw);
      if(cleaned)candidates.push(cleaned);
    }
    // Remove accidental duplicate customer/company identity rows and obvious account-code-only fragments.
    const unique=[];
    for(const c of candidates){
      if(c.toUpperCase().includes(identity.name.toUpperCase()))continue;
      if(c===identity.code)continue;
      if(!unique.some(x=>x.toLowerCase()===c.toLowerCase()))unique.push(c);
    }
    return unique.slice(0,5).join(', ');
  }

  function preferenceFrom(lines){
    const joined=lines.join(' ');
    if(/\bCOLLECTION\b/i.test(joined))return 'Collection';
    if(/\bDELIVERY\b/i.test(joined))return 'Delivery';
    return '';
  }

  function pageTotal(lines){
    const values=[];
    for(const line of lines){
      let m=line.match(/\bGrand Total\s*:\s*R\s*([\d,.]+)/i);if(m){values.push(moneyNumber(m[1]));continue;}
      m=line.match(/\bTotal Due\s*:\s*R\s*([\d,.]+)/i);if(m)values.push(moneyNumber(m[1]));
    }
    return values.length?values[values.length-1]:0;
  }

  function productSectionLines(lines){
    const start=lines.findIndex(l=>/^Description\b/i.test(l));
    if(start<0)return[];
    const out=[];
    for(let i=start+1;i<lines.length;i++){
      if(/^(?:Notes:|Total Discount:|Total Exclusive:|Total VAT:|Sub Total:|Grand Total:|Total Due:|BALANCE DUE)/i.test(lines[i]))break;
      out.push(lines[i]);
    }
    return out;
  }

  function parseRows(lines){
    const section=productSectionLines(lines);
    const rows=[];let pending='';
    const rowStart=/^[A-Z0-9][A-Z0-9/+\-.]*\s*-\s*/i;
    const hasPrice=/\s\d+(?:[.,]\d+)?\s+R\s*[\d,.]+/i;
    for(const line of section){
      if(rowStart.test(line)){
        if(pending)rows.push(pending);
        pending=line;
        if(hasPrice.test(pending)){rows.push(pending);pending='';}
      }else if(pending){
        pending+=' '+line;
        if(hasPrice.test(pending)){rows.push(pending);pending='';}
      }
    }
    if(pending)rows.push(pending);
    return rows;
  }

  function parseProductRow(row){
    const m=row.match(/^([^\s]+)\s*-\s*(.*?)\s+(\d+(?:[.,]\d+)?)\s+R\s*([\d,.]+)/i);
    if(!m)return null;
    const code=normalCode(m[1]),name=text(m[2]).replace(/\s+/g,' '),qty=Number(String(m[3]).replace(',','.'))||0,unitPrice=moneyNumber(m[4]);
    return{code,name,qty,unitPrice,row};
  }

  function instructionFor(parsed){
    const code=parsed.code;
    if(serviceCodes.has(code))return true;
    if(colourCodes[code])return true;
    if(/DELIVERY FEE|COLLECT AND REPLACE|COLOURS?|DRY BRUSH|SILVER WING|MIXED COLOURS/i.test(parsed.name))return parsed.unitPrice===0||code==='DEL';
    return false;
  }

  function parsePage(page){
    const lines=page.lines,orderNumber=orderNumberFrom(lines);
    if(!orderNumber)return null;
    const identity=customerIdentity(lines);
    const contact=contactData(lines);
    const parsedRows=parseRows(lines).map(parseProductRow).filter(Boolean);
    return{
      orderNumber,
      pageNo:page.pageNo,
      fileName:page.fileName,
      date:dateField(lines,'DATE')||dateField(lines,'Date'),
      dueDate:dateField(lines,'DUE DATE')||dateField(lines,'Due Date'),
      reference:fieldFrom(lines,'REFERENCE')||fieldFrom(lines,'Reference'),
      customerName:identity.name,
      customerCode:identity.code,
      customerVatNumber:customerVat(lines),
      customerAddress:customerAddress(lines,identity),
      deliveryAddress:customerAddress(lines,identity),
      contactPerson:contact.buyer,
      phone:contact.phone,
      fulfilmentType:preferenceFrom(lines),
      rows:parsedRows,
      pageTotal:pageTotal(lines)
    };
  }

  function mergePages(parsedPages){
    const grouped=new Map();
    for(const p of parsedPages.filter(Boolean)){
      if(!grouped.has(p.orderNumber))grouped.set(p.orderNumber,[]);
      grouped.get(p.orderNumber).push(p);
    }
    const cards=[];
    for(const [orderNumber,pages] of grouped){
      pages.sort((a,b)=>a.pageNo-b.pageNo);
      const first=pages.find(p=>p.customerName)||pages[0];
      const lines=[];const instructions=[];let currentColour='Standard',deliveryFee=0;
      for(const page of pages){
        for(const row of page.rows){
          if(instructionFor(row)){
            instructions.push(`${row.code}: ${row.name}`);
            if(row.code==='DEL')deliveryFee+=row.qty*row.unitPrice;
            if(colourCodes[row.code])currentColour=colourCodes[row.code];
            continue;
          }
          lines.push({kind:'product',code:row.code,name:row.name,qty:row.qty,unitPrice:row.unitPrice,colour:currentColour});
        }
      }
      const dedupInstructions=[...new Set(instructions)];
      cards.push({
        orderNumber,
        date:first.date||pages.find(p=>p.date)?.date||'',
        dueDate:first.dueDate||pages.find(p=>p.dueDate)?.dueDate||'',
        reference:first.reference||'',
        customerName:first.customerName||'',
        customerCode:first.customerCode||'',
        customerVatNumber:first.customerVatNumber||'',
        customerAddress:first.customerAddress||pages.find(p=>p.customerAddress)?.customerAddress||'',
        deliveryAddress:first.deliveryAddress||pages.find(p=>p.deliveryAddress)?.deliveryAddress||'',
        contactPerson:first.contactPerson||pages.find(p=>p.contactPerson)?.contactPerson||'',
        phone:first.phone||pages.find(p=>p.phone)?.phone||'',
        fulfilmentType:first.fulfilmentType||pages.find(p=>p.fulfilmentType)?.fulfilmentType||'',
        grandTotal:pages.reduce((sum,p)=>sum+Number(p.pageTotal||0),0),
        deliveryFee,
        lines,
        instructions:dedupInstructions,
        sourceFormat:'Sage PDF'
      });
    }
    return cards;
  }

  async function parseSagePdfFiles(files){
    const allPages=[];
    for(const file of files){allPages.push(...await extractPdfPages(file));}
    const cards=mergePages(allPages.map(parsePage));
    if(!cards.length)throw new Error('No Sage job cards were detected in the selected PDF file(s).');
    const invalid=cards.filter(c=>!c.customerName||!c.lines.length);
    if(invalid.length)console.warn('Some PDF job cards need review',invalid);
    return cards;
  }

  async function openPdfAwareJobCardImport(){
    openDialog(`
      <div class="dialog-head"><div><h2>Import Sage job cards</h2><p class="muted">Import Sage PDF job cards directly, or use the JSON backup format.</p></div><button class="close-btn" onclick="closeDialog()">×</button></div>
      <div class="card">
        <label>Select Sage PDF or JSON file(s)
          <input id="jobCardImportFile" type="file" accept="application/pdf,.pdf,application/json,.json" multiple>
        </label>
        <p class="muted">PDF is recommended. You can select individual job cards, several PDFs together, or one combined PDF. Existing order numbers update safely instead of duplicating.</p>
      </div>
      <div id="jobCardPdfStatus" class="card hidden" style="margin-top:12px"></div>
      <div id="jobCardImportPreview" style="margin-top:12px"></div>`);
    document.getElementById('jobCardImportFile').onchange=async event=>{
      const files=[...(event.target.files||[])];if(!files.length)return;
      const status=document.getElementById('jobCardPdfStatus');
      try{
        status.classList.remove('hidden');status.innerHTML='<strong>Reading files…</strong><p class="muted">Extracting Sage customer, order and product information.</p>';
        const pdfs=files.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
        const jsons=files.filter(f=>/\.json$/i.test(f.name)||f.type==='application/json');
        let cards=[];
        if(pdfs.length)cards.push(...await parseSagePdfFiles(pdfs));
        for(const file of jsons){const parsed=JSON.parse(await readTextFile(file));cards.push(...validateJobCardImport(parsed));}
        // Last selected/source record for an order wins only for metadata; combine product lines only inside PDF parser.
        const byOrder=new Map();for(const card of cards)byOrder.set(normalCode(card.orderNumber),card);
        pendingJobCardImport=validateJobCardImport([...byOrder.values()]);
        const withDetails=pendingJobCardImport.filter(c=>c.customerAddress||c.deliveryAddress||c.customerVatNumber||c.phone||c.contactPerson).length;
        status.innerHTML=`<strong>${pendingJobCardImport.length} job cards read</strong><p class="muted">${withDetails} contain customer/contact/address information. Review the counts below, then import.</p>`;
        await renderJobCardImportPreview();
      }catch(error){
        pendingJobCardImport=null;
        status.classList.remove('hidden');status.innerHTML=`<strong>PDF import failed</strong><p>${esc(error.message||error)}</p><p class="muted">Only digitally-generated Sage job-card PDFs are supported; scanned photographs would require OCR.</p>`;
        document.getElementById('jobCardImportPreview').innerHTML='';
      }
    };
  }

  // Replace the input UI only. The existing commit/import transaction remains the single writer.
  openJobCardImport=openPdfAwareJobCardImport;
  window.openJobCardImport=openPdfAwareJobCardImport;
  window.parseSagePdfFiles=parseSagePdfFiles;
})();