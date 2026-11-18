// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — `REG-D-170` (the lead's delegated ruling, flagged for the sponsor's confirmation), item 4 — THE CENSUS OF THE TWO
// PAIRS THE DEFECT LOOP WIDENS THE CONTEXT POLICY BY: `PRIOR_RATIONALE` and `PRIOR_REVIEW_FINDING` at `THIS_UNDERTAKING`.
//
// ⭑ WHY A CENSUS (the ruling, from the lead's check of its draft): every binding minted since package L17b1 names the wider policy
// (`ctx-default-loop`), so the ceiling no longer refuses either pair on any new step. What keeps the widening to the loop is that ONLY TWO TURNS
// DECLARE EITHER PAIR — ~~a forked successor's first turn (its predecessor's work product and rationale, and its findings where its session held a
// repair turn)~~ ⭐ a turn of a replacement's session, which holds the record's tool (package L17b3, design D89: what the record it reads holds, read
// or not), and a turn carrying D77's feedback from another unit or the assurance stage — and every other turn is declared byte for byte as
// before. This census holds that, ~~two~~ ⭐ three ways:
//   1. BY BEHAVIOUR: every shape of turn the step can send is run under `ctx-default` — the five pairs, neither new one — and the turns it refuses
//      for a new pair must be exactly the two named below; under `ctx-default-loop`, every shape runs.
//   2. BY SOURCE: the product's sources declare either pair in ~~one function alone, `crossUnitSources`~~ ⭐ one file alone (`run-model-step.ts`):
//      `crossUnitSources` and, since package L17b3 (D89), `recordSources` — what the record a replacement's tool reads holds — which it and a
//      later try's assembly call; and the policy states them in one place, `LOOP_CONTEXT_ASSEMBLY_POLICY` (`context-assembly.ts`); a declaration
//      written anywhere else reddens this, naming it.
//   3. ⭐ BY BINDING (package L17b3, D89; `REG-D-173` (2)): ~~every binding minted since package L17b1 names the wider policy~~ — since D89 a binding
//      names its step's policy, the page choosing it (`contextPolicyIdForStep`): each step whose turns declare a loop pair is bound to
//      `ctx-default-loop`, and no step bound to `ctx-default` declares one.
// ⛔ A census reddens on an arrival by design: a new turn that must declare a new pair is a change to `REG-D-170`'s list, made here, named.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY,
	LOOP_CONTEXT_ASSEMBLY_POLICY,
	type ContextAssemblyPolicyContent
} from '@janumipwb/rph-application';
import type { PromptTemplate, RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { oneShotSession } from '../apps/rph-demo/src/lib/server/execution/producer-session.js';
// ⭐ L17b3 (D89) — ~~`type HeldPredecessor`~~: no session holds another unit's conversation since D89, and the type goes with the fork.
import { runModelInvocationStep, type SessionHolds, type TurnFeedback } from '../apps/rph-demo/src/lib/server/execution/run-model-step.js';
import { contextPolicyIdForStep } from '../apps/rph-demo/src/lib/server/execution/step-binding.js';

const NEW_PAIRS = ['PRIOR_RATIONALE at THIS_UNDERTAKING', 'PRIOR_REVIEW_FINDING at THIS_UNDERTAKING'] as const;

/**
 * ⭑ THE CENSUS: each turn that declares a new pair, and which. Any other turn declares neither. ⭐ RESTATED for the independent review's defects 1 and 8:
 * a turn declares what its session HOLDS, not only what its first turn carries — ~~a forked successor's first turn, a later try on a forked session or
 * after a cross-unit first turn, and a later step on a reopened fork; and another unit's rationale only where its conversation returned a work product~~.
 * ~~'a forked successor’s first turn'~~, ~~'… its history holding findings'~~, ~~'a turn carrying D77’s feedback …'~~ — the three kinds below, by what
 * the session holds.
 * ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173`, `REG-D-170`): ~~'a turn on a session holding another unit’s
 * answered conversation'~~, ~~'a turn on a session holding another unit’s review findings'~~ — nothing forks since D89, so no session holds another
 * unit's conversation; a replacement's session holds the record's read-only tool instead, and every turn of it declares at THIS_UNDERTAKING what the
 * record it reads holds, read or not, since the tool puts it within the model's reach: an earlier unit's answer (its work product and rationale), and
 * findings or the loop's feedback an earlier unit was given. D77's feedback, as before.
 */
const DECLARES = {
	'a turn of a session holding the record’s tool, the record holding an earlier unit’s answer': ['PRIOR_RATIONALE at THIS_UNDERTAKING'],
	'a turn of a session holding the record’s tool, the record holding findings or feedback an earlier unit was given': ['PRIOR_REVIEW_FINDING at THIS_UNDERTAKING'],
	'a turn carrying D77’s feedback from another unit or the stage, or on a session that holds it': ['PRIOR_REVIEW_FINDING at THIS_UNDERTAKING']
} as const;

/**
 * ⭐ L17b3 (D89) — WHAT THE RECORD PUTS IN REACH OF A REPLACEMENT'S TURNS, as the page hands it to the step (`earlierAttempt`): the line's sentence on a
 * first turn, whether the executor minted the record's tool, and what the record of the units it replaces holds. ⛔ No tool — a grant that leaves the
 * capability out, or an executor that mints no tools — no sentence and no pair, the step as today.
 */
interface RecordOnHand {
	readonly sentence?: string;
	readonly toolMinted: boolean;
	readonly holds: { readonly answer: boolean; readonly findings: boolean };
}

/** The census's kinds a turn falls under from what its session holds and the feedback it carries or holds — ~~and the fork it holds~~. */
function heldCensusOf(holds: SessionHolds, feedback: TurnFeedback | undefined): (keyof typeof DECLARES)[] {
	// ⭐ L17b3 (D89) — struck with the fork: ~~`const theirs = holds.kind === 'PREDECESSOR' ? holds : holds.kind === 'THIS_UNIT' ? holds.predecessor :
	// undefined;`~~, ~~`if (theirs?.returnedAnswer === true) out.push('a turn on a session holding another unit’s answered conversation');`~~,
	// ~~`if (theirs?.heldFindings === true) out.push('a turn on a session holding another unit’s review findings');`~~
	const out: (keyof typeof DECLARES)[] = [];
	if (feedback?.crossUnit === true || (holds.kind === 'THIS_UNIT' && holds.crossUnitFeedback))
		out.push('a turn carrying D77’s feedback from another unit or the stage, or on a session that holds it');
	return out;
}

/** ⭐ L17b3 (D89) — the census's kinds a turn falls under from the record its session's tool reads: every turn of that session, whatever it keeps. */
function recordCensusOf(record: RecordOnHand | undefined): (keyof typeof DECLARES)[] {
	if (record?.toolMinted !== true) return [];
	const out: (keyof typeof DECLARES)[] = [];
	if (record.holds.answer) out.push('a turn of a session holding the record’s tool, the record holding an earlier unit’s answer');
	if (record.holds.findings) out.push('a turn of a session holding the record’s tool, the record holding findings or feedback an earlier unit was given');
	return out;
}

const ACTIVE: PromptTemplate = { templateText: 'Assess {subject}.', templateVersion: 1, declaredPlaceholders: ['subject'], status: 'ACTIVE' };
const ENVELOPE = JSON.stringify({ workProduct: { document: 'The work.' }, rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] } });

