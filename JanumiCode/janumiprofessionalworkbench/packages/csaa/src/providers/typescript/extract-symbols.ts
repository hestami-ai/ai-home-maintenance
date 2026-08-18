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
import type { ExtractTypeScriptTypesInput, RawTypeScriptTypeProjection } from './extract-types.js';

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
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
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
			node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
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

interface DeclaringScopeLink {
	readonly key: string | null;
	readonly state: SemanticScopeLinkState;
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

interface PendingDeclaration {
	readonly declaration: DeclarationAnchor;
	readonly group: SymbolGroup | null;
}

interface SymbolExtractionState {
	readonly candidateByNode: WeakMap<ts.Node, RawSemanticDeclarationCandidate>;
	readonly conditionalHasInfer: WeakMap<ts.ConditionalTypeNode, boolean>;
	readonly declarationAnchorCache: WeakMap<ts.Declaration, DeclarationAnchor | null>;
	readonly directEvalEnvironments: WeakSet<ts.Node>;
	readonly globalScopeKey: string;
	readonly guard: TypeScriptSymbolExtractionGuard;
	readonly input: ExtractTypeScriptSymbolsInput;
	readonly metadataBySymbol: Map<ts.Symbol, SymbolMetadata>;
	readonly ordinalByNode: WeakMap<ts.Node, number>;
	readonly scopeKeyByBoundary: WeakMap<ts.Node, string>;
	readonly scopesByKey: Map<string, ScopeAnchor>;
	readonly sourceByFile: Map<ts.SourceFile, TypeScriptSymbolSourceInput>;
	readonly sourceByOrdinal: Map<number, TypeScriptSymbolSourceInput>;
}

interface CollectedSymbolFacts {
	readonly exportsBySource: Map<number, readonly ts.Symbol[]>;
	readonly moduleSymbols: Map<number, ts.Symbol>;
	readonly pendingModuleResolutions: PendingModuleResolution[];
	readonly pendingReferences: PendingReference[];
}

interface SourceReferenceContext {
	readonly declarationByNameNode: Map<ts.Node, ts.Declaration>;
	readonly declarationNameNodes: Set<ts.Node>;
	readonly sourceInput: TypeScriptSymbolSourceInput;
}

interface SymbolProjectionContext {
	readonly aliasByOrdinal: ReadonlyMap<number, RawSemanticAlias>;
	readonly groupBySymbol: ReadonlyMap<ts.Symbol, SymbolGroup>;
	readonly scopeOrdinalByKey: ReadonlyMap<string, number>;
	readonly unsupportedSymbols: ReadonlySet<ts.Symbol>;
}

interface ModuleExportContext {
	readonly aliasByOrdinal: ReadonlyMap<number, RawSemanticAlias>;
	readonly hasStarReexport: boolean;
	readonly sourceFile: ts.SourceFile;
	readonly sourceOrdinal: number;
}

function sourcesByLogicalPath(
	input: ExtractTypeScriptSymbolsInput
): readonly TypeScriptSymbolSourceInput[] {
	return [...input.sources].sort((left, right) =>
		compareStrings(left.source.logicalPath, right.source.logicalPath)
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

function variableEnvironment(node: ts.Node): ts.Node | null {
	let cursor: ts.Node | undefined = node;
	while (cursor !== undefined) {
		if (ts.isFunctionLike(cursor) || ts.isSourceFile(cursor)) return cursor;
		cursor = cursor.parent;
	}
	return null;
}

function variableDeclarationList(declaration: ts.Declaration): ts.VariableDeclarationList | null {
	let cursor: ts.Node | undefined = declaration;
	while (cursor !== undefined && !ts.isSourceFile(cursor) && !ts.isFunctionLike(cursor)) {
		if (ts.isVariableDeclarationList(cursor)) return cursor;
		cursor = cursor.parent;
	}
	return null;
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
		? compilerName.replace(/@\d+$/u, '')
		: compilerName;
	let name: string;
	if (sourceDeclaration === undefined)
		name = stableCompilerName.length === 0 ? '<anonymous>' : stableCompilerName;
	else name = `module:${sourceDeclaration.logicalPath}`;
	return isUnicodeScalarString(name)
		? name
		: `utf16-code-units:${encodeSemanticDiagnosticText(name).text}`;
}

function assertNodeSpan(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	invalidSpanMessage: string
): { readonly end: number; readonly start: number } {
	const start = node.getStart(sourceFile, false);
	const end = node.end;
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		start < 0 ||
		start > end ||
		end > sourceFile.text.length
	)
		throw new Error(invalidSpanMessage);
	return { end, start };
}

function indexSourceNodes(
	sourceInput: TypeScriptSymbolSourceInput,
	ordinalByNode: WeakMap<ts.Node, number>,
	candidateByNode: WeakMap<ts.Node, RawSemanticDeclarationCandidate>
): void {
	if (sourceInput.nodes === null) return;
	for (let index = 0; index < sourceInput.nodes.length; index += 1)
		ordinalByNode.set(sourceInput.nodes[index]!, index);
	for (const candidate of sourceInput.declarationCandidates) {
		const candidateNode = sourceInput.nodes[candidate.nodeOrdinal];
		if (candidateNode === undefined)
			throw new Error('Declaration candidate lacks its transient TypeScript node.');
		candidateByNode.set(candidateNode, candidate);
	}
}

function directEvalEnvironment(node: ts.Node): ts.Node | null {
	if (!ts.isCallExpression(node) || node.questionDotToken !== undefined) return null;
	const callee = transparentEvalCallee(node.expression);
	if (!ts.isIdentifier(callee) || callee.text !== 'eval') return null;
	return variableEnvironment(node);
}

function collectDirectEvalEnvironments(input: ExtractTypeScriptSymbolsInput): WeakSet<ts.Node> {
	const directEvalEnvironments = new WeakSet<ts.Node>();
	for (const sourceInput of input.sources)
		for (const node of sourceInput.nodes ?? []) {
			const environment = directEvalEnvironment(node);
			if (environment !== null) directEvalEnvironments.add(environment);
		}
	return directEvalEnvironments;
}

function seedProgramGlobalScope(
	input: ExtractTypeScriptSymbolsInput,
	scopesByKey: Map<string, ScopeAnchor>
): string {
	const globalDescriptor = programGlobalScopeDescriptor();
	const globalScopeKey = canonicalSemanticJson({
		domain: globalDescriptor.domain,
		kind: 'PROGRAM_GLOBAL',
		projectKey: input.projectKey
	});
	input.guard.addScope();
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
	return globalScopeKey;
}

function createSymbolExtractionState(input: ExtractTypeScriptSymbolsInput): SymbolExtractionState {
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
		indexSourceNodes(sourceInput, ordinalByNode, candidateByNode);
	}
	const directEvalEnvironments = collectDirectEvalEnvironments(input);
	const scopesByKey = new Map<string, ScopeAnchor>();
	const globalScopeKey = seedProgramGlobalScope(input, scopesByKey);
	return {
		candidateByNode,
		conditionalHasInfer: new WeakMap(),
		declarationAnchorCache: new WeakMap(),
		directEvalEnvironments,
		globalScopeKey,
		guard: input.guard,
		input,
		metadataBySymbol: new Map(),
		ordinalByNode,
		scopeKeyByBoundary: new WeakMap(),
		scopesByKey,
		sourceByFile,
		sourceByOrdinal
	};
}

function boundaryDescriptor(state: SymbolExtractionState, node: ts.Node) {
	const sourceInput = state.sourceByFile.get(node.getSourceFile());
	return semanticScopeBoundaryDescriptor(
		node.kind,
		sourceInput?.source.moduleKind ??
			(ts.isExternalModule(node.getSourceFile()) ? 'MODULE' : 'SCRIPT')
	);
}

function isStrictScopeBoundary(node: ts.Node): boolean {
	if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return true;
	if (ts.isSourceFile(node) && hasUseStrictPrologue(node.statements)) return true;
	const body = functionBody(node);
	return body !== undefined && ts.isBlock(body) && hasUseStrictPrologue(body.statements);
}

function isDefinitelyStrict(state: SymbolExtractionState, node: ts.Node): boolean {
	const compilerOptions = state.input.compilerOptions;
	if (
		compilerOptions.alwaysStrict === true ||
		(compilerOptions.alwaysStrict !== false && compilerOptions.strict === true)
	)
		return true;
	const sourceInput = state.sourceByFile.get(node.getSourceFile());
	if (sourceInput?.source.moduleKind === 'MODULE' || ts.isExternalModule(node.getSourceFile()))
		return true;
	let cursor: ts.Node | undefined = node.parent;
	while (cursor !== undefined) {
		if (isStrictScopeBoundary(cursor)) return true;
		cursor = cursor.parent;
	}
	return false;
}

function containsInferBinding(state: SymbolExtractionState, node: ts.ConditionalTypeNode): boolean {
	const cached = state.conditionalHasInfer.get(node);
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
	state.conditionalHasInfer.set(node, found);
	return found;
}

function isInsideConditionalInfer(state: SymbolExtractionState, node: ts.Node): boolean {
	let cursor: ts.Node | undefined = node;
	while (cursor !== undefined) {
		if (ts.isConditionalTypeNode(cursor) && containsInferBinding(state, cursor)) return true;
		cursor = cursor.parent;
	}
	return false;
}

function isDynamicallyAffectedReference(state: SymbolExtractionState, node: ts.Node): boolean {
	let cursor: ts.Node | undefined = node;
	while (cursor !== undefined) {
		if (ts.isWithStatement(cursor)) return true;
		cursor = cursor.parent;
	}
	const environment = variableEnvironment(node);
	return (
		isInsideConditionalInfer(state, node) ||
		(environment !== null && state.directEvalEnvironments.has(environment))
	);
}

function ensureContainingScope(state: SymbolExtractionState, node: ts.Node | undefined): string {
	let cursor = node;
	while (cursor !== undefined && boundaryDescriptor(state, cursor) === null) cursor = cursor.parent;
	return cursor === undefined ? state.globalScopeKey : ensureBoundaryScope(state, cursor);
}

function ensureOrdinaryContainingScope(
	state: SymbolExtractionState,
	node: ts.Node | undefined
): string {
	let cursor = node;
	while (cursor !== undefined) {
		const descriptor = boundaryDescriptor(state, cursor);
		if (descriptor !== null && isOrdinaryReferenceScope(descriptor.domain))
			return ensureBoundaryScope(state, cursor);
		cursor = cursor.parent;
	}
	return state.globalScopeKey;
}

function registerScopeAnchor(state: SymbolExtractionState, key: string, anchor: ScopeAnchor): void {
	const collision = state.scopesByKey.get(key);
	if (collision !== undefined && canonicalSemanticJson(collision) !== canonicalSemanticJson(anchor))
		throw new Error('Canonical scope anchor collision.');
	if (collision === undefined) {
		state.guard.addScope();
		state.scopesByKey.set(key, anchor);
	}
}

function ensureBoundaryScope(state: SymbolExtractionState, node: ts.Node): string {
	const existing = state.scopeKeyByBoundary.get(node);
	if (existing !== undefined) return existing;
	const descriptor = boundaryDescriptor(state, node);
	if (descriptor === null) return ensureContainingScope(state, node.parent);
	const { domain, kind } = descriptor;
	const sourceFile = node.getSourceFile();
	const sourceInput = state.sourceByFile.get(sourceFile);
	if (sourceInput === undefined) return state.globalScopeKey;
	const { end, start } = assertNodeSpan(
		node,
		sourceFile,
		'TypeScript returned an invalid scope span.'
	);
	const parentKey = ts.isSourceFile(node)
		? state.globalScopeKey
		: ensureContainingScope(state, node.parent);
	const key = canonicalSemanticJson({
		domain,
		end,
		kind,
		logicalPath: sourceInput.source.logicalPath,
		ownerKind: node.kind,
		start
	});
	const ownerNodeOrdinal =
		sourceInput.nodes === null ? null : (state.ordinalByNode.get(node) ?? null);
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
	registerScopeAnchor(state, key, anchor);
	state.scopeKeyByBoundary.set(node, key);
	return key;
}

function nearestVariableEnvironment(
	state: SymbolExtractionState,
	node: ts.Node | undefined
): string | null {
	let cursor = node;
	while (cursor !== undefined) {
		if (ts.isClassStaticBlockDeclaration(cursor)) return ensureBoundaryScope(state, cursor);
		if (ts.isFunctionLike(cursor)) return ensureBoundaryScope(state, cursor);
		if (ts.isModuleDeclaration(cursor)) return ensureBoundaryScope(state, cursor);
		if (ts.isSourceFile(cursor)) {
			const sourceScope = ensureBoundaryScope(state, cursor);
			return state.scopesByKey.get(sourceScope)?.kind === 'SOURCE_SCRIPT'
				? state.globalScopeKey
				: sourceScope;
		}
		cursor = cursor.parent;
	}
	return null;
}

function functionDeclarationScopeLink(
	state: SymbolExtractionState,
	declaration: ts.FunctionDeclaration
): DeclaringScopeLink | null {
	const parent = declaration.parent;
	if (
		ts.isBlock(parent) &&
		parent.parent !== undefined &&
		ts.isFunctionLike(parent.parent) &&
		functionBody(parent.parent) === parent
	)
		return { key: ensureBoundaryScope(state, parent.parent), state: 'RESOLVED' };
	if (
		!ts.isSourceFile(parent) &&
		!ts.isModuleBlock(parent) &&
		!isDefinitelyStrict(state, declaration)
	)
		return { key: null, state: 'UNSUPPORTED' };
	return null;
}

function hoistedVariableScopeLink(
	state: SymbolExtractionState,
	declaration: ts.Declaration
): DeclaringScopeLink | null {
	const list = variableDeclarationList(declaration);
	if (list === null || (list.flags & ts.NodeFlags.BlockScoped) !== 0) return null;
	const key = nearestVariableEnvironment(state, declaration.parent);
	return { key, state: key === null ? 'UNSUPPORTED' : 'RESOLVED' };
}

function lexicalDeclaringScopeLink(
	state: SymbolExtractionState,
	declaration: ts.Declaration
): DeclaringScopeLink {
	const key = ensureContainingScope(state, declaration.parent);
	return {
		key: state.scopesByKey.get(key)?.kind === 'SOURCE_SCRIPT' ? state.globalScopeKey : key,
		state: 'RESOLVED'
	};
}

function declaringScope(
	state: SymbolExtractionState,
	declaration: ts.Declaration
): DeclaringScopeLink {
	if (isParameterProperty(declaration)) return { key: null, state: 'UNSUPPORTED' };
	if (isInsideConditionalInfer(state, declaration)) return { key: null, state: 'UNSUPPORTED' };
	if (ts.isSourceFile(declaration))
		return { key: ensureBoundaryScope(state, declaration), state: 'RESOLVED' };
	if (ts.isFunctionExpression(declaration) || ts.isClassExpression(declaration))
		return { key: ensureBoundaryScope(state, declaration), state: 'RESOLVED' };
	if (ts.isFunctionDeclaration(declaration)) {
		const link = functionDeclarationScopeLink(state, declaration);
		if (link !== null) return link;
	}
	return (
		hoistedVariableScopeLink(state, declaration) ?? lexicalDeclaringScopeLink(state, declaration)
	);
}

function seedBoundaryScopes(state: SymbolExtractionState): void {
	for (const sourceInput of sourcesByLogicalPath(state.input)) {
		ensureBoundaryScope(state, sourceInput.sourceFile);
		for (const node of sourceInput.nodes ?? [])
			if (boundaryDescriptor(state, node) !== null) ensureBoundaryScope(state, node);
	}
}

function anchorForDeclaration(
	state: SymbolExtractionState,
	declaration: ts.Declaration
): DeclarationAnchor | null {
	const cached = state.declarationAnchorCache.get(declaration);
	if (cached !== undefined) return cached;
	const sourceFile = declaration.getSourceFile();
	const sourceInput = state.sourceByFile.get(sourceFile);
	if (sourceInput === undefined) {
		state.declarationAnchorCache.set(declaration, null);
		return null;
	}
	const { end, start } = assertNodeSpan(
		declaration,
		sourceFile,
		'TypeScript returned an invalid declaration span.'
	);
	const candidate = state.candidateByNode.get(declaration) ?? null;
	const nodeOrdinal =
		sourceInput.nodes === null ? null : (state.ordinalByNode.get(declaration) ?? null);
	const named = declarationName(ts.getNameOfDeclaration(declaration), sourceFile);
	const scope = declaringScope(state, declaration);
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
	state.declarationAnchorCache.set(declaration, anchor);
	return anchor;
}

function symbolDeclarations(
	state: SymbolExtractionState,
	symbol: ts.Symbol
): readonly DeclarationAnchor[] {
	const byKey = new Map<string, DeclarationAnchor>();
	for (const declaration of symbol.getDeclarations() ?? []) {
		const anchor = anchorForDeclaration(state, declaration);
		if (anchor !== null) byKey.set(anchor.key, anchor);
	}
	return [...byKey.values()].sort((left, right) => compareStrings(left.key, right.key));
}

function firstFallbackAnchor(
	state: SymbolExtractionState,
	symbol: ts.Symbol
): NodeAnchor | undefined {
	return [...(state.metadataBySymbol.get(symbol)?.fallbackAnchors.values() ?? [])].sort(
		(left, right) =>
			left.sourceOrdinal - right.sourceOrdinal || left.nodeOrdinal - right.nodeOrdinal
	)[0];
}

function symbolWorkKey(state: SymbolExtractionState, symbol: ts.Symbol): string {
	const declarations = symbolDeclarations(state, symbol);
	const fallbackAnchors = [
		...(state.metadataBySymbol.get(symbol)?.fallbackAnchors.values() ?? [])
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

function addSymbol(
	state: SymbolExtractionState,
	symbol: ts.Symbol | undefined,
	fallback?: NodeAnchor
): ts.Symbol | null {
	if (symbol === undefined) return null;
	let metadata = state.metadataBySymbol.get(symbol);
	if (metadata === undefined) {
		metadata = { fallbackAnchors: new Map(), symbol };
		state.metadataBySymbol.set(symbol, metadata);
	}
	if (fallback !== undefined) metadata.fallbackAnchors.set(nodeAnchorKey(fallback), fallback);
	return symbol;
}

function symbolQuery<T>(
	state: SymbolExtractionState,
	kind: string,
	discriminator: string,
	action: () => T
): T {
	return state.guard.query(`${state.input.projectKey}\0${kind}\0${discriminator}`, action);
}

function indexDeclarationNameNodes(context: SourceReferenceContext): void {
	const nodes = context.sourceInput.nodes;
	if (nodes === null) return;
	for (const candidate of context.sourceInput.declarationCandidates) {
		if (candidate.nameNodeOrdinal === null) continue;
		const nameNode = nodes[candidate.nameNodeOrdinal]!;
		context.declarationNameNodes.add(nameNode);
		context.declarationByNameNode.set(nameNode, nodes[candidate.nodeOrdinal]! as ts.Declaration);
	}
}

function referenceScopeLink(
	state: SymbolExtractionState,
	node: ts.Node,
	declaration: ts.Declaration | undefined
): DeclaringScopeLink {
	if (isDynamicallyAffectedReference(state, node)) return { key: null, state: 'UNSUPPORTED' };
	if (declaration === undefined)
		return { key: ensureOrdinaryContainingScope(state, node.parent), state: 'RESOLVED' };
	return declaringScope(state, declaration);
}

function collectNodeReference(
	state: SymbolExtractionState,
	collected: CollectedSymbolFacts,
	context: SourceReferenceContext,
	node: ts.Node,
	nodeOrdinal: number
): void {
	const role = referenceRole(node, context.declarationNameNodes);
	if (role === null) return;
	const declaration =
		role === 'DECLARATION_NAME' ? context.declarationByNameNode.get(node) : undefined;
	const scope = referenceScopeLink(state, node, declaration);
	const symbol = addSymbol(
		state,
		symbolQuery(
			state,
			'node-symbol',
			`${context.sourceInput.source.logicalPath}\0${String(nodeOrdinal)}`,
			() => state.input.checker.getSymbolAtLocation(node)
		),
		{
			nodeOrdinal,
			sourceOrdinal: context.sourceInput.source.sourceOrdinal
		}
	);
	collected.pendingReferences.push({
		containingScopeKey: scope.key,
		nodeOrdinal,
		role,
		scopeLinkState: scope.state,
		sourceOrdinal: context.sourceInput.source.sourceOrdinal,
		symbol
	});
}

function resolveModuleTarget(
	state: SymbolExtractionState,
	occurrence: ModuleOccurrence,
	symbol: ts.Symbol | null
): {
	readonly resolutionState: RawSemanticModuleResolution['resolutionState'];
	readonly targetSourceOrdinal: number | null;
} {
	const unresolved: RawSemanticModuleResolution['resolutionState'] =
		occurrence.specifierState === 'NON_LITERAL' ? 'UNSUPPORTED' : 'UNRESOLVED';
	if (symbol === null) return { resolutionState: unresolved, targetSourceOrdinal: null };
	const declarations = symbolDeclarations(state, symbol);
	const sourceDeclaration = declarations.find(
		(declaration) => declaration.kind === ts.SyntaxKind.SourceFile
	);
	if (sourceDeclaration === undefined)
		return {
			resolutionState: declarations.length > 0 ? 'RESOLVED_AMBIENT' : 'UNRESOLVED',
			targetSourceOrdinal: null
		};
	const targetSourceOrdinal = sourceDeclaration.sourceOrdinal;
	const targetSource = state.sourceByOrdinal.get(targetSourceOrdinal)!.source;
	return {
		resolutionState: isExternalOrigin(targetSource) ? 'RESOLVED_EXTERNAL' : 'RESOLVED_SOURCE',
		targetSourceOrdinal
	};
}

function collectNodeModuleResolution(
	state: SymbolExtractionState,
	collected: CollectedSymbolFacts,
	sourceInput: TypeScriptSymbolSourceInput,
	node: ts.Node
): void {
	const occurrence = moduleOccurrence(node);
	if (occurrence === null) return;
	const specifierOrdinal = state.ordinalByNode.get(occurrence.node);
	if (specifierOrdinal === undefined)
		throw new Error('Module occurrence specifier is outside the retained AST profile.');
	const anchor = {
		nodeOrdinal: specifierOrdinal,
		sourceOrdinal: sourceInput.source.sourceOrdinal
	};
	const symbol =
		occurrence.specifierState === 'LITERAL'
			? addSymbol(
					state,
					symbolQuery(
						state,
						'module-symbol',
						`${sourceInput.source.logicalPath}\0${String(specifierOrdinal)}\0${occurrence.kind}`,
						() => state.input.checker.getSymbolAtLocation(occurrence.node)
					),
					anchor
				)
			: null;
	const resolved = resolveModuleTarget(state, occurrence, symbol);
	collected.pendingModuleResolutions.push({
		moduleSymbol: symbol,
		nodeOrdinal: specifierOrdinal,
		occurrenceKind: occurrence.kind,
		resolutionState: resolved.resolutionState,
		sourceOrdinal: sourceInput.source.sourceOrdinal,
		specifier: occurrence.specifier,
		specifierState: occurrence.specifierState,
		targetSourceOrdinal: resolved.targetSourceOrdinal,
		typeOnly: occurrence.typeOnly
	});
}

function collectSourceReferences(
	state: SymbolExtractionState,
	collected: CollectedSymbolFacts,
	sourceInput: TypeScriptSymbolSourceInput
): void {
	state.guard.check();
	const rootAnchor =
		sourceInput.nodes === null
			? undefined
			: { nodeOrdinal: 0, sourceOrdinal: sourceInput.source.sourceOrdinal };
	const moduleSymbol = addSymbol(
		state,
		symbolQuery(state, 'source-symbol', sourceInput.source.logicalPath, () =>
			state.input.checker.getSymbolAtLocation(sourceInput.sourceFile)
		),
		rootAnchor
	);
	if (moduleSymbol !== null)
		collected.moduleSymbols.set(sourceInput.source.sourceOrdinal, moduleSymbol);
	const nodes = sourceInput.nodes;
	if (nodes === null) return;
	const context: SourceReferenceContext = {
		declarationByNameNode: new Map(),
		declarationNameNodes: new Set(),
		sourceInput
	};
	indexDeclarationNameNodes(context);
	for (let nodeOrdinal = 0; nodeOrdinal < nodes.length; nodeOrdinal += 1) {
		state.guard.check();
		const node = nodes[nodeOrdinal]!;
		collectNodeReference(state, collected, context, node, nodeOrdinal);
		collectNodeModuleResolution(state, collected, sourceInput, node);
	}
}

function collectSourceExports(
	state: SymbolExtractionState,
	collected: CollectedSymbolFacts,
	sourceInput: TypeScriptSymbolSourceInput
): void {
	if (sourceInput.nodes === null) return;
	const moduleSymbol = collected.moduleSymbols.get(sourceInput.source.sourceOrdinal);
	if (moduleSymbol === undefined) return;
	const exported = [
		...symbolQuery(state, 'module-exports', sourceInput.source.logicalPath, () =>
			state.input.checker.getExportsOfModule(moduleSymbol)
		)
	].sort((left, right) => compareStrings(symbolWorkKey(state, left), symbolWorkKey(state, right)));
	collected.exportsBySource.set(sourceInput.source.sourceOrdinal, exported);
	for (const symbol of exported)
		addSymbol(state, symbol, { nodeOrdinal: 0, sourceOrdinal: sourceInput.source.sourceOrdinal });
}

function collectSourceFacts(state: SymbolExtractionState): CollectedSymbolFacts {
	const collected: CollectedSymbolFacts = {
		exportsBySource: new Map(),
		moduleSymbols: new Map(),
		pendingModuleResolutions: [],
		pendingReferences: []
	};
	for (const sourceInput of sourcesByLogicalPath(state.input))
		collectSourceReferences(state, collected, sourceInput);
	for (const sourceInput of sourcesByLogicalPath(state.input))
		collectSourceExports(state, collected, sourceInput);
	return collected;
}

function resolveAliasChain(state: SymbolExtractionState, alias: ts.Symbol): AliasResolution {
	const discriminator = symbolWorkKey(state, alias);
	const seen = new Set<ts.Symbol>([alias]);
	let cursor = alias;
	let target: ts.Symbol | null = null;
	let terminal: ts.Symbol | null = null;
	let aliasState: RawSemanticAlias['state'] = 'RESOLVED';
	for (;;) {
		state.guard.check();
		const immediate = symbolQuery(
			state,
			'immediate-alias',
			`${discriminator}\0${symbolWorkKey(state, cursor)}`,
			() => state.input.checker.getImmediateAliasedSymbol(cursor)
		);
		if (immediate === undefined) {
			aliasState = 'UNRESOLVED';
			break;
		}
		const unknown = symbolQuery(state, 'unknown-symbol', symbolWorkKey(state, immediate), () =>
			state.input.checker.isUnknownSymbol(immediate!)
		);
		if (unknown) {
			aliasState = 'UNRESOLVED';
			break;
		}
		addSymbol(state, immediate, firstFallbackAnchor(state, alias));
		target ??= immediate;
		if (seen.has(immediate)) {
			aliasState = 'CIRCULAR';
			break;
		}
		seen.add(immediate);
		if ((immediate.getFlags() & ts.SymbolFlags.Alias) === 0) {
			terminal = immediate;
			break;
		}
		cursor = immediate;
	}
	return {
		state: aliasState,
		target: aliasState === 'UNRESOLVED' ? null : target,
		terminal: aliasState === 'RESOLVED' ? terminal : null
	};
}

function resolveAliases(state: SymbolExtractionState): Map<ts.Symbol, AliasResolution> {
	const aliasBySymbol = new Map<ts.Symbol, AliasResolution>();
	let aliasesPending = true;
	while (aliasesPending) {
		aliasesPending = false;
		const aliases = [...state.metadataBySymbol.keys()]
			.filter(
				(symbol) => (symbol.getFlags() & ts.SymbolFlags.Alias) !== 0 && !aliasBySymbol.has(symbol)
			)
			.sort((left, right) =>
				compareStrings(symbolWorkKey(state, left), symbolWorkKey(state, right))
			);
		for (const alias of aliases) {
			aliasesPending = true;
			aliasBySymbol.set(alias, resolveAliasChain(state, alias));
		}
	}
	return aliasBySymbol;
}

function buildSymbolInputs(state: SymbolExtractionState): SymbolInput[] {
	return [...state.metadataBySymbol.values()].map((metadata) => {
		const declarations = symbolDeclarations(state, metadata.symbol);
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
}

function indexInputsByDeclaration(
	symbolInputs: readonly SymbolInput[]
): Map<string, SymbolInput[]> {
	const inputsByDeclaration = new Map<string, SymbolInput[]>();
	for (const symbolInput of symbolInputs)
		for (const declaration of symbolInput.declarations) {
			const owners = inputsByDeclaration.get(declaration.key) ?? [];
			owners.push(symbolInput);
			inputsByDeclaration.set(declaration.key, owners);
		}
	return inputsByDeclaration;
}

function hasIncompatibleOwners(
	owners: readonly SymbolInput[],
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): boolean {
	return (
		owners.some(
			(owner) =>
				unsupportedSymbols.has(owner.metadata.symbol) ||
				owner.declarations.some((declaration) => declaration.symbolBindingState === 'UNSUPPORTED')
		) || new Set(owners.map((owner) => owner.signature)).size > 1
	);
}

function markOwnersUnsupported(
	owners: readonly SymbolInput[],
	unsupportedSymbols: Set<ts.Symbol>
): boolean {
	let changed = false;
	for (const owner of owners)
		if (!unsupportedSymbols.has(owner.metadata.symbol)) {
			unsupportedSymbols.add(owner.metadata.symbol);
			changed = true;
		}
	return changed;
}

function unsupportedSymbolSet(symbolInputs: readonly SymbolInput[]): Set<ts.Symbol> {
	const inputsByDeclaration = indexInputsByDeclaration(symbolInputs);
	const unsupportedSymbols = new Set<ts.Symbol>();
	let unsupportedChanged = true;
	while (unsupportedChanged) {
		unsupportedChanged = false;
		for (const owners of inputsByDeclaration.values())
			if (
				hasIncompatibleOwners(owners, unsupportedSymbols) &&
				markOwnersUnsupported(owners, unsupportedSymbols)
			)
				unsupportedChanged = true;
	}
	return unsupportedSymbols;
}

function unsupportedDeclarationIndex(
	symbolInputs: readonly SymbolInput[],
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): Map<string, DeclarationAnchor> {
	const unsupportedDeclarationsByKey = new Map<string, DeclarationAnchor>();
	for (const owner of symbolInputs.filter((entry) => unsupportedSymbols.has(entry.metadata.symbol)))
		for (const declaration of owner.declarations)
			unsupportedDeclarationsByKey.set(declaration.key, {
				...declaration,
				symbolBindingState: 'UNSUPPORTED'
			});
	return unsupportedDeclarationsByKey;
}

function ensureGroupBuilder(
	buildersByKey: Map<string, GroupBuilder>,
	key: string,
	flags: number
): GroupBuilder {
	const existing = buildersByKey.get(key);
	if (existing !== undefined) return existing;
	const builder: GroupBuilder = {
		declarations: new Map(),
		fallbackAnchors: new Map(),
		flags,
		key,
		names: new Set(),
		representatives: []
	};
	buildersByKey.set(key, builder);
	return builder;
}

function buildPreliminaryBuilders(
	symbolInputs: readonly SymbolInput[],
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): GroupBuilder[] {
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
		const builder = ensureGroupBuilder(buildersByKey, key, flags);
		builder.flags |= flags;
		builder.names.add(name);
		builder.representatives.push(metadata.symbol);
		for (const declaration of declarations) builder.declarations.set(declaration.key, declaration);
		for (const anchor of fallbackAnchors)
			builder.fallbackAnchors.set(nodeAnchorKey(anchor), anchor);
	}
	return [...buildersByKey.values()];
}

function findRoot(parents: number[], index: number): number {
	let root = index;
	while (parents[root] !== root) root = parents[root]!;
	let cursor = index;
	while (parents[cursor] !== cursor) {
		const parent = parents[cursor]!;
		parents[cursor] = root;
		cursor = parent;
	}
	return root;
}

function mergeBuildersByDeclaration(preliminaryBuilders: readonly GroupBuilder[]): number[] {
	const parents = preliminaryBuilders.map((_, index) => index);
	const declarationOwner = new Map<string, number>();
	for (let index = 0; index < preliminaryBuilders.length; index += 1)
		for (const declarationKey of preliminaryBuilders[index]!.declarations.keys()) {
			const owner = declarationOwner.get(declarationKey);
			if (owner === undefined) declarationOwner.set(declarationKey, index);
			else {
				const left = findRoot(parents, index);
				const right = findRoot(parents, owner);
				if (left !== right) parents[Math.max(left, right)] = Math.min(left, right);
			}
		}
	return parents;
}

function ensureMergedBuilder(
	mergedByRoot: Map<number, Omit<GroupBuilder, 'key'>>,
	root: number
): Omit<GroupBuilder, 'key'> {
	const existing = mergedByRoot.get(root);
	if (existing !== undefined) return existing;
	const merged: Omit<GroupBuilder, 'key'> = {
		declarations: new Map(),
		fallbackAnchors: new Map(),
		flags: 0,
		names: new Set(),
		representatives: []
	};
	mergedByRoot.set(root, merged);
	return merged;
}

function mergeGroupBuilders(
	preliminaryBuilders: readonly GroupBuilder[],
	parents: number[]
): Map<number, Omit<GroupBuilder, 'key'>> {
	const mergedByRoot = new Map<number, Omit<GroupBuilder, 'key'>>();
	for (let index = 0; index < preliminaryBuilders.length; index += 1) {
		const builder = preliminaryBuilders[index]!;
		const merged = ensureMergedBuilder(mergedByRoot, findRoot(parents, index));
		merged.flags |= builder.flags;
		for (const [key, declaration] of builder.declarations)
			merged.declarations.set(key, declaration);
		for (const [key, anchor] of builder.fallbackAnchors) merged.fallbackAnchors.set(key, anchor);
		for (const name of builder.names) merged.names.add(name);
		merged.representatives.push(...builder.representatives);
	}
	return mergedByRoot;
}

function finalizeGroupBuilder(builder: Omit<GroupBuilder, 'key'>): GroupBuilder {
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
}

function finalizeSymbolGroup(
	state: SymbolExtractionState,
	builder: GroupBuilder,
	symbolOrdinal: number
): SymbolGroup {
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
			compareStrings(symbolWorkKey(state, left), symbolWorkKey(state, right))
		),
		symbolOrdinal
	};
}

function buildSymbolGroups(
	state: SymbolExtractionState,
	symbolInputs: readonly SymbolInput[],
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): SymbolGroup[] {
	const preliminaryBuilders = buildPreliminaryBuilders(symbolInputs, unsupportedSymbols);
	const parents = mergeBuildersByDeclaration(preliminaryBuilders);
	const mergedByRoot = mergeGroupBuilders(preliminaryBuilders, parents);
	const sortedBuilders = [...mergedByRoot.values()]
		.map((builder) => finalizeGroupBuilder(builder))
		.sort((left, right) => compareStrings(left.key, right.key));
	return sortedBuilders.map((builder, symbolOrdinal) =>
		finalizeSymbolGroup(state, builder, symbolOrdinal)
	);
}

function buildScopeProjection(state: SymbolExtractionState): {
	readonly scopeOrdinalByKey: ReadonlyMap<string, number>;
	readonly scopes: RawSemanticScope[];
} {
	const sortedScopeAnchors = [...state.scopesByKey.values()].sort((left, right) =>
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
	return { scopeOrdinalByKey, scopes };
}

function unsupportedCallableAnchor(
	state: SymbolExtractionState,
	declaration: ts.Node | undefined,
	groupedDeclarationKeys: ReadonlySet<string>
): DeclarationAnchor | null {
	if (
		declaration === undefined ||
		(!ts.isCallSignatureDeclaration(declaration) &&
			!ts.isConstructSignatureDeclaration(declaration))
	)
		return null;
	const anchor = anchorForDeclaration(state, declaration);
	return anchor === null || groupedDeclarationKeys.has(anchor.key) ? null : anchor;
}

function markUnsupportedCallableDeclarations(
	state: SymbolExtractionState,
	groups: readonly SymbolGroup[],
	unsupportedDeclarationsByKey: Map<string, DeclarationAnchor>
): void {
	const groupedDeclarationKeys = new Set(
		groups.flatMap((group) => group.declarations.map((declaration) => declaration.key))
	);
	for (const sourceInput of sourcesByLogicalPath(state.input)) {
		const nodes = sourceInput.nodes;
		if (nodes === null) continue;
		for (const candidate of [...sourceInput.declarationCandidates].sort(
			(left, right) => left.nodeOrdinal - right.nodeOrdinal
		)) {
			const anchor = unsupportedCallableAnchor(
				state,
				nodes[candidate.nodeOrdinal],
				groupedDeclarationKeys
			);
			if (anchor !== null)
				unsupportedDeclarationsByKey.set(anchor.key, {
					...anchor,
					symbolBindingState: 'UNSUPPORTED'
				});
		}
	}
}

function buildPendingDeclarations(
	groups: readonly SymbolGroup[],
	unsupportedDeclarationsByKey: ReadonlyMap<string, DeclarationAnchor>
): PendingDeclaration[] {
	return [
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
}

function buildDeclarationRecords(
	guard: TypeScriptSymbolExtractionGuard,
	pendingDeclarations: readonly PendingDeclaration[],
	scopeOrdinalByKey: ReadonlyMap<string, number>,
	declarationOrdinalByKey: Map<string, number>
): RawSemanticDeclaration[] {
	return pendingDeclarations.map(({ declaration, group }, declarationOrdinal) => {
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
	});
}

function valueDeclarationOrdinalFor(
	state: SymbolExtractionState,
	group: SymbolGroup,
	declarationOrdinalByKey: ReadonlyMap<string, number>
): number | null {
	const valueDeclarationKeys = new Set<string>();
	for (const representative of group.representatives) {
		if (representative.valueDeclaration === undefined) continue;
		const anchor = anchorForDeclaration(state, representative.valueDeclaration);
		if (anchor !== null) valueDeclarationKeys.add(anchor.key);
	}
	return (
		[...valueDeclarationKeys]
			.sort(compareStrings)
			.map((key) => declarationOrdinalByKey.get(`${group.key}\0${key}`))
			.find((value): value is number => value !== undefined) ?? null
	);
}

function buildSymbolRecords(
	state: SymbolExtractionState,
	groups: readonly SymbolGroup[],
	declarationOrdinalByKey: ReadonlyMap<string, number>
): RawSemanticSymbol[] {
	return groups.map((group) => {
		state.guard.addFact();
		const declarationOrdinals = group.declarations.map((declaration) =>
			declarationOrdinalByKey.get(`${group.key}\0${declaration.key}`)!
		);
		const valueDeclarationOrdinal = valueDeclarationOrdinalFor(
			state,
			group,
			declarationOrdinalByKey
		);
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
}

function typeExtractionInput(
	state: SymbolExtractionState,
	groups: readonly SymbolGroup[],
	pendingDeclarations: readonly PendingDeclaration[],
	declarationOrdinalByKey: ReadonlyMap<string, number>
): ExtractTypeScriptTypesInput {
	const input = state.input;
	return {
		assignabilityRequests: input.assignabilityRequests,
		checker: input.checker,
		declarations: pendingDeclarations.map(({ declaration }, declarationOrdinal) => ({
			declaration: declaration.declaration,
			declarationOrdinal
		})),
		guard: input.guard,
		nodeAnchorForNode: (node) => {
			const sourceInput = state.sourceByFile.get(node.getSourceFile());
			const nodeOrdinal = state.ordinalByNode.get(node);
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
				const declarationOrdinal = declarationOrdinalByKey.get(`${group.key}\0${declaration.key}`);
				if (declarationOrdinal === undefined)
					throw new Error('Canonical type bridge lacks a declaration ordinal.');
				return { declaration: declaration.declaration, declarationOrdinal };
			}),
			flags: group.flags,
			representatives: group.representatives,
			symbolOrdinal: group.symbolOrdinal
		}))
	};
}

function emptyTypeProjection(): RawTypeScriptTypeProjection {
	return {
		overloadSets: [],
		signatureParameters: [],
		signatures: [],
		typeParameters: [],
		typeRelations: [],
		types: []
	};
}

function aliasRecordForGroup(
	group: SymbolGroup,
	aliasBySymbol: ReadonlyMap<ts.Symbol, AliasResolution>,
	groupBySymbol: ReadonlyMap<ts.Symbol, SymbolGroup>,
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): RawSemanticAlias {
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
	return [...normalized.values()][0]!;
}

function buildAliasRecords(
	state: SymbolExtractionState,
	groups: readonly SymbolGroup[],
	aliasBySymbol: ReadonlyMap<ts.Symbol, AliasResolution>,
	groupBySymbol: ReadonlyMap<ts.Symbol, SymbolGroup>,
	unsupportedSymbols: ReadonlySet<ts.Symbol>
): RawSemanticAlias[] {
	const aliases: RawSemanticAlias[] = [];
	for (const group of groups.filter(
		(candidate) => (candidate.flags & ts.SymbolFlags.Alias) !== 0
	)) {
		const record = aliasRecordForGroup(group, aliasBySymbol, groupBySymbol, unsupportedSymbols);
		state.guard.addFact();
		aliases.push(record);
	}
	aliases.sort((left, right) => left.aliasSymbolOrdinal - right.aliasSymbolOrdinal);
	return aliases;
}

function referenceRecord(
	reference: PendingReference,
	context: SymbolProjectionContext
): RawSemanticReference {
	const group =
		reference.symbol === null ? null : (context.groupBySymbol.get(reference.symbol) ?? null);
	const base = {
		containingScopeOrdinal:
			reference.containingScopeKey === null
				? null
				: (context.scopeOrdinalByKey.get(reference.containingScopeKey) ?? null),
		nodeOrdinal: reference.nodeOrdinal,
		role: reference.role,
		scopeLinkState: reference.scopeLinkState,
		sourceOrdinal: reference.sourceOrdinal
	};
	if (reference.symbol !== null && context.unsupportedSymbols.has(reference.symbol))
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
	const alias = context.aliasByOrdinal.get(group.symbolOrdinal);
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
		symbolOrdinal: alias.state === 'UNRESOLVED' ? group.symbolOrdinal : null
	};
}

function buildReferenceRecords(
	state: SymbolExtractionState,
	pendingReferences: readonly PendingReference[],
	context: SymbolProjectionContext
): RawSemanticReference[] {
	return pendingReferences
		.map((reference): RawSemanticReference => {
			state.guard.addFact();
			return referenceRecord(reference, context);
		})
		.sort(
			(left, right) =>
				left.sourceOrdinal - right.sourceOrdinal ||
				left.nodeOrdinal - right.nodeOrdinal ||
				compareStrings(left.role, right.role)
		);
}

function buildModuleResolutionRecords(
	state: SymbolExtractionState,
	pendingModuleResolutions: readonly PendingModuleResolution[],
	context: SymbolProjectionContext
): RawSemanticModuleResolution[] {
	return pendingModuleResolutions
		.map((resolution): RawSemanticModuleResolution => {
			state.guard.addFact();
			const unsupportedModuleSymbol =
				resolution.moduleSymbol !== null && context.unsupportedSymbols.has(resolution.moduleSymbol);
			return {
				moduleSymbolOrdinal:
					resolution.moduleSymbol === null
						? null
						: (context.groupBySymbol.get(resolution.moduleSymbol)?.symbolOrdinal ?? null),
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
}

function hasStarReexport(sourceFile: ts.SourceFile): boolean {
	return sourceFile.statements.some(
		(statement) =>
			ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier !== undefined &&
			statement.exportClause === undefined
	);
}

function moduleExportRecord(
	symbol: ts.Symbol,
	group: SymbolGroup,
	context: ModuleExportContext
): RawSemanticModuleExport {
	const alias = context.aliasByOrdinal.get(group.symbolOrdinal);
	const reexport =
		group.declarations.some((declaration) =>
			isReexportDeclaration(declaration.declaration, context.sourceFile)
		) ||
		(context.hasStarReexport &&
			group.declarations.every(
				(declaration) => declaration.declaration.getSourceFile() !== context.sourceFile
			));
	let exportState: RawSemanticModuleExport['state'];
	if (alias !== undefined && alias.state !== 'RESOLVED') exportState = 'UNRESOLVED';
	else if (reexport) exportState = 'REEXPORT';
	else if (alias !== undefined) exportState = 'ALIAS';
	else exportState = 'DIRECT';
	return {
		exportName: symbol.getName(),
		sourceOrdinal: context.sourceOrdinal,
		state: exportState,
		symbolOrdinal: group.symbolOrdinal,
		targetSymbolOrdinal:
			alias?.targetSymbolOrdinal ?? (exportState === 'REEXPORT' ? group.symbolOrdinal : null)
	};
}

function buildModuleExportRecords(
	state: SymbolExtractionState,
	collected: CollectedSymbolFacts,
	context: SymbolProjectionContext
): RawSemanticModuleExport[] {
	const moduleExports: RawSemanticModuleExport[] = [];
	for (const [sourceOrdinal, exported] of collected.exportsBySource) {
		const sourceInput = state.sourceByOrdinal.get(sourceOrdinal)!;
		const exportContext: ModuleExportContext = {
			aliasByOrdinal: context.aliasByOrdinal,
			hasStarReexport: hasStarReexport(sourceInput.sourceFile),
			sourceFile: sourceInput.sourceFile,
			sourceOrdinal
		};
		for (const symbol of exported) {
			const group = context.groupBySymbol.get(symbol);
			if (group === undefined) {
				if (context.unsupportedSymbols.has(symbol)) continue;
				throw new Error('Module export symbol was not collected.');
			}
			const record = moduleExportRecord(symbol, group, exportContext);
			state.guard.addFact();
			moduleExports.push(record);
		}
	}
	moduleExports.sort(
		(left, right) =>
			left.sourceOrdinal - right.sourceOrdinal ||
			compareStrings(left.exportName, right.exportName) ||
			left.symbolOrdinal - right.symbolOrdinal
	);
	return moduleExports;
}

function partialityMessage(declaration: DeclarationAnchor): string {
	if (declaration.symbolBindingState === 'UNSUPPORTED') {
		if (
			ts.isCallSignatureDeclaration(declaration.declaration) ||
			ts.isConstructSignatureDeclaration(declaration.declaration)
		)
			return `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} has no independent public TypeScript Symbol; callable ownership is represented through its enclosing Type and TS_TYPE overload membership.`;
		return `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} contributes incompatible checker-symbol bindings that the singular declaration contract cannot represent.`;
	}
	return `Declaration ${declaration.kindName} at UTF-16 ${String(declaration.start)}-${String(declaration.end)} has scope placement outside the supported closed binding rules.`;
}

function buildPartialityReasons(
	pendingDeclarations: readonly PendingDeclaration[]
): RawSemanticPartialityReason[] {
	return [
		...new Map(
			pendingDeclarations
				.filter(
					(entry) =>
						entry.declaration.symbolBindingState === 'UNSUPPORTED' ||
						entry.declaration.scopeLinkState === 'UNSUPPORTED'
				)
				.map(({ declaration }) => {
					const message = partialityMessage(declaration);
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
}

/**
 * Project TypeChecker facts into identity-free records. TypeScript objects are
 * retained only while this function executes; every ordinal is assigned from
 * canonical source/declaration/reference anchors after collection completes.
 */
export function extractTypeScriptSymbols(
	input: ExtractTypeScriptSymbolsInput
): RawTypeScriptSymbolProjection {
	const { guard } = input;
	guard.check();
	const state = createSymbolExtractionState(input);
	seedBoundaryScopes(state);

	const collected = collectSourceFacts(state);
	const aliasBySymbol = resolveAliases(state);
	const symbolInputs = buildSymbolInputs(state);
	const unsupportedSymbols = unsupportedSymbolSet(symbolInputs);
	const unsupportedDeclarationsByKey = unsupportedDeclarationIndex(
		symbolInputs,
		unsupportedSymbols
	);
	const groups = buildSymbolGroups(state, symbolInputs, unsupportedSymbols);
	const groupBySymbol = new Map<ts.Symbol, SymbolGroup>();
	for (const group of groups)
		for (const representative of group.representatives) groupBySymbol.set(representative, group);
	const { scopeOrdinalByKey, scopes } = buildScopeProjection(state);
	markUnsupportedCallableDeclarations(state, groups, unsupportedDeclarationsByKey);
	const pendingDeclarations = buildPendingDeclarations(groups, unsupportedDeclarationsByKey);
	const declarationOrdinalByKey = new Map<string, number>();
	const declarations = buildDeclarationRecords(
		guard,
		pendingDeclarations,
		scopeOrdinalByKey,
		declarationOrdinalByKey
	);
	const symbols = buildSymbolRecords(state, groups, declarationOrdinalByKey);
	const typeProjection = input.includeTypes
		? extractTypeScriptTypes(
				typeExtractionInput(state, groups, pendingDeclarations, declarationOrdinalByKey)
			)
		: emptyTypeProjection();
	const aliases = buildAliasRecords(
		state,
		groups,
		aliasBySymbol,
		groupBySymbol,
		unsupportedSymbols
	);
	const aliasByOrdinal = new Map(
		aliases.map((alias) => [alias.aliasSymbolOrdinal, alias] as const)
	);
	const projection: SymbolProjectionContext = {
		aliasByOrdinal,
		groupBySymbol,
		scopeOrdinalByKey,
		unsupportedSymbols
	};
	const references = buildReferenceRecords(state, collected.pendingReferences, projection);
	const moduleResolutions = buildModuleResolutionRecords(
		state,
		collected.pendingModuleResolutions,
		projection
	);
	const moduleExports = buildModuleExportRecords(state, collected, projection);
	const partialityReasons = buildPartialityReasons(pendingDeclarations);
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
