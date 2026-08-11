import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	inspectSemanticSnapshotWire,
	materializeSemanticSnapshotWire,
	type SemanticWireInspectionIssue,
	type SemanticWireInspectionOptions
} from './validate-wire-shape.js';

const OPTIONS: SemanticWireInspectionOptions = {
	maxDepth: 64,
	maxDiagnostics: 100,
	maxRecords: 10_000,
	maxStringCharacters: 100_000
};

function expectIssue(
	value: unknown,
	expected: SemanticWireInspectionIssue,
	options: SemanticWireInspectionOptions = OPTIONS
): void {
	const result = materializeSemanticSnapshotWire(value, options);
	expect(result.value).toBeUndefined();
	expect(result.issues).toEqual(expect.arrayContaining([expected]));
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('semantic wire shape materialization hardening', () => {
	it('rejects object and array proxies without invoking hostile traps', () => {
		let objectTrapCalls = 0;
		const objectProxy = new Proxy(
			{},
			{
				getPrototypeOf: () => {
					objectTrapCalls += 1;
					throw new Error('object proxy trap must remain inert');
				}
			}
		);
		expectIssue(objectProxy, {
			budget: false,
			message: 'Proxy values are not permitted in the semantic wire.',
			path: '$'
		});
		expect(objectTrapCalls).toBe(0);

		let arrayTrapCalls = 0;
		const arrayProxy = new Proxy([], {
			getOwnPropertyDescriptor: () => {
				arrayTrapCalls += 1;
				throw new Error('array proxy trap must remain inert');
			}
		});
		expectIssue(
			{ astNodes: arrayProxy },
			{
				budget: false,
				message: 'Proxy values are not permitted in the semantic wire.',
				path: '$.astNodes'
			}
		);
		expect(arrayTrapCalls).toBe(0);
	});

	it('rejects exotic prototypes while accepting null as an inert record prototype', () => {
		expectIssue(Object.create({ inherited: true }), {
			budget: false,
			message: 'Wire objects must have Object.prototype or null prototype.',
			path: '$'
		});

		const nullPrototype = Object.create(null) as Record<string, unknown>;
		nullPrototype.health = 'COMPLETE';
		const nullPrototypeResult = materializeSemanticSnapshotWire(nullPrototype, OPTIONS);
		expect(nullPrototypeResult.issues).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'Wire objects must have Object.prototype or null prototype.'
				})
			])
		);
	});

	it('rejects symbol properties, symbol values, accessors, and non-enumerable fields', () => {
		const symbolProperty: Record<PropertyKey, unknown> = { health: 'COMPLETE' };
		symbolProperty[Symbol('hidden')] = true;
		expectIssue(symbolProperty, {
			budget: false,
			message: 'Wire objects must not contain symbol properties.',
			path: '$'
		});

		expectIssue(
			{ requestedCapabilities: [Symbol('TS_PROJECT')] },
			{
				budget: false,
				message: 'Expected a valid scalar.',
				path: '$.requestedCapabilities[0]'
			}
		);

		let getterCalls = 0;
		const accessor = {};
		Object.defineProperty(accessor, 'health', {
			configurable: true,
			enumerable: true,
			get: () => {
				getterCalls += 1;
				return 'COMPLETE';
			}
		});
		expectIssue(accessor, {
			budget: false,
			message: 'Wire fields must be enumerable data properties.',
			path: '$.health'
		});
		expect(getterCalls).toBe(0);

		const hidden = {};
		Object.defineProperty(hidden, 'health', { enumerable: false, value: 'COMPLETE' });
		expectIssue(hidden, {
			budget: false,
			message: 'Wire fields must be enumerable data properties.',
			path: '$.health'
		});
	});

	it('rejects sparse, accessor-backed, and length-shaped non-array collections', () => {
		expectIssue(
			{ astNodes: new Array(1) },
			{
				budget: false,
				message: 'Arrays must be dense and contain only canonical index properties.',
				path: '$.astNodes'
			}
		);

		let getterCalls = 0;
		const accessorArray: unknown[] = [{}];
		Object.defineProperty(accessorArray, '0', {
			configurable: true,
			enumerable: true,
			get: () => {
				getterCalls += 1;
				return {};
			}
		});
		expectIssue(
			{ astNodes: accessorArray },
			{
				budget: false,
				message: 'Array elements must be enumerable data properties.',
				path: '$.astNodes[0]'
			}
		);
		expect(getterCalls).toBe(0);

		// ECMAScript arrays cannot carry an invalid length descriptor. A hostile
		// length-shaped object must therefore fail before its length is inspected.
		expectIssue(
			{ astNodes: { length: Number.MAX_SAFE_INTEGER + 1 } },
			{
				budget: false,
				message: 'Expected an array.',
				path: '$.astNodes'
			}
		);
	});

	it('rejects arrays where closed records are required and rejects object and JSON-array cycles', () => {
		expect(inspectSemanticSnapshotWire([], OPTIONS)).toEqual([
			{
				budget: false,
				message: 'Expected a closed snapshot object.',
				path: '$'
			}
		]);

		const objectCycle: Record<string, unknown> = {};
		objectCycle.provider = objectCycle;
		expectIssue(objectCycle, {
			budget: false,
			message: 'Cyclic values are not permitted in the semantic wire.',
			path: '$.provider'
		});

		const jsonArrayCycle: unknown[] = [];
		jsonArrayCycle.push(jsonArrayCycle);
		expectIssue(
			{ projects: [{ programRecipe: { compilerOptions: jsonArrayCycle } }] },
			{
				budget: false,
				message: 'Cyclic values are not permitted in the semantic wire.',
				path: '$.projects[0].programRecipe.compilerOptions[0]'
			}
		);
	});

	it('reports character budgets and canonical byte-count overflow at the exact witness', () => {
		expectIssue(
			'ab',
			{
				budget: true,
				message: 'Wire string characters exceed 1.',
				path: '$'
			},
			{ ...OPTIONS, maxStringCharacters: 1 }
		);

		vi.spyOn(Buffer, 'byteLength').mockReturnValue(Number.MAX_SAFE_INTEGER);
		expectIssue(
			{ é: 'value' },
			{
				budget: true,
				message: 'Canonical semantic wire byte count overflowed.',
				path: '$.é'
			}
		);
	});

	it('fails closed when inert inspection unexpectedly throws', () => {
		vi.spyOn(Buffer, 'byteLength').mockImplementation(() => {
			throw new Error('injected byte inspection failure');
		});
		expect(materializeSemanticSnapshotWire({ é: 'value' }, OPTIONS)).toEqual({
			issues: [
				{
					budget: false,
					message: 'Semantic wire inspection failed closed: injected byte inspection failure',
					path: '$'
				}
			]
		});
	});

	it('returns a detached issue array from the public inspection wrapper', () => {
		const first = inspectSemanticSnapshotWire([], OPTIONS);
		const second = inspectSemanticSnapshotWire([], OPTIONS);
		expect(first).toEqual(second);
		expect(first).not.toBe(second);
	});
});
