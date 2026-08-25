import { describe, expect, it } from 'vitest';

import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import {
	HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
	runHarmonizationBenchmarkAccounting
} from './harmonization-benchmark-accounting.js';
import {
	HARMONIZATION_BENCHMARK_ROWS,
	HARMONIZATION_FIRST_INCREMENT_FINDING_IDS
} from './harmonization-benchmark-baseline.js';
import {
	HARMONIZATION_FIRST_INCREMENT_ANALYSIS_AUTHORITY,
	HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT,
	HARMONIZATION_FIRST_INCREMENT_GATE_EFFECT,
	HARMONIZATION_FIRST_INCREMENT_NONCLAIMS,
	HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
	HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES,
	HARMONIZATION_FIRST_INCREMENT_RULE_SET_WITNESS,
	createHarmonizationFirstIncrementBenchmarkAccountingRequest,
	createHarmonizationFirstIncrementFixtureRequest,
	evaluateHarmonizationFirstIncrementRule,
	runHarmonizationFirstIncrementFixtureSuite,
	type HarmonizationFirstIncrementEvaluationRequest
} from './harmonization-first-increment-rules.js';

type DeepMutable<T> = T extends readonly (infer Member)[]
	? DeepMutable<Member>[]
	: T extends object
		? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
		: T;

function mutableRequest(
	ruleId = 'JAN-CSAA-HARMONIZATION-001'
): DeepMutable<HarmonizationFirstIncrementEvaluationRequest> {
	return structuredClone(
		createHarmonizationFirstIncrementFixtureRequest(ruleId, 'POSITIVE')
	) as DeepMutable<HarmonizationFirstIncrementEvaluationRequest>;
}

