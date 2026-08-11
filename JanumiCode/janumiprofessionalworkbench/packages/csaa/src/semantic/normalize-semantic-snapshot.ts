import type {
	BuildStaticSemanticSnapshotRequest,
	CompilerInputObservation,
	SemanticAssignmentRecord,
	SemanticAstNodeRecord,
	SemanticCapability,
	SemanticCapabilityRecord,
	SemanticDeclarationCandidateRecord,
	SemanticDiagnosticFamily,
	SemanticDiagnosticMessage,
	SemanticDiagnosticRecord,
	SemanticFactProvenanceRecord,
	SemanticInvocationSiteRecord,
	SemanticLimitation,
	SemanticLiteralRecord,
	SemanticPopulationKind,
	SemanticProgramRecord,
	SemanticProjectRecord,
	SemanticProvenanceId,
	SemanticSourceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	SEMANTIC_AST_TRAVERSAL_PROFILE,
	SEMANTIC_CANONICAL_PROFILE,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION
} from '../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import type { CompilerProjectAttribution, VerifiedCompilerCapture } from '../providers/typescript/compiler-input-journal.js';
import { canonicalSemanticJson } from './canonical.js';
import {
	compilerInputClosureDigest,
	semanticDeclarationCandidateId,
	semanticDiagnosticId,
	semanticInvocationSiteId,
	semanticNodeId,
	semanticProgramId,
	semanticProjectId,
	semanticProvenanceId,
	semanticSnapshotId,
	semanticSourceId
} from './ids.js';
import { semanticPopulation, type SemanticPopulationMembers } from './population.js';
import type {
	RawSemanticDiagnosticMessage,
	RawSemanticPartialityReason,
	RawSemanticProgramRecipe,
	RawSemanticValue,
	RawStaticSemanticProjectExtraction
} from './raw-semantic-model.js';

const PROVIDER = Object.freeze({ api: 'PUBLIC_COMPILER_API' as const, id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION });
const CAPABILITIES = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'] as const satisfies readonly SemanticCapability[];
const POPULATIONS = ['PROJECT', 'PROGRAM', 'SOURCE', 'AST_NODE', 'DECLARATION_CANDIDATE', 'LITERAL', 'INVOCATION_SITE', 'ASSIGNMENT', 'DIAGNOSTIC', 'PROVENANCE', 'FRAMEWORK_CANDIDATE', 'CONTEXT_INPUT'] as const satisfies readonly SemanticPopulationKind[];
const DIAGNOSTIC_FAMILIES = ['CONFIGURATION', 'OPTIONS', 'GLOBAL', 'SYNTACTIC', 'SEMANTIC', 'DECLARATION'] as const satisfies readonly SemanticDiagnosticFamily[];

export class SemanticNormalizationError extends Error {
	constructor(readonly code: 'BUDGET_EXCEEDED' | 'INVALID_RAW_MODEL', message: string) {
		super(message);
		this.name = 'SemanticNormalizationError';
	}
}

export interface NormalizeStaticSemanticSnapshotInput {
	readonly capture: Pick<VerifiedCompilerCapture, 'closureDigest' | 'observations' | 'projectAttributions'>;
	readonly projects: readonly RawStaticSemanticProjectExtraction[];
	readonly request: BuildStaticSemanticSnapshotRequest;
	readonly subject: FrozenSubject;
}

interface ProjectState {
	readonly attribution: CompilerProjectAttribution;
	readonly contextDigest: string;
	readonly contextInputIds: readonly CompilerInputObservation['id'][];
	readonly nodeIds: Map<string, SemanticAstNodeRecord['id']>;
	readonly programId: SemanticProgramRecord['id'];
	readonly projectId: SemanticProjectRecord['id'];
	readonly provenanceIds: Map<string, SemanticProvenanceId>;
	readonly raw: RawStaticSemanticProjectExtraction;
	readonly recipe: ProgramRecipe;
	readonly sourceIds: Map<number, SemanticSourceRecord['id']>;
}

function fail(message: string, code: SemanticNormalizationError['code'] = 'INVALID_RAW_MODEL'): never {
	throw new SemanticNormalizationError(code, message);
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique<Value extends string>(values: readonly Value[]): Value[] {
	return [...new Set(values)].sort(compare);
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) fail(`${field} must be unique.`);
}

function cloneRawValue(value: RawSemanticValue): unknown {
	if (Array.isArray(value)) return value.map((entry) => cloneRawValue(entry));
	if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneRawValue(entry)]));
	return value;
}

