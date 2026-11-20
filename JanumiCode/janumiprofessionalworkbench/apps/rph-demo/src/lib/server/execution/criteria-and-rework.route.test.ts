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
import { actingActor } from '../identity.js';
import { dispatch, getArtifactStore, getEngine, mintUiId, resetEngine, uiSession } from '../workbench.js';
// ⭐ L17b2 (the lead’s §16 (5)) — D71’s offer itself, held directly below.
import { rejectedRerunOffer } from './rejected-rerun.js';
// ⭐ L17b2 addendum (§27 item 3) — the page's reader of which declared verdict speaks, held directly at the file's end.
import { latestDeclaredVerdicts } from '../assurance/declared-policy-signoff.js';
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
	| 'recordBlockingFinding'
	// ⭐ L17b2 (ruling 3) — and the assurance stage (`runAssuranceStage`), pressed before D71's re-run.
	| 'runAssuranceStage';

/** ⭐ L17b2 (ruling 3) — one part of a press of the assurance stage, as the page returns it (`assurance-stage.route.test.ts`'s, copied). */
interface StagePartSeen {
	readonly part: string;
	readonly status: string;
	readonly artifactId?: string;
	readonly why?: string;
}

/** A page action on the fixture's Undertaking, as the page posts it. ⚠ An action the page does not have answers as an error, never a throw. */
// ⭐ L17b2 (ruling 3) — ~~`Promise<{ readonly advanced?: string; readonly error?: string }>`~~: and the stage's parts, where the press was the
// assurance stage's (`assurance-stage.route.test.ts`'s `press`, its `stage` copied).
async function press(
	u: Fixture,
	action: Action,
	fields: Readonly<Record<string, string>>
): Promise<{ readonly advanced?: string; readonly error?: string; readonly stage?: readonly StagePartSeen[] }> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as
		| { advanced?: string; stage?: readonly StagePartSeen[]; data?: { error?: string } }
		| undefined;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.stage === undefined ? {} : { stage: r.stage }),
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

