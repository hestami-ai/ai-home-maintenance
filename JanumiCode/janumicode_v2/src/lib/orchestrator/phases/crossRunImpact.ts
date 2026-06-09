/**
 * Cross-Run Impact — deterministic interface diff.
 * Based on JanumiCode Spec v2.3, §4 Phase 0.5.1 (lines 494-502).
 *
 * Phase 0.5.1 classifies a changed Interface Contract / API Definition /
 * Data Model as `additive`, `breaking`, or `non_breaking` by a *rule-based*
 * (non-LLM) diff of the old and new definitions. The rules (spec table):
 *
 *   | Change adds members without removing/altering existing ones | additive    |
 *   | Change removes, renames, or retypes any existing member      | breaking    |
 *   | Change touches only descriptions/defaults/error messages     | non_breaking|
 *
 * Ambiguity (a member both added and a structurally-similar one removed)
 * resolves to `breaking` — the conservative default. An opaque new
 * definition we cannot parse into members (e.g. the headless harness's
 * `{ statement }` superseding artifact) is also `breaking` — we cannot
 * prove the change is safe, so we assume the worst.
 */

export type ModificationType = 'additive' | 'breaking' | 'non_breaking';

/** A definition is any record content blob carrying interface members. */
type Definition = Record<string, unknown> | null | undefined;

/**
 * A normalized interface member. `name` is its stable identity (a removed
 * or renamed name is what makes a change breaking); `signature` is the
 * type-bearing shape used to detect retyping. Description/default/error
 * fields are deliberately excluded from the signature so an
 * implementation-only edit reads as `non_breaking`.
 */
interface Member {
  name: string;
  signature: string;
}

/**
 * The member-level result of a deterministic interface diff. `removed`,
 * `added`, and `retyped` are the member identities that changed — surfaced so
 * Phase 0.5 can put "what specifically changed" into the Refactoring Task's
 * instructions (the executor needs the diff, not just the classification).
 */
export interface InterfaceDiff {
  modificationType: ModificationType;
  /** Member keys present in old, absent in new. */
  removed: string[];
  /** Member keys present in new, absent in old. */
  added: string[];
  /** Member keys present in both but with a differing type signature. */
  retyped: string[];
  /** False when either side had no extractable members (→ breaking, opaque). */
  parseable: boolean;
}

/**
 * Member-level deterministic diff of `oldDef` → `newDef`.
 *
 * Both arguments are the raw `content` of an `artifact_produced` record
 * (interface_contracts / api_definitions / data_models), or — for the
 * superseding side — a synthetic override artifact that may not carry a
 * parseable member list. When members cannot be extracted from either side,
 * the result is `breaking` / `parseable: false` (conservative).
 */
export function diffInterfaceMembers(oldDef: Definition, newDef: Definition): InterfaceDiff {
  const oldMembers = extractMembers(oldDef);
  const newMembers = extractMembers(newDef);

  // No structured members on one side → we cannot prove the change is
  // additive or impl-only. Assume breaking (spec: ambiguous → conservative).
  if (oldMembers.size === 0 || newMembers.size === 0) {
    return { modificationType: 'breaking', removed: [], added: [], retyped: [], parseable: false };
  }

  const removed: string[] = [];
  const added: string[] = [];
  const retyped: string[] = [];

  for (const [name, sig] of oldMembers) {
    const next = newMembers.get(name);
    if (next === undefined) removed.push(name);
    else if (next !== sig) retyped.push(name);
  }
  for (const name of newMembers.keys()) {
    if (!oldMembers.has(name)) added.push(name);
  }

  // Any removal, rename (surfaces as removed+added), or retype is breaking.
  // Pure additions → additive. Same member set + signatures → non_breaking
  // (only descriptions/defaults/errors could have changed; excluded from sig).
  let modificationType: ModificationType = 'non_breaking';
  if (removed.length > 0 || retyped.length > 0) {
    modificationType = 'breaking';
  } else if (added.length > 0) {
    modificationType = 'additive';
  }

  return { modificationType, removed, added, retyped, parseable: true };
}

