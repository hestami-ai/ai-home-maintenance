// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1, D3; roadmap §9a.2) —
// WHAT ONE TYPE'S REVIEW IS HANDED, BUILT IN ONE PLACE (`pwaTypeReviewInput`), AND HOW IT IS BOUNDED.
//
// ⛔ THE RED THIS ANSWERS (`REG-F-571`): one reviewer reading a whole 16-type PWA in one prompt is shown about half of it once
// each type's prompt and policies are exported, the later types cut. Each type is now its own part: its whole definition the
// subject, its place in the PWA the context — and the subject is never cut. A part whose children's skeletons do not fit has
// them cut child by child, each cut declared; one whose own subject cannot fit is refused as incomplete, never head-cut.
// ⛔ NO MODEL IS CALLED: every prompt is captured at the validator's print seam.
import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ProfessionalRationaleSummary,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, pwaTypeParts, type PwaGraphNode } from '@janumipwb/rph-projections';
import { describe, expect, it } from 'vitest';
import {
	createAgyReasoningReviewValidator,
	pwaTypeContentBudget,
	pwaTypeOverBudgetStatement,
	REASONING_REVIEW_BUDGET
} from './reasoning-review-validator.js';
import { codePoints, fenceCandidate, headCutDeclaration, jsonLine } from './review-fence.js';
import { graphReviewInput, pwaTypeReviewInput } from './review-input.js';
import {
	RUN11_SHAPED_ACCOUNT,
	RUN11_SHAPED_EXPORT,
	RUN11_SHAPED_NARRATION,
	RUN11_SHAPED_NODES,
	RUN11_SHAPED_REQUEST
} from './run11-shaped-pwa.testing.js';

const CRITERIA = SEEDED_REASONING_REVIEW_CRITERIA;
const { PROMPT_BUDGET } = REASONING_REVIEW_BUDGET;

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwut_01M6PART0000000000000000T1',
	objectType: 'PWU_TYPE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' }
};

const CLEAN = JSON.stringify({
	findings: CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

/** Every prompt the real validator sends for `input` on a clean reply — none when it refuses before sending. */
async function sentFor(input: ReasoningReviewInput): Promise<{ readonly prompts: string[]; readonly refusal?: string }> {
	const prompts: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		agentId: 'agy',
		modelId: 'test-judge-model',
		providerId: 'google',
		print: async (p) => {
			prompts.push(p);
			return CLEAN;
		}
	});
	try {
		await validator.evaluate(SUBJECT, { reasoningReview: input });
	} catch (e) {
		return { prompts, refusal: e instanceof Error ? e.message : String(e) };
	}
	return { prompts };
}

/** The one prompt sent for `input`. */
async function promptFor(input: ReasoningReviewInput): Promise<string> {
	const { prompts, refusal } = await sentFor(input);
	expect(refusal, 'the review was sent').toBeUndefined();
	expect(prompts, 'one prompt for a clean reply').toHaveLength(1);
	return prompts[0]!;
}

const ACCOUNT: ProfessionalRationaleSummary = {
	rationale: 'The realization is decomposed into the build and its verification.',
	assumptions: ['The brief is complete.'],
	limitations: ['Packaging is outside the request.'],
	residualUncertainty: ['Whether the tests need a data set.']
};

const node = (over: Partial<PwaGraphNode> & Pick<PwaGraphNode, 'id' | 'name'>): PwaGraphNode => ({
	pwuKind: over.name.toUpperCase().replace(/\W+/g, '_'),
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	executionBoundary: 'INTERNAL',
	...over
});
const PWA = {
	id: 'pwa_01M6PART00000000000000000P',
	name: 'wordfreq',
	domain: 'software',
	version: '1.0.0',
	publicationStatus: 'DRAFT',
	description: 'Realize wordfreq.'
} as const;

