# DESIGN — JAN-EXEC: an Undertaking that builds a real product, and the four seams that stand between here and there

**Programme:** `JAN-EXEC` · **Status:** DESIGN (rev 1) · **Opened:** 2026-09-14 ·
**Spike:** branch `spike/tool-execution`, commit `5b928583` — throwaway, not proposed for merge ·
**Evidence:** an 8-area driven probe (`wf_65dedb16-5c2`) and a live-model spike (`wf_714df9cb-ab2`).

**SPONSOR STATEMENT OF INTENT.** *"Give the PWA authoring agent the task of creating a PWA something similar to
the JanumiCode v2 product realization lens phases and sub-phases and equivalents of assurance policies, to then
have that PWA execute as an undertaking to build say a simple product with all of the expected engineering aspects
like unit and end to end testing."* And the doubt that opened it: *"I have my doubts about that actually running
end to end including the assurance policies as well."*

⭐ **THE DOUBT WAS JUSTIFIED, BUT NOT WHERE IT WAS AIMED.** Authoring works today, live. Execution is a
text-in/text-out seam with no hands.

---

## 1. What already works, measured — and must not be rebuilt

A live drive of the sponsor's own prompt against `POST /pwa/{id}/agent` (openai-codex/gpt-5.6-sol, 8m15s):

| | |
| --- | --- |
| tools called | `get_pwa` · `list_pwu_types` · `list_assurance_policies` · `scaffold_graph` · `review_composition` · `declare_rationale` |
| graph authored | **39 PWU Types** in ONE atomic `scaffold_graph` |
| shape | `Product Realization` → 3 areas → 7 phases → sub-phases; **depth 5, 27 leaves** |
| assurance | **38 of 39** carry `requiredAssurancePolicyIds` from the ACTIVE library |
| the floor actually fired | REJECTED · 1 valid reasoning finding → auto-refinement → SATISFIED |
| safety | candidate staged at `sha256:90b0cf09…`; **canonical DRAFT unchanged until a human accepted the exact hash** |

Then `submitForReview` → `validate` → `publish` reached PUBLISHED. ⛔ **Nothing in this programme may regress
any of that.** The authoring plane is the reference for how the execution plane should behave: tools minted from a
broker, builtins disabled, an independent assurance review, and a human-accepted content hash before anything
canonical moves.

---

## 2. The four blockers, each established by driving rather than reading

**B1 — THE EXECUTING MODEL HAS NO HANDS.** `openPiExecutionSession` passes `noTools: 'builtin', customTools: []`.
Asked to write a file and run a command, the live model answered
`{"workProduct":"NO_TOOLS_AVAILABLE","limitations":["I did not create PROOF_OF_WRITE.txt.","I did not run `echo ran`."]}`
and `existsSync(...) = false`. The alternate adapter (`agy --print`) returned 0 bytes with
*"a tool required the \"command\" permission"*. `TOOL_INVOCATION` is a ratified `StepType` and
`ExecutionFailureClass` already carries `TOOL_FAILURE` and `SANDBOX_FAILURE` — **and nothing dispatches on it.**

**B2 — EVIDENCE NEVER LEAVES THE EXECUTION PLANE.** Every production `CompleteExecutionStep` passes
`proposedEvidenceIds: []`. ⚠ **And this is NOT merely an unwired caller — that was my hypothesis and the spike
refuted it.** The one green proof that the join works (`execution-exe006-explicit-result.test.ts`) is pinned by
its own header as *"a NON-AI TRANSFORMATION with HUMAN provenance"* so the floor **cannot fire**. Driven with AI
provenance:

```
CompleteExecutionStep -> REJECTED  RPH_INVARIANT_VIOLATION
  the de minimis assurance floor is not SATISFIED for result evd_… at v1
  (floor.schema-invariant=MISSING, floor.identity-provenance=MISSING, floor.reasoning-review=MISSING)
  The floor is unconditional: no governance waiver discharges it.
```

**B3 — ASSURANCE JUDGES THE RECORD, NOT THE PRODUCT.** Driven: rewriting every `RecordArtifact` to
`contentHash: 'not-a-hash-at-all'`, `storageKey: '/does/not/exist'` → no refusal. Evidence with no content at all
→ SATISFIED. Separately, a PWU whose **declared** policy came back REJECTED with an OPEN BLOCKING finding reached
SATISFIED by citing an assessment under an unrelated policy. ⭑ To the repository's credit that last one is
already disclosed as `RPH-PWU-007` / `RPH-ASR-012`, both `kind: 'UNENFORCED_DISCLOSED'`.

**B4 — NO FAITHFUL RECORDING EXISTS.** The only committed `.jsonl` says of itself *"a HAND-AUTHORED transcription
of §26. The engine is never involved."* No `ProducerSession` replays a recording. ⛔ **And the recording that does
exist is not faithful:** `run-model-step.ts` reassigns `answer = envelope.workProduct` BEFORE `captureTry`, so
"raw output before coercion" stored **98 bytes against an actual 344-byte reply**; replaying it produced a
different run (`rationale` → `undefined`). The live-then-replay split needs that one-line fidelity fix before any
recording is worth committing.

---

## 3. Sponsor rulings — the decisions this design is built on

| # | ruling |
| --- | --- |
| R1 | **Real, runnable code on disk.** Source and tests written to a sandbox and actually executed; results flow back as governed evidence. |
| R2 | **Live models for validation, deterministic recorded replay for CI.** |
| R3 | **The seam belongs in the kernel as PORTS**, with adapters in the demo. |
| R4 | **Engine-side enforcement of declared policies first, then the `pol_test_adequacy` ratification** as a separate deliberate act. |
| R5 | **The target product is a small CLI or web app** — several modules, a real build, unit AND genuine e2e tests. |
| R6 | **A reasoning review reviews THE STEP'S REASONING, not the result.** |
| R7 | **stdout and stderr are both retained, and both come under purge.** |
| R8 | **The workspace is the DELIVERABLE and must persist** — durable, survives a restart, inspectable after the undertaking ends. |
| R9 | **The workspace boundary is ORGANISATIONAL now and SECURITY later** — the security tier belongs to the deployment environment, and the ports are the seam it supplies. Ruled 2026-09-14; see §4.8. |
| R10 | **A CONTRACTED rationale IS `PER-8` participating material — permanent.** Retaining the whole envelope as the answer half is therefore correct, and the permanence is CHOSEN rather than inherited. Volunteered reasoning stays separated under `PURGEABLE_AT_EXPIRY` (`PER-12`), which is the half that rule protects. Ruled 2026-09-15; see §4.9. |
| R11 | **`MODEL_EXCHANGE` gains BOTH the derivation link and the observed tool-call record, in ONE ratification act.** Ruled 2026-09-15; see §4.10. |
| R12 | **`process-execution` SUBSUMES `file-system` and `network`** — a child process is not confined by anything userspace can assert, so the only narrowing that bounds anything is the reverse one. Ruled 2026-09-15; see §4.3b. |
| R13 | **THE INTERPRETER IS NOT REFUSED — the fact is RECORDED instead.** Refusing `cmd.exe` while permitting `node -e` is theatre, and a later reader would mistake it for a containment property. Ruled 2026-09-15; see §4.3b. |
| R14 | **A THIRD FRAMING, ONE RUBRIC.** The reasoning review over a process result gets its own arm in both validators beside `ARTIFACT` and the PWA graph; the criteria still come from `floor.reasoning-review`. `R6`'s substance is the SUBJECT, not the rubric — so `ASR-4`/`REG-F-353` hold and no record misnames what checked it. Ruled 2026-09-17; see §4.12. |
| R15 | **`R6`'s SUBJECT IS THE EXISTING CONTRACTED RATIONALE, READ AGAINST THE ADAPTER'S OBSERVED TOOL CALLS.** The account already exists, is already permanent under `R10`, and needs no new producer and no untrusted-party field. Ruled 2026-09-17; see §4.12. |
| R16 | **THE PARTICIPATING MINT IS A CONTENT-PLANE ADDRESS NAMED BY `EvidenceObject.contentReference` — NO SECOND `ARTIFACT` OBJECT.** A test log is not a work product. Ruled 2026-09-17; see §4.12. |
| R17 | **TWO BLOCKING CODES, AND TRUNCATION IS NOT ONE OF THEM.** `PROCESS_OUTPUT_NOT_RETAINED` and `PROCESS_VERDICT_UNOBSERVED` block; a DECLARED prefix and an incomplete capture are recorded LIMITATIONS, because a declaration that travels with the bytes does not invalidate the exit code. Ruled 2026-09-17; see §4.12. |
| R18 | **EVERY COMPLETED RUN BECOMES ONE `EVIDENCE` OBJECT, TYPED `OBSERVATION`.** The host cannot tell which command was a test run, and a predicate over `argv` is the normaliser shape this seam has refused four times — so it records what it CAN say: it observed a command run and what it exited with. Calling `ls` a `TEST_RESULT` would be a claim about what the command WAS. Ruled 2026-09-17; see §4.13. |
| R19 | **THE MISSING LIMB IS ASYMMETRIC.** A declared policy that HAS a concluded verdict votes whatever its status — nothing already enforced is weakened. A policy that LACKS one is DEMANDED only if it currently GOVERNS (exists, ACTIVE, §5.1 applicability permits). *We do not stop counting a verdict we have; we do not demand one that could not lawfully be obtained.* Ruled 2026-09-17; see §4.14. |
| R20 | **THE EXECUTION PLANE IS DISCLOSED NOW AND TAKEN AS ITS OWN PHASE.** `CompleteExecutionStep` consults declared assurance NOWHERE, and the cause is structural — the floor set and the declarable set are DISJOINT BY CONSTRUCTION. Ruled 2026-09-17; see §4.14.4. |
| R21 | **`PromoteBaseline` IS FIXED IN PHASE 6.** Its “required assessments” come from the CALLER'S PAYLOAD — the same *controller selects its own evidence* defect `JAN-PWU007` closed on `ChangePwuState`, still open one gate over. Ruled 2026-09-17; see §4.14.5. |
| R22 | **THE DEMO GAINS AN ASSURANCE-REVIEWER PRINCIPAL, AND THE ASSESSMENT ACTS ARE ISSUED BY IT.** Every one of the ontology’s 15 PWU templates declares a policy demanding a reviewer distinct from the producer — 0 of 15 are single-actor satisfiable — and the demo signed off as both parties under a NONE-independence policy of its own. Naming the reviewer in a payload the operator’s session issues is FORBIDDEN (`REG-F-061`): the reviewer holds a credential and issues the command. Ruled 2026-09-18; see §4.15. |
| R23 | **AN ATOMIC ACT MAY HAVE MORE THAN ONE ACTING PARTY, AND THE KERNEL NOW SAYS SO.** `SPEC-001-INV-14` demands a multi-command affordance commit atomically; §39 inv-8 demands an independent reviewer; and `dispatchBatchAs` stamps ONE principal for a whole transaction — so the two rules were incompatible for every assurance act, and nothing had to notice while the surface reviewed its own work. `dispatchMultiPartyBatch` puts both parties in one transaction, each command stamped from its OWN resolved principal. Ruled 2026-09-18; see §4.16. |

---

## 4. The design

### 4.1 Two ports, and defaults that refuse rather than fabricate

`packages/rph-ports/src/ports/workspace.ts` — `Workspace`: `writeFile` / `readFile` / `list` / **`purge`**,
plus `ownerKind`, `materialization`, `directoryPath`, and an exported containment predicate.
`packages/rph-ports/src/ports/process-runner.ts` — `ProcessRunner`: `{ argv, cwd, timeoutMs }` → a **union**
outcome, not a result-with-an-error-field.

⭐ **THE UNION IS LOAD-BEARING AND THE SPIKE PROVED WHY.** A no-op default returning `{exitCode: 0, stdout: ''}`
is indistinguishable downstream from a command that ran and passed — a step, a test, or an assurance policy would
record a passing result nothing produced. The refusing default therefore **cannot** invent an exit code:

