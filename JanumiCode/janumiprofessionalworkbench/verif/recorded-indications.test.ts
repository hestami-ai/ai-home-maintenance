// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54's STATIC SOURCE (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6,
// revision 9; roadmap §9b.5b, Z2 records and control 7) — the potential indications the gate reads, from the committed records and
// never from a model: each request's body is the product's (`decisionModelBody`, the records' model, the review's material), and
// its score is the record whose body hash is that body's.
// ⛔ Its refusals, each recorded VALIDATOR_EXECUTION_FAILED with its reason and no reviewer call: a request with no record (never a
// fallback score, never 0.00); a body two records score differently (the records contradict themselves); two files whose
// identities disagree; records whose identity is not the one the product is held to (`DECISION_MODEL_RECORDS_IDENTITY`).
// ⛔ No model: the records here are made by the product's own client against the local stub (`decision-model-stub.testing.ts`).
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DECISION_MODEL_RECORDS_IDENTITY } from '../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { startDecisionModelStub, stubScore, STUB_MODEL } from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import { decisionModelBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	createAgyReasoningReviewValidator,
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { workProductReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { makeRecords, type RecordsEntry } from '../scripts/reviewer-qual/decision-model-records.js';
import { committedRecordsIdentity, readDecisionModelRecords, recordedIndications } from '../scripts/reviewer-qual/recorded-indications.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const DIR = mkdtempSync(join(tmpdir(), 'jpwb-recorded-indications-'));
afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_recorded',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'producer', modelId: 'producer-model', providerId: 'producer-provider' }
};
const answer = (text: string): ReasoningReviewInput =>
	workProductReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, producingPrompt: 'Summarise the log.', answer: text });
const A = answer('{"summary":"The log holds 3 records. Each was read."}');
const B = answer('{"summary":"The log is empty."}');
const UNRECORDED = answer('{"summary":"No record was made of this review."}');

/** ⭐ Records made as D54's are made — the product's own client, the records script's format — against the stub, here. */
async function stubRecords(entries: readonly RecordsEntry[], name: string): Promise<string> {
	const stub = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: DECISION_MODEL_RECORDS_IDENTITY.serverVersion });
	try {
		const file = join(DIR, `${name}.ndjson`);
		const out = await makeRecords({
			server: stub.url,
			model: STUB_MODEL,
			digest: DECISION_MODEL_RECORDS_IDENTITY.digest.slice(0, 12),
			file,
			set: name,
			entries,
			controls: [],
			log: () => undefined,
			bounds: { pollMs: 1 }
		});
		if (out.stopped) throw new Error(out.stopped);
		return file;
	} finally {
		await stub.close();
	}
}
const ENTRIES: readonly RecordsEntry[] = [
	{ kind: 'CASE', id: 'A', input: A },
	{ kind: 'CASE', id: 'B', input: B }
];
const files = { v13: '', probes: '' };

// ⭐⭐ Z2b (the brief's item 3) — THE PRODUCT'S IDENTITY IS THE COMMITTED RECORDS': `DECISION_MODEL_RECORDS_IDENTITY` — the identity the
// client is held to and the pointer hashes — equals the IDENTITY lines of both committed files, read by the static source itself.
// ⚠ Until D54's records are committed this is red, the records absent: it waits for them (package Z2b, phase 2).
describe('⭐ Z2b — the committed records are the ones the product is held to', () => {
	it('⭐ both committed files read, and their identity is `DECISION_MODEL_RECORDS_IDENTITY`', () => {
		expect(committedRecordsIdentity()).toEqual({ ...DECISION_MODEL_RECORDS_IDENTITY });
	});
});

// ⭐⭐ Z2b (the brief's item 2) — THE RE-SCORING READS THE COMMITTED RECORDS (`rescore.ts`), so a case no committed record holds is not
// re-scorable today: its prompt cannot be rebuilt as a run would build it. ⛔ With the placeholder it was re-scored on 0.00 scores.
describe('⭐ Z2b — the re-scoring reads the committed records, never the placeholder', () => {
	it('⛔ a case no committed record holds is not re-scorable: the records’ own refusal, named', async () => {
		// ⛔ No program can be found from this process: the re-scoring loads the runner (`reviewer-qualification-hermetic.ts`).
		const { NO_PROGRAMS } = await import('./reviewer-qualification-hermetic.js');
		vi.stubEnv('PATH', NO_PROGRAMS);
		const { NotRescorable, rescoreEvaluation } = await import('../scripts/reviewer-qual/rescore.js');
		const { CURRENT_CASE_SET_FILE } = await import('../scripts/reviewer-qual/cases.js');
		const c = (JSON.parse(readFileSync(new URL(`../${CURRENT_CASE_SET_FILE}`, import.meta.url), 'utf8')) as { cases: { id: string; input: { producingPrompt: string } }[] }).cases[0]!;
		// ⭑ The current set's first case (a work product's), its producing prompt changed: a material no record holds.
		const input = c.input;
		const unrecorded = { ...c, id: 'Z2B-UNRECORDED', input: { ...input, producingPrompt: `${input.producingPrompt} No record was made of this review.` } };
		const run = { candidate: { transport: 'stub', agentId: 'stub', provider: 'stub', modelLabel: 'stub' } } as never;
		const out = await rescoreEvaluation(run, unrecorded as never, [], 'x').then(
			() => 'rescored',
			(e: unknown) => e
		);
		expect(out).toBeInstanceOf(NotRescorable);
		expect(String((out as Error).message)).toMatch(/the committed decision-model records are absent|the records hold no score for request/);
	});
});
const read = (...paths: string[]) => readDecisionModelRecords(paths.map((p) => ({ name: p, text: readFileSync(p, 'utf8') })));

