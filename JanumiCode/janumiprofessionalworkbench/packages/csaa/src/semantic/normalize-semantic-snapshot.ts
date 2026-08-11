import type {
	BuildStaticSemanticSnapshotRequest,
	CompilerInputObservation,
	SemanticAliasRecord,
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
	RawSemanticDiagnosticMessage,
	RawSemanticPartialityReason,
	RawSemanticProgramRecipe,
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
	return left < right ? -1 : left > right ? 1 : 0;
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

function provenanceId(
	provenancesById: Map<string, SemanticFactProvenanceRecord>,
	state: ProjectState,
	snapshotId: StaticSemanticSnapshot['id'],
	subjectId: string,
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
			: provenanceId(
					provenancesById,
					state,
					snapshotId,
					subjectId,
					capability,
					canonicalLimitations,
					null,
					factBasis
				);
	const partial = canonicalLimitations.some((limitation) => limitation.closureEffect !== 'NONE');
	const supportRefs =
		sourceId === null
			? sortedUnique([
					subjectId,
					snapshotId,
					state.projectId,
					state.programId,
					...state.contextInputIds
				])
			: sortedUnique([parentProvenanceId!, sourceId]);
	const scopeDerived = capability === 'TS_SYMBOL' && factBasis === 'SCOPE_DERIVED';
	const method = scopeDerived
		? 'typescript-public-ast-binding-rules'
		: capability === 'TS_PROJECT'
			? 'typescript-public-program-and-diagnostics'
			: capability === 'TS_SYMBOL'
				? 'typescript-public-type-checker-binding'
				: capability === 'TS_TYPE'
					? 'typescript-public-type-checker-types-and-signatures'
					: 'typescript-public-normalized-ast';
	const rationale = scopeDerived
		? partial
			? 'Scope and binding-placement facts were derived from the public AST with the declared bounded limitations.'
			: 'Scope and binding-placement facts were derived from public AST syntax and TypeScript binding rules.'
		: partial
			? `${capability} facts were produced successfully with the declared bounded limitations.`
			: `${capability} facts were produced successfully from the exact verified compiler context.`;
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
				kind: scopeDerived
					? 'derived'
					: capability === 'TS_SYNTAX'
						? 'direct-extraction'
						: 'compiler-confirmed',
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
	if (existing !== undefined && canonicalSemanticJson(existing) !== canonicalSemanticJson(record))
		fail(`Provenance identity collision for ${id}.`);
	provenancesById.set(id, record);
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

function validateInput(input: NormalizeStaticSemanticSnapshotInput): void {
	if (input.request.subjectId !== input.subject.descriptor.subjectId)
		fail('Semantic request and FrozenSubject identities differ.');
	const requestedCapabilities = [...input.request.capabilities].sort(compare);
	const typeRequested = requestedCapabilities.includes('TS_TYPE');
	const expectedCapabilities = typeRequested
		? ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
		: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
	if (canonicalSemanticJson(requestedCapabilities) !== canonicalSemanticJson(expectedCapabilities))
		fail(
			typeRequested
				? 'TS_TYPE normalization requires the TS_PROJECT, TS_SYMBOL, and TS_SYNTAX prerequisite closure.'
				: 'DWP-003 TS_SYMBOL normalization requires exactly TS_PROJECT, TS_SYMBOL, and TS_SYNTAX.'
		);
	if (!Array.isArray(input.request.assignabilityRequests))
		fail('Semantic assignability requests must be an array.');
	assertUnique(
		input.request.assignabilityRequests.map((request) => request.requestId),
		'Semantic assignability request identities'
	);
	if (!typeRequested && input.request.assignabilityRequests.length > 0)
		fail('Assignability requests require TS_TYPE.');
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
	for (const project of input.projects) {
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
	const assignabilityRequests = [...input.request.assignabilityRequests].sort((left, right) => {
		const byId = compare(left.requestId, right.requestId);
		return byId === 0 ? compare(canonicalKey(left), canonicalKey(right)) : byId;
	});
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

	const states: ProjectState[] = rawProjects.map((raw) => {
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
	});
	const multiProgram = states.length > 1;

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
			state.raw.types.length,
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

	for (const state of states) {
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

	const diagnosticsById = new Map<string, SemanticDiagnosticRecord>();
	const provenancesById = new Map<string, SemanticFactProvenanceRecord>();
	const occurrenceIdsByProject = new Map<string, Map<number, SemanticDiagnosticRecord['id']>>();
	for (const state of states) {
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
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
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
		occurrenceIdsByProject.set(state.raw.project.configPath, occurrenceIds);
	}
	const diagnostics = [...diagnosticsById.values()].sort((left, right) =>
		compare(left.id, right.id)
	);

	const astNodes: SemanticAstNodeRecord[] = [];
	const declarationCandidates: SemanticDeclarationCandidateRecord[] = [];
	const literals: SemanticLiteralRecord[] = [];
	const invocations: SemanticInvocationSiteRecord[] = [];
	const assignments: SemanticAssignmentRecord[] = [];
	for (const state of states) {
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
		const nodeByOrdinal = (sourceOrdinal: number, ordinal: number): SemanticAstNodeRecord['id'] =>
			state.nodeIds.get(nodeKey(sourceOrdinal, ordinal)) ??
			fail(`Node ordinal ${ordinal} is absent.`);
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
					raw.nameNodeOrdinal === null
						? null
						: nodeByOrdinal(raw.sourceOrdinal, raw.nameNodeOrdinal),
				nameState: raw.nameState,
				nodeId,
				sourceId,
				syntacticName: raw.syntacticName,
				syntaxKind: raw.syntaxKind,
				syntaxKindName: raw.syntaxKindName
			});
		}
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
		for (const raw of state.raw.invocations) {
			const sourceId =
				state.sourceIds.get(raw.sourceOrdinal) ?? fail('Invocation source ordinal is absent.');
			const nodeId = nodeByOrdinal(raw.sourceOrdinal, raw.nodeOrdinal);
			const base = {
				calleeNodeId: nodeByOrdinal(raw.sourceOrdinal, raw.calleeNodeOrdinal),
				id: semanticInvocationSiteId({ invocationKind: raw.invocationKind, nodeId }),
				invocationKind: raw.invocationKind,
				nodeId,
				sourceId,
				targetState: 'SYNTAX_ONLY' as const
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
	astNodes.sort((left, right) => compare(left.id, right.id));
	declarationCandidates.sort((left, right) => compare(left.id, right.id));
	literals.sort((left, right) => compare(left.nodeId, right.nodeId));
	invocations.sort((left, right) => compare(left.id, right.id));
	assignments.sort((left, right) => compare(left.nodeId, right.nodeId));
	const scopes: SemanticScopeRecord[] = [];
	for (const state of states) {
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
						fail(
							`Scope ${raw.scopeOrdinal} references absent source ordinal ${raw.sourceOrdinal}.`
						));
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
		const limitations = symbolLimitations(state, multiProgram);
		for (const raw of state.raw.scopes) {
			const sourceId =
				raw.sourceOrdinal === null
					? null
					: (state.sourceIds.get(raw.sourceOrdinal) ??
						fail(`Scope ${raw.scopeOrdinal} lacks a source identity.`));
			const ownerNodeId =
				raw.ownerNodeOrdinal === null
					? null
					: raw.sourceOrdinal === null
						? fail(`Scope ${raw.scopeOrdinal} has an owner node without a source.`)
						: (state.nodeIds.get(nodeKey(raw.sourceOrdinal, raw.ownerNodeOrdinal)) ??
							fail(
								`Scope ${raw.scopeOrdinal} references absent owner node ${raw.ownerNodeOrdinal}.`
							));
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
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
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
	scopes.sort((left, right) => compare(left.id, right.id));
	assertUnique(
		scopes.map((scope) => scope.id),
		'Scope identities'
	);

	const declarations: SemanticDeclarationRecord[] = [];
	const symbols: SemanticSymbolRecord[] = [];
	const aliases: SemanticAliasRecord[] = [];
	const references: SemanticReferenceRecord[] = [];
	const moduleResolutions: SemanticModuleResolutionRecord[] = [];
	const moduleExports: SemanticModuleExportRecord[] = [];
	for (const state of states) {
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
		const declarationIds = new Set<string>();
		for (const raw of state.raw.declarations) {
			if ((raw.scopeLinkState === 'RESOLVED') !== (raw.declaringScopeOrdinal !== null))
				fail(`Declaration ${raw.declarationOrdinal} scope-link state is incoherent.`);
			if ((raw.symbolBindingState === 'RESOLVED') !== (raw.symbolOrdinal !== null))
				fail(`Declaration ${raw.declarationOrdinal} symbol-binding state is incoherent.`);
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
			if (
				!Number.isSafeInteger(raw.start) ||
				!Number.isSafeInteger(raw.end) ||
				raw.start < 0 ||
				raw.end < raw.start
			)
				fail(`Declaration ${raw.declarationOrdinal} has an invalid source span.`);
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

		assertUnique(
			state.raw.symbols.map((record) => String(record.symbolOrdinal)),
			`Project ${state.raw.project.configPath} symbol ordinals`
		);
		const rawSymbolByOrdinal = new Map(
			state.raw.symbols.map((record) => [record.symbolOrdinal, record] as const)
		);
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
			const declarationIdsForSymbol = raw.declarationOrdinals
				.map((ordinal) => {
					const declaration =
						rawDeclarationByOrdinal.get(ordinal) ??
						fail(`Symbol ${raw.symbolOrdinal} references absent declaration ordinal ${ordinal}.`);
					if (declaration.symbolOrdinal !== raw.symbolOrdinal)
						fail(`Declaration ${ordinal} is attributed to a different symbol ordinal.`);
					return (
						state.declarationIds.get(ordinal) ?? fail(`Declaration ${ordinal} lacks an identity.`)
					);
				})
				.sort(compare);
			const fallbackReferenceNodeIds = raw.fallbackReferenceNodes
				.map(
					(entry) =>
						state.nodeIds.get(nodeKey(entry.sourceOrdinal, entry.nodeOrdinal)) ??
						fail(
							`Symbol ${raw.symbolOrdinal} references absent fallback node ${entry.nodeOrdinal}.`
						)
				)
				.sort(compare);
			if (declarationIdsForSymbol.length === 0 && fallbackReferenceNodeIds.length === 0)
				fail(
					`Symbol ${raw.symbolOrdinal} has neither declarations nor a stable reference fallback.`
				);
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

		const tsSymbolLimitations = symbolLimitations(state, multiProgram);
		const projectSymbolProvenanceId = (): SemanticProvenanceId =>
			provenanceId(
				provenancesById,
				state,
				snapshotId,
				input.request.subjectId,
				'TS_SYMBOL',
				tsSymbolLimitations
			);
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
				mergeState:
					declarationIdsForSymbol.length === 0
						? 'DECLARATIONLESS'
						: declarationIdsForSymbol.length === 1
							? 'SINGLE'
							: 'MERGED',
				name: raw.name,
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: projectSymbolProvenanceId(),
				valueDeclarationId
			});
		}

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
				bindingProvenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId
				),
				candidateId,
				declaringScopeId:
					raw.declaringScopeOrdinal === null
						? null
						: (state.scopeIds.get(raw.declaringScopeOrdinal) ??
							fail(
								`Declaration ${raw.declarationOrdinal} references absent scope ${raw.declaringScopeOrdinal}.`
							)),
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
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId,
					'SCOPE_DERIVED'
				),
				sourceId,
				scopeLinkState: raw.scopeLinkState,
				start: raw.start,
				symbolBindingState: raw.symbolBindingState,
				symbolId:
					raw.symbolOrdinal === null
						? null
						: (state.symbolIds.get(raw.symbolOrdinal) ??
							fail(`Declaration ${raw.declarationOrdinal} lacks a symbol identity.`))
			});
		}

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
				provenanceId: projectSymbolProvenanceId(),
				state: raw.state,
				targetSymbolId,
				terminalSymbolId
			});
		}

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
						fail(
							`Reference node ${raw.nodeOrdinal} references absent symbol ${raw.symbolOrdinal}.`
						));
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
				containingScopeId:
					raw.containingScopeOrdinal === null
						? null
						: (state.scopeIds.get(raw.containingScopeOrdinal) ??
							fail(
								`Reference node ${raw.nodeOrdinal} references absent scope ${raw.containingScopeOrdinal}.`
							)),
				id,
				nodeId,
				resolutionProvenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId
				),
				resolvedSymbolId,
				resolutionState: raw.resolutionState,
				role: raw.role,
				scopeLinkState: raw.scopeLinkState,
				sourceId,
				structuralProvenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId,
					'SCOPE_DERIVED'
				),
				symbolId
			});
		}

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
				provenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId
				),
				resolutionState: raw.resolutionState,
				sourceId,
				specifier: raw.specifier,
				specifierState: raw.specifierState,
				targetSourceId,
				typeOnly: raw.typeOnly
			});
		}

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
				provenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_SYMBOL',
					tsSymbolLimitations,
					sourceId
				),
				sourceId,
				state: raw.state,
				symbolId,
				targetSymbolId
			});
		}
	}
	declarations.sort((left, right) => compare(left.id, right.id));
	symbols.sort((left, right) => compare(left.id, right.id));
	aliases.sort((left, right) => compare(left.id, right.id));
	references.sort((left, right) => compare(left.id, right.id));
	moduleResolutions.sort((left, right) => compare(left.id, right.id));
	moduleExports.sort((left, right) => compare(left.id, right.id));
	assertUnique(
		declarations.map((record) => record.id),
		'Declaration identities'
	);
	assertUnique(
		symbols.map((record) => record.id),
		'Symbol identities'
	);
	assertUnique(
		aliases.map((record) => record.id),
		'Alias identities'
	);
	assertUnique(
		references.map((record) => record.id),
		'Reference identities'
	);
	assertUnique(
		moduleResolutions.map((record) => record.id),
		'Module-resolution identities'
	);
	assertUnique(
		moduleExports.map((record) => record.id),
		'Module-export identities'
	);

	const types: SemanticTypeRecord[] = [];
	const typeParameters: SemanticTypeParameterRecord[] = [];
	const signatures: SemanticSignatureRecord[] = [];
	const signatureParameters: SemanticSignatureParameterRecord[] = [];
	const overloadSets: SemanticOverloadSetRecord[] = [];
	const typeRelations: SemanticTypeRelationRecord[] = [];
	const typeRequested = requestedCapabilities.includes('TS_TYPE');
	const requestedAssignabilityIds = assignabilityRequests.map((request) => request.requestId);
	for (const state of states) {
		if (!typeRequested) continue;
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

		const rawTypes = [...state.raw.types].sort(
			(left, right) => left.typeOrdinal - right.typeOrdinal
		);
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
		const rawTypeByOrdinal = new Map(rawTypes.map((record) => [record.typeOrdinal, record]));
		const rawSignatureByOrdinal = new Map(
			rawSignatures.map((record) => [record.signatureOrdinal, record])
		);
		const rawTypeParameterByOrdinal = new Map(
			rawTypeParameters.map((record) => [record.typeParameterOrdinal, record])
		);
		const rawOverloadSetByOrdinal = new Map(
			rawOverloadSets.map((record) => [record.overloadSetOrdinal, record])
		);
		const rawDeclarationByOrdinal = new Map(
			state.raw.declarations.map((record) => [record.declarationOrdinal, record])
		);

		const declarationId = (ordinal: number): SemanticDeclarationRecord['id'] =>
			state.declarationIds.get(ordinal) ??
			fail(`Type fact references absent declaration ${ordinal}.`);
		const symbolId = (ordinal: number): SemanticSymbolRecord['id'] =>
			state.symbolIds.get(ordinal) ?? fail(`Type fact references absent symbol ${ordinal}.`);
		const typeId = (ordinal: number): SemanticTypeRecord['id'] =>
			state.typeIds.get(ordinal) ?? fail(`Type fact references absent type ${ordinal}.`);
		const signatureId = (ordinal: number): SemanticSignatureRecord['id'] =>
			state.signatureIds.get(ordinal) ?? fail(`Type fact references absent Signature ${ordinal}.`);
		const typeParameterId = (ordinal: number): SemanticTypeParameterRecord['id'] =>
			state.typeParameterIds.get(ordinal) ??
			fail(`Type fact references absent type parameter ${ordinal}.`);
		const signatureParameterId = (ordinal: number): SemanticSignatureParameterRecord['id'] =>
			state.signatureParameterIds.get(ordinal) ??
			fail(`Type fact references absent Signature parameter ${ordinal}.`);
		const overloadSetId = (ordinal: number): SemanticOverloadSetRecord['id'] =>
			state.overloadSetIds.get(ordinal) ??
			fail(`Type fact references absent overload set ${ordinal}.`);

		const signatureOwner = (
			owner: (typeof rawSignatures)[number]['owner']
		): SemanticSignatureOwner => {
			switch (owner.kind) {
				case 'TYPE':
					return { id: typeId(owner.typeOrdinal), kind: 'TYPE' };
				case 'SYMBOL':
					return { id: symbolId(owner.symbolOrdinal), kind: 'SYMBOL' };
				case 'DECLARATION':
					return { id: declarationId(owner.declarationOrdinal), kind: 'DECLARATION' };
				default:
					return assertNever(owner, 'Signature owner');
			}
		};
		const typeParameterOwner = (
			owner: (typeof rawTypeParameters)[number]['owner']
		): SemanticTypeParameterOwner => {
			switch (owner.kind) {
				case 'TYPE':
					return { id: typeId(owner.typeOrdinal), kind: 'TYPE' };
				case 'SIGNATURE':
					return { id: signatureId(owner.signatureOrdinal), kind: 'SIGNATURE' };
				case 'DECLARATION':
					return { id: declarationId(owner.declarationOrdinal), kind: 'DECLARATION' };
				default:
					return assertNever(owner, 'Type-parameter owner');
			}
		};

		const typeIdentitySet = new Set<string>();
		for (const raw of rawTypes) {
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
			if (
				raw.objectFlags !== null &&
				(!Number.isSafeInteger(raw.objectFlags) || raw.objectFlags < 0)
			)
				fail(`Type ${raw.typeOrdinal} object flags are invalid.`);
			if ((raw.structureState === 'COMPLETE') !== (raw.unsupportedStructureKinds.length === 0))
				fail(`Type ${raw.typeOrdinal} structure state is incoherent.`);
			const id = semanticTypeId({
				fingerprintProfile: raw.fingerprintProfile,
				fingerprintSha256: raw.fingerprintSha256,
				identityBasis: raw.identityBasis,
				programId: state.programId
			});
			if (typeIdentitySet.has(id))
				fail(`Project ${state.raw.project.configPath} contains duplicate type identity ${id}.`);
			typeIdentitySet.add(id);
			state.typeIds.set(raw.typeOrdinal, id);
		}

		const signatureIdentityEvidence = new Map<string, string>();
		for (const raw of rawSignatures) {
			if (raw.fingerprintProfile !== SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE)
				fail(`Signature ${raw.signatureOrdinal} has an unsupported fingerprint profile.`);
			assertSha256(raw.displaySha256, `Signature ${raw.signatureOrdinal} display digest`);
			assertSha256(raw.fingerprintSha256, `Signature ${raw.signatureOrdinal} fingerprint digest`);
			if (raw.displaySha256 !== sha256(raw.display))
				fail(`Signature ${raw.signatureOrdinal} display digest is incoherent.`);
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
			if (raw.owner.kind === 'DECLARATION') {
				if (raw.declarationOrdinal !== raw.owner.declarationOrdinal)
					fail(`Signature ${raw.signatureOrdinal} declaration owner is incoherent.`);
			} else if (raw.owner.kind === 'SYMBOL' && raw.declarationOrdinal !== null) {
				const declaration =
					rawDeclarationByOrdinal.get(raw.declarationOrdinal) ??
					fail(`Signature ${raw.signatureOrdinal} references an absent declaration.`);
				if (declaration.symbolOrdinal !== raw.owner.symbolOrdinal)
					fail(`Signature ${raw.signatureOrdinal} Symbol owner is incoherent.`);
			}
			if (
				(raw.declarationRole === 'CONSTRUCT_SIGNATURE' && raw.signatureKind !== 'CONSTRUCT') ||
				(raw.declarationRole === 'CALL_SIGNATURE' && raw.signatureKind !== 'CALL')
			)
				fail(`Signature ${raw.signatureOrdinal} kind and declaration role differ.`);
			if (
				raw.semanticKind === 'OVERLOAD_SIGNATURE' &&
				![
					'OVERLOAD_DECLARATION',
					'AMBIENT_OVERLOAD',
					'CALL_SIGNATURE',
					'CONSTRUCT_SIGNATURE'
				].includes(raw.declarationRole)
			)
				fail(`Signature ${raw.signatureOrdinal} lacks overload declaration evidence.`);
			if (
				['OVERLOAD_DECLARATION', 'AMBIENT_OVERLOAD'].includes(raw.declarationRole) &&
				raw.semanticKind !== 'OVERLOAD_SIGNATURE'
			)
				fail(`Signature ${raw.signatureOrdinal} overload role is incoherent.`);
			if (raw.semanticKind === 'IMPLEMENTATION_SIGNATURE' && raw.declarationRole !== 'DECLARATION')
				fail(`Signature ${raw.signatureOrdinal} lacks implementation declaration evidence.`);
			const owner = signatureOwner(raw.owner);
			const declaration =
				raw.declarationOrdinal === null ? null : declarationId(raw.declarationOrdinal);
			const id =
				raw.identityBasis === 'DECLARATION_ANCHORED'
					? semanticSignatureId({
							declarationId: declaration!,
							identityBasis: 'DECLARATION_ANCHORED',
							programId: state.programId,
							semanticKind: raw.semanticKind,
							signatureKind: raw.signatureKind
						})
					: semanticSignatureId({
							fingerprintProfile: raw.fingerprintProfile,
							fingerprintSha256: raw.fingerprintSha256,
							identityBasis: 'OWNER_ORDINAL',
							owner,
							programId: state.programId,
							providerOrdinal: raw.providerOrdinal!,
							semanticKind: raw.semanticKind,
							signatureKind: raw.signatureKind
						});
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
					`Project ${state.raw.project.configPath} contains duplicate Signature identity ${id}: first ${priorIdentityEvidence}; duplicate ${identityEvidence}.`
				);
			signatureIdentityEvidence.set(id, identityEvidence);
			state.signatureIds.set(raw.signatureOrdinal, id);
		}

		const typeParameterIdentitySet = new Set<string>();
		for (const raw of rawTypeParameters) {
			if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
				fail(`Type parameter ${raw.typeParameterOrdinal} has an invalid owner ordinal.`);
			if ((raw.constraintState === 'RESOLVED') !== (raw.constraintTypeOrdinal !== null))
				fail(`Type parameter ${raw.typeParameterOrdinal} constraint state is incoherent.`);
			if ((raw.defaultState === 'RESOLVED') !== (raw.defaultTypeOrdinal !== null))
				fail(`Type parameter ${raw.typeParameterOrdinal} default state is incoherent.`);
			const owner = typeParameterOwner(raw.owner);
			const declaration =
				raw.declarationOrdinal === null ? null : declarationId(raw.declarationOrdinal);
			if (raw.owner.kind === 'DECLARATION') {
				if (raw.declarationOrdinal === null)
					fail(`Type parameter ${raw.typeParameterOrdinal} lacks its parameter declaration.`);
				const ownerDeclaration =
					rawDeclarationByOrdinal.get(raw.owner.declarationOrdinal) ??
					fail(
						`Type parameter ${raw.typeParameterOrdinal} references an absent owner declaration.`
					);
				const parameterDeclaration =
					rawDeclarationByOrdinal.get(raw.declarationOrdinal) ??
					fail(
						`Type parameter ${raw.typeParameterOrdinal} references an absent parameter declaration.`
					);
				if (
					ownerDeclaration.declarationOrdinal === parameterDeclaration.declarationOrdinal ||
					ownerDeclaration.sourceOrdinal !== parameterDeclaration.sourceOrdinal ||
					ownerDeclaration.start > parameterDeclaration.start ||
					ownerDeclaration.end < parameterDeclaration.end
				)
					fail(`Type parameter ${raw.typeParameterOrdinal} declaration owner is incoherent.`);
			}
			typeId(raw.parameterTypeOrdinal);
			if (raw.constraintTypeOrdinal !== null) typeId(raw.constraintTypeOrdinal);
			if (raw.defaultTypeOrdinal !== null) typeId(raw.defaultTypeOrdinal);
			const id = semanticTypeParameterId({
				declarationId: declaration,
				ordinal: raw.ordinal,
				owner
			});
			if (typeParameterIdentitySet.has(id))
				fail(
					`Project ${state.raw.project.configPath} contains duplicate type-parameter identity ${id}.`
				);
			typeParameterIdentitySet.add(id);
			state.typeParameterIds.set(raw.typeParameterOrdinal, id);
		}

		const signatureParameterIdentitySet = new Set<string>();
		for (const raw of rawSignatureParameters) {
			if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
				fail(`Signature parameter ${raw.signatureParameterOrdinal} has an invalid ordinal.`);
			const ownerId = signatureId(raw.signatureOrdinal);
			if (raw.declarationOrdinal !== null) declarationId(raw.declarationOrdinal);
			if (raw.symbolOrdinal !== null) symbolId(raw.symbolOrdinal);
			typeId(raw.typeOrdinal);
			const id = semanticSignatureParameterId({
				ordinal: raw.ordinal,
				role: raw.role,
				signatureId: ownerId
			});
			if (signatureParameterIdentitySet.has(id))
				fail(
					`Project ${state.raw.project.configPath} contains duplicate Signature-parameter identity ${id}.`
				);
			signatureParameterIdentitySet.add(id);
			state.signatureParameterIds.set(raw.signatureParameterOrdinal, id);
		}

		const overloadSetIdentitySet = new Set<string>();
		for (const raw of rawOverloadSets) {
			const callableSymbolId = symbolId(raw.callableSymbolOrdinal);
			const id = semanticOverloadSetId({ callableSymbolId, programId: state.programId });
			if (overloadSetIdentitySet.has(id))
				fail(
					`Project ${state.raw.project.configPath} contains duplicate overload-set identity ${id}.`
				);
			overloadSetIdentitySet.add(id);
			state.overloadSetIds.set(raw.overloadSetOrdinal, id);
		}

		const normalizedSignatureOwner = (
			raw: (typeof rawSignatures)[number]
		): SemanticSignatureOwner => signatureOwner(raw.owner);
		const normalizedTypeParameterOwner = (
			raw: (typeof rawTypeParameters)[number]
		): SemanticTypeParameterOwner => typeParameterOwner(raw.owner);
		const normalizedAnchor = (
			anchor: (typeof rawTypes)[number]['acquisitionAnchors'][number]
		): SemanticTypeAcquisitionAnchor => {
			switch (anchor.kind) {
				case 'NODE':
					return {
						kind: 'NODE',
						nodeId:
							state.nodeIds.get(nodeKey(anchor.sourceOrdinal, anchor.nodeOrdinal)) ??
							fail(`Type anchor references absent node ${anchor.nodeOrdinal}.`),
						queryMode: anchor.queryMode
					};
				case 'DECLARATION':
					return {
						declarationId: declarationId(anchor.declarationOrdinal),
						kind: 'DECLARATION',
						queryMode: anchor.queryMode
					};
				case 'SYMBOL':
					return {
						kind: 'SYMBOL',
						queryMode: anchor.queryMode,
						symbolId: symbolId(anchor.symbolOrdinal)
					};
				case 'TYPE_COMPONENT':
					if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
						fail('Type component anchor has an invalid ordinal.');
					return {
						componentKind: anchor.componentKind,
						componentOrdinal: anchor.componentOrdinal,
						kind: 'TYPE_COMPONENT',
						parentTypeId: typeId(anchor.parentTypeOrdinal)
					};
				case 'SIGNATURE_COMPONENT':
					if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
						fail('Signature component anchor has an invalid ordinal.');
					return {
						componentKind: anchor.componentKind,
						componentOrdinal: anchor.componentOrdinal,
						kind: 'SIGNATURE_COMPONENT',
						signatureId: signatureId(anchor.signatureOrdinal)
					};
				default:
					return assertNever(anchor, 'Type acquisition anchor');
			}
		};
		const tsTypeLimitations = typeLimitations(state, multiProgram);
		const typeProvenanceId = (): SemanticProvenanceId =>
			provenanceId(
				provenancesById,
				state,
				snapshotId,
				input.request.subjectId,
				'TS_TYPE',
				tsTypeLimitations
			);

		for (const raw of rawTypes) {
			const acquisitionAnchors = raw.acquisitionAnchors
				.map(normalizedAnchor)
				.sort((left, right) => compare(canonicalKey(left), canonicalKey(right)));
			if (acquisitionAnchors.length === 0)
				fail(`Type ${raw.typeOrdinal} lacks an acquisition anchor.`);
			assertUnique(
				acquisitionAnchors.map(canonicalKey),
				`Type ${raw.typeOrdinal} acquisition anchors`
			);
			types.push({
				acquisitionAnchors,
				aliasSymbolId: raw.aliasSymbolOrdinal === null ? null : symbolId(raw.aliasSymbolOrdinal),
				category: raw.category,
				display: raw.display,
				displayProfile: raw.displayProfile,
				displaySha256: raw.displaySha256,
				fingerprintProfile: raw.fingerprintProfile,
				fingerprintSha256: raw.fingerprintSha256,
				flagNames: sortedUnique(raw.flagNames),
				flags: raw.flags,
				id: typeId(raw.typeOrdinal),
				identityBasis: raw.identityBasis,
				objectFlagNames: sortedUnique(raw.objectFlagNames),
				objectFlags: raw.objectFlags,
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: typeProvenanceId(),
				structureState: raw.structureState,
				symbolId: raw.symbolOrdinal === null ? null : symbolId(raw.symbolOrdinal),
				unsupportedStructureKinds: sortedUnique(raw.unsupportedStructureKinds)
			});
		}

		for (const raw of rawTypeParameters)
			typeParameters.push({
				constraintState: raw.constraintState,
				constraintTypeId:
					raw.constraintTypeOrdinal === null ? null : typeId(raw.constraintTypeOrdinal),
				declarationId:
					raw.declarationOrdinal === null ? null : declarationId(raw.declarationOrdinal),
				defaultState: raw.defaultState,
				defaultTypeId: raw.defaultTypeOrdinal === null ? null : typeId(raw.defaultTypeOrdinal),
				id: typeParameterId(raw.typeParameterOrdinal),
				name: raw.name,
				ordinal: raw.ordinal,
				owner: normalizedTypeParameterOwner(raw),
				parameterTypeId: typeId(raw.parameterTypeOrdinal),
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: typeProvenanceId()
			});

		for (const raw of rawSignatureParameters)
			signatureParameters.push({
				declarationId:
					raw.declarationOrdinal === null ? null : declarationId(raw.declarationOrdinal),
				id: signatureParameterId(raw.signatureParameterOrdinal),
				name: raw.name,
				optional: raw.optional,
				ordinal: raw.ordinal,
				provenanceId: typeProvenanceId(),
				rest: raw.rest,
				role: raw.role,
				signatureId: signatureId(raw.signatureOrdinal),
				symbolId: raw.symbolOrdinal === null ? null : symbolId(raw.symbolOrdinal),
				typeId: typeId(raw.typeOrdinal)
			});

		for (const raw of rawSignatures) {
			assertUnique(
				raw.parameterOrdinals.map(String),
				`Signature ${raw.signatureOrdinal} parameter ordinals`
			);
			assertUnique(
				raw.typeParameterOrdinals.map(String),
				`Signature ${raw.signatureOrdinal} type-parameter ordinals`
			);
			const expectedParameterOrdinals = rawSignatureParameters
				.filter((parameter) => parameter.signatureOrdinal === raw.signatureOrdinal)
				.sort((left, right) => left.ordinal - right.ordinal)
				.map((parameter) => parameter.signatureParameterOrdinal);
			const expectedTypeParameterOrdinals = rawTypeParameters
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
			signatures.push({
				declarationId:
					raw.declarationOrdinal === null ? null : declarationId(raw.declarationOrdinal),
				declarationRole: raw.declarationRole,
				display: raw.display,
				displaySha256: raw.displaySha256,
				fingerprintProfile: raw.fingerprintProfile,
				fingerprintSha256: raw.fingerprintSha256,
				id: signatureId(raw.signatureOrdinal),
				identityBasis: raw.identityBasis,
				owner: normalizedSignatureOwner(raw),
				parameterIds: raw.parameterOrdinals.map(signatureParameterId),
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: typeProvenanceId(),
				providerOrdinal: raw.providerOrdinal,
				returnTypeId: typeId(raw.returnTypeOrdinal),
				semanticKind: raw.semanticKind,
				signatureKind: raw.signatureKind,
				typeParameterIds: raw.typeParameterOrdinals.map(typeParameterId)
			});
		}

		for (const raw of rawOverloadSets)
			overloadSets.push({
				callableSymbolId: symbolId(raw.callableSymbolOrdinal),
				id: overloadSetId(raw.overloadSetOrdinal),
				programId: state.programId,
				projectId: state.projectId,
				provenanceId: typeProvenanceId()
			});

		const typeSubject = (
			subject: Extract<(typeof rawTypeRelations)[number], { kind: 'TYPE_OF' }>['subject']
		): SemanticTypeSubjectRef => {
			switch (subject.kind) {
				case 'AST_NODE':
					return {
						id:
							state.nodeIds.get(nodeKey(subject.sourceOrdinal, subject.nodeOrdinal)) ??
							fail(`Type-of relation references absent node ${subject.nodeOrdinal}.`),
						kind: 'AST_NODE'
					};
				case 'DECLARATION':
					return { id: declarationId(subject.declarationOrdinal), kind: 'DECLARATION' };
				case 'SYMBOL':
					return { id: symbolId(subject.symbolOrdinal), kind: 'SYMBOL' };
				default:
					return assertNever(subject, 'Type-of subject');
			}
		};
		const typeOrSignature = (
			ref: Extract<
				(typeof rawTypeRelations)[number],
				{ kind: 'GENERIC_INSTANTIATION' }
			>['genericTarget']
		): SemanticTypeOrSignatureRef => {
			switch (ref.kind) {
				case 'TYPE':
					return { id: typeId(ref.typeOrdinal), kind: 'TYPE' };
				case 'SIGNATURE':
					return { id: signatureId(ref.signatureOrdinal), kind: 'SIGNATURE' };
				default:
					return assertNever(ref, 'Generic type-or-Signature reference');
			}
		};
		const heritageOccurrence = (
			ref: Extract<
				(typeof rawTypeRelations)[number],
				{ kind: 'TYPE_EXTENSION' | 'TYPE_IMPLEMENTATION' }
			>['heritageOccurrence']
		): SemanticHeritageOccurrenceRef => {
			switch (ref.kind) {
				case 'AST_NODE':
					return {
						id:
							state.nodeIds.get(nodeKey(ref.sourceOrdinal, ref.nodeOrdinal)) ??
							fail(`Heritage relation references absent node ${ref.nodeOrdinal}.`),
						kind: 'AST_NODE'
					};
				case 'DECLARATION':
					return { id: declarationId(ref.declarationOrdinal), kind: 'DECLARATION' };
				default:
					return assertNever(ref, 'Heritage occurrence');
			}
		};

		const typeRelationIdentitySet = new Set<string>();
		for (const raw of rawTypeRelations) {
			let record: SemanticTypeRelationRecord;
			const common = {
				programId: state.programId,
				projectId: state.projectId,
				state: raw.state
			};
			switch (raw.kind) {
				case 'TYPE_OF': {
					if ((raw.state === 'CONFIRMED') !== (raw.typeOrdinal !== null))
						fail(`Type-of relation ${raw.relationOrdinal} state is incoherent.`);
					const preimage = {
						...common,
						kind: 'TYPE_OF' as const,
						queryMode: raw.queryMode,
						subject: typeSubject(raw.subject),
						typeId: raw.typeOrdinal === null ? null : typeId(raw.typeOrdinal)
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'TYPE_ALIAS': {
					if ((raw.state === 'CONFIRMED') !== (raw.aliasedTypeOrdinal !== null))
						fail(`Type-alias relation ${raw.relationOrdinal} state is incoherent.`);
					const preimage = {
						...common,
						aliasDeclarationId: declarationId(raw.aliasDeclarationOrdinal),
						aliasedTypeId: raw.aliasedTypeOrdinal === null ? null : typeId(raw.aliasedTypeOrdinal),
						kind: 'TYPE_ALIAS' as const
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'UNION_CONSTITUENT':
				case 'INTERSECTION_CONSTITUENT': {
					if (raw.state !== 'CONFIRMED')
						fail(`Constituent relation ${raw.relationOrdinal} must be confirmed.`);
					if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
						fail(`Constituent relation ${raw.relationOrdinal} has an invalid ordinal.`);
					const expectedCategory = raw.kind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION';
					if (rawTypeByOrdinal.get(raw.compositeTypeOrdinal)?.category !== expectedCategory)
						fail(`Constituent relation ${raw.relationOrdinal} composite kind is incoherent.`);
					const preimage = {
						...common,
						compositeTypeId: typeId(raw.compositeTypeOrdinal),
						constituentTypeId: typeId(raw.constituentTypeOrdinal),
						kind: raw.kind,
						ordinal: raw.ordinal
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'GENERIC_INSTANTIATION': {
					if (raw.state !== 'CONFIRMED')
						fail(`Generic relation ${raw.relationOrdinal} must be confirmed.`);
					const preimage = {
						...common,
						argumentTypeIds: raw.argumentTypeOrdinals.map(typeId),
						genericTarget: typeOrSignature(raw.genericTarget),
						instantiatedTarget: typeOrSignature(raw.instantiatedTarget),
						kind: 'GENERIC_INSTANTIATION' as const
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'PARAMETER_CONSTRAINT': {
					const parameter =
						rawTypeParameterByOrdinal.get(raw.typeParameterOrdinal) ??
						fail(
							`Constraint relation references absent type parameter ${raw.typeParameterOrdinal}.`
						);
					const expectedState =
						raw.constraintState === 'UNRESOLVED'
							? 'UNRESOLVED'
							: raw.constraintState === 'UNSUPPORTED'
								? 'UNSUPPORTED'
								: 'CONFIRMED';
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
							raw.constraintTypeOrdinal === null ? null : typeId(raw.constraintTypeOrdinal),
						kind: 'PARAMETER_CONSTRAINT' as const,
						typeParameterId: typeParameterId(raw.typeParameterOrdinal)
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'TYPE_EXTENSION':
				case 'TYPE_IMPLEMENTATION': {
					if (raw.state !== 'CONFIRMED')
						fail(`Heritage relation ${raw.relationOrdinal} must be confirmed.`);
					const preimage = {
						...common,
						baseTypeId: typeId(raw.baseTypeOrdinal),
						derivedTypeId: typeId(raw.derivedTypeOrdinal),
						heritageOccurrence: heritageOccurrence(raw.heritageOccurrence),
						kind: raw.kind
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'ASSIGNABILITY': {
					if (raw.checkerContextDigest !== state.contextDigest)
						fail(`Assignability relation ${raw.relationOrdinal} checker context is incoherent.`);
					if (!requestedAssignabilityIds.includes(raw.requestId))
						fail(`Assignability relation ${raw.relationOrdinal} has no matching request.`);
					if (
						raw.state === 'CONFIRMED'
							? raw.sourceTypeOrdinal === null ||
								raw.targetTypeOrdinal === null ||
								typeof raw.result !== 'boolean'
							: raw.result !== null ||
								(raw.sourceTypeOrdinal !== null && raw.targetTypeOrdinal !== null)
					)
						fail(`Assignability relation ${raw.relationOrdinal} state is incoherent.`);
					const preimage = {
						...common,
						checkerContextDigest: raw.checkerContextDigest,
						kind: 'ASSIGNABILITY' as const,
						requestId: raw.requestId,
						result: raw.result,
						sourceTypeId: raw.sourceTypeOrdinal === null ? null : typeId(raw.sourceTypeOrdinal),
						targetTypeId: raw.targetTypeOrdinal === null ? null : typeId(raw.targetTypeOrdinal)
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				case 'OVERLOAD_MEMBERSHIP': {
					if (raw.state !== 'CONFIRMED')
						fail(`Overload membership ${raw.relationOrdinal} must be confirmed.`);
					if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal < 0)
						fail(`Overload membership ${raw.relationOrdinal} has an invalid ordinal.`);
					const signature =
						rawSignatureByOrdinal.get(raw.signatureOrdinal) ??
						fail(`Overload membership references absent Signature ${raw.signatureOrdinal}.`);
					const overloadSet =
						rawOverloadSetByOrdinal.get(raw.overloadSetOrdinal) ??
						fail(`Overload membership references absent set ${raw.overloadSetOrdinal}.`);
					const roleMatches =
						raw.role === 'IMPLEMENTATION_SIGNATURE'
							? signature.semanticKind === 'IMPLEMENTATION_SIGNATURE'
							: raw.role === 'OVERLOAD_DECLARATION' || raw.role === 'AMBIENT_OVERLOAD'
								? signature.semanticKind === 'OVERLOAD_SIGNATURE' &&
									signature.declarationRole === raw.role
								: (signature.semanticKind === 'SIGNATURE' ||
										signature.semanticKind === 'OVERLOAD_SIGNATURE') &&
									signature.declarationRole === raw.role;
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
						overloadSetId: overloadSetId(raw.overloadSetOrdinal),
						role: raw.role,
						signatureId: signatureId(raw.signatureOrdinal)
					};
					record = {
						...preimage,
						id: semanticTypeRelationId(preimage),
						provenanceId: typeProvenanceId()
					};
					break;
				}
				default:
					record = assertNever(raw, 'Type relation');
			}
			if (typeRelationIdentitySet.has(record.id))
				fail(
					`Project ${state.raw.project.configPath} contains duplicate type-relation identity ${record.id}.`
				);
			typeRelationIdentitySet.add(record.id);
			state.typeRelationIds.set(raw.relationOrdinal, record.id);
			typeRelations.push(record);
		}
		for (const rawType of rawTypes)
			for (const anchor of rawType.acquisitionAnchors) {
				let witnessed = false;
				switch (anchor.kind) {
					case 'NODE':
						witnessed = rawTypeRelations.some(
							(relation) =>
								relation.kind === 'TYPE_OF' &&
								relation.state === 'CONFIRMED' &&
								relation.typeOrdinal === rawType.typeOrdinal &&
								relation.queryMode === anchor.queryMode &&
								relation.subject.kind === 'AST_NODE' &&
								relation.subject.sourceOrdinal === anchor.sourceOrdinal &&
								relation.subject.nodeOrdinal === anchor.nodeOrdinal
						);
						break;
					case 'DECLARATION':
						witnessed = rawTypeRelations.some(
							(relation) =>
								relation.kind === 'TYPE_OF' &&
								relation.state === 'CONFIRMED' &&
								relation.typeOrdinal === rawType.typeOrdinal &&
								relation.queryMode === anchor.queryMode &&
								relation.subject.kind === 'DECLARATION' &&
								relation.subject.declarationOrdinal === anchor.declarationOrdinal
						);
						break;
					case 'SYMBOL':
						witnessed = rawTypeRelations.some(
							(relation) =>
								relation.kind === 'TYPE_OF' &&
								relation.state === 'CONFIRMED' &&
								relation.typeOrdinal === rawType.typeOrdinal &&
								relation.queryMode === anchor.queryMode &&
								relation.subject.kind === 'SYMBOL' &&
								relation.subject.symbolOrdinal === anchor.symbolOrdinal
						);
						break;
					case 'TYPE_COMPONENT':
						if (anchor.componentKind === 'UNION' || anchor.componentKind === 'INTERSECTION')
							witnessed = rawTypeRelations.some(
								(relation) =>
									relation.kind ===
										(anchor.componentKind === 'UNION'
											? 'UNION_CONSTITUENT'
											: 'INTERSECTION_CONSTITUENT') &&
									relation.compositeTypeOrdinal === anchor.parentTypeOrdinal &&
									relation.constituentTypeOrdinal === rawType.typeOrdinal &&
									relation.ordinal === anchor.componentOrdinal
							);
						else {
							const parameterWitness = rawTypeParameters.some(
								(parameter) =>
									parameter.parameterTypeOrdinal === anchor.parentTypeOrdinal &&
									(parameter.constraintTypeOrdinal === rawType.typeOrdinal ||
										parameter.defaultTypeOrdinal === rawType.typeOrdinal)
							);
							if (anchor.componentKind === 'GENERIC_TARGET') {
								if (anchor.componentOrdinal !== 0)
									fail('A generic-target acquisition anchor must use ordinal zero.');
								witnessed =
									parameterWitness ||
									rawTypeRelations.some(
										(relation) =>
											relation.kind === 'GENERIC_INSTANTIATION' &&
											relation.genericTarget.kind === 'TYPE' &&
											relation.genericTarget.typeOrdinal === rawType.typeOrdinal &&
											relation.instantiatedTarget.kind === 'TYPE' &&
											relation.instantiatedTarget.typeOrdinal === anchor.parentTypeOrdinal
									);
							} else
								witnessed =
									parameterWitness ||
									rawTypeRelations.some(
										(relation) =>
											relation.kind === 'GENERIC_INSTANTIATION' &&
											relation.instantiatedTarget.kind === 'TYPE' &&
											relation.instantiatedTarget.typeOrdinal === anchor.parentTypeOrdinal &&
											relation.argumentTypeOrdinals[anchor.componentOrdinal] === rawType.typeOrdinal
									);
						}
						break;
					case 'SIGNATURE_COMPONENT': {
						const signature =
							rawSignatureByOrdinal.get(anchor.signatureOrdinal) ??
							fail(`Type anchor references absent Signature ${anchor.signatureOrdinal}.`);
						if (anchor.componentKind === 'RETURN') {
							if (anchor.componentOrdinal !== 0)
								fail('A Signature return acquisition anchor must use ordinal zero.');
							witnessed = signature.returnTypeOrdinal === rawType.typeOrdinal;
						} else if (anchor.componentKind === 'TYPE_PARAMETER') {
							const parameterOrdinal = signature.typeParameterOrdinals[anchor.componentOrdinal];
							witnessed =
								parameterOrdinal !== undefined &&
								rawTypeParameterByOrdinal.get(parameterOrdinal)?.parameterTypeOrdinal ===
									rawType.typeOrdinal;
						} else {
							if (anchor.componentKind === 'THIS' && anchor.componentOrdinal !== 0)
								fail('A Signature this-parameter acquisition anchor must use ordinal zero.');
							witnessed = rawSignatureParameters.some(
								(parameter) =>
									parameter.signatureOrdinal === anchor.signatureOrdinal &&
									parameter.role === (anchor.componentKind === 'THIS' ? 'THIS' : 'PARAMETER') &&
									parameter.ordinal === anchor.componentOrdinal &&
									parameter.typeOrdinal === rawType.typeOrdinal
							);
						}
						break;
					}
					default:
						assertNever(anchor, 'Type acquisition anchor');
				}
				if (!witnessed)
					fail(
						`Type ${rawType.typeOrdinal} (${rawType.displaySha256}) has acquisition anchor ${canonicalSemanticJson(anchor)} without a matching fact.`
					);
			}

		const actualAssignabilityIds = rawTypeRelations
			.filter((record) => record.kind === 'ASSIGNABILITY')
			.map((record) => record.requestId)
			.sort(compare);
		assertUnique(
			actualAssignabilityIds,
			`Project ${state.raw.project.configPath} assignability result request identities`
		);
		if (
			canonicalKey(actualAssignabilityIds) !==
			canonicalKey([...requestedAssignabilityIds].sort(compare))
		)
			fail(`Project ${state.raw.project.configPath} does not reconcile assignability requests.`);
		for (const raw of rawOverloadSets) {
			const memberships = rawTypeRelations.filter(
				(
					record
				): record is Extract<(typeof rawTypeRelations)[number], { kind: 'OVERLOAD_MEMBERSHIP' }> =>
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
	types.sort((left, right) => compare(left.id, right.id));
	typeParameters.sort((left, right) => compare(left.id, right.id));
	signatures.sort((left, right) => compare(left.id, right.id));
	signatureParameters.sort((left, right) => compare(left.id, right.id));
	overloadSets.sort((left, right) => compare(left.id, right.id));
	typeRelations.sort((left, right) => compare(left.id, right.id));
	for (const [records, field] of [
		[types, 'Type identities'],
		[typeParameters, 'Type-parameter identities'],
		[signatures, 'Signature identities'],
		[signatureParameters, 'Signature-parameter identities'],
		[overloadSets, 'Overload-set identities'],
		[typeRelations, 'Type-relation identities']
	] as const)
		assertUnique(
			records.map((record) => record.id),
			field
		);

	const sources: SemanticSourceRecord[] = [];
	for (const state of states) {
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
				provenanceId: provenanceId(
					provenancesById,
					state,
					snapshotId,
					input.request.subjectId,
					'TS_PROJECT',
					sourceLimitations(state, raw),
					id
				),
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
						? provenanceId(
								provenancesById,
								state,
								snapshotId,
								input.request.subjectId,
								'TS_SYNTAX',
								syntaxLimitations,
								id
							)
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
		const projectDiagnostics = diagnostics.filter(
			(diagnostic) => diagnostic.projectId === state.projectId
		);
		const occurrenceIds =
			occurrenceIdsByProject.get(state.raw.project.configPath) ??
			fail('Project diagnostic occurrence index is absent.');
		const diagnosticFamilies = DIAGNOSTIC_FAMILIES.map((family) => {
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
		const tsProjectLimitations = limitationsForReasons(
			state.raw.project.partialityReasons,
			'TS_PROJECT',
			state.raw.project.configPath
		);
		programs.push({
			checkerState: 'CREATED',
			contextDigest: state.contextDigest,
			diagnosticFamilies,
			diagnosticIds: projectDiagnostics.map((diagnostic) => diagnostic.id).sort(compare),
			id: state.programId,
			projectId: state.projectId,
			provenanceId: provenanceId(
				provenancesById,
				state,
				snapshotId,
				input.request.subjectId,
				'TS_PROJECT',
				tsProjectLimitations
			),
			rootSourceIds: projectSources
				.filter((source) => source.rootFile)
				.map((source) => source.id)
				.sort(compare),
			sourceIds: projectSources.map((source) => source.id).sort(compare)
		});
		const partialityReasons = [...state.raw.project.partialityReasons].sort((left, right) =>
			compare(reasonKey(left), reasonKey(right))
		);
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
			provenanceId: provenanceId(
				provenancesById,
				state,
				snapshotId,
				input.request.subjectId,
				'TS_PROJECT',
				tsProjectLimitations
			),
			rootDisposition: state.raw.project.rootDisposition,
			rootNames: sortedUnique(state.raw.project.rootNames),
			sourceIds: projectSources.map((source) => source.id).sort(compare)
		});
	}
	programs.sort((left, right) => compare(left.id, right.id));
	projects.sort((left, right) => compare(left.id, right.id));
	const provenances = [...provenancesById.values()].sort((left, right) =>
		compare(left.id, right.id)
	);

	const limitations = [
		...new Map(
			states
				.flatMap((state) => [
					...state.raw.project.partialityReasons.map((reason): SemanticLimitation => ({
						capability: reason.capability,
						closureEffect: 'DEGRADES_CLOSURE',
						reason: reason.message,
						region: reason.path ?? state.raw.project.configPath
					})),
					...symbolLimitations(state, multiProgram),
					...(typeRequested ? typeLimitations(state, multiProgram) : [])
				])
				.map((limitation) => [limitationKey(limitation), limitation])
		).values()
	].sort((left, right) => compare(limitationKey(left), limitationKey(right)));
	const tsProjectPartial = states.some(
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
	const tsSyntaxPartial = states.some(
		(state) =>
			state.raw.project.partialityReasons.some((reason) => reason.capability === 'TS_SYNTAX') ||
			state.raw.project.frameworkCandidates.length > 0
	);
	const tsSymbolPartial = states.some((state) => symbolLimitations(state, multiProgram).length > 0);
	const tsTypePartial =
		typeRequested && states.some((state) => typeLimitations(state, multiProgram).length > 0);
	const capabilities: SemanticCapabilityRecord[] = CAPABILITIES.map((capability) => ({
		capability,
		reason:
			capability === 'TS_PROJECT'
				? 'Project, Program, source-membership, compiler-context, and diagnostic facts are implemented by Slice 3A.'
				: capability === 'TS_SYNTAX'
					? 'Public TypeScript AST, declaration-candidate, literal, invocation, and assignment facts are implemented by Slice 3A.'
					: capability === 'TS_SYMBOL'
						? 'Public TypeScript lexical-scope plus TypeChecker declaration, symbol, alias, reference, import/export, and module-resolution facts are implemented by the current DWP-003 increment.'
						: typeRequested
							? 'Public TypeChecker type, type-parameter, Signature, overload, type-relation, and requested assignability facts were extracted in their exact Program contexts.'
							: 'TS_TYPE was not requested; no type facts or checker judgments were emitted.',
		state:
			capability === 'TS_PROJECT'
				? tsProjectPartial
					? 'PARTIAL'
					: 'SUPPORTED'
				: capability === 'TS_SYNTAX'
					? tsSyntaxPartial
						? 'PARTIAL'
						: 'SUPPORTED'
					: capability === 'TS_SYMBOL'
						? tsSymbolPartial
							? 'PARTIAL'
							: 'SUPPORTED'
						: typeRequested
							? tsTypePartial
								? 'PARTIAL'
								: 'SUPPORTED'
							: 'UNSUPPORTED'
	}));

	const frameworkMembers = sortedUnique(
		projects.flatMap((project) =>
			project.frameworkCandidates.map((candidate) => `${project.id}\0${candidate}`)
		)
	);
	const populationValues: Readonly<Record<SemanticPopulationKind, SemanticPopulationMembers>> = {
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
		FRAMEWORK_CANDIDATE: members(frameworkMembers, [], frameworkMembers),
		CONTEXT_INPUT: members(
			[],
			compilerInputs.map((record) => record.id)
		)
	};
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
