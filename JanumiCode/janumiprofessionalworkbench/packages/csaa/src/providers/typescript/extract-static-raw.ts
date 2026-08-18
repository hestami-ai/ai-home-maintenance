import ts from 'typescript';
import type { ProgramRecipe, ProjectSubjectRecord } from '../../contracts/subject.js';
import {
	TYPESCRIPT_PROVIDER_VERSION,
	type SemanticAssignabilityRequest,
	type SemanticAstStructuralRole,
	type SemanticBudgets,
	type SemanticDiagnosticFamily
} from '../../contracts/semantic.js';
import { sha256 } from '../../inventory/canonical.js';
import {
	canonicalSemanticJson,
	encodeSemanticDiagnosticText,
	isUnicodeScalarString
} from '../../semantic/canonical.js';
import { validateProgramRecipePolicy } from '../../semantic/program-recipe-policy.js';
import type { SemanticOperationClock } from '../../semantic/operation-budget-ledger.js';
import type { StaticSemanticOperationBudgetProviderBinding } from '../../semantic/operation-budget-provider-binding.js';
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
import { extractTypeScriptSymbols } from './extract-symbols.js';

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
export type StaticRawExtractionBudgetLedger = Readonly<{
	[staticRawExtractionBudgetLedgerBrand]: true;
}>;

export type StaticRawExtractionBudgetPhase = 'CAPTURE' | 'EXTRACT';

declare const staticRawExtractionBudgetEvidenceBrand: unique symbol;
export type StaticRawExtractionBudgetEvidence = Readonly<{
	[staticRawExtractionBudgetEvidenceBrand]: true;
}>;

export interface StaticRawExtractionProjectBudgetEvidence {
	readonly astNodes: number;
	readonly compilerFacts: number;
	readonly compilerQueries: readonly {
		readonly invocationCount: number;
		readonly queryKey: string;
	}[];
	readonly diagnosticCharacters: number;
	readonly diagnostics: number;
	readonly projectKey: string;
	readonly scopes: number;
	readonly sourceMembers: readonly string[];
}

export interface StaticRawExtractionBudgetEvidenceView {
	readonly budgetsDigest: string;
	readonly phase: StaticRawExtractionBudgetPhase;
	readonly projects: readonly StaticRawExtractionProjectBudgetEvidence[];
}

interface StaticRawExtractionProjectBudgetState {
	astNodes: number;
	compilerFacts: number;
	readonly compilerQueries: Map<string, number>;
	completed: boolean;
	diagnosticCharacters: number;
	diagnostics: number;
	readonly projectKey: string;
	scopes: number;
	readonly sourceMembers: Set<string>;
}

interface StaticRawExtractionBudgetState {
	astNodes: number;
	readonly budgetsDigest: string;
	compilerFacts: number;
	readonly compilerQueryKeys: Set<string>;
	compilerQueryInvocations: number;
	diagnosticCharacters: number;
	diagnostics: number;
	finalized: boolean;
	readonly phase: StaticRawExtractionBudgetPhase;
	poisoned: boolean;
	readonly providerBinding: StaticSemanticOperationBudgetProviderBinding | null;
	readonly projects: Map<string, StaticRawExtractionProjectBudgetState>;
	scopes: number;
	sources: number;
}

const extractionBudgetStates = new WeakMap<object, StaticRawExtractionBudgetState>();
interface StaticRawExtractionBudgetEvidenceState {
	readonly binding: StaticSemanticOperationBudgetProviderBinding;
	consumed: boolean;
	readonly view: StaticRawExtractionBudgetEvidenceView;
}

const extractionBudgetEvidenceStates = new WeakMap<
	object,
	StaticRawExtractionBudgetEvidenceState
>();

export function createStaticRawExtractionBudgetLedger(
	budgets: SemanticBudgets,
	phase: StaticRawExtractionBudgetPhase,
	providerBinding: StaticSemanticOperationBudgetProviderBinding
): StaticRawExtractionBudgetLedger {
	if (phase !== 'CAPTURE' && phase !== 'EXTRACT')
		fail('INVALID_INPUT', 'Static extraction budget ledger requires a supported fixed phase.');
	if (providerBinding === null || typeof providerBinding !== 'object')
		fail('INVALID_INPUT', 'Static extraction budget ledger requires an opaque operation binding.');
	const ledger = Object.freeze(Object.create(null)) as StaticRawExtractionBudgetLedger;
	extractionBudgetStates.set(ledger, {
		astNodes: 0,
		budgetsDigest: sha256(canonicalSemanticJson(budgets)),
		compilerFacts: 0,
		compilerQueryInvocations: 0,
		compilerQueryKeys: new Set(),
		diagnosticCharacters: 0,
		diagnostics: 0,
		finalized: false,
		phase,
		poisoned: false,
		providerBinding,
		projects: new Map(),
		scopes: 0,
		sources: 0
	});
	return ledger;
}

function cloneExtractionBudgetEvidenceView(
	view: StaticRawExtractionBudgetEvidenceView
): StaticRawExtractionBudgetEvidenceView {
	return Object.freeze({
		budgetsDigest: view.budgetsDigest,
		phase: view.phase,
		projects: Object.freeze(
			view.projects.map((project) =>
				Object.freeze({
					...project,
					compilerQueries: Object.freeze(
						project.compilerQueries.map((query) => Object.freeze({ ...query }))
					),
					sourceMembers: Object.freeze([...project.sourceMembers])
				})
			)
		)
	});
}

export function finalizeStaticRawExtractionBudgetLedger(
	ledger: StaticRawExtractionBudgetLedger
): StaticRawExtractionBudgetEvidence {
	const state =
		ledger !== null && typeof ledger === 'object' ? extractionBudgetStates.get(ledger) : undefined;
	if (state === undefined)
		fail(
			'INVALID_INPUT',
			'Static extraction budget evidence requires the exact provider-issued ledger.'
		);
	if (state.poisoned) fail('INVALID_INPUT', 'Static extraction budget ledger is poisoned.');
	if (state.finalized)
		fail('INVALID_INPUT', 'Static extraction budget ledger is already finalized.');
	if (state.providerBinding === null)
		fail('INVALID_INPUT', 'Static extraction budget ledger lacks an operation binding.');
	if ([...state.projects.values()].some((project) => !project.completed)) {
		state.poisoned = true;
		fail('INVALID_INPUT', 'Static extraction budget ledger has an incomplete project extraction.');
	}
	const view: StaticRawExtractionBudgetEvidenceView = Object.freeze({
		budgetsDigest: state.budgetsDigest,
		phase: state.phase,
		projects: Object.freeze(
			[...state.projects.values()]
				.sort((left, right) => compareStrings(left.projectKey, right.projectKey))
				.map((project) =>
					Object.freeze({
						astNodes: project.astNodes,
						compilerFacts: project.compilerFacts,
						compilerQueries: Object.freeze(
							[...project.compilerQueries.entries()]
								.sort(([left], [right]) => compareStrings(left, right))
								.map(([queryKey, invocationCount]) => Object.freeze({ invocationCount, queryKey }))
						),
						diagnosticCharacters: project.diagnosticCharacters,
						diagnostics: project.diagnostics,
						projectKey: project.projectKey,
						scopes: project.scopes,
						sourceMembers: Object.freeze([...project.sourceMembers].sort(compareStrings))
					})
				)
		)
	});
	state.finalized = true;
	const evidence = Object.freeze(Object.create(null)) as StaticRawExtractionBudgetEvidence;
	extractionBudgetEvidenceStates.set(evidence, {
		binding: state.providerBinding,
		consumed: false,
		view
	});
	return evidence;
}

/** @internal Consumed only by the fixed semantic operation budget session. */
export function takeStaticRawExtractionBudgetEvidence(
	evidence: StaticRawExtractionBudgetEvidence,
	providerBinding: StaticSemanticOperationBudgetProviderBinding,
	expectedPhase: StaticRawExtractionBudgetPhase,
	expectedBudgetsDigest: string
): StaticRawExtractionBudgetEvidenceView {
	const state =
		evidence !== null && typeof evidence === 'object'
			? extractionBudgetEvidenceStates.get(evidence)
			: undefined;
	if (state === undefined)
		fail('INVALID_INPUT', 'Static extraction budget evidence is not provider-issued.');
	if (
		state.binding !== providerBinding ||
		state.view.phase !== expectedPhase ||
		state.view.budgetsDigest !== expectedBudgetsDigest
	)
		fail(
			'INVALID_INPUT',
			'Static extraction budget evidence does not bind the exact session, phase, and budgets.'
		);
	if (state.consumed) fail('INVALID_INPUT', 'Static extraction budget evidence is single-use.');
	state.consumed = true;
	return cloneExtractionBudgetEvidenceView(state.view);
}

export interface ExtractStaticRawInput {
	readonly assignabilityRequests?: readonly SemanticAssignabilityRequest[];
	readonly assertWithinDeadline?: () => void;
	readonly budgetLedger?: StaticRawExtractionBudgetLedger;
	readonly budgets: SemanticBudgets;
	readonly checker: ts.TypeChecker;
	readonly clock?: SemanticOperationClock;
	readonly deadlineMs: number;
	readonly diagnosticFamilies: readonly StaticRawDiagnosticFamilyInput[];
	readonly evidenceState?: RawCompilerSourceBinding['verificationState'];
	readonly includeTypes?: boolean;
	readonly program: ts.Program;
	readonly programRecipe: ProgramRecipe;
	readonly project: ProjectSubjectRecord;
	readonly projectKey: string;
	readonly resolveCheckerContextDigest: () => string;
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

