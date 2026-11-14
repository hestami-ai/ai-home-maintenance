// ⭐⭐ `JAN-EXEC` Phase 7, package L15 — design D69 (`REG-D-159`; `REG-F-634`; `REG-F-358`) — A UNIT IS GIVEN THE ACCEPTED WORK OF THE
// UNITS IT DEPENDS ON, BY A FILE AND A POINTER — THROUGH THE PAGE'S OWN ACTIONS.
//
// ⛔ WHAT WAS WRONG (`REG-F-634`). P6 again's seventh paid run was withheld at its composite `Requirements and Design`: both its declared
// reviews rejected it, the Technical Design contradicting the accepted Requirements Specification on two points the Specification had
// settled. The Technical Design never saw it. It depended on it, and the engine started it only once the Specification was accepted
// (D1, D2) — but Begin & Execute bound no inputs, a unit's prompt carried only its own fields, the executor's loader took nothing from
// the folder, and the Specification answered in its reply and wrote no file.
//
// ⭑ WHAT MUST HOLD (the sponsor's ruling `REG-D-159`; the moment, the bytes, the place, the section, the refresh, the refusal and the
// policy are the lead's, D69):
//   · when Mark Satisfied accepts a unit, its accepted work product — the bytes its last successful completion names, checked against
//     their hash — is written to `.jpwb/accepted/<slug>--<unit id>.txt` in the Undertaking's shared workspace; a write that fails is
//     stated, and the acceptance stands;
//   · before a unit's Begin & Execute, and before a work re-run, the file of each unit it depends on is written again from the record,
//     before its workspace baseline: it starts on the accepted bytes, and they are not its own change;
//   · its instruction ends, after its output contract, with the section naming each such file, in its recorded dependencies' order —
//     as it is sent, as a review of the step is shown it, and as a re-review and a declared review rebuild it;
//   · a dependency whose accepted work cannot be read, fails its hash or cannot be written refuses the start, naming it, before any
//     model or reviewer call, and nothing of the unit moves.
//
// ⭑ THE ARRANGEMENT, IN TEST MODE (package N's route test's): the reviewer is devin, NAMED with its model, its PROGRAM replaced at its exec
// seam; the producer is a scripted session writing into the Undertaking's workspace through the port it is handed; the Undertaking's
// workspace is one in-memory workspace per Undertaking, held across requests, whose writes a case can refuse; and the content store is
// the real one, whose reads a case can make miss or answer other bytes.
// ⛔ HERMETIC: devin's exec seam starts nothing; no process is started; PATH finds no program; the decision model is the product's double.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every prompt the validator handed devin, in order. */
	prompts: [] as string[],
	/** What devin answers a prompt (a throw fails the call at its transport): undefined is a clean review over its own rubric. */
	review: undefined as undefined | ((prompt: string) => string | undefined),
	/** Every turn a producer was sent, in order. */
	turns: [] as string[],
	/** What the producer writes on a turn, keyed by the turn's text. */
	writes: (() => []) as (text: string) => readonly { readonly path: string; readonly contents: string }[],
	/** One in-memory sandbox per Undertaking, held across requests. */
	workspaces: new Map<string, unknown>(),
	/** How many producer sessions the route opened. */
	opens: 0,
	/** What a case does with the workspace as a producer's session opens, before any turn. */
	onOpen: undefined as undefined | ((workspace: import('@janumipwb/rph-ports').Workspace) => Promise<void>),
	/** Set, the workspace refuses a write to a path this answers true for, with this reason. */
	refuseWrite: undefined as undefined | { readonly when: (path: string) => boolean; readonly because: string },
	/** Set, the content store answers a read of this key so: `missing` reads nothing, `other` reads other bytes. */
	storeRead: undefined as undefined | { readonly key: string; readonly answer: 'missing' | 'other' }
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
						// ⭑ A WRITE A CASE REFUSES, as the port refuses one: an outcome, never a throw.
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