```
refusing runner -> {"ran":false,"refusedBecause":"No process runner is wired on this host, so 'node' was not run…"}
data (must carry NO exitCode): undefined
```

`timedOut` is likewise its own field, never inferred from the exit code — §36.2 separates TIMEOUT from
TOOL_FAILURE, and a SIGKILLed process on Windows reports `null`, not a distinguishable number. ⛔ **AND
"OBSERVED" MEANS ONE PARTICULAR OBSERVATION, WHICH PHASE 2b's ADVERSARIAL PASS HAD TO CORRECT (`B2`):** whether
the CHILD WAS STILL RUNNING when the budget ran out. Not what `child.kill()` returned — measured against one
already-exited child, bun answered `true` and node answered `false`.

⛔ **AND THE OUTCOME IS DERIVED FROM THE CHILD, NEVER FROM THE STDIO STREAMS (`B3`).** `close` waits on the last
pipe and a pipe outlives its child; a detached grandchild inheriting stdio held one open and `run()` was still
pending 9028ms after a 2000ms timeout. **A promise that never settles is worse than any wrong answer**, because
the whole premise of the union above is that a refusal is a fact a step can record. `run` always settles; when
the streams had not closed, `outputComplete: false` says so rather than letting a partial capture read as whole.

⛔ **THE NO-SHELL GUARANTEE HAS A PLATFORM PRECONDITION, AND IT IS KEPT BY A REFUSAL (`B1`).** `argv` promises
that no quoting rule applies — and Win32 cannot load a `.bat`/`.cmd` as a program image, so the runtime hands it
to `cmd.exe`, which re-parses `&`, `|`, `>` and `"` INSIDE arguments. Node closed this as CVE-2024-27980; **bun,
this repository's declared package manager, has no equivalent guard**, and the injection was DRIVEN under it —
including through a bare `npm`, which is a `.cmd` shim. ⭐ The class of target is REFUSED rather than the
argument escaped: this seam has already spent three rounds learning that every new normaliser is itself
attackable, and there is no `cmd.exe` quoting scheme this repository should be maintaining.

⚠ **THE TWO PORTS ARE NOT INDEPENDENT.** A `ProcessRunner` needs a real `cwd`; an in-memory workspace has none.
A host wiring a REAL runner against an IN_MEMORY workspace must be caught **before anything runs**, or the command
executes in some other directory — the one failure this seam must never have. Hence `materialization` on the
workspace, checked rather than trusted.

⛔ **AND THE CHECK BELONGS IN THE RUNNER, NOT IN A HELPER (`B8`).** `planProcessRun` derives a lawful request and
refuses the bad pairing early, and this design called it the sanctioned constructor — but `ProcessRunRequest` is
a plain interface, the function had **zero production call sites**, and a caller who simply filled in `cwd` ran a
command inside this repository. ⭐ **A CONVENTION WITH NO CALL SITES IS NOT A CONTROL.** The REAL runner is
therefore CONSTRUCTED against the deliverable workspace — the one directory it may run in — and refuses any
other `cwd`. Planning stays useful; nothing downstream may assume it was called.

⛔ **IN-MEMORY / REFUSING DEFAULTS SHIP BESIDE BOTH PORTS** so the repository gate stays hermetic: no existing
test gains a real filesystem or a real child process.

### 4.2 Workspace lifecycle — UNDERTAKING-scoped, and the host work is the real work

**RULED: `ownerKind = 'UNDERTAKING'`, durable root, survives restart (R8).**

⚠ **THE SURROUNDING CODE PULLS THE OTHER WAY, AND SILENCE WOULD DECIDE IT WRONGLY.** The producer session is
disposed per work unit (`producer.dispose()` in a `finally`), `beginExecute` mints a fresh plan+step per click,
and the only pre-existing filesystem scratch in production demo code is a `mkdtemp` created and removed inside ONE
call. **Every existing lifecycle in this repository is narrower than the undertaking.** Absent an explicit
ruling, the default that emerges is per-invocation — seven disconnected fragments instead of one product.

The spike measured the consequence directly: with one UNDERTAKING-owned directory, a **second step in a new
session with a new plan** ran `node greet.js` against a file the first step wrote, exit 0. Step-owned, that call
finds nothing.

⛔ **AND THE HOST HAS NOWHERE TO HANG SUCH A RESOURCE — THIS IS THE ACTUAL WORK, NOT THE PORTS.**
`getArtifactStore()` is a bare process singleton with no owner key; it gets away with that because it is
content-addressed and puts the tenant in the KEY. A workspace **cannot** be content-addressed — it is mutable and
path-named. It needs the same trick one level down: **one durable root, one subdirectory derived from the owner
id, resolved per request rather than held in process.** The spike held the object in memory, which is exactly what
a SvelteKit form action cannot do across requests.

### 4.3 Capability → tools: grant by ABSENCE · ⭐ LANDED 2026-09-15 (Phase 3)

**A tool the grant does not authorize is never minted, so the model is never told it exists.** There is no call to
intercept and no refusal path to get wrong. A capability check *inside* a tool handed to the model anyway is
strictly weaker: it depends on the check firing, and it advertises the privilege.

Proven live, with the precision half this repository has historically not tested:

```
~~granted ["network"] only        -> step REFUSED · model calls 0 · exchange records 0~~   ⛔ SEE BELOW
granted ["network","file-system"] -> minted ["write_file"] withheld ["run_command"]
                                     run_command calls = 0 · write_file calls = 1 · file on disk
granted ["file"] / ["file-syste"] / ["file-system-extra"] / ["FILE-SYSTEM"] -> minted []
```

⛔ **THE FIRST ROW DID NOT SURVIVE THE RULING THIS VERY SECTION MAKES, AND IT IS STRUCK RATHER THAN QUIETLY
CORRECTED.** The spike refused a `["network"]`-only grant because it treated EVERY requested capability as
REQUIRED — which is exactly the step-level reading the paragraph below says must NOT be chosen. Landing the
REQUIRES/USES split therefore had to change that row: with `network` granted, the step it REQUIRES is
authorized, so it **RUNS** — with **no tools minted at all**, because the two capabilities that authorise tools
were not granted. What refuses is a grant that omits `network` itself.

```
granted [] / any grant WITHOUT "network" -> step REFUSED · model calls 0 · exchange records 0
granted ["network"] only                 -> step RUNS · minted [] · the model is given no hands
```

⚠ **AND THE SPIKE'S ROW WAS THE STRICTER ONE, WHICH IS WHY IT LOOKED RIGHT.** A table that refuses more is easy
to read as the safer table; here it was the one that quietly overturned the ratified rule's own wording. Both
arrangements are asserted in `step-binding.test.ts` and `run-model-step.test.ts`, and `P3-e` is the mutant that
restores the spike's behaviour and reddens.

Exact membership, not prefix — it reuses the kernel's own `capabilityAuthorized`, the export a prior programme
proved exact. Containment refuses `../`, `a/../../`, absolute and drive-qualified paths.

⭐ **AND THIS RESOLVES RPH-EXE-004's OPERATION-VERSUS-STEP TENSION RATHER THAN CHOOSING A SIDE.** The ratified
rule says *"network OPERATIONS fail authorization"* — operation-level degradation — while
`stepCapabilityRefusal` refuses the whole step. Granting by absence **is** operation-level degradation: the model
keeps working with a narrower tool set and says so (`"commandRun":false,"missingTool":"shell/command-execution"`).
⚠ **Consequence for the plan:** `stepBindingFor` currently hardcodes `requestedCapabilities: [{capability:'network'}]`
for every model step. It must request **per step type**, and the design must distinguish capabilities a step
REQUIRES (ungranted ⇒ refuse the step) from those it can USE (ungranted ⇒ do not mint the tool).

### 4.3a ⭐ AS LANDED — what the spike promised, measured against a real model

⚠ **THE SPIKE'S TABLE HELD IN EVERY ROW BUT ITS FIRST, AND THAT ROW WAS STRUCK ABOVE** — it encoded the
step-level reading this design rules against. What was re-driven through the PRODUCTION seam against
`openai-codex/gpt-5.6-sol`:

```
granted ["network","file-system","process-execution"] -> minted ["write_file","run_command"]
                                                         greet.js 38 bytes on disk AFTER close
                                                         run_command: exit 0, stdout "hello from the sandbox"
                                                         record: OBSERVED, 2 calls, both MINTED_BY_HOST
granted ["network","file-system"]                     -> minted ["write_file"]  run_command WITHHELD
                                                         run_command calls = 0 · file STILL written
                                                         the model's own limitation: "No shell or Node
                                                         execution tool was available."
granted ["file"] / ["file-syste"] / ["file-system-extra"] / ["FILE-SYSTEM"] / [" file-system"] -> minted []
```

⭐ **THE SECOND ROW IS THE ONE THAT MATTERS, AND IT PRODUCED ITS OWN CORROBORATION.** The precision control's
sibling `…​.process-output/captures/` is EMPTY on disk while the full grant's holds three capture directories —
so *"no `run_command` call was observed"* is confirmed by *"no process output exists"*, a fact none of this
phase's instruments produced.

⛔ **AND THE RULING `R11` LEFT OPEN IS ANSWERED BY REMOVING ITS SUBJECT.** A host may not mint a name the record
plane cannot hold; `mintExecutionTools` validates the WHOLE catalog against `RecordPlaneNameSchema` and REFUSES
before a session exists. The three candidates `R11` recorded all act at RECORD time, after a model has been told
the tool exists and a call has been made; this acts at the one moment when the only party involved is the host.
Full reasoning, and the two disclosed bounds (a surface minted once per held session; the demo authorizing its
full request), in ROADMAP §5a.

⚠ **AND IT OPENED A RETENTION SURFACE THE REPOSITORY'S OWN GATE CAUGHT** — `run_command` hands both streams to
the model, so `REG-Q-066`'s stderr gate reddened and the disposition had to be written in the same commit. The
class follows `REG-D-050` (participation is a property of USE); the bytes land on the CONTENT plane, which
`PER-9` gives a removal path; and no byte reaches the RECORD plane, because `ObservedToolCall` has no field that
could hold one. The residual — a build echoing its environment, removable only by an E-6 redaction nothing here
performs — is stated rather than filtered, because filtering is a normaliser over arbitrary bytes.

### 4.3b ⭐⭐ RULED (`R12` / `R13`, sponsor, 2026-09-15) — the capabilities are NOT independent, and what granting `process-execution` actually confers

⛔ **`R12`, VERBATIM.** *"`process-execution` SUBSUMES `file-system` AND `network`. Driven: with `file-system`
WITHHELD the model got only `run_command` and wrote a file outside the workspace anyway, because A CHILD PROCESS
IS NOT CONFINED BY ANYTHING USERSPACE CAN ASSERT. The three capabilities are NOT independent and the vocabulary
currently presents them as if they were."*

⛔ **`R13`, VERBATIM.** *"DO NOT REFUSE THE INTERPRETER; RECORD THE FACT. … Refusing `cmd.exe` while permitting
`node -e` is THEATRE, and worse, a later reader would mistake the refusal for a containment property. Record
instead that `process-execution` means ARBITRARY CODE AS THE SERVER USER, and that `R9`'s deployment tier is the
only claimed boundary."*

⭐ **WHAT THIS CHANGES IS WHAT §4.3 MAY BE READ AS CLAIMING.** §4.3's table is still correct — every row of it was
re-driven — but it is a table about **THE TOOL SURFACE THIS HOST OFFERS**, not about what the model can reach:

| grant | what §4.3 says, and it is true | what `R12` adds, and it is also true |
| --- | --- | --- |
| `["network","file-system"]` | `run_command` WITHHELD; run_command calls = 0 | the model genuinely cannot start a process — **this narrowing bounds something** |
| `["network","process-execution"]` | `write_file` WITHHELD; write_file calls = 0 | **the model writes files anyway, outside the workspace.** A tool was withheld; no ability was |
| `["network"]` | nothing minted; the step RUNS with no hands | unchanged — with no child, userspace assertions are all there is |

