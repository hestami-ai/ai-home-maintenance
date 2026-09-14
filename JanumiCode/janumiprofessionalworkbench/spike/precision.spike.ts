// SPIKE PRECISION CONTROLS (spike/tool-execution).
//
// ⛔ THE FIRST RUN PROVED THE STEP-LEVEL REFUSAL FIRES. It did NOT prove the TOOL-LEVEL gate is precise, and
// the two are different gates. In CASE C the step REQUESTED process-execution and was denied it, so
// `stepCapabilityRefusal` refused the whole step and the model never ran — a correct outcome that tells us
// nothing about what a model sees when it runs with a NARROWER grant. That is what this file measures.
import { it } from 'vitest';
import { appendFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInMemoryArtifactStore, createInMemoryWorkspace, createRefusingProcessRunner } from '@janumipwb/rph-ports';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { runModelInvocationStep } from '../apps/rph-demo/src/lib/server/execution/run-model-step.js';
import type { StepBindingRequest } from '../apps/rph-demo/src/lib/server/execution/step-binding.js';
import {
	CAP_FILE_SYSTEM,
	CAP_PROCESS_EXECUTION,
	grantedSandboxTools
} from '../apps/rph-demo/src/lib/server/sandbox/execution-tools.js';
import { createDirectoryWorkspace } from '../apps/rph-demo/src/lib/server/sandbox/workspace-dir.js';
import { createSpawnProcessRunner } from '../apps/rph-demo/src/lib/server/sandbox/process-runner-spawn.js';
import { openPiExecutionSession } from '../apps/rph-demo/src/lib/server/tools/pi-executor.js';

const LOG = 'spike/precision-transcript.txt';
writeFileSync(LOG, '');

