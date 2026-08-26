import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import {
	HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
	HARMONIZATION_BENCHMARK_ACCOUNTING_DEFAULT_BUDGETS,
	HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
	HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION,
	createUnimplementedHarmonizationBenchmarkAccountingRequest,
	type HarmonizationBenchmarkAccountingRequest,
	type HarmonizationBenchmarkAssessment
} from './harmonization-benchmark-accounting.js';
import {
	HARMONIZATION_BENCHMARK_ROWS,
	HARMONIZATION_CAPABILITY_CODES,
	HARMONIZATION_FIRST_INCREMENT_FINDING_IDS,
	type HarmonizationCapabilityCode
} from './harmonization-benchmark-baseline.js';

export const HARMONIZATION_FIRST_INCREMENT_RULE_PROFILE_SCHEMA_VERSION =
	'jan-csaa-harmonization-rule-profile/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-harmonization-rule-evaluation-request/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_EVALUATION_RESULT_SCHEMA_VERSION =
	'jan-csaa-harmonization-rule-evaluation-result/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION =
	'jan-csaa-harmonization-rule-evaluation-outcome/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION =
	'jan-csaa-evaluate-harmonization-first-increment-rule/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_RULE_SET_VERSION =
	'jan-csaa-harmonization-first-increment-rule-set/0.1.0' as const;
export const HARMONIZATION_FIRST_INCREMENT_CAPABILITY =
	'IMPLEMENTATION_LOCAL_HARMONIZATION_FIRST_INCREMENT_RULE_EVALUATION' as const;
export const HARMONIZATION_FIRST_INCREMENT_CAPABILITY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const HARMONIZATION_FIRST_INCREMENT_ANALYSIS_AUTHORITY = 'NONE' as const;
export const HARMONIZATION_FIRST_INCREMENT_AUTHORITY_TRANSFER = 'NONE' as const;
export const HARMONIZATION_FIRST_INCREMENT_GATE_EFFECT = 'NONE' as const;

export const HARMONIZATION_FIRST_INCREMENT_NONCLAIMS = Object.freeze([
	'NATIVE_REPOSITORY_FACT_EXTRACTION_OR_RULE_PROJECTION',
	'REGISTERED_OPERATION_PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'INDEPENDENT_FROZEN_SUBJECT_CURRENTNESS_RECHECK',
	'CURRENT_REPOSITORY_DEFECT_REPRODUCTION_OR_RE_ADJUDICATION',
	'DWP_005_DWP_006_G5_OR_CAP_031_COMPLETION_OR_PASSAGE',
	'FULL_JAN_CSAA_004_006_OR_008_CONFORMANCE',
	'RULE_RESULT_AS_REMEDIATION_SUPPRESSION_EXCEPTION_APPROVAL_OR_AUTHORITY',
	'GATE_ACTIVATION_GATE_PASSAGE_OR_GATE_EFFECT',
	'NOT_DETECTED_AS_CONFORMANCE_PASS_OR_ABSENCE_OUTSIDE_THE_DECLARED_CLOSED_POPULATION',
	'CALLER_SUPPLIED_OBSERVATION_PROVENANCE_OR_CURRENTNESS_AUTHENTICITY'
] as const);

export const HARMONIZATION_RULE_PROJECTION_SURFACES = Object.freeze([
	'SEMANTIC_AST',
	'SEMANTIC_SYMBOLS',
	'SCHEMA_PROJECTION',
	'CALL_GRAPH',
	'READ_WRITE_ACCESS_GRAPH',
	'TAINT_PROJECTION',
	'TEST_CENSUS',
	'NORMATIVE_REGISTRY'
] as const);
export type HarmonizationRuleProjectionSurface =
	(typeof HARMONIZATION_RULE_PROJECTION_SURFACES)[number];

export type HarmonizationRuleFactValue = boolean | number | readonly string[];
export type HarmonizationRuleFactType = 'BOOLEAN' | 'NONNEGATIVE_SAFE_INTEGER' | 'STRING_SET';

export interface HarmonizationRuleFactSpec {
	readonly key: string;
	readonly type: HarmonizationRuleFactType;
}

export type HarmonizationRuleCondition =
	| {
			readonly expected: boolean;
			readonly factKey: string;
			readonly operator: 'BOOLEAN_EQUALS';
	  }
	| {
			readonly expected: number;
			readonly factKey: string;
			readonly operator: 'NUMBER_EQUALS' | 'NUMBER_GREATER_THAN_OR_EQUALS';
	  }
	| {
			readonly factKey: string;
			readonly operator: 'NUMBER_EQUALS_FACT';
			readonly otherFactKey: string;
	  }
	| {
			readonly expected: readonly string[];
			readonly factKey: string;
			readonly operator: 'SET_DISJOINT' | 'SET_EQUALS' | 'SET_INCLUDES_ALL';
	  }
	| {
			readonly factKey: string;
			readonly operator: 'SET_NOT_EQUALS_FACT';
			readonly otherFactKey: string;
	  };

export interface HarmonizationFirstIncrementRuleProfile {
	readonly applicabilityPredicate: 'DECLARED_SUBJECT_POPULATION_IS_NONEMPTY';
	readonly automatedRemediation: 'DISABLED';
	readonly classification: 'STATIC_DIRECT' | 'STATIC_WHOLE_PROGRAM';
	readonly confidencePolicy: 'CONCLUSIVE_ONLY_FOR_CURRENT_CLOSED_POPULATION_WITH_ALL_REQUIRED_SURFACES';
	readonly conditions: readonly HarmonizationRuleCondition[];
	readonly evaluatorReference: string;
	readonly factSpecs: readonly HarmonizationRuleFactSpec[];
	readonly findingFingerprintFields: readonly [
		'ruleId',
		'ruleVersion',
		'frozenSubjectId',
		'populationSha256',
		'observationSha256'
	];
	readonly findingId: number;
	readonly findingText: string;
	readonly fixtureReferences: {
		readonly boundary: string;
		readonly mutation: string;
		readonly nearbyNegative: string;
		readonly nonVacuity: string;
		readonly positive: string;
	};
	readonly guideReference: string;
	readonly minimumCompleteness: 'CLOSED_DECLARED_POPULATION';
	readonly benchmarkSourceReference: string;
	readonly protectedProperty: string;
	readonly projectionContract: 'CALLER_SUPPLIED_STRUCTURAL_OBSERVATION';
	readonly projectionRegistration: 'UNREGISTERED';
	readonly rationale: string;
	readonly referenceCurrentness: 'HISTORICAL_EXACT_BENCHMARK_ROW_NOT_RECHECKED_AS_CURRENT_SOURCE';
	readonly remediationGuidance: 'NONE_MECHANICALLY_SAFE_DECLARED';
	readonly requiredCapabilities: readonly HarmonizationCapabilityCode[];
	readonly requiredProjectionSurfaces: readonly HarmonizationRuleProjectionSurface[];
	readonly ruleContentSha256: string;
	readonly ruleId: string;
	readonly ruleVersion: '0.1.0';
	readonly schemaVersion: typeof HARMONIZATION_FIRST_INCREMENT_RULE_PROFILE_SCHEMA_VERSION;
	readonly subjectClass: string;
	readonly suppressionBoundary: 'OUTSIDE_ANALYZER_REQUIRES_SEPARATE_GOVERNED_RECORD';
	readonly technicalSeverity: 'CRITICAL' | 'BLOCKING' | 'MATERIAL';
	readonly title: string;
}

interface RuleSeed {
	readonly conditions: readonly HarmonizationRuleCondition[];
	readonly factSpecs: readonly HarmonizationRuleFactSpec[];
	readonly findingId: number;
	readonly findingText: string;
	readonly guideReference: string;
	readonly mutationFactKey: string;
	readonly nearbyNegativeFacts: Readonly<Record<string, HarmonizationRuleFactValue>>;
	readonly positiveFacts: Readonly<Record<string, HarmonizationRuleFactValue>>;
	readonly protectedProperty: string;
	readonly rationale: string;
	readonly sourceReference: string;
	readonly subjectClass: string;
	readonly technicalSeverity: 'CRITICAL' | 'BLOCKING' | 'MATERIAL';
	readonly title: string;
}

const N = (key: string): HarmonizationRuleFactSpec => ({ key, type: 'NONNEGATIVE_SAFE_INTEGER' });
const B = (key: string): HarmonizationRuleFactSpec => ({ key, type: 'BOOLEAN' });
const S = (key: string): HarmonizationRuleFactSpec => ({ key, type: 'STRING_SET' });
const EQ = (factKey: string, expected: number): HarmonizationRuleCondition => ({
	expected,
	factKey,
	operator: 'NUMBER_EQUALS'
});
const GTE = (factKey: string, expected: number): HarmonizationRuleCondition => ({
	expected,
	factKey,
	operator: 'NUMBER_GREATER_THAN_OR_EQUALS'
});
const BEQ = (factKey: string, expected: boolean): HarmonizationRuleCondition => ({
	expected,
	factKey,
	operator: 'BOOLEAN_EQUALS'
});
const NEQF = (factKey: string, otherFactKey: string): HarmonizationRuleCondition => ({
	factKey,
	operator: 'NUMBER_EQUALS_FACT',
	otherFactKey
});
const SETEQ = (factKey: string, expected: readonly string[]): HarmonizationRuleCondition => ({
	expected,
	factKey,
	operator: 'SET_EQUALS'
});
const DISJOINT = (factKey: string, expected: readonly string[]): HarmonizationRuleCondition => ({
	expected,
	factKey,
	operator: 'SET_DISJOINT'
});
const SETNEQF = (factKey: string, otherFactKey: string): HarmonizationRuleCondition => ({
	factKey,
	operator: 'SET_NOT_EQUALS_FACT',
	otherFactKey
});

const PROPERTY_IDS = Object.freeze(Array.from({ length: 12 }, (_, index) => `P${index + 1}`));
const FIRST_EIGHT_PROPERTY_IDS = Object.freeze(PROPERTY_IDS.slice(0, 8));
const OMITTED_PROPERTY_IDS = Object.freeze(PROPERTY_IDS.slice(8));
const GOVERNED_ID_PREFIXES = Object.freeze([
	'art',
	'asm',
	'assess',
	'attempt',
	'base',
	'bind',
	'clm',
	'cmd',
	'con',
	'dec',
	'evd',
	'evt',
	'int',
	'obs',
	'plan',
	'pol',
	'pwa',
	'pwu',
	'pwut',
	'step',
	'trace',
	'und'
]);
const HISTORICAL_CODE_ID_PREFIXES = Object.freeze([
	'art',
	'asm',
	'assess',
	'attempt',
	'base',
	'bind',
	'clm',
	'cmd',
	'con',
	'conv',
	'dec',
	'evd',
	'evt',
	'int',
	'obs',
	'plan',
	'pol',
	'pwu',
	'step',
	'trace'
]);

