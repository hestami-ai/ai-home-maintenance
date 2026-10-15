// ⭐⭐ `JAN-EXEC` Phase 8 (the review of E4; `REG-D-112`) — WHAT EVERY HAND-MADE RECORDING OF THE REPLAY'S TESTS SHARES:
// a published PWA to hold it to (finding 4: no try is served before the PWA is checked), the host's OS family (finding 6),
// and the executor's key as this code gives it (finding 1).
//
// ⭑ BUILT FROM THE PRODUCT'S OWN FUNCTIONS, never restated: the digest and the recorded PWA by `pwaContentDigest` and
// `recordedPwaOf` over one fixture PWA's rows, the key by `executorKeyOf` over the tools the catalog mints for a grant —
// so a test's recording is keyed exactly as a replay of this code will key its calls, and a change to the contract or the
// tool surface moves both together. ⭐ And what a recorded call's result is keyed as (`fixtureResultSha256`; the lead's
// delegated decision of 2026-10-15, to be registered), rendered by the catalog's own tool.
// ⚠ A `.testing.ts` module: test infrastructure only.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Workspace } from '@janumipwb/rph-ports';
import { toolResultAsSent, toPiToolResult, unknownToolResult } from '../agent/pi-tool-result.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import { mintExecutionTools, type ExecutionToolPorts } from '../tools/execution-tool-surface.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import {
	instructionsSha256,
	osFamilyOf,
	pwaContentDigest,
	recordedPwaOf,
	sha256Hex,
	toolDefinitionsSha256,
	type OsFamily,
	type PwaObjectRow,
	type RecordedCommand,
	type RecordedPwa,
	type RecordedToolCall
} from './recording.js';
import { executorKeyOf } from './replay-executor.js';
import { ReplayRefusal, type ExecutorKey } from './replay-run.js';
import { createReplayedProcessRunner } from './replayed-runner.js';

/** One published PWA of one root type — the rows a store would hold, in the shape the replay reads. */
export const FIXTURE_PWA_OBJECTS: readonly PwaObjectRow[] = [
	{
		id: 'pwa_fixture',
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		state: {
			publicationStatus: 'PUBLISHED',
			name: 'Fixture PWA',
			description: 'The replay tests’ one PWA.',
			domain: 'software',
			version: '0.1.0',
			rootPwuTypeId: 'pwut_fixture'
		},
		firstSequence: 1
	},
	{
		id: 'pwut_fixture',
		objectType: 'PWU_TYPE',
		state: {
			pwaId: 'pwa_fixture',
			name: 'Requirements',
			pwuKind: 'REQUIREMENT_DEFINITION',
			purpose: 'Define what the product must do.',
			isRoot: true,
			workDischarge: 'MODEL',
			requiredAssurancePolicyIds: []
		},
		firstSequence: 2
	}
];

/** The manifest fields a hand-made recording needs beside its own: the PWA it holds itself to, and its family. */
export function fixtureManifest(): {
	readonly pwaContentDigest: string;
	readonly osFamily: OsFamily;
	readonly pwa: RecordedPwa;
} {
	const digest = pwaContentDigest(FIXTURE_PWA_OBJECTS);
	const pwa = recordedPwaOf(FIXTURE_PWA_OBJECTS);
	if (typeof digest !== 'string' || Array.isArray(pwa))
		throw new Error('the fixture PWA is not one published PWA');
	return { pwaContentDigest: digest, osFamily: osFamilyOf(), pwa };
}

/** Ports whose tools are minted only to be NAMED: a key never runs one. */
const UNUSED_PORTS = {
	workspace: {} as Workspace,
	runner: {
		kind: 'REPLAYED',
		run: () => Promise.resolve({ ran: false, refusedBecause: 'unused' })
	},
	processRuns: { record: () => undefined, observed: () => ({ observedCount: 0, runs: [] }) }
} as unknown as ExecutionToolPorts;

