import { describe, expect, it } from 'vitest';

import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import {
	HARMONIZATION_BENCHMARK_EXPECTED_MAP_SHA256,
	HARMONIZATION_BENCHMARK_MAP_WITNESS,
	HARMONIZATION_BENCHMARK_ROWS,
	HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS,
	HARMONIZATION_FINDINGS_SOURCE_WITNESS,
	HARMONIZATION_FIRST_INCREMENT_FINDING_IDS
} from './harmonization-benchmark-baseline.js';
import {
	HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
	HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES,
	HARMONIZATION_BENCHMARK_ACCOUNTING_NONCLAIMS,
	createUnimplementedHarmonizationBenchmarkAccountingRequest,
	runHarmonizationBenchmarkAccounting,
	type HarmonizationBenchmarkAccountingOutcome,
	type HarmonizationBenchmarkAccountingRequest,
	type HarmonizationBenchmarkAssessment,
	type HarmonizationBenchmarkStatus
} from './harmonization-benchmark-accounting.js';

type DeepMutable<Value> = Value extends readonly (infer Item)[]
	? DeepMutable<Item>[]
	: Value extends object
		? { -readonly [Key in keyof Value]: DeepMutable<Value[Key]> }
		: Value;

type MutableRequest = DeepMutable<HarmonizationBenchmarkAccountingRequest>;
type MutableAssessment = DeepMutable<HarmonizationBenchmarkAssessment>;

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function request(): MutableRequest {
	return structuredClone(
		createUnimplementedHarmonizationBenchmarkAccountingRequest('harmonization-benchmark:test')
	) as MutableRequest;
}

function bindImplementedAssessment(
	assessment: MutableAssessment,
	status: HarmonizationBenchmarkStatus,
	options: { readonly stale?: boolean } = {}
): void {
	assessment.status = status;
	assessment.statusRationale = `TEST_${status}`;
	assessment.unsupportedCapabilities = [];
	assessment.rule = {
		implementation: 'IMPLEMENTED',
		method: 'AUTOMATED',
		registration: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
		ruleContentSha256: SHA_A,
		ruleId: `rule:${assessment.findingId}`,
		ruleVersion: '0.1.0'
	};
	if (status === 'NOT_RUN' && !options.stale) {
		assessment.evidence = { disposition: 'ABSENT', records: [] };
		assessment.provenance = { disposition: 'BASELINE_ONLY', records: [] };
		assessment.currentness = {
			basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
			frozenSubjectId: null,
			invalidationDependencyIds: [],
			sourceSha256: null,
			state: 'NOT_ASSESSED'
		};
		return;
	}
	assessment.evidence = {
		disposition: 'PRESENT',
		records: [
			{
				evidenceId: `evidence:${assessment.findingId}`,
				kind:
					status === 'NOT_APPLICABLE'
						? 'APPLICABILITY_CLOSURE'
						: status === 'DETECTED'
							? 'PLANTED_POSITIVE_DETECTION'
							: status === 'NOT_DETECTED'
								? 'PLANTED_POSITIVE_MISS'
								: 'EXECUTION',
				sha256: SHA_A,
				sourceReference: `fixture:${assessment.findingId}`
			}
		]
	};
	assessment.provenance = {
		disposition: 'ANALYSIS_BOUND',
		records: [
			{
				kind: 'RUN',
				provenanceId: `run:${assessment.findingId}`,
				sha256: SHA_B,
				version: '0.1.0'
			}
		]
	};
	assessment.currentness = {
		basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
		frozenSubjectId: 'frozen-subject:test',
		invalidationDependencyIds: options.stale ? ['dependency:changed'] : [],
		sourceSha256: SHA_A,
		state: options.stale ? 'CALLER_DECLARED_STALE' : 'CALLER_DECLARED_CURRENT'
	};
}

