/**
 * Shared safe formatters for rendering LLM-produced `content` objects into
 * prompt text.
 *
 * Phase `content` blobs are untyped JSON: a field the calling code expects as
 * a string can arrive as an object (e.g. system-boundary `in_scope` items are
 * `{ capability, description, satisfies_fr }`), and dependency/relationship
 * shapes drift across producers (`component_id` vs `target_component_id`,
 * `kind` vs `dependency_type`). Naive interpolation / `Array.join` then renders
 * the useless literal `[object Object]`, or a bare `undefined`, into the prompt
 * — dead, model-misleading context.
 *
 * These helpers extract a meaningful label and NEVER emit `[object Object]` or a
 * standalone `undefined`. (Audit fix PA-8.)
 */

function pickString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/** Best-effort human label for a scope/capability item that may be a string or an object. */
export function displayCapability(x: unknown): string {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return pickString(o, ['capability', 'name', 'statement', 'item', 'title', 'description', 'id']) ?? JSON.stringify(o);
  }
  return String(x);
}

/**
 * Render a component dependency as `target (kind)`, tolerant of field-name drift
 * (`target_component_id` vs `component_id`; `dependency_type` vs `kind`).
 */
export function displayComponentDependency(d: unknown): string {
  const o = (d ?? {}) as Record<string, unknown>;
  const target = pickString(o, ['target_component_id', 'component_id', 'target', 'to', 'id']) ?? '(unspecified)';
  const kind = pickString(o, ['dependency_type', 'kind', 'type']);
  return kind ? `${target} (${kind})` : target;
}

/**
 * Render a data-model relationship as `target (kind[, ownership])`, tolerant of
 * raw-vs-parsed shape (a raw `target_entity_id` may itself be a nested object).
 */
export function displayEntityRelationship(r: unknown): string {
  const o = (r ?? {}) as Record<string, unknown>;
  let target = pickString(o, ['target_entity_id', 'target', 'entity_id', 'id']);
  if (target === undefined) {
    const raw = o.target_entity_id ?? o.target;
    if (raw && typeof raw === 'object') {
      target = pickString(raw as Record<string, unknown>, ['id', 'name']) ?? JSON.stringify(raw);
    }
  }
  target ??= '(unspecified)';
  const kind = pickString(o, ['kind', 'type']) ?? 'references';
  const ownership = pickString(o, ['ownership']);
  return ownership ? `${target} (${kind}, ${ownership})` : `${target} (${kind})`;
}
