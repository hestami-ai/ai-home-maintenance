// ⭐ `JAN-CRITREAD` J2-2 — THE REVIEWER-QUALIFICATION RECORD, AND WHAT A LINE OF IT MAY BE (DESIGN-what-the-tests-prove.md
// §5.4; ROADMAP-what-the-tests-prove.md J2-2).
//
// The record is the only durable thing Job 2 produces: J2-3's check reads it to decide what is covered, what reproduces
// and what is escalated, and the sequencing pin reads it for a deployable RUN. So what a line may say is closed here,
// before the first line is written:
//
//   · THE VOCABULARY IS CLOSED — eight line kinds (§5.4's seven, and `JAN-SELREV` SR-4's SELECTION), and a line of any
//     other kind is refused by name.
//   · ⭐ `JAN-SELREV` SR-4 (`REG-D-086`) — A SELECTION names a candidate the product can DEPLOY, by its transport and
//     model label, and the sponsor ruling it rests on; a malformed one is refused like any other line.
//   · SO ARE THE KEYS — a line carrying a field its kind does not declare is refused. That is what keeps a CALL from
//     ever carrying the raw reply or the reasoning beside its answer span (§5.3 retention), and a HELD_OUT line from
//     carrying case ids (§5.2).
//   · A HARNESS IDENTITY IS REFUSED IN A TRACKED RECORD (§5.3), and `deployable` is the transport's, never the
//     writer's — the sequencing pin reads that one field.
//   · THE LINES HANG TOGETHER — a CALL belongs to an earlier RUN, to one of its cases and repetitions, in the order
//     initial → repair, scored once, on its last call, under the RUN's scoring digest.
//   · APPEND-ONLY AGAINST GIT — every committed version of a record file is a byte prefix of the next and of the
//     working tree, and no record file is ever deleted. Records are struck by a SUPERSEDED line, never edited.
//
// ⚠ THE POPULATION IS EMPTY IN THIS INCREMENT — no run is recorded before J2-4 — so every limb is driven on fixtures
// first; the repository limb is the one that will bind once lines exist.
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
	appendOnlyProblems,
	lineProblems,
	RECORD_DIR,
	RECORD_LINE_KINDS,
	recordProblems,
	serializeLine,
	serverDayOf,
	type CallLine,
	type RecordLine,
	type RunLine,
	type SelectionLine
} from '../scripts/reviewer-qual/record.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
const HEX = (c: string) => c.repeat(64);

