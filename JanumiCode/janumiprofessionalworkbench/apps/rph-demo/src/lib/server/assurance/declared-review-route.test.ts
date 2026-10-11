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
	unmet: undefined as string | undefined
}));

vi.mock('../execution/model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../execution/model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async (_file, args) => ({ stdout: await actual.deterministicExecutionPrint(args[1] ?? '') }),
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
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

import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../../routes/undertakings/[id]/+page.server.js';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actionEvent, beginExecute } from '../execution/begin-execute.testing.js';
import { dispatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import { DECLARED_PRODUCING_PROMPT_INTENT, DECLARED_UNIT_PURPOSE_INTENT } from './reasoning-review-validator.js';

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

/** A MODEL work unit of a type that DECLARES `pol_requirement_coverage`, of a kind it governs — published, instantiated. */
async function declaringModelUnit(): Promise<string> {
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
 */
async function rootOverAChild(): Promise<{ readonly root: string; readonly child: string }> {
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
				workDischarge: 'HUMAN'
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
