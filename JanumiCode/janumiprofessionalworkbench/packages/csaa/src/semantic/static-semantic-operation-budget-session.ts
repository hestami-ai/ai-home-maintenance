import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';
import type {
	CompilerInputObservation,
	SemanticBudgets,
	SemanticDiagnosticMessage,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import {
	takeCompilerInputOperationBudgetWitness,
	type CompilerInputOperationBudgetWitness
} from '../providers/typescript/compiler-input-journal.js';
import {
	takeStaticRawExtractionBudgetEvidence,
	type StaticRawExtractionBudgetEvidence
} from '../providers/typescript/extract-static-raw.js';
import { canonicalSemanticJson } from './canonical.js';
import {
	SEMANTIC_OPERATION_BUDGET_PHASES,
	createSemanticOperationBudgetLedger,
	type SemanticOperationBudgetPhase,
	type SemanticOperationBudgetPlan,
	type SemanticOperationBudgetUsage,
	type SemanticOperationClock,
	type SemanticOperationPopulationClaimInput,
	type SemanticOperationPopulationKind,
	type SemanticOperationPopulationMode,
	type SemanticOperationQueryInvocationInput
} from './operation-budget-ledger.js';
import type { StaticSemanticOperationBudgetProviderBinding } from './operation-budget-provider-binding.js';
import {
	takeStaticSemanticValidationBudgetEvidence,
	type StaticSemanticValidationBudgetEvidence
} from './validate-snapshot.js';

export const STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION =
	'jan-csaa-static-semantic-operation-budget-plan/1.0.0' as const;

/**
 * Compiler-input CAPTURE/RECHECK populations, CAPTURE/replay CompilerHost
 * multiplicity, CAPTURE/EXTRACT raw TypeChecker work, and final VALIDATE
 * populations are provider-issued and consumed by the production builder.
 * Physical live-context recheck reads are freshness verification, not
 * CompilerHost invocations, and are not relabelled as compiler queries.
 */
export const STATIC_SEMANTIC_OPERATION_BUDGET_PROVIDER_WITNESS_STATUS =
	'COMPILER_INPUT_RAW_EXTRACTION_AND_VALIDATION' as const;
export const STATIC_SEMANTIC_OPERATION_BUDGET_QUERY_RECONCILIATION_STATUS =
	'CAPTURE_AND_REPLAY_HOST_PLUS_CAPTURE_AND_EXTRACT_TYPE_CHECKER_RECORDED' as const;
export const STATIC_SEMANTIC_OPERATION_BUDGET_CALLER_INTEGRATION_STATUS =
	'FULLY_INTEGRATED' as const;
export const STATIC_SEMANTIC_OPERATION_BUDGET_RAW_VALIDATION_WITNESS_STATUS =
	'RAW_AND_VALIDATION_INTEGRATED' as const;

export interface StaticSemanticOperationBudgetClaimMatrixRow {
	readonly mode: SemanticOperationPopulationMode;
	readonly phases: readonly SemanticOperationBudgetPhase[];
	readonly population: SemanticOperationPopulationKind;
	readonly reconciliationId: string | null;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const child of Object.values(value)) deepFreeze(child, seen);
	return Object.freeze(value);
}

function compilerInputBudgetQueryKey(observation: CompilerInputObservation): string {
	return observation.operation === 'READ_DIRECTORY'
		? canonicalSemanticJson({
				depth: observation.depth,
				excludes: observation.excludes,
				extensions: observation.extensions,
				includes: observation.includes,
				logicalPath: observation.logicalPath,
				operation: observation.operation
			})
		: canonicalSemanticJson({
				logicalPath: observation.logicalPath,
				operation: observation.operation
			});
}

function diagnosticMessageCharacters(message: SemanticDiagnosticMessage): number {
	let characters = 0;
	const pending: SemanticDiagnosticMessage[] = [message];
	while (pending.length > 0) {
		const current = pending.pop()!;
		characters += current.textLength;
		pending.push(...current.next);
	}
	return characters;
}

