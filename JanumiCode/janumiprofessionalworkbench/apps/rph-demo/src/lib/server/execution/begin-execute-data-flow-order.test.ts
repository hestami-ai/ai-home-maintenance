// ⭐⭐ `JAN-EXEC` Phase 7, package M — A UNIT STARTS ONLY AFTER ITS PRODUCERS ARE ACCEPTED, ENFORCED BY THE WORKBENCH (design
// `DESIGN-data-flow-order-and-deliverable-review.md` D1-D5; `REG-D-135` (2); `REG-F-578`).
//
// ⛔ WHAT WAS WRONG (`REG-F-578`). Run-12's lane pressed the root, and 4 of 4 composites, before the children whose outputs
// they required, and the root built a product into the shared workspace before the work it was to reconcile. Nothing
// stopped it: instantiation forced every unit's `dependencyIds` and `inputRequirements` to `[]`
// (`packages/rph-application/src/handlers/pwu.ts`), the page offered Begin & Execute on every PROPOSED row
// (`[id]/+page.svelte`), and the route dispatched a plan and started its step for whatever it was handed.
//
// ⭑ WHAT MUST HOLD, through the page's own actions on a published PWA's Undertaking:
//   · D1 — instantiation RECORDS each unit's producers and children (`dependencyIds`), the inputs nothing produces
//     (`inputRequirements`), and each decomposition's sibling dependencies (`siblingDependencyIds`, DEC-2);
//   · D2 — Begin & Execute on a unit whose producer is not accepted is REFUSED, naming it, before any model or reviewer call,
//     leaving no partial state: the unit PROPOSED, no plan, no binding;
//   · D3 — the page OFFERS Begin & Execute exactly where the engine would admit it, and shows the reason elsewhere;
//   · D4, D5 — an abandoned producer, and a loop, leave their consumers unstarted, named.
// ⛔ HERMETIC: test mode, the executor seam replaced by one that opens the stand-in whatever it is handed.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((_selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession({ kind: 'STAND_IN' })
		)
	};
});

// ⭑ THE TWO SELECTORS Begin & Execute asks before its batch, passed through unchanged — so a test can see whether the route
// asked them, and make them refuse (the route's own preflight, below: the package check's finding 2).
vi.mock('../assurance/preflight.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../assurance/preflight.js')>();
	return { ...actual, assurancePreflight: vi.fn(actual.assurancePreflight) };
});
vi.mock('./executor-selection.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./executor-selection.js')>();
	return { ...actual, selectExecutor: vi.fn(actual.selectExecutor) };
});

