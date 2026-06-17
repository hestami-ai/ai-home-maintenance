/**
 * Phase 9.0 — Scaffold Synthesis (Lever 2a).
 *
 * Materializes ONE canonical project configuration and a shared module
 * directory into the workspace BEFORE any executor leaf runs, so that
 * per-leaf code-generation tasks IMPORT shared modules and conform to a
 * single pinned convention (module system, language, test runner) instead
 * of reinventing dependencies divergently (the root cause of the
 * fragmentation observed in slice-125: two `encryptUrl` implementations,
 * ESM/sync vs CJS/async, 6 separate package.json files).
 *
 * What it pins / produces (deterministic, no LLM):
 *   - a single root `package.json` (+ `tsconfig.json` when TypeScript)
 *   - `${shared_dir}/models/*`   from Phase 5 `data_models`
 *   - `${shared_dir}/contracts/*` from Phase 3 `interface_contracts`
 *   - `${shared_dir}/index.ts`   barrel
 *   - a `scaffold_manifest` record: the resolved profile + the canonical /
 *     protected file list + a conventions string. This record is the SINGLE
 *     source of truth consumed by Lever 2b (import-don't-reinvent + write
 *     scope) and Lever 2c (Phase 10 divergent-duplicate detection) — no
 *     hardcoded paths live downstream.
 *
 * Profile resolution is by precedence (general across future intents):
 *   1. brownfield_detected — existing workspace package.json/tsconfig
 *   2. adr_override        — a Phase-4 architectural_decisions record that
 *                            carries a structured `project_profile`
 *   3. config_default      — config.scaffold.project_profile (greenfield)
 *
 * All writes are skip-if-exists, so the step is idempotent and resume-safe
 * and never clobbers brownfield code.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { PhaseContext } from '../orchestratorEngine';
import { getLogger } from '../../logging';
import {
  buildProjectLayoutContract,
  renderLayoutConventions,
  type ProjectLayoutContract,
} from './layoutContract';

// ── Types ───────────────────────────────────────────────────────────

export interface ProjectProfile {
  language: 'typescript' | 'javascript';
  module: 'esm' | 'commonjs';
  test_runner: 'vitest' | 'jest' | 'node';
  /** Workspace-relative directory owned exclusively by the scaffold step. */
  shared_dir: string;
  /** Where the profile came from (audit). */
  source: 'brownfield_detected' | 'adr_override' | 'config_default';
}

export interface ScaffoldManifest {
  kind: 'scaffold_manifest';
  profile: ProjectProfile;
  /** Workspace-relative files the scaffold owns (created or pre-existing). */
  canonical_files: string[];
  /**
   * Workspace-relative path prefixes leaves must NOT write to. Leaves that
   * write here are quarantined by the Lever 2b post-leaf guard.
   */
  protected_paths: string[];
  /** Human-readable conventions string injected into executor context. */
  conventions: string;
  /**
   * The deterministic project layout contract (component→dir map, import
   * aliases, test placement, allowed dirs/extensions). Authoritative source
   * of the generated codebase's structure.
   */
  project_layout_contract: ProjectLayoutContract;
  /**
   * Workspace-relative path of the Engineering Constitution copy (craft
   * best practices for the generated code). Set only when the configured
   * source document was found and copied; the scheduler references it in
   * every executor attempt as an ADVISORY standard.
   */
  engineering_constitution_path?: string;
}

interface DataModelEntity {
  name: string;
  fields: Array<{ name: string; type: string; constraints?: string }>;
  relationships?: string[];
}
interface DataModelsContent {
  models: Array<{ component_id: string; entities: DataModelEntity[] }>;
}
interface InterfaceContract {
  id: string;
  systems_involved?: string[];
  protocol?: string;
  data_format?: string;
  auth_mechanism?: string;
}
interface InterfaceContractsContent {
  contracts: InterfaceContract[];
}

/**
 * Copy the configured Engineering Constitution into the workspace as a
 * side-channel file every executor attempt can read (advisory craft standard;
 * spec/criteria/TECH-* win on conflict). Returns the workspace-relative path,
 * or undefined when no source is configured / found. Reusable across the
 * deterministic scaffold AND the recon/scaffolding-agent path so the
 * side-channel survives the author→enforce cutover. Always refreshed
 * (harness-owned, not brownfield code); warn-and-skip when missing.
 */