function materializeRecipe(raw: RawSemanticProgramRecipe): ProgramRecipe {
	return {
		compilerOptions: Object.fromEntries(Object.entries(raw.compilerOptions).map(([key, value]) => [key, cloneRawValue(value)])),
		configClosureDigest: raw.configClosureDigest,
		configPath: raw.configPath,
		kind: raw.kind,
		projectReferences: [...raw.projectReferences],
		projectResolutionDigest: raw.projectResolutionDigest,
		provider: { id: raw.provider.id, version: raw.provider.version },
		rootNames: [...raw.rootNames]
	};
}

function limitationKey(value: SemanticLimitation): string {
	return `${value.capability}\0${value.closureEffect}\0${value.region}\0${value.reason}`;
}

function reasonKey(value: RawSemanticPartialityReason): string {
	return `${value.capability}\0${value.code}\0${value.path ?? ''}\0${value.message}`;
}

function limitationsForReasons(reasons: readonly RawSemanticPartialityReason[], capability: 'TS_PROJECT' | 'TS_SYNTAX', fallbackRegion: string): SemanticLimitation[] {
	const byKey = new Map<string, SemanticLimitation>();
	for (const reason of reasons) {
		if (reason.capability !== capability) continue;
		const limitation: SemanticLimitation = {
			capability,
			closureEffect: 'DEGRADES_CLOSURE',
			reason: reason.message,
			region: reason.path ?? fallbackRegion
		};
		byKey.set(limitationKey(limitation), limitation);
	}
	return [...byKey.values()].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
}

function cloneDiagnosticMessage(message: RawSemanticDiagnosticMessage): SemanticDiagnosticMessage {
	return {
		category: message.category,
		code: message.code,
		next: message.next.map(cloneDiagnosticMessage),
		text: message.text,
		textEncoding: message.textEncoding,
		textLength: message.textLength,
		textSha256: message.textSha256
	};
}

function rawDiagnosticMessageCharacters(message: RawSemanticDiagnosticMessage): number {
	let total = 0;
	const pending = [message];
	while (pending.length > 0) {
		const current = pending.pop()!;
		if (!Number.isSafeInteger(current.textLength) || current.textLength < 1 || !Number.isSafeInteger(total + current.textLength)) fail('Raw diagnostic character count is invalid or overflowed.');
		total += current.textLength;
		for (const next of current.next) pending.push(next);
	}
	return total;
}

function rawDiagnosticCharacters(projects: readonly RawStaticSemanticProjectExtraction[]): number {
	let total = 0;
	for (const project of projects) for (const diagnostic of project.diagnostics) {
		const characters = rawDiagnosticMessageCharacters(diagnostic.message)
			+ diagnostic.related.reduce((sum, related) => sum + rawDiagnosticMessageCharacters(related.message), 0);
		if (!Number.isSafeInteger(characters) || !Number.isSafeInteger(total + characters)) fail('Raw diagnostic character count overflowed.');
		total += characters;
	}
	return total;
}

function nodeKey(sourceOrdinal: number, nodeOrdinal: number): string {
	return `${sourceOrdinal}\0${nodeOrdinal}`;
}

function members(
	analyzed: readonly string[] = [],
	contextOnly: readonly string[] = [],
	unsupported: readonly string[] = [],
	unknown: readonly string[] = []
): SemanticPopulationMembers {
	const normalizedAnalyzed = sortedUnique(analyzed);
	const normalizedContext = sortedUnique(contextOnly);
	return {
		analyzed: normalizedAnalyzed,
		contextOnly: normalizedContext,
		excluded: [],
		excludedByPolicy: [],
		failed: [],
		unknown: sortedUnique(unknown),
		unsupported: sortedUnique(unsupported)
	};
}

