/* V9.0.83 — lean Sage document-type adapter.
   Preserves Sage quotation import support without the obsolete V8 factory/dashboard pipeline UI. */
(function(){
'use strict';
if(window.VUSageDocumentImport||typeof window.importSageOrders!=='function')return;
const original=window.importSageOrders;
const lower=v=>String(v||'').trim().toLowerCase();
const kind=source=>{const raw=lower(source?.documentType||source?.type||source?.documentKind||source?.kind||source?.category||source?.statusType);return raw.includes('quote')||raw.includes('quotation')||raw.includes('estimate')?'quote':'order';};
async function importDocuments(payload){
  const docs=Array.isArray(payload)?payload:(payload?.orders||payload?.documents||payload?.results||[]);
  const orderDocs=docs.filter(doc=>kind(doc)!=='quote'),quoteDocs=docs.filter(doc=>kind(doc)==='quote');
  const result=await original(orderDocs);
  if(!quoteDocs.length)return{...result,total:docs.length,quotesCreated:0,quotesUpdated:0};
  const [products,mappings,existingQuotes]=await Promise.all([getAll('products'),getAll('sageMappings'),getAll('quotes')]);
  let quotesCreated=0,quotesUpdated=0;
  for(const source of quoteDocs){
    const sageId=String(source.id||source.ID||source.quoteId||source.documentId||source.number||source.documentNumber||'');if(!sageId)continue;
    const lines=[];
    for(const raw of(source.lines||source.documentLines||source.items||[])){
      if(typeof classifySageLine==='function'&&classifySageLine(raw)!=='product')continue;
      const product=typeof matchSageProduct==='function'?await matchSageProduct(raw,products,mappings):null;
      lines.push({productId:product?.id||'',productCode:String(raw.productCode||raw.code||''),productName:product?.name||String(raw.description||raw.name||raw.productName||''),colour:{name:raw.colour||raw.color||'Standard',hex:'#bbbbbb'},qty:Number(raw.quantity||raw.qty||0),unitPrice:Number(raw.unitPrice||raw.price||raw.exclusivePrice||0)});
    }
    const existing=existingQuotes.find(q=>String(q.sageId||'')===sageId),now=new Date().toISOString();
    const quote={...(existing||{}),id:existing?.id||uid('quo'),sageId,source:'Sage Quote',quoteNumber:String(source.number||source.documentNumber||source.quoteNumber||sageId),customerId:existing?.customerId||'',customerName:String(source.customerName||source.customer?.name||'Sage customer'),createdAt:source.date||source.documentDate||existing?.createdAt||now,validUntil:source.validUntil||source.expiryDate||existing?.validUntil||'',status:source.status||existing?.status||'Sent',lines,subTotal:Number(source.totalExclusive||source.subTotal||0),vat:Number(source.totalTax||source.vat||0),grandTotal:Number(source.totalInclusive||source.grandTotal||source.total||0),updatedAt:now,readOnlySource:true};
    await putOne('quotes',quote);if(existing)quotesUpdated++;else quotesCreated++;
  }
  return{...result,total:docs.length,quotesCreated,quotesUpdated};
}
window.importSageOrders=importDocuments;try{importSageOrders=importDocuments}catch{}
window.VUSageDocumentImport={version:'9.0.83',kind,importDocuments};
})();
