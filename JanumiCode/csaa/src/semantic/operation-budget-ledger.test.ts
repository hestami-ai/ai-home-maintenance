import { describe, expect, it } from 'vitest';
import { SEMANTIC_BUDGET_KEYS, type SemanticBudgets } from '../contracts/semantic.js';
import {
	SEMANTIC_OPERATION_BUDGET_PHASES,
	SemanticOperationBudgetError,
	SemanticOperationBudgetLedger,
	createSemanticOperationBudgetLedger,
	type SemanticOperationBudgetPlan,
	type SemanticOperationCountPopulationClaimInput,
	type SemanticOperationQueryInvocationInput,
	type SemanticOperationSumPopulationClaimInput
} from './operation-budget-ledger.js';

const BUDGETS: SemanticBudgets = {
	maxAstDepth: 64,
	maxAstNodes: 5,
	maxCompilerInputMetadataBytes: 1_000,
	maxCompilerQueries: 4,
	maxCompilerFacts: 4,
	maxCompilerQueryInvocations: 8,
	maxContextBytes: 100,
	maxContextFileBytes: 50,
	maxContextFiles: 4,
	maxDiagnosticCharacters: 80,
	maxDiagnostics: 3,
	maxDirectoryEntries: 20,
	maxDurationMs: 10,
	maxLiteralCharacters: 100,
	maxPathCharacters: 100,
	maxProjects: 2,
	maxScopes: 6,
	maxSnapshotBytes: 2_000,
	maxSources: 4
};

const PLAN: SemanticOperationBudgetPlan = {
	reconciliationGroups: [
		{
			claims: [
				{ phase: 'CAPTURE', population: 'SOURCES' },
				{ phase: 'RECHECK', population: 'SOURCES' }
			],
			id: 'source-replay-equivalence'
		}
	],
	requiredClaims: [
		{ mode: 'COUNT', phase: 'CAPTURE', population: 'SOURCES' },
		{ mode: 'COUNT', phase: 'RECHECK', population: 'SOURCES' },
		{ mode: 'SUM', phase: 'EXTRACT', population: 'COMPILER_FACTS' }
	]
};

interface TestClock {
	readonly clock: () => number;
	set(value: number): void;
}

function testClock(initial: number): TestClock {
	let now = initial;
	return { clock: () => now, set: (value) => (now = value) };
}

function ledger(
	options: {
		readonly budgets?: SemanticBudgets;
		readonly clock?: TestClock;
		readonly plan?: SemanticOperationBudgetPlan;
		readonly startedAtMs?: number;
	} = {}
): SemanticOperationBudgetLedger {
	const startedAtMs = options.startedAtMs ?? 100;
	const clock = options.clock ?? testClock(startedAtMs);
	return createSemanticOperationBudgetLedger(
		options.budgets ?? BUDGETS,
		options.plan ?? PLAN,
		startedAtMs,
		clock.clock
	);
}

function countClaim(
	phase: 'CAPTURE' | 'RECHECK',
	members: readonly string[] = ['src/a.ts', 'src/b.ts']
): SemanticOperationCountPopulationClaimInput {
	return { members, mode: 'COUNT', phase, population: 'SOURCES' };
}

function sumClaim(
	contributions: SemanticOperationSumPopulationClaimInput['contributions'] = [
		{ amount: 1, key: 'declarations' },
		{ amount: 2, key: 'symbols' }
	]
): SemanticOperationSumPopulationClaimInput {
	return { contributions, mode: 'SUM', phase: 'EXTRACT', population: 'COMPILER_FACTS' };
}

function completeClaims(value: SemanticOperationBudgetLedger, reversed = false): void {
	const actions = [
		() => value.claimPopulation(countClaim('CAPTURE', ['src/b.ts', 'src/a.ts'])),
		() => value.claimPopulation(countClaim('RECHECK')),
		() =>
			value.claimPopulation(
				sumClaim([
					{ amount: 2, key: 'symbols' },
					{ amount: 1, key: 'declarations' }
				])
			)
	] as const;
	for (const action of reversed ? [...actions].reverse() : actions) action();
}