function provenanceId(
	provenancesById: Map<string, SemanticFactProvenanceRecord>,
	state: ProjectState,
	snapshotId: StaticSemanticSnapshot['id'],
	subjectId: string,
	capability: 'TS_PROJECT' | 'TS_SYNTAX',
	limitations: readonly SemanticLimitation[],
	sourceId: SemanticSourceRecord['id'] | null = null
): SemanticProvenanceId {
	const canonicalLimitations = [...limitations].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
	const cacheKey = `${capability}\0${sourceId ?? ''}\0${canonicalLimitations.map(limitationKey).join('\u0001')}`;
	const cached = state.provenanceIds.get(cacheKey);
	if (cached !== undefined) return cached;
	const parentProvenanceId = sourceId === null ? null : provenanceId(
		provenancesById,
		state,
		snapshotId,
		subjectId,
		capability,
		limitationsForReasons(state.raw.project.partialityReasons, capability, state.raw.project.configPath)
	);
	const partial = canonicalLimitations.some((limitation) => limitation.closureEffect !== 'NONE');
	const supportRefs = sourceId === null
		? sortedUnique([subjectId, snapshotId, state.projectId, state.programId, ...state.contextInputIds])
		: sortedUnique([parentProvenanceId!, sourceId]);
	const method = capability === 'TS_PROJECT' ? 'typescript-public-program-and-diagnostics' : 'typescript-public-normalized-ast';
	const rationale = partial
		? `${capability} facts were produced successfully with the declared bounded limitations.`
		: `${capability} facts were produced successfully from the exact verified compiler context.`;
	const preimage: Omit<SemanticFactProvenanceRecord, 'id'> = {
		capability,
		epistemic: {
			capabilityCoverage: partial ? 'partial' : 'supported',
			conflict: 'unopposed',
			executionHealth: 'succeeded',
			freshness: 'current-for-subject',
			inference: 'direct',
			rationale,
			supportBasis: {
				kind: capability === 'TS_PROJECT' ? 'compiler-confirmed' : 'direct-extraction',
				method,
				rationale,
				sourceRefs: supportRefs
			},
			unresolvedRegions: sortedUnique(canonicalLimitations.filter((limitation) => limitation.closureEffect !== 'NONE').map((limitation) => limitation.region))
		},
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		invalidationDependencies: [
			{ digest: state.contextDigest, kind: 'CONTEXT_INPUT' },
			{ digest: sha256(canonicalSemanticJson(SEMANTIC_EXTRACTION_VERSION)), kind: 'EXTRACTION' },
			{ digest: state.recipe.projectResolutionDigest, kind: 'PROJECT_RECIPE' },
			{ digest: sha256(canonicalSemanticJson(PROVIDER)), kind: 'PROVIDER' },
			{ digest: subjectId, kind: 'SUBJECT' }
		],
		limitations: canonicalLimitations,
		parentProvenanceId,
		projectId: state.projectId,
		provider: PROVIDER,
		snapshotId,
		sourceId,
		subjectId
	};
	const id = semanticProvenanceId(preimage);
	const record: SemanticFactProvenanceRecord = { ...preimage, id };
	const existing = provenancesById.get(id);
	if (existing !== undefined && canonicalSemanticJson(existing) !== canonicalSemanticJson(record)) fail(`Provenance identity collision for ${id}.`);
	provenancesById.set(id, record);
	state.provenanceIds.set(cacheKey, id);
	return id;
}

function sourceLimitations(state: ProjectState, source: RawStaticSemanticProjectExtraction['sources'][number]): SemanticLimitation[] {
	const limitations = limitationsForReasons(state.raw.project.partialityReasons, 'TS_PROJECT', state.raw.project.configPath);
	if (source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)) {
		limitations.push({
			capability: 'TS_PROJECT',
			closureEffect: 'DEGRADES_CLOSURE',
			reason: source.mapping.reason,
			region: source.logicalPath
		});
	}
	return [...new Map(limitations.map((limitation) => [limitationKey(limitation), limitation])).values()]
		.sort((left, right) => compare(limitationKey(left), limitationKey(right)));
}

function diagnosticManifestDigest(records: readonly SemanticDiagnosticRecord[]): string {
	return sha256(canonicalSemanticJson([...records]
		.sort((left, right) => compare(left.id, right.id))
		.map(({ id, multiplicity }) => ({ id, multiplicity }))));
}

function validateInput(input: NormalizeStaticSemanticSnapshotInput): void {
	if (input.request.subjectId !== input.subject.descriptor.subjectId) fail('Semantic request and FrozenSubject identities differ.');
	if (canonicalSemanticJson([...input.request.capabilities].sort(compare)) !== canonicalSemanticJson(['TS_PROJECT', 'TS_SYNTAX'])) fail('Slice 3A normalization requires exactly TS_PROJECT and TS_SYNTAX.');
	if (input.projects.length !== input.subject.projects.length || input.projects.length > input.request.budgets.maxProjects) fail('Raw project population does not reproduce the frozen project population.', input.projects.length > input.request.budgets.maxProjects ? 'BUDGET_EXCEEDED' : 'INVALID_RAW_MODEL');
	if (input.projects.some((project) => project.evidenceState !== 'VERIFIED_COMPILER_INPUT')) fail('Only finalized and rechecked compiler-input evidence may cross the normalization boundary.');
	if (input.capture.closureDigest !== compilerInputClosureDigest(input.capture.observations)) fail('Verified compiler capture closure digest is incoherent.');
	assertUnique(input.projects.map((project) => project.project.configPath), 'Raw project configuration paths');
	assertUnique(input.capture.projectAttributions.map((attribution) => attribution.projectKey), 'Compiler project attributions');
	const rawPaths = sortedUnique(input.projects.map((project) => project.project.configPath));
	const subjectPaths = sortedUnique(input.subject.projects.map((project) => project.configPath));
	const attributionPaths = sortedUnique(input.capture.projectAttributions.map((attribution) => attribution.projectKey));
	if (canonicalSemanticJson(rawPaths) !== canonicalSemanticJson(subjectPaths) || canonicalSemanticJson(rawPaths) !== canonicalSemanticJson(attributionPaths)) fail('Raw, frozen, and compiler-attributed project populations differ.');
}