import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { START_REFUSAL_MARKER } from '@janumipwb/rph-projections';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage, load as unitPageLoad } from '../../../routes/undertakings/[id]/+page.server.js';
import { assurancePreflight } from '../assurance/preflight.js';
import { dispatch, dispatchBatch, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { selectExecutor } from './executor-selection.js';
import { getExecutionSession } from './model.js';

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

/** One type of the fixture PWA: its name, its children by name, what it requires and produces, and who discharges it. */
interface FixtureType {
	readonly name: string;
	readonly isRoot?: boolean;
	readonly children?: readonly string[];
	readonly inputs?: readonly string[];
	readonly outputs?: readonly string[];
	readonly model?: boolean;
}

/**
 * A PWA of `types`, authored and published through the commands, then an Undertaking of it created through the
 * portfolio's own action — so its units are what instantiation builds (`instantiateComposition`). Returns the
 * Undertaking's id and its units by title.
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
		name: 'Data-flow Order PWA',
		description: 'A PWA whose types hand their outputs to one another.',
		domain: 'software product',
		version: '0.1.0'
	});
	// Children before parents: a type's permitted children must exist to be named.
	for (const t of [...types].reverse())
		r('DefinePwuType', 'PWU_TYPE', idOf.get(t.name)!, {
			pwuTypeId: idOf.get(t.name)!,
			pwaId,
			pwuKind: t.name.toUpperCase().replaceAll(/[^A-Z]/g, '_'),
			name: t.name,
			purpose: `Do ${t.name}`,
			isRoot: t.isRoot === true,
			permittedChildTypeIds: (t.children ?? []).map((c) => idOf.get(c)!),
			requiredInputs: [...(t.inputs ?? [])],
			requiredOutputs: [...(t.outputs ?? [])],
			requiredAssurancePolicyIds: [],
			workDischarge: t.model === true ? 'MODEL' : 'HUMAN',
			...(t.model === true
				? {
						promptTemplate: {
							templateText: 'Do {subject}.',
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
		event('/undertakings', 'create', { name: 'Data-flow Order', pwaId, ...RISK })
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

/** A root over two phases: Specify produces the spec Build requires; the root requires Build's result. */
const SPEC_BUILD: readonly FixtureType[] = [
	{
		name: 'Product',
		isRoot: true,
		children: ['Specify', 'Build'],
		inputs: ['originating-intent', 'build-result'],
		outputs: ['summary']
	},
	{ name: 'Specify', inputs: ['originating-intent'], outputs: ['specification'] },
	{ name: 'Build', inputs: ['specification'], outputs: ['build-result'], model: true }
];

beforeEach(() => {
	resetEngine('empty');
	vi.mocked(getExecutionSession).mockClear();
});

describe('⭐ D1 — instantiation RECORDS what each unit waits for', () => {
	it('⭐ THE PREDICTED RED — a consumer’s `dependencyIds` holds its producer’s id (it was `[]`); the root’s, its children; nothing unproduced', async () => {
		const u = await instantiated(SPEC_BUILD);
		const [root, specify, build] = [u.unitOf('Product'), u.unitOf('Specify'), u.unitOf('Build')];
		expect(build.state.dependencyIds, 'Build waits for its producer, Specify').toEqual([specify.id]);
		expect(root.state.dependencyIds, 'the root waits for its children, Build its producer too').toEqual([
			specify.id,
			build.id
		]);
		expect(specify.state.dependencyIds, 'Specify’s one input is the Intent’s').toEqual([]);
		expect([root, specify, build].map((x) => x.state.inputRequirements)).toEqual([[], [], []]);
	});

	it('⭐ an input NOTHING produces is recorded on its unit, named unproduced', async () => {
		const u = await instantiated([
			{ name: 'Product', isRoot: true, children: ['Survey'] },
			{ name: 'Survey', inputs: ['market-study'], outputs: ['survey'] }
		]);
		expect(u.unitOf('Survey').state.inputRequirements).toEqual([{ name: 'market-study', status: 'UNPRODUCED' }]);
	});

	it('⭐ DEC-2 — the decomposition contract records its sibling dependencies: the children another child waits for', async () => {
		const u = await instantiated(SPEC_BUILD);
		const contracts = listByType(getEngine(), 'DECOMPOSITION_CONTRACT').filter(
			(c) => c.state.parentWorkUnitId === u.unitOf('Product').id
		);
		expect(contracts.map((c) => c.state.siblingDependencyIds)).toEqual([[u.unitOf('Specify').id]]);
	});
});

/** Begin & Execute on `pwuId` of `undertakingId`, through the page's own action. */
async function beginExecute(undertakingId: string, pwuId: string): Promise<{ status?: number; error?: string }> {
	const r = (await unitPage.beginExecute(
		event(`/undertakings/${undertakingId}`, 'beginExecute', { pwuId }, undertakingId) as never
	)) as { status?: number; data?: { error?: string } } | undefined;
	return { status: r?.status, error: r?.data?.error };
}

const plansOf = (pwuId: string) =>
	listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === pwuId);
const bindings = () => listByType(getEngine(), 'RUNTIME_BINDING').length;
const modelExchanges = () => listByType(getEngine(), 'MODEL_EXCHANGE').length;

