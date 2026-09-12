import { describe, expect, it } from 'vitest';
import type { SemanticBudgets } from '../contracts/semantic.js';
import {
	SemanticOperationBudgetError,
	type SemanticOperationBudgetPhase,
	type SemanticOperationPopulationClaimInput,
	type SemanticOperationPopulationKind,
	type SemanticOperationQueryInvocationInput
} from './operation-budget-ledger.js';
import {
	STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX,
	STATIC_SEMANTIC_OPERATION_BUDGET_CALLER_INTEGRATION_STATUS,
	STATIC_SEMANTIC_OPERATION_BUDGET_PLAN,
	STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256,
	STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION,
	STATIC_SEMANTIC_OPERATION_BUDGET_PROVIDER_WITNESS_STATUS,
	STATIC_SEMANTIC_OPERATION_BUDGET_QUERY_RECONCILIATION_STATUS,
	STATIC_SEMANTIC_OPERATION_BUDGET_RAW_VALIDATION_WITNESS_STATUS,
	StaticSemanticOperationBudgetSessionError,
	createStaticSemanticOperationBudgetSession,
	issueStaticSemanticOperationBudgetWitnessForTesting,
	type StaticSemanticOperationBudgetClaimMatrixRow,
	type StaticSemanticOperationBudgetSession
} from './static-semantic-operation-budget-session.js';

const BUDGETS = {
	maxAstDepth: 64,
	maxAstNodes: 100,
	maxCompilerFacts: 100,
	maxCompilerInputMetadataBytes: 10_000,
	maxCompilerQueries: 100,
	maxCompilerQueryInvocations: 100,
	maxContextBytes: 1_000,
	maxContextFileBytes: 500,
	maxContextFiles: 10,
	maxDiagnosticCharacters: 1_000,
	maxDiagnostics: 100,
	maxDirectoryEntries: 100,
	maxDurationMs: 20,
	maxLiteralCharacters: 1_000,
	maxPathCharacters: 500,
	maxProjects: 10,
	maxScopes: 100,
	maxSnapshotBytes: 1_000_000,
	maxSources: 100
} satisfies SemanticBudgets;

interface TestClock {
	readonly clock: () => number;
	set(value: number): void;
}

function testClock(initial = 100): TestClock {
	let now = initial;
	return { clock: () => now, set: (value) => (now = value) };
}

function expectSessionCode(
	action: () => unknown,
	code: StaticSemanticOperationBudgetSessionError['code']
): StaticSemanticOperationBudgetSessionError {
	try {
		action();
	} catch (error) {
		expect(error).toBeInstanceOf(StaticSemanticOperationBudgetSessionError);
		expect(error).toMatchObject({ code });
		return error as StaticSemanticOperationBudgetSessionError;
	}
	throw new Error(`Expected ${code}.`);
}

