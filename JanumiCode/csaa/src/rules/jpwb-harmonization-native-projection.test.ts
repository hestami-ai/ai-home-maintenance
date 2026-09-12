import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { FrozenSubject } from '../contracts/subject.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { attachFrozenSubjectBytes } from '../subject/frozen-store.js';
import { runHarmonizationBenchmarkAccounting } from './harmonization-benchmark-accounting.js';
import { createHarmonizationFirstIncrementBenchmarkAccountingRequest } from './harmonization-first-increment-rules.js';
import {
	JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
	JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION,
	projectJpwbHarmonizationRuleFactsFromCapturedSources,
	runJpwbHarmonizationNativeProjection
} from './jpwb-harmonization-native-projection.js';

const PREFIX_DOC =
	'docs/Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event, Schema Contract Package.md';
const IMPLEMENTATION_GUIDE = 'docs/Janumi Canonical Implementation Context - Coding Agent Guide.md';
const AUTHORIZE_AT_ACTION_TIME_REQUIREMENT =
	'### 13.3 Security invariants\n\n- Authorize at action time against principal, tenant, resource, action, boundary, version/revision, and relevant Decision/waiver.\n';
const MANDATORY_PROPERTY_REGISTRY = `### 14.2 Mandatory generative properties

| Property | Must always hold |
|---|---|
${Array.from({ length: 12 }, (_, index) => `| **P${index + 1}** | Requirement ${index + 1}. |`).join('\n')}

### 14.3 Minimum conformance scenarios
`;

interface DetectorCase {
	readonly findingId: number;
	readonly negative: Readonly<Record<string, string>>;
	readonly positive: Readonly<Record<string, string>>;
}

const cases: readonly DetectorCase[] = [
	{
		findingId: 1,
		positive: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const run = () => floorGateBlock(ctx, id, { aiProduced: false });\n'
		},
		negative: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const run = () => floorGateBlock(ctx, id, { aiProduced: true });\nexport const recordResultFloor = () => true;\nrecordResultFloor();\n'
		}
	},
	{
		findingId: 3,
		positive: {
			'packages/rph-contracts/src/messages.ts':
				'export interface Command { readonly expectedRevision: number }\n',
			'packages/rph-application/src/handler.ts': 'export const update = () => commitState();\n'
		},
		negative: {
			'packages/rph-contracts/src/messages.ts':
				'export interface Command { readonly expectedRevision: number }\n',
			'packages/rph-application/src/handler.ts':
				'export const update = (command: Command) => { void command.expectedRevision; return commitState(); };\n'
		}
	},
	{
		findingId: 5,
		positive: {
			'packages/rph-contracts/src/messages.ts':
				'export const EVENTS = { Created: { payload: schema } } as const;\n',
			'packages/rph-application/src/handlers/kit.ts': 'export const emit = () => makeEvent();\n'
		},
		negative: {
			'packages/rph-contracts/src/messages.ts':
				'export const EVENTS = { Created: { payload: schema } } as const;\n',
			'packages/rph-contracts/src/validate.ts':
				'export const validate = (event: any) => EVENTS[event.type].payload.safeParse(event.payload);\n',
			'packages/rph-application/src/handlers/kit.ts': 'export const emit = () => makeEvent();\n'
		}
	},
	{
		findingId: 6,
		positive: {
			'packages/rph-domain/src/properties.test.ts': "describe('P4', () => {});\n",
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome() { return { evidenceExists: true, evidenceInvalidated: false }; }\n',
			'packages/rph-application/src/handlers/assurance.ts': 'export const unrelated = true;\n'
		},
		negative: {
			'packages/rph-domain/src/properties.test.ts': "describe('P4', () => {});\n",
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome() { return { evidenceExists, evidenceInvalidated }; }\n',
			'packages/rph-application/src/handlers/assurance.ts':
				'export const invalidate = () => classifyEvidenceInvalidation(graph, id);\n'
		}
	},
	{
		findingId: 8,
		positive: {
			[IMPLEMENTATION_GUIDE]: AUTHORIZE_AT_ACTION_TIME_REQUIREMENT,
			'packages/rph-ports/src/index.ts': "export const VERSION = '1';\n"
		},
		negative: {
			[IMPLEMENTATION_GUIDE]: AUTHORIZE_AT_ACTION_TIME_REQUIREMENT,
			'packages/rph-ports/src/index.ts':
				'export interface CapabilityAuthorizerPort { authorize(): boolean }\n'
		}
	},
	{
		findingId: 11,
		positive: {
			'packages/rph-contracts/src/objects.ts':
				'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape, id: z.string(), semanticVersion: z.number().int() });\n',
			'packages/rph-contracts/src/envelopes.ts':
				'export const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\n'
		},
		negative: {
			'packages/rph-contracts/src/objects.ts':
				'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape, name: z.string() });\n',
			'packages/rph-contracts/src/envelopes.ts':
				'export const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\n'
		}
	},
	{
		findingId: 12,
		positive: {
			'packages/rph-assurance/src/validators.ts':
				'export const run = () => identityProvenanceValidator(subject, { hasStableId: true, hasSemanticVersion: true, hasProvenance: true, hasProducer: true, traceComplete: true });\n'
		},
		negative: {
			'packages/rph-assurance/src/validators.ts':
				'export const run = () => identityProvenanceValidator(subject, { hasStableId, hasSemanticVersion, hasProvenance, hasProducer, traceComplete });\n'
		}
	},
	{
		findingId: 17,
		positive: {
			'packages/rph-application/src/handlers/pwa-authoring.ts':
				"export const validatePwa = () => advanceStatus({ target: 'VALIDATED' });\n"
		},
		negative: {
			'packages/rph-application/src/handlers/pwa-authoring.ts':
				"export const validatePwa = () => { pwaCompositionGate(); return advanceStatus({ target: 'VALIDATED' }); };\n"
		}
	},
	{
		findingId: 18,
		positive: {
			'packages/rph-application/src/handlers/pwa-authoring.ts':
				'export const definePwuType = () => createObject();\n'
		},
		negative: {
			'packages/rph-application/src/handlers/pwa-authoring.ts':
				'export const definePwuType = () => withPwaVersionBump(() => createObject());\n'
		}
	},
	{
		findingId: 22,
		positive: {
			[IMPLEMENTATION_GUIDE]: MANDATORY_PROPERTY_REGISTRY,
			'packages/rph-domain/src/conformance.test.ts':
				"expect(ids).toEqual(['P1','P2','P3','P4','P5','P6','P7','P8']);\n",
			'packages/rph-domain/src/conformance-manifest.ts':
				"export const PROPERTY_COVERAGE = { P1:'x',P2:'x',P3:'x',P4:'x',P5:'x',P6:'x',P7:'x',P8:'x' } as const;\n"
		},
		negative: {
			[IMPLEMENTATION_GUIDE]: MANDATORY_PROPERTY_REGISTRY,
			'packages/rph-domain/src/conformance.test.ts':
				"expect(ids).toEqual(['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12']);\n",
			'packages/rph-domain/src/conformance-manifest.ts':
				"export const PROPERTY_COVERAGE = { P1:'x',P2:'x',P3:'x',P4:'x',P5:'x',P6:'x',P7:'x',P8:'x',P9:'x',P10:'x',P11:'x',P12:'x' } as const;\n"
		}
	},
	{
		findingId: 23,
		positive: {
			'packages/rph-domain/src/conformance.test.ts':
				'expect(catalog.mutationCatalog.length).toBeGreaterThan(0);\n',
			'packages/rph-domain/vocab/m12-conformance.json': '{"mutationCatalog":[{"id":"M1"}]}'
		},
		negative: {
			'packages/rph-domain/src/conformance.test.ts':
				'expect(catalog.mutationCatalog.length).toBeGreaterThan(0);\n',
			'packages/rph-domain/src/mutation-runner.test.ts':
				'it("kills M1", () => executeMutation("M1"));\n',
			'packages/rph-domain/vocab/m12-conformance.json': '{"mutationCatalog":[{"id":"M1"}]}'
		}
	},
	{
		findingId: 28,
		positive: {
			'packages/rph-application/src/handlers/assurance.ts':
				'export function requestAssuranceAssessment() { const state = { evidenceConsideredIds: [], evidenceRejected: [], residualUncertainty: [] }; return state; }\n'
		},
		negative: {
			'packages/rph-application/src/handlers/assurance.ts':
				'export function requestAssuranceAssessment() { const state = { evidenceConsideredIds: [], evidenceRejected: [], residualUncertainty: [] }; return state; }\nexport const complete = () => commitState(ctx, command, { objectType: ASSESSMENT, nextState: { evidenceConsideredIds: suppliedEvidence } });\n'
		}
	},
	{
		findingId: 30,
		positive: {
			'packages/rph-contracts/src/ids.ts':
				'export const RphIdSchema = z.string().regex(RPH_ID_REGEX);\nexport function isRphId(value: unknown) { return RPH_ID_REGEX.test(String(value)); }\n'
		},
		negative: {
			'packages/rph-contracts/src/ids.ts':
				'export const RphIdSchema = z.string().refine((value) => KNOWN_ID_PREFIXES.has(value.split("_")[0]));\nexport function isRphId(value: string) { return KNOWN_ID_PREFIXES.has(value.split("_")[0]); }\n'
		}
	},
	{
		findingId: 31,
		positive: {
			'packages/rph-contracts/src/messages.ts':
				'export const PayloadSchema = z.strictObject({ objectId: z.string(), relatedIds: z.array(z.string()) });\n'
		},
		negative: {
			'packages/rph-contracts/src/messages.ts':
				'export const PayloadSchema = z.strictObject({ objectId: RphIdSchema, relatedIds: z.array(RphIdSchema) });\n'
		}
	},
	{
		findingId: 32,
		positive: {
			'packages/rph-contracts/src/ids.ts':
				"export const ID_PREFIXES = { INTENT:'int', CONVERSATION:'conv' } as const;\n",
			[PREFIX_DOC]:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n| Professional Work Architecture | `pwa` |\n\nIDs are opaque and immutable.\n'
		},
		negative: {
			'packages/rph-contracts/src/ids.ts':
				"export const ID_PREFIXES = { INTENT:'int', PWA:'pwa' } as const;\n",
			[PREFIX_DOC]:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n| Professional Work Architecture | `pwa` |\n\nIDs are opaque and immutable.\n'
		}
	},
	{
		findingId: 34,
		positive: {
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => advancePwuLifecycle();\n'
		},
		negative: {
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = (facts: any) => { void facts.intentStatus; checkPwuShapeReadiness(facts); return advancePwuLifecycle(); };\n'
		}
	},
	{
		findingId: 35,
		positive: {
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => advancePwuLifecycle();\n',
			'packages/rph-domain/src/pwuGuards.ts': 'export const unrelated = true;\n'
		},
		negative: {
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => { checkPwuShapeReadiness(); return advancePwuLifecycle(); };\n',
			'packages/rph-domain/src/pwuGuards.ts':
				"const INTENT_AT_LEAST_PROVISIONAL = new Set(['PROVISIONAL']);\nexport function checkPwuShapeReadiness(facts: any) { return INTENT_AT_LEAST_PROVISIONAL.has(facts.intentStatus); }\n"
		}
	},
	{
		findingId: 36,
		positive: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const startExecutionStep = () => run();\n',
			'packages/rph-contracts/src/messages.ts':
				'export interface StartPayload { runtimeBindingId: string }\n'
		},
		negative: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const startExecutionStep = (step: any) => { void step.runtimeBindingId; return bindingAuthorityRefusal(); };\n',
			'packages/rph-contracts/src/messages.ts':
				'export interface StartPayload { runtimeBindingId: string }\n'
		}
	},
	{
		findingId: 39,
		positive: {
			'packages/rph-assurance/src/assurance-rules.ts':
				'export function evidenceAdmissibility() { return { admissible: true }; }\n',
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome() { return { evidenceExists: true }; }\n',
			'packages/rph-application/src/handlers/assurance.ts': 'export const unrelated = true;\n'
		},
		negative: {
			'packages/rph-assurance/src/assurance-rules.ts':
				'export function evidenceAdmissibility() { return { admissible: true }; }\n',
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome() { return { evidenceExists }; }\n',
			'packages/rph-application/src/handlers/assurance.ts':
				'export const admit = () => evidenceAdmissibility();\n'
		}
	},
	{
		findingId: 40,
		positive: {
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome() { return classifyValidatorResult({ schemaValid: true }); }\n'
		},
		negative: {
			'packages/rph-assurance/src/floor.ts':
				'export function composeAssuranceOutcome(result: unknown) { const ValidatorResult = schema; return classifyValidatorResult({ schemaValid: ValidatorResult.safeParse(result).success }); }\n'
		}
	},
	{
		findingId: 49,
		positive: {
			'packages/rph-application/src/command-bus.ts':
				'export function dispatch() { return handler(); }\n',
			'packages/rph-application/src/handlers/registry.ts':
				'export const HANDLERS = { MarkPwuReady: markPwuReady, PublishPwa: publishPwa };\n',
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => advance();\nexport const publishPwa = () => advance();\n'
		},
		negative: {
			'packages/rph-application/src/command-bus.ts':
				'export function dispatch() { return authorize(command) ? handler() : reject(); }\n',
			'packages/rph-application/src/handlers/registry.ts':
				'export const HANDLERS = { MarkPwuReady: markPwuReady };\n',
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => authorizeTransition() ? advance() : reject();\n'
		}
	},
	{
		findingId: 70,
		positive: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const guard = (pwu: any) => pwu.activeExecutionPlanId !== undefined;\n'
		},
		negative: {
			'packages/rph-application/src/handlers/execution.ts':
				'export const guard = (pwu: any) => pwu.activeExecutionPlanId !== undefined;\nexport const next = { activeExecutionPlanId: planId };\n'
		}
	},
	{
		findingId: 73,
		positive: {
			'packages/rph-application/src/handlers/governance.ts':
				'export const promote = { candidateItems, reviewedItems: candidateItems };\n'
		},
		negative: {
			'packages/rph-application/src/handlers/governance.ts':
				'export const promote = { candidateItems, reviewedItems };\n'
		}
	}
];