describe('harmonization first-increment rule profiles', () => {
	it('binds the exact governed 23 IDs, classifications, capabilities, rule content, and rule-set identity', () => {
		expect(HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES).toHaveLength(23);
		expect(HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES.map((profile) => profile.findingId)).toEqual(
			HARMONIZATION_FIRST_INCREMENT_FINDING_IDS
		);
		for (const profile of HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES) {
			const baseline = HARMONIZATION_BENCHMARK_ROWS[profile.findingId - 1]!;
			expect(profile.classification).toBe(baseline.classification);
			expect(profile.requiredCapabilities).toEqual(baseline.minimumCapabilities);
			expect(profile.findingText).not.toHaveLength(0);
			expect(profile.protectedProperty).not.toHaveLength(0);
			expect(profile.rationale).not.toHaveLength(0);
			expect(profile.benchmarkSourceReference).toMatch(/^(apps|packages)\//);
			expect(profile.referenceCurrentness).toBe(
				'HISTORICAL_EXACT_BENCHMARK_ROW_NOT_RECHECKED_AS_CURRENT_SOURCE'
			);
			expect(profile.projectionContract).toBe('CALLER_SUPPLIED_STRUCTURAL_OBSERVATION');
			expect(profile.projectionRegistration).toBe('UNREGISTERED');
			const { ruleContentSha256, ...payload } = profile;
			expect(canonicalSemanticJsonWitness(payload).sha256).toBe(ruleContentSha256);
		}
		expect(HARMONIZATION_FIRST_INCREMENT_RULE_SET_WITNESS).toEqual({
			bytes: 58_420,
			sha256: '8ff5443790729b1ae50feea6ce8971bf472f75f4c4c3fef282b8659a65ff5d31'
		});
	});

	it('discriminates a nonempty positive, nearby negative, protected-property mutation, and equivalent reordering for every rule', () => {
		const suite = runHarmonizationFirstIncrementFixtureSuite();
		expect(suite).toHaveLength(23);
		for (const discrimination of suite) {
			expect(discrimination.satisfied).toBe(true);
			expect(discrimination.positive.population.count).toBeGreaterThan(0);
			expect(discrimination.positive.population.closure).toBe('CLOSED');
			expect(discrimination.positive.evaluatorExecuted).toBe(true);
			expect(discrimination.positive.status).toBe('DETECTED');
			expect(discrimination.positive.finding?.findingId).toBe(discrimination.findingId);
			expect(
				discrimination.positive.evidence.conditionTrace.every((trace) => trace.satisfied)
			).toBe(true);
			expect(discrimination.nearbyNegative.status).toBe('NOT_DETECTED');
			expect(discrimination.nearbyNegative.evaluatorExecuted).toBe(true);
			expect(discrimination.nearbyNegative.finding).toBeNull();
			expect(discrimination.mutation.status).toBe('NOT_DETECTED');
			expect(discrimination.mutation.evidence.observationSha256).not.toBe(
				discrimination.positive.evidence.observationSha256
			);
			expect(discrimination.equivalent.evidence.observationSha256).toBe(
				discrimination.positive.evidence.observationSha256
			);
			expect(discrimination.equivalent.finding?.findingFingerprint).toBe(
				discrimination.positive.finding?.findingFingerprint
			);
			expect(discrimination.boundary.status).toBe('NOT_APPLICABLE');
			expect(discrimination.boundary.population.count).toBe(0);
			expect(discrimination.boundary.evaluatorExecuted).toBe(false);
			expect(discrimination.disabled.status).toBe('NOT_RUN');
			expect(discrimination.disabled.evaluatorExecuted).toBe(false);
			expect(discrimination.positive.provenance.length).toBeGreaterThan(0);
			expect(discrimination.positive.currentness.frozenSubjectId).toBe(
				HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.frozenSubjectId
			);
			expect(discrimination.positive.currentness.sourceSha256).toBe(
				HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.sourceSha256
			);
		}
	});
});

describe('harmonization first-increment evaluation semantics', () => {
	it('preserves all five benchmark statuses without turning unsupported or absence into a pass', () => {
		const negative = evaluateHarmonizationFirstIncrementRule(
			createHarmonizationFirstIncrementFixtureRequest(
				'JAN-CSAA-HARMONIZATION-001',
				'NEARBY_NEGATIVE'
			)
		);
		expect(negative.outcome).toBe('evaluated');
		if (negative.outcome !== 'evaluated') throw new Error('Expected evaluated negative fixture.');
		expect(negative.result.status).toBe('NOT_DETECTED');
		expect(negative.result.statusRationale).toContain('NOT_A_CONFORMANCE_PASS');

		const unsupported = mutableRequest();
		unsupported.availableCapabilities = [];
		unsupported.facts = [];
		const unsupportedOutcome = evaluateHarmonizationFirstIncrementRule(unsupported);
		expect(unsupportedOutcome.outcome).toBe('evaluated');
		if (unsupportedOutcome.outcome !== 'evaluated') throw new Error('Expected supported envelope.');
		expect(unsupportedOutcome.result.status).toBe('UNSUPPORTED');
		expect(unsupportedOutcome.result.evaluatorExecuted).toBe(false);
		expect(unsupportedOutcome.result.missingCapabilities).toEqual(['CALL', 'DFG']);

		const notApplicable = mutableRequest();
		notApplicable.population = {
			...notApplicable.population,
			count: 0,
			members: [],
			sha256: canonicalSemanticJsonWitness({ population: [] }).sha256
		};
		notApplicable.facts = [];
		const notApplicableOutcome = evaluateHarmonizationFirstIncrementRule(notApplicable);
		expect(notApplicableOutcome.outcome).toBe('evaluated');
		if (notApplicableOutcome.outcome !== 'evaluated')
			throw new Error('Expected supported envelope.');
		expect(notApplicableOutcome.result.status).toBe('NOT_APPLICABLE');
		expect(notApplicableOutcome.result.currentness.frozenSubjectId).toBe(
			HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.frozenSubjectId
		);

		const notRun = mutableRequest();
		notRun.executionDisposition = 'NOT_RUN';
		notRun.availableCapabilities = [];
		notRun.facts = [];
		notRun.provenance = [];
		const notRunOutcome = evaluateHarmonizationFirstIncrementRule(notRun);
		expect(notRunOutcome.outcome).toBe('evaluated');
		if (notRunOutcome.outcome !== 'evaluated') throw new Error('Expected supported envelope.');
		expect(notRunOutcome.result.status).toBe('NOT_RUN');
		expect(notRunOutcome.result.evaluatorExecuted).toBe(false);
	});

	it('marks stale, open, and missing-projection observations unsupported and never executes the evaluator', () => {
		const stale = mutableRequest();
		stale.currentness = {
			...stale.currentness,
			invalidationDependencyIds: ['source:changed'],
			state: 'CALLER_DECLARED_STALE'
		};
		const staleOutcome = evaluateHarmonizationFirstIncrementRule(stale);
		expect(staleOutcome.outcome).toBe('evaluated');
		if (staleOutcome.outcome !== 'evaluated') throw new Error('Expected supported envelope.');
		expect(staleOutcome.result.status).toBe('UNSUPPORTED');
		expect(staleOutcome.result.evaluatorExecuted).toBe(false);

		const open = mutableRequest();
		open.population = { ...open.population, closure: 'OPEN' };
		const openOutcome = evaluateHarmonizationFirstIncrementRule(open);
		expect(openOutcome.outcome).toBe('evaluated');
		if (openOutcome.outcome !== 'evaluated') throw new Error('Expected supported envelope.');
		expect(openOutcome.result.status).toBe('UNSUPPORTED');

		const missingProjection = mutableRequest();
		missingProjection.provenance = missingProjection.provenance.slice(1);
		const missingProjectionOutcome = evaluateHarmonizationFirstIncrementRule(missingProjection);
		expect(missingProjectionOutcome.outcome).toBe('evaluated');
		if (missingProjectionOutcome.outcome !== 'evaluated')
			throw new Error('Expected supported envelope.');
		expect(missingProjectionOutcome.result.status).toBe('UNSUPPORTED');
		expect(missingProjectionOutcome.result.missingProjectionSurfaces).toHaveLength(1);

		const unprovenAbsence = mutableRequest();
		unprovenAbsence.population = { ...unprovenAbsence.population, count: 0, members: [] };
		unprovenAbsence.facts = [];
		unprovenAbsence.provenance = [];
		const unprovenAbsenceOutcome = evaluateHarmonizationFirstIncrementRule(unprovenAbsence);
		expect(unprovenAbsenceOutcome.outcome).toBe('evaluated');
		if (unprovenAbsenceOutcome.outcome !== 'evaluated')
			throw new Error('Expected supported envelope.');
		expect(unprovenAbsenceOutcome.result.status).toBe('UNSUPPORTED');
	});

	it('keeps authority and gate effect NONE and makes the native-projection boundary explicit', () => {
		const outcome = evaluateHarmonizationFirstIncrementRule(
			createHarmonizationFirstIncrementFixtureRequest('JAN-CSAA-HARMONIZATION-049', 'POSITIVE')
		);
		expect(outcome.analysisAuthority).toBe(HARMONIZATION_FIRST_INCREMENT_ANALYSIS_AUTHORITY);
		expect(outcome.gateEffect).toBe(HARMONIZATION_FIRST_INCREMENT_GATE_EFFECT);
		expect(outcome.outcome).toBe('evaluated');
		if (outcome.outcome !== 'evaluated') throw new Error('Expected evaluated fixture.');
		expect(outcome.result.capability.nativeProjection).toBe(
			'NOT_PERFORMED_CALLER_SUPPLIED_STRUCTURAL_OBSERVATION'
		);
		expect(outcome.result.capability.registeredOperation).toBe('NOT_CLAIMED');
		expect(outcome.result.facadeNonclaims).toBe(HARMONIZATION_FIRST_INCREMENT_NONCLAIMS);
		expect(outcome.result.finding?.analysisAuthority).toBe('NONE');
		expect(outcome.result.finding?.gateEffect).toBe('NONE');
		expect(outcome.result.finding?.benchmarkSourceReference).toBe(
			'packages/rph-application/src/command-bus.ts:111'
		);
		expect(
			outcome.result.finding?.witnessSourceReferences.every((reference) =>
				reference.startsWith('fixture://')
			)
		).toBe(true);
		const { resultWitness, ...resultContent } = outcome.result;
		expect(resultWitness.basis).toBe('CANONICAL_RESULT_CONTENT_EXCLUDING_RESULT_WITNESS');
		expect(canonicalSemanticJsonWitness(resultContent)).toEqual({
			bytes: resultWitness.bytes,
			sha256: resultWitness.sha256
		});
	});
});

describe('harmonization first-increment hostile admission and accounting', () => {
	it('rejects Proxy and accessor inputs without executing traps or getters', () => {
		let proxyTraps = 0;
		const proxied = new Proxy(mutableRequest(), {
			get() {
				proxyTraps += 1;
				throw new Error('must not execute');
			},
			getOwnPropertyDescriptor() {
				proxyTraps += 1;
				throw new Error('must not execute');
			},
			ownKeys() {
				proxyTraps += 1;
				throw new Error('must not execute');
			}
		});
		const proxyOutcome = evaluateHarmonizationFirstIncrementRule(proxied);
		expect(proxyOutcome.outcome).toBe('unavailable');
		expect(proxyTraps).toBe(0);

		let getterCalls = 0;
		const getterRequest = mutableRequest();
		Object.defineProperty(getterRequest, 'facts', {
			configurable: true,
			enumerable: true,
			get() {
				getterCalls += 1;
				throw new Error('must not execute');
			}
		});
		const getterOutcome = evaluateHarmonizationFirstIncrementRule(getterRequest);
		expect(getterOutcome.outcome).toBe('unavailable');
		expect(getterCalls).toBe(0);
	});

	it('refuses oversized sparse data before traversal and rejects malformed scalar text', () => {
		const sparse = mutableRequest();
		const hostileFacts: unknown[] = [];
		hostileFacts.length = 1_000_000;
		sparse.facts = hostileFacts as unknown as typeof sparse.facts;
		const sparseOutcome = evaluateHarmonizationFirstIncrementRule(sparse);
		expect(sparseOutcome.outcome).toBe('unavailable');
		if (sparseOutcome.outcome !== 'unavailable') throw new Error('Expected resource refusal.');
		expect(sparseOutcome.state).toBe('resource-refused');
		expect(sparseOutcome.diagnostics[0].code).toBe('REQUEST_ARRAY_BUDGET_EXCEEDED');

		const malformed = mutableRequest();
		malformed.evaluationId = '\ud800';
		const malformedOutcome = evaluateHarmonizationFirstIncrementRule(malformed);
		expect(malformedOutcome.outcome).toBe('unavailable');
		if (malformedOutcome.outcome !== 'unavailable') throw new Error('Expected refusal.');
		expect(malformedOutcome.diagnostics[0].code).toBe('REQUEST_TEXT_INVALID');

		const populationMismatch = mutableRequest();
		populationMismatch.population = { ...populationMismatch.population, count: 2 };
		const populationMismatchOutcome = evaluateHarmonizationFirstIncrementRule(populationMismatch);
		expect(populationMismatchOutcome.outcome).toBe('unavailable');
		if (populationMismatchOutcome.outcome !== 'unavailable') throw new Error('Expected refusal.');
		expect(populationMismatchOutcome.diagnostics[0].code).toBe('REQUEST_POPULATION_COUNT_MISMATCH');
	});

	it('refuses a canonical terminal result that exceeds the fixed byte ceiling', () => {
		const oversizedResult = mutableRequest('JAN-CSAA-HARMONIZATION-022');
		const largeSet = Array.from(
			{ length: 64 },
			(_, index) => `member-${String(index).padStart(2, '0')}-${'x'.repeat(2_030)}`
		);
		oversizedResult.facts = oversizedResult.facts.map((fact) => ({
			key: fact.key,
			value: largeSet
		}));
		oversizedResult.currentness.invalidationDependencyIds = Array.from(
			{ length: 64 },
			(_, index) => `dependency-${String(index).padStart(2, '0')}-${'y'.repeat(2_030)}`
		);
		const outcome = evaluateHarmonizationFirstIncrementRule(oversizedResult);
		expect(outcome.outcome).toBe('unavailable');
		if (outcome.outcome !== 'unavailable') throw new Error('Expected resource refusal.');
		expect(outcome.state).toBe('resource-refused');
		expect(outcome.diagnostics[0]).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			stage: 'RESULT'
		});
	});

	it('detaches and deeply freezes admitted data', () => {
		const request = mutableRequest('JAN-CSAA-HARMONIZATION-022');
		const outcome = evaluateHarmonizationFirstIncrementRule(request);
		expect(outcome.outcome).toBe('evaluated');
		if (outcome.outcome !== 'evaluated') throw new Error('Expected evaluated fixture.');
		const before = outcome.result.resultWitness.sha256;
		(request.facts[0]!.value as string[]).push('P99');
		request.provenance[0]!.sourceReference = 'mutated-after-admission';
		expect(outcome.result.resultWitness.sha256).toBe(before);
		expect(Object.isFrozen(outcome)).toBe(true);
		expect(Object.isFrozen(outcome.result)).toBe(true);
		expect(Object.isFrozen(outcome.result.rule.conditions)).toBe(true);
		expect(Object.isFrozen(outcome.result.evidence.conditionTrace)).toBe(true);
	});

	it('produces exact total accounting with 23 fixture detections and 52 honest unsupported rows', () => {
		const request = createHarmonizationFirstIncrementBenchmarkAccountingRequest(
			'harmonization-first-increment-accounting-test'
		);
		expect(request.assessments).toHaveLength(75);
		const outcome = runHarmonizationBenchmarkAccounting(request);
		expect(outcome.outcome).toBe('accounted');
		if (outcome.outcome !== 'accounted') throw new Error(outcome.diagnostics[0].message);
		expect(outcome.result.accounting.denominator).toBe(75);
		expect(outcome.result.accounting.statusTotals).toEqual({
			DETECTED: 23,
			NOT_APPLICABLE: 0,
			NOT_DETECTED: 0,
			NOT_RUN: 0,
			UNSUPPORTED: 52
		});
		expect(outcome.result.accounting.firstIncrement.statusTotals.DETECTED).toBe(23);
		expect(outcome.result.accounting.implementationTotals.implemented).toBe(23);
		expect(outcome.result.accounting.implementationTotals.unimplemented).toBe(52);
		expect(outcome.result.subjectBinding).toEqual({
			frozenSubjectId: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.frozenSubjectId,
			sourceSha256: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.sourceSha256,
			state: 'CALLER_DECLARED_COMMON_FROZEN_SUBJECT'
		});
		expect(request.operationVersion).toBe(HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION);
		expect(HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION).toContain('/0.1.0');
	});
});
