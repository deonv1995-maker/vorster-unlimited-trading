/* V9.0.99 — resolves Google Maps share links and fills delivery address + coordinates automatically.
   Sends customer/business context to the resolver so short-link failures can fall back to a place search. */
(function(){
'use strict';
if(window.VUGoogleMapsResolverAuthority&&window.VUGoogleMapsResolverAuthority.version==='9.0.99')return;
const ENDPOINT='https://ccdmwcxcpszqdzoetqkc.supabase.co/functions/v1/google-maps-resolve';
const escHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
function field(form,name){return form&&form.querySelector('[name="'+name+'"]')}
function ensure(form,name){let el=field(form,name);if(!el){el=document.createElement('input');el.type='hidden';el.name=name;form.appendChild(el)}return el}
function extractUrl(text){const m=String(text||'').match(/https?:\/\/[^\s]+/i);return(m?m[0]:String(text||'').trim()).replace(/[)>.,]+$/,'')}
async function resolve(url,context={}){
  const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    url,
    customerName:String(context.customerName||'').trim(),
    deliveryAddress:String(context.deliveryAddress||'').trim(),
    physicalAddress:String(context.physicalAddress||'').trim()
  })});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||('Google Maps resolver failed ('+r.status+')'));
  return data
}
async function useGoogle(button){
  const form=document.getElementById('customerForm');if(!form)return;
  const wrap=button.closest('.customer-location-picker');if(!wrap)return;
  const input=wrap.querySelector('[data-google-share]'),host=wrap.querySelector('[data-location-results]'),address=field(form,'deliveryAddress'),customerName=field(form,'name'),physical=field(form,'physicalAddress');
  const lat=ensure(form,'deliveryLatitude'),lon=ensure(form,'deliveryLongitude'),geoAddress=ensure(form,'geocodedDeliveryAddress'),geoAt=ensure(form,'geocodedAt'),mapsUrl=ensure(form,'deliveryGoogleMapsUrl');
  const url=extractUrl(input&&input.value);if(!url){host.innerHTML='<div class="customer-location-empty">Paste a Google Maps share link first.</div>';return}
  const old=button.textContent;button.disabled=true;button.textContent='Resolving location…';host.innerHTML='<small class="muted">Opening Google Maps link and matching the customer location…</small>';
  try{
    const data=await resolve(url,{customerName:customerName&&customerName.value,deliveryAddress:address&&address.value,physicalAddress:physical&&physical.value});
    mapsUrl.value=data.finalUrl||url;lat.value=String(data.latitude||'');lon.value=String(data.longitude||'');geoAt.value=new Date().toISOString();
    if(data.address){address.value=String(data.address);geoAddress.value=String(data.address)}else geoAddress.value=address.value||'Google Maps location';
    host.innerHTML='<div class="customer-location-selected"><strong>✓ Delivery location filled automatically</strong><small>'+escHtml(address.value||'Google Maps location')+'</small><small>Coordinates '+escHtml(lat.value)+', '+escHtml(lon.value)+'</small>'+(data.method?'<small>Matched by '+escHtml(data.method)+'</small>':'')+'<button type="button" data-location-verify>Verify in Google Maps</button></div>';
    const verify=host.querySelector('[data-location-verify]');if(verify)verify.onclick=()=>window.open(mapsUrl.value,'_blank');
  }catch(e){console.error('Google Maps auto-fill',e);host.innerHTML='<div class="customer-location-empty">'+escHtml(e&&e.message?e.message:'Could not resolve Google Maps location.')+'</div>'}
  finally{button.disabled=false;button.textContent=old}
}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-google-save]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();useGoogle(b)},true);
window.VUGoogleMapsResolverAuthority={version:'9.0.99',resolve,useGoogle};
})();
