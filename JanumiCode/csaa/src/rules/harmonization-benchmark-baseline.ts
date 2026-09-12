import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';

export const HARMONIZATION_BENCHMARK_BASELINE_SCHEMA_VERSION =
	'jan-csaa-harmonization-benchmark-baseline/0.1.0' as const;

export const HARMONIZATION_FINDINGS_SOURCE_WITNESS = Object.freeze({
	bytes: 26_518,
	confirmedFindingRows: 75,
	path: 'docs/_working/HARMONIZATION-FINDINGS.md',
	sha256: '1fd8b47d624822bb821cf6319274b9b0ce26756fff2debf1bd58be7b1d8a0c45',
	witnessCurrentness: 'HISTORICAL_EXACT_BYTES_NOT_RECHECKED_BY_THIS_MODULE' as const
});

export const HARMONIZATION_FINDING_CLASSIFICATIONS = Object.freeze([
	'STATIC_DIRECT',
	'STATIC_WHOLE_PROGRAM',
	'HYBRID_RUNTIME',
	'NORMATIVE_HUMAN'
] as const);

export type HarmonizationFindingClassification =
	(typeof HARMONIZATION_FINDING_CLASSIFICATIONS)[number];

export const HARMONIZATION_CAPABILITY_CODES = Object.freeze([
	'AST',
	'SYM',
	'SCHEMA',
	'CALL',
	'DFG',
	'TAINT',
	'TEST',
	'FSM',
	'TRACE',
	'NORM'
] as const);

export type HarmonizationCapabilityCode = (typeof HARMONIZATION_CAPABILITY_CODES)[number];

export const HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS = Object.freeze({
	HYBRID_RUNTIME: 5,
	NORMATIVE_HUMAN: 8,
	STATIC_DIRECT: 21,
	STATIC_WHOLE_PROGRAM: 41
} satisfies Record<HarmonizationFindingClassification, number>);

export const HARMONIZATION_FIRST_INCREMENT_FINDING_IDS = Object.freeze([
	1, 3, 5, 6, 8, 11, 12, 17, 18, 22, 23, 28, 30, 31, 32, 34, 35, 36, 39, 40, 49, 70, 73
] as const);

/** Implementation-local planning projection derived from the governed class allocation and I1 set. */
export type HarmonizationBenchmarkPhase =
	| 'DWP_005_FIRST_INCREMENT'
	| 'DWP_005_LATER_STATIC'
	| 'DWP_008_RUNTIME_WITH_DWP_005_STATIC_PREREQUISITES'
	| 'HUMAN_DECISION_REQUIRED';

export type HarmonizationClassificationRationale =
	| 'BOUNDED_DIRECT_STATIC_ANALYSIS_CAN_ESTABLISH_THE_REPORTED_DEFECT_WITH_THE_LISTED_MINIMUM_CAPABILITIES'
	| 'WHOLE_PROGRAM_STATIC_ANALYSIS_CAN_ESTABLISH_THE_REPORTED_DEFECT_WITH_THE_LISTED_MINIMUM_CAPABILITIES'
	| 'RUNTIME_OR_TEST_TRACE_EVIDENCE_IS_REQUIRED_IN_ADDITION_TO_STATIC_PREREQUISITES'
	| 'ANALYSIS_MAY_FRAME_THE_CONFLICT_BUT_HUMAN_NORMATIVE_JUDGMENT_IS_REQUIRED';

export interface HarmonizationBenchmarkRow {
	readonly findingId: number;
	readonly classification: HarmonizationFindingClassification;
	readonly classificationRationale: HarmonizationClassificationRationale;
	readonly firstIncrement: boolean;
	readonly minimumCapabilities: readonly HarmonizationCapabilityCode[];
	readonly phase: HarmonizationBenchmarkPhase;
}

type BaselineTuple = readonly [
	findingId: number,
	classification: HarmonizationFindingClassification,
	minimumCapabilities: readonly HarmonizationCapabilityCode[]
];

const D = 'STATIC_DIRECT' as const;
const W = 'STATIC_WHOLE_PROGRAM' as const;
const H = 'HYBRID_RUNTIME' as const;
const N = 'NORMATIVE_HUMAN' as const;

