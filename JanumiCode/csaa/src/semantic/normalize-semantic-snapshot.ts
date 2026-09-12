import type {
	BuildStaticSemanticSnapshotRequest,
	CompilerInputObservation,
	SemanticAliasRecord,
	SemanticAssignabilityRequest,
	SemanticAssignmentRecord,
	SemanticAstNodeRecord,
	SemanticCapability,
	SemanticCapabilityRecord,
	SemanticDeclarationCandidateRecord,
	SemanticDeclarationRecord,
	SemanticDiagnosticFamily,
	SemanticDiagnosticMessage,
	SemanticDiagnosticRecord,
	SemanticFactProvenanceRecord,
	SemanticHeritageOccurrenceRef,
	SemanticInvocationSiteRecord,
	SemanticLimitation,
	SemanticLiteralRecord,
	SemanticModuleExportRecord,
	SemanticModuleResolutionRecord,
	SemanticOverloadSetRecord,
	SemanticPopulationKind,
	SemanticProgramRecord,
	SemanticProjectRecord,
	SemanticProvenanceId,
	SemanticReferenceRecord,
	SemanticScopeRecord,
	SemanticSignatureOwner,
	SemanticSignatureParameterRecord,
	SemanticSignatureRecord,
	SemanticSourceRecord,
	SemanticSymbolRecord,
	SemanticTypeAcquisitionAnchor,
	SemanticTypeOrSignatureRef,
	SemanticTypeParameterOwner,
	SemanticTypeParameterRecord,
	SemanticTypeRecord,
	SemanticTypeRelationRecord,
	SemanticTypeSubjectRef,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	SEMANTIC_AST_TRAVERSAL_PROFILE,
	SEMANTIC_CANONICAL_PROFILE,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	SEMANTIC_TYPE_DISPLAY_PROFILE,
	SEMANTIC_TYPE_FINGERPRINT_PROFILE,
	TYPESCRIPT_PROVIDER_VERSION
} from '../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import type {
	CompilerProjectAttribution,
	VerifiedCompilerCapture
} from '../providers/typescript/compiler-input-journal.js';
import { canonicalSemanticJson } from './canonical.js';
import {
	compilerInputClosureDigest,
	semanticAliasId,
	semanticDeclarationCandidateId,
	semanticDeclarationId,
	semanticDurableDeclarationId,
	semanticDiagnosticId,
	semanticInvocationSiteId,
	semanticModuleExportId,
	semanticModuleResolutionId,
	semanticNodeId,
	semanticOverloadSetId,
	semanticProgramId,
	semanticProjectId,
	semanticProvenanceId,
	semanticReferenceId,
	semanticScopeId,
	semanticSignatureId,
	semanticSignatureParameterId,
	semanticSnapshotId,
	semanticSourceId,
	semanticSymbolId,
	semanticTypeId,
	semanticTypeParameterId,
	semanticTypeRelationId
} from './ids.js';
import { semanticPopulation, type SemanticPopulationMembers } from './population.js';
import type {
	RawSemanticAssignabilityRelation,
	RawSemanticDeclaration,
	RawSemanticDiagnosticMessage,
	RawSemanticGenericInstantiationRelation,
	RawSemanticHeritageOccurrenceRef,
	RawSemanticHeritageTypeRelation,
	RawSemanticOverloadMembershipRelation,
	RawSemanticOverloadSet,
	RawSemanticParameterConstraintRelation,
	RawSemanticPartialityReason,
	RawSemanticProgramRecipe,
	RawSemanticReference,
	RawSemanticScope,
	RawSemanticSignature,
	RawSemanticSignatureOwner,
	RawSemanticSignatureParameter,
	RawSemanticSource,
	RawSemanticSymbol,
	RawSemanticType,
	RawSemanticTypeAcquisitionAnchor,
	RawSemanticTypeAliasRelation,
	RawSemanticTypeConstituentRelation,
	RawSemanticTypeOfRelation,
	RawSemanticTypeOrSignatureRef,
	RawSemanticTypeParameter,
	RawSemanticTypeParameterOwner,
	RawSemanticTypeRelation,
	RawSemanticTypeSubjectRef,
	RawSemanticValue,
	RawStaticSemanticProjectExtraction
} from './raw-semantic-model.js';

const PROVIDER = Object.freeze({
	api: 'PUBLIC_COMPILER_API' as const,
	id: 'typescript' as const,
	version: TYPESCRIPT_PROVIDER_VERSION
});
const CAPABILITIES = [
	'TS_PROJECT',
	'TS_SYMBOL',
	'TS_SYNTAX',
	'TS_TYPE'
] as const satisfies readonly SemanticCapability[];
const POPULATIONS = [
	'PROJECT',
	'PROGRAM',
	'SOURCE',
	'SCOPE',
	'AST_NODE',
	'DECLARATION_CANDIDATE',
	'DECLARATION',
	'SYMBOL',
	'ALIAS',
	'REFERENCE',
	'MODULE_RESOLUTION',
	'MODULE_EXPORT',
	'TYPE',
	'TYPE_PARAMETER',
	'SIGNATURE',
	'SIGNATURE_PARAMETER',
	'OVERLOAD_SET',
	'TYPE_RELATION',
	'LITERAL',
	'INVOCATION_SITE',
	'ASSIGNMENT',
	'DIAGNOSTIC',
	'PROVENANCE',
	'FRAMEWORK_CANDIDATE',
	'CONTEXT_INPUT'
] as const satisfies readonly SemanticPopulationKind[];
const DIAGNOSTIC_FAMILIES = [
	'CONFIGURATION',
	'OPTIONS',
	'GLOBAL',
	'SYNTACTIC',
	'SEMANTIC',
	'DECLARATION'
] as const satisfies readonly SemanticDiagnosticFamily[];

export class SemanticNormalizationError extends Error {
	constructor(
		readonly code: 'BUDGET_EXCEEDED' | 'INVALID_RAW_MODEL',
		message: string
	) {
		super(message);
		this.name = 'SemanticNormalizationError';
	}
}

export interface NormalizeStaticSemanticSnapshotInput {
	readonly capture: Pick<
		VerifiedCompilerCapture,
		'closureDigest' | 'observations' | 'projectAttributions'
	>;
	readonly projects: readonly RawStaticSemanticProjectExtraction[];
	readonly request: BuildStaticSemanticSnapshotRequest;
	readonly subject: FrozenSubject;
}

interface ProjectState {
	readonly attribution: CompilerProjectAttribution;
	readonly candidateIds: Map<string, SemanticDeclarationCandidateRecord['id']>;
	readonly contextDigest: string;
	readonly contextInputIds: readonly CompilerInputObservation['id'][];
	readonly declarationIds: Map<number, SemanticDeclarationRecord['id']>;
	readonly nodeIds: Map<string, SemanticAstNodeRecord['id']>;
	readonly programId: SemanticProgramRecord['id'];
	readonly projectId: SemanticProjectRecord['id'];
	readonly provenanceIds: Map<string, SemanticProvenanceId>;
	readonly raw: RawStaticSemanticProjectExtraction;
	readonly recipe: ProgramRecipe;
	readonly sourceIds: Map<number, SemanticSourceRecord['id']>;
	readonly scopeIds: Map<number, SemanticScopeRecord['id']>;
	readonly signatureIds: Map<number, SemanticSignatureRecord['id']>;
	readonly signatureParameterIds: Map<number, SemanticSignatureParameterRecord['id']>;
	readonly symbolIds: Map<number, SemanticSymbolRecord['id']>;
	readonly overloadSetIds: Map<number, SemanticOverloadSetRecord['id']>;
	readonly typeIds: Map<number, SemanticTypeRecord['id']>;
	readonly typeParameterIds: Map<number, SemanticTypeParameterRecord['id']>;
	readonly typeRelationIds: Map<number, SemanticTypeRelationRecord['id']>;
}

function fail(
	message: string,
	code: SemanticNormalizationError['code'] = 'INVALID_RAW_MODEL'
): never {
	throw new SemanticNormalizationError(code, message);
}

function compare(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function sortedUnique<Value extends string>(values: readonly Value[]): Value[] {
	return [...new Set(values)].sort(compare);
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) fail(`${field} must be unique.`);
}

function assertCanonicalOrdinals(values: readonly number[], field: string): void {
	assertUnique(values.map(String), field);
	const sorted = [...values].sort((left, right) => left - right);
	for (let index = 0; index < sorted.length; index += 1)
		if (!Number.isSafeInteger(sorted[index]) || sorted[index] !== index)
			fail(`${field} must be contiguous zero-based safe integers.`);
}

function assertSha256(value: string, field: string): void {
	if (!/^[0-9a-f]{64}$/.test(value)) fail(`${field} must be a lowercase SHA-256 digest.`);
}

function canonicalKey(value: unknown): string {
	return canonicalSemanticJson(value);
}

function assertNever(value: never, field: string): never {
	return fail(`${field} contains an unsupported variant ${canonicalKey(value)}.`);
}

function cloneRawValue(value: RawSemanticValue): unknown {
	if (Array.isArray(value)) return value.map((entry) => cloneRawValue(entry));
	if (value !== null && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, cloneRawValue(entry)])
		);
	return value;
}

