// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.26; `REG-D-166` (1), (2), (5);
// `REG-F-643`; `REG-F-212`) — A DEFECT A LATER CHECK FINDS GOES BACK TO THE UNIT THAT MADE IT, BY REPLACEMENT — THROUGH THE PAGE'S OWN ACTIONS.
//
// ⛔ WHAT WAS WRONG (`REG-F-643`). P6 again's ninth run accepted Source Construction's work, and End-to-End Verification, two levels on, was
// rejected for a defect in it; D71's re-run redid only the verification's own work, and nothing could send the work back to the unit that made it.
//
// ⭑ WHAT MUST HOLD (the sponsor's ruling `REG-D-166` (1), (2), (5); the candidates, the reach, the act, the link and the readers are the lead's,
// D72; the notice in place of removal the lead's ruling on L17a's STOP, option D):
//   · a unit its declared reviews rejected at its sign-off whose work used other units' work is offered "Send the work back to" one of them — the
//     units whose work its work used — and only it;
//   · the act, in ONE batch: the person's Decision (REPLAN, REPLACE_REACHED_WORK, their words then REG-D-166 (1)), its subjects the rejected unit,
//     each rejecting verdict and each other unit in the reach; a new unit of each reached unit's type, parents before children, each with the
//     old one's shape, its parent and dependencies pointing at the new units where those were replaced and at the live ones where kept; each new
//     composite's decomposition, over its current children, proposed and validated; then each old unit superseded by its successor, citing it;
//   · each superseded unit's accepted-work file then holds a notice, never its old work; a kept unit's file is untouched;
//   · and every reader follows the links: the page's start offer and Begin & Execute, D69's hand-over (only an accepted, current producer's work)
//     and a composite's declared reviews (only its current children's work).
//
// ⭑ THE ARRANGEMENT: package L16's (`criteria-and-rework.route.test.ts`), its seams byte for byte — the floor's reviewer devin with its program
// replaced at its exec seam, the declared reviewer stood in for at its seam, a scripted producer whose work product names its session's number,
// one in-memory workspace per Undertaking, the real content store. THE FIXTURE is the ninth run's shape, smaller: a root over the Specification,
// Build — a model's composite over Source, Tests (which needs Source's work) and Lint (which does not) — Verification (which needs Build's
// work, its two declared reviews the ones that reject it) and Docs, a parallel branch the fault did not reach.
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
	/** Set, the workspace refuses a write to a path this answers true for, with this reason (D69's route test's seam). */
	refuseWrite: undefined as undefined | { readonly when: (path: string) => boolean; readonly because: string },
	// ⭐ L17b2 (ruling 3; the lead's §13) — the Historian's four seams, `assurance-stage.route.test.ts`'s, copied byte for byte.
	/**
	 * ⭐ L17b2 (D73, D86) — what devin answers as the Historian, given its prompt: its answer's text, the session export it writes, or a failure of the
	 * call; undefined, a clean answer — every criterion met, nothing recurring, nothing recommended — and an export with no step.
	 */
	historian: undefined as
		| undefined
		| ((call: { readonly prompt: string }) => { readonly stdout?: string; readonly export?: string; readonly fails?: string }),
	/** ⭐ L17b2 (D86) — each call devin was given as the Historian: its argv, its working folder and its bound, and what its folder and its user configuration held at the call. */
	historianCalls: [] as {
		readonly args: readonly string[];
		readonly cwd: string;
		readonly timeout: number;
		readonly files: Readonly<Record<string, string>>;
		readonly userConfig: string;
	}[],
	/** ⭐ L17b2 (ruling 2 (A)) — what `devin --version` answers the Historian's check: the version whose tools were measured, unless a case says another. */
	historianVersion: 'devin 3000.11.234 (92c83011d113)',
	/** ⭐ L17b2 (ruling 6) — set, the Historian's call is given the seams the stage handed it (`historianExec`), not this file's program. */
	historianPassThrough: false,
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
			if (!seam.workspaces.has(undertakingId)) {
				const workspace = createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: undertakingId,
					purgeability: 'RETAINED_BY_PARTICIPATION'
				});
				seam.workspaces.set(undertakingId, {
					workspace: {
						...workspace,
						// ⭑ A WRITE A CASE REFUSES, as the port refuses one: an outcome, never a throw (D69's route test's seam).
						writeFile: async (path: string, contents: string) =>
							seam.refuseWrite?.when(path)
								? { written: false as const, refusedBecause: seam.refuseWrite.because }
								: workspace.writeFile(path, contents)
					},
					outputWorkspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'PURGEABLE_AT_EXPIRY'
					}),
					runner: createRefusingProcessRunner()
				});
			}
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
				// ⭐ Package L17b3 (design D91; the lead's ruling 2 on Stage 1's writing) — arrangement only: this producer keeps its history, so it answers
				// as Pi's adapter does after D92's gathering — a result carrying the stops of the messages its answer was gathered from (`stop`, an
				// ordinary reply) — so a repair on a session that holds the reviewed answer sends the findings alone, as before. ~~A bare string~~.
				turn: async (text: string) => {
					const scripted = await (async () => {
						seam.turns.push(text);
						return JSON.stringify({
							workProduct: { document: `ATTEMPT ${session}: ${text.split('\n')[0]}` },
							rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] }
						});
					})();
					return {
						answer: { arrived: true as const, text: scripted },
						rawOutput: scripted,
						producer: { agentId: 'execution.model-invocation', modelId: 'faux/model', providerId: 'faux' },
						identityEvidence: 'PROVIDER_REPORTED' as const,
						observedToolCalls: { canObserve: false as const, reason: 'a scripted fixture observes no tool calls' },
						gatheredFrom: [{ stopReason: 'stop' }]
					};
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => observer.observed(),
				dispose: () => undefined,
				retainsHistory: true,
				// ⭐ Package L17b3 (design D89) — arrangement only: a session says the tools it minted, as every `ProducerSession` now must; this one mints
				// none, so no record is put within the model's reach.
				mintedToolNames: []
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