/** A small PWA: a root, and two children, each with a prompt of its own. */
const SMALL = buildPwaGraphExport(PWA, [
	node({
		id: 'pwut_01M6PART0000000000000000T1',
		name: 'Realization',
		isRoot: true,
		purpose: 'Construct and verify wordfreq.',
		permittedChildTypeIds: ['pwut_01M6PART0000000000000000T2', 'pwut_01M6PART0000000000000000T3'],
		requiredOutputs: ['report'],
		promptTemplate: { templateText: 'ROOT-PROMPT Realize {title}.', outputContract: 'ROOT-CONTRACT A report.', status: 'ACTIVE', templateVersion: 1 }
	}),
	node({
		id: 'pwut_01M6PART0000000000000000T2',
		name: 'Build',
		purpose: 'Build wordfreq.',
		requiredOutputs: ['binary'],
		promptTemplate: { templateText: 'BUILD-PROMPT Build {title}.', outputContract: 'BUILD-CONTRACT The binary.', status: 'ACTIVE', templateVersion: 3 }
	}),
	node({
		id: 'pwut_01M6PART0000000000000000T3',
		name: 'Check',
		purpose: 'Check wordfreq.',
		requiredInputs: ['binary'],
		requiredOutputs: ['report'],
		promptTemplate: { templateText: 'CHECK-PROMPT Check {title}.', status: 'DRAFT', templateVersion: 1 }
	})
]);
const [ROOT_PART, BUILD_PART, CHECK_PART] = pwaTypeParts(SMALL);

describe('⭐⭐ the review in parts, B1 — pwaTypeReviewInput: one type’s part, in the PWA_TYPE framing, as lines of JSON', () => {
	it('⭐ the input: the PWA_TYPE framing, the request as its instruction, and the part — its subject, its context, then each child’s skeleton, one line each', () => {
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'Realize wordfreq.', part: ROOT_PART! });
		expect([input.framing, input.prompt, input.criteria]).toEqual(['PWA_TYPE', 'Realize wordfreq.', CRITERIA]);
		expect(input.content.split('\n')).toEqual([
			jsonLine({ subject: ROOT_PART!.subject }),
			jsonLine({ context: ROOT_PART!.context }),
			jsonLine({ childSkeleton: ROOT_PART!.childSkeletons[0] }),
			jsonLine({ childSkeleton: ROOT_PART!.childSkeletons[1] })
		]);
		expect(input.content.split('\n').map((l) => Object.keys(JSON.parse(l) as object))).toEqual([
			['subject'],
			['context'],
			['childSkeleton'],
			['childSkeleton']
		]);
		expect('declaredPartCut' in input, 'a part that fits is not cut').toBe(false);
		expect(pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: BUILD_PART! }).content.split('\n'), 'a leaf: two lines').toHaveLength(2);
	});

	it('⭐ the options are passed as the graph’s are: a non-empty hash, the account, the narration always, prior findings when there are any — in the graph’s key order', () => {
		const full = pwaTypeReviewInput({
			criteria: CRITERIA,
			prompt: 'Realize wordfreq.',
			part: ROOT_PART!,
			candidateSubjectHash: 'sha256:0f1e',
			rationale: ACCOUNT,
			narration: 'Defined the types.',
			priorGaps: ['RR-02: the check is missing.']
		});
		expect(Object.keys(full)).toEqual(['criteria', 'framing', 'prompt', 'content', 'candidateSubjectHash', 'rationale', 'narration', 'prior']);
		expect([full.candidateSubjectHash, full.rationale, full.narration, full.prior]).toEqual([
			'sha256:0f1e',
			ACCOUNT,
			'Defined the types.',
			{ gaps: ['RR-02: the check is missing.'] }
		]);
		const none = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: ROOT_PART!, candidateSubjectHash: '', priorGaps: [] });
		expect(Object.keys(none), 'an empty hash is no hash, and empty prior findings none').toEqual(['criteria', 'framing', 'prompt', 'content', 'narration']);
		expect(none.narration).toBe('');
		// ⭐ The same options give the graph's builder the same shape around its content.
		const graph = graphReviewInput({ criteria: CRITERIA, prompt: 'x', graph: SMALL, candidateSubjectHash: 'h', rationale: ACCOUNT, narration: 'n', priorGaps: ['g'] });
		const part = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: ROOT_PART!, candidateSubjectHash: 'h', rationale: ACCOUNT, narration: 'n', priorGaps: ['g'] });
		expect(Object.keys(part)).toEqual(Object.keys(graph));
	});

	it('⭐ the prompt: the part stands whole between two lines of one fence — its subject a line, its context another — and the request is its instruction', async () => {
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'Realize wordfreq from its brief.', part: ROOT_PART!, rationale: ACCOUNT });
		const lines = (await promptFor(input)).split('\n');
		const parts = input.content.split('\n');
		const at = lines.indexOf(parts[0]!);
		expect(at, 'the subject, whole, on a line of its own').toBeGreaterThan(0);
		expect(lines.slice(at, at + parts.length), 'then the context and each child’s skeleton, in order').toEqual(parts);
		expect(lines[at - 1], 'a fence line before the part').toMatch(/^<<<UNTRUSTED-\d\d>>>$/);
		expect(lines[at + parts.length], 'the same fence line after it').toBe(lines[at - 1]);
		const intent = lines.indexOf('The PWA this type belongs to was authored by a DIFFERENT AI agent from this request:');
		expect(lines.slice(intent + 1, intent + 4), 'the request, fenced, as the instruction').toEqual([lines[at - 1], 'Realize wordfreq from its brief.', lines[at - 1]]);
	});

	it('⛔ SUBJECT BYTES ARE NOT CONTEXT BYTES: a type’s own prompt is on its subject line; a child’s is in no line of its parent’s part, and a parent’s in no line of its child’s', async () => {
		const root = await promptFor(pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: ROOT_PART! }));
		const subjectLine = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: ROOT_PART! }).content.split('\n')[0]!;
		expect([subjectLine.includes('ROOT-PROMPT'), subjectLine.includes('ROOT-CONTRACT')], 'the root’s own, on its subject line').toEqual([true, true]);
		for (const secret of ['BUILD-PROMPT', 'BUILD-CONTRACT', 'CHECK-PROMPT'])
			expect(root.includes(secret), `${secret} in the root’s prompt`).toBe(false);
		// ⭐ Each child's skeleton keeps its prompt's status and version.
		expect(root).toContain('"promptTemplate":{"status":"ACTIVE","templateVersion":3}');
		expect(root).toContain('"promptTemplate":{"status":"DRAFT","templateVersion":1}');
		for (const part of [BUILD_PART!, CHECK_PART!]) {
			const p = await promptFor(pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part }));
			expect(p.includes('ROOT-PROMPT') || p.includes('ROOT-CONTRACT'), `${part.subject.type.name}: its parent’s prompt`).toBe(false);
		}
	});
});

