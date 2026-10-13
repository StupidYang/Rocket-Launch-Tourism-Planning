import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).resolve().parents[1] / 'scripts/refresh.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

def row(ident='1', **kw):
    base = {'id': ident, 'name': 'Test mission', 'status': {'id': 2}, 'net': '2027-12-31T00:00:00Z', 'net_precision': {'name': 'Year'}, 'pad': {'location': {'name': 'Wenchang Space Launch Site, China'}, 'country': {'alpha_3_code': 'CHN'}}, 'launch_service_provider': {'name': 'China Aerospace Science and Technology Corporation'}}
    base.update(kw)
    return base

class TestRefresh(unittest.TestCase):
    def test_coarse_date_not_promoted(self):
        item = r.normalize(row())
        self.assertEqual(item['precision'], 'Year')
        self.assertTrue(item['hainan'])
        self.assertEqual(item['category'], 'state')
    def test_missing_time_kept(self):
        item = r.normalize(row(net=None, net_precision=None))
        self.assertIsNone(item['net'])
        self.assertIsNone(item['precision'])
    def test_all_pages(self):
        pages = iter([{'count': 2, 'results': [row('1')], 'next': r.API + '&offset=1'}, {'count': 2, 'results': [row('2')], 'next': None}])
        data, count, n = r.collect(lambda _: next(pages))
        self.assertEqual((len(data), count, n), (2, 2, 2))
    def test_incomplete_rejected(self):
        with self.assertRaises(ValueError):
            r.collect(lambda _: {'count': 2, 'results': [row()], 'next': None})
    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            r.collect(lambda _: {'count': 2, 'results': [row(), row()], 'next': None})
    def test_foreign_next_rejected(self):
        with self.assertRaises(ValueError):
            r.collect(lambda _: {'count': 2, 'results': [row()], 'next': 'https://example.com/'})
    def test_removed_not_called_success(self):
        change = r.differences([r.normalize(row())], [], 'now')[0]
        self.assertEqual(change['type'], 'removed')
    def test_country_not_inferred_from_commercial(self):
        item = r.normalize(row(pad={}, launch_service_provider={'name': 'Unknown operator', 'type': {'name': 'Commercial'}}))
        self.assertFalse(item['china'])
        self.assertEqual(item['category'], 'unknown')
    def test_private_provider(self):
        self.assertEqual(r.normalize(row(launch_service_provider={'name': 'Galactic Energy'}))['category'], 'private')
    def test_terminal_launch_filtered(self):
        page = {'count': 2, 'results': [row('1'), row('2', status={'id': 3})], 'next': None}
        items, total, _ = r.collect(lambda _: page)
        self.assertEqual(len(items), 1)
        self.assertEqual(total, 2)

if __name__ == '__main__':
    unittest.main()
