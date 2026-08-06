let aliasFormObserverBusy=false;

async function ensureProductAliasControls(){
  if(aliasFormObserverBusy)return;
  const form=document.getElementById("productForm");
  if(!form||form.querySelector(".product-alias-fields"))return;
  aliasFormObserverBusy=true;
  try{
    const code=String(new FormData(form).get("code")||"").trim().toUpperCase();
    const products=await getAll("products");
    const product=products.find(item=>String(item.code||"").trim().toUpperCase()===code)||null;
    const submit=form.querySelector('button[type="submit"]');
    if(!submit)return;

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
      const linkButton=document.getElementById("linkExistingProductBtn");
      if(linkButton)linkButton.onclick=()=>{
        closeDialog();
        reviewImportedProductConnection(product.code,product.id);
      };
    }

    if(!form.dataset.aliasSubmitWrapped){
      form.dataset.aliasSubmitWrapped="true";
      form.addEventListener("submit",async()=>{
        const aliases=document.getElementById("productAliases")?.value||"";
        setTimeout(async()=>{
          const currentProducts=await getAll("products");
          const savedCode=String(new FormData(form).get("code")||code).trim().toUpperCase();
          const saved=currentProducts.find(item=>String(item.code||"").trim().toUpperCase()===savedCode);
          if(saved)await saveProductAliases(saved.id,aliases);
        },0);
      });
    }
  }finally{
    aliasFormObserverBusy=false;
  }
}

const productAliasObserver=new MutationObserver(()=>ensureProductAliasControls());
productAliasObserver.observe(document.documentElement,{childList:true,subtree:true});
setInterval(ensureProductAliasControls,750);
window.ensureProductAliasControls=ensureProductAliasControls;