function expectUnavailable(candidate: unknown, code: string): void {
	expect(runHarmonizationBenchmarkAccounting(candidate)).toMatchObject({
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		capabilityStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
		diagnostics: [{ code }],
		gateEffect: 'NONE',
		outcome: 'unavailable',
		result: null
	});
}

function expectDeeplyFrozen(value: unknown): void {
	const seen = new WeakSet<object>();
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current !== 'object' || seen.has(current)) continue;
		seen.add(current);
		expect(Object.isFrozen(current)).toBe(true);
		for (const key of Reflect.ownKeys(current)) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor !== undefined && 'value' in descriptor) pending.push(descriptor.value);
		}
	}
}

function serializeOutcome(outcome: HarmonizationBenchmarkAccountingOutcome): {
	readonly canonicalJsonWithTerminalLf: string;
	readonly canonicalJsonSha256: string;
	readonly canonicalTerminalBytes: number;
} {
	const canonicalJson = canonicalSemanticJson(outcome);
	const witness = canonicalSemanticJsonWitness(outcome);
	return {
		canonicalJsonSha256: witness.sha256,
		canonicalJsonWithTerminalLf: `${canonicalJson}\n`,
		canonicalTerminalBytes: witness.bytes + 1
	};
}

describe('harmonization benchmark baseline', () => {
	it('binds every governed ID, class, capability set, and first-increment exemplar', () => {
		expect(HARMONIZATION_BENCHMARK_ROWS).toHaveLength(75);
		expect(HARMONIZATION_BENCHMARK_ROWS.map((row) => row.findingId)).toEqual(
			Array.from({ length: 75 }, (_, index) => index + 1)
		);
		expect(
			Object.fromEntries(
				Object.keys(HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS).map((classification) => [
					classification,
					HARMONIZATION_BENCHMARK_ROWS.filter((row) => row.classification === classification).length
				])
			)
		).toEqual(HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.filter((row) => row.firstIncrement).map((row) => row.findingId)
		).toEqual(HARMONIZATION_FIRST_INCREMENT_FINDING_IDS);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.filter((row) => row.firstIncrement).every(
				(row) => row.phase === 'DWP_005_FIRST_INCREMENT'
			)
		).toBe(true);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.filter(
				(row) => !row.firstIncrement && row.classification === 'HYBRID_RUNTIME'
			).every((row) => row.phase === 'DWP_008_RUNTIME_WITH_DWP_005_STATIC_PREREQUISITES')
		).toBe(true);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.filter(
				(row) => !row.firstIncrement && row.classification === 'NORMATIVE_HUMAN'
			).every((row) => row.phase === 'HUMAN_DECISION_REQUIRED')
		).toBe(true);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.filter(
				(row) =>
					!row.firstIncrement &&
					(row.classification === 'STATIC_DIRECT' || row.classification === 'STATIC_WHOLE_PROGRAM')
			).every((row) => row.phase === 'DWP_005_LATER_STATIC')
		).toBe(true);
		expect(
			HARMONIZATION_BENCHMARK_ROWS.every((row) => row.classificationRationale.length > 0)
		).toBe(true);
		expect(HARMONIZATION_FINDINGS_SOURCE_WITNESS).toMatchObject({
			bytes: 26_518,
			confirmedFindingRows: 75,
			sha256: '1fd8b47d624822bb821cf6319274b9b0ce26756fff2debf1bd58be7b1d8a0c45'
		});
		expect(HARMONIZATION_BENCHMARK_MAP_WITNESS).toEqual({
			bytes: 20_528,
			sha256: HARMONIZATION_BENCHMARK_EXPECTED_MAP_SHA256
		});
		expectDeeplyFrozen(HARMONIZATION_BENCHMARK_ROWS);
	});
});