// ⭐⭐ L17b2 (D86; the lead's rulings 2, 6, 8 and 16) — THE HISTORIAN'S REAL CALL, ITS PROGRAM REPLACED AT THE SEAM, as the floor's devin is above:
// `devin --version` answered by the case (`seam.historianVersion`), and the session by the case's answer (`seam.historian`), its export written where
// the argv names it; what the folder and the user configuration held at the call kept (`seam.historianCalls`). Where a case hands the stage a seam of
// its own (`historianExec`, ruling 6), the call is given that seam (`seam.historianPassThrough`). ⚠ The module is package L17b2's: until it exists
// nothing imports it, so this factory never runs (vitest gives a mock of an absent module its unresolved id).
// ⭐ L17b2 (ruling 3; the lead's §13) — `assurance-stage.route.test.ts`'s mock, copied byte for byte, so that the three route files' arrangements are one.
vi.mock('../tools/devin-historian.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-historian.js')>();
	const fs = await import('node:fs');
	const path = await import('node:path');
	/** Every file under `root`, by its path relative to it, `/`-separated, with its text. */
	const tree = (root: string): Record<string, string> => {
		const out: Record<string, string> = {};
		const walk = (dir: string): void => {
			for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
				const at = path.join(dir, e.name);
				if (e.isDirectory()) walk(at);
				else out[path.relative(root, at).split(path.sep).join('/')] = fs.readFileSync(at, 'utf8');
			}
		};
		walk(root);
		return out;
	};
	/** A clean answer over the policy's rubric: each of HC-01 to HC-05 met, nothing recurring, nothing recommended. */
	const clean = JSON.stringify({
		findings: ['HC-01', 'HC-02', 'HC-03', 'HC-04', 'HC-05'].map((id) => ({ criterionId: id, failed: false, statement: 'met' })),
		recommendation: 'SATISFIED',
		residualUncertainty: [],
		recurrence: null,
		recommendedControlAction: null
	});
	return {
		...actual,
		devinHistorianCall: vi.fn(
			(call: Parameters<typeof actual.devinHistorianCall>[0], given: Parameters<typeof actual.devinHistorianCall>[1]) =>
				seam.historianPassThrough
					? actual.devinHistorianCall(call, given)
					: actual.devinHistorianCall(call, {
							versionOf: async () => seam.historianVersion,
							exec: async (_file: string, args: readonly string[], options: { readonly cwd: string; readonly timeout: number }) => {
								const after = (flag: string): string => args[args.indexOf(flag) + 1] ?? '';
								seam.historianCalls.push({
									args: [...args],
									cwd: options.cwd,
									timeout: options.timeout,
									files: tree(options.cwd),
									userConfig: fs.existsSync(after('--config')) ? fs.readFileSync(after('--config'), 'utf8') : ''
								});
								const answered = seam.historian?.({ prompt: fs.readFileSync(after('--prompt-file'), 'utf8') }) ?? {};
								if (answered.fails !== undefined) throw new Error(answered.fails);
								fs.writeFileSync(after('--export'), answered.export ?? JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [] }));
								return { stdout: answered.stdout ?? clean };
							}
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
import { dispatch, getArtifactStore, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { resolveUndertakingSandbox } from './workspace-host.js';
// ⭐ L17b2, Stage 3 — the offer itself, for its direct test (the test the mutants owed `P6X-L17A-M33`, below).
import { sendBackOffer } from './send-back.js';

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

/** ⭐ L17b2 (ruling 3) — one part of a press of the assurance stage, as the page returns it (`assurance-stage.route.test.ts`'s, copied). */
interface StagePartSeen {
	readonly part: string;
	readonly status: string;
	readonly artifactId?: string;
	readonly why?: string;
}

/** A page action on the fixture's Undertaking, as the page posts it. ⚠ An action the page does not have answers as an error, never a throw. */
// ⭐ L17b2 (ruling 3) — ~~`Promise<{ readonly advanced?: string; readonly error?: string; readonly supersededWorkNotNoticed?: string }>`~~: and the
// stage's parts, where the press was the assurance stage's (`assurance-stage.route.test.ts`'s `press`, its `stage` copied).
async function press(
	u: Fixture,
	action: Action,
	fields: Readonly<Record<string, string>>
): Promise<{
	readonly advanced?: string;
	readonly error?: string;
	readonly supersededWorkNotNoticed?: string;
	readonly stage?: readonly StagePartSeen[];
}> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as
		| { advanced?: string; supersededWorkNotNoticed?: string; stage?: readonly StagePartSeen[]; data?: { error?: string } }
		| undefined;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.stage === undefined ? {} : { stage: r.stage }),
		...(r?.supersededWorkNotNoticed === undefined ? {} : { supersededWorkNotNoticed: r.supersededWorkNotNoticed }),
		...(r?.data?.error === undefined ? {} : { error: r.data.error })
	};
}

/** The stored policy's name and criteria, as the sign-off's reader reads them. */
const policyOf = (id: string) =>
	getObject(getEngine(), id) as unknown as { name: string; criteria: { id: string; name: string; description: string }[] };

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
const eventCount = (): number => getEngine().readAllEvents().length;
const plansOf = (pwuId: string) => listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === pwuId);
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

