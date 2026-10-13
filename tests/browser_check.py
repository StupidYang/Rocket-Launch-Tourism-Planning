"""Browser smoke tests against the built site. No synthetic launch rows are published."""
import asyncio
import functools
import http.server
import json
import re
import shutil
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
def tourism_row(r):
    net = r.get('net')
    code = r.get('country_code')
    domestic = code == 'CHN' if code else bool(re.search(r'jiuquan|wenchang|xichang|taiyuan|haiyang|酒泉|文昌|西昌|太原|海阳', r.get('site', ''), re.I))
    if not net or not r.get('china') or not domestic:
        return False
    precise = str(r.get('precision') or '').lower() in ('second', 'minute', 'hour', 'day')
    year = str(datetime.fromisoformat(net.replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=8))).year) if precise else net[:4]
    return year == '2027'
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
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        data = json.loads((out / 'data/launches.json').read_text())
        await page.goto(base, wait_until='networkidle')
        assert await page.locator('[data-lm-scope="global"]').count() == 0
        assert await page.locator('#lm-year-filter').input_value() == '2027'
        editorial = json.loads((out / 'data/editorial.json').read_text())
        assert await page.locator('#editorial-items article').count() == len(editorial.get('items', []))
        assert await page.locator('#commercial-items article').count() == len(editorial.get('watchlist', []))
        assert await page.locator('#viewing-items article').count() == len(editorial.get('viewing', []))
        assert '不是全国年度发射总数' in await page.locator('.lm-stats').inner_text()
        assert await page.locator('#editorial-review').evaluate('(e) => e.getBoundingClientRect().top') < await page.locator('#commercial-watch').evaluate('(e) => e.getBoundingClientRect().top')
        if any("Chang'e 7" in r.get('name', '') and tourism_row(r) for r in data.get('items', [])):
            assert '嫦娥七号' in await page.locator('#lm-cards').inner_text()
        assert await page.locator('#holiday-status').inner_text() == editorial['holidays']['note']
        await page.locator('#lm-size').select_option('0')
        assert await page.locator('.lm-card').count() == sum(tourism_row(r) for r in data.get('items', []))
        await page.locator('[data-lm-scope="hainan"]').click()
        assert await page.locator('.lm-card').count() == sum(tourism_row(r) and bool(r['hainan']) for r in data.get('items', []))
        await page.locator('#lm-search').fill('no-matching-mission')
        assert await page.locator('.lm-card').count() == 0
        await page.locator('#lm-clear').click()
        assert await page.locator('#lm-year-filter').input_value() == '2027'
        await page.locator('#lm-size').select_option('24')
        await page.screenshot(path=str(shots / 'desktop.png'), full_page=True)
        await page.set_viewport_size({'width': 390, 'height': 844})
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.screenshot(path=str(shots / 'mobile.png'), full_page=True)
        await page.goto(base + '/guide.html?launch=2027-04-02#calendar', wait_until='networkidle')
        assert '2027-04-01' in await page.locator('#date-result').inner_text()
        assert '2027-04-05' in await page.locator('#date-result').inner_text()
        assert '西昌' in await page.locator('#booking-routes').inner_text()
        assert '售罄' in await page.locator('#booking-routes').inner_text()
        assert await page.locator('#national-itineraries').count() == 1
        assert '酒泉' in await page.locator('#national-itineraries').inner_text()
        assert await page.locator('.check input').count() == 25
        assert await page.locator('#budget-per').inner_text() == '¥7,450'
        await page.locator('#b-people').select_option('2')
        assert await page.locator('#budget-per').inner_text() == '¥6,300'
        await page.locator('#c0').check()
        await page.reload()
        assert await page.locator('#c0').is_checked()
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.screenshot(path=str(shots / 'guide-mobile.png'), full_page=True)
        assert not errors, errors
        await browser.close()
    server.shutdown()
    print('Browser checks passed: all rows reachable; Hainan filter; mobile layout; dates; budget; 25 checks; persistence; no JS errors.')

if __name__ == '__main__':
    asyncio.run(check())

