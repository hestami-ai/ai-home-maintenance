/**
 * Shared runner for Ollama-backed architecture-phase prompt regression probes.
 *
 * Each probe = a generator call (gemma4:26b with thinking) + a judge call
 * (also gemma4:26b) against the production prompt template + a fixture-derived
 * user-side context. Probes can chain by reading earlier probes' saved outputs
 * from test-output/ollama-probes/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { callOllama, shouldUseJsonFormat, resolveSamplingForModel, type OllamaResponse } from './ollamaClient';
import { judge, buildJudgePrompt, type JudgeRubric, type JudgeVerdict } from './ollamaJudge';
import { buildAgentStdin } from '../../lib/context/contextEngineer';
import { getPolicy } from '../../lib/context/policyRegistry';
import { Role, Phase } from '../../lib/types/index';
import type { HandoffDocument } from '../../lib/context/engineTypes';

const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'ollama', 'intake-handoff.json');
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '..', 'test-output', 'ollama-probes');

export interface IntakeFixture {
	capturedAt: string;
	sourceDbPath: string;
	dialogueId: string;
	goal: string | null;
	dialogue: Record<string, unknown> | null;
	handoffDoc: {
		doc_id: string;
		dialogue_id: string;
		doc_type: string;
		source_phase: string;
		content: Record<string, unknown> | string;
		token_count: number;
		event_watermark: number;
		created_at: string;
	};
	intakeConversation: Record<string, unknown> | null;
}

export interface UpstreamOutputs {
	[probeName: string]: unknown;
}

export interface ProbeConfig {
	/** Short name; used as the output filename. */
	name: string;
	systemPrompt: string;
	/** Builds the user-side prompt body from the fixture and any upstream outputs. */
	buildPrompt: (fixture: IntakeFixture, upstream: UpstreamOutputs) => string;
	/** Throws if the parsed JSON is structurally wrong. */
	validateStructure: (parsed: unknown) => void;
	rubric: JudgeRubric;
	/** Names of prior probes whose `parsed` outputs should be loaded from disk. */
	upstreamProbeNames?: string[];
	/** Override the generator model. */
	generatorModel?: string;
	/** Override the judge model. */
	judgeModel?: string;
	/** Override the Ollama context window (num_ctx) for the generator. */
	generatorNumCtx?: number;
	/** Override the Ollama context window (num_ctx) for the judge. */
	judgeNumCtx?: number;
	/** Override the pass threshold (default 7). */
	passThreshold?: number;
}

export interface ProbeRunResult {
	generated: OllamaResponse;
	verdict: JudgeVerdict;
	outputPath: string;
	prompt: string;
}

export function loadFixture(): IntakeFixture {
	if (!fs.existsSync(FIXTURE_PATH)) {
		throw new Error(
			`Intake fixture missing at ${FIXTURE_PATH}. Run \`node scripts/extractIntakeFixture.js\` first (with JANUMICODE_LIVE_DB set).`
		);
	}
	return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as IntakeFixture;
}

function loadUpstream(names: string[]): UpstreamOutputs {
	const out: UpstreamOutputs = {};
	for (const name of names) {
		const p = path.join(OUTPUT_DIR, `${name}.json`);
		if (!fs.existsSync(p)) {
			throw new Error(`Upstream probe output missing: ${p}. Run probe '${name}' first.`);
		}
		const saved = JSON.parse(fs.readFileSync(p, 'utf8')) as { generated?: { parsed?: unknown } };
		out[name] = saved.generated?.parsed;
	}
	return out;
}

