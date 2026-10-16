// ⭐ `JAN-CRITREAD` J2-3 — THE SCORING CORPUS (DESIGN-what-the-tests-prove.md §5.5).
//
// The scoring digest is what these RAW replies score to through the real path — the product's validator at its
// `print` seam, then the runner's scoring over the Reasoning Review reference alone (`runner.ts` `evaluateCase`) —
// hashed as outcomes only. So a change anywhere between a reply and its recorded outcome moves the digest: the parse,
// the repair decision, `coerceJudgement`, the mapper, the ladder, `REG-D-089`'s rule (a), the independence check, the
// runner's handling of a validator that throws. A change that moves NONE of these outcomes is, by this measure, no
// change to the scoring. ⚠ E12's polish — OF THE FLOOR'S ARMS ONLY: every entry is the work-product case below, so a
// DECLARED case's score — the declared sign-off's verdict (`runner.ts` `scoreDeclared`), at the ceiling its policy's seeded
// evidence sets — is reached by no entry, and a change confined to it moves no scoring digest.
//
// ⭐ EVERY `REG-F-428` CLASS IS HERE — a duplicate key, an unknown id and a corrupted one, a non-boolean `failed`,
// fenced JSON, prose-wrapped JSON — with the siblings the harness detects, and ONE REPLY THAT FAILS THE FIRST PARSE, so
// the repair prompt it draws is captured too (the fingerprint hashes its instruction, `fingerprint.ts`).
// ⭐ `JAN-CRITREAD` J2-3 — AND A REPLY ON EACH SIDE OF THE RULES THE ADVERSARIAL REVIEW FOUND INVISIBLE: one reported
// by ANOTHER model of the producer's own provider, which `DIFFERENT_MODEL` admits and `DIFFERENT_PROVIDER` refuses —
// so the plan's independence cannot change without moving the digest; and one whose row carries `stipulated: true`,
// which the product must read as the model answered it — a stipulation is the test's to make (`REG-D-071`), never the
// reviewer's — so `coerceJudgement` cannot start honouring it without moving the digest.
// ⭐ `JAN-ESCREC` ER-2 (design D4; `REG-D-089`, `REG-D-090`, `REG-D-092`) — AND `REG-D-089`'S RULE (a) FROM EACH SIDE: a
// clean, fully answered reply recommending ESCALATED, which the rule escalates (`composeAssuranceOutcome`'s second
// pass); and the same recommendation where the rule must NOT reach — beside a BLOCKING fault (REJECTED stays, "more
// actionable"), beside a row never answered (INCONCLUSIVE stays: the rule is keyed on the ladder's SATISFIED, never on
// "no criterion failed"), and reported as the producer (BOUNDARY_REJECTED stays: the rule reads the VALID arm only). So
// the rule cannot be dropped, widened past either narrowing, or turned on another arm without moving the digest. Each
// is pinned by id to its disposition (`verif/reviewer-qualification-fingerprint.test.ts`) — a set pin cannot kill a
// mutant of one entry. ⭐ And the rule's LITERAL from its other side (the ER-2 verifier's finding [3]): a clean reply
// recommending CONDITIONALLY_SATISFIED, REJECTED or INCONCLUSIVE in turn, each SATISFIED, so the rule cannot be widened
// to any recommendation but ESCALATED without moving the digest either — each pinned by id alike.
//
// ⚠ THE CORPUS IS NEVER SENT TO A MODEL, and it does not tune anything: it is the fixed input of a measurement.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { ToolInvocationResult } from '../../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { CASE_PRODUCER_MODEL_ID, CASE_PRODUCER_PROVIDER_ID, type WorkProductCase } from './cases.js';

export interface CorpusEntry {
	readonly id: string;
	/** What the entry exercises — for the reader of a moved scoring digest. */
	readonly covers: string;
	/** What the transport returns on call 1, 2, … (the last repeats). */
	readonly replies: readonly (string | ToolInvocationResult)[];
}

/** The subject every entry is scored over — a work product with the case producer (`REG-D-072` D13). */
export const CORPUS_CASE: WorkProductCase = {
	id: 'SCORING-CORPUS',
	arm: 'WORK_PRODUCT',
	subject: {
		subjectId: 'art_01M4B2C5D8F1G4H7J0K3M6N9P2',
		objectType: 'ARTIFACT',
		semanticVersion: 1,
		isAiProduced: true,
		producer: {
			actorType: 'AGENT',
			agentId: 'jpwb-qualification-case-author',
			modelId: CASE_PRODUCER_MODEL_ID,
			providerId: CASE_PRODUCER_PROVIDER_ID
		}
	},
	input: {
		producingPrompt: 'Summarise the load analysis for the footbridge deck, stating each governing combination.',
		answer: 'ULS governs at mid-span under crowd load; SLS deflection is span/410 against a limit of span/350.'
	}
};

