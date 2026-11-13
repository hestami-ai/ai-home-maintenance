// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L12 — design D67 (`REG-D-156` (1); `REG-F-628`; the lead's words, decision (a)) — THE REFINEMENT'S
// DIRECTIVE ASKS FOR EACH FINDING'S PROBLEM WHEREVER IT OCCURS.
//
// ⛔ WHAT WAS WRONG. P6 again's sixth paid run stopped in its authoring (`REG-F-628`): the first round rejected one evidence leaf for a
// gap its sibling shared, and the one refinement repaired the named type alone, as the directive asked — it lists the coded findings
// by the type each was recorded under, and nothing in it asks that a finding's problem be looked for in, or fixed in, the types it
// does not name; it said every type is reviewed again only when some type's review had failed operationally.
// ⭑ WHAT MUST HOLD. The lead's two sentences, after *"… do not merely restate the intent:"* and before the findings; nothing else in
// the directive changes — the findings by type, the bound on a type's findings, the failed parts' clause, the original intent.
//
// ⭑ PURE: `refineDirective` over stand-in findings, as the authoring route hands it a round's (`classifyFloorRemediation`'s
// `findings` and `failedParts`). No engine, no reviewer, no model.
import { describe, expect, it } from 'vitest';
import { refineDirective, type FloorObservationView, type FloorPartName } from './floor.js';

/** The directive's first two lines, as HEAD renders them (`floor.ts`, `refineDirective`). */
const OPENING = [
	'An independent assurance Reasoning Review produced valid findings about the authored PWA subject, reviewed type by type.',
	'Revise the PWA graph and/or its recorded professional rationale as each coded finding requires; do not merely restate the intent:'
];
/** ⭐ D67 — the lead's two sentences, verbatim (`l12-facts.md` §3 (a); design D67). */
const EVERY_TYPE =
	'Every type of the PWA is reviewed again after this revision, not only those named below. Where a finding names a problem, look for the same problem in every other type and fix it wherever it occurs.';

const SUCCESS_LEAF = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W11';
const FAILURE_LEAF = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W12';
const DESIGN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W13';
const INTENT = 'Realize the CLI product the Undertaking describes.';

/** A finding as the classifier hands it on: its code, severity and statement, and the type its part was recorded under. */
const finding = (
	typeId: string | undefined,
	typeName: string | undefined,
	code: string,
	statement: string
): FloorObservationView => ({
	code,
	severity: 'BLOCKING',
	statement,
	...(typeId === undefined ? {} : { typeId }),
	...(typeName === undefined ? {} : { typeName })
});

/** ⭑ A STAND-IN for the sixth run's first-round finding, its words as the register quotes them (`REG-F-628`); the ids are stand-ins. */
const SIXTH_RUN_FIRST_ROUND = finding(
	SUCCESS_LEAF,
	'Successful Workflow E2E Verification',
	'RR-07-no-contradiction',
	"The account asserts that prompts explicitly prohibit inventing run evidence, but this type's ACTIVE prompt contains no such explicit prohibition, overstating the evidence-integrity control."
);

