# JAN-PFA — PRECISION-GAP INVENTORY: 40 unguarded promises in `rph-application`
**Status:** ~~⚠ FINDINGS, NOT GUARDS.~~ → ✅ **DISCHARGED 2026-09-13. ALL FORTY ARE CLOSED.** Opened 2026-09-12 ·
Programme `JAN-PFA` `S3.3` · see `REG-F-392` (the finding), `REG-F-393`/`394`/`395` (what closing them found).

⭐ **HOW THEY WERE DISCHARGED, AND IT WAS NOT BY DECLARING FORTY MUTANTS.** Two assertion-first increments worked
the whole list off: **increment 1** took the eighteen in `handlers/assurance.ts` — 17 closed, and
`activateAssurancePolicy` **correctly REFUSED** because its arm is unreachable by any command, which is a
different finding wearing the same `SURVIVED` verdict; **increment 2** took the remaining twenty-two across
`handlers/pwa-authoring.ts` and `handlers/pwu.ts`, plus three exports this inventory never held
(`escalatePwu`, `reshapePwu`, `supersedePwu` — rejected during authoring for naming two victims, and therefore
invisible here). **42 mutants declared across the two increments, 42 KILLED, zero survivors.**

⚠ **THE ENTRIES BELOW ARE LEFT EXACTLY AS MEASURED** — including the bias this document records against itself,
and including each gap's suggested remedy, several of which the closing agents did NOT follow. Where a remedy was
declined the reason is in the landed test's own header and in the register; `activateAssurancePolicy`'s proposed
fix — write the store directly to reach the arm — is the clearest case, and declining it was correct.

## Why this is a document and not forty ledger entries

Forty mutants were authored against three command-handler files and **all forty SURVIVED** — verified by the
runner and then re-confirmed by hand on two of them (apply, run the named victim directly, restore: the victim
passes in both states). So each one names a real promise that nothing currently asserts.

⛔ **THEY ARE NOT IN THE LEDGER, AND THAT IS DELIBERATE.** `SURVIVED` is a blocking verdict: the ledger is a record
of guards that have been PROVEN to discriminate, and forty surviving entries would both fail the gate and assert
the opposite of what the ledger means. They were appended, measured, and removed again; the measurement is here.

⚠ **AND THE BATCH WAS BIASED BY ITS OWN BRIEF.** Increment 4 had found five gaps sharing one shape — *the guard's
obvious failure was tested and its precision was not* — so this batch's authors were told that **a survivor is the
most valuable outcome available**. They complied, and 37 of 37 predicted their own survival before anything ran.
⭐ That instruction rewards SELECTING FOR expected survival, which biases toward the most obscure edge of each
promise rather than the most load-bearing one. One author demonstrated it honestly: `activate-floor-lock-inert`
targets an arm the same author had just proven UNREACHABLE, so its survival reports a DEAD GUARD, not an
exploitable hole. ⭑ **Read this inventory as a list of precision edges, ordered by nothing, not as a severity
ranking.**

## The method defect this exposed

The burn-down has been running **author-the-mutant, then remediate the survivors**. That works when survivors are
a minority — increment 4 was 5 of 45. ⛔ **It breaks when they are the majority**, because the remediation stops
being a correction and becomes the entire programme, and the ledger cannot hold the intermediate state. For a
layer with pervasive precision gaps the correct order is the one Phase 0 and `S0.3` used: **write the assertion
first, then declare the mutant that proves it discriminates.**

---

## `packages/rph-application/src/handlers/assurance.ts` — 18 gaps
### `activateAssurancePolicy`
- **mutation** `precondition: fromStates('DRAFT', 'SUSPENDED'),
		guard: rejectIfFloorLocked(command)` → `precondition: fromStates('DRAFT', 'SUSPENDED'),
		guard: () => null`