const row = (criterionId: string, failed: unknown = false, severity = 'INFORMATIONAL') => ({
	criterionId,
	failed,
	statement: failed === false ? 'absent' : 'present',
	severity
});
const reply = (rows: readonly unknown[], recommendation: unknown = 'SATISFIED'): string =>
	JSON.stringify({ findings: rows, recommendation, residualUncertainty: ['none noted'] });

/** A reply the tool reports as answered by `modelId` of `providerId`. */
const reportedBy = (text: string, modelId: string, providerId: string): ToolInvocationResult => ({
	answer: { arrived: true, text },
	rawOutput: text,
	producer: { agentId: 'devin', modelId, providerId },
	identityEvidence: 'PROVIDER_REPORTED',
	observedToolCalls: { canObserve: false, reason: 'A corpus reply: no tool ran.' }
});
/** A reply that names the case's own producer as the model that answered — independence fails. */
const reportedAsProducer = (text: string): ToolInvocationResult =>
	reportedBy(text, CASE_PRODUCER_MODEL_ID, CASE_PRODUCER_PROVIDER_ID);
/** Another model of the case producer's OWN provider — `REG-D-072` D13's producer model is used by no candidate. */
const SIBLING_MODEL_ID = `${CASE_PRODUCER_MODEL_ID}-sibling`;

