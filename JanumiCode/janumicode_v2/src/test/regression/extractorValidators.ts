/**
 * Validator fixture extractor (Tier B coverage).
 *
 * Walks a thin-slice DB for `agent_invocation` records produced by the
 * `harness` agent role and pairs each with its corresponding
 * `agent_output`. Each unique validator (identified by the invocation
 * `label` of `harness:<validator_id>`) yields one fixture.
 *
 * Validator templates live under `prompts/review/<cluster>/<id>.system.md`
 * and have `agent_role: harness`, `sub_phase: <validator_id>` in their
 * frontmatter. The TemplateLoader discovers them recursively.
 *
 * Variable recovery for validators is much simpler than for producers:
 * most validators have empty `required_variables`. When they do declare
 * variables (e.g. spec_boundary_respect_bloom needs
 * DISCOVERY_DECISIONS + TECHNICAL_CONSTRAINTS), the rendered system
 * prompt sits in `agent_invocation.content.system`, and we recover
 * variables from there using the same back-substitution algorithm as
 * the producer extractor.
 *
 * Assertions are template-driven from a shared shape: every validator
 * emits `{validator, passed, findings[], overallAssessment}`. We add
 * Bucket-A-specific assertions (target_field / target_identifier) when
 * the validator declares them and the baseline includes findings that
 * carry them.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import { FixtureSchema, type Fixture, type AssertionBlock, type T3InvariantAssertion } from './fixtureSchema.js';
import type { PromptTemplate, TemplateLoader } from '../../lib/orchestrator/templateLoader.js';
import { getTemplateLoader } from './runner.js';
import { FIXTURE_DIR } from './loadFixtures.js';
import { recoverVariables } from './extractor.js';

export interface ValidatorExtractOptions {
  dbPath: string;
  outputDir?: string;
  /** Specific validator_ids to extract. If 'all' or omitted: every validator that fired. */
  validators?: string[] | 'all';
  workflowRunId?: string;
  sampleSlug?: string;
  overwrite?: boolean;
}

export interface ValidatorExtractResult {
  written: string[];
  skipped: { reason: string; validator_id: string }[];
}

interface InvocationRow {
  id: string;
  content: string;
}
interface OutputRow {
  id: string;
  content: string;
}

function pickWorkflowRunId(db: Database.Database, requested?: string): string {
  if (requested) return requested;
  const row = db.prepare(
    `SELECT id FROM workflow_runs ORDER BY rowid DESC LIMIT 1`,
  ).get() as { id: string } | undefined;
  if (!row) throw new Error('No workflow_runs found in DB');
  return row.id;
}

