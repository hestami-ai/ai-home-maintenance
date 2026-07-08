/**
 * Deterministic ID normalization helpers.
 *
 * Some LLMs (gpt-oss in particular) emit IDs with the right prefix but
 * occasional formatting drift — underscores instead of hyphens, or the
 * prefix in the wrong case. Rather than rely on prompt strengthening
 * alone (which hasn't fully eliminated the drift in any model tested
 * so far), we apply a small deterministic normalization pass to the
 * artifact at ingestion time. This is the JSON-repair-style "clean up
 * after the model" pattern, scoped narrowly to ID shapes the schema
 * actually constrains.
 *
 * Surfaced in the ts-13 quality assessment:
 *   - entities_bloom: 2/35 ENT-* ids used underscores (e.g.
 *     `ENT-LEGAL_DOCUMENT` instead of `ENT-LEGAL-DOCUMENT`).
 *   - Phase 5 data_model_skeleton: emitted `COMP-001` while Phase 4
 *     component_skeleton (and the rest of the pipeline) used lowercase
 *     `comp-001`. The case mismatch breaks referential integrity to
 *     the component decomposition tree.
 */

/**
 * Replace underscores with hyphens inside a screaming-prefix ID,
 * preserving the prefix exactly. Returns the input unchanged when no
 * substitution is needed or the string doesn't match the expected
 * `<PREFIX>-<body>` shape.
 *
 * Examples:
 *   `ENT-LEGAL_DOCUMENT`  → `ENT-LEGAL-DOCUMENT`
 *   `WF-VALIDATE_URL`     → `WF-VALIDATE-URL`
 *   `INT-PAYMENT-GATEWAY` → `INT-PAYMENT-GATEWAY` (no change)
 *   `comp-001`            → `comp-001` (no underscore, no change)
 *   `some random text`    → `some random text` (not an ID shape)
 */
export function normalizeIdHyphens(id: string): string {
  // Match a SCREAMING-PREFIX (1+ uppercase A-Z) followed by `-` then a
  // body of A-Z/0-9/`_`/`-`. The body is the part we sanitize; the
  // prefix is preserved verbatim. We intentionally accept the input
  // even if the body contains underscores — that's exactly what we're
  // cleaning up.
  const m = /^([A-Z]+)-([A-Z0-9_-]+)$/.exec(id);
  if (!m) return id;
  const [, prefix, body] = m;
  if (!body.includes('_')) return id;
  return `${prefix}-${body.replaceAll('_', '-')}`;
}

/**
 * Normalize a component_id to its canonical lowercase-prefix shape.
 * The Phase 4 component_skeleton producer + recursive component
 * decomposition tree both use `comp-<slug>` (lowercase prefix), so
 * any downstream reference (Phase 5 data models, Phase 6 tasks,
 * Phase 9 execution targets) must use the same case to preserve
 * referential integrity.
 *
 * Examples:
 *   `COMP-001`                      → `comp-001`
 *   `Comp-001`                      → `comp-001`
 *   `comp-001`                      → `comp-001` (no change)
 *   `COMP-RATE-LIMITER`             → `comp-RATE-LIMITER` (only prefix flipped — body left alone since slugs vary)
 *   `COMP-ANALYTICS_CLICK-LOGGING`  → `comp-ANALYTICS-CLICK-LOGGING` (also runs through hyphen normalization)
 *   `not-a-comp-id`                 → `not-a-comp-id` (doesn't match prefix)
 */
export function normalizeComponentIdRef(id: string): string {
  // Prefix-only case-normalize: `comp-` (lowercase). Body is preserved
  // because component slugs legitimately vary (`comp-001`, `comp-rate-limiter`,
  // `comp-ANALYTICS-METRICS`) and we don't want to flatten case here —
  // just match the prefix-case to what the producer emits.
  const m = /^(comp)-(.+)$/i.exec(id);
  if (!m) return id;
  const [, , body] = m;
  // Also apply hyphen normalization to the body — `COMP-ANALYTICS_CLICK`
  // should become `comp-ANALYTICS-CLICK` in one pass.
  const cleanedBody = body.replaceAll('_', '-');
  return `comp-${cleanedBody}`;
}

/**
 * Recursively walk a parsed JSON value, applying `mutate` to every
 * string value at a key listed in `idKeys`. Operates in place but
 * returns the same reference for chaining.
 *
 * This is the bulk-application hook callers use when they have an
 * artifact JSON tree and want to normalize a known set of ID-bearing
 * field names without writing tree-walks at every call site.
 */
export function normalizeIdsInTree(
  node: unknown,
  idKeys: Set<string>,
  transform: (v: string) => string,
): unknown {
  if (Array.isArray(node)) {
    for (const item of node) normalizeIdsInTree(item, idKeys, transform);
    return node;
  }
  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && idKeys.has(k)) {
        obj[k] = transform(v);
      } else if (typeof v === 'object' && v !== null) {
        normalizeIdsInTree(v, idKeys, transform);
      }
    }
    return obj;
  }
  return node;
}