/** One shape of turn the step can send. */
interface Shape {
	readonly name: string;
	readonly priorFindings?: readonly { readonly code: string; readonly statement: string }[];
	readonly retainsHistory: boolean;
	readonly sessionHolds: SessionHolds;
	readonly carriedFindings?: readonly { readonly code: string; readonly statement: string }[];
	readonly feedback?: TurnFeedback;
	/** ⭐ A later try's: what its session held when the step began, and its first turn's feedback (the review's defect 1). */
	readonly stillHeld?: { readonly holds: SessionHolds; readonly feedback?: TurnFeedback };
	readonly acceptedWork: boolean;
	/** ⭐ L17b3 (D89) — what the record puts in reach, for a replacement's step; none for any other. */
	readonly record?: RecordOnHand;
	/** The entries of the census it falls under — none: it declares neither new pair. */
	readonly census: readonly (keyof typeof DECLARES)[];
}

const FINDING = [{ code: 'C1', statement: 'Requirement 3 has no acceptance criterion.' }];
// ⭐ L17b3 (D89) — struck with the fork: ~~`const PREDECESSOR = (returnedAnswer: boolean, heldFindings: boolean): HeldPredecessor => ({ title: 'Source',
// unitId: 'pwu_old', heldFindings, returnedAnswer });`~~
/** ⭐ L17b3 (D89) — the line's sentence a replacement's first turn ends with (D89's draft for a faulty unit's successor). */
const SENTENCE =
	'The unit this one replaces, "Source" (pwu_old), was worked on before, and its conversation is on the record. You can read it with the read_earlier_attempt tool. ' +
	'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, ' +
	'so that you do not try it again, unless something material has changed that would let it succeed now.';

