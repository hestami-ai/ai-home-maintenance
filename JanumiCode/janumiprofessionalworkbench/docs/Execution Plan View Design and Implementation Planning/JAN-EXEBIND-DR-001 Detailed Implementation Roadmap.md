# JAN-EXEBIND-DR-001 — Runtime Binding Authority: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-25 · Design authority `JAN-EXEBIND-DS-001` v0.1.0. Origin: the three findings JAN-EXECREM
WP-16's conformance gate raised (`JAN-EXECREM-RESIDUALS.md` §5).*

## 1. Land order

Four work packages, **WP-B0 → WP-B3**, each independently landable and centrally gated.

**WP-B0 first, and the ordering is load-bearing.** The record correction precedes the fix because two of my three
dispositions in `JAN-EXECREM-RESIDUALS.md` §5 are **wrong in the reassuring direction** — they describe holes as
unbuildable that are merely unbuilt. Landing the fix first would silently retire N-1 and leave N-2/N-3 carrying
false reasons that now look validated by an adjacent success. A wrong record corrected only where it happened to
block me is not a corrected record.

| WP | Title | Covers | Depends on |
|---|---|---|---|
| **B0** | Correct the residual register; raise the new finding | N-2/N-3 reasons; R4; the corpus-gap escalation | — |
| **B1** | `resolveBindingAuthority` — RPH-EXE-003 + the allowlist limb | N-1; DS §5 | B0 |
| **B2** | Register + manifest reconciliation | DS §6 C-1, C-2 | B1 |
| **B3** | Series gate + delivery record | — | B2 |

## 2. WP-B0 — the record, corrected before the code

**Change:** `JAN-EXECREM-RESIDUALS.md` §5. Replace N-2's *"needs a runtime capability plane … that does not exist
in this engine at all"* and N-3's *"the transition it would guard is unreachable"* with DS §3.3 / §3.4's real
reasons. Add the **corpus gap** (four `Source TBD` helper sub-types, each referenced by a ratified rule) and the
**new finding R4** (an unconstrained first grant may award a capability never requested). Add a standing note that
two entries in this register were wrong, and how.

**Why it is a work package and not a footnote:** DS §2. The failure mode is recording the absence of evidence as
evidence of absence, and this is the seventh instance in this codebase. A register that silently self-corrects
teaches nothing; one that says *"these two entries were wrong, in this direction, for this reason"* is the only
form that survives contact with the next reader.

**Verification:** none mechanical — it is a record. The check is that every claim in the replacement text cites a
file and a line a reader can open, and that the new finding names its production site.

## 3. WP-B1 — `resolveBindingAuthority`

**Files:** `packages/rph-application/src/handlers/execution.ts` (the resolver + the `startExecutionStep` precheck),
plus one new test file.

**Placement:** inside `startExecutionStep`'s existing `precheck`, so it runs **after** `stepAuthorityRefusal`'s
declared limbs and **before** the source-state check — the slot every other per-command precheck occupies. No
existing refusal changes which code a caller sees. *(The pre-landing survey obligation from JAN-EXECREM WP-8
applies: grep every `error.code` assertion on `StartExecutionStep` before landing.)*

**The four steps, and why the order is what it is** (DS §5): absent → out of scope (R5); unresolvable →
fail-closed; status → `RPH_BINDING_NOT_AUTHORIZED` (the **ratified** rule); allowlist → `RPH_INVARIANT_VIOLATION`
(the **authored** limb). Status before allowlist so the authored rule can never mask the ratified one — if it
did, RPH-EXE-003's kill test would be vacuous, which is the defect class reintroduced by its own fix.

**Kill tests — required, each isolating ONE limb:**

| # | Case | Must refuse with |
|---|---|---|
| K1 | binding `REQUESTED` | `RPH_INVARIANT_VIOLATION` + the kernel code `RPH_BINDING_NOT_AUTHORIZED` in the message |
| K2 | binding `DENIED` | same |
| K3 | binding `REVOKED` | same |
| K4 | `runtimeBindingId` names no object | `RPH_VALIDATION_SEMANTIC_FAILED` (fail-closed, mirroring `pwuOpennessRefusal`) |
| K5 | binding `AUTHORIZED` but **∉** `plan.authorizedRuntimeBindingIds` | `RPH_INVARIANT_VIOLATION` + the **allowlist** marker — **the limb-separation proof** |