it('SPIKE precision controls', async () => {
	const say = (s: string): void => { console.log(s); appendFileSync(LOG, s + String.fromCharCode(10)); };
	const rule = (s: string): void => say(String.fromCharCode(10) + '='.repeat(96) + String.fromCharCode(10) + s + String.fromCharCode(10) + '='.repeat(96));

	const dir = mkdtempSync(join(tmpdir(), 'jpwb-prec-'));
	const workspace = createDirectoryWorkspace('UNDERTAKING', 'und_prec', dir);
	const runner = createSpawnProcessRunner();
	say(`workspace = ${workspace.directoryPath}`);

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('P1 — ADMITTED WITH A NARROWER GRANT. request = [network, file-system]; granted = the same.');
	say('The step runs. write_file exists. run_command was never minted. A LIVE model is asked to do both.');
	{
		const granted = ['network', CAP_FILE_SYSTEM];
		const request: StepBindingRequest = {
			runtimeBindingId: 'bind_p1',
			executionStepId: 'step_p1',
			roleId: 'MODEL',
			// ⭑ THE STEP ASKS ONLY FOR WHAT IT WILL USE — which is what makes it ADMISSIBLE at all.
			requestedCapabilities: [{ capability: 'network' }, { capability: CAP_FILE_SYSTEM }]
		};
		const grant = grantedSandboxTools({ granted, workspace, runner, commandTimeoutMs: 20000 });
		say(`minted = ${JSON.stringify(grant.tools.map((t) => t.name))}`);
		say(`withheld = ${JSON.stringify(grant.withheld.map((w) => w.tool))}`);
		const session = await openPiExecutionSession({ tools: grant.tools });
		const template: PromptTemplate = {
			templateText:
				'Work unit: {subject}. Write a file named narrow.txt containing the line NARROW-OK, then RUN a ' +
				'command that prints its contents and report the exit code. If you cannot run a command, say ' +
				'exactly which tool you were missing.',
			templateVersion: 1,
			declaredPlaceholders: ['subject'],
			status: 'ACTIVE'
		};
		let n = 0;
		const dispatched: RecordModelExchangePayload[] = [];
		const out = await runModelInvocationStep({
			subject: { id: 'pwu_p1', title: 'Narrow grant', purpose: 'probe', expectedOutputs: ['a file'] },
			subjectSemanticVersion: 1,
			pwuTypeId: 'pwut_p1',
			template,
			session,
			store: createInMemoryArtifactStore(),
			tenantPrefix: 'tnt-spike',
			dispatchExchange: (p: RecordModelExchangePayload) => { dispatched.push(p); return { status: 'ACCEPTED' }; },
			newId: (p: string) => `${p}_${++n}`,
			now: () => new Date().toISOString(),
			modelId: process.env.JPWB_EXECUTOR_MODEL ?? 'unresolved',
			providerId: 'pi',
			contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
			binding: { kind: 'BOUND' as const, request, granted }
		});
		say(`ran = ${out.ran}  ${out.ran ? '' : out.refusedBecause}`);
		const calls = session.toolCalls?.() ?? [];
		say(`TOOL CALLS (${calls.length}):`);
		for (const c of calls) say(`  ${c.tool} ok=${c.ok} args=${JSON.stringify(c.args).slice(0, 160)}`);
		say(`⭑ run_command calls = ${calls.filter((c) => c.tool === 'run_command').length}  (MUST be 0)`);
		say(`⭑ write_file calls  = ${calls.filter((c) => c.tool === 'write_file').length}  (MUST be >= 1)`);
		say(`narrow.txt on disk = ${existsSync(join(dir, 'narrow.txt'))}`);
		if (out.ran) say(`ANSWER = ${out.answer.slice(0, 700)}`);
		session.dispose();
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('P2 — EXACT MEMBERSHIP. A granted PREFIX must not authorize the capability.');
	{
		for (const granted of [['file'], ['file-syste'], ['file-system-extra'], ['FILE-SYSTEM'], ['file-system']]) {
			const g = grantedSandboxTools({ granted, workspace, runner, commandTimeoutMs: 1000 });
			say(`granted=${JSON.stringify(granted).padEnd(24)} -> minted ${JSON.stringify(g.tools.map((t) => t.name))}`);
		}
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('P3 — CONTAINMENT. The minted write_file must refuse a path outside the workspace.');
	{
		const g = grantedSandboxTools({ granted: [CAP_FILE_SYSTEM], workspace, runner, commandTimeoutMs: 1000 });
		const writeFile = g.tools.find((t) => t.name === 'write_file')!;
		for (const path of ['../escaped.txt', 'a/../../escaped.txt', 'C:/Windows/Temp/escaped.txt', '/etc/passwd', 'ok/inside.txt']) {
			const r = await writeFile.run({ path, contents: 'ESCAPED' });
			say(`path=${JSON.stringify(path).padEnd(34)} ok=${String(r.ok).padEnd(5)} ${r.summary.slice(0, 110)}`);
		}
		const sibling = resolve(dir, '..', 'escaped.txt');
		say(`⭑ escaped.txt beside the workspace exists = ${existsSync(sibling)}  (MUST be false)  [${sibling}]`);
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('P4 — THE LIBRARY DEFAULTS. In-memory workspace + refusing runner: no exit code is invented.');
	{
		const mem = createInMemoryWorkspace('UNDERTAKING', 'und_mem');
		const refusing = createRefusingProcessRunner();
		say(`workspace materialization = ${mem.materialization}, directoryPath = ${String(mem.directoryPath)}`);
		say(`runner kind = ${refusing.kind}`);
		const g = grantedSandboxTools({ granted: [CAP_FILE_SYSTEM, CAP_PROCESS_EXECUTION], workspace: mem, runner: refusing, commandTimeoutMs: 1000 });
		const w = await g.tools.find((t) => t.name === 'write_file')!.run({ path: 'x.txt', contents: 'hi' });
		say(`write_file -> ok=${w.ok} ${w.summary}`);
		say(`readback   -> ${JSON.stringify(await mem.readFile('x.txt'))}`);
		const r = await g.tools.find((t) => t.name === 'run_command')!.run({ argv: ['node', '-e', 'console.log(1)'] });
		say(`run_command -> ok=${r.ok}`);
		say(`  summary: ${r.summary}`);
		say(`  data (must carry NO exitCode): ${JSON.stringify(r.data)}`);
		// And the refusing runner itself, addressed directly.
		say(`refusing runner direct -> ${JSON.stringify(await refusing.run({ argv: ['node'], cwd: dir, timeoutMs: 10 }))}`);
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('P5 — TIMEOUT is OBSERVED, not inferred (§36.2 separates TIMEOUT from TOOL_FAILURE).');
	{
		const g = grantedSandboxTools({ granted: [CAP_PROCESS_EXECUTION], workspace, runner, commandTimeoutMs: 1500 });
		const run = g.tools.find((t) => t.name === 'run_command')!;
		const slow = await run.run({ argv: ['node', '-e', 'setTimeout(()=>{},60000)'] });
		say(`slow command -> ok=${slow.ok} data=${JSON.stringify(slow.data)}`);
		const fails = await run.run({ argv: ['node', '-e', 'process.exit(3)'] });
		say(`exit-3 command -> ok=${fails.ok} data=${JSON.stringify(fails.data)}`);
		const missing = await run.run({ argv: ['definitely-not-a-program-xyz'] });
		say(`missing program -> ok=${missing.ok} summary=${missing.summary.slice(0, 160)}`);
	}
}, 900_000);
