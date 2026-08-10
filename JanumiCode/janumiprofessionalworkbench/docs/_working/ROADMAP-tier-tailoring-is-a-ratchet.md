# ROADMAP — tier tailoring is a ratchet

Implements `DESIGN-tier-tailoring-is-a-ratchet.md`. **One increment lands now** (T-1); the rest are dispositions
recorded in the register, blocked on acts that are not mine.

---

## T-1 — the §10.3 foreclosure floor applies whether or not a policy declares it

**Red first.** Extend `blocking-finding-forecloses-signoff.test.ts` with a policy that declares **no**
`dispositionRules` at all: record a BLOCKING observation, attempt SATISFIED ⇒ **REFUSED**. *This fails today* —
`forbidden.size === 0` returns `null` and the gate never fires. That is REG-F-111's defect **as a class**; what
shipped fixed one policy.

**Change** — `rejectForeclosedDisposition` in `packages/rph-application/src/handlers/assurance.ts`:

```ts
const forbidden = new Set([...BLOCKING_SEVERITIES, ...(dispositionRule?.forbiddenOpenSeverities ?? [])]);
```

**UNION, not `??`.** A policy may ADD severities it will not tolerate; it cannot name fewer, because the floor is
unioned in at the point of use. This is DESIGN §2 rule 2 made structural: **there is no value a policy author
can write that switches the floor off** — not `[]`, not omission, not a wrong disposition key.

⚠ **Scope the floor to POSITIVE dispositions only.** `BLOCKING_SEVERITIES` must not foreclose `REJECTED` or
`ESCALATED` — those are the dispositions a blocking finding *leads to*. Unioning the floor into every rule would
make a blocking finding unresolvable in any direction, which is the over-refusal that turns a gate into a
deadlock. Verify against `AssuranceDispositionRecommendationSchema` which values are positive; the floor applies
to `SATISFIED` and `CONDITIONALLY_SATISFIED`.

**Ledger.** `B1-the-signoff-forecloses-nothing` is **SUPERSEDED**, not deleted: emptying the demo policy's
declaration no longer weakens anything, which is the whole point of the change. Its successor mutates the FLOOR
UNION itself and is named in `supersededBy`.

**Controls (existing ones must still hold):** a clean sign-off is still ACCEPTED; an ADVISORY observation still
does not foreclose; a REJECTED disposition is still ACCEPTED for a blocking finding — **that last one is the
over-refusal control and it now guards the floor union too.**

**Gate:** full, including `bun run mutants`.

---

## T-2..T-5 — recorded, not built

| Item | Blocked on | Recorded as |
|---|---|---|
| `ExecutionStep.strength` ratification | a governance act | REG-F-105 (open, unchanged) |
| `COMPLETED` gloss | a governance act | REG-F-107 (open, unchanged) |
| strength ⟷ obligation ratchet | the profile mechanism, which is the **Platform's** allocation | new REG-F |
| expiry on standing authorities | a **contract act** — `DecisionObject` has no such field | new REG-F |

**Why they are not built rather than approximated:** a tier check with no tier is a branch that never fires, and
this repository has spent the week finding exactly that shape. Better an owed item than an inert one.

---

## T-6 — register

1. **REG-D-042** — the sponsor's extension of REG-D-041, and the ruling it produced: **tier tailoring is a
   ratchet**, with the ratified constraint (DOC-001 L252/L256) quoted, and the dangerous inverse reading named.
2. **Amend REG-F-111** — the class fix supersedes the instance fix; the general form stands and is now enforced.
3. **New REG-F** — the two ratchets, specified and deliberately unbuilt, each with its blocker.
