import { Buffer } from 'node:buffer';
import { isProxy } from 'node:util/types';
import {
	SEMANTIC_BUDGET_KEYS,
	type SemanticBudgetKey,
	type SemanticBudgets,
	type SemanticBuildDiagnostic
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from './canonical.js';

export const SEMANTIC_OPERATION_BUDGET_LIMITS_DOMAIN =
	'jan-csaa/semantic-operation-budget-limits/v2' as const;
export const SEMANTIC_OPERATION_BUDGET_PLAN_DOMAIN =
	'jan-csaa/semantic-operation-budget-plan/v1' as const;
export const SEMANTIC_OPERATION_BUDGET_USAGE_DOMAIN =
	'jan-csaa/semantic-operation-budget-usage/v2' as const;
export const SEMANTIC_OPERATION_POPULATION_CLAIM_DOMAIN =
	'jan-csaa/semantic-operation-population-claim/v1' as const;

export const SEMANTIC_OPERATION_BUDGET_PHASES = [
	'REQUEST',
	'FRESHNESS',
	'MATERIALIZE',
	'CAPTURE',
	'RECHECK',
	'PROGRAM',
	'EXTRACT',
	'VALIDATE'
] as const satisfies readonly SemanticBuildDiagnostic['phase'][];
export type SemanticOperationBudgetPhase = SemanticBuildDiagnostic['phase'];

export const SEMANTIC_OPERATION_POPULATION_KINDS = [
	'AST_NODES',
	'COMPILER_FACTS',
	'COMPILER_INPUTS',
	'COMPILER_INPUT_METADATA_BYTES',
	'CONTEXT_BYTES',
	'CONTEXT_FILES',
	'DIAGNOSTICS',
	'DIAGNOSTIC_CHARACTERS',
	'DIRECTORY_ENTRIES',
	'PROJECTS',
	'SCOPES',
	'SNAPSHOT_BYTES',
	'SOURCES'
] as const;
export type SemanticOperationPopulationKind = (typeof SEMANTIC_OPERATION_POPULATION_KINDS)[number];

export const SEMANTIC_OPERATION_QUERY_FAMILIES = ['COMPILER_HOST', 'TYPE_CHECKER'] as const;
export type SemanticOperationQueryFamily = (typeof SEMANTIC_OPERATION_QUERY_FAMILIES)[number];

export type SemanticOperationPopulationMode = 'COUNT' | 'SUM';
export type SemanticOperationLimitKey = SemanticBudgetKey;

export interface SemanticOperationBudgetLimits {
	readonly budgets: SemanticBudgets;
}

export interface SemanticOperationClaimReference {
	readonly phase: SemanticOperationBudgetPhase;
	readonly population: SemanticOperationPopulationKind;
}

export interface SemanticOperationRequiredClaim extends SemanticOperationClaimReference {
	readonly mode: SemanticOperationPopulationMode;
}

export interface SemanticOperationReconciliationGroup {
	readonly claims: readonly SemanticOperationClaimReference[];
	readonly id: string;
}

export interface SemanticOperationBudgetPlan {
	readonly reconciliationGroups: readonly SemanticOperationReconciliationGroup[];
	readonly requiredClaims: readonly SemanticOperationRequiredClaim[];
}

export interface SemanticOperationCountPopulationClaimInput extends SemanticOperationClaimReference {
	readonly members: readonly string[];
	readonly mode: 'COUNT';
}

export interface SemanticOperationSumContribution {
	readonly amount: number;
	readonly key: string;
}

export interface SemanticOperationSumPopulationClaimInput extends SemanticOperationClaimReference {
	readonly contributions: readonly SemanticOperationSumContribution[];
	readonly mode: 'SUM';
}

export type SemanticOperationPopulationClaimInput =
	SemanticOperationCountPopulationClaimInput | SemanticOperationSumPopulationClaimInput;

export interface SemanticOperationQueryInvocationInput {
	readonly family: SemanticOperationQueryFamily;
	readonly phase: SemanticOperationBudgetPhase;
	readonly projectKey: string;
	readonly queryKey: string;
}

export type SemanticOperationBudgetErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'CLAIM_CONFLICT'
	| 'FINALIZED'
	| 'INCOMPLETE_CLAIMS'
	| 'INVALID_INPUT'
	| 'INVALID_LIMITS'
	| 'LIMITS_MISMATCH'
	| 'POISONED'
	| 'RECONCILIATION_FAILED';

export class SemanticOperationBudgetError extends Error {
	readonly attempted: number | null;
	readonly code: SemanticOperationBudgetErrorCode;
	readonly limit: number | null;
	readonly limitKey: SemanticOperationLimitKey | null;
	readonly phase: SemanticOperationBudgetPhase | null;

	constructor(
		code: SemanticOperationBudgetErrorCode,
		message: string,
		details: {
			readonly attempted?: number;
			readonly limit?: number;
			readonly limitKey?: SemanticOperationLimitKey;
			readonly phase?: SemanticOperationBudgetPhase;
		} = {}
	) {
		super(message);
		this.name = 'SemanticOperationBudgetError';
		this.attempted = details.attempted ?? null;
		this.code = code;
		this.limit = details.limit ?? null;
		this.limitKey = details.limitKey ?? null;
		this.phase = details.phase ?? null;
	}
}

interface SemanticOperationPopulationClaimUsageBase extends SemanticOperationClaimReference {
	readonly amount: number;
	readonly limit: number;
	readonly limitKey: SemanticOperationLimitKey;
	readonly manifestSha256: string;
	readonly remaining: number;
}

export interface SemanticOperationCountPopulationClaimUsage extends SemanticOperationPopulationClaimUsageBase {
	readonly members: readonly string[];
	readonly mode: 'COUNT';
}

export interface SemanticOperationSumPopulationClaimUsage extends SemanticOperationPopulationClaimUsageBase {
	readonly contributions: readonly SemanticOperationSumContribution[];
	readonly mode: 'SUM';
}

export type SemanticOperationPopulationClaimUsage =
	SemanticOperationCountPopulationClaimUsage | SemanticOperationSumPopulationClaimUsage;

export interface SemanticOperationWorkChargeUsage {
	readonly amount: number;
	readonly kind: 'COMPILER_QUERY_INVOCATIONS';
	readonly phase: SemanticOperationBudgetPhase;
}

export interface SemanticOperationWorkTotalUsage {
	readonly amount: number;
	readonly kind: 'COMPILER_QUERY_INVOCATIONS';
	readonly limit: number;
	readonly limitKey: 'maxCompilerQueryInvocations';
	readonly remaining: number;
}

export interface SemanticOperationQueryPhaseUsage {
	readonly amount: number;
	readonly phase: SemanticOperationBudgetPhase;
	readonly projectKey: string;
}

export interface SemanticOperationUniqueQueryUsage {
	readonly family: SemanticOperationQueryFamily;
	readonly invocations: readonly SemanticOperationQueryPhaseUsage[];
	readonly queryKeySha256: string;
}

export interface SemanticOperationUniqueQueryUnionUsage {
	readonly count: number;
	readonly limit: number;
	readonly manifestSha256: string;
	readonly members: readonly SemanticOperationUniqueQueryUsage[];
	readonly remaining: number;
}

export interface SemanticOperationReconciliationUsage {
	readonly claims: readonly SemanticOperationClaimReference[];
	readonly id: string;
	readonly manifestSha256: string;
}

export interface SemanticOperationBudgetUsage {
	readonly domain: typeof SEMANTIC_OPERATION_BUDGET_USAGE_DOMAIN;
	readonly limitsDigest: string;
	readonly planDigest: string;
	readonly populationClaims: readonly SemanticOperationPopulationClaimUsage[];
	readonly reconciliations: readonly SemanticOperationReconciliationUsage[];
	readonly uniqueQueries: SemanticOperationUniqueQueryUnionUsage;
	readonly usageDigest: string;
	readonly workCharges: readonly SemanticOperationWorkChargeUsage[];
	readonly workTotals: readonly SemanticOperationWorkTotalUsage[];
}

export type SemanticOperationClock = () => number;

const POPULATION_LIMIT_KEYS = {
	AST_NODES: 'maxAstNodes',
	COMPILER_FACTS: 'maxCompilerFacts',
	COMPILER_INPUTS: 'maxCompilerQueries',
	COMPILER_INPUT_METADATA_BYTES: 'maxCompilerInputMetadataBytes',
	CONTEXT_BYTES: 'maxContextBytes',
	CONTEXT_FILES: 'maxContextFiles',
	DIAGNOSTICS: 'maxDiagnostics',
	DIAGNOSTIC_CHARACTERS: 'maxDiagnosticCharacters',
	DIRECTORY_ENTRIES: 'maxDirectoryEntries',
	PROJECTS: 'maxProjects',
	SCOPES: 'maxScopes',
	SNAPSHOT_BYTES: 'maxSnapshotBytes',
	SOURCES: 'maxSources'
} as const satisfies Readonly<Record<SemanticOperationPopulationKind, SemanticOperationLimitKey>>;

const PLAN_KEYS = ['reconciliationGroups', 'requiredClaims'] as const;
const REQUIRED_CLAIM_KEYS = ['mode', 'phase', 'population'] as const;
const RECONCILIATION_GROUP_KEYS = ['claims', 'id'] as const;
const CLAIM_REFERENCE_KEYS = ['phase', 'population'] as const;
const COUNT_CLAIM_KEYS = ['members', 'mode', 'phase', 'population'] as const;
const SUM_CLAIM_KEYS = ['contributions', 'mode', 'phase', 'population'] as const;
const CONTRIBUTION_KEYS = ['amount', 'key'] as const;
const QUERY_INVOCATION_KEYS = ['family', 'phase', 'projectKey', 'queryKey'] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_PLAN_CLAIMS =
	SEMANTIC_OPERATION_BUDGET_PHASES.length * SEMANTIC_OPERATION_POPULATION_KINDS.length;

interface StoredUniqueQuery {
	readonly family: SemanticOperationQueryFamily;
	readonly invocations: ReadonlyMap<string, SemanticOperationQueryPhaseUsage>;
	readonly queryKey: string;
}

interface RetainedEvidenceByteBudget {
	readonly limit: number;
	used: number;
}

function fail(
	code: SemanticOperationBudgetErrorCode,
	message: string,
	details?: ConstructorParameters<typeof SemanticOperationBudgetError>[2]
): never {
	throw new SemanticOperationBudgetError(code, message, details);
}

function dataRecord(
	value: unknown,
	label: string,
	code: 'INVALID_INPUT' | 'INVALID_LIMITS'
): object {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) {
		return fail(code, `${label} must be a non-Proxy plain data object.`);
	}
	const prototype = Reflect.getPrototypeOf(value) as object | null;
	if (prototype !== Object.prototype && prototype !== null) {
		return fail(code, `${label} must have Object.prototype or null as its prototype.`);
	}
	return value;
}