describe('harmonization benchmark total accounting', () => {
	it('keeps the honest foundation all-UNSUPPORTED over the complete denominator', () => {
		const first = runHarmonizationBenchmarkAccounting(request());
		const second = runHarmonizationBenchmarkAccounting(request());
		expect(second).toEqual(first);
		expect(first).toMatchObject({
			analysisAuthority: 'NONE',
			authorityTransfer: 'NONE',
			capabilityStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			diagnostics: [],
			gateEffect: 'NONE',
			outcome: 'accounted',
			result: {
				accounting: {
					allFindingIdsAccountedExactlyOnce: true,
					denominator: 75,
					firstIncrement: {
						statusTotals: { UNSUPPORTED: 23 },
						total: 23
					},
					implementationTotals: { implemented: 0, unimplemented: 75 },
					statusTotals: {
						DETECTED: 0,
						NOT_APPLICABLE: 0,
						NOT_DETECTED: 0,
						NOT_RUN: 0,
						UNSUPPORTED: 75
					},
					statusBasis: 'CALLER_SUPPLIED_STRUCTURALLY_VALIDATED_NOT_INDEPENDENTLY_ADJUDICATED',
					statusTotalsReconcileToDenominator: true
				},
				capability: {
					analysisAuthority: 'NONE',
					detectorExecution: 'NOT_PERFORMED_BY_ACCOUNTING_FOUNDATION',
					dwp005Dwp006OrG5Completion: 'NOT_CLAIMED',
					exemplarDiscrimination: 'NOT_ASSESSED',
					gateEffect: 'NONE',
					registeredOperation: 'NOT_CLAIMED'
				},
				subjectBinding: {
					frozenSubjectId: null,
					sourceSha256: null,
					state: 'NO_ANALYSIS_BOUND_ROWS'
				}
			},
			state: 'accounted'
		});
		if (first.outcome !== 'accounted') throw new Error(JSON.stringify(first));
		for (const [classification, expected] of Object.entries(
			HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS
		)) {
			expect(first.result.accounting.byClassification).toMatchObject({
				[classification]: { statusTotals: { UNSUPPORTED: expected }, total: expected }
			});
		}
		expect(first.result.rows.every((row) => row.status === 'UNSUPPORTED')).toBe(true);
		expect(first.result.rows.every((row) => row.rule.implementation === 'UNIMPLEMENTED')).toBe(
			true
		);
		expect(first.result.facadeNonclaims).toBe(HARMONIZATION_BENCHMARK_ACCOUNTING_NONCLAIMS);
		expectDeeplyFrozen(first);
	});

	it('preserves all five benchmark statuses without changing the all-75 denominator', () => {
		const candidate = request();
		bindImplementedAssessment(candidate.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(candidate.assessments[1]!, 'NOT_DETECTED');
		bindImplementedAssessment(candidate.assessments[2]!, 'NOT_APPLICABLE');
		bindImplementedAssessment(candidate.assessments[3]!, 'NOT_RUN');
		const outcome = runHarmonizationBenchmarkAccounting(candidate);
		expect(outcome).toMatchObject({
			outcome: 'accounted',
			result: {
				accounting: {
					denominator: 75,
					implementationTotals: { automated: 4, implemented: 4, unimplemented: 71 },
					statusTotals: {
						DETECTED: 1,
						NOT_APPLICABLE: 1,
						NOT_DETECTED: 1,
						NOT_RUN: 1,
						UNSUPPORTED: 71
					}
				},
				subjectBinding: {
					frozenSubjectId: 'frozen-subject:test',
					sourceSha256: SHA_A,
					state: 'CALLER_DECLARED_COMMON_FROZEN_SUBJECT'
				}
			}
		});
	});

	it('preserves stale evidence as NOT_RUN instead of turning it green', () => {
		const candidate = request();
		bindImplementedAssessment(candidate.assessments[0]!, 'NOT_RUN', { stale: true });
		const outcome = runHarmonizationBenchmarkAccounting(candidate);
		expect(outcome).toMatchObject({
			outcome: 'accounted',
			result: {
				accounting: { statusTotals: { NOT_RUN: 1, UNSUPPORTED: 74 } }
			}
		});
		if (outcome.outcome !== 'accounted') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.rows[0]).toMatchObject({
			currentness: {
				basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
				state: 'CALLER_DECLARED_STALE'
			},
			status: 'NOT_RUN'
		});
	});
});

