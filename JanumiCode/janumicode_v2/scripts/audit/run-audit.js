#!/usr/bin/env node
/* eslint-disable */
/**
 * Live auditor for a thin-slice run.
 *
 * Tails .janumicode/runs/<workflow_run_id>/lifecycle.ndjson as a real
 * workflow run produces events. For every sub_phase.exited event,
 * looks up the matching expectation card and runs each predicate.
 * Findings go to stdout (one JSON line per finding) and a final
 * roll-up file at the workspace's .janumicode/audit-report.json.
 *
 * Usage:
 *   node scripts/audit/run-audit.js \
 *     --workspace <path> \
 *     [--expectations scripts/audit/tinyurl-expectations.js]
 *
 * Designed to be tailed alongside the workflow run — operator can
 * grep "FAIL" or pipe to jq for live signal. Final report is
 * written when the lifecycle file's last event is `phase.exited`
 * for phase 10 (or the workflow completes).
 *
 * Read-only against the workflow run. Re-startable.
 */

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--expectations') out.expectations = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write('usage: --workspace <path> [--expectations <path>] [--run-id <id>]\n');
      process.exit(0);
    }
  }
  if (!out.workspace) {
    process.stderr.write('error: --workspace is required\n');
    process.exit(2);
  }
  return out;
}

// ── State ──────────────────────────────────────────────────────────

class AuditState {
  constructor() {
    // workflow_run_id → { subPhases: Map<subPhaseId, SubPhaseState>, currentSubPhase: string | null }
    this.runs = new Map();
    this.findings = [];
  }

  ensureRun(runId) {
    if (!this.runs.has(runId)) {
      this.runs.set(runId, {
        subPhases: new Map(),
        currentSubPhaseId: null,
        allArtifacts: [],
        executorInvocations: new Map(),
      });
    }
    return this.runs.get(runId);
  }

  ensureSubPhase(runId, subPhaseId) {
    const run = this.ensureRun(runId);
    if (!run.subPhases.has(subPhaseId)) {
      run.subPhases.set(subPhaseId, {
        subPhaseId,
        enteredAt: null,
        exitedAt: null,
        artifacts: [],
      });
    }
    return run.subPhases.get(subPhaseId);
  }
}

// ── Event processing ──────────────────────────────────────────────

