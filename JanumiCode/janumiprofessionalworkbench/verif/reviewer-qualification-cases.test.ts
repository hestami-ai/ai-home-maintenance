// ⭐ `JAN-CRITREAD` J2-1 — REVIEWER-QUALIFICATION CASE SET VERSION ONE, AND WHAT IT MUST BE BEFORE ANYTHING IS
// MEASURED WITH IT (DESIGN-what-the-tests-prove.md §5.2; ROADMAP J2-1). ⭐ And, since J2-5, VERSION TWO (`REG-F-449`;
// `REG-D-078`) — the block after them: every limb above, and that it is version one with the correction and nothing else.
// ⭐ And, since J2-7, VERSION THREE (`REG-F-453`; `REG-D-081`) — the block at the end: every limb above, and that it is
// version two with the sponsor's two changes — the foundations and the permit's inputs — and nothing else.
//
// A qualification run is only as good as its cases: a case the reviewer is not shown whole, a "renamed" copy that
// differs in more than names, a clean case built from a graph production could not hold, or an oracle whose
// disposition its own criteria cannot compose, would each turn a reviewer's measured failure into the case's. Each
// limb below is one of those, checked before the first run rather than discovered in it.
//
//   · THE DATA IS GENERATED — the committed JSON is exactly what `scripts/reviewer-qual/generate.ts` writes.
//   · THE SHAPE — per arm: one clean case, three renamed copies, one planted defect per seeded criterion; one oracle
//     per case, versioned separately.
//   · RENAMED MEANS RENAMED — each copy IS its clean case with the names substituted, and nothing else.
//   · PRODUCTION'S GRAPH — each graph case, put into an engine through the commands an author uses, exports exactly
//     the literal nodes (keys in production's order, production-shaped ids).
//   · NO ID READS AS A WORD — no id spells out that the subject was constructed.
//   · THE PRODUCER (`REG-D-072` D13) — every case carries the one producer model no candidate reviewer is.
//   · THE 28,000-CHARACTER LIMIT — every prompt a case can send, initial and repair, fits `agy`'s argv budget.
//   · SEEN WHOLE — no slice of any case is truncated to fit, so an oracle is never about bytes the reviewer did not see.
//   · THE ORACLES COMPOSE — a reply faulting exactly a case's oracle criteria scores to the oracle's disposition,
//     through the real validator and `composeAssuranceOutcome` over the Reasoning Review reference alone.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { analyzePwaGraph, buildPwaGraphExport } from '@janumipwb/rph-projections';
import { createEngine } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { MAX_AGY_PROMPT_CHARS } from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { createAgyReasoningReviewValidator } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../apps/rph-demo/src/lib/server/identity.js';
import { buildPwaExport } from '../apps/rph-demo/src/lib/server/workbench.js';
import {
	CASE_PRODUCER_MODEL_ID,
	CASE_SET_V1_FILE,
	CASE_SET_V2_FILE,
	CASE_SET_V3_FILE,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	ORACLES_V3_FILE,
	serializeGenerated,
	type CaseSet,
	type GraphCase,
	type OracleSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import { CASE_SET_V1, RENAMES_V1 } from '../scripts/reviewer-qual/case-set-v1.js';
import { CASE_SET_V2, clayUncertainty, CORRECTED_IN_V2, RENAMES_V2 } from '../scripts/reviewer-qual/case-set-v2.js';
import { CASE_SET_V3, CHANGED_IN_V3, RENAMES_V3 } from '../scripts/reviewer-qual/case-set-v3.js';
import { ORACLES_V1 } from '../scripts/reviewer-qual/oracles-v1.js';
import { ORACLES_V2 } from '../scripts/reviewer-qual/oracles-v2.js';
import { ORACLES_V3 } from '../scripts/reviewer-qual/oracles-v3.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (file: string): string => readFileSync(`${REPO_ROOT}${file}`, 'utf8');

/** The committed files, as the runner will read them — never the generator's in-memory values. */
const committedCases = (): CaseSet => JSON.parse(read(CASE_SET_V1_FILE)) as CaseSet;
const committedOracles = (): OracleSet => JSON.parse(read(ORACLES_V1_FILE)) as OracleSet;

const CRITERION_IDS = SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id);
/** The planted cases whose required criterion a competent reviewer could contest, so each is the author's claim
 *  (`oracles-v1.ts` says why): W-RR-03's central-20 m arrangement could be filed under RR-06 or RR-07 instead. */
const CONTESTABLE_PLANTED: ReadonlySet<string> = new Set(['W-RR-03']);
const ARMS = ['PWA_GRAPH', 'WORK_PRODUCT'] as const;
const EVALUATOR = { agentId: 'agy', modelId: 'test-judge-model', providerId: 'google' } as const;

/**
 * ⭐ `JAN-PRQUAL` `PQ-1` (design D2; the sponsor's answer (a) of 2026-10-03) — HOW A CUT IS DECLARED, in every framing:
 * `[CUT FOR THIS REVIEW: <slice> — …]`, on its own line BEFORE the bytes it cut. ~~`…(truncated)`~~, the marker the
 * validator appended after the bytes until `PQ-1`, can no longer occur — so every SEEN WHOLE guard below keyed on it was
 * VACUOUS from that change until re-keyed here, and the control beside the v1 guard shows this key is the product's.
 */
const CUT_DECLARED = '[CUT FOR THIS REVIEW: ';

/** Every prompt the REAL validator sends for a case: the first, then — when the first reply is unusable — the repair. */
async function promptsFor(c: QualificationCase): Promise<{ initial: string; repair: string; input: ReasoningReviewInput }> {
	const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
	const prompts: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		...EVALUATOR,
		print: async (prompt) => {
			prompts.push(prompt);
			// An unusable first reply, so the repair prompt — the initial one plus a suffix outside the budget — is sent too.
			return prompts.length === 1
				? 'not a judgement'
				: JSON.stringify({
						findings: input.criteria.map((k) => ({ criterionId: k.id, failed: false, statement: 'absent' })),
						recommendation: 'SATISFIED'
					});
		}
	});
	await validator.evaluate(c.subject, { reasoningReview: input });
	expect(prompts, `${c.id}: an initial prompt and a repair`).toHaveLength(2);
	return { initial: prompts[0]!, repair: prompts[1]!, input };
}

/**
 * RENAMED MEANS RENAMED over `cases`: each `-CLEAN-R<n>` copy IS its clean case with the names `renames` declares
 * substituted, and nothing else — and the names really did change. (Version one's limb, shared with version two's.)
 */
