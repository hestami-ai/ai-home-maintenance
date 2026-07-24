# Provenance — JAN-CMDPRE-SPEC-001 Command Precondition and Transition Legality (v0.1.0 DRAFT, 2026-07-24)

Maps each section of this program reference to its source. It is a JAN-CMDPRE program deep reference (NOT a canon artifact — see the SPEC's `classification` field). Unlike the canon DOC-series (synthesized from the retired corpus), it is derived primarily from the **repository shapes** it defers to (the state-machine table and the command handlers), and from the JAN-CMDPRE design/roadmap. "Catalog" = the `spec001-catalog` cataloging run (14 subagents reading and citing `transitions.data.ts` and the handler files; run id `wf_ce3aa315-ae0`, 2026-07-24). "DS-001" / "DR-001" = the JAN-CMDPRE design + roadmap under `docs/Command Precondition Legality/` (working authority granted for this engagement). All catalog line citations were spot-verified by the authoring session against the live files before entering the normative text.

## Status block
- Status-block shape borrows the canon frontmatter convention (CON-000 / DOC-004 status blocks) for familiarity, but this is a program reference, not canon: `classification` states so explicitly, settledness HYPOTHESIS, ratification NOT SOUGHT. Authored under the 2026-07-24 sponsor grant. It DEFERS to DOC-003 on meaning; it is not a member of the JPWB-SPEC-nnn canon series.

## §1 Scope and relation to the canon
- §1.2 harm statement: JPWB-CON-000 AX-7 (append-only) + JPWB-DOC-003 §9 / PER-2 (immutability); the NOOP-admits-re-issue mechanism is DS-001 §5 / DR-001 §9, verified in `kit.ts` `checkTransition` (NOOP admitted) and `advanceStatus` (write path).
- §1.3 relation to DOC-003: DOC-003 §6 opening ("the exact state enumerations and the closed transition/guard tables are repository shapes") — the delegation this SPEC fulfils. Additive-to-§6 framing (which command drives which in-arrow) is the DS-001 D1 precondition ruling.
- §1.4 scope boundary: DR-001 DWP-05 `knowledge_status: PARTIAL`; AX-8 (fail closed, do not invent) governs the deferral.

## §2 State-machine catalog
- Every row cataloged from `packages/rph-domain/src/transitions.data.ts` by the Catalog run (machine agents), each transition cited to its exact line. Spot-verified: `Baseline.status` (:1542-1580), `AssurancePolicy.status` (:1056-1078), `Decision.status` (:1516-1541), `Intent.intentStatus` (:35-128), `PWU.workLifecycleState` (:129-479). `AggregateAssuranceDisposition` (:1591) excluded as a non-transition rollup.

## §3 Per-command contract catalog
- Every command cataloged from the handler files (`intent.ts`, `pwu.ts`, `execution.ts`, `runtime-binding.ts`, `assurance.ts`, `governance.ts`, `decomposition.ts`, `pwa-authoring.ts`, `obligation-constraint.ts`/`harness.ts`/`artifact.ts`) cross-checked against `registry.ts`, by the Catalog run (command agents). The load-bearing `preconditionClass` was classified by reading each handler.
- §3.1 remediation surface: the NONE (22) + GUARD_ONLY_ACCIDENTAL (9) rows, guard/code/re-issue behavior per handler. The `PromoteBaseline` reclassification (roadmap hint "NONE" → cataloged GUARD_ONLY_ACCIDENTAL) and the `SupersedeAssurancePolicy` tags-compounding (`assurance.ts:320-328`) were both spot-verified against source.

## §4 Invariant catalog
- INV-1/INV-2: DS-001 D1 + the AX-7/PER-2 harm; NON-examples NEW per DOC-004 §10.2.
- INV-3: DS-001 critique B3 (enforcement-before-guard), the "dead code / mutation-can't-fail" consequence grounded in CON-000 B7 + DOC-004 §7.4.
- INV-4: DS-001 D4 (hand-authored, not `drivesFrom`), with DS-001 §2-§3 evidence.
- INV-5: DR-001 DWP-03/04 invariant ("no currently-refused command becomes accepted"); the widest-in-arrow regression is DR-001 §12.
- INV-6: DS-001 finding F-4 generalized; the accumulative-field table built from the Catalog `accumulativeFields` data (`tags`/`entries`/`semanticVersion`/event-append), verified against the handlers named.
- INV-7: DS-001 §14 refusal-code rules; the three enumerated code-change sites from the Catalog (two shipped DWP-01b, one pending PromoteBaseline).
- INV-8: DS-001 D3 (REJECT-not-absorb, sponsor-ruled 2026-07-22) + the idempotency-key/monotonic-counter observation (DR-001 F-12).

## §5 Conformance-fixture specification
- The mutation-red-proof obligation is CON-000 B7 + DOC-004 §7.4 ("silently removing or inverting a guard must fail a test") + §7.5 numeric floors (REG-E-020 cedes the numbers to repo gates). The per-site table (DWP-04's six) built from §2 machine rows + the Catalog DWP-04 detail; the `SupersedeAssurancePolicy` tags obligation is the F-4 instance.

## §6 Forks / §7 Deliberately Unspecified
- Forks authored under the grant; F-3 records the `PromoteBaseline` roadmap correction; F-4 marks the AssurancePolicy sets UNRATIFIED-AUTHORED (DS-001 §10 residual 2); F-6 is the SPEC's honest disclosure of the 22+9 backlog beyond DWP-04's six. §7 defers the DWP-05 plan-level + pwa-authoring remainder under AX-8; `ValidatePwa`'s ordering issue filed as a PILOT finding.

## Method note
- No retired (`docs/` outside `canon/`) material was consulted as authority. DS-001/DR-001 were used under the engagement's explicit working-authority grant, as design decisions (not canon), and are cited as such.
