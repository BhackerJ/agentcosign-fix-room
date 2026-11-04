import {readFile, writeFile} from 'node:fs/promises';
const path = new URL('../.runtime/room.json', import.meta.url);
try {
  await readFile(path);
  console.log('Existing room preserved');
  process.exit(0);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const agent = JSON.parse(await readFile(new URL('../.runtime/fix-room-analyst.json', import.meta.url)));
const response = await fetch(`http://127.0.0.1:18000/agents/${agent.id}/ops/create_room`, {
  method: 'POST',
  headers: {Authorization: `Bearer ${agent.api_key}`, 'Content-Type': 'application/json'},
  body: JSON.stringify({
    name: 'Fix Room',
    description: 'Merchant-approved Shopify development-store repairs with before/after evidence',
    agent_names: ['fix-room-analyst', 'fix-room-repair'],
    user_names: ['user'],
  }),
});
if (!response.ok) throw new Error(`Create room: HTTP ${response.status}: ${await response.text()}`);
await writeFile(path, JSON.stringify(await response.json()), {mode: 0o600, flag: 'wx'});
console.log('Room created');
