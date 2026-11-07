(()=>{
'use strict';
const $=id=>document.getElementById(id);
const cfg=window.NAHW_SARF_CONFIG||{};
const db=(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}):null;
const state={user:null,courses:[],courseId:null,lessons:[],enrollments:[],payments:[],teacherPayouts:[],fee:0,announcements:[]};
const e=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const n=v=>Number(v)||0;const money=v=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2}).format(n(v))+' ج.م';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const errorText=x=>x?.message||String(x||'خطأ غير متوقع');
function alertMsg(message,err=false){const box=$('alert');box.textContent=message;box.hidden=false;box.classList.toggle('error',err);window.scrollTo({top:0,behavior:'smooth'});}
async function execute(fn){try{await fn();}catch(err){console.error('Admin operation failed',err);alertMsg(errorText(err),true);}}
async function one(promise){const res=await promise;if(res.error)throw res.error;return res.data;}
const course=()=>{if(!state.courseId)throw new Error('يجب إنشاء دورة واختيارها أولًا.');return state.courseId;};
function record(parent,title,subtitle,actions=[]){let item=e('div','record'),left=e('div',''),right=e('div','record-actions');left.append(e('b','',title),e('small','',subtitle));for(const a of actions){let b=e('button','mini '+(a.danger?'danger':'outline'),a.label);b.type='button';b.addEventListener('click',()=>execute(a.action));right.append(b)}item.append(left,right);parent.append(item);}
function selectTab(tab){
 document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==tab);
 document.querySelectorAll('[data-tab]').forEach(p=>{p.classList.toggle('active',p.dataset.tab===tab);p.setAttribute('aria-current',p.dataset.tab===tab?'page':'false')});
 const names={lessons:'المحاضرات',students:'الطلاب',finance:'المدفوعات',reports:'التقارير المالية',courses:'الشهور',announcements:'الإعلانات'};
 document.querySelector('.page-title h1').textContent=names[tab]||'لوحة الإدارة';
 if(tab==='reports'&&state.user&&$('reportMonth').value)execute(loadFinancialReport);
}
function resetCourse(){['courseId','courseTitle','courseStart','courseDescription'].forEach(k=>$(k).value='');$('coursePublished').checked=false;$('courseActive').checked=false;$('courseForm').hidden=true;}
function resetLesson(){['lessonId','lessonDate','lessonTitle','lessonTime','lessonNotes'].forEach(k=>$(k).value='');$('lessonPosition').value=String(state.lessons.length+1);$('lessonSubject').value='غير محدد';$('lessonPublished').checked=false;$('lessonForm').hidden=true;}
function resetAnnouncement(){ $('announcementId').value='';$('announcementContent').value='';$('announcementPublished').checked=false;$('announcementForm').hidden=true;}
function resetStudent(){ $('studentId').value='';$('studentName').value='';$('studentContact').value='';$('studentSaveButton').textContent='حفظ الطالب';$('studentCancelButton').hidden=true;$('studentForm').hidden=true;}


