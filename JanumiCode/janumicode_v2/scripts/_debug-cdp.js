#!/usr/bin/env node
/**
 * Minimal CDP harness for agent-driven debugging of the orchestrator.
 *
 * Connects to a Node process started with `--inspect-brk` (or `--inspect`),
 * sets one or more breakpoints, releases the initial pause, and dumps
 * paused-state details to stdout when each breakpoint fires.
 *
 * Usage:
 *   node scripts/_debug-cdp.js \
 *     --ws ws://127.0.0.1:9229/<uuid> \
 *     --bp dist/cli/janumicode.js:44266 \
 *     [--bp <file:line>] ...
 *
 * On each Debugger.paused, dumps:
 *   - reason, hit breakpoint id
 *   - call stack (top 5 frames, with sourceMap-resolved positions when present)
 *   - selected local/closure variables at the top frame
 * Then resumes execution.
 */
/* eslint-disable */

const WebSocket = require('../node_modules/.pnpm/ws@8.20.0/node_modules/ws');
const http = require('http');

function parseArgs(argv) {
  const out = { bps: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ws') out.ws = argv[++i];
    else if (a === '--port') out.port = argv[++i];
    else if (a === '--bp') out.bps.push(argv[++i]);
    else if (a === '--auto-resume') out.autoResume = true;
  }
  if (!out.ws && !out.port) out.port = '9229';
  return out;
}

