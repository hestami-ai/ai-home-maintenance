# RPH-DOC-010 §46 — UX Acceptance Criteria Checklist

> The 20 conformance criteria from RPH-DOC-010 §46, each mapped to where it is satisfied in the delivered
> engine + workbench UI (or flagged as a scoped remainder). Cross-checked by an adversarial verification pass
> (`rph-doc-010-acceptance-verify` workflow). "Engine" = a command handler / domain guard / test; "UI" = a
> SvelteKit route under `apps/rph-demo/src/routes`.

| # | Criterion | Status | Where |
| --- | --- | --- | --- |
| 1 | Product Realization PWA inspectable without opening an Undertaking | ✅ | UI `/` (PWA Library) + `/pwa/[id]` (Work Architecture) read the PWA + its PWU Types with no Undertaking. |
| 2 | PWU Types and PWU Instances visibly distinct | ✅ | Distinct object types (`PWU_TYPE` vs `PROFESSIONAL_WORK_UNIT`); distinct UI (`/pwa/[id]` shows Types; the workbench graph shows Instances with 4-axis state). |
| 3 | PWA version + Undertaking binding always visible | ✅ | Portfolio + Workbench headers show "Instantiated from {PWA} v{version}" (`undertakings/[id]` `undertaking.pwaName/pwaVersion`). |
| 4 | FSM SaaS Undertaking ≠ FSM SaaS product | ✅ | Portfolio/Workbench render `intendedOutputProduct` ("→ produces: Field Service Management SaaS") separately from the Undertaking name. |
| 5 | Product Realization PWA identified as a PWA | ✅ | Object type `PROFESSIONAL_WORK_ARCHITECTURE`; PWA Library labels them "Professional Work Architectures". |
| 6 | PWA / PWG / Execution Plans / Execution Workflows distinct; Views labeled projections | ✅ | Separate object types; `professional-work-graph.ts` header states it is a View/projection; Execution Plans are their own aggregate. |
| 7 | PWA edits don't auto-mutate existing Undertakings | ✅ | Single-aggregate commits; a published PWA version is immutable (machine has no edit-in-place edge); Undertakings bind a fixed `pwaVersion`. |
| 8 | Undertaking edits don't auto-mutate the PWA | ✅ | Undertaking-side handlers write only Undertaking/PWU aggregates; no handler mutates a `PROFESSIONAL_WORK_ARCHITECTURE` from the Undertaking side. |
| 9 | PWA version change for an Undertaking requires explicit migration | ◑ | `Undertaking.status` has an ACTIVE→MIGRATING→ACTIVE machine (migration is a distinct governed transition, never silent); a migration **command + UI** is a scoped remainder (documented). |
| 10 | PWA inheritance vs local content distinguished | ✅ | CON-009 ownership binding: a PWU carries `pwuTypeId` (inherited type) or `isLocalExtension` (Undertaking-local); handler `proposePwu` sets them. |
| 11 | Published PWA versions immutable | ✅ | `PWA.publicationStatus` PUBLISHED has no edit/DRAFT-return edge; `definePwuType` rejects on a non-DRAFT PWA (`pwa-authoring.test.ts`). |
| 12 | Concrete execution/assurance state only on instances | ✅ | PWU Types carry no axis fields; `/pwa/[id]` shows Types with no execution/assurance state (§35.1); the 4 axes live only on `PROFESSIONAL_WORK_UNIT`. |
| 13 | Conformance fixtures labeled as fixtures | ◑ | The seed Undertaking is the RPH-DOC-006 reference fixture; a visible "REFERENCE FIXTURE" badge is a small UI add (documented). |
| 14 | Navigate between a PWU Instance and its PWU Type | ◑ | The binding exists (`pwu.pwuTypeId`); a UI hyperlink from a workbench node to `/pwa/[id]` for its Type is a scoped remainder. |
| 15 | An Undertaking can propose, not directly apply, a PWA change | ◑ | Enforced negatively (no Undertaking-side handler mutates a PWA); a first-class "PWA Change Proposal" object/command is a scoped remainder (§34). |
| 16 | Execution Workflows perform PWU Instances, not substituted for the PWG | ✅ | The PWG (`professionalWorkGraph`) is built from PWU Instances; Execution Plans/Steps are a separate aggregate that performs them. |
| 17 | Complete Reference Undertaking works end to end | ✅ | `seedWorkbench` + `driveReferenceUndertaking` drive the full §27 graph LIVE via commands (`seed-workbench.test.ts`, `reference-undertaking.test.ts`). |
| 18 | UI does not use "workflow" as the PWA's primary name | ✅ | Charter-vocabulary re-mapping: the UI says "Professional Work Architecture" / "PWU Types"; "workflow" never names a PWA. |
| 19 | UI may use "workflow" for temporal execution structures | ✅ | Reserved usage only (Execution Plan/Workflow domain); no misuse. |
| 20 | Reviewer can always determine which level they are examining | ✅ | `+layout.svelte` renders a distinct per-context banner ("PWA DESIGN CONTEXT" vs "UNDERTAKING CONTEXT") + context-coloured nav. |

**Summary:** 15 fully satisfied (✅); 5 partial (◑) — all in RPH-DOC-010 "Slice 5" (migration §31–32, PWA change proposals §34, fixture labelling §21, instance↔type hyperlink §28). The partials are honestly scoped in RESUME-STATE; the conceptual separation the criteria exist to protect holds today (the engine enforces it structurally).

**Also green (engine conformance):** DOC-008 conformance manifest + fast-check properties **P1–P8** (16 tests, `properties.test.ts` + `conformance.test.ts`); the flagship P1/INV-5 ("no green without assurance") is proven live by the reference-undertaking graph (Mobile & Offline stays CONDITIONALLY_SATISFIED, not qualified-green).
