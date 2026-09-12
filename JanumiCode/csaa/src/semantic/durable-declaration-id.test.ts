import { describe, expect, it } from 'vitest';
import { TYPESCRIPT_PROVIDER_VERSION } from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import {
	durableDeclarationIdentityPreimage,
	type DurableDeclarationIdentityInput
} from './durable-declaration-id.js';
import { hasSemanticIdPrefix, semanticDurableDeclarationId } from './ids.js';

const CONTENT_SHA256 = sha256('export const answer = 42;\n');

const INPUT: DurableDeclarationIdentityInput = {
	ambient: false,
	contentSha256: CONTENT_SHA256,
	declarationFile: false,
	end: 19,
	kind: 261,
	languageVariant: 'Standard',
	logicalPath: 'packages/example/src/index.ts',
	name: 'answer',
	nameState: 'ATOMIC',
	scriptKind: 3,
	start: 13,
	typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
};

function id(input: DurableDeclarationIdentityInput = INPUT): string {
	return semanticDurableDeclarationId(input);
}

describe('durable declaration identity', () => {
	it('normalizes the exact source-version declaration coordinate', () => {
		const preimage = {
			ambient: false,
			contentSha256: CONTENT_SHA256,
			declarationFile: false,
			end: 19,
			kind: 261,
			languageVariant: 'Standard',
			logicalPath: 'packages/example/src/index.ts',
			name: 'answer',
			nameState: 'ATOMIC',
			scriptKind: 3,
			start: 13,
			typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
		};
		expect(durableDeclarationIdentityPreimage(INPUT)).toEqual(preimage);
		expect(hasSemanticIdPrefix(id(), 'semantic', 'declaration-durable')).toBe(true);
	});

	it('is independent of property order and snapshot-local wrappers', () => {
		const reordered = {
			typescriptVersion: INPUT.typescriptVersion,
			start: INPUT.start,
			scriptKind: INPUT.scriptKind,
			nameState: INPUT.nameState,
			name: INPUT.name,
			logicalPath: INPUT.logicalPath,
			languageVariant: INPUT.languageVariant,
			kind: INPUT.kind,
			end: INPUT.end,
			declarationFile: INPUT.declarationFile,
			contentSha256: INPUT.contentSha256,
			ambient: INPUT.ambient
		} satisfies DurableDeclarationIdentityInput;
		const firstSnapshot = {
			budgets: { maxAstNodes: 1 },
			declaration: INPUT,
			programId: 'semantic:program-first',
			snapshotId: 'static:ts-snapshot-first'
		};
		const secondSnapshot = {
			budgets: { maxAstNodes: 100_000 },
			declaration: reordered,
			programId: 'semantic:program-second',
			snapshotId: 'static:ts-snapshot-second'
		};
		expect(id(firstSnapshot.declaration)).toBe(id(secondSnapshot.declaration));
	});

	it('changes when any source-version declaration-coordinate dimension changes', () => {
		const mutations: readonly DurableDeclarationIdentityInput[] = [
			{ ...INPUT, ambient: true },
			{ ...INPUT, contentSha256: sha256('changed') },
			{ ...INPUT, declarationFile: true },
			{ ...INPUT, end: INPUT.end + 1 },
			{ ...INPUT, kind: INPUT.kind + 1 },
			{ ...INPUT, languageVariant: 'JSX' },
			{ ...INPUT, logicalPath: 'packages/example/src/other.ts' },
			{ ...INPUT, name: 'other' },
			{ ...INPUT, scriptKind: INPUT.scriptKind + 1 },
			{ ...INPUT, start: INPUT.start + 1 },
			{ ...INPUT, name: null, nameState: 'ANONYMOUS' },
			{ ...INPUT, name: null, nameState: 'COMPUTED' }
		];
		const baseline = id();
		for (const mutation of mutations) expect(id(mutation)).not.toBe(baseline);
		expect(new Set(mutations.map((mutation) => id(mutation))).size).toBe(mutations.length);
	});

	it('invalidates every declaration coordinate when any source byte changes', () => {
		const changedSource = { ...INPUT, contentSha256: sha256('export const answer = 43;\n') };
		expect(id(changedSource)).not.toBe(id());
		expect(id({ ...INPUT })).toBe(id());
	});

	it('accepts null-prototype inert data and valid declaration-name states', () => {
		const nullPrototype = Object.assign(
			Object.create(null),
			INPUT
		) as DurableDeclarationIdentityInput;
		expect(id(nullPrototype)).toBe(id());
		for (const nameState of ['COMPUTED', 'PATTERN', 'MISSING', 'ANONYMOUS'] as const) {
			expect(() => id({ ...INPUT, name: null, nameState })).not.toThrow();
		}
	});

	it('rejects malformed containers and anything outside the exact preimage', () => {
		const accessor = { ...INPUT } as Record<string, unknown>;
		Object.defineProperty(accessor, 'kind', { enumerable: true, get: () => INPUT.kind });
		const withSymbol = { ...INPUT, [Symbol('extra')]: true };
		const proxy = new Proxy({ ...INPUT }, {});
		for (const malformed of [
			null,
			[],
			{ ...INPUT, budgets: { maxAstNodes: 1 } },
			Object.fromEntries(Object.entries(INPUT).filter(([key]) => key !== 'kind')),
			Object.assign(Object.create({ inherited: true }), INPUT),
			accessor,
			withSymbol,
			proxy
		]) {
			expect(() =>
				semanticDurableDeclarationId(malformed as DurableDeclarationIdentityInput)
			).toThrow(TypeError);
		}
	});

	it.each([
		['non-canonical relative path', { ...INPUT, logicalPath: '../index.ts' }],
		['absolute path', { ...INPUT, logicalPath: 'C:/repo/index.ts' }],
		['backslash path', { ...INPUT, logicalPath: 'packages\\example\\index.ts' }],
		['uppercase digest', { ...INPUT, contentSha256: CONTENT_SHA256.toUpperCase() }],
		['short digest', { ...INPUT, contentSha256: '0'.repeat(63) }],
		['unsupported TypeScript version', { ...INPUT, typescriptVersion: '5.9.4' }],
		['negative kind', { ...INPUT, kind: -1 }],
		['fractional script kind', { ...INPUT, scriptKind: 1.5 }],
		['unsafe start', { ...INPUT, start: Number.MAX_SAFE_INTEGER + 1 }],
		['reversed span', { ...INPUT, start: INPUT.end + 1 }],
		['invalid language variant', { ...INPUT, languageVariant: 'TSX' }],
		['invalid name state', { ...INPUT, nameState: 'NAMED' }],
		['missing atomic name', { ...INPUT, name: null }],
		['empty atomic name', { ...INPUT, name: '' }],
		['name on anonymous declaration', { ...INPUT, nameState: 'ANONYMOUS' }],
		['lone surrogate name', { ...INPUT, name: '\ud800' }],
		['lone surrogate version', { ...INPUT, typescriptVersion: '5.9.3-\ud800' }],
		['non-boolean ambient state', { ...INPUT, ambient: 0 }]
	] as const)('rejects %s', (_label, malformed) => {
		expect(() =>
			semanticDurableDeclarationId(malformed as unknown as DurableDeclarationIdentityInput)
		).toThrow(TypeError);
	});

	it('uses only the declaration-durable semantic ID family', () => {
		expect(hasSemanticIdPrefix(id(), 'semantic', 'declaration-durable')).toBe(true);
		for (const value of [
			'',
			`semantic:declaration-durable-${'A'.repeat(64)}`,
			`semantic:declaration-${'a'.repeat(64)}`,
			`semantic:declaration-durable-${'a'.repeat(63)}`,
			`semantic:declaration-durable-${'a'.repeat(65)}`
		])
			expect(hasSemanticIdPrefix(value, 'semantic', 'declaration-durable')).toBe(false);
	});
});
