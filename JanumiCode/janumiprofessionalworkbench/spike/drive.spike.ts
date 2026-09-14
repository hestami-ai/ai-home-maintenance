// SPIKE DRIVER as a vitest file, so the repo's own source-resolution aliases apply.
import { it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';
const LOG = 'spike/transcript.txt';
writeFileSync(LOG, '');
// SPIKE DRIVER (spike/tool-execution). Drives the seam through PRODUCTION code paths on a LIVE model.
//
// ⛔ EVERY CASE GOES THROUGH `runModelInvocationStep`, NOT THROUGH A HAND-ROLLED CALL. A spike that proved its
// own helper would prove nothing about the step.
import { mkdtempSync, statSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { DEFAULT_CONTEXT_ASSEMBLY_POLICY } from '@janumipwb/rph-application';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { runModelInvocationStep } from '../apps/rph-demo/src/lib/server/execution/run-model-step.js';
import { oneShotSession, type ProducerSession } from '../apps/rph-demo/src/lib/server/execution/producer-session.js';
import type { StepBindingRequest } from '../apps/rph-demo/src/lib/server/execution/step-binding.js';
import {
	CAP_FILE_SYSTEM,
	CAP_PROCESS_EXECUTION,
	grantedSandboxTools
} from '../apps/rph-demo/src/lib/server/sandbox/execution-tools.js';
import { createDirectoryWorkspace } from '../apps/rph-demo/src/lib/server/sandbox/workspace-dir.js';
import { createSpawnProcessRunner } from '../apps/rph-demo/src/lib/server/sandbox/process-runner-spawn.js';
import { openPiExecutionSession } from '../apps/rph-demo/src/lib/server/tools/pi-executor.js';


it('SPIKE — drives the tool-execution seam end to end on a live model', async () => {
	const say = (s: string): void => { console.log(s); appendFileSync(LOG, s + String.fromCharCode(10)); };
	const rule = (s: string): void => say('\n' + '='.repeat(100) + '\n' + s + '\n' + '='.repeat(100));

	// ── The work unit under execution ───────────────────────────────────────────────────────────────────────────
	const SUBJECT = {
		id: 'pwu_01SPIKE0000000000000000001',
		title: 'Greeting utility',
		purpose: 'Produce a working greeting script and prove it runs',
		expectedOutputs: ['a file greet.js in the workspace', 'the observed output of running it']
	};

	const TEMPLATE: PromptTemplate = {
		templateText:
			'Work unit: {subject}. Purpose: {purpose}. Required outputs: {expectedOutputs}.\n' +
			'Using the tools available to you, create a Node.js file named greet.js in the workspace whose only ' +
			'behaviour is to print exactly the line SPIKE-GREETING-OK, then run it with node and observe what it ' +
			'prints. Report the exit code and the observed stdout.',
		templateVersion: 1,
		declaredPlaceholders: ['subject', 'purpose', 'expectedOutputs'],
		status: 'ACTIVE'
	};

	/** The binding a TOOL-BEARING step needs. ⚠ `network` because it invokes a model; the other two are the tools. */
	const SANDBOX_REQUEST: StepBindingRequest = {
		runtimeBindingId: 'bind_spike_1',
		executionStepId: 'step_spike_1',
		roleId: 'MODEL',
		requestedCapabilities: [
			{ capability: 'network' },
			{ capability: CAP_FILE_SYSTEM },
			{ capability: CAP_PROCESS_EXECUTION }
		]
	};

	function harness(session: ProducerSession, granted: readonly string[]) {
		const dispatched: RecordModelExchangePayload[] = [];
		let n = 0;
		return {
			dispatched,
			input: {
				subject: SUBJECT,
				subjectSemanticVersion: 1,
				pwuTypeId: 'pwut_spike',
				template: TEMPLATE,
				session,
				store: createInMemoryArtifactStore(),
				tenantPrefix: 'tnt-spike',
				dispatchExchange: (p: RecordModelExchangePayload) => {
					dispatched.push(p);
					return { status: 'ACCEPTED' };
				},
				newId: (prefix: string) => `${prefix}_${++n}`,
				now: () => new Date().toISOString(),
				modelId: process.env.JPWB_EXECUTOR_MODEL ?? 'unresolved',
				providerId: 'pi',
				contextPolicy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
				binding: { kind: 'BOUND' as const, request: SANDBOX_REQUEST, granted }
			}
		};
	}

	// ⭑ ONE WORKSPACE FOR THE WHOLE UNDERTAKING — the lifecycle question the spike was sent to answer, made
	// concrete: the directory is created ONCE here and handed to every step below.
	const undertakingDir = mkdtempSync(join(tmpdir(), 'jpwb-undertaking-'));
	const workspace = createDirectoryWorkspace('UNDERTAKING', 'und_spike_1', undertakingDir);
	const runner = createSpawnProcessRunner();
	say(`UNDERTAKING WORKSPACE = ${workspace.directoryPath}`);
	say(`WORKSPACE materialization = ${workspace.materialization}, ownerKind = ${workspace.ownerKind}`);
	say(`RUNNER kind = ${runner.kind}`);

	const stat = (rel: string): string => {
		const abs = join(undertakingDir, rel);
		if (!existsSync(abs)) return `  ABSENT: ${abs}`;
		const st = statSync(abs);
		return `  PRESENT: ${abs}\n    size=${st.size} bytes  mtime=${st.mtime.toISOString()}\n    bytes=${JSON.stringify(readFileSync(abs, 'utf8'))}`;
	};

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	// CASE B FIRST — REFUSAL. Run before anything writes, so a file found later cannot be this case's.
	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('CASE B — a step WITHOUT the capability. Granted: ["network"] only.');
	{
		let modelCalls = 0;
		// ⛔ A SESSION THAT COUNTS. If the refusal fails to fire, this proves a model was actually reached.
		const counting = oneShotSession(async () => {
			modelCalls += 1;
			return '{"workProduct":"UNREACHABLE","rationale":{"rationale":"x"}}';
		});
		const { input, dispatched } = harness(counting, ['network']);
		const out = await runModelInvocationStep(input);
		say(`ran = ${out.ran}`);
		if (!out.ran) {
			say('VERBATIM REFUSAL:');
			say('---8<---');
			say(out.refusedBecause);
			say('--->8---');
		}
		say(`model calls made = ${modelCalls}  (must be 0)`);
		say(`exchange records written = ${dispatched.length}  (must be 0 — refused before anything was built)`);
		const grant = grantedSandboxTools({ granted: ['network'], workspace, runner, commandTimeoutMs: 20000 });
		say(`tools that WOULD have been minted: ${JSON.stringify(grant.tools.map((t) => t.name))}`);
		for (const w of grant.withheld) say(`WITHHELD ${w.tool}: ${w.because}`);
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	// CASE C — PRECISION. file-system granted, process-execution NOT. One tool must appear and one must not.
	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('CASE C — PRECISION. Granted: ["network","file-system"]. run_command must NOT exist.');
	{
		const granted = ['network', CAP_FILE_SYSTEM];
		const grant = grantedSandboxTools({ granted, workspace, runner, commandTimeoutMs: 20000 });
		say(`minted tools = ${JSON.stringify(grant.tools.map((t) => t.name))}`);
		for (const w of grant.withheld) say(`WITHHELD ${w.tool}: ${w.because}`);
		const session = await openPiExecutionSession({ tools: grant.tools });
		const { input } = harness(session, granted);
		const out = await runModelInvocationStep(input);
		say(`ran = ${out.ran}`);
		if (!out.ran) say(`refusedBecause = ${out.refusedBecause}`);
		const calls = session.toolCalls?.() ?? [];
		say(`TOOL CALLS OBSERVED (${calls.length}):`);
		for (const c of calls) say(`  ${c.tool} ok=${c.ok} args=${JSON.stringify(c.args).slice(0, 200)}`);
		say(`run_command calls = ${calls.filter((c) => c.tool === 'run_command').length}  (must be 0)`);
		if (out.ran) say(`ANSWER (work product) = ${out.answer.slice(0, 600)}`);
		say('FILE CHECK precision.txt:');
		say(stat('precision.txt'));
		session.dispose();
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	// CASE A — ADMITTED. The full grant. A file must exist on disk and a command must really have run.
	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('CASE A — ADMITTED. Granted: ["network","file-system","process-execution"].');
	let caseAWorked = false;
	{
		const granted = ['network', CAP_FILE_SYSTEM, CAP_PROCESS_EXECUTION];
		const grant = grantedSandboxTools({ granted, workspace, runner, commandTimeoutMs: 30000 });
		say(`minted tools = ${JSON.stringify(grant.tools.map((t) => t.name))}`);
		say(`withheld = ${JSON.stringify(grant.withheld)}`);
		const session = await openPiExecutionSession({ tools: grant.tools });
		const { input, dispatched } = harness(session, granted);
		const out = await runModelInvocationStep(input);
		say(`ran = ${out.ran}`);
		if (!out.ran) say(`refusedBecause = ${out.refusedBecause}`);
		else {
			say(`producer = ${JSON.stringify(out.producer)}  identityEvidence = ${out.identityEvidence}`);
			say(`ANSWER (work product) = ${out.answer.slice(0, 800)}`);
			say(`rationale declared = ${out.rationale ? 'YES' : 'NO'}  shortfall = ${out.rationaleShortfall ?? '(none)'}`);
		}
		say(`exchange records written = ${dispatched.length}`);
		const calls = session.toolCalls?.() ?? [];
		say(`\nTOOL CALLS OBSERVED BY THE ADAPTER (${calls.length}) — not the model's report of them:`);
		for (const c of calls) {
			say(`  ---- ${c.tool}  ok=${c.ok}`);
			say(`       args = ${JSON.stringify(c.args)}`);
			say(`       data = ${JSON.stringify(c.data)}`);
		}
		say('\nFILESYSTEM EVIDENCE — greet.js, stat()ed after the session closed:');
		say(stat('greet.js'));
		say('\nWORKSPACE LISTING:');
		for (const e of await workspace.list()) say(`  ${e.path}  ${e.byteSize} bytes`);
		caseAWorked = calls.some((c) => c.tool === 'run_command' && c.ok);
		session.dispose();
	}

	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	// CASE D — LIFECYCLE. A SECOND step, a NEW session, the SAME undertaking workspace.
	// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
	rule('CASE D — can a LATER step see what an EARLIER one wrote? Same workspace, new session.');
	{
		const granted = ['network', CAP_FILE_SYSTEM, CAP_PROCESS_EXECUTION];
		const grant = grantedSandboxTools({ granted, workspace, runner, commandTimeoutMs: 30000 });
		const session = await openPiExecutionSession({ tools: grant.tools });
		const second: PromptTemplate = {
			templateText:
				'Work unit: {subject}. A previous work unit left files in this workspace. Run the command ' +
				'`node greet.js` and report the exact stdout and exit code you observe. Do not create greet.js ' +
				'yourself; if it is not there, say so.',
			templateVersion: 1,
			declaredPlaceholders: ['subject'],
			status: 'ACTIVE'
		};
		const h = harness(session, granted);
		const out = await runModelInvocationStep({ ...h.input, template: second });
		say(`ran = ${out.ran}`);
		const calls = session.toolCalls?.() ?? [];
		say(`TOOL CALLS (${calls.length}):`);
		for (const c of calls) say(`  ${c.tool} ok=${c.ok} args=${JSON.stringify(c.args)}\n     data=${JSON.stringify(c.data)}`);
		if (out.ran) say(`ANSWER = ${out.answer.slice(0, 600)}`);
		session.dispose();
	}

	rule(`SUMMARY — case A produced a real command run: ${caseAWorked}`);
	say(`workspace retained at ${undertakingDir}`);

}, 900_000);
