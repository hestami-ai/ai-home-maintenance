import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	SEMANTIC_AST_TRAVERSAL_PROFILE,
	SEMANTIC_BUDGET_KEYS,
	SEMANTIC_CANONICAL_PROFILE,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION
} from '../contracts/semantic.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	encodeSemanticDiagnosticText,
	hasLoneUtf16CodeUnit,
	parseUtf16CodeUnitsHex,
	semanticUtf16CodeUnitsDigest,
	utf16CodeUnits,
	utf16CodeUnitsHex
} from './canonical.js';
import {
	hasSemanticIdPrefix,
	semanticDiagnosticId,
	semanticProgramId,
	semanticProjectId,
	semanticSnapshotId
} from './ids.js';
import { semanticPopulation, type SemanticPopulationMembers } from './population.js';

const EMPTY_MEMBERS: SemanticPopulationMembers = {
	analyzed: [],
	contextOnly: [],
	excluded: [],
	excludedByPolicy: [],
	failed: [],
	unknown: [],
	unsupported: []
};

const BUDGETS = {
	maxAstDepth: 10,
	maxAstNodes: 10,
	maxCompilerInputMetadataBytes: 10,
	maxCompilerQueries: 10,
	maxCompilerQueryInvocations: 10,
	maxContextBytes: 10,
	maxContextFileBytes: 10,
	maxContextFiles: 10,
	maxDiagnosticCharacters: 10,
	maxDiagnostics: 10,
	maxDirectoryEntries: 10,
	maxDurationMs: 10,
	maxLiteralCharacters: 10,
	maxPathCharacters: 10,
	maxProjects: 10,
	maxSnapshotBytes: 10,
	maxSources: 10
} as const;

