# Appendix A — the 75 confirmed findings

Produced 2026-07-15 by a 117-agent workflow: 10 dimensions swept in parallel, every finding then
adversarially refuted by an independent agent instructed to assume it guilty until proven innocent.
107 raised, **75 confirmed, 32 refuted** (a 30% fabrication/misread rate — the filter earned its cost).
Each verifier independently re-read the guide line and the code line and checked the section number
against the grepped header map.

| # | Sev | Verdict | Dim | Guide | Code | Finding |
|---|---|---|---|---|---|---|
| 1 | CRITICAL | CODE_IS_WRONG | assurance-floor | §8.4:837 | `packages/rph-application/src/handlers/execution.ts:225` | The execution-plane floor gate can never block: it is called with aiProduced:false and no production code ever records a floor for an execution step, so the early-return in floorGateBlock always fires. |
| 2 | CRITICAL | CODE_IS_WRONG | assurance-floor | §8.4:854 | `packages/rph-application/src/handlers/floor-gate.ts:99` | Any EFFECTIVE WAIVER Decision naming the subject id bypasses the entire floor including the non-suppressible Reasoning Review, unscoped to policy, criterion, or semantic version. |
| 3 | CRITICAL | CODE_IS_WRONG | command-pipeline | §9.3:1228 | `packages/rph-application/src/handlers/kit.ts:375` | The Command envelope's `expectedRevision` is never read anywhere in the engine — optimistic concurrency against the client's expected version does not exist, and every update is silent last-write-wins |
| 4 | CRITICAL | CODE_IS_WRONG | command-pipeline | §9.4:1255 | `packages/rph-application/src/handlers/kit.ts:307` | Command payloads are copied verbatim into permanent Events, so persisted Events carry the request shape rather than the accepted fact — and violate their own generated event payload schemas |
| 5 | CRITICAL | CODE_IS_WRONG | command-pipeline | §9.4:1241 | `packages/rph-application/src/handlers/kit.ts:186` | The generated EVENTS registry is never used — emitted Event payloads are validated against nothing, making the event half of the canonical contract documented-only |
| 6 | CRITICAL | CODE_IS_WRONG | conformance-tests | §14.2:2292 | `packages/rph-assurance/src/floor.ts:323` | Property P4 is proven generatively against a kernel that no enforcement path calls, while the real floor hardcodes its Evidence inputs to "valid" — invalid Evidence can never be detected at the gate |
| 7 | CRITICAL | CODE_IS_WRONG | editions-platform | §13.2:2211 | `packages/rph-application/src/handlers/governance.ts:85` | Decision authority is computed from an unvalidated command payload field, which is exactly the payload-trusted authorization 13.2 forbids |
| 8 | CRITICAL | CODE_IS_WRONG | editions-platform | §13.3:2219 | `packages/rph-ports/src/index.ts:2` | The authorizer port that rph-domain's authority model documents as its seam does not exist |
| 9 | CRITICAL | CODE_IS_WRONG | editions-platform | §13.3:2218 | `apps/rph-demo/src/lib/server/workbench.ts:107` | No endpoint authenticates, and the server fabricates a HUMAN principal rather than failing closed on missing identity |
| 10 | CRITICAL | CODE_IS_WRONG | governed-stream | §9.7:1340 | `apps/rph-demo/src/lib/server/agent/transcript.ts:16` | The resolved model/provider of every agent run is computed, used to decide independence, and then never written to any durable record. |
| 11 | CRITICAL | CODE_IS_WRONG | object-contract | §5.3:404 | `packages/rph-contracts/src/objects.ts:368` | AssurancePolicyDefinitionSchema re-declares `id` and `semanticVersion` after the envelope spread, silently overriding RphIdSchema and NonNegativeIntSchema with unconstrained primitives |
| 12 | BLOCKING | CODE_IS_WRONG | assurance-floor | §8.4:840 | `apps/rph-demo/src/lib/server/floor.ts:114` | Floor step 2 (identity/provenance/trace) is fed five literal `true` constants, so all five of its mandatory criteria are structurally incapable of evaluating NOT_MET. |
| 13 | BLOCKING | CODE_IS_WRONG | assurance-floor | §8.4:851 | `packages/rph-assurance/src/assurance-rules.ts:155` | IndependenceRequirement is a single-valued enum checking one Identity field, but §8.4 requires distinct invocation AND role AND review context conjunctively — and Identity has no role field at all. |
| 14 | BLOCKING | CODE_IS_WRONG | assurance-floor | §8.4:851 | `packages/rph-engine/src/record-assurance.ts:74` | The evaluator's actual identity is never recorded on the canonical Assessment: the field exists on the schema but the request payload is a strictObject that omits it and the recorder never sends it. |
| 15 | BLOCKING | CODE_IS_WRONG | assurance-floor | §8.13:1072 | `apps/rph-demo/src/lib/server/floor.ts:237` | independenceOk is computed and carried through the recording plan, then dropped at persistence — and the UI read-back path hardcodes it to true. |
| 16 | BLOCKING | CODE_IS_WRONG | assurance-floor | §8.9:984 | `packages/rph-engine/src/record-assurance.ts:96` | The §8.9 Validator-result contents — criterion results, considered/rejected Evidence, residual uncertainty, control actions — are all dropped at persistence; only the disposition string survives. |
| 17 | BLOCKING | CODE_IS_WRONG | authoring-plane | §11.6:1639 | `packages/rph-application/src/handlers/pwa-authoring.ts:412` | ValidatePwa performs no validation at all — VALIDATED is a pure status label, so a PWA reaches PUBLISHED with no recursive-composition or assurance-assignment proof |
| 18 | BLOCKING | CODE_IS_WRONG | authoring-plane | §11.7.7:2055 | `packages/rph-application/src/handlers/pwa-authoring.ts:329` | The PWA's semanticVersion is never bumped by any authoring command, so the floor gate's version binding is inert and a satisfied floor authorizes publication of a graph edited after the review |
| 19 | BLOCKING | CODE_IS_WRONG | command-pipeline | §9.3:1228 | `packages/rph-application/src/command-bus.ts:82` | Idempotency-key reuse with a DIFFERENT payload or target returns the prior result instead of failing; RPH_IDEMPOTENCY_DUPLICATE is a dead code |
| 20 | BLOCKING | UNCLEAR | command-pipeline | §9.5:1298 | `packages/rph-application/src/handlers/registry.ts:103` | `ChangePwuState` is registered as a publicly dispatchable command, which Section 16 item 7 and 9.5 both forbid until the boundary is decided |
| 21 | BLOCKING | CODE_IS_WRONG | command-pipeline | §9.3:1208 | `packages/rph-application/src/command-bus.ts:64` | The pipeline has no authenticate-principal stage; the only entry point trusts `issuedBy` as asserted by the caller |
| 22 | BLOCKING | CODE_IS_WRONG | conformance-tests | §14.2:2304 | `packages/rph-domain/src/conformance.test.ts:36` | Properties P9–P12 have no property test, and the conformance gate hardcodes the property universe at exactly eight — so the gate passes green by defining the guide's mandatory properties out of scope |
| 23 | BLOCKING | CODE_IS_WRONG | conformance-tests | §14.4:2352 | `packages/rph-domain/src/conformance.test.ts:49` | 14.4's mutation gate does not exist as a runnable thing; the only assertion over the mutation catalog is that a static JSON array is non-empty |
| 24 | BLOCKING | CODE_IS_WRONG | governed-stream | §9.7:1340 | `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:134` | The materialized input presented to the model is never recorded for either the authoring agent or the Reasoning Review judge. |
| 25 | BLOCKING | CODE_IS_WRONG | governed-stream | §9.7:1340 | `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:140` | The judge's raw answer before coercion is never recorded, and the first try's answer is destroyed by variable reassignment on the repair path. |
| 26 | BLOCKING | CODE_IS_WRONG | governed-stream | §9.7:1340 | `packages/rph-contracts/src/ids.ts:33` | No Execution Attempt record exists anywhere; retries, the repair request, and the auto-refinement pass are not separate records and are not records at all. |
| 27 | BLOCKING | CODE_IS_WRONG | governed-stream | §10.1:1362 | `packages/rph-engine/src/record-assurance.ts:96` | The recorded Assessment drops the evaluator identity, validator id, limitations, criteria, and considered/rejected Evidence that the ValidatorResult actually carried. |
| 28 | BLOCKING | CODE_IS_WRONG | governed-stream | §5.6:454 | `packages/rph-application/src/handlers/assurance.ts:317` | The Assessment aggregate hardcodes evidenceConsidered, rejectedEvidence and residualUncertainty to empty at creation and never fills them. |
| 29 | BLOCKING | CODE_IS_WRONG | governed-stream | §9.7:1338 | `apps/rph-demo/src/lib/server/agent/pi-agent.ts:147` | Volunteered chain-of-thought is streamed to the browser agent log, which §9.7 forbids reaching a log or shared projection. |
| 30 | BLOCKING | CODE_IS_WRONG | object-contract | §5.3:413 | `packages/rph-contracts/src/ids.ts:42` | RphIdSchema validates id shape but never the registered prefix — `banana_<ULID>` is a valid id everywhere in the system |
| 31 | BLOCKING | CODE_IS_WRONG | object-contract | §5.3:413 | `packages/rph-contracts/src/messages.ts:36` | All 215 id-bearing Command/Event payload fields are bare z.string(); the prefixed-ULID rule survives only as a vocab "note" that the generator drops |
| 32 | BLOCKING | CODE_IS_WRONG | object-contract | §5.3:413 | `packages/rph-contracts/src/objects.ts:666` | ID_PREFIXES omits three prefixes §5.3 explicitly registers (pwa, pwut, und) and adds one it never registers (conv); the fidelity test cannot detect either because it compares code to the vocab, not to the guide |
| 33 | BLOCKING | CODE_IS_WRONG | object-contract | §5.2:390 | `packages/rph-contracts/src/objects.ts:440` | DecisionObject.authority is an ActorReference, not an AuthorityReference — the Decision object carries actor identity where the guide requires authority proof |
| 34 | BLOCKING | CODE_IS_WRONG | state-axes | §6.1:466 | `packages/rph-application/src/handlers/pwu.ts:178` | Readiness is neither computed nor verified: MarkPwuReady advances SHAPING→READY unconditionally, ignoring both the readiness contract and the Intent-status guard. |
| 35 | BLOCKING | CODE_IS_WRONG | state-axes | §6.5:615 | `packages/rph-domain/src/pwuGuards.ts:21` | 6.5's root-readiness Intent guard is prose-only: no code path checks Intent status before READY or before satisfaction. |
| 36 | BLOCKING | CODE_IS_WRONG | state-axes | §6.5:618 | `packages/rph-application/src/handlers/execution.ts:193` | Execution does not require authorized Runtime Bindings: the composite gate exists in the domain kernel but no Command handler calls it, and the payload's binding ids are discarded. |
| 37 | MATERIAL | CODE_IS_WRONG | assurance-floor | §8.12:1051 | `packages/rph-assurance/src/assurance-rules.ts:127` | §8.12 names six independence dimensions the runtime must check; hidden context and prompt lineage are unrepresentable in Identity and checked by nothing. |
| 38 | MATERIAL | CODE_IS_WRONG | assurance-floor | §8.13:1076 | `packages/rph-assurance/src/recording.ts:54` | An Assessment can never reach VALIDATOR_FAILED or INDEPENDENCE_VIOLATION: the states exist in the enum, but the recorder folds them to INCONCLUSIVE and the handler's disposition allowlist excludes them. |
| 39 | MATERIAL | CODE_IS_WRONG | assurance-floor | §8.11:1027 | `packages/rph-assurance/src/floor.ts:322` | Evidence admissibility is never evaluated at the floor: `evidenceExists: true` is a literal at the result boundary and the implemented 8-condition admissibility function has no production caller. |
| 40 | MATERIAL | CODE_IS_WRONG | assurance-floor | §8.13:1076 | `packages/rph-assurance/src/floor.ts:318` | The Validator-result schema check at the assurance boundary is the literal `true`, so RPH_VALIDATOR_OUTPUT_INVALID can never be raised by the floor. |
| 41 | MATERIAL | UNCLEAR | assurance-floor | §8.9:1000 | `packages/rph-assurance/src/floor.ts:56` | Definition-time policy assignment and instance-time applicability resolution do not exist: the floor plan is a code constant, seeded ASSURANCE_POLICY objects are never read, and evaluateApplicability has no production caller. |
| 42 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.6:1639 | `packages/rph-application/src/handlers/pwa-authoring.ts:154` | A missing policy assignment does not block validation or publication — requiredAssurancePolicyIds is authored but never checked by any gate |
| 43 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.6:1620 | `packages/rph-contracts/src/messages.ts:382` | The PWU Type definition contract has no recomposition rule field, so 'a recomposition rule for every non-leaf' is unauthorable and unvalidatable |
| 44 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.7.7:2052 | `packages/rph-application/src/handlers/pwa-authoring.ts:107` | conformanceFixtureIds is initialized empty and never written or read — no fixture exists or is required for publication |
| 45 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.7.4:1906 | `apps/rph-demo/src/lib/server/floor.ts:102` | One Reasoning Review per agent turn over the whole serialized graph substitutes for per-output Assessments of each material authoring transformation |
| 46 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.7.7:2054 | `packages/rph-application/src/handlers/pwa-authoring.ts:34` | The authoring agent's runs are recorded as conversation entries, not as Attempts rooted in an Execution Plan |
| 47 | MATERIAL | CODE_IS_WRONG | authoring-plane | §11.7.4:1939 | `apps/rph-demo/src/lib/server/floor.ts:113` | The identity-provenance floor Validator is fed hardcoded true constants, so it records a SATISFIED Assessment that was never derived from the subject |
| 48 | MATERIAL | UNCLEAR | authoring-plane | §11.6:1632 | `packages/rph-application/src/handlers/pwa-authoring.ts:243` | DeletePwa writes DISCARDED onto a PUBLISHED PWA, bypassing the declared publication FSM and mutating an immutable published version |
| 49 | MATERIAL | CODE_IS_WRONG | command-pipeline | §9.3:1213 | `packages/rph-application/src/command-bus.ts:111` | Authority is not a pipeline stage — it is opt-in per handler, so most governed transitions are evaluated with no authority check at all |
| 50 | MATERIAL | CODE_IS_WRONG | command-pipeline | §9.3:1217 | `packages/rph-application/src/handlers/governance.ts:279` | Baseline promotion passes a hard-coded empty observation list to the domain gate, so open blocking Observations can never block a promotion |
| 51 | MATERIAL | CODE_IS_WRONG | command-pipeline | §9.6:1332 | `packages/rph-contracts/src/errors.ts:51` | The typed error shape omits recommended disposition and current/expected versions, two of the six things 9.6 requires every error to return |
| 52 | MATERIAL | CODE_IS_WRONG | command-pipeline | §9.1:1139 | `packages/rph-application/src/handlers/execution.ts:163` | Execution Attempts are never recorded — commands carry `executionAttemptId` and provenance that bind to no object and are dropped from state |
| 53 | MATERIAL | UNCLEAR | editions-platform | §13.3:2225 | `packages/rph-persistence/src/schema.ts:28` | No tamper-evident hash-chained audit trail exists; the event store has neither integrity linkage nor the required scope columns |
| 54 | MATERIAL | CODE_IS_WRONG | editions-platform | §13.3:2226 | `packages/rph-application/src/handlers/governance.ts:85` | Separation of duties is not enforced for Decisions, Baseline promotion, or waivers — a single actor can propose and approve |
| 55 | MATERIAL | UNCLEAR | editions-platform | §13.4:2235 | `apps/rph-demo/src/lib/server/assurance/agy-cli.ts:35` | The one external tool execution path meets almost none of 13.4's attempt requirements |
| 56 | MATERIAL | CODE_IS_WRONG | governed-stream | §5.6:454 | `apps/rph-demo/src/lib/server/floor.ts:237` | The floor read-back projection fabricates independenceOk: true because independence was never persisted. |
| 57 | MATERIAL | CODE_IS_WRONG | governed-stream | §14.6:2369 | `apps/rph-demo/src/lib/server/floor.ts:140` | correlationId is a hardcoded constant per code path, so it cannot correlate a floor Assessment with the authoring turn that produced its subject. |
| 58 | MATERIAL | CODE_IS_WRONG | governed-stream | §5.6:444 | `apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:223` | A failure to persist the entire turn's transcript is swallowed by an empty catch, so the governed stream record is silently dropped. |
| 59 | MATERIAL | BOTH | governed-stream | §9.7:1338 | `apps/rph-demo/src/lib/server/agent/transcript.ts:25` | Volunteered chain-of-thought is discarded at the write boundary rather than redacted and retained as a typed Artifact of its producing Attempt. |
| 60 | MATERIAL | CODE_IS_WRONG | governed-stream | §13.3:2223 | `apps/rph-demo/src/lib/server/assurance/agy-cli.ts:34` | No redaction exists anywhere in the codebase, though context is sent to an external model and prompt content is persisted. |
| 61 | MATERIAL | CODE_IS_WRONG | governed-stream | §5.6:454 | `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:40` | Truncation is declared only inside the prompt text that is never recorded, so no persisted record shows the Assessment saw a truncated subject. |
| 62 | MATERIAL | CODE_IS_WRONG | governed-stream | §9.7:1340 | `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:139` | The parse/validation/repair outcome of the judge call is swallowed by a bare catch and never recorded. |
| 63 | MATERIAL | CODE_IS_WRONG | governed-stream | §9.7:1340 | `apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:162` | Tool-call records lack start/end, resource use and authorization scope, flatten arguments into an ambiguous string, and discard the tool's structured result. |
| 64 | MATERIAL | GUIDE_IS_WRONG | guide-internal | §12:2072 | `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:90` | Section 12 declares Shape Engineering a candidate design 'not yet ratified', while Sections 1, 4.2, and 6.4 treat it as an operative discipline with a canonical persisted state axis. |
| 65 | MATERIAL | BOTH | object-contract | §5.2:383 | `packages/rph-contracts/src/objects.ts:449` | ArtifactObjectSchema is envelope-only AND strict — the §5.2 Artifact (file/commit/hash/reference) is not merely unmodelled, it is actively rejected |
| 66 | MATERIAL | CODE_IS_WRONG | object-contract | §5.5:435 | `packages/rph-contracts/src/enums.ts:709` | TraceRelationSchema omits 6 of the 23 stable-core relations, including VALIDATES, APPROVES and IMPACTS |
| 67 | MATERIAL | CODE_IS_WRONG | object-contract | §16:2505 | `packages/rph-authoring/src/broker.ts:152` | The authoring broker injects a second id generator typed (prefix: string) => string, bypassing the registry entirely |
| 68 | MATERIAL | UNCLEAR | object-contract | §5.2:370 | `packages/rph-contracts/src/enums.ts:589` | AUTHORING_CONVERSATION is added as a canonical object-type discriminator though §5.2 lists no such object and forbids new discriminators |
| 69 | MATERIAL | CODE_IS_WRONG | principles-boundaries | §15.6:2482 | `packages/rph-engine/src/seed-workbench.ts:166` | The floor's runtime policyVersion ('1') and the seeded policy object's version ('1.0.0') are unrelated literals, so definition-time policy requirements and instance-time execution are not inspectably linked. |
| 70 | MATERIAL | CODE_IS_WRONG | state-axes | §6.5:617 | `packages/rph-application/src/handlers/execution.ts:87` | The one-active-plan-per-PWU guard is vacuous: it reads a PWU field that no handler ever writes, so otherActivePlanExists is always false. |
| 71 | MATERIAL | CODE_IS_WRONG | state-axes | §6.5:620 | `packages/rph-application/src/handlers/registry.ts:127` | No Command can falsify an Assumption, so the falsification→impact-analysis→shape-risk guard is unreachable through the pipeline. |
| 72 | MATERIAL | CODE_IS_WRONG | state-axes | §6.3:535 | `packages/rph-application/src/handlers/decomposition.ts:101` | CompleteRecomposition performs none of the 6.3 recomposition checks — it is an unguarded status bump. |
| 73 | MATERIAL | CODE_IS_WRONG | state-axes | §6.5:621 | `packages/rph-application/src/handlers/governance.ts:277` | PromoteBaseline's version-drift check is a tautology: reviewedItems is passed the same array as candidateItems, so a semantically changed item can never mismatch. |
| 74 | ADVISORY | UNCLEAR | object-contract | §5.2:388 | `packages/rph-contracts/src/objects.ts:374` | Set-valued Assurance Policy fields are typed as single enum values while carrying plural names |
| 75 | INFORMATIONAL | GUIDE_IS_WRONG | guide-internal | §9.4:1238 | `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:1629` | The PWA lifecycle in Section 11.6 uses a space-separated 'UNDER REVIEW' state, violating Section 9.4's uppercase snake-case enum rule that every other state set in the guide obeys. |

## ~~Refuted (32) — recorded so they are not re-raised~~ · ⚠ **RE-DISPOSITIONED 2026-08-23: 15 OF THE 32 ARE TRUE AT HEAD — see the dispositions after item 32**