/** ⭐ THE CORPUS, over `criteria` (the fingerprint's own), in a fixed order — the order, like each outcome, is hashed. */
export function scoringCorpus(criteria: readonly AssessmentCriterion[]): readonly CorpusEntry[] {
	const ids = criteria.map((c) => c.id);
	const [first = 'CRITERION-A', second = 'CRITERION-B', third = 'CRITERION-C', fourth = 'CRITERION-D'] = ids;
	const clean = reply(ids.map((id) => row(id)));
	/** ⭐ `JAN-ESCREC` D4 — every criterion clean, and the recommendation the ruling acts on (`REG-D-089`). */
	const escalated = reply(ids.map((id) => row(id)), 'ESCALATED');
	const cleanRow = JSON.stringify(row(second)).slice(0, -1);
	return [
		{ id: 'clean', covers: 'every criterion evaluated clean', replies: [clean] },
		{
			id: 'one-fault',
			covers: 'one criterion faulted, BLOCKING by the reviewer',
			replies: [reply(ids.map((id) => (id === fourth ? row(id, true, 'BLOCKING') : row(id))), 'REJECTED')]
		},
		{
			id: 'fault-understated',
			covers: 'a fault the reviewer calls ADVISORY — the policy, not the reviewer, sets its stakes',
			replies: [reply(ids.map((id) => (id === first ? row(id, true, 'ADVISORY') : row(id))), 'CONDITIONALLY_SATISFIED')]
		},
		{
			id: 'duplicate-key',
			covers: 'REG-F-428 (1), as measured: a second `failed` key carrying the statement',
			replies: [clean.replace(cleanRow, `${cleanRow},"failed":"No delegated professional obligation is omitted."`)]
		},
		{
			id: 'unknown-id',
			covers: 'REG-F-428: a finding under an id the policy does not declare, beside a full set',
			replies: [reply([...ids.map((id) => row(id)), row('RR-10-no-such-failure-class', true, 'BLOCKING')])]
		},
		{
			id: 'corrupted-id',
			covers: 'REG-F-428 (2): an id written with a space for a hyphen, so its criterion goes unjudged',
			replies: [reply(ids.map((id) => row(id === third ? id.replace(/-(?=[^-]*$)/, ' ') : id)))]
		},
		{
			id: 'non-boolean-failed',
			covers: 'REG-F-428: `failed` as a string, which the product reads as a fault',
			replies: [reply(ids.map((id) => (id === second ? row(id, 'no') : row(id))))]
		},
		{ id: 'fenced', covers: 'REG-F-428: the reply in a ```json fence', replies: [`\`\`\`json\n${clean}\n\`\`\``] },
		{
			id: 'prose-wrapped',
			covers: 'REG-F-428: prose before and after the JSON',
			replies: [`Here is my review of the work product.\n${clean}\nI hope this helps.`]
		},
		{
			id: 'repair',
			covers: 'the first reply fails to parse; the repair prompt is sent and its reply accepted',
			replies: ['I could not decide which failure classes apply.', clean]
		},
		{
			id: 'repair-fails',
			covers: 'both replies fail to parse: the validator throws, scored as the product scores a throw',
			replies: ['I could not decide.', 'Still undecided.']
		},
		{
			id: 'unknown-recommendation',
			covers: 'a recommendation outside the ladder',
			replies: [reply(ids.map((id) => row(id)), 'PASS')]
		},
		{
			id: 'skipped-row',
			covers: 'one criterion never answered',
			replies: [reply(ids.slice(1).map((id) => row(id)))]
		},
		// ⭐ P7-6 I5 — each of these two answers no criterion, so each now draws the criterion repair, which (its one reply
		// repeating) answers none again: the first judgement stands, as before the repair existed.
		{
			id: 'no-findings-array',
			covers: 'findings is not an array — and (P7-6 I5) the criterion repair answers none again, so the first judgement stands',
			replies: [JSON.stringify({ findings: 'none', recommendation: 'SATISFIED' })]
		},
		{
			id: 'bare-scalar',
			covers: 'a bare JSON scalar, which parses as a judgement with no findings — and (P7-6 I5) the criterion repair answers none again',
			replies: ['null']
		},
		// ⭐ `JAN-EXEC` Phase 7 P7-6 I5 (`DESIGN-the-reviewer-isolated.md` §4d; `REG-F-552`) — the measured run's own reply,
		// SATISFIED with not one row, now repaired once: here the criterion repair answers every criterion, and its judgement
		// is the one scored. So dropping the repair, or keeping the first judgement after a repair that answered, moves the
		// digest (the calls it drew, and its outcome); and the repair's line is hashed as the JSON repair's is (`fingerprint.ts`).
		{
			id: 'no-rows-repaired',
			covers: 'REG-F-552: SATISFIED with no findings at all; the criterion repair (P7-6 I5) answers every criterion clean, and its judgement is used',
			replies: ['{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}', clean]
		},
		{
			id: 'reported-as-producer',
			covers: 'the tool reports the producer as the model that answered — independence fails',
			replies: [reportedAsProducer(clean)]
		},
		{
			id: 'reported-by-the-producers-provider',
			covers: 'another model of the producer’s own provider answered — DIFFERENT_MODEL admits it, DIFFERENT_PROVIDER would not',
			replies: [reportedBy(clean, SIBLING_MODEL_ID, CASE_PRODUCER_PROVIDER_ID)]
		},
		{
			id: 'self-stipulated',
			covers: 'a row the model marks `stipulated: true` — read as it answered, never as a stipulation (REG-D-071)',
			replies: [reply(ids.map((id) => (id === first ? { ...row(id), stipulated: true } : row(id))))]
		},
		// ⭐ `JAN-ESCREC` ER-2 (D4) — `REG-D-089`'s rule (a), then the three places it must not reach (the header).
		{
			id: 'escalated-clean',
			covers: 'every criterion evaluated clean, the recommendation ESCALATED — REG-D-089 rule (a) escalates the review',
			replies: [escalated]
		},
		{
			id: 'escalated-beside-a-fault',
			covers: 'one criterion faulted, BLOCKING by the reviewer, the recommendation ESCALATED — REJECTED stays, "more actionable" (REG-D-089)',
			replies: [reply(ids.map((id) => (id === fourth ? row(id, true, 'BLOCKING') : row(id))), 'ESCALATED')]
		},
		{
			id: 'escalated-skipped-row',
			covers: 'one criterion never answered, the recommendation ESCALATED — INCONCLUSIVE stays: rule (a) is keyed on a computed SATISFIED, never on "no criterion failed" (REG-D-090)',
			replies: [reply(ids.slice(1).map((id) => row(id)), 'ESCALATED')]
		},
		{
			id: 'escalated-reported-as-producer',
			covers: 'a clean reply recommending ESCALATED, the producer reported as the model that answered — BOUNDARY_REJECTED stays: rule (a) reads a VALID result only (ASR-11; REG-D-090)',
			replies: [reportedAsProducer(escalated)]
		},
		// ⭐ `JAN-ESCREC` ER-2 (the ER-2 verifier's finding [3]) — and rule (a)'s LITERAL: a clean reply recommending any value
		// but ESCALATED stays SATISFIED (the header).
		{
			id: 'clean-recommends-conditionally-satisfied',
			covers: 'every criterion evaluated clean, the recommendation CONDITIONALLY_SATISFIED — SATISFIED stays: rule (a) reads the literal ESCALATED only (REG-D-090)',
			replies: [reply(ids.map((id) => row(id)), 'CONDITIONALLY_SATISFIED')]
		},
		{
			id: 'clean-recommends-rejected',
			covers: 'every criterion evaluated clean, the recommendation REJECTED — SATISFIED stays: the recommendation is not the verdict (REG-D-074), and rule (a) reads the literal ESCALATED only (REG-D-090)',
			replies: [reply(ids.map((id) => row(id)), 'REJECTED')]
		},
		{
			id: 'clean-recommends-inconclusive',
			covers: 'every criterion evaluated clean, the recommendation INCONCLUSIVE — SATISFIED stays: rule (a) reads the literal ESCALATED only (REG-D-090)',
			replies: [reply(ids.map((id) => row(id)), 'INCONCLUSIVE')]
		}
	];
}