function onEvent(state, expectations, event) {
  if (!event || typeof event !== 'object') return;
  const runId = event.workflow_run_id;
  if (!runId) return;
  const run = state.ensureRun(runId);

  switch (event.event) {
    case 'workflow.resumed': {
      // Resume marker — invalidate stale state for the target sub-phase
      // and everything after it in this run. Subsequent events for the
      // same sub-phase represent the re-run; old findings stay in the
      // findings array (they describe what was true at the time) but
      // the per-sub-phase artifacts/audit cache resets so the auditor
      // doesn't double-count.
      const fromSub = event.from_sub_phase;
      if (fromSub) {
        // Wipe the sub-phase cache for the resumed sub-phase. (We don't
        // know which later sub-phases will re-run; they'll get fresh
        // entered events anyway, and ensureSubPhase will reset them
        // if their state has stale exitedAt.)
        run.subPhases.delete(fromSub);
      }
      // Mark the resume in findings for visibility on the human-readable
      // side of the audit-report.json.
      state.findings.push({
        runId,
        severity: 'INFO',
        category: 'workflow_resumed',
        from_phase: event.from_phase,
        from_sub_phase: fromSub,
        rollback: event.rollback,
        ts: event.ts,
      });
      report(state.findings[state.findings.length - 1]);
      // Also track on the run object so the final report can show
      // which sub-phases were re-run.
      if (!run.resumes) run.resumes = [];
      run.resumes.push({ ts: event.ts, from_phase: event.from_phase, from_sub_phase: fromSub });
      break;
    }
    case 'sub_phase.entered': {
      run.currentSubPhaseId = event.sub_phase_id;
      // If we're entering a sub-phase that has a prior exitedAt without
      // a workflow.resumed marker in between, this is a re-run within
      // the same logical session (e.g. a saturation loop). Clear the
      // prior state to avoid stacking artifacts across iterations.
      const existing = run.subPhases.get(event.sub_phase_id);
      if (existing?.exitedAt) {
        run.subPhases.delete(event.sub_phase_id);
      }
      const sp = state.ensureSubPhase(runId, event.sub_phase_id);
      sp.enteredAt = event.ts;
      break;
    }
    case 'sub_phase.exited': {
      const sp = state.ensureSubPhase(runId, event.sub_phase_id);
      sp.exitedAt = event.ts;
      // Run predicates for this sub-phase now that it's complete.
      auditSubPhase(state, expectations, run, sp);
      break;
    }
    case 'artifact.produced': {
      run.allArtifacts.push(event);
      const subPhaseId = event.sub_phase_id ?? run.currentSubPhaseId;
      if (subPhaseId) {
        const sp = state.ensureSubPhase(runId, subPhaseId);
        sp.artifacts.push(event);
      }
      break;
    }
    case 'phase.entered':
    case 'phase.exited': {
      // Logged but not audited at this layer.
      break;
    }
    case 'packet.synthesized': {
      // Track for cross-phase audit (Phase 8.5).
      if (!run.packets) run.packets = [];
      run.packets.push(event);
      break;
    }
    case 'executor.invocation_status_change': {
      const invId = event.invocation_record_id;
      if (!invId) break;
      const prev = run.executorInvocations.get(invId) ?? { events: [] };
      prev.events.push({ to: event.to, ts: event.ts, task_id: event.task_id });
      prev.terminal = event.to === 'completed' || event.to === 'failed';
      run.executorInvocations.set(invId, prev);
      break;
    }
    case 'executor.agent_output_write_failed':
    case 'executor.agent_output_skipped':
    case 'executor.agent_invocation_write_failed':
    case 'executor.agent_invocation_skipped': {
      state.findings.push({
        runId,
        severity: 'BLOCK',
        category: 'executor_observability',
        event: event.event,
        details: event,
      });
      report(state.findings[state.findings.length - 1]);
      break;
    }
    case 'phase8_5.ref_resolution': {
      if (event.resolved === false) {
        state.findings.push({
          runId,
          severity: 'BLOCK',
          category: 'phase8_5_fabricated_ref',
          ref: event.ref,
          ref_namespace: event.ref_namespace,
          packet_id: event.packet_id,
          task_id: event.task_id,
        });
        report(state.findings[state.findings.length - 1]);
      }
      break;
    }
    case 'phase4.saturation_iteration_complete': {
      // Surface scope-creep signal immediately.
      const n = event.final_leaf_count;
      if (n > 8) {
        state.findings.push({
          runId,
          severity: 'WARN',
          category: 'phase4_scope_creep',
          final_leaf_count: n,
          tier_distribution: event.tier_distribution,
          msg: `Phase 4 produced ${n} leaf components — expected ≤8 for tinyurl`,
        });
        report(state.findings[state.findings.length - 1]);
      }
      break;
    }
    default:
      // Ignore — informational event we don't audit.
      break;
  }
}

function auditSubPhase(state, expectations, run, sp) {
  const cards = expectations[sp.subPhaseId] ?? expectations.__default__ ?? [];
  const evalCtx = {
    subPhaseEvent: sp,
    artifacts: sp.artifacts,
    allArtifacts: run.allArtifacts,
  };
  let pass = 0;
  let fail = 0;
  const localFindings = [];
  for (const card of cards) {
    try {
      const res = card.check(evalCtx);
      if (res.ok) {
        pass++;
      } else {
        fail++;
        const finding = {
          runId: run.allArtifacts[0]?.workflow_run_id ?? '?',
          severity: 'BLOCK',
          category: 'expectation_failed',
          subPhaseId: sp.subPhaseId,
          predicateId: card.id,
          predicateDesc: card.desc,
          reason: res.msg,
        };
        state.findings.push(finding);
        localFindings.push(finding);
      }
    } catch (err) {
      const finding = {
        runId: run.allArtifacts[0]?.workflow_run_id ?? '?',
        severity: 'WARN',
        category: 'predicate_threw',
        subPhaseId: sp.subPhaseId,
        predicateId: card.id,
        predicateDesc: card.desc,
        error: err instanceof Error ? err.message : String(err),
      };
      state.findings.push(finding);
      localFindings.push(finding);
    }
  }
  // One-line summary per sub-phase.
  const summary = {
    type: 'sub_phase_audit_summary',
    subPhaseId: sp.subPhaseId,
    pass,
    fail,
    artifactCount: sp.artifacts.length,
  };
  report(summary);
  for (const f of localFindings) report(f);
}