/**
 * ⭐ RESTATED for the review's defects 1 and 8 — WHAT A SESSION CAN HOLD: nothing; the unit's own reopened file — its earlier try answered or not, an
 * earlier turn's cross-unit feedback or not~~, forked from a predecessor or not; a fork of a predecessor's conversation — answered or not, holding
 * findings or not~~. ⭐ L17b3 (D89): the fork's holdings struck — ~~`['not a fork', undefined]`, `['forked from an answered conversation',
 * PREDECESSOR(true, false)]`, `['forked from an answered conversation holding findings', PREDECESSOR(true, true)]`, `['forked from an unanswered
 * conversation holding findings', PREDECESSOR(false, true)]`~~, ~~`a forked session (answered …, holding findings …)`~~ — and the record's put beside
 * them (`RECORDS`).
 */
const HOLDINGS: readonly [string, SessionHolds][] = (() => {
	const out: [string, SessionHolds][] = [['a session holding nothing', { kind: 'NOTHING' }]];
	for (const returnedAnswer of [true, false])
		for (const crossUnitFeedback of [false, true])
			out.push([
				`the unit’s own reopened session (answered ${returnedAnswer}, holding cross-unit feedback ${crossUnitFeedback})`,
				{ kind: 'THIS_UNIT', returnedAnswer, ownFindings: false, crossUnitFeedback }
			]);
	return out;
})();
const FEEDBACKS: readonly [string, TurnFeedback | undefined][] = [
	['no feedback', undefined],
	['feedback of its own unit alone', { text: 'Holistic feedback — the loop so far.', crossUnit: false }],
	['feedback from another unit or the stage', { text: 'Holistic feedback — the round’s failed criteria.', crossUnit: true }]
];
/** ⭐ L17b3 (D89) — WHAT THE RECORD CAN PUT IN REACH: none (a unit that is not a replacement); a record with no tool; and a tool over a record holding an
 * earlier unit's answer, its findings, both or neither. */
const RECORDS: readonly [string, RecordOnHand | undefined][] = [
	['no record', undefined],
	['a record and no tool', { toolMinted: false, holds: { answer: true, findings: true } }],
	['the record’s tool over an answer', { sentence: SENTENCE, toolMinted: true, holds: { answer: true, findings: false } }],
	['the record’s tool over findings', { sentence: SENTENCE, toolMinted: true, holds: { answer: false, findings: true } }],
	['the record’s tool over an answer and findings', { sentence: SENTENCE, toolMinted: true, holds: { answer: true, findings: true } }],
	['the record’s tool over neither', { sentence: SENTENCE, toolMinted: true, holds: { answer: false, findings: false } }]
];
/** A later try's record: the same tool over the same record, its sentence said on the first turn alone. */
const laterTryRecord = (record: RecordOnHand | undefined): RecordOnHand | undefined =>
	record === undefined ? undefined : { toolMinted: record.toolMinted, holds: record.holds };

/** Every shape: each first turn — what its session holds, a re-run's findings, D77's feedback, accepted work ⭐ and the record in reach — and each later
 * try, on a session that keeps its history or not, holding what its session held when the step began and its first turn's feedback ⭐ and the record. */