const CONCLUSIVE_CAPABILITIES = new Map<number, readonly string[]>([
	[1, ['CALL', 'DFG']],
	[3, ['SYM']],
	[5, ['SYM', 'CALL']],
	[6, ['CALL', 'TEST']],
	[8, ['SYM', 'SCHEMA']],
	[11, ['AST', 'SCHEMA']],
	[12, ['AST']],
	[17, ['AST', 'CALL']],
	[18, ['SYM']],
	[22, ['AST', 'TEST']],
	[23, ['CALL', 'TEST']],
	[28, ['SYM', 'DFG']],
	[30, ['SCHEMA']],
	[31, ['AST', 'SCHEMA']],
	[32, ['SCHEMA', 'NORM']],
	[34, ['AST', 'CALL']],
	[35, ['SYM', 'CALL']],
	[36, ['CALL', 'DFG']],
	[39, ['AST', 'CALL']],
	[40, ['AST']],
	[49, ['CALL', 'TAINT']],
	[70, ['AST', 'SYM']],
	[73, ['AST', 'DFG']]
]);

const conclusiveCases = cases.filter(({ findingId }) => CONCLUSIVE_CAPABILITIES.has(findingId));

function defectPredicate(findingId: number, facts: Readonly<Record<string, unknown>>): boolean {
	const n = (key: string): number => facts[key] as number;
	const s = (key: string): string[] => facts[key] as string[];
	switch (findingId) {
		case 1:
			return (
				n('floorGateCallsites') >= 1 &&
				n('aiProducedFalseCallsites') === n('floorGateCallsites') &&
				n('executionFloorWriterSites') === 0
			);
		case 3:
			return (
				n('expectedRevisionDeclarations') >= 1 &&
				n('stateUpdateHandlers') >= 1 &&
				n('expectedRevisionProductionReads') === 0
			);
		case 5:
			return (
				n('eventRegistryEntries') >= 1 &&
				n('productionEventEmissionSites') >= 1 &&
				n('eventRegistryValidationConsumers') === 0
			);
		case 6:
			return (
				n('propertyP4Tests') >= 1 &&
				n('kernelProductionCallers') === 0 &&
				n('liveFloorHardcodedValidEvidenceInputs') >= 1
			);
		case 8:
			return (
				n('documentedAuthorizerPortRequirements') >= 1 &&
				n('exportedAuthorizerPortDeclarations') === 0
			);
		case 11:
			return (
				n('targetSchemaDeclarations') >= 1 &&
				n('postSpreadWeakerRedeclarations') >= 1 &&
				n('constrainedEnvelopeFieldsOverridden') >= 1
			);
		case 12:
			return (
				n('identityProvenanceFloorCallsites') >= 1 &&
				n('identityProvenanceCriterionArguments') === 5 &&
				n('literalTrueCriterionArguments') === 5
			);
		case 17:
			return (
				n('validatePwaHandlers') >= 1 &&
				n('validatedStatusWrites') >= 1 &&
				n('validationEvaluatorCalls') === 0
			);
		case 18:
			return n('pwaAuthoringMutationHandlers') >= 1 && n('semanticVersionProductionWrites') === 0;
		case 22:
			return ['P9', 'P10', 'P11', 'P12'].every(
				(id) => !s('propertyTestIds').includes(id) && !s('gatePropertyIds').includes(id)
			);
		case 23:
			return (
				n('mutationCatalogEntries') >= 1 &&
				n('catalogNonemptyAssertions') >= 1 &&
				n('runnableMutationGateEntries') === 0
			);
		case 28:
			return (
				n('assessmentCreationSites') >= 1 &&
				s('fieldsInitializedEmpty').length === 3 &&
				s('fieldsWithNonemptyProductionWriters').length === 0
			);
		case 30:
			return (
				n('rphIdValidatorDeclarations') >= 1 &&
				n('shapeOnlyValidators') >= 1 &&
				facts.registeredPrefixMembershipEnforced === false
			);
		case 31:
			return (
				n('idBearingPayloadFields') >= 1 &&
				n('bareStringIdPayloadFields') === n('idBearingPayloadFields') &&
				n('prefixedIdPayloadFields') === 0
			);
		case 32:
			return (
				n('independentRegistrySources') >= 2 &&
				JSON.stringify(s('codePrefixSet')) !== JSON.stringify(s('governedPrefixSet'))
			);
		case 34:
			return (
				n('markPwuReadyTransitions') >= 1 &&
				n('readinessGuardCalls') === 0 &&
				n('intentStatusGuardCalls') === 0
			);
		case 35:
			return n('rootReadinessTransitionSites') >= 1 && n('rootReadinessIntentGuardCalls') === 0;
		case 36:
			return (
				n('executionCommandHandlers') >= 1 &&
				n('runtimeBindingIdPayloadFields') >= 1 &&
				n('runtimeBindingIdProductionReads') === 0 &&
				n('authorizedBindingCompositeGateCalls') === 0
			);
		case 39:
			return (
				n('liveFloorResultSites') >= 1 &&
				n('literalTrueEvidenceExistsAssignments') >= 1 &&
				n('admissibilityFunctionDeclarations') >= 1 &&
				n('productionAdmissibilityCalls') === 0
			);
		case 40:
			return (
				n('validatorBoundarySites') >= 1 &&
				n('literalTrueValidatorSchemaChecks') >= 1 &&
				n('validatorSchemaValidationCalls') === 0
			);
		case 49:
			return (
				n('governedTransitionHandlers') >= 1 &&
				n('pipelineAuthorityStages') === 0 &&
				n('handlersWithoutAuthorityChecks') >= 1
			);
		case 70:
			return n('activePlanGuardReads') >= 1 && n('activePlanProductionWriters') === 0;
		case 73:
			return (
				n('versionDriftComparisonCalls') >= 1 &&
				n('aliasedReviewedCandidateArgumentPairs') >= 1 &&
				n('independentReviewedCandidateArgumentPairs') === 0
			);
		default:
			throw new Error('unhandled fixture');
	}
}