describe('⭐ D2 — the engine REFUSES a start until every unit it waits for is accepted, before any model or reviewer call', () => {
	it('⭐ THE PREDICTED RED — Begin & Execute on a consumer whose producer is PROPOSED is refused, naming the producer; no model exchange, the executor never opened; the consumer PROPOSED, no plan, no binding', async () => {
		const u = await instantiated(SPEC_BUILD);
		const [specify, build] = [u.unitOf('Specify'), u.unitOf('Build')];
		const [exchanges, bound] = [modelExchanges(), bindings()];

		const refused = await beginExecute(u.undertakingId, build.id);

		expect(refused.error ?? '', 'Build was not refused for its producer').toContain(START_REFUSAL_MARKER);
		expect(refused.error).toContain('it waits for "Specify" (PROPOSED) to be accepted');
		expect(refused.status).toBe(400);
		expect(modelExchanges(), 'a refused start recorded a model exchange').toBe(exchanges);
		expect(vi.mocked(getExecutionSession), 'the executor was opened for a refused start').not.toHaveBeenCalled();
		expect(getObject(getEngine(), build.id)?.workLifecycleState, 'the consumer left PROPOSED').toBe('PROPOSED');
		expect(plansOf(build.id), 'a plan was left behind').toEqual([]);
		expect(bindings(), 'a runtime binding was left behind').toBe(bound);
		expect(getObject(getEngine(), specify.id)?.workLifecycleState).toBe('PROPOSED');
	});

	it('⭑ CONTROL — the producer itself, waiting for nothing, starts; once it is ACCEPTED (signed off) its consumer is admitted', async () => {
		const u = await instantiated(SPEC_BUILD);
		const [specify, build] = [u.unitOf('Specify'), u.unitOf('Build')];
		expect((await beginExecute(u.undertakingId, specify.id)).error, 'the producer was refused').toBeUndefined();
		await signOff(u.undertakingId, specify.id);
		expect(getObject(getEngine(), specify.id)?.workLifecycleState).toBe('SATISFIED');
		const admitted = await beginExecute(u.undertakingId, build.id);
		expect(admitted.error ?? '', 'the consumer was refused once its producer was accepted').not.toContain(
			START_REFUSAL_MARKER
		);
		expect(getObject(getEngine(), build.id)?.workLifecycleState, 'the consumer did not start').not.toBe('PROPOSED');
		expect(plansOf(build.id).length).toBe(1);
	});
});

// ⭐ THE ROUTE'S OWN PREFLIGHT (D3: "The route's own preflight in `beginExecute` refuses the same way before its batch";
// package M's independent check, its finding 2). The engine refuses a waiting unit inside the batch with or without it, so
// the tests above stay green without it — what only it gives is the ORDER: the dependency refusal comes before the
// reviewer's preflight and the executor's selection, so a waiting MODEL unit is told what it waits for, not that a reviewer
// or an executor is misconfigured. So both selectors are made to REFUSE here, and the route must neither ask them nor
// return their words. The control proves the spies sit on the route's path: once the producer is accepted, each refusal
// in turn is what the route returns.
describe("⭐ D2, D3 — the route's own preflight refuses a waiting unit BEFORE the reviewer's preflight and the executor's selection", () => {
	const real = async () => ({
		preflight: await vi.importActual<typeof import('../assurance/preflight.js')>('../assurance/preflight.js'),
		selection: await vi.importActual<typeof import('./executor-selection.js')>('./executor-selection.js')
	});
	afterEach(async () => {
		const { preflight, selection } = await real();
		vi.mocked(assurancePreflight).mockReset().mockImplementation(preflight.assurancePreflight);
		vi.mocked(selectExecutor).mockReset().mockImplementation(selection.selectExecutor);
	});
	/** Both selectors refuse from now on, each with its own real refusal for a host that configures nothing. */
	const bothRefuse = async () => {
		const { preflight, selection } = await real();
		const reviewer = preflight.assurancePreflight({ testMode: false, env: {} });
		const executor = selection.selectExecutor({ testMode: false, env: {} });
		if (reviewer.ready || executor.kind !== 'REFUSED') throw new Error('arrangement: a selector did not refuse');
		vi.mocked(assurancePreflight).mockReset().mockImplementation(() => reviewer);
		vi.mocked(selectExecutor).mockReset().mockImplementation(() => executor);
		return { reviewer, executorWords: selection.executorRefusalMessage(executor), preflight };
	};

	it('⭐ a waiting MODEL unit is refused for what it waits for, though both selectors would refuse it, and neither is asked', async () => {
		const u = await instantiated(SPEC_BUILD);
		const build = u.unitOf('Build');
		const { reviewer } = await bothRefuse();

		const refused = await beginExecute(u.undertakingId, build.id);

		expect(refused.error ?? '', 'the waiting unit got another refusal').toContain(START_REFUSAL_MARKER);
		expect(refused.error).toContain('it waits for "Specify" (PROPOSED) to be accepted');
		expect(refused.error, "the reviewer's refusal came first").not.toContain(reviewer.guidance);
		expect(vi.mocked(assurancePreflight), "the reviewer's preflight was asked for a waiting unit").not.toHaveBeenCalled();
		expect(vi.mocked(selectExecutor), "the executor's selection was asked for a waiting unit").not.toHaveBeenCalled();
		expect(getObject(getEngine(), build.id)?.workLifecycleState).toBe('PROPOSED');
	});

	it('⭑ CONTROL — the same unit, its producer accepted: the reviewer refuses it in its words; the reviewer ready, the executor does', async () => {
		const u = await instantiated(SPEC_BUILD);
		const [specify, build] = [u.unitOf('Specify'), u.unitOf('Build')];
		expect((await beginExecute(u.undertakingId, specify.id)).error, 'arrangement: Specify starts').toBeUndefined();
		await signOff(u.undertakingId, specify.id);
		const { reviewer, executorWords, preflight } = await bothRefuse();

		expect((await beginExecute(u.undertakingId, build.id)).error, "the reviewer's refusal").toBe(reviewer.guidance);
		expect(vi.mocked(assurancePreflight)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(selectExecutor), 'the executor was selected after the reviewer refused').not.toHaveBeenCalled();

		vi.mocked(assurancePreflight).mockImplementation(preflight.assurancePreflight);
		expect((await beginExecute(u.undertakingId, build.id)).error, "the executor's refusal").toBe(executorWords);
		expect(vi.mocked(selectExecutor)).toHaveBeenCalledTimes(1);
		expect(getObject(getEngine(), build.id)?.workLifecycleState, 'a refused start moved the unit').toBe('PROPOSED');
	});
});

