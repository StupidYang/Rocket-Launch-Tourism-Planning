/* UTC input; all rendered schedule values use Asia/Shanghai. No guessed precision. */
(function (root) {
  'use strict';
  const ZONE = 'Asia/Shanghai';
  const precise = new Set(['second', 'minute', 'hour', 'day']);
  const DAY_MS = 86400000, BEIJING_OFFSET_MS = 8 * 3600000;
  const statusNames = {1:'准备发射',2:'时间待定',3:'发射成功',4:'发射失败',5:'暂停 / 等待',6:'飞行中',7:'部分失败',8:'时间待确认'};
  const categories = {state:'国有体系',private:'民营', 'state-linked':'国资关联',unknown:'未分类'};
  function validDate(value) { const d = value!==null && value!==undefined && value!=='' ? new Date(value) : null; return d && !isNaN(d) ? d : null; }
  function parts(value) {
    const d = validDate(value); if (!d) return null;
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
  }
  function dateText(value) { const p=parts(value); return p ? `${p.year}-${p.month}-${p.day}` : '待定'; }
  function stamp(value) { const p=parts(value); return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` : '尚无成功记录'; }
  function yearOf(r) { const p=String(r.precision||'').toLowerCase(); return validDate(r.net) ? (precise.has(p) ? parts(r.net).year : String(r.net).slice(0,4)) : ''; }
  function timing(r, now=Date.now()) {
    const d=validDate(r.net), p=String(r.precision||'').toLowerCase();
    if(!d) return {label:'待定',detail:'尚未公布可用时间',known:false,day:null};
    if(!precise.has(p) || r.status_id===2 || r.status_id===5) {
      let target=''; const y=String(r.net).slice(0,4), m=String(r.net).slice(5,7);
      if(p==='year') target=`${y}年目标`; else if(p==='month') target=`${y}年${Number(m)}月目标`;
      else if(p==='quarter') target=`${y}年Q${Math.ceil(Number(m)/3)}目标`;
      else if(p==='half year') target=`${y}年${Number(m)<=6?'上':'下'}半年目标`;
      else if(precise.has(p)) target=`源条目暂列 ${dateText(r.net)}，${r.status_id===5?'任务已暂停':'状态仍为TBD'}`;
      return {label:'待定',detail:target || '精度不足，原始时间不作订票依据',known:false,day:null};
    }
    const a=parts(r.net), day=`${a.year}-${a.month}-${a.day}`;
    const bound=validDate(r.window_end)?.getTime() || d.getTime();
    const expired=p==='day' ? Date.parse(day+'T23:59:59+08:00') < now : Math.max(bound,d.getTime()+(p==='hour'?3600000:0))<now;
    const clock=p==='day'?'（时刻待定）':p==='hour'?`${a.hour}时左右`:`${a.hour}:${a.minute}`;
    return {label:`${day} ${clock}`,detail:expired?'原窗口已过，等待源更新':(r.status_id===8?'第三方暂定窗口，待确认':'第三方预计窗口，非官方承诺'),known:true,day,expired};
  }
  function trip(r, now=Date.now()) {
    const t=timing(r,now); if(!r.hainan) return {text:'不匹配海南行程',date:null};
    if(!t.known || t.expired) return {text:'等具体日期再匹配',date:null};
    const day=new Date(t.day+'T12:00:00+08:00').getUTCDay();
    const hour=Number(parts(r.net).hour), precision=String(r.precision||'').toLowerCase();
    const text=day===5&&(precision==='day'||hour<12)?'周五早间或时刻未定：周四晚出发可能赶不上，先核交通与入场':({5:'周五：可研究留2天缓冲，交通与入场尚待核实',6:'周六：可研究留1天缓冲，交通与入场尚待核实',0:'周日：无延期缓冲，先核返程限制'}[day]);
    return {text:text||'需调整周四至周一模板',date:t.day};
  }
  function escape(s) {return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function localized(text) {let s=String(text||'');for(const [a,b]of [["Chang'e 7",'嫦娥七号'],["Chang’e 7",'嫦娥七号'],['Xuntian Telescope','巡天空间望远镜'],['Demo Flight','演示飞行'],['Long March','长征'],['Zhuque','朱雀'],['Tianzhou','天舟'],['Shenzhou','神舟'],['Hyperbola','双曲线'],['Tianlong','天龙'],['Pallas-1','智神星一号'],['Ceres-1','谷神星一号'],['Unknown Payload','载荷未公布']])s=s.replaceAll(a,b);return s;}
  function sourceLink(url) {try {const u=new URL(url);return u.protocol==='https:'&&u.hostname==='ll.thespacedevs.com'?u.href:'#monitor-sources';}catch{return '#monitor-sources';}}
  function domesticLocation(r) {return r.country_code ? r.country_code==='CHN' : /jiuquan|wenchang|xichang|taiyuan|haiyang|酒泉|文昌|西昌|太原|海阳/i.test(r.site||'');}
  // A rolling window contains exactly 60 Beijing calendar dates: today and the
  // following 59 dates. Its start is inclusive and next-midnight end exclusive.
  // China has no DST in the contemporary launch dates supported by this view.
  function nearWindowRange(now=Date.now()) {
    const d=validDate(now);
    if(!d) return {windowStart:null,windowEnd:null,startDay:null,endDay:null,label:'时间范围待确认',days:60,timezone:ZONE};
    const start=Math.floor((d.getTime()+BEIJING_OFFSET_MS)/DAY_MS)*DAY_MS-BEIJING_OFFSET_MS;
    const end=start+60*DAY_MS, startDay=dateText(start), endDay=dateText(end-1);
    return {windowStart:new Date(start).toISOString(),windowEnd:new Date(end).toISOString(),startDay,endDay,label:`${startDay} 至 ${endDay}`,days:60,timezone:ZONE};
  }
  // A coarse source timestamp is a nominal UTC period marker, not a Beijing
  // launch instant. Never turn a quarter/month/year placeholder into a day.
  function nearWindow(r, now=Date.now()) {
    const range=nearWindowRange(now), raw=String(r.precision||'').trim().toLowerCase().replace(/\s+/g,' ');
    const quarter=raw.match(/^quarter\s*([1-4])?$/);
    const half=raw.match(/^(?:year\s*half|half[ -]?year)\s*([12])?$/);
    const precision=quarter?'quarter':half?'half year':raw||'unknown';
    const coarse=['month','quarter','half year'].includes(precision);
    const result={...range,eligible:false,reason:'outside-window',precision,coarse,intervalStart:null,intervalEnd:null,day:null,targetLabel:null};
    const reject=reason=>({...result,reason});
    if(!range.windowStart) return reject('invalid-now');
    if(!r.china || !domesticLocation(r)) return reject('outside-china');
    if([3,4,6,7].includes(Number(r.status_id))) return reject('completed');
    if(precision==='year') return reject('year-only');
    if(!precise.has(precision) && !coarse) return reject('unknown-precision');
    const d=validDate(r.net); if(!d) return reject('invalid-date');
    const start=Date.parse(range.windowStart), end=Date.parse(range.windowEnd), current=validDate(now).getTime();
    let a,b;
    if(coarse) {
      const year=d.getUTCFullYear(), sourceMonth=d.getUTCMonth();
      const month=precision==='month'?sourceMonth:quarter?(quarter[1]?(Number(quarter[1])-1)*3:Math.floor(sourceMonth/3)*3):(half[1]?(Number(half[1])-1)*6:Math.floor(sourceMonth/6)*6);
      const months=precision==='month'?1:quarter?3:6;
      a=Date.UTC(year,month,1)-BEIJING_OFFSET_MS;
      b=Date.UTC(year,month+months,1)-BEIJING_OFFSET_MS;
      result.targetLabel=precision==='month'?`${year}年${month+1}月目标`:quarter?`${year}年Q${month/3+1}目标`:`${year}年${month===0?'上':'下'}半年目标`;
    } else if(precision==='day') {
      result.day=dateText(d);
      a=Date.parse(result.day+'T00:00:00+08:00'); b=a+DAY_MS;
      result.targetLabel=`${result.day}（时刻待定）`;
    } else {
      // Point timestamps have equal interval bounds. Even an hour-precision net
      // in the past is omitted; window_end cannot resurrect an expired net.
      a=d.getTime(); b=a;
      result.day=dateText(d);
      result.targetLabel=timing(r,now).label;
    }
    result.intervalStart=new Date(a).toISOString(); result.intervalEnd=new Date(b).toISOString();
    if(!coarse && precision!=='day' && a<current) return reject('past');
    if(b<start || (b===start && (coarse || precision==='day'))) return reject('past');
    const overlaps=(coarse || precision==='day')?a<end && b>start:a>=start && a<end;
    if(!overlaps) return result;
    return {...result,eligible:true,reason:coarse?'coarse-overlap':'within-window'};
  }
  function tourismScope(r, scope='china') {return Boolean(r.china) && domesticLocation(r) && yearOf(r)==='2027' && (scope!=='hainan'||Boolean(r.hainan));}
  function relevantChange(c, items) {const current=items.find(r=>r.id===c.id);return Boolean(current&&tourismScope(current)) || tourismScope(c) || Boolean(c.china)&&domesticLocation(c)&&[c.before?.net,c.after?.net].some(n=>String(n||'').startsWith('2027'));}
  const api={timing,trip,yearOf,stamp,dateText,escape,sourceLink,tourismScope,relevantChange,localized,domesticLocation,nearWindow,nearWindowRange};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.LaunchMonitor=api;
})(typeof globalThis==='undefined'?this:globalThis);