function exactDataRecord(
	value: unknown,
	expectedKeys: readonly string[],
	label: string,
	code: 'INVALID_INPUT' | 'INVALID_LIMITS'
): Record<string, unknown> {
	const source = dataRecord(value, label, code);
	const ownKeys = Reflect.ownKeys(source);
	if (ownKeys.some((key) => typeof key !== 'string')) {
		return fail(code, `${label} must not contain symbol properties.`);
	}
	const actual = [...(ownKeys as string[])].sort();
	const expected = [...expectedKeys].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
		return fail(code, `${label} must contain exactly its declared fields.`);
	}
	const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
			return fail(code, `${label}.${key} must be an enumerable data property.`);
		}
		result[key] = descriptor.value;
	}
	return result;
}

function discriminant(
	value: unknown,
	key: string,
	label: string,
	code: 'INVALID_INPUT' | 'INVALID_LIMITS'
): unknown {
	const source = dataRecord(value, label, code);
	const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
		return fail(code, `${label}.${key} must be an enumerable data property.`);
	}
	return descriptor.value;
}

function inertDenseArray(
	value: unknown,
	label: string,
	maxLength: number,
	code: 'INVALID_INPUT' | 'INVALID_LIMITS',
	check: () => void,
	onOverflow?: (length: number) => never
): readonly unknown[] {
	if (!Array.isArray(value) || isProxy(value)) {
		return fail(code, `${label} must be a non-Proxy dense array.`);
	}
	if (value.length > maxLength) {
		return onOverflow?.(value.length) ?? fail(code, `${label} exceeds its maximum length.`);
	}
	check();
	const ownKeys = Reflect.ownKeys(value);
	check();
	if (ownKeys.length !== value.length + 1) {
		return fail(code, `${label} must not contain sparse, symbol, or extra properties.`);
	}
	for (const key of ownKeys) {
		check();
		if (key === 'length') continue;
		if (typeof key !== 'string') {
			return fail(code, `${label} must not contain sparse, symbol, or extra properties.`);
		}
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
			return fail(code, `${label} must not contain sparse, symbol, or extra properties.`);
		}
	}
	const result: unknown[] = [];
	for (let index = 0; index < value.length; index += 1) {
		check();
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
			return fail(code, `${label}[${index}] must be an enumerable data property.`);
		}
		result.push(descriptor.value);
	}
	return result;
}

