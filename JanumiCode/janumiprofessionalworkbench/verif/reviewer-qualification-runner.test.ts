// ⭐ `JAN-CRITREAD` J2-2 — THE REVIEWER-QUALIFICATION RUNNER (DESIGN-what-the-tests-prove.md §5.3, §5.4; ROADMAP J2-2).
//
// The runner drives the REAL reasoning-review validator with a transport at its `print` seam and scores through
// `composeAssuranceOutcome` over the Reasoning Review reference alone. Every limb here uses a STUB transport — no
// model is called — and asks what the record says about what the transport returned:
//
//   · A STUB RUN'S LINES VALIDATE, and score to each oracle through the product's own path — and a tracked record
//     still refuses the stub, because it is a harness identity.
//   · RETENTION — of `splitAnswerSpan(raw).answer`, only a span that parses as one JSON value enters a line, and only
//     what the product reads of it; the reasoning around or inside it, in keys the product ignores, and a tool's
//     volunteered reasoning, never do. And every retention form re-scores to the outcome recorded at run time, with the
//     recorded evaluator fed back.
//   · A TRANSPORT THROW is a transport-failure class, not re-scorable, scored exactly as the product's floor runner
//     scores a validator that throws. Anything else thrown by a transport is the HARNESS's fault and stops the run.
//   · THE OVERRIDES (`REG-D-072` D12; `REG-F-441`) — the runner refuses when `JPWB_AGY_BIN` or `JPWB_DEVIN_BIN` is set,
//     before the transport is asked anything.
//   · `REG-F-428`'s CLASSES are detected harness-side over the raw reply, so "judged wrong" and "the product
//     discarded what it said" stay distinguishable (§5.1 (1)).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runDeMinimisFloor,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA
} from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import { splitAnswerSpan } from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { createAgyReasoningReviewValidator } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import type { ToolInvocationResult } from '../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import {
	CASE_PRODUCER_MODEL_ID,
	CASE_PRODUCER_PROVIDER_ID,
	CASE_SET_V1_FILE,
	ORACLES_V1_FILE,
	type CaseSet,
	type OracleSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import { detectMalformations } from '../scripts/reviewer-qual/malformations.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import {
	recordProblems,
	retainedAnswer,
	serializeLine,
	type CallLine,
	type CandidateIdentity,
	type RunLine
} from '../scripts/reviewer-qual/record.js';
import {
	evaluateCase,
	replayReplies,
	runQualification,
	type RunFingerprint,
	type RunInputs
} from '../scripts/reviewer-qual/runner.js';
import {
	TransportFailure,
	type Transport,
	type TransportReply
} from '../scripts/reviewer-qual/transports.js';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (file: string): string => readFileSync(`${REPO_ROOT}${file}`, 'utf8');
const CASES = (JSON.parse(read(CASE_SET_V1_FILE)) as CaseSet).cases;
const ORACLES = new Map(
	(JSON.parse(read(ORACLES_V1_FILE)) as OracleSet).oracles.map((o) => [o.caseId, o])
);
const CRITERIA = SEEDED_REASONING_REVIEW_CRITERIA;
const caseById = (id: string): QualificationCase => CASES.find((c) => c.id === id)!;
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

const FINGERPRINT: RunFingerprint = {
	reviewer: 'a'.repeat(64),
	scoring: 'b'.repeat(64),
	caseSet: 'c'.repeat(64)
};
const STUB: CandidateIdentity = {
	transport: 'stub',
	agentId: 'stub',
	provider: 'jpwb-stub',
	modelLabel: 'stub-reviewer',
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};