// ── the bounds: the subject protected, the children cut child by child, an oversized subject refused ─────────────────
const over = (n: number, unit: string): string => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);

/**
 * A composite with one small child (unless `small` is false) and `big` children whose skeletons are each `size` characters
 * of purpose; `purpose` is the composite's own.
 */
function wideComposite(big: number, size: number, small = true, purpose = 'Compose many children.') {
	const kids = Array.from({ length: big }, (_, i) =>
		node({ id: `pwut_01M6WIDE00000000000000${String(i).padStart(4, '0')}`, name: `Wide ${i}`, purpose: over(size, `Wide child ${i} purpose. `) })
	);
	const tiny = node({ id: 'pwut_01M6WIDE0000000000000TINY', name: 'Tiny', purpose: 'Small.' });
	const children = small ? [tiny, ...kids] : kids;
	const root = node({
		id: 'pwut_01M6WIDE0000000000000ROOT',
		name: 'Wide Root',
		isRoot: true,
		purpose,
		permittedChildTypeIds: children.map((k) => k.id),
		promptTemplate: { templateText: 'WIDE-ROOT-PROMPT Compose {title}.', outputContract: 'WIDE-ROOT-CONTRACT', status: 'ACTIVE', templateVersion: 1 }
	});
	return pwaTypeParts(buildPwaGraphExport(PWA, [root, ...children]))[0]!;
}

