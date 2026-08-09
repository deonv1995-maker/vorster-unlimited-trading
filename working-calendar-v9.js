/* Version 9.0.3 — South African factory working calendar. */
(function(){
'use strict';
const pad=v=>String(v).padStart(2,'0');
const key=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const d=v instanceof Date?new Date(v):new Date(v||Date.now());return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const date=k=>{const m=String(k).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12):new Date(k)};
function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day,12);
}
function addDays(d,days){const x=new Date(d);x.setDate(x.getDate()+days);return x}
function statutory(year){
  const rows=[
    [`${year}-01-01`,`New Year's Day`],[`${year}-03-21`,'Human Rights Day'],[`${year}-04-27`,'Freedom Day'],[`${year}-05-01`,"Workers' Day"],[`${year}-06-16`,'Youth Day'],[`${year}-08-09`,"National Women's Day"],[`${year}-09-24`,'Heritage Day'],[`${year}-12-16`,'Day of Reconciliation'],[`${year}-12-25`,'Christmas Day'],[`${year}-12-26`,'Day of Goodwill']
  ];
  const easter=easterSunday(year);rows.push([key(addDays(easter,-2)),'Good Friday'],[key(addDays(easter,1)),'Family Day']);
  const out=new Map(rows);
  for(const [k,name] of rows){const d=date(k);if(d.getDay()===0){const observed=key(addDays(d,1));if(!out.has(observed))out.set(observed,`${name} observed`);}}
  return out;
}
function customClosures(){try{return new Set(JSON.parse(localStorage.getItem('vu-factory-closures')||'[]').map(key))}catch{return new Set()}}
function holidayName(v){const k=key(v),d=date(k);return statutory(d.getFullYear()).get(k)||''}
function isFactoryWorkingDay(v){const k=key(v),d=date(k);return ![0,6].includes(d.getDay())&&!holidayName(k)&&!customClosures().has(k)}
function nextFactoryWorkingDay(v,{includeCurrent=false}={}){let d=date(key(v));if(!includeCurrent)d.setDate(d.getDate()+1);while(!isFactoryWorkingDay(d))d.setDate(d.getDate()+1);return key(d)}
function normaliseFactoryWorkingDay(v){const k=key(v);return isFactoryWorkingDay(k)?k:nextFactoryWorkingDay(k,{includeCurrent:true})}
function addFactoryWorkingDays(v,days){let k=normaliseFactoryWorkingDay(v);for(let i=0;i<Number(days||0);i++)k=nextFactoryWorkingDay(k);return k}
function reason(v){const k=key(v),d=date(k);if(d.getDay()===0)return'Sunday';if(d.getDay()===6)return'Saturday';return holidayName(k)|| (customClosures().has(k)?'Factory closure':'')}
window.VUWorkingCalendar={key,isFactoryWorkingDay,nextFactoryWorkingDay,normaliseFactoryWorkingDay,addFactoryWorkingDays,holidayName,reason,statutory};
})();