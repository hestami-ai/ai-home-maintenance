import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
	DeclarationContextAnalysisBuildInputs,
	DeclarationContextAnalysisSnapshot,
	DeclarationContextProgramSourceIdentity
} from '../contracts/declaration-context-analysis.js';
import { sha256 } from '../inventory/canonical.js';
import { buildDeclarationContextAnalysis } from './build-declaration-context-analysis.js';
import { canonicalSemanticJson, canonicalSemanticJsonPrefixedSha256 } from './canonical.js';
import {
	createDeclarationContextAnalysisFixture,
	declarationContextAnalysisInputs,
	type DeclarationContextAnalysisFixture
} from './declaration-context-analysis-fixture.test-support.js';
import { validateDeclarationContextAnalysis } from './validate-declaration-context-analysis.js';
import { declarationContextProgramSourcePopulationDigest } from './declaration-context-analysis-canonical.js';

function requireAnalysis(
	inputs: DeclarationContextAnalysisBuildInputs
): DeclarationContextAnalysisSnapshot {
	const outcome = buildDeclarationContextAnalysis(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Expected partial CAP-013 analysis: ${JSON.stringify(outcome)}`);
	expect(outcome.diagnostics).toEqual([]);
	expect(validateDeclarationContextAnalysis(outcome.analysis, inputs)).toEqual({
		issues: [],
		state: 'VALID'
	});
	return outcome.analysis;
}

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
	const object = value as object;
	if (seen.has(object)) return;
	seen.add(object);
	expect(Object.isFrozen(object)).toBe(true);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			expectDeeplyFrozen(descriptor.value, seen);
	}
}

describe('buildDeclarationContextAnalysis', () => {
	let mergedFixture: DeclarationContextAnalysisFixture;
	let singleFixture: DeclarationContextAnalysisFixture;

	beforeAll(() => {
		mergedFixture = createDeclarationContextAnalysisFixture({ declarationState: 'MERGED' });
		singleFixture = createDeclarationContextAnalysisFixture({ declarationState: 'SINGLE' });
	}, 120_000);

	afterAll(() => {
		mergedFixture.cleanup();
		singleFixture.cleanup();
	});

	it('emits one byte-bound alias-to-interface/namespace merge with exact coverage', () => {
		const inputs = declarationContextAnalysisInputs(mergedFixture);
		const analysis = requireAnalysis(inputs);

		expect(analysis.exportBinding.exportName).toBe(mergedFixture.exportName);
		expect(analysis.exportBinding.resolutionKind).toBe('ALIASED_TO_TERMINAL_SYMBOL');
		expect(analysis.exportBinding.aliasHops).toHaveLength(1);
		expect(analysis.exportBinding.aliasHops[0]).toMatchObject({
			aliasName: mergedFixture.exportName,
			ordinal: 0,
			targetName: 'FixtureContract'
		});
		expect(analysis.terminalSymbol).toMatchObject({
			mergeState: 'MERGED',
			name: 'FixtureContract'
		});
		expect(analysis.declarations.map((declaration) => declaration.kind)).toEqual([
			'INTERFACE',
			'NAMESPACE'
		]);
		expect(analysis.merges).toHaveLength(1);
		expect(analysis.artifacts).toHaveLength(1);
		expect(analysis.artifacts[0]?.roles).toEqual([
			'CAP011_SELECTED_DECLARATION_TARGET',
			'SELECTED_EXPORT_BINDING_CARRIER',
			'ALIAS_DECLARATION_CONTAINER',
			'TERMINAL_DECLARATION_CONTAINER'
		]);
		expect(analysis.parseWitnesses).toHaveLength(1);
		expect(analysis.parseWitnesses[0]).toMatchObject({
			bytes: mergedFixture.moduleResolutionTrace.targetWitness.bytes,
			contentSha256: mergedFixture.moduleResolutionTrace.targetWitness.contentSha256,
			externalModule: true,
			parseDiagnostics: [],
			parseHealth: 'VALID',
			sourceEncoding: 'UTF8'
		});
		expect(analysis.coverage.inputRecords).toBe(
			analysis.coverage.programCompilerInputAttempts + analysis.coverage.artifactReadWitnesses
		);
		expect(analysis.programWitness.attributedCompilerInputAttempts).toBeGreaterThanOrEqual(
			analysis.coverage.programCompilerInputAttempts
		);
		expect(analysis.programWitness.attributedProgramReadBytes).toBeGreaterThanOrEqual(
			analysis.coverage.programReadBytes
		);
		expect(analysis.programWitness.attributedUniqueQueries).toBeGreaterThan(0);
		expect(analysis.programWitness.attributedCompilerInputAttempts).toBeLessThanOrEqual(
			analysis.budgets.maxCompilerInputAttempts
		);
		expect(analysis.programWitness.attributedProgramReadBytes).toBeLessThanOrEqual(
			analysis.budgets.maxProgramReadBytes
		);
		expect(analysis.coverage.readBytes).toBe(
			analysis.coverage.programReadBytes + analysis.coverage.artifactReadBytes
		);
		expect(analysis.coverage.relationRecords).toBe(6);
		expect(analysis.coverage.mergesWithRelations).toBe(2);
		expect(
			analysis.programInputAttempts.every((attempt, ordinal) => attempt.ordinal === ordinal)
		).toBe(true);
		expect(
			analysis.programInputAttempts.every((attempt) =>
				['PROGRAM_CONSTRUCTION', 'TYPE_CHECKER_CREATE', 'CALLER_ANALYSIS'].includes(attempt.stage)
			)
		).toBe(true);
		expectDeeplyFrozen(analysis);
		expect(analysis.budgets).not.toBe(inputs.request.budgets);
		expect(analysis.selection).not.toBe(inputs.request.selection);
		expect(analysis.projectContextGraph).not.toBe(inputs.request.projectContextGraph);
		const captured = inputs.semanticSnapshot.compilerInputs.find(
			(observation) => observation.id === analysis.programInputAttempts[0]?.observation.id
		);
		if (captured !== undefined)
			expect(analysis.programInputAttempts[0]?.observation).not.toBe(captured);
	}, 120_000);

	it('emits SINGLE for the same compiler-backed criterion without a merge record', () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const analysis = requireAnalysis(inputs);
		expect(analysis.terminalSymbol.mergeState).toBe('SINGLE');
		expect(analysis.declarations.map((declaration) => declaration.kind)).toEqual(['INTERFACE']);
		expect(analysis.merges).toEqual([]);
		expect(analysis.coverage.mergeRecords).toBe(0);
		expect(analysis.coverage.mergesWithRelations).toBe(0);
		expect(analysis.coverage.relationRecords).toBe(2);
	}, 120_000);

	it('is deterministic for the exact same frozen capture and request', () => {
		const inputs = declarationContextAnalysisInputs(mergedFixture);
		const first = requireAnalysis(inputs);
		const second = requireAnalysis(inputs);
		expect(second).toEqual(first);
		expect(second).not.toBe(first);
	}, 180_000);

	it('isolates asynchronous telemetry observer failures', async () => {
		const inputs = declarationContextAnalysisInputs(singleFixture);
		const events: string[] = [];
		const outcome = buildDeclarationContextAnalysis(inputs, {
			onProgress(event) {
				events.push(`${event.sequence}:${event.phase}:${event.state}`);
				throw new Error('observer failure');
			}
		});

		expect(outcome.outcome).toBe('partial');
		expect(events).toEqual([]);
		await Promise.resolve();
		expect(events[0]).toBe('0:REQUEST_BIND:STARTED');
		expect(events.at(-1)).toContain('ANALYSIS_VALIDATE:COMPLETED');
	}, 120_000);

	it('preserves the legacy domain-prefixed canonical content-digest bytes while streaming', () => {
		const analysis = requireAnalysis(declarationContextAnalysisInputs(mergedFixture));
		const { contentDigest, ...content } = analysis;
		const prefix = 'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-CONTENT\u00001\u0000';
		const streamed = canonicalSemanticJsonPrefixedSha256(prefix, content);

		expect(streamed).toBe(sha256(`${prefix}${canonicalSemanticJson(content)}`));
		expect(contentDigest).toBe(streamed);
	}, 120_000);

	it('preserves canonical whole-record source ordering with bounded string comparison', () => {
		const sources: DeclarationContextProgramSourceIdentity[] = [
			{
				bytes: 2,
				contentSha256: 'a'.repeat(64),
				declarationFile: true,
				logicalPath: 'packages/z\n🧪.d.ts',
				origin: 'WORKSPACE_BUILD_DECLARATION',
				semanticSourceId:
					'semantic-source-z' as DeclarationContextProgramSourceIdentity['semanticSourceId']
			},
			{
				bytes: 10,
				contentSha256: '"'.repeat(64),
				declarationFile: false,
				logicalPath: 'packages/\\a.d.ts',
				origin: 'AUTHORED',
				semanticSourceId:
					'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
			}
		];
		const sorted = [...sources].sort((left, right) => {
			const leftCanonical = canonicalSemanticJson(left);
			const rightCanonical = canonicalSemanticJson(right);
			return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
		});
		const prefix = 'JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-SOURCE-POPULATION\0' + '1\0';
		expect(declarationContextProgramSourcePopulationDigest(sources)).toBe(
			sha256(`${prefix}${canonicalSemanticJson(sorted)}`)
		);
		expect(declarationContextProgramSourcePopulationDigest([...sources].reverse())).toBe(
			declarationContextProgramSourcePopulationDigest(sources)
		);

		const base: DeclarationContextProgramSourceIdentity = {
			bytes: 7,
			contentSha256: 'a'.repeat(64),
			declarationFile: false,
			logicalPath: 'packages/a.d.ts',
			origin: 'AUTHORED',
			semanticSourceId:
				'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
		};
		const fieldOrderedPairs: readonly (readonly [
			DeclarationContextProgramSourceIdentity,
			DeclarationContextProgramSourceIdentity
		])[] = [
			[
				{ ...base, contentSha256: 'a'.repeat(64) },
				{ ...base, contentSha256: 'b'.repeat(64) }
			],
			[
				{ ...base, declarationFile: false },
				{ ...base, declarationFile: true }
			],
			[
				{ ...base, logicalPath: 'packages/a.d.ts' },
				{ ...base, logicalPath: 'packages/b.d.ts' }
			],
			[
				{ ...base, origin: 'AUTHORED' },
				{ ...base, origin: 'WORKSPACE_BUILD_DECLARATION' }
			],
			[
				{
					...base,
					semanticSourceId:
						'semantic-source-a' as DeclarationContextProgramSourceIdentity['semanticSourceId']
				},
				{
					...base,
					semanticSourceId:
						'semantic-source-b' as DeclarationContextProgramSourceIdentity['semanticSourceId']
				}
			]
		];
		for (const pair of fieldOrderedPairs) {
			const legacySorted = [...pair].sort((left, right) => {
				const leftCanonical = canonicalSemanticJson(left);
				const rightCanonical = canonicalSemanticJson(right);
				return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
			});
			expect(
				declarationContextProgramSourcePopulationDigest([...pair].reverse(), () => undefined)
			).toBe(sha256(`${prefix}${canonicalSemanticJson(legacySorted)}`));
		}
	});
});