/**
 * Classify the change from `oldDef` to `newDef`. Thin wrapper over
 * `diffInterfaceMembers` returning only the modification_type.
 */
export function diffInterfaceDefinitions(oldDef: Definition, newDef: Definition): ModificationType {
  return diffInterfaceMembers(oldDef, newDef).modificationType;
}

/**
 * Walk a definition's known collection shapes and produce a name→signature
 * map of its members. Tolerant of the three concrete kinds and degrades to
 * an empty map for anything it cannot parse (→ caller treats as breaking).
 *
 * Recognized shapes:
 *   - data_models:       content.models[].entities[].fields[]   → `entity.field`
 *   - api_definitions:   content.definitions[].endpoints[]      → `METHOD path`
 *   - interface_contracts: content.contracts[] / .operations[]  → contract/operation id
 */
function extractMembers(def: Definition): Map<string, string> {
  const members = new Map<string, string>();
  if (!def || typeof def !== 'object') return members;
  const content = def as Record<string, unknown>;

  // ── data_models ────────────────────────────────────────────────────
  for (const model of asArray(content.models)) {
    const entityName = stringField(model, ['name', 'id', 'entity', 'component_id']) ?? 'entity';
    for (const entity of asArray((model as Record<string, unknown>)?.entities)) {
      const eName = stringField(entity, ['name', 'id']) ?? entityName;
      for (const field of asArray((entity as Record<string, unknown>)?.fields)) {
        const fName = stringField(field, ['name', 'id', 'field']);
        if (!fName) continue;
        const type = stringField(field, ['type', 'data_type', 'sql_type']) ?? '';
        members.set(`${eName}.${fName}`, `type:${type}`);
      }
    }
  }

  // ── api_definitions ────────────────────────────────────────────────
  for (const definition of asArray(content.definitions)) {
    for (const ep of asArray((definition as Record<string, unknown>)?.endpoints)) {
      const path = stringField(ep, ['path', 'route', 'url']);
      const method = (stringField(ep, ['method', 'verb']) ?? 'GET').toUpperCase();
      if (!path) continue;
      // Signature = ordered input/output type surface (impl-only fields excluded).
      const inputs = typeSurface((ep as Record<string, unknown>)?.inputs);
      const outputs = typeSurface((ep as Record<string, unknown>)?.outputs);
      members.set(`${method} ${path}`, `in:${inputs}|out:${outputs}`);
    }
  }

  // ── interface_contracts (and generic operation lists) ──────────────
  for (const key of ['contracts', 'operations', 'interfaces'] as const) {
    for (const item of asArray(content[key])) {
      const name = stringField(item, ['id', 'name', 'operation', 'signature']);
      if (!name) continue;
      const protocol = stringField(item, ['protocol', 'data_format', 'type']) ?? '';
      members.set(name, `sig:${protocol}`);
    }
  }

  return members;
}

/** Stable, order-independent type surface for an inputs/outputs blob. */
function typeSurface(blob: unknown): string {
  if (Array.isArray(blob)) {
    return blob
      .map((p) => {
        const name = stringField(p, ['name', 'id', 'field']) ?? '';
        const type = stringField(p, ['type', 'data_type']) ?? '';
        return `${name}:${type}`;
      })
      .filter(Boolean)
      .sort()
      .join(',');
  }
  if (blob && typeof blob === 'object') {
    return Object.keys(blob as Record<string, unknown>).sort().join(',');
  }
  return typeof blob === 'string' ? blob : '';
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function stringField(obj: unknown, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const val = rec[k];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return undefined;
}

/** The interface `content.kind` values Phase 0.5 treats as cross-run-significant. */
export const CROSS_RUN_INTERFACE_KINDS = ['interface_contracts', 'api_definitions', 'data_models'] as const;
export type CrossRunInterfaceKind = (typeof CROSS_RUN_INTERFACE_KINDS)[number];

export function isCrossRunInterfaceKind(kind: unknown): kind is CrossRunInterfaceKind {
  return typeof kind === 'string' && (CROSS_RUN_INTERFACE_KINDS as readonly string[]).includes(kind);
}