const RULE_SEEDS: readonly RuleSeed[] = [
	{
		conditions: [
			GTE('floorGateCallsites', 1),
			NEQF('aiProducedFalseCallsites', 'floorGateCallsites'),
			EQ('executionFloorWriterSites', 0)
		],
		factSpecs: [
			N('aiProducedFalseCallsites'),
			N('executionFloorWriterSites'),
			N('floorGateCallsites')
		],
		findingId: 1,
		findingText:
			'The execution-plane floor gate can never block: it is called with aiProduced:false and no production code ever records a floor for an execution step, so the early-return in floorGateBlock always fires.',
		guideReference: '§8.4:837',
		mutationFactKey: 'aiProducedFalseCallsites',
		nearbyNegativeFacts: {
			aiProducedFalseCallsites: 0,
			executionFloorWriterSites: 1,
			floorGateCallsites: 1
		},
		positiveFacts: {
			aiProducedFalseCallsites: 1,
			executionFloorWriterSites: 0,
			floorGateCallsites: 1
		},
		protectedProperty: 'Execution-floor gate is reachable with non-vacuous recorded floor state.',
		rationale:
			'Closed call and data-flow populations expose arguments that force the early return and the absence of a production floor writer.',
		sourceReference: 'packages/rph-application/src/handlers/execution.ts:225',
		subjectClass: 'EXECUTION_FLOOR_GATE_CALL_AND_WRITER_POPULATION',
		technicalSeverity: 'CRITICAL',
		title: 'Execution floor gate vacuity'
	},
	{
		conditions: [
			GTE('expectedRevisionDeclarations', 1),
			GTE('stateUpdateHandlers', 1),
			EQ('expectedRevisionProductionReads', 0)
		],
		factSpecs: [
			N('expectedRevisionDeclarations'),
			N('expectedRevisionProductionReads'),
			N('stateUpdateHandlers')
		],
		findingId: 3,
		findingText:
			"The Command envelope's `expectedRevision` is never read anywhere in the engine — optimistic concurrency against the client's expected version does not exist, and every update is silent last-write-wins",
		guideReference: '§9.3:1228',
		mutationFactKey: 'expectedRevisionProductionReads',
		nearbyNegativeFacts: {
			expectedRevisionDeclarations: 1,
			expectedRevisionProductionReads: 1,
			stateUpdateHandlers: 1
		},
		positiveFacts: {
			expectedRevisionDeclarations: 1,
			expectedRevisionProductionReads: 0,
			stateUpdateHandlers: 1
		},
		protectedProperty:
			'Declared optimistic-concurrency revision participates in the production update pipeline.',
		rationale:
			'A declared field plus a closed zero-reference population identifies the missing production consumer.',
		sourceReference: 'packages/rph-application/src/handlers/kit.ts:375',
		subjectClass: 'COMMAND_EXPECTED_REVISION_SYMBOL_USE_POPULATION',
		technicalSeverity: 'CRITICAL',
		title: 'Command expectedRevision is unread'
	},
	{
		conditions: [
			GTE('eventRegistryEntries', 1),
			GTE('productionEventEmissionSites', 1),
			EQ('eventRegistryValidationConsumers', 0)
		],
		factSpecs: [
			N('eventRegistryEntries'),
			N('eventRegistryValidationConsumers'),
			N('productionEventEmissionSites')
		],
		findingId: 5,
		findingText:
			'The generated EVENTS registry is never used — emitted Event payloads are validated against nothing, making the event half of the canonical contract documented-only',
		guideReference: '§9.4:1241',
		mutationFactKey: 'eventRegistryValidationConsumers',
		nearbyNegativeFacts: {
			eventRegistryEntries: 1,
			eventRegistryValidationConsumers: 1,
			productionEventEmissionSites: 1
		},
		positiveFacts: {
			eventRegistryEntries: 1,
			eventRegistryValidationConsumers: 0,
			productionEventEmissionSites: 1
		},
		protectedProperty:
			'Generated event registry has a production validation consumer for emitted events.',
		rationale:
			'Registry, emission, and resolved-consumer populations distinguish an unused registry from an empty or unused subsystem.',
		sourceReference: 'packages/rph-application/src/handlers/kit.ts:186',
		subjectClass: 'EVENT_REGISTRY_CONSUMER_COVERAGE',
		technicalSeverity: 'CRITICAL',
		title: 'Generated event registry has no production consumer'
	},
	{
		conditions: [
			GTE('propertyP4Tests', 1),
			EQ('kernelProductionCallers', 0),
			GTE('liveFloorHardcodedValidEvidenceInputs', 1)
		],
		factSpecs: [
			N('kernelProductionCallers'),
			N('liveFloorHardcodedValidEvidenceInputs'),
			N('propertyP4Tests')
		],
		findingId: 6,
		findingText:
			'Property P4 is proven generatively against a kernel that no enforcement path calls, while the real floor hardcodes its Evidence inputs to "valid" — invalid Evidence can never be detected at the gate',
		guideReference: '§14.2:2292',
		mutationFactKey: 'kernelProductionCallers',
		nearbyNegativeFacts: {
			kernelProductionCallers: 1,
			liveFloorHardcodedValidEvidenceInputs: 0,
			propertyP4Tests: 1
		},
		positiveFacts: {
			kernelProductionCallers: 0,
			liveFloorHardcodedValidEvidenceInputs: 1,
			propertyP4Tests: 1
		},
		protectedProperty:
			'Property test exercises the production enforcement kernel and live evidence validity is derived.',
		rationale:
			'Test-to-kernel reachability and live-gate call facts expose a tested-but-disconnected kernel.',
		sourceReference: 'packages/rph-assurance/src/floor.ts:323',
		subjectClass: 'PROPERTY_TEST_TO_LIVE_GATE_REACHABILITY',
		technicalSeverity: 'CRITICAL',
		title: 'P4 tests a disconnected kernel'
	},
	{
		conditions: [
			GTE('documentedAuthorizerPortRequirements', 1),
			EQ('exportedAuthorizerPortDeclarations', 0)
		],
		factSpecs: [N('documentedAuthorizerPortRequirements'), N('exportedAuthorizerPortDeclarations')],
		findingId: 8,
		findingText:
			"The authorizer port that rph-domain's authority model documents as its seam does not exist",
		guideReference: '§13.3:2219',
		mutationFactKey: 'exportedAuthorizerPortDeclarations',
		nearbyNegativeFacts: {
			documentedAuthorizerPortRequirements: 1,
			exportedAuthorizerPortDeclarations: 1
		},
		positiveFacts: {
			documentedAuthorizerPortRequirements: 1,
			exportedAuthorizerPortDeclarations: 0
		},
		protectedProperty: 'Required authorizer seam is present in the exported port surface.',
		rationale:
			'An independently derived required-port population is compared with resolved exported declarations.',
		sourceReference: 'packages/rph-ports/src/index.ts:2',
		subjectClass: 'REQUIRED_AND_EXPORTED_PORT_SURFACE',
		technicalSeverity: 'CRITICAL',
		title: 'Required authorizer port is absent'
	},
	{
		conditions: [
			GTE('targetSchemaDeclarations', 1),
			GTE('postSpreadWeakerRedeclarations', 1),
			GTE('constrainedEnvelopeFieldsOverridden', 1)
		],
		factSpecs: [
			N('constrainedEnvelopeFieldsOverridden'),
			N('postSpreadWeakerRedeclarations'),
			N('targetSchemaDeclarations')
		],
		findingId: 11,
		findingText:
			'AssurancePolicyDefinitionSchema re-declares `id` and `semanticVersion` after the envelope spread, silently overriding RphIdSchema and NonNegativeIntSchema with unconstrained primitives',
		guideReference: '§5.3:404',
		mutationFactKey: 'postSpreadWeakerRedeclarations',
		nearbyNegativeFacts: {
			constrainedEnvelopeFieldsOverridden: 0,
			postSpreadWeakerRedeclarations: 0,
			targetSchemaDeclarations: 1
		},
		positiveFacts: {
			constrainedEnvelopeFieldsOverridden: 2,
			postSpreadWeakerRedeclarations: 2,
			targetSchemaDeclarations: 1
		},
		protectedProperty:
			'Schema spread constraints are not weakened by later property redeclarations.',
		rationale:
			'Ordered AST property declarations and schema constraint identities establish a post-spread weakening.',
		sourceReference: 'packages/rph-contracts/src/objects.ts:368',
		subjectClass: 'SCHEMA_SPREAD_AND_POST_SPREAD_PROPERTY_DECLARATIONS',
		technicalSeverity: 'CRITICAL',
		title: 'Schema spread constraints are overridden'
	},
	{
		conditions: [
			GTE('identityProvenanceFloorCallsites', 1),
			EQ('identityProvenanceCriterionArguments', 5),
			EQ('literalTrueCriterionArguments', 5)
		],
		factSpecs: [
			N('identityProvenanceCriterionArguments'),
			N('identityProvenanceFloorCallsites'),
			N('literalTrueCriterionArguments')
		],
		findingId: 12,
		findingText:
			'Floor step 2 (identity/provenance/trace) is fed five literal `true` constants, so all five of its mandatory criteria are structurally incapable of evaluating NOT_MET.',
		guideReference: '§8.4:840',
		mutationFactKey: 'literalTrueCriterionArguments',
		nearbyNegativeFacts: {
			identityProvenanceCriterionArguments: 5,
			identityProvenanceFloorCallsites: 1,
			literalTrueCriterionArguments: 0
		},
		positiveFacts: {
			identityProvenanceCriterionArguments: 5,
			identityProvenanceFloorCallsites: 1,
			literalTrueCriterionArguments: 5
		},
		protectedProperty:
			'Identity, provenance, and trace criteria are derived rather than literal truth values.',
		rationale:
			'AST argument-to-literal identity proves all five live criterion inputs are hardcoded true.',
		sourceReference: 'apps/rph-demo/src/lib/server/floor.ts:114',
		subjectClass: 'IDENTITY_PROVENANCE_FLOOR_CALL_ARGUMENTS',
		technicalSeverity: 'BLOCKING',
		title: 'Five floor criteria are literal true'
	},
	{
		conditions: [
			GTE('validatePwaHandlers', 1),
			GTE('validatedStatusWrites', 1),
			EQ('validationEvaluatorCalls', 0)
		],
		factSpecs: [
			N('validatePwaHandlers'),
			N('validatedStatusWrites'),
			N('validationEvaluatorCalls')
		],
		findingId: 17,
		findingText:
			'ValidatePwa performs no validation at all — VALIDATED is a pure status label, so a PWA reaches PUBLISHED with no recursive-composition or assurance-assignment proof',
		guideReference: '§11.6:1639',
		mutationFactKey: 'validationEvaluatorCalls',
		nearbyNegativeFacts: {
			validatePwaHandlers: 1,
			validatedStatusWrites: 1,
			validationEvaluatorCalls: 1
		},
		positiveFacts: {
			validatePwaHandlers: 1,
			validatedStatusWrites: 1,
			validationEvaluatorCalls: 0
		},
		protectedProperty: 'ValidatePwa invokes a validation evaluator before writing VALIDATED.',
		rationale:
			'Closed handler call and effect populations distinguish a pure status write from a validated transition.',
		sourceReference: 'packages/rph-application/src/handlers/pwa-authoring.ts:412',
		subjectClass: 'VALIDATE_PWA_HANDLER_CALL_AND_EFFECT_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'ValidatePwa is a pure status label'
	},
	{
		conditions: [GTE('pwaAuthoringMutationHandlers', 1), EQ('semanticVersionProductionWrites', 0)],
		factSpecs: [N('pwaAuthoringMutationHandlers'), N('semanticVersionProductionWrites')],
		findingId: 18,
		findingText:
			"The PWA's semanticVersion is never bumped by any authoring command, so the floor gate's version binding is inert and a satisfied floor authorizes publication of a graph edited after the review",
		guideReference: '§11.7.7:2055',
		mutationFactKey: 'semanticVersionProductionWrites',
		nearbyNegativeFacts: { pwaAuthoringMutationHandlers: 1, semanticVersionProductionWrites: 1 },
		positiveFacts: { pwaAuthoringMutationHandlers: 1, semanticVersionProductionWrites: 0 },
		protectedProperty: 'Every semantically mutating PWA authoring path advances semanticVersion.',
		rationale:
			'Closed authoring-handler and field-writer populations reveal a missing semantic-version writer.',
		sourceReference: 'packages/rph-application/src/handlers/pwa-authoring.ts:329',
		subjectClass: 'PWA_AUTHORING_MUTATION_AND_SEMANTIC_VERSION_WRITER_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'PWA authoring has no semanticVersion writer'
	},
	{
		conditions: [
			SETEQ('requiredPropertyIds', PROPERTY_IDS),
			DISJOINT('propertyTestIds', OMITTED_PROPERTY_IDS),
			DISJOINT('gatePropertyIds', OMITTED_PROPERTY_IDS)
		],
		factSpecs: [S('gatePropertyIds'), S('propertyTestIds'), S('requiredPropertyIds')],
		findingId: 22,
		findingText:
			"Properties P9–P12 have no property test, and the conformance gate hardcodes the property universe at exactly eight — so the gate passes green by defining the guide's mandatory properties out of scope",
		guideReference: '§14.2:2304',
		mutationFactKey: 'propertyTestIds',
		nearbyNegativeFacts: {
			gatePropertyIds: PROPERTY_IDS,
			propertyTestIds: PROPERTY_IDS,
			requiredPropertyIds: PROPERTY_IDS
		},
		positiveFacts: {
			gatePropertyIds: FIRST_EIGHT_PROPERTY_IDS,
			propertyTestIds: FIRST_EIGHT_PROPERTY_IDS,
			requiredPropertyIds: PROPERTY_IDS
		},
		protectedProperty:
			'The independently derived mandatory property universe is covered by tests and the conformance gate.',
		rationale:
			'Independent required, test, and gate sets expose mandatory properties omitted from a hard-coded universe.',
		sourceReference: 'packages/rph-domain/src/conformance.test.ts:36',
		subjectClass: 'REQUIRED_PROPERTY_TEST_AND_GATE_UNIVERSES',
		technicalSeverity: 'BLOCKING',
		title: 'P9-P12 are excluded from the conformance universe'
	},
	{
		conditions: [
			GTE('mutationCatalogEntries', 1),
			GTE('catalogNonemptyAssertions', 1),
			EQ('runnableMutationGateEntries', 0)
		],
		factSpecs: [
			N('catalogNonemptyAssertions'),
			N('mutationCatalogEntries'),
			N('runnableMutationGateEntries')
		],
		findingId: 23,
		findingText:
			"14.4's mutation gate does not exist as a runnable thing; the only assertion over the mutation catalog is that a static JSON array is non-empty",
		guideReference: '§14.4:2352',
		mutationFactKey: 'runnableMutationGateEntries',
		nearbyNegativeFacts: {
			catalogNonemptyAssertions: 1,
			mutationCatalogEntries: 1,
			runnableMutationGateEntries: 1
		},
		positiveFacts: {
			catalogNonemptyAssertions: 1,
			mutationCatalogEntries: 1,
			runnableMutationGateEntries: 0
		},
		protectedProperty: 'Mutation catalog entries are executed by a runnable failing gate.',
		rationale:
			'Test and call populations distinguish executable mutation discrimination from a static non-empty assertion.',
		sourceReference: 'packages/rph-domain/src/conformance.test.ts:49',
		subjectClass: 'MUTATION_CATALOG_ASSERTION_AND_EXECUTION_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'Mutation gate is only a static list assertion'
	},
	{
		conditions: [
			GTE('assessmentCreationSites', 1),
			SETEQ('fieldsInitializedEmpty', [
				'evidenceConsidered',
				'rejectedEvidence',
				'residualUncertainty'
			]),
			DISJOINT('fieldsWithNonemptyProductionWriters', [
				'evidenceConsidered',
				'rejectedEvidence',
				'residualUncertainty'
			])
		],
		factSpecs: [
			N('assessmentCreationSites'),
			S('fieldsInitializedEmpty'),
			S('fieldsWithNonemptyProductionWriters')
		],
		findingId: 28,
		findingText:
			'The Assessment aggregate hardcodes evidenceConsidered, rejectedEvidence and residualUncertainty to empty at creation and never fills them.',
		guideReference: '§5.6:454',
		mutationFactKey: 'fieldsWithNonemptyProductionWriters',
		nearbyNegativeFacts: {
			assessmentCreationSites: 1,
			fieldsInitializedEmpty: ['evidenceConsidered', 'rejectedEvidence', 'residualUncertainty'],
			fieldsWithNonemptyProductionWriters: ['evidenceConsidered']
		},
		positiveFacts: {
			assessmentCreationSites: 1,
			fieldsInitializedEmpty: ['evidenceConsidered', 'rejectedEvidence', 'residualUncertainty'],
			fieldsWithNonemptyProductionWriters: []
		},
		protectedProperty:
			'Assessment evidence and uncertainty fields have reachable non-empty production writers.',
		rationale:
			'Field birth and writer closure establish that semantically required fields remain permanently empty.',
		sourceReference: 'packages/rph-application/src/handlers/assurance.ts:317',
		subjectClass: 'ASSESSMENT_FIELD_BIRTH_AND_WRITER_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'Assessment evidence fields have no writer'
	},
	{
		conditions: [
			GTE('rphIdValidatorDeclarations', 1),
			GTE('shapeOnlyValidators', 1),
			BEQ('registeredPrefixMembershipEnforced', false)
		],
		factSpecs: [
			B('registeredPrefixMembershipEnforced'),
			N('rphIdValidatorDeclarations'),
			N('shapeOnlyValidators')
		],
		findingId: 30,
		findingText:
			'RphIdSchema validates id shape but never the registered prefix — `banana_<ULID>` is a valid id everywhere in the system',
		guideReference: '§5.3:413',
		mutationFactKey: 'registeredPrefixMembershipEnforced',
		nearbyNegativeFacts: {
			registeredPrefixMembershipEnforced: true,
			rphIdValidatorDeclarations: 1,
			shapeOnlyValidators: 0
		},
		positiveFacts: {
			registeredPrefixMembershipEnforced: false,
			rphIdValidatorDeclarations: 1,
			shapeOnlyValidators: 1
		},
		protectedProperty: 'Identifier validation enforces membership in the registered prefix set.',
		rationale:
			'The schema predicate is compared with the independently derived registered prefix set.',
		sourceReference: 'packages/rph-contracts/src/ids.ts:42',
		subjectClass: 'RPH_IDENTIFIER_SCHEMA_AND_PREFIX_REGISTRY',
		technicalSeverity: 'BLOCKING',
		title: 'Identifier schema accepts unregistered prefixes'
	},
	{
		conditions: [
			GTE('idBearingPayloadFields', 1),
			NEQF('bareStringIdPayloadFields', 'idBearingPayloadFields'),
			EQ('prefixedIdPayloadFields', 0)
		],
		factSpecs: [
			N('bareStringIdPayloadFields'),
			N('idBearingPayloadFields'),
			N('prefixedIdPayloadFields')
		],
		findingId: 31,
		findingText:
			'All 215 id-bearing Command/Event payload fields are bare z.string(); the prefixed-ULID rule survives only as a vocab "note" that the generator drops',
		guideReference: '§5.3:413',
		mutationFactKey: 'prefixedIdPayloadFields',
		nearbyNegativeFacts: {
			bareStringIdPayloadFields: 0,
			idBearingPayloadFields: 215,
			prefixedIdPayloadFields: 215
		},
		positiveFacts: {
			bareStringIdPayloadFields: 215,
			idBearingPayloadFields: 215,
			prefixedIdPayloadFields: 0
		},
		protectedProperty:
			'Generated identifier-bearing payload fields retain the prefixed-ULID schema constraint.',
		rationale:
			'AST and schema comparison accounts the complete id-bearing payload-field population and its validators.',
		sourceReference: 'packages/rph-contracts/src/messages.ts:36',
		subjectClass: 'GENERATED_ID_BEARING_PAYLOAD_FIELD_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'Generated ID fields use unconstrained strings'
	},
	{
		conditions: [
			GTE('independentRegistrySources', 2),
			SETNEQF('codePrefixSet', 'governedPrefixSet')
		],
		factSpecs: [S('codePrefixSet'), S('governedPrefixSet'), N('independentRegistrySources')],
		findingId: 32,
		findingText:
			'ID_PREFIXES omits three prefixes §5.3 explicitly registers (pwa, pwut, und) and adds one it never registers (conv); the fidelity test cannot detect either because it compares code to the vocab, not to the guide',
		guideReference: '§5.3:413',
		mutationFactKey: 'codePrefixSet',
		nearbyNegativeFacts: {
			codePrefixSet: GOVERNED_ID_PREFIXES,
			governedPrefixSet: GOVERNED_ID_PREFIXES,
			independentRegistrySources: 2
		},
		positiveFacts: {
			codePrefixSet: HISTORICAL_CODE_ID_PREFIXES,
			governedPrefixSet: GOVERNED_ID_PREFIXES,
			independentRegistrySources: 2
		},
		protectedProperty: 'Code prefix registry equals an independently derived governed registry.',
		rationale:
			'Set fidelity uses two independent origins so code and its generated vocabulary cannot self-confirm.',
		sourceReference: 'packages/rph-contracts/src/objects.ts:666',
		subjectClass: 'GOVERNED_AND_IMPLEMENTED_IDENTIFIER_PREFIX_REGISTRIES',
		technicalSeverity: 'BLOCKING',
		title: 'ID_PREFIXES differs from the governed registry'
	},
	{
		conditions: [
			GTE('markPwuReadyTransitions', 1),
			EQ('readinessGuardCalls', 0),
			EQ('intentStatusGuardCalls', 0)
		],
		factSpecs: [
			N('intentStatusGuardCalls'),
			N('markPwuReadyTransitions'),
			N('readinessGuardCalls')
		],
		findingId: 34,
		findingText:
			'Readiness is neither computed nor verified: MarkPwuReady advances SHAPING→READY unconditionally, ignoring both the readiness contract and the Intent-status guard.',
		guideReference: '§6.1:466',
		mutationFactKey: 'readinessGuardCalls',
		nearbyNegativeFacts: {
			intentStatusGuardCalls: 1,
			markPwuReadyTransitions: 1,
			readinessGuardCalls: 1
		},
		positiveFacts: {
			intentStatusGuardCalls: 0,
			markPwuReadyTransitions: 1,
			readinessGuardCalls: 0
		},
		protectedProperty: 'MarkPwuReady is dominated by readiness and Intent-status guards.',
		rationale:
			'Handler call and transition-effect populations expose an unconditional state advance.',
		sourceReference: 'packages/rph-application/src/handlers/pwu.ts:178',
		subjectClass: 'MARK_PWU_READY_GUARD_AND_TRANSITION_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'MarkPwuReady transition is unconditional'
	},
	{
		conditions: [GTE('rootReadinessTransitionSites', 1), EQ('rootReadinessIntentGuardCalls', 0)],
		factSpecs: [N('rootReadinessIntentGuardCalls'), N('rootReadinessTransitionSites')],
		findingId: 35,
		findingText:
			"6.5's root-readiness Intent guard is prose-only: no code path checks Intent status before READY or before satisfaction.",
		guideReference: '§6.5:615',
		mutationFactKey: 'rootReadinessIntentGuardCalls',
		nearbyNegativeFacts: { rootReadinessIntentGuardCalls: 1, rootReadinessTransitionSites: 1 },
		positiveFacts: { rootReadinessIntentGuardCalls: 0, rootReadinessTransitionSites: 1 },
		protectedProperty:
			'Root READY and satisfaction transitions are dominated by an Intent-status guard.',
		rationale:
			'Closed transition and resolved guard-call populations expose the absent production guard path.',
		sourceReference: 'packages/rph-domain/src/pwuGuards.ts:21',
		subjectClass: 'ROOT_READINESS_TRANSITION_AND_INTENT_GUARD_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'Root-readiness Intent guard has no call path'
	},
	{
		conditions: [
			GTE('executionCommandHandlers', 1),
			GTE('runtimeBindingIdPayloadFields', 1),
			EQ('runtimeBindingIdProductionReads', 0),
			EQ('authorizedBindingCompositeGateCalls', 0)
		],
		factSpecs: [
			N('authorizedBindingCompositeGateCalls'),
			N('executionCommandHandlers'),
			N('runtimeBindingIdPayloadFields'),
			N('runtimeBindingIdProductionReads')
		],
		findingId: 36,
		findingText:
			"Execution does not require authorized Runtime Bindings: the composite gate exists in the domain kernel but no Command handler calls it, and the payload's binding ids are discarded.",
		guideReference: '§6.5:618',
		mutationFactKey: 'authorizedBindingCompositeGateCalls',
		nearbyNegativeFacts: {
			authorizedBindingCompositeGateCalls: 1,
			executionCommandHandlers: 1,
			runtimeBindingIdPayloadFields: 1,
			runtimeBindingIdProductionReads: 1
		},
		positiveFacts: {
			authorizedBindingCompositeGateCalls: 0,
			executionCommandHandlers: 1,
			runtimeBindingIdPayloadFields: 1,
			runtimeBindingIdProductionReads: 0
		},
		protectedProperty:
			'Execution handlers consume binding IDs and call the authorized Runtime Binding composite gate.',
		rationale:
			'Payload-to-handler data flow and call reachability jointly expose both dropped IDs and an uncalled gate.',
		sourceReference: 'packages/rph-application/src/handlers/execution.ts:193',
		subjectClass: 'EXECUTION_BINDING_PAYLOAD_FLOW_AND_GATE_CALL_POPULATION',
		technicalSeverity: 'BLOCKING',
		title: 'Runtime binding IDs are dropped and gate uncalled'
	},
	{
		conditions: [
			GTE('liveFloorResultSites', 1),
			GTE('literalTrueEvidenceExistsAssignments', 1),
			GTE('admissibilityFunctionDeclarations', 1),
			EQ('productionAdmissibilityCalls', 0)
		],
		factSpecs: [
			N('admissibilityFunctionDeclarations'),
			N('literalTrueEvidenceExistsAssignments'),
			N('liveFloorResultSites'),
			N('productionAdmissibilityCalls')
		],
		findingId: 39,
		findingText:
			'Evidence admissibility is never evaluated at the floor: `evidenceExists: true` is a literal at the result boundary and the implemented 8-condition admissibility function has no production caller.',
		guideReference: '§8.11:1027',
		mutationFactKey: 'productionAdmissibilityCalls',
		nearbyNegativeFacts: {
			admissibilityFunctionDeclarations: 1,
			literalTrueEvidenceExistsAssignments: 0,
			liveFloorResultSites: 1,
			productionAdmissibilityCalls: 1
		},
		positiveFacts: {
			admissibilityFunctionDeclarations: 1,
			literalTrueEvidenceExistsAssignments: 1,
			liveFloorResultSites: 1,
			productionAdmissibilityCalls: 0
		},
		protectedProperty:
			'Live floor derives evidence existence from the production admissibility evaluator.',
		rationale:
			'Resolved call closure plus literal AST facts distinguish an implemented but disconnected admissibility function.',
		sourceReference: 'packages/rph-assurance/src/floor.ts:322',
		subjectClass: 'EVIDENCE_ADMISSIBILITY_DECLARATION_CALL_AND_RESULT_POPULATION',
		technicalSeverity: 'MATERIAL',
		title: 'Evidence admissibility is disconnected from the floor'
	},
	{
		conditions: [
			GTE('validatorBoundarySites', 1),
			GTE('literalTrueValidatorSchemaChecks', 1),
			EQ('validatorSchemaValidationCalls', 0)
		],
		factSpecs: [
			N('literalTrueValidatorSchemaChecks'),
			N('validatorBoundarySites'),
			N('validatorSchemaValidationCalls')
		],
		findingId: 40,
		findingText:
			'The Validator-result schema check at the assurance boundary is the literal `true`, so RPH_VALIDATOR_OUTPUT_INVALID can never be raised by the floor.',
		guideReference: '§8.13:1076',
		mutationFactKey: 'validatorSchemaValidationCalls',
		nearbyNegativeFacts: {
			literalTrueValidatorSchemaChecks: 0,
			validatorBoundarySites: 1,
			validatorSchemaValidationCalls: 1
		},
		positiveFacts: {
			literalTrueValidatorSchemaChecks: 1,
			validatorBoundarySites: 1,
			validatorSchemaValidationCalls: 0
		},
		protectedProperty: 'Validator output is schema-validated at the live assurance boundary.',
		rationale:
			'Direct AST facts establish a literal success value and absence of a schema-validation call at the boundary.',
		sourceReference: 'packages/rph-assurance/src/floor.ts:318',
		subjectClass: 'VALIDATOR_RESULT_BOUNDARY_SCHEMA_CHECK_POPULATION',
		technicalSeverity: 'MATERIAL',
		title: 'Validator-output schema check is literal true'
	},
	{
		conditions: [
			GTE('governedTransitionHandlers', 1),
			EQ('pipelineAuthorityStages', 0),
			GTE('handlersWithoutAuthorityChecks', 1)
		],
		factSpecs: [
			N('governedTransitionHandlers'),
			N('handlersWithoutAuthorityChecks'),
			N('pipelineAuthorityStages')
		],
		findingId: 49,
		findingText:
			'Authority is not a pipeline stage — it is opt-in per handler, so most governed transitions are evaluated with no authority check at all',
		guideReference: '§9.3:1213',
		mutationFactKey: 'pipelineAuthorityStages',
		nearbyNegativeFacts: {
			governedTransitionHandlers: 1,
			handlersWithoutAuthorityChecks: 0,
			pipelineAuthorityStages: 1
		},
		positiveFacts: {
			governedTransitionHandlers: 1,
			handlersWithoutAuthorityChecks: 1,
			pipelineAuthorityStages: 0
		},
		protectedProperty:
			'Authority validation is a mandatory stage for the closed governed-transition handler population.',
		rationale:
			'Pipeline and handler call/taint coverage exposes authority enforcement that is optional rather than dominating.',
		sourceReference: 'packages/rph-application/src/command-bus.ts:111',
		subjectClass: 'COMMAND_PIPELINE_AND_GOVERNED_HANDLER_AUTHORITY_COVERAGE',
		technicalSeverity: 'MATERIAL',
		title: 'Authority checking is opt-in per handler'
	},
	{
		conditions: [GTE('activePlanGuardReads', 1), EQ('activePlanProductionWriters', 0)],
		factSpecs: [N('activePlanGuardReads'), N('activePlanProductionWriters')],
		findingId: 70,
		findingText:
			'The one-active-plan-per-PWU guard is vacuous: it reads a PWU field that no handler ever writes, so otherActivePlanExists is always false.',
		guideReference: '§6.5:617',
		mutationFactKey: 'activePlanProductionWriters',
		nearbyNegativeFacts: { activePlanGuardReads: 1, activePlanProductionWriters: 1 },
		positiveFacts: { activePlanGuardReads: 1, activePlanProductionWriters: 0 },
		protectedProperty:
			'Fields read by the one-active-plan guard have a reachable production writer.',
		rationale:
			'Symbol/read-write closure identifies a guard input whose writer population is empty.',
		sourceReference: 'packages/rph-application/src/handlers/execution.ts:87',
		subjectClass: 'ACTIVE_PLAN_GUARD_READ_AND_PRODUCTION_WRITER_POPULATION',
		technicalSeverity: 'MATERIAL',
		title: 'One-active-plan guard reads an unwritten field'
	},
	{
		conditions: [
			GTE('versionDriftComparisonCalls', 1),
			GTE('aliasedReviewedCandidateArgumentPairs', 1),
			EQ('independentReviewedCandidateArgumentPairs', 0)
		],
		factSpecs: [
			N('aliasedReviewedCandidateArgumentPairs'),
			N('independentReviewedCandidateArgumentPairs'),
			N('versionDriftComparisonCalls')
		],
		findingId: 73,
		findingText:
			"PromoteBaseline's version-drift check is a tautology: reviewedItems is passed the same array as candidateItems, so a semantically changed item can never mismatch.",
		guideReference: '§6.5:621',
		mutationFactKey: 'aliasedReviewedCandidateArgumentPairs',
		nearbyNegativeFacts: {
			aliasedReviewedCandidateArgumentPairs: 0,
			independentReviewedCandidateArgumentPairs: 1,
			versionDriftComparisonCalls: 1
		},
		positiveFacts: {
			aliasedReviewedCandidateArgumentPairs: 1,
			independentReviewedCandidateArgumentPairs: 0,
			versionDriftComparisonCalls: 1
		},
		protectedProperty:
			'Version-drift comparison receives independently derived reviewed and candidate item populations.',
		rationale:
			'Argument-origin data flow establishes that both sides of a comparison share the same semantic origin.',
		sourceReference: 'packages/rph-application/src/handlers/governance.ts:277',
		subjectClass: 'BASELINE_VERSION_DRIFT_CALL_ARGUMENT_ORIGINS',
		technicalSeverity: 'MATERIAL',
		title: 'Version-drift comparison aliases both inputs'
	}
];

