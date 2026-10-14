(function () {
  'use strict';

  const SITE_NAMES = {
    hainan: '海南 / 文昌与海南商发',
    jiuquan: '酒泉 / 东风',
    xichang: '西昌',
    taiyuan: '太原相关发射',
    sea: '海上发射 / 海阳相关',
    unknown: '场址尚未确认'
  };
  const SITE_SUMMARIES = {
    hainan: '先按5个日历日 / 4晚估算，含3天海南活动；先确认具体场站与工位、当次开放和可退改交通。',
    jiuquan: '先按4–5天估算；有历史组织观礼实证，当次场次与余位待核实。住宿由准确集合地点反推。',
    xichang: '先按3–4天加弹性缓冲规划；真实观礼团产品页面曾显示售罄，先问新团期与当次余位。',
    taiyuan: '公众发射观礼渠道未核实。先确认实际发射地点与合法开放，暂不锁定天数、交通或住宿城市。',
    sea: '先确认实际海域和合法可见岸线，再定天数与路线。海阳保障或太原中心执行都不等于岸上可见。',
    unknown: '先查实际物理发射场或海域，不由任务名称推定目的地。暂不计算旅行天数，也不默认海南。'
  };

  function validDate(value) {
    if (!/^202[678]-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function travelWeek(value, period) {
    if (!validDate(value)) return { ok: false, text: '请填写2026–2028年范围内的有效日期；输入日期不代表任务仍待发射。' };
    const date = new Date(value + 'T12:00:00Z');
    const day = date.getUTCDay();
    if (![5, 6, 0].includes(day)) {
      return { ok: false, text: value + '为周' + '日一二三四五六'[day] + '，不适配海南周四晚出发、周一返京模板。此处不生成行程；请按实际窗口另定提前到达和返程日期。' };
    }
    if (day === 5 && period === 'early') {
      return { ok: false, text: value + '为周五凌晨 / 上午窗口，默认周四晚到海口方案可能赶不上，不生成可采用的旅行周。请另查更早到达、接驳与合法入场安排；不要据此预订。' };
    }
    const sinceThursday = (day + 3) % 7;
    const departure = new Date(date);
    departure.setUTCDate(date.getUTCDate() - sinceThursday);
    const home = new Date(departure);
    home.setUTCDate(departure.getUTCDate() + 4);
    const start = departure.toISOString().slice(0, 10);
    const end = home.toISOString().slice(0, 10);
    let note = {
      5: '周五窗口，可留周六、周日两天缓冲。',
      6: '周六窗口，可留周日一天缓冲。',
      0: '周日窗口，无延期缓冲；夜间发射可能影响转场。'
    }[day];
    if (!['early', 'late'].includes(period)) note += ' 时段未定，尚不能判断到场是否来得及。';
    if (start.slice(0, 4) !== value.slice(0, 4) || end.slice(0, 4) !== value.slice(0, 4)) note += ' 本模板跨年，交通和假期须覆盖相邻年份。';
    return { ok: true, start, end, text: '海南参考旅行周：' + start + ' 周四晚出发 → ' + end + ' 周一回京。' + note + ' 仅做日期计算，不验证发射、航班、假期或开放。' };
  }

  function safeHomeReturn(raw, href) {
    const home = new URL('./', href);
    if (!raw || raw.length > 3000) return home.href;
    try {
      const target = new URL(raw, home);
      const allowedPaths = [home.pathname, home.pathname + 'index.html'];
      if (!['http:', 'https:'].includes(target.protocol) || target.origin !== home.origin ||
          target.username || target.password || !allowedPaths.includes(target.pathname)) return home.href;
      return target.href;
    } catch {
      return home.href;
    }
  }

  function tripContext(href) {
    const url = new URL(href);
    const params = url.searchParams;
    const hashSite = url.hash.startsWith('#site-') ? url.hash.slice(6) : '';
    let site = params.has('site') ? params.get('site') : 'hainan';
    if (Object.hasOwn(SITE_NAMES, hashSite)) site = hashSite;
    if (!Object.hasOwn(SITE_NAMES, site)) site = 'unknown';
    const mission = (params.get('mission') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
    const launch = validDate(params.get('launch')) ? params.get('launch') : '';
    return { site, mission, launch, period: ['early', 'late'].includes(params.get('period')) ? params.get('period') : 'unknown',
      periodProvided: params.has('period'), invalidLaunch: params.has('launch') && !launch,
      hasContext: params.has('mission') || params.has('launch'),
      returnURL: safeHomeReturn(params.get('return'), href) };
  }

  function storageKey(context) {
    return 'rocket-tour-prep-v2:' + encodeURIComponent(JSON.stringify([
      context.site, context.mission || '', context.launch || ''
    ]));
  }

  function validReturnBy(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return false;
    const date = new Date(value + ':00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
  }

  function constraintText(buffer, returnBy) {
    const waiting = ['0', '1', '2', '3'].includes(String(buffer)) ? '延期最多再等' + buffer + '天' : '延期等待上限尚未决定';
    return waiting + '；最晚回到北京：' + (validReturnBy(returnBy) ? returnBy.replace('T', ' ') + '（北京时间）' : '尚未填写') + '。这些是个人约束，不代表交通或观礼已确认。';
  }

  function buildTripExport(context, itinerary, sources, calculator, constraints) {
    const title = SITE_NAMES[context.site] || SITE_NAMES.unknown;
    const lines = [
      '北京出发观礼方案',
      '地区：' + title,
      '任务：' + (context.mission || '尚未选定具体任务'),
      '窗口：' + (context.launch ? context.launch + '（北京时间，链接带入，仍须核验）' : '没有有效日级窗口，无法确定行程日期'),
      '发射时段：' + (context.period === 'early' ? '凌晨 / 上午（精确时刻待核实）' : context.period === 'late' ? '下午 / 夜间（精确时刻待核实）' : '尚未确认'),
      '预约证据基准：2026-10-13；不实时查询余位。',
      '此方案不是机票、酒店、观礼预约或发射保证。',
      constraintText(constraints && constraints.buffer, constraints && constraints.returnBy), '',
      itinerary.trim(), '',
      '付款前仍须完成：',
      '1. 对照当次官方公告核实任务、实际发射场 / 海域及窗口。',
      '2. 获得合法观礼开放、真实余位、审核、集合与接驳的明确答复。',
      '3. 核实实际交通、住宿、总价与延期 / 取消规则。',
      '4. 明确最晚返京时间，在退改截止前决定出发、改期或放弃。', '',
      '核验来源（历史渠道不能当作当前余位）：',
      ...sources.map(source => source.title + '：' + source.url), '',
      '返回原任务筛选：' + context.returnURL
    ];
    if (context.launch && constraints && validReturnBy(constraints.returnBy) && constraints.returnBy.slice(0, 10) <= context.launch) lines.push('', '时间冲突提醒：最晚返京时间在带入发射日期当天或之前，尚无证据证明能完成观礼及返程；先调整或核实。');
    if (calculator) lines.push('', '海南专用日期工具：', calculator);
    return lines.join('\n');
  }

  // Pure helpers are shared by local Node tests; the site needs no build dependency.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validDate, travelWeek, safeHomeReturn, tripContext, storageKey, buildTripExport, validReturnBy, constraintText };
  }
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  let currentContext = tripContext(location.href);
  let currentKey = storageKey(currentContext);
  let renderedContext = '';
  function loadSaved(context) {
    try {
      const key = storageKey(context);
      let raw = localStorage.getItem(key);
      // Preserve the old unassigned Hainan template without attaching it to a task.
      if (raw === null && context.site === 'hainan' && !context.hasContext) {
        raw = localStorage.getItem('rocket-tour-prep-v1');
      }
      const value = JSON.parse(raw || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {}
    return {};
  }
  let saved = loadSaved(currentContext);
  let currentSite = 'hainan';
  let dateSource = '手动输入，未验证排期';
  const fields = [
    ['people', '同行人数（共享一间房 / 海南交通）', 1],
    ['flight', '往返机票 / 人', 2400],
    ['hotel', '四晚酒店合计 / 全组', 1400],
    ['ground', '海南全部地面交通 / 全组', 900],
    ['food', '餐饮 / 人', 550],
    ['ticket', '观礼服务 / 人', 400],
    ['play', '景点活动 / 人', 150],
    ['beijing', '北京机场交通 / 人', 150],
    ['reserve', '延期改签备用金 / 人', 1500]
  ];
  const groups = [
    ['确定任务与假期', [
      '记录任务、型号、发射场与工位。',
      '保存官方来源、发布时间与北京时间。',
      '核对周四落地和最晚入场，排除赶不上的周五早窗口。',
      '落实周五、周一请假并核对调休。',
      '明确16点是落地北京，还是已经到家 / 公司。',
      '接受延期到周一以后放弃本次等待的止损条件。'
    ]],
    ['预订与通行', [
      '机票退改费、票差与截止时间已确认。',
      '四晚酒店均订妥，跨午夜联系酒店保留。',
      '门票、酒店、接驳的延期 / 取消规则有书面记录。',
      '已确认观礼工位视线、集合、入场与散场。',
      '按当次公安通知完成车辆 / 接驳预约。',
      '租车车牌、司机联系人核对，换牌后重新确认。',
      '周日机场住宿与最晚取消时限已核对。'
    ]],
    ['装备与安全', [
      '证件、订单、二维码和地图留离线副本。',
      '查航司最新充电宝、电池、行李规定。',
      '准备防晒防雨衣物、饮水与简餐，查看当地天气。',
      '舒适步行鞋与耳塞已备好。',
      '充电、存储卡、相机检查，不带无人机擅飞。',
      '不进入管制区、不翻围栏、不去封闭海滩。',
      '个人必需用品与常用药带齐，不疲劳驾驶。'
    ]],
    ['出发前最后核验', [
      '出发前与发射当日重新核验窗口。',
      '司机集合、合法接驳与散场路线再次确认。',
      '周一机场、航站楼、截载与还车时间核对。',
      '备用金已准备，接受可能超出示例预算。',
      '在机酒退改截止前做一次去 / 改期决定。'
    ]]
  ];

  function save() {
    try {
      localStorage.setItem(currentKey, JSON.stringify(saved));
      $('save-note').textContent = '当前规划记录已按任务分别保存到本浏览器，不上传。海南预算与清单仅在海南方案中使用。';
    } catch {
      $('save-note').textContent = '浏览器阻止本地保存，请及时导出记录。';
    }
  }
  function money(value) { return '¥' + Math.round(value).toLocaleString('zh-CN'); }
  function budget() {
    const rawPeople = Number($('b-people').value);
    const people = [1, 2].includes(rawPeople) ? rawPeople : 1;
    let base = 0;
    for (const [id] of fields) {
      let value = Number($('b-' + id).value);
      if (!Number.isFinite(value) || value < 0) value = 0;
      value = Math.min(value, 100000);
      saved['b-' + id] = id === 'people' ? people : value;
      if (!['people', 'hotel', 'ground', 'reserve'].includes(id)) base += value;
    }
    base += (saved['b-hotel'] + saved['b-ground']) / people;
    const total = base + saved['b-reserve'];
    $('budget-per').textContent = money(total);
    $('budget-base').textContent = '基础约 ' + money(base) + ' / 人';
    $('budget-group').textContent = '全组基础 ' + money(base * people) + '；含备用金 ' + money(total * people);
    save();
  }
  $('budget-fields').innerHTML = fields.map(([id, label, value]) =>
    `<div class="field"><label for="b-${id}">${label} ${id === 'people' ? '' : '（元）'}</label>${id === 'people' ?
      '<select id="b-people"><option value="1">1人独行</option><option value="2">2人同行</option></select>' :
      `<input id="b-${id}" type="number" min="0" max="100000" value="${value}">`}</div>`).join('');
  for (const [id, , fallback] of fields) {
    const el = $('b-' + id);
    const value = Number(saved['b-' + id]);
    el.value = Number.isFinite(value) && value >= 0 && value <= 100000 &&
      (id !== 'people' || [1, 2].includes(value)) ? value : fallback;
    el.addEventListener('input', budget);
    el.addEventListener('change', budget);
  }

  let index = 0;
  $('check-groups').innerHTML = groups.map(([title, items]) =>
    `<div class="panel check-group"><h3>${title}</h3>${items.map(text => {
      const id = 'c' + index++;
      return `<label class="check"><input type="checkbox" id="${id}"><span>${text}</span></label>`;
    }).join('')}</div>`).join('');
  const boxes = [...document.querySelectorAll('.check input')];
  function progress() {
    const count = boxes.filter(el => el.checked).length;
    $('check-progress').textContent = `已完成 ${count} / ${boxes.length}（海南模板）`;
    $('check-bar').value = count;
    for (const el of boxes) saved[el.id] = el.checked;
    save();
  }
  for (const el of boxes) {
    el.checked = saved[el.id] === true;
    el.addEventListener('change', progress);
  }
  $('budget-reset').addEventListener('click', () => {
    for (const [id, , value] of fields) $('b-' + id).value = value;
    budget();
  });
  $('reset-checks').addEventListener('click', () => {
    if (confirm('清空本浏览器的海南模板全部勾选？预算不会删除。')) {
      for (const el of boxes) el.checked = false;
      progress();
    }
  });

  function dateCalc() {
    if (currentSite !== 'hainan') {
      $('date-result').textContent = '当前选择' + SITE_NAMES[currentSite] + '，海南周末日期工具不适用。请先按上方地区方案核验实际路线。';
      return;
    }
    const value = $('launch-date').value;
    const period = $('launch-period').value;
    const result = travelWeek(value, period);
    $('date-result').textContent = result.text + (validDate(value) ? ' 日期来源：' + dateSource + '。' : '');
    if (validDate(value)) {
      saved.date = value;
      saved.period = period;
      save();
    }
  }
  $('date-calc').addEventListener('click', dateCalc);
  function invalidateChecks(reason) {
    if (boxes.some(box => box.checked)) {
      for (const box of boxes) box.checked = false;
      progress();
      $('trip-selection-note').textContent = reason + '原勾选已清除，请重新核验；预算保留。';
    }
  }
  $('launch-date').addEventListener('input', () => {
    if ($('launch-date').value !== (saved.date || currentContext.launch)) invalidateChecks('发射日期已改变，');
    dateSource = '手动输入，未验证排期';
    $('date-result').textContent = '日期已修改，请点击计算；输入日期不代表官方排期。';
  });
  $('launch-period').addEventListener('change', () => {
    if ($('launch-period').value !== (saved.period || 'unknown')) invalidateChecks('发射时段已改变，');
    $('date-result').textContent = '时段已修改，请重新计算。';
  });
  $('launch-period').value = ['early', 'late', 'unknown'].includes(saved.period) ? saved.period : 'unknown';

  function renderTrip() {
    const context = tripContext(location.href);
    const signature = JSON.stringify(context);
    if (signature === renderedContext) return;
    renderedContext = signature;
    currentContext = context;
    const nextKey = storageKey(context);
    if (nextKey !== currentKey) {
      currentKey = nextKey;
      saved = loadSaved(context);
      for (const [id, , fallback] of fields) {
        const value = Number(saved['b-' + id]);
        $('b-' + id).value = Number.isFinite(value) && value >= 0 && value <= 100000 &&
          (id !== 'people' || [1, 2].includes(value)) ? value : fallback;
      }
      for (const box of boxes) box.checked = saved[box.id] === true;
      $('launch-period').value = ['early', 'late', 'unknown'].includes(saved.period) ? saved.period : 'unknown';
      budget();
      progress();
    }
    currentSite = context.site;
    $('trip-buffer').value = ['0', '1', '2', '3'].includes(String(saved.tripBuffer)) ? saved.tripBuffer : 'unknown';
    $('trip-returnby').value = validReturnBy(saved.tripReturnBy) ? saved.tripReturnBy : '';
    $('trip-site').value = currentSite;
    for (const article of document.querySelectorAll('[data-trip-site]')) {
      article.hidden = article.dataset.tripSite !== currentSite;
    }
    $('trip-hero-title').textContent = '北京 → ' + SITE_NAMES[currentSite];
    $('trip-hero-summary').textContent = SITE_SUMMARIES[currentSite];
    const lines = [context.mission ? '正在规划：' + context.mission + '。' : '按地区浏览：' + SITE_NAMES[currentSite] + '。'];
    if (context.launch) lines.push('链接带入日期：' + context.launch + '（北京时间；须核验，不代表官宣）。' + (context.period !== 'unknown' ? '时段：' + (context.period === 'early' ? '凌晨 / 上午' : '下午 / 夜间') + '，精确时刻仍须核实。' : '发射时段尚未确认。'));
    else lines.push('未带入有效的日级窗口，暂不能匹配确定假期或订票。');
    if (context.invalidLaunch) lines.push('链接日期无效或不在支持的2026–2028年范围，已忽略。');
    if (context.mission) lines.push('页面地区来自所选链接，实际发射场仍须由当次任务公告确认。');
    $('trip-context').textContent = lines.join(' ');
    $('trip-context').style.overflowWrap = 'anywhere';
    for (const link of document.querySelectorAll('[data-return-link]')) {
      link.href = context.returnURL;
      if (link.getAttribute('class') !== 'brand') link.textContent = new URL(context.returnURL).search ? '← 返回任务看板（保留原筛选）' : '← 返回任务看板';
    }
    const hainan = currentSite === 'hainan';
    const controls = [$('launch-date'), $('launch-period'), $('date-calc'), $('budget-reset'),
      $('reset-checks'), $('export-checks'), ...fields.map(([id]) => $('b-' + id)), ...boxes];
    for (const control of controls) control.disabled = !hainan;
    $('trip-tool-scope').textContent = hainan ?
      '已选择海南。下方日期工具、四晚预算和25项勾选清单采用海南示例；它们不是实时报价或预约结果。' :
      '已选择' + SITE_NAMES[currentSite] + '。下方海南日期、预算和勾选工具已停用，保留原有海南记录；不会用于当前目的地。需要海南模板时，请在上方切回海南。';
    for (const id of ['calendar', 'budget', 'checklist']) {
      let notice = $(id + '-scope');
      if (!notice) {
        notice = document.createElement('p');
        notice.id = id + '-scope';
        notice.className = 'note warn';
        $(id).insertBefore(notice, $(id).firstChild);
      }
      notice.hidden = hainan;
      notice.textContent = '当前地区：' + SITE_NAMES[currentSite] + '。以下为海南专用示例，工具已停用，请参考上方所选地区方案。';
    }
    if (hainan) {
      const incomingDateChanged = context.launch && validDate(saved.date) && saved.date !== context.launch;
      const incomingPeriodChanged = context.launch && context.periodProvided &&
        ['early', 'late', 'unknown'].includes(saved.period) && saved.period !== context.period;
      if (incomingDateChanged || incomingPeriodChanged) {
        invalidateChecks('链接窗口与此前确认的日期或时段不同，');
      }
      $('launch-date').value = context.launch || (validDate(saved.date) ? saved.date : '');
      if (context.launch && context.periodProvided) $('launch-period').value = context.period;
      else if (context.hasContext && !['early', 'late', 'unknown'].includes(saved.period)) $('launch-period').value = 'unknown';
      dateSource = context.launch ? '链接带入，未验证排期' : (context.mission ? '本任务的历史输入，仍须核验' : '本浏览器历史输入，不代表当前任务');
      if ($('launch-date').value) dateCalc();
      else $('date-result').textContent = '未填有效日期。年度、季度、月份或假期模板不能当作具体发射日。';
    } else {
      $('launch-date').value = '';
      dateCalc();
    }
    updateConstraints();
    $('copy-status').textContent = '';
    $('trip-export-status').textContent = '';
  }

  function updateConstraints() {
    saved.tripBuffer = $('trip-buffer').value;
    saved.tripReturnBy = validReturnBy($('trip-returnby').value) ? $('trip-returnby').value : '';
    let text = constraintText(saved.tripBuffer, saved.tripReturnBy);
    if (currentContext.launch && saved.tripReturnBy) {
      const returnDay = saved.tripReturnBy.slice(0, 10);
      if (returnDay < currentContext.launch) text += ' 注意：返京上限早于带入的发射日期，当前条件冲突，应调整窗口或放弃等待。';
      else if (returnDay === currentContext.launch) text += ' 注意：要求发射当日返京，尚未核实散场与交通能否满足，不能据此确认可行。';
    }
    $('trip-constraints').textContent = text;
    const context = currentContext;
    const mission = context.mission || '【任务名称】';
    const when = context.launch ? context.launch + '（日期仍待核实）' : '【北京时间】';
    const site = currentSite === 'unknown' ? '【实际发射场 / 工位】' : SITE_NAMES[currentSite] + '【具体场站 / 工位待核实】';
    $('vendor-message').textContent = '我从北京出发，正在核实' + mission + '于' + when + '在' + site + '的实际发射观礼。请确认任务与日期是否准确、本场次是否开放、是否有余位、身份审核要求、准确集合和观礼地址、能否看到该工位点火升空、最晚入场、是否需单独车辆预约、散场接驳，以及发射延期或取消时门票、房间和接驳的退改规则。若售观礼房，请确认房型、楼层、可视方向与遮挡，并提供书面说明。我需于' + (validReturnBy(saved.tripReturnBy) ? saved.tripReturnBy.replace('T', ' ') + '（北京时间）' : '【最晚返京时间】') + '返回北京，请告知改期办理截止时间。';
    save();
  }
  $('trip-buffer').addEventListener('change', updateConstraints);
  $('trip-returnby').addEventListener('change', updateConstraints);

  function chooseSite(site) {
    const url = new URL(location.href);
    const changed = currentSite !== site;
    const clearedContext = changed && (url.searchParams.has('mission') || url.searchParams.has('launch'));
    url.searchParams.set('site', site);
    if (changed) {
      // A destination comparison must not silently relocate the original mission.
      url.searchParams.delete('mission');
      url.searchParams.delete('launch');
      url.searchParams.delete('period');
    }
    url.hash = 'trip-planner';
    history.pushState(null, '', url);
    renderTrip();
    $('trip-selection-note').textContent = clearedContext ? '已改为地区规划，原任务与日期已清除；浏览器返回可恢复原任务。' : '';
  }
  $('trip-site').addEventListener('change', () => chooseSite($('trip-site').value));
  for (const link of document.querySelectorAll('a[href^="#site-"]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      chooseSite(link.getAttribute('href').slice(6));
      $('trip-planner').scrollIntoView();
    });
  }
  function restoreTrip() {
    $('trip-selection-note').textContent = '';
    renderTrip();
  }
  window.addEventListener('popstate', restoreTrip);
  window.addEventListener('hashchange', restoreTrip);
  $('copy-vendor').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('vendor-message').textContent);
      $('copy-status').textContent = ' 已复制，请补齐待核实信息后自行发送。';
    } catch {
      $('copy-status').textContent = ' 自动复制不可用，请手动选择上方文字。';
    }
  });
  $('print-guide').addEventListener('click', () => window.print());
  function downloadText(text, filename) {
    const link = document.createElement('a');
    const objectURL = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    link.href = objectURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  }
  $('export-trip').addEventListener('click', () => {
    const context = tripContext(location.href);
    const article = $('site-' + context.site);
    const sources = [...article.querySelectorAll('a')].map(link => ({
      title: link.textContent.trim(), url: link.href
    }));
    const text = buildTripExport(context, article.innerText || article.textContent, sources,
      context.site === 'hainan' ? '当前输入日期：' + ($('launch-date').value || '未填写') + '（未验证排期）。\n' + $('date-result').textContent : '', { buffer: saved.tripBuffer, returnBy: saved.tripReturnBy });
    try {
      downloadText(text, '北京出发-' + context.site + (context.launch ? '-' + context.launch : '') + '-观礼方案.txt');
      $('trip-export-status').textContent = '已生成文字方案，包含任务、地区、窗口状态、核验来源与下一步。文件下载请查看浏览器。';
    } catch {
      $('trip-export-status').textContent = '无法下载文件，请复制上方方案与来源保存。';
    }
  });
  $('export-checks').addEventListener('click', () => {
    const text = [
      '海南四晚模板准备记录',
      '导出时间：' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      '任务：' + (currentContext.mission || '未选定任务的通用模板'),
      '场址：' + SITE_NAMES[currentContext.site],
      '链接窗口：' + (currentContext.launch || '尚无有效日级日期') + '；须核验，不代表官方排期。',
      '当前日期输入：' + ($('launch-date').value || '未填写') + '；时段：' + ({ early: '凌晨 / 上午', late: '下午 / 夜间', unknown: '尚未确认' }[$('launch-period').value]),
      constraintText(saved.tripBuffer, saved.tripReturnBy),
      '仅用于海南示例；勾选不等于已预约或获得许可。', '',
      ...boxes.map(el => (el.checked ? '[x] ' : '[ ] ') + el.nextElementSibling.textContent), '',
      ...fields.map(([id, label]) => label + ': ' + $('b-' + id).value),
      $('budget-per').textContent, $('date-result').textContent
    ].join('\n');
    downloadText(text, '海南追箭准备记录' + (currentContext.launch ? '-' + currentContext.launch : '') + '.txt');
  });
  budget();
  progress();
  renderTrip();
})();
