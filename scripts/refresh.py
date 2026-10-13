"""Fetch a complete LL2 upcoming snapshot. Never replace good data with a partial page."""
from __future__ import annotations
import json
import os
import socket
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&mode=normal&hide_recent_previous=true'
COMPLETED = {3, 4, 7}
CHINA_OPERATORS = ('China Aerospace', 'China Rocket', 'Chinese', 'CASC', 'CASIC', 'ExPace', 'CAS Space', 'LandSpace', 'Landspace', 'Galactic Energy', 'iSpace', 'i-Space', 'Space Pioneer', 'Orienspace', 'OrienSpace', 'Deep Blue Aerospace', 'Space Epoch', 'Space Transportation', 'LinkSpace', 'Aerospace System Engineering')
STATE_OPERATORS = ('China Aerospace', 'China Rocket', 'CASC', 'CASIC', 'ExPace')
PRIVATE_OPERATORS = ('LandSpace', 'Landspace', 'Galactic Energy', 'iSpace', 'i-Space', 'Space Pioneer', 'Orienspace', 'OrienSpace', 'Deep Blue Aerospace', 'Space Epoch', 'Space Transportation', 'LinkSpace')

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

def obj(value):
    return value if isinstance(value, dict) else {}

def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return fallback

def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)

def normalize(row: dict) -> dict:
    provider = obj(row.get('launch_service_provider'))
    pad = obj(row.get('pad'))
    location = obj(pad.get('location'))
    country = obj(pad.get('country')) or obj(location.get('country'))
    country_code = country.get('alpha_3_code') or location.get('country_code') or ''
    operator = provider.get('name') or '运营方待定'
    rocket = obj(obj(row.get('rocket')).get('configuration'))
    mission = obj(row.get('mission'))
    status = obj(row.get('status'))
    precision = obj(row.get('net_precision'))
    site = location.get('name') or '场址待定'
    is_china = country_code == 'CHN' if country_code else any(x.lower() in operator.lower() for x in CHINA_OPERATORS)
    is_hainan = any(x in (site + ' ' + str(pad.get('name', ''))).lower() for x in ('wenchang', 'hainan', '文昌', '海南'))
    # Ownership and commercial launch service are different dimensions.
    category = 'unknown'
    if any(x.lower() in operator.lower() for x in STATE_OPERATORS):
        category = 'state'
    elif any(x.lower() in operator.lower() for x in PRIVATE_OPERATORS):
        category = 'private'
    elif operator.lower() == 'cas space':
        category = 'state-linked'
    raw_net = row.get('net')
    if raw_net:
        datetime.fromisoformat(raw_net.replace('Z', '+00:00'))
    source_url = row.get('url') or ''
    if not source_url.startswith('https://ll.thespacedevs.com/'):
        source_url = 'https://ll.thespacedevs.com/2.3.0/launches/' + str(row['id']) + '/'
    return {
        'id': str(row['id']), 'name': row.get('name') or '任务名称待定',
        'mission': mission.get('name') or '载荷/任务名称待定',
        'rocket': rocket.get('full_name') or rocket.get('name') or '型号待定',
        'operator': operator, 'operator_type': obj(provider.get('type')).get('name') or '待定',
        'category': category, 'country': country.get('name') or country_code or '待定',
        'country_code': country_code, 'china': is_china, 'hainan': is_hainan,
        'site': site, 'pad': pad.get('name') or '工位待定',
        'net': raw_net, 'precision': precision.get('name'), 'precision_id': precision.get('id'),
        'window_start': row.get('window_start'), 'window_end': row.get('window_end'),
        'status_id': status.get('id'), 'status': status.get('name') or '状态待定',
        'status_abbrev': status.get('abbrev') or '',
        'source_updated_at': row.get('last_updated'), 'source_url': source_url,
        'source_level': 'third-party', 'slug': row.get('slug') or '',
    }

