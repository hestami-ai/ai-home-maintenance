import { createHash } from 'node:crypto';
import ts from 'typescript';
import {
	SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
	SEMANTIC_TYPE_DISPLAY_PROFILE,
	SEMANTIC_TYPE_FINGERPRINT_PROFILE,
	type SemanticAssignabilityRequest,
	type SemanticOverloadMembershipRole,
	type SemanticSignatureDeclarationRole,
	type SemanticSignatureKind,
	type SemanticSignatureSemanticKind,
	type SemanticTypeCategory,
	type SemanticTypeIdentityBasis,
	type SemanticTypeQueryMode
} from '../../contracts/semantic.js';
import {
	canonicalSemanticJson,
	encodeSemanticDiagnosticText,
	isUnicodeScalarString
} from '../../semantic/canonical.js';
import type {
	RawSemanticOverloadSet,
	RawSemanticSignature,
	RawSemanticSignatureParameter,
	RawSemanticType,
	RawSemanticTypeAcquisitionAnchor,
	RawSemanticTypeParameter,
	RawSemanticTypeRelation,
	RawSemanticTypeSubjectRef
} from '../../semantic/raw-semantic-model.js';

export interface TypeScriptTypeExtractionGuard {
	readonly addFact: () => void;
	readonly check: () => void;
	readonly query: <T>(key: string, action: () => T) => T;
}

export interface TypeScriptTypeNodeAnchor {
	readonly nodeOrdinal: number;
	readonly sourceOrdinal: number;
}

export interface TypeScriptTypeDeclarationBridge {
	readonly declaration: ts.Declaration;
	readonly declarationOrdinal: number;
}

export interface TypeScriptTypeSymbolBridge {
	readonly declarations: readonly TypeScriptTypeDeclarationBridge[];
	readonly flags: number;
	readonly representatives: readonly ts.Symbol[];
	readonly symbolOrdinal: number;
}

export interface TypeScriptTypeSourceBridge {
	readonly logicalPath: string;
	readonly nodes: readonly ts.Node[] | null;
	readonly sourceFile: ts.SourceFile;
	readonly sourceOrdinal: number;
}

export interface ExtractTypeScriptTypesInput {
	readonly assignabilityRequests: readonly SemanticAssignabilityRequest[];
	readonly checker: ts.TypeChecker;
	readonly declarations: readonly TypeScriptTypeDeclarationBridge[];
	readonly guard: TypeScriptTypeExtractionGuard;
	readonly nodeAnchorForNode: (node: ts.Node) => TypeScriptTypeNodeAnchor | null;
	readonly projectKey: string;
	readonly resolveCheckerContextDigest: () => string;
	readonly sources: readonly TypeScriptTypeSourceBridge[];
	readonly symbols: readonly TypeScriptTypeSymbolBridge[];
}

export interface RawTypeScriptTypeProjection {
	readonly overloadSets: readonly RawSemanticOverloadSet[];
	readonly signatureParameters: readonly RawSemanticSignatureParameter[];
	readonly signatures: readonly RawSemanticSignature[];
	readonly typeParameters: readonly RawSemanticTypeParameter[];
	readonly typeRelations: readonly RawSemanticTypeRelation[];
	readonly types: readonly RawSemanticType[];
}

type RootTypeAnchor = Extract<
	RawSemanticTypeAcquisitionAnchor,
	{ readonly kind: 'NODE' | 'DECLARATION' | 'SYMBOL' }
>;

interface PendingTypeComponentAnchor {
	readonly componentKind: 'UNION' | 'INTERSECTION' | 'GENERIC_TARGET' | 'TYPE_ARGUMENT';
	readonly componentOrdinal: number;
	readonly kind: 'TYPE_COMPONENT';
	readonly parent: PendingType;
}

interface PendingSignatureComponentAnchor {
	readonly componentKind: 'THIS' | 'PARAMETER' | 'RETURN' | 'TYPE_PARAMETER';
	readonly componentOrdinal: number;
	readonly kind: 'SIGNATURE_COMPONENT';
	readonly signature: PendingSignature;
}

type PendingTypeAnchor =
	RootTypeAnchor | PendingTypeComponentAnchor | PendingSignatureComponentAnchor;

interface PendingType {
	readonly acquisitionAnchors: Map<string, PendingTypeAnchor>;
	aliasSymbolOrdinal: number | null;
	category: SemanticTypeCategory | null;
	constraint: PendingType | null;
	defaultType: PendingType | null;
	readonly discoveryOrdinal: number;
	display: string;
	displaySha256: string;
	fingerprintInput: string;
	fingerprintSha256: string;
	flagNames: readonly string[];
	flags: number;
	genericArguments: readonly PendingType[];
	genericTarget: PendingType | null;
	intersectionConstituents: readonly PendingType[];
	objectFlagNames: readonly string[];
	objectFlags: number | null;
	processed: boolean;
	readonly queryAnchors: Set<string>;
	symbolOrdinal: number | null;
	readonly type: ts.Type;
	typeParameterBoundsLoaded: boolean;
	typeOrdinal: number;
	unionConstituents: readonly PendingType[];
	unsupportedStructureKinds: readonly string[];
}

type PendingSignatureOwner =
	| { readonly kind: 'TYPE'; readonly type: PendingType }
	| { readonly kind: 'SYMBOL'; readonly symbolOrdinal: number }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };

interface PendingSignatureAcquisition {
	readonly declaration: TypeScriptTypeDeclarationBridge | null;
	readonly key: string;
	readonly owner: PendingSignatureOwner;
	readonly providerOrdinal: number | null;
	readonly signatureKind: SemanticSignatureKind;
}

interface PendingSignature {
	readonly acquisitions: Map<string, PendingSignatureAcquisition>;
	declaration: TypeScriptTypeDeclarationBridge | null;
	declarationRole: SemanticSignatureDeclarationRole;
	readonly discoveryOrdinal: number;
	display: string;
	displaySha256: string;
	fingerprintInput: string;
	fingerprintSha256: string;
	identityDeclaration: TypeScriptTypeDeclarationBridge | null;
	parameterRecords: readonly PendingSignatureParameter[];
	processed: boolean;
	returnType: PendingType | null;
	semanticKind: SemanticSignatureSemanticKind;
	readonly signature: ts.Signature;
	signatureKind: SemanticSignatureKind | null;
	signatureOrdinal: number;
	typeParameterRecords: readonly PendingTypeParameter[];
}

type PendingTypeParameterOwner =
	| { readonly kind: 'TYPE'; readonly type: PendingType }
	| { readonly kind: 'SIGNATURE'; readonly signature: PendingSignature }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };

interface PendingTypeParameter {
	readonly declarationOrdinal: number | null;
	readonly explicitConstraint: boolean;
	readonly explicitDefault: boolean;
	readonly key: string;
	readonly name: string;
	readonly ordinal: number;
	readonly owner: PendingTypeParameterOwner;
	readonly parameterType: PendingType;
	typeParameterOrdinal: number;
}

interface PendingSignatureParameter {
	readonly declarationOrdinal: number | null;
	readonly name: string;
	readonly optional: boolean;
	readonly ordinal: number;
	readonly rest: boolean;
	readonly role: 'THIS' | 'PARAMETER';
	readonly signature: PendingSignature;
	readonly symbolOrdinal: number | null;
	readonly type: PendingType;
	signatureParameterOrdinal: number;
}

interface PendingOverloadMember {
	readonly declaration: TypeScriptTypeDeclarationBridge;
	readonly implementation: boolean;
	readonly signature: PendingSignature;
}

interface PendingOverloadSet {
	readonly callableSymbolOrdinal: number;
	readonly members: readonly PendingOverloadMember[];
	overloadSetOrdinal: number;
}

interface PendingTypeOfRelation {
	readonly kind: 'TYPE_OF';
	readonly queryMode: SemanticTypeQueryMode;
	readonly subject: RawSemanticTypeSubjectRef;
	readonly type: PendingType;
}

interface PendingTypeAliasRelation {
	readonly aliasDeclarationOrdinal: number;
	readonly aliasedType: PendingType;
	readonly kind: 'TYPE_ALIAS';
}

interface PendingTypeConstituentRelation {
	readonly compositeType: PendingType;
	readonly constituentType: PendingType;
	readonly kind: 'UNION_CONSTITUENT' | 'INTERSECTION_CONSTITUENT';
	readonly ordinal: number;
}

interface PendingGenericInstantiationRelation {
	readonly argumentTypes: readonly PendingType[];
	readonly genericTarget: PendingType;
	readonly instantiatedTarget: PendingType;
	readonly kind: 'GENERIC_INSTANTIATION';
}

interface PendingHeritageRelation {
	readonly baseType: PendingType;
	readonly derivedType: PendingType;
	readonly heritageOccurrence:
		| { readonly kind: 'AST_NODE'; readonly nodeOrdinal: number; readonly sourceOrdinal: number }
		| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };
	readonly kind: 'TYPE_EXTENSION' | 'TYPE_IMPLEMENTATION';
}

interface PendingAssignabilityRelation {
	readonly kind: 'ASSIGNABILITY';
	readonly requestId: string;
	readonly result: boolean | null;
	readonly sourceType: PendingType | null;
	readonly targetType: PendingType | null;
}

type PendingRelation =
	| PendingTypeOfRelation
	| PendingTypeAliasRelation
	| PendingTypeConstituentRelation
	| PendingGenericInstantiationRelation
	| PendingHeritageRelation
	| PendingAssignabilityRelation;

type WithoutRelationOrdinal<T> = T extends unknown ? Omit<T, 'relationOrdinal'> : never;
type UnnumberedRawTypeRelation = WithoutRelationOrdinal<RawSemanticTypeRelation>;

function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function representableText(value: string): string {
	if (isUnicodeScalarString(value)) return value;
	return `utf16-code-units:${encodeSemanticDiagnosticText(value).text}`;
}

function flagNames(flags: number, values: object): readonly string[] {
	const names = new Set<string>();
	for (const [name, value] of Object.entries(values)) {
		if (
			typeof value !== 'number' ||
			value <= 0 ||
			(value & (value - 1)) !== 0 ||
			(flags & value) === 0
		)
			continue;
		names.add(name);
	}
	return [...names].sort(compareStrings);
}

function typeCategory(flags: number): SemanticTypeCategory {
	if ((flags & ts.TypeFlags.Literal) !== 0) return 'LITERAL';
	if ((flags & ts.TypeFlags.Union) !== 0) return 'UNION';
	if ((flags & ts.TypeFlags.Intersection) !== 0) return 'INTERSECTION';
	if ((flags & ts.TypeFlags.TypeParameter) !== 0) return 'TYPE_PARAMETER';
	if ((flags & ts.TypeFlags.Object) !== 0) return 'OBJECT';
	if ((flags & ts.TypeFlags.Index) !== 0) return 'INDEX';
	if (
		(flags &
			(ts.TypeFlags.Any |
				ts.TypeFlags.Unknown |
				ts.TypeFlags.String |
				ts.TypeFlags.Number |
				ts.TypeFlags.Boolean |
				ts.TypeFlags.ESSymbol |
				ts.TypeFlags.BigInt |
				ts.TypeFlags.Void |
				ts.TypeFlags.Undefined |
				ts.TypeFlags.Null |
				ts.TypeFlags.Never |
				ts.TypeFlags.NonPrimitive)) !==
		0
	)
		return 'INTRINSIC';
	return 'OTHER';
}

