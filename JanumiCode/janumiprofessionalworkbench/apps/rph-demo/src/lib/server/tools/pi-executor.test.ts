// ⭐⭐ R3-C (`REG-F-512`'s predicted red, for the executor) — A SESSION OPENED OVER A WORKSPACE HOLDING `AGENTS.md` AND
// `.pi/APPEND_SYSTEM.md` CARRIES NEITHER TEXT IN ITS RECORDED COMPOSITE.
//
// ⭑ WHAT IT DRIVES: `openPiExecutionSession` itself — Pi's real settings manager, loader and session, and the recorder on
// the session's `onPayload` — over a workspace holding the two files the register names, under a folder holding a
// `CLAUDE.md`, with Pi's agent folder holding its own `AGENTS.md`, `APPEND_SYSTEM.md` and an extension. One turn is
// taken, and the composite it recorded is read. `pi-executor-resources.test.ts` holds the options the loader is built
// from; this holds what Pi makes of them.
// ⭑ THE MODEL IS A FAUX ONE: a provider declared in the temporary agent folder's `models.json`, whose API is `pi-ai`'s
// faux core, registered in the registry Pi's SDK streams through (`@earendil-works/pi-ai/compat`; `dist/core/sdk.js`).
// Its scripted answer first hands `onPayload` the request a Responses provider builds from the same context
// (`convertResponsesMessages`, `convertResponsesTools`), and awaits it, as `openai-responses.js` does before it sends —
// so the recorder keeps what a real provider would have sent.
// ⛔ NO MODEL, NO NETWORK, NOTHING OF THE OPERATOR'S: the agent folder and the home folder are temporary (Pi reads
// `~/.agents/skills` through `HOME`), nothing lists a package, `PI_OFFLINE` is set, and the faux provider answers in
// process. Importing Pi writes nothing to the home folder, so the import before the stubs below leaves it untouched.
// ⛔ PREDICTED RED — "at HEAD it carries both" — observed 2026-10-16 with `pi-executor.ts`'s settings manager and loader
// as they stood before the loader was closed (`06465c50`'s parent: the project trusted, the contract the one override):
// *"AssertionError: the files whose text the recorded composite carries: expected [ 'the workspace AGENTS.md', …(3) ] to
// deeply equal []"*, the four being the workspace's `AGENTS.md` and `.pi/APPEND_SYSTEM.md`, the `CLAUDE.md` above and
// the agent folder's `AGENTS.md`. With `noContextFiles: false` alone: *"… expected [ 'the workspace AGENTS.md', …(2) ]
// to deeply equal []"*; with the appended prompt's override alone undone: *"… expected [ 'the agent folder
// APPEND_SYSTEM.md' ] to deeply equal []"*.
// ⚠ WHAT IT DOES NOT SEE: whether the workspace's settings are trusted. The workspace's `APPEND_SYSTEM.md` is kept out
// by two guards at once — a settings manager trusting no project, and an appended prompt overridden to nothing — so
// either alone keeps this green; the agent folder's `APPEND_SYSTEM.md`, read whatever the trust, is what reddens here
// when the override goes. The trust is held from source by `pi-executor-resources.test.ts`.
// ⚠ IT LOADS PI'S CODING AGENT, which `pi-executor.ts` imports at module scope — the one gate test that does. `JAN-SELRES`
// RS-1's D4 kept Pi's SDK out of the gate, for the weight of its Node dependencies; this test departs from that to pin
// what no source-reading test can, what Pi makes of the options, and the lead may keep D4 whole by dropping it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	createFauxCore,
	fauxAssistantMessage,
	registerApiProvider,
	unregisterApiProviders,
	type FauxResponseFactory
} from '@earendil-works/pi-ai/compat';
import {
	convertResponsesMessages,
	convertResponsesTools
} from '@earendil-works/pi-ai/api/openai-responses-shared';
import type { ProcessRunner, Workspace } from '@janumipwb/rph-ports';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import type { ProducerSessionContext } from '../execution/producer-session.js';
import { isToolInvocationResult } from './backing-tool.js';
import { openPiExecutionSession } from './pi-executor.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-pi-executor-'));
const AGENT = join(ROOT, 'agent');
const WORKSPACE = join(ROOT, 'runs', 'workspace');
const PROVIDER = 'jpwb-faux';
const API = 'jpwb-faux-payload';
const SOURCE_ID = 'pi-executor.test';

/** The text of each file Pi takes by default, by where it lies. */
const MARKS = {
	'the workspace AGENTS.md': 'MARK 1: the workspace AGENTS.md.',
	'the workspace .pi/APPEND_SYSTEM.md': 'MARK 2: the workspace .pi/APPEND_SYSTEM.md.',
	'the CLAUDE.md above the workspace': 'MARK 3: the CLAUDE.md above the workspace.',
	'the agent folder AGENTS.md': 'MARK 4: the agent folder AGENTS.md.',
	'the agent folder APPEND_SYSTEM.md': 'MARK 5: the agent folder APPEND_SYSTEM.md.'
} as const;

function write(path: string, text: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text);
}

const faux = createFauxCore({ api: API, provider: PROVIDER, models: [{ id: 'faux-model' }] });

