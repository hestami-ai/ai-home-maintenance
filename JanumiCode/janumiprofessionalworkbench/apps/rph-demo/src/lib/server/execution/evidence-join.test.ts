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
import type { ProcessOutputRetention } from '@janumipwb/rph-ports';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../identity.js';
import { reasoningReviewCriteria } from '../floor.js';
import {
	clearingReviewerFor,
	withLiveReviewerSeam
} from '../assurance/clearing-reviewer.testing.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import {
	describeRefusedEvidence,
	joinProcessEvidence,
	type ProcessEvidenceContentReference
} from './evidence-join.js';

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
async function join(runs: readonly ObservedProcessRun[], h = harness()) {
	return withLiveReviewerSeam(() => joinUnderSeam(runs, h));
}

async function joinUnderSeam(runs: readonly ObservedProcessRun[], h: ReturnType<typeof harness>) {
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
			print: clearingReviewerFor('The COMMAND RESULT to review', reasoningReviewCriteria(h.session))
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
		expect(back).toContain('npm test');
		expect(back).toContain('12 passed');

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
		const { joined, h } = await join([aRun(['npm', 'test'])]);
		const ref = (h.getObject(joined[0]!.evidenceId) ?? {})
			.contentReference as ProcessEvidenceContentReference;
		expect(ref.command).toEqual(['npm', 'test']);
		expect(ref.exitCode).toBe(0);
		expect(ref.timedOut).toBe(false);
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
		expect(described).toContain('node flaky.js');
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
