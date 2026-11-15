// ⭐⭐ `JAN-EXEC` Phase 7, package L16 — design D70 (`REG-D-163` (1); `REG-F-640`) and design D71 (`REG-D-163` (2); `REG-F-640`; `REG-Q-034`) —
// A UNIT IS TOLD THE CRITERIA ITS DECLARED REVIEWS WILL JUDGE IT BY; AND A UNIT THEY REJECT CAN HAVE ITS WORK RE-RUN ONCE WITH THEIR
// FINDINGS, IN PLACE, BY CANON'S ONE WAY BACK — THROUGH THE PAGE'S OWN ACTIONS, AND THE KERNEL'S GUARD AT ITS COMMAND SEAM.
//
// ⛔ WHAT WAS WRONG (`REG-F-640`). P6 again's eighth run ended withheld at its first unit: the Requirements Specification was rejected by its
// declared assumption-disclosure review for AD-04, "Materiality is classified.", a criterion its instruction never named; and a unit its
// declared reviews reject had no second try — the page re-ran work only from a unit stopped mid-execution, and the contracted transition
// table had no edge from a rejected declared assurance back to work.
//
// ⭑ WHAT MUST HOLD (the sponsor's ruling `REG-D-163`; the policies, the words, the seat, the rebuilds, the rows, the guard, the act, the
// findings and the sign-off after it are the lead's, D70 and D71):
//   · D70 — a unit's instruction states, after its output contract and before D69's section, the criteria of each governing declared policy
//     its sign-off will select, policy by policy in the selection's order and each criterion in its policy's order; as it is sent, as its
//     review is shown it, as a work re-run sends it and as a re-review and a declared review rebuild it. None governing: no section.
//   · D71 — a unit its declared reviews rejected at its sign-off is offered "Re-run the work with the reviews' findings", and only it; the act
//     records the person's Decision, the move back to planning on three axes and a new plan in one batch, then runs the work as a work re-run
//     does, its first turn the instruction and then each rejecting verdict's failed criteria (neither MET nor NOT_APPLICABLE), coded by id, the
//     recorded rationale their statement; the sign-off after it judges the new work alone; Mark Satisfied writes the new work's file.
//   · the kernel refuses the move without a REJECTED declared assurance, without the Decision, or as part of the one move.
//
// ⭑ THE ARRANGEMENT, IN TEST MODE (package L15's `accepted-work.route.test.ts`): the floor's reviewer is devin, its PROGRAM replaced at its
// exec seam; the DECLARED policies' reviewer is stood in for at its seam (`createDeclaredPolicyReviewer`), so a case answers each criterion
// with any recorded outcome; the producer is a scripted session whose work product names its session's number (`ATTEMPT <n>`), so the first
// attempt and the re-run make different work; one in-memory workspace per Undertaking, held across requests; the real content store.
// ⛔ HERMETIC: devin's exec seam starts nothing; no process is started; PATH finds no program; the decision model is the product's double.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every prompt the floor's validator handed devin, in order. */
	prompts: [] as string[],
	/** What devin answers a prompt (a throw fails the call at its transport): undefined is a clean review over its own rubric. */
	review: undefined as undefined | ((prompt: string) => string | undefined),
	/** Every turn a producer was sent, in order. */
	turns: [] as string[],
	/** One in-memory sandbox per Undertaking, held across requests. */
	workspaces: new Map<string, unknown>(),
	/** How many producer sessions the route opened. */
	opens: 0,
	/** Every declared review the route asked for: its policy, the instruction it was shown, and the work it was shown. */
	declared: [] as { readonly policyId: string; readonly prompt: string; readonly content: string }[],
	/** What the declared reviewer answers a policy's review: set in `beforeEach`, every criterion MET. */
	answer: (() => {
		throw new Error('arrangement: no declared answer set');
	}) as (policyId: string) => unknown
}));

vi.mock('./workspace-host.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./workspace-host.js')>();
	const { createInMemoryWorkspace, createRefusingProcessRunner } = await import('@janumipwb/rph-ports');
	return {
		...actual,
		resolveUndertakingSandbox: vi.fn((undertakingId: string) => {
			if (!seam.workspaces.has(undertakingId))
				seam.workspaces.set(undertakingId, {
					workspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'RETAINED_BY_PARTICIPATION'
					}),
					outputWorkspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'PURGEABLE_AT_EXPIRY'
					}),
					runner: createRefusingProcessRunner()
				});
			return seam.workspaces.get(undertakingId);
		})
	};
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	const { createProcessRunObserver } = await import('../tools/process-run-observer.js');
	return {
		...actual,
		// ⭑ A SCRIPTED PRODUCER OVER THE HOST'S REAL OBSERVER: it writes nothing, and answers the execution contract's envelope, its work
		// product one JSON object naming its SESSION's number and the turn's first line — so a re-run's work is not the first attempt's.
		getExecutionSession: vi.fn(() => async () => {
			const observer = createProcessRunObserver();
			seam.opens += 1;
			const session = seam.opens;
			return {
				turn: async (text: string) => {
					seam.turns.push(text);
					return JSON.stringify({
						workProduct: { document: `ATTEMPT ${session}: ${text.split('\n')[0]}` },
						rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] }
					});
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => observer.observed(),
				dispose: () => undefined,
				retainsHistory: true
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER FOR THE FLOOR'S REVIEW, ITS PROGRAM REPLACED AT THE SEAM — each prompt answered by the case (`seam.review`), else
// clean over the prompt's own rubric.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				seam.prompts.push(prompt);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(exportPath, JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }), 'utf8');
				const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
				return {
					stdout:
						seam.review?.(prompt) ??
						JSON.stringify({
							findings: ids.map((id) => ({ criterionId: id, failed: false, statement: 'met' })),
							recommendation: 'SATISFIED',
							residualUncertainty: []
						})
				};
			})
		)
	};
});

