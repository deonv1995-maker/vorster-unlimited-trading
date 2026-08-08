/* Version 8.8.1 — authoritative verified job-card import transaction.
   PDF/JSON parsers only prepare cards. This function is the single writer for customers + orders.
*/
(function(){
  const txt=v=>String(v??'').trim();
  const key=v=>txt(v).toUpperCase();
  const nameKey=v=>txt(v).toLowerCase().replace(/\s+/g,' ');

  function snapshotFrom(card,customer,meta,now){
    return{
      accountCode:txt(card.customerCode||customer.accountCode),
      name:txt(card.customerName||customer.name),
      vatNumber:txt(meta.vatNumber||customer.vatNumber),
      contactPerson:txt(meta.contactPerson||customer.contactPerson),
      phone:txt(meta.phone||customer.phone),
      whatsapp:txt(meta.whatsapp||customer.whatsapp||meta.phone||customer.phone),
      email:txt(meta.email||customer.email),
      address:txt(meta.address||customer.address),
      deliveryAddress:txt(meta.deliveryAddress||customer.deliveryAddress||customer.address),
      deliveryArea:txt(meta.area||customer.deliveryArea||customer.area),
      preference:txt(meta.preference||customer.preference||'Delivery'),
      source:card.sourceFormat||'Job Card Import',
      capturedAt:now
    };
  }

  async function verifiedPutCustomer(customer,meta,orderNumber){
    await putOne('customers',customer);
    const saved=await getOne('customers',customer.id);
    if(!saved)throw new Error(`${orderNumber}: customer record did not persist.`);
    const checks=[
      ['VAT number',meta.vatNumber,saved.vatNumber],
      ['contact person',meta.contactPerson,saved.contactPerson],
      ['telephone',meta.phone,saved.phone],
      ['physical address',meta.address,saved.address],
      ['delivery address',meta.deliveryAddress,saved.deliveryAddress]
    ];
    const failed=checks.filter(([,expected,actual])=>txt(expected)&&!txt(actual));
    if(failed.length)throw new Error(`${orderNumber}: customer save verification failed for ${failed.map(x=>x[0]).join(', ')}.`);
    return saved;
  }

  async function authoritativeImport(){
    const data=typeof pendingJobCardImport!=='undefined'?pendingJobCardImport:null;
    if(!Array.isArray(data)||!data.length)return;
    const now=new Date().toISOString();
    const [products,customers,orders]=await Promise.all([getAll('products'),getAll('customers'),getAll('orders')]);
    const productByCode=new Map(products.map(p=>[key(p.code),p]));
    const customerByCode=new Map(customers.filter(c=>c.accountCode).map(c=>[key(c.accountCode),c]));
    const customerByName=new Map(customers.map(c=>[nameKey(c.name),c]));
    const orderByNumber=new Map(orders.map(o=>[key(o.orderNumber),o]));
    let createdProducts=0,createdCustomers=0,updatedCustomers=0,createdOrders=0,updatedOrders=0,verifiedCustomers=0;

    for(const card of data){
      const customerCode=key(card.customerCode),customerName=txt(card.customerName),meta=customerImportFields(card);
      let customer=(customerCode&&customerByCode.get(customerCode))||customerByName.get(nameKey(customerName));
      const existed=Boolean(customer);
      if(!customer){
        customer={id:uid('cus'),name:customerName,accountCode:txt(card.customerCode),vatNumber:'',contactPerson:'',phone:'',whatsapp:'',email:'',address:'',deliveryAddress:'',primaryDeliveryAddress:'',deliveryArea:'',area:'',preference:'Delivery',notes:'Imported from Sage job card.',isActive:true,createdAt:now,updatedAt:now};
        createdCustomers++;
      }
      customer=mergeCustomerFromCard(customer,card,now);
      customer.name=customerName||customer.name;
      if(/^Created from imported Sage job card/i.test(txt(customer.notes)))customer.notes='Imported from Sage job card.';
      customer=await verifiedPutCustomer(customer,meta,card.orderNumber);
      verifiedCustomers++;
      if(existed)updatedCustomers++;
      customerByName.set(nameKey(customer.name),customer);if(customerCode)customerByCode.set(customerCode,customer);

      const existing=orderByNumber.get(key(card.orderNumber));
      let orderLines=existing?.lines||[];
      if(!existing){
        orderLines=[];
        for(const line of card.lines||[]){
          if((line.kind||'product')!=='product')continue;
          const productCode=key(line.code);let product=productByCode.get(productCode);
          if(!product){
            product={id:uid('prd'),code:line.code||'UNKNOWN',name:line.name||line.code||'Imported product',description:'Created from an imported job card. Complete product setup.',category:'Imported / Unclassified',price:Number(line.unitPrice||0),colours:[{name:line.colour||'Standard',hex:'#999999'}],image:'',mouldQuantity:0,dailyCapacity:0,isActive:true,createdAt:now,updatedAt:now};
            await putOne('products',product);productByCode.set(productCode,product);createdProducts++;
          }
          const colourName=line.colour||'Standard';let colour=(product.colours||[]).find(c=>String(c.name||'').toLowerCase()===colourName.toLowerCase());
          if(!colour){colour={name:colourName,hex:'#999999'};product={...product,colours:[...(product.colours||[]),colour],updatedAt:now};await putOne('products',product);productByCode.set(productCode,product);}
          orderLines.push({productId:product.id,productCode:product.code,productName:product.name,colour,qty:Number(line.qty||0),unitPrice:Number(line.unitPrice||0),allocatedQty:0,completedQty:0,sourceLineType:'product'});
        }
      }

      const snap=snapshotFrom(card,customer,meta,now);
      const lineSubtotal=existing?Number(existing.subtotal||0):orderLines.reduce((sum,line)=>sum+Number(line.qty||0)*Number(line.unitPrice||0),0);
      const grandTotal=Number(card.grandTotal??existing?.grandTotal??lineSubtotal);
      const order={
        ...(existing||{id:uid('ord'),createdAt:parseImportDate(card.date)}),
        orderNumber:card.orderNumber,customerId:customer.id,customerName:customer.name,customerSnapshot:snap,
        customerVatNumber:snap.vatNumber,customerAddress:snap.address,customerContactPerson:snap.contactPerson,customerPhone:snap.phone,
        lines:orderLines,status:existing?.status||'Confirmed',dueDate:parseImportDate(card.dueDate),
        subtotal:existing?existing.subtotal:lineSubtotal,vat:existing?existing.vat:Math.max(0,grandTotal-lineSubtotal),deliveryFee:Number(card.deliveryFee??existing?.deliveryFee??0),grandTotal,
        reference:card.reference||existing?.reference||'',deliveryAddressSnapshot:snap.deliveryAddress,deliveryAddress:snap.deliveryAddress,
        deliveryArea:snap.deliveryArea||existing?.deliveryArea||'',area:snap.deliveryArea||existing?.area||'',deliveryContact:snap.contactPerson,deliveryPhone:snap.phone,
        fulfilmentType:snap.preference,preference:snap.preference,notes:existing?.notes||`Imported from job card ${card.orderNumber}.`,
        source:card.sourceFormat||'Job Card Import',sourceReference:card.orderNumber,customerDataImportedAt:now,readOnly:false,updatedAt:now
      };
      await putOne('orders',order);
      const savedOrder=await getOne('orders',order.id);
      if(!savedOrder?.customerSnapshot)throw new Error(`${card.orderNumber}: order customer snapshot did not persist.`);
      orderByNumber.set(key(card.orderNumber),savedOrder);if(existing)updatedOrders++;else createdOrders++;
    }

    pendingJobCardImport=null;closeDialog();
    alert(`Import verified\n\nCustomers verified: ${verifiedCustomers}\nNew customers: ${createdCustomers}\nCustomers refreshed: ${updatedCustomers}\nNew products: ${createdProducts}\nNew orders: ${createdOrders}\nExisting orders refreshed: ${updatedOrders}`);
    navigate('customers');
  }

  commitJobCardImport=authoritativeImport;
  window.commitJobCardImport=authoritativeImport;
  window.authoritativeJobCardImport=authoritativeImport;
})();