export function copyEngineeringConstitution(workspacePath: string, sourcePath: string | undefined): string | undefined {
  if (!sourcePath) return undefined;
  const srcAbs = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(process.cwd(), sourcePath);
  if (!fs.existsSync(srcAbs)) {
    getLogger().warn('workflow', 'Phase 9.0: engineering constitution source not found — executor prompts will omit it', {
      path: srcAbs,
    });
    return undefined;
  }
  const rel = '.janumicode/engineering-constitution.md';
  const destAbs = path.join(workspacePath, rel);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(srcAbs, destAbs);
  return rel;
}

// ── Profile resolution ──────────────────────────────────────────────

const ROOT_CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'vitest.config.ts',
  'jest.config.js',
];

function testCommand(runner: ProjectProfile['test_runner']): string {
  switch (runner) {
    case 'vitest': return 'vitest run';
    case 'jest': return 'jest';
    case 'node': return 'node --test';
  }
}

/**
 * Resolve the canonical project profile by precedence:
 * brownfield-detected > ADR override > config default.
 */
export function resolveProjectProfile(
  workspacePath: string,
  adrsContent: Record<string, unknown> | null,
  configProfile: Omit<ProjectProfile, 'source'>,
): ProjectProfile {
  // 1. Brownfield — adopt an existing root package.json/tsconfig.
  const pkgPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const hasTsconfig = fs.existsSync(path.join(workspacePath, 'tsconfig.json'));
      const testScript = ((pkg.scripts as Record<string, string> | undefined)?.test ?? '').toLowerCase();
      const devDeps = {
        ...(pkg.devDependencies as Record<string, string> | undefined),
        ...(pkg.dependencies as Record<string, string> | undefined),
      };
      const runner: ProjectProfile['test_runner'] =
        testScript.includes('vitest') || devDeps?.vitest ? 'vitest'
          : testScript.includes('jest') || devDeps?.jest ? 'jest'
            : testScript.includes('node --test') || testScript.includes('node:test') ? 'node'
              : configProfile.test_runner;
      // Node semantics: absent "type" field ⇒ CommonJS.
      return {
        language: hasTsconfig || devDeps?.typescript ? 'typescript' : 'javascript',
        module: pkg.type === 'module' ? 'esm' : 'commonjs',
        test_runner: runner,
        shared_dir: configProfile.shared_dir,
        source: 'brownfield_detected',
      };
    } catch {
      // Malformed package.json — fall through to ADR / default.
    }
  }

  // 2. ADR override — a Phase-4 decision carrying a structured profile.
  const adrProfile = extractAdrProjectProfile(adrsContent);
  if (adrProfile) {
    return {
      language: adrProfile.language ?? configProfile.language,
      module: adrProfile.module ?? configProfile.module,
      test_runner: adrProfile.test_runner ?? configProfile.test_runner,
      shared_dir: adrProfile.shared_dir ?? configProfile.shared_dir,
      source: 'adr_override',
    };
  }

  // 3. Config default (greenfield).
  return { ...configProfile, source: 'config_default' };
}

/** Look for a structured `project_profile` on any architectural decision. */
function extractAdrProjectProfile(
  adrsContent: Record<string, unknown> | null,
): Partial<Omit<ProjectProfile, 'source'>> | null {
  if (!adrsContent) return null;
  const direct = adrsContent.project_profile as Record<string, unknown> | undefined;
  if (direct && typeof direct === 'object') return direct as Partial<ProjectProfile>;
  const decisions = adrsContent.decisions ?? adrsContent.architectural_decisions;
  if (Array.isArray(decisions)) {
    for (const d of decisions as Array<Record<string, unknown>>) {
      const pp = d.project_profile ?? d.tech_stack;
      if (pp && typeof pp === 'object') return pp as Partial<ProjectProfile>;
    }
  }
  return null;
}

/**
 * Extract DECLARED runtime dependencies from the architecture artifacts —
 * generically. The tech stack is whatever the user's intent + decomposition
 * require (fastify/pg are particulars of one test scenario), so this never
 * name-guesses from prose (TECH-PGSQL-16 ≠ npm `pg`): it only honors
 * STRUCTURED `dependencies` / `runtime_dependencies` fields (string array
 * `"name"`/`"name@range"` or `{name: range}` map) wherever they appear —
 * top-level, on project_profile/tech_stack, or on individual decisions.
 * Empty result is normal today; the composition-root task remains the
 * backstop ("install anything the code imports that package.json lacks").
 */
