/* V9.0.97 — customer delivery-location picker.
   Google Maps is the preferred business finder. Supports saving Google Maps share links and extracting
   coordinates from full Maps URLs when present; OpenStreetMap remains an optional fallback search. */
(function(){
'use strict';
var lastSearchAt=0;
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
function field(form,name){return form&&form.querySelector('[name="'+name+'"]');}
function ensureHidden(form,name,value){var el=field(form,name);if(!el){el=document.createElement('input');el.type='hidden';el.name=name;form.appendChild(el);}if(value!=null&&!el.value)el.value=String(value);return el;}
function mapsSearchUrl(query){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(query||'').trim());}
function extractCoords(text){
  var s=String(text||'').trim(),m;
  m=s.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|z|\/|$)/);if(m)return{lat:m[1],lon:m[2]};
  m=s.match(/[?&](?:query|destination|center)=(-?\d{1,3}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i);if(m)return{lat:m[1],lon:m[2]};
  m=s.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);if(m)return{lat:m[1],lon:m[2]};
  return null;
}
function extractUrl(text){var m=String(text||'').match(/https?:\/\/[^\s]+/i);return m?m[0].replace(/[)>.,]+$/,''):'';}
function extractLabel(text){var s=String(text||'').trim(),u=extractUrl(s);if(u)s=s.replace(u,'').trim();return s.replace(/^[-–—\s]+|[-–—\s]+$/g,'');}
async function searchPlaces(query){
  var q=String(query||'').trim();if(!q)throw new Error('Enter a customer name or delivery address first.');
  var wait=Math.max(0,1050-(Date.now()-lastSearchAt));if(wait)await new Promise(function(r){setTimeout(r,wait);});lastSearchAt=Date.now();
  var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=za&addressdetails=1&q='+encodeURIComponent(q);
  var response=await fetch(url,{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Fallback location search failed ('+response.status+').');
  var rows=await response.json();return Array.isArray(rows)?rows:[];
}
function install(){
  var form=document.getElementById('customerForm');if(!form||form.dataset.locationPicker==='97')return;
  var address=field(form,'deliveryAddress');if(!address)return;form.dataset.locationPicker='97';
  var customerName=field(form,'name');
  var lat=ensureHidden(form,'deliveryLatitude',''),lon=ensureHidden(form,'deliveryLongitude',''),geoAddress=ensureHidden(form,'geocodedDeliveryAddress',''),geoAt=ensureHidden(form,'geocodedAt',''),mapsUrl=ensureHidden(form,'deliveryGoogleMapsUrl','');
  var old=form.querySelector('.customer-location-picker');if(old)old.remove();
  var wrap=document.createElement('div');wrap.className='customer-location-picker';
  wrap.innerHTML='<div class="customer-location-actions"><button type="button" class="primary" data-location-google>Google Maps</button><button type="button" class="secondary" data-location-find>Fallback search</button></div><small class="muted">For businesses, find the correct place in Google Maps. Then tap Share → Copy link and paste it below.</small><div class="customer-google-paste"><label>Google Maps share link or shared text<input type="text" inputmode="url" data-google-share placeholder="Paste Google Maps link here"></label><button type="button" class="secondary" data-google-save>Use Google Maps location</button></div><div class="customer-location-results" data-location-results></div>';
  address.closest('label').insertAdjacentElement('afterend',wrap);
  var shareInput=wrap.querySelector('[data-google-share]');if(mapsUrl.value)shareInput.value=mapsUrl.value;
  function query(){var a=String(address.value||'').trim(),n=String(customerName&&customerName.value||'').trim();return a||n;}
  address.addEventListener('input',function(){if(geoAddress.value&&address.value!==geoAddress.value){lat.value='';lon.value='';geoAddress.value='';geoAt.value='';}});
  wrap.querySelector('[data-location-google]').onclick=function(){var q=query();if(!q){alert('Enter the customer name or delivery address first.');return;}window.open(mapsSearchUrl(q),'_blank');};
  wrap.querySelector('[data-google-save]').onclick=function(){
    var host=wrap.querySelector('[data-location-results]'),text=String(shareInput.value||'').trim(),url=extractUrl(text)||text,label=extractLabel(text),coords=extractCoords(text)||extractCoords(url);
    if(!url||!/google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)){host.innerHTML='<div class="customer-location-empty">Paste the Google Maps Share → Copy link result here.</div>';return;}
    mapsUrl.value=url;
    if(label&&(!address.value||address.value===String(customerName&&customerName.value||'')))address.value=label;
    if(coords){lat.value=String(coords.lat);lon.value=String(coords.lon);geoAddress.value=address.value||label||'Google Maps location';geoAt.value=new Date().toISOString();host.innerHTML='<div class="customer-location-selected"><strong>✓ Google Maps coordinates saved</strong><small>'+safe(address.value||label||url)+'</small><small>Coordinates '+safe(coords.lat)+', '+safe(coords.lon)+'</small><button type="button" data-location-verify>Verify in Google Maps</button></div>';}
    else{host.innerHTML='<div class="customer-location-selected"><strong>✓ Google Maps link saved</strong><small>'+safe(url)+'</small><small>This is a Google short/share link, so the browser cannot read its coordinates directly. The exact Maps link is saved with the customer; use the business street address or fallback search to confirm route coordinates.</small><button type="button" data-location-verify>Open saved Google Maps location</button></div>';}
    var verify=host.querySelector('[data-location-verify]');if(verify)verify.onclick=function(){window.open(mapsUrl.value||mapsSearchUrl(address.value),'_blank');};
  };
  wrap.querySelector('[data-location-find]').onclick=async function(){
    var button=this,host=wrap.querySelector('[data-location-results]');button.disabled=true;host.innerHTML='<small class="muted">Searching fallback map data…</small>';
    try{
      var rows=await searchPlaces(query());
      if(!rows.length){host.innerHTML='<div class="customer-location-empty">Fallback search has no match. Use Google Maps above and save its share link.</div>';return;}
      host.innerHTML=rows.map(function(r,i){return '<button type="button" class="customer-location-result" data-location-index="'+i+'"><strong>'+safe((r.name||r.display_name||'Location').split(',')[0])+'</strong><small>'+safe(r.display_name||'')+'</small></button>';}).join('');
      var buttons=host.querySelectorAll('[data-location-index]');for(var i=0;i<buttons.length;i++)buttons[i].onclick=function(){var r=rows[Number(this.getAttribute('data-location-index'))];if(!r)return;address.value=r.display_name||'';lat.value=String(r.lat||'');lon.value=String(r.lon||'');geoAddress.value=address.value;geoAt.value=new Date().toISOString();host.innerHTML='<div class="customer-location-selected"><strong>✓ Route coordinates selected</strong><small>'+safe(address.value)+'</small><button type="button" data-location-verify>Verify in Google Maps</button></div>';var verify=host.querySelector('[data-location-verify]');if(verify)verify.onclick=function(){window.open(mapsSearchUrl(lat.value+','+lon.value),'_blank');};};
    }catch(e){console.error('Customer fallback location search',e);host.innerHTML='<div class="customer-location-empty">'+safe(e&&e.message?e.message:'Fallback location search failed.')+'</div>';}
    finally{button.disabled=false;}
  };
}
var style=document.getElementById('vuCustomerLocationPickerStyles')||document.createElement('style');style.id='vuCustomerLocationPickerStyles';style.textContent='.customer-location-picker{margin:-4px 0 14px}.customer-location-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px}.customer-location-actions button,.customer-google-paste button{min-height:44px}.customer-google-paste{display:grid;gap:8px;margin-top:10px}.customer-google-paste input{width:100%}.customer-location-results{display:grid;gap:6px;margin-top:8px}.customer-location-result{width:100%;text-align:left;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}.customer-location-result strong,.customer-location-result small,.customer-location-selected strong,.customer-location-selected small{display:block}.customer-location-result small,.customer-location-selected small{margin-top:3px;color:var(--muted);line-height:1.35}.customer-location-selected,.customer-location-empty{padding:10px;border:1px solid var(--border);border-radius:12px}.customer-location-selected button{width:100%;margin-top:8px}@media(max-width:520px){.customer-location-actions{grid-template-columns:1fr}}';if(!style.parentNode)document.head.appendChild(style);
var base=window.showCustomerForm;if(typeof base==='function'&&!base.__vuLocation97){var wrapped=async function(){var r=await base.apply(this,arguments);install();return r;};wrapped.__vuLocation97=true;window.showCustomerForm=wrapped;try{showCustomerForm=window.showCustomerForm;}catch(e){}}
var observer=new MutationObserver(function(){if(document.getElementById('customerForm'))install();});observer.observe(document.getElementById('dialog')||document.body,{childList:true,subtree:true});
window.VUCustomerLocationPicker={version:'9.0.97',install:install,search:searchPlaces,extractCoords:extractCoords};
})();