describe('harmonization benchmark hostile-data and semantic validation', () => {
	it('rejects missing, reordered, duplicate, and extra finding identities', () => {
		const missing = request();
		missing.assessments.pop();
		expectUnavailable(missing, 'REQUEST_ARRAY_CARDINALITY_INVALID');

		const reordered = request();
		[reordered.assessments[0], reordered.assessments[1]] = [
			reordered.assessments[1]!,
			reordered.assessments[0]!
		];
		expectUnavailable(reordered, 'REQUEST_FINDING_ID_SEQUENCE_INVALID');

		const duplicate = request();
		duplicate.assessments[1]!.findingId = 1;
		expectUnavailable(duplicate, 'REQUEST_FINDING_ID_SEQUENCE_INVALID');

		const extra = request();
		extra.assessments.push(structuredClone(extra.assessments[74]!));
		expectUnavailable(extra, 'REQUEST_ARRAY_BUDGET_EXCEEDED');
	});

	it('rejects accessors and Proxies without invoking caller code', () => {
		const accessor = request();
		let getterCalls = 0;
		Object.defineProperty(accessor.assessments[0], 'statusRationale', {
			enumerable: true,
			get: () => {
				getterCalls += 1;
				return 'must-not-run';
			}
		});
		expectUnavailable(accessor, 'REQUEST_SHAPE_INVALID');
		expect(getterCalls).toBe(0);

		const proxied = request();
		let proxyTrapCalls = 0;
		proxied.assessments[0]!.rule = new Proxy(proxied.assessments[0]!.rule, {
			ownKeys: (target) => {
				proxyTrapCalls += 1;
				return Reflect.ownKeys(target);
			}
		});
		expectUnavailable(proxied, 'REQUEST_SHAPE_INVALID');
		expect(proxyTrapCalls).toBe(0);
	});

	it('refuses oversized sparse arrays before enumeration and rejects alien data', () => {
		const sparse = request();
		sparse.assessments.length = 1_000_000;
		expectUnavailable(sparse, 'REQUEST_ARRAY_BUDGET_EXCEEDED');

		const symbol = request();
		Object.defineProperty(symbol.assessments[0], Symbol('alien'), {
			enumerable: true,
			value: true
		});
		expectUnavailable(symbol, 'REQUEST_SHAPE_INVALID');

		const loneSurrogate = request();
		loneSurrogate.assessments[0]!.statusRationale = '\ud800';
		expectUnavailable(loneSurrogate, 'REQUEST_TEXT_INVALID');

		const reorderedCapabilities = request();
		reorderedCapabilities.assessments[0]!.unsupportedCapabilities = ['DFG', 'CALL'];
		expectUnavailable(reorderedCapabilities, 'REQUEST_CAPABILITY_ORDER_INVALID');
	});

	it('rejects status mutations that lack their evidence, provenance, and currentness bindings', () => {
		const candidate = request();
		candidate.assessments[0]!.status = 'DETECTED';
		expectUnavailable(candidate, 'REQUEST_UNIMPLEMENTED_STATUS_INVALID');

		const normative = request();
		bindImplementedAssessment(normative.assessments[19]!, 'DETECTED');
		expectUnavailable(normative, 'REQUEST_AUTOMATED_NORMATIVE_VERDICT_FORBIDDEN');

		const missingRuleContentIdentity = request();
		bindImplementedAssessment(missingRuleContentIdentity.assessments[0]!, 'DETECTED');
		missingRuleContentIdentity.assessments[0]!.rule.ruleContentSha256 = null;
		expectUnavailable(missingRuleContentIdentity, 'REQUEST_RULE_BINDING_INCOHERENT');

		const missingSupportWitness = request();
		bindImplementedAssessment(missingSupportWitness.assessments[0]!, 'DETECTED');
		missingSupportWitness.assessments[0]!.evidence.records[0]!.kind = 'EXECUTION';
		expectUnavailable(missingSupportWitness, 'REQUEST_CONCLUSIVE_EVIDENCE_KIND_MISSING');

		const halfBoundCurrentness = request();
		bindImplementedAssessment(halfBoundCurrentness.assessments[0]!, 'DETECTED');
		halfBoundCurrentness.assessments[0]!.currentness.sourceSha256 = null;
		expectUnavailable(halfBoundCurrentness, 'REQUEST_CURRENTNESS_INCOHERENT');

		const mixedSubjects = request();
		bindImplementedAssessment(mixedSubjects.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(mixedSubjects.assessments[1]!, 'NOT_DETECTED');
		mixedSubjects.assessments[1]!.currentness.frozenSubjectId = 'frozen-subject:other';
		expectUnavailable(mixedSubjects, 'REQUEST_MIXED_FROZEN_SUBJECTS');

		const conflictingEvidenceIdentity = request();
		bindImplementedAssessment(conflictingEvidenceIdentity.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(conflictingEvidenceIdentity.assessments[1]!, 'NOT_DETECTED');
		conflictingEvidenceIdentity.assessments[1]!.evidence.records[0]!.evidenceId =
			conflictingEvidenceIdentity.assessments[0]!.evidence.records[0]!.evidenceId;
		expectUnavailable(conflictingEvidenceIdentity, 'REQUEST_EVIDENCE_IDENTITY_CONFLICT');

		const conflictingProvenanceIdentity = request();
		bindImplementedAssessment(conflictingProvenanceIdentity.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(conflictingProvenanceIdentity.assessments[1]!, 'NOT_DETECTED');
		conflictingProvenanceIdentity.assessments[1]!.provenance.records[0]!.provenanceId =
			conflictingProvenanceIdentity.assessments[0]!.provenance.records[0]!.provenanceId;
		conflictingProvenanceIdentity.assessments[1]!.provenance.records[0]!.sha256 = SHA_A;
		expectUnavailable(conflictingProvenanceIdentity, 'REQUEST_PROVENANCE_IDENTITY_CONFLICT');

		const conflictingRuleIdentity = request();
		bindImplementedAssessment(conflictingRuleIdentity.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(conflictingRuleIdentity.assessments[1]!, 'NOT_DETECTED');
		conflictingRuleIdentity.assessments[1]!.rule.ruleId =
			conflictingRuleIdentity.assessments[0]!.rule.ruleId;
		conflictingRuleIdentity.assessments[1]!.rule.ruleContentSha256 = SHA_B;
		expectUnavailable(conflictingRuleIdentity, 'REQUEST_RULE_IDENTITY_CONFLICT');
	});

	it('enforces aggregate evidence budgets', () => {
		const candidate = request();
		candidate.budgets.maxEvidenceRecords = 1;
		bindImplementedAssessment(candidate.assessments[0]!, 'DETECTED');
		bindImplementedAssessment(candidate.assessments[1]!, 'NOT_DETECTED');
		expectUnavailable(candidate, 'REQUEST_EVIDENCE_BUDGET_EXCEEDED');
	});

	it('charges aggregate retained UTF-8 before result construction', () => {
		const multibyte = request();
		multibyte.budgets.maxRetainedUtf8Bytes = 4_096;
		multibyte.assessments[0]!.statusRationale = '😀'.repeat(200);
		expectUnavailable(multibyte, 'REQUEST_RETAINED_TEXT_BUDGET_EXCEEDED');

		const terminalReserve = request();
		terminalReserve.budgets.maxResultBytes = HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES;
		expectUnavailable(terminalReserve, 'REQUEST_RETAINED_TEXT_BUDGET_EXCEEDED');
	});
});

describe('harmonization benchmark serialization and result budget', () => {
	it('canonicalizes evidence and provenance record order', () => {
		const firstCandidate = request();
		bindImplementedAssessment(firstCandidate.assessments[0]!, 'DETECTED');
		firstCandidate.assessments[0]!.evidence.records.push({
			evidenceId: 'evidence:0-control',
			kind: 'NEARBY_NEGATIVE_CONTROL',
			sha256: SHA_B,
			sourceReference: 'fixture:nearby-negative'
		});
		firstCandidate.assessments[0]!.provenance.records.push({
			kind: 'PROVIDER',
			provenanceId: 'provider:0',
			sha256: SHA_A,
			version: '0.1.0'
		});
		const secondCandidate = structuredClone(firstCandidate);
		secondCandidate.assessments[0]!.evidence.records.reverse();
		secondCandidate.assessments[0]!.provenance.records.reverse();
		expect(runHarmonizationBenchmarkAccounting(secondCandidate)).toEqual(
			runHarmonizationBenchmarkAccounting(firstCandidate)
		);
	});

	it('is detached, deeply frozen, deterministic, and mutation-sensitive', () => {
		const candidate = request();
		const first = runHarmonizationBenchmarkAccounting(candidate);
		const second = runHarmonizationBenchmarkAccounting(request());
		const firstSerialized = serializeOutcome(first);
		const secondSerialized = serializeOutcome(second);
		expect(secondSerialized).toEqual(firstSerialized);
		expect(firstSerialized.canonicalJsonWithTerminalLf.endsWith('\n')).toBe(true);
		expect(firstSerialized.canonicalTerminalBytes).toBe(
			canonicalSemanticJsonWitness(first).bytes + 1
		);
		expect(JSON.parse(firstSerialized.canonicalJsonWithTerminalLf)).toEqual(first);

		candidate.assessments[0]!.statusRationale = 'MUTATED_AFTER_ADMISSION';
		if (first.outcome !== 'accounted') throw new Error(JSON.stringify(first));
		expect(first.result.rows[0]!.statusRationale).toBe(
			'NO_BENCHMARK_RULE_IMPLEMENTED_IN_THIS_FOUNDATION'
		);

		const semanticMutation = request();
		semanticMutation.assessments[0]!.statusRationale = 'SEMANTIC_MUTATION';
		const mutated = runHarmonizationBenchmarkAccounting(semanticMutation);
		expect(serializeOutcome(mutated).canonicalJsonSha256).not.toBe(
			firstSerialized.canonicalJsonSha256
		);
		expectDeeplyFrozen(first);
	});

	it('admits the exact canonical byte boundary and refuses one byte less', () => {
		const candidate = request();
		let exactBytes = candidate.budgets.maxResultBytes;
		for (let attempt = 0; attempt < 6; attempt += 1) {
			candidate.budgets.maxResultBytes = exactBytes;
			const outcome = runHarmonizationBenchmarkAccounting(candidate);
			if (outcome.outcome !== 'accounted') throw new Error(JSON.stringify(outcome));
			const observed = serializeOutcome(outcome).canonicalTerminalBytes;
			if (observed === exactBytes) break;
			exactBytes = observed;
		}
		expect(exactBytes).toBeGreaterThanOrEqual(HARMONIZATION_BENCHMARK_ACCOUNTING_MIN_RESULT_BYTES);
		candidate.budgets.maxResultBytes = exactBytes;
		const exact = runHarmonizationBenchmarkAccounting(candidate);
		expect(exact.outcome).toBe('accounted');
		if (exact.outcome !== 'accounted') throw new Error(JSON.stringify(exact));
		expect(serializeOutcome(exact).canonicalTerminalBytes).toBe(exactBytes);

		candidate.budgets.maxResultBytes = exactBytes - 1;
		expectUnavailable(candidate, 'RESULT_BUDGET_EXCEEDED');
	});
});
