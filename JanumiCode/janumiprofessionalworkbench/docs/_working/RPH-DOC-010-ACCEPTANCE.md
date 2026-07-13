# RPH-DOC-010 §46 — UX Acceptance Criteria Checklist

> The 20 conformance criteria from RPH-DOC-010 §46, each mapped to where it is satisfied in the delivered
> engine + workbench UI. **Verified by an adversarial verification pass** (`rph-doc-010-acceptance-verify`
> workflow — 4 agents, each told to *refute* its assigned criteria against the live code). The verdicts below
> are the reconciled final state after closing the fixture-labelling, instance↔type-navigation, full-work-area,
> and execution-surface gaps the pass surfaced. "Engine" = a command handler / domain guard / test; "UI" = a
> SvelteKit route under `apps/rph-demo/src/routes`.

| # | Criterion | Status | Where |
| --- | --- | --- | --- |
| 1 | Product Realization PWA inspectable without opening an Undertaking | ✅ | UI `/` + `/pwa/[id]` read the PWA + PWU Types with no Undertaking (one click, entirely in the PWA Design context). |
| 2 | PWU Types and PWU Instances visibly distinct | ✅ | Distinct object types; `/pwa/[id]` tags "PWU TYPE" with no state; the workbench graph shows Instances with live 4-axis state — never co-appear. |
| 3 | PWA version + Undertaking binding always visible | ✅ | Portfolio row + Workbench header (above the tab bar) show "Instantiated from {PWA} v{version}". |
| 4 | FSM SaaS Undertaking ≠ FSM SaaS product | ✅ | `name` vs `intendedOutputProduct` rendered as distinct elements ("→ produces: Field Service Management SaaS" + "the Undertaking is not the product"). |
| 5 | Product Realization PWA identified as a PWA | ✅ | Object type `PROFESSIONAL_WORK_ARCHITECTURE`; UI labels "Professional Work Architectures" / "Work Architecture". |
| 6 | PWA / PWG / Execution Plans / Execution Workflows distinct; Views labeled projections | ✅ | Separate object types + separate UI surfaces (PWA context, PWG graph labeled a "projection (View)", Execution tab for Execution Plans). *Note:* the temporal Execution Workflow is represented by an Execution Plan + its steps (not a separate object type). |
| 7 | PWA edits don't auto-mutate existing Undertakings | ✅ | Single-aggregate commits; published PWA immutable; Undertaking binds `pwaVersion` as a fixed literal — no propagation path (workflow found none). |
| 8 | Undertaking edits don't auto-mutate the PWA | ✅ | No Undertaking-side handler writes `PROFESSIONAL_WORK_ARCHITECTURE`/`PWU_TYPE`; a PWU references `pwuTypeId`, never mutates it. |
| 9 | PWA version change for an Undertaking requires explicit migration | ◑ | `Undertaking.status` has a governed ACTIVE→MIGRATING→ACTIVE machine (never silent); the **negative guarantee holds structurally** — the affirmative migration command + UI is a scoped remainder (§31–32). |
| 10 | PWA inheritance vs local content distinguished | ◑ | CON-009 data (`pwuTypeId` vs `isLocalExtension`); the workbench PWU list shows the Type link or "Undertaking-local extension". A richer §24 "inherited-from-PWA vs defined-for-this-Undertaking" split is a scoped remainder. |
| 11 | Published PWA versions immutable | ✅ | `publicationStatus` PUBLISHED has no edit/return edge; `definePwuType` rejects on a non-DRAFT PWA (`pwa-authoring.test.ts`). |
| 12 | Concrete execution/assurance state only on instances | ✅ | PWU Types carry no axis fields; `/pwa/[id]` shows no state; the 4 axes live only on `PROFESSIONAL_WORK_UNIT`. |
| 13 | Conformance fixtures labeled as fixtures | ✅ | `/pwa/[id]` surfaces the PWA's conformance fixtures (the FSM Undertaking) with a "REFERENCE FIXTURE" badge + a "not the PWA definition" note. |
| 14 | Navigate between a PWU Instance and its PWU Type | ✅ | Workbench overview lists each PWU Instance with a link to its PWU Type's definition (`/pwa/[id]`); local extensions labeled as such. |
| 15 | An Undertaking can propose, not directly apply, a PWA change | ◑ | The **negative guarantee holds** (no write path Undertaking→PWA). A first-class "PWA Change Proposal" object/command (§34) is a scoped remainder. |
| 16 | Execution Workflows perform PWU Instances, not substituted for the PWG | ✅ | The workbench Execution tab lists Execution Plans that *perform* PWU Instances (distinct from the graph); the seed drives a real plan for the Architecture PWU. |
| 17 | Complete Reference Undertaking works end to end | ✅ | `driveReferenceUndertaking` drives all 7 §7 work areas LIVE (intent→behavior→architecture baselined; the downstream areas proposed but NOT STARTED, exactly matching §27); `reference-undertaking.test.ts` (13 nodes). |
| 18 | UI does not use "workflow" as the PWA's primary name | ✅ | The UI never uses "workflow" for a PWA (charter re-mapping). |
| 19 | UI may use "workflow" for temporal execution structures | ✅ | Reserved usage only (Execution context copy); no misuse. |
| 20 | Reviewer can always determine which level they are examining | ✅ | `+layout.svelte` renders a distinct, persistent per-context banner ("PWA DESIGN CONTEXT" vs "UNDERTAKING CONTEXT") + context-coloured nav. |

**Final tally: 17 fully satisfied (✅), 3 partial (◑), 0 gap.** The 3 partials are all in RPH-DOC-010 "Slice 5" and each has its **negative guarantee already enforced structurally** by the two-bounded-context architecture; only the affirmative UI capability remains: migration (§31–32), a richer inherited-vs-local split (§24), and a first-class PWA Change Proposal (§34). These are documented in RESUME-STATE as the scoped remainder.

**Engine conformance (green):** DOC-008 conformance manifest + fast-check properties **P1–P8** (16 tests, `properties.test.ts` + `conformance.test.ts`). The flagship P1/INV-5 ("no green without assurance") is proven live by the reference-undertaking graph (Mobile & Offline stays CONDITIONALLY_SATISFIED, not qualified-green), plus the decision-authority gate (GOV-001/2) and the baseline-promotion gate (INV-20) are proven by live command-drive tests.