// ⭑ THE DECLARED POLICIES' REVIEWER, STOOD IN FOR AT ITS SEAM: what it was shown is kept, and its answer is the case's (`seam.answer`), so a
// criterion can be recorded with any of the five outcomes — a reviewer's own reply reaches three (MET, NOT_MET, UNABLE_TO_DETERMINE).
vi.mock('../assurance/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../assurance/index.js')>();
	return {
		...actual,
		createDeclaredPolicyReviewer: vi.fn(() => ({
			validatorId: 'fixture.declared-policy',
			review: async (
				_subject: unknown,
				input: { readonly declaredPolicy?: { readonly policyId: string }; readonly prompt?: string; readonly content?: string }
			) => {
				const policyId = input.declaredPolicy?.policyId ?? '';
				seam.declared.push({ policyId, prompt: input.prompt ?? '', content: input.content ?? '' });
				return seam.answer(policyId);
			}
		}))
	};
});

// ⭑ The product's configured decision model, stood in for by a double that calls no model (package N's route test's).
vi.mock('../assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('../assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('../assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import { readFileSync } from 'node:fs';
import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import type { Workspace } from '@janumipwb/rph-ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage, load as unitLoad } from '../../../routes/undertakings/[id]/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { actingActor } from '../identity.js';
import { dispatch, getArtifactStore, getEngine, mintUiId, resetEngine, uiSession } from '../workbench.js';
import { resolveUndertakingSandbox } from './workspace-host.js';

const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

/** ⭐ D70's first line, the lead's words, BYTE FOR BYTE — restated here, never imported. */
const HEADING = 'This work will be reviewed against the criteria below, under the policies named. Make the work meet each one.';
/** D69's first line, restated: its section stays last. */
const ACCEPTED_HEADING =
	"This work depends on the accepted work of other units of this Undertaking. Before you begin, read each file below. Each holds one unit's accepted work product, exactly as its reviews judged it. The workbench writes these files; do not change them.";
/** The Undertaking's statement as the portfolio's form makes it from a name alone (its own defaults), D61's section. */
const UNDERTAKING_SECTION =
	'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
	'Intended product: Criteria and Rework\nObjective:\nDeliver Criteria and Rework';
/** Two declared policies the reference seed holds, each governing REQUIREMENT_DEFINITION, as §3.2's Requirements type declares them. */
const COVERAGE = 'pol_requirement_coverage';
const INTENT = 'pol_intent_preservation';
/** D71's first-turn form for carried findings (`run-model-step.ts`, `firstTurn`, P7-6R RD8), restated. */
const CARRIED_HEAD = 'An independent assurance review of an earlier attempt at this work found the following:';
const CARRIED_TAIL =
	'This is a fresh session: you do not hold that attempt’s work product or rationale,\n' +
	'though files it wrote may still be in the workspace.\n' +
	'Produce the work product, addressing these findings. Do not argue with them and do not\n' +
	'restate them back; if you believe a finding is mistaken, say so in your rationale.';
const TYPED = 'The declared reviews found the specification short; run the work again with their findings.';

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

type ActionEvent = Parameters<typeof undertakings.create>[0];
const event = (path: string, action: string, fields: Readonly<Record<string, string>>, id?: string): ActionEvent => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	return {
		request: new Request(`http://localhost${path}?/${action}`, { method: 'POST', body: form }),
		params: id === undefined ? {} : { id }
	} as unknown as ActionEvent;
};

/** One type of the fixture PWA: its name, its children by name, what it requires and produces, who discharges it, and its policies. */
interface FixtureType {
	readonly name: string;
	readonly isRoot?: boolean;
	readonly children?: readonly string[];
	readonly inputs?: readonly string[];
	readonly outputs?: readonly string[];
	readonly model?: boolean;
	readonly policies?: readonly string[];
	readonly kind?: string;
}

/**
 * A root over three phases: the Requirements Specification, a model's, declaring Requirement Coverage then Intent Preservation; the Technical
 * Design, a model's, which requires the Specification's output and declares Requirement Coverage; and the Glossary, a model's, declaring
 * none. Each declaring phase is a REQUIREMENT_DEFINITION, the kind both policies govern. The root is an operator's (HUMAN), declaring
 * `rootPolicies` — as a REQUIREMENT_DEFINITION where it declares any.
 */
const PHASES = (specPolicies: readonly string[] = [COVERAGE, INTENT], rootPolicies: readonly string[] = []): readonly FixtureType[] => [
	{
		name: 'Product',
		isRoot: true,
		children: ['Requirements Specification', 'Technical Design', 'Glossary'],
		inputs: ['originating-intent'],
		...(rootPolicies.length === 0 ? {} : { policies: rootPolicies, kind: 'REQUIREMENT_DEFINITION' })
	},
	{
		name: 'Requirements Specification',
		inputs: ['originating-intent'],
		outputs: ['specification'],
		model: true,
		policies: specPolicies,
		kind: 'REQUIREMENT_DEFINITION'
	},
	{
		name: 'Technical Design',
		inputs: ['specification'],
		outputs: ['design'],
		model: true,
		policies: [COVERAGE],
		kind: 'REQUIREMENT_DEFINITION'
	},
	{ name: 'Glossary', inputs: ['originating-intent'], outputs: ['glossary'], model: true }
];

/**
 * A PWA of `types`, authored and published through the commands, then an Undertaking of it created through the portfolio's own action —
 * package L15's arrangement, each MODEL type's prompt `Write the {subject}.`.
 */
async function instantiated(types: readonly FixtureType[]): Promise<{
	readonly undertakingId: string;
	readonly unitOf: (title: string) => { readonly id: string; readonly state: Record<string, unknown> };
}> {
	const pwaId = mintUiId('pwa');
	const idOf = new Map(types.map((t) => [t.name, mintUiId('pwut')]));
	const r = (commandType: string, aggregateType: string, aggregateId: string, payload: unknown): void => {
		const result = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(result.status, `arrangement: ${commandType} — ${result.error?.message ?? ''}`).toBe('ACCEPTED');
	};
	r('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Criteria and Rework PWA',
		description: 'A PWA whose types declare the policies their sign-off reviews.',
		domain: 'software product',
		version: '0.1.0'
	});
	for (const t of [...types].reverse())
		r('DefinePwuType', 'PWU_TYPE', idOf.get(t.name)!, {
			pwuTypeId: idOf.get(t.name)!,
			pwaId,
			pwuKind: t.kind ?? t.name.toUpperCase().replaceAll(/[^A-Z]/g, '_'),
			name: t.name,
			purpose: `Do the ${t.name}`,
			isRoot: t.isRoot === true,
			permittedChildTypeIds: (t.children ?? []).map((c) => idOf.get(c)!),
			requiredInputs: [...(t.inputs ?? [])],
			requiredOutputs: [...(t.outputs ?? [])],
			requiredAssurancePolicyIds: [...(t.policies ?? [])],
			workDischarge: t.model === true ? 'MODEL' : 'HUMAN',
			...(t.model === true
				? {
						promptTemplate: {
							templateText: 'Write the {subject}.',
							templateVersion: 1,
							declaredPlaceholders: ['subject'],
							status: 'ACTIVE'
						}
					}
				: {})
		});
	r('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		rootPwuTypeId: idOf.get(types.find((t) => t.isRoot === true)!.name)!
	});
	const created = (await undertakings.create(
		event('/undertakings', 'create', { name: 'Criteria and Rework', pwaId, ...RISK })
	)) as { created?: string; data?: { error?: string } };
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const undertakingId = created.created!;
	return {
		undertakingId,
		unitOf: (title) => {
			const u = listPwus(getEngine(), undertakingId).find((p) => p.state.title === title);
			if (u === undefined) throw new Error(`arrangement: no unit titled ${title}`);
			return { id: u.id, state: u.state as Record<string, unknown> };
		}
	};
}