// ⭑ THE REAL CONTENT STORE, a read of one key a case makes miss, or answer other bytes than those its record hashed.
vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return {
		...actual,
		getArtifactStore: vi.fn(() => {
			const store = actual.getArtifactStore();
			return {
				...store,
				get: async (key: string) => {
					const bytes = await store.get(key);
					if (seam.storeRead?.key !== key) return bytes;
					return seam.storeRead.answer === 'missing' ? undefined : `${bytes ?? ''} — and other bytes`;
				}
			};
		})
	};
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	const { createProcessRunObserver } = await import('../tools/process-run-observer.js');
	return {
		...actual,
		// ⭑ A SCRIPTED PRODUCER OVER THE HOST'S REAL OBSERVER: each turn writes what the case says through the workspace port, and
		// answers the execution contract's envelope, its work product one JSON object naming the turn's first line.
		getExecutionSession: vi.fn(() => async (context: { readonly workspace: import('@janumipwb/rph-ports').Workspace }) => {
			const observer = createProcessRunObserver();
			seam.opens += 1;
			await seam.onOpen?.(context.workspace);
			return {
				turn: async (text: string) => {
					seam.turns.push(text);
					for (const w of seam.writes(text)) {
						const out = await context.workspace.writeFile(w.path, w.contents);
						if (out.written) observer.wrote({ path: out.path });
					}
					return JSON.stringify({
						workProduct: { document: `THE WORK: ${text.split('\n')[0]}` },
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

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — the CONFIGURED model reported; each prompt answered by the case
// (`seam.review`), else clean over the prompt's own rubric (a declared policy's read off its lines).
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
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
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

// ⭑ The product's configured decision model, stood in for by a double that calls no model (package N's route test's).
vi.mock('../assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('../assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('../assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import type { Workspace } from '@janumipwb/rph-ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage } from '../../../routes/undertakings/[id]/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, getArtifactStore, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { deliverableViewRefOf, readDeliverableView } from './deliverable-view.js';
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

/** ⭐ D69's first line, the lead's words, BYTE FOR BYTE — restated here, never imported. */
const HEADING =
	"This work depends on the accepted work of other units of this Undertaking. Before you begin, read each file below. Each holds one unit's accepted work product, exactly as its reviews judged it. The workbench writes these files; do not change them.";
/** The Undertaking's statement as the portfolio's form makes it from a name alone (its own defaults), D61's section. */
const UNDERTAKING_SECTION =
	'This work is part of an Undertaking. Its intended product and its objective, as stated when it was created:\n' +
	'Intended product: Accepted Work\nObjective:\nDeliver Accepted Work';
const DESIGN_CONTRACT = 'Return one JSON object whose one field, "document", holds the design.';
/** A declared policy the reference seed holds, so a leaf's declared review rebuilds its producing prompt (PRODUCING_PROMPT). */
const DECLARED_POLICY = 'pol_requirement_coverage';

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
	readonly outputContract?: string;
	readonly policies?: readonly string[];
	/** Its kind, where a case needs one a declared policy governs; else read off its name. */
	readonly kind?: string;
}

/**
 * A root over four phases: the Requirements Specification and the Glossary, each a model's work, and the Market Survey, an
 * operator's that produces no work product, each produce an input the Technical Design requires — so the Technical Design depends
 * on all three, and only the two that a model produced hold a work product.
 */
const PHASES: readonly FixtureType[] = [
	{
		name: 'Product',
		isRoot: true,
		children: ['Requirements Specification', 'Glossary', 'Market Survey', 'Technical Design'],
		inputs: ['originating-intent']
	},
	{ name: 'Requirements Specification', inputs: ['originating-intent'], outputs: ['specification'], model: true },
	{ name: 'Glossary', inputs: ['originating-intent'], outputs: ['glossary'], model: true },
	{ name: 'Market Survey', inputs: ['originating-intent'], outputs: ['survey'] },
	{
		name: 'Technical Design',
		inputs: ['specification', 'glossary', 'survey'],
		outputs: ['design'],
		model: true,
		outputContract: DESIGN_CONTRACT
	}
];

/**
 * A PWA of `types`, authored and published through the commands, then an Undertaking of it created through the portfolio's own
 * action — so its units are what instantiation builds and their dependencies what it records (D1). Returns the Undertaking's id and
 * its units by title (`begin-execute-data-flow-order.test.ts`'s arrangement, each MODEL type's prompt `Write the {subject}.`).
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
		name: 'Accepted Work PWA',
		description: 'A PWA whose types hand their outputs to one another.',
		domain: 'software product',
		version: '0.1.0'
	});
	// Children before parents: a type's permitted children must exist to be named.
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
							status: 'ACTIVE',
							...(t.outputContract === undefined ? {} : { outputContract: t.outputContract })
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
		event('/undertakings', 'create', { name: 'Accepted Work', pwaId, ...RISK })
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

/** A page action on `pwuId` of the fixture's Undertaking, as the page posts it. */
async function press(
	u: Fixture,
	action: 'beginExecute' | 'recordAssurance' | 'markSatisfied' | 'rerunWork' | 'rerunReview',
	fields: Readonly<Record<string, string>>
): Promise<{ readonly advanced?: string; readonly acceptedWorkNotWritten?: string; readonly status?: number; readonly error?: string }> {
	const r = (await unitPage[action](
		event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never
	)) as { advanced?: string; acceptedWorkNotWritten?: string; status?: number; data?: { error?: string } } | undefined;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.acceptedWorkNotWritten === undefined ? {} : { acceptedWorkNotWritten: r.acceptedWorkNotWritten }),
		...(r?.status === undefined ? {} : { status: r.status }),
		...(r?.data?.error === undefined ? {} : { error: r.data.error })
	};
}

/** Begin & Execute, Record Assurance, then Mark Satisfied on the unit titled `title`, each as the page posts it: the unit SATISFIED. */
async function accept(u: Fixture, title: string): Promise<void> {
	const pwuId = u.unitOf(title).id;
	for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const) {
		const r = await press(u, action, { pwuId });
		expect(r.error, `arrangement: ${action} on ${title}`).toBeUndefined();
	}
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, `arrangement: ${title} accepted`).toBe('SATISFIED');
}

/** The Undertaking's workspace, as the route resolves it. */
const workspaceOf = (u: Fixture): Workspace =>
	(resolveUndertakingSandbox(u.undertakingId) as unknown as { workspace: Workspace }).workspace;

/** The unit's accepted work product, as the record names it: its last completion's first output — its id, its bytes, its hash. */
async function workProductOf(pwuId: string): Promise<{ readonly id: string; readonly storageKey: string; readonly bytes: string; readonly contentHash: string }> {
	const plans = new Set(
		listByType(getEngine(), 'EXECUTION_PLAN')
			.filter((p) => p.state.workUnitId === pwuId)
			.map((p) => p.id)
	);
	const last = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
		.at(-1);
	const id = String((last?.payload as { outputArtifactIds?: string[] } | undefined)?.outputArtifactIds?.[0] ?? '');
	const artifact = getObject(getEngine(), id) ?? {};
	const storageKey = String(artifact.storageKey ?? '');
	return { id, storageKey, bytes: (await getArtifactStore().get(storageKey)) ?? '', contentHash: String(artifact.contentHash ?? '') };
}

/** The files the unit's last completion's recorded view lists, read back from the content plane. */
async function viewedFilesOf(pwuId: string): Promise<readonly string[] | undefined> {
	const plans = new Set(
		listByType(getEngine(), 'EXECUTION_PLAN')
			.filter((p) => p.state.workUnitId === pwuId)
			.map((p) => p.id)
	);
	const last = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
		.at(-1);
	const ref = deliverableViewRefOf(
		(last?.payload as { structuredResult?: { deliverableView?: unknown } } | undefined)?.structuredResult?.deliverableView
	);
	if (ref === undefined) return undefined;
	const read = await readDeliverableView(getArtifactStore(), ref);
	return read.ok ? read.view.deliverable.files.map((f) => f.path) : undefined;
}

/** `.jpwb/accepted/<slug>--<unit id>.txt`, spelled here by hand for the fixture's titles. */
const fileOf = (slug: string, unitId: string): string => `.jpwb/accepted/${slug}--${unitId}.txt`;
const sha256 = (text: string): string => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const isWorkProductReview = (p: string): boolean => p.includes('The WORK PRODUCT to review');
const isDeclaredReview = (p: string): boolean => p.includes('declared assurance policy');
const modelExchanges = (): number => listByType(getEngine(), 'MODEL_EXCHANGE').length;
const bindings = (): number => listByType(getEngine(), 'RUNTIME_BINDING').length;
const eventCount = (): number => getEngine().readAllEvents().length;
const plansOf = (pwuId: string) => listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === pwuId);

/**
 * The fixture, its three producers of the Technical Design's inputs accepted, and the Technical Design's instruction as D69 says it
 * reads: the type's text, the Undertaking's statement, the output contract, then the section — the Specification's and the
 * Glossary's files, in the order its recorded dependencies name them; the Market Survey, which holds no work product, not listed.
 */
async function designReady(policies: readonly string[] = []) {
	const u = await instantiated(
		// ⚠ A declared policy governs the kinds it names alone (`appliesToPwuKinds`): `pol_requirement_coverage` governs
		// REQUIREMENT_DEFINITION, so a Technical Design that declares it is given that kind, as package N's and the declared review route's
		// tests give theirs; with no policy its kind is read off its name, as before.
		PHASES.map((t) =>
			t.name === 'Technical Design' ? { ...t, policies, ...(policies.length > 0 ? { kind: 'REQUIREMENT_DEFINITION' } : {}) } : t
		)
	);
	await accept(u, 'Requirements Specification');
	await accept(u, 'Glossary');
	await accept(u, 'Market Survey');
	const [spec, glossary, survey, design] = ['Requirements Specification', 'Glossary', 'Market Survey', 'Technical Design'].map((t) => u.unitOf(t));
	const order = (design!.state.dependencyIds as string[]).filter((id) => id !== survey!.id);
	const lineOf = (id: string): string =>
		id === spec!.id
			? `- Requirements Specification: ${fileOf('requirements-specification', spec!.id)}`
			: `- Glossary: ${fileOf('glossary', glossary!.id)}`;
	const section = [HEADING, ...order.map(lineOf)].join('\n');
	const instruction =
		`Write the Technical Design.\n\n${UNDERTAKING_SECTION}\n\nThe output this work requires:\n${DESIGN_CONTRACT}\n\n${section}`;
	return { u, spec: spec!, glossary: glossary!, survey: survey!, design: design!, section, instruction };
}

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.turns.length = 0;
	seam.review = undefined;
	seam.writes = () => [];
	seam.workspaces.clear();
	seam.opens = 0;
	seam.onOpen = undefined;
	seam.refuseWrite = undefined;
	seam.storeRead = undefined;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐⭐ L15 (D69) — Mark Satisfied writes the unit’s accepted work product to its file', () => {
	it('⛔ RED FIRST — its file holds the work product its last completion names, byte for byte and hash-equal to the artifact — not the rationale, not the reply', async () => {
		const u = await instantiated(PHASES);
		await accept(u, 'Requirements Specification');
		const spec = u.unitOf('Requirements Specification');
		const product = await workProductOf(spec.id);
		expect(product.bytes, 'arrangement: the work product as stored').toBe('{"document":"THE WORK: Write the Requirements Specification."}');

		const file = await workspaceOf(u).readFile(fileOf('requirements-specification', spec.id));

		expect(file, 'Mark Satisfied wrote no file of the accepted work').toBe(product.bytes);
		expect(sha256(file ?? ''), 'the file’s bytes do not hash to the artifact’s content hash').toBe(product.contentHash);
		expect(file, 'the file holds the rationale').not.toContain('An account.');
	});

	it('⭑ CONTROL — a unit whose completion names no work product has no file, and its acceptance states nothing', async () => {
		const u = await instantiated(PHASES);
		const survey = u.unitOf('Market Survey');
		for (const action of ['beginExecute', 'recordAssurance'] as const)
			expect((await press(u, action, { pwuId: survey.id })).error, `arrangement: ${action}`).toBeUndefined();

		const satisfied = await press(u, 'markSatisfied', { pwuId: survey.id });

		expect(satisfied, 'the acceptance of a unit with no work product stated something').toEqual({ advanced: 'satisfied' });
		expect(
			(await workspaceOf(u).list()).map((e) => e.path).filter((p) => p.startsWith('.jpwb/')),
			'a unit with no work product was given a file'
		).toEqual([]);
	});

	it('⛔ RED FIRST — a write that fails is stated, and the acceptance stands', async () => {
		const u = await instantiated(PHASES);
		const spec = u.unitOf('Requirements Specification');
		for (const action of ['beginExecute', 'recordAssurance'] as const)
			expect((await press(u, action, { pwuId: spec.id })).error, `arrangement: ${action}`).toBeUndefined();
		seam.refuseWrite = { when: (p) => p.startsWith('.jpwb/'), because: 'the workspace refused the write (a case)' };

		const satisfied = await press(u, 'markSatisfied', { pwuId: spec.id });

		const file = fileOf('requirements-specification', spec.id);
		expect(satisfied, 'the failed write was not stated, or the acceptance did not stand').toEqual({
			advanced: 'satisfied',
			acceptedWorkNotWritten: `The unit is accepted, but its accepted work product was not written to ${file} in the Undertaking's shared workspace: its file ${file} could not be written: the workspace refused the write (a case)`
		});
		expect(getObject(getEngine(), spec.id)?.workLifecycleState, 'the acceptance was undone').toBe('SATISFIED');
	});

	it('⛔ RED FIRST — the page states it, beside the page’s other refusals', () => {
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not show the statement').toContain(
			'{#if form?.acceptedWorkNotWritten}<p class="err" role="alert" data-testid="accepted-work-not-written">{form.acceptedWorkNotWritten}</p>{/if}'
		);
		expect(page, 'the page’s action data does not carry the statement').toContain('acceptedWorkNotWritten?: string');
	});
});

