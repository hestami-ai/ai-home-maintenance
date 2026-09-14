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
TOOL_FAILURE, and a SIGKILLed process on Windows reports `null`, not a distinguishable number.

⚠ **THE TWO PORTS ARE NOT INDEPENDENT.** A `ProcessRunner` needs a real `cwd`; an in-memory workspace has none.
A host wiring a REAL runner against an IN_MEMORY workspace must be caught **before anything runs**, or the command
executes in some other directory — the one failure this seam must never have. Hence `materialization` on the
workspace, checked rather than trusted.

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

### 4.3 Capability → tools: grant by ABSENCE

**A tool the grant does not authorize is never minted, so the model is never told it exists.** There is no call to
intercept and no refusal path to get wrong. A capability check *inside* a tool handed to the model anyway is
strictly weaker: it depends on the check firing, and it advertises the privilege.

Proven live, with the precision half this repository has historically not tested:

```
granted ["network"] only          -> step REFUSED · model calls 0 · exchange records 0
granted ["network","file-system"] -> minted ["write_file"] withheld ["run_command"]
                                     run_command calls = 0 · write_file calls = 1 · file on disk
granted ["file"] / ["file-syste"] / ["file-system-extra"] / ["FILE-SYSTEM"] -> minted []
```

Exact membership, not prefix — it reuses the kernel's own `capabilityAuthorized`, the export a prior programme
proved exact. Containment refuses `../`, `a/../../`, absolute and drive-qualified paths.

⭐ **AND THIS RESOLVES RPH-EXE-004's OPERATION-VERSUS-STEP TENSION RATHER THAN CHOOSING A SIDE.** The ratified
rule says *"network OPERATIONS fail authorization"* — operation-level degradation — while
`stepCapabilityRefusal` refuses the whole step. Granting by absence **is** operation-level degradation: the model
keeps working with a narrower tool set and says so (`"commandRun":false,"missingTool":"shell/command-execution"`).
⚠ **Consequence for the plan:** `stepBindingFor` currently hardcodes `requestedCapabilities: [{capability:'network'}]`
for every model step. It must request **per step type**, and the design must distinguish capabilities a step
REQUIRES (ungranted ⇒ refuse the step) from those it can USE (ungranted ⇒ do not mint the tool).

### 4.4 The evidence join — a second floor run, over the evidence

`proposedEvidenceIds` cannot simply be populated (B2). The evidence subject needs its own floor run.
`work-product-floor.ts` opens by recording that the floor validators *"do not inspect their subject … they judge
FACTS the caller supplies"* and that a run is *"a subject plus a context"* — so this is a **call site, not a
redesign.**

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
model-participating content is unlawful rather than merely unbuilt without it. ⛔ **The guard stays RED until this
lands; it is not to be silenced.**

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

⛔ **WHAT THIS RULING DOES NOT LICENSE.** It is not permission to stop refusing: the organisational boundary is
the thing that makes an Undertaking's deliverable findable and its accidents legible, and every refusal in the
adapter stays. It is permission to stop pretending — and to stop adding one more string comparison per
adversary, which is what §4.8 exists to end.


---

## 5. What must NOT happen

- ⛔ **No regression of the authoring plane.** It works live; it is the reference, not the subject.
- ⛔ **No default that fabricates.** No exit code from a command that did not run; no `materialization` assumed.
- ⛔ **No silencing of REG-Q-066.** Red until the retention disposition lands.
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
2. **REG-Q-066's retention disposition**, re-answered per R7.
3. **`pol_test_adequacy`** (R4, second half), with its conformance rule amended in the same act.
4. **Whether workspace content is PER-8 participating material.** A test run that evidence cites certainly is.

---

## 7. Open questions this design does not settle

- **A read-back tool.** The model can write and run but not read; today it must shell out to see its own files.
- **A working-set budget.** The spike's 64KB capture cap is arbitrary and unratified.
- **The replay producer (R2).** A fourth `ProducerSession` answering from a committed recording — blocked behind
  B4's fidelity fix, because a recording of the wrong bytes replays a different run.
- **Whether `stepCapabilityRefusal`'s step-level refusal should become REQUIRES/USES** (§4.3).
- **e2e status.** Playwright was not run against the spike. Unknown, not assumed green.