const RUN: RunLine = {
	kind: 'RUN',
	recordVersion: 1,
	runId: 'qr-2026-09-24-agy-1',
	date: '2026-09-24T12:00:00.000Z',
	commit: 'e5f9358b'.repeat(5),
	reviewerFingerprint: HEX('a'),
	scoringDigest: HEX('b'),
	caseSetDigest: HEX('c'),
	caseSetVersion: 1,
	oracleVersion: 1,
	caseIds: ['G-CLEAN', 'W-CLEAN'],
	repetitions: 2,
	candidate: {
		transport: 'agy',
		agentId: 'agy',
		provider: 'google',
		modelLabel: 'gemini-3.1-pro-high',
		servedModelDigest: null,
		servedTemplateSha256: null,
		servedModelfileSha256: null,
		templateInjectsDate: null,
		serverVersion: null,
		serverUtcOffset: null,
		options: {},
		bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: '3m' },
		argv: ['--print', '<prompt>', '--print-timeout', '3m', '--model', 'gemini-3.1-pro-high']
	},
	deployable: true
};
const EVALUATOR = {
	agentId: 'agy',
	modelId: 'gemini-3.1-pro-high',
	providerId: 'google',
	identityEvidence: 'HOST_CONFIGURED'
} as const;
const SCORED = {
	scoringDigest: HEX('b'),
	disposition: 'SATISFIED',
	resultClass: 'VALID',
	independenceOk: true,
	criteria: [['RR-01-no-problem-substitution', 'MET']]
} as const;
const CALL_ANSWERED: CallLine = {
	kind: 'CALL',
	runId: RUN.runId,
	caseId: 'G-CLEAN',
	repetition: 1,
	role: 'initial',
	promptSha256: HEX('d'),
	elapsedMs: 18_000,
	reply: {
		status: 'ANSWERED',
		answer: '{"findings":[],"recommendation":"SATISFIED"}',
		spanSha256: HEX('6')
	},
	malformations: ['MISSING_CRITERION'],
	served: null,
	evaluator: EVALUATOR,
	scored: SCORED
};
/** A case whose first reply had no answer span, and whose repair the transport failed: two calls, scored on the last. */
const CALL_NO_SPAN: CallLine = {
	...CALL_ANSWERED,
	caseId: 'W-CLEAN',
	reply: { status: 'NO_ANSWER_SPAN', parses: false },
	malformations: ['NO_ANSWER_SPAN'],
	scored: null
};
const CALL_TIMEOUT: CallLine = {
	...CALL_NO_SPAN,
	role: 'repair',
	promptSha256: HEX('e'),
	elapsedMs: 240_000,
	reply: {
		status: 'TRANSPORT_FAILURE',
		failureClass: 'TIMEOUT',
		reason: 'killed at 240000 ms',
		rescorable: false,
		preContact: false
	},
	malformations: [],
	scored: {
		...SCORED,
		disposition: 'VALIDATOR_FAILED',
		resultClass: 'VALIDATOR_FAILED',
		independenceOk: false,
		criteria: []
	}
};
/** One valid line of every kind, in a legal order. */
const EVERY_KIND: readonly RecordLine[] = [
	RUN,
	CALL_ANSWERED,
	CALL_NO_SPAN,
	CALL_TIMEOUT,
	{
		kind: 'ESCALATION',
		runId: RUN.runId,
		caseIds: ['W-CLEAN'],
		// ⚠ A REAL entry, because `register-citations.test.ts` resolves every REG id the code names: `REG-F-427` (5) is
		// where calls cut at the 240 s bound were recorded. The fixture is shape, not history.
		finding: 'REG-F-427',
		note: 'W-CLEAN timed out on its repair.'
	},
	{
		kind: 'RESCORED',
		rescoreId: 'rs-2026-09-25-1',
		sourceRunId: RUN.runId,
		date: '2026-09-25T09:00:00.000Z',
		commit: 'a'.repeat(40),
		reviewerFingerprint: HEX('f'),
		scoringDigest: HEX('9'),
		caseSetDigest: HEX('c'),
		caseId: 'G-CLEAN',
		repetition: 1,
		scored: { ...SCORED, scoringDigest: HEX('9') }
	},
	{
		kind: 'ACKNOWLEDGED',
		date: '2026-09-25T09:00:00.000Z',
		reviewerFingerprint: HEX('f'),
		reason:
			'The move is confined to the process-result arm, which no case in version one exercises.'
	},
	{
		kind: 'SUPERSEDED',
		date: '2026-09-26T09:00:00.000Z',
		record: 'rs-2026-09-25-1',
		// A real entry for the same reason: `REG-F-429` is a measured non-reproduction across a day boundary.
		finding: 'REG-F-429',
		note: 'Does not reproduce.'
	},
	{
		kind: 'HELD_OUT',
		runId: 'ho-2026-09-26-1',
		date: '2026-09-26T09:00:00.000Z',
		reviewerFingerprint: HEX('f'),
		// ⭐ `JAN-CRITREAD` J2-6 — a count for each MATERIAL class, and since `REG-D-080` those are the verdict-level
		// classes: a planted defect whose verdict is not REJECTED, not one whose criterion went unnamed. The
		// criterion-level classes (an unnamed planted criterion, FAULT_LOST, and an answered criterion now
		// UNABLE_TO_DETERMINE) are reported and never counted here. No HELD_OUT line has ever been written — the tier is
		// deferred (Q7 (b)(i)) — so none is stranded.
		counts: {
			PLANTED_DEFECT_NOT_REJECTED: 1,
			CLEAN_NOT_SATISFIED: 0,
			VERDICT_CHANGES_WITH_NAME: 0,
			BOUNDEDNESS: 0,
			SATISFIED_LOST: 0,
			MALFORMATION_GAINED: 0,
			REPETITIONS_NOW_DISAGREE: 0,
			BOUND_NOW_EXCEEDED: 0
		}
	},
	{
		kind: 'SELECTION',
		date: '2026-09-26T09:00:00.000Z',
		candidate: { transport: 'devin', modelLabel: 'glm-5-3-flash-max' },
		// ⚠ A REAL ruling, for the same reason: `REG-D-084` is the sponsor's selection of this candidate.
		ruling: 'REG-D-084',
		note: 'The sponsor selects GLM-5.3 Flash Max through devin.'
	}
];
const text = (lines: readonly unknown[]) => lines.map((l) => `${JSON.stringify(l)}\n`).join('');