const monthDateLabel=value=>{
 if(!value)return'شهر دراسي';
 const date=new Date(value+'T12:00:00');
 return Number.isNaN(date.getTime())?'شهر دراسي':
  'شهر '+new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
};
const niceDate=value=>{
 if(!value)return'لم يُحدّد';
 const date=new Date(value+'T12:00:00');
 return Number.isNaN(date.getTime())?'لم يُحدّد':
  new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
};
const nextSaturdayAfter=value=>{
 const d=new Date((value||today())+'T12:00:00');
 if(Number.isNaN(d.getTime()))return today();
 do{d.setDate(d.getDate()+1)}while(d.getDay()!==6);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const monthName=(c,overview)=>monthDateLabel(overview?.first_date||c.start_date)||c.title;
let monthsOverview=[];
let coursesLoadVersion=0;
function setMonthFormDefaults(){
 const summaries=monthsOverview.filter(x=>x.last_date).sort((a,b)=>b.last_date.localeCompare(a.last_date));
 const last=summaries[0]?.last_date||state.courses.find(x=>x.is_active)?.start_date||today();
 if(!$('newMonthStart').value)$('newMonthStart').value=nextSaturdayAfter(last);
 updateMonthDraftHint();
}
function updateMonthDraftHint(){
 const chosen=$('newMonthStart').value;
 const day=chosen?new Date(chosen+'T12:00:00').getDay():-1;
 const copy=$('newMonthCopyStudents').checked;
 const note=chosen&&[3,6].includes(day)?
  'المسودة: '+monthDateLabel(chosen)+'؛ أول محاضرة '+niceDate(chosen)+'. ':
  'اختر يوم السبت أو الأربعاء لأول محاضرة. ';
 $('monthCreationNote').textContent=note+
  (copy?'سيُنقل الطلاب النشطون فقط. ':'لن يُنسخ الطلاب. ')+
  'المدفوعات لا تنتقل بين الشهور، والشهر الحالي سيظل منشورًا حتى الاعتماد.';
}
function monthCard(c,overview){
 const current=Boolean(c.is_active),draft=!c.is_published||(!c.is_active&&Number(overview?.published_count||0)===0);
 const wrap=e('article','month-card'+(current?' month-card-current':''));
 const heading=e('div','month-card-heading');
 const names=e('div','month-card-names');
 names.append(e('h4','',monthName(c,overview)));
 if(c.title&&!c.title.startsWith('شهر '))names.append(e('p','',c.title));
 const status=e('span','month-status'+(current?' current':draft?' draft':' past'),current?'الشهر الحالي':draft?'مسودة':'شهر سابق');
 heading.append(names,status);
 wrap.append(heading);
 const dates=e('p','month-card-dates',
   'من '+niceDate(overview?.first_date||c.start_date)+
   (overview?.last_date?' إلى '+niceDate(overview.last_date):''));
 wrap.append(dates);
 const stats=e('div','month-card-stats');
 const metric=(label,value)=>{
  const box=e('div','month-card-stat');
  box.append(e('small','',label),e('strong','',value));
  stats.append(box);
 };
 metric('المحاضرات',String(overview?.lesson_count||0)+' من ٨');
 metric('الطلاب النشطون',String(overview?.active_students||0));
 metric('المحصل من الطلاب',money(overview?.collected||0));
 metric('المدفوع للدكتور',money(overview?.paid_to_teacher||0));
 wrap.append(stats);
 const actions=e('div','month-card-actions');
 const act=(label,fn,extra='')=>{
  const btn=e('button',extra||'outline',label);
  btn.type='button';
  btn.addEventListener('click',()=>execute(fn));
  actions.append(btn);
 };
 act('فتح المحاضرات',()=>openMonth(c.id,'lessons'));
 act('عرض المدفوعات',()=>openMonth(c.id,'finance'));
 if(!current)act('اعتماد كالشهر الحالي',()=>activateMonth(c.id),'month-activate');
 const edit=e('button','month-edit','إعدادات');
 edit.type='button';edit.addEventListener('click',()=>execute(async()=>{
  await openMonth(c.id,'courses');
  $('courseId').value=c.id;$('courseTitle').value=c.title;
  $('courseStart').value=c.start_date||'';$('courseDescription').value=c.description||'';
  $('coursePublished').checked=c.is_published;$('courseActive').checked=c.is_active;
  $('courseForm').hidden=false;$('courseForm').scrollIntoView({behavior:'smooth',block:'start'});
 }));
 actions.append(edit);
 wrap.append(actions);
 return wrap;
}
function closeCourseForms(){
 resetCourse();resetLesson();resetStudent();
 ['feeForm','paymentForm','teacherPayoutForm','announcementForm'].forEach(id=>{if($(id))$(id).hidden=true});
 if($('teacherPayoutId'))$('teacherPayoutId').value='';
 if($('paymentId'))closePaymentForm();
}
async function openMonth(id,tab='lessons'){
 if(state.courseId!==id){
  closeCourseForms();state.courseId=id;
  $('activeCourseSelect').value=id;
  await loadRelated();
 }
 selectTab(tab);
 window.scrollTo({top:0,behavior:'smooth'});
}
async function activateMonth(id){
 const chosen=state.courses.find(c=>c.id===id);
 if(!chosen)throw new Error('الشهر غير موجود');
 if(chosen.is_active)return;
 const existing=state.courses.find(c=>c.is_active);
 const label=monthName(chosen,monthsOverview.find(x=>x.course_id===id));
 const prev=existing?monthName(existing,monthsOverview.find(x=>x.course_id===existing.id)):'لا يوجد';
 if(!window.confirm('اعتماد '+label+' كشهر حالي؟\n\nسيُعرض جدوله للطلاب بدل '+prev+'، وسيبقى الشهر السابق وسجلاته محفوظين.'))return;
 await one(db.rpc('activate_monthly_course',{p_course_id:id}));
 closeCourseForms();state.courseId=id;
 await loadCourses();selectTab('lessons');
 alertMsg('تم اعتماد '+label+'، والجدول الجديد أصبح ظاهرًا للطلاب. جميع سجلات الشهور السابقة محفوظة.');
}
let creatingMonth=false;
async function createNewMonth(ev){
 ev.preventDefault();
 if(creatingMonth)return;
 const start=$('newMonthStart').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||![3,6].includes(new Date(start+'T12:00:00').getDay()))
  throw new Error('حدد يوم السبت أو الأربعاء لأول محاضرة.');
 if(!state.courses.length)throw new Error('أنشئ الدورة الأولى أولًا.');
 creatingMonth=true;$('createMonthButton').disabled=true;
 try{
  const id=await one(db.rpc('create_monthly_course',{
   p_start_date:start,p_copy_students:$('newMonthCopyStudents').checked
  }));
  if(!id)throw new Error('لم يتم إنشاء الشهر.');
  closeCourseForms();state.courseId=id;
  $('newMonthStart').value='';
  await loadCourses();
  selectTab('lessons');
  alertMsg('تم تجهيز '+monthDateLabel(start)+' كمسودة بثماني محاضرات. راجع مواد الدروس ومواعيدها، ثم اعتمد الشهر من قسم «الشهور» عندما تصبح جاهزًا. لم تُنقل أي مدفوعات.');
 }finally{
  creatingMonth=false;$('createMonthButton').disabled=false;
 }
}
async function loadCourses(){
 const version=++coursesLoadVersion;
 const [courses,overview]=await Promise.all([
  one(db.from('courses').select('*').order('start_date',{ascending:false})),
  one(db.rpc('get_monthly_overview'))
 ]);
 if(version!==coursesLoadVersion)return;
 state.courses=courses;
 monthsOverview=overview||[];
 const mapping=new Map(monthsOverview.map(x=>[x.course_id,x]));
 const list=$('coursesList'),picker=$('activeCourseSelect');
 list.replaceChildren();picker.replaceChildren();
 for(const c of courses){
  const summary=mapping.get(c.id);
  const label=monthName(c,summary);
  picker.append(new Option(label+(c.is_active?' — الحالي':!c.is_published?' — مسودة':' — سابق'),c.id));
  list.append(monthCard(c,summary));
 }
 const previous=courses.filter(c=>c.is_published&&!c.is_active).length;
 const drafts=courses.filter(c=>!c.is_active&&(!c.is_published||Number(mapping.get(c.id)?.published_count||0)===0)).length;
 $('monthIndexSummary').textContent=courses.length+' شهر/دورة • '+previous+' سابقة • '+drafts+' مسودة';
 if(!courses.length)list.append(e('p','subtle','لم تُنشأ شهور بعد.'));
 state.courseId=courses.some(c=>c.id===state.courseId)?state.courseId:(courses.find(c=>c.is_active)||courses[0]||{}).id||null;
 if(state.courseId)picker.value=state.courseId;
 syncReportMonthChoices();
 setMonthFormDefaults();
 await loadRelated();
}
async function saveCourse(ev){
 ev.preventDefault();
 const id=$('courseId').value,title=$('courseTitle').value.trim();
 if(!title)throw new Error('اكتب اسم الدورة.');
 const was=state.courses.find(c=>c.id===id);
 const wantsActive=$('courseActive').checked;
 const published=$('coursePublished').checked;
 if(!id&&wantsActive)throw new Error('أنشئ الدورة أولًا ثم جهّز محاضراتها قبل اعتمادها.');
 if(was?.is_active&&!wantsActive)throw new Error('لا يمكن إيقاف الشهر الحالي مباشرة. اعتمد شهرًا آخر أولًا.');
 if(was?.is_active&&!published)throw new Error('لا يمكن إخفاء الشهر الحالي قبل اعتماد شهر آخر.');
 const data={
  title,start_date:$('courseStart').value||null,
  description:$('courseDescription').value.trim(),is_published:published
 };
 const row=id?
  await one(db.from('courses').update(data).eq('id',id).select('id').single()):
  await one(db.from('courses').insert({...data,is_active:false}).select('id').single());
 if(wantsActive&&!was?.is_active){
  await one(db.rpc('activate_monthly_course',{p_course_id:row.id}));
 }
 state.courseId=row.id;
 resetCourse();await loadCourses();selectTab('courses');
 alertMsg('تم حفظ بيانات الدورة دون تغيير سجلات الشهور السابقة.');
}

let lessonsLoadVersion=0;
async function loadLessons(){
 const version=++lessonsLoadVersion,courseId=state.courseId;
 const list=$('lessonsList');
 if(!courseId){
  state.lessons=[];list.replaceChildren();$('scheduleGenerator').hidden=false;return;
 }
 const lessons=await one(db.from('lessons').select('*').eq('course_id',courseId).order('position'));
 if(version!==lessonsLoadVersion||state.courseId!==courseId)return;
 state.lessons=lessons;
 list.replaceChildren();
 $('scheduleGenerator').hidden=lessons.length>0;
 const seen=new Set();
 for(const l of lessons){
  if(seen.has(l.id))continue;seen.add(l.id);
  record(list,`المحاضرة ${l.position} — ${l.subject}`,`${l.lesson_date}${l.start_time?' • '+l.start_time.slice(0,5):''}${l.title?' • '+l.title:''} • ${l.is_published?'منشورة':'مخفية'}`,[
   {label:'تعديل',action:async()=>{
    $('lessonId').value=l.id;$('lessonPosition').value=l.position;
    $('lessonDate').value=l.lesson_date;$('lessonSubject').value=l.subject;
    $('lessonTitle').value=l.title||'';$('lessonTime').value=l.start_time?.slice(0,5)||'';
    $('lessonNotes').value=l.notes||'';$('lessonPublished').checked=l.is_published;
    $('lessonForm').hidden=false;
    $('lessonForm').scrollIntoView({behavior:'smooth',block:'start'});
    $('lessonDate').focus({preventScroll:true});
   }},
   {label:'حذف',danger:true,action:async()=>{
    if(!confirm('هل تريد حذف المحاضرة نهائيًا؟'))return;
    await one(db.from('lessons').delete().eq('id',l.id));
    await loadLessons();alertMsg('تم حذف المحاضرة.');
   }}
  ]);
 }
 if(!lessons.length)list.append(e('p','subtle','لا توجد محاضرات مسجلة لهذه الدورة.'));
}
async function saveLesson(ev){ev.preventDefault();let id=$('lessonId').value;const data={course_id:course(),position:n($('lessonPosition').value),lesson_date:$('lessonDate').value,subject:$('lessonSubject').value,title:$('lessonTitle').value.trim(),start_time:$('lessonTime').value||null,notes:$('lessonNotes').value.trim(),is_published:$('lessonPublished').checked};
 if(id)await one(db.from('lessons').update(data).eq('id',id));else await one(db.from('lessons').insert(data));resetLesson();await loadLessons();alertMsg('حُفظت المحاضرة.');}

