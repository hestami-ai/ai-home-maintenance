// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 to D77 with D85 and D87 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.28 to §12.31, §12.39,
// §12.41; `REG-D-166` (3), (4); `REG-D-167` (2), (4); `REG-D-170`) — THE ASSURANCE STAGE AT A REJECTED SIGN-OFF, AND WHAT EACH SUCCESSOR'S FIRST TURN AND
// D71'S RE-RUN IN PLACE CARRY — THROUGH THE PAGE'S OWN ACTIONS.
//
// ⭑ WHAT MUST HOLD (the sponsor's rulings `REG-D-166` (3), (4) and `REG-D-167` (2); the stage's trigger the lead's ruling (B); the parts, the records
// and the turn the lead's, D74 to D77):
//   · on a unit its declared reviews rejected at its sign-off the page offers "Run the assurance stage", once per round, the round named by its
//     opening verdict; one press writes the narrative's chapter first — one call to the selected reviewer's harness, its exchange on the ASSURANCE
//     plane under `pol_historical_consistency` — then runs the Hypothesizer on Pi's harness in a copy of the shared workspace, then, only on an open
//     `KNOWN_FAILURE_RECURRENCE` recorded on the round, the Unsticking Agent; each part recorded, a failing one as failing, and the stage going on;
//     no Decision, no state moved, no unit redefined;
//   · D71's re-run in place after the stage carries, after its findings, the narrative and the request for its tactic record, which is read,
//     recorded and overwritten before the deliverable view is taken, and which no view and no review holds;
//   · the faulty unit's successor — derived from the record as the unit the act was pressed for — carries the narrative, the round's failed
//     criteria and the request; each other successor the narrative and the line naming the replaced unit and the Decision.
// ⭑ THE ARRANGEMENT: package L17a's (`send-back.route.test.ts`), its seams byte for byte but two, named in its assembler: the scripted producer may
// write into the workspace as it is sent a turn (`seam.onTurn`), as a model's `write_file` would; `press` carries the stage's outcome; and a case may
// give the page a sessions root (`seam.sessionsRoot`, as a serving store's), every opener's place kept (`seam.places`) — D85's durable arm through
// the page, the producer still the harness's scripted one, Pi selected by the environment.
// ⭑ THE HELPERS ON PI are pressed directly (`runAssuranceStage`) over the route's own store: the route's executor is the stand-in, and a helper
// runs on Pi alone, in a copy of a FILESYSTEM workspace, its opener a scripted session.
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
	/** ⭐ L17b1 — what the scripted producer does as it is sent a turn, before it answers: a case's write into the workspace, as a model's would be. */
	onTurn: undefined as undefined | ((text: string) => Promise<void>),
	/** ⭐ L17b1 — the sessions root the page is given (`durableSessionsRoot`), as a serving store's; undefined, none, as test mode has. */
	sessionsRoot: undefined as undefined | string,
	/** ⭐ The lead's ruling (k) on the review's fifth re-check — set, asking for the sessions root throws this very value. */
	sessionsRootThrows: undefined as undefined | { readonly value: unknown },
	/** ⭐ L17b1 — the place each producer the route opened was handed, in order (the opener's second argument, D85). */
	places: [] as unknown[],
	/** ⭐ The review's defect 1 — each input the page handed the step, in order (`runModelInvocationStep`, passed through). */
	stepInputs: [] as unknown[],
	/** ⭐ The review's defect 7 — each tactic take the page asked for (whether the step had ended), and a case's answer in place of the take's own. */
	takes: [] as boolean[],
	takeAnswer: undefined as undefined | ((stepEnded: boolean) => unknown),
	/** ⭐ The review's re-check (D) — set, the page's batch is refused where this names a reason (`dispatchBatch`, passed through otherwise). */
	refuseBatch: undefined as undefined | ((commands: readonly { readonly commandType: string; readonly payload: Record<string, unknown> }[]) => string | undefined),
	/** ⭐ The review's re-check (D) — set, a try's command evidence cannot be recorded, for this reason (`joinProcessEvidence`, passed through otherwise). */
	refuseJoin: undefined as undefined | string,
	/**
	 * ⭐ The review's second re-check (D) — set, the workspace's listing throws, as a file removed between the walk and its stat throws it. ⭐ The lead's
	 * ruling (k) on the fifth — a string throws a new `Error` saying it, as before; `{ value }` throws that very value.
	 */
	listThrows: undefined as undefined | string | { readonly value: unknown },
	/** ⭐ The review's second re-check (D) — set, recording a try's deliverable view throws, as a store that cannot be written does; ⭐ ruling (k) — or the value. */
	viewThrows: undefined as undefined | string | { readonly value: unknown },
	/**
	 * ⭐ The review's second re-check (D) — set, reading the producer's process runs throws: an exception that escapes the try. ⭐ The lead's ruling (c) on
	 * the third — a string throws a new `Error` saying it, as before; `{ value }` throws that very value, so a case can hold what escapes by identity.
	 */
	processRunsThrows: undefined as undefined | string | { readonly value: unknown },
	/** ⭐ The lead's ruling (b) on the review's third re-check — how many times a producer's session was closed; and, set, what its close throws. */
	disposes: 0,
	disposeThrows: undefined as undefined | { readonly error: unknown },
	/** ⭐ The lead's ruling (c) on the review's third re-check — set, the page's batch throws this where `when` answers true, as a store that cannot be written throws. */
	throwBatch: undefined as
		| undefined
		| { readonly when: (commands: readonly { readonly commandType: string }[]) => boolean; readonly error: unknown },
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
		// ⭐ L17b1 — the sessions root a serving store would give, where a case sets one; else the product's own answer.
		durableSessionsRoot: vi.fn((env: NodeJS.ProcessEnv) => {
			// ⭐ The lead's ruling (k) — a case makes asking for the root throw a value of its choosing.
			if (seam.sessionsRootThrows !== undefined) throw seam.sessionsRootThrows.value;
			return seam.sessionsRoot ?? actual.durableSessionsRoot(env);
		}),
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
								: workspace.writeFile(path, contents),
						// ⭐ The review's second re-check (D) — a listing a case makes throw, as the port's one throwing method does.
						list: async (...args: Parameters<typeof workspace.list>) => {
							if (seam.listThrows !== undefined) throw typeof seam.listThrows === 'string' ? new Error(seam.listThrows) : seam.listThrows.value;
							return workspace.list(...args);
						}
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

// ⭐ The review's re-check (D) — THE PAGE'S BATCH, refused where a case says so, as the engine refuses one: an outcome, never a throw. Passed through
// otherwise, so every other dispatch is the engine's own.
vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return {
		...actual,
		dispatchBatch: vi.fn((commands: Parameters<typeof actual.dispatchBatch>[0]) => {
			// ⭐ The lead's ruling (c) on the review's third re-check — a batch a case makes throw, as a store that cannot be written throws.
			if (seam.throwBatch?.when(commands as never) === true) throw seam.throwBatch.error;
			const why = seam.refuseBatch?.(commands as never);
			return why === undefined
				? actual.dispatchBatch(commands)
				: ({ ok: false, results: [{ status: 'REJECTED', error: { message: why } }], failedIndex: 0 } as unknown as ReturnType<typeof actual.dispatchBatch>);
		})
	};
});

// ⭐ The review's re-check (D) — A TRY'S COMMAND EVIDENCE, refused where a case says so, as a store that refused its batch would leave it.
// ⭐ The review's second re-check (D) — A TRY'S DELIVERABLE VIEW, its recording made to throw where a case says so; passed through otherwise.
vi.mock('./deliverable-view.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./deliverable-view.js')>();
	return {
		...actual,
		recordDeliverableView: vi.fn(async (...args: Parameters<typeof actual.recordDeliverableView>) => {
			if (seam.viewThrows !== undefined) throw typeof seam.viewThrows === 'string' ? new Error(seam.viewThrows) : seam.viewThrows.value;
			return actual.recordDeliverableView(...args);
		})
	};
});

vi.mock('./evidence-join.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./evidence-join.js')>();
	return {
		...actual,
		joinProcessEvidence: vi.fn(async (...args: Parameters<typeof actual.joinProcessEvidence>) =>
			seam.refuseJoin === undefined
				? actual.joinProcessEvidence(...args)
				: ({ joined: [], refusedBecause: seam.refuseJoin } as unknown as Awaited<ReturnType<typeof actual.joinProcessEvidence>>)
		)
	};
});

// ⭐ The review's defect 7 — EACH TACTIC TAKE THE PAGE ASKS FOR, kept, then the take itself run — or a case's answer in its place, as a store that refused
// the record would answer: what the page does with a take's outcome is the page's part.
vi.mock('./successor-feedback.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./successor-feedback.js')>();
	return {
		...actual,
		takeTacticRecord: vi.fn(async (deps: Parameters<typeof actual.takeTacticRecord>[0], t: Parameters<typeof actual.takeTacticRecord>[1]) => {
			seam.takes.push(t.stepEnded);
			const answered = seam.takeAnswer?.(t.stepEnded);
			return answered === undefined ? actual.takeTacticRecord(deps, t) : (answered as Awaited<ReturnType<typeof actual.takeTacticRecord>>);
		})
	};
});

