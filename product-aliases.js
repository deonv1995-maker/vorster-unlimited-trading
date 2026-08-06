const normaliseAlias=value=>String(value||"").trim().toUpperCase();
const parseAliases=value=>[...new Set(String(value||"").split(/\n|,/).map(item=>item.trim()).filter(Boolean))];

async function saveProductAliases(productId,aliases){
  const product=await getOne("products",productId);
  if(!product)return;
  const clean=parseAliases(aliases).filter(alias=>normaliseAlias(alias)!==normaliseAlias(product.code));
  product.aliases=clean;
  product.updatedAt=new Date().toISOString();
  await putOne("products",product);
  for(const alias of clean){
    await saveImportMapping("product",alias,product.id,`${product.code} · ${product.name}`);
  }
}

const showProductFormBeforeAliases=showProductForm;
showProductForm=async function(id=""){
  await showProductFormBeforeAliases(id);
  const form=document.getElementById("productForm");
  if(!form||form.querySelector(".product-alias-fields"))return;
  const product=id?await getOne("products",id):null;
  const submit=form.querySelector('button[type="submit"]');
  const section=document.createElement("div");
  section.className="product-alias-fields";
  section.innerHTML=`
    <label>Known aliases
      <textarea id="productAliases" rows="3" placeholder="One alias per line, for example AKMINI CROWN LADY">${esc((product?.aliases||[]).join("\n"))}</textarea>
      <small class="muted">Older codes or job-card descriptions that must resolve to this product.</small>
    </label>
    ${product?`<button id="linkExistingProductBtn" class="secondary" type="button">Link this imported product to another existing product</button>`:""}`;
  form.insertBefore(section,submit);

  if(product){
    document.getElementById("linkExistingProductBtn").onclick=()=>{
      closeDialog();
      reviewImportedProductConnection(product.code,product.id);
    };
  }

  const previousSubmit=form.onsubmit;
  form.onsubmit=async event=>{
    const aliases=document.getElementById("productAliases")?.value||"";
    await previousSubmit.call(form,event);
    const savedId=id||form.dataset.generatedProductId;
    if(savedId)await saveProductAliases(savedId,aliases);
    else{
      const products=await getAll("products");
      const code=String(new FormData(form).get("code")||"").trim().toUpperCase();
      const saved=products.find(item=>normaliseAlias(item.code)===code);
      if(saved)await saveProductAliases(saved.id,aliases);
    }
  };
};

async function addAliasToProduct(productId){
  const product=await getOne("products",productId);
  if(!product)return notify("Product not found");
  const alias=prompt(`Add an alias for ${product.code}`,"");
  if(!alias?.trim())return;
  const aliases=[...(product.aliases||[]),alias.trim()];
  await saveProductAliases(product.id,aliases);
  notify("Product alias saved");
}

window.saveProductAliases=saveProductAliases;
window.addAliasToProduct=addAliasToProduct;
