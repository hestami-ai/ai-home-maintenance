# Lens Authoring Guide

**Audience:** Engineering and legal-knowledge authors writing new lens packs (Layer 2).

## What a lens is

A lens is a versioned, machine-readable workflow protocol. It declares:
- **states** with predecessors (DAG order),
- per-state **input/output schemas** + **CLV bindings**,
- **permitted agents** per state,
- **required artifacts**, **validators**, **escalation triggers**, **release policies**,
- **applicable jurisdictions**, **clvBindings** (the global CLV terms the lens depends on).

Lenses live under `src/layer2_lens_packs/<lens_name>/manifest.ts`.

## Authoring checklist

1. **Declare the manifest** as a typed `LensPhaseManifest` constant. Use the existing 7 MVP packs as templates.
2. **Author per-state schemas** (Wave 9: schema validation is structural; Wave 10+ adds JSON-Schema runtime checks). Schema names by convention: `<StateName>Input.v1`, `<StateName>Output.v1`.
3. **Bind CLV terms** in `clvBindings` (lens-wide) and per state in `clvScope`. Every term must exist in the CLV.
4. **Register agents** in `src/layer2_lens_packs/registrations.ts` with one capability per group (Group A, B, or C, per evolution §14). `mayApproveRelease` MUST be `false`.
5. **Provide migration metadata** when introducing a v2: declare a `LensVersionTransition` (SAFE / PARTIAL / INCOMPATIBLE) via `LensMigrationsDal.declare(...)`.
6. **Add a gold matter** under `calibration/gold/<TEST_CASE_ID>/` that exercises the lens end-to-end. Hard-gate assertions in `assertions.json`.
7. **Run** `pnpm ci`. The build will not ship if any of: typecheck, lint, layer linter, hardcoding audit, calibration, or build fails.

## Forbidden in lens authoring

- Hardcoded firm names (caught by H1).
- Jurisdiction branching in Layer 1 (caught by H2). Layer 2 may include `applicableJurisdictions` data; do not branch on jurisdiction in code.
- CLV term references that don't exist in the CLV (caught at manifest load).
- Permitted-agent references to unregistered agent ids (caught at manifest load).
- Forward predecessors (caught by manifest validator).
- Late-additions in Issue Bloom pass 3 (caught by `ThreePassBloom`).

## Gold-matter authoring conventions

Per `docs/calibration/gold_capture_protocol.md`:

- Synthetic content only — no real client material.
- Real jurisdictional structure (real court names, statute references, rule numbers).
- Synthetic personal names ("Father", "Mother", "Widget Co.").
- Status starts at `engineering_draft`; advances to `attorney_reviewed` once counsel confirms.

## Wave-by-wave maturity

| Wave | Lens authoring affordance |
|---|---|
| 6 | 7 MVP lens manifests + Family Law E2E with replay agents |
| 7 | Per-lens release-gate + reviewer-assignment integration |
| 8 | Lens versioning (SAFE/PARTIAL/INCOMPATIBLE) + LNFR layer |
| 9 | Two firms onboarded via Layer 3; red-team verifies lens isolation |

## Common patterns

### State that emits an artifact

```ts
{
  stateId: 'DraftMemoGenerate',
  required: true,
  predecessors: ['AuthorityRetrieve'],
  permittedAgents: [SHARED_AGENTS.researchMemoDraft],
  inputSchema: 'ResearchMemoDraftInput.v1',
  outputSchema: 'ResearchMemoDraftOutput.v1',
  validators: [],
  escalationConditions: [],
  clvScope: ['clv.core.work_product.v1', 'clv.core.conclusion.v1'],
  artifactsProduced: ['research_memo_draft'],
}
```

### Handoff boundary that emits an LBH

```ts
{
  stateId: 'IssuePrune',
  required: true,
  predecessors: ['IssueBloom'],
  permittedAgents: [...],
  inputSchema: '...',
  outputSchema: '...',
  validators: [],
  escalationConditions: [],
  clvScope: [...],
  artifactsProduced: [],
  isHandoffBoundary: true,
}
```

### Receiving state with required LBH at entry

```ts
{
  stateId: 'LegalResearchPlan',
  required: true,
  predecessors: ['IssuePrune'],
  permittedAgents: [...],
  // ...
  requiresLbhAtEntry: true,
}
```

## Reference

- Source doctrine: `docs/janumilegal_product_description.md` §Core Concepts, §Core Product Capabilities.
- Architectural addenda: `docs/janumilegal_product_description_evolution.md` §4 (manifests), §6 (LBH), §7 (Issue Bloom Proposal C), §10 (lens versioning).
- Calibration protocol: `docs/calibration/gold_capture_protocol.md`.