type Fixture = Awaited<ReturnType<typeof instantiated>>;
type Action =
	| 'beginExecute'
	| 'recordAssurance'
	| 'markSatisfied'
	| 'rerunWork'
	| 'rerunReview'
	| 'rerunRejectedWork'
	| 'recordBlockingFinding';

/** A page action on the fixture's Undertaking, as the page posts it. ⚠ An action the page does not have answers as an error, never a throw. */
async function press(
	u: Fixture,
	action: Action,
	fields: Readonly<Record<string, string>>
): Promise<{ readonly advanced?: string; readonly error?: string }> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as
		| { advanced?: string; data?: { error?: string } }
		| undefined;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.data?.error === undefined ? {} : { error: r.data.error })
	};
}

/** What the Undertaking page offers each unit its declared reviews rejected (`rejectedRerunByPwu`), read as the page loads. */
const rejectedOffers = (u: Fixture): Record<string, unknown> | undefined =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as { rejectedRerunByPwu?: Record<string, unknown> }).rejectedRerunByPwu;

/** The stored policy's name and criteria, as the sign-off's reader reads them. */
const policyOf = (id: string) =>
	getObject(getEngine(), id) as unknown as { name: string; criteria: { id: string; name: string; description: string }[] };
/** D70's section for `ids`, restated from the stored policies — never the product's renderer. */
const sectionOf = (ids: readonly string[]): string =>
	[
		HEADING,
		...ids.flatMap((id) => {
			const p = policyOf(id);
			return [`${p.name}:`, ...p.criteria.map((c) => `- ${c.id}: ${c.description.trim() === '' ? c.name : c.description.trim()}`)];
		})
	].join('\n');
const instructionOf = (title: string, ids: readonly string[]): string =>
	ids.length === 0 ? `Write the ${title}.\n\n${UNDERTAKING_SECTION}` : `Write the ${title}.\n\n${UNDERTAKING_SECTION}\n\n${sectionOf(ids)}`;

/** A declared review's answer: each of the policy's criteria with `outcomes[i]` (MET where none is said; `null` gives no answer). */
function answerOf(
	policyId: string,
	outcomes: Readonly<Record<number, readonly [string, string | undefined] | null>> = {},
	blocking?: string
): unknown {
	const criteria = policyOf(policyId).criteria.flatMap((c, i) => {
		const o = outcomes[i];
		if (o === null) return [];
		const [outcome, rationale] = o ?? ['MET', 'met'];
		return [{ criterionId: c.id, outcome, mandatory: false, ...(rationale === undefined ? {} : { rationale }) }];
	});
	return {
		policyId,
		validatorId: 'fixture.declared-policy',
		evaluator: { actorType: 'AGENT', agentId: 'fixture-declared-reviewer', modelId: 'fixture-declared-model', providerId: 'fixture-provider' },
		criteria,
		observations: blocking === undefined ? [] : [{ code: blocking, severity: 'BLOCKING', statement: `${blocking} blocks.`, open: true }],
		recommendation: blocking === undefined ? 'SATISFIED' : 'REJECTED',
		residualUncertainty: [],
		limitations: []
	};
}

/** The Undertaking's workspace, as the route resolves it. */
const workspaceOf = (u: Fixture): Workspace => (resolveUndertakingSandbox(u.undertakingId) as unknown as { workspace: Workspace }).workspace;
const isWorkProductReview = (p: string): boolean => p.includes('The WORK PRODUCT to review');
const eventCount = (): number => getEngine().readAllEvents().length;
const plansOf = (pwuId: string) => listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === pwuId);
const decisionsOf = (pwuId: string) =>
	listByType(getEngine(), 'DECISION').filter(
		(d) => d.state.decisionType === 'REPLAN' && ((d.state.subjectObjectIds as string[] | undefined) ?? [])[0] === pwuId
	);
