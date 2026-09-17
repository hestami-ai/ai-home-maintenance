// ⭐⭐ JAN-EXEC PHASE 5 — the floor over a COMMAND RESULT, driven against a real engine.
//
// ⛔ WHAT THIS FILE WOULD HAVE MEASURED BEFORE `R14`: nothing reachable. An `objectType: 'EVIDENCE'` subject took
// the reasoning reviewer's PWA-graph arm, a build log is not a graph export, and `unreadable()` returned
// INCONCLUSIVE — which BLOCKS. So the SATISFIED case below is the phase's central red: it could not have gone
// green under the selector this phase replaced, whatever the facts said.
//
// ⚠ AND IT IS AN IN-PROCESS TEST RATHER THAN AN E2E, DELIBERATELY AND WITH A MEASURED REASON. Three instruments
// cannot see this phase: `guards:export` walks `packages/` ONLY, `apps/rph-demo` has ZERO entries in the
// per-file coverage-floor baseline, and the gate's own `execution-model-invocation.e2e.ts` floor assertion is
// SUBJECT-SCOPED to the artifact, so a second floor run over an evidence subject cannot redden it. Every Phase 5
// proof must therefore be a REPORTED ROW from a named test — which is what these are.
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { createEngine, seedFloorPolicies } from '@janumipwb/rph-engine';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../identity.js';
import { reasoningReviewCriteria } from '../floor.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import {
	PROCESS_RESULT_VIOLATIONS,
	processResultFloorFacts,
	processResultLimitations,
	renderProcessResult,
	runProcessResultFloor,
	type ProcessResultSubject
} from './process-result-floor.js';