const CAPABILITY_SURFACE: Readonly<
	Record<HarmonizationCapabilityCode, HarmonizationRuleProjectionSurface>
> = {
	AST: 'SEMANTIC_AST',
	CALL: 'CALL_GRAPH',
	DFG: 'READ_WRITE_ACCESS_GRAPH',
	FSM: 'SEMANTIC_AST',
	NORM: 'NORMATIVE_REGISTRY',
	SCHEMA: 'SCHEMA_PROJECTION',
	SYM: 'SEMANTIC_SYMBOLS',
	TAINT: 'TAINT_PROJECTION',
	TEST: 'TEST_CENSUS',
	TRACE: 'CALL_GRAPH'
};

function deepFreezeConstructed<T>(value: T): T {
	if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
	for (const key of Reflect.ownKeys(value as object)) {
		const descriptor = Object.getOwnPropertyDescriptor(value as object, key);
		if (descriptor && 'value' in descriptor) deepFreezeConstructed(descriptor.value);
	}
	return Object.freeze(value);
}

function canonicalStringSet(values: readonly string[]): readonly string[] {
	return Object.freeze([...values].sort());
}

function normalizedFixtureFacts(
	facts: Readonly<Record<string, HarmonizationRuleFactValue>>
): Readonly<Record<string, HarmonizationRuleFactValue>> {
	return Object.freeze(
		Object.fromEntries(
			Object.entries(facts)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, value]) => [key, Array.isArray(value) ? canonicalStringSet(value) : value])
		)
	);
}