describe('JAN-CRITREAD J2-2 — the reviewer-qualification record', () => {
	it('⭐ CONTROL — one valid line of every kind validates, alone and as a tracked record, and serializes as one LF line', () => {
		expect(new Set(EVERY_KIND.map((l) => l.kind)), 'the fixture carries every kind').toEqual(
			new Set(RECORD_LINE_KINDS)
		);
		for (const line of EVERY_KIND) expect(lineProblems(line), line.kind).toEqual([]);
		expect(recordProblems(text(EVERY_KIND), { tracked: true })).toEqual([]);
		for (const line of EVERY_KIND) expect(serializeLine(line)).toBe(`${JSON.stringify(line)}\n`);
	});

	it('⛔ THE VOCABULARY IS CLOSED — exactly the seven line kinds of §5.4 and SR-4’s SELECTION, and any other is refused by name', () => {
		expect([...RECORD_LINE_KINDS]).toEqual([
			'RUN',
			'CALL',
			'ESCALATION',
			'RESCORED',
			'ACKNOWLEDGED',
			'SUPERSEDED',
			'HELD_OUT',
			'SELECTION'
		]);
		for (const kind of ['RERUN', 'NOTE', 'run', '']) {
			const problems = lineProblems({ ...RUN, kind });
			expect(problems.join('\n'), kind).toContain(`kind ${JSON.stringify(kind)} is not one of`);
		}
		expect(lineProblems('RUN').join('\n')).toContain('not a JSON object');
		expect(
			recordProblems(text([RUN, { ...CALL_ANSWERED, kind: 'CALLED' }]), { tracked: false }).join(
				'\n'
			)
		).toContain('line 2: kind "CALLED" is not one of');
	});

	it('⛔ THE KEYS ARE CLOSED — a CALL carrying the raw reply or the reasoning, or a HELD_OUT carrying case ids, is refused', () => {
		for (const key of ['raw', 'thinking', 'rawOutput', 'volunteeredReasoning'])
			expect(
				lineProblems({ ...CALL_ANSWERED, [key]: 'the model’s reasoning' }).join('\n'),
				key
			).toContain(`CALL: unexpected key "${key}"`);
		expect(
			lineProblems({ ...CALL_ANSWERED, reply: { ...CALL_ANSWERED.reply, reasoning: 'x' } }).join(
				'\n'
			)
		).toContain('CALL.reply: unexpected key "reasoning"');
		const heldOut = EVERY_KIND.find((l) => l.kind === 'HELD_OUT')!;
		expect(lineProblems({ ...heldOut, caseIds: ['G-CLEAN'] }).join('\n')).toContain(
			'HELD_OUT: unexpected key "caseIds"'
		);
		const { finding: _dropped, ...noFinding } = EVERY_KIND.find((l) => l.kind === 'ESCALATION')!;
		expect(lineProblems(noFinding).join('\n')).toContain('ESCALATION: missing key "finding"');
	});

	it('⛔ THE KEYS ARE CLOSED BY OWN PROPERTY — a name every object inherits (constructor, toString, __proto__ …) is refused like any other, at the top and nested', () => {
		// ⚠ Each arrangement goes through JSON.parse, as a record line arrives: in JSON text `__proto__` is an OWN key,
		// never the prototype, so it is exactly as able to carry text into a line as `constructor` is.
		const INHERITED = [
			'constructor',
			'toString',
			'valueOf',
			'hasOwnProperty',
			'isPrototypeOf',
			'__proto__'
		];
		const call = JSON.stringify(CALL_ANSWERED);
		const carrying = (key: string, where: 'top' | 'reply'): string => {
			const planted = `${JSON.stringify(key)}:"RAW REASONING CANARY-C1 … 45,000 tokens of thinking",`;
			const out =
				where === 'top'
					? call.replace(/^\{/, `{${planted}`)
					: call.replace('"reply":{', `"reply":{${planted}`);
			expect(out, `${key} ${where}: the arrangement planted it`).not.toBe(call);
			return out;
		};
		for (const key of INHERITED) {
			const top = JSON.parse(carrying(key, 'top')) as object;
			expect(Object.hasOwn(top, key), `${key}: an OWN key of the parsed line`).toBe(true);
			expect(lineProblems(top).join('\n'), `${key}, at the top`).toContain(
				`CALL: unexpected key "${key}"`
			);
			const nested = JSON.parse(carrying(key, 'reply')) as { reply: object };
			expect(Object.hasOwn(nested.reply, key), `${key}: an OWN key of the parsed reply`).toBe(true);
			expect(lineProblems(nested).join('\n'), `${key}, in the reply`).toContain(
				`CALL.reply: unexpected key "${key}"`
			);
			const tracked = `${JSON.stringify(RUN)}\n${carrying(key, 'top')}\n`;
			expect(
				recordProblems(tracked, { tracked: true }).join('\n'),
				`${key}, a tracked record`
			).toContain(`line 2: CALL: unexpected key "${key}"`);
		}
	});

	it('⛔ RETENTION, AS FAR AS A LINE CAN SHOW IT — an answer is a `{…}` span, and a transport failure is never re-scorable', () => {
		const prose = {
			...CALL_ANSWERED,
			reply: { status: 'ANSWERED', answer: 'Let me think… {"findings":[]}' }
		};
		expect(lineProblems(prose).join('\n')).toContain('CALL.reply.answer: not an answer span');
		const rescorable = { ...CALL_TIMEOUT, reply: { ...CALL_TIMEOUT.reply, rescorable: true } };
		expect(lineProblems(rescorable).join('\n')).toContain('CALL.reply.rescorable');
		const unknownClass = {
			...CALL_TIMEOUT,
			reply: { ...CALL_TIMEOUT.reply, failureClass: 'CRASHED' }
		};
		expect(lineProblems(unknownClass).join('\n')).toContain('CALL.reply.failureClass');
		expect(lineProblems({ ...CALL_ANSWERED, malformations: ['LOOKS_ODD'] }).join('\n')).toContain(
			'CALL.malformations[0]'
		);
	});

	it('⛔ RETENTION IS ENFORCED BY THE LINE — an answer is the canonical form of what the product reads: one JSON object, nothing outside JSON syntax, no key the product does not read', () => {
		const answering = (answer: string) =>
			lineProblems({ ...CALL_ANSWERED, reply: { ...CALL_ANSWERED.reply, answer } }).join('\n');
		// The verifier's canaries — each begins with `{` and ends with `}`, which was all a line was asked.
		for (const answer of [
			'{CANARY-C3 reasoning about RR-04}. Conclusion:\n{"findings":[],"recommendation":"SATISFIED"}',
			'{"findings":[],"recommendation":"SATISFIED"}\n\nP.S. {CANARY-C3b: I was unsure about RR-02}',
			'{x} This is perplexing. Let me check the original prompt again. }'
		])
			expect(answering(answer), answer).toContain(
				'CALL.reply.answer: not an answer span that parses as one JSON value'
			);
		// One JSON object — carrying a key the product never reads, at the top, in a finding, or inside a value it
		// reads only as a type; or written other than the canonical way.
		for (const answer of [
			'{"findings":[],"recommendation":"SATISFIED","reasoning":"CANARY — my chain of thought"}',
			'{"findings":[{"criterionId":"RR-01-no-problem-substitution","failed":false,"thinking":"CANARY"}],"recommendation":"SATISFIED"}',
			'{"findings":[{"criterionId":"RR-01-no-problem-substitution","failed":{"why":"CANARY"}}],"recommendation":"SATISFIED"}',
			'{"findings": [], "recommendation": "SATISFIED"}',
			'{"recommendation":"SATISFIED","findings":[]}'
		])
			expect(answering(answer), answer).toContain(
				'CALL.reply.answer: not an answer span in its retained form'
			);
		// A span that is not one JSON value is recorded NOT_RETAINED: its hash, and nothing of its text.
		const notRetained = {
			...CALL_ANSWERED,
			reply: { status: 'NOT_RETAINED', spanSha256: HEX('7') },
			malformations: ['UNPARSEABLE', 'PROSE_WRAPPED']
		};
		expect(lineProblems(notRetained), 'NOT_RETAINED, with its hash').toEqual([]);
		expect(
			lineProblems({ ...notRetained, reply: { ...notRetained.reply, answer: '{CANARY}' } }).join(
				'\n'
			)
		).toContain('CALL.reply: unexpected key "answer"');
		expect(
			lineProblems({
				...notRetained,
				reply: { status: 'NOT_RETAINED', spanSha256: 'CANARY' }
			}).join('\n')
		).toContain('CALL.reply.spanSha256: not a sha256');
	});

	it('⛔ A HARNESS IDENTITY IS REFUSED IN A TRACKED RECORD, and `deployable` is the transport’s, never the writer’s', () => {
		const stub: RunLine = {
			...RUN,
			candidate: {
				...RUN.candidate,
				transport: 'stub',
				agentId: 'stub',
				provider: 'jpwb-stub',
				argv: null
			},
			deployable: false
		};
		const stubRecord = text([stub, CALL_ANSWERED]);
		expect(
			recordProblems(stubRecord, { tracked: false }),
			'a stub run is a valid UNTRACKED record'
		).toEqual([]);
		expect(recordProblems(stubRecord, { tracked: true }).join('\n')).toContain(
			'line 1: RUN qr-2026-09-24-agy-1 carries a harness identity (transport "stub")'
		);
		// The sequencing pin reads `deployable` and nothing else, so a writer may not choose it.
		expect(lineProblems({ ...stub, deployable: true }).join('\n')).toContain(
			'RUN.deployable: true, but transport "stub" is'
		);
		expect(lineProblems({ ...RUN, deployable: false }).join('\n')).toContain(
			'RUN.deployable: false, but transport "agy" is'
		);
		// A synthetic provider label under a real transport is a harness identity too (§5.3).
		expect(
			lineProblems({ ...RUN, candidate: { ...RUN.candidate, provider: 'jpwb-test' } }).join('\n')
		).toContain('RUN.candidate.provider: "jpwb-test" is not agy’s provider "google"');
		// ⭐ A real Ollama model is admitted, NOT deployable, and only with what it was served.
		const ollama: RunLine = {
			...RUN,
			candidate: {
				...RUN.candidate,
				transport: 'ollama',
				agentId: 'ollama',
				provider: 'ollama',
				modelLabel: 'gpt-oss:20b',
				servedModelDigest: HEX('1'),
				servedTemplateSha256: HEX('2'),
				servedModelfileSha256: HEX('3'),
				templateInjectsDate: true,
				serverVersion: '0.34.2',
				serverUtcOffset: '-04:00',
				options: { temperature: 0, seed: 42, num_ctx: 131072, think: 'medium' },
				bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: null },
				argv: null
			},
			deployable: false
		};
		const served = { templateSha256: HEX('2'), serverClock: 'Thu, 24 Sep 2026 12:00:00 GMT' };
		expect(recordProblems(text([ollama, { ...CALL_ANSWERED, served }]), { tracked: true })).toEqual(
			[]
		);
		expect(
			lineProblems({ ...ollama, candidate: { ...ollama.candidate, servedModelDigest: null } }).join(
				'\n'
			)
		).toContain('RUN.candidate.servedModelDigest: an ollama candidate records what it was served');
		expect(recordProblems(text([ollama, CALL_ANSWERED]), { tracked: true }).join('\n')).toContain(
			'line 2: CALL G-CLEAN#1 initial carries no served facts, but its run is ollama'
		);
	});

	it('⛔ SERVED FACTS — every CALL of an ollama run carries them, except a transport failure refused BEFORE the server was touched, and nowhere else', () => {
		const ollamaRun: RunLine = {
			...RUN,
			candidate: {
				...RUN.candidate,
				transport: 'ollama',
				agentId: 'ollama',
				provider: 'ollama',
				modelLabel: 'gpt-oss:20b',
				servedModelDigest: HEX('1'),
				servedTemplateSha256: HEX('2'),
				servedModelfileSha256: HEX('3'),
				templateInjectsDate: true,
				serverVersion: '0.34.2',
				serverUtcOffset: '-04:00',
				options: { temperature: 0, seed: 42, num_ctx: 131072 },
				bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: null },
				argv: null
			},
			deployable: false
		};
		const served = { templateSha256: HEX('2'), serverClock: 'Thu, 24 Sep 2026 12:00:00 GMT' };
		const failed = (preContact: boolean, failureClass = 'REFUSAL') => ({
			...CALL_TIMEOUT,
			caseId: 'G-CLEAN',
			role: 'initial',
			reply: {
				status: 'TRANSPORT_FAILURE',
				failureClass,
				reason: 'the prompt is 28001 characters, over the 28000-character limit agy imposes',
				rescorable: false,
				preContact
			}
		});
		const at = (call: unknown) =>
			recordProblems(text([ollamaRun, call]), { tracked: true }).join('\n');
		expect(
			at({ ...failed(true), served: null }),
			'refused before contact: nothing was served'
		).toBe('');
		expect(at({ ...failed(false), served }), 'a failure after contact, with what was served').toBe(
			''
		);
		expect(at({ ...failed(false), served: null })).toContain(
			'line 2: CALL G-CLEAN#1 initial carries no served facts, but its run is ollama'
		);
		expect(at({ ...failed(true), served })).toContain(
			'line 2: CALL G-CLEAN#1 initial was refused before the server was touched, yet carries served facts'
		);
		expect(lineProblems({ ...failed(true, 'TIMEOUT'), served: null }).join('\n')).toContain(
			'CALL.reply.preContact: a call refused before contact reached no bound'
		);
	});

	it('⛔ THE SERVER’S UTC OFFSET (REG-F-429) — an ollama candidate records it as ±HH:MM, and no other transport can see one', () => {
		const ollama: RunLine = {
			...RUN,
			candidate: {
				...RUN.candidate,
				transport: 'ollama',
				agentId: 'ollama',
				provider: 'ollama',
				modelLabel: 'gpt-oss:20b',
				servedModelDigest: HEX('1'),
				servedTemplateSha256: HEX('2'),
				servedModelfileSha256: HEX('3'),
				templateInjectsDate: true,
				serverVersion: '0.34.2',
				serverUtcOffset: '-04:00',
				options: { temperature: 0, seed: 42, num_ctx: 131072 },
				bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: null },
				argv: null
			},
			deployable: false
		};
		expect(lineProblems(ollama), 'recorded, as ±HH:MM').toEqual([]);
		expect(lineProblems({ ...ollama, candidate: { ...ollama.candidate, serverUtcOffset: '+00:00' } })).toEqual([]);
		expect(
			lineProblems({ ...ollama, candidate: { ...ollama.candidate, serverUtcOffset: null } }).join('\n')
		).toContain('RUN.candidate.serverUtcOffset: an ollama candidate records what it was served');
		for (const bad of ['UTC-4', '-4:00', '-04', 'Z', '-04:00 '])
			expect(
				lineProblems({ ...ollama, candidate: { ...ollama.candidate, serverUtcOffset: bad } }).join('\n'),
				bad
			).toContain('RUN.candidate.serverUtcOffset: not a UTC offset');
		// ⭐ `JAN-CRITREAD` J2-3 — ONLY AN OFFSET A SERVER CAN KEEP: −12:00 to +14:00, the minutes 00, 30 or 45; and never
		// `-00:00`, RFC 3339's spelling of an UNKNOWN offset. The check places every call by it (`record.ts` `serverDayOf`).
		for (const real of ['+14:00', '-12:00', '+05:45', '+05:30', '+12:45', '-09:30', '+00:00'])
			expect(lineProblems({ ...ollama, candidate: { ...ollama.candidate, serverUtcOffset: real } }), real).toEqual([]);
		for (const unreal of ['+99:99', '+14:30', '-12:30', '+05:15', '-04:60', '+24:00', '-00:00'])
			expect(
				lineProblems({ ...ollama, candidate: { ...ollama.candidate, serverUtcOffset: unreal } }).join('\n'),
				unreal
			).toContain('RUN.candidate.serverUtcOffset: not a UTC offset');
		expect(
			lineProblems({ ...RUN, candidate: { ...RUN.candidate, serverUtcOffset: '-04:00' } }).join('\n')
		).toContain('RUN.candidate.serverUtcOffset: agy is served nothing a run can see');
		// The server's calendar date for a served clock — the one function the runner stops by and the check discards by.
		expect(serverDayOf('Thu, 24 Sep 2026 03:59:59 GMT', '-04:00'), 'a second before the server’s midnight').toBe('2026-09-23');
		expect(serverDayOf('Thu, 24 Sep 2026 04:00:00 GMT', '-04:00'), 'its midnight').toBe('2026-09-24');
		expect(serverDayOf('Wed, 23 Sep 2026 18:15:00 GMT', '+05:45')).toBe('2026-09-24');
		expect(serverDayOf('Thursday, 24-Sep-26 04:00:00 GMT', '-04:00'), 'not an IMF-fixdate').toBeUndefined();
		expect(serverDayOf('Thu, 24 Sep 2026 04:00:00 GMT', '+99:99'), 'not an offset').toBeUndefined();
		const { serverUtcOffset: _dropped, ...without } = RUN.candidate;
		expect(lineProblems({ ...RUN, candidate: without }).join('\n')).toContain(
			'RUN.candidate: missing key "serverUtcOffset"'
		);
	});

	it('⛔ THE LINES HANG TOGETHER — a CALL belongs to an earlier RUN, its cases and repetitions, initial then repair, scored once on its last call', () => {
		const at = (lines: readonly unknown[]) =>
			recordProblems(text(lines), { tracked: true }).join('\n');
		expect(at([CALL_ANSWERED, RUN])).toContain(
			'line 1: CALL names run qr-2026-09-24-agy-1, which no earlier RUN line declares'
		);
		expect(at([RUN, RUN])).toContain('line 2: RUN qr-2026-09-24-agy-1 is declared twice');
		expect(at([RUN, { ...CALL_ANSWERED, caseId: 'G-RR-04' }])).toContain(
			'line 2: CALL G-RR-04#1 initial: G-RR-04 is not one of its run’s cases'
		);
		expect(at([RUN, { ...CALL_ANSWERED, repetition: 3 }])).toContain(
			'line 2: CALL G-CLEAN#3 initial: repetition 3 is beyond its run’s 2'
		);
		expect(at([RUN, { ...CALL_ANSWERED, role: 'repair' }])).toContain(
			'line 2: CALL G-CLEAN#1 repair does not follow an initial call'
		);
		expect(at([RUN, CALL_ANSWERED, CALL_ANSWERED])).toContain(
			'line 3: CALL G-CLEAN#1 initial: the evaluation already has'
		);
		expect(at([RUN, CALL_NO_SPAN])).toContain('W-CLEAN#1: its last call carries no scored outcome');
		expect(at([RUN, { ...CALL_NO_SPAN, scored: SCORED }, CALL_TIMEOUT])).toContain(
			'line 2: CALL W-CLEAN#1 initial is scored, but a later call follows it'
		);
		expect(
			at([RUN, { ...CALL_ANSWERED, scored: { ...SCORED, scoringDigest: HEX('0') } }])
		).toContain('line 2: CALL G-CLEAN#1 initial is scored under a digest that is not its run’s');
	});

	it('⛔ `JAN-SELREV` SR-4 — A SELECTION names a candidate the product can DEPLOY and the sponsor ruling it rests on; a malformed one is refused like any other line (REG-D-086)', () => {
		const selection = EVERY_KIND.find((l): l is SelectionLine => l.kind === 'SELECTION')!;
		const at = (line: unknown) => lineProblems(line).join('\n');
		expect(lineProblems(selection), 'CONTROL: the selected candidate, on its ruling').toEqual([]);
		// ⛔ THE CANDIDATE — a transport the record knows but the product cannot run as its reviewer (§3.5) is refused: a
		// local model, the harness stub. A transport the record does not know is refused as it is in a RUN.
		for (const transport of ['ollama', 'stub'])
			expect(at({ ...selection, candidate: { transport, modelLabel: 'gpt-oss:20b' } }), transport).toContain(
				`SELECTION.candidate.transport: "${transport}" cannot be deployed as the product’s reviewer (§3.5) — a SELECTION names a candidate it can deploy: agy, devin`
			);
		expect(at({ ...selection, candidate: { transport: 'agy', modelLabel: 'gemini-3.1-pro-high' } }), 'agy is deployable').toBe('');
		expect(at({ ...selection, candidate: { transport: 'pi', modelLabel: 'x' } })).toContain(
			'SELECTION.candidate.transport: "pi" is not one of agy, devin, ollama, stub'
		);
		// …by its transport AND its model label, and nothing else: the rest of a RUN's identity follows from them.
		expect(at({ ...selection, candidate: { transport: 'devin' } })).toContain('SELECTION.candidate: missing key "modelLabel"');
		expect(at({ ...selection, candidate: { transport: 'devin', modelLabel: '' } })).toContain(
			'SELECTION.candidate.modelLabel: not a string'
		);
		expect(at({ ...selection, candidate: { ...selection.candidate, provider: 'devin' } })).toContain(
			'SELECTION.candidate: unexpected key "provider"'
		);
		// ⛔ THE RULING — a sponsor ruling's id, `REG-D-NNN`: a finding is not a ruling.
		for (const ruling of ['REG-F-454', 'D-084', 'reg-d-084', ''])
			expect(at({ ...selection, ruling }), ruling).toContain('SELECTION.ruling: not a sponsor ruling (REG-D-NNN)');
		// ⛔ ITS KEYS ARE CLOSED AND REQUIRED, like every line's.
		expect(at({ ...selection, date: '2026-09-26' })).toContain('SELECTION.date: not an ISO-8601 UTC time');
		const { note: _dropped, ...noNote } = selection;
		expect(at(noNote)).toContain('SELECTION: missing key "note"');
		expect(at({ ...selection, deployable: true })).toContain('SELECTION: unexpected key "deployable"');
		// And a record holding one is refused, by line.
		const ollama = { ...selection, candidate: { transport: 'ollama', modelLabel: 'gpt-oss:20b' } };
		expect(recordProblems(text([RUN, CALL_ANSWERED, ollama]), { tracked: true }).join('\n')).toContain(
			'line 3: SELECTION.candidate.transport: "ollama" cannot be deployed as the product’s reviewer'
		);
	});

	it('⛔ THE TEXT — LF only, no BOM, one object per line, a final newline, no blank line', () => {
		const good = text([RUN, CALL_ANSWERED]);
		expect(recordProblems(good.replace(/\n/g, '\r\n'), { tracked: true }).join('\n')).toContain(
			'CR'
		);
		expect(recordProblems(`\uFEFF${good}`, { tracked: true }).join('\n')).toContain('BOM');
		expect(recordProblems(good.slice(0, -1), { tracked: true }).join('\n')).toContain(
			'final newline'
		);
		expect(recordProblems(good.replace('\n', '\n\n'), { tracked: true }).join('\n')).toContain(
			'line 2: blank'
		);
		expect(recordProblems('{"kind":"RUN",\n', { tracked: true }).join('\n')).toContain(
			'line 1: not JSON'
		);
		expect(recordProblems('', { tracked: true }), 'an empty file is an empty record').toEqual([]);
	});

	it('⛔ APPEND-ONLY — each version a byte prefix of the next; a rewrite or a deletion is refused', () => {
		const v1 = text([RUN, CALL_ANSWERED]);
		const v2 = v1 + text([CALL_NO_SPAN, CALL_TIMEOUT]);
		expect(appendOnlyProblems([v1, v2, v2])).toEqual([]);
		expect(appendOnlyProblems(['', v1]), 'a file created by a commit').toEqual([]);
		const rewritten = v2.replace('"elapsedMs":18000', '"elapsedMs":17000');
		expect(appendOnlyProblems([v2, rewritten]).join('\n')).toContain(
			'version 2 is not version 1 with lines appended'
		);
		expect(appendOnlyProblems([v2, v1]).join('\n')).toContain(
			'version 2 is not version 1 with lines appended'
		);
	});
});

