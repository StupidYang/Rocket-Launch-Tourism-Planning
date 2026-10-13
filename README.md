# 追箭计划 · Rocket Launch Tourism Planning

GitHub Pages 静态站：公开发射任务监控 + 2027北京出发海南观礼手册。

预期网址：https://stupidyang.github.io/Rocket-Launch-Tourism-Planning/

## 首次启用 Pages

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. Actions → **Launch monitor and Pages** → **Run workflow**。
3. 必须看到 `deploy` 成功才代表站点上线。`build` 成功、采集成功或上传预览包都不等于部署成功。

连接器能修改代码，但没有 Pages 管理接口。工作流只读取 Pages 配置，不尝试用默认 GITHUB_TOKEN 强行开启站点。未开启时显示警告并跳过部署，保留数据与站点预览包。

## 页面

- `index.html`：监控首页。默认中国任务，可切换海南、全球；按年份、运营主体、日期精度和关键词筛选，支持分页/全部、JSON导出与变化记录。
- `guide.html`：根据原HTML网页化整理的旅行手册。保留11条2027候选线索、14个来源、假期/日期匹配、预约流程、周四晚至周一行程、预算与25项本地准备清单。
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