async function generateLessons(){
 const id=course();
 if(state.lessons.length)throw new Error('توجد محاضرات في هذه الدورة بالفعل. لن يتم استبدالها أو تكرارها تلقائيًا.');
 const start=$('generateStart').value||$('courseStart').value||state.courses.find(c=>c.id===id)?.start_date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))throw new Error('حدّد تاريخ بداية الجدول.');
 const date=new Date(start+'T12:00:00');
 if(Number.isNaN(date.getTime()))throw new Error('تاريخ البداية غير صحيح.');
 const values=[];
 for(let i=0;values.length<8&&i<35;i++){
   if([3,6].includes(date.getDay())){
     const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
     values.push({course_id:id,position:values.length+1,lesson_date:`${y}-${m}-${d}`,subject:'غير محدد',is_published:false});
   }
   date.setDate(date.getDate()+1);
 }
 if(values.length!==8)throw new Error('لم نتمكن من تجهيز جميع المواعيد.');
 await one(db.from('lessons').insert(values));
 await loadLessons();resetLesson();
 alertMsg('تم إنشاء ٨ محاضرات غير منشورة. اختر نحو أو صرف وحدّد الساعة لكل محاضرة، ثم انشر ما تريد إظهاره للطلاب.');
}

let studentsLoadVersion=0;
async function archiveStudentEnrollment(ent){
 const student=ent.students||{};
 const name=student.full_name||'هذا الطالب';
 if(ent.deleted_at)throw new Error('الطالب محذوف بالفعل.');
 const answer=window.confirm('هل تريد حذف «'+name+'» من قائمة الطلاب والمدفوعات في هذه الدورة؟\n\nستظل الدفعات السابقة محفوظة في سجل المدفوعات، ويمكنك استعادة الطالب لاحقًا.');
 if(!answer)return;
 const changed=await one(db.from('enrollments').update({deleted_at:new Date().toISOString()}).eq('id',ent.id).eq('course_id',course()).is('deleted_at',null).select('id'));
 if(!changed?.length)throw new Error('تعذّر حذف الطالب. أعد تحميل الصفحة وحاول مرة أخرى.');
 resetStudent();
 await loadRelated();
 alertMsg('تم حذف «'+name+'» من قوائم الدورة، مع الاحتفاظ بكل الدفعات السابقة.');
}
async function restoreStudentEnrollment(ent){
 const student=ent.students||{};
 const changed=await one(db.from('enrollments').update({deleted_at:null}).eq('id',ent.id).eq('course_id',course()).select('id'));
 if(!changed?.length)throw new Error('تعذّرت استعادة الطالب.');
 await loadRelated();
 alertMsg('تمت استعادة «'+(student.full_name||'الطالب')+'» إلى قائمة الطلاب.');
}
async function loadStudents(){
 const version=++studentsLoadVersion;
 const courseId=state.courseId;
 const list=$('studentsList'),archivedList=$('deletedStudentsList');
 const archivedBox=$('deletedStudentsBox');
 const paymentStudent=$('paymentStudent');
 if(!courseId){
  state.enrollments=[];
  list.replaceChildren();archivedList.replaceChildren();
  archivedBox.hidden=true;paymentStudent.replaceChildren();
  return;
 }
 const rows=await one(db.from('enrollments').select('id,student_id,status,deleted_at,students(id,full_name,contact)').eq('course_id',courseId).order('created_at'));
 if(version!==studentsLoadVersion||state.courseId!==courseId)return;
 const seen=new Set();
 state.enrollments=rows.filter(ent=>{
  const key=ent.student_id||ent.id;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
 const visible=state.enrollments.filter(ent=>!ent.deleted_at);
 const archived=state.enrollments.filter(ent=>Boolean(ent.deleted_at));
 list.replaceChildren();
 for(const ent of visible){
  const student=ent.students||{};
  record(list,student.full_name||'طالب',`${student.contact||'بدون وسيلة تواصل'} • ${ent.status}`,[
   {label:'تعديل',action:async()=>{
    $('studentId').value=student.id;
    $('studentName').value=student.full_name;
    $('studentContact').value=student.contact||'';
    $('studentSaveButton').textContent='حفظ التعديل';
    $('studentCancelButton').hidden=false;
    selectTab('students');
    $('studentForm').hidden=false;
    $('studentForm').scrollIntoView({behavior:'smooth',block:'start'});
    $('studentName').focus({preventScroll:true});
   }},
   {label:ent.status==='نشط'?'إيقاف الاشتراك':'إعادة التنشيط',action:async()=>{
    await one(db.from('enrollments').update({status:ent.status==='نشط'?'متوقف':'نشط'}).eq('id',ent.id));
    await loadRelated();
   }},
   {label:'حذف الطالب',danger:true,action:async()=>archiveStudentEnrollment(ent)}
  ]);
 }
 if(!visible.length)list.append(e('p','subtle','لا يوجد طلاب في هذه الدورة.'));
 archivedList.replaceChildren();
 archivedBox.hidden=!archived.length;
 $('deletedStudentsCount').textContent=String(archived.length);
 for(const ent of archived){
  const student=ent.students||{};
  record(archivedList,student.full_name||'طالب','محذوف من قوائم الدورة • محفوظ في السجل المالي',[
   {label:'استعادة',action:async()=>restoreStudentEnrollment(ent)}
  ]);
 }
 paymentStudent.replaceChildren();
 for(const ent of visible.filter(x=>x.status==='نشط'))
  paymentStudent.append(new Option(ent.students?.full_name||'طالب',ent.id));
}
async function saveStudent(ev){ev.preventDefault();const name=$('studentName').value.trim(),contact=$('studentContact').value.trim(),oldId=$('studentId').value;if(!name)throw new Error('اكتب اسم الطالب.');course();
 if(oldId){await one(db.from('students').update({full_name:name,contact}).eq('id',oldId));}
 else {
  // Never merge two different people merely because their names match.
  const studentId=(await one(db.from('students').insert({full_name:name,contact}).select('id').single())).id;
  await one(db.from('enrollments').insert({course_id:state.courseId,student_id:studentId,status:'نشط'}));
 }
 resetStudent();await loadRelated();alertMsg('تم حفظ بيانات الطالب.');
}
const cents=v=>Math.round(n(v)*100);
let paymentFormCourseId=null;
function closePaymentForm(){
 $('paymentForm').hidden=true;
 $('paymentId').value='';
 $('paymentFormTitle').textContent='تسجيل دفعة';
 $('paymentSaveButton').textContent='حفظ الدفعة';
 paymentFormCourseId=null;
}
function showPaymentForm(enrollmentId='',amount=0,payment=null){
 if(!state.courseId)throw new Error('اختر دورة أولًا.');
 const picker=$('paymentStudent');
 // Rebuild choices so archived students inserted for editing never remain in a new-payment form.
 picker.replaceChildren();
 for(const ent of state.enrollments.filter(x=>!x.deleted_at&&x.status==='نشط')){
  picker.append(new Option(ent.students?.full_name||'طالب',ent.id));
 }
 if(!payment&&!picker.options.length)throw new Error('أضف طالبًا نشطًا إلى الدورة أولًا.');
 closePaymentForm();
 paymentFormCourseId=state.courseId;
 $('paymentForm').hidden=false;
 if(payment){
  // The original student may now be stopped/archived: still allow correcting the historical receipt.
  const ent=state.enrollments.find(x=>x.id===payment.enrollment_id);
  if(!ent)throw new Error('دفعة تخص اشتراكًا غير موجود في الشهر الحالي.');
  if(![...picker.options].some(x=>x.value===payment.enrollment_id)){
   picker.append(new Option((ent.students?.full_name||'طالب')+' — اشتراك سابق',payment.enrollment_id));
  }
  picker.value=payment.enrollment_id;
  $('paymentId').value=payment.id;
  $('paymentFormTitle').textContent='تعديل دفعة سابقة';
  $('paymentSaveButton').textContent='حفظ التعديل';
  $('paymentAmount').value=Number(payment.amount).toFixed(2);
  $('paymentDate').value=payment.paid_on||today();
  $('paymentNotes').value=payment.notes||'';
 }else{
  if(enrollmentId&&[...picker.options].some(x=>x.value===enrollmentId))picker.value=enrollmentId;
  else picker.selectedIndex=0;
  $('paymentAmount').value=amount>0?Number((amount/100).toFixed(2)).toFixed(2):'';
  $('paymentDate').value=today();
  $('paymentNotes').value='';
 }
 $('paymentForm').scrollIntoView({behavior:'smooth',block:'start'});
 $('paymentAmount').focus({preventScroll:true});
}

/* Presentation-only grouping: every installment remains a separate database receipt. */
function groupPaymentsByStudent(payments,enrollments){
 const enrollmentsById=new Map(enrollments.map(ent=>[ent.id,ent]));
 const groups=new Map();
 for(const payment of payments){
  const key=payment.enrollment_id;
  if(!groups.has(key)){
   groups.set(key,{enrollmentId:key,enrollment:enrollmentsById.get(key)||null,
      totalCents:0,installments:[]});
  }
  const group=groups.get(key);
  group.totalCents+=cents(payment.amount);
  group.installments.push(payment);
 }
 return [...groups.values()];
}
function renderGroupedStudentPayments(history,payments,enrollments){
 const groups=groupPaymentsByStudent(payments,enrollments);
 $('paymentHistoryCount').textContent=groups.length?
  groups.length+' طلاب • '+payments.length+' دفعات':'٠';
 history.replaceChildren();
 if(!groups.length){
  history.append(e('p','subtle','لا توجد دفعات مسجلة بعد.'));
  return;
 }
 const headerRow=e('div','student-payment-list-header');
 for(const label of ['الطالب','الإجمالي المدفوع','عدد الدفعات','آخر دفعة',''])headerRow.append(e('span','',label));
 history.append(headerRow);
 for(const group of groups){
  const ent=group.enrollment;
  const fullName=ent?.students?.full_name||'طالب (سجل سابق)';
  const count=group.installments.length;
  const countLabel=count===1?'دفعة واحدة':count===2?'دفعتان':count+' دفعات';
  const lastDate=group.installments.reduce((v,p)=>p.paid_on&&p.paid_on>v?p.paid_on:v,'');
  const lastLabel=lastDate?niceDate(lastDate):'غير محدد';
  const card=e('details','student-payment-group');
  const header=e('summary','student-payment-heading');
  const person=e('span','student-payment-person',fullName);
  const total=e('strong','student-payment-total',money(group.totalCents/100));
  const installments=e('span','student-payment-count',countLabel);
  const latest=e('span','student-payment-date',lastLabel);
  const more=e('span','student-payment-more','عرض الدفعات');
  const mobileMeta=e('span','student-payment-meta',countLabel+' • آخر دفعة: '+lastLabel);
  header.append(person,total,installments,latest,more,mobileMeta);
  const list=e('div','student-payment-installments');
  for(const p of group.installments){
   const line=e('div','student-payment-installment');
   const info=e('div','student-payment-installment-info');
   info.append(e('b','',money(p.amount)),e('time','',p.paid_on||'بدون تاريخ'));
   if(p.notes)info.append(e('small','',p.notes));
   const controls=e('div','student-payment-installment-actions');
   const edit=e('button','outline','تعديل');
   edit.type='button';edit.addEventListener('click',()=>execute(async()=>{
    showPaymentForm(p.enrollment_id,0,p);
   }));
   const remove=e('button','danger','حذف');
   remove.type='button';remove.addEventListener('click',()=>execute(async()=>{
    if(!window.confirm('هل تريد حذف دفعة '+money(p.amount)+' الخاصة بـ'+fullName+' بتاريخ '+p.paid_on+'؟\nسيُعاد حساب إجمالي الطالب والمتبقي تلقائيًا.'))return;
    const rows=await one(db.from('payments').delete().eq('id',p.id).eq('enrollment_id',p.enrollment_id).select('id'));
    if(!rows?.length)throw new Error('تعذّر حذف الدفعة. حدّث الصفحة وحاول مرة أخرى.');
    await loadFinance();alertMsg('تم حذف الدفعة وإعادة حساب إجمالي الطالب.');
   }));
   controls.append(edit,remove);line.append(info,controls);list.append(line);
  }
  if(ent&&!ent.deleted_at&&ent.status==='نشط'){
   const newPay=e('button','outline student-payment-add','+ تسجيل دفعة جديدة لهذا الطالب');
   newPay.type='button';
   newPay.addEventListener('click',()=>execute(async()=>showPaymentForm(ent.id)));
   list.append(newPay);
  }
  card.append(header,list);
  history.append(card);
 }
}

let financeLoadVersion=0;
async function loadFinance(){
 const version=++financeLoadVersion,courseId=state.courseId;
 const summary=$('financeSummary'),history=$('paymentsList'),balances=$('studentBalances');
 if(!courseId){
  state.payments=[];state.teacherPayouts=[];state.fee=0;
  summary.replaceChildren();history.replaceChildren();balances.replaceChildren();
  $('teacherPayoutSummary').replaceChildren();$('teacherPayoutList').replaceChildren();
  $('teacherPayoutStatus').textContent='';$('teacherPayoutCount').textContent='٠';
  $('paymentHistoryCount').textContent='0';return;
 }
 // Take an immutable snapshot, and reject results from an obsolete load.
 const enrollments=[...state.enrollments];
 const finance=await one(db.from('course_finances').select('total_fee').eq('course_id',courseId).maybeSingle());
 const ids=enrollments.map(x=>x.id);
 const payments=ids.length?await one(db.from('payments').select('*').in('enrollment_id',ids).order('paid_on',{ascending:false})):[];
 const teacherPayouts=await one(db.from('teacher_payouts').select('id,course_id,amount,paid_on,notes,created_at').eq('course_id',courseId).order('paid_on',{ascending:false}).order('created_at',{ascending:false}));
 if(version!==financeLoadVersion||state.courseId!==courseId)return;
 const fee=n(finance?.total_fee);
 state.payments=payments;state.teacherPayouts=teacherPayouts;state.fee=fee;
 $('totalFee').value=fee;
 summary.replaceChildren();history.replaceChildren();balances.replaceChildren();
 const active=enrollments.filter(x=>x.status==='نشط'&&!x.deleted_at);
 const totalCents=cents(fee);
 const base=active.length?Math.floor(totalCents/active.length):0;
 const remainder=active.length?totalCents%active.length:0;
 const shareFor=i=>base+(i<remainder?1:0);
 const paidFor=id=>payments.filter(p=>p.enrollment_id===id).reduce((v,p)=>v+cents(p.amount),0);
 const collected=payments.reduce((v,p)=>v+cents(p.amount),0);
 const outstanding=active.reduce((v,ent,i)=>v+Math.max(0,shareFor(i)-paidFor(ent.id)),0);
 const shareLabel=!active.length?'—':remainder?money(base/100)+' – '+money((base+1)/100):money(base/100);
 const stats=[
  {label:'إجمالي الدورة',value:money(totalCents/100),className:''},
  {label:'نصيب الطالب',value:shareLabel,className:''},
  {label:'إجمالي المدفوع',value:money(collected/100),className:'earned'},
  {label:'المتبقي',value:money(outstanding/100),className:'remaining'}
 ];
 for(const stat of stats){
  const card=e('div','finance-card'+(stat.className?' '+stat.className:''));
  card.append(e('span','',stat.label),e('strong','',stat.value));
  summary.append(card);
 }
 if(!active.length)balances.append(e('p','balance-empty','لا يوجد طلاب نشطون في هذه الدورة.'));
 else{
  for(const [i,ent] of active.entries()){
   const share=shareFor(i),paid=paidFor(ent.id),due=Math.max(0,share-paid);
   const full=totalCents>0&&due===0,part=paid>0&&due>0;
   const row=e('article','balance-row'+(full?' paid':''));
   const person=e('div','balance-person');
   person.append(e('b','',ent.students?.full_name||'طالب'));
   const label=e('span','balance-status '+(full?'paid':part?'part':''),totalCents===0?'لم تُحدّد التكلفة':full?'مدفوع بالكامل':part?'مدفوع جزئيًا':'لم يدفع');
   person.append(label);
   const details=e('div','balance-detail');
   const amounts=e('div','balance-amounts');
   const expected=e('span','','المطلوب: ');expected.append(e('b','',money(share/100)));
   const actual=e('span','','المدفوع: ');actual.append(e('b','',money(paid/100)));
   const rem=e('span','','المتبقي: ');rem.append(e('b','',money(due/100)));
   amounts.append(expected,actual,rem);details.append(amounts);
   const track=e('div','balance-track');const fill=e('span','');
   fill.style.width=share>0?Math.min(100,Math.max(0,paid/share*100))+'%':'0%';
   track.append(fill);details.append(track);
   const action=e('div','balance-action');
   const add=e('button','outline','تسجيل دفعة');add.type='button';
   add.addEventListener('click',()=>execute(async()=>showPaymentForm(ent.id,due)));
   const remove=e('button','danger','حذف الطالب');remove.type='button';
   remove.addEventListener('click',()=>execute(()=>archiveStudentEnrollment(ent)));
   action.append(add,remove);row.append(person,details,action);balances.append(row);
  }
 }
 renderGroupedStudentPayments(history,payments,enrollments);
 renderTeacherPayouts(teacherPayouts,fee);
}
function renderTeacherPayouts(payouts,fee){
 const summary=$('teacherPayoutSummary'),history=$('teacherPayoutList');
 summary.replaceChildren();history.replaceChildren();
 const paidCents=payouts.reduce((total,p)=>total+cents(p.amount),0);
 const expectedCents=cents(fee);
 const dueCents=Math.max(0,expectedCents-paidCents);
 const extraCents=Math.max(0,paidCents-expectedCents);
 const metrics=[
  {label:'إجمالي مستحقات الدكتور',value:money(expectedCents/100)},
  {label:'دُفع للدكتور',value:money(paidCents/100)},
  {label:extraCents>0?'المدفوع زيادة':'المتبقي للدكتور',value:money((extraCents||dueCents)/100)}
 ];
 metrics.forEach((item,i)=>{
  const card=e('div','teacher-payout-metric'+(i===1?' paid':i===2?' due':''));
  card.append(e('span','',item.label),e('strong','',item.value));
  summary.append(card);
 });
 $('teacherPayoutCount').textContent=String(payouts.length);
 $('teacherPayoutStatus').textContent=!payouts.length?
  'لم تُسجّل أي دفعة للدكتور في هذه الدورة بعد.':
  extraCents>0?'تنبيه: المبلغ المدفوع للدكتور يتجاوز إجمالي تكلفة الدورة.':
  dueCents===0?'تم تسجيل سداد إجمالي مستحقات الدكتور.':
  'هذا السجل خاص بما دُفع للدكتور، وهو مستقل عن مدفوعات الطلاب.';
 if(!payouts.length){
  history.append(e('p','subtle','لا توجد دفعات للدكتور بعد.'));
  return;
 }
 for(const payout of payouts){
  record(history,money(payout.amount),payout.paid_on+(payout.notes?' • '+payout.notes:''),[
   {label:'تعديل',action:async()=>openTeacherPayoutForm(payout)},
   {label:'حذف',danger:true,action:async()=>deleteTeacherPayout(payout)}
  ]);
 }
}
function resetTeacherPayoutForm(){
 $('teacherPayoutForm').reset();
 $('teacherPayoutId').value='';
 $('teacherPayoutDate').value=today();
 $('teacherPayoutFormTitle').textContent='تسجيل دفعة للدكتور';
 $('teacherPayoutSave').textContent='حفظ الدفعة';
 $('teacherPayoutForm').hidden=true;
}
function openTeacherPayoutForm(payout=null){
 if(!state.courseId)throw new Error('اختر دورة أولًا.');
 resetTeacherPayoutForm();
 if(payout){
  $('teacherPayoutId').value=payout.id;
  $('teacherPayoutAmount').value=Number(payout.amount).toFixed(2);
  $('teacherPayoutDate').value=payout.paid_on;
  $('teacherPayoutNotes').value=payout.notes||'';
  $('teacherPayoutFormTitle').textContent='تعديل دفعة للدكتور';
  $('teacherPayoutSave').textContent='حفظ التعديل';
 }
 $('teacherPayoutForm').hidden=false;
 $('teacherPayoutForm').scrollIntoView({behavior:'smooth',block:'start'});
 $('teacherPayoutAmount').focus({preventScroll:true});
}
let teacherPayoutSaving=false;
async function saveTeacherPayout(ev){
 ev.preventDefault();
 if(teacherPayoutSaving)return;
 const courseId=course();
 const amount=Number($('teacherPayoutAmount').value);
 if(!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)/100-amount)>1e-8)
  throw new Error('أدخل مبلغًا صحيحًا بالجنيه، أكبر من صفر وبحد أقصى خانتين عشريتين.');
 const paidOn=$('teacherPayoutDate').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(paidOn))throw new Error('حدّد تاريخ الدفع.');
 const oldId=$('teacherPayoutId').value;
 const data={course_id:courseId,amount,paid_on:paidOn,notes:$('teacherPayoutNotes').value.trim()};
 teacherPayoutSaving=true;
 $('teacherPayoutSave').disabled=true;
 try{
  const result=oldId?
   await one(db.from('teacher_payouts').update(data).eq('id',oldId).eq('course_id',courseId).select('id')):
   await one(db.from('teacher_payouts').insert(data).select('id'));
  if(!result?.length)throw new Error('تعذّر حفظ الدفعة. أعد تحميل القسم وحاول مرة أخرى.');
  resetTeacherPayoutForm();
  await loadFinance();
  alertMsg(oldId?'تم تعديل دفعة الدكتور.':'تم تسجيل ما دُفع للدكتور بنجاح.');
 }finally{
  teacherPayoutSaving=false;
  $('teacherPayoutSave').disabled=false;
 }
}
async function deleteTeacherPayout(payout){
 if(!window.confirm('هل تريد حذف دفعة '+money(payout.amount)+' للدكتور بتاريخ '+payout.paid_on+'؟\nلن يؤثر هذا على دفعات الطلاب.'))return;
 const rows=await one(db.from('teacher_payouts').delete().eq('id',payout.id).eq('course_id',course()).select('id'));
 if(!rows?.length)throw new Error('لم يتم حذف الدفعة. ربما حُذفت بالفعل.');
 await loadFinance();alertMsg('تم حذف دفعة الدكتور من سجله.');
}