// ⭐ The review's defect 1 — THE STEP'S INPUT, KEPT AS THE PAGE HANDS IT, then the step itself run: what a later try is handed is the page's part.
vi.mock('./run-model-step.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./run-model-step.js')>();
	return {
		...actual,
		runModelInvocationStep: vi.fn(async (input: Parameters<typeof actual.runModelInvocationStep>[0]) => {
			seam.stepInputs.push(input);
			return actual.runModelInvocationStep(input);
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
		getExecutionSession: vi.fn(() => async (_context: unknown, place?: unknown) => {
			seam.places.push(place);
			const observer = createProcessRunObserver();
			seam.opens += 1;
			const session = seam.opens;
			return {
				turn: async (text: string) => {
					seam.turns.push(text);
					await seam.onTurn?.(text);
					return JSON.stringify({
						workProduct: { document: `ATTEMPT ${session}: ${text.split('\n')[0]}` },
						rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] }
					});
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => {
					// ⭐ The review's second re-check (D) — an exception a case makes escape the try; ⭐ the lead's ruling (c) — or the very value a case gives.
					const throws = seam.processRunsThrows;
					if (throws !== undefined) throw typeof throws === 'string' ? new Error(throws) : throws.value;
					return observer.observed();
				},
				// ⭐ The lead's ruling (b) — each close counted, and one a case makes throw, as Pi's `cleanupSessionResources` throws an `AggregateError`.
				dispose: () => {
					seam.disposes += 1;
					if (seam.disposeThrows !== undefined) throw seam.disposeThrows.error;
				},
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

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import type { Workspace } from '@janumipwb/rph-ports';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage, load as unitLoad } from '../../../routes/undertakings/[id]/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, dispatchBatch, getArtifactStore, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { resolveUndertakingSandbox, sessionFolderOf } from './workspace-host.js';
import { runAssuranceStage } from '../assurance/assurance-stage.js';
import { chapterRecordsOf } from '../assurance/narrative-chapter.js';
import { HELPER_INVOKER, NARRATIVE_WRITER_INVOKER } from '../assurance/assurance-stage-roles.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import { admittedViewRef, readDeliverableView } from './deliverable-view.js';
import { CARRIED_FINDINGS_LINE, FEEDBACK_HEADING, predecessorWithoutSessionNameOf } from './executor-session.js';
import { createFilesystemWorkspace } from './filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from './producer-session.js';
import { successorRoundOf, tacticRecordNotice, tacticRecordPath, tacticRecordRequest, takeTacticRecord } from './successor-feedback.js';

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

/** ⭐ L17b1 — one part of a press of the assurance stage, as the page returns it. */
interface StagePartSeen {
	readonly part: string;
	readonly status: string;
	readonly artifactId?: string;
	readonly why?: string;
}

/** A page action on the fixture's Undertaking, as the page posts it. ⚠ An action the page does not have answers as an error, never a throw. */
async function press(
	u: Fixture,
	action: Action,
	fields: Readonly<Record<string, string>>
): Promise<{
	readonly advanced?: string;
	readonly error?: string;
	readonly supersededWorkNotNoticed?: string;
	readonly stage?: readonly StagePartSeen[];
	readonly tacticRecordNote?: string;
	readonly sessionCloseNote?: string;
}> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as
		| {
				advanced?: string;
				supersededWorkNotNoticed?: string;
				stage?: readonly StagePartSeen[];
				tacticRecordNote?: string;
				sessionCloseNote?: string;
				data?: { error?: string; tacticRecordNote?: string; sessionCloseNote?: string };
		  }
		| undefined;
	// ⭐ The review's defect 7 — the tactic record's note, on an outcome or beside a refusal.
	const note = r?.tacticRecordNote ?? r?.data?.tacticRecordNote;
	// ⭐ The lead's ruling (b) on the review's third re-check — why the producer's session could not be closed, on an outcome or beside a refusal.
	const closeNote = r?.sessionCloseNote ?? r?.data?.sessionCloseNote;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.stage === undefined ? {} : { stage: r.stage }),
		...(r?.supersededWorkNotNoticed === undefined ? {} : { supersededWorkNotNoticed: r.supersededWorkNotNoticed }),
		...(r?.data?.error === undefined ? {} : { error: r.data.error }),
		...(note === undefined ? {} : { tacticRecordNote: note }),
		...(closeNote === undefined ? {} : { sessionCloseNote: closeNote })
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
type Action = 'beginExecute' | 'recordAssurance' | 'markSatisfied' | 'rerunRejectedWork' | 'sendWorkBack' | 'runAssuranceStage';

/** The unit titled `title` that is CURRENT — after a replacement, one title names an old unit and its successor. */
const currentOf = (u: Fixture, title: string) => {
	const found = listPwus(getEngine(), u.undertakingId).filter((p) => p.state.title === title && p.state.workLifecycleState !== 'SUPERSEDED');
	expect(found.length, `arrangement: one current unit titled ${title}`).toBe(1);
	return { id: found[0]!.id, state: found[0]!.state as Record<string, unknown> };
};
/** Each unit of `titles` accepted, in order (`accept`). */
async function acceptAll(u: Fixture, titles: readonly string[]): Promise<void> {
	for (const title of titles) await accept(u, title);
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

// ── ⭐⭐ L17b1 — this file's cases, over package L17a's harness above ────────────────────────────────────────────────────────────────────────────

/** What the Undertaking page offers each unit for the assurance stage (`assuranceStageByPwu`), read as the page loads. */
const stageOffers = (u: Fixture): Record<string, unknown> | undefined =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as { assuranceStageByPwu?: Record<string, unknown> }).assuranceStageByPwu;
/** The writer's prompt's opening (`narrativeChapterPrompt`), restated. */
const WRITER_PROMPT = 'You are writing chapter';
/** The records a writer's prompt gives, by their ids (`- [<id>] <text>`). */
const recordIdsOf = (prompt: string): string[] => [...prompt.matchAll(/^- \[([^\]]+)\] /gm)].map((m) => m[1]!);
/** The narrative writer, answering the chapter's form: one statement per record it was given, citing it; every other prompt as the floor's seam does. */
const chapterAnswering = (prompt: string): string | undefined => {
	if (!prompt.includes(WRITER_PROMPT)) return undefined;
	const ids = recordIdsOf(prompt);
	return JSON.stringify({
		chapter: 1,
		covers: ids,
		statements: ids.map((id) => ({ text: `The record ${id} stands as it was given.`, cites: [id] })),
		openItems: [],
		knownOmissions: [],
		previousChapter: null
	});
};
/** The tactic record a model writes when its turn asks for one (D77's fields). */
const RECORD = JSON.stringify({
	priorTactic: 'read the whole input as a file',
	whatItProduced: 'a reader that cannot read a pipe',
	whyChange: 'the verification ran the tool on a pipe',
	newTactic: 'read standard input as a stream, in chunks',
	expectedImprovement: 'the standard-input mode exits 0'
});
/** The path a turn asks its tactic record at (`tacticRecordRequest`'s words), or undefined. */
const askedTacticPath = (text: string): string | undefined => /write ONE JSON object to (\S+) with these fields/.exec(text)?.[1];
/** The scripted producer's write, as a model's would be: where its turn asks for a tactic record, the record, into the Undertaking's workspace. */
const writesItsTacticRecord = (u: Fixture) => async (text: string) => {
	const path = askedTacticPath(text);
	if (path !== undefined) await workspaceOf(u).writeFile(path, RECORD);
};
/**
 * ⭐ The lead's ruling (a) on the review's third re-check — the state of the step of the unit's latest plan, and each failure recorded on that plan, as
 * package N's check reads them (`package-n.route.test.ts`).
 */
const latestStepOf = (pwuId: string): { readonly stepState: unknown; readonly failed: readonly unknown[] } => {
	const plan = listByType(getEngine(), 'EXECUTION_PLAN')
		.filter((p) => p.state.workUnitId === pwuId)
		.at(-1);
	const step = ((plan?.state.steps ?? []) as { stepState?: unknown }[])[0];
	const failed = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepFailed' && e.aggregateId === plan?.id)
		.map((e) => (e.payload as { failureReason?: unknown }).failureReason);
	return { stepState: step?.stepState, failed };
};
/** ⭐ The lead's ruling (k) — what the test can say of a value that escaped, where the code under test could not: never a throw of the test's own. */
const saidOf = (e: unknown): string => {
	try {
		return e instanceof Error ? e.message : String(e);
	} catch {
		return '(a value the test cannot describe)';
	}
};
/** The stage's records of a part, as their SOURCE evidence names them. */
const stageEvidenceOf = (part: string) =>
	listByType(getEngine(), 'EVIDENCE').filter(
		(e) => ((e.state.contentReference as { stage?: { part?: string } } | undefined)?.stage?.part ?? '') === part
	);
/** The page's batch, as a direct call of the stage is handed it: one atomic dispatch, its refusal said. */
const runStepsHere = (steps: readonly (readonly [string, string, string, Record<string, unknown>])[]): string | null => {
	const batch = dispatchBatch(steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({ commandType, targetAggregateType, targetAggregateId, payload })));
	return batch.ok ? null : String(batch.results[batch.failedIndex ?? 0]?.error?.message ?? 'REJECTED');
};
const TMP = mkdtempSync(join(tmpdir(), 'jpwb-assurance-stage-route-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
let tmpCase = 0;
/**
 * A direct press of the stage on Pi's selection, over the route's store: the shared workspace a FILESYSTEM one in a temporary folder (the route's
 * own is in memory, and a helper needs a directory to copy), and Pi's opener a scripted session answering each helper's prompt. ⛔ No model.
 */
function onPi(answers: { readonly diagnosis: string; readonly stepBack: string }) {
	const dir = join(TMP, `case-${++tmpCase}`, 'demo.sqlite.workspaces', 'und-0123456789abcdef');
	mkdirSync(join(dir, 'src'), { recursive: true });
	writeFileSync(join(dir, 'src', 'reader.ts'), 'export const read = () => "";\n');
	const shared = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: dir });
	const asked: { readonly dir: string | undefined; readonly prompt: string }[] = [];
	const deps = {
		engine: getEngine(),
		store: getArtifactStore(),
		tenantPrefix: 'tnt-local',
		newId: mintUiId,
		now: () => '2026-11-16T12:00:00.000Z',
		runSteps: runStepsHere,
		dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => dispatch('RecordModelExchange', 'MODEL_EXCHANGE', aggregateId, payload),
		testMode: true,
		executor: { kind: 'PI', modelId: 'faux/model' } as const,
		sandboxOf: () => ({ workspace: shared }) as never,
		sessionsRoot: join(TMP, `case-${tmpCase}`, 'demo.sqlite.sessions'),
		openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => ({
			retainsHistory: true,
			turn: async (prompt: string) => {
				asked.push({ dir: context.workspace.directoryPath, prompt });
				return prompt.includes('You are the Hypothesizer') ? answers.diagnosis : answers.stepBack;
			},
			lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
			processRuns: () => createProcessRunObserver().observed(),
			dispose: () => undefined
		})
	};
	return { dir, asked, deps };
}
const DIAGNOSIS = JSON.stringify({
	hypotheses: [
		{
			candidate: 'SOURCE',
			statement: 'Source’s reader treats a pipe as a file.',
			evidence: ['src/reader.ts'],
			checks: [{ command: ['node', 'bin/wf.js', '-'], why: 'reads a pipe', ifHeld: 'exit 1', showed: 'exit 1' }]
		}
	],
	named: 'SOURCE',
	confidence: 'fairly sure',
	guidance: 'Build the reader in parts and check each against a pipe before the whole.'
});
const STEP_BACK = JSON.stringify({
	questions: [{ reconsider: 'the reader', question: 'What does the reader assume about its input that a pipe does not give?' }],
	facts: [{ fact: 'The reader calls fstat before it reads.', source: 'src/reader.ts' }]
});

describe('⭐⭐ L17b1 (D74 to D76; the lead’s ruling (B)) — the page offers the assurance stage on a rejected sign-off, once per round', () => {
	it('⛔ RED FIRST — on the unit its declared reviews rejected, its round named by its opening verdict; nowhere else; and not again once the round’s stage has run', async () => {
		const r = await verificationRejected();
		const roundId = r.verdicts[0]!.assessmentId;

		expect(stageOffers(r.u), 'the stage is not offered on the rejected unit alone, naming its round').toEqual({ [r.ids.verification]: { roundId } });
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page renders no form for the stage').toContain('action="?/runAssuranceStage"');
		expect(page, 'the page renders no button for the stage').toContain('data-testid="run-assurance-stage"');

		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).advanced, 'arrangement: the stage ran').toBe('assurance-stage');

		expect(stageOffers(r.u)?.[r.ids.verification], 'the stage is offered again for a round whose stage ran').toBeUndefined();
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error ?? '', 'a second press of one round was not refused').toContain(
			`the assurance stage has run for this round (${roundId})`
		);
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.docs })).error ?? '', 'the stage ran on a unit never rejected').toContain(
			'the assurance stage runs on a unit its declared reviews rejected at its sign-off'
		);
	});

	it('⛔ RED FIRST — not offered once the unit is re-run in place: its state is no longer the rejected one, though its last verdict still is', async () => {
		const r = await verificationRejected();
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect(axesOf(r.ids.verification), 'arrangement: the re-run left the rejected state').not.toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);

		expect(stageOffers(r.u)?.[r.ids.verification], 'the stage is offered on a unit re-run in place, before its new sign-off').toBeUndefined();
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error ?? '', 'the stage ran on a unit re-run in place').toContain(
			'the assurance stage runs on a unit its declared reviews rejected at its sign-off'
		);
	});
});

