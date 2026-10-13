"""Build a static Pages artifact, embedding the last complete launch snapshot."""
from __future__ import annotations
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'

def read(name, fallback):
    path = ROOT / 'data' / name
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else fallback

def build():
    launches = read('launches.json', {'items': [], 'complete': False})
    status = read('status.json', {'state': 'error', 'message': '尚未取得完整任务快照'})
    changes = read('changes.json', {'items': []})
    if launches.get('items') and (not launches.get('complete') or not isinstance(launches['items'], list)):
        raise ValueError('Refusing to publish a partial launch snapshot')
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / 'assets', OUT / 'assets')
    shutil.copy2(ROOT / 'guide.html', OUT / 'guide.html')
    (OUT / 'data').mkdir()
    for name, value in [('launches.json', launches), ('status.json', status), ('changes.json', changes)]:
        (OUT / 'data' / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    seed = json.dumps({'launches': launches, 'status': status, 'changes': changes}, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    if html.count('__LAUNCH_SEED__') != 1:
        raise ValueError('Expected exactly one launch seed placeholder')
    (OUT / 'index.html').write_text(html.replace('__LAUNCH_SEED__', seed), encoding='utf-8')
    (OUT / '.nojekyll').touch()
    items = launches.get('items', [])
    summary = {'built_at': datetime.now(timezone.utc).isoformat(), 'last_acquisition': launches.get('fetched_at'), 'acquisition_state': status.get('state'), 'source_count': launches.get('source_count', 0), 'display_count': len(items), 'china_count': sum(bool(r.get('china')) for r in items), 'hainan_count': sum(bool(r.get('hainan')) for r in items), 'hainan_2027_target_count': sum(bool(r.get('hainan')) and str(r.get('net') or '').startswith('2027') for r in items), 'guide': 'guide.html', 'entry': 'index.html'}
    (OUT / 'build-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary

if __name__ == '__main__':
    build()