describe('semantic canonical identity profile', () => {
	it('publishes one canonical closed budget vocabulary', () => {
		expect(SEMANTIC_BUDGET_KEYS).toEqual([...SEMANTIC_BUDGET_KEYS].sort());
		expect(Object.keys(BUDGETS).sort()).toEqual(SEMANTIC_BUDGET_KEYS);
	});

	it('uses compact Unicode-aware JCS ordering independently of inventory JSON', () => {
		expect(canonicalSemanticJson({ z: -0, a: [true, 'é', 1.5] })).toBe(
			'{"a":[true,"é",1.5],"z":0}'
		);
		expect(canonicalSemanticJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
	});

	it('streams an exact UTF-8 byte-count and SHA-256 witness for representative values', () => {
		const values: readonly unknown[] = [
			null,
			false,
			-0,
			'control:\n astral: 🧪 composed: é',
			{ z: -0, a: [true, 'é', 1.5], nested: { empty: [], escaped: '"\\\b\f\n\r\t' } }
		];
		for (const value of values) {
			const canonical = canonicalSemanticJson(value);
			expect(canonicalSemanticJsonWitness(value)).toEqual({
				bytes: Buffer.byteLength(canonical, 'utf8'),
				sha256: createHash('sha256').update(canonical, 'utf8').digest('hex')
			});
		}
	});

	it('streams a moderately large witness without changing canonical bytes', () => {
		const value = Array.from({ length: 4_096 }, (_, index) => ({
			active: index % 3 === 0,
			index,
			label: `source-🧪-${String(index).padStart(5, '0')}`,
			path: `packages/csaa/src/generated/${index}.ts`
		}));
		const canonical = canonicalSemanticJson(value);
		expect(Buffer.byteLength(canonical, 'utf8')).toBeGreaterThan(300_000);
		expect(canonicalSemanticJsonWitness(value)).toEqual({
			bytes: Buffer.byteLength(canonical, 'utf8'),
			sha256: createHash('sha256').update(canonical, 'utf8').digest('hex')
		});
	});

	it('round-trips UTF-16 code-unit evidence without normalizing malformed text', () => {
		const text = `scalar 🧪 lone ${'\ud800'}`;
		const units = utf16CodeUnits(text);
		const encoded = utf16CodeUnitsHex(text);
		expect(parseUtf16CodeUnitsHex(encoded)).toEqual(units);
		expect(parseUtf16CodeUnitsHex('000')).toBeNull();
		expect(parseUtf16CodeUnitsHex('zzzz')).toBeNull();
		expect(hasLoneUtf16CodeUnit(units)).toBe(true);
		expect(hasLoneUtf16CodeUnit(new Uint16Array([0xdc00]))).toBe(true);
		expect(hasLoneUtf16CodeUnit(utf16CodeUnits('paired 🧪'))).toBe(false);
		expect(semanticUtf16CodeUnitsDigest('test-domain', ['one', 'two'], text)).toBe(
			semanticUtf16CodeUnitsDigest('test-domain', ['one', 'two'], units)
		);
		expect(encodeSemanticDiagnosticText(text)).toMatchObject({
			text: encoded,
			textEncoding: 'UTF16_CODE_UNITS_HEX',
			textLength: text.length
		});
	});

	it('rejects proxies, expando arrays, symbols, and non-enumerable data without invoking code', () => {
		const expando = [1] as number[] & { extra?: number };
		expando.extra = 2;
		const symbolKeyed = { value: 1 } as Record<PropertyKey, unknown>;
		symbolKeyed[Symbol('hidden')] = 2;
		const nonEnumerable = Object.defineProperty({}, 'hidden', {
			enumerable: false,
			value: 1
		});
		const proxy = new Proxy(
			{ value: 1 },
			{
				get: () => {
					throw new Error('proxy trap must remain inert');
				}
			}
		);
		expect(() => canonicalSemanticJson(proxy)).toThrow('Proxy');
		expect(() => canonicalSemanticJson(expando)).toThrow('expando');
		expect(() => canonicalSemanticJson(symbolKeyed)).toThrow('symbol');
		expect(() => canonicalSemanticJson(nonEnumerable)).toThrow('data properties');
		expect(() => canonicalSemanticJson({ ['\ud800']: 1 })).toThrow('surrogate');
	});

	it('streams a single canonical token larger than the bounded buffer', () => {
		const value = '🧪'.repeat(40_000);
		const canonical = canonicalSemanticJson(value);
		expect(canonical).toBe(JSON.stringify(value));
		expect(canonicalSemanticJsonWitness(value)).toEqual({
			bytes: Buffer.byteLength(canonical, 'utf8'),
			sha256: createHash('sha256').update(canonical, 'utf8').digest('hex')
		});
	});

	it('fails closed for non-I-JSON, sparse, cyclic, and non-plain inputs', () => {
		const sparse = Array<string>(1);
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		expect(() => canonicalSemanticJson(Number.NaN)).toThrow('finite');
		expect(() => canonicalSemanticJson(Number.MAX_SAFE_INTEGER + 1)).toThrow('unsafe integer');
		expect(() => canonicalSemanticJson(undefined)).toThrow('undefined');
		expect(() => canonicalSemanticJson(1n)).toThrow('bigint');
		expect(() => canonicalSemanticJson(sparse)).toThrow('sparse');
		expect(() => canonicalSemanticJson('\ud800')).toThrow('surrogate');
		expect(() => canonicalSemanticJson(cyclic)).toThrow('cyclic');
		expect(() => canonicalSemanticJson(new Date(0))).toThrow('plain objects');
	});

	it('applies the same fail-closed and inert traversal rules to streamed witnesses', () => {
		const sparse = Array<string>(1);
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		const accessor = Object.defineProperty({}, 'unsafe', {
			enumerable: true,
			get: () => {
				throw new Error('getter must remain inert');
			}
		});
		expect(() => canonicalSemanticJsonWitness(Number.NaN)).toThrow('finite');
		expect(() => canonicalSemanticJsonWitness(Number.MAX_SAFE_INTEGER + 1)).toThrow(
			'unsafe integer'
		);
		expect(() => canonicalSemanticJsonWitness(undefined)).toThrow('undefined');
		expect(() => canonicalSemanticJsonWitness(1n)).toThrow('bigint');
		expect(() => canonicalSemanticJsonWitness(sparse)).toThrow('sparse');
		expect(() => canonicalSemanticJsonWitness('\ud800')).toThrow('surrogate');
		expect(() => canonicalSemanticJsonWitness(cyclic)).toThrow('cyclic');
		expect(() => canonicalSemanticJsonWitness(new Date(0))).toThrow('plain objects');
		expect(() => canonicalSemanticJsonWitness(accessor)).toThrow('data properties');
	});

	it('mints registered outer prefixes with domain-separated family identities', () => {
		const snapshot = semanticSnapshotId({
			astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
			budgets: BUDGETS,
			canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
			contextDigest: '0'.repeat(64),
			expectedEmpty: false,
			extractionVersion: SEMANTIC_EXTRACTION_VERSION,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			projectRecipeDigests: ['1'.repeat(64)],
			provider: {
				api: 'PUBLIC_COMPILER_API',
				id: 'typescript',
				version: TYPESCRIPT_PROVIDER_VERSION
			},
			requestedCapabilities: ['TS_PROJECT', 'TS_SYNTAX'],
			schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
			subjectId: '2'.repeat(64)
		});
		const reordered = semanticSnapshotId({
			operationVersion: SEMANTIC_OPERATION_VERSION,
			astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
			budgets: BUDGETS,
			subjectId: '2'.repeat(64),
			schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
			requestedCapabilities: ['TS_PROJECT', 'TS_SYNTAX'],
			provider: {
				version: TYPESCRIPT_PROVIDER_VERSION,
				id: 'typescript',
				api: 'PUBLIC_COMPILER_API'
			},
			projectRecipeDigests: ['1'.repeat(64)],
			extractionVersion: SEMANTIC_EXTRACTION_VERSION,
			expectedEmpty: false,
			contextDigest: '0'.repeat(64),
			canonicalProfile: SEMANTIC_CANONICAL_PROFILE
		});
		expect(reordered).toBe(snapshot);
		expect(hasSemanticIdPrefix(snapshot, 'static', 'ts-snapshot')).toBe(true);
		const project = semanticProjectId({
			configPath: 'tsconfig.json',
			projectResolutionDigest: '3'.repeat(64),
			snapshotId: snapshot
		});
		const program = semanticProgramId({ contextDigest: '0'.repeat(64), projectId: project });
		expect(hasSemanticIdPrefix(project, 'semantic', 'project')).toBe(true);
		expect(hasSemanticIdPrefix(program, 'semantic', 'program')).toBe(true);
		expect(project).not.toBe(program);
		expect(
			semanticSnapshotId({
				astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
				budgets: BUDGETS,
				canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
				contextDigest: '0'.repeat(64),
				expectedEmpty: true,
				extractionVersion: SEMANTIC_EXTRACTION_VERSION,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				projectRecipeDigests: ['1'.repeat(64)],
				provider: {
					api: 'PUBLIC_COMPILER_API',
					id: 'typescript',
					version: TYPESCRIPT_PROVIDER_VERSION
				},
				requestedCapabilities: ['TS_PROJECT', 'TS_SYNTAX'],
				schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
				subjectId: '2'.repeat(64)
			})
		).not.toBe(snapshot);
	});

	it('binds diagnostic category, source, and lossless canonicalized related payload while excluding multiplicity', () => {
		const message = (text: string) => ({
			category: null,
			code: null,
			next: [],
			...encodeSemanticDiagnosticText(text)
		});
		const related = [
			{
				category: 'WARNING' as const,
				code: 'TS100',
				end: null,
				message: message('z'),
				path: null,
				start: null
			},
			{
				category: 'SUGGESTION' as const,
				code: 'TS101',
				end: null,
				message: message('a'),
				path: null,
				start: null
			}
		] as const;
		const base = {
			category: 'ERROR' as const,
			code: 'TS1000',
			end: null,
			family: 'SEMANTIC' as const,
			locationKind: 'NONE' as const,
			message: message('message'),
			path: null,
			projectId: semanticProjectId({
				configPath: 'tsconfig.json',
				projectResolutionDigest: '3'.repeat(64),
				snapshotId: `static:ts-snapshot-${'4'.repeat(64)}` as never
			}),
			related,
			sourceId: null,
			start: null
		};
		expect(semanticDiagnosticId(base)).toBe(
			semanticDiagnosticId({ ...base, related: [...related].reverse() })
		);
		expect(semanticDiagnosticId({ ...base, category: 'WARNING' })).not.toBe(
			semanticDiagnosticId(base)
		);

		const chainRoot = {
			category: 'ERROR' as const,
			code: 200,
			next: [],
			...encodeSemanticDiagnosticText('identical chain root')
		};
		const warningWrapper = {
			category: 'WARNING' as const,
			code: 'TS100',
			end: null,
			message: chainRoot,
			path: null,
			start: null
		};
		const suggestionWrapper = {
			category: 'SUGGESTION' as const,
			code: 'TS101',
			end: null,
			message: chainRoot,
			path: null,
			start: null
		};
		expect(canonicalSemanticJson(warningWrapper)).not.toBe(
			canonicalSemanticJson(suggestionWrapper)
		);
		expect(semanticDiagnosticId({ ...base, related: [warningWrapper] })).not.toBe(
			semanticDiagnosticId({ ...base, related: [suggestionWrapper] })
		);
		expect(semanticDiagnosticId({ ...base, related: [warningWrapper, warningWrapper] })).not.toBe(
			semanticDiagnosticId({ ...base, related: [warningWrapper] })
		);
	});
});

describe('semantic population reconciliation', () => {
	it('reconciles independent discovery, inclusion, exclusion, failure, and outcome subsets', () => {
		const population = semanticPopulation('SOURCE', {
			analyzed: ['a', 'u'],
			contextOnly: ['c'],
			excluded: ['e'],
			excludedByPolicy: ['e'],
			failed: ['f'],
			unknown: [],
			unsupported: ['u']
		});
		expect(population).toMatchObject({
			analyzed: 2,
			contextOnly: 1,
			discovered: 5,
			excluded: 1,
			failed: 1,
			included: 3,
			reconciles: true,
			unsupported: 1
		});
		expect(population.manifests.discovered).toMatch(/^[a-f0-9]{64}$/u);
	});

	it('does not manufacture PASS from invalid compact partition evidence', () => {
		expect(
			semanticPopulation('SOURCE', { ...EMPTY_MEMBERS, analyzed: ['a'], excluded: ['a'] })
				.reconciles
		).toBe(false);
		expect(
			semanticPopulation('SOURCE', { ...EMPTY_MEMBERS, analyzed: ['a'], unsupported: ['missing'] })
				.reconciles
		).toBe(false);
		expect(
			semanticPopulation('SOURCE', {
				...EMPTY_MEMBERS,
				analyzed: ['a'],
				unknown: ['a'],
				unsupported: ['a']
			}).reconciles
		).toBe(false);
		expect(semanticPopulation('SOURCE', EMPTY_MEMBERS, true).reconciles).toBe(true);
	});
});