describe('⭐⭐ L15 (D69) — a unit that depends on accepted work is pointed at its files, last in its instruction, the files written first', () => {
	it('⛔ RED FIRST (REG-F-634) — the section, after the output contract, as the unit is sent its instruction and as its review is shown it', async () => {
		const d = await designReady();
		seam.turns.length = 0;
		seam.prompts.length = 0;

		const r = await press(d.u, 'beginExecute', { pwuId: d.design.id });

		expect(r.error, 'arrangement: the Technical Design ran').toBeUndefined();
		expect(seam.turns[0], 'the unit was not sent the section, last, after its output contract').toBe(d.instruction);
		const review = seam.prompts.find(isWorkProductReview) ?? '';
		expect(review, 'the work product’s review was not shown the section').toContain(`${DESIGN_CONTRACT}\n\n${d.section}`);
	});

	it('⛔ RED FIRST — each file holds its unit’s accepted bytes before the executor opens, and is not in the unit’s deliverable view', async () => {
		const d = await designReady();
		const expected = {
			spec: (await workProductOf(d.spec.id)).bytes,
			glossary: (await workProductOf(d.glossary.id)).bytes
		};
		let atOpen: Record<string, string | undefined> = {};
		seam.onOpen = async (ws) => {
			atOpen = {
				spec: await ws.readFile(fileOf('requirements-specification', d.spec.id)),
				glossary: await ws.readFile(fileOf('glossary', d.glossary.id))
			};
		};
		seam.writes = (text) => (text.startsWith('Write the Technical Design.') ? [{ path: 'docs/design.md', contents: '# Design\n' }] : []);

		expect((await press(d.u, 'beginExecute', { pwuId: d.design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();

		expect(atOpen, 'a file did not hold its unit’s accepted bytes when the executor opened').toEqual(expected);
		expect(await viewedFilesOf(d.design.id), 'the accepted work was counted as the unit’s own change').toEqual(['docs/design.md']);
	});

	it('⛔ RED FIRST — a dependency with no work product is not listed, and the files are listed in the order the unit’s dependencies are recorded', async () => {
		const d = await designReady();
		const recorded = d.design.state.dependencyIds as string[];
		expect(new Set(recorded), 'arrangement: the Technical Design depends on its three producers').toEqual(new Set([d.spec.id, d.glossary.id, d.survey.id]));
		const listed = recorded.filter((id) => id !== d.survey.id);
		const byTitle = [d.glossary.id, d.spec.id];
		expect(listed, 'arrangement: the recorded order is the order of the titles, so an order by title would pass').not.toEqual(byTitle);

		expect((await press(d.u, 'beginExecute', { pwuId: d.design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();

		const lines = (seam.turns.at(-1) ?? '').split('\n').filter((l) => l.startsWith('- '));
		expect(lines, 'the section does not list each producer that holds a work product, once, in the recorded order').toEqual(
			listed.map((id) =>
				id === d.spec.id
					? `- Requirements Specification: ${fileOf('requirements-specification', d.spec.id)}`
					: `- Glossary: ${fileOf('glossary', d.glossary.id)}`
			)
		);
		expect(seam.turns.at(-1), 'the Market Survey, which holds no work product, was named').not.toContain('Market Survey');
	});

	it('⛔ RED FIRST — a file changed after its unit’s acceptance, or removed, is written again from the record before the unit starts, and still is no change of its own', async () => {
		const d = await designReady();
		const accepted = (await workProductOf(d.spec.id)).bytes;
		const specFile = fileOf('requirements-specification', d.spec.id);
		// Changed: a command, since, rewrote the Specification's file in the shared folder.
		await workspaceOf(d.u).writeFile(specFile, 'N has no upper bound.');
		let atOpen: string | undefined;
		seam.onOpen = async (ws) => {
			atOpen = await ws.readFile(specFile);
		};
		expect((await press(d.u, 'beginExecute', { pwuId: d.design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();
		expect(atOpen, 'a file changed since its unit’s acceptance was not written again').toBe(accepted);

		// Removed: the Undertaking's folder holds none of the files any more — a second Undertaking's unit of the same shape, its
		// producers accepted, then its workspace replaced by an empty one before the unit starts.
		const e = await designReady();
		seam.workspaces.delete(e.u.undertakingId);
		let removedAtOpen: string | undefined;
		seam.onOpen = async (ws) => {
			removedAtOpen = await ws.readFile(fileOf('requirements-specification', e.spec.id));
		};
		seam.writes = (text) => (text.startsWith('Write the Technical Design.') ? [{ path: 'docs/design.md', contents: '# Design\n' }] : []);
		expect((await press(e.u, 'beginExecute', { pwuId: e.design.id })).error, 'arrangement: the second Technical Design ran').toBeUndefined();
		expect(removedAtOpen, 'a removed file was not written again').toBe((await workProductOf(e.spec.id)).bytes);
		expect(await viewedFilesOf(e.design.id), 'a file written again before the unit started was counted as its change').toEqual(['docs/design.md']);
	});

	it('⛔ RED FIRST — a unit an operator completes is handed its accepted work too: the root’s Begin & Execute writes its children’s files again before it starts (the builder’s reading of “before each Begin & Execute”)', async () => {
		const d = await designReady();
		await accept(d.u, 'Technical Design');
		const specFile = fileOf('requirements-specification', d.spec.id);
		await workspaceOf(d.u).writeFile(specFile, 'N has no upper bound.');
		const root = d.u.unitOf('Product');

		const r = await press(d.u, 'beginExecute', { pwuId: root.id });

		expect([r.advanced, r.error], 'arrangement: the root, an operator’s, ran').toEqual(['executed', undefined]);
		expect(await workspaceOf(d.u).readFile(specFile), 'the root’s start did not write its child’s file again').toBe(
			(await workProductOf(d.spec.id)).bytes
		);
	});

	it('⭑ CONTROL — a unit that depends on no accepted work is sent its instruction byte for byte as before, and nothing is written for it', async () => {
		const u = await instantiated(PHASES);
		const spec = u.unitOf('Requirements Specification');

		expect((await press(u, 'beginExecute', { pwuId: spec.id })).error, 'arrangement: the Specification ran').toBeUndefined();

		expect(seam.turns[0], 'a unit with no dependency was not sent today’s instruction').toBe(
			`Write the Requirements Specification.\n\n${UNDERTAKING_SECTION}`
		);
		expect(
			(await workspaceOf(u).list()).map((e) => e.path).filter((p) => p.startsWith('.jpwb/')),
			'a file was written for a unit that depends on no accepted work'
		).toEqual([]);
	});
});

describe('⭐⭐ L15 (D69) — a dependency whose accepted work cannot be handed over refuses the start before any model or reviewer call', () => {
	/** The start, refused: the reason named, and nothing of the unit moved — no exchange, no session, no plan, no binding, no event. */
	async function refusedStart(arrange: (d: Awaited<ReturnType<typeof designReady>>) => Promise<void>) {
		const d = await designReady();
		await arrange(d);
		const [exchanges, bound, events, opens] = [modelExchanges(), bindings(), eventCount(), seam.opens];
		seam.prompts.length = 0;
		const r = await press(d.u, 'beginExecute', { pwuId: d.design.id });
		expect([modelExchanges(), seam.prompts.length, seam.opens], 'a model or a reviewer was called for a refused start').toEqual([
			exchanges,
			0,
			opens
		]);
		expect(getObject(getEngine(), d.design.id)?.workLifecycleState, 'the refused unit moved').toBe('PROPOSED');
		expect([plansOf(d.design.id).length, bindings(), eventCount()], 'a refused start left a plan, a binding or an event').toEqual([0, bound, events]);
		return { d, r };
	}

	it('⛔ RED FIRST — its stored bytes are missing: refused, naming it and why', async () => {
		const { d, r } = await refusedStart(async (x) => {
			seam.storeRead = { key: (await workProductOf(x.spec.id)).storageKey, answer: 'missing' };
		});
		const key = (await workProductOf(d.spec.id)).storageKey;
		expect([r.status, r.error]).toEqual([
			400,
			`Execution failed: the accepted work of "Requirements Specification" (${d.spec.id}), which this unit depends on, cannot be handed to it: the work product’s bytes at '${key}' are not in the content store.`
		]);
	});

	it('⛔ RED FIRST — its stored bytes fail their hash: refused, naming it and why', async () => {
		const { d, r } = await refusedStart(async (x) => {
			seam.storeRead = { key: (await workProductOf(x.spec.id)).storageKey, answer: 'other' };
		});
		const product = await workProductOf(d.spec.id);
		expect(r.status).toBe(400);
		expect(r.error, 'the refusal does not name the dependency and its failed hash').toBe(
			`Execution failed: the accepted work of "Requirements Specification" (${d.spec.id}), which this unit depends on, cannot be handed to it: the work product’s bytes at '${product.storageKey}' hash to ${sha256(product.bytes)}, not the ${product.contentHash} its record names.`
		);
	});

	it('⛔ RED FIRST — its file cannot be written: refused, naming it and why', async () => {
		const { d, r } = await refusedStart(async () => {
			seam.refuseWrite = { when: (p) => p.startsWith('.jpwb/'), because: 'the workspace refused the write (a case)' };
		});
		const order = (d.design.state.dependencyIds as string[]).filter((id) => id !== d.survey.id);
		const first = order[0] === d.spec.id ? { title: 'Requirements Specification', file: fileOf('requirements-specification', d.spec.id) } : { title: 'Glossary', file: fileOf('glossary', d.glossary.id) };
		expect([r.status, r.error]).toEqual([
			400,
			`Execution failed: the accepted work of "${first.title}" (${order[0]}), which this unit depends on, cannot be handed to it: its file ${first.file} could not be written: the workspace refused the write (a case)`
		]);
	});
});

describe('⭐⭐ L15 (D69) — a work re-run, a re-review and a declared review give and show the same instruction', () => {
	/** The Technical Design's first attempt, its work product's review failing at the transport, so the unit waits (RD3). */
	async function designWaiting(policies: readonly string[] = []) {
		const d = await designReady(policies);
		let down = true;
		seam.review = (p) => {
			if (down && isWorkProductReview(p) && p.includes('Write the Technical Design.'))
				throw new Error('devin exited with code 1: connection reset by peer');
			return undefined;
		};
		seam.turns.length = 0;
		const first = await press(d.u, 'beginExecute', { pwuId: d.design.id });
		expect(first.error, 'arrangement: the first attempt’s review concluded').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		expect(seam.turns[0], 'the unit was not sent the section, last, after its output contract').toBe(d.instruction);
		down = false;
		seam.turns.length = 0;
		seam.prompts.length = 0;
		return d;
	}

	it('⛔ RED FIRST — a work re-run is sent the section, its files written again from the record first', async () => {
		const d = await designWaiting();
		const specFile = fileOf('requirements-specification', d.spec.id);
		await workspaceOf(d.u).writeFile(specFile, 'N has no upper bound.');
		let atOpen: string | undefined;
		seam.onOpen = async (ws) => {
			atOpen = await ws.readFile(specFile);
		};

		const rerun = await press(d.u, 'rerunWork', { pwuId: d.design.id, rationale: 'The reviewer failed at the transport; run the work again.' });

		expect([rerun.advanced, rerun.error], 'arrangement: the work re-run').toEqual(['work-rerun', undefined]);
		expect(seam.turns[0], 'the re-run was not sent the section').toBe(d.instruction);
		expect(atOpen, 'the re-run did not write the file again before its executor opened').toBe((await workProductOf(d.spec.id)).bytes);
	});

	it('⛔ RED FIRST — a work re-run whose dependency’s accepted work cannot be read is refused before anything is dispatched, the unit still waiting', async () => {
		const d = await designWaiting();
		seam.storeRead = { key: (await workProductOf(d.spec.id)).storageKey, answer: 'missing' };
		const [events, opens] = [eventCount(), seam.opens];

		const rerun = await press(d.u, 'rerunWork', { pwuId: d.design.id, rationale: 'The reviewer failed at the transport; run the work again.' });

		expect(rerun.error ?? '', 'the re-run was not refused for its dependency').toMatch(
			/^Re-running the work refused: the accepted work of "Requirements Specification" \(pwu_[0-9A-Z]+\), which this unit depends on, cannot be handed to it: the work product’s bytes at '[^']+' are not in the content store\.$/
		);
		expect([eventCount(), seam.opens, seam.prompts.length], 'a refused re-run dispatched something').toEqual([events, opens, 0]);
		expect(getObject(getEngine(), d.design.id)?.executionState, 'the unit no longer waits').toBe('WAITING');
	});

	it('⛔ RED FIRST — the stopped unit’s re-review rebuilds the instruction its producer was sent, byte for byte', async () => {
		const d = await designWaiting();

		const reReviewed = await press(d.u, 'rerunReview', { pwuId: d.design.id, rationale: 'The reviewer failed at the transport; review it again.' });

		expect(reReviewed.error, 'arrangement: the re-review completed').toBeUndefined();
		const review = seam.prompts.find(isWorkProductReview) ?? '';
		expect(review, 'the re-review was not shown the instruction its producer was sent').toContain(d.instruction);
	});

	it('⛔ RED FIRST — a leaf’s declared review at sign-off rebuilds the instruction its producer was sent, byte for byte', async () => {
		const d = await designReady([DECLARED_POLICY]);
		seam.turns.length = 0;
		expect((await press(d.u, 'beginExecute', { pwuId: d.design.id })).error, 'arrangement: the Technical Design ran').toBeUndefined();
		expect(seam.turns[0], 'the unit was not sent the section, last, after its output contract').toBe(d.instruction);
		seam.prompts.length = 0;

		expect((await press(d.u, 'recordAssurance', { pwuId: d.design.id })).error, 'arrangement: its declared review ran').toBeUndefined();

		const declared = seam.prompts.filter(isDeclaredReview);
		expect(declared, 'arrangement: one declared review').toHaveLength(1);
		expect(declared[0], 'the declared review was not shown the instruction its producer was sent').toContain(d.instruction);
	});
});
