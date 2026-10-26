// ⭐⭐ JAN-EXEC PHASE 5 — the evidence join, driven against a real engine and a real content plane.
//
// ⛔ THE ONE LINE THIS FILE IS ABOUT: `proposedEvidenceIds: []`, which was the literal on EVERY path in the demo
// until this phase. The kernel gate has ALWAYS looped over that list — `completeExecutionStep` unions it with
// `outputArtifactIds` and runs `floorGateBlock` over every member at its own store-derived version. What was
// missing was never the gate; it was a PRODUCER, and that is what is measured here.
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { createEngine, seedFloorPolicies } from '@janumipwb/rph-engine';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import type { ArtifactStore, ProcessOutputRetention } from '@janumipwb/rph-ports';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../identity.js';
import { reasoningReviewCriteria, type FloorRemediationAction } from '../floor.js';
import {
	clearingReviewerFor,
	withLiveReviewerSeam
} from '../assurance/clearing-reviewer.testing.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { renderProcessResultEvidence } from '../assurance/process-result-render.js';
import { processResultLimitations } from './process-result-floor.js';
import {
	describeRefusedEvidence,
	joinProcessEvidence,
	type ProcessEvidenceContentReference
} from './evidence-join.js';
import { escalatedReviewNote } from './floor-over-subject.js';

const TS = '2026-09-17T00:00:00Z';

const RETAINED: ProcessOutputRetention = {
	retained: true,
	workspaceOwnerId: 'und_1',
	purgeability: 'PURGEABLE_AT_EXPIRY',
	stdoutPath: 'captures/abc/stdout.txt',
	stderrPath: 'captures/abc/stderr.txt',
	omittedRegions: [],
	omissionsPath: 'captures/abc/omissions.json'
};

function aRun(argv: string[], over: Partial<ObservedProcessRun> = {}): ObservedProcessRun {
	return {
		ordinal: 1,
		argv,
		exitCode: 0,
		timedOut: false,
		durationMs: 12,
		outputComplete: true,
		omittedRegions: [],
		retention: RETAINED,
		stdout: '12 passed\n',
		stderr: '',
		...over
	};
}

const OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [
		{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }
	],
	observedCount: 1,
	recordedLimit: 32
};

