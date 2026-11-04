import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec = promisify(execFile);
export function agentOutcome(agent, probe) {
  if (agent.status !== 'ok' || agent.guard_stops?.length)
    throw Error('Shopping agent stopped or failed; inspect its private run evidence');
  const done = /(?:^|\n)\s*DONE\b/.test(agent.report) && agent.cart_observed === true,
    unavailable =
      /(?:^|\n)\s*CANNOT_COMPLETE\b/.test(agent.report) &&
      /sold out|out of stock|unavailable/i.test(agent.report) &&
      agent.purchase_disabled_observed === true;
  if (!((done && probe.success) || (unavailable && probe.unavailable)))
    throw Error('Shopping agent observations and independent browser check did not confirm the same outcome');
  return {
    ...probe,
    kind: 'browser-shopping-agent-with-independent-probe',
    success: done && probe.success,
    unavailable: unavailable && probe.unavailable,
    agent: {
      status: agent.status,
      seconds: agent.seconds,
      report: agent.report,
      event_count: agent.event_count,
      recorded_run: agent.recorded_run,
    },
  };
}
export async function shopWithAgent(config, dir, env, probe) {
  const root = env.AGENTCOSIGN_ROOT;
  const {stdout} = await exec(
    resolve(root, '.venv/bin/python'),
    [fileURLToPath(new URL('../scripts/run-shopping-agent.py', import.meta.url)), resolve(dir, 'agent')],
    {env, timeout: 330000, maxBuffer: 1024 * 1024},
  );
  const agent = JSON.parse(stdout.trim().split('\n').at(-1));
  const check = await probe(config, dir);
  return agentOutcome(agent, check);
}
