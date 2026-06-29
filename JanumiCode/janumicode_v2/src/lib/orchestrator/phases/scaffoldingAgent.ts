/**
 * Phase 9.0 — Scaffolding Agent (Stage 1+2 inc.2, the "Replace" authoring).
 *
 * Under the agreed authorship model the AGENT authors all scaffolding from the
 * recon plan; the kernel only ENFORCES. This step launches one executor session
 * with a precise SKELETON mandate (NOT feature work): per area, author the
 * dependency manifest + language/build config, the canonical shared modules
 * (from the data models + interface contracts), the directory layout, and the
 * import aliases the recon plan specifies.
 *
 * Safety: a missing dependency manifest after the agent runs is a foundational
 * failure (every downstream leaf would fail to resolve imports), worse than the
 * run-to-run variance the model accepts. So the caller keeps the deterministic
 * materializer as a CATASTROPHIC SAFETY NET (not a hybrid fast-path): if the
 * agent produced no primary manifest, fall back to it. `producedPrimaryManifest`
 * reports that.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../../logging';
import type { PhaseContext } from '../orchestratorEngine';
import type { ExecutorAgent } from '../../agents/executorAgent';
import type { Phase9ReconPlan } from './phase9Recon';
import { canonicalComponentDir } from './layoutContract';

export interface ScaffoldingAgentResult {
  /** True when every area's primary dependency manifest exists on disk after. */
  producedPrimaryManifest: boolean;
  invocationId: string | null;
  /** Per-area manifest existence (audit). */
  manifestsPresent: Record<string, boolean>;
}

