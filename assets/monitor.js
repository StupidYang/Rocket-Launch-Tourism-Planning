/* UTC input; all rendered schedule values use Asia/Shanghai. No guessed precision. */
(function (root) {
  'use strict';
  const ZONE = 'Asia/Shanghai';
  const precise = new Set(['second', 'minute', 'hour', 'day']);
  const statusNames = {1:'准备发射',2:'时间待定',3:'发射成功',4:'发射失败',5:'暂停 / 等待',6:'飞行中',7:'部分失败',8:'时间待确认'};
  const categories = {state:'国有体系',private:'民营', 'state-linked':'国资关联',unknown:'未分类'};
  function validDate(value) { const d = value ? new Date(value) : null; return d && !isNaN(d) ? d : null; }
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
    if(!t.day.startsWith('2027')) return {text:'不在2027出行年',date:null};
    const day=new Date(t.day+'T12:00:00+08:00').getUTCDay();
    const text={5:'周五：优先，另留2天缓冲',6:'周六：合适，另留1天缓冲',0:'周日：无延期缓冲'}[day];
    return {text:text||'需调整周四至周一模板',date:t.day};
  }
  function escape(s) {return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function localized(text) {let s=String(text||'');for(const [a,b]of [['Long March','长征'],['Zhuque','朱雀'],['Tianzhou','天舟'],['Shenzhou','神舟'],['Hyperbola','双曲线'],['Tianlong','天龙'],['Pallas-1','智神星一号'],['Ceres-1','谷神星一号'],['Unknown Payload','载荷未公布']])s=s.replaceAll(a,b);return s;}
  function sourceLink(url) {try {const u=new URL(url);return u.protocol==='https:'&&u.hostname==='ll.thespacedevs.com'?u.href:'#monitor-sources';}catch{return '#monitor-sources';}}
  const api={timing,trip,yearOf,stamp,dateText,escape,sourceLink};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(typeof document==='undefined') return;
  const $=id=>document.getElementById(id);
  let snapshot={items:[]}, health={}, changes={items:[]}, page=1;
  let scope='china';
  const state={query:'',year:'',category:'',certainty:'',pageSize:24};
  function scoped(r) {return scope==='global'||(scope==='hainan'?r.hainan:r.china);}
  function chosen() {
    const q=state.query.trim().toLowerCase();
    return snapshot.items.filter(r=>scoped(r)&&(!state.year||yearOf(r)===state.year)&&(!state.category||r.category===state.category)&&(!state.certainty||(timing(r).known?'known':'tbd')===state.certainty)&&(!q||[localized(r.name),localized(r.rocket),r.name,r.mission,r.rocket,r.operator,r.site,r.pad,r.hainan?'海南 文昌':'',r.china?'中国':''].join(' ').toLowerCase().includes(q))).sort((a,b)=>{
      const x=timing(a),y=timing(b); if(x.known!==y.known)return x.known?-1:1;
      return (validDate(a.net)?.getTime()||Infinity)-(validDate(b.net)?.getTime()||Infinity)||a.name.localeCompare(b.name);
    });
  }
  function renderHealth() {
    const age=snapshot.fetched_at?(Date.now()-new Date(snapshot.fetched_at).getTime())/36e5:Infinity;
    const bad=health.state!=='ok'||age>18||!snapshot.complete;
    $('lm-health').className='lm-health'+(bad?' lm-warning':'');
    $('lm-health').textContent= !snapshot.items.length ? '尚未取得完整任务快照。不是“没有发射任务”，请检查采集状态。' : bad ? `数据需留意：${health.message||'快照已超过18小时未更新'}。最后成功：${stamp(snapshot.fetched_at)}。` : `最近完整采集：${stamp(snapshot.fetched_at)}（北京时间） · ${snapshot.pages}页 / ${snapshot.source_count}条源记录`;
    $('lm-attempt').textContent=`最近尝试 ${stamp(health.last_attempt_at)} · 每6小时检查一次，GitHub调度可能延迟。采集时间不等于官方核验时间。`;
    $('lm-total').textContent=snapshot.items.length;
    $('lm-china').textContent=snapshot.items.filter(r=>r.china).length;
    $('lm-hainan').textContent=snapshot.items.filter(r=>r.hainan).length;
    $('lm-year').textContent=snapshot.items.filter(r=>r.hainan&&yearOf(r)==='2027').length;
  }
  function render() {
    renderHealth();
    const rows=chosen(), size=state.pageSize||Math.max(rows.length,1), pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages);
    $('lm-count').textContent=`筛选出 ${rows.length} 条 · 显示 ${rows.length?(page-1)*size+1:0}–${Math.min(page*size,rows.length)} · 时间均为北京时间`;
    $('lm-cards').innerHTML=rows.slice((page-1)*size,page*size).map(r=>{
      const t=timing(r), travel=trip(r), status=statusNames[r.status_id]||r.status||'状态待定';
      return `<article class="lm-card"><div class="lm-tags"><span class="lm-tag ${r.hainan?'lm-green':''}">${r.hainan?'海南 / 文昌':r.china?'中国':'境外'}</span><span class="lm-tag">${escape(categories[r.category]||'未分类')}</span><span class="lm-tag">${escape(status)}</span></div><h3>${escape(localized(r.name))}</h3><p class="lm-time ${t.expired?'lm-expired':''}">${escape(t.label)}</p><p class="lm-sub">${escape(t.detail)}</p><dl><dt>火箭</dt><dd>${escape(localized(r.rocket))}</dd><dt>运营方</dt><dd>${escape(r.operator)}</dd><dt>场址</dt><dd>${escape(r.site)}<small>${escape(r.pad)}</small></dd><dt>源更新</dt><dd>${r.source_updated_at?escape(stamp(r.source_updated_at)):'待定'}</dd></dl><div class="lm-trip">${escape(travel.text)}${travel.date?` <a href="./guide.html?launch=${travel.date}#calendar">查看这周行程 →</a>`:''}</div><footer><a href="${escape(sourceLink(r.source_url))}" target="_blank" rel="noopener noreferrer">LL2 原始任务记录 ↗</a><span>第三方线索</span></footer></article>`;
    }).join('') || '<div class="lm-empty">当前筛选没有记录。清空搜索或切换“全部年份”；未知年份不归入2027。未列出不代表没有发射计划。</div>';
    $('lm-page').textContent=`第 ${page} / ${pages} 页`;$('lm-prev').disabled=page<=1;$('lm-next').disabled=page>=pages;
    const log=(changes.items||[]).filter(scoped).slice(0,8);
    $('lm-changes').innerHTML=log.map(c=>`<li><b>${escape(c.name)}</b><span>${escape(stamp(c.at))} · ${{added:'新增公开条目',changed:'记录有变化',removed:'已移出待发列表（不等于确认发射成功）'}[c.type]||'变化'}${c.fields?.length?'：'+escape(c.fields.join(' / ')):''}</span></li>`).join('')||'<li>暂无可显示的变化记录。首次采集只建立基线，不编造历史改期。</li>';
  }
  async function readJSON(path) {const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}
  async function refresh() {
    $('lm-refresh').disabled=true;
    try {
      const [d,s,c]=await Promise.all([readJSON('./data/launches.json'),readJSON('./data/status.json'),readJSON('./data/changes.json').catch(()=>({items:[]}))]);
      if(!d.complete||!Array.isArray(d.items)||!d.items.length)throw new Error('非完整快照');
      snapshot=d;health=s;changes=c;page=1;render();
      $('lm-feedback').textContent='已重新读取网站保存的数据；此按钮不直接调用发射源。';
    } catch(e) {
      render();$('lm-feedback').textContent=`读取网站数据失败，${snapshot.items.length?'保留页面内上次完整快照':'当前没有可用任务数据'}。${e.message}`;
    } finally {$('lm-refresh').disabled=false;}
  }
  try {const seed=JSON.parse($('launch-seed')?.textContent||'{}');snapshot=seed.launches||snapshot;health=seed.status||health;changes=seed.changes||changes;}catch{}
  for(const button of document.querySelectorAll('[data-lm-scope]')) button.addEventListener('click',()=>{
    scope=button.dataset.lmScope;page=1;for(const b of document.querySelectorAll('[data-lm-scope]')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}render();
  });
  for(const [id,key] of [['lm-search','query'],['lm-year-filter','year'],['lm-category','category'],['lm-certainty','certainty'],['lm-size','pageSize']]) $(id).addEventListener(id==='lm-search'?'input':'change',e=>{state[key]=key==='pageSize'?Number(e.target.value):e.target.value;page=1;render();});
  $('lm-prev').addEventListener('click',()=>{page--;render();$('lm-list').scrollIntoView({block:'start'});});
  $('lm-next').addEventListener('click',()=>{page++;render();$('lm-list').scrollIntoView({block:'start'});});
  $('lm-clear').addEventListener('click',()=>{for(const [id,key] of [['lm-search','query'],['lm-year-filter','year'],['lm-category','category'],['lm-certainty','certainty']]){$(id).value='';state[key]='';}page=1;render();});
  $('lm-refresh').addEventListener('click',refresh);
  $('lm-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({fetched_at:snapshot.fetched_at,scope,items:chosen()},null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='launch-tasks.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  render(); if(location.protocol!=='file:') refresh();
})(typeof globalThis==='undefined'?this:globalThis);