function positiveLimit(value: unknown, key: SemanticBudgetKey): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		return fail('INVALID_LIMITS', `${key} must be a positive safe integer.`, { limitKey: key });
	}
	return value as number;
}

function safeAmount(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		return fail('INVALID_INPUT', `${label} must be a positive safe integer.`);
	}
	return value as number;
}

function scalarString(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value)) {
		return fail('INVALID_INPUT', `${label} must be a non-empty Unicode scalar string.`);
	}
	return value;
}

function limitScalarString(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value)) {
		return fail('INVALID_LIMITS', `${label} must be a non-empty Unicode scalar string.`);
	}
	return value;
}

function byteLengthWithin(
	value: string,
	label: string,
	limit: number,
	limitKey: SemanticOperationLimitKey,
	code: 'BUDGET_EXCEEDED' | 'INVALID_LIMITS',
	phase: SemanticOperationBudgetPhase | null = null
): number {
	const bytes = Buffer.byteLength(value, 'utf8');
	if (bytes > limit) {
		return fail(code, `${label} exceeds ${limitKey}.`, {
			attempted: bytes,
			limit,
			limitKey,
			...(phase === null ? {} : { phase })
		});
	}
	return bytes;
}

function addEvidenceBytes(
	used: number,
	addition: number,
	limit: number,
	code: 'BUDGET_EXCEEDED' | 'INVALID_LIMITS',
	phase: SemanticOperationBudgetPhase | null = null
): number {
	const attempted = used + addition;
	if (!Number.isSafeInteger(attempted) || attempted > limit) {
		return fail(code, 'Retained semantic-operation evidence exceeds maxSnapshotBytes.', {
			...(Number.isSafeInteger(attempted) ? { attempted } : {}),
			limit,
			limitKey: 'maxSnapshotBytes',
			...(phase === null ? {} : { phase })
		});
	}
	return attempted;
}

function enumValue<T extends string>(
	value: unknown,
	label: string,
	values: readonly T[],
	code: 'INVALID_INPUT' | 'INVALID_LIMITS' = 'INVALID_INPUT'
): T {
	if (typeof value !== 'string' || !values.includes(value as T)) {
		return fail(code, `${label} has an unsupported value.`);
	}
	return value as T;
}

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function freezeRecord<T extends object>(value: T): Readonly<T> {
	return Object.freeze(value);
}

function claimKey(reference: SemanticOperationClaimReference): string {
	return canonicalSemanticJson({ phase: reference.phase, population: reference.population });
}

function assertCanonicalRelativePath(value: string, phase: SemanticOperationBudgetPhase): void {
	if (
		value.includes('\\') ||
		value.startsWith('/') ||
		value.endsWith('/') ||
		value.includes('//') ||
		/^[A-Za-z]:/u.test(value) ||
		value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
	) {
		return fail('INVALID_INPUT', 'Query project key must be a canonical relative path.', {
			phase
		});
	}
}

