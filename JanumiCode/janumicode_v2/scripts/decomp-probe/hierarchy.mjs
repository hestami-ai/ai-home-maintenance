#!/usr/bin/env node
/**
 * Probe: confirm the unified drill-down join keys against a real run DB.
 *   User Journey (UJ) -> User Story (US/FR) -> leaf AC -> {task, component, data-model}
 * Usage: node scripts/decomp-probe/hierarchy.mjs <db-path>
 */
import Database from 'better-sqlite3';
const d = new Database(process.argv[2], { readonly: true });
const run = d.prepare('SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1').get().id;
const cur = (t) => d.prepare(
  `SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type=? AND is_current_version=1`
).all(run, t).map((r) => JSON.parse(r.content));

// ── requirement decomposition: root_fr_id -> root display_key; leaf display_key -> root ──
const reqNodes = cur('requirement_decomposition_node');
const rootByFr = new Map();
for (const n of reqNodes) if (n.depth === 0) rootByFr.set(n.root_fr_id, n.display_key);
const rootOfLeaf = new Map(); // display_key -> root US
for (const n of reqNodes) rootOfLeaf.set(n.display_key, rootByFr.get(n.root_fr_id));

console.log('=== requirement roots (US/NFR) ===');
console.log([...new Set(rootByFr.values())].sort().join(', '));

// ── JOURNEY layer: where do UJ ids live + how do US roots reference them? ──
console.log('\n=== journey artifacts / ids ===');
for (const kind of ['user_journey_bloom', 'user_journey_decomposition']) {
  const arts = d.prepare(
    `SELECT content FROM governed_stream WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1 AND json_extract(content,'$.kind')=?`
  ).all(run, kind).map((r) => r.content);
  if (arts.length) {
    const ujs = [...new Set(arts.join(' ').match(/UJ-[A-Z0-9-]+/g) || [])];
    console.log(` kind=${kind}: ${arts.length} artifact(s), UJ ids: ${ujs.slice(0, 20).join(', ')}${ujs.length > 20 ? ' …' : ''} (${ujs.length})`);
  }
}
// how do requirement roots reference journeys? scan root content for UJ- refs / anchor fields
console.log('\n=== requirement root → journey reference fields ===');
for (const n of reqNodes.filter((x) => x.depth === 0)) {
  const raw = JSON.stringify(n);
  const ujs = [...new Set(raw.match(/UJ-[A-Z0-9-]+/g) || [])];
  const anchorKeys = Object.keys(n).filter((k) => /journey|anchor|trace|origin|source/i.test(k));
  console.log(` ${n.display_key}: UJ refs=[${ujs.join(', ')}] anchorFields=[${anchorKeys.map((k) => k + '=' + JSON.stringify(n[k]).slice(0, 40)).join(', ')}]`);
}

// ── TASK → AC → US join ──
const tasks = cur('task_decomposition_node');
const acToLeaf = (ac) => ac.replace(/^AC-/, '').replace(/-\d+$/, '');
let taskAcHits = 0, taskAcMiss = 0;
const usToTasks = new Map();
const orphanAcs = new Set();
for (const t of tasks) {
  const task = t.task || {};
  for (const ref of (task.traces_to || [])) {
    if (!/^AC-/.test(ref)) continue;
    const leaf = acToLeaf(ref);
    const us = rootOfLeaf.get(leaf);
    if (us) { taskAcHits++; if (!usToTasks.has(us)) usToTasks.set(us, new Set()); usToTasks.get(us).add(t.display_key); }
    else { taskAcMiss++; orphanAcs.add(ref); }
  }
}
console.log('\n=== task → AC → US join ===');
console.log(`task traces_to AC refs: ${taskAcHits} matched a requirement leaf, ${taskAcMiss} orphan (no matching leaf)`);
console.log('orphan AC sample:', [...orphanAcs].slice(0, 8).join(', '));
console.log('tasks per US:', [...usToTasks].map(([us, s]) => `${us}:${s.size}`).sort().join('  '));

// ── COMPONENT layer: task.component_id → component roots ──
const comps = cur('component_decomposition_node');
const compRoots = comps.filter((c) => c.depth === 0);
console.log('\n=== component roots ===');
console.log('count:', compRoots.length, '| sample ids/display_keys:', compRoots.slice(0, 8).map((c) => c.display_key || c.node_id || c.root_component_id).join(', '));
const taskCompIds = new Set(tasks.map((t) => (t.task || {}).component_id).filter(Boolean));
const compKeys = new Set(compRoots.map((c) => c.display_key));
const compKeysAlt = new Set(compRoots.flatMap((c) => [c.display_key, c.root_component_id, c.node_id, c.component_id, (c.component || {}).id].filter(Boolean)));
console.log('distinct task.component_id:', [...taskCompIds].slice(0, 8).join(', '), `(${taskCompIds.size})`);
console.log('task.component_id that match a component root key:', [...taskCompIds].filter((x) => compKeysAlt.has(x)).length, '/', taskCompIds.size);

// ── DATA MODEL layer: linkage fields ──
const dms = cur('data_model_decomposition_node');
console.log('\n=== data_model_decomposition_node linkage ===');
console.log('count:', dms.length, '| roots(depth0):', dms.filter((x) => x.depth === 0).length);
const dm = dms[0] || {};
console.log('sample keys:', Object.keys(dm).join(','));
const dmInner = dm.data_model || dm.entity || dm.model || {};
console.log('sample inner keys:', Object.keys(dmInner).join(','));
console.log('sample linkage:', JSON.stringify({ root: dm.root_data_model_id, comp: dm.component_id || dmInner.component_id, traces: dm.traces_to || dmInner.traces_to, entity: dmInner.entity_id || dm.entity_id }).slice(0, 300));

// ── which field on a US root holds the UJ reference? ──
console.log('\n=== journey field on US root (US-005) ===');
const us5 = reqNodes.find((n) => n.depth === 0 && n.display_key === 'US-005');
if (us5) {
  for (const [k, v] of Object.entries(us5)) {
    const s = JSON.stringify(v);
    if (s && s.includes('UJ-')) console.log(`  field "${k}" =`, s.slice(0, 160));
  }
  console.log('  all root keys:', Object.keys(us5).join(', '));
}

// ── component-id drift: do unmatched task.component_id prefix-match a component root? ──
console.log('\n=== component-id drift (task.component_id vs component roots) ===');
const rootIds = compRoots.map((c) => c.display_key || c.root_component_id || c.node_id);
for (const cid of taskCompIds) {
  const exact = rootIds.includes(cid);
  const prefix = rootIds.find((r) => cid.startsWith(r + '-') || r.startsWith(cid + '-'));
  console.log(`  ${cid.padEnd(38)} exact=${exact ? 'Y' : '-'} prefix→ ${prefix || '(none)'}`);
}

// ── data model → US/component coverage ──
console.log('\n=== data model traces coverage ===');
let dmUs = 0, dmComp = 0, dmNone = 0;
for (const x of dms) {
  const inner = x.entity || x.data_model || {};
  const traces = inner.traces_to || x.traces_to || [];
  const hasUs = traces.some((t) => rootOfLeaf.has(String(t).replace(/^AC-/, '').replace(/-\d+$/, '')) || rootByFr.has(t) || /^US-|^NFR-/.test(String(t)));
  const hasComp = !!inner.component_id;
  if (hasUs) dmUs++; else if (hasComp) dmComp++; else dmNone++;
}
console.log(`  data-model nodes: ${dmUs} trace to US/NFR, ${dmComp} only component_id, ${dmNone} neither (of ${dms.length})`);

d.close();
