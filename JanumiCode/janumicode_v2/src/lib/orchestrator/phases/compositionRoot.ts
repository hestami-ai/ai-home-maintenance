/**
 * Composition Root — deterministic Phase-9 Tier-A injection (the third
 * kernel step, alongside scaffold synthesis and module ownership): every run
 * gets ONE synthetic final leaf whose job is "make it run".
 *
 * Slice-144 finding: decomposition assigns each component's BEHAVIOR to a
 * leaf, but application bootstrap/wiring is nobody's task — the generated
 * product was a parts bin (framework type-shimmed instead of installed, no
 * entrypoint, route registrars never composed into an app). Phase 6 could in
 * principle emit such a task, but that depends on LLM consistency, and the
 * NFR/operational gates legitimately prune "start the server"-shaped items
 * from functional decomposition — so the kernel injects it deterministically.
 *
 * The injected leaf:
 *   - depends on EVERY other leaf and carries no release → it lands in the
 *     final (backlog/deferred) wave and topo-sorts after all producers;
 *   - owns the GLOBAL verification gate: its write scope is the src root, so
 *     the (now write-dir-scoped) leaf test runner runs the whole suite for it
 *     while ordinary leaves stay scoped to their own dirs;
 *   - is exempted from the Lever-2b root-config protection (it owns
 *     dependency installs / entrypoint registration in package.json); the
 *     shared dir REMAINS protected for it;
 *   - derives its completion criteria deterministically from the interface
 *     contracts (one boot-smoke obligation per contract) plus the compile
 *     and full-suite gates — it has no upstream ACs by construction.
 *
 * Everything here is GENERIC: no framework or package names are assumed —
 * the tech stack is whatever the intent and decomposition chose; the task
 * instructs the agent to install what the code actually imports.
 */

import type { SchedulerLeaf } from '../executionScheduler';
import type { ScaffoldManifest } from './scaffoldSynthesis';

export const COMPOSITION_ROOT_TASK_ID = 'task-composition-root';
export const COMPOSITION_ROOT_COMPONENT_ID = 'composition_root';

interface ContractForSmoke {
  id: string;
  protocol?: string;
  data_format?: string;
}

export function buildCompositionRootLeaf(
  allLeaves: ReadonlyArray<SchedulerLeaf>,
  manifest: ScaffoldManifest | null,
  contracts: ContractForSmoke[],
): SchedulerLeaf {
  const e = manifest?.profile.language === 'javascript' ? 'js' : 'ts';
  const componentIds = [...new Set(allLeaves.map((l) => l.component_id).filter(Boolean))].sort();

  const contractLines = contracts
    .filter((c) => c.id)
    .map((c) => `  - ${c.id}${c.protocol ? ` (${c.protocol}${c.data_format ? `, ${c.data_format}` : ''})` : ''}`);

  const description = [
    'COMPOSITION ROOT — integrate every implemented component into ONE runnable application. ',
    'All component implementation tasks have already run; their code is in the workspace. Your job is wiring, not feature work. Steps:',
    '(1) DEPENDENCIES — inspect the source imports across src/. Any package the code imports that is missing from package.json must be installed for real. ' +
    'If any component substituted a type shim / stub declaration for a real dependency, install the real dependency and delete the shim.',
    `(2) ENTRYPOINT — create the application entrypoint at src/index.${e} (or extend it if present): construct the application, ` +
    'register every component\'s routes/middleware/services (components: ' + componentIds.join(', ') + '), ' +
    'read configuration from environment variables with sensible defaults, and start listening when run directly.',
    '(3) BOOT VERIFICATION — add an integration test that starts the application in-process and exercises at least one request/interaction per external interface contract:',
    ...(contractLines.length ? contractLines : ['  - (no interface contracts recorded — smoke-test the primary user-facing flow instead)']),
    '(4) GLOBAL GATE — the whole workspace must hold: the type-check must pass with zero errors and the FULL test suite must pass. ' +
    'Fix integration breakage you find, preferring the canonical shared modules and each component\'s existing public surface; do not rewrite component internals.',
  ].join('\n');

  const completion_criteria = [
    {
      criterion_id: 'CC-COMP-001',
      description: `Application entrypoint exists at src/index.${e}, composes all components, and starts cleanly.`,
      verification_method: 'test_execution',
      artifact_ref: `src/index.${e}`,
    },
    {
      criterion_id: 'CC-COMP-002',
      description: 'All dependencies the source imports are real installed packages (no type shims / stub module declarations remain).',
      verification_method: 'static_analysis',
      artifact_ref: 'package.json',
    },
    {
      criterion_id: 'CC-COMP-003',
      description: 'Workspace type-check passes with zero errors and the FULL test suite passes.',
      verification_method: 'test_execution',
      artifact_ref: 'package.json',
    },
    ...contracts.filter((c) => c.id).map((c, i) => ({
      criterion_id: `CC-COMP-SMOKE-${String(i + 1).padStart(3, '0')}`,
      description: `Boot-smoke integration test exercises interface contract ${c.id} against the in-process application.`,
      verification_method: 'test_execution',
      artifact_ref: c.id,
    })),
  ];

  return {
    id: COMPOSITION_ROOT_TASK_ID,
    task_type: 'standard',
    component_id: COMPOSITION_ROOT_COMPONENT_ID,
    component_responsibility: 'Application composition: dependency installation, entrypoint wiring, boot verification, global gate.',
    description,
    dependency_task_ids: allLeaves.map((l) => l.id).filter(Boolean),
    estimated_complexity: 'medium',
    completion_criteria,
    // src-wide scope ⇒ the scoped leaf test runner runs the FULL suite for
    // this leaf — the global gate has exactly one owner.
    write_directory_paths: ['src'],
    read_directory_paths: ['src'],
    // No release → backlog/final wave (scheduler runs null-release leaves last).
    release_id: null,
    release_ordinal: null,
    _composition_root: true,
  } as SchedulerLeaf;
}