export const STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX = deepFreeze([
	{
		mode: 'COUNT',
		phases: ['MATERIALIZE', 'CAPTURE', 'RECHECK', 'EXTRACT', 'VALIDATE'],
		population: 'PROJECTS',
		reconciliationId: 'projects-materialize-capture-recheck-extract-validate'
	},
	{
		mode: 'COUNT',
		phases: ['CAPTURE', 'RECHECK', 'VALIDATE'],
		population: 'COMPILER_INPUTS',
		reconciliationId: 'compiler-inputs-capture-recheck-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'RECHECK', 'VALIDATE'],
		population: 'COMPILER_INPUT_METADATA_BYTES',
		reconciliationId: 'compiler-input-metadata-bytes-capture-recheck-validate'
	},
	{
		mode: 'COUNT',
		phases: ['CAPTURE', 'RECHECK', 'VALIDATE'],
		population: 'CONTEXT_FILES',
		reconciliationId: 'context-files-capture-recheck-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'RECHECK', 'VALIDATE'],
		population: 'CONTEXT_BYTES',
		reconciliationId: 'context-bytes-capture-recheck-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'RECHECK', 'VALIDATE'],
		population: 'DIRECTORY_ENTRIES',
		reconciliationId: 'directory-entries-capture-recheck-validate'
	},
	{
		mode: 'COUNT',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'SOURCES',
		reconciliationId: 'sources-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'AST_NODES',
		reconciliationId: 'ast-nodes-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'SCOPES',
		reconciliationId: 'scopes-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'DIAGNOSTICS',
		reconciliationId: 'diagnostics-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'DIAGNOSTIC_CHARACTERS',
		reconciliationId: 'diagnostic-characters-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['CAPTURE', 'EXTRACT', 'VALIDATE'],
		population: 'COMPILER_FACTS',
		reconciliationId: 'compiler-facts-capture-extract-validate'
	},
	{
		mode: 'SUM',
		phases: ['VALIDATE'],
		population: 'SNAPSHOT_BYTES',
		reconciliationId: null
	}
] as const satisfies readonly StaticSemanticOperationBudgetClaimMatrixRow[]);

function fixedPlan(): SemanticOperationBudgetPlan {
	const requiredClaims = STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX.flatMap((row) =>
		row.phases.map((phase) => ({ mode: row.mode, phase, population: row.population }))
	);
	const reconciliationGroups = STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX.flatMap((row) =>
		row.reconciliationId === null
			? []
			: [
					{
						claims: row.phases.map((phase) => ({ phase, population: row.population })),
						id: row.reconciliationId
					}
				]
	);
	return deepFreeze({ reconciliationGroups, requiredClaims });
}

export const STATIC_SEMANTIC_OPERATION_BUDGET_PLAN = fixedPlan();

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export const STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256 = sha256(
	canonicalSemanticJson({
		plan: STATIC_SEMANTIC_OPERATION_BUDGET_PLAN,
		version: STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION
	})
);

export type StaticSemanticOperationBudgetSessionErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'FINALIZED'
	| 'INVALID_CLOCK'
	| 'INVALID_SESSION'
	| 'INVALID_WITNESS'
	| 'POISONED'
	| 'WITNESS_PHASE_MISMATCH'
	| 'WITNESS_REUSED'
	| 'WITNESS_SCOPE_MISMATCH';

export class StaticSemanticOperationBudgetSessionError extends Error {
	constructor(
		readonly code: StaticSemanticOperationBudgetSessionErrorCode,
		message: string,
		readonly phase: SemanticOperationBudgetPhase | null = null
	) {
		super(message);
		this.name = 'StaticSemanticOperationBudgetSessionError';
	}
}

declare const staticSemanticOperationBudgetWitnessBrand: unique symbol;
export interface StaticSemanticOperationBudgetWitness {
	readonly [staticSemanticOperationBudgetWitnessBrand]: true;
}

export type { StaticSemanticOperationBudgetProviderBinding } from './operation-budget-provider-binding.js';

export interface StaticSemanticOperationBudgetWitnessInputForTesting {
	readonly phase: SemanticOperationBudgetPhase;
	readonly populationClaims: readonly SemanticOperationPopulationClaimInput[];
	readonly queryInvocations: readonly SemanticOperationQueryInvocationInput[];
}