function materializeRecipe(raw: RawSemanticProgramRecipe): ProgramRecipe {
	return {
		compilerOptions: Object.fromEntries(
			Object.entries(raw.compilerOptions).map(([key, value]) => [key, cloneRawValue(value)])
		),
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

const MULTI_PROGRAM_TS_SYMBOL_LIMITATION: SemanticLimitation = Object.freeze({
	capability: 'TS_SYMBOL',
	closureEffect: 'DEGRADES_CLOSURE',
	reason:
		'TypeScript symbol extraction and resolution are Program-scoped; cross-Program symbol identity and binding reconciliation is not implemented for this multi-project snapshot.',
	region: 'typescript-program-boundaries'
});

const MULTI_PROGRAM_TS_TYPE_LIMITATION: SemanticLimitation = Object.freeze({
	capability: 'TS_TYPE',
	closureEffect: 'DEGRADES_CLOSURE',
	reason:
		'TypeScript type and Signature identities are Program-scoped; cross-Program type equivalence and checker-judgment reconciliation are intentionally not asserted for this multi-project snapshot.',
	region: 'typescript-program-boundaries'
});

function reasonKey(value: RawSemanticPartialityReason): string {
	return `${value.capability}\0${value.code}\0${value.path ?? ''}\0${value.message}`;
}

function limitationsForReasons(
	reasons: readonly RawSemanticPartialityReason[],
	capability: SemanticCapability,
	fallbackRegion: string
): SemanticLimitation[] {
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
	return [...byKey.values()].sort((left, right) =>
		compare(limitationKey(left), limitationKey(right))
	);
}

function typeLimitations(state: ProjectState, multiProgram: boolean): SemanticLimitation[] {
	const limitations = limitationsForReasons(
		state.raw.project.partialityReasons,
		'TS_TYPE',
		state.raw.project.configPath
	);
	if (multiProgram) limitations.push(MULTI_PROGRAM_TS_TYPE_LIMITATION);
	const add = (count: number, noun: string): void => {
		if (count === 0) return;
		limitations.push({
			capability: 'TS_TYPE',
			closureEffect: 'DEGRADES_CLOSURE',
			reason: `${count} ${noun} ${count === 1 ? 'fact is' : 'facts are'} explicitly bounded, unresolved, or unsupported.`,
			region: state.raw.project.configPath
		});
	};
	add(state.raw.types.filter((record) => record.structureState === 'BOUNDED').length, 'type');
	add(
		state.raw.typeParameters.filter(
			(record) =>
				['UNRESOLVED', 'UNSUPPORTED'].includes(record.constraintState) ||
				['UNRESOLVED', 'UNSUPPORTED'].includes(record.defaultState)
		).length,
		'type-parameter'
	);
	add(
		state.raw.typeRelations.filter((record) => record.state !== 'CONFIRMED').length,
		'type-relation'
	);
	return [
		...new Map(limitations.map((limitation) => [limitationKey(limitation), limitation])).values()
	].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
}

function symbolLimitations(state: ProjectState, multiProgram: boolean): SemanticLimitation[] {
	const limitations = limitationsForReasons(
		state.raw.project.partialityReasons,
		'TS_SYMBOL',
		state.raw.project.configPath
	);
	if (multiProgram) limitations.push(MULTI_PROGRAM_TS_SYMBOL_LIMITATION);
	const add = (count: number, noun: string): void => {
		if (count === 0) return;
		limitations.push({
			capability: 'TS_SYMBOL',
			closureEffect: 'DEGRADES_CLOSURE',
			reason: `${count} ${noun} ${count === 1 ? 'fact is' : 'facts are'} explicitly unresolved, circular, or unsupported.`,
			region: state.raw.project.configPath
		});
	};
	add(state.raw.aliases.filter((record) => record.state !== 'RESOLVED').length, 'alias');
	add(
		state.raw.references.filter(
			(record) =>
				record.resolutionState === 'UNRESOLVED' || record.resolutionState === 'UNSUPPORTED'
		).length,
		'reference'
	);
	add(
		state.raw.moduleResolutions.filter(
			(record) =>
				record.resolutionState === 'UNRESOLVED' || record.resolutionState === 'UNSUPPORTED'
		).length,
		'module-resolution'
	);
	add(
		state.raw.moduleExports.filter((record) => record.state === 'UNRESOLVED').length,
		'module-export'
	);
	add(
		state.raw.declarations.filter(
			(record) =>
				record.scopeLinkState === 'UNSUPPORTED' || record.symbolBindingState === 'UNSUPPORTED'
		).length +
			state.raw.references.filter((record) => record.scopeLinkState === 'UNSUPPORTED').length,
		'scope-link'
	);
	return [
		...new Map(limitations.map((limitation) => [limitationKey(limitation), limitation])).values()
	].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
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
		if (
			!Number.isSafeInteger(current.textLength) ||
			current.textLength < 1 ||
			!Number.isSafeInteger(total + current.textLength)
		)
			fail('Raw diagnostic character count is invalid or overflowed.');
		total += current.textLength;
		for (const next of current.next) pending.push(next);
	}
	return total;
}

function rawDiagnosticCharacters(projects: readonly RawStaticSemanticProjectExtraction[]): number {
	let total = 0;
	for (const project of projects)
		for (const diagnostic of project.diagnostics) {
			const characters =
				rawDiagnosticMessageCharacters(diagnostic.message) +
				diagnostic.related.reduce(
					(sum, related) => sum + rawDiagnosticMessageCharacters(related.message),
					0
				);
			if (!Number.isSafeInteger(characters) || !Number.isSafeInteger(total + characters))
				fail('Raw diagnostic character count overflowed.');
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

interface ProvenanceContext {
	readonly provenancesById: Map<string, SemanticFactProvenanceRecord>;
	readonly snapshotId: StaticSemanticSnapshot['id'];
	readonly subjectId: string;
}

function provenanceMethod(capability: SemanticCapability, scopeDerived: boolean): string {
	if (scopeDerived) return 'typescript-public-ast-binding-rules';
	if (capability === 'TS_PROJECT') return 'typescript-public-program-and-diagnostics';
	if (capability === 'TS_SYMBOL') return 'typescript-public-type-checker-binding';
	if (capability === 'TS_TYPE') return 'typescript-public-type-checker-types-and-signatures';
	return 'typescript-public-normalized-ast';
}

function provenanceRationale(
	capability: SemanticCapability,
	scopeDerived: boolean,
	partial: boolean
): string {
	if (scopeDerived && partial)
		return 'Scope and binding-placement facts were derived from the public AST with the declared bounded limitations.';
	if (scopeDerived)
		return 'Scope and binding-placement facts were derived from public AST syntax and TypeScript binding rules.';
	if (partial)
		return `${capability} facts were produced successfully with the declared bounded limitations.`;
	return `${capability} facts were produced successfully from the exact verified compiler context.`;
}

function provenanceSupportKind(
	capability: SemanticCapability,
	scopeDerived: boolean
): 'compiler-confirmed' | 'derived' | 'direct-extraction' {
	if (scopeDerived) return 'derived';
	if (capability === 'TS_SYNTAX') return 'direct-extraction';
	return 'compiler-confirmed';
}

function provenanceId(
	context: ProvenanceContext,
	state: ProjectState,
	capability: SemanticCapability,
	limitations: readonly SemanticLimitation[],
	sourceId: SemanticSourceRecord['id'] | null = null,
	factBasis: 'COMPILER' | 'SCOPE_DERIVED' = 'COMPILER'
): SemanticProvenanceId {
	const canonicalLimitations = [...limitations].sort((left, right) =>
		compare(limitationKey(left), limitationKey(right))
	);
	const cacheKey = `${capability}\0${factBasis}\0${sourceId ?? ''}\0${canonicalLimitations.map(limitationKey).join('\u0001')}`;
	const cached = state.provenanceIds.get(cacheKey);
	if (cached !== undefined) return cached;
	const parentProvenanceId =
		sourceId === null
			? null
			: provenanceId(context, state, capability, canonicalLimitations, null, factBasis);
	const partial = canonicalLimitations.some((limitation) => limitation.closureEffect !== 'NONE');
	const supportRefs =
		sourceId === null
			? sortedUnique([
					context.subjectId,
					context.snapshotId,
					state.projectId,
					state.programId,
					...state.contextInputIds
				])
			: sortedUnique([parentProvenanceId!, sourceId]);
	const scopeDerived = capability === 'TS_SYMBOL' && factBasis === 'SCOPE_DERIVED';
	const method = provenanceMethod(capability, scopeDerived);
	const rationale = provenanceRationale(capability, scopeDerived, partial);
	const preimage: Omit<SemanticFactProvenanceRecord, 'id'> = {
		capability,
		epistemic: {
			capabilityCoverage: partial ? 'partial' : 'supported',
			conflict: 'unopposed',
			executionHealth: 'succeeded',
			freshness: 'current-for-subject',
			inference: scopeDerived ? 'derived' : 'direct',
			rationale,
			supportBasis: {
				kind: provenanceSupportKind(capability, scopeDerived),
				method,
				rationale,
				sourceRefs: supportRefs
			},
			unresolvedRegions: sortedUnique(
				canonicalLimitations
					.filter((limitation) => limitation.closureEffect !== 'NONE')
					.map((limitation) => limitation.region)
			)
		},
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		invalidationDependencies: [
			{ digest: state.contextDigest, kind: 'CONTEXT_INPUT' },
			{ digest: sha256(canonicalSemanticJson(SEMANTIC_EXTRACTION_VERSION)), kind: 'EXTRACTION' },
			{ digest: state.recipe.projectResolutionDigest, kind: 'PROJECT_RECIPE' },
			{ digest: sha256(canonicalSemanticJson(PROVIDER)), kind: 'PROVIDER' },
			{ digest: context.subjectId, kind: 'SUBJECT' }
		],
		limitations: canonicalLimitations,
		parentProvenanceId,
		projectId: state.projectId,
		provider: PROVIDER,
		snapshotId: context.snapshotId,
		sourceId,
		subjectId: context.subjectId
	};
	const id = semanticProvenanceId(preimage);
	const record: SemanticFactProvenanceRecord = { ...preimage, id };
	const existing = context.provenancesById.get(id);
	if (existing !== undefined && canonicalSemanticJson(existing) !== canonicalSemanticJson(record))
		fail(`Provenance identity collision for ${id}.`);
	context.provenancesById.set(id, record);
	state.provenanceIds.set(cacheKey, id);
	return id;
}

function sourceLimitations(
	state: ProjectState,
	source: RawStaticSemanticProjectExtraction['sources'][number]
): SemanticLimitation[] {
	const limitations = limitationsForReasons(
		state.raw.project.partialityReasons,
		'TS_PROJECT',
		state.raw.project.configPath
	);
	if (source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)) {
		limitations.push({
			capability: 'TS_PROJECT',
			closureEffect: 'DEGRADES_CLOSURE',
			reason: source.mapping.reason,
			region: source.logicalPath
		});
	}
	return [
		...new Map(limitations.map((limitation) => [limitationKey(limitation), limitation])).values()
	].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
}

function diagnosticManifestDigest(records: readonly SemanticDiagnosticRecord[]): string {
	return sha256(
		canonicalSemanticJson(
			[...records]
				.sort((left, right) => compare(left.id, right.id))
				.map(({ id, multiplicity }) => ({ id, multiplicity }))
		)
	);
}

function assertRequestedCapabilities(
	requestedCapabilities: readonly string[],
	typeRequested: boolean
): void {
	const expectedCapabilities = typeRequested
		? ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
		: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
	if (canonicalSemanticJson(requestedCapabilities) !== canonicalSemanticJson(expectedCapabilities))
		fail(
			typeRequested
				? 'TS_TYPE normalization requires the TS_PROJECT, TS_SYMBOL, and TS_SYNTAX prerequisite closure.'
				: 'DWP-003 TS_SYMBOL normalization requires exactly TS_PROJECT, TS_SYMBOL, and TS_SYNTAX.'
		);
}

function assertProjectPopulations(input: NormalizeStaticSemanticSnapshotInput): void {
	if (
		input.projects.length !== input.subject.projects.length ||
		input.projects.length > input.request.budgets.maxProjects
	)
		fail(
			'Raw project population does not reproduce the frozen project population.',
			input.projects.length > input.request.budgets.maxProjects
				? 'BUDGET_EXCEEDED'
				: 'INVALID_RAW_MODEL'
		);
	if (input.projects.some((project) => project.evidenceState !== 'VERIFIED_COMPILER_INPUT'))
		fail(
			'Only finalized and rechecked compiler-input evidence may cross the normalization boundary.'
		);
	if (input.capture.closureDigest !== compilerInputClosureDigest(input.capture.observations))
		fail('Verified compiler capture closure digest is incoherent.');
	assertUnique(
		input.projects.map((project) => project.project.configPath),
		'Raw project configuration paths'
	);
	assertUnique(
		input.capture.projectAttributions.map((attribution) => attribution.projectKey),
		'Compiler project attributions'
	);
}

function assertProjectTypeCollections(
	project: RawStaticSemanticProjectExtraction,
	typeRequested: boolean
): void {
	const typeCollections = [
		['overloadSets', project.overloadSets],
		['signatureParameters', project.signatureParameters],
		['signatures', project.signatures],
		['typeParameters', project.typeParameters],
		['typeRelations', project.typeRelations],
		['types', project.types]
	] as const;
	for (const [name, collection] of typeCollections)
		if (!Array.isArray(collection))
			fail(`Raw project ${project.project.configPath} lacks the ${name} TS_TYPE collection.`);
	if (!typeRequested && typeCollections.some(([, collection]) => collection.length > 0))
		fail(`Raw project ${project.project.configPath} emitted TS_TYPE facts when not requested.`);
	if (
		!typeRequested &&
		project.project.partialityReasons.some((reason) => reason.capability === 'TS_TYPE')
	)
		fail(
			`Raw project ${project.project.configPath} emitted TS_TYPE partiality when not requested.`
		);
}

function assertProjectPathReconciliation(input: NormalizeStaticSemanticSnapshotInput): void {
	const rawPaths = sortedUnique(input.projects.map((project) => project.project.configPath));
	const subjectPaths = sortedUnique(input.subject.projects.map((project) => project.configPath));
	const attributionPaths = sortedUnique(
		input.capture.projectAttributions.map((attribution) => attribution.projectKey)
	);
	if (
		canonicalSemanticJson(rawPaths) !== canonicalSemanticJson(subjectPaths) ||
		canonicalSemanticJson(rawPaths) !== canonicalSemanticJson(attributionPaths)
	)
		fail('Raw, frozen, and compiler-attributed project populations differ.');
}

function validateInput(input: NormalizeStaticSemanticSnapshotInput): void {
	if (input.request.subjectId !== input.subject.descriptor.subjectId)
		fail('Semantic request and FrozenSubject identities differ.');
	const requestedCapabilities = [...input.request.capabilities].sort(compare);
	const typeRequested = requestedCapabilities.includes('TS_TYPE');
	assertRequestedCapabilities(requestedCapabilities, typeRequested);
	if (!Array.isArray(input.request.assignabilityRequests))
		fail('Semantic assignability requests must be an array.');
	assertUnique(
		input.request.assignabilityRequests.map((request) => request.requestId),
		'Semantic assignability request identities'
	);
	if (!typeRequested && input.request.assignabilityRequests.length > 0)
		fail('Assignability requests require TS_TYPE.');
	assertProjectPopulations(input);
	for (const project of input.projects) assertProjectTypeCollections(project, typeRequested);
	assertProjectPathReconciliation(input);
}

interface NormalizationContext {
	readonly multiProgram: boolean;
	readonly provenancesById: Map<string, SemanticFactProvenanceRecord>;
	readonly requestedAssignabilityIds: readonly string[];
	readonly snapshotId: StaticSemanticSnapshot['id'];
	readonly states: readonly ProjectState[];
	readonly subjectId: string;
	readonly typeRequested: boolean;
}

function compareAssignabilityRequests(
	left: SemanticAssignabilityRequest,
	right: SemanticAssignabilityRequest
): number {
	const byId = compare(left.requestId, right.requestId);
	return byId === 0 ? compare(canonicalKey(left), canonicalKey(right)) : byId;
}

function buildProjectState(
	input: NormalizeStaticSemanticSnapshotInput,
	snapshotId: StaticSemanticSnapshot['id'],
	observationById: ReadonlyMap<CompilerInputObservation['id'], CompilerInputObservation>,
	raw: RawStaticSemanticProjectExtraction
): ProjectState {
	const recipe = materializeRecipe(raw.project.programRecipe);
	const authoritative = input.subject.projects.find(
		(project) => project.configPath === raw.project.configPath
	);
	const attribution = input.capture.projectAttributions.find(
		(candidate) => candidate.projectKey === raw.project.configPath
	);
	if (authoritative === undefined || attribution === undefined)
		fail(`Project ${raw.project.configPath} is not bound by frozen subject and capture.`);
	if (
		canonicalSemanticJson(recipe) !== canonicalSemanticJson(authoritative.programRecipe) ||
		attribution.projectResolutionDigest !== recipe.projectResolutionDigest
	)
		fail(`Project ${raw.project.configPath} does not reproduce its authoritative recipe.`);
	const contextInputIds = sortedUnique(
		attribution.contextInputIds
	) as CompilerInputObservation['id'][];
	const observations = contextInputIds.map(
		(id) =>
			observationById.get(id) ??
			fail(`Project ${raw.project.configPath} references an absent compiler input.`)
	);
	const projectContextDigest = compilerInputClosureDigest(observations);
	const projectId = semanticProjectId({
		configPath: raw.project.configPath,
		projectResolutionDigest: recipe.projectResolutionDigest,
		snapshotId
	});
	const programId = semanticProgramId({ contextDigest: projectContextDigest, projectId });
	const sourceIds = new Map<number, SemanticSourceRecord['id']>();
	assertUnique(
		raw.sources.map((source) => String(source.sourceOrdinal)),
		`Project ${raw.project.configPath} source ordinals`
	);
	if (raw.sources.length > input.request.budgets.maxSources)
		fail(`Project ${raw.project.configPath} exceeds the source budget.`, 'BUDGET_EXCEEDED');
	for (const source of raw.sources) {
		if (source.logicalPath.length > input.request.budgets.maxPathCharacters)
			fail(`Source path ${source.logicalPath} exceeds the path budget.`, 'BUDGET_EXCEEDED');
		sourceIds.set(
			source.sourceOrdinal,
			semanticSourceId({
				contentSha256: source.contentSha256,
				logicalPath: source.logicalPath,
				moduleKind: source.moduleKind,
				programId
			})
		);
	}
	return {
		attribution,
		candidateIds: new Map(),
		contextDigest: projectContextDigest,
		contextInputIds,
		declarationIds: new Map(),
		nodeIds: new Map(),
		programId,
		projectId,
		provenanceIds: new Map(),
		raw,
		recipe,
		scopeIds: new Map(),
		sourceIds,
		signatureIds: new Map(),
		signatureParameterIds: new Map(),
		symbolIds: new Map(),
		overloadSetIds: new Map(),
		typeIds: new Map(),
		typeParameterIds: new Map(),
		typeRelationIds: new Map()
	};
}

function assertSnapshotBudgets(
	input: NormalizeStaticSemanticSnapshotInput,
	states: readonly ProjectState[],
	rawProjects: readonly RawStaticSemanticProjectExtraction[]
): void {
	const totalSources = states.reduce((total, state) => total + state.raw.sources.length, 0);
	const totalNodes = states.reduce((total, state) => total + state.raw.astNodes.length, 0);
	const totalScopes = states.reduce((total, state) => total + state.raw.scopes.length, 0);
	const totalDiagnosticOccurrences = states.reduce(
		(total, state) => total + state.raw.diagnostics.length,
		0
	);
	const totalDiagnosticCharacters = rawDiagnosticCharacters(rawProjects);
	const totalCompilerFacts = states.reduce(
		(total, state) =>
			total +
			state.raw.aliases.length +
			state.raw.declarations.length +
			state.raw.moduleExports.length +
			state.raw.moduleResolutions.length +
			state.raw.overloadSets.length +
			state.raw.references.length +
			state.raw.signatureParameters.length +
			state.raw.signatures.length +
			state.raw.symbols.length +
			state.raw.typeParameters.length +
			state.raw.typeRelations.length +
			state.raw.types.length +
			state.raw.invocations.filter(
				(invocation) => invocation.resolutionReason !== 'TYPE_CAPABILITY_NOT_REQUESTED'
			).length,
		0
	);
	if (totalSources > input.request.budgets.maxSources)
		fail('Raw sources exceed the snapshot source budget.', 'BUDGET_EXCEEDED');
	if (totalNodes > input.request.budgets.maxAstNodes)
		fail('Raw AST nodes exceed the snapshot node budget.', 'BUDGET_EXCEEDED');
	if (totalScopes > input.request.budgets.maxScopes)
		fail('Raw scopes exceed the snapshot scope budget.', 'BUDGET_EXCEEDED');
	if (totalDiagnosticOccurrences > input.request.budgets.maxDiagnostics)
		fail('Raw diagnostics exceed the snapshot diagnostic budget.', 'BUDGET_EXCEEDED');
	if (totalDiagnosticCharacters > input.request.budgets.maxDiagnosticCharacters)
		fail(
			'Raw diagnostic characters exceed the snapshot diagnostic-character budget.',
			'BUDGET_EXCEEDED'
		);
	if (totalCompilerFacts > input.request.budgets.maxCompilerFacts)
		fail('Raw compiler facts exceed the snapshot compiler-fact budget.', 'BUDGET_EXCEEDED');
}

function assignProjectNodeIdentities(state: ProjectState): void {
	const nodes = [...state.raw.astNodes].sort(
		(left, right) =>
			left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
	);
	assertUnique(
		nodes.map((node) => nodeKey(node.sourceOrdinal, node.nodeOrdinal)),
		`Project ${state.raw.project.configPath} node ordinals`
	);
	for (const node of nodes) {
		const sourceId =
			state.sourceIds.get(node.sourceOrdinal) ??
			fail(`AST node references absent source ordinal ${node.sourceOrdinal}.`);
		const parentId =
			node.parentNodeOrdinal === null
				? null
				: (state.nodeIds.get(nodeKey(node.sourceOrdinal, node.parentNodeOrdinal)) ??
					fail(`AST node ${node.nodeOrdinal} precedes or lacks its parent.`));
		const structuralRoles = sortedUnique(node.structuralRoles);
		state.nodeIds.set(
			nodeKey(node.sourceOrdinal, node.nodeOrdinal),
			semanticNodeId({
				end: node.end,
				fullStart: node.fullStart,
				kind: node.kind,
				parentId,
				siblingOrdinal: node.siblingOrdinal,
				sourceId,
				start: node.start,
				structuralRoles
			})
		);
	}
}

function assignNodeIdentities(states: readonly ProjectState[]): void {
	for (const state of states) assignProjectNodeIdentities(state);
}

interface DiagnosticNormalization {
	readonly diagnostics: SemanticDiagnosticRecord[];
	readonly occurrenceIdsByProject: Map<string, Map<number, SemanticDiagnosticRecord['id']>>;
}

function collectProjectDiagnostics(
	context: NormalizationContext,
	state: ProjectState,
	diagnosticsById: Map<string, SemanticDiagnosticRecord>
): Map<number, SemanticDiagnosticRecord['id']> {
	const occurrenceIds = new Map<number, SemanticDiagnosticRecord['id']>();
	assertUnique(
		state.raw.diagnostics.map((diagnostic) => String(diagnostic.occurrenceOrdinal)),
		`Project ${state.raw.project.configPath} diagnostic occurrence ordinals`
	);
	for (const raw of state.raw.diagnostics) {
		const sourceId =
			raw.sourceOrdinal === null
				? null
				: (state.sourceIds.get(raw.sourceOrdinal) ??
					fail(`Diagnostic references absent source ordinal ${raw.sourceOrdinal}.`));
		const related = raw.related
			.map((entry) => ({
				category: entry.category,
				code: entry.code,
				end: entry.end,
				message: cloneDiagnosticMessage(entry.message),
				path: entry.path,
				start: entry.start
			}))
			.sort((left, right) => compare(canonicalSemanticJson(left), canonicalSemanticJson(right)));
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
				context,
				state,
				'TS_PROJECT',
				limitationsForReasons(
					state.raw.project.partialityReasons,
					'TS_PROJECT',
					state.raw.project.configPath
				),
				raw.locationKind === 'SOURCE' && raw.start !== null && raw.end !== null ? sourceId : null
			)
		});
	}
	return occurrenceIds;
}

function buildDiagnostics(context: NormalizationContext): DiagnosticNormalization {
	const diagnosticsById = new Map<string, SemanticDiagnosticRecord>();
	const occurrenceIdsByProject = new Map<string, Map<number, SemanticDiagnosticRecord['id']>>();
	for (const state of context.states)
		occurrenceIdsByProject.set(
			state.raw.project.configPath,
			collectProjectDiagnostics(context, state, diagnosticsById)
		);
	return {
		diagnostics: [...diagnosticsById.values()].sort((left, right) => compare(left.id, right.id)),
		occurrenceIdsByProject
	};
}

interface SyntaxRecords {
	readonly assignments: SemanticAssignmentRecord[];
	readonly astNodes: SemanticAstNodeRecord[];
	readonly declarationCandidates: SemanticDeclarationCandidateRecord[];
	readonly literals: SemanticLiteralRecord[];
}

type NodeIdByOrdinal = (sourceOrdinal: number, ordinal: number) => SemanticAstNodeRecord['id'];

function nodeIdByOrdinalFor(state: ProjectState): NodeIdByOrdinal {
	return (sourceOrdinal, ordinal) =>
		state.nodeIds.get(nodeKey(sourceOrdinal, ordinal)) ??
		fail(`Node ordinal ${ordinal} is absent.`);
}

