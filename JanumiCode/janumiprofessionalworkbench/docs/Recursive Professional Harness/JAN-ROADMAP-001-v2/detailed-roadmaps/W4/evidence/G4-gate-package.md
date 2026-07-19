# G4 Gate Package — Demonstration Usability and Concept Integrity

**Wave:** W4 — Demonstration PWA and Undertaking UX. **Gate:** G4. **Predecessor:** G3 APPROVE_WITH_CONDITIONS.
**Decision:** `APPROVE_WITH_CONDITIONS` (delegated sponsor authority, procedure change 2026-07-19).

## 1. Work-package status

| WP | Status |
| --- | --- |
| 4-001 PWA Library + Product Realization inspection | **CONFORMANT** (Library + Designer, the strongest surface) |
| 4-002 Undertaking Portfolio + instantiation | **CONFORMANT** (version-bound; only PUBLISHED PWAs instantiable) |
| 4-003 Undertaking Overview + Professional Work Graph | **CONFORMANT** (four independent axes; qualified-green rule) |
| 4-004 Object Inspector + controlled edit classification | **PARTIAL → DEF-W4-001** (no 4-way edit-classification taxonomy exists) |
| 4-005 Execution Workbench | **PARTIAL → DEF-W4-002** (summary table; drill-down deferred) |
| 4-006 Assurance Workbench + finding remediation | **CONFORMANT** (PWA floor + §38 view + policy manager; undertaking-side remediation is read-only) |
| 4-007 Traceability / Impact / Decision / Baseline UX | **PARTIAL → improved** (**Traceability tab CLOSED, W4-INC-1 `d46bf08b`**; Decision Center done; baseline promotion UI → DEF-W4-003; impact preview → DEF) |
| 4-008 Full Reference Demonstration + Accessibility | **PARTIAL** (end-to-end reference is live + navigable; ~23 E2E specs; a11y practiced → DEF-W4-004 verification) |

## 2. Headline

The demonstration app is **substantially built on the real engine** and satisfies the wave's core outcome — the Product Realization PWA and the FSM Undertaking are intelligible and operable through **clearly separated PWA-definition and Undertaking-instance surfaces** (enforced by a context banner). The biggest genuine gap (traceability UI — a backend projection with no consumer) is **closed and E2E-proven** (INC-1). The remaining gaps are bounded UI features whose engine capabilities all exist and are tested; they are deferred with reason, not dropped.

## 3. Conformance baseline

`check-types` 21/21 (incl. rph-demo svelte-check) · full `bun run test` 21/21 · `lint` clean · `boundary` 174/0 · E2E: new `traceability.e2e.ts` green + baselines/decisions/undertaking-pwu re-run green (tab-branch restructure non-regressing).

## 4. Wave exit criteria (master §14 W4)

- Users can distinguish PWA / Undertaking / Professional Work Graph / Execution Workflow / View — **MET** (separate routes + context banner).
- Product Realization PWA inspectable as reusable architecture — **MET** (PWA Designer).
- FSM undertaking inspectable + controllably editable as an instance — **MET** (Undertaking Workbench; controlled-edit *classification* deferred, DEF-W4-001).
- Execution success, assurance state, shape integrity independently visible — **MET** (four-axis node coloring + overview table).
- Decision + baseline interactions version-bound + auditable — **MET** for decisions + baseline lifecycle; AUTHORITATIVE promotion via UI → DEF-W4-003 (engine supports it).

## 5. Decision

```yaml
gate: G4
decision: APPROVE_WITH_CONDITIONS
authority: Coding agent under delegated sponsor authority (procedure change 2026-07-19)
date: 2026-07-19
conditions: [C3-1]                                  # drive coverage/preservation assessments (carried)
deferrals: [DEF-W4-001, DEF-W4-002, DEF-W4-003, DEF-W4-004]
carried: [C2, DIV-W1-003]
commits: [d46bf08b]
notes: >
  Demonstration app substantially built on the real engine; separated PWA/Undertaking surfaces satisfied.
  Traceability UI gap closed + E2E-proven (INC-1). Remaining gaps (edit-classification, execution
  drill-down, baseline-promotion form, a11y audit) are bounded UI features over existing tested engine
  capabilities — deferred with reason, not fabricated.
```

## 6. Proposed next — W5–W7 (legacy-removed re-scope)

Per `../../MASTER-CHANGE-CONTROL-2026-07-19-legacy-removal.md`, W5 (shadow mode), W6 (pilot authority transfer), and W7 (legacy retirement) are materially re-scoped by the legacy=REMOVE decision. Their gates (G5–G7) record DEFER/REMOVE of the legacy-dependent WPs and RETAIN the native residue (WP-5-003 compatibility-milestone versioned derivation — already baseline-built in W2-INC-3; WP-6-001 authority-mode as native; WP-7-001..007 product-behavior/implementation modeling folding into W8). See `../W5-W7`.