function unsupportedStructureKinds(flags: number, objectFlags: number | null): readonly string[] {
	const unsupported = new Set<string>();
	if ((flags & ts.TypeFlags.Conditional) !== 0) unsupported.add('CONDITIONAL');
	if ((flags & ts.TypeFlags.IndexedAccess) !== 0) unsupported.add('INDEXED_ACCESS');
	if ((flags & ts.TypeFlags.Index) !== 0) unsupported.add('INDEX_TARGET');
	if ((flags & ts.TypeFlags.Substitution) !== 0) unsupported.add('SUBSTITUTION');
	if ((flags & ts.TypeFlags.TemplateLiteral) !== 0) unsupported.add('TEMPLATE_LITERAL');
	if ((flags & ts.TypeFlags.StringMapping) !== 0) unsupported.add('STRING_MAPPING');
	if (objectFlags !== null && (objectFlags & ts.ObjectFlags.Mapped) !== 0)
		unsupported.add('MAPPED');
	return [...unsupported].sort(compareStrings);
}

function declarationTypeNode(declaration: ts.Declaration): ts.TypeNode | null {
	const candidate = (declaration as ts.Declaration & { readonly type?: ts.TypeNode }).type;
	return candidate !== undefined && ts.isTypeNode(candidate) ? candidate : null;
}

function declarationTypeParameters(
	declaration: ts.Declaration
): readonly ts.TypeParameterDeclaration[] {
	return (
		(
			declaration as ts.Declaration & {
				readonly typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>;
			}
		).typeParameters ?? []
	);
}

function signatureKindForDeclaration(declaration: ts.Declaration): SemanticSignatureKind | null {
	if (
		ts.isConstructorDeclaration(declaration) ||
		ts.isConstructSignatureDeclaration(declaration) ||
		ts.isConstructorTypeNode(declaration)
	)
		return 'CONSTRUCT';
	if (
		ts.isFunctionDeclaration(declaration) ||
		ts.isFunctionExpression(declaration) ||
		ts.isArrowFunction(declaration) ||
		ts.isMethodDeclaration(declaration) ||
		ts.isMethodSignature(declaration) ||
		ts.isCallSignatureDeclaration(declaration) ||
		ts.isFunctionTypeNode(declaration)
	)
		return 'CALL';
	return null;
}

function isAmbientDeclaration(declaration: ts.Declaration): boolean {
	if (declaration.getSourceFile().isDeclarationFile) return true;
	let cursor: ts.Node | undefined = declaration;
	while (cursor !== undefined) {
		if (
			ts.canHaveModifiers(cursor) &&
			ts.getModifiers(cursor)?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
		)
			return true;
		cursor = cursor.parent;
	}
	return false;
}

function declarationRole(
	declaration: ts.Declaration | null,
	overloaded: boolean,
	implementation: boolean
): SemanticSignatureDeclarationRole {
	if (declaration === null) return 'UNKNOWN';
	if (ts.isCallSignatureDeclaration(declaration)) return 'CALL_SIGNATURE';
	if (ts.isConstructSignatureDeclaration(declaration)) return 'CONSTRUCT_SIGNATURE';
	if (!overloaded || implementation) return 'DECLARATION';
	return isAmbientDeclaration(declaration) ? 'AMBIENT_OVERLOAD' : 'OVERLOAD_DECLARATION';
}

function overloadMembershipRole(
	declaration: ts.Declaration,
	implementation: boolean
): SemanticOverloadMembershipRole {
	if (implementation) return 'IMPLEMENTATION_SIGNATURE';
	if (ts.isCallSignatureDeclaration(declaration)) return 'CALL_SIGNATURE';
	if (ts.isConstructSignatureDeclaration(declaration)) return 'CONSTRUCT_SIGNATURE';
	return isAmbientDeclaration(declaration) ? 'AMBIENT_OVERLOAD' : 'OVERLOAD_DECLARATION';
}

function typeParameterName(
	declaration: ts.TypeParameterDeclaration | null,
	compilerName: string | null
): string {
	const name = declaration?.name.text ?? compilerName ?? '<anonymous-type-parameter>';
	return representableText(name);
}

interface DisplayPathReplacement {
	readonly absolute: string;
	readonly logical: string;
}

interface SelectorNodeBinding {
	readonly node: ts.Node;
	readonly nodeOrdinal: number;
	readonly sourceOrdinal: number;
}

interface SignatureParameterInput {
	readonly fallback: ts.ParameterDeclaration | null;
	readonly ordinal: number;
	readonly role: 'THIS' | 'PARAMETER';
	readonly symbol: ts.Symbol;
}

interface DeclarationBridgeIndex {
	readonly declarationByNode: WeakMap<ts.Declaration, TypeScriptTypeDeclarationBridge>;
	readonly declarationByOrdinal: Map<number, TypeScriptTypeDeclarationBridge>;
}

/**
 * Working state for a single extraction. It is threaded by reference through the
 * extraction helpers so that discovery counters and accumulators survive.
 */
interface TypeExtractionState {
	readonly canonicalSignatureByDeclaration: Map<number, ts.Signature | undefined>;
	readonly checker: ts.TypeChecker;
	readonly declarationByNode: WeakMap<ts.Declaration, TypeScriptTypeDeclarationBridge>;
	readonly displayPathReplacements: readonly DisplayPathReplacement[];
	readonly guard: TypeScriptTypeExtractionGuard;
	readonly input: ExtractTypeScriptTypesInput;
	nextSignatureDiscoveryOrdinal: number;
	nextTypeDiscoveryOrdinal: number;
	readonly overloadEntriesBySymbol: Map<number, PendingOverloadMember[]>;
	readonly overloadImplementationByDeclaration: Map<number, boolean>;
	readonly pendingRelations: PendingRelation[];
	readonly pendingSignatures: PendingSignature[];
	readonly pendingSignaturesByObject: Map<ts.Signature, PendingSignature>;
	readonly pendingTypeOfKeys: Set<string>;
	readonly pendingTypeParameters: Map<string, PendingTypeParameter>;
	readonly pendingTypes: PendingType[];
	readonly pendingTypesByObject: Map<ts.Type, PendingType>;
	readonly selectorNodes: Map<string, SelectorNodeBinding | null>;
	readonly selectorTypeCache: Map<string, PendingType | null>;
	readonly symbolOrdinalBySymbol: Map<ts.Symbol, number>;
}

function indexDeclarationBridges(input: ExtractTypeScriptTypesInput): DeclarationBridgeIndex {
	const declarationByNode = new WeakMap<ts.Declaration, TypeScriptTypeDeclarationBridge>();
	const declarationByOrdinal = new Map<number, TypeScriptTypeDeclarationBridge>();
	for (const bridge of [...input.declarations].sort(
		(left, right) => left.declarationOrdinal - right.declarationOrdinal
	)) {
		const existing = declarationByOrdinal.get(bridge.declarationOrdinal);
		if (existing !== undefined && existing.declaration !== bridge.declaration)
			throw new Error('Type extraction received duplicate declaration identity.');
		declarationByOrdinal.set(bridge.declarationOrdinal, bridge);
		declarationByNode.set(bridge.declaration, bridge);
	}
	return { declarationByNode, declarationByOrdinal };
}

function indexSymbolBridge(
	symbol: TypeScriptTypeSymbolBridge,
	symbolOrdinalBySymbol: Map<ts.Symbol, number>,
	declarationByOrdinal: ReadonlyMap<number, TypeScriptTypeDeclarationBridge>
): void {
	for (const representative of symbol.representatives) {
		const existing = symbolOrdinalBySymbol.get(representative);
		if (existing !== undefined && existing !== symbol.symbolOrdinal)
			throw new Error('Type extraction received a symbol in multiple canonical groups.');
		symbolOrdinalBySymbol.set(representative, symbol.symbolOrdinal);
	}
	for (const bridge of symbol.declarations) {
		const canonical = declarationByOrdinal.get(bridge.declarationOrdinal);
		if (canonical?.declaration !== bridge.declaration)
			throw new Error('Type extraction symbol bridge lacks its canonical declaration.');
	}
}

function indexSymbolBridges(
	input: ExtractTypeScriptTypesInput,
	declarationByOrdinal: ReadonlyMap<number, TypeScriptTypeDeclarationBridge>
): Map<ts.Symbol, number> {
	const symbolOrdinalBySymbol = new Map<ts.Symbol, number>();
	for (const symbol of [...input.symbols].sort(
		(left, right) => left.symbolOrdinal - right.symbolOrdinal
	))
		indexSymbolBridge(symbol, symbolOrdinalBySymbol, declarationByOrdinal);
	return symbolOrdinalBySymbol;
}