1. ~~Objects the agent authors are attributed to a constant role label rather than the actual model identity, defeating the recorded-lineage requirement the independence check depends on.~~
2. ~~causationId is never populated on any Event, so the stream's causal chain is null for every row in the database.~~
3. ~~Transcript entries are contractually untyped and carry no timestamp, so the durable turn record has no time axis.~~
4. ~~The engine host that stores the entire governed stream is in-memory, so every record described as durable is lost on restart.~~
5. ~~No tenant/organization scope is derived or enforced anywhere, so the storage design provides the unscoped path Section 16 item 4 forbids~~
6. ~~ExecutionProvenance is required on the CompleteExecutionStep wire payload but field-defined nowhere, and is generated as z.unknown() — the runtime provenance of every execution attempt is contractually anything~~
7. ~~objectEnvelopeShape has no tenant or organization scope, and no tenant scoping exists anywhere in the code or the SQL schema~~
8. ~~objectEnvelopeShape carries no prior/superseding version pointer, so supersession is ad hoc per object type and absent from Baseline entirely~~
9. ~~ConfidenceAssessmentSchema is z.record(string, unknown), which admits exactly the unexplained aggregate score §5.2 forbids~~
10. ~~AssuranceObservation records no observation time and no valid time — only the envelope's createdAt~~
11. ~~No test proves that UI, agent, worker, retry, direct-persistence, or projection paths cannot bypass server-side assurance enforcement; the gate blesses the omission by declaring the whole E2E family deferrable~~
12. ~~The replay harness's 'replay' mode returns a hardcoded `ok: true`, and replay.test.ts asserts that constant — 14.3's replay-equivalence and projection-rebuild-convergence scenario is proven by a literal~~
13. ~~The replay harness's Property P6 idempotency check is a tautology — it dedups a Map keyed by a field the same report already asserted is unique~~
14. ~~The cognitive-focus axis named in 6.4 has no representation anywhere in the codebase.~~
15. ~~The 'active profile' that 8.4 conditions floor independence on does not exist as a runtime input — the floor plan hardcodes independence and cannot consult a profile~~
16. ~~Undertaking.instantiationProfile is an unconstrained free string, unbound to the 7.3 profile set, and already carries drifted values~~
17. ~~The three trust tiers are not distinct: the authoring agent executes in-process in the control plane with direct semantic authority~~
18. ~~Editions do not exist in the code in any form — no ee/ boundary, no entitlement check, no license gate~~
19. ~~Section 9.3 makes impact/revalidation closure an unconditional step of the authoritative Command pipeline, while Section 16 item 24 declares impact rules unresolved and every other section gates them on that item's ratification.~~
20. ~~Section 8.12 permits a scoped waiver of required independence, which Section 8.4 flatly forbids for the Reasoning Review floor and Section 11.7.5 declares non-waivable.~~
21. ~~Section 16 item 14's premise 'no canonicalization algorithm exists' is factually stale: a deterministic canonical-JSON + SHA-256 content hash is in production in rph-contracts.~~
22. ~~Section 9.7 declares retained private chain-of-thought exempt from Section 10.1's no-hard-delete rule by asserting it 'participates in no ... traceability', while the same sentence binds it to its producing Attempt precisely to keep the exchange reconstructable.~~
23. ~~Section 3 defines View and Projection as distinct kinds of thing, but Section 11.2 calls the PWA Work Architecture View a projection.~~
24. ~~Section 9.3 states that nothing bypasses the Command pipeline, while Section 16 item 9 sanctions bootstrapping canonical PWA/PWU-Type/Undertaking state through a seed/fixture or an adapter over an existing API.~~
25. ~~Section 16 item 1's authority list omits the Engineering Constitution, which Section 0.1 ranks 11th in precedence and Section 17 names the authority for Sections 14-15.~~
26. ~~Mandatory property P5 turns on 'fingerprint', a term Section 3 never defines and which the guide otherwise defines only inside candidate JSDL material and in an unrelated prompt/template sense.~~
27. ~~The boundary gate's purity rules enumerate a package that does not exist (rph-controller) and omit one that does (rph-authoring), so domain-purity, ports-purity, and projections-browser-safe are all trivially defeatable through rph-authoring.~~
28. ~~The de minimis floor's runtime plan is hardcoded in rph-assurance and the seeded ASSURANCE_POLICY objects are a one-way downstream projection of that code, inverting §4.1's stack in which Professional Work Architecture policies sit above execution semantics.~~
29. ~~Amending a seeded floor ASSURANCE_POLICY object cannot change floor behavior, so the floor policies are neither challengeable nor governable as §2.19 requires.~~
30. ~~The e2e suite is the only thing proving §15.6's PWA Designer/authoring obligations, and the CI gate never runs it.~~
31. ~~The boundary gate cruises only packages/, leaving the apps/ surface — the one host that composes engine, authoring, and projections together — outside the only mechanism that preserves §4.3's boundaries.~~
32. ~~turbo.json declares a lint task with a fan-out dependency that no workspace member implements, so `turbo run lint` is dead configuration masking that lint is a single unpipelined root invocation.~~

---

## ⚠ Dispositions for the 32 above — re-checked at HEAD, 2026-08-23

The heading above used to read *"Refuted (32) — recorded so they are not re-raised"*, and **not one of the
32 recorded a reason.** Each is a single struck sentence: no evidence, no site, no date, no "refuted
because" — against the 75 CONFIRMED findings above, which carry six columns each.

> **A refusal with no reason is not a refutation — it is a prohibition on re-checking.** It has the
> force of a settled question and none of the evidence of one. From outside, a sound refutation whose
> reason was never written and a wrong refutation are the same artifact.

All 32 were re-checked at HEAD, at the site, each with a positive control:

| disposition | n | |
|---|---|---|
| ⚠ **TRUE AT HEAD** | **15** | the claim is accurate today — **13 owe a register entry** |
| REFUTED — FALSE at HEAD | 13 | rightly struck; the reason is now recorded |
| OUT OF SCOPE | 4 | accurate, but describes something JPWB does not attempt |

**The defect was never "the refutations are wrong."** 17 of 32 are sound, and several are sound for reasons
documented at length **elsewhere in the repository and never carried back here** — #2's lives at
`handlers/kit.ts:212-222`, #14's is mandated by `JPWB-DOC-003 §6:173`. The defect is that with no reason
recorded, **no reader could separate the sound ones from the live ones without redoing all 32** — which is
exactly what the heading existed to prevent.

⚠ **THE SHAPE PERMITTED IT.** A "Refuted" section with no evidence column, in a file whose confirmed
findings carry six, invites a bare strike. **The confirmed table is the model.**

⚠ **NOTHING ABOVE MOVED, DELIBERATELY.** The 32 originals keep their exact lines (89-120) and their strikes,
because **eleven citations point into that region** — `JPWB-REG-005` at its `:108` and `:110`,
`invariant-verdicts.ndjson` at `:92 :104 :110 :119`, and `docs/_working` at `:110 :119 :120`. REG-005's own
changeProcedure is *"Append-only after ratification; entries are never destructively edited"*, so a
restructure that shifted those lines could not have been repaired afterwards — it would have left two dead
pointers in ratified canon. **Cite these by ITEM NUMBER, not line number.**

⚠ **TWO WERE FIRST MIS-CHECKED BY HAND, AND BOTH FAILURES ARE INSTRUCTIVE.** **#30** was called FALSE by
reading `gate:fast` — but the claim says *the CI gate*, and CI here is `.github/workflows/ci.yml`, which
runs six steps and stops. **The wrong referent.** **#27** was called FALSE by `grep 'rph-controller'`
returning zero — but the name exists only as a regex alternation branch, so the literal string never
appears. **A negative search with no positive control**, the error mode this repository has recorded more
than any other. `grep -c 'controller'` returns 4.

### Item 1 — FALSE AT HEAD

*(original at line 89, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted because the independence check never consulted object
  attribution: it binds to the per-run resolved model/provider (`floor.ts:80 FloorProducer`, filled at
  `pi-agent.ts:111` from `model.id`/`model.provider`) and fails closed when that is undefined
  (`agent/+server.ts:105`) — the constant-label defect it names was removed in 2acbd86a, two hours before
  this file was written. The residual — that resolved identity never reaching the durable record — is
  confirmed row 10, not this.

- **EVIDENCE.** OPENED (all paths absolute under
  E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench): 1. The independence check does NOT read
  object attribution. `apps/rph-demo/src/lib/server/floor.ts:74-79`, byte-exact: "/** The ACTUAL producer of
  the graph under review. §8.12 checks independence against real model/provider identity —\n * \"not a role
  label such as 'Verifier'\" — so this is resolved per run and never a compile-time constant. It was\n *
  previously the literal `authoring-executor`, which made `checkIndependence(DIFFERENT_MODEL, …)` a
  comparison of\n * two constants: it could never fail, and certified independence on every run. */"
  followed by `export interface FloorProducer { readonly agentId: string; readonly modelId: string; readonly
  providerId: string; }` (:80-84). That comment IS this finding, recorded at its own fix site. 2. The real
  model identity is resolved per run. `apps/rph-demo/src/lib/server/agent/pi-agent.ts:110-111`: "emit({
  kind: 'producer', producer: { agentId: 'authoring-agent', modelId: model.id, providerId: model.provider }
  });" where `model` comes from `resolveModel(modelRegistry, settingsManager)` (:106). The mock declares its
  own actual producer likewise — `mock-agent.ts:54-55`: "kind: 'producer', producer: { agentId:
  'authoring-agent', modelId: 'mock-structural', providerId: 'jpwb-mock' }". 3. The route binds the floor to
  that, and FAILS CLOSED without it. `apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:336-340`: "// The
  run declares its ACTUAL resolved model/provider; the floor binds independence to that, never\n// to a role
  label (§8.12).\nlet producer: FloorProducer | undefined;\nconst onEvent = (ev: AuthoringAgentEvent) => {
  if (ev.kind === 'producer') producer = ev.producer;" and :103-113: "// Fail closed (§8.12): with no
  resolved model/provider the Reasoning Review's independence cannot be\n// established … if (!producer) { …
  return { externalDetail: text }; }" — the floor is not run and no Assessment is recorded. 4. The
  comparison is on the resolved identity. `packages/rph-assurance/src/assurance-rules.ts:203`: "return
  differs('modelId') ? { independent: true } : fail('same model');", reached via the floor's `independence:
  'DIFFERENT_MODEL'` (`packages/rph-assurance/src/floor-policies.ts:146`). POSITIVE CONTROLS: `grep -rn
  "modelId" --include=*.ts packages apps/rph-demo/src` (non-dist, non-test) returned 21 hits, so the symbol
  is findable — the negative half below is a real absence, not an instrument zero. WHAT IS TRUE, AND IT IS
  ALREADY FILED SEPARATELY: the durable attribution really is a constant.
  `apps/rph-demo/src/lib/server/identity.ts:56-62` gives AGENT_CREDENTIAL the principal `{ actorId:
  'jpwb-authoring-agent', actorType: 'AGENT', displayName: 'JPWB Authoring Agent', tenantId, organizationId
  }` — no `modelId`, no `providerId`; and `packages/rph-application/src/command-bus.ts:263` stamps
  `...(principal.modelId === undefined ? {} : { modelId: principal.modelId })`, so `createdBy` on
  agent-authored objects carries the role constant and nothing else. But that is the shape row 10 of the
  CONFIRMED table already records, and the finding's causal clause ("defeating … the independence check") is
  the part that is wrong. WHY IT WAS STRUCK WITHOUT A REASON: the fix predates the document by two hours.
  `git log` — 2acbd86a 2026-07-15 16:10:51 -0400 "Pile 1: contain chain-of-thought, MAKE THE INDEPENDENCE
  CHECK ABLE TO FAIL, and put the demo app inside the gate" introduced `FloorProducer` (`git log -S'export
  interface FloorProducer' -- apps/rph-demo/src/lib/server/floor.ts`), and it removed the literal
  `authoring-executor` that dffb7655 (2026-07-14) had put there. The findings file is b2a24ba7 2026-07-15
  18:54:50 -0400.

### Item 2 — FALSE AT HEAD