/** Two declared policies the reference seed holds, each governing REQUIREMENT_DEFINITION — the two that reject Verification. */
const COVERAGE = 'pol_requirement_coverage';
const INTENT = 'pol_intent_preservation';
/** The person's words for the act. */
const TYPED = 'The verification found the fault in Source’s reader; send the work back to Source.';
/** D72's Decision's citation, as `recovery-authority.ts` words it — its opening, restated here, never imported. */
const CITATION_OPENING = 'Authority: the sponsor’s ruling REG-D-166 (1) — a defect a later check finds goes back to the unit that made it, by replacement';
/** The act's rationale-required words, restated. */
const SEND_BACK_RATIONALE =
	'Sending the work back to an earlier unit is recorded as your Decision: say why, in your own words — the rationale is required (REG-D-166 (1); DESIGN-the-stopped-unit-recovery.md RD4).';

/**
 * The ninth run's shape, smaller: a root (an operator's) over the Specification; Build, a model's composite over Source, Tests — which needs
 * Source's work — and Lint, which needs only the Specification's; Verification, which needs Build's work and declares the two policies that
 * reject it; and Docs, which needs only the Specification's: a branch the fault did not reach. `specPolicies` and `buildPolicies` give the
 * Specification and Build declared reviews of their own, where a case needs them.
 */
const TYPES = (specPolicies: readonly string[] = [], buildPolicies: readonly string[] = []): readonly FixtureType[] => [
	{ name: 'Product', isRoot: true, children: ['Specification', 'Build', 'Verification', 'Docs'], inputs: ['originating-intent'] },
	{
		name: 'Specification',
		inputs: ['originating-intent'],
		outputs: ['specification'],
		model: true,
		...(specPolicies.length === 0 ? {} : { policies: specPolicies, kind: 'REQUIREMENT_DEFINITION' })
	},
	{
		name: 'Build',
		children: ['Source', 'Tests', 'Lint'],
		outputs: ['build'],
		model: true,
		...(buildPolicies.length === 0 ? {} : { policies: buildPolicies, kind: 'REQUIREMENT_DEFINITION' })
	},
	{ name: 'Source', inputs: ['specification'], outputs: ['source'], model: true },
	{ name: 'Tests', inputs: ['source'], outputs: ['tests'], model: true },
	{ name: 'Lint', inputs: ['specification'], outputs: ['lint'], model: true },
	{ name: 'Verification', inputs: ['build'], outputs: ['verdict'], model: true, policies: [COVERAGE, INTENT], kind: 'REQUIREMENT_DEFINITION' },
	{ name: 'Docs', inputs: ['specification'], outputs: ['docs'], model: true }
];

type Fixture = Awaited<ReturnType<typeof instantiated>>;
// ⭐ L17b2 (ruling 3) — ~~`… | 'rerunRejectedWork' | 'sendWorkBack';`~~ and the assurance stage (`runAssuranceStage`), pressed before either way back.
type Action = 'beginExecute' | 'recordAssurance' | 'markSatisfied' | 'rerunRejectedWork' | 'sendWorkBack' | 'runAssuranceStage';

/** What the Undertaking page offers each unit for sending its work back (`sendBackByPwu`), read as the page loads. */
const sendBackOffers = (u: Fixture): Record<string, unknown> | undefined =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as { sendBackByPwu?: Record<string, unknown> }).sendBackByPwu;
/** What the Undertaking page offers each unit for re-running its work in place (D71's `rejectedRerunByPwu`). */
const rejectedOffers = (u: Fixture): Record<string, unknown> | undefined =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as { rejectedRerunByPwu?: Record<string, unknown> }).rejectedRerunByPwu;
/** The page's start offer on a unit's row (`startOfferOf`): offered, and why not. */
const startOf = (u: Fixture, pwuId: string) =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as {
		pwuList: { id: string; start: { offered: boolean; reason: string | null } | null }[];
	}).pwuList.find((p) => p.id === pwuId)?.start;
/** The unit titled `title` that is CURRENT — after a replacement, one title names an old unit and its successor. */
const currentOf = (u: Fixture, title: string) => {
	const found = listPwus(getEngine(), u.undertakingId).filter((p) => p.state.title === title && p.state.workLifecycleState !== 'SUPERSEDED');
	expect(found.length, `arrangement: one current unit titled ${title}`).toBe(1);
	return { id: found[0]!.id, state: found[0]!.state as Record<string, unknown> };
};
/** D69's file of a unit, as `acceptedWorkFile` names it — restated: its title's slug, then its id. */
const fileOf = (title: string, id: string): string => `.jpwb/accepted/${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}--${id}.txt`;
/** A work product's own words: the `document` its scripted producer wrote, `ATTEMPT <session>: <the turn's first line>`. */
const documentOf = (bytes: string): string => String((JSON.parse(bytes) as { document?: unknown }).document ?? '');

/** Each unit of `titles` accepted, in order (`accept`). */
async function acceptAll(u: Fixture, titles: readonly string[]): Promise<void> {
	for (const title of titles) await accept(u, title);
}

/** After the act: the CURRENT unit titled `title` — the successor — begun, signed off and marked satisfied, as `accept` does a unit. */
async function acceptCurrent(u: Fixture, title: string): Promise<void> {
	const pwuId = currentOf(u, title).id;
	for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const)
		expect((await press(u, action, { pwuId })).error, `arrangement: ${action} on the new ${title}`).toBeUndefined();
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, `arrangement: the new ${title} accepted`).toBe('SATISFIED');
}

/**
 * Every unit but the root accepted — the Specification, Source, Tests, Lint, Build and Docs — then Verification run and REJECTED at its
 * sign-off by both its declared reviews, each its first criterion NOT_MET and a BLOCKING finding open. Returns the units and the verdicts.
 */