export function normalizeStaticSemanticSnapshot(input: NormalizeStaticSemanticSnapshotInput): StaticSemanticSnapshot {
	validateInput(input);
	const compilerInputs = [...input.capture.observations].sort((left, right) => compare(left.id, right.id));
	const observationById = new Map(compilerInputs.map((observation) => [observation.id, observation]));
	const contextDigest = compilerInputClosureDigest(compilerInputs);
	const requestedCapabilities = [...input.request.capabilities].sort(compare);
	const rawProjects = [...input.projects].sort((left, right) => compare(left.project.configPath, right.project.configPath));
	const snapshotId = semanticSnapshotId({
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: input.request.budgets,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		contextDigest,
		expectedEmpty: input.request.expectEmpty,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		projectRecipeDigests: rawProjects.map((project) => project.project.programRecipe.projectResolutionDigest).sort(compare),
		provider: PROVIDER,
		requestedCapabilities,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		subjectId: input.request.subjectId
	});

	const states: ProjectState[] = rawProjects.map((raw) => {
		const recipe = materializeRecipe(raw.project.programRecipe);
		const authoritative = input.subject.projects.find((project) => project.configPath === raw.project.configPath);
		const attribution = input.capture.projectAttributions.find((candidate) => candidate.projectKey === raw.project.configPath);
		if (authoritative === undefined || attribution === undefined) fail(`Project ${raw.project.configPath} is not bound by frozen subject and capture.`);
		if (canonicalSemanticJson(recipe) !== canonicalSemanticJson(authoritative.programRecipe)
			|| attribution.projectResolutionDigest !== recipe.projectResolutionDigest) fail(`Project ${raw.project.configPath} does not reproduce its authoritative recipe.`);
		const contextInputIds = sortedUnique(attribution.contextInputIds) as CompilerInputObservation['id'][];
		const observations = contextInputIds.map((id) => observationById.get(id) ?? fail(`Project ${raw.project.configPath} references an absent compiler input.`));
		const projectContextDigest = compilerInputClosureDigest(observations);
		const projectId = semanticProjectId({ configPath: raw.project.configPath, projectResolutionDigest: recipe.projectResolutionDigest, snapshotId });
		const programId = semanticProgramId({ contextDigest: projectContextDigest, projectId });
		const sourceIds = new Map<number, SemanticSourceRecord['id']>();
		assertUnique(raw.sources.map((source) => String(source.sourceOrdinal)), `Project ${raw.project.configPath} source ordinals`);
		if (raw.sources.length > input.request.budgets.maxSources) fail(`Project ${raw.project.configPath} exceeds the source budget.`, 'BUDGET_EXCEEDED');
		for (const source of raw.sources) {
			if (source.logicalPath.length > input.request.budgets.maxPathCharacters) fail(`Source path ${source.logicalPath} exceeds the path budget.`, 'BUDGET_EXCEEDED');
			sourceIds.set(source.sourceOrdinal, semanticSourceId({ contentSha256: source.contentSha256, logicalPath: source.logicalPath, programId }));
		}
		return { attribution, contextDigest: projectContextDigest, contextInputIds, nodeIds: new Map(), programId, projectId, provenanceIds: new Map(), raw, recipe, sourceIds };
	});

	const totalSources = states.reduce((total, state) => total + state.raw.sources.length, 0);
	const totalNodes = states.reduce((total, state) => total + state.raw.astNodes.length, 0);
	const totalDiagnosticOccurrences = states.reduce((total, state) => total + state.raw.diagnostics.length, 0);
	const totalDiagnosticCharacters = rawDiagnosticCharacters(rawProjects);
	if (totalSources > input.request.budgets.maxSources) fail('Raw sources exceed the snapshot source budget.', 'BUDGET_EXCEEDED');
	if (totalNodes > input.request.budgets.maxAstNodes) fail('Raw AST nodes exceed the snapshot node budget.', 'BUDGET_EXCEEDED');
	if (totalDiagnosticOccurrences > input.request.budgets.maxDiagnostics) fail('Raw diagnostics exceed the snapshot diagnostic budget.', 'BUDGET_EXCEEDED');
	if (totalDiagnosticCharacters > input.request.budgets.maxDiagnosticCharacters) fail('Raw diagnostic characters exceed the snapshot diagnostic-character budget.', 'BUDGET_EXCEEDED');

	for (const state of states) {
		const nodes = [...state.raw.astNodes].sort((left, right) => left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal);
		assertUnique(nodes.map((node) => nodeKey(node.sourceOrdinal, node.nodeOrdinal)), `Project ${state.raw.project.configPath} node ordinals`);
		for (const node of nodes) {
			const sourceId = state.sourceIds.get(node.sourceOrdinal) ?? fail(`AST node references absent source ordinal ${node.sourceOrdinal}.`);
			const parentId = node.parentNodeOrdinal === null ? null : state.nodeIds.get(nodeKey(node.sourceOrdinal, node.parentNodeOrdinal)) ?? fail(`AST node ${node.nodeOrdinal} precedes or lacks its parent.`);
			const structuralRoles = sortedUnique(node.structuralRoles);
			state.nodeIds.set(nodeKey(node.sourceOrdinal, node.nodeOrdinal), semanticNodeId({
				end: node.end,
				fullStart: node.fullStart,
				kind: node.kind,
				parentId,
				siblingOrdinal: node.siblingOrdinal,
				sourceId,
				start: node.start,
				structuralRoles
			}));
		}
	}

	const diagnosticsById = new Map<string, SemanticDiagnosticRecord>();
	const provenancesById = new Map<string, SemanticFactProvenanceRecord>();
	const occurrenceIdsByProject = new Map<string, Map<number, SemanticDiagnosticRecord['id']>>();
	for (const state of states) {
		const occurrenceIds = new Map<number, SemanticDiagnosticRecord['id']>();
		assertUnique(state.raw.diagnostics.map((diagnostic) => String(diagnostic.occurrenceOrdinal)), `Project ${state.raw.project.configPath} diagnostic occurrence ordinals`);
		for (const raw of state.raw.diagnostics) {
			const sourceId = raw.sourceOrdinal === null ? null : state.sourceIds.get(raw.sourceOrdinal) ?? fail(`Diagnostic references absent source ordinal ${raw.sourceOrdinal}.`);
			const related = raw.related.map((entry) => ({
				category: entry.category,
				code: entry.code,
				end: entry.end,
				message: cloneDiagnosticMessage(entry.message),
				path: entry.path,
				start: entry.start
			})).sort((left, right) => compare(canonicalSemanticJson(left), canonicalSemanticJson(right)));
			const message = cloneDiagnosticMessage(raw.message);
			const preimage = {
				category: raw.category,
				code: raw.code,
				end: raw.end,
				family: raw.family,
				locationKind: raw.locationKind,
				message,
				path: raw.path,
				projectId: state.projectId,
				related,
				sourceId,
				start: raw.start
			};
			const id = semanticDiagnosticId(preimage);
			occurrenceIds.set(raw.occurrenceOrdinal, id);
			const existing = diagnosticsById.get(id);
			if (existing !== undefined) {
				diagnosticsById.set(id, { ...existing, multiplicity: existing.multiplicity + 1 });
				continue;
			}
			diagnosticsById.set(id, {
				...preimage,
				id,
				multiplicity: 1,
				provenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_PROJECT',
					limitationsForReasons(state.raw.project.partialityReasons, 'TS_PROJECT', state.raw.project.configPath),
					raw.locationKind === 'SOURCE' && raw.start !== null && raw.end !== null ? sourceId : null
				)
			});
		}
		occurrenceIdsByProject.set(state.raw.project.configPath, occurrenceIds);
	}
	const diagnostics = [...diagnosticsById.values()].sort((left, right) => compare(left.id, right.id));

	const astNodes: SemanticAstNodeRecord[] = [];
	const declarationCandidates: SemanticDeclarationCandidateRecord[] = [];
	const literals: SemanticLiteralRecord[] = [];
	const invocations: SemanticInvocationSiteRecord[] = [];
	const assignments: SemanticAssignmentRecord[] = [];
	for (const state of states) {
		for (const raw of state.raw.astNodes) {
			const sourceId = state.sourceIds.get(raw.sourceOrdinal) ?? fail('AST source ordinal is absent.');
			const id = state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ?? fail('AST identity is absent.');
			const parentId = raw.parentNodeOrdinal === null ? null : state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.parentNodeOrdinal)) ?? fail('AST parent identity is absent.');
			astNodes.push({
				end: raw.end,
				fullStart: raw.fullStart,
				hasAssignmentInitializer: raw.hasAssignmentInitializer,
				id,
				kind: raw.kind,
				kindName: raw.kindName,
				operatorKind: raw.operatorKind,
				operatorName: raw.operatorName,
				parentId,
				publicFlags: raw.publicFlags,
				siblingOrdinal: raw.siblingOrdinal,
				sourceId,
				start: raw.start,
				structuralRoles: sortedUnique(raw.structuralRoles),
				syntacticIdentifierText: raw.syntacticIdentifierText
			});
		}
		const nodeByOrdinal = (sourceOrdinal: number, ordinal: number): SemanticAstNodeRecord['id'] => state.nodeIds.get(nodeKey(sourceOrdinal, ordinal)) ?? fail(`Node ordinal ${ordinal} is absent.`);
		for (const raw of state.raw.declarationCandidates) {
			const sourceId = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Declaration source ordinal is absent.');
			const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
			const id = semanticDeclarationCandidateId({ candidateRole: raw.candidateRole, nodeId, syntaxKind: raw.syntaxKind });
			declarationCandidates.push({
				ambientSyntax: raw.ambientSyntax,
				candidateRole: raw.candidateRole,
				candidateState: 'SYNTAX_ONLY',
				exportCarrierNodeId: raw.exportCarrierNodeOrdinal === null ? null : nodeByOrdinal(raw.sourceOrdinal, raw.exportCarrierNodeOrdinal),
				exportSyntax: raw.exportSyntax,
				id,
				localModifiers: [...raw.localModifiers].sort((left, right) => compare(`${left.code}:${left.name}`, `${right.code}:${right.name}`)),
				nameNodeId: raw.nameNodeOrdinal === null ? null : nodeByOrdinal(raw.sourceOrdinal, raw.nameNodeOrdinal),
				nameState: raw.nameState,
				nodeId,
				sourceId,
				syntacticName: raw.syntacticName,
				syntaxKind: raw.syntaxKind,
				syntaxKindName: raw.syntaxKindName
			});
		}
		for (const raw of state.raw.literals) {
			const sourceId = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Literal source ordinal is absent.');
			const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
			literals.push({
				lexemeLength: raw.lexemeLength,
				lexemeSha256: raw.lexemeSha256,
				nodeId,
				sourceId,
				value: raw.value,
				valueEncoding: raw.valueEncoding,
				valueLength: raw.valueLength,
				valueSha256: raw.valueSha256,
				valueState: raw.valueState,
				valueType: raw.valueType
			} as SemanticLiteralRecord);
		}
		for (const raw of state.raw.invocations) {
			const sourceId = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Invocation source ordinal is absent.');
			const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
			const base = {
				calleeNodeId: nodeByOrdinal(raw.sourceOrdinal, raw.calleeNodeOrdinal),
				id: semanticInvocationSiteId({ invocationKind: raw.invocationKind, nodeId }),
				invocationKind: raw.invocationKind,
				nodeId,
				sourceId,
				targetState: 'SYNTAX_ONLY' as const
			};
			if (raw.invocationKind === 'CALL') invocations.push({ ...base, argumentNodeIds: raw.argumentNodeOrdinals.map((ordinal) => nodeByOrdinal(raw.sourceOrdinal, ordinal)), invocationKind: 'CALL', optional: raw.optional, templateNodeId: null });
			else if (raw.invocationKind === 'NEW') invocations.push({ ...base, argumentNodeIds: raw.argumentNodeOrdinals.map((ordinal) => nodeByOrdinal(raw.sourceOrdinal, ordinal)), invocationKind: 'NEW', optional: false, templateNodeId: null });
			else invocations.push({ ...base, argumentNodeIds: [], invocationKind: 'TAGGED_TEMPLATE', optional: false, templateNodeId: raw.templateNodeOrdinal === null ? fail('Tagged template lacks its template node.') : nodeByOrdinal(raw.sourceOrdinal, raw.templateNodeOrdinal) });
		}
		for (const raw of state.raw.assignments) {
			const sourceId = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Assignment source ordinal is absent.');
			const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
			assignments.push({
				assignmentKind: raw.assignmentKind,
				nodeId,
				operatorKind: raw.operatorKind,
				operatorName: raw.operatorName,
				sourceId,
				targetNodeId: nodeByOrdinal(raw.sourceOrdinal, raw.targetNodeOrdinal),
				valueNodeId: raw.valueNodeOrdinal === null ? null : nodeByOrdinal(raw.sourceOrdinal, raw.valueNodeOrdinal)
			});
		}
	}
	astNodes.sort((left, right) => compare(left.id, right.id));
	declarationCandidates.sort((left, right) => compare(left.id, right.id));
	literals.sort((left, right) => compare(left.nodeId, right.nodeId));
	invocations.sort((left, right) => compare(left.id, right.id));
	assignments.sort((left, right) => compare(left.nodeId, right.nodeId));

	const sources: SemanticSourceRecord[] = [];
	for (const state of states) {
		const syntaxLimitations = limitationsForReasons(state.raw.project.partialityReasons, 'TS_SYNTAX', state.raw.project.configPath);
		for (const raw of state.raw.sources) {
			const id = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Source identity is absent.');
			const sourceDiagnosticIds = diagnostics.filter((diagnostic) => diagnostic.sourceId === id).map((diagnostic) => diagnostic.id).sort(compare);
			sources.push({
				analysisDisposition: raw.analysisDisposition,
				artifactClass: raw.artifactClass,
				artifactRoles: sortedUnique(raw.artifactRoles),
				bytes: raw.bytes,
				contentSha256: raw.contentSha256,
				declarationFile: raw.declarationFile,
				diagnosticIds: sourceDiagnosticIds,
				id,
				languageVariant: raw.languageVariant,
				logicalPath: raw.logicalPath,
				mapping: { ...raw.mapping },
				origin: raw.origin,
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: provenanceId(provenancesById, state, snapshotId, input.request.subjectId, 'TS_PROJECT', sourceLimitations(state, raw), id),
				rootFile: raw.rootFile,
				rootNodeId: raw.rootNodeOrdinal === null ? null : state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.rootNodeOrdinal)) ?? fail('Source root node identity is absent.'),
				scriptKind: raw.scriptKind,
				scriptKindName: raw.scriptKindName,
				syntaxProvenanceId: raw.analysisDisposition === 'DEEP_INDEXED'
					? provenanceId(provenancesById, state, snapshotId, input.request.subjectId, 'TS_SYNTAX', syntaxLimitations, id)
					: null,
				textLength: raw.textLength
			});
		}
	}
	sources.sort((left, right) => compare(left.id, right.id));

	const programs: SemanticProgramRecord[] = [];
	const projects: SemanticProjectRecord[] = [];
	for (const state of states) {
		const projectSources = sources.filter((source) => source.projectId === state.projectId);
		const projectDiagnostics = diagnostics.filter((diagnostic) => diagnostic.projectId === state.projectId);
		const occurrenceIds = occurrenceIdsByProject.get(state.raw.project.configPath) ?? fail('Project diagnostic occurrence index is absent.');
		const diagnosticFamilies = DIAGNOSTIC_FAMILIES.map((family) => {
			const raw = state.raw.diagnosticFamilies.find((coverage) => coverage.family === family) ?? fail(`Project ${state.raw.project.configPath} lacks ${family} diagnostic coverage.`);
			const occurrenceIdsForFamily = raw.diagnosticOccurrenceOrdinals.map((ordinal) => occurrenceIds.get(ordinal) ?? fail(`Diagnostic family ${family} references absent occurrence ${ordinal}.`));
			const records = projectDiagnostics.filter((diagnostic) => diagnostic.family === family);
			if (sortedUnique(occurrenceIdsForFamily).join('\0') !== records.map((record) => record.id).sort(compare).join('\0')) fail(`Diagnostic family ${family} does not cover its emitted records.`);
			return {
				coverage: raw.coverage,
				diagnosticIds: records.map((record) => record.id).sort(compare),
				family,
				manifestDigest: diagnosticManifestDigest(records),
				occurrenceCount: raw.diagnosticOccurrenceOrdinals.length,
				reason: raw.reason,
				recordCount: records.length,
				state: raw.state
			};
		});
		const tsProjectLimitations = limitationsForReasons(state.raw.project.partialityReasons, 'TS_PROJECT', state.raw.project.configPath);
		programs.push({
			checkerState: 'CREATED',
			contextDigest: state.contextDigest,
			diagnosticFamilies,
			diagnosticIds: projectDiagnostics.map((diagnostic) => diagnostic.id).sort(compare),
			id: state.programId,
			projectId: state.projectId,
			provenanceId: provenanceId(provenancesById, state, snapshotId, input.request.subjectId, 'TS_PROJECT', tsProjectLimitations),
			rootSourceIds: projectSources.filter((source) => source.rootFile).map((source) => source.id).sort(compare),
			sourceIds: projectSources.map((source) => source.id).sort(compare)
		});
		const partialityReasons = [...state.raw.project.partialityReasons].sort((left, right) => compare(reasonKey(left), reasonKey(right)));
		projects.push({
			configPath: state.raw.project.configPath,
			contextInputIds: [...state.contextInputIds].sort(compare),
			diagnosticIds: projectDiagnostics.map((diagnostic) => diagnostic.id).sort(compare),
			frameworkCandidates: sortedUnique(state.raw.project.frameworkCandidates),
			health: partialityReasons.length === 0 ? 'COMPLETE' : 'PARTIAL',
			id: state.projectId,
			kind: state.raw.project.kind,
			partialityReasons,
			programId: state.programId,
			programRecipe: state.recipe,
			projectReferences: sortedUnique(state.raw.project.projectReferences),
			provenanceId: provenanceId(provenancesById, state, snapshotId, input.request.subjectId, 'TS_PROJECT', tsProjectLimitations),
			rootDisposition: state.raw.project.rootDisposition,
			rootNames: sortedUnique(state.raw.project.rootNames),
			sourceIds: projectSources.map((source) => source.id).sort(compare)
		});
	}
	programs.sort((left, right) => compare(left.id, right.id));
	projects.sort((left, right) => compare(left.id, right.id));
	const provenances = [...provenancesById.values()].sort((left, right) => compare(left.id, right.id));

	const limitations = [...new Map(states.flatMap((state) => state.raw.project.partialityReasons.map((reason): SemanticLimitation => ({
		capability: reason.capability,
		closureEffect: 'DEGRADES_CLOSURE',
		reason: reason.message,
		region: reason.path ?? state.raw.project.configPath
	}))).map((limitation) => [limitationKey(limitation), limitation])).values()]
		.sort((left, right) => compare(limitationKey(left), limitationKey(right)));
	const tsProjectPartial = states.some((state) => state.raw.project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT')
		|| state.raw.diagnosticFamilies.some((family) => family.state === 'FAILED' || family.coverage === 'BOUNDED')
		|| state.raw.sources.some((source) => source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)));
	const tsSyntaxPartial = states.some((state) => state.raw.project.partialityReasons.some((reason) => reason.capability === 'TS_SYNTAX') || state.raw.project.frameworkCandidates.length > 0);
	const capabilities: SemanticCapabilityRecord[] = CAPABILITIES.map((capability) => ({
		capability,
		reason: capability === 'TS_PROJECT'
			? 'Project, Program, source-membership, compiler-context, and diagnostic facts are implemented by Slice 3A.'
			: capability === 'TS_SYNTAX'
				? 'Public TypeScript AST, declaration-candidate, literal, invocation, and assignment facts are implemented by Slice 3A.'
				: `${capability} is deliberately outside the Slice 3A implementation boundary.`,
		state: capability === 'TS_PROJECT' ? tsProjectPartial ? 'PARTIAL' : 'SUPPORTED'
			: capability === 'TS_SYNTAX' ? tsSyntaxPartial ? 'PARTIAL' : 'SUPPORTED'
				: 'UNSUPPORTED'
	}));

	const frameworkMembers = sortedUnique(projects.flatMap((project) => project.frameworkCandidates.map((candidate) => `${project.id}\0${candidate}`)));
	const populationValues: Readonly<Record<SemanticPopulationKind, SemanticPopulationMembers>> = {
		PROJECT: members(projects.map((record) => record.id)),
		PROGRAM: members(programs.map((record) => record.id)),
		SOURCE: members(sources.filter((record) => record.analysisDisposition === 'DEEP_INDEXED').map((record) => record.id), sources.filter((record) => record.analysisDisposition === 'CONTEXT_ONLY').map((record) => record.id)),
		AST_NODE: members(astNodes.map((record) => record.id)),
		DECLARATION_CANDIDATE: members(declarationCandidates.map((record) => record.id)),
		LITERAL: members(literals.map((record) => record.nodeId)),
		INVOCATION_SITE: members(invocations.map((record) => record.id)),
		ASSIGNMENT: members(assignments.map((record) => record.nodeId)),
		DIAGNOSTIC: members(diagnostics.map((record) => record.id)),
		PROVENANCE: members(provenances.map((record) => record.id)),
		FRAMEWORK_CANDIDATE: members(frameworkMembers, [], frameworkMembers),
		CONTEXT_INPUT: members([], compilerInputs.map((record) => record.id))
	};
	const populations = POPULATIONS.map((kind) => {
		const population = populationValues[kind];
		return semanticPopulation(kind, population, population.analyzed.length + population.contextOnly.length + population.excluded.length + population.failed.length === 0);
	});

	return {
		assignments,
		astNodes,
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: input.request.budgets,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		capabilities,
		compilerInputs,
		contextDigest,
		declarationCandidates,
		diagnostics,
		expectedEmpty: input.request.expectEmpty,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		health: tsProjectPartial || tsSyntaxPartial ? 'PARTIAL' : 'COMPLETE',
		id: snapshotId,
		invocations,
		limitations,
		literals,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		populations,
		programs,
		projects,
		provenances,
		provider: PROVIDER,
		requestedCapabilities,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		sources,
		subjectId: input.request.subjectId
	};
}