/** A scripted answer that first hands Pi's `onPayload` the request a Responses provider would build, and awaits it. */
const answering =
	(text: string): FauxResponseFactory =>
	async (context, options, _state, model) => {
		await options?.onPayload?.(
			{
				model: model.id,
				input: convertResponsesMessages(model, context, new Set([model.provider])),
				...(context.tools && context.tools.length > 0
					? { tools: convertResponsesTools(context.tools) }
					: {})
			},
			model
		);
		return fauxAssistantMessage(text);
	};

const context: ProducerSessionContext = {
	workspace: {
		ownerId: 'pi-executor-test',
		ownerKind: 'UNDERTAKING',
		materialization: 'FILESYSTEM',
		directoryPath: WORKSPACE,
		purgeability: 'PURGEABLE_AT_EXPIRY'
	} as unknown as Workspace,
	runner: { kind: 'REAL' } as unknown as ProcessRunner,
	grantedCapabilities: ['file-system', 'process-execution'],
	bindingAuthorizationStatus: 'AUTHORIZED'
};

beforeAll(() => {
	write(
		join(AGENT, 'models.json'),
		JSON.stringify({
			providers: {
				[PROVIDER]: {
					// ⭑ Required by Pi's schema of a provider that declares models; never reached — the API is the faux one.
					baseUrl: 'http://127.0.0.1:9',
					apiKey: 'unused-by-the-faux-provider',
					api: API,
					models: [{ id: 'faux-model', reasoning: false, input: ['text'] }]
				}
			}
		})
	);
	write(join(AGENT, 'AGENTS.md'), `${MARKS['the agent folder AGENTS.md']}\n`);
	write(join(AGENT, 'APPEND_SYSTEM.md'), `${MARKS['the agent folder APPEND_SYSTEM.md']}\n`);
	write(
		join(AGENT, 'extensions', 'agent-folder-extension.js'),
		"export default function (pi) {\n\tpi.registerTool({ name: 'agent_folder_extension', label: 'agent_folder_extension', description: 'an extension tool', parameters: { type: 'object', properties: {} }, async execute() { return { content: [{ type: 'text', text: 'ran' }] }; } });\n}\n"
	);
	write(join(ROOT, 'runs', 'CLAUDE.md'), `${MARKS['the CLAUDE.md above the workspace']}\n`);
	write(join(WORKSPACE, 'AGENTS.md'), `${MARKS['the workspace AGENTS.md']}\n`);
	write(
		join(WORKSPACE, '.pi', 'APPEND_SYSTEM.md'),
		`${MARKS['the workspace .pi/APPEND_SYSTEM.md']}\n`
	);
	vi.stubEnv('PI_CODING_AGENT_DIR', AGENT);
	vi.stubEnv('HOME', join(ROOT, 'home'));
	vi.stubEnv('USERPROFILE', join(ROOT, 'home'));
	vi.stubEnv('PI_OFFLINE', '1');
	registerApiProvider(
		{ api: faux.api, stream: faux.stream, streamSimple: faux.streamSimple },
		SOURCE_ID
	);
});

afterAll(() => {
	unregisterApiProviders(SOURCE_ID);
	vi.unstubAllEnvs();
	rmSync(ROOT, { recursive: true, force: true });
});

describe('⭐ REG-F-512’s predicted red, for the executor: its recorded composite carries nothing Pi finds around the workspace', () => {
	it('⛔ a session opened over a workspace holding AGENTS.md and .pi/APPEND_SYSTEM.md carries neither text — nor the CLAUDE.md above it, nor the agent folder’s — and its tools are the minted ones', async () => {
		faux.setResponses([answering('The faux provider’s answer.')]);
		const session = await openPiExecutionSession(context, `${PROVIDER}/faux-model`);
		let composite: string | undefined;
		try {
			const result = await session.turn('One turn, answered from the faux script.');
			composite = isToolInvocationResult(result) ? result.materializedInput : undefined;
		} finally {
			session.dispose();
		}
		// ⭑ CONTROL: a composite was recorded, and it is this session's — its instruction begins with the contract.
		expect(composite, 'the turn recorded a composite').toBeDefined();
		const payload = JSON.parse(composite!) as {
			readonly input: readonly { readonly role?: string; readonly content?: unknown }[];
			readonly tools?: readonly { readonly name?: string }[];
		};
		const instruction = payload.input.find((m) => m.role === 'system' || m.role === 'developer')
			?.content as string;
		expect(
			instruction.startsWith(EXECUTION_CONTRACT_PROMPT),
			'the instruction is the contract'
		).toBe(true);
		// ⛔ THE PROPERTY, BY NAME, so a red says which file reached the model.
		expect(
			Object.entries(MARKS)
				.filter(([, text]) => composite!.includes(text))
				.map(([where]) => where),
			'the files whose text the recorded composite carries'
		).toEqual([]);
		// ⭑ And after the contract, Pi's own two lines alone.
		expect(instruction.slice(EXECUTION_CONTRACT_PROMPT.length)).toMatch(
			/^\nCurrent date: \d{4}-\d{2}-\d{2}\nCurrent working directory: [^\n]+$/
		);
		expect(
			(payload.tools ?? []).map((t) => t.name).sort(),
			'the tools offered to the model'
		).toEqual(['run_command', 'write_file']);
	});
});