function materializeBudgets(value: unknown): SemanticBudgets {
	const record = exactDataRecord(value, SEMANTIC_BUDGET_KEYS, 'SemanticBudgets', 'INVALID_LIMITS');
	const entries = SEMANTIC_BUDGET_KEYS.map(
		(key) => [key, positiveLimit(record[key], key)] as const
	);
	return Object.freeze(Object.fromEntries(entries)) as SemanticBudgets;
}

function materializeClaimReference(
	value: unknown,
	label: string,
	check: () => void
): SemanticOperationClaimReference {
	check();
	const record = exactDataRecord(value, CLAIM_REFERENCE_KEYS, label, 'INVALID_LIMITS');
	return freezeRecord({
		phase: enumValue(
			record.phase,
			`${label}.phase`,
			SEMANTIC_OPERATION_BUDGET_PHASES,
			'INVALID_LIMITS'
		),
		population: enumValue(
			record.population,
			`${label}.population`,
			SEMANTIC_OPERATION_POPULATION_KINDS,
			'INVALID_LIMITS'
		)
	});
}

function materializePlan(
	value: unknown,
	budgets: SemanticBudgets,
	retainedEvidence: RetainedEvidenceByteBudget,
	check: () => void
): SemanticOperationBudgetPlan {
	const record = exactDataRecord(value, PLAN_KEYS, 'SemanticOperationBudgetPlan', 'INVALID_LIMITS');
	const requiredValues = inertDenseArray(
		record.requiredClaims,
		'SemanticOperationBudgetPlan.requiredClaims',
		MAX_PLAN_CLAIMS,
		'INVALID_LIMITS',
		check
	);
	if (requiredValues.length === 0) {
		return fail('INVALID_LIMITS', 'Semantic operation budget plan requires at least one claim.');
	}
	const requiredClaims = requiredValues.map((value, index) => {
		check();
		const label = `SemanticOperationBudgetPlan.requiredClaims[${index}]`;
		const claim = exactDataRecord(value, REQUIRED_CLAIM_KEYS, label, 'INVALID_LIMITS');
		return freezeRecord({
			mode: enumValue(claim.mode, `${label}.mode`, ['COUNT', 'SUM'] as const, 'INVALID_LIMITS'),
			phase: enumValue(
				claim.phase,
				`${label}.phase`,
				SEMANTIC_OPERATION_BUDGET_PHASES,
				'INVALID_LIMITS'
			),
			population: enumValue(
				claim.population,
				`${label}.population`,
				SEMANTIC_OPERATION_POPULATION_KINDS,
				'INVALID_LIMITS'
			)
		});
	});
	requiredClaims.sort((left, right) => compare(claimKey(left), claimKey(right)));
	const requiredByKey = new Map<string, SemanticOperationRequiredClaim>();
	for (const claim of requiredClaims) {
		const key = claimKey(claim);
		if (requiredByKey.has(key)) {
			return fail(
				'INVALID_LIMITS',
				'Semantic operation budget plan contains a duplicate required claim.'
			);
		}
		requiredByKey.set(key, claim);
	}

	const groupValues = inertDenseArray(
		record.reconciliationGroups,
		'SemanticOperationBudgetPlan.reconciliationGroups',
		MAX_PLAN_CLAIMS,
		'INVALID_LIMITS',
		check
	);
	const reconciliationGroups = groupValues.map((value, index) => {
		check();
		const label = `SemanticOperationBudgetPlan.reconciliationGroups[${index}]`;
		const group = exactDataRecord(value, RECONCILIATION_GROUP_KEYS, label, 'INVALID_LIMITS');
		const id = limitScalarString(group.id, `${label}.id`);
		const idBytes = byteLengthWithin(
			id,
			`${label}.id`,
			budgets.maxCompilerInputMetadataBytes,
			'maxCompilerInputMetadataBytes',
			'INVALID_LIMITS'
		);
		retainedEvidence.used = addEvidenceBytes(
			retainedEvidence.used,
			idBytes,
			retainedEvidence.limit,
			'INVALID_LIMITS'
		);
		const references = inertDenseArray(
			group.claims,
			`${label}.claims`,
			MAX_PLAN_CLAIMS,
			'INVALID_LIMITS',
			check
		).map((reference, referenceIndex) =>
			materializeClaimReference(reference, `${label}.claims[${referenceIndex}]`, check)
		);
		if (references.length < 2) {
			return fail('INVALID_LIMITS', `${label} must reconcile at least two claims.`);
		}
		references.sort((left, right) => compare(claimKey(left), claimKey(right)));
		const definitions = references.map((reference, referenceIndex) => {
			if (referenceIndex > 0 && claimKey(references[referenceIndex - 1]!) === claimKey(reference)) {
				return fail('INVALID_LIMITS', `${label} contains a duplicate claim reference.`);
			}
			const definition = requiredByKey.get(claimKey(reference));
			if (definition === undefined) {
				return fail('INVALID_LIMITS', `${label} references a claim that is not required.`);
			}
			return definition;
		});
		const first = definitions[0]!;
		if (
			definitions.some(
				(definition) => definition.mode !== first.mode || definition.population !== first.population
			)
		) {
			return fail(
				'INVALID_LIMITS',
				`${label} must contain one population and one accounting mode.`
			);
		}
		return freezeRecord({ claims: Object.freeze(references), id });
	});
	reconciliationGroups.sort((left, right) => compare(left.id, right.id));
	for (let index = 1; index < reconciliationGroups.length; index += 1) {
		if (reconciliationGroups[index - 1]!.id === reconciliationGroups[index]!.id) {
			return fail('INVALID_LIMITS', 'Semantic operation budget plan contains duplicate group IDs.');
		}
	}
	return freezeRecord({
		reconciliationGroups: Object.freeze(reconciliationGroups),
		requiredClaims: Object.freeze(requiredClaims)
	});
}