const extensionPattern = /(?:\.d\.(?:cts|mts|ts)|\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx))$/iu;
const importSpecifierPattern = /\bimport\((["'])([^"']*)\1\)/gu;

function withoutSourceExtension(value: string): string {
	return value.replace(extensionPattern, '');
}

function isAbsoluteImportSpecifier(value: string): boolean {
	return /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/u.test(value);
}

function registerDisplayPathVariants(
	source: TypeScriptTypeSourceBridge,
	replacementByAbsolute: Map<string, string>
): void {
	const forwardAbsolute = source.sourceFile.fileName.replaceAll('\\', '/');
	const forwardLogical = source.logicalPath.replaceAll('\\', '/');
	const variants = [
		[forwardAbsolute, forwardLogical],
		[withoutSourceExtension(forwardAbsolute), withoutSourceExtension(forwardLogical)],
		[forwardAbsolute.replaceAll('/', '\\'), forwardLogical],
		[
			withoutSourceExtension(forwardAbsolute).replaceAll('/', '\\'),
			withoutSourceExtension(forwardLogical)
		]
	] as const;
	for (const [absolute, logical] of variants) {
		if (absolute === logical) continue;
		const existing = replacementByAbsolute.get(absolute);
		if (existing !== undefined && existing !== logical)
			throw new Error('Type display canonicalization received an ambiguous source path.');
		replacementByAbsolute.set(absolute, logical);
	}
}

function buildDisplayPathReplacements(
	input: ExtractTypeScriptTypesInput
): readonly DisplayPathReplacement[] {
	const replacementByAbsolute = new Map<string, string>();
	for (const source of input.sources) registerDisplayPathVariants(source, replacementByAbsolute);
	return [...replacementByAbsolute.entries()]
		.map(([absolute, logical]) => ({ absolute, logical }))
		.sort(
			(left, right) =>
				right.absolute.length - left.absolute.length ||
				compareStrings(left.absolute, right.absolute) ||
				compareStrings(left.logical, right.logical)
		);
}

function canonicalDisplay(state: TypeExtractionState, value: string): string {
	const canonical = value.replace(
		importSpecifierPattern,
		(_match, quote: string, specifier: string) => {
			const replacement = state.displayPathReplacements.find(
				(candidate) => candidate.absolute === specifier
			);
			if (replacement !== undefined) return `import(${quote}${replacement.logical}${quote})`;
			if (isAbsoluteImportSpecifier(specifier))
				throw new Error('Type display contains an unmapped absolute import specifier.');
			return `import(${quote}${specifier}${quote})`;
		}
	);
	for (const match of canonical.matchAll(importSpecifierPattern))
		if (isAbsoluteImportSpecifier(match[2]!))
			throw new Error('Type display retained an absolute import specifier.');
	return representableText(canonical);
}

function runQuery<T>(
	state: TypeExtractionState,
	kind: string,
	discriminator: string,
	action: () => T
): T {
	state.guard.check();
	const result = state.guard.query(
		`${state.input.projectKey}\0type\0${kind}\0${sha256(discriminator)}`,
		action
	);
	state.guard.check();
	return result;
}

function selectorNodeKey(selector: {
	readonly end: number;
	readonly logicalPath: string;
	readonly start: number;
	readonly syntaxKind: number;
}): string {
	return canonicalSemanticJson({
		end: selector.end,
		logicalPath: selector.logicalPath,
		start: selector.start,
		syntaxKind: selector.syntaxKind
	});
}

function indexSelectorNodesForSource(
	state: TypeExtractionState,
	source: TypeScriptTypeSourceBridge
): void {
	for (let nodeOrdinal = 0; nodeOrdinal < (source.nodes?.length ?? 0); nodeOrdinal += 1) {
		state.guard.check();
		const node = source.nodes![nodeOrdinal]!;
		const start = node.getStart(source.sourceFile, false);
		const end = node.end;
		if (
			!Number.isSafeInteger(start) ||
			!Number.isSafeInteger(end) ||
			start < 0 ||
			start > end ||
			end > source.sourceFile.text.length
		)
			throw new Error('Type selector indexing encountered an invalid public AST span.');
		const key = selectorNodeKey({
			end,
			logicalPath: source.logicalPath,
			start,
			syntaxKind: node.kind
		});
		state.selectorNodes.set(
			key,
			state.selectorNodes.has(key)
				? null
				: { node, nodeOrdinal, sourceOrdinal: source.sourceOrdinal }
		);
	}
}

function indexSelectorNodes(state: TypeExtractionState): void {
	for (const source of [...state.input.sources].sort((left, right) =>
		compareStrings(left.logicalPath, right.logicalPath)
	))
		indexSelectorNodesForSource(state, source);
}

function createTypeExtractionState(input: ExtractTypeScriptTypesInput): TypeExtractionState {
	input.guard.check();
	const { declarationByNode, declarationByOrdinal } = indexDeclarationBridges(input);
	const symbolOrdinalBySymbol = indexSymbolBridges(input, declarationByOrdinal);
	const state: TypeExtractionState = {
		canonicalSignatureByDeclaration: new Map(),
		checker: input.checker,
		declarationByNode,
		displayPathReplacements: buildDisplayPathReplacements(input),
		guard: input.guard,
		input,
		nextSignatureDiscoveryOrdinal: 0,
		nextTypeDiscoveryOrdinal: 0,
		overloadEntriesBySymbol: new Map(),
		overloadImplementationByDeclaration: new Map(),
		pendingRelations: [],
		pendingSignatures: [],
		pendingSignaturesByObject: new Map(),
		pendingTypeOfKeys: new Set(),
		pendingTypeParameters: new Map(),
		pendingTypes: [],
		pendingTypesByObject: new Map(),
		selectorNodes: new Map(),
		selectorTypeCache: new Map(),
		symbolOrdinalBySymbol
	};
	indexSelectorNodes(state);
	return state;
}

function anchorKey(anchor: PendingTypeAnchor): string {
	switch (anchor.kind) {
		case 'NODE':
		case 'DECLARATION':
		case 'SYMBOL':
			return canonicalSemanticJson(anchor);
		case 'TYPE_COMPONENT':
			return canonicalSemanticJson({
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: anchor.kind,
				parentDiscoveryOrdinal: anchor.parent.discoveryOrdinal
			});
		case 'SIGNATURE_COMPONENT':
			return canonicalSemanticJson({
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: anchor.kind,
				signatureDiscoveryOrdinal: anchor.signature.discoveryOrdinal
			});
	}
}

function discoverType(
	state: TypeExtractionState,
	type: ts.Type,
	anchor: PendingTypeAnchor
): PendingType {
	state.guard.check();
	let pending = state.pendingTypesByObject.get(type);
	if (pending === undefined) {
		pending = {
			acquisitionAnchors: new Map(),
			aliasSymbolOrdinal: null,
			category: null,
			constraint: null,
			defaultType: null,
			discoveryOrdinal: state.nextTypeDiscoveryOrdinal++,
			display: '',
			displaySha256: '',
			fingerprintInput: '',
			fingerprintSha256: '',
			flagNames: [],
			flags: 0,
			genericArguments: [],
			genericTarget: null,
			intersectionConstituents: [],
			objectFlagNames: [],
			objectFlags: null,
			processed: false,
			queryAnchors: new Set(),
			symbolOrdinal: null,
			type,
			typeParameterBoundsLoaded: false,
			typeOrdinal: -1,
			unionConstituents: [],
			unsupportedStructureKinds: []
		};
		state.pendingTypesByObject.set(type, pending);
		state.pendingTypes.push(pending);
	}
	const key = anchorKey(anchor);
	pending.acquisitionAnchors.set(key, anchor);
	pending.queryAnchors.add(key);
	return pending;
}

function addTypeOf(
	state: TypeExtractionState,
	subject: RawSemanticTypeSubjectRef,
	queryMode: SemanticTypeQueryMode,
	type: PendingType
): void {
	const key = canonicalSemanticJson({ kind: 'TYPE_OF', queryMode, subject });
	if (state.pendingTypeOfKeys.has(key)) return;
	state.pendingTypeOfKeys.add(key);
	state.pendingRelations.push({ kind: 'TYPE_OF', queryMode, subject, type });
}

function selectorTypeObject(
	state: TypeExtractionState,
	selector: SemanticAssignabilityRequest['source'],
	binding: SelectorNodeBinding,
	cacheKey: string
): ts.Type | null {
	switch (selector.queryMode) {
		case 'TYPE_AT_LOCATION':
			return runQuery(state, 'selector-type-at-location', cacheKey, () =>
				state.checker.getTypeAtLocation(binding.node)
			);
		case 'TYPE_FROM_TYPE_NODE':
			if (!ts.isTypeNode(binding.node)) return null;
			return runQuery(state, 'selector-type-from-node', cacheKey, () =>
				state.checker.getTypeFromTypeNode(binding.node as ts.TypeNode)
			);
		case 'DECLARED_SYMBOL_TYPE': {
			const symbol = runQuery(state, 'selector-declared-symbol', cacheKey, () =>
				state.checker.getSymbolAtLocation(binding.node)
			);
			if (symbol === undefined) return null;
			return runQuery(state, 'selector-declared-symbol-type', cacheKey, () =>
				state.checker.getDeclaredTypeOfSymbol(symbol)
			);
		}
		case 'VALUE_SYMBOL_TYPE_AT_LOCATION': {
			const symbol = runQuery(state, 'selector-value-symbol', cacheKey, () =>
				state.checker.getSymbolAtLocation(binding.node)
			);
			if (symbol === undefined) return null;
			return runQuery(state, 'selector-value-symbol-type', cacheKey, () =>
				state.checker.getTypeOfSymbolAtLocation(symbol, binding.node)
			);
		}
	}
}

function resolveSelectorType(
	state: TypeExtractionState,
	selector: SemanticAssignabilityRequest['source']
): PendingType | null {
	const cacheKey = canonicalSemanticJson(selector);
	if (state.selectorTypeCache.has(cacheKey)) return state.selectorTypeCache.get(cacheKey) ?? null;
	const binding = state.selectorNodes.get(selectorNodeKey(selector));
	if (binding === undefined || binding === null) {
		state.selectorTypeCache.set(cacheKey, null);
		return null;
	}
	const type = selectorTypeObject(state, selector, binding, cacheKey);
	if (type === null) {
		state.selectorTypeCache.set(cacheKey, null);
		return null;
	}
	const pending = discoverType(state, type, {
		kind: 'NODE',
		nodeOrdinal: binding.nodeOrdinal,
		queryMode: selector.queryMode,
		sourceOrdinal: binding.sourceOrdinal
	});
	addTypeOf(
		state,
		{
			kind: 'AST_NODE',
			nodeOrdinal: binding.nodeOrdinal,
			sourceOrdinal: binding.sourceOrdinal
		},
		selector.queryMode,
		pending
	);
	state.selectorTypeCache.set(cacheKey, pending);
	return pending;
}

function collectAssignabilityRelation(
	state: TypeExtractionState,
	request: SemanticAssignabilityRequest
): void {
	state.guard.check();
	const sourceType = resolveSelectorType(state, request.source);
	const targetType = resolveSelectorType(state, request.target);
	const result =
		sourceType === null || targetType === null
			? null
			: runQuery(state, 'assignability', canonicalSemanticJson(request), () =>
					state.checker.isTypeAssignableTo(sourceType.type, targetType.type)
				);
	state.pendingRelations.push({
		kind: 'ASSIGNABILITY',
		requestId: request.requestId,
		result,
		sourceType,
		targetType
	});
}

function collectAssignabilityRelations(state: TypeExtractionState): void {
	for (const request of state.input.assignabilityRequests)
		collectAssignabilityRelation(state, request);
}

function discoverSignature(
	state: TypeExtractionState,
	signature: ts.Signature,
	acquisition: PendingSignatureAcquisition
): PendingSignature {
	state.guard.check();
	let pending = state.pendingSignaturesByObject.get(signature);
	if (pending === undefined) {
		pending = {
			acquisitions: new Map(),
			declaration: null,
			declarationRole: 'UNKNOWN',
			discoveryOrdinal: state.nextSignatureDiscoveryOrdinal++,
			display: '',
			displaySha256: '',
			fingerprintInput: '',
			fingerprintSha256: '',
			identityDeclaration: null,
			parameterRecords: [],
			processed: false,
			returnType: null,
			semanticKind: 'SIGNATURE',
			signature,
			signatureKind: null,
			signatureOrdinal: -1,
			typeParameterRecords: []
		};
		state.pendingSignaturesByObject.set(signature, pending);
		state.pendingSignatures.push(pending);
	}
	if (pending.signatureKind !== null && pending.signatureKind !== acquisition.signatureKind)
		throw new Error('A public TypeScript Signature was observed as both call and construct.');
	pending.signatureKind = acquisition.signatureKind;
	pending.acquisitions.set(acquisition.key, acquisition);
	if (acquisition.declaration !== null)
		observeSignatureDeclaration(state, pending, acquisition.declaration);
	return pending;
}

function canonicalSignatureForDeclaration(
	state: TypeExtractionState,
	declaration: TypeScriptTypeDeclarationBridge
): ts.Signature | undefined {
	if (state.canonicalSignatureByDeclaration.has(declaration.declarationOrdinal))
		return state.canonicalSignatureByDeclaration.get(declaration.declarationOrdinal);
	const signature = runQuery(
		state,
		'signature-from-declaration',
		String(declaration.declarationOrdinal),
		() =>
			state.checker.getSignatureFromDeclaration(declaration.declaration as ts.SignatureDeclaration)
	);
	state.canonicalSignatureByDeclaration.set(declaration.declarationOrdinal, signature);
	return signature;
}

function observeSignatureDeclaration(
	state: TypeExtractionState,
	pending: PendingSignature,
	declaration: TypeScriptTypeDeclarationBridge
): void {
	if (
		pending.declaration === null ||
		declaration.declarationOrdinal < pending.declaration.declarationOrdinal
	)
		pending.declaration = declaration;
	if (
		canonicalSignatureForDeclaration(state, declaration) === pending.signature &&
		(pending.identityDeclaration === null ||
			declaration.declarationOrdinal < pending.identityDeclaration.declarationOrdinal)
	)
		pending.identityDeclaration = declaration;
}

function overloadImplementation(
	state: TypeExtractionState,
	declaration: TypeScriptTypeDeclarationBridge
): boolean {
	const existing = state.overloadImplementationByDeclaration.get(declaration.declarationOrdinal);
	if (existing !== undefined) return existing;
	const implementation =
		runQuery(state, 'overload-implementation', String(declaration.declarationOrdinal), () =>
			state.checker.isImplementationOfOverload(declaration.declaration as ts.SignatureDeclaration)
		) === true;
	state.overloadImplementationByDeclaration.set(declaration.declarationOrdinal, implementation);
	return implementation;
}

function addOverloadEntry(
	state: TypeExtractionState,
	callableSymbolOrdinal: number,
	declaration: TypeScriptTypeDeclarationBridge,
	signature: PendingSignature
): void {
	if (signature.identityDeclaration?.declarationOrdinal !== declaration.declarationOrdinal)
		throw new Error('An overload member must use the canonical declaration Signature.');
	const entries = state.overloadEntriesBySymbol.get(callableSymbolOrdinal) ?? [];
	entries.push({
		declaration,
		implementation: overloadImplementation(state, declaration),
		signature
	});
	state.overloadEntriesBySymbol.set(callableSymbolOrdinal, entries);
}

function pendingTypeParameterOwnerKey(owner: PendingTypeParameterOwner): string {
	switch (owner.kind) {
		case 'TYPE':
			return `TYPE:${String(owner.type.discoveryOrdinal)}`;
		case 'SIGNATURE':
			return `SIGNATURE:${String(owner.signature.discoveryOrdinal)}`;
		case 'DECLARATION':
			return `DECLARATION:${String(owner.declarationOrdinal)}`;
	}
}

function loadTypeParameterBounds(state: TypeExtractionState, parameterType: PendingType): void {
	if (parameterType.typeParameterBoundsLoaded) return;
	parameterType.typeParameterBoundsLoaded = true;
	const key = String(parameterType.discoveryOrdinal);
	const constraint = runQuery(state, 'type-parameter-constraint', key, () =>
		state.checker.getBaseConstraintOfType(parameterType.type)
	);
	const defaultType = runQuery(state, 'type-parameter-default', key, () =>
		state.checker.getDefaultFromTypeParameter(parameterType.type)
	);
	parameterType.constraint =
		constraint === undefined
			? null
			: discoverType(state, constraint, {
					componentKind: 'GENERIC_TARGET',
					componentOrdinal: 0,
					kind: 'TYPE_COMPONENT',
					parent: parameterType
				});
	parameterType.defaultType =
		defaultType === undefined
			? null
			: discoverType(state, defaultType, {
					componentKind: 'TYPE_ARGUMENT',
					componentOrdinal: 0,
					kind: 'TYPE_COMPONENT',
					parent: parameterType
				});
}

function addTypeParameter(
	state: TypeExtractionState,
	owner: PendingTypeParameterOwner,
	ordinal: number,
	parameterType: PendingType,
	declaration: ts.TypeParameterDeclaration | null
): PendingTypeParameter {
	const declarationBridge =
		declaration === null ? null : (state.declarationByNode.get(declaration) ?? null);
	const typeSymbol = runQuery(
		state,
		'type-parameter-symbol',
		`${pendingTypeParameterOwnerKey(owner)}\0${String(ordinal)}`,
		() => parameterType.type.getSymbol()
	);
	loadTypeParameterBounds(state, parameterType);
	const key = `${pendingTypeParameterOwnerKey(owner)}\0${String(ordinal)}\0${String(declarationBridge?.declarationOrdinal ?? -1)}`;
	const existing = state.pendingTypeParameters.get(key);
	if (existing !== undefined) return existing;
	const pending: PendingTypeParameter = {
		declarationOrdinal: declarationBridge?.declarationOrdinal ?? null,
		explicitConstraint: declaration?.constraint !== undefined,
		explicitDefault: declaration?.default !== undefined,
		key,
		name: typeParameterName(
			declaration,
			typeSymbol === undefined
				? null
				: runQuery(state, 'type-parameter-name', key, () => typeSymbol.getName())
		),
		ordinal,
		owner,
		parameterType,
		typeParameterOrdinal: -1
	};
	state.pendingTypeParameters.set(key, pending);
	return pending;
}

function collectDeclaredSymbolType(
	state: TypeExtractionState,
	symbol: TypeScriptTypeSymbolBridge,
	representative: ts.Symbol
): void {
	const type = runQuery(state, 'declared-symbol-type', String(symbol.symbolOrdinal), () =>
		state.checker.getDeclaredTypeOfSymbol(representative)
	);
	const pending = discoverType(state, type, {
		kind: 'SYMBOL',
		queryMode: 'DECLARED_SYMBOL_TYPE',
		symbolOrdinal: symbol.symbolOrdinal
	});
	addTypeOf(
		state,
		{ kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
		'DECLARED_SYMBOL_TYPE',
		pending
	);
}

function collectValueSymbolType(
	state: TypeExtractionState,
	symbol: TypeScriptTypeSymbolBridge,
	representative: ts.Symbol,
	location: ts.Declaration
): void {
	const type = runQuery(state, 'value-symbol-type', String(symbol.symbolOrdinal), () =>
		state.checker.getTypeOfSymbolAtLocation(representative, location)
	);
	const pending = discoverType(state, type, {
		kind: 'SYMBOL',
		queryMode: 'VALUE_SYMBOL_TYPE_AT_LOCATION',
		symbolOrdinal: symbol.symbolOrdinal
	});
	addTypeOf(
		state,
		{ kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
		'VALUE_SYMBOL_TYPE_AT_LOCATION',
		pending
	);
}

function collectDeclarationTypeNodeFacts(
	state: TypeExtractionState,
	bridge: TypeScriptTypeDeclarationBridge,
	declaration: ts.Declaration,
	typeNode: ts.TypeNode,
	declarationSubject: { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' }
): void {
	const explicitType = runQuery(
		state,
		'declaration-type-from-node',
		String(bridge.declarationOrdinal),
		() => state.checker.getTypeFromTypeNode(typeNode)
	);
	const nodeAnchor = state.input.nodeAnchorForNode(typeNode);
	const acquisition: RootTypeAnchor =
		nodeAnchor === null
			? {
					declarationOrdinal: bridge.declarationOrdinal,
					kind: 'DECLARATION',
					queryMode: 'TYPE_FROM_TYPE_NODE'
				}
			: {
					kind: 'NODE',
					nodeOrdinal: nodeAnchor.nodeOrdinal,
					queryMode: 'TYPE_FROM_TYPE_NODE',
					sourceOrdinal: nodeAnchor.sourceOrdinal
				};
	const pendingExplicitType = discoverType(state, explicitType, acquisition);
	addTypeOf(
		state,
		nodeAnchor === null
			? declarationSubject
			: {
					kind: 'AST_NODE',
					nodeOrdinal: nodeAnchor.nodeOrdinal,
					sourceOrdinal: nodeAnchor.sourceOrdinal
				},
		'TYPE_FROM_TYPE_NODE',
		pendingExplicitType
	);
	if (ts.isTypeAliasDeclaration(declaration))
		state.pendingRelations.push({
			aliasDeclarationOrdinal: bridge.declarationOrdinal,
			aliasedType: pendingExplicitType,
			kind: 'TYPE_ALIAS'
		});
}

function collectDeclarationSignatureFacts(
	state: TypeExtractionState,
	symbol: TypeScriptTypeSymbolBridge,
	bridge: TypeScriptTypeDeclarationBridge,
	signatureKind: SemanticSignatureKind
): void {
	const signature = canonicalSignatureForDeclaration(state, bridge);
	if (signature === undefined) return;
	const pendingSignature = discoverSignature(state, signature, {
		declaration: bridge,
		key: `SYMBOL:${String(symbol.symbolOrdinal)}:DECLARATION:${String(bridge.declarationOrdinal)}`,
		owner: { kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
		providerOrdinal: null,
		signatureKind
	});
	addOverloadEntry(state, symbol.symbolOrdinal, bridge, pendingSignature);
}

function collectDeclarationTypeParameterFacts(
	state: TypeExtractionState,
	bridge: TypeScriptTypeDeclarationBridge,
	declaration: ts.Declaration
): void {
	for (let ordinal = 0; ordinal < declarationTypeParameters(declaration).length; ordinal += 1) {
		const parameterDeclaration = declarationTypeParameters(declaration)[ordinal]!;
		const parameterBridge = state.declarationByNode.get(parameterDeclaration) ?? null;
		const parameterNodeAnchor = state.input.nodeAnchorForNode(parameterDeclaration);
		if (parameterBridge === null && parameterNodeAnchor === null) continue;
		const parameterType = runQuery(
			state,
			'declaration-type-parameter',
			`${String(bridge.declarationOrdinal)}\0${String(ordinal)}`,
			() => state.checker.getTypeAtLocation(parameterDeclaration)
		);
		const pendingParameterType = discoverType(
			state,
			parameterType,
			parameterBridge !== null
				? {
						declarationOrdinal: parameterBridge.declarationOrdinal,
						kind: 'DECLARATION',
						queryMode: 'TYPE_AT_LOCATION'
					}
				: {
						kind: 'NODE',
						nodeOrdinal: parameterNodeAnchor!.nodeOrdinal,
						queryMode: 'TYPE_AT_LOCATION',
						sourceOrdinal: parameterNodeAnchor!.sourceOrdinal
					}
		);
		addTypeOf(
			state,
			parameterBridge !== null
				? {
						declarationOrdinal: parameterBridge.declarationOrdinal,
						kind: 'DECLARATION'
					}
				: {
						kind: 'AST_NODE',
						nodeOrdinal: parameterNodeAnchor!.nodeOrdinal,
						sourceOrdinal: parameterNodeAnchor!.sourceOrdinal
					},
			'TYPE_AT_LOCATION',
			pendingParameterType
		);
		addTypeParameter(
			state,
			{
				declarationOrdinal: bridge.declarationOrdinal,
				kind: 'DECLARATION'
			},
			ordinal,
			pendingParameterType,
			parameterDeclaration
		);
	}
}

function collectHeritageTypeFacts(
	state: TypeExtractionState,
	bridge: TypeScriptTypeDeclarationBridge,
	kind: 'TYPE_EXTENSION' | 'TYPE_IMPLEMENTATION',
	heritageTypeNode: ts.ExpressionWithTypeArguments,
	ordinal: number,
	derivedType: PendingType
): void {
	const nodeAnchor = state.input.nodeAnchorForNode(heritageTypeNode);
	if (nodeAnchor === null) return;
	const baseType = runQuery(
		state,
		'heritage-type',
		`${String(bridge.declarationOrdinal)}\0${kind}\0${String(ordinal)}`,
		() => state.checker.getTypeAtLocation(heritageTypeNode)
	);
	const pendingBaseType = discoverType(state, baseType, {
		kind: 'NODE',
		nodeOrdinal: nodeAnchor.nodeOrdinal,
		queryMode: 'TYPE_AT_LOCATION',
		sourceOrdinal: nodeAnchor.sourceOrdinal
	});
	addTypeOf(
		state,
		{
			kind: 'AST_NODE',
			nodeOrdinal: nodeAnchor.nodeOrdinal,
			sourceOrdinal: nodeAnchor.sourceOrdinal
		},
		'TYPE_AT_LOCATION',
		pendingBaseType
	);
	state.pendingRelations.push({
		baseType: pendingBaseType,
		derivedType,
		heritageOccurrence: {
			kind: 'AST_NODE',
			nodeOrdinal: nodeAnchor.nodeOrdinal,
			sourceOrdinal: nodeAnchor.sourceOrdinal
		},
		kind
	});
}

function collectHeritageFacts(
	state: TypeExtractionState,
	bridge: TypeScriptTypeDeclarationBridge,
	declaration: ts.ClassLikeDeclaration | ts.InterfaceDeclaration,
	derivedType: PendingType
): void {
	for (const heritageClause of declaration.heritageClauses ?? []) {
		const kind =
			heritageClause.token === ts.SyntaxKind.ImplementsKeyword
				? ('TYPE_IMPLEMENTATION' as const)
				: ('TYPE_EXTENSION' as const);
		for (let ordinal = 0; ordinal < heritageClause.types.length; ordinal += 1) {
			const heritageTypeNode = heritageClause.types[ordinal]!;
			collectHeritageTypeFacts(state, bridge, kind, heritageTypeNode, ordinal, derivedType);
		}
	}
}

function collectDeclarationFacts(
	state: TypeExtractionState,
	symbol: TypeScriptTypeSymbolBridge,
	bridge: TypeScriptTypeDeclarationBridge
): void {
	const declaration = bridge.declaration;
	// SourceFile is a declaration carrier, but it is not a valid public
	// getTypeAtLocation query node because it has no parent.
	if (ts.isSourceFile(declaration)) return;
	const declarationSubject = {
		declarationOrdinal: bridge.declarationOrdinal,
		kind: 'DECLARATION' as const
	};
	const locationType = runQuery(
		state,
		'declaration-type-at-location',
		String(bridge.declarationOrdinal),
		() => state.checker.getTypeAtLocation(declaration)
	);
	const pendingLocationType = discoverType(state, locationType, {
		declarationOrdinal: bridge.declarationOrdinal,
		kind: 'DECLARATION',
		queryMode: 'TYPE_AT_LOCATION'
	});
	addTypeOf(state, declarationSubject, 'TYPE_AT_LOCATION', pendingLocationType);

	const typeNode = declarationTypeNode(declaration);
	if (typeNode !== null)
		collectDeclarationTypeNodeFacts(state, bridge, declaration, typeNode, declarationSubject);

	const signatureKind = signatureKindForDeclaration(declaration);
	if (signatureKind === null) collectDeclarationTypeParameterFacts(state, bridge, declaration);
	else collectDeclarationSignatureFacts(state, symbol, bridge, signatureKind);

	if (
		ts.isClassDeclaration(declaration) ||
		ts.isClassExpression(declaration) ||
		ts.isInterfaceDeclaration(declaration)
	)
		collectHeritageFacts(state, bridge, declaration, pendingLocationType);
}

function collectSymbolFacts(
	state: TypeExtractionState,
	symbol: TypeScriptTypeSymbolBridge,
	processedDeclarationOrdinals: Set<number>
): void {
	state.guard.check();
	const representative = symbol.representatives[0];
	const declarations = [...symbol.declarations].sort(
		(left, right) => left.declarationOrdinal - right.declarationOrdinal
	);
	const location = declarations[0]?.declaration;
	if (representative !== undefined && (symbol.flags & ts.SymbolFlags.Type) !== 0)
		collectDeclaredSymbolType(state, symbol, representative);
	if (
		representative !== undefined &&
		location !== undefined &&
		(symbol.flags & ts.SymbolFlags.Value) !== 0
	)
		collectValueSymbolType(state, symbol, representative, location);

	for (const bridge of declarations) {
		if (processedDeclarationOrdinals.has(bridge.declarationOrdinal)) continue;
		processedDeclarationOrdinals.add(bridge.declarationOrdinal);
		collectDeclarationFacts(state, symbol, bridge);
	}
}

function collectSymbolTypeFacts(state: TypeExtractionState): void {
	const sortedSymbols = [...state.input.symbols].sort(
		(left, right) => left.symbolOrdinal - right.symbolOrdinal
	);
	const processedDeclarationOrdinals = new Set<number>();
	for (const symbol of sortedSymbols)
		collectSymbolFacts(state, symbol, processedDeclarationOrdinals);
}

function loadTypeIdentity(
	state: TypeExtractionState,
	pending: PendingType,
	key: string
): ts.Symbol | undefined {
	pending.flags = runQuery(state, 'type-flags', key, () => pending.type.getFlags());
	pending.flagNames = flagNames(pending.flags, ts.TypeFlags);
	pending.category = typeCategory(pending.flags);
	pending.objectFlags =
		(pending.flags & ts.TypeFlags.Object) === 0
			? null
			: runQuery(state, 'object-flags', key, () => (pending.type as ts.ObjectType).objectFlags);
	pending.objectFlagNames =
		pending.objectFlags === null ? [] : flagNames(pending.objectFlags, ts.ObjectFlags);
	const symbol = runQuery(state, 'type-symbol', key, () => pending.type.getSymbol());
	pending.symbolOrdinal =
		symbol === undefined ? null : (state.symbolOrdinalBySymbol.get(symbol) ?? null);
	const aliasSymbol = runQuery(state, 'type-alias-symbol', key, () => pending.type.aliasSymbol);
	pending.aliasSymbolOrdinal =
		aliasSymbol === undefined ? null : (state.symbolOrdinalBySymbol.get(aliasSymbol) ?? null);
	pending.display = canonicalDisplay(
		state,
		runQuery(state, 'type-display', key, () => state.checker.typeToString(pending.type))
	);
	pending.displaySha256 = sha256(pending.display);
	return aliasSymbol;
}

function loadTypeConstituentStructure(
	state: TypeExtractionState,
	pending: PendingType,
	key: string
): void {
	if ((pending.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection)) === 0) return;
	const constituents = runQuery(state, 'type-constituents', key, () => [
		...(pending.type as ts.UnionOrIntersectionType).types
	]);
	const relationKind =
		(pending.flags & ts.TypeFlags.Union) !== 0
			? ('UNION_CONSTITUENT' as const)
			: ('INTERSECTION_CONSTITUENT' as const);
	const discovered = constituents.map((constituent, ordinal) =>
		discoverType(state, constituent, {
			componentKind: relationKind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION',
			componentOrdinal: ordinal,
			kind: 'TYPE_COMPONENT',
			parent: pending
		})
	);
	if (relationKind === 'UNION_CONSTITUENT') pending.unionConstituents = discovered;
	else pending.intersectionConstituents = discovered;
	for (let ordinal = 0; ordinal < discovered.length; ordinal += 1)
		state.pendingRelations.push({
			compositeType: pending,
			constituentType: discovered[ordinal]!,
			kind: relationKind,
			ordinal
		});
}

function recordGenericInstantiation(
	state: TypeExtractionState,
	pending: PendingType,
	target: ts.Type,
	argumentTypes: readonly ts.Type[]
): void {
	pending.genericTarget = discoverType(state, target, {
		componentKind: 'GENERIC_TARGET',
		componentOrdinal: 0,
		kind: 'TYPE_COMPONENT',
		parent: pending
	});
	pending.genericArguments = argumentTypes.map((argument, ordinal) =>
		discoverType(state, argument, {
			componentKind: 'TYPE_ARGUMENT',
			componentOrdinal: ordinal,
			kind: 'TYPE_COMPONENT',
			parent: pending
		})
	);
	state.pendingRelations.push({
		argumentTypes: pending.genericArguments,
		genericTarget: pending.genericTarget,
		instantiatedTarget: pending,
		kind: 'GENERIC_INSTANTIATION'
	});
}

function loadTypeReferenceStructure(
	state: TypeExtractionState,
	pending: PendingType,
	key: string
): void {
	const reference = pending.type as ts.TypeReference;
	const target = runQuery(state, 'generic-target', key, () => reference.target);
	const argumentsValue = runQuery(state, 'generic-arguments', key, () => [
		...state.checker.getTypeArguments(reference)
	]);
	if (target !== pending.type || argumentsValue.length > 0)
		recordGenericInstantiation(state, pending, target, argumentsValue);
}

function loadTypeAliasStructure(
	state: TypeExtractionState,
	pending: PendingType,
	key: string,
	aliasSymbol: ts.Symbol
): void {
	const aliasArguments = runQuery(state, 'alias-type-arguments', key, () => [
		...(pending.type.aliasTypeArguments ?? [])
	]);
	if (aliasArguments.length === 0) return;
	const target = runQuery(state, 'alias-generic-target', key, () =>
		state.checker.getDeclaredTypeOfSymbol(aliasSymbol)
	);
	if (target !== pending.type) recordGenericInstantiation(state, pending, target, aliasArguments);
}

function loadTypeGenericStructure(
	state: TypeExtractionState,
	pending: PendingType,
	key: string,
	aliasSymbol: ts.Symbol | undefined
): void {
	if (pending.objectFlags !== null && (pending.objectFlags & ts.ObjectFlags.Reference) !== 0)
		loadTypeReferenceStructure(state, pending, key);
	else if (aliasSymbol !== undefined) loadTypeAliasStructure(state, pending, key, aliasSymbol);
}

function loadTypeSignature(
	state: TypeExtractionState,
	pending: PendingType,
	key: string,
	signatureKind: SemanticSignatureKind,
	signature: ts.Signature,
	providerOrdinal: number
): void {
	const compilerDeclaration = runQuery(
		state,
		'type-signature-declaration',
		`${key}\0${signatureKind}\0${String(providerOrdinal)}`,
		() => signature.declaration
	);
	const declaration =
		compilerDeclaration === undefined
			? null
			: (state.declarationByNode.get(compilerDeclaration) ?? null);
	const acquisition: PendingSignatureAcquisition = {
		declaration,
		key: `TYPE:${String(pending.discoveryOrdinal)}:${signatureKind}:${String(providerOrdinal)}`,
		owner: { kind: 'TYPE', type: pending },
		providerOrdinal,
		signatureKind
	};
	discoverSignature(state, signature, acquisition);
	const canonicalSignature =
		declaration === null ? undefined : canonicalSignatureForDeclaration(state, declaration);
	const canonicalPending =
		canonicalSignature === undefined
			? null
			: discoverSignature(state, canonicalSignature, acquisition);
	const callableSymbolOrdinal = pending.symbolOrdinal ?? pending.aliasSymbolOrdinal;
	if (callableSymbolOrdinal !== null && declaration !== null && canonicalPending !== null)
		addOverloadEntry(state, callableSymbolOrdinal, declaration, canonicalPending);
}

function loadTypeSignatures(state: TypeExtractionState, pending: PendingType, key: string): void {
	for (const [signatureKind, compilerKind] of [
		['CALL', ts.SignatureKind.Call],
		['CONSTRUCT', ts.SignatureKind.Construct]
	] as const) {
		const signatures = runQuery(state, `${signatureKind.toLowerCase()}-signatures`, key, () => [
			...state.checker.getSignaturesOfType(pending.type, compilerKind)
		]);
		for (let providerOrdinal = 0; providerOrdinal < signatures.length; providerOrdinal += 1)
			loadTypeSignature(
				state,
				pending,
				key,
				signatureKind,
				signatures[providerOrdinal]!,
				providerOrdinal
			);
	}
}

function processType(state: TypeExtractionState, pending: PendingType): void {
	if (pending.processed) return;
	state.guard.check();
	const key = String(pending.discoveryOrdinal);
	const aliasSymbol = loadTypeIdentity(state, pending, key);
	loadTypeConstituentStructure(state, pending, key);
	loadTypeGenericStructure(state, pending, key, aliasSymbol);
	loadTypeSignatures(state, pending, key);
	pending.unsupportedStructureKinds = unsupportedStructureKinds(pending.flags, pending.objectFlags);
	pending.processed = true;
}

function signatureDeclaration(
	state: TypeExtractionState,
	pending: PendingSignature
): TypeScriptTypeDeclarationBridge | null {
	if (pending.declaration !== null) return pending.declaration;
	const declaration = runQuery(
		state,
		'signature-declaration',
		String(pending.discoveryOrdinal),
		() => pending.signature.declaration
	);
	return declaration === undefined ? null : (state.declarationByNode.get(declaration) ?? null);
}

function parameterDeclarationBridge(
	state: TypeExtractionState,
	symbol: ts.Symbol,
	fallback: ts.ParameterDeclaration | null,
	key: string
): TypeScriptTypeDeclarationBridge | null {
	if (fallback !== null) {
		const bridge = state.declarationByNode.get(fallback);
		if (bridge !== undefined) return bridge;
	}
	const declarations = runQuery(state, 'signature-parameter-declarations', key, () => [
		...(symbol.getDeclarations() ?? [])
	]);
	return (
		declarations
			.map((declaration) => state.declarationByNode.get(declaration) ?? null)
			.filter((bridge): bridge is TypeScriptTypeDeclarationBridge => bridge !== null)
			.sort((left, right) => left.declarationOrdinal - right.declarationOrdinal)[0] ?? null
	);
}

function signatureParameterInputs(
	compilerParameters: readonly ts.Symbol[],
	thisParameter: ts.Symbol | undefined,
	signatureDeclarationNode: ts.SignatureDeclaration | null
): readonly SignatureParameterInput[] {
	const parameterInputs: SignatureParameterInput[] = [];
	if (thisParameter !== undefined) {
		const explicitThis =
			signatureDeclarationNode?.parameters.find(
				(parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === 'this'
			) ?? null;
		parameterInputs.push({
			fallback: explicitThis,
			ordinal: 0,
			role: 'THIS',
			symbol: thisParameter
		});
	}
	for (let ordinal = 0; ordinal < compilerParameters.length; ordinal += 1) {
		const fallback =
			signatureDeclarationNode?.parameters.filter(
				(parameter) => !(ts.isIdentifier(parameter.name) && parameter.name.text === 'this')
			)[ordinal] ?? null;
		parameterInputs.push({
			fallback,
			ordinal,
			role: 'PARAMETER',
			symbol: compilerParameters[ordinal]!
		});
	}
	return parameterInputs;
}

function signatureParameterRecord(
	state: TypeExtractionState,
	pending: PendingSignature,
	key: string,
	declaration: ts.Declaration | undefined,
	parameter: SignatureParameterInput
): PendingSignatureParameter {
	const parameterKey = `${key}\0${parameter.role}\0${String(parameter.ordinal)}`;
	const bridge = parameterDeclarationBridge(
		state,
		parameter.symbol,
		parameter.fallback,
		parameterKey
	);
	const location = bridge?.declaration ?? declaration;
	const parameterType =
		location === undefined
			? runQuery(state, 'signature-parameter-type', parameterKey, () =>
					state.checker.getTypeOfSymbol(parameter.symbol)
				)
			: runQuery(state, 'signature-parameter-type-at-location', parameterKey, () =>
					state.checker.getTypeOfSymbolAtLocation(parameter.symbol, location)
				);
	const name = representableText(
		runQuery(state, 'signature-parameter-name', parameterKey, () => parameter.symbol.getName())
	);
	const parameterDeclarationNode =
		bridge?.declaration !== undefined && ts.isParameter(bridge.declaration)
			? bridge.declaration
			: parameter.fallback;
	const optional =
		parameter.role === 'THIS' || parameterDeclarationNode === null
			? false
			: runQuery(state, 'signature-parameter-optional', parameterKey, () =>
					state.checker.isOptionalParameter(parameterDeclarationNode)
				);
	return {
		declarationOrdinal: bridge?.declarationOrdinal ?? null,
		name,
		optional,
		ordinal: parameter.ordinal,
		rest: parameterDeclarationNode?.dotDotDotToken !== undefined,
		role: parameter.role,
		signature: pending,
		signatureParameterOrdinal: -1,
		symbolOrdinal: state.symbolOrdinalBySymbol.get(parameter.symbol) ?? null,
		type: discoverType(state, parameterType, {
			componentKind: parameter.role,
			componentOrdinal: parameter.ordinal,
			kind: 'SIGNATURE_COMPONENT',
			signature: pending
		})
	};
}

function loadSignatureParameters(
	state: TypeExtractionState,
	pending: PendingSignature,
	key: string,
	declaration: ts.Declaration | undefined,
	signatureDeclarationNode: ts.SignatureDeclaration | null
): void {
	const compilerParameters = runQuery(state, 'signature-parameters', key, () => [
		...pending.signature.getParameters()
	]);
	const parameterRecords: PendingSignatureParameter[] = [];
	const thisParameter = runQuery(
		state,
		'signature-this-parameter',
		key,
		() => pending.signature.thisParameter
	);
	const parameterInputs = signatureParameterInputs(
		compilerParameters,
		thisParameter,
		signatureDeclarationNode
	);
	for (const parameter of parameterInputs)
		parameterRecords.push(signatureParameterRecord(state, pending, key, declaration, parameter));
	pending.parameterRecords = parameterRecords;
}

function loadSignatureTypeParameters(
	state: TypeExtractionState,
	pending: PendingSignature,
	key: string,
	signatureDeclarationNode: ts.SignatureDeclaration | null
): void {
	const signatureTypeParameters = runQuery(state, 'signature-type-parameters', key, () =>
		pending.signature.getTypeParameters()
	);
	const compilerTypeParameters = signatureTypeParameters ?? [];
	const declarationTypeParameterNodes =
		signatureDeclarationNode?.typeParameters === undefined
			? []
			: [...signatureDeclarationNode.typeParameters];
	pending.typeParameterRecords = compilerTypeParameters.map((parameterType, ordinal) =>
		addTypeParameter(
			state,
			{ kind: 'SIGNATURE', signature: pending },
			ordinal,
			discoverType(state, parameterType, {
				componentKind: 'TYPE_PARAMETER',
				componentOrdinal: ordinal,
				kind: 'SIGNATURE_COMPONENT',
				signature: pending
			}),
			declarationTypeParameterNodes[ordinal] ?? null
		)
	);
}

function processSignature(state: TypeExtractionState, pending: PendingSignature): void {
	if (pending.processed) return;
	state.guard.check();
	if (pending.signatureKind === null)
		throw new Error('A discovered TypeScript Signature lacks a semantic kind.');
	const key = String(pending.discoveryOrdinal);
	const declarationBridge = signatureDeclaration(state, pending);
	if (declarationBridge !== null) observeSignatureDeclaration(state, pending, declarationBridge);
	if (pending.declarationRole === 'UNKNOWN')
		pending.declarationRole = declarationRole(
			pending.declaration?.declaration ?? null,
			false,
			false
		);
	pending.display = canonicalDisplay(
		state,
		runQuery(state, 'signature-display', key, () =>
			state.checker.signatureToString(pending.signature)
		)
	);
	pending.displaySha256 = sha256(pending.display);
	const returnType = runQuery(state, 'signature-return-type', key, () =>
		state.checker.getReturnTypeOfSignature(pending.signature)
	);
	pending.returnType = discoverType(state, returnType, {
		componentKind: 'RETURN',
		componentOrdinal: 0,
		kind: 'SIGNATURE_COMPONENT',
		signature: pending
	});
	const declaration = pending.declaration?.declaration;
	const signatureDeclarationNode =
		declaration !== undefined && ts.isFunctionLike(declaration) ? declaration : null;
	loadSignatureParameters(state, pending, key, declaration, signatureDeclarationNode);
	loadSignatureTypeParameters(state, pending, key, signatureDeclarationNode);
	pending.processed = true;
}

function drainPendingWork(state: TypeExtractionState): void {
	const types = state.pendingTypes;
	const signatures = state.pendingSignatures;
	let typeCursor = 0;
	let signatureCursor = 0;
	while (typeCursor < types.length || signatureCursor < signatures.length) {
		while (typeCursor < types.length) processType(state, types[typeCursor++]!);
		while (signatureCursor < signatures.length)
			processSignature(state, signatures[signatureCursor++]!);
	}
}

function mergeOverloadEntries(
	entriesValue: readonly PendingOverloadMember[]
): readonly PendingOverloadMember[] {
	const entriesByDeclaration = new Map<number, PendingOverloadMember>();
	for (const entry of [...entriesValue].sort(
		(left, right) =>
			left.signature.discoveryOrdinal - right.signature.discoveryOrdinal ||
			left.declaration.declarationOrdinal - right.declaration.declarationOrdinal
	)) {
		const key = entry.declaration.declarationOrdinal;
		const existing = entriesByDeclaration.get(key);
		if (existing === undefined) {
			entriesByDeclaration.set(key, entry);
			continue;
		}
		entriesByDeclaration.set(key, {
			declaration: existing.declaration,
			implementation: existing.implementation || entry.implementation,
			signature:
				existing.signature.discoveryOrdinal <= entry.signature.discoveryOrdinal
					? existing.signature
					: entry.signature
		});
	}
	return [...entriesByDeclaration.values()].sort(
		(left, right) =>
			left.declaration.declarationOrdinal - right.declaration.declarationOrdinal ||
			left.signature.discoveryOrdinal - right.signature.discoveryOrdinal
	);
}

function overloadSetMembers(
	entries: readonly PendingOverloadMember[]
): readonly PendingOverloadMember[] {
	const kindCounts = new Map<SemanticSignatureKind, number>();
	for (const entry of entries) {
		const kind = entry.signature.signatureKind;
		if (kind !== null) kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
	}
	const overloadedKinds = new Set(
		[...kindCounts.entries()].flatMap(([kind, count]) => (count >= 2 ? [kind] : []))
	);
	return entries.filter(
		(entry) =>
			entry.signature.signatureKind !== null && overloadedKinds.has(entry.signature.signatureKind)
	);
}

function applyOverloadMemberRoles(members: readonly PendingOverloadMember[]): void {
	for (const member of members) {
		member.signature.declarationRole = declarationRole(
			member.declaration.declaration,
			true,
			member.implementation
		);
		member.signature.semanticKind = member.implementation
			? 'IMPLEMENTATION_SIGNATURE'
			: 'OVERLOAD_SIGNATURE';
	}
}

function buildPendingOverloadSets(state: TypeExtractionState): PendingOverloadSet[] {
	const pendingOverloadSets: PendingOverloadSet[] = [];
	for (const [callableSymbolOrdinal, entriesValue] of [...state.overloadEntriesBySymbol].sort(
		(left, right) => left[0] - right[0]
	)) {
		const entries = mergeOverloadEntries(entriesValue);
		const members = overloadSetMembers(entries);
		applyOverloadMemberRoles(members);
		if (members.length >= 2)
			pendingOverloadSets.push({
				callableSymbolOrdinal,
				members,
				overloadSetOrdinal: -1
			});
	}
	return pendingOverloadSets;
}

function primaryTypeAnchor(type: PendingType): string {
	return (
		[...type.queryAnchors].sort(compareStrings)[0] ?? `DISCOVERY:${String(type.discoveryOrdinal)}`
	);
}

function assignTypeOrdinals(state: TypeExtractionState): readonly PendingType[] {
	for (const pending of state.pendingTypes) {
		if (pending.category === null)
			throw new Error('A discovered TypeScript Type was not processed.');
		pending.fingerprintInput = canonicalSemanticJson({
			acquisitionAnchors: [...pending.queryAnchors].sort(compareStrings),
			aliasSymbolOrdinal: pending.aliasSymbolOrdinal,
			category: pending.category,
			discoveryOrdinal: pending.discoveryOrdinal,
			displaySha256: pending.displaySha256,
			flags: pending.flags,
			genericArguments: pending.genericArguments.map(primaryTypeAnchor),
			genericTarget:
				pending.genericTarget === null ? null : primaryTypeAnchor(pending.genericTarget),
			intersectionConstituents: pending.intersectionConstituents.map(primaryTypeAnchor),
			objectFlags: pending.objectFlags,
			profile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
			symbolOrdinal: pending.symbolOrdinal,
			unionConstituents: pending.unionConstituents.map(primaryTypeAnchor),
			unsupportedStructureKinds: pending.unsupportedStructureKinds
		});
		pending.fingerprintSha256 = sha256(pending.fingerprintInput);
	}
	const sortedTypes = [...state.pendingTypes].sort(
		(left, right) =>
			compareStrings(left.fingerprintSha256, right.fingerprintSha256) ||
			compareStrings(left.fingerprintInput, right.fingerprintInput)
	);
	for (let typeOrdinal = 0; typeOrdinal < sortedTypes.length; typeOrdinal += 1)
		sortedTypes[typeOrdinal]!.typeOrdinal = typeOrdinal;
	return sortedTypes;
}

function rawSignatureOwner(pending: PendingSignature): RawSemanticSignature['owner'] {
	const acquisitions = [...pending.acquisitions.values()];
	const symbolOwner = acquisitions
		.flatMap((entry) => (entry.owner.kind === 'SYMBOL' ? [entry.owner] : []))
		.sort((left, right) => left.symbolOrdinal - right.symbolOrdinal)[0];
	if (symbolOwner !== undefined) return symbolOwner;
	const typeOwner = acquisitions
		.flatMap((entry) => (entry.owner.kind === 'TYPE' ? [entry.owner] : []))
		.sort((left, right) => left.type.typeOrdinal - right.type.typeOrdinal)[0];
	if (typeOwner !== undefined) return { kind: 'TYPE', typeOrdinal: typeOwner.type.typeOrdinal };
	if (pending.identityDeclaration !== null)
		return {
			declarationOrdinal: pending.identityDeclaration.declarationOrdinal,
			kind: 'DECLARATION'
		};
	throw new Error('A discovered TypeScript Signature lacks a canonical owner.');
}

function signatureProviderOrdinal(
	pending: PendingSignature,
	owner: RawSemanticSignature['owner']
): number | null {
	if (owner.kind !== 'TYPE') return null;
	return (
		[...pending.acquisitions.values()]
			.filter(
				(acquisition) =>
					acquisition.owner.kind === 'TYPE' &&
					acquisition.owner.type.typeOrdinal === owner.typeOrdinal &&
					acquisition.providerOrdinal !== null
			)
			.map((acquisition) => acquisition.providerOrdinal!)
			.sort((left, right) => left - right)[0] ?? null
	);
}

function assignSignatureOrdinals(state: TypeExtractionState): readonly PendingSignature[] {
	for (const pending of state.pendingSignatures) {
		if (pending.signatureKind === null || pending.returnType === null)
			throw new Error('A discovered TypeScript Signature was not fully processed.');
		const owner = rawSignatureOwner(pending);
		pending.fingerprintInput = canonicalSemanticJson({
			declarationOrdinal: pending.declaration?.declarationOrdinal ?? null,
			declarationRole: pending.declarationRole,
			discoveryOrdinal: pending.discoveryOrdinal,
			displaySha256: pending.displaySha256,
			owner,
			parameters: pending.parameterRecords.map((parameter) => ({
				declarationOrdinal: parameter.declarationOrdinal,
				name: parameter.name,
				optional: parameter.optional,
				ordinal: parameter.ordinal,
				rest: parameter.rest,
				role: parameter.role,
				typeFingerprintSha256: parameter.type.fingerprintSha256
			})),
			profile: SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
			providerOrdinal: signatureProviderOrdinal(pending, owner),
			returnTypeFingerprintSha256: pending.returnType.fingerprintSha256,
			semanticKind: pending.semanticKind,
			signatureKind: pending.signatureKind,
			typeParameters: pending.typeParameterRecords.map((parameter) => ({
				name: parameter.name,
				ordinal: parameter.ordinal,
				typeFingerprintSha256: parameter.parameterType.fingerprintSha256
			}))
		});
		pending.fingerprintSha256 = sha256(pending.fingerprintInput);
	}
	const sortedSignatures = [...state.pendingSignatures].sort(
		(left, right) =>
			compareStrings(left.fingerprintSha256, right.fingerprintSha256) ||
			compareStrings(left.fingerprintInput, right.fingerprintInput)
	);
	for (let signatureOrdinal = 0; signatureOrdinal < sortedSignatures.length; signatureOrdinal += 1)
		sortedSignatures[signatureOrdinal]!.signatureOrdinal = signatureOrdinal;
	return sortedSignatures;
}

function rawTypeParameterOwner(
	owner: PendingTypeParameterOwner
): RawSemanticTypeParameter['owner'] {
	switch (owner.kind) {
		case 'TYPE':
			return { kind: 'TYPE', typeOrdinal: owner.type.typeOrdinal };
		case 'SIGNATURE':
			return { kind: 'SIGNATURE', signatureOrdinal: owner.signature.signatureOrdinal };
		case 'DECLARATION':
			return owner;
	}
}

function assignTypeParameterOrdinals(state: TypeExtractionState): readonly PendingTypeParameter[] {
	const sortedTypeParameters = [...state.pendingTypeParameters.values()].sort(
		(left, right) =>
			compareStrings(
				canonicalSemanticJson(rawTypeParameterOwner(left.owner)),
				canonicalSemanticJson(rawTypeParameterOwner(right.owner))
			) ||
			left.ordinal - right.ordinal ||
			(left.declarationOrdinal ?? -1) - (right.declarationOrdinal ?? -1) ||
			compareStrings(left.name, right.name) ||
			left.parameterType.typeOrdinal - right.parameterType.typeOrdinal
	);
	for (
		let typeParameterOrdinal = 0;
		typeParameterOrdinal < sortedTypeParameters.length;
		typeParameterOrdinal += 1
	)
		sortedTypeParameters[typeParameterOrdinal]!.typeParameterOrdinal = typeParameterOrdinal;
	return sortedTypeParameters;
}

function assignSignatureParameterOrdinals(
	sortedSignatures: readonly PendingSignature[]
): readonly PendingSignatureParameter[] {
	const allSignatureParameters = sortedSignatures
		.flatMap((signature) => signature.parameterRecords)
		.sort(
			(left, right) =>
				left.signature.signatureOrdinal - right.signature.signatureOrdinal ||
				(left.role === 'THIS' ? 0 : 1) - (right.role === 'THIS' ? 0 : 1) ||
				left.ordinal - right.ordinal
		);
	for (
		let signatureParameterOrdinal = 0;
		signatureParameterOrdinal < allSignatureParameters.length;
		signatureParameterOrdinal += 1
	)
		allSignatureParameters[signatureParameterOrdinal]!.signatureParameterOrdinal =
			signatureParameterOrdinal;
	return allSignatureParameters;
}

function identityBasis(type: PendingType): SemanticTypeIdentityBasis {
	if (
		type.symbolOrdinal !== null ||
		type.aliasSymbolOrdinal !== null ||
		[...type.acquisitionAnchors.values()].some((anchor) => anchor.kind === 'DECLARATION')
	)
		return 'DECLARATION_ANCHORED';
	if (
		[...type.acquisitionAnchors.values()].some(
			(anchor) => anchor.kind === 'NODE' || anchor.kind === 'SYMBOL'
		)
	)
		return 'QUERY_ANCHORED';
	return 'STRUCTURAL';
}

function rawTypeAnchor(anchor: PendingTypeAnchor): RawSemanticTypeAcquisitionAnchor {
	switch (anchor.kind) {
		case 'NODE':
		case 'DECLARATION':
		case 'SYMBOL':
			return anchor;
		case 'TYPE_COMPONENT':
			return {
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: anchor.kind,
				parentTypeOrdinal: anchor.parent.typeOrdinal
			};
		case 'SIGNATURE_COMPONENT':
			return {
				componentKind: anchor.componentKind,
				componentOrdinal: anchor.componentOrdinal,
				kind: anchor.kind,
				signatureOrdinal: anchor.signature.signatureOrdinal
			};
	}
}

function projectTypes(
	state: TypeExtractionState,
	sortedTypes: readonly PendingType[]
): RawSemanticType[] {
	return sortedTypes.map((pending) => {
		state.guard.addFact();
		const acquisitionAnchors = [
			...new Map(
				[...pending.acquisitionAnchors.values()].map((anchor) => {
					const raw = rawTypeAnchor(anchor);
					return [canonicalSemanticJson(raw), raw] as const;
				})
			).values()
		].sort((left, right) =>
			compareStrings(canonicalSemanticJson(left), canonicalSemanticJson(right))
		);
		return {
			acquisitionAnchors,
			aliasSymbolOrdinal: pending.aliasSymbolOrdinal,
			category: pending.category!,
			display: pending.display,
			displayProfile: SEMANTIC_TYPE_DISPLAY_PROFILE,
			displaySha256: pending.displaySha256,
			fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
			fingerprintSha256: pending.fingerprintSha256,
			flagNames: pending.flagNames,
			flags: pending.flags,
			identityBasis: identityBasis(pending),
			objectFlagNames: pending.objectFlagNames,
			objectFlags: pending.objectFlags,
			structureState: pending.unsupportedStructureKinds.length === 0 ? 'COMPLETE' : 'BOUNDED',
			symbolOrdinal: pending.symbolOrdinal,
			typeOrdinal: pending.typeOrdinal,
			unsupportedStructureKinds: pending.unsupportedStructureKinds
		};
	});
}

function typeParameterConstraintState(
	pending: PendingTypeParameter
): RawSemanticTypeParameter['constraintState'] {
	if (!pending.parameterType.typeParameterBoundsLoaded)
		throw new Error('A represented TypeParameter has not loaded its compiler bounds.');
	if (pending.parameterType.constraint !== null) return 'RESOLVED';
	return pending.explicitConstraint ? 'UNRESOLVED' : 'MISSING';
}

function typeParameterDefaultState(
	pending: PendingTypeParameter
): RawSemanticTypeParameter['defaultState'] {
	if (!pending.parameterType.typeParameterBoundsLoaded)
		throw new Error('A represented TypeParameter has not loaded its compiler bounds.');
	if (pending.parameterType.defaultType !== null) return 'RESOLVED';
	return pending.explicitDefault ? 'UNRESOLVED' : 'MISSING';
}

function projectTypeParameters(
	state: TypeExtractionState,
	sortedTypeParameters: readonly PendingTypeParameter[]
): RawSemanticTypeParameter[] {
	return sortedTypeParameters.map((pending) => {
		state.guard.addFact();
		const constraintState = typeParameterConstraintState(pending);
		const defaultState = typeParameterDefaultState(pending);
		return {
			constraintState,
			constraintTypeOrdinal: pending.parameterType.constraint?.typeOrdinal ?? null,
			declarationOrdinal: pending.declarationOrdinal,
			defaultState,
			defaultTypeOrdinal: pending.parameterType.defaultType?.typeOrdinal ?? null,
			name: pending.name,
			ordinal: pending.ordinal,
			owner: rawTypeParameterOwner(pending.owner),
			parameterTypeOrdinal: pending.parameterType.typeOrdinal,
			typeParameterOrdinal: pending.typeParameterOrdinal
		};
	});
}

function projectSignatureParameters(
	state: TypeExtractionState,
	allSignatureParameters: readonly PendingSignatureParameter[]
): RawSemanticSignatureParameter[] {
	return allSignatureParameters.map((pending) => {
		state.guard.addFact();
		return {
			declarationOrdinal: pending.declarationOrdinal,
			name: pending.name,
			optional: pending.optional,
			ordinal: pending.ordinal,
			rest: pending.rest,
			role: pending.role,
			signatureOrdinal: pending.signature.signatureOrdinal,
			signatureParameterOrdinal: pending.signatureParameterOrdinal,
			symbolOrdinal: pending.symbolOrdinal,
			typeOrdinal: pending.type.typeOrdinal
		};
	});
}

function projectSignatures(
	state: TypeExtractionState,
	sortedSignatures: readonly PendingSignature[]
): RawSemanticSignature[] {
	return sortedSignatures.map((pending) => {
		state.guard.addFact();
		const owner = rawSignatureOwner(pending);
		return {
			declarationOrdinal: pending.declaration?.declarationOrdinal ?? null,
			declarationRole: pending.declarationRole,
			display: pending.display,
			displaySha256: pending.displaySha256,
			fingerprintProfile: SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
			fingerprintSha256: pending.fingerprintSha256,
			identityBasis:
				pending.identityDeclaration === null ? 'OWNER_ORDINAL' : 'DECLARATION_ANCHORED',
			owner,
			parameterOrdinals: pending.parameterRecords
				.map((parameter) => parameter.signatureParameterOrdinal)
				.sort((left, right) => left - right),
			providerOrdinal: signatureProviderOrdinal(pending, owner),
			returnTypeOrdinal: pending.returnType!.typeOrdinal,
			semanticKind: pending.semanticKind,
			signatureKind: pending.signatureKind!,
			signatureOrdinal: pending.signatureOrdinal,
			typeParameterOrdinals: pending.typeParameterRecords
				.map((parameter) => parameter.typeParameterOrdinal)
				.sort((left, right) => left - right)
		};
	});
}

function projectOverloadSets(
	state: TypeExtractionState,
	sortedOverloadSets: readonly PendingOverloadSet[]
): RawSemanticOverloadSet[] {
	return sortedOverloadSets.map((pending, ordinal) => {
		pending.overloadSetOrdinal = ordinal;
		state.guard.addFact();
		return { callableSymbolOrdinal: pending.callableSymbolOrdinal, overloadSetOrdinal: ordinal };
	});
}

function resolveCheckerContextDigest(state: TypeExtractionState): string | null {
	const hasAssignabilityRelations = state.pendingRelations.some(
		(relation) => relation.kind === 'ASSIGNABILITY'
	);
	const checkerContextDigest = hasAssignabilityRelations
		? state.input.resolveCheckerContextDigest()
		: null;
	if (checkerContextDigest !== null && !/^[a-f0-9]{64}$/u.test(checkerContextDigest))
		throw new Error('Type extraction checker-context resolver must return lowercase SHA-256.');
	return checkerContextDigest;
}

function unnumberedAssignabilityRelation(
	relation: PendingAssignabilityRelation,
	checkerContextDigest: string | null
): UnnumberedRawTypeRelation {
	const confirmed = relation.sourceType !== null && relation.targetType !== null;
	return {
		checkerContextDigest: checkerContextDigest!,
		kind: relation.kind,
		requestId: relation.requestId,
		result: relation.result,
		sourceTypeOrdinal: relation.sourceType?.typeOrdinal ?? null,
		state: confirmed ? 'CONFIRMED' : 'UNRESOLVED',
		targetTypeOrdinal: relation.targetType?.typeOrdinal ?? null
	};
}

function unnumberedTypeRelation(
	relation: PendingRelation,
	checkerContextDigest: string | null
): UnnumberedRawTypeRelation {
	switch (relation.kind) {
		case 'TYPE_OF':
			return {
				kind: relation.kind,
				queryMode: relation.queryMode,
				state: 'CONFIRMED',
				subject: relation.subject,
				typeOrdinal: relation.type.typeOrdinal
			};
		case 'TYPE_ALIAS':
			return {
				aliasDeclarationOrdinal: relation.aliasDeclarationOrdinal,
				aliasedTypeOrdinal: relation.aliasedType.typeOrdinal,
				kind: relation.kind,
				state: 'CONFIRMED'
			};
		case 'UNION_CONSTITUENT':
		case 'INTERSECTION_CONSTITUENT':
			return {
				compositeTypeOrdinal: relation.compositeType.typeOrdinal,
				constituentTypeOrdinal: relation.constituentType.typeOrdinal,
				kind: relation.kind,
				ordinal: relation.ordinal,
				state: 'CONFIRMED'
			};
		case 'GENERIC_INSTANTIATION':
			return {
				argumentTypeOrdinals: relation.argumentTypes.map((type) => type.typeOrdinal),
				genericTarget: { kind: 'TYPE', typeOrdinal: relation.genericTarget.typeOrdinal },
				instantiatedTarget: {
					kind: 'TYPE',
					typeOrdinal: relation.instantiatedTarget.typeOrdinal
				},
				kind: relation.kind,
				state: 'CONFIRMED'
			};
		case 'TYPE_EXTENSION':
		case 'TYPE_IMPLEMENTATION':
			return {
				baseTypeOrdinal: relation.baseType.typeOrdinal,
				derivedTypeOrdinal: relation.derivedType.typeOrdinal,
				heritageOccurrence: relation.heritageOccurrence,
				kind: relation.kind,
				state: 'CONFIRMED'
			};
		case 'ASSIGNABILITY':
			return unnumberedAssignabilityRelation(relation, checkerContextDigest);
	}
}

function buildTypeRelations(
	state: TypeExtractionState,
	sortedTypeParameters: readonly PendingTypeParameter[],
	sortedOverloadSets: readonly PendingOverloadSet[]
): RawSemanticTypeRelation[] {
	const checkerContextDigest = resolveCheckerContextDigest(state);
	const unnumberedRelations: UnnumberedRawTypeRelation[] = state.pendingRelations.map((relation) =>
		unnumberedTypeRelation(relation, checkerContextDigest)
	);
	for (const parameter of sortedTypeParameters) {
		const constraintState = typeParameterConstraintState(parameter);
		unnumberedRelations.push({
			constraintState,
			constraintTypeOrdinal: parameter.parameterType.constraint?.typeOrdinal ?? null,
			kind: 'PARAMETER_CONSTRAINT',
			state: constraintState === 'UNRESOLVED' ? 'UNRESOLVED' : 'CONFIRMED',
			typeParameterOrdinal: parameter.typeParameterOrdinal
		});
	}
	for (const overloadSet of sortedOverloadSets)
		for (let ordinal = 0; ordinal < overloadSet.members.length; ordinal += 1) {
			const member = overloadSet.members[ordinal]!;
			unnumberedRelations.push({
				kind: 'OVERLOAD_MEMBERSHIP',
				ordinal,
				overloadSetOrdinal: overloadSet.overloadSetOrdinal,
				role: overloadMembershipRole(member.declaration.declaration, member.implementation),
				signatureOrdinal: member.signature.signatureOrdinal,
				state: 'CONFIRMED'
			});
		}
	const canonicalRelations = [
		...new Map(
			unnumberedRelations.map((relation) => [canonicalSemanticJson(relation), relation] as const)
		).entries()
	]
		.sort((left, right) => compareStrings(left[0], right[0]))
		.map((entry) => entry[1]);
	return canonicalRelations.map((relation, relationOrdinal) => {
		state.guard.addFact();
		return { ...relation, relationOrdinal } as RawSemanticTypeRelation;
	});
}

/**
 * Extracts Program-local type facts using only the public TypeScript API. All
 * transient Type, Signature, Symbol, and Node objects are discarded before the
 * returned raw projection crosses the provider boundary.
 */
export function extractTypeScriptTypes(
	input: ExtractTypeScriptTypesInput
): RawTypeScriptTypeProjection {
	const state = createTypeExtractionState(input);
	collectAssignabilityRelations(state);
	collectSymbolTypeFacts(state);
	drainPendingWork(state);
	const pendingOverloadSets = buildPendingOverloadSets(state);
	const sortedTypes = assignTypeOrdinals(state);
	const sortedSignatures = assignSignatureOrdinals(state);
	const sortedTypeParameters = assignTypeParameterOrdinals(state);
	const allSignatureParameters = assignSignatureParameterOrdinals(sortedSignatures);
	const types = projectTypes(state, sortedTypes);
	const typeParameters = projectTypeParameters(state, sortedTypeParameters);
	const signatureParameters = projectSignatureParameters(state, allSignatureParameters);
	const signatures = projectSignatures(state, sortedSignatures);
	const sortedOverloadSets = [...pendingOverloadSets].sort(
		(left, right) => left.callableSymbolOrdinal - right.callableSymbolOrdinal
	);
	const overloadSets = projectOverloadSets(state, sortedOverloadSets);
	const typeRelations = buildTypeRelations(state, sortedTypeParameters, sortedOverloadSets);
	state.guard.check();
	return {
		overloadSets,
		signatureParameters,
		signatures,
		typeParameters,
		typeRelations,
		types
	};
}