function harness() {
	let n = 0;
	const store = new SqliteStorageAdapter({ now: () => TS });
	const host = createEngine({
		authenticate: standaloneAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++n}`,
		ontology
	});
	const session = host.as(SESSION_CREDENTIAL);
	seedFloorPolicies(session);
	const artifacts = createInMemoryArtifactStore();
	const newId = (p: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${String(++n).padStart(3, '0')}`;
	/** The real `ProposeEvidence` command, so admissibility and the object schema are genuinely exercised. */
	const propose = (evidenceId: string, payload: Record<string, unknown>): string | null => {
		const r = session.dispatch({
			commandId: newId('cmd'),
			commandType: 'ProposeEvidence',
			commandSchemaVersion: 1,
			targetAggregateType: 'EVIDENCE',
			targetAggregateId: evidenceId,
			issuedAt: TS,
			correlationId: `evidence-join:${evidenceId}`,
			idempotencyKey: `evd:${evidenceId}`,
			payload
		});
		return r.status === 'ACCEPTED' ? null : JSON.stringify(r.error);
	};
	const getObject = (id: string) =>
		session.readAllEvents().length >= 0
			? (store.loadObject(id)?.state as Record<string, unknown> | undefined)
			: undefined;
	return { session, artifacts, newId, propose, getObject };
}

// ⭑ THE WHOLE HELPER RUNS UNDER THE LIVE REVIEWER SEAM, once, rather than each test arranging it. The env
// keys are PROCESS-WIDE and a leak silently switches every later test in this worker onto the live path.
// ⭐ `JAN-ESCREC` D3: a case may name the reviewer's reply (`review`); every other case keeps the clearing reviewer.
async function join(
	runs: readonly ObservedProcessRun[],
	h = harness(),
	review?: (prompt: string) => Promise<string>
) {
	return withLiveReviewerSeam(() => joinUnderSeam(runs, h, review));
}

async function joinUnderSeam(
	runs: readonly ObservedProcessRun[],
	h: ReturnType<typeof harness>,
	review?: (prompt: string) => Promise<string>
) {
	const ref = await h.artifacts.put({
		tenantPrefix: 'tnt-t',
		bytes: 'the producing turn',
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const stored = {
		status: 'STORED' as const,
		storageKey: ref.storageKey,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		purgeability: 'RETAINED_BY_PARTICIPATION' as const,
		contentDurability: h.artifacts.durability
	};
	const out = await joinProcessEvidence(
		{
			runs,
			exchange: {
				exchangeId: 'mex_1',
				materializedInputRef: stored,
				rawOutputBeforeCoercionRef: stored,
				answerSpanRef: stored,
				volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
			} as never,
			producingPrompt: 'Build the CLI and run its tests.',
			producerModelId: 'test-model',
			producerProviderId: 'test-provider',
			observedToolCalls: OBSERVED,
			scope: 'commands run by the executing model for work unit pwu_1',
			tenantPrefix: 'tnt-t'
		},
		h.session,
		{
			artifacts: h.artifacts,
			now: () => TS,
			newId: h.newId,
			criteria: reasoningReviewCriteria(h.session),
			propose: h.propose,
			getObject: h.getObject,
			// ⭐⭐ `JAN-ORPHANED` `OR-02` — A CLEARING REVIEWER, FRAMED FOR A COMMAND RESULT.
			//
			// ⛔ THIS FILE'S SUBJECT IS THE JOIN, NOT THE REVIEW. Its four documented mutants are all producer-
			// or content-plane facts, and `PROCESS_VERDICT_UNOBSERVED` originates in `processResultFloorFacts`
			// (`schemaValid: retained && verdict`), entirely independent of what a reviewer says. Nothing here
			// mentions a reviewer — it reached the deterministic structural checker AMBIENTLY, through test mode.
			//
			// ⭑ AND LEAVING IT ON THAT CHECKER MADE ONE ASSERTION UNKILLABLE BY CONSTRUCTION. The refusal test
			// below asserts *“the run that PASSED must not appear in a refusal”* — which can only be killed when
			// ONE run is satisfied and one is not. With every subject refusing for want of criterion coverage,
			// neither is, and the discrimination it exists to prove cannot fail. Leaving it red preserved a
			// BROKEN discriminator, not a true statement.
			print:
				review ??
				clearingReviewerFor('The COMMAND RESULT to review', reasoningReviewCriteria(h.session))
		}
	);
	return { ...out, h };
}

describe('⭐⭐ JAN-EXEC Phase 5 — R18: every completed run becomes one governed OBSERVATION', () => {
	it('⭐ three commands become THREE evidence objects, each with its own SATISFIED floor', async () => {
		// ⛔ THE RED. `proposedEvidenceIds` was `[]` on every path, so this list was empty by construction and
		// nothing downstream could name a command the model had run.
		const { joined, refusedBecause, h } = await join([
			aRun(['npm', 'ci']),
			aRun(['npm', 'test']),
			aRun(['ls'])
		]);
		expect(refusedBecause).toBeUndefined();
		expect(joined).toHaveLength(3);
		expect(joined.map((j) => j.run.argv[0])).toEqual(['npm', 'npm', 'ls']);
		for (const j of joined)
			expect(j.satisfied, `${j.evidenceId}: ${JSON.stringify(j.observations)}`).toBe(true);

		// ⭑ AND THE FLOOR IS RECORDED AGAINST EACH ONE SEPARATELY — three policies apiece. `floorGateBlock`
		// loops per subject, so a floor recorded against one evidence does not authorise another.
		const requested = h.session
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentRequested')
			.map((e) => (e.payload as { subjectObjectIds: string[] }).subjectObjectIds[0]);
		for (const j of joined)
			expect(requested.filter((id) => id === j.evidenceId), j.evidenceId).toHaveLength(3);
	});

	it('⭐ the type is OBSERVATION, not TEST_RESULT — `ls` is not a test and this host cannot tell', async () => {
		// ⛔ THE MUTANT: type them `TEST_RESULT` because that is the phase's brief. `evidenceType` is a label no
		// production code branches on, so nothing would break — the record would simply say `ls` was a test
		// result. `R18`: the host records what it CAN say, and what it saw is a command running.
		const { joined, h } = await join([aRun(['ls'])]);
		const evidence = h.getObject(joined[0]!.evidenceId) ?? {};
		expect(evidence.evidenceType).toBe('OBSERVATION');
		expect(evidence.status).toBe('PROPOSED');

		// ⭐ AND `R17`'s LIMITATION HALF REACHES THE OBJECT, which is the only place a reader of the evidence
		// will look. THIS ASSERTION EXISTS BECAUSE ITS MUTANT SURVIVED: `limitations: []` passed every other
		// test in this file, stays ADMISSIBLE (the limb reads `=== undefined`, and *an empty array counts as
		// recorded*), and says — falsely — that this evidence has no limitations at all.
		const limits = evidence.limitations as string[];
		expect(limits.length).toBeGreaterThan(0);
		expect(limits.join(' ')).toMatch(/does NOT establish that the command was the right one to run/);
	});

	it('⭐⛔ RED-5 — the bytes are a NEWLY MINTED participating object, never the capture re-labelled', async () => {
		// ⛔ THIS IS A RATIFIED-DISPOSITION CONSTRAINT, NOT A PREFERENCE. `REG-Q-066` was closed BY the
		// disposition that the runner's capture is `PURGEABLE_AT_EXPIRY`; a Phase 5 that re-labelled it would
		// retroactively falsify `R7` for every prior run. The runner's own header names this phase and forbids
		// it: *"a later phase that PERSISTS the outcome must persist the REFERENCE and not the bytes."*
		const { joined, h } = await join([aRun(['npm', 'test'])]);
		const evidence = h.getObject(joined[0]!.evidenceId) ?? {};
		const ref = evidence.contentReference as ProcessEvidenceContentReference;

		// ⭐⭐ THE CLASS IS ASSERTED AS THE STORE REPORTS IT, AND THIS ASSERTION EXISTS BECAUSE ITS MUTANT
		// SURVIVED. The first version read a literal the join had written beside the `put` that requested it —
		// so changing the `put` to `PURGEABLE_AT_EXPIRY` left the reference still declaring participation, and
		// every test passed while the bytes sat in the purgeable half of the key space. The join now reads the
		// class back from `stat`; this reads it from the reference AND from the store, so the two cannot
		// diverge without something here going red.
		expect(ref.mint.purgeability).toBe('RETAINED_BY_PARTICIPATION');
		expect(ref.mint.purged, 'freshly minted bytes are not purged').toBe(false);
		const declared = await h.artifacts.stat(ref.mint.storageKey);
		expect(declared?.purgeability, 'the reference must agree with the store').toBe(
			ref.mint.purgeability
		);
		// ⭑ AND THE KEY ITSELF CARRIES THE CLASS — the store's own design, and the reason the two copies of one
		// command's output cannot collide. Asserting it is a third, independent reading of the same fact.
		expect(ref.mint.storageKey).toContain('RETAINED_BY_PARTICIPATION');
		// ⛔ NOT ONE OF THE CAPTURE'S PATHS. The mint is content-addressed in the ArtifactStore; the capture is
		// two workspace-relative files. Confusing them is exactly the re-label this forbids.
		expect(ref.mint.storageKey).not.toBe(RETAINED.stdoutPath);
		expect(ref.mint.storageKey).not.toBe(RETAINED.stderrPath);
		// ⭑ AND IT IS HASHED, which a workspace path is not. `ProcessOutputRetention` carries NO hash, so an
		// evidence record naming only the capture could only be BELIEVED — the property Phase 0 insisted on for
		// `WORK_PRODUCT_DERIVATION` and the reason the mint exists at all.
		expect(ref.mint.contentHash).toMatch(/^sha256:/);
		expect(ref.mint.byteSize).toBeGreaterThan(0);
		// ⭑ THE BYTES REALLY ARE THERE — re-read them, so this is a measurement and not a claim about a key.
		const back = await h.artifacts.get(ref.mint.storageKey);
		// ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-482`) — THE COMMAND IS `argv` AS A JSON ARRAY. This read `toContain('npm test')`, the
		// space-joined form, and was the predicted red of the change (driven: *"expected 'command: ["npm","test"]\nexit 0
		// in 12…' to contain 'npm test'"*).
		expect(back).toContain('command: ["npm","test"]');
		expect(back).toContain('12 passed');
		// ⭐ AND THE MINT IS THE EVIDENCE VIEW, WHOLE — today's bytes save `argv`, never the reviewer's fenced, budgeted
		// REVIEW view (design D1). Written out, so a mint of the other view, or of a changed one, reddens here.
		expect(back, 'the mint is not the EVIDENCE view of the run').toBe(
			'command: ["npm","test"]\nexit 0 in 12ms\n--- stdout ---\n12 passed\n\n--- stderr ---\n'
		);

		// ⭐ AND BOTH COPIES ARE NAMED, which is what keeps `R7` true AND makes the evidence verifiable.
		expect(ref.capture).toMatchObject({
			retained: true,
			purgeability: 'PURGEABLE_AT_EXPIRY',
			stdoutPath: RETAINED.stdoutPath,
			stderrPath: RETAINED.stderrPath
		});
	});

	it('⚠ the command, the exit code and the timeout ride on the reference, where a reader can see them', async () => {
		// ⛔ NOT ON THE RECORD PLANE. `ObservedToolCall` has no field that could hold an argv or an exit code, by
		// construction (`R11`), and widening it would undo that guarantee. The content plane is where this
		// belongs, and it is where `PER-9`'s removal path exists.
		// ⭐ Package L — D8 (`REG-D-135`; design D8): ~~one run~~ two, the second the step's third host act (a write between
		// them took the second number), so the ordinal on its reference is the HOST's sequence number, never its index here.
		const { joined, h } = await join([aRun(['npm', 'test']), aRun(['npm', 'run', 'lint'], { ordinal: 3 })]);
		const ref = (h.getObject(joined[0]!.evidenceId) ?? {})
			.contentReference as ProcessEvidenceContentReference;
		expect(ref.command).toEqual(['npm', 'test']);
		expect(ref.exitCode).toBe(0);
		expect(ref.timedOut).toBe(false);
		// ⭐ D8 — and the run's place in the step's host sequence, beside the command facts (⛔ AT HEAD: absent).
		expect(ref.ordinal, 'the run’s host ordinal').toBe(1);
		const third = (h.getObject(joined[1]!.evidenceId) ?? {}).contentReference as ProcessEvidenceContentReference;
		expect(third.ordinal, 'the host’s number, never the run’s index in the join').toBe(3);
	});

	it('⛔ a run with NO VERDICT is STILL minted, and then REFUSES its own floor', async () => {
		// ⭐ THE FAIL-CLOSED POSTURE, AND IT IS THE HALF THAT IS EASY TO GET WRONG. Minting only the runs that
		// would PASS would let a step complete as though the killed command never happened — which is precisely
		// what `unassessableAiContentBlock` forbids one plane over: AI-produced content may not enter the
		// governed stream with nothing to assess. THE MUTANT: filter the run list by `processVerdictObserved`.
		const { joined } = await join([aRun(['npm', 'test'], { exitCode: null })]);
		expect(joined, 'the run must be RECORDED, not skipped').toHaveLength(1);
		expect(joined[0]!.satisfied).toBe(false);
		expect(joined[0]!.observations.map((o) => o.code)).toContain('PROCESS_VERDICT_UNOBSERVED');
	});

	it('⭑ and the refusal NAMES the evidence id and the command it ran', async () => {
		// ⛔ WITH AN ARTIFACT SUBJECT AND N EVIDENCE SUBJECTS, EVERY REFUSAL PRODUCES THE SAME STATUS AND THE
		// SAME CODE. An arrangement that trips several guards proves none of them — only the id says which
		// subject refused, and only the argv tells an operator which command to look at.
		const { joined } = await join([
			aRun(['npm', 'test']),
			aRun(['node', 'flaky.js'], { exitCode: null })
		]);
		const described = describeRefusedEvidence(joined);
		// ⭐ `PQ-1` (`REG-F-482`): the command as the evidence spells it, a JSON array (this read `'node flaky.js'`).
		expect(described).toContain('(["node","flaky.js"])');
		expect(described).toContain(joined[1]!.evidenceId);
		expect(described, 'the run that PASSED must not appear in a refusal').not.toContain(
			joined[0]!.evidenceId
		);
	});

	it('⭑ no runs means no evidence — and that is an empty list, not a fabricated one', async () => {
		// A step whose model ran nothing names no evidence. ⚠ The DISTINCTION from "nothing could look" lives on
		// `ProducerSession.processRuns`, which returns a measurement because a process run goes through this
		// host's own port; there is no blind case to confuse this with.
		const { joined, refusedBecause } = await join([]);
		expect(joined).toEqual([]);
		expect(refusedBecause).toBeUndefined();
	});

	it('⭐ the evidence is ADMISSIBLE — the limbs `ProposeEvidence` cannot check are satisfied in fact', async () => {
		// ⭑ `evidenceAdmissibility` runs at exactly ONE production site (`admitEvidence`'s guard) and NOT at
		// completion, so nothing would have refused evidence that failed it. Driving it here is what makes the
		// six decidable limbs a measurement rather than an assumption — in particular SCOPE_STATED,
		// PROVENANCE_PRESENT (which reads `producedBy`, not the envelope's defaulted provenance) and
		// LIMITATIONS_RECORDED, all three of which this join is the first thing in the repository to populate
		// programmatically.
		const { joined, h } = await join([aRun(['npm', 'test'])]);
		const r = h.session.dispatch({
			commandId: 'cmd_admit',
			commandType: 'AdmitEvidence',
			commandSchemaVersion: 1,
			targetAggregateType: 'EVIDENCE',
			targetAggregateId: joined[0]!.evidenceId,
			issuedAt: TS,
			correlationId: 'admit',
			idempotencyKey: 'admit:1',
			payload: { admissibilityAssessmentId: 'a', admittedScope: 'unit', admittedClaimIds: [] }
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});
});

// ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-482`; design D2) — TWO COMMANDS ARE TWO COMMANDS, IN THE EVIDENCE AND IN WHAT IS SAID OF IT.
//
// ⛔ DRIVEN RED AT THE ROUND START: `["node","a b"]` and `["node","a","b"]` rendered the same `command: node a b` in the
// minted evidence, the same limitations line and the same refusal — a reader of the record could not tell which command
// ran. Joined by spaces, an argument holding a space is two arguments to every reader; as JSON it is one quoted string.
describe('⭐ JAN-PRQUAL PQ-1 — argv is a JSON array in the evidence, its limitations line and its refusal', () => {
	const ONE_ARGUMENT = aRun(['node', 'a b'], { exitCode: null });
	const TWO_ARGUMENTS = aRun(['node', 'a', 'b'], { exitCode: null });

	it('⛔ the minted EVIDENCE bytes differ, and spell each argument as a JSON string', async () => {
		const { joined, h } = await join([ONE_ARGUMENT, TWO_ARGUMENTS]);
		const bytes = await Promise.all(
			joined.map(async (j) => {
				const ref = (h.getObject(j.evidenceId) ?? {}).contentReference as ProcessEvidenceContentReference;
				return h.artifacts.get(ref.mint.storageKey);
			})
		);
		expect(bytes[0]).not.toBe(bytes[1]);
		expect(bytes[0]).toContain('command: ["node","a b"]\n');
		expect(bytes[1]).toContain('command: ["node","a","b"]\n');
		// ⭑ The mint is the renderer's EVIDENCE view of each run, not a re-spelling of it here.
		expect(bytes).toEqual([renderProcessResultEvidence(ONE_ARGUMENT), renderProcessResultEvidence(TWO_ARGUMENTS)]);
	});

	it('⛔ the limitations line differs, and names the command as a JSON array', () => {
		const [one] = processResultLimitations(ONE_ARGUMENT);
		const [two] = processResultLimitations(TWO_ARGUMENTS);
		expect(one).not.toBe(two);
		expect(one).toContain('one command (["node","a b"]) run in');
		expect(two).toContain('one command (["node","a","b"]) run in');
	});

	it('⭑ and the refusal an operator reads names the command as the evidence does', async () => {
		const { joined } = await join([ONE_ARGUMENT, TWO_ARGUMENTS]);
		const described = describeRefusedEvidence(joined);
		expect(described).toContain(`${joined[0]!.evidenceId} (["node","a b"]): `);
		expect(described).toContain(`${joined[1]!.evidenceId} (["node","a","b"]): `);
	});

	it('⛔ and so does the refusal when the content plane accepts the result and then cannot describe it — whole', async () => {
		// ⭐ THE ONE REFUSAL NAMING A COMMAND THAT NO TEST REACHED: a store whose `stat` answers nothing for bytes it accepted.
		// Joined by spaces, `["node","a b"]` read here as the two-argument command it is not.
		const h = harness();
		const minted: string[] = [];
		const blind: ArtifactStore = {
			...h.artifacts,
			put: async (input) => {
				const ref = await h.artifacts.put(input);
				minted.push(ref.storageKey);
				return ref;
			},
			stat: async () => undefined
		};
		const { joined, refusedBecause } = await join([ONE_ARGUMENT], { ...h, artifacts: blind });
		expect(joined, 'no evidence is recorded for a result the store cannot describe').toEqual([]);
		expect(refusedBecause).toBe(
			`the content plane accepted the result of ["node","a b"] at ${minted.at(-1)} and then could not describe it, so its ` +
				'retention class cannot be stated. No evidence was recorded for that command rather than one whose content ' +
				'reference is a guess.'
		);
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — A COMMAND RESULT WHOSE REVIEW IS ESCALATED SAYS WHAT THE ESCALATION ASKS, IN ITS REFUSAL.
//
// ⛔ The process-result refusal printed observations only, so an escalated review read as a recommendation and nothing
// more. Each joined result now carries the classifier's ACTION, and `describeRefusedEvidence` prints the fixed sentence
// beside the observations of a result whose action is ESCALATE_REVIEW — keyed on that structure, never on prose, and
// never on the recommendation's code alone: a review the reviewer escalated is recorded with the recommendation whatever
// its outcome (`rph-assurance` D2), and only the clean one with nothing else blocking IS escalated (D1).
describe('⭐ JAN-ESCREC D3 — the process-result refusal says what an escalated review asks', () => {
	const HUMAN_SENTENCE =
		"The reviewer recommended escalation to a human reviewer; this workbench cannot record a human's review yet (REG-F-474).";
	const RECOMMENDATION_CODE = 'REVIEWER_RECOMMENDED_ESCALATION';
	const RECOMMENDATION_STATEMENT =
		"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";
	/** A reviewer that answers every criterion unfailed and recommends ESCALATED — the clean arm rule (a) escalates. */
	const escalating = (h: ReturnType<typeof harness>) => async () =>
		JSON.stringify({
			findings: reasoningReviewCriteria(h.session).map((c) => ({
				criterionId: c.id,
				failed: false,
				statement: 'evaluated; the failure class is absent'
			})),
			recommendation: 'ESCALATED',
			residualUncertainty: []
		});

	it('⛔ a command result whose review is escalated: it carries the action, and its refusal prints the sentence beside its observations', async () => {
		const h = harness();
		const { joined } = await join([aRun(['npm', 'test'])], h, escalating(h));
		expect(joined[0]!.satisfied, 'arrangement: the escalated review satisfied the floor').toBe(
			false
		);
		expect(
			joined[0]!.remediationAction,
			'the joined result does not say its review was escalated'
		).toBe('ESCALATE_REVIEW');
		expect(describeRefusedEvidence(joined)).toBe(
			`${joined[0]!.evidenceId} (["npm","test"]): ${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE}`
		);
	});

	it('⭑ CONTROL — the same reviewer beside a result with NO VERDICT escalates nothing: the recommendation is printed, the sentence is not', async () => {
		// The schema/invariant policy refuses the result first (`PROCESS_VERDICT_UNOBSERVED`), so rule (a) leaves the review
		// SATISFIED and the recommendation recorded beside it. A refusal keyed on the recommendation's CODE would print the
		// sentence here; one keyed on the classifier's action does not.
		const h = harness();
		const { joined } = await join(
			[aRun(['node', 'flaky.js'], { exitCode: null })],
			h,
			escalating(h)
		);
		expect(joined[0]!.satisfied, 'arrangement: a result with no verdict satisfied the floor').toBe(
			false
		);
		const codes = joined[0]!.observations.map((o) => o.code);
		expect(codes, 'arrangement: the run’s missing verdict was not refused').toContain(
			'PROCESS_VERDICT_UNOBSERVED'
		);
		expect(codes, 'arrangement: the recommendation was not recorded beside it').toContain(
			RECOMMENDATION_CODE
		);
		expect(joined[0]!.remediationAction).toBe('RESOLVE_OTHER_FLOOR_FINDINGS');
		expect(
			describeRefusedEvidence(joined),
			'a refusal that is not an escalation was told as one'
		).not.toContain(HUMAN_SENTENCE);
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — A REFUSED RESULT WITH NO OBSERVATION SAYS SO, AND NAMES WHAT REFUSED IT.
//
// ⛔ The ER-1 app re-verifier's finding [6] (its drive E4): a command result's reviewer skipped a criterion and recommended
// SATISFIED, so the review is INCONCLUSIVE and records NO observation — and the refusal printed the command, a colon, and
// nothing: *"evd_… (npm test): CompleteExecutionStep: …"*, as though the engine's text were the result's reason. The
// model step carries this text on both arms (`routes/undertakings/[id]/+page.server.ts`), so the operator read it twice
// over. ⭑ Each joined result now carries the policies its floor left unsatisfied, as the floor composed them, and the
// refusal names them where nothing was observed — in the engine's own `policyId=disposition` form — ending with its own
// full stop, as an observed result ends with its statement's.
// ⛔ THAT EMPTY COLON IS `REG-F-415`, OPEN AS A SYMPTOM, AND THIS DOES NOT CLOSE IT: its registered cause is `RPH-ASR-005`'s
// command-path limb, still UNENFORCED_DISCLOSED, and the refusal names a policy's disposition, never the criterion that
// went unjudged. It says the absence in words, where it was named only by omission.
describe('⭐ JAN-ESCREC D3 — a refused result whose floor recorded no observation says so, and names what refused it', () => {
	/** A reviewer that answers every criterion but the LAST, unfailed, recommending SATISFIED: an unanswered mandatory
	 *  criterion is invalid output (ASR-2), so the review is INCONCLUSIVE — and nothing failed, so nothing is observed. */
	const skipping = (h: ReturnType<typeof harness>) => async () =>
		JSON.stringify({
			findings: reasoningReviewCriteria(h.session)
				.slice(0, -1)
				.map((c) => ({
					criterionId: c.id,
					failed: false,
					statement: 'evaluated; the failure class is absent'
				})),
			recommendation: 'SATISFIED',
			residualUncertainty: []
		});

	it('⛔ an INCONCLUSIVE review with nothing observed: the refusal says no observation was recorded, and names the policy and its disposition', async () => {
		const h = harness();
		const { joined } = await join([aRun(['npm', 'test'])], h, skipping(h));
		expect(joined[0]!.satisfied, 'arrangement: an incomplete review satisfied the floor').toBe(
			false
		);
		expect(joined[0]!.observations, 'arrangement: the floor recorded an observation').toEqual([]);
		// ⭐ THE CLAIM, WHOLE.
		expect(
			describeRefusedEvidence(joined),
			'a refused result with nothing observed printed no reason at all'
		).toBe(
			`${joined[0]!.evidenceId} (["npm","test"]): no observation recorded (floor.reasoning-review=INCONCLUSIVE).`
		);
		// ⭑ CARRIED, NOT RE-DERIVED: the policies the result's own floor left unsatisfied, as it composed them.
		expect(joined[0]!.unsatisfiedPolicies).toEqual([
			{ policyId: 'floor.reasoning-review', disposition: 'INCONCLUSIVE' }
		]);
	});

	it('⭑ CONTROL — a refused result WITH an observation prints the observation, and no disposition list', async () => {
		const { joined } = await join([aRun(['npm', 'test'], { exitCode: null })]);
		const described = describeRefusedEvidence(joined);
		expect(described, 'arrangement: the run’s missing verdict was not refused').toContain(
			'PROCESS_VERDICT_UNOBSERVED: '
		);
		expect(described).not.toContain('no observation recorded');
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — A REFUSED RESULT WHOSE OBSERVATIONS HOLD NO FINDING SAYS SO, AND NAMES WHAT REFUSED IT.
//
// ⛔ The second fix round's re-verifier's finding [0] (its drives E5 and E8): a command result's reviewer skipped the last
// criterion AND recommended ESCALATED, so the review is INCONCLUSIVE and D2 records the recommendation on it — its one
// observation. Round two's "no observation recorded" keyed on an EMPTY list, so this list printed the recommendation and
// nothing else: *"evd_… (npm test): REVIEWER_RECOMMENDED_ESCALATION: …"*, beside a re-run-or-reconfigure remedy, and
// INCONCLUSIVE named only in the engine's text — on the arm for a work product whose floor did not pass, nowhere. The
// recommendation forecloses no disposition, so it never explains a refusal. ⭑ Now, after observations none of which is a
// finding — keyed on their CODES, the recommendation's imported — the refusal says so in round two's `policyId=disposition`
// form: ` — no finding recorded (floor.reasoning-review=INCONCLUSIVE).` A list carrying a FINDING is told as before.
describe('⭐ JAN-ESCREC D3 — a refused result whose observations hold no finding says so, and names what refused it', () => {
	const RECOMMENDATION_CODE = 'REVIEWER_RECOMMENDED_ESCALATION';
	const RECOMMENDATION_STATEMENT =
		"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";
	/** A reviewer that answers every criterion but the LAST, unfailed, recommending ESCALATED: incomplete, so INCONCLUSIVE
	 *  (ASR-2) — and D2 records the recommendation on it all the same, its ONLY observation. */
	const skippingAndEscalating = (h: ReturnType<typeof harness>) => async () =>
		JSON.stringify({
			findings: reasoningReviewCriteria(h.session)
				.slice(0, -1)
				.map((c) => ({
					criterionId: c.id,
					failed: false,
					statement: 'evaluated; the failure class is absent'
				})),
			recommendation: 'ESCALATED',
			residualUncertainty: []
		});

	it('⛔ an INCONCLUSIVE review whose only observation is the recommendation: the refusal names floor.reasoning-review=INCONCLUSIVE after it', async () => {
		const h = harness();
		const { joined } = await join([aRun(['npm', 'test'])], h, skippingAndEscalating(h));
		expect(joined[0]!.satisfied, 'arrangement: an incomplete review satisfied the floor').toBe(
			false
		);
		expect(
			joined[0]!.observations.map((o) => o.code),
			'arrangement: the recommendation is not the result’s only observation'
		).toEqual([RECOMMENDATION_CODE]);
		expect(
			joined[0]!.remediationAction,
			'arrangement: the incomplete review was answered as something else'
		).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		const described = describeRefusedEvidence(joined);
		// ⭐ THE CLAIM: the disposition that refused it is named — INCONCLUSIVE, which nothing else here says.
		expect(
			described,
			'a refusal whose observations hold no finding does not name what refused it'
		).toContain('floor.reasoning-review=INCONCLUSIVE');
		// ⭐ AND WHOLE: the recommendation as recorded, then the note, ending with its own full stop — no human sentence,
		// because this review is not escalated (`RETRY_OR_CONFIGURE_REVIEWER`).
		expect(described).toBe(
			`${joined[0]!.evidenceId} (["npm","test"]): ${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — no finding recorded (floor.reasoning-review=INCONCLUSIVE).`
		);
	});

	it('⭑ CONTROL — a REJECTED review carrying a finding AND the recommendation is told by its observations, with no note', async () => {
		// The first criterion failed, so a FINDING stands beside the recommendation: the observations explain the refusal,
		// and a note keyed on "the recommendation is present" rather than "nothing else is" would be said here too.
		const h = harness();
		const { joined } = await join([aRun(['npm', 'test'])], h, async () =>
			JSON.stringify({
				findings: reasoningReviewCriteria(h.session).map((c, i) => ({
					criterionId: c.id,
					failed: i === 0,
					statement:
						i === 0
							? 'The command result substitutes an easier problem.'
							: 'evaluated; the failure class is absent'
				})),
				recommendation: 'ESCALATED',
				residualUncertainty: []
			})
		);
		expect(
			joined[0]!.observations.map((o) => o.code),
			'arrangement: the finding and the recommendation were not both recorded'
		).toEqual([reasoningReviewCriteria(h.session)[0]!.id, RECOMMENDATION_CODE]);
		const described = describeRefusedEvidence(joined);
		expect(described, 'arrangement: the finding is not printed').toContain(
			'The command result substitutes an easier problem.'
		);
		expect(
			described,
			'a refusal whose observations hold a finding was told it holds none'
		).not.toContain('no finding recorded');
	});
});

// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — THE EXECUTION PLANE'S HUMAN SENTENCE, OVER EVERY ACTION THE CLASSIFIER CAN ANSWER.
//
// ⛔ The ER-1 app re-verifier's finding [5] (its mutant `ER1-V156`): RETRY and REQUALIFY were each pinned at their route
// (`begin-execute-try-count.test.ts`, `begin-execute-substituted-reviewer.test.ts`), and CHANGE_REVIEWER nowhere — so a
// note that told an independence refusal "the reviewer recommended escalation to a human reviewer" passed every test,
// where the remedy is to select another reviewer. ⭑ So `escalatedReviewNote` is held here for EVERY action, exhaustive by
// `satisfies` as `authoring-turn-resume-hint.test.ts` holds the banner: an action added to `FloorRemediationAction` must be
// decided here before this file compiles. Only ESCALATE_REVIEW is an escalation (D1); every other action answers the
// empty string, which both callers append unconditionally after the observations it would stand beside.
describe('⭐ JAN-ESCREC D3 — escalatedReviewNote: the human sentence for ESCALATE_REVIEW, and for no other action', () => {
	const HUMAN_SENTENCE =
		"The reviewer recommended escalation to a human reviewer; this workbench cannot record a human's review yet (REG-F-474).";
	/** ⛔ EVERY ACTION — exhaustive by construction: `satisfies` refuses a member of the union left out. */
	const NOTE_FOR = {
		NONE: '',
		REFINE_SUBJECT: '',
		RETRY_OR_CONFIGURE_REVIEWER: '',
		REQUALIFY_OR_RESELECT_REVIEWER: '',
		CHANGE_REVIEWER: '',
		ESCALATE_REVIEW: ` — ${HUMAN_SENTENCE}`,
		RESOLVE_OTHER_FLOOR_FINDINGS: ''
	} as const satisfies Record<FloorRemediationAction, string>;

	it.each(Object.entries(NOTE_FOR) as [FloorRemediationAction, string][])(
		'%s → %j',
		(action, note) => {
			expect(
				escalatedReviewNote(action),
				`${action} is told the wrong thing beside its observations`
			).toBe(note);
		}
	);
});