	constructor(
		readonly code: StaticRawExtractionErrorCode,
		message: string,
		readonly path: string | null = null
	) {
		super(message);
		this.name = 'StaticRawExtractionError';
	}
}

function fail(
	code: StaticRawExtractionErrorCode,
	message: string,
	path: string | null = null
): never {
	throw new StaticRawExtractionError(code, message, path);
}

function deadlineFailureDetail(error: unknown): string {
	return error instanceof Error &&
		isUnicodeScalarString(error.message) &&
		error.message.length <= 1_000
		? `: ${error.message}`
		: '';
}

function runDeadlineAssertion(
	input: Pick<ExtractStaticRawInput, 'assertWithinDeadline' | 'deadlineMs'>
): void {
	if (input.assertWithinDeadline === undefined) return;
	try {
		input.assertWithinDeadline();
	} catch (error) {
		if (error instanceof StaticRawExtractionError) throw error;
		fail(
			'DEADLINE_EXCEEDED',
			`Extraction deadline check failed closed${deadlineFailureDetail(error)}.`
		);
	}
	if (!Number.isFinite(input.deadlineMs))
		fail('DEADLINE_EXCEEDED', 'Static semantic extraction deadline is invalid.');
}

function readDeadlineClock(input: Pick<ExtractStaticRawInput, 'clock'>): unknown {
	let now: unknown;
	try {
		now = (input.clock ?? Date.now)();
	} catch (error) {
		fail(
			'DEADLINE_EXCEEDED',
			`Extraction deadline clock failed closed${deadlineFailureDetail(error)}.`
		);
	}
	return now;
}

function checkExtractionDeadline(
	input: Pick<ExtractStaticRawInput, 'assertWithinDeadline' | 'clock' | 'deadlineMs'>
): void {
	runDeadlineAssertion(input);
	const now = readDeadlineClock(input);
	if (!Number.isFinite(input.deadlineMs) || !Number.isSafeInteger(now) || (now as number) < 0)
		fail('DEADLINE_EXCEEDED', 'Static semantic extraction deadline clock is invalid.');
	if ((now as number) > input.deadlineMs)
		fail('DEADLINE_EXCEEDED', 'Static semantic extraction exceeded its absolute deadline.');
}

class ExtractionGuard {
	private readonly state: StaticRawExtractionBudgetState;
	private readonly project: StaticRawExtractionProjectBudgetState;

	constructor(
		private readonly input: Pick<
			ExtractStaticRawInput,
			'assertWithinDeadline' | 'budgetLedger' | 'budgets' | 'clock' | 'deadlineMs' | 'projectKey'
		>
	) {
		if (input.budgetLedger === undefined) {
			this.state = {
				astNodes: 0,
				budgetsDigest: sha256(canonicalSemanticJson(input.budgets)),
				compilerFacts: 0,
				compilerQueryInvocations: 0,
				compilerQueryKeys: new Set(),
				diagnosticCharacters: 0,
				diagnostics: 0,
				finalized: false,
				phase: 'EXTRACT',
				poisoned: false,
				providerBinding: null,
				projects: new Map(),
				scopes: 0,
				sources: 0
			};
		} else {
			const state = extractionBudgetStates.get(input.budgetLedger);
			// S6582 REFUSED, and this one is unsafe for the SIDE EFFECT, not the comparison: the right
			// operand can THROW. `canonicalSemanticJson` refuses non-finite numbers, so on the
			// unregistered-ledger path the optional chain evaluates a digest the original never computed
			// and a forged ledger surfaces a raw TypeError instead of this module's INVALID_INPUT refusal.
			if (
				state === undefined ||
				state.budgetsDigest !== sha256(canonicalSemanticJson(input.budgets))
			)
				fail(
					'INVALID_INPUT',
					'Static extraction budget ledger is not provider-issued for the exact budgets.'
				);
			this.state = state;
		}
		if (this.state.poisoned) fail('INVALID_INPUT', 'Static extraction budget ledger is poisoned.');
		if (this.state.finalized)
			fail('INVALID_INPUT', 'Static extraction budget ledger is finalized.');
		if (this.state.projects.has(input.projectKey)) {
			this.state.poisoned = true;
			fail(
				'INVALID_INPUT',
				`Static extraction budget ledger already contains project ${input.projectKey}.`
			);
		}
		this.project = {
			astNodes: 0,
			compilerFacts: 0,
			compilerQueries: new Map(),
			completed: false,
			diagnosticCharacters: 0,
			diagnostics: 0,
			projectKey: input.projectKey,
			scopes: 0,
			sourceMembers: new Set()
		};
		this.state.projects.set(input.projectKey, this.project);
	}

	check(): void {
		if (this.state.poisoned) fail('INVALID_INPUT', 'Static extraction budget ledger is poisoned.');
		if (this.state.finalized)
			fail('INVALID_INPUT', 'Static extraction budget ledger is finalized.');
		checkExtractionDeadline(this.input);
	}

	addAstNode(depth: number): void {
		this.check();
		if (!Number.isSafeInteger(depth) || depth < 0 || depth > this.input.budgets.maxAstDepth)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxAstDepth.');
		if (this.state.astNodes >= this.input.budgets.maxAstNodes)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxAstNodes.');
		this.state.astNodes += 1;
		this.project.astNodes += 1;
		this.check();
	}

	addDiagnostic(characters: number): void {
		this.check();
		if (!Number.isSafeInteger(characters) || characters < 1)
			fail(
				'DIAGNOSTIC_INVALID',
				'A diagnostic occurrence requires non-empty bounded message text.'
			);
		if (this.state.diagnostics >= this.input.budgets.maxDiagnostics)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxDiagnostics.');
		if (
			!Number.isSafeInteger(this.state.diagnosticCharacters + characters) ||
			this.state.diagnosticCharacters + characters > this.input.budgets.maxDiagnosticCharacters
		)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxDiagnosticCharacters.');
		this.state.diagnostics += 1;
		this.state.diagnosticCharacters += characters;
		this.project.diagnostics += 1;
		this.project.diagnosticCharacters += characters;
		this.check();
	}

	addCompilerFact(): void {
		this.check();
		if (this.state.compilerFacts >= this.input.budgets.maxCompilerFacts)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxCompilerFacts.');
		this.state.compilerFacts += 1;
		this.project.compilerFacts += 1;
		this.check();
	}

	compilerQuery<T>(key: string, action: () => T): T {
		this.check();
		if (key.length === 0)
			fail('INVALID_INPUT', 'A compiler query requires a stable non-empty discriminator.');
		if (this.state.compilerQueryInvocations >= this.input.budgets.maxCompilerQueryInvocations)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxCompilerQueryInvocations.');
		this.state.compilerQueryInvocations += 1;
		const operationKey = canonicalSemanticJson({
			projectKey: this.project.projectKey,
			queryKey: key
		});
		if (!this.state.compilerQueryKeys.has(operationKey)) {
			if (this.state.compilerQueryKeys.size >= this.input.budgets.maxCompilerQueries)
				fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxCompilerQueries.');
			this.state.compilerQueryKeys.add(operationKey);
		}
		this.project.compilerQueries.set(key, (this.project.compilerQueries.get(key) ?? 0) + 1);
		const result = action();
		this.check();
		return result;
	}

	addSource(logicalPath: string): void {
		this.check();
		const member = canonicalSemanticJson({ logicalPath, projectKey: this.project.projectKey });
		if (this.project.sourceMembers.has(member))
			fail('INVALID_INPUT', `Static semantic extraction repeated source ${logicalPath}.`);
		if (this.state.sources >= this.input.budgets.maxSources)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxSources.');
		this.state.sources += 1;
		this.project.sourceMembers.add(member);
		this.check();
	}

	addScope(): void {
		this.check();
		if (this.state.scopes >= this.input.budgets.maxScopes)
			fail('BUDGET_EXCEEDED', 'Static semantic extraction exceeded maxScopes.');
		this.state.scopes += 1;
		this.project.scopes += 1;
		this.check();
	}