function listFiredValidators(db: Database.Database, workflowRunId: string): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT json_extract(content, '$.label') AS label
     FROM governed_stream
     WHERE record_type = 'agent_invocation'
       AND produced_by_agent_role = 'harness'
       AND workflow_run_id = ?`,
  ).all(workflowRunId) as { label: string | null }[];
  const validators: string[] = [];
  for (const r of rows) {
    if (!r.label || !r.label.startsWith('harness:')) continue;
    validators.push(r.label.slice('harness:'.length));
  }
  return validators;
}

function findValidatorInvocations(
  db: Database.Database,
  workflowRunId: string,
  validatorId: string,
): InvocationRow[] {
  return db.prepare(
    `SELECT id, content FROM governed_stream
     WHERE record_type = 'agent_invocation'
       AND produced_by_agent_role = 'harness'
       AND workflow_run_id = ?
       AND json_extract(content, '$.label') = ?
     ORDER BY produced_at ASC`,
  ).all(workflowRunId, `harness:${validatorId}`) as InvocationRow[];
}

function findOutput(db: Database.Database, invocationId: string): OutputRow | null {
  const rows = db.prepare(
    `SELECT id, content FROM governed_stream
     WHERE record_type = 'agent_output'
       AND derived_from_record_ids LIKE ?
     ORDER BY produced_at ASC`,
  ).all(`%${invocationId}%`) as OutputRow[];
  return rows[0] ?? null;
}

function tryParse(text: string): unknown {
  try {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

interface ChosenPair {
  invocation: InvocationRow;
  invocationContent: any;
  output: OutputRow;
  outputContent: any;
  parsed: unknown;
}

/**
 * Choose a (invocation, output) pair for the validator. Preference:
 *   1. Output parses as JSON AND has non-empty `findings[]` (richer baseline).
 *   2. Output parses as JSON (any findings count).
 *   3. None — caller will skip.
 */
function chooseRepresentativePair(
  db: Database.Database,
  invocations: InvocationRow[],
): ChosenPair | null {
  let firstParsed: ChosenPair | null = null;
  for (const inv of invocations) {
    const output = findOutput(db, inv.id);
    if (!output) continue;
    let invContent: any;
    let outContent: any;
    try {
      invContent = JSON.parse(inv.content);
      outContent = JSON.parse(output.content);
    } catch {
      continue;
    }
    const text: string = outContent.text ?? '';
    const parsed = tryParse(text);
    if (parsed === null) continue;
    const pair: ChosenPair = { invocation: inv, invocationContent: invContent, output, outputContent: outContent, parsed };
    const findings = (parsed as any)?.findings;
    if (Array.isArray(findings) && findings.length > 0) {
      return pair;
    }
    if (firstParsed === null) firstParsed = pair;
  }
  return firstParsed;
}

/** Read the validator template body to determine Bucket A vs B. */
function determineBucket(templateBody: string): 'A' | 'B' {
  // Bucket B: advisory-only (no target_field/target_identifier).
  // Bucket A: machine-actionable (target_field/target_identifier emitted).
  if (templateBody.includes('[TARGET FIELDS')) return 'A';
  if (templateBody.includes('Do NOT emit `target_field`')) return 'B';
  if (templateBody.includes('emits ADVISORY findings only')) return 'B';
  // Default: inspect output contract for `target_field` key.
  if (/"target_field"\s*:/.test(templateBody)) return 'A';
  return 'B';
}

interface BaselineShape {
  hasFindings: boolean;
  allHaveSeverity: boolean;
  allHaveSummary: boolean;
  allHaveLocation: boolean;
  allHaveRecommendation: boolean;
  allHaveDetail: boolean;
  /** Findings carrying a `type` (or `finding_type`) field — non-empty. */
  allHaveType: boolean;
  /** Findings carrying `target_field` AND `target_identifier`. */
  allHaveTargetFields: boolean;
  severities: Set<string>;
  hasOverallAssessment: boolean;
  /** Baseline contains `passed` as a boolean. */
  hasPassed: boolean;
  /** Baseline contains a non-empty `validator` string self-identifier. */
  validatorSelfId: string | null;
}

function inspectBaseline(parsed: unknown): BaselineShape {
  const root = (parsed ?? {}) as Record<string, unknown>;
  const findings = Array.isArray(root.findings) ? (root.findings as Array<Record<string, unknown>>) : [];
  const allHave = (key: string): boolean =>
    findings.length > 0 && findings.every((f) => typeof f[key] === 'string' && (f[key] as string).length > 0);
  const allHaveType =
    findings.length > 0 &&
    findings.every(
      (f) => (typeof f.type === 'string' && f.type.length > 0) || (typeof f.finding_type === 'string' && (f.finding_type as string).length > 0),
    );
  const allHaveTargetFields =
    findings.length > 0 &&
    findings.every(
      (f) =>
        typeof f.target_field === 'string' &&
        (f.target_field as string).length > 0 &&
        typeof f.target_identifier === 'string' &&
        (f.target_identifier as string).length > 0,
    );
  const severities = new Set<string>();
  for (const f of findings) {
    if (typeof f.severity === 'string') severities.add(f.severity);
  }
  return {
    hasFindings: findings.length > 0,
    allHaveSeverity: allHave('severity'),
    allHaveSummary: allHave('summary'),
    allHaveLocation: allHave('location'),
    allHaveRecommendation: allHave('recommendation'),
    allHaveDetail: allHave('detail'),
    allHaveType,
    allHaveTargetFields,
    severities,
    hasOverallAssessment: typeof root.overallAssessment === 'string',
    hasPassed: typeof root.passed === 'boolean',
    validatorSelfId: typeof root.validator === 'string' && (root.validator as string).length > 0
      ? (root.validator as string)
      : null,
  };
}

/**
 * Populate the per-finding entries of the T1 shape map (mutates in place).
 * Extracted from buildValidatorAssertions to keep that function's cognitive
 * complexity under threshold; behavior is identical.
 */
function applyFindingsShapeEntries(
  shapeMap: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'>,
  bucket: 'A' | 'B',
  shape: BaselineShape,
): void {
  if (shape.allHaveSeverity) shapeMap['findings[].severity'] = 'string';
  if (shape.allHaveSummary) shapeMap['findings[].summary'] = 'string';
  if (shape.allHaveLocation) shapeMap['findings[].location'] = 'string';
  if (shape.allHaveDetail) shapeMap['findings[].detail'] = 'string';
  if (shape.allHaveRecommendation) shapeMap['findings[].recommendation'] = 'string';
  if (bucket === 'A' && shape.allHaveTargetFields) {
    shapeMap['findings[].target_field'] = 'string';
    shapeMap['findings[].target_identifier'] = 'string';
  }
}

function buildValidatorAssertions(
  validatorId: string,
  bucket: 'A' | 'B',
  shape: BaselineShape,
): AssertionBlock {
  // ── T1: JSON shape ──
  const shapeMap: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'> = {
    'validator': 'string',
    'findings': 'array',
  };
  if (shape.hasPassed) shapeMap['passed'] = 'boolean';
  if (shape.hasOverallAssessment) shapeMap['overallAssessment'] = 'string';
  if (shape.hasFindings) {
    applyFindingsShapeEntries(shapeMap, bucket, shape);
  }

  // ── T3: invariants ──
  const t3: T3InvariantAssertion[] = [];
  // Pin to the baseline's actual `validator` self-id string when present
  // (some validator OUTPUT CONTRACTs declare a shorter self-id than the
  // sub_phase / file id — e.g. measurement_adequacy_validator emits
  // "validator": "measurement_adequacy"). Fall back to the validator id.
  const selfId = shape.validatorSelfId ?? validatorId;
  const idPattern = `^${selfId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  t3.push({
    name: `validator-id-self-identifies-as-${selfId}`,
    kind: 'required_value_pattern',
    path: 'validator',
    pattern: idPattern,
    rationale: 'The validator must self-identify with the OUTPUT CONTRACT id.',
  });
  // Severity enum: enum_subset is safe even when findings array is empty.
  t3.push({
    name: 'severity-in-allowed-enum',
    kind: 'enum_subset',
    path: 'findings[].severity',
    allowed: ['HIGH', 'MEDIUM', 'LOW'],
  });

  return {
    require_json_parse: true,
    t1_schema: {
      kind: 'json-shape',
      shape: shapeMap,
    },
    t2_id_preservation: [],
    t3_invariants: t3,
  };
}