function collectAstNodes(state: ProjectState, astNodes: SemanticAstNodeRecord[]): void {
	for (const raw of state.raw.astNodes) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ?? fail('AST source ordinal is absent.');
		const id =
			state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ??
			fail('AST identity is absent.');
		const parentId =
			raw.parentNodeOrdinal === null
				? null
				: (state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.parentNodeOrdinal)) ??
					fail('AST parent identity is absent.'));
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
}

function collectDeclarationCandidates(
	state: ProjectState,
	nodeByOrdinal: NodeIdByOrdinal,
	declarationCandidates: SemanticDeclarationCandidateRecord[]
): void {
	for (const raw of state.raw.declarationCandidates) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ?? fail('Declaration source ordinal is absent.');
		const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
		const id = semanticDeclarationCandidateId({
			candidateRole: raw.candidateRole,
			nodeId,
			syntaxKind: raw.syntaxKind
		});
		const candidateKey = nodeKey(raw.sourceOrdinal, raw.nodeOrdinal);
		if (state.candidateIds.has(candidateKey))
			fail(`Declaration-candidate node ${raw.nodeOrdinal} is not unique within its source.`);
		state.candidateIds.set(candidateKey, id);
		declarationCandidates.push({
			ambientSyntax: raw.ambientSyntax,
			candidateRole: raw.candidateRole,
			candidateState: 'SYNTAX_ONLY',
			exportCarrierNodeId:
				raw.exportCarrierNodeOrdinal === null
					? null
					: nodeByOrdinal(raw.sourceOrdinal, raw.exportCarrierNodeOrdinal),
			exportSyntax: raw.exportSyntax,
			id,
			localModifiers: [...raw.localModifiers].sort((left, right) =>
				compare(`${left.code}:${left.name}`, `${right.code}:${right.name}`)
			),
			nameNodeId:
				raw.nameNodeOrdinal === null ? null : nodeByOrdinal(raw.sourceOrdinal, raw.nameNodeOrdinal),
			nameState: raw.nameState,
			nodeId,
			sourceId,
			syntacticName: raw.syntacticName,
			syntaxKind: raw.syntaxKind,
			syntaxKindName: raw.syntaxKindName
		});
	}
}

function collectLiterals(
	state: ProjectState,
	nodeByOrdinal: NodeIdByOrdinal,
	literals: SemanticLiteralRecord[]
): void {
	for (const raw of state.raw.literals) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ?? fail('Literal source ordinal is absent.');
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
}

function collectInvocations(
	context: NormalizationContext,
	state: ProjectState,
	nodeByOrdinal: NodeIdByOrdinal,
	invocations: SemanticInvocationSiteRecord[]
): void {
	for (const raw of state.raw.invocations) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ?? fail('Invocation source ordinal is absent.');
		const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
		const resolvedSignatureId =
			raw.resolvedSignatureOrdinal === null
				? null
				: (state.signatureIds.get(raw.resolvedSignatureOrdinal) ??
					fail('Invocation references an absent resolved Signature ordinal.'));
		const implementationDeclarationId =
			raw.implementationDeclarationOrdinal === null
				? null
				: (state.declarationIds.get(raw.implementationDeclarationOrdinal) ??
					fail('Invocation references an absent implementation declaration ordinal.'));
		const implementationNodeId =
			raw.implementationNodeOrdinal === null || raw.implementationSourceOrdinal === null
				? null
				: nodeByOrdinal(raw.implementationSourceOrdinal, raw.implementationNodeOrdinal);
		const implementationCoordinatesCoherent =
			(raw.implementationNodeOrdinal === null) === (raw.implementationSourceOrdinal === null);
		const targetCoherent =
			raw.targetState === 'SYNTAX_ONLY'
				? resolvedSignatureId === null &&
					implementationDeclarationId === null &&
					implementationNodeId === null &&
					[
						'TYPE_CAPABILITY_NOT_REQUESTED',
						'COMPILER_SIGNATURE_UNRESOLVED',
						'SIGNATURE_DECLARATION_UNRETAINED'
					].includes(raw.resolutionReason)
				: raw.targetState === 'SIGNATURE_RESOLVED'
					? resolvedSignatureId !== null &&
						implementationDeclarationId === null &&
						implementationNodeId === null &&
						[
							'IMPLEMENTATION_UNAVAILABLE',
							'IMPLEMENTATION_NOT_UNIQUE',
							'IMPLEMENTATION_NOT_DEEP_INDEXED'
						].includes(raw.resolutionReason)
					: resolvedSignatureId !== null &&
						implementationNodeId !== null &&
						raw.resolutionReason === 'IMPLEMENTATION_IDENTIFIED';
		if (!implementationCoordinatesCoherent || !targetCoherent)
			fail('Invocation target evidence is incoherent.');
		const base = {
			calleeNodeId: nodeByOrdinal(raw.sourceOrdinal, raw.calleeNodeOrdinal),
			id: semanticInvocationSiteId({ invocationKind: raw.invocationKind, nodeId }),
			implementationDeclarationId,
			implementationNodeId,
			invocationKind: raw.invocationKind,
			nodeId,
			resolutionProvenanceId:
				raw.resolutionReason === 'TYPE_CAPABILITY_NOT_REQUESTED'
					? null
					: provenanceId(context, state, 'TS_TYPE', typeLimitations(state, context.multiProgram)),
			resolutionReason: raw.resolutionReason,
			resolvedSignatureId,
			sourceId,
			targetState: raw.targetState
		};
		if (raw.invocationKind === 'CALL')
			invocations.push({
				...base,
				argumentNodeIds: raw.argumentNodeOrdinals.map((ordinal) =>
					nodeByOrdinal(raw.sourceOrdinal, ordinal)
				),
				invocationKind: 'CALL',
				optional: raw.optional,
				templateNodeId: null
			});
		else if (raw.invocationKind === 'NEW')
			invocations.push({
				...base,
				argumentNodeIds: raw.argumentNodeOrdinals.map((ordinal) =>
					nodeByOrdinal(raw.sourceOrdinal, ordinal)
				),
				invocationKind: 'NEW',
				optional: false,
				templateNodeId: null
			});
		else
			invocations.push({
				...base,
				argumentNodeIds: [],
				invocationKind: 'TAGGED_TEMPLATE',
				optional: false,
				templateNodeId:
					raw.templateNodeOrdinal === null
						? fail('Tagged template lacks its template node.')
						: nodeByOrdinal(raw.sourceOrdinal, raw.templateNodeOrdinal)
			});
	}
}

function buildInvocations(context: NormalizationContext): SemanticInvocationSiteRecord[] {
	const invocations: SemanticInvocationSiteRecord[] = [];
	for (const state of context.states)
		collectInvocations(context, state, nodeIdByOrdinalFor(state), invocations);
	invocations.sort((left, right) => compare(left.id, right.id));
	return invocations;
}

function collectAssignments(
	state: ProjectState,
	nodeByOrdinal: NodeIdByOrdinal,
	assignments: SemanticAssignmentRecord[]
): void {
	for (const raw of state.raw.assignments) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ?? fail('Assignment source ordinal is absent.');
		const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
		assignments.push({
			assignmentKind: raw.assignmentKind,
			nodeId,
			operatorKind: raw.operatorKind,
			operatorName: raw.operatorName,
			sourceId,
			targetNodeId: nodeByOrdinal(raw.sourceOrdinal, raw.targetNodeOrdinal),
			valueNodeId:
				raw.valueNodeOrdinal === null
					? null
					: nodeByOrdinal(raw.sourceOrdinal, raw.valueNodeOrdinal)
		});
	}
}

function collectProjectSyntaxRecords(state: ProjectState, records: SyntaxRecords): void {
	collectAstNodes(state, records.astNodes);
	const nodeByOrdinal = nodeIdByOrdinalFor(state);
	collectDeclarationCandidates(state, nodeByOrdinal, records.declarationCandidates);
	collectLiterals(state, nodeByOrdinal, records.literals);
	collectAssignments(state, nodeByOrdinal, records.assignments);
}

function buildSyntaxRecords(states: readonly ProjectState[]): SyntaxRecords {
	const records: SyntaxRecords = {
		assignments: [],
		astNodes: [],
		declarationCandidates: [],
		literals: []
	};
	for (const state of states) collectProjectSyntaxRecords(state, records);
	records.astNodes.sort((left, right) => compare(left.id, right.id));
	records.declarationCandidates.sort((left, right) => compare(left.id, right.id));
	records.literals.sort((left, right) => compare(left.nodeId, right.nodeId));
	records.assignments.sort((left, right) => compare(left.nodeId, right.nodeId));
	return records;
}

function assignScopeIdentities(state: ProjectState): void {
	assertUnique(
		state.raw.scopes.map((scope) => String(scope.scopeOrdinal)),
		`Project ${state.raw.project.configPath} scope ordinals`
	);
	const scopeIds = new Set<string>();
	for (const raw of state.raw.scopes) {
		const sourceId =
			raw.sourceOrdinal === null
				? null
				: (state.sourceIds.get(raw.sourceOrdinal) ??
					fail(`Scope ${raw.scopeOrdinal} references absent source ordinal ${raw.sourceOrdinal}.`));
		const id = semanticScopeId({
			domain: raw.domain,
			end: raw.end,
			kind: raw.kind,
			ownerKind: raw.ownerKind,
			programId: state.programId,
			sourceId,
			start: raw.start
		});
		if (scopeIds.has(id))
			fail(`Project ${state.raw.project.configPath} contains duplicate scope identity ${id}.`);
		scopeIds.add(id);
		state.scopeIds.set(raw.scopeOrdinal, id);
	}
}

function scopeOwnerNodeId(
	state: ProjectState,
	raw: RawSemanticScope
): SemanticAstNodeRecord['id'] | null {
	if (raw.ownerNodeOrdinal === null) return null;
	if (raw.sourceOrdinal === null)
		fail(`Scope ${raw.scopeOrdinal} has an owner node without a source.`);
	return (
		state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.ownerNodeOrdinal)) ??
		fail(`Scope ${raw.scopeOrdinal} references absent owner node ${raw.ownerNodeOrdinal}.`)
	);
}

function collectScopes(
	context: NormalizationContext,
	state: ProjectState,
	scopes: SemanticScopeRecord[]
): void {
	const limitations = symbolLimitations(state, context.multiProgram);
	for (const raw of state.raw.scopes) {
		const sourceId =
			raw.sourceOrdinal === null
				? null
				: (state.sourceIds.get(raw.sourceOrdinal) ??
					fail(`Scope ${raw.scopeOrdinal} lacks a source identity.`));
		const ownerNodeId = scopeOwnerNodeId(state, raw);
		scopes.push({
			domain: raw.domain,
			end: raw.end,
			id:
				state.scopeIds.get(raw.scopeOrdinal) ??
				fail(`Scope ${raw.scopeOrdinal} lacks an identity.`),
			kind: raw.kind,
			ownerKind: raw.ownerKind,
			ownerKindName: raw.ownerKindName,
			ownerNodeId,
			parentScopeId:
				raw.parentScopeOrdinal === null
					? null
					: (state.scopeIds.get(raw.parentScopeOrdinal) ??
						fail(
							`Scope ${raw.scopeOrdinal} references absent parent scope ${raw.parentScopeOrdinal}.`
						)),
			programId: state.programId,
			projectId: state.projectId,
			provenanceId: provenanceId(
				context,
				state,
				'TS_SYMBOL',
				limitations,
				sourceId,
				'SCOPE_DERIVED'
			),
			sourceId,
			start: raw.start
		});
	}
}

function buildScopes(context: NormalizationContext): SemanticScopeRecord[] {
	const scopes: SemanticScopeRecord[] = [];
	for (const state of context.states) {
		assignScopeIdentities(state);
		collectScopes(context, state, scopes);
	}
	scopes.sort((left, right) => compare(left.id, right.id));
	assertUnique(
		scopes.map((scope) => scope.id),
		'Scope identities'
	);
	return scopes;
}

interface SymbolFactRecords {
	readonly aliases: SemanticAliasRecord[];
	readonly declarations: SemanticDeclarationRecord[];
	readonly moduleExports: SemanticModuleExportRecord[];
	readonly moduleResolutions: SemanticModuleResolutionRecord[];
	readonly references: SemanticReferenceRecord[];
	readonly symbols: SemanticSymbolRecord[];
}

function assertDeclarationStateCoherence(raw: RawSemanticDeclaration): void {
	if ((raw.scopeLinkState === 'RESOLVED') !== (raw.declaringScopeOrdinal !== null))
		fail(`Declaration ${raw.declarationOrdinal} scope-link state is incoherent.`);
	if ((raw.symbolBindingState === 'RESOLVED') !== (raw.symbolOrdinal !== null))
		fail(`Declaration ${raw.declarationOrdinal} symbol-binding state is incoherent.`);
}

function assertDeclarationSpan(raw: RawSemanticDeclaration): void {
	if (
		!Number.isSafeInteger(raw.start) ||
		!Number.isSafeInteger(raw.end) ||
		raw.start < 0 ||
		raw.end < raw.start
	)
		fail(`Declaration ${raw.declarationOrdinal} has an invalid source span.`);
}

function assignDeclarationIdentities(state: ProjectState): void {
	const declarationIds = new Set<string>();
	for (const raw of state.raw.declarations) {
		assertDeclarationStateCoherence(raw);
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ??
			fail(
				`Declaration ${raw.declarationOrdinal} references absent source ordinal ${raw.sourceOrdinal}.`
			);
		const nodeId =
			raw.nodeOrdinal === null
				? null
				: (state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ??
					fail(
						`Declaration ${raw.declarationOrdinal} references absent node ordinal ${raw.nodeOrdinal}.`
					));
		assertDeclarationSpan(raw);
		const id = semanticDeclarationId({
			end: raw.end,
			kind: raw.kind,
			nodeId,
			sourceId,
			start: raw.start
		});
		if (declarationIds.has(id))
			fail(
				`Project ${state.raw.project.configPath} contains duplicate declaration identity ${id}.`
			);
		declarationIds.add(id);
		state.declarationIds.set(raw.declarationOrdinal, id);
	}
}

function symbolIdentityDeclarationIds(
	state: ProjectState,
	raw: RawSemanticSymbol,
	rawDeclarationByOrdinal: ReadonlyMap<number, RawSemanticDeclaration>
): SemanticDeclarationRecord['id'][] {
	return raw.declarationOrdinals
		.map((ordinal) => {
			const declaration =
				rawDeclarationByOrdinal.get(ordinal) ??
				fail(`Symbol ${raw.symbolOrdinal} references absent declaration ordinal ${ordinal}.`);
			if (declaration.symbolOrdinal !== raw.symbolOrdinal)
				fail(`Declaration ${ordinal} is attributed to a different symbol ordinal.`);
			return state.declarationIds.get(ordinal) ?? fail(`Declaration ${ordinal} lacks an identity.`);
		})
		.sort(compare);
}

function symbolIdentityFallbackNodeIds(
	state: ProjectState,
	raw: RawSemanticSymbol
): SemanticAstNodeRecord['id'][] {
	return raw.fallbackReferenceNodes
		.map(
			(entry) =>
				state.nodeIds.get(nodeKey(entry.sourceOrdinal, entry.nodeOrdinal)) ??
				fail(`Symbol ${raw.symbolOrdinal} references absent fallback node ${entry.nodeOrdinal}.`)
		)
		.sort(compare);
}

function assignSymbolIdentities(
	state: ProjectState,
	rawDeclarationByOrdinal: ReadonlyMap<number, RawSemanticDeclaration>
): void {
	const symbolIds = new Set<string>();
	for (const raw of state.raw.symbols) {
		assertUnique(
			raw.declarationOrdinals.map(String),
			`Symbol ${raw.symbolOrdinal} declaration ordinals`
		);
		assertUnique(
			raw.fallbackReferenceNodes.map((entry) => nodeKey(entry.sourceOrdinal, entry.nodeOrdinal)),
			`Symbol ${raw.symbolOrdinal} fallback reference nodes`
		);
		const declarationIdsForSymbol = symbolIdentityDeclarationIds(
			state,
			raw,
			rawDeclarationByOrdinal
		);
		const fallbackReferenceNodeIds = symbolIdentityFallbackNodeIds(state, raw);
		if (declarationIdsForSymbol.length === 0 && fallbackReferenceNodeIds.length === 0)
			fail(`Symbol ${raw.symbolOrdinal} has neither declarations nor a stable reference fallback.`);
		if (declarationIdsForSymbol.length > 0 && fallbackReferenceNodeIds.length > 0)
			fail(`Symbol ${raw.symbolOrdinal} mixes declaration and fallback identity bases.`);
		const identityBasis =
			declarationIdsForSymbol.length > 0
				? ('DECLARATIONS' as const)
				: ('REFERENCE_FALLBACK' as const);
		const id = semanticSymbolId({
			declarationIds: declarationIdsForSymbol,
			fallbackReferenceNodeIds,
			flags: raw.flags,
			identityBasis,
			name: raw.name,
			programId: state.programId,
			projectId: state.projectId
		});
		if (symbolIds.has(id))
			fail(`Project ${state.raw.project.configPath} contains duplicate symbol identity ${id}.`);
		symbolIds.add(id);
		state.symbolIds.set(raw.symbolOrdinal, id);
	}
}