async function verificationRejected(types: readonly FixtureType[] = TYPES()) {
	const u = await instantiated(types);
	await acceptAll(u, ['Specification', 'Source', 'Tests', 'Lint', 'Build', 'Docs']);
	const verification = u.unitOf('Verification');
	expect((await press(u, 'beginExecute', { pwuId: verification.id })).error, 'arrangement: Verification ran').toBeUndefined();
	const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
	const intent = policyOf(INTENT).criteria.map((c) => c.id);
	seam.answer = (policyId) =>
		policyId === COVERAGE
			? answerOf(COVERAGE, { 0: ['NOT_MET', 'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.'] }, cov[0])
			: answerOf(INTENT, { 0: ['NOT_MET', 'A documented usage does not work.'] }, intent[0]);
	const signed = await press(u, 'recordAssurance', { pwuId: verification.id });
	expect(signed.error ?? '', 'arrangement: the declared reviews rejected Verification').toContain(
		"Assurance recorded, and the declared review did not conclude in this PWU's favour"
	);
	expect(axesOf(verification.id), 'arrangement: Verification rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	seam.answer = (policyId) => answerOf(policyId);
	const unit = (title: string) => u.unitOf(title).id;
	return {
		u,
		ids: {
			product: unit('Product'),
			spec: unit('Specification'),
			build: unit('Build'),
			source: unit('Source'),
			tests: unit('Tests'),
			lint: unit('Lint'),
			verification: verification.id,
			docs: unit('Docs')
		},
		verdicts: verdictsOf(verification.id, [COVERAGE, INTENT])
	};
}

/** The act, as the page posts it: the work of Verification sent back to Source, the person's words typed. */
const sendBackToSource = (r: Awaited<ReturnType<typeof verificationRejected>>) =>
	press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.source, rationale: TYPED });

// ── ⭐⭐ L17b2 — §4.13's item 3 (ruling 3; the lead's §13): THE ROUND'S STAGE FIRST, ITS HISTORIAN CONCLUDING, BEFORE EITHER WAY BACK ──────────────────
//
// ⭑ After L17b2 neither D71's re-run nor D72's send-back is offered until the round's Historian assessment is recorded (ruling 3; D72's "When"), so each
// test of this file that reads either offer or presses either act straight after a rejection runs the round's stage first, through the page
// (`stageFirst`), its Historian's time bound set (ruling 16) so that it concludes — the seam's clean answer (`seam.historian` unset): every criterion
// met, nothing recurring, nothing recommended. The page's executor is the stand-in and its shared workspace in memory, so the Hypothesizer is not run
// (`stage-helper-run.ts`: "runs on Pi's harness alone") and the way back is the person's choice: D71's re-run beside every candidate, as before L17b2.
// The narrative's writer is answered by the floor's seam as it is (`seam.review` unset), so its chapter fails its check: none of this file's promises is
// about the narrative. ⭑ `historianBoundSet` and `stageFirst` are `assurance-stage.route.test.ts`'s, copied byte for byte.
/** ⭐ L17b2 — the Historian's time bound, set: required, with no default (ruling 16); design D84 fixes its value. */
const historianBoundSet = (): void => {
	vi.stubEnv('JPWB_HISTORIAN_CALL_MS', '600000');
};
/** ⭐ L17b2 — the round's stage pressed through the page, its Historian's time bound set so that it concludes; the parts the page returned. */
async function stageFirst(u: Fixture, pwuId: string): Promise<readonly StagePartSeen[]> {
	historianBoundSet();
	const pressed = await press(u, 'runAssuranceStage', { pwuId });
	expect(pressed.advanced, `arrangement: the round’s stage, first — ${pressed.error ?? ''}`).toBe('assurance-stage');
	return pressed.stage ?? [];
}

