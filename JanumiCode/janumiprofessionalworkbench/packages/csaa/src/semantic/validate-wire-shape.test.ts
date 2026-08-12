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

function issuesBelow(value: unknown, path: string): readonly SemanticWireInspectionIssue[] {
	return inspectSemanticSnapshotWire(value, OPTIONS).filter(
		(issue) =>
			issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`)
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('semantic wire shape materialization hardening', () => {
	it('materializes the closed Slice 3B symbol and module record shapes', () => {
		const value = {
			aliases: [
				{
					aliasSymbolId: 'symbol:alias',
					id: 'alias:1',
					provenanceId: 'provenance:1',
					state: 'RESOLVED',
					targetSymbolId: 'symbol:target',
					terminalSymbolId: null
				}
			],
			declarations: [
				{
					ambient: false,
					bindingProvenanceId: 'provenance:1',
					candidateId: null,
					declaringScopeId: null,
					durableId: `semantic:declaration-durable-${'a'.repeat(64)}`,
					end: 7,
					id: 'declaration:1',
					kind: 263,
					kindName: 'FunctionDeclaration',
					name: null,
					nameState: 'ANONYMOUS',
					nodeId: null,
					scopeLinkState: 'UNSUPPORTED',
					sourceId: 'source:1',
					start: 0,
					structuralProvenanceId: 'provenance:1',
					symbolBindingState: 'RESOLVED',
					symbolId: 'symbol:1'
				}
			],
			moduleExports: [
				{
					exportName: 'answer',
					id: 'module-export:1',
					provenanceId: 'provenance:1',
					sourceId: 'source:1',
					state: 'ALIAS',
					symbolId: 'symbol:alias',
					targetSymbolId: null
				}
			],
			moduleResolutions: [
				{
					id: 'module-resolution:1',
					moduleSymbolId: null,
					nodeId: 'node:1',
					occurrenceKind: 'DYNAMIC_IMPORT',
					provenanceId: 'provenance:1',
					resolutionState: 'UNRESOLVED',
					sourceId: 'source:1',
					specifier: './dependency.js',
					specifierState: 'LITERAL',
					targetSourceId: null,
					typeOnly: false
				}
			],
			references: [
				{
					containingScopeId: null,
					id: 'reference:1',
					nodeId: 'node:1',
					resolutionProvenanceId: 'provenance:1',
					resolutionState: 'RESOLVED_ALIAS',
					resolvedSymbolId: null,
					role: 'IMPORT_EXPORT_BINDING',
					scopeLinkState: 'UNSUPPORTED',
					sourceId: 'source:1',
					structuralProvenanceId: 'provenance:1',
					symbolId: null
				}
			],
			scopes: [
				{
					domain: 'LEXICAL',
					end: null,
					id: 'scope:1',
					kind: 'PROGRAM_GLOBAL',
					ownerKind: null,
					ownerKindName: null,
					ownerNodeId: null,
					parentScopeId: null,
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1',
					sourceId: null,
					start: null
				}
			],
			symbols: [
				{
					declarationIds: [],
					fallbackReferenceNodeIds: ['node:1'],
					flagNames: ['Alias'],
					flags: 2_097_152,
					id: 'symbol:1',
					identityBasis: 'REFERENCE_FALLBACK',
					mergeState: 'DECLARATIONLESS',
					name: 'answer',
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1',
					valueDeclarationId: null
				}
			]
		};

		for (const path of [
			'$.aliases',
			'$.declarations',
			'$.moduleExports',
			'$.moduleResolutions',
			'$.references',
			'$.scopes',
			'$.symbols'
		]) {
			expect(issuesBelow(value, path)).toEqual([]);
		}
	});

	it('materializes the closed DWP-003 type, signature, overload, and relation shapes', () => {
		const baseRelation = {
			id: 'relation:1',
			programId: 'program:1',
			projectId: 'project:1',
			provenanceId: 'provenance:1',
			state: 'CONFIRMED'
		};
		const value = {
			assignabilityRequests: [
				{
					requestId: 'request:1',
					requesterRef: 'rule:1',
					source: {
						end: 3,
						logicalPath: 'src/model.ts',
						queryMode: 'TYPE_AT_LOCATION',
						start: 0,
						syntaxKind: 80
					},
					target: {
						end: 7,
						logicalPath: 'src/model.ts',
						queryMode: 'TYPE_FROM_TYPE_NODE',
						start: 4,
						syntaxKind: 154
					}
				}
			],
			overloadSets: [
				{
					callableSymbolId: 'symbol:1',
					id: 'overload:1',
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1'
				}
			],
			signatureParameters: [
				{
					declarationId: null,
					id: 'parameter:1',
					name: 'value',
					optional: false,
					ordinal: 0,
					provenanceId: 'provenance:1',
					rest: false,
					role: 'PARAMETER',
					signatureId: 'signature:1',
					symbolId: null,
					typeId: 'type:1'
				}
			],
			signatures: [
				{
					declarationId: null,
					declarationRole: 'CALL_SIGNATURE',
					display: '(value: T): T',
					displaySha256: 'a'.repeat(64),
					fingerprintProfile: 'jan-csaa-ts-signature-fingerprint/1.0.0',
					fingerprintSha256: 'b'.repeat(64),
					id: 'signature:1',
					identityBasis: 'OWNER_ORDINAL',
					owner: { id: 'type:1', kind: 'TYPE' },
					parameterIds: ['parameter:1'],
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1',
					providerOrdinal: 0,
					returnTypeId: 'type:1',
					semanticKind: 'OVERLOAD_SIGNATURE',
					signatureKind: 'CALL',
					typeParameterIds: ['type-parameter:1']
				}
			],
			typeParameters: [
				{
					constraintState: 'MISSING',
					constraintTypeId: null,
					declarationId: null,
					defaultState: 'MISSING',
					defaultTypeId: null,
					id: 'type-parameter:1',
					name: 'T',
					ordinal: 0,
					owner: { id: 'signature:1', kind: 'SIGNATURE' },
					parameterTypeId: 'type:1',
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1'
				}
			],
			typeRelations: [
				{
					...baseRelation,
					kind: 'TYPE_OF',
					queryMode: 'TYPE_AT_LOCATION',
					subject: { id: 'node:1', kind: 'AST_NODE' },
					typeId: 'type:1'
				},
				{
					...baseRelation,
					aliasDeclarationId: 'declaration:1',
					aliasedTypeId: 'type:1',
					kind: 'TYPE_ALIAS'
				},
				{
					...baseRelation,
					compositeTypeId: 'type:1',
					constituentTypeId: 'type:2',
					kind: 'UNION_CONSTITUENT',
					ordinal: 0
				},
				{
					...baseRelation,
					argumentTypeIds: ['type:2'],
					genericTarget: { id: 'type:1', kind: 'TYPE' },
					instantiatedTarget: { id: 'type:2', kind: 'TYPE' },
					kind: 'GENERIC_INSTANTIATION'
				},
				{
					...baseRelation,
					constraintState: 'MISSING',
					constraintTypeId: null,
					kind: 'PARAMETER_CONSTRAINT',
					typeParameterId: 'type-parameter:1'
				},
				{
					...baseRelation,
					baseTypeId: 'type:1',
					derivedTypeId: 'type:2',
					heritageOccurrence: { id: 'node:1', kind: 'AST_NODE' },
					kind: 'TYPE_EXTENSION'
				},
				{
					...baseRelation,
					checkerContextDigest: 'c'.repeat(64),
					kind: 'ASSIGNABILITY',
					requestId: 'request:1',
					result: true,
					sourceTypeId: 'type:1',
					targetTypeId: 'type:2'
				},
				{
					...baseRelation,
					kind: 'OVERLOAD_MEMBERSHIP',
					ordinal: 0,
					overloadSetId: 'overload:1',
					role: 'OVERLOAD_DECLARATION',
					signatureId: 'signature:1'
				}
			],
			types: [
				{
					acquisitionAnchors: [
						{ kind: 'NODE', nodeId: 'node:1', queryMode: 'TYPE_AT_LOCATION' },
						{
							componentKind: 'UNION',
							componentOrdinal: 0,
							kind: 'TYPE_COMPONENT',
							parentTypeId: 'type:2'
						}
					],
					aliasSymbolId: null,
					category: 'TYPE_PARAMETER',
					display: 'T',
					displayProfile: 'typescript-type-to-string-canonical-logical-paths/5.9.3-default/1.0.0',
					displaySha256: 'd'.repeat(64),
					fingerprintProfile: 'jan-csaa-ts-type-fingerprint/1.0.0',
					fingerprintSha256: 'e'.repeat(64),
					flagNames: ['TypeParameter'],
					flags: 262_144,
					id: 'type:1',
					identityBasis: 'QUERY_ANCHORED',
					objectFlagNames: [],
					objectFlags: null,
					programId: 'program:1',
					projectId: 'project:1',
					provenanceId: 'provenance:1',
					structureState: 'COMPLETE',
					symbolId: null,
					unsupportedStructureKinds: []
				}
			]
		};

		for (const path of [
			'$.assignabilityRequests',
			'$.overloadSets',
			'$.signatureParameters',
			'$.signatures',
			'$.typeParameters',
			'$.typeRelations',
			'$.types'
		])
			expect(issuesBelow(value, path)).toEqual([]);
	});

	it('accepts TS_SYMBOL provenance and the lexical-scope symbol population', () => {
		const population = (kind: string) => ({
			analyzed: 0,
			contextOnly: 0,
			discovered: 0,
			excluded: 0,
			excludedByPolicy: 0,
			expectedZero: true,
			failed: 0,
			included: 0,
			kind,
			manifests: {
				analyzed: '',
				contextOnly: '',
				discovered: '',
				excluded: '',
				excludedByPolicy: '',
				failed: '',
				included: '',
				unknown: '',
				unsupported: ''
			},
			members: {
				analyzed: [],
				contextOnly: [],
				excluded: [],
				excludedByPolicy: [],
				failed: [],
				unknown: [],
				unsupported: []
			},
			reconciles: true,
			unknown: 0,
			unsupported: 0
		});
		const value = {
			populations: [
				'SCOPE',
				'DECLARATION',
				'SYMBOL',
				'ALIAS',
				'REFERENCE',
				'MODULE_RESOLUTION',
				'MODULE_EXPORT'
			].map(population),
			provenances: [
				{
					capability: 'TS_SYMBOL',
					epistemic: {
						capabilityCoverage: 'supported',
						conflict: 'unopposed',
						executionHealth: 'succeeded',
						freshness: 'current-for-subject',
						inference: 'direct',
						rationale: 'Compiler-confirmed symbol binding.',
						supportBasis: {
							kind: 'compiler-confirmed',
							method: 'typescript-public-type-checker-binding',
							rationale: 'Public TypeChecker result.',
							sourceRefs: []
						},
						unresolvedRegions: []
					},
					extractionVersion: 'test',
					id: 'provenance:1',
					invalidationDependencies: [],
					limitations: [],
					parentProvenanceId: null,
					projectId: 'project:1',
					provider: { api: 'typescript', id: 'typescript', version: 'test' },
					snapshotId: 'snapshot:1',
					sourceId: null,
					subjectId: 'subject:1'
				}
			]
		};

		expect(issuesBelow(value, '$.populations')).toEqual([]);
		expect(issuesBelow(value, '$.provenances')).toEqual([]);
	});

	it('rejects invalid Slice 3B fields at their exact wire witnesses', () => {
		expectIssue(
			{
				aliases: [
					{
						aliasSymbolId: 'symbol:1',
						id: 'alias:1',
						provenanceId: 'provenance:1',
						state: 'BROKEN',
						targetSymbolId: null,
						terminalSymbolId: null
					}
				]
			},
			{ budget: false, message: 'Invalid scalar for alias.state.', path: '$.aliases[0].state' }
		);
		expectIssue(
			{
				references: [
					{
						id: 'reference:1',
						nodeId: 'node:1',
						provenanceId: 'provenance:1',
						resolutionState: 'UNRESOLVED',
						resolvedSymbolId: null,
						role: 'READ',
						sourceId: 'source:1',
						symbolId: null
					}
				]
			},
			{ budget: false, message: 'Invalid scalar for reference.role.', path: '$.references[0].role' }
		);
		expectIssue(
			{
				moduleResolutions: [
					{
						id: 'module-resolution:1',
						moduleSymbolId: null,
						nodeId: 'node:1',
						occurrenceKind: 'REQUIRE',
						provenanceId: 'provenance:1',
						resolutionState: 'UNRESOLVED',
						sourceId: 'source:1',
						specifier: 'dependency',
						specifierState: 'LITERAL',
						targetSourceId: null,
						typeOnly: false
					}
				]
			},
			{
				budget: false,
				message: 'Invalid scalar for module-resolution.occurrenceKind.',
				path: '$.moduleResolutions[0].occurrenceKind'
			}
		);
		expectIssue(
			{
				symbols: [
					{
						declarationIds: [],
						fallbackReferenceNodeIds: ['node:1'],
						flagNames: [],
						flags: -1,
						id: 'symbol:1',
						identityBasis: 'REFERENCE_FALLBACK',
						mergeState: 'DECLARATIONLESS',
						name: 'answer',
						programId: 'program:1',
						projectId: 'project:1',
						provenanceId: 'provenance:1',
						valueDeclarationId: null
					}
				]
			},
			{ budget: false, message: 'Invalid scalar for symbol.flags.', path: '$.symbols[0].flags' }
		);
	});

	it('rejects unknown type acquisition and relation discriminators', () => {
		expectIssue(
			{
				types: [
					{
						acquisitionAnchors: [{ kind: 'UNKNOWN' }],
						aliasSymbolId: null,
						category: 'TYPE_PARAMETER',
						display: 'T',
						displayProfile: 'typescript-type-to-string-canonical-logical-paths/5.9.3-default/1.0.0',
						displaySha256: 'd'.repeat(64),
						fingerprintProfile: 'jan-csaa-ts-type-fingerprint/1.0.0',
						fingerprintSha256: 'e'.repeat(64),
						flagNames: ['TypeParameter'],
						flags: 262_144,
						id: 'type:1',
						identityBasis: 'QUERY_ANCHORED',
						objectFlagNames: [],
						objectFlags: null,
						programId: 'program:1',
						projectId: 'project:1',
						provenanceId: 'provenance:1',
						structureState: 'COMPLETE',
						symbolId: null,
						unsupportedStructureKinds: []
					}
				]
			},
			{
				budget: false,
				message: 'Invalid closed type-acquisition-anchor discriminator.',
				path: '$.types[0].acquisitionAnchors[0]'
			}
		);
		expectIssue(
			{
				typeRelations: [
					{
						id: 'relation:1',
						kind: 'UNKNOWN',
						programId: 'program:1',
						projectId: 'project:1',
						provenanceId: 'provenance:1',
						state: 'CONFIRMED'
					}
				]
			},
			{
				budget: false,
				message: 'Invalid closed type-relation discriminator.',
				path: '$.typeRelations[0]'
			}
		);
	});

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