async function saveFee(ev){
 ev.preventDefault();
 await one(db.from('course_finances').upsert({course_id:course(),total_fee:n($('totalFee').value)},{onConflict:'course_id'}));
 $('feeForm').hidden=true;await loadFinance();alertMsg('تم تحديث تكلفة الدورة.');
}
let studentPaymentSaving=false;
async function savePayment(ev){
 ev.preventDefault();
 if(studentPaymentSaving)return;
 const courseId=course();
 if(!paymentFormCourseId||paymentFormCourseId!==courseId)
  throw new Error('تغير الشهر أثناء تعديل الدفعة. افتح النموذج مرة أخرى.');
 const enrollmentId=$('paymentStudent').value;
 const ent=state.enrollments.find(x=>x.id===enrollmentId);
 if(!ent)throw new Error('اختر طالبًا مسجلًا في هذا الشهر.');
 const amount=Number($('paymentAmount').value);
 if(!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)/100-amount)>1e-8)
  throw new Error('أدخل مبلغًا أكبر من صفر وبحد أقصى خانتين عشريتين.');
 const date=$('paymentDate').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime()))
  throw new Error('حدّد تاريخًا صحيحًا للدفعة.');
 const editId=$('paymentId').value;
 const old=editId?state.payments.find(x=>x.id===editId):null;
 if(editId&&!old)throw new Error('تعذّر العثور على الدفعة الأصلية في هذا الشهر. حدّث الصفحة.');
 if((ent.deleted_at||ent.status!=='نشط')&&(!old||enrollmentId!==old.enrollment_id))
  throw new Error('يمكن تصحيح دفعة الطالب السابق، ولكن لا يمكن إضافة دفعة جديدة لاشتراك متوقف أو مؤرشف.');
 const data={enrollment_id:enrollmentId,amount,paid_on:date,notes:$('paymentNotes').value.trim()};
 studentPaymentSaving=true;
 $('paymentSaveButton').disabled=true;
 try{
  const rows=old?
   await one(db.from('payments').update(data).eq('id',old.id).eq('enrollment_id',old.enrollment_id).select('id')):
   await one(db.from('payments').insert(data).select('id'));
  if(!rows?.length)throw new Error('لم تُحفظ الدفعة. ربما جرى تعديلها من جهاز آخر.');
  closePaymentForm();$('paymentAmount').value='';$('paymentNotes').value='';
  await loadFinance();
  alertMsg(old?'تم تعديل الدفعة وحساب الإجماليات تلقائيًا.':'تم تسجيل الدفعة وإضافتها إلى إجمالي مدفوعات الطالب.');
 }finally{
  studentPaymentSaving=false;$('paymentSaveButton').disabled=false;
 }
}