describe('⭐⭐ L17a (D72) — the page offers "Send the work back to" an earlier unit, and only where D72 says', () => {
	it('⛔ RED FIRST — on the unit its declared reviews rejected, naming the units whose work its work used: never itself, never a unit it did not use', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the offer read straight after the rejection~~: the way back is offered only once the round’s stage has run
		// and its Historian concluded, so the stage runs first (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the
		// offer, not the narrative. The Hypothesizer not run, the way back is the person’s choice: every candidate, in the offer’s order, as before.
		await stageFirst(r.u, r.ids.verification);

		expect(sendBackOffers(r.u)?.[r.ids.verification], 'the page does not offer the act on the rejected unit, with its candidates').toEqual({
			candidates: [
				{ id: r.ids.spec, title: 'Specification' },
				{ id: r.ids.build, title: 'Build' },
				{ id: r.ids.source, title: 'Source' },
				{ id: r.ids.tests, title: 'Tests' },
				{ id: r.ids.lint, title: 'Lint' }
			]
		});
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page renders no form for the act').toContain('action="?/sendWorkBack"');
		expect(page, 'the page asks no target for the act').toContain('data-testid="send-work-back-target"');
		expect(page, 'the page asks no rationale for the act').toContain('data-testid="send-work-back-rationale"');
	});

	it('⭑ CONTROL — and nowhere else: never on a unit never rejected, nor on a rejected unit whose work used no other unit’s; D71’s re-run in place offered as before', async () => {
		const u = await instantiated(TYPES([COVERAGE]));
		const spec = u.unitOf('Specification');
		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) => answerOf(policyId, { 0: ['NOT_MET', 'Requirement 3 has no acceptance criterion.'] }, cov[0]);
		expect((await press(u, 'recordAssurance', { pwuId: spec.id })).error ?? '', 'arrangement: the Specification rejected').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
		expect(axesOf(spec.id), 'arrangement: the Specification rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
		// ⭐ L17b2 (ruling 3; the lead’s §13) — ~~the offers read straight after the rejection~~: before a round’s stage no way back is offered on any unit,
		// so "nowhere else" read then would hold of every unit at once and tell nothing. So the Specification’s round’s stage runs first (`stageFirst`), its
		// Historian concluding, its writer failing its check (`seam.review` unset), and the page then offers a way back THERE — D71’s re-run, this CONTROL’s
		// own positive, below — while the send-back is read where it must stay absent: on the Specification, whose work used no other unit’s, and on Docs,
		// never rejected, after that same stage.
		await stageFirst(u, spec.id);

		const offers = sendBackOffers(u) ?? {};

		expect([offers[spec.id], offers[u.unitOf('Docs').id]], 'offered on the first unit, or on one never rejected').toEqual([undefined, undefined]);
		expect(rejectedOffers(u)?.[spec.id], 'D71’s re-run in place, its offer unchanged').toEqual({ policies: [COVERAGE], findings: 1 });
	});

	// ⭐⭐ L17b2, Stage 3 — a test the mutants owed (`P6X-L17A-M33`, a rejected unit whose work used no other unit’s offered the act, survived every test:
	// after L17b2 the page shows a way back only where the round’s rule offers it, and the rule offers no send-back with no candidate — so the page, and the
	// CONTROL above, cannot see the offer itself; as the lead’s §16 (5) gave `P6X-L16-M34` a direct test of `rejectedRerunOffer`). THE OFFER ITSELF
	// (`sendBackOffer`): a unit its declared reviews rejected whose work used no other unit’s is offered no send-back — refused, in the offer’s own words —
	// before its round’s stage and after it; ⭑ a rejected unit whose work used another’s is offered it, its candidates the units its work used (an
	// arrangement: the offer refuses not everything).
	it('⭑ CONTROL — the offer itself (`sendBackOffer`): a rejected unit whose work used no other unit’s is offered no send-back, refused in the offer’s own words, before its round’s stage and after it; one whose work used another’s is offered it', async () => {
		const r = await verificationRejected();
		const offered = sendBackOffer(getEngine(), r.ids.verification);
		expect('candidates' in offered && offered.candidates.length > 0, 'arrangement: a rejected unit whose work used another’s is offered the send-back').toBe(true);
		const u = await instantiated(TYPES([COVERAGE]));
		const spec = u.unitOf('Specification');
		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) => answerOf(policyId, { 0: ['NOT_MET', 'Requirement 3 has no acceptance criterion.'] }, cov[0]);
		expect((await press(u, 'recordAssurance', { pwuId: spec.id })).error ?? '', 'arrangement: the Specification rejected').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
		const refused = {
			refusedBecause:
				'its work used no other unit’s work, so there is no earlier unit to send it back to; re-running its own work is a re-run in place (REG-D-163 (2))'
		};
		expect.soft(sendBackOffer(getEngine(), spec.id), 'a rejected unit whose work used no other unit’s is offered the send-back, before its round’s stage').toEqual(refused);
		await stageFirst(u, spec.id);
		expect.soft(sendBackOffer(getEngine(), spec.id), 'a rejected unit whose work used no other unit’s is offered the send-back, after its round’s stage').toEqual(refused);
	});
});

