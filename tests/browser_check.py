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
        assert await page.locator('.finder-card').count() == before
        assert '更新失败' in await page.locator('#lm-health').inner_text()
        await page.unroute('**/data/*.json')
        await page.screenshot(path=str(shots/'finder-mobile.png'), full_page=True)
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