/* Read-only month financial reporting. Uses existing RLS-protected tables and
   the same active-student share calculation as the finance tab. */
let reportLoadVersion=0;
let currentReport=null;
function reportStatus(message,error=false){
 const node=$('reportStatus');
 node.textContent=message;node.classList.toggle('error',Boolean(error));
}
function syncReportMonthChoices(){
 const picker=$('reportMonth');
 const previous=picker.value;
 picker.replaceChildren();
 for(const c of state.courses){
  const summary=monthsOverview.find(x=>x.course_id===c.id);
  picker.append(new Option(monthName(c,summary)+(c.is_active?' — الحالي':''),c.id));
 }
 const valid=id=>state.courses.some(c=>c.id===id);
 picker.value=valid(previous)?previous:(valid(state.courseId)?state.courseId:state.courses.find(c=>c.is_active)?.id||state.courses[0]?.id||'');
 if(currentReport&&!valid(currentReport.courseId)){
  currentReport=null;$('reportContent').hidden=true;
  $('reportExportExcel').disabled=true;$('reportPrint').disabled=true;
 }
}
function reportDataModel(courseRow,summary,enrollments,payments,teacher,fee){
 const active=enrollments.filter(ent=>ent.status==='نشط'&&!ent.deleted_at);
 const total=cents(fee);
 const base=active.length?Math.floor(total/active.length):0;
 const remainder=active.length?total%active.length:0;
 const shareFor=i=>base+(i<remainder?1:0);
 const activeOrder=new Map(active.map((ent,i)=>[ent.id,i]));
 const byId=new Map(enrollments.map(ent=>[ent.id,ent]));
 const paidByEnrollment=new Map();
 for(const p of payments)paidByEnrollment.set(p.enrollment_id,(paidByEnrollment.get(p.enrollment_id)||0)+cents(p.amount));
 const students=enrollments.map(ent=>{
  const enabled=activeOrder.has(ent.id);
  const expectedCents=enabled?shareFor(activeOrder.get(ent.id)):null;
  const paidCents=paidByEnrollment.get(ent.id)||0;
  const dueCents=expectedCents===null?null:Math.max(0,expectedCents-paidCents);
  const enrollmentStatus=ent.deleted_at?'مؤرشف':ent.status==='نشط'?'نشط':'متوقف';
  const paymentStatus=expectedCents===null?'خارج الحساب الحالي':
   total===0?'بدون تكلفة محددة':paidCents>expectedCents?'دفع زيادة':
   dueCents===0?'مدفوع بالكامل':paidCents>0?'مدفوع جزئيًا':'لم يدفع';
  return {
   name:ent.students?.full_name||'طالب',contact:ent.students?.contact||'—',
   enrollmentStatus,paymentStatus,expected:expectedCents===null?null:expectedCents/100,
   paid:paidCents/100,due:dueCents===null?null:dueCents/100
  };
 });
 const collectedCents=payments.reduce((sum,p)=>sum+cents(p.amount),0);
 const teacherPaidCents=teacher.reduce((sum,p)=>sum+cents(p.amount),0);
 const studentOutstandingCents=students.reduce((sum,x)=>sum+cents(x.due),0);
 const label=monthName(courseRow,summary);
 const from=summary?.first_date||courseRow.start_date;
 const to=summary?.last_date;
 const range=from?(to?'من '+niceDate(from)+' إلى '+niceDate(to):'بدءًا من '+niceDate(from)):'غير محددة';
 const paymentRows=payments.map(p=>{
  const ent=byId.get(p.enrollment_id);
  return {
   date:p.paid_on||'',student:ent?.students?.full_name||'طالب (سجل سابق)',
   amount:Number(p.amount)||0,notes:p.notes||'—'
  };
 });
 const teacherRows=teacher.map(p=>({date:p.paid_on||'',amount:Number(p.amount)||0,notes:p.notes||'—'}));
 return{
  courseId:courseRow.id,courseTitle:label,range,
  fee:total/100,activeCount:active.length,
  shareLabel:active.length?(remainder?money(base/100)+' – '+money((base+1)/100):money(base/100)):'—',
  collected:collectedCents/100,studentOutstanding:studentOutstandingCents/100,
  teacherPaid:teacherPaidCents/100,
  teacherRemaining:Math.max(0,total-teacherPaidCents)/100,
  teacherOverpaid:Math.max(0,teacherPaidCents-total)/100,
  cashBalance:(collectedCents-teacherPaidCents)/100,
  students,payments:paymentRows,teacherPayouts:teacherRows
 };
}
function reportTableBody(id,rows,format){
 const body=$(id);body.replaceChildren();
 if(!rows.length){
  const tr=e('tr'),cell=e('td','report-empty','لا توجد بيانات مسجلة لهذا الشهر.');
  cell.colSpan=id==='reportStudentRows'?5:id==='reportPaymentRows'?4:3;
  tr.append(cell);body.append(tr);return;
 }
 for(const row of rows){
  const tr=e('tr');
  for(const [value,cls] of format(row)){
   tr.append(e('td',cls||'',value===undefined||value===null?'—':String(value)));
  }
  body.append(tr);
 }
}
function renderFinancialReport(report){
 $('reportTitle').textContent='التقرير المالي — '+report.courseTitle;
 $('reportRange').textContent=report.range;
 const summary=$('reportSummary');summary.replaceChildren();
 const metrics=[
  {title:'إجمالي تكلفة الشهر',value:money(report.fee)},
  {title:'الطلاب النشطون / نصيب الطالب',value:report.activeCount+' • '+report.shareLabel},
  {title:'المحصّل من الطلاب',value:money(report.collected),kind:'paid'},
  {title:'المتبقي على الطلاب',value:money(report.studentOutstanding),kind:'due'},
  {title:'المدفوع للدكتور',value:money(report.teacherPaid),kind:'paid'},
  {title:report.teacherOverpaid?'دُفع للدكتور زيادة':'المتبقي للدكتور',
   value:money(report.teacherOverpaid||report.teacherRemaining),kind:'due'}
 ];
 for(const x of metrics){
  const card=e('div','report-metric '+(x.kind||''));
  card.append(e('small','',x.title),e('strong','',x.value));
  summary.append(card);
 }
 $('reportStudentCount').textContent=report.students.length+' طالب';
 $('reportPaymentCount').textContent=report.payments.length+' دفعة';
 $('reportTeacherCount').textContent=report.teacherPayouts.length+' دفعة';
 reportTableBody('reportStudentRows',report.students,row=>[
  [row.name,'report-name'],
  [row.enrollmentStatus+' — '+row.paymentStatus,''],
  [row.expected===null?'—':money(row.expected),'money'],
  [money(row.paid),'money'],
  [row.due===null?'—':money(row.due),'money']
 ]);
 reportTableBody('reportPaymentRows',report.payments,row=>[
  [row.date,''],[row.student,'report-name'],[money(row.amount),'money'],[row.notes,'']
 ]);
 reportTableBody('reportTeacherRows',report.teacherPayouts,row=>[
  [row.date,''],[money(row.amount),'money'],[row.notes,'']
 ]);
 $('reportContent').hidden=false;
 $('reportExportExcel').disabled=false;$('reportPrint').disabled=false;
 reportStatus('تقرير '+report.courseTitle+' جاهز — البيانات للعرض والتصدير فقط.');
}
async function loadFinancialReport(){
 if(!state.user)throw new Error('سجّل الدخول إلى لوحة الإدارة أولًا.');
 const version=++reportLoadVersion;
 const courseId=$('reportMonth').value;
 currentReport=null;$('reportContent').hidden=true;
 $('reportExportExcel').disabled=true;$('reportPrint').disabled=true;
 if(!courseId){reportStatus('لا توجد شهور مسجلة.');return;}
 const courseRow=state.courses.find(c=>c.id===courseId);
 if(!courseRow){reportStatus('اختر شهرًا صحيحًا.',true);return;}
 reportStatus('جارٍ تحميل الحسابات وسجلات الدفعات…');
 try{
  const [enrollments,fin,teacher]=await Promise.all([
   one(db.from('enrollments').select('id,student_id,status,deleted_at,students(id,full_name,contact)')
     .eq('course_id',courseId).order('created_at')),
   one(db.from('course_finances').select('total_fee').eq('course_id',courseId).maybeSingle()),
   one(db.from('teacher_payouts').select('id,amount,paid_on,notes')
     .eq('course_id',courseId).order('paid_on',{ascending:false}).order('created_at',{ascending:false}))
  ]);
  if(version!==reportLoadVersion||$('reportMonth').value!==courseId)return;
  const ids=enrollments.map(row=>row.id);
  const payments=ids.length?
   await one(db.from('payments').select('id,enrollment_id,amount,paid_on,notes')
     .in('enrollment_id',ids).order('paid_on',{ascending:false}).order('created_at',{ascending:false})):[];
  if(version!==reportLoadVersion||$('reportMonth').value!==courseId)return;
  const overview=monthsOverview.find(x=>x.course_id===courseId);
  currentReport=reportDataModel(courseRow,overview,enrollments,payments,teacher,n(fin?.total_fee));
  renderFinancialReport(currentReport);
 }catch(err){
  if(version!==reportLoadVersion)return;
  currentReport=null;$('reportContent').hidden=true;
  reportStatus('تعذّر تجهيز التقرير: '+errorText(err),true);
  throw err;
 }
}
function ensureReport(){if(!currentReport||currentReport.courseId!==$('reportMonth').value)throw new Error('حدّث التقرير أولًا.');return currentReport;}
function exportFinancialExcel(){
 const report=ensureReport();
 if(!window.NAHW_REPORT_XLSX?.download)throw new Error('تعذّر تحميل أداة إنشاء Excel. حدّث الصفحة وحاول مرة أخرى.');
 window.NAHW_REPORT_XLSX.download(report);
}
function printFinancialReport(){
 const report=ensureReport();
 const sheet=$('reportPrintSheet');sheet.replaceChildren();
 const heading=e('div','print-heading');
 heading.append(e('h1','','التقرير المالي — '+report.courseTitle),
  e('p','',report.range+' • التقرير محفوظ في تاريخ '+niceDate(today())));
 sheet.append(heading);
 const metrics=e('div','print-metrics');
 const boxes=[
  ['إجمالي الشهر',money(report.fee)],['المحصّل من الطلاب',money(report.collected)],
  ['المتبقي على الطلاب',money(report.studentOutstanding)],
  ['المدفوع للدكتور',money(report.teacherPaid)],
  [report.teacherOverpaid?'المدفوع زيادة':'المتبقي للدكتور',money(report.teacherOverpaid||report.teacherRemaining)]
 ];
 for(const [label,value] of boxes){
  const box=e('div','print-metric');box.append(e('span','',label),e('strong','',value));metrics.append(box);
 }
 sheet.append(metrics);
 const makeTable=(title,headers,rows)=>{
  sheet.append(e('h2','',title));
  const table=e('table'),head=e('thead'),hr=e('tr');
  headers.forEach(h=>hr.append(e('th','',h)));head.append(hr);table.append(head);
  const body=e('tbody');
  if(!rows.length){
   const tr=e('tr'),td=e('td','','لا توجد دفعات أو سجلات في هذا القسم.');
   td.colSpan=headers.length;tr.append(td);body.append(tr);
  }else for(const values of rows){
   const tr=e('tr');for(const value of values)tr.append(e('td','',value===null||value===undefined?'—':String(value)));body.append(tr);
  }
  table.append(body);sheet.append(table);
 };
 makeTable('كشف حساب الطلاب', ['الطالب','الحالة','المطلوب','المدفوع','المتبقي'],
  report.students.map(s=>[s.name,s.enrollmentStatus+' — '+s.paymentStatus,
   s.expected===null?'—':money(s.expected),money(s.paid),s.due===null?'—':money(s.due)]));
 makeTable('سجل مدفوعات الطلاب',['التاريخ','الطالب','المبلغ','ملاحظة'],
  report.payments.map(p=>[p.date,p.student,money(p.amount),p.notes]));
 makeTable('مدفوعات الدكتور عبد المنعم',['التاريخ','المبلغ','ملاحظة'],
  report.teacherPayouts.map(p=>[p.date,money(p.amount),p.notes]));
 sheet.append(e('p','print-note','حصة الطالب تحتسب على الطلاب النشطين فقط؛ والمدفوعات القديمة تظل محفوظة في سجلها. الرصيد بعد التحويلات: '+money(report.cashBalance)+'.'));
 sheet.append(e('div','print-footer','محاضرات النحو والصرف — الدكتور عبد المنعم • التقرير للمتابعة المالية الداخلية'));
 document.body.classList.add('report-print-mode');
 sheet.hidden=false;
 const cleanup=()=>{
  document.body.classList.remove('report-print-mode');sheet.hidden=true;
  window.removeEventListener('afterprint',cleanup);
 };
 window.addEventListener('afterprint',cleanup);
 try{window.print();}catch(err){cleanup();throw err;}
}

