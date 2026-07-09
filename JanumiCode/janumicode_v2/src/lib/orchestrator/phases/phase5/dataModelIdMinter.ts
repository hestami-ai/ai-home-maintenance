/**
 * Producer-side stable id minting for Phase 5 data-model entities and API
 * endpoints (Pillar A of the cross-phase ID integrity layer).
 *
 * Phase 5 emits entities ({name, fields}) and endpoints ({path, method}) with
 * NO id, so the packet consumer used to MINT synthetic `dm-*`/`api-*` ids that
 * the coherence verifier then flagged as "invented references" (every one
 * fired P7). The fix: mint a deterministic, stable id HERE, at the producer,
 * persisted in the artifact — so the collector and the upstream index both
 * reference the same real id.
 *
 * Follows the AC-minter convention ([[project_ac_composite_namespace]],
 * phase2/acIdNormalizer.ts): ids are derived from a NATURAL KEY (not random),
 * so minting is fully deterministic and idempotent — safe to re-run on resume.
 */

/** Natural-key slug used by the DM- / API- id scheme. Exported so P5.1b's
 *  entity_ownership_reconciliation groups cross-component copies of a concept on
 *  the SAME key the producer already mints ids from (structural, not id-resolution). */
export function slug(raw: string): string {
  return (raw ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^(comp|component|cmp)[-_]/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'x';
}

/** Stable id for a data-model entity. Natural key: component_id + entity name. */
export function mintEntityId(componentId: string, entityName: string): string {
  return `DM-${slug(componentId)}-${slug(entityName)}`;
}

/** Stable id for an API endpoint. Natural key: component_id + method + path. */
export function mintEndpointId(componentId: string, method: string, path: string): string {
  return `API-${slug(componentId)}-${slug(method)}-${slug(path)}`;
}

interface DataModelLike {
  models?: Array<{
    component_id?: string;
    entities?: Array<{ id?: string; name?: string }>;
  }>;
}

interface ApiDefsLike {
  definitions?: Array<{
    component_id?: string;
    endpoints?: Array<{ id?: string; path?: string; method?: string }>;
  }>;
}

/**
 * Assign a deterministic `id` to every entity in a data_models artifact,
 * in place. Idempotent: the id is a pure function of (component_id, name), so
 * re-running produces the identical value. Returns the count minted.
 */
export function mintEntityIds(content: DataModelLike): number {
  let count = 0;
  for (const model of content.models ?? []) {
    const compId = model.component_id ?? 'unknown';
    for (const entity of model.entities ?? []) {
      entity.id = mintEntityId(compId, entity.name ?? 'unnamed');
      count++;
    }
  }
  return count;
}

/**
 * Assign a deterministic `id` to every endpoint in an api_definitions
 * artifact, in place. Idempotent. Returns the count minted.
 */
export function mintEndpointIds(content: ApiDefsLike): number {
  let count = 0;
  for (const def of content.definitions ?? []) {
    const compId = def.component_id ?? 'unknown';
    for (const ep of def.endpoints ?? []) {
      ep.id = mintEndpointId(compId, ep.method ?? 'GET', ep.path ?? '/');
      count++;
    }
  }
  return count;
}
