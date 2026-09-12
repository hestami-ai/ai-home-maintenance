import { describe, expect, it } from 'vitest';

import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import dependencyCruiserRawWireSchema from './schema/cruise-result-16.10.4.schema.json' with { type: 'json' };
import {
	assertDependencyCruiserRawWireSchema,
	DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_CANONICAL_SHA256,
	DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_DRAFT,
	DependencyCruiserRawWireSchemaError,
	DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_ID,
	DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_PROVIDER_VERSION,
	validateDependencyCruiserRawWireSchema
} from './validate-raw-wire-schema.js';

function validRawWire(): Record<string, unknown> {
	return {
		folders: [{ moduleCount: 1, name: 'src' }],
		modules: [],
		revisionData: {
			SHA1: '0123456789abcdef',
			changes: [{ name: 'src/a.ts', type: 'modified' }]
		},
		summary: {
			error: 0,
			info: 0,
			optionsUsed: {
				parser: 'tsc',
				progress: { maximumLevel: -1, type: 'none' }
			},
			ruleSetUsed: { allowedSeverity: 'warn' },
			totalCruised: 0,
			violations: [],
			warn: 0
		}
	};
}

function invalidAt(
	mutate: (wire: Record<string, unknown>) => void
): Extract<ReturnType<typeof validateDependencyCruiserRawWireSchema>, { state: 'INVALID' }> {
	const wire = structuredClone(validRawWire());
	mutate(wire);
	const result = validateDependencyCruiserRawWireSchema(wire);
	expect(result.state).toBe('INVALID');
	if (result.state !== 'INVALID') throw new Error('Expected invalid raw-wire fixture.');
	return result;
}

describe('dependency-cruiser 16.10.4 raw-wire schema', () => {
	it('pins the exact schema identity and semantic digest', () => {
		expect(DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_PROVIDER_VERSION).toBe('16.10.4');
		expect(dependencyCruiserRawWireSchema.$schema).toBe(DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_DRAFT);
		expect(dependencyCruiserRawWireSchema.$id).toBe(DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_ID);
		expect(sha256(canonicalSemanticJson(dependencyCruiserRawWireSchema))).toBe(
			DEPENDENCY_CRUISER_RAW_WIRE_SCHEMA_CANONICAL_SHA256
		);
	});

	it('accepts exact known-but-uninterpreted provider surfaces', () => {
		expect(validateDependencyCruiserRawWireSchema(validRawWire())).toEqual({ state: 'VALID' });
		expect(() => assertDependencyCruiserRawWireSchema(validRawWire())).not.toThrow();
	});

	it.each([
		[
			'folder aggregate',
			(wire: Record<string, unknown>) => {
				(wire.folders as Record<string, unknown>[])[0]!.moduleCount = 'one';
			},
			'$raw/folders/0/moduleCount'
		],
		[
			'revision change',
			(wire: Record<string, unknown>) => {
				const revision = wire.revisionData as { changes: Record<string, unknown>[] };
				revision.changes[0]!.type = 'rewritten';
			},
			'$raw/revisionData/changes/0/type'
		],
		[
			'options used',
			(wire: Record<string, unknown>) => {
				const summary = wire.summary as { optionsUsed: Record<string, unknown> };
				summary.optionsUsed.notAProviderOption = true;
			},
			'$raw/summary/optionsUsed'
		],
		[
			'rule set',
			(wire: Record<string, unknown>) => {
				const summary = wire.summary as { ruleSetUsed: Record<string, unknown> };
				summary.ruleSetUsed.allowedSeverity = 'fatal';
			},
			'$raw/summary/ruleSetUsed/allowedSeverity'
		],
		[
			'optional module statistics',
			(wire: Record<string, unknown>) => {
				wire.modules = [
					{
						dependencies: [],
						experimentalStats: { size: 1 },
						source: 'src/a.ts',
						valid: true
					}
				];
			},
			'$raw/modules/0/experimentalStats'
		],
		[
			'optional dependency cycle',
			(wire: Record<string, unknown>) => {
				wire.modules = [
					{
						dependencies: [
							{
								circular: true,
								coreModule: false,
								couldNotResolve: false,
								cycle: [{ name: 'src/b.ts' }],
								dependencyTypes: ['local'],
								dynamic: false,
								exoticallyRequired: false,
								followable: true,
								module: './b.js',
								moduleSystem: 'es6',
								resolved: 'src/b.ts',
								valid: true
							}
						],
						source: 'src/a.ts',
						valid: true
					}
				];
			},
			'$raw/modules/0/dependencies/0/cycle/0'
		]
	] as const)('rejects malformed %s data', (_name, mutate, expectedPath) => {
		const result = invalidAt(mutate);
		expect(result.diagnostic).toMatchObject({
			code: 'RAW_SHAPE_INVALID',
			path: expectedPath
		});
		expect(result.diagnostic.message).toMatch(
			/^dependency-cruiser 16\.10\.4 raw schema violation \([A-Za-z]+\)\.$/u
		);
	});

	it('does not echo rejected provider data and exposes the same bounded assertion diagnostic', () => {
		const secretField = `secret-${'x'.repeat(1_000)}`;
		const result = invalidAt((wire) => {
			const summary = wire.summary as { optionsUsed: Record<string, unknown> };
			summary.optionsUsed[secretField] = 'sensitive-value';
		});
		expect(JSON.stringify(result)).not.toContain(secretField);
		expect(JSON.stringify(result)).not.toContain('sensitive-value');
		expect(result.diagnostic.path.length).toBeLessThanOrEqual(512);

		const invalidWire = validRawWire();
		(invalidWire.summary as { optionsUsed: Record<string, unknown> }).optionsUsed[secretField] =
			true;
		expect(() => assertDependencyCruiserRawWireSchema(invalidWire)).toThrow(
			DependencyCruiserRawWireSchemaError
		);
		try {
			assertDependencyCruiserRawWireSchema(invalidWire);
		} catch (cause) {
			expect(cause).toBeInstanceOf(DependencyCruiserRawWireSchemaError);
			expect((cause as DependencyCruiserRawWireSchemaError).diagnostic).toEqual(result.diagnostic);
		}
	});
});