describe('⭐⭐ the review in parts, B1 — the bounds: the whole subject protected, over-budget children cut child by child, an oversized subject refused', () => {
	it('⭐ CONTROL — a part that fits is sent whole: its subject’s prompt text and output contract in the prompt, no cut declared', async () => {
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: ROOT_PART!, rationale: ACCOUNT });
		const p = await promptFor(input);
		expect(p).toContain('ROOT-PROMPT Realize {title}.');
		expect(p).toContain('ROOT-CONTRACT A report.');
		expect(p, 'no cut').not.toContain('[CUT FOR THIS REVIEW: the skeleton of');
	});

	it('⛔ AN OVERSIZED SUBJECT IS REFUSED AS INCOMPLETE, NEVER CUT — the statement says what and by how much, and no prompt is sent', async () => {
		const huge = pwaTypeParts(
			buildPwaGraphExport(PWA, [
				node({
					id: 'pwut_01M6HUGE0000000000000000T1',
					name: 'Huge',
					isRoot: true,
					purpose: 'One type whose own definition is longer than any prompt.',
					promptTemplate: { templateText: over(30_000, 'Do the work. '), outputContract: 'HUGE-CONTRACT', status: 'ACTIVE', templateVersion: 1 }
				})
			])
		)[0]!;
		const budget = pwaTypeContentBudget({ criteria: CRITERIA, framing: 'PWA_TYPE', prompt: 'x', rationale: ACCOUNT, narration: '' });
		const whole = `${jsonLine({ subject: huge.subject })}\n${jsonLine({ context: huge.context })}`;
		expect(whole.length, 'arrangement: the subject alone is over the budget').toBeGreaterThan(budget);
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part: huge, rationale: ACCOUNT });
		expect(input.content, 'its builder hands the part on whole: nothing of a subject is cut').toBe(whole);
		expect('declaredPartCut' in input, 'and declares no cut').toBe(false);
		const { prompts, refusal } = await sentFor(input);
		expect(prompts, 'no prompt is sent').toEqual([]);
		expect(refusal).toBe(pwaTypeOverBudgetStatement(input.content.length, budget));
		expect(refusal).toBe(
			`This review was not sent: the part it was handed — one type’s whole definition, its subject, with its context and any cut its builder declared — is ${input.content.length} characters, and this prompt leaves it ${budget} (REG-D-125). A part is never cut here, where a cut could remove its subject, so the review is incomplete. No model was called.`
		);
	});

	it('⭐ OVER-BUDGET CHILDREN ARE CUT CHILD BY CHILD: the subject and context whole, each big child’s skeleton its HEAD under its own declaration, a small child whole, and the part within its room', async () => {
		const part = wideComposite(6, 5_000);
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'Compose them.', part, rationale: ACCOUNT });
		const budget = pwaTypeContentBudget({ criteria: CRITERIA, framing: 'PWA_TYPE', prompt: 'Compose them.', rationale: ACCOUNT, narration: '' });
		const whole = [jsonLine({ subject: part.subject }), jsonLine({ context: part.context }), ...part.childSkeletons.map((s) => jsonLine({ childSkeleton: s }))];
		expect(whole.join('\n').length, 'arrangement: the whole part is over its budget').toBeGreaterThan(budget);
		const lines = input.content.split('\n');
		expect(lines.slice(0, 2), 'the subject and context lines, whole').toEqual(whole.slice(0, 2));
		expect(lines, 'one line per child, none lost').toHaveLength(whole.length);
		expect(lines[2], 'the small child, whole').toBe(whole[2]);
		expect(input.declaredPartCut, 'the big children are cut, and the cuts declared').toBeDefined();
		const declarations = input.declaredPartCut!.split('\n');
		expect(declarations, 'one declaration per child cut, in their order').toEqual(
			part.childSkeletons.slice(1).map((s, i) => {
				const shown = lines[i + 3]!;
				expect(whole[i + 3]!.startsWith(shown) && shown.length < whole[i + 3]!.length, `${s.name}: its HEAD, cut`).toBe(true);
				expect(shown, `${s.name}: its id and name kept`).toContain(`"id":${jsonLine(s.id)},"name":${jsonLine(s.name)}`);
				const total = codePoints(whole[i + 3]!);
				return headCutDeclaration(`the skeleton of the child ${jsonLine(s.name)} (${jsonLine(s.id)})`, codePoints(shown), total, total - codePoints(shown));
			})
		);
		expect(input.declaredPartCut!.length + 1 + input.content.length, 'the declarations counted in the part’s room').toBeLessThanOrEqual(budget);
		// ⭐ And the review is sent: the declarations on host lines before the part's fence, the part as built.
		const p = await promptFor(input);
		const at = p.split('\n').indexOf(lines[0]!);
		expect(p.split('\n').slice(at - 1 - declarations.length, at - 1), 'the declarations, before the fence').toEqual(declarations);
		expect(p).toContain('WIDE-ROOT-PROMPT Compose {title}.');
	});

	it('⛔ THE SUBJECT IS PROTECTED HOWEVER MUCH OF THE ROOM IT TAKES: a composite whose own definition is most of its budget keeps it whole, and its children share what is left', async () => {
		// ⛔ THE MUTANT: the subject cut to a share like a child's. A small subject passes that by needing less than its share,
		// so this one needs more than any share of its room.
		const part = wideComposite(6, 5_000, false, over(8_000, 'The composite’s own long purpose. '));
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'Compose them.', part, rationale: ACCOUNT });
		const budget = pwaTypeContentBudget({ criteria: CRITERIA, framing: 'PWA_TYPE', prompt: 'Compose them.', rationale: ACCOUNT, narration: '' });
		const subject = jsonLine({ subject: part.subject });
		expect(subject.length, 'arrangement: the subject is more than an equal share of the room').toBeGreaterThan(budget / (part.childSkeletons.length + 1));
		const lines = input.content.split('\n');
		expect([lines[0], lines[1]], 'the subject and context, whole').toEqual([subject, jsonLine({ context: part.context })]);
		expect(input.declaredPartCut, 'the children are cut, and the cuts declared').toBeDefined();
		expect(input.declaredPartCut!.split('\n'), 'every child cut, each declared').toHaveLength(part.childSkeletons.length);
		expect(input.declaredPartCut!.length + 1 + input.content.length).toBeLessThanOrEqual(budget);
		expect(await promptFor(input), 'and sent, its subject whole').toContain(subject);
	});

	it('⛔ the fence is chosen over the cut’s declarations too: a child cut short of its name, its name a fence candidate, takes the next token', async () => {
		// The child's long id comes before its name, so its share keeps neither its name nor anything after it: its name is
		// in the prompt only on the declaration's host line.
		const planted = node({ id: `pwut_${over(3_000, 'X')}`, name: fenceCandidate(0), pwuKind: 'PLANTED', purpose: over(4_000, 'Planted. ') });
		const others = Array.from({ length: 5 }, (_, i) => node({ id: `pwut_01M6PLANT000000000000000${i}`, name: `Other ${i}`, purpose: over(4_000, 'Other. ') }));
		const root = node({ id: 'pwut_01M6PLANT00000000000000RT', name: 'Planted Root', isRoot: true, permittedChildTypeIds: [planted.id, ...others.map((o) => o.id)] });
		const part = pwaTypeParts(buildPwaGraphExport(PWA, [root, planted, ...others]))[0]!;
		const input = pwaTypeReviewInput({ criteria: CRITERIA, prompt: 'x', part });
		const kept = input.content.split('\n')[2]!;
		expect(kept.includes(fenceCandidate(0)), 'arrangement: the planted name is cut from its line').toBe(false);
		expect(input.content.includes(fenceCandidate(0)), 'arrangement: and is in no kept byte of the part').toBe(false);
		expect(input.declaredPartCut, 'arrangement: it is named in the declarations').toContain(jsonLine(fenceCandidate(0)));
		const p = await promptFor(input);
		const fences = new Set(p.split('\n').filter((l) => /^<<<UNTRUSTED-\d\d>>>$/.test(l)));
		expect([...fences], 'the planted candidate is not the fence').not.toContain(fenceCandidate(0));
		for (const token of fences) {
			const own = p.split('\n').filter((l) => l === token).length;
			expect(p.split(token).length - 1, `${token} only on its fence lines`).toBe(own);
		}
	});
});

