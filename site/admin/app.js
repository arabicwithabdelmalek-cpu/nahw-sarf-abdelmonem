(()=>{
'use strict';
const $=id=>document.getElementById(id);
const cfg=window.NAHW_SARF_CONFIG||{};
const db=(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}):null;
const state={user:null,courses:[],courseId:null,lessons:[],enrollments:[],payments:[],fee:0,announcements:[]};
const e=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const n=v=>Number(v)||0;const money=v=>new Intl.NumberFormat('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2}).format(n(v))+' ج.م';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const errorText=x=>x?.message||String(x||'خطأ غير متوقع');
function alertMsg(message,err=false){const box=$('alert');box.textContent=message;box.hidden=false;box.classList.toggle('error',err);window.scrollTo({top:0,behavior:'smooth'});}
async function execute(fn){try{await fn();}catch(err){console.error('Admin operation failed',err);alertMsg(errorText(err),true);}}
async function one(promise){const res=await promise;if(res.error)throw res.error;return res.data;}
const course=()=>{if(!state.courseId)throw new Error('يجب إنشاء دورة واختيارها أولًا.');return state.courseId;};
function record(parent,title,subtitle,actions=[]){let item=e('div','record'),left=e('div',''),right=e('div','record-actions');left.append(e('b','',title),e('small','',subtitle));for(const a of actions){let b=e('button','mini '+(a.danger?'danger':'outline'),a.label);b.type='button';b.addEventListener('click',()=>execute(a.action));right.append(b)}item.append(left,right);parent.append(item);}
function selectTab(tab){document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==tab);document.querySelectorAll('[data-tab]').forEach(p=>{p.classList.toggle('active',p.dataset.tab===tab);p.setAttribute('aria-selected',String(p.dataset.tab===tab))});}
function resetCourse(){['courseId','courseTitle','courseStart','courseDescription'].forEach(k=>$(k).value='');$('coursePublished').checked=false;$('courseActive').checked=false;}
function resetLesson(){['lessonId','lessonDate','lessonTitle','lessonTime','lessonNotes'].forEach(k=>$(k).value='');$('lessonPosition').value=String(state.lessons.length+1);$('lessonSubject').value='غير محدد';$('lessonPublished').checked=false;}
function resetAnnouncement(){ $('announcementId').value='';$('announcementContent').value='';$('announcementPublished').checked=false;}
function resetStudent(){ $('studentId').value='';$('studentName').value='';$('studentContact').value='';$('studentSaveButton').textContent='حفظ الطالب';$('studentCancelButton').hidden=true;}

async function loadCourses(){
 state.courses=await one(db.from('courses').select('*').order('created_at',{ascending:false}));
 const list=$('coursesList');list.replaceChildren();
 const picker=$('activeCourseSelect');picker.replaceChildren();
 for(const c of state.courses){
   picker.append(new Option(c.title,c.id));
   record(list,c.title,[c.is_active?'الحالية':'غير نشطة',c.is_published?'منشورة':'غير منشورة',c.start_date||''].filter(Boolean).join(' • '),[
    {label:'تعديل',action:async()=>{$('courseId').value=c.id;$('courseTitle').value=c.title;$('courseStart').value=c.start_date||'';$('courseDescription').value=c.description||'';$('coursePublished').checked=c.is_published;$('courseActive').checked=c.is_active;selectTab('courses');}},
    {label:'إدارة المحاضرات',action:async()=>{state.courseId=c.id;picker.value=c.id;await loadRelated();selectTab('lessons');}}
   ]);
 }
 if(!state.courses.length)list.append(e('p','subtle','لم تُضف دورات بعد. ابدأ بالدورة الأولى.'));
 state.courseId=state.courses.some(c=>c.id===state.courseId)?state.courseId:(state.courses.find(c=>c.is_active)||state.courses[0]||{}).id||null;
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
async function loadLessons(){const list=$('lessonsList');list.replaceChildren();state.lessons=[];if(!state.courseId)return;
 state.lessons=await one(db.from('lessons').select('*').eq('course_id',state.courseId).order('position'));
 $('scheduleGenerator').hidden=state.lessons.length>0;
 for(const l of state.lessons){record(list,`المحاضرة ${l.position} — ${l.subject}`,`${l.lesson_date}${l.start_time?' • '+l.start_time.slice(0,5):''}${l.title?' • '+l.title:''} • ${l.is_published?'منشورة':'مخفية'}`, [
  {label:'تعديل',action:async()=>{ $('lessonId').value=l.id;$('lessonPosition').value=l.position;$('lessonDate').value=l.lesson_date;$('lessonSubject').value=l.subject;$('lessonTitle').value=l.title||'';$('lessonTime').value=l.start_time?.slice(0,5)||'';$('lessonNotes').value=l.notes||'';$('lessonPublished').checked=l.is_published;$('lessonForm').scrollIntoView({behavior:'smooth',block:'start'});$('lessonDate').focus({preventScroll:true});}},
  {label:'حذف',danger:true,action:async()=>{if(!confirm('هل تريد حذف المحاضرة نهائيًا؟'))return;await one(db.from('lessons').delete().eq('id',l.id));await loadLessons();alertMsg('تم حذف المحاضرة.');}}
 ]);}
 if(!state.lessons.length)list.append(e('p','subtle','لا توجد محاضرات مسجلة لهذه الدورة.'));
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

async function loadStudents(){const list=$('studentsList');list.replaceChildren();state.enrollments=[];if(!state.courseId)return;
 state.enrollments=await one(db.from('enrollments').select('id,student_id,status,students(id,full_name,contact)').eq('course_id',state.courseId).order('created_at'));
 for(const ent of state.enrollments){const s=ent.students||{};
  record(list,s.full_name||'طالب',`${s.contact||'بدون وسيلة تواصل'} • ${ent.status}`, [
   {label:'تعديل',action:async()=>{ $('studentId').value=s.id;$('studentName').value=s.full_name;$('studentContact').value=s.contact||'';$('studentSaveButton').textContent='حفظ التعديل';$('studentCancelButton').hidden=false;selectTab('students');$('studentForm').scrollIntoView({behavior:'smooth',block:'start'});$('studentName').focus({preventScroll:true});}},
   {label:ent.status==='نشط'?'إيقاف الاشتراك':'إعادة التنشيط',action:async()=>{await one(db.from('enrollments').update({status:ent.status==='نشط'?'متوقف':'نشط'}).eq('id',ent.id));await loadRelated();}}
  ]);
 }
 if(!state.enrollments.length)list.append(e('p','subtle','لا يوجد طلاب مسجلون في هذه الدورة.'));
 const paymentStudent=$('paymentStudent');paymentStudent.replaceChildren();for(const ent of state.enrollments.filter(x=>x.status==='نشط'))paymentStudent.append(new Option(ent.students?.full_name||'طالب',ent.id));
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
async function loadFinance(){const summary=$('financeSummary'),list=$('paymentsList');summary.replaceChildren();list.replaceChildren();state.payments=[];state.fee=0;if(!state.courseId)return;
 const data=await one(db.from('course_finances').select('total_fee').eq('course_id',state.courseId).maybeSingle());state.fee=n(data?.total_fee);$('totalFee').value=state.fee;
 const ids=state.enrollments.map(x=>x.id);
 if(ids.length)state.payments=await one(db.from('payments').select('*').in('enrollment_id',ids).order('paid_on',{ascending:false}));
 const active=state.enrollments.filter(x=>x.status==='نشط');
 const totalCents=Math.round(state.fee*100),baseShare=active.length?Math.floor(totalCents/active.length):0,remainder=active.length?totalCents%active.length:0;
 const shareFor=i=>(baseShare+(i<remainder?1:0))/100;
 const totalPaid=state.payments.reduce((x,p)=>x+n(p.amount),0);
 [['إجمالي الدورة',money(state.fee)],['الطلاب النشطون',String(active.length)],['حصة الطالب',active.length?money(baseShare/100)+(remainder?' + توزيع القروش':''):'—']].forEach(([label,value])=>{const c=e('div','finance-card');c.append(e('span','',label),e('strong','',value));summary.append(c)});
 record(list,'إجمالي المدفوع من جميع الطلاب',money(totalPaid),[]);
 for(const [i,ent] of active.entries()){const paid=state.payments.filter(p=>p.enrollment_id===ent.id).reduce((x,p)=>x+n(p.amount),0),share=shareFor(i);
  record(list,ent.students?.full_name||'طالب',`المطلوب: ${money(share)} • المدفوع: ${money(paid)} • المتبقي: ${money(Math.max(0,share-paid))}`,[]);
 }
 for(const p of state.payments){const ent=state.enrollments.find(x=>x.id===p.enrollment_id);
  record(list,`${ent?.students?.full_name||'طالب'} • ${money(p.amount)}`,`${p.paid_on} ${p.notes?'• '+p.notes:''}`,[{label:'حذف الدفعة',danger:true,action:async()=>{if(!confirm('حذف هذه الدفعة نهائيًا؟'))return;await one(db.from('payments').delete().eq('id',p.id));await loadFinance();}}]);
 }
}
async function saveFee(ev){ev.preventDefault();await one(db.from('course_finances').upsert({course_id:course(),total_fee:n($('totalFee').value)},{onConflict:'course_id'}));await loadFinance();alertMsg('تم حفظ تكلفة الدورة.');}
async function savePayment(ev){ev.preventDefault();if(!$('paymentStudent').value)throw new Error('أضف طالبًا نشطًا أولًا.');await one(db.from('payments').insert({enrollment_id:$('paymentStudent').value,amount:n($('paymentAmount').value),paid_on:$('paymentDate').value,notes:$('paymentNotes').value.trim()}));$('paymentAmount').value='';$('paymentNotes').value='';await loadFinance();alertMsg('تم تسجيل الدفعة.');}

async function loadAnnouncements(){const list=$('announcementsList');list.replaceChildren();state.announcements=await one(db.from('announcements').select('*').order('created_at',{ascending:false}));
 for(const a of state.announcements)record(list,a.content,a.is_published?'منشور':'مخفي',[
 {label:'تعديل',action:async()=>{$('announcementId').value=a.id;$('announcementContent').value=a.content;$('announcementPublished').checked=a.is_published;}},
 {label:'حذف',danger:true,action:async()=>{if(!confirm('حذف الإعلان نهائيًا؟'))return;await one(db.from('announcements').delete().eq('id',a.id));await loadAnnouncements();}}
 ]);
 if(!state.announcements.length)list.append(e('p','subtle','لا توجد إعلانات بعد.'));
}
async function saveAnnouncement(ev){ev.preventDefault();const id=$('announcementId').value,data={content:$('announcementContent').value.trim(),is_published:$('announcementPublished').checked};if(!data.content)throw new Error('اكتب الإعلان.');if(id)await one(db.from('announcements').update(data).eq('id',id));else await one(db.from('announcements').insert(data));resetAnnouncement();await loadAnnouncements();alertMsg('تم حفظ الإعلان.');}
async function loadRelated(){await loadLessons();await loadStudents();await loadFinance();}
async function enter(){
 if(!db){$('loginState').textContent='لم يُربط هذا الموقع بقاعدة بيانات مستقلة بعد. يلزم إعداد ملف config.js بالمفتاح العام فقط.';return;}
 const {data:{user},error}=await db.auth.getUser();if(error||!user)return;
 const admin=await one(db.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle());
 if(!admin){$('loginState').textContent='الحساب مسجل، لكنه غير مُضاف إلى مسؤولي هذا البرنامج. لا توجد صلاحية لعرض البيانات.';return;}
 state.user=user;$('alert').hidden=true;$('authPanel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('userBadge').textContent=user.email||'المشرف';
 await loadCourses();await loadAnnouncements();selectTab(state.courseId?'lessons':'courses');
}

function init(){
 $('paymentDate').value=today();
 $('generateStart').value=today();
 $('generateLessons').addEventListener('click',()=>execute(generateLessons));
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.tab)));
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
   $('loginState').textContent='طلبت رابط الاستعادة. راجع بريدك الإلكتروني، ولو كان رابط Supabase يفتح localhost انسخه ثم افتح صفحة اختيار كلمة المرور أدناه والصقه هناك.';
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
 if(!db){$('loginState').textContent='لوحة الإدارة في مرحلة التأسيس. لا توجد بيانات أو صلاحيات مفتوحة قبل ربط المشروع.';return;}
 execute(enter);
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'&&!state.user)setTimeout(()=>execute(enter),50);});
}
init();
})();