interface StubTransport extends Transport {
	readonly prompts: string[];
	identified: number;
}
function stubTransport(
	reply: (prompt: string) => TransportReply | Promise<TransportReply>
): StubTransport {
	const t: StubTransport = {
		name: 'stub',
		prompts: [],
		identified: 0,
		identify: async () => {
			t.identified += 1;
			return STUB;
		},
		call: async (prompt) => {
			t.prompts.push(prompt);
			return reply(prompt);
		}
	};
	return t;
}
const answer = (returned: string | ToolInvocationResult): TransportReply => ({
	returned,
	served: null
});
/** A monotonic clock that advances 5 ms per read, so elapsed times are stable. */
const ticking = () => {
	let t = 0;
	return () => (t += 5);
};
const inputs = (over: Partial<RunInputs> & Pick<RunInputs, 'transport' | 'cases'>): RunInputs => ({
	runId: 'qr-test-1',
	date: '2026-09-24T12:00:00.000Z',
	commit: 'e5f9358b'.repeat(5),
	fingerprint: FINGERPRINT,
	caseSetVersion: 1,
	oracleVersion: 1,
	criteria: CRITERIA,
	repetitions: 1,
	env: {},
	now: ticking(),
	...over
});

/** A judgement faulting exactly `faulted`, as a reviewer would write it. */
const judgement = (
	faulted: readonly string[],
	recommendation = faulted.length ? 'REJECTED' : 'SATISFIED'
): string =>
	JSON.stringify({
		findings: CRITERIA.map((k) => ({
			criterionId: k.id,
			failed: faulted.includes(k.id),
			statement: faulted.includes(k.id) ? 'present, as planted' : 'absent',
			severity: faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
		})),
		recommendation
	});

/** The prompt the REAL validator sends first for each case — so a stub can answer each case as its oracle expects. */
async function initialPrompts(): Promise<Map<string, string>> {
	const byPrompt = new Map<string, string>();
	for (const c of CASES) {
		let sent = '';
		const v = createAgyReasoningReviewValidator({
			agentId: 'x',
			modelId: 'x',
			providerId: 'x',
			print: async (p) => {
				sent = p;
				return judgement([]);
			}
		});
		await v.evaluate(c.subject, { reasoningReview: caseReviewInput(c, CRITERIA) });
		byPrompt.set(sent, c.id);
	}
	return byPrompt;
}

