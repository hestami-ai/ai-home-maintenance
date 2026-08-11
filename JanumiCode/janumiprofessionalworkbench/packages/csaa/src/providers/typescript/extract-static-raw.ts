import ts from 'typescript';
import type { ProgramRecipe, ProjectSubjectRecord } from '../../contracts/subject.js';
import {
	TYPESCRIPT_PROVIDER_VERSION,
	type SemanticAstStructuralRole,
	type SemanticBudgets,
	type SemanticDiagnosticFamily
} from '../../contracts/semantic.js';
import { canonicalSemanticJson, encodeSemanticDiagnosticText, isUnicodeScalarString } from '../../semantic/canonical.js';
import { validateProgramRecipePolicy } from '../../semantic/program-recipe-policy.js';
import type {
	RawSemanticAssignment,
	RawSemanticAstNode,
	RawSemanticDeclarationCandidate,
	RawSemanticDiagnosticFamilyCoverage,
	RawSemanticDiagnosticMessage,
	RawSemanticDiagnosticOccurrence,
	RawSemanticInvocation,
	RawSemanticLiteral,
	RawSemanticPartialityReason,
	RawSemanticProgramRecipe,
	RawSemanticProject,
	RawSemanticRelatedDiagnostic,
	RawSemanticSource,
	RawSemanticValue,
	RawCompilerSourceBinding,
	RawStaticSemanticProjectExtraction
} from '../../semantic/raw-semantic-model.js';
import {
	AST_STRUCTURAL_ROLES,
	PUBLIC_NODE_FLAG_MASK,
	isTypeScriptModifierKind,
	literalLexemeDigest,
	literalValueDigest,
	literalValueLength,
	semanticAssignmentKind,
	semanticDeclarationCandidateRole,
	semanticDeclarationNameState,
	semanticInvocationKind,
	semanticLiteralDescriptor,
	typescriptSyntaxKindName
} from '../../semantic/syntax-projection.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';

export const RAW_DIAGNOSTIC_FAMILIES = [
	'CONFIGURATION',
	'OPTIONS',
	'GLOBAL',
	'SYNTACTIC',
	'SEMANTIC',
	'DECLARATION'
] as const satisfies readonly SemanticDiagnosticFamily[];

export interface StaticRawDiagnosticFamilyInput {
	readonly diagnostics: readonly ts.Diagnostic[];
	readonly family: SemanticDiagnosticFamily;
	readonly reason: string;
	readonly state: 'RUN' | 'FAILED';
}

declare const staticRawExtractionBudgetLedgerBrand: unique symbol;
export type StaticRawExtractionBudgetLedger = Readonly<{ [staticRawExtractionBudgetLedgerBrand]: true }>;

interface StaticRawExtractionBudgetState {
	astNodes: number;
	readonly budgetsDigest: string;
	diagnosticCharacters: number;
	diagnostics: number;
	sources: number;
}

const extractionBudgetStates = new WeakMap<object, StaticRawExtractionBudgetState>();

export function createStaticRawExtractionBudgetLedger(budgets: SemanticBudgets): StaticRawExtractionBudgetLedger {
	const ledger = Object.freeze(Object.create(null)) as StaticRawExtractionBudgetLedger;
	extractionBudgetStates.set(ledger, { astNodes: 0, budgetsDigest: canonicalSemanticJson(budgets), diagnosticCharacters: 0, diagnostics: 0, sources: 0 });
	return ledger;
}

export interface ExtractStaticRawInput {
	readonly assertWithinDeadline?: () => void;
	readonly budgetLedger?: StaticRawExtractionBudgetLedger;
	readonly budgets: SemanticBudgets;
	readonly checker: ts.TypeChecker;
	readonly deadlineMs: number;
	readonly diagnosticFamilies: readonly StaticRawDiagnosticFamilyInput[];
	readonly evidenceState?: RawCompilerSourceBinding['verificationState'];
	readonly program: ts.Program;
	readonly programRecipe: ProgramRecipe;
	readonly project: ProjectSubjectRecord;
	readonly projectKey: string;
	readonly resolveCompilerSource: (logicalPath: string) => RawCompilerSourceBinding | undefined;
	readonly toLogicalPath: (path: string) => string;
}

export type StaticRawExtractionErrorCode =
	| 'AST_PARENT_CONFLICT'
	| 'BUDGET_EXCEEDED'
	| 'DEADLINE_EXCEEDED'
	| 'DIAGNOSTIC_INVALID'
	| 'IDENTITY_MISMATCH'
	| 'INVALID_INPUT'
	| 'PATH_MAPPING_FAILED'
	| 'SOURCE_EVIDENCE_MISSING'
	| 'SOURCE_POLICY_MISMATCH'
	| 'UNSUPPORTED_SYNTAX';

export class StaticRawExtractionError extends Error {
	readonly phase = 'EXTRACT' as const;

	constructor(readonly code: StaticRawExtractionErrorCode, message: string, readonly path: string | null = null) {
		super(message);
		this.name = 'StaticRawExtractionError';
	}
}

function fail(code: StaticRawExtractionErrorCode, message: string, path: string | null = null): never {
	throw new StaticRawExtractionError(code, message, path);
}

function checkExtractionDeadline(input: Pick<ExtractStaticRawInput, 'assertWithinDeadline' | 'deadlineMs'>): void {
	try {
		input.assertWithinDeadline?.();
	} catch (error) {
		if (error instanceof StaticRawExtractionError) throw error;
		fail('DEADLINE_EXCEEDED', 'Extraction deadline check failed closed.');
	}
	if (!Number.isFinite(input.deadlineMs) || Date.now() > input.deadlineMs) fail('DEADLINE_EXCEEDED', 'Static semantic extraction exceeded its absolute deadline.');
}

class ExtractionGuard {
	private readonly state: StaticRawExtractionBudgetState;

	constructor(private readonly input: Pick<ExtractStaticRawInput, 'assertWithinDeadline' | 'budgetLedger' | 'budgets' | 'deadlineMs'>) {
		if (input.budgetLedger === undefined) {
			this.state = { astNodes: 0, budgetsDigest: canonicalSemanticJson(input.budgets), diagnosticCharacters: 0, diagnostics: 0, sources: 0 };
			return;
		}
		const state = extractionBudgetStates.get(input.budgetLedger);
		if (state === undefined || state.budgetsDigest !== canonicalSemanticJson(input.budgets)) fail('INVALID_INPUT', 'Static extraction budget ledger is not provider-issued for the exact budgets.');
		this.state = state;
	}

