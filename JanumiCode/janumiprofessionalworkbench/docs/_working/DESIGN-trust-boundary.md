# DESIGN — The trust boundary: who is acting, derived rather than asserted

**Authority:** REG-D-025 (standing directive). **Method:** the directive's mandated adversarial corpus pass —
6 agents, 1.27M tokens, measure-then-refute, run **before** authoring. All three reports returned
`SOUND_WITH_CORRECTIONS`; the corrections are folded in below and the ones that changed a conclusion are marked ⚠.

**This is INC-D of `DESIGN-accountability-substrate.md` §5 item 4.** That record's §4 (the DOC-003 §3 ↔ N-9
conflict) is now **resolved by REG-D-026** and is struck there.

---

## 0. The finding, stated at the strength the evidence supports and no higher

I set out to record that *an agent can forge human authority*. **Measured, that is not true today, and the
honest finding is both narrower and worse.**

**What is NOT the case.** No in-process caller can forge. The authoring broker defaults to
`actorType: 'AGENT'` (`broker.ts:241`) and `makeAuthoringBroker` never overrides it; the surface stamps `HUMAN`.
So the forgeability is **architectural — nothing prevents it — not live.** Any finding written as "an agent
forges human authority today" would be false, and it is the finding I was about to write.

**What IS the case, and it needs no exploit.**

1. **Every human act in the workbench is the same person, and that person does not exist.**
   `issuedBy: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' }` is **hardcoded at five
   sites** — the command envelope (`workbench.ts:171`), decision authority (`decisions:52`), execution
   provenance (`undertakings/[id]:718`, `:828`) and **the assurance evaluator** (`undertakings/[id]:863`).
   *"Who did what"* — the first clause of the sponsor's standard — is unanswerable **by construction**, not by
   forgery. There is one name for all humans.

2. **⚠ AND THE EVALUATOR IS THE EXECUTOR — MEASURED, AND THE STRONGEST RUNG DOES NOT NOTICE.** Both are
   `ui-user`. `ASR-13` makes independence *"a verified runtime property"*; `INV-5` is the exec≠assurance
   separation this engine exists to enforce. Measured against `checkIndependence`
   (`assurance-rules.ts:184-216`):

   | requirement | producer | evaluator | result |
   |---|---|---|---|
   | `HUMAN` | `ui-user` | `ui-user` | **`{ independent: true }`** |
   | `DIFFERENT_AGENT` | `ui-user` | `ui-user` | `false — same agent identity` |
   | `DIFFERENT_AGENT` | ids absent | ids absent | `false` (fail-closed) |

   **The identity-comparison rungs are correct and fail closed. The `HUMAN` rung does not compare identities at
   all** — `return evaluator.actorType === 'HUMAN' ? independent : fail` (`:205-208`). It asks whether the
   evaluator is *human*, never whether they are *someone else*. So a professional evaluating their own work
   satisfies the top of the ladder.

   ⚠ **I am not calling this a defect outright, because ASR-13's ladder reads *"…→ human or organizational
   independence"*, and one defensible reading is that this rung asserts the evaluator's NATURE (a human rather
   than a machine) while `ORGANIZATIONALLY_INDEPENDENT` carries distinctness.** What is not in doubt: under that
   reading nothing on the ladder prevents self-evaluation by a human, and INV-5 is the invariant that says it
   must be prevented. **Filed as an elicitation item, not patched** — a one-line guess on the assurance
   separation is exactly how an authored interpretation acquires the standing of canon.

3. **The ratified gate does not exist, and its EXISTENCE is the requirement.** `PER-3` (canon, DOC-003 §9):
   *"Canonical state is mutated only through **authenticated, authorized**, semantically named commands…"* — and
   its SCOPE clause makes *"the **existence and completeness** of the gate"* the semantic requirement. So no
   exploit is needed to establish the divergence: `Engine.dispatch` has six stages
   (`command-bus.ts:96-260`) — identity presence, envelope schema, payload hash, idempotency, payload schema,
   route — and **authenticate and authorize are not among them.**

4. **Guards built on an unverified claim inherit its weakness — including one I wrote yesterday.** The REG-E-031
   symmetric revoke guard (`governance.ts:466`) turns entirely on `command.issuedBy.actorType === 'HUMAN'`, with
   no redundancy. Measured: the same `actorId: 'bot-1'` is **UNAUTHORIZED** declaring `AGENT` and **ACCEPTED**
   declaring `HUMAN`, and the record then reads `{"actorId":"bot-1","actorType":"HUMAN"}`. The guard is not
   wrong; **its input is untrusted.** Same for REG-F-014's remedy: `proposeDecision` refuses when the declared
   authority ≠ the issuer — but both come from the same envelope, so making them agree does not make either true.

## 1. What the corpus already ratifies (so this is transcription, not invention)

| Rule | Canon source | Requires | Built |
|---|---|---|---|
| **DOC-004 §5** | *"derive tenant and principal context from authenticated context, **never from a payload's claim about itself**"* | the derivation | **no** |
| **PER-3** | DOC-003 §9 | authenticated **and** authorized commands; gate existence is the requirement | **no** |
| **§3 Common object contract** | DOC-003 §3 | creating/updating actor; **tenant and organization scope**; **authority or an authority reference** | actor only |
| **ASR-15** | DOC-003 §8.7 | *"actor with **verifiable** authority"*; authority checked **before** effect; an agent may not exercise authority *"unless **delegated**"* | guards exist, verifiability does not |
| **ASR-13** | DOC-003 §8.5 | independence verified across **eight** dimensions | single-rung ladder; 2 dimensions unrepresented |

