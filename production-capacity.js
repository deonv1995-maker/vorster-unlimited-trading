
const originalShowProductFormForCapacity=showProductForm;
showProductForm=async function(id=""){
  await originalShowProductFormForCapacity(id);
  const form=document.getElementById("productForm");
  if(!form||form.querySelector(".product-capacity-fields"))return;
  const product=id?await getOne("products",id):null;
  const submit=form.querySelector('button[type="submit"]');
  const fields=document.createElement("div");
  fields.className="product-capacity-fields";
  fields.innerHTML=`
    <label>Mould quantity
      <input name="mouldQuantity" type="number" min="0" step="1" inputmode="numeric" value="${Number(product?.mouldQuantity||0)}" placeholder="0">
      <small class="muted">Number of usable moulds for this product.</small>
    </label>
    <label>Manufacturing capacity per day
      <input name="dailyCapacity" type="number" min="0" step="1" inputmode="numeric" value="${Number(product?.dailyCapacity||0)}" placeholder="0">
      <small class="muted">Maximum finished units per normal production day.</small>
    </label>`;
  form.insertBefore(fields,submit);
};

async function decorateProductsWithCapacity(){
  if(route!=="products")return;
  const products=await getAll("products");
  const byId=Object.fromEntries(products.map(product=>[product.id,product]));

  document.querySelectorAll(".management-product-card").forEach(card=>{
    const editButton=card.querySelector('button[onclick^="showProductForm"]');
    const match=editButton?.getAttribute("onclick")?.match(/'([^']+)'/);
    const product=byId[match?.[1]];
    if(!product||card.querySelector(".capacity-summary"))return;
    const summary=document.createElement("div");
    summary.className="capacity-summary";
    summary.innerHTML=`
      <div><small>Moulds</small><strong>${Number(product.mouldQuantity||0)}</strong></div>
      <div><small>Daily capacity</small><strong>${Number(product.dailyCapacity||0)} units</strong></div>`;
    const stockBadge=card.querySelector(".stock-on-hand-badge");
    const actions=card.querySelector(".actions");
    if(stockBadge)stockBadge.insertAdjacentElement("afterend",summary);
    else card.querySelector(".management-card-body")?.insertBefore(summary,actions);
  });
}

const productsPageWithInventory=productsPage;
productsPage=async function(...args){
  await productsPageWithInventory(...args);
  await decorateProductsWithCapacity();
};

window.decorateProductsWithCapacity=decorateProductsWithCapacity;
