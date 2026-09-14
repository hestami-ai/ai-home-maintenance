// SPIKE probe 0 — does a Pi session with noTools:'builtin' + custom tools actually call them?
import {
	AuthStorage, createAgentSession, DefaultResourceLoader, defineTool,
	getAgentDir, ModelRegistry, resolveCliModel, SessionManager, SettingsManager
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const sandbox = mkdtempSync(join(tmpdir(), 'jpwb-spike-'));
console.log('SANDBOX=' + sandbox);

const calls: string[] = [];

const writeFileTool = defineTool({
	name: 'write_file',
	label: 'write_file',
	description: 'Write a UTF-8 text file into the work unit sandbox. path is relative to the sandbox root.',
	parameters: Type.Object({
		path: Type.String({ description: 'Relative path inside the sandbox' }),
		contents: Type.String({ description: 'File contents' })
	}),
	execute: async (_id: string, params: Record<string, unknown>) => {
		const rel = String(params.path);
		const abs = resolve(sandbox, rel);
		if (!abs.startsWith(resolve(sandbox))) throw new Error('escape');
		writeFileSync(abs, String(params.contents), 'utf8');
		calls.push('write_file:' + rel);
		return { content: [{ type: 'text', text: `wrote ${rel}` }], details: { ok: true, summary: `wrote ${rel}` } };
	}
});

const runCommandTool = defineTool({
	name: 'run_command',
	label: 'run_command',
	description: 'Run a command in the sandbox. argv is the program plus its arguments.',
	parameters: Type.Object({ argv: Type.Array(Type.String(), { description: 'argv' }) }),
	execute: async (_id: string, params: Record<string, unknown>) => {
		const argv = (params.argv as string[]) ?? [];
		const r = spawnSync(argv[0]!, argv.slice(1), { cwd: sandbox, encoding: 'utf8', timeout: 20000 });
		calls.push('run_command:' + argv.join(' '));
		const text = `exitCode=${r.status}\nstdout:\n${r.stdout ?? ''}\nstderr:\n${r.stderr ?? ''}`;
		return { content: [{ type: 'text', text }], details: { ok: r.status === 0, summary: `exit ${r.status}` } };
	}
});

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const settingsManager = SettingsManager.create(process.cwd(), getAgentDir());
const resolved = resolveCliModel({ cliModel: process.env.JPWB_EXECUTOR_MODEL ?? 'openai-codex/gpt-5.6-sol', modelRegistry });
if (!resolved.model) { console.log('NO_MODEL'); process.exit(2); }
console.log('MODEL=' + resolved.model.provider + '/' + resolved.model.id);

const loader = new DefaultResourceLoader({
	cwd: process.cwd(), agentDir: getAgentDir(), settingsManager,
	systemPromptOverride: () => 'You are an execution agent. You have exactly two tools: write_file and run_command. Use them. Do not ask permission.'
});
await loader.reload();

const created = await createAgentSession({
	model: resolved.model, thinkingLevel: 'off',
	noTools: 'builtin', customTools: [writeFileTool, runCommandTool],
	resourceLoader: loader, sessionManager: SessionManager.inMemory(),
	settingsManager, authStorage, modelRegistry
});
const session = created.session;
let text = '';
const unsub = session.subscribe((e: any) => {
	if (e.type === 'message_update' && e.assistantMessageEvent?.type === 'text_delta') text += e.assistantMessageEvent.delta;
	if (e.type === 'tool_execution_start') console.log('TOOL_START ' + e.toolName + ' ' + JSON.stringify(e.args));
	if (e.type === 'tool_execution_end') console.log('TOOL_END ' + e.toolName + ' isError=' + e.isError);
});
await session.prompt('Write a file named hello.txt containing exactly the line "spike-ok-42", then run a command that prints its contents, then tell me the exit code.');
unsub(); session.dispose();
console.log('CALLS=' + JSON.stringify(calls));
console.log('ANSWER=' + text.slice(0, 800));
const f = join(sandbox, 'hello.txt');
console.log('EXISTS=' + existsSync(f));
if (existsSync(f)) console.log('BYTES=' + JSON.stringify(readFileSync(f, 'utf8')));