const axesOf = (pwuId: string) => {
	const s = getObject(getEngine(), pwuId) ?? {};
	return [s.workLifecycleState, s.executionState, s.assuranceState];
};
/** The latest declared verdict of each policy over the unit, by policy: its assessment id and state. */
const verdictsOf = (pwuId: string, policyIds: readonly string[]) =>
	policyIds.map((policyId) => {
		const mine = listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
			(a) => a.state.assurancePolicyId === policyId && ((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(pwuId)
		);
		const last = mine.at(-1);
		return { policyId, assessmentId: last?.id ?? '', state: String(last?.state.assessmentState ?? '') };
	});
/** The unit's last completion's work product: its id and its bytes. */
async function workProductOf(pwuId: string): Promise<{ readonly id: string; readonly bytes: string }> {
	const plans = new Set(plansOf(pwuId).map((p) => p.id));
	const last = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
		.at(-1);
	const id = String((last?.payload as { outputArtifactIds?: string[] } | undefined)?.outputArtifactIds?.[0] ?? '');
	const artifact = getObject(getEngine(), id) ?? {};
	return { id, bytes: (await getArtifactStore().get(String(artifact.storageKey ?? ''))) ?? '' };
}

/** Begin & Execute, Record Assurance (every criterion MET), then Mark Satisfied on `title`: the unit SATISFIED. */
async function accept(u: Fixture, title: string): Promise<void> {
	const pwuId = u.unitOf(title).id;
	for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const)
		expect((await press(u, action, { pwuId })).error, `arrangement: ${action} on ${title}`).toBeUndefined();
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, `arrangement: ${title} accepted`).toBe('SATISFIED');
}

/**
 * The Specification run, and its sign-off REJECTED by both its declared reviews: Requirement Coverage's six criteria answered NOT_MET, MET,
 * NOT_APPLICABLE, PARTIALLY_MET, no answer and NOT_MET with no rationale, a BLOCKING finding open; Intent Preservation's first NOT_MET and
 * the rest MET, a BLOCKING finding open. Returns the unit, its first work product and the five findings a re-run carries, in order.
 */
