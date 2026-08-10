/* V9.0.35 — adds Painting as a manufacturing division for paint products.
   This is distinct from the Finishing & Painting workflow stage used to finish other products. */
(function(){
'use strict';
const system=window.VUManufacturingDivisions;
if(system?.DIVISIONS&&!system.DIVISIONS.includes('Painting'))system.DIVISIONS.push('Painting');

/* Add Painting to an already-open product form if this module loads while editing. */
function ensurePaintingControls(){
  const form=document.getElementById('productForm');
  if(!form)return;
  const primary=form.querySelector('#primaryDivision');
  const worksheet=form.querySelector('#worksheetDivision');
  const addOption=select=>{
    if(select&&![...select.options].some(o=>o.value==='Painting')){
      const option=document.createElement('option');option.value='Painting';option.textContent='Painting';select.appendChild(option);
    }
  };
  addOption(primary);addOption(worksheet);
  const methodBox=form.querySelector('.manufacturing-checks');
  if(methodBox&&!form.querySelector('[data-method="Painting"]')){
    const label=document.createElement('label');label.innerHTML='<input type="checkbox" data-method="Painting"> Painting';methodBox.appendChild(label);
    label.querySelector('input').addEventListener('change',()=>{
      const hidden=form.querySelector('#manufacturingMethods');if(hidden)hidden.value=[...form.querySelectorAll('[data-method]:checked')].map(x=>x.dataset.method).join('|');
    });
  }
  const stockBoxes=[...form.querySelectorAll('.manufacturing-checks')][1];
  if(stockBoxes&&!form.querySelector('[data-stock-division="Painting"]')){
    const label=document.createElement('label');label.innerHTML='<input type="checkbox" data-stock-division="Painting"> Painting';stockBoxes.appendChild(label);
    label.querySelector('input').addEventListener('change',()=>{
      const hidden=form.querySelector('#divisionStockVisibility');if(hidden)hidden.value=[...form.querySelectorAll('[data-stock-division]:checked')].map(x=>x.dataset.stockDivision).join('|');
    });
  }
}

const baseShow=window.showProductForm;
if(typeof baseShow==='function'){
  window.showProductForm=async function paintingAwareProductForm(...args){
    await baseShow(...args);ensurePaintingControls();
  };
  try{showProductForm=window.showProductForm}catch{}
}
ensurePaintingControls();
window.VUPaintingManufacturingDivision={name:'Painting'};
})();