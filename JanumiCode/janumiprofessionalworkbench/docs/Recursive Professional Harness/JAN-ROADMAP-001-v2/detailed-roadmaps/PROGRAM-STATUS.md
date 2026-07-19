# JAN-ROADMAP-001 — Program Status (end-of-roadmap review)

**Prepared:** 2026-07-19, by the coding agent under delegated sponsor authority (procedure change 2026-07-19: drive the full roadmap without pausing at gates; commits are the authorization; sponsor reviews at the end). Every wave W0–W10 has been driven to a documented, gated disposition. This is the single index for review.

## Gate ledger

| Wave | Gate | Decision | Substance |
| --- | --- | --- | --- |
| W0 Baseline & code grounding | G0 | APPROVE_WITH_CONDITIONS | legacy classified REMOVE; JPWB = live subject; "hollow governed layer" hypothesis |
| W1 Semantic kernel | G1 | **APPROVE** | **the hollow layer closed at the root** — object plane built + all 5 governance invariants wired live |
| W2 Durable persistence | G2 | **APPROVE** | durability+migration guard, restart outbox recovery, rebuildable Traceability+Compatibility projections |
| W3 Intent→Architecture slice | G3 | APPROVE_WITH_CONDITIONS | slice runs live to an AUTHORITATIVE Architecture Baseline; intent version-binding + assumption RPH-ASM-006 gate |
| W4 Demonstration UX | G4 | APPROVE_WITH_CONDITIONS | app runs on the real engine; separated PWA/Undertaking surfaces; Traceability UI closed (E2E-proven) |
| W5 Legacy shadow mode | G5 | APPROVE_WITH_CONDITIONS | legacy-shadow WPs REMOVED (no legacy plane); WP-5-003 compatibility RETAINED (built W2) |
| W6 Pilot authority | G6 | APPROVE_WITH_CONDITIONS | authority-transfer WPs REMOVED; single writable authority SATISFIED-BY-CONSTRUCTION |
| W7 Full migration | G7 | APPROVE_WITH_CONDITIONS | legacy-retirement REMOVED; product-behavior/implementation modeling RETAINED → W8 |
| W8 JPWB self-hosting | G8 | APPROVE_WITH_CONDITIONS | JPWB authors/publishes its own PWA through the real pipeline; rule-DSL + bootstrap-proof residue |
| W9 Tenant customization | G9 | APPROVE_WITH_CONDITIONS | local extension upheld; tenant WPs are forward work, multi-tenant **auth-gated (C2)** |
| W10 Productization | G10 | **DEFER** | genuinely external — blocked on **C2 (auth)** + Square/deployment/tenant-identity infra (sponsor material-decision) |

## What was genuinely built this program (code, all red-first + full-gate-green)

**The through-line: the "hollow governed layer" — the deepest finding — is closed.** W0 diagnosed that 74% of the RPH kernel was reachable only from tests; the last five genuine gaps were *structural* (kernels deciding over runtime object/graph planes that were never instantiated). Under delegated authority those planes were **built, not force-wired over emptiness**, and every governance invariant is now enforced at its live write path:

| Increment | Invariant now enforced | Commit |
| --- | --- | --- |
| Object plane | first-class Obligation/Constraint objects + RecompositionContract minted | `28e077f5`, `20a3733e` |
| WIRE-1/2 | obligation conservation P2 + constraint propagation P3 at `ValidateDecomposition` | `6020f92f` |
| WIRE-3a | recomposition §14.1 (conflict ⇒ CONFLICTED even when all children SATISFIED) | `20a3733e` |
| WIRE-3b | invalidated evidence blocks promotion (P4/CT-10 pull-guard) | `6dc18d00` |
| WIRE-4 | stale-decision version binding P5 at `PromoteBaseline` | `eb32a8bf` |
| W2-INC-1 | durable persist/replay round-trip + `PRAGMA user_version` fail-closed | `16d1ff6e` |
| W2-INC-2 | restart outbox recovery (exactly-once across a crash) | `c1262abe` |
| W2-INC-3 | rebuildable Traceability (DEF-W1-002) + Compatibility projections | `8307f89d` |
| W3-INC-1 | ApproveIntent exact-version binding | `4e9c3912` |
| W3-INC-2 | assumption expiry + RPH-ASM-006 (dead assumption can't authorize work) | `9bcdca57` |
| W4-INC-1 | intent-to-baseline Traceability UI surface (E2E-proven) | `d46bf08b` |

Every code increment: the violating input goes **red before the fix**, a control proves the gate is **not a blanket reject**, and the full gate is green (`check-types` 21/21 · `bun run test` 21/21 · `lint` · `boundary` · Playwright for the UI increment). No vacuous gate was ever shipped; the Field Service reference fixture stayed green throughout.

## The three things that remain (honest, not fabricated)

1. **C2 — the authentication gap (CRITICAL, since W0).** No endpoint authenticates; the server fabricates a HUMAN principal. This hard-gates all multi-tenant work (W9 tenant WPs, W10 platform tenancy/enterprise). It is a security workstream the sponsor reserved. **Nothing multi-tenant should ship until it closes.**
2. **W10 external infrastructure.** Square billing, real deployment, and real tenant identity are external commercial/platform dependencies that master §10 reserves to the sponsor as material decisions. They cannot be truthfully built in-repo.
3. **DIV-W1-003 — the successor-master revision.** The legacy-removal re-scope of W5–W7 is decided and recorded (`../MASTER-CHANGE-CONTROL-2026-07-19-legacy-removal.md`); only the formal re-issue of `JAN-ROADMAP-001` remains, a sponsor editorial act.

Plus the bounded, disclosed deferrals per wave (rule-DSL authoring, execution/inspector drill-down UI, PWA profiles/fork/export, versioned compatibility derivation, the reshape/falsification loop) — all recorded in their gate packages with the underlying capability tested at the engine layer.

## Where to review

- Per-wave detail: `W0/`, `W1/`, `W2/`, `W3/`, `W4/`, `W5-W7/`, `W8-W10/` (each with roadmap + evidence + gate package).
- The legacy re-scope: `../MASTER-CHANGE-CONTROL-2026-07-19-legacy-removal.md`.
- Commits are local, NOT pushed (per GIT-POL-010 — the sponsor pushes). HEAD is on `main` atop `c2b853b1`.