describe('⭐⭐ L17b1 (D76, D74, D75) — one press: the chapter first, then the Hypothesizer, then the Unsticking Agent on an open recurrence', () => {
	it('⛔ RED FIRST — the chapter, written once by the selected reviewer’s harness from the records each with its id, its exchange on the ASSURANCE plane under pol_historical_consistency over the round; the Hypothesizer not run where the executor is not Pi, said; no recurrence, no Unsticking Agent; no Decision, no state moved, no unit redefined', async () => {
		const r = await verificationRejected();
		const roundId = r.verdicts[0]!.assessmentId;
		seam.review = chapterAnswering;
		const prompts = seam.prompts.length;
		const decisions = listByType(getEngine(), 'DECISION').length;
		const definitions = JSON.stringify([getObject(getEngine(), r.ids.verification), getObject(getEngine(), String(getObject(getEngine(), r.ids.verification)?.pwuTypeId ?? ''))]);

		const pressed = await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });

		expect([pressed.advanced, pressed.error], 'the stage did not run').toEqual(['assurance-stage', undefined]);
		expect(pressed.stage?.map((p) => [p.part, p.status]), 'the parts are not the chapter, then the Hypothesizer, then the Unsticking Agent').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'not-run'],
			['step-back', 'not-run']
		]);
		expect(pressed.stage?.[1]?.why ?? '', 'the Hypothesizer’s not running is not said').toContain("the hypothesizer runs on Pi's harness alone");
		expect(pressed.stage?.[2]?.why, 'the Unsticking Agent’s not running is not said').toBe('the round has no open KNOWN_FAILURE_RECURRENCE observation (design D75)');

		const written = seam.prompts.slice(prompts).filter((p) => p.includes(WRITER_PROMPT));
		expect(written.length, 'the writer was not called once').toBe(1);
		expect(recordIdsOf(written[0]!), 'the writer was not given the round’s verdicts and the units, each with its id').toEqual(
			expect.arrayContaining([roundId, r.verdicts[1]!.assessmentId, r.ids.verification, r.ids.source])
		);
		const writer = listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.invokerId === NARRATIVE_WRITER_INVOKER);
		expect(
			writer.map((x) => [x.state.plane, x.state.assurancePolicyId, x.state.subjectObjectId, x.state.subjectObjectType]),
			'the writer’s exchange is not its role’s on the ASSURANCE plane, over the round'
		).toEqual([['ASSURANCE', 'pol_historical_consistency', roundId, 'ASSURANCE_ASSESSMENT']]);
		const chapter = stageEvidenceOf('narrative-chapter');
		expect(
			chapter.map((e) => (e.state.contentReference as { stage: Record<string, unknown> }).stage),
			'the chapter is not recorded for the round'
		).toEqual([{ part: 'narrative-chapter', round: roundId, undertakingId: r.u.undertakingId, unitId: r.ids.verification, status: 'recorded' }]);
		const artifact = getObject(getEngine(), String((chapter[0]!.state.contentReference as { artifactId: string }).artifactId)) ?? {};
		expect(artifact.artifactType, 'the chapter is not an artifact of its own').toBe('narrative-chapter');
		expect(await getArtifactStore().get(String(artifact.storageKey)), 'the chapter’s bytes are not the writer’s answer').toBe(chapterAnswering(written[0]!));
		expect(listByType(getEngine(), 'DECISION').length, 'the stage recorded a Decision').toBe(decisions);
		expect(axesOf(r.ids.verification), 'the stage moved the unit').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
		expect(
			JSON.stringify([getObject(getEngine(), r.ids.verification), getObject(getEngine(), String(getObject(getEngine(), r.ids.verification)?.pwuTypeId ?? ''))]),
			'the stage changed the unit’s definition, its outputs or its criteria'
		).toBe(definitions);
	});

	it('⛔ RED FIRST — a chapter that fails its check is recorded as failing, its limb named, with no second call; and the stage goes on', async () => {
		const r = await verificationRejected();
		seam.review = (prompt) =>
			prompt.includes(WRITER_PROMPT) ? JSON.stringify({ chapter: 1, statements: [{ text: 'The harness is at fault.', cites: ['art_invented'] }] }) : undefined;
		const prompts = seam.prompts.length;

		const pressed = await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });

		expect(pressed.stage?.map((p) => [p.part, p.status]), 'the failing chapter is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'failing'],
			['fault-diagnosis', 'not-run'],
			['step-back', 'not-run']
		]);
		expect(pressed.stage?.[0]?.why, 'the failed limb is not named').toBe('statement 1 cites art_invented, which is not among the records it was given');
		expect(seam.prompts.slice(prompts).filter((p) => p.includes(WRITER_PROMPT)).length, 'a repair call was made').toBe(1);
	});

	it('⛔ RED FIRST — on Pi: the Hypothesizer, in a copy, is shown the candidates, the failed criteria and the chapter; its diagnosis recorded with its guidance, a claimed check it did not run named; with no recurrence the Unsticking Agent runs not', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the Hypothesizer’s diagnosis is not recorded').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'recorded'],
			['step-back', 'not-run']
		]);
		expect(pi.asked.length, 'the Unsticking Agent ran with no recurrence').toBe(1);
		expect(pi.asked[0]?.dir, 'the Hypothesizer did not run in the copy').toBe(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`);
		for (const part of [
			`- ${r.ids.source} "Source"`,
			'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.',
			'The narrative memory of the Undertaking so far, this round’s chapter included:'
		])
			expect(pi.asked[0]?.prompt, `the Hypothesizer was not shown: ${part}`).toContain(part);
		const diagnosis = stageEvidenceOf('fault-diagnosis');
		expect(diagnosis.map((e) => e.state.limitations), 'a claimed check the host did not capture is not named').toEqual([
			['its check ["node","bin/wf.js","-"] is not among the commands the host captured it running (design D74)']
		]);
		const artifact = getObject(getEngine(), String((diagnosis[0]!.state.contentReference as { artifactId: string }).artifactId)) ?? {};
		expect(JSON.parse((await getArtifactStore().get(String(artifact.storageKey))) ?? '{}').guidance, 'the guidance is not recorded').toBe(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		const helper = listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.invokerId === HELPER_INVOKER.hypothesizer);
		expect(helper.map((x) => [x.state.plane, x.state.subjectObjectId]), 'the Hypothesizer’s exchange is not its role’s, over the round').toEqual([
			['EXECUTION', r.verdicts[0]!.assessmentId]
		]);
	});

	it('⛔ RED FIRST — a named unit outside the candidates refuses the diagnosis, recorded as refused', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.docs), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts[1]?.status, 'a diagnosis naming a unit outside the candidates was not refused').toBe('refused');
		expect(stageEvidenceOf('fault-diagnosis')[0]?.state.limitations, 'the refusal is not named').toEqual(
			expect.arrayContaining([`its diagnosis is refused: it names ${r.ids.docs}, which is not among the candidates (design D74)`])
		);
	});

	it('⛔ RED FIRST — with an open KNOWN_FAILURE_RECURRENCE recorded on the round, the Unsticking Agent runs after the Hypothesizer, shown the recurrence, and its step-back is recorded', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const observationId = mintUiId('obs');
		const recorded = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', observationId, {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recorded.status, `arrangement: the recurrence — ${recorded.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the step-back is not recorded after the diagnosis').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'recorded'],
			['step-back', 'recorded']
		]);
		expect(
			pi.asked.map((a) => ['You are the Hypothesizer', 'You are the Unsticking Agent'].find((opening) => a.prompt.startsWith(opening))),
			'the helpers did not run in their order'
		).toEqual(['You are the Hypothesizer', 'You are the Unsticking Agent']);
		expect(pi.asked[1]?.prompt, 'the Unsticking Agent was not shown the recurrence').toContain(
			`- [${observationId}] The standard-input mode fails again, as it did in the round before.`
		);
		expect(pi.asked[1]?.dir, 'the Unsticking Agent did not run in its own copy').toBe(`${pi.dir}.unsticking-${r.verdicts[0]!.assessmentId}`);
		expect(stageEvidenceOf('step-back').length, 'the step-back is not recorded').toBe(1);
	});

	it('⛔ RED FIRST — on Pi, the stage’s records reach the faulty unit’s successor: the diagnosis, the unit it names and beside it its guidance, as advice, and the step-back with its facts; and the Hypothesizer was shown the round’s chapter', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const roundId = r.verdicts[0]!.assessmentId;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: roundId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the stage recorded its three parts').toEqual(['recorded', 'recorded', 'recorded']);
		expect(pi.asked[0]?.prompt, 'the Hypothesizer was not shown the round’s chapter').toContain(`- The record ${roundId} stands as it was given. [${roundId}]`);
		const [diagnosisId, stepBackId] = ['fault-diagnosis', 'step-back'].map((part) =>
			String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId)
		);
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const turn = seam.turns[turns] ?? '';
		for (const part of [
			`The diagnosis (${diagnosisId}) — advice, not a verdict:`,
			`- Source’s reader treats a pipe as a file. (points to ${r.ids.source})`,
			`It names ${r.ids.source} as the unit whose work most likely holds the fault.`,
			'Its guidance on how you might proceed — advice only, which changes nothing of this unit’s definition, its outputs or its criteria:\nBuild the reader in parts and check each against a pipe before the whole.',
			`The step-back (${stepBackId}) — questions and facts to help you reconsider, never what to do:`,
			'- Fact: The reader calls fstat before it reads. (source: src/reader.ts)'
		])
			expect(turn, `the faulty successor’s turn does not carry: ${part}`).toContain(part);
	});

	it('⛔ RED FIRST — a helper that changes the shared workspace has its diagnosis refused, the paths named', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The helper's turn writes outside its copy, into the shared workspace itself, as a command run there could.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				const session = await open(context);
				return {
					...session,
					turn: async (prompt: string) => {
						writeFileSync(join(pi.dir, 'leaked.txt'), 'outside the copy');
						return session.turn(prompt);
					}
				};
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts[1]?.status, 'a diagnosis made while the shared workspace changed was not refused').toBe('refused');
		expect(stageEvidenceOf('fault-diagnosis')[0]?.state.limitations, 'the changed paths are not named').toEqual(
			expect.arrayContaining(['the shared workspace changed while it ran (leaked.txt), so its diagnosis is refused (design D74)'])
		);
	});

	it('⛔ RED FIRST — two presses of one round at once run one stage: the second is refused while the first runs, named (the review’s defect 5)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;

		const [a, b] = await Promise.all([
			press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification }),
			press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })
		]);

		expect([a.advanced, b.advanced].filter((x) => x === 'assurance-stage').length, 'two presses of one round both ran').toBe(1);
		expect([a.error ?? '', b.error ?? ''].join(' '), 'the second press is not refused as running').toContain(
			`the assurance stage of this round (${r.verdicts[0]!.assessmentId}) is running now`
		);
		expect(stageEvidenceOf('narrative-chapter').length, 'one round was given two chapters').toBe(1);
	});

	it('⭑ CONTROL — a press that ends, however it ends, lets its round go: a press after one that threw runs the stage (the review’s defect 5)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const first = await runAssuranceStage(r.ids.verification, {
			...pi.deps,
			runSteps: () => {
				throw new Error('the batch could not be run');
			}
		}).then(
			() => 'it ended',
			(e: unknown) => (e instanceof Error ? e.message : String(e))
		);
		const second = await runAssuranceStage(r.ids.verification, pi.deps);

		expect(first, 'arrangement: the first press threw').toBe('the batch could not be run');
		expect('parts' in second ? second.parts.map((p) => p.part) : second.refusedBecause, 'the round was held after a press that threw').toEqual([
			'narrative-chapter',
			'fault-diagnosis',
			'step-back'
		]);
	});

	it('⛔ RED FIRST — a helper that cannot be opened is recorded as that part’s failure, and the stage goes on to the Unsticking Agent (the review’s defect 4)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		let opened = 0;
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The first helper's session cannot be opened, as a model Pi cannot resolve fails `openPiExecutionSession`; the second opens.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				opened += 1;
				if (opened === 1) throw new Error('the model faux/model is not one Pi can resolve');
				return open(context);
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the failed helper is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'failing'],
			['step-back', 'recorded']
		]);
		expect('parts' in done ? (done.parts[1]?.why ?? '') : '', 'why it failed is not said').toContain('the model faux/model is not one Pi can resolve');
		expect(existsSync(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`), 'the failed helper’s copy was left').toBe(false);
	});

	it('⛔ RED FIRST — a helper whose session cannot be closed is recorded as that part’s failure, and the stage goes on (the review’s defect 4)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		let opened = 0;
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The first helper's session throws as it is closed, after its turn; the second closes.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				opened += 1;
				const session = await open(context);
				return opened === 1
					? {
							...session,
							dispose: () => {
								throw new Error('the session could not be closed');
							}
						}
					: session;
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'a helper whose session could not be closed is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'failing'],
			['step-back', 'recorded']
		]);
		expect('parts' in done ? (done.parts[1]?.why ?? '') : '', 'why it failed is not said').toContain('the hypothesizer failed: the session could not be closed');
	});

	it('⛔ RED FIRST — a value that cannot be described, thrown by the narrative writer, by the shared workspace’s resolution or by a helper’s session’s close, is that part’s, described by the one describer: recorded failing, or not run, a helper’s copy removed, and the stage goes on (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		const UNDESCRIBED = 'a thrown value that cannot be described';
		const seen: { parts: string; why: string; copyLeft: boolean }[] = [];
		for (const throws of ['writer', 'shared', 'close'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
				assessmentId: r.verdicts[0]!.assessmentId,
				observationType: 'FINDING',
				findingCode: 'KNOWN_FAILURE_RECURRENCE',
				severity: 'INFORMATIONAL',
				statement: 'The standard-input mode fails again, as it did in the round before.'
			});
			expect(recurrence.status, `arrangement: the recurrence (${throws}) — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
			const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
			let opened = 0;
			const open = pi.deps.openPi;
			// ⭑ `Object.create(null)`, which `String` cannot convert: thrown by the writer's transport, by the sandbox's resolution, or as the first helper's
			// session is closed after its turn (the second closes).
			const deps = {
				...pi.deps,
				...(throws === 'writer'
					? {
							writerPrint: async (): Promise<string> => {
								throw Object.create(null);
							}
						}
					: {}),
				...(throws === 'shared'
					? {
							sandboxOf: (): never => {
								throw Object.create(null);
							}
						}
					: {}),
				openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
					opened += 1;
					const session = await open(context);
					return throws === 'close' && opened === 1
						? {
								...session,
								dispose: () => {
									throw Object.create(null);
								}
							}
						: session;
				}
			};

			const done = await runAssuranceStage(r.ids.verification, deps).then(
				(d) => d,
				(e: unknown) => ({ threw: saidOf(e) })
			);

			seen.push({
				parts: 'parts' in done ? done.parts.map((p) => `${p.part} ${p.status}`).join(', ') : 'threw' in done ? `threw: ${done.threw}` : done.refusedBecause,
				why: 'parts' in done ? done.parts.map((p) => p.why ?? '').join(' | ') : '',
				copyLeft: existsSync(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`)
			});
		}

		expect(seen.map((s) => s.parts), 'a value that cannot be described threw the press, or its part was not recorded as its own, the stage going on').toEqual([
			'narrative-chapter failing, fault-diagnosis recorded, step-back recorded',
			'narrative-chapter recorded, fault-diagnosis not-run, step-back not-run',
			'narrative-chapter recorded, fault-diagnosis failing, step-back recorded'
		]);
		expect(
			[
				seen[0]!.why.includes(`the writer's call failed: ${UNDESCRIBED}`),
				seen[1]!.why.includes(`the Undertaking's shared workspace could not be resolved: ${UNDESCRIBED}`),
				seen[2]!.why.includes(`the hypothesizer failed: ${UNDESCRIBED}`)
			],
			'why a part failed, or did not run, is not said through the one describer'
		).toEqual([true, true, true]);
		expect(seen.map((s) => s.copyLeft), 'a helper’s copy was left').toEqual([false, false, false]);
	});

	it('⛔ RED FIRST — the records a later chapter is given hold an earlier round’s diagnosis and step-back, each by its id with its content and the host’s findings on it (the review’s defect 6)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the stage recorded its three parts').toEqual(['recorded', 'recorded', 'recorded']);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);
		const chapterAt = getEngine()
			.readAllEvents()
			.findIndex((e) => e.aggregateId === idOf('narrative-chapter'));

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, chapterAt);

		const textOf = (id: string) => records.find((x) => x.id === id)?.text ?? '';
		expect(textOf(idOf('fault-diagnosis')), 'the diagnosis is given by its label alone').toContain(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		expect(textOf(idOf('fault-diagnosis')), 'the host’s finding on the diagnosis is not given').toContain(
			'is not among the commands the host captured it running'
		);
		expect(textOf(idOf('step-back')), 'the step-back is given by its label alone').toContain('The reader calls fstat before it reads.');
	});

	it('⛔ RED FIRST — a stage record past the bound is given cut, and said to be cut (the review’s defect 6)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const long = 'The reader treats a pipe as a file, on every path it reads. '.repeat(60);
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source).replace('Source’s reader treats a pipe as a file.', long), stepBack: STEP_BACK });
		await runAssuranceStage(r.ids.verification, pi.deps);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);
		const chapterAt = getEngine()
			.readAllEvents()
			.findIndex((e) => e.aggregateId === idOf('narrative-chapter'));

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, chapterAt);

		const text = records.find((x) => x.id === idOf('fault-diagnosis'))?.text ?? '';
		expect([text.includes('… (cut at 2000 characters)'), text.length < long.length], 'a record past the bound is given whole, or cut without saying so').toEqual([true, true]);
	});

	it('⛔ RED FIRST — a record accepted inside a Markdown fence is read back whole by a later chapter: its diagnosis, its step-back and its tactic record (the review’s re-check, B)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const fenced = (json: string) => ['```json', json, '```'].join('\n');
		const pi = onPi({ diagnosis: fenced(DIAGNOSIS.replaceAll('SOURCE', r.ids.source)), stepBack: fenced(STEP_BACK) });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the fenced answers were accepted').toEqual(['recorded', 'recorded', 'recorded']);
		// ⭑ And a tactic record a model wrote fenced, taken as the page takes one.
		const workspace: Workspace = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: pi.dir });
		const path = tacticRecordPath('Verification', r.ids.verification);
		await workspace.writeFile(path, fenced(RECORD));
		const took = await takeTacticRecord(
			{ store: getArtifactStore(), tenantPrefix: 'tnt-local', newId: mintUiId, now: () => '2026-11-16T12:00:00.000Z', runSteps: runStepsHere },
			{
				workspace,
				path,
				unitId: r.ids.verification,
				undertakingId: r.u.undertakingId,
				roundId: r.verdicts[0]!.assessmentId,
				attemptKey: 'step_fenced#1',
				producerModelId: 'faux/model',
				atStart: undefined,
				stepEnded: false
			}
		);
		expect([took?.part, took?.recorded], 'arrangement: the fenced tactic record was taken').toEqual(['tactic-record', true]);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, -1);

		const textOf = (id: string) => records.find((x) => x.id === id)?.text ?? '';
		expect(textOf(idOf('fault-diagnosis')), 'the fenced diagnosis is called unreadable').toContain(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		expect(textOf(idOf('step-back')), 'the fenced step-back is called unreadable').toContain('The reader calls fstat before it reads.');
		expect(textOf(idOf('tactic-record')), 'the fenced tactic record is called unreadable').toContain('read standard input as a stream, in chunks');
		expect(
			[idOf('fault-diagnosis'), idOf('step-back'), idOf('tactic-record')].filter((id) => textOf(id).includes('could not be read back whole')),
			'a record whose bytes are whole is said not to be'
		).toEqual([]);
	});

	it('⭑ CONTROL — a sign-off that accepts its unit offers no stage; and a declared review’s prompt does not carry the narrative', async () => {
		const r = await verificationRejected();
		expect(Object.keys(stageOffers(r.u) ?? {}), 'a unit its reviews accepted is offered the stage').toEqual([r.ids.verification]);
		seam.review = chapterAnswering;
		await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });
		const declared = seam.declared.length;

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect((await press(r.u, 'recordAssurance', { pwuId: r.ids.verification })).error, 'arrangement: the re-run’s sign-off').toBeUndefined();

		const shown = seam.declared.slice(declared);
		expect(shown.length, 'arrangement: the declared reviews ran').toBeGreaterThan(0);
		for (const d of shown) {
			expect(d.prompt, `${d.policyId}’s prompt carries the narrative`).not.toContain('narrative memory');
			expect(d.content, `${d.policyId}’s content carries the narrative`).not.toContain(FEEDBACK_HEADING);
		}
	});
});