async function specRejected() {
	const u = await instantiated(PHASES());
	const spec = u.unitOf('Requirements Specification');
	expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();
	const first = await workProductOf(spec.id);
	const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
	const intent = policyOf(INTENT).criteria.map((c) => c.id);
	seam.answer = (policyId) =>
		policyId === COVERAGE
			? answerOf(
					COVERAGE,
					{
						0: ['NOT_MET', 'Requirement 3 has no acceptance criterion.'],
						1: ['MET', 'Each requirement is numbered.'],
						2: ['NOT_APPLICABLE', 'The product has no user interface.'],
						3: ['PARTIALLY_MET', 'Two scenarios of five name their expected output.'],
						4: null,
						5: ['NOT_MET', undefined]
					},
					cov[0]
				)
			: answerOf(INTENT, { 0: ['NOT_MET', 'The objective’s exit codes are not stated.'] }, intent[0]);
	const signed = await press(u, 'recordAssurance', { pwuId: spec.id });
	expect(signed.error ?? '', 'arrangement: the declared reviews rejected the Specification').toContain(
		"Assurance recorded, and the declared review did not conclude in this PWU's favour"
	);
	expect(axesOf(spec.id), 'arrangement: the Specification rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	seam.answer = (policyId) => answerOf(policyId);
	const findings = [
		`- ${cov[0]}: Requirement 3 has no acceptance criterion.`,
		`- ${cov[3]}: Two scenarios of five name their expected output.`,
		`- ${cov[4]}: The review gave no answer for this criterion.`,
		`- ${cov[5]}: Criterion ${cov[5]} was answered NOT_MET, with no rationale recorded.`,
		`- ${intent[0]}: The objective’s exit codes are not stated.`
	];
	return { u, spec, first, findings, verdicts: verdictsOf(spec.id, [COVERAGE, INTENT]) };
}

/** A REPLAN Decision dispatched as the page's person makes one: proposed and approved, naming `subjects`, the unit pinned at version 1. */
function personsReplan(subjects: readonly string[]): string {
	const decisionId = mintUiId('dec');
	const proposed = dispatch('ProposeDecision', 'DECISION', decisionId, {
		decisionType: 'REPLAN',
		subjectObjectIds: [...subjects],
		selectedOption: 'RERUN_REJECTED_WORK',
		rationale: 'A person’s choice, for the kernel’s guard.',
		authority: actingActor(uiSession()),
		consideredObservationIds: []
	});
	expect(proposed.status, `arrangement: ProposeDecision — ${proposed.error?.message ?? ''}`).toBe('ACCEPTED');
	const approved = dispatch('ApproveDecision', 'DECISION', decisionId, {
		selectedOption: 'RERUN_REJECTED_WORK',
		rationale: 'A person’s choice, for the kernel’s guard.',
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		subjectSemanticVersions: { [subjects[0]!]: 1 }
	});
	expect(approved.status, `arrangement: ApproveDecision — ${approved.error?.message ?? ''}`).toBe('ACCEPTED');
	return decisionId;
}

/** A REPLAN Decision as the page's person PROPOSES one, never approved: a request, not yet an authority. */
function personsProposal(subjects: readonly string[]): string {
	const decisionId = mintUiId('dec');
	const proposed = dispatch('ProposeDecision', 'DECISION', decisionId, {
		decisionType: 'REPLAN',
		subjectObjectIds: [...subjects],
		selectedOption: 'RERUN_REJECTED_WORK',
		rationale: 'A person’s proposal, for the kernel’s guard.',
		authority: actingActor(uiSession()),
		consideredObservationIds: []
	});
	expect(proposed.status, `arrangement: ProposeDecision — ${proposed.error?.message ?? ''}`).toBe('ACCEPTED');
	return decisionId;
}

/** A Decision of another kind (`decisionType`), proposed and approved as `personsReplan` makes a REPLAN, naming `subjects`, the first pinned at version 1. */
function personsApproved(decisionType: string, subjects: readonly string[]): string {
	const decisionId = mintUiId('dec');
	const proposed = dispatch('ProposeDecision', 'DECISION', decisionId, {
		decisionType,
		subjectObjectIds: [...subjects],
		selectedOption: 'RERUN_REJECTED_WORK',
		rationale: 'A person’s choice of another kind, for the kernel’s guard.',
		authority: actingActor(uiSession()),
		consideredObservationIds: []
	});
	expect(proposed.status, `arrangement: ProposeDecision — ${proposed.error?.message ?? ''}`).toBe('ACCEPTED');
	const approved = dispatch('ApproveDecision', 'DECISION', decisionId, {
		selectedOption: 'RERUN_REJECTED_WORK',
		rationale: 'A person’s choice of another kind, for the kernel’s guard.',
		consideredEvidenceIds: [],
		consideredObservationIds: [],
		subjectSemanticVersions: { [subjects[0]!]: 1 }
	});
	expect(approved.status, `arrangement: ApproveDecision — ${approved.error?.message ?? ''}`).toBe('ACCEPTED');
	return decisionId;
}

/** The one move back, as the kernel is asked it: the three axes to planning, citing `cited`. */
const backToPlanning = (pwuId: string, cited: readonly string[], axes: { execution?: string; assurance?: string; work?: string } = {}) =>
	dispatch('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', pwuId, {
		previousState: 'UNDER_ASSURANCE',
		newState: axes.work ?? 'PLANNED',
		executionState: axes.execution ?? 'PLANNED',
		assuranceState: axes.assurance ?? 'UNASSESSED',
		shapeIntegrityState: 'PRESERVED',
		reasonCode: 'CONTROLLER',
		supportingObjectIds: [...cited]
	});

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.review = undefined;
	seam.turns.length = 0;
	seam.workspaces.clear();
	seam.opens = 0;
	seam.declared.length = 0;
	seam.answer = (policyId) => answerOf(policyId);
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ L16 (D70) — a unit is told the criteria its declared reviews will judge it by, through the page', () => {
	it('⛔ RED FIRST (REG-F-640) — the section, each policy in the selection’s order and each criterion in its own, after the output contract, as the unit is sent its instruction and as its review is shown it', async () => {
		const u = await instantiated(PHASES());
		const spec = u.unitOf('Requirements Specification');

		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();

		const instruction = instructionOf('Requirements Specification', [COVERAGE, INTENT]);
		expect(seam.turns[0], 'the unit was not sent the criteria of its declared policies').toBe(instruction);
		expect(seam.prompts.find(isWorkProductReview) ?? '', 'its review was not shown them').toContain(instruction);
	});

	it('⛔ RED FIRST — the policies in the order the unit declares them, never sorted', async () => {
		const u = await instantiated(PHASES([INTENT, COVERAGE]));
		const spec = u.unitOf('Requirements Specification');

		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();

		expect(seam.turns[0], 'the policies were not given in the selection’s order').toBe(
			instructionOf('Requirements Specification', [INTENT, COVERAGE])
		);
	});

	it('⛔ RED FIRST — before D69’s section, which stays last', async () => {
		const u = await instantiated(PHASES());
		await accept(u, 'Requirements Specification');
		const [spec, design] = ['Requirements Specification', 'Technical Design'].map((t) => u.unitOf(t));
		seam.turns.length = 0;

		expect((await press(u, 'beginExecute', { pwuId: design!.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();

		expect(seam.turns[0], 'the criteria are not between the contract and D69’s section').toBe(
			`${instructionOf('Technical Design', [COVERAGE])}\n\n${ACCEPTED_HEADING}\n` +
				`- Requirements Specification: .jpwb/accepted/requirements-specification--${spec!.id}.txt`
		);
	});

	it('⛔ RED FIRST — a work re-run sends the same section, and the stopped unit’s re-review rebuilds it, byte for byte', async () => {
		const u = await instantiated(PHASES());
		const spec = u.unitOf('Requirements Specification');
		const instruction = instructionOf('Requirements Specification', [COVERAGE, INTENT]);
		let down = true;
		seam.review = (p) => {
			if (down && isWorkProductReview(p)) throw new Error('devin exited with code 1: connection reset by peer');
			return undefined;
		};
		const first = await press(u, 'beginExecute', { pwuId: spec.id });
		expect(first.error ?? '', 'arrangement: the first attempt’s review did not conclude').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		expect(seam.turns[0], 'the unit was not sent the criteria of its declared policies').toBe(instruction);
		down = false;
		seam.prompts.length = 0;

		const reReviewed = await press(u, 'rerunReview', { pwuId: spec.id, rationale: 'The reviewer failed at the transport; review it again.' });

		expect(reReviewed.error, 'arrangement: the re-review completed').toBeUndefined();
		expect(seam.prompts.find(isWorkProductReview) ?? '', 'the re-review was not shown the instruction its producer was sent').toContain(instruction);
	});

	it('⛔ RED FIRST — a stopped unit’s work re-run is sent the same section', async () => {
		const u = await instantiated(PHASES());
		const spec = u.unitOf('Requirements Specification');
		let down = true;
		seam.review = (p) => {
			if (down && isWorkProductReview(p)) throw new Error('devin exited with code 1: connection reset by peer');
			return undefined;
		};
		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error ?? '', 'arrangement: stopped').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		down = false;
		seam.turns.length = 0;

		const rerun = await press(u, 'rerunWork', { pwuId: spec.id, rationale: 'The reviewer failed at the transport; run the work again.' });

		expect([rerun.advanced, rerun.error], 'arrangement: the work re-run').toEqual(['work-rerun', undefined]);
		expect(seam.turns[0], 'the work re-run was not sent the criteria').toBe(instructionOf('Requirements Specification', [COVERAGE, INTENT]));
	});

	it('⛔ RED FIRST — a leaf’s declared review at sign-off rebuilds the instruction its producer was sent, byte for byte', async () => {
		const u = await instantiated(PHASES());
		const spec = u.unitOf('Requirements Specification');
		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();

		expect((await press(u, 'recordAssurance', { pwuId: spec.id })).error, 'arrangement: its declared reviews ran').toBeUndefined();

		expect(
			seam.declared.map((d) => [d.policyId, d.prompt]),
			'a declared review was not shown the instruction its producer was sent'
		).toEqual([COVERAGE, INTENT].map((p) => [p, instructionOf('Requirements Specification', [COVERAGE, INTENT])]));
	});

	it('⭑ CONTROL — a unit with no governing declared policy is sent its instruction byte for byte as before', async () => {
		const u = await instantiated(PHASES());
		const glossary = u.unitOf('Glossary');

		expect((await press(u, 'beginExecute', { pwuId: glossary.id })).error, 'arrangement: the Glossary ran').toBeUndefined();

		expect(seam.turns[0]).toBe(`Write the Glossary.\n\n${UNDERTAKING_SECTION}`);
	});
});

describe('⭐⭐ L16 (D71) — a unit its declared reviews reject can have its work re-run once with their findings, in place, through the page', () => {
	it('⛔ RED FIRST — the page offers the act on a unit its declared reviews rejected, naming the policies and how many findings it carries', async () => {
		const r = await specRejected();

		expect(rejectedOffers(r.u)?.[r.spec.id], 'the page does not offer the act on the rejected unit').toEqual({
			policies: [COVERAGE, INTENT],
			findings: 5
		});
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page renders no form for the act').toContain('action="?/rerunRejectedWork"');
		expect(page, 'the page asks no rationale for the act').toContain('data-testid="rerun-rejected-work-rationale"');
	});

	it('⭑ CONTROL — and nowhere else: never on a unit never rejected, nor on one the operator’s finding rejected', async () => {
		const u = await instantiated(PHASES());
		await accept(u, 'Requirements Specification');
		const glossary = u.unitOf('Glossary');
		expect((await press(u, 'beginExecute', { pwuId: glossary.id })).error, 'arrangement: the Glossary ran').toBeUndefined();
		expect(
			(await press(u, 'recordBlockingFinding', { pwuId: glossary.id, statement: 'The glossary defines no term.' })).error,
			'arrangement: the operator’s finding'
		).toBeUndefined();
		expect(axesOf(glossary.id), 'arrangement: the Glossary rejected by the operator').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);

		const offers = rejectedOffers(u) ?? {};

		expect([offers[u.unitOf('Requirements Specification').id], offers[glossary.id]]).toEqual([undefined, undefined]);
		expect(decisionsOf(u.unitOf('Requirements Specification').id), 'a unit never rejected was re-planned').toEqual([]);
	});

	it('⭑ CONTROL — nor on an operator’s unit its declared reviews rejected: the root, whose discharge is HUMAN, has no model step to run again (the builder’s reading)', async () => {
		const u = await instantiated(PHASES([COVERAGE, INTENT], [COVERAGE]));
		for (const title of ['Requirements Specification', 'Technical Design', 'Glossary']) await accept(u, title);
		const root = u.unitOf('Product');
		expect((await press(u, 'beginExecute', { pwuId: root.id })).error, 'arrangement: the root, an operator’s, ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) => answerOf(policyId, { 0: ['NOT_MET', 'Requirement 3 has no acceptance criterion.'] }, cov[0]);
		expect((await press(u, 'recordAssurance', { pwuId: root.id })).error ?? '', 'arrangement: the root’s declared review rejected it').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
		expect(axesOf(root.id), 'arrangement: the root rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);

		expect(rejectedOffers(u)?.[root.id], 'the act is offered on a unit no model works').toBeUndefined();
	});

	it('⛔ RED FIRST — the act, in one batch: the person’s Decision citing REG-D-163 (2), the move back on three axes citing it and the verdicts, a new plan superseding the old; then the work, run again', async () => {
		const r = await specRejected();
		const [planA] = plansOf(r.spec.id).map((p) => p.id);
		const before = eventCount();

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id, rationale: TYPED });

		expect([rerun.advanced, rerun.error], 'the act did not re-run the work').toEqual(['rejected-work-rerun', undefined]);
		const [decision] = decisionsOf(r.spec.id);
		const verdictIds = r.verdicts.map((v) => v.assessmentId);
		expect(
			[decision?.state.selectedOption, decision?.state.status, decision?.state.subjectObjectIds],
			'the person’s Decision is not the act’s'
		).toEqual(['RERUN_REJECTED_WORK', 'EFFECTIVE', [r.spec.id, planA, r.first.id, ...verdictIds]]);
		const rationale = String(decision?.state.rationale ?? '');
		expect([rationale.startsWith(`${TYPED}\n\n`), rationale.includes('REG-D-163 (2)')], 'its rationale is not the person’s, then the ruling').toEqual([true, true]);
		const events = getEngine().readAllEvents().slice(before);
		const back = events.findIndex((e) => e.eventType === 'PwuStateChanged' && (e.payload as { newState?: string }).newState === 'PLANNED');
		expect(events[back]?.payload, 'the move back is not the one move, citing the Decision and the verdicts').toMatchObject({
			previousState: 'UNDER_ASSURANCE',
			newState: 'PLANNED',
			executionState: 'PLANNED',
			assuranceState: 'UNASSESSED',
			supportingObjectIds: [decision?.id, ...verdictIds]
		});
		const planB = plansOf(r.spec.id).find((p) => p.id !== planA);
		expect(
			[getObject(getEngine(), planA!)?.status, planB?.state.status, (planB?.state.steps as { stepState?: string }[] | undefined)?.[0]?.stepState],
			'the old plan is not superseded by a new one, whose step ran'
		).toEqual(['SUPERSEDED', 'ACTIVE', 'SUCCEEDED']);
		const superseded = events.find((e) => e.eventType === 'ExecutionPlanSuperseded' && e.aggregateId === planA);
		expect((superseded?.payload as { supersedingExecutionPlanId?: string } | undefined)?.supersedingExecutionPlanId).toBe(planB?.id);
		expect(axesOf(r.spec.id), 'the unit did not run its work again').toEqual(['EXECUTING', 'SUCCEEDED', 'UNASSESSED']);
		expect(rejectedOffers(r.u)?.[r.spec.id], 'the act is offered while the re-run’s sign-off is owed').toBeUndefined();
	});

	it('⛔ RED FIRST — its first turn, in a fresh session, is the instruction and then the findings: each failed criterion of each rejecting verdict, coded by its id, the recorded rationale its statement, policy by policy in order — none MET, none NOT_APPLICABLE', async () => {
		const r = await specRejected();
		const [opens, turns] = [seam.opens, seam.turns.length];

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id, rationale: TYPED })).error, 'arrangement: the act').toBeUndefined();

		expect(seam.opens, 'the re-run did not open a fresh session').toBe(opens + 1);
		expect(seam.turns[turns], 'the re-run’s first turn is not the instruction then the findings').toBe(
			[instructionOf('Requirements Specification', [COVERAGE, INTENT]), '', CARRIED_HEAD, ...r.findings, '', CARRIED_TAIL].join('\n')
		);
	});

	it('⛔ RED FIRST — the sign-off after it judges the new work alone and accepts the unit on the new verdicts; the old verdicts and the earlier work stay recorded; Mark Satisfied writes the new work’s file', async () => {
		const r = await specRejected();
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id, rationale: TYPED })).error, 'arrangement: the act').toBeUndefined();
		const renewed = await workProductOf(r.spec.id);
		expect([r.first.bytes, renewed.bytes], 'arrangement: the re-run made new work').toEqual([
			'{"document":"ATTEMPT 1: Write the Requirements Specification."}',
			'{"document":"ATTEMPT 2: Write the Requirements Specification."}'
		]);
		seam.declared.length = 0;

		const signed = await press(r.u, 'recordAssurance', { pwuId: r.spec.id });

		expect([signed.advanced, signed.error], 'the sign-off after the re-run did not accept the new work').toEqual(['assured', undefined]);
		expect(
			seam.declared.map((d) => [d.policyId, d.content.includes('ATTEMPT 2'), d.content.includes('ATTEMPT 1')]),
			'a declared review was not shown the new work alone'
		).toEqual([
			[COVERAGE, true, false],
			[INTENT, true, false]
		]);
		expect(
			r.verdicts.map((v) => String(getObject(getEngine(), v.assessmentId)?.assessmentState ?? '')),
			'the rejected verdicts are no longer recorded'
		).toEqual(['REJECTED', 'REJECTED']);
		expect(getObject(getEngine(), r.first.id)?.storageKey, 'the earlier work product is no longer recorded').toBeDefined();
		expect((await press(r.u, 'markSatisfied', { pwuId: r.spec.id })).advanced, 'Mark Satisfied after it').toBe('satisfied');
		expect(
			await workspaceOf(r.u).readFile(`.jpwb/accepted/requirements-specification--${r.spec.id}.txt`),
			'Mark Satisfied did not write the new work’s file'
		).toBe(renewed.bytes);
	});

	it('⛔ RED FIRST — refused before anything is dispatched: with no rationale; on a unit in no such state', async () => {
		const r = await specRejected();
		const [events, opens] = [eventCount(), seam.opens];

		const untyped = await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id });
		const glossary = r.u.unitOf('Glossary');
		const notRejected = await press(r.u, 'rerunRejectedWork', { pwuId: glossary.id, rationale: TYPED });

		expect(untyped.error, 'no rationale was asked').toBe(
			'Re-running the work its declared reviews rejected is recorded as your Decision: say why, in your own words — the rationale is required (REG-D-163 (2); DESIGN-the-stopped-unit-recovery.md RD4).'
		);
		expect(notRejected.error, 'a unit in no such state was not refused, naming why').toBe(
			'Re-running the work its declared reviews rejected refused: the unit is PROPOSED with its execution NOT_PLANNED and its assurance UNASSESSED; only a unit its declared reviews rejected at its sign-off (UNDER_ASSURANCE, SUCCEEDED, REJECTED) may have its work re-run with their findings (REG-D-163 (2))'
		);
		expect([eventCount(), seam.opens], 'a refused act dispatched something').toEqual([events, opens]);
	});
});