	check(): void {
		checkExtractionDeadline(this.input);
	}

	addAstNode(depth: number): void {
		this.check();
		if (!Number.isSafeInteger(depth) || depth < 0 || depth > this.input.budgets.maxAstDepth) fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxAstDepth.');
		if (this.state.astNodes >= this.input.budgets.maxAstNodes) fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxAstNodes.');
		this.state.astNodes += 1;
		this.check();
	}

	addDiagnostic(characters: number): void {
		this.check();
		if (!Number.isSafeInteger(characters) || characters < 1) fail('DIAGNOSTIC_INVALID', 'A diagnostic occurrence requires non-empty bounded message text.');
		if (this.state.diagnostics >= this.input.budgets.maxDiagnostics) fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxDiagnostics.');
		if (!Number.isSafeInteger(this.state.diagnosticCharacters + characters) || this.state.diagnosticCharacters + characters > this.input.budgets.maxDiagnosticCharacters) fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxDiagnosticCharacters.');
		this.state.diagnostics += 1;
		this.state.diagnosticCharacters += characters;
		this.check();
	}

	addSource(): void {
		this.check();
		if (this.state.sources >= this.input.budgets.maxSources) fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxSources.');
		this.state.sources += 1;
		this.check();
	}
}

function deepFreeze<T>(value: T, check: () => void = () => undefined): T {
	check();
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) {
			check();
			deepFreeze(child, check);
		}
		Object.freeze(value);
	}
	check();
	return value;
}

function compareStrings(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalSet(values: readonly string[]): readonly string[] {
	return [...new Set(values)].sort(compareStrings);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneRawValue(value: unknown, label: string, ancestors = new Set<object>()): RawSemanticValue {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) fail('INVALID_INPUT', `${label} contains a non-canonical number.`);
		return value;
	}
	if (typeof value !== 'object') fail('INVALID_INPUT', `${label} contains a non-data value.`);
	if (ancestors.has(value)) fail('INVALID_INPUT', `${label} contains a cycle.`);
	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			const result: RawSemanticValue[] = [];
			for (let index = 0; index < value.length; index += 1) {
				if (!Object.hasOwn(value, index)) fail('INVALID_INPUT', `${label} contains a sparse array.`);
				result.push(cloneRawValue(value[index], `${label}[${index}]`, ancestors));
			}
			return result;
		}
		const prototype = Object.getPrototypeOf(value) as object | null;
		if (prototype !== Object.prototype && prototype !== null) fail('INVALID_INPUT', `${label} must contain only plain data objects.`);
		const result: Record<string, RawSemanticValue> = {};
		for (const key of Object.keys(value).sort(compareStrings)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) fail('INVALID_INPUT', `${label}.${key} must be an enumerable data property.`);
			result[key] = cloneRawValue(descriptor.value, `${label}.${key}`, ancestors);
		}
		return result;
	} finally {
		ancestors.delete(value);
	}
}

function rawRecipe(recipe: ProgramRecipe): RawSemanticProgramRecipe {
	const compilerOptions: Record<string, RawSemanticValue> = {};
	for (const key of Object.keys(recipe.compilerOptions).sort(compareStrings)) compilerOptions[key] = cloneRawValue(recipe.compilerOptions[key], `ProgramRecipe.compilerOptions.${key}`);
	return {
		compilerOptions,
		configClosureDigest: recipe.configClosureDigest,
		configPath: recipe.configPath,
		kind: recipe.kind,
		projectReferences: [...recipe.projectReferences],
		projectResolutionDigest: recipe.projectResolutionDigest,
		provider: { ...recipe.provider },
		rootNames: [...recipe.rootNames]
	};
}

function checkedLogicalPath(input: ExtractStaticRawInput, path: string): string {
	checkExtractionDeadline(input);
	let logicalPath: string;
	try {
		logicalPath = input.toLogicalPath(path);
		assertCanonicalRelativePath(logicalPath);
	} catch (error) {
		fail('PATH_MAPPING_FAILED', error instanceof Error ? `Could not map compiler path to a canonical logical path: ${error.message}` : 'Could not map compiler path to a canonical logical path.');
	}
	if (logicalPath.length > input.budgets.maxPathCharacters) fail('BUDGET_EXCEEDED', 'A produced logical path exceeds maxPathCharacters.', logicalPath);
	checkExtractionDeadline(input);
	return logicalPath;
}

function checkedExistingLogicalPath(input: ExtractStaticRawInput, path: string): string {
	checkExtractionDeadline(input);
	try {
		assertCanonicalRelativePath(path);
	} catch (error) {
		fail('INVALID_INPUT', error instanceof Error ? error.message : 'Expected a canonical logical path.', path);
	}
	if (path.length > input.budgets.maxPathCharacters) fail('BUDGET_EXCEEDED', 'A project logical path exceeds maxPathCharacters.', path);
	checkExtractionDeadline(input);
	return path;
}

function syntaxKindName(kind: number): string {
	const name = typescriptSyntaxKindName(kind);
	if (name === null) fail('UNSUPPORTED_SYNTAX', `TypeScript exposed unrecognized public SyntaxKind ${kind}.`);
	return name;
}

function scriptKindFromLogicalPath(path: string): ts.ScriptKind {
	const lower = path.toLowerCase();
	if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX;
	if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
	if (lower.endsWith('.json')) return ts.ScriptKind.JSON;
	if (/\.(?:js|mjs|cjs)$/u.test(lower)) return ts.ScriptKind.JS;
	if (/\.(?:ts|mts|cts)$/u.test(lower)) return ts.ScriptKind.TS;
	return ts.ScriptKind.Unknown;
}

function diagnosticCategory(category: ts.DiagnosticCategory): 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE' {
	switch (category) {
		case ts.DiagnosticCategory.Warning: return 'WARNING';
		case ts.DiagnosticCategory.Error: return 'ERROR';
		case ts.DiagnosticCategory.Suggestion: return 'SUGGESTION';
		case ts.DiagnosticCategory.Message: return 'MESSAGE';
		default: return fail('DIAGNOSTIC_INVALID', `Unknown TypeScript diagnostic category ${String(category)}.`);
	}
}

interface AssignmentParts {
	readonly kind: RawSemanticAssignment['assignmentKind'];
	readonly operatorKind: number;
	readonly target: ts.Node;
	readonly value: ts.Node | null;
}