export interface StaticSemanticOperationBudgetSession {
	readonly limitsDigest: string;
	readonly planDigest: typeof STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256;
	readonly planVersion: typeof STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION;
	acceptWitness(
		expectedPhase: SemanticOperationBudgetPhase,
		witness: StaticSemanticOperationBudgetWitness
	): void;
	acceptCompilerInputWitness(
		expectedPhase: 'CAPTURE' | 'RECHECK',
		witness: CompilerInputOperationBudgetWitness
	): void;
	acceptMaterializedSubject(subject: FrozenSubject): void;
	acceptRawExtractionEvidence(
		expectedPhase: 'CAPTURE' | 'EXTRACT',
		evidence: StaticRawExtractionBudgetEvidence
	): void;
	acceptValidationEvidence(
		snapshot: StaticSemanticSnapshot,
		evidence: StaticSemanticValidationBudgetEvidence
	): void;
	checkpoint(phase: SemanticOperationBudgetPhase): void;
	finalize(): SemanticOperationBudgetUsage;
	providerBinding(): StaticSemanticOperationBudgetProviderBinding;
}

interface ClockState {
	readonly deadlineMs: number;
	lastObservedMs: number;
	read(): number;
}

interface SessionState {
	readonly budgetsDigest: string;
	finalizedUsage: SemanticOperationBudgetUsage | null;
	readonly clock: ClockState;
	readonly ledger: ReturnType<typeof createSemanticOperationBudgetLedger>;
	poisoned: boolean;
	readonly providerBinding: StaticSemanticOperationBudgetProviderBinding;
}

interface WitnessState {
	consumed: boolean;
	readonly limitsDigest: string;
	readonly phase: SemanticOperationBudgetPhase;
	readonly planDigest: string;
	readonly populationClaims: readonly SemanticOperationPopulationClaimInput[];
	readonly queryInvocations: readonly SemanticOperationQueryInvocationInput[];
	readonly session: StaticSemanticOperationBudgetSessionImpl;
}

const sessionStates = new WeakMap<object, SessionState>();
const witnessStates = new WeakMap<object, WitnessState>();

function registeredPhase(value: unknown): value is SemanticOperationBudgetPhase {
	return (
		typeof value === 'string' &&
		(SEMANTIC_OPERATION_BUDGET_PHASES as readonly string[]).includes(value)
	);
}

function sessionState(value: unknown): SessionState {
	const state = value !== null && typeof value === 'object' ? sessionStates.get(value) : undefined;
	if (state === undefined)
		throw new StaticSemanticOperationBudgetSessionError(
			'INVALID_SESSION',
			'Static semantic operation budget session is not provider-issued.'
		);
	return state;
}

function poisonAndThrow(
	state: SessionState,
	code: StaticSemanticOperationBudgetSessionErrorCode,
	message: string,
	phase: SemanticOperationBudgetPhase | null = null
): never {
	state.poisoned = true;
	throw new StaticSemanticOperationBudgetSessionError(code, message, phase);
}

function assertActive(state: SessionState): void {
	if (state.poisoned)
		throw new StaticSemanticOperationBudgetSessionError(
			'POISONED',
			'Static semantic operation budget session is poisoned.'
		);
	if (state.finalizedUsage !== null)
		throw new StaticSemanticOperationBudgetSessionError(
			'FINALIZED',
			'Static semantic operation budget session is finalized.'
		);
}

class StaticSemanticOperationBudgetSessionImpl implements StaticSemanticOperationBudgetSession {
	readonly limitsDigest: string;
	readonly planDigest = STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256;
	readonly planVersion = STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION;

	constructor(ledger: ReturnType<typeof createSemanticOperationBudgetLedger>) {
		this.limitsDigest = ledger.limitsDigest;
	}