/**
 * Complete classification from JAN-CSAA-W4-DESIGN-001. Finding prose is deliberately excluded;
 * each row instead preserves the governing class rationale, capability allocation, planning phase,
 * and I1 membership while the ignored working review remains the exact source witness above.
 */
const BASELINE_TUPLES: readonly BaselineTuple[] = [
	[1, W, ['CALL', 'DFG']],
	[2, W, ['DFG', 'AST']],
	[3, W, ['SYM']],
	[4, W, ['DFG', 'SCHEMA']],
	[5, W, ['SYM', 'CALL']],
	[6, W, ['CALL', 'TEST']],
	[7, W, ['TAINT', 'DFG']],
	[8, W, ['SCHEMA', 'SYM']],
	[9, H, ['TAINT', 'TRACE']],
	[10, W, ['DFG']],
	[11, D, ['AST', 'SCHEMA']],
	[12, D, ['AST']],
	[13, D, ['SCHEMA', 'NORM']],
	[14, W, ['DFG', 'SCHEMA']],
	[15, W, ['DFG']],
	[16, W, ['DFG', 'SCHEMA']],
	[17, W, ['CALL', 'AST']],
	[18, W, ['SYM']],
	[19, H, ['TRACE', 'DFG']],
	[20, N, ['NORM']],
	[21, W, ['TAINT', 'CALL']],
	[22, D, ['TEST', 'AST']],
	[23, W, ['TEST', 'CALL']],
	[24, W, ['DFG']],
	[25, W, ['AST', 'DFG']],
	[26, W, ['SCHEMA', 'SYM']],
	[27, W, ['DFG', 'SCHEMA']],
	[28, W, ['SYM', 'DFG']],
	[29, W, ['TAINT', 'DFG']],
	[30, D, ['SCHEMA']],
	[31, D, ['AST', 'SCHEMA']],
	[32, D, ['SCHEMA', 'NORM']],
	[33, D, ['SCHEMA']],
	[34, W, ['CALL', 'AST']],
	[35, W, ['CALL', 'SYM']],
	[36, W, ['CALL', 'DFG']],
	[37, D, ['SCHEMA', 'NORM']],
	[38, W, ['FSM', 'AST']],
	[39, W, ['CALL', 'AST']],
	[40, D, ['AST']],
	[41, W, ['CALL', 'SYM']],
	[42, W, ['CALL', 'SYM']],
	[43, D, ['SCHEMA']],
	[44, W, ['SYM', 'DFG']],
	[45, H, ['TRACE', 'DFG']],
	[46, W, ['DFG', 'SCHEMA']],
	[47, D, ['AST']],
	[48, N, ['NORM', 'FSM']],
	[49, W, ['CALL', 'TAINT']],
	[50, D, ['AST']],
	[51, D, ['SCHEMA']],
	[52, W, ['DFG', 'SCHEMA']],
	[53, N, ['NORM', 'SCHEMA']],
	[54, H, ['TRACE', 'TAINT']],
	[55, H, ['TRACE', 'TAINT']],
	[56, D, ['AST']],
	[57, D, ['AST', 'DFG']],
	[58, D, ['AST']],
	[59, N, ['NORM', 'DFG']],
	[60, W, ['TAINT', 'DFG']],
	[61, W, ['DFG']],
	[62, D, ['AST']],
	[63, W, ['DFG', 'SCHEMA']],
	[64, N, ['NORM']],
	[65, D, ['SCHEMA']],
	[66, D, ['SCHEMA', 'NORM']],
	[67, W, ['CALL', 'SCHEMA']],
	[68, N, ['NORM']],
	[69, W, ['DFG', 'AST']],
	[70, W, ['SYM', 'AST']],
	[71, W, ['CALL', 'FSM']],
	[72, W, ['CALL', 'AST']],
	[73, D, ['AST', 'DFG']],
	[74, N, ['NORM', 'SCHEMA']],
	[75, N, ['NORM']]
];

const capabilityOrder = new Map(
	HARMONIZATION_CAPABILITY_CODES.map((capability, index) => [capability, index] as const)
);
const firstIncrementIds = new Set<number>(HARMONIZATION_FIRST_INCREMENT_FINDING_IDS);