// ── Per-validator processing ─────────────────────────────────────────

/** Outcome of processing a single validator: a written fixture or a skip. */
type ProcessResult =
  | { kind: 'written'; path: string }
  | { kind: 'skipped'; reason: string };

/** Parameters threaded through the per-validator processing helpers. */
interface ProcessContext {
  db: Database.Database;
  loader: TemplateLoader;
  workflowRunId: string;
  validatorId: string;
  opts: ValidatorExtractOptions;
  outDir: string;
  sampleSlug: string;
}

/**
 * Recover the template variables for a validator. Most validators declare
 * none; when they do, we back-substitute from the rendered system prompt and
 * default any that couldn't be recovered. Behavior identical to the inline
 * version previously in extractValidators.
 */
function recoverValidatorVariables(tpl: PromptTemplate, pair: ChosenPair): Record<string, string> {
  const renderedSystem: string = pair.invocationContent.system ?? '';
  let vars: Record<string, string> = {};
  if (tpl.metadata.required_variables.length > 0 && renderedSystem.length > 0) {
    const rec = recoverVariables(tpl.body, renderedSystem);
    if ('vars' in rec) {
      vars = rec.vars;
    }
  }
  // Default any declared required variables that weren't recovered.
  for (const req of tpl.metadata.required_variables) {
    if (!(req in vars)) vars[req] = '';
  }
  return vars;
}

/** Assemble the Fixture record for a validator (pure object construction). */
function buildValidatorFixture(args: {
  validatorId: string;
  sampleSlug: string;
  workflowRunId: string;
  dbPath: string;
  bucket: 'A' | 'B';
  baselineShape: BaselineShape;
  vars: Record<string, string>;
  pair: ChosenPair;
  assertions: AssertionBlock;
}): Fixture {
  const { validatorId, sampleSlug, workflowRunId, dbPath, bucket, baselineShape, vars, pair, assertions } = args;
  return {
    fixture_id: `validator__${validatorId}__${sampleSlug}`,
    description: `Validator fixture for ${validatorId} (Bucket ${bucket}): pins the harness output contract — validator id self-identification, severity enum, finding shape from baseline (${baselineShape.hasFindings ? 'with findings' : 'no findings'}).`,
    extracted_from_run: workflowRunId,
    extracted_from_db: dbPath.replace(/\\/g, '/'),
    extracted_at: new Date().toISOString(),
    template_ref: {
      agent_role: 'harness',
      sub_phase: validatorId,
    },
    invocation_params: {
      provider: pair.invocationContent.provider ?? 'ollama',
      model: pair.invocationContent.model ?? 'qwen3.5:9b',
      temperature: pair.invocationContent.temperature ?? 0.4,
      response_format: pair.invocationContent.response_format ?? 'json',
    },
    template_variables: vars,
    user_message: pair.invocationContent.prompt ?? '',
    baseline: {
      response_text: pair.outputContent.text ?? '',
      parsed_json: pair.parsed,
      duration_ms: pair.outputContent.duration_ms ?? 0,
      thinking: pair.outputContent.thinking ?? undefined,
    },
    assertions,
  };
}