function assertDeclarationSymbolBacklinks(
	state: ProjectState,
	rawSymbolByOrdinal: ReadonlyMap<number, RawSemanticSymbol>
): void {
	for (const raw of state.raw.declarations) {
		if (raw.symbolOrdinal === null) continue;
		const owner =
			rawSymbolByOrdinal.get(raw.symbolOrdinal) ??
			fail(
				`Declaration ${raw.declarationOrdinal} references absent symbol ordinal ${raw.symbolOrdinal}.`
			);
		if (!owner.declarationOrdinals.includes(raw.declarationOrdinal))
			fail(`Symbol ${raw.symbolOrdinal} does not include declaration ${raw.declarationOrdinal}.`);
	}
}

function symbolMergeState(declarationCount: number): SemanticSymbolRecord['mergeState'] {
	if (declarationCount === 0) return 'DECLARATIONLESS';
	if (declarationCount === 1) return 'SINGLE';
	return 'MERGED';
}

function collectSymbols(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	symbols: SemanticSymbolRecord[]
): void {
	for (const raw of state.raw.symbols) {
		const id =
			state.symbolIds.get(raw.symbolOrdinal) ??
			fail(`Symbol ${raw.symbolOrdinal} lacks an identity.`);
		const declarationIdsForSymbol = raw.declarationOrdinals
			.map(
				(ordinal) =>
					state.declarationIds.get(ordinal) ??
					fail(`Symbol declaration ${ordinal} lacks an identity.`)
			)
			.sort(compare);
		const fallbackReferenceNodeIds = raw.fallbackReferenceNodes
			.map(
				(entry) =>
					state.nodeIds.get(nodeKey(entry.sourceOrdinal, entry.nodeOrdinal)) ??
					fail(`Symbol fallback node ${entry.nodeOrdinal} lacks an identity.`)
			)
			.sort(compare);
		const valueDeclarationId =
			raw.valueDeclarationOrdinal === null
				? null
				: (state.declarationIds.get(raw.valueDeclarationOrdinal) ??
					fail(
						`Symbol ${raw.symbolOrdinal} references absent value declaration ${raw.valueDeclarationOrdinal}.`
					));
		if (valueDeclarationId !== null && !declarationIdsForSymbol.includes(valueDeclarationId))
			fail(`Symbol ${raw.symbolOrdinal} value declaration is not one of its declarations.`);
		symbols.push({
			declarationIds: declarationIdsForSymbol,
			fallbackReferenceNodeIds,
			flags: raw.flags,
			flagNames: sortedUnique(raw.flagNames),
			id,
			identityBasis: declarationIdsForSymbol.length > 0 ? 'DECLARATIONS' : 'REFERENCE_FALLBACK',
			mergeState: symbolMergeState(declarationIdsForSymbol.length),
			name: raw.name,
			programId: state.programId,
			projectId: state.projectId,
			provenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations),
			valueDeclarationId
		});
	}
}

function declarationScopeId(
	state: ProjectState,
	raw: RawSemanticDeclaration
): SemanticScopeRecord['id'] | null {
	if (raw.declaringScopeOrdinal === null) return null;
	return (
		state.scopeIds.get(raw.declaringScopeOrdinal) ??
		fail(
			`Declaration ${raw.declarationOrdinal} references absent scope ${raw.declaringScopeOrdinal}.`
		)
	);
}

function declarationSymbolId(
	state: ProjectState,
	raw: RawSemanticDeclaration
): SemanticSymbolRecord['id'] | null {
	if (raw.symbolOrdinal === null) return null;
	return (
		state.symbolIds.get(raw.symbolOrdinal) ??
		fail(`Declaration ${raw.declarationOrdinal} lacks a symbol identity.`)
	);
}

function collectDeclarations(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	rawSourceByOrdinal: ReadonlyMap<number, RawSemanticSource>,
	declarations: SemanticDeclarationRecord[]
): void {
	for (const raw of state.raw.declarations) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ??
			fail(`Declaration ${raw.declarationOrdinal} lacks a source identity.`);
		const rawSource =
			rawSourceByOrdinal.get(raw.sourceOrdinal) ??
			fail(`Declaration ${raw.declarationOrdinal} lacks raw source coordinates.`);
		const nodeId =
			raw.nodeOrdinal === null
				? null
				: (state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ??
					fail(`Declaration ${raw.declarationOrdinal} lacks a node identity.`));
		const candidateId =
			raw.candidateNodeOrdinal === null
				? null
				: (state.candidateIds.get(nodeKey(raw.sourceOrdinal, raw.candidateNodeOrdinal)) ??
					fail(
						`Declaration ${raw.declarationOrdinal} references absent candidate node ${raw.candidateNodeOrdinal}.`
					));
		declarations.push({
			ambient: raw.ambient,
			bindingProvenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations, sourceId),
			candidateId,
			declaringScopeId: declarationScopeId(state, raw),
			durableId: semanticDurableDeclarationId({
				ambient: raw.ambient,
				contentSha256: rawSource.contentSha256,
				declarationFile: rawSource.declarationFile,
				end: raw.end,
				kind: raw.kind,
				languageVariant: rawSource.languageVariant,
				logicalPath: rawSource.logicalPath,
				name: raw.name,
				nameState: raw.nameState,
				scriptKind: rawSource.scriptKind,
				start: raw.start,
				typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
			}),
			end: raw.end,
			id:
				state.declarationIds.get(raw.declarationOrdinal) ??
				fail(`Declaration ${raw.declarationOrdinal} lacks an identity.`),
			kind: raw.kind,
			kindName: raw.kindName,
			name: raw.name,
			nameState: raw.nameState,
			nodeId,
			structuralProvenanceId: provenanceId(
				context,
				state,
				'TS_SYMBOL',
				limitations,
				sourceId,
				'SCOPE_DERIVED'
			),
			sourceId,
			scopeLinkState: raw.scopeLinkState,
			start: raw.start,
			symbolBindingState: raw.symbolBindingState,
			symbolId: declarationSymbolId(state, raw)
		});
	}
}

function collectAliases(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	aliases: SemanticAliasRecord[]
): void {
	assertUnique(
		state.raw.aliases.map((record) => String(record.aliasSymbolOrdinal)),
		`Project ${state.raw.project.configPath} alias symbol ordinals`
	);
	for (const raw of state.raw.aliases) {
		const aliasSymbolId =
			state.symbolIds.get(raw.aliasSymbolOrdinal) ??
			fail(`Alias references absent symbol ordinal ${raw.aliasSymbolOrdinal}.`);
		const targetSymbolId =
			raw.targetSymbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.targetSymbolOrdinal) ??
					fail(
						`Alias ${raw.aliasSymbolOrdinal} references absent target symbol ${raw.targetSymbolOrdinal}.`
					));
		const terminalSymbolId =
			raw.terminalSymbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.terminalSymbolOrdinal) ??
					fail(
						`Alias ${raw.aliasSymbolOrdinal} references absent terminal symbol ${raw.terminalSymbolOrdinal}.`
					));
		const id = semanticAliasId({
			aliasSymbolId,
			state: raw.state,
			targetSymbolId,
			terminalSymbolId
		});
		aliases.push({
			aliasSymbolId,
			id,
			provenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations),
			state: raw.state,
			targetSymbolId,
			terminalSymbolId
		});
	}
}

function referenceContainingScopeId(
	state: ProjectState,
	raw: RawSemanticReference
): SemanticScopeRecord['id'] | null {
	if (raw.containingScopeOrdinal === null) return null;
	return (
		state.scopeIds.get(raw.containingScopeOrdinal) ??
		fail(`Reference node ${raw.nodeOrdinal} references absent scope ${raw.containingScopeOrdinal}.`)
	);
}

function collectReferences(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	references: SemanticReferenceRecord[]
): void {
	for (const raw of state.raw.references) {
		if ((raw.scopeLinkState === 'RESOLVED') !== (raw.containingScopeOrdinal !== null))
			fail(`Reference node ${raw.nodeOrdinal} scope-link state is incoherent.`);
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ??
			fail(
				`Reference node ${raw.nodeOrdinal} references absent source ordinal ${raw.sourceOrdinal}.`
			);
		const nodeId =
			state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ??
			fail(`Reference references absent node ordinal ${raw.nodeOrdinal}.`);
		const symbolId =
			raw.symbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.symbolOrdinal) ??
					fail(`Reference node ${raw.nodeOrdinal} references absent symbol ${raw.symbolOrdinal}.`));
		const resolvedSymbolId =
			raw.resolvedSymbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.resolvedSymbolOrdinal) ??
					fail(
						`Reference node ${raw.nodeOrdinal} references absent resolved symbol ${raw.resolvedSymbolOrdinal}.`
					));
		const id = semanticReferenceId({
			nodeId,
			resolvedSymbolId,
			resolutionState: raw.resolutionState,
			role: raw.role,
			symbolId
		});
		references.push({
			containingScopeId: referenceContainingScopeId(state, raw),
			id,
			nodeId,
			resolutionProvenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations, sourceId),
			resolvedSymbolId,
			resolutionState: raw.resolutionState,
			role: raw.role,
			scopeLinkState: raw.scopeLinkState,
			sourceId,
			structuralProvenanceId: provenanceId(
				context,
				state,
				'TS_SYMBOL',
				limitations,
				sourceId,
				'SCOPE_DERIVED'
			),
			symbolId
		});
	}
}

function collectModuleResolutions(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	moduleResolutions: SemanticModuleResolutionRecord[]
): void {
	for (const raw of state.raw.moduleResolutions) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ??
			fail(`Module occurrence references absent source ordinal ${raw.sourceOrdinal}.`);
		const nodeId =
			state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.nodeOrdinal)) ??
			fail(`Module occurrence references absent node ordinal ${raw.nodeOrdinal}.`);
		const moduleSymbolId =
			raw.moduleSymbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.moduleSymbolOrdinal) ??
					fail(`Module occurrence references absent symbol ${raw.moduleSymbolOrdinal}.`));
		const targetSourceId =
			raw.targetSourceOrdinal === null
				? null
				: (state.sourceIds.get(raw.targetSourceOrdinal) ??
					fail(`Module occurrence references absent target source ${raw.targetSourceOrdinal}.`));
		const id = semanticModuleResolutionId({
			moduleSymbolId,
			nodeId,
			occurrenceKind: raw.occurrenceKind,
			resolutionState: raw.resolutionState,
			specifier: raw.specifier,
			specifierState: raw.specifierState,
			targetSourceId,
			typeOnly: raw.typeOnly
		});
		moduleResolutions.push({
			id,
			moduleSymbolId,
			nodeId,
			occurrenceKind: raw.occurrenceKind,
			provenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations, sourceId),
			resolutionState: raw.resolutionState,
			sourceId,
			specifier: raw.specifier,
			specifierState: raw.specifierState,
			targetSourceId,
			typeOnly: raw.typeOnly
		});
	}
}

function collectModuleExports(
	context: NormalizationContext,
	state: ProjectState,
	limitations: readonly SemanticLimitation[],
	moduleExports: SemanticModuleExportRecord[]
): void {
	for (const raw of state.raw.moduleExports) {
		const sourceId =
			state.sourceIds.get(raw.sourceOrdinal) ??
			fail(`Module export references absent source ordinal ${raw.sourceOrdinal}.`);
		const symbolId =
			state.symbolIds.get(raw.symbolOrdinal) ??
			fail(`Module export ${raw.exportName} references absent symbol ${raw.symbolOrdinal}.`);
		const targetSymbolId =
			raw.targetSymbolOrdinal === null
				? null
				: (state.symbolIds.get(raw.targetSymbolOrdinal) ??
					fail(
						`Module export ${raw.exportName} references absent target symbol ${raw.targetSymbolOrdinal}.`
					));
		const id = semanticModuleExportId({
			exportName: raw.exportName,
			sourceId,
			state: raw.state,
			symbolId,
			targetSymbolId
		});
		moduleExports.push({
			exportName: raw.exportName,
			id,
			provenanceId: provenanceId(context, state, 'TS_SYMBOL', limitations, sourceId),
			sourceId,
			state: raw.state,
			symbolId,
			targetSymbolId
		});
	}
}

function collectProjectSymbolFacts(
	context: NormalizationContext,
	state: ProjectState,
	records: SymbolFactRecords
): void {
	assertUnique(
		state.raw.declarations.map((record) => String(record.declarationOrdinal)),
		`Project ${state.raw.project.configPath} declaration ordinals`
	);
	const rawDeclarationByOrdinal = new Map(
		state.raw.declarations.map((record) => [record.declarationOrdinal, record] as const)
	);
	const rawSourceByOrdinal = new Map(
		state.raw.sources.map((source) => [source.sourceOrdinal, source] as const)
	);
	assignDeclarationIdentities(state);
	assertUnique(
		state.raw.symbols.map((record) => String(record.symbolOrdinal)),
		`Project ${state.raw.project.configPath} symbol ordinals`
	);
	const rawSymbolByOrdinal = new Map(
		state.raw.symbols.map((record) => [record.symbolOrdinal, record] as const)
	);
	assignSymbolIdentities(state, rawDeclarationByOrdinal);
	assertDeclarationSymbolBacklinks(state, rawSymbolByOrdinal);
	const tsSymbolLimitations = symbolLimitations(state, context.multiProgram);
	collectSymbols(context, state, tsSymbolLimitations, records.symbols);
	collectDeclarations(
		context,
		state,
		tsSymbolLimitations,
		rawSourceByOrdinal,
		records.declarations
	);
	collectAliases(context, state, tsSymbolLimitations, records.aliases);
	collectReferences(context, state, tsSymbolLimitations, records.references);
	collectModuleResolutions(context, state, tsSymbolLimitations, records.moduleResolutions);
	collectModuleExports(context, state, tsSymbolLimitations, records.moduleExports);
}

function buildSymbolFacts(context: NormalizationContext): SymbolFactRecords {
	const records: SymbolFactRecords = {
		aliases: [],
		declarations: [],
		moduleExports: [],
		moduleResolutions: [],
		references: [],
		symbols: []
	};
	for (const state of context.states) collectProjectSymbolFacts(context, state, records);
	records.declarations.sort((left, right) => compare(left.id, right.id));
	records.symbols.sort((left, right) => compare(left.id, right.id));
	records.aliases.sort((left, right) => compare(left.id, right.id));
	records.references.sort((left, right) => compare(left.id, right.id));
	records.moduleResolutions.sort((left, right) => compare(left.id, right.id));
	records.moduleExports.sort((left, right) => compare(left.id, right.id));
	assertUnique(
		records.declarations.map((record) => record.id),
		'Declaration identities'
	);
	assertUnique(
		records.symbols.map((record) => record.id),
		'Symbol identities'
	);
	assertUnique(
		records.aliases.map((record) => record.id),
		'Alias identities'
	);
	assertUnique(
		records.references.map((record) => record.id),
		'Reference identities'
	);
	assertUnique(
		records.moduleResolutions.map((record) => record.id),
		'Module-resolution identities'
	);
	assertUnique(
		records.moduleExports.map((record) => record.id),
		'Module-export identities'
	);
	return records;
}

interface TypeFactRecords {
	readonly overloadSets: SemanticOverloadSetRecord[];
	readonly signatureParameters: SemanticSignatureParameterRecord[];
	readonly signatures: SemanticSignatureRecord[];
	readonly typeParameters: SemanticTypeParameterRecord[];
	readonly typeRelations: SemanticTypeRelationRecord[];
	readonly types: SemanticTypeRecord[];
}

interface TypeFactContext {
	readonly declarationId: (ordinal: number) => SemanticDeclarationRecord['id'];
	readonly overloadSetId: (ordinal: number) => SemanticOverloadSetRecord['id'];
	readonly rawDeclarationByOrdinal: ReadonlyMap<number, RawSemanticDeclaration>;
	readonly rawOverloadSetByOrdinal: ReadonlyMap<number, RawSemanticOverloadSet>;
	readonly rawOverloadSets: readonly RawSemanticOverloadSet[];
	readonly rawSignatureByOrdinal: ReadonlyMap<number, RawSemanticSignature>;
	readonly rawSignatureParameters: readonly RawSemanticSignatureParameter[];
	readonly rawSignatures: readonly RawSemanticSignature[];
	readonly rawTypeByOrdinal: ReadonlyMap<number, RawSemanticType>;
	readonly rawTypeParameterByOrdinal: ReadonlyMap<number, RawSemanticTypeParameter>;
	readonly rawTypeParameters: readonly RawSemanticTypeParameter[];
	readonly rawTypeRelations: readonly RawSemanticTypeRelation[];
	readonly rawTypes: readonly RawSemanticType[];
	readonly requestedAssignabilityIds: readonly string[];
	readonly signatureId: (ordinal: number) => SemanticSignatureRecord['id'];
	readonly signatureParameterId: (ordinal: number) => SemanticSignatureParameterRecord['id'];
	readonly state: ProjectState;
	readonly symbolId: (ordinal: number) => SemanticSymbolRecord['id'];
	readonly typeId: (ordinal: number) => SemanticTypeRecord['id'];
	readonly typeParameterId: (ordinal: number) => SemanticTypeParameterRecord['id'];
	readonly typeProvenanceId: () => SemanticProvenanceId;
}

interface TypeRelationCommon {
	readonly programId: SemanticProgramRecord['id'];
	readonly projectId: SemanticProjectRecord['id'];
	readonly state: RawSemanticTypeRelation['state'];
}