⭑ **SO THE ONE NARROWING THAT BOUNDS ANYTHING IS *"may write, may not run"*, AND THAT IS WHY `process-execution`
STAYS ITS OWN CAPABILITY** rather than being collapsed into `file-system` — §6 item 1's reasoning survives the
ruling, for a reason the ruling supplies. ⛔ **WHAT IS NOW SAID TO BE INEXPRESSIBLE IS THE CONVERSE:** *"may run,
may not write"* is not a state this or any userspace grant can produce.

⛔ **NO BLOCKLIST WAS ADDED, AND THE DEFERRAL THAT ASKED FOR ONE IS CLOSED BY THE RULING RATHER THAN BY CODE.**
`child-process-runner.ts` already recorded *"a model naming `cmd.exe` or `powershell.exe` AS THE PROGRAM gets a
command interpreter, because it asked for one. That is an argv policy belonging to the phase that lets a model
choose an argv"* — Phase 3 is that phase, and the answer is the FACT rather than a refusal. ⚠ **The `.bat`/`.cmd`
refusal is untouched and is NOT that blocklist:** it exists because Win32 re-parses a batch command line so that
an ARGUMENT becomes a command, which is a defect in the no-shell guarantee this code MAKES.

**WHERE IT IS RECORDED**, because a ruling that lives only in a design document is one nothing can check:

- `STEP_CAPABILITY_VOCABULARY` — every note, plus a **`subsumes` field** carrying the containment as DATA, so a
  later entry that forgets its relation to the others is a visible omission. Asserted in `step-binding.test.ts`.
- `enforcement-register.ts['RPH-EXE-004']` — the `why` now narrows *"granting by absence bounds WHICH KINDS of
  operation a step may perform"* to the host's tool surface, and names `R9`'s tier as the only claimed boundary.
- `execution-tool-surface.ts` and `child-process-runner.ts` headers, where the tool is minted and where the
  deferral was originally written down.

⚠ **AND THE HONEST CONSEQUENCE FOR THIS DESIGN: `run_command` IS THE DEPLOYMENT DECISION.** §4.8 rules that the
security boundary is the deployment environment's; `R12`/`R13` say which grant makes that boundary the ONLY one.
A deployment that mints `run_command` without OS-level isolation has no containment, and nothing in this
repository can give it any.

### 4.4 The evidence join — a second floor run, over the evidence

`proposedEvidenceIds` cannot simply be populated (B2). The evidence subject needs its own floor run.
~~`work-product-floor.ts` opens by recording that the floor validators *"do not inspect their subject … they judge
FACTS the caller supplies"* and that a run is *"a subject plus a context"* — so this is a **call site, not a
redesign.**~~

⛔ **THAT PREMISE IS REFUTED, AND IT WAS REFUTED BY READING THE VALIDATOR RATHER THAN THE COMMENT ABOVE IT.**
The comment is true of TWO of the three floor validators. The REASONING-REVIEW validator inspects
`subject.objectType` — `judgePrompt(input, subject.objectType === 'ARTIFACT')` at
`reasoning-review-validator.ts:298`, and the identical test at `mock-reasoning-review-validator.ts:176` — and the
test is BINARY, so every subject that is not an `ARTIFACT` takes the **PWA-graph arm.** A `TEST_RESULT` would be
handed to a reviewer told it is reading a canonical graph export, which is the misdescription
`reasoning-review-validator.ts:80-85` exists to record having already been committed once. See §4.11.

**R6 settles the limb that had no answer.** There is no model reasoning in `exitCode: 0` — the producer is `node`.
So the reasoning review's subject is **the step's own reasoning**: the model's account of why it ran that command
and what the result means. `schema-invariant` and `identity-provenance` judge the result itself.

⭑ This also keeps the evidence one step from the fact rather than two: the governed `TEST_RESULT` remains the real
exit code and output, not a model's retelling of it.

### 4.5 Retention — R7, and a question the repository asked before I did