let announcementsLoadVersion=0;
async function loadAnnouncements(){
 const version=++announcementsLoadVersion;
 const rows=await one(db.from('announcements').select('*').order('created_at',{ascending:false}));
 if(version!==announcementsLoadVersion)return;
 state.announcements=rows;
 const list=$('announcementsList');
 list.replaceChildren();
 const seen=new Set();
 for(const a of rows){
  if(seen.has(a.id))continue;seen.add(a.id);
  record(list,a.content,a.is_published?'منشور':'مخفي',[
   {label:'تعديل',action:async()=>{
    $('announcementId').value=a.id;$('announcementContent').value=a.content;
    $('announcementPublished').checked=a.is_published;
    $('announcementForm').hidden=false;
    $('announcementForm').scrollIntoView({behavior:'smooth',block:'start'});
    $('announcementContent').focus({preventScroll:true});
   }},
   {label:'حذف',danger:true,action:async()=>{
    if(!confirm('حذف الإعلان نهائيًا؟'))return;
    await one(db.from('announcements').delete().eq('id',a.id));await loadAnnouncements();
   }}
  ]);
 }
 if(!rows.length)list.append(e('p','subtle','لا توجد إعلانات بعد.'));
}
async function saveAnnouncement(ev){ev.preventDefault();const id=$('announcementId').value,data={content:$('announcementContent').value.trim(),is_published:$('announcementPublished').checked};if(!data.content)throw new Error('اكتب الإعلان.');if(id)await one(db.from('announcements').update(data).eq('id',id));else await one(db.from('announcements').insert(data));resetAnnouncement();await loadAnnouncements();alertMsg('تم حفظ الإعلان.');}
async function loadRelated(){await loadLessons();await loadStudents();await loadFinance();}
let enteringPromise=null;
function enter(){
 // The sign-in callback and initial session check may fire together.
 // Reuse one initialization rather than rendering all lists twice.
 if(enteringPromise)return enteringPromise;
 const pending=performEnter().finally(()=>{if(enteringPromise===pending)enteringPromise=null;});
 enteringPromise=pending;
 return pending;
}
async function performEnter(){
 const showLogin=()=>{
  $('bootPanel').hidden=true;
  $('authPanel').hidden=false;
  $('workspace').hidden=true;
  $('logout').hidden=true;
 };
 if(!db){
  $('loginState').textContent='تعذّر الاتصال بخدمة تسجيل الدخول. حاول تحديث الصفحة.';
  showLogin();return;
 }
 try{
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user){showLogin();return;}
  const admin=await one(db.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle());
  if(!admin){
   $('loginState').textContent='الحساب ليس لديه صلاحية إدارة البرنامج.';
   showLogin();return;
  }
  state.user=user;
  $('alert').hidden=true;
  $('bootPanel').hidden=true;
  $('authPanel').hidden=true;
  $('workspace').hidden=false;
  $('logout').hidden=false;
  $('userBadge').textContent=user.email||'المشرف';
  await loadCourses();
  await loadAnnouncements();
  selectTab(state.courseId?'lessons':'courses');
 }catch(err){
  state.user=null;
  showLogin();
  throw err;
 }
}