// ── the measurement (roadmap §9a.2 "Measure"): a run-11-shaped PWA, whole and in parts ────────────────────────────────
/** `text` as a string inside a line of JSON writes it, without its quotes. */
const inJson = (text: string): string => jsonLine(text).slice(1, -1);
const VARIANTS = {
	/** The request, account and narration of about the size a turn leaves (`run11-shaped-pwa.testing.ts`). */
	'a turn’s own sizes': {
		prompt: RUN11_SHAPED_REQUEST,
		rationale: RUN11_SHAPED_ACCOUNT,
		narration: RUN11_SHAPED_NARRATION,
		candidateSubjectHash: `sha256:${'0f'.repeat(32)}`
	},
	/** Every bounded slice beside the part at its limit: the request, the account and the narration. */
	'every bounded slice at its limit': {
		prompt: over(REASONING_REVIEW_BUDGET.USER_INTENT_MAX, 'Realize wordfreq. '),
		rationale: {
			rationale: over(4_000, 'Each phase is a composite. '),
			assumptions: [over(1_500, 'An assumption. ')],
			limitations: [over(1_500, 'A limit. ')],
			residualUncertainty: [over(1_500, 'A doubt. ')]
		},
		narration: over(REASONING_REVIEW_BUDGET.NARRATION_MAX, 'Defined a type. '),
		candidateSubjectHash: `sha256:${'0f'.repeat(32)}`
	}
} as const;

