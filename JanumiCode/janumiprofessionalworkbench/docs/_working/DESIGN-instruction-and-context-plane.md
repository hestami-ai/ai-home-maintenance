# DESIGN — the instruction and context plane: what an agent is told to do, and what it is told with

## 0. Normative keywords, and the authority this document does *not* have

`MUST` / `MUST NOT` / `SHOULD` / `MAY` are RFC-2119. This document is a DESIGN RECORD. It decides nothing that
belongs to the sponsor, and it marks every such point `SPONSOR RULING REQUIRED` rather than choosing quietly.

> ## ⚠⚠ REWRITTEN 2026-09-02 — RE-GROUNDED ON `PER-9`. THE PRIOR VERSION INVENTED WHAT THE CORPUS RATIFIES.
>
> The first version treated the retention of model inputs as an open design problem and proposed a **context
> manifest** to solve it. That was wrong, and the manner of its wrongness is recorded here because it is the
> more useful finding.
>
> **`DOC-003 PER-9` already specifies the record**, element by element. The manifest re-derived a WEAKER
> version of a ratified invariant: it proposed recording *byte counts* where PER-9 requires *the exact
> materialized input*. PER-9 forecloses that substitution by name — **"A prompt or template fingerprint
> identifies that record; it never substitutes for it."** A byte-count manifest is a fingerprint.
>
> **What survives unchanged:** §1's measurements (F-1..F-6), §2's corpus tension, and `REG-D-048`. Those
> concern WHERE AN AUTHORED INSTRUCTION LIVES, which the corpus genuinely does not settle.
>
> **What is replaced:** everything about retention. It is not a design problem. It is a **ratified obligation
> with fifteen filed findings measuring the gap** (§5), and the work is to discharge them.
>
> **How the error survived its own falsifier — the part worth reading.** `FAL-5` asked whether a durable record
> already existed, and was recorded `NOT TRIGGERED`. It was driven with the probe
> `promptBytes|contextBytes|tokenCount|promptSize` — **the field names of the manifest this document invented.**
> A search for one's own invention can only confirm the invention is absent; it cannot detect that a ratified,
> differently-shaped obligation already covers the ground. The correct probe was the OBLIGATION, not the field
> name. `FAL-5` is re-dispositioned in §11.

---

## 1. The problem, measured

**The sponsor's statement, which is the origin of this document:** *"the core of PWU is a prompt template for the
agent that will be tasked with performing that PWU. I don't see that being visible in rph-demo."*

The second half is true and the first half is the design question. Measured, in both directions:

- **F-1. No object in the contract surface carries a prompt template.** An exhaustive walk of
  `packages/rph-contracts/src/objects.ts` for `prompt|template|instruction|systemPrompt` as a FIELD yields
  **one** match — `AssurancePolicyDefinition.defaultClaimTemplates`, a claim template, unrelated.
  **Positive control:** the same walk for ordinary field names returns hundreds.
- **F-2. `PWU_TYPE` carries sixteen fields and none is an instruction.** `pwaId, pwaVersion, pwuKind, name,
  purpose, isRoot, permittedParentTypeIds, permittedChildTypeIds, permittedChildren, executionBoundary,
  boundaryContract, requiredInputs, requiredOutputs, requiredAssurancePolicyIds, completionRule, status`.
  It declares WHAT work is to be done and to what standard. It does not say what to tell anyone.
- **F-3. `ExecutionStep` carries no template either.** Twelve fields; the nearest is `purpose: string`, which
  has **no vocab note at all** — nothing in the corpus or code claims it is the prompt, so reading it that way
  would be an inference presented as a finding.
- **F-4. The three policies that would govern context do not exist.** `RUNTIME_BINDING` declares
  `contextAssemblyPolicyId`, `observabilityPolicyId` and `memoryPolicyId` as bare `z.string()`.
  `CONTEXT_ASSEMBLY_POLICY`, `OBSERVABILITY_POLICY`, `MEMORY_POLICY` return **0** as object types. Every
  binding is minted at `handlers/runtime-binding.ts:67` with `contextAssemblyPolicyId: 'ctx-default'`,
  `observabilityPolicyId: 'obs-default'`, `modelSelectionPolicy: {}`, `sandboxPolicy: {}` — **four governance
  points, all constant, none resolving to anything.**
- **F-5. `modelSelectionPolicy` is an untyped placeholder and the ontology says so.**
  `m1-object-fields.json:2792` — *"NOT field-defined. Source TBD."* Confirmed in code:
  `ModelSelectionPolicySchema = z.record(z.string(), z.unknown())` (`objects.ts:91`).
  ⚠ **THE ABSENCE IS OF THE FIELD SHAPE ONLY.** Substantive constraints on model selection DO exist —
  `DOC-003 ASR-13` (graduated independence across provider/model) and the Guide's *"allowed and resolved
  provider/model/version"*. **"Source TBD" names a missing interface, not a missing rule**, and a design that
  treats it as a blank cheque will contradict ASR-13.
- **F-6. Decomposition propagates context downward with no budget term.** `DECOMPOSITION_CONTRACT` carries
  `obligationAllocations`, `constraintPropagations`, `assumptionPropagations`, `retainedParentObligationIds`
  and `intentMappings` — five downward-propagating collections — and no depth, breadth, size or budget field.

**Why this matters beyond tidiness, in the sponsor's own words:** in the predecessor system, recursive
decomposition for user stories produced prompts so large and so complex that they stopped working, *and the
coding agent could not diagnose the fault because it could not perceive the aggregate prompt.* The instruction
and the accumulated context were ONE artifact. When it grew past comprehension there was nothing to inspect
separately, so the failure was invisible to the only party positioned to fix it.

⚠ **AND THE STRUCTURAL FORM OF THAT FAILURE IS PRESENT HERE, NOT MERELY INHERITED.** `pi-agent.ts:119` supplies
a `systemPromptOverride` and `:166` calls `session.prompt(instruction)`; Pi's `DefaultResourceLoader` composes
the rest. **JPWB never holds the COMPOSITE it sends.** The predecessor's defect was that nobody could perceive
the aggregate. This system's version is that the aggregate is never materialized on this side of the boundary
at all — which is why PER-9's *"exact materialized input"* is not merely unrecorded here, it is
**unavailable**. That distinction sets the whole of `ICP-01` (§10).