describe('⭐⭐ L17a (D72) — the act, in one batch: the Decision, the new units parents first, the decomposition, the supersessions', () => {
	it('⛔ RED FIRST — the person’s Decision; a new unit of each reached unit’s type, parents before children, each with the old one’s shape re-pointed; the new composite’s decomposition over its current children; each old unit superseded by its successor', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the act’s one batch, its events counted from after the stage.
		const staged = await stageFirst(r.u, r.ids.verification);
		const before = eventCount();

		const sent = await sendBackToSource(r);

		expect([sent.advanced, sent.error], 'the act did not send the work back').toEqual(['work-sent-back', undefined]);
		const decisions = listByType(getEngine(), 'DECISION').filter((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK');
		expect(decisions.length, 'one Decision records the act').toBe(1);
		const decision = decisions[0]!;
		const verdictIds = r.verdicts.map((v) => v.assessmentId);
		// ⭐ L17b2 (D72; the lead’s §16 (3)) — ~~'… its subjects the rejected unit, its verdicts and the reach'~~: and, between the verdicts and the reach, the
		// round’s stage records in the stage’s order — each part the stage recorded (the chapter, the diagnosis, the Historian’s; a step-back where one
		// ran), read from the stage’s own answer — so the round a successor reads, the first assessment among the subjects, is still the first rejecting
		// verdict (the stage route file’s derivation tests hold it). Both checks soft, so the checks after them are observed at HEAD, where the act names no
		// stage record and the stage has no Historian.
		const stageRecords = staged.flatMap((p) => (p.artifactId === undefined ? [] : [p.artifactId]));
		expect
			.soft(staged.flatMap((p) => (p.artifactId === undefined ? [] : [p.part])), 'arrangement: the stage recorded its chapter, its diagnosis and the Historian’s part')
			.toEqual(['narrative-chapter', 'fault-diagnosis', 'historical-assessment']);
		expect
			.soft(
				[decision.state.decisionType, decision.state.status, decision.state.subjectObjectIds],
				'the Decision is not the act’s: REPLAN, EFFECTIVE, its subjects the rejected unit, its verdicts, the round’s stage records and the reach'
			)
			.toEqual(['REPLAN', 'EFFECTIVE', [r.ids.verification, ...verdictIds, ...stageRecords, r.ids.build, r.ids.source, r.ids.tests]]);
		const rationale = String(decision.state.rationale ?? '');
		expect([rationale.startsWith(`${TYPED}\n\n${CITATION_OPENING}`)], 'its rationale is not the person’s words, then the ruling').toEqual([true]);

		const events = getEngine().readAllEvents().slice(before);
		expect(
			events.map((e) => e.eventType),
			'not ONE batch in its order: the Decision, the proposals, the decomposition, the supersessions'
		).toEqual([
			'DecisionProposed',
			'DecisionEffective',
			'PwuProposed',
			'PwuProposed',
			'PwuProposed',
			'PwuProposed',
			'DecompositionProposed',
			'DecompositionValidated',
			'PwuSuperseded',
			'PwuSuperseded',
			'PwuSuperseded',
			'PwuSuperseded'
		]);
		const proposedIds = events.filter((e) => e.eventType === 'PwuProposed').map((e) => e.aggregateId);
		const stateOf = (id: string) => getObject(getEngine(), id) ?? {};
		expect(proposedIds.map((id) => stateOf(id).title), 'the new units, not parents before children').toEqual(['Build', 'Verification', 'Source', 'Tests']);
		const [build2, verification2, source2, tests2] = proposedIds as [string, string, string, string];
		expect(
			[build2, verification2, source2, tests2].map((id) => [stateOf(id).parentWorkUnitId, stateOf(id).dependencyIds]),
			'a new unit’s parent and dependencies are not re-pointed: to the new units where replaced, to the live ones where kept'
		).toEqual([
			[r.ids.product, [source2, tests2, r.ids.lint]],
			[r.ids.product, [build2]],
			[build2, [r.ids.spec]],
			[build2, [source2]]
		]);
		const shapeOf = (id: string) => {
			const s = stateOf(id);
			return [s.pwuTypeId, s.pwuKind, s.title, s.description, s.intentId, s.undertakingId, s.boundaries, s.assurancePolicyIds, s.riskProfile, s.inputRequirements];
		};
		expect(
			[build2, verification2, source2, tests2].map(shapeOf),
			'a new unit does not take the old one’s shape'
		).toEqual([r.ids.build, r.ids.verification, r.ids.source, r.ids.tests].map(shapeOf));
		expect(stateOf(source2).expectedOutputs, 'its expected output’s id is not minted afresh, as every production site mints it').toEqual([
			{ outputId: `out_${source2}`, kind: 'DOCUMENT' }
		]);
		const contract = listByType(getEngine(), 'DECOMPOSITION_CONTRACT').find((c) => c.state.parentWorkUnitId === build2);
		expect(
			[contract?.state.childWorkUnitIds, contract?.state.siblingDependencyIds, contract?.state.status],
			'the new composite’s decomposition is not proposed and validated over its current children, the kept one among them'
		).toEqual([[source2, tests2, r.ids.lint], [source2], 'VALID']);
		expect(
			[r.ids.build, r.ids.verification, r.ids.source, r.ids.tests].map((id) => [stateOf(id).workLifecycleState, stateOf(id).supersedingWorkUnitId]),
			'an old unit is not superseded by its successor, the link on its state'
		).toEqual([
			['SUPERSEDED', build2],
			['SUPERSEDED', verification2],
			['SUPERSEDED', source2],
			['SUPERSEDED', tests2]
		]);
		expect(
			events.filter((e) => e.eventType === 'PwuSuperseded').map((e) => (e.payload as { supersessionDecisionId?: string }).supersessionDecisionId),
			'a supersession does not cite the Decision'
		).toEqual([decision.id, decision.id, decision.id, decision.id]);
		expect(
			[r.ids.spec, r.ids.lint, r.ids.docs, r.ids.product].map((id) => stateOf(id).workLifecycleState),
			'a unit the fault did not reach, or never started, was moved'
		).toEqual(['SATISFIED', 'SATISFIED', 'SATISFIED', 'PROPOSED']);
	});

	it('⛔ RED FIRST — each superseded unit’s accepted-work file holds a notice, never its old work; a kept unit’s file is untouched', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the accepted-work files, read from after the stage.
		await stageFirst(r.u, r.ids.verification);
		const ws = workspaceOf(r.u);
		const kept = await Promise.all(
			(
				[
					['Specification', r.ids.spec],
					['Lint', r.ids.lint],
					['Docs', r.ids.docs]
				] as const
			).map(async ([title, id]) => [title, id, await ws.readFile(fileOf(title, id))] as const)
		);
		expect(kept.map(([, , bytes]) => bytes === undefined), 'arrangement: each kept unit’s file written at its acceptance').toEqual([false, false, false]);
		const old = await workProductOf(r.ids.source);

		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();

		const decision = listByType(getEngine(), 'DECISION').find((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK')!;
		for (const [title, id] of [
			['Source', r.ids.source],
			['Tests', r.ids.tests],
			['Build', r.ids.build]
		] as const) {
			const successor = String(getObject(getEngine(), id)?.supersedingWorkUnitId ?? '');
			const notice = (await ws.readFile(fileOf(title, id))) ?? '';
			expect(notice, `${title}’s file does not hold the notice`).toContain(
				`This file held the accepted work of "${title}" (${id}). That work was superseded by the replacement the sponsor's ruling REG-D-166 (1) provides (design D72): "${title}" (${successor}) takes its place, under the person's Decision ${decision.id}.`
			);
			expect(notice, `${title}’s file does not name where its successor’s own file will be`).toContain(
				`The successor's own accepted work is written to ${fileOf(title, successor)} when it is accepted.`
			);
		}
		expect((await ws.readFile(fileOf('Source', r.ids.source))) ?? '', 'the superseded work is still in its file').not.toContain(documentOf(old.bytes));
		expect(await ws.readFile(fileOf('Verification', r.ids.verification)), 'a unit never accepted was given a file').toBeUndefined();
		for (const [title, id, bytes] of kept) expect(await ws.readFile(fileOf(title, id)), `a kept unit’s file moved: ${title}`).toBe(bytes);
	});

	it('⛔ RED FIRST — a notice that cannot be written is stated, file by file, and the act stands', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset) — pressed before the workspace is made to refuse the notices.
		await stageFirst(r.u, r.ids.verification);
		seam.refuseWrite = {
			when: (p) => p === fileOf('Source', r.ids.source) || p === fileOf('Tests', r.ids.tests),
			because: 'the workspace refused the write (a case)'
		};

		const sent = await sendBackToSource(r);

		expect(sent, 'the failed notice was not stated, file by file, or the act did not stand').toEqual({
			advanced: 'work-sent-back',
			supersededWorkNotNoticed:
				`The work was sent back, but the notice of the superseded work was not written to ${fileOf('Source', r.ids.source)}: the workspace refused the write (a case); ` +
				`${fileOf('Tests', r.ids.tests)}: the workspace refused the write (a case)`
		});
		expect(
			[r.ids.build, r.ids.source, r.ids.tests].map((id) => getObject(getEngine(), id)?.workLifecycleState),
			'the act was undone'
		).toEqual(['SUPERSEDED', 'SUPERSEDED', 'SUPERSEDED']);
		expect((await workspaceOf(r.u).readFile(fileOf('Build', r.ids.build))) ?? '', 'a notice the workspace admitted was not written').toContain(
			'That work was superseded'
		);
	});

	it('⛔ RED FIRST — the page states it, beside the page’s other refusals', () => {
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not show the statement').toContain(
			'{#if form?.supersededWorkNotNoticed}<p class="err" role="alert" data-testid="superseded-work-not-noticed">{form.supersededWorkNotNoticed}</p>{/if}'
		);
		expect(page, 'the page’s action data does not carry the statement').toContain('supersededWorkNotNoticed?: string');
	});

	it('⛔ RED FIRST — refused before anything is dispatched: with no rationale; with a target that is not a candidate; on a unit in no such state', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the act pressed straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset), so the act is offered and each refusal below is for its own reason alone;
		// the events counted from after the stage.
		await stageFirst(r.u, r.ids.verification);
		const events = eventCount();

		const untyped = await press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.source });
		const notUsed = await press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.docs, rationale: TYPED });
		const itself = await press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.verification, rationale: TYPED });
		const notRejected = await press(r.u, 'sendWorkBack', { pwuId: r.ids.docs, targetId: r.ids.spec, rationale: TYPED });

		expect(untyped.error, 'no rationale was asked').toBe(SEND_BACK_RATIONALE);
		const candidates = `("Specification" ${r.ids.spec}, "Build" ${r.ids.build}, "Source" ${r.ids.source}, "Tests" ${r.ids.tests}, "Lint" ${r.ids.lint})`;
		expect([notUsed.error, itself.error], 'a target that is not a candidate was not refused, naming the candidates').toEqual([
			`Sending the work back refused: ${r.ids.docs} is not among the units whose work this unit’s work used ${candidates} (REG-D-166 (1); design D72).`,
			`Sending the work back refused: ${r.ids.verification} is not among the units whose work this unit’s work used ${candidates} (REG-D-166 (1); design D72).`
		]);
		expect(notRejected.error, 'a unit in no such state was not refused, naming why').toBe(
			'Sending the work back refused: the unit is SATISFIED with its execution SUCCEEDED and its assurance SATISFIED; only a unit its declared reviews rejected at its sign-off (UNDER_ASSURANCE, SUCCEEDED, REJECTED) may have its work sent back to an earlier unit (REG-D-166 (1))'
		);
		expect(eventCount(), 'a refused act dispatched something').toBe(events);
	});

	it('⭑ CONTROL — D71’s re-run in place stays as it is: offered on the same rejected unit, it re-runs the work of that unit, and supersedes nothing', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~D71’s offer read and its re-run pressed straight after the rejection~~: after the round’s stage, its Historian
		// concluding (`stageFirst`), its writer failing its check (`seam.review` unset). The way back the person’s choice, D71’s re-run is offered beside the
		// send-back; pressed, it carries the round’s feedback after its findings, which this CONTROL does not pin.
		await stageFirst(r.u, r.ids.verification);

		expect(rejectedOffers(r.u)?.[r.ids.verification], 'D71’s offer changed').toEqual({ policies: [COVERAGE, INTENT], findings: 2 });
		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: TYPED });
		expect([rerun.advanced, rerun.error], 'D71’s act changed').toEqual(['rejected-work-rerun', undefined]);
		expect(axesOf(r.ids.verification), 'the same unit did not run its work again').toEqual(['EXECUTING', 'SUCCEEDED', 'UNASSESSED']);
		expect(
			listPwus(getEngine(), r.u.undertakingId).filter((p) => p.state.workLifecycleState === 'SUPERSEDED'),
			'D71’s act superseded a unit'
		).toEqual([]);
	});
});

