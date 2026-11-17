// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — `REG-D-170` (the lead's delegated ruling, flagged for the sponsor's confirmation), item 4 — THE CENSUS OF THE TWO
// PAIRS THE DEFECT LOOP WIDENS THE CONTEXT POLICY BY: `PRIOR_RATIONALE` and `PRIOR_REVIEW_FINDING` at `THIS_UNDERTAKING`.
//
// ⭑ WHY A CENSUS (the ruling, from the lead's check of its draft): every binding minted since package L17b1 names the wider policy
// (`ctx-default-loop`), so the ceiling no longer refuses either pair on any new step. What keeps the widening to the loop is that ONLY TWO TURNS
// DECLARE EITHER PAIR — a forked successor's first turn (its predecessor's work product and rationale, and its findings where its session held a
// repair turn), and a turn carrying D77's feedback from another unit or the assurance stage — and every other turn is declared byte for byte as
// before. This census holds that, two ways:
//   1. BY BEHAVIOUR: every shape of turn the step can send is run under `ctx-default` — the five pairs, neither new one — and the turns it refuses
//      for a new pair must be exactly the two named below; under `ctx-default-loop`, every shape runs.
//   2. BY SOURCE: the product's sources declare either pair in one function alone, `crossUnitSources` (`run-model-step.ts`), and the policy states
//      them in one place, `LOOP_CONTEXT_ASSEMBLY_POLICY` (`context-assembly.ts`); a declaration written anywhere else reddens this, naming it.
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
import {
	runModelInvocationStep,
	type HeldPredecessor,
	type SessionHolds,
	type TurnFeedback
} from '../apps/rph-demo/src/lib/server/execution/run-model-step.js';

const NEW_PAIRS = ['PRIOR_RATIONALE at THIS_UNDERTAKING', 'PRIOR_REVIEW_FINDING at THIS_UNDERTAKING'] as const;

/**
 * ⭑ THE CENSUS: each turn that declares a new pair, and which. Any other turn declares neither. ⭐ RESTATED for the independent review's defects 1 and 8:
 * a turn declares what its session HOLDS, not only what its first turn carries — a forked successor's first turn, a later try on a forked session or
 * after a cross-unit first turn, and a later step on a reopened fork; and another unit's rationale only where its conversation returned a work product.
 * ~~'a forked successor’s first turn'~~, ~~'… its history holding findings'~~, ~~'a turn carrying D77’s feedback …'~~ — the three kinds below, by what
 * the session holds.
 */
const DECLARES = {
	'a turn on a session holding another unit’s answered conversation': ['PRIOR_RATIONALE at THIS_UNDERTAKING'],
	'a turn on a session holding another unit’s review findings': ['PRIOR_REVIEW_FINDING at THIS_UNDERTAKING'],
	'a turn carrying D77’s feedback from another unit or the stage, or on a session that holds it': ['PRIOR_REVIEW_FINDING at THIS_UNDERTAKING']
} as const;

/** The census's kinds a turn falls under, from what its session holds and the feedback it carries or holds. */
function censusOf(holds: SessionHolds, feedback: TurnFeedback | undefined): (keyof typeof DECLARES)[] {
	const theirs = holds.kind === 'PREDECESSOR' ? holds : holds.kind === 'THIS_UNIT' ? holds.predecessor : undefined;
	const out: (keyof typeof DECLARES)[] = [];
	if (theirs?.returnedAnswer === true) out.push('a turn on a session holding another unit’s answered conversation');
	if (theirs?.heldFindings === true) out.push('a turn on a session holding another unit’s review findings');
	if (feedback?.crossUnit === true || (holds.kind === 'THIS_UNIT' && holds.crossUnitFeedback))
		out.push('a turn carrying D77’s feedback from another unit or the stage, or on a session that holds it');
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
	/** The entries of the census it falls under — none: it declares neither new pair. */
	readonly census: readonly (keyof typeof DECLARES)[];
}

const FINDING = [{ code: 'C1', statement: 'Requirement 3 has no acceptance criterion.' }];
const PREDECESSOR = (returnedAnswer: boolean, heldFindings: boolean): HeldPredecessor => ({ title: 'Source', unitId: 'pwu_old', heldFindings, returnedAnswer });

/**
 * ⭐ RESTATED for the review's defects 1 and 8 — WHAT A SESSION CAN HOLD: nothing; the unit's own reopened file — its earlier try answered or not, an
 * earlier turn's cross-unit feedback or not, forked from a predecessor or not; a fork of a predecessor's conversation — answered or not, holding
 * findings or not.
 */