function fetchJson(host, port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host, port, path }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function resolveWsUrl(args) {
  if (args.ws) return args.ws;
  // Probe /json to find the orchestrator inspector
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const list = await fetchJson('127.0.0.1', args.port, '/json/list');
      if (list && list.length > 0) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch (_) {/* not yet listening */}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Could not reach inspector on port ${args.port} after 60s`);
}

let nextId = 1;
const pending = new Map();

function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[${ts()}] [cdp] resolving inspector...`);
  const wsUrl = await resolveWsUrl(args);
  console.log(`[${ts()}] [cdp] connecting to ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  console.log(`[${ts()}] [cdp] connected`);

  // Pending breakpoints: parsed BP specs that need a matching scriptParsed
  // event before they can be set. We don't use setBreakpointByUrl because
  // its urlRegex matching was returning 0 locations against Node's
  // actual script URLs (likely due to escaping / path-format mismatch on
  // Windows). Listening for scriptParsed and calling Debugger.setBreakpoint
  // with the concrete scriptId is more reliable.
  const pendingBps = [];   // [{ baseName, line, originalSpec, set: boolean }]
  for (const spec of args.bps) {
    const m = spec.match(/^(.+):(\d+)$/);
    if (!m) { console.error(`[${ts()}] [cdp] skip malformed BP: ${spec}`); continue; }
    const [, file, lineStr] = m;
    pendingBps.push({
      baseName: file.replace(/^.*[\\\/]/, '').toLowerCase(),
      line: parseInt(lineStr, 10) - 1,
      originalSpec: spec,
      set: false,
    });
  }

  const scriptIdByUrl = new Map();   // url → scriptId (diagnostic)

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method === 'Debugger.paused') {
      handlePaused(ws, msg.params).catch((e) => console.error(`[${ts()}] [cdp] paused handler error:`, e));
      return;
    }
    if (msg.method === 'Debugger.scriptParsed') {
      handleScriptParsed(ws, msg.params, pendingBps, scriptIdByUrl)
        .catch((e) => console.error(`[${ts()}] [cdp] scriptParsed handler error:`, e));
    }
  });

  await send(ws, 'Runtime.enable');
  await send(ws, 'Debugger.enable');
  // Debugger.enable replays scriptParsed for already-loaded scripts;
  // our handler above sets BPs as the matching scripts come through.

  // Release initial --inspect-brk pause (no-op if --inspect was used).
  console.log(`[${ts()}] [cdp] runIfWaitingForDebugger`);
  await send(ws, 'Runtime.runIfWaitingForDebugger');

  console.log(`[${ts()}] [cdp] attached, waiting for matching scriptParsed events`);
  console.log(`[${ts()}] [cdp] target BPs:`);
  for (const bp of pendingBps) {
    console.log(`[${ts()}] [cdp]   - ${bp.originalSpec} (basename match: '${bp.baseName}')`);
  }

  // After 5 seconds, summarize which BPs are still unset so we can spot
  // mismatched URLs / wrong files quickly.
  setTimeout(() => {
    for (const bp of pendingBps) {
      if (!bp.set) {
        console.warn(`[${ts()}] [cdp] WARN: BP still pending after 5s: ${bp.originalSpec}`);
        const urls = [...scriptIdByUrl.keys()];
        const matches = urls.filter((u) => u.toLowerCase().endsWith(bp.baseName));
        if (matches.length > 0) {
          console.warn(`[${ts()}] [cdp]   candidate scripts seen (case-insensitive endsWith): ${matches.join(', ')}`);
        } else {
          console.warn(`[${ts()}] [cdp]   no scripts matched. ${urls.length} scripts seen.`);
          console.warn(`[${ts()}] [cdp]   sample URLs: ${urls.slice(0, 3).join(', ')}`);
        }
      }
    }
  }, 5000);

  process.stdin.resume();  // keep alive
}

async function handleScriptParsed(ws, params, pendingBps, scriptIdByUrl) {
  const url = params.url || '(no url)';
  scriptIdByUrl.set(url, params.scriptId);
  // Match by basename (case-insensitive) — robust against file:// vs
  // path-style URLs and Windows vs POSIX separators.
  const urlLower = url.toLowerCase();
  for (const bp of pendingBps) {
    if (bp.set) continue;
    if (!urlLower.endsWith(bp.baseName)) continue;
    try {
      const res = await send(ws, 'Debugger.setBreakpoint', {
        location: { scriptId: params.scriptId, lineNumber: bp.line, columnNumber: 0 },
      });
      bp.set = true;
      console.log(
        `[${ts()}] [cdp] BP bound: ${bp.originalSpec} → scriptId=${params.scriptId} ` +
        `actualLine=${res.actualLocation.lineNumber + 1}  url=${url.slice(0, 80)}`,
      );
    } catch (e) {
      console.error(`[${ts()}] [cdp] setBreakpoint failed for ${bp.originalSpec}:`, e.message);
    }
  }
}

async function handlePaused(ws, params) {
  console.log('');
  console.log(`========================================================`);
  console.log(`[${ts()}] [cdp] PAUSED — reason: ${params.reason}`);
  if (params.hitBreakpoints && params.hitBreakpoints.length) {
    console.log(`           breakpoints hit: ${params.hitBreakpoints.join(', ')}`);
  }
  console.log(`========================================================`);

  // Top of call stack
  const stack = params.callFrames.slice(0, 5);
  console.log(`[${ts()}] [cdp] call stack (top ${stack.length}):`);
  for (const f of stack) {
    const loc = f.location;
    console.log(`  ${f.functionName || '<anon>'}  @ scriptId=${loc.scriptId} line=${loc.lineNumber + 1}`);
  }

  // Inspect top frame's scope chain
  const top = params.callFrames[0];
  console.log(`[${ts()}] [cdp] top frame scope chain:`);
  for (const scope of top.scopeChain) {
    if (scope.type === 'global' || scope.type === 'module') continue;
    try {
      const props = await send(ws, 'Runtime.getProperties', {
        objectId: scope.object.objectId,
        ownProperties: true,
      });
      const names = (props.result || []).map(p => p.name).slice(0, 15);
      console.log(`  ${scope.type}: ${names.join(', ')}`);
    } catch (e) {
      console.log(`  ${scope.type}: (failed to enumerate: ${e.message})`);
    }
  }

  // Evaluate `this` and a few well-known locals when present
  const tryEval = async (expr) => {
    try {
      const res = await send(ws, 'Debugger.evaluateOnCallFrame', {
        callFrameId: top.callFrameId,
        expression: expr,
        returnByValue: false,
        generatePreview: true,
      });
      return res;
    } catch (e) {
      return { error: e.message };
    }
  };

  console.log(`[${ts()}] [cdp] evaluating common targets:`);
  for (const expr of [
    'this?.phaseId',
    'ctx?.workflowRun?.id',
    'ctx?.workflowRun?.intent_lens',
    'ctx?.workflowRun?.current_phase_id',
    'typeof allArtifacts !== "undefined" ? allArtifacts.length : "n/a"',
    'typeof prior !== "undefined" ? Object.keys(prior).slice(0,10) : "n/a"',
  ]) {
    const r = await tryEval(expr);
    if (r.error) console.log(`  ${expr.padEnd(60)} => ERROR: ${r.error}`);
    else if (r.result) {
      const v = r.result;
      const desc = v.value !== undefined ? JSON.stringify(v.value) : (v.description || v.type);
      console.log(`  ${expr.padEnd(60)} => ${desc}`);
    }
  }

  console.log(`[${ts()}] [cdp] resuming...`);
  await send(ws, 'Debugger.resume');
}

main().catch((e) => {
  console.error('[cdp] fatal:', e);
  process.exit(1);
});