function materializeRuleProfiles(): readonly HarmonizationFirstIncrementRuleProfile[] {
	if (RULE_SEEDS.length !== 23)
		throw new Error('Exactly 23 first-increment rule seeds are required.');
	const expectedIds = [...HARMONIZATION_FIRST_INCREMENT_FINDING_IDS];
	for (let index = 0; index < expectedIds.length; index += 1) {
		if (RULE_SEEDS[index]?.findingId !== expectedIds[index])
			throw new Error('First-increment rule seeds must use the exact governed finding ID order.');
	}
	return Object.freeze(
		RULE_SEEDS.map((seed) => {
			const baseline = HARMONIZATION_BENCHMARK_ROWS[seed.findingId - 1]!;
			if (
				baseline.classification === 'HYBRID_RUNTIME' ||
				baseline.classification === 'NORMATIVE_HUMAN'
			)
				throw new Error(`First-increment rule ${seed.findingId} is not statically allocated.`);
			const ruleId = `JAN-CSAA-HARMONIZATION-${String(seed.findingId).padStart(3, '0')}`;
			const payload = {
				applicabilityPredicate: 'DECLARED_SUBJECT_POPULATION_IS_NONEMPTY' as const,
				automatedRemediation: 'DISABLED' as const,
				classification: baseline.classification,
				confidencePolicy:
					'CONCLUSIVE_ONLY_FOR_CURRENT_CLOSED_POPULATION_WITH_ALL_REQUIRED_SURFACES' as const,
				conditions: seed.conditions,
				evaluatorReference: `harmonization-first-increment/${seed.findingId}`,
				factSpecs: [...seed.factSpecs].sort((left, right) =>
					left.key < right.key ? -1 : left.key > right.key ? 1 : 0
				),
				findingFingerprintFields: [
					'ruleId',
					'ruleVersion',
					'frozenSubjectId',
					'populationSha256',
					'observationSha256'
				] as const,
				findingId: seed.findingId,
				findingText: seed.findingText,
				fixtureReferences: {
					boundary: `${ruleId}/boundary`,
					mutation: `${ruleId}/mutation`,
					nearbyNegative: `${ruleId}/nearby-negative`,
					nonVacuity: `${ruleId}/non-vacuity`,
					positive: `${ruleId}/positive`
				},
				guideReference: seed.guideReference,
				minimumCompleteness: 'CLOSED_DECLARED_POPULATION' as const,
				benchmarkSourceReference: seed.sourceReference,
				protectedProperty: seed.protectedProperty,
				projectionContract: 'CALLER_SUPPLIED_STRUCTURAL_OBSERVATION' as const,
				projectionRegistration: 'UNREGISTERED' as const,
				rationale: seed.rationale,
				referenceCurrentness:
					'HISTORICAL_EXACT_BENCHMARK_ROW_NOT_RECHECKED_AS_CURRENT_SOURCE' as const,
				remediationGuidance: 'NONE_MECHANICALLY_SAFE_DECLARED' as const,
				requiredCapabilities: baseline.minimumCapabilities,
				requiredProjectionSurfaces: Object.freeze(
					[
						...new Set(
							baseline.minimumCapabilities.map((capability) => CAPABILITY_SURFACE[capability])
						)
					].sort()
				),
				ruleId,
				ruleVersion: '0.1.0' as const,
				schemaVersion: HARMONIZATION_FIRST_INCREMENT_RULE_PROFILE_SCHEMA_VERSION,
				subjectClass: seed.subjectClass,
				suppressionBoundary: 'OUTSIDE_ANALYZER_REQUIRES_SEPARATE_GOVERNED_RECORD' as const,
				technicalSeverity: seed.technicalSeverity,
				title: seed.title
			};
			const ruleContentSha256 = canonicalSemanticJsonWitness(payload).sha256;
			return deepFreezeConstructed({ ...payload, ruleContentSha256 });
		})
	);
}