*(original at line 90, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted: `causationId` is populated — 14 of 446 events in a driven
  seed carry one — written at `packages/rph-application/src/handlers/pwa-authoring.ts:175` for the engine's
  one synthesized command and propagated at `kit.ts:223`. Sparseness is the contract, not the defect: the
  field is deliberately absent on acts a caller issued, and `verif/causation-provenance.test.ts` pins both
  directions with an anti-vacuity control and a named mutant.

- **EVIDENCE.** DRIVEN, not read. I ran the shipped seed against a real SqliteStorageAdapter (scratchpad
  script `drive-causation.mjs`, mirroring `verif/causation-provenance.test.ts`'s `drive()`) and counted the
  committed rows: TOTAL EVENTS: 446 EVENTS WITH causationId: 14 PwaEdited | commandId= seedpwa-2#pwa-version
  | causationId= seedpwa-2 PwaEdited | commandId= seedpwa-3#pwa-version | causationId= seedpwa-3 PwaEdited |
  commandId= seedpwa-4#pwa-version | causationId= seedpwa-4 EVENTS WITH commandId (control): 446 The
  `commandId` line is the POSITIVE CONTROL on the same 446 rows through the same accessor: 446/446
  populated, so a 0 for `causationId` would have been an absence and not a broken probe. It was 14. THE
  POPULATION SITE — and it is NOT the one named in the sweep brief.
  `packages/rph-application/src/handlers/pwa-authoring.ts:175`: "causationId: command.commandId", inside the
  synthesized `${command.commandId}#pwa-version` bump command (:156).
  `packages/rph-application/src/handlers/kit.ts:223` only PROPAGATES it — "...(command.causationId ===
  undefined ? {} : { causationId: command.causationId })," — and its comment (:212-222) states the rule the
  count reflects: "`commandId` already answers \"which command produced this event\" and is populated on
  446/446 events. `causationId` answers a different question — what caused THE COMMAND … So this line is
  `undefined` for the overwhelming majority of events, and that is the correct result." PINNED:
  `./node_modules/.bin/vitest run verif/causation-provenance.test.ts` → "Test Files 1 passed (1) / Tests 3
  passed (3)". That file asserts BOTH directions and carries its own anti-vacuity control (:86-89:
  `expect(derived.length, 'no derived acts in the drive — the census below would be
  vacuous').toBeGreaterThan(0)`), plus a named mutant (:105-106: "MUTANT: set `causationId` unconditionally
  in `makeEvent` … -> this reddens and the test above stays green"). TIMING: the field's writer landed in
  548d9194, 2026-08-07 ("INC-B: causation is retained on derived acts…"), i.e. AFTER the findings file
  (b2a24ba7, 2026-07-15). So this was struck for whatever reason held in July, and is independently false
  today by construction.

### Item 3 — TRUE AT HEAD

*(original at line 91, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence MEDIUM). **The strike is wrong and is kept only as history.** The durable
  conversation entry has no typed role/kind and no per-entry timestamp, leaving the persisted turn record
  without any time dimension. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** BOTH FACTUAL LIMBS HOLD, read byte-exact at HEAD.
  `packages/rph-contracts/src/objects.ts:188-193`: export const ConversationEntrySchema = z.strictObject({
  \trole: z.string(), \tkind: z.string(), \ttext: z.string(), \tsuccess: z.boolean().optional() }); (read
  through `cat -A`, so the four fields are the whole object). `z.strictObject` means nothing may add a time
  or narrow the strings at any call site. This is the shape both the command and the event carry:
  `messages.ts:682-685` `AppendConversationEntriesPayloadSchema … entries: z.array(ConversationEntrySchema)`
  and `messages.ts:1711-1714` `ConversationEntriesAppendedPayloadSchema … entries:
  z.array(ConversationEntrySchema)`, and it is what `AuthoringConversationSchema` stores (`objects.ts:770`).
  EM-2 CONTROLS, same file, same flags: • timestamps: `grep -cE "^\s+[a-zA-Z]+At: "
  packages/rph-contracts/src/objects.ts` → 7 (e.g. `:517 capturedAt: z.string(),` `:566 startedAt` `:567
  completedAt` `:248 expiresAt`). Inside lines 188-193 → 0. A real absence in a file that plainly does carry
  nested timestamps. • typing: `grep -c "z.enum(" packages/rph-contracts/src/objects.ts` → 4. Inside 188-193
  → 0. `role` and `kind` are bare strings; the only vocabulary that exists is app-side and non-binding
  (`apps/rph-demo/src/lib/server/agent/transcript.ts:16-22 TRANSCRIPT_KIND`, `:25 RECORDABLE`), which the
  contract never consults. AND THE CONSUMER GENUINELY HAS NO TIME AXIS. The single reader is object state,
  not the stream: `apps/rph-demo/src/lib/server/workbench.ts:340-345 loadConversation` returns
  `getConversation(engine, pwaId)?.state.entries`, and the handler accumulates every turn into one flat
  array — `packages/rph-application/src/handlers/pwa-authoring.ts:99` "entries: [...prior, ...p.entries]".
  The page maps that array straight to log rows with no time field
  (`apps/rph-demo/src/routes/pwa/[id]/+page.server.ts:59-77 toLogEntry` → `{ kind, text, ok? }`). So from
  the object nothing can say when an entry happened, nor even which turn it belonged to. `grep -rn
  "ConversationEntriesAppended" --include=*.ts packages apps/rph-demo/src` (non-dist) returns 14 hits, ALL
  of them the handler, the contract, or tests — no projection or reader consumes the event (POSITIVE CONTROL
  on the same corpus and flags: `PwaCreated` → 7 hits, so event-name greps do return consumers here). ⚠ THE
  HONEST QUALIFICATION, and it is why confidence is MEDIUM rather than HIGH: a per-TURN time axis does exist
  latently in the governed stream. Each turn is one append — `recordConversation(params.id, transcript,
  turn.engine, turn.id)` is called once per turn (`apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:271`
  and `:365`) — its event payload holds only that batch (`pwa-authoring.ts:100-105`), and every event
  carries `occurredAt: command.issuedAt` / `recordedAt: ctx.now()`
  (`packages/rph-application/src/handlers/kit.ts:207-208`), plus the AUTHORING_CONVERSATION envelope's
  `createdAt`/`updatedAt` (`packages/rph-contracts/src/envelopes.ts:56-59`). So the absolute reading — "no
  time axis anywhere" — is overstated. The entry-level claim and the consumer-level claim both stand. NOT
  SETTLED BY CANON, and not moot. `grep -rn "ConversationEntry\|AUTHORING_CONVERSATION" docs/canon/` → 4
  hits (POSITIVE CONTROL: `AssuranceObservation` → 0 across the same files, confirming canon is distilled
  and silence there is expected). Three are one register entry, REG-F-230 (`docs/canon/JPWB-REG-005 Decision
  and Divergence Register.md:10205` heading; :10282, :10293, :10338) — it quotes this exact schema and its
  remedy item 4 asks for a TOOL-AUTHORIZATION field, saying nothing about time or typing; the fourth
  (`JPWB-SPEC-001 …:8936`) is an object-type list. Nothing in canon rules the gap closed.

### Item 4 — FALSE AT HEAD

*(original at line 92, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted by DR-002 W-2 (b51e8ef4, 2026-07-28): `workbench.ts:99` wires
  `new SqliteStorageAdapter({ filename: dbPath })`, `:126` guards re-seeding and `:133` recovers the outbox,
  and `workbench-durability.test.ts` passes 4/4 including "authored state written before a restart is
  readable after it" — the remaining default-to-`:memory:` question is REG-F-220's disclosed residual, not
  this claim.

- **EVIDENCE.** THE HOST WIRES A FILE STORE AT HEAD. `apps/rph-demo/src/lib/server/workbench.ts:92-99`
  (`newEngine`): "const base = { ontology, validateOntology, authenticate: standaloneAuthenticator(),
  ...(dbPath ? { store: new SqliteStorageAdapter({ filename: dbPath }) } : {}) };", fed from `:44` "const
  DB_PATH = TEST_MODE ? undefined : process.env.JPWB_DEMO_DB;" via `:139-141 getEngine() { handle ??=
  openWorkbench(DB_PATH); }`. `openWorkbench` (:122-135) also carries the two things a durable host needs: a
  seed guard, ":126 if (engine.readAllEvents().length === 0)
  seedWorkbench(engine.as(REFERENCE_OWNER_CREDENTIAL));", and startup recovery, ":133 if (dbPath)
  engine.recoverOutbox();". PINNED BY A RUNNING TEST, not by reading. `./node_modules/.bin/vitest run
  apps/rph-demo/src/lib/server/workbench-durability.test.ts` → "Test Files 1 passed (1) / Tests 4 passed
  (4)". Its cases (`grep -n 'it(' …`): `:97` "authored state written before a restart is readable after it";
  `:130` "reopening a populated store does not seed it a second time"; `:176` an explicit ADMISSION case;
  `:208` "an in-memory host is still seeded, so omitting a path keeps today's behaviour". The file's own
  header names this finding as the defect it closes (:3-11): "THE DEFECT THIS PINS. … the demo host passed
  `ontology`, `validateOntology` and a test clock, and NEVER a store — so every Undertaking, Decision and
  Baseline a professional authored existed only until the server process ended." TIMING — FIXED SINCE,
  cleanly. `git log --diff-filter=A -- apps/rph-demo/src/lib/server/workbench-durability.test.ts` → b51e8ef4
  2026-07-28 "DR-002 W-2: the workbench survives a restart…", and `git log -S'SqliteStorageAdapter({
  filename: dbPath })' -- apps/rph-demo/src/lib/server/workbench.ts` → the same commit. The findings file is
  b2a24ba7 2026-07-15. So the claim was almost certainly TRUE when struck and is false now for the reason
  DR-002 W-2 made it false. ⚠ WHAT SURVIVES, DISCLOSED RATHER THAN GLOSSED: durability is opt-in. With
  `JPWB_DEMO_DB` unset the store is still in-memory (`workbench.ts:44`), and `grep -rn "JPWB_DEMO_DB"`
  across *.json/*.ts/*.md/*.js/*.cjs/*.mjs/*.yml (non-node_modules, non-dist) returns 4 hits —
  `workbench.ts:44`, a built chunk, one test comment, and one register line — so NO run script or config
  sets it. That residual is already recorded in canon, verbatim at `docs/canon/JPWB-REG-005 Decision and
  Divergence Register.md:8415-8419` (inside REG-F-220, heading at :8253): "A weaker second item, recorded
  here rather than filed separately: the shipped host's store is `:memory:` whenever `JPWB_DEMO_DB` is unset
  (`workbench.ts:44`), documented in the `openWorkbench` docblock as a configuration choice rather than
  disclosed as a durability gap; whoever reviews this should decide whether that framing is adequate." I
  dispose FALSE rather than TRUE because the claim as written is architectural — "the engine host … IS
  in-memory" and "every record described as durable IS LOST" — and both are refuted by a wired store, a seed
  guard, outbox recovery, and a passing restart round-trip. The live question is narrower (a default and its
  framing) and is already filed.

### Item 5 — TRUE AT HEAD

*(original at line 93, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence MEDIUM). **The strike is wrong and is kept only as history.**
  Tenant/organization scope is neither derived nor enforced anywhere in JPWB, so the persistence design
  leaves exactly the unscoped path the Coding Agent Guide's §16 item 4 safe default forbids. **Already
  covered:** REG-D-026 (`docs/canon/JPWB-REG-005 Decision and Divergence Register.md:2073-2084`), a canon
  DECISION whose merge target is `Repository — `objectEnvelopeShape` and the trust boundary that populates
  it` and whose status line reads `**Status:** EFFECTIVE — MERGE PENDING.` The remaining work is named as
  `D-3 of `docs/_working/DESIGN-trust-boundary.md`` and is disclosed in-code at
  `packages/rph-application/src/command-bus.ts:253-254` (`carrying them onto the OBJECT ENVELOPE is
  REG-D-026's work in D-3, and it is not smuggled in here`). No NEW register entry is owed; what was owed
  was a REASON beside the struck line, which is what this disposition supplies.

- **EVIDENCE.** §16 item 4 verified BY ITS HEADING, not inferred from a line: heading `## 16. Do-not-guess
  decision register` at `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:2492`; the
  table header is at `:2496`; row 4 is byte-exact — `| 4 | **Command/Event envelope and tenant placement.**
  ... | Serialize DOC-007 exactly. Enforce tenant/principal through authenticated transport, repository, and
  RLS context. A public-envelope addition requires a new schema version and coordinated code/storage/test
  change; never create an unscoped path. |`. That safe default names THREE enforcement surfaces. Measured at
  HEAD, ONE of the three exists and TWO do not. WHAT EXISTS (so the claim's word 'derived' is stale and I
  record it rather than hide it): `packages/rph-ports/src/ports/authentication.ts:75` — ` readonly tenantId:
  string;` — with `organizationId` on the next line, both REQUIRED (non-optional) fields of `interface
  Principal`, whose doc comment at `:53-58` reads `The resolved acting principal — who the engine records as
  having acted. ... plus the two scope axes REG-D-026 rules must be carried`. They are populated at the
  trust boundary from the credential directory, not from a payload:
  `apps/rph-demo/src/lib/server/identity.ts:26` — `const STANDALONE_TENANT = 'tenant-local';` — spread into
  all four principals at `:51-52`, `:58-59`, `:65-66`, `:74-75`. That is item 4's 'authenticated transport'
  leg, performed. WHAT DOES NOT EXIST — the 'repository, and RLS context' leg, i.e. the storage design the
  claim's consequent is about: (a) NOTHING EVER READS THE SCOPE. `grep -rn "\.tenantId\|\.organizationId"
  --include=*.ts --include=*.svelte packages apps | grep -v /dist/ | grep -v node_modules` → **0**. POSITIVE
  CONTROL, same tree, same flags: `grep -rn "\.actorId" …` → **47**. The grep is live; the reads are absent.
  The two identifiers appear only as constructions (92 total occurrences, of which the non-test set is 10 in
  `apps/` and 4 in `rph-ports`), never as a filter, key, or guard. (b) THE SQL IS UNSCOPED, READ IN FULL
  RATHER THAN GREPPED. `packages/rph-persistence/src/schema.ts:69-129` is `export const SCHEMA_SQL`; it
  declares exactly five tables and I read every column of each: `professional_work_objects` (`:70-79`: id,
  object_type, aggregate_type, revision, semantic_version, state, created_at, updated_at),
  `professional_work_object_versions` (`:81-88`), `domain_events` (`:90-103`), `outbox_messages`
  (`:108-116`), `command_receipts` (`:119-129`). No tenant or organization column on any of them, no RLS, no
  scoped index. `grep -rn "CREATE TABLE" --include=*.ts --include=*.sql packages apps` (minus
  dist/node_modules) returns 6 hits and **schema.ts is the only production one** (the sixth is
  `schema-migration.test.ts:26`), so there is no second SQL surface I missed. Case-insensitive control on
  that directory: `grep -rni "tenant\|organization" packages/rph-persistence/src/*.ts` → **0**, POSITIVE
  CONTROL `grep -rni "revision\|created" packages/rph-persistence/src/*.ts` → **72**. (c) THE CODE SAYS SO
  IN ITS OWN VOICE. `packages/rph-application/src/command-bus.ts:252-254`: `// THE STAMP — a total function
  onto the ratified `ActorReference` shape. `tenantId`/`organizationId` / // live on the Principal but have
  no home on ActorReference; carrying them onto the OBJECT ENVELOPE is / // REG-D-026's work in D-3, and it
  is not smuggled in here.` The stamp body (`:256-270`) copies
  actorId/actorType/displayName/roleId/modelId/providerId/executionInstanceId and drops the two scope axes.
  `apps/rph-demo/src/lib/server/identity.ts:102-104` repeats the same disclosure verbatim. AUTHORITY CHECK —
  the Guide is not moot here, and canon does not refute the claim, it CONFIRMS it. `docs/canon/JPWB-CON-000
  Constitution.md:97` B1 as amended 2026-08-09 (REG-D-034) admits `the Coding Agent Guide` as a SOURCE
  CORPUS `holding authority for DETAIL ... subordinate to canon by concern`, so §16 item 4 still carries
  detail authority. And canon rules the same way: `docs/canon/JPWB-REG-005 Decision and Divergence
  Register.md:2073` REG-D-026 — `THEREFORE: CARRY THE FIELD, GOVERN NONE OF THE SEMANTICS. ... `tenantId`
  and `organizationId` join the **object envelope** as **required** fields, derived from authenticated
  context and never from a payload` — with `:2084` recording `**Status:** EFFECTIVE — MERGE PENDING.` and
  scheduling the remainder as `D-3 of `docs/_working/DESIGN-trust-boundary.md` — *"`roleId` +
  `tenantId`/`organizationId` fed from the principal (REG-D-026)"*`. DISPOSITION ON THE LOAD-BEARING
  ASSERTION: the consequent — the storage design provides an unscoped path — is TRUE at HEAD and is a live,
  ratified-as-owed gap. The antecedent's word 'derived' is stale (it was accurate when REG-D-026 was
  written: that entry states at `:2080` `The code satisfies neither — `tenantId`/`organizationId` occur
  **zero** times`); 'enforced' is still accurate. I record the stale half explicitly rather than letting it
  flip the verdict, because the sentence's own 'so' clause is what a re-raiser would be raising.

### Item 6 — FALSE AT HEAD

*(original at line 94, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted at `packages/rph-contracts/src/objects.ts:238-243`:
  `ExecutionProvenance` is a four-field `z.strictObject` (originType / producingExecutionAttemptId /
  executedBy / evaluator), and `messages.ts:181` requires it by reference on
  `CompleteExecutionStepPayloadSchema` — the `z.unknown()` two lines away at `:180` is `structuredResult`, a
  different field; the floor gate reads the shape typed at `floor-gate.ts:44-48`.

- **EVIDENCE.** REFUTED BYTE-EXACT AT TWO SITES. (1) THE TYPE IS FIELD-DEFINED.
  `packages/rph-contracts/src/objects.ts:238-243`: `export const ExecutionProvenanceSchema =
  z.strictObject({` ` originType: OriginTypeSchema.optional(),` ` producingExecutionAttemptId:
  z.string().optional(),` ` executedBy: ActorReferenceSchema.optional(),` ` evaluator:
  ActorReferenceSchema.optional()` `});` with `export type ExecutionProvenance = z.infer<typeof
  ExecutionProvenanceSchema>;` at `:244`. A `z.strictObject` with four named fields is the opposite of
  `z.unknown()` — it also REJECTS unknown keys. (2) THE PAYLOAD REFERENCES IT, NOT `z.unknown()`.
  `packages/rph-contracts/src/messages.ts:173-183` is `CompleteExecutionStepPayloadSchema`, and `:181` reads
  exactly ` executionProvenance: ExecutionProvenanceSchema,` — required (no `.optional()`). The event side
  at `:1321` reads ` executionProvenance: ExecutionProvenanceSchema.optional(),` inside
  `ExecutionStepSucceededPayloadSchema`. `grep -n "executionProvenance"
  packages/rph-contracts/src/messages.ts` returns exactly those two lines and no others. POSITIVE CONTROL
  FOR THE `z.unknown()` SEARCH (this is the control the original refutation owed): `grep -c "z.unknown()"
  packages/rph-contracts/src/messages.ts` → **2**, at `:180` ` structuredResult: z.unknown(),` and `:1322` `
  structuredResult: z.unknown().optional(),`. So `z.unknown()` IS still present in that generated file and
  my search would have found it on `executionProvenance` had it been there — it is `structuredResult`, the
  field one line ABOVE `executionProvenance` in the same payload, that is untyped. The finding appears to
  have been written against a HEAD where that was true and against the adjacent field. (3) THE SHAPE IS
  CONSUMED TYPED, WHICH `z.unknown()` COULD NOT SUPPORT.
  `packages/rph-application/src/handlers/floor-gate.ts:17` imports `type { ExecutionProvenance } from
  '@janumipwb/rph-contracts'`; `:44-48` is `function provenanceIndicatesAiProduced(prov: ExecutionProvenance
  | undefined): boolean { if (!prov) return false; if (prov.executedBy &&
  AI_ACTOR_TYPES.has(prov.executedBy.actorType)) return true; return prov.originType !== undefined &&
  AI_ORIGIN_TYPES.has(prov.originType); }` — the de minimis floor gate's AUTHORITATIVE signal 0 reads
  `originType` and `executedBy.actorType` off it. Two suites exercise this:
  `packages/rph-application/src/handlers/floor-gate-signal0.test.ts:18` (`describe('stepOutputIsAiProduced —
  signal 0 (contracted ExecutionProvenance)'`) and `execution-floor-signal0-live.test.ts:1` (`The LIVE
  wiring proof for floor-gate signal 0: completeExecutionStep must pass its ExecutionProvenance to the …`).
  (4) THE AUTHORING ACT IS RECORDED IN THE GENERATOR'S SOURCE OF TRUTH.
  `packages/rph-contracts/vocab/m3-commands-events.json:5588`: `ExecutionProvenance is now a CONTRACTED
  shape (§0.3, grounded in the ratified §7.1 ProvenanceRecord vocabulary): originType (the §7.1 origin
  enum), producingExecutionAttemptId (the §16 item 23 producing-Attempt binding, by name), executedBy
  (ActorReference), evaluator (ActorReference).` — messages.ts is generated, so this is where the change was
  made. The stale prose the finding echoes still survives in the working corpus at
  `docs/_working/DECISION-item23-attempt-record.md:50` (`The code has degraded it to `z.unknown()`
  (`messages.ts:106`)`) — that is where the claim came from, and `messages.ts:106` at HEAD is `
  constraintIds: z.array(z.string()),` inside `FormalizeIntentPayloadSchema`, i.e. the citation no longer
  resolves. No canon artifact was needed to settle this; `grep -n "ExecutionProvenance"
  docs/canon/JPWB-REG-005…` returns 0 (the same file greps fine for other terms — `objectEnvelopeShape`
  returns 6 hits), so REG-005 is silent and the code is dispositive.

### Item 7 — TRUE AT HEAD

*(original at line 95, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The common
  object envelope has no tenant or organization field, and no tenant scoping exists in the code or in the
  SQL schema. **Already covered:** REG-D-026 — `docs/canon/JPWB-REG-005 Decision and Divergence
  Register.md:2073` (`REG-D-026 — Tenant and organization scope: carried, not governed (delegated ruling
  under REG-D-025)`), whose merge target line at `:2084` reads `**Merge target:** Repository —
  `objectEnvelopeShape` and the trust boundary that populates it … **Status:** EFFECTIVE — MERGE PENDING.`
  It is additionally disclosed at the two code sites that decline to do it:
  `packages/rph-ports/src/ports/authentication.ts:70-73` and
  `packages/rph-application/src/command-bus.ts:252-254`. Nothing new is owed to the register; the reason
  beside the struck line is.

- **EVIDENCE.** THE ENVELOPE CLAUSE — TRUE, VERIFIED BY READING EVERY FIELD, NOT BY A NEGATIVE GREP.
  `packages/rph-contracts/src/envelopes.ts:49-65` is `export const objectEnvelopeShape = {` … `} as const;`
  and its complete membership is fifteen fields: `id` (`:50`), `objectType` (`:51`), `schemaVersion`
  (`:52`), `semanticVersion` (`:53`), `revision` (`:54`), `lifecycleStatus` (`:55`), `createdAt` (`:56`),
  `createdBy` (`:57`), `updatedAt` (`:58`), `updatedBy` (`:59`), `provenance` (`:60`), `ontologyId` (`:61`),
  `ontologyVersion` (`:62`), `tags` (`:63`), `extensions` (`:64`). Neither `tenantId` nor `organizationId`
  is among them. `:67` seals it: `export const ObjectEnvelopeSchema = z.strictObject(objectEnvelopeShape);`
  — strict, so a tenant field could not even be smuggled through as an unknown key, and all 17 object
  schemas spread this same shape (`objects.ts:405`, `// ---- The 17 Professional Work Object schemas (each
  composes objectEnvelopeShape). ----`). THE SQL CLAUSE — TRUE, READ IN FULL.
  `packages/rph-persistence/src/schema.ts:69-129` (`export const SCHEMA_SQL`) declares five tables and I
  enumerated every column: `professional_work_objects` `:70-79` (id, object_type, aggregate_type, revision,
  semantic_version, state, created_at, updated_at); `professional_work_object_versions` `:81-88`;
  `domain_events` `:90-103`; `outbox_messages` `:108-116`; `command_receipts` `:119-129`. No tenant or
  organization column anywhere, and no other production SQL exists — `grep -rn "CREATE TABLE" --include=*.ts
  --include=*.sql packages apps` (minus dist/node_modules) → 6 hits, five in schema.ts and one in
  `schema-migration.test.ts:26`. Case-insensitive control: `grep -rni "tenant\|organization"
  packages/rph-persistence/src/*.ts` → **0**; POSITIVE CONTROL same file set, same flags, `grep -rni
  "revision\|created"` → **72**. THE SUB-CLAUSE THAT IS STALE, RECORDED RATHER THAN SUPPRESSED: `no tenant
  scoping exists anywhere in the code` no longer holds literally.
  `packages/rph-ports/src/ports/authentication.ts:75` declares ` readonly tenantId: string;` (with
  `organizationId` adjacent) as REQUIRED fields of `interface Principal`, and
  `apps/rph-demo/src/lib/server/identity.ts:26` supplies `const STANDALONE_TENANT = 'tenant-local';` to all
  four principals (`:51-52`, `:58-59`, `:65-66`, `:74-75`). But the scope stops at the principal and reaches
  no record: `grep -rn "\.tenantId\|\.organizationId" --include=*.ts --include=*.svelte packages apps`
  (minus dist/node_modules) → **0** reads, POSITIVE CONTROL `\.actorId` same flags → **47**. The code states
  the boundary itself at `packages/rph-application/src/command-bus.ts:252-254`: `THE STAMP — a total
  function onto the ratified `ActorReference` shape. `tenantId`/`organizationId` live on the Principal but
  have no home on ActorReference; carrying them onto the OBJECT ENVELOPE is REG-D-026's work in D-3, and it
  is not smuggled in here.` So the finding's headline — the ENVELOPE — is exactly the thing still missing,
  and the port comment at `authentication.ts:70-73` says so in its own voice: `⚠ They are NOT yet written
  onto the object envelope — that is D-3, and it trips SPEC-001 FORK-2's ratified reopening trigger
  (REG-F-058).` AUTHORITY: `docs/canon/JPWB-CON-000 Constitution.md:97` (B1, amended 2026-08-09 per
  REG-D-034) admits the Coding Agent Guide as a source corpus with DETAIL authority, so the Guide is not
  moot; and canon AGREES with the finding rather than settling it away — REG-D-026 at
  `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:2073` rules `tenantId` and `organizationId`
  join the **object envelope** as **required** fields, derived from authenticated context and never from a
  payload`, and `:2084` records `**Status:** EFFECTIVE — MERGE PENDING.` A ratified ruling with a pending
  merge is the definition of a live gap.

### Item 8 — FALSE AT HEAD

*(original at line 96, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted: Baseline supersession is fully contracted and enforced —
  `BaselineStatusSchema` includes `'SUPERSEDED'` (`enums.ts:181`), `SupersedeBaselinePayloadSchema`
  (`messages.ts:566`) is registered at `messages.ts:2294`, `BaselineSupersededPayloadSchema` carries the
  `supersedingBaselineId` pointer (`messages.ts:991-994`), the `supersedeBaseline` handler enforces
  AUTHORITATIVE→SUPERSEDED (`governance.ts:1027`, registered `registry.ts:99`), and one positive plus two
  negative tests pin it (`dwp04-precondition-coverage.test.ts:311/320/334`). Only the envelope-field premise
  survives, and it is a shape observation about where supersession lives, not an absence.

- **EVIDENCE.** THE PREMISE HOLDS BUT THE ACCUSATION DOES NOT, AND THE ACCUSATION IS 'absent from Baseline
  entirely'. PREMISE, TRUE: `packages/rph-contracts/src/envelopes.ts:49-65` — the fifteen envelope fields
  are id, objectType, schemaVersion, semanticVersion, revision, lifecycleStatus, createdAt, createdBy,
  updatedAt, updatedBy, provenance, ontologyId, ontologyVersion, tags, extensions. No
  `supersedes`/`supersededBy`/`priorVersion` among them. And the per-type handling really is heterogeneous:
  `grep -n "upersed\|priorVersion\|previousVersion" packages/rph-contracts/src/objects.ts` returns exactly
  two OBJECT-side fields, in two different directions and two different naming shapes — `objects.ts:185` `
  supersededByConstraintId: z.string().optional()` (inside `ConstraintPropagationSchema`, `:177-186`) and
  `objects.ts:418` ` supersedesIntentId: z.string().optional(),` (inside `IntentObjectSchema`, `:407-420`).
  ACCUSATION, REFUTED — Baseline supersession is a first-class, fully-wired, tested governed transition: •
  STATE: `packages/rph-contracts/src/enums.ts:175-183` — `export const BaselineStatusSchema = z.enum([
  'DRAFT', 'CANDIDATE', 'UNDER_REVIEW', 'APPROVED', 'AUTHORITATIVE', 'SUPERSEDED', 'REVOKED' ]);` —
  `'SUPERSEDED'` is at `:181`. • COMMAND: `packages/rph-contracts/src/messages.ts:566-568` — `export const
  SupersedeBaselinePayloadSchema = z.strictObject({ supersedingBaselineId: z.string() });` — registered in
  the command registry at `:2294` (` SupersedeBaseline: { payload: SupersedeBaselinePayloadSchema, …`) and
  again at `:3286` (` commandType: 'SupersedeBaseline',`). • EVENT WITH THE POINTER:
  `packages/rph-contracts/src/messages.ts:991-994` — `export const BaselineSupersededPayloadSchema =
  z.strictObject({ supersedingBaselineId: z.string(), status: BaselineStatusSchema });` — i.e. the
  superseding-version pointer the finding says is missing exists on the Baseline event, typed. • HANDLER:
  `packages/rph-application/src/handlers/governance.ts:1027` — `export const supersedeBaseline:
  CommandHandler = (ctx, command, payload) => {`, with `:1021` `/** SupersedeBaseline — AUTHORITATIVE ->
  SUPERSEDED (immutability: changes create a successor, P7).` and `:1034` `eventType:
  'BaselineSuperseded',`; registered at `packages/rph-application/src/handlers/registry.ts:99` (`
  supersedeBaseline`). • TESTS INCLUDING KILLS:
  `packages/rph-application/src/handlers/dwp04-precondition-coverage.test.ts:311` `it('POSITIVE
  SupersedeBaseline — from AUTHORITATIVE supersedes to SUPERSEDED'`, `:320` `it('NEGATIVE (kill)
  SupersedeBaseline — a re-issue from SUPERSEDED is refused, with one BaselineSuperseded'`, `:334`
  `it('NEGATIVE (wrong source) SupersedeBaseline — from APPROVED (not yet AUTHORITATIVE) is refused, no
  BaselineSuperseded'` — the last asserting `expect(h.eventsOfType('BaselineSuperseded')).toHaveLength(0);`
  at `:341`. POSITIVE CONTROL FOR THE SEARCH: `grep -rn "upersed" packages/rph-contracts/src/*.ts`
  (excluding .test.) returns **38** lines spanning five supersede commands (Intent `:386`, Pwu `:452`,
  ExecutionPlan `:558`, Baseline `:566`, AssurancePolicy `:733`) and their five matching events (`:1390`,
  `:1536`, `:1236`, `:991`, `:1762`) — so the sweep is live, and Baseline is one of the five, not an
  omission. WHAT IS ACTUALLY TRUE, for the record: supersession is expressed on the COMMAND/EVENT axis
  (uniformly, five types) rather than as an envelope field, and the two object-level pointers use
  inconsistent names. That is a shape observation, not the stated defect. `objects.ts:690-700`
  `BaselineObjectSchema` (baselineType, purpose, scope, itemObjectVersions, assuranceAssessmentIds,
  promotionDecisionId, approvalDecisionId, status) carries no supersession POINTER — but it carries `status:
  BaselineStatusSchema`, whose `SUPERSEDED` value the handler writes, and the pointer lives on the event.
  'Absent from Baseline entirely' is false on every one of those five surfaces.

### Item 9 — TRUE AT HEAD

*(original at line 97, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The
  `ConfidenceAssessment` type is contracted as a wide-open key/value bag (`z.record(string, unknown)`), so
  the contract itself permits a bare numeric score with no basis and no limitations — precisely the
  "unexplained aggregate score" the Guide's §5.2 object table forbids. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** THE SCHEMA — `packages/rph-contracts/src/objects.ts:80`, byte-exact: `export const
  ConfidenceAssessmentSchema = z.record(z.string(), z.unknown());` It sits inside the block header at
  `objects.ts:66-67`: `// ---- Helper sub-types the specs reference but never fully define. Permissive
  structured` / `// placeholders (any object) — tightened in the milestone that defines them (M7/M9/M11).
  ----`. The type alias follows at `:81`. WHERE IT REACHES — two live surfaces, both optional: -
  `packages/rph-contracts/src/objects.ts:569` — `confidence: ConfidenceAssessmentSchema.optional(),` inside
  `AssuranceAssessmentSchema` (the STORED object). - `packages/rph-contracts/src/messages.ts:911` —
  `confidence: ConfidenceAssessmentSchema.optional(),` inside `AssuranceAssessmentSatisfiedPayloadSchema`
  (the WIRE event payload; parent verified by reading `messages.ts:905-913`). So `confidence: { score: 0.92
  }` validates on both the assessment object and the satisfied-assessment event. THE §REF IS EXACT, VERIFIED
  AT THE LINE (not inferred). `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:368` is
  the heading `### 5.2 Core semantic objects`; the row is at `:387`, byte-exact: `| **Confidence
  Assessment** | Qualified assessment with basis and limitations. It cannot replace Evidence or become an
  unexplained aggregate score. |` CANON DOES NOT MOOT IT — checked, because the Guide is historical material
  under CON-000 B1. `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:92` carries the SAME
  rule into ratified canon: `| **Confidence Assessment** | Qualified assessment with basis and limitations;
  never a substitute for Evidence, never an unexplained aggregate score. |` The only other canon touches are
  lineage/scope notes, not a settlement: `JPWB-REG-005:1442` REG-E-017 (`CPCO-era object rows ... stay in
  the §3 semantic model or demote to DOC-001 doctrine. *Default: stay*`) and `:248` (candidate-entity/JSDL
  question). Neither licenses an opaque record. NOT ALREADY FILED — I grepped the register before
  concluding. `JPWB-REG-005:4618` FINDING 4 names the placeholder class exhaustively:
  "`assurance_assessment_evidence` (a `z.record(z.string(), z.unknown())` where DOC-007 ratifies a field
  shape), `ControlActionRecommendation` and the §33 validator-output schema (DOC-004)".
  `docs/_working/BACKLOG.md` REG-F-197 residue (ii) repeats the same three. **`ConfidenceAssessment` is in
  none of them.** It appears only as a coverage-gap aside in a working audit,
  `docs/_working/AUDIT-shape-survivorship-2026-08-20.md:148`: "declared placeholders (z.record(z.string(),
  z.unknown()), objects.ts 'tightened in the milestone that defines them') for ClaimTemplate,
  ClaimAssessmentResult, RejectedEvidenceReference, ProposedAssuranceObservation, ModelSelectionPolicy,
  ApplicabilityExpression, Condition, ConfidenceAssessment" — a roster line, not a filing, and it does not
  connect the type to the §5.2/DOC-003 prohibition. POSITIVE CONTROL (EM-2) — is anything ELSE gating the
  field? `grep -n "confidence" packages/rph-application/src/handlers/*.ts` excluding `*.test.ts` → **0
  hits**. Control on the same population/instrument: `grep -c "disposition"
  packages/rph-application/src/handlers/assurance.ts` → **82**. The zero is real: no handler validates,
  populates, or reads `confidence`. The schema is the only gate there is, and it gates nothing. HONEST
  NARROWING: because nothing populates the field today, the exposure is CONTRACTUAL rather than observed — a
  caller supplying the forbidden shape would be accepted, but no code path currently supplies one.

### Item 10 — TRUE AT HEAD

*(original at line 98, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** An
  `AssuranceObservation` — the record of what was detected or measured — carries no field for WHEN it was
  observed and no validity window; the only times on the object are the generic envelope's record-keeping
  timestamps. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** THE OBJECT — `packages/rph-contracts/src/objects.ts:576-589`, `export const
  AssuranceObservationSchema = z.strictObject({` with exactly: `...objectEnvelopeShape, assessmentId,
  policyId, criterionId?, subjectObjectIds, findingCode, observationType, severity, statement, implication,
  evidenceIds, disposition`. It is a **strictObject**, so no unlisted time field is even admissible. THE
  ENVELOPE — `packages/rph-contracts/src/envelopes.ts:49-65`, `objectEnvelopeShape` = `id, objectType,
  schemaVersion, semanticVersion, revision, lifecycleStatus, createdAt, createdBy, updatedAt, updatedBy,
  provenance, ontologyId?, ontologyVersion?, tags, extensions`. `ProvenanceRecordSchema`
  (`envelopes.ts:130-137`) = `originType, sourceObjectIds, sourceEventIds, producingExecutionAttemptId?,
  producingValidatorId?, contentHash?` — **no timestamp**. NEITHER WIRE SURFACE ADDS ONE: - Command:
  `packages/rph-contracts/src/messages.ts:352-359` `RecordAssuranceObservationPayloadSchema` =
  `assessmentId, observationType, findingCode?, severity, statement, evidenceIds?` — no time field, so a
  professional cannot DECLARE when the thing was observed. - Event:
  `packages/rph-contracts/src/messages.ts:938-949` `AssuranceObservationRecordedPayloadSchema` =
  `observationId, assessmentId, policyId, subjectObjectIds, findingCode, severity, statement, implication,
  evidenceIds, disposition` — no time field. CENSUS WITH POSITIVE CONTROL (EM-2). `grep -rno
  "observedAt|occurredAt|validFrom|validUntil|observationTime|detectedAt|effectiveAt"
  packages/rph-contracts/src/*.ts` returns 13 hits, ALL accounted for and none on this object:
  `validFrom`/`validUntil` at `objects.ts:148-149` and `objects.ts:518-519` and `messages.ts:1188-1189`;
  `effectiveAt` at `objects.ts:603`, `messages.ts:371,1101,1112,1631`; `occurredAt` at `envelopes.ts:148`
  (the DomainEvent envelope) and `envelopes.test.ts:154`. Control on the same files/instrument: `createdAt`
  → present in `objects.ts` and `envelopes.ts`. So the bitemporal vocabulary EXISTS in this package and
  simply was not given to AssuranceObservation. TWO CORRECTIONS TO THE CLAIM'S WORDING, which do not touch
  its substance: (1) the object envelope carries `createdAt` AND `updatedAt`, not "only createdAt"; (2) the
  `AssuranceObservationRecorded` EVENT envelope does carry two times — `occurredAt` and `recordedAt` are
  both REQUIRED at `packages/rph-contracts/src/envelopes.ts:147-148`. But those are PER-11's
  occurrence/record pair, which is a different dimension from the observed and valid times the claim is
  about. CANON — `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:377`, byte-exact:
  "**PER-11 · Time is bitemporal; occurrence and record never conflate.** Every durable semantic record
  preserves semantic-occurrence time and record time as distinct meanings, and carries observed, valid, and
  Decision-effective time where their distinction matters. Exact field spellings and placement are
  repository shapes." REGISTER SEARCHED FIRST — `limb:PER-11:1` has exactly TWO filed instances and this is
  neither. (a) Decision `effectiveAt`, open as REG-Q-055 (`JPWB-REG-005:11491`ff). (b) Evidence valid time,
  closing with REG-F-219 (`:8110`; `:11618` "Instance (b), Evidence valid time, closes with `REG-F-219`").
  `:11538-11552` records that conjunct (A), occurrence vs record, is "**ENFORCED BY CONSTRUCTION**" via
  `makeEvent` (`kit.ts:207-208`), and that "The `observed` dimension also holds: `Evidence.capturedAt` is
  caller-settable" — a statement about **Evidence**, not about Observation. No filing anywhere reaches
  AssuranceObservation.

### Item 11 — TRUE AT HEAD

*(original at line 99, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** Nothing in the
  test suite proves the six named paths (UI, agent, worker, retry, direct-persistence, projection) are
  unable to route around server-side assurance enforcement; and the conformance gate positively authorizes
  that hole by marking the entire end-to-end rule family exempt. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** THE OBLIGATION, VERIFIED AT ITS HEADING (not inferred from a line number). `docs/Janumi
  Canonical Implementation Context - Coding Agent Guide.md:2306` is `### 14.3 Minimum conformance
  scenarios`; the last bullet of the PWA-Designer/authoring block ends byte-exact: "...and proves that UI,
  agent, worker, retry, direct-persistence, and projection paths cannot bypass server-side assurance
  enforcement." LIMB 2 — THE GATE BLESSES IT. `packages/rph-domain/src/conformance-manifest.ts:437-440`:
  `'RPH-E2E': {` / `\tstatus: 'DEFERRED',` / `\tnote: 'full end-to-end scenarios — the M13 Reference
  Undertaking replay + M14 surface'` / `}` and `:468`: `export const DEFERRABLE_PREFIXES:
  ReadonlySet<string> = new Set(['RPH-E2E']);` That set is not decorative — it is READ BY THE GATE at
  `packages/rph-domain/src/conformance.test.ts:103`: `DEFERRABLE_PREFIXES.has(prefixOf(r.id)),`. The
  manifest's own comment at `:464-466` states the consequence: "No `RPH-E2E` rule id appears in any check,
  any test, or any source file in this repository; the seven scenarios are genuinely unbuilt."
  `docs/canon/JPWB-REG-005:718` says the same: "**`RPH-E2E`'s deferral is LEGITIMATE and stays.** No
  `RPH-E2E` rule id appears in any check, test, or source file in the repository; the seven scenarios are
  genuinely unbuilt." The file's own comment at `:444-448` names the cost: "an entry here does not weaken a
  claim, it DELETES the claim... a wrong entry here fails silently, forever." I DID NOT TAKE THAT ON THE
  MANIFEST'S WORD. `grep -rn "RPH-E2E" --include=*.ts --include=*.md --include=*.json .` (excluding
  node_modules, /dist/, .svelte-kit) → hits ONLY in `docs/` prose (REG-005:718/720/723/3681/9883, the RPH
  conformance spec §24 at :2122-2260, the roadmap, ENFCOV design, a working audit), in
  `packages/rph-domain/vocab/m12-conformance.json` (the rule statements themselves, :207-213), and in TWO
  comment lines (`enforcement-register.ts:49,54`; `conformance-manifest.ts:437`). **Zero in any test or
  check.** POSITIVE CONTROL, same instrument and population: `grep -rn "RPH-FIX" --include=*.ts` → **67
  hits**. The zero is real. LIMB 1 — NO TEST PROVES IT. `grep -rln "cannot bypass|bypass
  server-side|server-side assurance" --include=*.ts .` → **0 files**. POSITIVE CONTROL, same instrument:
  `grep -rln "assurance" --include=*.ts packages/` → **196 files**. The only test file in the repository
  that quotes the bypass-paths sentence at all is
  `packages/rph-application/src/handlers/generic-setter-scope.test.ts:1-7`, and it quotes a DIFFERENT rule —
  DOC-003 §9 PER-3, "No generic CRUD/PATCH path, UI local state, RPH worker, validator, projection worker,
  broker message, agent output, or informal approval bypasses this pipeline" — and proves only that
  `ChangePwuState` may not perform PWU work-lifecycle arrows a semantic command owns (its cases at
  `:153-213` are all PROPOSED→SHAPING, SHAPING→READY, →CHALLENGED, →RESHAPING, →SUPERSEDED, →INVALIDATED,
  SATISFIED→RECOMPOSING, RECOMPOSING→RECOMPOSED). Its own header at `:14-17` disclaims reach: "A
  table-driven test that reads the same table the handler reads can only prove TOTALITY... It cannot prove
  the CLASSIFICATION." It is not about assurance enforcement and touches none of retry, worker, or
  projection. WHAT PARTIAL COVERAGE DOES EXIST, stated so this is not overclaimed:
  `packages/rph-application/src/handlers/pwa-authoring.test.ts:1263` "rejects a DIRECT command that
  references a locked floor policy (bypassing broker/UI)" plus its DRAFT/missing-policy siblings at
  `:1270,:1280`, and `execution-floor-subject.test.ts:226` "an output that is not a recorded object blocks
  completion — the bypass, closed". Each closes ONE rule against ONE path. None is the §14.3 six-path
  scenario, and none is certified as such: the family that would certify it is the one marked DEFERRED.

### Item 12 — FALSE AT HEAD

*(original at line 100, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). The literal `ok: true` at replay.ts:171 belongs to a mode whose own
  docblock declares it assertion-free reporting, not a proof; §14.3's replay-equivalence and
  projection-rebuild-convergence scenario is proven at HEAD by replay-equivalence.test.ts (RPH-PER-006, 52
  axis comparisons against the live engine, with a non-triviality control) and projection-rebuild.test.ts
  (RPH-PER-007, rebuilt from ALL domain events against the materialized objects), both landed 2026-07-17,
  two days after this finding was struck.

- **EVIDENCE.** THE TWO PREMISES ARE TRUE — I confirmed both, so this is not a misread.
  `packages/rph-engine/src/replay.ts:168-181`: after `if (mode === 'conformance') return
  runConformance(events);` the function returns `ok: true,` at `:171` unconditionally, with a single check
  whose `ok: true` at `:177` is likewise a literal. And `packages/rph-engine/src/replay.test.ts:49-50`:
  `const report = runReplay('replay', events);` / `expect(report.ok).toBe(true);`. THE CONCLUSION IS FALSE,
  AND THAT IS THE FINDING. Three independent grounds: (1) THAT MODE NEVER CLAIMED TO PROVE ANYTHING. Its own
  docblock at `replay.ts:159-162` reads: "- replay: rebuild the aggregates from the event history (**no
  assertions**) — the count + terminal fold." And `replay.test.ts:6-12` disclaims the whole file's scope:
  "SCOPE (corrected 2026-07-17 — this file called itself 'the headline end-to-end proof')... The engine is
  not involved in any assertion below. These tests are worth keeping — they prove the ORACLE ARTIFACT is
  internally coherent... but they prove nothing about the system." Even the local test does more than the
  literal: `:51` asserts `report.eventCount` is 72 and `:55` asserts `terminal.get('Baseline:Architecture
  Baseline')?.event` is `'BaselinePromoted'` off the real fold. (2) REPLAY EQUIVALENCE IS PROVEN ELSEWHERE,
  AGAINST THE LIVE ENGINE. `packages/rph-engine/src/replay-equivalence.test.ts` (134 lines), header `:1-3`:
  "RPH-PER-006 — Aggregate replay equivalence, proved against the live engine... 'Given an event stream for
  an Intent or PWU. When the aggregate is reconstructed. Then its state matches the materialized current
  state.'" It calls `driveReferenceUndertaking(engine)` (`:53`), then for each of 13 PWUs rebuilds all four
  axes from that aggregate's own stream and compares to `engine.loadObject(id)?.state`, asserting
  `expect(compared).toBe(52); // 13 PWUs x 4 axes` (`:96`) and `expect(mismatches, mismatches.join(' |
  ')).toEqual([]);` (`:97`). It carries three more cases including an explicit anti-tautology control at
  `:118`: "PROOF THE PROPERTY IS LOAD-BEARING: the terminal states differ across PWUs, so equality is not
  trivial" — "If every PWU ended in the same state, the test above could pass with a reducer that returned a
  constant." (3) PROJECTION REBUILD CONVERGENCE IS PROVEN ELSEWHERE TOO.
  `packages/rph-engine/src/projection-rebuild.test.ts` (126 lines), header `:1-3`: "RPH-PER-007 — Projection
  rebuild, proved against the live engine." Cases: `:75` "the Work view rebuilt from ALL domain events
  matches the materialized objects"; `:98` "the view's qualifiedSuccess agrees with the objects"; `:114`
  "rebuild-from-empty is deterministic AND non-trivial (a constant fold could satisfy determinism alone)".
  Its header at `:6-19` records that the PREVIOUS version of this test was exactly the tautology the finding
  describes — "the fold compared to ITSELF, over a hand-authored TWO-event stream" — and that it "was
  CONCEALING A BROKEN VIEW". WHY THE STRIKE LOOKS WRONG AND IS NOW RIGHT — the dating, which is the reason
  nobody wrote down. `docs/_working/HARMONIZATION-FINDINGS.md` has ONE commit, `b2a24ba7` dated
  **2026-07-15**. `replay-equivalence.test.ts` first lands in `4a8a0924` dated **2026-07-17** ("Increment
  29: the log can rebuild the aggregate, and now we know it"); `projection-rebuild.test.ts` first lands in
  `ef0c3662` dated **2026-07-17** ("Increment 30: the self-comparison was hiding a broken view"). So the
  claim was almost certainly TRUE on the day it was struck as refuted, and was remediated two days later by
  two named increments. At HEAD it is false.

### Item 13 — TRUE AT HEAD

*(original at line 101, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The replay
  harness's conformance check labelled Property P6 / RPH-PER-002 cannot fail: it builds a Map keyed by `seq`
  over the event list concatenated with itself and asserts the Map's size equals the event count — but the
  same `runConformance` report has already asserted, as RPH-FIX-001, that `seq` is contiguous 1..N and
  therefore unique. Given a passing RPH-FIX-001, the P6 assertion is logically entailed and tests nothing
  about idempotent replay. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** Opened
  `E:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-engine\src\replay.ts`. Both
  checks are added to the SAME `checks[]` array inside the SAME function `runConformance(events)` (declared
  at replay.ts:71), so "the same report" is literal. replay.ts:81-87, byte-exact: ``` // RPH-FIX-001 — the
  trace is a contiguous, complete sequence (reference integrity in the seq dimension). const seqs =
  events.map((e) => e.seq); add( 'RPH-FIX-001', seqs.length > 0 && seqs.every((s, i) => s === i + 1),
  `${seqs.length} events, contiguous seq 1..${seqs.length}` ); ``` `s === i + 1` for every index IS a
  uniqueness assertion on `seq`. replay.ts:146-152, byte-exact: ``` // RPH-PER-002 / Property P6 — replaying
  the history twice is idempotent (dedup by seq yields the same set). const doubled = [...events,
  ...events]; const dedup = new Map(doubled.map((e) => [e.seq, e])); add( 'RPH-PER-002', dedup.size ===
  events.length, `replayed x2 dedups to ${dedup.size} events (no duplicate decisions/baselines)` ); ``` `new
  Map(...)` over `[...events, ...events]` keyed by `e.seq` has size = |distinct seq values|. That equals
  `events.length` if and only if the seqs are distinct — precisely what RPH-FIX-001 has already asserted. So
  RPH-PER-002 can only redden in runs where RPH-FIX-001 has ALREADY reddened and `ok` is already false. It
  contributes zero discriminating power, exactly as the claim states. Secondary confirmation that nothing
  else is exercised: no fold, no re-application, no aggregate rebuild appears between :146 and :152 —
  `foldTerminalStates` (replay.ts:48-52) is never called from `runConformance`. `grep -n "seq"
  packages/rph-engine/src/replay.ts` returns 9 lines total; the ONLY two that participate in a check
  predicate are :85 (RPH-FIX-001) and :148 (RPH-PER-002). Control for the greps: `grep -rn
  "deMinimisFloorPlan" ... | wc -l` style negative sweeps were not needed here since every search returned
  non-zero. `grep -rn "P6" --include=*.ts packages apps` returned 22 lines (non-zero instrument), of which
  replay.ts:146 and replay.test.ts:25 are the harness's. NOTE ON PROVENANCE, not required but relevant:
  replay.ts:7-15 already carries a standing self-warning that this harness "asserts that the fixture is
  consistent with itself" and that "An oracle that cannot disagree with the system is not observing it." The
  P6 check is that defect in miniature, one level down — it cannot disagree with the report it lives in.

### Item 14 — OUT OF SCOPE

*(original at line 102, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **OUT OF SCOPE** (HIGH). Refuted: the absence is mandated, not a gap — JPWB-DOC-003 §6:173 and
  JPWB-DOC-002:247 declare cognitive focus an additive, never-persisted viewpoint, and REG-005 REG-Q-003:189
  sets the safe default "Persist only the state axes ratified in JPWB-DOC-003 ... unless a Decision adds an
  orthogonal axis with migration"; no such Decision exists, so representing it would breach canon.

- **EVIDENCE.** THE FACTUAL LIMB IS TRUE; THE OBLIGATION LIMB IS NOT — canon and the Guide itself both
  forbid representing it, so the absence is compliance, not a gap. 1) The claim's factual half, verified
  with a positive control in the same invocation, same flags, same paths (`grep -rn -- "<pat>"
  --include=*.ts --include=*.svelte --include=*.json packages/rph-domain/src packages/rph-contracts/src
  packages/rph-application/src packages/rph-engine/src packages/rph-projections/src apps/rph-demo/src | wc
  -l`): ``` cognitiveFocus 0 COGNITIVE_FOCUS 0 'UNDERSTANDING' 0 'RECONCILIATION' 0 'REPRESENTATION' 0
  'BASELINED' 34 <-- POSITIVE CONTROL, same command, non-zero ``` The control at 34 proves the instrument
  resolves quoted enum members in these trees, so the four zeros are absences. (A wider `grep -rn -i
  "cognitive" packages apps` returns 3 hits, ALL of them the phrase "cognitive-complexity budget" in code
  comments — packages/rph-authoring/src/broker.ts:437, :637 and
  packages/rph-contracts/src/gen/gen-objects.ts:165 — and `RECONCILIATION` outside the filtered set hits
  only CSAA issue codes such as `'RECONCILIATION_MISMATCH'`. Checked false positives, none is the axis.) 2)
  RATIFIED CANON EXPLICITLY FORBIDS IT. `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md`,
  §6 "State axes and transition guards" (heading verified at :170, not inferred), line 173 byte-exact: "The
  later cognitive-focus model
  (intent/understanding/representation/reasoning/decision/action/observation/reconciliation) is an additive
  viewpoint, not a replacement lifecycle; no alternative lifecycle may be implemented alongside the
  canonical axes." The same §6 at :170 fixes the four axes that DO get representation: "Every PWU carries
  four orthogonal state axes: **work lifecycle**, **execution state**, **assurance state**, and
  **shape-integrity state**." `docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:247` byte-exact: "| `PCLC` |
  The cognitive loop (JPWB-DOC-001 §2.2) as an additive viewpoint; never a persisted lifecycle or phase
  machine |" 3) THE REGISTER HAS ALREADY RULED. `docs/canon/JPWB-REG-005 Decision and Divergence
  Register.md:187-190`, REG-Q-003 "PWU lifecycle versus cognitive focus", byte-exact safe default: "Persist
  only the state axes ratified in JPWB-DOC-003 and the repository contracts. Candidate cognitive states are
  projection/focus metadata unless a Decision adds an orthogonal axis with migration. Never map states by
  similar labels." 4) AND THE GUIDE ITSELF SAYS THE SAME, in the very section the finding cites and in its
  own §16. Guide §6.4 (heading verified at :555) line 603 byte-exact: "Treat cognitive focus as an additive
  viewpoint, not a replacement lifecycle." Guide §16 row 3 (:2500) byte-exact: "Persist only DOC-002/007
  states. Candidate cognitive states are projection/focus metadata unless a Decision adds an orthogonal axis
  and migration. Never map by similar labels." So the finding reads a permissive, expressly-non-persisted
  viewpoint as a required representation. No Decision adding the orthogonal axis exists (REG-005 carries
  only REG-E-017 at :1442, an OPEN question about whether the CPCO-era rows stay in the §3 object list at
  all — not a ratification). Building the axis today would VIOLATE canon; its absence is the correct state.

### Item 15 — TRUE AT HEAD

*(original at line 103, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** Guide §8.4
  makes the strength of Reasoning-Review independence conditional on "the active profile", but no profile is
  available to the runtime that plans the floor: `deMinimisFloorPlan` takes only an `AssuranceSubject`, that
  type carries no profile field, and the independence requirement is a literal baked into the returned plan.
  **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** THE NORM. Guide §8.4 "De minimis assurance floor and control planning" (heading verified
  byte-exact at :835 via `grep -n "^### 8\.4"`, NOT inferred from a line number). Line 851, byte-exact: "-
  prohibit same-invocation self-review and use at least a distinct evaluator invocation, role, and review
  context whose actual identities and lineage are recorded; the same base model is allowed only when the
  active profile permits its visible common-mode limitation, while stricter profiles may require a different
  model/provider or human/organizational independence;" AND THIS SURVIVED INTO RATIFIED CANON — it is not
  stale Guide-only material. `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md` §8.5
  "Independence" (heading at :293), ASR-13 at :295 byte-exact: "Required independence is policy-declared and
  graduated (separate invocation → different agent → different model/provider → human or organizational
  independence, scaling with claim materiality)." And its SCOPE line at :297 byte-exact: "conversely, the
  same base model in a separate invocation *is* legal where the active profile permits that visible
  common-mode limitation." `grep -rn "active profile" docs/canon/ "docs/Janumi Canonical Implementation
  Context - Coding Agent Guide.md"` returns exactly 2 lines — DOC-003:297 and Guide:851 — so canon
  re-ratified the conditional rather than settling it away. THE CODE.
  `packages/rph-assurance/src/floor.ts:56-79`, byte-exact: ``` export function deMinimisFloorPlan(subject:
  AssuranceSubject): FloorPolicyRef[] { const plan: FloorPolicyRef[] = [ { policyId:
  FLOOR_POLICY_IDS.SCHEMA_INVARIANT, policyVersion: '1', required: true, independence: 'NONE' }, ... if
  (subject.isAiProduced) { plan.push({ policyId: FLOOR_POLICY_IDS.REASONING_REVIEW, policyVersion: '1',
  required: true, independence: 'DIFFERENT_MODEL' }); } ``` ONE parameter. And the parameter type has no
  profile — floor.ts:27-35, byte-exact, the WHOLE interface: ``` export interface AssuranceSubject {
  readonly subjectId: string; readonly objectType: string; readonly semanticVersion: number; /** Was the
  subject produced or materially shaped by an AI/agent? Drives the mandatory Reasoning Review step. */
  readonly isAiProduced: boolean; /** Identity of the producer (executor) — the independence baseline the
  Reasoning Review evaluator must differ from. */ readonly producer: Identity; } ``` Five fields, no
  profile, no risk profile, no conformance profile. `'DIFFERENT_MODEL'` at floor.ts:76 is a string literal
  in the function body, reachable by no input other than `isAiProduced`. NO CALLER SUPPLIES ONE EITHER.
  `grep -rn "deMinimisFloorPlan" --include=*.ts packages apps` (excluding dist) returns 13 lines; the only
  non-test production call is `packages/rph-assurance/src/validators.ts:298` — `const plan =
  deMinimisFloorPlan(subject);` — inside `runFloorResults(subject, ctx, registry)` (validators.ts:294-297),
  which threads no profile. NEGATIVE SEARCH WITH CONTROL. `grep -rn "profile" --include=*.ts
  packages/rph-assurance/src | grep -v "\.test\.ts"` returns 5 lines (non-zero instrument, so this is not a
  silent-zero). ALL five are checked: floor.ts:53 and floor-policies.ts:143 are prose comments saying no
  profile may SUPPRESS the floor; applicability.ts:72-74 resolves `$.riskProfile` on a POLICY-APPLICABILITY
  subject, a different type from `AssuranceSubject`, and never feeds `deMinimisFloorPlan`. Zero of the five
  is a profile input to the floor plan. WHY THIS IS A LIVE GAP AND NOT MERE CONSERVATISM. The hardcoded
  `'DIFFERENT_MODEL'` sits on the strict side of §8.4's first clause, so nothing today WEAKENS the floor —
  the code simply never takes the branch that would need a profile. But §8.4's second clause and ASR-13's
  graduation ("→ different model/provider → human or organizational independence, scaling with claim
  materiality") run the other way: a STRICTER profile can never tighten the floor to DIFFERENT_PROVIDER or
  human/organizational independence, because there is no input by which it could. REG-005 REG-Q-010 at :224
  byte-exact requires the missing piece: "Pin the slice to a versioned matrix of PWA conformance profile,
  independent PWU risk profile, applicable policies, criteria, and independence. A missing mapping blocks
  promotion." No such matrix reaches `deMinimisFloorPlan`, and nothing blocks promotion for its absence.

### Item 16 — TRUE AT HEAD

*(original at line 104, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.**
  `Undertaking.instantiationProfile` is typed as a bare `z.string()` on both the object schema and the
  CreateUndertaking wire payload, bound to no enumeration of the profiles §7.3 defines, and the repository
  already contains three mutually inconsistent spellings of the value — including two different ones in
  non-test production code. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** UNCONSTRAINED, at three layers. `packages/rph-contracts/src/objects.ts:758` (inside
  `UndertakingSchema`, a `z.strictObject`), byte-exact: ` instantiationProfile: z.string(),`
  `packages/rph-contracts/src/messages.ts:649` (inside `CreateUndertakingPayloadSchema`), byte-exact: `
  instantiationProfile: z.string(),` `packages/rph-contracts/schemas/objects/Undertaking.json:247-249`,
  byte-exact: ``` "instantiationProfile": { "type": "string" }, ``` Required (Undertaking.json:286 lists it
  in `"required"`) but with no `enum` key — the CONTROL is in the same file at :259-266, where `"status"`
  carries `"enum": ["ACTIVE","MIGRATING","ARCHIVED"]`, so this generator DOES emit enums for constrained
  fields and the absence on `instantiationProfile` is real, not a generator limitation. The vocab annotation
  that drives generation, `packages/rph-contracts/vocab/m1-object-fields.json`, carries for this field
  exactly `{"field": "instantiationProfile", "type": "string", "required": true}` — no enum, no note, no
  source citation. UNBOUND TO §7.3. Guide §7.3 "Two independent profile axes" (heading verified byte-exact
  at :673 via `grep -n "^### 7\.3"`) defines two closed sets: assurance/conformance rigor **Lightweight |
  Standard | High Assurance** (:677-683) and, at :685-691, the "Product Realization work-shape profiles" —
  "Exploratory Product Shape; Feature Delivery Shape; Brownfield Change Shape; Migration Shape;
  High-Assurance Shape." `grep -rn "Exploratory Product Shape|Feature Delivery Shape|Brownfield Change
  Shape|High Assurance|Lightweight" --include=*.ts packages apps` (excluding dist/node_modules) returns 3
  lines — non-zero instrument — and ALL THREE are prose in comments (rph-contracts/src/enums.ts:430,
  rph-domain/src/execution-failure-taxonomy.ts:14,
  rph-product-realization-pwa/src/doc003-carriage.test.ts:29) discussing a DIFFERENT taxonomy's
  mis-citation. Not one is a type, enum, or constant. The §7.3 sets exist nowhere in code. AND IT ALREADY
  CARRIES DRIFTED VALUES — three spellings, two of them in production, none matching any §7.3 member: -
  `packages/rph-engine/src/seed-workbench.ts:417` — `instantiationProfile: 'Standard Product Realization',`
  (PRODUCTION seed) - `apps/rph-demo/src/routes/undertakings/+page.server.ts:122` — `instantiationProfile:
  'Standard',` (PRODUCTION route) - `packages/rph-application/src/handlers/disclosure-observed.test.ts:1867`
  — `instantiationProfile: 'STANDARD',` plus `'Standard Product Realization'` again at
  pwa-version-binding.test.ts:113 and `'Standard'` at pwa-authoring.test.ts:148/184/244/310/336/396 and
  apps/rph-demo/e2e/execution-plan.e2e.ts:455. Three casings/lexemes for what is meant to be one profile,
  and the two PRODUCTION sites disagree with each other — the drift the claim asserts, present in shipped
  code and not only in fixtures. NOTHING VALIDATES IT DOWNSTREAM. `grep -rn "instantiationProfile"
  --include=*.ts packages/rph-application/src packages/rph-domain/src packages/rph-engine/src
  apps/rph-demo/src` returns 12 lines; the ONLY non-test, non-literal occurrence is
  `packages/rph-application/src/handlers/pwa-authoring.ts:1081` — ` instantiationProfile:
  p.instantiationProfile,` — a straight pass-through from payload to persisted object. No membership check,
  no normalization, no canonical set anywhere on the path. CANON HAS NOT SETTLED IT. `grep -rn -i
  "instantiationProfile|instantiation profile" docs/canon/` returns 2 lines, both in REG-005 (:8275, :8293)
  and both merely ENUMERATING the field as one of the eight persisted Undertaking fields while adjudicating
  a different matter (the missing intent binding). There is no REG-005 entry ruling that this field is
  deliberately free-form, and the field appears in no canon vocabulary as a defined term. So this is not
  moot-by-canon; it is simply unconstrained.