function assertTypeFactOrdinals(state: ProjectState): void {
	assertCanonicalOrdinals(
		state.raw.types.map((record) => record.typeOrdinal),
		`Project ${state.raw.project.configPath} type ordinals`
	);
	assertCanonicalOrdinals(
		state.raw.signatures.map((record) => record.signatureOrdinal),
		`Project ${state.raw.project.configPath} signature ordinals`
	);
	assertCanonicalOrdinals(
		state.raw.typeParameters.map((record) => record.typeParameterOrdinal),
		`Project ${state.raw.project.configPath} type-parameter ordinals`
	);
	assertCanonicalOrdinals(
		state.raw.signatureParameters.map((record) => record.signatureParameterOrdinal),
		`Project ${state.raw.project.configPath} signature-parameter ordinals`
	);
	assertCanonicalOrdinals(
		state.raw.overloadSets.map((record) => record.overloadSetOrdinal),
		`Project ${state.raw.project.configPath} overload-set ordinals`
	);
	assertCanonicalOrdinals(
		state.raw.typeRelations.map((record) => record.relationOrdinal),
		`Project ${state.raw.project.configPath} type-relation ordinals`
	);
}

function createTypeFactContext(
	context: NormalizationContext,
	state: ProjectState
): TypeFactContext {
	const rawTypes = [...state.raw.types].sort((left, right) => left.typeOrdinal - right.typeOrdinal);
	const rawSignatures = [...state.raw.signatures].sort(
		(left, right) => left.signatureOrdinal - right.signatureOrdinal
	);
	const rawTypeParameters = [...state.raw.typeParameters].sort(
		(left, right) => left.typeParameterOrdinal - right.typeParameterOrdinal
	);
	const rawSignatureParameters = [...state.raw.signatureParameters].sort(
		(left, right) => left.signatureParameterOrdinal - right.signatureParameterOrdinal
	);
	const rawOverloadSets = [...state.raw.overloadSets].sort(
		(left, right) => left.overloadSetOrdinal - right.overloadSetOrdinal
	);
	const rawTypeRelations = [...state.raw.typeRelations].sort(
		(left, right) => left.relationOrdinal - right.relationOrdinal
	);
	const tsTypeLimitations = typeLimitations(state, context.multiProgram);
	return {
		declarationId: (ordinal) =>
			state.declarationIds.get(ordinal) ??
			fail(`Type fact references absent declaration ${ordinal}.`),
		overloadSetId: (ordinal) =>
			state.overloadSetIds.get(ordinal) ??
			fail(`Type fact references absent overload set ${ordinal}.`),
		rawDeclarationByOrdinal: new Map(
			state.raw.declarations.map((record) => [record.declarationOrdinal, record] as const)
		),
		rawOverloadSetByOrdinal: new Map(
			rawOverloadSets.map((record) => [record.overloadSetOrdinal, record] as const)
		),
		rawOverloadSets,
		rawSignatureByOrdinal: new Map(
			rawSignatures.map((record) => [record.signatureOrdinal, record] as const)
		),
		rawSignatureParameters,
		rawSignatures,
		rawTypeByOrdinal: new Map(rawTypes.map((record) => [record.typeOrdinal, record] as const)),
		rawTypeParameterByOrdinal: new Map(
			rawTypeParameters.map((record) => [record.typeParameterOrdinal, record] as const)
		),
		rawTypeParameters,
		rawTypeRelations,
		rawTypes,
		requestedAssignabilityIds: context.requestedAssignabilityIds,
		signatureId: (ordinal) =>
			state.signatureIds.get(ordinal) ?? fail(`Type fact references absent Signature ${ordinal}.`),
		signatureParameterId: (ordinal) =>
			state.signatureParameterIds.get(ordinal) ??
			fail(`Type fact references absent Signature parameter ${ordinal}.`),
		state,
		symbolId: (ordinal) =>
			state.symbolIds.get(ordinal) ?? fail(`Type fact references absent symbol ${ordinal}.`),
		typeId: (ordinal) =>
			state.typeIds.get(ordinal) ?? fail(`Type fact references absent type ${ordinal}.`),
		typeParameterId: (ordinal) =>
			state.typeParameterIds.get(ordinal) ??
			fail(`Type fact references absent type parameter ${ordinal}.`),
		typeProvenanceId: () => provenanceId(context, state, 'TS_TYPE', tsTypeLimitations)
	};
}

function signatureOwnerRef(
	types: TypeFactContext,
	owner: RawSemanticSignatureOwner
): SemanticSignatureOwner {
	switch (owner.kind) {
		case 'TYPE':
			return { id: types.typeId(owner.typeOrdinal), kind: 'TYPE' };
		case 'SYMBOL':
			return { id: types.symbolId(owner.symbolOrdinal), kind: 'SYMBOL' };
		case 'DECLARATION':
			return { id: types.declarationId(owner.declarationOrdinal), kind: 'DECLARATION' };
		default:
			return assertNever(owner, 'Signature owner');
	}
}

function typeParameterOwnerRef(
	types: TypeFactContext,
	owner: RawSemanticTypeParameterOwner
): SemanticTypeParameterOwner {
	switch (owner.kind) {
		case 'TYPE':
			return { id: types.typeId(owner.typeOrdinal), kind: 'TYPE' };
		case 'SIGNATURE':
			return { id: types.signatureId(owner.signatureOrdinal), kind: 'SIGNATURE' };
		case 'DECLARATION':
			return { id: types.declarationId(owner.declarationOrdinal), kind: 'DECLARATION' };
		default:
			return assertNever(owner, 'Type-parameter owner');
	}
}

function assertRawTypeCoherence(raw: RawSemanticType): void {
	if (raw.displayProfile !== SEMANTIC_TYPE_DISPLAY_PROFILE)
		fail(`Type ${raw.typeOrdinal} has an unsupported display profile.`);
	if (raw.fingerprintProfile !== SEMANTIC_TYPE_FINGERPRINT_PROFILE)
		fail(`Type ${raw.typeOrdinal} has an unsupported fingerprint profile.`);
	assertSha256(raw.displaySha256, `Type ${raw.typeOrdinal} display digest`);
	assertSha256(raw.fingerprintSha256, `Type ${raw.typeOrdinal} fingerprint digest`);
	if (raw.displaySha256 !== sha256(raw.display))
		fail(`Type ${raw.typeOrdinal} display digest is incoherent.`);
	if (!Number.isSafeInteger(raw.flags) || raw.flags < 0)
		fail(`Type ${raw.typeOrdinal} flags are invalid.`);
	if (raw.objectFlags !== null && (!Number.isSafeInteger(raw.objectFlags) || raw.objectFlags < 0))
		fail(`Type ${raw.typeOrdinal} object flags are invalid.`);
	if ((raw.structureState === 'COMPLETE') !== (raw.unsupportedStructureKinds.length === 0))
		fail(`Type ${raw.typeOrdinal} structure state is incoherent.`);
}

function assignTypeIdentities(types: TypeFactContext): void {
	const typeIdentitySet = new Set<string>();
	for (const raw of types.rawTypes) {
		assertRawTypeCoherence(raw);
		const id = semanticTypeId({
			fingerprintProfile: raw.fingerprintProfile,
			fingerprintSha256: raw.fingerprintSha256,
			identityBasis: raw.identityBasis,
			programId: types.state.programId
		});
		if (typeIdentitySet.has(id))
			fail(`Project ${types.state.raw.project.configPath} contains duplicate type identity ${id}.`);
		typeIdentitySet.add(id);
		types.state.typeIds.set(raw.typeOrdinal, id);
	}
}

function assertSignatureProviderOrdinal(raw: RawSemanticSignature): void {
	if (raw.identityBasis === 'DECLARATION_ANCHORED' && raw.declarationOrdinal === null)
		fail(`Signature ${raw.signatureOrdinal} identity basis is incoherent.`);
	if (
		raw.identityBasis === 'OWNER_ORDINAL' &&
		(raw.providerOrdinal === null ||
			!Number.isSafeInteger(raw.providerOrdinal) ||
			raw.providerOrdinal < 0)
	)
		fail(`Signature ${raw.signatureOrdinal} lacks a valid provider ordinal.`);
	if (
		raw.providerOrdinal !== null &&
		(!Number.isSafeInteger(raw.providerOrdinal) || raw.providerOrdinal < 0)
	)
		fail(`Signature ${raw.signatureOrdinal} provider ordinal is invalid.`);
}

function assertSignatureOwnerCoherence(types: TypeFactContext, raw: RawSemanticSignature): void {
	if (raw.owner.kind === 'DECLARATION') {
		if (raw.declarationOrdinal !== raw.owner.declarationOrdinal)
			fail(`Signature ${raw.signatureOrdinal} declaration owner is incoherent.`);
	} else if (raw.owner.kind === 'SYMBOL' && raw.declarationOrdinal !== null) {
		const declaration =
			types.rawDeclarationByOrdinal.get(raw.declarationOrdinal) ??
			fail(`Signature ${raw.signatureOrdinal} references an absent declaration.`);
		if (declaration.symbolOrdinal !== raw.owner.symbolOrdinal)
			fail(`Signature ${raw.signatureOrdinal} Symbol owner is incoherent.`);
	}
}

function assertSignatureRoleCoherence(raw: RawSemanticSignature): void {
	if (
		(raw.declarationRole === 'CONSTRUCT_SIGNATURE' && raw.signatureKind !== 'CONSTRUCT') ||
		(raw.declarationRole === 'CALL_SIGNATURE' && raw.signatureKind !== 'CALL')
	)
		fail(`Signature ${raw.signatureOrdinal} kind and declaration role differ.`);
	if (
		raw.semanticKind === 'OVERLOAD_SIGNATURE' &&
		!['OVERLOAD_DECLARATION', 'AMBIENT_OVERLOAD', 'CALL_SIGNATURE', 'CONSTRUCT_SIGNATURE'].includes(
			raw.declarationRole
		)
	)
		fail(`Signature ${raw.signatureOrdinal} lacks overload declaration evidence.`);
	if (
		['OVERLOAD_DECLARATION', 'AMBIENT_OVERLOAD'].includes(raw.declarationRole) &&
		raw.semanticKind !== 'OVERLOAD_SIGNATURE'
	)
		fail(`Signature ${raw.signatureOrdinal} overload role is incoherent.`);
	if (raw.semanticKind === 'IMPLEMENTATION_SIGNATURE' && raw.declarationRole !== 'DECLARATION')
		fail(`Signature ${raw.signatureOrdinal} lacks implementation declaration evidence.`);
}

function assertRawSignatureCoherence(types: TypeFactContext, raw: RawSemanticSignature): void {
	if (raw.fingerprintProfile !== SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE)
		fail(`Signature ${raw.signatureOrdinal} has an unsupported fingerprint profile.`);
	assertSha256(raw.displaySha256, `Signature ${raw.signatureOrdinal} display digest`);
	assertSha256(raw.fingerprintSha256, `Signature ${raw.signatureOrdinal} fingerprint digest`);
	if (raw.displaySha256 !== sha256(raw.display))
		fail(`Signature ${raw.signatureOrdinal} display digest is incoherent.`);
	assertSignatureProviderOrdinal(raw);
	assertSignatureOwnerCoherence(types, raw);
	assertSignatureRoleCoherence(raw);
}

function rawSignatureIdentity(
	types: TypeFactContext,
	raw: RawSemanticSignature
): SemanticSignatureRecord['id'] {
	const owner = signatureOwnerRef(types, raw.owner);
	const declaration =
		raw.declarationOrdinal === null ? null : types.declarationId(raw.declarationOrdinal);
	if (raw.identityBasis === 'DECLARATION_ANCHORED')
		return semanticSignatureId({
			declarationId: declaration!,
			identityBasis: 'DECLARATION_ANCHORED',
			programId: types.state.programId,
			semanticKind: raw.semanticKind,
			signatureKind: raw.signatureKind
		});
	return semanticSignatureId({
		fingerprintProfile: raw.fingerprintProfile,
		fingerprintSha256: raw.fingerprintSha256,
		identityBasis: 'OWNER_ORDINAL',
		owner,
		programId: types.state.programId,
		providerOrdinal: raw.providerOrdinal!,
		semanticKind: raw.semanticKind,
		signatureKind: raw.signatureKind
	});
}

function assignSignatureIdentities(types: TypeFactContext): void {
	const signatureIdentityEvidence = new Map<string, string>();
	for (const raw of types.rawSignatures) {
		assertRawSignatureCoherence(types, raw);
		const id = rawSignatureIdentity(types, raw);
		const identityEvidence = canonicalSemanticJson({
			declarationOrdinal: raw.declarationOrdinal,
			fingerprintSha256: raw.fingerprintSha256,
			identityBasis: raw.identityBasis,
			owner: raw.owner,
			providerOrdinal: raw.providerOrdinal,
			semanticKind: raw.semanticKind,
			signatureKind: raw.signatureKind,
			signatureOrdinal: raw.signatureOrdinal
		});
		const priorIdentityEvidence = signatureIdentityEvidence.get(id);
		if (priorIdentityEvidence !== undefined)
			fail(
				`Project ${types.state.raw.project.configPath} contains duplicate Signature identity ${id}: first ${priorIdentityEvidence}; duplicate ${identityEvidence}.`
			);
		signatureIdentityEvidence.set(id, identityEvidence);
		types.state.signatureIds.set(raw.signatureOrdinal, id);
	}
}

function assertTypeParameterCoherence(raw: RawSemanticTypeParameter): void {
	if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
		fail(`Type parameter ${raw.typeParameterOrdinal} has an invalid owner ordinal.`);
	if ((raw.constraintState === 'RESOLVED') !== (raw.constraintTypeOrdinal !== null))
		fail(`Type parameter ${raw.typeParameterOrdinal} constraint state is incoherent.`);
	if ((raw.defaultState === 'RESOLVED') !== (raw.defaultTypeOrdinal !== null))
		fail(`Type parameter ${raw.typeParameterOrdinal} default state is incoherent.`);
}

function assertTypeParameterDeclarationOwner(
	types: TypeFactContext,
	raw: RawSemanticTypeParameter,
	owner: Extract<RawSemanticTypeParameterOwner, { kind: 'DECLARATION' }>
): void {
	if (raw.declarationOrdinal === null)
		fail(`Type parameter ${raw.typeParameterOrdinal} lacks its parameter declaration.`);
	const ownerDeclaration =
		types.rawDeclarationByOrdinal.get(owner.declarationOrdinal) ??
		fail(`Type parameter ${raw.typeParameterOrdinal} references an absent owner declaration.`);
	const parameterDeclaration =
		types.rawDeclarationByOrdinal.get(raw.declarationOrdinal) ??
		fail(`Type parameter ${raw.typeParameterOrdinal} references an absent parameter declaration.`);
	if (
		ownerDeclaration.declarationOrdinal === parameterDeclaration.declarationOrdinal ||
		ownerDeclaration.sourceOrdinal !== parameterDeclaration.sourceOrdinal ||
		ownerDeclaration.start > parameterDeclaration.start ||
		ownerDeclaration.end < parameterDeclaration.end
	)
		fail(`Type parameter ${raw.typeParameterOrdinal} declaration owner is incoherent.`);
}

function assertTypeParameterTypeRefs(types: TypeFactContext, raw: RawSemanticTypeParameter): void {
	types.typeId(raw.parameterTypeOrdinal);
	if (raw.constraintTypeOrdinal !== null) types.typeId(raw.constraintTypeOrdinal);
	if (raw.defaultTypeOrdinal !== null) types.typeId(raw.defaultTypeOrdinal);
}

function assignTypeParameterIdentities(types: TypeFactContext): void {
	const typeParameterIdentitySet = new Set<string>();
	for (const raw of types.rawTypeParameters) {
		assertTypeParameterCoherence(raw);
		const owner = typeParameterOwnerRef(types, raw.owner);
		const declaration =
			raw.declarationOrdinal === null ? null : types.declarationId(raw.declarationOrdinal);
		if (raw.owner.kind === 'DECLARATION')
			assertTypeParameterDeclarationOwner(types, raw, raw.owner);
		assertTypeParameterTypeRefs(types, raw);
		const id = semanticTypeParameterId({
			declarationId: declaration,
			ordinal: raw.ordinal,
			owner
		});
		if (typeParameterIdentitySet.has(id))
			fail(
				`Project ${types.state.raw.project.configPath} contains duplicate type-parameter identity ${id}.`
			);
		typeParameterIdentitySet.add(id);
		types.state.typeParameterIds.set(raw.typeParameterOrdinal, id);
	}
}

function assignSignatureParameterIdentities(types: TypeFactContext): void {
	const signatureParameterIdentitySet = new Set<string>();
	for (const raw of types.rawSignatureParameters) {
		if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
			fail(`Signature parameter ${raw.signatureParameterOrdinal} has an invalid ordinal.`);
		const ownerId = types.signatureId(raw.signatureOrdinal);
		if (raw.declarationOrdinal !== null) types.declarationId(raw.declarationOrdinal);
		if (raw.symbolOrdinal !== null) types.symbolId(raw.symbolOrdinal);
		types.typeId(raw.typeOrdinal);
		const id = semanticSignatureParameterId({
			ordinal: raw.ordinal,
			role: raw.role,
			signatureId: ownerId
		});
		if (signatureParameterIdentitySet.has(id))
			fail(
				`Project ${types.state.raw.project.configPath} contains duplicate Signature-parameter identity ${id}.`
			);
		signatureParameterIdentitySet.add(id);
		types.state.signatureParameterIds.set(raw.signatureParameterOrdinal, id);
	}
}

