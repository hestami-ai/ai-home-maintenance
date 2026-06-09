/**
 * THROWAWAY investigation harness — safe to delete.
 *
 * Replays REAL ts-125 data through the local ollama gpt-oss:20b model to
 * decide whether LLM-based consolidation is worth building for Levers 1a/1b/2c.
 * Reads the ts-125 governed-stream DB (read-only) + the generated workspace
 * files; makes a handful of local LLM calls (no cost, no executor path).
 *
 * Usage:
 *   node scripts/_throwaway/consolidation-probe.cjs [1a,1b,2c]
 * Default runs all three probes. Writes a markdown report next to this file.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..', '..');
const WS = path.join(ROOT, 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-125');
const DB_PATH = path.join(WS, '.janumicode/test-harness/1780433311040.db');
const MODEL = process.env.PROBE_MODEL || 'gpt-oss:20b';
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const which = (process.argv[2] || '1a,1b,2c').split(',').map(s => s.trim());
const report = [];
const log = (...a) => { console.log(...a); report.push(a.join(' ')); };

// NFR/cross-cutting domain heuristic (for COMPARISON only — the probe judges
// the LLM against this naive baseline, it is not used to drive any product code).
const NFR_DOMAIN_RE = /encrypt|security|complian|availab|performance|monitor|health|audit|logging|observab|resilien|rate.?limit/i;

// ── ollama call ─────────────────────────────────────────────────────
async function llm(system, user, { json = false, timeoutMs = 300000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        ...(json ? { format: 'json' } : {}),
        options: { temperature: 0.2 },
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: user },
        ],
      }),
    });
    const body = await res.json();
    return { text: body.message?.content ?? '', ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

function parseJsonLoose(text) {
  if (!text) return null;
  let s = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const i = s.indexOf('{'); const j = s.lastIndexOf('}');
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  try { return JSON.parse(s); } catch { return null; }
}

// ── DB loaders ──────────────────────────────────────────────────────
function loadCurrent(db, kind) {
  return db.prepare(
    "SELECT content FROM governed_stream WHERE record_type='artifact_produced' AND json_extract(content,'$.kind')=? AND is_current_version=1",
  ).all(kind).map(r => JSON.parse(r.content));
}

// ── Probe 1a — component_kind classification ────────────────────────
async function probe1a(db) {
  log('\n# Probe 1a — component_kind classification\n');
  const cm = loadCurrent(db, 'component_model')[0];
  const comps = cm.components;
  const nfrArt = loadCurrent(db, 'non_functional_requirements')[0];
  const nfrs = (nfrArt?.requirements ?? nfrArt?.nfrs ?? []).map(n => `${n.id ?? ''}: ${n.statement ?? n.description ?? n.title ?? ''}`).filter(Boolean);

  const compLines = comps.map(c =>
    `- ${c.id} (domain ${c.domain_id}): ${c.name}. responsibilities: ${(c.responsibilities || []).map(r => r.statement).join('; ')}. traces_to: ${JSON.stringify(c.traces_to || [])}`,
  ).join('\n');

  const system = 'You are an architecture reviewer. A FUNCTIONAL component is a buildable service realizing user stories. A CROSS_CUTTING component is a non-functional concern (performance/latency, encryption/security, availability/resilience, observability/logging, compliance/retention) that is realized WITHIN functional components, NOT as its own service. Classify each component. Respond ONLY with JSON: {"classifications":[{"id":"...","kind":"functional|cross_cutting","applies_to_components":["comp-..."]}]}';
  const user = `Components:\n${compLines}\n\nNon-functional requirements:\n${nfrs.join('\n') || '(none captured)'}\n\nClassify every component id above.`;

  const { text, ms } = await llm(system, user, { json: true });
  const parsed = parseJsonLoose(text);
  log(`(model ${MODEL}, ${ms}ms)`);
  // Tolerate shape drift: classifications may be top-level array, or under a
  // different key; ids may be returned without the comp- prefix or by name.
  let cls = parsed?.classifications || parsed?.components || (Array.isArray(parsed) ? parsed : null);
  if (!cls) { log('PARSE FAILED. Raw:\n' + text.slice(0, 2000)); return; }
  log('raw classification sample: ' + JSON.stringify(cls.slice(0, 3)));
  const norm = s => String(s || '').toLowerCase().replace(/^comp-/, '').replace(/[^a-z0-9]/g, '');
  const byId = new Map();
  for (const c of cls) {
    const key = c.id ?? c.component_id ?? c.name ?? c.component;
    byId.set(norm(key), c);
  }
  const lookup = c => byId.get(norm(c.id)) ?? byId.get(norm(c.name));
  let agree = 0, llmCC = 0, heurCC = 0;
  log('\n| component | domain | LLM kind | naive NFR-domain? | agree |');
  log('|---|---|---|---|---|');
  for (const c of comps) {
    const cls = lookup(c);
    const llmKind = cls?.kind ?? cls?.component_kind ?? '(missing)';
    const heur = NFR_DOMAIN_RE.test(c.domain_id || '') || NFR_DOMAIN_RE.test(c.name || '');
    if (llmKind === 'cross_cutting') llmCC++;
    if (heur) heurCC++;
    const ok = (llmKind === 'cross_cutting') === heur;
    if (ok) agree++;
    log(`| ${c.id} | ${c.domain_id} | ${llmKind} | ${heur ? 'NFR' : 'fn'} | ${ok ? '✓' : '✗'} |`);
  }
  log(`\n**LLM tagged ${llmCC}/${comps.length} cross_cutting; naive heuristic ${heurCC}; agreement ${agree}/${comps.length}.**`);
}

// ── deterministic same-domain merge (mirror of consolidateToBudget) ──
function deterministicMerge(comps, budget) {
  const arr = comps.map(c => ({ id: c.id, domain: c.domain_id, traces: [...(c.traces_to || [])] }));
  const byDomain = new Map();
  for (const c of arr) { const d = c.domain || '_'; (byDomain.get(d) || byDomain.set(d, []).get(d)).push(c); }
  const merges = []; let total = arr.length;
  while (total > budget) {
    let target = null;
    for (const g of byDomain.values()) if (g.length >= 2 && (!target || g.length > target.length)) target = g;
    if (!target) break;
    const into = target[0]; const victim = target.pop();
    into.traces = [...new Set([...into.traces, ...victim.traces])];
    merges.push({ into: into.id, merged: victim.id }); total--;
  }
  return { groups: [...byDomain.values()].flat().map(c => ({ id: c.id, traces: c.traces })), merges };
}

// ── Probe 1b — consolidation: LLM vs deterministic ──────────────────
async function probe1b(db) {
  log('\n# Probe 1b — consolidation (LLM vs deterministic same-domain)\n');
  const cm = loadCurrent(db, 'component_model')[0];
  // Post-1a functional subset (exclude naive NFR domains).
  const functional = cm.components.filter(c => !NFR_DOMAIN_RE.test(c.domain_id || '') && !NFR_DOMAIN_RE.test(c.name || ''));
  const fr = loadCurrent(db, 'functional_requirements')[0];
  const usCount = (fr?.user_stories || []).length;
  const budget = Math.max(1, usCount);
  log(`functional components after 1a heuristic: ${functional.length}; user stories: ${usCount}; budget: ${budget}`);

  const allTraces = new Set(functional.flatMap(c => c.traces_to || []));
  const det = deterministicMerge(functional, budget);
  const detTraces = new Set(det.groups.flatMap(g => g.traces));
  const detCoverage = [...allTraces].every(t => detTraces.has(t));
  log(`\n**Deterministic:** ${functional.length} → ${det.groups.length} components, ${det.merges.length} merges, coverage preserved: ${detCoverage}`);

  const compLines = functional.map(c => `- ${c.id} (domain ${c.domain_id}): ${c.name}. traces_to: ${JSON.stringify(c.traces_to || [])}`).join('\n');
  const system = 'You are an architecture reviewer consolidating an over-decomposed component set. Merge the components into AT MOST N cohesive groups, combining components that serve the same capability or have overlapping responsibilities. Every group must preserve the UNION of its members traces_to (no user story may be dropped). Respond ONLY with JSON: {"groups":[{"name":"...","members":["comp-..."],"merged_traces":["US-..."],"rationale":"..."}]}';
  const user = `Components:\n${compLines}\n\nMerge into at most ${budget} groups.`;
  const { text, ms } = await llm(system, user, { json: true });
  const parsed = parseJsonLoose(text);
  log(`\n(LLM ${MODEL}, ${ms}ms)`);
  if (!parsed?.groups) { log('PARSE FAILED. Raw:\n' + text.slice(0, 1500)); return; }
  const llmTraces = new Set(parsed.groups.flatMap(g => g.merged_traces || []));
  const llmCoverage = [...allTraces].every(t => llmTraces.has(t));
  const crossDomain = parsed.groups.filter(g => new Set((g.members || []).map(m => (functional.find(c => c.id === m) || {}).domain_id)).size > 1).length;
  log(`**LLM:** ${functional.length} → ${parsed.groups.length} groups, coverage preserved: ${llmCoverage}, cross-domain merges: ${crossDomain} (deterministic can NEVER do cross-domain).`);
  for (const g of parsed.groups) log(`  - ${g.name}: [${(g.members || []).join(', ')}] — ${g.rationale || ''}`);
}

// ── Probe 2c — duplicate consolidation ──────────────────────────────
async function probe2c() {
  log('\n# Probe 2c — divergent-duplicate consolidation\n');
  const files = [
    'src/services/api-service/services/encryption-service.js',
    'src/services/encryption-service/encryption-service.js',
    'src/services/redirect-service/services/encryption-service.js',
  ];
  const bodies = files.map(f => ({ f, code: fs.readFileSync(path.join(WS, f), 'utf-8') }));
  const exported = new Set();
  for (const b of bodies) {
    for (const m of b.code.matchAll(/(?:export\s+(?:async\s+)?function|exports\.|export\s+const)\s*([A-Za-z0-9_]+)/g)) exported.add(m[1]);
    const me = b.code.match(/module\.exports\s*=\s*{([^}]*)}/);
    if (me) for (const name of me[1].split(',')) { const n = name.trim(); if (n) exported.add(n); }
  }
  log(`union of exported symbols across the 3 copies: ${[...exported].join(', ')}`);

  const system = 'You are consolidating duplicate modules. You are given THREE divergent implementations of the same module found at different paths in one codebase. Produce ONE canonical module (choose a single module system and state which), preserving the UNION of exported functions and the strongest behavior. Then list which paths should be deleted and replaced with an import of the canonical module. Note any genuine semantic conflicts you could not reconcile.';
  const user = bodies.map((b, i) => `### Copy ${i + 1}: ${b.f}\n\`\`\`js\n${b.code}\n\`\`\``).join('\n\n') +
    '\n\nProduce: (1) the canonical module code, (2) the list of paths to replace with imports, (3) any unreconciled conflicts.';
  const { text, ms } = await llm(system, user, { json: false });
  log(`\n(LLM ${MODEL}, ${ms}ms)\n`);
  log(text.slice(0, 4000));
  const covered = [...exported].filter(s => text.includes(s));
  log(`\n**Canonical output mentions ${covered.length}/${exported.size} of the union symbols: ${covered.join(', ')}**`);
}

// ── Probe 2c-census — what a real 2c auto-fix must handle (deterministic) ──
const UBIQUITOUS = new Set(['index', 'types', 'main', 'mod', '__init__', 'setup', 'conftest']);
const isTest = b => /\.(test|spec)\./i.test(b) || b.startsWith('test_');
const sha = s => require('node:crypto').createHash('sha256').update(s).digest('hex').slice(0, 10);

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.janumicode' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) acc.push(p);
  }
}
const moduleSystem = code => /\b(import|export)\b/.test(code) && !/\brequire\(|module\.exports/.test(code) ? 'ESM'
  : /\brequire\(|module\.exports/.test(code) ? 'CJS' : 'unknown';
const hasAsync = code => /\basync\b|\bawait\b/.test(code);
function exportsOf(code) {
  const s = new Set();
  for (const m of code.matchAll(/(?:export\s+(?:async\s+)?function|export\s+const|export\s+(?:async\s+)?let)\s+([A-Za-z0-9_]+)/g)) s.add(m[1]);
  for (const m of code.matchAll(/exports\.([A-Za-z0-9_]+)/g)) s.add(m[1]);
  const me = code.match(/module\.exports\s*=\s*{([^}]*)}/s);
  if (me) for (const n of me[1].split(',')) { const t = n.split(':')[0].trim(); if (/^[A-Za-z0-9_]+$/.test(t)) s.add(t); }
  return s;
}

function probe2cCensus() {
  log('\n# Probe 2c-census — what a solid 2c auto-fix must handle (deterministic)\n');
  const srcRoot = path.join(WS, 'src');
  const files = []; walk(srcRoot, files);
  // Group by basename, flag divergent (≥2 distinct hashes), skip ubiquitous/test/config.
  const byBase = new Map();
  for (const abs of files) {
    const base = path.basename(abs).toLowerCase();
    const stem = base.replace(/\.[^.]+$/, '');
    if (UBIQUITOUS.has(stem) || isTest(base)) continue;
    if (/^(package\.json|tsconfig\.json)$/.test(base)) continue;
    const code = fs.readFileSync(abs, 'utf-8');
    (byBase.get(stem) || byBase.set(stem, []).get(stem)).push({ abs, rel: path.relative(WS, abs).replace(/\\/g, '/'), code, h: sha(code) });
  }
  const groups = [...byBase.entries()].filter(([, v]) => v.length >= 2 && new Set(v.map(x => x.h)).size >= 2);
  log(`**Divergent-duplicate groups in the workspace: ${groups.length}**\n`);

  let totalImporters = 0, conflictGroups = 0;
  const allImporterFiles = new Set();
  for (const [stem, copies] of groups) {
    log(`## group: ${stem}  (${copies.length} divergent copies)`);
    const exportSets = copies.map(c => exportsOf(c.code));
    const unionExports = new Set(exportSets.flatMap(s => [...s]));
    const sysSplit = copies.map(c => moduleSystem(c.code));
    const asyncSplit = copies.map(c => hasAsync(c.code));
    for (let i = 0; i < copies.length; i++) {
      log(`  - ${copies[i].rel}  [${sysSplit[i]}/${asyncSplit[i] ? 'async' : 'sync'}]  exports: {${[...exportSets[i]].join(', ')}}`);
    }
    const exportMismatch = exportSets.some(s => [...unionExports].some(x => !s.has(x)));
    const sysMismatch = new Set(sysSplit).size > 1;
    const asyncMismatch = new Set(asyncSplit).size > 1;
    if (exportMismatch || sysMismatch || asyncMismatch) conflictGroups++;
    log(`  conflicts → export-surface differs: ${exportMismatch} | module-system split: ${sysMismatch} (${[...new Set(sysSplit)].join('/')}) | sync-vs-async split: ${asyncMismatch}`);

    // Importer census: any source file referencing this stem via import/require.
    const importers = [];
    for (const f of files) {
      if (copies.some(c => c.abs === f)) continue;
      const code = fs.readFileSync(f, 'utf-8');
      const specRe = new RegExp(`(?:require\\(|from\\s+)['"]([^'"]*\\/${stem})['"]`, 'g');
      const symsUsed = new Set();
      let matched = false;
      for (const m of code.matchAll(specRe)) {
        matched = true;
        // crude symbol extraction from the destructure on the same/prev line
        const idx = m.index;
        const line = code.slice(Math.max(0, idx - 200), idx + 120);
        const dest = line.match(/(?:const|import)\s*{([^}]*)}/);
        if (dest) for (const n of dest[1].split(',')) { const t = n.split(/[:\s]/)[0].trim(); if (t) symsUsed.add(t); }
      }
      if (matched) {
        const awaited = [...symsUsed].filter(s => new RegExp(`await\\s+${s}\\s*\\(`).test(code));
        importers.push({ rel: path.relative(WS, f).replace(/\\/g, '/'), sys: moduleSystem(code), syms: [...symsUsed], awaited, isTest: isTest(path.basename(f)) });
        allImporterFiles.add(f);
      }
    }
    totalImporters += importers.length;
    const impSysSplit = [...new Set(importers.map(i => i.sys))];
    const usedUnion = new Set(importers.flatMap(i => i.syms));
    const usedNotEverywhere = [...usedUnion].filter(x => exportSets.some(s => !s.has(x)));
    log(`  importers: ${importers.length} (module systems among importers: ${impSysSplit.join('/') || 'n/a'}; tests among them: ${importers.filter(i => i.isTest).length})`);
    if (usedNotEverywhere.length) log(`  ⚠ symbols used by importers but NOT exported by every copy: {${usedNotEverywhere.join(', ')}}`);
    const awaitedAnywhere = importers.some(i => i.awaited.length);
    if (awaitedAnywhere && asyncMismatch) log(`  ⚠ some importers AWAIT symbols, but copies disagree sync/async — interop hazard on consolidation`);
    log('');
  }

  log('## What a solid 2c auto-fix must handle (derived from the census)');
  log(`- ${groups.length} duplicate groups, ${conflictGroups} with real conflicts (export-surface / module-system / sync-async).`);
  log(`- ${totalImporters} import sites across ${allImporterFiles.size} files to rewrite (relative paths differ per importer → must recompute each).`);
  log(`- Module-system interop: importers mix ESM/CJS → a single canonical module needs interop or per-importer conversion.`);
  log(`- Sync/async signature reconciliation where copies disagree (the original encryptUrl bug class).`);
  log(`- Test files among importers must be repointed and must still pass — behavioral equivalence, not just symbol presence.`);
  log(`- LLM is good at SYNTHESIS (canonical module); the above APPLICATION work is deterministic AST/path-rewriting (no such tooling in repo yet).`);
}

// ── main ────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(DB_PATH)) { console.error('DB not found:', DB_PATH); process.exit(1); }
  const db = new Database(DB_PATH, { readonly: true });
  log(`# Consolidation probe — ts-125 — model ${MODEL}\n`);
  try {
    if (which.includes('1a')) await probe1a(db);
    if (which.includes('1b')) await probe1b(db);
    if (which.includes('2c')) await probe2c();
    if (which.includes('2ccensus')) probe2cCensus();
  } catch (e) {
    log('\nPROBE ERROR: ' + (e && e.stack || e));
  } finally {
    db.close();
  }
  const out = path.join(__dirname, 'consolidation-probe-report.md');
  fs.writeFileSync(out, report.join('\n') + '\n');
  console.log('\n[report written]', out);
})();