function classificationRationale(
	classification: HarmonizationFindingClassification
): HarmonizationClassificationRationale {
	switch (classification) {
		case 'STATIC_DIRECT':
			return 'BOUNDED_DIRECT_STATIC_ANALYSIS_CAN_ESTABLISH_THE_REPORTED_DEFECT_WITH_THE_LISTED_MINIMUM_CAPABILITIES';
		case 'STATIC_WHOLE_PROGRAM':
			return 'WHOLE_PROGRAM_STATIC_ANALYSIS_CAN_ESTABLISH_THE_REPORTED_DEFECT_WITH_THE_LISTED_MINIMUM_CAPABILITIES';
		case 'HYBRID_RUNTIME':
			return 'RUNTIME_OR_TEST_TRACE_EVIDENCE_IS_REQUIRED_IN_ADDITION_TO_STATIC_PREREQUISITES';
		case 'NORMATIVE_HUMAN':
			return 'ANALYSIS_MAY_FRAME_THE_CONFLICT_BUT_HUMAN_NORMATIVE_JUDGMENT_IS_REQUIRED';
	}
}

function planningPhase(
	classification: HarmonizationFindingClassification,
	firstIncrement: boolean
): HarmonizationBenchmarkPhase {
	if (firstIncrement) return 'DWP_005_FIRST_INCREMENT';
	if (classification === 'HYBRID_RUNTIME')
		return 'DWP_008_RUNTIME_WITH_DWP_005_STATIC_PREREQUISITES';
	if (classification === 'NORMATIVE_HUMAN') return 'HUMAN_DECISION_REQUIRED';
	return 'DWP_005_LATER_STATIC';
}

function materializeCanonicalRows(): readonly HarmonizationBenchmarkRow[] {
	const rows = BASELINE_TUPLES.map(([findingId, classification, capabilities]) => {
		const firstIncrement = firstIncrementIds.has(findingId);
		const minimumCapabilities = [...capabilities].sort(
			(left, right) => capabilityOrder.get(left)! - capabilityOrder.get(right)!
		);
		if (new Set(minimumCapabilities).size !== minimumCapabilities.length)
			throw new Error(`Duplicate capability in harmonization finding ${findingId}.`);
		return Object.freeze({
			classification,
			classificationRationale: classificationRationale(classification),
			findingId,
			firstIncrement,
			minimumCapabilities: Object.freeze(minimumCapabilities),
			phase: planningPhase(classification, firstIncrement)
		});
	});
	if (rows.length !== 75) throw new Error('Harmonization baseline must contain exactly 75 rows.');
	for (let index = 0; index < rows.length; index += 1) {
		if (rows[index]!.findingId !== index + 1)
			throw new Error('Harmonization baseline finding IDs must be exactly ordered 1 through 75.');
	}
	const observedTotals = Object.fromEntries(
		HARMONIZATION_FINDING_CLASSIFICATIONS.map((classification) => [classification, 0])
	) as Record<HarmonizationFindingClassification, number>;
	for (const row of rows) observedTotals[row.classification] += 1;
	for (const classification of HARMONIZATION_FINDING_CLASSIFICATIONS) {
		if (
			observedTotals[classification] !==
			HARMONIZATION_EXPECTED_CLASSIFICATION_TOTALS[classification]
		)
			throw new Error(`Harmonization baseline class total is invalid for ${classification}.`);
	}
	if (rows.filter((row) => row.firstIncrement).length !== 23)
		throw new Error('Harmonization baseline must contain exactly 23 first-increment exemplars.');
	return Object.freeze(rows);
}

export const HARMONIZATION_BENCHMARK_ROWS = materializeCanonicalRows();

export const HARMONIZATION_BENCHMARK_EXPECTED_MAP_SHA256 =
	'd8e530203957cabe0978134a7395d337c4bedd30ddbcf7deac2ca1edb09e7de1' as const;

const mapWitness = canonicalSemanticJsonWitness({
	rows: HARMONIZATION_BENCHMARK_ROWS,
	schemaVersion: HARMONIZATION_BENCHMARK_BASELINE_SCHEMA_VERSION,
	sourceSha256: HARMONIZATION_FINDINGS_SOURCE_WITNESS.sha256
});
if (mapWitness.sha256 !== HARMONIZATION_BENCHMARK_EXPECTED_MAP_SHA256)
	throw new Error(
		'Harmonization benchmark map identity does not match its pinned canonical digest.'
	);

export const HARMONIZATION_BENCHMARK_MAP_WITNESS = Object.freeze(mapWitness);