export async function runScaffoldingAgentSubPhase(
  ctx: PhaseContext,
  plan: Phase9ReconPlan,
  executorAgent: ExecutorAgent,
): Promise<ScaffoldingAgentResult> {
  const { workflowRun, engine } = ctx;
  // Project root: the scaffolding agent's cwd + where manifests are checked.
  const workspacePath = engine.projectRoot;
  const logger = getLogger();

  const dataModels = gatherDataModels(engine, workflowRun.id);
  const contracts = gatherContracts(engine, workflowRun.id);
  // Canonical component→dir map (= where impl tasks write + Phase 10 enforces).
  // Fed into every area's scaffold prompt so the agent never invents a divergent
  // per-component layout. STACK-AWARE: the per-component dir separator follows the
  // resolved stack (underscore for python/rust/go/java, hyphen for node) so the
  // scaffold agent creates the SAME dirs the executor write-scope resolves to —
  // otherwise the scaffold mints `src/link-management` (hyphen) while the executor
  // writes `src/link_management` (underscore), producing duplicate dirs (slice-156).
  // The stack is known at Phase 9 (recon); areas[0].stack is the resolved per-area
  // stack (applyForcedStack rewrites it for a forced sweep).
  const componentDirs = gatherComponentDirs(engine, workflowRun.id, plan.areas[0]?.stack);

  // ONE session per area — a polyglot workspace must not cram N stacks into a
  // single agent context; each area's session sees only its own stack + the
  // shared types it exposes. (Single-area greenfield ⇒ exactly one session.)
  const invocationIds: string[] = [];
  for (const area of plan.areas) {
    const task = {
      id: `task-scaffolding-${area.area_id}`,
      taskType: 'standard' as const,
      componentId: 'scaffolding',
      componentResponsibility: `Author the ${area.area_id} (${area.stack}) skeleton: manifest, config, canonical shared modules, layout.`,
      description:
        `PROJECT SCAFFOLDING for area "${area.area_id}" (stack ${area.stack}). Author ONLY the skeleton the implementation `
        + 'tasks will build on — no feature logic. (1) create the dependency manifest with the dependencies the stack needs and '
        + 'a runnable test script; (2) create the language/build configuration; (3) create the canonical shared modules this area '
        + 'exposes (from the data models / contracts) at EXACTLY the given paths, importable via the given stack-idiomatic import specifiers; (4) create the '
        + 'directory layout. Match the stack exactly; keep modules to minimal canonical type/record definitions.',
      completionCriteria: [
        { criterionId: 'CC-SCAF-001', description: `Area ${area.area_id} has its dependency manifest + build/test config, and its canonical shared modules exist at their stated paths with working imports.` },
      ],
      writeDirectoryPaths: areaWriteScope(area),
    };
    const stdin = buildAreaScaffoldingPrompt(area, dataModels, contracts, componentDirs);
    try {
      const r = await executorAgent.execute(task, workflowRun.id, stdin, workspacePath, engine.janumiCodeVersionSha);
      invocationIds.push(r.invocationId);
    } catch (err) {
      logger.warn('workflow', 'Phase 9.0 scaffolding agent threw for area (catastrophic safety net may run)', {
        workflow_run_id: workflowRun.id, area: area.area_id, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const invocationId: string | null = invocationIds[0] ?? null;

  const manifestsPresent: Record<string, boolean> = {};
  for (const a of plan.areas) {
    const manifest = a.dependency_manifest || 'package.json';
    const rel = a.source_roots[0] && a.source_roots[0] !== 'src'
      ? path.join(areaRoot(a.source_roots[0]), manifest)
      : manifest;
    manifestsPresent[a.area_id] = fs.existsSync(path.join(workspacePath, manifest))
      || fs.existsSync(path.join(workspacePath, rel));
  }
  const producedPrimaryManifest = plan.areas.length > 0 && plan.areas.every(a => manifestsPresent[a.area_id]);

  logger.info('workflow', 'Phase 9.0 scaffolding agent complete', {
    workflow_run_id: workflowRun.id,
    produced_primary_manifest: producedPrimaryManifest,
    manifests_present: manifestsPresent,
  });
  return { producedPrimaryManifest, invocationId, manifestsPresent };
}

/** One area's scaffolding write scope: its source/test roots plus the area
 *  root where its dependency manifest lives. */
export function areaWriteScope(area: Phase9ReconPlan['areas'][number]): string[] {
  const dirs = new Set<string>();
  dirs.add(area.source_roots[0] ? areaRoot(area.source_roots[0]) : '.');
  for (const r of area.source_roots) dirs.add(r);
  for (const r of area.test_roots) dirs.add(r);
  return [...dirs];
}

export function areaRoot(sourceRoot: string): string {
  // 'services/billing/src' → 'services/billing'; 'src' → '.'
  const norm = sourceRoot.replace(/\\/g, '/').replace(/\/+$/g, '');
  const segs = norm.split('/');
  return segs.length <= 1 ? '.' : segs.slice(0, -1).join('/');
}

function gatherDataModels(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'data_models');
    return rec ? JSON.stringify((rec.content as Record<string, unknown>).models ?? rec.content, null, 1).slice(0, 8000) : '(none)';
  } catch { return '(none)'; }
}

function gatherContracts(engine: PhaseContext['engine'], runId: string): string {
  try {
    const rec = engine.writer.getArtifactByKind(runId, 'interface_contracts');
    return rec ? JSON.stringify((rec.content as Record<string, unknown>).contracts ?? rec.content, null, 1).slice(0, 8000) : '(none)';
  } catch { return '(none)'; }
}

/**
 * The CANONICAL component_id → source-directory map, computed the same way the
 * layout contract ({@link canonicalComponentDir}) and the executor write-scope
 * resolver do. STACK-AWARE: `comp-analytics-ingestion` → `src/analytics-ingestion`
 * for node, `src/analytics_ingestion` for python/rust/go/java (identifier-based
 * package stacks). Passing the resolved stack here keeps the scaffold agent's dirs
 * identical to the executor's `canonicalComponentDir(..., stack)`; omitting it (the
 * old bug) emitted hyphen dirs the python executor then forked into underscore
 * variants → duplicate dirs (slice-156).
 *
 * Feeding this into the scaffolding prompt is what prevents the scaffold agent
 * from inventing a divergent per-component layout (e.g. `src/components/<comp>/`):
 * with no canonical paths the agent fills the vacuum, and its guess collides with
 * where the implementation tasks actually write + what Phase 10 enforces. Sourced
 * from the structured component_model + data_models artifacts (NOT the sliced
 * prompt strings) so the roster is complete; pseudo-components (shared /
 * cross-cutting / root) collapse onto the shared dir / src root as the contract
 * specifies.
 */
export function gatherComponentDirs(
  engine: PhaseContext['engine'],
  runId: string,
  stack?: string,
): Array<{ id: string; dir: string }> {
  const ids = new Set<string>();
  const collect = (kind: string, arrayKeys: string[], idKey = 'id') => {
    try {
      const rec = engine.writer.getArtifactByKind(runId, kind);
      const content = (rec?.content ?? {}) as Record<string, unknown>;
      for (const key of arrayKeys) {
        const arr = content[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const v = (item as Record<string, unknown>)?.[idKey];
            if (typeof v === 'string' && v.trim()) ids.add(v.trim());
          }
        }
      }
    } catch { /* artifact absent — skip */ }
  };
  collect('component_model', ['components', 'component_model']);
  collect('data_models', ['models'], 'component_id');
  return [...ids]
    .sort()
    .map(id => ({ id, dir: canonicalComponentDir(id, 'src', 'src/shared', stack) }));
}

export function buildAreaScaffoldingPrompt(
  area: Phase9ReconPlan['areas'][number],
  dataModels: string,
  contracts: string,
  componentDirs: Array<{ id: string; dir: string }> = [],
): string {
  const stack = area.stack;
  // Each module's `import_specifier` is STACK-IDIOMATIC (recon emits it per
  // language — see phase9Recon). Render it as "importable as (per <stack>)" so
  // the agent honors the same specifier the implementation tasks will import by.
  const mods = area.canonical_modules.length
    ? area.canonical_modules.map(m =>
        `  - ${m.path}${m.import_specifier ? `  — importable as (per ${stack}): ${m.import_specifier}` : ''}${m.description ? `  — ${m.description}` : ''}`).join('\n')
    : '  (none listed — derive the shared types this area needs from the data models / contracts)';
  // Aliases are a stack-SPECIFIC concept (TS/JS path aliases); only render the
  // line when recon actually emitted them. Other stacks import by module path.
  const aliasLine = area.import_aliases.length
    ? `- import aliases (${stack}): ${area.import_aliases.map(al => `${al.alias} → ${al.target}`).join(', ')}\n`
    : '';
  // The CANONICAL per-component directories — the exact paths the implementation
  // tasks will write to and Phase 10 enforces. Rendering them (and forbidding any
  // alternative layout) is what stops the agent inventing a divergent
  // `src/components/<comp>/` tree when `canonical_modules` is empty.
  const componentDirsBlock = componentDirs.length
    ? `## Component directories (canonical — implementation tasks write to these EXACT paths)\n`
      + componentDirs.map(c => `  - ${c.id} → ${c.dir}/`).join('\n')
      + `\nCreate these directories EMPTY — plus the ${stack} package/namespace init file ONLY if the stack requires one (e.g. \`__init__.py\`, \`mod.rs\`). Do NOT put feature files here (the implementation tasks own them), and do NOT invent an alternative layout (no \`components/\` or \`src/components/\` tree).\n\n`
    : '';
  const manifest = area.dependency_manifest || `(the ${stack} standard manifest)`;
  return `# Project Scaffolding — area "${area.area_id}" (stack: ${stack})\n\n`
    + `You are scaffolding the **${stack}** skeleton for this area. Produce IDIOMATIC ${stack} — `
    + `you know its conventions (manifest, module/package layout, import syntax, test runner, and the `
    + `language's type/record constructs). Author ONLY the skeleton below; the implementation tasks add feature behavior on top.\n\n`
    + `## Produce exactly these artifacts\n`
    + `1. The dependency manifest (${manifest}) with the dependencies this area needs and a runnable test command.\n`
    + `2. Any build / language configuration the ${stack} stack requires.\n`
    + `3. The canonical shared modules listed below, at their EXACT paths.\n`
    + `4. The shared data-model and interface-contract type/record DEFINITIONS (the data shapes below), materialized ONCE under the shared module dir.\n`
    + `5. The component directories listed below — created EMPTY.\n`
    + `Then verify it builds / type-checks / parses.\n\n`
    + `## What "skeleton" means here\n`
    + `Skeleton = directory + module structure, the dependency manifest/config, and the shared TYPE / CONTRACT DEFINITIONS (data shapes, signatures). It does NOT include feature behavior or algorithms — those belong to the implementation tasks. A type or record definition IS skeleton; business logic is not.\n\n`
    + `## Layout\n`
    + `- source roots: ${area.source_roots.join(', ') || '(unset)'}\n`
    + `- test roots: ${area.test_roots.join(', ') || '(unset)'}\n`
    + `- dependency manifest: ${manifest}\n`
    + aliasLine + `\n`
    + componentDirsBlock
    + `## Canonical shared modules to create (exact paths)\n${mods}\n\n`
    + `## Shared data models — define as shared types/records under the shared module dir; components IMPORT them (never duplicate per-component)\n${dataModels}\n\n`
    + `## Interface contracts — define as shared contract types under the shared module dir\n${contracts}\n\n`
    + `## Documentation (REQUIRED)\n`
    + `- Every shared type / class / module you create MUST carry a brief doc-comment stating WHAT data shape or contract it materializes and citing the data-model or interface-contract id it comes from (e.g. \`# DM-link-management-linkmapping\`, \`# per IC-DB-PERSISTENCE-001\` in python; \`// DM-...\` in TS/Go/Rust/Java — use this stack's comment syntax).\n`
    + `- Comment the non-obvious WHY, not the WHAT; prefer self-documenting names over narration; leave no commented-out code.\n\n`
    + `## Rules\n`
    + `- Materialize the shared modules + data-model/contract definitions ONCE at the EXACT listed paths; components import them — never duplicate.\n`
    + `- Use ${stack}-idiomatic constructs throughout (types/records, modules, imports, manifest, test runner). Do not import another language's conventions or filenames.\n`
    + `- Component code lives ONLY in the canonical per-component directories above (the same paths the implementation tasks write to).\n`
    + `- Honor the ${stack} stack; do not introduce another language.\n`
    + `- Verify the skeleton builds / type-checks / parses before finishing.`;
}
