/* Version 9.0.3 — central Vorster Unlimited factory operating calendar. */
(function(){
'use strict';
const dk=value=>{if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(value,days)=>{const d=value instanceof Date?new Date(value):new Date(`${dk(value)}T12:00:00`);d.setDate(d.getDate()+days);return d};
function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(year,month-1,day,12)}
function statutoryHolidays(year){
  const dates=new Set([`${year}-01-01`,`${year}-03-21`,`${year}-04-27`,`${year}-05-01`,`${year}-06-16`,`${year}-08-09`,`${year}-09-24`,`${year}-12-16`,`${year}-12-25`,`${year}-12-26`]);
  const easter=easterSunday(year);dates.add(dk(addDays(easter,-2)));dates.add(dk(addDays(easter,1)));
  for(const date of [...dates]){const d=new Date(`${date}T12:00:00`);if(d.getDay()===0)dates.add(dk(addDays(d,1)))}
  return dates;
}
function declaredHolidays(){try{const raw=JSON.parse(localStorage.getItem('vu-declared-public-holidays')||'[]');return new Set(Array.isArray(raw)?raw.map(dk):[])}catch{return new Set()}}
function closures(){try{const raw=JSON.parse(localStorage.getItem('vu-factory-closures')||'[]');return new Set(Array.isArray(raw)?raw.map(dk):[])}catch{return new Set()}}
function dayInfo(value){const date=dk(value),d=new Date(`${date}T12:00:00`),weekend=[0,6].includes(d.getDay()),holiday=statutoryHolidays(d.getFullYear()).has(date)||declaredHolidays().has(date),closure=closures().has(date);return{date,working:!weekend&&!holiday&&!closure,weekend,holiday,closure}}
function onOrAfter(value){let d=new Date(`${dk(value)}T12:00:00`);while(!dayInfo(d).working)d.setDate(d.getDate()+1);return dk(d)}
function next(value,steps=1){let d=new Date(`${dk(value)}T12:00:00`),moved=0;while(moved<steps){d.setDate(d.getDate()+1);if(dayInfo(d).working)moved++}return dk(d)}
function addClosure(date){const set=closures();set.add(dk(date));localStorage.setItem('vu-factory-closures',JSON.stringify([...set].sort()))}
function removeClosure(date){const set=closures();set.delete(dk(date));localStorage.setItem('vu-factory-closures',JSON.stringify([...set].sort()))}
window.VUFactoryCalendar={dateKey:dk,isWorkingDay:value=>dayInfo(value).working,dayInfo,onOrAfter,nextWorkingDay:next,publicHolidays:year=>[...new Set([...statutoryHolidays(Number(year)),...declaredHolidays()])].filter(x=>x.startsWith(`${year}-`)).sort(),closures:()=>[...closures()].sort(),addClosure,removeClosure};
})();