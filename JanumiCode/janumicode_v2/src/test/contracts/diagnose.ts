/**
 * Contract harness — diagnose CLI.
 *
 * Usage:
 *   tsx src/test/contracts/diagnose.ts --db <path-to-sqlite.db>
 *                                       [--boundary <boundary-id>]
 *                                       [--phase <phaseId>]
 *                                       [--run-id <workflow-run-id>]
 *                                       [--format text|json]
 *                                       [--fail-on advisory|blocking|never]
 *
 * Opens the governed-stream DB read-only, loads every artifact_produced
 * content keyed by `content.kind`, and runs every ContractSuite in the
 * registry against the appropriate producer artifact(s). Reports
 * structured pass/fail per clause.
 *
 * Stage 2 behavior: registry is empty, so the CLI exits with an
 * "informational" report. Stage 3 populates contracts and the CLI
 * starts surfacing real diagnostics.
 *
 * Exit codes:
 *   0  no failures (or all failures below the --fail-on threshold)
 *   1  failures at/above the --fail-on threshold
 *   2  CLI usage error
 *   3  DB / run not found / no artifacts to inspect
 */

import Database from 'better-sqlite3';
import { CONTRACT_SUITES, findSuite } from './registry';
import { groupByBoundary, runContractSuite, summarize } from './runner';
import type { ContractContext, ContractResult, ContractSuite } from './types';

interface CliArgs {
  db: string;
  boundary?: string;
  phase?: string;
  runId?: string;
  format: 'text' | 'json';
  failOn: 'never' | 'advisory' | 'blocking';
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = { format: 'text', failOn: 'blocking' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`flag ${a} requires a value`);
      return v;
    };
    switch (a) {
      case '--db': args.db = next(); break;
      case '--boundary': args.boundary = next(); break;
      case '--phase': args.phase = next(); break;
      case '--run-id': args.runId = next(); break;
      case '--format': {
        const f = next();
        if (f !== 'text' && f !== 'json') throw new Error(`--format must be 'text' or 'json'`);
        args.format = f;
        break;
      }
      case '--fail-on': {
        const f = next();
        if (f !== 'never' && f !== 'advisory' && f !== 'blocking') {
          throw new Error(`--fail-on must be 'never', 'advisory', or 'blocking'`);
        }
        args.failOn = f;
        break;
      }
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!args.db) throw new Error('--db is required');
  return args as CliArgs;
}

function printUsage(): void {
  process.stdout.write(`usage: tsx src/test/contracts/diagnose.ts --db <path> [opts]

  --db <path>            Path to governed-stream sqlite DB (required, opened read-only)
  --boundary <id>        Run only this boundary (e.g. "4.2_component_skeleton")
  --phase <phaseId>      Run only boundaries whose phaseId matches
  --run-id <uuid>        Restrict to a specific workflow_run_id (default: latest)
  --format text|json     Output format (default: text)
  --fail-on advisory|blocking|never   Exit-code threshold (default: blocking)
`);
}

interface DbArtifact {
  workflowRunId: string;
  kind: string;
  content: unknown;
  producedAt: string;
}

function loadArtifacts(dbPath: string, runId: string | undefined): { runId: string; artifacts: DbArtifact[] } {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    // Resolve run id (latest if not specified)
    let resolvedRunId = runId;
    if (!resolvedRunId) {
      const row = db.prepare(
        'SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1',
      ).get() as { id: string } | undefined;
      if (!row) throw new Error('no workflow_runs found in DB');
      resolvedRunId = row.id;
    }

    // Load every current-version record from the run. We discriminate
    // by `content.kind`, not by record_type — packets, packet failures,
    // cycle iterations etc. use their own record_type but still expose
    // a kind discriminator in content.
    const rows = db.prepare(
      `SELECT workflow_run_id, content, produced_at
       FROM governed_stream
       WHERE is_current_version = 1
         AND workflow_run_id = ?`,
    ).all(resolvedRunId) as Array<{ workflow_run_id: string; content: string; produced_at: string }>;

    const artifacts: DbArtifact[] = [];
    for (const r of rows) {
      let content: { kind?: unknown } & Record<string, unknown>;
      try {
        content = JSON.parse(r.content) as typeof content;
      } catch {
        continue;
      }
      const kind = typeof content.kind === 'string' ? content.kind : undefined;
      if (!kind) continue;
      artifacts.push({
        workflowRunId: r.workflow_run_id,
        kind,
        content,
        producedAt: r.produced_at,
      });
    }

    return { runId: resolvedRunId, artifacts };
  } finally {
    db.close();
  }
}

function buildContext(runId: string, artifacts: DbArtifact[]): ContractContext {
  const byKind = new Map<string, unknown[]>();
  for (const a of artifacts) {
    const existing = byKind.get(a.kind);
    if (existing) existing.push(a.content);
    else byKind.set(a.kind, [a.content]);
  }
  return { workflowRunId: runId, relatedArtifacts: byKind };
}