function assignOverloadSetIdentities(types: TypeFactContext): void {
	const overloadSetIdentitySet = new Set<string>();
	for (const raw of types.rawOverloadSets) {
		const callableSymbolId = types.symbolId(raw.callableSymbolOrdinal);
		const id = semanticOverloadSetId({ callableSymbolId, programId: types.state.programId });
		if (overloadSetIdentitySet.has(id))
			fail(
				`Project ${types.state.raw.project.configPath} contains duplicate overload-set identity ${id}.`
			);
		overloadSetIdentitySet.add(id);
		types.state.overloadSetIds.set(raw.overloadSetOrdinal, id);
	}
}

function typeAcquisitionAnchorRef(
	types: TypeFactContext,
	anchor: RawSemanticTypeAcquisitionAnchor
): SemanticTypeAcquisitionAnchor {
	switch (anchor.kind) {
		case 'NODE':
			return {
				kind: 'NODE',
				nodeId:
					types.state.nodeIds.get(nodeKey(anchor.sourceOrdinal, anchor.nodeOrdinal)) ??
					fail(`Type anchor references absent node ${anchor.nodeOrdinal}.`),
				queryMode: anchor.queryMode
			};
		case 'DECLARATION':
			return {
				declarationId: types.declarationId(anchor.declarationOrdinal),
				kind: 'DECLARATION',
				queryMode: anchor.queryMode
			};
		case 'SYMBOL':
			return {
				kind: 'SYMBOL',
				queryMode: anchor.queryMode,
				symbolId: types.symbolId(anchor.symbolOrdinal)
			};
		case 'TYPE_COMPONENT':
			if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
				fail('Type component anchor has an invalid ordinal.');
			return {
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: 'TYPE_COMPONENT',
				parentTypeId: types.typeId(anchor.parentTypeOrdinal)
			};
		case 'SIGNATURE_COMPONENT':
			if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
				fail('Signature component anchor has an invalid ordinal.');
			return {
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: 'SIGNATURE_COMPONENT',
				signatureId: types.signatureId(anchor.signatureOrdinal)
			};
		default:
			return assertNever(anchor, 'Type acquisition anchor');
	}
}

function collectTypes(types: TypeFactContext, records: SemanticTypeRecord[]): void {
	for (const raw of types.rawTypes) {
		const acquisitionAnchors = raw.acquisitionAnchors
			.map((anchor) => typeAcquisitionAnchorRef(types, anchor))
			.sort((left, right) => compare(canonicalKey(left), canonicalKey(right)));
		if (acquisitionAnchors.length === 0)
			fail(`Type ${raw.typeOrdinal} lacks an acquisition anchor.`);
		assertUnique(
			acquisitionAnchors.map(canonicalKey),
			`Type ${raw.typeOrdinal} acquisition anchors`
		);
		records.push({
			acquisitionAnchors,
			aliasSymbolId:
				raw.aliasSymbolOrdinal === null ? null : types.symbolId(raw.aliasSymbolOrdinal),
			category: raw.category,
			display: raw.display,
			displayProfile: raw.displayProfile,
			displaySha256: raw.displaySha256,
			fingerprintProfile: raw.fingerprintProfile,
			fingerprintSha256: raw.fingerprintSha256,
			flagNames: sortedUnique(raw.flagNames),
			flags: raw.flags,
			id: types.typeId(raw.typeOrdinal),
			identityBasis: raw.identityBasis,
			objectFlagNames: sortedUnique(raw.objectFlagNames),
			objectFlags: raw.objectFlags,
			programId: types.state.programId,
			projectId: types.state.projectId,
			provenanceId: types.typeProvenanceId(),
			structureState: raw.structureState,
			symbolId: raw.symbolOrdinal === null ? null : types.symbolId(raw.symbolOrdinal),
			unsupportedStructureKinds: sortedUnique(raw.unsupportedStructureKinds)
		});
	}
}

function collectTypeParameters(
	types: TypeFactContext,
	records: SemanticTypeParameterRecord[]
): void {
	for (const raw of types.rawTypeParameters)
		records.push({
			constraintState: raw.constraintState,
			constraintTypeId:
				raw.constraintTypeOrdinal === null ? null : types.typeId(raw.constraintTypeOrdinal),
			declarationId:
				raw.declarationOrdinal === null ? null : types.declarationId(raw.declarationOrdinal),
			defaultState: raw.defaultState,
			defaultTypeId: raw.defaultTypeOrdinal === null ? null : types.typeId(raw.defaultTypeOrdinal),
			id: types.typeParameterId(raw.typeParameterOrdinal),
			name: raw.name,
			ordinal: raw.ordinal,
			owner: typeParameterOwnerRef(types, raw.owner),
			parameterTypeId: types.typeId(raw.parameterTypeOrdinal),
			programId: types.state.programId,
			projectId: types.state.projectId,
			provenanceId: types.typeProvenanceId()
		});
}

function collectSignatureParameters(
	types: TypeFactContext,
	records: SemanticSignatureParameterRecord[]
): void {
	for (const raw of types.rawSignatureParameters)
		records.push({
			declarationId:
				raw.declarationOrdinal === null ? null : types.declarationId(raw.declarationOrdinal),
			id: types.signatureParameterId(raw.signatureParameterOrdinal),
			name: raw.name,
			optional: raw.optional,
			ordinal: raw.ordinal,
			provenanceId: types.typeProvenanceId(),
			rest: raw.rest,
			role: raw.role,
			signatureId: types.signatureId(raw.signatureOrdinal),
			symbolId: raw.symbolOrdinal === null ? null : types.symbolId(raw.symbolOrdinal),
			typeId: types.typeId(raw.typeOrdinal)
		});
}

function collectSignatures(types: TypeFactContext, records: SemanticSignatureRecord[]): void {
	for (const raw of types.rawSignatures) {
		assertUnique(
			raw.parameterOrdinals.map(String),
			`Signature ${raw.signatureOrdinal} parameter ordinals`
		);
		assertUnique(
			raw.typeParameterOrdinals.map(String),
			`Signature ${raw.signatureOrdinal} type-parameter ordinals`
		);
		const expectedParameterOrdinals = types.rawSignatureParameters
			.filter((parameter) => parameter.signatureOrdinal === raw.signatureOrdinal)
			.sort((left, right) => left.ordinal - right.ordinal)
			.map((parameter) => parameter.signatureParameterOrdinal);
		const expectedTypeParameterOrdinals = types.rawTypeParameters
			.filter(
				(parameter) =>
					parameter.owner.kind === 'SIGNATURE' &&
					parameter.owner.signatureOrdinal === raw.signatureOrdinal
			)
			.sort((left, right) => left.ordinal - right.ordinal)
			.map((parameter) => parameter.typeParameterOrdinal);
		if (canonicalKey(raw.parameterOrdinals) !== canonicalKey(expectedParameterOrdinals))
			fail(`Signature ${raw.signatureOrdinal} parameter membership is incoherent.`);
		if (canonicalKey(raw.typeParameterOrdinals) !== canonicalKey(expectedTypeParameterOrdinals))
			fail(`Signature ${raw.signatureOrdinal} type-parameter membership is incoherent.`);
		records.push({
			declarationId:
				raw.declarationOrdinal === null ? null : types.declarationId(raw.declarationOrdinal),
			declarationRole: raw.declarationRole,
			display: raw.display,
			displaySha256: raw.displaySha256,
			fingerprintProfile: raw.fingerprintProfile,
			fingerprintSha256: raw.fingerprintSha256,
			id: types.signatureId(raw.signatureOrdinal),
			identityBasis: raw.identityBasis,
			owner: signatureOwnerRef(types, raw.owner),
			parameterIds: raw.parameterOrdinals.map(types.signatureParameterId),
			programId: types.state.programId,
			projectId: types.state.projectId,
			provenanceId: types.typeProvenanceId(),
			providerOrdinal: raw.providerOrdinal,
			returnTypeId: types.typeId(raw.returnTypeOrdinal),
			semanticKind: raw.semanticKind,
			signatureKind: raw.signatureKind,
			typeParameterIds: raw.typeParameterOrdinals.map(types.typeParameterId)
		});
	}
}

function collectOverloadSets(types: TypeFactContext, records: SemanticOverloadSetRecord[]): void {
	for (const raw of types.rawOverloadSets)
		records.push({
			callableSymbolId: types.symbolId(raw.callableSymbolOrdinal),
			id: types.overloadSetId(raw.overloadSetOrdinal),
			programId: types.state.programId,
			projectId: types.state.projectId,
			provenanceId: types.typeProvenanceId()
		});
}

function typeSubjectRef(
	types: TypeFactContext,
	subject: RawSemanticTypeSubjectRef
): SemanticTypeSubjectRef {
	switch (subject.kind) {
		case 'AST_NODE':
			return {
				id:
					types.state.nodeIds.get(nodeKey(subject.sourceOrdinal, subject.nodeOrdinal)) ??
					fail(`Type-of relation references absent node ${subject.nodeOrdinal}.`),
				kind: 'AST_NODE'
			};
		case 'DECLARATION':
			return { id: types.declarationId(subject.declarationOrdinal), kind: 'DECLARATION' };
		case 'SYMBOL':
			return { id: types.symbolId(subject.symbolOrdinal), kind: 'SYMBOL' };
		default:
			return assertNever(subject, 'Type-of subject');
	}
}

function typeOrSignatureRef(
	types: TypeFactContext,
	ref: RawSemanticTypeOrSignatureRef
): SemanticTypeOrSignatureRef {
	switch (ref.kind) {
		case 'TYPE':
			return { id: types.typeId(ref.typeOrdinal), kind: 'TYPE' };
		case 'SIGNATURE':
			return { id: types.signatureId(ref.signatureOrdinal), kind: 'SIGNATURE' };
		default:
			return assertNever(ref, 'Generic type-or-Signature reference');
	}
}

function heritageOccurrenceRef(
	types: TypeFactContext,
	ref: RawSemanticHeritageOccurrenceRef
): SemanticHeritageOccurrenceRef {
	switch (ref.kind) {
		case 'AST_NODE':
			return {
				id:
					types.state.nodeIds.get(nodeKey(ref.sourceOrdinal, ref.nodeOrdinal)) ??
					fail(`Heritage relation references absent node ${ref.nodeOrdinal}.`),
				kind: 'AST_NODE'
			};
		case 'DECLARATION':
			return { id: types.declarationId(ref.declarationOrdinal), kind: 'DECLARATION' };
		default:
			return assertNever(ref, 'Heritage occurrence');
	}
}

function typeOfRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticTypeOfRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if ((raw.state === 'CONFIRMED') !== (raw.typeOrdinal !== null))
		fail(`Type-of relation ${raw.relationOrdinal} state is incoherent.`);
	const preimage = {
		...common,
		kind: 'TYPE_OF' as const,
		queryMode: raw.queryMode,
		subject: typeSubjectRef(types, raw.subject),
		typeId: raw.typeOrdinal === null ? null : types.typeId(raw.typeOrdinal)
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function typeAliasRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticTypeAliasRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if ((raw.state === 'CONFIRMED') !== (raw.aliasedTypeOrdinal !== null))
		fail(`Type-alias relation ${raw.relationOrdinal} state is incoherent.`);
	const preimage = {
		...common,
		aliasDeclarationId: types.declarationId(raw.aliasDeclarationOrdinal),
		aliasedTypeId: raw.aliasedTypeOrdinal === null ? null : types.typeId(raw.aliasedTypeOrdinal),
		kind: 'TYPE_ALIAS' as const
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function constituentRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticTypeConstituentRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if (raw.state !== 'CONFIRMED')
		fail(`Constituent relation ${raw.relationOrdinal} must be confirmed.`);
	if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
		fail(`Constituent relation ${raw.relationOrdinal} has an invalid ordinal.`);
	const expectedCategory = raw.kind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION';
	if (types.rawTypeByOrdinal.get(raw.compositeTypeOrdinal)?.category !== expectedCategory)
		fail(`Constituent relation ${raw.relationOrdinal} composite kind is incoherent.`);
	const preimage = {
		...common,
		compositeTypeId: types.typeId(raw.compositeTypeOrdinal),
		constituentTypeId: types.typeId(raw.constituentTypeOrdinal),
		kind: raw.kind,
		ordinal: raw.ordinal
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function genericInstantiationRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticGenericInstantiationRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if (raw.state !== 'CONFIRMED') fail(`Generic relation ${raw.relationOrdinal} must be confirmed.`);
	const preimage = {
		...common,
		argumentTypeIds: raw.argumentTypeOrdinals.map(types.typeId),
		genericTarget: typeOrSignatureRef(types, raw.genericTarget),
		instantiatedTarget: typeOrSignatureRef(types, raw.instantiatedTarget),
		kind: 'GENERIC_INSTANTIATION' as const
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function parameterConstraintExpectedState(
	constraintState: RawSemanticParameterConstraintRelation['constraintState']
): RawSemanticTypeRelation['state'] {
	if (constraintState === 'UNRESOLVED') return 'UNRESOLVED';
	if (constraintState === 'UNSUPPORTED') return 'UNSUPPORTED';
	return 'CONFIRMED';
}

function parameterConstraintRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticParameterConstraintRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	const parameter =
		types.rawTypeParameterByOrdinal.get(raw.typeParameterOrdinal) ??
		fail(`Constraint relation references absent type parameter ${raw.typeParameterOrdinal}.`);
	const expectedState = parameterConstraintExpectedState(raw.constraintState);
	if (
		raw.state !== expectedState ||
		raw.constraintState !== parameter.constraintState ||
		raw.constraintTypeOrdinal !== parameter.constraintTypeOrdinal
	)
		fail(`Constraint relation ${raw.relationOrdinal} does not mirror its type parameter.`);
	const preimage = {
		...common,
		constraintState: raw.constraintState,
		constraintTypeId:
			raw.constraintTypeOrdinal === null ? null : types.typeId(raw.constraintTypeOrdinal),
		kind: 'PARAMETER_CONSTRAINT' as const,
		typeParameterId: types.typeParameterId(raw.typeParameterOrdinal)
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function heritageRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticHeritageTypeRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if (raw.state !== 'CONFIRMED')
		fail(`Heritage relation ${raw.relationOrdinal} must be confirmed.`);
	const preimage = {
		...common,
		baseTypeId: types.typeId(raw.baseTypeOrdinal),
		derivedTypeId: types.typeId(raw.derivedTypeOrdinal),
		heritageOccurrence: heritageOccurrenceRef(types, raw.heritageOccurrence),
		kind: raw.kind
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function assignabilityRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticAssignabilityRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if (raw.checkerContextDigest !== types.state.contextDigest)
		fail(`Assignability relation ${raw.relationOrdinal} checker context is incoherent.`);
	if (!types.requestedAssignabilityIds.includes(raw.requestId))
		fail(`Assignability relation ${raw.relationOrdinal} has no matching request.`);
	if (
		raw.state === 'CONFIRMED'
			? raw.sourceTypeOrdinal === null ||
				raw.targetTypeOrdinal === null ||
				typeof raw.result !== 'boolean'
			: raw.result !== null || (raw.sourceTypeOrdinal !== null && raw.targetTypeOrdinal !== null)
	)
		fail(`Assignability relation ${raw.relationOrdinal} state is incoherent.`);
	const preimage = {
		...common,
		checkerContextDigest: raw.checkerContextDigest,
		kind: 'ASSIGNABILITY' as const,
		requestId: raw.requestId,
		result: raw.result,
		sourceTypeId: raw.sourceTypeOrdinal === null ? null : types.typeId(raw.sourceTypeOrdinal),
		targetTypeId: raw.targetTypeOrdinal === null ? null : types.typeId(raw.targetTypeOrdinal)
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function overloadMembershipRoleMatches(
	raw: RawSemanticOverloadMembershipRelation,
	signature: RawSemanticSignature
): boolean {
	if (raw.role === 'IMPLEMENTATION_SIGNATURE')
		return signature.semanticKind === 'IMPLEMENTATION_SIGNATURE';
	if (raw.role === 'OVERLOAD_DECLARATION' || raw.role === 'AMBIENT_OVERLOAD')
		return (
			signature.semanticKind === 'OVERLOAD_SIGNATURE' && signature.declarationRole === raw.role
		);
	return (
		(signature.semanticKind === 'SIGNATURE' || signature.semanticKind === 'OVERLOAD_SIGNATURE') &&
		signature.declarationRole === raw.role
	);
}

function overloadMembershipRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticOverloadMembershipRelation,
	common: TypeRelationCommon
): SemanticTypeRelationRecord {
	if (raw.state !== 'CONFIRMED')
		fail(`Overload membership ${raw.relationOrdinal} must be confirmed.`);
	if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
		fail(`Overload membership ${raw.relationOrdinal} has an invalid ordinal.`);
	const signature =
		types.rawSignatureByOrdinal.get(raw.signatureOrdinal) ??
		fail(`Overload membership references absent Signature ${raw.signatureOrdinal}.`);
	const overloadSet =
		types.rawOverloadSetByOrdinal.get(raw.overloadSetOrdinal) ??
		fail(`Overload membership references absent set ${raw.overloadSetOrdinal}.`);
	const roleMatches = overloadMembershipRoleMatches(raw, signature);
	if (!roleMatches) fail(`Overload membership ${raw.relationOrdinal} role is incoherent.`);
	if (
		(signature.owner.kind !== 'SYMBOL' ||
			signature.owner.symbolOrdinal !== overloadSet.callableSymbolOrdinal) &&
		raw.role !== 'CALL_SIGNATURE' &&
		raw.role !== 'CONSTRUCT_SIGNATURE'
	)
		fail(`Overload membership ${raw.relationOrdinal} callable owner is incoherent.`);
	const preimage = {
		...common,
		kind: 'OVERLOAD_MEMBERSHIP' as const,
		ordinal: raw.ordinal,
		overloadSetId: types.overloadSetId(raw.overloadSetOrdinal),
		role: raw.role,
		signatureId: types.signatureId(raw.signatureOrdinal)
	};
	return {
		...preimage,
		id: semanticTypeRelationId(preimage),
		provenanceId: types.typeProvenanceId()
	};
}

function typeRelationRecord(
	types: TypeFactContext,
	raw: RawSemanticTypeRelation
): SemanticTypeRelationRecord {
	const common: TypeRelationCommon = {
		programId: types.state.programId,
		projectId: types.state.projectId,
		state: raw.state
	};
	switch (raw.kind) {
		case 'TYPE_OF':
			return typeOfRelationRecord(types, raw, common);
		case 'TYPE_ALIAS':
			return typeAliasRelationRecord(types, raw, common);
		case 'UNION_CONSTITUENT':
		case 'INTERSECTION_CONSTITUENT':
			return constituentRelationRecord(types, raw, common);
		case 'GENERIC_INSTANTIATION':
			return genericInstantiationRelationRecord(types, raw, common);
		case 'PARAMETER_CONSTRAINT':
			return parameterConstraintRelationRecord(types, raw, common);
		case 'TYPE_EXTENSION':
		case 'TYPE_IMPLEMENTATION':
			return heritageRelationRecord(types, raw, common);
		case 'ASSIGNABILITY':
			return assignabilityRelationRecord(types, raw, common);
		case 'OVERLOAD_MEMBERSHIP':
			return overloadMembershipRelationRecord(types, raw, common);
		default:
			return assertNever(raw, 'Type relation');
	}
}

function collectTypeRelations(types: TypeFactContext, records: SemanticTypeRelationRecord[]): void {
	const typeRelationIdentitySet = new Set<string>();
	for (const raw of types.rawTypeRelations) {
		const record = typeRelationRecord(types, raw);
		if (typeRelationIdentitySet.has(record.id))
			fail(
				`Project ${types.state.raw.project.configPath} contains duplicate type-relation identity ${record.id}.`
			);
		typeRelationIdentitySet.add(record.id);
		types.state.typeRelationIds.set(raw.relationOrdinal, record.id);
		records.push(record);
	}
}

function unionOrIntersectionAnchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: Extract<RawSemanticTypeAcquisitionAnchor, { kind: 'TYPE_COMPONENT' }>
): boolean {
	return types.rawTypeRelations.some(
		(relation) =>
			relation.kind ===
				(anchor.componentKind === 'UNION' ? 'UNION_CONSTITUENT' : 'INTERSECTION_CONSTITUENT') &&
			relation.compositeTypeOrdinal === anchor.parentTypeOrdinal &&
			relation.constituentTypeOrdinal === rawType.typeOrdinal &&
			relation.ordinal === anchor.componentOrdinal
	);
}

function genericTargetAnchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: Extract<RawSemanticTypeAcquisitionAnchor, { kind: 'TYPE_COMPONENT' }>
): boolean {
	return types.rawTypeRelations.some(
		(relation) =>
			relation.kind === 'GENERIC_INSTANTIATION' &&
			relation.genericTarget.kind === 'TYPE' &&
			relation.genericTarget.typeOrdinal === rawType.typeOrdinal &&
			relation.instantiatedTarget.kind === 'TYPE' &&
			relation.instantiatedTarget.typeOrdinal === anchor.parentTypeOrdinal
	);
}

function typeArgumentAnchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: Extract<RawSemanticTypeAcquisitionAnchor, { kind: 'TYPE_COMPONENT' }>
): boolean {
	return types.rawTypeRelations.some(
		(relation) =>
			relation.kind === 'GENERIC_INSTANTIATION' &&
			relation.instantiatedTarget.kind === 'TYPE' &&
			relation.instantiatedTarget.typeOrdinal === anchor.parentTypeOrdinal &&
			relation.argumentTypeOrdinals[anchor.componentOrdinal] === rawType.typeOrdinal
	);
}

function typeComponentAnchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: Extract<RawSemanticTypeAcquisitionAnchor, { kind: 'TYPE_COMPONENT' }>
): boolean {
	if (anchor.componentKind === 'UNION' || anchor.componentKind === 'INTERSECTION')
		return unionOrIntersectionAnchorIsWitnessed(types, rawType, anchor);
	const parameterWitness = types.rawTypeParameters.some(
		(parameter) =>
			parameter.parameterTypeOrdinal === anchor.parentTypeOrdinal &&
			(parameter.constraintTypeOrdinal === rawType.typeOrdinal ||
				parameter.defaultTypeOrdinal === rawType.typeOrdinal)
	);
	if (anchor.componentKind === 'GENERIC_TARGET') {
		if (anchor.componentOrdinal !== 0)
			fail('A generic-target acquisition anchor must use ordinal zero.');
		return parameterWitness || genericTargetAnchorIsWitnessed(types, rawType, anchor);
	}
	return parameterWitness || typeArgumentAnchorIsWitnessed(types, rawType, anchor);
}

function signatureComponentAnchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: Extract<RawSemanticTypeAcquisitionAnchor, { kind: 'SIGNATURE_COMPONENT' }>
): boolean {
	const signature =
		types.rawSignatureByOrdinal.get(anchor.signatureOrdinal) ??
		fail(`Type anchor references absent Signature ${anchor.signatureOrdinal}.`);
	if (anchor.componentKind === 'RETURN') {
		if (anchor.componentOrdinal !== 0)
			fail('A Signature return acquisition anchor must use ordinal zero.');
		return signature.returnTypeOrdinal === rawType.typeOrdinal;
	}
	if (anchor.componentKind === 'TYPE_PARAMETER') {
		const parameterOrdinal = signature.typeParameterOrdinals[anchor.componentOrdinal];
		return (
			parameterOrdinal !== undefined &&
			types.rawTypeParameterByOrdinal.get(parameterOrdinal)?.parameterTypeOrdinal ===
				rawType.typeOrdinal
		);
	}
	if (anchor.componentKind === 'THIS' && anchor.componentOrdinal !== 0)
		fail('A Signature this-parameter acquisition anchor must use ordinal zero.');
	return types.rawSignatureParameters.some(
		(parameter) =>
			parameter.signatureOrdinal === anchor.signatureOrdinal &&
			parameter.role === (anchor.componentKind === 'THIS' ? 'THIS' : 'PARAMETER') &&
			parameter.ordinal === anchor.componentOrdinal &&
			parameter.typeOrdinal === rawType.typeOrdinal
	);
}

function anchorIsWitnessed(
	types: TypeFactContext,
	rawType: RawSemanticType,
	anchor: RawSemanticTypeAcquisitionAnchor
): boolean {
	switch (anchor.kind) {
		case 'NODE':
			return types.rawTypeRelations.some(
				(relation) =>
					relation.kind === 'TYPE_OF' &&
					relation.state === 'CONFIRMED' &&
					relation.typeOrdinal === rawType.typeOrdinal &&
					relation.queryMode === anchor.queryMode &&
					relation.subject.kind === 'AST_NODE' &&
					relation.subject.sourceOrdinal === anchor.sourceOrdinal &&
					relation.subject.nodeOrdinal === anchor.nodeOrdinal
			);
		case 'DECLARATION':
			return types.rawTypeRelations.some(
				(relation) =>
					relation.kind === 'TYPE_OF' &&
					relation.state === 'CONFIRMED' &&
					relation.typeOrdinal === rawType.typeOrdinal &&
					relation.queryMode === anchor.queryMode &&
					relation.subject.kind === 'DECLARATION' &&
					relation.subject.declarationOrdinal === anchor.declarationOrdinal
			);
		case 'SYMBOL':
			return types.rawTypeRelations.some(
				(relation) =>
					relation.kind === 'TYPE_OF' &&
					relation.state === 'CONFIRMED' &&
					relation.typeOrdinal === rawType.typeOrdinal &&
					relation.queryMode === anchor.queryMode &&
					relation.subject.kind === 'SYMBOL' &&
					relation.subject.symbolOrdinal === anchor.symbolOrdinal
			);
		case 'TYPE_COMPONENT':
			return typeComponentAnchorIsWitnessed(types, rawType, anchor);
		case 'SIGNATURE_COMPONENT':
			return signatureComponentAnchorIsWitnessed(types, rawType, anchor);
		default:
			return assertNever(anchor, 'Type acquisition anchor');
	}
}

function assertAcquisitionAnchorsWitnessed(types: TypeFactContext): void {
	for (const rawType of types.rawTypes)
		for (const anchor of rawType.acquisitionAnchors)
			if (!anchorIsWitnessed(types, rawType, anchor))
				fail(
					`Type ${rawType.typeOrdinal} (${rawType.displaySha256}) has acquisition anchor ${canonicalSemanticJson(anchor)} without a matching fact.`
				);
}

function assertAssignabilityReconciliation(types: TypeFactContext): void {
	const actualAssignabilityIds = types.rawTypeRelations
		.filter((record) => record.kind === 'ASSIGNABILITY')
		.map((record) => record.requestId)
		.sort(compare);
	assertUnique(
		actualAssignabilityIds,
		`Project ${types.state.raw.project.configPath} assignability result request identities`
	);
	if (
		canonicalKey(actualAssignabilityIds) !==
		canonicalKey([...types.requestedAssignabilityIds].sort(compare))
	)
		fail(
			`Project ${types.state.raw.project.configPath} does not reconcile assignability requests.`
		);
}

function assertOverloadSetMemberships(types: TypeFactContext): void {
	for (const raw of types.rawOverloadSets) {
		const memberships = types.rawTypeRelations.filter(
			(record): record is RawSemanticOverloadMembershipRelation =>
				record.kind === 'OVERLOAD_MEMBERSHIP' &&
				record.overloadSetOrdinal === raw.overloadSetOrdinal
		);
		if (memberships.length === 0)
			fail(`Overload set ${raw.overloadSetOrdinal} has no membership relations.`);
		assertUnique(
			memberships.map((membership) => String(membership.ordinal)),
			`Overload set ${raw.overloadSetOrdinal} membership ordinals`
		);
		const ordinals = memberships.map((membership) => membership.ordinal).sort((a, b) => a - b);
		for (let index = 0; index < ordinals.length; index += 1)
			if (ordinals[index] !== index)
				fail(`Overload set ${raw.overloadSetOrdinal} membership ordinals are not contiguous.`);
	}
}

function collectProjectTypeFacts(
	context: NormalizationContext,
	state: ProjectState,
	records: TypeFactRecords
): void {
	assertTypeFactOrdinals(state);
	const types = createTypeFactContext(context, state);
	assignTypeIdentities(types);
	assignSignatureIdentities(types);
	assignTypeParameterIdentities(types);
	assignSignatureParameterIdentities(types);
	assignOverloadSetIdentities(types);
	collectTypes(types, records.types);
	collectTypeParameters(types, records.typeParameters);
	collectSignatureParameters(types, records.signatureParameters);
	collectSignatures(types, records.signatures);
	collectOverloadSets(types, records.overloadSets);
	collectTypeRelations(types, records.typeRelations);
	assertAcquisitionAnchorsWitnessed(types);
	assertAssignabilityReconciliation(types);
	assertOverloadSetMemberships(types);
}

function buildTypeFacts(context: NormalizationContext): TypeFactRecords {
	const records: TypeFactRecords = {
		overloadSets: [],
		signatureParameters: [],
		signatures: [],
		typeParameters: [],
		typeRelations: [],
		types: []
	};
	for (const state of context.states) {
		if (!context.typeRequested) continue;
		collectProjectTypeFacts(context, state, records);
	}
	records.types.sort((left, right) => compare(left.id, right.id));
	records.typeParameters.sort((left, right) => compare(left.id, right.id));
	records.signatures.sort((left, right) => compare(left.id, right.id));
	records.signatureParameters.sort((left, right) => compare(left.id, right.id));
	records.overloadSets.sort((left, right) => compare(left.id, right.id));
	records.typeRelations.sort((left, right) => compare(left.id, right.id));
	for (const [entries, field] of [
		[records.types, 'Type identities'],
		[records.typeParameters, 'Type-parameter identities'],
		[records.signatures, 'Signature identities'],
		[records.signatureParameters, 'Signature-parameter identities'],
		[records.overloadSets, 'Overload-set identities'],
		[records.typeRelations, 'Type-relation identities']
	] as const)
		assertUnique(
			entries.map((record) => record.id),
			field
		);
	return records;
}

function collectSources(
	context: NormalizationContext,
	state: ProjectState,
	diagnostics: readonly SemanticDiagnosticRecord[],
	sources: SemanticSourceRecord[]
): void {
	const syntaxLimitations = limitationsForReasons(
		state.raw.project.partialityReasons,
		'TS_SYNTAX',
		state.raw.project.configPath
	);
	for (const raw of state.raw.sources) {
		const id = state.sourceIds.get(raw.sourceOrdinal) ?? fail('Source identity is absent.');
		const sourceDiagnosticIds = diagnostics
			.filter((diagnostic) => diagnostic.sourceId === id)
			.map((diagnostic) => diagnostic.id)
			.sort(compare);
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
			moduleKind: raw.moduleKind,
			origin: raw.origin,
			programId: state.programId,
			projectId: state.projectId,
			provenanceId: provenanceId(context, state, 'TS_PROJECT', sourceLimitations(state, raw), id),
			rootFile: raw.rootFile,
			rootNodeId:
				raw.rootNodeOrdinal === null
					? null
					: (state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.rootNodeOrdinal)) ??
						fail('Source root node identity is absent.')),
			scriptKind: raw.scriptKind,
			scriptKindName: raw.scriptKindName,
			syntaxProvenanceId:
				raw.analysisDisposition === 'DEEP_INDEXED'
					? provenanceId(context, state, 'TS_SYNTAX', syntaxLimitations, id)
					: null,
			textLength: raw.textLength,
			transformation:
				raw.transformation === undefined || raw.transformation === null
					? null
					: structuredClone(raw.transformation)
		});
	}
}

function buildSources(
	context: NormalizationContext,
	diagnostics: readonly SemanticDiagnosticRecord[]
): SemanticSourceRecord[] {
	const sources: SemanticSourceRecord[] = [];
	for (const state of context.states) collectSources(context, state, diagnostics, sources);
	sources.sort((left, right) => compare(left.id, right.id));
	return sources;
}

interface ProgramAndProjectRecords {
	readonly programs: SemanticProgramRecord[];
	readonly projects: SemanticProjectRecord[];
}

