"""Browser smoke tests against the built site. No synthetic launch rows are published."""
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
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(base, wait_until='networkidle')
        data = json.loads((out / 'data/launches.json').read_text())
        await page.locator('[data-lm-scope="global"]').click()
        await page.locator('#lm-size').select_option('0')
        assert await page.locator('.lm-card').count() == len(data.get('items', []))
        await page.locator('[data-lm-scope="hainan"]').click()
        assert await page.locator('.lm-card').count() == sum(bool(r['hainan']) for r in data.get('items', []))
        await page.locator('#lm-size').select_option('24')
        await page.screenshot(path=str(shots / 'desktop.png'), full_page=True)
        await page.set_viewport_size({'width': 390, 'height': 844})
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.screenshot(path=str(shots / 'mobile.png'), full_page=True)
        await page.goto(base + '/guide.html?launch=2027-04-02#calendar', wait_until='networkidle')
        assert '2027-04-01' in await page.locator('#date-result').inner_text()
        assert '2027-04-05' in await page.locator('#date-result').inner_text()
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