def collect(fetch, max_pages=12):
    url, seen, rows, expected = API, set(), [], None
    for _ in range(max_pages):
        if url in seen:
            raise ValueError('上游分页出现循环，未发布不完整快照')
        u = urlparse(url)
        if u.scheme != 'https' or u.hostname != 'll.thespacedevs.com' or u.port not in (None, 443) or u.username or not u.path.startswith('/2.3.0/launches/upcoming/'):
            raise ValueError('上游分页链接不符合允许的源地址')
        seen.add(url)
        page = fetch(url)
        if not isinstance(page, dict) or not isinstance(page.get('results'), list) or not isinstance(page.get('count'), int):
            raise ValueError('上游响应结构错误')
        if expected is None:
            expected = page['count']
        elif expected != page['count']:
            raise ValueError('采集期间任务总数变化，保留上一次完整快照，下一轮再核对')
        rows.extend(page['results'])
        url = page.get('next')
        if not url:
            break
    else:
        raise ValueError('超过12页/1200条安全上限，未把部分结果冒充全部任务')
    if not rows or len(rows) != expected:
        raise ValueError(f'结果不完整或为空：取得{len(rows)}，源总数{expected}')
    ids = [r.get('id') for r in rows if isinstance(r, dict)]
    if len(ids) != len(rows) or len(set(ids)) != len(rows) or None in ids:
        raise ValueError('上游包含重复任务或缺失ID')
    normalized = [normalize(r) for r in rows if obj(r.get('status')).get('id') not in COMPLETED]
    if not normalized:
        raise ValueError('没有有效待发任务，拒绝用空结果覆盖')
    return normalized, expected, len(seen)

def network(url: str):
    headers = {'Accept': 'application/json', 'User-Agent': 'Rocket-Launch-Tourism-Planning/1.0 (+https://github.com/StupidYang/Rocket-Launch-Tourism-Planning)'}
    token = os.getenv('LL2_TOKEN')
    if token:
        headers['Authorization'] = 'Token ' + token
    # No retry storm: one bounded request per page, next scheduled run retries the snapshot.
    with urlopen(Request(url, headers=headers), timeout=35) as response:
        raw = response.read(15_000_001)
        if len(raw) > 15_000_000:
            raise ValueError('单页响应超过15MB限制')
        return json.loads(raw)

def differences(old: list, new: list, stamp: str):
    oldmap = {r['id']: r for r in old}
    newmap = {r['id']: r for r in new}
    changes = []
    if not old:
        return changes
    fields = ['name', 'net', 'precision', 'status', 'site', 'pad']
    for ident, r in newmap.items():
        before = oldmap.get(ident)
        if before is None:
            changes.append({'at': stamp, 'id': ident, 'name': r['name'], 'type': 'added', 'fields': [], 'china': r['china'], 'hainan': r['hainan'], 'net': r.get('net'), 'precision': r.get('precision')})
        else:
            changed = [f for f in fields if before.get(f) != r.get(f)]
            if changed:
                changes.append({'at': stamp, 'id': ident, 'name': r['name'], 'type': 'changed', 'fields': changed, 'before': {f: before.get(f) for f in changed}, 'after': {f: r.get(f) for f in changed}, 'china': r['china'], 'hainan': r['hainan'], 'net': r.get('net'), 'precision': r.get('precision')})
    for ident, r in oldmap.items():
        if ident not in newmap:
            changes.append({'at': stamp, 'id': ident, 'name': r['name'], 'type': 'removed', 'fields': [], 'china': r.get('china', False), 'hainan': r.get('hainan', False), 'net': r.get('net'), 'precision': r.get('precision')})
    return changes

def main():
    stamp = utcnow()
    old = load(ROOT / 'data/launches.json', {})
    status = {'schema_version': 1, 'last_attempt_at': stamp, 'last_success_at': old.get('fetched_at'), 'state': 'error', 'message': '', 'schedule': '每6小时，UTC 00:17/06:17/12:17/18:17；调度可能延迟', 'run_url': os.getenv('RUN_URL', '')}
    try:
        rows, total, pages = collect(network)
        fresh = {'schema_version': 1, 'source': 'The Space Devs / Launch Library 2', 'source_url': API, 'fetched_at': stamp, 'source_count': total, 'fetched_count': total, 'pages': pages, 'complete': True, 'scope': 'LL2全部分页的公开待发任务；不是全球或中国官方未公开任务的完整清单', 'items': rows}
        previous = load(ROOT / 'data/changes.json', {'items': []})
        changes = differences(old.get('items', []), rows, stamp)
        write(ROOT / 'data/changes.json', {'updated_at': stamp, 'items': (changes + previous.get('items', []))[:300]})
        write(ROOT / 'data/launches.json', fresh)
        status.update(state='ok', last_success_at=stamp, message=f'完整获取{total}条源记录，显示{len(rows)}条待发任务；{pages}页')
        print(status['message'])
    except (HTTPError, OSError, ValueError, KeyError, TypeError, socket.timeout) as exc:
        # Existing data remains byte-for-byte unchanged on any incomplete/failed fetch.
        detail = f'HTTP {exc.code}' if isinstance(exc, HTTPError) else str(exc)[:220]
        status['message'] = '本轮采集未成功，保留上一份完整数据。' + detail
        print('::warning::' + status['message'])
    write(ROOT / 'data/status.json', status)
    print(json.dumps(status, ensure_ascii=False))
    # The status file reports upstream outage, while code/test failures still fail CI.
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

