"""Run the existing AgentCoSign OpenClaw shopper; keep private evidence local."""

import datetime, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

root = Path(os.environ['AGENTCOSIGN_ROOT'])
sys.path.insert(0, str(root / 'src'))
from dotenv import dotenv_values
from pydantic import TypeAdapter
from harness.person import Principal, Home, Task
from harness.agent_task import build
from harness.drivers import openclaw
from harness import run_folder
from harness.trajectory import ShopEvent
from harness.store_guard import Guard

os.umask(0o077)
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
cfg = dotenv_values(root / '.env')
password = os.environ.get('STOREFRONT_PASSWORD') or cfg['STORE1_STOREFRONT_PASSWORD']
domain = os.environ['SHOPIFY_DOMAIN']
handle = os.environ['PRODUCT_HANDLE']
principal = Principal(
    id='fixroom-shopper', name='Demo Shopper', home=Home(address='Test household, Los Angeles', zip='90001')
)
task = Task(
    id='fixroom-stock-shopping',
    prompt=[
        f'Please put one Demo Hand Towel, Single pack, in my cart. Start at https://{domain}/products/{handle}. No substitutions. If unavailable, report that and stop. Stop at the cart; do not start checkout, enter personal details, or place an order. Use only the normal browser UI, no HTTP/API calls, shell, or page scripts. Use one tab. If HTTP 429, CAPTCHA, or a browser verification challenge appears, stop without retrying or refreshing. Do not browse unrelated products. Take a viewport-only screenshot of the final state. Report DONE only after observing the matching item, quantity one, and twelve-dollar price in the cart. Do not repeat authentication credentials in your report; otherwise report CANNOT_COMPLETE with observed facts.'
    ],
)
packet = build(
    task,
    principal,
    run_id=out.parent.parent.name + '-' + out.parent.name,
    store_url=f'https://{domain}',
    depth='cart',
    own_store=True,
    storefront_password=password,
    time_limit_s=240,
    title='Add one Demo Hand Towel, Single — stop at the cart',
)
packet.how_far = 'Stop at the cart. No checkout, order, or payment.'
started = time.time()
# The stock task has no Discount accordion. Keep the native recorder for full replay frames.
r = openclaw.run(packet, principal, own_domains=(domain,), ask=False)


def encode(o):
    return o.model_dump(mode='json') if hasattr(o, 'model_dump') else str(o)


(out / 'private-result.json').write_text(json.dumps(r, default=encode, indent=2))
for evidence in r.get('evidence_dirs', []):
    shutil.copytree(evidence, out / 'evidence' / 'openclaw', dirs_exist_ok=True)
ep = json.loads(json.dumps(r['episode'], default=encode))
events = TypeAdapter(list[ShopEvent]).validate_python(ep['events'])
meta = {
    'run_id': packet.run_id,
    'task': task.id,
    'principal': principal.id,
    'started': started,
    'ended': time.time(),
    'payment': {'by': 'not_reached'},
    'interview': {'asked': False, 'reason': 'Cart-only acceptance run; no interview requested.'},
}
run_folder.finish(
    out,
    task=task,
    packet=packet,
    principal_block='',
    events=events,
    guard=Guard.model_validate(ep['guard']),
    meta=meta,
    driver='openclaw',
    model=ep['model'],
    exchanges=ep['exchanges'],
    status=ep['status'],
)
report = '\n'.join(e.get('report', '') for e in ep['events'] if e['kind'] == 'final').replace(
    password, '[REDACTED]'
)
observed = [(e.get('text') or '') for e in ep['events'] if e['kind'] == 'page_seen']
cart_observed = any(
    all(t in text for t in ['Demo Hand Towel', 'Single', '12.00'])
    and re.search(r'Total items in cart:\s*1\b', text)
    for text in observed
)
purchase_disabled_observed = any(
    re.search(r'^\s*- button(?: \"(?:Sold out|Add to cart)\")? \[disabled\]', text, re.I | re.M)
    for text in observed
)
summary = {
    'cart_observed': cart_observed,
    'purchase_disabled_observed': purchase_disabled_observed,
    'status': r['status'],
    'seconds': r['seconds'],
    'report': report,
    'guard_stops': ep['guard'].get('stops', []),
    'event_count': len(events),
    'recorded_run': str(out),
}
(out / 'summary.json').write_text(json.dumps(summary, indent=2))
batch = out.parent / 'batch.json'
batch.write_text(
    json.dumps(
        {
            'pairs': [],
            'stages': {'report': {'ended': datetime.datetime.now(datetime.timezone.utc).isoformat()}},
        }
    )
)
child_env = {**os.environ, 'PYTHONPATH': str(root / 'src')}
judgments = out.parent / 'judgments.json'
replay = out.parent / 'replay'
commands = [
    ['build', '--runs', str(out), '--out', str(judgments)],
    [
        'page',
        '--report',
        str(judgments),
        '--batch',
        str(batch),
        '--runs',
        str(out),
        '--out',
        str(replay),
        '--bundle-root',
        str(root / 'app/dist'),
        '--lang',
        'en',
    ],
]
with (out.parent / 'replay-build.log').open('w') as log:
    for command in commands:
        subprocess.run(
            [sys.executable, '-m', 'report', *command], env=child_env, stdout=log, stderr=log, check=True
        )
view = replay / 'view.json'
if not json.loads(view.read_text())['visits']:
    with (out.parent / 'replay-build.log').open('a') as log:
        subprocess.run(
            [sys.executable, str(Path(__file__).with_name('render-shopping-replay.py')), str(out.parent)],
            env=child_env,
            stdout=log,
            stderr=log,
            check=True,
        )
view.write_text(view.read_text().replace(password, '[REDACTED]'))
print(json.dumps(summary), flush=True)