### Item 17 — OUT OF SCOPE

*(original at line 105, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **OUT OF SCOPE** (MEDIUM). Trust-tier topology is a deployment concern this repository does not attempt:
  the Guide itself lists "sandbox isolation" among the "deferred capabilities" the "broader platform adds…
  when those enter scope" (Guide:2344), and JPWB-REG-005 REG-E-006 (:1425, :1501) keeps trust tiers an OPEN,
  Executive-Overview-only claim with default "cede to repository ADRs" — of which there are none.

- **EVIDENCE.** THE RULE, opened and verified at its own line (never inferred from a line number):
  `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:2201` is `### 13.2 Trust topology`;
  `:2203` = "Keep three trust tiers distinct:"; the table rows are `:2207` `| `control-plane` | trusted
  platform code, authoritative professional state, identity, policy, governance, audit, orchestration |`,
  `:2208` `| `sandbox` | ephemeral least-privilege execution of untrusted or tenant-directed tools; never
  direct semantic authority |`, `:2209` `| `tenant-app` | delivered applications and workloads with their
  own runtime identity and bounded data access |`. THE FACTUAL LIMB IS TRUE AT HEAD. (a) The agent is
  constructed in the SvelteKit server process that also hosts the engine:
  `apps/rph-demo/src/lib/server/agent/index.ts:14` `export async function createAuthoringAgent(`, called
  from `apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:335` `const agent = await
  createAuthoringAgent(turn.broker, mode);`. (b) Its tools call a broker that holds a live engine handle and
  dispatches domain commands with no process, plane, or credential boundary:
  `packages/rph-authoring/src/broker.ts:818` `return this.engine.dispatch(command);`, over `readonly engine:
  AuthedEngineHandle;` (`:184`, `:230`), with `actorType: 'AGENT',` at `:245` and a batch path `const batch
  = this.engine.dispatchBatch(built.commands);` at `:607`. (c) No trust tier exists anywhere in the code.
  `packages/rph-application/src/handlers/runtime-binding.ts:66` writes `sandboxPolicy: {},` — a hardcoded
  empty object, the only sandbox-shaped field in the engine. NEGATIVE SEARCHES WITH POSITIVE CONTROLS (EM-2;
  `-i` alone, never `-i -F` together, per the instrument defect): `grep -rn -i "control.plane"
  --include=*.ts --include=*.svelte packages apps | grep -v node_modules` = **2 hits**, and opening both
  shows neither is a tier: `packages/rph-domain/src/enforcement-register.ts:718` "…the engine has no
  source-control plane to make one in." (the English phrase "source-control plane") and
  `packages/rph-persistence/src/sql-driver.ts:2` "(VS Code extension, platform control-plane) are Node" (a
  comment). CONTROL, same flags, same paths: `"engine"` = **2771 hits**, so the near-zero is an absence, not
  the pipe bug. WHY IT IS NEVERTHELESS OUT OF SCOPE — two independent authorities, quoted: (1) THE GUIDE
  ITSELF DEFERS THE TIER MECHANISM to a different system. `…Coding Agent Guide.md:2344`: "The broader
  platform adds proportional tests when those deferred capabilities enter scope: application-plus-RLS
  cross-tenant denial, redaction and inference leakage, audit-chain verification, secret non-disclosure, PWA
  version pinning and migration, edition entitlement, **sandbox isolation**, distributed recovery,
  deployment behavior, and resource fairness." Sandbox isolation is named, by the Guide, as a capability
  that has not entered scope. §13.1 is likewise conditional — `:2180` "Unless a current repository ADR says
  otherwise, implement against the Executive Overview baseline" — and that baseline (`:2181-2184`:
  "SvelteKit · Bun · oRPC · Prisma/PostgreSQL with RLS · DBOS · Cerbos") is not what this repository builds;
  persistence here is better-sqlite3 (`packages/rph-persistence/src/sql-driver.ts:2`). `find . -maxdepth 3
  -type d -iname "*adr*" -not -path "./node_modules/*"` returns **0** — there is no ADR either way. (2)
  CANON CLASSIFIES TRUST TIERS AS AN UNADOPTED, EXECUTIVE-OVERVIEW-ONLY PLATFORM CLAIM, still unresolved.
  `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:1425`: "**REG-E-006** — Disposition of
  Executive-Overview-only platform claims (two-plane architecture, editions, trust tiers, stack). Feeds
  REG-Q-038. *Default: cede to repository ADRs.*" At `:1501` the item is expressly "**SPONSOR EVIDENCE
  RECORDED (2026-08-06), item remains OPEN**", and the sponsor's own configuration statement — "There are
  three configurations: standalone, SaaS and Enterprise" — does not match the Guide's tiers at all. The
  programme's own working design says the same: `docs/_working/DESIGN-accountability-substrate.md:176-177`
  "only the three named editions, **the trust tiers**, and the stack are Executive-Overview-only." AND THE
  CLAIM'S NORMATIVE LIMB DOES NOT FOLLOW EVEN ON THE GUIDE'S OWN TEXT: §13.2 places an *agent* in the
  control plane's authorization model, not in the sandbox — `:2213` "Four principal kinds—human, machine,
  workload, and agent—resolve through one authorization model." The sandbox tier's population, per the §13.1
  diagram at `:2188`, is "untrusted compilers, coding agents, tools, and builds" — untrusted code execution,
  not semantic authoring. And the repository does keep the authority seam the tier table protects:
  `packages/rph-authoring/src/broker.ts:7-9` "this broker authors only a DRAFT (define/edit/remove/link PWU
  Types, edit the PWA's own details); it deliberately does NOT expose the publication FSM — a human advances
  DRAFT -> ... -> PUBLISHED. That is the 'agent proposes, human publishes' seam."