	complete(): void {
		this.check();
		if (this.project.completed) {
			this.state.poisoned = true;
			fail(
				'INVALID_INPUT',
				`Static semantic extraction completed project twice: ${this.project.projectKey}.`
			);
		}
		this.project.completed = true;
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
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function canonicalSet(values: readonly string[]): readonly string[] {
	return [...new Set(values)].sort(compareStrings);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneRawNumber(value: number, label: string): RawSemanticValue {
	if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
		fail('INVALID_INPUT', `${label} contains a non-canonical number.`);
	return value;
}

function cloneRawArray(
	value: readonly unknown[],
	label: string,
	ancestors: Set<object>
): RawSemanticValue {
	const result: RawSemanticValue[] = [];
	for (let index = 0; index < value.length; index += 1) {
		if (!Object.hasOwn(value, index)) fail('INVALID_INPUT', `${label} contains a sparse array.`);
		result.push(cloneRawValue(value[index], `${label}[${index}]`, ancestors));
	}
	return result;
}

function cloneRawObject(value: object, label: string, ancestors: Set<object>): RawSemanticValue {
	const prototype = Object.getPrototypeOf(value) as object | null;
	if (prototype !== Object.prototype && prototype !== null)
		fail('INVALID_INPUT', `${label} must contain only plain data objects.`);
	const result: Record<string, RawSemanticValue> = {};
	for (const key of Object.keys(value).sort(compareStrings)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('INVALID_INPUT', `${label}.${key} must be an enumerable data property.`);
		result[key] = cloneRawValue(descriptor.value, `${label}.${key}`, ancestors);
	}
	return result;
}

function cloneRawValue(
	value: unknown,
	label: string,
	ancestors = new Set<object>()
): RawSemanticValue {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return cloneRawNumber(value, label);
	if (typeof value !== 'object') fail('INVALID_INPUT', `${label} contains a non-data value.`);
	if (ancestors.has(value)) fail('INVALID_INPUT', `${label} contains a cycle.`);
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return cloneRawArray(value, label, ancestors);
		return cloneRawObject(value, label, ancestors);
	} finally {
		ancestors.delete(value);
	}
}

function rawRecipe(recipe: ProgramRecipe): RawSemanticProgramRecipe {
	const compilerOptions: Record<string, RawSemanticValue> = {};
	for (const key of Object.keys(recipe.compilerOptions).sort(compareStrings))
		compilerOptions[key] = cloneRawValue(
			recipe.compilerOptions[key],
			`ProgramRecipe.compilerOptions.${key}`
		);
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
		fail(
			'PATH_MAPPING_FAILED',
			error instanceof Error
				? `Could not map compiler path to a canonical logical path: ${error.message}`
				: 'Could not map compiler path to a canonical logical path.'
		);
	}
	if (logicalPath.length > input.budgets.maxPathCharacters)
		fail('BUDGET_EXCEEDED', 'A produced logical path exceeds maxPathCharacters.', logicalPath);
	checkExtractionDeadline(input);
	return logicalPath;
}

function checkedExistingLogicalPath(input: ExtractStaticRawInput, path: string): string {
	checkExtractionDeadline(input);
	try {
		assertCanonicalRelativePath(path);
	} catch (error) {
		fail(
			'INVALID_INPUT',
			error instanceof Error ? error.message : 'Expected a canonical logical path.',
			path
		);
	}
	if (path.length > input.budgets.maxPathCharacters)
		fail('BUDGET_EXCEEDED', 'A project logical path exceeds maxPathCharacters.', path);
	checkExtractionDeadline(input);
	return path;
}

function syntaxKindName(kind: number): string {
	const name = typescriptSyntaxKindName(kind);
	if (name === null)
		fail('UNSUPPORTED_SYNTAX', `TypeScript exposed unrecognized public SyntaxKind ${kind}.`);
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

function diagnosticCategory(
	category: ts.DiagnosticCategory
): 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE' {
	switch (category) {
		case ts.DiagnosticCategory.Warning:
			return 'WARNING';
		case ts.DiagnosticCategory.Error:
			return 'ERROR';
		case ts.DiagnosticCategory.Suggestion:
			return 'SUGGESTION';
		case ts.DiagnosticCategory.Message:
			return 'MESSAGE';
		default:
			return fail(
				'DIAGNOSTIC_INVALID',
				`Unknown TypeScript diagnostic category ${String(category)}.`
			);
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
			return declaration.initializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.initializer
					};
		}
		case ts.SyntaxKind.EnumMember: {
			const declaration = node as ts.EnumMember;
			return declaration.initializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.initializer
					};
		}
		case ts.SyntaxKind.Parameter: {
			const declaration = node as ts.ParameterDeclaration;
			return declaration.initializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.initializer
					};
		}
		case ts.SyntaxKind.PropertyAssignment: {
			const declaration = node as ts.PropertyAssignment;
			return {
				kind: 'INITIALIZER',
				operatorKind: ts.SyntaxKind.EqualsToken,
				target: declaration.name,
				value: declaration.initializer
			};
		}
		case ts.SyntaxKind.PropertyDeclaration: {
			const declaration = node as ts.PropertyDeclaration;
			return declaration.initializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.initializer
					};
		}
		case ts.SyntaxKind.ShorthandPropertyAssignment: {
			const declaration = node as ts.ShorthandPropertyAssignment;
			return declaration.objectAssignmentInitializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.objectAssignmentInitializer
					};
		}
		case ts.SyntaxKind.VariableDeclaration: {
			const declaration = node as ts.VariableDeclaration;
			return declaration.initializer === undefined
				? null
				: {
						kind: 'INITIALIZER',
						operatorKind: ts.SyntaxKind.EqualsToken,
						target: declaration.name,
						value: declaration.initializer
					};
		}
		default:
			return null;
	}
}

function assignmentParts(node: ts.Node): AssignmentParts | null {
	const initializer = initializerParts(node);
	if (initializer !== null) return initializer;
	if (ts.isBinaryExpression(node)) {
		const projected = semanticAssignmentKind({
			hasAssignmentInitializer: false,
			kind: node.kind,
			operatorKind: node.operatorToken.kind
		});
		return projected === 'BINARY'
			? {
					kind: projected,
					operatorKind: node.operatorToken.kind,
					target: node.left,
					value: node.right
				}
			: null;
	}
	if (ts.isPrefixUnaryExpression(node)) {
		const projected = semanticAssignmentKind({
			hasAssignmentInitializer: false,
			kind: node.kind,
			operatorKind: node.operator
		});
		return projected === 'PREFIX_UPDATE'
			? { kind: projected, operatorKind: node.operator, target: node.operand, value: null }
			: null;
	}
	if (ts.isPostfixUnaryExpression(node)) {
		const projected = semanticAssignmentKind({
			hasAssignmentInitializer: false,
			kind: node.kind,
			operatorKind: node.operator
		});
		return projected === 'POSTFIX_UPDATE'
			? { kind: projected, operatorKind: node.operator, target: node.operand, value: null }
			: null;
	}
	return null;
}

function declarationNameNode(node: ts.Node): ts.Node | undefined {
	if ('name' in node) {
		const name = (node as ts.Node & { readonly name?: unknown }).name;
		if (name !== undefined && name !== null && typeof name === 'object' && 'kind' in name)
			return name as ts.Node;
	}
	return undefined;
}

function invocationParts(node: ts.Node): {
	readonly arguments: readonly ts.Node[];
	readonly callee: ts.Node;
	readonly template: ts.Node | null;
} | null {
	if (ts.isCallExpression(node))
		return { arguments: [...node.arguments], callee: node.expression, template: null };
	if (ts.isNewExpression(node))
		return { arguments: [...(node.arguments ?? [])], callee: node.expression, template: null };
	if (ts.isTaggedTemplateExpression(node))
		return { arguments: [], callee: node.tag, template: node.template };
	return null;
}