// ── against git ──────────────────────────────────────────────────────────────────────────────────────────────────
const git = (cwd: string, ...args: string[]): string => {
	const r = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		windowsHide: true
	});
	if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
	return r.stdout;
};

/** Every problem with the top-level record files under `dir`, across HEAD's history and against the working tree. */
function gitAppendOnlyProblems(root: string, dir: string): { problems: string[]; files: string[] } {
	const problems: string[] = [];
	// Every TOP-LEVEL record file that EVER existed in HEAD's history — a deleted one still has one. `--relative`
	// names them from `root`, which in this repository is a subdirectory of the git top level.
	const ever = new Set(
		git(root, 'log', '--format=', '--name-only', '--relative', '--', `${dir}/*.ndjson`)
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.endsWith('.ndjson') && !l.slice(dir.length + 1).includes('/'))
	);
	const files: string[] = [];
	for (const rel of ever) {
		files.push(rel);
		const commits = git(root, 'log', '--format=%H', '--reverse', '--', rel)
			.split('\n')
			.filter(Boolean);
		const versions = commits.map((c) => {
			// ⚠ THE `./` IS LOAD-BEARING (`register-append-only.test.ts`): without it git resolves the path from the top level.
			const r = spawnSync('git', ['show', `${c}:./${rel}`], {
				cwd: root,
				encoding: 'utf8',
				maxBuffer: 64 * 1024 * 1024
			});
			return r.status === 0 ? r.stdout : undefined;
		});
		if (versions.some((v) => v === undefined) || !existsSync(join(root, rel))) {
			problems.push(
				`${rel}: a record file was deleted — records are struck by a SUPERSEDED line, never deleted`
			);
			continue;
		}
		const all = [...(versions as string[]), readFileSync(join(root, rel), 'utf8')];
		problems.push(...appendOnlyProblems(all).map((p) => `${rel}: ${p}`));
	}
	return { problems, files };
}