export const HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES = materializeRuleProfiles();
export const HARMONIZATION_FIRST_INCREMENT_RULE_SET_WITNESS = Object.freeze(
	canonicalSemanticJsonWitness({
		ruleProfiles: HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES,
		ruleSetVersion: HARMONIZATION_FIRST_INCREMENT_RULE_SET_VERSION
	})
);

export interface HarmonizationRuleObservationFact {
	readonly key: string;
	readonly value: HarmonizationRuleFactValue;
}

export interface HarmonizationRuleProjectionProvenance {
	readonly provenanceId: string;
	readonly sha256: string;
	readonly sourceReference: string;
	readonly surface: HarmonizationRuleProjectionSurface;
	readonly version: string;
}

export interface HarmonizationFirstIncrementEvaluationRequest {
	readonly availableCapabilities: readonly HarmonizationCapabilityCode[];
	readonly currentness: {
		readonly frozenSubjectId: string;
		readonly invalidationDependencyIds: readonly string[];
		readonly sourceSha256: string;
		readonly state: 'CALLER_DECLARED_CURRENT' | 'CALLER_DECLARED_STALE';
	};
	readonly evaluationId: string;
	readonly executionDisposition: 'NOT_RUN' | 'RUN';
	readonly facts: readonly HarmonizationRuleObservationFact[];
	readonly operationVersion: typeof HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION;
	readonly population: {
		readonly closure: 'CLOSED' | 'OPEN';
		readonly count: number;
		readonly members: readonly string[];
		readonly populationId: string;
		readonly sha256: string;
	};
	readonly provenance: readonly HarmonizationRuleProjectionProvenance[];
	readonly ruleId: string;
	readonly schemaVersion: typeof HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION;
}

export interface HarmonizationRuleConditionTrace {
	readonly actual: HarmonizationRuleFactValue;
	readonly expected: HarmonizationRuleFactValue;
	readonly factKey: string;
	readonly operator: HarmonizationRuleCondition['operator'];
	readonly satisfied: boolean;
}

export type HarmonizationFirstIncrementEvaluationStatus =
	'DETECTED' | 'NOT_DETECTED' | 'UNSUPPORTED' | 'NOT_APPLICABLE' | 'NOT_RUN';

export interface HarmonizationAnalyzerFinding {
	readonly analysisAuthority: 'NONE';
	readonly benchmarkSourceReference: string;
	readonly findingFingerprint: string;
	readonly findingId: number;
	readonly findingText: string;
	readonly frozenSubjectId: string;
	readonly gateEffect: 'NONE';
	readonly observationSha256: string;
	readonly populationSha256: string;
	readonly referenceCurrentness: 'HISTORICAL_EXACT_BENCHMARK_ROW_NOT_RECHECKED_AS_CURRENT_SOURCE';
	readonly ruleContentSha256: string;
	readonly ruleId: string;
	readonly ruleVersion: string;
	readonly sourceSha256: string;
	readonly technicalSeverity: 'CRITICAL' | 'BLOCKING' | 'MATERIAL';
	readonly title: string;
	readonly witnessSourceReferences: readonly string[];
}

export interface HarmonizationFirstIncrementEvaluationResult {
	readonly capability: {
		readonly analysisAuthority: 'NONE';
		readonly gateEffect: 'NONE';
		readonly id: typeof HARMONIZATION_FIRST_INCREMENT_CAPABILITY;
		readonly nativeProjection: 'NOT_PERFORMED_CALLER_SUPPLIED_STRUCTURAL_OBSERVATION';
		readonly registeredOperation: 'NOT_CLAIMED';
		readonly status: typeof HARMONIZATION_FIRST_INCREMENT_CAPABILITY_STATUS;
	};
	readonly currentness: HarmonizationFirstIncrementEvaluationRequest['currentness'] & {
		readonly basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED';
	};
	readonly evaluationId: string;
	readonly evaluatorExecuted: boolean;
	readonly evidence: {
		readonly conditionTrace: readonly HarmonizationRuleConditionTrace[];
		readonly evaluatedFactKeys: readonly string[];
		readonly observationBytes: number;
		readonly observationSha256: string;
	};
	readonly facadeNonclaims: typeof HARMONIZATION_FIRST_INCREMENT_NONCLAIMS;
	readonly finding: HarmonizationAnalyzerFinding | null;
	readonly missingCapabilities: readonly HarmonizationCapabilityCode[];
	readonly missingProjectionSurfaces: readonly HarmonizationRuleProjectionSurface[];
	readonly population: HarmonizationFirstIncrementEvaluationRequest['population'];
	readonly provenance: readonly HarmonizationRuleProjectionProvenance[];
	readonly resultWitness: {
		readonly basis: 'CANONICAL_RESULT_CONTENT_EXCLUDING_RESULT_WITNESS';
		readonly bytes: number;
		readonly sha256: string;
	};
	readonly rule: HarmonizationFirstIncrementRuleProfile;
	readonly schemaVersion: typeof HARMONIZATION_FIRST_INCREMENT_EVALUATION_RESULT_SCHEMA_VERSION;
	readonly status: HarmonizationFirstIncrementEvaluationStatus;
	readonly statusRationale: string;
}

export interface HarmonizationFirstIncrementEvaluationDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly stage: 'REQUEST' | 'EVALUATION' | 'RESULT';
}

export type HarmonizationFirstIncrementEvaluationOutcome =
	| {
			readonly analysisAuthority: 'NONE';
			readonly authorityTransfer: 'NONE';
			readonly diagnostics: readonly [];
			readonly gateEffect: 'NONE';
			readonly operationVersion: typeof HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION;
			readonly outcome: 'evaluated';
			readonly result: HarmonizationFirstIncrementEvaluationResult;
			readonly schemaVersion: typeof HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION;
			readonly state: 'evaluated';
	  }
	| {
			readonly analysisAuthority: 'NONE';
			readonly authorityTransfer: 'NONE';
			readonly diagnostics: readonly [HarmonizationFirstIncrementEvaluationDiagnostic];
			readonly gateEffect: 'NONE';
			readonly operationVersion: typeof HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION;
			readonly outcome: 'unavailable';
			readonly result: null;
			readonly schemaVersion: typeof HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION;
			readonly state: 'incompatible' | 'resource-refused';
	  };

class RuleEvaluationRefusal extends Error {
	constructor(
		readonly code: string,
		readonly state: 'incompatible' | 'resource-refused',
		message: string,
		readonly path: string | null = null,
		readonly stage: 'REQUEST' | 'EVALUATION' | 'RESULT' = 'REQUEST'
	) {
		super(message);
	}
}

const REQUEST_KEYS = [
	'availableCapabilities',
	'currentness',
	'evaluationId',
	'executionDisposition',
	'facts',
	'operationVersion',
	'population',
	'provenance',
	'ruleId',
	'schemaVersion'
] as const;
const CURRENTNESS_KEYS = [
	'frozenSubjectId',
	'invalidationDependencyIds',
	'sourceSha256',
	'state'
] as const;
const POPULATION_KEYS = ['closure', 'count', 'members', 'populationId', 'sha256'] as const;
const FACT_KEYS = ['key', 'value'] as const;
const PROVENANCE_KEYS = [
	'provenanceId',
	'sha256',
	'sourceReference',
	'surface',
	'version'
] as const;
const MAX_FACTS = 64;
const MAX_PROVENANCE = 16;
const MAX_SET_MEMBERS = 64;
/**
 * Explicit population identities remain bounded and are never replaced by a lossy census token.
 * The current JPWB exact coding-agent subject measures 371 members for its widest native rule;
 * 512 retains roughly 40% capacity headroom while preserving exact member-level evidence.
 */
export const HARMONIZATION_FIRST_INCREMENT_MAX_POPULATION_MEMBERS = 512;
const MAX_STRING_CHARACTERS = 2_048;
const MAX_RESULT_BYTES = 512 * 1024;

interface InspectedRecord {
	readonly values: ReadonlyMap<string, unknown>;
}

function inspectExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
	path: string
): InspectedRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new RuleEvaluationRefusal(
			'REQUEST_RECORD_INVALID',
			'incompatible',
			`${path} must be an exact non-Proxy plain-data record.`,
			path
		);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new RuleEvaluationRefusal(
			'REQUEST_RECORD_PROTOTYPE_INVALID',
			'incompatible',
			`${path} has an unsupported prototype.`,
			path
		);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new RuleEvaluationRefusal(
			'REQUEST_RECORD_SYMBOL_KEY',
			'incompatible',
			`${path} must not contain symbol keys.`,
			path
		);
	const sortedActual = (ownKeys as string[]).sort();
	const sortedExpected = [...expectedKeys].sort();
	if (
		sortedActual.length !== sortedExpected.length ||
		sortedActual.some((key, index) => key !== sortedExpected[index])
	)
		throw new RuleEvaluationRefusal(
			'REQUEST_RECORD_KEYS_INVALID',
			'incompatible',
			`${path} has missing or unexpected fields.`,
			path
		);
	const values = new Map<string, unknown>();
	for (const key of expectedKeys) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set)
			throw new RuleEvaluationRefusal(
				'REQUEST_ACCESSOR_FORBIDDEN',
				'incompatible',
				`${path}.${key} must be an own data property.`,
				`${path}.${key}`
			);
		values.set(key, descriptor.value);
	}
	return { values };
}