function structuralRoles(parent: ts.Node, child: ts.Node): readonly SemanticAstStructuralRole[] {
	const roles = new Set<SemanticAstStructuralRole>([AST_STRUCTURAL_ROLES.genericChild]);
	if (
		semanticDeclarationCandidateRole(parent.kind) !== null &&
		declarationNameNode(parent) === child
	)
		roles.add(AST_STRUCTURAL_ROLES.declarationName);
	const invocation = invocationParts(parent);
	if (invocation !== null) {
		if (invocation.callee === child) roles.add(AST_STRUCTURAL_ROLES.invocationCallee);
		else if (invocation.template === child) roles.add(AST_STRUCTURAL_ROLES.invocationTemplate);
		else if (invocation.arguments.includes(child))
			roles.add(AST_STRUCTURAL_ROLES.invocationArgument);
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

function retainedChildren(
	parent: ts.Node,
	sourceFile: ts.SourceFile,
	guard: ExtractionGuard
): readonly ChildDiscovery[] {
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
		return (
			leftSpan[0] - rightSpan[0] ||
			leftSpan[1] - rightSpan[1] ||
			leftSpan[2] - rightSpan[2] ||
			left.child.kind - right.child.kind ||
			left.sourceClass - right.sourceClass ||
			left.discoveryOrdinal - right.discoveryOrdinal
		);
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
	/** Transient compiler objects; consumed by checker extraction and never serialized. */
	readonly transientNodes: readonly ts.Node[];
}

interface PendingSyntaxNode {
	readonly depth: number;
	readonly node: ts.Node;
	readonly parent: ts.Node | null;
	readonly parentNodeOrdinal: number | null;
	readonly siblingOrdinal: number;
	readonly structuralRoles: readonly SemanticAstStructuralRole[];
}

interface SourceSyntaxState {
	readonly assignments: RawSemanticAssignment[];
	readonly childrenByParent: Map<number, RawSemanticAstNode[]>;
	readonly declarations: RawSemanticDeclarationCandidate[];
	readonly guard: ExtractionGuard;
	readonly invocations: RawSemanticInvocation[];
	readonly literals: RawSemanticLiteral[];
	readonly maxLiteralCharacters: number;
	readonly nodes: RawSemanticAstNode[];
	readonly ordinalByNode: WeakMap<ts.Node, number>;
	readonly originalNodes: ts.Node[];
	readonly sourceFile: ts.SourceFile;
	readonly sourceOrdinal: number;
}

interface DeclarationExportBinding {
	readonly exportCarrierNodeOrdinal: number | null;
	readonly exportSyntax: RawSemanticDeclarationCandidate['exportSyntax'];
}

const CONDITIONAL_NAME_KINDS = new Set<number>([
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.ClassExpression,
	ts.SyntaxKind.ImportClause
]);

function retainAstNode(
	state: SourceSyntaxState,
	current: PendingSyntaxNode,
	parentByNode: WeakMap<ts.Node, ts.Node | null>
): number {
	if (state.ordinalByNode.has(current.node))
		fail(
			'AST_PARENT_CONFLICT',
			'The AST traversal encountered the same TypeScript node more than once.'
		);
	const registeredParent = parentByNode.get(current.node);
	if (registeredParent !== current.parent)
		fail('AST_PARENT_CONFLICT', 'A TypeScript AST node acquired two retained parents.');
	state.guard.addAstNode(current.depth);
	const [fullStart, start, end] = childSpan(current.node, state.sourceFile);
	if (
		![fullStart, start, end].every(Number.isSafeInteger) ||
		fullStart < 0 ||
		fullStart > start ||
		start > end ||
		end > state.sourceFile.text.length
	)
		fail('UNSUPPORTED_SYNTAX', 'TypeScript produced an invalid public AST span.');
	const operatorKind = nodeOperator(current.node);
	const operatorName = operatorKind === null ? null : syntaxKindName(operatorKind);
	const nodeOrdinal = state.nodes.length;
	state.ordinalByNode.set(current.node, nodeOrdinal);
	state.originalNodes.push(current.node);
	state.nodes.push({
		end,
		fullStart,
		hasAssignmentInitializer: initializerParts(current.node) !== null,
		kind: current.node.kind,
		kindName: syntaxKindName(current.node.kind),
		nodeOrdinal,
		operatorKind,
		operatorName,
		parentNodeOrdinal: current.parentNodeOrdinal,
		publicFlags: current.node.flags & PUBLIC_NODE_FLAG_MASK,
		siblingOrdinal: current.siblingOrdinal,
		sourceOrdinal: state.sourceOrdinal,
		start,
		structuralRoles: current.structuralRoles,
		syntacticIdentifierText: syntacticIdentifierText(current.node)
	});
	state.guard.check();
	return nodeOrdinal;
}

function pushRetainedChildren(
	state: SourceSyntaxState,
	current: PendingSyntaxNode,
	nodeOrdinal: number,
	parentByNode: WeakMap<ts.Node, ts.Node | null>,
	pending: PendingSyntaxNode[]
): void {
	const children = retainedChildren(current.node, state.sourceFile, state.guard);
	for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
		state.guard.check();
		const child = children[childIndex]!.child;
		const knownParent = parentByNode.get(child);
		if (knownParent !== undefined && knownParent !== current.node)
			fail('AST_PARENT_CONFLICT', 'A TypeScript AST node acquired two retained parents.');
		if (knownParent === current.node)
			fail(
				'AST_PARENT_CONFLICT',
				'A TypeScript AST node was duplicated under one retained parent.'
			);
		parentByNode.set(child, current.node);
		pending.push({
			depth: current.depth + 1,
			node: child,
			parent: current.node,
			parentNodeOrdinal: nodeOrdinal,
			siblingOrdinal: childIndex,
			structuralRoles: structuralRoles(current.node, child)
		});
		state.guard.check();
	}
}

function traverseSourceSyntax(state: SourceSyntaxState): void {
	const parentByNode = new WeakMap<ts.Node, ts.Node | null>();
	parentByNode.set(state.sourceFile, null);
	const pending: PendingSyntaxNode[] = [
		{
			depth: 0,
			node: state.sourceFile,
			parent: null,
			parentNodeOrdinal: null,
			siblingOrdinal: 0,
			structuralRoles: [AST_STRUCTURAL_ROLES.sourceFile]
		}
	];
	while (pending.length > 0) {
		state.guard.check();
		const current = pending.pop()!;
		const nodeOrdinal = retainAstNode(state, current, parentByNode);
		pushRetainedChildren(state, current, nodeOrdinal, parentByNode, pending);
	}
}

function indexChildrenByParent(state: SourceSyntaxState): void {
	for (const node of state.nodes) {
		state.guard.check();
		if (node.parentNodeOrdinal !== null) {
			const children = state.childrenByParent.get(node.parentNodeOrdinal) ?? [];
			children.push(node);
			state.childrenByParent.set(node.parentNodeOrdinal, children);
		}
		state.guard.check();
	}
}

function retainedOrdinal(state: SourceSyntaxState, node: ts.Node, label: string): number {
	const value = state.ordinalByNode.get(node);
	if (value === undefined)
		fail('AST_PARENT_CONFLICT', `${label} is not retained by the named AST traversal profile.`);
	return value;
}

function directModifiers(
	state: SourceSyntaxState,
	nodeOrdinal: number
): readonly { readonly code: number; readonly name: string }[] {
	const byKey = new Map<string, { readonly code: number; readonly name: string }>();
	for (const child of state.childrenByParent.get(nodeOrdinal) ?? []) {
		state.guard.check();
		if (isTypeScriptModifierKind(child.kind))
			byKey.set(`${child.kind}:${child.kindName}`, { code: child.kind, name: child.kindName });
	}
	return [...byKey.values()].sort((left, right) =>
		compareStrings(`${left.code}:${left.name}`, `${right.code}:${right.name}`)
	);
}

function hasDeclareCarrier(state: SourceSyntaxState, nodeOrdinal: number): boolean {
	const seen = new Set<number>();
	let cursor: number | null = nodeOrdinal;
	while (cursor !== null) {
		state.guard.check();
		if (seen.has(cursor)) fail('AST_PARENT_CONFLICT', 'AST parent relation contains a cycle.');
		seen.add(cursor);
		if (
			(state.childrenByParent.get(cursor) ?? []).some(
				(child) => child.kind === ts.SyntaxKind.DeclareKeyword
			)
		)
			return true;
		cursor = state.nodes[cursor]!.parentNodeOrdinal;
	}
	return false;
}

function variableStatementCarrier(state: SourceSyntaxState, nodeOrdinal: number): number | null {
	const nodes = state.nodes;
	let declarationOrdinal = nodeOrdinal;
	if (nodes[nodeOrdinal]!.kind === ts.SyntaxKind.BindingElement) {
		let cursor = nodes[nodeOrdinal]!.parentNodeOrdinal;
		while (
			cursor !== null &&
			[
				ts.SyntaxKind.ArrayBindingPattern,
				ts.SyntaxKind.BindingElement,
				ts.SyntaxKind.ObjectBindingPattern
			].includes(nodes[cursor]!.kind)
		)
			cursor = nodes[cursor]!.parentNodeOrdinal;
		if (cursor === null || nodes[cursor]!.kind !== ts.SyntaxKind.VariableDeclaration) return null;
		declarationOrdinal = cursor;
	} else if (nodes[nodeOrdinal]!.kind !== ts.SyntaxKind.VariableDeclaration) return null;
	const listOrdinal = nodes[declarationOrdinal]!.parentNodeOrdinal;
	if (listOrdinal === null || nodes[listOrdinal]!.kind !== ts.SyntaxKind.VariableDeclarationList)
		return null;
	const statementOrdinal = nodes[listOrdinal]!.parentNodeOrdinal;
	return statementOrdinal !== null &&
		nodes[statementOrdinal]!.kind === ts.SyntaxKind.VariableStatement
		? statementOrdinal
		: null;
}

function atomicDeclarationName(
	state: SourceSyntaxState,
	name: ts.Node,
	nameNodeOrdinal: number
): string {
	const syntacticName =
		ts.isIdentifier(name) || ts.isPrivateIdentifier(name)
			? name.text
			: state.sourceFile.text.slice(
					state.nodes[nameNodeOrdinal]!.start,
					state.nodes[nameNodeOrdinal]!.end
				);
	if (syntacticName.length === 0)
		fail('UNSUPPORTED_SYNTAX', 'An atomic declaration name cannot be empty.');
	if (!isUnicodeScalarString(syntacticName))
		fail(
			'UNSUPPORTED_SYNTAX',
			'An atomic declaration name contains an unrepresentable lone UTF-16 surrogate.'
		);
	return syntacticName;
}

function declarationExportSyntax(
	node: ts.Node,
	nodeOrdinal: number,
	modifierNames: ReadonlySet<string>,
	variableCarrier: number | null,
	carrierModifierNames: ReadonlySet<string>
): DeclarationExportBinding {
	if (node.kind === ts.SyntaxKind.ExportSpecifier)
		return { exportCarrierNodeOrdinal: nodeOrdinal, exportSyntax: 'EXPORT_SPECIFIER' };
	if (node.kind === ts.SyntaxKind.ExportAssignment)
		return { exportCarrierNodeOrdinal: nodeOrdinal, exportSyntax: 'EXPORT_ASSIGNMENT' };
	if (
		node.kind === ts.SyntaxKind.NamespaceExport ||
		node.kind === ts.SyntaxKind.NamespaceExportDeclaration
	)
		return { exportCarrierNodeOrdinal: nodeOrdinal, exportSyntax: 'NAMESPACE_EXPORT' };
	if (modifierNames.has('DefaultKeyword'))
		return { exportCarrierNodeOrdinal: nodeOrdinal, exportSyntax: 'DEFAULT' };
	if (modifierNames.has('ExportKeyword'))
		return { exportCarrierNodeOrdinal: nodeOrdinal, exportSyntax: 'EXPLICIT' };
	if (variableCarrier !== null && carrierModifierNames.has('DefaultKeyword'))
		return { exportCarrierNodeOrdinal: variableCarrier, exportSyntax: 'DEFAULT' };
	if (variableCarrier !== null && carrierModifierNames.has('ExportKeyword'))
		return { exportCarrierNodeOrdinal: variableCarrier, exportSyntax: 'EXPLICIT' };
	return { exportCarrierNodeOrdinal: null, exportSyntax: 'NONE' };
}

function projectDeclarationCandidate(
	state: SourceSyntaxState,
	nodeOrdinal: number,
	node: ts.Node,
	rawNode: RawSemanticAstNode
): void {
	const candidateRole = semanticDeclarationCandidateRole(node.kind);
	if (candidateRole === null) return;
	const name = declarationNameNode(node);
	if (CONDITIONAL_NAME_KINDS.has(node.kind) && name === undefined) return;
	const nameNodeOrdinal =
		name === undefined ? null : retainedOrdinal(state, name, 'Declaration name');
	const nameState =
		name === undefined
			? 'ANONYMOUS'
			: semanticDeclarationNameState(name.kind, syntacticIdentifierText(name));
	if (nameState === null)
		fail(
			'UNSUPPORTED_SYNTAX',
			`Declaration candidate ${rawNode.kindName} has an unsupported name form.`
		);
	const syntacticName =
		nameState === 'ATOMIC' ? atomicDeclarationName(state, name!, nameNodeOrdinal!) : null;
	const localModifiers = directModifiers(state, nodeOrdinal);
	const modifierNames = new Set(localModifiers.map((modifier) => modifier.name));
	const variableCarrier = variableStatementCarrier(state, nodeOrdinal);
	const carrierModifierNames = new Set(
		variableCarrier === null
			? []
			: directModifiers(state, variableCarrier).map((modifier) => modifier.name)
	);
	const exportBinding = declarationExportSyntax(
		node,
		nodeOrdinal,
		modifierNames,
		variableCarrier,
		carrierModifierNames
	);
	state.declarations.push({
		ambientSyntax: state.sourceFile.isDeclarationFile || hasDeclareCarrier(state, nodeOrdinal),
		candidateRole,
		exportCarrierNodeOrdinal: exportBinding.exportCarrierNodeOrdinal,
		exportSyntax: exportBinding.exportSyntax,
		localModifiers,
		nameNodeOrdinal,
		nameState,
		nodeOrdinal,
		sourceOrdinal: state.sourceOrdinal,
		syntacticName,
		syntaxKind: rawNode.kind,
		syntaxKindName: rawNode.kindName
	});
	state.guard.check();
}

function literalCookedValue(node: ts.Node, rawNode: RawSemanticAstNode): string | boolean | null {
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (node.kind === ts.SyntaxKind.NullKeyword) return null;
	if ('text' in node && typeof (node as ts.Node & { readonly text?: unknown }).text === 'string')
		return (node as ts.Node & { readonly text: string }).text;
	return fail('UNSUPPORTED_SYNTAX', `Literal node ${rawNode.kindName} has no public cooked text.`);
}

function projectLiteral(
	state: SourceSyntaxState,
	nodeOrdinal: number,
	node: ts.Node,
	rawNode: RawSemanticAstNode
): void {
	const literalDescriptor = semanticLiteralDescriptor(node.kind);
	if (literalDescriptor === null) return;
	const lexeme = state.sourceFile.text.slice(rawNode.start, rawNode.end);
	const cooked = literalCookedValue(node, rawNode);
	const valueLength = literalValueLength(cooked);
	const nonScalar = typeof cooked === 'string' && !isUnicodeScalarString(cooked);
	const valueEncoding = nonScalar
		? ('UTF16_CODE_UNITS_LE' as const)
		: literalDescriptor.valueEncoding;
	const exact =
		!nonScalar && (typeof cooked !== 'string' || valueLength <= state.maxLiteralCharacters);
	state.literals.push({
		lexemeLength: lexeme.length,
		lexemeSha256: literalLexemeDigest(lexeme),
		nodeOrdinal,
		sourceOrdinal: state.sourceOrdinal,
		value: exact ? cooked : null,
		valueEncoding,
		valueLength,
		valueSha256: literalValueDigest(valueEncoding, literalDescriptor.valueType, cooked),
		valueState: exact ? 'EXACT' : 'DIGEST_ONLY',
		valueType: literalDescriptor.valueType
	});
	state.guard.check();
}

function projectInvocation(state: SourceSyntaxState, nodeOrdinal: number, node: ts.Node): void {
	const invocationKind = semanticInvocationKind(node.kind);
	if (invocationKind === null) return;
	const parts = invocationParts(node);
	if (parts === null)
		fail('UNSUPPORTED_SYNTAX', 'Invocation taxonomy and public node shape disagree.');
	state.invocations.push({
		argumentNodeOrdinals: parts.arguments.map((argument) =>
			retainedOrdinal(state, argument, 'Invocation argument')
		),
		calleeNodeOrdinal: retainedOrdinal(state, parts.callee, 'Invocation callee'),
		invocationKind,
		nodeOrdinal,
		optional: invocationKind === 'CALL' && (node.flags & ts.NodeFlags.OptionalChain) !== 0,
		sourceOrdinal: state.sourceOrdinal,
		templateNodeOrdinal:
			parts.template === null ? null : retainedOrdinal(state, parts.template, 'Invocation template')
	});
	state.guard.check();
}

function projectAssignment(state: SourceSyntaxState, nodeOrdinal: number, node: ts.Node): void {
	const assignment = assignmentParts(node);
	if (assignment === null) return;
	state.assignments.push({
		assignmentKind: assignment.kind,
		nodeOrdinal,
		operatorKind: assignment.operatorKind,
		operatorName: syntaxKindName(assignment.operatorKind),
		sourceOrdinal: state.sourceOrdinal,
		targetNodeOrdinal: retainedOrdinal(state, assignment.target, 'Assignment target'),
		valueNodeOrdinal:
			assignment.value === null
				? null
				: retainedOrdinal(state, assignment.value, 'Assignment value')
	});
	state.guard.check();
}

function projectRetainedNodes(state: SourceSyntaxState): void {
	for (let nodeOrdinal = 0; nodeOrdinal < state.nodes.length; nodeOrdinal += 1) {
		state.guard.check();
		const rawNode = state.nodes[nodeOrdinal]!;
		const node = state.originalNodes[nodeOrdinal]!;
		projectDeclarationCandidate(state, nodeOrdinal, node, rawNode);
		projectLiteral(state, nodeOrdinal, node, rawNode);
		projectInvocation(state, nodeOrdinal, node);
		projectAssignment(state, nodeOrdinal, node);
	}
}

function projectSourceSyntax(
	sourceFile: ts.SourceFile,
	sourceOrdinal: number,
	guard: ExtractionGuard,
	maxLiteralCharacters: number
): SourceSyntaxProjection {
	const state: SourceSyntaxState = {
		assignments: [],
		childrenByParent: new Map(),
		declarations: [],
		guard,
		invocations: [],
		literals: [],
		maxLiteralCharacters,
		nodes: [],
		ordinalByNode: new WeakMap(),
		originalNodes: [],
		sourceFile,
		sourceOrdinal
	};

	traverseSourceSyntax(state);
	indexChildrenByParent(state);

	projectRetainedNodes(state);

	return {
		assignments: state.assignments,
		declarationCandidates: state.declarations,
		invocations: state.invocations,
		literals: state.literals,
		nodes: state.nodes,
		transientNodes: state.originalNodes
	};
}

function messageCharacterCount(message: RawSemanticDiagnosticMessage): number {
	let total = 0;
	const pending = [message];
	while (pending.length > 0) {
		const current = pending.pop()!;
		if (!Number.isSafeInteger(total + current.textLength))
			fail('DIAGNOSTIC_INVALID', 'Diagnostic character count overflowed.');
		total += current.textLength;
		for (let index = current.next.length - 1; index >= 0; index -= 1)
			pending.push(current.next[index]!);
	}
	return total;
}

function diagnosticMessage(
	messageText: string | ts.DiagnosticMessageChain,
	guard: ExtractionGuard
): RawSemanticDiagnosticMessage {
	guard.check();
	if (typeof messageText === 'string') {
		if (messageText.length === 0)
			fail('DIAGNOSTIC_INVALID', 'TypeScript returned an empty diagnostic message.');
		return { category: null, code: null, next: [], ...encodeSemanticDiagnosticText(messageText) };
	}
	if (
		messageText.messageText.length === 0 ||
		!Number.isSafeInteger(messageText.code) ||
		messageText.code < 1
	)
		fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic message chain.');
	const next: RawSemanticDiagnosticMessage[] = [];
	for (const child of messageText.next ?? []) {
		guard.check();
		next.push(diagnosticMessage(child, guard));
		guard.check();
	}
	return {
		category: diagnosticCategory(messageText.category),
		code: messageText.code,
		next,
		...encodeSemanticDiagnosticText(messageText.messageText)
	};
}

function diagnosticSpan(
	start: number | undefined,
	length: number | undefined,
	maxLength?: number
): { readonly end: number | null; readonly start: number | null } {
	if (start === undefined && length === undefined) return { end: null, start: null };
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(length) ||
		start! < 0 ||
		length! < 0 ||
		!Number.isSafeInteger(start! + length!)
	)
		fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic span.');
	const end = start! + length!;
	if (maxLength !== undefined && end > maxLength)
		fail('DIAGNOSTIC_INVALID', 'TypeScript returned a diagnostic span outside its source.');
	return { end, start: start! };
}

