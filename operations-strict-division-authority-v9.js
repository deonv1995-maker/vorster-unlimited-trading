/* V9.0.55 — final Operations division routing authority.
   Makes the visible Production division lists use the same routing rule as printable worksheets:
   worksheetDivision -> primaryDivision -> Unclassified.
   Allowed production methods describe capability only and never place a production line on a division sheet. */
(function(){
'use strict';
const DIVISIONS=['Casting','Packing','Resin','Painting'];
const norm=v=>String(v||'').trim().toLowerCase();
function strictDivision(product){
  const worksheet=String(product?.worksheetDivision||'').trim();
  if(DIVISIONS.includes(worksheet))return worksheet;
  const primary=String(product?.primaryDivision||'').trim();
  if(DIVISIONS.includes(primary))return primary;
  return 'Unclassified';
}
async function strictifyPlan(plan){
  if(!plan)return plan;
  const products=Array.isArray(plan.products)?plan.products:await getAll('products');
  const byId=new Map(products.map(p=>[String(p.id),p]));
  const byCode=new Map(products.map(p=>[norm(p.code),p]));
  const productionByDivision={Casting:[],Packing:[],Resin:[],Painting:[],Unclassified:[]};
  for(const item of plan.productionItems||[]){
    const product=byId.get(String(item.productId||''))||byCode.get(norm(item.productCode));
    const division=strictDivision(product);
    productionByDivision[division].push({...item,manufacturingDivision:division});
  }
  return {...plan,products,productionByDivision,strictDivisionRouting:true};
}

/* Expose one shared normalizer for screen and print paths. */
window.VUStrictifyOperationsPlan=strictifyPlan;
window.VUStrictOperationsDivision={DIVISIONS,strictDivision,strictifyPlan,version:'9.0.55'};

/* Wrap the public planner for any later/current consumers. The underlying VUThreeStagePlan remains the base source. */
const basePlanner=window.VUThreeStagePlan||window.buildWorkflowForecast;
if(typeof basePlanner==='function'){
  window.buildWorkflowForecast=async function strictOperationsForecast(date){
    return strictifyPlan(await basePlanner(date));
  };
}
})();
