(()=>{
  'use strict';
  const $ = id => document.getElementById(id);
  const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const dateObj = s => new Date(s+'T12:00:00');
  const fmt = s => {const d=dateObj(s);return `${ar(d.getDate())} ${months[d.getMonth()]} ${ar(d.getFullYear())}`};
  const day = s => days[dateObj(s).getDay()];
  const today = () => {let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const node = (tag, cls, content) => {const el=document.createElement(tag);if(cls)el.className=cls;if(content!=null)el.textContent=content;return el};
  const config=window.NAHW_SARF_CONFIG||{};
  const fallback = JSON.parse($('scheduleData').textContent).dates.map(d=>({id:null,position:d.index+1,lesson_date:d.date,subject:d.subject||'غير محدد',title:'',start_time:null,notes:'',is_published:true}));
  const banner = document.querySelector('.calendar-help');
  const courseCount = document.querySelector('.schedule-count');
  const state={lessons:fallback, live:false};

  function card(lesson,index,upcoming){
    const tile=node('article','class-tile');
    const main=node('div','class-main');
    main.append(node('strong','',`${day(lesson.lesson_date)}، ${fmt(lesson.lesson_date)}`),node('small','',upcoming?'الموعد القادم':lesson.lesson_date<today()?'تاريخ سابق':'موعد قادم'));
    const info=[lesson.start_time?`الساعة ${String(lesson.start_time).slice(0,5)}`:'',lesson.title||''].filter(Boolean).join(' • ');
    main.append(node('span','lesson-details',info));
    const tag=node('span','class-tag '+(lesson.subject==='نحو'?'nahw':lesson.subject==='صرف'?'sarf':'unspecified'),lesson.subject==='غير محدد'?'لم تُحدّد':lesson.subject);
    tile.append(node('div','class-number',ar(index+1)),main,tag);
    tile.classList.toggle('is-next',!!upcoming);tile.classList.toggle('is-past',lesson.lesson_date<today());
    return tile;
  }
  function paint(lessons,live=false,course){
    state.lessons=lessons;state.live=live;
    const iso=today(),next=lessons.find(l=>l.lesson_date>=iso),past=lessons.filter(l=>l.lesson_date<iso).length;
    const grid=$('publicDates');grid.replaceChildren(...lessons.map((l,i)=>card(l,i,l===next)));
    $('publicPastCount').textContent=ar(past);
    $('publicComingCount').textContent=ar(lessons.length-past);
    $('publicProgressBar').style.width=lessons.length?`${past/lessons.length*100}%`:'0%';
    $('upcomingDate').textContent=next?fmt(next.lesson_date):'لا توجد محاضرات قادمة';
    $('upcomingSubject').textContent=next?(next.subject==='غير محدد'?'المادة لم تُحدَّد بعد':next.subject):'انتظر إعلان الدورة التالية';
    $('upcomingNum').textContent=next?`المحاضرة ${ar(lessons.indexOf(next)+1)} من ${ar(lessons.length)}`:'لا توجد مواعيد جديدة';
    $('upcomingDay').textContent=next?day(next.lesson_date):'';
    $('upcomingTime').textContent=next?[next.start_time?`الساعة ${next.start_time.slice(0,5)}`:'',next.title].filter(Boolean).join(' • '):'';
    if(lessons.length){$('publicRange').textContent=`من ${fmt(lessons[0].lesson_date)} إلى ${fmt(lessons[lessons.length-1].lesson_date)}`;}
    else {$('publicRange').textContent='لم تُعلن مواعيد بعد';}
    if(live){
      courseCount.textContent=`الدورة الحالية · ${ar(lessons.length)} محاضرة`;
      banner.textContent='هذه مواعيد الدورة التي نشرتها إدارة البرنامج. يُرجى متابعة الصفحة لأي تحديث.';
      if(course?.title){document.title=`${course.title} — الدكتور عبد المنعم`;}
    }
  }

  async function api(path){
    const url=config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+path;
    const response=await fetch(url,{headers:{'apikey':config.supabasePublishableKey,'Accept':'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error(`Public schedule unavailable (${response.status})`);
    return response.json();
  }
  async function load(){
    if(!/^https:\/\/[^\s]+\.supabase\.co$/.test(config.supabaseUrl||'') || !config.supabasePublishableKey)return;
    try{
      const courses=await api('courses?select=id,title&is_active=eq.true&is_published=eq.true&limit=1');
      if(!courses.length){paint([],true);return;}
      const course=courses[0];
      const lessonList=await api(`lessons?select=id,position,lesson_date,subject,title,start_time,notes&course_id=eq.${encodeURIComponent(course.id)}&is_published=eq.true&order=position.asc`);
      paint(lessonList,true,course);
      const announcements=await api('announcements?select=content&is_published=eq.true&order=created_at.desc&limit=1');
      if(announcements?.[0]?.content){$('noticeBox').hidden=false;$('noticeText').textContent=announcements[0].content;}
      else $('noticeBox').hidden=true;
    }catch(e){
      console.warn('Public data cannot be loaded; keeping last published HTML fallback.',e.message);
      banner.textContent='تعذّر تحديث المواعيد الآن. المعروض نسخة احتياطية؛ يُرجى المحاولة لاحقًا.';
    }
  }
  paint(fallback);
  load();
})();