describe('⭐⭐ L16 (D71) — the kernel’s guard on the one way back, at its command seam (`changePwuState`)', () => {
	it('⛔ RED FIRST — refused without the Decision: the verdicts cited alone authorize nothing', async () => {
		const r = await specRejected();

		const moved = backToPlanning(r.spec.id, r.verdicts.map((v) => v.assessmentId));

		expect(moved.status, 'the move back was taken with no Decision').toBe('REJECTED');
		expect(moved.error?.message ?? '').toContain('back to planning out of a rejected declared assurance, and nothing authorizes it');
		expect(axesOf(r.spec.id)).toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	});

	it('⛔ RED FIRST — refused without a REJECTED declared assurance: a unit the operator’s finding rejected, a person’s REPLAN Decision naming it', async () => {
		const u = await instantiated(PHASES());
		const glossary = u.unitOf('Glossary');
		expect((await press(u, 'beginExecute', { pwuId: glossary.id })).error, 'arrangement: the Glossary ran').toBeUndefined();
		expect(
			(await press(u, 'recordBlockingFinding', { pwuId: glossary.id, statement: 'The glossary defines no term.' })).error,
			'arrangement: the operator’s finding'
		).toBeUndefined();
		const decision = personsReplan([glossary.id]);

		const moved = backToPlanning(glossary.id, [decision]);

		expect(moved.status, 'a unit its declared reviews did not reject was taken back').toBe('REJECTED');
		expect(moved.error?.message ?? '').toContain(
			`no declared policy of ${glossary.id} holds a REJECTED verdict over it at its current version`
		);
	});

	it('⛔ RED FIRST — refused unless its Decision names every REJECTED verdict', async () => {
		const r = await specRejected();
		const decision = personsReplan([r.spec.id, r.verdicts[0]!.assessmentId]);

		const moved = backToPlanning(r.spec.id, [decision]);

		expect(moved.status, 'a Decision naming one verdict of two authorized the move').toBe('REJECTED');
		expect(moved.error?.message ?? '').toContain(`does not name the REJECTED verdict ${INTENT}'s ${r.verdicts[1]!.assessmentId}`);
	});

	// ⭐⭐ ADDED IN STAGE 3 (package L16's facts §8.2): the guard's "a person's Decision ... naming them" held limb by limb — a Decision only
	// proposed is no authority (EFFECTIVE is what a person's approval makes it, `authorizeDecisionEffective`), and one that does not name the
	// unit is about another subject.
	it('⛔ RED FIRST — refused with a Decision only proposed, or with one that does not name the unit: the authority is a person’s approved Decision about this unit', async () => {
		const r = await specRejected();
		const verdictIds = r.verdicts.map((v) => v.assessmentId);

		const proposedOnly = backToPlanning(r.spec.id, [personsProposal([r.spec.id, ...verdictIds])]);
		// ⚠ About another unit (the Glossary, pinned at its version as `personsReplan` pins its first subject), naming the verdicts.
		const aboutAnother = backToPlanning(r.spec.id, [personsReplan([r.u.unitOf('Glossary').id, ...verdictIds])]);

		expect([proposedOnly.status, aboutAnother.status], 'a Decision not yet a person’s, or not about this unit, authorized the move').toEqual([
			'REJECTED',
			'REJECTED'
		]);
		expect(proposedOnly.error?.message ?? '').toContain('is PROPOSED, not EFFECTIVE');
		expect(aboutAnother.error?.message ?? '').toContain(`does not name ${r.spec.id} among its subjects`);
		expect(axesOf(r.spec.id)).toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	});

	// ⭐⭐ ADDED IN STAGE 3 too (package L16's facts §8.2): nothing cited at all — the case no other test reaches, and the refusal's own words
	// for it.
	it('⛔ RED FIRST — refused with nothing cited at all: the move names no Decision, and the refusal says it was given nothing', async () => {
		const r = await specRejected();

		const bare = dispatch('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', r.spec.id, {
			previousState: 'UNDER_ASSURANCE',
			newState: 'PLANNED',
			executionState: 'PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			// The contract requires the list (`ChangePwuStatePayloadSchema`): empty, it cites nothing.
			supportingObjectIds: []
		});

		expect(bare.status, 'a move citing nothing was taken').toBe('REJECTED');
		expect(bare.error?.message ?? '').toContain('nothing is cited');
		expect(bare.error?.message ?? '').toContain('Supplied: [nothing]');
		expect(axesOf(r.spec.id)).toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	});

	// ⭐⭐ ADDED IN STAGE 3, after the two above (package L16's facts §8.2, its second correction): D71's own word, a person's Decision
	// (`REPLAN`), held at its kind — an APPROVAL naming the unit and both verdicts, approved as a REPLAN is.
	it('⛔ RED FIRST — refused with a Decision of another kind: an APPROVAL naming the unit and its verdicts is not the REPLAN canon’s one way back needs', async () => {
		const r = await specRejected();

		const approval = backToPlanning(r.spec.id, [personsApproved('APPROVAL', [r.spec.id, ...r.verdicts.map((v) => v.assessmentId)])]);

		expect(approval.status, 'a Decision of another kind authorized the move').toBe('REJECTED');
		expect(approval.error?.message ?? '').toContain('is a APPROVAL decision, not a REPLAN');
		expect(axesOf(r.spec.id)).toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	});

	// ⭐⭐ ADDED IN STAGE 3 too (§8.2's second correction): an id that names nothing recorded, which must not authorize; and a REPLAN naming the
	// unit and neither verdict, refused in the plural.
	it('⛔ RED FIRST — refused citing what is not recorded, or a REPLAN naming the unit and none of its verdicts: each refusal names what it was given', async () => {
		const r = await specRejected();
		const unrecorded = mintUiId('dec');

		const ghost = backToPlanning(r.spec.id, [unrecorded]);
		const noVerdict = backToPlanning(r.spec.id, [personsReplan([r.spec.id])]);

		expect([ghost.status, noVerdict.status], 'an id naming nothing, or a Decision naming no verdict, authorized the move').toEqual([
			'REJECTED',
			'REJECTED'
		]);
		expect(ghost.error?.message ?? '').toContain(`${unrecorded} names no recorded object`);
		expect(noVerdict.error?.message ?? '').toContain(
			`does not name the REJECTED verdicts ${COVERAGE}'s ${r.verdicts[0]!.assessmentId}, ${INTENT}'s ${r.verdicts[1]!.assessmentId} among its subjects`
		);
		expect(axesOf(r.spec.id)).toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	});

	it('⛔ RED FIRST — one move or none: an axis taken back alone is refused', async () => {
		const r = await specRejected();
		const decision = personsReplan([r.spec.id, ...r.verdicts.map((v) => v.assessmentId)]);

		const executionAlone = backToPlanning(r.spec.id, [decision], { work: 'UNDER_ASSURANCE', assurance: 'REJECTED' });

		expect(executionAlone.status, 'the execution axis alone was taken back').toBe('REJECTED');
		expect(executionAlone.error?.message ?? '').toContain("may not take PART of canon's one way back (REG-D-163 (2))");
	});

	it('⛔ RED FIRST — with the person’s Decision naming the unit and its verdicts, the kernel takes the unit back to planning, all three axes', async () => {
		const r = await specRejected();
		const decision = personsReplan([r.spec.id, ...r.verdicts.map((v) => v.assessmentId)]);

		const moved = backToPlanning(r.spec.id, [decision]);

		expect([moved.status, moved.error?.message], 'the one move, authorized, was refused').toEqual(['ACCEPTED', undefined]);
		expect(axesOf(r.spec.id)).toEqual(['PLANNED', 'PLANNED', 'UNASSESSED']);
	});
});
