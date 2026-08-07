/* V8.6.1 prepared-order import fix.
   Keeps the existing JSON import architecture, but correctly preserves delivery fees
   and source instructions from converted Sage job cards. */

commitJobCardImport=async function commitJobCardImportV861(){
  const data=pendingJobCardImport;
  if(!data?.length)return;
  const now=new Date().toISOString();
  const [products,customers,orders]=await Promise.all([getAll("products"),getAll("customers"),getAll("orders")]);
  const productByCode=new Map(products.map(p=>[normaliseImportCode(p.code),p]));
  const customerByCode=new Map(customers.filter(c=>c.accountCode).map(c=>[normaliseImportCode(c.accountCode),c]));
  const customerByName=new Map(customers.map(c=>[String(c.name||"").trim().toLowerCase(),c]));
  const orderByNumber=new Map(orders.map(o=>[normaliseImportCode(o.orderNumber),o]));
  let createdProducts=0,createdCustomers=0,createdOrders=0,updatedOrders=0;

  for(const card of data){
    const customerCode=normaliseImportCode(card.customerCode);
    const customerName=String(card.customerName||"").trim();
    let customer=(customerCode&&customerByCode.get(customerCode))||customerByName.get(customerName.toLowerCase());
    if(!customer){
      customer={id:uid("cus"),name:customerName,accountCode:card.customerCode||"",contactPerson:"",phone:"",whatsapp:"",email:"",preference:"Delivery",notes:"Created from imported Sage job card. Complete missing customer details.",isActive:true,createdAt:now,updatedAt:now};
      await putOne("customers",customer);createdCustomers++;
      customerByName.set(customerName.toLowerCase(),customer);if(customerCode)customerByCode.set(customerCode,customer);
    }

    const orderLines=[];
    const instructions=[];
    for(const line of card.lines||[]){
      const kind=line.kind||"product";
      if(kind!=="product"){
        instructions.push(`${line.code||"Instruction"}: ${line.name||""}`);continue;
      }
      const productCode=normaliseImportCode(line.code);let product=productByCode.get(productCode);
      if(!product){
        product={id:uid("prd"),code:line.code||"UNKNOWN",name:line.name||line.code||"Imported product",description:"Created from an imported job card. Complete the category, image, mould quantity and manufacturing capacity.",category:"Imported / Unclassified",price:Number(line.unitPrice||0),colours:[{name:line.colour||"Standard",hex:"#999999"}],image:"",mouldQuantity:0,dailyCapacity:0,isActive:true,createdAt:now,updatedAt:now};
        await putOne("products",product);productByCode.set(productCode,product);createdProducts++;
      }
      const colourName=line.colour||"Standard";let colour=(product.colours||[]).find(c=>String(c.name||"").toLowerCase()===colourName.toLowerCase());
      if(!colour){colour={name:colourName,hex:"#999999"};product={...product,colours:[...(product.colours||[]),colour],updatedAt:now};await putOne("products",product);productByCode.set(productCode,product);}
      orderLines.push({productId:product.id,productCode:product.code,productName:product.name,colour,qty:Number(line.qty||0),unitPrice:Number(line.unitPrice||0),allocatedQty:0,completedQty:0,sourceLineType:"product"});
    }

    if(Array.isArray(card.instructions))instructions.push(...card.instructions.map(String));
    const existing=orderByNumber.get(normaliseImportCode(card.orderNumber));
    const lineSubtotal=orderLines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0);
    const deliveryFee=Math.max(0,Number(card.deliveryFee||0));
    const grandTotal=Number(card.grandTotal||lineSubtotal+deliveryFee);
    const vat=Math.max(0,grandTotal-lineSubtotal-deliveryFee);
    const importedNotes=[`Imported from job card ${card.orderNumber}.`,card.reference?`Customer reference: ${card.reference}`:"",instructions.length?`Source instructions: ${[...new Set(instructions)].join(" | ")}`:""].filter(Boolean).join("\n");
    const order={...(existing||{id:uid("ord"),createdAt:parseImportDate(card.date)}),orderNumber:card.orderNumber,customerId:customer.id,customerName:customer.name,lines:orderLines,status:existing?.status||"Confirmed",dueDate:parseImportDate(card.dueDate),subtotal:lineSubtotal,vat,deliveryFee,grandTotal,notes:[existing?.notes,importedNotes].filter(Boolean).join("\n"),source:"Job Card Import",sourceReference:card.orderNumber,readOnly:false,updatedAt:now};
    await putOne("orders",order);orderByNumber.set(normaliseImportCode(card.orderNumber),order);if(existing)updatedOrders++;else createdOrders++;
  }

  pendingJobCardImport=null;closeDialog();
  alert(`Import complete\n\nNew customers: ${createdCustomers}\nNew products: ${createdProducts}\nNew orders: ${createdOrders}\nUpdated orders: ${updatedOrders}`);
  navigate("orders");
};
window.commitJobCardImport=commitJobCardImport;