describe('⭐⭐ L17a (D72) — after the act, every reader follows the links', () => {
	it('⛔ RED FIRST — start readiness on the page: Begin & Execute offered on the new Source, its producer kept and accepted; withheld on each unit that waits for a successor, naming the successor, never the superseded unit', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is start readiness, not the narrative.
		await stageFirst(r.u, r.ids.verification);
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const [build2, verification2, source2, tests2] = ['Build', 'Verification', 'Source', 'Tests'].map((t) => currentOf(r.u, t).id) as [
			string,
			string,
			string,
			string
		];

		expect(startOf(r.u, source2), 'the new Source, its producer the kept Specification, accepted, is not offered').toEqual({
			offered: true,
			reason: null,
			kinds: [],
			outside: null
		});
		expect(
			[tests2, build2, verification2, r.ids.product].map((id) => startOf(r.u, id)?.reason),
			'a unit waiting on a successor is not withheld for it, named — the root among them, following through the links'
		).toEqual([
			'it waits for "Source" (PROPOSED) to be accepted',
			'it waits for "Source" (PROPOSED) and "Tests" (PROPOSED) to be accepted',
			'it waits for "Build" (PROPOSED) to be accepted',
			'it waits for "Build" (PROPOSED) and "Verification" (PROPOSED) to be accepted'
		]);
		expect(startOf(r.u, r.ids.source), 'a superseded unit is offered a start').toBeNull();
	});

	it('⛔ RED FIRST — D69’s hand-over: the new Tests is pointed at the new Source’s file, written from the new work; the old Source’s file keeps its notice', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is D69’s hand-over; the new Tests’ turn carries the round’s feedback
		// after its instruction, which names no accepted-work file.
		await stageFirst(r.u, r.ids.verification);
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		await acceptCurrent(r.u, 'Source');
		const tests2 = currentOf(r.u, 'Tests').id;
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: tests2 })).error, 'arrangement: the new Tests ran').toBeUndefined();

		const instruction = seam.turns[turns] ?? '';
		expect(instruction, 'its instruction does not point at the new Source’s file').toContain(`- Source: ${fileOf('Source', source2)}`);
		expect(instruction, 'its instruction points at the superseded Source’s file').not.toContain(fileOf('Source', r.ids.source));
		const ws = workspaceOf(r.u);
		expect(await ws.readFile(fileOf('Source', source2)), 'the new Source’s file does not hold its accepted work').toBe(
			(await workProductOf(source2)).bytes
		);
		expect((await ws.readFile(fileOf('Source', r.ids.source))) ?? '', 'the hand-over wrote the superseded Source’s work again').toContain(
			'That work was superseded'
		);
	});

	it('⛔ RED FIRST — D69’s hand-over follows the links at a unit that recorded a superseded unit: the root, started once the successors are accepted, is handed their files, and the superseded units’ notices stay', async () => {
		const r = await verificationRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is D69’s hand-over through the links, not the narrative.
		await stageFirst(r.u, r.ids.verification);
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		for (const title of ['Source', 'Tests', 'Build', 'Verification']) await acceptCurrent(r.u, title);
		const [build2, verification2] = ['Build', 'Verification'].map((t) => currentOf(r.u, t).id) as [string, string];
		const ws = workspaceOf(r.u);
		// ⭑ What the root's start must write again, were it handed the successors: their files cleared first.
		for (const [title, id] of [['Build', build2], ['Verification', verification2]] as const) await ws.writeFile(fileOf(title, id), 'stale');

		const started = await press(r.u, 'beginExecute', { pwuId: r.ids.product });

		expect([started.advanced, started.error], 'arrangement: the root, an operator’s, ran').toEqual(['executed', undefined]);
		expect(
			[await ws.readFile(fileOf('Build', build2)), await ws.readFile(fileOf('Verification', verification2))],
			'the root was not handed its successors’ accepted work, read through the links from the units it recorded'
		).toEqual([(await workProductOf(build2)).bytes, (await workProductOf(verification2)).bytes]);
		expect((await ws.readFile(fileOf('Build', r.ids.build))) ?? '', 'the hand-over wrote the superseded Build’s work again').toContain(
			'That work was superseded'
		);
		expect(await ws.readFile(fileOf('Verification', r.ids.verification)), 'the hand-over wrote the superseded Verification’s work').toBeUndefined();
	});

	it('⛔ RED FIRST — a composite’s declared reviews are shown its CURRENT children’s work: the new Source’s and Tests’, the kept Lint’s — never the superseded units’', async () => {
		const r = await verificationRejected(TYPES([], [INTENT]));
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the work sent back straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is what a composite’s declared review is shown, not the narrative.
		await stageFirst(r.u, r.ids.verification);
		const [oldSource, oldTests, lint] = await Promise.all([r.ids.source, r.ids.tests, r.ids.lint].map((id) => workProductOf(id)));
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		for (const title of ['Source', 'Tests']) await acceptCurrent(r.u, title);
		const build2 = currentOf(r.u, 'Build').id;
		expect((await press(r.u, 'beginExecute', { pwuId: build2 })).error, 'arrangement: the new Build ran').toBeUndefined();
		const [source2, tests2] = await Promise.all([currentOf(r.u, 'Source').id, currentOf(r.u, 'Tests').id].map((id) => workProductOf(id)));
		seam.declared.length = 0;

		expect((await press(r.u, 'recordAssurance', { pwuId: build2 })).error, 'arrangement: the new Build’s sign-off').toBeUndefined();

		const [review] = seam.declared;
		expect(
			[source2, tests2, lint].map((w) => (review?.content ?? '').includes(documentOf(w.bytes))),
			'its declared review is not shown its current children’s work'
		).toEqual([true, true, true]);
		expect(
			[oldSource, oldTests].map((w) => (review?.content ?? '').includes(documentOf(w.bytes))),
			'its declared review is shown a superseded child’s work'
		).toEqual([false, false]);
	});
});

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.review = undefined;
	seam.turns.length = 0;
	seam.workspaces.clear();
	seam.opens = 0;
	seam.declared.length = 0;
	seam.refuseWrite = undefined;
	// ⭐ L17b2 — the Historian's seams, reset: a clean answer, the version measured, this file's program.
	seam.historian = undefined;
	seam.historianCalls.length = 0;
	seam.historianVersion = 'devin 3000.11.234 (92c83011d113)';
	seam.historianPassThrough = false;
	seam.answer = (policyId) => answerOf(policyId);
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});