/** Record Assurance, then Mark Satisfied, on `pwuId`, through the page's own actions — the unit SATISFIED. */
async function signOff(undertakingId: string, pwuId: string): Promise<void> {
	for (const action of ['recordAssurance', 'markSatisfied'] as const) {
		const r = (await unitPage[action](
			event(`/undertakings/${undertakingId}`, action, { pwuId }, undertakingId) as never
		)) as { data?: { error?: string } } | undefined;
		expect(r?.data?.error, `arrangement: ${action} on ${pwuId}`).toBeUndefined();
	}
}

// ── D3, D4, D5 — THE PAGE FOLLOWS THE ENGINE ─────────────────────────────────────────────────────────────────────────

/** A root over seven phases: one free, one waiting, one whose producer is abandoned, two in a loop, one unproduced. */
const MIXED: readonly FixtureType[] = [
	{
		name: 'Program',
		isRoot: true,
		children: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Loop A', 'Loop B', 'Survey'],
		inputs: ['originating-intent']
	},
	{ name: 'Alpha', inputs: ['originating-intent'], outputs: ['alpha-out'] },
	{ name: 'Beta', inputs: ['alpha-out'], outputs: ['beta-out'] },
	{ name: 'Gamma', outputs: ['gamma-out'] },
	{ name: 'Delta', inputs: ['gamma-out'], outputs: ['delta-out'] },
	{ name: 'Loop A', inputs: ['b-out'], outputs: ['a-out'] },
	{ name: 'Loop B', inputs: ['a-out'], outputs: ['b-out'] },
	{ name: 'Survey', inputs: ['market-study'], outputs: ['survey'] }
];

type PageRow = {
	id: string;
	title: string;
	workLifecycleState: string;
	start: { offered: boolean; reason: string | null; kinds: readonly string[] } | null;
};
const pageRows = (undertakingId: string): PageRow[] =>
	(unitPageLoad({ params: { id: undertakingId } } as never) as unknown as { pwuList: PageRow[] }).pwuList;

/**
 * THE ENGINE'S OWN DISPOSITION of a start, with nothing left behind: `BeginPwuShaping` then `MarkPwuReady` in one batch, and
 * a third command certain to be refused (a second `BeginPwuShaping`, which no longer starts from PROPOSED) — so the batch
 * always rolls back, and its first refusal says where the engine stopped. Admitted means the refusal came after readiness.
 */
