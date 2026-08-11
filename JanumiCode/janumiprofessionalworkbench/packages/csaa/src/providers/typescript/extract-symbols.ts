import ts from 'typescript';
import type {
	SemanticAssignabilityRequest,
	SemanticDeclarationCandidateNameState,
	SemanticModuleOccurrenceKind,
	SemanticReferenceRole,
	SemanticScopeDomain,
	SemanticScopeKind,
	SemanticScopeLinkState
} from '../../contracts/semantic.js';
import {
	canonicalSemanticJson,
	encodeSemanticDiagnosticText,
	isUnicodeScalarString
} from '../../semantic/canonical.js';
import type {
	RawSemanticAlias,
	RawSemanticDeclaration,
	RawSemanticDeclarationCandidate,
	RawSemanticModuleExport,
	RawSemanticModuleResolution,
	RawSemanticOverloadSet,
	RawSemanticPartialityReason,
	RawSemanticReference,
	RawSemanticScope,
	RawSemanticSignature,
	RawSemanticSignatureParameter,
	RawSemanticSource,
	RawSemanticSymbol,
	RawSemanticType,
	RawSemanticTypeParameter,
	RawSemanticTypeRelation
} from '../../semantic/raw-semantic-model.js';
import {
	isOrdinaryReferenceScope,
	programGlobalScopeDescriptor,
	semanticScopeBoundaryDescriptor
} from '../../semantic/scope-taxonomy.js';
import {
	semanticDeclarationNameState,
	typescriptSyntaxKindName
} from '../../semantic/syntax-projection.js';
import { extractTypeScriptTypes } from './extract-types.js';

export interface TypeScriptSymbolExtractionGuard {
	readonly addFact: () => void;
	readonly addScope: () => void;
	readonly check: () => void;
	readonly query: <T>(key: string, action: () => T) => T;
}

export interface TypeScriptSymbolSourceInput {
	readonly declarationCandidates: readonly RawSemanticDeclarationCandidate[];
	readonly nodes: readonly ts.Node[] | null;
	readonly source: RawSemanticSource;
	readonly sourceFile: ts.SourceFile;
}

export interface ExtractTypeScriptSymbolsInput {
	readonly assignabilityRequests: readonly SemanticAssignabilityRequest[];
	readonly checker: ts.TypeChecker;
	readonly compilerOptions: ts.CompilerOptions;
	readonly guard: TypeScriptSymbolExtractionGuard;
	readonly includeTypes: boolean;
	readonly projectKey: string;
	readonly resolveCheckerContextDigest: () => string;
	readonly sources: readonly TypeScriptSymbolSourceInput[];
}

export interface RawTypeScriptSymbolProjection {
	readonly aliases: readonly RawSemanticAlias[];
	readonly declarations: readonly RawSemanticDeclaration[];
	readonly moduleExports: readonly RawSemanticModuleExport[];
	readonly moduleResolutions: readonly RawSemanticModuleResolution[];
	readonly overloadSets: readonly RawSemanticOverloadSet[];
	readonly partialityReasons: readonly RawSemanticPartialityReason[];
	readonly references: readonly RawSemanticReference[];
	readonly scopes: readonly RawSemanticScope[];
	readonly signatureParameters: readonly RawSemanticSignatureParameter[];
	readonly signatures: readonly RawSemanticSignature[];
	readonly symbols: readonly RawSemanticSymbol[];
	readonly typeParameters: readonly RawSemanticTypeParameter[];
	readonly typeRelations: readonly RawSemanticTypeRelation[];
	readonly types: readonly RawSemanticType[];
}

interface NodeAnchor {
	readonly nodeOrdinal: number;
	readonly sourceOrdinal: number;
}

interface DeclarationAnchor {
	readonly ambient: boolean;
	readonly candidateNodeOrdinal: number | null;
	readonly declaringScopeKey: string | null;
	readonly scopeLinkState: SemanticScopeLinkState;
	readonly symbolBindingState: 'RESOLVED' | 'UNSUPPORTED';
	readonly declaration: ts.Declaration;
	readonly end: number;
	readonly key: string;
	readonly kind: number;
	readonly kindName: string;
	readonly logicalPath: string;
	readonly name: string | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
	readonly nodeOrdinal: number | null;
	readonly sourceOrdinal: number;
	readonly start: number;
}

interface SymbolMetadata {
	readonly fallbackAnchors: Map<string, NodeAnchor>;
	readonly symbol: ts.Symbol;
}

interface AliasResolution {
	readonly state: RawSemanticAlias['state'];
	readonly target: ts.Symbol | null;
	readonly terminal: ts.Symbol | null;
}

interface PendingReference {
	readonly containingScopeKey: string | null;
	readonly nodeOrdinal: number;
	readonly role: SemanticReferenceRole;
	readonly scopeLinkState: SemanticScopeLinkState;
	readonly sourceOrdinal: number;
	readonly symbol: ts.Symbol | null;
}

interface ScopeAnchor {
	readonly domain: SemanticScopeDomain;
	readonly end: number | null;
	readonly key: string;
	readonly kind: SemanticScopeKind;
	readonly ownerKind: number | null;
	readonly ownerKindName: string | null;
	readonly ownerNodeOrdinal: number | null;
	readonly parentKey: string | null;
	readonly sourceOrdinal: number | null;
	readonly start: number | null;
}

interface PendingModuleResolution {
	readonly moduleSymbol: ts.Symbol | null;
	readonly nodeOrdinal: number;
	readonly occurrenceKind: SemanticModuleOccurrenceKind;
	readonly resolutionState: RawSemanticModuleResolution['resolutionState'];
	readonly sourceOrdinal: number;
	readonly specifier: string | null;
	readonly specifierState: RawSemanticModuleResolution['specifierState'];
	readonly targetSourceOrdinal: number | null;
	readonly typeOnly: boolean;
}

interface SymbolGroup {
	readonly declarations: readonly DeclarationAnchor[];
	readonly fallbackAnchors: readonly NodeAnchor[];
	readonly flags: number;
	readonly key: string;
	readonly name: string;
	readonly representatives: readonly ts.Symbol[];
	readonly symbolOrdinal: number;
}