function expectCode(
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
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) expectDeepFrozen(descriptor.value, seen);
	}
}

function query(
	family: SemanticOperationQueryInvocationInput['family'],
	projectKey: string,
	phase: SemanticOperationQueryInvocationInput['phase'] = 'CAPTURE',
	queryKey = 'query\0src/a.ts'
): SemanticOperationQueryInvocationInput {
	return { family, phase, projectKey, queryKey };
}

describe('SemanticOperationBudgetLedger', () => {
	it('derives canonical COUNT and SUM evidence and closes the exact required plan', () => {
		const value = ledger();
		const mutableMembers = ['src/b.ts', 'src/a.ts'];
		value.claimPopulation(countClaim('CAPTURE', mutableMembers));
		mutableMembers[0] = 'mutated';
		value.claimPopulation(countClaim('CAPTURE'));
		value.claimPopulation(countClaim('RECHECK', ['src/b.ts', 'src/a.ts']));
		value.claimPopulation(
			sumClaim([
				{ amount: 2, key: 'symbols' },
				{ amount: 1, key: 'declarations' }
			])
		);

		const usage = value.finalize();
		const capture = usage.populationClaims.find(
			(claim) => claim.phase === 'CAPTURE' && claim.population === 'SOURCES'
		)!;
		const facts = usage.populationClaims.find(
			(claim) => claim.phase === 'EXTRACT' && claim.population === 'COMPILER_FACTS'
		)!;
		expect(capture).toMatchObject({ amount: 2, mode: 'COUNT', remaining: 2 });
		expect(capture.mode === 'COUNT' && capture.members).toEqual(['src/a.ts', 'src/b.ts']);
		expect(facts).toMatchObject({ amount: 3, limit: 4, mode: 'SUM', remaining: 1 });
		expect(facts.mode === 'SUM' && facts.contributions).toEqual([
			{ amount: 1, key: 'declarations' },
			{ amount: 2, key: 'symbols' }
		]);
		expect(usage.reconciliations).toEqual([
			expect.objectContaining({
				id: 'source-replay-equivalence',
				manifestSha256: capture.manifestSha256
			})
		]);
		expect(usage.usageDigest).toMatch(/^[a-f0-9]{64}$/u);
	});

	it('rejects caller-supplied amount/digest fields and poisons the failed mutation', () => {
		const value = ledger();
		expectCode(
			() =>
				value.claimPopulation({
					...countClaim('CAPTURE'),
					amount: 2,
					manifestSha256: '0'.repeat(64)
				} as never),
			'INVALID_INPUT'
		);
		expectCode(() => value.claimPopulation(countClaim('CAPTURE')), 'POISONED');
		expectCode(() => value.finalize(), 'POISONED');
	});

	it('rejects missing and incompatible required claims and never emits a success digest afterward', () => {
		const missing = ledger();
		missing.claimPopulation(countClaim('CAPTURE'));
		missing.claimPopulation(sumClaim());
		const incomplete = expectCode(() => missing.finalize(), 'INCOMPLETE_CLAIMS');
		expect(incomplete).toMatchObject({ phase: 'RECHECK' });
		expectCode(() => missing.finalize(), 'POISONED');

		const incompatible = ledger();
		incompatible.claimPopulation(countClaim('CAPTURE', ['src/a.ts']));
		incompatible.claimPopulation(countClaim('RECHECK', ['src/b.ts']));
		incompatible.claimPopulation(sumClaim());
		expectCode(() => incompatible.finalize(), 'RECONCILIATION_FAILED');
		expectCode(
			() => incompatible.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json')),
			'POISONED'
		);
	});

	it('materializes an immutable exact claim plan and rejects structurally invalid reconciliation groups', () => {
		const requiredClaims = [...PLAN.requiredClaims];
		const reconciliationGroups = [...PLAN.reconciliationGroups];
		const mutablePlan = { reconciliationGroups, requiredClaims };
		const value = ledger({ plan: mutablePlan });
		requiredClaims.length = 0;
		reconciliationGroups.length = 0;
		expect(value.plan.requiredClaims).toEqual(
			expect.arrayContaining(PLAN.requiredClaims.map((claim) => expect.objectContaining(claim)))
		);
		expect(value.plan.requiredClaims).toHaveLength(PLAN.requiredClaims.length);
		expect(value.plan.reconciliationGroups).toEqual(PLAN.reconciliationGroups);
		expectDeepFrozen(value.plan);

		for (const malformed of [
			{ reconciliationGroups: [], requiredClaims: [] },
			{
				reconciliationGroups: [
					{ claims: [{ phase: 'CAPTURE', population: 'SOURCES' }], id: 'one' }
				],
				requiredClaims: PLAN.requiredClaims
			},
			{
				reconciliationGroups: [
					{
						claims: [
							{ phase: 'CAPTURE', population: 'SOURCES' },
							{ phase: 'RECHECK', population: 'AST_NODES' }
						],
						id: 'mixed'
					}
				],
				requiredClaims: PLAN.requiredClaims
			}
		]) {
			expectCode(
				() => new SemanticOperationBudgetLedger(BUDGETS, malformed as never, 100, () => 100),
				'INVALID_LIMITS'
			);
		}
	});

	it('enforces one original absolute deadline at construction, mutation, query, and finalization', () => {
		const expiredAtConstruction = testClock(111);
		const constructionError = expectCode(
			() => ledger({ clock: expiredAtConstruction, startedAtMs: 100 }),
			'BUDGET_EXCEEDED'
		);
		expect(constructionError).toMatchObject({
			attempted: 11,
			limit: 10,
			limitKey: 'maxDurationMs',
			phase: 'REQUEST'
		});

		for (const seam of ['CLAIM', 'QUERY', 'FINALIZE'] as const) {
			const clock = testClock(100);
			const value = ledger({ clock });
			if (seam === 'FINALIZE') completeClaims(value);
			clock.set(111);
			const error = expectCode(() => {
				if (seam === 'CLAIM') value.claimPopulation(countClaim('CAPTURE'));
				else if (seam === 'QUERY')
					value.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json', 'PROGRAM'));
				else value.finalize();
			}, 'BUDGET_EXCEEDED');
			expect(error).toMatchObject({ attempted: 11, limit: 10, limitKey: 'maxDurationMs' });
			expectCode(() => value.finalize(), 'POISONED');
		}

		const boundaryClock = testClock(100);
		const boundary = ledger({ clock: boundaryClock });
		completeClaims(boundary);
		boundaryClock.set(110);
		expect(() => boundary.finalize()).not.toThrow();
	});

	it('atomically counts host queries globally and checker queries per project with exact attribution', () => {
		const value = ledger();
		expect(value.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json'))).toBe(true);
		expect(value.recordQueryInvocation(query('COMPILER_HOST', 'b/tsconfig.json', 'RECHECK'))).toBe(
			false
		);
		expect(value.recordQueryInvocation(query('TYPE_CHECKER', 'a/tsconfig.json'))).toBe(true);
		expect(value.recordQueryInvocation(query('TYPE_CHECKER', 'b/tsconfig.json'))).toBe(true);
		expect(value.recordQueryInvocation(query('TYPE_CHECKER', 'a/tsconfig.json', 'EXTRACT'))).toBe(
			false
		);
		completeClaims(value);
		const usage = value.finalize();
		expect(usage.uniqueQueries).toMatchObject({ count: 3, limit: 4, remaining: 1 });
		const host = usage.uniqueQueries.members.find((member) => member.family === 'COMPILER_HOST')!;
		expect(host.invocations).toEqual([
			{ amount: 1, phase: 'CAPTURE', projectKey: 'a/tsconfig.json' },
			{ amount: 1, phase: 'RECHECK', projectKey: 'b/tsconfig.json' }
		]);
		expect(usage.workTotals[0]).toMatchObject({ amount: 5, remaining: 3 });
		expect(usage.workCharges.reduce((total, charge) => total + charge.amount, 0)).toBe(5);
	});

	it('distinguishes host attribution histories whose project and phase marginals collide', () => {
		const first = ledger();
		const second = ledger({ startedAtMs: 1_000 });
		completeClaims(first);
		completeClaims(second);
		first.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json', 'CAPTURE'));
		first.recordQueryInvocation(query('COMPILER_HOST', 'b/tsconfig.json', 'RECHECK'));
		second.recordQueryInvocation(query('COMPILER_HOST', 'b/tsconfig.json', 'CAPTURE'));
		second.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json', 'RECHECK'));

		const firstUsage = first.finalize();
		const secondUsage = second.finalize();
		const firstHost = firstUsage.uniqueQueries.members[0]!;
		const secondHost = secondUsage.uniqueQueries.members[0]!;
		expect(firstHost.invocations).toEqual([
			{ amount: 1, phase: 'CAPTURE', projectKey: 'a/tsconfig.json' },
			{ amount: 1, phase: 'RECHECK', projectKey: 'b/tsconfig.json' }
		]);
		expect(secondHost.invocations).toEqual([
			{ amount: 1, phase: 'RECHECK', projectKey: 'a/tsconfig.json' },
			{ amount: 1, phase: 'CAPTURE', projectKey: 'b/tsconfig.json' }
		]);
		expect(secondUsage.uniqueQueries.manifestSha256).not.toBe(
			firstUsage.uniqueQueries.manifestSha256
		);
		expect(secondUsage.usageDigest).not.toBe(firstUsage.usageDigest);
	});

	it('poisons query and population mutations on limit, conflict, and path failures', () => {
		const queryLimited = ledger({
			budgets: { ...BUDGETS, maxCompilerQueries: 1, maxCompilerQueryInvocations: 2 }
		});
		queryLimited.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json', 'CAPTURE', 'a'));
		const queryError = expectCode(
			() =>
				queryLimited.recordQueryInvocation(
					query('TYPE_CHECKER', 'a/tsconfig.json', 'EXTRACT', 'b')
				),
			'BUDGET_EXCEEDED'
		);
		expect(queryError).toMatchObject({ attempted: 2, limit: 1, limitKey: 'maxCompilerQueries' });
		expectCode(() => queryLimited.finalize(), 'POISONED');

		const oversized = ledger();
		const populationError = expectCode(
			() => oversized.claimPopulation(countClaim('CAPTURE', ['1', '2', '3', '4', '5'])),
			'BUDGET_EXCEEDED'
		);
		expect(populationError).toMatchObject({ limit: 4, limitKey: 'maxSources' });
		expectCode(() => oversized.finalize(), 'POISONED');

		const conflicting = ledger();
		conflicting.claimPopulation(countClaim('CAPTURE', ['a']));
		expectCode(() => conflicting.claimPopulation(countClaim('CAPTURE', ['b'])), 'CLAIM_CONFLICT');
		expectCode(() => conflicting.finalize(), 'POISONED');

		for (const projectKey of ['../tsconfig.json', 'C:/repo/tsconfig.json', 'a\\tsconfig.json']) {
			const invalidPath = ledger();
			expectCode(
				() => invalidPath.recordQueryInvocation(query('COMPILER_HOST', projectKey)),
				'INVALID_INPUT'
			);
			expectCode(() => invalidPath.finalize(), 'POISONED');
		}
	});

	it('uses only public build phases and binds compiler facts to their governed request budget', () => {
		expect(SEMANTIC_OPERATION_BUDGET_PHASES).toEqual([
			'REQUEST',
			'FRESHNESS',
			'MATERIALIZE',
			'CAPTURE',
			'RECHECK',
			'PROGRAM',
			'EXTRACT',
			'VALIDATE'
		]);
		const first = ledger();
		const second = ledger({ startedAtMs: 1_000 });
		expect(first.limits.budgets.maxCompilerFacts).toBe(BUDGETS.maxCompilerFacts);
		expect(first.limitsDigest).toBe(second.limitsDigest);
		const exactFacts = ledger({
			budgets: { ...BUDGETS, maxCompilerQueries: 1, maxCompilerFacts: 4 }
		});
		expect(() =>
			exactFacts.claimPopulation(sumClaim([{ amount: 4, key: 'all-facts' }]))
		).not.toThrow();

		const overFacts = ledger();
		const error = expectCode(
			() => overFacts.claimPopulation(sumClaim([{ amount: 5, key: 'all-facts' }])),
			'BUDGET_EXCEEDED'
		);
		expect(error).toMatchObject({ attempted: 5, limit: 4, limitKey: 'maxCompilerFacts' });
		expectCode(() => overFacts.finalize(), 'POISONED');

		for (const invalidBudgets of [
			Object.fromEntries(Object.entries(BUDGETS).filter(([key]) => key !== 'maxCompilerFacts')),
			{ ...BUDGETS, unexpectedCompilerBudget: 99 }
		])
			expectCode(
				() => new SemanticOperationBudgetLedger(invalidBudgets as never, PLAN, 100, () => 100),
				'INVALID_LIMITS'
			);
		const oldPhase = ledger();
		expectCode(
			() => oldPhase.claimPopulation({ ...countClaim('CAPTURE'), phase: 'REPLAY' } as never),
			'INVALID_INPUT'
		);
	});

	it('finalizes byte-identical deeply frozen evidence regardless of plan and call order', () => {
		const reversedPlan: SemanticOperationBudgetPlan = {
			reconciliationGroups: [
				{
					claims: [...PLAN.reconciliationGroups[0]!.claims].reverse(),
					id: PLAN.reconciliationGroups[0]!.id
				}
			],
			requiredClaims: [...PLAN.requiredClaims].reverse()
		};
		const first = ledger({ startedAtMs: 100 });
		const second = ledger({ plan: reversedPlan, startedAtMs: 10_000 });
		completeClaims(first);
		completeClaims(second, true);
		const firstQueries = [
			query('COMPILER_HOST', 'b/tsconfig.json', 'RECHECK'),
			query('TYPE_CHECKER', 'a/tsconfig.json', 'EXTRACT'),
			query('COMPILER_HOST', 'a/tsconfig.json', 'CAPTURE')
		] as const;
		for (const invocation of firstQueries) first.recordQueryInvocation(invocation);
		for (const invocation of [...firstQueries].reverse()) second.recordQueryInvocation(invocation);

		const firstUsage = first.finalize();
		const secondUsage = second.finalize();
		expect(secondUsage).toEqual(firstUsage);
		expect(secondUsage.usageDigest).toBe(firstUsage.usageDigest);
		expectDeepFrozen(firstUsage);
		expect(first.finalize()).toBe(firstUsage);

		const mutated = ledger();
		mutated.claimPopulation(countClaim('CAPTURE', ['src/a.ts', 'src/c.ts']));
		mutated.claimPopulation(countClaim('RECHECK', ['src/c.ts', 'src/a.ts']));
		mutated.claimPopulation(sumClaim());
		for (const invocation of firstQueries) mutated.recordQueryInvocation(invocation);
		expect(mutated.finalize().usageDigest).not.toBe(firstUsage.usageDigest);
	});

	it('bounds every retained evidence string by UTF-8 bytes and aggregate retained bytes', () => {
		const planWithoutIds: SemanticOperationBudgetPlan = {
			reconciliationGroups: [],
			requiredClaims: PLAN.requiredClaims
		};
		const fiveMetadataBytes = {
			...BUDGETS,
			maxCompilerInputMetadataBytes: 5
		};
		const oversizedPlan: SemanticOperationBudgetPlan = {
			reconciliationGroups: [
				{
					claims: PLAN.reconciliationGroups[0]!.claims,
					id: 'ééé'
				}
			],
			requiredClaims: PLAN.requiredClaims
		};
		const planError = expectCode(
			() => ledger({ budgets: fiveMetadataBytes, plan: oversizedPlan }),
			'INVALID_LIMITS'
		);
		expect(planError).toMatchObject({
			attempted: 6,
			limit: 5,
			limitKey: 'maxCompilerInputMetadataBytes'
		});

		for (const action of [
			(value: SemanticOperationBudgetLedger) =>
				value.claimPopulation(countClaim('CAPTURE', ['ééé'])),
			(value: SemanticOperationBudgetLedger) =>
				value.claimPopulation(sumClaim([{ amount: 1, key: 'ééé' }])),
			(value: SemanticOperationBudgetLedger) =>
				value.recordQueryInvocation(query('COMPILER_HOST', 'ééé', 'CAPTURE', 'q')),
			(value: SemanticOperationBudgetLedger) =>
				value.recordQueryInvocation(query('COMPILER_HOST', 'p', 'CAPTURE', 'ééé'))
		]) {
			const value = ledger({ budgets: fiveMetadataBytes, plan: planWithoutIds });
			const error = expectCode(() => action(value), 'BUDGET_EXCEEDED');
			expect(error).toMatchObject({
				attempted: 6,
				limit: 5,
				limitKey: 'maxCompilerInputMetadataBytes'
			});
			expectCode(() => value.finalize(), 'POISONED');
		}

		const aggregateClaims = ledger({
			budgets: { ...BUDGETS, maxSnapshotBytes: 7 },
			plan: planWithoutIds
		});
		aggregateClaims.claimPopulation(countClaim('CAPTURE', ['abcd']));
		const aggregateClaimError = expectCode(
			() => aggregateClaims.claimPopulation(countClaim('RECHECK', ['abcd'])),
			'BUDGET_EXCEEDED'
		);
		expect(aggregateClaimError).toMatchObject({
			attempted: 8,
			limit: 7,
			limitKey: 'maxSnapshotBytes'
		});
		expectCode(() => aggregateClaims.finalize(), 'POISONED');

		const aggregateQueries = ledger({
			budgets: { ...BUDGETS, maxSnapshotBytes: 8 },
			plan: planWithoutIds
		});
		aggregateQueries.recordQueryInvocation(query('COMPILER_HOST', 'p', 'CAPTURE', 'query'));
		aggregateQueries.recordQueryInvocation(query('COMPILER_HOST', 'xx', 'RECHECK', 'query'));
		const aggregateQueryError = expectCode(
			() => aggregateQueries.recordQueryInvocation(query('COMPILER_HOST', 'z', 'EXTRACT', 'query')),
			'BUDGET_EXCEEDED'
		);
		expect(aggregateQueryError).toMatchObject({
			attempted: 9,
			limit: 8,
			limitKey: 'maxSnapshotBytes'
		});
		expectCode(() => aggregateQueries.finalize(), 'POISONED');
	});

	it('rejects large sparse arrays without length-proportional key allocation and checks deadlines', () => {
		const sparse = new Array<string>(1_000_000);
		const sparseLedger = ledger({ budgets: { ...BUDGETS, maxSources: sparse.length } });
		expectCode(() => sparseLedger.claimPopulation(countClaim('CAPTURE', sparse)), 'INVALID_INPUT');
		expectCode(() => sparseLedger.finalize(), 'POISONED');

		let armed = false;
		let reads = 0;
		const deadlineClock: TestClock = {
			clock: () => {
				if (!armed) return 100;
				reads += 1;
				return reads >= 3 ? 111 : 100;
			},
			set: () => undefined
		};
		const deadlineLedger = ledger({ clock: deadlineClock });
		armed = true;
		const deadlineError = expectCode(
			() => deadlineLedger.claimPopulation(countClaim('CAPTURE')),
			'BUDGET_EXCEEDED'
		);
		expect(deadlineError).toMatchObject({
			limitKey: 'maxDurationMs',
			phase: 'CAPTURE'
		});
		expectCode(() => deadlineLedger.finalize(), 'POISONED');
	});

	it('rejects malformed clocks, plans, claims, arrays, query inputs, and non-monotonic time with typed errors', () => {
		expectCode(
			() => new SemanticOperationBudgetLedger(BUDGETS, PLAN, Number.MAX_SAFE_INTEGER, () => 0),
			'INVALID_LIMITS'
		);
		expectCode(
			() => new SemanticOperationBudgetLedger(BUDGETS, PLAN, 100, (() => 'now') as never),
			'INVALID_INPUT'
		);

		const malformedClaim = ledger();
		const members = ['a'];
		Object.defineProperty(members, '0', { enumerable: true, get: () => 'a' });
		expectCode(
			() => malformedClaim.claimPopulation(countClaim('CAPTURE', members)),
			'INVALID_INPUT'
		);
		expectCode(() => malformedClaim.finalize(), 'POISONED');

		const malformedQuery = ledger();
		expectCode(
			() =>
				malformedQuery.recordQueryInvocation({
					...query('COMPILER_HOST', 'a/tsconfig.json'),
					extra: true
				} as never),
			'INVALID_INPUT'
		);

		const clock = testClock(100);
		const regressed = ledger({ clock });
		clock.set(99);
		expectCode(() => regressed.claimPopulation(countClaim('CAPTURE')), 'INVALID_INPUT');
		expectCode(() => regressed.finalize(), 'POISONED');
		expect(Object.keys(BUDGETS).sort()).toEqual([...SEMANTIC_BUDGET_KEYS].sort());
	});

	it('rejects hostile object shapes, scalar limits, plan duplicates, and incoherent reconciliation groups', () => {
		const inheritedBudgets = Object.assign(Object.create({ inherited: true }) as object, BUDGETS);
		const symbolicBudgets = { ...BUDGETS } as SemanticBudgets & { [key: symbol]: boolean };
		Object.defineProperty(symbolicBudgets, Symbol('unexpected'), { enumerable: true, value: true });
		const hiddenBudget = { ...BUDGETS };
		Object.defineProperty(hiddenBudget, 'maxAstDepth', {
			enumerable: false,
			value: BUDGETS.maxAstDepth
		});
		for (const invalidBudgets of [
			null,
			[],
			new Proxy({ ...BUDGETS }, {}),
			inheritedBudgets,
			symbolicBudgets,
			hiddenBudget,
			{ ...BUDGETS, maxAstDepth: 0 }
		])
			expectCode(
				() => new SemanticOperationBudgetLedger(invalidBudgets as never, PLAN, 100, () => 100),
				'INVALID_LIMITS'
			);

		expectCode(
			() => new SemanticOperationBudgetLedger(BUDGETS, PLAN, 100, new Proxy(() => 100, {})),
			'INVALID_LIMITS'
		);
		expectCode(
			() => new SemanticOperationBudgetLedger(BUDGETS, PLAN, -1, () => 100),
			'INVALID_LIMITS'
		);

		const duplicateRequired: SemanticOperationBudgetPlan = {
			reconciliationGroups: PLAN.reconciliationGroups,
			requiredClaims: [...PLAN.requiredClaims, PLAN.requiredClaims[0]!]
		};
		const duplicateReference: SemanticOperationBudgetPlan = {
			reconciliationGroups: [
				{
					claims: [
						{ phase: 'CAPTURE', population: 'SOURCES' },
						{ phase: 'CAPTURE', population: 'SOURCES' }
					],
					id: 'duplicate-reference'
				}
			],
			requiredClaims: PLAN.requiredClaims
		};
		const mixedReconciliation: SemanticOperationBudgetPlan = {
			reconciliationGroups: [
				{
					claims: [
						{ phase: 'CAPTURE', population: 'SOURCES' },
						{ phase: 'EXTRACT', population: 'COMPILER_FACTS' }
					],
					id: 'mixed-populations'
				}
			],
			requiredClaims: PLAN.requiredClaims
		};
		const duplicateGroups: SemanticOperationBudgetPlan = {
			reconciliationGroups: [PLAN.reconciliationGroups[0]!, PLAN.reconciliationGroups[0]!],
			requiredClaims: PLAN.requiredClaims
		};
		const invalidGroupId: SemanticOperationBudgetPlan = {
			reconciliationGroups: [{ ...PLAN.reconciliationGroups[0]!, id: '' }],
			requiredClaims: PLAN.requiredClaims
		};
		for (const invalidPlan of [
			duplicateRequired,
			duplicateReference,
			mixedReconciliation,
			duplicateGroups,
			invalidGroupId
		])
			expectCode(
				() => new SemanticOperationBudgetLedger(BUDGETS, invalidPlan, 100, () => 100),
				'INVALID_LIMITS'
			);
	});

	it('rejects hostile claim members and contributions before retaining evidence', () => {
		const accessorMode = countClaim('CAPTURE') as unknown as Record<string, unknown>;
		Object.defineProperty(accessorMode, 'mode', { enumerable: true, get: () => 'COUNT' });
		const accessorLedger = ledger();
		expectCode(() => accessorLedger.claimPopulation(accessorMode as never), 'INVALID_INPUT');

		const proxyMembers = ledger();
		expectCode(
			() => proxyMembers.claimPopulation(countClaim('CAPTURE', new Proxy(['src/a.ts'], {}))),
			'INVALID_INPUT'
		);

		for (const members of [['src/a.ts', 'src/a.ts'], ['\ud800']]) {
			const value = ledger();
			expectCode(() => value.claimPopulation(countClaim('CAPTURE', members)), 'INVALID_INPUT');
		}

		const invalidAmount = ledger();
		expectCode(
			() => invalidAmount.claimPopulation(sumClaim([{ amount: 0, key: 'zero' }])),
			'INVALID_INPUT'
		);

		const tooManyContributions = ledger();
		expectCode(
			() =>
				tooManyContributions.claimPopulation(
					sumClaim(Array.from({ length: 5 }, (_, index) => ({ amount: 1, key: `fact-${index}` })))
				),
			'BUDGET_EXCEEDED'
		);

		const duplicateContributions = ledger();
		expectCode(
			() =>
				duplicateContributions.claimPopulation(
					sumClaim([
						{ amount: 1, key: 'same' },
						{ amount: 1, key: 'same' }
					])
				),
			'INVALID_INPUT'
		);

		const repeated = ledger();
		repeated.claimPopulation(sumClaim());
		expect(() => repeated.claimPopulation(sumClaim())).not.toThrow();
		expectCode(
			() => repeated.claimPopulation(sumClaim([{ amount: 3, key: 'different' }])),
			'CLAIM_CONFLICT'
		);
	});

	it('guards digest identity, path length, finalized mutation, clock failure, and internal reconciliation', () => {
		const digest = ledger();
		expectCode(() => digest.assertLimitsDigest('not-a-digest'), 'INVALID_INPUT');
		expectCode(() => digest.assertLimitsDigest('0'.repeat(64)), 'LIMITS_MISMATCH');
		expect(() => digest.assertLimitsDigest(digest.limitsDigest)).not.toThrow();

		const longPath = ledger();
		expectCode(
			() =>
				longPath.recordQueryInvocation(
					query('COMPILER_HOST', `${'a'.repeat(BUDGETS.maxPathCharacters - 13)}/tsconfig.json`)
				),
			'BUDGET_EXCEEDED'
		);

		const finalized = ledger();
		completeClaims(finalized);
		finalized.finalize();
		expectCode(() => finalized.claimPopulation(countClaim('CAPTURE')), 'FINALIZED');

		let clockArmed = false;
		const clockFailure = ledger({
			clock: {
				clock: () => {
					if (clockArmed) throw new Error('clock failed');
					return 100;
				},
				set: () => undefined
			}
		});
		clockArmed = true;
		expectCode(() => clockFailure.claimPopulation(countClaim('CAPTURE')), 'INVALID_INPUT');

		const unreconciled = ledger();
		completeClaims(unreconciled);
		unreconciled.recordQueryInvocation(query('COMPILER_HOST', 'a/tsconfig.json'));
		(
			unreconciled as unknown as {
				queryInvocations: number;
			}
		).queryInvocations = 2;
		expectCode(() => unreconciled.finalize(), 'RECONCILIATION_FAILED');

		const corruptState = ledger();
		(
			corruptState as unknown as {
				populationClaims: Map<string, unknown> | null;
			}
		).populationClaims = null;
		expectCode(() => corruptState.claimPopulation(countClaim('CAPTURE')), 'INVALID_INPUT');
	});
});