describe('JAN-CRITREAD J2-2 — the record is append-only against git', () => {
	const roots: string[] = [];
	afterAll(() => {
		for (const r of roots)
			try {
				rmSync(r, { recursive: true, force: true });
			} catch {
				/* temp is the backstop */
			}
	});
	function fixtureRepo(): string {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-qualrec-')).replace(/\\/g, '/');
		roots.push(root);
		git(root, 'init', '-q');
		git(root, 'config', 'user.email', 'fixture@example.invalid');
		git(root, 'config', 'user.name', 'fixture');
		git(root, 'config', 'core.autocrlf', 'false');
		mkdirSync(`${root}/${RECORD_DIR}`, { recursive: true });
		return root;
	}
	const commitAll = (root: string, message: string) => {
		git(root, 'add', '-A');
		git(root, 'commit', '-q', '-m', message);
	};

	it('⭐ AGAINST GIT, ON A FIXTURE — appending across commits is clean; a rewrite, and a deletion, are each refused', () => {
		const file = `${RECORD_DIR}/runs.ndjson`;
		const appended = fixtureRepo();
		writeFileSync(`${appended}/${file}`, text([RUN, CALL_ANSWERED]));
		commitAll(appended, 'first run');
		writeFileSync(`${appended}/${file}`, text([RUN, CALL_ANSWERED, CALL_NO_SPAN, CALL_TIMEOUT]));
		commitAll(appended, 'appended');
		writeFileSync(`${appended}/${file}`, text([...EVERY_KIND]));
		expect(gitAppendOnlyProblems(appended, RECORD_DIR)).toEqual({ problems: [], files: [file] });

		const rewritten = fixtureRepo();
		writeFileSync(`${rewritten}/${file}`, text([RUN, CALL_ANSWERED]));
		commitAll(rewritten, 'first run');
		writeFileSync(`${rewritten}/${file}`, text([RUN, { ...CALL_ANSWERED, elapsedMs: 1 }]));
		commitAll(rewritten, 'rewrote a line');
		expect(gitAppendOnlyProblems(rewritten, RECORD_DIR).problems.join('\n')).toContain(
			`${file}: version 2 is not version 1 with lines appended`
		);

		const deleted = fixtureRepo();
		writeFileSync(`${deleted}/${file}`, text([RUN, CALL_ANSWERED]));
		commitAll(deleted, 'first run');
		unlinkSync(`${deleted}/${file}`);
		commitAll(deleted, 'deleted the record');
		expect(gitAppendOnlyProblems(deleted, RECORD_DIR).problems.join('\n')).toContain(
			`${file}: a record file was deleted`
		);
	});

	it('⛔ THIS REPOSITORY — every record file validates as TRACKED and has only ever been appended to', () => {
		const dir = `${REPO}/${RECORD_DIR}`;
		const onDisk = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ndjson')) : [];
		const problems = onDisk.flatMap((f) =>
			recordProblems(readFileSync(`${dir}/${f}`, 'utf8'), { tracked: true }).map(
				(p) => `${f}: ${p}`
			)
		);
		const history = gitAppendOnlyProblems(REPO, RECORD_DIR);
		expect([...problems, ...history.problems]).toEqual([]);
		// ⚠ THE POPULATION, STATED RATHER THAN ASSERTED: no run is recorded before J2-4, so today both limbs measure
		// nothing here — the fixtures above are what show each can fail. A file on disk that git has not yet seen (a
		// run written before its commit) is checked for its content above, and joins the history limb once committed.
	});
});