/** A review through the product's validator with `indications`: its reviewer calls, and the floor's recorded failure. */
async function reviewed(input: ReasoningReviewInput, indications: IndicationsSource) {
	const prompts: string[] = [];
	const registry = createValidatorRegistry();
	registry.register(
		createAgyReasoningReviewValidator({
			print: async (p) => {
				prompts.push(p);
				return JSON.stringify({
					findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'absent' })),
					recommendation: 'SATISFIED'
				});
			},
			modelId: 'jpwb-judge',
			indications
		})
	);
	const plan = await runFloorAndPlanRecording(SUBJECT, { reasoningReview: input }, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return { prompts, failed: review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement) };
}

describe('⭐ Z2b (D54) — the static source answers each request from the records, by its body', () => {
	it('⭐ arrangement: records made by the product’s client against the stub, in the records’ format', async () => {
		files.v13 = await stubRecords(ENTRIES, 'v13');
		files.probes = await stubRecords([{ kind: 'PROBE', id: 'P', input: B }], 'probes');
		expect(readFileSync(files.v13, 'utf8').split('\n')[0]).toContain('"kind":"IDENTITY"');
	});

	it('⭐ every request of a recorded review scored as the record of its body says — the score the client got, exactly', async () => {
		const records = read(files.v13, files.probes);
		expect('refusal' in records ? records.refusal : records.identity).toEqual(DECISION_MODEL_RECORDS_IDENTITY);
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		const source = recordedIndications(records);
		await reviewPrompt(A, async (requests, material) => {
			asked = { requests, material };
			return source(requests, material);
		});
		const result = await source(asked!.requests, asked!.material);
		expect('scores' in result && result.scores).toEqual(
			Object.fromEntries(asked!.requests.map((r) => [r.key, stubScore(decisionModelBody(STUB_MODEL, asked!.material, r))]))
		);
		const { prompts, failed } = await reviewed(A, source);
		expect([prompts.length, failed]).toEqual([1, []]);
	});

	it('⛔ a request no record holds refuses the review, naming it: no fallback score, no reviewer call', async () => {
		const source = recordedIndications(read(files.v13, files.probes));
		const { prompts, failed } = await reviewed(UNRECORDED, source);
		expect(prompts, 'no reviewer call').toEqual([]);
		expect(failed).toHaveLength(1);
		expect(failed[0]).toMatch(/^This review was not sent: its potential indications could not be had from the decision model — the records hold no score for request c00 \(its body [0-9a-f]{12}…\)/);
	});

	it('⛔ two records scoring one body differently refuse every request of that body: the records contradict themselves', async () => {
		const lines = readFileSync(files.v13, 'utf8').trimEnd().split('\n');
		const a = JSON.parse(lines[1]!) as { questions: { score: number }[] };
		a.questions[0]!.score = a.questions[0]!.score === 0.5 ? 0.25 : 0.5;
		const forked = join(DIR, 'forked.ndjson');
		writeFileSync(forked, `${[lines[0], JSON.stringify({ ...a, id: 'A-again' }), ...lines.slice(1)].join('\n')}\n`, 'utf8');
		const { prompts, failed } = await reviewed(A, recordedIndications(read(forked)));
		expect(prompts).toEqual([]);
		expect(failed[0]).toMatch(/the records hold two scores for request c00’s body [0-9a-f]{12}…: they contradict themselves/);
	});

	it('⛔ files whose identities disagree, or records of an identity the product is not held to, are refused, never read', async () => {
		const lines = readFileSync(files.probes, 'utf8').trimEnd().split('\n');
		const head = JSON.parse(lines[0]!) as Record<string, unknown>;
		const other = join(DIR, 'other.ndjson');
		writeFileSync(other, `${[JSON.stringify({ ...head, serverVersion: '0.40.16' }), ...lines.slice(1)].join('\n')}\n`, 'utf8');
		const disagree = read(files.v13, other);
		expect('refusal' in disagree && disagree.refusal).toMatch(/^the records disagree on their identity: .*v13\.ndjson.* 0\.40\.15.*other\.ndjson.* 0\.40\.16/);
		const alone = read(other);
		expect('refusal' in alone && alone.refusal).toMatch(
			/^the records were made on pplx-decider:27b-q4_K_M 733585a9ebb6 on Ollama 0\.40\.16, not the identity the product is held to: pplx-decider:27b-q4_K_M 733585a9ebb6 on Ollama 0\.40\.15 \(D51; REG-F-608\)/
		);
		const { prompts, failed } = await reviewed(A, recordedIndications(alone));
		expect([prompts.length, failed[0]?.includes('not the identity the product is held to')]).toEqual([0, true]);
	});

	it('⛔ no records at all, or a file with no identity line first, is refused with its reason', () => {
		expect(readDecisionModelRecords([])).toEqual({ refusal: 'no decision-model records were found (D54)' });
		const r = readDecisionModelRecords([{ name: 'x.ndjson', text: '{"kind":"CASE","id":"A","questions":[]}\n' }]);
		expect('refusal' in r && r.refusal).toBe('x.ndjson does not begin with its IDENTITY line (D54)');
		// ⭑ And a first line that carries an identity's fields but is no IDENTITY line: its kind is read, not only its fields.
		const { model, digest, serverVersion } = DECISION_MODEL_RECORDS_IDENTITY;
		const posing = readDecisionModelRecords([{ name: 'y.ndjson', text: `${JSON.stringify({ kind: 'CASE', id: 'A', model, digest, serverVersion, questions: [] })}\n` }]);
		expect('refusal' in posing && posing.refusal).toBe('y.ndjson does not begin with its IDENTITY line (D54)');
		expect(sha256('')).toHaveLength(64);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 2 — the lead's ruling 3 (b) on phase 1's departure 1 — THE HISTORY SOURCE
// STAYS TESTS-ONLY. `verif/reviewer-qualification-history.ts` answers a body no record holds with 0, as the placeholder did; the
// product, the gate's check, the re-scoring and the qualification CLI must refuse such a body (D54). The repository's dependency
// rules (`.dependency-cruiser.cjs`) hold the packages' graph and say nothing of `verif/`, and no lint rule names it, so this row is
// what keeps it out: no file outside `verif/` imports it, by any form of import. ⭑ Its control: the same walk finds the six
// `vi.mock` factories and the refusals test, so a walk that read nothing could not pass.
describe('⭐ Z2b phase 2 — the history source (tests only) is imported by no file outside verif/', () => {
	const ROOT = new URL('../', import.meta.url);
	const SKIP = new Set(['node_modules', 'dist', '.svelte-kit', '.turbo', 'coverage', 'test-results', 'build']);
	const SOURCE = /\.(?:ts|js|mjs|cjs|svelte)$/;
	const walk = (dir: string): string[] =>
		readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((e) =>
			e.isDirectory() ? (SKIP.has(e.name) ? [] : walk(`${dir}${e.name}/`)) : SOURCE.test(e.name) ? [`${dir}${e.name}`] : []
		);
	/** Any import of it by a specifier naming the file — a statement at a line’s start (`import … from`, a bare `import`,
	 * `export … from`), or `import(…)` or `require(…)` anywhere: so a mutation's text the ledger holds in a string is no import. */
	const IMPORTS = /^\s*(?:import|export)\b[^;]*?['"][^'"\n]*reviewer-qualification-history(?:\.[jt]s)?['"]|\bimport\s*\(\s*['"`][^'"`\n]*reviewer-qualification-history|\brequire\s*\(\s*['"`][^'"`\n]*reviewer-qualification-history/m;
	const importers = (dirs: readonly string[]): string[] => dirs.flatMap(walk).filter((f) => IMPORTS.test(readFileSync(new URL(f, ROOT), 'utf8')));

	it('⛔ no file of apps/, packages/ or scripts/ imports the history source — and the same walk finds its importers in verif/', () => {
		expect(importers(['apps/', 'packages/', 'scripts/']), 'files outside verif/ that import the history source').toEqual([]);
		const inside = importers(['verif/']);
		expect(inside, 'the control: the walk reaches verif/’s importers').toEqual(
			expect.arrayContaining(['verif/reviewer-qualification-fingerprint.test.ts', 'verif/decision-model-refusals.test.ts'])
		);
		expect(inside.length, 'the six vi.mock factories and the refusals test').toBeGreaterThanOrEqual(7);
	});
});