describe('⭐⭐ L12 — D67: the refinement directive asks for each finding’s problem in every type, the rest unchanged', () => {
	// ⛔ PREDICTED RED, read from the code at 7e45efb0: the directive's third line is the first type's findings heading, and the two
	// sentences are nowhere in it.
	it('⭐ RED — one type’s finding (a stand-in for the sixth run’s first round): the directive, whole, the two sentences after the opening and before the findings', () => {
		expect(refineDirective(INTENT, [SIXTH_RUN_FIRST_ROUND])).toBe(
			[
				...OPENING,
				EVERY_TYPE,
				`Findings about the type "Successful Workflow E2E Verification" (${SUCCESS_LEAF}):`,
				"1. [RR-07-no-contradiction] The account asserts that prompts explicitly prohibit inventing run evidence, but this type's ACTIVE prompt contains no such explicit prohibition, overstating the evidence-integrity control.",
				'',
				`Original intent: ${INTENT}`
			].join('\n')
		);
	});

	// ⛔ PREDICTED RED, read from the code at 7e45efb0: no line of the directive is the two sentences. ⭑ The rest is HEAD's, byte for
	// byte: each arrangement's directive with that one line taken out is the text HEAD renders, written out here line by line.
	it('⭐ RED — the rest byte for byte: two types, the PWA as a whole, a type past its bound, and the failed parts — each its HEAD text with the one line added, in its place', () => {
		const many = Array.from({ length: 8 }, (_, i) =>
			finding(DESIGN, 'CLI and Error Handling Design', 'RR-04-no-proxy-satisfaction', `Design finding ${i + 1}.`)
		);
		const failed: FloorPartName[] = [{ typeId: FAILURE_LEAF, typeName: 'Failure and Interface E2E Verification' }];
		const cases: { readonly name: string; readonly directive: string; readonly head: readonly string[] }[] = [
			{
				name: 'two types, in the order their findings came',
				directive: refineDirective(INTENT, [
					SIXTH_RUN_FIRST_ROUND,
					finding(FAILURE_LEAF, 'Failure and Interface E2E Verification', 'RR-04-no-proxy-satisfaction', 'The sole run-evidence artifact is self-reported.')
				]),
				head: [
					...OPENING,
					`Findings about the type "Successful Workflow E2E Verification" (${SUCCESS_LEAF}):`,
					"1. [RR-07-no-contradiction] The account asserts that prompts explicitly prohibit inventing run evidence, but this type's ACTIVE prompt contains no such explicit prohibition, overstating the evidence-integrity control.",
					'',
					`Findings about the type "Failure and Interface E2E Verification" (${FAILURE_LEAF}):`,
					'1. [RR-04-no-proxy-satisfaction] The sole run-evidence artifact is self-reported.',
					'',
					`Original intent: ${INTENT}`
				]
			},
			{
				name: 'a finding about the PWA as a whole',
				directive: refineDirective(INTENT, [finding(undefined, undefined, 'RR-02-no-obligation-elision', 'A delegated obligation is absent.')]),
				head: [
					...OPENING,
					'Findings about the PWA as a whole:',
					'1. [RR-02-no-obligation-elision] A delegated obligation is absent.',
					'',
					`Original intent: ${INTENT}`
				]
			},
			{
				name: 'a type past its bound of six',
				directive: refineDirective(INTENT, many),
				head: [
					...OPENING,
					`Findings about the type "CLI and Error Handling Design" (${DESIGN}):`,
					...Array.from({ length: 6 }, (_, i) => `${i + 1}. [RR-04-no-proxy-satisfaction] Design finding ${i + 1}.`),
					'(2 further finding(s) about this type are not listed here.)',
					'',
					`Original intent: ${INTENT}`
				]
			},
			{
				name: 'a finding beside a part whose review failed operationally',
				directive: refineDirective(INTENT, [SIXTH_RUN_FIRST_ROUND], failed),
				head: [
					...OPENING,
					`Findings about the type "Successful Workflow E2E Verification" (${SUCCESS_LEAF}):`,
					"1. [RR-07-no-contradiction] The account asserts that prompts explicitly prohibit inventing run evidence, but this type's ACTIVE prompt contains no such explicit prohibition, overstating the evidence-integrity control.",
					'',
					'The review of 1 type(s) failed operationally and recorded no finding about them; every type, these included, is reviewed again after this revision. Do not change them on account of that failure:',
					`- "Failure and Interface E2E Verification" (${FAILURE_LEAF})`,
					'',
					`Original intent: ${INTENT}`
				]
			}
		];
		for (const { name, directive, head } of cases) {
			const lines = directive.split('\n');
			expect(lines.slice(0, 3), `${name}: the two sentences are not the directive’s third line`).toEqual([...OPENING, EVERY_TYPE]);
			expect(
				lines.filter((line) => line === EVERY_TYPE),
				`${name}: the two sentences are said other than once`
			).toHaveLength(1);
			expect([...lines.slice(0, 2), ...lines.slice(3)], `${name}: the rest of the directive is not HEAD’s, byte for byte`).toEqual(head);
		}
	});
});