const SHAPES: readonly Shape[] = (() => {
	const out: Shape[] = [];
	for (const [held, sessionHolds] of HOLDINGS)
		for (const carried of [false, true])
			for (const [fed, feedback] of FEEDBACKS)
				for (const acceptedWork of [false, true])
					for (const [recorded, record] of RECORDS)
						out.push({
							name: `a first turn on ${held}${carried ? ', carrying a re-run’s findings' : ''}, ${fed}, accepted work ${acceptedWork}, ${recorded}`,
							retainsHistory: true,
							sessionHolds,
							...(carried ? { carriedFindings: FINDING } : {}),
							...(feedback === undefined ? {} : { feedback }),
							acceptedWork,
							...(record === undefined ? {} : { record }),
							census: [...heldCensusOf(sessionHolds, feedback), ...recordCensusOf(record)]
						});
	for (const retainsHistory of [false, true])
		for (const [held, holds] of HOLDINGS)
			for (const [fed, feedback] of FEEDBACKS)
				for (const acceptedWork of [false, true])
					for (const [recorded, record] of RECORDS)
						out.push({
							name: `a later try (history ${retainsHistory}) on ${held}, its first turn’s ${fed}, accepted work ${acceptedWork}, ${recorded}`,
							priorFindings: FINDING,
							retainsHistory,
							sessionHolds: { kind: 'NOTHING' },
							stillHeld: { holds, ...(feedback === undefined ? {} : { feedback }) },
							acceptedWork,
							...(record === undefined ? {} : { record: laterTryRecord(record)! }),
							census: [...(retainsHistory ? heldCensusOf(holds, feedback) : []), ...recordCensusOf(record)]
						});
	return out;
})();

/** One step of a shape under `policy`: whether it ran, and the new pairs the ceiling named if it refused. */
async function underPolicy(shape: Shape, policy: ContextAssemblyPolicyContent): Promise<{ readonly ran: boolean; readonly refusedFor: string[] }> {
	let n = 0;
	const session = { ...oneShotSession(async () => ENVELOPE), retainsHistory: shape.retainsHistory };
	const out = await runModelInvocationStep({
		subject: { id: 'pwu_1', title: 'Route Assessment', description: 'Assess the route.' },
		subjectSemanticVersion: 1,
		pwuTypeId: 'pwut_1',
		template: ACTIVE,
		session,
		store: createInMemoryArtifactStore(),
		tenantPrefix: 'tnt-test',
		dispatchExchange: (_payload: RecordModelExchangePayload) => ({ status: 'ACCEPTED' }),
		newId: (prefix: string) => `${prefix}_${++n}`,
		now: () => '2026-11-16T10:00:00Z',
		modelId: 'test-model',
		providerId: 'test-provider',
		contextPolicy: policy,
		undertaking: undefined,
		acceptedWork: shape.acceptedWork ? [{ title: 'Specification', unitId: 'pwu_dep' }] : [],
		reviewCriteria: [],
		binding: { kind: 'NONE' },
		sessionHolds: shape.sessionHolds,
		...(shape.priorFindings ? { priorFindings: shape.priorFindings } : {}),
		...(shape.carriedFindings ? { carriedFindings: shape.carriedFindings } : {}),
		...(shape.feedback ? { feedback: shape.feedback } : {}),
		...(shape.stillHeld ? { stillHeld: shape.stillHeld } : {}),
		...(shape.record ? { earlierAttempt: shape.record } : {})
	} as never);
	if (out.ran) return { ran: true, refusedFor: [] };
	return { ran: false, refusedFor: NEW_PAIRS.filter((pair) => out.refusedBecause.includes(pair)) };
}

