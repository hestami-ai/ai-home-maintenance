// ⭐⭐ JAN-EXEC PHASE 5 — THE EVIDENCE JOIN. Where a command the model ran becomes something the record holds.
//
// ── ⭑ WHAT THIS DOES, IN THE ORDER IT MUST DO IT ────────────────────────────────────────────────────────────
//
//   1. MINT a participating copy of the result — `ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')`.
//   2. PROPOSE an `EVIDENCE` object naming that address, typed `OBSERVATION` (`R18`).
//   3. RUN the de minimis floor over it, with the model's account read against the host's observed calls (`R15`).
//   4. Hand the ids back, so `CompleteExecutionStep` can name them in `proposedEvidenceIds`.
//
// ⛔ **THE ORDER IS NOT A STYLE CHOICE.** The mint is first because a declaration cannot name an address that
// does not exist yet — the same rule Phase 0 applied when it moved the work product's `put` above its capture.
// The floor is last because `stepResultSubjects` resolves each id to a STORED OBJECT at its own version, so an
// assessment recorded before the evidence exists would have nothing to attach to.
//
// ── ⛔⛔ AND IT IS NOT OPTIONAL ONCE AN ID IS NAMED, WHICH IS THE FACT THAT SIZED THIS PHASE ───────────────────
//
// `completeExecutionStep` unions `outputArtifactIds` with `proposedEvidenceIds` into ONE `resultIds` list and
// loops `floorGateBlock` over every member. So **naming a TEST_RESULT without running a floor over it makes
// every AI step completion REJECT**, with all three policies MISSING. The kernel gate needed no change and the
// recorder needed no change; what was missing was the PRODUCER, and this is it.
//
// ── ⭐⭐ `R18` — EVERY COMPLETED RUN, AND `OBSERVATION` IS THE ACCURATE MEMBER ──────────────────────────────────
//
// A step's model may run `npm ci`, then `npm test`, then `ls`, and **nothing tells this host which was a test
// run**: `run_command` is one tool name for every command, and the argv was chosen by the untrusted party.
// ⛔ A predicate over `argv` — *does this look like a test command* — is a normaliser over text §22.1 classifies
// as untrusted external input, which is the shape this seam has refused five times. So the host records what it
// CAN say: it watched a command run and saw what it exited with. That is an `OBSERVATION`. `TEST_RESULT` would
// be a claim about what the command WAS.
//
// ⚠ **INCLUDING RUNS `R17` WILL BLOCK, AND THAT IS THE FAIL-CLOSED POSTURE.** A run whose output was not
// retained, or whose process was killed, is minted and then REFUSES its own floor. Minting only the runs that
// would pass would let a step complete as though the killed command never happened — which is what
// `unassessableAiContentBlock` already forbids one plane over: *AI-produced content may not enter the governed
// stream with nothing to assess.*
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import {
	REVIEWER_RECOMMENDED_ESCALATION,
	type ProfessionalRationaleSummary
} from '@janumipwb/rph-assurance';
import type { ResolvableExchange } from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import type { FloorRemediationAction } from '../floor.js';
import { escalatedReviewNote } from './floor-over-subject.js';
import {
	processResultLimitations,
	renderProcessResult,
	runProcessResultFloor
} from './process-result-floor.js';

/** One command's result, as it reached the record. */
export interface JoinedProcessEvidence {
	readonly evidenceId: string;
	readonly run: ObservedProcessRun;
	readonly satisfied: boolean;
	readonly observations: { code: string; statement: string }[];
	/**
	 * ⭐ `JAN-ESCREC` D3 (the ER-1 app re-verifier's finding [6]) — each policy this result's floor left unsatisfied, with
	 * the disposition the floor composed for it, in the plan's order — the engine's own test (`floorGateBlock`: anything
	 * not SATISFIED). What the refusal names when the floor recorded NO observation (`describeRefusedEvidence`): a review
	 * that left a criterion unanswered and recommended SATISFIED is INCONCLUSIVE with nothing observed, and its refusal
	 * printed the command, a colon, and nothing (`REG-F-415`'s symptom; its cause is not this field's to close).
	 */
	readonly unsatisfiedPolicies: readonly {
		readonly policyId: string;
		readonly disposition: string;
	}[];
	/**
	 * ⭐ `JAN-ESCREC` D3 — what the floor's classifier answered this result's floor with: the STRUCTURE the refusal keys its
	 * escalation sentence on (`describeRefusedEvidence`), never the observations' prose.
	 */
	readonly remediationAction: FloorRemediationAction;
}

