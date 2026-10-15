// ⭐⭐ `JAN-EXEC` Phase 8 (the review of E4; `REG-D-112`) — WHAT EVERY HAND-MADE RECORDING OF THE REPLAY'S TESTS SHARES:
// a published PWA to hold it to (finding 4: no try is served before the PWA is checked), the host's OS family (finding 6),
// and the executor's key as this code gives it (finding 1).
//
// ⭑ BUILT FROM THE PRODUCT'S OWN FUNCTIONS, never restated: the digest and the recorded PWA by `pwaContentDigest` and
// `recordedPwaOf` over one fixture PWA's rows, the key by `executorKeyOf` over the tools the catalog mints for a grant —
// so a test's recording is keyed exactly as a replay of this code will key its calls, and a change to the contract or the
// tool surface moves both together.
// ⚠ A `.testing.ts` module: test infrastructure only.
import type { Workspace } from '@janumipwb/rph-ports';
import { mintExecutionTools, type ExecutionToolPorts } from '../tools/execution-tool-surface.js';
import {
	instructionsSha256,
	osFamilyOf,
	pwaContentDigest,
	recordedPwaOf,
	toolDefinitionsSha256,
	type OsFamily,
	type PwaObjectRow,
	type RecordedPwa
} from './recording.js';
import { executorKeyOf } from './replay-executor.js';
import type { ExecutorKey } from './replay-run.js';

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