### Item 18 — OUT OF SCOPE

*(original at line 106, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **OUT OF SCOPE** (HIGH). Editions are a commercial-packaging concern JPWB does not attempt: §13.5's
  `ee/`+entitlement obligation is conditional on Enterprise-only implementation that does not exist,
  Guide:2344 lists "edition entitlement" among deferred broader-platform capabilities, and JPWB-REG-005
  REG-E-006 leaves editions an OPEN, unadopted Executive-Overview-only claim.

- **EVIDENCE.** THE FACTS ARE EXACTLY AS CLAIMED, verified at HEAD. • No `ee/` boundary: `ls -d ee` → "ls:
  cannot access 'ee': No such file or directory"; `find . -maxdepth 3 -type d -name "ee" -not -path
  "./node_modules/*"` → 0 rows. Workspace members are only `packages/*` and `apps/*` (`package.json:6-9`),
  12 packages + 1 app, none named for an edition. • No edition concept: `grep -rn -i "edition" .
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude-dir=.svelte-kit
  --exclude-dir=coverage --exclude-dir=test-results` → **1 hit, and it is `Binary file ./.tracker/tracker.db
  matches`** — zero source occurrences. POSITIVE CONTROL, identical flags and identical scope: the same
  command for `"assurance"` returns **9571**. Narrowed to source files, `grep -rn -i "edition"
  --include=*.ts --include=*.svelte packages apps` = **0** against a control of `"assurance"` = **4506**. •
  No entitlement check: `grep -rn -i "entitlement" --include=*.ts --include=*.svelte --include=*.json
  packages apps` = **0** (same 4506 control). • No license gate: `grep -rn -iE "license|licence"
  --include=*.ts --include=*.svelte packages apps` = **35**, and I opened all 35. Every one is either the
  English verb ("licenses raising a flag", `packages/rph-application/src/handlers/assurance.ts:1070`; "no
  clause licenses one ", `packages/rph-application/src/handlers/waiver-authorization.ts:83`) or the
  dependency-cruiser metadata key (`packages/csaa/src/providers/dependency-cruiser/normalize-output.ts:171`
  `const DEPENDENCY_IGNORED_KEYS = new Set(['cycle', 'license']);`). Not one is a gate. The only structural
  licensing fact is uniform and edition-free: all 12 `packages/*/package.json` files carry `"license":
  "AGPL-3.0-only"`, including `packages/rph-authoring/package.json:7`. WHY THIS IS NOT A GAP IN THIS
  REPOSITORY. (1) §13.5's obligation is CONDITIONAL on there being Enterprise-only code, and there is none.
  `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:2245` `### 13.5 One codebase, three
  editions`; `:2253` "Maintain one codebase and shared contracts. **Enterprise-only implementation belongs
  behind** the governed open-core boundary (currently `ee/`) plus build-time inclusion and runtime
  entitlement checks." A single uniformly-AGPL engine with no Enterprise-only implementation satisfies that
  sentence vacuously; §13.5 nowhere obliges an `ee/` directory to exist in the absence of code to put in it.
  (2) THE GUIDE ITSELF NAMES EDITION ENTITLEMENT A DEFERRED, OTHER-SYSTEM CAPABILITY. `…Coding Agent
  Guide.md:2344`: "**The broader platform adds proportional tests when those deferred capabilities enter
  scope**: … PWA version pinning and migration, **edition entitlement**, sandbox isolation, distributed
  recovery, deployment behavior, and resource fairness." (3) CANON HAS NOT ADOPTED EDITIONS AT ALL, and says
  so in the same breath as trust tiers. `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:1425`
  REG-E-006 — "Disposition of Executive-Overview-only platform claims (two-plane architecture, **editions**,
  trust tiers, stack) … *Default: cede to repository ADRs.*" — and at `:1501` the item "**remains OPEN**",
  with the sponsor's own naming ("standalone, SaaS and Enterprise") *disagreeing* with the Guide's
  Community/Enterprise/Cloud table (`:2249-2251`); the register records that "**The three configurations are
  named nowhere in the ratified corpus** — searched and confirmed".
  `docs/_working/DESIGN-accountability-substrate.md:176-177` concurs: "only **the three named editions**,
  the trust tiers, and the stack are Executive-Overview-only." Separately, the `ee/` open-core boundary in
  my working knowledge belongs to a different product line (JanumiCode v2's AGPL + `ee/` monorepo strategy),
  not to JPWB — which is consistent with there being no trace of it here.

### Item 19 — FALSE AT HEAD

*(original at line 107, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (MEDIUM). §9.3:1218 states the impact-closure OBLIGATION while §16 item 24
  declares only the CONTRACT unfrozen; §8.6:917 supplies the unresolved-case rule ("Unknown impact triggers
  conservative revalidation or escalation") and §16's own item 23 at :2520 forbids weakening "impact
  closure" — so the sections gate the wire shape and the extra test properties, never the obligation, and
  the claimed contradiction does not exist.

- **EVIDENCE.** BOTH CITED SITES OPENED AND VERIFIED AT THEIR OWN LINES. `docs/Janumi Canonical
  Implementation Context - Coding Agent Guide.md:1202` is `### 9.3 Authoritative Command pipeline`, and the
  pipeline step is at `:1218`: "→ revalidate impact/revalidation closure and reject missing, failed, stale,
  invalidated, or bypassed assurance" — unqualified, inside a block whose closing sentence (`:1224`) is "No
  generic CRUD/PATCH path, UI local state, RPH worker, Validator, projection worker, broker message, agent
  output, or informal approval bypasses this pipeline." `:2492` is `## 16. Do-not-guess decision register`,
  and row 24 is at `:2521`: "**Finding, repair, revalidation, and convergence contracts.** Legacy
  finding/repair/convergence schemas and enums do not match `FindingDefinition`, `AssuranceObservation`,
  current Commands/Events, or service boundaries; exact subject-version binding, stable recurrence identity,
  repair representation, **impact rules**, resolution authority, and convergence composition **remain
  incomplete**." So limbs one and two are accurate. THE CLAIM FAILS ON ITS THIRD LIMB, AND THAT LIMB IS WHAT
  MAKES IT A CONTRADICTION. "Every other section gates them on that item's ratification" is not what the
  text says. I enumerated every occurrence of "impact" in the Guide (`grep -n "impact"` = 40 lines) and read
  each gating site. What every one of them gates is the CONTRACT, WIRE SHAPE, or TEST PROPERTY — never the
  obligation: • `:352` "…whose exact **service and machine contracts** remain unresolved under Section 16
  items 22–25; **do not invent parallel services, tables, or Events** for them." (contracts) • `:900` "Exact
  recurrence and **repair contracts** remain Section 16 item 24 decisions." (contracts) • `:2304`
  "**Additional** repair, convergence, and meta-assurance **properties** become mandatory when Section 16
  items 24–25 are ratified…" (test properties, and explicitly the *additional* ones — P9–P12 stay mandatory)
  • `:2334` "**Additional** repair, convergence, and meta-assurance **scenarios** apply after Section 16
  items 24–25 are ratified…", whose bullet at `:2339` is the gated one. (test scenarios) • `:2438` "Where an
  accepted repair/revalidation contract applies, repair creates governed successor work and closes its
  required impact set." (contract-conditional mechanism) AND THE GUIDE SUPPLIES THE MISSING PIECE
  EXPLICITLY, IN TWO PLACES THE FINDING DOES NOT CITE: (a) `:917`, byte-exact tail: "**Unknown impact
  triggers conservative revalidation or escalation.**" — the unresolved case has a stated rule; the
  obligation does not lapse when the rules are incomplete, it widens or escalates. The same line's first
  sentence forecloses the omission reading outright: "Any adopted impact/revalidation contract must treat
  targeted revalidation as a **cost optimization, not permission to omit affected assurance**." (b) §16
  ITSELF, one row above the row the finding relies on, treats impact closure as mandatory and un-weakenable.
  `:2520` (item 23) ends, byte-exact: "**optional optimization may add controls but cannot weaken mandatory
  policy, Evidence, independence, or impact closure.**" A register that suspended impact closure pending
  item 24 would not, at item 23, forbid weakening it. So the two sentences are about different objects —
  §9.3:1218 states the OBLIGATION; §16 item 24 states that the CONTRACT/RULE SET expressing it is unfrozen —
  and §8.6:917 plus §16 item 23 harmonize them without residue. Note also §16's own preamble at `:2494`:
  "The safe default permits conservative progress without creating new meaning", i.e. an unresolved boundary
  is a conservatism instruction, not a suspension of a pipeline step. CANON POINTS THE SAME WAY RATHER THAN
  MOOTING IT. Ratified JPWB-DOC-003 (OPERATIVE, REG-D-010) carries the impact obligation with NO
  item-24-style gate anywhere: `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:215` DEC-2
  "Revising a decomposition is legal, changes the parent's semantic version, and **triggers impact
  analysis**"; `:308` ASR-15 "**revoking a decision triggers impact analysis** — dependent baselines and
  planning cannot keep standing on it silently"; `:117` OBJ-4 "**falsification triggers impact analysis**".
  What canon records as open is the ACTOR, not the obligation — `docs/canon/JPWB-REG-005 Decision and
  Divergence Register.md:2881` (REG-F-006): "**What keeps it open is not the mechanism but the actor**", and
  REG-E-030 was dispositioned at `:1519` ("the coordinator tier is authorized"). CONTROL for that canon
  search: `grep -rn -i "impact analysis|revalidation closure|impact closure" docs/canon/*.md` returned 19
  hits, so the canon corpus was reachable and non-empty. What is genuinely true and separately filed is that
  this pipeline step is UNIMPLEMENTED in code — REG-005:485 "**DEC-2 IS NOT LANDED… this engine has no
  impact-analysis plane**" — but that is a code gap already on the register, not the guide-internal
  contradiction this finding asserts.

### Item 20 — FALSE AT HEAD

*(original at line 108, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). §8.12:1051 permits a scoped independence waiver "only when the
  applicable policy permits it", and the Reasoning Review floor's policy does not permit it (§11.7.5:1966
  "locked, non-waivable"; §8.4:852) — a conditional permission plus a policy that denies the condition, not
  a contradiction; ratified JPWB-DOC-003 carries both as ASR-13 (:295) and ASR-3 (:250) with ASR-14 (:302)
  supplying the tiered-authority principle that reconciles them.