function report(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

// ── Tail logic ─────────────────────────────────────────────────────

function streamLifecycle(workspacePath, expectations, state) {
  // Discover the most recent run dir if --run-id not given.
  const runsDir = path.join(workspacePath, '.janumicode', 'runs');
  if (!fs.existsSync(runsDir)) {
    process.stderr.write(`audit: no .janumicode/runs/ at ${runsDir}\n`);
    process.stderr.write('audit: waiting for it to appear...\n');
  }

  // Watch all runs subdirectories; tail their lifecycle.ndjson if any.
  const tailers = new Map(); // runId → { offset, watcher }

  const tryAttach = () => {
    if (!fs.existsSync(runsDir)) return;
    for (const dirent of fs.readdirSync(runsDir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const runId = dirent.name;
      if (tailers.has(runId)) continue;
      const filepath = path.join(runsDir, runId, 'lifecycle.ndjson');
      if (!fs.existsSync(filepath)) continue;
      attachTail(runId, filepath);
    }
  };

  const attachTail = (runId, filepath) => {
    // Restore per-file offset from disk so a restarted auditor resumes
    // where the previous instance left off rather than re-emitting every
    // historical finding. The state file lives next to the lifecycle.ndjson
    // it tracks so it's naturally per-run and naturally cleaned up when
    // the workspace is.
    const stateFile = path.join(path.dirname(filepath), 'audit-tail-state.json');
    let offset = 0;
    try {
      if (fs.existsSync(stateFile)) {
        const prev = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        if (typeof prev?.offset === 'number') {
          // Defensive: if the file shrank under us (e.g., truncated),
          // fall back to offset 0 so we don't read past EOF.
          const sz = fs.existsSync(filepath) ? fs.statSync(filepath).size : 0;
          offset = prev.offset <= sz ? prev.offset : 0;
        }
      }
    } catch {/* corrupted state file — start at 0 */}
    process.stderr.write(`audit: tailing ${filepath} (start offset=${offset})\n`);

    let partial = '';
    const persistState = () => {
      try {
        fs.writeFileSync(stateFile, JSON.stringify({ offset }), 'utf8');
      } catch (err) {
        process.stderr.write(`audit: state-persist failed for ${runId}: ${err.message}\n`);
      }
    };
    const flush = () => {
      try {
        const stat = fs.statSync(filepath);
        if (stat.size <= offset) return;
        const fd = fs.openSync(filepath, 'r');
        const buf = Buffer.alloc(stat.size - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        offset = stat.size;
        const text = partial + buf.toString('utf8');
        const lines = text.split('\n');
        partial = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let ev;
          try { ev = JSON.parse(t); } catch { continue; }
          onEvent(state, expectations, ev);
        }
        persistState();
      } catch (err) {
        process.stderr.write(`audit: tail error for ${runId}: ${err.message}\n`);
      }
    };
    // Initial drain + poll every 500ms (fs.watch is unreliable on append).
    flush();
    const interval = setInterval(flush, 500);
    tailers.set(runId, { interval, persistState });
  };

  setInterval(tryAttach, 1500);
  tryAttach();
}

// ── Final report on signal ─────────────────────────────────────────

function installFinalReport(state, workspacePath) {
  const writeReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      runs: [...state.runs.entries()].map(([runId, run]) => ({
        runId,
        sub_phase_count: run.subPhases.size,
        sub_phases: [...run.subPhases.values()].map((sp) => ({
          subPhaseId: sp.subPhaseId,
          enteredAt: sp.enteredAt,
          exitedAt: sp.exitedAt,
          artifactCount: sp.artifacts.length,
          artifactKinds: [...new Set(sp.artifacts.map((a) => a.kind ?? a.record_type))],
        })),
        executor_invocation_count: run.executorInvocations?.size ?? 0,
        executor_terminal_count: [...(run.executorInvocations?.values() ?? [])]
          .filter((v) => v.terminal).length,
        packet_count: run.packets?.length ?? 0,
        packet_passed_count: (run.packets ?? []).filter((p) => p.coherence_passed).length,
      })),
      findings: state.findings,
    };
    const out = path.join(workspacePath, '.janumicode', 'audit-report.json');
    try {
      fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
      process.stderr.write(`audit: wrote final report to ${out}\n`);
    } catch (err) {
      process.stderr.write(`audit: failed to write report: ${err.message}\n`);
    }
  };
  process.on('SIGINT', () => { writeReport(); process.exit(0); });
  process.on('SIGTERM', () => { writeReport(); process.exit(0); });
  // Auto-write every 60s during the run so partial findings survive.
  setInterval(writeReport, 60000);
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const expectationsPath = path.resolve(
    args.expectations ??
      path.join(__dirname, 'tinyurl-expectations.js'),
  );
  const expectations = require(expectationsPath);
  const state = new AuditState();
  installFinalReport(state, args.workspace);
  streamLifecycle(args.workspace, expectations, state);
  process.stderr.write(`audit: started for ${args.workspace}\n`);
}

main();
