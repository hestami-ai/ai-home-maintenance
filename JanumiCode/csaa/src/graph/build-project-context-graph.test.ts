import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER,
	PROJECT_CONTEXT_GRAPH_CURRENTNESS,
	PROJECT_CONTEXT_GRAPH_FRESHNESS,
	PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE,
	PROJECT_CONTEXT_GRAPH_GATE_EFFECT,
	PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY,
	PROJECT_CONTEXT_GRAPH_NONCLAIMS,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphSnapshot,
	type ProjectContextGraphProgressEvent
} from '../contracts/project-context-graph.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import * as semanticValidation from '../semantic/validate-snapshot.js';
import { buildProjectContextGraph } from './build-project-context-graph.js';
import {
	createProjectContextGraphFixture,
	createProjectContextGraphFixtureWithoutProjectReferences,
	projectContextGraphInputs,
	type ProjectContextGraphFixture
} from './project-context-graph-fixture.test-support.js';
import {
	validateConstructedProjectContextGraph,
	validateProjectContextGraph
} from './validate-project-context-graph.js';

let fixture: ProjectContextGraphFixture;

beforeAll(() => {
	fixture = createProjectContextGraphFixture();
});

afterAll(() => {
	fixture.cleanup();
});

function graph(inputs: ProjectContextGraphBuildInputs = projectContextGraphInputs(fixture)) {
	const outcome = buildProjectContextGraph(inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome.graph;
}

function plainDataUsage(value: unknown): { readonly records: number; readonly strings: number } {
	const pending: unknown[] = [value];
	let records = 0;
	let strings = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		records += 1;
		if (typeof current === 'string') {
			strings += current.length;
			continue;
		}
		if (current === null || typeof current !== 'object') continue;
		const keys = Reflect.ownKeys(current).filter(
			(key): key is string =>
				typeof key === 'string' && !(Array.isArray(current) && key === 'length')
		);
		for (const key of [...keys].reverse()) {
			strings += key.length;
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor !== undefined && 'value' in descriptor) pending.push(descriptor.value);
		}
	}
	return { records, strings };
}

function cloneGraph(value: ProjectContextGraphSnapshot): ProjectContextGraphSnapshot {
	return structuredClone(value) as ProjectContextGraphSnapshot;
}

