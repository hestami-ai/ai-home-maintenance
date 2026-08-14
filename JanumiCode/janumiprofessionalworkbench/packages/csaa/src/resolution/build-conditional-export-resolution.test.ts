import { join } from 'node:path';

import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
	CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
	CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionSnapshot
} from '../contracts/conditional-export-resolution.js';
import { sha256 } from '../inventory/canonical.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { buildConditionalExportResolution } from './build-conditional-export-resolution.js';
import {
	CONDITIONAL_EXPORT_FIXTURE_CONSUMER_SOURCE,
	CONDITIONAL_EXPORT_FIXTURE_MANIFEST_PATH,
	CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME,
	conditionalExportResolutionInputs,
	createConditionalExportResolutionFixture,
	duplicateConditionalExportManifest,
	rootConditionSugarManifest,
	supportedConditionalExportManifest,
	unsupportedConditionalExportManifest,
	type ConditionalExportResolutionFixture
} from './conditional-export-resolution-fixture.test-support.js';
import { validateConditionalExportResolution } from './validate-conditional-export-resolution.js';

function resolution(
	inputs: ConditionalExportResolutionBuildInputs
): ConditionalExportResolutionSnapshot {
	const outcome = buildConditionalExportResolution(inputs);
	expect(outcome.outcome).toBe('partial');
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	expect(validateConditionalExportResolution(outcome.resolution, inputs)).toEqual({
		issues: [],
		state: 'VALID'
	});
	return outcome.resolution;
}

function rawManifest(fixture: ConditionalExportResolutionFixture): string {
	const bytes = readFrozenSubjectArtifact(
		fixture.frozenSubject,
		CONDITIONAL_EXPORT_FIXTURE_MANIFEST_PATH
	);
	if (bytes === undefined) throw new Error('Fixture manifest bytes are unavailable.');
	return new TextDecoder().decode(bytes);
}

function slice(
	text: string,
	span: { readonly length: number; readonly start: number } | null
): string | null {
	return span === null ? null : text.slice(span.start, span.start + span.length);
}

function manifestWithExports(exportsSource: string, extraRootProperties = ''): string {
	return `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0"${extraRootProperties},
  "exports": ${exportsSource}
}\n`;
}

function plainDataUsage(value: unknown): { readonly records: number; readonly strings: number } {
	let records = 0;
	let strings = 0;
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const child = pending.pop();
		records += 1;
		if (typeof child === 'string') {
			strings += child.length;
			continue;
		}
		if (child === null || typeof child !== 'object') continue;
		if (Array.isArray(child)) {
			for (let index = child.length - 1; index >= 0; index -= 1) {
				strings += String(index).length;
				pending.push(child[index]);
			}
			continue;
		}
		for (const key of Object.keys(child).reverse()) {
			strings += key.length;
			pending.push((child as Record<string, unknown>)[key]);
		}
	}
	return { records, strings };
}

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
	if (value === null || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	expect(Object.isFrozen(value)).toBe(true);
	for (const child of Object.values(value)) expectDeeplyFrozen(child, seen);
}