interface PendingDiagnostic extends Omit<RawSemanticDiagnosticOccurrence, 'occurrenceOrdinal'> {
	readonly discoveryOrdinal: number;
}

function diagnosticLocationKind(
	path: string | null,
	source: RawSemanticSource | undefined
): RawSemanticDiagnosticOccurrence['locationKind'] {
	if (path === null) return 'NONE';
	if (source === undefined) return 'PATH';
	return 'SOURCE';
}

function rawRelatedDiagnostic(
	input: ExtractStaticRawInput,
	sourceByPath: ReadonlyMap<string, RawSemanticSource>,
	related: ts.DiagnosticRelatedInformation,
	guard: ExtractionGuard
): RawSemanticRelatedDiagnostic {
	guard.check();
	if (!Number.isSafeInteger(related.code) || related.code < 1)
		fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid related diagnostic code.');
	const path = related.file === undefined ? null : checkedLogicalPath(input, related.file.fileName);
	const source = path === null ? undefined : sourceByPath.get(path);
	const span = diagnosticSpan(related.start, related.length, source?.textLength);
	return {
		category: diagnosticCategory(related.category),
		code: `TS${related.code}`,
		...span,
		message: diagnosticMessage(related.messageText, guard),
		path
	};
}

function pendingDiagnosticRecord(
	input: ExtractStaticRawInput,
	sourceByPath: ReadonlyMap<string, RawSemanticSource>,
	familyInput: StaticRawDiagnosticFamilyInput,
	diagnostic: ts.Diagnostic,
	discoveryOrdinal: number,
	guard: ExtractionGuard
): PendingDiagnostic {
	if (!Number.isSafeInteger(diagnostic.code) || diagnostic.code < 1)
		fail('DIAGNOSTIC_INVALID', 'TypeScript returned an invalid diagnostic code.');
	const path =
		diagnostic.file === undefined ? null : checkedLogicalPath(input, diagnostic.file.fileName);
	const source = path === null ? undefined : sourceByPath.get(path);
	const span = diagnosticSpan(diagnostic.start, diagnostic.length, source?.textLength);
	const message = diagnosticMessage(diagnostic.messageText, guard);
	const related = (diagnostic.relatedInformation ?? [])
		.map((item) => rawRelatedDiagnostic(input, sourceByPath, item, guard))
		.sort((left, right) =>
			compareStrings(canonicalSemanticJson(left), canonicalSemanticJson(right))
		);
	const characters =
		messageCharacterCount(message) +
		related.reduce((total, item) => total + messageCharacterCount(item.message), 0);
	guard.addDiagnostic(characters);
	return {
		category: diagnosticCategory(diagnostic.category),
		code: `TS${diagnostic.code}`,
		discoveryOrdinal,
		...span,
		family: familyInput.family,
		locationKind: diagnosticLocationKind(path, source),
		message,
		path,
		related,
		sourceOrdinal: source?.sourceOrdinal ?? null
	};
}

