/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tinyurl thin-slice expectation cards.
 *
 * One card per sub-phase the orchestrator is expected to execute.
 * Each card is a list of predicates: small functions that look at the
 * governed_stream / lifecycle event for a given sub-phase boundary and
 * return either { ok: true } or { ok: false, msg: "..." } with the
 * concrete reason for failure.
 *
 * Cards are evaluated by scripts/audit/run-audit.js as sub_phase.exited
 * events stream in. Designed for the tinyurl thin-slice spec at
 * test-and-evaluation/thin-slice-specs/tinyurl-thin-slice.md.
 *
 * Predicates receive an `evalCtx` argument:
 *   - subPhaseEvent: the parsed lifecycle event for sub_phase.exited
 *   - artifacts: array of artifact.produced lifecycle events scoped to
 *     this sub-phase, since its last entered event
 *   - allArtifacts: all artifact.produced events to date (for cross-
 *     phase resolvability checks)
 *
 * Coverage focuses on the high-leverage boundaries that exposed bugs
 * in ts-18 archaeology. Lower-leverage boundaries (where lifecycle/
 * trace coverage already answers the question) just get a "produced
 * at least one artifact" sanity check.
 */

const ok = () => ({ ok: true });
const fail = (msg) => ({ ok: false, msg });

function countByKind(artifacts, kind) {
  return artifacts.filter((a) => a.kind === kind).length;
}

function pickByKind(artifacts, kind) {
  return artifacts.filter((a) => a.kind === kind);
}

// Robust to snake_case / camelCase / PascalCase / kebab-case mismatches
// between the predicate's chosen key and the artifact's own field name.
// `summarizeArtifactCounts` in governedStreamWriter mirrors whatever the
// artifact's content keys are — so if content uses `technicalConstraints`,
// the counts field will be `technicalConstraints_count`. Predicates here
// happen to be written in snake_case ("items", "user_stories", etc), but
// the actual artifacts mix conventions. This helper tries every variant.
function countFromKey(artifact, key) {
  const counts = artifact?.counts;
  if (!counts) return 0;
  const variants = keyCaseVariants(key);
  for (const v of variants) {
    const k = `${v}_count`;
    if (k in counts) return counts[k] ?? 0;
  }
  return 0;
}