⚠ **AND THE PRECISE FORM MATTERS, BECAUSE A LOOSER STATEMENT IS FALSE.** The user's `instruction` **IS**
durably recorded — it is the first transcript entry persisted through `recordConversation`. What is absent is
the **composed** input: system prompt + loaded resources + assembled context + tool schemas + accumulated
history, as actually presented. So E-1's gap is not *"nothing about the input is kept"*; it is that **what is
kept is an input to the composition, not the composition** — which is exactly `PER-9-b`'s distinction between
a thing that identifies the record and the record itself.

---

## 2. ⚠⚠ THE CORPUS DISAGREES WITH ITSELF ABOUT WHERE AN INSTRUCTION LIVES

**Reading A — the conformance mapping places it on the Execution Step.** *Legacy JanumiCode — Semantic
Inventory and RPH Conformance Mapping*, §7, verbatim row (`:936`):

> `| Prompt | Prompt template within an Execution Step |`

**Reading B — the canonical domain model defines the Execution Step and omits it.** *Canonical Domain Model*
§21 (`:1261-1301`) gives `ExecutionStep` in full: `id, executionPlanId, stepType, purpose, inputBindings,
outputBindings, runtimeBindingId?, preconditions, postconditions, stepState`. **There is no prompt template
field**, and `stepType` includes `MODEL_INVOCATION` — so the corpus contemplates invoking a model from a step
whose interface says nothing about what it is told.

**THE ENGINE IMPLEMENTS READING B FAITHFULLY.** The absence the sponsor noticed is **not an implementation
defect** — it is the implementation being correct against one ratified document while another names a
placement that document does not provide.

> **`REG-D-048` — AN INSTRUCTION TEMPLATE IS A GOVERNED OBJECT, DECLARED BY A PWU TYPE.** (Sponsor,
> 2026-08-31: *"Option (d) sounds most like the balance and tradeoffs the system needs."*)
>
> **The shape:** an `ASSURANCE_POLICY` is not a string on a PWU Type — it is a governed object, authored and
> versioned independently, which a PWU Type DECLARES by id (`requiredAssurancePolicyIds`) and an instance
> carries resolved (`assurancePolicyIds`). The ruling adopts that same shape for the instruction.
>
> ⚠ **THE PATTERN IS RATIFIED; THIS APPLICATION OF IT IS NOT**, and that was said before the ruling was made.
>
> ⚠⚠ **THE §2 TENSION IS NOT RESOLVED BY THIS RULING.** `REG-D-048` decides what THIS SYSTEM WILL BUILD. It
> amends no document and MUST NOT be cited as having reconciled the corpus with itself. **The tension stands.**

---

## 3. THE PLANE HAS TWO HALVES, AND ONLY ONE OF THEM IS A DESIGN PROBLEM

This is the correction that reorganises the document. The two halves have **opposite** epistemic status, and
the first version's central error was treating them alike.

| | **HALF A — RETENTION** | **HALF B — INSTRUCTION** |
|---|---|---|
| Corpus status | **RATIFIED** (`PER-9`, `PER-12`, `PER-8`) | **CONTESTED** (§2), then **RULED** (`REG-D-048`) |
| Gap status | **MEASURED** — 15 filed findings (§5) | Measured here (F-1..F-6) |
| What is owed | **DISCHARGE**, not design | **DESIGN**, legitimately |
| Risk of authoring | Re-deriving a weaker rule — *which happened* | None; the corpus is silent by admission |

**D-0 (the governing rule of this document).** For Half A, this design **MUST NOT** author a requirement.
Every obligation **MUST** be a quotation from `PER-9`/`PER-12`/`PER-8` or a measurement against one. Where this
document appears to add something, that is a defect in this document.

---

## 4. HALF A — what `PER-9` actually requires, quoted

**`DOC-003 PER-9`, the operative sentence, VERBATIM:**

> Every bounded model or agent try — each retry, reformat, and repair request included — is its own durable
> exchange record capturing the exact materialized input presented to the model, the returned output before
> schema coercion or repair, the resolved provider, model, and version actually invoked, declared truncation or
> omission, and the parse/validation/repair outcome, subject to recorded redaction. A prompt or template
> fingerprint identifies that record; it never substitutes for it. Where no Execution Plan exists — PWA
> authoring among them — the identical obligation binds to the plane's governed-stream record. Log-plane
> redaction of sensitive prompt content is legal; record-plane omission is not.

**The six required elements, enumerated so a gate can count them:**

| | Element | 
|---|---|
| **E-1** | the exact materialized input presented to the model |
| **E-2** | the returned output before schema coercion or repair |
| **E-3** | the resolved provider, model, and version actually invoked · ⚠ **PARTLY CARRIED — see `ICP-00`.** The EVALUATOR's is persisted as an `ActorReference` (`modelId`/`providerId`/`executionInstanceId`) through `executionProvenance`; the PRODUCER's is reduced to a boolean at `floor.ts:248-250` and discarded. **`ICP-02` should carry the existing pattern across, not invent one.** |
| **E-4** | declared truncation or omission |
| **E-5** | the parse/validation/repair outcome |
| **E-6** | recorded redaction (the *record* of what was redacted, not the redaction itself) |

**Three further clauses that decide the architecture and are easy to read past:**

- **PER-9-a — the unit is the TRY, not the turn.** *"each retry, reformat, and repair request included."*
  A turn that repairs once produces **two** records.
- **PER-9-b — a fingerprint may INDEX but never REPLACE.** This is the clause the prior version violated.
- **PER-9-c — the authoring plane is IN SCOPE and binds to a DIFFERENT carrier.** *"Where no Execution Plan
  exists — PWA authoring among them — the identical obligation binds to the plane's governed-stream record."*

**`PER-12` (sponsor-ruled, `REG-D-015`) governs the retained content's lifecycle, VERBATIM in the relevant part:**