function collectPendingDiagnostics(
	input: ExtractStaticRawInput,
	familyInputs: readonly StaticRawDiagnosticFamilyInput[],
	sourceByPath: ReadonlyMap<string, RawSemanticSource>,
	guard: ExtractionGuard
): PendingDiagnostic[] {
	const pending: PendingDiagnostic[] = [];
	let discoveryOrdinal = 0;
	for (const familyInput of familyInputs) {
		guard.check();
		if (familyInput.state === 'FAILED' && familyInput.diagnostics.length > 0)
			fail(
				'INVALID_INPUT',
				`Failed diagnostic family ${familyInput.family} cannot retain diagnostics.`
			);
		for (const diagnostic of familyInput.diagnostics) {
			guard.check();
			pending.push(
				pendingDiagnosticRecord(
					input,
					sourceByPath,
					familyInput,
					diagnostic,
					discoveryOrdinal,
					guard
				)
			);
			discoveryOrdinal += 1;
			guard.check();
		}
	}
	return pending;
}

function projectDiagnostics(
	input: ExtractStaticRawInput,
	familyInputs: readonly StaticRawDiagnosticFamilyInput[],
	sources: readonly RawSemanticSource[],
	guard: ExtractionGuard
): {
	readonly diagnostics: readonly RawSemanticDiagnosticOccurrence[];
	readonly families: readonly RawSemanticDiagnosticFamilyCoverage[];
} {
	const sourceByPath = new Map(sources.map((source) => [source.logicalPath, source] as const));
	const pending = collectPendingDiagnostics(input, familyInputs, sourceByPath, guard);

	pending.sort((left, right) => {
		const { discoveryOrdinal: _leftOrdinal, ...leftPayload } = left;
		const { discoveryOrdinal: _rightOrdinal, ...rightPayload } = right;
		return (
			compareStrings(canonicalSemanticJson(leftPayload), canonicalSemanticJson(rightPayload)) ||
			left.discoveryOrdinal - right.discoveryOrdinal
		);
	});
	const diagnostics: RawSemanticDiagnosticOccurrence[] = pending.map(
		({ discoveryOrdinal: _discoveryOrdinal, ...diagnostic }, occurrenceOrdinal) => ({
			...diagnostic,
			occurrenceOrdinal
		})
	);
	const families = familyInputs.map((familyInput): RawSemanticDiagnosticFamilyCoverage => ({
		coverage: familyInput.state === 'RUN' ? 'COMPLETE' : 'BOUNDED',
		diagnosticOccurrenceOrdinals: diagnostics
			.filter((diagnostic) => diagnostic.family === familyInput.family)
			.map((diagnostic) => diagnostic.occurrenceOrdinal),
		family: familyInput.family,
		reason: familyInput.reason,
		state: familyInput.state
	}));
	guard.check();
	return { diagnostics, families };
}

function validateFamilyInputs(inputs: readonly StaticRawDiagnosticFamilyInput[]): void {
	if (
		inputs.length !== RAW_DIAGNOSTIC_FAMILIES.length ||
		!inputs.every((input, index) => input.family === RAW_DIAGNOSTIC_FAMILIES[index])
	)
		fail(
			'INVALID_INPUT',
			'Static extraction requires all six diagnostic families in registered order.'
		);
	for (const input of inputs)
		if (input.reason.length === 0)
			fail('INVALID_INPUT', `Diagnostic family ${input.family} requires a non-empty reason.`);
}

function partialityReasons(
	project: ProjectSubjectRecord,
	sources: readonly RawSemanticSource[],
	diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[],
	diagnostics: readonly RawSemanticDiagnosticOccurrence[],
	additionalReasons: readonly RawSemanticPartialityReason[] = []
): readonly RawSemanticPartialityReason[] {
	const reasons: RawSemanticPartialityReason[] = [...additionalReasons];
	const projectEvidencePartial =
		project.rootDisposition === 'INCOMPLETE' ||
		project.typescriptDiagnostics.some(
			(entry) => entry.severity === 'ERROR' || entry.code === 'TYPESCRIPT_PROJECT_PARTIAL'
		);
	if (projectEvidencePartial)
		reasons.push({
			capability: 'TS_PROJECT',
			code: 'TYPESCRIPT_PROJECT_PARTIAL',
			message: `Frozen project ${project.configPath} has incomplete roots or project-configuration diagnostics.`,
			path: project.configPath
		});
	if (project.frameworkCandidates.length > 0)
		reasons.push({
			capability: 'TS_SYNTAX',
			code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED',
			message: 'Framework candidates are retained but not syntax-indexed by Slice 3A.',
			path: project.configPath
		});
	for (const family of diagnosticFamilies)
		if (family.state === 'FAILED' || family.coverage === 'BOUNDED') {
			reasons.push({
				capability: 'TS_PROJECT',
				code: 'COMPILER_CONTEXT_UNAVAILABLE',
				message: `${family.family} diagnostic coverage is bounded: ${family.reason}`,
				path: project.configPath
			});
		}
	const parserRecoveryPaths = canonicalSet(
		diagnostics
			.filter((diagnostic) => diagnostic.family === 'SYNTACTIC' && diagnostic.category === 'ERROR')
			.map((diagnostic) => diagnostic.path ?? project.configPath)
	);
	for (const path of parserRecoveryPaths)
		for (const capability of ['TS_SYMBOL', 'TS_SYNTAX'] as const)
			reasons.push({
				capability,
				code: 'TYPESCRIPT_PROJECT_PARTIAL',
				message: `TypeScript parser recovery was required after retained SYNTACTIC ERROR diagnostics for ${path}; ${capability} closure is partial.`,
				path
			});
	for (const source of sources) {
		if (
			source.origin !== 'UNKNOWN' &&
			(source.mapping.state === 'EXACT' || source.mapping.state === 'NOT_APPLICABLE')
		)
			continue;
		reasons.push({
			capability: 'TS_PROJECT',
			code: 'COMPILER_CONTEXT_UNAVAILABLE',
			message: source.mapping.reason,
			path: source.logicalPath
		});
	}
	return [
		...new Map(
			reasons.map((reason) => [
				`${reason.capability}\0${reason.code}\0${reason.path ?? ''}\0${reason.message}`,
				reason
			])
		).entries()
	]
		.sort(([left], [right]) => compareStrings(left, right))
		.map(([, reason]) => reason);
}