function expectRenamedOnly(
	cases: readonly QualificationCase[],
	renames: Readonly<Record<string, { readonly from: readonly string[]; readonly to: readonly string[] }>>
): void {
	const byId = new Map(cases.map((c) => [c.id, c]));
	const copies = cases.filter((c) => /-CLEAN-R\d$/.test(c.id));
	expect(copies).toHaveLength(6);
	for (const copy of copies) {
		const rename = renames[copy.id];
		expect(rename, `${copy.id} declares its names`).toBeDefined();
		const { from, to } = rename!;
		const original = byId.get(copy.id.replace(/-R\d$/, ''))!;
		// Longest name first, in ONE pass, so a name inside another is never substituted twice.
		const order = from.map((_, i) => i).sort((a, b) => from[b]!.length - from[a]!.length);
		const pattern = new RegExp(order.map((i) => from[i]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
		const substituted = JSON.stringify({ ...original, id: copy.id }).replace(pattern, (m) => to[from.indexOf(m)]!);
		expect(substituted, copy.id).toBe(JSON.stringify(copy));
		// And the names really did change — a copy identical to its original would pass the line above.
		for (const [i, name] of from.entries()) {
			expect(to[i], `${copy.id}: ${name}`).not.toBe(name);
			expect(JSON.stringify(copy).includes(name), `${copy.id} still carries "${name}"`).toBe(false);
		}
	}
}

/**
 * PRODUCTION'S GRAPH for one graph case: production-shaped ids and key order; well formed and coherent by the product's
 * own analyzer; and, defined in an engine through the commands an author uses, production's export is the literal one
 * byte for byte. (Version one's limb, shared with version two's.)
 */
function expectProductionsGraph(c: GraphCase): void {
	for (const n of c.input.nodes) {
		expect(n.id, `${c.id}: a production-shaped PWU-Type id`).toMatch(/^pwut_[0-9A-HJKMNP-TV-Z]{26}$/);
		expect(Object.keys(n), `${c.id}/${n.name}: production's key order`).toEqual([
			'id',
			'name',
			'pwuKind',
			'isRoot',
			'permittedChildTypeIds',
			'requiredInputs',
			'requiredOutputs',
			'executionBoundary'
		]);
	}
	expect(c.input.pwa.id).toMatch(/^pwa_[0-9A-HJKMNP-TV-Z]{26}$/);
	// Well formed and coherent by the product's own analyzer, so a planted defect is about REASONING and never
	// a structural fault the schema floor would report first (the draft's RR-04 left a node orphaned).
	const report = analyzePwaGraph(buildPwaGraphExport(c.input.pwa, c.input.nodes));
	expect([report.valid, report.coherent], `${c.id}: well formed and coherent`).toEqual([true, true]);
	let seq = 0;
	const session = createEngine({
		authenticate: standaloneAuthenticator(),
		ontology,
		now: () => '2026-09-24T09:00:00Z',
		newEventId: () => `evt_${++seq}`
	}).as(SESSION_CREDENTIAL);
	const send = (commandType: string, type: string, target: string, payload: unknown) => {
		seq += 1;
		const command: DomainCommand = {
			commandId: `cmd-${seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: target,
			issuedAt: '2026-09-24T09:00:00Z',
			correlationId: c.id,
			idempotencyKey: `idem-${seq}`,
			payload
		};
		const r = session.dispatch(command);
		expect(r.status, `${c.id}: ${commandType} ${target} — ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
	};
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', c.input.pwa.id, {
		pwaId: c.input.pwa.id,
		name: c.input.pwa.name,
		description: 'A reviewer-qualification case.',
		domain: c.input.pwa.domain,
		version: c.input.pwa.version
	});
	for (const n of c.input.nodes)
		send('DefinePwuType', 'PWU_TYPE', n.id, {
			pwuTypeId: n.id,
			pwaId: c.input.pwa.id,
			pwuKind: n.pwuKind,
			name: n.name,
			purpose: n.name,
			isRoot: n.isRoot,
			permittedChildTypeIds: [...n.permittedChildTypeIds],
			requiredInputs: [...n.requiredInputs],
			requiredOutputs: [...n.requiredOutputs],
			executionBoundary: n.executionBoundary,
			...(n.executionBoundary === 'DELEGATED_EXTERNAL'
				? { boundaryContract: { counterpartyLabel: 'An independent checking firm', attestedAssurancePolicyIds: [] } }
				: {})
		});
	expect(JSON.stringify(buildPwaExport(c.input.pwa.id, session)), c.id).toBe(
		JSON.stringify(buildPwaGraphExport(c.input.pwa, c.input.nodes))
	);
	session.close();
}

describe('JAN-CRITREAD J2-1 — reviewer-qualification case set v1', () => {
	it('⛔ the committed case set and oracles are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V1_FILE);
		const oracles = read(ORACLES_V1_FILE);
		expect(cases, `${CASE_SET_V1_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V1)
		);
		expect(oracles, `${ORACLES_V1_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V1)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
	});

	it('⭐ the shape — per arm, a clean case, three renamed copies and one planted defect per seeded criterion', () => {
		const { cases, caseSetVersion } = committedCases();
		expect(caseSetVersion).toBe(1);
		expect(new Set(cases.map((c) => c.id)).size, 'case ids are unique').toBe(cases.length);
		for (const arm of ARMS) {
			const p = arm === 'PWA_GRAPH' ? 'G' : 'W';
			expect(
				cases.filter((c) => c.arm === arm).map((c) => c.id),
				`${arm}: the clean case, its renamed copies, then one planted case per criterion`
			).toEqual([
				`${p}-CLEAN`,
				`${p}-CLEAN-R1`,
				`${p}-CLEAN-R2`,
				`${p}-CLEAN-R3`,
				...CRITERION_IDS.map((k) => `${p}-${k.slice(0, 5)}`)
			]);
		}
		expect(cases).toHaveLength(26);
	});

	it('⭐ one oracle per case, versioned separately: the planted criterion REJECTED and uncontested (W-RR-03 the author’s claim), a clean case SATISFIED as the author’s claim', () => {
		const { cases } = committedCases();
		const set = committedOracles();
		expect(set.oracleVersion).toBe(1);
		expect(set.caseSetVersion, 'the oracles name the case set they judge').toBe(committedCases().caseSetVersion);
		expect(set.oracles.map((o) => o.caseId)).toEqual(cases.map((c) => c.id));
		for (const o of set.oracles) {
			for (const k of o.faulted) expect(CRITERION_IDS, `${o.caseId}: ${k} is a policy criterion`).toContain(k);
			const planted = /-RR-\d\d$/.exec(o.caseId);
			if (planted) {
				expect(o.faulted, o.caseId).toEqual([CRITERION_IDS.find((k) => k.startsWith(planted[0].slice(1)))]);
				expect(o.disposition, o.caseId).toBe('REJECTED');
				expect(o.expectation, o.caseId).toBe(CONTESTABLE_PLANTED.has(o.caseId) ? "the author's claim" : 'uncontested');
			} else {
				expect(o.faulted, o.caseId).toEqual([]);
				expect(o.disposition, o.caseId).toBe('SATISFIED');
				expect(o.expectation, o.caseId).toBe("the author's claim");
			}
			expect(o.note.length, `${o.caseId}: the oracle says what the case plants`).toBeGreaterThan(20);
		}
	});

	it('⛔ RENAMED MEANS RENAMED — each copy is its clean case with the names substituted, and nothing else', () => {
		expectRenamedOnly(committedCases().cases, RENAMES_V1);
	});

	it('⭐ PRODUCTION’S GRAPH — every graph case, defined in an engine by an author’s commands, exports exactly its literal nodes', () => {
		const graphs = committedCases().cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH');
		expect(graphs).toHaveLength(13);
		for (const c of graphs) expectProductionsGraph(c);
	});

	it('⛔ NO ID READS AS A WORD — every id a case carries is a production-shaped ULID with no run of three letters', () => {
		// An id that spells "CASE" or "GRPH" tells the reviewer its subject was constructed, which a live subject never
		// does. Crockford base32 already drops I, L, O and U; no three letters together leaves no word to read.
		const ids = new Set<string>();
		for (const c of committedCases().cases) {
			const found = [...JSON.stringify(c).matchAll(/\b(?:pwa|pwut|art)_[0-9A-Z]+\b/g)].map((m) => m[0]);
			expect(found.length, `${c.id}: the case carries its ids`).toBeGreaterThan(0);
			for (const x of found) ids.add(x);
		}
		const readable = [...ids].filter(
			(x) => !/^[a-z]+_[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(x) || /[A-HJKMNP-TV-Z]{3}/.test(x.slice(x.indexOf('_') + 1))
		);
		expect(readable.join(', '), 'ids that are not a ULID, or that a reviewer could read').toBe('');
		// One PWA, its eleven PWU-Types and one artifact — the census saw every id the set defines.
		expect(ids.size).toBe(13);
	});

	it('⭐ the producer is the one no candidate reviewer is — and the subject is the case’s own (REG-D-072 D13)', () => {
		for (const c of committedCases().cases) {
			expect(c.subject.producer?.modelId, c.id).toBe(CASE_PRODUCER_MODEL_ID);
			expect(c.subject.isAiProduced, c.id).toBe(true);
			expect(c.subject.semanticVersion, c.id).toBe(1);
			if (c.arm === 'PWA_GRAPH') {
				expect(c.subject.subjectId, c.id).toBe(c.input.pwa.id);
				expect(c.subject.objectType, c.id).toBe('PROFESSIONAL_WORK_ARCHITECTURE');
			} else {
				expect(c.subject.objectType, c.id).toBe('ARTIFACT');
				expect(c.subject.producer?.agentId, c.id).toBe(`execution.model-invocation:${c.subject.subjectId}`);
			}
		}
	});

	it('⛔ THE 28,000-CHARACTER LIMIT — every prompt a case can send, the initial and the repair, fits agy’s argv budget', async () => {
		const sizes: string[] = [];
		for (const c of committedCases().cases) {
			const { initial, repair } = await promptsFor(c);
			for (const [role, prompt] of [
				['initial', initial],
				['repair', repair]
			] as const)
				if (prompt.length > MAX_AGY_PROMPT_CHARS) sizes.push(`${c.id} ${role}: ${prompt.length} chars`);
		}
		expect(sizes.join('\n'), `prompts over the ${MAX_AGY_PROMPT_CHARS}-character limit`).toBe('');
	});

	it('⛔ SEEN WHOLE — no slice of any case is truncated to fit, so no oracle is about bytes the reviewer did not see', async () => {
		const cut: string[] = [];
		for (const c of committedCases().cases) {
			const { initial, input } = await promptsFor(c);
			if (initial.includes(CUT_DECLARED)) cut.push(`${c.id}: a slice is truncated`);
			if (!initial.includes(input.content)) cut.push(`${c.id}: the content is not whole`);
			if (!initial.includes(input.prompt)) cut.push(`${c.id}: the instruction is not whole`);
		}
		expect(cut.join('\n')).toBe('');
		// ⭐ `PQ-1` — CONTROL: the key is what the product writes when it cuts. The first case, its content and its
		// instruction each made longer than any budget, is cut — and the guard's key is in its prompt, once per slice.
		const first = committedCases().cases[0]!;
		const over = 'x'.repeat(30_000);
		const oversize: QualificationCase =
			first.arm === 'PWA_GRAPH'
				? { ...first, input: { ...first.input, prompt: over, pwa: { ...first.input.pwa, name: over } } }
				: { ...first, input: { ...first.input, producingPrompt: over, answer: over } };
		const control = (await promptsFor(oversize)).initial;
		expect(control.split(CUT_DECLARED).length - 1, 'CONTROL: an oversize instruction and content are each declared cut').toBe(2);
	});

	it('⭐ THE ORACLES COMPOSE — a reply faulting exactly the oracle’s criteria scores to its disposition, with independence met', async () => {
		const oracles = new Map(committedOracles().oracles.map((o) => [o.caseId, o]));
		for (const c of committedCases().cases) {
			const oracle = oracles.get(c.id)!;
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const validator = createAgyReasoningReviewValidator({
				...EVALUATOR,
				print: async () =>
					JSON.stringify({
						findings: input.criteria.map((k) => ({
							criterionId: k.id,
							failed: oracle.faulted.includes(k.id),
							statement: 'as the oracle expects',
							severity: oracle.faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
						})),
						recommendation: oracle.disposition
					})
			});
			const result = await validator.evaluate(c.subject, { reasoningReview: input });
			// Over the Reasoning Review policy's reference ALONE (floor.ts:56) — no fact for the other two is fabricated.
			const plan = deMinimisFloorPlan(c.subject).filter((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
			expect(plan, c.id).toHaveLength(1);
			const outcome = composeAssuranceOutcome(c.subject, plan, [result]);
			expect(outcome.perPolicy[0]?.independenceOk, `${c.id}: the case producer is independent of the evaluator`).toBe(true);
			expect(outcome.perPolicy[0]?.disposition, c.id).toBe(oracle.disposition);
		}
	});
});

// ── ⭐ `JAN-CRITREAD` J2-5 — CASE SET VERSION TWO (`REG-F-449`; the sponsor's ruling `REG-D-078`) ───────────────────
//
// Version one's graph arm is built on one draft whose geotechnical report — the 3 m soft-clay layer at the north
// abutment — reached the load analysis and the design but not the structural-form options study nor the independent
// check. The frontier candidate rejected the clean case in 7 of its 8 evaluations, and 6 of the 7 rejections cite that
// routing (`REG-F-449`; the seventh, G-CLEAN-R3 #2, cites none of it). Version two corrects the ROUTING and nothing else,
// in EVERY graph case built on the draft (the planted ones too, so each plants one defect, not its own and the draft's):
// the report reaches both, the account says so in the fewest sentences that name the report's consumers, and each
// changed case takes a new id (`cases.ts`: a case that changes gets a new id — the check reads "content unchanged" as the
// id). Every other case is version one's. ⚠ The record's other grounds — rail-specific inputs, no type that designs the
// foundations, the check's independence by parallel derivation — are NOT corrected: version two adds no input, no type
// and no claim for them (no type designs the foundations, so the account says nothing checks them). They are left for
// the measurement.
//
// ⚠ THESE LIMBS READ VERSION TWO AS THE GENERATOR WRITES IT (the JSON round trip of its value), where version one's
// read the committed file. The freshness limb holds the committed file to exactly those bytes, so the two readings are
// one whenever this file is green — and a change to the source then shows in the limb it breaks, not only as staleness.
// ⚠ THE EXPECTED TEXT BELOW IS WRITTEN HERE, not imported: the diff limb states what the correction is independently of
// the source that makes it — every sentence it may change, listed per case.

const committedV2 = (): CaseSet => JSON.parse(read(CASE_SET_V2_FILE)) as CaseSet;
const generatedV2 = (): CaseSet => JSON.parse(serializeGenerated(CASE_SET_V2)) as CaseSet;
const generatedOraclesV2 = (): OracleSet => JSON.parse(serializeGenerated(ORACLES_V2)) as OracleSet;

const REPORT = 'geotechnical-report';
/** The kinds the report is routed to — the options study and the independent check — in every case that has them. */
const ROUTED_KINDS: ReadonlySet<string> = new Set(['OPTIONS_STUDY', 'INDEPENDENT_CHECK']);
/** One sentence the correction rewrites: the words version one wrote, and version two's in their place. */
type SentenceDiff = readonly [was: string, now: string];
/** The options study's sentence, after its name: it compares the forms against the geotechnical report too — no more. */
const FORM: SentenceDiff = [
	' compares the viable structural forms against the site survey and selects one.',
	' compares the viable structural forms against the site survey and the geotechnical report, and selects one.'
];
/** The check's sentence's end — the delegated check's and G-RR-07's self-check's alike: it also consumes the report. */
const CHECK: SentenceDiff = [
	'it certifies the design calculations and drawings.',
	'it certifies the design calculations and drawings, and also consumes the geotechnical report.'
];
/** The soft-clay residual uncertainty, naming the types that consume the report. */
const CLAY = (consumers: string): string =>
	'The soft clay layer 3 m below the north abutment may require piled foundations; the geotechnical report will ' +
	`decide, which is why ${consumers} consume it.`;
const CLAY_V1 = CLAY('the load analysis and the design both');
/** The soft-clay sentence of a graph where all four types consume the report. */
const CLAY_ALL: SentenceDiff = [CLAY_V1, CLAY('the options study, the load analysis, the design and the independent check all')];

/** What the correction may change in a corrected case's account (`rationale`) and in its residual uncertainty. */
interface AllowedDiffs {
	/** Sentence ENDS, after the type's name (which a renamed copy changes); in the account's order. */
	readonly account: readonly SentenceDiff[];
	/** Whole sentences. */
	readonly uncertainty: readonly SentenceDiff[];
}
const EVERY: AllowedDiffs = { account: [FORM, CHECK], uncertainty: [CLAY_ALL] };
/**
 * ⭐ THE ALLOWED SENTENCE DIFFS, LISTED PER CORRECTED CASE. The correction is the report's routing and the fewest
 * sentences that name its consumers (`JAN-CRITREAD` J2-5, under the sponsor's delegation). No other sentence of a
 * corrected case — account, assumption, limitation or residual uncertainty — may differ from its version-one case's.
 */
const ALLOWED: Readonly<Record<string, AllowedDiffs>> = {
	'G2-CLEAN': EVERY,
	'G2-CLEAN-R1': EVERY,
	'G2-CLEAN-R2': EVERY,
	'G2-CLEAN-R3': EVERY,
	// No independent check (the plant): no check sentence to restate, and the soft-clay sentence names none.
	'G2-RR-02': { account: [FORM], uncertainty: [[CLAY_V1, CLAY('the options study, the load analysis and the design all')]] },
	'G2-RR-03': EVERY,
	'G2-RR-04': EVERY,
	// No options study (the plant): no form sentence to restate, and the soft-clay sentence names none.
	'G2-RR-05': {
		account: [CHECK],
		uncertainty: [[CLAY_V1, CLAY('the load analysis, the design and the independent check all')]]
	},
	// Version one's account of the case sets the clay aside (the plant) and carries no soft-clay sentence to restate.
	'G2-RR-06': { account: [FORM, CHECK], uncertainty: [] },
	// The design team's own check (the plant), named as version one's account of the case already names it — "the
	// independent check", its permit sentence's words — so what the correction adds is the clean case's, word for word.
	'G2-RR-07': EVERY,
	// Version one's account of the case leaves the clay out (the plant) and carries no soft-clay sentence to restate.
	'G2-RR-08': { account: [FORM, CHECK], uncertainty: [] },
	// Version one's account describes no type (the plant): only the routing moves.
	'G2-RR-09': { account: [], uncertainty: [] }
};
/** How a soft-clay sentence names each kind that consumes the report. */
const CONSUMER_KIND: Readonly<Record<string, string>> = {
	'the options study': 'OPTIONS_STUDY',
	'the load analysis': 'LOAD_ANALYSIS',
	'the design': 'DETAILED_DESIGN',
	'the independent check': 'INDEPENDENT_CHECK'
};

/** The sentences of an account, in order — each ends at a full stop (no name or figure in a graph account holds one). */
const sentencesOf = (account: string): string[] => account.split(/(?<=\.) /);
/** The pairs of sentences that differ, in order, between two lists the correction must keep the same length. */
function changedSentences(was: readonly string[], now: readonly string[], label: string): SentenceDiff[] {
	expect(now.length, `${label}: the correction adds and removes no sentence`).toBe(was.length);
	return was.flatMap((s, i) => (s === now[i] ? [] : [[s, now[i]!] as const]));
}
/** The fewest characters that turn `was` into `now`: what goes, and what is put in its place. */
function minimalEdit([was, now]: SentenceDiff): { readonly removed: string; readonly inserted: string } {
	let p = 0;
	while (p < was.length && p < now.length && was[p] === now[p]) p += 1;
	let s = 0;
	while (s < was.length - p && s < now.length - p && was[was.length - 1 - s] === now[now.length - 1 - s]) s += 1;
	return { removed: was.slice(p, was.length - s), inserted: now.slice(p, now.length - s) };
}
/** The names a soft-clay sentence lists as consuming the report, in its order. */
function consumersIn(sentence: string): string[] {
	const m = /which is why (.+) (?:both|all) consume it\.$/.exec(sentence);
	expect(m, `a soft-clay sentence: ${sentence}`).not.toBeNull();
	return m![1]!.split(/, | and /);
}
/** The corrected cases, as version one names them — every graph case whose graph carries the report. */
const CORRECTED_V1_IDS = [
	'G-CLEAN',
	'G-CLEAN-R1',
	'G-CLEAN-R2',
	'G-CLEAN-R3',
	...CRITERION_IDS.slice(1).map((k) => `G-${k.slice(0, 5)}`)
];
const v1IdOf = (v2Id: string): string => (v2Id.startsWith('G2-') ? `G-${v2Id.slice(3)}` : v2Id);

describe('JAN-CRITREAD J2-5 — reviewer-qualification case set v2: version one with REG-F-449’s correction, and nothing else', () => {
	it('⛔ the committed case set v2 and oracles v2 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V2_FILE);
		const oracles = read(ORACLES_V2_FILE);
		expect(cases, `${CASE_SET_V2_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V2)
		);
		expect(oracles, `${ORACLES_V2_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V2)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Version one stays committed as history, and still exactly what its own source generates (the limb above).
		expect(committedV2().caseSetVersion).toBe(2);
		expect(committedCases().caseSetVersion).toBe(1);
	});

	it('⭐ the shape — version one’s cases in version one’s order; each graph case built on the draft under a new G2- id, every other under its own', () => {
		const { cases, caseSetVersion } = generatedV2();
		expect(caseSetVersion).toBe(2);
		expect(new Set(cases.map((c) => c.id)).size, 'case ids are unique').toBe(cases.length);
		expect(cases.filter((c) => c.arm === 'PWA_GRAPH').map((c) => c.id)).toEqual([
			'G2-CLEAN',
			'G2-CLEAN-R1',
			'G2-CLEAN-R2',
			'G2-CLEAN-R3',
			'G-RR-01',
			...CRITERION_IDS.slice(1).map((k) => `G2-${k.slice(0, 5)}`)
		]);
		expect(cases.filter((c) => c.arm === 'WORK_PRODUCT').map((c) => c.id)).toEqual(
			committedCases()
				.cases.filter((c) => c.arm === 'WORK_PRODUCT')
				.map((c) => c.id)
		);
		expect(cases.map((c) => v1IdOf(c.id)), 'version one’s cases, in its order').toEqual(committedCases().cases.map((c) => c.id));
	});

	it('⭐ WHICH CASES TAKE THE CORRECTION — decided by RELATIONSHIP: exactly the graph cases whose graph carries the report, the planted ones included', () => {
		// A planted case built on the draft carried the draft's routing gap beside its own defect; the frontier candidate
		// filed that gap under RR-02, 04, 05, 06, 07, 08 and 09 in the clean case (`REG-F-449`), so a planted case left
		// uncorrected could have its criterion faulted for the gap and be scored as having found the plant.
		const onTheDraft = committedCases()
			.cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH' && c.input.nodes.some((n) => n.requiredOutputs.includes(REPORT)))
			.map((c) => c.id);
		expect(onTheDraft, 'the graph cases version one built on the draft').toEqual(CORRECTED_V1_IDS);
		expect([...CORRECTED_IN_V2.keys()]).toEqual(onTheDraft);
		for (const [v1, v2] of CORRECTED_IN_V2) expect(v2, v1).toBe(`G2-${v1.slice(2)}`);
		expect(CORRECTED_IN_V2.has('G-RR-01'), 'G-RR-01 models a concept study with no geotechnical report at all').toBe(false);
	});

	it('⛔ UNCHANGED MEANS UNCHANGED — every case under a version-one id is version one’s case, and the reviewer is sent exactly the prompts it was sent', async () => {
		const v1 = new Map(committedCases().cases.map((c) => [c.id, c]));
		const kept = generatedV2().cases.filter((c) => v1.has(c.id));
		expect(
			kept.map((c) => c.id),
			'G-RR-01 and the work-product arm'
		).toEqual([
			'G-RR-01',
			...committedCases()
				.cases.filter((c) => c.arm === 'WORK_PRODUCT')
				.map((c) => c.id)
		]);
		for (const c of kept) {
			expect(JSON.stringify(c), c.id).toBe(JSON.stringify(v1.get(c.id)));
			const [now, then] = [await promptsFor(c), await promptsFor(v1.get(c.id)!)];
			expect(now.initial, `${c.id}: the initial prompt`).toBe(then.initial);
			expect(now.repair, `${c.id}: the repair prompt`).toBe(then.repair);
		}
	});

	it('⛔ THE CORRECTION AND NOTHING ELSE — each corrected case is its version-one case with the report routed to the options study and the check, and ONLY the sentences listed for it (naming the report’s consumers) rewritten', async () => {
		const v1 = new Map(committedCases().cases.map((c) => [c.id, c]));
		const corrected = generatedV2().cases.filter((c): c is GraphCase => c.id.startsWith('G2-'));
		expect(corrected.map((c) => v1IdOf(c.id))).toEqual(CORRECTED_V1_IDS);
		expect(Object.keys(ALLOWED), 'the allowed diffs are listed for exactly the corrected cases').toEqual(
			corrected.map((c) => c.id)
		);
		const landed = { form: 0, check: 0, clay: 0, routedForm: 0, routedCheck: 0 };
		for (const c of corrected) {
			const was = v1.get(v1IdOf(c.id)) as GraphCase;
			// Everything but the nodes and the account is version one's: subject, instruction, PWA, narration.
			expect(
				JSON.stringify({ ...c, id: was.id, input: { ...c.input, nodes: was.input.nodes, rationale: was.input.rationale } }),
				`${c.id}: nothing outside the nodes and the account moved`
			).toBe(JSON.stringify(was));
			// The nodes: the options study and the check each gain the report as an input, last; nothing else moves.
			expect(c.input.nodes).toHaveLength(was.input.nodes.length);
			for (const [i, n] of c.input.nodes.entries()) {
				const before = was.input.nodes[i]!;
				if (!ROUTED_KINDS.has(before.pwuKind)) {
					expect(n, `${c.id}/${before.name}`).toEqual(before);
					continue;
				}
				expect(before.requiredInputs, `${c.id}/${before.name}: version one withheld the report`).not.toContain(REPORT);
				expect(n, `${c.id}/${before.name}`).toEqual({ ...before, requiredInputs: [...before.requiredInputs, REPORT] });
				if (before.pwuKind === 'OPTIONS_STUDY') landed.routedForm += 1;
				else landed.routedCheck += 1;
			}
			// The account: ONLY the sentences listed for the case differ from version one's, each exactly as listed.
			const r = c.input.rationale!;
			const r1 = was.input.rationale!;
			const allowed = ALLOWED[c.id]!;
			expect([r.assumptions, r.limitations], `${c.id}: assumptions and limitations`).toEqual([r1.assumptions, r1.limitations]);
			const v1Sentences = sentencesOf(r1.rationale);
			const expected = allowed.account.map(([from, to]): SentenceDiff => {
				const hits = v1Sentences.filter((s) => s.endsWith(from));
				expect(hits, `${c.id}: version one's account has one sentence ending "${from}"`).toHaveLength(1);
				return [hits[0]!, `${hits[0]!.slice(0, -from.length)}${to}`];
			});
			expect(
				changedSentences(v1Sentences, sentencesOf(r.rationale), `${c.id}'s account`),
				`${c.id}: the account's sentences that differ from version one's`
			).toEqual(expected);
			expect(
				changedSentences(r1.residualUncertainty, r.residualUncertainty, `${c.id}'s residual uncertainty`),
				`${c.id}: the residual uncertainties that differ from version one's`
			).toEqual(allowed.uncertainty);
			// And each listed restatement is there exactly where version one's account has the sentence it restates.
			const has = (end: string) => v1Sentences.some((s) => s.endsWith(end));
			expect(allowed.account.includes(FORM), `${c.id}: the options study's sentence restated`).toBe(has(FORM[0]));
			expect(allowed.account.includes(CHECK), `${c.id}: the check's sentence restated`).toBe(has(CHECK[0]));
			expect(allowed.uncertainty.length > 0, `${c.id}: the soft-clay uncertainty restated`).toBe(
				r1.residualUncertainty.includes(CLAY_V1)
			);
			if (has(FORM[0])) landed.form += 1;
			if (has(CHECK[0])) landed.check += 1;
			if (r1.residualUncertainty.includes(CLAY_V1)) landed.clay += 1;
			// And the correction reaches the reviewer: the prompt it is sent is not version one's.
			expect((await promptsFor(c)).initial, `${c.id}: the prompt moved`).not.toBe((await promptsFor(was)).initial);
		}
		// Where each piece of the correction landed: the form in every case but G2-RR-05 (no options study), the check in
		// every case but G2-RR-02 (no check); the sentences wherever the account describes that type (not G2-RR-09's).
		expect(landed).toEqual({ form: 10, check: 10, clay: 9, routedForm: 11, routedCheck: 11 });
	});

	it('⭐ CONTROL — the soft-clay sentence names the types that consume the report: the rule version two restates it by is the one version one already wrote it by', () => {
		let carried = 0;
		for (const c of committedCases().cases) {
			if (c.arm !== 'PWA_GRAPH') continue;
			for (const u of c.input.rationale?.residualUncertainty ?? [])
				if (u.startsWith('The soft clay layer')) {
					expect(clayUncertainty(c.input.nodes), c.id).toBe(u);
					carried += 1;
				}
		}
		expect(carried, 'every case version one gave the sentence').toBe(9);
		let restated = 0;
		for (const c of generatedV2().cases)
			for (const [, now] of ALLOWED[c.id]?.uncertainty ?? []) {
				if (c.arm === 'PWA_GRAPH') expect(clayUncertainty(c.input.nodes), c.id).toBe(now);
				restated += 1;
			}
		expect(restated, 'every corrected case that carries the sentence').toBe(9);
	});

	it('⛔ NO NEW CUE IN A PLANTED CASE — what the correction adds to a planted case is what it adds to the clean case, less the names of types the case lacks: it names, characterizes, softens or sharpens no plant', () => {
		const v1 = new Map(committedCases().cases.map((c) => [c.id, c]));
		const corrected = generatedV2().cases.filter((c): c is GraphCase => c.id.startsWith('G2-'));
		/** What the correction changed in a case, read from the data: each account edit, and each uncertainty sentence. */
		const changesIn = (c: GraphCase) => {
			const was = (v1.get(v1IdOf(c.id)) as GraphCase).input.rationale!;
			const now = c.input.rationale!;
			return {
				account: changedSentences(sentencesOf(was.rationale), sentencesOf(now.rationale), c.id).map(minimalEdit),
				uncertainty: changedSentences(was.residualUncertainty, now.residualUncertainty, c.id)
			};
		};
		const clean = changesIn(corrected.find((c) => c.id === 'G2-CLEAN')!);
		expect(clean.account, 'what the correction adds to the clean case’s account').toEqual([
			{ removed: '', inserted: 'the geotechnical report, and ' },
			{ removed: '', inserted: ', and also consumes the geotechnical report' }
		]);
		expect(clean.uncertainty).toHaveLength(1);
		const cleanConsumers = consumersIn(clean.uncertainty[0]![1]);
		expect(cleanConsumers.map((n) => CONSUMER_KIND[n])).toEqual(['OPTIONS_STUDY', 'LOAD_ANALYSIS', 'DETAILED_DESIGN', 'INDEPENDENT_CHECK']);
		// G-RR-07's check is the design team's own; version one's account of the case already calls it "the independent
		// check" (its permit sentence), so the soft-clay sentence names it in version one's words, and adds none.
		expect((v1.get('G-RR-07') as GraphCase).input.rationale!.rationale).toContain('before the independent check exists');
		const planted = corrected.filter((c) => /^G2-RR-\d\d$/.test(c.id));
		expect(planted.map((c) => c.id)).toEqual(CRITERION_IDS.slice(1).map((k) => `G2-${k.slice(0, 5)}`));
		for (const c of planted) {
			const { account, uncertainty } = changesIn(c);
			for (const e of account) expect(clean.account, `${c.id}: "${e.inserted}" is added to the clean case too`).toContainEqual(e);
			const kinds = new Set(c.input.nodes.map((n) => n.pwuKind));
			for (const [was, now] of uncertainty) {
				expect(was, `${c.id}: only version one's soft-clay sentence is restated`).toBe(CLAY_V1);
				expect(consumersIn(now), `${c.id}: the clean case's consumers, less the types this case lacks`).toEqual(
					cleanConsumers.filter((n) => kinds.has(CONSUMER_KIND[n]!))
				);
				expect(now, c.id).toBe(CLAY(`${consumersIn(now).slice(0, -1).join(', ')} and ${consumersIn(now).at(-1)} all`));
			}
		}
	});

	it('⭐ PRODUCTION’S GRAPH — every v2 graph case, the corrected ones included, is valid, coherent and exported exactly by an engine', () => {
		const graphs = generatedV2().cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH');
		expect(graphs).toHaveLength(13);
		for (const c of graphs) expectProductionsGraph(c);
	});

	it('⛔ RENAMED MEANS RENAMED — each v2 copy is its clean case with version one’s names substituted, and nothing else', () => {
		expect(Object.keys(RENAMES_V2).sort()).toEqual(
			['G2-CLEAN-R1', 'G2-CLEAN-R2', 'G2-CLEAN-R3', 'W-CLEAN-R1', 'W-CLEAN-R2', 'W-CLEAN-R3'].sort()
		);
		for (const [id, names] of Object.entries(RENAMES_V2)) expect(names, id).toEqual(RENAMES_V1[v1IdOf(id)]);
		expectRenamedOnly(generatedV2().cases, RENAMES_V2);
	});

	it('⛔ THE 28,000-CHARACTER LIMIT, AND SEEN WHOLE — every v2 prompt fits agy’s argv budget, and no slice of any case is truncated', async () => {
		const problems: string[] = [];
		for (const c of generatedV2().cases) {
			const { initial, repair, input } = await promptsFor(c);
			for (const [role, prompt] of [
				['initial', initial],
				['repair', repair]
			] as const)
				if (prompt.length > MAX_AGY_PROMPT_CHARS) problems.push(`${c.id} ${role}: ${prompt.length} chars`);
			if (initial.includes(CUT_DECLARED)) problems.push(`${c.id}: a slice is truncated`);
			if (!initial.includes(input.content)) problems.push(`${c.id}: the content is not whole`);
			if (!initial.includes(input.prompt)) problems.push(`${c.id}: the instruction is not whole`);
		}
		expect(problems.join('\n')).toBe('');
	});

	it('⭐ ORACLES v2 carry version one’s standings unchanged — each case’s oracle is the one of the version-one case it is, or corrects', () => {
		const set = generatedOraclesV2();
		const v1 = new Map(committedOracles().oracles.map((o) => [o.caseId, o]));
		expect(set.oracleVersion).toBe(2);
		expect(set.caseSetVersion, 'the oracles name the case set they judge').toBe(generatedV2().caseSetVersion);
		expect(set.oracles.map((o) => o.caseId)).toEqual(generatedV2().cases.map((c) => c.id));
		for (const o of set.oracles) {
			const was = v1.get(v1IdOf(o.caseId))!;
			expect({ faulted: o.faulted, disposition: o.disposition, expectation: o.expectation }, o.caseId).toEqual({
				faulted: was.faulted,
				disposition: was.disposition,
				expectation: was.expectation
			});
			// A note names the case it is about — never a version-one id that version two replaced.
			for (const old of CORRECTED_V1_IDS) expect(o.note.includes(`${old}:`), `${o.caseId}'s note names ${old}`).toBe(false);
		}
	});

	it('⭐ THE ORACLES COMPOSE — for every v2 case, a reply faulting exactly its oracle’s criteria scores to its disposition, with independence met', async () => {
		const oracles = new Map(generatedOraclesV2().oracles.map((o) => [o.caseId, o]));
		for (const c of generatedV2().cases) {
			const oracle = oracles.get(c.id)!;
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const validator = createAgyReasoningReviewValidator({
				...EVALUATOR,
				print: async () =>
					JSON.stringify({
						findings: input.criteria.map((k) => ({
							criterionId: k.id,
							failed: oracle.faulted.includes(k.id),
							statement: 'as the oracle expects',
							severity: oracle.faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
						})),
						recommendation: oracle.disposition
					})
			});
			const result = await validator.evaluate(c.subject, { reasoningReview: input });
			const plan = deMinimisFloorPlan(c.subject).filter((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
			expect(plan, c.id).toHaveLength(1);
			const outcome = composeAssuranceOutcome(c.subject, plan, [result]);
			expect(outcome.perPolicy[0]?.independenceOk, `${c.id}: the case producer is independent of the evaluator`).toBe(true);
			expect(outcome.perPolicy[0]?.disposition, c.id).toBe(oracle.disposition);
		}
	});
});

// ── ⭐ `JAN-CRITREAD` J2-7 — CASE SET VERSION THREE (`REG-F-453`; the sponsor's ruling `REG-D-081`) ──────────────────
//
// On version two the frontier candidate rejected the corrected clean graph case on two grounds version two did not
// change (`REG-F-453`): the draft's design type is scoped to members and joints ("Steelwork Design (members and joints)")
// while its account says the soft clay may need piled foundations, so nobody designs the foundations; and the permit
// submission receives neither the geotechnical report nor the design calculations. The sponsor authorized exactly those
// two changes and nothing else (`REG-D-081`): (1) a design responsibility covers the foundations — here the design type's
// name and scope, since it already consumes the report and its outputs already reach the independent check; (2) the
// permit submission receives the report and the calculations. They reach version two's twelve cases (`REG-D-079`), each
// under a new G3- id, each planted case keeping its plant as its only defect; every other case is version two's.
//
// ⚠ THESE LIMBS READ VERSION THREE AS THE GENERATOR WRITES IT, as version two's do — the freshness limb holds the
// committed file to those bytes. ⚠ THE EXPECTED TEXT BELOW IS WRITTEN HERE, not imported: the diff limb states what the
// two changes are independently of the source that makes them.

const committedV2Oracles = (): OracleSet => JSON.parse(read(ORACLES_V2_FILE)) as OracleSet;
const committedV3 = (): CaseSet => JSON.parse(read(CASE_SET_V3_FILE)) as CaseSet;
const generatedV3 = (): CaseSet => JSON.parse(serializeGenerated(CASE_SET_V3)) as CaseSet;
const generatedOraclesV3 = (): OracleSet => JSON.parse(serializeGenerated(ORACLES_V3)) as OracleSet;

const CALCULATIONS = 'design-calculations';
/** (1) The design type's name, version two → version three — the clean draft's (which every planted case carries) and each
 *  renamed copy's: the same name, with the foundations taken into its scope. */
const DESIGN_NAMES: Readonly<Record<string, readonly [was: string, now: string]>> = {
	'G3-CLEAN': ['Member and Connection Design', 'Member, Connection and Foundation Design'],
	'G3-CLEAN-R1': ['Element and Joint Design', 'Element, Joint and Foundation Design'],
	'G3-CLEAN-R2': ['Steelwork Design (members and joints)', 'Steelwork and Foundation Design (members, joints and foundations)'],
	'G3-CLEAN-R3': ['Structural Element Design', 'Structural Element and Foundation Design']
};
const designNamesOf = (id: string): readonly [string, string] => DESIGN_NAMES[id] ?? DESIGN_NAMES['G3-CLEAN']!;
/** (1) …and the design's scope in its sentence, after its name. */
const SCOPE: SentenceDiff = [
	' designs the members and connections from the load model',
	' designs the members, connections and foundations from the load model'
];
/** (2) The end of the clean draft's permit sentence: it also consumes the report and the calculations — no more. */
const PERMIT: SentenceDiff = [
	'so the submission cannot be made before the independent check exists.',
	'so the submission cannot be made before the independent check exists; it also consumes the geotechnical report and the design calculations.'
];
/** The clean case's two restated sentences, whole — what a planted case's edits are held to. */
const CLEAN_DESIGN_SENTENCE: SentenceDiff = [
	'“Member and Connection Design” designs the members and connections from the load model and the geotechnical report.',
	'“Member, Connection and Foundation Design” designs the members, connections and foundations from the load model and the geotechnical report.'
];
const CLEAN_PERMIT_SENTENCE: SentenceDiff = [
	'“Rail Authority Permit Submission” consumes the check certificate, so the submission cannot be made before the independent check exists.',
	'“Rail Authority Permit Submission” consumes the check certificate, so the submission cannot be made before the independent check exists; it also consumes the geotechnical report and the design calculations.'
];

/** What the two changes may change in a changed case. */
interface AllowedV3 {
	/** The design's sentence restated — its name and its scope phrase, nothing else in it. */
	readonly design: boolean;
	/** The permit's sentence restated — its end. */
	readonly permit: boolean;
	/** The inputs the permit gains, appended in this order. */
	readonly permitGains: readonly string[];
}
const BOTH: AllowedV3 = { design: true, permit: true, permitGains: [REPORT, CALCULATIONS] };
/**
 * ⭐ THE ALLOWED DIFFS, LISTED PER CHANGED CASE. Graph: the design type's name (every case), the permit's inputs (every
 * case). Account: the listed sentences. Nothing else of a changed case — no other node, no assumption, limitation,
 * residual uncertainty, narration, instruction, subject or id — may differ from its version-two case.
 */
const ALLOWED_V3: Readonly<Record<string, AllowedV3>> = {
	'G3-CLEAN': BOTH,
	'G3-CLEAN-R1': BOTH,
	'G3-CLEAN-R2': BOTH,
	'G3-CLEAN-R3': BOTH,
	// No check (the plant). Its permit sentence is the plant's own ("consumes the design calculations and drawings, so the
	// submission is made once the design is complete") and is not restated; its permit already consumes the design
	// calculations — the plant routes the design straight to it — so it gains the report alone.
	'G3-RR-02': { design: true, permit: false, permitGains: [REPORT] },
	'G3-RR-03': BOTH,
	'G3-RR-04': BOTH,
	'G3-RR-05': BOTH,
	// The design's sentence carries the plant AFTER the scope phrase the clean draft shares; the plant's words stay.
	'G3-RR-06': BOTH,
	// The design team's own check (the plant): its permit sentence is the clean draft's, so it is restated as the clean's.
	'G3-RR-07': BOTH,
	// As G3-RR-06: the plant ("ground conditions at both abutments are benign") follows the shared scope phrase.
	'G3-RR-08': BOTH,
	// The account describes no type (the plant): only the graph moves.
	'G3-RR-09': { design: false, permit: false, permitGains: [REPORT, CALCULATIONS] }
};
/** The changed cases, as version two names them — version two's twelve. Written here, not imported. */
const CHANGED_V2_IDS = [
	'G2-CLEAN',
	'G2-CLEAN-R1',
	'G2-CLEAN-R2',
	'G2-CLEAN-R3',
	...CRITERION_IDS.slice(1).map((k) => `G2-${k.slice(0, 5)}`)
];
const v2IdOf = (v3Id: string): string => (v3Id.startsWith('G3-') ? `G2-${v3Id.slice(3)}` : v3Id);
const nodeOf = (c: GraphCase, kind: string) => c.input.nodes.find((n) => n.pwuKind === kind);

/** Every prompt problem of `cases`: over the 28,000-character limit, a slice truncated, the content or instruction cut. */
async function promptProblemsIn(cases: readonly QualificationCase[]): Promise<string[]> {
	const problems: string[] = [];
	for (const c of cases) {
		const { initial, repair, input } = await promptsFor(c);
		for (const [role, prompt] of [
			['initial', initial],
			['repair', repair]
		] as const)
			if (prompt.length > MAX_AGY_PROMPT_CHARS) problems.push(`${c.id} ${role}: ${prompt.length} chars`);
		if (initial.includes(CUT_DECLARED)) problems.push(`${c.id}: a slice is truncated`);
		if (!initial.includes(input.content)) problems.push(`${c.id}: the content is not whole`);
		if (!initial.includes(input.prompt)) problems.push(`${c.id}: the instruction is not whole`);
	}
	return problems;
}

describe('JAN-CRITREAD J2-7 — reviewer-qualification case set v3: version two with the foundations and the permit’s inputs (REG-D-081), and nothing else', () => {
	it('⛔ the committed case set v3 and oracles v3 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V3_FILE);
		const oracles = read(ORACLES_V3_FILE);
		expect(cases, `${CASE_SET_V3_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V3)
		);
		expect(oracles, `${ORACLES_V3_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V3)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one and two stay committed as history, each still exactly what its own source generates (the limbs above).
		expect(committedV3().caseSetVersion).toBe(3);
		expect([committedCases().caseSetVersion, committedV2().caseSetVersion]).toEqual([1, 2]);
	});

	it('⭐ the shape — version two’s cases in version two’s order; each case version two corrected under a new G3- id, every other under its own', () => {
		const { cases, caseSetVersion } = generatedV3();
		expect(caseSetVersion).toBe(3);
		expect(new Set(cases.map((c) => c.id)).size, 'case ids are unique').toBe(cases.length);
		expect(cases.filter((c) => c.arm === 'PWA_GRAPH').map((c) => c.id)).toEqual([
			'G3-CLEAN',
			'G3-CLEAN-R1',
			'G3-CLEAN-R2',
			'G3-CLEAN-R3',
			'G-RR-01',
			...CRITERION_IDS.slice(1).map((k) => `G3-${k.slice(0, 5)}`)
		]);
		expect(cases.map((c) => v2IdOf(c.id)), 'version two’s cases, in its order').toEqual(committedV2().cases.map((c) => c.id));
		expect(cases).toHaveLength(26);
	});

	it('⭐ WHICH CASES TAKE THE CHANGES — decided by RELATIONSHIP: exactly the graph cases built on the draft, version two’s twelve (REG-D-079), the planted ones included', () => {
		const onTheDraft = committedV2()
			.cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH' && c.input.nodes.some((n) => n.requiredOutputs.includes(REPORT)))
			.map((c) => c.id);
		expect(onTheDraft, 'the graph cases version two built on the draft').toEqual(CHANGED_V2_IDS);
		expect(onTheDraft, 'version two’s corrected cases').toEqual([...CORRECTED_IN_V2.values()]);
		expect([...CHANGED_IN_V3.keys()]).toEqual(onTheDraft);
		for (const [v2, v3] of CHANGED_IN_V3) expect(v3, v2).toBe(`G3-${v2.slice(3)}`);
		expect(CHANGED_IN_V3.has('G-RR-01'), 'G-RR-01 models a concept study with no geotechnical report at all').toBe(false);
	});

	it('⛔ UNCHANGED MEANS UNCHANGED — the fourteen other cases are version two’s, byte for byte, and the reviewer is sent exactly the prompts it was sent', async () => {
		const v2 = new Map(committedV2().cases.map((c) => [c.id, c]));
		const kept = generatedV3().cases.filter((c) => v2.has(c.id));
		expect(
			kept.map((c) => c.id),
			'G-RR-01 and the thirteen work-product cases'
		).toEqual([
			'G-RR-01',
			...committedV2()
				.cases.filter((c) => c.arm === 'WORK_PRODUCT')
				.map((c) => c.id)
		]);
		expect(kept).toHaveLength(14);
		for (const c of kept) {
			expect(JSON.stringify(c), c.id).toBe(JSON.stringify(v2.get(c.id)));
			const [now, then] = [await promptsFor(c), await promptsFor(v2.get(c.id)!)];
			expect(now.initial, `${c.id}: the initial prompt`).toBe(then.initial);
			expect(now.repair, `${c.id}: the repair prompt`).toBe(then.repair);
		}
	});

	it('⛔ THE TWO CHANGES AND NOTHING ELSE — each changed case is its version-two case with the design’s name and the permit’s inputs changed, and ONLY the sentences listed for it rewritten', async () => {
		const v2 = new Map(committedV2().cases.map((c) => [c.id, c]));
		const changed = generatedV3().cases.filter((c): c is GraphCase => c.id.startsWith('G3-'));
		expect(changed.map((c) => v2IdOf(c.id))).toEqual(CHANGED_V2_IDS);
		expect(Object.keys(ALLOWED_V3), 'the allowed diffs are listed for exactly the changed cases').toEqual(
			changed.map((c) => c.id)
		);
		const landed = { designSentence: 0, permitSentence: 0, renamed: 0, report: 0, calculations: 0 };
		for (const c of changed) {
			const was = v2.get(v2IdOf(c.id)) as GraphCase;
			const allowed = ALLOWED_V3[c.id]!;
			const [wasName, nowName] = designNamesOf(c.id);
			// Everything but the nodes and the account is version two's: subject, instruction, PWA, narration.
			expect(
				JSON.stringify({ ...c, id: was.id, input: { ...c.input, nodes: was.input.nodes, rationale: was.input.rationale } }),
				`${c.id}: nothing outside the nodes and the account moved`
			).toBe(JSON.stringify(was));
			// The nodes: the design's name, and the permit's inputs appended; no other node, no other field, no new id.
			expect(c.input.nodes.map((n) => n.id), `${c.id}: the same types, in the same order`).toEqual(was.input.nodes.map((n) => n.id));
			for (const [i, n] of c.input.nodes.entries()) {
				const before = was.input.nodes[i]!;
				if (before.pwuKind === 'DETAILED_DESIGN') {
					expect(before.name, `${c.id}: version two's design`).toBe(wasName);
					expect(n, `${c.id}/${before.name}`).toEqual({ ...before, name: nowName });
					landed.renamed += 1;
				} else if (before.pwuKind === 'PERMIT_SUBMISSION') {
					for (const d of allowed.permitGains)
						expect(before.requiredInputs, `${c.id}/${before.name}: version two withheld ${d}`).not.toContain(d);
					expect(n, `${c.id}/${before.name}`).toEqual({
						...before,
						requiredInputs: [...before.requiredInputs, ...allowed.permitGains]
					});
					if (allowed.permitGains.includes(REPORT)) landed.report += 1;
					if (allowed.permitGains.includes(CALCULATIONS)) landed.calculations += 1;
				} else expect(n, `${c.id}/${before.name}`).toEqual(before);
			}
			// The account: ONLY the listed sentences differ from version two's, each exactly as listed.
			const r = c.input.rationale!;
			const r2 = was.input.rationale!;
			expect(
				[r.assumptions, r.limitations, r.residualUncertainty],
				`${c.id}: assumptions, limitations and residual uncertainty — the soft-clay sentence among them — are version two’s`
			).toEqual([r2.assumptions, r2.limitations, r2.residualUncertainty]);
			const v2Sentences = sentencesOf(r2.rationale);
			const designSentences = v2Sentences.filter((s) => s.startsWith(`“${wasName}”${SCOPE[0]}`));
			const permitSentences = v2Sentences.filter((s) => s.endsWith(PERMIT[0]));
			expect(allowed.design, `${c.id}: the design's sentence restated where version two has it`).toBe(designSentences.length === 1);
			expect(allowed.permit, `${c.id}: the permit's sentence restated where version two has the clean draft's`).toBe(
				permitSentences.length === 1
			);
			const expected: SentenceDiff[] = v2Sentences.flatMap((s): SentenceDiff[] => {
				if (allowed.design && s === designSentences[0])
					return [[s, `“${nowName}”${SCOPE[1]}${s.slice(`“${wasName}”${SCOPE[0]}`.length)}`]];
				if (allowed.permit && s === permitSentences[0]) return [[s, `${s.slice(0, -PERMIT[0].length)}${PERMIT[1]}`]];
				return [];
			});
			expect(
				changedSentences(v2Sentences, sentencesOf(r.rationale), `${c.id}'s account`),
				`${c.id}: the account's sentences that differ from version two's`
			).toEqual(expected);
			if (allowed.design) landed.designSentence += 1;
			if (allowed.permit) landed.permitSentence += 1;
			// And the changes reach the reviewer: the prompt it is sent is not version two's.
			expect((await promptsFor(c)).initial, `${c.id}: the prompt moved`).not.toBe((await promptsFor(was)).initial);
		}
		// Where each piece landed: the design renamed and the report routed to the permit in all twelve; the calculations in
		// every case but G3-RR-02 (its permit had them); the design's sentence wherever the account describes the type (not
		// G3-RR-09's), the permit's wherever it is the clean draft's (not G3-RR-02's, nor G3-RR-09's).
		expect(landed).toEqual({ designSentence: 11, permitSentence: 10, renamed: 12, report: 12, calculations: 11 });
	});

	it('⭐ WHAT VERSION THREE ADDS, READ FROM THE GRAPH — a design responsibility covers the foundations, consumes the report and reaches the check; the permit receives the report and the calculations; version two had neither', () => {
		const v2 = new Map(committedV2().cases.map((c) => [c.id, c]));
		for (const c of generatedV3().cases.filter((x): x is GraphCase => x.id.startsWith('G3-'))) {
			const was = v2.get(v2IdOf(c.id)) as GraphCase;
			const founders = c.input.nodes.filter((n) => n.name.includes('Foundation'));
			expect(
				founders.map((n) => n.pwuKind),
				`${c.id}: one type takes the foundations, the design`
			).toEqual(['DETAILED_DESIGN']);
			expect(was.input.nodes.some((n) => n.name.includes('Foundation')), `${c.id}: version two had none`).toBe(false);
			const design = founders[0]!;
			expect(design.requiredInputs, `${c.id}: the design consumes the report`).toContain(REPORT);
			const check = nodeOf(c, 'INDEPENDENT_CHECK');
			// G3-RR-02 has no check — its plant.
			expect(check === undefined, `${c.id}: the check is absent only where it is the plant`).toBe(c.id === 'G3-RR-02');
			if (check)
				expect(
					design.requiredOutputs.filter((d) => check.requiredInputs.includes(d)),
					`${c.id}: the design’s output reaches the check`
				).toEqual(['design-calculations', 'general-arrangement-drawings']);
			const permit = nodeOf(c, 'PERMIT_SUBMISSION')!;
			expect(permit.requiredInputs, `${c.id}: the permit receives the report and the calculations`).toEqual(
				expect.arrayContaining([REPORT, CALCULATIONS])
			);
			expect(nodeOf(was, 'PERMIT_SUBMISSION')!.requiredInputs, `${c.id}: version two's permit lacked the report`).not.toContain(
				REPORT
			);
			// And the account claims no more than the graph shows: where it says the permit also consumes the report and the
			// calculations, the permit does; where it says the design designs the foundations, the design is the type named.
			const r = c.input.rationale!.rationale;
			if (r.includes(PERMIT[1])) expect(r, c.id).toContain(`“${permit.name}” consumes the check certificate, ${PERMIT[1]}`);
			if (r.includes(SCOPE[1])) expect(r, c.id).toContain(`“${design.name}”${SCOPE[1]}`);
			expect(/checks? the foundations/.test(r), `${c.id}: no claim the check checks the foundations`).toBe(false);
		}
	});

	it('⛔ NO NEW CUE IN A PLANTED CASE — what the changes add to a planted case is what they add to the clean case, less what the case lacks: they name, characterize, soften or sharpen no plant', () => {
		const v2 = new Map(committedV2().cases.map((c) => [c.id, c]));
		const changed = generatedV3().cases.filter((c): c is GraphCase => c.id.startsWith('G3-'));
		/** What the changes did to a case, read from the data: each account edit, the design's rename, the permit's gains. */
		const changesIn = (c: GraphCase) => {
			const was = v2.get(v2IdOf(c.id)) as GraphCase;
			const permitWas = nodeOf(was, 'PERMIT_SUBMISSION')!.requiredInputs;
			return {
				account: changedSentences(sentencesOf(was.input.rationale!.rationale), sentencesOf(c.input.rationale!.rationale), c.id).map(
					minimalEdit
				),
				design: [nodeOf(was, 'DETAILED_DESIGN')!.name, nodeOf(c, 'DETAILED_DESIGN')!.name],
				permitGains: nodeOf(c, 'PERMIT_SUBMISSION')!.requiredInputs.slice(permitWas.length),
				permitWas
			};
		};
		const clean = changesIn(changed.find((c) => c.id === 'G3-CLEAN')!);
		expect(clean.account, 'what the changes do to the clean case’s account').toEqual([
			minimalEdit(CLEAN_DESIGN_SENTENCE),
			minimalEdit(CLEAN_PERMIT_SENTENCE)
		]);
		expect(clean.design).toEqual(DESIGN_NAMES['G3-CLEAN']);
		expect(clean.permitGains).toEqual([REPORT, CALCULATIONS]);
		const planted = changed.filter((c) => /^G3-RR-\d\d$/.test(c.id));
		expect(planted.map((c) => c.id)).toEqual(CRITERION_IDS.slice(1).map((k) => `G3-${k.slice(0, 5)}`));
		for (const c of planted) {
			const { account, design, permitGains, permitWas } = changesIn(c);
			for (const e of account) expect(clean.account, `${c.id}: "${e.inserted}" is added to the clean case too`).toContainEqual(e);
			expect(design, `${c.id}: the design renamed as the clean case’s is`).toEqual(clean.design);
			expect(permitGains, `${c.id}: the permit gains the clean case’s inputs, less those it already has`).toEqual(
				clean.permitGains.filter((d) => !permitWas.includes(d))
			);
		}
		// G3-RR-02's plant routes the design straight to the permit, so its permit already had the calculations — the one
		// planted case whose gains are fewer than the clean case's.
		expect(planted.filter((c) => changesIn(c).permitGains.length < 2).map((c) => c.id)).toEqual(['G3-RR-02']);
	});

	it('⭐ PRODUCTION’S GRAPH — every v3 graph case, the changed ones included, is valid, coherent and exported exactly by an engine', () => {
		const graphs = generatedV3().cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH');
		expect(graphs).toHaveLength(13);
		for (const c of graphs) expectProductionsGraph(c);
	});

	it('⛔ RENAMED MEANS RENAMED — each v3 copy is G3-CLEAN with version two’s names substituted, the design’s extended to the foundations, and nothing else', () => {
		expect(Object.keys(RENAMES_V3).sort()).toEqual(
			['G3-CLEAN-R1', 'G3-CLEAN-R2', 'G3-CLEAN-R3', 'W-CLEAN-R1', 'W-CLEAN-R2', 'W-CLEAN-R3'].sort()
		);
		const extend = (name: string) => Object.values(DESIGN_NAMES).find(([was]) => was === name)?.[1] ?? name;
		for (const [id, names] of Object.entries(RENAMES_V3))
			expect(names, id).toEqual({ from: RENAMES_V2[v2IdOf(id)]!.from.map(extend), to: RENAMES_V2[v2IdOf(id)]!.to.map(extend) });
		expectRenamedOnly(generatedV3().cases, RENAMES_V3);
	});

	it('⛔ THE 28,000-CHARACTER LIMIT, AND SEEN WHOLE — every v3 prompt fits agy’s argv budget, and no slice of any case is truncated', async () => {
		expect((await promptProblemsIn(generatedV3().cases)).join('\n')).toBe('');
	});

	it('⭐ ORACLES v3 carry version two’s standings unchanged — each case’s oracle is the one of the version-two case it is, or changes', () => {
		const set = generatedOraclesV3();
		const v2 = new Map(committedV2Oracles().oracles.map((o) => [o.caseId, o]));
		expect(set.oracleVersion).toBe(3);
		expect(set.caseSetVersion, 'the oracles name the case set they judge').toBe(generatedV3().caseSetVersion);
		expect(set.oracles.map((o) => o.caseId)).toEqual(generatedV3().cases.map((c) => c.id));
		for (const o of set.oracles) {
			const was = v2.get(v2IdOf(o.caseId))!;
			expect({ faulted: o.faulted, disposition: o.disposition, expectation: o.expectation }, o.caseId).toEqual({
				faulted: was.faulted,
				disposition: was.disposition,
				expectation: was.expectation
			});
			// A note names the case it is about — never an id version three or version two replaced.
			for (const old of [...CHANGED_V2_IDS, ...CORRECTED_V1_IDS])
				expect(o.note.includes(`${old}:`), `${o.caseId}'s note names ${old}`).toBe(false);
		}
	});

	it('⭐ THE ORACLES COMPOSE — for every v3 case, a reply faulting exactly its oracle’s criteria scores to its disposition, with independence met', async () => {
		const oracles = new Map(generatedOraclesV3().oracles.map((o) => [o.caseId, o]));
		for (const c of generatedV3().cases) {
			const oracle = oracles.get(c.id)!;
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const validator = createAgyReasoningReviewValidator({
				...EVALUATOR,
				print: async () =>
					JSON.stringify({
						findings: input.criteria.map((k) => ({
							criterionId: k.id,
							failed: oracle.faulted.includes(k.id),
							statement: 'as the oracle expects',
							severity: oracle.faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
						})),
						recommendation: oracle.disposition
					})
			});
			const result = await validator.evaluate(c.subject, { reasoningReview: input });
			const plan = deMinimisFloorPlan(c.subject).filter((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
			expect(plan, c.id).toHaveLength(1);
			const outcome = composeAssuranceOutcome(c.subject, plan, [result]);
			expect(outcome.perPolicy[0]?.independenceOk, `${c.id}: the case producer is independent of the evaluator`).toBe(true);
			expect(outcome.perPolicy[0]?.disposition, c.id).toBe(oracle.disposition);
		}
	});
});