function selectSuites(args: CliArgs): ReadonlyArray<ContractSuite<unknown>> {
  if (args.boundary) {
    const s = findSuite(args.boundary);
    return s ? [s] : [];
  }
  if (args.phase) {
    return CONTRACT_SUITES.filter((s) => s.phaseId === args.phase);
  }
  return CONTRACT_SUITES;
}

function findProducerArtifact(
  suite: ContractSuite<unknown>,
  artifacts: DbArtifact[],
): unknown | undefined {
  // The most-recent producer artifact of the matching kind.
  // (If a sub-phase re-ran during a cycle, we want the freshest.)
  const matches = artifacts.filter((a) => a.kind === suite.producerArtifactKind);
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b.producedAt.localeCompare(a.producedAt));
  return matches[0].content;
}

function printText(
  runId: string,
  suites: ReadonlyArray<ContractSuite<unknown>>,
  resultsBySuite: Map<string, ContractResult[]>,
  missingProducers: string[],
): void {
  const out: string[] = [];
  out.push(`Contract diagnostic report`);
  out.push(`Run: ${runId}`);
  out.push(`Suites evaluated: ${suites.length}`);
  out.push('');

  if (suites.length === 0) {
    out.push('(no contract suites are registered yet — Stage 2 scaffolding only)');
    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  for (const suite of suites) {
    out.push(`── ${suite.boundaryId} (${suite.producerArtifactKind})`);
    out.push(`   ${suite.description}`);
    if (missingProducers.includes(suite.boundaryId)) {
      out.push(`   ⚠ no producer artifact (kind=${suite.producerArtifactKind}) found in this run`);
      out.push('');
      continue;
    }
    const results = resultsBySuite.get(suite.boundaryId) ?? [];
    const s = summarize(results);
    out.push(`   ${s.passed}/${s.total} clauses passed · ${s.blockingFailures} blocking · ${s.advisoryFailures} advisory`);
    for (const r of results) {
      if (r.passed) continue;
      const marker = r.severity === 'blocking' ? '✖' : '○';
      out.push(`   ${marker} [${r.clauseId}] ${r.clauseDescription}`);
      if (r.message) out.push(`        ${r.message}`);
    }
    out.push('');
  }

  // Roll-up
  const allResults: ContractResult[] = [];
  for (const arr of resultsBySuite.values()) allResults.push(...arr);
  const totals = summarize(allResults);
  out.push(`Totals: ${totals.passed}/${totals.total} passed · ${totals.blockingFailures} blocking · ${totals.advisoryFailures} advisory`);

  process.stdout.write(out.join('\n') + '\n');
}

function printJson(
  runId: string,
  suites: ReadonlyArray<ContractSuite<unknown>>,
  resultsBySuite: Map<string, ContractResult[]>,
  missingProducers: string[],
): void {
  const payload = {
    runId,
    suites: suites.map((s) => ({
      boundaryId: s.boundaryId,
      phaseId: s.phaseId,
      subPhaseId: s.subPhaseId,
      producerArtifactKind: s.producerArtifactKind,
      description: s.description,
      missingProducer: missingProducers.includes(s.boundaryId),
      results: resultsBySuite.get(s.boundaryId) ?? [],
    })),
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function computeExitCode(
  resultsBySuite: Map<string, ContractResult[]>,
  failOn: CliArgs['failOn'],
): number {
  if (failOn === 'never') return 0;
  for (const arr of resultsBySuite.values()) {
    for (const r of arr) {
      if (r.passed) continue;
      if (failOn === 'blocking' && r.severity === 'blocking') return 1;
      if (failOn === 'advisory') return 1;
    }
  }
  return 0;
}

function main(): void {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n\n`);
    printUsage();
    process.exit(2);
  }

  let runId: string;
  let artifacts: DbArtifact[];
  try {
    ({ runId, artifacts } = loadArtifacts(args.db, args.runId));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(3);
  }

  if (artifacts.length === 0) {
    process.stderr.write(`warning: no artifact_produced records found for run ${runId}\n`);
  }

  const context = buildContext(runId, artifacts);
  const suites = selectSuites(args);
  const resultsBySuite = new Map<string, ContractResult[]>();
  const missingProducers: string[] = [];

  for (const suite of suites) {
    const producer = findProducerArtifact(suite, artifacts);
    if (producer === undefined) {
      missingProducers.push(suite.boundaryId);
      continue;
    }
    const results = runContractSuite(suite, producer, context);
    resultsBySuite.set(suite.boundaryId, results);
  }

  if (args.format === 'json') printJson(runId, suites, resultsBySuite, missingProducers);
  else printText(runId, suites, resultsBySuite, missingProducers);

  // groupByBoundary is exported by runner but unused at the CLI layer
  // yet; it'll be used when we add cross-boundary roll-ups in Stage 4+.
  void groupByBoundary;

  process.exit(computeExitCode(resultsBySuite, args.failOn));
}

main();
