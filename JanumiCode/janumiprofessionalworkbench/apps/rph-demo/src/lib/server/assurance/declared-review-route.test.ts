// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — RECORD ASSURANCE REVIEWS EACH DECLARED POLICY, AND A VERDICT AGAINST THE WORK IS
// RECORDED, NOT REFUSED (`REG-F-523`; `REG-D-110` (3); `REG-D-111` (1); `DESIGN-phase-7-completion.md` B1–B3).
//
// Through the page's own actions, in test mode, with the reviewer NAMED (devin, with its model — test mode admits a named
// tool) and only devin's PROGRAM replaced at its exec seam: `devinPrint` is the real adapter, so the reported model is
// read back from the export devin writes. The executor is the fixture (the declared stand-in executor). The floor's review
// is answered clean; each DECLARED policy's review is answered by its own rubric, read off the prompt — clean, or with
// one BLOCKING criterion NOT MET.
//   · ⛔ PREDICTED RED, read from HEAD's code (not driven at HEAD: its sign-off asked no reviewer, so devin's seam would
//     have received no declared prompt at all): Record Assurance answered `assured`, every declared verdict SATISFIED,
//     computed from the policy's required evidence alone (`supportedDisposition`; `REG-F-523`).
//   · ⭐ NOW: one review per declared policy, its calls recorded on the ASSURANCE plane under the policy; one criterion
//     result per criterion; the verdict computed from the answers — REJECTED, recorded with its blocking finding, the
//     unit's ASSURANCE axis REJECTED (~~canon's route~~ the first half of canon's route, `REG-D-111` (1); ⚠ `E12F` F8: its
//     lifecycle stays UNDER_ASSURANCE, a departure from canon's `UNDER_ASSURANCE → REJECTED`) — and the operator told, the
//     action a failure.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw, and the criterion a declared review is to answer NOT MET. Hoisted: the mocks run before the body. */
const seam = vi.hoisted(() => ({
	declared: [] as string[],
	floor: 0,
	unmet: undefined as string | undefined,
	/** ⭐ `E12F` F3 — the declared policies whose review's transport FAILS: the review answers nothing, and is INCONCLUSIVE. */
	failing: new Set<string>(),
	/** ⭐ R3-A F1 — what the host's process-run observer reports for the unit being run: none unless a case says so. */
	observed: undefined as
		| undefined
		| {
				readonly runs: readonly unknown[];
				readonly observedCount: number;
				readonly recordedLimit: number;
		  }
}));

vi.mock('../execution/model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../execution/model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) => {
			const open = actual.getExecutionSession(selection, {
				agyExec: async (_file, args) => ({ stdout: await actual.deterministicExecutionPrint(args[1] ?? '') }),
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			});
			// ⭑ THE REAL SESSION, its `processRuns` reporting what a case scripted (`seam.observed`), else what it saw.
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				return {
					...session,
					processRuns: () =>
						(seam.observed ?? session.processRuns()) as ReturnType<typeof session.processRuns>
				};
			};
		})
	};
});

vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	const { SEEDED_REASONING_REVIEW_CRITERIA } = await import('@janumipwb/rph-assurance');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				// ⭐ A declared review is answered by ITS rubric, read off the prompt; the floor's by the seeded floor rubric.
				const declared = prompt.includes('declared assurance policy');
				if (declared) seam.declared.push(prompt);
				else seam.floor += 1;
				// ⭐ `E12F` F3 — a declared review of a FAILING policy: devin's program fails, every try (`seam.failing`).
				if (declared && [...seam.failing].some((id) => prompt.includes(`(${id})`)))
					throw new Error('hermetic: the declared review’s transport is down');
				const ids = declared
					? [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!)
					: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id);
				return {
					stdout: JSON.stringify({
						findings: ids.map((id) =>
							declared && id === seam.unmet
								? { criterionId: id, failed: true, statement: `${id} is not met by this work.`, severity: 'BLOCKING' }
								: { criterionId: id, failed: false, statement: 'met' }
						),
						recommendation: 'SATISFIED',
						residualUncertainty: []
					})
				};
			})
		)
	};
});

import { readFileSync } from 'node:fs';
import { driveAssessmentToAssessing, getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions, load } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actionEvent, beginExecute } from '../execution/begin-execute.testing.js';
import { createProcessRunObserver, type ObservedProcessRun } from '../tools/process-run-observer.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import { DECLARED_PRODUCING_PROMPT_INTENT, DECLARED_UNIT_PURPOSE_INTENT } from './reasoning-review-validator.js';
import {
	declaredRerunOffer,
	NEVER_ASSESSED,
	nothingToJudge,
	RERUN_DECLARED_REVIEWS,
	STALE_VERSION
} from './declared-policy-signoff.js';
import {
	DECLARED_RERUN_RATIONALE_REQUIRED,
	RERUN_DECLARED_REVIEWS_CITATION
} from '../execution/recovery-authority.js';

const POLICY = 'pol_requirement_coverage';
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
const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

/**
 * A MODEL work unit of a type that DECLARES `pol_requirement_coverage`, of a kind it governs — published, instantiated.
 * ⭐ `E12F` F3 — or the policies named: two, so one review can fail to conclude beside one that concludes.
 */
async function declaringModelUnit(policies: readonly string[] = [POLICY]): Promise<string> {
	const pwaId = mintUiId('pwa');
	const typeId = mintUiId('pwut');
	const steps: readonly [string, string, string, Record<string, unknown>][] = [
		['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId, name: 'Requirements PWA', description: 'd', domain: 'software', version: '0.1.0' }],
		[
			'DefinePwuType',
			'PWU_TYPE',
			typeId,
			{
				pwuTypeId: typeId,
				pwaId,
				pwuKind: 'REQUIREMENT_DEFINITION',
				name: 'Requirements',
				purpose: 'Write the requirements',
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [...policies],
				workDischarge: 'MODEL',
				promptTemplate: {
					templateText: 'Write the requirements of {subject}.',
					templateVersion: 1,
					declaredPlaceholders: ['subject'],
					status: 'ACTIVE'
				}
			}
		],
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: typeId }]
	];
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	const created = (await undertakings.create(actionEvent('create', { name: 'Declared Demo', pwaId, ...RISK }) as never)) as {
		created?: string;
		data?: { error?: string };
	};
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	return listPwus(getEngine(), created.created!).find((p) => p.state.pwuTypeId === typeId)!.id;
}