describe('⭐⭐ the review in parts, B1 — measured on a run-11-shaped PWA: the whole-graph review cuts it, and its parts each fit whole', () => {
	it('⭐ the fixture is run-11’s shape: 16 types — one root, four middle composites, eleven leaves, three levels — each with a purpose of about 150 characters, two or three policies and an ACTIVE prompt of about 500-600 characters with an output contract', () => {
		const parts = pwaTypeParts(RUN11_SHAPED_EXPORT);
		expect(parts).toHaveLength(16);
		expect(RUN11_SHAPED_EXPORT.roots).toHaveLength(1);
		const composites = parts.filter((p) => p.childSkeletons.length > 0);
		expect([composites.length - 1, parts.length - composites.length], 'middle composites, leaves').toEqual([4, 11]);
		expect(Math.max(...parts.map((p) => p.context.ancestors.length)) + 1, 'levels').toBe(3);
		for (const n of RUN11_SHAPED_NODES) {
			expect(n.purpose!.length, n.name).toBeGreaterThanOrEqual(120);
			expect(n.purpose!.length, n.name).toBeLessThanOrEqual(180);
			expect([2, 3], n.name).toContain(n.requiredAssurancePolicyIds!.length);
			expect(n.promptTemplate!.status, n.name).toBe('ACTIVE');
			expect(n.promptTemplate!.templateText.length, n.name).toBeGreaterThanOrEqual(500);
			expect(n.promptTemplate!.templateText.length, n.name).toBeLessThanOrEqual(650);
			expect(n.promptTemplate!.outputContract, n.name).toBeDefined();
		}
	});

	it('⛔ RED FIRST (REG-F-571) — the WHOLE-GRAPH review of the same PWA is cut, and the later types’ prompt text is in no prompt it sends', async () => {
		for (const [label, v] of Object.entries(VARIANTS)) {
			const p = await promptFor(graphReviewInput({ criteria: CRITERIA, graph: RUN11_SHAPED_EXPORT, ...v }));
			expect(p, `${label}: the graph is cut`).toContain('[CUT FOR THIS REVIEW: the artifact — the first ');
			const lost = RUN11_SHAPED_NODES.filter((n) => !p.includes(inJson(n.promptTemplate!.templateText))).map((n) => n.name);
			expect(lost.length, `${label}: types whose prompt text the graph review does not show whole`).toBeGreaterThan(0);
			expect(lost, `${label}: they are the later types`).toContain(RUN11_SHAPED_NODES.at(-1)!.name);
		}
	});

	it('⭐ IN PARTS — every type’s prompt text and output contract reach its own part’s prompt whole, every part prompt is within PROMPT_BUDGET, and no cut is declared, at a turn’s sizes and with every bounded slice at its limit', async () => {
		const parts = pwaTypeParts(RUN11_SHAPED_EXPORT);
		for (const [label, v] of Object.entries(VARIANTS))
			for (const t of RUN11_SHAPED_NODES) {
				// ⭐ OVER THE PWA'S TYPES, NOT THE PARTS RETURNED: a type with no part of its own reaches no reviewer prompt.
				const what = `${label}, ${t.name}`;
				const part = parts.find((x) => x.typeId === t.id);
				expect(part, `${what}: its own part`).toBeDefined();
				const input = pwaTypeReviewInput({ criteria: CRITERIA, part: part!, ...v });
				const p = await promptFor(input);
				expect(p.length, `${what}: within PROMPT_BUDGET`).toBeLessThanOrEqual(PROMPT_BUDGET);
				expect('declaredPartCut' in input, `${what}: no cut`).toBe(false);
				expect(p, `${what}: no cut declared`).not.toContain('[CUT FOR THIS REVIEW: the skeleton of');
				// ⚠ As the part's JSON line writes them: a contract's quotes are escaped there.
				expect(p, `${what}: its own prompt text, whole`).toContain(inJson(t.promptTemplate!.templateText));
				expect(p, `${what}: its own output contract, whole`).toContain(inJson(t.promptTemplate!.outputContract!));
				for (const s of part!.childSkeletons)
					expect(p.includes(inJson(RUN11_SHAPED_NODES.find((n) => n.id === s.id)!.promptTemplate!.templateText)), `${what}: ${s.name}’s prompt text`).toBe(false);
			}
	});
});
