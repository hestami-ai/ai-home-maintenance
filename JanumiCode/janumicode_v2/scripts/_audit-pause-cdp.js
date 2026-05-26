#!/usr/bin/env node
/**
 * Audit-pause CDP harness.
 *
 * Attaches to the orchestrator's V8 inspector and uses the `debugger;`
 * statement in auditPause.ts as the pause point. When the workflow hits
 * the breakpoint:
 *
 *   1. Reads the matching pause marker from .janumicode/audit/pending/
 *      to identify which sub_phase.exited we're parked at.
 *   2. Optionally dumps locals (workflowRunId, priorSubPhaseId, seq) for
 *      diagnostic context.
 *   3. Polls for the ack file at .janumicode/audit/acks/.
 *   4. When the ack appears, issues Debugger.resume to release the V8
 *      pause. Execution then enters the sync ack-poll loop in auditPause.ts
 *      which immediately sees the same ack and proceeds.
 *
 * Why both CDP pause AND ack file: CDP gives the audit agent runtime
 * introspection (eval-on-frame, scope chain). The ack file gates
 * semantic progression and survives CDP disconnects. Belt + suspenders.
 *
 * Usage:
 *   node scripts/_audit-pause-cdp.js \
 *     --workspace <path> \
 *     [--port 9229] [--ws ws://...]
 */
/* eslint-disable */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const WebSocket = require('../node_modules/.pnpm/ws@8.20.0/node_modules/ws');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--port') out.port = argv[++i];
    else if (a === '--ws') out.ws = argv[++i];
  }
  if (!out.port && !out.ws) out.port = '9229';
  if (!out.workspace) { console.error('--workspace required'); process.exit(2); }
  return out;
}

function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function fetchJson(host, port, path) {
  return new Promise((res, rej) => {
    http.get({ host, port, path }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function resolveWs(args) {
  if (args.ws) return args.ws;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetchJson('127.0.0.1', args.port, '/json/list');
      if (list && list.length) return list[0].webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`inspector not reachable on port ${args.port}`);
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

async function main() {
  const args = parseArgs(process.argv);
  const pendingDir = path.join(args.workspace, '.janumicode', 'audit', 'pending');
  const ackDir = path.join(args.workspace, '.janumicode', 'audit', 'acks');

  console.log(`[${ts()}] [audit-cdp] resolving inspector...`);
  const wsUrl = await resolveWs(args);
  console.log(`[${ts()}] [audit-cdp] connecting ${wsUrl}`);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method === 'Debugger.paused') {
      handlePaused(ws, msg.params, pendingDir, ackDir).catch(e =>
        console.error(`[${ts()}] [audit-cdp] paused handler error:`, e));
    }
  });

  await send(ws, 'Runtime.enable');
  await send(ws, 'Debugger.enable');
  await send(ws, 'Runtime.runIfWaitingForDebugger');
  console.log(`[${ts()}] [audit-cdp] attached, awaiting debugger; pauses`);
  process.stdin.resume();
}

async function handlePaused(ws, params, pendingDir, ackDir) {
  const reason = params.reason;
  // The `debugger;` statement surfaces as reason='other' in V8. Anything
  // else (breakpoint, exception, step, etc.) we just resume immediately —
  // we're not a general-purpose debugger.
  if (reason !== 'other' && reason !== 'debugCommand') {
    await send(ws, 'Debugger.resume').catch(() => {});
    return;
  }

  // Read the locals at the top frame to identify which pause this is.
  const top = params.callFrames[0];
  const evalExpr = async (expr) => {
    try {
      const r = await send(ws, 'Debugger.evaluateOnCallFrame', {
        callFrameId: top.callFrameId, expression: expr, returnByValue: true,
      });
      return r.result?.value;
    } catch { return undefined; }
  };
  const seq = await evalExpr('seq');
  const sub = await evalExpr('args.priorSubPhaseId');
  const phase = await evalExpr('args.priorPhaseId');
  console.log(`[${ts()}] [audit-cdp] PAUSED seq=${seq} phase=${phase} sub=${sub}`);

  if (typeof seq !== 'number') {
    // Not our pause — resume.
    await send(ws, 'Debugger.resume');
    return;
  }

  // Find the matching marker so we know which ack file to watch.
  const seqPad = String(seq).padStart(4, '0');
  let basename = null;
  try {
    const files = fs.readdirSync(pendingDir);
    basename = files.find(f => f.startsWith(seqPad + '__'))?.replace(/\.json$/, '');
  } catch {}
  if (!basename) {
    console.warn(`[${ts()}] [audit-cdp] no marker for seq=${seq}, resuming`);
    await send(ws, 'Debugger.resume');
    return;
  }
  const ackPath = path.join(ackDir, basename + '.ack');
  console.log(`[${ts()}] [audit-cdp]   awaiting ack: ${ackPath}`);

  // Poll for ack — when it appears, send Debugger.resume. The auditPause
  // sync loop in-process will see the same ack on its next 500ms tick.
  while (true) {
    if (fs.existsSync(ackPath)) {
      console.log(`[${ts()}] [audit-cdp]   ack found — Debugger.resume`);
      await send(ws, 'Debugger.resume');
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(e => { console.error('[audit-cdp] fatal:', e); process.exit(1); });
