# PROPOSED EDITS — Coding Agent Guide (RPH-DOC-000)

**Status: PROPOSED. Not applied. Sponsor accepts or rejects.**
Target: `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md` (2547 lines)
Produced 2026-07-15 by three verified workflows (19 + 14 + 8 agents) plus a merge pass with four adversarial lenses (mechanics / external conflict / set-internal coherence / safety boundary). All 10 anchors read byte-exact and verify **unique** in 2547 lines.

---

## READ THIS FIRST — three things that decide whether you want this at all

1. **Landing this BLOCKS the model/agent execution capability.** A2 and B4 fire §16 item 23 immediately. Verified against the contracts: `ProfessionalWorkObjectTypeSchema` (`packages/rph-contracts/src/enums.ts:568`) enumerates 21 types and **`EXECUTION_ATTEMPT` is not among them** — only an id prefix (`ids.ts:33`) and three reference fields (`envelopes.ts:39`, `messages.ts:100/198/517/931`). The Attempt is **referenceable but not recordable**. And `ArtifactObjectSchema` (`objects.ts:449`) is `z.strictObject({ ...objectEnvelopeShape })` — **the envelope and nothing else**: no content field, no content reference, no subtype. §10.1 L1366's block condition is met on landing.
2. **Any model whose reasoning cannot be span-separated from its answer is BLOCKED. That is the model class this codebase runs.** Local/open-weight models emit reasoning inline. Models with delimited reasoning (`<think>`) separate mechanically; models that reason-then-answer in prose do not. The origin axis was adopted specifically to bind both model classes without a provider carve-out — applied honestly, it binds the inseparable class, and the consequence is item 23.
3. **The "for now" may not survive landing.** See Q1. If a typed Artifact *of an Execution Attempt* counts as having participated in execution, §10.1 L1368's no-hard-delete binds and retained reasoning can never be purged — reversing the ruling later would stop future retention and purge nothing.

---

## THE DIFF — 10 edits

**Apply by unique-string match on CURRENT, not by line number.** All anchors verify as occurring exactly once. If the applier is line-addressed, apply in strictly descending order: **2369, 2328, 2251, 2237, 2220, 1337, 1335, 1034, 456, 224, 177.**
**Write UTF-8, no BOM, no punctuation normalization.** The file holds 47 × U+2014 (—), 21 × U+2013 (–), 7 × U+2019 (’), no BOM. L456 and L217 use ASCII apostrophes — preserve both conventions as-is.

---

### B2 — `## 3. Canonical vocabulary and non-equivalences` (header L203) · anchor **L224** · INSERT_AFTER

Insert two rows immediately after L224, **no blank line** (L225 is the next table row).

```
| **Professional rationale summary** | The agent-authored account of its own professional reasoning returned under Section 9.7's execution contract, bound to the Evidence used, Assumptions, Claims, limitations, and residual uncertainty it declares. It is a contracted deliverable addressed to the governed system, not a byproduct of a provider's runtime. It is not private chain-of-thought. |
| **Private chain-of-thought** | A model's interior deliberation and any rendering of it: raw reasoning tokens, inline reasoning volunteered by a local or open-weight model, or a summarized reasoning block returned by a hosted API. The term is fixed by origin, not by disclosure. It is not a professional rationale summary and is not observable trace data within Section 8.4's meaning. Section 9.7 governs its handling. |
```

**Why:** the root defect. The term carrying every prohibition in this document is defined in neither §3 nor §5.2 — its only two definitional sections — and six verbs (require / store / expose / capture / log / "requires no") drifted apart across nine passages in that vacuum. §3 already carries non-object terms, so these rows create no canonical object and do not engage §16's gate.

---

### B1 — `## 2. Governing principles` (header L159) · anchor **L177** · REPLACE

**CURRENT:**
```
9. **AI participation is visible.** Material AI contributions identify agent, role, model/version, execution context, tools, Evidence, Assumptions, limitations, and accepted/rejected disposition. Preserve professional rationale; do not require or store private chain-of-thought.
```
**PROPOSED:**
```
9. **AI participation is visible.** Material AI contributions identify agent, role, model/version, execution context, tools, Evidence, Assumptions, limitations, and accepted/rejected disposition. Preserve professional rationale. Never require private chain-of-thought, rest a finding on it, place it in another agent's context, or build a dedicated store for it.
```
**Why:** "store" is false against §16 item 21 L2514's own gloss ("forbids **requiring**"), against §5.6 L456's affirmative preservation permission, and it blocks the ruling's retention at principle level. The four replacement verbs carry the actual hazard.

