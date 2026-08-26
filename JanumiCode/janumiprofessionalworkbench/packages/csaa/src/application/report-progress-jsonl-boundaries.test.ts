import { describe, expect, it } from 'vitest';

import { createArrowCommandCensusProgressJsonlWriter } from './arrow-command-census-progress-jsonl.js';
import { createCallGraphProgressJsonlWriter } from './call-graph-progress-jsonl.js';
import { createCommandDispatchTopologyProgressJsonlWriter } from './command-dispatch-topology-progress-jsonl.js';
import { createCommandEventContractOverlayProgressJsonlWriter } from './command-event-contract-overlay-progress-jsonl.js';
import { createCommandHandlerGraphProgressJsonlWriter } from './command-handler-graph-progress-jsonl.js';
import { createDeclarationContextProgressJsonlWriter } from './declaration-context-progress-jsonl.js';
import { createGuardClassificationOverlayProgressJsonlWriter } from './guard-classification-overlay-progress-jsonl.js';
import { createGuardEnforcementLedgerProgressJsonlWriter } from './guard-enforcement-ledger-progress-jsonl.js';
import { createLogicalGraphCompositionProgressJsonlWriter } from './logical-graph-composition-progress-jsonl.js';
import { createModuleDependencyProgressJsonlWriter } from './module-dependency-progress-jsonl.js';
import { createModuleResolutionTraceProgressJsonlWriter } from './module-resolution-trace-progress-jsonl.js';
import { createProjectContextProgressJsonlWriter } from './project-context-progress-jsonl.js';
import { createReadWriteAccessProgressJsonlWriter } from './read-write-access-progress-jsonl.js';
import { createSemanticSourceQueryProgressJsonlWriter } from './semantic-source-query-progress-jsonl.js';
import { createStateMachineGraphProgressJsonlWriter } from './state-machine-graph-progress-jsonl.js';
import { createStructuralModuleReachabilityProgressJsonlWriter } from './structural-module-reachability-progress-jsonl.js';
import { createStructuralSccProgressJsonlWriter } from './structural-scc-progress-jsonl.js';

interface BoundaryWriter {
	emit(event: unknown): void;
	stats(): { readonly truncated: boolean };
}

type BoundaryFactory = (options: {
	readonly maxBytes?: number;
	readonly maxEvents?: number;
	readonly write: (line: string) => unknown;
}) => BoundaryWriter;

function asBoundaryFactory(factory: unknown): BoundaryFactory {
	return factory as BoundaryFactory;
}

const writers = {
	arrowCommandCensus: asBoundaryFactory(createArrowCommandCensusProgressJsonlWriter),
	callGraph: asBoundaryFactory(createCallGraphProgressJsonlWriter),
	commandDispatchTopology: asBoundaryFactory(createCommandDispatchTopologyProgressJsonlWriter),
	commandEventContractOverlay: asBoundaryFactory(
		createCommandEventContractOverlayProgressJsonlWriter
	),
	commandHandlerGraph: asBoundaryFactory(createCommandHandlerGraphProgressJsonlWriter),
	declarationContext: asBoundaryFactory(createDeclarationContextProgressJsonlWriter),
	guardClassificationOverlay: asBoundaryFactory(
		createGuardClassificationOverlayProgressJsonlWriter
	),
	guardEnforcementLedger: asBoundaryFactory(createGuardEnforcementLedgerProgressJsonlWriter),
	logicalGraphComposition: asBoundaryFactory(createLogicalGraphCompositionProgressJsonlWriter),
	moduleDependency: asBoundaryFactory(createModuleDependencyProgressJsonlWriter),
	moduleResolutionTrace: asBoundaryFactory(createModuleResolutionTraceProgressJsonlWriter),
	projectContext: asBoundaryFactory(createProjectContextProgressJsonlWriter),
	readWriteAccess: asBoundaryFactory(createReadWriteAccessProgressJsonlWriter),
	semanticSourceQuery: asBoundaryFactory(createSemanticSourceQueryProgressJsonlWriter),
	stateMachineGraph: asBoundaryFactory(createStateMachineGraphProgressJsonlWriter),
	structuralModuleReachability: asBoundaryFactory(
		createStructuralModuleReachabilityProgressJsonlWriter
	),
	structuralScc: asBoundaryFactory(createStructuralSccProgressJsonlWriter)
} as const;

const strictLimitWriters = [
	['arrow command census', writers.arrowCommandCensus],
	['call graph', writers.callGraph],
	['command dispatch topology', writers.commandDispatchTopology],
	['command handler graph', writers.commandHandlerGraph],
	['declaration context', writers.declarationContext],
	['guard enforcement ledger', writers.guardEnforcementLedger],
	['module dependency', writers.moduleDependency],
	['module resolution trace', writers.moduleResolutionTrace],
	['project context', writers.projectContext],
	['read/write access', writers.readWriteAccess],
	['state machine graph', writers.stateMachineGraph],
	['structural module reachability', writers.structuralModuleReachability],
	['structural SCC', writers.structuralScc]
] as const;

const byteLimitWriters = [
	['command dispatch topology', writers.commandDispatchTopology],
	['command handler graph', writers.commandHandlerGraph]
] as const;

describe('report progress JSONL boundary behavior', () => {
	it.each(Object.entries(writers))(
		'%s ignores all events after terminal truncation',
		(_name, createWriter) => {
			const lines: string[] = [];
			const writer = createWriter({
				maxEvents: 2,
				write(line) {
					lines.push(line);
				}
			});
			writer.emit({ sequence: 1 });
			writer.emit({ sequence: 2 });
			const terminalLineCount = lines.length;
			writer.emit({ sequence: 3 });
			expect(writer.stats().truncated).toBe(true);
			expect(lines).toHaveLength(terminalLineCount);
		}
	);

	it.each(strictLimitWriters)(
		'%s rejects a transport limit below the safe minimum',
		(_name, createWriter) => {
			expect(() => createWriter({ maxEvents: 1, write: () => undefined })).toThrow(
				'Progress transport limit must be an equal-or-stricter safe integer.'
			);
		}
	);

	it.each(byteLimitWriters)('%s emits its bounded byte-limit marker', (_name, createWriter) => {
		const lines: string[] = [];
		const writer = createWriter({
			maxBytes: 32 * 1024,
			write(line) {
				lines.push(line);
			}
		});
		writer.emit({ payload: 'x'.repeat(32 * 1024) });
		expect(JSON.parse(lines.at(-1)!)).toMatchObject({
			reason: 'BYTE_LIMIT',
			state: 'TRUNCATED'
		});
		expect(writer.stats().truncated).toBe(true);
	});
});
