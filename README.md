# 追箭计划 · Rocket Launch Tourism Planning

GitHub Pages 静态站：公开发射任务监控 + 2027北京出发国内观礼手册（海南优先，含酒泉等场址）。

预期网址：https://stupidyang.github.io/Rocket-Launch-Tourism-Planning/

## 首次启用 Pages

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. Actions → **Launch monitor and Pages** → **Run workflow**。
3. 必须看到 `deploy` 成功才代表站点上线。`build` 成功、采集成功或上传预览包都不等于部署成功。

连接器能修改代码，但没有 Pages 管理接口。工作流只读取 Pages 配置，不尝试用默认 GITHUB_TOKEN 强行开启站点。未开启时显示警告并跳过部署，保留数据与站点预览包。

## 页面

- `index.html`：监控首页。未来60天及2027中国任务，可切换国内全部场址和海南；按运营主体、日期精度和关键词筛选，支持分页/全部、JSON导出与变化记录。
- `guide.html`：根据原HTML网页化整理的旅行手册。保留12条任务与型号候选线索、14个来源、假期/日期匹配、预约流程、周四晚至周一行程、预算与25项本地准备清单。
- 看板里的2027海南日级任务可带日期进入旅行周计算。仅作计算，不把第三方记录升级为官宣。

## 采集

数据来自 The Space Devs / Launch Library 2（第三方），不是中国官方完整任务表。

- API: https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&mode=normal&hide_recent_previous=true
- 每6小时采集一次，计划北京时间02:17、08:17、14:17、20:17，GitHub调度可能延迟。
- 完整遍历分页，最多12页/1200条安全上限。空表、重复ID、总数变化或缺页均拒绝覆盖上一份完整快照。
- 支持可选 `LL2_TOKEN` repository secret；没有密钥使用免费配额，不把密钥写入网页。
- `data/status.json` 区分最后尝试与最后成功；18小时无成功快照时页面显示过期提示。
- `data/changes.json` 保留最多300条变化。移出待发列表不代表确认成功发射。
- 年、季度、月、精度未知、TBD或暂停任务显示“待定”；日级日期不补00:00；小时级不补分钟。时间统一北京时间。
- 中国运营主体属性为有限人工映射，商业发射场不等于民营；未识别的主体保留未分类。
- 源未公开/未收录、海上任务地点不明、临时任务等可能缺失。网站的“全部”只指所接源的全部公开待发条目。

页面刷新按钮只读取站点快照，不重复拉上游API。后台使用GitHub Actions，不调用LLM，不使用ChatGPT/Codex模型额度。

## 验证和构建

```bash
python -m unittest discover -s tests -v
node tests/test_monitor.cjs
node --check assets/guide.js
python scripts/refresh.py
python scripts/build.py
# 可选浏览器检查，需要系统Chrome及Playwright
python -m pip install playwright==1.57.0
python tests/browser_check.py
```

构建输出 `_site/`，任务快照内嵌进首页以支持离线读取，并提供独立JSON。没有成功快照时显示未初始化，不生成演示任务冒充真实结果。浏览器测试使用真实快照，不把测试记录发布到站点。

## 修改与暂停

修改 `guide.html` 调整攻略；修改 `assets/` 调整样式和交互；修改 `scripts/refresh.py` 调整采集规则。不要将年度候选写入实际待发数据库冒充逐次任务。

在 Actions 中禁用该workflow可暂停自动采集与发布；启用后可手动运行。不涉及其他仓库、其他任务或任何GDR生产开关。

准备清单、预算只保存当前浏览器的localStorage，换设备/换域名不会自动迁移。网站不会代买票、代预约，也不保证发射和观礼。


## 独立官方核验与每日维护

详见 [MONITORING.md](./MONITORING.md)。每日核验维护 `data/editorial.json` 和 `guide.html`；不覆盖采集器拥有的三个JSON文件，不新增竞争采集工作流。官方核验时间、内容变化时间与LL2采集时间分别显示。2027放假调休未核实时保留未知，不推断确定连休。网站展示与导出支持未来60天及2027中国任务，底层完整缓存仍用于分页完整性校验。

首页优先展示官方国家任务线索。LL2计数仅代表所接源已标注2027的条目，不是全国年度发次；未定日期的国家监控主题、商业轨道任务/亚轨道验证、订单和星座目标分区展示，不叠加计数。观礼入口区分历史活动、已售罄产品与已核实当期余位，具体2027场次需另行确认。

## 任务发现与行程流程

首页由 `assets/explorer.js` 合并官方任务与LL2，并统一检索国家监控主题和商业观察。相同任务通过 `editorial.items[].ll2_ids`（可选，稳定LL2 ID数组）关联，保留两类来源和场址证据；不把订单/星座主题计为逐次发射。`assets/monitor.js` 保留日期、位置与安全纯函数。

搜索/目的地/任务方向/日期阶段及打开的详情写入URL，支持分享、刷新、返回。即使目的地没有2027已列任务，也显示独立的预约与旅行入口，不虚构发射补空表。任务详情通过site、mission、可选launch及安全return参数进入手册；年度占位日期不能传成实际行程日期。

CI浏览器测试执行搜索、详情、Escape焦点恢复、Back/Forward、重载、筛选重置、空结果、来源去重、导出、移动端目的地跳转、网络失败保留数据及无JavaScript入口。测试截图仍随现有工作流的browser-test-evidence产物保存，不新增计划任务。

## 近期发射入口

首页“未来60天”按北京时间滚动60个自然日，可通过 `?horizon=60` 分享；“2027全年规划”保留原年度视图。日级以上线索与月/季度/半年重叠待定候选分开统计，年度占位不伪装近期日期。筛选、详情、目的地、行程与导出保留时间范围；每分钟重新排除已过的精确窗口。采集仍使用同一份完整LL2快照，接口失败和过期状态不制造新计划。
