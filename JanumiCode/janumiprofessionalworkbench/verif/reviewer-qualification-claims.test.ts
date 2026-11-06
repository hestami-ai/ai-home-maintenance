// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D45 (`REG-D-145`; `DESIGN-data-flow-order-and-deliverable-review.md` §11.6, revision 8;
// `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z1 predicted red 5) — THE QUALIFICATION READS THE CLAIMS LIST AS THE
// PRODUCT DOES.
//
// The measured section asks every reply for a claims list, before its findings (`CLAIMS_SHAPE`), and the product reads it
// (`coerceJudgement`: each item an object with string `claim`, `evidence` and `status`, kept and never scored). ⛔ Before
// Z1 the qualification's record read three keys of a judgement (`JUDGEMENT_READ_KEYS`), so every reply the construct asks
// for would have been marked `UNREAD_KEY` — a malformation the reviewer never made — and its retained form would have lost
// the list. Now `claims` is read too: a reply carrying one is no `UNREAD_KEY`, its retained form keeps it, an item's key
// the product does not read is still `UNREAD_KEY`, and a reply without claims stays well formed. No malformation class is
// added.
import { describe, expect, it } from 'vitest';
import { detectMalformations } from '../scripts/reviewer-qual/malformations.js';
import { JUDGEMENT_READ_KEYS, MALFORMATION_CLASSES, projectJudgement, retainedAnswer } from '../scripts/reviewer-qual/record.js';

const IDS = new Set(['RR-01-no-problem-substitution', 'RR-02-no-obligation-elision']);
const FINDINGS = [...IDS].map((criterionId) => ({ criterionId, failed: false, statement: 'met', severity: 'MATERIAL' }));
const CLAIMS = [
	{ claim: 'The file holds 12 words.', evidence: 'the file shows 13', status: 'CONTRADICTED' },
	{ claim: 'The file is read once.', evidence: 'one read', status: 'BORNE OUT' }
];
const reply = (over: Record<string, unknown>): string =>
	JSON.stringify({ claims: CLAIMS, findings: FINDINGS, recommendation: 'SATISFIED', residualUncertainty: [], ...over });

describe('⛔ PREDICTED RED 5, the qualification’s half (Z1; D45) — claims are a key the product reads', () => {
	it('⭐ JUDGEMENT_READ_KEYS names claims, after the three it read before', () => {
		expect(JUDGEMENT_READ_KEYS).toEqual(['findings', 'recommendation', 'residualUncertainty', 'claims']);
	});

	it('⭐ a reply carrying a well-formed claims list is well formed: no UNREAD_KEY', () => {
		expect(detectMalformations(reply({}), IDS)).toEqual([]);
	});

	it('⭐ a reply without claims stays well formed', () => {
		const { claims: _claims, ...rest } = JSON.parse(reply({})) as Record<string, unknown>;
		expect(detectMalformations(JSON.stringify(rest), IDS)).toEqual([]);
	});

	it('⭐ the retained form keeps each claim’s claim, evidence and status, and drops a key the product does not read inside one', () => {
		const parsed = JSON.parse(reply({ claims: [{ ...CLAIMS[0], note: 'unread' }, CLAIMS[1]] })) as Record<string, unknown>;
		expect(projectJudgement(parsed).claims).toEqual(CLAIMS);
		expect(retainedAnswer(parsed)).toContain('"claims":[{"claim":"The file holds 12 words.","evidence":"the file shows 13","status":"CONTRADICTED"}');
		expect(detectMalformations(JSON.stringify(parsed), IDS), 'the unread key inside a claim is still unread').toEqual(['UNREAD_KEY']);
	});

	it('⭑ CONTROL — no malformation class is added for claims: the thirteen are as they were', () => {
		expect(MALFORMATION_CLASSES).toEqual([
			'NO_ANSWER_SPAN',
			'UNPARSEABLE',
			'FENCED',
			'PROSE_WRAPPED',
			'DUPLICATE_KEY',
			'NO_FINDINGS_ARRAY',
			'MALFORMED_FINDING',
			'UNDECLARED_CRITERION_ID',
			'DUPLICATE_CRITERION',
			'NON_BOOLEAN_FAILED',
			'MISSING_CRITERION',
			'UNKNOWN_RECOMMENDATION',
			'UNREAD_KEY'
		]);
	});
});