export function extractDeclaredDependencies(
  adrsContent: Record<string, unknown> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const absorb = (raw: unknown): void => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item !== 'string' || !item.trim()) continue;
        const s = item.trim();
        const at = s.lastIndexOf('@');
        if (at > 0) out[s.slice(0, at)] = s.slice(at + 1) || '*';
        else out[s] = '*';
      }
    } else if (typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (k && typeof v === 'string' && v) out[k] = v;
      }
    }
  };
  if (!adrsContent) return out;
  const holders: Array<Record<string, unknown> | undefined> = [
    adrsContent,
    adrsContent.project_profile as Record<string, unknown> | undefined,
    adrsContent.tech_stack as Record<string, unknown> | undefined,
  ];
  const decisions = adrsContent.decisions ?? adrsContent.architectural_decisions;
  if (Array.isArray(decisions)) {
    for (const d of decisions as Array<Record<string, unknown>>) {
      holders.push(d,
        d.project_profile as Record<string, unknown> | undefined,
        d.tech_stack as Record<string, unknown> | undefined);
    }
  }
  for (const h of holders) {
    if (!h) continue;
    absorb(h.dependencies);
    absorb(h.runtime_dependencies);
  }
  return out;
}

// ── Code generation helpers ─────────────────────────────────────────

function pascalCase(raw: string): string {
  const parts = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/);
  if (parts.length === 0) return 'Unnamed';
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function slugify(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'app';
}

/** Map an LLM-emitted free-form type to a permissive TS type (general). */
function toTsType(raw: string | undefined): string {
  const t = (raw ?? '').toLowerCase();
  if (!t) return 'unknown';
  if (/\b(int|integer|number|float|double|decimal|numeric|long|bigint)\b/.test(t)) return 'number';
  if (/\b(bool|boolean)\b/.test(t)) return 'boolean';
  if (/\b(date|datetime|timestamp|time)\b/.test(t)) return 'string';
  if (/\b(array|list|\[\])\b/.test(t)) return 'unknown[]';
  if (/\b(json|object|map|record)\b/.test(t)) return 'Record<string, unknown>';
  if (/\b(uuid|guid|string|text|varchar|char|url|email)\b/.test(t)) return 'string';
  return 'string';
}

/**
 * A field is nullable when its type/constraints say so AND nothing marks it
 * required/not-null/primary-key. Slice-145 bug: `deleted_at` carried `nullable`
 * in its constraints but rendered as `string` (non-null), so every test fixture
 * passing `null` failed strict-mode tsc. The negation guard prevents a stray
 * "null" inside "not null" from flipping a required field.
 */
function isNullableField(f: { type?: string; constraints?: string }): boolean {
  const hay = `${f.type ?? ''} ${f.constraints ?? ''}`.toLowerCase();
  if (/\bnot[\s_-]?null\b|\bnot[\s_-]?nullable\b|\brequired\b|\bprimary[\s_-]?key\b/.test(hay)) return false;
  return /\bnullable\b|\boptional\b/.test(hay);
}