- **EVIDENCE.** ALL THREE CITED SITES OPENED AND VERIFIED AT THEIR OWN LINES (§ headers confirmed, not
  inferred). • `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:1041` = `### 8.12
  Criteria, independence, and observations`; the sentence is at `:1051`, byte-exact: "If required
  independence is missing, the Assessment cannot be satisfied; record an independence violation and use
  another evaluator or, **only when the applicable policy permits it**, a valid scoped waiver." • `:835` =
  `### 8.4 De minimis assurance floor and control planning`; `:852` "No PWA profile, low-risk
  classification, planner optimization, or local agent instruction may suppress this Reasoning Review floor…
  A missing, stale, malformed, failed, unavailable, or **independence-invalid required review cannot satisfy
  assurance or permit its protected transition**." • `:1962` = `#### 11.7.5 Micro-assurance and Reasoning
  Review`; `:1966` "Every material AI/agent output additionally receives the **locked, non-waivable**
  Reasoning Review floor." THE REFUTATION IS THE CLAUSE THE FINDING DROPPED. §8.12 does not "permit a scoped
  waiver of required independence" — it permits one **"only when the applicable policy permits it."** That
  conditional is the whole mechanism: §8.12 states the general rule and delegates the permission to the
  governing policy, and for the Reasoning Review floor the governing policy sets that condition to false
  (§11.7.5:1966 "non-waivable"; §8.4:852 "cannot… permit its protected transition"). A conditional
  permission whose condition a named policy denies is not a contradiction with that policy; it is how the
  two are designed to compose. The Guide states that composition in general terms elsewhere, twice: `:806`
  "**Never-cross boundary:** tenant isolation, authority, immutable history, strict Commands, legal
  transitions, version isolation, and **non-waivable integrity always hold**"; `:956` "**non-waivable
  integrity cannot be acknowledged away**, and permitted residual risk requires an explicit scoped
  Decision/waiver that preserves findings" — one sentence carrying both halves without strain. §8.15 at
  `:1103` likewise: "Critical integrity failures may be non-waivable." AND RATIFIED CANON SETTLES IT,
  carrying BOTH clauses side by side as invariants of one catalogue — which is the strongest available
  evidence that they do not conflict. In `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md`
  (OPERATIVE per REG-D-010): • `:295` **ASR-13 · Independence is a verified runtime property** — "If
  required independence is missing: the assessment cannot be satisfied, an independence violation is
  recorded as a first-class outcome, and another evaluator or **a policy-permitted scoped waiver** is
  required." (the §8.12 rule, conditional intact) • `:250` **ASR-3 · The de minimis assurance floor is
  unconditional** — "No PWA profile, low-risk classification, planner optimization, or local agent
  instruction may suppress the floor… A missing, stale, malformed, failed, unavailable, or
  **independence-invalid required review cannot satisfy assurance or permit its protected transition**."
  (the §8.4 rule) • `:302` **ASR-14** supplies the reconciling principle explicitly — "Critical integrity
  failures (security, tenant isolation, data integrity, mandatory constraints) **cannot be waived by
  ordinary product authority** — **waiver authority is tiered**, and such failures exceed product-level
  authority" — and its `⚠ REPAIRED 2026-08-09` note records that the earlier weaker wording ("*may* exceed
  ordinary product authority") was a distillation defect corrected back to the source's categorical
  strength. Canon deliberately re-derived this exact boundary and kept both clauses; it did not treat them
  as a conflict needing resolution. CONTROL for the canon search (EM-2): `grep -rn -i
  "non-waivable|nonwaivable|waive" docs/canon/JPWB-DOC-003*.md docs/canon/JPWB-CON-000*.md` returned 14 rows
  across ASR-1/12/13/14/15, DEC-3, DEC-4, STA-8, OBJ-5 — the corpus was reachable, so ASR-13's presence is a
  positive finding rather than a search artifact. Note in passing that the finding also over-reads §8.4:
  §8.4 never uses the word "waiver" at all, so "flatly forbids" is supplied by the reader; what §8.4 forbids
  is *proceeding on an independence-invalid review*, which §8.12's waiver route — recording the violation
  first, and only under a permitting policy — is written to respect.

### Item 21 — TRUE AT HEAD

*(original at line 109, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The Coding
  Agent Guide's §16 register, item 14, rests on a premise — that no canonicalization algorithm exists —
  which is no longer true, because rph-contracts ships and uses a deterministic canonical-JSON serializer
  plus a SHA-256 content hash. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** WHAT I OPENED. (1) The Guide's §16 register. The heading `## 16. Do-not-guess decision
  register` is at `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:2492`; the table's
  row for item 14 is at `:2511` and reads, byte-exact: `| 14 | **Baseline hashing and cross-aggregate
  promotion.** Hash is optional/“where applicable”; no canonicalization algorithm exists. Promotion and a
  PWU entering \`BASELINED\` cross aggregate boundaries without a complete ordering/recovery protocol. |`.
  Section number verified by reading the heading at :2492 and the row number in the row itself, not inferred
  from the line. (2) The algorithm the premise denies. `packages/rph-contracts/src/hash.ts:1-13` header,
  byte-exact: `// Canonicalization is a DETERMINISTIC subset scheme (JCS-aligned for our data shape):` … `//
  - object keys sorted ascending by UTF-16 code unit (JS default string sort);` … `// - minimal separators,
  no insignificant whitespace;`. `:20-23` `export function canonicalJson(value: unknown): string { return
  serialize(value); }`. `:77-80` `/** Lowercase hex SHA-256 of a UTF-8 string. */ export function
  sha256Hex(input: string): string { return createHash('sha256').update(input, 'utf8').digest('hex'); }`.
  `:83-88` `contentHash` → `return \`sha256:${sha256Hex(canonicalJson(value))}\`;`. (3) It is RATIFIED, not
  incidental. `docs/JPWB Reconciliation Ratify Sheet (M0).md` §B *Ratified registries (implemented)*,
  `:40-41`, byte-exact: `- **Content hash** = \`sha256:<hex>\` over deterministic canonical JSON →
  \`src/hash.ts\` (MUST for baseline\n items + admitted evidence).` (4) It is IN PRODUCTION, not test-only.
  `packages/rph-application/src/command-bus.ts:21` `import { contentHash } from
  '@janumipwb/rph-contracts/hash';`, used at `:567` `const actualContentHash = actual ? contentHash(actual)
  : undefined;` and `:698` `return { payloadHash: contentHash(command.payload) };`.
  `packages/rph-application/src/handlers/kit.ts:519` `resultHash: contentHash(args.nextState),` and `:525`
  `payloadHash: contentHash(command.payload)`. (5) CANON ALREADY DROPPED THE STALE CLAUSE, which is why this
  survives only in the Guide. `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:242-244`,
  `REG-Q-014 — Baseline hashing and cross-aggregate promotion`, restates item 14 as `Hashing is optional in
  places with no complete canonicalization protocol for promotion effects that cross aggregate boundaries
  (for example a PWU entering \`BASELINED\`).` — and its safe default says `Use only the accepted hash
  contract`, presupposing one exists. REG-005:169 confirms the carry-forward is deliberate: `The Coding
  Agent Guide's §16 register (25 items) is the strongest prior inventory of unresolved boundaries. Every
  item still unresolved is carried forward here`. The Guide is nevertheless still operative for DETAIL —
  `docs/canon/JPWB-CON-000 Constitution.md:97` (B1, amended 2026-08-09 REG-D-034) admits `the SOURCE CORPORA
  … and the Coding Agent Guide — holding authority for DETAIL`. So an agent reading §16 item 14 today is
  told an algorithm does not exist that has been shipped, ratified and wired. CONTROLS (EM-2). `grep -c "no
  canonicalization algorithm" JPWB-REG-005` → **0**; POSITIVE CONTROL same file same flags `grep -c
  "canonicaliz"` → **5**. `grep -c "canonicaliz"` over the Guide → **4** (the other three, at `:347`,
  `:1174`, `:1484`, are Validator-OUTPUT canonicalization, a different subject — each opened). POSITIVE
  CONTROL `grep -c "hash"` over the Guide → **11**. `grep -in "canonicaliz"
  docs/_working/HARMONIZATION-FINDINGS.md` → **1 hit, line 109**, i.e. this struck item itself and nothing
  in the 75-row table; POSITIVE CONTROL `grep -ci "hash"` same file → **3**.

### Item 22 — FALSE AT HEAD

