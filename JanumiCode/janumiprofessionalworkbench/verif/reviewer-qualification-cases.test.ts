// ⭐ `JAN-CRITREAD` J2-1 — REVIEWER-QUALIFICATION CASE SET VERSION ONE, AND WHAT IT MUST BE BEFORE ANYTHING IS
// MEASURED WITH IT (DESIGN-what-the-tests-prove.md §5.2; ROADMAP J2-1).
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
	ORACLES_V1_FILE,
	serializeGenerated,
	type CaseSet,
	type GraphCase,
	type OracleSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import { CASE_SET_V1, RENAMES_V1 } from '../scripts/reviewer-qual/case-set-v1.js';
import { ORACLES_V1 } from '../scripts/reviewer-qual/oracles-v1.js';
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
		const { cases } = committedCases();
		const byId = new Map(cases.map((c) => [c.id, c]));
		const copies = cases.filter((c) => /-CLEAN-R\d$/.test(c.id));
		expect(copies).toHaveLength(6);
		for (const copy of copies) {
			const rename = RENAMES_V1[copy.id];
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
	});

	it('⭐ PRODUCTION’S GRAPH — every graph case, defined in an engine by an author’s commands, exports exactly its literal nodes', () => {
		const graphs = committedCases().cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH');
		expect(graphs).toHaveLength(13);
		for (const c of graphs) {
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
			if (initial.includes('…(truncated)')) cut.push(`${c.id}: a slice is truncated`);
			if (!initial.includes(input.content)) cut.push(`${c.id}: the content is not whole`);
			if (!initial.includes(input.prompt)) cut.push(`${c.id}: the instruction is not whole`);
		}
		expect(cut.join('\n')).toBe('');
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