function compareStrings(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function syntaxKindName(kind: number): string {
	return typescriptSyntaxKindName(kind) ?? `SyntaxKind(${String(kind)})`;
}

function nodeAnchorKey(anchor: NodeAnchor): string {
	return `${String(anchor.sourceOrdinal)}\0${String(anchor.nodeOrdinal)}`;
}

function isAtomicDeclarationName(node: ts.DeclarationName): boolean {
	return (
		ts.isIdentifier(node) ||
		ts.isPrivateIdentifier(node) ||
		ts.isStringLiteralLike(node) ||
		ts.isNumericLiteral(node) ||
		ts.isBigIntLiteral(node)
	);
}

function declarationName(
	node: ts.DeclarationName | undefined,
	sourceFile: ts.SourceFile
): {
	readonly name: string | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
} {
	if (node === undefined) return { name: null, nameState: 'ANONYMOUS' };
	const identifierText = ts.isIdentifier(node) || ts.isPrivateIdentifier(node) ? node.text : null;
	const nameState = semanticDeclarationNameState(node.kind, identifierText);
	if (nameState === null) return { name: null, nameState: 'ANONYMOUS' };
	if (!isAtomicDeclarationName(node)) return { name: null, nameState };
	const name =
		'text' in node && typeof node.text === 'string'
			? node.text
			: sourceFile.text.slice(node.getStart(sourceFile, false), node.end);
	if (!isUnicodeScalarString(name))
		throw new Error(
			'TypeScript returned a declaration name containing an unrepresentable UTF-16 surrogate.'
		);
	return { name, nameState };
}

function isAmbientDeclaration(declaration: ts.Declaration, sourceFile: ts.SourceFile): boolean {
	if (sourceFile.isDeclarationFile) return true;
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

function flagNames(flags: number): readonly string[] {
	const values = new Set<string>();
	for (const [name, value] of Object.entries(ts.SymbolFlags)) {
		if (
			typeof value !== 'number' ||
			value <= 0 ||
			(value & (value - 1)) !== 0 ||
			(flags & value) === 0
		)
			continue;
		values.add(name);
	}
	return [...values].sort(compareStrings);
}

function importExportBinding(node: ts.Node): boolean {
	const parent = node.parent;
	if (parent === undefined) return false;
	return (
		(ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) ||
		(ts.isExportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) ||
		(ts.isImportClause(parent) && parent.name === node) ||
		(ts.isNamespaceImport(parent) && parent.name === node) ||
		(ts.isNamespaceExport(parent) && parent.name === node) ||
		(ts.isImportEqualsDeclaration(parent) && parent.name === node)
	);
}

function labelReference(node: ts.Node): boolean {
	const parent = node.parent;
	return (
		parent !== undefined &&
		((ts.isLabeledStatement(parent) && parent.label === node) ||
			((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node))
	);
}

function memberReference(node: ts.Node): boolean {
	const parent = node.parent;
	return (
		parent !== undefined &&
		((ts.isPropertyAccessExpression(parent) && parent.name === node) ||
			(ts.isQualifiedName(parent) && parent.right === node) ||
			(ts.isElementAccessExpression(parent) &&
				parent.argumentExpression === node &&
				(ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))))
	);
}

function referenceRole(
	node: ts.Node,
	declarationNameNodes: ReadonlySet<ts.Node>
): SemanticReferenceRole | null {
	if (importExportBinding(node)) return 'IMPORT_EXPORT_BINDING';
	if (labelReference(node)) return 'LABEL';
	if (memberReference(node)) return 'MEMBER_NAME';
	if (declarationNameNodes.has(node)) return 'DECLARATION_NAME';
	if (
		ts.isIdentifier(node) ||
		ts.isPrivateIdentifier(node) ||
		node.kind === ts.SyntaxKind.ThisKeyword ||
		node.kind === ts.SyntaxKind.SuperKeyword
	)
		return 'SYMBOL_USE';
	return null;
}

interface ModuleOccurrence {
	readonly kind: SemanticModuleOccurrenceKind;
	readonly node: ts.Node;
	readonly specifier: string | null;
	readonly specifierState: RawSemanticModuleResolution['specifierState'];
	readonly typeOnly: boolean;
}

function literalModuleOccurrence(
	kind: SemanticModuleOccurrenceKind,
	node: ts.StringLiteralLike,
	typeOnly: boolean
): ModuleOccurrence {
	return { kind, node, specifier: node.text, specifierState: 'LITERAL', typeOnly };
}

function moduleOccurrence(node: ts.Node): ModuleOccurrence | null {
	if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier))
		return literalModuleOccurrence(
			'IMPORT',
			node.moduleSpecifier,
			node.importClause?.isTypeOnly === true
		);
	if (
		ts.isExportDeclaration(node) &&
		node.moduleSpecifier !== undefined &&
		ts.isStringLiteralLike(node.moduleSpecifier)
	)
		return literalModuleOccurrence('EXPORT', node.moduleSpecifier, node.isTypeOnly);
	if (
		ts.isImportEqualsDeclaration(node) &&
		ts.isExternalModuleReference(node.moduleReference) &&
		node.moduleReference.expression !== undefined &&
		ts.isStringLiteralLike(node.moduleReference.expression)
	) {
		return literalModuleOccurrence(
			'IMPORT_EQUALS',
			node.moduleReference.expression,
			node.isTypeOnly
		);
	}
	if (
		ts.isImportTypeNode(node) &&
		ts.isLiteralTypeNode(node.argument) &&
		ts.isStringLiteralLike(node.argument.literal)
	)
		return literalModuleOccurrence('IMPORT_TYPE', node.argument.literal, true);
	if (
		ts.isCallExpression(node) &&
		node.expression.kind === ts.SyntaxKind.ImportKeyword &&
		node.arguments.length > 0
	) {
		const argument = node.arguments[0]!;
		return ts.isStringLiteralLike(argument)
			? literalModuleOccurrence('DYNAMIC_IMPORT', argument, false)
			: {
					kind: 'DYNAMIC_IMPORT',
					node: argument,
					specifier: null,
					specifierState: 'NON_LITERAL',
					typeOnly: false
				};
	}
	return null;
}

function isExternalOrigin(source: RawSemanticSource): boolean {
	return (
		source.origin === 'EXTERNAL_DECLARATION' ||
		source.origin === 'TOOLCHAIN_LIBRARY' ||
		source.artifactClass === 'EXTERNAL_DEPENDENCY' ||
		source.artifactClass === 'VENDOR'
	);
}

function isReexportDeclaration(declaration: ts.Declaration, sourceFile: ts.SourceFile): boolean {
	if (declaration.getSourceFile() !== sourceFile) return false;
	if (ts.isExportSpecifier(declaration)) {
		const exportDeclaration = declaration.parent.parent;
		return (
			ts.isExportDeclaration(exportDeclaration) && exportDeclaration.moduleSpecifier !== undefined
		);
	}
	return ts.isNamespaceExport(declaration);
}

/**
 * Project TypeChecker facts into identity-free records. TypeScript objects are
 * retained only while this function executes; every ordinal is assigned from
 * canonical source/declaration/reference anchors after collection completes.
 */