describe('JAN-CRITREAD J2-2 — the runner, over a stub transport', () => {
	it('⭐ a run over a stub transport produces RUN + CALL lines that validate, each scored to its oracle through the product’s path', async () => {
		const byPrompt = await initialPrompts();
		expect(byPrompt.size, 'every case sends a distinct prompt').toBe(26);
		const stub = stubTransport((prompt) =>
			answer(judgement(ORACLES.get(byPrompt.get(prompt)!)!.faulted))
		);
		const lines = await runQualification(inputs({ transport: stub, cases: CASES, repetitions: 2 }));
		const record = lines.map(serializeLine).join('');
		expect(recordProblems(record, { tracked: false }), 'the stub run’s lines validate').toEqual([]);

		const [run, ...calls] = lines as [RunLine, ...CallLine[]];
		expect(run).toMatchObject({
			kind: 'RUN',
			runId: 'qr-test-1',
			reviewerFingerprint: FINGERPRINT.reviewer,
			scoringDigest: FINGERPRINT.scoring,
			caseSetDigest: FINGERPRINT.caseSet,
			caseIds: CASES.map((c) => c.id),
			repetitions: 2,
			candidate: STUB,
			deployable: false
		});
		expect(calls.map((c) => `${c.caseId}#${c.repetition}`)).toEqual(
			[1, 2].flatMap((rep) => CASES.map((c) => `${c.id}#${rep}`))
		);
		for (const call of calls) {
			const oracle = ORACLES.get(call.caseId)!;
			expect(call.scored?.disposition, `${call.caseId}#${call.repetition}`).toBe(
				oracle.disposition
			);
			expect(call.scored?.independenceOk, call.caseId).toBe(true);
			expect(
				call.scored?.criteria.filter(([, o]) => o === 'NOT_MET').map(([k]) => k),
				call.caseId
			).toEqual(oracle.faulted);
			expect(call.malformations, call.caseId).toEqual([]);
			expect(call.evaluator).toEqual({
				agentId: 'stub',
				modelId: 'stub-reviewer',
				providerId: 'jpwb-stub',
				identityEvidence: 'HOST_CONFIGURED'
			});
		}
		expect(stub.identified).toBe(1);
		// ⛔ And it is still a HARNESS identity: a tracked record refuses it (§5.3).
		expect(recordProblems(record, { tracked: true }).join('\n')).toContain(
			'carries a harness identity (transport "stub")'
		);
	});

	it('⛔ RETENTION — only splitAnswerSpan(raw).answer enters a line; the reasoning around it never does, and the span re-scores alone', async () => {
		const CANARY = 'CANARY-REASONING-7f3a';
		const clean = judgement([]);
		const raw = `${CANARY}: first I read the graph…\n\`\`\`json\n${clean}\n\`\`\`\nOne more thought (${CANARY}).`;
		const tool: ToolInvocationResult = {
			answer: { arrived: true, text: raw },
			volunteeredReasoning: `${CANARY} — the tool's own reasoning channel`,
			rawOutput: `${CANARY} ${raw}`,
			producer: { agentId: 'devin', modelId: 'glm-5-2', providerId: 'devin' },
			identityEvidence: 'PROVIDER_REPORTED',
			observedToolCalls: { canObserve: false, reason: 'a stub observes nothing' }
		};
		for (const returned of [raw, tool]) {
			const lines = await runQualification(
				inputs({
					transport: stubTransport(() => answer(returned)),
					cases: [caseById('G-CLEAN'), caseById('W-CLEAN')]
				})
			);
			const record = lines.map(serializeLine).join('');
			expect(
				record.includes(CANARY),
				'no reasoning, inline or volunteered, reaches the record'
			).toBe(false);
			const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
			for (const call of calls) {
				// The span here is already the retained form (only keys the product reads, written canonically), so it
				// is kept byte for byte — beside the hash of the span as it came back.
				expect(call.reply).toEqual({
					status: 'ANSWERED',
					answer: splitAnswerSpan(raw).answer,
					spanSha256: sha256(splitAnswerSpan(raw).answer)
				});
				expect(call.malformations).toEqual(['FENCED', 'PROSE_WRAPPED']);
				expect(call.scored?.disposition).toBe('SATISFIED');
				// ⭐ THE SPAN IS ENOUGH: replayed through the same path, it scores to what was recorded at run time.
				const replayed = await evaluateCase({
					case: caseById(call.caseId),
					criteria: CRITERIA,
					candidate: STUB,
					call: replayReplies([call]),
					scoringDigest: FINGERPRINT.scoring,
					now: ticking()
				});
				expect(replayed.scored).toEqual(call.scored);
			}
			if (typeof returned !== 'string')
				expect(calls[0]!.evaluator, 'the tool’s REPORTED identity, graded as reported').toEqual({
					agentId: 'devin',
					modelId: 'glm-5-2',
					providerId: 'devin',
					identityEvidence: 'PROVIDER_REPORTED'
				});
		}
	});

	it('⛔ RETENTION — no text outside JSON syntax, and no key the product does not read, ever enters a line; and every retention form re-scores to its run-time outcome', async () => {
		const clean = judgement([]);
		const measuredDuplicate = clean.replace(
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,',
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,"failed":"No delegated professional obligation is omitted…",'
		);
		expect(measuredDuplicate).not.toBe(clean);
		// Reasoning INSIDE the object, in keys the product never reads — top level, in a finding, and inside a value the
		// product reads only as a type (`failed` is read through Boolean(), so an object there is `true`, whatever it says).
		const withReasoningKeys = JSON.stringify({
			reasoning: 'CANARY-C3d: my chain of thought, in a key of its own',
			findings: CRITERIA.map((k, i) => ({
				criterionId: k.id,
				failed: i === 1 ? { why: 'CANARY-C3e: I weighed RR-02 at length' } : false,
				statement: 'absent',
				severity: 'INFORMATIONAL',
				thinking: 'CANARY-C3f'
			})),
			recommendation: 'SATISFIED',
			residualUncertainty: ['none']
		});
		/** Each arrangement: what the stub returns on call 1, 2, … (the last repeats), the retention forms, the outcome. */
		const rows: readonly {
			readonly name: string;
			readonly replies: readonly string[];
			readonly statuses: readonly string[];
			readonly disposition: string;
		}[] = [
			{
				name: 'canary 1 — reasoning in braces before the answer',
				replies: [
					`Let me think {CANARY-C3 reasoning about RR-04 and the graph}. Conclusion:\n${clean}`
				],
				statuses: ['NOT_RETAINED', 'NOT_RETAINED'],
				disposition: 'VALIDATOR_FAILED'
			},
			{
				name: 'canary 2 — a braced P.S. after the answer',
				replies: [`${clean}\n\nP.S. {CANARY-C3b: I was unsure about RR-02}`],
				statuses: ['NOT_RETAINED', 'NOT_RETAINED'],
				disposition: 'VALIDATOR_FAILED'
			},
			{
				name: 'canary 3 — a thinking loop with stray braces',
				replies: [
					`${"CANARY-C3c This is perplexing. {x} Let's check the original prompt again. ".repeat(3)}}`
				],
				statuses: ['NOT_RETAINED', 'NOT_RETAINED'],
				disposition: 'VALIDATOR_FAILED'
			},
			{ name: 'a clean reply', replies: [clean], statuses: ['ANSWERED'], disposition: 'SATISFIED' },
			{
				name: 'the measured duplicate key',
				replies: [measuredDuplicate],
				statuses: ['ANSWERED'],
				disposition: 'BOUNDARY_REJECTED'
			},
			{
				name: 'the repair path — a canary, then a clean reply',
				replies: [`Let me think {CANARY-C3 about RR-04}. Conclusion:\n${clean}`, clean],
				statuses: ['NOT_RETAINED', 'ANSWERED'],
				disposition: 'SATISFIED'
			},
			{
				name: '2(c) — reasoning in keys the product does not read',
				replies: [withReasoningKeys],
				statuses: ['ANSWERED'],
				disposition: 'BOUNDARY_REJECTED'
			}
		];
		for (const row of rows) {
			let n = 0;
			const lines = await runQualification(
				inputs({
					transport: stubTransport(() =>
						answer(row.replies[Math.min(n++, row.replies.length - 1)]!)
					),
					cases: [caseById('G-CLEAN')]
				})
			);
			const record = lines.map(serializeLine).join('');
			expect(record.includes('CANARY'), `${row.name}: no reasoning reaches the record`).toBe(false);
			expect(recordProblems(record, { tracked: false }), `${row.name}: the lines validate`).toEqual(
				[]
			);
			const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
			expect(
				calls.map((c) => c.reply.status),
				`${row.name}: what was retained`
			).toEqual(row.statuses);
			expect(calls.at(-1)!.scored?.disposition, row.name).toBe(row.disposition);
			// ⭐ EVERY RETENTION FORM RE-SCORES: replayed through the same path, the record scores what the run scored.
			const replayed = await evaluateCase({
				case: caseById('G-CLEAN'),
				criteria: CRITERIA,
				candidate: STUB,
				call: replayReplies(calls),
				scoringDigest: FINGERPRINT.scoring,
				now: ticking()
			});
			expect(replayed.scored, `${row.name}: the replay scores what the run scored`).toEqual(
				calls.at(-1)!.scored
			);
			expect(
				replayed.calls.map((c) => c.reply.status),
				`${row.name}: the replay retains the same forms`
			).toEqual(row.statuses.map((s) => (s === 'NOT_RETAINED' ? 'NO_ANSWER_SPAN' : s)));
		}
		// What the unread keys left behind: the class that says so, and the span's hash — never its text.
		const lines = await runQualification(
			inputs({
				transport: stubTransport(() => answer(withReasoningKeys)),
				cases: [caseById('G-CLEAN')]
			})
		);
		const call = lines[1] as CallLine;
		expect(call.malformations).toContain('UNREAD_KEY');
		expect(call.reply).toMatchObject({ status: 'ANSWERED', spanSha256: sha256(withReasoningKeys) });
		expect(
			call.scored?.criteria.find(([k]) => k === CRITERIA[1]!.id)?.[1],
			'an object where `failed` is read is a fault, as the product reads it'
		).toBe('NOT_MET');
	});

	it('⭐ THE RETAINED FORM IS READ AS THE SPAN WAS — the whole ValidatorResult, statements and residual uncertainty included, for every shape a value can take', async () => {
		const fence = String.fromCodePoint(96).repeat(3);
		const [k0, k1, k2, ...rest] = CRITERIA.map((k) => k.id);
		const rich = {
			reasoning: 'a key the product never reads',
			findings: [
				// 424242 becomes 1e400 below: JSON parses it to Infinity, which JSON cannot write back.
				{
					criterionId: k0,
					failed: 424242,
					statement: `see ${fence}x${fence}`,
					severity: 'MATERIAL',
					note: { a: 1 }
				},
				{
					criterionId: k1,
					failed: { why: 'an object is read as true' },
					statement: ['not', 'a string'],
					severity: { s: 1 }
				},
				{
					criterionId: k2,
					failed: 'No, it is fine',
					statement: 'a string `failed`',
					severity: 'BOGUS'
				},
				'a string where a finding should be',
				[1, 2],
				null,
				{ criterionId: ['RR'], failed: true },
				{ criterionId: 'UNDECLARED-ID', failed: true, statement: 'dropped by the product' },
				...rest.map((id) => ({ criterionId: id, failed: false, statement: 'absent' }))
			],
			recommendation: 'CONDITIONALLY_SATISFIED',
			residualUncertainty: ['kept', 5, { x: 'dropped' }, ['y']]
		};
		// ⚠ The raw text escapes its backticks, as a model's JSON may: with a literal fence in it, splitAnswerSpan would
		// window into the fence and no span would be located at all.
		const raw = JSON.stringify(rich).replaceAll('`', `${'\\'}u0060`).replace('424242', '1e400');
		expect(splitAnswerSpan(raw)).toMatchObject({ located: true, answer: raw });
		const kept = retainedAnswer(JSON.parse(raw) as Record<string, unknown>);
		expect(kept.includes(fence.slice(0, 1)), 'no backtick survives into the retained form').toBe(
			false
		);
		expect(kept.includes('never reads'), 'no unread key').toBe(false);
		const c = caseById('G-CLEAN');
		const read = (text: string) =>
			createAgyReasoningReviewValidator({
				agentId: 'x',
				modelId: 'x',
				providerId: 'x',
				clock: () => '1970-01-01T00:00:00.000Z',
				print: async () => text
			}).evaluate(c.subject, { reasoningReview: caseReviewInput(c, CRITERIA) });
		expect(await read(kept), 'the product reads the retained form as it read the span').toEqual(
			await read(raw)
		);
	});

	it('⛔ RE-SCORING FEEDS BACK THE RECORDED EVALUATOR — a tool-reported identity that fails independence at run time fails it on replay too', async () => {
		// The verifier's probe E4: the tool REPORTS the case's own producer as the model that answered.
		const reportedAsProducer = (text: string): ToolInvocationResult => ({
			answer: { arrived: true, text },
			rawOutput: text,
			producer: {
				agentId: 'devin',
				modelId: CASE_PRODUCER_MODEL_ID,
				providerId: CASE_PRODUCER_PROVIDER_ID
			},
			identityEvidence: 'PROVIDER_REPORTED',
			observedToolCalls: { canObserve: false, reason: 'a stub observes nothing' }
		});
		const REPORTED = {
			agentId: 'devin',
			modelId: CASE_PRODUCER_MODEL_ID,
			providerId: CASE_PRODUCER_PROVIDER_ID,
			identityEvidence: 'PROVIDER_REPORTED'
		};
		// (1) One call, reported. (2) The report arrives on the initial call and the repair is a bare string: the
		// validator KEEPS the reported identity and its grade, so the record must say so too.
		let n = 0;
		for (const [label, reply] of [
			['reported on the one call', () => answer(reportedAsProducer(judgement([])))],
			[
				'reported on the initial call, a bare string on the repair',
				() => answer((n += 1) === 1 ? reportedAsProducer('I could not decide.') : judgement([]))
			]
		] as const) {
			const lines = await runQualification(
				inputs({ transport: stubTransport(reply), cases: [caseById('G-CLEAN')] })
			);
			const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
			const last = calls.at(-1)!;
			for (const call of calls)
				expect(call.evaluator, `${label}: as the validator graded it`).toEqual(REPORTED);
			expect(last.scored, label).toMatchObject({
				disposition: 'BOUNDARY_REJECTED',
				independenceOk: false
			});
			const replayed = await evaluateCase({
				case: caseById('G-CLEAN'),
				criteria: CRITERIA,
				candidate: STUB,
				call: replayReplies(calls),
				scoringDigest: FINGERPRINT.scoring,
				now: ticking()
			});
			expect(replayed.scored, `${label}: the replay scores what the run scored`).toEqual(
				last.scored
			);
			expect(replayed.evaluator, `${label}: with the evaluator the run recorded`).toEqual(REPORTED);
		}
	});

	it('⭐ a first reply with no answer span is repaired — two calls, the outcome on the second; a bare JSON scalar is accepted as the product accepts it', async () => {
		let n = 0;
		const repaired = await runQualification(
			inputs({
				transport: stubTransport(() =>
					answer((n += 1) === 1 ? 'I could not decide.' : judgement([]))
				),
				cases: [caseById('G-CLEAN')]
			})
		);
		const [, initial, repair] = repaired as [RunLine, CallLine, CallLine];
		expect(initial).toMatchObject({
			role: 'initial',
			reply: { status: 'NO_ANSWER_SPAN', parses: false },
			scored: null
		});
		expect(initial.malformations).toEqual(['NO_ANSWER_SPAN']);
		expect(repair).toMatchObject({
			role: 'repair',
			reply: { status: 'ANSWERED' },
			scored: { disposition: 'SATISFIED' }
		});
		expect(repair.promptSha256).not.toBe(initial.promptSha256);
		expect(recordProblems(repaired.map(serializeLine).join(''), { tracked: false })).toEqual([]);

		// `null` parses, so the validator takes it as a judgement with no findings and never repairs — every criterion
		// unjudged. Nothing of the reply is retained, and the replay reproduces the outcome from `parses` alone.
		const scalar = await runQualification(
			inputs({ transport: stubTransport(() => answer('null')), cases: [caseById('G-CLEAN')] })
		);
		const only = scalar[1] as CallLine;
		expect(scalar).toHaveLength(2);
		expect(only.reply).toEqual({ status: 'NO_ANSWER_SPAN', parses: true });
		expect(only.scored?.disposition).toBe('INCONCLUSIVE');
		expect(new Set(only.scored?.criteria.map(([, o]) => o))).toEqual(
			new Set(['UNABLE_TO_DETERMINE'])
		);
		const replayed = await evaluateCase({
			case: caseById('G-CLEAN'),
			criteria: CRITERIA,
			candidate: STUB,
			call: replayReplies([only]),
			scoringDigest: FINGERPRINT.scoring,
			now: ticking()
		});
		expect(replayed.scored).toEqual(only.scored);
	});

	it('⛔ A TRANSPORT THROW is a transport-failure class, not re-scorable, scored as the product’s floor runner scores a throwing validator', async () => {
		for (const failureClass of ['TIMEOUT', 'REFUSAL'] as const) {
			const stub = stubTransport(() => {
				throw new TransportFailure(
					failureClass,
					failureClass === 'TIMEOUT' ? 'cut at 240000 ms' : 'exit 1'
				);
			});
			const lines = await runQualification(
				inputs({ transport: stub, cases: [caseById('W-RR-04')] })
			);
			expect(recordProblems(lines.map(serializeLine).join(''), { tracked: false })).toEqual([]);
			expect(lines).toHaveLength(2);
			const call = lines[1] as CallLine;
			expect(call.reply).toEqual({
				status: 'TRANSPORT_FAILURE',
				failureClass,
				reason: failureClass === 'TIMEOUT' ? 'cut at 240000 ms' : 'exit 1',
				rescorable: false,
				preContact: false
			});
			expect(() => replayReplies([call])).toThrow('not re-scorable');

			// ⭐ THE CONTROL — the product's own floor runner, over the same validator failing the same way.
			const c = caseById('W-RR-04');
			const registry = createValidatorRegistry();
			registry.register(
				createAgyReasoningReviewValidator({
					agentId: 'stub',
					modelId: 'stub-reviewer',
					providerId: 'jpwb-stub',
					print: () => Promise.reject(new Error('the transport failed'))
				})
			);
			const ctx = { reasoningReview: caseReviewInput(c, CRITERIA) };
			const floor = await runDeMinimisFloor(c.subject, ctx, registry);
			const rr = floor.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
			const recorded = (await runFloorAndPlanRecording(c.subject, ctx, registry)).assessments.find(
				(a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW
			)!;
			expect(call.scored).toEqual({
				scoringDigest: FINGERPRINT.scoring,
				disposition: rr.disposition,
				resultClass: rr.resultClass,
				independenceOk: rr.independenceOk,
				criteria: recorded.criteria.map((k) => [k.criterionId, k.outcome])
			});
			expect(call.scored?.disposition).toBe('VALIDATOR_FAILED');
		}
	});

	it('⛔ anything else a transport throws is the HARNESS’s fault — the run stops rather than record it against the candidate', async () => {
		// On the first call, and — the case only the side channel can see, because the validator has already made one
		// call — on the REPAIR: scored there, the harness's fault would read as the candidate's VALIDATOR_FAILED.
		for (const failOn of [1, 2]) {
			const fault = new Error(`ECONNRESET inside the harness, on call ${failOn}`);
			let n = 0;
			const stub = stubTransport(() => {
				n += 1;
				if (n === failOn) throw fault;
				return answer('I could not decide.');
			});
			const written: unknown[] = [];
			await expect(
				runQualification(
					inputs({ transport: stub, cases: [caseById('G-CLEAN')], onLine: (l) => written.push(l) })
				),
				`call ${failOn}`
			).rejects.toBe(fault);
			// ⛔ NOT EVEN THE RUN LINE (decision 3): a RUN with no CALL behind it would be a run the harness stopped,
			// sitting in an append-only record as though the candidate had been measured on nothing.
			expect(
				written.map((l) => (l as { kind: string }).kind),
				'no line at all — the RUN line waits for the first evaluation'
			).toEqual([]);
		}
	});

	it('⛔ the runner refuses when JPWB_AGY_BIN or JPWB_DEVIN_BIN is set — even empty — before the transport is asked anything (REG-D-072 D12)', async () => {
		for (const env of [
			{ JPWB_AGY_BIN: 'C:/stand-in/agy-shim.exe' },
			{ JPWB_DEVIN_BIN: '/opt/devin-stand-in' },
			{ JPWB_AGY_BIN: '' }
		]) {
			const [variable] = Object.keys(env);
			const stub = stubTransport(() => answer(judgement([])));
			await expect(
				runQualification(inputs({ transport: stub, cases: [caseById('G-CLEAN')], env })),
				variable
			).rejects.toThrow(`${variable} is set`);
			expect(stub.identified, `${variable}: refused before the transport identified itself`).toBe(
				0
			);
			expect(stub.prompts).toEqual([]);
		}
	});
});

describe('JAN-CRITREAD J2-2 — REG-F-428’s classes, detected harness-side over the raw reply', () => {
	const IDS = new Set(CRITERIA.map((k) => k.id));
	const row = (id: string, failed: unknown = false) => ({
		criterionId: id,
		failed,
		statement: 'absent',
		severity: 'INFORMATIONAL'
	});
	const reply = (rows: readonly unknown[], recommendation: unknown = 'SATISFIED') =>
		JSON.stringify({ findings: rows, recommendation });
	const CLEAN = reply(CRITERIA.map((k) => row(k.id)));

	it('⭐ each class, alone, on the reply that shows it', () => {
		const measuredDuplicate = CLEAN.replace(
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,',
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,"failed":"No delegated professional obligation is omitted…",'
		);
		expect(measuredDuplicate).not.toBe(CLEAN);
		const corrupted = CLEAN.replace(
			'RR-03-no-unjustified-scope-reduction',
			'RR-03-no-unjustified-scope reduction'
		);
		const table: readonly [string, string, readonly string[]][] = [
			['clean', CLEAN, []],
			[
				'REG-F-428 (1), as measured: a duplicate `failed` key',
				measuredDuplicate,
				['DUPLICATE_KEY', 'NON_BOOLEAN_FAILED']
			],
			[
				'REG-F-428 (2): a corrupted id',
				corrupted,
				['UNDECLARED_CRITERION_ID', 'MISSING_CRITERION']
			],
			['fenced', `\`\`\`json\n${CLEAN}\n\`\`\``, ['FENCED']],
			['prose-wrapped', `Here is my review: ${CLEAN}`, ['PROSE_WRAPPED']],
			[
				'fenced and wrapped',
				`Review:\n\`\`\`\n${CLEAN}\n\`\`\`\nDone.`,
				['FENCED', 'PROSE_WRAPPED']
			],
			[
				'unparseable',
				'{"findings":[{"criterionId":"RR-01-no-problem-substitution",}]}',
				['UNPARSEABLE']
			],
			[
				'a thinking loop, no answer',
				"This is perplexing. Let's check the original prompt again. ".repeat(3),
				['NO_ANSWER_SPAN']
			],
			['empty', '', ['NO_ANSWER_SPAN']],
			['a skipped row', reply(CRITERIA.slice(1).map((k) => row(k.id))), ['MISSING_CRITERION']],
			[
				'one criterion twice',
				reply([...CRITERIA.map((k) => row(k.id)), row(CRITERIA[0]!.id, true)]),
				['DUPLICATE_CRITERION']
			],
			[
				'an absent `failed`',
				reply(CRITERIA.map((k, i) => (i === 0 ? { criterionId: k.id } : row(k.id)))),
				['NON_BOOLEAN_FAILED']
			],
			[
				'a recommendation outside the ladder',
				reply(
					CRITERIA.map((k) => row(k.id)),
					'PASS'
				),
				['UNKNOWN_RECOMMENDATION']
			],
			[
				'no findings array',
				JSON.stringify({ findings: 'none', recommendation: 'SATISFIED' }),
				['NO_FINDINGS_ARRAY']
			],
			[
				'a finding with no id',
				reply([...CRITERIA.map((k) => row(k.id)), { failed: true }]),
				['MALFORMED_FINDING']
			],
			[
				'a key the product does not read',
				JSON.stringify({
					findings: CRITERIA.map((k) => row(k.id)),
					recommendation: 'SATISFIED',
					reasoning: 'my chain of thought'
				}),
				['UNREAD_KEY']
			],
			[
				'a key inside a value read only as a type',
				reply(
					CRITERIA.map((k, i) => (i === 0 ? { ...row(k.id), failed: { why: 'x' } } : row(k.id)))
				),
				['NON_BOOLEAN_FAILED', 'UNREAD_KEY']
			]
		];
		for (const [name, raw, classes] of table)
			expect(detectMalformations(raw, IDS), name).toEqual(classes);
	});

	it('⭐ "judged wrong" and "discarded" stay apart — the measured duplicate key scores RR-02 NOT_MET, and the line says why', async () => {
		const measuredDuplicate = CLEAN.replace(
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,',
			'{"criterionId":"RR-02-no-obligation-elision","failed":false,"failed":"No delegated professional obligation is omitted…",'
		);
		const lines = await runQualification(
			inputs({
				transport: stubTransport(() => answer(measuredDuplicate)),
				cases: [caseById('G-CLEAN')]
			})
		);
		const call = lines[1] as CallLine;
		expect(
			call.scored?.criteria.find(([k]) => k === 'RR-02-no-obligation-elision')?.[1],
			'the product’s silent decision'
		).toBe('NOT_MET');
		expect(
			call.malformations,
			'the harness records that it was a malformation, not a finding'
		).toEqual(['DUPLICATE_KEY', 'NON_BOOLEAN_FAILED']);
	});
});