function renderEntityModule(entity: DataModelEntity, componentId: string): string {
  const name = pascalCase(entity.name);
  const lines: string[] = [];
  lines.push(`// Generated shared data model — ${entity.name} (component: ${componentId}).`);
  lines.push(`// Canonical type. Import from the shared barrel; do NOT redefine.`);
  lines.push(`export interface ${name} {`);
  for (const f of entity.fields ?? []) {
    const tsType = toTsType(f.type);
    const fieldType = isNullableField(f) ? `${tsType} | null` : tsType;
    const comment = [f.type, f.constraints].filter(Boolean).join(' — ');
    lines.push(`  ${f.name}: ${fieldType};${comment ? ` // ${comment}` : ''}`);
  }
  lines.push(`}`);
  if (entity.relationships?.length) {
    lines.push('');
    lines.push(`// Relationships: ${entity.relationships.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderContractModule(c: InterfaceContract): string {
  const name = pascalCase(c.id);
  const lines: string[] = [];
  lines.push(`// Generated shared interface contract — ${c.id}.`);
  lines.push(`// Protocol: ${c.protocol ?? 'n/a'} | Format: ${c.data_format ?? 'n/a'}` +
    `${c.auth_mechanism ? ` | Auth: ${c.auth_mechanism}` : ''}`);
  if (c.systems_involved?.length) lines.push(`// Systems: ${c.systems_involved.join(', ')}`);
  lines.push(`// Canonical contract metadata. Import from the shared barrel; do NOT redefine.`);
  lines.push(`export const ${name}Contract = {`);
  lines.push(`  id: ${JSON.stringify(c.id)},`);
  lines.push(`  protocol: ${JSON.stringify(c.protocol ?? '')},`);
  lines.push(`  dataFormat: ${JSON.stringify(c.data_format ?? '')},`);
  lines.push(`  systemsInvolved: ${JSON.stringify(c.systems_involved ?? [])},`);
  lines.push(`} as const;`);
  lines.push('');
  return lines.join('\n');
}

function renderRootPackageJson(
  name: string,
  profile: ProjectProfile,
  runtimeDeps: Record<string, string> = {},
): string {
  const pkg: Record<string, unknown> = {
    name,
    version: '0.1.0',
    private: true,
    scripts: { test: testCommand(profile.test_runner) },
  };
  if (profile.module === 'esm') pkg.type = 'module';
  // Declared tech-stack deps (artifact-driven, generic) — preinstalled so
  // leaves code against the real framework instead of writing type shims.
  if (Object.keys(runtimeDeps).length) {
    pkg.dependencies = Object.fromEntries(Object.entries(runtimeDeps).sort(([a], [b]) => a.localeCompare(b)));
  }
  const devDeps: Record<string, string> = {};
  if (profile.language === 'typescript') devDeps.typescript = '^5.4.0';
  if (profile.test_runner === 'vitest') devDeps.vitest = '^1.6.0';
  if (profile.test_runner === 'jest') devDeps.jest = '^29.7.0';
  if (Object.keys(devDeps).length) pkg.devDependencies = devDeps;
  return JSON.stringify(pkg, null, 2) + '\n';
}

function renderTsconfig(profile: ProjectProfile, contract: ProjectLayoutContract): string {
  // Path aliases are the ONE canonical import form. Without them, leaves guess
  // (relative / bare / src/shared) and most imports fail to resolve.
  const paths: Record<string, string[]> = {};
  for (const a of contract.import_aliases) {
    paths[a.alias] = [a.target];
  }
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: profile.module === 'esm' ? 'ES2022' : 'CommonJS',
      moduleResolution: profile.module === 'esm' ? 'Bundler' : 'Node',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      baseUrl: '.',
      paths,
      outDir: 'dist',
    },
    include: ['src/**/*.ts'],
  }, null, 2) + '\n';
}

// ── Materialization ─────────────────────────────────────────────────

interface MaterializeResult {
  created: string[];   // workspace-relative
  preExisting: string[];
}