export interface EvidenceJoinInput {
	readonly runs: readonly ObservedProcessRun[];
	/** The producing model's exchange — `R15`: the reasoning under review is the MODEL's. */
	readonly exchange: ResolvableExchange & Record<string, unknown>;
	readonly producingPrompt: string;
	readonly producerModelId: string;
	readonly producerProviderId: string;
	readonly observedToolCalls?: ObservedToolCallReport;
	readonly rationale?: ProfessionalRationaleSummary;
	/** What this evidence is ABOUT, in the producing work unit's terms. `SCOPE_STATED` is an admissibility limb. */
	readonly scope: string;
	readonly tenantPrefix: string;
}

/**
 * The `contentReference` a joined run carries.
 *
 * ⭐ IT NAMES **BOTH** COPIES, AND THAT IS THE WHOLE OF `R16`'s SHAPE. The `mint` is the participating,
 * content-addressed one this act created — provider, key, HASH and size, so a reader can RE-HASH the bytes and
 * REFUSE a record that lied, which is the property Phase 0 insisted on for `WORK_PRODUCT_DERIVATION` and which
 * a bare path cannot give. The `capture` is the runner's own `PURGEABLE_AT_EXPIRY` copy, carried because it is
 * the one a `Workspace.purge` can reach and because `R7` must stay true of it.
 *
 * ⛔ `ArtifactReferenceSchema` IS `z.record(z.string(), z.unknown())`, SO NOTHING VALIDATES THIS SHAPE. The only
 * check it faces is `evidenceAdmissibility`'s CONTENT_AVAILABLE, which asks whether the record has ANY key. So
 * this type is a statement of intent for readers, not a constraint the engine enforces — said plainly, because
 * a shape that looks contracted and is not is worse than one that admits it.
 */
export interface ProcessEvidenceContentReference {
	readonly mint: {
		readonly storageProvider: string;
		readonly storageKey: string;
		readonly contentHash: string;
		readonly byteSize: number;
		/** ⭐ READ BACK FROM THE STORE (`stat`), never restated from the `put`. See the call site. */
		readonly purgeability: string;
		/** Whether the bytes are still there. `purge` keeps the ENTRY, so a purged reference stays explicable. */
		readonly purged: boolean;
	};
	readonly capture:
		| {
				readonly retained: true;
				readonly workspaceOwnerId: string;
				readonly purgeability: string;
				readonly stdoutPath: string;
				readonly stderrPath: string;
				readonly omissionsPath: string;
		  }
		| { readonly retained: false; readonly notRetainedBecause: string };
	readonly command: readonly string[];
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	readonly durationMs: number;
}

/**
 * Turn every observed run into governed evidence, floor and all.
 *
 * ⚠ `dispatch` IS THE CALLER'S, NOT AN ENGINE HANDLE, because the route drives commands through `runSteps` so a
 * refusal rolls the whole action back atomically (`SPEC-001-INV-14`). A module that reached for the engine
 * directly would commit an evidence object the caller's own failure path could not undo.
 */