> Chain-of-thought and other volunteered model reasoning is redacted at the trust boundary and **retained where
> available** as a typed Artifact bound to its producing Attempt under the applicable retention, security, and
> access policy. … It is never admitted as Evidence, never forwarded to another actor, never logged, never
> projected … Its one permitted use is **offline diagnosis** … **It is purgeable at retention expiry (PER-8).**

**`PER-8` completes it:** *"No hard delete after participation"* — a canonical object that **participated** in
execution, assurance, governance, a baseline or traceability is never hard-deleted.

> ### ⚠ THE ARCHITECTURAL CONSEQUENCE, WHICH IS THE WHOLE OF §7
> A reasoning trace is purgeable **precisely because it never participates** — PER-12 bars it from Evidence,
> from projection, and from every tier of assurance. So the corpus mandates **two planes with opposite
> lifecycles**: a PERMANENT plane (events, object revisions — PER-8) and a PURGEABLE plane (retained content
> under a retention class — PER-12). **They cannot be the same store.** This is not an architectural preference;
> it is a consequence of two ratified invariants.

---

## 5. HALF A IS ALREADY MEASURED — fifteen filed findings, never re-dispositioned

`docs/_working/HARMONIZATION-FINDINGS.md` is *"Appendix A — the 75 confirmed findings"*, produced 2026-07-15 by
a 117-agent sweep in which each finding was adversarially refuted by an independent agent (107 raised, **75
confirmed, 32 refuted** — a 30% fabrication rate the filter caught). Of the 75, **fifteen carry the dimension
`governed-stream`: one CRITICAL, six BLOCKING, eight MATERIAL.**

| # | Sev | Finding (abridged; the file carries them verbatim) |
|---|---|---|
| 10 | ~~CRITICAL~~ | ⚠ **PARTLY STALE at HEAD (`ICP-00`)** — resolved model/provider computed, used to decide independence, never written… **for the PRODUCER.** For the EVALUATOR it now IS written (`record-assurance.ts:41-50`) |
| 24 | BLOCKING | **the materialized input is never recorded** — authoring agent or judge (**E-1**) |
| 25 | BLOCKING | **the raw answer before coercion is never recorded**, and the first try's is destroyed (**E-2**) |
| 26 | BLOCKING | no Execution Attempt record exists; retries/repair are not separate records (**PER-9-a**) |
| 27 | BLOCKING | the Assessment drops evaluator identity, validator id, limitations, considered/rejected Evidence |
| 28 | BLOCKING | Assessment hardcodes `evidenceConsidered`/`rejectedEvidence`/`residualUncertainty` empty |
| 29 | BLOCKING | volunteered CoT is streamed to the browser agent log (**PER-12: "never logged"**) |
| 56 | MATERIAL | the floor read-back **fabricates** `independenceOk: true` because it was never persisted |
| 57 | MATERIAL | `correlationId` is a hardcoded constant, so a floor Assessment cannot be correlated to its turn |
| 58 | MATERIAL | a failure to persist the turn's transcript is **swallowed by an empty catch** |
| 59 | MATERIAL | CoT **discarded** at the write boundary rather than redacted and retained (**PER-12**) — verdict `BOTH` |
| 60 | MATERIAL | **no redaction exists anywhere**, though context is sent externally and prompt content persisted (**E-6**) |
| 61 | MATERIAL | truncation is declared only inside the prompt text that is never recorded (**E-4**) |
| 62 | MATERIAL | the parse/validation/repair outcome is swallowed by a bare catch (**E-5**) |
| 63 | MATERIAL | tool-call records lack start/end, resource use, authorization scope; discard structured results |

Adjacent, outside the dimension: **#46** (agent runs recorded as conversation entries, not Attempts), **#52**
(Execution Attempts never recorded), **#55** (the external-tool path meets almost none of §13.4's attempt
requirements), **#65** (ArtifactObjectSchema envelope-only), **#68** (`AUTHORING_CONVERSATION` added though
§5.2 lists no such object).

