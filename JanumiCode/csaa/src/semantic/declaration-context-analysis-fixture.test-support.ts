import {
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SELECTION,
	type DeclarationContextAnalysisBudgets,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisRequest
} from '../contracts/declaration-context-analysis.js';
import type { ModuleResolutionTraceRequest } from '../contracts/module-resolution-trace.js';
import { buildModuleResolutionTrace } from '../resolution/build-module-resolution-trace.js';
import {
	createModuleResolutionTraceFixture,
	moduleResolutionTraceInputs,
	type ModuleResolutionTraceFixture,
	type ModuleResolutionTraceFixtureOptions
} from '../resolution/module-resolution-trace-fixture.test-support.js';
import { validateModuleResolutionTrace } from '../resolution/validate-module-resolution-trace.js';

export const DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME = 'SelectedContract';
export const DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME = 'FixtureContract';

export type DeclarationContextAnalysisFixtureDeclarationState = 'MERGED' | 'SINGLE';

const MERGED_TARGET_DECLARATION = `interface ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME} {
	readonly first: string;
}
declare namespace ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME} {
	const mergeMarker: 'merged';
}
export { ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME} as ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME} };
`;

const SINGLE_TARGET_DECLARATION = `interface ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME} {
	readonly value: string;
}
export { ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME} as ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME} };
`;

const IMPORTER_TEXT = `import { ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME} } from '@fixture/module-target';
export type ConsumerContract = ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME};
`;

export interface DeclarationContextAnalysisFixtureOptions extends ModuleResolutionTraceFixtureOptions {
	readonly declarationState?: DeclarationContextAnalysisFixtureDeclarationState;
}

export interface DeclarationContextAnalysisFixture extends ModuleResolutionTraceFixture {
	readonly declarationState: DeclarationContextAnalysisFixtureDeclarationState;
	readonly exportName: typeof DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME;
	readonly moduleResolutionRequest: ModuleResolutionTraceRequest;
	readonly moduleResolutionTrace: DeclarationContextAnalysisBuildInputs['moduleResolutionTrace'];
}

export function declarationContextAnalysisFixtureTargetText(
	state: DeclarationContextAnalysisFixtureDeclarationState
): string {
	return state === 'MERGED' ? MERGED_TARGET_DECLARATION : SINGLE_TARGET_DECLARATION;
}

export function declarationContextAnalysisBudgets(
	overrides: Partial<DeclarationContextAnalysisBudgets> = {}
): DeclarationContextAnalysisBudgets {
	return {
		maxAliasHops: 1_000,
		maxArtifacts: 10_000,
		maxCompilerInputAttempts: 1_000_000,
		maxDeclarations: 100_000,
		maxDiagnostics: 10_000,
		maxDurationMs: 60_000,
		maxExportSymbols: 100_000,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 64 * 1024 * 1024,
		maxOutputRecords: 1_000_000,
		maxParsedArtifactAstNodes: 1_000_000,
		maxProgramAstNodes: 1_000_000,
		maxProgramReadBytes: 64 * 1024 * 1024,
		maxProgramSourceFiles: 10_000,
		maxReadBytes: 128 * 1024 * 1024,
		maxRelations: 1_000_000,
		maxTraversalSteps: 10_000_000,
		...overrides
	};
}

export function declarationContextAnalysisRequest(
	fixture: DeclarationContextAnalysisFixture,
	requestOverrides: Partial<
		Omit<
			DeclarationContextAnalysisRequest,
			'budgets' | 'conditionalExportResolution' | 'moduleResolutionTrace' | 'projectContextGraph'
		>
	> = {},
	budgetOverrides: Partial<DeclarationContextAnalysisBudgets> = {}
): DeclarationContextAnalysisRequest {
	return {
		budgets: declarationContextAnalysisBudgets(budgetOverrides),
		conditionalExportResolution: {
			contentDigest: fixture.conditionalExportResolution.contentDigest,
			id: fixture.conditionalExportResolution.id,
			inputDigest: fixture.conditionalExportResolution.inputDigest
		},
		exportName: fixture.exportName,
		moduleResolutionTrace: {
			contentDigest: fixture.moduleResolutionTrace.contentDigest,
			id: fixture.moduleResolutionTrace.id,
			inputDigest: fixture.moduleResolutionTrace.inputDigest
		},
		operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
		projectContextGraph: {
			contentDigest: fixture.projectContextGraph.contentDigest,
			graphId: fixture.projectContextGraph.id,
			inputDigest: fixture.projectContextGraph.inputDigest
		},
		schemaVersion: DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: DECLARATION_CONTEXT_ANALYSIS_SELECTION,
		semanticSnapshotId: fixture.semanticSnapshot.id,
		subjectId: fixture.frozenSubject.descriptor.subjectId,
		...requestOverrides
	};
}

export function declarationContextAnalysisInputs(
	fixture: DeclarationContextAnalysisFixture,
	requestOverrides: Parameters<typeof declarationContextAnalysisRequest>[1] = {},
	budgetOverrides: Partial<DeclarationContextAnalysisBudgets> = {}
): DeclarationContextAnalysisBuildInputs {
	return {
		conditionalExportRequest: fixture.conditionalExportRequest,
		conditionalExportResolution: fixture.conditionalExportResolution,
		frozenSubject: fixture.frozenSubject,
		moduleResolutionRequest: fixture.moduleResolutionRequest,
		moduleResolutionTrace: fixture.moduleResolutionTrace,
		projectContextGraph: fixture.projectContextGraph,
		request: declarationContextAnalysisRequest(fixture, requestOverrides, budgetOverrides),
		semanticSnapshot: fixture.semanticSnapshot
	};
}

export function createDeclarationContextAnalysisFixture(
	options: DeclarationContextAnalysisFixtureOptions = {}
): DeclarationContextAnalysisFixture {
	const declarationState = options.declarationState ?? 'MERGED';
	const fixture = createModuleResolutionTraceFixture({
		...options,
		importerText: options.importerText ?? IMPORTER_TEXT,
		targetDeclarationText:
			options.targetDeclarationText ?? declarationContextAnalysisFixtureTargetText(declarationState)
	});
	try {
		const traceInputs = moduleResolutionTraceInputs(fixture);
		const traceOutcome = buildModuleResolutionTrace(traceInputs);
		if (traceOutcome.outcome !== 'partial')
			throw new Error(`CAP-011 fixture construction failed: ${JSON.stringify(traceOutcome)}`);
		const traceValidation = validateModuleResolutionTrace(traceOutcome.trace, traceInputs);
		if (traceValidation.state !== 'VALID')
			throw new Error(`CAP-011 fixture validation failed: ${JSON.stringify(traceValidation)}`);
		return {
			...fixture,
			declarationState,
			exportName: DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME,
			moduleResolutionRequest: traceInputs.request,
			moduleResolutionTrace: traceOutcome.trace
		};
	} catch (error) {
		fixture.cleanup();
		throw error;
	}
}