export async function joinProcessEvidence(
	input: EvidenceJoinInput,
	engine: AuthedEngineHandle,
	opts: {
		readonly artifacts: ArtifactStore;
		readonly now: () => string;
		readonly newId: (prefix: string) => string;
		readonly criteria: readonly AssessmentCriterion[];
		readonly print?: (prompt: string) => Promise<string>;
		/** Dispatches one command through the caller's own atomic batch. Returns an error string, or null. */
		readonly propose: (evidenceId: string, payload: Record<string, unknown>) => string | null;
		/** Reads an object back after `propose` committed it — the floor needs its stored semantic version. */
		readonly getObject: (id: string) => Record<string, unknown> | undefined;
	}
): Promise<{ joined: JoinedProcessEvidence[]; refusedBecause?: string }> {
	const joined: JoinedProcessEvidence[] = [];
	for (const run of input.runs) {
		// 1. THE PARTICIPATING MINT. ⛔ NOT a re-label of the runner's capture: the runner's own header forbids
		// it — *"a later phase that PERSISTS the outcome must persist the REFERENCE and not the bytes, or it
		// mints a second retention surface under no declared class"* — and re-labelling would retroactively
		// falsify `R7` for every prior run. ⭑ The store makes the distinction STRUCTURAL rather than
		// disciplinary: purgeability is part of the storage key, so the two copies cannot collide.
		const bytes = renderProcessResult(run);
		const ref = await opts.artifacts.put({
			tenantPrefix: input.tenantPrefix,
			bytes,
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		// ⭐⭐ THE CLASS IS READ BACK FROM THE STORE, NOT RESTATED FROM THE CALL — and a mutant is what taught me
		// the difference. The first version wrote the literal `'RETAINED_BY_PARTICIPATION'` into the reference
		// beside the `put` that requested it, so the two could DISAGREE and the reference would still read as
		// authoritative: change the `put` and the record goes on declaring participation while the bytes sit in
		// the purgeable half of the key space. ⛔ A field that reports the CALLER'S INTENT while looking like a
		// measurement is this repository's most-recorded defect, and `filesystem-workspace.ts` states the repair
		// in capitals one directory over — *"IT ASKS THE FILESYSTEM, NOT THE STRING."*
		//
		// ⚠ AND `stat` ANSWERS A SECOND QUESTION WORTH RECORDING: whether the bytes are still there. An evidence
		// reference whose content was later purged stays EXPLICABLE — which is exactly why `purge` keeps the
		// entry rather than deleting it.
		const meta = await opts.artifacts.stat(ref.storageKey);
		if (meta === undefined)
			return {
				joined,
				// ⛔ NOT A WARNING. The store accepted the bytes one line ago and cannot describe them, so nothing
				// here can say what was retained or under what class — and an evidence object whose own content
				// reference is a guess is worse than no evidence object.
				refusedBecause:
					`the content plane accepted the result of \`${run.argv.join(' ')}\` at ${ref.storageKey} and ` +
					'then could not describe it, so its retention class cannot be stated. No evidence was recorded ' +
					'for that command rather than one whose content reference is a guess.'
			};
		const contentReference: ProcessEvidenceContentReference = {
			mint: {
				storageProvider: ref.storageProvider,
				storageKey: ref.storageKey,
				contentHash: ref.contentHash,
				byteSize: ref.byteSize,
				purgeability: meta.purgeability,
				purged: meta.purged
			},
			capture: run.retention.retained
				? {
						retained: true,
						workspaceOwnerId: run.retention.workspaceOwnerId,
						purgeability: run.retention.purgeability,
						stdoutPath: run.retention.stdoutPath,
						stderrPath: run.retention.stderrPath,
						omissionsPath: run.retention.omissionsPath
					}
				: { retained: false, notRetainedBecause: run.retention.notRetainedBecause },
			command: run.argv,
			exitCode: run.exitCode,
			timedOut: run.timedOut,
			durationMs: run.durationMs
		};

		// 2. THE GOVERNED OBJECT.
		const evidenceId = opts.newId('evd');
		const refused = opts.propose(evidenceId, {
			evidenceId,
			// ⭐ `R18` — WHAT THIS HOST CAN HONESTLY SAY IT SAW. Not `TEST_RESULT`: that is a claim about what the
			// command WAS, and the only party who knows is the untrusted one.
			evidenceType: 'OBSERVATION',
			contentReference,
			// ⛔ THE MODEL, NOT THE OPERATOR AND NOT THE WORK UNIT. `REG-F-352` records that naming the operator
			// would be a fiction; the model chose this command and the host ran it on its behalf.
			producedBy: {
				actorId: `model:${input.producerModelId}`,
				actorType: 'AGENT',
				displayName: 'Execution model'
			},
			// ⚠ EMPTY, AND DELIBERATELY. `RPH-EVD-004` — *"passing tests support only claims within their
			// scope"* — is `UNENFORCED_DISCLOSED` in this repository's own register precisely because nothing
			// compares an evidence scope to a claim's breadth. Asserting a claim link here would be this host
			// making that unchecked connection on the model's behalf, at volume.
			supportsClaimIds: [],
			contradictsClaimIds: [],
			scope: input.scope,
			// ⭐ `R17`'s LIMITATION half, on the object a reader of the evidence will actually open.
			limitations: processResultLimitations(run),
			capturedAt: opts.now()
		});
		if (refused !== null) return { joined, refusedBecause: refused };

		// 3. ITS OWN FLOOR. ⛔ Not optional: an id named in `proposedEvidenceIds` with no floor makes the whole
		// completion REJECT, with all three policies MISSING.
		const evidence = opts.getObject(evidenceId) ?? {};
		const floor = await runProcessResultFloor(
			{
				evidenceId,
				evidence,
				exchange: input.exchange,
				run,
				producingPrompt: input.producingPrompt,
				producerModelId: input.producerModelId,
				producerProviderId: input.producerProviderId,
				...(input.observedToolCalls ? { observedToolCalls: input.observedToolCalls } : {}),
				...(input.rationale ? { rationale: input.rationale } : {})
			},
			engine,
			opts
		);
		joined.push({
			evidenceId,
			run,
			satisfied: floor.satisfied,
			observations: floor.observations,
			unsatisfiedPolicies: floor.dispositions.filter((d) => d.disposition !== 'SATISFIED'),
			remediationAction: floor.remediation.action
		});
	}
	return { joined };
}

/**
 * What a caller must say when a joined run's floor refused.
 *
 * ⭑ IT NAMES THE COMMAND AND THE EVIDENCE ID, because a step with an ARTIFACT subject and N EVIDENCE subjects
 * produces the SAME status and the SAME code from every one of them — an arrangement that trips several guards
 * proves none of them. The id is the only thing that says which subject refused.
 *
 * ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — AND BESIDE AN ESCALATED REVIEW'S OBSERVATIONS, WHAT THE ESCALATION ASKS: the execution
 * plane's fixed sentence (`escalatedReviewNote`), keyed on the result's own classifier action. Its caller, the model step's
 * refusal, carries this text whole on BOTH of its arms — beside a work product whose floor did not pass, and beside one
 * whose floor did (`routes/undertakings/[id]/+page.server.ts`). ⚠ That second arm printed none of it until the ER-1 app
 * verifier's MAJOR 1: a passed work product beside an escalated command result read only the engine's text.
 *
 * ⭐ AND A RESULT WHOSE FLOOR RECORDED NO OBSERVATION SAYS SO (`refusedBecause`, below; the ER-1 app re-verifier's finding
 * [6]): it printed `evd_… (npm test): ` and then nothing — `REG-F-415`'s symptom — so the engine's text after it on the
 * satisfied arm read as the result's own reason. ⭐ And one whose observations hold NO FINDING says that, and names what
 * refused it (`noFindingNote`, below; the second fix round's re-verifier's finding [0]) — save an ESCALATED one, which the
 * sentence above explains.
 */
export function describeRefusedEvidence(joined: readonly JoinedProcessEvidence[]): string {
	return joined
		.filter((j) => !j.satisfied)
		.map(
			(j) =>
				`${j.evidenceId} (${j.run.argv.join(' ')}): ${refusedBecause(j)}${escalatedReviewNote(j.remediationAction)}`
		)
		.join(' — ');
}

/**
 * WHY ONE REFUSED RESULT REFUSED: its recorded observations as `code: statement`, or — where its floor recorded none —
 * that none was recorded, and which policies it left unsatisfied, in the engine's own `policyId=disposition` form
 * (`floorGateBlock`'s refusal reads the same way). ⭑ That second form ends with its own full stop, as an observed result
 * ends with its statement's: on the model step's satisfied arm the engine's text follows it, with no period between.
 *
 * ⛔ THE EMPTY COLON IS `REG-F-415` (OPEN AS A SYMPTOM), AND THIS REPAIRS ITS TEXT, NOT ITS REGISTERED CAUSE: `RPH-ASR-005`'s
 * command-path limb — `completeAssuranceAssessment` reads no criterion result — stays UNENFORCED_DISCLOSED. So this says
 * only what the joined floor holds: that NO observation was recorded, and each unsatisfied policy's disposition. It never
 * says which criterion went unjudged. Since `JAN-CRITREAD` L3 each criterion result IS recorded (`RecordCriterionResult`),
 * but nothing here reads them back; a refusal naming the unjudged criterion would be that reader's, and is not built. The
 * gap stays named on this surface — in words now, where the empty colon named it by omission.
 *
 * ⭐ OBSERVATIONS THAT HOLD NO FINDING ARE FOLLOWED BY `noFindingNote` (below): printed alone, the reviewer's recommendation
 * was the whole reason given for a review it does not explain. An escalated review's are not: the sentence explains it.
 */
function refusedBecause(j: JoinedProcessEvidence): string {
	if (j.observations.length > 0)
		return (
			j.observations.map((o) => `${o.code}: ${o.statement}`).join(' | ') +
			noFindingNote(j.observations, j.unsatisfiedPolicies, j.remediationAction)
		);
	const unsatisfied = j.unsatisfiedPolicies.map((p) => `${p.policyId}=${p.disposition}`).join(', ');
	return unsatisfied ? `no observation recorded (${unsatisfied}).` : 'no observation recorded.';
}

/**
 * ⭐ `JAN-ESCREC` D3 (`REG-D-090`; the second fix round's re-verifier's finding [0], its drives E5, E7 and E8) — WHERE A
 * REFUSED REVIEW'S OBSERVATIONS HOLD NO FINDING, THE EXECUTION PLANE SAYS SO AND NAMES WHAT REFUSED IT: after the
 * observations, ` — no finding recorded (<policyId>=<disposition>, …).` — each policy the floor left unsatisfied, in the
 * engine's own form, as `refusedBecause` names them where nothing was observed at all. `''` for every other list, so a
 * caller appends it unconditionally: each refused command result (`refusedBecause`, above) and the model step's arm for a
 * work product whose floor did not pass (`routes/undertakings/[id]/+page.server.ts`).
 *
 * ⛔ WHAT WAS INCOMPLETE. D2 records the reviewer's ESCALATED recommendation on a VALID review whatever its outcome — on one
 * left INCONCLUSIVE by an unanswered criterion too — and that record forecloses no disposition, so it never explains a
 * refusal. Yet it was all either arm printed of such a review: *"evd_… (npm test): REVIEWER_RECOMMENDED_ESCALATION: …"*,
 * beside a re-run-or-reconfigure remedy, and on the arm for a work product whose floor did not pass INCONCLUSIVE was named
 * nowhere. The PWA panel answers that review with its incomplete-review sentence; this plane had no counterpart.
 *
 * ⛔ KEYED ON STRUCTURE — the observations' CODES, never their prose: a list with at least one observation, every one the
 * recommendation's code, IMPORTED (`verif/validator-failure-codes-imported.test.ts` holds the app to the import). ⛔ AND
 * NEVER AN ESCALATED REVIEW'S (the third fix round's re-verifier's finding [1], as the caller ruled): its list holds no
 * finding either, but the human sentence explains it (`escalatedReviewNote`, keyed on the same ACTION, which each caller
 * hands this too), so `''` where the classifier answered `ESCALATE_REVIEW`. An EMPTY list is not this note's:
 * `refusedBecause` says "no observation recorded" itself, and the work product's arm prints the engine's text, which names
 * the dispositions.
 */
export function noFindingNote(
	observations: readonly { readonly code: string }[],
	policies: readonly { readonly policyId: string; readonly disposition: string }[],
	action: FloorRemediationAction
): string {
	if (
		action === 'ESCALATE_REVIEW' ||
		observations.length === 0 ||
		observations.some((o) => o.code !== REVIEWER_RECOMMENDED_ESCALATION)
	)
		return '';
	const named = policies
		.filter((p) => p.disposition !== 'SATISFIED')
		.map((p) => `${p.policyId}=${p.disposition}`)
		.join(', ');
	return named ? ` — no finding recorded (${named}).` : ' — no finding recorded.';
}