function projectRecord(
	project: ProjectSubjectRecord,
	recipe: RawSemanticProgramRecipe,
	sources: readonly RawSemanticSource[],
	diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[],
	diagnostics: readonly RawSemanticDiagnosticOccurrence[],
	additionalReasons: readonly RawSemanticPartialityReason[] = []
): RawSemanticProject {
	return {
		configPath: project.configPath,
		frameworkCandidates: canonicalSet(project.frameworkCandidates),
		kind: project.kind,
		partialityReasons: partialityReasons(
			project,
			sources,
			diagnosticFamilies,
			diagnostics,
			additionalReasons
		),
		programRecipe: recipe,
		projectReferences: canonicalSet(project.projectReferences),
		rootDisposition: project.rootDisposition,
		rootNames: canonicalSet(recipe.rootNames)
	};
}

interface ProgramSourceEntry {
	readonly logicalPath: string;
	readonly sourceFile: ts.SourceFile;
}

interface DeepSourceEntry {
	readonly sourceFile: ts.SourceFile;
	readonly sourceOrdinal: number;
}

interface SourceAnalysisDisposition {
	readonly analysisDisposition: RawSemanticSource['analysisDisposition'];
	readonly artifactClass: RawSemanticSource['artifactClass'];
	readonly artifactRoles: readonly RawSemanticSource['artifactRoles'][number][];
}

interface RawSourceCollection {
	readonly deepSources: DeepSourceEntry[];
	readonly sourceFilesByOrdinal: ts.SourceFile[];
	readonly sources: RawSemanticSource[];
}

interface SourceSyntaxCollection {
	readonly assignments: RawSemanticAssignment[];
	readonly astNodes: RawSemanticAstNode[];
	readonly declarationCandidates: RawSemanticDeclarationCandidate[];
	readonly invocations: RawSemanticInvocation[];
	readonly literals: RawSemanticLiteral[];
	readonly syntaxBySourceOrdinal: Map<number, SourceSyntaxProjection>;
}

function validateStaticRawInput(input: ExtractStaticRawInput): void {
	if (ts.version !== TYPESCRIPT_PROVIDER_VERSION)
		fail(
			'IDENTITY_MISMATCH',
			`Static extraction requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}, received ${ts.version}.`
		);
	if (input.budgets.maxProjects < 1)
		fail('BUDGET_EXCEEDED', 'Static extraction cannot emit one project within maxProjects.');
	if (
		input.checker === null ||
		typeof input.checker !== 'object' ||
		typeof input.checker.getTypeAtLocation !== 'function' ||
		typeof input.checker.getSymbolAtLocation !== 'function'
	)
		fail(
			'INVALID_INPUT',
			'Static extraction requires the TypeChecker created for the exact Program.'
		);
	if (!Number.isSafeInteger(input.deadlineMs))
		fail('INVALID_INPUT', 'Static extraction requires a safe absolute deadline.');
	if (typeof input.resolveCheckerContextDigest !== 'function')
		fail('INVALID_INPUT', 'Static extraction requires a checker context digest resolver.');
	if ((input.assignabilityRequests ?? []).length > 0 && !(input.includeTypes ?? false))
		fail('INVALID_INPUT', 'Assignability requests require TS_TYPE extraction.');
	validateFamilyInputs(input.diagnosticFamilies);
}

function validateRecipePolicies(input: ExtractStaticRawInput, guard: ExtractionGuard): void {
	try {
		validateProgramRecipePolicy(input.programRecipe, input.budgets.maxPathCharacters);
		guard.check();
		validateProgramRecipePolicy(input.project.programRecipe, input.budgets.maxPathCharacters);
		guard.check();
	} catch (error) {
		const message =
			error instanceof Error
				? `ProgramRecipe policy validation failed: ${error.message}`
				: 'ProgramRecipe policy validation failed.';
		fail(
			error instanceof Error && /budget|exceed/iu.test(error.message)
				? 'BUDGET_EXCEEDED'
				: 'INVALID_INPUT',
			message
		);
	}
}

function assertProjectIdentity(
	input: ExtractStaticRawInput,
	authoritativeRecipe: RawSemanticProgramRecipe,
	projectRecipe: RawSemanticProgramRecipe
): void {
	if (
		canonicalSemanticJson(authoritativeRecipe) !== canonicalSemanticJson(projectRecipe) ||
		input.projectKey !== input.project.configPath ||
		input.project.configPath !== input.programRecipe.configPath ||
		input.project.kind !== input.programRecipe.kind ||
		!sameStrings(
			canonicalSet(input.project.projectReferences),
			input.programRecipe.projectReferences
		)
	)
		fail(
			'IDENTITY_MISMATCH',
			'Project key, configuration path, project record, and ProgramRecipe do not bind the same project.'
		);
	for (const path of [
		input.projectKey,
		input.project.configPath,
		...input.programRecipe.rootNames,
		...input.programRecipe.projectReferences,
		...input.project.frameworkCandidates
	])
		checkedExistingLogicalPath(input, path);
}

function assertProgramRoots(input: ExtractStaticRawInput, recipeRoots: readonly string[]): void {
	const programRoots = canonicalSet(
		input.program.getRootFileNames().map((path) => checkedLogicalPath(input, path))
	);
	if (!sameStrings(recipeRoots, programRoots))
		fail('IDENTITY_MISMATCH', 'Program roots do not reproduce the authoritative ProgramRecipe.');
}

function resolveProgramSourceFiles(input: ExtractStaticRawInput): readonly ProgramSourceEntry[] {
	const programSourceFiles = input.program
		.getSourceFiles()
		.map((sourceFile) => ({
			logicalPath: checkedLogicalPath(input, sourceFile.fileName),
			sourceFile
		}))
		.sort((left, right) => compareStrings(left.logicalPath, right.logicalPath));
	if (
		new Set(programSourceFiles.map((entry) => entry.logicalPath)).size !== programSourceFiles.length
	)
		fail('PATH_MAPPING_FAILED', 'Two Program sources map to the same logical path.');
	return programSourceFiles;
}

function resolveSourceEvidence(
	input: ExtractStaticRawInput,
	entry: ProgramSourceEntry
): RawCompilerSourceBinding {
	let evidence: RawCompilerSourceBinding | undefined;
	try {
		evidence = input.resolveCompilerSource(entry.logicalPath);
	} catch {
		fail(
			'SOURCE_EVIDENCE_MISSING',
			'Compiler source-evidence resolution failed closed.',
			entry.logicalPath
		);
	}
	const requiredEvidenceState = input.evidenceState ?? 'VERIFIED_COMPILER_INPUT';
	if (
		evidence?.verificationState !== requiredEvidenceState ||
		evidence.logicalPath !== entry.logicalPath
	)
		fail(
			'SOURCE_EVIDENCE_MISSING',
			requiredEvidenceState === 'VERIFIED_COMPILER_INPUT'
				? 'Program source has no exact finalized and rechecked compiler-input evidence.'
				: 'Capture projection source has no exact captured compiler-input evidence.',
			entry.logicalPath
		);
	if (
		!Number.isSafeInteger(evidence.bytes) ||
		evidence.bytes < 0 ||
		!/^[a-f0-9]{64}$/u.test(evidence.contentSha256) ||
		evidence.mapping.reason.length === 0
	)
		fail(
			'SOURCE_EVIDENCE_MISSING',
			'Verified source evidence has invalid bounded metadata.',
			entry.logicalPath
		);
	return evidence;
}

function frozenSourceDisposition(
	evidence: RawCompilerSourceBinding,
	logicalPath: string
): SourceAnalysisDisposition {
	if (
		evidence.artifact?.disposition !== 'ANALYZED' ||
		!evidence.artifact.roles.includes('COMPILER_CANDIDATE')
	)
		fail(
			'SOURCE_POLICY_MISMATCH',
			'Frozen Program source is not an analyzed compiler candidate.',
			logicalPath
		);
	return {
		analysisDisposition: 'DEEP_INDEXED',
		artifactClass: evidence.artifact.primaryClass,
		artifactRoles: canonicalSet(
			evidence.artifact.roles
		) as readonly RawSemanticSource['artifactRoles'][number][]
	};
}