describe('⭐⭐ L17b1 (D77) — D71’s re-run in place after the stage: the same feedback, after its findings, and the tactic record', () => {
	it('⛔ RED FIRST — its first turn: the instruction, the findings, then the narrative, then the request for its tactic record; the record taken before the view and overwritten; no view and no review holds it', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		seam.onTurn = writesItsTacticRecord(r.u);
		const turns = seam.turns.length;
		const eventsBefore = getEngine().readAllEvents().length;

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(rerun.error, 'the re-run did not run').toBeUndefined();
		const turn = seam.turns[turns] ?? '';
		const path = tacticRecordPath('Verification', r.ids.verification);
		const at = [CARRIED_FINDINGS_LINE, 'This is a fresh session', FEEDBACK_HEADING, 'The loop so far', tacticRecordRequest(path)].map((part) => turn.indexOf(part));
		expect(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]!), `the turn’s parts are not in their order: ${JSON.stringify(at)}`).toBe(true);
		expect(turn.endsWith(`\n\n${tacticRecordRequest(path)}`), 'the turn does not end with the request').toBe(true);

		const tactic = listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record');
		expect(tactic.length, 'the tactic record is not recorded').toBe(1);
		expect(await getArtifactStore().get(String(tactic[0]!.state.storageKey)), 'the record’s bytes are not the model’s').toBe(RECORD);
		expect(await workspaceOf(r.u).readFile(path), 'the record was left in the shared workspace').toBe(tacticRecordNotice(tactic[0]!.id));
		// ⭑ Taken before the try's view, and so before the try's review: its record precedes the first ASSURANCE exchange the re-run recorded.
		const since = getEngine().readAllEvents().slice(eventsBefore);
		const takenAt = since.findIndex((e) => e.eventType === 'ArtifactRecorded' && e.aggregateId === tactic[0]!.id);
		const reviewedAt = since.findIndex(
			(e) => e.eventType === 'ModelExchangeRecorded' && getObject(getEngine(), e.aggregateId)?.plane === 'ASSURANCE'
		);
		expect([takenAt >= 0, reviewedAt >= 0, takenAt < reviewedAt], 'the record was not taken before the try’s review').toEqual([true, true, true]);
		// ⭑ The view the re-run's completion admits, read from its pointer as a sign-off reads it — the notice is a file the unit's baseline did not
		// hold, so without the folder left out the view would list it.
		const plans = new Set(listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === r.ids.verification).map((p) => p.id));
		const completed = getEngine()
			.readAllEvents()
			.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
			.at(-1);
		const pointer = admittedViewRef((completed?.payload as { structuredResult?: unknown } | undefined)?.structuredResult, []);
		const view = pointer.ok && pointer.ref !== undefined ? await readDeliverableView(getArtifactStore(), pointer.ref) : undefined;
		expect(view?.ok, 'arrangement: the re-run’s completion points at no view it can read').toBe(true);
		expect(
			view?.ok ? view.view.deliverable.files.map((f) => f.path).filter((f) => f.startsWith('.jpwb/tactic')) : undefined,
			'the re-run’s view lists the tactic record’s folder'
		).toEqual([]);
		const declared = seam.declared.length;
		expect((await press(r.u, 'recordAssurance', { pwuId: r.ids.verification })).error, 'arrangement: the re-run’s sign-off').toBeUndefined();
		for (const d of seam.declared.slice(declared)) expect(d.content, `${d.policyId}’s review was shown the tactic record`).not.toContain('priorTactic');
	});

	it('⛔ RED FIRST — a notice that cannot be written is said on the page, and recorded as a finding beside the record (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		// ⭑ The model writes its record; then the file turns read-only, so the host's notice over it is refused, as the port refuses a write.
		seam.onTurn = async (text) => {
			await writesItsTacticRecord(r.u)(text);
			seam.refuseWrite = { when: (path) => path.startsWith('.jpwb/tactic/'), because: 'the file is read-only' };
		};

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(rerun.tacticRecordNote ?? '', 'a notice not written is not said on the page').toContain(
			'the notice could not be written: the file is read-only'
		);
		const artifacts = listByType(getEngine(), 'ARTIFACT').map((a) => a.state.artifactType);
		expect(
			[artifacts.filter((t) => t === 'tactic-record').length, artifacts.filter((t) => t === 'tactic-record-finding').length],
			'the record, and the finding that its notice was not written, are not both recorded'
		).toEqual([1, 1]);
	});

	it('⛔ RED FIRST — a take whose record the store refused is no take: the page takes it again at the step’s end, and says what was refused (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		seam.onTurn = writesItsTacticRecord(r.u);
		// ⭑ The try's take is refused as a store refuses a batch; the take at the step's end runs as the product's.
		seam.takeAnswer = (stepEnded) =>
			stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: 'its record was refused: REJECTED: the store refused the batch' };

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(seam.takes, 'the refused take ended the takes: none at the step’s end').toEqual([false, true]);
		expect(listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length, 'the record was not taken at the step’s end').toBe(1);
		expect(rerun.tacticRecordNote ?? '', 'the refused take is not said on the page').toContain('its record was refused: REJECTED: the store refused the batch');
	});

	it('⛔ RED FIRST — a record never written by the step’s end is said on the page beside the step’s outcome, never discarded (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();

		const begun = await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id });

		expect(begun.error, 'arrangement: the new Source ran').toBeUndefined();
		expect(begun.tacticRecordNote ?? '', 'a record never written is not said on the page').toContain('no tactic record was written at');
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not render the tactic record’s note').toContain(
			'data-testid="tactic-record-note">The tactic record: {form.tacticRecordNote}</p>'
		);
	});

	it('⛔ RED FIRST — a step refused at its end says its tactic record’s note beside the refusal (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		// ⭑ The floor refuses every try’s work product with a finding, so the step ends refused (package N’s arrangement).
		seam.review = (prompt) => {
			if (!prompt.includes('The WORK PRODUCT to review')) return undefined;
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return JSON.stringify({
				findings: ids.map((id, i) =>
					i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
				),
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		};

		const begun = await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id });

		expect(begun.error ?? '', 'arrangement: the step was not refused at its end').not.toBe('');
		expect(begun.tacticRecordNote ?? '', 'a record never written is not said beside the refusal').toContain('no tactic record was written at');
	});

	it('⛔ RED FIRST — a step refused in the middle of a try still ends: its last take runs and the notes it gathered are said beside the refusal — its invocation refused at its first try or a later one, its work product’s record refused, a command’s evidence refused (the review’s re-check, D)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const seen: { error: string; note: string; takes: readonly boolean[]; records: number }[] = [];
		for (const refuse of ['first-invocation', 'invocation', 'work-product', 'evidence'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${refuse})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			// ⭑ The model writes its record on its first turn; a case refusing the invocation fails a turn instead, as an unreachable provider does — the
			// first, before any try answered, or the second.
			let turns = 0;
			seam.onTurn = async (text) => {
				turns += 1;
				if (refuse === 'first-invocation' || (refuse === 'invocation' && turns === 2)) throw new Error('the provider is unreachable');
				if (turns === 1) await writesItsTacticRecord(r.u)(text);
			};
			// ⭑ A try's take is refused, as a store refuses a batch: the note gathered before the refusal. The step's last take is the product's.
			seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			// ⭑ Refusing the invocation needs a second try: the floor refuses the first try's work product with a finding (package N's arrangement).
			let rejected = false;
			seam.review = (prompt) => {
				if (prompt.includes(WRITER_PROMPT)) return chapterAnswering(prompt);
				if (refuse !== 'invocation' || rejected || !prompt.includes('The WORK PRODUCT to review')) return undefined;
				rejected = true;
				const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
				return JSON.stringify({
					findings: ids.map((id, i) =>
						i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
					),
					recommendation: 'REJECTED',
					residualUncertainty: []
				});
			};
			if (refuse === 'work-product')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;
			if (refuse === 'evidence') seam.refuseJoin = 'the evidence batch was refused';

			const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

			seam.refuseBatch = undefined;
			seam.refuseJoin = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ error: rerun.error ?? '', note: rerun.tacticRecordNote ?? '', takes: seam.takes.slice(takes), records: tacticRecords() - records });
		}

		// ⭑ Refused at its first try, the model wrote nothing: the last take records that none was written, a finding, and no tactic record.
		expect(seen.map((s) => [s.takes.at(-1), s.records]), 'a step refused in the middle of a try ran no last take').toEqual([
			[true, 0],
			[true, 1],
			[true, 1],
			[true, 1]
		]);
		expect(
			seen.map((s) => s.error.split(':')[0]),
			'arrangement: each step refused where its case refuses it'
		).toEqual([
			'The model invocation did not run',
			'The model invocation did not run',
			'Recording the work product failed',
			'The model ran 0 command(s) and one could not be recorded as evidence'
		]);
		expect(
			[seen[0]!.note.includes('no tactic record was written at'), seen[1]!.note.includes(REFUSED_TAKE), seen[3]!.note.includes(REFUSED_TAKE)],
			'the notes a step gathered before its refusal, or its last take’s finding, are not said beside it'
		).toEqual([true, true, true]);
	});

	it('⛔ RED FIRST — a step that fails before its try’s review, or whose try an exception escapes, still ends: its last take runs, its notes beside the failure, and an exception goes on as it was, the end’s own failure named on it (the review’s second re-check, D)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		// ⭐ The lead's ruling (a) on the review's third re-check — a take that throws at the step's end, said among the end's notes.
		const TAKE_FAILED = "its take at the step's end failed: the record could not be taken";
		const seen: { error: string; note: string; thrown: string; takes: readonly boolean[]; records: number; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const ending of ['manifest', 'view', 'escaping', 'escaping-and-its-end', 'manifest-and-its-end'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			// ⭑ The model writes its record; a case reading the workspace after the try makes the listing throw once the turn is done.
			seam.onTurn = async (text) => {
				await writesItsTacticRecord(r.u)(text);
				if (ending.startsWith('manifest')) seam.listThrows = 'a file was removed between the walk and its stat';
			};
			// ⭑ The try's take is refused, as a store refuses a batch: a note gathered first. A case whose end fails makes the last take throw.
			seam.takeAnswer = (stepEnded) => {
				if (!stepEnded) return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
				if (ending.endsWith('and-its-end')) throw new Error('the record could not be taken');
				return undefined;
			};
			if (ending === 'view') seam.viewThrows = 'the store refused the view';
			if (ending.startsWith('escaping')) seam.processRunsThrows = 'the process runs could not be read';

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ error: p.error ?? '', note: p.tacticRecordNote ?? '', thrown: '' }),
				(e: unknown) => ({ error: '', note: '', thrown: e instanceof Error ? e.message : String(e) })
			);

			seam.listThrows = undefined;
			seam.viewThrows = undefined;
			seam.processRunsThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, step: latestStepOf(r.ids.verification) });
		}

		expect(seen.map((s) => s.takes), 'a step that ended this way ran no last take, or ran it twice').toEqual([
			[false, true],
			[false, true],
			[false, true],
			[false, true],
			[false, true]
		]);
		expect(seen.map((s) => s.records), 'the last take recorded no tactic record where it ran whole').toEqual([1, 1, 1, 0, 0]);
		expect(
			[seen[0]!.note.includes(REFUSED_TAKE), seen[1]!.note.includes(REFUSED_TAKE)],
			'the notes a step gathered are not said beside its failure before review'
		).toEqual([true, true]);
		expect(
			[seen[0]!.error.split(':')[0], seen[0]!.error.includes("the host could not read the unit's workspace after try 1"), seen[1]!.error.includes('the host could not record the files the unit changed after try 1')],
			'arrangement: each failed before its review where its case fails it'
		).toEqual(['The model invocation did not run to its review', true, true]);
		expect(
			[seen[2]!.thrown, seen[3]!.thrown, seen[4]!.thrown],
			'the exception that escaped is not the one thrown, or the end’s own failure is not named on it, or the end ran twice'
		).toEqual([
			// ⭐ RESTATED 2026-11-17 (the lead's rulings (a) and (c) on the review's third re-check): the step's end cannot throw — a take that throws is the
			// take's failure, said among the end's notes — and an exception that escapes a try goes on as the same value, the end's notes named on it. The
			// superseded expectation, struck: ~~'the process runs could not be read',~~ ~~"the process runs could not be read — and the step's end, run
			// before it went on, failed too: the record could not be taken",~~ ~~'the record could not be taken'~~ — the fifth case's, a handled failure
			// whose end's take threw, the take's throw going on in the failure's place.
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE}`,
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE} ${TAKE_FAILED}`,
			''
		]);
		// ⭐ RESTATED 2026-11-17 (the lead's ruling (a)): the fifth case — a handled failure whose end's take throws — is recorded with its own reason, its
		// step FAILED, and the take's failure among the notes beside it.
		expect(
			[seen[4]!.error, seen[4]!.step, seen[4]!.note.includes(TAKE_FAILED)],
			'a handled failure whose end’s take threw lost its own reason, left its step RUNNING, or did not say the take’s failure among its notes'
		).toEqual([
			"The model invocation did not run to its review: the host could not read the unit's workspace after try 1: a file was removed between the walk and its stat",
			{ stepState: 'FAILED', failed: ["the host could not read the unit's workspace after try 1: a file was removed between the walk and its stat"] },
			true
		]);
	});

	it('⛔ RED FIRST — the step’s end cannot throw: a take that throws at the step’s end is the take’s failure, said among the end’s notes, and the step goes on — a refusal in a try returns its refusal, and the ordinary way out reaches its completion (the lead’s ruling (a) on the review’s third re-check)', async () => {
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const TAKE_FAILED = "its take at the step's end failed: the record could not be taken";
		const seen: { outcome: string; note: string; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const ending of ['refused', 'ordinary'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			seam.onTurn = writesItsTacticRecord(r.u);
			// ⭑ The try's take is refused, as a store refuses a batch; the step's end takes it again, and that take throws, as a store that cannot be
			// written throws (package N's check: "the content store is read-only").
			seam.takeAnswer = (stepEnded) => {
				if (stepEnded) throw new Error('the record could not be taken');
				return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
			};
			if (ending === 'refused')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? (p.error ?? '').split(':')[0]!, note: p.tacticRecordNote ?? '' }),
				(e: unknown) => ({ outcome: `thrown: ${e instanceof Error ? e.message : String(e)}`, note: '' })
			);

			seam.refuseBatch = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, step: latestStepOf(r.ids.verification) });
		}

		expect(seen.map((s) => s.outcome), 'the step’s end threw: its take’s failure went on in the step’s outcome’s place').toEqual([
			'Recording the work product failed',
			'rejected-work-rerun'
		]);
		expect(seen.map((s) => s.note.includes(TAKE_FAILED)), 'the take’s failure is not said among the step’s end’s notes').toEqual([true, true]);
		expect(seen[1]!.step, 'the ordinary way out did not reach its completion').toEqual({ stepState: 'SUCCEEDED', failed: [] });
	});

	it('⛔ RED FIRST — the producer’s close is part of the step’s end: closed once, best-effort, whichever call closes it, its failure said among the end’s notes on every way the step ends — never in the step’s outcome’s place, never skipping the last take (the lead’s ruling (b) on the review’s third re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const CLOSE = "The executor's session could not be closed: Failed to cleanup session resources";
		const seen: { outcome: string; close: string; takes: readonly boolean[]; records: number; disposes: number }[] = [];
		for (const ending of ['ordinary', 'refused', 'failed', 'escaping', 'closed'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			const disposes = seam.disposes;
			// ⭑ The model writes its record; the try's take is refused, so the step's end must take it again. A case failing before the try's review makes
			// the listing throw once the turn is done.
			seam.onTurn = async (text) => {
				await writesItsTacticRecord(r.u)(text);
				if (ending === 'failed') seam.listThrows = 'a file was removed between the walk and its stat';
			};
			seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			// ⭑ Pi's close fails as its cleanup does (`pi-ai`, `session-resources.js`): an `AggregateError`. The control's close succeeds.
			if (ending !== 'closed')
				seam.disposeThrows = { error: new AggregateError([new Error('the bash process would not stop')], 'Failed to cleanup session resources') };
			if (ending === 'refused')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;
			const escaped = new Error('the process runs could not be read');
			if (ending === 'escaping') seam.processRunsThrows = { value: escaped };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? (p.error ?? '').split(':')[0]!, close: p.sessionCloseNote ?? '' }),
				(e: unknown) => ({ outcome: e === escaped ? 'the exception that escaped' : `another: ${String(e)}`, close: e instanceof Error ? e.message : '' })
			);

			seam.disposeThrows = undefined;
			seam.refuseBatch = undefined;
			seam.processRunsThrows = undefined;
			seam.listThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, disposes: seam.disposes - disposes });
		}

		expect(seen.map((s) => s.outcome), 'the close’s failure took the step’s outcome’s place').toEqual([
			'rejected-work-rerun',
			'Recording the work product failed',
			'The model invocation did not run to its review',
			'the exception that escaped',
			'rejected-work-rerun'
		]);
		expect(seen.map((s) => [s.takes.at(-1), s.records]), 'the close’s failure skipped the step’s last take').toEqual([
			[true, 1],
			[true, 1],
			[true, 1],
			[true, 1],
			[true, 1]
		]);
		expect(seen.map((s) => s.disposes), 'the producer’s session was not closed once').toEqual([1, 1, 1, 1, 1]);
		expect(
			seen.map((s) => s.close.includes(CLOSE)),
			'the close’s failure is not said among the step’s end’s notes, or a close that succeeded is said to have failed'
		).toEqual([true, true, true, true, false]);
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not render the close’s note').toContain('data-testid="session-close-note">{form.sessionCloseNote}</p>');
	});

	it('⛔ RED FIRST — an exception that escapes a try goes on as the very value thrown: an Error whose message can be written carries the step’s end’s notes after its own message; any other value, and an Error whose message cannot be written, go on unchanged; a handled failure that then throws is given the end that already ran (the lead’s ruling (c) on the review’s third re-check)', async () => {
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const NOTES = ` — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE}`;
		const writable = new Error('the process runs could not be read');
		const notAnError = { code: 'E_RUNS', reason: 'the process runs could not be read' };
		const frozen = Object.freeze(new Error('the process runs could not be read, the error frozen'));
		const domException = new DOMException('the process runs could not be read, a DOMException', 'InvalidStateError');
		const noNotes = new Error('the process runs could not be read, the step’s end with nothing to say');
		const afterItsEnd = new Error('the failure could not be recorded: the store is read-only');
		const cases = [
			['writable', writable],
			['notAnError', notAnError],
			['frozen', frozen],
			['domException', domException],
			['noNotes', noNotes],
			['afterItsEnd', afterItsEnd]
		] as const;
		const caught: unknown[] = [];
		const takes: (readonly boolean[])[] = [];
		for (const [kind, value] of cases) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			// ⭑ The stage runs, so the re-run takes a tactic record, its try's take refused: a note for the end to name. The control whose end has nothing to
			// say runs none, so its re-run is asked for no tactic record.
			if (kind !== 'noNotes') {
				expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${kind})`).toBeUndefined();
				seam.onTurn = async (text) => {
					await writesItsTacticRecord(r.u)(text);
					if (kind === 'afterItsEnd') seam.listThrows = 'a file was removed between the walk and its stat';
				};
				seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			}
			// ⭑ An exception escapes the try where its process runs are read; or, the try's workspace unread, the failure's own record throws after the end ran.
			if (kind === 'afterItsEnd') seam.throwBatch = { when: (commands) => commands.some((c) => c.commandType === 'FailExecutionStep'), error: value };
			else seam.processRunsThrows = { value };
			const before = seam.takes.length;

			caught.push(
				await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
					() => 'returned',
					(e: unknown) => e
				)
			);

			seam.processRunsThrows = undefined;
			seam.throwBatch = undefined;
			seam.listThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			takes.push(seam.takes.slice(before));
		}

		for (const [i, [kind, value]] of cases.entries()) expect(caught[i], `the ${kind} value that escaped is not the one thrown`).toBe(value);
		expect(
			[writable.message, noNotes.message, afterItsEnd.message],
			'the step’s end’s notes are not named after the first message, or a step whose end said nothing had its message changed'
		).toEqual([
			`the process runs could not be read${NOTES}`,
			'the process runs could not be read, the step’s end with nothing to say',
			`the failure could not be recorded: the store is read-only${NOTES}`
		]);
		expect(
			[notAnError, frozen.message, domException.message],
			'a value that is not an Error, or an Error whose message cannot be written, was changed'
		).toStrictEqual([
			{ code: 'E_RUNS', reason: 'the process runs could not be read' },
			'the process runs could not be read, the error frozen',
			'the process runs could not be read, a DOMException'
		]);
		expect([takes[0], takes[5]], 'the step’s end did not run once, or ran again where it had run').toEqual([
			[false, true],
			[false, true]
		]);
	});

	it('⛔ RED FIRST — the try’s own take cannot throw: a take that throws in a try is the take’s failure, said among the notes, and the try goes on to its view — a content store that fails at the take and at the view is met where package N meets it, the step FAILED with the view’s own reason; the take, not on the record, is taken again at the step’s end (the lead’s ruling (g) on the review’s fourth re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const STORE = 'the content store is read-only';
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		const takes = seam.takes.length;
		const records = tacticRecords();
		seam.onTurn = writesItsTacticRecord(r.u);
		// ⭑ The content store fails at the try's take — its record's write throws, as package N's check makes the store throw — and then at the try's view;
		// the step's end's take is the product's own.
		seam.takeAnswer = (stepEnded) => {
			if (!stepEnded) throw new Error(STORE);
			return undefined;
		};
		seam.viewThrows = STORE;

		const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
			(p) => ({ thrown: '', error: p.error ?? '', note: p.tacticRecordNote ?? '' }),
			(e: unknown) => ({ thrown: e instanceof Error ? e.message : String(e), error: '', note: '' })
		);

		expect(
			[out.thrown, out.error, latestStepOf(r.ids.verification), out.note.includes(`its take after try 1 failed: ${STORE}`), seam.takes.slice(takes), tacticRecords() - records],
			'a take that threw in its try left the step RUNNING, lost the view’s own reason, did not say the take’s failure, or was not taken again at the step’s end'
		).toEqual([
			'',
			`The model invocation did not run to its review: the host could not record the files the unit changed after try 1: ${STORE}`,
			{ stepState: 'FAILED', failed: [`the host could not record the files the unit changed after try 1: ${STORE}`] },
			true,
			[false, true],
			1
		]);
	});

	it('⛔ RED FIRST — describing a thrown value cannot throw: a value that cannot be described, thrown by the producer’s close — the finally’s backstop on the ordinary way out, or the end’s own close — or by the end’s take or the try’s own, and a revoked Proxy thrown from inside a try: the same value goes on, the end runs once and its take happens, and the notes say what they can (the lead’s ruling (h) on the review’s fourth re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const UNDESCRIBED = 'a thrown value that cannot be described';
		/** What the test can say of a value that escaped, where the code under test could not: never a throw of its own. */
		const said = (e: unknown): string => {
			try {
				return e instanceof Error ? e.message : String(e);
			} catch {
				return '(a value the test cannot describe)';
			}
		};
		const seen: { outcome: string; notes: string; takes: readonly boolean[]; records: number; disposes: number }[] = [];
		for (const ending of ['close-backstop', 'close-in-the-end', 'take-in-the-end', 'take-in-the-try', 'revoked-proxy'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			const disposes = seam.disposes;
			seam.onTurn = writesItsTacticRecord(r.u);
			// ⭑ The try's take is refused, as a store refuses a batch, so the step's end takes the record — save where a case makes the try's take throw a value
			// that cannot be described; another makes the end's take throw one, and two the producer's close (`Object.create(null)`: `String` throws on it).
			seam.takeAnswer = (stepEnded) => {
				if (!stepEnded && ending === 'take-in-the-try') throw Object.create(null);
				if (!stepEnded) return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
				if (ending === 'take-in-the-end') throw Object.create(null);
				return undefined;
			};
			if (ending === 'close-backstop' || ending === 'close-in-the-end') seam.disposeThrows = { error: Object.create(null) };
			// ⭑ An exception escapes the try where its process runs are read: an Error, the end's close then throwing; or a revoked Proxy, which throws as it is
			// inspected.
			const escaped = new Error('the process runs could not be read');
			const revoked = Proxy.revocable(new Error('the process runs could not be read, through a proxy'), {});
			revoked.revoke();
			if (ending === 'close-in-the-end') seam.processRunsThrows = { value: escaped };
			if (ending === 'revoked-proxy') seam.processRunsThrows = { value: revoked.proxy };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? `refused: ${p.error ?? ''}`, notes: `${p.tacticRecordNote ?? ''} | ${p.sessionCloseNote ?? ''}` }),
				(e: unknown) => ({
					outcome: e === escaped || e === revoked.proxy ? 'the value thrown' : `another: ${said(e)}`,
					notes: e === escaped ? escaped.message : ''
				})
			);

			seam.disposeThrows = undefined;
			seam.processRunsThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, disposes: seam.disposes - disposes });
		}

		expect(seen.map((s) => s.outcome), 'a value that cannot be described took the step’s outcome’s place, or the value thrown did not go on').toEqual([
			'rejected-work-rerun',
			'the value thrown',
			'rejected-work-rerun',
			'rejected-work-rerun',
			'the value thrown'
		]);
		expect(
			seen.map((s) => [s.takes, s.records, s.disposes]),
			'the step’s end did not run once, its take did not happen, or the producer’s session was not closed once'
		).toEqual([
			[[false, true], 1, 1],
			[[false, true], 1, 1],
			[[false, true], 0, 1],
			[[false, true], 1, 1],
			[[false, true], 1, 1]
		]);
		expect(
			[seen[0]!.notes, seen[1]!.notes, seen[2]!.notes, seen[3]!.notes],
			'the notes do not say what they can of a value that cannot be described'
		).toEqual([
			`${REFUSED_TAKE} | The executor's session could not be closed: ${UNDESCRIBED}`,
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE} The executor's session could not be closed: ${UNDESCRIBED}`,
			`${REFUSED_TAKE} its take at the step's end failed: ${UNDESCRIBED} | `,
			`its take after try 1 failed: ${UNDESCRIBED} | `
		]);
	});

	it('⛔ RED FIRST — package N’s two failures before a try’s review describe whatever value is thrown, through the one describer: a workspace whose listing, or a view whose record, throws a value that cannot be described FAILS THE STEP with its reason, never an escape (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		const UNDESCRIBED = 'a thrown value that cannot be described';
		const seen: { thrown: string; error: string; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const failing of ['listing', 'view'] as const) {
			const r = await verificationRejected();
			// ⭑ Once the turn is done the listing throws `Object.create(null)`, or the try's view's record does, where package N's check makes each throw an Error.
			seam.onTurn = async () => {
				if (failing === 'listing') seam.listThrows = { value: Object.create(null) };
			};
			if (failing === 'view') seam.viewThrows = { value: Object.create(null) };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ thrown: '', error: p.error ?? '' }),
				(e: unknown) => ({ thrown: saidOf(e), error: '' })
			);

			seam.listThrows = undefined;
			seam.viewThrows = undefined;
			seam.onTurn = undefined;
			seen.push({ ...out, step: latestStepOf(r.ids.verification) });
		}

		expect(seen, 'a value that cannot be described escaped package N’s catch, left its step RUNNING, or was said wrongly').toEqual([
			{
				thrown: '',
				error: `The model invocation did not run to its review: the host could not read the unit's workspace after try 1: ${UNDESCRIBED}`,
				step: { stepState: 'FAILED', failed: [`the host could not read the unit's workspace after try 1: ${UNDESCRIBED}`] }
			},
			{
				thrown: '',
				error: `The model invocation did not run to its review: the host could not record the files the unit changed after try 1: ${UNDESCRIBED}`,
				step: { stepState: 'FAILED', failed: [`the host could not record the files the unit changed after try 1: ${UNDESCRIBED}`] }
			}
		]);
	});
});

