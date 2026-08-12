/* V9.0.92 — customer delivery-location picker.
   Adds explicit location search to the existing customer edit form, stores coordinates used by routing,
   and provides a no-key Google Maps search/verification action. */
(function(){
'use strict';
if(window.VUCustomerLocationPicker)return;
var lastSearchAt=0;
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
function field(form,name){return form&&form.querySelector('[name="'+name+'"]');}
function ensureHidden(form,name,value){var el=field(form,name);if(!el){el=document.createElement('input');el.type='hidden';el.name=name;form.appendChild(el);}if(value!=null)el.value=String(value);return el;}
function mapsSearchUrl(query){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(query||'').trim());}
async function searchPlaces(query){
  var q=String(query||'').trim();if(!q)throw new Error('Enter a customer name or delivery address first.');
  var wait=Math.max(0,1050-(Date.now()-lastSearchAt));if(wait)await new Promise(function(r){setTimeout(r,wait);});lastSearchAt=Date.now();
  var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=za&addressdetails=1&q='+encodeURIComponent(q);
  var response=await fetch(url,{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Location search failed ('+response.status+').');
  var rows=await response.json();return Array.isArray(rows)?rows:[];
}
function install(){
  var form=document.getElementById('customerForm');if(!form||form.dataset.locationPicker==='1')return;
  var address=field(form,'deliveryAddress');if(!address)return;form.dataset.locationPicker='1';
  var customerName=field(form,'name');
  var lat=ensureHidden(form,'deliveryLatitude',''),lon=ensureHidden(form,'deliveryLongitude',''),geoAddress=ensureHidden(form,'geocodedDeliveryAddress',''),geoAt=ensureHidden(form,'geocodedAt','');
  var wrap=document.createElement('div');wrap.className='customer-location-picker';wrap.innerHTML='<div class="customer-location-actions"><button type="button" class="secondary" data-location-find>⌖ Find location</button><button type="button" data-location-google>Google Maps</button></div><small class="muted">Search by customer name, business name or address. Selecting a result saves the exact coordinates used by delivery routing.</small><div class="customer-location-results" data-location-results></div>';
  address.closest('label').insertAdjacentElement('afterend',wrap);
  function query(){var a=String(address.value||'').trim(),n=String(customerName&&customerName.value||'').trim();return a||n;}
  address.addEventListener('input',function(){if(geoAddress.value&&address.value!==geoAddress.value){lat.value='';lon.value='';geoAddress.value='';geoAt.value='';}});
  wrap.querySelector('[data-location-google]').onclick=function(){var q=query();if(!q){alert('Enter the customer name or delivery address first.');return;}window.open(mapsSearchUrl(q),'_blank');};
  wrap.querySelector('[data-location-find]').onclick=async function(){
    var button=this,host=wrap.querySelector('[data-location-results]');button.disabled=true;host.innerHTML='<small class="muted">Searching locations…</small>';
    try{
      var rows=await searchPlaces(query());
      if(!rows.length){host.innerHTML='<div class="customer-location-empty">No matching locations found. Try the business name, suburb or street address.</div>';return;}
      host.innerHTML=rows.map(function(r,i){return '<button type="button" class="customer-location-result" data-location-index="'+i+'"><strong>'+safe((r.name||r.display_name||'Location').split(',')[0])+'</strong><small>'+safe(r.display_name||'')+'</small></button>';}).join('');
      var buttons=host.querySelectorAll('[data-location-index]');for(var i=0;i<buttons.length;i++)buttons[i].onclick=function(){var r=rows[Number(this.getAttribute('data-location-index'))];if(!r)return;address.value=r.display_name||'';lat.value=String(r.lat||'');lon.value=String(r.lon||'');geoAddress.value=address.value;geoAt.value=new Date().toISOString();host.innerHTML='<div class="customer-location-selected"><strong>✓ Location selected</strong><small>'+safe(address.value)+'</small><button type="button" data-location-verify>Verify in Google Maps</button></div>';var verify=host.querySelector('[data-location-verify]');if(verify)verify.onclick=function(){var coords=(lat.value&&lon.value)?lat.value+','+lon.value:address.value;window.open(mapsSearchUrl(coords),'_blank');};};
    }catch(e){console.error('Customer location search',e);host.innerHTML='<div class="customer-location-empty">'+safe(e&&e.message?e.message:'Location search failed.')+'</div>';}
    finally{button.disabled=false;}
  };
}
var style=document.createElement('style');style.id='vuCustomerLocationPickerStyles';style.textContent='.customer-location-picker{margin:-4px 0 14px}.customer-location-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px}.customer-location-actions button{min-height:44px}.customer-location-results{display:grid;gap:6px;margin-top:8px}.customer-location-result{width:100%;text-align:left;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}.customer-location-result strong,.customer-location-result small,.customer-location-selected strong,.customer-location-selected small{display:block}.customer-location-result small,.customer-location-selected small{margin-top:3px;color:var(--muted);line-height:1.35}.customer-location-selected,.customer-location-empty{padding:10px;border:1px solid var(--border);border-radius:12px}.customer-location-selected button{width:100%;margin-top:8px}@media(max-width:520px){.customer-location-actions{grid-template-columns:1fr}}';document.head.appendChild(style);
var base=window.showCustomerForm;if(typeof base==='function'){window.showCustomerForm=async function(){var r=await base.apply(this,arguments);install();return r;};try{showCustomerForm=window.showCustomerForm;}catch(e){}}
var observer=new MutationObserver(function(){if(document.getElementById('customerForm'))install();});observer.observe(document.getElementById('dialog')||document.body,{childList:true,subtree:true});
window.VUCustomerLocationPicker={version:'9.0.92',install:install,search:searchPlaces};
})();