export async function runArchitectureProbe(cfg: ProbeConfig): Promise<ProbeRunResult> {
	const fixture = loadFixture();
	const upstream = loadUpstream(cfg.upstreamProbeNames ?? []);

	const prompt = cfg.buildPrompt(fixture, upstream);
	// Precedence: env var > per-probe config > default. Env vars let you
	// swap models and context size from the command line without editing
	// test files:
	//   OLLAMA_GENERATOR_MODEL=gemma4:26b OLLAMA_JUDGE_MODEL=gemma4:26b \
	//   OLLAMA_GENERATOR_NUM_CTX=64000 OLLAMA_JUDGE_NUM_CTX=32000 \
	//     pnpm test:ollama
	const generatorModel = process.env.OLLAMA_GENERATOR_MODEL ?? cfg.generatorModel ?? 'gemma4:e4b';
	const judgeModel = process.env.OLLAMA_JUDGE_MODEL ?? cfg.judgeModel ?? 'gemma4:e4b';
	const parseCtxEnv = (v: string | undefined): number | undefined => {
		if (!v) return undefined;
		const n = Number(v);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
	};
	const generatorNumCtx = parseCtxEnv(process.env.OLLAMA_GENERATOR_NUM_CTX) ?? cfg.generatorNumCtx;
	const judgeNumCtx = parseCtxEnv(process.env.OLLAMA_JUDGE_NUM_CTX) ?? cfg.judgeNumCtx;

	// Write the exact prompt + system prompt to disk BEFORE calling Ollama,
	// so a hung/OOM/timeout call still leaves the inputs on disk for manual
	// investigation (e.g. retrying the call by hand against the server).
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	const promptDumpPath = path.join(OUTPUT_DIR, `${cfg.name}.prompt.json`);
	fs.writeFileSync(
		promptDumpPath,
		JSON.stringify(
			{
				probeName: cfg.name,
				capturedAt: new Date().toISOString(),
				generatorModel,
				systemPromptLength: cfg.systemPrompt.length,
				userPromptLength: prompt.length,
				systemPrompt: cfg.systemPrompt,
				userPrompt: prompt,
				ollamaRequestBody: {
					model: generatorModel,
					system: cfg.systemPrompt,
					prompt,
					stream: false,
					think: true,
					...(shouldUseJsonFormat(generatorModel, 'json') ? { format: 'json' } : {}),
					options: {
						...resolveSamplingForModel(generatorModel, { model: generatorModel, prompt }),
						...(generatorNumCtx ? { num_ctx: generatorNumCtx } : {}),
					},
				},
			},
			null,
			2
		),
		'utf8'
	);
	// Also write the bare Ollama request body so it can be replayed directly
	// with `curl -d @<file>` without any unwrapping.
	const requestBodyPath = path.join(OUTPUT_DIR, `${cfg.name}.ollama-request.json`);
	fs.writeFileSync(
		requestBodyPath,
		JSON.stringify(
			{
				model: generatorModel,
				system: cfg.systemPrompt,
				prompt,
				stream: false,
				think: true,
				...(shouldUseJsonFormat(generatorModel, 'json') ? { format: 'json' } : {}),
				options: {
					...resolveSamplingForModel(generatorModel, { model: generatorModel, prompt }),
					...(generatorNumCtx ? { num_ctx: generatorNumCtx } : {}),
				},
			},
			null,
			2
		),
		'utf8'
	);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] wrote prompt dump → ${promptDumpPath}`);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] wrote bare ollama request → ${requestBodyPath}`);

	const generatorStartedAt = new Date();
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] generating with ${generatorModel} (prompt ${prompt.length} chars) at ${generatorStartedAt.toISOString()}…`);
	const generated = await callOllama({
		model: generatorModel,
		system: cfg.systemPrompt,
		prompt,
		think: true,
		format: 'json',
		numCtx: generatorNumCtx,
	});
	const generatorEndedAt = new Date();
	const generatorMinutes = (generated.rawDurationMs / 60_000).toFixed(2);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] generator done in ${generated.rawDurationMs}ms (${generatorMinutes} min, ${generated.evalCount ?? '?'} tokens). Parsed: ${generated.parsed ? 'yes' : 'no'}`);

	// Save the raw generator output BEFORE validating, so a structural failure
	// still leaves the artifact on disk for inspection.
	const earlyOutputPath = path.join(OUTPUT_DIR, `${cfg.name}.json`);
	fs.writeFileSync(
		earlyOutputPath,
		JSON.stringify(
			{
				probeName: cfg.name,
				capturedAt: new Date().toISOString(),
				fixtureDialogueId: fixture.dialogueId,
				generatorModel,
				judgeModel,
				timing: {
					generatorStartedAt: generatorStartedAt.toISOString(),
					generatorEndedAt: generatorEndedAt.toISOString(),
					generatorDurationMs: generated.rawDurationMs,
					generatorDurationMinutes: Number(generatorMinutes),
				},
				prompt,
				generated,
				verdict: null,
			},
			null,
			2
		),
		'utf8'
	);

	// Structural validation runs even if parsed is undefined — `validateStructure`
	// is responsible for throwing an informative error.
	cfg.validateStructure(generated.parsed);

	// Dump the judge prompt to disk BEFORE the call so it can be replayed
	// manually if the judge hangs/times out (the judge prompt can be very
	// large because it concatenates the input prompt + answer + thinking).
	const judgePrompt = buildJudgePrompt(
		cfg.rubric,
		prompt,
		generated.response,
		generated.thinking
	);
	const judgePromptDumpPath = path.join(OUTPUT_DIR, `${cfg.name}.judge-prompt.json`);
	fs.writeFileSync(
		judgePromptDumpPath,
		JSON.stringify(
			{
				probeName: cfg.name,
				capturedAt: new Date().toISOString(),
				judgeModel,
				judgeNumCtx: judgeNumCtx ?? null,
				judgePromptLength: judgePrompt.length,
				judgePrompt,
				ollamaRequestBody: {
					model: judgeModel,
					prompt: judgePrompt,
					stream: false,
					think: true,
					...(shouldUseJsonFormat(judgeModel, 'json') ? { format: 'json' } : {}),
					options: {
						// For judges we set lower temperature for stability,
						// but per-model profiles (e.g. qwen) override this.
						...resolveSamplingForModel(judgeModel, { model: judgeModel, prompt: judgePrompt, temperature: 0.2, topP: 0.9, topK: 40 }),
						...(judgeNumCtx ? { num_ctx: judgeNumCtx } : {}),
					},
				},
			},
			null,
			2
		),
		'utf8'
	);
	const judgeRequestBodyPath = path.join(OUTPUT_DIR, `${cfg.name}.judge-ollama-request.json`);
	fs.writeFileSync(
		judgeRequestBodyPath,
		JSON.stringify(
			{
				model: judgeModel,
				prompt: judgePrompt,
				stream: false,
				think: true,
				...(shouldUseJsonFormat(judgeModel, 'json') ? { format: 'json' } : {}),
				options: {
					...resolveSamplingForModel(judgeModel, { model: judgeModel, prompt: judgePrompt, temperature: 0.2, topP: 0.9, topK: 40 }),
					...(judgeNumCtx ? { num_ctx: judgeNumCtx } : {}),
				},
			},
			null,
			2
		),
		'utf8'
	);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] wrote judge prompt dump → ${judgePromptDumpPath}`);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] wrote bare judge ollama request → ${judgeRequestBodyPath} (${judgePrompt.length} chars)`);

	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] judging with ${judgeModel}…`);
	const verdict = await judge(
		cfg.rubric,
		prompt,
		generated.response,
		generated.thinking,
		judgeModel,
		cfg.passThreshold ?? 7,
		judgeNumCtx
	);
	// eslint-disable-next-line no-console
	console.log(`[probe:${cfg.name}] verdict score=${verdict.score} reasoningScore=${verdict.reasoningScore ?? 'n/a'} passed=${verdict.passed}`);
	if (verdict.issues.length > 0) {
		// eslint-disable-next-line no-console
		console.log(`[probe:${cfg.name}] issues:\n  - ${verdict.issues.join('\n  - ')}`);
	}
	if (verdict.rationale) {
		// eslint-disable-next-line no-console
		console.log(`[probe:${cfg.name}] rationale: ${verdict.rationale}`);
	}

	// Re-write with the verdict now populated.
	fs.writeFileSync(
		earlyOutputPath,
		JSON.stringify(
			{
				probeName: cfg.name,
				capturedAt: new Date().toISOString(),
				fixtureDialogueId: fixture.dialogueId,
				generatorModel,
				judgeModel,
				timing: {
					generatorStartedAt: generatorStartedAt.toISOString(),
					generatorEndedAt: generatorEndedAt.toISOString(),
					generatorDurationMs: generated.rawDurationMs,
					generatorDurationMinutes: Number(generatorMinutes),
				},
				prompt,
				generated,
				verdict,
			},
			null,
			2
		),
		'utf8'
	);

	return { generated, verdict, outputPath: earlyOutputPath, prompt };
}

/**
 * Build the EXACT stdin the production Context Engineer would receive at the
 * given role/phase/sub-phase, using the fixture's intake handoff as the only
 * available HandoffDocument. This bypasses `assembleContext`'s LLM call but
 * preserves its policy lookup + agent stdin assembly verbatim, so probes test
 * the same prompt assembly the production code uses.
 */
export function buildContextEngineerStdinFromFixture(
	fixture: IntakeFixture,
	targetRole: Role,
	targetPhase: Phase,
	targetSubPhase?: string,
	extras?: Record<string, unknown>
): string {
	const policy = getPolicy(targetRole, targetPhase, targetSubPhase);
	if (!policy) {
		throw new Error(
			`No context policy found for ${targetRole}:${targetPhase}:${targetSubPhase ?? '*'}. ` +
			`Add one to policyRegistry, or pass a different role/phase combination.`
		);
	}
	const handoffDoc: HandoffDocument = {
		doc_id: fixture.handoffDoc.doc_id,
		dialogue_id: fixture.handoffDoc.dialogue_id,
		doc_type: fixture.handoffDoc.doc_type as HandoffDocument['doc_type'],
		source_phase: fixture.handoffDoc.source_phase,
		content: (typeof fixture.handoffDoc.content === 'string'
			? JSON.parse(fixture.handoffDoc.content)
			: fixture.handoffDoc.content) as HandoffDocument['content'],
		token_count: fixture.handoffDoc.token_count,
		event_watermark: fixture.handoffDoc.event_watermark,
		created_at: fixture.handoffDoc.created_at,
	};
	return buildAgentStdin(policy, [handoffDoc], fixture.dialogueId, extras);
}

/**
 * Build a clean, self-contained briefing for an architecture sub-phase probe.
 *
 * This is the "walk the dog" shape: the prompt the sub-phase prompt template
 * would consume in production, with all required inputs inlined and no
 * tool-use / MCP / DB-query ceremony. Each probe gets the goal, the finalized
 * intake plan, the human decisions, and any upstream sub-phase outputs.
 *
 * Probes test whether the prompt template produces a correct output USING
 * ONLY what is in this brief — no agent tool loops.
 */
export function buildSubPhaseBriefing(args: {
	fixture: IntakeFixture;
	subPhaseName: string;
	taskInstruction: string;
	upstream?: UpstreamOutputs;
	upstreamLabels?: Record<string, string>;
}): string {
	const { fixture, subPhaseName, taskInstruction, upstream = {}, upstreamLabels = {} } = args;

	const content = typeof fixture.handoffDoc.content === 'string'
		? (() => { try { return JSON.parse(fixture.handoffDoc.content as string); } catch { return {}; } })()
		: (fixture.handoffDoc.content as Record<string, unknown>);

	const goal = (content as { goal?: unknown }).goal ?? fixture.goal ?? '(no goal recorded)';
	const finalizedPlan = (content as { finalizedPlan?: unknown }).finalizedPlan ?? null;
	const humanDecisions = (content as { humanDecisions?: unknown }).humanDecisions ?? [];
	const openLoops = (content as { openLoops?: unknown }).openLoops ?? [];

	const sections: string[] = [];

	sections.push(`# Architecture Sub-Phase: ${subPhaseName}`);
	sections.push('');
	sections.push('You are operating in a constrained, self-contained environment. You have NO tool access, NO file system access, NO database, and NO MCP servers. Use ONLY the inputs provided below to produce your response.');
	sections.push('');

	sections.push('## Goal');
	sections.push(typeof goal === 'string' ? goal : JSON.stringify(goal));
	sections.push('');

	sections.push('## Finalized Intake Plan');
	sections.push('```json');
	sections.push(JSON.stringify(finalizedPlan, null, 2));
	sections.push('```');
	sections.push('');

	if (Array.isArray(humanDecisions) && humanDecisions.length > 0) {
		sections.push('## Human Decisions');
		sections.push('```json');
		sections.push(JSON.stringify(humanDecisions, null, 2));
		sections.push('```');
		sections.push('');
	}

	if (Array.isArray(openLoops) && openLoops.length > 0) {
		sections.push('## Open Loops');
		sections.push('```json');
		sections.push(JSON.stringify(openLoops, null, 2));
		sections.push('```');
		sections.push('');
	}

	for (const [name, value] of Object.entries(upstream)) {
		const label = upstreamLabels[name] ?? `Upstream Output: ${name}`;
		sections.push(`## ${label}`);
		sections.push('```json');
		sections.push(JSON.stringify(value ?? null, null, 2));
		sections.push('```');
		sections.push('');
	}

	sections.push('## Your Task');
	sections.push(taskInstruction);
	sections.push('');
	sections.push('Produce the JSON response exactly as your system prompt specifies. Use ONLY the inputs above. Do not invent data not present in the inputs. Do not request tool calls.');

	return sections.join('\n');
}

/**
 * Helper for probes to extract a compact summary of the fixture for prompts.
 * The raw handoff content can be ~290KB which is too slow for gemma4:26b;
 * we extract only the fields the architecture phase actually consumes.
 */
export function summarizeFixtureForPrompt(fixture: IntakeFixture): string {
	const content = typeof fixture.handoffDoc.content === 'string'
		? (() => { try { return JSON.parse(fixture.handoffDoc.content as string); } catch { return {}; } })()
		: (fixture.handoffDoc.content as Record<string, unknown>);

	const trimmed: Record<string, unknown> = {
		goal: (content as { goal?: unknown }).goal ?? fixture.goal,
		finalizedPlan: (content as { finalizedPlan?: unknown }).finalizedPlan,
		humanDecisions: (content as { humanDecisions?: unknown }).humanDecisions,
		openLoops: (content as { openLoops?: unknown }).openLoops,
	};

	return [
		'# Goal',
		fixture.goal ?? '(no goal recorded)',
		'',
		'# Intake Handoff (finalized plan + decisions)',
		'```json',
		JSON.stringify(trimmed, null, 2),
		'```',
	].join('\n');
}