describe('⭐⭐ L17b1 (D77, reading 16) — each successor’s first turn, and the faulty unit’s successor derived from the record', () => {
	it('⛔ RED FIRST — the faulty unit’s successor: the instruction, then the narrative, the round’s failed criteria and the request for its tactic record; each other successor: the narrative and the line naming the replaced unit and the Decision', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const decisionId = listByType(getEngine(), 'DECISION').find((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK')!.id;
		const source2 = currentOf(r.u, 'Source').id;
		seam.onTurn = writesItsTacticRecord(r.u);
		let turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: source2 })).error, 'the new Source did not run').toBeUndefined();

		const faulty = seam.turns[turns] ?? '';
		const path = tacticRecordPath('Source', source2);
		const at = [
			FEEDBACK_HEADING,
			'The loop so far',
			'The criteria the review that rejected the work found not met, each with its rationale:',
			'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.',
			'A documented usage does not work.',
			tacticRecordRequest(path)
		].map((part) => faulty.indexOf(part));
		expect(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]!), `the faulty successor’s parts are not in their order: ${JSON.stringify(at)}`).toBe(true);
		expect(faulty.indexOf(FEEDBACK_HEADING) > faulty.indexOf('Write the'), 'the feedback does not follow the instruction').toBe(true);
		expect(listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length, 'the faulty successor’s record is not taken').toBe(1);

		for (const action of ['recordAssurance', 'markSatisfied'] as const)
			expect((await press(r.u, action, { pwuId: source2 })).error, `arrangement: ${action} on the new Source`).toBeUndefined();
		turns = seam.turns.length;
		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Tests').id })).error, 'the new Tests did not run').toBeUndefined();

		const other = seam.turns[turns] ?? '';
		expect(other, 'the other successor’s turn does not carry the narrative').toContain('The loop so far');
		expect(other, 'the other successor’s turn does not name the replaced unit and the Decision').toContain(
			`This unit is redone because a unit its work used was replaced: "Source" (${r.ids.source}), under the person’s Decision ${decisionId}.`
		);
		expect(other, 'another successor was asked for a tactic record').not.toContain('Your tactic record');
	});

	it('⛔ RED FIRST — with no stage run, the faulty unit’s successor still carries the round’s failed criteria and the request, and no narrative', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const turn = seam.turns[turns] ?? '';
		expect([turn.includes(FEEDBACK_HEADING), turn.includes('The standard-input mode exits 1'), turn.includes('Your tactic record'), turn.includes('The loop so far')], 'the parts recorded are not the ones carried').toEqual([
			true,
			true,
			true,
			false
		]);
		// ⭑ The model wrote no record: at the step's end that is a finding, recorded, and the step went on.
		const findings = listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record-finding');
		expect(findings.length, 'a record never written is not a finding, recorded').toBe(1);
		expect(await getArtifactStore().get(String(findings[0]!.state.storageKey)), 'the finding does not say no record was written').toContain(
			'no tactic record was written at'
		);
	});

	it('⭑ CONTROL — a unit that replaces none starts with its instruction alone, byte for byte as before', async () => {
		const r = await verificationRejected();
		expect(seam.turns.every((t) => !t.includes(FEEDBACK_HEADING)), 'a unit that replaces none was given feedback').toBe(true);
		expect(successorRoundOf(getEngine(), r.ids.source), 'a unit that replaces none has a round').toBeUndefined();
	});

	it('⛔ RED FIRST — the derivation names the unit the act was pressed for: a target that is a reached composite’s child, at the head of a chain of producers (Source)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const decisionId = listByType(getEngine(), 'DECISION').find((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK')!.id;
		const source2 = currentOf(r.u, 'Source').id;

		for (const title of ['Source', 'Tests', 'Build', 'Verification']) {
			const round = successorRoundOf(getEngine(), currentOf(r.u, title).id);
			expect(
				[round?.faultyId, round?.decisionId, round?.rejectedUnitId, round?.roundId, round?.faultyPredecessor?.id],
				`${title}’s successor does not derive the faulty unit as Source’s successor`
			).toEqual([source2, decisionId, r.ids.verification, r.verdicts[0]!.assessmentId, r.ids.source]);
		}
	});

	it('⛔ RED FIRST — the derivation names the unit the act was pressed for: a composite target (Build)', async () => {
		const r = await verificationRejected();
		expect((await press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.build, rationale: TYPED })).error, 'arrangement: the act').toBeUndefined();
		const build2 = currentOf(r.u, 'Build').id;

		for (const title of ['Build', 'Verification'])
			expect(successorRoundOf(getEngine(), currentOf(r.u, title).id)?.faultyId, `${title}’s successor does not derive Build’s`).toBe(build2);
	});
});