function expectLedgerCode(
	action: () => unknown,
	code: SemanticOperationBudgetError['code']
): SemanticOperationBudgetError {
	try {
		action();
	} catch (error) {
		expect(error).toBeInstanceOf(SemanticOperationBudgetError);
		expect(error).toMatchObject({ code });
		return error as SemanticOperationBudgetError;
	}
	throw new Error(`Expected ${code}.`);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
	if (value === null || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	expect(Object.isFrozen(value)).toBe(true);
	for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function countMembers(population: SemanticOperationPopulationKind): readonly string[] {
	switch (population) {
		case 'PROJECTS':
			return ['a/tsconfig.json'];
		case 'COMPILER_INPUTS':
			return ['{"logicalPath":"src/a.ts","operation":"READ_FILE"}'];
		case 'CONTEXT_FILES':
			return ['semantic:context-input-a'];
		case 'SOURCES':
			return ['["a/tsconfig.json","src/a.ts"]'];
		default:
			throw new Error(`${population} is not a COUNT population in the fixed test matrix.`);
	}
}

function sumContributions(
	population: SemanticOperationPopulationKind
): readonly { readonly amount: number; readonly key: string }[] {
	switch (population) {
		case 'COMPILER_INPUT_METADATA_BYTES':
			return [{ amount: 200, key: 'canonical-compiler-input-array' }];
		case 'CONTEXT_BYTES':
			return [{ amount: 10, key: 'semantic:context-input-a' }];
		case 'DIRECTORY_ENTRIES':
			return [{ amount: 2, key: 'semantic:context-input-directory-a' }];
		case 'AST_NODES':
			return [{ amount: 2, key: '["a/tsconfig.json","src/a.ts"]' }];
		case 'SCOPES':
			return [{ amount: 1, key: '["a/tsconfig.json","src/a.ts"]' }];
		case 'DIAGNOSTICS':
			return [{ amount: 1, key: 'a/tsconfig.json' }];
		case 'DIAGNOSTIC_CHARACTERS':
			return [{ amount: 5, key: 'a/tsconfig.json' }];
		case 'COMPILER_FACTS':
			return [{ amount: 3, key: '["a/tsconfig.json","symbols"]' }];
		case 'SNAPSHOT_BYTES':
			return [{ amount: 500, key: 'canonical-static-semantic-snapshot' }];
		default:
			throw new Error(`${population} is not a SUM population in the fixed test matrix.`);
	}
}

function claim(
	row: StaticSemanticOperationBudgetClaimMatrixRow,
	phase: SemanticOperationBudgetPhase
): SemanticOperationPopulationClaimInput {
	return row.mode === 'COUNT'
		? { members: countMembers(row.population), mode: 'COUNT', phase, population: row.population }
		: {
				contributions: sumContributions(row.population),
				mode: 'SUM',
				phase,
				population: row.population
			};
}

function claimsForPhase(
	phase: SemanticOperationBudgetPhase
): readonly SemanticOperationPopulationClaimInput[] {
	return STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX.filter((row) =>
		(row.phases as readonly SemanticOperationBudgetPhase[]).includes(phase)
	).map((row) => claim(row, phase));
}

function queriesForPhase(
	phase: SemanticOperationBudgetPhase
): readonly SemanticOperationQueryInvocationInput[] {
	const host = {
		family: 'COMPILER_HOST',
		phase,
		projectKey: 'a/tsconfig.json',
		queryKey: 'READ_FILE\0src/a.ts'
	} as const;
	const checker = {
		family: 'TYPE_CHECKER',
		phase,
		projectKey: 'a/tsconfig.json',
		queryKey: 'node-symbol\u0000src/a.ts\u00000'
	} as const;
	if (phase === 'CAPTURE') return [host, checker];
	if (phase === 'RECHECK') return [host];
	if (phase === 'EXTRACT') return [checker];
	return [];
}

const COMPLETION_PHASES = [
	'MATERIALIZE',
	'CAPTURE',
	'RECHECK',
	'EXTRACT',
	'VALIDATE'
] as const satisfies readonly SemanticOperationBudgetPhase[];

function complete(
	session: StaticSemanticOperationBudgetSession,
	phases: readonly SemanticOperationBudgetPhase[] = COMPLETION_PHASES
): void {
	for (const phase of phases) {
		const witness = issueStaticSemanticOperationBudgetWitnessForTesting(session, {
			phase,
			populationClaims: claimsForPhase(phase),
			queryInvocations: queriesForPhase(phase)
		});
		session.acceptWitness(phase, witness);
	}
}

describe('StaticSemanticOperationBudgetSession', () => {
	it('owns one exact immutable versioned claim, mode, and reconciliation matrix', () => {
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION).toBe(
			'jan-csaa-static-semantic-operation-budget-plan/1.0.0'
		);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX).toEqual([
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
		]);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN.requiredClaims).toHaveLength(39);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN.reconciliationGroups).toHaveLength(12);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN).toEqual({
			reconciliationGroups: STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX.flatMap((row) =>
				row.reconciliationId === null
					? []
					: [
							{
								claims: row.phases.map((phase) => ({
									phase,
									population: row.population
								})),
								id: row.reconciliationId
							}
						]
			),
			requiredClaims: STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX.flatMap((row) =>
				row.phases.map((phase) => ({
					mode: row.mode,
					phase,
					population: row.population
				}))
			)
		});
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256).toBe(
			'e431397cd4731f770d0b5898c89ec935e2c516438195c4bd78fdf1198827db77'
		);
		expectDeepFrozen(STATIC_SEMANTIC_OPERATION_BUDGET_CLAIM_MATRIX);
		expectDeepFrozen(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_PROVIDER_WITNESS_STATUS).toBe(
			'COMPILER_INPUT_RAW_EXTRACTION_AND_VALIDATION'
		);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_QUERY_RECONCILIATION_STATUS).toBe(
			'CAPTURE_AND_REPLAY_HOST_PLUS_CAPTURE_AND_EXTRACT_TYPE_CHECKER_RECORDED'
		);
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_CALLER_INTEGRATION_STATUS).toBe('FULLY_INTEGRATED');
		expect(STATIC_SEMANTIC_OPERATION_BUDGET_RAW_VALIDATION_WITNESS_STATUS).toBe(
			'RAW_AND_VALIDATION_INTEGRATED'
		);
	});

	it('constructs only the fixed plan and rejects an ad hoc plan in the clock position', () => {
		const clock = testClock();
		const session = createStaticSemanticOperationBudgetSession(BUDGETS, 100, clock.clock);
		expect(session.planDigest).toBe(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_SHA256);
		expect(session.planVersion).toBe(STATIC_SEMANTIC_OPERATION_BUDGET_PLAN_VERSION);
		expectSessionCode(
			() =>
				createStaticSemanticOperationBudgetSession(
					BUDGETS,
					100,
					STATIC_SEMANTIC_OPERATION_BUDGET_PLAN as never
				),
			'INVALID_CLOCK'
		);
	});

	it('rejects fake and cloned witnesses and poisons the attempted session', () => {
		const fakeSession = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectSessionCode(
			() => fakeSession.acceptWitness('CAPTURE', Object.freeze({}) as never),
			'INVALID_WITNESS'
		);
		expectSessionCode(() => fakeSession.checkpoint('CAPTURE'), 'POISONED');

		const cloneSession = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		const witness = issueStaticSemanticOperationBudgetWitnessForTesting(cloneSession, {
			phase: 'MATERIALIZE',
			populationClaims: claimsForPhase('MATERIALIZE'),
			queryInvocations: []
		});
		const clone = structuredClone(witness);
		expectSessionCode(
			() => cloneSession.acceptWitness('MATERIALIZE', clone as never),
			'INVALID_WITNESS'
		);
	});

	it('binds witnesses to one session, limits digest, plan, phase, and single use', () => {
		const first = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		const second = createStaticSemanticOperationBudgetSession(
			{ ...BUDGETS, maxCompilerFacts: BUDGETS.maxCompilerFacts + 1 },
			100,
			() => 100
		);
		const scoped = issueStaticSemanticOperationBudgetWitnessForTesting(first, {
			phase: 'MATERIALIZE',
			populationClaims: claimsForPhase('MATERIALIZE'),
			queryInvocations: []
		});
		expectSessionCode(() => second.acceptWitness('MATERIALIZE', scoped), 'WITNESS_SCOPE_MISMATCH');
		first.acceptWitness('MATERIALIZE', scoped);
		expectSessionCode(() => first.acceptWitness('MATERIALIZE', scoped), 'WITNESS_REUSED');

		const wrongPhase = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		const capture = issueStaticSemanticOperationBudgetWitnessForTesting(wrongPhase, {
			phase: 'CAPTURE',
			populationClaims: claimsForPhase('CAPTURE'),
			queryInvocations: queriesForPhase('CAPTURE')
		});
		expectSessionCode(() => wrongPhase.acceptWitness('EXTRACT', capture), 'WITNESS_PHASE_MISMATCH');
	});

	it('rejects undeclared modes and terminal closure with any required claim omitted', () => {
		const wrongMode = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		const witness = issueStaticSemanticOperationBudgetWitnessForTesting(wrongMode, {
			phase: 'MATERIALIZE',
			populationClaims: [
				{
					contributions: [{ amount: 1, key: 'a/tsconfig.json' }],
					mode: 'SUM',
					phase: 'MATERIALIZE',
					population: 'PROJECTS'
				}
			],
			queryInvocations: []
		});
		expectLedgerCode(() => wrongMode.acceptWitness('MATERIALIZE', witness), 'INVALID_INPUT');
		expectSessionCode(() => wrongMode.finalize(), 'POISONED');

		const incomplete = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		complete(incomplete, COMPLETION_PHASES.slice(0, -1));
		expectLedgerCode(() => incomplete.finalize(), 'INCOMPLETE_CLAIMS');
		expectSessionCode(() => incomplete.finalize(), 'POISONED');
	});

	it('enforces one injected absolute deadline through explicit public-phase checkpoints', () => {
		const clock = testClock();
		const session = createStaticSemanticOperationBudgetSession(BUDGETS, 100, clock.clock);
		clock.set(120);
		expect(() => session.checkpoint('PROGRAM')).not.toThrow();
		clock.set(121);
		const error = expectSessionCode(() => session.checkpoint('EXTRACT'), 'BUDGET_EXCEEDED');
		expect(error.phase).toBe('EXTRACT');
		expectSessionCode(() => session.checkpoint('VALIDATE'), 'POISONED');

		const invalidPhase = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectSessionCode(() => invalidPhase.checkpoint('REPLAY' as never), 'INVALID_CLOCK');
	});

	it('seals deterministic deeply frozen usage independent of witness application order', () => {
		const first = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		const second = createStaticSemanticOperationBudgetSession(BUDGETS, 1_000, () => 1_000);
		const afterFinalization = issueStaticSemanticOperationBudgetWitnessForTesting(first, {
			phase: 'VALIDATE',
			populationClaims: claimsForPhase('VALIDATE'),
			queryInvocations: []
		});
		complete(first);
		complete(second, [...COMPLETION_PHASES].reverse());
		const firstUsage = first.finalize();
		const secondUsage = second.finalize();
		expect(secondUsage).toEqual(firstUsage);
		expect(secondUsage.usageDigest).toBe(firstUsage.usageDigest);
		expect(firstUsage.populationClaims).toHaveLength(39);
		expect(firstUsage.reconciliations).toHaveLength(12);
		expect(firstUsage.workTotals[0]).toMatchObject({ amount: 4 });
		expectDeepFrozen(firstUsage);
		expect(first.finalize()).toBe(firstUsage);
		expectSessionCode(() => first.acceptWitness('VALIDATE', afterFinalization), 'FINALIZED');
	});

	it('rejects forged sessions, unregistered expected phases, and malformed witness payloads', () => {
		expectSessionCode(
			() =>
				issueStaticSemanticOperationBudgetWitnessForTesting({} as never, {
					phase: 'CAPTURE',
					populationClaims: [],
					queryInvocations: []
				}),
			'INVALID_SESSION'
		);

		const unregisteredExpectedPhase = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			100,
			() => 100
		);
		const materialize = issueStaticSemanticOperationBudgetWitnessForTesting(
			unregisteredExpectedPhase,
			{
				phase: 'MATERIALIZE',
				populationClaims: claimsForPhase('MATERIALIZE'),
				queryInvocations: []
			}
		);
		expectSessionCode(
			() => unregisteredExpectedPhase.acceptWitness('REPLAY' as never, materialize),
			'WITNESS_PHASE_MISMATCH'
		);

		const invalidIssuingPhase = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectSessionCode(
			() =>
				issueStaticSemanticOperationBudgetWitnessForTesting(invalidIssuingPhase, {
					phase: 'REPLAY' as never,
					populationClaims: [],
					queryInvocations: []
				}),
			'WITNESS_PHASE_MISMATCH'
		);

		const uncloneable = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectSessionCode(
			() =>
				issueStaticSemanticOperationBudgetWitnessForTesting(uncloneable, {
					phase: 'CAPTURE',
					populationClaims: [(() => undefined) as never],
					queryInvocations: []
				}),
			'INVALID_WITNESS'
		);

		const mismatchedEvidence = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectSessionCode(
			() =>
				issueStaticSemanticOperationBudgetWitnessForTesting(mismatchedEvidence, {
					phase: 'CAPTURE',
					populationClaims: claimsForPhase('RECHECK'),
					queryInvocations: []
				}),
			'WITNESS_PHASE_MISMATCH'
		);
	});

	it('poisons materialized-subject duplication and validates every clock boundary', () => {
		const duplicateProjects = createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => 100);
		expectLedgerCode(
			() =>
				duplicateProjects.acceptMaterializedSubject({
					projects: [{ configPath: 'a/tsconfig.json' }, { configPath: 'a/tsconfig.json' }]
				} as never),
			'INVALID_INPUT'
		);
		expectSessionCode(() => duplicateProjects.checkpoint('MATERIALIZE'), 'POISONED');

		expectSessionCode(
			() => createStaticSemanticOperationBudgetSession(BUDGETS, 100, new Proxy(() => 100, {})),
			'INVALID_CLOCK'
		);
		expectSessionCode(
			() => createStaticSemanticOperationBudgetSession(BUDGETS, -1, () => 0),
			'INVALID_CLOCK'
		);
		expectSessionCode(
			() =>
				createStaticSemanticOperationBudgetSession(
					BUDGETS,
					Number.MAX_SAFE_INTEGER - BUDGETS.maxDurationMs + 1,
					() => Number.MAX_SAFE_INTEGER
				),
			'INVALID_CLOCK'
		);

		expectLedgerCode(
			() =>
				createStaticSemanticOperationBudgetSession(BUDGETS, 100, () => {
					throw new Error('clock failed');
				}),
			'INVALID_INPUT'
		);

		const regressingClock = testClock();
		const regressed = createStaticSemanticOperationBudgetSession(
			BUDGETS,
			100,
			regressingClock.clock
		);
		regressingClock.set(99);
		expectSessionCode(() => regressed.checkpoint('CAPTURE'), 'INVALID_CLOCK');
		expectSessionCode(() => regressed.providerBinding(), 'POISONED');
	});
});