const HOLDINGS: readonly [string, SessionHolds][] = (() => {
	const out: [string, SessionHolds][] = [['a session holding nothing', { kind: 'NOTHING' }]];
	const forks: readonly [string, HeldPredecessor | undefined][] = [
		['not a fork', undefined],
		['forked from an answered conversation', PREDECESSOR(true, false)],
		['forked from an answered conversation holding findings', PREDECESSOR(true, true)],
		['forked from an unanswered conversation holding findings', PREDECESSOR(false, true)]
	];
	for (const returnedAnswer of [true, false])
		for (const crossUnitFeedback of [false, true])
			for (const [forkName, predecessor] of forks)
				out.push([
					`the unit’s own reopened session (answered ${returnedAnswer}, holding cross-unit feedback ${crossUnitFeedback}, ${forkName})`,
					{ kind: 'THIS_UNIT', returnedAnswer, ownFindings: false, crossUnitFeedback, ...(predecessor === undefined ? {} : { predecessor }) }
				]);
	for (const [returnedAnswer, heldFindings] of [
		[true, false],
		[true, true],
		[false, false],
		[false, true]
	] as const)
		out.push([`a forked session (answered ${returnedAnswer}, holding findings ${heldFindings})`, { kind: 'PREDECESSOR', ...PREDECESSOR(returnedAnswer, heldFindings) }]);
	return out;
})();
const FEEDBACKS: readonly [string, TurnFeedback | undefined][] = [
	['no feedback', undefined],
	['feedback of its own unit alone', { text: 'Holistic feedback — the loop so far.', crossUnit: false }],
	['feedback from another unit or the stage', { text: 'Holistic feedback — the round’s failed criteria.', crossUnit: true }]
];

/** Every shape: each first turn — what its session holds, a re-run's findings, D77's feedback, accepted work — and each later try, on a session that keeps
 * its history or not, holding what its session held when the step began and its first turn's feedback. */
const SHAPES: readonly Shape[] = (() => {
	const out: Shape[] = [];
	for (const [held, sessionHolds] of HOLDINGS)
		for (const carried of [false, true])
			for (const [fed, feedback] of FEEDBACKS)
				for (const acceptedWork of [false, true])
					out.push({
						name: `a first turn on ${held}${carried ? ', carrying a re-run’s findings' : ''}, ${fed}, accepted work ${acceptedWork}`,
						retainsHistory: true,
						sessionHolds,
						...(carried ? { carriedFindings: FINDING } : {}),
						...(feedback === undefined ? {} : { feedback }),
						acceptedWork,
						census: censusOf(sessionHolds, feedback)
					});
	for (const retainsHistory of [false, true])
		for (const [held, holds] of HOLDINGS)
			for (const [fed, feedback] of FEEDBACKS)
				for (const acceptedWork of [false, true])
					out.push({
						name: `a later try (history ${retainsHistory}) on ${held}, its first turn’s ${fed}, accepted work ${acceptedWork}`,
						priorFindings: FINDING,
						retainsHistory,
						sessionHolds: { kind: 'NOTHING' },
						stillHeld: { holds, ...(feedback === undefined ? {} : { feedback }) },
						acceptedWork,
						census: retainsHistory ? censusOf(holds, feedback) : []
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
		...(shape.stillHeld ? { stillHeld: shape.stillHeld } : {})
	} as never);
	if (out.ran) return { ran: true, refusedFor: [] };
	return { ran: false, refusedFor: NEW_PAIRS.filter((pair) => out.refusedBecause.includes(pair)) };
}

describe('⭐⭐ REG-D-170 — the census of the turns that declare the two new pairs', () => {
	it('⛔ BY BEHAVIOUR — under ctx-default the turns refused for a new pair are exactly the census’s, each for its own pairs; every other turn runs as before', async () => {
		const seen: Record<string, readonly string[]> = {};
		const expected: Record<string, readonly string[]> = {};
		for (const shape of SHAPES) {
			const r = await underPolicy(shape, DEFAULT_CONTEXT_ASSEMBLY_POLICY);
			seen[shape.name] = r.ran ? [] : r.refusedFor;
			const declared = new Set<string>(shape.census.flatMap((entry) => DECLARES[entry]));
			expected[shape.name] = NEW_PAIRS.filter((pair) => declared.has(pair));
		}
		expect(seen, 'a turn outside the census declares a new pair, or one in it declares another').toEqual(expected);
	});

	it('⭑ CONTROL — under ctx-default-loop, every shape of turn runs: the wider policy refuses none of them', async () => {
		const refused: string[] = [];
		for (const shape of SHAPES) if (!(await underPolicy(shape, LOOP_CONTEXT_ASSEMBLY_POLICY)).ran) refused.push(shape.name);
		expect(refused, 'the loop’s policy refused a turn').toEqual([]);
		expect(SHAPES.filter((s) => s.census.length > 0).length, 'arrangement: the census has turns in it').toBeGreaterThan(0);
	});

	it('⛔ BY SOURCE — the product declares either pair in crossUnitSources alone, and the policy states them in LOOP_CONTEXT_ASSEMBLY_POLICY alone', () => {
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
});