function keyCaseVariants(key) {
  const variants = new Set([key]);
  // snake → camel
  variants.add(key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
  // snake → PascalCase
  variants.add(key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
  // camel → snake
  variants.add(key.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`).replace(/^_/, ''));
  // kebab → snake
  variants.add(key.replace(/-/g, '_'));
  return [...variants];
}

/**
 * Returns true when an artifact_produced event of `kind` exists in
 * `allArtifacts` (any earlier sub-phase).
 */
function existsUpstream(allArtifacts, kind) {
  return allArtifacts.some((a) => a.kind === kind);
}

module.exports = {
  // ── Phase 0 ─────────────────────────────────────────────────────
  workspace_classification: [
    {
      id: 'WS-1',
      desc: 'workspace_classification artifact produced',
      check: ({ artifacts }) => {
        if (countByKind(artifacts, 'workspace_classification') < 1) {
          return fail('no workspace_classification artifact emitted');
        }
        return ok();
      },
    },
  ],

  // Check-only sub-phases — these intentionally don't emit artifact_produced.
  // Empty card list means the auditor skips them (no predicates → no findings).
  // Without this they'd fall to __default__'s "at least one artifact" check
  // and false-fail.
  external_reference_resolution: [],
  vocabulary_collision_check: [],
  // product_handoff_gate is a gate-only sub-phase — emits phase_gate_evaluation,
  // not artifact_produced. Empty list disables the default "must emit ≥1
  // artifact_produced" check that would false-fail.
  product_handoff_gate: [],

  // ── Phase 1.0a — Intent Lens Classification ────────────────────
  intent_lens_classification: [
    {
      id: 'P1.0a-1',
      desc: 'intent_lens_classification artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'intent_lens_classification') >= 1
          ? ok()
          : fail('no intent_lens_classification artifact'),
    },
  ],

  // ── Phase 1.0b — Intent Discovery ──────────────────────────────
  intent_discovery: [
    {
      id: 'P1.0b-1',
      desc: 'intent_discovery artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'intent_discovery') >= 1
          ? ok()
          : fail('no intent_discovery artifact'),
    },
    {
      id: 'P1.0b-2',
      desc: 'personas: 2 (Link Sharer + Link Clicker)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'intent_discovery')[0];
        if (!a) return fail('no intent_discovery artifact to inspect');
        const personas = countFromKey(a, 'personas');
        if (personas < 1) return fail(`personas=${personas}; expected ≥1`);
        if (personas > 4) return fail(`personas=${personas}; expected ≤4 (intent has 2)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.0c — Technical Constraints Discovery ──────────────
  // This is the cal-22b silent-drop hotspot. Intent declares 4 explicit
  // constraints: Postgres-16, HTTPS-only, containerised, JSON-logs.
  technical_constraints_discovery: [
    {
      id: 'P1.0c-1',
      desc: 'technical_constraints_discovery artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'technical_constraints_discovery') >= 1
          ? ok()
          : fail('no technical_constraints_discovery artifact'),
    },
    {
      id: 'P1.0c-2',
      desc: 'at least 3 technical constraints captured (intent declares ~4)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'technical_constraints_discovery')[0];
        if (!a) return fail('no artifact to inspect');
        const items = countFromKey(a, 'items') || countFromKey(a, 'technical_constraints');
        if (items < 3) return fail(`items=${items}; expected ≥3 (Postgres, HTTPS, containerised, JSON-logs)`);
        if (items > 10) return fail(`items=${items}; expected ≤10 (intent has 4)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.0d — Compliance Retention Discovery ───────────────
  compliance_retention_discovery: [
    {
      id: 'P1.0d-1',
      desc: 'compliance_retention_discovery artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'compliance_retention_discovery') >= 1
          ? ok()
          : fail('no compliance_retention_discovery artifact'),
    },
  ],

  // ── Phase 1.0e — V&V Requirements Discovery ───────────────────
  // Intent declares NFR-1 (latency), NFR-2 (encryption), NFR-3 (uptime).
  vv_requirements_discovery: [
    {
      id: 'P1.0e-1',
      desc: 'vv_requirements_discovery artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'vv_requirements_discovery') >= 1
          ? ok()
          : fail('no vv_requirements_discovery artifact'),
    },
    {
      id: 'P1.0e-2',
      desc: 'at least 3 vv requirements captured',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'vv_requirements_discovery')[0];
        if (!a) return fail('no artifact to inspect');
        const items = countFromKey(a, 'items') || countFromKey(a, 'vv_requirements');
        if (items < 3) return fail(`items=${items}; expected ≥3 (NFR-1/2/3)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.0f — Canonical Vocabulary Discovery ───────────────
  canonical_vocabulary_discovery: [
    {
      id: 'P1.0f-1',
      desc: 'canonical_vocabulary_discovery artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'canonical_vocabulary_discovery') >= 1
          ? ok()
          : fail('no canonical_vocabulary_discovery artifact'),
    },
  ],

  // ── Phase 1.1b — Compliance Context ───────────────────────────
  compliance_context: [
    {
      id: 'P1.1b-1',
      desc: 'compliance_context artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'compliance_context') >= 1
          ? ok()
          : fail('no compliance_context artifact'),
    },
  ],

  // ── Phase 1.2 — Business Domains Bloom ────────────────────────
  business_domains_bloom: [
    {
      id: 'P1.2-1',
      desc: 'business_domains_bloom artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'business_domains_bloom') >= 1
          ? ok()
          : fail('no business_domains_bloom artifact'),
    },
    {
      id: 'P1.2-2',
      desc: 'business domains bounded (intent is a single small product)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'business_domains_bloom')[0];
        if (!a) return fail('no artifact');
        const n = countFromKey(a, 'domains');
        if (n === 0) return fail('domains=0; expected ≥1');
        if (n > 5) return fail(`domains=${n}; expected ≤5 (scope: tinyurl)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.3a — User Journey Bloom ───────────────────────────
  // Intent declares 3 journeys: shorten, follow, inspect.
  user_journey_bloom: [
    {
      id: 'P1.3a-1',
      desc: 'user_journey_bloom artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'user_journey_bloom') >= 1
          ? ok()
          : fail('no user_journey_bloom artifact'),
    },
    {
      id: 'P1.3a-2',
      desc: 'journeys ~ 3 (intent declares 3)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'user_journey_bloom')[0];
        if (!a) return fail('no artifact');
        // The bloom artifact uses `userJourneys` as the array key; case
        // variants (countFromKey) cover snake/camel/kebab but not
        // synonyms, so we OR with the actual content key.
        const n = countFromKey(a, 'userJourneys') || countFromKey(a, 'journeys');
        if (n < 2) return fail(`journeys=${n}; expected ~3 (intent declares 3)`);
        if (n > 6) return fail(`journeys=${n}; expected ~3 (intent declares 3)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.3b — System Workflow Bloom ────────────────────────
  system_workflow_bloom: [
    {
      id: 'P1.3b-1',
      desc: 'system_workflow_bloom artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'system_workflow_bloom') >= 1
          ? ok()
          : fail('no system_workflow_bloom artifact'),
    },
  ],

  // ── Phase 1.3c — Integrations QA Bloom ────────────────────────
  integrations_qa_bloom: [
    {
      id: 'P1.3c-1',
      desc: 'integrations_qa_bloom artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'integrations_qa_bloom') >= 1
          ? ok()
          : fail('no integrations_qa_bloom artifact'),
    },
  ],

  // ── Phase 1.4 — Entities Bloom ────────────────────────────────
  // Intent implies URLMapping + ClickEvent (two entities).
  entities_bloom: [
    {
      id: 'P1.4-1',
      desc: 'entities_bloom artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'entities_bloom') >= 1
          ? ok()
          : fail('no entities_bloom artifact'),
    },
    {
      id: 'P1.4-2',
      desc: 'entities bounded (intent implies ~2)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'entities_bloom')[0];
        if (!a) return fail('no artifact');
        const n = countFromKey(a, 'entities');
        if (n < 1) return fail(`entities=${n}; expected ≥1`);
        if (n > 8) return fail(`entities=${n}; expected ≤8 (intent implies ~2)`);
        return ok();
      },
    },
  ],

  // ── Phase 1.5 — Intent Statement ──────────────────────────────
  intent_statement: [
    {
      id: 'P1.5-1',
      desc: 'intent_statement artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'intent_statement') >= 1
          ? ok()
          : fail('no intent_statement artifact'),
    },
  ],

  // ── Phase 1.6 — Product Handoff ───────────────────────────────
  product_handoff: [
    {
      id: 'P1.6-1',
      desc: 'product_description_handoff record emitted (gate to Phase 2)',
      check: ({ allArtifacts }) =>
        allArtifacts.some(
          (a) => a.record_type === 'product_description_handoff',
        )
          ? ok()
          : fail('no product_description_handoff record — Phase 2 will hard-fail'),
    },
  ],

  // ── Phase 2 — FR / NFR ────────────────────────────────────────
  fr_bloom_skeleton: [
    {
      id: 'P2.1-1',
      desc: 'functional_requirements artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'functional_requirements') >= 1
          ? ok()
          : fail('no functional_requirements artifact'),
    },
    {
      id: 'P2.1-2',
      desc: 'user_stories ~ 3 root FRs (intent declares FR-1, FR-2, FR-3)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'functional_requirements')[0];
        if (!a) return fail('no artifact');
        const n = countFromKey(a, 'user_stories');
        if (n < 2) return fail(`user_stories=${n}; expected ~3`);
        if (n > 16) return fail(`user_stories=${n}; expected ~3 (intent has 3 FRs)`);
        return ok();
      },
    },
  ],

  nfr_bloom_skeleton: [
    {
      id: 'P2.2-1',
      desc: 'non_functional_requirements artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'non_functional_requirements') >= 1
          ? ok()
          : fail('no non_functional_requirements artifact'),
    },
    {
      id: 'P2.2-2',
      desc: 'NFR count ~ 3 root NFRs',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'non_functional_requirements')[0];
        if (!a) return fail('no artifact');
        const n = countFromKey(a, 'nfrs');
        if (n < 2) return fail(`nfrs=${n}; expected ~3`);
        if (n > 10) return fail(`nfrs=${n}; expected ~3 (intent has 3 NFRs)`);
        return ok();
      },
    },
  ],

  // ── Phase 3 — System Specification ────────────────────────────
  system_boundary: [
    {
      id: 'P3-1',
      desc: 'system_boundary artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'system_boundary') >= 1
          ? ok()
          : fail('no system_boundary artifact'),
    },
  ],

  system_requirements: [
    {
      id: 'P3.2-1',
      desc: 'system_requirements artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'system_requirements') >= 1
          ? ok()
          : fail('no system_requirements artifact'),
    },
  ],

  // ── Phase 4 — Architecture ────────────────────────────────────
  software_domains: [
    {
      id: 'P4.1-1',
      desc: 'software_domains artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'software_domains') >= 1
          ? ok()
          : fail('no software_domains artifact'),
    },
  ],

  // The keystone scope-check. ts-18 produced 11 root components for a
  // 3-FR intent. Tinyurl should yield ~4 in-scope components:
  //   1. url-shortening (FR-1 + FR-2)
  //   2. redirect-service (FR-3)
  //   3. api/web-ui interface
  //   4. (optional) error-handling support
  // Components must trace_to specific US-* ids that exist.
  component_skeleton: [
    {
      id: 'P4.2-1',
      desc: 'component_model artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'component_model') >= 1
          ? ok()
          : fail('no component_model artifact'),
    },
    {
      id: 'P4.2-2',
      desc: 'component count bounded (ts-18 had 11; tinyurl should yield ~4)',
      check: ({ artifacts }) => {
        const a = pickByKind(artifacts, 'component_model')[0];
        if (!a) return fail('no artifact');
        const n = countFromKey(a, 'components');
        if (n < 2) return fail(`components=${n}; expected ~4`);
        if (n > 8) return fail(`components=${n}; expected ≤8 — SCOPE CREEP (ts-18 was 11)`);
        return ok();
      },
    },
  ],

  // ── Phase 5 — Technical Specification ─────────────────────────
  data_models: [
    {
      id: 'P5.1-1',
      desc: 'data_models artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'data_models') >= 1
          ? ok()
          : fail('no data_models artifact'),
    },
  ],

  api_definitions: [
    {
      id: 'P5.2-1',
      desc: 'api_definitions artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'api_definitions') >= 1
          ? ok()
          : fail('no api_definitions artifact'),
    },
  ],

  // ── Phase 6 — Implementation Planning ─────────────────────────
  implementation_plan: [
    {
      id: 'P6.1-1',
      desc: 'implementation_plan artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'implementation_plan') >= 1
          ? ok()
          : fail('no implementation_plan artifact'),
    },
  ],

  // ── Phase 7 — Test Planning ───────────────────────────────────
  test_case_skeleton: [
    {
      id: 'P7.1-1',
      desc: 'test_plan artifact emitted (final form)',
      check: ({ allArtifacts }) =>
        allArtifacts.some((a) => a.kind === 'test_plan')
          ? ok()
          : fail('no test_plan artifact at this point'),
    },
  ],

  // ── Phase 8 — Evaluation Planning ─────────────────────────────
  functional_evaluation_plan_subphase: [
    {
      id: 'P8.1-1',
      desc: 'functional_evaluation_plan artifact emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, 'functional_evaluation_plan') >= 1
          ? ok()
          : fail('no functional_evaluation_plan artifact'),
    },
  ],

  // ── Phase 8.5 — Packet Synthesis ──────────────────────────────
  // Coherence verdict is the keystone: ts-18 had 31/31 packets fail.
  packet_synthesis: [
    {
      id: 'P8.5-1',
      desc: 'implementation_packet records emitted',
      check: ({ artifacts }) =>
        countByKind(artifacts, undefined) >= 0 &&
        artifacts.some((a) => a.record_type === 'implementation_packet')
          ? ok()
          : fail('no implementation_packet records produced'),
    },
    {
      id: 'P8.5-2',
      desc: 'no packet_synthesis_failure record (means at least 1 packet failed coherence)',
      check: ({ artifacts }) => {
        const failures = artifacts.filter(
          (a) => a.record_type === 'packet_synthesis_failure',
        );
        if (failures.length === 0) return ok();
        return fail(
          `packet_synthesis_failure record present — at least one packet failed coherence`,
        );
      },
    },
  ],

  // ── Phase 9 — Execution ───────────────────────────────────────
  // Audited via executor.invocation_status_change events rather than
  // artifact.produced; see audit driver for that special-case path.

  // ── Default catch-all ─────────────────────────────────────────
  __default__: [
    {
      id: 'GEN-1',
      desc: 'sub-phase produced at least one artifact (sanity check)',
      check: ({ artifacts }) =>
        artifacts.length >= 1
          ? ok()
          : fail('sub-phase produced zero artifact_produced events'),
    },
  ],
};