- **promise** PROMISE: a locked de minimis floor policy can never be put into force (§8.4 / INV-5); the guard is the only thing at this site that refuses in its own voice ('is locked (always-applies, non-waivable)'). TWO THINGS ARE TRUE AND ONLY ONE IS A GAP, so I state both: (a) nothing asserts it — zero tests in the repo dispatch ActivateAssurancePolicy against a floor id (assurance-policy.test.ts:125 covers edit/suspend/supersede only); (b) the arm is also UNREACHABLE — a floor policy is born ACTIVE (bornStatus) and Suspend/Edit reject it, so no command can place…
- ⭐ **would kill it** a test that places a floor-id policy in DRAFT/SUSPENDED directly in the store and then activates it, asserting RPH_INVARIANT_VIOLATION and the 'is locked' message — the SUSPEND arm of the same helper is asserted that way (assurance-policy.test.ts:134), so the helper itself is not in doubt, only this call site. NOTE the
- **named victim** `packages/rph-application/src/handlers/assurance-policy.test.ts`
### `admitEvidence`
- **mutation** `verdict.failed.join(', ')` → `verdict.failed[0] ?? ''`
- **promise** PROMISE: the refusal enumerates EVERY §8.11 condition the evidence failed, so the caller can act on it (PER-9's 'a reason a reader cannot act on is the silent omission'), AND the enforcement register discriminates two rules refused by THIS ONE guard purely by the condition NAME in this message — RPH-EVD-003's marker is 'is inadmissible (§8.11) — failed CONTENT_AVAILABLE' and RPH-EVD-007's is the SCOPE_STATED twin, with the register's own note saying 'a marker stopping at "failed" would let one arrangement green both rows'. I first aimed at the guard's…
- ⭐ **would kill it** an arrangement in evidence-admissibility-gate.test.ts proposing evidence that fails TWO conditions (contentReference {} AND scope '') and asserting the message names both.
- **named victim** `packages/rph-application/src/handlers/evidence-admissibility-gate.test.ts`
### `assertClaim`
- **mutation** `claimId: id,` → `claimId: p.subjectObjectIds[0] ?? id,`
- **promise** PROMISE: the §13.1 ClaimAsserted event identifies the CLAIM it records — `claimId` is the command's target aggregate id, and the handler's own comment says so because AssertClaim's payload carries no claim id at all (AssertClaimPayloadSchema has statement/claimType/subjectObjectIds only). Who relies on it: traceabilityProjector builds its ABOUT links as claimId -> each subjectObjectId (traceability-view.ts:54), and any audit reader joining a claim's events by payload id. Under the mutant the event names the claim's FIRST SUBJECT instead, so every ABOUT…
- ⭐ **would kill it** an ABOUT-link assertion in projection-trace-compat.test.ts (the only suite that folds the traceability projector over LIVE engine events — today it asserts DECOMPOSES and TRACES_TO_INTENT and no ABOUT link). The existing ABOUT assertion, traceability-compatibility.test.ts:47, is built on hand-written events and therefo
- **named victim** `packages/rph-engine/src/projection-trace-compat.test.ts`
### `beginAssuranceAssessment`
- **mutation** `policyVersion: next.policyVersion,
			subjectObjectIds: next.subjectObjectIds,` → `policyVersion: String(next.semanticVersion as Stringifiable),
			subjectObjectIds: next.subjectObjectIds,`
- **promise** PROMISE: AssuranceAssessmentStarted names the POLICY VERSION the assessment is judged under — the §18 pin ('assessments pin policySemanticVersion'), and the §38 Assurance View's source for 'applicable policies' (assurance-view.ts:162 reads p.policyVersion off this event). The mutant substitutes the ASSESSMENT's own envelope semanticVersion: an adjacent, same-shaped version number that is always present and always schema-valid (z.string()), so the event reports a policy version the policy never had and no stale-pin check downstream can tell. This is the…
- ⭐ **would kill it** one more line in that same block of reference-undertaking.test.ts asserting started.payload.policyVersion equals the version the request pinned. assessment-ready-arrow.test.ts cannot ever see it: its fixture pins policyVersion '1', which is also the assessment's semanticVersion, so real and mutant agree there by coinci
- **named victim** `packages/rph-engine/src/reference-undertaking.test.ts`
### `cancelAssuranceAssessment`
- **mutation** `const cancelledFromState = String(loaded.state.assessmentState);` → `const cancelledFromState = 'EVIDENCE_PENDING';`
- **promise** PROMISE, in the handler's own words and in the test's: the value is captured BEFORE the transition because 'an assessment abandoned in EVIDENCE_PENDING (evidence never arrived) and one abandoned in ASSESSING (the assessor withdrew) are different facts, and ONLY THE EVENT WILL EVER HOLD THE DIFFERENCE' — the terminal state records CANCELLED and nothing about where it came from. The precision gap is that the suite asserts the value for ONE from-state and establishes the command's RATIFIED BREADTH against a different object:…
- ⭐ **would kill it** a second engine-driven cancel in that file — from ASSESSING (or READY) — asserting cancelledFromState equals that state. NOTE I deliberately did not mutate the four-state precondition instead: verif/arrow-command-census.ts AST-reads fromStates(...) and would redden as a census, not as a behavioural test.
- **named victim** `packages/rph-application/src/handlers/assessment-cancellation.test.ts`
### `completeAssuranceAssessment`
- **mutation** `? (ctx.store.loadObject(assessmentState.assurancePolicyId)?.state as` → `? (ctx.store.loadObject((command.payload as { validatorResult?: { policyId?: string } } | undefined)?.validatorResult?.policyId ?? assessmentState.ass`
- **promise** PROMISE: the policy whose rules govern this completion is the one the ASSESSMENT pins (assessmentState.assurancePolicyId — §18's version/policy pin), consulted from committed state, NOT the one the validator reports about itself. Everything in the completion path hangs off that one load: independenceRequirement (§39 inv-8), dispositionRules (Gate C foreclosure AND JAN-DISPIND's requiredIndependence), permittedControlActions (Gate B), requiredEvidence (Gate A), escalationRules (Gate D). Under the mutant a validator that names a permissive policy in its…
- ⭐ **would kill it** one arrangement with two ACTIVE policies, strict and permissive, where the assessment is pinned to the strict one and the validatorResult names the permissive one, asserting the strict policy's gate still refuses.
- **named victim** `packages/rph-application/src/handlers/assurance-independence.test.ts`
### `createAssurancePolicy`
- **mutation** `const bornStatus = FLOOR_POLICY_ID_SET.has(p.policyId) ? 'ACTIVE' : 'DRAFT';` → `const bornStatus = [...FLOOR_POLICY_ID_SET].some((f) => p.policyId.startsWith(f)) ? 'ACTIVE' : 'DRAFT';`
- **promise** PROMISE: ONLY the three de minimis floor ids are born ACTIVE; every other policy is born DRAFT and must be deliberately activated (DOC-002 §18's ratified initial state — the handler's own comment records that writing ACTIVE for ALL policies was the defect, making the reference undertaking's Activate a meaningless no-op). requestAssuranceAssessment relies on it: ACTIVE is what lets a policy govern, so a policy born ACTIVE governs having never been activated. MEMBERSHIP is checked; its EXACTNESS is not. Under prefix matching…
- ⭐ **would kill it** a create of a policy whose id has a floor id as a strict PREFIX, asserting status DRAFT — assurance-policy.test.ts owns both birth assertions (:90 catalog DRAFT, :127 floor ACTIVE) and both use EXACT ids, which is what makes the gap invisible. No such fixture exists: every seeded id is pol_* (ontology.data.ts) and the
- **named victim** `packages/rph-application/src/handlers/assurance-policy.test.ts`
### `detectAssumption`
- **mutation** `status: state.status,` → `status: 'DISCLOSED',`
- **promise** PROMISE, and it is argued at length in the docblock rather than assumed: the AssumptionDetected event reports the status the object ACTUALLY has (PROPOSED), NOT §12.2's literal `status: 'DISCLOSED'` — 'Emitting DISCLOSED would make the event contradict the object it describes', because DOC-002 §26.3 makes DISCLOSED a separate AssumptionDisclosed transition. This mutant re-introduces exactly the value the handler deliberately refused, and AssumptionStatusSchema accepts it, so the (d2) event gate passes it. Who relies on it: every reader of the governed…
- ⭐ **would kill it** assurance-absent-versus-supplied.test.ts:335, the one suite that reads this payload — it asserts sourceArtifactId and sourceExecutionAttemptId and says nothing about status. assumption-falsification.test.ts:136 pins PROPOSED on the OBJECT, which the mutant leaves untouched; replay-conformance compares event TYPE sequen
- **named victim** `packages/rph-application/src/handlers/assurance-absent-versus-supplied.test.ts`
### `discloseAssumption`
- **mutation** `eventPayload: () => ({ status: 'DISCLOSED' })` → `eventPayload: () => ({ status: 'PROPOSED' })`
- **promise** PROMISE: the event records the RESULTING state (the convention this file states at proposeEvidence: 'The event records the RESULTING state'), and AssumptionDisclosedPayloadSchema has exactly ONE field — status — so this event carries nothing else. Under the mutant its single field reports the PRE-state, which is the copy-paste error the sibling handler's value would produce: an AssumptionDisclosed that asserts the assumption is still PROPOSED conveys zero correct information about the transition it exists to record, while the schema…
- ⭐ **would kill it** an assertion on the AssumptionDisclosed payload in assumption-falsification.test.ts, which drives DiscloseAssumption (:136 'DiscloseAssumption reaches DISCLOSED') but reads only the OBJECT's status. NOTE on what I did NOT mutate here: this handler's only other live declarations are the precondition and the target, and
- **named victim** `packages/rph-application/src/handlers/assumption-falsification.test.ts`
### `editAssurancePolicy`
- **mutation** `(p.permittedControlActions ?? loaded.state.permittedControlActions) as` → `// MUTANT: the EFFECTIVE permitted set is not consulted -- only what this edit resupplies
		p.permittedControlActions as`
- **promise** THE PROMISE, in the handler's own words at the call site: "the effective remediationRules (new or existing) must keep remediationActions subset of the effective permitted set, so an edit that narrows permittedControlActions OR REVISES remediationRules cannot leave an ungoverned remediation action behind" (DOC-004 section 11). The merge has TWO halves and only ONE is tested. This mutant leaves the remediationRules half (the tested half: '#5 remediationRules EDIT-PATH: narrowing permittedControlActions to orphan an EXISTING remediation action is…
- ⭐ **would kill it** the mirror of the narrowing test in the same '#5 EDIT-PATH' family -- an EditAssurancePolicy carrying `remediationRules: [{ remediationActions: ['ABANDON'] }]` and NO permittedControlActions, expecting REJECTED. Only one direction of the effective merge has that test.
- **named victim** `packages/rph-application/src/handlers/assurance-independence.test.ts`
### `expireAssumption`
- **mutation** `...(p.expirationCondition ? { expirationCondition: p.expirationCondition } : {})` → `...(p.expirationCondition ? {} : {}) // MUTANT: the supplied expiration condition never reaches the event`
- **promise** THE PROMISE: every one of the machine's four in-arrows to EXPIRED carries the guard 'expirationCondition met; expired assumptions cannot continue authorizing work (section 12.2)', and AssumptionExpiredPayloadSchema declares `expirationCondition` -- the only record of WHY the premise lapsed, because this handler writes it onto NO object field (it rides the event alone). The mutant keeps the expiry itself (so RPH-ASM-006 still blocks new work at ApproveExecutionPlan and every status assertion stays green) and drops the condition from the governed,…
- ⭐ **would kill it** this is exactly the family assurance-absent-versus-supplied.test.ts was built for -- 'the optional facts a creation command accepts must survive onto its event', asserted there for EvidenceProposed, AssumptionDetected and ClaimContested and never for AssumptionExpired. The killing line belongs in dwp03 (the suite that
- **named victim** `packages/rph-application/src/handlers/dwp03-precondition-coverage.test.ts`
### `falsifyAssumption`
- **mutation** `p.contradictingEvidenceIds` → `p.contradictingEvidenceIds.slice(0, 1) // MUTANT: only the FIRST cited evidence reaches the ratified event`
- **promise** THE PROMISE: contradicting evidence is CONSTITUTIVE of falsification (RPH-ASM-004 / section 12.2 / section 29.1) -- 'it is not a note attached to the act, it is the act's basis' -- and ASR-8 requires the contradicting artifact to remain attached and visible. This handler's docblock records that the ratified HOME of those ids is the EVENT and NOT the object ('Adding the field to a ratified object to match my own citation would have been the invention'), so AssumptionFalsified.contradictingEvidenceIds is the ENTIRE record of what falsified the premise.…
- ⭐ **would kill it** assumption-falsification.test.ts cites exactly ONE id (falsify([EV])) and asserts toEqual([EV]); the killing assertion is the same test with TWO cited ids -- the defect shape its own sibling already pins for claims (evidence-invalidation-impact.test.ts:144: 'A wiring that took the first SUPPORTS link would satisfy not
- **named victim** `packages/rph-application/src/handlers/assumption-falsification.test.ts`
### `proposeEvidence`
- **mutation** `supportsClaimIds: p.supportsClaimIds,
		contradictsClaimIds: p.contradictsClaimIds,` → `// MUTANT: contradicting evidence is stored as SUPPORTING as well
		supportsClaimIds: [...p.supportsClaimIds, ...p.contradictsClaimIds],
		contradicts`
- **promise** THE PROMISE: RPH-EVD-002 / Inv-3 -- a Claim may reach SUPPORTED only when ADMISSIBLE evidence SUPPORTS it, and `supportsClaimIds` / `contradictsClaimIds` are the two ratified, opposite-signed fields that decide which. This mutant writes the contradicting ids into the supporting slot of the COMMITTED STATE, leaving the emitted EvidenceProposed payload honest (so supportsGraph, the SUPPORTS trace links and the invalidation cascade are all untouched and their tests stay green). WHO RELIES ON IT: claimsWithAdmissibleEvidence (assurance.ts:702), whose whole…
- ⭐ **would kill it** claim-assessment.test.ts already owns the adjacent control -- 'admissible evidence supporting a DIFFERENT claim does not support this one' -- but nothing tests the opposite SIGN. Its twin is the killing assertion: admit evidence whose contradictsClaimIds names the claim and expect SUPPORTED to be refused. Every non-emp
- **named victim** `packages/rph-application/src/handlers/claim-assessment.test.ts`
### `recordAssuranceObservation`
- **mutation** `policyId: assessment.assurancePolicyId ?? p.assessmentId,` → `policyId: p.assessmentId, // MUTANT: the policy is NOT inherited from the assessment`
- **promise** THE PROMISE: section 21.1 makes `policyId` a REQUIRED field of AssuranceObservationRecorded, and the observation INHERITS it from the assessment -- stated in the sibling test's own words: 'The observation inherits its policy and subjects FROM the assessment. Against a missing one it would inherit undefined for both and persist an observation attached to nothing -- a finding in the log that no assessment ever made.' Only the NEGATIVE half of that sentence is asserted (the missing-assessment refusal, by exact message). The inherited VALUE is asserted…
- ⭐ **would kill it** the positive twin of that same test -- record a finding against a REAL assessment and assert the emitted policyId equals the assessment's assurancePolicyId (and that the object's matches).
- **named victim** `packages/rph-application/src/handlers/assurance-absent-versus-supplied.test.ts`
### `selectAssuranceEvaluator`
- **mutation** `...(policy?.independenceRequirement
				? { independenceRequirement: policy.independenceRequirement }
				: {})` → `// MUTANT: a constant, not the requirement in force at selection
			...(policy?.independenceRequirement ? { independenceRequirement: 'NONE' } : {})`
- **promise** THE PROMISE, verbatim at the site: 'The policy's requirement is resolved HERE and recorded on the event, so an audit reads what independence was required AT SELECTION TIME rather than what the policy happens to require now' -- DOC-004 section 22 requires the audit log to record the independence result and section 38 requires the view to show independence status. The cheap inverse (drop the spread, record nothing) IS killed by the existing test; its PRECISION is not, because the only assertion anywhere on this field is toBeTruthy(). The mutant keeps the…
- ⭐ **would kill it** assessment-ready-arrow.test.ts seeds seedPolicy(engine,'pol_arch'), whose default independenceRequirement is 'NONE' (floor-fixtures.ts:165) -- so HEAD and mutant are byte-identical there. seedPolicy already accepts the option: seed 'DIFFERENT_MODEL' and assert .toBe('DIFFERENT_MODEL') in place of .toBeTruthy().
- **named victim** `packages/rph-application/src/handlers/assessment-ready-arrow.test.ts`
### `submitEvidenceForAssessment`
- **mutation** `const advancesToReady = assessmentState === 'EVIDENCE_PENDING' && stillOutstanding.length === 0;` → `// MUTANT: off by one -- the LAST outstanding requirement no longer holds the arrow
	const advancesToReady = assessmentState === 'EVIDENCE_PENDING' &&`
- **promise** THE PROMISE: section 30's guard on the EVIDENCE_PENDING -> READY arrow is 'all required evidence present', section 32 names THIS command as the arrow's trigger, and the handler states the consequence: 'the arrow is taken HERE, at the moment the last outstanding requirement is satisfied -- required MINUS received, the same difference section 38 folds missing evidence from and the same one Gate A recomputes at completion, so the view, this arrow, and the completion gate cannot disagree.' One off, and the arrow fires with a mandatory requirement still…
- ⭐ **would kill it** the two-requirement arrangement ALREADY EXISTS -- assurance-independence.test.ts:480 declares requiredEvidence [EV-01, EV-02], both requiredForDispositions 'ALL' and AT_LEAST_ONE, and submits only EV-01 -- and it never asserts the resulting assessmentState. One line there, expect(stateOf(A)?.assessmentState).toBe('EVID
- **named victim** `packages/rph-application/src/handlers/assurance-independence.test.ts`
### `supersedeAssurancePolicy`
- **mutation** `precondition: fromStates('ACTIVE', 'SUSPENDED'),
		guard: rejectIfFloorLocked(command),` → `precondition: fromStates('ACTIVE', 'SUSPENDED'),
		guard: rejectIfFloorLocked(command),
		// MUTANT: the successor is dropped from the governed event;`
- **promise** THE PROMISE: DOC-002 section 27 -- an event records the ACCEPTED state change, and the append-only log is the only durable account of it (kit.ts's event gate: 'A malformed event is not a bad request; it is a permanently wrong history'). `AssurancePolicySupersededPayloadSchema` declares `supersededByPolicyId`: the single fact saying WHICH version replaced this one, and section 18 pins every assessment to a policy version, so a reader reconstructing policy succession from the stream has only this field. The mutant leaves the OBJECT's `superseded-by:<id>`…
- ⭐ **would kill it** dwp04 already isolates this command's event (it counts AssurancePolicySuperseded and asserts the tag is not compounded); the missing line is an assertion on that one event's payload -- expect(the AssurancePolicySuperseded payload).supersededByPolicyId to be the successor id. This is ledger-precedent F-I's shape: an aud
- **named victim** `packages/rph-application/src/handlers/dwp04-precondition-coverage.test.ts`
### `suspendAssurancePolicy`
- **mutation** `eventType: 'AssurancePolicySuspended',
		precondition: fromStates('ACTIVE'),
		guard: rejectIfFloorLocked(command)` → `eventType: 'AssurancePolicySuspended',
		precondition: fromStates('ACTIVE'),
		// MUTANT: only ONE of the three de minimis floor policies is locked ag`
- **promise** THE PROMISE: the THREE de minimis floor policies (guide section 8.4) are LOCKED -- always-apply, non-waivable, non-editable, non-suspendable -- and the file states it as a set: FLOOR_POLICY_ID_SET is built from every value of the canonical FLOOR_POLICY_IDS, precisely so no literal copy can drift. The guard's obvious failure is tested and its COVERAGE is not: the mutant keeps the lock for floor.reasoning-review -- the only id any test ever passes -- and drops it for floor.schema-invariant and floor.identity-provenance, so a professional can SUSPEND the…
- ⭐ **would kill it** assurance-policy.test.ts's 'locks the de minimis floor policies: they reject edit / suspend / supersede' hard-codes FLOOR = 'floor.reasoning-review'; deriving that test's ids from FLOOR_POLICY_IDS (all three) kills this mutant and also closes the same hole for Edit and Supersede, which share the helper.
- **named victim** `packages/rph-application/src/handlers/assurance-policy.test.ts`

## `packages/rph-application/src/handlers/pwa-authoring.ts` — 13 gaps
### `appendConversationEntries`
- **mutation** `entries: [...prior, ...p.entries]` → `entries: [...p.entries, ...prior]`
- **promise** THE PROMISE: the docblock calls this 'the durable, event-sourced transcript of the authoring agent's work' and says 'subsequent appends extend its ordered ENTRIES' — the append is an EXTENSION, so turn N+1 lands after turn N. Who relies: the authoring UI renders `state.entries` in array order as the conversation, and the docblock declares it 'part of the authoritative audit trail', where the SEQUENCE of a tool call and its result is the whole content of the record (a `tool_result` rendered before the `message` that asked for it is a false account of…
- ⭐ **would kill it** one assertion in pwa-authoring.test.ts:197 after the second append — e.g. `expect((c.entries[0] as {text: string}).text).toBe('build it')`, or asserting the three texts in order — which is the single line that separates 'the transcript grew' from 'the transcript is a transcript'.
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `createPwa`
- **mutation** `eventPayload: { pwaId: p.pwaId, name: p.name, version: p.version }` → `eventPayload: { pwaId: p.pwaId, name: p.domain, version: p.version }`
- **promise** THE PROMISE: `PwaCreated` has a RATIFIED interface (messages.ts:1774 `PwaCreatedPayloadSchema` = strictObject{pwaId, name, version}) and this line is the REG-F-020 declaration that fills it — each declared field bound to the fact it names. Who relies: the append-only event log, which kit.ts's own event gate calls 'the audit record, the replay source, the only durable account of why the system did what it did' and whose failure mode it states as 'not a bad request; it is a permanently wrong history' — there is no retraction mechanism, so a PwaCreated…
- ⭐ **would kill it** an assertion on the recorded event rather than the object state — in pwa-authoring.test.ts, read the PwaCreated event and `expect(payload.name).toBe('<the name passed to CreatePwa>')`. Note the asymmetry this exploits: the PWA's STATE `name`/`version` are asserted (pwa-version-binding.test.ts:202 pins state.version; dw
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `createUndertaking`
- **mutation** `if (pwa.publicationStatus !== 'PUBLISHED') {` → `if (pwa.publicationStatus !== 'PUBLISHED' && pwa.publicationStatus !== 'DEPRECATED') {`
- **promise** THE PROMISE: §42, quoted in this file's own header and the handler's docblock — 'an Undertaking is instantiated from a PUBLISHED PWA version' / 'CreateUndertaking binds the exact PWA version'. Who relies: deprecation itself. DEPRECATED is the state whose entire operational meaning is 'existing Undertakings continue, no NEW work starts here' — deletePwa's docblock names it as the prescribed remedy for a PWA that is in use ('Deprecate/retire it instead'), which is only a remedy if deprecating actually stops new instantiation. Widen the gate by one…
- ⭐ **would kill it** extend that test past the accepted case — deprecate the PWA, then issue CreateUndertaking for a second undertakingId and assert REJECTED (and the same after RetirePwa), which also decides the sibling question the suite never asks.
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `definePwuType`
- **mutation** `if (pwa.publicationStatus !== 'DRAFT') {` → `if (pwa.publicationStatus !== 'DRAFT' && pwa.publicationStatus !== 'UNDER_REVIEW') {`
- **promise** THE PROMISE: the handler's own docblock — 'create a PWU Type under a DRAFT PWA (types are edited draft-only, §39)' — i.e. the graph is FROZEN the moment it is submitted for review. Who relies: the reviewer, and then every version-bound assurance record. §20's flow is DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED, and this file's own bumpPwaSemanticVersion exists because 'a floor satisfied over a 1-type graph silently authorized publication of a graph a PWU Type had been smuggled into afterwards' (§10.1 L1379 / §8.4 L854). Widening the window to…
- ⭐ **would kill it** submit first, then define — `expect(d('SubmitPwaForReview'...).status).toBe('ACCEPTED')` followed by a DefinePwuType asserted REJECTED with the DRAFT message, in pwa-authoring.test.ts beside the PUBLISHED case.
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `deletePwa`
- **mutation** `return reject(command, 'RPH_INVARIANT_VIOLATION', `PWA ${id} is already deleted`);` → `return reject(command, 'RPH_VALIDATION_SEMANTIC_FAILED', `PWA ${id} is already deleted`);`
- **promise** THE PROMISE: a refusal carries the RIGHT code. The docblock makes this branch's existence load-bearing — 'Idempotent-safe: a second delete of an already-DISCARDED PWA is rejected by the EXPLICIT already-DISCARDED guard below' — and DOC-007 §25.1's taxonomy separates 'the command is semantically inapplicable to this target' (RPH_VALIDATION_SEMANTIC_FAILED, which loadOrReject uses for 'Aggregate X does not exist') from a domain-invariant refusal. The mutation makes a DELIBERATE TOMBSTONE report the same code as an aggregate that NEVER EXISTED — two…
- ⭐ **would kill it** `expect(second.error?.code).toBe('RPH_INVARIANT_VIOLATION')` on the second delete — one line in the suite already built to pin codes and messages for the other two DeletePwa refusals.
- **named victim** `packages/rph-application/src/handlers/pwa-authoring-write-integrity.test.ts`
### `deprecatePwa`
- **mutation** `target: 'DEPRECATED',` → `target: 'DEPRECATED',
		bumpSemanticVersion: true,`
- **promise** THE PROMISE, and it is the CONVERSE of the one this module spends 40 lines building: the PWA's semanticVersion moves WHEN AND ONLY WHEN its graph is materially edited. bumpPwaSemanticVersion exists because nothing moved it ('a floor satisfied over a 1-type graph silently authorized publication of a graph a PWU Type had been smuggled into afterwards'), and §10.1 L1379 — 'Claims, Assessments, Decisions, and waivers bind exact subject semantic versions' — is what makes the number a STALENESS SIGNAL. A signal that also fires on a pure lifecycle hop is…
- ⭐ **would kill it** read the PWA's semanticVersion before and after `deprecate()` in dwp05:420 and assert it unchanged (the revision assertion three lines below is already there; this is its missing twin).
- **named victim** `packages/rph-application/src/handlers/dwp05-precondition-coverage.test.ts`
### `editPwa`
- **mutation** `if (loaded.state.publicationStatus !== 'DRAFT') {` → `if (loaded.state.publicationStatus !== 'DRAFT' && loaded.state.publicationStatus !== 'VALIDATED') {`
- **promise** THE PROMISE, stated twice and in the broader form both times: the handler docblock — 'update a DRAFT PWA's metadata in place... so this rejects unless publicationStatus is DRAFT' — and pwa-version-binding.test.ts:188-190's own comment, 'editPwa is the ONLY writer of `version` after creation and IT REFUSES OUTSIDE DRAFT, and the publication machine has no arrow back to DRAFT — so once PUBLISHED, the version string is frozen'. Who relies: RPH-CON-009. `definePwuType` stamps each type with the PWA's version AT DEFINITION TIME (pwaVersion: pwa.version) and…
- ⭐ **would kill it** in pwa-version-binding.test.ts, drive SubmitPwaForReview + ValidatePwa (the suite's `driveToPublished` already issues both) and assert EditPwa is refused BEFORE publishing, not only after.
- **named victim** `packages/rph-application/src/handlers/pwa-version-binding.test.ts`
### `editPwuType`
- **mutation** `'permittedChildTypeIds',` → ``
- **promise** THE PROMISE: a PwuTypeRedefined event records the fields the edit actually changed -- the anchor's own comment says 'Only fields actually PRESENT are emitted, so the event records what the edit changed rather than asserting undefined for what it did not', backed by DOC-002 SS27 / DOC-007 SS9.1 ('the accepted facts, not the original request') and by the twenty-one REG-F-020 defects verif/emitted-event-guard.ts closed, every one of which was an event whose payload did not carry what the act did. permittedChildTypeIds is the one field in that whitelist…
- ⭐ **would kill it** pwa-authoring.test.ts:547-570 dispatches the edit that sets permittedChildTypeIds: [CHILD] and asserts only the resulting STATE -- it needs one line asserting the emitted PwuTypeRedefined payload carries the new edge list. NOTE THE ASYMMETRY THE MUTANT EXPLOITS: the (d2) event gate and verif/emitted-event-guard both pu
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `publishPwa`
- **mutation** `precondition: fromStates('VALIDATED'),` → `bumpSemanticVersion: true,
		precondition: fromStates('VALIDATED'),`
- **promise** THE PROMISE: a PWA's semanticVersion is the MATERIAL-CHANGE counter every version-bound record binds (SS10.1 L1379, 'Claims, Assessments, Decisions, and waivers bind exact subject semantic versions'), so a publication-status ARROW must not move it -- the handler raises it only for a material graph edit (pwa-authoring.ts:818 and :902, withPwaVersionBump). The identical promise is already asserted one door down for a REFUSED edit, pwa-authoring-write-integrity.test.ts:346-348: 'The refused edit must not have raised the PWA's semanticVersion -- a floor…
- ⭐ **would kill it** 'a successful PublishPwa leaves semanticVersion exactly where the floor was judged' -- it exists nowhere; pwa-authoring.test.ts drives two successful publishes (:111, :845) and asserts publicationStatus and rootPwuTypeId only, and every other publish in that file is REJECTED (no commit, so no bump).
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `removePwuType`
- **mutation** `const refs = referencingSiblings(ctx, String(loaded.state.pwaId), id);` → `const refs = referencingSiblings(ctx, String(loaded.state.pwaId), String((command.payload as { pwuTypeId?: string }).pwuTypeId));`
- **promise** THE PROMISE: RemovePwuType's referential-integrity refusal is about the aggregate the command TARGETS -- 'Referential integrity is now enforced HERE (the domain), not just the UI: don't strand a dangling reference' (the anchor's own comment). The subject of that census must be the target the handler just loaded and is about to tombstone (id = command.targetAggregateId, :872); command.payload is client-supplied and, MEASURED, unchecked -- the command bus performs no payload/target id coherence check, so RemovePwuType targeting CHILD while declaring…
- ⭐ **would kill it** the integrity refusal driven with a payload id that DIFFERS from the target. pwa-authoring.test.ts:547-570 is the home of that refusal and all three of its RemovePwuType dispatches pass payload.pwuTypeId === targetAggregateId, so the mutated census reads the same id and the suite cannot tell the two apart.
- **named victim** `packages/rph-application/src/handlers/pwa-authoring.test.ts`
### `retirePwa`
- **mutation** `export const retirePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {` → `export const retirePwa: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, { ...command, expectedRevision: undefined }, {`
- **promise** THE PROMISE: RPH-CON-003 optimistic concurrency, honoured for every update by loadOrReject -- 'When the client sends it, it must match the aggregate's current revision -- otherwise the client acted on a stale read and applying the update would be silent last-write-wins' (kit.ts:137-147). The mutant leaves the check in place and removes its INPUT for this one command, which is precisely the fail-open that comment describes; nothing else about the command copy changes (commandId, idempotencyKey, payload hash, issuer and correlation all survive the…
- ⭐ **would kill it** a stale-expectedRevision RetirePwa expecting CONFLICT. This module has that assertion only for AppendConversationEntries (pwa-authoring-write-integrity.test.ts:237-260) and the repo has it for BeginIntentDiscovery (intent.test.ts:180-190); none of the five PWA publication arrows has one, and dwp05's harness builds ever
- **named victim** `packages/rph-application/src/handlers/dwp05-precondition-coverage.test.ts`
### `submitPwaForReview`
- **mutation** `eventType: 'PwaSubmittedForReview',` → `setLifecycleStatus: false,
		eventType: 'PwaSubmittedForReview',`
- **promise** THE PROMISE: advanceStatus's contract is 'set the status field (+ mirror lifecycleStatus)' precisely so that 'the legality check, the status field and the mirrored lifecycleStatus ... can never disagree about where the aggregate went' (kit.ts:680, :706, :819), and lifecycleStatus is REQUIRED on every governed object's envelope (envelopes.ts:55) -- it is the platform-level lifecycle a reader who does not know this aggregate's private publicationStatus machine has to use. The mutant keeps the arrow and the event exactly right and silently stops the…
- ⭐ **would kill it** dwp05-precondition-coverage.test.ts:362-373 is the site's own suite -- it asserts pub() === 'UNDER_REVIEW', the PwaSubmittedForReview count and the unbumped revision, and nothing about the mirror; repo-wide the mirror is asserted exactly ONCE, for Intent at birth (intent.test.ts:126-127, 'expect(born.lifecycleStatus).t
- **named victim** `packages/rph-application/src/handlers/dwp05-precondition-coverage.test.ts`
### `validatePwa`
- **mutation** `guard: (state, gctx) => pwaCompositionGate(command, state, gctx)` → `guard: (state, gctx) => {
			const refusal = pwaCompositionGate(command, state, gctx);
			const detail = refusal?.error?.message ?? '';
			return deta`
- **promise** THE PROMISE: ValidatePwa must not pass a PWA whose recursive composition does not hold, and that verdict has THREE hard limbs -- single-root, acyclic-permits and connected (pwa-graph.ts:397-411; guide SS11.6 L1639 'no missing/disallowed/cyclic child rules ... every type reachable from that root', SS16 item 9's 'never reduce a PWA to a flat node list'). The mutant keeps the gate installed, keeps its call, keeps two limbs, and admits a failure reported ONLY by the third: a one-root graph with an unreachable orphan type reaches VALIDATED and from there…
- ⭐ **would kill it** a ValidatePwa over a graph that fails ONLY connectivity -- one root, one unattached non-root type, no cycle. MEASURED: the gate suite's two live arrangements are a cycle (fails acyclic-permits alone) and two-roots-plus-orphan (fails single-root AND connected together, as its own comment admits), so the connectivity lim
- **named victim** `packages/rph-application/src/handlers/pwa-validation-gate.test.ts`

## `packages/rph-application/src/handlers/pwu.ts` — 9 gaps
### `abandonPwu`
- **mutation** `spec: PWU_LIFECYCLE_COMMAND_SPECS.AbandonPwu,` → `spec: {
			...PWU_LIFECYCLE_COMMAND_SPECS.AbandonPwu,
			sourceStates: PWU_LIFECYCLE_COMMAND_SPECS.AbandonPwu.sourceStates.filter(
				(s) => s !== 'B`
- **promise** PROMISE BROKEN: §8.2's 'Any active' umbrella — abandonment reaches EVERY active state (seventeen in-edges, and the spec table says they are GENERATED from the machine so the table cannot disagree with it). The mutant removes exactly ONE, and it is the one the engine's own refusal text names as the remedy: unblockPwu, when a block recorded no origin, fails closed with *"Blocks recorded before JAN-PWUWP W-5.5 fail closed here by design (AX-8); ABANDON OR SUPERSEDE this PWU instead"*. Under the mutant that instruction is unperformable — AbandonPwu answers…
- ⭐ **would kill it** an abandonment driven from BLOCKED (and, generally, an it.each over the seventeen declared sources) in abandonment-authority.test.ts.
- **named victim** `packages/rph-application/src/handlers/abandonment-authority.test.ts`
### `baselinePwu`
- **mutation** `if (!baselineBacksPwu(ctx, id, p.baselineId)) {` → `if (
		!baselineBacksPwu(ctx, id, p.baselineId) &&
		ctx.store.loadObject(p.baselineId)?.objectType !== 'BASELINE'
	) {`
- **promise** PROMISE BROKEN: the handler's own sentence — *"the baseline must already have been PROMOTED, which is what makes this citation an AUTHORIZATION rather than an ASSERTION"* (DOC-002 §8.1's 'Authorized promotion decision'; RPH-BAS-004). The mutant keeps the real check and widens the admission with the one disjunct that guts it: the citation need only BE a BASELINE object. Membership of the right object KIND is still enforced; AUTHORITATIVENESS and 'froze THIS PWU at this version' are not — so a CANDIDATE or APPROVED baseline, or an AUTHORITATIVE one that…
- ⭐ **would kill it** a case beside pwu.test.ts:738 that creates a baseline over this PWU, leaves it CANDIDATE/APPROVED, and requires RPH_EVIDENCE_MISSING — plus its sibling citing an AUTHORITATIVE baseline whose itemObjectVersions name a DIFFERENT PWU.
- **named victim** `packages/rph-application/src/handlers/pwu.test.ts`
### `beginPwuShaping`
- **mutation** `spec: PWU_LIFECYCLE_COMMAND_SPECS.BeginPwuShaping,` → `spec: { ...PWU_LIFECYCLE_COMMAND_SPECS.BeginPwuShaping, sourceStates: ['PROPOSED', 'BLOCKED'] },`
- **promise** PROMISE BROKEN: UnblockPwu's — *"IT TAKES NO TARGET, AND THAT ABSENCE IS THE GUARANTEE THIS COMMAND OFFERS. The state a PWU resumes at is READ from the `blockedFrom` its own `PwuBlocked` recorded — never supplied by the caller... A caller-chosen target would permit `SHAPING -> BLOCKED -> EXECUTING`, silently skipping PLANNED, which is the exact failure REG-D-043 identified."* This mutant does not touch unblockPwu; it gives the ARROW to a second command. MEASURED (probe-arrows.mjs): BLOCKED -> SHAPING is machine-legal (canAdvanceWorkLifecycle =>…
- ⭐ **would kill it** a case in block-escalate.test.ts's W-5.5 block that, after `BlockPwu` from EXECUTING, dispatches BeginPwuShaping and requires REJECTED + the PWU still BLOCKED — i.e. 'the way back is UnblockPwu's alone'. CONTROL 4 of that file asks the same question of the generic SETTER (BLOCKED->SHAPING refused, redirected) and never
- **named victim** `packages/rph-application/src/handlers/block-escalate.test.ts`
### `blockPwu`
- **mutation** `...(p.missingObjectIds ? { missingObjectIds: p.missingObjectIds } : {}),` → `...(p.missingObjectIds ? { missingObjectIds: p.missingObjectIds.slice(0, 1) } : {}),`
- **promise** PROMISE BROKEN: *"the block must name the object whose absence caused it — the same artifact the step refusal named, so the two records agree about one fact"* (O-BLOCK-RECORDED's own words), and the field is `z.array(z.string())` — PLURAL — because a halt can lack several inputs. The mutant keeps the optionality the design argues for and silently records only the FIRST: a block naming three unavailable inputs writes one, so recovery chases a third of its blockers and the two records stop agreeing about the other two. WHO RELIES ON IT: the recovery/read…
- ⭐ **would kill it** O-BLOCK-RECORDED blocking on TWO missing objects and asserting `toEqual([A, B])` — today the list length is never greater than one anywhere in the repository.
- **named victim** `packages/rph-engine/src/slices/class-data-unavailable.slice.test.ts`
### `challengePwu`
- **mutation** `challengeReason: p.challengeReason,` → `challengeReason: 'MUTANT_UNSTATED_CHALLENGE',`
- **promise** PROMISE BROKEN: the event is the WHOLE of this command's delta, and its required field stops carrying what the challenger said. pwu.ts:1545-1552 states it: `challengePwu` *"add[s] NO precondition at all over the shared `advancePwuLifecycle`. Their delta is the EVENT: `PwuChallenged`... carry fields (`challengeReason`...) that `ChangePwuStatePayload` cannot express"* — the stated reason the generic setter could not record is the entire justification for minting this command. `ChallengePwuPayloadSchema.challengeReason` and…
- ⭐ **would kill it** one line beside pwu-nothing-inferred.test.ts:690 — `expect(payloadOfLast('PwuChallenged').challengeReason).toBe('the boundary is wrong')`.
- **named victim** `packages/rph-application/src/handlers/pwu-nothing-inferred.test.ts`
### `changePwuState`
- **mutation** `['PWU.shapeIntegrityState', current.shapeIntegrityState, p.shapeIntegrityState]` → `['PWU.assuranceState', current.assuranceState, p.assuranceState]`
- **promise** PROMISE BROKEN: the handler's own line 1664 — *"Each sub-axis must move legally on its own machine"* — and its docblock's *"AND moves each sub-axis, each of which must be a legal (or no-op) transition on its own machine"*. The mutant keeps the loop, keeps the array's LENGTH at three (the REG-F-159 shape: a count-based pin stays green), keeps checkTransition's every other call, and checks assuranceState TWICE while shapeIntegrityState is checked by NOTHING. MEASURED: `checkTransition` on 'PWU.shapeIntegrityState' is called from exactly ONE site in the…
- ⭐ **would kill it** the sibling of the executionState case — a ChangePwuState with shapeIntegrityState VIOLATED (or RESTORED) from UNKNOWN, requiring RPH_ILLEGAL_STATE_TRANSITION and the message naming PWU.shapeIntegrityState.
- **named victim** `packages/rph-application/src/handlers/pwu.test.ts`
### `invalidatePwu`
- **mutation** `invalidationReason: p.invalidationReason,` → `invalidationReason: p.triggeringObjectId,`
- **promise** PROMISE: this handler's own sentence — 'An invalidation records WHY work stopped being valid' — and the general rule it states four lines up: 'A HANDLER THAT CANNOT EMIT A CONFORMANT EVENT REFUSES THE COMMAND; IT DOES NOT INVENT A VALUE', with the reason the gate cannot help ('a fabricated value is well-formed by construction, so malformation checks are structurally blind to it'). RELIED ON BY a named consumer, not a hypothetical one: packages/rph-projections/src/assurance-view.ts:354 folds PwuInvalidated into `reason: str(p.invalidationReason)` and…
- **named victim** `packages/rph-application/src/handlers/pwu.test.ts :: CONTROL: InvalidatePwu naming a real triggering object drives SATISFIED -> INVALIDATED`
### `markPwuReady`
- **mutation** `if (p.expectedSemanticVersion !== loaded.semanticVersion) {` → `if (p.expectedSemanticVersion > loaded.semanticVersion) {`
- **promise** PROMISE: the handler's own words — this check "refuses a caller that states a version this PWU is not at", and its docblock adds that it "becomes live the day PWUs become revisable", i.e. it is the STALE-attestation guard in waiting (REG-F-109). `>` keeps the refusal for a version ABOVE the object's and ADMITS every version BELOW it — which is precisely the stale direction the docblock names as its purpose. RELIED ON BY: every MarkPwuReady caller (the demo's server action, the SHAPING->READY path) whose attestation is supposed to be pinned to the shape…
- **named victim** `packages/rph-application/src/handlers/pwu.test.ts :: MarkPwuReady rejects a STALE expectedSemanticVersion — the dead staleness guard now fires (contract-drift correctness)`
### `rejectPwu`
- **mutation** `if (!hasBlockingObservationFor(ctx, id, p.blockingObservationIds)) {` → `if (!hasBlockingObservationFor(ctx, id, p.supportingObjectIds ?? p.blockingObservationIds)) {`
- **promise** PROMISE: the fact limb of the arrow's own VERBATIM trigger ("Blocking finding") plus DOC-001 §6's requirement that governance dispositions be "version-bound, evidence-backed" — discharged by reading the DEDICATED, schema-REQUIRED citation `blockingObservationIds`. `supportingObjectIds` is an optional field of RejectPwuPayload that this handler reads NOWHERE. The mutant lets the generic bag stand in for the dedicated citation whenever it is supplied. RELIED ON BY: Governance (the §5.2 reserved act) and any auditor reading PwuRejected, because the event…
- **named victim** `packages/rph-application/src/handlers/rejection-authority.test.ts :: ACCEPTS with an EFFECTIVE REJECTION decision AND a blocking observation about this PWU`