⛔ **`verif/agy-stderr-unbound.test.ts` (REG-Q-066) REDDENED ON THE SPIKE, AND IT WAS RIGHT TO.** Its recorded
answer was *"CLOSED BY NON-USE"* — contingent on nothing binding `stderr`. Binding it creates the retention
surface the question was about. The hazard differs in kind (REG-Q-066 concerned a model CLI's stderr echoing
PROMPT content; this is a build's own diagnostics) but the SURFACE is identical, and that output goes into the
model's context and into the step record.

**R7: both streams retained, both brought under the same purge machinery as artifact content.** That is why
`Workspace` gains `purge` — which the spike shipped WITHOUT, and the artifact-store's own header explains why
that default is wrong: `purge` *"is the port's reason for existing, and `put` is what it enables."* Retention of
model-participating content is unlawful rather than merely unbuilt without it. ~~⛔ **The guard stays RED until this
lands; it is not to be silenced.**~~ ⭐ **LANDED 2026-09-14 (Phase 2b).** The guard was never silenced: it was
RE-POINTED from an ABSENCE onto the DISPOSITION, per its own message, and gained four limbs plus a driven
refusal it could not previously make. `REG-Q-066`'s stated bound is now **CLOSED BY DISPOSITION** — both
streams `PURGEABLE_AT_EXPIRY` in a SECOND workspace (the deliverable is `RETAINED_BY_PARTICIPATION` under
`R8` and its `purge` refuses), referenced by `ProcessRunOutcome.retention` so nothing is `REG-F-336` C-2's
orphan, and reachable by `Workspace.purge`. See `ROADMAP-undertaking-execution-sandbox.md` §4d.

### 4.6 Step type — MODEL_INVOCATION with tools

**A model choosing to run a command is a model invocation whose turn happened to use a tool.** Re-typing onto
`TOOL_INVOCATION` would be a governance regression, measured: with identical payloads differing in NOTHING but
`stepType`, `MODEL_INVOCATION` → REJECTED (floor MISSING ×3), `TOOL_INVOCATION` → ACCEPTED, SUCCEEDED — because
`floor-gate.ts` reads `AI_STEP_TYPES = {'MODEL_INVOCATION'}`.

⚠ **BUT THE RISK IS NARROWER THAN IT LOOKS, AND THE DIVERGENCE IS DELIBERATE.** `floor-gate.ts` ORs FOUR signals;
that test isolated signal 1 by stripping the other three. A real sandboxed step **must** run under a runtime
binding to hold its capability, so signal 3 fires regardless. And `execution-attempts.ts:29` documents its broader
set as *"deliberately distinct from the floor-gate signal."* ⭑ **Therefore: do NOT widen `AI_STEP_TYPES`** — that
would overturn a documented deliberate distinction on the strength of an artificial case. Instead, record the
dependency explicitly and guard it, so a future step type cannot quietly acquire hands without the floor.

`run-tool-step.ts` is NOT built now. `TOOL_INVOCATION` remains ratified-and-undispatched, which is a pre-existing
finding, not one this programme creates.

### 4.7 The tool-call record — the join between "a command ran" and "the record says so"

§22.1 says model output is untrusted external input, so *"the model said it ran the tests"* is not evidence that
tests ran. The spike added `ProducerSession.toolCalls()` so the **adapter** reports what it OBSERVED — that is
where its exit codes came from. ⛔ **But it lives in memory and reaches no record:** `captureTry` records the
prompt and the raw output, and nothing carries tool calls onto the `MODEL_EXCHANGE` or the step. **Unbuilt, and
required** — without it the governed record rests on the model's word.

### 4.8 ⭐ RULED (R9, sponsor, 2026-09-14) — the containment tier, and why `Workspace`/`ProcessRunner` are PORTS

**THE RULING, VERBATIM.** *"It's both organisational and security with organizational now and security later.
Specifically with the security later, on the under-development Janumi Platform which will be one of the target
deployment environments for JPWB, it will use technology like Alibaba's OpenSandbox and / or Nvidia's OpenShell.
But JPWB can also run in a Visual Studio Code extension setup as well. So from local to SaaS to Enterprise."*

⭐ **WHAT IT CHANGES IS WHAT THE CODE MAY CLAIM, NOT WHAT IT MUST DO.** Phase 2's containment is an
**ORGANISATIONAL** boundary: one Undertaking's work lands in ONE place a person can inspect, a step cannot
scatter it through the server's own source tree, and the ordinary mistakes — a stray `../`, an absolute path, a
name Win32 rewrites, a device, a stream — are refused with a fact a step can record. ⛔ It is **NOT** a security
boundary against an adversarial model, it cannot be made into one by comparing path strings in userspace, and
this seam's own history is the evidence. The set of spellings the predicate has had to learn grew one adversary
at a time — `..`, both separators and a drive letter (Phase 1); then a trailing dot, a Win32 device stem and a
colon, and the retention record's CASE (§4b); then the record's NTFS 8.3 alias (§4c) — and each was the SAME
location wearing a name the comparison did not recognise as that location. ⛔ Two more were then driven and are
NOT closed at all: a HARD LINK and a ROOT SWAP.

**THE THREE TIERS, AND THE ONE SEAM THAT SERVES ALL THREE.**

| tier | where JPWB runs | who draws the security boundary |
| --- | --- | --- |
| **LOCAL** | a Visual Studio Code extension host | the extension host's own process and workspace-trust model |
| **SaaS** | the Janumi Platform | **OS-level sandboxing** — Alibaba's **OpenSandbox** and/or NVIDIA's **OpenShell** are the named candidates |
| **ENTERPRISE** | a customer's own deployment | container isolation (the corpus names K8s Jobs + gVisor as one shape) |

⭑ **AND THIS IS WHY THEY ARE PORTS AT ALL.** `Workspace` and `ProcessRunner` are the seam a platform sandbox
SUPPLIES: an adapter backed by OpenSandbox, by a gVisor-isolated Job, or by the extension host satisfies the
same two interfaces, and every consumer — `planProcessRun`, `producerWorkingDirectory`, the retention record —
is written against the interface rather than against `node:fs`. Replacing the adapter is how the security tier
is taken up; nothing above it changes.

⚠ **THE CORPUS ALREADY ANTICIPATED THIS, AND IT IS NOT AN INVENTION OF THIS RULING — VERIFIED BEFORE IT WAS
CITED.** `packages/rph-contracts/vocab/m1-object-fields.json` records the object `SandboxPolicy` (referenced by
`RuntimeBinding.sandboxPolicy`) with its single field `(undefined)` and the note:

> *"DEFERRED TO THE PLATFORM POLICY PLANE — dispositioned 2026-07-26 (JAN-CAPBIND-DS-001 §6), not 'Source TBD'.
> … the sandbox backend sits behind an abstracted runtime boundary precisely so the concrete tool (OpenSandbox /
> K8s Jobs+gVisor / a harness's own policy file) stays swappable. Authoring a shape here would therefore either
> encode one tool's model — the lock-in that boundary exists to prevent — or invent a scope algebra the corpus
> does not define."*

⭐ So the ruling and the ratified vocabulary agree: the sandbox POLICY is a reference into a policy plane that
is not yet settled, and the sandbox MECHANISM is the deployment environment's. §6 item 1 of this design already
leaned on the same note for the capability-name question.

**THE CONSEQUENCE FOR WHAT THE ADAPTER DISCLOSES.** `filesystem-workspace.ts`'s header now names five vectors
and says for each whether it is REFUSED, OPEN, or merely UNREPORTED, rather than asserting a guarantee it does
not have. Two of them — a **hard link** and a **root swap** — are OPEN and need no privilege whatever; both were
driven unprivileged on this host and both are carried by DISCLOSURE PROBES in the adapter's suite, so a later
change that closes one reddens a test and forces the disclosure to be rewritten rather than quietly outliving
it.

⛔⛔ **AND `R12` CHANGED THE PREMISE OF ONE OF THOSE DISCLOSURES, WHICH IS A DIFFERENT EVENT FROM THE BEHAVIOUR
CHANGING (`B-6`).** The hard link was disclosed as an exposure to *a party with filesystem access* — which reads
as a party OTHER than the step, something already on the host. Since Phase 3 **the executing model IS that
party**: `run_command` is arbitrary code as the server user, so the model plants the link itself, writes through
the CONTAINED `write_file`, and `list()` reports another undertaking's file as this workspace's own entry. ⭐ The
WRITE is now a stated property and this adapter cannot take it back. **The false INVENTORY is not a stated
property of anything** — a workspace reporting a file it does not exclusively hold is a RECORD-plane defect
regardless of who could reach it — so `WorkspaceEntry` gained **`nameCount`**, the filesystem's own count of the
names holding those bytes. ⚠ It reports SHARING and never LOCATION, and the suite proves that limit rather than
asserting it: a lawful second link INSIDE the workspace reports the same `2`.

⚠ **AND THE TWO TOOLS ONE MODEL HOLDS DISAGREE ABOUT THE ROOT SWAP (`W-6`), WHICH NOBODY HAD TO STATE BEFORE
PHASE 3.** `write_file` WRITES through a swapped root while `run_command` REFUSES — the asymmetry §4f explains,
and a property rather than an effort gap. Both halves were disclosed separately and both are still true; what was
missing is that ONE party now holds both, so the joint statement lives in `execution-tool-surface.ts` where that
party's surface is minted: **writes succeed, commands refuse.**

⛔ **AND THE ROOT SWAP WAS THEN DRIVEN THROUGH THE `ProcessRunner`, WHICH IS A DIFFERENT SEAM AND A DIFFERENT
ANSWER (`B11`, §4f).** A junction standing where the deliverable directory was made a LAWFUL `cwd` execute a
command in the tree it pointed at. ⭑ THE RUNNER CAN CLOSE THIS FOR ITS OWN ACT AND THE WORKSPACE CANNOT CLOSE IT
FOR HERS, and the reason is worth stating because it is a property rather than an effort difference: the runner
compares the RESOLVED `cwd` against the directory the host DECLARED — the one name a swap cannot move — while
containment inside a workspace is necessarily *is this child path under that ROOT*, and a swapped root resolves
consistently for every child under it. ⚠ **SO THE WORKSPACE'S DISCLOSURE IS UNCHANGED AND STILL TRUE:** a root
swap still redirects every read, write and listing THROUGH the workspace, its disclosure probes still pass, and
what is now refused is only the act of RUNNING A COMMAND in a directory the filesystem no longer agrees is the
workspace. ⛔ The general lesson is the one this section already argues: the fix was available because a
DECLARATION existed to compare against, not because one more string comparison was added.

⛔ **WHAT THIS RULING DOES NOT LICENSE.** It is not permission to stop refusing: the organisational boundary is
the thing that makes an Undertaking's deliverable findable and its accidents legible, and every refusal in the
adapter stays. It is permission to stop pretending — and to stop adding one more string comparison per
adversary, which is what §4.8 exists to end.


---

## 5. What must NOT happen

- ⛔ **No regression of the authoring plane.** It works live; it is the reference, not the subject.
- ⛔ **No default that fabricates.** No exit code from a command that did not run; no `materialization` assumed.
- ~~⛔ **No silencing of REG-Q-066.** Red until the retention disposition lands.~~ ⭐ **HONOURED — the
  disposition landed 2026-09-14 (Phase 2b) in the same commit as the binding, per roadmap rule 8, and the
  gate now checks the disposition rather than the absence.**
- ⛔ **No ratchet baseline regenerated to make a spike pass.** `POPULATION_CHANGED` on the new ports is honest
  bookkeeping and belongs in the commit that legitimately adds them, with their guards.
- ⛔ **No merge of `spike/tool-execution`.** It proved the seam; it is not the implementation.
- ⛔ **No moving `pol_test_adequacy`'s evidence into `requiredEvidence` as a code change.** A green conformance
  test (`doc004-conformance.test.ts:475`) forbids §17–§26 evidence reaching that field. Per R4 that is a separate,
  deliberate ratification act.

---

## 6. Ratification owed

0. ~~**Whether the workspace is a security boundary.**~~ ⭐ **RULED 2026-09-14 — R9, §4.8: organisational now, security later, and the security tier is the deployment environment's.**
1. **The process-execution capability NAME.** `file-system` is verbatim in RPH-EXE-004; for running a process the
   corpus names nothing — `CapabilityRequest.capability` is bare `z.string()`, and `RuntimeBinding.sandboxPolicy`
   is recorded as DEFERRED TO THE PLATFORM POLICY PLANE. The spike coined `process-execution`. ⚠ Collapsing it
   into `file-system` would be worse than coining: starting a process is strictly larger than writing a file, and
   merging them makes the grant unable to express the distinction the live precision control turned on.
   ⭐ **`R12`/`R13` (§4.3b) CONFIRM THE SHAPE AND DO NOT RATIFY THE NAME, and the difference is worth keeping.**
   The sponsor ruled on what granting it MEANS — arbitrary code as the server user, subsuming `file-system` and
   `network` — and that reasoning is what makes the separate capability worth having (*"may write, may not run"*
   is the one narrowing that bounds anything). The NAME remains an in-process authoring act under `G-1`, exactly
   as `CapabilityRequestSchema`'s deliberate `z.string()` allows; ratification is still owed.
2. ~~**REG-Q-066's retention disposition**, re-answered per R7.~~ ⭐ **DELIVERED 2026-09-14 (Phase 2b).**
   ⚠ `REG-Q-066`'s three readings of ASR-11's raw validator output stay OPEN and stay the sponsor's.
3. **`pol_test_adequacy`** (R4, second half), with its conformance rule amended in the same act.
4. **Whether workspace content is PER-8 participating material.** A test run that evidence cites certainly is.

---

## 7. Open questions this design does not settle

- **A read-back tool.** The model can write and run but not read; today it must shell out to see its own files.
- **A working-set budget.** The spike's 64KB capture cap is arbitrary and unratified.
- **The replay producer (R2).** A fourth `ProducerSession` answering from a committed recording — blocked behind
  B4's fidelity fix, because a recording of the wrong bytes replays a different run.
- ~~**Whether `stepCapabilityRefusal`'s step-level refusal should become REQUIRES/USES** (§4.3).~~ ⭐ **SETTLED
  AND LANDED** — REQUIRES refuses, USES withholds the tool (`P3-e` is the mutant).
- **A per-step resource budget** (`W-2`, ROADMAP §5b). No bound exists on call count, on total wall clock, or on
  bytes `write_file` accepts — driven: **40 MiB written in 48 ms**, 25 consecutive calls all accepted, two 1.5 s
  commands costing 3144 ms because the timeout is per CALL. Under `R12` this is a RESOURCE question, not a
  containment one, and `RuntimeBinding.sandboxPolicy` — where a quota would live — is DEFERRED TO THE PLATFORM
  POLICY PLANE.
- **Whether a sandboxed step's child inherits the server's environment** (`W-3`, ROADMAP §5b). Driven: a success
  summary carried `USERNAME`, `USERPROFILE`, `PATH` and `TEMP` into the model's context and into the E-1
  composite, while the REFUSAL on the same tool discloses ONE path segment by design. ⚠ Under `R12` withholding
  it from the RESULT bounds the RECORD and not the model, so it is a RETENTION question whose load-bearing
  dependency is **E-6**, which has no producer.
- **e2e status.** Playwright was not run against the spike. Unknown, not assumed green.


---

## 4.9 ⭐ `R10` — a contracted rationale is permanent, and that was ruled rather than assumed

**THE QUESTION.** `R6`/Phase 0 made the retained answer half the whole ENVELOPE, which carries `rationale`. So the
model's contracted reasoning is retained under `RETAINED_BY_PARTICIPATION` — permanent. Phase 0 recorded that as
OWED because *"the agent believes the hazard does not arise, but the sponsor should confirm rather than take its
reading."*

**RULED (2026-09-15): CONFIRMED.** A rationale the system ASKED FOR is part of the answer that was judged, not the
model's private thinking. ⭑ The distinction is one `execution-contract.ts` already draws — CONTRACTED ≠
VOLUNTEERED — and it is exactly the line §9.7 splits on: volunteered reasoning is still separated out under
`PURGEABLE_AT_EXPIRY`, which is the half `PER-12` exists to protect.

⛔ **THE CONSEQUENCE, STATED BECAUSE IT IS PERMANENT.** Once a contracted rationale is written, **nothing deletes
it** — no expiry, no retention policy, no erasure request reaches it. That is what the classification MEANS, and
it is now true of every execution step. It was confirmed with that consequence in front of the sponsor rather
than arrived at by the code being written that way first.

## 4.10 ⭐ `R11` — the declared relation becomes a typed field, bundled with the tool-call record

**THE QUESTION.** `R6` split the ARTIFACT (work product) from the exchange's ANSWER SPAN (envelope), so their
byte-equality no longer answers *"which bytes did the assessment rest on?"* for free. The link is therefore
DECLARED — today as a `WORK_PRODUCT_DERIVATION` fragment inside the free-text `parseOutcome.detail`.

**RULED (2026-09-15): IT BECOMES A TYPED `MODEL_EXCHANGE` FIELD, IN ONE ACT WITH THE OBSERVED TOOL-CALL RECORD.**

⭐ **WHY BUNDLED.** Two pending changes touch the SAME generated, ratified contract: this derivation link, and
§4.7's tool-call record (so *"a command ran"* is the ADAPTER's observation and not the model's word — §22.1 makes
model output untrusted external input). One deliberate ratification is cheaper and more reviewable than opening
`MODEL_EXCHANGE` twice.

⚠ **THERE IS NO BACK DOOR, AND IT WAS DRIVEN RATHER THAN ASSUMED.** `MODEL_EXCHANGE` is a `z.strictObject`; its
object, command and event payloads are byte-identical by design; all three are GENERATED (*"do not edit by hand.
Regenerate with `bun run gen:objects`"*) from `vocab/m1-object-fields.json` and `vocab/m3-commands-events.json`;
and the `extensions[]` escape hatch is UNREACHABLE from the command surface, already driven and recorded in
`REG-005`. So this is a vocab change, a regeneration and a ratification — in that order.

⛔ **AND `bun run gen` IS IN NO GATE STEP**, which this programme has already recorded as an open finding. A vocab
change that regenerates artifacts nothing compares against its source is exactly the drift that finding names, so
the freshness question arrives WITH this act rather than after it.

### ⭐⭐ `R11`, AS LANDED AND THEN REVIEWED — three stated guarantees that had to become true

The independent review of the landed act found **no problems and six weaknesses**, and three were one shape: a
**stated guarantee that read stronger than what was enforced**, inside a contract that is PERMANENT under
`PER-2` and governs a record `R10` has just confirmed is PERMANENT under `PER-8`.

⛔ **WHAT WAS SAID AND WHAT WAS TRUE.** *"A minted name is drawn from a closed set the HOST authored and cannot
carry model-chosen content"* — a host path, a username-bearing path, a credentials string, a NUL byte and a 200KB
blob were all ACCEPTED as `toolName` with `nameProvenance: MINTED_BY_HOST`, because the boundary checked whether
the DISCRIMINATOR and the FIELD agreed and never the name's CONTENT. *"BOUNDED: `calls` is capped at 32"* — 64
calls declaring their own `recordedLimit: 64` were ACCEPTED, because the cap was the producer's and the boundary
compared the list against a number the CALLER wrote. And the three free-text strings (`ObservedToolCallReport
.reason`, `WorkProductDerivation.reason`, `sourceField`) re-opened the door that having **no `arguments` field**
was designed to close.

⭐ **THE REPAIR IS A PROPERTY OF THE SHAPE, NOT OF A CALLER'S HONESTY**, and it lives in the CONTRACT rather than
in the handler, because a handler check governs one write path and a schema bound governs three — command
payload, materialized state, and event payload. Validating a name against the host's ACTUAL minted set was
considered FIRST and ruled out: the set is session-scoped, lives in an app adapter the host-agnostic kernel
cannot reach, and minting it into the wire vocabulary is refused by this repository's own position that no
ratified enum may name a tool, agent, provider, CLI or vendor because `PER-2` would make a deployment fact
permanent.

⚠ **AND THE HALF THAT IS STILL NOT ENFORCED IS SAID PLAINLY AND PINNED AS A TEST:** a host path and a
credentials-shaped string are still accepted inside a `reason`, because telling prose from a path is a
normaliser over an arbitrary string — the shape this programme already refused in Phase 2b `W1`. What warrants
that content is that its author is the HOST, which is a producer property the boundary does not check.

The full ruling, the driven evidence, the `W4` filing against `RPH-PER-010` and the `W5` correction are in
ROADMAP §4g.


---

## 4.11 ⭐⭐ PHASE 5, AS MEASURED — the evidence join is a PRODUCER, not a call site, and the roadmap's own premise was the first casualty

**HOW THIS WAS ESTABLISHED.** Six independent readers over the evidence lifecycle, the floor machinery, the
process-run bytes, the review criteria, the guard obligations and the predicted red — 179 findings — then 40
adversarial verifiers told to REFUTE every load-bearing claim rather than confirm it. **16 of the 40 were
refuted**, including three of my own summary's. What follows is what survived that, with the refutations folded
in rather than appended.

### 4.11.1 ⭐ WHAT IS ALREADY TRUE, AND IT IS MORE THAN THE ROADMAP CREDITED

⭑ **THE KERNEL GATE NEEDS NOTHING.** `completeExecutionStep` already unions the two id lists —
`const resultIds = [...(p.outputArtifactIds ?? []), ...(p.proposedEvidenceIds ?? [])]` (`execution.ts:1397`) —
resolves each to a stored object at its own version, and loops `floorGateBlock` over every one. `stepResultSubjects`
**never reads `objectType` at all**, so an EVIDENCE id reaches the floor gate on exactly the same terms as an
ARTIFACT id. The docblock above it already names Evidence as a legal subject, citing §8.4.

⭑ **AND THE WHOLE SHAPE IS ALREADY DRIVEN AT BOOT — WHICH I HAD MISSED, AND A VERIFIER FOUND.** I wrote that all
three `CompleteExecutionStep` sites in the demo pass `proposedEvidenceIds: []`. **There is a FOURTH**, in the
reference undertaking the demo seeds unconditionally (`workbench.ts:145` → `seed-workbench.ts:464` →
`reference-undertaking.ts:764-773`): a `MODEL_INVOCATION` step completing with `outputArtifactIds: []` and
`proposedEvidenceIds: [evidenceId]`, its three floor policies recorded SATISFIED over the EVIDENCE subject first.
Because `send` throws on any non-ACCEPTED result, that completion really did clear `floorGateBlock` with an
EVIDENCE as the floor subject. ⚠ Its own comment records that it **BLOCKED on first run** — *"floor.schema-invariant=
MISSING, floor.identity-provenance=MISSING, floor.reasoning-review=MISSING"* — *"which is the gate working,
against me, correctly."*

⛔ **SO THE PRECEDENT IS NARROWER THAN IT LOOKS AND IT IS THE PART THAT MATTERS.** That seed **RECORDS** three
SATISFIED verdicts by dispatching commands. It does not **RUN** a validator over anything. It proves the COMMAND
SEQUENCE is admissible for an EVIDENCE subject; it proves nothing about whether any real validator can reach a
verdict there. Phase 5's whole content is replacing a hand-recorded SATISFIED with a computed one.

### 4.11.2 ⛔ THE BLOCKER THE EXTRACTION DOES NOT TOUCH — a third framing, not a second rubric

An `objectType: 'EVIDENCE'` subject takes the **graph arm** of both reviewers. Under `testMode` — the arm the gate
actually runs — `judge(content)` does `JSON.parse`, fails or finds no `nodes`, and returns
`unreadable(…)` → **`INCONCLUSIVE`, which BLOCKS.** So *extract-and-call-twice* yields a step that can never
complete, and the roadmap's stated PROOF (*"becomes ACCEPTED only once the evidence subject's own floor run is
SATISFIED"*) is unreachable by construction.

⭐ **AND THE FIX IS ALREADY RULED, IN THE FILE ITSELF, AGAINST THE SHAPE `R6` IS WORDED IN.**
`reasoning-review-validator.ts:87-90`, verbatim:

> ⚠ **TWO FRAMINGS, ONE RUBRIC.** The criteria still come FROM THE POLICY: `ASR-4` holds that policy meaning is
> stable across validator replacement, so what varies with the subject is how the review is CONDUCTED, never
> what the policy means. Inventing a second rubric here would be the restated-vocabulary defect `REG-F-353`
> names — *"a second way to say one thing is how restated vocabulary comes to disagree."*

⛔ **AND A MECHANICAL CONSTRAINT MAKES THE SECOND-RUBRIC READING NOT MERELY UNWISE BUT UNRECORDABLE.**
`ValidatorResult.policyId` is typed `FloorPolicyId` (`floor.ts:101`) and `reasoningReviewResultFromJudgement`
hard-codes `FLOOR_POLICY_IDS.REASONING_REVIEW` (`validators.ts:243`). So an authored process-result rubric would
be **scored and recorded under `floor.reasoning-review`** — a policy object whose stored `criteria` are the nine
`RR-*` strings. The governed record would name a policy that did not supply the rubric. ⭑ That is *"a policy that
lies about what it checks"*, reached from the opposite direction by the increment that exists to stop it.

⚠ **THERE IS A SECOND REASON AUTHORING MORE CRITERIA IS NOT THE CONTROL IT LOOKS LIKE.** `validators.ts:230` maps
`outcome: f?.failed ? 'NOT_MET' : 'MET'` — **a criterion the judge never mentions is recorded MET.** There is no
`UNABLE_TO_DETERMINE` arm even though the ratified enum has one and `ASR-9` forbids treating undeterminable as
met. Authoring MORE criteria strictly ENLARGES the set that can be recorded MET without the judge having
addressed them. And the rubric passes through `excerpt(…, RUBRIC_MAX)` while the SCORE does not, so a longer
authored set silently drops criteria out of the prompt while still scoring them — and a dropped criterion is
scored MET. Filed; not Phase 5's to fix, but it is why *"author criteria"* cannot be the whole answer.

### 4.11.3 ⛔ `R6` NAMES A SUBJECT THAT HAS NO PRODUCER

`R6`: *"the reasoning review's subject is the step's own reasoning: the model's account of why it ran that command
and what the result means."* **MEASURED: that account does not exist as a field anywhere.** `run_command` takes
one parameter (`argv`). `ObservedToolCall` is a strict object of four fields — ordinal, provenance, name, outcome
— and carries no reason BY CONSTRUCTION (`R11`), with `additionalProperties: false` at both levels of the
generated schema. The envelope's `rationale` is one account per model TURN and its declared subject is *"how the
work product discharges the obligation in the instruction"* — not a command.

⚠ A rubric interrogating content the reviewer is never handed is the reviewer-misdescription defect
`reasoning-review-validator.ts:81-85` records having already been committed once. **So `R6` cannot be implemented
as worded without first minting its subject**, and which way that goes is §4.11.6's first question.

### 4.11.4 ⭐ WHICH OBJECT CARRIES A TEST RUN'S OUTPUT — the mechanism is already ruled; only the shape is open

Ratification item 1 asked *"which OBJECT, having done what past-tense act, carries a test run's files and
output."* ⭑ **The runner answers the mechanism itself, in its own header, naming this phase**
(`process-runner.ts:91-93`):

> ⛔ A later phase that PERSISTS the outcome must persist the REFERENCE and not the bytes, or it mints a second
> retention surface under no declared class — which is this same defect one plane over.

So the lawful move is **`ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')` at the moment of participation**,
never a re-label of the capture. ⭑ And the store makes that STRUCTURAL rather than disciplinary: the purgeability
is part of the storage key, so the participating copy and the `PURGEABLE_AT_EXPIRY` capture are two stored
objects and cannot collide. ⛔ Re-labelling the capture would retroactively falsify `R7` for every prior run.

⚠ **BUT THE PATH FROM THE RUN TO THE STEP IS SEVERED, AND THIS IS THE REAL WORK OF PHASE 5.**
`ProcessRunOutcome.retention` — the only field that names the durable bytes — **has no production consumer.**
`RUN_COMMAND.mint` builds its `data` from `exitCode`, `timedOut`, `durationMs`, `outputComplete` and drops
`retention` on the floor. The observer then discards even that: `since()` returns `{ name, outcome }` only, so
**the exit code of a model-run test suite exists nowhere after the turn ends.** Phase 5 must widen the tool
surface to carry the outcome out — which is a new seam, not a call site.

### 4.11.5 ⛔ THE FACTS HALF DOES NOT PORT, AND IT IS OUTSIDE THE EXTRACTION RANGE THE ROADMAP NAMED

The roadmap says extract `work-product-floor.ts:143-275`. `workProductFloorFacts` is at `:69-103` — **outside it**
— and three of its facts are wrong for an evidence subject:

| fact | how it is derived today | for a `TEST_RESULT` |
| --- | --- | --- |
| `schemaValid` | `splitAnswerSpan(subject.answer).located` — *is a model ANSWER SPAN locatable* | meaningless; and its violation code `WORK_PRODUCT_NOT_PARSEABLE` would be a **false statement about a non-work-product** |
| `hasProducer` | `subject.artifact.producingPwuId && producerModelId` | `EvidenceObjectSchema` has no `producingPwuId` and cannot; the evidence field is `producedBy` |
| `traceComplete` | `verifyExchangeContent` re-hashes the producing MODEL_EXCHANGE | a `node` run has no exchange — but under `R6` the reasoning under review is the MODEL'S, so the producing exchange IS the right one to re-hash |

⛔ **AND THE VIOLATION CODES ARE NOT COSMETIC:** each member of `invariantViolations` becomes a BLOCKING
observation code **verbatim**. That is ratification item 5, and it is reached by Phase 5's first line of code.

⭑ **ONE THING IS FORCED AND NEEDS NO RULING: `isAiProduced` MUST BE `true`.** `deMinimisFloorPlan` includes the
reasoning review only when it is, and `floorGateBlock` requires all three policies SATISFIED — so `false` yields
`floor.reasoning-review = MISSING` and blocks. **Both arms of the apparent dilemma block; only one is honest.**
Under `R6` the reasoning under review is the model's, so `producer.modelId` = the EXECUTING model is a true
statement and `DIFFERENT_MODEL` against the judge is decidable. The dilemma dissolves *because* of `R6`, which is
the second thing that ruling bought.

### 4.11.6 ⚠ WHAT THE MEASUREMENT PUT TO THE SPONSOR

1. **`R6` vs *"TWO FRAMINGS, ONE RUBRIC"*** — the roadmap says the criteria for a process result *"must be
   authored, not defaulted"*; the validator records the opposite position on `ASR-4`/`REG-F-353` grounds, and the
   `FloorPolicyId` type makes an authored rubric unrecordable without misnaming its policy (§4.11.2).
2. **`R6`'s subject has no producer** (§4.11.3) — narrow the review to the EXISTING contracted rationale read
   against the observed tool calls, or mint a per-command account (a `run_command` parameter, which puts an
   untrusted party in charge of the record's reason).
3. **Does the participating mint also become a governed `ARTIFACT` object**, or only an `EvidenceObject.contentReference`
   naming the content-plane address? `execution-model-invocation.e2e.ts:140` asserts `snap.artifacts` is length 1,
   so this is a deliberate red or a deliberate green, not something to discover.
4. **The invariant-violation codes for a process result** (ratification item 5, §4.11.5).

### 4.11.7 ⛔ THREE INSTRUMENT FINDINGS, FILED HERE BECAUSE PHASE 5 WOULD OTHERWISE RIDE ON THEM

- ⛔ **`guards:export` WALKS `packages/` ONLY** (`export-guard.ts:245`). `apps/rph-demo` is outside the obligation
  census entirely, and `apps/rph-demo` has **zero** entries in the per-file coverage floor baseline. So
  extracting `runFloorOverSubject` in place satisfies **rule 7 vacuously** — the gate would be green and nothing
  would have measured it. ⭑ Phase 5's guard must therefore be a REPORTED ROW from a named test, never a ratchet.
- ⛔ **THE GATE'S OWN E2E IS BLIND TO THIS PHASE.** `execution-model-invocation.e2e.ts`'s floor assertion is
  SUBJECT-SCOPED to the artifact, so a second floor run over an evidence subject **cannot redden it**. If Phase 5
  ships and that spec stays green, the green proves nothing about the join.
- ⛔ **`verif/evidence-gate-reachability.test.ts` CENSUSES TWO ARRAYS AND CALLS THEM PRODUCTION.** Its title says
  *"no production evidence requirement gates ASSESSING"* while its sources are `FLOOR_POLICY_DEFINITIONS` and
  `ontology.seedPolicies` only — blind to `DEMO_POLICY_PAYLOAD`, which a production route dispatches and which
  declares a `requiredEvidence` item. **Production declares 14, not 13.** Not Phase 5's defect and not its fix;
  recorded because Phase 5 was about to cite that census as a tripwire.
- ⚠ **`floor-fixtures.ts:99-103` SEEDS THE FLOOR POLICIES WITHOUT `'EVIDENCE'`** —
  `['PROFESSIONAL_WORK_ARCHITECTURE','PROFESSIONAL_WORK_UNIT','ARTIFACT']` — through the real handler. The two
  PRODUCTION seeders derive all 31 types, so production admits an EVIDENCE subject and **that fixture refuses
  it.** A Phase 5 test written into the `rph-application` execution-floor files would fail for a reason that has
  nothing to do with Phase 5.


---

## 4.12 ⭐⭐ `R14`–`R17` (SPONSOR, 2026-09-17) — the four Phase 5 rulings, and what each one REMOVED

⭑ **ALL FOUR TOOK THE NARROWER OPTION, AND THAT IS THE PATTERN WORTH NAMING.** Each ruling declined a change to
a ratified or generated contract in favour of a change to how this host CONDUCTS the work. Together they take
Phase 5 from *"a vocab change, a new floor policy, a new tool parameter and a second ARTIFACT"* to **one new
validator arm, one new facts derivation, and one mint.**

### `R14` — a third framing, one rubric

The reasoning-review validators gain a **process-result arm** beside the `ARTIFACT` arm and the PWA-graph arm.
⛔ **THE BINARY TEST IS WHAT MUST GO** — `subject.objectType === 'ARTIFACT'` with the graph as its false arm —
because a two-valued test silently routes every FUTURE subject into the graph arm too. The replacement selects
the framing by naming the subject, so a fourth subject kind is a compile-time hole rather than a silent
misdescription.

⭑ **AND THE RUBRIC DOES NOT MOVE.** The nine `RR-*` criteria still come from the `floor.reasoning-review` policy
object, so `ValidatorResult.policyId` keeps telling the truth. ⚠ `R6` is honoured in the half that was always its
content: **what the reviewer is told it is looking at**, which is `reasoning-review-validator.ts:80-85`'s own
statement of why framing is not cosmetic.

### `R15` — the account that already exists

The reviewer is handed the model's **CONTRACTED rationale** (permanent under `R10`) and the **adapter's observed
tool calls**, and asked whether the account squares with what was OBSERVED. ⭑ That is a real question with
existing inputs, and it is the one §22.1 actually licenses: the account is the model's word, the call list is
the ADAPTER's, and the review is the join. ⛔ **A `run_command` `purpose` parameter was declined** — it would make
an untrusted party the author of the record's reason, and `R11` removed exactly that surface from the record
plane by construction.

### `R16` — one mint, on the plane that has a removal path

`ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')` → `{storageProvider, storageKey, contentHash, byteSize}`
→ `EvidenceObject.contentReference`. ⭑ **NO second governed `ARTIFACT` object**, so
`execution-model-invocation.e2e.ts:140`'s `snap.artifacts === 1` stays green **for the right reason** rather than
by accident. ⚠ And the content hash is the part that earns its place: `ProcessOutputRetention` carries workspace
PATHS and no hash, so an evidence record naming only the capture could only be BELIEVED — the same argument
Phase 0 made for `WORK_PRODUCT_DERIVATION` carrying the whole address.

### `R17` — what makes a process result unfit to be evidence at all

| condition | disposition | why |
| --- | --- | --- |
| `retention.retained === false` | ⛔ `PROCESS_OUTPUT_NOT_RETAINED` — **BLOCKING** | the evidence would name bytes nobody kept |
| `exitCode === null` or `timedOut` | ⛔ `PROCESS_VERDICT_UNOBSERVED` — **BLOCKING** | there is no verdict to evidence; `null` means terminated by a signal, and folding it into a number asserts a termination nobody observed |
| `omittedRegions.length > 0` | ⚠ recorded LIMITATION | a DECLARED prefix travels with its declaration, so it does not invalidate the exit code |
| `outputComplete === false` | ⚠ recorded LIMITATION | same: the guarantee that nothing more was coming is gone, the verdict is not |

⭑ **THE LINE THE RULING DRAWS IS BETWEEN A SILENT PREFIX AND A DECLARED ONE**, which is precisely the
distinction `omittedRegions` was built to carry — *"`REG-D-057` requires the omission be declared with enough
structure to undo it, and a flag has none."* The runner's hazard sentence (*"a test result read off a SILENTLY
truncated stdout is a pass nothing produced"*) is about the silent case, and this seam has no silent case.
⛔ The strict reading was declined on measured grounds: capture is capped at 64 KiB per stream, so a real suite's
output is routinely a declared prefix, and blocking on it would mean **no real test suite could ever produce
admissible evidence.**


---

## 4.13 ⭐⭐ `R18` (SPONSOR, 2026-09-17) — the host records what it CAN say, and `evidenceType` is the place that discipline shows

**THE QUESTION.** A step's model may run `npm ci`, then `npm test`, then `ls`. **Nothing tells the host which was
the test run.** `ObservedToolCall` carries a tool NAME and `run_command` is one name for every command; the argv
is content-plane and the host is not the party that chose it.

**RULED: EVERY COMPLETED RUN BECOMES ONE `EVIDENCE` OBJECT, TYPED `OBSERVATION`.**

⭑ **`OBSERVATION` IS NOT A HEDGE — IT IS THE ACCURATE MEMBER.** What happened is that this host watched a
command run and recorded what it exited with. `TEST_RESULT` is a claim about what the command WAS, and the only
party who knows that is the untrusted one. ⛔ A predicate over `argv` — *does this look like a test command* — is
a normaliser over text an untrusted party chose, which is the shape this seam has now refused in five
consecutive rounds.

⚠ **AND IT COSTS NOTHING BEHAVIOURALLY, WHICH IS WHY IT IS A RECORDS-HONESTY DECISION RATHER THAN A DESIGN ONE.**
MEASURED: `evidenceType` appears in production at FOUR sites and **no production code branches on it** — not on
`TEST_RESULT`, not on any member. `SubmitEvidenceForAssessment` carries it optionally and never compares it to
the requirement's declared type. So the choice changes what the record SAYS and nothing else, which is precisely
when getting it right is cheapest and mattering most.

⛔ **EVERY COMPLETED RUN, INCLUDING ONES `R17` WILL BLOCK — AND THAT IS THE FAIL-CLOSED POSTURE, NOT AN OVERSIGHT.**
A run whose output was not retained, or whose process was killed, is minted as evidence and then **refuses its
own floor**. The alternative — minting only the runs that would pass — lets a step complete as though the killed
command never happened. ⭑ That is the rule `unassessableAiContentBlock` already states one plane over: *AI-produced
content may not enter the governed stream with nothing to assess.* A command that ran and cannot be assessed is
exactly that, and `R17`'s codes exist so the block is LEGIBLE rather than mysterious.

⚠ **THE COST, STATED: N COMMANDS MEANS N FLOOR RUNS AND N REVIEWER CALLS.** The bound is the observer's own
(32, the same as `R11`'s record-plane cap), and a step that runs many commands pays for each. That is a
resource question of the kind `W-2` already carries; it is not smoothed by minting fewer.


---

## 4.14 ⭐⭐ PHASE 6, AS MEASURED — the roadmap described a gap that was HALF shut, and the half still open is wider than it said

**HOW THIS WAS ESTABLISHED.** Four independent readers, 78 findings, then 32 adversarial verifiers — **14 of 32
refuted**. Then one thing no agent was allowed to do: **the bypass was DRIVEN.**

### 4.14.1 ⛔ WHAT THE ROADMAP GOT WRONG IN BOTH DIRECTIONS

§8 opens by calling `RPH-PWU-007` / `RPH-ASR-012` *"`kind: 'UNENFORCED_DISCLOSED'`"*. **Both rows read
`kind: 'ENFORCED'`**, closed by `JAN-PWU007` on 2026-09-14 — three days before this roadmap's Phase 5 landed —
with `rejectUnsupportedDeclaredSatisfaction` chained in `changePwuState`, driven, with mutants.

⭑ **AND THE ROADMAP'S OWN `DO` CLAUSE IS NOT WHAT THOSE ROWS ENFORCE.** It has three demands:

| demand | status |
| --- | --- |
| (i) assemble `assurancePolicyIds` ∪ the PwuType's `requiredAssurancePolicyIds` | ✅ **LANDED**, in one kernel join (`declaredAssurancePolicyIds`) shared with the engine's own determination. **H2 refuted — do not file it.** |
| (ii) refuse when any member **LACKS** a SATISFIED/CONDITIONALLY_SATISFIED assessment | ⛔ **OPEN.** What landed is the CONVERSE: refuse when a member **HAS** one that is stricter. |
| (iii) at the subject's **CURRENT VERSION** | ⛔ **OPEN**, and asymmetric with the floor gate, which DOES version-bind out of the SAME index. |

⭐ So the honest reading is neither *"Phase 6 is done"* nor *"Phase 6 is untouched"*: **the disposition is stale
and the rule is half-landed**, and rewriting §8 as either would be an error.

### 4.14.2 ⭐⭐ THE FINDING NOBODY HAD NAMED — ONE ACCEPTED COMMAND ERASES A REJECTION. DRIVEN.

Take the repository's own `RPH-PWU-007` refusal fixture — a PWU whose declared policy reads REJECTED, which the
ENFORCED guard refuses — and insert **ONE** command before the claim: a second `RequestAssuranceAssessment`
under the SAME declared policy, requested and left at `READY`.

```
PROBE request status:         ACCEPTED
PROBE claimSatisfied status:  ACCEPTED
PROBE final state:            workLifecycleState: SATISFIED, assuranceState: SATISFIED
```

⛔ **THE MECHANISM, AND IT IS TWO LINES.** `latestAssessmentByPolicy` returns the latest record per policy
**whatever its state** — correctly, and it says so, because for the floor gate an assessment still ASSESSING is
precisely NOT a satisfied floor. `declaredPolicyVerdicts` then `continue`s past a latest record that is not one
of the five concluded states **with no fallback to the previous concluded one**. The REJECTED verdict is still
in the store. It simply stopped being *latest*, and a skipped policy votes nothing.

⚠ **AND THE LIMB THAT DOES IT IS, BY THE REPOSITORY'S OWN MEASUREMENT, GUARDED BY NOTHING.** `RPH-ASR-012`'s
own `declaredMutations` records that deleting the `CONCLUDED_ASSESSMENT_STATES` filter **SURVIVED** every probe,
*"because every assessment these fixtures create is COMPLETED, so the limb is never reached with a lifecycle
value. It is a real limb guarded by nothing."* That note was written as a disclosure of weak coverage. It is
also, read one step further, the description of a live bypass — and nobody read it that way.

⭑ **MY FIRST PROBE WAS WRONG AND THE WRONG-NESS IS WORTH KEEPING.** It cited no assessment, so it was refused
by `rejectUnbackedDisposition` with `RPH_EVIDENCE_MISSING` — a refusal from a DIFFERENT guard, which proved
nothing about the one under test. An arrangement that trips the wrong guard is not evidence about this one.

### 4.14.3 ⭐ ONE RULE CLOSES ALL THREE, AND THE KERNEL ALREADY HAS IT

The erasure, the never-assessed case and the stale version are the SAME hole seen three ways: **a declared
policy with no concluded verdict bound to the subject's CURRENT version has not spoken.** §28.2's rung 3 —
*"any required assessment missing"* — is exactly that rule, it is ratified, and `aggregateAssuranceDisposition`
implements it already.

⛔ **IT IS UNREACHABLE FROM THIS CALL SITE TODAY, AND THAT IS MEASURED RATHER THAN INFERRED.**
`unsupportedSatisfaction` passes `assessed: true` for every element and passes only elements that HAVE a
disposition — so `missing` is ALWAYS empty and the `assessed` discriminator is **dead code** at this caller.

⭑ **SO THERE IS NO KERNEL CHANGE.** `AggregateInput` already carries `disposition?`, `assessed` AND
`applicable`, and the fold already excludes `applicable === false` because *"a policy determined NOT_APPLICABLE
requires nothing."* The caller simply stops hiding the missing ones and starts declaring applicability.

### `R19` — and why the asymmetry is not a compromise

| the policy | what it contributes |
| --- | --- |
| HAS a concluded verdict at the current version | `{disposition, assessed: true}` — votes, **whatever its status**. Unchanged; nothing enforced is weakened. |
| LACKS one, and currently GOVERNS | `{disposition: undefined, assessed: …}` → rung 3 → `UNASSESSED`, which is stricter than SATISFIED. **Refuses.** |
| LACKS one, and does NOT govern (absent, not ACTIVE, §5.1 excludes it) | `{applicable: false}` — filtered out of `required`. Silent, by the fold's own rule. |

⚠ **THE MODULE'S RECORDED OBJECTION IS ANSWERED, NOT OVERRIDDEN.** `declared-assurance.ts` declined rung 3
because *"folding an ABSENT assessment in makes `aggregateAssuranceDisposition([])` — which returns UNASSESSED
by design — into a COMMAND refusal that no PWU declaring zero policies could ever escape."* ⭑ **That case never
reaches the fold:** `rejectUnsupportedDeclaredSatisfaction` short-circuits on `if (declared.length === 0) return
undefined;` two lines above. The objection names the one arrangement the guard already excludes.

⚠ **AND THE VERSION LIMB'S DEFERRAL IS ANSWERED ON ITS OWN TERMS TOO.** It was deferred to `RPH-ASR-010`,
*"which lives on the ASSESSMENT path (`completeAssuranceAssessment` binding a version the subject is not at),
not on this one."* ⭑ Correct, and this is the OTHER path: a READER ignoring the version a verdict bound. Two
sites, two rules, and a refusal here carries rung 3's marker rather than `RPH-ASR-010`'s — so one arrangement
does not trip two guards.

### 4.14.4 ⛔ `R20` — THE SPONSOR'S ORIGINAL DOUBT, ANSWERED WITH A MECHANISM AND DISCLOSED RATHER THAN FIXED HERE

**`CompleteExecutionStep` consults declared assurance NOWHERE.** `floorGateBlock` maps over the module constant
`FLOOR_POLICY_IDS_REQUIRED` and over nothing else; `execution.ts` contains zero references to a declared policy.

⛔ **AND IT IS NOT AN OVERSIGHT — THE TWO SETS ARE DISJOINT BY CONSTRUCTION.** The engine REFUSES a floor id in
a declared list (`pwa-authoring.ts` forces `requiredAssurancePolicyIds` non-floor), so a custom declared policy
can NEVER be one of the three the execution gate iterates. **The intersection of {what an author may declare}
and {what the execution gate checks} is EMPTY.**

⚠ **AND THE SUBJECT IS WRONG TOO.** `floorGateBlock` runs per RESULT — the ARTIFACT / EVIDENCE ids a completion
names — while declarations live on the PWU and its PwuType, objects that path never loads.

⭑ **RULED: DISCLOSE NOW, TAKE IT AS ITS OWN PHASE.** `INV-5` (exec ≠ assurance) says a step completing is not
supposed to grant assurance, so extending the completion gate needs its own argument rather than arriving as a
rider on three unrelated fixes. ⛔ What is NOT acceptable is leaving it unsaid: the doubt is **correct as
stated** for the execution plane, and it is now written down with the trace.

### 4.14.5 ⭐ `R21` — `PromoteBaseline` HAS THE SAME DEFECT `JAN-PWU007` CLOSED, ONE GATE OVER

Its *"required assessments"* are `p.requiredAssessmentIds.map(…)` — **the caller's own list**. A promotion
naming NO assessments passes that arm vacuously. That is *"the controller selected its own evidence"*, verbatim
the sentence `declared-assurance.ts`'s header uses about the hole it was written to close.

⚠ **IT SURVIVES ONLY AS A MUTATION NOTE ON A ROW MARKED `ENFORCED`**, which is not a disclosure. ⭑ And the
subject join EXISTS here, unlike on the execution plane: the baseline's own frozen `itemObjectVersions` name the
objects, *"read from the object, not the promoting payload"* — the gate already does this for observations and
contested claims. **RULED: fixed in Phase 6**, same rule, same kernel call.

## 4.15 ⭐⭐ PHASE 6b, AS MEASURED — the demo's sign-off is a SELF-REVIEW, and the policy it chose is the thing that hid it

Phase 6 left `gate:fast` **RED** on three browser specs, and the commit said the red was the finding. It is —
but the finding is **larger than the sentence that commit could support**, and measuring it before writing any
code is what made the difference between a one-line id swap and the ruling below.

### 4.15.1 ⛔ WHAT THE REFUSAL ACTUALLY SAYS, VERBATIM

From `e2e-results/.../pwu-lifecycle…/error-context.md`, the alert the browser rendered:

> *"ChangePwuState would set PWU `pwu_…0D` assuranceState=SATISFIED, but a policy this PWU itself declares has
> not been satisfied. … yields composed disposition UNASSESSED … `pol_assumption_disclosure` has no assessment
> over this subject at all; `pol_decomposition_coverage` has no assessment over this subject at all;
> `pol_architecture_coverage` has no assessment over this subject at all; `pol_intent_preservation` has no
> assessment over this subject at all."*

Four policies, named. They arrive from the PwuType — `undertakings/+page.server.ts:234` copies
`type.state.requiredAssurancePolicyIds` onto the instance — and the type's list is the ontology's
`pwuTemplates[].defaultPolicyIds` for `ARCHITECTURE_DEFINITION`. Nothing here is invented by the demo; it is
ratified content, correctly instantiated.

Meanwhile `assurancePrelude` opens exactly one assessment, under `DEMO_POLICY_ID`, which is in **none** of those
four. So `R19` is doing precisely what it was built to do.

### 4.15.2 ⭐⭐ THE HALF THE COMMIT MESSAGE DID NOT REACH — TWO PIECES OF ONE BYPASS

The obvious repair is "assess the declared policies instead". ⛔ **It does not work, and the reason is the
finding.** `recordAssurance` completes its assessment with

```ts
producer: evaluator          // and evaluator === actingActor(uiSession())
```

— the operator recorded as **both** the producer of the work and its assessor. That is a self-review. It has
never been refused, because `demo-policy.ts` chose a policy that cannot refuse it, and **says so in its own
words**:

> *"independence NONE, so `completeAssuranceAssessment` skips the independence check (assurance.ts) and a
> SATISFIED disposition backs the PWU's assuranceState=SATISFIED hop without a separate reviewer identity."*

⚠ **Read together, those two facts are not two defects but one arrangement**: declare policies that demand
independence, and assess a *different* policy that demands none. Either half alone looks like a shortcut. The
pair is a bypass, and `R19` is what forced the halves into the same sentence for the first time.

### 4.15.3 ⛔ DERIVED, NOT ENUMERATED — NO PWU KIND IN THE ONTOLOGY IS SINGLE-ACTOR SATISFIABLE

⚠ The question *"is this one unlucky PWU kind?"* is the one worth asking, and hand-listing the answer is the
defect one level up. Derived over the whole ontology (`seedPolicies` × `pwuTemplates`):

| policy | independence | policy | independence |
|---|---|---|---|
| `pol_intent_fidelity` | `DIFFERENT_AGENT` | `pol_assumption_disclosure` | `DIFFERENT_INVOCATION` |
| `pol_requirement_coverage` | `DIFFERENT_AGENT` | `pol_intent_completeness` | `DIFFERENT_INVOCATION` |
| `pol_decomposition_coverage` | `DIFFERENT_AGENT` | `pol_fitness_for_purpose` | `HUMAN` |
| `pol_constraint_propagation` | `DIFFERENT_AGENT` | `pol_baseline_promotion` | `HUMAN` |
| `pol_architecture_coverage` | `DIFFERENT_AGENT` | `pol_historical_consistency` | `DIFFERENT_AGENT` |
| `pol_intent_preservation` | `DIFFERENT_AGENT` | `pol_test_adequacy` | `DIFFERENT_AGENT` |

**0 of 15 PWU templates can be satisfied by one actor.** Every template declares at least one `DIFFERENT_AGENT`
or `DIFFERENT_INVOCATION` policy. (`HUMAN` is *not* a blocker — `checkIndependence` tests
`evaluator.actorType === 'HUMAN'` and the operator is one.)

~~⭑ **AND NOTHING ELSE STANDS IN THE WAY, WHICH MATTERS.** All four of the PWU's policies carry
`requiredEvidence: []`, so Gate A admits everything and every assessment lands in `READY` directly. Independence
is not *one* obstacle among several — after `R19`, it is **the whole gate**.~~

⛔ **STRUCK 2026-09-18 — IT WAS TRUE OF THE FOUR POLICIES I MEASURED AND FALSE OF THE ONTOLOGY, AND THE BROWSER
FOUND IT, NOT THIS DOCUMENT.** The sentence generalised from `ARCHITECTURE_DEFINITION`, the one PWU kind the
failing spec happened to use. Derived over all twelve seeded policies:

| policy | `requiredEvidence` | `requiredForDispositions` |
|---|---|---|
| `pol_intent_fidelity` | **7** | `SATISFIED_ONLY` |
| `pol_intent_completeness` | **6** | `SATISFIED_ONLY` |
| the other ten | 0 | — |

⚠ **FOUR OF FIFTEEN PWU KINDS ARE AFFECTED** — `PRODUCT_REALIZATION`, `INTENT_AND_PRODUCT_DEFINITION` (13
requirements), `INTENT_DISCOVERY` and `PRODUCT_BOUNDARY`. This is the *derive, never enumerate* rule turned on
its author: I derived the INDEPENDENCE table over all fifteen templates and checked `requiredEvidence` on four
policies by eye. The correct statement is that independence is the whole gate **for the eleven kinds that
declare no gated evidence**, and for the other four Gate A stands behind it.

⭐ **AND THE REMEDY IS ALREADY RULED, IN GATE A's OWN MESSAGE**: *"Submit it (SubmitEvidenceForAssessment)
first, **or return a non-satisfied disposition**."* `earnAssurance` took the second route and said why — *"A
policy whose required evidence this undertaking cannot supply does not get the caller's requested SATISFIED —
it gets CONDITIONALLY_SATISFIED, which is what the evidence actually supports … asking for it and being
refused, or lowering it here, differ only in whether the drive tells the truth first."* Phase 6b does the same,
per policy, and folds the PWU's own assurance axis from the verdicts rather than asserting a constant.

⛔ **SO A `PRODUCT_BOUNDARY` PWU IN THIS DEMO REACHES `CONDITIONALLY_SATISFIED` AND NOT GREEN, AND THAT IS
CORRECT.** It is short thirteen pieces of evidence the corpus requires. Nothing in this phase invents them.

⛔ `DIFFERENT_INVOCATION` fails closed here for a second reason: `differs()` requires the field present on BOTH
sides, and no demo principal carries an `executionInstanceId` at all. `reference-undertaking.ts` already
recorded this exact trap —

> *"DIFFERENT_INVOCATION FAILS CLOSED when neither party records one — correctly: independence you cannot
> demonstrate is independence you do not have."*

### 4.15.4 ⭐⭐ `R22` (SPONSOR, 2026-09-18) — A SECOND PRINCIPAL, AND THE ACT IS **ISSUED** BY IT

**RULED: the demo gains an assurance-reviewer principal, and `recordAssurance` issues the assessment acts under
that credential.** The stamped `issuedBy` and the recorded `evaluator` then name the same party, and `producer`
stays the operator.

⭑ **PRECEDENTED TWICE IN THIS REPOSITORY, WHICH IS WHY IT IS NOT AN INVENTION.**

- `reference-undertaking.ts` already separates `ACTOR` (`owner-1`, `executionInstanceId: 'exec-production'`)
  from `EVALUATOR` (`evaluator-1`, `'exec-assurance-review'`), and its own header states the reason: *"the
  reference undertaking stamped `owner-1` as BOTH the producer of every artifact AND the evaluator of every
  assessment, so a real independence check … would have had to REJECT the canonical drive or be defeated to
  pass."* **That is the demo's position today, word for word.**
- `identity.ts` already holds the general rule: *"The workbench user, the authoring agent, and the seeder are
  DIFFERENT ACTORS and must resolve to different principals."* A reviewer is the fourth such actor, not a new
  kind of thing.

⛔ **WHAT `R22` DOES NOT LICENSE — AND THIS IS THE WHOLE DISCIPLINE.** It does **not** permit naming
`assurance-reviewer-1` as `evaluator` on a command the operator's session issues. That would be a literal
identity in a payload that no credential resolves to — `REG-F-061` exactly, the finding `actingActor()` exists
to have closed. The reviewer must **hold a credential and issue the command**, or the record is a forgery that
happens to satisfy a check.

⚠ **THE COST, STATED**: two parties acting is two transactions. `runSteps` is one atomic `dispatchBatch` under
one session, so the assurance acts and the controller's own state hops can no longer share a batch. ⭑ That is
not a regression to absorb quietly — it is what INV-5 looks like at the surface, and `recordBlockingFinding`'s
own header already argued the same shape: *"Two acts, minuted separately."*

### 4.15.5 ⭐ THE COMPANION GAP — A §20 VERDICT MAY NAME A POLICY IT WAS NOT MEASURED AGAINST

Measured while designing the fix: `completeAssuranceAssessment` reads `dispositionRecommendation`,
`subjectObjectIds`, `subjectSemanticVersions`, `evidenceConsideredIds`, `residualUncertainty`,
`recommendedControlActions`, `validatorId`, `validatorVersion` and `executionProvenance.evaluator` off the
`ValidatorResult` — and **never compares `validatorResult.policyId` to the assessment's own
`assurancePolicyId`**.

⛔ **THE CONTROL EXISTS ONE MODULE OVER AND NOT HERE.** `floor.ts:319` computes
`policyVersionMatches: r.policyVersion === p.policyVersion` and `classifyValidatorResult` refuses on it. The
general command path has no equivalent. `reference-undertaking.ts` passes `policyId: pid` per assessment and
records why — *"a ValidatorResult whose `policyId` did not match the assessment's would be a verdict attributed
to criteria it was not measured against"* — so the ratified drive already honours a rule nothing enforces.

⚠ **AND IT IS THE INVARIANT `R22`'s FIX DEPENDS ON.** Today the demo's single hardcoded
`policyId: DEMO_POLICY_ID` is accidentally consistent, because the assessment is under `DEMO_POLICY_ID` too.
The moment one action opens N assessments under N different policies, "each verdict names its own policy"
becomes a live obligation with nothing checking it. **RULED: closed in this phase, beside the fix that needs
it** — a guard whose population is empty today is worth nothing, and this is the commit that fills it.

### 4.15.6 ⭑ WHAT DELIBERATELY DOES NOT CHANGE

- **A PWU that declares nothing keeps `DEMO_POLICY_ID`.** `undertakings/[id]/+page.server.ts:898` proposes
  ad-hoc PWUs with `assurancePolicyIds: []`; `R19` has no opinion about them and neither does this phase. The
  else-branch stays byte-identical, so no existing spec changes meaning for a reason this phase did not argue.
- **The ontology is not edited.** The policies demand independence because the corpus says they do. Relaxing a
  ratified `independenceRequirement` to make a demo green is the trade this register exists to refuse.
- **`markSatisfied` is untouched.** It already refuses without assurance; that is the property the lifecycle
  spec is named after and it was never the thing at fault.

### 4.15.7 ⛔ FILED, NOT FIXED — `ValidatorResult.limitations` REACHES NO READER

Found by writing an assertion for it and watching it go red. A §20 verdict's `limitations` array is:

- **not read** by `completeAssuranceAssessment` — it reads nine ValidatorResult fields and this is not one;
- **not carried** by the ratified `AssuranceAssessmentCompleted` payload, which is a `strictObject` declaring
  `evidenceConsideredIds`, `observationIds`, `residualUncertainty`, `recommendedControlActions`, `validatorId`,
  `validatorVersion` and `independenceResult` — and no `limitations`;
- **not stored** on the assessment object.

⚠ **A FIELD EVERY CALLER FILLS AND NOTHING READS** is the hollow-governed-layer shape this repository keeps
finding — and it matters here specifically, because Phase 6b's honesty about what its reviewer did *not* do
was going to live there. It is written to `residualUncertainty` as well, which the event does carry, so the
disclosure is reachable; `limitations` keeps the value in its proper home for the day it is read.

⛔ **NOT FIXED HERE, DELIBERATELY.** Widening a ratified event payload is a governance act, and `§0.3`'s rule
against settling an open elicitation by implementation applies exactly. Filed for the register.

### 4.15.8 ⭐ THE SECOND THING AN ACCEPTED COMMAND DOES NOT MEAN

`completeAssuranceAssessment` does **not** reject a self-review. It takes the ratified §30
`ASSESSING -> INDEPENDENCE_VIOLATION` arrow and **ACCEPTS** the command, because the violation is a fact to be
minuted rather than a malformed request.

⚠ A caller reading `batch.ok` alone therefore reports a completed review for an assessment that reached the
one state INV-8 forbids from ever being SATISFIED — the swallowed-refusal shape `REG-F-015` exists to catch,
arrived at through an **accept** rather than a rejection, which is why no existing instrument names it.
`unconcludedReviews` is the answer, and without it the operator would have seen `RPH-PWU-007`'s §28.2 refusal
instead: *"a policy this PWU itself declares has not been satisfied"* — true, and useless, because it names
the silence and not the reason for it.

## 4.16 ⭐⭐ `R23` — AN ATOMIC PROFESSIONAL ACT MAY HAVE MORE THAN ONE ACTING PARTY, AND THE ENGINE COULD NOT SAY SO

⛔ **FOUND BY A REGRESSION I CAUSED, WHICH IS THE ONLY REASON IT WAS REACHABLE.** Phase 6b split the sign-off
into two transactions — the reviewer's assessments, then the controller's state hops — and
`undertaking-atomicity.e2e.ts` went red: **39 assessments before, 42 after** a refused affordance. Three orphans.

### 4.16.1 ⛔ TWO RATIFIED RULES THAT COULD NOT BOTH HOLD

- **`SPEC-001-INV-14` / FORK-23 (b)** — *"a multi-Command Affordance is ATOMIC where an atomic dispatch exists,
  and a partially-applied sequence SHALL NOT leave committed state behind."*
- **`DOC-004 §39` invariant 8** — an assessment under a policy requiring independence may not be satisfied
  unless the evaluator is independent of the producer.

⚠ **AND THE ENGINE'S ATOMIC ENVELOPE BINDS EXACTLY ONE PRINCIPAL.** `dispatchBatchAs(principal, …)` wraps the
loop in `store.transaction()` and stamps **every** command from that one principal. So a single atomic operation
cannot contain two parties' acts, and an affordance that needs both must choose which rule to break.

⭑ **NOTHING HAD TO CHOOSE BEFORE, AND THAT IS THE FINDING.** Every multi-command affordance in this surface was
single-party — because the assurance one was **reviewing its own work**. `REG-F-400` removed that, and the
conflict it had been masking surfaced immediately. ⛔ This is the general form: it will recur for **every**
future act that spans parties — a governance Decision proposed by one party and approved by another, a waiver
granted beside the work it waives — none of which can be atomic today.

### 4.16.2 ⭐ WHAT IS BUILT, AND WHY IT SITS BEHIND A CREDENTIAL

`AuthedEngineHandle.dispatchMultiPartyBatch(entries)`, where each entry is a command plus an OPTIONAL `as`
credential; omitted means *this session's own*. One `store.transaction()`; each command stamped from **its own**
resolved principal.

⛔ **IT IS NOT ON THE BARE `EngineHandle`, AND THAT IS DELIBERATE.** `engine.ts` records why dispatch lives
behind `as()` at all: *"Moving them behind a credential is what makes every unmigrated call site a COMPILE ERROR
rather than a silent last-write-wins path."* A multi-party batch reachable without presenting any credential
would undo exactly that. The **composing** party authenticates; the other parties authenticate for their own
commands.

### 4.16.3 ⚠ THE AUTHORIZATION STATEMENT, MADE EXPLICITLY RATHER THAN LEFT TO THE PLUMBING

**A host that HOLDS two credentials may bundle both parties' commands into one atomic act.** That is a widening
of what a *session* can compose and **not** a widening of what any *party* may do: every command is still
stamped from the principal its own credential resolves to, an unresolvable credential still fails closed, and no
party gains the ability to act as another. ⭑ The engine already refuses a declared `issuedBy` that disagrees
with the resolved principal — *"Overwriting quietly would make a forgery attempt invisible"* — and this path
does not touch that.

⚠ **IT IS ALSO EXACTLY WHAT THE SINGLE-USER DEMO IS**: one host holding the operator's and the reviewer's
credentials, simulating two parties, with the record saying truthfully which one issued what.

### 4.16.4 ⛔ THE THREE PROPERTIES THAT MUST BE GUARDED, BECAUSE EACH FAILS SILENTLY

| # | property | how it fails silently if unguarded |
|---|---|---|
| 1 | one transaction — any refusal rolls back **every** party's commands | the orphan-assessment defect, restored |
| 2 | each command is stamped from **its own** principal | every command looks like the composing session's; the record shows one party doing both halves, and `checkIndependence` still passes because it reads the PAYLOAD, not the issuer |
| 3 | an unresolvable credential fails **that** command and aborts | falling back to a neighbouring principal is the defaulted identity `actingActor()` throws rather than supply |

⭐ Property 2 is the one with no other detector: independence is computed from `producer`/`evaluator` in the
payload, so a batch that mis-stamped every issuer would satisfy INV-8, satisfy INV-14, and record a lie. Its
mutant is `P6c-b`, and the assertion pairs `issuedBy` per command against the credential that carried it.