function inspectDenseArray(value: unknown, maximum: number, path: string): readonly unknown[] {
	if (!Array.isArray(value) || isProxyValue(value))
		throw new RuleEvaluationRefusal(
			'REQUEST_ARRAY_INVALID',
			'incompatible',
			`${path} must be a dense non-Proxy array.`,
			path
		);
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	if (
		!lengthDescriptor ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0
	)
		throw new RuleEvaluationRefusal(
			'REQUEST_ARRAY_LENGTH_INVALID',
			'incompatible',
			`${path} has an invalid length descriptor.`,
			path
		);
	if (lengthDescriptor.value > maximum)
		throw new RuleEvaluationRefusal(
			'REQUEST_ARRAY_BUDGET_EXCEEDED',
			'resource-refused',
			`${path} exceeds its fixed safety ceiling.`,
			path
		);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new RuleEvaluationRefusal(
			'REQUEST_ARRAY_SYMBOL_KEY',
			'incompatible',
			`${path} must not contain symbol keys.`,
			path
		);
	if (ownKeys.length !== lengthDescriptor.value + 1)
		throw new RuleEvaluationRefusal(
			'REQUEST_ARRAY_NOT_DENSE',
			'incompatible',
			`${path} must be dense and contain no expando fields.`,
			path
		);
	const result: unknown[] = [];
	for (let index = 0; index < lengthDescriptor.value; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set)
			throw new RuleEvaluationRefusal(
				'REQUEST_ARRAY_ELEMENT_INVALID',
				'incompatible',
				`${path}[${index}] must be an own data property.`,
				`${path}[${index}]`
			);
		result.push(descriptor.value);
	}
	return result;
}

function textValue(value: unknown, path: string): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_STRING_CHARACTERS ||
		!isUnicodeScalarString(value)
	)
		throw new RuleEvaluationRefusal(
			'REQUEST_TEXT_INVALID',
			'incompatible',
			`${path} must be a nonempty bounded Unicode scalar string.`,
			path
		);
	return value;
}

function sha256Value(value: unknown, path: string): string {
	const text = textValue(value, path);
	if (!/^[0-9a-f]{64}$/.test(text))
		throw new RuleEvaluationRefusal(
			'REQUEST_SHA256_INVALID',
			'incompatible',
			`${path} must be a lowercase SHA-256 digest.`,
			path
		);
	return text;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
	if (typeof value !== 'string' || !allowed.includes(value as T))
		throw new RuleEvaluationRefusal(
			'REQUEST_ENUM_INVALID',
			'incompatible',
			`${path} has an unsupported value.`,
			path
		);
	return value as T;
}

function nonnegativeSafeInteger(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
		throw new RuleEvaluationRefusal(
			'REQUEST_INTEGER_INVALID',
			'incompatible',
			`${path} must be a nonnegative safe integer.`,
			path
		);
	return value;
}

function materializeStringSet(value: unknown, path: string): readonly string[] {
	const raw = inspectDenseArray(value, MAX_SET_MEMBERS, path);
	const values = raw.map((item, index) => textValue(item, `${path}[${index}]`));
	if (new Set(values).size !== values.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_SET_DUPLICATE',
			'incompatible',
			`${path} must not contain duplicate members.`,
			path
		);
	return Object.freeze(values.sort());
}

function profileForRuleId(ruleId: string): HarmonizationFirstIncrementRuleProfile {
	const profile = HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES.find(
		(candidate) => candidate.ruleId === ruleId
	);
	if (!profile)
		throw new RuleEvaluationRefusal(
			'REQUEST_RULE_UNSUPPORTED',
			'incompatible',
			'ruleId is not one of the 23 versioned first-increment rules.',
			'request.ruleId'
		);
	return profile;
}

interface AdmittedEvaluationRequest extends Omit<
	HarmonizationFirstIncrementEvaluationRequest,
	'facts' | 'provenance'
> {
	readonly facts: readonly HarmonizationRuleObservationFact[];
	readonly profile: HarmonizationFirstIncrementRuleProfile;
	readonly provenance: readonly HarmonizationRuleProjectionProvenance[];
}

function materializeRequest(value: unknown): AdmittedEvaluationRequest {
	const request = inspectExactRecord(value, REQUEST_KEYS, 'request');
	if (
		request.values.get('schemaVersion') !==
		HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION
	)
		throw new RuleEvaluationRefusal(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'incompatible',
			'Unsupported evaluation request schema version.',
			'request.schemaVersion'
		);
	if (request.values.get('operationVersion') !== HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION)
		throw new RuleEvaluationRefusal(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'incompatible',
			'Unsupported evaluation operation version.',
			'request.operationVersion'
		);
	const ruleId = textValue(request.values.get('ruleId'), 'request.ruleId');
	const profile = profileForRuleId(ruleId);
	const currentnessRecord = inspectExactRecord(
		request.values.get('currentness'),
		CURRENTNESS_KEYS,
		'request.currentness'
	);
	const currentnessState = enumValue(
		currentnessRecord.values.get('state'),
		['CALLER_DECLARED_CURRENT', 'CALLER_DECLARED_STALE'] as const,
		'request.currentness.state'
	);
	const invalidationDependencyIds = inspectDenseArray(
		currentnessRecord.values.get('invalidationDependencyIds'),
		64,
		'request.currentness.invalidationDependencyIds'
	).map((item, index) =>
		textValue(item, `request.currentness.invalidationDependencyIds[${index}]`)
	);
	if (new Set(invalidationDependencyIds).size !== invalidationDependencyIds.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_CURRENTNESS_DEPENDENCY_DUPLICATE',
			'incompatible',
			'Currentness dependencies must be unique.',
			'request.currentness.invalidationDependencyIds'
		);
	invalidationDependencyIds.sort();
	if (currentnessState === 'CALLER_DECLARED_STALE' && invalidationDependencyIds.length === 0)
		throw new RuleEvaluationRefusal(
			'REQUEST_STALE_DEPENDENCY_MISSING',
			'incompatible',
			'A stale subject must name at least one invalidation dependency.',
			'request.currentness.invalidationDependencyIds'
		);
	const currentness = {
		frozenSubjectId: textValue(
			currentnessRecord.values.get('frozenSubjectId'),
			'request.currentness.frozenSubjectId'
		),
		invalidationDependencyIds,
		sourceSha256: sha256Value(
			currentnessRecord.values.get('sourceSha256'),
			'request.currentness.sourceSha256'
		),
		state: currentnessState
	};
	const populationRecord = inspectExactRecord(
		request.values.get('population'),
		POPULATION_KEYS,
		'request.population'
	);
	const populationMembers = inspectDenseArray(
		populationRecord.values.get('members'),
		HARMONIZATION_FIRST_INCREMENT_MAX_POPULATION_MEMBERS,
		'request.population.members'
	).map((member, index) => textValue(member, `request.population.members[${index}]`));
	if (new Set(populationMembers).size !== populationMembers.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_POPULATION_MEMBER_DUPLICATE',
			'incompatible',
			'Population members must be unique.',
			'request.population.members'
		);
	populationMembers.sort();
	const population = {
		closure: enumValue(
			populationRecord.values.get('closure'),
			['CLOSED', 'OPEN'] as const,
			'request.population.closure'
		),
		count: nonnegativeSafeInteger(populationRecord.values.get('count'), 'request.population.count'),
		members: populationMembers,
		populationId: textValue(
			populationRecord.values.get('populationId'),
			'request.population.populationId'
		),
		sha256: sha256Value(populationRecord.values.get('sha256'), 'request.population.sha256')
	};
	if (population.count !== population.members.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_POPULATION_COUNT_MISMATCH',
			'incompatible',
			'Population count must exactly equal the explicit analyzed member population.',
			'request.population.count'
		);
	const rawCapabilities = inspectDenseArray(
		request.values.get('availableCapabilities'),
		HARMONIZATION_CAPABILITY_CODES.length,
		'request.availableCapabilities'
	);
	const availableCapabilities = rawCapabilities.map((item, index) =>
		enumValue(item, HARMONIZATION_CAPABILITY_CODES, `request.availableCapabilities[${index}]`)
	);
	if (new Set(availableCapabilities).size !== availableCapabilities.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_CAPABILITY_DUPLICATE',
			'incompatible',
			'Available capabilities must be unique.',
			'request.availableCapabilities'
		);
	availableCapabilities.sort(
		(left, right) =>
			HARMONIZATION_CAPABILITY_CODES.indexOf(left) - HARMONIZATION_CAPABILITY_CODES.indexOf(right)
	);
	const specByKey = new Map(profile.factSpecs.map((spec) => [spec.key, spec] as const));
	const facts = inspectDenseArray(request.values.get('facts'), MAX_FACTS, 'request.facts').map(
		(rawFact, index): HarmonizationRuleObservationFact => {
			const record = inspectExactRecord(rawFact, FACT_KEYS, `request.facts[${index}]`);
			const key = textValue(record.values.get('key'), `request.facts[${index}].key`);
			const spec = specByKey.get(key);
			if (!spec)
				throw new RuleEvaluationRefusal(
					'REQUEST_FACT_UNEXPECTED',
					'incompatible',
					`Fact ${key} is not declared by ${profile.ruleId}.`,
					`request.facts[${index}].key`
				);
			const rawFactValue = record.values.get('value');
			let factValue: HarmonizationRuleFactValue;
			if (spec.type === 'BOOLEAN') {
				if (typeof rawFactValue !== 'boolean')
					throw new RuleEvaluationRefusal(
						'REQUEST_FACT_TYPE_INVALID',
						'incompatible',
						`${key} must be boolean.`,
						`request.facts[${index}].value`
					);
				factValue = rawFactValue;
			} else if (spec.type === 'NONNEGATIVE_SAFE_INTEGER') {
				factValue = nonnegativeSafeInteger(rawFactValue, `request.facts[${index}].value`);
			} else {
				factValue = materializeStringSet(rawFactValue, `request.facts[${index}].value`);
			}
			return { key, value: factValue };
		}
	);
	if (new Set(facts.map((fact) => fact.key)).size !== facts.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_FACT_DUPLICATE',
			'incompatible',
			'Observation fact keys must be unique.',
			'request.facts'
		);
	facts.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
	const provenance = inspectDenseArray(
		request.values.get('provenance'),
		MAX_PROVENANCE,
		'request.provenance'
	).map((rawProvenance, index): HarmonizationRuleProjectionProvenance => {
		const record = inspectExactRecord(
			rawProvenance,
			PROVENANCE_KEYS,
			`request.provenance[${index}]`
		);
		return {
			provenanceId: textValue(
				record.values.get('provenanceId'),
				`request.provenance[${index}].provenanceId`
			),
			sha256: sha256Value(record.values.get('sha256'), `request.provenance[${index}].sha256`),
			sourceReference: textValue(
				record.values.get('sourceReference'),
				`request.provenance[${index}].sourceReference`
			),
			surface: enumValue(
				record.values.get('surface'),
				HARMONIZATION_RULE_PROJECTION_SURFACES,
				`request.provenance[${index}].surface`
			),
			version: textValue(record.values.get('version'), `request.provenance[${index}].version`)
		};
	});
	if (new Set(provenance.map((record) => record.provenanceId)).size !== provenance.length)
		throw new RuleEvaluationRefusal(
			'REQUEST_PROVENANCE_DUPLICATE',
			'incompatible',
			'Projection provenance IDs must be unique.',
			'request.provenance'
		);
	provenance.sort((left, right) =>
		left.provenanceId < right.provenanceId ? -1 : left.provenanceId > right.provenanceId ? 1 : 0
	);
	return deepFreezeConstructed({
		availableCapabilities,
		currentness,
		evaluationId: textValue(request.values.get('evaluationId'), 'request.evaluationId'),
		executionDisposition: enumValue(
			request.values.get('executionDisposition'),
			['NOT_RUN', 'RUN'] as const,
			'request.executionDisposition'
		),
		facts,
		operationVersion: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
		population,
		profile,
		provenance,
		ruleId,
		schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION
	});
}

function setsEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function evaluateCondition(
	condition: HarmonizationRuleCondition,
	facts: ReadonlyMap<string, HarmonizationRuleFactValue>
): HarmonizationRuleConditionTrace {
	const actual = facts.get(condition.factKey);
	if (actual === undefined)
		throw new RuleEvaluationRefusal(
			'EVALUATION_FACT_MISSING',
			'incompatible',
			`Required fact ${condition.factKey} is missing.`,
			`request.facts`,
			'EVALUATION'
		);
	let expected: HarmonizationRuleFactValue;
	let satisfied: boolean;
	if (condition.operator === 'BOOLEAN_EQUALS') {
		expected = condition.expected;
		satisfied = actual === expected;
	} else if (condition.operator === 'NUMBER_EQUALS') {
		expected = condition.expected;
		satisfied = actual === expected;
	} else if (condition.operator === 'NUMBER_GREATER_THAN_OR_EQUALS') {
		expected = condition.expected;
		satisfied = typeof actual === 'number' && actual >= expected;
	} else if (condition.operator === 'NUMBER_EQUALS_FACT') {
		const other = facts.get(condition.otherFactKey);
		if (other === undefined)
			throw new RuleEvaluationRefusal(
				'EVALUATION_FACT_MISSING',
				'incompatible',
				`Required fact ${condition.otherFactKey} is missing.`,
				'request.facts',
				'EVALUATION'
			);
		expected = other;
		satisfied = typeof actual === 'number' && actual === other;
	} else if (condition.operator === 'SET_NOT_EQUALS_FACT') {
		const other = facts.get(condition.otherFactKey);
		if (!Array.isArray(actual) || !Array.isArray(other))
			throw new RuleEvaluationRefusal(
				'EVALUATION_FACT_TYPE_INVALID',
				'incompatible',
				'Set comparison operands must be string sets.',
				'request.facts',
				'EVALUATION'
			);
		expected = other;
		satisfied = !setsEqual(actual, other);
	} else {
		if (!Array.isArray(actual))
			throw new RuleEvaluationRefusal(
				'EVALUATION_FACT_TYPE_INVALID',
				'incompatible',
				`${condition.factKey} must be a string set.`,
				'request.facts',
				'EVALUATION'
			);
		const expectedSet = condition.expected as readonly string[];
		expected = canonicalStringSet(expectedSet);
		if (condition.operator === 'SET_EQUALS') satisfied = setsEqual(actual, expected);
		else if (condition.operator === 'SET_INCLUDES_ALL')
			satisfied = expected.every((member) => actual.includes(member));
		else satisfied = expected.every((member) => !actual.includes(member));
	}
	return deepFreezeConstructed({
		actual,
		expected,
		factKey: condition.factKey,
		operator: condition.operator,
		satisfied
	});
}

function statusRationale(status: HarmonizationFirstIncrementEvaluationStatus): string {
	switch (status) {
		case 'DETECTED':
			return 'DECLARED_DEFECT_PREDICATE_TRUE_FOR_CURRENT_CLOSED_CALLER_SUPPLIED_OBSERVATION';
		case 'NOT_DETECTED':
			return 'DECLARED_DEFECT_PREDICATE_FALSE_FOR_CURRENT_CLOSED_CALLER_SUPPLIED_OBSERVATION_NOT_A_CONFORMANCE_PASS';
		case 'UNSUPPORTED':
			return 'REQUIRED_CAPABILITY_PROJECTION_CLOSURE_OR_CURRENTNESS_UNAVAILABLE';
		case 'NOT_APPLICABLE':
			return 'DECLARED_SUBJECT_CLASS_ABSENT_FROM_CALLER_DECLARED_CLOSED_POPULATION';
		case 'NOT_RUN':
			return 'RULE_EVALUATOR_NOT_REQUESTED';
	}
}

function unavailableOutcome(
	refusal: RuleEvaluationRefusal
): HarmonizationFirstIncrementEvaluationOutcome {
	return deepFreezeConstructed({
		analysisAuthority: HARMONIZATION_FIRST_INCREMENT_ANALYSIS_AUTHORITY,
		authorityTransfer: HARMONIZATION_FIRST_INCREMENT_AUTHORITY_TRANSFER,
		diagnostics: [
			{ code: refusal.code, message: refusal.message, path: refusal.path, stage: refusal.stage }
		],
		gateEffect: HARMONIZATION_FIRST_INCREMENT_GATE_EFFECT,
		operationVersion: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
		outcome: 'unavailable',
		result: null,
		schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION,
		state: refusal.state
	});
}

export function evaluateHarmonizationFirstIncrementRule(
	request: unknown
): HarmonizationFirstIncrementEvaluationOutcome {
	try {
		const admitted = materializeRequest(request);
		const missingCapabilities = admitted.profile.requiredCapabilities.filter(
			(capability) => !admitted.availableCapabilities.includes(capability)
		);
		const observedSurfaces = new Set(admitted.provenance.map((record) => record.surface));
		const missingProjectionSurfaces = admitted.profile.requiredProjectionSurfaces.filter(
			(surface) => !observedSurfaces.has(surface)
		);
		const expectedFactKeys = admitted.profile.factSpecs.map((spec) => spec.key);
		const observedFactKeys = admitted.facts.map((fact) => fact.key);
		const factsComplete =
			expectedFactKeys.length === observedFactKeys.length &&
			expectedFactKeys.every((key, index) => key === observedFactKeys[index]);
		let status: HarmonizationFirstIncrementEvaluationStatus;
		let evaluatorExecuted = false;
		let conditionTrace: readonly HarmonizationRuleConditionTrace[] = [];
		if (admitted.executionDisposition === 'NOT_RUN') status = 'NOT_RUN';
		else if (admitted.currentness.state !== 'CALLER_DECLARED_CURRENT') status = 'UNSUPPORTED';
		else if (
			admitted.population.count === 0 ||
			admitted.population.closure !== 'CLOSED' ||
			missingCapabilities.length > 0 ||
			missingProjectionSurfaces.length > 0
		)
			status =
				admitted.population.count === 0 &&
				admitted.population.closure === 'CLOSED' &&
				missingCapabilities.length === 0 &&
				missingProjectionSurfaces.length === 0
					? 'NOT_APPLICABLE'
					: 'UNSUPPORTED';
		else {
			if (!factsComplete)
				throw new RuleEvaluationRefusal(
					'EVALUATION_FACT_SET_INCOMPLETE',
					'incompatible',
					'A runnable evaluation must provide exactly the rule fact set.',
					'request.facts',
					'EVALUATION'
				);
			const facts = new Map(admitted.facts.map((fact) => [fact.key, fact.value] as const));
			conditionTrace = admitted.profile.conditions.map((condition) =>
				evaluateCondition(condition, facts)
			);
			evaluatorExecuted = true;
			status = conditionTrace.every((trace) => trace.satisfied) ? 'DETECTED' : 'NOT_DETECTED';
		}
		const observationWitness = canonicalSemanticJsonWitness({
			availableCapabilities: admitted.availableCapabilities,
			currentness: admitted.currentness,
			facts: admitted.facts,
			population: admitted.population,
			provenance: admitted.provenance,
			ruleContentSha256: admitted.profile.ruleContentSha256
		});
		const findingFingerprint = canonicalSemanticJsonWitness({
			frozenSubjectId: admitted.currentness.frozenSubjectId,
			observationSha256: observationWitness.sha256,
			populationSha256: admitted.population.sha256,
			ruleId: admitted.profile.ruleId,
			ruleVersion: admitted.profile.ruleVersion
		}).sha256;
		const finding: HarmonizationAnalyzerFinding | null =
			status === 'DETECTED'
				? {
						analysisAuthority: 'NONE',
						benchmarkSourceReference: admitted.profile.benchmarkSourceReference,
						findingFingerprint,
						findingId: admitted.profile.findingId,
						findingText: admitted.profile.findingText,
						frozenSubjectId: admitted.currentness.frozenSubjectId,
						gateEffect: 'NONE',
						observationSha256: observationWitness.sha256,
						populationSha256: admitted.population.sha256,
						referenceCurrentness: admitted.profile.referenceCurrentness,
						ruleContentSha256: admitted.profile.ruleContentSha256,
						ruleId: admitted.profile.ruleId,
						ruleVersion: admitted.profile.ruleVersion,
						sourceSha256: admitted.currentness.sourceSha256,
						technicalSeverity: admitted.profile.technicalSeverity,
						title: admitted.profile.title,
						witnessSourceReferences: admitted.provenance.map(
							(provenance) => provenance.sourceReference
						)
					}
				: null;
		const resultWithoutWitness = {
			capability: {
				analysisAuthority: 'NONE' as const,
				gateEffect: 'NONE' as const,
				id: HARMONIZATION_FIRST_INCREMENT_CAPABILITY,
				nativeProjection: 'NOT_PERFORMED_CALLER_SUPPLIED_STRUCTURAL_OBSERVATION' as const,
				registeredOperation: 'NOT_CLAIMED' as const,
				status: HARMONIZATION_FIRST_INCREMENT_CAPABILITY_STATUS
			},
			currentness: {
				...admitted.currentness,
				basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED' as const
			},
			evaluationId: admitted.evaluationId,
			evaluatorExecuted,
			evidence: {
				conditionTrace,
				evaluatedFactKeys: evaluatorExecuted ? expectedFactKeys : [],
				observationBytes: observationWitness.bytes,
				observationSha256: observationWitness.sha256
			},
			facadeNonclaims: HARMONIZATION_FIRST_INCREMENT_NONCLAIMS,
			finding,
			missingCapabilities,
			missingProjectionSurfaces,
			population: admitted.population,
			provenance: admitted.provenance,
			rule: admitted.profile,
			schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_RESULT_SCHEMA_VERSION,
			status,
			statusRationale: statusRationale(status)
		};
		const canonicalResultContentWitness = canonicalSemanticJsonWitness(resultWithoutWitness);
		if (canonicalResultContentWitness.bytes + 1 > MAX_RESULT_BYTES)
			throw new RuleEvaluationRefusal(
				'RESULT_BUDGET_EXCEEDED',
				'resource-refused',
				'Canonical result plus one LF exceeds the fixed result-size ceiling.',
				null,
				'RESULT'
			);
		const result: HarmonizationFirstIncrementEvaluationResult = deepFreezeConstructed({
			...resultWithoutWitness,
			resultWitness: {
				basis: 'CANONICAL_RESULT_CONTENT_EXCLUDING_RESULT_WITNESS',
				...canonicalResultContentWitness
			}
		});
		return deepFreezeConstructed({
			analysisAuthority: HARMONIZATION_FIRST_INCREMENT_ANALYSIS_AUTHORITY,
			authorityTransfer: HARMONIZATION_FIRST_INCREMENT_AUTHORITY_TRANSFER,
			diagnostics: [],
			gateEffect: HARMONIZATION_FIRST_INCREMENT_GATE_EFFECT,
			operationVersion: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
			outcome: 'evaluated',
			result,
			schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_OUTCOME_SCHEMA_VERSION,
			state: 'evaluated'
		});
	} catch (error) {
		if (error instanceof RuleEvaluationRefusal) return unavailableOutcome(error);
		return unavailableOutcome(
			new RuleEvaluationRefusal(
				'EVALUATION_INTERNAL_FAILURE',
				'incompatible',
				error instanceof Error
					? error.message
					: 'Rule evaluation failed without a supported diagnostic.',
				null,
				'EVALUATION'
			)
		);
	}
}

