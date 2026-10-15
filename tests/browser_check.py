"""Exercise the actual built discovery-to-trip journey. Test fixtures are never published."""
import asyncio
import functools
import http.server
import json
import shutil
import threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

async def check():
    out = ROOT / '_site'
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    shots = ROOT / 'test-results'
    shots.mkdir(exist_ok=True)
    async with async_playwright() as p:
        executable = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
        browser = await p.chromium.launch(headless=True, executable_path=executable)
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(base, wait_until='networkidle')
        total = await page.locator('.finder-card').count()
        assert total >= 5, 'Independent candidates must be discoverable beyond the three LL2 rows'
        assert '不是全国发射总数' in await page.locator('#lm-count').inner_text()
        await page.locator('#lm-search').fill('轻舟')
        assert await page.locator('.finder-card').count() == 1
        await page.locator('[data-open]').click()
        assert '轻舟' in await page.locator('#detail-heading').inner_text()
        assert await page.locator('#detail-heading').evaluate('(e)=>e===document.activeElement')
        assert '未确认实际发射场址' in await page.locator('#detail-content').inner_text()
        assert 'site=unknown' in await page.locator('[data-trip-link]').get_attribute('href')
        await page.keyboard.press('Escape')
        await page.wait_for_function('!new URL(location.href).searchParams.has("mission")')
        assert not await page.locator('#mission-detail').is_visible()
        assert await page.locator('[data-open]').evaluate('(e)=>e===document.activeElement')
        await page.locator('[data-open]').click()
        deep_link = page.url
        await page.go_back()
        assert not await page.locator('#mission-detail').is_visible()
        assert await page.locator('#lm-search').input_value() == '轻舟'
        await page.go_forward()
        assert await page.locator('#mission-detail').is_visible()
        await page.reload(wait_until='networkidle')
        assert page.url == deep_link
        assert await page.locator('#detail-heading').evaluate('(e)=>e===document.activeElement')
        assert '轻舟' in await page.locator('#detail-heading').inner_text()
        await page.locator('#detail-close').click()
        await page.wait_for_function('!new URL(location.href).searchParams.has("mission")')
        assert not await page.locator('#mission-detail').is_visible()
        await page.locator('#lm-search').fill('酒泉')
        assert await page.locator('.finder-card').count() >= 1
        assert '酒泉' in await page.locator('#destination-result').inner_text()
        await page.locator('#stage-filter').select_option('dated')
        assert await page.locator('.finder-card').count() == 0
        assert await page.locator('#lm-empty').is_visible()
        assert '预约与北京出发行程' in await page.locator('#destination-result').inner_text()
        await page.locator('#empty-reset').click()
        for selector in ['#site-filter','#kind-filter','#stage-filter','#lm-search']:
            assert await page.locator(selector).input_value() == ''
        assert await page.locator('.finder-card').count() == total
        await page.locator('#kind-filter').select_option('commercial')
        assert await page.locator('.finder-card').count() > 0
        assert all('商业与应用' in t for t in await page.locator('.finder-card').all_inner_texts())
        await page.locator('#lm-clear').click()
        await page.locator('#lm-search').fill('嫦娥七号')
        assert await page.locator('.finder-card').count() == 1, 'Official and LL2 records must be deduplicated'
        await page.locator('[data-open]').click()
        assert 'NARIT' in await page.locator('#detail-content').inner_text()
        assert 'site=hainan' in await page.locator('[data-trip-link]').get_attribute('href')
        assert 'launch=' not in await page.locator('[data-trip-link]').get_attribute('href'), 'Annual placeholder must not become a dated trip'
        async with page.expect_download() as download_info:
            await page.locator('#lm-export').click()
        download = await download_info.value
        result = json.loads(Path(await download.path()).read_text())
        assert len(result['items']) == 1 and result['items'][0]['name'] == '嫦娥七号'
        await page.locator('#lm-clear').click()
        await page.screenshot(path=str(shots/'finder-desktop.png'), full_page=True)
        await page.set_viewport_size({'width':390,'height':844})
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.locator('#site-filter').select_option('xichang')
        assert await page.locator('#destination-result a').count() == 1
        await page.locator('#destination-result a').click()
        assert '#trip-planner' in page.url and 'site=xichang' in page.url
        assert '西昌' in await page.locator('#trip-planner').inner_text()
        await page.screenshot(path=str(shots/'trip-mobile.png'), full_page=True)
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert await page.locator('#trip-site').input_value() == 'xichang'
        assert not await page.locator('#date-calc').is_enabled()
        assert not await page.locator('#b-flight').is_enabled()
        assert not await page.locator('#c0').is_enabled()
        await page.locator('[data-return-link]').first.click()
        assert await page.locator('#site-filter').input_value() == 'xichang'
        # Different mission, destination or window must not inherit confirmed preparation.
        task_a = base + '/guide.html?site=hainan&mission=Task-A&launch=2027-04-02&period=late#trip-planner'
        await page.goto(task_a, wait_until='networkidle')
        assert await page.locator('#launch-period').input_value() == 'late'
        assert '2027-04-01' in await page.locator('#date-result').inner_text()
        await page.locator('#c0').check()
        await page.reload(wait_until='networkidle')
        assert await page.locator('#c0').is_checked()
        await page.goto(base + '/guide.html?site=hainan&mission=Task-A&launch=2027-04-02&period=early#trip-planner', wait_until='networkidle')
        assert not await page.locator('#c0').is_checked(), 'A changed time window must invalidate confirmations'
        assert await page.locator('#launch-period').input_value() == 'early'
        await page.goto(base + '/guide.html?site=hainan&mission=Task-B&launch=2027-04-02#trip-planner', wait_until='networkidle')
        assert not await page.locator('#c0').is_checked()
        assert await page.locator('#launch-period').input_value() == 'unknown'
        await page.locator('#trip-buffer').select_option('2')
        await page.locator('#trip-returnby').fill('2027-04-05T16:00')
        await page.locator('#trip-returnby').press('Tab')
        async with page.expect_download() as plan_info:
            await page.locator('#export-trip').click()
        plan_download = await plan_info.value
        plan_text = Path(await plan_download.path()).read_text()
        assert 'Task-B' in plan_text and '2027-04-02' in plan_text and '2' in plan_text
        await page.locator('#c0').check()
        await page.locator('#launch-date').fill('2027-04-05')
        await page.locator('#date-calc').click()
        assert '不生成行程' in await page.locator('#date-result').inner_text()
        assert '2027-04-08' not in await page.locator('#date-result').inner_text()
        assert not await page.locator('#c0').is_checked(), 'Changing the date must invalidate old confirmations'
        await page.locator('#c0').check()
        await page.reload(wait_until='networkidle')
        assert not await page.locator('#c0').is_checked(), 'Restoring the original URL date must not reuse checks for the manual date'
        await page.goto(base + '/guide.html?site=hainan&mission=Early&launch=2027-04-02&period=early#trip-planner', wait_until='networkidle')
        assert '可能赶不上' in await page.locator('#date-result').inner_text()
        await page.locator('#trip-site').select_option('jiuquan')
        assert not await page.locator('#date-calc').is_enabled()
        assert '酒泉' in await page.locator('#trip-context').inner_text()
        # Network failure must retain embedded, last-known records and explain the failure.
        await page.goto(base, wait_until='networkidle')
        await page.route('**/data/*.json', lambda route: route.abort())
        before = await page.locator('.finder-card').count()
        await page.locator('#lm-refresh').click()
        await page.wait_for_function("document.getElementById('lm-health').textContent.includes('更新失败') && !document.getElementById('lm-refresh').disabled")
        assert await page.locator('.finder-card').count() == before
        assert '更新失败' in await page.locator('#lm-health').inner_text()
        await page.unroute('**/data/*.json')
        await page.screenshot(path=str(shots/'finder-mobile.png'), full_page=True)
        # Deterministic near-term fixture exercises real UI without publishing invented tasks.
        near_context = await browser.new_context(viewport={'width':1440,'height':1000})
        near_page = await near_context.new_page()
        near_page.on('pageerror', lambda e: errors.append(str(e)))
        from datetime import datetime, timezone
        await near_page.clock.install(time=datetime(2026,10,14,7,0,tzinfo=timezone.utc))
        fixture = json.loads((out/'data/launches.json').read_text())
        common = {'china':True,'country_code':'CHN','site':'Wenchang Space Launch Site','hainan':True,'category':'state','status_id':1,'source_url':'https://ll.thespacedevs.com/','operator':'Test','rocket':'Test'}
        fixture['items'] = [dict(common,id='test-near-day',name='近期交互测试',net='2026-10-16T06:00:00Z',precision='Hour'),dict(common,id='test-near-month',name='月份候选测试',net='2026-10-31T00:00:00Z',precision='Month',status_id=2),dict(common,id='test-past',name='已过窗口测试',net='2026-10-13T06:00:00Z',precision='Minute'),dict(common,id='test-year',name='年度占位测试',net='2026-12-31T00:00:00Z',precision='Year')]
        editorial_fixture=json.loads((out/'data/editorial.json').read_text())
        editorial_fixture['near_term']=[{'id':'test-assessment','name':'神舟二十四研判交互测试','assessment_month':'2026-11','site_key':'jiuquan','group':'national','target_window':'测试预计11月前后，非官宣','assessment':'测试背景分析，不代表真实任务新增证据','confidence':'中低','missing_confirmations':['最新窗口','当次开放'],'review_by':'2026-10-15T04:00:00Z','action':'先咨询预登记','sources':[{'title':'测试来源日期','url':'https://example.com/source','published_at':'2026-05-25'}]}]
        editorial_fixture['recent_outcomes']=[{'id':'test-completed','name':'历史完成交互测试','confirmed':True,'country_code':'CHN','occurred_at':'2026-10-13T11:40:00Z','result_text':'测试已完成','sources':[{'title':'测试结果来源','url':'https://example.com/official'}]}]
        await near_page.route('**/data/editorial.json', lambda route: route.fulfill(json=editorial_fixture))
        await near_page.route('**/data/launches.json', lambda route: route.fulfill(json=fixture))
        await near_page.goto(base+'/?horizon=60',wait_until='networkidle')
        assert await near_page.locator('[data-horizon="60"]').get_attribute('aria-pressed') == 'true'
        assert '60个自然日' in await near_page.locator('#horizon-note').inner_text()
        assert '历史完成交互测试' in await near_page.locator('#lm-changes').inner_text()
        assert '历史完成交互测试' not in await near_page.locator('#lm-cards').inner_text()
        assert '历史，不计未来任务' in await near_page.locator('#lm-changes').inner_text()
        assert '已过窗口测试' not in await near_page.locator('#lm-cards').inner_text()
        assert '年度占位测试' not in await near_page.locator('#lm-cards').inner_text()
        await near_page.locator('#stage-filter').select_option('inference')
        await near_page.locator('#lm-search').fill('神舟二十四')
        assert await near_page.locator('.finder-card').count() == 1
        await near_page.locator('[data-open]').click()
        detail=await near_page.locator('#detail-content').inner_text()
        assert all(word in detail for word in ['判断依据','中低','尚缺确认','复核期限','现在可做','2026-05-25'])
        assert 'launch=' not in await near_page.locator('[data-trip-link]').get_attribute('href')
        await near_page.locator('#lm-clear').click()
        await near_page.locator('#stage-filter').select_option('dated')
        assert await near_page.locator('.finder-card').count() == 1
        await near_page.locator('[data-open]').click()
        href=await near_page.locator('[data-trip-link]').get_attribute('href')
        assert 'launch=2026-10-16' in href and 'period=late' in href and 'horizon%3D60' in href
        await near_page.locator('[data-trip-link]').click()
        assert await near_page.locator('#launch-date').input_value() == '2026-10-16'
        assert '2026-10-15' in await near_page.locator('#date-result').inner_text()
        await near_page.locator('[data-return-link]').first.click()
        assert 'horizon=60' in near_page.url
        await near_page.locator('#lm-clear').click()
        assert await near_page.locator('[data-horizon="60"]').get_attribute('aria-pressed') == 'true'
        await near_page.locator('#stage-filter').select_option('overlap')
        await near_page.locator('#lm-search').fill('月份候选测试')
        await near_page.locator('[data-open]').click()
        assert 'launch=' not in await near_page.locator('[data-trip-link]').get_attribute('href')
        await near_page.locator('[data-horizon="2027"]').click()
        assert '2027全年规划' in await near_page.locator('#horizon-note').inner_text()
        await near_page.go_back()
        assert await near_page.locator('[data-horizon="60"]').get_attribute('aria-pressed') == 'true'
        await near_page.locator('#lm-clear').click()
        await near_page.screenshot(path=str(shots/'near-desktop.png'),full_page=True)
        await near_page.set_viewport_size({'width':390,'height':844})
        await near_page.screenshot(path=str(shots/'near-mobile-results.png'),full_page=True)
        await near_page.locator('#lm-clear').click()
        await near_page.locator('#site-filter').select_option('xichang')
        assert await near_page.locator('#lm-empty').is_visible()
        assert await near_page.locator('#destination-result a').count() == 1
        assert await near_page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await near_page.screenshot(path=str(shots/'near-mobile.png'),full_page=True)
        await near_context.close()
        # A fresh no-JavaScript reader still has useful, direct guide and booking links.
        nojs = await browser.new_context(java_script_enabled=False)
        nojs_page = await nojs.new_page()
        await nojs_page.goto(base, wait_until='load')
        assert await nojs_page.locator('noscript a[href="./guide.html#trip-planner"]').is_visible()
        assert await nojs_page.locator('noscript a[href="./guide.html#booking-routes"]').is_visible()
        await nojs.close()
        assert not errors, errors
        await browser.close()
    server.shutdown()
    print('Journey checks passed: unified search, deduplication, unknown-site boundary, destination fallback, all-filter reset, task details, focus/Escape, Back/Forward/reload, scoped export, mobile handoff, data failure and no-JS fallback.')

if __name__ == '__main__':
    asyncio.run(check())