/** ⭐ The executor's key for a grant, unhashed: what this code gives the executor (`executorKeyOf`). */
export function fixtureKeyOf(
	granted: readonly string[] = ['file-system', 'process-execution']
): ExecutorKey {
	return executorKeyOf(
		mintExecutionTools({
			ports: UNUSED_PORTS,
			grantedCapabilities: granted,
			bindingAuthorizationStatus: 'AUTHORIZED'
		})
	);
}

/**
 * ⭐ THE EXECUTOR'S KEY FOR A GRANT, AS THE REPLAY WILL COMPUTE IT (`executorKeyOf` over the tools the catalog mints for
 * `granted`), hashed as a recording holds it. ⚠ Unscrubbed: neither the contract nor a tool definition names a path.
 */
export function fixtureExecutorKey(
	granted: readonly string[] = ['file-system', 'process-execution']
): { readonly instructionsSha256: string; readonly toolsSha256: string } {
	const key = fixtureKeyOf(granted);
	const same = (s: string): string => s;
	return {
		instructionsSha256: instructionsSha256(key.instructions, same),
		toolsSha256: toolDefinitionsSha256(key.tools, same)
	};
}

/**
 * ⭐ WHAT THIS CODE RENDERS FOR A RECORDED CALL, KEYED AS A RECORDING KEYS IT (`resultSha256`; the lead's delegated
 * decision of 2026-10-15, to be registered): the call run through the tool the catalog mints for the full grant — over a
 * scratch FILESYSTEM workspace, and the REPLAYED runner serving `command` — its result as Pi would send it
 * (`toolResultAsSent`), scrubbed by `scrub` and hashed. A call to a tool not minted is Pi's own answer to it. So a test's
 * recording is keyed exactly as a replay of this code will key its calls, and a change to a rendering moves both.
 * ⭑ `expand` is the test's own expansion of the recorded arguments: a size the tool reports of an expanded path is then
 * the test host's, as the replay's will be. ⚠ It writes into a scratch folder of its own, removed after.
 */
export async function fixtureResultSha256(
	call: Pick<RecordedToolCall, 'name' | 'arguments'>,
	o: {
		readonly expand: (text: string) => string;
		readonly scrub: (text: string) => string;
		readonly command?: RecordedCommand;
	}
): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-fixture-result-'));
	try {
		const place = (name: string, purgeability: 'RETAINED_BY_PARTICIPATION' | 'PURGEABLE_AT_EXPIRY') => {
			mkdirSync(join(dir, name));
			return createFilesystemWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: 'und_fixture',
				purgeability,
				directoryPath: join(dir, name)
			});
		};
		const workspace = place('workspace', 'RETAINED_BY_PARTICIPATION');
		const runner = createReplayedProcessRunner({
			deliverableWorkspace: workspace,
			outputWorkspace: place('workspace.process-output', 'PURGEABLE_AT_EXPIRY'),
			commands: {
				nextCommand: () =>
					o.command === undefined
						? { refusal: new ReplayRefusal('REPLAY_EXHAUSTED', 'the fixture names no command') }
						: { recorded: o.command },
				expand: o.expand
			}
		});
		const tool = mintExecutionTools({
			ports: { workspace, runner, processRuns: createProcessRunObserver() },
			grantedCapabilities: ['file-system', 'process-execution'],
			bindingAuthorizationStatus: 'AUTHORIZED'
		}).find((t) => t.name === call.name);
		const expandValue = (value: unknown): unknown => {
			if (typeof value === 'string') return o.expand(value);
			if (Array.isArray(value)) return value.map(expandValue);
			if (typeof value === 'object' && value !== null)
				return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandValue(v)]));
			return value;
		};
		const result =
			tool === undefined
				? unknownToolResult(call.name)
				: toPiToolResult(await tool.run(expandValue(call.arguments) as Record<string, unknown>));
		return sha256Hex(o.scrub(toolResultAsSent(result)));
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
	}
}