export type HarmonizationFirstIncrementFixtureKind =
	'POSITIVE' | 'NEARBY_NEGATIVE' | 'BOUNDARY' | 'DISABLED';

const fixtureSourceSha256 = canonicalSemanticJsonWitness({
	negative: RULE_SEEDS.map((seed) => normalizedFixtureFacts(seed.nearbyNegativeFacts)),
	positive: RULE_SEEDS.map((seed) => normalizedFixtureFacts(seed.positiveFacts)),
	ruleSetVersion: HARMONIZATION_FIRST_INCREMENT_RULE_SET_VERSION
}).sha256;
export const HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT = Object.freeze({
	frozenSubjectId: 'frozen-subject:harmonization-first-increment-fixtures/0.1.0',
	sourceSha256: fixtureSourceSha256
});

function factRecords(
	facts: Readonly<Record<string, HarmonizationRuleFactValue>>
): readonly HarmonizationRuleObservationFact[] {
	return Object.entries(normalizedFixtureFacts(facts)).map(([key, value]) => ({ key, value }));
}

function fixtureProvenance(
	profile: HarmonizationFirstIncrementRuleProfile
): readonly HarmonizationRuleProjectionProvenance[] {
	return profile.requiredProjectionSurfaces.map((surface) => ({
		provenanceId: `fixture-projection:${surface}`,
		sha256: canonicalSemanticJsonWitness({ sourceSha256: fixtureSourceSha256, surface }).sha256,
		sourceReference: `fixture://harmonization-first-increment/${surface}`,
		surface,
		version: '0.1.0'
	}));
}

export function createHarmonizationFirstIncrementFixtureRequest(
	ruleId: string,
	kind: HarmonizationFirstIncrementFixtureKind
): HarmonizationFirstIncrementEvaluationRequest {
	const profile = profileForRuleId(ruleId);
	const seed = RULE_SEEDS.find((candidate) => candidate.findingId === profile.findingId)!;
	const facts =
		kind === 'POSITIVE'
			? seed.positiveFacts
			: kind === 'NEARBY_NEGATIVE'
				? seed.nearbyNegativeFacts
				: {};
	const populationMembers =
		kind === 'BOUNDARY' ? [] : [`${profile.ruleId}/${kind.toLowerCase()}/member`];
	const populationIdentity = canonicalSemanticJsonWitness({
		findingId: profile.findingId,
		kind,
		members: populationMembers,
		subjectClass: profile.subjectClass
	});
	return deepFreezeConstructed({
		availableCapabilities: kind === 'DISABLED' ? [] : [...profile.requiredCapabilities],
		currentness: {
			frozenSubjectId: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.frozenSubjectId,
			invalidationDependencyIds: [],
			sourceSha256: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.sourceSha256,
			state: 'CALLER_DECLARED_CURRENT'
		},
		evaluationId: `${profile.ruleId}/${kind.toLowerCase()}`,
		executionDisposition: kind === 'DISABLED' ? 'NOT_RUN' : 'RUN',
		facts: factRecords(facts),
		operationVersion: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION,
		population: {
			closure: 'CLOSED',
			count: kind === 'BOUNDARY' ? 0 : 1,
			members: populationMembers,
			populationId: `${profile.ruleId}/${kind.toLowerCase()}/population`,
			sha256: populationIdentity.sha256
		},
		provenance: kind === 'DISABLED' ? [] : fixtureProvenance(profile),
		ruleId: profile.ruleId,
		schemaVersion: HARMONIZATION_FIRST_INCREMENT_EVALUATION_REQUEST_SCHEMA_VERSION
	});
}

export interface HarmonizationFirstIncrementFixtureDiscrimination {
	readonly boundary: HarmonizationFirstIncrementEvaluationResult;
	readonly disabled: HarmonizationFirstIncrementEvaluationResult;
	readonly equivalent: HarmonizationFirstIncrementEvaluationResult;
	readonly findingId: number;
	readonly mutation: HarmonizationFirstIncrementEvaluationResult;
	readonly nearbyNegative: HarmonizationFirstIncrementEvaluationResult;
	readonly positive: HarmonizationFirstIncrementEvaluationResult;
	readonly ruleId: string;
	readonly satisfied: true;
}

function requiredEvaluation(
	request: HarmonizationFirstIncrementEvaluationRequest,
	expectedStatus: HarmonizationFirstIncrementEvaluationStatus
): HarmonizationFirstIncrementEvaluationResult {
	const outcome = evaluateHarmonizationFirstIncrementRule(request);
	if (outcome.outcome !== 'evaluated' || outcome.result.status !== expectedStatus)
		throw new Error(`Fixture ${request.evaluationId} did not produce ${expectedStatus}.`);
	return outcome.result;
}

export function runHarmonizationFirstIncrementFixtureSuite(): readonly HarmonizationFirstIncrementFixtureDiscrimination[] {
	return deepFreezeConstructed(
		HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES.map((profile) => {
			const positiveRequest = createHarmonizationFirstIncrementFixtureRequest(
				profile.ruleId,
				'POSITIVE'
			);
			const negativeRequest = createHarmonizationFirstIncrementFixtureRequest(
				profile.ruleId,
				'NEARBY_NEGATIVE'
			);
			const boundaryRequest = createHarmonizationFirstIncrementFixtureRequest(
				profile.ruleId,
				'BOUNDARY'
			);
			const disabledRequest = createHarmonizationFirstIncrementFixtureRequest(
				profile.ruleId,
				'DISABLED'
			);
			const seed = RULE_SEEDS.find((candidate) => candidate.findingId === profile.findingId)!;
			const negativeMutationValue = normalizedFixtureFacts(seed.nearbyNegativeFacts)[
				seed.mutationFactKey
			]!;
			const mutationRequest = {
				...positiveRequest,
				evaluationId: `${profile.ruleId}/mutation`,
				facts: positiveRequest.facts.map((fact) =>
					fact.key === seed.mutationFactKey ? { key: fact.key, value: negativeMutationValue } : fact
				)
			};
			const equivalentRequest = {
				...positiveRequest,
				evaluationId: positiveRequest.evaluationId,
				facts: [...positiveRequest.facts].reverse(),
				provenance: [...positiveRequest.provenance].reverse()
			};
			const positive = requiredEvaluation(positiveRequest, 'DETECTED');
			const nearbyNegative = requiredEvaluation(negativeRequest, 'NOT_DETECTED');
			const boundary = requiredEvaluation(boundaryRequest, 'NOT_APPLICABLE');
			const disabled = requiredEvaluation(disabledRequest, 'NOT_RUN');
			const mutation = requiredEvaluation(mutationRequest, 'NOT_DETECTED');
			const equivalent = requiredEvaluation(equivalentRequest, 'DETECTED');
			if (
				positive.evidence.observationSha256 !== equivalent.evidence.observationSha256 ||
				positive.finding?.findingFingerprint !== equivalent.finding?.findingFingerprint
			)
				throw new Error(`Equivalent reordering changed ${profile.ruleId} semantic identity.`);
			return {
				boundary,
				disabled,
				equivalent,
				findingId: profile.findingId,
				mutation,
				nearbyNegative,
				positive,
				ruleId: profile.ruleId,
				satisfied: true as const
			};
		})
	);
}

function accountingAssessment(
	discrimination: HarmonizationFirstIncrementFixtureDiscrimination
): HarmonizationBenchmarkAssessment {
	const profile = discrimination.positive.rule;
	const evidencePrefix = `harmonization-fixture:${profile.findingId}`;
	const runWitness = canonicalSemanticJsonWitness({
		mutationSha256: discrimination.mutation.evidence.observationSha256,
		negativeSha256: discrimination.nearbyNegative.evidence.observationSha256,
		positiveSha256: discrimination.positive.evidence.observationSha256,
		ruleContentSha256: profile.ruleContentSha256
	});
	return {
		currentness: {
			basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
			frozenSubjectId: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.frozenSubjectId,
			invalidationDependencyIds: [],
			sourceSha256: HARMONIZATION_FIRST_INCREMENT_FIXTURE_SUBJECT.sourceSha256,
			state: 'CALLER_DECLARED_CURRENT'
		},
		evidence: {
			disposition: 'PRESENT',
			records: [
				{
					evidenceId: `${evidencePrefix}:nearby-negative`,
					kind: 'NEARBY_NEGATIVE_CONTROL',
					sha256: discrimination.nearbyNegative.evidence.observationSha256,
					sourceReference: profile.fixtureReferences.nearbyNegative
				},
				{
					evidenceId: `${evidencePrefix}:positive`,
					kind: 'PLANTED_POSITIVE_DETECTION',
					sha256: discrimination.positive.evidence.observationSha256,
					sourceReference: profile.fixtureReferences.positive
				},
				{
					evidenceId: `${evidencePrefix}:run`,
					kind: 'EXECUTION',
					sha256: runWitness.sha256,
					sourceReference: profile.fixtureReferences.mutation
				}
			]
		},
		findingId: profile.findingId,
		provenance: {
			disposition: 'ANALYSIS_BOUND',
			records: [
				{
					kind: 'RULE_SET',
					provenanceId: `${evidencePrefix}:rule-set`,
					sha256: HARMONIZATION_FIRST_INCREMENT_RULE_SET_WITNESS.sha256,
					version: HARMONIZATION_FIRST_INCREMENT_RULE_SET_VERSION
				},
				{
					kind: 'RUN',
					provenanceId: `${evidencePrefix}:run`,
					sha256: runWitness.sha256,
					version: HARMONIZATION_FIRST_INCREMENT_OPERATION_VERSION
				}
			]
		},
		rule: {
			implementation: 'IMPLEMENTED',
			method: 'AUTOMATED',
			registration: HARMONIZATION_BENCHMARK_ACCOUNTING_CAPABILITY_STATUS,
			ruleContentSha256: profile.ruleContentSha256,
			ruleId: profile.ruleId,
			ruleVersion: profile.ruleVersion
		},
		status: 'DETECTED',
		statusRationale:
			'PLANTED_POSITIVE_DETECTED_AND_NEARBY_NEGATIVE_PLUS_SEMANTIC_MUTATION_DISCRIMINATED_BY_LOCAL_UNREGISTERED_RULE_EVALUATOR',
		unsupportedCapabilities: []
	};
}

/**
 * Produces one exact 75-row accounting request: the 23 executable structural fixture evaluators are
 * DETECTED and the remaining 52 rows remain explicit local/unregistered UNSUPPORTED assessments.
 * It does not claim native repository projection, current-worktree reproduction, or G5 completion.
 */
export function createHarmonizationFirstIncrementBenchmarkAccountingRequest(
	executionId: string
): HarmonizationBenchmarkAccountingRequest {
	const seed = createUnimplementedHarmonizationBenchmarkAccountingRequest(executionId);
	const implemented = new Map(
		runHarmonizationFirstIncrementFixtureSuite().map((discrimination) => [
			discrimination.findingId,
			accountingAssessment(discrimination)
		])
	);
	return deepFreezeConstructed({
		assessments: seed.assessments.map(
			(assessment) => implemented.get(assessment.findingId) ?? assessment
		),
		budgets: { ...HARMONIZATION_BENCHMARK_ACCOUNTING_DEFAULT_BUDGETS },
		executionId,
		operationVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_OPERATION_VERSION,
		schemaVersion: HARMONIZATION_BENCHMARK_ACCOUNTING_REQUEST_SCHEMA_VERSION
	});
}