const recordAssurance = async (pwuId: string) =>
	(await actions.recordAssurance(actionEvent('recordAssurance', { pwuId }) as never)) as {
		advanced?: string;
		status?: number;
		data?: { error?: string };
	};

/** The unit's assessments under the declared policy, and the criterion results and findings recorded against each. */
function declaredRecord(pwuId: string) {
	const events = getEngine().readAllEvents();
	const assessments = listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
			(a) =>
				(a.state as { assurancePolicyId?: string }).assurancePolicyId === POLICY &&
				((a.state as { subjectObjectIds?: string[] }).subjectObjectIds ?? []).includes(pwuId)
		);
	const ids = new Set(assessments.map((a) => a.id));
	return {
		assessments: assessments.map((a) => a.state as Record<string, unknown>),
		results: events
			.filter((e) => e.eventType === 'AssuranceCriterionEvaluated' && ids.has(String((e.payload as { assessmentId?: string }).assessmentId)))
			.map((e) => e.payload as { criterionId: string; result: string }),
		findings: events
			.filter((e) => e.eventType === 'AssuranceObservationRecorded' && ids.has(String((e.payload as { assessmentId?: string }).assessmentId)))
			.map((e) => e.payload as { findingCode: string; severity: string })
	};
}

beforeEach(() => {
	resetEngine('reference');
	seam.declared.length = 0;
	seam.floor = 0;
	seam.unmet = undefined;
	seam.failing.clear();
	seam.observed = undefined;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ E2 — Record Assurance reviews each declared policy, and records what the reviewer answered', () => {
	it('⭐ a review answering a BLOCKING criterion NOT MET: REJECTED, recorded with its blocking finding — and the operator is told', async () => {
		const pwuId = await declaringModelUnit();
		const ran = await beginExecute(pwuId);
		expect(ran.data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		seam.unmet = 'RC-01';
		const r = await recordAssurance(pwuId);

		// ⭐ ONE REVIEW, for the one declared policy, judged against ITS purpose and criteria.
		expect(seam.declared, 'one review per declared policy (REG-D-110 (3))').toHaveLength(1);
		expect(seam.declared[0]).toContain('Requirement Coverage (pol_requirement_coverage)');
		// ⭐ RECORDED, NOT REFUSED BEFORE DISPATCH (design B3): the action says what was concluded, never that the unit is assured.
		expect(r.advanced, 'a verdict against the work is not reported as assured').toBeUndefined();
		expect(r.data?.error).toContain(
			`Assurance recorded, and the declared review did not conclude in this PWU's favour: ${POLICY} reached REJECTED`
		);
		const d = declaredRecord(pwuId);
		expect(d.assessments.map((a) => a.assessmentState)).toEqual(['REJECTED']);
		expect(d.results.map((x) => [x.criterionId, x.result])).toEqual([
			['RC-01', 'NOT_MET'],
			['RC-02', 'MET'],
			['RC-03', 'MET'],
			['RC-04', 'MET'],
			['RC-05', 'MET'],
			['RC-06', 'MET']
		]);
		expect(d.findings.map((f) => [f.findingCode, f.severity])).toEqual([['RC-01', 'BLOCKING']]);
		// ⭐ `REG-D-111` (1) — ~~CANON'S ROUTE~~ ITS FIRST HALF: the unit's assurance is REJECTED; ⚠ `E12F` F8: its lifecycle
		// stays under assurance — a departure from canon's `UNDER_ASSURANCE → REJECTED`, kept (the route says why).
		const unit = getObject(getEngine(), pwuId) as { workLifecycleState?: string; assuranceState?: string };
		expect([unit.workLifecycleState, unit.assuranceState]).toEqual(['UNDER_ASSURANCE', 'REJECTED']);
		// ⭐ WHO JUDGED, and the call it made: devin, its model, the review's invocation the token its call was recorded under.
		const evaluator = d.assessments[0]!.evaluator as { actorId?: string; modelId?: string; executionInstanceId?: string };
		expect([evaluator.actorId, evaluator.modelId]).toEqual(['devin', 'fixture-assurance-model']);
		const calls = listByType(getEngine(), 'MODEL_EXCHANGE')
			.map((x) => x.state as { plane?: string; assurancePolicyId?: string; runToken?: string })
			.filter((x) => x.assurancePolicyId === POLICY);
		expect(calls.map((x) => [x.plane, x.runToken])).toEqual([['ASSURANCE', evaluator.executionInstanceId]]);
		// ⭐ `REG-F-514` — the producer is the model that did the work, never the operator (a unit that did its own work;
		// ⚠ `E12F` F9: a unit composed of others records its own executor, the operator).
		expect((d.assessments[0]!.producer as { actorId?: string }).actorId).toMatch(/^model:/);
	});

	it('⭐ CONTROL — every criterion answered met: SATISFIED, the unit assured', async () => {
		const pwuId = await declaringModelUnit();
		expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		const r = await recordAssurance(pwuId);
		expect([r.advanced, r.data?.error]).toEqual(['assured', undefined]);
		const d = declaredRecord(pwuId);
		expect(d.assessments.map((a) => a.assessmentState)).toEqual(['SATISFIED']);
		expect(d.results).toHaveLength(6);
		expect(d.findings).toEqual([]);
		expect((getObject(getEngine(), pwuId) as { assuranceState?: string }).assuranceState).toBe('SATISFIED');
	});
});

// ── ⛔ `E12F` F4 — WHAT THE REVIEWER IS TOLD ABOUT THE INSTRUCTION, FOR A UNIT COMPOSED OF OTHERS ───────────────────────────
//
// The root is judged over its CHILDREN's work (`REG-D-111` (2)), and its instruction is ITS OWN PURPOSE: no agent was given it,
// and each child's work was produced under the child's own prompt. The framing said the work was produced "by the agents
// that did its children's work, which was given exactly this instruction" — a false account of the subject, which `R14`
// calls worse than no review.

/** The root's purpose, as its type declares it: what the root's declared review shows as the standard. */
const ROOT_PURPOSE = 'Realize the requirements of the product from the work of its phase.';

/**
 * A root type over ONE child type — the child a MODEL unit declaring `pol_requirement_coverage`, with its own prompt; the
 * root a HUMAN unit (a TRANSFORMATION, no prompt) declaring `pol_intent_preservation` — published and instantiated.
 * ⭐ R3-A F1 — or the root a MODEL unit with a prompt of its own, as half B's agent may declare it.
 */
async function rootOverAChild(rootDischarge: 'HUMAN' | 'MODEL' = 'HUMAN'): Promise<{ readonly root: string; readonly child: string }> {
	const pwaId = mintUiId('pwa');
	const childType = mintUiId('pwut');
	const rootType = mintUiId('pwut');
	const steps: readonly [string, string, string, Record<string, unknown>][] = [
		['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId, name: 'Realization PWA', description: 'd', domain: 'software', version: '0.1.0' }],
		[
			'DefinePwuType',
			'PWU_TYPE',
			childType,
			{
				pwuTypeId: childType,
				pwaId,
				pwuKind: 'REQUIREMENT_DEFINITION',
				name: 'Requirements',
				purpose: 'Write the requirements',
				isRoot: false,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: [POLICY],
				workDischarge: 'MODEL',
				promptTemplate: {
					templateText: 'Write the requirements of {subject}.',
					templateVersion: 1,
					declaredPlaceholders: ['subject'],
					status: 'ACTIVE'
				}
			}
		],
		[
			'DefinePwuType',
			'PWU_TYPE',
			rootType,
			{
				pwuTypeId: rootType,
				pwaId,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'Realization',
				purpose: ROOT_PURPOSE,
				isRoot: true,
				permittedChildTypeIds: [childType],
				permittedChildren: [{ typeId: childType, cardinality: 'M1' }],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: ['pol_intent_preservation'],
				workDischarge: rootDischarge,
				...(rootDischarge === 'MODEL'
					? {
							promptTemplate: {
								templateText: 'Realize the product of {subject}.',
								templateVersion: 1,
								declaredPlaceholders: ['subject'],
								status: 'ACTIVE'
							}
						}
					: {})
			}
		],
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: rootType }]
	];
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	const created = (await undertakings.create(actionEvent('create', { name: 'Composed Demo', pwaId, ...RISK }) as never)) as {
		created?: string;
		data?: { error?: string };
	};
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const units = listPwus(getEngine(), created.created!);
	return {
		root: units.find((p) => p.state.pwuTypeId === rootType)!.id,
		child: units.find((p) => p.state.pwuTypeId === childType)!.id
	};
}

