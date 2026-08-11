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
	return left < right ? -1 : left > right ? 1 : 0;
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

/**
 * Extracts Program-local type facts using only the public TypeScript API. All
 * transient Type, Signature, Symbol, and Node objects are discarded before the
 * returned raw projection crosses the provider boundary.
 */
export function extractTypeScriptTypes(
	input: ExtractTypeScriptTypesInput
): RawTypeScriptTypeProjection {
	const { checker, guard } = input;
	guard.check();
	const symbolOrdinalBySymbol = new Map<ts.Symbol, number>();
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
	for (const symbol of [...input.symbols].sort(
		(left, right) => left.symbolOrdinal - right.symbolOrdinal
	)) {
		for (const representative of symbol.representatives) {
			const existing = symbolOrdinalBySymbol.get(representative);
			if (existing !== undefined && existing !== symbol.symbolOrdinal)
				throw new Error('Type extraction received a symbol in multiple canonical groups.');
			symbolOrdinalBySymbol.set(representative, symbol.symbolOrdinal);
		}
		for (const bridge of symbol.declarations) {
			const canonical = declarationByOrdinal.get(bridge.declarationOrdinal);
			if (canonical === undefined || canonical.declaration !== bridge.declaration)
				throw new Error('Type extraction symbol bridge lacks its canonical declaration.');
		}
	}

	interface DisplayPathReplacement {
		readonly absolute: string;
		readonly logical: string;
	}
	const extensionPattern = /(?:\.d\.(?:cts|mts|ts)|\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx))$/iu;
	const withoutSourceExtension = (value: string): string => value.replace(extensionPattern, '');
	const replacementByAbsolute = new Map<string, string>();
	for (const source of input.sources) {
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
	const displayPathReplacements: readonly DisplayPathReplacement[] = [
		...replacementByAbsolute.entries()
	]
		.map(([absolute, logical]) => ({ absolute, logical }))
		.sort(
			(left, right) =>
				right.absolute.length - left.absolute.length ||
				compareStrings(left.absolute, right.absolute) ||
				compareStrings(left.logical, right.logical)
		);
	const importSpecifierPattern = /\bimport\((["'])([^"']*)\1\)/gu;
	function isAbsoluteImportSpecifier(value: string): boolean {
		return /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/u.test(value);
	}
	function canonicalDisplay(value: string): string {
		const canonical = value.replace(
			importSpecifierPattern,
			(_match, quote: string, specifier: string) => {
				const replacement = displayPathReplacements.find(
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

	function query<T>(kind: string, discriminator: string, action: () => T): T {
		guard.check();
		const result = guard.query(
			`${input.projectKey}\0type\0${kind}\0${sha256(discriminator)}`,
			action
		);
		guard.check();
		return result;
	}

	interface SelectorNodeBinding {
		readonly node: ts.Node;
		readonly nodeOrdinal: number;
		readonly sourceOrdinal: number;
	}
	const selectorNodes = new Map<string, SelectorNodeBinding | null>();
	const selectorNodeKey = (selector: {
		readonly end: number;
		readonly logicalPath: string;
		readonly start: number;
		readonly syntaxKind: number;
	}): string =>
		canonicalSemanticJson({
			end: selector.end,
			logicalPath: selector.logicalPath,
			start: selector.start,
			syntaxKind: selector.syntaxKind
		});
	for (const source of [...input.sources].sort((left, right) =>
		compareStrings(left.logicalPath, right.logicalPath)
	)) {
		for (let nodeOrdinal = 0; nodeOrdinal < (source.nodes?.length ?? 0); nodeOrdinal += 1) {
			guard.check();
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
			selectorNodes.set(
				key,
				selectorNodes.has(key) ? null : { node, nodeOrdinal, sourceOrdinal: source.sourceOrdinal }
			);
		}
	}

	let nextTypeDiscoveryOrdinal = 0;
	let nextSignatureDiscoveryOrdinal = 0;
	const pendingTypes: PendingType[] = [];
	const pendingTypesByObject = new Map<ts.Type, PendingType>();
	const pendingSignatures: PendingSignature[] = [];
	const pendingSignaturesByObject = new Map<ts.Signature, PendingSignature>();
	const pendingRelations: PendingRelation[] = [];
	const pendingTypeOfKeys = new Set<string>();
	const pendingTypeParameters = new Map<string, PendingTypeParameter>();
	const overloadEntriesBySymbol = new Map<number, PendingOverloadMember[]>();
	const overloadImplementationByDeclaration = new Map<number, boolean>();
	const canonicalSignatureByDeclaration = new Map<number, ts.Signature | undefined>();

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

	function discoverType(type: ts.Type, anchor: PendingTypeAnchor): PendingType {
		guard.check();
		let pending = pendingTypesByObject.get(type);
		if (pending === undefined) {
			pending = {
				acquisitionAnchors: new Map(),
				aliasSymbolOrdinal: null,
				category: null,
				constraint: null,
				defaultType: null,
				discoveryOrdinal: nextTypeDiscoveryOrdinal++,
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
			pendingTypesByObject.set(type, pending);
			pendingTypes.push(pending);
		}
		const key = anchorKey(anchor);
		pending.acquisitionAnchors.set(key, anchor);
		pending.queryAnchors.add(key);
		return pending;
	}

	function addTypeOf(
		subject: RawSemanticTypeSubjectRef,
		queryMode: SemanticTypeQueryMode,
		type: PendingType
	): void {
		const key = canonicalSemanticJson({ kind: 'TYPE_OF', queryMode, subject });
		if (pendingTypeOfKeys.has(key)) return;
		pendingTypeOfKeys.add(key);
		pendingRelations.push({ kind: 'TYPE_OF', queryMode, subject, type });
	}

	const selectorTypeCache = new Map<string, PendingType | null>();
	function resolveSelectorType(
		selector: SemanticAssignabilityRequest['source']
	): PendingType | null {
		const cacheKey = canonicalSemanticJson(selector);
		if (selectorTypeCache.has(cacheKey)) return selectorTypeCache.get(cacheKey) ?? null;
		const binding = selectorNodes.get(selectorNodeKey(selector));
		if (binding === undefined || binding === null) {
			selectorTypeCache.set(cacheKey, null);
			return null;
		}
		let type: ts.Type | undefined;
		switch (selector.queryMode) {
			case 'TYPE_AT_LOCATION':
				type = query('selector-type-at-location', cacheKey, () =>
					checker.getTypeAtLocation(binding.node)
				);
				break;
			case 'TYPE_FROM_TYPE_NODE':
				if (!ts.isTypeNode(binding.node)) {
					selectorTypeCache.set(cacheKey, null);
					return null;
				}
				type = query('selector-type-from-node', cacheKey, () =>
					checker.getTypeFromTypeNode(binding.node as ts.TypeNode)
				);
				break;
			case 'DECLARED_SYMBOL_TYPE': {
				const symbol = query('selector-declared-symbol', cacheKey, () =>
					checker.getSymbolAtLocation(binding.node)
				);
				if (symbol === undefined) {
					selectorTypeCache.set(cacheKey, null);
					return null;
				}
				type = query('selector-declared-symbol-type', cacheKey, () =>
					checker.getDeclaredTypeOfSymbol(symbol)
				);
				break;
			}
			case 'VALUE_SYMBOL_TYPE_AT_LOCATION': {
				const symbol = query('selector-value-symbol', cacheKey, () =>
					checker.getSymbolAtLocation(binding.node)
				);
				if (symbol === undefined) {
					selectorTypeCache.set(cacheKey, null);
					return null;
				}
				type = query('selector-value-symbol-type', cacheKey, () =>
					checker.getTypeOfSymbolAtLocation(symbol, binding.node)
				);
				break;
			}
		}
		const pending = discoverType(type, {
			kind: 'NODE',
			nodeOrdinal: binding.nodeOrdinal,
			queryMode: selector.queryMode,
			sourceOrdinal: binding.sourceOrdinal
		});
		addTypeOf(
			{
				kind: 'AST_NODE',
				nodeOrdinal: binding.nodeOrdinal,
				sourceOrdinal: binding.sourceOrdinal
			},
			selector.queryMode,
			pending
		);
		selectorTypeCache.set(cacheKey, pending);
		return pending;
	}

	for (const request of input.assignabilityRequests) {
		guard.check();
		const sourceType = resolveSelectorType(request.source);
		const targetType = resolveSelectorType(request.target);
		const result =
			sourceType === null || targetType === null
				? null
				: query('assignability', canonicalSemanticJson(request), () =>
						checker.isTypeAssignableTo(sourceType.type, targetType.type)
					);
		pendingRelations.push({
			kind: 'ASSIGNABILITY',
			requestId: request.requestId,
			result,
			sourceType,
			targetType
		});
	}

	function discoverSignature(
		signature: ts.Signature,
		acquisition: PendingSignatureAcquisition
	): PendingSignature {
		guard.check();
		let pending = pendingSignaturesByObject.get(signature);
		if (pending === undefined) {
			pending = {
				acquisitions: new Map(),
				declaration: null,
				declarationRole: 'UNKNOWN',
				discoveryOrdinal: nextSignatureDiscoveryOrdinal++,
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
			pendingSignaturesByObject.set(signature, pending);
			pendingSignatures.push(pending);
		}
		if (pending.signatureKind !== null && pending.signatureKind !== acquisition.signatureKind)
			throw new Error('A public TypeScript Signature was observed as both call and construct.');
		pending.signatureKind = acquisition.signatureKind;
		pending.acquisitions.set(acquisition.key, acquisition);
		if (acquisition.declaration !== null)
			observeSignatureDeclaration(pending, acquisition.declaration);
		return pending;
	}

	function canonicalSignatureForDeclaration(
		declaration: TypeScriptTypeDeclarationBridge
	): ts.Signature | undefined {
		if (canonicalSignatureByDeclaration.has(declaration.declarationOrdinal))
			return canonicalSignatureByDeclaration.get(declaration.declarationOrdinal);
		const signature = query(
			'signature-from-declaration',
			String(declaration.declarationOrdinal),
			() => checker.getSignatureFromDeclaration(declaration.declaration as ts.SignatureDeclaration)
		);
		canonicalSignatureByDeclaration.set(declaration.declarationOrdinal, signature);
		return signature;
	}

	function observeSignatureDeclaration(
		pending: PendingSignature,
		declaration: TypeScriptTypeDeclarationBridge
	): void {
		if (
			pending.declaration === null ||
			declaration.declarationOrdinal < pending.declaration.declarationOrdinal
		)
			pending.declaration = declaration;
		if (
			canonicalSignatureForDeclaration(declaration) === pending.signature &&
			(pending.identityDeclaration === null ||
				declaration.declarationOrdinal < pending.identityDeclaration.declarationOrdinal)
		)
			pending.identityDeclaration = declaration;
	}

	function overloadImplementation(declaration: TypeScriptTypeDeclarationBridge): boolean {
		const existing = overloadImplementationByDeclaration.get(declaration.declarationOrdinal);
		if (existing !== undefined) return existing;
		const implementation =
			query('overload-implementation', String(declaration.declarationOrdinal), () =>
				checker.isImplementationOfOverload(declaration.declaration as ts.SignatureDeclaration)
			) === true;
		overloadImplementationByDeclaration.set(declaration.declarationOrdinal, implementation);
		return implementation;
	}

	function addOverloadEntry(
		callableSymbolOrdinal: number,
		declaration: TypeScriptTypeDeclarationBridge,
		signature: PendingSignature
	): void {
		if (signature.identityDeclaration?.declarationOrdinal !== declaration.declarationOrdinal)
			throw new Error('An overload member must use the canonical declaration Signature.');
		const entries = overloadEntriesBySymbol.get(callableSymbolOrdinal) ?? [];
		entries.push({
			declaration,
			implementation: overloadImplementation(declaration),
			signature
		});
		overloadEntriesBySymbol.set(callableSymbolOrdinal, entries);
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

	function loadTypeParameterBounds(parameterType: PendingType): void {
		if (parameterType.typeParameterBoundsLoaded) return;
		parameterType.typeParameterBoundsLoaded = true;
		const key = String(parameterType.discoveryOrdinal);
		const constraint = query('type-parameter-constraint', key, () =>
			checker.getBaseConstraintOfType(parameterType.type)
		);
		const defaultType = query('type-parameter-default', key, () =>
			checker.getDefaultFromTypeParameter(parameterType.type)
		);
		parameterType.constraint =
			constraint === undefined
				? null
				: discoverType(constraint, {
						componentKind: 'GENERIC_TARGET',
						componentOrdinal: 0,
						kind: 'TYPE_COMPONENT',
						parent: parameterType
					});
		parameterType.defaultType =
			defaultType === undefined
				? null
				: discoverType(defaultType, {
						componentKind: 'TYPE_ARGUMENT',
						componentOrdinal: 0,
						kind: 'TYPE_COMPONENT',
						parent: parameterType
					});
	}

	function addTypeParameter(
		owner: PendingTypeParameterOwner,
		ordinal: number,
		parameterType: PendingType,
		declaration: ts.TypeParameterDeclaration | null
	): PendingTypeParameter {
		const declarationBridge =
			declaration === null ? null : (declarationByNode.get(declaration) ?? null);
		const typeSymbol = query(
			'type-parameter-symbol',
			`${pendingTypeParameterOwnerKey(owner)}\0${String(ordinal)}`,
			() => parameterType.type.getSymbol()
		);
		loadTypeParameterBounds(parameterType);
		const key = `${pendingTypeParameterOwnerKey(owner)}\0${String(ordinal)}\0${String(declarationBridge?.declarationOrdinal ?? -1)}`;
		const existing = pendingTypeParameters.get(key);
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
					: query('type-parameter-name', key, () => typeSymbol.getName())
			),
			ordinal,
			owner,
			parameterType,
			typeParameterOrdinal: -1
		};
		pendingTypeParameters.set(key, pending);
		return pending;
	}

	const sortedSymbols = [...input.symbols].sort(
		(left, right) => left.symbolOrdinal - right.symbolOrdinal
	);
	const processedDeclarationOrdinals = new Set<number>();
	for (const symbol of sortedSymbols) {
		guard.check();
		const representative = symbol.representatives[0];
		const declarations = [...symbol.declarations].sort(
			(left, right) => left.declarationOrdinal - right.declarationOrdinal
		);
		const location = declarations[0]?.declaration;
		if (representative !== undefined && (symbol.flags & ts.SymbolFlags.Type) !== 0) {
			const type = query('declared-symbol-type', String(symbol.symbolOrdinal), () =>
				checker.getDeclaredTypeOfSymbol(representative)
			);
			const pending = discoverType(type, {
				kind: 'SYMBOL',
				queryMode: 'DECLARED_SYMBOL_TYPE',
				symbolOrdinal: symbol.symbolOrdinal
			});
			addTypeOf(
				{ kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
				'DECLARED_SYMBOL_TYPE',
				pending
			);
		}
		if (
			representative !== undefined &&
			location !== undefined &&
			(symbol.flags & ts.SymbolFlags.Value) !== 0
		) {
			const type = query('value-symbol-type', String(symbol.symbolOrdinal), () =>
				checker.getTypeOfSymbolAtLocation(representative, location)
			);
			const pending = discoverType(type, {
				kind: 'SYMBOL',
				queryMode: 'VALUE_SYMBOL_TYPE_AT_LOCATION',
				symbolOrdinal: symbol.symbolOrdinal
			});
			addTypeOf(
				{ kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
				'VALUE_SYMBOL_TYPE_AT_LOCATION',
				pending
			);
		}

		for (const bridge of declarations) {
			if (processedDeclarationOrdinals.has(bridge.declarationOrdinal)) continue;
			processedDeclarationOrdinals.add(bridge.declarationOrdinal);
			const declaration = bridge.declaration;
			// SourceFile is a declaration carrier, but it is not a valid public
			// getTypeAtLocation query node because it has no parent.
			if (ts.isSourceFile(declaration)) continue;
			const declarationSubject = {
				declarationOrdinal: bridge.declarationOrdinal,
				kind: 'DECLARATION' as const
			};
			const locationType = query(
				'declaration-type-at-location',
				String(bridge.declarationOrdinal),
				() => checker.getTypeAtLocation(declaration)
			);
			const pendingLocationType = discoverType(locationType, {
				declarationOrdinal: bridge.declarationOrdinal,
				kind: 'DECLARATION',
				queryMode: 'TYPE_AT_LOCATION'
			});
			addTypeOf(declarationSubject, 'TYPE_AT_LOCATION', pendingLocationType);

			const typeNode = declarationTypeNode(declaration);
			if (typeNode !== null) {
				const explicitType = query(
					'declaration-type-from-node',
					String(bridge.declarationOrdinal),
					() => checker.getTypeFromTypeNode(typeNode)
				);
				const nodeAnchor = input.nodeAnchorForNode(typeNode);
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
				const pendingExplicitType = discoverType(explicitType, acquisition);
				addTypeOf(
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
					pendingRelations.push({
						aliasDeclarationOrdinal: bridge.declarationOrdinal,
						aliasedType: pendingExplicitType,
						kind: 'TYPE_ALIAS'
					});
			}

			const signatureKind = signatureKindForDeclaration(declaration);
			if (signatureKind !== null) {
				const signature = canonicalSignatureForDeclaration(bridge);
				if (signature !== undefined) {
					const pendingSignature = discoverSignature(signature, {
						declaration: bridge,
						key: `SYMBOL:${String(symbol.symbolOrdinal)}:DECLARATION:${String(bridge.declarationOrdinal)}`,
						owner: { kind: 'SYMBOL', symbolOrdinal: symbol.symbolOrdinal },
						providerOrdinal: null,
						signatureKind
					});
					addOverloadEntry(symbol.symbolOrdinal, bridge, pendingSignature);
				}
			}

			if (signatureKind === null) {
				for (
					let ordinal = 0;
					ordinal < declarationTypeParameters(declaration).length;
					ordinal += 1
				) {
					const parameterDeclaration = declarationTypeParameters(declaration)[ordinal]!;
					const parameterBridge = declarationByNode.get(parameterDeclaration) ?? null;
					const parameterNodeAnchor = input.nodeAnchorForNode(parameterDeclaration);
					if (parameterBridge === null && parameterNodeAnchor === null) continue;
					const parameterType = query(
						'declaration-type-parameter',
						`${String(bridge.declarationOrdinal)}\0${String(ordinal)}`,
						() => checker.getTypeAtLocation(parameterDeclaration)
					);
					const pendingParameterType = discoverType(
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

			if (
				ts.isClassDeclaration(declaration) ||
				ts.isClassExpression(declaration) ||
				ts.isInterfaceDeclaration(declaration)
			) {
				const derivedType = pendingLocationType;
				for (const heritageClause of declaration.heritageClauses ?? []) {
					const kind =
						heritageClause.token === ts.SyntaxKind.ImplementsKeyword
							? ('TYPE_IMPLEMENTATION' as const)
							: ('TYPE_EXTENSION' as const);
					for (let ordinal = 0; ordinal < heritageClause.types.length; ordinal += 1) {
						const heritageTypeNode = heritageClause.types[ordinal]!;
						const nodeAnchor = input.nodeAnchorForNode(heritageTypeNode);
						if (nodeAnchor === null) continue;
						const baseType = query(
							'heritage-type',
							`${String(bridge.declarationOrdinal)}\0${kind}\0${String(ordinal)}`,
							() => checker.getTypeAtLocation(heritageTypeNode)
						);
						const pendingBaseType = discoverType(baseType, {
							kind: 'NODE',
							nodeOrdinal: nodeAnchor.nodeOrdinal,
							queryMode: 'TYPE_AT_LOCATION',
							sourceOrdinal: nodeAnchor.sourceOrdinal
						});
						addTypeOf(
							{
								kind: 'AST_NODE',
								nodeOrdinal: nodeAnchor.nodeOrdinal,
								sourceOrdinal: nodeAnchor.sourceOrdinal
							},
							'TYPE_AT_LOCATION',
							pendingBaseType
						);
						pendingRelations.push({
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
				}
			}
		}
	}

	function processType(pending: PendingType): void {
		if (pending.processed) return;
		guard.check();
		const key = String(pending.discoveryOrdinal);
		pending.flags = query('type-flags', key, () => pending.type.getFlags());
		pending.flagNames = flagNames(pending.flags, ts.TypeFlags);
		pending.category = typeCategory(pending.flags);
		pending.objectFlags =
			(pending.flags & ts.TypeFlags.Object) === 0
				? null
				: query('object-flags', key, () => (pending.type as ts.ObjectType).objectFlags);
		pending.objectFlagNames =
			pending.objectFlags === null ? [] : flagNames(pending.objectFlags, ts.ObjectFlags);
		const symbol = query('type-symbol', key, () => pending.type.getSymbol());
		pending.symbolOrdinal =
			symbol === undefined ? null : (symbolOrdinalBySymbol.get(symbol) ?? null);
		const aliasSymbol = query('type-alias-symbol', key, () => pending.type.aliasSymbol);
		pending.aliasSymbolOrdinal =
			aliasSymbol === undefined ? null : (symbolOrdinalBySymbol.get(aliasSymbol) ?? null);
		pending.display = canonicalDisplay(
			query('type-display', key, () => checker.typeToString(pending.type))
		);
		pending.displaySha256 = sha256(pending.display);

		if ((pending.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection)) !== 0) {
			const constituents = query('type-constituents', key, () => [
				...(pending.type as ts.UnionOrIntersectionType).types
			]);
			const relationKind =
				(pending.flags & ts.TypeFlags.Union) !== 0
					? ('UNION_CONSTITUENT' as const)
					: ('INTERSECTION_CONSTITUENT' as const);
			const discovered = constituents.map((constituent, ordinal) =>
				discoverType(constituent, {
					componentKind: relationKind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION',
					componentOrdinal: ordinal,
					kind: 'TYPE_COMPONENT',
					parent: pending
				})
			);
			if (relationKind === 'UNION_CONSTITUENT') pending.unionConstituents = discovered;
			else pending.intersectionConstituents = discovered;
			for (let ordinal = 0; ordinal < discovered.length; ordinal += 1)
				pendingRelations.push({
					compositeType: pending,
					constituentType: discovered[ordinal]!,
					kind: relationKind,
					ordinal
				});
		}

		if (pending.objectFlags !== null && (pending.objectFlags & ts.ObjectFlags.Reference) !== 0) {
			const reference = pending.type as ts.TypeReference;
			const target = query('generic-target', key, () => reference.target);
			const argumentsValue = query('generic-arguments', key, () => [
				...checker.getTypeArguments(reference)
			]);
			if (target !== pending.type || argumentsValue.length > 0) {
				pending.genericTarget = discoverType(target, {
					componentKind: 'GENERIC_TARGET',
					componentOrdinal: 0,
					kind: 'TYPE_COMPONENT',
					parent: pending
				});
				pending.genericArguments = argumentsValue.map((argument, ordinal) =>
					discoverType(argument, {
						componentKind: 'TYPE_ARGUMENT',
						componentOrdinal: ordinal,
						kind: 'TYPE_COMPONENT',
						parent: pending
					})
				);
				pendingRelations.push({
					argumentTypes: pending.genericArguments,
					genericTarget: pending.genericTarget,
					instantiatedTarget: pending,
					kind: 'GENERIC_INSTANTIATION'
				});
			}
		} else if (aliasSymbol !== undefined) {
			const aliasArguments = query('alias-type-arguments', key, () => [
				...(pending.type.aliasTypeArguments ?? [])
			]);
			if (aliasArguments.length > 0) {
				const target = query('alias-generic-target', key, () =>
					checker.getDeclaredTypeOfSymbol(aliasSymbol)
				);
				if (target !== pending.type) {
					pending.genericTarget = discoverType(target, {
						componentKind: 'GENERIC_TARGET',
						componentOrdinal: 0,
						kind: 'TYPE_COMPONENT',
						parent: pending
					});
					pending.genericArguments = aliasArguments.map((argument, ordinal) =>
						discoverType(argument, {
							componentKind: 'TYPE_ARGUMENT',
							componentOrdinal: ordinal,
							kind: 'TYPE_COMPONENT',
							parent: pending
						})
					);
					pendingRelations.push({
						argumentTypes: pending.genericArguments,
						genericTarget: pending.genericTarget,
						instantiatedTarget: pending,
						kind: 'GENERIC_INSTANTIATION'
					});
				}
			}
		}

		for (const [signatureKind, compilerKind] of [
			['CALL', ts.SignatureKind.Call],
			['CONSTRUCT', ts.SignatureKind.Construct]
		] as const) {
			const signatures = query(`${signatureKind.toLowerCase()}-signatures`, key, () => [
				...checker.getSignaturesOfType(pending.type, compilerKind)
			]);
			for (let providerOrdinal = 0; providerOrdinal < signatures.length; providerOrdinal += 1) {
				const signature = signatures[providerOrdinal]!;
				const compilerDeclaration = query(
					'type-signature-declaration',
					`${key}\0${signatureKind}\0${String(providerOrdinal)}`,
					() => signature.declaration
				);
				const declaration =
					compilerDeclaration === undefined
						? null
						: (declarationByNode.get(compilerDeclaration) ?? null);
				const acquisition: PendingSignatureAcquisition = {
					declaration,
					key: `TYPE:${String(pending.discoveryOrdinal)}:${signatureKind}:${String(providerOrdinal)}`,
					owner: { kind: 'TYPE', type: pending },
					providerOrdinal,
					signatureKind
				};
				discoverSignature(signature, acquisition);
				const canonicalSignature =
					declaration === null ? undefined : canonicalSignatureForDeclaration(declaration);
				const canonicalPending =
					canonicalSignature === undefined
						? null
						: discoverSignature(canonicalSignature, acquisition);
				const callableSymbolOrdinal = pending.symbolOrdinal ?? pending.aliasSymbolOrdinal;
				if (callableSymbolOrdinal !== null && declaration !== null && canonicalPending !== null)
					addOverloadEntry(callableSymbolOrdinal, declaration, canonicalPending);
			}
		}
		pending.unsupportedStructureKinds = unsupportedStructureKinds(
			pending.flags,
			pending.objectFlags
		);
		pending.processed = true;
	}

	function signatureDeclaration(pending: PendingSignature): TypeScriptTypeDeclarationBridge | null {
		if (pending.declaration !== null) return pending.declaration;
		const declaration = query(
			'signature-declaration',
			String(pending.discoveryOrdinal),
			() => pending.signature.declaration
		);
		return declaration === undefined ? null : (declarationByNode.get(declaration) ?? null);
	}

	function parameterDeclaration(
		symbol: ts.Symbol,
		fallback: ts.ParameterDeclaration | null,
		key: string
	): TypeScriptTypeDeclarationBridge | null {
		if (fallback !== null) {
			const bridge = declarationByNode.get(fallback);
			if (bridge !== undefined) return bridge;
		}
		const declarations = query('signature-parameter-declarations', key, () => [
			...(symbol.getDeclarations() ?? [])
		]);
		return (
			declarations
				.map((declaration) => declarationByNode.get(declaration) ?? null)
				.filter((bridge): bridge is TypeScriptTypeDeclarationBridge => bridge !== null)
				.sort((left, right) => left.declarationOrdinal - right.declarationOrdinal)[0] ?? null
		);
	}

	function processSignature(pending: PendingSignature): void {
		if (pending.processed) return;
		guard.check();
		if (pending.signatureKind === null)
			throw new Error('A discovered TypeScript Signature lacks a semantic kind.');
		const key = String(pending.discoveryOrdinal);
		const declarationBridge = signatureDeclaration(pending);
		if (declarationBridge !== null) observeSignatureDeclaration(pending, declarationBridge);
		if (pending.declarationRole === 'UNKNOWN')
			pending.declarationRole = declarationRole(
				pending.declaration?.declaration ?? null,
				false,
				false
			);
		pending.display = canonicalDisplay(
			query('signature-display', key, () => checker.signatureToString(pending.signature))
		);
		pending.displaySha256 = sha256(pending.display);
		const returnType = query('signature-return-type', key, () =>
			checker.getReturnTypeOfSignature(pending.signature)
		);
		pending.returnType = discoverType(returnType, {
			componentKind: 'RETURN',
			componentOrdinal: 0,
			kind: 'SIGNATURE_COMPONENT',
			signature: pending
		});
		const declaration = pending.declaration?.declaration;
		const signatureDeclarationNode =
			declaration !== undefined && ts.isFunctionLike(declaration) ? declaration : null;
		const compilerParameters = query('signature-parameters', key, () => [
			...pending.signature.getParameters()
		]);
		const parameterRecords: PendingSignatureParameter[] = [];
		const thisParameter = query(
			'signature-this-parameter',
			key,
			() => pending.signature.thisParameter
		);
		const parameterInputs: {
			readonly fallback: ts.ParameterDeclaration | null;
			readonly ordinal: number;
			readonly role: 'THIS' | 'PARAMETER';
			readonly symbol: ts.Symbol;
		}[] = [];
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
		for (const parameter of parameterInputs) {
			const parameterKey = `${key}\0${parameter.role}\0${String(parameter.ordinal)}`;
			const bridge = parameterDeclaration(parameter.symbol, parameter.fallback, parameterKey);
			const location = bridge?.declaration ?? declaration;
			const parameterType =
				location === undefined
					? query('signature-parameter-type', parameterKey, () =>
							checker.getTypeOfSymbol(parameter.symbol)
						)
					: query('signature-parameter-type-at-location', parameterKey, () =>
							checker.getTypeOfSymbolAtLocation(parameter.symbol, location)
						);
			const name = representableText(
				query('signature-parameter-name', parameterKey, () => parameter.symbol.getName())
			);
			const parameterDeclarationNode =
				bridge?.declaration !== undefined && ts.isParameter(bridge.declaration)
					? bridge.declaration
					: parameter.fallback;
			const optional =
				parameter.role === 'THIS' || parameterDeclarationNode === null
					? false
					: query('signature-parameter-optional', parameterKey, () =>
							checker.isOptionalParameter(parameterDeclarationNode)
						);
			parameterRecords.push({
				declarationOrdinal: bridge?.declarationOrdinal ?? null,
				name,
				optional,
				ordinal: parameter.ordinal,
				rest: parameterDeclarationNode?.dotDotDotToken !== undefined,
				role: parameter.role,
				signature: pending,
				signatureParameterOrdinal: -1,
				symbolOrdinal: symbolOrdinalBySymbol.get(parameter.symbol) ?? null,
				type: discoverType(parameterType, {
					componentKind: parameter.role,
					componentOrdinal: parameter.ordinal,
					kind: 'SIGNATURE_COMPONENT',
					signature: pending
				})
			});
		}
		pending.parameterRecords = parameterRecords;

		const compilerTypeParameters =
			query('signature-type-parameters', key, () => pending.signature.getTypeParameters()) ?? [];
		const declarationTypeParameterNodes =
			signatureDeclarationNode?.typeParameters === undefined
				? []
				: [...signatureDeclarationNode.typeParameters];
		pending.typeParameterRecords = compilerTypeParameters.map((parameterType, ordinal) =>
			addTypeParameter(
				{ kind: 'SIGNATURE', signature: pending },
				ordinal,
				discoverType(parameterType, {
					componentKind: 'TYPE_PARAMETER',
					componentOrdinal: ordinal,
					kind: 'SIGNATURE_COMPONENT',
					signature: pending
				}),
				declarationTypeParameterNodes[ordinal] ?? null
			)
		);
		pending.processed = true;
	}

	let typeCursor = 0;
	let signatureCursor = 0;
	while (typeCursor < pendingTypes.length || signatureCursor < pendingSignatures.length) {
		while (typeCursor < pendingTypes.length) processType(pendingTypes[typeCursor++]!);
		while (signatureCursor < pendingSignatures.length)
			processSignature(pendingSignatures[signatureCursor++]!);
	}

	const pendingOverloadSets: PendingOverloadSet[] = [];
	for (const [callableSymbolOrdinal, entriesValue] of [...overloadEntriesBySymbol].sort(
		(left, right) => left[0] - right[0]
	)) {
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
		const entries = [...entriesByDeclaration.values()].sort(
			(left, right) =>
				left.declaration.declarationOrdinal - right.declaration.declarationOrdinal ||
				left.signature.discoveryOrdinal - right.signature.discoveryOrdinal
		);
		const kindCounts = new Map<SemanticSignatureKind, number>();
		for (const entry of entries) {
			const kind = entry.signature.signatureKind;
			if (kind !== null) kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
		}
		const overloadedKinds = new Set(
			[...kindCounts.entries()].flatMap(([kind, count]) => (count >= 2 ? [kind] : []))
		);
		const members = entries.filter(
			(entry) =>
				entry.signature.signatureKind !== null && overloadedKinds.has(entry.signature.signatureKind)
		);
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
		if (members.length >= 2)
			pendingOverloadSets.push({
				callableSymbolOrdinal,
				members,
				overloadSetOrdinal: -1
			});
	}

	function primaryTypeAnchor(type: PendingType): string {
		return (
			[...type.queryAnchors].sort(compareStrings)[0] ?? `DISCOVERY:${String(type.discoveryOrdinal)}`
		);
	}

	for (const pending of pendingTypes) {
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
	const sortedTypes = [...pendingTypes].sort(
		(left, right) =>
			compareStrings(left.fingerprintSha256, right.fingerprintSha256) ||
			compareStrings(left.fingerprintInput, right.fingerprintInput)
	);
	for (let typeOrdinal = 0; typeOrdinal < sortedTypes.length; typeOrdinal += 1)
		sortedTypes[typeOrdinal]!.typeOrdinal = typeOrdinal;

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

	function providerOrdinal(
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

	for (const pending of pendingSignatures) {
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
			providerOrdinal: providerOrdinal(pending, owner),
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
	const sortedSignatures = [...pendingSignatures].sort(
		(left, right) =>
			compareStrings(left.fingerprintSha256, right.fingerprintSha256) ||
			compareStrings(left.fingerprintInput, right.fingerprintInput)
	);
	for (let signatureOrdinal = 0; signatureOrdinal < sortedSignatures.length; signatureOrdinal += 1)
		sortedSignatures[signatureOrdinal]!.signatureOrdinal = signatureOrdinal;

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

	const sortedTypeParameters = [...pendingTypeParameters.values()].sort(
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

	const types: RawSemanticType[] = sortedTypes.map((pending) => {
		guard.addFact();
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

	const typeParameters: RawSemanticTypeParameter[] = sortedTypeParameters.map((pending) => {
		guard.addFact();
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

	const signatureParameters: RawSemanticSignatureParameter[] = allSignatureParameters.map(
		(pending) => {
			guard.addFact();
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
		}
	);

	const signatures: RawSemanticSignature[] = sortedSignatures.map((pending) => {
		guard.addFact();
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
			providerOrdinal: providerOrdinal(pending, owner),
			returnTypeOrdinal: pending.returnType!.typeOrdinal,
			semanticKind: pending.semanticKind,
			signatureKind: pending.signatureKind!,
			signatureOrdinal: pending.signatureOrdinal,
			typeParameterOrdinals: pending.typeParameterRecords
				.map((parameter) => parameter.typeParameterOrdinal)
				.sort((left, right) => left - right)
		};
	});

	const sortedOverloadSets = [...pendingOverloadSets].sort(
		(left, right) => left.callableSymbolOrdinal - right.callableSymbolOrdinal
	);
	const overloadSets: RawSemanticOverloadSet[] = sortedOverloadSets.map((pending, ordinal) => {
		pending.overloadSetOrdinal = ordinal;
		guard.addFact();
		return { callableSymbolOrdinal: pending.callableSymbolOrdinal, overloadSetOrdinal: ordinal };
	});

	const hasAssignabilityRelations = pendingRelations.some(
		(relation) => relation.kind === 'ASSIGNABILITY'
	);
	const checkerContextDigest = hasAssignabilityRelations
		? input.resolveCheckerContextDigest()
		: null;
	if (checkerContextDigest !== null && !/^[a-f0-9]{64}$/u.test(checkerContextDigest))
		throw new Error('Type extraction checker-context resolver must return lowercase SHA-256.');
	const unnumberedRelations: UnnumberedRawTypeRelation[] = pendingRelations.map((relation) => {
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
				return {
					checkerContextDigest: checkerContextDigest!,
					kind: relation.kind,
					requestId: relation.requestId,
					result: relation.result,
					sourceTypeOrdinal: relation.sourceType?.typeOrdinal ?? null,
					state:
						relation.sourceType !== null && relation.targetType !== null
							? 'CONFIRMED'
							: 'UNRESOLVED',
					targetTypeOrdinal: relation.targetType?.typeOrdinal ?? null
				};
		}
	});
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
	const typeRelations: RawSemanticTypeRelation[] = canonicalRelations.map(
		(relation, relationOrdinal) => {
			guard.addFact();
			return { ...relation, relationOrdinal } as RawSemanticTypeRelation;
		}
	);
	guard.check();
	return {
		overloadSets,
		signatureParameters,
		signatures,
		typeParameters,
		typeRelations,
		types
	};
}