function engineAdmits(pwuId: string): { readonly admitted: boolean; readonly message: string } {
	const shape = { commandType: 'BeginPwuShaping', targetAggregateType: 'PROFESSIONAL_WORK_UNIT', targetAggregateId: pwuId, payload: {} };
	const batch = dispatchBatch([
		shape,
		{
			commandType: 'MarkPwuReady',
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: pwuId,
			payload: { shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 }
		},
		shape
	]);
	expect(batch.ok, 'the probe batch committed').toBe(false);
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, 'the probe left the unit moved').toBe('PROPOSED');
	return { admitted: batch.failedIndex === 2, message: batch.results[batch.failedIndex ?? 0]?.error?.message ?? '' };
}

describe('⭐ D3 — the page OFFERS Begin & Execute exactly where the engine would admit it, and shows why elsewhere (SPEC-001 :3244)', () => {
	it('⭐ THE PREDICTED RED — a consumer whose producer is PROPOSED is NOT offered, and its reason is shown', async () => {
		const u = await instantiated(SPEC_BUILD);
		const build = pageRows(u.undertakingId).find((r) => r.title === 'Build');
		expect(build?.start, 'the page offered Build, which waits for Specify').toEqual({
			offered: false,
			reason: 'it waits for "Specify" (PROPOSED) to be accepted',
			kinds: ['waiting']
		});
		expect(pageRows(u.undertakingId).find((r) => r.title === 'Specify')?.start).toEqual({
			offered: true,
			reason: null,
			kinds: []
		});
	});

	it('⭐ BOTH DIRECTIONS, ON EVERY PROPOSED UNIT — offered ⇔ the engine admits; withheld ⇔ the engine refuses, in the same words; across waiting, accepted, abandoned (D4), a loop (D5) and an input nothing produces', async () => {
		const u = await instantiated(MIXED);
		const alpha = u.unitOf('Alpha');
		expect((await beginExecute(u.undertakingId, alpha.id)).error, 'arrangement: Alpha starts').toBeUndefined();
		await signOff(u.undertakingId, alpha.id);
		const gamma = u.unitOf('Gamma');
		const abandoned = (await unitPage.abandonPwu(
			event(`/undertakings/${u.undertakingId}`, 'abandonPwu', { pwuId: gamma.id }, u.undertakingId) as never
		)) as { data?: { error?: string } } | undefined;
		expect(abandoned?.data?.error, 'arrangement: Gamma abandoned').toBeUndefined();

		const proposed = pageRows(u.undertakingId).filter((r) => r.workLifecycleState === 'PROPOSED');
		expect(
			proposed.map((r) => [r.title, r.start?.offered, r.start?.kinds]),
			'what the page offers, and why it withholds the rest'
		).toEqual([
			['Program', false, ['waiting', 'abandoned']],
			['Beta', true, []],
			['Delta', false, ['abandoned']],
			['Loop A', false, ['waiting', 'loop']],
			['Loop B', false, ['waiting', 'loop']],
			['Survey', false, ['unproduced']]
		]);
		for (const row of proposed) {
			const engine = engineAdmits(row.id);
			expect(engine.admitted, `${row.title}: the page ${row.start?.offered ? 'offers' : 'withholds'} it`).toBe(
				row.start?.offered
			);
			if (!engine.admitted) expect(engine.message, `${row.title}: the engine gave another reason`).toContain(row.start!.reason!);
		}
		const loopA = proposed.find((r) => r.title === 'Loop A')!;
		expect(loopA.start?.reason).toContain('it sits in a loop: "Loop A" → "Loop B" → "Loop A"');
		expect(proposed.find((r) => r.title === 'Delta')?.start?.reason).toBe('its producer "Gamma" was ABANDONED');
		expect(proposed.find((r) => r.title === 'Survey')?.start?.reason).toBe(
			'nothing in this Undertaking produces its input "market-study"'
		);
		// ⭑ And the action follows: the offered unit is admitted by Begin & Execute, a withheld one refused in its words.
		expect((await beginExecute(u.undertakingId, u.unitOf('Beta').id)).error, 'the offered Beta was refused').toBeUndefined();
		const refusedDelta = await beginExecute(u.undertakingId, u.unitOf('Delta').id);
		expect(refusedDelta.error).toContain('its producer "Gamma" was ABANDONED');
		expect(getObject(getEngine(), u.unitOf('Delta').id)?.workLifecycleState, 'D4: the consumer started').toBe('PROPOSED');
	});
});
