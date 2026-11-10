"""Structural guards for the light redesign; runs in the existing Actions suite."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = []
        self.links = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])

class LayoutTests(unittest.TestCase):
    def test_unique_ids_and_local_anchors(self):
        for name in ('index.html', 'guide.html'):
            text = (ROOT / name).read_text()
            page = Page(text)
            self.assertEqual(len(page.ids), len(set(page.ids)), name)
            for href in page.links:
                if href.startswith('#'):
                    self.assertIn(href[1:], page.ids, (name, href))

    def test_preserves_tools_and_historical_anchors(self):
        guide = Page((ROOT / 'guide.html').read_text())
        for anchor in ('trip-planner', 'calendar', 'budget', 'checklist', 'missions',
                       'booking-routes', 'booking-timing', 'hainan-nov9-traffic',
                       'hainan-oct25-traffic', 'jiuquan-early-november', 'rizhao-oct21'):
            self.assertIn(anchor, guide.ids)

    def test_current_preparation_precedes_annual_research(self):
        text = (ROOT / 'guide.html').read_text()
        self.assertLess(text.index('id="booking-timing"'), text.index('id="missions"'))
        self.assertLess(text.index('id="checklist"'), text.index('id="missions"'))
        self.assertIn('class="archive history-archive"', text)
        self.assertNotIn('class="archive history-archive" open', text)

    def test_local_illustration_and_one_seed(self):
        text = (ROOT / 'index.html').read_text()
        self.assertEqual(text.count('__LAUNCH_SEED__'), 1)
        self.assertIn('./assets/launch-sky.svg', text)
        self.assertTrue((ROOT / 'assets/launch-sky.svg').exists())
        self.assertIn('非实际场址', text)

if __name__ == '__main__':
    unittest.main()
