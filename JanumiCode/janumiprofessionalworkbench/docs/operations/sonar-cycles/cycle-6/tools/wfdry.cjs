// Dry-run a generated Workflow script with stand-in hooks: prints each agent's label, prompt size, and the first prompt.
const fs = require('fs');
const body = fs.readFileSync(process.argv[2], 'utf8').replace('export const meta =', 'const meta =');
const fn = new Function('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', 'return (async () => {\n' + body + '\n})()');
let first = true;
const agent = async (prompt, o) => {
  console.log(`[agent] ${o.label}  prompt=${prompt.length} chars  effort=${o.effort || '-'}`);
  if (first) { first = false; console.log('----- first prompt (head) -----\n' + prompt.slice(0, 2600) + '\n----- (tail) -----\n' + prompt.slice(-300)); }
  return { rel: o.label, changed: false, applied: [], skipped: [], summary: 'dry', equivalent: true, concerns: [] };
};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));
fn(agent, parallel, null, (m) => console.log('[log] ' + m), () => {}, undefined, {}).then((r) => console.log('[return] ' + JSON.stringify({ ...r, results: r.results.length })));