function writeIfAbsent(
  workspacePath: string,
  relPath: string,
  content: string,
  result: MaterializeResult,
): void {
  const abs = path.join(workspacePath, relPath);
  if (fs.existsSync(abs)) {
    result.preExisting.push(relPath);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  result.created.push(relPath);
}

function ext(profile: ProjectProfile): string {
  return profile.language === 'typescript' ? 'ts' : 'js';
}

/**
 * Materialize the canonical scaffold. Skip-if-exists throughout: never
 * overwrites brownfield code, idempotent on resume.
 */
export function materializeScaffold(
  workspacePath: string,
  projectName: string,
  profile: ProjectProfile,
  dataModels: DataModelsContent | null,
  contracts: InterfaceContractsContent | null,
  layoutContract: ProjectLayoutContract,
  runtimeDeps: Record<string, string> = {},
): MaterializeResult {
  const result: MaterializeResult = { created: [], preExisting: [] };
  const e = ext(profile);
  const shared = profile.shared_dir.replace(/\\/g, '/').replace(/\/+$/, '');

  // Root project config. (Brownfield package.json wins — skip-if-exists —
  // so declared deps only land on greenfield scaffolds.)
  writeIfAbsent(workspacePath, 'package.json', renderRootPackageJson(projectName, profile, runtimeDeps), result);
  if (profile.language === 'typescript') {
    writeIfAbsent(workspacePath, 'tsconfig.json', renderTsconfig(profile, layoutContract), result);
  }

  // Shared data models — one file per entity, deduped by entity name.
  const barrelExports: string[] = [];
  const seenEntities = new Set<string>();
  for (const model of dataModels?.models ?? []) {
    for (const entity of model.entities ?? []) {
      const key = pascalCase(entity.name);
      if (seenEntities.has(key)) continue;
      seenEntities.add(key);
      const rel = `${shared}/models/${key}.${e}`;
      writeIfAbsent(workspacePath, rel, renderEntityModule(entity, model.component_id), result);
      barrelExports.push(`./models/${key}${profile.language === 'typescript' ? '' : '.js'}`);
    }
  }

  // Shared interface contracts — one file per contract id.
  const seenContracts = new Set<string>();
  for (const c of contracts?.contracts ?? []) {
    if (!c.id || seenContracts.has(c.id)) continue;
    seenContracts.add(c.id);
    const key = pascalCase(c.id);
    const rel = `${shared}/contracts/${key}.${e}`;
    writeIfAbsent(workspacePath, rel, renderContractModule(c), result);
    barrelExports.push(`./contracts/${key}${profile.language === 'typescript' ? '' : '.js'}`);
  }

  // Barrel — re-export everything so leaves import from one place.
  if (barrelExports.length) {
    const barrel = barrelExports.map(p => `export * from '${p}';`).join('\n') + '\n';
    writeIfAbsent(workspacePath, `${shared}/index.${e}`, barrel, result);
  }

  return result;
}

// ── Dependency install ──────────────────────────────────────────────

/**
 * Run `npm install` once at the workspace root so the declared test runner
 * resolves for per-leaf `npm test`. No-op when node_modules already exists.
 * Non-fatal: on failure the run continues (tests may fail, but execution is
 * not blocked). Bounded by a wall-clock timeout.
 */
function installDependencies(workspacePath: string, workflowRunId: string): void {
  if (fs.existsSync(path.join(workspacePath, 'node_modules'))) {
    getLogger().info('workflow', 'Phase 9.0a: node_modules present — skipping npm install', {
      workflow_run_id: workflowRunId,
    });
    return;
  }
  const started = Date.now();
  try {
    const res = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: workspacePath,
      shell: process.platform === 'win32',
      windowsHide: true,
      timeout: 300_000,
      encoding: 'utf-8',
    });
    if (res.status === 0) {
      getLogger().info('workflow', 'Phase 9.0a: npm install complete', {
        workflow_run_id: workflowRunId, duration_ms: Date.now() - started,
      });
    } else {
      getLogger().warn('workflow', 'Phase 9.0a: npm install failed (non-fatal — tests may not run)', {
        workflow_run_id: workflowRunId, status: res.status,
        stderr: (res.stderr || '').slice(0, 500),
      });
    }
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0a: npm install threw (non-fatal)', {
      workflow_run_id: workflowRunId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Orchestration ───────────────────────────────────────────────────

/**
 * Run Phase 9.0 scaffold synthesis. Resolves the project profile,
 * materializes the canonical scaffold from interface_contracts +
 * data_models, and writes a `scaffold_manifest` artifact. Returns the
 * manifest (also persisted) so the caller can hand it to the scheduler.
 */
export function runScaffoldSynthesis(ctx: PhaseContext): ScaffoldManifest | null {
  const { workflowRun, engine } = ctx;
  const cfg = engine.configManager.get();
  const scaffoldCfg = (cfg as unknown as {
    scaffold?: {
      enabled?: boolean;
      install_dependencies?: boolean;
      test_placement?: 'colocated' | 'subdir';
      engineering_constitution_path?: string;
      project_profile?: Omit<ProjectProfile, 'source'>;
    };
  }).scaffold;

  if (scaffoldCfg?.enabled === false) {
    getLogger().info('workflow', 'Phase 9.0 scaffold_synthesis skipped (disabled by config)', {
      workflow_run_id: workflowRun.id,
    });
    return null;
  }

  const configProfile: Omit<ProjectProfile, 'source'> = scaffoldCfg?.project_profile ?? {
    language: 'typescript', module: 'esm', test_runner: 'vitest', shared_dir: 'src/shared',
  };

  const workspacePath = engine.workspacePath;

  // Resolve profile (precedence: brownfield > ADR > default).
  const adrsRecord = engine.writer.getArtifactByKind(workflowRun.id, 'architectural_decisions');
  const profile = resolveProjectProfile(
    workspacePath,
    (adrsRecord?.content as Record<string, unknown>) ?? null,
    configProfile,
  );

  // Gather the source artifacts.
  const dmRecord = engine.writer.getArtifactByKind(workflowRun.id, 'data_models');
  const icRecord = engine.writer.getArtifactByKind(workflowRun.id, 'interface_contracts');
  const dataModels = (dmRecord?.content as unknown as DataModelsContent) ?? null;
  const contracts = (icRecord?.content as unknown as InterfaceContractsContent) ?? null;

  // Project name from intent.
  const intentRecord = engine.writer.getArtifactByKind(workflowRun.id, 'intent_statement');
  const intentName = ((intentRecord?.content as Record<string, unknown>)?.product_concept as
    Record<string, unknown> | undefined)?.name as string | undefined;
  const projectName = slugify(intentName ?? 'app');

  // Build the deterministic project layout contract from the functional
  // component model (always present by Phase 9). This is the authoritative
  // structure the executor leaves must conform to.
  const cmRecord = engine.writer.getArtifactByKind(workflowRun.id, 'component_model');
  const components = ((cmRecord?.content as Record<string, unknown>)?.components as Array<{ id?: string }>) ?? [];
  const testPlacement = (scaffoldCfg?.test_placement ?? 'colocated') as 'colocated' | 'subdir';
  const layoutContract = buildProjectLayoutContract(components, profile, testPlacement);

  // Declared tech-stack runtime deps (generic, artifact-driven — never
  // name-guessed from prose). Empty today unless Phase-4 artifacts carry
  // structured dependency fields; the composition root is the backstop.
  const runtimeDeps = extractDeclaredDependencies(
    (adrsRecord?.content as Record<string, unknown>) ?? null,
  );

  // Materialize.
  let materialize: MaterializeResult;
  try {
    materialize = materializeScaffold(workspacePath, projectName, profile, dataModels, contracts, layoutContract, runtimeDeps);
  } catch (err) {
    getLogger().warn('workflow', 'Phase 9.0 scaffold_synthesis: materialization failed', {
      workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Install the declared test runner ONCE so per-leaf `npm test` resolves
  // (otherwise every leaf quarantines on "vitest: command not found").
  // Skip when node_modules already exists; non-fatal on failure.
  if (scaffoldCfg?.install_dependencies !== false && fs.existsSync(path.join(workspacePath, 'package.json'))) {
    installDependencies(workspacePath, workflowRun.id);
  }

  const shared = profile.shared_dir.replace(/\\/g, '/').replace(/\/+$/, '');
  const canonicalFiles = [...materialize.created, ...materialize.preExisting];
  const protectedPaths = [shared + '/', ...ROOT_CONFIG_FILES];

  // Conventions text is now DERIVED from the contract (states the @shared/
  // import form + co-located test rule), not advisory prose.
  const conventions = renderLayoutConventions(layoutContract, profile);

  // Engineering Constitution — copy the configured craft-standards doc into
  // the workspace (advisory side-channel; see copyEngineeringConstitution).
  const constitutionRel = copyEngineeringConstitution(workspacePath, scaffoldCfg?.engineering_constitution_path);

  const manifest: ScaffoldManifest = {
    kind: 'scaffold_manifest',
    profile,
    canonical_files: canonicalFiles,
    protected_paths: protectedPaths,
    conventions,
    project_layout_contract: layoutContract,
    engineering_constitution_path: constitutionRel,
  };

  const record = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '9',
    sub_phase_id: 'scaffold_synthesis',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [dmRecord?.id, icRecord?.id].filter((x): x is string => typeof x === 'string'),
    content: manifest as unknown as Record<string, unknown>,
  });
  engine.ingestionPipeline.ingest(record);

  getLogger().info('workflow', 'Phase 9.0 scaffold_synthesis complete', {
    workflow_run_id: workflowRun.id,
    profile_source: profile.source,
    language: profile.language,
    module: profile.module,
    test_runner: profile.test_runner,
    files_created: materialize.created.length,
    files_pre_existing: materialize.preExisting.length,
  });

  return manifest;
}