function initializerParts(node: ts.Node): AssignmentParts | null {
	switch (node.kind) {
		case ts.SyntaxKind.BindingElement: {
			const declaration = node as ts.BindingElement;
			return declaration.initializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		case ts.SyntaxKind.EnumMember: {
			const declaration = node as ts.EnumMember;
			return declaration.initializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		case ts.SyntaxKind.Parameter: {
			const declaration = node as ts.ParameterDeclaration;
			return declaration.initializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		case ts.SyntaxKind.PropertyAssignment: {
			const declaration = node as ts.PropertyAssignment;
			return { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		case ts.SyntaxKind.PropertyDeclaration: {
			const declaration = node as ts.PropertyDeclaration;
			return declaration.initializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		case ts.SyntaxKind.ShorthandPropertyAssignment: {
			const declaration = node as ts.ShorthandPropertyAssignment;
			return declaration.objectAssignmentInitializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.objectAssignmentInitializer };
		}
		case ts.SyntaxKind.VariableDeclaration: {
			const declaration = node as ts.VariableDeclaration;
			return declaration.initializer === undefined ? null : { kind: 'INITIALIZER', operatorKind: ts.SyntaxKind.EqualsToken, target: declaration.name, value: declaration.initializer };
		}
		default: return null;
	}
}

function assignmentParts(node: ts.Node): AssignmentParts | null {
	const initializer = initializerParts(node);
	if (initializer !== null) return initializer;
	if (ts.isBinaryExpression(node)) {
		const projected = semanticAssignmentKind({ hasAssignmentInitializer: false, kind: node.kind, operatorKind: node.operatorToken.kind });
		return projected === 'BINARY' ? { kind: projected, operatorKind: node.operatorToken.kind, target: node.left, value: node.right } : null;
	}
	if (ts.isPrefixUnaryExpression(node)) {
		const projected = semanticAssignmentKind({ hasAssignmentInitializer: false, kind: node.kind, operatorKind: node.operator });
		return projected === 'PREFIX_UPDATE' ? { kind: projected, operatorKind: node.operator, target: node.operand, value: null } : null;
	}
	if (ts.isPostfixUnaryExpression(node)) {
		const projected = semanticAssignmentKind({ hasAssignmentInitializer: false, kind: node.kind, operatorKind: node.operator });
		return projected === 'POSTFIX_UPDATE' ? { kind: projected, operatorKind: node.operator, target: node.operand, value: null } : null;
	}
	return null;
}

function declarationNameNode(node: ts.Node): ts.Node | undefined {
	if ('name' in node) {
		const name = (node as ts.Node & { readonly name?: unknown }).name;
		if (name !== undefined && name !== null && typeof name === 'object' && 'kind' in name) return name as ts.Node;
	}
	return undefined;
}

function invocationParts(node: ts.Node): { readonly arguments: readonly ts.Node[]; readonly callee: ts.Node; readonly template: ts.Node | null } | null {
	if (ts.isCallExpression(node)) return { arguments: [...node.arguments], callee: node.expression, template: null };
	if (ts.isNewExpression(node)) return { arguments: [...(node.arguments ?? [])], callee: node.expression, template: null };
	if (ts.isTaggedTemplateExpression(node)) return { arguments: [], callee: node.tag, template: node.template };
	return null;
}

function structuralRoles(parent: ts.Node, child: ts.Node): readonly SemanticAstStructuralRole[] {
	const roles = new Set<SemanticAstStructuralRole>([AST_STRUCTURAL_ROLES.genericChild]);
	if (semanticDeclarationCandidateRole(parent.kind) !== null && declarationNameNode(parent) === child) roles.add(AST_STRUCTURAL_ROLES.declarationName);
	const invocation = invocationParts(parent);
	if (invocation !== null) {
		if (invocation.callee === child) roles.add(AST_STRUCTURAL_ROLES.invocationCallee);
		else if (invocation.template === child) roles.add(AST_STRUCTURAL_ROLES.invocationTemplate);
		else if (invocation.arguments.includes(child)) roles.add(AST_STRUCTURAL_ROLES.invocationArgument);
	}
	const assignment = assignmentParts(parent);
	if (assignment !== null) {
		if (assignment.target === child) roles.add(AST_STRUCTURAL_ROLES.assignmentTarget);
		else if (assignment.value === child) roles.add(AST_STRUCTURAL_ROLES.assignmentValue);
	}
	return [...roles].sort(compareStrings);
}

interface ChildDiscovery {
	readonly child: ts.Node;
	readonly discoveryOrdinal: number;
	readonly sourceClass: 0 | 1;
}

function childSpan(node: ts.Node, sourceFile: ts.SourceFile): readonly [number, number, number] {
	return [node.getFullStart(), node.getStart(sourceFile, false), node.getEnd()];
}

function retainedChildren(parent: ts.Node, sourceFile: ts.SourceFile, guard: ExtractionGuard): readonly ChildDiscovery[] {
	guard.check();
	const discovered: ChildDiscovery[] = [];
	let discoveryOrdinal = 0;
	ts.forEachChild(parent, (child) => {
		guard.check();
		discovered.push({ child, discoveryOrdinal, sourceClass: 0 });
		discoveryOrdinal += 1;
		guard.check();
	});
	for (const jsDoc of ts.getJSDocCommentsAndTags(parent).filter(ts.isJSDoc)) {
		guard.check();
		// The public helper can surface an ancestor's inherited JSDoc for a
		// descendant query. Retain a JSDoc root only beneath its public owner.
		if (jsDoc.parent !== parent) continue;
		if (!discovered.some((entry) => entry.child === jsDoc)) {
			discovered.push({ child: jsDoc, discoveryOrdinal, sourceClass: 1 });
			discoveryOrdinal += 1;
		}
		guard.check();
	}
	discovered.sort((left, right) => {
		const leftSpan = childSpan(left.child, sourceFile);
		const rightSpan = childSpan(right.child, sourceFile);
		return leftSpan[0] - rightSpan[0] || leftSpan[1] - rightSpan[1] || leftSpan[2] - rightSpan[2]
			|| left.child.kind - right.child.kind || left.sourceClass - right.sourceClass || left.discoveryOrdinal - right.discoveryOrdinal;
	});
	guard.check();
	return discovered;
}

function nodeOperator(node: ts.Node): number | null {
	if (ts.isBinaryExpression(node)) return node.operatorToken.kind;
	if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) return node.operator;
	return null;
}

function syntacticIdentifierText(node: ts.Node): string | null {
	if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
	return null;
}

interface SourceSyntaxProjection {
	readonly assignments: readonly RawSemanticAssignment[];
	readonly declarationCandidates: readonly RawSemanticDeclarationCandidate[];
	readonly invocations: readonly RawSemanticInvocation[];
	readonly literals: readonly RawSemanticLiteral[];
	readonly nodes: readonly RawSemanticAstNode[];
}

function projectSourceSyntax(sourceFile: ts.SourceFile, sourceOrdinal: number, guard: ExtractionGuard, maxLiteralCharacters: number): SourceSyntaxProjection {
	const nodes: RawSemanticAstNode[] = [];
	const originalNodes: ts.Node[] = [];
	const ordinalByNode = new WeakMap<ts.Node, number>();
	const parentByNode = new WeakMap<ts.Node, ts.Node | null>();
	parentByNode.set(sourceFile, null);

	interface PendingNode {
		readonly depth: number;
		readonly node: ts.Node;
		readonly parent: ts.Node | null;
		readonly parentNodeOrdinal: number | null;
		readonly siblingOrdinal: number;
		readonly structuralRoles: readonly SemanticAstStructuralRole[];
	}

	const pending: PendingNode[] = [{ depth: 0, node: sourceFile, parent: null, parentNodeOrdinal: null, siblingOrdinal: 0, structuralRoles: [AST_STRUCTURAL_ROLES.sourceFile] }];
	while (pending.length > 0) {
		guard.check();
		const current = pending.pop()!;
		if (ordinalByNode.has(current.node)) fail('AST_PARENT_CONFLICT', 'The AST traversal encountered the same TypeScript node more than once.');
		const registeredParent = parentByNode.get(current.node);
		if (registeredParent !== current.parent) fail('AST_PARENT_CONFLICT', 'A TypeScript AST node acquired two retained parents.');
		guard.addAstNode(current.depth);
		const [fullStart, start, end] = childSpan(current.node, sourceFile);
		if (![fullStart, start, end].every(Number.isSafeInteger) || fullStart < 0 || fullStart > start || start > end || end > sourceFile.text.length) fail('UNSUPPORTED_SYNTAX', 'TypeScript produced an invalid public AST span.');
		const operatorKind = nodeOperator(current.node);
		const operatorName = operatorKind === null ? null : syntaxKindName(operatorKind);
		const ordinal = nodes.length;
		ordinalByNode.set(current.node, ordinal);
		originalNodes.push(current.node);
		nodes.push({
			end,
			fullStart,
			hasAssignmentInitializer: initializerParts(current.node) !== null,
			kind: current.node.kind,
			kindName: syntaxKindName(current.node.kind),
			nodeOrdinal: ordinal,
			operatorKind,
			operatorName,
			parentNodeOrdinal: current.parentNodeOrdinal,
			publicFlags: current.node.flags & PUBLIC_NODE_FLAG_MASK,
			siblingOrdinal: current.siblingOrdinal,
			sourceOrdinal,
			start,
			structuralRoles: current.structuralRoles,
			syntacticIdentifierText: syntacticIdentifierText(current.node)
		});
		guard.check();

		const children = retainedChildren(current.node, sourceFile, guard);
		for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
			guard.check();
			const child = children[childIndex]!.child;
			const knownParent = parentByNode.get(child);
			if (knownParent !== undefined && knownParent !== current.node) fail('AST_PARENT_CONFLICT', 'A TypeScript AST node acquired two retained parents.');
			if (knownParent === current.node) fail('AST_PARENT_CONFLICT', 'A TypeScript AST node was duplicated under one retained parent.');
			parentByNode.set(child, current.node);
			pending.push({
				depth: current.depth + 1,
				node: child,
				parent: current.node,
				parentNodeOrdinal: ordinal,
				siblingOrdinal: childIndex,
				structuralRoles: structuralRoles(current.node, child)
			});
			guard.check();
		}
	}

	const childrenByParent = new Map<number, RawSemanticAstNode[]>();
	for (const node of nodes) {
		guard.check();
		if (node.parentNodeOrdinal !== null) {
			const children = childrenByParent.get(node.parentNodeOrdinal) ?? [];
			children.push(node);
			childrenByParent.set(node.parentNodeOrdinal, children);
		}
		guard.check();
	}

	const declarations: RawSemanticDeclarationCandidate[] = [];
	const literals: RawSemanticLiteral[] = [];
	const invocations: RawSemanticInvocation[] = [];
	const assignments: RawSemanticAssignment[] = [];
	const conditionalNameKinds = new Set<number>([ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ClassExpression, ts.SyntaxKind.ImportClause]);

	function ordinal(node: ts.Node, label: string): number {
		const value = ordinalByNode.get(node);
		if (value === undefined) fail('AST_PARENT_CONFLICT', `${label} is not retained by the named AST traversal profile.`);
		return value;
	}

	function directModifiers(nodeOrdinal: number): readonly { readonly code: number; readonly name: string }[] {
		const byKey = new Map<string, { readonly code: number; readonly name: string }>();
		for (const child of childrenByParent.get(nodeOrdinal) ?? []) {
			guard.check();
			if (isTypeScriptModifierKind(child.kind)) byKey.set(`${child.kind}:${child.kindName}`, { code: child.kind, name: child.kindName });
		}
		return [...byKey.values()].sort((left, right) => compareStrings(`${left.code}:${left.name}`, `${right.code}:${right.name}`));
	}

	function hasDeclareCarrier(nodeOrdinal: number): boolean {
		const seen = new Set<number>();
		let cursor: number | null = nodeOrdinal;
		while (cursor !== null) {
			guard.check();
			if (seen.has(cursor)) fail('AST_PARENT_CONFLICT', 'AST parent relation contains a cycle.');
			seen.add(cursor);
			if ((childrenByParent.get(cursor) ?? []).some((child) => child.kind === ts.SyntaxKind.DeclareKeyword)) return true;
			cursor = nodes[cursor]!.parentNodeOrdinal;
		}
		return false;
	}

	function variableStatementCarrier(nodeOrdinal: number): number | null {
		let declarationOrdinal = nodeOrdinal;
		if (nodes[nodeOrdinal]!.kind === ts.SyntaxKind.BindingElement) {
			let cursor = nodes[nodeOrdinal]!.parentNodeOrdinal;
			while (cursor !== null && [ts.SyntaxKind.ArrayBindingPattern, ts.SyntaxKind.BindingElement, ts.SyntaxKind.ObjectBindingPattern].includes(nodes[cursor]!.kind)) cursor = nodes[cursor]!.parentNodeOrdinal;
			if (cursor === null || nodes[cursor]!.kind !== ts.SyntaxKind.VariableDeclaration) return null;
			declarationOrdinal = cursor;
		} else if (nodes[nodeOrdinal]!.kind !== ts.SyntaxKind.VariableDeclaration) return null;
		const listOrdinal = nodes[declarationOrdinal]!.parentNodeOrdinal;
		if (listOrdinal === null || nodes[listOrdinal]!.kind !== ts.SyntaxKind.VariableDeclarationList) return null;
		const statementOrdinal = nodes[listOrdinal]!.parentNodeOrdinal;
		return statementOrdinal !== null && nodes[statementOrdinal]!.kind === ts.SyntaxKind.VariableStatement ? statementOrdinal : null;
	}

	for (let nodeOrdinal = 0; nodeOrdinal < nodes.length; nodeOrdinal += 1) {
		guard.check();
		const rawNode = nodes[nodeOrdinal]!;
		const node = originalNodes[nodeOrdinal]!;
		const candidateRole = semanticDeclarationCandidateRole(node.kind);
		if (candidateRole !== null) {
			const name = declarationNameNode(node);
			if (!(conditionalNameKinds.has(node.kind) && name === undefined)) {
				const nameNodeOrdinal = name === undefined ? null : ordinal(name, 'Declaration name');
				const nameState = name === undefined ? 'ANONYMOUS' : semanticDeclarationNameState(name.kind, syntacticIdentifierText(name));
				if (nameState === null) fail('UNSUPPORTED_SYNTAX', `Declaration candidate ${rawNode.kindName} has an unsupported name form.`);
				let syntacticName: string | null = null;
				if (nameState === 'ATOMIC') {
					if (ts.isIdentifier(name!) || ts.isPrivateIdentifier(name!)) syntacticName = name!.text;
					else syntacticName = sourceFile.text.slice(nodes[nameNodeOrdinal!]!.start, nodes[nameNodeOrdinal!]!.end);
					if (syntacticName.length === 0) fail('UNSUPPORTED_SYNTAX', 'An atomic declaration name cannot be empty.');
					if (!isUnicodeScalarString(syntacticName)) fail('UNSUPPORTED_SYNTAX', 'An atomic declaration name contains an unrepresentable lone UTF-16 surrogate.');
				}
				const localModifiers = directModifiers(nodeOrdinal);
				const modifierNames = new Set(localModifiers.map((modifier) => modifier.name));
				const variableCarrier = variableStatementCarrier(nodeOrdinal);
				const carrierModifierNames = new Set(variableCarrier === null ? [] : directModifiers(variableCarrier).map((modifier) => modifier.name));
				let exportSyntax: RawSemanticDeclarationCandidate['exportSyntax'] = 'NONE';
				let exportCarrierNodeOrdinal: number | null = null;
				if (node.kind === ts.SyntaxKind.ExportSpecifier) {
					exportSyntax = 'EXPORT_SPECIFIER'; exportCarrierNodeOrdinal = nodeOrdinal;
				} else if (node.kind === ts.SyntaxKind.ExportAssignment) {
					exportSyntax = 'EXPORT_ASSIGNMENT'; exportCarrierNodeOrdinal = nodeOrdinal;
				} else if (node.kind === ts.SyntaxKind.NamespaceExport || node.kind === ts.SyntaxKind.NamespaceExportDeclaration) {
					exportSyntax = 'NAMESPACE_EXPORT'; exportCarrierNodeOrdinal = nodeOrdinal;
				} else if (modifierNames.has('DefaultKeyword')) {
					exportSyntax = 'DEFAULT'; exportCarrierNodeOrdinal = nodeOrdinal;
				} else if (modifierNames.has('ExportKeyword')) {
					exportSyntax = 'EXPLICIT'; exportCarrierNodeOrdinal = nodeOrdinal;
				} else if (variableCarrier !== null && carrierModifierNames.has('DefaultKeyword')) {
					exportSyntax = 'DEFAULT'; exportCarrierNodeOrdinal = variableCarrier;
				} else if (variableCarrier !== null && carrierModifierNames.has('ExportKeyword')) {
					exportSyntax = 'EXPLICIT'; exportCarrierNodeOrdinal = variableCarrier;
				}
				declarations.push({
					ambientSyntax: sourceFile.isDeclarationFile || hasDeclareCarrier(nodeOrdinal),
					candidateRole,
					exportCarrierNodeOrdinal,
					exportSyntax,
					localModifiers,
					nameNodeOrdinal,
					nameState,
					nodeOrdinal,
					sourceOrdinal,
					syntacticName,
					syntaxKind: rawNode.kind,
					syntaxKindName: rawNode.kindName
				});
				guard.check();
			}
		}

		const literalDescriptor = semanticLiteralDescriptor(node.kind);
		if (literalDescriptor !== null) {
			const lexeme = sourceFile.text.slice(rawNode.start, rawNode.end);
			let cooked: string | boolean | null;
			if (node.kind === ts.SyntaxKind.TrueKeyword) cooked = true;
			else if (node.kind === ts.SyntaxKind.FalseKeyword) cooked = false;
			else if (node.kind === ts.SyntaxKind.NullKeyword) cooked = null;
			else if ('text' in node && typeof (node as ts.Node & { readonly text?: unknown }).text === 'string') cooked = (node as ts.Node & { readonly text: string }).text;
			else fail('UNSUPPORTED_SYNTAX', `Literal node ${rawNode.kindName} has no public cooked text.`);
			const valueLength = literalValueLength(cooked);
			const nonScalar = typeof cooked === 'string' && !isUnicodeScalarString(cooked);
			const valueEncoding = nonScalar ? 'UTF16_CODE_UNITS_LE' as const : literalDescriptor.valueEncoding;
			const exact = !nonScalar && (typeof cooked !== 'string' || valueLength <= maxLiteralCharacters);
			literals.push({
				lexemeLength: lexeme.length,
				lexemeSha256: literalLexemeDigest(lexeme),
				nodeOrdinal,
				sourceOrdinal,
				value: exact ? cooked : null,
				valueEncoding,
				valueLength,
				valueSha256: literalValueDigest(valueEncoding, literalDescriptor.valueType, cooked),
				valueState: exact ? 'EXACT' : 'DIGEST_ONLY',
				valueType: literalDescriptor.valueType
			});
			guard.check();
		}

		const invocationKind = semanticInvocationKind(node.kind);
		if (invocationKind !== null) {
			const parts = invocationParts(node);
			if (parts === null) fail('UNSUPPORTED_SYNTAX', 'Invocation taxonomy and public node shape disagree.');
			invocations.push({
				argumentNodeOrdinals: parts.arguments.map((argument) => ordinal(argument, 'Invocation argument')),
				calleeNodeOrdinal: ordinal(parts.callee, 'Invocation callee'),
				invocationKind,
				nodeOrdinal,
				optional: invocationKind === 'CALL' && (node.flags & ts.NodeFlags.OptionalChain) !== 0,
				sourceOrdinal,
				templateNodeOrdinal: parts.template === null ? null : ordinal(parts.template, 'Invocation template')
			});
			guard.check();
		}

		const assignment = assignmentParts(node);
		if (assignment !== null) {
			assignments.push({
				assignmentKind: assignment.kind,
				nodeOrdinal,
				operatorKind: assignment.operatorKind,
				operatorName: syntaxKindName(assignment.operatorKind),
				sourceOrdinal,
				targetNodeOrdinal: ordinal(assignment.target, 'Assignment target'),
				valueNodeOrdinal: assignment.value === null ? null : ordinal(assignment.value, 'Assignment value')
			});
			guard.check();
		}
	}

	return { assignments, declarationCandidates: declarations, invocations, literals, nodes };
}

function messageCharacterCount(message: RawSemanticDiagnosticMessage): number {
	let total = 0;
	const pending = [message];
	while (pending.length > 0) {
		const current = pending.pop()!;
		if (!Number.isSafeInteger(total + current.textLength)) fail('DIAGNOSTIC_INVALID', 'Diagnostic character count overflowed.');
		total += current.textLength;
		for (let index = current.next.length - 1; index >= 0; index -= 1) pending.push(current.next[index]!);
	}
	return total;
}

function diagnosticMessage(messageText: string | ts.DiagnosticMessageChain, guard: ExtractionGuard): RawSemanticDiagnosticMessage {
	guard.check();
	if (typeof messageText === 'string') {
		if (messageText.length === 0) fail('DIAGNOSTIC_INVALID', 'TypeScript returned an empty diagnostic message.');
		return { category: null, code: null, next: [], ...encodeSemanticDiagnosticText(messageText) };
	}
	if (messageText.messageText.length === 0 || !Number.isSafeInteger(messageText.code) || messageText.code < 1) fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic message chain.');
	const next: RawSemanticDiagnosticMessage[] = [];
	for (const child of messageText.next ?? []) {
		guard.check();
		next.push(diagnosticMessage(child, guard));
		guard.check();
	}
	return { category: diagnosticCategory(messageText.category), code: messageText.code, next, ...encodeSemanticDiagnosticText(messageText.messageText) };
}

function diagnosticSpan(start: number | undefined, length: number | undefined, maxLength?: number): { readonly end: number | null; readonly start: number | null } {
	if (start === undefined && length === undefined) return { end: null, start: null };
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start! < 0 || length! < 0 || !Number.isSafeInteger(start! + length!)) fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic span.');
	const end = start! + length!;
	if (maxLength !== undefined && end > maxLength) fail('DIAGNOSTIC_INVALID', 'TypeScript returned a diagnostic span outside its source.');
	return { end, start: start! };
}

function projectDiagnostics(
	input: ExtractStaticRawInput,
	familyInputs: readonly StaticRawDiagnosticFamilyInput[],
	sources: readonly RawSemanticSource[],
	guard: ExtractionGuard
): { readonly diagnostics: readonly RawSemanticDiagnosticOccurrence[]; readonly families: readonly RawSemanticDiagnosticFamilyCoverage[] } {
	const sourceByPath = new Map(sources.map((source) => [source.logicalPath, source] as const));
	interface PendingDiagnostic extends Omit<RawSemanticDiagnosticOccurrence, 'occurrenceOrdinal'> { readonly discoveryOrdinal: number }
	const pending: PendingDiagnostic[] = [];
	let discoveryOrdinal = 0;

	function relatedDiagnostic(related: ts.DiagnosticRelatedInformation): RawSemanticRelatedDiagnostic {
		guard.check();
		if (!Number.isSafeInteger(related.code) || related.code < 1) fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid related diagnostic code.');
		const path = related.file === undefined ? null : checkedLogicalPath(input, related.file.fileName);
		const source = path === null ? undefined : sourceByPath.get(path);
		const span = diagnosticSpan(related.start, related.length, source?.textLength);
		return {
			category: diagnosticCategory(related.category),
			code: `TS${related.code}`,
			...span,
			message: diagnosticMessage(related.messageText, guard),
			path,
		};
	}

	for (const familyInput of familyInputs) {
		guard.check();
		if (familyInput.state === 'FAILED' && familyInput.diagnostics.length > 0) fail('INVALID_INPUT', `Failed diagnostic family ${familyInput.family} cannot retain diagnostics.`);
		for (const diagnostic of familyInput.diagnostics) {
			guard.check();
			if (!Number.isSafeInteger(diagnostic.code) || diagnostic.code < 1) fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic code.');
			const path = diagnostic.file === undefined ? null : checkedLogicalPath(input, diagnostic.file.fileName);
			const source = path === null ? undefined : sourceByPath.get(path);
			const span = diagnosticSpan(diagnostic.start, diagnostic.length, source?.textLength);
			const message = diagnosticMessage(diagnostic.messageText, guard);
			const related = (diagnostic.relatedInformation ?? []).map(relatedDiagnostic).sort((left, right) => compareStrings(canonicalSemanticJson(left), canonicalSemanticJson(right)));
			const characters = messageCharacterCount(message) + related.reduce((total, item) => total + messageCharacterCount(item.message), 0);
			guard.addDiagnostic(characters);
			pending.push({
				category: diagnosticCategory(diagnostic.category),
				code: `TS${diagnostic.code}`,
				discoveryOrdinal,
				...span,
				family: familyInput.family,
				locationKind: path === null ? 'NONE' : source === undefined ? 'PATH' : 'SOURCE',
				message,
				path,
				related,
				sourceOrdinal: source?.sourceOrdinal ?? null
			});
			discoveryOrdinal += 1;
			guard.check();
		}
	}

	pending.sort((left, right) => {
		const { discoveryOrdinal: _leftOrdinal, ...leftPayload } = left;
		const { discoveryOrdinal: _rightOrdinal, ...rightPayload } = right;
		return compareStrings(canonicalSemanticJson(leftPayload), canonicalSemanticJson(rightPayload)) || left.discoveryOrdinal - right.discoveryOrdinal;
	});
	const diagnostics: RawSemanticDiagnosticOccurrence[] = pending.map(({ discoveryOrdinal: _discoveryOrdinal, ...diagnostic }, occurrenceOrdinal) => ({ ...diagnostic, occurrenceOrdinal }));
	const families = familyInputs.map((familyInput): RawSemanticDiagnosticFamilyCoverage => ({
		coverage: familyInput.state === 'RUN' ? 'COMPLETE' : 'BOUNDED',
		diagnosticOccurrenceOrdinals: diagnostics.filter((diagnostic) => diagnostic.family === familyInput.family).map((diagnostic) => diagnostic.occurrenceOrdinal),
		family: familyInput.family,
		reason: familyInput.reason,
		state: familyInput.state
	}));
	guard.check();
	return { diagnostics, families };
}

function validateFamilyInputs(inputs: readonly StaticRawDiagnosticFamilyInput[]): void {
	if (inputs.length !== RAW_DIAGNOSTIC_FAMILIES.length || !inputs.every((input, index) => input.family === RAW_DIAGNOSTIC_FAMILIES[index])) fail('INVALID_INPUT', 'Static extraction requires all six diagnostic families in registered order.');
	for (const input of inputs) if (input.reason.length === 0) fail('INVALID_INPUT', `Diagnostic family ${input.family} requires a non-empty reason.`);
}

function partialityReasons(
	project: ProjectSubjectRecord,
	sources: readonly RawSemanticSource[],
	diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[]
): readonly RawSemanticPartialityReason[] {
	const reasons: RawSemanticPartialityReason[] = [];
	const projectEvidencePartial = project.rootDisposition === 'INCOMPLETE'
		|| project.typescriptDiagnostics.some((entry) => entry.severity === 'ERROR' || entry.code === 'TYPESCRIPT_PROJECT_PARTIAL');
	if (projectEvidencePartial) reasons.push({ capability: 'TS_PROJECT', code: 'TYPESCRIPT_PROJECT_PARTIAL', message: `Frozen project ${project.configPath} has incomplete roots or project-configuration diagnostics.`, path: project.configPath });
	if (project.frameworkCandidates.length > 0) reasons.push({ capability: 'TS_SYNTAX', code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED', message: 'Framework candidates are retained but not syntax-indexed by Slice 3A.', path: project.configPath });
	for (const family of diagnosticFamilies) if (family.state === 'FAILED' || family.coverage === 'BOUNDED') {
		reasons.push({ capability: 'TS_PROJECT', code: 'COMPILER_CONTEXT_UNAVAILABLE', message: `${family.family} diagnostic coverage is bounded: ${family.reason}`, path: project.configPath });
	}
	for (const source of sources) {
		if (source.origin !== 'UNKNOWN' && (source.mapping.state === 'EXACT' || source.mapping.state === 'NOT_APPLICABLE')) continue;
		reasons.push({ capability: 'TS_PROJECT', code: 'COMPILER_CONTEXT_UNAVAILABLE', message: source.mapping.reason, path: source.logicalPath });
	}
	return [...new Map(reasons.map((reason) => [`${reason.capability}\0${reason.code}\0${reason.path ?? ''}\0${reason.message}`, reason])).entries()]
		.sort(([left], [right]) => compareStrings(left, right)).map(([, reason]) => reason);
}

function projectRecord(
	project: ProjectSubjectRecord,
	recipe: RawSemanticProgramRecipe,
	sources: readonly RawSemanticSource[],
	diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[]
): RawSemanticProject {
	return {
		configPath: project.configPath,
		frameworkCandidates: canonicalSet(project.frameworkCandidates),
		kind: project.kind,
		partialityReasons: partialityReasons(project, sources, diagnosticFamilies),
		programRecipe: recipe,
		projectReferences: canonicalSet(project.projectReferences),
		rootDisposition: project.rootDisposition,
		rootNames: canonicalSet(recipe.rootNames)
	};
}

function extractStaticRawActive(input: ExtractStaticRawInput): RawStaticSemanticProjectExtraction {
	const guard = new ExtractionGuard(input);
	guard.check();
	if (ts.version !== TYPESCRIPT_PROVIDER_VERSION) fail('IDENTITY_MISMATCH', `Static extraction requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}, received ${ts.version}.`);
	if (input.budgets.maxProjects < 1) fail('BUDGET_EXCEEDED', 'Static extraction cannot emit one project within maxProjects.');
	if (input.checker === null || typeof input.checker !== 'object' || typeof input.checker.getTypeAtLocation !== 'function' || typeof input.checker.getSymbolAtLocation !== 'function') fail('INVALID_INPUT', 'Static extraction requires the TypeChecker created for the exact Program.');
	if (!Number.isSafeInteger(input.deadlineMs)) fail('INVALID_INPUT', 'Static extraction requires a safe absolute deadline.');
	validateFamilyInputs(input.diagnosticFamilies);

	try {
		validateProgramRecipePolicy(input.programRecipe, input.budgets.maxPathCharacters);
		guard.check();
		validateProgramRecipePolicy(input.project.programRecipe, input.budgets.maxPathCharacters);
		guard.check();
	} catch (error) {
		const message = error instanceof Error ? `ProgramRecipe policy validation failed: ${error.message}` : 'ProgramRecipe policy validation failed.';
		fail(error instanceof Error && /budget|exceed/iu.test(error.message) ? 'BUDGET_EXCEEDED' : 'INVALID_INPUT', message);
	}
	const authoritativeRecipe = rawRecipe(input.programRecipe);
	const projectRecipe = rawRecipe(input.project.programRecipe);
	if (canonicalSemanticJson(authoritativeRecipe) !== canonicalSemanticJson(projectRecipe)
		|| input.projectKey !== input.project.configPath || input.project.configPath !== input.programRecipe.configPath
		|| input.project.kind !== input.programRecipe.kind
		|| !sameStrings(canonicalSet(input.project.projectReferences), input.programRecipe.projectReferences)) fail('IDENTITY_MISMATCH', 'Project key, configuration path, project record, and ProgramRecipe do not bind the same project.');
	for (const path of [input.projectKey, input.project.configPath, ...input.programRecipe.rootNames, ...input.programRecipe.projectReferences, ...input.project.frameworkCandidates]) checkedExistingLogicalPath(input, path);

	const recipeRoots = canonicalSet(input.programRecipe.rootNames);
	const programRoots = canonicalSet(input.program.getRootFileNames().map((path) => checkedLogicalPath(input, path)));
	if (!sameStrings(recipeRoots, programRoots)) fail('IDENTITY_MISMATCH', 'Program roots do not reproduce the authoritative ProgramRecipe.');

	const programSourceFiles = input.program.getSourceFiles().map((sourceFile) => ({ logicalPath: checkedLogicalPath(input, sourceFile.fileName), sourceFile }))
		.sort((left, right) => compareStrings(left.logicalPath, right.logicalPath));
	if (new Set(programSourceFiles.map((entry) => entry.logicalPath)).size !== programSourceFiles.length) fail('PATH_MAPPING_FAILED', 'Two Program sources map to the same logical path.');

	const sources: RawSemanticSource[] = [];
	const deepSources: { readonly sourceFile: ts.SourceFile; readonly sourceOrdinal: number }[] = [];
	for (const entry of programSourceFiles) {
		guard.addSource();
		let evidence: RawCompilerSourceBinding | undefined;
		try {
			evidence = input.resolveCompilerSource(entry.logicalPath);
		} catch {
			fail('SOURCE_EVIDENCE_MISSING', 'Compiler source-evidence resolution failed closed.', entry.logicalPath);
		}
		const requiredEvidenceState = input.evidenceState ?? 'VERIFIED_COMPILER_INPUT';
		if (evidence === undefined || evidence.verificationState !== requiredEvidenceState || evidence.logicalPath !== entry.logicalPath) fail('SOURCE_EVIDENCE_MISSING', requiredEvidenceState === 'VERIFIED_COMPILER_INPUT'
			? 'Program source has no exact finalized and rechecked compiler-input evidence.'
			: 'Capture projection source has no exact captured compiler-input evidence.', entry.logicalPath);
		if (!Number.isSafeInteger(evidence.bytes) || evidence.bytes < 0 || !/^[a-f0-9]{64}$/u.test(evidence.contentSha256) || evidence.mapping.reason.length === 0) fail('SOURCE_EVIDENCE_MISSING', 'Verified source evidence has invalid bounded metadata.', entry.logicalPath);
		const rootFile = recipeRoots.includes(entry.logicalPath);
		let analysisDisposition: RawSemanticSource['analysisDisposition'];
		let artifactClass: RawSemanticSource['artifactClass'];
		let artifactRoles: readonly RawSemanticSource['artifactRoles'][number][];
		if (evidence.byteBudgetClass === 'FROZEN_SUBJECT') {
			if (evidence.artifact === null || evidence.artifact.disposition !== 'ANALYZED' || !evidence.artifact.roles.includes('COMPILER_CANDIDATE')) fail('SOURCE_POLICY_MISMATCH', 'Frozen Program source is not an analyzed compiler candidate.', entry.logicalPath);
			analysisDisposition = 'DEEP_INDEXED';
			artifactClass = evidence.artifact.primaryClass;
			artifactRoles = canonicalSet(evidence.artifact.roles) as readonly RawSemanticSource['artifactRoles'][number][];
		} else {
			if (evidence.artifact !== null) fail('SOURCE_POLICY_MISMATCH', 'Live compiler context cannot claim a frozen artifact classification.', entry.logicalPath);
			if (rootFile) fail('SOURCE_POLICY_MISMATCH', 'A compiler root cannot be represented as live context-only input.', entry.logicalPath);
			analysisDisposition = 'CONTEXT_ONLY';
			artifactClass = 'CONTEXT_ONLY';
			artifactRoles = [];
		}
		const scriptKind = scriptKindFromLogicalPath(entry.logicalPath);
		const scriptKindName = ts.ScriptKind[scriptKind];
		if (typeof scriptKindName !== 'string') fail('UNSUPPORTED_SYNTAX', `Program source has unknown ScriptKind ${String(scriptKind)}.`, entry.logicalPath);
		const sourceOrdinal = sources.length;
		sources.push({
			analysisDisposition,
			artifactClass,
			artifactRoles,
			bytes: evidence.bytes,
			contentSha256: evidence.contentSha256,
			declarationFile: entry.sourceFile.isDeclarationFile,
			languageVariant: scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX ? 'JSX' : 'Standard',
			logicalPath: entry.logicalPath,
			mapping: { ...evidence.mapping },
			origin: evidence.origin,
			rootFile: analysisDisposition === 'DEEP_INDEXED' && rootFile,
			rootNodeOrdinal: analysisDisposition === 'DEEP_INDEXED' ? 0 : null,
			scriptKind,
			scriptKindName,
			sourceOrdinal,
			textLength: entry.sourceFile.text.length
		});
		if (analysisDisposition === 'DEEP_INDEXED') deepSources.push({ sourceFile: entry.sourceFile, sourceOrdinal });
		guard.check();
	}

	const astNodes: RawSemanticAstNode[] = [];
	const declarationCandidates: RawSemanticDeclarationCandidate[] = [];
	const literals: RawSemanticLiteral[] = [];
	const invocations: RawSemanticInvocation[] = [];
	const assignments: RawSemanticAssignment[] = [];
	for (const deepSource of deepSources) {
		guard.check();
		const projection = projectSourceSyntax(deepSource.sourceFile, deepSource.sourceOrdinal, guard, input.budgets.maxLiteralCharacters);
		astNodes.push(...projection.nodes);
		declarationCandidates.push(...projection.declarationCandidates);
		literals.push(...projection.literals);
		invocations.push(...projection.invocations);
		assignments.push(...projection.assignments);
		guard.check();
	}

	const diagnosticProjection = projectDiagnostics(input, input.diagnosticFamilies, sources, guard);
	guard.check();
	const result: RawStaticSemanticProjectExtraction = {
		assignments,
		astNodes,
		declarationCandidates,
		diagnosticFamilies: diagnosticProjection.families,
		diagnostics: diagnosticProjection.diagnostics,
		evidenceState: input.evidenceState ?? 'VERIFIED_COMPILER_INPUT',
		invocations,
		literals,
		project: projectRecord(input.project, authoritativeRecipe, sources, diagnosticProjection.families),
		sources
	};
	const frozen = deepFreeze(result, () => guard.check());
	guard.check();
	return frozen;
}

/** Extract one exact Program into an identity-free, replay-comparable raw model. */
export function extractStaticRaw(input: ExtractStaticRawInput): RawStaticSemanticProjectExtraction {
	try {
		return extractStaticRawActive(input);
	} catch (error) {
		if (error instanceof StaticRawExtractionError) throw error;
		throw new StaticRawExtractionError('INVALID_INPUT', 'TypeScript raw extraction failed closed.');
	}
}