function frozenSubject(
	sources: Readonly<Record<string, string>>,
	exactPhysicalPopulation = true,
	excludedUnknownPath = 'node_modules'
): FrozenSubject {
	const bytesByPath = new Map<string, Uint8Array>();
	const artifacts = Object.entries(sources).map(([path, source]) => {
		const bytes = new TextEncoder().encode(source);
		bytesByPath.set(path, bytes);
		return {
			bytes: bytes.byteLength,
			canonicalPathKey: path.toLowerCase(),
			disposition: 'ANALYZED' as const,
			path,
			primaryClass: path.endsWith('.md') ? ('DOCUMENTATION' as const) : ('SOURCE' as const),
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT' as const],
			sha256: createHash('sha256').update(bytes).digest('hex')
		};
	});
	const subject = {
		artifacts,
		descriptor: {
			configurationDigest: 'a'.repeat(64),
			dirtyState: 'CLEAN',
			excludedClasses: [],
			exclusionPolicyIds: [],
			fileManifestDigest: 'b'.repeat(64),
			operationVersion: 'fixture',
			parentRevision: null,
			perimeter: ['.'],
			policyVersion: 'jan-csaa-subject-policy/2.1.0',
			repositoryRoot: '.',
			revision: 'fixture',
			schemaVersion: 'jan-csaa-subject/2.0.0',
			subjectId: 'fixture-subject',
			subjectKind: 'WORKTREE'
		},
		diagnostics: [],
		excludedArtifacts: exactPhysicalPopulation
			? []
			: [
					{
						canonicalPathKey: excludedUnknownPath.toLowerCase(),
						disposition: 'EXCLUDED',
						path: excludedUnknownPath,
						physicalFileCount: 'UNKNOWN',
						policyId: 'fixture-exclusion',
						primaryClass: 'DEPENDENCY',
						reason: 'fixture',
						roles: []
					}
				],
		generatedContexts: [],
		population: {
			analyzed: artifacts.length,
			capturedRecords: artifacts.length + (exactPhysicalPopulation ? 0 : 1),
			capturedRecordsReconcile: true,
			discovered: artifacts.length,
			discoveredPhysicalFiles: exactPhysicalPopulation ? artifacts.length : 'UNKNOWN',
			excluded: 0,
			excludedPhysicalFiles: exactPhysicalPopulation ? 0 : 'UNKNOWN',
			excludedRecords: exactPhysicalPopulation ? 0 : 1,
			failed: 0,
			included: artifacts.length,
			includedDispositionReconciles: true,
			inventoryOnly: 0,
			knownPhysicalLowerBoundReconciles: true,
			physicalPopulationReconciles: exactPhysicalPopulation ? true : 'UNKNOWN',
			reconciles: true,
			reconciliationScope: exactPhysicalPopulation
				? 'EXACT_PHYSICAL_POPULATION'
				: 'CAPTURED_RECORDS_ONLY'
		},
		projects: [],
		request: {},
		testPopulations: [],
		workspaces: [],
		workingChangeSet: null
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, bytesByPath);
	return subject;
}

function fixtureRequest(
	sources: Readonly<Record<string, string>>,
	options: {
		readonly exactPhysicalPopulation?: boolean;
		readonly excludedUnknownPath?: string;
		readonly executionDisposition?: 'NOT_RUN' | 'RUN';
		readonly freshnessState?: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
	} = {}
) {
	return {
		budgets: JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS,
		executionDisposition: options.executionDisposition ?? ('RUN' as const),
		executionId: 'fixture-native-run',
		freshness: {
			changedPaths: [],
			diagnostics: [],
			state: options.freshnessState ?? ('CURRENT' as const)
		},
		operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
		schemaVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_REQUEST_SCHEMA_VERSION,
		subject: frozenSubject(
			sources,
			options.exactPhysicalPopulation ?? true,
			options.excludedUnknownPath
		)
	};
}

function mutableRecord(value: unknown): Record<string, unknown> {
	return value as Record<string, unknown>;
}

function expectUnsupportedNativeLayout(
	findingId: number,
	sources: Readonly<Record<string, string>>,
	codes: readonly string[]
): void {
	const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
	expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
	if (outcome.outcome !== 'projected') return;

	const projection = outcome.result.projections.find(
		(candidate) => candidate.findingId === findingId
	);
	expect(projection).toBeDefined();
	if (projection === undefined) return;
	expect(projection.support.uncertainties).toEqual(
		expect.arrayContaining(codes.map((code) => expect.stringContaining(code)))
	);
	expect(projection.projectionState).toBe('UNAVAILABLE');
	expect(projection.population.closure).toBe('OPEN');
	if (projection.evaluation.outcome === 'evaluated')
		expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
}

