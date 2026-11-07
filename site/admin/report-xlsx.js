/* Standalone browser XLSX writer for the financial report.
   No third-party scripts or external uploads: builds an Office Open XML workbook locally. */
(()=>{
'use strict';
const enc=new TextEncoder();
const xml=s=>String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function u16(v){const a=new Uint8Array(2);const w=new DataView(a.buffer);w.setUint16(0,v,true);return a;}
function u32(v){const a=new Uint8Array(4);const w=new DataView(a.buffer);w.setUint32(0,v>>>0,true);return a;}
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let x=i;for(let j=0;j<8;j++)x=(x&1)?(0xedb88320^(x>>>1)):(x>>>1);crcTable[i]=x>>>0;}
function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function zip(files){
 const local=[],central=[];let offset=0;
 for(const [filename,content] of files){
  const name=enc.encode(filename),data=enc.encode(content),crc=crc32(data);
  const lh=new Uint8Array(30+name.length),l=new DataView(lh.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);
  l.setUint16(6,0x0800,true);l.setUint16(8,0,true);
  l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);
  l.setUint16(26,name.length,true);lh.set(name,30);
  local.push(lh,data);
  const ch=new Uint8Array(46+name.length),c=new DataView(ch.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);
  c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
  c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);
  c.setUint16(28,name.length,true);c.setUint32(42,offset,true);ch.set(name,46);
  central.push(ch);offset+=lh.length+data.length;
 }
 if(files.length>65535)throw new Error('Too many XLSX entries');
 const centralBytes=central.reduce((n,b)=>n+b.length,0);
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);
 v.setUint16(10,files.length,true);v.setUint32(12,centralBytes,true);
 v.setUint32(16,offset,true);
 return new Blob([...local,...central,end],{
  type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 });
}
function colName(index){let s='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+((n-1)%26))+s;return s;}
function worksheet(rows,widths){
 const cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
 const body=rows.map((row,i)=>{
  const cells=row.map((value,j)=>{
   if(value===null||value===undefined)return'';
   const cell=colName(j)+(i+1),style=(i===0||i===2)?' s="1"':(typeof value==='number'?' s="2"':'');
   if(typeof value==='number'&&Number.isFinite(value))
    return'<c r="'+cell+'"'+style+' t="n"><v>'+value+'</v></c>';
   return'<c r="'+cell+'"'+style+' t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
  }).join('');
  return'<row r="'+(i+1)+'" ht="'+(i===0?'28':i===2?'24':'21')+'" customHeight="1">'+cells+'</row>';
 }).join('');
 return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>'+
  '<sheetFormatPr defaultRowHeight="21"/><cols>'+cols+'</cols><sheetData>'+body+'</sheetData>'+
  '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.25" footer="0.25"/></worksheet>';
}
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
'<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF303D45"/><name val="Arial"/></font></fonts>'+
'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
'<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF0"/><bgColor indexed="64"/></patternFill></fill></fills>'+
'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
'<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'+
'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment horizontal="right"/></xf>'+
'<xf numFmtId="4" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf></cellXfs>'+
'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'+
'</styleSheet>';
function buildWorkbookBlob(report){
 if(!report||!Array.isArray(report.students)||!Array.isArray(report.payments)||!Array.isArray(report.teacherPayouts))
  throw new Error('بيانات التقرير غير مكتملة.');
 const title=report.courseTitle||'شهر دراسي';
 const summary=[
  ['التقرير المالي — '+title],
  ['الفترة',report.range],
  ['البند','المبلغ (جنيه مصري)'],
  ['إجمالي تكلفة الشهر',report.fee],
  ['عدد الطلاب النشطين',report.activeCount],
  ['نصيب الطالب',report.shareLabel],
  ['إجمالي مدفوعات الطلاب',report.collected],
  ['المتبقي على الطلاب النشطين',report.studentOutstanding],
  ['إجمالي المدفوع للدكتور',report.teacherPaid],
  ['المتبقي للدكتور',report.teacherRemaining],
  ['الرصيد بعد التحويلات',report.cashBalance],
  ['ملاحظة','المبالغ المتبقية على الطلاب والدكتور مستقلة؛ لا تُنسخ دفعات الشهور السابقة.']
 ];
 const students=[
  ['كشف حساب الطلاب — '+title],[],['الطالب','حالة الاشتراك','الحالة المالية','المطلوب','المدفوع','المتبقي','وسيلة التواصل'],
  ...report.students.map(x=>[x.name,x.enrollmentStatus,x.paymentStatus,x.expected,x.paid,x.due,x.contact])
 ];
 const studentPayments=[
  ['سجل دفعات الطلاب — '+title],[],['التاريخ','الطالب','المبلغ','ملاحظة'],
  ...report.payments.map(p=>[p.date,p.student,p.amount,p.notes])
 ];
 const teacherPayments=[
  ['مدفوعات الدكتور عبد المنعم — '+title],[],['التاريخ','المبلغ','ملاحظة'],
  ...report.teacherPayouts.map(p=>[p.date,p.amount,p.notes])
 ];
 const specs=[
  {name:'ملخص الشهر',rows:summary,widths:[37,30]},
  {name:'حساب الطلاب',rows:students,widths:[29,22,25,18,18,18,28]},
  {name:'دفعات الطلاب',rows:studentPayments,widths:[18,30,20,45]},
  {name:'دفعات الدكتور',rows:teacherPayments,widths:[18,22,55]}
 ];
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
  specs.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
  '</Types>';
 const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
  '<bookViews><workbookView/></bookViews><sheets>'+specs.map((s,i)=>
   '<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+
  '</sheets></workbook>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  specs.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
  '<Relationship Id="rId'+(specs.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const files=[
  ['[Content_Types].xml',types],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles],
  ...specs.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',worksheet(s.rows,s.widths)])
 ];
 return zip(files);
}
function download(report){
 const blob=buildWorkbookBlob(report);
 const label=(report.courseTitle||'شهر').replace(/[/\\:*?"<>|\x00-\x1f]+/g,'-').slice(0,65);
 const name='التقرير-المالي-'+label+'.xlsx';
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=name;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
window.NAHW_REPORT_XLSX={download,buildWorkbookBlob};
})();
