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

> ### ⚠ SETTLED 2026-08-07 BY A SECOND ADVERSARIAL PASS — AND NOT BY THE RULE I EXPECTED
>
> I framed the API question as *"does a credential on the command envelope violate DOC-004 §5?"* **It does not,
> and conceding that is what makes the answer trustworthy.** §5 prohibits a **source of derivation**, not a
> location of bytes: under an envelope-credential design the engine derives the principal from the *port's
> verification result*, and the token is an input to authentication rather than the principal context itself.
> **PER-3 is neutral too** — its SCOPE clause cedes *"the exact pipeline ordering **and envelope**"* as
> repository shapes, mandating only the gate's existence.
>
> **What decides it is REG-Q-004, and it binds today.** REG-005 §1: an `OPEN` entry means *"live; **any recorded
> safe default binds**"*, and §3 makes every Section B entry OPEN unless stated. REG-Q-004's safe default:
> *"Serialize the repository's generated envelopes exactly. **Enforce tenant/principal scoping through
> authenticated transport**, repository, and RLS context. **A public-envelope addition requires a new schema
> version and coordinated code/storage/test change**; never create an unscoped path."* **JPWB-SPEC-001 §11.4.2
> restates it as a ratified SHALL.** The enforcement locus is named, and it is the transport — expressly not the
> envelope.
>
> **And the blast-radius argument inverts under measurement.** `DomainCommand` is a closed, versioned wire
> contract (`additionalProperties: false`, `$id …DomainCommand:1`) and therefore CON-000 B1 shape authority, so
> an envelope credential is a **`DomainCommand:2` contract change** — larger than an in-process signature change,
> not smaller. It would also version a wire that has **no traffic**: measured, *no command envelope crosses a
> process boundary anywhere in this repository*. Every page route reads `request.formData()`; the envelope is
> built server-side. **The real trust boundary is the HTTP request into the SvelteKit server action** — exactly
> where REG-Q-004 puts it.

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
  constant in standalone — *present and singular*, never absent). ⚠ **Plus `modelId?`, `providerId?` and an
  execution-instance id for AGENT/MODEL principals** — omitting them would leave ASR-13's `DIFFERENT_MODEL` and
  `DIFFERENT_PROVIDER` rungs unable to resolve an identity, and `differs()` fails closed on an absent id, so the
  rungs would refuse *every* actor rather than compare.
- **⚠ `AuthenticationOutcome`, NOT `Principal | null`.** A bare `null` discards the reason, and DOC-004 §5
  requires typed errors while §7.2 requires a denied transition to carry its guard result. The port returns
  `{ ok: true, principal } | { ok: false, reason }`.
- **⚠ `Credential` is a BRANDED opaque type.** A caller must be able to *present* one and unable to *author* one.
  This is why `dispatch(command, principal)` is rejected outright: a `Principal` is authorable by anyone who can
  type an object literal — the same self-assertion moved one parameter out. A context object
  (`{ credential, tenantId, … }`) is rejected for the same reason, and additionally because REG-D-026 requires
  the scope axes be *derived*, never supplied.
- **⚠ THE CREDENTIAL GOES FIRST on `dispatchBatchGuarded`, not last.** It already has four positional parameters,
  two of them optional; appending a fifth reproduces exactly the defect `dispatch-expected-revision.test.ts`
  exists to catch — an argument *"accepted and dropped on the floor"*. This is the one signature choice that
  cannot be undone cheaply.
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
it reads as protection.

### ⚠ D-1 AS ORIGINALLY SCOPED WOULD MAKE THINGS WORSE, AND THIS IS THE MOST IMPORTANT FINDING OF THE PASS

**The broker inversion.** `broker.ts:241` defaults the authoring agent to `actorType: 'AGENT'`, and
`makeAuthoringBroker` never overrides it. **Once the engine stamps `issuedBy` from the session principal,
`this.actor` (`broker.ts:792`) becomes dead** and every agent-authored command silently acquires the **HUMAN
session identity**. That is machine authority arriving by accident — the exact back door REG-E-027 closes by
keeping delegation human-to-deputy.

**So D-1 would convert forgeability from ARCHITECTURAL to LIVE**, inverting §0's finding in the increment
that exists to close it. **D-1 therefore MUST include the broker presenting its own AGENT credential**, in the
same commit. The increment is bigger than I scoped it, not smaller.

**The seed inversion.** `openWorkbench` seeds at construction and `reference-undertaking.ts` account for **80.7%
of all measured dispatches**; both run before any session exists and cannot use a request-scoped principal
(`getRequestEvent()` throws outside a request). They need an explicit **SYSTEM** principal. If they are handed
`ui-user` for convenience, D-2 is defeated at the largest site by volume and the evaluator=executor collision
in §0.2 gets *worse*.

**The silent-bypass hazard that decides one signature.** `verif/unread-refusal-guard.ts:53-74` monkey-patches
`Engine.prototype.dispatch` with a **one-argument signature** and is a `setupFiles` entry for **every** project.
If the credential is OPTIONAL this patch drops it suite-wide: every test dispatches with no credential, every
test still passes, and the increment is vacuous with a green suite. **The credential must be a REQUIRED
positional parameter with no default**, so the suite goes red loudly and the fix is one line.

### Blast radius — measured, and the migration is mechanical

**284 executed dispatch sites across 102 files** is the planning number. Not 30,123 dispatches (75.9% of which
come from a single line), and not the 16,609 I quoted earlier, which was neither. **A site that dispatches once
costs the same edit as one that dispatches 22,869 times.**

- **91.1% of construction sites are reused builders**; in production it is **5 builders and 0 one-offs**.
- **88 of the 102 dispatching files need ONE edit each** — their helper builds *and* dispatches.
- **14 files need a per-file rewrite** covering 190 sites; `pwu.test.ts` alone holds 87, because its `cmd()`
  only builds.
- **~8 files need real thought**: those that vary the actor per dispatch (they need a credential→principal map)
  and those whose *subject* is the envelope contract.

### Two hard dependencies, stated rather than discovered

1. **`issuedBy` is REQUIRED on a `z.strictObject` and enforced in production** since REG-F-011. Until it becomes
   optional — a generated-contract change under B1 shape authority — **100 test files keep authoring an issuer**,
   and the laundering shape stays one keystroke away in each. If that is deferred, D-1 ships with the standing
   guard doing all the work alone, and **that must be the disclosed posture, not a discovery**.
2. **There is no ratified error code for an authentication refusal.** The fifteen ratified codes have none, and
   `command-bus.ts:234-238` records the precedent verbatim: minting one *"is a sponsor act"*. Use a ratified code
   and carry the label in the message, or get a ruling. **Do not quietly extend the enum.**

### And D-1 does NOT close the evaluator=executor hole — a reader will assume it does

`checkIndependence` is called on producer/evaluator read from **state and payload**, never on `command.issuedBy`.
**Authenticating the dispatcher does not authenticate the evaluator named in a payload.** REG-E-032 stays open,
and D-1's record must say so or *"the trust boundary landed"* will be cited as having closed it.

## 5. What this design does not claim

Not authentication: JPWB does not verify a credential, it *consumes a verified one* (DOC-002 §1 — Platform
*"supplies machinery — infrastructure, runtime, identity, services, controls — never domain semantics"*). Not
an IdP, not tenancy semantics (N-9, §1.4, **not** §11.2 — see the correction filed against REG-D-026). Not
ASR-13's remaining six dimensions. Not the coordinator tier itself, only the actor model it will use.