describe('⭐⭐ REG-D-170 — the census of the turns that declare the two new pairs', () => {
	// ⭐ STRENGTHENED 2026-11-18 (package L17b3 — the review's L17-20, §7.4 (1) and (2)): ~~`seen[shape.name] = r.ran ? [] : r.refusedFor;`~~, the base's
	// own form (`verif/context-pair-census.test.ts:185` at the base) — a turn refused for a reason that is neither new pair read the same as a turn that
	// ran. Each shape's outcome is compared WHOLE, `{ ran, refusedFor }`: a shape the census expects to declare neither pair must RUN, and one that
	// declares a pair must be refused for exactly its pairs.
	it('⛔ BY BEHAVIOUR — under ctx-default the turns refused for a new pair are exactly the census’s, each for its own pairs; every other turn runs as before — compared whole, `{ ran, refusedFor }`', async () => {
		const seen: Record<string, { readonly ran: boolean; readonly refusedFor: readonly string[] }> = {};
		const expected: Record<string, { readonly ran: boolean; readonly refusedFor: readonly string[] }> = {};
		for (const shape of SHAPES) {
			seen[shape.name] = await underPolicy(shape, DEFAULT_CONTEXT_ASSEMBLY_POLICY);
			const declared = new Set<string>(shape.census.flatMap((entry) => DECLARES[entry]));
			const refusedFor = NEW_PAIRS.filter((pair) => declared.has(pair));
			expected[shape.name] = { ran: refusedFor.length === 0, refusedFor };
		}
		expect(seen, 'a turn outside the census declares a new pair, or one in it declares another, or a turn the census expects to run was refused').toEqual(expected);
	});

	it('⭑ CONTROL — under ctx-default-loop, every shape of turn runs: the wider policy refuses none of them', async () => {
		const refused: string[] = [];
		for (const shape of SHAPES) if (!(await underPolicy(shape, LOOP_CONTEXT_ASSEMBLY_POLICY)).ran) refused.push(shape.name);
		expect(refused, 'the loop’s policy refused a turn').toEqual([]);
		expect(SHAPES.filter((s) => s.census.length > 0).length, 'arrangement: the census has turns in it').toBeGreaterThan(0);
	});

	// ⭐⭐ RESTATED 2026-11-18 (`JAN-EXEC` Phase 7, package L17b3 — design D89): its title's ~~'in crossUnitSources alone'~~ — the record's two
	// declarations are `recordSources`'s, which `crossUnitSources` and a later try's assembly (`turnAssembles`) both call. Its check, unchanged, was
	// always each file's count of declarations.
	it('⛔ BY SOURCE — the product declares either pair in ~~crossUnitSources alone~~ ⭐ run-model-step.ts alone (crossUnitSources, and recordSources since D89), and the policy states them in LOOP_CONTEXT_ASSEMBLY_POLICY alone', () => {
		const REPO = join(import.meta.dirname, '..');
		const roots = [join(REPO, 'apps', 'rph-demo', 'src'), join(REPO, 'packages')];
		const DECLARATION = /source:\s*'(PRIOR_RATIONALE|PRIOR_REVIEW_FINDING)',\s*scope:\s*'THIS_UNDERTAKING'/g;
		const found: Record<string, number> = {};
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) {
					if (!['node_modules', 'dist', '.svelte-kit', 'coverage'].includes(entry.name)) walk(path);
				} else if (/\.ts$/.test(entry.name) && !/\.(test|testing)\.ts$/.test(entry.name)) {
					const count = [...readFileSync(path, 'utf8').matchAll(DECLARATION)].length;
					if (count > 0) found[relative(REPO, path).replaceAll('\\', '/')] = count;
				}
			}
		};
		for (const root of roots) walk(root);
		expect(found, 'a new pair is declared or permitted somewhere the census does not name').toEqual({
			'apps/rph-demo/src/lib/server/execution/run-model-step.ts': 3,
			'packages/rph-application/src/context-assembly.ts': 2
		});
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173` (2)): the census's limb on the binding. A step is bound to the policy the page chose
	// for it before it dispatched (`contextPolicyIdForStep`): a replacement's (here, a shape with the record in reach), one carrying D77's feedback (its
	// first turn's, which its later tries keep), one on a session that holds it — the loop's; every other, `ctx-default`.
	it('⛔ RED FIRST — BY BINDING: each step whose turns declare a loop pair is bound to ctx-default-loop, and every step bound to ctx-default runs under it (D89)', async () => {
		const policyOf = (shape: Shape) =>
			contextPolicyIdForStep({
				replacement: shape.record !== undefined,
				carriesFeedback: shape.feedback !== undefined || shape.stillHeld?.feedback !== undefined,
				sessionHoldsFeedback: [shape.sessionHolds, shape.stillHeld?.holds].some((h) => h?.kind === 'THIS_UNIT' && h.crossUnitFeedback)
			});
		expect(
			SHAPES.filter((s) => s.census.length > 0 && policyOf(s) !== 'ctx-default-loop').map((s) => s.name),
			'a step whose turns declare a loop pair is bound to a narrower policy'
		).toEqual([]);
		const refusedUnderTheDefault: string[] = [];
		for (const shape of SHAPES.filter((s) => policyOf(s) === 'ctx-default'))
			if (!(await underPolicy(shape, DEFAULT_CONTEXT_ASSEMBLY_POLICY)).ran) refusedUnderTheDefault.push(shape.name);
		expect(refusedUnderTheDefault, 'a step bound to ctx-default declares a pair it does not hold').toEqual([]);
		expect(SHAPES.filter((s) => policyOf(s) === 'ctx-default').length, 'arrangement: some steps are bound to ctx-default').toBeGreaterThan(0);
	});
});
