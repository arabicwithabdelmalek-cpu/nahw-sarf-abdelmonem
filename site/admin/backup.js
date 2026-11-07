/* Private, manual application backup. Runs only inside authenticated admin UI.
   Never transmits backup file contents to any service while verifying them. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const TABLES=['courses','lessons','students','enrollments','course_finances','payments','teacher_payouts','announcements'];
const encoder=new TextEncoder();
const countOf=(data,key)=>data.tables[key]?.length??0;
function status(message,error=false){
 const el=$('siteBackupStatus');
 if(!el)return;
 el.textContent=message;el.classList.toggle('error',Boolean(error));
}
function ensureShape(data){
 if(!data||data.format!=='nahw-sarf-backup'||data.version!==1||
     !data.tables||typeof data.tables!=='object'||
     !TABLES.every(name=>Array.isArray(data.tables[name])))
  throw new Error('هذا الملف ليس نسخة احتياطية صالحة من الموقع، أو أن إصداره غير مدعوم.');
 const tables=data.tables;
 function unique(table,field='id'){
  const seen=new Set();
  for(const row of tables[table]){
   const key=row?.[field];
   if(typeof key!=='string'||!key||seen.has(key))throw new Error('بيانات غير سليمة أو مكررة في '+table);
   seen.add(key);
  }
  return seen;
 }
 const courses=unique('courses'),students=unique('students'),enrollments=unique('enrollments');
 unique('lessons');unique('payments');unique('teacher_payouts');
 unique('announcements');unique('course_finances','course_id');
 const exists=(table,key,ids)=>{for(const row of tables[table])if(!ids.has(row[key]))throw new Error('وجدنا ارتباطًا مفقودًا في '+table)};
 exists('lessons','course_id',courses);
 exists('enrollments','course_id',courses);
 exists('enrollments','student_id',students);
 exists('course_finances','course_id',courses);
 exists('payments','enrollment_id',enrollments);
 exists('teacher_payouts','course_id',courses);
 if(data.integrity?.counts){
  for(const name of TABLES){
   if(data.integrity.counts[name]!==countOf(data,name))
    throw new Error('عدد السجلات في '+name+' لا يطابق البيانات المحفوظة.');
  }
 }
 return Object.fromEntries(TABLES.map(t=>[t,countOf(data,t)]));
}
async function hashTables(tables){
 if(!window.crypto?.subtle)throw new Error('الجهاز لا يدعم فحص سلامة النسخة. افتح الموقع عبر HTTPS من متصفح حديث.');
 const bytes=encoder.encode(JSON.stringify(tables));
 const digest=await window.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function validateArchive(data,requireDigest=true){
 const counts=ensureShape(data);
 if(requireDigest&&data.integrity?.sha256_of_tables){
  const computed=await hashTables(data.tables);
  if(computed!==data.integrity.sha256_of_tables)throw new Error('فشل فحص سلامة النسخة: ربما تلف الملف أو تغير محتواه.');
 }else if(requireDigest)throw new Error('الملف يفتقد بصمة التحقق المطلوبة. لا تعتمد عليه كنسخة احتياطية.');
 return counts;
}
function summary(counts){
 return 'الشهور: '+counts.courses+
  ' • المحاضرات: '+counts.lessons+
  ' • الطلاب: '+counts.students+
  ' • الاشتراكات: '+counts.enrollments+
  ' • دفعات الطلاب: '+counts.payments+
  ' • دفعات الدكتور: '+counts.teacher_payouts;
}
function filenameFor(date){
 const timestamp=String(date||new Date().toISOString()).replace(/[^0-9]/g,'').slice(0,14);
 return 'nahw-sarf-private-backup-'+timestamp+'.json';
}
function saveAsJSON(data){
 const bytes=encoder.encode(JSON.stringify(data,null,2));
 const blob=new Blob([bytes],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download=filenameFor(data.generated_at);
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),10000);
}
let saving=false;
async function exportBackup(db){
 if(saving)return;
 if(!db)throw new Error('الاتصال بقاعدة البيانات غير متاح.');
 saving=true;
 const button=$('downloadSiteBackup');button.disabled=true;
 status('جارٍ إنشاء نسخة من سجلات الموقع والتحقق من سلامتها…');
 try{
  const {data:userResponse,error:userError}=await db.auth.getUser();
  if(userError||!userResponse?.user)throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
  const {data,error}=await db.rpc('export_site_backup');
  if(error)throw error;
  const counts=ensureShape(data);
  data.integrity={method:'SHA-256',sha256_of_tables:await hashTables(data.tables),counts};
  await validateArchive(data);
  saveAsJSON(data);
  status('تم تجهيز ملف النسخة الاحتياطية: '+summary(counts)+'. احفظ الملف بعيدًا عن الروابط والمجموعات العامة.');
 }catch(err){
  status('تعذّر تنزيل النسخة: '+(err?.message||String(err)),true);
 }finally{
  saving=false;button.disabled=false;
 }
}
async function inspectBackup(event){
 const file=event.target.files?.[0];
 if(!file)return;
 status('جارٍ فحص ملف النسخة على جهازك، من غير رفعه إلى الموقع…');
 try{
  if(file.size>50*1024*1024)throw new Error('حجم الملف أكبر من الحد المسموح لفحص المتصفح (٥٠ ميجابايت).');
  const raw=await file.text();
  const data=JSON.parse(raw);
  const counts=await validateArchive(data);
  status('الملف سليم ومتسق: '+summary(counts)+'. لم تُرسل البيانات ولم تتغير أي سجلات في الموقع.');
 }catch(err){
  status('الملف غير صالح أو فشل فحص سلامته: '+(err?.message||String(err)),true);
 }finally{
  event.target.value='';
 }
}
function setup(db){
 const download=$('downloadSiteBackup'),verify=$('verifySiteBackup');
 if(!download||!verify)return;
 if(!db){
  download.disabled=true;
  status('النسخ الاحتياطي غير متاح حتى يتم الاتصال بقاعدة البيانات.',true);
  return;
 }
 download.addEventListener('click',()=>exportBackup(db));
 verify.addEventListener('change',inspectBackup);
}
window.NAHW_BACKUP={setup};
})();