describe('buildProjectContextGraph', () => {
	it('projects the exact validated project, Program, source, membership, and reference populations', () => {
		const inputs = projectContextGraphInputs(fixture);
		const result = graph(inputs);

		expect(fixture.frozenSubject.projects).toHaveLength(3);
		expect(fixture.semanticSnapshot.projects).toHaveLength(3);
		expect(fixture.semanticSnapshot.programs).toHaveLength(3);
		expect(fixture.semanticSnapshot.sources).toHaveLength(4);
		expect(result.projects).toHaveLength(3);
		expect(result.programs).toHaveLength(3);
		expect(result.sources).toHaveLength(4);
		expect(result.projectReferences).toHaveLength(2);
		expect(result.memberships).toHaveLength(7);
		expect(result.outsideSelectedProjectReferences).toEqual([]);
		expect(result.unresolvedProjectReferences).toEqual([]);
		expect(result.closure).toBe('CLOSED_FOR_ALL_DECLARED_PROJECT_REFERENCES');
		expect(result.resultCompleteness).toBe(
			'COMPLETE_FOR_VALIDATED_SELECTED_PROJECT_CONTEXT_POPULATIONS'
		);
		expect(result.health).toBe('PARTIAL');
		expect(result.selection).toEqual(PROJECT_CONTEXT_GRAPH_SELECTION);
		expect(result.nonclaims).toEqual(PROJECT_CONTEXT_GRAPH_NONCLAIMS);
		expect(result.graphAuthority).toBe(PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY);
		expect(result.authorityTransfer).toBe(PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER);
		expect(result.gateEffect).toBe(PROJECT_CONTEXT_GRAPH_GATE_EFFECT);
		expect(result.freshness).toBe(PROJECT_CONTEXT_GRAPH_FRESHNESS);
		expect(result.currentness).toBe(PROJECT_CONTEXT_GRAPH_CURRENTNESS);
		expect(result.fullJanCsaa010Conformance).toBe(
			PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE
		);
		expect(result.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });

		const configurationClosureRecords = fixture.frozenSubject.projects.reduce(
			(total, project) => total + project.configClosure.length,
			0
		);
		expect(result.coverage).toEqual({
			chargedInputTraversalSteps: 3 + 3 + 4 + 2 + configurationClosureRecords,
			configurationClosureRecords,
			declaredProjectReferences: 2,
			inputPrograms: 3,
			inputProjects: 3,
			inputSources: 4,
			memberships: 7,
			outsideSelectedProjectReferences: 0,
			programPopulationReconciles: true,
			programSourceMemberships: 4,
			projectPopulationReconciles: true,
			projectedPrograms: 3,
			projectedProjects: 3,
			projectedSources: 4,
			projectProgramMemberships: 3,
			referencePopulationReconciles: true,
			resolvedProjectReferences: 2,
			sourcePopulationReconciles: true,
			unresolvedProjectReferences: 0
		});

		const solution = result.projects.find((project) => project.configPath === 'tsconfig.json');
		expect(solution).toMatchObject({
			kind: 'SOLUTION',
			rootDisposition: 'INTENTIONAL_EMPTY_SOLUTION',
			rootNames: [],
			sourceIds: []
		});
		expect(result.projectReferences.map((reference) => reference.resolution)).toEqual([
			'RESOLVED_SELECTED_PROJECT',
			'RESOLVED_SELECTED_PROJECT'
		]);
		expect(result.projectReferences.map((reference) => reference.declaredTargetConfigPath)).toEqual(
			['packages/left/tsconfig.json', 'packages/right/tsconfig.json']
		);
		expect(
			result.memberships.filter((member) => member.kind === 'PROJECT_HAS_PROGRAM')
		).toHaveLength(3);
		expect(
			result.memberships.filter((member) => member.kind === 'PROGRAM_HAS_SOURCE')
		).toHaveLength(4);

		expect(result.semanticValidationWitness).toEqual({
			context: 'FROZEN_SUBJECT',
			frozenSubjectSha256: canonicalSemanticJsonWitness(fixture.frozenSubject).sha256,
			method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT',
			semanticSnapshotId: fixture.semanticSnapshot.id,
			semanticSnapshotSha256: canonicalSemanticJsonWitness(fixture.semanticSnapshot).sha256,
			state: 'VALID',
			subjectId: fixture.frozenSubject.descriptor.subjectId
		});
		expect(validateProjectContextGraph(result, inputs)).toEqual({ issues: [], state: 'VALID' });
	});

	it('uses natural semantic keys for canonical record ordering and ordinals', () => {
		const result = graph();
		expect(result.projects.map((record) => record.configPath)).toEqual(
			[...result.projects.map((record) => record.configPath)].sort()
		);
		expect(result.programs.map((record) => record.semanticProgramId)).toEqual(
			[...result.programs.map((record) => record.semanticProgramId)].sort()
		);
		expect(
			result.sources.map((record) => [
				record.semanticProgramId,
				record.logicalPath,
				record.semanticSourceId
			])
		).toEqual(
			[...result.sources]
				.sort((left, right) =>
					`${left.semanticProgramId}\0${left.logicalPath}\0${left.semanticSourceId}`.localeCompare(
						`${right.semanticProgramId}\0${right.logicalPath}\0${right.semanticSourceId}`
					)
				)
				.map((record) => [record.semanticProgramId, record.logicalPath, record.semanticSourceId])
		);
		for (const population of [
			result.projects,
			result.programs,
			result.sources,
			result.memberships,
			result.projectReferences
		])
			expect(population.map((record) => record.ordinal)).toEqual(
				population.map((_record, ordinal) => ordinal)
			);
		const sourceIdBySemanticId = new Map(
			result.sources.map((source) => [source.semanticSourceId, source.id])
		);
		const multiSourceProgram = fixture.semanticSnapshot.programs.find(
			(program) => program.sourceIds.length > 1
		);
		expect(multiSourceProgram).toBeDefined();
		const naturallyMappedSourceIds = multiSourceProgram!.sourceIds.map((sourceId) =>
			sourceIdBySemanticId.get(sourceId)
		);
		expect(naturallyMappedSourceIds).not.toEqual([...naturallyMappedSourceIds].sort());
		expect(multiSourceProgram!.rootSourceIds).toEqual(multiSourceProgram!.sourceIds);
		for (const project of fixture.semanticSnapshot.projects) {
			const projected = result.projects.find(
				(candidate) => candidate.semanticProjectId === project.id
			);
			expect(projected?.sourceIds).toEqual(
				project.sourceIds.map((sourceId) => sourceIdBySemanticId.get(sourceId))
			);
		}
		for (const program of fixture.semanticSnapshot.programs) {
			const projected = result.programs.find(
				(candidate) => candidate.semanticProgramId === program.id
			);
			expect(projected?.sourceIds).toEqual(
				program.sourceIds.map((sourceId) => sourceIdBySemanticId.get(sourceId))
			);
			expect(projected?.rootSourceIds).toEqual(
				program.rootSourceIds.map((sourceId) => sourceIdBySemanticId.get(sourceId))
			);
		}
	});

	it('is deterministic, deeply freezes results, and never freezes or aliases caller-owned inputs', () => {
		const inputs = projectContextGraphInputs(fixture);
		const callerFreezeState = {
			configurationClosure: Object.isFrozen(inputs.frozenSubject.projects[0]?.configClosure),
			origin: Object.isFrozen(inputs.semanticSnapshot.sources[0]?.origin),
			programRecipe: Object.isFrozen(inputs.semanticSnapshot.projects[0]?.programRecipe),
			requestBudgets: Object.isFrozen(inputs.request.budgets),
			selection: Object.isFrozen(inputs.request.selection),
			selectionRelations: Object.isFrozen(inputs.request.selection.membershipRelations)
		};
		const first = graph(inputs);
		const second = graph(projectContextGraphInputs(fixture));
		expect(second).toEqual(first);
		expect(second).not.toBe(first);
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.projects[0]?.configurationClosure)).toBe(true);
		expect(Object.isFrozen(first.projects[0]?.programRecipe)).toBe(true);
		expect(Object.isFrozen(first.projects[0]?.partialityReasons)).toBe(true);
		expect(Object.isFrozen(first.sources[0]?.origin)).toBe(true);
		expect({
			configurationClosure: Object.isFrozen(inputs.frozenSubject.projects[0]?.configClosure),
			origin: Object.isFrozen(inputs.semanticSnapshot.sources[0]?.origin),
			programRecipe: Object.isFrozen(inputs.semanticSnapshot.projects[0]?.programRecipe),
			requestBudgets: Object.isFrozen(inputs.request.budgets),
			selection: Object.isFrozen(inputs.request.selection),
			selectionRelations: Object.isFrozen(inputs.request.selection.membershipRelations)
		}).toEqual(callerFreezeState);
		expect(first.budgets).not.toBe(inputs.request.budgets);
		expect(first.selection).not.toBe(inputs.request.selection);
		expect(first.selection.membershipRelations).not.toBe(
			inputs.request.selection.membershipRelations
		);
		expect(first.projects[0]?.configurationClosure).not.toBe(
			inputs.frozenSubject.projects.find(
				(project) => project.configPath === first.projects[0]?.configPath
			)?.configClosure
		);
		expect(first.projects[0]?.programRecipe).not.toBe(
			inputs.semanticSnapshot.projects.find(
				(project) => project.id === first.projects[0]?.semanticProjectId
			)?.programRecipe
		);
	});

	it('emits the exact successful ten-phase progress partition asynchronously', async () => {
		const events: ProjectContextGraphProgressEvent[] = [];
		const outcome = buildProjectContextGraph(projectContextGraphInputs(fixture), {
			onProgress(event) {
				events.push(event);
			}
		});
		expect(outcome.outcome).toBe('partial');
		expect(events).toEqual([]);
		await Promise.resolve();
		const phases = [
			'REQUEST_BIND',
			'INPUT_BUDGET',
			'SEMANTIC_SNAPSHOT_VALIDATE',
			'PROJECT_CONTEXT_PROJECT',
			'REFERENCE_RESOLUTION',
			'MEMBERSHIP_PROJECT',
			'POPULATION_RECONCILE',
			'MATERIALIZE',
			'SERIALIZE',
			'GRAPH_VALIDATE'
		] as const;
		expect(events.map((event) => [event.phase, event.state])).toEqual(
			phases.flatMap((phase) => [
				[phase, 'STARTED'],
				[phase, 'COMPLETED']
			])
		);
		expect(events.map((event) => event.sequence)).toEqual(events.map((_event, index) => index));
		expect(events.every(Object.isFrozen)).toBe(true);
	});

	it('accepts every exact operation threshold and rejects each one-below threshold', () => {
		const base = projectContextGraphInputs(fixture);
		const usage = plainDataUsage(base);
		const exactInputs: ProjectContextGraphBuildInputs = {
			...base,
			request: {
				...base.request,
				budgets: {
					...base.request.budgets,
					maxInputRecords: usage.records,
					maxInputStringCharacters: usage.strings
				}
			}
		};
		expect(buildProjectContextGraph(exactInputs).outcome).toBe('partial');

		const thresholdKeys = [
			'maxConfigurationClosureRecords',
			'maxInputRecords',
			'maxInputStringCharacters',
			'maxMemberships',
			'maxOutputRecords',
			'maxPrograms',
			'maxProjectReferences',
			'maxProjects',
			'maxSources',
			'maxTraversalSteps'
		] as const;
		for (const key of thresholdKeys) {
			const oneBelow = {
				...exactInputs,
				request: {
					...exactInputs.request,
					budgets: {
						...exactInputs.request.budgets,
						[key]: exactInputs.request.budgets[key] - 1
					}
				}
			};
			const outcome = buildProjectContextGraph(oneBelow);
			expect(outcome, key).toMatchObject({
				diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
				outcome: 'unavailable'
			});
		}
	});

	it('accepts zero-capacity source and project-reference budgets without confusing them with malformed requests', () => {
		const withoutReferences = createProjectContextGraphFixtureWithoutProjectReferences();
		try {
			const zeroReferenceInputs = projectContextGraphInputs(withoutReferences);
			expect(
				zeroReferenceInputs.semanticSnapshot.projects.flatMap(
					(project) => project.projectReferences
				)
			).toEqual([]);
			expect(zeroReferenceInputs.request.budgets.maxProjectReferences).toBe(0);
			const outcome = buildProjectContextGraph(zeroReferenceInputs);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.graph.projectReferences).toEqual([]);
			expect(validateProjectContextGraph(outcome.graph, zeroReferenceInputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
		} finally {
			withoutReferences.cleanup();
		}

		const base = projectContextGraphInputs(fixture);
		const zeroSourceCapacity: ProjectContextGraphBuildInputs = {
			...base,
			request: {
				...base.request,
				budgets: { ...base.request.budgets, maxSources: 0 }
			}
		};
		expect(buildProjectContextGraph(zeroSourceCapacity)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});
		expect(validateProjectContextGraph(graph(), zeroSourceCapacity)).toMatchObject({
			issues: [{ code: 'BUDGET_EXHAUSTED' }],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('reuses only the producer-established predecessor validity in the trust-only constructed check', () => {
		const inputs = projectContextGraphInputs(fixture);
		const validateSemantic = vi.spyOn(semanticValidation, 'validateStaticSemanticSnapshot');
		try {
			const outcome = buildProjectContextGraph(inputs);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(validateSemantic).toHaveBeenCalledTimes(1);

			validateSemantic.mockClear();
			expect(validateProjectContextGraph(outcome.graph, inputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expect(validateSemantic).toHaveBeenCalledTimes(1);

			validateSemantic.mockClear();
			expect(
				validateConstructedProjectContextGraph(outcome.graph, inputs, outcome.graph.inputDigest)
			).toEqual({ issues: [], state: 'VALID' });
			expect(validateSemantic).not.toHaveBeenCalled();
		} finally {
			validateSemantic.mockRestore();
		}
	});

	it('fails closed for mismatched identities, an unattached subject, and invalid semantic evidence', () => {
		const base = projectContextGraphInputs(fixture);
		for (const inputs of [
			{
				...base,
				request: { ...base.request, subjectId: `${base.request.subjectId}-stale` }
			},
			{
				...base,
				request: {
					...base.request,
					semanticSnapshotId:
						`${base.request.semanticSnapshotId}-stale` as typeof base.request.semanticSnapshotId
				}
			}
		])
			expect(buildProjectContextGraph(inputs)).toMatchObject({
				diagnostics: [{ code: 'INPUT_IDENTITY_MISMATCH' }],
				outcome: 'unavailable'
			});

		const unattached = {
			...base,
			frozenSubject: structuredClone(base.frozenSubject)
		};
		expect(buildProjectContextGraph(unattached)).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable'
		});

		const invalidSnapshot = structuredClone(base.semanticSnapshot);
		const invalidProject = invalidSnapshot.projects[0]! as unknown as {
			programRecipe: { compilerOptions: Record<string, unknown> };
		};
		invalidProject.programRecipe.compilerOptions = {
			...invalidProject.programRecipe.compilerOptions,
			strict: false
		};
		expect(buildProjectContextGraph({ ...base, semanticSnapshot: invalidSnapshot })).toMatchObject({
			diagnostics: [{ code: 'SEMANTIC_SNAPSHOT_INVALID' }],
			outcome: 'unavailable'
		});
	});

	it('never invokes hostile input accessors and charges unknown record keys before shape handling', () => {
		const base = projectContextGraphInputs(fixture);
		const snapshot = { ...base.semanticSnapshot } as Record<string, unknown>;
		let getterCalls = 0;
		Object.defineProperty(snapshot, 'hostile', {
			enumerable: true,
			get() {
				getterCalls += 1;
				return null;
			}
		});
		expect(
			buildProjectContextGraph({ ...base, semanticSnapshot: snapshot as never })
		).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable'
		});
		expect(getterCalls).toBe(0);

		const hugeKeySnapshot = { ...base.semanticSnapshot } as Record<string, unknown>;
		hugeKeySnapshot['x'.repeat(100_000)] = null;
		const hugeKeyInputs = {
			...base,
			request: {
				...base.request,
				budgets: { ...base.request.budgets, maxInputStringCharacters: 1 }
			},
			semanticSnapshot: hugeKeySnapshot as never
		};
		expect(buildProjectContextGraph(hugeKeyInputs)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});
	});

	it('public validation rejects a corrupted successful population', () => {
		const inputs = projectContextGraphInputs(fixture);
		const valid = graph(inputs);
		const corrupted = cloneGraph(valid) as unknown as {
			coverage: { projectedProjects: number };
		};
		corrupted.coverage.projectedProjects += 1;
		const validation = validateProjectContextGraph(corrupted, inputs);
		expect(validation.state).toBe('INVALID');
		expect(validation.issues.length).toBeGreaterThan(0);
	});
});