describe('⛔ E12F F4 — the root’s declared review is told only what is true of its subject', () => {
	it('⛔ the root’s declared prompt does not say its children were given the root’s instruction: the root’s PURPOSE is the standard, and each child’s work was made under its own instruction', async () => {
		// ⛔ PREDICTED RED, read from the code: the framing's one intent line — "produced … by a DIFFERENT AI agent (for a unit
		// composed of others, by the agents that did its children's work), which was given exactly this instruction:" — above
		// the ROOT's purpose, an instruction no agent was given.
		const { root, child } = await rootOverAChild();
		expect((await beginExecute(root)).data?.error, 'arrangement: the root’s Begin & Execute').toBeUndefined();
		expect((await beginExecute(child)).data?.error, 'arrangement: the child’s Begin & Execute').toBeUndefined();
		expect((await recordAssurance(child)).advanced, 'arrangement: the child signed off').toBe('assured');
		seam.declared.length = 0;
		await recordAssurance(root);
		expect(seam.declared, 'one declared review of the root').toHaveLength(1);
		const prompt = seam.declared[0]!;
		// ⛔ No claim that anyone was given this instruction — it is the root's purpose.
		expect(prompt, 'the root’s prompt says an agent was given its instruction').not.toContain('which was given exactly this instruction');
		expect(prompt).not.toContain('by the agents that did its children');
		// ⭐ What is true: the unit's own purpose is the standard, and each work product was made under its own unit's instruction.
		expect(prompt).toContain(DECLARED_UNIT_PURPOSE_INTENT);
		expect(prompt).toContain(ROOT_PURPOSE);
		expect(prompt).toContain('"workUnit":"Requirements"');
	});

	it('⭐ CONTROL — a unit that did its own work is still told, truly, that its producer was given exactly this instruction', async () => {
		const pwuId = await declaringModelUnit();
		expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		await recordAssurance(pwuId);
		expect(seam.declared).toHaveLength(1);
		expect(seam.declared[0]).toContain(DECLARED_PRODUCING_PROMPT_INTENT);
		expect(seam.declared[0]).not.toContain(DECLARED_UNIT_PURPOSE_INTENT);
	});
});

// ── ⭐⭐ `E12F` F3 — A DECLARED REVIEW THAT DID NOT CONCLUDE MAY BE RE-RUN, BY THE PERSON (`REG-D-112` (a)) ─────────────────────
//
// ⛔ One INCONCLUSIVE declared verdict STRANDED its unit: UNDER_ASSURANCE and ASSESSING, Record Assurance offered only while
// EXECUTING, and P7-6R's re-run reaching only a unit WAITING after a refused step — nothing moved it but Abandon.

const IP = 'pol_intent_preservation';
const RATIONALE = 'The intent review’s call failed at the transport; I am re-running it.';

