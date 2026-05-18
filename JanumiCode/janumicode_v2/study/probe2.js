/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const db = new Database(
  path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-5/.janumicode/test-harness/1778448716098.db'),
  { readonly: true },
);

console.log('--- tables ---');
const tabs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
for (const t of tabs) console.log(' ', t.name);

console.log('\n--- memory_edge ---');
try {
  const e = db.prepare('SELECT COUNT(*) c FROM memory_edge').get();
  console.log('memory_edge total:', e.c);
  const t = db.prepare('SELECT edge_type, COUNT(*) c FROM memory_edge GROUP BY edge_type ORDER BY c DESC').all();
  for (const r of t) console.log(' ', String(r.c).padStart(5), r.edge_type);
} catch (err) { console.log('memory_edge err:', err.message); }

console.log('\n--- embedding/vec/fts tables ---');
for (const t of tabs.filter(t => /vec|embed|fts/i.test(t.name))) {
  try {
    const c = db.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get();
    console.log(' ', t.name, '→', c.c, 'rows');
  } catch (e) { console.log(' ', t.name, 'err:', e.message); }
}

console.log('\n--- sub_artifact (Stage III output) ---');
try {
  const c = db.prepare('SELECT COUNT(*) c FROM sub_artifact').get();
  console.log('sub_artifact total:', c.c);
  const t = db.prepare('SELECT artifact_type, COUNT(*) c FROM sub_artifact GROUP BY artifact_type ORDER BY c DESC LIMIT 15').all();
  for (const r of t) console.log(' ', String(r.c).padStart(4), r.artifact_type);
} catch (err) { console.log('sub_artifact err:', err.message); }