describe('JPWB harmonization native projection', () => {
	it.each(cases)(
		'finding $findingId diagnostic extractor discriminates its planted defect and nearby control',
		({ findingId, positive, negative }) => {
			const positiveFacts = projectJpwbHarmonizationRuleFactsFromCapturedSources(
				findingId,
				positive
			).facts;
			const negativeFacts = projectJpwbHarmonizationRuleFactsFromCapturedSources(
				findingId,
				negative
			).facts;
			expect(defectPredicate(findingId, positiveFacts)).toBe(true);
			expect(defectPredicate(findingId, negativeFacts)).toBe(false);
		}
	);

	it('finding 28 ignores same-named fields outside the direct assessment birth and next-state surfaces', () => {
		const projection = projectJpwbHarmonizationRuleFactsFromCapturedSources(28, {
			'packages/rph-application/src/handlers/assurance.ts':
				'export function requestAssuranceAssessment() { const state = { evidenceConsideredIds: [], evidenceRejected: [], residualUncertainty: [] }; const eventPayload = { evidenceConsideredIds: suppliedEvidence }; return state; }\nexport const complete = () => commitState(ctx, command, { objectType: ASSESSMENT, nextState: { audit: { evidenceRejected: suppliedEvidence } } });\n'
		});
		expect(projection.facts.fieldsWithNonemptyProductionWriters).toEqual([]);
		expect(defectPredicate(28, projection.facts)).toBe(true);
	});

	it('finding 49 does not treat authority-named telemetry as an enforcement stage', () => {
		const projection = projectJpwbHarmonizationRuleFactsFromCapturedSources(49, {
			'packages/rph-application/src/command-bus.ts':
				'export function dispatch() { recordAuthorityMetric(); return handler(); }\n',
			'packages/rph-application/src/handlers/registry.ts':
				'export const HANDLERS = { MarkPwuReady: markPwuReady };\n',
			'packages/rph-application/src/handlers/pwu.ts':
				'export const markPwuReady = () => { recordAuthorizationLatency(); return advance(); };\n'
		});
		expect(projection.facts).toMatchObject({
			governedTransitionHandlers: 1,
			handlersWithoutAuthorityChecks: 1,
			pipelineAuthorityStages: 0
		});
		expect(projection.uncertainties).toEqual(
			expect.arrayContaining([
				'AUTHORITY_LIKE_HANDLER_CALL_UNRESOLVED:MarkPwuReady',
				'AUTHORITY_LIKE_PIPELINE_CALL_UNRESOLVED'
			])
		);
	});

	it('finding 8 does not treat a nearby non-exported declaration as the required port surface', () => {
		const projection = projectJpwbHarmonizationRuleFactsFromCapturedSources(8, {
			[IMPLEMENTATION_GUIDE]: AUTHORIZE_AT_ACTION_TIME_REQUIREMENT,
			'packages/rph-ports/src/index.ts':
				'interface CapabilityAuthorizerPort { authorize(): boolean }\nexport const VERSION = 1;\n'
		});
		expect(projection.facts).toEqual({
			documentedAuthorizerPortRequirements: 1,
			exportedAuthorizerPortDeclarations: 0
		});
		expect(defectPredicate(8, projection.facts)).toBe(true);
	});

	it.each([
		{
			code: 'FLOOR_GATE_AI_PRODUCED_VALUE_UNRESOLVED:',
			findingId: 1,
			sources: {
				'packages/rph-application/src/handlers/execution.ts':
					'export const run = () => floorGateBlock(ctx, id, { aiProduced });\n'
			}
		},
		{
			code: 'EXPECTED_REVISION_RECEIVER_UNRESOLVED:',
			findingId: 3,
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export interface Command { readonly expectedRevision: number }\n',
				'packages/rph-application/src/handler.ts':
					'export const update = (cache: any) => { void cache.expectedRevision; return commitState(); };\n'
			}
		},
		{
			code: 'EVENT_REGISTRY_VALIDATION_ORIGIN_UNRESOLVED:',
			findingId: 5,
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export const EVENTS = { Created: { payload: schema } } as const;\n',
				'packages/rph-contracts/src/validate.ts':
					'export const validate = (ratifiedEventPayload: any, event: any) => ratifiedEventPayload.safeParse(event.payload);\n',
				'packages/rph-application/src/handlers/kit.ts': 'export const emit = () => makeEvent();\n'
			}
		},
		{
			code: 'MUTATION_EXECUTION_CATALOG_LINK_UNRESOLVED:',
			findingId: 23,
			sources: {
				'packages/rph-domain/src/conformance.test.ts':
					'expect(catalog.mutationCatalog.length).toBeGreaterThan(0); executeMutation();\n',
				'packages/rph-domain/vocab/m12-conformance.json': '{"mutationCatalog":[{"id":"M1"}]}'
			}
		},
		{
			code: 'AUTHORITY_PIPELINE_RESULT_NOT_CONTROL_BOUND',
			findingId: 49,
			sources: {
				'packages/rph-application/src/command-bus.ts':
					'export function dispatch() { authorize(command); return handler(); }\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = { MarkPwuReady: markPwuReady };\n',
				'packages/rph-application/src/handlers/pwu.ts':
					'export const markPwuReady = () => authorizeTransition() ? advance() : reject();\n'
			}
		}
	])(
		'finding $findingId preserves an unclassified hostile layout as unsupported',
		({ code, findingId, sources }) => {
			const capturedSources = Object.fromEntries(
				Object.entries(sources).filter(
					(entry): entry is [string, string] => typeof entry[1] === 'string'
				)
			);
			const extracted = projectJpwbHarmonizationRuleFactsFromCapturedSources(
				findingId,
				capturedSources
			);
			expect(extracted.uncertainties).toEqual(
				expect.arrayContaining([expect.stringContaining(code)])
			);
			const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(capturedSources));
			expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
			if (outcome.outcome !== 'projected') return;
			const projection = outcome.result.projections.find(
				(candidate) => candidate.findingId === findingId
			)!;
			expect(projection.projectionState).toBe('UNAVAILABLE');
			expect(projection.population.closure).toBe('OPEN');
			if (projection.evaluation.outcome === 'evaluated') {
				expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
				expect(projection.evaluation.result.status).not.toBe('NOT_DETECTED');
			}
		}
	);

	it.each(
		conclusiveCases.flatMap((entry) => [
			{
				expectedStatus: 'DETECTED' as const,
				findingId: entry.findingId,
				polarity: 'positive',
				sources: entry.positive
			},
			{
				expectedStatus: 'NOT_DETECTED' as const,
				findingId: entry.findingId,
				polarity: 'negative',
				sources: entry.negative
			}
		])
	)(
		'finding $findingId $polarity reaches $expectedStatus through the production operation',
		({ expectedStatus, findingId, sources }) => {
			const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
			expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
			if (outcome.outcome !== 'projected') return;
			const projection = outcome.result.projections.find(
				(candidate) => candidate.findingId === findingId
			);
			expect(projection).toBeDefined();
			if (projection === undefined || projection.evaluation.outcome !== 'evaluated') return;
			const expectedCapabilities = CONCLUSIVE_CAPABILITIES.get(findingId)!;
			const surfaceByCapability: Readonly<Record<string, string>> = {
				AST: 'SEMANTIC_AST',
				CALL: 'CALL_GRAPH',
				DFG: 'READ_WRITE_ACCESS_GRAPH',
				NORM: 'NORMATIVE_REGISTRY',
				SCHEMA: 'SCHEMA_PROJECTION',
				SYM: 'SEMANTIC_SYMBOLS',
				TAINT: 'TAINT_PROJECTION',
				TEST: 'TEST_CENSUS'
			};
			const expectedSurfaces = expectedCapabilities
				.map((capability) => surfaceByCapability[capability]!)
				.sort();
			expect(projection.projectionState).toBe('CURRENT_CLOSED');
			expect(projection.population.closure).toBe('CLOSED');
			expect(projection.availableCapabilities).toEqual(expectedCapabilities);
			expect(projection.support).toMatchObject({
				actualCapabilities: expectedCapabilities,
				actualProjectionSurfaces: expectedSurfaces,
				exactPhysicalPopulation: true,
				missingMandatoryInputIds: [],
				physicalPopulationBasis: 'EXACT_WHOLE_SUBJECT',
				uncertainties: []
			});
			expect(projection.evaluation.result).toMatchObject({
				missingCapabilities: [],
				missingProjectionSurfaces: [],
				status: expectedStatus
			});
			expect(projection.evaluation.result.finding === null).toBe(expectedStatus === 'NOT_DETECTED');
			expect(outcome.result.currentness.basis).toBe('CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED');
		}
	);

	it('keeps a missing or malformed normative population unsupported rather than not detected', () => {
		const missingGuide = runJpwbHarmonizationNativeProjection(
			fixtureRequest({
				'packages/rph-ports/src/index.ts':
					'export interface CapabilityAuthorizerPort { authorize(): boolean }\n'
			})
		);
		expect(missingGuide.outcome, JSON.stringify(missingGuide)).toBe('projected');
		if (missingGuide.outcome === 'projected') {
			const finding8 = missingGuide.result.projections.find(({ findingId }) => findingId === 8)!;
			expect(finding8.projectionState).toBe('UNAVAILABLE');
			expect(finding8.support.missingMandatoryInputIds).toContain('governed-implementation-guide');
			if (finding8.evaluation.outcome === 'evaluated')
				expect(finding8.evaluation.result.status).toBe('UNSUPPORTED');
		}

		const malformedGuide = runJpwbHarmonizationNativeProjection(
			fixtureRequest({
				[IMPLEMENTATION_GUIDE]: '### 14.2 Mandatory generative properties\n\nnot a registry\n',
				'packages/rph-domain/src/conformance.test.ts': "expect(ids).toEqual(['P1']);\n",
				'packages/rph-domain/src/conformance-manifest.ts':
					"export const PROPERTY_COVERAGE = { P1: 'x' } as const;\n"
			})
		);
		expect(malformedGuide.outcome, JSON.stringify(malformedGuide)).toBe('projected');
		if (malformedGuide.outcome === 'projected') {
			const finding22 = malformedGuide.result.projections.find(
				({ findingId }) => findingId === 22
			)!;
			expect(finding22.projectionState).toBe('UNAVAILABLE');
			expect(finding22.support.uncertainties).toContain(
				'MANDATORY_PROPERTY_REGISTRY_EMPTY_OR_UNRECOGNIZED'
			);
			if (finding22.evaluation.outcome === 'evaluated') {
				expect(finding22.evaluation.result.status).toBe('UNSUPPORTED');
				expect(finding22.evaluation.result.status).not.toBe('NOT_DETECTED');
			}
		}
	});

	it('binds mutation-equivalent facts and their exact population to changed frozen source bytes', () => {
		const baselineSources = cases.find(({ findingId }) => findingId === 22)!.positive;
		const mutatedSources = {
			...baselineSources,
			[IMPLEMENTATION_GUIDE]: MANDATORY_PROPERTY_REGISTRY.replace(
				'Requirement 12.',
				'Requirement twelve.'
			)
		};
		const baseline = runJpwbHarmonizationNativeProjection(fixtureRequest(baselineSources));
		const mutated = runJpwbHarmonizationNativeProjection(fixtureRequest(mutatedSources));
		expect(baseline.outcome, JSON.stringify(baseline)).toBe('projected');
		expect(mutated.outcome, JSON.stringify(mutated)).toBe('projected');
		if (baseline.outcome !== 'projected' || mutated.outcome !== 'projected') return;
		const before = baseline.result.projections.find(({ findingId }) => findingId === 22)!;
		const after = mutated.result.projections.find(({ findingId }) => findingId === 22)!;
		expect(after.factProjection).toEqual(before.factProjection);
		expect(after.population.members).toHaveLength(12);
		expect(after.population.members).toEqual(
			expect.arrayContaining([
				expect.stringContaining(`${IMPLEMENTATION_GUIDE}#P1@`),
				expect.stringContaining(`${IMPLEMENTATION_GUIDE}#P12@`)
			])
		);
		expect(after.population.sha256).not.toBe(before.population.sha256);
		expect(after.provenance.map(({ sha256 }) => sha256)).not.toEqual(
			before.provenance.map(({ sha256 }) => sha256)
		);
		expect(mutated.result.currentness.sourceSha256).not.toBe(
			baseline.result.currentness.sourceSha256
		);
	});

	it('closes only the declared rule-eligible path population when whole-subject exclusions are disjoint', () => {
		const sources = conclusiveCases.find(({ findingId }) => findingId === 12)!.positive;
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest(sources, { exactPhysicalPopulation: false })
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 12)!;
		expect(projection.population.closure).toBe('CLOSED');
		expect(projection.projectionState).toBe('CURRENT_CLOSED');
		expect(projection.support).toMatchObject({
			exactPhysicalPopulation: true,
			physicalPopulationBasis: 'EXACT_RULE_ELIGIBLE_PATH_POPULATION'
		});
		if (projection.evaluation.outcome !== 'evaluated') return;
		expect(projection.evaluation.result).toMatchObject({
			missingCapabilities: [],
			missingProjectionSurfaces: [],
			status: 'DETECTED'
		});
	});

	it('keeps a supported detector open when an unknown exclusion intersects its eligible path tree', () => {
		const sources = conclusiveCases.find(({ findingId }) => findingId === 12)!.positive;
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest(sources, {
				exactPhysicalPopulation: false,
				excludedUnknownPath: 'packages/rph-assurance/src/generated'
			})
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 12)!;
		expect(projection.population.closure).toBe('OPEN');
		expect(projection.projectionState).toBe('UNAVAILABLE');
		expect(projection.support).toMatchObject({
			exactPhysicalPopulation: false,
			physicalPopulationBasis: 'OPEN'
		});
		if (projection.evaluation.outcome !== 'evaluated') return;
		expect(projection.evaluation.result).toMatchObject({
			missingCapabilities: [],
			missingProjectionSurfaces: [],
			status: 'UNSUPPORTED'
		});
	});

	it('reports NOT_RUN without projecting facts or capabilities', () => {
		const sources = conclusiveCases.find(({ findingId }) => findingId === 12)!.positive;
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest(sources, { executionDisposition: 'NOT_RUN' })
		);
		expect(outcome.outcome).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		expect(outcome.result.capability.detectorExecution).toBe('NOT_RUN');
		expect(outcome.result.projections).toHaveLength(23);
		expect(outcome.result.currentRepositoryStatusTotals).toMatchObject({ NOT_RUN: 23 });
		for (const projection of outcome.result.projections) {
			expect(projection.projectionState).toBe('NOT_RUN');
			expect(projection.availableCapabilities).toEqual([]);
			expect(projection.factProjection).toEqual([]);
			expect(projection.population.closure).toBe('OPEN');
			if (projection.evaluation.outcome === 'evaluated')
				expect(projection.evaluation.result.status).toBe('NOT_RUN');
		}
	});

	it('preserves stale caller declaration without presenting it as independent currentness', () => {
		const sources = conclusiveCases.find(({ findingId }) => findingId === 12)!.positive;
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest(sources, { freshnessState: 'STALE' })
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		expect(outcome.result.currentness).toMatchObject({
			basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
			state: 'STALE'
		});
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 12)!;
		expect(projection.projectionState).toBe('STALE');
		if (projection.evaluation.outcome === 'evaluated')
			expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
	});

	it('fails a supported detector closed on unrecognized source layout', () => {
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest({
				'packages/rph-contracts/src/messages.ts':
					'export const PayloadSchema = z.strictObject({ objectId: makeIdSchema() });\n'
			})
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 31)!;
		expect(projection.population.closure).toBe('OPEN');
		expect(projection.availableCapabilities).toEqual([]);
		expect(projection.support.uncertainties).toEqual([
			expect.stringContaining('ID_FIELD_SCHEMA_UNRECOGNIZED:')
		]);
		if (projection.evaluation.outcome === 'evaluated')
			expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
	});

	it('keeps finding 12 open when the criterion facts are supplied by a valid non-inline expression', () => {
		const sources = {
			'packages/rph-assurance/src/validators.ts':
				'const facts = { hasStableId: true, hasSemanticVersion: true, hasProvenance: true, hasProducer: true, traceComplete: true } as const;\nexport const run = () => identityProvenanceValidator(subject, facts);\n'
		};
		const extracted = projectJpwbHarmonizationRuleFactsFromCapturedSources(12, sources);
		expect(extracted.facts).toMatchObject({
			identityProvenanceCriterionArguments: 0,
			identityProvenanceFloorCallsites: 1,
			literalTrueCriterionArguments: 0
		});
		expect(extracted.uncertainties).toEqual([
			expect.stringContaining('IDENTITY_PROVENANCE_FACT_ARGUMENT_LAYOUT_UNSUPPORTED:')
		]);

		const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 12)!;
		expect(projection.population.closure).toBe('OPEN');
		expect(projection.projectionState).toBe('UNAVAILABLE');
		expect(projection.support.uncertainties).toEqual(extracted.uncertainties);
		if (projection.evaluation.outcome === 'evaluated') {
			expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
			expect(projection.evaluation.result.status).not.toBe('NOT_DETECTED');
		}
	});

	it('keeps finding 31 open for shorthand Zod shape members, including id-bearing fields', () => {
		const sources = {
			'packages/rph-contracts/src/messages.ts':
				'const objectId = RphIdSchema;\nconst label = z.string();\nexport const CreatePayloadSchema = z.strictObject({ objectId, label });\n'
		};
		const extracted = projectJpwbHarmonizationRuleFactsFromCapturedSources(31, sources);
		expect(extracted.facts).toMatchObject({
			bareStringIdPayloadFields: 0,
			idBearingPayloadFields: 1,
			prefixedIdPayloadFields: 0
		});
		expect(extracted.uncertainties).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/PAYLOAD_SCHEMA_FIELD_LAYOUT_UNSUPPORTED:.*#objectId@/u),
				expect.stringMatching(/PAYLOAD_SCHEMA_FIELD_LAYOUT_UNSUPPORTED:.*#label@/u)
			])
		);

		const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 31)!;
		expect(projection.population.closure).toBe('OPEN');
		expect(projection.projectionState).toBe('UNAVAILABLE');
		expect(projection.support.uncertainties).toEqual(extracted.uncertainties);
		if (projection.evaluation.outcome === 'evaluated') {
			expect(projection.evaluation.result.status).toBe('UNSUPPORTED');
			expect(projection.evaluation.result.status).not.toBe('NOT_DETECTED');
		}
	});

	it('preserves the exact analyzed identities and count for a multi-member population', () => {
		const sources = {
			'packages/rph-contracts/src/messages.ts':
				'export const CreatePayloadSchema = z.strictObject({ objectId: z.string(), relatedIds: z.array(z.string()), parentId: RphIdSchema });\n'
		};
		const extracted = projectJpwbHarmonizationRuleFactsFromCapturedSources(31, sources);
		const expectedMembers = [...extracted.members].sort();
		expect(expectedMembers).toHaveLength(3);

		const outcome = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome !== 'projected') return;
		const projection = outcome.result.projections.find(({ findingId }) => findingId === 31)!;
		const expectedPopulationWitness = canonicalSemanticJsonWitness({
			findingId: 31,
			members: expectedMembers,
			sourceSha256: outcome.result.currentness.sourceSha256,
			subjectId: outcome.result.currentness.frozenSubjectId
		});
		expect(projection.population).toEqual({
			closure: 'CLOSED',
			count: expectedMembers.length,
			members: expectedMembers,
			populationId: `jpwb-harmonization-population:31:${expectedPopulationWitness.sha256}`,
			sha256: expectedPopulationWitness.sha256
		});
		expect(projection.population.members).not.toEqual([
			expect.stringContaining('jpwb-harmonization-member-census:')
		]);
	});

	it('admits the evaluator population ceiling and refuses the next member without collapsing it', () => {
		const atCeilingCount = 512;
		const atCeilingFields = Array.from(
			{ length: atCeilingCount },
			(_, index) => `object${String(index).padStart(3, '0')}Id: z.string()`
		).join(', ');
		const admitted = runJpwbHarmonizationNativeProjection(
			fixtureRequest({
				'packages/rph-contracts/src/messages.ts': `export const BulkPayloadSchema = z.strictObject({ ${atCeilingFields} });\n`
			})
		);
		expect(admitted.outcome, JSON.stringify(admitted)).toBe('projected');
		if (admitted.outcome === 'projected')
			expect(
				admitted.result.projections.find(({ findingId }) => findingId === 31)?.population.count
			).toBe(atCeilingCount);

		const memberCount = atCeilingCount + 1;
		const fields = Array.from(
			{ length: memberCount },
			(_, index) => `object${String(index).padStart(3, '0')}Id: z.string()`
		).join(', ');
		const sources = {
			'packages/rph-contracts/src/messages.ts': `export const BulkPayloadSchema = z.strictObject({ ${fields} });\n`
		};
		const extracted = projectJpwbHarmonizationRuleFactsFromCapturedSources(31, sources);
		expect(extracted.members).toHaveLength(memberCount);

		const refused = runJpwbHarmonizationNativeProjection(fixtureRequest(sources));
		expect(refused).toMatchObject({
			diagnostics: [{ code: 'POPULATION_MEMBER_BUDGET_EXCEEDED' }],
			outcome: 'unavailable',
			result: null,
			state: 'resource-refused'
		});
	});

	it('refuses parse-invalid selected source rather than treating it as an empty population', () => {
		const outcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest({
				'packages/rph-assurance/src/validators.ts': 'export const run = (\n'
			})
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'SOURCE_PARSE_FAILED' }],
			outcome: 'unavailable',
			state: 'incompatible'
		});
	});

	it('keeps the fixed 75-row fixture benchmark separate from native current-source status', () => {
		const nativeOutcome = runJpwbHarmonizationNativeProjection(
			fixtureRequest(conclusiveCases.find(({ findingId }) => findingId === 12)!.positive)
		);
		expect(nativeOutcome.outcome).toBe('projected');
		if (nativeOutcome.outcome === 'projected')
			expect(nativeOutcome.result).not.toHaveProperty('benchmarkAccounting');
		const accounting = runHarmonizationBenchmarkAccounting(
			createHarmonizationFirstIncrementBenchmarkAccountingRequest(
				'fixture-native-separation-accounting'
			)
		);
		expect(accounting.outcome, JSON.stringify(accounting)).toBe('accounted');
		if (accounting.outcome !== 'accounted') return;
		expect(accounting.result.rows).toHaveLength(75);
		expect(accounting.result.accounting.firstIncrement).toMatchObject({
			statusTotals: {
				DETECTED: 23,
				NOT_APPLICABLE: 0,
				NOT_DETECTED: 0,
				NOT_RUN: 0,
				UNSUPPORTED: 0
			},
			total: 23
		});
	});

	it('fails hostile request objects closed without invoking accessors', () => {
		let accessed = false;
		const hostile = new Proxy(
			{},
			{
				get() {
					accessed = true;
					throw new Error('must not execute');
				}
			}
		);
		const outcome = runJpwbHarmonizationNativeProjection(hostile);
		expect(outcome).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
		expect(accessed).toBe(false);
	});

	it('fails hostile nested budget accessors closed without invoking them', () => {
		let accessed = false;
		const budgets = Object.create(null) as Record<string, unknown>;
		for (const [key, value] of Object.entries(
			JPWB_HARMONIZATION_NATIVE_PROJECTION_DEFAULT_BUDGETS
		)) {
			if (key === 'maxAstNodes')
				Object.defineProperty(budgets, key, {
					enumerable: true,
					get() {
						accessed = true;
						throw new Error('must not execute');
					}
				});
			else Object.defineProperty(budgets, key, { enumerable: true, value });
		}
		const request = fixtureRequest(conclusiveCases[0]!.positive);
		const outcome = runJpwbHarmonizationNativeProjection({ ...request, budgets });
		expect(outcome).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
		expect(accessed).toBe(false);
	});

	it('fails hostile nested subject accessors closed without invoking them', () => {
		let accessed = false;
		const valid = frozenSubject(conclusiveCases[0]!.positive);
		const hostileSubject = { ...valid } as FrozenSubject;
		Object.defineProperty(hostileSubject, 'artifacts', {
			enumerable: true,
			get() {
				accessed = true;
				throw new Error('must not execute');
			}
		});
		attachFrozenSubjectBytes(hostileSubject, new Map());
		const request = fixtureRequest(conclusiveCases[0]!.positive);
		const outcome = runJpwbHarmonizationNativeProjection({ ...request, subject: hostileSubject });
		expect(outcome).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
		expect(accessed).toBe(false);
	});

	it('enforces the AST visitor budget', () => {
		const request = fixtureRequest(conclusiveCases[0]!.positive);
		const outcome = runJpwbHarmonizationNativeProjection({
			...request,
			budgets: { ...request.budgets, maxAstNodes: 1 }
		});
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'AST_NODE_BUDGET_EXCEEDED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it('enforces maxResultBytes against the complete public projected outcome', () => {
		const sources = conclusiveCases.find(({ findingId }) => findingId === 12)!.negative;
		const baselineRequest = fixtureRequest(sources);
		const baseline = runJpwbHarmonizationNativeProjection(baselineRequest);
		expect(baseline.outcome, JSON.stringify(baseline)).toBe('projected');
		if (baseline.outcome !== 'projected') return;
		const publicOutcomeBytes = canonicalSemanticJsonWitness(baseline).bytes;
		expect(publicOutcomeBytes).toBeGreaterThan(baseline.result.resultWitness.bytes);

		const exact = runJpwbHarmonizationNativeProjection({
			...baselineRequest,
			budgets: { ...baselineRequest.budgets, maxResultBytes: publicOutcomeBytes }
		});
		expect(exact.outcome, JSON.stringify(exact)).toBe('projected');
		if (exact.outcome === 'projected')
			expect(canonicalSemanticJsonWitness(exact).bytes).toBe(publicOutcomeBytes);

		const oneByteShort = runJpwbHarmonizationNativeProjection({
			...baselineRequest,
			budgets: { ...baselineRequest.budgets, maxResultBytes: publicOutcomeBytes - 1 }
		});
		expect(oneByteShort).toMatchObject({
			diagnostics: [{ code: 'RESULT_BUDGET_EXCEEDED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it.each([
		{
			code: 'REQUEST_INVALID',
			name: 'non-object budgets',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.budgets = new Date();
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a negative integer budget',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), maxAstNodes: -1 };
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a zero duration budget',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), maxDurationMs: 0 };
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an unexpected budget key',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), unexpected: true };
			}
		},
		{
			code: 'FROZEN_SUBJECT_CAPABILITY_REQUIRED',
			name: 'a serialized subject copy without retained bytes',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.subject = { ...mutableRecord(request.subject) };
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a proxied artifact array',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).artifacts = new Proxy([], {});
			}
		},
		{
			code: 'REQUEST_BUDGET_EXCEEDED',
			name: 'an artifact array above the admitted ceiling',
			state: 'resource-refused',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), maxArtifacts: 0 };
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a sparse artifact array',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).artifacts = new Array<unknown>(1);
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an artifact array with a named enumerable property',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				const subject = mutableRecord(request.subject);
				const artifacts = [...(subject.artifacts as unknown[])];
				Object.defineProperty(artifacts, 'named', { enumerable: true, value: true });
				subject.artifacts = artifacts;
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a non-record artifact',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).artifacts = [new Date()];
			}
		},
		{
			code: 'RECONCILIATION_INVALID',
			name: 'an invalid artifact disposition',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				const subject = mutableRecord(request.subject);
				const artifact = (subject.artifacts as unknown[])[0]!;
				subject.artifacts = [{ ...mutableRecord(artifact), disposition: 'BROKEN' }];
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a noncanonical artifact path',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				const artifact = (mutableRecord(request.subject).artifacts as unknown[])[0]!;
				mutableRecord(artifact).path = '../escape.ts';
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an invalid artifact digest',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				const artifact = (mutableRecord(request.subject).artifacts as unknown[])[0]!;
				mutableRecord(artifact).sha256 = 'A'.repeat(64);
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'duplicate artifact paths',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				const subject = mutableRecord(request.subject);
				const artifact = (subject.artifacts as unknown[])[0]!;
				subject.artifacts = [artifact, { ...mutableRecord(artifact) }];
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a non-record descriptor',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).descriptor = new Date();
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a non-record population',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).population = new Date();
			}
		},
		{
			code: 'REQUEST_BUDGET_EXCEEDED',
			name: 'a combined included and excluded population above the ceiling',
			state: 'resource-refused',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), maxArtifacts: 1 };
				mutableRecord(request.subject).excludedArtifacts = [
					{ path: 'node_modules', physicalFileCount: 'UNKNOWN' }
				];
			}
		},
		{
			code: 'RECONCILIATION_INVALID',
			name: 'a non-record excluded artifact',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(request.subject).excludedArtifacts = [new Date()];
			}
		},
		{
			code: 'RECONCILIATION_INVALID',
			name: 'non-reconciling serialized population arithmetic',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(mutableRecord(request.subject).population).reconciles = false;
			}
		},
		{
			code: 'RECONCILIATION_INVALID',
			name: 'an invalid physical-population scope',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				mutableRecord(mutableRecord(request.subject).population).reconciliationScope = 'BROKEN';
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'non-record freshness',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.freshness = new Date();
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an invalid freshness state',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.freshness = { ...mutableRecord(request.freshness), state: 'BROKEN' };
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'duplicate freshness paths',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.freshness = {
					...mutableRecord(request.freshness),
					changedPaths: ['same.ts', 'same.ts']
				};
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'a non-scalar freshness path',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.freshness = {
					...mutableRecord(request.freshness),
					changedPaths: ['\ud800']
				};
			}
		},
		{
			code: 'REQUEST_VERSION_UNSUPPORTED',
			name: 'an unsupported request schema',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.schemaVersion = 'unsupported';
			}
		},
		{
			code: 'OPERATION_VERSION_UNSUPPORTED',
			name: 'an unsupported operation version',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.operationVersion = 'unsupported';
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an invalid execution disposition',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.executionDisposition = 'BROKEN';
			}
		},
		{
			code: 'REQUEST_INVALID',
			name: 'an invalid execution identifier',
			state: 'incompatible',
			mutate(request: Record<string, unknown>) {
				request.executionId = '\ud800';
			}
		},
		{
			code: 'SOURCE_BYTE_BUDGET_EXCEEDED',
			name: 'selected bytes above the source budget',
			state: 'resource-refused',
			mutate(request: Record<string, unknown>) {
				request.budgets = { ...mutableRecord(request.budgets), maxSourceBytes: 0 };
			}
		}
	] satisfies readonly {
		readonly code: string;
		readonly name: string;
		readonly state: 'failed' | 'incompatible' | 'resource-refused';
		readonly mutate: (request: Record<string, unknown>) => void;
	}[])('fails $name closed through the public operation', ({ code, mutate, state }) => {
		const request = fixtureRequest(conclusiveCases[0]!.positive) as unknown as Record<
			string,
			unknown
		>;
		mutate(request);
		expect(runJpwbHarmonizationNativeProjection(request)).toMatchObject({
			diagnostics: [{ code }],
			outcome: 'unavailable',
			result: null,
			state
		});
	});

	it.each([
		{
			code: 'FROZEN_BYTES_UNAVAILABLE',
			name: 'missing retained bytes',
			state: 'failed',
			prepare(subject: FrozenSubject, _path: string) {
				attachFrozenSubjectBytes(subject, new Map());
			}
		},
		{
			code: 'FROZEN_BYTES_MISMATCH',
			name: 'retained bytes that disagree with the manifest',
			state: 'failed',
			prepare(subject: FrozenSubject, path: string) {
				attachFrozenSubjectBytes(subject, new Map([[path, new TextEncoder().encode('tampered')]]));
			}
		},
		{
			code: 'SOURCE_ENCODING_UNSUPPORTED',
			name: 'selected source that is not UTF-8',
			state: 'incompatible',
			prepare(subject: FrozenSubject, path: string) {
				const bytes = Uint8Array.of(0xff);
				const artifact = (mutableRecord(subject).artifacts as unknown[])[0]!;
				mutableRecord(artifact).bytes = bytes.byteLength;
				mutableRecord(artifact).sha256 = createHash('sha256').update(bytes).digest('hex');
				attachFrozenSubjectBytes(subject, new Map([[path, bytes]]));
			}
		}
	] satisfies readonly {
		readonly code: string;
		readonly name: string;
		readonly state: 'failed' | 'incompatible';
		readonly prepare: (subject: FrozenSubject, path: string) => void;
	}[])('fails $name closed', ({ code, prepare, state }) => {
		const sources = conclusiveCases[0]!.positive;
		const request = fixtureRequest(sources);
		prepare(request.subject, Object.keys(sources)[0]!);
		expect(runJpwbHarmonizationNativeProjection(request)).toMatchObject({
			diagnostics: [{ code }],
			outcome: 'unavailable',
			state
		});
	});

	it('admits changed-path data and a known excluded physical count', () => {
		const sources = conclusiveCases[0]!.positive;
		const request = fixtureRequest(sources, { exactPhysicalPopulation: false });
		const subject = mutableRecord(request.subject);
		const excluded = (subject.excludedArtifacts as unknown[])[0]!;
		mutableRecord(excluded).physicalFileCount = 1;
		const population = mutableRecord(subject.population);
		population.excluded = 1;
		population.discovered = (subject.artifacts as unknown[]).length + 1;
		const changedPath = Object.keys(sources)[0]!;
		const outcome = runJpwbHarmonizationNativeProjection({
			...request,
			freshness: { ...request.freshness, changedPaths: [changedPath] }
		});
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('projected');
		if (outcome.outcome === 'projected')
			expect(outcome.result.currentness.changedPaths).toEqual([changedPath]);
	});

	const unsupportedNativeLayoutCases: readonly {
		readonly codes: readonly string[];
		readonly findingId: number;
		readonly name: string;
		readonly sources: Readonly<Record<string, string>>;
	}[] = [
		{
			codes: ['AUTHORIZER_REEXPORT_REQUIRES_SYMBOL_RESOLUTION:'],
			findingId: 8,
			name: 'an authorizer re-export',
			sources: {
				[IMPLEMENTATION_GUIDE]: AUTHORIZE_AT_ACTION_TIME_REQUIREMENT,
				'packages/rph-ports/src/index.ts':
					'interface CapabilityAuthorizerPort { authorize(): boolean }\nexport { CapabilityAuthorizerPort };\n'
			}
		},
		{
			codes: ['TARGET_SCHEMA_DECLARATION_AMBIGUOUS'],
			findingId: 11,
			name: 'duplicate target schema declarations',
			sources: {
				'packages/rph-contracts/src/objects.ts':
					'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape });\nexport const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape });\n',
				'packages/rph-contracts/src/envelopes.ts':
					'export const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\n'
			}
		},
		{
			codes: ['TARGET_SCHEMA_OBJECT_LAYOUT_UNSUPPORTED'],
			findingId: 11,
			name: 'an indirect target schema root',
			sources: {
				'packages/rph-contracts/src/objects.ts':
					'export const AssurancePolicyDefinitionSchema = makeSchema();\n',
				'packages/rph-contracts/src/envelopes.ts':
					'export const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\n'
			}
		},
		{
			codes: ['OBJECT_ENVELOPE_SHAPE_DECLARATION_AMBIGUOUS'],
			findingId: 11,
			name: 'duplicate object-envelope declarations',
			sources: {
				'packages/rph-contracts/src/objects.ts':
					'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape });\n',
				'packages/rph-contracts/src/envelopes.ts':
					'export const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\nexport const objectEnvelopeShape = { id: RphIdSchema, semanticVersion: SemanticVersionSchema } as const;\n'
			}
		},
		{
			codes: ['OBJECT_ENVELOPE_SHAPE_LAYOUT_UNSUPPORTED'],
			findingId: 11,
			name: 'an indirect object-envelope root',
			sources: {
				'packages/rph-contracts/src/objects.ts':
					'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...objectEnvelopeShape });\n',
				'packages/rph-contracts/src/envelopes.ts':
					'export const objectEnvelopeShape = makeEnvelope();\n'
			}
		},
		{
			codes: [
				'TARGET_SCHEMA_ADDITIONAL_SPREAD_UNSUPPORTED',
				'OBJECT_ENVELOPE_SHAPE_SPREAD_UNSUPPORTED',
				'OBJECT_ENVELOPE_SPREAD_LAYOUT_UNSUPPORTED',
				'OBJECT_ENVELOPE_COMPUTED_FIELD_UNSUPPORTED',
				'OBJECT_ENVELOPE_FIELD_DUPLICATED',
				'OBJECT_ENVELOPE_ID_CONSTRAINT_UNRECOGNIZED',
				'OBJECT_ENVELOPE_SEMANTIC_VERSION_CONSTRAINT_UNRECOGNIZED',
				'TARGET_SCHEMA_POST_SPREAD_FIELD_LAYOUT_UNSUPPORTED',
				'TARGET_SCHEMA_POST_SPREAD_COMPUTED_FIELD_UNSUPPORTED'
			],
			findingId: 11,
			name: 'a composite object-envelope layout',
			sources: {
				'packages/rph-contracts/src/objects.ts':
					'export const AssurancePolicyDefinitionSchema = z.strictObject({ ...otherShape, ...objectEnvelopeShape, ...objectEnvelopeShape, method() {}, [fieldName]: z.string(), id: z.string(), semanticVersion: z.number().int() });\n',
				'packages/rph-contracts/src/envelopes.ts':
					'export const objectEnvelopeShape = { ...baseShape, [fieldName]: z.string(), id: z.string(), id: z.string(), semanticVersion: z.string() } as const;\n'
			}
		},
		{
			codes: [
				'IDENTITY_PROVENANCE_CALLSITE_POPULATION_NOT_UNIQUE',
				'IDENTITY_PROVENANCE_FACT_ARGUMENT_MISSING:',
				'IDENTITY_PROVENANCE_FACT_SPREAD_UNSUPPORTED:',
				'IDENTITY_PROVENANCE_FACT_PROPERTY_LAYOUT_UNSUPPORTED:',
				'IDENTITY_PROVENANCE_FACT_COMPUTED_KEY_UNSUPPORTED:',
				'IDENTITY_PROVENANCE_FACT_DUPLICATE:hasSemanticVersion:'
			],
			findingId: 12,
			name: 'a composite identity-provenance fact layout',
			sources: {
				'packages/rph-assurance/src/validators.ts':
					'export const first = () => identityProvenanceValidator(subject);\nexport const second = () => identityProvenanceValidator(subject, { ...facts, get hasStableId() { return true; }, [criterion]: true, hasSemanticVersion: true, hasSemanticVersion: true, hasProvenance, hasProducer: (true), traceComplete: true satisfies boolean });\n'
			}
		},
		{
			codes: ['MANDATORY_PROPERTY_REGISTRY_DUPLICATE:P1'],
			findingId: 22,
			name: 'a duplicate governed mandatory-property row',
			sources: {
				[IMPLEMENTATION_GUIDE]: MANDATORY_PROPERTY_REGISTRY.replace(
					'| **P2** | Requirement 2. |',
					'| **P1** | Requirement 2. |'
				),
				'packages/rph-domain/src/conformance.test.ts': "expect(ids).toEqual(['P1']);\n",
				'packages/rph-domain/src/conformance-manifest.ts':
					"export const PROPERTY_COVERAGE = { P1: 'x' } as const;\n"
			}
		},
		{
			codes: [
				'MUTATION_CATALOG_ENTRY_LAYOUT_UNSUPPORTED:0',
				'MUTATION_CATALOG_ENTRY_LAYOUT_UNSUPPORTED:1',
				'MUTATION_CATALOG_ID_DUPLICATED:M1'
			],
			findingId: 23,
			name: 'invalid and duplicate mutation-catalog entries',
			sources: {
				'packages/rph-domain/src/conformance.test.ts':
					'expect(catalog.mutationCatalog.length).toBeGreaterThan(0);\n',
				'packages/rph-domain/vocab/m12-conformance.json':
					'{"mutationCatalog":[null,{"id":""},{"id":"M1"},{"id":"M1"}]}'
			}
		},
		{
			codes: ['MUTATION_CATALOG_JSON_INVALID'],
			findingId: 23,
			name: 'invalid mutation-catalog JSON',
			sources: {
				'packages/rph-domain/src/conformance.test.ts':
					'expect(catalog.mutationCatalog.length).toBeGreaterThan(0);\n',
				'packages/rph-domain/vocab/m12-conformance.json': '{'
			}
		},
		{
			codes: [
				'ASSESSMENT_CREATION_SITE_NOT_UNIQUE',
				'ASSESSMENT_BIRTH_STATE_LAYOUT_UNSUPPORTED',
				'ASSESSMENT_BIRTH_STATE_SPREAD_UNSUPPORTED',
				'ASSESSMENT_BIRTH_FIELD_DUPLICATED',
				'ASSESSMENT_COMMIT_LAYOUT_UNSUPPORTED',
				'ASSESSMENT_NEXT_STATE_LAYOUT_UNSUPPORTED',
				'ASSESSMENT_NEXT_STATE_SPREAD_UNSUPPORTED',
				'ASSESSMENT_WRITER_FIELD_DUPLICATED'
			],
			findingId: 28,
			name: 'a composite assurance-assessment layout',
			sources: {
				'packages/rph-application/src/handlers/assurance.ts':
					'export function requestAssuranceAssessment() { const state = { ...defaults, evidenceConsideredIds: [], evidenceConsidered: [] }; if (flag) { const state = {}; void state; } if (other) { const state = loadState(); void state; } return state; }\nexport function requestAssuranceAssessment() { return undefined; }\nexport const commitA = () => commitState(ctx, command, { ...options, objectType: ASSESSMENT, nextState });\nexport const commitB = () => commitState(ctx, command, { objectType: ASSESSMENT, nextState: { ...previous, evidenceRejected: supplied, rejectedEvidence: supplied } });\n'
			}
		},
		{
			codes: ['RPH_ID_SCHEMA_DECLARATION_AMBIGUOUS', 'RPH_ID_VALIDATOR_DECLARATION_AMBIGUOUS'],
			findingId: 30,
			name: 'duplicate RPH identifier declarations',
			sources: {
				'packages/rph-contracts/src/ids.ts':
					'export const RphIdSchema = z.string().regex(RPH_ID_REGEX);\nexport const RphIdSchema = z.string();\nexport function isRphId(value: string) { return RPH_ID_REGEX.test(value); }\nexport const isRphId = (value: string) => value.length > 0;\n'
			}
		},
		{
			codes: ['RPH_ID_SCHEMA_SEMANTICS_UNRECOGNIZED', 'RPH_ID_VALIDATOR_SEMANTICS_UNRECOGNIZED'],
			findingId: 30,
			name: 'RPH identifier declarations without recognized semantics',
			sources: {
				'packages/rph-contracts/src/ids.ts':
					'export const RphIdSchema = z.string();\nexport function isRphId(value: string) { return value.length > 0; }\n'
			}
		},
		{
			codes: ['PREFIX_MEMBERSHIP_OPERATION_UNRECOGNIZED'],
			findingId: 30,
			name: 'a prefix registry reference without a membership operation',
			sources: {
				'packages/rph-contracts/src/ids.ts':
					'export const RphIdSchema = z.string().refine(() => KNOWN_ID_PREFIXES.size > 0);\nexport function isRphId() { return KNOWN_ID_PREFIXES.size > 0; }\n'
			}
		},
		{
			codes: [
				'PAYLOAD_SCHEMA_DECLARATION_LAYOUT_UNSUPPORTED',
				'PAYLOAD_SCHEMA_POPULATION_UNRESOLVED'
			],
			findingId: 31,
			name: 'a non-variable payload schema declaration',
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export interface CreatePayloadSchema { objectId: string }\n'
			}
		},
		{
			codes: ['PAYLOAD_SCHEMA_DECLARATION_DUPLICATED'],
			findingId: 31,
			name: 'duplicate payload schema declarations',
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export const CreatePayloadSchema = z.strictObject({ objectId: RphIdSchema });\nexport const CreatePayloadSchema = z.strictObject({ objectId: RphIdSchema });\n'
			}
		},
		{
			codes: ['PAYLOAD_SCHEMA_ROOT_LAYOUT_UNSUPPORTED:'],
			findingId: 31,
			name: 'an indirect payload schema root',
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export const CreatePayloadSchema = makeSchema();\n'
			}
		},
		{
			codes: ['PAYLOAD_SCHEMA_OBJECT_LAYOUT_UNSUPPORTED:'],
			findingId: 31,
			name: 'an indirect payload schema object',
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'export const CreatePayloadSchema = z.strictObject(shape);\n'
			}
		},
		{
			codes: [
				'PAYLOAD_SCHEMA_SPREAD_UNSUPPORTED:',
				'PAYLOAD_SCHEMA_COMPUTED_FIELD_UNSUPPORTED:',
				'PAYLOAD_SCHEMA_FIELD_DUPLICATED:',
				'PAYLOAD_SCHEMA_FIELD_LAYOUT_UNSUPPORTED:'
			],
			findingId: 31,
			name: 'a composite payload schema layout',
			sources: {
				'packages/rph-contracts/src/messages.ts':
					'const relatedIds = z.array(RphIdSchema);\nexport const CreatePayloadSchema = z.strictObject({ ...shape, [fieldName]: z.string(), objectId: z.string(), objectId: RphIdSchema, relatedIds });\n'
			}
		},
		{
			codes: [
				'VALIDATOR_BOUNDARY_DECLARATION_AMBIGUOUS',
				'VALIDATOR_BOUNDARY_CALL_POPULATION_NOT_UNIQUE',
				'VALIDATOR_BOUNDARY_FACT_LAYOUT_UNSUPPORTED',
				'VALIDATOR_BOUNDARY_FACT_SPREAD_UNSUPPORTED',
				'VALIDATOR_BOUNDARY_SCHEMA_FIELD_NOT_UNIQUE'
			],
			findingId: 40,
			name: 'a composite validator boundary layout',
			sources: {
				'packages/rph-assurance/src/floor.ts':
					'export function composeAssuranceOutcome() { classifyValidatorResult(facts); return classifyValidatorResult({ ...base, schemaValid: true, schemaValid: false }); }\nexport const composeAssuranceOutcome = validator;\n'
			}
		},
		{
			codes: ['VALIDATOR_BOUNDARY_LAYOUT_UNSUPPORTED'],
			findingId: 40,
			name: 'a nonfunction validator boundary declaration',
			sources: {
				'packages/rph-assurance/src/floor.ts': 'export const composeAssuranceOutcome = validator;\n'
			}
		},
		{
			codes: ['VALIDATOR_BOUNDARY_BODY_MISSING'],
			findingId: 40,
			name: 'a validator boundary declaration without a body',
			sources: {
				'packages/rph-assurance/src/floor.ts':
					'export declare function composeAssuranceOutcome(): unknown;\n'
			}
		},
		{
			codes: [
				'COMMAND_HANDLER_REGISTRY_ENTRY_LAYOUT_UNSUPPORTED',
				'COMMAND_HANDLER_REGISTRY_COMMAND_DUPLICATED'
			],
			findingId: 49,
			name: 'a composite command-handler registry layout',
			sources: {
				'packages/rph-application/src/command-bus.ts':
					'export function dispatch() { return handler(); }\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = { ...extraHandlers, MarkPwuReady, PublishPwa: publishPwa, PublishPwa: publishPwa };\n',
				'packages/rph-application/src/handlers/pwu.ts':
					'export const publishPwa = () => advance();\n'
			}
		},
		{
			codes: ['COMMAND_HANDLER_REGISTRY_LAYOUT_UNSUPPORTED'],
			findingId: 49,
			name: 'an indirect command-handler registry',
			sources: {
				'packages/rph-application/src/command-bus.ts':
					'export function dispatch() { return handler(); }\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = createHandlers();\n',
				'packages/rph-application/src/handlers/pwu.ts': 'export const unrelated = true;\n'
			}
		},
		{
			codes: ['REGISTERED_HANDLER_DECLARATION_UNRESOLVED:Missing'],
			findingId: 49,
			name: 'a registered handler without a declaration',
			sources: {
				'packages/rph-application/src/command-bus.ts':
					'export function dispatch() { return handler(); }\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = { Missing: missingHandler };\n',
				'packages/rph-application/src/handlers/pwu.ts': 'export const unrelated = true;\n'
			}
		},
		{
			codes: ['REGISTERED_HANDLER_LAYOUT_UNSUPPORTED:MarkPwuReady'],
			findingId: 49,
			name: 'a registered handler with a nonfunction layout',
			sources: {
				'packages/rph-application/src/command-bus.ts':
					'export function dispatch() { return handler(); }\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = { MarkPwuReady: markPwuReady };\n',
				'packages/rph-application/src/handlers/pwu.ts':
					'export const markPwuReady = implementation;\n'
			}
		},
		{
			codes: ['FUNCTION_DECLARATION_LAYOUT_UNSUPPORTED:'],
			findingId: 49,
			name: 'a command-bus declaration with a nonfunction layout',
			sources: {
				'packages/rph-application/src/command-bus.ts': 'export const dispatch = handler;\n',
				'packages/rph-application/src/handlers/registry.ts':
					'export const HANDLERS = { MarkPwuReady: markPwuReady };\n',
				'packages/rph-application/src/handlers/pwu.ts':
					'export const markPwuReady = () => advance();\n'
			}
		}
	];

	it.each(unsupportedNativeLayoutCases)(
		'keeps $name unsupported through the public operation',
		({ codes, findingId, sources }) => {
			expectUnsupportedNativeLayout(findingId, sources, codes);
		}
	);

	it.each([
		{
			name: 'a nonliteral code prefix value',
			source: 'export const ID_PREFIXES = { INTENT: makePrefix() } as const;\n'
		},
		{
			name: 'duplicate code prefix values',
			source: "export const ID_PREFIXES = { INTENT: 'int', ALSO_INTENT: 'int' } as const;\n"
		},
		{
			name: 'a computed code prefix key',
			source: "export const ID_PREFIXES = { [prefixName]: 'int' } as const;\n"
		}
	])('keeps $name unsupported through the public operation', ({ source }) => {
		expectUnsupportedNativeLayout(
			32,
			{
				'packages/rph-contracts/src/ids.ts': source,
				[PREFIX_DOC]:
					'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n\nIDs are opaque and immutable.\n'
			},
			['CODE_PREFIX_REGISTRY_LAYOUT_UNSUPPORTED']
		);
	});

	it.each([
		{
			document:
				'| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n\nIDs are opaque and immutable.\n',
			name: 'a missing governed registry heading'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n## 5.2 Prefix registry\nIDs are opaque and immutable.\n',
			name: 'duplicate governed registry headings'
		},
		{
			document: '## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n',
			name: 'a missing governed registry terminator'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\nIDs are opaque and immutable.\nIDs are opaque and immutable.\n',
			name: 'duplicate governed registry terminators'
		},
		{
			document:
				'## 5.2 Prefix registry\nNo registry table is present.\nIDs are opaque and immutable.\n',
			name: 'a missing governed registry table'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| invalid | separator |\n| Intent | `int` |\nIDs are opaque and immutable.\n',
			name: 'an invalid governed registry separator'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Object | Prefix |\n| Intent | `int` |\nIDs are opaque and immutable.\n',
			name: 'a repeated governed registry header'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\nnot a table row\nIDs are opaque and immutable.\n',
			name: 'a non-table governed registry row'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n| Other | `int` |\nIDs are opaque and immutable.\n',
			name: 'a duplicate governed prefix value'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n| Intent | `int` |\n\n| Other | `other` |\nIDs are opaque and immutable.\n',
			name: 'a governed registry table after the first row population'
		},
		{
			document:
				'## 5.2 Prefix registry\n| Object | Prefix |\n| --- | --- |\n\nIDs are opaque and immutable.\n',
			name: 'an empty governed registry population'
		}
	])('keeps $name unsupported through the public operation', ({ document }) => {
		expectUnsupportedNativeLayout(
			32,
			{
				'packages/rph-contracts/src/ids.ts':
					"export const ID_PREFIXES = { INTENT: 'int' } as const;\n",
				[PREFIX_DOC]: document
			},
			['GOVERNED_PREFIX_REGISTRY_LAYOUT_UNSUPPORTED']
		);
	});

	it('recognizes bracket calls, wrapped literals, aliases, and element-access reads', () => {
		const floor = projectJpwbHarmonizationRuleFactsFromCapturedSources(1, {
			'packages/rph-application/src/handlers/execution.ts':
				"export const run = () => { api['floorGateBlock'](ctx, id, (({ aiProduced: (flag satisfies boolean) }) as const)); floorGateBlock(ctx, id); other[0](); };\n"
		});
		expect(floor.facts.floorGateCallsites).toBe(2);
		expect(floor.uncertainties).toEqual(
			expect.arrayContaining([
				expect.stringContaining('FLOOR_GATE_AI_PRODUCED_ARGUMENT_UNRESOLVED:'),
				expect.stringContaining('FLOOR_GATE_AI_PRODUCED_VALUE_UNRESOLVED:')
			])
		);

		const revision = projectJpwbHarmonizationRuleFactsFromCapturedSources(3, {
			'packages/rph-contracts/src/messages.ts':
				'export interface Command { readonly expectedRevision: number }\n',
			'packages/rph-application/src/handler.ts':
				"export const update = (command: any) => { void command['expectedRevision']; return commitState(); };\n"
		});
		expect(revision.facts.expectedRevisionProductionReads).toBe(1);

		const events = projectJpwbHarmonizationRuleFactsFromCapturedSources(5, {
			'packages/rph-contracts/src/messages.ts':
				'export const EVENTS = { Created: { payload: schema } } as const;\n',
			'packages/rph-contracts/src/validate.ts':
				"import { EVENTS as Registry } from './messages.js';\nexport const validate = (event: any) => Registry[event.type].payload['safeParse'](event.payload);\n",
			'packages/rph-application/src/handlers/kit.ts': 'export const emit = () => makeEvent();\n'
		});
		expect(events.facts.eventRegistryValidationConsumers).toBe(1);

		const execution = projectJpwbHarmonizationRuleFactsFromCapturedSources(36, {
			'packages/rph-application/src/handlers/execution.ts':
				"export function startExecutionStep(command: any) { return command['runtimeBindingId']; }\n",
			'packages/rph-contracts/src/messages.ts':
				'export interface StartPayload { runtimeBindingId: string }\n'
		});
		expect(execution.facts.runtimeBindingIdProductionReads).toBe(1);

		const activePlan = projectJpwbHarmonizationRuleFactsFromCapturedSources(70, {
			'packages/rph-application/src/handlers/execution.ts':
				"export const guard = (pwu: any) => pwu['activeExecutionPlanId'] !== undefined;\n"
		});
		expect(activePlan.facts.activePlanGuardReads).toBe(1);
	});

	it('preserves unsupported layout evidence for catalog, assessment, ID, payload, and validator syntax', () => {
		const catalog = projectJpwbHarmonizationRuleFactsFromCapturedSources(23, {
			'packages/rph-domain/vocab/m12-conformance.json': '{"notMutationCatalog":[]}'
		});
		expect(catalog.uncertainties).toContain('MUTATION_CATALOG_LAYOUT_UNSUPPORTED');

		const assessment = projectJpwbHarmonizationRuleFactsFromCapturedSources(28, {
			'packages/rph-application/src/handlers/assurance.ts':
				"export function requestAssuranceAssessment() { const state = { evidenceConsideredIds: [], evidenceRejected: [], residualUncertainty: [] }; return state; }\nexport const unrelated = () => commitState(ctx, command, { objectType: 'OTHER', nextState: { evidenceRejected: supplied } });\n"
		});
		expect(assessment.facts.fieldsWithNonemptyProductionWriters).toEqual([]);

		const id = projectJpwbHarmonizationRuleFactsFromCapturedSources(30, {
			'packages/rph-contracts/src/ids.ts':
				"export const RphIdSchema = z.string().refine((prefix: string) => KNOWN_ID_PREFIXES['has'](prefix));\nexport function isRphId(value: string) { return KNOWN_ID_PREFIXES['has'](value); }\n"
		});
		expect(id.facts.registeredPrefixMembershipEnforced).toBe(true);

		const payload = projectJpwbHarmonizationRuleFactsFromCapturedSources(31, {
			'packages/rph-contracts/src/messages.ts':
				'export const CreatePayloadSchema = (z.strictObject({ objectId: z.string() }) satisfies unknown);\n'
		});
		expect(payload.facts).toMatchObject({
			bareStringIdPayloadFields: 1,
			idBearingPayloadFields: 1
		});

		const validator = projectJpwbHarmonizationRuleFactsFromCapturedSources(40, {
			'packages/rph-assurance/src/floor.ts':
				"export const composeAssuranceOutcome = () => { ValidatorResult['safeParse'](candidate); return classifyValidatorResult({ schemaValid: (true satisfies boolean) }); };\n"
		});
		expect(validator.facts).toMatchObject({
			literalTrueValidatorSchemaChecks: 1,
			validatorBoundarySites: 1,
			validatorSchemaValidationCalls: 1
		});
	});

	it('distinguishes branch-controlling authority from an unbound authority call', () => {
		const projection = projectJpwbHarmonizationRuleFactsFromCapturedSources(49, {
			'packages/rph-application/src/handlers/registry.ts':
				'export const HANDLERS = { MarkPwuReady: guarded, PublishPwa: unbound };\n',
			'packages/rph-application/src/handlers/pwu.ts':
				'export const guarded = () => authorizeAtActionTime() && advance();\nexport const unbound = () => { authorizeAtActionTime(); return advance(); };\n'
		});
		expect(projection.facts).toMatchObject({
			governedTransitionHandlers: 2,
			handlersWithoutAuthorityChecks: 1
		});
		expect(projection.uncertainties).toContain(
			'AUTHORITY_HANDLER_RESULT_NOT_CONTROL_BOUND:PublishPwa'
		);
	});
});
