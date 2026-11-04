import {readFile, writeFile, mkdir} from 'node:fs/promises';
const env = Object.fromEntries(
  (await readFile(new URL('../infra/.env', import.meta.url), 'utf8'))
    .split('\n')
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const base = `http://127.0.0.1:${env.API_HOST_PORT}`;
const dir = new URL('../.runtime/', import.meta.url);
await mkdir(dir, {recursive: true});
for (const [name, description] of [
  ['fix-room-analyst', 'Analyze shopping evidence and request merchant facts'],
  ['fix-room-repair', 'Propose bounded repairs for merchant approval'],
]) {
  const path = new URL(name + '.json', dir);
  try {
    await readFile(path);
    console.log(`${name}: existing registration preserved`);
    continue;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const response = await fetch(base + '/agents', {
    method: 'POST',
    headers: {Authorization: `Bearer ${env.AGENT_REGISTRATION_TOKEN}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      name,
      description,
      connector_type: 'fix-room',
      integration_profile: {
        connection_model: 'always_on',
        message_exchange: true,
        pre_invocation_mediation: [],
        post_invocation_mediation: [],
        event_reporting: [],
      },
    }),
  });
  if (!response.ok) throw new Error(`Registration ${name}: HTTP ${response.status}`);
  const agent = await response.json();
  await writeFile(path, JSON.stringify(agent), {mode: 0o600, flag: 'wx'});
  console.log(`${name}: registered`);
}