/**
 * Process a single validator: resolve template + invocation/output pair,
 * build + validate the fixture, and write it. Returns a skip result (instead
 * of pushing) so the caller aggregates. Behavior identical to the original
 * inline loop body; unexpected errors are caught by runOneValidator.
 */
function processValidator(ctx: ProcessContext): ProcessResult {
  const { db, loader, workflowRunId, validatorId, opts, outDir, sampleSlug } = ctx;

  const tpl = loader.findTemplate('harness', validatorId);
  if (!tpl) {
    return { kind: 'skipped', reason: `no template found at agent_role=harness sub_phase=${validatorId}` };
  }
  const invocations = findValidatorInvocations(db, workflowRunId, validatorId);
  if (invocations.length === 0) {
    return { kind: 'skipped', reason: `no harness agent_invocation in run ${workflowRunId} with label harness:${validatorId}` };
  }
  const pair = chooseRepresentativePair(db, invocations);
  if (!pair) {
    return { kind: 'skipped', reason: `no invocation paired with a JSON-parseable agent_output (parsed_json null in all candidates)` };
  }

  const vars = recoverValidatorVariables(tpl, pair);
  const bucket = determineBucket(tpl.body);
  const baselineShape = inspectBaseline(pair.parsed);
  const assertions = buildValidatorAssertions(validatorId, bucket, baselineShape);

  const fixture = buildValidatorFixture({
    validatorId,
    sampleSlug,
    workflowRunId,
    dbPath: opts.dbPath,
    bucket,
    baselineShape,
    vars,
    pair,
    assertions,
  });

  const validated = FixtureSchema.safeParse(fixture);
  if (!validated.success) {
    const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { kind: 'skipped', reason: `fixture validation failed: ${issues}` };
  }

  const outPath = join(outDir, `${fixture.fixture_id}.fixture.json`);
  if (existsSync(outPath) && !opts.overwrite) {
    return { kind: 'skipped', reason: `fixture file already exists at ${outPath} (use --overwrite)` };
  }
  writeFileSync(outPath, JSON.stringify(validated.data, null, 2) + '\n', 'utf-8');
  return { kind: 'written', path: outPath };
}

/** processValidator wrapped so any unexpected error becomes a skip result. */
function runOneValidator(ctx: ProcessContext): ProcessResult {
  try {
    return processValidator(ctx);
  } catch (err) {
    return { kind: 'skipped', reason: `unexpected error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Main extract ────────────────────────────────────────────────────

export async function extractValidators(opts: ValidatorExtractOptions): Promise<ValidatorExtractResult> {
  const outDir = opts.outputDir ?? FIXTURE_DIR;
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const sampleSlug = opts.sampleSlug ?? 'tinyurl-001';

  const db = new Database(opts.dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');

  // try/finally so the readonly DB handle is ALWAYS released — even when
  // pickWorkflowRunId throws ("No workflow_runs found") before the happy-path
  // close. A leaked handle blocks temp-dir cleanup on Windows (afterAll rmSync
  // → EPERM), and leaks a file descriptor in production too.
  try {
    const workflowRunId = pickWorkflowRunId(db, opts.workflowRunId);
    const loader = getTemplateLoader();

    let targets: string[];
    if (!opts.validators || opts.validators === 'all') {
      targets = listFiredValidators(db, workflowRunId);
    } else {
      targets = opts.validators;
    }
    // De-duplicate.
    targets = Array.from(new Set(targets));

    const written: string[] = [];
    const skipped: { reason: string; validator_id: string }[] = [];

    for (const validatorId of targets) {
      const result = runOneValidator({ db, loader, workflowRunId, validatorId, opts, outDir, sampleSlug });
      if (result.kind === 'written') {
        written.push(result.path);
      } else {
        skipped.push({ reason: result.reason, validator_id: validatorId });
      }
    }

    return { written, skipped };
  } finally {
    db.close();
  }
}