	acceptWitness(
		expectedPhase: SemanticOperationBudgetPhase,
		witness: StaticSemanticOperationBudgetWitness
	): void {
		const state = sessionState(this);
		assertActive(state);
		if (!registeredPhase(expectedPhase))
			return poisonAndThrow(
				state,
				'WITNESS_PHASE_MISMATCH',
				'Static semantic operation budget witness expected phase is not registered.'
			);
		const witnessState =
			witness !== null && typeof witness === 'object' ? witnessStates.get(witness) : undefined;
		if (witnessState === undefined)
			return poisonAndThrow(
				state,
				'INVALID_WITNESS',
				'Static semantic operation budget witness is not issuer-owned.',
				expectedPhase
			);
		if (witnessState.session !== this)
			return poisonAndThrow(
				state,
				'WITNESS_SCOPE_MISMATCH',
				'Static semantic operation budget witness belongs to another operation session.',
				expectedPhase
			);
		if (witnessState.consumed)
			return poisonAndThrow(
				state,
				'WITNESS_REUSED',
				'Static semantic operation budget witness is single-use.',
				expectedPhase
			);
		if (
			witnessState.phase !== expectedPhase ||
			witnessState.limitsDigest !== state.ledger.limitsDigest ||
			witnessState.planDigest !== STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256
		)
			return poisonAndThrow(
				state,
				'WITNESS_PHASE_MISMATCH',
				'Static semantic operation budget witness does not bind the expected phase and plan.',
				expectedPhase
			);

		witnessState.consumed = true;
		try {
			for (const claim of witnessState.populationClaims) state.ledger.claimPopulation(claim);
			for (const query of witnessState.queryInvocations) state.ledger.recordQueryInvocation(query);
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	acceptCompilerInputWitness(
		expectedPhase: 'CAPTURE' | 'RECHECK',
		witness: CompilerInputOperationBudgetWitness
	): void {
		const state = sessionState(this);
		assertActive(state);
		try {
			const evidence = takeCompilerInputOperationBudgetWitness(
				witness,
				state.providerBinding,
				expectedPhase,
				state.budgetsDigest
			);
			for (const claim of evidence.populationClaims) state.ledger.claimPopulation(claim);
			for (const charge of evidence.queryCharges)
				for (let invocation = 0; invocation < charge.invocationCount; invocation += 1)
					state.ledger.recordQueryInvocation({
						family: 'COMPILER_HOST',
						phase: evidence.phase,
						projectKey: charge.projectKey,
						queryKey: charge.queryKey
					});
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	acceptMaterializedSubject(subject: FrozenSubject): void {
		const state = sessionState(this);
		assertActive(state);
		try {
			state.ledger.claimPopulation({
				members: subject.projects.map((project) => project.configPath),
				mode: 'COUNT',
				phase: 'MATERIALIZE',
				population: 'PROJECTS'
			});
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	acceptRawExtractionEvidence(
		expectedPhase: 'CAPTURE' | 'EXTRACT',
		evidence: StaticRawExtractionBudgetEvidence
	): void {
		const state = sessionState(this);
		assertActive(state);
		try {
			const providerEvidence = takeStaticRawExtractionBudgetEvidence(
				evidence,
				state.providerBinding,
				expectedPhase,
				state.budgetsDigest
			);
			const projects = providerEvidence.projects;
			state.ledger.claimPopulation({
				members: projects.map((project) => project.projectKey),
				mode: 'COUNT',
				phase: expectedPhase,
				population: 'PROJECTS'
			});
			state.ledger.claimPopulation({
				members: projects.flatMap((project) => project.sourceMembers),
				mode: 'COUNT',
				phase: expectedPhase,
				population: 'SOURCES'
			});
			for (const [population, select] of [
				['AST_NODES', (project: (typeof projects)[number]) => project.astNodes],
				['SCOPES', (project: (typeof projects)[number]) => project.scopes],
				['DIAGNOSTICS', (project: (typeof projects)[number]) => project.diagnostics],
				[
					'DIAGNOSTIC_CHARACTERS',
					(project: (typeof projects)[number]) => project.diagnosticCharacters
				],
				['COMPILER_FACTS', (project: (typeof projects)[number]) => project.compilerFacts]
			] as const) {
				state.ledger.claimPopulation({
					contributions: projects.flatMap((project) => {
						const amount = select(project);
						return amount === 0 ? [] : [{ amount, key: project.projectKey }];
					}),
					mode: 'SUM',
					phase: expectedPhase,
					population
				});
			}
			for (const project of projects)
				for (const charge of project.compilerQueries)
					for (let invocation = 0; invocation < charge.invocationCount; invocation += 1)
						state.ledger.recordQueryInvocation({
							family: 'TYPE_CHECKER',
							phase: expectedPhase,
							projectKey: project.projectKey,
							queryKey: charge.queryKey
						});
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	acceptValidationEvidence(
		snapshot: StaticSemanticSnapshot,
		evidence: StaticSemanticValidationBudgetEvidence
	): void {
		const state = sessionState(this);
		assertActive(state);
		try {
			const providerEvidence = takeStaticSemanticValidationBudgetEvidence(
				evidence,
				state.providerBinding,
				snapshot,
				state.budgetsDigest
			);
			const projectKeyById = new Map<string, string>(
				snapshot.projects.map((project) => [project.id, project.configPath])
			);
			const sourceProjectIdById = new Map<string, string>(
				snapshot.sources.map((source) => [source.id, source.projectId])
			);
			const symbolProjectIdById = new Map<string, string>(
				snapshot.symbols.map((symbol) => [symbol.id, symbol.projectId])
			);
			const signatureProjectIdById = new Map<string, string>(
				snapshot.signatures.map((signature) => [signature.id, signature.projectId])
			);
			const projectKey = (projectId: string): string => {
				const key = projectKeyById.get(projectId);
				if (key === undefined)
					throw new StaticSemanticOperationBudgetSessionError(
						'INVALID_WITNESS',
						'Validated budget evidence references an absent project.',
						'VALIDATE'
					);
				return key;
			};
			const sourceProjectId = (sourceId: string): string => {
				const projectId = sourceProjectIdById.get(sourceId);
				if (projectId === undefined)
					throw new StaticSemanticOperationBudgetSessionError(
						'INVALID_WITNESS',
						'Validated budget evidence references an absent source.',
						'VALIDATE'
					);
				return projectId;
			};
			const symbolProjectId = (symbolId: string): string => {
				const projectId = symbolProjectIdById.get(symbolId);
				if (projectId === undefined)
					throw new StaticSemanticOperationBudgetSessionError(
						'INVALID_WITNESS',
						'Validated budget evidence references an absent symbol.',
						'VALIDATE'
					);
				return projectId;
			};
			const signatureProjectId = (signatureId: string): string => {
				const projectId = signatureProjectIdById.get(signatureId);
				if (projectId === undefined)
					throw new StaticSemanticOperationBudgetSessionError(
						'INVALID_WITNESS',
						'Validated budget evidence references an absent signature.',
						'VALIDATE'
					);
				return projectId;
			};
			const contributions = <T>(
				records: readonly T[],
				projectIdFor: (record: T) => string,
				amountFor: (record: T) => number = () => 1
			): readonly { readonly amount: number; readonly key: string }[] => {
				const totals = new Map<string, number>();
				for (const record of records) {
					const key = projectKey(projectIdFor(record));
					totals.set(key, (totals.get(key) ?? 0) + amountFor(record));
				}
				return [...totals.entries()]
					.filter(([, amount]) => amount > 0)
					.map(([key, amount]) => ({ amount, key }));
			};
			const liveContext = snapshot.compilerInputs.filter(
				(
					observation
				): observation is Extract<
					CompilerInputObservation,
					{ operation: 'READ_FILE'; result: 'PRESENT' }
				> =>
					observation.operation === 'READ_FILE' &&
					observation.result === 'PRESENT' &&
					observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT'
			);
			state.ledger.claimPopulation({
				members: snapshot.projects.map((project) => project.configPath),
				mode: 'COUNT',
				phase: 'VALIDATE',
				population: 'PROJECTS'
			});
			state.ledger.claimPopulation({
				members: snapshot.compilerInputs.map(compilerInputBudgetQueryKey),
				mode: 'COUNT',
				phase: 'VALIDATE',
				population: 'COMPILER_INPUTS'
			});
			state.ledger.claimPopulation({
				contributions: [
					{
						amount: Buffer.byteLength(canonicalSemanticJson(snapshot.compilerInputs), 'utf8'),
						key: 'canonical-compiler-input-array'
					}
				],
				mode: 'SUM',
				phase: 'VALIDATE',
				population: 'COMPILER_INPUT_METADATA_BYTES'
			});
			state.ledger.claimPopulation({
				members: liveContext.map((observation) => observation.id),
				mode: 'COUNT',
				phase: 'VALIDATE',
				population: 'CONTEXT_FILES'
			});
			state.ledger.claimPopulation({
				contributions: liveContext.flatMap((observation) =>
					observation.contentBytes > 0
						? [{ amount: observation.contentBytes, key: observation.id }]
						: []
				),
				mode: 'SUM',
				phase: 'VALIDATE',
				population: 'CONTEXT_BYTES'
			});
			state.ledger.claimPopulation({
				contributions: snapshot.compilerInputs.flatMap((observation) =>
					'scannedEntries' in observation && observation.scannedEntries > 0
						? [{ amount: observation.scannedEntries, key: observation.id }]
						: []
				),
				mode: 'SUM',
				phase: 'VALIDATE',
				population: 'DIRECTORY_ENTRIES'
			});
			state.ledger.claimPopulation({
				members: snapshot.sources.map((source) =>
					canonicalSemanticJson({
						logicalPath: source.logicalPath,
						projectKey: projectKey(source.projectId)
					})
				),
				mode: 'COUNT',
				phase: 'VALIDATE',
				population: 'SOURCES'
			});
			for (const [population, values] of [
				[
					'AST_NODES',
					contributions(snapshot.astNodes, (record) => sourceProjectId(record.sourceId))
				],
				['SCOPES', contributions(snapshot.scopes, (record) => record.projectId)],
				[
					'DIAGNOSTICS',
					contributions(
						snapshot.diagnostics,
						(record) => record.projectId,
						(record) => record.multiplicity
					)
				],
				[
					'DIAGNOSTIC_CHARACTERS',
					contributions(
						snapshot.diagnostics,
						(record) => record.projectId,
						(record) =>
							(diagnosticMessageCharacters(record.message) +
								record.related.reduce(
									(total, related) => total + diagnosticMessageCharacters(related.message),
									0
								)) *
							record.multiplicity
					)
				],
				[
					'COMPILER_FACTS',
					contributions(
						[
							...snapshot.aliases.map((record) => symbolProjectId(record.aliasSymbolId)),
							...snapshot.declarations.map((record) => sourceProjectId(record.sourceId)),
							...snapshot.moduleExports.map((record) => sourceProjectId(record.sourceId)),
							...snapshot.moduleResolutions.map((record) => sourceProjectId(record.sourceId)),
							...snapshot.overloadSets.map((record) => record.projectId),
							...snapshot.references.map((record) => sourceProjectId(record.sourceId)),
							...snapshot.signatureParameters.map((record) =>
								signatureProjectId(record.signatureId)
							),
							...snapshot.signatures.map((record) => record.projectId),
							...snapshot.symbols.map((record) => record.projectId),
							...snapshot.typeParameters.map((record) => record.projectId),
							...snapshot.typeRelations.map((record) => record.projectId),
							...snapshot.types.map((record) => record.projectId)
						],
						(projectId) => projectId
					)
				]
			] as const)
				state.ledger.claimPopulation({
					contributions: values,
					mode: 'SUM',
					phase: 'VALIDATE',
					population
				});
			state.ledger.claimPopulation({
				contributions: [
					{
						amount: providerEvidence.canonicalSnapshotBytes,
						key: 'canonical-static-semantic-snapshot'
					}
				],
				mode: 'SUM',
				phase: 'VALIDATE',
				population: 'SNAPSHOT_BYTES'
			});
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	checkpoint(phase: SemanticOperationBudgetPhase): void {
		const state = sessionState(this);
		assertActive(state);
		if (!registeredPhase(phase))
			return poisonAndThrow(
				state,
				'INVALID_CLOCK',
				'Static semantic operation budget checkpoint phase is not registered.'
			);
		try {
			const now = state.clock.read();
			if (now > state.clock.deadlineMs)
				return poisonAndThrow(
					state,
					'BUDGET_EXCEEDED',
					'Static semantic operation exceeded maxDurationMs.',
					phase
				);
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	finalize(): SemanticOperationBudgetUsage {
		const state = sessionState(this);
		if (state.finalizedUsage !== null) return state.finalizedUsage;
		assertActive(state);
		try {
			this.checkpoint('VALIDATE');
			const usage = state.ledger.finalize();
			state.finalizedUsage = usage;
			return usage;
		} catch (error) {
			state.poisoned = true;
			throw error;
		}
	}

	providerBinding(): StaticSemanticOperationBudgetProviderBinding {
		const state = sessionState(this);
		assertActive(state);
		return state.providerBinding;
	}
}

function clockState(
	budgets: SemanticBudgets,
	startedAtMs: number,
	clock: SemanticOperationClock
): ClockState {
	if (typeof clock !== 'function' || isProxy(clock))
		throw new StaticSemanticOperationBudgetSessionError(
			'INVALID_CLOCK',
			'Static semantic operation budget clock must be a non-Proxy function.'
		);
	if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0)
		throw new StaticSemanticOperationBudgetSessionError(
			'INVALID_CLOCK',
			'Static semantic operation start must be a non-negative safe integer.'
		);
	const deadlineMs = startedAtMs + budgets.maxDurationMs;
	if (!Number.isSafeInteger(deadlineMs))
		throw new StaticSemanticOperationBudgetSessionError(
			'INVALID_CLOCK',
			'Static semantic operation deadline must be a safe integer.'
		);
	const state: ClockState = {
		deadlineMs,
		lastObservedMs: startedAtMs,
		read() {
			let now: unknown;
			try {
				now = clock();
			} catch {
				throw new StaticSemanticOperationBudgetSessionError(
					'INVALID_CLOCK',
					'Static semantic operation budget clock failed closed.'
				);
			}
			if (!Number.isSafeInteger(now) || (now as number) < state.lastObservedMs)
				throw new StaticSemanticOperationBudgetSessionError(
					'INVALID_CLOCK',
					'Static semantic operation budget clock must be monotonic safe-integer time.'
				);
			state.lastObservedMs = now as number;
			return now as number;
		}
	};
	return state;
}

export function createStaticSemanticOperationBudgetSession(
	budgets: SemanticBudgets,
	startedAtMs: number,
	clock: SemanticOperationClock = Date.now
): StaticSemanticOperationBudgetSession {
	const operationClock = clockState(budgets, startedAtMs, clock);
	const ledger = createSemanticOperationBudgetLedger(
		budgets,
		STATIC_SEMANTIC_OPERATION_BUDGET_PLAN,
		startedAtMs,
		() => operationClock.read()
	);
	const session = new StaticSemanticOperationBudgetSessionImpl(ledger);
	const providerBinding = Object.freeze(
		Object.create(null)
	) as StaticSemanticOperationBudgetProviderBinding;
	sessionStates.set(session, {
		budgetsDigest: sha256(canonicalSemanticJson(ledger.limits.budgets)),
		clock: operationClock,
		finalizedUsage: null,
		ledger,
		poisoned: false,
		providerBinding
	});
	return Object.freeze(session);
}

/**
 * Test-only issuer seam. It proves the capability boundary without claiming
 * that compiler or extraction providers issue these witnesses yet.
 */
export function issueStaticSemanticOperationBudgetWitnessForTesting(
	session: StaticSemanticOperationBudgetSession,
	input: StaticSemanticOperationBudgetWitnessInputForTesting
): StaticSemanticOperationBudgetWitness {
	const state = sessionState(session);
	assertActive(state);
	if (!registeredPhase(input.phase))
		throw new StaticSemanticOperationBudgetSessionError(
			'WITNESS_PHASE_MISMATCH',
			'Test witness phase is not registered.'
		);
	let populationClaims: readonly SemanticOperationPopulationClaimInput[];
	let queryInvocations: readonly SemanticOperationQueryInvocationInput[];
	try {
		populationClaims = deepFreeze(structuredClone(input.populationClaims));
		queryInvocations = deepFreeze(structuredClone(input.queryInvocations));
	} catch {
		throw new StaticSemanticOperationBudgetSessionError(
			'INVALID_WITNESS',
			'Test witness input must be cloneable inert data.'
		);
	}
	if (
		populationClaims.some((claim) => claim.phase !== input.phase) ||
		queryInvocations.some((query) => query.phase !== input.phase)
	)
		throw new StaticSemanticOperationBudgetSessionError(
			'WITNESS_PHASE_MISMATCH',
			'Test witness evidence must carry exactly its issuing phase.',
			input.phase
		);
	const witness = Object.freeze(Object.create(null)) as StaticSemanticOperationBudgetWitness;
	witnessStates.set(witness, {
		consumed: false,
		limitsDigest: state.ledger.limitsDigest,
		phase: input.phase,
		planDigest: STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256,
		populationClaims,
		queryInvocations,
		session: session as StaticSemanticOperationBudgetSessionImpl
	});
	return witness;
}
