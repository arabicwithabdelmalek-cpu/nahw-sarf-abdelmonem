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
 const names={lessons:'المحاضرات',students:'الطلاب',finance:'المدفوعات',courses:'الدورات',announcements:'الإعلانات'};
 document.querySelector('.page-title h1').textContent=names[tab]||'لوحة الإدارة';
}
function resetCourse(){['courseId','courseTitle','courseStart','courseDescription'].forEach(k=>$(k).value='');$('coursePublished').checked=false;$('courseActive').checked=false;$('courseForm').hidden=true;}
function resetLesson(){['lessonId','lessonDate','lessonTitle','lessonTime','lessonNotes'].forEach(k=>$(k).value='');$('lessonPosition').value=String(state.lessons.length+1);$('lessonSubject').value='غير محدد';$('lessonPublished').checked=false;$('lessonForm').hidden=true;}
function resetAnnouncement(){ $('announcementId').value='';$('announcementContent').value='';$('announcementPublished').checked=false;$('announcementForm').hidden=true;}
function resetStudent(){ $('studentId').value='';$('studentName').value='';$('studentContact').value='';$('studentSaveButton').textContent='حفظ الطالب';$('studentCancelButton').hidden=true;$('studentForm').hidden=true;}

let coursesLoadVersion=0;
async function loadCourses(){
 const version=++coursesLoadVersion;
 const courses=await one(db.from('courses').select('*').order('created_at',{ascending:false}));
 if(version!==coursesLoadVersion)return;
 state.courses=courses;
 const list=$('coursesList'),picker=$('activeCourseSelect');
 // Replace the rendered list after the request resolves, never append to an old render.
 list.replaceChildren();
 picker.replaceChildren();
 for(const c of courses){
  picker.append(new Option(c.title,c.id));
  record(list,c.title,[c.is_active?'الحالية':'غير نشطة',c.is_published?'منشورة':'غير منشورة',c.start_date||''].filter(Boolean).join(' • '),[
   {label:'تعديل',action:async()=>{
    $('courseId').value=c.id;$('courseTitle').value=c.title;
    $('courseStart').value=c.start_date||'';
    $('courseDescription').value=c.description||'';
    $('coursePublished').checked=c.is_published;
    $('courseActive').checked=c.is_active;
    selectTab('courses');$('courseForm').hidden=false;
    $('courseForm').scrollIntoView({behavior:'smooth',block:'start'});
    $('courseTitle').focus({preventScroll:true});
   }},
   {label:'إدارة المحاضرات',action:async()=>{
    state.courseId=c.id;picker.value=c.id;
    await loadRelated();selectTab('lessons');
   }}
  ]);
 }
 if(!courses.length)list.append(e('p','subtle','لم تُضف دورات بعد. ابدأ بالدورة الأولى.'));
 state.courseId=courses.some(c=>c.id===state.courseId)?state.courseId:(courses.find(c=>c.is_active)||courses[0]||{}).id||null;
 if(state.courseId)picker.value=state.courseId;
 await loadRelated();
}
async function saveCourse(ev){ev.preventDefault();const id=$('courseId').value,title=$('courseTitle').value.trim();if(!title)throw new Error('اكتب اسم الدورة.');
 const data={title,start_date:$('courseStart').value||null,description:$('courseDescription').value.trim(),is_published:$('coursePublished').checked,is_active:$('courseActive').checked};
 // Only one course may be current. Move the previous one out of active state first.
 if(data.is_active)await one(id?db.from('courses').update({is_active:false}).neq('id',id):db.from('courses').update({is_active:false}).eq('is_active',true));
 const row=id?await one(db.from('courses').update(data).eq('id',id).select('id').single()):await one(db.from('courses').insert(data).select('id').single());
 state.courseId=row.id;resetCourse();await loadCourses();alertMsg('تم حفظ الدورة بنجاح.');
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
function showPaymentForm(enrollmentId='',amount=0){
 if(!state.courseId)throw new Error('اختر دورة أولًا.');
 const picker=$('paymentStudent');
 if(!picker.options.length)throw new Error('أضف طالبًا نشطًا إلى الدورة أولًا.');
 $('paymentForm').hidden=false;
 $('paymentFormTitle').textContent='تسجيل دفعة';
 if(enrollmentId && [...picker.options].some(o=>o.value===enrollmentId))picker.value=enrollmentId;
 else picker.selectedIndex=0;
 $('paymentAmount').value=amount>0?Number((amount/100).toFixed(2)).toFixed(2):'';
 $('paymentDate').value=today();
 $('paymentNotes').value='';
 $('paymentForm').scrollIntoView({behavior:'smooth',block:'start'});
 $('paymentAmount').focus({preventScroll:true});
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
 $('paymentHistoryCount').textContent=String(payments.length);
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
 if(!payments.length)history.append(e('p','subtle','لا توجد دفعات مسجلة بعد.'));
 for(const p of payments){
  const ent=enrollments.find(x=>x.id===p.enrollment_id);
  record(history,(ent?.students?.full_name||'طالب')+' — '+money(p.amount),p.paid_on+(p.notes?' • '+p.notes:''),[{
   label:'حذف',danger:true,action:async()=>{
    if(!confirm('هل تريد حذف هذه الدفعة؟'))return;
    await one(db.from('payments').delete().eq('id',p.id));await loadFinance();
   }
  }]);
 }
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
async function savePayment(ev){
 ev.preventDefault();
 if(!$('paymentStudent').value)throw new Error('اختر طالبًا نشطًا أولًا.');
 const amount=n($('paymentAmount').value);
 if(amount<=0)throw new Error('أدخل مبلغًا أكبر من صفر.');
 await one(db.from('payments').insert({enrollment_id:$('paymentStudent').value,amount,paid_on:$('paymentDate').value,notes:$('paymentNotes').value.trim()}));
 $('paymentForm').hidden=true;$('paymentAmount').value='';$('paymentNotes').value='';
 await loadFinance();alertMsg('تم حفظ الدفعة بنجاح.');
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
 $('paymentDate').value=today();
 $('generateStart').value=today();
 $('generateLessons').addEventListener('click',()=>execute(generateLessons));
 $('openPayment').addEventListener('click',()=>execute(async()=>showPaymentForm()));
 $('cancelPayment').addEventListener('click',()=>{$('paymentForm').hidden=true;});
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
 $('activeCourseSelect').addEventListener('change',()=>execute(async()=>{state.courseId=$('activeCourseSelect').value;await loadRelated();}));
 [['courseForm',saveCourse],['lessonForm',saveLesson],['studentForm',saveStudent],['feeForm',saveFee],['paymentForm',savePayment],['announcementForm',saveAnnouncement]].forEach(([id,fn])=>$(id).addEventListener('submit',ev=>execute(()=>fn(ev))));
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