describe('buildConditionalExportResolution', { timeout: 30_000 }, () => {
	let fixture: ConditionalExportResolutionFixture;

	beforeAll(() => {
		fixture = createConditionalExportResolutionFixture();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('resolves the exact frozen export criterion in raw declaration order with exact witnesses', () => {
		const inputs = conditionalExportResolutionInputs(fixture);
		const result = resolution(inputs);
		const raw = rawManifest(fixture);

		expect(result.capability).toBe(CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY);
		expect(result.capabilityStatus).toBe(CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS);
		expect(result.fullJanCsaa012Conformance).toBe(
			CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE
		);
		expect(result.resolutionAuthority).toBe(CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY);
		expect(result.authorityTransfer).toBe(CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER);
		expect(result.gateEffect).toBe(CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT);
		expect(result.freshness).toBe(CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS);
		expect(result.currentness).toBe(CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS);
		expect(result.nonclaims).toEqual(CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS);
		expect(result.closure).toBe('CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION');
		expect(result.resultCompleteness).toBe(
			'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_CRITERION'
		);
		expect(result.consumerEnvironment).toMatchObject({
			conditions: ['source', 'types', 'browser'],
			effectiveConditions: ['source', 'types', 'browser', 'node', 'import'],
			logicalPath: CONDITIONAL_EXPORT_FIXTURE_CONSUMER_SOURCE,
			moduleMode: 'IMPORT',
			platform: 'NODE'
		});
		expect(result.exactKeyOutcome).toMatchObject({
			exportSubpath: '.',
			matchKind: 'EXPLICIT_SUBPATH_KEY',
			state: 'MATCHED'
		});
		expect(result.decision).toMatchObject({
			state: 'SELECTED_TARGET',
			target: './src/index.ts'
		});
		expect(result.branches.map((branch) => branch.condition)).toEqual([
			'source',
			'types',
			'import',
			'browser',
			'default',
			'default'
		]);
		expect(result.branches.map((branch) => branch.declarationOrdinal)).toEqual([
			6, 7, 8, 9, 10, 11
		]);
		expect(result.branches.map((branch) => branch.depth)).toEqual([0, 0, 0, 1, 1, 0]);
		expect(result.branches.map((branch) => branch.evaluation)).toEqual([
			'SELECTED',
			'EXCLUDED',
			'EXCLUDED',
			'EXCLUDED',
			'EXCLUDED',
			'EXCLUDED'
		]);
		expect(result.branches.slice(1).map((branch) => branch.exclusionReason)).toEqual(
			Array(5).fill('PRIOR_BRANCH_TERMINATED_EVALUATION')
		);
		expect(result.frontiers).toEqual([]);
		expect(result.coverage).toMatchObject({
			astNodes: 70,
			branchRecords: 6,
			candidateBranches: 0,
			chargedTraversalSteps: 80,
			conditionChecks: 6,
			exactExportKeyComparisons: 4,
			excludedBranches: 5,
			frontierRecords: 0,
			manifestBytes: 680,
			outputRecords: 7,
			selectedBranches: 1,
			selectedTargetDecisions: 1
		});
		expect(result.coverage.chargedTraversalSteps).toBe(
			result.coverage.astNodes +
				result.coverage.exactExportKeyComparisons +
				result.coverage.branchRecords +
				result.coverage.frontierRecords
		);
		expect(result.coverage.outputRecords).toBe(
			1 + result.branches.length + result.frontiers.length
		);
		expect(slice(raw, result.manifestWitness.rootSpan)).toBe(raw.trim());
		expect(slice(raw, result.manifestWitness.exportsPropertySpan)).toContain('"exports"');
		const exportsValue = slice(raw, result.manifestWitness.exportsValueSpan)!;
		expect(sha256(exportsValue)).toBe(result.manifestWitness.exportsValueSha256);
		expect(slice(raw, result.branches[0]!.keySpan)).toBe('"source"');
		expect(slice(raw, result.branches[0]!.valueSpan)).toBe('"./src/index.ts"');
		expect(validateConditionalExportResolution(result, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('changes the chosen branch when declaration order changes and agrees with TypeScript 5.9.3', () => {
		const reordered = createConditionalExportResolutionFixture(
			supportedConditionalExportManifest(['types', 'source', 'import', 'default'])
		);
		try {
			const normalResult = resolution(conditionalExportResolutionInputs(fixture));
			const reorderedResult = resolution(conditionalExportResolutionInputs(reordered));
			expect(normalResult.decision.target).toBe('./src/index.ts');
			expect(reorderedResult.decision.target).toBe('./dist/index.d.ts');
			expect(reorderedResult.branches.slice(0, 2).map((branch) => branch.condition)).toEqual([
				'types',
				'source'
			]);
			expect(reorderedResult.id).not.toBe(normalResult.id);

			const compilerOptions: ts.CompilerOptions = {
				customConditions: ['source', 'browser'],
				module: ts.ModuleKind.ESNext,
				moduleResolution: ts.ModuleResolutionKind.Bundler
			};
			const oracle = (candidate: ConditionalExportResolutionFixture) =>
				ts.resolveModuleName(
					CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME,
					join(candidate.root, 'packages/consumer/src/index.ts'),
					compilerOptions,
					ts.sys
				).resolvedModule;
			expect(ts.version).toBe('5.9.3');
			expect(oracle(fixture)?.resolvedFileName.replaceAll('\\', '/')).toMatch(/\/src\/index\.ts$/u);
			expect(oracle(reordered)?.resolvedFileName.replaceAll('\\', '/')).toMatch(
				/\/dist\/index\.d\.ts$/u
			);
		} finally {
			reordered.cleanup();
		}
	});

	it('distinguishes exact subpath, blocking null, no-match, and exact-key-miss decisions', () => {
		const feature = resolution(
			conditionalExportResolutionInputs(fixture, { exportSubpath: './feature' })
		);
		expect(feature.decision).toMatchObject({
			state: 'SELECTED_TARGET',
			target: './src/feature.ts'
		});
		const blocked = resolution(
			conditionalExportResolutionInputs(fixture, {
				conditions: ['source'],
				exportSubpath: './blocked'
			})
		);
		expect(blocked.decision.state).toBe('BLOCKED_BY_NULL');
		expect(blocked.decision.selectedBranchId).toBe(blocked.branches[0]!.id);
		expect(blocked.branches.map((branch) => branch.evaluation)).toEqual(['SELECTED', 'EXCLUDED']);
		const noMatch = resolution(
			conditionalExportResolutionInputs(fixture, {
				conditions: [],
				exportSubpath: './no-match',
				platform: 'NEUTRAL'
			})
		);
		expect(noMatch.decision.state).toBe('NO_MATCHING_CONDITION');
		expect(noMatch.branches[0]).toMatchObject({
			condition: 'browser',
			conditionMatch: 'INACTIVE',
			evaluation: 'EXCLUDED',
			exclusionReason: 'CONDITION_INACTIVE'
		});
		const absent = resolution(
			conditionalExportResolutionInputs(fixture, { exportSubpath: './absent' })
		);
		expect(absent.exactKeyOutcome).toEqual({ exportSubpath: './absent', state: 'ABSENT' });
		expect(absent.decision.state).toBe('NO_EXACT_EXPORT_KEY');
	});

	it('supports direct root string/null sugar with literal zero branch, check, and frontier capacities', () => {
		for (const [exportsSource, state, target] of [
			['"./src/index.ts"', 'SELECTED_TARGET', './src/index.ts'],
			['null', 'BLOCKED_BY_NULL', null]
		] as const) {
			const direct = createConditionalExportResolutionFixture(manifestWithExports(exportsSource));
			try {
				const result = resolution(
					conditionalExportResolutionInputs(
						direct,
						{},
						{
							maxBranches: 0,
							maxConditionChecks: 0,
							maxFrontiers: 0,
							maxOutputRecords: 1
						}
					)
				);
				expect(result.exactKeyOutcome).toMatchObject({
					matchKind: 'ROOT_DOT_SUGAR',
					state: 'MATCHED'
				});
				expect(result.decision).toMatchObject({ state, target });
				expect(result.coverage).toMatchObject({
					branchRecords: 0,
					conditionChecks: 0,
					frontierRecords: 0,
					outputRecords: 1
				});
			} finally {
				direct.cleanup();
			}
		}
	});

	it('records arrays, patterns, imports, root condition sugar, and unsafe targets as frontiers', () => {
		const unsupported = createConditionalExportResolutionFixture(
			unsupportedConditionalExportManifest()
		);
		const rootSugar = createConditionalExportResolutionFixture(rootConditionSugarManifest());
		const unsafeTarget = createConditionalExportResolutionFixture(
			manifestWithExports('{ ".": "../outside.js" }')
		);
		try {
			const unsupportedResult = resolution(conditionalExportResolutionInputs(unsupported));
			expect(unsupportedResult.decision.state).toBe('UNSUPPORTED');
			expect(unsupportedResult.closure).toBe('OPEN_FOR_SELECTED_EXACT_EXPORT_DECISION');
			expect(unsupportedResult.frontiers.map((frontier) => frontier.reason)).toEqual([
				'PACKAGE_IMPORTS_MAP_UNSUPPORTED',
				'EXPORT_ARRAY_FALLBACK_UNSUPPORTED',
				'EXPORT_PATTERN_KEY_UNSUPPORTED'
			]);
			expect(unsupportedResult.frontiers.map((frontier) => frontier.impact)).toEqual([
				'OUTSIDE_SELECTED_DECISION',
				'BLOCKS_SELECTED_DECISION',
				'OUTSIDE_SELECTED_DECISION'
			]);
			const patternBlocked = resolution(
				conditionalExportResolutionInputs(unsupported, { exportSubpath: './absent' })
			);
			expect(patternBlocked.decision.state).toBe('UNSUPPORTED');
			expect(
				patternBlocked.frontiers.find(
					(frontier) => frontier.reason === 'EXPORT_PATTERN_KEY_UNSUPPORTED'
				)?.impact
			).toBe('BLOCKS_SELECTED_DECISION');
			const sugarResult = resolution(conditionalExportResolutionInputs(rootSugar));
			expect(sugarResult.decision.state).toBe('UNSUPPORTED');
			expect(sugarResult.frontiers[0]?.reason).toBe('EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED');
			const unsafeResult = resolution(conditionalExportResolutionInputs(unsafeTarget));
			expect(unsafeResult.decision).toMatchObject({
				selectedBranchId: null,
				state: 'UNSUPPORTED',
				target: null
			});
			expect(unsafeResult.frontiers[0]?.reason).toBe('UNSUPPORTED_EXPORT_TARGET_SYNTAX');
		} finally {
			unsupported.cleanup();
			rootSugar.cleanup();
			unsafeTarget.cleanup();
		}
	});

	it('rejects decoded duplicate keys and mixed subpath/condition maps without JSON.parse collapse', () => {
		for (const manifest of [
			duplicateConditionalExportManifest(),
			manifestWithExports('{ ".": "./src/index.ts", "default": "./dist/index.js" }')
		]) {
			const invalid = createConditionalExportResolutionFixture(manifest);
			try {
				const outcome = buildConditionalExportResolution(
					conditionalExportResolutionInputs(invalid)
				);
				expect(outcome.outcome).toBe('unavailable');
				if (outcome.outcome === 'unavailable')
					expect(outcome.diagnostics[0]?.code).toBe('MANIFEST_INVALID');
			} finally {
				invalid.cleanup();
			}
		}
	});

	it('accepts exact operation thresholds and rejects every positive one-below threshold', () => {
		const generousInputs = conditionalExportResolutionInputs(fixture);
		const exact = resolution(generousInputs);
		const usage = plainDataUsage(generousInputs);
		const thresholds = {
			maxAstNodes: exact.coverage.astNodes,
			maxBranches: exact.coverage.branchRecords,
			maxConditionChecks: exact.coverage.conditionChecks,
			maxInputRecords: usage.records,
			maxInputStringCharacters: usage.strings,
			maxManifestBytes: exact.coverage.manifestBytes,
			maxOutputRecords: exact.coverage.outputRecords,
			maxTraversalSteps: exact.coverage.chargedTraversalSteps
		};
		for (const [budget, threshold] of Object.entries(thresholds)) {
			const atLimit = buildConditionalExportResolution(
				conditionalExportResolutionInputs(fixture, {}, { [budget]: threshold })
			);
			expect(atLimit.outcome, budget).toBe('partial');
			const below = buildConditionalExportResolution(
				conditionalExportResolutionInputs(fixture, {}, { [budget]: threshold - 1 })
			);
			expect(below.outcome, budget).toBe('unavailable');
			if (below.outcome === 'unavailable')
				expect(below.diagnostics[0]?.code, budget).toBe('BUDGET_EXCEEDED');
		}
		const unsupported = createConditionalExportResolutionFixture(
			unsupportedConditionalExportManifest()
		);
		try {
			const frontierCount = resolution(conditionalExportResolutionInputs(unsupported)).frontiers
				.length;
			expect(
				buildConditionalExportResolution(
					conditionalExportResolutionInputs(unsupported, {}, { maxFrontiers: frontierCount })
				).outcome
			).toBe('partial');
			const below = buildConditionalExportResolution(
				conditionalExportResolutionInputs(unsupported, {}, { maxFrontiers: frontierCount - 1 })
			);
			expect(below.outcome).toBe('unavailable');
			if (below.outcome === 'unavailable')
				expect(below.diagnostics[0]?.code).toBe('BUDGET_EXCEEDED');
		} finally {
			unsupported.cleanup();
		}
	});

	it('is deterministic, deeply frozen, caller-owned, and emits ten completed phases', async () => {
		const inputs = conditionalExportResolutionInputs(fixture);
		const originalCondition = inputs.request.conditions[0];
		const events: { phase: string; state: string }[] = [];
		const firstOutcome = buildConditionalExportResolution(inputs, {
			onProgress(event) {
				events.push(event);
			}
		});
		expect(firstOutcome.outcome).toBe('partial');
		if (firstOutcome.outcome !== 'partial') throw new Error(JSON.stringify(firstOutcome));
		const second = resolution(conditionalExportResolutionInputs(fixture));
		expect(firstOutcome.resolution).toEqual(second);
		expectDeeplyFrozen(firstOutcome);
		expect(Object.isFrozen(inputs)).toBe(false);
		(inputs.request.conditions as string[])[0] = 'changed-after-build';
		expect(firstOutcome.resolution.consumerEnvironment.conditions[0]).toBe(originalCondition);
		await Promise.resolve();
		expect(events).toHaveLength(20);
		expect(
			events.filter((event) => event.state === 'COMPLETED').map((event) => event.phase)
		).toEqual([
			'REQUEST_BIND',
			'INPUT_BUDGET',
			'PROJECT_CONTEXT_GRAPH_VALIDATE',
			'CONSUMER_BIND',
			'MANIFEST_PARSE',
			'EXPORT_KEY_MATCH',
			'CONDITION_EVALUATE',
			'MATERIALIZE',
			'SERIALIZE',
			'RESOLUTION_VALIDATE'
		]);
	});
});