function populationManifest(
	mode: SemanticOperationPopulationMode,
	evidence: readonly string[] | readonly SemanticOperationSumContribution[]
): string {
	return sha256(
		canonicalSemanticJson({
			domain: SEMANTIC_OPERATION_POPULATION_CLAIM_DOMAIN,
			evidence,
			mode
		})
	);
}

export class SemanticOperationBudgetLedger {
	readonly limits!: SemanticOperationBudgetLimits;
	readonly limitsDigest!: string;
	readonly plan!: SemanticOperationBudgetPlan;
	readonly planDigest!: string;

	private readonly clock!: SemanticOperationClock;
	private readonly deadlineMs!: number;
	private finalizedUsage: SemanticOperationBudgetUsage | null = null;
	private lastObservedMs!: number;
	private readonly populationClaims = new Map<string, SemanticOperationPopulationClaimUsage>();
	private poisoned = false;
	private readonly requiredClaims = new Map<string, SemanticOperationRequiredClaim>();
	private retainedEvidenceBytes!: number;
	private readonly startedAtMs!: number;
	private readonly uniqueQueries = new Map<string, StoredUniqueQuery>();
	private queryInvocations = 0;

	constructor(
		budgetsValue: SemanticBudgets,
		planValue: SemanticOperationBudgetPlan,
		startedAtMs: number,
		clock: SemanticOperationClock = Date.now
	) {
		if (typeof clock !== 'function' || isProxy(clock)) {
			return fail(
				'INVALID_LIMITS',
				'Semantic operation budget clock must be a non-Proxy function.'
			);
		}
		this.clock = clock;
		const budgets = materializeBudgets(budgetsValue);
		this.limits = freezeRecord({ budgets });
		if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) {
			return fail(
				'INVALID_LIMITS',
				'Semantic operation start must be a non-negative safe integer.'
			);
		}
		const deadlineMs = startedAtMs + this.limits.budgets.maxDurationMs;
		if (!Number.isSafeInteger(deadlineMs)) {
			return fail('INVALID_LIMITS', 'Semantic operation deadline must be a safe integer.', {
				limitKey: 'maxDurationMs'
			});
		}
		this.startedAtMs = startedAtMs;
		this.deadlineMs = deadlineMs;
		this.lastObservedMs = startedAtMs;
		this.assertWithinDeadline('REQUEST');
		const retainedEvidence: RetainedEvidenceByteBudget = {
			limit: budgets.maxSnapshotBytes,
			used: 0
		};
		this.plan = materializePlan(planValue, budgets, retainedEvidence, () =>
			this.assertWithinDeadline('REQUEST')
		);
		this.retainedEvidenceBytes = retainedEvidence.used;
		this.assertWithinDeadline('REQUEST');
		for (const claim of this.plan.requiredClaims) this.requiredClaims.set(claimKey(claim), claim);
		this.planDigest = sha256(
			canonicalSemanticJson({ domain: SEMANTIC_OPERATION_BUDGET_PLAN_DOMAIN, plan: this.plan })
		);
		this.limitsDigest = sha256(
			canonicalSemanticJson({
				budgets: this.limits.budgets,
				domain: SEMANTIC_OPERATION_BUDGET_LIMITS_DOMAIN,
				planDigest: this.planDigest
			})
		);
		this.assertWithinDeadline('REQUEST');
	}

	assertLimitsDigest(value: unknown): void {
		if (typeof value !== 'string' || !SHA256.test(value)) {
			return fail('INVALID_INPUT', 'Ledger limits digest must be a lowercase SHA-256 value.');
		}
		if (value !== this.limitsDigest) {
			return fail('LIMITS_MISMATCH', 'Ledger limits digest does not match its immutable limits.');
		}
	}

	claimPopulation(inputValue: SemanticOperationPopulationClaimInput): void {
		this.mutate((setPhase) => {
			const mode = enumValue(
				discriminant(inputValue, 'mode', 'SemanticOperationPopulationClaimInput', 'INVALID_INPUT'),
				'Population claim mode',
				['COUNT', 'SUM'] as const
			);
			const expectedKeys = mode === 'COUNT' ? COUNT_CLAIM_KEYS : SUM_CLAIM_KEYS;
			const record = exactDataRecord(
				inputValue,
				expectedKeys,
				'SemanticOperationPopulationClaimInput',
				'INVALID_INPUT'
			);
			const phase = enumValue(
				record.phase,
				'Population claim phase',
				SEMANTIC_OPERATION_BUDGET_PHASES
			);
			setPhase(phase);
			const population = enumValue(
				record.population,
				'Population claim kind',
				SEMANTIC_OPERATION_POPULATION_KINDS
			);
			const definition = this.requiredClaims.get(claimKey({ phase, population }));
			if (definition === undefined || definition.mode !== mode) {
				return fail('INVALID_INPUT', 'Population claim is not declared by the immutable plan.', {
					phase
				});
			}
			const limitKey = POPULATION_LIMIT_KEYS[population];
			const limit = this.limit(limitKey);
			const key = claimKey({ phase, population });
			const existing = this.populationClaims.get(key);
			let evidenceBytes = 0;
			let stored: SemanticOperationPopulationClaimUsage;
			if (mode === 'COUNT') {
				const values = inertDenseArray(
					record.members,
					'Population claim members',
					limit,
					'INVALID_INPUT',
					() => this.assertWithinDeadline(phase),
					(length) =>
						fail('BUDGET_EXCEEDED', `${population} population exceeds ${limitKey}.`, {
							attempted: length,
							limit,
							limitKey,
							phase
						})
				);
				const members = values.map((value, index) => {
					const label = `Population claim members[${index}]`;
					const member = scalarString(value, label);
					const memberBytes = byteLengthWithin(
						member,
						label,
						this.limits.budgets.maxCompilerInputMetadataBytes,
						'maxCompilerInputMetadataBytes',
						'BUDGET_EXCEEDED',
						phase
					);
					evidenceBytes = addEvidenceBytes(
						evidenceBytes,
						memberBytes,
						this.limits.budgets.maxSnapshotBytes,
						'BUDGET_EXCEEDED',
						phase
					);
					return member;
				});
				members.sort(compare);
				for (let index = 1; index < members.length; index += 1) {
					if (members[index - 1] === members[index]) {
						return fail('INVALID_INPUT', 'Population claim members must be unique.', { phase });
					}
				}
				if (
					existing !== undefined &&
					existing.mode === 'COUNT' &&
					existing.members.length === members.length &&
					existing.members.every((member, index) => member === members[index])
				) {
					return;
				}
				if (existing !== undefined) {
					return fail(
						'CLAIM_CONFLICT',
						`${phase} already has an incompatible ${population} claim.`,
						{ phase }
					);
				}
				const nextRetainedEvidenceBytes = addEvidenceBytes(
					this.retainedEvidenceBytes,
					evidenceBytes,
					this.limits.budgets.maxSnapshotBytes,
					'BUDGET_EXCEEDED',
					phase
				);
				const frozenMembers = Object.freeze(members);
				stored = freezeRecord({
					amount: frozenMembers.length,
					limit,
					limitKey,
					manifestSha256: populationManifest('COUNT', frozenMembers),
					members: frozenMembers,
					mode,
					phase,
					population,
					remaining: limit - frozenMembers.length
				});
				this.populationClaims.set(key, stored);
				this.retainedEvidenceBytes = nextRetainedEvidenceBytes;
			} else {
				const values = inertDenseArray(
					record.contributions,
					'Population claim contributions',
					limit,
					'INVALID_INPUT',
					() => this.assertWithinDeadline(phase),
					(length) =>
						fail('BUDGET_EXCEEDED', `${population} population exceeds ${limitKey}.`, {
							attempted: length,
							limit,
							limitKey,
							phase
						})
				);
				let amount = 0;
				const contributions = values.map((value, index) => {
					this.assertWithinDeadline(phase);
					const contribution = exactDataRecord(
						value,
						CONTRIBUTION_KEYS,
						`Population claim contributions[${index}]`,
						'INVALID_INPUT'
					);
					const addition = safeAmount(
						contribution.amount,
						`Population claim contributions[${index}].amount`
					);
					const attempted = amount + addition;
					if (!Number.isSafeInteger(attempted) || attempted > limit) {
						return fail('BUDGET_EXCEEDED', `${population} population exceeds ${limitKey}.`, {
							...(Number.isSafeInteger(attempted) ? { attempted } : {}),
							limit,
							limitKey,
							phase
						});
					}
					amount = attempted;
					const label = `Population claim contributions[${index}].key`;
					const key = scalarString(contribution.key, label);
					const keyBytes = byteLengthWithin(
						key,
						label,
						this.limits.budgets.maxCompilerInputMetadataBytes,
						'maxCompilerInputMetadataBytes',
						'BUDGET_EXCEEDED',
						phase
					);
					evidenceBytes = addEvidenceBytes(
						evidenceBytes,
						keyBytes,
						this.limits.budgets.maxSnapshotBytes,
						'BUDGET_EXCEEDED',
						phase
					);
					return freezeRecord({
						amount: addition,
						key
					});
				});
				contributions.sort((left, right) => compare(left.key, right.key));
				for (let index = 1; index < contributions.length; index += 1) {
					if (contributions[index - 1]!.key === contributions[index]!.key) {
						return fail('INVALID_INPUT', 'Population contribution keys must be unique.', {
							phase
						});
					}
				}
				if (
					existing !== undefined &&
					existing.mode === 'SUM' &&
					existing.contributions.length === contributions.length &&
					existing.contributions.every(
						(contribution, index) =>
							contribution.amount === contributions[index]!.amount &&
							contribution.key === contributions[index]!.key
					)
				) {
					return;
				}
				if (existing !== undefined) {
					return fail(
						'CLAIM_CONFLICT',
						`${phase} already has an incompatible ${population} claim.`,
						{ phase }
					);
				}
				const nextRetainedEvidenceBytes = addEvidenceBytes(
					this.retainedEvidenceBytes,
					evidenceBytes,
					this.limits.budgets.maxSnapshotBytes,
					'BUDGET_EXCEEDED',
					phase
				);
				const frozenContributions = Object.freeze(contributions);
				stored = freezeRecord({
					amount,
					contributions: frozenContributions,
					limit,
					limitKey,
					manifestSha256: populationManifest('SUM', frozenContributions),
					mode,
					phase,
					population,
					remaining: limit - amount
				});
				this.populationClaims.set(key, stored);
				this.retainedEvidenceBytes = nextRetainedEvidenceBytes;
			}
		});
	}

	recordQueryInvocation(inputValue: SemanticOperationQueryInvocationInput): boolean {
		return this.mutate((setPhase) => {
			const record = exactDataRecord(
				inputValue,
				QUERY_INVOCATION_KEYS,
				'SemanticOperationQueryInvocationInput',
				'INVALID_INPUT'
			);
			const phase = enumValue(
				record.phase,
				'Query invocation phase',
				SEMANTIC_OPERATION_BUDGET_PHASES
			);
			setPhase(phase);
			const family = enumValue(
				record.family,
				'Query invocation family',
				SEMANTIC_OPERATION_QUERY_FAMILIES
			);
			const projectKey = scalarString(record.projectKey, 'Query invocation project key');
			assertCanonicalRelativePath(projectKey, phase);
			if (projectKey.length > this.limits.budgets.maxPathCharacters) {
				return fail('BUDGET_EXCEEDED', 'Query project key exceeds maxPathCharacters.', {
					attempted: projectKey.length,
					limit: this.limits.budgets.maxPathCharacters,
					limitKey: 'maxPathCharacters',
					phase
				});
			}
			const projectBytes = byteLengthWithin(
				projectKey,
				'Query invocation project key',
				this.limits.budgets.maxCompilerInputMetadataBytes,
				'maxCompilerInputMetadataBytes',
				'BUDGET_EXCEEDED',
				phase
			);
			const queryKey = scalarString(record.queryKey, 'Query invocation key');
			const queryBytes = byteLengthWithin(
				queryKey,
				'Query invocation key',
				this.limits.budgets.maxCompilerInputMetadataBytes,
				'maxCompilerInputMetadataBytes',
				'BUDGET_EXCEEDED',
				phase
			);
			addEvidenceBytes(
				projectBytes,
				queryBytes,
				this.limits.budgets.maxSnapshotBytes,
				'BUDGET_EXCEEDED',
				phase
			);
			const identity =
				family === 'COMPILER_HOST'
					? canonicalSemanticJson({ family, queryKey })
					: canonicalSemanticJson({ family, projectKey, queryKey });
			const existing = this.uniqueQueries.get(identity);
			const invocationIdentity = canonicalSemanticJson({ phase, projectKey });
			const existingInvocation = existing?.invocations.get(invocationIdentity);
			const attemptedInvocations = this.queryInvocations + 1;
			const invocationLimit = this.limits.budgets.maxCompilerQueryInvocations;
			if (!Number.isSafeInteger(attemptedInvocations) || attemptedInvocations > invocationLimit) {
				return fail('BUDGET_EXCEEDED', 'Query invocations exceed maxCompilerQueryInvocations.', {
					...(Number.isSafeInteger(attemptedInvocations)
						? { attempted: attemptedInvocations }
						: {}),
					limit: invocationLimit,
					limitKey: 'maxCompilerQueryInvocations',
					phase
				});
			}
			if (
				existing === undefined &&
				this.uniqueQueries.size >= this.limits.budgets.maxCompilerQueries
			) {
				return fail('BUDGET_EXCEEDED', 'Unique-query union exceeds maxCompilerQueries.', {
					attempted: this.uniqueQueries.size + 1,
					limit: this.limits.budgets.maxCompilerQueries,
					limitKey: 'maxCompilerQueries',
					phase
				});
			}
			let retainedAddition = existing === undefined ? queryBytes : 0;
			if (existingInvocation === undefined) retainedAddition += projectBytes;
			const nextRetainedEvidenceBytes = addEvidenceBytes(
				this.retainedEvidenceBytes,
				retainedAddition,
				this.limits.budgets.maxSnapshotBytes,
				'BUDGET_EXCEEDED',
				phase
			);
			const invocations = new Map(existing?.invocations ?? []);
			invocations.set(
				invocationIdentity,
				freezeRecord({
					amount: (existingInvocation?.amount ?? 0) + 1,
					phase,
					projectKey
				})
			);
			this.uniqueQueries.set(identity, { family, invocations, queryKey });
			this.retainedEvidenceBytes = nextRetainedEvidenceBytes;
			this.queryInvocations = attemptedInvocations;
			return existing === undefined;
		});
	}

	finalize(): SemanticOperationBudgetUsage {
		if (this.finalizedUsage !== null) {
			this.assertWithinDeadline(null);
			return this.finalizedUsage;
		}
		this.assertActive();
		try {
			this.assertWithinDeadline(null);
			for (const required of this.plan.requiredClaims) {
				this.assertWithinDeadline(required.phase);
				if (!this.populationClaims.has(claimKey(required))) {
					return fail(
						'INCOMPLETE_CLAIMS',
						`Required ${required.phase} ${required.population} claim is missing.`,
						{ phase: required.phase }
					);
				}
			}
			const reconciliations = Object.freeze(
				this.plan.reconciliationGroups.map((group) => {
					this.assertWithinDeadline(null);
					const claims = group.claims.map((reference) =>
						this.populationClaims.get(claimKey(reference))!
					);
					const first = claims[0]!;
					if (
						claims.some(
							(claim) =>
								claim.mode !== first.mode ||
								claim.amount !== first.amount ||
								claim.manifestSha256 !== first.manifestSha256
						)
					) {
						return fail(
							'RECONCILIATION_FAILED',
							`Population reconciliation group ${group.id} is incompatible.`
						);
					}
					return freezeRecord({
						claims: group.claims,
						id: group.id,
						manifestSha256: first.manifestSha256
					});
				})
			);
			const populationClaims = Object.freeze(
				[...this.populationClaims.values()].sort(
					(left, right) =>
						compare(left.phase, right.phase) || compare(left.population, right.population)
				)
			);
			const queryMembers = Object.freeze(
				[...this.uniqueQueries.values()]
					.map((query) => {
						this.assertWithinDeadline(null);
						const invocations = Object.freeze(
							[...query.invocations.values()].sort(
								(left, right) =>
									compare(left.projectKey, right.projectKey) || compare(left.phase, right.phase)
							)
						);
						return freezeRecord({
							family: query.family,
							invocations,
							queryKeySha256: sha256(query.queryKey)
						});
					})
					.sort(
						(left, right) =>
							compare(left.family, right.family) ||
							compare(left.queryKeySha256, right.queryKeySha256) ||
							compare(
								canonicalSemanticJson(left.invocations),
								canonicalSemanticJson(right.invocations)
							)
					)
			);
			const queryLimit = this.limits.budgets.maxCompilerQueries;
			const uniqueQueries = freezeRecord({
				count: queryMembers.length,
				limit: queryLimit,
				manifestSha256: sha256(canonicalSemanticJson(queryMembers)),
				members: queryMembers,
				remaining: queryLimit - queryMembers.length
			});
			const workByPhase = new Map<SemanticOperationBudgetPhase, number>();
			for (const query of queryMembers) {
				for (const invocation of query.invocations) {
					workByPhase.set(
						invocation.phase,
						(workByPhase.get(invocation.phase) ?? 0) + invocation.amount
					);
				}
			}
			const workCharges = Object.freeze(
				[...workByPhase.entries()]
					.map(([phase, amount]) =>
						freezeRecord({ amount, kind: 'COMPILER_QUERY_INVOCATIONS' as const, phase })
					)
					.sort((left, right) => compare(left.phase, right.phase))
			);
			const invocationLimit = this.limits.budgets.maxCompilerQueryInvocations;
			const workTotals = Object.freeze([
				freezeRecord({
					amount: this.queryInvocations,
					kind: 'COMPILER_QUERY_INVOCATIONS' as const,
					limit: invocationLimit,
					limitKey: 'maxCompilerQueryInvocations' as const,
					remaining: invocationLimit - this.queryInvocations
				})
			]);
			if (
				workCharges.reduce((total, charge) => total + charge.amount, 0) !== this.queryInvocations
			) {
				return fail('RECONCILIATION_FAILED', 'Query invocation evidence does not reconcile.');
			}
			const body = {
				domain: SEMANTIC_OPERATION_BUDGET_USAGE_DOMAIN,
				limitsDigest: this.limitsDigest,
				planDigest: this.planDigest,
				populationClaims,
				reconciliations,
				uniqueQueries,
				workCharges,
				workTotals
			};
			const usage = freezeRecord({
				...body,
				usageDigest: sha256(canonicalSemanticJson(body))
			});
			this.assertWithinDeadline(null);
			this.finalizedUsage = usage;
			return usage;
		} catch (error) {
			this.poisoned = true;
			return this.rethrowTyped(error, null);
		}
	}

	private assertActive(): void {
		if (this.poisoned) return fail('POISONED', 'Semantic operation budget ledger is poisoned.');
		if (this.finalizedUsage !== null) {
			return fail('FINALIZED', 'Semantic operation budget ledger is finalized.');
		}
	}

	private assertWithinDeadline(phase: SemanticOperationBudgetPhase | null): void {
		let now: unknown;
		try {
			now = this.clock();
		} catch {
			return fail('INVALID_INPUT', 'Semantic operation budget clock failed closed.', {
				...(phase === null ? {} : { phase })
			});
		}
		if (!Number.isSafeInteger(now) || (now as number) < this.lastObservedMs) {
			return fail(
				'INVALID_INPUT',
				'Semantic operation budget clock must be monotonic safe-integer time.',
				{
					...(phase === null ? {} : { phase })
				}
			);
		}
		this.lastObservedMs = now as number;
		if ((now as number) > this.deadlineMs) {
			return fail('BUDGET_EXCEEDED', 'Semantic operation exceeded maxDurationMs.', {
				attempted: (now as number) - this.startedAtMs,
				limit: this.limits.budgets.maxDurationMs,
				limitKey: 'maxDurationMs',
				...(phase === null ? {} : { phase })
			});
		}
	}

	private limit(key: SemanticOperationLimitKey): number {
		return this.limits.budgets[key];
	}

	private mutate<T>(action: (setPhase: (phase: SemanticOperationBudgetPhase) => void) => T): T {
		this.assertActive();
		let phase: SemanticOperationBudgetPhase | null = null;
		try {
			this.assertWithinDeadline(phase);
			const result = action((value) => {
				phase = value;
			});
			this.assertWithinDeadline(phase);
			return result;
		} catch (error) {
			this.poisoned = true;
			return this.rethrowTyped(error, phase);
		}
	}

	private rethrowTyped(error: unknown, phase: SemanticOperationBudgetPhase | null): never {
		if (error instanceof SemanticOperationBudgetError) throw error;
		return fail('INVALID_INPUT', 'Semantic operation budget ledger failed closed.', {
			...(phase === null ? {} : { phase })
		});
	}
}

export function createSemanticOperationBudgetLedger(
	budgets: SemanticBudgets,
	plan: SemanticOperationBudgetPlan,
	startedAtMs: number,
	clock: SemanticOperationClock = Date.now
): SemanticOperationBudgetLedger {
	return new SemanticOperationBudgetLedger(budgets, plan, startedAtMs, clock);
}