function init(){
 window.NAHW_BACKUP?.setup(db);
 $('paymentDate').value=today();
 $('teacherPayoutDate').value=today();
 $('newTeacherPayout').addEventListener('click',()=>execute(async()=>openTeacherPayoutForm()));
 $('teacherPayoutCancel').addEventListener('click',resetTeacherPayoutForm);
 $('generateStart').value=today();
 $('newMonthForm').addEventListener('submit',ev=>execute(()=>createNewMonth(ev)));
 $('newMonthStart').addEventListener('change',updateMonthDraftHint);
 $('newMonthCopyStudents').addEventListener('change',updateMonthDraftHint);
 $('reportMonth').addEventListener('change',()=>execute(loadFinancialReport));
 $('reportRefresh').addEventListener('click',()=>execute(loadFinancialReport));
 $('reportExportExcel').addEventListener('click',()=>execute(async()=>exportFinancialExcel()));
 $('reportPrint').addEventListener('click',()=>execute(async()=>printFinancialReport()));
 $('generateLessons').addEventListener('click',()=>execute(generateLessons));
 $('openPayment').addEventListener('click',()=>execute(async()=>showPaymentForm()));
 $('cancelPayment').addEventListener('click',closePaymentForm);
 $('openFee').addEventListener('click',()=>{$('feeForm').hidden=false;$('totalFee').focus();});
 $('cancelFee').addEventListener('click',()=>{$('feeForm').hidden=true;});
 $('newCourse').addEventListener('click',()=>{resetCourse();$('courseForm').hidden=false;$('courseTitle').focus();});
 $('newLesson').addEventListener('click',()=>execute(async()=>{course();resetLesson();$('lessonForm').hidden=false;$('lessonDate').focus();}));
 $('newStudent').addEventListener('click',()=>execute(async()=>{course();resetStudent();$('studentForm').hidden=false;$('studentCancelButton').hidden=false;$('studentName').focus();}));
 $('newAnnouncement').addEventListener('click',()=>{resetAnnouncement();$('announcementForm').hidden=false;$('announcementContent').focus();});
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  selectTab(button.dataset.tab);
  if(window.matchMedia('(max-width:860px)').matches){
   window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
 }));
 $('activeCourseSelect').addEventListener('change',()=>execute(async()=>{
  const tab=document.querySelector('[data-tab].active')?.dataset.tab||'lessons';
  await openMonth($('activeCourseSelect').value,tab);
 }));
 [['courseForm',saveCourse],['lessonForm',saveLesson],['studentForm',saveStudent],['feeForm',saveFee],['paymentForm',savePayment],['teacherPayoutForm',saveTeacherPayout],['announcementForm',saveAnnouncement]].forEach(([id,fn])=>$(id).addEventListener('submit',ev=>execute(()=>fn(ev))));
 $('resetCourse').addEventListener('click',resetCourse);$('resetLesson').addEventListener('click',resetLesson);$('resetAnnouncement').addEventListener('click',resetAnnouncement);$('studentCancelButton').addEventListener('click',resetStudent);
 $('logout').addEventListener('click',()=>execute(async()=>{await db.auth.signOut();location.reload();}));
 $('loginForm').addEventListener('submit',ev=>execute(async()=>{
   ev.preventDefault();if(!db)throw new Error('أولًا اربط قاعدة البيانات عبر config.js.');
   const email=$('email').value.trim(),password=$('password').value;
   if(!email||!password)throw new Error('اكتب البريد الإلكتروني وكلمة المرور.');
   const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
   $('loginState').textContent='تم تسجيل الدخول. جارٍ فحص صلاحية الإدارة.';
   await enter();
 }));
 $('forgotPassword').addEventListener('click',()=>execute(async()=>{
   if(!db)throw new Error('قاعدة البيانات غير متصلة.');
   const email=$('email').value.trim();
   if(!email)throw new Error('اكتب بريدك الإلكتروني في الخانة الأولى ثم اضغط «نسيت كلمة المرور؟».');
   const redirectTo=new URL('./reset.html',window.location.href).toString();
   const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
   if(error)throw error;
   $('loginState').textContent='أرسلنا رابط استعادة كلمة المرور إلى بريدك. إذا تعذّر فتحه، انسخه والصقه في صفحة اختيار كلمة المرور.';
   $('resetPageLink').hidden=false;
 }));
 $('signUpButton').addEventListener('click',()=>execute(async()=>{
   if(!db)throw new Error('قاعدة البيانات غير متصلة.');
   const email=$('email').value.trim(),password=$('password').value;
   if(!email||password.length<8)throw new Error('اكتب بريدك الإلكتروني وكلمة مرور تتكون من ٨ أحرف على الأقل.');
   const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:new URL('admin/',new URL('../',location.href)).toString()}});
   if(error)throw error;
   $('loginState').textContent='راجع بريدك لتأكيد الحساب، ثم ارجع إلى هذه الصفحة وسجّل الدخول. إنشاء حساب لا يعطي صلاحية الإدارة تلقائيًا؛ سيتم تفعيلها للحساب المعتمد بعد التحقق.';
 }));
 if(!db){$('loginState').textContent='تعذّر الاتصال بخدمة تسجيل الدخول. حاول تحديث الصفحة.';return;}
 execute(enter);
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'&&!state.user)setTimeout(()=>{if(!state.user)execute(enter);},50);});
}
init();
})();