**K1–K3 and K5 share a wire code**, so every one of them must assert the **marker**, not the code. That is not
belt-and-braces: `RPH_INVARIANT_VIOLATION` is returned by the PWU-openness limb, the retry cap, the prunability
precheck and several others, so a code-only assertion proves that *something* refused — the vacuous negative.
| P1 | binding `AUTHORIZED` **and** in the allowlist | **ACCEPTED** |
| P2 | binding `PARTIALLY_AUTHORIZED` and in the allowlist | **ACCEPTED** (the ratified kernel permits it) |
| P3 | no `runtimeBindingId` at all | **ACCEPTED** (R5 — and the reference seed's shape) |

**K5 is the one that matters.** Without it the two limbs are one limb wearing two names: every other negative is
satisfied by the status check alone. K5 must be arranged so the binding is genuinely `AUTHORIZED` — otherwise it
is a vacuous negative, which is the exact shape JAN-EXECREM spent WP-9 removing.

**P1–P3 are not optional.** A resolver that refuses everything passes K1–K5. Over-refusal is the failure mode a
refusal-only battery cannot see, and this programme has already produced it once (WP-15's PWU limb survived its
first mutation run).

**Declared mutations (all must go RED):** invert `bindingPermitsExecution`'s accept set · delete the allowlist
limb · move the allowlist limb ahead of the status check (K1 must then report the wrong code) · make the absent
case refuse (P3 + `rph-engine` 69 must break) · make the unresolvable case fail **open**.

## 4. WP-B2 — register + manifest

Both of these fire **by design**; a green build at this step means an instrument is broken, not that the work is
done.

- `enforcement-register.ts`: `RPH-EXE-003` moves `UNENFORCED_DISCLOSED → ENFORCED` with a site, a code, a distinct
  ≥20-char marker and declared mutations. **This will not compile** until `execrem-wp16-enforcement-observed.test.ts`
  gains its probe — the `PROBES` map is total over the id union (DS §6 C-1).
- The allowlist limb is **not** an RPH-* rule. It is the enforcement of a ratified *field* (§15.3) that WP-14
  persisted. Record it in the register's prose as an authored companion to RPH-EXE-003 rather than minting a
  fictional rule id — the register's own totality gate refuses ids the catalog does not ratify.
- `conformance-manifest.ts`: `RPH-EXE-003` gains a COMMAND-layer citation; the `RPH-EXE` family note is updated
  to name only EXE-004/005 as unenforced.
- `bindingPermitsExecution`'s census row disappears (it is no longer a dead predicate). **`capabilityAuthorized`
  and `stepMayBecomeReady` keep theirs, with WP-B0's corrected reasons** — this is the point at which it would be
  easiest to quietly drop all three, and that is the thing not to do.

## 5. WP-B3 — gate and delivery record

**Gate package `G-EXEBIND-001`:** `check-types` · `test` · `lint` 0 · `boundary` 0 · svelte-check 0 · Playwright ·
**`rph-engine` 69 (the reference seed drives unchanged)** · the registry-totality gates · every new guard live
mutation-red-proofed by the implementing engineer, never delegated to a sub-agent.

Delivery record in this document's §6, and a pointer added to `JAN-EXECREM-RESIDUALS.md` §5 so N-1's entry says
where it was closed. **The residual register stays the authoritative index** — one register, not two.

## 6. Delivery record

**WP-B0 … WP-B3 DELIVERED, 2026-07-25.**

| WP | Commit | Outcome |
|---|---|---|
| B0 | `1eb0b2af` | Design + roadmap; N-2/N-3 reasons corrected; N-4 and N-5 raised. |
| B1–B3 | `9cfee6f4` | `bindingAuthorityRefusal` wired; RPH-EXE-003 `ENFORCED`; register + manifest reconciled; N-6 raised. |

**Gate `G-EXEBIND-001` green:** check-types 21/21 (svelte-check 0) · vitest 21/21 (`rph-application` 533→545,
`rph-domain` 415, **`rph-engine` 69 — the reference seed drives unchanged**) · lint clean · boundary 0
(244 modules) · Playwright 50 passed.

**Mutation red-proof: 7 declared mutants, all RED** — invert the accept set · delete the allowlist limb ·
reorder the limbs · refuse the absent binding (application *and* seed) · fail OPEN on an unresolvable authority ·
drop the precheck entirely.

**Three things the build corrected in this roadmap's own design**, recorded because each was a claim that turned
out to be unproven or wrong:

1. **The order mutant SURVIVED the first battery.** §3's argument that status-must-precede-allowlist was correct
   and *tested nowhere* — every case allowlisted its binding, so both orders behaved identically. Only an input
   failing **both** limbs can tell them apart. Added as "THE ORDER PROOF". An argument without a failing case is
   not evidence.
2. **The seed mutant reported a FALSE GREEN.** `rph-engine` resolves `@janumipwb/rph-application` to its built
   dist; mutating src without rebuilding proves nothing. Rebuilt: 34 of 69 fail. The harness now rebuilds, so the
   ledger is reproducible rather than footnoted.
3. **`RPH_BINDING_NOT_AUTHORIZED` is not a ratified wire code.** `RphErrorCodeSchema` is a closed 15-value enum;
   that string is the kernel's label. Corrected in DS §5 *before* building against it.

**And the new gate immediately caught a fixture that depended on the hole it closed:**
`execrem-wp14-provenance.test.ts` authored steps naming a binding that never existed — legal only while nothing
resolved the field. DS-001 §4 item 3 verbatim ("tests codified the holes as intent"). The fixture was made
honest; the rule was not weakened.

## 7. What this roadmap does NOT close

`RPH-EXE-004` (both limbs) and `RPH-EXE-005` stay open, blocked on DS §4-R3: four helper sub-types are
`Source TBD` in the ratified corpus, so the rules' subjects are unrepresentable. **Escalated as a corpus gap, not
worked around.** Authoring those shapes would invent normative semantics the corpus withholds — and this lineage's
own standard is that an authored extension is narrow, labelled, and anchored to a ratified statement, which is not
satisfiable when the anchor reads "Source TBD".

The new finding R4 (an unconstrained first grant) is **raised, not fixed**, for the same reason.

---

*`DELIVERED` / v0.1.0 — 4 work packages, all landed 2026-07-25. One of three findings closed; the other two escalated as a corpus gap rather than worked around. Three new findings raised (N-4, N-5, N-6).*