**The directive's hypothesis holds again.** Every element of the remedy has a ratified shape already sitting in
the corpus. `AuthorityReference` (`authorityId`, `authorityType`, `grantedBy`, `scope`, `validFrom`,
`validUntil`) is required on three persisted object types with **not one of its six fields read anywhere**.

**And the sponsor has already foreclosed the tier-conditional escape.** REG-E-006 records:
*"All three have human and agent identity; standalone can authenticate. **REG-F-047's divergence therefore has
no deployment in which it is correct**, and the remedy is uniform rather than tier-conditional."*

**Dispositions that bind this design:** REG-E-027 — *the delegation record becomes real*, and because a
coordinator acts as its triggering actor, delegation stays **human-to-deputy** and is not a back door for
machine authority. REG-E-030 — derived acts carry **explicit derivation provenance, distinct from `issuedBy`**,
and *"a derived act may move work toward caution and may not approve or revoke."*

## 2. The design

**One port, supplied at construction; one credential, supplied per dispatch; the engine stamps the actor.**

```
createEngine({ authenticate: (credential) => Principal | null, … })
engine.dispatch(command, credential)
```

- **The engine STAMPS `issuedBy` from the resolved principal.** It is never read from the caller's envelope for
  any governed effect. That is DOC-004 §5 literally.
- **A declared `issuedBy` that disagrees with the resolved principal is REFUSED, not corrected.** Silent
  correction would make a forgery attempt invisible; the whole point is that the record can answer *why*.
- **No port ⇒ no dispatch.** Fail closed. An engine constructed without one refuses every governed command
  rather than running in a permissive mode — a permissive default is how a gate becomes decorative.
- **`Principal` carries what the object contract already demands:** `actorId`, `actorType`, `displayName`,
  `roleId?`, `tenantId`, `organizationId`. The last two per REG-D-026 (carried, not governed; a well-known
  constant in standalone — *present and singular*, never absent).
- **Authorization is a second, separate stage** and stays deliberately thin in v1: the socket exists and is
  called, and its v1 policy is *"the authenticated principal may act"*. ⚠ **A stage that always returns true is
  a gate that cannot fail** — so it ships with its own mutant and a refusing case, or it does not ship.

**Why a port at construction and a credential per call, rather than a required `principal` parameter.** A
`principal` parameter would let each of ~87 call sites decide who is acting — the same self-assertion one layer
out. The credential is opaque to the caller: it can present it, it cannot author it.

**Standalone gets a real identity, not a bypass.** The sponsor: *"Standalone can have an authenticated
identity."* So standalone supplies a local session principal — one authenticated user, not `ui-user`.

## 3. ⚠ AX-10 makes the race work constitutionally required, not merely prudent

The races pass classified several defects **SAFE-BY-RUNTIME** — real under a second writer, unreachable in one
Node process. **CON-000 AX-10 refuses that defence:** *"Deployment topology MUST NOT change professional
meaning; a runtime is conformant only if it preserves the semantics, whatever its stack."* A correctness
property that holds only in one process **is** a topology-dependent semantic. Combined with REG-D-025's
design-time rule, these are to be designed out, not documented.

Confirmed live and ranked (each with a stated interleaving, in the roadmap): the agent-endpoint DRAFT check
against a captured object; the idempotency-key PK collision that throws a raw `SqliteError` **out** of
`dispatch` — reopening the crash class REG-F-011 closed, under contention; the deferred `BEGIN` under WAL that
returns `SQLITE_BUSY_SNAPSHOT`, which `busy_timeout` does not retry; and the authoring turn's whole-store event
counter, which is **correct** but serializes the entire workbench — professional B acting on an unrelated PWU
destroys professional A's 60-second agent turn, reported under a pseudo-aggregate no professional can act on.

## 4. Sequence — each increment separately acceptable

| # | Increment | Why here |
|---|---|---|
| **D-0** | Measure the evaluator=executor question (§0.2) and record the answer | decides whether D-3 is a hole or a fail-closed; costs one test |
| **D-1** | `Principal`, the `authenticate` port, the fail-closed stage, engine stamps `issuedBy` | the gate PER-3 requires |
| **D-2** | The demo host supplies a real session principal; the five `ui-user` sites die | *"who did what"* becomes answerable |
| **D-3** | `roleId` + `tenantId`/`organizationId` fed from the principal (REG-D-026) | the sockets Platform plugs into |
| **D-4** | `AuthorityReference` gains a minting act and readers (REG-E-027) | delegation, human-to-deputy only |
| **D-5** | Authorization stage with a real refusing case | a gate that can fail |

**D-1 is the largest and it is not splittable**, because a half-built gate is worse than a disclosed absence:
it reads as protection. The migration cost is real and is stated rather than discovered — every engine
construction and every dispatch in the suite acquires a principal.

## 5. What this design does not claim

Not authentication: JPWB does not verify a credential, it *consumes a verified one* (DOC-002 §1 — Platform
*"supplies machinery — infrastructure, runtime, identity, services, controls — never domain semantics"*). Not
an IdP, not tenancy semantics (N-9, §1.4, **not** §11.2 — see the correction filed against REG-D-026). Not
ASR-13's remaining six dimensions. Not the coordinator tier itself, only the actor model it will use.