*(original at line 110, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Not a contradiction: the exemption and the Attempt-binding are five
  sentences apart, and canon ratifies both halves — PER-8's own NON-EXAMPLE (JPWB-DOC-003:367) names
  retained volunteered model reasoning as material that "by rule participates in nothing" and is purgeable,
  and PER-12 (:381, sponsor-ruled REG-D-015) carries the Attempt-binding and the purgeability in one
  invariant.

- **EVIDENCE.** WHAT I OPENED. §9.7's heading is at `docs/Janumi Canonical Implementation Context - Coding
  Agent Guide.md:1334`; the chain-of-thought paragraph is one physical line, `:1338`. Split on sentence
  boundaries, the two clauses the finding pairs are **five sentences apart, not one**: sentence 5 —
  `Material that arrives is redacted at the boundary and then retained as a typed Artifact of its producing
  Attempt under retention, security, and access policy, so the prompt/reasoning/response exchange stays
  reconstructable.` — and sentence 10 — `It participates in no execution, assurance, governance, Baseline,
  or traceability, so Section 10.1's no-hard-delete rule does not reach it; it is purgeable at retention
  expiry.` So the finding's own textual assertion (*"the same sentence"*) is wrong on inspection. §10.1's
  rule it invokes is at `:1371`: `Do not hard-delete objects that have participated in execution, assurance,
  governance, a Baseline, or traceability.` WHY THE SUBSTANCE FAILS TOO — CANON RATIFIES THE CARVE-OUT ON
  BOTH SIDES, so retention-binding is expressly not participation. `docs/canon/JPWB-DOC-003 Semantic Model
  and Invariant Catalog.md:365` PER-8 (`**PER-8 · No hard delete after participation.**`) and its `:367`
  NON-EXAMPLE, byte-exact: `**NON-EXAMPLE:** never-participated drafts, expired retention-bounded material
  that by rule participates in nothing (e.g., retained volunteered model reasoning — PER-12), and
  rebuildable projections are all purgeable; this rule does not embalm scratch space.` The other half,
  `:381` PER-12 (`(Sponsor-ruled — REG-D-015.)`) carries the same binding AND the same purgeability without
  treating them as in tension: `… retained where available as a typed Artifact bound to its producing
  Attempt under the applicable retention, security, and access policy.` … `It is purgeable at retention
  expiry (PER-8).` The sponsor ruling is `JPWB-REG-005:146` `REG-D-015 — The chain-of-thought retention
  ruling, in sponsor voice (closes REG-E-003, resolves REG-Q-027)`. AND THE REGISTER HAS ALREADY ADJUDICATED
  THIS EXACT STRUCK ITEM. `JPWB-REG-005:14926-14941`, inside REG-F-245, quotes
  `docs/_working/HARMONIZATION-FINDINGS.md:110, refuted item 22` verbatim and rules on it: `**Its claim was
  a CANON-INTERNAL CONTRADICTION; mine is a MISSING MECHANISM in the code.** Its refutation is evidence FOR
  this entry, not against it: it left the exemption reading standing, which is the reading PER-8's
  non-example now carries in canon.` REG-F-245 (`:14771`, OPEN, CODE_DIVERGES, dated 2026-08-23) is a
  *different* live defect — that nothing in the engine can actually perform the permitted purge
  (`retentionClass` is a bare `z.string()` at `packages/rph-contracts/src/objects.ts:622` with zero readers;
  no purge command among 105). That gap is real and filed; the doc-internal contradiction alleged here is
  not. CONTROL (EM-2). `grep -n "chain-of-thought" docs/canon/*.md` → non-zero across CON-000:63,
  DOC-002:175/177/179, DOC-003:255/381, DOC-004:346-362, REG-005 (13 hits) — the instrument reaches the
  subject, so the PER-8 non-example being the only carve-out is an observed fact, not a silent zero.

### Item 23 — FALSE AT HEAD

*(original at line 111, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). §3 never makes View and Projection disjoint — :232 says "A View may
  use one or more Projections", and the §3 inequality block omits View ≠ Projection while including PWA Work
  Architecture View ≠ Professional Work Graph. Canon settles it the same way: DOC-002:192 "View = surface,
  Projection = derivation" (distinct axes, not disjoint kinds), and DOC-002:186 itself calls the named "V&V
  View" a projection.

- **EVIDENCE.** WHAT I OPENED. §3's heading is at `docs/Janumi Canonical Implementation Context - Coding
  Agent Guide.md:203`. The two rows the finding relies on are `:232` — `| **View** | User-facing
  representation of underlying professional-work or execution data. A View may use one or more Projections.
  It is presentation, not architecture or authority. |` — and `:233` — `| **Projection** | Derived
  representation optimized for a particular question or user need. It is rebuildable and never an
  independent source of truth. |`. §3 therefore states the relation as COMPOSITIONAL (`A View may use one or
  more Projections`), never as disjoint. The §3 `Always preserve these inequalities` block (`:245-263`) is
  the place §3 declares things non-equivalent, and it lists `PWA Work Architecture View ≠ Professional Work
  Graph` — it does **not** list View ≠ Projection. The `PWA Work Architecture View` row at `:217` reads
  `Recursive View of a PWA version's PWU Types and permitted composition.` THE §11.2 SENTENCE, READ IN FULL.
  `:1526` (§11.2 heading at `:1508`): `The PWA Designer's primary structural projection is labeled **PWA
  Work Architecture View**. It recursively renders PWU Types from the PWA root through named child
  composition; it is not labeled a Professional Work Graph and layout never implies execution order.` That
  is exactly the composition `:232` licenses — a projection carrying a View's label — and the only
  non-equivalence it asserts is the one §3 actually declared (`not … a Professional Work Graph`). CANON PUTS
  IT BEYOND ARGUMENT, IN BOTH DIRECTIONS. `docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:186`, byte-exact:
  `**View** is a user-facing representation of underlying professional-work or execution data. A View may be
  implemented using one or more Projections. It is presentation — never architecture, never authority. A
  Security View is not automatically a Security Maintenance PWA, and the named JanumiCode surfaces
  (Architecture Studio, V&V View, and peers) are projections, never PWAs.` — ratified canon itself calls a
  named *View* (`V&V View`) a projection, the very move the finding calls a contradiction. And `:192` fixes
  the reading: `> The three are distinct: View = surface, Projection = derivation, Viewpoint = concern.
  Prevents: the legacy \`Lens\` ambiguity, where one word covered all three plus the work architecture
  itself.` They are distinct **axes** — surface vs derivation — so one artifact is both.
  `docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md:639` (quoted at `:8657`) builds
  on that: `A **Surface** is a named, addressable composition of Projections and Affordances … It is a
  proper sub-kind of the canonical **View** (DOC-002:186)`, and the ruling at `:8660` (`**RULING — (b) a
  proper sub-kind of the canonical View. RULED UNDER DELEGATED AUTHORITY (2026-07-28).**`) confirms this
  sub-kinding `contradicts nothing in DOC-002 §5`. CONTROL (EM-2). No load-bearing negative search: every
  claim above rests on a positive hit. The DOC-002 lookup instrument was exercised positively — `grep -n
  "PWA Work Architecture View" docs/canon/*.md` → 5 hits including DOC-002:105 (`**PWA Work Architecture
  View** is the recursive View of a PWA version's PWU Types and permitted composition.`), so canon does
  carry the term.

### Item 24 — FALSE AT HEAD

*(original at line 112, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (MEDIUM). §9.3:1226 is a closed enumeration of eight bypass channels, not a
  universal "nothing bypasses"; §16 item 9 (:2506) repeats §9.3's first prohibition ("No generic CRUD into
  canonical tables") and constrains the bootstrap SOURCE while the create/publish/instantiate wire shapes
  are unresolved — an orthogonal concern from the write path. Canon carries both verbatim (PER-3 at
  DOC-003:345, REG-Q-009 at REG-005:217-220) with no divergence filed between them, and the shipped seeds
  satisfy both by driving live commands (seed-workbench.ts:1-5, reference-undertaking.ts:262).

- **EVIDENCE.** WHAT I OPENED. §9.3's heading is at `docs/Janumi Canonical Implementation Context - Coding
  Agent Guide.md:1202`; the sentence the finding paraphrases as "nothing bypasses" is at `:1226`, byte-exact
  and complete: `No generic CRUD/PATCH path, UI local state, RPH worker, Validator, projection worker,
  broker message, agent output, or informal approval bypasses this pipeline.` That is an **enumeration of
  eight named channels**, not a universal — and a seed/fixture or an adapter over an existing API is none of
  the eight. ITEM 9 REPEATS THAT PROHIBITION RATHER THAN SANCTIONING A BYPASS. `:2506`, byte-exact: `| 9 |
  **PWA/PWU Type/Undertaking bootstrap.** The initial contract begins with \`CaptureIntent\` against an
  existing Undertaking but defines no create/publish/instantiate/migrate Commands. … | Bootstrap only
  through an accepted seed/fixture or existing API behind an explicit adapter. … **No generic CRUD into
  canonical tables.** The exact wire shape is unresolved—not the recursive composition requirement. …` Item
  9's own text carries §9.3's *first* prohibited channel verbatim. The two clauses govern **different
  things**: item 9 constrains which bootstrap SOURCE is acceptable while the create/publish/instantiate wire
  shapes are unresolved; §9.3 constrains the WRITE PATH. "existing API behind an explicit adapter" means
  routing bootstrap through the contracted commands that already exist, which is the pipeline, not a way
  around it. CANON CARRIES BOTH, UNQUALIFIED, WITH NO RECORDED CONFLICT. `docs/canon/JPWB-DOC-003 Semantic
  Model and Invariant Catalog.md:345` PER-3 restates §9.3's sentence essentially verbatim: `Canonical state
  is mutated only through authenticated, authorized, semantically named commands … No generic CRUD/PATCH
  path, UI local state, RPH worker, validator, projection worker, broker message, agent output, or informal
  approval bypasses this pipeline.` (SCOPE at `:347`: `governs semantic writes … the *existence and
  completeness* of the gate is the semantic requirement.`) `docs/canon/JPWB-REG-005 Decision and Divergence
  Register.md:217-220` `REG-Q-009 — PWA / PWU Type / Undertaking bootstrap` restates item 9's safe default
  verbatim: `Bootstrap only through an accepted seed/fixture or existing API behind an explicit adapter. …
  No generic CRUD into canonical tables.` Canon distilled both from the Guide and filed neither as a
  divergence against the other. AND THE CODE AT HEAD IMPLEMENTS BOOTSTRAP THROUGH THE PIPELINE, closing the
  only reading under which item 9 could have been a bypass (a replayed fixture event log).
  `packages/rph-engine/src/seed-workbench.ts:1-5`, byte-exact: `// seedWorkbench — stand up a
  fully-populated workbench in one call, entirely through live commands: author + publish` … `// It is
  deterministic: it drives commands; no fixture event log is replayed.`
  `packages/rph-engine/src/reference-undertaking.ts:2`: `// §27) driven LIVE through the command pipeline:
  it dispatches an intent lifecycle, proposes the Product`, with the actual dispatch at `:262` `const result
  = handle.dispatch(command);`. `grep -n 'dispatch\|INSERT\|insert\|putObject\|saveObject'
  packages/rph-engine/src/reference-undertaking.ts` returns exactly two lines — the header comment and
  `:262` — and **no direct write**; POSITIVE CONTROL on the same file, same flags: `grep -n
  'contentHash\|retentionClass'` → non-zero (`:1356-1357` seed literals `'INTERNAL'`/`'STANDARD'`), so the
  instrument reaches this file.

### Item 25 — OUT OF SCOPE

*(original at line 113, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **OUT OF SCOPE** (MEDIUM). Textually accurate about the Guide, but moot: Guide §16 item 1 was carried into
  canon as REG-Q-001, CLOSED 2026-08-09 with its safe default declared "spent … no longer governs anything"
  (REG-005:177-179), and the replacement registry CON-000 B1 admits `docs/Recursive Professional Harness/` —
  where JAN-ENGC-001 lives — so the operative authority list does not carry the omission; B1 further
  reserves precedence questions to canon ("authority for detail ONLY; principle remains canon's"), leaving
  nothing in the Guide to fix.

- **EVIDENCE.** ALL THREE LEGS OF THE CLAIM ARE BYTE-EXACT TRUE IN THE GUIDE AT HEAD. (a) `docs/Janumi
  Canonical Implementation Context - Coding Agent Guide.md:2498` — `| 1 | **Ratification status.** … | Treat
  \`RPH-DOC-000\`–\`010\`, generated contracts, and accepted repository ADRs as authority. Draft language is
  rationale/candidate design; repeating it here does not ratify it. |` — the Engineering Constitution is
  absent from that list. (b) Guide:39 — `11. **Engineering practice:** the Engineering Constitution.` inside
  `### 0.1 Authority and precedence` (Guide:25). (c) Guide:2539 — `| [Engineering Constitution](<Recursive
  Professional Harness/Janumi Professional Workbench - Engineering Constitution.md>) | code, comments,
  tests, logging, errors, quality, review | 14–15 | engineering-practice authority |` inside `## 17. Corpus
  coverage and source map` (Guide:2526). Section headings verified with `grep -n '^## '` rather than
  inferred from line numbers; `grep -n 'Engineering Constitution'` over the Guide returns exactly two hits
  (39, 2539) — the term is not in §16 at all. BUT THE CLAUSE THE CLAIM ACCUSES NO LONGER GOVERNS, AND
  CANON'S REPLACEMENT DOES NOT CARRY THE OMISSION. 1. Guide §16 item 1 was CARRIED FORWARD INTO CANON AND
  CLOSED. `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:169` — *"The Coding Agent Guide's §16
  register (25 items) is the strongest prior inventory of unresolved boundaries. Every item still unresolved
  is carried forward here, restated against the six-artifact set and the repository. Safe defaults are
  self-contained: after retirement there is no Guide to consult."* Item 1's carry-forward is REG-Q-001
  (`REG-005:173`, `### REG-Q-001 — Ratification status of the corpus`), and at `REG-005:177` it reads *"**✅
  CLOSED 2026-08-09 (P-5)**"*, with `REG-005:179`: *"**AND THE SAFE DEFAULT IS SPENT, NOT MERELY STALE.** …
  Canon is ratified; the condition is discharged and the default no longer governs anything."* The list #25
  audits is precisely that spent safe default. 2. THE OPERATIVE REGISTRY REPAIRS THE OMISSION.
  `docs/canon/JPWB-CON-000 Constitution.md:97` (B1, as amended by REG-D-034, 2026-08-09) admits *"**the
  SOURCE CORPORA** … `docs/Recursive Professional Harness/`, `docs/Constitution Discussion/`, and the Coding
  Agent Guide"* to the recognized corpus. `ls` confirms the Engineering Constitution lives INSIDE that
  admitted directory: `docs/Recursive Professional Harness/Janumi Professional Workbench - Engineering
  Constitution.md`, whose header (lines 3–6) reads `**Document ID:** \`JAN-ENGC-001\` / **Version:**
  \`1.0.1\` / **Status:** Normative / **Effective date:** 2026-07-17`. So in canon's registry the document
  is IN, not omitted. 3. AND THE GUIDE HAS NO STANDING TO SETTLE THIS KIND OF QUESTION ANY MORE. Same B1
  sentence: *"Admission grants authority for detail ONLY; principle remains canon's by concern."* An
  authority/precedence list is principle, not detail — so Guide §16 item 1 carries zero weight at HEAD.
  (This also explains why the sibling guide-internal finding at row 75 of the CONFIRMED table WAS filed:
  `§9.4` uppercase-enum vs `§11.6` 'UNDER REVIEW' is a DETAIL question, which B1 does leave with the Guide.)
  POSITIVE CONTROLS: `grep -rn 'Engineering Constitution' docs/canon/*.md` returns 9 hits (so the search
  discriminates), including `JPWB-DOC-004 Agent Operating Protocol.md:191` — *"This section absorbs the
  Engineering Constitution's durable content."* `grep -n -i 'fingerprint\|Engineering Constitution\| P5 '`
  over the CONFIRMED table (findings lines 1–86) returns 0 — this claim is nowhere in the 75.

### Item 26 — TRUE AT HEAD

*(original at line 114, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The Guide's
  Mandatory generative property P5 is stated in terms of a "fingerprint", but §3 — the Guide's
  canonical-vocabulary section — never defines that word; the only place the Guide comes close to defining
  it is inside the explicitly-candidate JSDL/Shape-Engineering material in §12, and its other uses are a
  different, prompt/template sense. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** P5, byte-exact, `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md:2293`:
  `| **P5** | Approval of semantic version \`n\` never authorizes \`n+1\` or a different fingerprint. |` —
  under `### 14.2 Mandatory generative properties` (Guide:2283), whose preamble is "Generate valid and
  invalid cases around these properties". Heading verified by grep, not inferred. §3 NEVER MENTIONS THE
  TERM. `grep -n '^## '` puts `## 3. Canonical vocabulary and non-equivalences` at Guide:203 and `## 4.
  Integrated architecture` at Guide:291, so §3 is lines 203–290. `sed -n '203,290p' | grep -c -i
  fingerprint` → **0**. POSITIVE CONTROL, same range, same flags: `grep -c 'Baseline'` → **6**. §3 is a `|
  Term | Canonical meaning |` definition table (Guide:205-206), so a term it omits is a term it does not
  define. EVERY OCCURRENCE IN THE GUIDE, from `grep -n -i fingerprint` (8 hits; control `grep -c -i hash` →
  11, so the file is not being silently zeroed): - 2140/2145/2147 — §12 (`## 12. Shape Engineering, JSDL,
  and JEM`, Guide:2070). The only definitional sentence in the document is 2145: *"The fingerprint excludes
  formatting, comments, and irrelevant declaration order but changes when meaning changes."* It is a JSDL
  COMPILER IR fingerprint (2140: `→ calculate deterministic semantic fingerprint`), and §12's own preamble
  at Guide:2072 labels that material candidate: *"what is candidate — not yet ratified authority over the
  numbered RPH corpus or current repository architecture — is the specific staged formalization in this
  section together with the JSDL v0.1, JEM v0.1, and JSRP encodings."* - 1340 and 2373 — the unrelated
  prompt/template sense: *"A prompt/template fingerprint identifies that record; it never substitutes for
  it"* (1340) and *"prompt/template/tool versions or fingerprints"* (2373). - 900 — explicitly candidate and
  deferred: *"Recurrence uses \`findingCode\` plus a candidate fingerprint/lineage relation"*, gated on §16
  item 24. - 2362 — generated-code provenance. None of these supplies a meaning for "a different
  fingerprint" of an approved semantic version. The claim's characterization is exact. CANON DOES NOT RESCUE
  IT. `grep -rn -i fingerprint docs/canon/` returns hits only in DOC-003 PER-9 (`:369`, the same
  prompt/template sense — *"A prompt or template fingerprint identifies that record; it never substitutes
  for it"*), DOC-004:217, REG-005:924 (a generator edge `trigger`), SPEC-001:3224/3236, and two `_extracts`.
  It returns NOTHING from `JPWB-DOC-002 Canonical Vocabulary.md` — the canon vocabulary artifact — and the
  control `grep -c -i baseline` on that same file returns **10**, so the file is being searched. Canon has
  not defined the term either. AND THE UNDEFINED LIMB IS UNIMPLEMENTED, WHICH IS THE COST. P5 is a gated
  conformance property: `packages/rph-domain/src/conformance-manifest.ts:476` → `P5:
  'packages/rph-domain/src/properties.test.ts'`. That test's own header,
  `packages/rph-domain/src/properties.test.ts:190`, silently truncates the property: `// P5 — approval of
  semantic version n never authorizes n+1.` — the "or a different fingerprint" limb is dropped, and the
  `describe` at :191 and the assertions at :222-227 test version binding only. Repo-wide, `grep -rn -i
  fingerprint packages/rph-*/src` → **3** hits, all inside `packages/csaa/`… no: zero in any rph-* engine
  package (the 3 are the csaa analyzer's own type/signature fingerprints reached through the glob). POSITIVE
  CONTROL on the same glob: `grep -rn 'semanticVersion' packages/rph-*/src` → **229**. No fingerprint
  concept exists anywhere in the RPH engine, so P5's second limb is unimplementable as written — which is
  exactly what an undefined term in a mandatory property costs.

### Item 27 — TRUE AT HEAD

*(original at line 115, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** The three
  package-purity rules in the dependency-cruiser config each name `rph-controller`, a package that does not
  exist in the repo, while none of them names `rph-authoring`, which does — so domain-purity, ports-purity
  and projections-browser-safe all have a hole where rph-authoring should be. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** `.dependency-cruiser.cjs` is 85 lines; I read all of it. The three named rules and their
  exact `to.path` regexes: - `domain-purity` (:30), path at `.dependency-cruiser.cjs:35`: `path:
  '^packages/rph-(persistence|application|assurance|controller|projections|engine|product-realization-pwa)/'`
  - `ports-purity` (:39), path at `:44`: `path:
  '^packages/rph-(domain|persistence|application|assurance|controller|projections|engine|product-realization-pwa)/'`
  - `projections-browser-safe` (:48), path at `:54`: `path:
  '^packages/rph-(persistence|application|assurance|controller|engine|product-realization-pwa)/'` All three
  alternations contain `controller`; none contains `authoring`. Counts: `grep -c 'controller'
  .dependency-cruiser.cjs` → **4** (three rule paths + the `domain-purity` comment at :31, *"no
  persistence/application/assurance/controller/projections/engine/product-realization-pwa"*). `grep -c
  'authoring' .dependency-cruiser.cjs` → **0**. (NOTE ON METHOD: my first grep for the literal
  `rph-controller` returned 0 and would have been the wrong evidence — the name only exists as a regex
  alternation branch. The `-c` pair above is the correct instrument.) THE PACKAGE THAT IS ENUMERATED DOES
  NOT EXIST; THE ONE THAT IS OMITTED DOES. `ls packages/` → csaa, rph-application, rph-assurance,
  **rph-authoring**, rph-contracts, rph-domain, rph-engine, rph-persistence, rph-ports,
  rph-product-realization-pwa, typescript-config — no rph-controller. `find . -maxdepth 3 -name
  '*controller*' -not -path '*/node_modules/*'` → **empty**; POSITIVE CONTROL, identical command with
  `'*authoring*'` → `./coverage/rph-authoring`, `./packages/rph-authoring`.
  `packages/rph-authoring/package.json:2` → `"name": "@janumipwb/rph-authoring"`. THE HOLE IS REAL, NOT
  COSMETIC: rph-authoring is the heaviest possible import. `packages/rph-authoring/package.json:33-36` →
  `"dependencies": { "@janumipwb/rph-contracts": "workspace:*", "@janumipwb/rph-engine": "workspace:*" }`,
  and rph-engine pulls rph-persistence, whose `package.json:28` is `"better-sqlite3": "^12.8.0"`. So an
  import of `@janumipwb/rph-authoring` from rph-projections drags better-sqlite3 into the browser bundle
  that `projections-browser-safe`'s own comment (:50) exists to prevent — and the rule's regex does not
  match it. NOTHING ELSE COVERS IT. `find . -name '.dependency-cruiser*' -not -path '*/node_modules/*'` →
  exactly one file. `package.json:18` → `"boundary": "depcruise packages --config .dependency-cruiser.cjs &&
  bun run scripts/csaa-product-boundary.ts"`, and that second script (read in full, 16 lines) calls only
  `inspectProductBoundary(ROOT)` from the CSAA analyzer — it enforces the product↔analyzer boundary, not the
  rph package DAG. HONEST QUALIFIER on the claim's word "trivially": the `no-circular` rule (:9-14) gives
  incidental cover on some of these arcs, because rph-authoring → rph-engine →
  rph-domain/rph-ports/rph-projections means a package-level back-edge would close a cycle. It is
  module-level detection, though, so an import of a leaf module (e.g. rph-authoring's browser-safe
  `./catalog` subpath, `package.json:14`) need not close one. The FACTUAL core the claim rests on — a
  nonexistent package enumerated, an existing one omitted, in all three purity rules — is exact.

### Item 28 — FALSE AT HEAD

*(original at line 116, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted by Increment 14 (2026-07-16, one day after this file was
  written): the seeded `floor.reasoning-review` ASSURANCE_POLICY is read back from the store fail-closed at
  `apps/rph-demo/src/lib/server/floor.ts:48-62` and threaded into both the rubric and the score
  (`packages/rph-assurance/src/validators.ts:56-72, 225`, where the field is REQUIRED precisely so no
  constant fallback can restore the projection), and the completion gate decides on the stored
  `independenceRequirement`/`permittedControlActions`/`requiredEvidence` at
  `packages/rph-application/src/handlers/assurance.ts:2067-2085, 2169-2175` — so amending a seeded floor
  policy does change floor behaviour and the stack is not inverted. Residual, and worth its own line rather
  than this one: `deMinimisFloorPlan` (`packages/rph-assurance/src/floor.ts:56-80`) still hardcodes WHICH
  policies compose the floor.

- **EVIDENCE.** THE SECOND CONJUNCT — THE ONE THE ACCUSATION RESTS ON — IS REFUTED BY A STORE→RUNTIME PATH
  THAT LANDED THE DAY AFTER THIS FILE WAS WRITTEN. 1. THE POLICY OBJECT IS READ BACK, FAIL-CLOSED, AND IT
  GOVERNS THE REVIEW. `apps/rph-demo/src/lib/server/floor.ts:48-62`: ``` function
  reasoningReviewCriteria(engine: AuthedEngineHandle): readonly AssessmentCriterion[] { const policy =
  getObject(engine, FLOOR_POLICY_IDS.REASONING_REVIEW); if (!policy) { throw new Error(`Fail-closed (§13.3):
  the ${FLOOR_POLICY_IDS.REASONING_REVIEW} ASSURANCE_POLICY is not in the store, so its criteria cannot
  govern the review. …`); ``` Its docblock at `:29-35` states the inversion in the past tense: *"THIS
  FUNCTION IS THE INCREMENT. Until now … the seeded ASSURANCE_POLICY object was a PROJECTION of the code:
  written once at seed time and never read again. … The constant is now only the SEED; the policy object is
  the source."* It is wired at `apps/rph-demo/src/lib/server/floor.ts:316-317`: `// The POLICY's criteria,
  read from the store — not a constant. See reasoningReviewCriteria().` / `criteria:
  reasoningReviewCriteria(engine),`. 2. THE CONTRACT MAKES THAT PATH NON-OPTIONAL, SO IT CANNOT REGRESS
  SILENTLY. `packages/rph-assurance/src/validators.ts:56-72`, on `ReasoningReviewInput.criteria`: *"READ
  FROM THE SEEDED \`floor.reasoning-review\` ASSURANCE_POLICY OBJECT by the composition root, NOT from a
  constant in this file. … REQUIRED, deliberately: an optional field with a constant fallback is how this
  regresses silently. A caller that cannot supply criteria should fail the build"* — declared `readonly
  criteria: readonly AssessmentCriterion[];` at `:72`, no `?`. And the SCORE, not just the prompt, reads it:
  `validators.ts:225` → `const criteria: FloorCriterion[] = policyCriteria.map((c) => {`, with `:207-210`
  recording *"`policyCriteria` IS THE POLICY'S OWN, threaded in from the seeded ASSURANCE_POLICY object.
  This mapped over the `REASONING_REVIEW_CRITERIA` constant … Both now read the policy, so an edited
  criterion reaches the rubric AND the score."* Editing the seeded object therefore changes floor behaviour.
  3. AND IT IS NOT ONLY CRITERIA. `packages/rph-application/src/handlers/assurance.ts:2067-2085` loads the
  governing policy from the store at assessment completion — `:2068-2069`: *"Load the governing policy ONCE
  — its rule arrays must actually decide, not sit settable-and-ignored (the \"hollow governed layer\").
  Three fields govern here: independenceRequirement (the §39-inv-8 check below, Increment I2),
  permittedControlActions (Gate B), and requiredEvidence (Gate A)"* — via
  `ctx.store.loadObject(assessmentState.assurancePolicyId)`. The INV-8 gate then decides on the STORED
  value: `:2169` `const independenceRequirement = policyState?.independenceRequirement;` and `:2173` `if
  (independenceRequirement && independenceRequirement !== 'NONE' && producer && evaluator) {`. The seeded
  field is the same one: `packages/rph-engine/src/seed-workbench.ts:258` → `independenceRequirement:
  def.independence,`. 4. THE TIMELINE MAKES THIS AN UNCARRIED FIX, NOT A MISREADING. `git log
  --diff-filter=A -- docs/_working/HARMONIZATION-FINDINGS.md` → the file was created **2026-07-15**
  (`b2a24ba7`) and `git log -1` shows it has not been touched since. `git log -1 -S 'THIS FUNCTION IS THE
  INCREMENT' -- apps/rph-demo/src/lib/server/floor.ts` → **2026-07-16, "Increment 14: the policy GOVERNS the
  review -- the governed layer stops being a projection of the code"**. The claim was true when written and
  was fixed the next day; the reason was never carried back to this line. WHAT SURVIVES, STATED HONESTLY:
  the FIRST conjunct is still true. `packages/rph-assurance/src/floor.ts:56-80` —
  `deMinimisFloorPlan(subject)` returns a literal array of `FloorPolicyRef`s with hardcoded `policyId`,
  `policyVersion: '1'`, `required: true`, and `independence: 'NONE'` / `'DIFFERENT_MODEL'`; it takes only
  the subject and consults no store. `grep -rn deMinimisFloorPlan` (non-dist) shows its only non-test caller
  is `packages/rph-assurance/src/validators.ts:298`. So WHICH policies compose the floor is still code,
  while WHAT each policy checks and what independence it demands at the gate now come from the governed
  object. The claim's operative charge — one-way projection, §4.1 stack inverted — does not hold at HEAD.

### Item 29 — FALSE AT HEAD

*(original at line 117, struck — kept exactly as the 2026-07-15 pass wrote it)*

- **REFUTED — FALSE at HEAD** (HIGH). Refuted because the fix landed:
  `apps/rph-demo/src/lib/server/floor.ts:48-62` now reads the seeded `floor.reasoning-review`
  ASSURANCE_POLICY out of the store and fails closed if it is missing or criteria-less,
  `EditAssurancePolicy` can patch `criteria` (`packages/rph-application/src/handlers/assurance.ts:269-291`),
  and `policy-governs-review.test.ts` proves in 6 passing tests that a criterion added to or removed from
  the policy changes both the rubric and the scored criterion set — the constant is now only the seed.

- **EVIDENCE.** REFERENCE RESOLVED FIRST (never inferred from a line number): §2.19 is NOT a heading — `grep
  -c '2\.19'` over the Guide returns **0** (positive control in the same file, same flags: `grep -c '4\.3'`
  returns **3**), and `grep -n '^## '` shows section 2 is a flat `## 2. Governing principles` (guide line
  159) with no subsections. §2.19 is therefore principle **19** of that numbered list, at `docs/Janumi
  Canonical Implementation Context - Coding Agent Guide.md:197`, byte-exact: "19. **Assurance itself
  requires assurance.** Policies, Validators, rubrics, Evidence access, control selection, independence, and
  remediation pressure are versioned, observable, challengeable, tested, and governable." That is the clause
  the claim cites, so the citation is sound; the claim about the CODE is not. REFUTATION.
  `apps/rph-demo/src/lib/server/floor.ts:48-62` defines `reasoningReviewCriteria(engine)`, which reads the
  policy OBJECT out of the store: `const policy = getObject(engine, FLOOR_POLICY_IDS.REASONING_REVIEW);`
  (`:49`), then `const criteria = policy.criteria;` (`:55`). It fails CLOSED both ways — `:52` throws
  "Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} ASSURANCE_POLICY is not in the store, so
  its criteria cannot govern the review. Seed the floor policies before running the floor." and `:58` throws
  "Fail-closed (§13.3): the ${FLOOR_POLICY_IDS.REASONING_REVIEW} policy records no criteria, so a Reasoning
  Review over it would assert a rubric no policy declares." It is wired into the live floor run at
  `floor.ts:316-317`: "// The POLICY's criteria, read from the store — not a constant. See
  reasoningReviewCriteria()." / `criteria: reasoningReviewCriteria(engine),` inside the `ValidatorContext`
  passed to `runFloorAndPlanRecording`. THE REASON THAT WAS NEVER CARRIED BACK is written in the code
  itself, `floor.ts:32-36`: "THIS FUNCTION IS THE INCREMENT. Until now the rubric and the scored criterion
  set both keyed off the `REASONING_REVIEW_CRITERIA` constant in `rph-assurance`, so the seeded
  ASSURANCE_POLICY object was a PROJECTION of the code: written once at seed time and never read again.
  Editing it would have changed the UI card and nothing in the evaluation — \"a policy that lies about what
  it checks\". The constant is now only the SEED; the policy object is the source." That paragraph describes
  the claim as the PRE-fix state, in the past tense. DOWNSTREAM CONFIRMATION:
  `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:63-65` — "THE RUBRIC IS THE POLICY'S
  OWN. This rendered from the REASONING_REVIEW_CRITERIA constant, which is what made the seeded
  ASSURANCE_POLICY object a projection of this file — written at seed time and never read again." The rubric
  line is now `input.criteria.map((c) => `- ${c.id}: ${c.description}`)`, and even the JSON output example
  is drawn from the policy: `"criterionId":"${input.criteria[0]?.id ?? 'CRITERION-ID'}"`. PROVEN BY TEST,
  DRIVEN NOT ASSUMED. `apps/rph-demo/src/lib/server/assurance/policy-governs-review.test.ts:69` —
  `describe('the POLICY governs the Reasoning Review — the seeded object is load-bearing, not a projection',
  ...)`. Six cases, and it is a real suite, not a stub: `grep -c 'it('` = **6**, `grep -c '\.skip\|\.todo'`
  = **0**. I RAN it: `./node_modules/.bin/vitest run
  apps/rph-demo/src/lib/server/assurance/policy-governs-review.test.ts` → "Test Files 1 passed (1) / Tests 6
  passed (6)". The cases are exactly the claim's negation: `:70` "a criterion that exists ONLY in the policy
  reaches the RUBRIC the reviewer is asked to judge" (asserting
  `expect(prompts[0]).toContain('RR-99-tenant-isolation')`, with the in-test note "Under the old code the
  rubric was REASONING_REVIEW_CRITERIA.map(...) and this id could never appear."); `:81` "a criterion
  REMOVED from the policy disappears from the rubric — the constant does not smuggle it back" (loops every
  constant criterion asserting `.not.toContain(c.id)`, noted as "the half that catches a fallback:
  `input.criteria ?? REASONING_REVIEW_CRITERIA` would fail right here"); `:96` "the policy also governs the
  SCORED criterion set — not just the prompt" (`expect(result.criteria).toHaveLength(1)` /
  `expect(result.criteria[0]!.criterionId).toBe('RR-99-tenant-isolation')`); `:108` the finding-id whitelist
  follows the policy; `:131` "a criterion's ratified severity decides whether it BLOCKS — `mandatory` is
  derived, not hardcoded true". GOVERNABLE THROUGH A COMMAND, which is the §2.19 word the claim denies:
  `packages/rph-application/src/handlers/assurance.ts:269-291` lists `EDITABLE_PATCH_FIELDS` for
  `EditAssurancePolicy`, and it contains both `'criteria'` and `'independenceRequirement'`. So a floor
  policy is amendable via the governed command path, and the amended criteria are what the next floor run
  reads. RESIDUE, DISCLOSED SO THIS IS NOT OVER-READ (and it belongs to refuted-item 28, not 29):
  `packages/rph-assurance/src/floor.ts:56-80` `deMinimisFloorPlan()` still hardcodes the POLICY SET,
  `policyVersion: '1'`, `required: true`, and `independence: 'NONE' | 'DIFFERENT_MODEL'` as literals and
  consults no store. So amending a policy object's independence requirement does not move the plan's
  independence. But the claim as written is a universal negative — "cannot change floor behavior" — and the
  criteria path is a live, tested, fail-closed counterexample that changes both the rubric the reviewer
  judges and the scored criterion set that drives the disposition.

### Item 30 — TRUE AT HEAD

*(original at line 118, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence MEDIUM). **The strike is wrong and is kept only as history.** The PWA
  Designer / authoring obligations that §15.6 makes part of "done" are proven only by the Playwright e2e
  suite, and continuous integration never executes that suite. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** §15.6 VERIFIED AT THE LINE, not inferred: `docs/Janumi Canonical Implementation Context -
  Coding Agent Guide.md:2472` is "### 15.6 Definition of done", and the bullet the claim invokes reads
  byte-exact: "- PWA Designer/authoring-agent changes prove recursive type composition, explicit leaves,
  typed relationship separation, recursive instance creation, recomposition, assurance assignment/capability
  visibility, actual-execution drill-down, and positive/negative publication fixtures;". THE LOAD-BEARING
  CONJUNCT — "the CI gate never runs it" — HOLDS. `find .github -type f` returns exactly ONE file:
  `.github/workflows/ci.yml`. There is no second workflow, no `.husky` directory, no `core.hooksPath`, and
  no non-sample git hook. So that file IS continuous integration here. Its complete step list,
  `.github/workflows/ci.yml:19-30`, is: `Build: bun run build` (`:19-20`), `Type-check: bun run check-types`
  (`:21-22`), `Lint: bun run lint` (`:23-24`), `Boundary (package DAG + no-UI-in-core): bun run boundary`
  (`:25-26`), `Format check: bun run format:check` (`:27-28`), `Test: bun run test` (`:29-30`). The file
  ends at line 30. It never runs `e2e`, never runs `test:coverage`, and never invokes `gate` or `gate:fast`.
  `bun run test` is `turbo run test && bun run test:dist` (`package.json:14`); `apps/rph-demo`'s own `test`
  is `vitest run --passWithNoTests`, a different script from its `e2e` (`apps/rph-demo/package.json`:
  `"e2e": "node ../../node_modules/@sveltejs/kit/svelte-kit.js sync && node
  ../../node_modules/@playwright/test/cli.js test"`). The workflow is also frozen: `git diff 19a1b20f HEAD
  -- .github/workflows/ci.yml` is EMPTY, i.e. byte-identical to its 2026-07-12 import. THE REPOSITORY'S OWN
  CANON AGREES, AND USES "CI" FOR EXACTLY THIS FILE. `docs/canon/JPWB-REG-005 Decision and Divergence
  Register.md:4587` (REG-F-196 Finding 1) states byte-exact: "it is in **neither** `gate` nor `gate:fast`
  (`package.json:25-26`) **nor CI** (`.github/workflows/ci.yml` runs build, check-types, lint, boundary,
  format:check, test — and stops)." That is an independent, ratified-corpus enumeration of ci.yml's six
  steps matching mine, and — decisively for the referent question — it treats CI as a THIRD thing distinct
  from `gate` and `gate:fast`. The same entry states the general principle this finding instantiates: "an
  opt-in witness nobody invokes is a claim of coverage, not coverage." THE COUNTER-READING, DISCLOSED IN
  FULL BECAUSE IT IS WHY THIS ONE IS MEDIUM AND NOT HIGH. `package.json:26` `gate:fast` does end `... && bun
  run test:coverage && cd apps/rph-demo && bun run check && bun run e2e`. If "the CI gate" is read as the
  `gate:fast` script rather than the CI workflow, the conjunct is FALSE. Three facts push against that
  reading: (a) `gate:fast` is a local developer command wired into no automation — nothing in `.github/`
  invokes it; (b) the repo's own inventory classifies it as not running — `docs/ASTs and Code
  Analysis/JAN-CSAA-005 ...md:204-205` records `gate` and `gate:fast` with status `CONFIGURED_NOT_RUN`, and
  `:754-755` lists `bun run gate:fast` / `bun run gate` under "Not run"; (c) REG-005:4587 above explicitly
  separates CI from gate:fast. CHRONOLOGY, which shows nothing has been fixed on the CI side. The findings
  doc was authored 2026-07-15 (`b2a24ba7`). The e2e leg was appended to `gate:fast` on 2026-07-26
  (`9c952433`, `git log -S'cd apps/rph-demo && bun run check && bun run e2e' -- package.json`). `ci.yml`
  last changed 2026-07-12 and is unchanged at HEAD. So the remediation that occurred touched a LOCAL script
  and left CI exactly as the finding described it. FIRST CONJUNCT, WEAKER AND SAID SO. "the only thing
  proving" is not strictly true as a coverage statement: `find apps/rph-demo/src -name '*.test.ts'` returns
  **28** non-e2e unit test files, several on the authoring plane (`authoring-turn.test.ts`,
  `authoring-turn-machine.test.ts`, `pwaFlow.test.ts`, `floor.test.ts`, `policy-governs-review.test.ts`),
  and repo-wide `grep -rln` over `*.test.ts` finds 27 files mentioning "recursive" and 10 mentioning
  "recomposition". However the §15.6 bullet is a Designer/authoring-SURFACE list, and the e2e specs map onto
  it nearly one-for-one: `apps/rph-demo/e2e/` holds `pwa-authoring.e2e.ts`, `pwa-authoring-backbone.e2e.ts`,
  `pwa-authoring-rich.e2e.ts`, `pwa-authoring-delegation.e2e.ts`, `pwa-designer-gallery.e2e.ts`,
  `pwa-node-graph.e2e.ts`, `cardinality-rail.e2e.ts`, `pwa-instantiation.e2e.ts`, `pwa-coherence.e2e.ts`,
  `execution-flow.e2e.ts`. The surface-level obligations (drill-down, capability visibility, publication
  fixtures) are e2e-only.

### Item 31 — TRUE AT HEAD

*(original at line 119, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** `bun run
  boundary` points dependency-cruiser at `packages` only, so `apps/` — where rph-engine, rph-authoring and
  rph-projections are all composed into one host — is never analyzed by the sole gate enforcing §4.3's
  responsibility boundaries. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** §4.3 VERIFIED AT THE LINE: `docs/Janumi Canonical Implementation Context - Coding Agent
  Guide.md:338` is "### 4.3 Logical responsibility boundaries", listing the canonical logical services and
  closing "These are responsibility boundaries, not mandatory microservices. A modular monolith is valid
  when it preserves them." Correct citation. THE INVOCATION. `package.json:18`, byte-exact: `"boundary":
  "depcruise packages --config .dependency-cruiser.cjs && bun run scripts/csaa-product-boundary.ts",`. The
  depcruise entry point is the single argument `packages`. This exact string is pinned by a test —
  `packages/csaa/src/inventory/boundary-policy.test.ts:29` asserts `/^depcruise packages --config .* && bun
  run scripts\/csaa-product-boundary\.ts$/` — so the packages-only scope is not an accident of the moment,
  it is asserted. MEASURED, NOT ARGUED — I RAN THE GATE'S OWN COMMAND. `./node_modules/.bin/depcruise
  packages --config .dependency-cruiser.cjs --output-type json` (exit 0), then counted the emitted module
  graph: total modules : 587 under `packages/` : 575 <-- POSITIVE CONTROL (EM-2), same run, same graph,
  non-zero under `apps/` : **0** violations : 0 The positive control is in the identical output object as
  the negative, so the zero is a real absence and not a broken query. THE TWO `apps/` MENTIONS IN THE CONFIG
  DO NOT CLOSE IT — I checked the direction of each rather than counting the word.
  `.dependency-cruiser.cjs:57-63` `no-app-or-ui-in-core` is `from: { path: '^packages/rph-' }`, `to: { path:
  '^apps/' }` — it constrains what PACKAGES import, and says nothing about what `apps/` imports.
  `.dependency-cruiser.cjs:64-70` `product-does-not-import-csaa` is `from: { path: '^(packages/rph-|apps/)'
  }`, `to: { path: '^packages/csaa/' }` — this one does name `apps/` as a source, but it can never fire on
  an apps file because no apps file is in the graph (0 of 587, above). Beyond that, EVERY layering rule is
  anchored `from: '^packages/...'`: `contracts-is-foundation` (`:26`), `domain-purity` (`:33`),
  `ports-purity` (`:42`), `projections-browser-safe` (`:52`). There is no rule anywhere in the config whose
  `from` is an `apps/` path for layering purposes — so even if `apps/` were added to the cruise, only the
  single csaa rule would apply to it. THE HOST IS EXACTLY THE ONE THE CLAIM DESCRIBES.
  `apps/rph-demo/package.json` dependencies include `@janumipwb/rph-authoring`, `@janumipwb/rph-contracts`,
  `@janumipwb/rph-engine`, `@janumipwb/rph-persistence`, `@janumipwb/rph-product-realization-pwa`,
  `@janumipwb/rph-projections` — engine, authoring and projections composed in one place. And it imports
  them deeply at source: `apps/rph-demo/src/lib/server/floor.ts:7-23` imports from
  `@janumipwb/rph-projections`, `@janumipwb/rph-assurance` and `@janumipwb/rph-engine` in a single module.
  The one host that could violate the layering is the one host the graph excludes. PARTIAL MITIGATION,
  DISCLOSED SO "the ONLY mechanism" IS NOT OVER-READ. The second half of the `boundary` script does reach
  apps: `scripts/csaa-product-boundary.ts:7` calls `inspectProductBoundary(ROOT)`, and
  `packages/csaa/src/subject/product-boundary.ts` declares `readonly perimeter: readonly ['apps',
  'packages'];` (`:27`), enumerates both roots (`:58-63` readdir of `packages` and of `apps`), and returns
  `perimeter: ['apps', 'packages']` (`:107`). But it enforces ONE rule — a single `csaaRoot =
  resolve(repositoryRoot, 'packages', 'csaa')` check at `:50`, i.e. "product must not import the analyzer".
  It performs no §4.3 layering analysis whatsoever. So `apps/` is scanned for one forbidden import and is
  outside every responsibility-boundary rule, which is the substance of the claim.

### Item 32 — TRUE AT HEAD

*(original at line 120, struck — kept exactly as the 2026-07-15 pass wrote it)*

- ⚠ **TRUE AT HEAD** (confidence HIGH). **The strike is wrong and is kept only as history.** turbo.json
  defines a `lint` task whose `dependsOn: ["^lint"]` fans out to package-level lint scripts that no
  workspace member actually defines, making `turbo run lint` inert and concealing that linting is really one
  root-level `eslint .` call with no pipeline. **⚠ OWES A REGISTER ENTRY.**

- **EVIDENCE.** THE DECLARATION. `turbo.json:13-15`, byte-exact: "lint": { "dependsOn": ["^lint"] }, The `^`
  prefix is turbo's topological fan-out to the same-named task in each dependency package, so the task's
  entire content is a dependency on package-level `lint` scripts. NO WORKSPACE MEMBER IMPLEMENTS IT — WITH
  THE POSITIVE CONTROL EM-2 DEMANDS. `package.json:6-9` sets `"workspaces": ["packages/*", "apps/*"]`, which
  resolves to 13 members (12 under packages/, 1 under apps/). I grepped every member's package.json with
  identical flags for three script names, so the zero is measured against two non-zeros in the same sweep
  over the same files: "check-types" -> 12 of 13 <-- POSITIVE CONTROL "build" -> 12 of 13 <-- POSITIVE
  CONTROL "lint" -> 0 of 13 (The single member missing check-types/build is `packages/typescript-config`, a
  config-only package.) So `"^lint"` fans out to nothing, for every member, and the task body is empty.
  NOTHING EVEN INVOKES IT. `grep -rn "turbo run lint"` across `*.json`, `*.ts`, `*.yml`, `*.yaml`, `*.cjs`,
  `*.md` excluding node_modules returns exactly ONE hit — `docs/_working/HARMONIZATION-FINDINGS.md:120`, the
  struck finding itself. POSITIVE CONTROL, same sweep and flags: `grep -rn "turbo run build"` returns real
  invocations at `package.json:11` (`"build": "turbo run build"`) and `package.json:20` (`"test:dist":
  "turbo run build && vitest run ..."`), plus two inventory-baseline records. So the search reaches turbo
  invocations and discriminates; `turbo run lint` genuinely appears nowhere. THE MASKED REALITY, which is
  the second half of the claim and is also true. `package.json:13` is `"lint": "eslint .",` — one root-level
  invocation, not a turbo pipeline. Both consumers call THAT script, never the turbo task:
  `.github/workflows/ci.yml:23-24` (`- name: Lint` / `run: bun run lint`) and `package.json:26` `gate:fast`
  (`... && bun run check-types && bun run lint && bun run boundary && ...`). `eslint.config.mjs` carries no
  per-workspace `files` scoping for source (only `ignores` at `:11` and a test-file override at `:44`),
  consistent with a single flat root pass. So linting is exactly "a single unpipelined root invocation", and
  the turbo `lint` task is dead configuration sitting beside it — a reader consulting turbo.json would
  reasonably infer a per-package lint pipeline that does not exist.