describe('⭐⭐ L17b1 (D85; REG-D-169) — through the page: with a durable store and Pi, each step’s session is kept, reopened and forked', () => {
	/** A serving store's sessions root for one case, and Pi selected (its producer still the harness's scripted one, which writes no file). */
	const durableOnPi = (): string => {
		const root = join(TMP, `sessions-${++tmpCase}`, 'demo.sqlite.sessions');
		seam.sessionsRoot = root;
		vi.stubEnv('JPWB_EXECUTOR', 'pi');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'faux/model');
		return root;
	};
	/** A session file in `folder`, as Pi writes one: its header and one turn. */
	const sessionFileIn = (folder: string, name = '2026-11-16T00-00-00-000Z_s.jsonl'): string => {
		mkdirSync(folder, { recursive: true });
		const file = join(folder, name);
		const header = { type: 'session', version: 3, id: 's', timestamp: '2026-11-16T00:00:00.000Z', cwd: TMP };
		const turn = { type: 'message', id: 'u1', parentId: null, timestamp: '2026-11-16T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'Write the work.' }], timestamp: 1 } };
		// ⭐ The review's defect 8 — and its answer, as an earlier step that returned a work product left it (`stopReason` "stop").
		const answer = { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-11-16T00:00:02.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'The work.' }], stopReason: 'stop', timestamp: 2 } };
		writeFileSync(file, `${JSON.stringify(header)}\n${JSON.stringify(turn)}\n${JSON.stringify(answer)}\n`);
		return file;
	};
	/** ⭐ The review's defects 1 and 8 — what that file holds, as the place carries it: its answer, no findings, no feedback. */
	const HOLDS_AN_ANSWER = { returnedAnswer: true, ownFindings: false, crossUnitFeedback: false } as const;
	const purposesOf = (pwuId: string): string[] =>
		listByType(getEngine(), 'EXECUTION_PLAN')
			.filter((p) => p.state.workUnitId === pwuId)
			.flatMap((p) => ((p.state.steps as { purpose?: unknown }[] | undefined) ?? []).map((s) => String(s.purpose ?? '')));

	it('⛔ RED FIRST — a unit’s first step opens a NEW file in its folder; D71’s re-run in place reopens the one it finds there, its plan’s purpose and its first turn saying so', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		const spec = r.ids.spec;
		expect(seam.places[0], 'the first step’s session is not a new file in its folder').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', spec),
			opening: { kind: 'NEW' }
		});
		const folder = sessionFolderOf(root, 'executor', r.ids.verification);
		const file = sessionFileIn(folder);
		const places = seam.places.length;
		const turns = seam.turns.length;

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'the re-run did not run').toBeUndefined();

		expect(seam.places[places], 'the re-run did not reopen the unit’s one file').toEqual({
			kind: 'DURABLE',
			folder,
			// ⭐ RESTATED for the review's defects 1 and 8: the place carries what the file holds, read from it.
			opening: { kind: 'REOPEN', file, held: HOLDS_AN_ANSWER }
		});
		expect(purposesOf(r.ids.verification).filter((p) => p.startsWith('Re-attempt the work in its continued session')), 'the purpose does not say the session is continued').toHaveLength(1);
		const turn = seam.turns[turns] ?? '';
		expect(turn, 'the reopened session’s turn does not say what it holds').toContain(
			'This session holds that attempt: the turns above are your earlier work on this unit, with the work product you returned and your rationale.'
		);
		expect(turn, 'the reopened session’s turn says it is fresh').not.toContain('This is a fresh session');
	});

	it('⛔ RED FIRST — a replacement’s first step forks its predecessor’s file, its first turn saying whose conversation it holds; a predecessor with none starts new, and that is recorded for the run report', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		const from = sessionFileIn(sessionFolderOf(root, 'executor', r.ids.source));
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		let places = seam.places.length;
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: source2 })).error, 'the new Source did not run').toBeUndefined();

		expect(seam.places[places], 'the new Source did not fork its predecessor’s file').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', source2),
			// ⭐ RESTATED for the review's defect 8: and whether the forked conversation returned a work product.
			opening: { kind: 'FORK', from, predecessorId: r.ids.source, heldFindings: false, returnedAnswer: true }
		});
		expect(seam.turns[turns] ?? '', 'the forked turn does not say whose conversation it holds').toContain(
			`This session holds the conversation of the unit this one replaces, "Source" (${r.ids.source})`
		);
		for (const action of ['recordAssurance', 'markSatisfied'] as const)
			expect((await press(r.u, action, { pwuId: source2 })).error, `arrangement: ${action} on the new Source`).toBeUndefined();
		const tests2 = currentOf(r.u, 'Tests').id;
		places = seam.places.length;

		expect((await press(r.u, 'beginExecute', { pwuId: tests2 })).error, 'the new Tests did not run').toBeUndefined();

		expect(seam.places[places], 'a successor whose predecessor left no file did not start new, saying so').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', tests2),
			opening: { kind: 'NEW', predecessorWithoutSession: r.ids.tests }
		});
		expect(await getArtifactStore().resolveName(predecessorWithoutSessionNameOf('tnt-local', tests2)), 'no note is recorded for the run report').toBeDefined();
	});

	it('⛔ RED FIRST — two session files in a unit’s folder refuse its start before anything is dispatched, naming the folder', async () => {
		const root = durableOnPi();
		const u = await instantiated(TYPES());
		const spec = u.unitOf('Specification').id;
		const folder = sessionFolderOf(root, 'executor', spec);
		sessionFileIn(folder, 'a.jsonl');
		sessionFileIn(folder, 'b.jsonl');
		const events = getEngine().readAllEvents().length;

		const started = await press(u, 'beginExecute', { pwuId: spec });

		expect(started.error ?? '', 'two files did not refuse the start, naming the folder').toContain(`the session folder ${folder} holds 2 session files`);
		expect(getEngine().readAllEvents().length, 'the refused start dispatched something').toBe(events);
	});

	it('⛔ RED FIRST — a later try on a forked session is handed what its session held when the step began, and its first turn’s feedback, which it declares (the review’s defect 1)', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		sessionFileIn(sessionFolderOf(root, 'executor', r.ids.source));
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		// ⭑ The floor refuses the first try's work product with a finding, so the producer is asked again (package N's arrangement).
		let refusedOnce = false;
		seam.review = (prompt) => {
			if (!prompt.includes('The WORK PRODUCT to review') || refusedOnce) return undefined;
			refusedOnce = true;
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return JSON.stringify({
				findings: ids.map((id, i) =>
					i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
				),
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		};
		const inputs = seam.stepInputs.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const tries = seam.stepInputs.slice(inputs) as {
			readonly stillHeld?: { readonly holds: { readonly kind: string; readonly unitId?: string }; readonly feedback?: { readonly crossUnit: boolean } };
		}[];
		expect(tries.length, 'arrangement: the floor’s finding sent no second try').toBe(2);
		expect(
			[tries[0]?.stillHeld, tries[1]?.stillHeld?.holds.kind, tries[1]?.stillHeld?.holds.unitId, tries[1]?.stillHeld?.feedback?.crossUnit],
			'the later try is not handed what its forked session holds'
		).toEqual([undefined, 'PREDECESSOR', r.ids.source, true]);
	});

	it('⛔ RED FIRST — the session place’s refusal describes whatever value is thrown, through the one describer: a sessions root that throws a value that cannot be described refuses the re-run, said, never an escape (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		durableOnPi();
		const r = await verificationRejected();
		seam.sessionsRootThrows = { value: Object.create(null) };

		const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it.' }).then(
			(p) => ({ thrown: '', error: p.error ?? '' }),
			(e: unknown) => ({ thrown: saidOf(e), error: '' })
		);
		seam.sessionsRootThrows = undefined;

		expect(out, 'the session place’s refusal threw, or was said wrongly').toEqual({
			thrown: '',
			error: 'Re-running the work its declared reviews rejected refused: a thrown value that cannot be described'
		});
	});

	it('⭑ CONTROL — with no durable store, or an executor that is not Pi, every step is held in memory, as before', async () => {
		const r = await verificationRejected();
		expect(seam.places.length > 0 && seam.places.every((p) => JSON.stringify(p) === JSON.stringify({ kind: 'IN_MEMORY' })), 'a step with no durable store was not held in memory').toBe(true);
		seam.sessionsRoot = join(TMP, `sessions-${++tmpCase}`, 'demo.sqlite.sessions');
		const places = seam.places.length;
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect(seam.places.slice(places), 'a stand-in’s step was given a session file').toEqual([{ kind: 'IN_MEMORY' }]);
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
	seam.onTurn = undefined;
	seam.sessionsRoot = undefined;
	seam.sessionsRootThrows = undefined;
	seam.places.length = 0;
	seam.stepInputs.length = 0;
	seam.takes.length = 0;
	seam.takeAnswer = undefined;
	seam.refuseBatch = undefined;
	seam.refuseJoin = undefined;
	seam.listThrows = undefined;
	seam.viewThrows = undefined;
	seam.processRunsThrows = undefined;
	seam.disposes = 0;
	seam.disposeThrows = undefined;
	seam.throwBatch = undefined;
	seam.answer = (policyId) => answerOf(policyId);
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});