---

### B3 — `### 5.6 The governed professional stream` (header L438) · anchor **L456** · **REPLACE_SENTENCE**

**Replace sentence 2 only.** L456 holds four sentences. Target string (verified unique):
```
Do not implement a universal `GovernedStreamRecord`, duplicate Event authority, store every Artifact body in one table, or capture private chain-of-thought.
```
**PROPOSED:**
```
Do not implement a universal `GovernedStreamRecord`, duplicate Event authority, store every Artifact body in one table, or build a dedicated store for private chain-of-thought.
```
**SURVIVES UNTOUCHED:** sentence 1 (`Quarantine means policy-governed isolation…`), sentence 3 (`Preserve decision-relevant rationale…subject to retention, security, and redaction policy.`), sentence 4 (`Section 10's typed persistence remains authoritative.`).
**Why:** "capture" is the guide's sole broad verb and sits fourth in a list whose other three members are storage architectures. Aligning it to item 21's own words removes the ambiguity both readings exploited.

---

### B5 — `### 8.11 Evidence admissibility` (header L1023) · anchor **L1034** · REPLACE

**CURRENT (the list's final bullet):**
```
- generated prose remains an Artifact until admitted as Evidence.
```
**PROPOSED:**
```
- generated prose remains an Artifact until admitted as Evidence;
- a professional rationale summary proves an account was emitted, not that it drove the output.
```
**Why:** REPLACE, not INSERT_AFTER — L1034's terminal `.` must become `;` or a period lands mid-list, breaking parallelism with L1029–L1033. Parallels L1029's "an execution trace proves execution, not Intent satisfaction."

---

### A1 — `### 13.3 Security invariants` (header L2212) · anchor **L2220** · REPLACE

**CURRENT:**
```
- Redact before logging or sending context to external models. Store the minimum necessary prompt/input/output content under explicit retention and access policy.
```
**PROPOSED:**
```
- Redact before logging, persisting, or sending context to external models. Keep prompt/input/output content under explicit retention and access policy.
- Minimize retained sensitive data. Minimization never excuses the absence of a record required by Sections 5.6, 8.4, 9.7, or 10.1.
```
**Why:** "Store the minimum necessary" is a volume ceiling on professional content sitting in a non-waivable Security-invariant list, so it outranks §5.6/8.4/9.7/10.1 in practice and inverts the burden onto anyone who records. Verified: `access policy` occurs at L2220 **and nowhere else**; `sensitive data` occurs at L2217 and nowhere else (and L2217 covers *Artifact metadata*, not Artifact content). The redaction predicate stays unqualified and the access-policy clause stays bound to prompt/input/output content — an earlier draft's rewrite deleted the only access floor over exactly the content A2 and B4 newly mandate retaining.

---

### A6 — `### 13.4 Sandbox and tool execution` (header L2227) · anchor **L2237** · REPLACE — **NEW**

**CURRENT:**
```
- Terminate and clean up idempotently; retain only policy-approved provenance, logs, outputs, and failure Evidence.
```
**PROPOSED:**
```
- Terminate and clean up idempotently; retain only policy-approved provenance, logs, outputs, and failure Evidence. Retention limits never excuse the absence of the Execution Attempt record required by Section 9.7.
```
**Why:** "retain only" is exclusive over a closed enumeration. A2's mandated record of the *materialized input* is not provenance, not a log, not an output, not failure Evidence — and L2239 routes model/agent calls onto this exact plane ("An external call uses the attempt/reconciliation protocol in Section 9"). A1's exemption is written into §13.3 and has no reach into §13.4. **Without A6 the set mandates in §9.7 what §13.4 forbids retaining.**

---

### A2 — `### 9.7 AI and external execution contract` (header L1331) · anchor **L1337** · INSERT_AFTER

Append to L1337's paragraph, **no intervening blank line** (L1338 is blank). **Apply A2 before B4.**

**CURRENT:**
```
Every tool/sandbox call records identity, authorization scope, input reference, start/end, result/error, resource use, and declared outputs. Model output is untrusted input. Malformed output creates no authoritative object.
```
**PROPOSED — append:**
```
 Each bounded try of a model/agent invocation—including every retry, reformat, and repair request—is its own Execution Attempt and its own record. Record the materialized input presented to the model, the returned answer output before schema coercion or repair, the resolved provider/model/version actually invoked, any declared truncation or omission, and the parse/validation/repair outcome, subject to applicable redaction handling recorded as such. A prompt/template fingerprint identifies that record; it never substitutes for it. Volunteered reasoning material in that exchange is governed by the rule above, not by this record; where it arrives inline with the answer, separate it at retention so that only the answer span binds under Section 8.4. Where the spans cannot be separated losslessly, or accepted contracts cannot represent these records losslessly, block the capability and resolve Section 16 item 23.
```
**Why:** the real defect. §5.6 L447 says "references", §9.7 L1337 says "input reference", §14.6 L2369 says "or **fingerprints**" — so the exact materialized input and returned output are nowhere required to be recoverable, and **an implementer who stores a hash is conformant and forensically useless.**

---

### B4 — `### 9.7 AI and external execution contract` (header L1331) · anchor **L1335** · INSERT_AFTER

Append to L1335's paragraph, **no intervening blank line** (L1336 is blank).

**CURRENT:**
```
It returns proposed entities/Commands, professional rationale summary, Evidence used, Assumptions, Claims, limitations, unresolved Questions, residual uncertainty, validation results, and provenance. Agent completion never completes a PWU.
```
**PROPOSED — append:**
```
 A model may volunteer private chain-of-thought no control requested—raw inline reasoning from a local or open-weight model, or a summarized reasoning block returned by a hosted API. Never solicit it, never make a control depend on it, and never treat its presence or absence as a signal. Material that arrives is redacted at the boundary and then retained as a typed Artifact of its producing Attempt under retention, security, and access policy, so the prompt/reasoning/response exchange stays reconstructable. It is never admitted as Evidence, never supplies another agent's context, never reaches a log, never enters a default or shared projection, never supports a finding, and is never the professional rationale summary above. Retained reasoning material in an evaluator's context is a hidden-context independence violation under Section 8.12. It adds no dedicated reasoning store; Section 10's typed persistence remains authoritative. It participates in no execution, assurance, governance, Baseline, or traceability, so Section 10.1's no-hard-delete rule does not reach it; it is purgeable at retention expiry. Where accepted contracts cannot represent this losslessly, block the capability and resolve Section 16 item 23.
```
**Why:** the boundary contract is where the material arrives. Written on origin so it binds both model classes without a provider carve-out; retain-on-arrival so it never requires a model to produce reasoning that may not exist. **The purgeability sentence is the thinnest link in the set — see Q1.**

---

### A3 — `### 14.6 Observability and failure Evidence` (header L2363) · anchor **L2369** · **REPLACE_SENTENCE**

**Replace sentence 1 only.** L2369 is one line holding **three** sentences. Target string (verified unique):
```
For model/agent calls, record allowed provider/model/version, prompt/template/tool versions or fingerprints, relevant policy, token/time/cost metrics, response schema status, safety/redaction outcome, and resulting proposal/Artifact IDs.
```
**PROPOSED:**
```
For model/agent calls, record allowed and resolved provider/model/version, prompt/template/tool versions or fingerprints, relevant policy, token/time/cost metrics, response schema status, safety/redaction outcome, and resulting proposal/Artifact IDs. In logs and traces a fingerprint identifies the Attempt record Section 9.7 requires.
```
**SURVIVES UNTOUCHED — a line-level REPLACE DESTROYS BOTH:**
- sentence 2: `For assurance cycles supported by accepted contracts, correlate subject/input/output versions, … add recurrence fingerprints only after Section 16 item 24 is decided.`
- sentence 3: `Do not log secrets, unrestricted professional content, or private chain-of-thought.` — **load-bearing**; this is the log prohibition B4 mirrors.

**Why:** "or fingerprints" reads as licence to drop the content, in the only section naming prompts and model outputs together. `allowed` → `allowed and resolved` closes a live defect against §8.4 L849, which requires **actual** identities to be recorded.

---

### B6 — `### 14.3 Minimum conformance scenarios` (header L2302) · anchor **L2328** · REPLACE

**CURRENT:**
```
- conformance requires no private chain-of-thought and proves that UI, agent, worker, retry, direct-persistence, and projection paths cannot bypass server-side assurance enforcement.
```
**PROPOSED:**
```
- conformance requires no private chain-of-thought—Reasoning Review reaches a valid Assessment with all volunteered reasoning material withheld, no retained reasoning Artifact appears in a Validator's context or a log, and the scenario exercises the real Validator, since a stub that ignores the input passes this trivially—and proves that UI, agent, worker, retry, direct-persistence, and projection paths cannot bypass server-side assurance enforcement.
```
**Why:** "requires no" is correct and preserved — it is an **ablation** gate, the only formulation writable for both model classes. But as written it told no implementer how to test it, and **zero tests assert this boundary today** despite §14.3 calling it a *minimum* scenario.

---

### A5 — `### 13.5 One codebase, three editions` (header L2241) · anchor **L2251** · INSERT_AFTER

Append to L2251's paragraph, **no intervening blank line** (L2252 is blank).

**PROPOSED — append:**
```
 Editions differ in entitled capability, never in professional semantics or in what a profile means. Where an install cannot supply a required independence or separation capability, the protected transitions requiring it block rather than downgrade. No edition, entitlement, or deployment topology relaxes an invariant.
```
**Why:** pure clarification, restating ratified rules only (§13.5 L2249/L2251, §13.1 L2196, §11.6 L1636, §8.9 L997, §13.3 L2223). No new doctrine, no new term, no ADR. **Independent of the reasoning thread — this one can land alone.**

---

## DEPENDENCY CHAIN — partial landing is dangerous

**Minimum coherent set: B2 + B1 + B4 + A2 + A1 + A6 + B6.** B3, B5, A3 are hygiene and may trail. **A5 is the only edit safe alone.**

- **A1 alone — actively harmful.** It exempts §9.7 from minimization, naming records that do not exist yet, while relaxing a Security invariant.
- **B4 without B2** — `private chain-of-thought` stays undefined and B4's prohibitions revert to the six drifted verbs. B4 is meaningless without B2.
- **B4 without A1** — B4 names `access policy` for the retained material; A1 is what keeps `access policy` attached to prompt/input/output content.
- **B1 without B4** — bans the retention the ruling requires, at principle level.
- **A2 without A6** — §13.4's "retain only" forbids the record on the plane that produces it. A2 lands a dead letter.
- **A2 without B4** — A2's "governed by the rule above" points at nothing.
- **B4 without B6** — the retention-and-non-forwarding regime has **zero conformance witnesses**. The ruling is provisional; B6 is the only thing that detects a regression that silently forwards.
- **B6 without B4** — the gate tests a "retained reasoning Artifact" the guide never authorizes.

---

## WHAT THIS RATIFIES THAT THE GUIDE DOES NOT SAY TODAY

Each line is a duty nothing currently authorizes.

1. **Every prompt actually sent to a model is durably persisted, verbatim.** Today the guide requires an "input reference" and permits a fingerprint.
2. **Every raw model output is durably persisted before schema coercion or repair.** Nothing requires the unrepaired output to survive.
3. **Every retry, reformat, and repair is its own record.** Retry storms become record storms.
4. **Volunteered reasoning material — including a hosted API's summarized thinking block — is durably retained as an Artifact.** The guide today says "do not require or store private chain-of-thought." This inverts it.
5. **A new content class exists whose security weight is the highest in the system and whose retention policy object does not exist.** `retention` is invoked at L456, L2220, L2514 and **defined nowhere**. B4 adds a fourth invocation.
6. **Redaction moves to the boundary, before the content hash** — required by §10.1's immutability (L1353 + L1380: redaction-after-minting mints a successor while the unredacted original persists). But it means **redaction is irreversible at capture**; you cannot un-redact for forensics later.
7. **A minimization ceiling in a non-waivable Security-invariant list is relaxed** so §5.6/8.4/9.7/10.1 records cannot be omitted for volume.
8. **Any model whose reasoning cannot be span-separated from its answer is BLOCKED.** The largest consequence in the set.

---

## WHAT STILL BLOCKS THE CODE

**Pure text — land and the code is unaffected:** B1, B2, B3, B5, A3, A5, A6, A1.

**Fires §16 item 23 immediately:** A2 and B4. Verified above — no `EXECUTION_ATTEMPT` object type, and `ARTIFACT` is an envelope with no content. **B6 cannot be written as a test until A2 and B4 have schemas.**

Net effect: the model/agent execution capability blocks under item 23's own instruction — *"Never interpret the missing wire shape as permission to omit or hide the floor"* (L2516). Correct under "fix the code to the guide." **It is not a fix. It is a block.**

**Out of scope, not performed:** the code audit — which stores, Events, traces, prompts, projections, fixtures, and logs touch reasoning material today, and which B4 now permits vs forbids.

---

## OPEN QUESTIONS — three

**Q1 — Does reasoning material "participate in execution" under §10.1 L1368?**
B4's purgeability sentence asserts it does not, so no-hard-delete does not reach it and retention can expire. **Thinnest link in the set.** If you read a typed Artifact *of an Execution Attempt* as having participated in execution, L1368 binds, the material can never be deleted, and **the ruling's provisional character is defeated on landing** — reversal would stop future retention and purge nothing. If you reject the interpretation, B4 needs an explicit §10.1 amendment naming a deletable class: real doctrine, separate edit.

**Q2 — Accept blocking the local/open-weight model class where reasoning cannot be span-separated?**
The origin axis was adopted to bind both classes without a carve-out. Correctly applied, that binds the class whose reasoning is inseparable from its answer, and the honest consequence is item 23 and a block. The alternative is a provider carve-out the ruling explicitly refused. **Confirm the block is intended.**

**Q3 — Land now and block, or hold until an ATTEMPT / Artifact-content contract exists?**
A2 and B4 are unimplementable against today's contracts. Landing makes the guide correct and the code non-conformant-and-blocked. Holding leaves the guide authorizing the current violation. "Fix the code to the guide" argues for landing — but the interval between landing and contract evolution is an interval with a blocked capability.

*Deliberately left silent: whether a human may inspect a retained reasoning Artifact for incident forensics. B4 bars default and shared projections and says nothing about authorized retrieval. Left until an incident forces it — the ruling is provisional.*

---

## VERIFICATION NOTES

**Caught and corrected in the merge (each was a real defect):**
- B4's `Material that arrives **is generated prose**:` — **struck**. `generated prose` occurs exactly once in the guide, at L1034, whose text is "…**until admitted as Evidence**." B4 assigned the material to the guide's own admission path, then banned admission from a different section.
- B4's `never **carries** a finding` → `never **supports** a finding`. The merge's own adjudication log **falsely self-reported these as aligned**. "Carries" predicates the finding *of* the material — inverted and near-vacuous.
- B4's redaction moved **before** the hash (§10.1 L1353 immutability + L1380 successor-on-correction make redaction-after-minting impossible).
- B5's `a reasoning account` → `a professional rationale summary`. `reasoning account` = **0 occurrences**; it coined a third term inside the very section B4 leans on, reproducing the vacuum B2 exists to close.
- A1's rewrite reverted — it had deleted the only `access policy` floor (1 occurrence, L2220) over the content A2/B4 newly mandate retaining.
- A4 cut entirely (contradicted the ruling); B3's handoff sentence cut (§9.7 is the sole home).

**Citation defects found, reported not hidden — four more, from the verifier lenses:**
1. `boundary` lens cited **L217** for text that is at **L216**.
2. `internal` lens: `header '## 2. Governing principles' at L~...` — the **`L~` approximation tell**. Header is at **L159**.
3. `internal` lens: `header '### 14.3 …' at L2312 region` — another tell. Header is at **L2302**.
4. `mechanics` lens rendered L1366's `items 24–25` (U+2013) as ASCII `24-25`.

**Missed by every lens:** **L1974** (`#### 11.7.5 Micro-assurance and Reasoning Review`, header L1959) is a **third** site stating Reasoning Review does not consume the material. Consistent with the ruling, needs no edit — but claims about how many sites a reversal would touch were made without verifying it.
