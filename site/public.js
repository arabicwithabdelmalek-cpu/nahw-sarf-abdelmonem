(()=>{
'use strict';
const $=id=>document.getElementById(id);
const cfg=window.NAHW_SARF_CONFIG||{};
const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const weekdays=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const ar=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]);
const parse=s=>new Date(s+'T12:00:00');
const fmt=s=>{const d=parse(s);return ar(d.getDate())+' '+months[d.getMonth()]+' '+ar(d.getFullYear())};
const day=s=>weekdays[parse(s).getDay()];
const cairoToday=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const pick=t=>parts.find(p=>p.type===t).value;return pick('year')+'-'+pick('month')+'-'+pick('day');};
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const mark=(value,classes)=>el('span',classes,value);
const displayedSubject=s=>s==='غير محدد'||!s?'لم تُحدّد':s;
const current={lessons:[]};
function render(items){
 const lessons=[...items].sort((a,b)=>a.position-b.position);
 current.lessons=lessons;
 const today=cairoToday();
 const next=lessons.find(l=>l.lesson_date>=today);
 const board=$('publicDates');board.replaceChildren();
 if(!lessons.length)board.append(el('p','no-lessons','لم تُعلن مواعيد المحاضرات بعد.'));
 lessons.forEach((l,i)=>{
  const row=el('article','lecture'+(l===next?' is-next':''));
  const number=el('span','number',ar(l.position||i+1));
  const when=el('div','when');
  when.append(el('strong','',day(l.lesson_date)+'، '+fmt(l.lesson_date)));
  if(l.title)when.append(el('small','',l.title));
  if(l.notes)when.append(el('small','lecture-notes',l.notes));
  const subject=el('span','topic '+(l.subject==='نحو'?'nahw':l.subject==='صرف'?'sarf':'undefined'),displayedSubject(l.subject));
  const time=el('span','time',l.start_time?'الساعة '+String(l.start_time).slice(0,5):'لم تُحدّد');
  const status=el('span','status'+(l===next?' next':l.lesson_date<today?' past':''),l===next?'القادمة':l.lesson_date<today?'انتهت':'قادمة');
  row.append(number,when,subject,time,status);board.append(row);
 });
 $('upcomingDate').textContent=next?fmt(next.lesson_date):'لا توجد محاضرات قادمة';
 $('upcomingSubject').textContent=next?displayedSubject(next.subject):'—';
 $('upcomingDay').textContent=next?day(next.lesson_date):'';
 $('upcomingTime').textContent=next&&next.start_time?'الساعة '+String(next.start_time).slice(0,5):'';
 $('upcomingNum').textContent=next?'المحاضرة '+ar(next.position||lessons.indexOf(next)+1)+' من '+ar(lessons.length):'تابع الموقع لمعرفة مواعيد الدورة القادمة';
 $('publicRange').textContent=lessons.length?fmt(lessons[0].lesson_date)+' — '+fmt(lessons[lessons.length-1].lesson_date):'ستظهر المواعيد بعد اعتمادها';
}
async function get(path){
 const url=cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+path;
 const response=await fetch(url,{headers:{apikey:cfg.supabasePublishableKey,Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw new Error('خطأ الاتصال '+response.status);
 return response.json();
}
async function refresh(){
 if(!/^https:\/\/[\w-]+\.supabase\.co$/.test(cfg.supabaseUrl||'')||!cfg.supabasePublishableKey){$('publicDates').replaceChildren(el('p','no-lessons','تعذّر الاتصال بالجدول.'));return;}
 try{
  const courses=await get('courses?select=id,title&is_active=eq.true&is_published=eq.true&limit=1');
  if(!courses.length){render([]);$('noticeBox').hidden=true;return;}
  const course=courses[0];
  const lessons=await get('lessons?select=id,position,lesson_date,subject,title,start_time,notes&course_id=eq.'+encodeURIComponent(course.id)+'&is_published=eq.true&order=position.asc');
  render(lessons);
  const announcements=await get('announcements?select=content&is_published=eq.true&order=created_at.desc&limit=1');
  if(announcements[0]?.content){$('noticeText').textContent=announcements[0].content;$('noticeBox').hidden=false;}
  else $('noticeBox').hidden=true;
 }catch(e){
  console.warn('Could not refresh timetable',e);
  if(!current.lessons.length)$('publicDates').replaceChildren(el('p','no-lessons','تعذّر تحميل المواعيد الآن. حدّث الصفحة وحاول مرة أخرى.'));
 }
}
refresh();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.setInterval(()=>{if(!document.hidden)refresh();},180000);
})();