function liveSourceDisposition(
	evidence: RawCompilerSourceBinding,
	entry: ProgramSourceEntry,
	recipeRoots: readonly string[]
): SourceAnalysisDisposition {
	if (evidence.artifact !== null)
		fail(
			'SOURCE_POLICY_MISMATCH',
			'Live compiler context cannot claim a frozen artifact classification.',
			entry.logicalPath
		);
	if (recipeRoots.includes(entry.logicalPath))
		fail(
			'SOURCE_POLICY_MISMATCH',
			'A compiler root cannot be represented as live context-only input.',
			entry.logicalPath
		);
	return { analysisDisposition: 'CONTEXT_ONLY', artifactClass: 'CONTEXT_ONLY', artifactRoles: [] };
}

function sourceDisposition(
	evidence: RawCompilerSourceBinding,
	entry: ProgramSourceEntry,
	recipeRoots: readonly string[]
): SourceAnalysisDisposition {
	return evidence.byteBudgetClass === 'FROZEN_SUBJECT'
		? frozenSourceDisposition(evidence, entry.logicalPath)
		: liveSourceDisposition(evidence, entry, recipeRoots);
}

function sourceScriptKindName(scriptKind: ts.ScriptKind, logicalPath: string): string {
	const scriptKindName = ts.ScriptKind[scriptKind];
	if (typeof scriptKindName !== 'string')
		fail(
			'UNSUPPORTED_SYNTAX',
			`Program source has unknown ScriptKind ${String(scriptKind)}.`,
			logicalPath
		);
	return scriptKindName;
}

function buildRawSource(
	entry: ProgramSourceEntry,
	evidence: RawCompilerSourceBinding,
	disposition: SourceAnalysisDisposition,
	recipeRoots: readonly string[],
	sourceOrdinal: number
): RawSemanticSource {
	const scriptKind = scriptKindFromLogicalPath(entry.logicalPath);
	const scriptKindName = sourceScriptKindName(scriptKind, entry.logicalPath);
	return {
		analysisDisposition: disposition.analysisDisposition,
		artifactClass: disposition.artifactClass,
		artifactRoles: disposition.artifactRoles,
		bytes: evidence.bytes,
		contentSha256: evidence.contentSha256,
		declarationFile: entry.sourceFile.isDeclarationFile,
		languageVariant:
			scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX ? 'JSX' : 'Standard',
		logicalPath: entry.logicalPath,
		mapping: { ...evidence.mapping },
		moduleKind: ts.isExternalModule(entry.sourceFile) ? 'MODULE' : 'SCRIPT',
		origin: evidence.origin,
		rootFile:
			disposition.analysisDisposition === 'DEEP_INDEXED' && recipeRoots.includes(entry.logicalPath),
		rootNodeOrdinal: disposition.analysisDisposition === 'DEEP_INDEXED' ? 0 : null,
		scriptKind,
		scriptKindName,
		sourceOrdinal,
		textLength: entry.sourceFile.text.length
	};
}

function collectRawSources(
	input: ExtractStaticRawInput,
	programSourceFiles: readonly ProgramSourceEntry[],
	recipeRoots: readonly string[],
	guard: ExtractionGuard
): RawSourceCollection {
	const collection: RawSourceCollection = {
		deepSources: [],
		sourceFilesByOrdinal: [],
		sources: []
	};
	for (const entry of programSourceFiles) {
		guard.addSource(entry.logicalPath);
		const evidence = resolveSourceEvidence(input, entry);
		const disposition = sourceDisposition(evidence, entry, recipeRoots);
		const sourceOrdinal = collection.sources.length;
		collection.sources.push(
			buildRawSource(entry, evidence, disposition, recipeRoots, sourceOrdinal)
		);
		collection.sourceFilesByOrdinal.push(entry.sourceFile);
		if (disposition.analysisDisposition === 'DEEP_INDEXED')
			collection.deepSources.push({ sourceFile: entry.sourceFile, sourceOrdinal });
		guard.check();
	}
	return collection;
}

function collectSourceSyntax(
	input: ExtractStaticRawInput,
	deepSources: readonly DeepSourceEntry[],
	guard: ExtractionGuard
): SourceSyntaxCollection {
	const collection: SourceSyntaxCollection = {
		assignments: [],
		astNodes: [],
		declarationCandidates: [],
		invocations: [],
		literals: [],
		syntaxBySourceOrdinal: new Map()
	};
	for (const deepSource of deepSources) {
		guard.check();
		const projection = projectSourceSyntax(
			deepSource.sourceFile,
			deepSource.sourceOrdinal,
			guard,
			input.budgets.maxLiteralCharacters
		);
		collection.syntaxBySourceOrdinal.set(deepSource.sourceOrdinal, projection);
		collection.astNodes.push(...projection.nodes);
		collection.declarationCandidates.push(...projection.declarationCandidates);
		collection.literals.push(...projection.literals);
		collection.invocations.push(...projection.invocations);
		collection.assignments.push(...projection.assignments);
		guard.check();
	}
	return collection;
}

function extractStaticRawActive(input: ExtractStaticRawInput): RawStaticSemanticProjectExtraction {
	const guard = new ExtractionGuard(input);
	guard.check();
	const includeTypes = input.includeTypes ?? false;
	const assignabilityRequests = input.assignabilityRequests ?? [];
	validateStaticRawInput(input);

	validateRecipePolicies(input, guard);
	const authoritativeRecipe = rawRecipe(input.programRecipe);
	const projectRecipe = rawRecipe(input.project.programRecipe);
	assertProjectIdentity(input, authoritativeRecipe, projectRecipe);

	const recipeRoots = canonicalSet(input.programRecipe.rootNames);
	assertProgramRoots(input, recipeRoots);

	const programSourceFiles = resolveProgramSourceFiles(input);

	const { deepSources, sourceFilesByOrdinal, sources } = collectRawSources(
		input,
		programSourceFiles,
		recipeRoots,
		guard
	);

	const {
		assignments,
		astNodes,
		declarationCandidates,
		invocations,
		literals,
		syntaxBySourceOrdinal
	} = collectSourceSyntax(input, deepSources, guard);
	const symbolProjection = extractTypeScriptSymbols({
		assignabilityRequests,
		checker: input.checker,
		compilerOptions: input.program.getCompilerOptions(),
		guard: {
			addFact: () => guard.addCompilerFact(),
			addScope: () => guard.addScope(),
			check: () => guard.check(),
			query: <T>(key: string, action: () => T): T => guard.compilerQuery(key, action)
		},
		includeTypes,
		projectKey: input.projectKey,
		resolveCheckerContextDigest: input.resolveCheckerContextDigest,
		sources: sources.map((source) => {
			const syntax = syntaxBySourceOrdinal.get(source.sourceOrdinal);
			return {
				declarationCandidates: syntax?.declarationCandidates ?? [],
				nodes: syntax?.transientNodes ?? null,
				source,
				sourceFile: sourceFilesByOrdinal[source.sourceOrdinal]!
			};
		})
	});

	const diagnosticProjection = projectDiagnostics(input, input.diagnosticFamilies, sources, guard);
	guard.check();
	const result: RawStaticSemanticProjectExtraction = {
		aliases: symbolProjection.aliases,
		assignments,
		astNodes,
		declarationCandidates,
		declarations: symbolProjection.declarations,
		diagnosticFamilies: diagnosticProjection.families,
		diagnostics: diagnosticProjection.diagnostics,
		evidenceState: input.evidenceState ?? 'VERIFIED_COMPILER_INPUT',
		invocations,
		literals,
		moduleExports: symbolProjection.moduleExports,
		moduleResolutions: symbolProjection.moduleResolutions,
		overloadSets: symbolProjection.overloadSets,
		project: projectRecord(
			input.project,
			authoritativeRecipe,
			sources,
			diagnosticProjection.families,
			diagnosticProjection.diagnostics,
			symbolProjection.partialityReasons
		),
		references: symbolProjection.references,
		scopes: symbolProjection.scopes,
		signatureParameters: symbolProjection.signatureParameters,
		signatures: symbolProjection.signatures,
		sources,
		symbols: symbolProjection.symbols,
		typeParameters: symbolProjection.typeParameters,
		typeRelations: symbolProjection.typeRelations,
		types: symbolProjection.types
	};
	const frozen = deepFreeze(result, () => guard.check());
	guard.complete();
	guard.check();
	return frozen;
}

/** Extract one exact Program into an identity-free, replay-comparable raw model. */
export function extractStaticRaw(input: ExtractStaticRawInput): RawStaticSemanticProjectExtraction {
	try {
		return extractStaticRawActive(input);
	} catch (error) {
		const budgetState =
			input.budgetLedger === undefined ? undefined : extractionBudgetStates.get(input.budgetLedger);
		if (budgetState !== undefined) budgetState.poisoned = true;
		if (error instanceof StaticRawExtractionError) throw error;
		const detail =
			error instanceof Error &&
			isUnicodeScalarString(error.message) &&
			error.message.length <= 1_000
				? error.message
				: 'Unknown provider failure.';
		throw new StaticRawExtractionError(
			'INVALID_INPUT',
			`TypeScript raw extraction failed closed: ${detail}`
		);
	}
}