> ### ⚠⚠ THE FIFTEEN HAVE NEVER BEEN RE-DISPOSITIONED, AND AT LEAST TWO HAVE MOVED
> The **32 refuted** findings WERE re-checked at HEAD on 2026-08-23 (*"RE-DISPOSITIONED … 15 OF THE 32 ARE TRUE
> AT HEAD"*). **The 75 confirmed ones were not.** They stand as of 2026-07-15 with thirty-odd increments landed
> since. Spot-checks at HEAD, 2026-09-02:
>
> - **#24, #25, #62 — TRUE AT HEAD**, at the same file, line numbers drifted. `reasoning-review-validator.ts:176-182`
>   is `let raw = await print(prompt)` … `catch { raw = await print(...) }`: **two bounded tries occur and
>   neither becomes a record**, the materialized `prompt` is never retained, the pre-coercion `raw` is
>   overwritten by the repair path, and the `catch` is bare. One block, three PER-9 violations.
> - **#26 — PARTLY STALE.** An Execution Attempt **read-model** now exists —
>   `packages/rph-projections/src/execution-attempts.ts` (249 lines), built under `JAN-EXECPLAN-DR-002` DWP-03
>   after the sponsor ruled **Fork A = projection** on 2026-07-21. ⚠ **But it carries ZERO of E-1..E-6**:
>   `ExecutionAttemptView` is `{executionPlanId, stepId, attemptNumber, idempotencyKey, state,
>   runtimeBindingId?, startedAt?, completedAt?, error?, provenance?, aiNoBinding}`. **The §10.4 SHAPE landed;
>   the PER-9 SUBSTANCE did not** — and it cannot arrive by projection, because the events it folds never
>   carried the exchange.
> - **#65 — STALE.** `ArtifactObjectSchema` now carries the full storage field set (§7).
> - **#58 — line reference stale**; the route file has been substantially rewritten.
> - ⚠ **AND A THIRD REALIZATION EXISTS THAT AN EARLIER DRAFT OF THIS SECTION MISSED.**
>   `packages/rph-domain/src/execution.ts` carries an attempt KERNEL: `InterruptedAttemptView` (`:853`) and
>   `classifyInterruptedAttempt` → `ReconciliationClass` (`:872`) — §10.4's `reconciliation_state` realized as
>   a typed enum — plus `AttemptCountableEvent` (`:733`), attempt counting keyed on `ExecutionStepStarted`, and
>   attempt-level idempotency for external side effects (`:918-929`, RPH-EXE-007/§28.2). **So the Attempt is
>   realized in THREE places** — an id prefix, a read-model, and a domain kernel — **and none of the three
>   carries E-1..E-6.** ⚠ `classifyInterruptedAttempt` sits on the harmonization thesis's DEAD list (*"tested,
>   green, never called"*), so its existence is not evidence of a live path. **The point stands and sharpens:
>   the exchange gap is not "the Attempt is missing." It is that every carrier the Attempt has was built for
>   lifecycle and reconciliation, and none was built for the exchange.**
>
> **`ICP-00` is therefore a re-disposition, not a survey.** Any roadmap that schedules these fifteen as work
> without re-checking them first will build against a fourteen-month-old measurement — and #26 shows the
> measurement can move in BOTH directions at once (the record appeared; the obligation did not).

---

## 6. HALF A's CARRIER ALREADY EXISTS, IS WIRED, AND IS UNRATIFIED

`PER-9-c` binds the authoring plane to *"the plane's governed-stream record."* ⚠ **AND ITS SOURCE IS BLUNTER
THAN THE CANON CLAUSE** — Guide §9.7 L1340, VERBATIM: *"On the execution plane that record is an Execution
Attempt bound to its Execution Plan … Where no Execution Plan exists—PWA authoring is the current example—the
identical recording obligation binds to the plane's own governed-stream record, **not to an Execution
Attempt**."* The exclusion is explicit. **No amount of work on the Execution Attempt discharges the authoring
plane's obligation.** **That record exists.**

- `AUTHORING_CONVERSATION` is a `ProfessionalWorkObjectType`. Its `m1` note, VERBATIM: *"The durable,
  event-sourced transcript of the authoring agent's work on a DRAFT PWA — critical domain state (a precursor to
  the JanumiCode v2 governed stream), not UI metadata."* The vocab enum note calls it *"the durable
  event-sourced authoring conversation (**governed-stream precursor**)."*
- It is **WIRED**: `AppendConversationEntries` → handler `pwa-authoring.ts:70` → demo writer
  `workbench.ts recordConversation`. This is not a hollow object.
- ⚠ **AND ITS SHAPE IS UNRATIFIED.** `m3-commands-events.json:2869`, VERBATIM: *"UNRATIFIED-AUTHORED
  (annotated 2026-07-16 under sponsor grant): DOC-007 schematizes NO interface for this, so these fields were
  AUTHORED, not derived. … Do NOT treat this sourceSection as proof the shape is ratified. Ratification
  pending."*

**`ConversationEntry` = `{ role, kind, text, success? }`** (`m1:3298`). Against PER-9's six elements:

| Element | Carried? |
|---|---|
| E-1 exact materialized input | ✗ — `text` on a USER entry is the human's message, not the composed prompt |
| E-2 pre-coercion output | ✗ — `text` on an AGENT entry is rendered post-hoc |
| E-3 resolved provider/model/version | ✗ — **no such field exists** |
| E-4 declared truncation/omission | ✗ |
| E-5 parse/validation/repair outcome | ✗ — `success` means *"whether the proposed command was accepted"*, a different fact |
| E-6 recorded redaction | ✗ |

**Six of six absent.** So the design question for Half A is not *"what record do we invent?"* but **"does
`ConversationEntry` gain the six elements, or does a sibling exchange record carry them?"** — and either way
the shape must be **RATIFIED**, since it is currently authored-pending.

> ### ⚠ AND THE CURRENT CODE TAKES THE ONE OPTION `PER-9` FORBIDS
> `transcript.ts` excludes `thinking` from `RECORDABLE`, commenting: *"Reasoning material is dropped at the
> write boundary"* because *"Events are immutable and permanent (§9.4), so anything admitted to the transcript
> could never be purged."*
>
> **The premise is right and the conclusion is wrong.** The event stream IS the wrong home. But `PER-12` says
> volunteered reasoning is *"retained where available as a typed Artifact"*, and `PER-9` says **"record-plane
> omission is not [legal]."** Dropping is record-plane omission. The code chose omission because **the
> purgeable plane §4 requires does not exist** — so this is not a careless bug, it is the correct local move
> under a missing architecture. That is exactly finding **#59**, whose verdict is `BOTH`. Fixing it means
> building §7, not editing `transcript.ts`.
>
> ⚠ **AND ONE ADJACENT THING THAT LOOKS LIKE A DEFECT IS CORRECT.** `pi-agent.ts:123` sets
> `thinkingLevel: 'off'`. That is not an evasion of PER-12 — Guide §9.7 L1338 says **"Never solicit it"**, and
> PER-12 adds *"there is no obligation to solicit or procure a trace."* **Not asking is mandated; discarding
> what arrives anyway is not.** A remediation that turns thinking ON to satisfy "retain where available" would
> violate the source while appearing to serve the invariant.

---

## 7. THE STRUCTURAL BLOCKER — the ratified home is fully specified and its store does not exist

`PER-12` names the home: *"a typed Artifact … under the applicable retention, security, and access policy."*
**That object is already fully shaped.** `ArtifactObjectSchema` (`objects.ts:614-626`):

```
artifactType, mediaType, storageProvider, storageKey, contentHash, byteSize,
producingPwuId, producingExecutionAttemptId, securityClassification, retentionClass, status
```

`DOC-009 §18.1` ratifies the same on the `artifacts` table, including `producing_execution_attempt_id`,
`security_classification` and `retention_class`. **Nothing needs designing here.** What is missing is
everything the pointer points at:

- **B-1. There is no content store IN CODE — but the corpus specifies one, and this document got that wrong
  three times.** `packages/rph-ports/src/ports/` holds exactly three ports — `authentication.ts`, `logger.ts`,
  `storage.ts` — and none has a blob/content operation. That much is measured and holds.
  ⚠⚠ **THE CORPUS-WIDE CLAIM WAS FALSE.** `docs/Constitution Discussion/Janumi Single-Node Runtime Profile.md`
  §31 specifies it in normative voice, VERBATIM: *"# 31. Object Storage — Large binary and document Artifacts
  SHOULD use S3-compatible storage."* and *"## 31.1 Artifact Metadata — PostgreSQL SHALL retain authoritative
  metadata:"* listing `artifact_id, tenant_id, object_key, content_hash, content_type, size, created_by,
  created_at, source_context, malware_scan_status, retention_policy, encryption_status`; §31.2 requires
  tenant-scoped opaque object-key prefixes; §31.3: *"Artifacts SHALL use cryptographic content hashes."*
  `CON-000 B1` admits `docs/Constitution Discussion/` as SOURCE CORPORA *"holding authority for DETAIL"*.
  **That list is `ARTIFACT`'s field set**: `object_key`↔`storageKey`, `content_hash`↔`contentHash`,
  `content_type`↔`mediaType`, `size`↔`byteSize`, `retention_policy`↔`retentionClass`. **The pointer and the
  store were designed together; only the pointer was built.**
  ⚠ **AND `DOC-009` DOES RATIFY INLINE CARRIERS**, so "ratifies only a pointer" was over-broad: `§3.1` permits
  JSON for *"structured model output"*, and `execution_attempts.result jsonb` / `domain_events.payload jsonb`
  are exactly such carriers. `DOC-009` defines **56** `create table` statements (not 55), none of them a body
  store; `§3.6`: *"Large or file-based artifacts are stored outside core semantic rows."*
  ⚠⚠ **AND THE SEAM IS ALREADY A REGISTERED DEFERRAL.** `DEF-W2-001` — *"WP-2-005 blob content-hashing + §18.3
  artifact supersession + access control → W3 execution / W10 security"* — audited **`STILL_TRUE`** by the
  `REG-F-200` deferral census on 2026-08-20. **This is not an unraised gap. It is a scheduled one**, and a
  roadmap that raises it fresh duplicates W3/W10.
- **B-2. There is no purgeable plane.** `rph-persistence/src/schema.ts` has **five tables** —
  `professional_work_objects`, `professional_work_object_versions`, `domain_events`, `outbox_messages`,
  `command_receipts` — **all permanent by design.** `PER-12` requires purge at retention expiry; there is
  nowhere to put something purgeable.
- **B-3. Purge and redaction do not exist in the RPH code — but the corpus has a fully specified mechanism.**
  Across `rph-contracts`, `rph-application`, `rph-engine`, `rph-persistence`, `rph-ports`, `rph-assurance`:
  **zero** occurrences of purge or record-plane redaction. The 13 total hits are all
  `securityClassification`/`retentionClass` field references. ⚠ A keyword sweep DOES return redaction hits in
  `packages/csaa`'s `redactRoot` — a repository-path scrubber for report messages, a different sense of the
  word. **That near-miss is the same shape that made `FAL-5` fail**, and it is why the code measurement above
  is stated per-package rather than repo-wide.
  ⚠⚠ **BUT THE DESIGN CORPUS IS NOT SILENT, AND THIS DOCUMENT SAID IT WAS.** `JAN-CSAA-009 §20` — *"Retention,
  redaction, archival, deletion, and garbage collection"* — specifies a nine-member action vocabulary including
  `redact-derivative`, `tombstone-or-unavailable-record`, `physical-delete` and `cryptographic-erasure`, a
  `retentionActionId` identity for a purge attempt, and a Redaction Manifest artifact. `JAN-CSAA-007:2358`
  carries `InformationControlBinding` with separate `confidentialityClassification` / `accessClassification` /
  `retentionClassification` plus redaction policy, retention reference, and effective/expiry times.
  ⚠ **SCOPE, EXPLICITLY:** CSAA is another agent's subsystem and this programme does not touch it. It is cited
  as **PRECEDENT AND VALUE DOMAIN** — evidence that the shape has been worked out once in this repository, and
  the nearest thing to an answer for `retentionClass`'s undefined members (§12).
- **B-4. The classification fields are written and never read.** `retentionClass` and `securityClassification`
  are bare `z.string()` — no enum, no CHECK — written at `artifact.ts:66-67,95-96` and seeded
  `'INTERNAL'`/`'STANDARD'` at `reference-undertaking.ts:1649-50`, and **read nowhere.** `artifact.ts:17`
  concedes it: *"bare `text not null` with no CHECK constraint, and no enum for"*. `DOC-009` never enumerates
  the members either. **A retention class nothing reads cannot expire anything.**
- **B-5. `ArtifactReference` is a placeholder.** `z.record(z.string(), z.unknown())` (`objects.ts:73`).

> ### ⚠⚠ AND THE SOURCE CONSTRAINS THE SOLUTION IN A WAY THE CANON CLAUSE DOES NOT
> `PER-12`'s source — Guide §9.7 L1338, which `CON-000 B3` makes controlling for detail — says, VERBATIM:
> **"It adds no dedicated reasoning store; Section 10's typed persistence remains authoritative."**
>
> So the answer to §4's two-plane consequence is **NOT** "build a new store for reasoning." It is: the typed
> `ARTIFACT` under §10's existing typed persistence, with its `retentionClass` finally READ, backed by the
> object storage `§31` already specifies. **A dedicated reasoning store is foreclosed by name.**

**`REG-Q-B` — DOES THE CONTENT/RETENTION SEAM GET BUILT NOW, OR STAY BLOCKED-AND-DISCLOSED?**
⚠ **THIS IS NARROWER THAN THE FIRST DRAFT MADE IT, BECAUSE THE CORPUS ALREADY ANSWERS THE FORM.** Guide §9.7
L1340 closes with the standing instruction, VERBATIM: *"Where the spans cannot be separated losslessly, or
accepted contracts cannot represent these records losslessly, **block the capability and resolve Section 16
item 23**."* So block-and-disclose is not an alternative this document invents — **it is the ratified default**,
and `DEF-W2-001` already schedules the build into W3/W10.

**What is therefore actually open, and it is a scheduling question, not a design one:** whether the ICP
programme pulls `DEF-W2-001` forward, or records its dependency and stops at the four elements that do not need
it. ⚠ **The status quo is neither** — the code omits at the write boundary, which `PER-9` names illegal
(*"record-plane omission is not"*), **without disclosing that it is doing so.** Whatever is decided, the
undisclosed omission is a defect on its own terms.

---

## 7a. ⚠⚠ THE RECORD HAS ALREADY BEEN DESIGNED, FIELD BY FIELD, IN THIS REPOSITORY

**This is the third time in this document's history that the answer was "the corpus already did it," and it is
the most consequential.** `JAN-CSAA-007 §…:1288-1308` specifies `ModelExchangeRecord` — **PER-9's object,
complete.** Mapped against §4's enumeration:

| PER-9 | `ModelExchangeRecord` field, VERBATIM |
|---|---|
| **E-1** materialized input | `materializedInputArtifactRef` — *"1 exact bytes actually presented after redaction"* |
| **E-2** pre-coercion output | `rawOutputBeforeCoercionRef` — *"1 exact raw output"* |
| **E-3** provider/model/version | `resolvedModelIdentity` — *"1 closed union of exact provider/model/version/evidence or `unreported`/`unresolvable` with rationale"* |
| **E-4** truncation / omission | `truncationState` — *"1 of `none-declared`, `declared`, `detected`, `unknown`"* + `omittedRegions` |
| **E-5** parse/validation/repair outcome | *"exact parse outcome; validation refs; `accepted-for-normalization`, `rejected`, `quarantined`, or `repair-requested`"* |
| **E-6** recorded redaction | `inputRedactionManifestRef` |
| **PER-9-a** the TRY is the unit | `exchangeRole` — *"1 of `initial`, `retry`, `reformat`, `repair`"* + `predecessorExchangeRef` |
| **PER-9-b** fingerprint never substitutes | VERBATIM: *"A fingerprint never substitutes for retained materialized input or raw output."* |

**And it forbids, by name, the exact bug this design found at HEAD.** VERBATIM: *"**Repair never rewrites
predecessor raw output.**"* That is `reasoning-review-validator.ts:180`'s `raw = await print(...)` — findings
#25 and #62 — anticipated and prohibited by a design already written in this repository.

**It also answers `H-5`.** The fingerprint is a `DigestDescriptor` (`:378`): *"Object `{ "algorithm": "sha256",
"value": "<64 lowercase hexadecimal characters>", "profileId": …, "profileVersion": …, "representation":
"jcs-json" | "raw-bytes" }`"* — and **JPWB already has the canonicalization**: `rph-contracts/src/hash.ts`'s
prefixed, JCS-aligned `contentHash`, in production use. `representation: "jcs-json"` lines up with it.

> ⚠ **SCOPE, STATED PLAINLY AND NOT TO BE READ PAST.** CSAA is another agent's subsystem and this programme
> does not modify it. Its types are CSAA-namespaced (`SchemaUrn` = `urn:janumi:csaa:schema:…`), so this is
> **not** a package to import. It is cited as **A WORKED SOLUTION TO THE SAME RATIFIED OBLIGATION** — evidence
> that the shape is achievable, and the strongest available template for the JPWB record.
>
> ⚠⚠ **AND IT REFRAMES THE PROGRAMME AGAIN.** Half A is not "design an exchange record." It is: **adopt this
> shape for the RPH plane, or state why it does not fit.** A design that re-derives these seventeen fields from
> PER-9 unaided will produce a weaker set — which is precisely what the first version of this document did when
> it derived byte counts.

---

## 8. ⚠⚠ A SECOND CORPUS TENSION — and it is the one that produced this document's original error

**`DOC-009 §33.2 "Raw model output"`, VERBATIM:**

> Retain according to: privacy; security; debugging need; enterprise policy; cost.
> Prefer retaining:
> * content hash;
> * parsed result;
> * provenance;
> * bounded diagnostic excerpt;
> rather than all raw context indefinitely.

**Against `PER-9`:** capture *"the exact materialized input"* and *"the output before schema coercion"*, and
*"a fingerprint … never substitutes for it."*

**THE RECONCILIATION, and it turns on one word.** §33.2 says *"rather than all raw context **indefinitely**"* —
it governs **how long**, not **whether to capture**. `PER-9` governs capture; `PER-12` supplies the expiry that
§33.2 is asking for. Read that way they compose, and the composition is exactly §4's two-plane architecture.

**THE PRECEDENCE, if they are read as conflicting — and the first draft got this dangerously half-right.**
It said only *"`CON-000 B3` gives canon the PRINCIPLE and `DOC-009` DETAIL, so `PER-9` binds."* **That quotes
B3's first half and stops at exactly the point that qualifies it.** B3 continues, VERBATIM:

> **Canon's authority over a principle is DERIVATIVE AND CONDITIONAL (REG-D-034, sponsor ruling).** Canon
> governs where it faithfully distils the source its provenance cites. Where a canon clause DIVERGES from that
> source, canon governs **only if the divergence carries a ratifying act naming it**; a divergence with no such
> act makes the canon clause **DEFECTIVE, not governing**, and the source controls until the divergence is
> ruled. … **Canon's SILENCE on a detail is never evidence of the corpus's silence** (REG-F-093).

**So "PER-9 is canon, therefore it binds" is NOT a valid inference.** It binds only if it faithfully distils
its cited source. **CHECKED, 2026-09-02, rather than assumed:**

- `JPWB-DOC-003 …provenance.md:130` gives PER-9's source as **Guide §9.7 L1340 (sponsor-adjudicated)**.
- Guide §9.7 L1340 read at the site carries every element PER-9 states, in the source's own words: *"Record the
  materialized input presented to the model, the returned answer output before schema coercion or repair, the
  resolved provider/model/version actually invoked, any declared truncation or omission, and the
  parse/validation/repair outcome … A prompt/template fingerprint identifies that record; it never substitutes
  for it."*
- **VERDICT: faithful, and sponsor-adjudicated. `PER-9` GOVERNS.** ✅

⚠ **THE SAME TEST APPLIED TO `PER-12` PASSES FOR A DIFFERENT REASON**, and B3 names it explicitly: *"of the
divergences measured in the 87-clause fidelity audit, the ratified one (**PER-12 / REG-D-015**) was a
deliberate amendment."* PER-12 diverges from its source **and carries its ratifying act.** It governs.

**A CLEANER RECONCILIATION THAN PRECEDENCE, from the Guide's own §0.1** (`:45`), VERBATIM: *"Meaning, wire
shape, persistence, and presentation are different kinds of authority. A later storage example does not
redefine professional meaning…"* — which is the §33.2-vs-PER-9 question answered directly: **§33.2 is a storage
rule about duration; PER-9 is a meaning rule about capture.** They do not compete. (§0.1 is also where the
term *"rank-9"* used across the working corpus is defined — item 9 of its precedence list is `RPH-DOC-009`,
*"Storage and operation"*.)

> ⚠ **BUT RECORD THE TRAP, BECAUSE IT ALREADY CAUGHT THIS DOCUMENT.** §33.2 read alone is a ratified sentence
> that appears to license storing a hash and an excerpt instead of the input. **That is precisely the design
> the first version of this document proposed** — arrived at independently, without having read §33.2. A future
> author who finds §33.2 first will re-derive the same error and will have a corpus quotation supporting it.
> The counter-quotation they need is `PER-9`'s *"it never substitutes for it."*

---

## 9. HALF B — the design work that IS legitimate

Constrained by `REG-D-048` (instruction template = governed object declared by a PWU Type), what remains open:

- **H-1.** The object's field shape; whether a PWU Type declares ONE template or several.
- **H-2.** Whether parameter substitution exists, and in what syntax.
- **H-3.** Whether editing a template migrates dependent PWAs the way `EditAssurancePolicy` versioning does.
- **H-4.** `CONTEXT_ASSEMBLY_POLICY` as a governed object — the counterpart that makes the split real (D-1).
- **H-5.** ~~What a "prompt or template fingerprint" is computed OVER.~~ ⚠ **LARGELY ANSWERED — see §7a.**
  `PER-9`, `DOC-004 §7.2` and `SPEC-001 INV-12` use the term normatively and none defines it, and the register
  records that the Guide's only definitional sentence is a JSDL compiler-IR fingerprint labelled *candidate*.
  **But `JAN-CSAA-007:378` defines `DigestDescriptor`, and `rph-contracts/src/hash.ts` already implements the
  JCS canonicalization it names.** What remains open is narrow: **adopt `DigestDescriptor`'s shape, or ratify a
  JPWB-namespaced equivalent** — not "invent a fingerprint."

**D-1 (retained from v1, and it is Half B's, not Half A's).** The system **MUST NOT** represent an authored
instruction and its assembled context as one artifact. This is the sponsor's diagnosis stated structurally:
when the aggregate is the only artifact, its size has no owner and its growth has no reviewer.

**D-2.** Context assembly **MUST** be a governed object with an identity, not a constant. `'ctx-default'`
names nothing; a policy that cannot be read cannot be reviewed, changed, or blamed.

**D-5.** Decomposition **SHOULD** carry a budget term. ⚠ `SHOULD` and not `MUST` deliberately: **no ratified
text imposes one.** Independent sweeps found the only budget-shaped rules (`JSRP §26.2` Context Limits, `§67.1`
Context Minimization) are **candidate-tier**. Making this a MUST would be legislating.

---

## 10. Sequence

⚠ **THE ORDER IS DRIVEN BY THE FACT THAT HALF A IS DISCHARGE AND HALF B IS DESIGN.** Half A does not wait on
Half B; the retention obligation binds today regardless of where an instruction ends up living.

1. **`ICP-00` — re-disposition the fifteen at HEAD** (§5). Not a survey: each finding re-checked at the site
   with a positive control, as the 32 were on 2026-08-23. **#26 is the proof this is necessary.**
2. **`ICP-01` — materialize the prompt on this side of the boundary.** Today `pi-agent` hands Pi an override
   and an instruction and never sees the composition. **E-1 is unobtainable until this lands**, which makes it
   the true first build step and not a recording step.
3. **`REG-Q-B`** (§7) — pull `DEF-W2-001` forward, or record the dependency and stop short of it. ⚠ **A
   SCHEDULING DECISION, NOT A DESIGN ONE**: the store is specified (`§31`), the seam is deferred with a named
   destination (W3/W10), and block-and-disclose is the ratified default. **E-2/E-6 and PER-12 wait on this;
   E-1/E-3/E-4/E-5 do not** — which is why it sits third and blocks only part of the work.
4. **Ratify the authoring-plane exchange record** (§6) — `ConversationEntry` extended, or a sibling record.
   Currently `UNRATIFIED-AUTHORED`, so this is a ratification, not only a build. ⚠ **ITS SHAPE STARTS FROM
   `ModelExchangeRecord` (§7a), NOT FROM A BLANK PAGE.** The work package's first act is to accept or
   reject that shape field by field, with a written reason per rejection.
5. **Half B**: `CONTEXT_ASSEMBLY_POLICY` (H-4), then the instruction template object (H-1..H-3), then surfaces.
6. **Decomposition budget** (D-5), last, and only if `ICP-00`'s measurement shows accumulation is real HERE
   rather than inherited from the predecessor.

⚠ **STEPS 1–4 ARE ENGINE WORK; ONLY STEP 5 REACHES THE UI.** The sponsor's question arrived as a UI question;
the answer remains that most of it is not — but for a better reason than v1 gave. It is not that the fields are
empty. It is that **the obligation to fill them was ratified, measured, and never scheduled.**

---

## 11. Falsifiers

This design is WRONG, and should be withdrawn or rewritten, if any of these is shown.

- **FAL-1.** A ratified corpus document *does* define an instruction or prompt-template field on `PWU_TYPE`,
  `ExecutionStep`, or `RuntimeBinding`. **DRIVEN 2026-08-31 — NOT TRIGGERED.**
  `grep -rin "promptTemplate|instructionTemplate|systemPrompt|agentInstruction"` over the RPH corpus and
  `docs/canon/` returns ZERO. **Re-corroborated 2026-09-02** by an independent corpus sweep.
- **FAL-2.** `ExecutionStep.purpose` is documented anywhere as the model instruction. **DRIVEN — NOT
  TRIGGERED.** No `note` in `m1`, no prose at §21.
- **FAL-3.** Any production path writes a `contextAssemblyPolicyId` other than `'ctx-default'`. **DRIVEN — NOT
  TRIGGERED.** Two occurrences repo-wide outside `dist`: the declaration and the single constant writer.
- **FAL-4.** The predecessor's failure is shown to have been caused by something other than aggregate size and
  the inability to inspect it — in which case `D-1` is solving the wrong problem, however tidy the split.
  **NOT DRIVEN.** It concerns a system outside this repository.
- **FAL-5.** ~~A durable manifest already exists somewhere and was missed. Then `P-2` is built and the work is a
  surface after all.~~ ~~**DRIVEN — NOT TRIGGERED.**~~
  > ⚠⚠ **RE-DISPOSITIONED 2026-09-02 — THE VERDICT WAS WRONG, AND THE PROBE IS WHY.**
  > It was driven with `promptBytes|contextBytes|tokenCount|promptSize` — **the field names of the manifest
  > this document invented.** That probe cannot fail: a search for one's own invention confirms only that the
  > invention is absent. It could not detect that `PER-9` already RATIFIES the record in a different shape,
  > that `AUTHORING_CONVERSATION` is annotated in the vocab as the *"governed-stream precursor"*, or that
  > fifteen findings already measure the gap.
  > **CORRECT DISPOSITION: TRIGGERED IN PART.** No durable record exists (the narrow claim survives) — but the
  > design's PREMISE, that one had to be invented, is false. Hence this rewrite.
  > **THE GENERAL FORM, which is the reusable lesson:** *a falsifier phrased in the vocabulary of the thing it
  > is meant to falsify is not a test.* It must be phrased in the vocabulary of the OBLIGATION.
- **FAL-6 (new).** `PER-9`'s six elements are carried, today, by some record this document did not open. Then
  §5 and §6 overstate the gap. **DRIVEN 2026-09-02 — NOT TRIGGERED.** Checked `ConversationEntry` (0/6),
  `ExecutionAttemptView` (0/6), `ExecutionProvenance` (carries `ActorReference`s and
  `producingExecutionAttemptId`, not the exchange), and the five persistence tables. **Positive control:** the
  same walk over `ArtifactObjectSchema` returns its full 11-field storage shape, so the probe can find fields
  when they exist.
- **FAL-7 (new).** A content or blob store exists behind `ARTIFACT.storageProvider`/`storageKey`. Then B-1
  falls and §7 is a wiring task rather than a ruling. ~~**DRIVEN — NOT TRIGGERED.**~~
  > ⚠⚠ **TRIGGERED, 2026-09-02 — AND IT WAS FLAGGED AS THE LIKELIEST TO FAIL IN THE SAME BREATH AS BEING
  > DECLARED SAFE.** The draft said *"this is the claim most likely to be wrong in the direction of my own
  > prior errors … it should be re-driven by anyone acting on §7 rather than trusted from here."* **An
  > adversarial pass re-drove it within the hour and it fell.**
  > **What actually holds:** no content port IN CODE (three ports, none with a content operation) — measured,
  > survives. **What was false:** the corpus-wide half. `Janumi Single-Node Runtime Profile §31` specifies
  > object storage in `SHALL`/`SHOULD` voice with a metadata field list that *is* `ARTIFACT`'s (B-1), in a
  > directory `CON-000 B1` admits for DETAIL. `DOC-009` has **56** tables, not 55, and `§3.1` ratifies inline
  > `jsonb` carriers for *"structured model output"*.
  > **WHY IT FAILED — the same defect as `FAL-5`, one level up.** The probe searched for
  > `content store|blob store|payload store`. The corpus's term is **"object storage."** Absence of the PHRASE
  > was presented as absence of the SHAPE. `FAL-5` searched the vocabulary of my invention; `FAL-7` searched
  > the vocabulary of my *architecture*. **Neither searched the corpus's.**
  > **NET EFFECT ON THE DESIGN: it gets SMALLER.** The store is specified and deferred (`DEF-W2-001`), not
  > unspecified and unraised. §7 is a scheduling question, not a design one.

---

## 12. What this design does not decide

- **The shape of `ModelSelectionPolicy`** — *"Source TBD"*; inventing one here would contradict F-5's warning
  that the missing thing is an interface, not a rule.
- **`REG-Q-B`** (§7) — build the purgeable plane, or block-and-disclose.
- **What a retention class or security classification MAY BE.** `DOC-009` declares both as bare `text not null`
  and never enumerates members; the register carries this as `REG-Q-056`, OPEN. ⚠ **BUT THE CORPUS IS NOT
  BLANK, AND AN EARLIER DRAFT OF THIS SECTION IMPLIED IT WAS.** Three candidate value domains exist:
  `JSRP §66` names *"Agent Prompts"* as its own retention class; `Single-Node Runtime Profile §31.1` carries
  `retention_policy` + `encryption_status` + `malware_scan_status` on artifact metadata; and
  `JAN-CSAA-007:2358`'s `InformationControlBinding` separates `confidentialityClassification` /
  `accessClassification` / `retentionClassification` with effective/expiry times. **All candidate-tier, none
  ratified** — so `REG-Q-056` stays open, but it is a CHOICE among worked options, not a blank page.
- **What a prompt/template fingerprint is computed over** (H-5).
- **Whether the decomposition budget is a MUST** — no ratified text imposes one.
- **Whether `'ctx-default'` should resolve to a seeded policy or refuse.** A fail-closed default breaks every
  existing binding; a permissive seed reproduces the vacuous route. Both need measurement.
- **Anything about the `pi` / `agy` harnesses** beyond `ICP-01`'s requirement that the composed input become
  observable. Whether harness selection becomes governed state is a separate question.