const TS = '2026-09-17T00:00:00Z';

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
	return {
		session,
		artifacts,
		newId: (p: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${String(++n).padStart(3, '0')}`
	};
}

/** A command the host watched run to a clean exit, with its output retained. */
function run(over: Partial<ObservedProcessRun> = {}): ObservedProcessRun {
	return {
		ordinal: 1,
		argv: ['node', '--test'],
		exitCode: 0,
		timedOut: false,
		durationMs: 89,
		outputComplete: true,
		omittedRegions: [],
		retention: {
			retained: true,
			workspaceOwnerId: 'und_1',
			purgeability: 'PURGEABLE_AT_EXPIRY',
			stdoutPath: 'captures/abc/stdout.txt',
			stderrPath: 'captures/abc/stderr.txt',
			omittedRegions: [],
			omissionsPath: 'captures/abc/omissions.json'
		},
		stdout: '12 passed, 0 failed\n',
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

async function subjectFor(
	artifacts: ReturnType<typeof createInMemoryArtifactStore>,
	over: Partial<ProcessResultSubject> = {}
): Promise<ProcessResultSubject> {
	const ref = await artifacts.put({
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
		contentDurability: artifacts.durability
	};
	return {
		evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5A01',
		// ⭑ `producedBy`, NOT `producingPwuId` — the artifact path's field does not exist on an Evidence object.
		evidence: { semanticVersion: 1, provenance: {}, producedBy: { actorId: 'model:test-model' } },
		exchange: {
			exchangeId: 'mex_1',
			materializedInputRef: stored,
			rawOutputBeforeCoercionRef: stored,
			answerSpanRef: stored,
			volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
		} as never,
		run: run(),
		producingPrompt: 'Build the CLI and run its tests.',
		producerModelId: 'test-model',
		producerProviderId: 'test-provider',
		observedToolCalls: OBSERVED,
		...over
	};
}

describe('⭐ JAN-EXEC Phase 5 — R17: what makes a command result unfit to be evidence AT ALL', () => {
	it('⭑ a retained run with an observed verdict is schema-valid, with NO violations', async () => {
		const { artifacts } = harness();
		const facts = await processResultFloorFacts(await subjectFor(artifacts), artifacts);
		expect(facts.schemaInvariant.schemaValid).toBe(true);
		expect(facts.schemaInvariant.invariantViolations).toEqual([]);
	});

	it('⛔ output nobody kept BLOCKS — the evidence would name bytes that are gone', async () => {
		// THE MUTANT: treat an unretained capture as merely a limitation. `EvidenceObject.contentReference` would
		// then name a location with nothing behind it, and `evidenceAdmissibility`'s CONTENT_AVAILABLE limb —
		// which checks only that the reference is a NON-EMPTY RECORD — would admit it.
		const { artifacts } = harness();
		const s = await subjectFor(artifacts, {
			run: run({ retention: { retained: false, notRetainedBecause: 'no workspace was supplied' } })
		});
		const facts = await processResultFloorFacts(s, artifacts);
		expect(facts.schemaInvariant.invariantViolations).toContain(
			PROCESS_RESULT_VIOLATIONS.NOT_RETAINED
		);
		expect(facts.schemaInvariant.schemaValid).toBe(false);
	});

	it('⛔ a signal-terminated run BLOCKS — `null` is not a verdict and is never folded into a number', async () => {
		// THE MUTANT: `exitCode ?? 1`. A process the OS killed would then evidence a FAILING test suite, and a
		// process killed by anything that exits 0 by convention would evidence a passing one. The port is
		// explicit: `null` "would assert a termination nobody observed".
		const { artifacts } = harness();
		const facts = await processResultFloorFacts(
			await subjectFor(artifacts, { run: run({ exitCode: null }) }),
			artifacts
		);
		expect(facts.schemaInvariant.invariantViolations).toContain(
			PROCESS_RESULT_VIOLATIONS.VERDICT_UNOBSERVED
		);
	});

	it('⛔ and a TIMED OUT run BLOCKS on the same code, because a deadline is not a test verdict', async () => {
		// ⚠ A SEPARATE LIMB OF ONE CODE, NOT A SEPARATE CODE. A timeout can carry a non-null exit status (the
		// kill's), so `exitCode !== null` alone would let a killed suite evidence whatever the kill returned.
		const { artifacts } = harness();
		const facts = await processResultFloorFacts(
			await subjectFor(artifacts, { run: run({ exitCode: 1, timedOut: true }) }),
			artifacts
		);
		expect(facts.schemaInvariant.invariantViolations).toContain(
			PROCESS_RESULT_VIOLATIONS.VERDICT_UNOBSERVED
		);
	});

	it('⭐ CONTROL — a DECLARED truncation does NOT block: it is a recorded LIMITATION', async () => {
		// ⛔ THE RULING THIS PINS WAS TAKEN ON MEASURED GROUNDS, AND THE STRICT READING WOULD HAVE BEEN FATAL:
		// capture is capped at 64 KiB per stream, so a real suite's output is routinely a declared prefix. Under
		// the strict reading NO REAL TEST SUITE COULD EVER PRODUCE ADMISSIBLE EVIDENCE. THE MUTANT: add
		// `omittedRegions.length > 0` to the violations list — every assertion above still passes.
		const { artifacts } = harness();
		const truncated = run({
			omittedRegions: [
				{ stream: 'stdout', byteOffset: 65536, byteSize: 4096, reason: 'capture bound' } as never
			],
			outputComplete: false
		});
		const facts = await processResultFloorFacts(
			await subjectFor(artifacts, { run: truncated }),
			artifacts
		);
		expect(facts.schemaInvariant.invariantViolations).toEqual([]);
		expect(facts.schemaInvariant.schemaValid).toBe(true);

		// ⭑ AND IT IS RECORDED SOMEWHERE A READER OF THE EVIDENCE WILL LOOK. "Not blocking" must not mean
		// "not said": the limitation goes on `EvidenceObject.limitations`, which `ProposeEvidence` requires and
		// `evidenceAdmissibility`'s LIMITATIONS_RECORDED limb reads.
		const limits = processResultLimitations(truncated);
		expect(limits.join(' ')).toMatch(/DECLARED PREFIX/);
		expect(limits.join(' ')).toMatch(/4096 UTF-8 bytes were removed from stdout at byte offset 65536/);
		expect(limits.join(' ')).toMatch(/descendant process still held the output streams/);
	});

	it('⚠ an untruncated run STILL records a limitation — an empty list would claim there are none', async () => {
		// `evidenceAdmissibility` accepts `[]` ("an empty array counts as recorded"), so this is not about
		// admissibility. It is about the sentence an empty list makes: that this evidence has no limitations,
		// which is never true of a bounded capture of someone else's process.
		const limits = processResultLimitations(run());
		expect(limits.length).toBeGreaterThan(0);
		expect(limits.join(' ')).toMatch(/does NOT establish that the command was the right one to run/);
	});

	it('⛔ the rendered result declares its cuts BEFORE the bytes, and never folds `null` into a number', async () => {
		const rendered = renderProcessResult(
			run({
				exitCode: null,
				omittedRegions: [
					{ stream: 'stdout', byteOffset: 10, byteSize: 20, reason: 'capture bound' } as never
				]
			})
		);
		expect(rendered).toMatch(/null \(terminated by a signal\)/);
		expect(rendered).not.toMatch(/exit 0/);
		expect(
			rendered.indexOf('TRUNCATED'),
			'⛔ a declaration below the content it qualifies is one the reader reaches only if the content did not already convince them'
		).toBeLessThan(rendered.indexOf('--- stdout ---'));
	});
});

describe('⭐⭐ JAN-EXEC Phase 5 — the floor RUNS over an EVIDENCE subject, which it could not before', () => {
	it('⛔ an evidence object whose PRODUCING MODEL is unknown does NOT have a producer', async () => {
		// ⭐ THIS TEST EXISTS BECAUSE ITS MUTANT SURVIVED. `hasProducer` is a CONJUNCTION — the evidence names an
		// actor AND the model that answered is known — and every assertion in this file passed with the second
		// limb deleted, because `producedBy` is populated on every path the fixtures build. A conjunct nothing
		// drives is a conjunct that can be dropped in review as a simplification.
		//
		// ⛔ WHY THE SECOND LIMB IS THE LOAD-BEARING ONE. `REG-F-352`: an output whose producer is only a work
		// unit does not say WHO made it. And `checkIndependence('DIFFERENT_MODEL')` needs BOTH sides DEFINED —
		// *"an absence cannot evidence independence"* — so a subject with no model id is BOUNDARY_REJECTED by the
		// reviewer rather than judged. This fact is the only place the floor notices BEFORE that happens.
		const { artifacts } = harness();
		const facts = await processResultFloorFacts(
			await subjectFor(artifacts, { producerModelId: '' }),
			artifacts
		);
		expect(facts.identityProvenance.hasProducer).toBe(false);

		// ⭑ AND THE OTHER LIMB, SEPARATELY, so this cannot be confused with "hasProducer stopped working".
		const noActor = await processResultFloorFacts(
			await subjectFor(artifacts, { evidence: { semanticVersion: 1, provenance: {} } }),
			artifacts
		);
		expect(noActor.identityProvenance.hasProducer).toBe(false);

		// ⭑ CONTROL — both present is TRUE, so the pair above is discrimination and not a blanket refusal.
		const both = await processResultFloorFacts(await subjectFor(artifacts), artifacts);
		expect(both.identityProvenance.hasProducer).toBe(true);
	});

	it('⭐ the REVIEWING call is filed with the subject\'s OWN object type — driven on the LIVE path', async () => {
		// ⭐ THIS TEST EXISTS BECAUSE ITS MUTANT SURVIVED, AND WHY IT SURVIVED IS THE FINDING. Under `testMode`
		// the MOCK reviewer captures nothing, so `exchanges.drain()` is empty and the exchange-recording arm —
		// the ONLY consumer of `objectType` now that `R14` stopped the reviewers reading it — never runs. So
		// `objectType: 'EVIDENCE'` could be changed to `'ARTIFACT'` and every other test in this file passed.
		//
		// ⛔ THE VALUE IS NOT INERT, IT IS ONLY UNOBSERVED IN THE DEFAULT LANE. It reaches
		// `RecordModelExchange.subjectObjectType`, which is the 31-member contract enum on a PERMANENT record —
		// and `'ARTIFACT'` is a legal member, so nothing refuses a record whose declared subject type its own
		// subject id contradicts. This is the same argument `createFloorRegistry`'s `print` seam was built on:
		// *"an end-to-end assertion here would observe zero exchange records and prove nothing."*
		const { session, artifacts, newId } = harness();
		process.env.JPWB_ASSURANCE_TOOL = 'agy';
		process.env.JPWB_JUDGE_MODEL = 'test-judge-model';
		try {
			const s = await subjectFor(artifacts);
			await runProcessResultFloor(s, session, {
				artifacts,
				now: () => TS,
				newId,
				criteria: reasoningReviewCriteria(session),
				print: async () =>
					JSON.stringify({ findings: [], recommendation: 'SATISFIED', residualUncertainty: [] })
			});
			const exchanges = session
				.readAllEvents()
				.filter((e) => e.eventType === 'ModelExchangeRecorded')
				.map((e) => e.payload as Record<string, unknown>);
			expect(exchanges.length, 'the reviewing call must leave a record — PER-9').toBeGreaterThan(0);
			for (const x of exchanges) {
				expect(x.subjectObjectType).toBe('EVIDENCE');
				expect(x.subjectObjectId).toBe(s.evidenceId);
			}
		} finally {
			// ⚠ IN A `finally`, AND NOTHING IN IT MAY THROW: these are PROCESS-WIDE and a leak would silently
			// switch every later test in this worker onto the live reviewer path.
			delete process.env.JPWB_ASSURANCE_TOOL;
			delete process.env.JPWB_JUDGE_MODEL;
		}
	});

	it('⭐ A COMMAND RESULT THE HOST WATCHED COMPLETE SATISFIES THE FLOOR — the phase turns on this', async () => {
		// ⛔ THE RED. Before `R14` this returned INCONCLUSIVE whatever the facts said: the subject's `objectType`
		// selected the reviewer's framing, `'EVIDENCE'` was not `'ARTIFACT'`, and the graph arm cannot read a
		// build log. INCONCLUSIVE BLOCKS, so the completion Phase 5 exists to permit was unreachable.
		const { session, artifacts, newId } = harness();
		const out = await runProcessResultFloor(await subjectFor(artifacts), session, {
			artifacts,
			now: () => TS,
			newId,
			criteria: reasoningReviewCriteria(session)
		});
		expect(out.satisfied, `not satisfied: ${JSON.stringify(out.observations)}`).toBe(true);
	});

	it('⛔ and the host observing NO calls does NOT satisfy it — the §22.1 join, driven', async () => {
		// ⭑ THE COUNTERPART, and it is what keeps "satisfied" meaningful. Without a driven refusal the passing
		// case cannot be told apart from a floor that satisfies anything — the rubber stamp this repository has
		// shipped before and records in `mock-reasoning-review-validator.ts`'s own header.
		const { session, artifacts, newId } = harness();
		const out = await runProcessResultFloor(
			await subjectFor(artifacts, { observedToolCalls: { observation: 'NONE_OBSERVED' } }),
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);
		expect(out.satisfied).toBe(false);
		// ⚠ THE CODE, NOT ONLY THE BOOLEAN. Three policies can refuse and an arrangement that trips two of them
		// proves neither — only the observation code says which question was answered against this subject.
		expect(out.observations.map((o) => o.code)).toContain('RR-07-no-contradiction');
	});

	it('⛔ an unretained capture does not satisfy it either, and says so with ITS OWN code', async () => {
		// ⭑ A DIFFERENT REFUSAL FROM THE ONE ABOVE, asserted by CODE so the two cannot be confused. Both produce
		// `satisfied === false`; only the code distinguishes "the join failed" from "the bytes are gone".
		const { session, artifacts, newId } = harness();
		const out = await runProcessResultFloor(
			await subjectFor(artifacts, {
				run: run({ retention: { retained: false, notRetainedBecause: 'no workspace was supplied' } })
			}),
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);
		expect(out.satisfied).toBe(false);
		expect(out.observations.map((o) => o.code)).toContain(PROCESS_RESULT_VIOLATIONS.NOT_RETAINED);
		expect(
			out.observations.map((o) => o.code),
			'⛔ the JOIN succeeded here — a refusal for the wrong reason is not the refusal this test names'
		).not.toContain('RR-07-no-contradiction');
	});

	it('⭐ the assessments are recorded against the EVIDENCE id, at its own semantic version', async () => {
		// ⭑ THIS IS WHAT `floorGateBlock` LOOKS FOR. `completeExecutionStep` unions `outputArtifactIds` with
		// `proposedEvidenceIds` and loops the gate over every member at its STORE-DERIVED version, so a floor
		// recorded against the wrong id or the wrong version leaves the step blocked with nothing to point at.
		// THE MUTANT: record against the producing PWU, or at a hardcoded version 1.
		const { session, artifacts, newId } = harness();
		const s = await subjectFor(artifacts, { evidence: { semanticVersion: 4, provenance: {}, producedBy: { actorId: 'model:test-model' } } });
		await runProcessResultFloor(s, session, {
			artifacts,
			now: () => TS,
			newId,
			criteria: reasoningReviewCriteria(session)
		});
		const assessments = session
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentRequested')
			.map((e) => e.payload as Record<string, unknown>);
		expect(assessments.length, 'three floor policies, three assessments').toBe(3);
		for (const a of assessments) {
			expect(a.subjectObjectIds).toEqual([s.evidenceId]);
			expect(a.subjectSemanticVersions).toEqual({ [s.evidenceId]: 4 });
		}
	});
});
