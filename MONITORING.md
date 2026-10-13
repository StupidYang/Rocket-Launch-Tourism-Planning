# 2027国内追箭维护约定

## 范围与分工

北京出发、全国国内发射场，海南优先，也包含酒泉、太原、西昌及可核实的海上任务。排除境外任务；年度不明的条目不能强塞入2027。旅行计划须按场址调整，不把海南周四晚至周一模板套给全国。

- 现有 `.github/workflows/site.yml`（Launch monitor and Pages）继续每6小时采集LL2全分页并部署。保留全量原始缓存用于完整性校验；网页与导出只展示2027中国任务。
- 每日独立核验到2027-12-31：官方发射/研发公告、任务改期、当次观礼与交通管控、2027正式放假调休以及假期与真实发射窗口的重合。不另建竞争的LL2轮询或网站部署工作流。
- 只在有依据时更新具体计划，失败不补造数据，也不把年度占位日期当作真实发射日。

## 持久文件与覆盖边界

- `data/editorial.json`：独立官方/第三方核验、来源、假期状态。每日维护的主文件；6小时采集器不写它。保持schema_version、items、holidays和时间字段结构。
- `guide.html`：候选线索、全国场址核验、北京出发的分地区旅行方案、海南详细模板、预算与注意事项。
- `index.html` / `assets/monitor.js` / `assets/site.css`：页面、筛选与布局。只作有价值的改进，不为每天提交而改样式。
- `data/launches.json`、`data/status.json`、`data/changes.json`：LL2采集器拥有的文件，不手工把官方年度候选塞入它们；下次自动刷新会覆盖。
- `scripts/build.py` 将editorial独立文件复制到站点并嵌入首页。无网络时仍可查看最后成功记录。

## 日核验流程

1. 读最新main、README、本约定、editorial、采集状态和现有页面。先核实昨日变动是否仍成立。
2. 官方优先：中国载人航天工程、国家航天局、航天科技集团、中科院相关任务机构、火箭公司、海南/文昌及各场址当地政府、公安/海事；LL2和Next Spaceflight仅作发现线索。
3. 每条事实保留具体原文页URL、标题、发布日期（可查到时）、证据级别和支持的内容。年度计划、具备首飞条件、实际飞行计划、精确窗口、公众观礼开放分别表达，不互相升级。
4. 保留 `last_attempt_at`（本轮尝试）、`checked_at`（最近成功核验）、`content_updated_at`（实质结论最近变化）。失败只更新尝试和check_status/error，保留成功时间、旧结论和来源；部分核验标记partial，列明未核验范围，不报全部成功。
5. 2027正式调休未核实时维持unknown。官方发布后保存通知直链，按北京时间匹配日级或更细窗口及补班；假期重合不等于确认开放观礼。年度/月度目标不生成确定请假天数或订票建议。
6. 全国旅游方案优先列交通方案、预计天数、退改/延期缓冲、合法开放和返程限制；班次、票价、住宿价格须实时核实，不沿用旧示例作报价。海南优先，酒泉及其他场址保持可独立使用的建议。
7. 无新事实且核验成功可只更新时间，失败保留旧结果。提醒仅在重要窗口、假期重合、改期取消、场地变化或阻塞需要用户知道时发送。

## 验证与发布

```sh
python -m unittest discover -s tests -v
node tests/test_monitor.cjs
node --check assets/guide.js
node --check assets/monitor.js
python scripts/build.py
python tests/browser_check.py
```

浏览器测试需要Playwright与Chromium。先验证JSON、日期精度、国内2027筛选、来源链接、假期未知状态、移动端、清空筛选、预算与本地清单持久化。不可用的检查要明确记录，不宣称全部通过。

获取当前main头并以expected_sha做非强制快进提交，避免覆盖采集器刚写入的数据。网站改动push到main触发现有测试、采集、构建、Pages发布；只变data/**或README的push被paths-ignore忽略，下次6小时流程会发布（有必要即时发布时使用已授权的现有工作流手动运行，不建新workflow）。确认远端commit，再检查对应Actions任务的build和deploy成功；仅build绿灯不足以声明上线。

主页：https://stupidyang.github.io/Rocket-Launch-Tourism-Planning/
旅行手册：https://stupidyang.github.io/Rocket-Launch-Tourism-Planning/guide.html