function projectDiagnosticFamilies(
	state: ProjectState,
	projectDiagnostics: readonly SemanticDiagnosticRecord[],
	occurrenceIds: ReadonlyMap<number, SemanticDiagnosticRecord['id']>
): SemanticProgramRecord['diagnosticFamilies'] {
	return DIAGNOSTIC_FAMILIES.map((family) => {
		const raw =
			state.raw.diagnosticFamilies.find((coverage) => coverage.family === family) ??
			fail(`Project ${state.raw.project.configPath} lacks ${family} diagnostic coverage.`);
		const occurrenceIdsForFamily = raw.diagnosticOccurrenceOrdinals.map(
			(ordinal) =>
				occurrenceIds.get(ordinal) ??
				fail(`Diagnostic family ${family} references absent occurrence ${ordinal}.`)
		);
		const records = projectDiagnostics.filter((diagnostic) => diagnostic.family === family);
		if (
			sortedUnique(occurrenceIdsForFamily).join('\0') !==
			records
				.map((record) => record.id)
				.sort(compare)
				.join('\0')
		)
			fail(`Diagnostic family ${family} does not cover its emitted records.`);
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
}

function collectProgramAndProject(
	context: NormalizationContext,
	state: ProjectState,
	sources: readonly SemanticSourceRecord[],
	diagnostics: readonly SemanticDiagnosticRecord[],
	occurrenceIdsByProject: ReadonlyMap<string, Map<number, SemanticDiagnosticRecord['id']>>,
	records: ProgramAndProjectRecords
): void {
	const projectSources = sources.filter((source) => source.projectId === state.projectId);
	const projectDiagnostics = diagnostics.filter(
		(diagnostic) => diagnostic.projectId === state.projectId
	);
	const occurrenceIds =
		occurrenceIdsByProject.get(state.raw.project.configPath) ??
		fail('Project diagnostic occurrence index is absent.');
	const diagnosticFamilies = projectDiagnosticFamilies(state, projectDiagnostics, occurrenceIds);
	const tsProjectLimitations = limitationsForReasons(
		state.raw.project.partialityReasons,
		'TS_PROJECT',
		state.raw.project.configPath
	);
	records.programs.push({
		checkerState: 'CREATED',
		contextDigest: state.contextDigest,
		diagnosticFamilies,
		diagnosticIds: projectDiagnostics.map((diagnostic) => diagnostic.id).sort(compare),
		id: state.programId,
		projectId: state.projectId,
		provenanceId: provenanceId(context, state, 'TS_PROJECT', tsProjectLimitations),
		rootSourceIds: projectSources
			.filter((source) => source.rootFile)
			.map((source) => source.id)
			.sort(compare),
		sourceIds: projectSources.map((source) => source.id).sort(compare)
	});
	const partialityReasons = [...state.raw.project.partialityReasons].sort((left, right) =>
		compare(reasonKey(left), reasonKey(right))
	);
	records.projects.push({
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
		provenanceId: provenanceId(context, state, 'TS_PROJECT', tsProjectLimitations),
		rootDisposition: state.raw.project.rootDisposition,
		rootNames: sortedUnique(state.raw.project.rootNames),
		sourceIds: projectSources.map((source) => source.id).sort(compare)
	});
}

function buildProgramsAndProjects(
	context: NormalizationContext,
	sources: readonly SemanticSourceRecord[],
	diagnostics: readonly SemanticDiagnosticRecord[],
	occurrenceIdsByProject: ReadonlyMap<string, Map<number, SemanticDiagnosticRecord['id']>>
): ProgramAndProjectRecords {
	const records: ProgramAndProjectRecords = { programs: [], projects: [] };
	for (const state of context.states)
		collectProgramAndProject(context, state, sources, diagnostics, occurrenceIdsByProject, records);
	records.programs.sort((left, right) => compare(left.id, right.id));
	records.projects.sort((left, right) => compare(left.id, right.id));
	return records;
}

function buildSnapshotLimitations(context: NormalizationContext): SemanticLimitation[] {
	return [
		...new Map(
			context.states
				.flatMap((state) => [
					...state.raw.project.partialityReasons.map((reason): SemanticLimitation => ({
						capability: reason.capability,
						closureEffect: 'DEGRADES_CLOSURE',
						reason: reason.message,
						region: reason.path ?? state.raw.project.configPath
					})),
					...symbolLimitations(state, context.multiProgram),
					...(context.typeRequested ? typeLimitations(state, context.multiProgram) : [])
				])
				.map((limitation) => [limitationKey(limitation), limitation])
		).values()
	].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
}

function tsProjectIsPartial(states: readonly ProjectState[]): boolean {
	return states.some(
		(state) =>
			state.raw.project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT') ||
			state.raw.diagnosticFamilies.some(
				(family) => family.state === 'FAILED' || family.coverage === 'BOUNDED'
			) ||
			state.raw.sources.some(
				(source) =>
					source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)
			)
	);
}

function tsSyntaxIsPartial(states: readonly ProjectState[]): boolean {
	return states.some((state) =>
		state.raw.project.partialityReasons.some((reason) => reason.capability === 'TS_SYNTAX')
	);
}

function tsSymbolIsPartial(states: readonly ProjectState[], multiProgram: boolean): boolean {
	return states.some((state) => symbolLimitations(state, multiProgram).length > 0);
}

function tsTypeIsPartial(states: readonly ProjectState[], multiProgram: boolean): boolean {
	return states.some((state) => typeLimitations(state, multiProgram).length > 0);
}

interface CapabilityPartiality {
	readonly tsProjectPartial: boolean;
	readonly tsSymbolPartial: boolean;
	readonly tsSyntaxPartial: boolean;
	readonly tsTypePartial: boolean;
	readonly typeRequested: boolean;
}

function capabilityReason(capability: SemanticCapability, typeRequested: boolean): string {
	if (capability === 'TS_PROJECT')
		return 'Project, Program, source-membership, compiler-context, and diagnostic facts are implemented by Slice 3A.';
	if (capability === 'TS_SYNTAX')
		return 'Public TypeScript AST, declaration-candidate, literal, invocation, and assignment facts are implemented by Slice 3A.';
	if (capability === 'TS_SYMBOL')
		return 'Public TypeScript lexical-scope plus TypeChecker declaration, symbol, alias, reference, import/export, and module-resolution facts are implemented by the current DWP-003 increment.';
	if (typeRequested)
		return 'Public TypeChecker type, type-parameter, Signature, overload, type-relation, and requested assignability facts were extracted in their exact Program contexts.';
	return 'TS_TYPE was not requested; no type facts or checker judgments were emitted.';
}

function capabilityState(
	capability: SemanticCapability,
	partiality: CapabilityPartiality
): SemanticCapabilityRecord['state'] {
	if (capability === 'TS_PROJECT') return partiality.tsProjectPartial ? 'PARTIAL' : 'SUPPORTED';
	if (capability === 'TS_SYNTAX') return partiality.tsSyntaxPartial ? 'PARTIAL' : 'SUPPORTED';
	if (capability === 'TS_SYMBOL') return partiality.tsSymbolPartial ? 'PARTIAL' : 'SUPPORTED';
	if (!partiality.typeRequested) return 'UNSUPPORTED';
	return partiality.tsTypePartial ? 'PARTIAL' : 'SUPPORTED';
}

function buildCapabilities(partiality: CapabilityPartiality): SemanticCapabilityRecord[] {
	return CAPABILITIES.map((capability) => ({
		capability,
		reason: capabilityReason(capability, partiality.typeRequested),
		state: capabilityState(capability, partiality)
	}));
}

interface SnapshotRecordSets {
	readonly aliases: readonly SemanticAliasRecord[];
	readonly assignments: readonly SemanticAssignmentRecord[];
	readonly astNodes: readonly SemanticAstNodeRecord[];
	readonly compilerInputs: readonly CompilerInputObservation[];
	readonly declarationCandidates: readonly SemanticDeclarationCandidateRecord[];
	readonly declarations: readonly SemanticDeclarationRecord[];
	readonly diagnostics: readonly SemanticDiagnosticRecord[];
	readonly invocations: readonly SemanticInvocationSiteRecord[];
	readonly literals: readonly SemanticLiteralRecord[];
	readonly moduleExports: readonly SemanticModuleExportRecord[];
	readonly moduleResolutions: readonly SemanticModuleResolutionRecord[];
	readonly overloadSets: readonly SemanticOverloadSetRecord[];
	readonly programs: readonly SemanticProgramRecord[];
	readonly projects: readonly SemanticProjectRecord[];
	readonly provenances: readonly SemanticFactProvenanceRecord[];
	readonly references: readonly SemanticReferenceRecord[];
	readonly scopes: readonly SemanticScopeRecord[];
	readonly signatureParameters: readonly SemanticSignatureParameterRecord[];
	readonly signatures: readonly SemanticSignatureRecord[];
	readonly sources: readonly SemanticSourceRecord[];
	readonly symbols: readonly SemanticSymbolRecord[];
	readonly typeParameters: readonly SemanticTypeParameterRecord[];
	readonly typeRelations: readonly SemanticTypeRelationRecord[];
	readonly types: readonly SemanticTypeRecord[];
}

function hasExactFrameworkCandidateCoverage(
	project: SemanticProjectRecord,
	candidate: string,
	sources: readonly SemanticSourceRecord[],
	compilerInputs: readonly CompilerInputObservation[]
): boolean {
	const source = sources.find(
		(record) =>
			record.projectId === project.id &&
			record.logicalPath === candidate &&
			record.analysisDisposition === 'DEEP_INDEXED' &&
			record.origin === 'VIRTUAL' &&
			record.mapping.state === 'EXACT' &&
			record.transformation !== null &&
			record.transformation.authored.logicalPath === candidate &&
			record.transformation.virtual.origin === 'VIRTUAL' &&
			record.transformation.virtual.contentBytes === record.bytes &&
			record.transformation.virtual.contentSha256 === record.contentSha256 &&
			record.transformation.virtual.contentCharacters === record.textLength
	);
	if (source?.transformation === null || source === undefined) return false;
	return compilerInputs.some(
		(observation) =>
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT' &&
			observation.byteBudgetClass === 'VIRTUAL_TRANSFORM' &&
			observation.origin === 'VIRTUAL' &&
			observation.logicalPath === candidate &&
			observation.contentBytes === source.bytes &&
			observation.contentSha256 === source.contentSha256 &&
			canonicalSemanticJson(observation.transformation) ===
				canonicalSemanticJson(source.transformation)
	);
}

function buildPopulationValues({
	aliases,
	assignments,
	astNodes,
	compilerInputs,
	declarationCandidates,
	declarations,
	diagnostics,
	invocations,
	literals,
	moduleExports,
	moduleResolutions,
	overloadSets,
	programs,
	projects,
	provenances,
	references,
	scopes,
	signatureParameters,
	signatures,
	sources,
	symbols,
	typeParameters,
	typeRelations,
	types
}: SnapshotRecordSets): Readonly<Record<SemanticPopulationKind, SemanticPopulationMembers>> {
	const frameworkCandidates = projects.flatMap((project) =>
		project.frameworkCandidates.map((candidate) => ({
			candidate,
			member: `${project.id}\0${candidate}`,
			project
		}))
	);
	const frameworkMembers = sortedUnique(frameworkCandidates.map(({ member }) => member));
	const unsupportedFrameworkMembers = sortedUnique(
		frameworkCandidates
			.filter(
				({ candidate, project }) =>
					!hasExactFrameworkCandidateCoverage(project, candidate, sources, compilerInputs)
			)
			.map(({ member }) => member)
	);
	return {
		PROJECT: members(projects.map((record) => record.id)),
		PROGRAM: members(programs.map((record) => record.id)),
		SOURCE: members(
			sources
				.filter((record) => record.analysisDisposition === 'DEEP_INDEXED')
				.map((record) => record.id),
			sources
				.filter((record) => record.analysisDisposition === 'CONTEXT_ONLY')
				.map((record) => record.id)
		),
		SCOPE: members(
			scopes
				.filter(
					(scope) =>
						scope.sourceId === null ||
						sources.find((source) => source.id === scope.sourceId)?.analysisDisposition ===
							'DEEP_INDEXED'
				)
				.map((scope) => scope.id),
			scopes
				.filter(
					(scope) =>
						scope.sourceId !== null &&
						sources.find((source) => source.id === scope.sourceId)?.analysisDisposition ===
							'CONTEXT_ONLY'
				)
				.map((scope) => scope.id)
		),
		AST_NODE: members(astNodes.map((record) => record.id)),
		DECLARATION_CANDIDATE: members(declarationCandidates.map((record) => record.id)),
		DECLARATION: members(
			declarations.map((record) => record.id),
			[],
			declarations
				.filter(
					(record) =>
						record.scopeLinkState === 'UNSUPPORTED' || record.symbolBindingState === 'UNSUPPORTED'
				)
				.map((record) => record.id)
		),
		SYMBOL: members(symbols.map((record) => record.id)),
		ALIAS: members(
			aliases.map((record) => record.id),
			[],
			aliases.filter((record) => record.state === 'UNSUPPORTED').map((record) => record.id),
			aliases
				.filter((record) => record.state === 'UNRESOLVED' || record.state === 'CIRCULAR')
				.map((record) => record.id)
		),
		REFERENCE: members(
			references.map((record) => record.id),
			[],
			references
				.filter(
					(record) =>
						record.scopeLinkState === 'UNSUPPORTED' || record.resolutionState === 'UNSUPPORTED'
				)
				.map((record) => record.id),
			references
				.filter(
					(record) =>
						record.resolutionState === 'UNRESOLVED' && record.scopeLinkState !== 'UNSUPPORTED'
				)
				.map((record) => record.id)
		),
		MODULE_RESOLUTION: members(
			moduleResolutions.map((record) => record.id),
			[],
			moduleResolutions
				.filter((record) => record.resolutionState === 'UNSUPPORTED')
				.map((record) => record.id),
			moduleResolutions
				.filter((record) => record.resolutionState === 'UNRESOLVED')
				.map((record) => record.id)
		),
		MODULE_EXPORT: members(
			moduleExports.map((record) => record.id),
			[],
			[],
			moduleExports.filter((record) => record.state === 'UNRESOLVED').map((record) => record.id)
		),
		TYPE: members(
			types.map((record) => record.id),
			[],
			types.filter((record) => record.structureState === 'BOUNDED').map((record) => record.id)
		),
		TYPE_PARAMETER: members(
			typeParameters.map((record) => record.id),
			[],
			typeParameters
				.filter(
					(record) =>
						record.constraintState === 'UNSUPPORTED' || record.defaultState === 'UNSUPPORTED'
				)
				.map((record) => record.id),
			typeParameters
				.filter(
					(record) =>
						record.constraintState === 'UNRESOLVED' || record.defaultState === 'UNRESOLVED'
				)
				.map((record) => record.id)
		),
		SIGNATURE: members(signatures.map((record) => record.id)),
		SIGNATURE_PARAMETER: members(signatureParameters.map((record) => record.id)),
		OVERLOAD_SET: members(overloadSets.map((record) => record.id)),
		TYPE_RELATION: members(
			typeRelations.map((record) => record.id),
			[],
			typeRelations.filter((record) => record.state === 'UNSUPPORTED').map((record) => record.id),
			typeRelations.filter((record) => record.state === 'UNRESOLVED').map((record) => record.id)
		),
		LITERAL: members(literals.map((record) => record.nodeId)),
		INVOCATION_SITE: members(invocations.map((record) => record.id)),
		ASSIGNMENT: members(assignments.map((record) => record.nodeId)),
		DIAGNOSTIC: members(diagnostics.map((record) => record.id)),
		PROVENANCE: members(provenances.map((record) => record.id)),
		FRAMEWORK_CANDIDATE: members(frameworkMembers, [], unsupportedFrameworkMembers),
		CONTEXT_INPUT: members(
			[],
			compilerInputs.map((record) => record.id)
		)
	};
}

export function normalizeStaticSemanticSnapshot(
	input: NormalizeStaticSemanticSnapshotInput
): StaticSemanticSnapshot {
	validateInput(input);
	const compilerInputs = [...input.capture.observations].sort((left, right) =>
		compare(left.id, right.id)
	);
	const observationById = new Map(
		compilerInputs.map((observation) => [observation.id, observation])
	);
	const contextDigest = compilerInputClosureDigest(compilerInputs);
	const requestedCapabilities = [...input.request.capabilities].sort(compare);
	const assignabilityRequests = [...input.request.assignabilityRequests].sort(
		compareAssignabilityRequests
	);
	const rawProjects = [...input.projects].sort((left, right) =>
		compare(left.project.configPath, right.project.configPath)
	);
	const snapshotId = semanticSnapshotId({
		assignabilityRequests,
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: input.request.budgets,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		contextDigest,
		expectedEmpty: input.request.expectEmpty,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		projectRecipeDigests: rawProjects
			.map((project) => project.project.programRecipe.projectResolutionDigest)
			.sort(compare),
		provider: PROVIDER,
		requestedCapabilities,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		subjectId: input.request.subjectId
	});

	const states: ProjectState[] = rawProjects.map((raw) =>
		buildProjectState(input, snapshotId, observationById, raw)
	);
	const multiProgram = states.length > 1;
	const typeRequested = requestedCapabilities.includes('TS_TYPE');
	const provenancesById = new Map<string, SemanticFactProvenanceRecord>();
	const context: NormalizationContext = {
		multiProgram,
		provenancesById,
		requestedAssignabilityIds: assignabilityRequests.map((request) => request.requestId),
		snapshotId,
		states,
		subjectId: input.request.subjectId,
		typeRequested
	};
	assertSnapshotBudgets(input, states, rawProjects);
	assignNodeIdentities(states);
	const { diagnostics, occurrenceIdsByProject } = buildDiagnostics(context);

	const { assignments, astNodes, declarationCandidates, literals } = buildSyntaxRecords(states);
	const scopes = buildScopes(context);

	const { aliases, declarations, moduleExports, moduleResolutions, references, symbols } =
		buildSymbolFacts(context);
	const { overloadSets, signatureParameters, signatures, typeParameters, typeRelations, types } =
		buildTypeFacts(context);
	const invocations = buildInvocations(context);
	const sources = buildSources(context, diagnostics);

	const { programs, projects } = buildProgramsAndProjects(
		context,
		sources,
		diagnostics,
		occurrenceIdsByProject
	);
	const provenances = [...provenancesById.values()].sort((left, right) =>
		compare(left.id, right.id)
	);

	const limitations = buildSnapshotLimitations(context);
	const tsProjectPartial = tsProjectIsPartial(states);
	const tsSyntaxPartial = tsSyntaxIsPartial(states);
	const tsSymbolPartial = tsSymbolIsPartial(states, multiProgram);
	const tsTypePartial = typeRequested && tsTypeIsPartial(states, multiProgram);
	const capabilities = buildCapabilities({
		tsProjectPartial,
		tsSymbolPartial,
		tsSyntaxPartial,
		tsTypePartial,
		typeRequested
	});
	const populationValues = buildPopulationValues({
		aliases,
		assignments,
		astNodes,
		compilerInputs,
		declarationCandidates,
		declarations,
		diagnostics,
		invocations,
		literals,
		moduleExports,
		moduleResolutions,
		overloadSets,
		programs,
		projects,
		provenances,
		references,
		scopes,
		signatureParameters,
		signatures,
		sources,
		symbols,
		typeParameters,
		typeRelations,
		types
	});
	const populations = POPULATIONS.map((kind) => {
		const population = populationValues[kind];
		return semanticPopulation(
			kind,
			population,
			population.analyzed.length +
				population.contextOnly.length +
				population.excluded.length +
				population.failed.length ===
				0
		);
	});

	return {
		aliases,
		assignabilityRequests,
		assignments,
		astNodes,
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: input.request.budgets,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		capabilities,
		compilerInputs,
		contextDigest,
		declarationCandidates,
		declarations,
		diagnostics,
		expectedEmpty: input.request.expectEmpty,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		health:
			tsProjectPartial || tsSyntaxPartial || tsSymbolPartial || tsTypePartial
				? 'PARTIAL'
				: 'COMPLETE',
		id: snapshotId,
		invocations,
		limitations,
		literals,
		moduleExports,
		moduleResolutions,
		overloadSets,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		populations,
		programs,
		projects,
		provenances,
		provider: PROVIDER,
		requestedCapabilities,
		references,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		scopes,
		signatureParameters,
		signatures,
		sources,
		symbols,
		subjectId: input.request.subjectId,
		typeParameters,
		typeRelations,
		types
	};
}