/** What the page shows of the unit's declared re-run: the load's own view, or nothing. */
async function declaredRerunShown(pwuId: string): Promise<{ readonly policies: readonly string[] } | undefined> {
	const undertakingId = String((getObject(getEngine(), pwuId) as { undertakingId?: string }).undertakingId);
	const data = (await load({ params: { id: undertakingId } } as never)) as unknown as {
		readonly declaredRerunByPwu?: Readonly<Record<string, { readonly policies: readonly string[] }>>;
	};
	return data.declaredRerunByPwu?.[pwuId];
}

const rerunDeclared = async (pwuId: string, rationale = RATIONALE) =>
	(await actions.rerunDeclaredReviews(actionEvent('rerunDeclaredReviews', { pwuId, rationale }) as never)) as {
		advanced?: string;
		data?: { error?: string };
	};

/** The unit's assessments under `policyId`, in the order they were made. */
const assessmentsUnder = (pwuId: string, policyId: string) =>
	listByType(getEngine(), 'ASSURANCE_ASSESSMENT')
		.filter(
			(a) =>
				(a.state as { assurancePolicyId?: string }).assurancePolicyId === policyId &&
				((a.state as { subjectObjectIds?: string[] }).subjectObjectIds ?? []).includes(pwuId)
		)
		.map((a) => ({ id: a.id, state: (a.state as { assessmentState?: string }).assessmentState }));

const axesOf = (pwuId: string) => {
	const u = getObject(getEngine(), pwuId) as { workLifecycleState?: string; assuranceState?: string };
	return [u.workLifecycleState, u.assuranceState];
};

/** A unit declaring two policies, signed off with ONE declared review that did not conclude (its transport failed). */
async function strandedUnit(): Promise<string> {
	const pwuId = await declaringModelUnit([POLICY, IP]);
	expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
	seam.failing.add(IP);
	const first = await recordAssurance(pwuId);
	expect(first.data?.error, 'arrangement: the intent review did not conclude').toContain(`${IP} reached INCONCLUSIVE`);
	expect(axesOf(pwuId), 'arrangement: the unit is left under assessment').toEqual(['UNDER_ASSURANCE', 'ASSESSING']);
	return pwuId;
}