// ── ⭐⭐ L17b2 — §4.13's item 3 (ruling 3; §7 Q2; the lead's §13): THE ROUND'S STAGE FIRST, ITS HISTORIAN CONCLUDING, BEFORE D71'S RE-RUN ─────────────
//
// ⭑ After L17b2 D71's re-run is not offered until the round's Historian assessment is recorded (ruling 3; D72's "When"), so each test of this file that
// reads its offer or presses it straight after a rejection runs the round's stage first, through the page (`stageFirst`), its Historian's time bound set
// (ruling 16) so that it concludes — the seam's clean answer (`seam.historian` unset): every criterion met, nothing recurring, nothing recommended. The
// page's executor is the stand-in and its shared workspace in memory, so the Hypothesizer is not run and the way back is the person's choice: D71's
// re-run offered, as before L17b2. The narrative's writer is answered by the floor's seam as it is (`seam.review` unset), so its chapter fails its check.
// ⭑ A re-run after the stage carries, after its findings, D77's feedback (`feedbackForRerun`): the narrative's heading and the line naming the chapter
// that failed its check, then — the round's Historian concluded — its judgment (ruling 19; §8.3's words), then the request for its tactic record.
// ⭑ `historianBoundSet`, `stageFirst` and the judgment's helpers are `assurance-stage.route.test.ts`'s, copied byte for byte; D77's words are restated
// here, never imported, as this file restates D70's and D71's.
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
/** ⭐ L17b2 — the assessments of a unit under the Historian's policy, in the order recorded. */
const historianAssessmentsOf = (pwuId: string) =>
	listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
		(a) => a.state.assurancePolicyId === 'pol_historical_consistency' && ((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(pwuId)
	);
/** ⭐ L17b2 (ruling 19) — the Historian's judgment as a turn shows it: its verdict, each criterion with its result and rationale, and its recurrence. */
const judgmentOf = (
	assessmentId: string,
	verdict: string,
	rows: readonly (readonly [string, string, string])[],
	recurrence?: { readonly statement: string; readonly earlierRecords: readonly string[] }
): string =>
	[
		`Its verdict on the loop (assessment ${assessmentId}): ${verdict}.`,
		...rows.map(([id, result, rationale]) => `- ${id} ${result}: ${rationale}`),
		...(recurrence === undefined
			? []
			: [`It finds this round’s failure an earlier one’s coming back: ${recurrence.statement} (the earlier records it names: ${recurrence.earlierRecords.join(', ')})`])
	].join('\n');
const JUDGMENT_HEADING = 'The Historian’s judgment of the loop:';
/** ⭐ L17b2 — the rows a clean Historian records: HC-01 to HC-05, each met, its rationale the answer's statement, 'met'. */
const ROWS_ALL_MET = ['HC-01', 'HC-02', 'HC-03', 'HC-04', 'HC-05'].map((id) => [id, 'MET', 'met'] as const);
/** ⭐ L17b2 — a clean Historian's judgment of `pwuId`'s round as a turn shows it, its heading first; its assessment's id read from the record ('(none)' where none is). */
const cleanJudgmentOf = (pwuId: string): string =>
	`${JUDGMENT_HEADING}\n${judgmentOf(historianAssessmentsOf(pwuId)[0]?.id ?? '(none)', 'SATISFIED', ROWS_ALL_MET)}`;
/** ⭐ L17b2 (D77) — the feedback's heading (`executor-session.ts`) and the narrative's (`successor-feedback.ts`), BYTE FOR BYTE — restated, never imported. */
const FEEDBACK_HEADING = 'Holistic feedback — what the assurance of this Undertaking’s work has recorded since this work was last done:';
const NARRATIVE_HEADING = 'The loop so far — the narrative memory of this Undertaking, chapter by chapter, each statement with the records it rests on:';
/** ⭐ L17b2 (D77) — the request for the tactic record at `path` (`tacticRecordRequest`), BYTE FOR BYTE — restated, never imported. */
const tacticRequest = (path: string): string =>
	[
		`Your tactic record: before you finish, write ONE JSON object to ${path} with these fields — "priorTactic" (how the earlier attempt went about`,
		'this work), "whatItProduced", "whyChange" (why you change your approach), "newTactic", "expectedImprovement" — and, where you judge that the',
		'fault lies in another unit’s work, "faultElsewhere": { "unit": "<its id>", "why": "<why>" }. The host reads it when your step ends and records it;',
		'it is not part of your deliverable, and no review of your work is shown it.'
	].join('\n');

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.review = undefined;
	seam.turns.length = 0;
	seam.workspaces.clear();
	seam.opens = 0;
	seam.declared.length = 0;
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
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the offer read straight after the rejection~~: the way back is offered only once the round’s stage has run
		// and its Historian concluded, so the stage runs first (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the
		// offer, not the narrative. The Hypothesizer not run, the way back is the person’s choice: D71’s re-run offered, as before.
		await stageFirst(r.u, r.spec.id);

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
		// ⭐ L17b2 (ruling 3; the lead’s §13) — ~~the offers read with no round’s stage anywhere~~: before a round’s stage no way back is offered on any
		// unit, so "nowhere else" read then would hold of every unit at once and tell nothing. Neither unit this CONTROL is about can have a stage of its
		// own — the stage runs only on a unit its declared reviews rejected — so one that can is added: the Technical Design, rejected by its declared
		// review, its round’s stage run, its Historian concluding (`stageFirst`; its writer failing its check). The page then offers the act THERE (the
		// positive, below), and the two units this CONTROL is about are read after that same stage, as before.
		const design = u.unitOf('Technical Design');
		expect((await press(u, 'beginExecute', { pwuId: design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) => answerOf(policyId, { 0: ['NOT_MET', 'The design does not trace requirement 3.'] }, cov[0]);
		expect((await press(u, 'recordAssurance', { pwuId: design.id })).error ?? '', 'arrangement: the Technical Design’s declared review rejected it').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
		seam.answer = (policyId) => answerOf(policyId);
		await stageFirst(u, design.id);

		const offers = rejectedOffers(u) ?? {};

		expect(offers[design.id], 'arrangement: the act is offered on the unit its declared reviews rejected, after its round’s stage').toEqual({
			policies: [COVERAGE],
			findings: 1
		});
		expect([offers[u.unitOf('Requirements Specification').id], offers[glossary.id]]).toEqual([undefined, undefined]);
		expect(decisionsOf(u.unitOf('Requirements Specification').id), 'a unit never rejected was re-planned').toEqual([]);
	});

	// ⭐⭐ L17b2 (the lead’s §16 (5)) — ADDED IN STAGE 1: THE OFFER ITSELF, HELD DIRECTLY. After L17b2 the page’s offer and act also need the round’s
	// Historian, and a unit only the operator rejected has no round (no declared verdict rejects it), so the page withholds D71’s re-run there twice
	// over, and the CONTROL above cannot tell this function’s own refusal from the round’s rule. This test asks `rejectedRerunOffer` itself — D71’s offer,
	// which the page, its action and the round’s rule all read — before any stage, and after another unit’s round has run its stage; its refusal’s
	// words restated here, never imported.
	it('⭑ CONTROL — the offer itself (`rejectedRerunOffer`): a unit only the operator’s finding rejected is offered no re-run, whatever the round — before any stage, and after another unit’s round has run its stage', async () => {
		const u = await instantiated(PHASES());
		await accept(u, 'Requirements Specification');
		const glossary = u.unitOf('Glossary');
		expect((await press(u, 'beginExecute', { pwuId: glossary.id })).error, 'arrangement: the Glossary ran').toBeUndefined();
		expect(
			(await press(u, 'recordBlockingFinding', { pwuId: glossary.id, statement: 'The glossary defines no term.' })).error,
			'arrangement: the operator’s finding'
		).toBeUndefined();
		expect(axesOf(glossary.id), 'arrangement: the Glossary rejected by the operator').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
		const noRejectingVerdict =
			'no governing declared policy of this unit holds a REJECTED verdict over it, so its assurance was not rejected by its declared ' +
			'reviews at its sign-off, and nothing here may be re-run with their findings (REG-D-163 (2))';

		expect(rejectedRerunOffer(getEngine(), glossary.id), 'a unit only the operator rejected is offered a re-run, before any stage').toEqual({
			refusedBecause: noRejectingVerdict
		});

		const design = u.unitOf('Technical Design');
		expect((await press(u, 'beginExecute', { pwuId: design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) => answerOf(policyId, { 0: ['NOT_MET', 'The design does not trace requirement 3.'] }, cov[0]);
		expect((await press(u, 'recordAssurance', { pwuId: design.id })).error ?? '', 'arrangement: the Technical Design’s declared review rejected it').toContain(
			"Assurance recorded, and the declared review did not conclude in this PWU's favour"
		);
		seam.answer = (policyId) => answerOf(policyId);
		await stageFirst(u, design.id);
		expect('refusedBecause' in rejectedRerunOffer(getEngine(), design.id), 'arrangement: the offer refuses a unit its declared review rejected').toBe(false);

		expect(rejectedRerunOffer(getEngine(), glossary.id), 'a unit only the operator rejected is offered a re-run, after another unit’s round').toEqual({
			refusedBecause: noRejectingVerdict
		});
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
		// ⭐ L17b2 (ruling 3; the lead’s §13) — ~~the offer read straight after the rejection~~: before the round’s stage no way back is offered at all, so the
		// absence below would be the round’s rule’s and could not tell the root’s discharge. So the root’s round’s stage runs first (`stageFirst`; its writer
		// failing its check) — it runs on any unit its declared reviews rejected, an operator’s too — and its Historian concludes: the round’s rule then
		// withholds nothing, and the root’s discharge alone does. The Historian’s conclusion is checked soft, so that the CONTROL’s own check is observed at
		// HEAD, where no Historian runs.
		await stageFirst(u, root.id);
		expect
			.soft(historianAssessmentsOf(root.id).map((a) => a.state.assessmentState), 'arrangement: the root’s round’s Historian concluded')
			.toEqual(['SATISFIED']);

		expect(rejectedOffers(u)?.[root.id], 'the act is offered on a unit no model works').toBeUndefined();
	});

	it('⛔ RED FIRST — the act, in one batch: the person’s Decision citing REG-D-163 (2), the move back on three axes citing it and the verdicts, a new plan superseding the old; then the work, run again', async () => {
		const r = await specRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the act pressed straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the act’s one batch, its events counted from after the stage.
		await stageFirst(r.u, r.spec.id);
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
		// ⭐ L17b2 (ruling 3; D72’s “When”; the lead’s §13) — ~~D71’s re-run pressed straight after the rejection~~: after the round’s stage, its Historian
		// concluding (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the turn’s opening, not the narrative.
		const chapter = (await stageFirst(r.u, r.spec.id)).find((p) => p.part === 'narrative-chapter');
		const [opens, turns] = [seam.opens, seam.turns.length];

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id, rationale: TYPED })).error, 'arrangement: the act').toBeUndefined();

		expect(seam.opens, 'the re-run did not open a fresh session').toBe(opens + 1);
		// ⭐ L17b2 (ruling 3; §7 Q2; the lead’s §13) — ~~`expect(seam.turns[turns], …).toBe(<the instruction, then the findings>)`~~: the round’s stage having
		// run, the turn goes on after the findings with D77’s feedback (`feedbackForRerun`, joined by a blank line), so the old promise is held of the turn’s
		// opening, byte for byte, here, and all that follows it in the next check: the two together are the whole turn, byte for byte.
		const opening = [instructionOf('Requirements Specification', [COVERAGE, INTENT]), '', CARRIED_HEAD, ...r.findings, '', CARRIED_TAIL].join('\n');
		const turn = seam.turns[turns] ?? '';
		expect(turn.slice(0, opening.length), 'the re-run’s first turn is not the instruction then the findings').toBe(opening);
		// ⭐ L17b2 (D77, D87; ruling 19; §7 Q2) — then the feedback, as the round’s stage left it: its heading; the narrative’s, its one line the chapter that
		// failed its check (the Hypothesizer not run: no diagnosis, no step-back); then, the round’s Historian concluded, its judgment (§8.3’s words); then
		// the request for its tactic record, last. Soft, as the stage route file’s judgment checks are: at HEAD no Historian runs.
		expect
			.soft(turn.slice(opening.length), 'the re-run’s first turn does not go on with the round’s feedback: the narrative, the Historian’s judgment, then the request')
			.toBe(
				[
					'',
					'',
					FEEDBACK_HEADING,
					'',
					NARRATIVE_HEADING,
					`Chapter ${chapter?.artifactId ?? '(none)'} failed its check, so its statements are left out: judge from the records.`,
					'',
					cleanJudgmentOf(r.spec.id),
					'',
					tacticRequest(`.jpwb/tactic/requirements-specification--${r.spec.id}.json`)
				].join('\n')
			);
	});

	it('⛔ RED FIRST — the sign-off after it judges the new work alone and accepts the unit on the new verdicts; the old verdicts and the earlier work stay recorded; Mark Satisfied writes the new work’s file', async () => {
		const r = await specRejected();
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the act pressed straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset): this promise is the sign-off after the re-run. The stage opens no producer, so
		// the re-run’s work is still the second session’s.
		await stageFirst(r.u, r.spec.id);
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
		// ⭐ L17b2 (ruling 3; D72’s “When”) — ~~the act pressed straight after the rejection~~: after the round’s stage, its Historian concluding
		// (`stageFirst`), its writer failing its check (`seam.review` unset), so the act is offered and each refusal below is for its own reason alone;
		// the events and the sessions counted from after the stage.
		await stageFirst(r.u, r.spec.id);
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

// ⭐⭐ L17b2 addendum (§27 item 3; ruling 18's general form, "never folded into the unit's own assurance") — THE HISTORIAN'S ASSESSMENT NEVER
// SPEAKS FOR A DECLARED REVIEW at the page's own reader (`latestDeclaredVerdicts`), as the kernel's index leaves it out: a unit whose type
// DECLARES the Historian's policy, its declared review REJECTED at its sign-off, and the round's Historian SATISFIED under that policy after it.
/** The Historian's policy, which a type may declare (design D73). */
const HISTORICAL = 'pol_historical_consistency';
/** The validator id the Historian completes its assessments under, BYTE FOR BYTE — restated here, never imported. */
const HISTORIAN_VALIDATOR = 'historian.historical-consistency';

/**
 * The Specification declaring the Historian's policy alone, rejected at its sign-off by that declared review (HC-01 NOT_MET, a BLOCKING finding
 * open), then the round's stage pressed, its Historian concluding SATISFIED under the same policy, later. Returns the unit, the declared verdict
 * and the Historian's assessment, told apart by its completion's validator id.
 */
async function historianAfterTheDeclaredReview() {
	const u = await instantiated(PHASES([HISTORICAL]));
	const spec = u.unitOf('Requirements Specification');
	expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();
	const first = policyOf(HISTORICAL).criteria[0]!.id;
	seam.answer = (policyId) =>
		policyId === HISTORICAL
			? answerOf(HISTORICAL, { 0: ['NOT_MET', 'The design reverses a decision recorded earlier.'] }, first)
			: answerOf(policyId);
	const signed = await press(u, 'recordAssurance', { pwuId: spec.id });
	expect(signed.error ?? '', 'arrangement: its declared review rejected the Specification').toContain(
		"Assurance recorded, and the declared review did not conclude in this PWU's favour"
	);
	seam.answer = (policyId) => answerOf(policyId);
	const [declared] = verdictsOf(spec.id, [HISTORICAL]);
	expect(declared?.state, 'arrangement: the declared verdict is REJECTED').toBe('REJECTED');
	await stageFirst(u, spec.id);
	const byHistorian = new Set(
		getEngine()
			.readAllEvents()
			.filter(
				(e) =>
					e.eventType === 'AssuranceAssessmentCompleted' &&
					(e.payload as { validatorId?: unknown } | undefined)?.validatorId === HISTORIAN_VALIDATOR
			)
			.map((e) => e.aggregateId)
	);
	const assessments = historianAssessmentsOf(spec.id);
	const historian = assessments.filter((a) => byHistorian.has(a.id));
	expect(
		historian.map((a) => a.state.assessmentState),
		'arrangement: the round’s Historian concluded SATISFIED, under the same policy'
	).toEqual(['SATISFIED']);
	const declaredAt = String(assessments.find((a) => a.id === declared!.assessmentId)?.state.updatedAt ?? '');
	expect(String(historian[0]!.state.updatedAt ?? '') >= declaredAt, 'arrangement: the Historian’s assessment is the later').toBe(true);
	expect(axesOf(spec.id), 'arrangement: the Historian’s assessment was folded into the unit’s own assurance').toEqual([
		'UNDER_ASSURANCE',
		'SUCCEEDED',
		'REJECTED'
	]);
	return { u, spec, declared: declared!, historian: historian[0]! };
}

describe('⭐⭐ L17b2 addendum (§27 item 3; ruling 18) — the Historian’s assessment never speaks for a declared review: the page’s reader, and D71’s offer on it', () => {
	it('⛔ RED FIRST — `latestDeclaredVerdicts`: the declared REJECTED speaks for its policy, never the Historian’s later SATISFIED', async () => {
		const r = await historianAfterTheDeclaredReview();

		expect(
			latestDeclaredVerdicts(getEngine(), r.spec.id, [HISTORICAL]).get(HISTORICAL),
			'the Historian’s later assessment speaks for the declared review'
		).toEqual({ policyId: HISTORICAL, assessmentId: r.declared.assessmentId, state: 'REJECTED' });
	});

	it('⛔ RED FIRST — D71’s offer on the same arrangement: the page offers the re-run the kernel’s guard admits, and the act, pressed, is taken, citing the declared verdict', async () => {
		const r = await historianAfterTheDeclaredReview();

		expect
			.soft(rejectedOffers(r.u)?.[r.spec.id], 'the page offers no re-run where the kernel’s guard reads the declared REJECTED as the latest verdict')
			.toEqual({ policies: [HISTORICAL], findings: 1 });
		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.spec.id, rationale: TYPED });
		expect
			.soft([rerun.advanced, rerun.error], 'the page refuses the act the kernel’s guard admits, or the guard refuses the page’s act')
			.toEqual(['rejected-work-rerun', undefined]);
		const [decision] = decisionsOf(r.spec.id);
		const subjects = (decision?.state.subjectObjectIds as string[] | undefined) ?? [];
		expect
			.soft(
				[subjects.includes(r.declared.assessmentId), subjects.includes(r.historian.id)],
				'the person’s Decision does not cite the declared verdict, or cites the Historian’s'
			)
			.toEqual([true, false]);
	});
});