export function extractTypeScriptSymbols(
	input: ExtractTypeScriptSymbolsInput
): RawTypeScriptSymbolProjection {
	const { checker, guard } = input;
	guard.check();
	const sourceByFile = new Map<ts.SourceFile, TypeScriptSymbolSourceInput>();
	const sourceByOrdinal = new Map<number, TypeScriptSymbolSourceInput>();
	const ordinalByNode = new WeakMap<ts.Node, number>();
	const candidateByNode = new WeakMap<ts.Node, RawSemanticDeclarationCandidate>();
	for (const sourceInput of input.sources) {
		if (
			sourceByFile.has(sourceInput.sourceFile) ||
			sourceByOrdinal.has(sourceInput.source.sourceOrdinal)
		)
			throw new Error('TypeScript symbol extraction received duplicate source identity.');
		sourceByFile.set(sourceInput.sourceFile, sourceInput);
		sourceByOrdinal.set(sourceInput.source.sourceOrdinal, sourceInput);
		if (sourceInput.nodes !== null) {
			for (let index = 0; index < sourceInput.nodes.length; index += 1)
				ordinalByNode.set(sourceInput.nodes[index]!, index);
			for (const candidate of sourceInput.declarationCandidates) {
				const candidateNode = sourceInput.nodes[candidate.nodeOrdinal];
				if (candidateNode === undefined)
					throw new Error('Declaration candidate lacks its transient TypeScript node.');
				candidateByNode.set(candidateNode, candidate);
			}
		}
	}

	function boundaryDescriptor(node: ts.Node) {
		const sourceInput = sourceByFile.get(node.getSourceFile());
		return semanticScopeBoundaryDescriptor(
			node.kind,
			sourceInput?.source.moduleKind ??
				(ts.isExternalModule(node.getSourceFile()) ? 'MODULE' : 'SCRIPT')
		);
	}

	function isParameterProperty(declaration: ts.Declaration): boolean {
		return (
			ts.isParameter(declaration) &&
			ts.isConstructorDeclaration(declaration.parent) &&
			ts.isParameterPropertyDeclaration(declaration, declaration.parent)
		);
	}

	function hasUseStrictPrologue(statements: ts.NodeArray<ts.Statement>): boolean {
		for (const statement of statements) {
			if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression))
				return false;
			const lexeme = statement.expression.getText(statement.getSourceFile());
			if (lexeme === '"use strict"' || lexeme === "'use strict'") return true;
		}
		return false;
	}

	function functionBody(node: ts.Node): ts.ConciseBody | undefined {
		if (
			ts.isFunctionDeclaration(node) ||
			ts.isFunctionExpression(node) ||
			ts.isArrowFunction(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isGetAccessorDeclaration(node) ||
			ts.isSetAccessorDeclaration(node) ||
			ts.isConstructorDeclaration(node)
		)
			return node.body;
		return undefined;
	}

	function isDefinitelyStrict(node: ts.Node): boolean {
		if (
			input.compilerOptions.alwaysStrict === true ||
			(input.compilerOptions.alwaysStrict !== false && input.compilerOptions.strict === true)
		)
			return true;
		const sourceInput = sourceByFile.get(node.getSourceFile());
		if (sourceInput?.source.moduleKind === 'MODULE' || ts.isExternalModule(node.getSourceFile()))
			return true;
		let cursor: ts.Node | undefined = node.parent;
		while (cursor !== undefined) {
			if (ts.isClassDeclaration(cursor) || ts.isClassExpression(cursor)) return true;
			if (ts.isSourceFile(cursor) && hasUseStrictPrologue(cursor.statements)) return true;
			const body = functionBody(cursor);
			if (body !== undefined && ts.isBlock(body) && hasUseStrictPrologue(body.statements))
				return true;
			cursor = cursor.parent;
		}
		return false;
	}

	function transparentEvalCallee(node: ts.Expression): ts.Expression {
		let cursor = node;
		for (;;) {
			if (
				ts.isParenthesizedExpression(cursor) ||
				ts.isNonNullExpression(cursor) ||
				ts.isAsExpression(cursor) ||
				ts.isTypeAssertionExpression(cursor) ||
				ts.isSatisfiesExpression(cursor)
			) {
				cursor = cursor.expression;
				continue;
			}
			return cursor;
		}
	}

	const conditionalHasInfer = new WeakMap<ts.ConditionalTypeNode, boolean>();
	function containsInferBinding(node: ts.ConditionalTypeNode): boolean {
		const cached = conditionalHasInfer.get(node);
		if (cached !== undefined) return cached;
		let found = false;
		const visit = (child: ts.Node): void => {
			if (found) return;
			if (ts.isInferTypeNode(child)) {
				found = true;
				return;
			}
			ts.forEachChild(child, visit);
		};
		ts.forEachChild(node, visit);
		conditionalHasInfer.set(node, found);
		return found;
	}

	function isInsideConditionalInfer(node: ts.Node): boolean {
		let cursor: ts.Node | undefined = node;
		while (cursor !== undefined) {
			if (ts.isConditionalTypeNode(cursor) && containsInferBinding(cursor)) return true;
			cursor = cursor.parent;
		}
		return false;
	}

	function variableEnvironment(node: ts.Node): ts.Node | null {
		let cursor: ts.Node | undefined = node;
		while (cursor !== undefined) {
			if (ts.isFunctionLike(cursor) || ts.isSourceFile(cursor)) return cursor;
			cursor = cursor.parent;
		}
		return null;
	}

	const directEvalEnvironments = new WeakSet<ts.Node>();
	for (const sourceInput of input.sources)
		for (const node of sourceInput.nodes ?? [])
			if (ts.isCallExpression(node) && node.questionDotToken === undefined) {
				const callee = transparentEvalCallee(node.expression);
				if (!ts.isIdentifier(callee) || callee.text !== 'eval') continue;
				const environment = variableEnvironment(node);
				if (environment !== null) directEvalEnvironments.add(environment);
			}

	function isDynamicallyAffectedReference(node: ts.Node): boolean {
		let cursor: ts.Node | undefined = node;
		while (cursor !== undefined) {
			if (ts.isWithStatement(cursor)) return true;
			cursor = cursor.parent;
		}
		const environment = variableEnvironment(node);
		return (
			isInsideConditionalInfer(node) ||
			(environment !== null && directEvalEnvironments.has(environment))
		);
	}

	const scopesByKey = new Map<string, ScopeAnchor>();
	const scopeKeyByBoundary = new WeakMap<ts.Node, string>();
	const globalDescriptor = programGlobalScopeDescriptor();
	const globalScopeKey = canonicalSemanticJson({
		domain: globalDescriptor.domain,
		kind: 'PROGRAM_GLOBAL',
		projectKey: input.projectKey
	});
	guard.addScope();
	scopesByKey.set(globalScopeKey, {
		domain: globalDescriptor.domain,
		end: null,
		key: globalScopeKey,
		kind: 'PROGRAM_GLOBAL',
		ownerKind: null,
		ownerKindName: null,
		ownerNodeOrdinal: null,
		parentKey: null,
		sourceOrdinal: null,
		start: null
	});

	function ensureContainingScope(node: ts.Node | undefined): string {
		let cursor = node;
		while (cursor !== undefined && boundaryDescriptor(cursor) === null) cursor = cursor.parent;
		return cursor === undefined ? globalScopeKey : ensureBoundaryScope(cursor);
	}

	function ensureOrdinaryContainingScope(node: ts.Node | undefined): string {
		let cursor = node;
		while (cursor !== undefined) {
			const descriptor = boundaryDescriptor(cursor);
			if (descriptor !== null && isOrdinaryReferenceScope(descriptor.domain))
				return ensureBoundaryScope(cursor);
			cursor = cursor.parent;
		}
		return globalScopeKey;
	}

	function ensureBoundaryScope(node: ts.Node): string {
		const existing = scopeKeyByBoundary.get(node);
		if (existing !== undefined) return existing;
		const descriptor = boundaryDescriptor(node);
		if (descriptor === null) return ensureContainingScope(node.parent);
		const { domain, kind } = descriptor;
		const sourceFile = node.getSourceFile();
		const sourceInput = sourceByFile.get(sourceFile);
		if (sourceInput === undefined) return globalScopeKey;
		const start = node.getStart(sourceFile, false);
		const end = node.end;
		if (
			!Number.isSafeInteger(start) ||
			!Number.isSafeInteger(end) ||
			start < 0 ||
			start > end ||
			end > sourceFile.text.length
		)
			throw new Error('TypeScript returned an invalid scope span.');
		const parentKey = ts.isSourceFile(node) ? globalScopeKey : ensureContainingScope(node.parent);
		const key = canonicalSemanticJson({
			domain,
			end,
			kind,
			logicalPath: sourceInput.source.logicalPath,
			ownerKind: node.kind,
			start
		});
		const ownerNodeOrdinal = sourceInput.nodes === null ? null : (ordinalByNode.get(node) ?? null);
		if (sourceInput.nodes !== null && ownerNodeOrdinal === null)
			throw new Error('A retained scope boundary lacks its public AST node ordinal.');
		const anchor: ScopeAnchor = {
			domain,
			end,
			key,
			kind,
			ownerKind: node.kind,
			ownerKindName: syntaxKindName(node.kind),
			ownerNodeOrdinal,
			parentKey,
			sourceOrdinal: sourceInput.source.sourceOrdinal,
			start
		};
		const collision = scopesByKey.get(key);
		if (
			collision !== undefined &&
			canonicalSemanticJson(collision) !== canonicalSemanticJson(anchor)
		)
			throw new Error('Canonical scope anchor collision.');
		if (collision === undefined) {
			guard.addScope();
			scopesByKey.set(key, anchor);
		}
		scopeKeyByBoundary.set(node, key);
		return key;
	}

	function variableDeclarationList(declaration: ts.Declaration): ts.VariableDeclarationList | null {
		let cursor: ts.Node | undefined = declaration;
		while (cursor !== undefined && !ts.isSourceFile(cursor) && !ts.isFunctionLike(cursor)) {
			if (ts.isVariableDeclarationList(cursor)) return cursor;
			cursor = cursor.parent;
		}
		return null;
	}

	function nearestVariableEnvironment(node: ts.Node | undefined): string | null {
		let cursor = node;
		while (cursor !== undefined) {
			if (ts.isClassStaticBlockDeclaration(cursor)) return ensureBoundaryScope(cursor);
			if (ts.isFunctionLike(cursor)) return ensureBoundaryScope(cursor);
			if (ts.isModuleDeclaration(cursor)) return ensureBoundaryScope(cursor);
			if (ts.isSourceFile(cursor)) {
				const sourceScope = ensureBoundaryScope(cursor);
				return scopesByKey.get(sourceScope)?.kind === 'SOURCE_SCRIPT'
					? globalScopeKey
					: sourceScope;
			}
			cursor = cursor.parent;
		}
		return null;
	}

	function declaringScope(declaration: ts.Declaration): {
		readonly key: string | null;
		readonly state: SemanticScopeLinkState;
	} {
		if (isParameterProperty(declaration)) return { key: null, state: 'UNSUPPORTED' };
		if (isInsideConditionalInfer(declaration)) return { key: null, state: 'UNSUPPORTED' };
		if (ts.isSourceFile(declaration))
			return { key: ensureBoundaryScope(declaration), state: 'RESOLVED' };
		if (ts.isFunctionExpression(declaration) || ts.isClassExpression(declaration))
			return { key: ensureBoundaryScope(declaration), state: 'RESOLVED' };
		if (ts.isFunctionDeclaration(declaration)) {
			const parent = declaration.parent;
			if (
				ts.isBlock(parent) &&
				parent.parent !== undefined &&
				ts.isFunctionLike(parent.parent) &&
				functionBody(parent.parent) === parent
			)
				return { key: ensureBoundaryScope(parent.parent), state: 'RESOLVED' };
			if (!ts.isSourceFile(parent) && !ts.isModuleBlock(parent) && !isDefinitelyStrict(declaration))
				return { key: null, state: 'UNSUPPORTED' };
		}
		const list = variableDeclarationList(declaration);
		if (list !== null && (list.flags & ts.NodeFlags.BlockScoped) === 0) {
			const key = nearestVariableEnvironment(declaration.parent);
			return { key, state: key === null ? 'UNSUPPORTED' : 'RESOLVED' };
		}
		let key = ensureContainingScope(declaration.parent);
		if (scopesByKey.get(key)?.kind === 'SOURCE_SCRIPT') key = globalScopeKey;
		return { key, state: 'RESOLVED' };
	}

	for (const sourceInput of [...input.sources].sort((left, right) =>
		compareStrings(left.source.logicalPath, right.source.logicalPath)
	)) {
		ensureBoundaryScope(sourceInput.sourceFile);
		for (const node of sourceInput.nodes ?? [])
			if (boundaryDescriptor(node) !== null) ensureBoundaryScope(node);
	}

	const declarationAnchorCache = new WeakMap<ts.Declaration, DeclarationAnchor | null>();
	function anchorForDeclaration(declaration: ts.Declaration): DeclarationAnchor | null {
		const cached = declarationAnchorCache.get(declaration);
		if (cached !== undefined) return cached;
		const sourceFile = declaration.getSourceFile();
		const sourceInput = sourceByFile.get(sourceFile);
		if (sourceInput === undefined) {
			declarationAnchorCache.set(declaration, null);
			return null;
		}
		const start = declaration.getStart(sourceFile, false);
		const end = declaration.end;
		if (
			!Number.isSafeInteger(start) ||
			!Number.isSafeInteger(end) ||
			start < 0 ||
			start > end ||
			end > sourceFile.text.length
		)
			throw new Error('TypeScript returned an invalid declaration span.');
		const candidate = candidateByNode.get(declaration) ?? null;
		const nodeOrdinal =
			sourceInput.nodes === null ? null : (ordinalByNode.get(declaration) ?? null);
		const named = declarationName(ts.getNameOfDeclaration(declaration), sourceFile);
		const scope = declaringScope(declaration);
		const key = canonicalSemanticJson({
			end,
			kind: declaration.kind,
			logicalPath: sourceInput.source.logicalPath,
			name: named.name,
			nameState: named.nameState,
			start
		});
		const anchor: DeclarationAnchor = {
			ambient: isAmbientDeclaration(declaration, sourceFile),
			candidateNodeOrdinal: candidate?.nodeOrdinal ?? null,
			declaringScopeKey: scope.key,
			declaration,
			end,
			key,
			kind: declaration.kind,
			kindName: syntaxKindName(declaration.kind),
			logicalPath: sourceInput.source.logicalPath,
			name: named.name,
			nameState: named.nameState,
			nodeOrdinal,
			sourceOrdinal: sourceInput.source.sourceOrdinal,
			scopeLinkState: scope.state,
			symbolBindingState: isParameterProperty(declaration) ? 'UNSUPPORTED' : 'RESOLVED',
			start
		};
		declarationAnchorCache.set(declaration, anchor);
		return anchor;
	}

	function symbolDeclarations(symbol: ts.Symbol): readonly DeclarationAnchor[] {
		const byKey = new Map<string, DeclarationAnchor>();
		for (const declaration of symbol.getDeclarations() ?? []) {
			const anchor = anchorForDeclaration(declaration);
			if (anchor !== null) byKey.set(anchor.key, anchor);
		}
		return [...byKey.values()].sort((left, right) => compareStrings(left.key, right.key));
	}

	function normalizedSymbolName(
		symbol: ts.Symbol,
		declarations: readonly DeclarationAnchor[]
	): string {
		const sourceDeclaration = declarations.find(
			(declaration) => declaration.kind === ts.SyntaxKind.SourceFile
		);
		const compilerName = symbol.getName();
		const stableCompilerName = compilerName.startsWith('__@')
			? compilerName.replace(/@[0-9]+$/u, '')
			: compilerName;
		const name =
			sourceDeclaration === undefined
				? stableCompilerName.length === 0
					? '<anonymous>'
					: stableCompilerName
				: `module:${sourceDeclaration.logicalPath}`;
		return isUnicodeScalarString(name)
			? name
			: `utf16-code-units:${encodeSemanticDiagnosticText(name).text}`;
	}

	const metadataBySymbol = new Map<ts.Symbol, SymbolMetadata>();
	function symbolWorkKey(symbol: ts.Symbol): string {
		const declarations = symbolDeclarations(symbol);
		const fallbackAnchors = [
			...(metadataBySymbol.get(symbol)?.fallbackAnchors.values() ?? [])
		].sort(
			(left, right) =>
				left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
		);
		return canonicalSemanticJson({
			declarations: declarations.map((entry) => entry.key),
			fallbackAnchors,
			flags: symbol.getFlags(),
			name: normalizedSymbolName(symbol, declarations)
		});
	}

	function addSymbol(symbol: ts.Symbol | undefined, fallback?: NodeAnchor): ts.Symbol | null {
		if (symbol === undefined) return null;
		let metadata = metadataBySymbol.get(symbol);
		if (metadata === undefined) {
			metadata = { fallbackAnchors: new Map(), symbol };
			metadataBySymbol.set(symbol, metadata);
		}
		if (fallback !== undefined) metadata.fallbackAnchors.set(nodeAnchorKey(fallback), fallback);
		return symbol;
	}

	function symbolQuery<T>(kind: string, discriminator: string, action: () => T): T {
		return guard.query(`${input.projectKey}\0${kind}\0${discriminator}`, action);
	}

	const pendingReferences: PendingReference[] = [];
	const pendingModuleResolutions: PendingModuleResolution[] = [];
	const moduleSymbols = new Map<number, ts.Symbol>();
	const exportsBySource = new Map<number, readonly ts.Symbol[]>();

	for (const sourceInput of [...input.sources].sort((left, right) =>
		compareStrings(left.source.logicalPath, right.source.logicalPath)
	)) {
		guard.check();
		const rootAnchor =
			sourceInput.nodes === null
				? undefined
				: { nodeOrdinal: 0, sourceOrdinal: sourceInput.source.sourceOrdinal };
		const moduleSymbol = addSymbol(
			symbolQuery('source-symbol', sourceInput.source.logicalPath, () =>
				checker.getSymbolAtLocation(sourceInput.sourceFile)
			),
			rootAnchor
		);
		if (moduleSymbol !== null) moduleSymbols.set(sourceInput.source.sourceOrdinal, moduleSymbol);
		if (sourceInput.nodes === null) continue;
		const declarationNameNodes = new Set<ts.Node>();
		const declarationByNameNode = new Map<ts.Node, ts.Declaration>();
		for (const candidate of sourceInput.declarationCandidates) {
			if (candidate.nameNodeOrdinal !== null) {
				const nameNode = sourceInput.nodes[candidate.nameNodeOrdinal]!;
				declarationNameNodes.add(nameNode);
				declarationByNameNode.set(
					nameNode,
					sourceInput.nodes[candidate.nodeOrdinal]! as ts.Declaration
				);
			}
		}
		for (let nodeOrdinal = 0; nodeOrdinal < sourceInput.nodes.length; nodeOrdinal += 1) {
			guard.check();
			const node = sourceInput.nodes[nodeOrdinal]!;
			const role = referenceRole(node, declarationNameNodes);
			if (role !== null) {
				const declaration =
					role === 'DECLARATION_NAME' ? declarationByNameNode.get(node) : undefined;
				const scope = isDynamicallyAffectedReference(node)
					? { key: null, state: 'UNSUPPORTED' as const }
					: declaration === undefined
						? {
								key: ensureOrdinaryContainingScope(node.parent),
								state: 'RESOLVED' as const
							}
						: declaringScope(declaration);
				const symbol = addSymbol(
					symbolQuery(
						'node-symbol',
						`${sourceInput.source.logicalPath}\0${String(nodeOrdinal)}`,
						() => checker.getSymbolAtLocation(node)
					),
					{
						nodeOrdinal,
						sourceOrdinal: sourceInput.source.sourceOrdinal
					}
				);
				pendingReferences.push({
					containingScopeKey: scope.key,
					nodeOrdinal,
					role,
					scopeLinkState: scope.state,
					sourceOrdinal: sourceInput.source.sourceOrdinal,
					symbol
				});
			}
			const occurrence = moduleOccurrence(node);
			if (occurrence !== null) {
				const specifierOrdinal = ordinalByNode.get(occurrence.node);
				if (specifierOrdinal === undefined)
					throw new Error('Module occurrence specifier is outside the retained AST profile.');
				const anchor = {
					nodeOrdinal: specifierOrdinal,
					sourceOrdinal: sourceInput.source.sourceOrdinal
				};
				const symbol =
					occurrence.specifierState === 'LITERAL'
						? addSymbol(
								symbolQuery(
									'module-symbol',
									`${sourceInput.source.logicalPath}\0${String(specifierOrdinal)}\0${occurrence.kind}`,
									() => checker.getSymbolAtLocation(occurrence.node)
								),
								anchor
							)
						: null;
				let resolutionState: RawSemanticModuleResolution['resolutionState'] =
					occurrence.specifierState === 'NON_LITERAL' ? 'UNSUPPORTED' : 'UNRESOLVED';
				let targetSourceOrdinal: number | null = null;
				if (symbol !== null) {
					const declarations = symbolDeclarations(symbol);
					const sourceDeclaration = declarations.find(
						(declaration) => declaration.kind === ts.SyntaxKind.SourceFile
					);
					if (sourceDeclaration !== undefined) {
						targetSourceOrdinal = sourceDeclaration.sourceOrdinal;
						const targetSource = sourceByOrdinal.get(targetSourceOrdinal)!.source;
						resolutionState = isExternalOrigin(targetSource)
							? 'RESOLVED_EXTERNAL'
							: 'RESOLVED_SOURCE';
					} else {
						resolutionState = declarations.length > 0 ? 'RESOLVED_AMBIENT' : 'UNRESOLVED';
					}
				}
				pendingModuleResolutions.push({
					moduleSymbol: symbol,
					nodeOrdinal: specifierOrdinal,
					occurrenceKind: occurrence.kind,
					resolutionState,
					sourceOrdinal: sourceInput.source.sourceOrdinal,
					specifier: occurrence.specifier,
					specifierState: occurrence.specifierState,
					targetSourceOrdinal,
					typeOnly: occurrence.typeOnly
				});
			}
		}
	}

	for (const sourceInput of [...input.sources].sort((left, right) =>
		compareStrings(left.source.logicalPath, right.source.logicalPath)
	)) {
		if (sourceInput.nodes === null) continue;
		const moduleSymbol = moduleSymbols.get(sourceInput.source.sourceOrdinal);
		if (moduleSymbol === undefined) continue;
		const exported = [
			...symbolQuery('module-exports', sourceInput.source.logicalPath, () =>
				checker.getExportsOfModule(moduleSymbol)
			)
		].sort((left, right) => compareStrings(symbolWorkKey(left), symbolWorkKey(right)));
		exportsBySource.set(sourceInput.source.sourceOrdinal, exported);
		for (const symbol of exported)
			addSymbol(symbol, { nodeOrdinal: 0, sourceOrdinal: sourceInput.source.sourceOrdinal });
	}

	const aliasBySymbol = new Map<ts.Symbol, AliasResolution>();
	let aliasesPending = true;
	while (aliasesPending) {
		aliasesPending = false;
		const aliases = [...metadataBySymbol.keys()]
			.filter(
				(symbol) => (symbol.getFlags() & ts.SymbolFlags.Alias) !== 0 && !aliasBySymbol.has(symbol)
			)
			.sort((left, right) => compareStrings(symbolWorkKey(left), symbolWorkKey(right)));
		for (const alias of aliases) {
			aliasesPending = true;
			const discriminator = symbolWorkKey(alias);
			const seen = new Set<ts.Symbol>([alias]);
			let cursor = alias;
			let target: ts.Symbol | null = null;
			let terminal: ts.Symbol | null = null;
			let state: RawSemanticAlias['state'] = 'RESOLVED';
			for (;;) {
				guard.check();
				const immediate = symbolQuery(
					'immediate-alias',
					`${discriminator}\0${symbolWorkKey(cursor)}`,
					() => checker.getImmediateAliasedSymbol(cursor)
				);
				if (immediate === undefined) {
					state = 'UNRESOLVED';
					break;
				}
				const unknown = symbolQuery('unknown-symbol', symbolWorkKey(immediate), () =>
					checker.isUnknownSymbol(immediate!)
				);
				if (unknown) {
					state = 'UNRESOLVED';
					break;
				}
				const fallback = [...(metadataBySymbol.get(alias)?.fallbackAnchors.values() ?? [])].sort(
					(left, right) =>
						left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
				)[0];
				addSymbol(immediate, fallback);
				if (target === null) target = immediate;
				if (seen.has(immediate)) {
					state = 'CIRCULAR';
					terminal = null;
					break;
				}
				seen.add(immediate);
				if ((immediate.getFlags() & ts.SymbolFlags.Alias) === 0) {
					terminal = immediate;
					break;
				}
				cursor = immediate;
			}
			aliasBySymbol.set(alias, {
				state,
				target: state === 'UNRESOLVED' ? null : target,
				terminal: state === 'RESOLVED' ? terminal : null
			});
		}
	}

	interface GroupBuilder {
		readonly declarations: Map<string, DeclarationAnchor>;
		readonly fallbackAnchors: Map<string, NodeAnchor>;
		flags: number;
		readonly key: string;
		readonly names: Set<string>;
		readonly representatives: ts.Symbol[];
	}
	interface SymbolInput {
		readonly declarations: readonly DeclarationAnchor[];
		readonly fallbackAnchors: readonly NodeAnchor[];
		readonly flags: number;
		readonly metadata: SymbolMetadata;
		readonly name: string;
		readonly signature: string;
	}
	const symbolInputs: SymbolInput[] = [...metadataBySymbol.values()].map((metadata) => {
		const declarations = symbolDeclarations(metadata.symbol);
		const fallbackAnchors =
			declarations.length === 0
				? [...metadata.fallbackAnchors.values()].sort(
						(left, right) =>
							left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
					)
				: [];
		const flags = metadata.symbol.getFlags();
		const name = normalizedSymbolName(metadata.symbol, declarations);
		return {
			declarations,
			fallbackAnchors,
			flags,
			metadata,
			name,
			signature: canonicalSemanticJson({ flags, name })
		};
	});
	const inputsByDeclaration = new Map<string, SymbolInput[]>();
	for (const symbolInput of symbolInputs)
		for (const declaration of symbolInput.declarations) {
			const owners = inputsByDeclaration.get(declaration.key) ?? [];
			owners.push(symbolInput);
			inputsByDeclaration.set(declaration.key, owners);
		}
	const unsupportedSymbols = new Set<ts.Symbol>();
	const unsupportedDeclarationsByKey = new Map<string, DeclarationAnchor>();
	let unsupportedChanged = true;
	while (unsupportedChanged) {
		unsupportedChanged = false;
		for (const owners of inputsByDeclaration.values()) {
			const incompatible =
				owners.some(
					(owner) =>
						unsupportedSymbols.has(owner.metadata.symbol) ||
						owner.declarations.some(
							(declaration) => declaration.symbolBindingState === 'UNSUPPORTED'
						)
				) || new Set(owners.map((owner) => owner.signature)).size > 1;
			if (!incompatible) continue;
			for (const owner of owners)
				if (!unsupportedSymbols.has(owner.metadata.symbol)) {
					unsupportedSymbols.add(owner.metadata.symbol);
					unsupportedChanged = true;
				}
		}
	}
	for (const owner of symbolInputs.filter((entry) => unsupportedSymbols.has(entry.metadata.symbol)))
		for (const declaration of owner.declarations)
			unsupportedDeclarationsByKey.set(declaration.key, {
				...declaration,
				symbolBindingState: 'UNSUPPORTED'
			});
	const buildersByKey = new Map<string, GroupBuilder>();
	for (const symbolInput of symbolInputs) {
		const { declarations, fallbackAnchors, flags, metadata, name } = symbolInput;
		if (unsupportedSymbols.has(metadata.symbol)) continue;
		const key =
			declarations.length > 0
				? canonicalSemanticJson({
						declarations: declarations.map((declaration) => declaration.key),
						flags,
						name
					})
				: canonicalSemanticJson({ declarations: [], fallbackAnchors, flags, name });
		let builder = buildersByKey.get(key);
		if (builder === undefined) {
			builder = {
				declarations: new Map(),
				fallbackAnchors: new Map(),
				flags,
				key,
				names: new Set(),
				representatives: []
			};
			buildersByKey.set(key, builder);
		}
		builder.flags |= flags;
		builder.names.add(name);
		builder.representatives.push(metadata.symbol);
		for (const declaration of declarations) builder.declarations.set(declaration.key, declaration);
		for (const anchor of fallbackAnchors)
			builder.fallbackAnchors.set(nodeAnchorKey(anchor), anchor);
	}
	const preliminaryBuilders = [...buildersByKey.values()];
	const parents = preliminaryBuilders.map((_, index) => index);
	const findRoot = (index: number): number => {
		let root = index;
		while (parents[root] !== root) root = parents[root]!;
		while (parents[index] !== index) {
			const parent = parents[index]!;
			parents[index] = root;
			index = parent;
		}
		return root;
	};
	const declarationOwner = new Map<string, number>();
	for (let index = 0; index < preliminaryBuilders.length; index += 1) {
		for (const declarationKey of preliminaryBuilders[index]!.declarations.keys()) {
			const owner = declarationOwner.get(declarationKey);
			if (owner === undefined) declarationOwner.set(declarationKey, index);
			else {
				const left = findRoot(index);
				const right = findRoot(owner);
				if (left !== right) parents[Math.max(left, right)] = Math.min(left, right);
			}
		}
	}
	const mergedByRoot = new Map<number, Omit<GroupBuilder, 'key'>>();
	for (let index = 0; index < preliminaryBuilders.length; index += 1) {
		const builder = preliminaryBuilders[index]!;
		const root = findRoot(index);
		let merged = mergedByRoot.get(root);
		if (merged === undefined) {
			merged = {
				declarations: new Map(),
				fallbackAnchors: new Map(),
				flags: 0,
				names: new Set(),
				representatives: []
			};
			mergedByRoot.set(root, merged);
		}
		merged.flags |= builder.flags;
		for (const [key, declaration] of builder.declarations)
			merged.declarations.set(key, declaration);
		for (const [key, anchor] of builder.fallbackAnchors) merged.fallbackAnchors.set(key, anchor);
		for (const name of builder.names) merged.names.add(name);
		merged.representatives.push(...builder.representatives);
	}
	const sortedBuilders: GroupBuilder[] = [...mergedByRoot.values()]
		.map((builder) => {
			const declarationKeys = [...builder.declarations.keys()].sort(compareStrings);
			const fallbackAnchors = [...builder.fallbackAnchors.values()].sort(
				(left, right) =>
					left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
			);
			const name = [...builder.names].sort(compareStrings)[0] ?? '<anonymous>';
			const key =
				declarationKeys.length > 0
					? canonicalSemanticJson({ declarations: declarationKeys })
					: canonicalSemanticJson({
							declarations: [],
							fallbackAnchors,
							flags: builder.flags,
							name
						});
			return { ...builder, key };
		})
		.sort((left, right) => compareStrings(left.key, right.key));
	const groups: SymbolGroup[] = sortedBuilders.map((builder, symbolOrdinal) => {
		const declarations = [...builder.declarations.values()].sort((left, right) =>
			compareStrings(left.key, right.key)
		);
		const sourceDeclaration = declarations.find(
			(declaration) => declaration.kind === ts.SyntaxKind.SourceFile
		);
		const declaredNames = declarations
			.flatMap((declaration) => (declaration.name === null ? [] : [declaration.name]))
			.sort(compareStrings);
		const name =
			sourceDeclaration !== undefined
				? `module:${sourceDeclaration.logicalPath}`
				: (declaredNames[0] ?? [...builder.names].sort(compareStrings)[0] ?? '<anonymous>');
		return {
			declarations,
			fallbackAnchors: [...builder.fallbackAnchors.values()].sort(
				(left, right) =>
					left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
			),
			flags: builder.flags,
			key: builder.key,
			name,
			representatives: [...builder.representatives].sort((left, right) =>
				compareStrings(symbolWorkKey(left), symbolWorkKey(right))
			),
			symbolOrdinal
		};
	});
	const groupBySymbol = new Map<ts.Symbol, SymbolGroup>();
	for (const group of groups)
		for (const representative of group.representatives) groupBySymbol.set(representative, group);
	const sortedScopeAnchors = [...scopesByKey.values()].sort((left, right) =>
		compareStrings(left.key, right.key)
	);
	const scopeOrdinalByKey = new Map(
		sortedScopeAnchors.map((scope, scopeOrdinal) => [scope.key, scopeOrdinal] as const)
	);
	const scopes: RawSemanticScope[] = sortedScopeAnchors.map((scope, scopeOrdinal) => ({
		domain: scope.domain,
		end: scope.end,
		kind: scope.kind,
		ownerKind: scope.ownerKind,
		ownerKindName: scope.ownerKindName,
		ownerNodeOrdinal: scope.ownerNodeOrdinal,
		parentScopeOrdinal:
			scope.parentKey === null ? null : (scopeOrdinalByKey.get(scope.parentKey) ?? null),
		scopeOrdinal,
		sourceOrdinal: scope.sourceOrdinal,
		start: scope.start
	}));
	if (scopes.some((scope) => scope.kind !== 'PROGRAM_GLOBAL' && scope.parentScopeOrdinal === null))
		throw new Error('A semantic scope lacks its canonical parent.');
	const groupedDeclarationKeys = new Set(
		groups.flatMap((group) => group.declarations.map((declaration) => declaration.key))
	);
	for (const sourceInput of [...input.sources].sort((left, right) =>
		compareStrings(left.source.logicalPath, right.source.logicalPath)
	)) {
		if (sourceInput.nodes === null) continue;
		for (const candidate of [...sourceInput.declarationCandidates].sort(
			(left, right) => left.nodeOrdinal - right.nodeOrdinal
		)) {
			const declaration = sourceInput.nodes[candidate.nodeOrdinal];
			if (
				declaration === undefined ||
				(!ts.isCallSignatureDeclaration(declaration) &&
					!ts.isConstructSignatureDeclaration(declaration))
			)
				continue;
			const anchor = anchorForDeclaration(declaration);
			if (anchor === null || groupedDeclarationKeys.has(anchor.key)) continue;
			unsupportedDeclarationsByKey.set(anchor.key, {
				...anchor,
				symbolBindingState: 'UNSUPPORTED'
			});
		}
	}

	const pendingDeclarations: {
		readonly declaration: DeclarationAnchor;
		readonly group: SymbolGroup | null;
	}[] = [
		...groups.flatMap((group) => group.declarations.map((declaration) => ({ declaration, group }))),
		...[...unsupportedDeclarationsByKey.values()].map((declaration) => ({
			declaration,
			group: null
		}))
	].sort(
		(left, right) =>
			compareStrings(left.declaration.key, right.declaration.key) ||
			compareStrings(left.group?.key ?? '', right.group?.key ?? '')
	);
	const declarationOrdinalByKey = new Map<string, number>();
	const declarations: RawSemanticDeclaration[] = pendingDeclarations.map(
		({ declaration, group }, declarationOrdinal) => {
			guard.addFact();
			if (group !== null)
				declarationOrdinalByKey.set(`${group.key}\0${declaration.key}`, declarationOrdinal);
			return {
				ambient: declaration.ambient,
				candidateNodeOrdinal: declaration.candidateNodeOrdinal,
				declaringScopeOrdinal:
					declaration.declaringScopeKey === null
						? null
						: (scopeOrdinalByKey.get(declaration.declaringScopeKey) ?? null),
				declarationOrdinal,
				end: declaration.end,
				kind: declaration.kind,
				kindName: declaration.kindName,
				name: declaration.name,
				nameState: declaration.nameState,
				nodeOrdinal: declaration.nodeOrdinal,
				sourceOrdinal: declaration.sourceOrdinal,
				scopeLinkState: declaration.scopeLinkState,
				start: declaration.start,
				symbolBindingState: declaration.symbolBindingState,
				symbolOrdinal: group?.symbolOrdinal ?? null
			};
		}
	);

	const symbols: RawSemanticSymbol[] = groups.map((group) => {
		guard.addFact();
		const declarationOrdinals = group.declarations.map((declaration) =>
			declarationOrdinalByKey.get(`${group.key}\0${declaration.key}`)!
		);
		const valueDeclarationKeys = new Set<string>();
		for (const representative of group.representatives) {
			if (representative.valueDeclaration !== undefined) {
				const anchor = anchorForDeclaration(representative.valueDeclaration);
				if (anchor !== null) valueDeclarationKeys.add(anchor.key);
			}
		}
		const valueDeclarationOrdinal =
			[...valueDeclarationKeys]
				.sort(compareStrings)
				.map((key) => declarationOrdinalByKey.get(`${group.key}\0${key}`))
				.find((value): value is number => value !== undefined) ?? null;
		return {
			declarationOrdinals,
			fallbackReferenceNodes: group.fallbackAnchors,
			flags: group.flags,
			flagNames: flagNames(group.flags),
			name: group.name,
			symbolOrdinal: group.symbolOrdinal,
			valueDeclarationOrdinal
		};
	});
	const typeProjection = input.includeTypes
		? extractTypeScriptTypes({
				assignabilityRequests: input.assignabilityRequests,
				checker,
				declarations: pendingDeclarations.map(({ declaration }, declarationOrdinal) => ({
					declaration: declaration.declaration,
					declarationOrdinal
				})),
				guard,
				nodeAnchorForNode: (node) => {
					const sourceInput = sourceByFile.get(node.getSourceFile());
					const nodeOrdinal = ordinalByNode.get(node);
					return sourceInput === undefined || nodeOrdinal === undefined
						? null
						: { nodeOrdinal, sourceOrdinal: sourceInput.source.sourceOrdinal };
				},
				projectKey: input.projectKey,
				resolveCheckerContextDigest: input.resolveCheckerContextDigest,
				sources: input.sources.map((sourceInput) => ({
					logicalPath: sourceInput.source.logicalPath,
					nodes: sourceInput.nodes,
					sourceFile: sourceInput.sourceFile,
					sourceOrdinal: sourceInput.source.sourceOrdinal
				})),
				symbols: groups.map((group) => ({
					declarations: group.declarations.map((declaration) => {
						const declarationOrdinal = declarationOrdinalByKey.get(
							`${group.key}\0${declaration.key}`
						);
						if (declarationOrdinal === undefined)
							throw new Error('Canonical type bridge lacks a declaration ordinal.');
						return { declaration: declaration.declaration, declarationOrdinal };
					}),
					flags: group.flags,
					representatives: group.representatives,
					symbolOrdinal: group.symbolOrdinal
				}))
			})
		: {
				overloadSets: [],
				signatureParameters: [],
				signatures: [],
				typeParameters: [],
				typeRelations: [],
				types: []
			};

	const aliases: RawSemanticAlias[] = [];
	for (const group of groups.filter(
		(candidate) => (candidate.flags & ts.SymbolFlags.Alias) !== 0
	)) {
		const normalized = new Map<string, RawSemanticAlias>();
		for (const representative of group.representatives) {
			const resolution = aliasBySymbol.get(representative) ?? {
				state: 'UNRESOLVED' as const,
				target: null,
				terminal: null
			};
			const targetGroup =
				resolution.target === null ? null : (groupBySymbol.get(resolution.target) ?? null);
			const terminalGroup =
				resolution.terminal === null ? null : (groupBySymbol.get(resolution.terminal) ?? null);
			const unsupportedTarget =
				(resolution.target !== null && unsupportedSymbols.has(resolution.target)) ||
				(resolution.terminal !== null && unsupportedSymbols.has(resolution.terminal));
			const record: RawSemanticAlias = {
				aliasSymbolOrdinal: group.symbolOrdinal,
				state: unsupportedTarget ? 'UNSUPPORTED' : resolution.state,
				targetSymbolOrdinal: unsupportedTarget ? null : (targetGroup?.symbolOrdinal ?? null),
				terminalSymbolOrdinal: unsupportedTarget ? null : (terminalGroup?.symbolOrdinal ?? null)
			};
			normalized.set(canonicalSemanticJson(record), record);
		}
		if (normalized.size !== 1)
			throw new Error('Canonical symbol grouping produced incompatible alias relations.');
		guard.addFact();
		aliases.push([...normalized.values()][0]!);
	}
	aliases.sort((left, right) => left.aliasSymbolOrdinal - right.aliasSymbolOrdinal);
	const aliasByOrdinal = new Map(
		aliases.map((alias) => [alias.aliasSymbolOrdinal, alias] as const)
	);

	const references: RawSemanticReference[] = pendingReferences
		.map((reference): RawSemanticReference => {
			guard.addFact();
			const group =
				reference.symbol === null ? null : (groupBySymbol.get(reference.symbol) ?? null);
			const base = {
				containingScopeOrdinal:
					reference.containingScopeKey === null
						? null
						: (scopeOrdinalByKey.get(reference.containingScopeKey) ?? null),
				nodeOrdinal: reference.nodeOrdinal,
				role: reference.role,
				scopeLinkState: reference.scopeLinkState,
				sourceOrdinal: reference.sourceOrdinal
			};
			if (reference.symbol !== null && unsupportedSymbols.has(reference.symbol))
				return {
					...base,
					resolutionState: 'UNSUPPORTED',
					resolvedSymbolOrdinal: null,
					symbolOrdinal: null
				};
			if (group === null)
				return {
					...base,
					resolutionState: 'UNRESOLVED',
					resolvedSymbolOrdinal: null,
					symbolOrdinal: null
				};
			const alias = aliasByOrdinal.get(group.symbolOrdinal);
			if (alias === undefined)
				return {
					...base,
					resolutionState: 'RESOLVED_DIRECT',
					resolvedSymbolOrdinal: group.symbolOrdinal,
					symbolOrdinal: group.symbolOrdinal
				};
			if (alias.state === 'RESOLVED' && alias.terminalSymbolOrdinal !== null)
				return {
					...base,
					resolutionState: 'RESOLVED_ALIAS',
					resolvedSymbolOrdinal: alias.terminalSymbolOrdinal,
					symbolOrdinal: group.symbolOrdinal
				};
			return {
				...base,
				resolutionState: alias.state === 'UNRESOLVED' ? 'UNRESOLVED' : 'UNSUPPORTED',
				resolvedSymbolOrdinal: null,
				symbolOrdinal: group.symbolOrdinal
			};
		})
		.sort(
			(left, right) =>
				left.sourceOrdinal - right.sourceOrdinal ||
				left.nodeOrdinal - right.nodeOrdinal ||
				compareStrings(left.role, right.role)
		);

	const moduleResolutions: RawSemanticModuleResolution[] = pendingModuleResolutions
		.map((resolution): RawSemanticModuleResolution => {
			guard.addFact();
			const unsupportedModuleSymbol =
				resolution.moduleSymbol !== null && unsupportedSymbols.has(resolution.moduleSymbol);
			return {
				moduleSymbolOrdinal:
					resolution.moduleSymbol === null
						? null
						: (groupBySymbol.get(resolution.moduleSymbol)?.symbolOrdinal ?? null),
				nodeOrdinal: resolution.nodeOrdinal,
				occurrenceKind: resolution.occurrenceKind,
				resolutionState: unsupportedModuleSymbol ? 'UNSUPPORTED' : resolution.resolutionState,
				sourceOrdinal: resolution.sourceOrdinal,
				specifier: resolution.specifier,
				specifierState: resolution.specifierState,
				targetSourceOrdinal: unsupportedModuleSymbol ? null : resolution.targetSourceOrdinal,
				typeOnly: resolution.typeOnly
			};
		})
		.sort(
			(left, right) =>
				left.sourceOrdinal - right.sourceOrdinal ||
				left.nodeOrdinal - right.nodeOrdinal ||
				compareStrings(left.occurrenceKind, right.occurrenceKind) ||
				compareStrings(left.specifierState, right.specifierState) ||
				compareStrings(left.specifier ?? '', right.specifier ?? '')
		);

	const moduleExports: RawSemanticModuleExport[] = [];
	for (const [sourceOrdinal, exported] of exportsBySource) {
		const sourceInput = sourceByOrdinal.get(sourceOrdinal)!;
		const hasStarReexport = sourceInput.sourceFile.statements.some(
			(statement) =>
				ts.isExportDeclaration(statement) &&
				statement.moduleSpecifier !== undefined &&
				statement.exportClause === undefined
		);
		for (const symbol of exported) {
			const group = groupBySymbol.get(symbol);
			if (group === undefined) {
				if (unsupportedSymbols.has(symbol)) continue;
				throw new Error('Module export symbol was not collected.');
			}
			const alias = aliasByOrdinal.get(group.symbolOrdinal);
			const reexport =
				group.declarations.some((declaration) =>
					isReexportDeclaration(declaration.declaration, sourceInput.sourceFile)
				) ||
				(hasStarReexport &&
					group.declarations.every(
						(declaration) => declaration.declaration.getSourceFile() !== sourceInput.sourceFile
					));
			let state: RawSemanticModuleExport['state'];
			if (alias !== undefined && alias.state !== 'RESOLVED') state = 'UNRESOLVED';
			else if (reexport) state = 'REEXPORT';
			else if (alias !== undefined) state = 'ALIAS';
			else state = 'DIRECT';
			guard.addFact();
			moduleExports.push({
				exportName: symbol.getName(),
				sourceOrdinal,
				state,
				symbolOrdinal: group.symbolOrdinal,
				targetSymbolOrdinal:
					alias?.targetSymbolOrdinal ?? (state === 'REEXPORT' ? group.symbolOrdinal : null)
			});
		}
	}
	moduleExports.sort(
		(left, right) =>
			left.sourceOrdinal - right.sourceOrdinal ||
			compareStrings(left.exportName, right.exportName) ||
			left.symbolOrdinal - right.symbolOrdinal
	);
	const partialityReasons = [
		...new Map(
			pendingDeclarations
				.filter(
					(entry) =>
						entry.declaration.symbolBindingState === 'UNSUPPORTED' ||
						entry.declaration.scopeLinkState === 'UNSUPPORTED'
				)
				.map(({ declaration }) => {
					const message =
						declaration.symbolBindingState === 'UNSUPPORTED'
							? ts.isCallSignatureDeclaration(declaration.declaration) ||
								ts.isConstructSignatureDeclaration(declaration.declaration)
								? `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} has no independent public TypeScript Symbol; callable ownership is represented through its enclosing Type and TS_TYPE overload membership.`
								: `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} contributes incompatible checker-symbol bindings that the singular declaration contract cannot represent.`
							: `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} has scope placement outside the supported closed binding rules.`;
					const reason: RawSemanticPartialityReason = {
						capability: 'TS_SYMBOL',
						code: 'CAPABILITY_UNSUPPORTED',
						message,
						path: declaration.logicalPath
					};
					return [`${declaration.logicalPath}\0${message}`, reason] as const;
				})
		).values()
	].sort((left, right) =>
		compareStrings(`${left.path ?? ''}\0${left.message}`, `${right.path ?? ''}\0${right.message}`)
	);
	guard.check();
	return {
		aliases,
		declarations,
		moduleExports,
		moduleResolutions,
		overloadSets: typeProjection.overloadSets,
		partialityReasons,
		references,
		scopes,
		signatureParameters: typeProjection.signatureParameters,
		signatures: typeProjection.signatures,
		symbols,
		typeParameters: typeProjection.typeParameters,
		typeRelations: typeProjection.typeRelations,
		types: typeProjection.types
	};
}