describe('⭐⭐ E12F F3 (REG-D-112 (a)) — a declared review that did not conclude is offered to the person, and re-run', () => {
	it('⭐ the page offers re-running ONLY the review that did not conclude; the re-run is a NEW assessment beside the old one, the person’s Decision citing REG-D-112 (a) — and the unit is assured', async () => {
		const pwuId = await strandedUnit();
		// ⛔ PREDICTED RED, read from the code: no offer — `load` carried no declared re-run, and no action existed: the unit,
		// UNDER_ASSURANCE and ASSESSING, could be moved by nothing the page offers but Abandon.
		expect(await declaredRerunShown(pwuId), 'the stranded unit is offered no re-run').toEqual({ policies: [IP] });
		seam.failing.clear();
		seam.declared.length = 0;
		const r = await rerunDeclared(pwuId);
		expect([r.advanced, r.data?.error]).toEqual(['declared-reviews-rerun', undefined]);
		// ⭐ ONLY THE REVIEW THAT DID NOT CONCLUDE is re-run: the requirement-coverage verdict that concluded is never asked again.
		expect(seam.declared, 'one review re-run').toHaveLength(1);
		expect(seam.declared[0]).toContain(`(${IP})`);
		// ⭐ EACH A NEW ASSESSMENT, THE OLD ONE KEPT.
		const ip = assessmentsUnder(pwuId, IP);
		expect(ip.map((a) => a.state)).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(assessmentsUnder(pwuId, POLICY).map((a) => a.state)).toEqual(['SATISFIED']);
		// ⭐ THE PERSON'S DECISION, their words then the decision cited, naming the unit and the review it re-runs.
		const decision = listByType(getEngine(), 'DECISION')
			.map((d) => d.state as { selectedOption?: string; rationale?: string; subjectObjectIds?: string[]; decisionType?: string })
			.find((d) => d.selectedOption === RERUN_DECLARED_REVIEWS);
		expect(decision?.rationale).toBe(`${RATIONALE}

${RERUN_DECLARED_REVIEWS_CITATION}`);
		// ⛔ E12's re-review F2 — THE RECORD SAYS WHAT REG-D-112 (a) IS: a decision delegated under the sponsor's REG-D-109 and
		// flagged for the sponsor's confirmation, never a sponsor's ruling, on the Decision's permanent, append-only record.
		expect(decision?.rationale, 'the Decision calls REG-D-112 a ruling').not.toMatch(/ruling REG-D-112|the ruling is the authority/);
		expect(decision?.rationale).toContain(
			'Authority: REG-D-112 (a), a decision delegated under the sponsor’s REG-D-109 and flagged for the sponsor’s confirmation'
		);
		expect(decision?.subjectObjectIds).toEqual([pwuId, ip[0]!.id]);
		// ⭐ THE UNIT, folded over every policy's latest verdict: assured — and offered no re-run now.
		expect(axesOf(pwuId)).toEqual(['UNDER_ASSURANCE', 'SATISFIED']);
		expect(await declaredRerunShown(pwuId)).toBeUndefined();
	});

	it('⛔ a re-run that again does not conclude is recorded — a second INCONCLUSIVE assessment, the unit still under assessment — and the person may choose again', async () => {
		const pwuId = await strandedUnit();
		const r = await rerunDeclared(pwuId);
		expect(r.advanced).toBeUndefined();
		expect(r.data?.error).toContain(`${IP} reached INCONCLUSIVE`);
		expect(assessmentsUnder(pwuId, IP).map((a) => a.state)).toEqual(['INCONCLUSIVE', 'INCONCLUSIVE']);
		expect(axesOf(pwuId)).toEqual(['UNDER_ASSURANCE', 'ASSESSING']);
		expect(await declaredRerunShown(pwuId)).toEqual({ policies: [IP] });
	});

	it('⛔ E12’s re-review F3 — a governing policy NEVER ASSESSED folds beside the re-run as one that did not conclude: the re-run is recorded, the unit stays under assessment, and the person is told which policy', async () => {
		// ⛔ PREDICTED RED, read from the code: `declaredRerunOffer` built `others` with flatMap(latest ?? []), so a governing
		// policy with no assessment was dropped and never folded — the re-run's SATISFIED folded SATISFIED, only the kernel's
		// NEVER_ASSESSED rung refused the hop, and the person got the kernel's message, the re-run's verdict unrecorded.
		const pwuId = await declaringModelUnit([POLICY, IP]);
		expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		// ⭑ A SUSPENDED policy governs nothing (`selectGoverningPolicies`), so Record Assurance assesses the intent review alone —
		// which does not conclude — and the coverage policy, resumed, governs the unit with no assessment of it.
		const policyAct = (commandType: string) => {
			const r = dispatch(commandType, 'ASSURANCE_POLICY', POLICY, { policyId: POLICY });
			expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		};
		policyAct('SuspendAssurancePolicy');
		seam.failing.add(IP);
		expect((await recordAssurance(pwuId)).data?.error, 'arrangement').toContain(`${IP} reached INCONCLUSIVE`);
		policyAct('ActivateAssurancePolicy');
		seam.failing.clear();
		expect(assessmentsUnder(pwuId, POLICY), 'arrangement: the coverage policy was assessed').toEqual([]);
		const offer = declaredRerunOffer(getEngine(), pwuId);
		expect('others' in offer ? offer.others : offer, 'a governing policy never assessed was dropped from the fold').toEqual([
			{ policyId: POLICY, assessmentId: null, state: NEVER_ASSESSED }
		]);
		const r = await rerunDeclared(pwuId);
		expect([r.advanced, r.data?.error]).toEqual([
			undefined,
			`The declared reviews were re-run, and each concluded in this PWU's favour; but ${POLICY} was never assessed: ` +
				"this PWU's assurance folds every governing policy's latest verdict, so it stays under assessment (REG-D-112 (a))."
		]);
		// ⭐ THE RE-RUN IS RECORDED — a paid review's verdict (PER-9) — and the unit does not hop.
		expect(assessmentsUnder(pwuId, IP).map((a) => a.state)).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(axesOf(pwuId)).toEqual(['UNDER_ASSURANCE', 'ASSESSING']);
	});

	it('⛔ E12’s polish (the confirm’s F3 general form) — a verdict of a policy NOT re-run that is BOUND TO ANOTHER SEMANTIC VERSION of the unit is not this unit’s, as the kernel reads it (STALE_VERSION): it folds as one that did not conclude, the re-run is recorded, and the person is told which policy', async () => {
		// ⛔ PREDICTED RED, read from the code: `declaredRerunOffer` carried the coverage policy's latest verdict at face value —
		// SATISFIED, though it binds version 2 of a unit at version 1 — so the re-run's SATISFIED folded SATISFIED, the kernel's
		// STALE_VERSION rung (`declaredPolicyVerdicts`) refused the hop, and the person got the kernel's message, the re-run's
		// verdict unrecorded.
		const pwuId = await strandedUnit();
		// ⭑ The kernel admits a verdict bound to a version its subject is not at (`RPH-ASR-010`, unenforced), and test mode's
		// `/test-api/dispatch` reaches it through this same command bus: a later SATISFIED of the coverage policy, binding 2.
		const policy = getObject(getEngine(), POLICY) as { version?: string; criteria?: { id: string }[] };
		const stale = mintUiId('asm');
		const evaluator = { actorId: 'devin', actorType: 'AGENT' as const, displayName: 'devin (fixture-assurance-model)' };
		const steps: [string, string, string, unknown][] = [];
		driveAssessmentToAssessing((...step) => steps.push(step), {
			assessmentId: stale,
			assurancePolicyId: POLICY,
			policyVersion: String(policy.version),
			subjectObjectIds: [pwuId],
			subjectSemanticVersions: { [pwuId]: 2 },
			claimIds: [],
			evaluator
		});
		for (const c of policy.criteria ?? []) steps.push(['RecordCriterionResult', 'ASSURANCE_ASSESSMENT', stale, { criterionId: c.id, result: 'MET' }]);
		steps.push([
			'CompleteAssuranceAssessment',
			'ASSURANCE_ASSESSMENT',
			stale,
			{
				validatorResult: {
					validatorId: 'reviewer.declared-policy',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: String(policy.version),
					assessmentId: stale,
					subjectObjectIds: [pwuId],
					subjectSemanticVersions: { [pwuId]: 2 },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: { evaluator }
				}
			}
		]);
		for (const [ct, agg, id, payload] of steps) {
			const r = dispatch(ct, agg, id, payload);
			expect(r.status, `arrangement: ${ct} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		}
		expect(assessmentsUnder(pwuId, POLICY).map((a) => a.state), 'arrangement').toEqual(['SATISFIED', 'SATISFIED']);
		expect(getEngine().loadObject(pwuId)?.semanticVersion, 'arrangement: the unit is at version 1').toBe(1);
		const offer = declaredRerunOffer(getEngine(), pwuId);
		expect('others' in offer ? offer.others : offer, 'a verdict bound to another version was folded at face value').toEqual([
			{ policyId: POLICY, assessmentId: stale, state: STALE_VERSION }
		]);
		seam.failing.clear();
		const r = await rerunDeclared(pwuId);
		expect([r.advanced, r.data?.error]).toEqual([
			undefined,
			`The declared reviews were re-run, and each concluded in this PWU's favour; but ${POLICY}'s latest verdict is bound to ` +
				"another semantic version of this PWU than its current one: this PWU's assurance folds every governing policy's latest " +
				'verdict, so it stays under assessment (REG-D-112 (a)).'
		]);
		// ⭐ THE RE-RUN IS RECORDED — a paid review's verdict (PER-9) — and the unit does not hop.
		expect(assessmentsUnder(pwuId, IP).map((a) => a.state)).toEqual(['INCONCLUSIVE', 'SATISFIED']);
		expect(axesOf(pwuId)).toEqual(['UNDER_ASSURANCE', 'ASSESSING']);
	});

	it('⛔ refused, with nothing dispatched: no rationale; a unit whose declared review CONCLUDED AGAINST the work (REG-D-105 (3)); and a unit with none that did not conclude', async () => {
		const stranded = await strandedUnit();
		const before = getEngine().readAllEvents().length;
		const unsaid = await rerunDeclared(stranded, '');
		expect(unsaid.data?.error).toBe(DECLARED_RERUN_RATIONALE_REQUIRED);
		expect(getEngine().readAllEvents().length, 'a refusal dispatched something').toBe(before);

		// A declared REJECTED is not re-reviewed: it goes canon's route (REG-D-111 (1)), the unit's assurance REJECTED.
		const rejected = await declaringModelUnit();
		expect((await beginExecute(rejected)).data?.error).toBeUndefined();
		seam.unmet = 'RC-01';
		await recordAssurance(rejected);
		seam.unmet = undefined;
		expect(await declaredRerunShown(rejected), 'a REJECTED unit is offered a re-review').toBeUndefined();
		expect((await rerunDeclared(rejected)).data?.error).toContain(
			`Re-running the declared reviews refused: a declared review concluded against the work (${POLICY} REJECTED): a REJECTED is not re-reviewed`
		);

		// An assured unit: nothing did not conclude.
		const assured = await declaringModelUnit();
		expect((await beginExecute(assured)).data?.error).toBeUndefined();
		expect((await recordAssurance(assured)).advanced).toBe('assured');
		expect(await declaredRerunShown(assured)).toBeUndefined();
		expect((await rerunDeclared(assured)).data?.error).toContain(
			'Re-running the declared reviews refused: the unit is UNDER_ASSURANCE with its assurance SATISFIED'
		);
	});

	it('⭐ the markup: the re-run is offered on an UNDER_ASSURANCE row, only where the load offers it, and asks for the person’s rationale', () => {
		const markup = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		const row = markup.indexOf("{:else if p.workLifecycleState === 'UNDER_ASSURANCE'}");
		const gate = markup.indexOf('{#if data.declaredRerunByPwu[p.id]}');
		const form = markup.indexOf('action="?/rerunDeclaredReviews"');
		expect([row > -1, gate > row, form > gate], 'the re-run is offered outside the UNDER_ASSURANCE row’s gate').toEqual([true, true, true]);
		const formMarkup = markup.slice(form, markup.indexOf('</form>', form));
		expect(formMarkup).toMatch(/name="rationale"[^>]*required/);
		// ⛔ E12's re-review F7 — INSIDE THAT BRANCH, not merely after its opening: the gate and the form lie before the next
		// `{:else if`, which opens the SATISFIED row's. Order alone held with the form moved into any later branch.
		const nextBranch = markup.indexOf('{:else if', row + 1);
		expect([gate < nextBranch, form < nextBranch], 'the re-run is offered in a branch after the UNDER_ASSURANCE row’s').toEqual([
			true,
			true
		]);
		// ⛔ AND THE PAID LANE PRESSES WHAT THE PAGE DRAWS: its rule finds the form by its test ids (`phase7-operator.ts`,
		// `declaredRerunOffered` and `rerunDeclared`), and nothing else ties them to this markup — each must be on this form.
		const operator = readFileSync(new URL('../../../../e2e-live-exec/phase7-operator.ts', import.meta.url), 'utf8');
		const laneIds = [...new Set([...operator.matchAll(/getByTestId\('(rerun-declared-[a-z-]+)'\)/g)].map((m) => m[1]!))];
		expect(laneIds, 'arrangement: the lane presses the form by its field and its button').toHaveLength(2);
		for (const id of laneIds) expect(formMarkup, `the lane presses ${id}, which the form does not carry`).toContain(`data-testid="${id}"`);
	});
});

// ── ⛔ THE MERGE'S FIX ROUND, F1 — A UNIT COMPOSED OF OTHERS WHOSE CHILDREN'S WORK HOLDS NOTHING TO JUDGE ────────────────────
//
// A unit composed of others is judged over its CHILDREN's work (`REG-D-111` (2)), a rule written for §3.2's two levels. Half B
// lets the agent publish a tree of any depth, and a child composed of others contributes no work of its own: its
// TRANSFORMATION completes with none. So the root of a three-level tree had its declared reviews asked over no work product
// and no command — a paid review per policy, each verdict recorded over work no reviewer was shown.
//
// ⭐⭐ R3-A F1 — `REG-D-111` (2)'S GENERAL FORM (the lead's delegated decision of 2026-10-16, to be registered as REG-D-114):
// ~~refused when no CHILD's work holds anything~~ — a unit composed of others is judged over the work its WHOLE SUBTREE
// produced: its own work product and commands where it produced any (a MODEL composite), then every unit below it, each
// under the title of the unit that made it. It is refused as having nothing to judge only when neither it nor any unit below
// it holds a work product or a command.

/** The work a declared review was shown: its one line of JSON (`declaredPolicyReviewInput`), read back off the prompt. */
function workOf(prompt: string): {
	readonly workProducts: readonly { readonly workUnit: string; readonly workProduct: string }[];
	readonly commands: readonly { readonly workUnit: string; readonly command: readonly string[] }[];
} {
	const line = prompt.split('\n').filter((l) => l.startsWith('{"workProducts":'));
	expect(line, 'arrangement: the prompt shows its work as one line of JSON').toHaveLength(1);
	return JSON.parse(line[0]!) as ReturnType<typeof workOf>;
}

/** One command the host ran to completion and retained, under `argv`. */
const aRun = (argv: readonly string[]): Omit<ObservedProcessRun, 'ordinal'> => ({
	argv,
	exitCode: 0,
	timedOut: false,
	durationMs: 12,
	outputComplete: true,
	omittedRegions: [],
	retention: {
		retained: true,
		workspaceOwnerId: 'arranged',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		stdoutPath: 'captures/run-1/stdout.txt',
		stderrPath: 'captures/run-1/stderr.txt',
		omittedRegions: [],
		omissionsPath: 'captures/run-1/omissions.json'
	},
	stdout: 'run-1: 1 passed\n',
	stderr: ''
});

/** What the host's REAL observer reports after `runs` complete — its own bound applied (`process-run-observer.ts`). */
function observedRuns(runs: readonly Omit<ObservedProcessRun, 'ordinal'>[]) {
	const observer = createProcessRunObserver();
	for (const run of runs) observer.ran(run);
	return observer.observed();
}

/**
 * A root over ~~ONE unit~~ ⭐ R3-A F1: TWO units composed of others, each over ONE model unit — three levels, as half B's
 * shared tree has (`verif/phase7-half-b.test.ts`) — published and instantiated: the root and the two above the model units
 * HUMAN, each a TRANSFORMATION that produces nothing, each declaring `pol_intent_preservation`; the model units `Requirements`,
 * declaring `pol_requirement_coverage`, and `Acceptance tests`, declaring nothing.
 */
async function threeLevelTree(): Promise<{
	readonly root: string;
	readonly middle: string;
	readonly leaf: string;
	readonly otherMiddle: string;
	readonly otherLeaf: string;
}> {
	const pwaId = mintUiId('pwa');
	const leafType = mintUiId('pwut');
	const otherLeafType = mintUiId('pwut');
	const middleType = mintUiId('pwut');
	const otherMiddleType = mintUiId('pwut');
	const rootType = mintUiId('pwut');
	const composite = (typeId: string, childTypes: readonly string[], name: string, pwuKind: string, purpose: string, isRoot: boolean) => ({
		pwuTypeId: typeId,
		pwaId,
		pwuKind,
		name,
		purpose,
		isRoot,
		permittedChildTypeIds: [...childTypes],
		permittedChildren: childTypes.map((typeId) => ({ typeId, cardinality: 'M1' })),
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: [IP],
		workDischarge: 'HUMAN'
	});
	const modelUnit = (typeId: string, name: string, pwuKind: string, policies: readonly string[]) => ({
		pwuTypeId: typeId,
		pwaId,
		pwuKind,
		name,
		purpose: `${name}, written`,
		isRoot: false,
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: [...policies],
		workDischarge: 'MODEL',
		promptTemplate: {
			templateText: `Write the ${name.toLowerCase()} of {subject}.`,
			templateVersion: 1,
			declaredPlaceholders: ['subject'],
			status: 'ACTIVE'
		}
	});
	const steps: readonly [string, string, string, Record<string, unknown>][] = [
		['CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { pwaId, name: 'Three-level PWA', description: 'd', domain: 'software', version: '0.1.0' }],
		['DefinePwuType', 'PWU_TYPE', leafType, modelUnit(leafType, 'Requirements', 'REQUIREMENT_DEFINITION', [POLICY])],
		['DefinePwuType', 'PWU_TYPE', otherLeafType, modelUnit(otherLeafType, 'Acceptance tests', 'TEST_DEFINITION', [])],
		['DefinePwuType', 'PWU_TYPE', middleType, composite(middleType, [leafType], 'Architecture', 'ARCHITECTURE_DEFINITION', 'Define the architecture, through the requirements beneath it.', false)],
		['DefinePwuType', 'PWU_TYPE', otherMiddleType, composite(otherMiddleType, [otherLeafType], 'Verification', 'INTEGRATED_PRODUCT_VALIDATION', 'Verify the product, through the acceptance tests beneath it.', false)],
		['DefinePwuType', 'PWU_TYPE', rootType, composite(rootType, [middleType, otherMiddleType], 'Realization', 'PRODUCT_REALIZATION', ROOT_PURPOSE, true)],
		['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
		['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: rootType }]
	];
	for (const [commandType, aggregateType, aggregateId, payload] of steps) {
		const r = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	}
	const created = (await undertakings.create(actionEvent('create', { name: 'Three-level Demo', pwaId, ...RISK }) as never)) as {
		created?: string;
		data?: { error?: string };
	};
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const units = listPwus(getEngine(), created.created!);
	const of = (typeId: string) => units.find((p) => p.state.pwuTypeId === typeId)!.id;
	return {
		root: of(rootType),
		middle: of(middleType),
		leaf: of(leafType),
		otherMiddle: of(otherMiddleType),
		otherLeaf: of(otherLeafType)
	};
}

describe('⭐⭐ R3-A F1 — a unit composed of others is judged over the work its WHOLE SUBTREE produced, and refused only when none of it holds anything', () => {
	it('⭐ (a) a three-level tree, as half B may publish: the root’s declared review is shown each model unit’s work, two levels down, under its own unit — and the unit above a model unit is reviewed over its child’s (the control)', async () => {
		// ⛔ RED BEFORE R3-A, read from the code: `declaredReviewWorkOf` gathered the root's CHILDREN only — two units composed of
		// others, whose TRANSFORMATIONs completed with no output — and refused the root (`nothingToJudge`): the work its declared
		// policies are about, its model units', was never shown to any review of it.
		const t = await threeLevelTree();
		for (const pwuId of [t.root, t.middle, t.otherMiddle])
			expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		// ⭑ The requirements unit runs one command, two levels below the root.
		seam.observed = observedRuns([aRun(['node', '--test', 'test/requirements.test.js'])]);
		expect((await beginExecute(t.leaf)).data?.error, 'arrangement: the requirements unit ran, and one command').toBeUndefined();
		seam.observed = undefined;
		expect((await beginExecute(t.otherLeaf)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		expect((await recordAssurance(t.leaf)).advanced, 'arrangement: the model unit signed off').toBe('assured');
		// ⭑ THE CONTROL: a unit above a model unit, reviewed over its child's work product, as before.
		seam.declared.length = 0;
		expect((await recordAssurance(t.middle)).advanced, 'the middle unit, over its child’s work product, was not signed off').toBe('assured');
		expect(seam.declared, 'one review of the middle unit’s one declared policy').toHaveLength(1);
		expect(workOf(seam.declared[0]!).workProducts.map((w) => w.workUnit)).toEqual(['Requirements']);

		seam.declared.length = 0;
		const r = await recordAssurance(t.root);
		expect([r.advanced, r.data?.error], 'the root of a three-level tree was refused, its model units’ work never shown').toEqual([
			'assured',
			undefined
		]);
		expect(seam.declared, 'one review of the root’s one declared policy').toHaveLength(1);
		// ⭐ EVERY MODEL UNIT'S WORK PRODUCT, under its own unit, depth first in the store's order — and nothing for the two units
		// composed of others between them, whose TRANSFORMATIONs produced nothing.
		const work = workOf(seam.declared[0]!);
		expect(work.workProducts.map((w) => w.workUnit), 'the work the root’s review was shown').toEqual(['Requirements', 'Acceptance tests']);
		// ⭑ Each its own unit's: the fixture's work product echoes the prompt it was given, which names its unit as the subject.
		expect(work.workProducts.map((w) => w.workProduct.includes(` of ${w.workUnit}.`)), 'each work product its own unit’s').toEqual([
			true,
			true
		]);
		expect(work.commands.map((c) => [c.workUnit, c.command.join(' ')]), 'the command run two levels down').toEqual([
			['Requirements', 'node --test test/requirements.test.js']
		]);
		// ⭑ Its own purpose the standard, and each work product made under its own unit's instruction (`E12F` F4).
		expect(seam.declared[0]).toContain(DECLARED_UNIT_PURPOSE_INTENT);
		expect(seam.declared[0]).toContain(ROOT_PURPOSE);
	});

	it('⭐ (b) a MODEL root’s OWN work product, and the command it ran, are judged beside its child’s work — its own first, under its own title', async () => {
		// ⛔ RED BEFORE R3-A, read from the code: a unit with children was judged over its CHILDREN's work alone, so a root that ran
		// a model of its own — half B's agent may declare one — had its declared reviews asked without the work it produced.
		const { root, child } = await rootOverAChild('MODEL');
		seam.observed = observedRuns([aRun(['node', '--test', 'test/acceptance.test.js'])]);
		expect((await beginExecute(root)).data?.error, 'arrangement: the root ran its model, and one command').toBeUndefined();
		seam.observed = undefined;
		expect((await beginExecute(child)).data?.error, 'arrangement: the child’s Begin & Execute').toBeUndefined();
		expect((await recordAssurance(child)).advanced, 'arrangement: the child signed off').toBe('assured');
		seam.declared.length = 0;
		expect((await recordAssurance(root)).advanced, 'the MODEL root was not signed off').toBe('assured');
		expect(seam.declared, 'one declared review of the root').toHaveLength(1);
		const work = workOf(seam.declared[0]!);
		expect(work.workProducts.map((w) => w.workUnit), 'the root’s own work product left out of its declared review').toEqual([
			'Realization',
			'Requirements'
		]);
		expect(work.workProducts[0]!.workProduct, 'the root’s own work product, as its model produced it').toContain(
			'Realize the product of Realization.'
		);
		expect(work.commands.map((c) => [c.workUnit, c.command.join(' ')]), 'the command the root ran').toEqual([
			['Realization', 'node --test test/acceptance.test.js']
		]);
		// ⭑ Its instruction is still its own purpose: no single account is shown for many units' work, its own among them.
		expect(seam.declared[0]).toContain(DECLARED_UNIT_PURPOSE_INTENT);
	});

	it('⛔ (c) a unit composed of others with NOTHING in it or anywhere below it is refused before any review is asked, nothing dispatched — and the root above it, whose other branch holds work, is reviewed over that work alone (the control)', async () => {
		// ⭑ At HEAD this unit was refused too — its one child held nothing — so its refusal's red is its mutant's
		// (`P7MF-M1`: the refusal dropped); the control was red there, the root refused for its children's nothing.
		const t = await threeLevelTree();
		// The acceptance tests never run: the unit above them, a TRANSFORMATION, holds nothing, and nothing below it does.
		for (const pwuId of [t.root, t.middle, t.otherMiddle, t.leaf])
			expect((await beginExecute(pwuId)).data?.error, 'arrangement: Begin & Execute').toBeUndefined();
		seam.declared.length = 0;
		const before = getEngine().readAllEvents().length;
		const r = await recordAssurance(t.otherMiddle);
		expect([r.advanced, r.data?.error], 'a unit with nothing in it or below it was reviewed').toEqual([
			undefined,
			`The declared policies cannot be reviewed: ${nothingToJudge('Verification')}`
		]);
		// ⛔ ASKED NOTHING, DISPATCHED NOTHING: no review, no exchange record, no assessment — and the unit as it was.
		expect(seam.declared, 'a declared review was asked').toEqual([]);
		expect(getEngine().readAllEvents().length, 'the refusal dispatched something').toBe(before);
		expect(axesOf(t.otherMiddle)).toEqual(['EXECUTING', 'UNASSESSED']);
		// ⭑ THE CONTROL: the root, over that empty branch and one that holds work, is reviewed over the work that is there.
		const root = await recordAssurance(t.root);
		expect([root.advanced, root.data?.error], 'the root, over one branch that holds work, was refused').toEqual(['assured', undefined]);
		expect(workOf(seam.declared[0]!).workProducts.map((w) => w.workUnit)).toEqual(['Requirements']);
	});
});
