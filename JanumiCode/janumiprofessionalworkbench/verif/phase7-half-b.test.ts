// ⭐⭐ `JAN-EXEC` Phase 7 completion programme, package E3 — HALF B, THE AUTHORING HALF, HELD WHERE THE GATE CAN SEE IT
// (`docs/_working/DESIGN-phase-7-completion.md` §4 C1 to C6; `REG-D-109`, `REG-D-110` (1) and (4); the run plan's P7-7,
// `docs/_working/DESIGN-the-live-end-to-end-run.md` §6).
//
// Half B is paid and never runs in the gate: the live authoring agent builds the PWA from a request, a person's acceptance
// of the exact candidate is pressed, and the PWA is published and run as in P3. So this file DRIVES what the lane does in
// half B on hands made here — no browser, no server and no model — and holds each rule the design gives it:
//   · C1 — the order: the draft created, the request sent, the candidate's status waited on through the store, "Accept
//     exact candidate" pressed, then Submit, Validate and Publish, then the Undertaking; and what the lane records — the
//     candidate's hash, the floor's dispositions, the author's model;
//   · C2 — the units READ FROM THE PUBLISHED PWA, root first and then the tree's order, never §3.2's hand-typed five;
//   · C3 — an authoring allowance, folded into the timeout, and the author's model REQUIRED and recorded;
//   · C4 — the candidate checks, which RECORD AND REPORT and refuse nothing (`REG-D-110` (4): *"Name wordfreq; measure
//     traps"*);
//   · C5 — the run report: stage 1 measured, a per-unit check that a model ran, the checks' findings beside the units;
//   · C6 — the dry rehearsal stops before Send: authoring is a model call.
// ⛔ NO PROGRAM IS RUN HERE, and nothing stipulates: the gate's own rehearsal of the turn, with the mock agent, is
// `apps/rph-demo/e2e/phase7-half-b.e2e.ts` (`REG-F-477`: stipulations live under `e2e/`, never `e2e-live/`).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { policyApplicability } from '@janumipwb/rph-domain';
import { OUTSIDE_INPUT, readinessUnitOf, startReadiness, unitDependencies } from '@janumipwb/rph-projections';
import { createSqliteDriver, SCHEMA_SQL } from '@janumipwb/rph-persistence';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import type { EngineSnapshot, ObjectRow } from '../apps/rph-demo/e2e/support/harness.js';
import {
	AUTHORING_REVIEW_ALLOWANCE_VARIABLE,
	EXECUTE_TIMEOUT_MS,
	LANE_BUDGET,
	laneKeysRefusal,
	NODE_TIMER_CEILING_MS,
	phase7Half,
	phase7AuthoringAllowanceMs,
	phase7AuthoringMs,
	phase7AuthoringReviewAllowance,
	phase7AuthoringReviewerCalls,
	phase7HalfBAuthoringTimeoutMs,
	phase7HalfBTestTimeoutMs,
	PHASE7_AUTHORING_FLOOR_RUNS,
	PHASE7_CANDIDATE_POLL_MS,
	PHASE7_DESIGNER_ACTS,
	PHASE7_INTROSPECT_MS,
	PHASE7_MODEL_UNITS,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PER_PHASE_MS,
	PHASE7_SETUP_MS,
	PHASE7_SIGN_OFF_MS,
	PHASE7_SIGN_OFF_UNIT_MS,
	PHASE7_TEST_TIMEOUT_MS,
	PHASE7_UI_MS,
	PHASE7_UNIT_RUN_MS
} from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import {
	acceptedHashOf,
	bootOf,
	candidateOf,
	COUNTED_AHEAD,
	DESIGNER_ACTS,
	laneVerdict,
	openLane,
	overlayOf,
	producerOfStream,
	runTheLane,
	typeUnreadableOf,
	withheldUnitsOf,
	type ActionOutcome,
	type Boot,
	type Dump,
	type LaneHands,
	type LanePaths,
	type RecoveryOffers,
	type RunRecord,
	type StartOffer
} from '../apps/rph-demo/e2e-live-exec/phase7-operator.js';
import {
	candidateChecks,
	CHECK_REGISTER_IDS,
	governanceOf
} from '../scripts/phase7/candidate-checks.js';
import {
	AUTHORING_FLOOR_POLICIES,
	correlationsOf,
	floorDispositions,
	identityOf,
	PHASE7_HALF_B_DRAFT,
	PHASE7_HALF_B_REQUEST,
	PHASE7_RUN_PLAN_REQUEST,
	slugOf,
	treeAgainstPlan,
	TURN_SETTLED,
	unitsInTreeOrder
} from '../scripts/phase7/half-b.js';
import { PHASE7_INSTRUCTION_BUDGET, PHASE7_PWA, PRODUCT_BRIEF } from '../scripts/phase7/pwa-content.js';
import { archiveAuthoring, AUTHORING_ARCHIVE, CONTENT_STORE_SUFFIX, journalHeaderOf } from '../scripts/phase7/run-archive.js';
import {
	buildRunReport,
	FLOOR_POLICIES,
	HALF_B_CAVEATS,
	renderMarkdown,
	SEND_COUNTED_THE_ALLOWANCE,
	type LaneRows,
	type MatrixCell,
	type RunReport,
	type StoredContent,
	type StoredEvent,
	type StoredObject,
	type StoreRows
} from '../scripts/phase7/run-report-core.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-p7-half-b-'));
afterAll(() => rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

let seq = 0;
/** A fresh folder of this file's own. */
const folder = (label: string): string => {
	const dir = join(ROOT, `${label}-${++seq}`);
	mkdirSync(dir, { recursive: true });
	return dir;
};

// ── THE AGENT'S PWA, AS A STORE WOULD HOLD IT ONCE ACCEPTED ─────────────────────────────────────────────────────────
// ⭑ NOT §3.2's five: other names, other kinds, a different order of definition, and three of the traps the candidate
// checks measure (C4) — a leaf whose discharge is UNDECLARED (`REG-F-505`), a prompt that uses `{criteria}`, which no work
// unit supplies (`REG-F-508`), and a policy scoped to another kind (`REG-F-524`).

const PWA_ID = 'pwa_agent';
const AGENT_POLICIES: ObjectRow[] = [
	{
		id: 'pol_intent_preservation',
		state: { name: 'Intent preservation', status: 'ACTIVE', applicability: { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] } }
	},
	{
		id: 'pol_requirement_coverage',
		state: {
			name: 'Requirement coverage',
			status: 'ACTIVE',
			applicability: { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], pwuKindConditions: ['REQUIREMENT_DEFINITION'] }
		}
	}
];
const prompt = (templateText: string, status = 'ACTIVE') => ({
	templateText,
	status,
	declaredPlaceholders: [...templateText.matchAll(/\{([A-Za-z]\w*)\}/g)].map((m) => m[1]),
	outputContract: 'A JSON object whose workProduct holds every file written, in full.'
});
/** The agent's types, IN THE ORDER IT DEFINED THEM — the children before the root, and not in the tree's order. */
const AGENT_TYPES: ObjectRow[] = [
	{
		id: 'pwutype_verify',
		state: {
			pwaId: PWA_ID,
			name: 'Verify wordfreq end to end',
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			purpose: 'Run the real tool against its acceptance scenarios.',
			workDischarge: 'UNDECLARED',
			isRoot: false,
			permittedChildTypeIds: [],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	},
	{
		id: 'pwutype_specify',
		state: {
			pwaId: PWA_ID,
			name: 'Specify wordfreq',
			pwuKind: 'REQUIREMENT_DEFINITION',
			purpose: 'Write the numbered requirements of wordfreq.',
			workDischarge: 'MODEL',
			isRoot: false,
			permittedChildTypeIds: [],
			promptTemplate: prompt('Write {subject} for wordfreq: {purpose}'),
			requiredAssurancePolicyIds: ['pol_requirement_coverage', 'pol_intent_preservation'],
			status: 'ACTIVE'
		}
	},
	{
		id: 'pwutype_build',
		state: {
			pwaId: PWA_ID,
			name: 'Build wordfreq',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			purpose: 'Implement wordfreq and its unit tests.',
			workDischarge: 'MODEL',
			isRoot: false,
			permittedChildTypeIds: [],
			promptTemplate: prompt('Implement {subject} against {criteria}.'),
			requiredAssurancePolicyIds: ['pol_requirement_coverage'],
			status: 'ACTIVE'
		}
	},
	{
		id: 'pwutype_root',
		state: {
			pwaId: PWA_ID,
			name: 'wordfreq Realization',
			pwuKind: 'PRODUCT_REALIZATION',
			purpose: 'Realize wordfreq from its requirements to its verification.',
			workDischarge: 'HUMAN',
			isRoot: true,
			// ⭑ THE TREE'S ORDER: specify, build, verify — not the order the types were defined in.
			permittedChildTypeIds: ['pwutype_specify', 'pwutype_build', 'pwutype_verify'],
			permittedChildren: [
				{ typeId: 'pwutype_specify', cardinality: 'M1' },
				{ typeId: 'pwutype_build', cardinality: 'M1' },
				{ typeId: 'pwutype_verify', cardinality: 'M1' }
			],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	}
];
/** One unit instantiation built: its id, its type, its title (its type's name) and its parent unit. */
interface AgentUnit {
	readonly id: string;
	readonly typeId: string;
	readonly title: string;
	readonly parent: string | null;
	/**
	 * ⭐ The merge of E12 and E3 (J1) — the unit's OWN `assurancePolicyIds` where they differ from its type's: instantiation
	 * copies the type's `requiredAssurancePolicyIds` (`routes/undertakings/+page.server.ts`), and the store reads that copy
	 * unless said.
	 */
	readonly policies?: readonly string[];
}
/** The units instantiation built, AS THE STORE LISTS THEM — scrambled here, so only the tree can order them. */
const AGENT_UNITS: readonly AgentUnit[] = [
	{ id: 'pwu_v', typeId: 'pwutype_verify', title: 'Verify wordfreq end to end', parent: 'pwu_r' },
	{ id: 'pwu_r', typeId: 'pwutype_root', title: 'wordfreq Realization', parent: null },
	{ id: 'pwu_b', typeId: 'pwutype_build', title: 'Build wordfreq', parent: 'pwu_r' },
	{ id: 'pwu_s', typeId: 'pwutype_specify', title: 'Specify wordfreq', parent: 'pwu_r' }
];
/** The order a correct lane presses them in: the root, then the tree's order. */
const TREE_ORDER = ['root', 'specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end'];

/**
 * ⭐ `REG-D-112` (E3's review, findings 3 to 5) — A THREE-LEVEL TREE WHOSE LEAF TYPE TWO PARENTS SHARE: the root over
 * "Design wordfreq" and "Build wordfreq", each a COMPOSITE that runs no model (HUMAN) and permits "Review wordfreq", a MODEL
 * leaf with an ACTIVE prompt. Instantiation (`planComposition`) builds the leaf ONCE UNDER EACH PARENT, so the Undertaking
 * holds two units of one type — and of one title, which instantiation copies from the type's name.
 */
const SHARED_TYPES: ObjectRow[] = [
	{
		id: 'pwutype_s_review',
		state: {
			pwaId: PWA_ID,
			name: 'Review wordfreq',
			pwuKind: 'DESIGN_REVIEW',
			purpose: 'Review the work of the phase above it.',
			workDischarge: 'MODEL',
			isRoot: false,
			permittedChildTypeIds: [],
			promptTemplate: prompt('Review {subject} for wordfreq: {purpose}'),
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	},
	...[
		['pwutype_s_design', 'Design wordfreq', 'SOLUTION_DESIGN'],
		['pwutype_s_build', 'Build wordfreq', 'PRODUCT_IMPLEMENTATION']
	].map(([id, name, pwuKind]) => ({
		id: id!,
		state: {
			pwaId: PWA_ID,
			name,
			pwuKind,
			purpose: `${name}, through the review beneath it.`,
			workDischarge: 'HUMAN',
			isRoot: false,
			permittedChildTypeIds: ['pwutype_s_review'],
			permittedChildren: [{ typeId: 'pwutype_s_review', cardinality: 'M1' }],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	})),
	{
		id: 'pwutype_s_root',
		state: {
			pwaId: PWA_ID,
			name: 'wordfreq Realization',
			pwuKind: 'PRODUCT_REALIZATION',
			purpose: 'Realize wordfreq.',
			workDischarge: 'HUMAN',
			isRoot: true,
			permittedChildTypeIds: ['pwutype_s_design', 'pwutype_s_build'],
			permittedChildren: [
				{ typeId: 'pwutype_s_design', cardinality: 'M1' },
				{ typeId: 'pwutype_s_build', cardinality: 'M1' }
			],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	}
];
/** The shared tree's units, as the store lists them: the two reviews share a title, and are told apart only by id. */
const SHARED_UNITS: readonly AgentUnit[] = [
	{ id: 'pwu_rv_b', typeId: 'pwutype_s_review', title: 'Review wordfreq', parent: 'pwu_sb' },
	{ id: 'pwu_sr', typeId: 'pwutype_s_root', title: 'wordfreq Realization', parent: null },
	{ id: 'pwu_sd', typeId: 'pwutype_s_design', title: 'Design wordfreq', parent: 'pwu_sr' },
	{ id: 'pwu_sb', typeId: 'pwutype_s_build', title: 'Build wordfreq', parent: 'pwu_sr' },
	{ id: 'pwu_rv_d', typeId: 'pwutype_s_review', title: 'Review wordfreq', parent: 'pwu_sd' }
];
/** The shared tree's order — the root, then depth first — each slug with the unit it names. */
const SHARED_ORDER: readonly (readonly [string, string])[] = [
	['root', 'pwu_sr'],
	['design-wordfreq', 'pwu_sd'],
	['review-wordfreq', 'pwu_rv_d'],
	['build-wordfreq', 'pwu_sb'],
	['review-wordfreq-2', 'pwu_rv_b']
];
/** ⭐ `REG-D-112` (finding 2) — the agent's PWA with a root that declares MODEL, an ACTIVE prompt: its press runs a model. */
const MODEL_ROOT_TYPES: ObjectRow[] = AGENT_TYPES.map((t) =>
	t.state.isRoot === true
		? { id: t.id, state: { ...t.state, workDischarge: 'MODEL', promptTemplate: prompt('Realize {subject}: {purpose}') } }
		: t
);
/**
 * ⭐ The review in parts, B6 — a candidate of SIXTEEN types, run-11's count (`REG-F-571`) ~~and the inventory the lane anticipates
 * before Send (`PHASE7_AUTHORING_ANTICIPATED_PARTS`)~~ ⛔ (package L2, D20: Send counts the allowance it hands the authoring
 * review, and no inventory is anticipated): the shape of each is immaterial to the wait, which counts them.
 */
/** Sixteen parts, run-11's count — what these arrangements have the authoring floor's worst case be, where they stage it. */
const SIXTEEN = 16;
const SIXTEEN_TYPES: ObjectRow[] = Array.from({ length: 16 }, (_, i) => ({
	id: `pwutype_part_${i + 1}`,
	state: { pwaId: PWA_ID, name: `Part ${i + 1}`, pwuKind: 'PRODUCT_IMPLEMENTATION', isRoot: i === 0, permittedChildTypeIds: [], status: 'ACTIVE' }
}));
const CANDIDATE_HASH = `sha256:${'ab'.repeat(32)}`;
const AUTHOR = { providerId: 'openai-codex', modelId: 'gpt-5.6-sol' };
const REVIEWER = { providerId: 'devin', modelId: 'glm-5-3-flash-max' };
/** The authoring floor's three assessments of the candidate, as the turn's fork holds them. */
const FLOOR_OF_THE_CANDIDATE: ObjectRow[] = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
].map((policyId, i) => ({
	id: `asm_floor_${i}`,
	state: {
		assurancePolicyId: policyId,
		subjectObjectIds: [PWA_ID],
		assessmentState: 'SATISFIED',
		...(policyId === 'floor.reasoning-review'
			? { evaluator: { actorId: 'reviewer', actorType: 'AGENT', displayName: 'devin', ...REVIEWER } }
			: {})
	}
}));

/**
 * ⭐ The review in parts, B3 (`REG-D-125`) — the same floor as the turn's fork holds it now: the PWA's two deterministic
 * assessments, and a Reasoning Review of each of `types`, each under its type, as the authoring floor records it.
 */
const floorOfTheCandidate = (types: readonly ObjectRow[]): ObjectRow[] => [
	...FLOOR_OF_THE_CANDIDATE.filter((a) => a.state.assurancePolicyId !== 'floor.reasoning-review'),
	...types.map((t, i) => ({
		id: `asm_floor_part_${i}`,
		state: { ...FLOOR_OF_THE_CANDIDATE[2]!.state, subjectObjectIds: [t.id] }
	}))
];

const answered = (envelopeType: string, data = '[{}]'): ActionOutcome => ({
	status: 200,
	envelopeType: envelopeType as ActionOutcome['envelopeType'],
	rawBody: JSON.stringify({ type: envelopeType, status: 200, data }),
	decoded: {},
	timedOutAfterMs: null,
	requestFailure: null
});
/** The acceptance as SvelteKit answers it: `{ acceptedCandidate }`, devalue-flattened, and decoded by `actionFields`. */
const ACCEPTED: ActionOutcome = {
	...answered('success', `[{"acceptedCandidate":1},"${CANDIDATE_HASH}"]`),
	decoded: { acceptedCandidate: CANDIDATE_HASH }
};
const COMPLETED = { lifecycleState: 'EXECUTING', executionState: 'SUCCEEDED', assuranceState: 'UNASSESSED', planStepState: 'SUCCEEDED' };
/** ⭐ Package M (D6) — a unit whose Record Assurance was accepted, and one then Marked Satisfied: ACCEPTED, so its consumers start. */
const ASSURED_B = { lifecycleState: 'UNDER_ASSURANCE', executionState: 'SUCCEEDED', assuranceState: 'SATISFIED', planStepState: 'SUCCEEDED' };
const SATISFIED_B = { lifecycleState: 'SATISFIED', executionState: 'SUCCEEDED', assuranceState: 'SATISFIED', planStepState: 'SUCCEEDED' };
/** ⭐ R4 (the lead's round-4 item 6) — a unit whose press was refused, as the store reads it: waiting for a person (RD2). */
const WAITING = { lifecycleState: 'EXECUTING', executionState: 'WAITING', assuranceState: 'UNASSESSED', planStepState: 'WAITING' };

interface HalfBScript {
	readonly paid: boolean;
	/** The candidate's status at each read after Send, the last repeated; READY_TO_COMMIT unless said. */
	readonly statuses?: readonly string[];
	/** What "Accept exact candidate" came to; accepted, naming the hash, unless said. */
	readonly accept?: ActionOutcome;
	/** What each designer act came to, by its form action; accepted unless said. */
	readonly lifecycle?: Readonly<Record<string, ActionOutcome>>;
	/** No candidate is ever staged: the server refused the turn before it began. */
	readonly noCandidate?: boolean;
	/** Why the turn stopped, in the floor's words, on a candidate that is not READY_TO_COMMIT. */
	readonly detail?: string;
	/** What the store reads the PWA after an accepted Publish; PUBLISHED unless said. */
	readonly published?: string;
	/** ⭐ `REG-D-112` (finding 2) — the reviewer calls spent before the run (D8); none unless said. */
	readonly prior?: number;
	/** ⭐ `REG-D-112` — the agent's types, and the units instantiation built of them; `AGENT_TYPES`, `AGENT_UNITS` unless said. */
	readonly types?: readonly ObjectRow[];
	readonly units?: readonly AgentUnit[];
	/** ⭐ `REG-D-112` (finding 1) — what the authoring archive does beyond being logged: nothing unless said. */
	readonly archive?: (dump: Dump, lane: LanePaths) => Promise<void>;
	/** ⭐ `REG-D-112` (finding 1) — "Accept exact candidate" throws, as a page that lost its button would. */
	readonly acceptThrows?: boolean;
	/** ⭐ `REG-D-112` (E3's re-review, finding 4) — the ASSURANCE exchanges the authoring floor records once Send is pressed. */
	readonly floorCalls?: number;
	/**
	 * ⭐ Package L2 — D20 — ASSURANCE exchanges the store records from the start, before Send: none in a real half B, which presses
	 * Send first; here, so Send's check is seen to count the calls already recorded beside the allowance it hands over.
	 */
	readonly recordedBeforeSend?: number;
	/**
	 * ⭐ The review in parts, B6 — the types the candidate holds at each read after Send, the last repeated: the inventory
	 * the turn has staged so far. `types` at every read unless said.
	 */
	readonly staged?: readonly (readonly ObjectRow[])[];
	/**
	 * ⭐ B6 — the candidate's floor as its fork holds it, with the candidate's own completions, each under its round's token;
	 * one round of `floorOfTheCandidate` over the staged types, with none, unless said.
	 */
	readonly candidateFloor?: {
		readonly assessments: readonly ObjectRow[];
		readonly completionEvents: readonly Record<string, unknown>[];
	};
	/**
	 * ⭐ R3-B's fix round (F1) — the ASSURANCE exchanges a unit's Begin & Execute records, by the unit's id; none unless said.
	 * ~~Each phase's check counts its worst case now, so a run that reaches its sign-offs near the limit spends there in a
	 * phase.~~ ~~⭐ Each phase's check counts one try's reserve (`REG-D-114` (14), as amended 2026-10-16): a phase's own spend.~~
	 * ⭐ Package L — D16 (`REG-D-135` (4)): each press's check counts its whole worst case; this is what the press then spends.
	 */
	readonly unitCalls?: Readonly<Record<string, number>>;
	/**
	 * ⭐ R4 (the lead's round-4 item 6) — units whose Begin & Execute is REFUSED, by id: the store then reads each WAITING, and
	 * its row offers the run plan's rule what is given. Every other unit's press is accepted, as before.
	 */
	readonly stops?: Readonly<Record<string, RecoveryOffers>>;
	/**
	 * ⭐ The merge of E12 and E3 (J1, J2) — each unit's sign-off, by its slug: what Record Assurance came to, and whether the
	 * row then offers re-running the declared reviews that did not conclude (`REG-D-112` (a)) and what that came to. A unit
	 * not named here offers no Record Assurance, as before.
	 */
	readonly signOffs?: Readonly<
		Record<
			string,
			{
				readonly ra: ActionOutcome;
				readonly rerun?: { readonly offered: boolean; readonly outcome?: ActionOutcome };
				/** ⭐ Package M (D6) — the ASSURANCE exchanges its Record Assurance records; none unless said. */
				readonly calls?: number;
			}
		>
	>;
}

/**
 * ⭐ `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D6) — EVERY UNIT'S SIGN-OFF ACCEPTED, by slug: each child is then
 * ACCEPTED, so the units that wait for it — the root last — are offered. ⛔ Before package M the root was pressed first, whatever
 * its children came to, so no case needed its children signed off to reach it.
 */
const signedOff = (slugs: readonly string[]): HalfBScript['signOffs'] =>
	Object.fromEntries(slugs.map((slug) => [slug, { ra: answered('success') }]));
/** The agent's four units, every one signed off. */
const ALL_SIGNED_OFF = signedOff(['root', 'specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end']);

/** A run folder of its own, a store made here, and the half-B hands, each call logged in order. */
function halfBLane(script: HalfBScript) {
	const lane = openLane(folder('lane'));
	const types = script.types ?? AGENT_TYPES;
	const units = script.units ?? AGENT_UNITS;
	const calls: string[] = [];
	const timeouts: number[] = [];
	/** ⭐ R3-B F2 — each sign-off press the lane asked for, and the bound it gave it. */
	const bounds: [string, number | undefined][] = [];
	let clock = 0;
	let readsAfterSend = 0;
	let sent = false;
	let accepted = false;
	let status = 'DRAFT';
	let undertaking = false;
	let unitCallCount = 0;
	const pressed = new Map<string, typeof COMPLETED>();
	const statusAt = (n: number) => {
		const list = script.statuses ?? ['COLLECTING', 'ASSURING', 'READY_TO_COMMIT'];
		return list[Math.min(n, list.length) - 1] ?? 'READY_TO_COMMIT';
	};
	const stagedAt = (n: number): readonly ObjectRow[] => {
		const list = script.staged ?? [types];
		return list[Math.min(n, list.length) - 1] ?? types;
	};
	// ⭐ Package M (`REG-D-135` (2); design D1) — WHAT INSTANTIATION RECORDS of the agent's PWA, by the product's own projection
	// (`unitDependencies`): each unit's producers and children, and the inputs nothing produces — over the units in the order
	// instantiation's plan makes them, the tree's (`unitsInTreeOrder`), never the store's listing.
	const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
	const planned = unitsInTreeOrder(
		units.map((u) => ({
			id: u.id,
			state: { title: u.title, pwuTypeId: u.typeId, ...(u.parent === null ? {} : { parentWorkUnitId: u.parent }) }
		})),
		types
	).units;
	const recorded = unitDependencies(
		types.map((t) => ({ id: t.id, requiredInputs: strs(t.state.requiredInputs), requiredOutputs: strs(t.state.requiredOutputs) })),
		planned.map((u) =>
			u.parentUnitId === null ? { id: u.unitId, typeId: u.typeId } : { id: u.unitId, typeId: u.typeId, parentId: u.parentUnitId }
		)
	);
	const recordOf = new Map(recorded.units.map((r) => [r.unitId, r]));
	const snapshot = (): EngineSnapshot => {
		const candidateStatus = sent && !accepted && script.noCandidate !== true ? statusAt(readsAfterSend) : null;
		return {
			pwas: [{ id: PWA_ID, state: { name: 'CLI Product Realization', publicationStatus: status } }],
			pwuTypes: accepted ? types : [],
			assurancePolicies: AGENT_POLICIES,
			assessments: accepted ? FLOOR_OF_THE_CANDIDATE : [],
			undertakings: undertaking ? [{ id: 'und_1', state: { name: 'wordfreq realization' } }] : [],
			pwus: undertaking
				? units.map((u) => {
						const s = pressed.get(u.id);
						return {
							id: u.id,
							state: {
								objectType: 'PROFESSIONAL_WORK_UNIT',
								title: u.title,
								undertakingId: 'und_1',
								pwuTypeId: u.typeId,
								...(u.parent === null ? {} : { parentWorkUnitId: u.parent }),
								dependencyIds: recordOf.get(u.id)?.dependencyIds ?? [],
								// ⭐ Package O (D21) — as instantiation records them now: ~~`UNPRODUCED_INPUT`~~ expected from outside (`OUTSIDE_INPUT`).
								inputRequirements: (recordOf.get(u.id)?.unproduced ?? []).map((name) => ({ name, status: OUTSIDE_INPUT })),
								// ⭐ J1 — as instantiation copies them: the type's `requiredAssurancePolicyIds`, unless the unit says.
								assurancePolicyIds:
									u.policies ??
									(types.find((t) => t.id === u.typeId)?.state.requiredAssurancePolicyIds as string[] | undefined) ??
									[],
								workLifecycleState: s?.lifecycleState ?? 'PROPOSED',
								executionState: s?.executionState ?? 'NOT_STARTED',
								assuranceState: s?.assuranceState ?? 'UNASSESSED'
							}
						};
					})
				: [],
			executionPlans: [...pressed].map(([id, s]) => ({
				id: `pln_${id}`,
				state: { workUnitId: id, steps: [{ stepState: s.planStepState }] }
			})),
			// ⭐ `REG-D-112` (E3's re-review, finding 4) — the authoring floor's calls, recorded once Send is pressed. ⭐ R3-B's
			// fix round (F1) — and each pressed unit's (`unitCalls`).
			modelExchanges: [
				// ⭐ Package L2 — D20 — calls the store records before Send (`recordedBeforeSend`), which Send's check counts.
				...Array.from({ length: script.recordedBeforeSend ?? 0 }, (_, i) => ({
					id: `mex_before_${i}`,
					state: { plane: 'ASSURANCE' }
				})),
				...(sent
					? Array.from({ length: script.floorCalls ?? 0 }, (_, i) => ({
							id: `mex_floor_${i}`,
							state: { plane: 'ASSURANCE', subjectObjectId: PWA_ID }
						}))
					: []),
				...Array.from({ length: unitCallCount }, (_, i) => ({ id: `mex_unit_${i}`, state: { plane: 'ASSURANCE' } }))
			],
			evidence: [],
			artifacts: [],
			authoringCandidates:
				candidateStatus === null
					? []
					: [
							{
								pwaId: PWA_ID,
								summary: {
									status: candidateStatus,
									...(candidateStatus === 'READY_TO_COMMIT' ? { candidateHash: CANDIDATE_HASH } : {}),
									...(script.detail === undefined ? {} : { detail: script.detail }),
									commandCount: 9
								},
								pwuTypes: stagedAt(readsAfterSend),
								assessments: script.candidateFloor?.assessments ?? floorOfTheCandidate(stagedAt(readsAfterSend)),
								conversations: [],
								criterionEvents: [],
								completionEvents: script.candidateFloor?.completionEvents ?? []
							}
						]
		} as unknown as EngineSnapshot;
	};
	const hands: LaneHands = {
		// ⛔ HALF A's SETUP — the hand-typed PWA. Half B never calls it; today's lane did, and read the agent's units as
		// §3.2's: the store's units are returned, so a lane that calls it meets them exactly as it would after typing.
		setUp: async () => {
			calls.push('setUp');
			undertaking = true;
			return new Map(units.map((u) => [u.title, { id: u.id, state: { undertakingId: 'und_1' } }]));
		},
		beginExecute: async (unit) => {
			calls.push(`beginExecute ${unit.slug}`);
			const stopped = script.stops?.[unit.unitId!] !== undefined;
			pressed.set(unit.unitId!, stopped ? WAITING : COMPLETED);
			unitCallCount += script.unitCalls?.[unit.unitId!] ?? 0;
			return answered(stopped ? 'failure' : 'success');
		},
		showOverview: async () => void calls.push('showOverview'),
		// ⭐ Package M (`REG-D-135` (2); design D3, D6) — THE PAGE'S OFFER, read from the rule the engine's refusal reads
		// (`startReadiness`) over this store, as the page's load reads it.
		startOffers: async (asked) => {
			calls.push('startOffers');
			const snap = snapshot();
			const lookup = (id: string) => readinessUnitOf(id, snap.pwus.find((p) => p.id === id)?.state);
			return new Map(
				asked.map((u): [string, StartOffer] => {
					if (lookup(u.unitId!)?.workLifecycleState !== 'PROPOSED') return [u.unitId!, { offered: false, reason: null, kinds: [] }];
					const r = startReadiness(u.unitId!, lookup);
					return [u.unitId!, { offered: r.startable, reason: r.reason, kinds: r.kinds }];
				})
			);
		},
		recordAssurance: async (unit, timeoutMs) => {
			calls.push(`recordAssurance ${unit.slug}`);
			bounds.push([`recordAssurance ${unit.slug}`, timeoutMs]);
			const ra = script.signOffs?.[unit.slug]?.ra ?? null;
			// ⭐ Package M (D6) — an accepted Record Assurance moves the unit under assurance, as the store would read it.
			if (ra?.envelopeType === 'success') pressed.set(unit.unitId!, ASSURED_B);
			unitCallCount += ra === null ? 0 : (script.signOffs?.[unit.slug]?.calls ?? 0);
			return ra;
		},
		// ⭐ The merge of E12 and E3 — E12's sign-off hands, which the lane calls since a sign-off asks the reviewer: a row
		// offers Record Assurance only where the script signs its unit off (`recordAssurance` above), and a re-run of its
		// declared reviews only where the script offers one.
		recordAssuranceOffered: async (unit) => {
			calls.push(`offersRecordAssurance ${unit.slug}`);
			return script.signOffs?.[unit.slug] !== undefined;
		},
		declaredRerunOffered: async (unit) => {
			calls.push(`offersDeclaredRerun ${unit.slug}`);
			return script.signOffs?.[unit.slug]?.rerun?.offered === true;
		},
		rerunDeclared: async (unit, timeoutMs) => {
			calls.push(`rerunDeclared ${unit.slug}`);
			bounds.push([`rerunDeclared ${unit.slug}`, timeoutMs]);
			const outcome = script.signOffs?.[unit.slug]?.rerun?.outcome;
			if (outcome === undefined) throw new Error('nothing re-runs its declared reviews here');
			return outcome;
		},
		markSatisfied: async (unit) => {
			calls.push(`markSatisfied ${unit.slug}`);
			// ⭐ Package M (D6) — and Mark Satisfied ACCEPTS it: the units that wait for it are offered next.
			pressed.set(unit.unitId!, SATISFIED_B);
			return answered('success');
		},
		recoveryOffers: async (unit) => script.stops?.[unit.unitId!] ?? { rerunReview: false, rerunWork: false, abandon: false },
		recover: async () => {
			throw new Error('nothing stops here');
		},
		read: async () => {
			calls.push('read');
			if (sent) readsAfterSend += 1;
			const snap = snapshot();
			return { text: JSON.stringify(snap), snapshot: snap };
		},
		archive: async (call) => {
			calls.push(`archive ${call.name}`);
			return [];
		},
		// ⭐ `REG-D-112` (finding 1) — the authoring's archive, logged, and taken as the script says.
		archiveAuthoring: async (dump: Dump) => {
			calls.push('archiveAuthoring');
			await script.archive?.(dump, lane);
		},
		screenshot: async () => null,
		author: {
			createDraft: async () => {
				calls.push('author.createDraft');
				return PWA_ID;
			},
			send: async (request) => {
				calls.push('author.send');
				expect(request, 'the lane sent no request').not.toBe('');
				sent = true;
			},
			// ⭐ C3 — the producer the page's turn named: the store records none.
			producerLine: async () => {
				calls.push('author.producerLine');
				return `${AUTHOR.providerId}/${AUTHOR.modelId}`;
			},
			turnRunning: async () => {
				calls.push('author.turnRunning');
				return script.noCandidate === true ? false : !TERMINAL.has(statusAt(readsAfterSend));
			},
			accept: async () => {
				calls.push('author.accept');
				if (script.acceptThrows === true) throw new Error('locator.click: Timeout 120000ms exceeded.');
				const outcome = script.accept ?? ACCEPTED;
				if (outcome.envelopeType === 'success') accepted = true;
				return outcome;
			},
			lifecycle: async (act) => {
				calls.push(`author.${act}`);
				const outcome = script.lifecycle?.[act] ?? answered('success');
				if (outcome.envelopeType === 'success')
					status = { submitForReview: 'UNDER_REVIEW', validate: 'VALIDATED', publish: script.published ?? 'PUBLISHED' }[act];
				return outcome;
			},
			createUndertaking: async () => {
				calls.push('author.createUndertaking');
				undertaking = true;
			},
			pause: async (ms) => {
				calls.push(`author.pause ${ms}`);
				clock += ms;
			},
			now: () => clock
		},
		extendTimeout: (ms) => void timeouts.push(ms)
	} as LaneHands;
	const boot: Boot = {
		record: {
			startedAt: '2026-10-11T00:00:00.000Z',
			mode: script.paid ? 'paid' : 'dry',
			half: 'B',
			authorModel: `${AUTHOR.providerId}/${AUTHOR.modelId}`,
			node: process.version,
			inherited: {},
			overlay: overlayOf(undefined),
			readiness: null,
			priorReviewerCalls: script.prior ?? 0,
			refusals: []
		},
		refusals: [],
		prior: script.prior ?? 0
	} as Boot;
	return {
		run: () => runTheLane({ boot, lane, hands, flushPosts: () => void calls.push('flushPosts') }),
		calls,
		timeouts,
		bounds,
		/** The calls of these kinds, in order. */
		only: (...kinds: string[]) => calls.filter((c) => kinds.some((k) => c.startsWith(k))),
		lane,
		written: (): RunRecord => JSON.parse(readFileSync(lane.run, 'utf8')) as RunRecord,
		action: (name: string) => existsSync(join(lane.actions, `${name}.json`))
	};
}
const TERMINAL = new Set(['READY_TO_COMMIT', 'REVISION_REQUIRED', 'BLOCKED_EXTERNAL']);

describe('⭐⭐ C1, C2 — HALF B, IN ITS ORDER: `runTheLane` on hands made here (DESIGN-phase-7-completion.md §4)', () => {
	// ⭐ THE ROADMAP'S PREDICTED RED for E3 (`ROADMAP-undertaking-execution-sandbox.md` §9, *"a run whose hands return other
	// unit titles proceeds (today refused)"*): the lane held a run to §3.2's five hand-typed titles
	// (`phase7-operator.ts`, *"instantiation did not build one unit per type"*), so an agent-authored PWA — whose types
	// are the agent's — could never be pressed.
	// ⛔ MOVED 2026-10-25 (`JAN-EXEC` Phase 7, package M; `REG-D-135` (2); design D6, which names it) — ~~"each pressed, the root
	// first, then the tree's order"~~ (`TREE_ORDER`: root, specify, build, verify): the lane presses what the page offers, and
	// the agent's root waits for its three children, so it is pressed LAST, once each is signed off.
	it('⭐ C2 — a half-B run whose units are the AGENT’s, not §3.2’s five, proceeds: each pressed in the order the page offers — the children in the tree’s order, each signed off, then the ROOT LAST', async () => {
		const l = halfBLane({ paid: true, signOffs: ALL_SIGNED_OFF });
		const record = await l.run();
		expect(l.only('beginExecute')).toEqual([...TREE_ORDER.slice(1), 'root'].map((s) => `beginExecute ${s}`));
		expect(record.order?.pressed).toEqual([...TREE_ORDER.slice(1), 'root']);
		expect(record.units.map((u) => [u.order, u.slug, u.title, u.unitId])).toEqual([
			[1, 'root', 'wordfreq Realization', 'pwu_r'],
			[2, 'specify-wordfreq', 'Specify wordfreq', 'pwu_s'],
			[3, 'build-wordfreq', 'Build wordfreq', 'pwu_b'],
			[4, 'verify-wordfreq-end-to-end', 'Verify wordfreq end to end', 'pwu_v']
		]);
		expect(record.end?.reason).toBe('complete');
	});

	// ⭐ THE ORDER C1 GIVES THE LANE: send, wait on the candidate's status, accept, submit, validate, publish — then the
	// Undertaking. ⛔ Half A's setup — the hand-typed PWA — is never called.
	it('⭐ C1 — the order: draft, Send, the candidate’s status waited on through the store, Accept, Submit, Validate, Publish, the Undertaking', async () => {
		const l = halfBLane({ paid: true });
		await l.run().catch(() => undefined);
		expect(
			l.only('setUp', 'author.', 'read', 'beginExecute root').slice(0, 21),
			'the half-B order (DESIGN-phase-7-completion.md §4 C1)'
		).toEqual([
			'author.createDraft',
			// ⭐ `REG-D-112` (finding 2) — the store read for the LIMIT, before Send.
			'read',
			'author.send',
			'read',
			'author.pause 5000',
			'read',
			'author.pause 5000',
			'read',
			// ⭐ C3 — the author, read off the page once the turn has settled: the store records none.
			'author.producerLine',
			'author.accept',
			'read',
			'author.submitForReview',
			'author.validate',
			'author.publish',
			'read',
			'author.createUndertaking',
			'read',
			// ⭐ `REG-D-112` — the store read for the authoring's ARCHIVE (finding 1), ~~then for the LIMIT before the root (2)~~.
			'read',
			// ⛔ MOVED (package M; `REG-D-135` (2); design D6, which names it): ~~'read' (the root's limit), 'beginExecute root',
			// 'read'~~ — then the store read for the ORDER, what each unit waits for (D6), and the reads before the first unit the
			// page offers: its LIMIT and its upstream. The root, waiting for its children, is pressed last (C2 above).
			'read',
			'read',
			'read'
		]);
		expect(l.only('beginExecute').at(0), 'the first press was not the first child in the tree’s order').toBe(
			'beginExecute specify-wordfreq'
		);
	});
});

// ── THE RUN REPORT OF A HALF-B RUN ──────────────────────────────────────────────────────────────────────────────────

/** The archived store of a half-B run, cut down to what stage 1 reads: the PWA, its floor, its types and units. */
function halfBStore(
	o: {
		publication?: string;
		/** The schema/invariant assessment's state, the identity/provenance one's, and each type's review's; all SATISFIED unless said. */
		floor?: readonly string[];
		/** ⭐ The review in parts, B6 — a type's review concluded otherwise, by the type's id. */
		parts?: Readonly<Record<string, string>>;
		/** ⭐ B6 — a Reasoning Review of the PWA as a whole, recorded after the round's parts, as the PWA-only floor recorded it. */
		wholePwaReview?: string;
		/** Each unit's run, by its id: `model`, an execution try answered and its step SUCCEEDED; `press`, its step
		 *  SUCCEEDED with no try — a TRANSFORMATION the press completed; absent, never begun. Each one run is signed off. */
		ran?: Readonly<Record<string, 'model' | 'press'>>;
		/** Units the Undertaking does not hold, by id: instantiation built none of them. */
		dropped?: readonly string[];
		/** ⭐ `REG-D-112` — the agent's types and units; `AGENT_TYPES`, `AGENT_UNITS` unless said. */
		types?: readonly ObjectRow[];
		units?: readonly AgentUnit[];
		/**
		 * ⭐ The merge of E12 and E3 (J5) — declared verdicts as E12's sign-off records them: under the model reviewer, each
		 * criterion of its policy evaluated (MET, or UNABLE_TO_DETERMINE where the review answered none), in the order given.
		 * Each policy is put with one BLOCKING criterion. None unless said.
		 */
		declared?: readonly {
			readonly id: string;
			readonly unit: string;
			readonly policy: string;
			readonly state: string;
			readonly at: string;
			readonly answered: boolean;
		}[];
	} = {}
): StoreRows {
	let n = 0;
	const object = (objectType: string, id: string, state: Record<string, unknown>): StoredObject => ({
		id,
		objectType,
		state,
		firstSequence: ++n
	});
	const floor = o.floor ?? ['SATISFIED', 'SATISFIED', 'SATISFIED'];
	const objects: StoredObject[] = [
		object('PROFESSIONAL_WORK_ARCHITECTURE', PWA_ID, {
			name: 'CLI Product Realization',
			publicationStatus: o.publication ?? 'PUBLISHED'
		}),
		// ⭐ The review in parts, B6 (`REG-D-125`) — the floor as a round in parts records it: the PWA's two deterministic
		// assessments, then a Reasoning Review of each type, each concluded as `floor` says of the review unless `parts` names
		// the type. ~~`FLOOR_OF_THE_CANDIDATE`, its review of the PWA as a whole~~, which a round in parts never records: one is
		// put after the parts only where `wholePwaReview` says.
		...floorOfTheCandidate(o.types ?? AGENT_TYPES).map((a, i) =>
			object('ASSURANCE_ASSESSMENT', a.id, {
				...a.state,
				assessmentState:
					a.state.assurancePolicyId === 'floor.reasoning-review'
						? (o.parts?.[(a.state.subjectObjectIds as string[])[0]!] ?? floor[2])
						: floor[i]
			})
		),
		...(o.wholePwaReview === undefined
			? []
			: [object('ASSURANCE_ASSESSMENT', 'asm_floor_whole', { ...FLOOR_OF_THE_CANDIDATE[2]!.state, assessmentState: o.wholePwaReview })]),
		...(o.types ?? AGENT_TYPES).map((t) => object('PWU_TYPE', t.id, t.state)),
		object('UNDERTAKING', 'und_1', { name: 'wordfreq realization', status: 'ACTIVE' }),
		...(o.units ?? AGENT_UNITS).filter((u) => !(o.dropped ?? []).includes(u.id)).flatMap((u) => {
			const ran = o.ran?.[u.id];
			const declared = (o.types ?? AGENT_TYPES).find((t) => t.id === u.typeId)?.state.requiredAssurancePolicyIds ?? [];
			return [
				object('PROFESSIONAL_WORK_UNIT', u.id, {
					title: u.title,
					undertakingId: 'und_1',
					pwuTypeId: u.typeId,
					// ⭐ R3-B F3 — as `halfBLane`'s store: the type's copy, unless the unit says otherwise.
					assurancePolicyIds: u.policies ?? declared,
					...(u.parent === null ? {} : { parentWorkUnitId: u.parent }),
					workLifecycleState: ran === undefined ? 'PROPOSED' : 'SATISFIED',
					executionState: ran === undefined ? 'NOT_STARTED' : 'SUCCEEDED',
					assuranceState: ran === undefined ? 'UNASSESSED' : 'SATISFIED'
				}),
				...(ran === undefined
					? []
					: [object('EXECUTION_PLAN', `plan_${u.id}`, { workUnitId: u.id, steps: [{ id: `step_${u.id}`, stepState: 'SUCCEEDED' }] })]),
				...(ran === 'model'
					? [
							object('MODEL_EXCHANGE', `mex_${u.id}`, {
								plane: 'EXECUTION',
								subjectObjectId: u.id,
								disposition: 'ACCEPTED',
								parseOutcome: { outcome: 'PARSED', detail: '' }
							})
						]
					: [])
			];
		})
	];
	const events: StoredEvent[] = [];
	const criterionOf = (policyId: string): string => `${policyId}-01`;
	for (const policyId of new Set((o.declared ?? []).map((d) => d.policy)))
		objects.push(
			object('ASSURANCE_POLICY', policyId, {
				criteria: [{ id: criterionOf(policyId), severityIfNotMet: 'BLOCKING' }]
			})
		);
	for (const d of o.declared ?? []) {
		objects.push(
			object('ASSURANCE_ASSESSMENT', d.id, {
				assurancePolicyId: d.policy,
				subjectObjectIds: [d.unit],
				assessmentState: d.state,
				updatedAt: d.at,
				evaluator: { actorId: 'devin', actorType: 'AGENT', executionInstanceId: `declared-review:${d.id}` }
			})
		);
		const emit = (eventType: string, payload: Record<string, unknown>): void =>
			void events.push({
				sequence: events.length + 1,
				eventType,
				aggregateType: 'ASSURANCE_ASSESSMENT',
				aggregateId: d.id,
				commandId: null,
				payload
			});
		emit('AssuranceCriterionEvaluated', {
			assessmentId: d.id,
			criterionId: criterionOf(d.policy),
			result: d.answered ? 'MET' : 'UNABLE_TO_DETERMINE'
		});
		emit('AssuranceAssessmentCompleted', { assessmentId: d.id, validatorId: 'reviewer.declared-policy' });
	}
	return { objects, events, content: [] };
}

/** The lane's own files of a half-B run: its record names the half, the PWA, and the hash the person accepted. */
function halfBLaneRows(
	o: {
		acceptedHash?: string | null;
		findings?: readonly unknown[];
		/** ⭐ `REG-D-112` — the agent's types and units; `AGENT_TYPES`, `AGENT_UNITS` unless said. */
		types?: readonly ObjectRow[];
		units?: readonly AgentUnit[];
		/** ⭐ `REG-D-112` (finding 6) — the author as pinned and as the turn named it; the same model unless said. */
		author?: { readonly configured: string | null; readonly resolved: string | null };
	} = {}
): LaneRows {
	const model = `${AUTHOR.providerId}/${AUTHOR.modelId}`;
	return {
		run: {
			mode: 'paid',
			half: 'B',
			units: (o.units ?? AGENT_UNITS).map((u) => ({ unitId: u.id, title: u.title })),
			end: { reason: 'complete' },
			authoring: {
				pwaId: PWA_ID,
				// ⭐ `REG-D-112` (finding 7) — a paid run SENT its request, as the lane records it.
				sent: true,
				candidate: { status: 'READY_TO_COMMIT', candidateHash: CANDIDATE_HASH },
				accept: { envelopeType: 'success', acceptedHash: o.acceptedHash === undefined ? CANDIDATE_HASH : o.acceptedHash },
				authorModel: o.author ?? { configured: model, resolved: model },
				checks: {
					findings: o.findings ?? candidateChecks(o.types ?? AGENT_TYPES, AGENT_POLICIES).findings,
					refused: false
				}
			}
		},
		boot: { startedAt: '2026-10-11T00:00:00.000Z', mode: 'paid', half: 'B', overlay: { JPWB_DEMO_DB: 'runs/p7b/demo.sqlite' } },
		posts: [],
		actions: [],
		archives: [],
		archiveRead: '06-final',
		problems: []
	};
}

const NAMES = ['jdoe'];
const cellOf = (r: RunReport, stage: string, row: string): MatrixCell => {
	const c = r.matrix.find((m) => m.stage === stage && m.row === row);
	expect(c, `no cell ${stage} × ${row}`).toBeDefined();
	return c!;
};

describe('⭐ C5 — the run report of a half-B run: stage 1 measured', () => {
	// ⭐ THE ROADMAP'S SECOND PREDICTED RED: stage 1 read *"not measured in this half"* whatever the run, because half A
	// authors no candidate (`run-report-core.ts`, `stageOne`). Half B authors one, and the report must measure it: the
	// floor, the reviewer's identity, the accepted hash and PUBLISHED.
	it('⭐ stage 1 of a half-B run is MEASURED: the floor SATISFIED, the reviewer named, the accepted hash, PUBLISHED — as intended', () => {
		const r = buildRunReport(halfBStore(), halfBLaneRows(), { accountNames: NAMES }).report;
		const one = cellOf(r, '1', 'whole run');
		expect(one.value).toBe('as intended');
	});
});

describe('⭐ C5 — stage 1 of a half-B run reads what failed, and states its caveats', () => {
	const stageOne = (store: StoreRows, lane: LaneRows): MatrixCell =>
		cellOf(buildRunReport(store, lane, { accountNames: NAMES }).report, '1', 'whole run');

	it('⭐ AS INTENDED it names the floor, the reviewer, the author and the hash accepted — and carries REG-F-503 and REG-F-504 beside it', () => {
		const one = stageOne(halfBStore(), halfBLaneRows());
		expect([one.value, one.registerIds, one.unregistered]).toEqual(['as intended', [], undefined]);
		expect(one.basis).toEqual([
			'the PWA "CLI Product Realization" is PUBLISHED, authored by the agent from the request (design §4 C1)',
			'the authoring floor: floor.schema-invariant SATISFIED, floor.identity-provenance SATISFIED, floor.reasoning-review SATISFIED',
			"the reviewer: devin/glm-5-3-flash-max; the author, as the page's turn named it: openai-codex/gpt-5.6-sol (configured: openai-codex/gpt-5.6-sol)",
			`the accepted hash: ${CANDIDATE_HASH}; the candidate as the lane last read it: READY_TO_COMMIT`,
			// ⭐ The review in parts, B6 — the round's complete part set, in the order the store holds the types.
			"the authoring floor's reasoning review, by type: Verify wordfreq end to end SATISFIED, Specify wordfreq SATISFIED, " +
				'Build wordfreq SATISFIED, wordfreq Realization SATISFIED',
			`caveat ${HALF_B_CAVEATS[0]}`,
			`caveat ${HALF_B_CAVEATS[1]}`
		]);
	});

	it('⛔ BROKE — a floor policy not SATISFIED, a reviewer not named, no hash accepted, or a PWA not PUBLISHED: each said, the break unregistered', () => {
		const inconclusive = stageOne(halfBStore({ floor: ['SATISFIED', 'SATISFIED', 'INCONCLUSIVE'] }), halfBLaneRows());
		expect([inconclusive.value, inconclusive.unregistered]).toEqual(['broke', true]);
		expect(inconclusive.basis).toContain("the authoring floor's floor.reasoning-review reads INCONCLUSIVE");
		const unaccepted = stageOne(halfBStore(), halfBLaneRows({ acceptedHash: null }));
		expect([unaccepted.value, unaccepted.basis]).toEqual([
			'broke',
			expect.arrayContaining(['the lane recorded no accepted hash: no one accepted a candidate'])
		]);
		const another = stageOne(halfBStore(), halfBLaneRows({ acceptedHash: `sha256:${'cd'.repeat(32)}` }));
		expect(another.basis).toContain(
			`the hash accepted, sha256:${'cd'.repeat(32)}, is not the staged candidate's, ${CANDIDATE_HASH}`
		);
		const draft = stageOne(halfBStore({ publication: 'DRAFT' }), halfBLaneRows());
		expect([draft.value, draft.basis]).toEqual(['broke', expect.arrayContaining(['the PWA is DRAFT'])]);
		const unnamed = halfBStore();
		const review = unnamed.objects.find((x) => x.state.assurancePolicyId === 'floor.reasoning-review')!;
		(review.state as Record<string, unknown>).evaluator = undefined;
		expect(stageOne(unnamed, halfBLaneRows()).basis).toContain('the floor’s reasoning review names no reviewer');
	});

	it('⛔ NOT REACHED when the store holds no PWA the lane authored into; ⭑ and half A still reads stage 1 as not measured', () => {
		const store = halfBStore();
		const none = stageOne({ ...store, objects: store.objects.filter((x) => x.id !== PWA_ID) }, halfBLaneRows());
		expect([none.value, none.basis]).toEqual([
			'not reached',
			[`no PWA the lane authored into is in the store (lane/run.json names ${PWA_ID})`]
		]);
		const lane = halfBLaneRows();
		const halfA = { ...lane, run: { ...(lane.run as object), half: undefined }, boot: { ...(lane.boot as object), half: undefined } };
		expect(stageOne(store, halfA).value).toBe('not measured in this half');
	});
});

describe('⭐ C5 — a per-unit check that a model ran: REG-F-505’s false “Yes” is a break', () => {
	const ALL_RAN = { pwu_r: 'press', pwu_s: 'model', pwu_b: 'model', pwu_v: 'model' } as const;
	const reportOf = (ran: Readonly<Record<string, 'model' | 'press'>>) =>
		buildRunReport(halfBStore({ ran }), halfBLaneRows(), { accountNames: NAMES }).report;

	it('⭐ a phase that SUCCEEDED with no model run is BROKE at stages 3 and 7, and so is the whole run’s 7 — never “as intended”', () => {
		const r = reportOf({ ...ALL_RAN, pwu_v: 'press' });
		const three = cellOf(r, '3', 'verify-wordfreq-end-to-end');
		const seven = cellOf(r, '7', 'verify-wordfreq-end-to-end');
		expect([three.value, three.registerIds, seven.value, seven.registerIds]).toEqual([
			'broke',
			['REG-F-505'],
			'broke',
			['REG-F-505']
		]);
		expect(cellOf(r, '7', 'whole run').value).toBe('broke');
		expect(r.units.map((u) => [u.slug, u.modelRan])).toEqual([
			['root', false],
			['specify-wordfreq', true],
			['build-wordfreq', true],
			['verify-wordfreq-end-to-end', false]
		]);
	});

	it('⭐ CONTROL — every phase a model ran, and the root the press’s alone: stage 7 reads as intended for each, and for the whole run', () => {
		const r = reportOf(ALL_RAN);
		expect(TREE_ORDER.map((slug) => cellOf(r, '7', slug === 'root' ? 'whole run' : slug).value)).toEqual([
			'as intended',
			'as intended',
			'as intended',
			'as intended'
		]);
	});
});

describe('⭐ C5 — the candidate checks’ findings stand beside what each unit did; C2 — the report’s units are the PWA’s', () => {
	it('⭐ each unit carries its type’s findings, and the markdown shows them in its units table and in the authoring section', () => {
		const r = buildRunReport(halfBStore({ ran: { pwu_r: 'press', pwu_s: 'model', pwu_b: 'model', pwu_v: 'press' } }), halfBLaneRows(), {
			accountNames: NAMES
		}).report;
		expect(r.units.map((u) => [u.slug, u.candidateFindings])).toEqual([
			['root', []],
			['specify-wordfreq', []],
			['build-wordfreq', ['supplied-markers (REG-F-508)', 'policy-governs (REG-F-524)']],
			['verify-wordfreq-end-to-end', ['model-leaf (REG-F-505, REG-F-507)']]
		]);
		const md = renderMarkdown(r);
		expect(md).toContain('| Stage | specify-wordfreq | build-wordfreq | verify-wordfreq-end-to-end |');
		expect(md).toContain(
			'| 4 | verify-wordfreq-end-to-end | Verify wordfreq end to end | SATISFIED | SATISFIED | SUCCEEDED | SUCCEEDED | 0 | no | model-leaf (REG-F-505, REG-F-507) |'
		);
		expect(md).toContain('## Half B — the authoring (design §4 C1 to C5)');
		expect(md).toContain('- **The candidate checks (C4), recorded before Submit, refusing nothing (REG-D-110 (4)):** 3 findings.');
		for (const c of HALF_B_CAVEATS) expect(md).toContain(`  - ${c}`);
		expect(r.authoring?.author).toEqual({ configured: 'openai-codex/gpt-5.6-sol', resolved: 'openai-codex/gpt-5.6-sol' });
		expect([r.run.half, r.authoring?.acceptedHash, r.authoring?.reviewer]).toEqual(['B', CANDIDATE_HASH, 'devin/glm-5-3-flash-max']);
	});

	it('⭐ stage 2 holds the units to the PWA’s MANDATORY tree: as intended when each has one, broke naming the type that has none', () => {
		const whole = buildRunReport(halfBStore(), halfBLaneRows(), { accountNames: NAMES }).report;
		expect([cellOf(whole, '2', 'whole run').value, cellOf(whole, '2', 'whole run').basis]).toEqual([
			'as intended',
			[
				// ⭐ `REG-D-112` (finding 4) — per (parent, type), as instantiation plans it, never one per mandatory type.
				'4 work units, one for each mandatory child under each parent, as instantiation plans the published PWA (planComposition), the root over them all',
				'the PWA declares no conditional child, so none went unoffered (REG-F-516)'
			]
		]);
		const short = buildRunReport(halfBStore({ dropped: ['pwu_b'] }), halfBLaneRows(), { accountNames: NAMES }).report;
		expect([cellOf(short, '2', 'whole run').value, cellOf(short, '2', 'whole run').basis]).toEqual([
			'broke',
			// ⭐ `REG-D-112` (finding 4) — and the parent it is missing under.
			['no work unit for Build wordfreq under wordfreq Realization']
		]);
		// ⭑ The declared verdicts a complete half-B run signs off are the agent's: each unit's own policies, 1 + 2 + 1 + 1.
		expect(whole.declaredVerdicts.expected).toBe(5);
	});

	// ⛔ R3-B F3 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (16)) — THE COUNT IS THE KERNEL'S DECLARED
	// SET (`declaredAssurancePolicyIds`, rph-domain): a unit's own policies and its type's, each once — the set the sign-off
	// reviews from, and the lane's limit counts (J1).
	/** The report of a complete half-B run whose units' OWN policies are `policies`, by unit id; the type's copy elsewhere. */
	const reportWithOwnPolicies = (policies: Readonly<Record<string, readonly string[]>>) => {
		const units = AGENT_UNITS.map((u) => (policies[u.id] === undefined ? u : { ...u, policies: policies[u.id] }));
		return buildRunReport(halfBStore({ units }), halfBLaneRows({ units }), { accountNames: NAMES }).report;
	};

	it('⛔ R3-B F3 — half B’s expected count of declared verdicts is the kernel’s declared set: a policy only the unit’s TYPE requires is counted', () => {
		// ⛔ PREDICTED RED, read from the code: each unit's own `assurancePolicyIds` alone — a policy its type requires and the
		// unit does not list was expected nowhere.
		// ⭑ Specify: its own two and its type's two share one — three, the type's `pol_intent_preservation` among them.
		expect(
			reportWithOwnPolicies({ pwu_s: ['pol_requirement_coverage', 'pol_extra'] }).declaredVerdicts.expected,
			'a policy only the type requires'
		).toBe(1 + 3 + 1 + 1);
	});

	it('⛔ R3-B F3 — and a policy the unit lists twice is counted once', () => {
		// ⛔ PREDICTED RED, read from the code: each unit's own list counted as it stands, a repeat twice.
		expect(
			reportWithOwnPolicies({ pwu_r: ['pol_intent_preservation', 'pol_intent_preservation'] }).declaredVerdicts.expected,
			'a policy the unit lists twice'
		).toBe(1 + 2 + 1 + 1);
	});
});

describe('⭐ C1, C3 — the lane’s half, and half B’s author, at boot', () => {
	const ADMITTED = {
		JPWB_EXECUTOR: 'pi',
		JPWB_EXECUTOR_MODEL: 'openai-codex/gpt-5.6-sol',
		JPWB_ASSURANCE_TOOL: 'devin',
		JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max',
		JPWB_LIVE_RUN_DIR: 'runs/phase7-b'
	} as const;

	it('⭐ unset or blank is half A — the default, unchanged; `A` and `B` are themselves, trimmed; anything else names no half', () => {
		for (const [value, half] of [
			[undefined, 'A'],
			['', 'A'],
			['  ', 'A'],
			['A', 'A'],
			[' B ', 'B'],
			['b', undefined],
			['C', undefined]
		] as const)
			expect(phase7Half({ JPWB_PHASE7_HALF: value }), JSON.stringify(value)).toBe(half);
	});

	it('⛔ a half the lane does not know is refused at boot, naming the two it knows; half B with no JPWB_AGENT_MODEL is refused as missing', () => {
		expect(laneKeysRefusal({ ...ADMITTED, JPWB_PHASE7_HALF: 'b' })).toContain(
			"JPWB_PHASE7_HALF=\"b\" is refused by a rule of THIS LANE: it names no half of the Phase 7 run — 'A'"
		);
		for (const model of [undefined, '', '   '])
			expect(laneKeysRefusal({ ...ADMITTED, JPWB_PHASE7_HALF: 'B', JPWB_AGENT_MODEL: model }), JSON.stringify(model)).toContain(
				"JPWB_PHASE7_HALF='B' runs the live authoring agent, and it is missing JPWB_AGENT_MODEL"
			);
		expect(laneKeysRefusal({ ...ADMITTED, JPWB_PHASE7_HALF: 'B', JPWB_AGENT_MODEL: 'openai-codex/gpt-5.6-sol' })).toBeUndefined();
		// ⭑ HALF A IS UNCHANGED: it authors nothing, so it asks for no author's model.
		expect(laneKeysRefusal({ ...ADMITTED })).toBeUndefined();
		expect(laneKeysRefusal({ ...ADMITTED, JPWB_PHASE7_HALF: 'A' })).toBeUndefined();
	});

	it('⛔ JPWB_PHASE7_HALF set with no run folder asks for the Phase 7 run, and is refused as the paid variable is (D1)', () => {
		const { JPWB_LIVE_RUN_DIR: _folder, ...noFolder } = ADMITTED;
		expect(laneKeysRefusal({ ...noFolder, JPWB_PHASE7_HALF: 'B', JPWB_AGENT_MODEL: 'm' })).toContain(
			'JPWB_PHASE7_HALF="B" is refused by a rule of THIS LANE, not of the product: it asks for the Phase 7 run, but JPWB_LIVE_RUN_DIR is unset'
		);
	});

	it('⭐ C3 — the boot records the half and the author’s model as configured, and refuses half B without one', async () => {
		const store = join(folder('boot-b'), 'demo.sqlite');
		writeFileSync(store, '');
		const ready = async (_program: string, args: readonly string[]) => ({
			exitCode: 0,
			stdout: args[0] === 'models' ? 'glm-5-3-flash-max\n' : 'devin 3000\n',
			stderr: '',
			failure: null
		});
		// ⛔ MOVED 2026-10-26 (`JAN-EXEC` Phase 7, package O; design D26) — ~~`serverEnv: { JPWB_DEMO_DB: store }` for half B~~: the config
		// hands a paid half-B run's server the authoring review's allowance (`phase7AuthoringReviewAllowanceEnv`), and the boot now
		// refuses one handed otherwise — so the half-B boots here are handed what the config hands, 2,400 − 0 − 4 = 2,396.
		const boot = (env: Record<string, string>) =>
			bootOf({
				paid: true,
				env: { ...ADMITTED, JPWB_PHASE7_PRIOR_REVIEWER_CALLS: '0', ...env },
				serverEnv: { JPWB_DEMO_DB: store, ...(env.JPWB_PHASE7_HALF === 'B' ? { [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '2396' } : {}) },
				store,
				run: ready
			});
		const b = await boot({ JPWB_PHASE7_HALF: 'B', JPWB_AGENT_MODEL: ' openai-codex/gpt-5.6-sol ' });
		expect([b.refusals, b.record.half, b.record.authorModel]).toEqual([[], 'B', 'openai-codex/gpt-5.6-sol']);
		const refused = await boot({ JPWB_PHASE7_HALF: 'B' });
		expect([refused.record.half, refused.record.authorModel]).toEqual(['B', null]);
		expect(refused.refusals.join('\n')).toContain('it is missing JPWB_AGENT_MODEL');
		const a = await boot({});
		expect([a.refusals, a.record.half]).toEqual([[], 'A']);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package O — D26 (design revision 3; `l2-facts.md`; the lead's decision, flagged for the sponsor): THE
	// ALLOWANCE THE LANE HANDS THE SERVER IS ON THE BOOT RECORD, AND A PAID HALF-B BOOT WHOSE SERVER WAS HANDED ANOTHER IS REFUSED.
	// ⛔ Before D26 the boot recorded nothing of it, and Send's check counted the COMPUTED allowance whatever the server was handed:
	// a config that handed another, or none, left Send's press bounded by a figure its check never counted.
	it('⭐ D26, THE PREDICTED RED — a paid half-B boot RECORDS the allowance its server was handed, and REFUSES one that differs from the computed allowance, naming both; ⭑ CONTROL: the computed one boots clean', async () => {
		const store = join(folder('boot-b-allowance'), 'demo.sqlite');
		writeFileSync(store, '');
		const ready = async (_program: string, args: readonly string[]) => ({
			exitCode: 0,
			stdout: args[0] === 'models' ? 'glm-5-3-flash-max\n' : 'devin 3000\n',
			stderr: '',
			failure: null
		});
		const handed = (allowance: string | undefined) =>
			bootOf({
				paid: true,
				env: { ...ADMITTED, JPWB_PHASE7_PRIOR_REVIEWER_CALLS: '1117', JPWB_PHASE7_HALF: 'B', JPWB_AGENT_MODEL: 'openai-codex/gpt-5.6-sol' },
				serverEnv: { JPWB_DEMO_DB: store, ...(allowance === undefined ? {} : { [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: allowance }) },
				store,
				run: ready
			});
		// ⭑ CONTROL — the computed allowance, 2,400 − 1,117 − 4 = 1,279: recorded, and nothing refused.
		const clean = await handed('1279');
		expect([clean.refusals, clean.record.overlay[AUTHORING_REVIEW_ALLOWANCE_VARIABLE]]).toEqual([[], '1279']);
		const other = await handed('2396');
		expect(other.record.overlay[AUTHORING_REVIEW_ALLOWANCE_VARIABLE], 'the boot record does not say what the server was handed').toBe('2396');
		expect(other.refusals, 'a paid half-B server handed another allowance than the computed one was booted').toEqual([
			`the server was handed ${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}="2396", not the 1279 this paid half-B run computes — the ` +
				`limit of ${PHASE7_PAID_LIMIT} less the 1117 calls spent before the run and the negative control’s 4 (REG-F-580; ` +
				'design D20, D26): Send’s check counts the computed allowance, so a server handed another would bound the authoring ' +
				'review by a figure that check never counted'
		]);
		expect((await handed(undefined)).refusals, 'a paid half-B server handed no allowance was booted').toEqual([
			`the server was handed no ${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}, not the 1279 this paid half-B run computes — the ` +
				`limit of ${PHASE7_PAID_LIMIT} less the 1117 calls spent before the run and the negative control’s 4 (REG-F-580; ` +
				'design D20, D26): Send’s check counts the computed allowance, so a server handed another would bound the authoring ' +
				'review by a figure that check never counted'
		]);
	});
});

describe('⭐ C3 — the authoring allowance, folded into the timeout', () => {
	/** One review at its bound: `reviewerCallsPerTry` calls, each at the reviewer's. */
	const REVIEW_MS = LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs;

	// ⭐ The review in parts, B6 (`REG-D-125`; design D9) — ~~2,400 s for every turn~~: each floor run reviews each type of the
	// candidate as a part, so the allowance is the inventory's — 2,400 s at one part, as before, and 31,200 s at sixteen.
	// ⭐ Package L — D13 (`REG-D-135` (3)): each review up to SIX calls of 240 s, so ~~2,400 s / 31,200 s~~ 3,360 s at one part
	// and 46,560 s at sixteen.
	it('⭐ two floor runs — the floor, and the one auto-refinement pass the agent route makes — each the agent’s run and one review of each part: ~~2,400 s~~ 3,360 s at one part, ~~31,200 s~~ 46,560 s at sixteen', () => {
		const route = readFileSync(join(REPO, 'apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts'), 'utf8');
		expect(route).toContain('auto-refine at most once');
		expect(route.split('await runPwaFloor(').length - 1, 'the route runs the floor once, and once more to refine').toBe(
			PHASE7_AUTHORING_FLOOR_RUNS
		);
		expect([1, 2, 16].map(phase7AuthoringAllowanceMs)).toEqual(
			[1, 2, 16].map((parts) => PHASE7_AUTHORING_FLOOR_RUNS * (LANE_BUDGET.executorCallMs + parts * REVIEW_MS))
		);
		expect([phase7AuthoringAllowanceMs(1), phase7AuthoringAllowanceMs(16), EXECUTE_TIMEOUT_MS / LANE_BUDGET.tries]).toEqual([
			3_360_000, 46_560_000, 1_680_000
		]);
		// ⭑ AT LEAST ONE PART: a turn that has staged no type yet is given one part's, ~~the 2,400 s every turn had~~ 3,360 s.
		expect(phase7AuthoringAllowanceMs(0)).toBe(3_360_000);
	});

	it('⭐ the authoring’s share: the allowance, one overrunning poll, and four designer acts each at its bound — ~~5,585 s~~ 6,545 s at one part, ~~34,385 s~~ 49,745 s at sixteen (package L, D13)', () => {
		expect([PHASE7_CANDIDATE_POLL_MS, PHASE7_DESIGNER_ACTS, DESIGNER_ACTS.length + 1]).toEqual([5_000, 4, 4]);
		for (const parts of [1, 16])
			expect(phase7AuthoringMs(parts)).toBe(
				phase7AuthoringAllowanceMs(parts) +
					PHASE7_CANDIDATE_POLL_MS +
					PHASE7_INTROSPECT_MS +
					4 * (PHASE7_UI_MS + PHASE7_SIGN_OFF_MS + PHASE7_INTROSPECT_MS)
			);
		expect([phase7AuthoringMs(1), phase7AuthoringMs(16)]).toEqual([6_545_000, 49_745_000]);
	});

	it('⭐ half B’s timeout: half A’s re-counted for the agent’s phases, plus the authoring for its parts; capped at Node’s timer ceiling', () => {
		// ⭑ ONE PHASE'S SHARE is exactly what half A's arithmetic counts once per phase: the timeout less its setup, the
		// root's run, the final screenshot and read, and the root's sign-off, over its four phases. ⭐ The merge of E12 and E3
		// — a sign-off now counts its declared reviews, the limit's read before it and the rule's re-run of them
		// (`PHASE7_SIGN_OFF_UNIT_MS`, 11,280 s, not 1,800 s), so the share is ~~82,320 s~~ ~~91,800 s~~ ⭐ (package L, D13: each
		// review six calls) 55,740 + 300 + 58,080 + 15,120 = 129,240 s.
		expect(PHASE7_PER_PHASE_MS).toBe(129_240_000);
		expect(
			PHASE7_TEST_TIMEOUT_MS -
				PHASE7_SETUP_MS -
				PHASE7_UNIT_RUN_MS -
				PHASE7_UI_MS -
				PHASE7_INTROSPECT_MS -
				PHASE7_SIGN_OFF_UNIT_MS
		).toBe(PHASE7_MODEL_UNITS * PHASE7_PER_PHASE_MS);
		// ⭐ R3-B F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (15)) — ~~a phase count~~: each unit's
		// declared policies, the root's first. With every unit declaring §3.2's most, four, the arithmetic is half A's re-counted.
		const units = (phases: number): number[] => Array.from({ length: phases + 1 }, () => 4);
		expect(phase7HalfBTestTimeoutMs(units(4), 1)).toBe(PHASE7_TEST_TIMEOUT_MS + phase7AuthoringMs(1));
		// ⭐ Package L — D13: ~~425,225 s~~ 590,040 s + 6,545 s.
		expect(phase7HalfBTestTimeoutMs(units(4), 1)).toBe(596_585_000);
		// ⭐ The review in parts, B6 — the authoring's share is the inventory's: sixteen parts, ~~454,025 s~~ ⭐ 639,785 s for four
		// phases.
		expect(phase7HalfBTestTimeoutMs(units(4), 16)).toBe(639_785_000);
		// ⭐ And the ceiling's first phase count, as lane-config.ts states it: ~~23, at one part and at sixteen alike~~ ⭐ package
		// L, D13: 17 at one part, 16 at sixteen — the larger allowance now reaches the ceiling a phase sooner.
		for (const [parts, first] of [
			[1, 17],
			[16, 16]
		] as const)
			expect([
				phase7HalfBTestTimeoutMs(units(first - 1), parts) < NODE_TIMER_CEILING_MS,
				phase7HalfBTestTimeoutMs(units(first), parts)
			]).toEqual([true, NODE_TIMER_CEILING_MS]);
		expect(phase7HalfBTestTimeoutMs(units(7), 1) - phase7HalfBTestTimeoutMs(units(6), 1)).toBe(PHASE7_PER_PHASE_MS);
		expect(phase7HalfBTestTimeoutMs(units(1), 1)).toBe(
			PHASE7_TEST_TIMEOUT_MS - 3 * PHASE7_PER_PHASE_MS + phase7AuthoringMs(1)
		);
		expect(phase7HalfBTestTimeoutMs(units(40), 1)).toBe(NODE_TIMER_CEILING_MS);
		expect(NODE_TIMER_CEILING_MS).toBe(2_147_483_647);
		// ⭐ Each unit's sign-off re-counted for its own policies: one more policy, two more reviews — Record Assurance's, and the
		// rule's one re-run of them — at ~~four~~ six calls of 240 s each (package L, D13).
		expect(phase7HalfBTestTimeoutMs([4, 5, 4, 4, 4], 1) - phase7HalfBTestTimeoutMs(units(4), 1)).toBe(2 * REVIEW_MS);
		// ⭐ B6 — while the turn runs: half A's, which half B starts under, and the authoring's share for the parts staged.
		expect([phase7HalfBAuthoringTimeoutMs(1), phase7HalfBAuthoringTimeoutMs(16)]).toEqual([
			PHASE7_TEST_TIMEOUT_MS + phase7AuthoringMs(1),
			PHASE7_TEST_TIMEOUT_MS + phase7AuthoringMs(16)
		]);
		expect(phase7HalfBAuthoringTimeoutMs(2_000)).toBe(NODE_TIMER_CEILING_MS);
	});

	it('⭐ the lane extends the test’s timeout when its turn stages more than one part’s allowance holds, and when the units are read, by ~~the agent’s phase count~~ ⭐ each of the agent’s units’ declared policies, the root’s first, and the parts its turn staged', async () => {
		const l = halfBLane({ paid: true });
		await l.run();
		// ⭑ AGENT_TYPES: four types staged — the root, Specify, Build and Verify, which declare 1, 2, 1 and 1
		// (`requiredAssurancePolicyIds`).
		expect(l.timeouts).toEqual([phase7HalfBAuthoringTimeoutMs(4), phase7HalfBTestTimeoutMs([1, 2, 1, 1], 4)]);
	});

	// ⭐⭐ The review in parts, B6 (`REG-D-125`; design D9: *"delayed part reviews settle within the lane's derived allowance, and
	// exceeding that allowance leaves the page holding the candidate without accepting it"*) — on the lane's own clock.
	// ⛔ PREDICTED RED, read from the code: the deadline was 2,400 s whatever the candidate staged, so a sixteen-type turn whose
	// rounds took an hour ended `allowance-exceeded` at forty minutes, and its candidate was never accepted.
	it('⛔ a sixteen-part turn whose rounds take an hour is waited for: its allowance is its inventory’s, and the candidate is accepted', async () => {
		const reads = (60 * 60 * 1000) / PHASE7_CANDIDATE_POLL_MS;
		const l = halfBLane({
			paid: true,
			staged: [SIXTEEN_TYPES],
			statuses: [...Array.from({ length: reads }, () => 'ASSURING'), 'READY_TO_COMMIT']
		});
		const record = await l.run();
		expect(record.end?.reason, 'the lane gave up on a turn its allowance still held').not.toBe('allowance-exceeded');
		expect(l.only('author.accept')).toEqual(['author.accept']);
		expect([record.authoring?.parts, record.authoring?.allowanceMs, record.authoring?.polls]).toEqual([
			16,
			phase7AuthoringAllowanceMs(16),
			reads + 1
		]);
	});

	it('⛔ past its inventory’s allowance the stop is kept: the page still holds the turn, and nothing is accepted', async () => {
		const l = halfBLane({ paid: true, staged: [SIXTEEN_TYPES], statuses: ['ASSURING'] });
		const record = await l.run();
		const polls = phase7AuthoringAllowanceMs(16) / PHASE7_CANDIDATE_POLL_MS;
		expect([record.end?.reason, record.authoring?.polls]).toEqual(['allowance-exceeded', polls + 1]);
		expect(record.end?.detail).toContain(
			`the authoring turn outlasted its allowance of ${phase7AuthoringAllowanceMs(16)} ms for 16 part(s), its candidate read ASSURING`
		);
		expect(l.only('author.accept', 'beginExecute')).toEqual([]);
	});

	it('⭐ the allowance is refreshed from every read: a type the refinement adds extends it, one it removes does not shorten it, and none staged yet is one part’s', async () => {
		const at = (n: number) => SIXTEEN_TYPES.slice(0, n);
		const l = halfBLane({
			paid: true,
			// ⭑ Nothing staged at the first read, two at the second, five once the refinement adds three, three once it removes two.
			staged: [at(0), at(2), at(5), at(3)],
			statuses: ['COLLECTING', 'ASSURING', 'ASSURING', 'ASSURING', 'READY_TO_COMMIT']
		});
		const record = await l.run();
		expect([record.authoring?.parts, record.authoring?.allowanceMs]).toEqual([5, phase7AuthoringAllowanceMs(5)]);
		// ⭑ Each larger allowance carried into the spec's timeout as it was derived: two parts', then five's — none for the read
		// that staged nothing, nor for the one that staged fewer.
		expect(l.timeouts.slice(0, 2)).toEqual([phase7HalfBAuthoringTimeoutMs(2), phase7HalfBAuthoringTimeoutMs(5)]);
	});
});

describe('⭐ C1, C4, C6 — what the lane does, and records, in half B', () => {
	it('⭐ C1 — the record: the candidate, the floor’s dispositions, the author’s model, the reviewer, the hash accepted, the acts — written to lane/run.json', async () => {
		const l = halfBLane({ paid: true });
		await l.run();
		const a = l.written().authoring!;
		expect(a.request).toBe(PHASE7_HALF_B_REQUEST);
		expect([a.pwaId, a.sent, a.polls, a.candidate?.status, a.candidate?.candidateHash]).toEqual([
			PWA_ID,
			true,
			3,
			'READY_TO_COMMIT',
			CANDIDATE_HASH
		]);
		// ⭐ The review in parts, B6 — and the Reasoning Review's complete part set: each of the candidate's types, its review.
		expect(a.floor).toEqual(
			AUTHORING_FLOOR_POLICIES.map((policyId) => ({
				policyId,
				state: 'SATISFIED',
				evaluator: policyId === 'floor.reasoning-review' ? 'devin/glm-5-3-flash-max' : null,
				producer: null,
				...(policyId === 'floor.reasoning-review'
					? {
							parts: AGENT_TYPES.map((t) => ({
								typeId: t.id,
								typeName: t.state.name,
								state: 'SATISFIED',
								evaluator: 'devin/glm-5-3-flash-max'
							}))
						}
					: {})
			}))
		);
		expect([a.authorModel, a.reviewer, a.accept?.acceptedHash, a.accept?.envelopeType]).toEqual([
			{ configured: 'openai-codex/gpt-5.6-sol', resolved: 'openai-codex/gpt-5.6-sol' },
			'devin/glm-5-3-flash-max',
			CANDIDATE_HASH,
			'success'
		]);
		expect(a.lifecycle.map((x) => [x.act, x.envelopeType, x.refusal])).toEqual(
			DESIGNER_ACTS.map((act) => [act, 'success', null])
		);
		expect([a.published, a.typesAsAccepted?.length, a.unitProblems]).toEqual([true, 4, []]);
		expect(['acceptAgentCandidate', ...DESIGNER_ACTS].map((act) => l.action(`00-authoring-${act}`))).toEqual([
			true,
			true,
			true,
			true
		]);
	});

	// ⭐⭐ `REG-D-110` (4): *"They do not refuse before Submit, so a trap plays out live and the run reports it."*
	it('⭐ C4 — the checks run on the ACCEPTED candidate before Submit, find this PWA’s three traps, and refuse NOTHING: Submit, Validate and Publish follow', async () => {
		const l = halfBLane({ paid: true });
		const record = await l.run();
		const checks = record.authoring!.checks!;
		expect(checks.refused).toBe(false);
		expect(checks.findings.map((f) => [f.check, f.typeName])).toEqual([
			['model-leaf', 'Verify wordfreq end to end'],
			['supplied-markers', 'Build wordfreq'],
			['policy-governs', 'Build wordfreq']
		]);
		const order = l.only('author.accept', 'author.submitForReview', 'author.validate', 'author.publish');
		expect(order).toEqual(['author.accept', 'author.submitForReview', 'author.validate', 'author.publish']);
		// ⛔ MOVED 2026-10-26 (`JAN-EXEC` Phase 7, package O; design D24) — ~~`toBe('complete')`~~: this run signs no unit off, so the
		// root is never offered, and the run ends `withheld` — still past every check, which refused nothing (a refusal there ends
		// it `authoring-stopped`).
		expect(record.end?.reason).toBe('withheld');
	});

	it('⛔ C6 — DRY, the rehearsal makes the draft and stops BEFORE SEND: authoring is a model call; the verdict holds it to that', async () => {
		const l = halfBLane({ paid: false });
		const record = await l.run();
		expect(l.only('author.', 'setUp', 'beginExecute')).toEqual(['author.createDraft']);
		expect([record.end?.reason, record.authoring?.sent, record.authoring?.pwaId, record.dryRun, record.units]).toEqual([
			'dry-run-stop',
			false,
			PWA_ID,
			{ modelExchanges: 0 },
			[]
		]);
		expect(laneVerdict(record)).toEqual([]);
	});

	it('⛔ C6 — a half-B dry run that sent its request, made no draft, or recorded a model exchange fails its verdict, each said', () => {
		const dry = (authoring: object, modelExchanges: number | null): RunRecord =>
			({
				mode: 'dry',
				half: 'B',
				units: [],
				authoring,
				dryRun: modelExchanges === null ? null : { modelExchanges },
				end: { reason: 'dry-run-stop', at: '' },
				problems: []
			}) as unknown as RunRecord;
		expect(laneVerdict(dry({ pwaId: PWA_ID, sent: true }, 0))).toEqual([
			'the dry run sent the request: authoring is a model call, and a dry run calls none (design §4 C6)'
		]);
		expect(laneVerdict(dry({ pwaId: null, sent: false }, 2))).toEqual([
			'the dry run made no draft for the agent to author into',
			'the dry run recorded 2 model exchange(s)'
		]);
		expect(laneVerdict(dry({ pwaId: PWA_ID, sent: false }, null))).toEqual([
			'the dry run recorded an unread number of model exchange(s)'
		]);
	});

	it('⛔ a candidate the floor did not assure is accepted by no one: the run ends authoring-stopped, in the floor’s words, and the verdict says so', async () => {
		const l = halfBLane({
			paid: true,
			statuses: ['ASSURING', 'BLOCKED_EXTERNAL'],
			detail: 'The review did not produce a usable verdict.'
		});
		const record = await l.run();
		expect(l.only('author.accept', 'author.submitForReview', 'beginExecute')).toEqual([]);
		expect(record.end).toMatchObject({
			reason: 'authoring-stopped',
			detail: 'the candidate is BLOCKED_EXTERNAL, so no one can accept it: The review did not produce a usable verdict.'
		});
		expect(record.authoring?.floor.map((f) => f.state)).toEqual(['SATISFIED', 'SATISFIED', 'SATISFIED']);
		expect(laneVerdict(record)).toEqual([
			"the run ended 'authoring-stopped', not 'complete': the candidate is BLOCKED_EXTERNAL, so no one can accept it: The review did not produce a usable verdict."
		]);
	});

	it('⛔ a refused acceptance, or a refused designer act, ends the run there: nothing after it is pressed, the refusal in the server’s words', async () => {
		const refusal = (error: string): ActionOutcome => ({
			...answered('failure', `[{"error":1},"${error}"]`),
			decoded: { error }
		});
		const unaccepted = halfBLane({ paid: true, accept: refusal('The candidate changed.') });
		const r1 = await unaccepted.run();
		expect(unaccepted.only('author.submitForReview', 'beginExecute')).toEqual([]);
		expect(r1.end).toMatchObject({
			reason: 'authoring-stopped',
			detail: "the PWA's Accept exact candidate was refused: The candidate changed."
		});
		expect([r1.authoring?.accept?.refusal, r1.authoring?.checks]).toEqual(['The candidate changed.', null]);
		const invalid = halfBLane({ paid: true, lifecycle: { validate: refusal('The graph is not well formed.') } });
		const r2 = await invalid.run();
		expect(invalid.only('author.publish', 'author.createUndertaking', 'beginExecute')).toEqual([]);
		expect(r2.end).toMatchObject({
			reason: 'authoring-stopped',
			detail: "the PWA's validate was refused: The graph is not well formed."
		});
	});

	it('⛔ a Publish answered while the store reads the PWA otherwise ends the run: published is the store’s word, not the envelope’s', async () => {
		const l = halfBLane({ paid: true, published: 'VALIDATED' });
		const record = await l.run();
		expect(l.only('author.createUndertaking', 'beginExecute')).toEqual([]);
		expect([record.end?.reason, record.end?.detail, record.authoring?.published]).toEqual([
			'authoring-stopped',
			'Publish was answered, and the store reads the PWA VALIDATED',
			false
		]);
	});

	it('⛔ C3 — a turn that outlasts its allowance ends the run there, allowance-exceeded: the page still holds it, and nothing is pressed', async () => {
		const l = halfBLane({ paid: true, statuses: ['ASSURING'] });
		const record = await l.run();
		// ⭐ The review in parts, B6 — the allowance of the four types the turn staged (`AGENT_TYPES`).
		const polls = phase7AuthoringAllowanceMs(4) / PHASE7_CANDIDATE_POLL_MS;
		expect(l.only('author.pause')).toHaveLength(polls);
		expect(l.only('author.accept', 'beginExecute')).toEqual([]);
		expect([record.end?.reason, record.authoring?.polls]).toEqual(['allowance-exceeded', polls + 1]);
		expect(record.end?.detail).toContain(
			`the authoring turn outlasted its allowance of ${phase7AuthoringAllowanceMs(4)} ms for 4 part(s), its candidate read ASSURING`
		);
	});

	it('⛔ a turn the server refused before it began stages no candidate: once the page’s turn is over, the run ends, never waiting out the allowance', async () => {
		const l = halfBLane({ paid: true, noCandidate: true });
		const record = await l.run();
		expect(l.only('read', 'author.pause', 'author.turnRunning')).toEqual([
			// ⭐ `REG-D-112` — the limit's read before Send (finding 2) ...
			'read',
			'read',
			'author.pause 5000',
			'read',
			'author.turnRunning',
			// ⭐ ... and the authoring archive's, at the end (finding 1).
			'read'
		]);
		expect(record.end).toMatchObject({ reason: 'authoring-stopped' });
		expect(record.end?.detail).toContain('the page’s turn ended and no candidate was staged');
	});

	it('⭐ the candidate as the store reads it, and the hash an acceptance names — its own field first, else the one its body carries', () => {
		const snap = {
			authoringCandidates: [
				{ pwaId: 'other', summary: { status: 'COLLECTING', commandCount: 1 } },
				{ pwaId: PWA_ID, summary: { status: 'REVISION_REQUIRED', detail: 'two roots', remediationAction: 'REVISE', commandCount: 3 } }
			]
		} as unknown as EngineSnapshot;
		expect(candidateOf(snap, PWA_ID)).toEqual({
			status: 'REVISION_REQUIRED',
			candidateHash: null,
			detail: 'two roots',
			remediationAction: 'REVISE',
			commandCount: 3
		});
		expect(candidateOf(snap, 'pwa_none')).toBeNull();
		expect([...TURN_SETTLED].sort()).toEqual(
			['BLOCKED_EXTERNAL', 'COMMITTED', 'COMMIT_FAILED', 'CONFLICTED', 'DISCARDED', 'READY_TO_COMMIT', 'REVISION_REQUIRED'].sort()
		);
		expect(acceptedHashOf(ACCEPTED)).toBe(CANDIDATE_HASH);
		expect(acceptedHashOf({ ...ACCEPTED, decoded: {} })).toBe(CANDIDATE_HASH);
		expect(acceptedHashOf(answered('success'))).toBeNull();
	});
});

describe('⭐ C3 — the author as the turn’s own stream names it: the one place it is said', () => {
	it('⭐ the first `producer` event of the stream, as provider/model; none, null; a line that is no event, passed over', () => {
		const event = (e: object) => `data: ${JSON.stringify(e)}`;
		const stream = [
			event({ kind: 'status', text: 'pi agent · openai-codex/gpt-5.6-sol' }),
			'',
			'data: {not json',
			event({ kind: 'producer', producer: { agentId: 'authoring-agent', modelId: 'gpt-5.6-sol', providerId: 'openai-codex' } }),
			'',
			event({ kind: 'producer', producer: { agentId: 'authoring-agent', modelId: 'later', providerId: 'other' } }),
			event({ kind: 'done' })
		].join('\n');
		expect(producerOfStream(stream)).toBe('openai-codex/gpt-5.6-sol');
		expect(producerOfStream(event({ kind: 'producer', producer: { modelId: 'mock-structural' } }))).toBe('mock-structural');
		expect(producerOfStream([event({ kind: 'status', text: 'mock agent' }), event({ kind: 'done' })].join('\n'))).toBeNull();
		expect(producerOfStream('')).toBeNull();
	});
});

describe('⭐ C1 — half B’s request: the run plan’s, naming wordfreq (REG-D-110 (4)), and nothing of the PWA’s shape', () => {
	it('⭐ the run plan’s request, verbatim from the design, with the product named where it names a product, and the brief after it', () => {
		const design = readFileSync(join(REPO, 'docs/_working/DESIGN-the-live-end-to-end-run.md'), 'utf8');
		expect(design).toContain(`**The request:** *"${PHASE7_RUN_PLAN_REQUEST}"*`);
		expect(PHASE7_HALF_B_REQUEST).toBe(
			'Create a PWA for realizing a small command-line product, wordfreq, through requirements, design, implementation ' +
				'with unit tests, and end-to-end verification, with the assurance policies each phase needs.\n\nThe product, as ' +
				`its brief states it:\n\n${PRODUCT_BRIEF}`
		);
	});

	it('⛔ it dictates no type, kind, policy, discharge or marker — a request that did would measure transcription, not authoring', () => {
		const kinds = [...new Set(PHASE7_PWA.types.map((t) => t.pwuKind))];
		for (const word of [...kinds, ...PHASE7_PWA.types.map((t) => t.name), 'pol_', 'MODEL', 'HUMAN', 'UNDECLARED', 'workDischarge', 'promptActive', 'Ready to use', '{', '}'])
			expect(PHASE7_HALF_B_REQUEST, word).not.toContain(word);
	});

	it('⭐ the agent’s draft is named as half A’s PWA is, so the two halves’ reports name one PWA alike', () => {
		expect(PHASE7_HALF_B_DRAFT).toEqual({ name: PHASE7_PWA.name, domain: PHASE7_PWA.domain });
	});
});

describe('⭐ C2 — the order rule: the root first, then the tree’s order', () => {
	const unit = (id: string, typeId: string, parent: string | null, title = id) => ({
		id,
		state: { title, pwuTypeId: typeId, ...(parent === null ? {} : { parentWorkUnitId: parent }) }
	});
	const type = (id: string, children: readonly string[] = []) => ({ id, state: { permittedChildTypeIds: [...children] } });

	it('⭐ depth first, each unit’s children in the order its TYPE permits them — never the store’s order', () => {
		const types = [type('t_root', ['t_b', 't_a']), type('t_a', ['t_a2', 't_a1']), type('t_b'), type('t_a1'), type('t_a2')];
		const units = [
			unit('u_a1', 't_a1', 'u_a'),
			unit('u_b', 't_b', 'u_root'),
			unit('u_a', 't_a', 'u_root'),
			unit('u_root', 't_root', null),
			unit('u_a2', 't_a2', 'u_a')
		];
		const tree = unitsInTreeOrder(units, types);
		expect(tree.units.map((u) => [u.order, u.unitId])).toEqual([
			[1, 'u_root'],
			[2, 'u_b'],
			[3, 'u_a'],
			[4, 'u_a2'],
			[5, 'u_a1']
		]);
		expect(tree.problems).toEqual([]);
	});

	it('⚠ a child its parent’s type does not list keeps the store’s order after the listed; a unit the root does not reach is listed last, and said', () => {
		const types = [type('t_root', ['t_x'])];
		const units = [
			unit('u_y', 't_y', 'u_root'),
			unit('u_root', 't_root', null),
			unit('u_lost', 't_x', 'u_gone', 'Lost'),
			unit('u_x', 't_x', 'u_root')
		];
		const tree = unitsInTreeOrder(units, types);
		expect(tree.units.map((u) => u.unitId)).toEqual(['u_root', 'u_x', 'u_y', 'u_lost']);
		expect(tree.problems).toEqual(['the unit "Lost" is not under the root']);
		expect(unitsInTreeOrder([unit('a', 't', null), unit('b', 't', null)], []).problems[0]).toBe(
			'2 units have no parent unit, where a tree has one root'
		);
	});

	it('⭐ slugs: the root’s is `root`; the others from their titles, each unique, `final` and `root` never taken', () => {
		const units = [
			unit('r', 't', null, 'Anything at all'),
			unit('a', 't', 'r', 'Design & Build: wordfreq!'),
			unit('b', 't', 'r', 'Design & Build: wordfreq?'),
			unit('c', 't', 'r', 'Final'),
			unit('d', 't', 'r', 'Root'),
			unit('e', 't', 'r', '——')
		];
		expect(unitsInTreeOrder(units, []).units.map((u) => u.slug)).toEqual([
			'root',
			'design-build-wordfreq',
			'design-build-wordfreq-2',
			'final-unit',
			'root-unit',
			'unit'
		]);
		expect(slugOf('Café — Résumé of the product, 2nd pass')).toBe('cafe-resume-of-the-product-2nd-pass');
		expect(slugOf('x'.repeat(39) + ' yz')).toBe('x'.repeat(39));
	});

	it('⭐ the mandatory tree: M1 and M+ walked, and a child with no rule (M1, as instantiation reads it); C1 and C+ named, never walked', () => {
		const types = [
			{
				id: 'root',
				state: {
					name: 'Root',
					isRoot: true,
					permittedChildTypeIds: ['m1', 'mplus', 'c1', 'norule'],
					permittedChildren: [
						{ typeId: 'm1', cardinality: 'M1' },
						{ typeId: 'mplus', cardinality: 'M+' },
						{ typeId: 'c1', cardinality: 'C1' }
					]
				}
			},
			{ id: 'm1', state: { name: 'M1 child', permittedChildTypeIds: ['cplus'], permittedChildren: [{ typeId: 'cplus', cardinality: 'C+' }] } },
			{ id: 'mplus', state: { name: 'M+ child' } },
			{ id: 'c1', state: { name: 'C1 child' } },
			{ id: 'norule', state: { name: 'No-rule child' } },
			{ id: 'cplus', state: { name: 'C+ grandchild' } }
		];
		// ⭐ `REG-D-112` (finding 4) — asked of the product's own planner (`treeAgainstPlan`, `planComposition`): with no unit
		// built, every planned unit is missing — each under its parent — and the conditional children are named, never planned.
		const plan = treeAgainstPlan([], types);
		expect([plan.planned, plan.missing]).toEqual([4, ['Root', 'M1 child under Root', 'M+ child under Root', 'No-rule child under Root']]);
		expect(plan.conditional).toEqual(['C+ grandchild', 'C1 child']);
	});

	it('⭐ REG-D-112 — the plan is the PRODUCT’s: a type two parents permit is planned once under EACH, and matched per (parent, type)', () => {
		const plan = treeAgainstPlan(
			SHARED_UNITS.map((u) => ({ id: u.id, state: { title: u.title, pwuTypeId: u.typeId, ...(u.parent === null ? {} : { parentWorkUnitId: u.parent }) } })),
			SHARED_TYPES
		);
		expect(plan).toEqual({ planned: 5, missing: [], duplicated: [], orphaned: [], unplanned: [], conditional: [], unresolved: [] });
		// ⭑ A permitted child that resolves to no type: instantiation refuses such a PWA, and the plan says why.
		const broken = treeAgainstPlan([], [{ id: 'r', state: { name: 'R', isRoot: true, permittedChildTypeIds: ['ghost'] } }]);
		expect(broken.unresolved).toEqual(['R → ghost']);
	});
});

describe('⭐ C1 — the floor’s dispositions, as the record holds them', () => {
	/** A floor assessment of `subject` under `policyId`, concluded as `state`. */
	const a = (id: string, policyId: string, state: string, subject: string, evaluator?: object) => ({
		id,
		state: { assurancePolicyId: policyId, subjectObjectIds: [subject], assessmentState: state, ...(evaluator ? { evaluator } : {}) }
	});
	const rr = (id: string, state: string, subject: string, evaluator?: object) =>
		a(id, 'floor.reasoning-review', state, subject, evaluator);
	const type = (id: string, name: string) => ({ id, state: { pwaId: PWA_ID, name } });
	/** Every assessment in one round, under one token. */
	const oneRound = (): string => 'authoring-floor:run-1';
	/** The round each assessment was recorded in, by its id's first letter: `A1` is round A's. */
	const roundOf = (id: string): string => `authoring-floor:${id[0]}`;

	it('⭐ each policy’s LATEST assessment of the PWA in its round, in the plan’s order; MISSING where there is none; the identities as provider/model', () => {
		const rows = [
			rr('1', 'INCONCLUSIVE', 't1'),
			a('2', 'floor.schema-invariant', 'SATISFIED', PWA_ID),
			rr('3', 'SATISFIED', 't1', { modelId: 'glm', providerId: 'devin' }),
			a('4', 'floor.identity-provenance', 'REJECTED', 'pwa_other')
		];
		expect(floorDispositions(rows, PWA_ID, [type('t1', 'Plan')], oneRound)).toEqual([
			{ policyId: 'floor.schema-invariant', state: 'SATISFIED', evaluator: null, producer: null },
			{ policyId: 'floor.identity-provenance', state: 'MISSING', evaluator: null, producer: null },
			{
				policyId: 'floor.reasoning-review',
				state: 'SATISFIED',
				evaluator: 'devin/glm',
				producer: null,
				parts: [{ typeId: 't1', typeName: 'Plan', state: 'SATISFIED', evaluator: 'devin/glm' }]
			}
		]);
		expect([identityOf({ modelId: 'm' }), identityOf({ displayName: 'd' }), identityOf(undefined)]).toEqual(['m', 'd', null]);
		expect(AUTHORING_FLOOR_POLICIES).toEqual(FLOOR_POLICIES);
	});

	// ⭐ The review in parts, B3 (`REG-D-125`): the floor reviews each type of the PWA as a part, under the type, so the lane's
	// read of the Reasoning Review is the aggregate of the PWA's types' reviews — its strictest.
	it('⭐ given the PWA’s types, the Reasoning Review is their aggregate: a rejected part rejects it, a missing one leaves it MISSING', () => {
		const types = (...ids: string[]) => ids.map((id) => type(id, id.toUpperCase()));
		const review = (rows: { id: string; state: Record<string, unknown> }[], typeIds: string[]) =>
			floorDispositions(rows, PWA_ID, types(...typeIds), oneRound).find((f) => f.policyId === 'floor.reasoning-review');
		const clean = [rr('1', 'SATISFIED', 't1', { modelId: 'glm', providerId: 'devin' }), rr('2', 'SATISFIED', 't2')];
		expect(review(clean, ['t1', 't2'])).toEqual({
			policyId: 'floor.reasoning-review',
			state: 'SATISFIED',
			evaluator: 'devin/glm',
			producer: null,
			parts: [
				{ typeId: 't1', typeName: 'T1', state: 'SATISFIED', evaluator: 'devin/glm' },
				{ typeId: 't2', typeName: 'T2', state: 'SATISFIED', evaluator: null }
			]
		});
		expect(review([...clean, rr('3', 'REJECTED', 't2')], ['t1', 't2'])?.state, 'the strictest part').toBe('REJECTED');
		expect(review([rr('3', 'REJECTED', 't2')], ['t3', 't2'])?.state, 'a rejection is stricter than a missing part').toBe(
			'REJECTED'
		);
		expect(review(clean, ['t1', 't2', 't3'])?.state, 'a type with no review').toBe('MISSING');
		expect(review([rr('1', 'SATISFIED', 't1'), rr('2', 'INCONCLUSIVE', 't2')], ['t1', 't2'])?.state).toBe('INCONCLUSIVE');
		expect(review(clean, [])?.state, 'no type, no review').toBe('MISSING');
		// ⛔ A review of the PWA as a whole counts for no part.
		expect(review([rr('1', 'SATISFIED', PWA_ID)], ['t1'])?.state).toBe('MISSING');
	});

	// ⭐⭐ The review in parts, B6 (`REG-D-125`; design D6; roadmap 9a.7, "Run records") — ONE ROUND, AND ITS COMPLETE PART SET.
	// ⛔ PREDICTED RED, read from the code: given the types, the read took each type's latest review in the WHOLE record, and each
	// deterministic policy's, so a newer round that holds no review of a type borrowed an older round's.
	it('⛔ one round: a newer round that holds no review of a type does not borrow an older round’s, and its deterministic rows are its own', () => {
		const types = [type('t1', 'Plan'), type('t2', 'Build')];
		const older = [
			a('A1', 'floor.schema-invariant', 'SATISFIED', PWA_ID),
			a('A2', 'floor.identity-provenance', 'REJECTED', PWA_ID),
			rr('A3', 'SATISFIED', 't1'),
			rr('A4', 'SATISFIED', 't2')
		];
		const newer = [
			a('B1', 'floor.schema-invariant', 'SATISFIED', PWA_ID),
			a('B2', 'floor.identity-provenance', 'SATISFIED', PWA_ID),
			rr('B3', 'SATISFIED', 't1')
		];
		const read = (rows: { id: string; state: Record<string, unknown> }[]) =>
			floorDispositions(rows, PWA_ID, types, roundOf).map((f) => [
				f.policyId,
				f.state,
				...(f.parts ?? []).map((p) => `${p.typeName} ${p.state}`)
			]);
		expect(read([...older, ...newer]), 'the newer round borrowed an older round’s review of Build').toEqual([
			['floor.schema-invariant', 'SATISFIED'],
			['floor.identity-provenance', 'SATISFIED'],
			['floor.reasoning-review', 'MISSING', 'Plan SATISFIED', 'Build MISSING']
		]);
		// ⭑ CONTROL — the newer round complete: its own parts, and nothing of the older round's rejection.
		expect(read([...older, ...newer, rr('B4', 'SATISFIED', 't2')])).toEqual([
			['floor.schema-invariant', 'SATISFIED'],
			['floor.identity-provenance', 'SATISFIED'],
			['floor.reasoning-review', 'SATISFIED', 'Plan SATISFIED', 'Build SATISFIED']
		]);
		// ⭑ CONTROL — the older round alone is read as it was recorded.
		expect(read(older)).toEqual([
			['floor.schema-invariant', 'SATISFIED'],
			['floor.identity-provenance', 'REJECTED'],
			['floor.reasoning-review', 'SATISFIED', 'Plan SATISFIED', 'Build SATISFIED']
		]);
	});

	it('⛔ never one PWA-subject Reasoning Review: a review of the PWA as a whole neither stands for the row nor names the round', () => {
		const types = [type('t1', 'Plan'), type('t2', 'Build')];
		const round = [
			a('A1', 'floor.schema-invariant', 'SATISFIED', PWA_ID),
			a('A2', 'floor.identity-provenance', 'SATISFIED', PWA_ID),
			rr('A3', 'SATISFIED', 't1'),
			rr('A4', 'REJECTED', 't2')
		];
		const review = (rows: { id: string; state: Record<string, unknown> }[]) =>
			floorDispositions(rows, PWA_ID, types, roundOf).find((f) => f.policyId === 'floor.reasoning-review')?.state;
		expect(review([rr('A0', 'SATISFIED', PWA_ID), ...round]), 'a whole-PWA review stood for the parts').toBe('REJECTED');
		// ⛔ Recorded LAST, under a token of its own, it is still no round: the round is the parts'.
		expect(review([...round, rr('C1', 'SATISFIED', PWA_ID)]), 'a whole-PWA review named the round').toBe('REJECTED');
	});

	it('⭐ each assessment’s token is the correlation of the first event that names it and carries one', () => {
		const tokenOf = correlationsOf([
			{ aggregateId: 'asm_1', correlationId: '' },
			{ aggregateId: 'asm_1', correlationId: 'authoring-floor:run-1' },
			{ aggregateId: 'asm_1', correlationId: 'authoring-floor:run-2' },
			{ aggregateId: 'asm_2', correlationId: 'authoring-floor:run-2' }
		]);
		expect(['asm_1', 'asm_2', 'asm_3'].map(tokenOf)).toEqual(['authoring-floor:run-1', 'authoring-floor:run-2', undefined]);
	});
});

describe('⭐⭐ C4 — the candidate checks: each trap found, and nothing refused (REG-D-110 (4))', () => {
	it('⭐ on the agent’s PWA: the UNDECLARED leaf, the unsupplied marker, and the policy of another kind — each with its register ids; the clean type and the root none', () => {
		const checks = candidateChecks(AGENT_TYPES, AGENT_POLICIES);
		expect(checks.refused).toBe(false);
		expect(checks.findings).toEqual([
			{
				check: 'model-leaf',
				typeId: 'pwutype_verify',
				typeName: 'Verify wordfreq end to end',
				registerIds: ['REG-F-505', 'REG-F-507'],
				detail:
					'a leaf of the tree declares UNDECLARED with no prompt: a model runs it only when it declares MODEL with an ACTIVE prompt'
			},
			{
				check: 'supplied-markers',
				typeId: 'pwutype_build',
				typeName: 'Build wordfreq',
				registerIds: ['REG-F-508'],
				detail:
					'its prompt uses {criteria}, which no work unit supplies (it supplies {subject}, {title}, {description}, {purpose}): its step is refused at render'
			},
			{
				check: 'policy-governs',
				typeId: 'pwutype_build',
				typeName: 'Build wordfreq',
				registerIds: ['REG-F-524'],
				detail:
					'it declares pol_requirement_coverage, which does not govern its kind, PRODUCT_IMPLEMENTATION: and none of its declared policies governs it, so its unit can never be assured'
			}
		]);
		expect(checks.types.map((t) => [t.name, t.leaf, t.namesProduct])).toEqual([
			['Verify wordfreq end to end', true, false],
			['Specify wordfreq', true, true],
			['Build wordfreq', true, false],
			['wordfreq Realization', false, false]
		]);
		expect(CHECK_REGISTER_IDS['prompt-length']).toEqual([]);
	});

	it('⛔ a MODEL leaf whose prompt is DRAFT, and a prompt past the 4,000 characters the reviewer is shown, are each found', () => {
		const draft = { id: 't_d', state: { ...AGENT_TYPES[1]!.state, promptTemplate: prompt('Write {subject}.', 'DRAFT') } };
		const long = { id: 't_l', state: { ...AGENT_TYPES[1]!.state, promptTemplate: prompt(`Write {subject}. ${'x'.repeat(PHASE7_INSTRUCTION_BUDGET)}`) } };
		const found = candidateChecks([draft, long], AGENT_POLICIES).findings.map((f) => [f.typeId, f.check]);
		expect(found).toEqual([
			['t_d', 'model-leaf'],
			['t_l', 'prompt-length']
		]);
	});

	it('⭐ a policy governs a kind as the KERNEL decides: absent or not ACTIVE governs nothing; another kind does not; a rule for a person is undecidable', () => {
		const scoped = AGENT_POLICIES[1]!;
		expect(governanceOf(scoped, 'REQUIREMENT_DEFINITION')).toBe('GOVERNS');
		expect(governanceOf(scoped, 'PRODUCT_IMPLEMENTATION')).toBe('DOES_NOT_GOVERN');
		expect(governanceOf(AGENT_POLICIES[0]!, 'ANY_KIND')).toBe('GOVERNS');
		expect(governanceOf(undefined, 'REQUIREMENT_DEFINITION')).toBe('NOT_AVAILABLE');
		expect(governanceOf({ ...scoped, state: { ...scoped.state, status: 'SUSPENDED' } }, 'REQUIREMENT_DEFINITION')).toBe('NOT_AVAILABLE');
		const expression = { id: 'p_e', state: { status: 'ACTIVE', applicability: { expression: { op: 'RISK_AT_LEAST' } } } };
		expect(governanceOf(expression, 'X')).toBe('UNDECIDABLE');
		// ⭑ HELD TO THE KERNEL ITSELF, case by case: the same rule, the same subject, the same answer.
		expect(policyApplicability(scoped.state.applicability as never, { objectType: 'PROFESSIONAL_WORK_UNIT', pwuKind: 'PRODUCT_IMPLEMENTATION' })).toBe(
			'NOT_APPLICABLE'
		);
		// ⭑ REG-F-524's own case: only when EVERY declared policy fails to govern is the unit unassurable, and the finding says so.
		const mixed = { id: 't_m', state: { ...AGENT_TYPES[2]!.state, requiredAssurancePolicyIds: ['pol_requirement_coverage', 'pol_intent_preservation'] } };
		expect(candidateChecks([mixed], AGENT_POLICIES).findings.find((f) => f.check === 'policy-governs')?.detail).toBe(
			'it declares pol_requirement_coverage, which does not govern its kind, PRODUCT_IMPLEMENTATION'
		);
	});
});

// ── THE SPEC, FROM SOURCE: half B's hands are the operator's acts, on the page ────────────────────────────────────────

describe('⛔ the spec, from source: half B’s hands are the operator’s own acts, and its timeout is ~~extended once~~ ⭐ set afresh on the running test', () => {
	const sf = ts.createSourceFile(
		'phase7.live.ts',
		readFileSync(join(REPO, 'apps/rph-demo/e2e-live-exec/phase7.live.ts'), 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	const flat = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ');
	const properties = (name: string): string[] => {
		const out: string[] = [];
		const visit = (n: ts.Node): void => {
			if (ts.isPropertyAssignment(n) && n.name.getText(sf) === name) out.push(flat(n.initializer));
			ts.forEachChild(n, visit);
		};
		visit(sf);
		return out;
	};

	it('⭐ each authoring hand is the operator’s act on the page, the draft half B’s, the timeout set on the running test', () => {
		expect(properties('createDraft')).toEqual([
			'() => withFreshRequest(base, (request) => createDraftPwa(page, request, PHASE7_HALF_B_DRAFT))'
		]);
		expect(properties('send')).toEqual(['(request) => turn.send(request)']);
		expect(properties('turnRunning')).toEqual(['() => turnRunning(page)']);
		expect(properties('producerLine')).toEqual(['() => turn.producer()']);
		expect(properties('accept')).toEqual(['() => acceptCandidate(page, actionFields)']);
		expect(properties('lifecycle')).toEqual(['(act) => designerAct(page, act, actionFields)']);
		expect(properties('extendTimeout')).toEqual(['(ms) => test.info().setTimeout(ms)']);
	});

	it('⭐ REG-D-112 (finding 1) — the authoring archive is the run folder’s own: the store the server keeps, into lane/archive/00-authoring', () => {
		expect(properties('archiveAuthoring')).toEqual([
			'async (dump) => { await archiveAuthoring({ archiveDir: join(lane.archive, AUTHORING_ARCHIVE), storePath: store, introspect: dump }); }'
		]);
	});
});

describe('⛔ C5 — a half-B run that stopped short of its units has completed nothing', () => {
	// ⭑ Found reviewing E3's own report: the whole run's stage 7 asked every unit, and a half-B run that stopped before its
	// Undertaking — a dry rehearsal, a candidate no one accepted — has none, which every-of-none read as intended.
	it('⛔ no unit: the whole run’s stage 7 is NOT REACHED, never as intended; stage 1 says why the PWA never ran', () => {
		const store = halfBStore({ publication: 'DRAFT' });
		const stopped: StoreRows = {
			...store,
			objects: store.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE')
		};
		const lane = halfBLaneRows({ acceptedHash: null });
		const r = buildRunReport(stopped, { ...lane, run: { ...(lane.run as object), units: [], end: { reason: 'authoring-stopped' } } }, {
			accountNames: NAMES
		}).report;
		expect([cellOf(r, '7', 'whole run').value, cellOf(r, '7', 'whole run').basis]).toEqual([
			'not reached',
			['the run holds no work unit: no Undertaking of the run was instantiated']
		]);
		expect(cellOf(r, '1', 'whole run').value).toBe('broke');
		expect(r.units).toEqual([]);
	});

	it('⭐ a half-B phase’s stage 3 says the prompt is the agent’s, and where the record of its naming the product is', () => {
		const r = buildRunReport(halfBStore({ ran: { pwu_r: 'press', pwu_s: 'model', pwu_b: 'model', pwu_v: 'model' } }), halfBLaneRows(), {
			accountNames: NAMES
		}).report;
		expect(cellOf(r, '3', 'specify-wordfreq').basis).toContain(
			"the prompt is the agent's: whether it names the product is the candidate checks' record (namesProduct; REG-F-510)"
		);
	});
});

// ── ⭐⭐ E3'S REVIEW, AND ITS FINDINGS FIXED (`REG-D-112`) ────────────────────────────────────────────────────────────
// The review of package E3 found eight things in half B; each fix is held here by the test that was RED before it.

/** `rows` written into a record store by the product's own driver — WAL, as the server keeps it. */
function writeStore(file: string, rows: StoreRows): void {
	const db = createSqliteDriver(file);
	try {
		db.exec(SCHEMA_SQL);
		const now = '2026-10-11T12:00:00.000Z';
		const put = db.prepare(
			'INSERT INTO professional_work_objects(id, object_type, aggregate_type, revision, semantic_version, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
		);
		for (const o of rows.objects) put.run(o.id, o.objectType, o.objectType, 1, 1, JSON.stringify(o.state), now, now);
	} finally {
		db.close();
	}
}

const RUN_REPORT = join(REPO, 'scripts', 'phase7', 'run-report.ts');
/** The run report's command line over `run`, spawned under bun as an operator runs it. */
function runReport(run: string): { code: number | null; out: string } {
	const r = spawnSync('bun', [RUN_REPORT, run], { cwd: REPO, encoding: 'utf8', timeout: 120_000 });
	return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** A refusal of a designer act, in the server's words. */
const refusedWith = (error: string): ActionOutcome => ({ ...answered('failure', `[{"error":1},"${error}"]`), decoded: { error } });

describe('⛔ REG-D-112 (E3’s review, 1) — a run that stops during authoring is ARCHIVED, and the run report reads it', () => {
	// ⭐ THE PREDICTED RED: no archive was taken before any authoring end, so a run that stopped there left no store, and the
	// report refused it — `run-report.ts`: *"no archive under lane/archive holds a demo.sqlite"*.
	it(
		'⭐ a run stopped at a candidate the floor did not assure leaves lane/archive/00-authoring, and the run report READS it',
		async () => {
			const store = join(folder('authoring-store'), 'demo.sqlite');
			const drafted = halfBStore({ publication: 'DRAFT' });
			writeStore(store, { ...drafted, objects: drafted.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE') });
			const l = halfBLane({
				paid: true,
				statuses: ['ASSURING', 'BLOCKED_EXTERNAL'],
				detail: 'The review did not produce a usable verdict.',
				archive: async (dump, lane) =>
					void (await archiveAuthoring({ archiveDir: join(lane.archive, AUTHORING_ARCHIVE), storePath: store, introspect: dump }))
			});
			const record = await l.run();
			expect(record.end?.reason).toBe('authoring-stopped');
			const r = runReport(dirname(l.lane.lane));
			expect(r.code, r.out).toBe(0);
			expect(r.out).toContain(`read lane/archive/${AUTHORING_ARCHIVE};`);
			const report = JSON.parse(readFileSync(join(l.lane.lane, 'report', 'report.json'), 'utf8')) as RunReport;
			expect([report.run.half, report.run.endReason, report.run.archiveRead]).toEqual(['B', 'authoring-stopped', AUTHORING_ARCHIVE]);
			expect([cellOf(report, '1', 'whole run').value, cellOf(report, '7', 'whole run').value]).toEqual(['broke', 'not reached']);
		},
		120_000
	);

	it('⛔ EVERY authoring end is archived, once, before the run ends: the candidate, the allowance, the dry stop, a refused act, no candidate, the limit', async () => {
		const ends: Record<string, HalfBScript> = {
			'a candidate not assured': { paid: true, statuses: ['BLOCKED_EXTERNAL'] },
			'the allowance outlasted': { paid: true, statuses: ['ASSURING'] },
			'the dry stop': { paid: false },
			'a refused acceptance': { paid: true, accept: refusedWith('The candidate changed.') },
			'a refused Validate': { paid: true, lifecycle: { validate: refusedWith('The graph is not well formed.') } },
			'no candidate staged': { paid: true, noCandidate: true },
			'the limit before Send': { paid: true, prior: PHASE7_PAID_LIMIT }
		};
		for (const [why, script] of Object.entries(ends)) {
			const l = halfBLane(script);
			const record = await l.run();
			expect(record.units, why).toEqual([]);
			expect(l.only('archiveAuthoring', 'flushPosts', 'beginExecute'), why).toEqual(['archiveAuthoring', 'flushPosts']);
		}
	});

	it('⛔ a throw mid-authoring is archived too, and still ends the run lane-error, its own words kept', async () => {
		const l = halfBLane({ paid: true, acceptThrows: true });
		await expect(l.run()).rejects.toThrow('locator.click: Timeout 120000ms exceeded.');
		expect(l.only('archiveAuthoring', 'flushPosts')).toEqual(['archiveAuthoring', 'flushPosts']);
		expect(l.written().end).toMatchObject({ reason: 'lane-error', detail: 'locator.click: Timeout 120000ms exceeded.' });
	});

	// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~"archived once, before the root's press"~~ — the root's press is
	// the last now; the archive comes before the FIRST press, which is what "before anything ran" always meant.
	it('⭐ an authoring that reached its units is archived once, before the first press: what the published PWA was, before anything ran', async () => {
		const l = halfBLane({ paid: true, signOffs: ALL_SIGNED_OFF });
		await l.run();
		expect(l.only('archiveAuthoring', 'author.createUndertaking', 'beginExecute')).toEqual([
			'author.createUndertaking',
			'archiveAuthoring',
			'beginExecute specify-wordfreq',
			'beginExecute build-wordfreq',
			'beginExecute verify-wordfreq-end-to-end',
			'beginExecute root'
		]);
	});

	it('⭐ the authoring archive: the dump, both stores BACKED UP to a rollback journal, its checks — and written once', async () => {
		const run = folder('authoring-archive');
		const store = join(run, 'demo.sqlite');
		writeStore(store, halfBStore());
		// ⭐ `REG-D-112` (E3's re-review, finding 5) — AND A CONTENT STORE BESIDE IT, in WAL as the server keeps it, one row in
		// it. ⛔ The fixture had none, so the content store was only ever recorded ABSENT, and an archive that sought it
		// elsewhere passed this test.
		const content = createSqliteDriver(`${store}${CONTENT_STORE_SUFFIX}`);
		try {
			content.exec('CREATE TABLE artifact_content (storage_key TEXT PRIMARY KEY, bytes TEXT)');
			content.prepare('INSERT INTO artifact_content (storage_key, bytes) VALUES (?, ?)').run('key-1', '{}');
		} finally {
			content.close();
		}
		expect(journalHeaderOf(`${store}${CONTENT_STORE_SUFFIX}`), 'the content store, as the server keeps it').toEqual([2, 2]);
		const snapshot = { modelExchanges: [{ id: 'x1', state: { plane: 'ASSURANCE' } }], artifacts: [], evidence: [] };
		const request = {
			archiveDir: join(run, 'lane', 'archive', AUTHORING_ARCHIVE),
			storePath: store,
			introspect: { text: `${JSON.stringify(snapshot)}\n`, snapshot } as never
		};
		const checks = await archiveAuthoring(request);
		expect(readdirSync(request.archiveDir).sort()).toEqual(['checks.json', 'demo.sqlite', 'demo.sqlite.content.sqlite', 'introspect.json']);
		for (const name of ['demo.sqlite', 'demo.sqlite.content.sqlite'])
			expect(journalHeaderOf(join(request.archiveDir, name)), name).toEqual([1, 1]);
		const archived = new DatabaseSync(join(request.archiveDir, 'demo.sqlite.content.sqlite'), { readOnly: true });
		try {
			expect(archived.prepare('SELECT storage_key AS key FROM artifact_content').all()).toEqual([{ key: 'key-1' }]);
		} finally {
			archived.close();
		}
		expect([checks.archived.stores.map((s) => [s.name, s.present]), checks.archived.workspace, checks.archived.processOutput]).toEqual([
			[
				['demo.sqlite', true],
				['demo.sqlite.content.sqlite', true]
			],
			{ present: false },
			{ present: false }
		]);
		expect(checks.reviewerCalls.recorded.calls).toBe(1);
		expect(JSON.parse(readFileSync(join(request.archiveDir, 'checks.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(checks)));
		await expect(archiveAuthoring(request)).rejects.toThrow(
			`refused: the archive ${AUTHORING_ARCHIVE} already exists, and an archive is written once`
		);
	});

	it('⭐ the report of a run whose AUTHORING outlasted its allowance names no unit that did: that end is the turn’s', () => {
		const store = halfBStore({ publication: 'DRAFT' });
		const lane = halfBLaneRows();
		const r = buildRunReport(
			{ ...store, objects: store.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE') },
			{ ...lane, run: { ...(lane.run as object), units: [], end: { reason: 'allowance-exceeded' } } },
			{ accountNames: NAMES }
		).report;
		expect(r.problems.filter((p) => p.includes('allowance'))).toEqual([]);
	});
});

describe('⛔ REG-D-112 (E3’s review, 2) — the LIMIT is checked before Send and before the root’s press, ~~each act’s worst case counted~~ ⭐ what each act counts by the one rule as amended (REG-D-114 (14))', () => {
	/**
	 * The authoring floor's worst case: two floor runs, each ~~one review~~ ⭐ (the review in parts, B6) a review of each part, of up
	 * to `reviewerCallsPerTry` calls — ~~8~~ ⭐ 128, ~~counted before Send for the inventory anticipated, sixteen types~~ ⛔ package
	 * L2, D20: Send counts the allowance it hands the authoring review — so here the floor's spend after Send in the root's
	 * arrangements, sixteen parts' worst case, 192.
	 */
	const FLOOR_WORST = phase7AuthoringReviewerCalls(SIXTEEN);
	/** ⭐ Package L2 — D20 — what Send's check says it counted, restated: the allowance the lane hands the authoring review. */
	const COUNTED_ALLOWANCE = 'the allowance the lane hands the authoring review, which no round of its floor may pass';
	/** ⭐ D20 — the calls spent before P6 again, as planned (design D20): 2,400 − 1,117 − 4 = 1,279 handed over. */
	const PLANNED_PRIOR = 1117;
	/**
	 * ~~A model unit's worst case, as its allowance counts it: each try's review, and each reviewed command's — 140.~~ ~~⭐
	 * `REG-D-114` (14), as amended 2026-10-16 — what a MODEL root counts before its press: ONE TRY'S RESERVE, a review of up to
	 * `reviewerCallsPerTry` calls — 4, D8's own rule.~~ ⭐⭐ `JAN-EXEC` Phase 7, package L — D16 (`REG-D-135` (4); design D16): what a
	 * MODEL root counts before its press is the press's WHOLE worst case, (3 tries + 32 retained command runs) × 6 calls = 210 —
	 * the sponsor's ruling replaces the one try's reserve. ⛔ Restated, never read from the lane.
	 */
	const WHOLE_PRESS = (3 + 32) * 6;
	const COUNTED_PRESS = 'its whole press’s worst case, (3 tries + 32 command runs) × 6 calls';
	/** The prior that lets Send through, and brings a MODEL root's whole press, the floor having spent `floor`, to the limit. */
	const rootReaching = (floor: number) => PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS - floor;

	// ⭐ THE PREDICTED RED: half B pressed Send with no check — the first was before the first PHASE, after the authoring
	// floor's reviews and a model root's had been spent.
	// ⭐⭐ MOVED DELIBERATELY by package L2 — D20 (`REG-F-580`; the brief's step 3): ~~"the authoring floor's worst case past the
	// limit"~~ — Send's check counts THE ALLOWANCE THE LANE HANDS THE AUTHORING REVIEW (`phase7AuthoringReviewAllowance`), with the
	// calls already recorded and the negative control's 4, never `phase7AuthoringReviewerCalls(PHASE7_AUTHORING_ANTICIPATED_PARTS)`,
	// the estimate for sixteen anticipated types. The allowance is the limit less the prior calls and the 4, so with nothing
	// recorded the check reaches the limit exactly; past it, the calls already recorded carry it — and it presses nothing.
	// ⛔ PREDICTED RED, read from the code at 59135143: the check counted 192, so 1,117 + 1 + 4 + 192 = 1,314 let Send through.
	it('⭐ the allowance it hands over, with the calls already recorded, past the limit: half B refuses BEFORE SEND — nothing sent, the run ends paid-limit, the check kept', async () => {
		const allowance = phase7AuthoringReviewAllowance(PLANNED_PRIOR);
		expect(allowance, 'arrangement: the allowance handed over at P6 again’s planned spend').toBe(1279);
		const l = halfBLane({ paid: true, prior: PLANNED_PRIOR, recordedBeforeSend: 1 });
		const record = await l.run();
		expect(l.only('author.send', 'beginExecute'), 'Send was pressed past the limit').toEqual([]);
		expect([record.end?.reason, record.authoring?.sent]).toEqual(['paid-limit', false]);
		expect(record.authoring?.limitCheck).toEqual({
			prior: PLANNED_PRIOR,
			recorded: 1,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: allowance,
			counted: COUNTED_ALLOWANCE,
			total: PHASE7_PAID_LIMIT + 1,
			limit: PHASE7_PAID_LIMIT,
			allowed: false
		});
		expect(record.end?.detail).toBe(
			`the limit, before Send: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls, the allowance of ${allowance} ` +
				'the lane hands the authoring review counted (D8; REG-D-112; design D20)'
		);
	});

	it('⭐ ⛔ D20 — calls spent before the run past the limit less the reserve: the allowance is none, and Send is refused', async () => {
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE + 1;
		const l = halfBLane({ paid: true, prior });
		const record = await l.run();
		expect(l.only('author.send')).toEqual([]);
		expect(record.authoring?.limitCheck).toMatchObject({ ahead: 0, total: PHASE7_PAID_LIMIT + 1, allowed: false });
	});

	// ⭐ MOVED DELIBERATELY with the case above (package L2 — D20): ~~"one call fewer spent, the worst case fits the limit
	// exactly"~~ — nothing recorded, the allowance brings the check to the limit exactly, and Send is pressed.
	it('⭐ CONTROL — nothing recorded before Send: the allowance it hands over brings the check to the limit exactly, Send is pressed, and the run goes on', async () => {
		const l = halfBLane({ paid: true, prior: PLANNED_PRIOR });
		const record = await l.run();
		expect(l.only('author.send')).toEqual(['author.send']);
		expect(record.authoring?.limitCheck).toEqual({
			prior: PLANNED_PRIOR,
			recorded: 0,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: phase7AuthoringReviewAllowance(PLANNED_PRIOR),
			counted: COUNTED_ALLOWANCE,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
	});

	// ⭐ Package L — D16 (`REG-D-135` (4)): MOVED DELIBERATELY to the whole-press count — ~~one try's reserve~~, 4 → 210.
	it('⭐ a MODEL root’s ~~worst case~~ ~~one try’s reserve~~ ⭐ whole press is counted before its press: past the limit the root is never pressed; a root that runs no model is pressed at the same count, counting none', async () => {
		// ⭐ `REG-D-114` (14), as amended 2026-10-16 — ~~prior: the limit less the reserve and a model unit's 140, plus one~~: the
		// floor spends its worst case after Send, and the root's ~~one try's reserve~~ ⭐ whole press (D16) then passes the limit by
		// one call.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~`prior: rootReaching(FLOOR_WORST) + 1`, no unit pressed~~ — the
		// root is pressed LAST now, after its three children, each of whose checks counts a whole press too: so each child's
		// check reaches the limit exactly, the last child spends one call, and the MODEL root's then passes it by one.
		const prior = rootReaching(FLOOR_WORST);
		const model = halfBLane({
			paid: true,
			prior,
			types: MODEL_ROOT_TYPES,
			floorCalls: FLOOR_WORST,
			unitCalls: { pwu_v: 1 },
			signOffs: ALL_SIGNED_OFF
		});
		const refused = await model.run();
		expect([model.only('author.send'), model.only('beginExecute root')]).toEqual([['author.send'], []]);
		expect(model.only('beginExecute'), 'arrangement: the three children are pressed').toHaveLength(3);
		expect([refused.end?.reason, refused.units[0]?.limitCheck]).toEqual([
			'paid-limit',
			{
				prior,
				recorded: FLOOR_WORST + 1,
				reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
				ahead: WHOLE_PRESS,
				counted: COUNTED_PRESS,
				total: PHASE7_PAID_LIMIT + 1,
				limit: PHASE7_PAID_LIMIT,
				allowed: false
			}
		]);
		// ⛔ Round 4's check, F2 — the end's words say what the check counted, as its read records it: ~~one try's reserve~~ ⭐ the
		// whole press (D16). They said "its worst case of 4 counted", which the root's check no longer counts (`REG-D-114` (14), as
		// amended). ⭐ D16: and they cite the ruling the count is now, `REG-D-135` (4).
		expect(refused.end?.detail).toBe(
			`the limit, before the root’s press: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls, ${WHOLE_PRESS} ` +
				`ahead (${COUNTED_PRESS}) counted (D8; REG-D-112; REG-D-135 (4))`
		);
		const human = halfBLane({ paid: true, prior, floorCalls: FLOOR_WORST, unitCalls: { pwu_v: 1 }, signOffs: ALL_SIGNED_OFF });
		const pressed = await human.run();
		expect(human.only('beginExecute root')).toEqual(['beginExecute root']);
		expect(pressed.units[0]?.limitCheck).toMatchObject({ ahead: 0, counted: 'none: it runs no model', allowed: true });
	});

	it('⛔ round 4’s check, F2 — CONTROL: a root that runs no model, refused, ends with words saying it counted none — read from its check, never fixed text', async () => {
		// Arrangement: Send's check let the run through, so the root's, counting none, is refused only when the store records
		// more reviewer calls after Send than the floor's worst case — here 4 more, past the limit by one.
		// ⭐ Package L — D16: ~~4 more~~ — the root's whole press more than the floor's worst case (the arrangement's own arithmetic).
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~`prior: rootReaching(FLOOR_WORST) + 1`, the floor spending its
		// worst case and a whole press more~~ — the root is pressed after its children, each check counting a whole press, so
		// they pass exactly at the limit and the calls that refuse the root come after them: the last child's Record Assurance
		// spends a whole press and one more, and the root, counting none, is then one call past it.
		const prior = rootReaching(FLOOR_WORST);
		const l = halfBLane({
			paid: true,
			prior,
			floorCalls: FLOOR_WORST,
			signOffs: { ...ALL_SIGNED_OFF, 'verify-wordfreq-end-to-end': { ra: answered('success'), calls: WHOLE_PRESS + 1 } }
		});
		const record = await l.run();
		expect(l.only('beginExecute root'), 'arrangement: the root that runs no model is held back').toEqual([]);
		expect(record.units[0]?.limitCheck).toMatchObject({ ahead: 0, counted: 'none: it runs no model', allowed: false });
		expect([record.end?.reason, record.end?.detail]).toEqual([
			'paid-limit',
			`the limit, before the root’s press: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls, 0 ahead ` +
				'(none: it runs no model) counted (D8; REG-D-112; REG-D-135 (4))'
		]);
	});

	// ⭐ Package L — D16 (`REG-D-135` (4)): MOVED DELIBERATELY — ~~ONE TRY’S RESERVE~~ the WHOLE PRESS reaching the limit exactly.
	it('⛔ D16 (REG-D-135 (4)) — a MODEL root whose WHOLE PRESS brings the total EXACTLY to the limit is pressed', async () => {
		// ⛔ PREDICTED RED, read from the code: before a MODEL root's press the one rule counted a model unit's WORST CASE, 140
		// (`REG-D-112`, finding 2), so a root whose one try's reserve reaches the limit exactly was never pressed. ⭐ Package L:
		// now it counts one try's reserve, 4, so its record says 4 ahead where the whole press, 210, reaches the limit.
		// ⭑ Package M (D6, D7) — its children first, each at the limit exactly, spending nothing, each signed off.
		const prior = rootReaching(FLOOR_WORST);
		const l = halfBLane({ paid: true, prior, types: MODEL_ROOT_TYPES, floorCalls: FLOOR_WORST, signOffs: ALL_SIGNED_OFF });
		const record = await l.run();
		expect(l.only('beginExecute root'), 'a MODEL root whose whole press reaches the limit was held back').toEqual([
			'beginExecute root'
		]);
		expect(record.units[0]?.limitCheck).toEqual({
			prior,
			recorded: FLOOR_WORST,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: WHOLE_PRESS,
			counted: COUNTED_PRESS,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
	});
});

describe('⛔ the merge’s fix round, F2 and F3 — the run report reads half B’s reads of the limit as the lane made them', () => {
	/**
	 * The authoring floor's worst case, ~~counted before Send~~: ~~8~~ ⭐ (the review in parts, B6) 128, for sixteen ~~anticipated~~
	 * types ⛔ — package L2, D20: Send counts the allowance it hands the authoring review; this is the floor's spend after Send
	 * that the arrangement stages, 192.
	 */
	const FLOOR_WORST = phase7AuthoringReviewerCalls(SIXTEEN);
	/**
	 * ~~A MODEL root's worst case, counted before its press: 140.~~ ~~⭐ `REG-D-114` (14), as amended 2026-10-16 — what a MODEL
	 * root counts before its press: one try's reserve, 4.~~ ⭐ Package L — D16 (`REG-D-135` (4)): its whole press, 210, restated.
	 */
	const WHOLE_PRESS = (3 + 32) * 6;
	/**
	 * A paid half-B run whose MODEL root's read before its press totals the limit EXACTLY, reported from the lane's own record.
	 * ⭐ `REG-D-114` (14), as amended — the authoring floor spends its worst case after Send, so Send's read stays under the
	 * limit and the root's, ~~one try's reserve~~ ⭐ its whole press (D16) ahead, reaches it.
	 */
	const atTheLimit = async () => {
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS - FLOOR_WORST;
		// ⭑ Package M (D6, D7) — the children signed off, so the root, pressed last, is reached.
		const l = halfBLane({ paid: true, prior, types: MODEL_ROOT_TYPES, floorCalls: FLOOR_WORST, signOffs: ALL_SIGNED_OFF });
		await l.run();
		const record = l.written();
		const report = buildRunReport(
			halfBStore({ types: MODEL_ROOT_TYPES }),
			{ ...halfBLaneRows({ types: MODEL_ROOT_TYPES }), run: record },
			{ accountNames: NAMES }
		).report;
		return { prior, record, report, md: renderMarkdown(report) };
	};

	it('⛔ F2 — the root’s read before its press, by the rule that lets an act REACH the limit (~~`limitCheckAhead`~~ ⭐ the one rule, `limitCheck`), totals it exactly: it reads “at it”, never “under it”', async () => {
		// ⛔ PREDICTED RED, read from the code: `limitFigures` worded every read the lane let through "under it" — written for
		// `limitCheck`, under which an act is let through only below the limit.
		const { prior, record, md } = await atTheLimit();
		expect(record.units[0]?.limitCheck, 'arrangement: the root’s read totals the limit, and its press is let through').toMatchObject({
			total: PHASE7_PAID_LIMIT,
			allowed: true
		});
		expect(md).toContain(
			`  - root, before its Begin & Execute: ${prior} + ${FLOOR_WORST} + ${PHASE7_NEGATIVE_CONTROL_RESERVE} + ${WHOLE_PRESS} ahead ` +
				`(its whole press’s worst case, (3 tries + 32 command runs) × 6 calls) = ${PHASE7_PAID_LIMIT} of ${PHASE7_PAID_LIMIT}, at it, which this act may reach.`
		);
		expect(md, 'a total equal to the limit reads as under it').not.toContain(`= ${PHASE7_PAID_LIMIT} of ${PHASE7_PAID_LIMIT}, under it`);
	});

	it('⛔ F3 — the authoring’s read before Send, half B’s first read of the limit, is listed among the lane’s reads, first', async () => {
		// ⛔ PREDICTED RED, read from the code: `laneLimitChecks` was built from the units' records alone, and nothing in the
		// report read `authoring.limitCheck`, so the read that guards half B's first paid act was in no list.
		// ⭐ MOVED DELIBERATELY by package L2 — D20: ~~the floor's worst case for 16 anticipated types, under the limit~~ — Send's read
		// counts the allowance the lane hands the authoring review, so with nothing recorded it reads at the limit, which Send may
		// reach.
		const { prior, record, report, md } = await atTheLimit();
		const allowance = phase7AuthoringReviewAllowance(prior);
		const total = prior + PHASE7_NEGATIVE_CONTROL_RESERVE + allowance;
		expect(total, 'arrangement: Send’s read reaches the limit').toBe(PHASE7_PAID_LIMIT);
		expect(record.authoring?.limitCheck, 'arrangement: the lane read the limit before Send').toMatchObject({ total, allowed: true });
		expect(
			report.reviewerCalls.laneLimitChecks.map((c) => [c.unit, c.before, c.total, c.allowed])[0],
			'the authoring’s read before Send is not the first of the lane’s reads'
		).toEqual(['authoring', 'Send', total, true]);
		expect(md).toContain(
			`  - authoring, before Send: ${prior} + 0 + ${PHASE7_NEGATIVE_CONTROL_RESERVE} + ${allowance} ahead (the allowance the lane ` +
				`hands the authoring review, which no round of its floor may pass) = ${total} of ${PHASE7_PAID_LIMIT}, at it, which this act may reach.`
		);
	});
});

describe('⭐⭐ The merge of E12 and E3 (J1, J2) — half B’s sign-offs count the declared reviews of the PUBLISHED PWA, read from the store, and E12’s rule re-runs those that did not conclude', () => {
	/** One declared review's worst case in reviewer calls (`signOffWorstCase`): its call and its repair, each run once more. */
	const PER_POLICY = LANE_BUDGET.reviewerCallsPerTry;
	/** Five policies — one more than any unit of §3.2 declares (`PHASE7_DECLARED_POLICIES_PER_UNIT`, the lane's fallback). */
	const FIVE = [
		'pol_requirement_coverage',
		'pol_intent_preservation',
		'pol_design_traceability',
		'pol_test_adequacy',
		'pol_fitness_for_purpose'
	];
	/** The agent's PWA, its "Specify wordfreq" declaring the five. */
	const FIVE_POLICY_TYPES: ObjectRow[] = AGENT_TYPES.map((t) =>
		t.id === 'pwutype_specify' ? { id: t.id, state: { ...t.state, requiredAssurancePolicyIds: FIVE } } : t
	);
	const refusal = (error: string): ActionOutcome => ({
		...answered('failure', `[{"error":1},"${error}"]`),
		decoded: { error }
	});

	// ⛔ THE PREDICTED RED (J1): E12 counts a sign-off's worst case from §3.2's PWA by the unit's TITLE (`signOffWorstCase`),
	// and no title of the agent's is one of §3.2's — so every half-B unit was counted at the fallback, four policies, and one
	// that declares five was pressed past the limit.
	it('⛔ J1 — an agent’s unit declaring FIVE policies is held back where four would have fit: its sign-off’s worst case is the store’s, 5 × ~~4~~ 6', async () => {
		// ~~⭐ R3-B's fix round (F1) — the prior alone one call past the five's worst case: each phase counts its worst case,
		// a model unit's, so the prior lets each phase through exactly at the limit and the last phase, Verify, spends the
		// rest: the sign-off reads the same calls as before.~~ ⭐ `REG-D-114` (14), as amended 2026-10-16 — each phase counts one
		// try's reserve, and ~~the prior alone~~ ⭐ the calls spent before the sign-off are one call past the five's worst case
		// again: every phase's check is under the limit ⭐ and Send's reaches it.
		const spent = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - FIVE.length * PER_POLICY + 1;
		// ~~⭐ The review in parts, B6 — Send now counts the floor's worst case for sixteen anticipated types, 128: the prior is what
		// lets Send reach the limit exactly, and the floor's recorded calls bring the run to the calls spent before the sign-off.~~
		// ⭐ Package L — D16 (`REG-D-135` (4)): each phase's check counts its whole press, (3 + 32) × 6 = 210, so the prior is what
		// lets each phase reach the limit at most, and the LAST phase, Verify, spends the rest (`spentBySignOff`'s arrangement in
		// half A): Send's read, the floor spending nothing, stays under it.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6): ~~the LAST phase, Verify, spending the rest, every phase pressed before
		// the sign-off~~ — Specify's sign-off follows its own press, so Specify spends the rest, and nothing is pressed after
		// the limit holds its sign-off back.
		const WHOLE_PRESS = (3 + 32) * 6;
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS;
		const specifyCalls = spent - prior;
		expect(
			spent + PHASE7_NEGATIVE_CONTROL_RESERVE + 4 * PER_POLICY,
			'arrangement: four policies’ worst case would fit'
		).toBeLessThan(PHASE7_PAID_LIMIT);
		const l = halfBLane({
			paid: true,
			prior,
			floorCalls: 0,
			unitCalls: { pwu_s: specifyCalls },
			types: FIVE_POLICY_TYPES,
			signOffs: { 'specify-wordfreq': { ra: answered('success') } }
		});
		const record = await l.run();
		expect(l.only('beginExecute'), 'arrangement: Specify is pressed, and nothing after the limit stops the lane').toEqual([
			'beginExecute specify-wordfreq'
		]);
		expect(l.only('recordAssurance', 'offersRecordAssurance'), 'a sign-off was pressed past the limit').toEqual([
			'offersRecordAssurance specify-wordfreq'
		]);
		expect(record.units[1]!.signOff?.limitCheck).toEqual({
			prior,
			recorded: specifyCalls,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: FIVE.length * PER_POLICY,
			counted: 'its declared reviews’ worst case',
			total: PHASE7_PAID_LIMIT + 1,
			limit: PHASE7_PAID_LIMIT,
			allowed: false
		});
		expect(record.end?.reason).toBe('paid-limit');
	});

	it('⭐ J1 — the store’s count is the kernel’s DECLARED set (`declaredAssurancePolicyIds`): the unit’s own policies and its type’s, each counted once', async () => {
		// ⭑ Package M (D6, D7) — each signed off, so the root, pressed last, is reached and its sign-off read too.
		const l = halfBLane({
			paid: true,
			units: AGENT_UNITS.map((u) =>
				u.id === 'pwu_s' ? { ...u, policies: ['pol_requirement_coverage', 'pol_extra'] } : u
			),
			signOffs: ALL_SIGNED_OFF
		});
		const record = await l.run();
		// ⭑ Specify: its own two and its type's two share one — three. Every other unit's own are its type's — one each.
		expect(record.units.map((u) => [u.slug, u.signOff?.limitCheck?.ahead])).toEqual([
			['root', PER_POLICY],
			['specify-wordfreq', 3 * PER_POLICY],
			['build-wordfreq', PER_POLICY],
			['verify-wordfreq-end-to-end', PER_POLICY]
		]);
	});

	it('⭐ J2 — E12’s rule acts on half B’s units too (REG-D-112 (a)): a Record Assurance refused whose row offers re-running the declared reviews that did not conclude has them re-run ONCE — the limit read first, its worst case the store’s — and Mark Satisfied follows', async () => {
		const l = halfBLane({
			paid: true,
			signOffs: {
				'build-wordfreq': {
					ra: refusal('pol_requirement_coverage did not conclude: the reviewer’s call failed'),
					rerun: { offered: true, outcome: answered('success') }
				}
			}
		});
		const record = await l.run();
		expect(l.calls.filter((c) => c.endsWith(' build-wordfreq'))).toEqual([
			'beginExecute build-wordfreq',
			'recordAssurance build-wordfreq',
			'offersDeclaredRerun build-wordfreq',
			'rerunDeclared build-wordfreq',
			'markSatisfied build-wordfreq'
		]);
		const build = record.units.find((u) => u.slug === 'build-wordfreq')!.signOff!;
		expect([build.rerunLimitCheck?.ahead, build.rerunLimitCheck?.allowed, build.rerunDeclared?.envelopeType, build.refused]).toEqual([
			PER_POLICY,
			true,
			'success',
			null
		]);
		// ⛔ MOVED 2026-10-26 (package O; design D24) — ~~`toBe('complete')`~~: only Build's row offers a sign-off here, so the other
		// children are never accepted and the root never offered — the run ends `withheld`, each named.
		expect(record.end?.reason).toBe('withheld');
	});

	// ── ⛔ R3-B F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (15)) — HALF B'S SIGN-OFF TIME BOUNDS
	// COME FROM THE UNIT'S DECLARED POLICIES AS THE STORE HOLDS THEM (`declaredPolicyIdsOf`), as J1's limit does: Record
	// Assurance's, the rule's re-run of the declared reviews, and the test's timeout. Half A's stay §3.2's.
	/** One declared review at its bound: its call, retry and repair, each `reviewerCallMs` — 960 s. */
	const REVIEW_MS = PER_POLICY * LANE_BUDGET.reviewerCallMs;

	it('⛔ R3-B F2 — an agent’s unit declaring FIVE policies has its Record Assurance, and the rule’s re-run of its declared reviews, given a bound that covers FIVE reviews; one declaring one, one review', async () => {
		// ⛔ PREDICTED RED, read from the code: the lane handed its sign-off presses no bound, and each press waited
		// `PHASE7_RECORD_ASSURANCE_MS` — §3.2's four policies' reviews, 4,140 s — whatever the unit declared.
		const l = halfBLane({
			paid: true,
			types: FIVE_POLICY_TYPES,
			signOffs: {
				'specify-wordfreq': {
					ra: refusal('pol_test_adequacy did not conclude: the reviewer’s call failed'),
					rerun: { offered: true, outcome: answered('success') }
				},
				'build-wordfreq': { ra: answered('success') },
				// ⭑ Package M (D6, D7) — Verify signed off too, so the root, pressed last, is reached.
				'verify-wordfreq-end-to-end': { ra: answered('success') }
			}
		});
		await l.run();
		const FIVE_REVIEWS = PHASE7_SIGN_OFF_MS + FIVE.length * REVIEW_MS;
		const ONE_REVIEW = PHASE7_SIGN_OFF_MS + REVIEW_MS;
		expect(FIVE_REVIEWS, 'arrangement: five reviews pass §3.2’s four').toBeGreaterThan(PHASE7_SIGN_OFF_MS + 4 * REVIEW_MS);
		expect(l.bounds, 'a sign-off press was not given the bound of its unit’s own declared reviews').toEqual([
			['recordAssurance specify-wordfreq', FIVE_REVIEWS],
			['rerunDeclared specify-wordfreq', FIVE_REVIEWS],
			['recordAssurance build-wordfreq', ONE_REVIEW],
			['recordAssurance verify-wordfreq-end-to-end', ONE_REVIEW],
			['recordAssurance root', ONE_REVIEW]
		]);
	});

	it('⛔ R3-B F2 — half B’s timeout counts each unit’s sign-off by the policies the store says it declares: five reviews for the unit declaring five, one for each declaring one', async () => {
		// ⛔ PREDICTED RED, read from the code: the timeout counted every unit's sign-off as one of four declared policies
		// (`PHASE7_SIGN_OFF_UNIT_MS`), the agent's units read for their number alone.
		const l = halfBLane({ paid: true, types: FIVE_POLICY_TYPES });
		await l.run();
		/** One unit's sign-off at its bounds, for `policies`: its reviews counted twice — Record Assurance's, and the rule's re-run's. */
		const share = (policies: number) => PHASE7_SIGN_OFF_UNIT_MS + 2 * (policies - 4) * REVIEW_MS;
		// ⭑ The review in parts, B6 — after the timeout the wait carried for the four types its turn staged.
		expect(l.timeouts, 'half B’s timeout counted a sign-off at §3.2’s four policies').toEqual([
			phase7HalfBAuthoringTimeoutMs(4),
			PHASE7_TEST_TIMEOUT_MS -
				PHASE7_PER_PHASE_MS +
				phase7AuthoringMs(4) -
				4 * PHASE7_SIGN_OFF_UNIT_MS +
				share(1) +
				share(FIVE.length) +
				share(1) +
				share(1)
		]);
	});
});

describe('⭐ The merge of E12 and E3 (J5) — the run report reads half B’s declared verdicts as it reads half A’s: the latest per (unit, policy), the MODEL root’s among them', () => {
	// ⭑ THE PREDICTED REDS, each a mutation the ledger already holds, applied by hand to this test: E3-M81 (the root skipped by
	// its place) drops the MODEL root's 5b cell; E12-M125 (every declared verdict speaks) reads Build's first review, which did
	// not conclude, as speaking.
	it('⭐ J5 — a re-run’s verdict speaks for an agent’s unit, the review it replaced listed as history; the MODEL root has a 5b cell of its own; the heading counts the verdicts that speak', () => {
		const ran = { pwu_r: 'model', pwu_s: 'model', pwu_b: 'model', pwu_v: 'model' } as const;
		const declared = [
			{ id: 'asm_b_first', unit: 'pwu_b', policy: 'pol_requirement_coverage', state: 'INCONCLUSIVE', at: '2026-10-11T10:00:00.000Z', answered: false },
			{ id: 'asm_b_rerun', unit: 'pwu_b', policy: 'pol_requirement_coverage', state: 'SATISFIED', at: '2026-10-11T11:00:00.000Z', answered: true },
			{ id: 'asm_r', unit: 'pwu_r', policy: 'pol_intent_preservation', state: 'SATISFIED', at: '2026-10-11T12:00:00.000Z', answered: true }
		];
		const r = buildRunReport(
			halfBStore({ types: MODEL_ROOT_TYPES, ran, declared }),
			halfBLaneRows({ types: MODEL_ROOT_TYPES }),
			{ accountNames: NAMES }
		).report;
		const build = cellOf(r, '5b', 'build-wordfreq');
		expect([build.value, build.basis.at(-1)]).toEqual([
			'as intended',
			'listed as history: pol_requirement_coverage INCONCLUSIVE (asm_b_first, broke), superseded by asm_b_rerun'
		]);
		const root = cellOf(r, '5b', 'root');
		expect([root.value, root.basis[1]]).toEqual(['as intended', 'verdicts: pol_intent_preservation SATISFIED']);
		expect([
			r.declaredVerdicts.rows.map((d) => d.assessmentId),
			r.declaredVerdicts.history.map((d) => d.assessmentId),
			r.declaredVerdicts.expected
		]).toEqual([['asm_b_rerun', 'asm_r'], ['asm_b_first'], 5]);
		// ⭐ E12's UNIT_PURPOSE caveat names the agent's composite, the root, and the one review the model made of it.
		expect(r.answer.alwaysStated.filter((s) => s.startsWith('UNIT_PURPOSE framing'))).toEqual([
			expect.stringContaining('(root: 1)')
		]);
	});
});

describe('⭐ REG-D-112 (E3’s review, 3) — REG-F-505’s check is scoped to model LEAVES, as C4’s is: a three-level tree can read as intended', () => {
	const ALL_RAN = { pwu_sr: 'press', pwu_sd: 'press', pwu_sb: 'press', pwu_rv_d: 'model', pwu_rv_b: 'model' } as const;
	const reportOf = (ran: Readonly<Record<string, 'model' | 'press'>>) =>
		buildRunReport(halfBStore({ types: SHARED_TYPES, units: SHARED_UNITS, ran }), halfBLaneRows({ types: SHARED_TYPES, units: SHARED_UNITS }), {
			accountNames: NAMES
		}).report;

	// ⭐ THE PREDICTED RED: a composite between the root and the leaves runs no model by design, and read as REG-F-505.
	it('⭐ the COMPOSITES, which run no model by design, read as intended at stages 3 and 7 — and so does the whole run', () => {
		const r = reportOf(ALL_RAN);
		expect(
			['design-wordfreq', 'build-wordfreq'].map((slug) => [cellOf(r, '3', slug).value, cellOf(r, '7', slug).value, cellOf(r, '7', slug).registerIds])
		).toEqual([
			['as intended', 'as intended', []],
			['as intended', 'as intended', []]
		]);
		expect(cellOf(r, '3', 'design-wordfreq').basis[0]).toContain('a composite of the tree');
		expect(cellOf(r, '7', 'whole run').value).toBe('as intended');
	});

	it('⛔ CONTROL — a model LEAF of that tree that SUCCEEDED with no model run is still broke, REG-F-505, and so is the whole run', () => {
		const r = reportOf({ ...ALL_RAN, pwu_rv_b: 'press' });
		expect([cellOf(r, '3', 'review-wordfreq-2').registerIds, cellOf(r, '7', 'review-wordfreq-2').registerIds]).toEqual([
			['REG-F-505'],
			['REG-F-505']
		]);
		expect(cellOf(r, '7', 'whole run').value).toBe('broke');
	});
});

describe('⭐ REG-D-112 (E3’s review, 4) — stage 2 counts per (parent, type), as instantiation plans it: a shared child is no duplicate', () => {
	const stageTwoOf = (types: readonly ObjectRow[], units: readonly AgentUnit[]): MatrixCell =>
		cellOf(buildRunReport(halfBStore({ types, units }), halfBLaneRows({ types, units }), { accountNames: NAMES }).report, '2', 'whole run');

	// ⭐ THE PREDICTED RED: a type two parents permit was counted once per permitting parent, so its two units read as
	// "more than one work unit" — while instantiation (`planComposition`) builds it once under each.
	it('⭐ a child type two parents share, built once under each: stage 2 as intended, never "more than one work unit"', () => {
		const two = stageTwoOf(SHARED_TYPES, SHARED_UNITS);
		expect([two.value, two.basis]).toEqual([
			'as intended',
			[
				'5 work units, one for each mandatory child under each parent, as instantiation plans the published PWA (planComposition), the root over them all',
				'the PWA declares no conditional child, so none went unoffered (REG-F-516)'
			]
		]);
	});

	it('⛔ DUPLICATED — two units of one type under ONE parent: broke, naming the type and the parent', () => {
		const twice = stageTwoOf(SHARED_TYPES, [...SHARED_UNITS, { id: 'pwu_rv_d2', typeId: 'pwutype_s_review', title: 'Review wordfreq', parent: 'pwu_sd' }]);
		expect([twice.value, twice.basis]).toEqual(['broke', ['more than one work unit for Review wordfreq under Design wordfreq']]);
	});

	it('⛔ ORPHANED — a unit whose parent is no unit of the Undertaking: broke, naming it, and the place it is missing from', () => {
		const lost = stageTwoOf(
			AGENT_TYPES,
			AGENT_UNITS.map((u) => (u.id === 'pwu_b' ? { ...u, parent: 'pwu_gone' } : u))
		);
		expect([lost.value, lost.basis]).toEqual([
			'broke',
			['no work unit for Build wordfreq under wordfreq Realization', 'the build-wordfreq unit’s parent is no unit of the Undertaking']
		]);
	});

	it('⛔ MISSING under one parent though built under the other: broke, naming the parent it is missing under; and a unit the plan does not make', () => {
		const short = stageTwoOf(SHARED_TYPES, SHARED_UNITS.filter((u) => u.id !== 'pwu_rv_b'));
		expect([short.value, short.basis]).toEqual(['broke', ['no work unit for Review wordfreq under Build wordfreq']]);
		const stray = stageTwoOf(AGENT_TYPES, [...AGENT_UNITS, { id: 'pwu_x', typeId: 'pwutype_specify', title: 'Specify wordfreq', parent: 'pwu_b' }]);
		expect([stray.value, stray.basis]).toEqual([
			'broke',
			['the specify-wordfreq-2 unit is not one the published PWA’s plan makes under its parent, Build wordfreq']
		]);
	});

	// ⭐ THE GENERAL FORM (`REG-D-112`): counted by type alone, one parent's missing unit was HIDDEN by another's duplicate —
	// two reviews under one parent and none under the other read as one type built twice, the missing one never named.
	it('⛔ both units of a shared child under ONE parent: a duplicate there, and the other parent’s MISSING — never hidden by it', () => {
		const lopsided = stageTwoOf(
			SHARED_TYPES,
			SHARED_UNITS.map((u) => (u.id === 'pwu_rv_b' ? { ...u, parent: 'pwu_sd' } : u))
		);
		expect([lopsided.value, lopsided.basis]).toEqual([
			'broke',
			['no work unit for Review wordfreq under Build wordfreq', 'more than one work unit for Review wordfreq under Design wordfreq']
		]);
	});

	it('⛔ a tree whose permitted child resolves to no type: broke, saying instantiation refuses it', () => {
		const types = AGENT_TYPES.map((t) =>
			t.state.isRoot === true
				? { id: t.id, state: { ...t.state, permittedChildTypeIds: [...(t.state.permittedChildTypeIds as string[]), 'pwutype_ghost'] } }
				: t
		);
		const ghost = stageTwoOf(types, AGENT_UNITS);
		expect([ghost.value, ghost.basis]).toEqual([
			'broke',
			['the published PWA’s tree does not resolve, wordfreq Realization → pwutype_ghost: instantiation refuses it']
		]);
	});

	it('⭐ the CONDITIONAL children are named, never offered (REG-F-516) — and stage 2 still reads as intended', () => {
		const extend: ObjectRow = {
			id: 'pwutype_extend',
			state: { pwaId: PWA_ID, name: 'Extend wordfreq', pwuKind: 'PRODUCT_IMPLEMENTATION', isRoot: false, permittedChildTypeIds: [], status: 'ACTIVE' }
		};
		const types = AGENT_TYPES.map((t) =>
			t.state.isRoot === true
				? {
						id: t.id,
						state: {
							...t.state,
							permittedChildTypeIds: [...(t.state.permittedChildTypeIds as string[]), extend.id],
							permittedChildren: [...(t.state.permittedChildren as object[]), { typeId: extend.id, cardinality: 'C1' }]
						}
					}
				: t
		);
		const offered = stageTwoOf([...types, extend], AGENT_UNITS);
		expect([offered.value, offered.basis[1]]).toEqual(['as intended', '1 conditional child was never offered (REG-F-516): Extend wordfreq']);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package M — THE LANE PRESSES ONLY WHAT THE PAGE OFFERS (`REG-D-135` (2); design D4-D6; `REG-F-578`) ──
// Run-12's shape (`fixes-facts.md` §3): twelve types, four composites requiring what their own children produce, every input
// but `originating-intent` another type's output, no loop. The lane pressed it in the tree's pre-order — the root first, and
// 4 of 4 composites before the children whose outputs they required. Each type below is run-12's, its name shortened; the
// leaves' inputs are supplied as in `unit-dependencies.test.ts`.
const R12_TYPE = (id: string, name: string, isRoot: boolean, children: string[], inputs: string[], outputs: string[]): ObjectRow => ({
	id,
	state: {
		pwaId: PWA_ID,
		name,
		pwuKind: 'PRODUCT_IMPLEMENTATION',
		purpose: `${name}.`,
		workDischarge: children.length > 0 ? 'HUMAN' : 'MODEL',
		...(children.length > 0 ? {} : { promptTemplate: prompt('Do {subject}: {purpose}') }),
		isRoot,
		permittedChildTypeIds: children,
		permittedChildren: children.map((typeId) => ({ typeId, cardinality: 'M1' })),
		requiredInputs: inputs,
		requiredOutputs: outputs,
		requiredAssurancePolicyIds: ['pol_intent_preservation'],
		status: 'ACTIVE'
	}
});
const RUN12_TYPES: ObjectRow[] = [
	R12_TYPE('t_root', 'Realization', true, ['t_req', 't_design', 't_impl', 't_e2e'], ['originating-intent', 'verification-evidence'], ['summary']),
	R12_TYPE('t_req', 'Requirements', false, [], ['originating-intent'], ['requirements-specification']),
	R12_TYPE('t_design', 'Technical design', false, ['t_cli', 't_words'], ['cli-design-contribution', 'processing-design-contribution'], ['architecture-baseline']),
	R12_TYPE('t_cli', 'CLI contract', false, [], ['requirements-specification'], ['cli-design-contribution']),
	R12_TYPE('t_words', 'Word processing', false, [], ['requirements-specification'], ['processing-design-contribution']),
	R12_TYPE('t_impl', 'Implementation', false, ['t_entry', 't_core', 't_unit'], ['cli-runtime-code', 'processing-module-code', 'unit-test-evidence', 'architecture-baseline'], ['implemented-wordfreq-candidate']),
	R12_TYPE('t_entry', 'CLI entry', false, [], ['architecture-baseline'], ['cli-runtime-code']),
	R12_TYPE('t_core', 'Core', false, [], ['architecture-baseline'], ['processing-module-code']),
	R12_TYPE('t_unit', 'Unit tests', false, [], ['cli-runtime-code', 'processing-module-code'], ['unit-test-evidence']),
	R12_TYPE('t_e2e', 'End-to-end verification', false, ['t_suite', 't_exec'], ['e2e-test-suite', 'e2e-results', 'implemented-wordfreq-candidate'], ['verification-evidence']),
	R12_TYPE('t_suite', 'E2e suite', false, [], ['implemented-wordfreq-candidate'], ['e2e-test-suite']),
	R12_TYPE('t_exec', 'E2e execution', false, [], ['e2e-test-suite', 'implemented-wordfreq-candidate'], ['e2e-results'])
];
/** Run-12's units, as the store lists them — scrambled, so only the tree can number them. */
const RUN12_UNITS: readonly AgentUnit[] = [
	['u_exec', 't_exec', 'E2e execution', 'u_e2e'],
	['u_root', 't_root', 'Realization', null],
	['u_core', 't_core', 'Core', 'u_impl'],
	['u_req', 't_req', 'Requirements', 'u_root'],
	['u_design', 't_design', 'Technical design', 'u_root'],
	['u_cli', 't_cli', 'CLI contract', 'u_design'],
	['u_words', 't_words', 'Word processing', 'u_design'],
	['u_impl', 't_impl', 'Implementation', 'u_root'],
	['u_entry', 't_entry', 'CLI entry', 'u_impl'],
	['u_unit', 't_unit', 'Unit tests', 'u_impl'],
	['u_e2e', 't_e2e', 'End-to-end verification', 'u_root'],
	['u_suite', 't_suite', 'E2e suite', 'u_e2e']
].map(([id, typeId, title, parent]) => ({ id: id!, typeId: typeId!, title: title!, parent: parent ?? null }));
/** Each of run-12's units, by its slug, signed off. */
const RUN12_SIGNED_OFF = signedOff(
	['realization', 'requirements', 'technical-design', 'cli-contract', 'word-processing', 'implementation', 'cli-entry', 'core', 'unit-tests', 'end-to-end-verification', 'e2e-suite', 'e2e-execution'].map((s) =>
		s === 'realization' ? 'root' : s
	)
);

describe('⭐⭐ package M (D4-D6) — the lane presses only what the page offers, one unit at a time, the tree’s order breaking ties', () => {
	it('⭐ THE PREDICTED RED — run-12’s shape is pressed in the DESIGN’S DATA-FLOW ORDER, the root LAST; each unit signed off before the next press; the order and what each unit waits for recorded in run.json', async () => {
		const l = halfBLane({ paid: true, types: RUN12_TYPES, units: RUN12_UNITS, signOffs: RUN12_SIGNED_OFF });
		const record = await l.run();
		// The design's order (§3): requirements; CLI contract and word processing; technical design; CLI entry and core; unit
		// tests; implementation; e2e suite; e2e execution; end-to-end verification; the root — one at a time, ties by the tree.
		const dataFlow = [
			'requirements',
			'cli-contract',
			'word-processing',
			'technical-design',
			'cli-entry',
			'core',
			'unit-tests',
			'implementation',
			'e2e-suite',
			'e2e-execution',
			'end-to-end-verification',
			'root'
		];
		expect(l.only('beginExecute'), 'the presses are not run-12’s data-flow order, the root last').toEqual(
			dataFlow.map((slug) => `beginExecute ${slug}`)
		);
		expect(l.only('beginExecute', 'markSatisfied'), 'a unit was pressed before the one before it was signed off').toEqual(
			dataFlow.flatMap((slug) => [`beginExecute ${slug}`, `markSatisfied ${slug}`])
		);
		// ⭑ The units keep their identity in the tree's order: the root is still 01-root.
		expect(record.units.map((u) => [u.order, u.slug]).slice(0, 3)).toEqual([
			[1, 'root'],
			[2, 'requirements'],
			[3, 'technical-design']
		]);
		const written = l.written();
		expect(written.order?.pressed, 'run.json does not record the press order').toEqual(dataFlow);
		expect(written.order?.dependencies, 'run.json does not record what each unit waits for').toMatchObject({
			root: ['requirements', 'technical-design', 'implementation', 'end-to-end-verification'],
			'technical-design': ['cli-contract', 'word-processing'],
			implementation: ['technical-design', 'cli-entry', 'core', 'unit-tests'],
			'end-to-end-verification': ['implementation', 'e2e-suite', 'e2e-execution'],
			'unit-tests': ['cli-entry', 'core'],
			requirements: []
		});
		expect(written.units.every((u) => u.upstreamNotAssured === false), 'a unit was pressed over an unassured producer').toBe(true);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	it('⭐ THE PREDICTED RED (D5) — a LOOP ends the run `order-unresolvable` after the authoring archive, with ZERO presses and no fallback to the tree’s order; each unit recorded not started, the loop named in the page’s words', async () => {
		// The agent's PWA with Specify and Build each requiring the other's output.
		const LOOP_TYPES = AGENT_TYPES.map((t) =>
			t.id === 'pwutype_specify'
				? { id: t.id, state: { ...t.state, requiredInputs: ['build-notes'], requiredOutputs: ['spec'] } }
				: t.id === 'pwutype_build'
					? { id: t.id, state: { ...t.state, requiredInputs: ['spec'], requiredOutputs: ['build-notes'] } }
					: t
		);
		const l = halfBLane({ paid: true, types: LOOP_TYPES, signOffs: ALL_SIGNED_OFF });
		const record = await l.run();
		expect(l.only('beginExecute'), 'a unit was pressed beside a loop').toEqual([]);
		expect(l.only('archiveAuthoring', 'startOffers')).toEqual(['archiveAuthoring', 'startOffers']);
		expect(record.end?.reason).toBe('order-unresolvable');
		expect(record.end?.detail).toContain('Specify wordfreq — it waits for "Build wordfreq" (PROPOSED) to be accepted; it sits in a loop: "Specify wordfreq" → "Build wordfreq" → "Specify wordfreq"');
		expect(record.end?.detail).toContain('the tree’s order is never used instead (D5; REG-D-135 (2))');
		expect(record.units.map((u) => [u.slug, u.notStarted])).toEqual([
			['root', 'not started: it waits for "Specify wordfreq" (PROPOSED), "Build wordfreq" (PROPOSED) and "Verify wordfreq end to end" (PROPOSED) to be accepted'],
			['specify-wordfreq', 'not started: it waits for "Build wordfreq" (PROPOSED) to be accepted; it sits in a loop: "Specify wordfreq" → "Build wordfreq" → "Specify wordfreq"'],
			['build-wordfreq', 'not started: it waits for "Specify wordfreq" (PROPOSED) to be accepted; it sits in a loop: "Build wordfreq" → "Specify wordfreq" → "Build wordfreq"'],
			// ⭑ A unit outside the loop is offered — and still never pressed: no press beside a loop.
			['verify-wordfreq-end-to-end', 'not started: offered, and the run ended before it was pressed']
		]);
		expect(laneVerdict(record)).toEqual([`the run ended 'order-unresolvable', not 'complete': ${record.end?.detail}`]);
		// ⭑ THE CONTROL — the same PWA without the loop proceeds.
		const acyclic = await halfBLane({ paid: true, signOffs: ALL_SIGNED_OFF }).run();
		expect(acyclic.end?.reason).toBe('complete');
	});

	it('⭐ D4 — a producer that STOPS, left as found by the rule, leaves every unit that waits for it UNSTARTED, the producer named in its state; the lane abandons nothing beyond the run plan’s rule (half A’s REG-D-105 (4) case holds an ABANDONED producer, named so)', async () => {
		// Run-12's shape, Requirements stopping, its row offering no re-run: the rule leaves it as found, abandoning nothing, and
		// every unit that waits for it — the two design contributions, and through them the rest — is never offered.
		const l = halfBLane({
			paid: true,
			types: RUN12_TYPES,
			units: RUN12_UNITS,
			signOffs: RUN12_SIGNED_OFF,
			stops: { u_req: { rerunReview: false, rerunWork: false, abandon: true } }
		});
		const record = await l.run();
		expect(l.only('beginExecute'), 'a unit that waits for the stopped producer was pressed').toEqual(['beginExecute requirements']);
		const byslug = new Map(record.units.map((u) => [u.slug, u]));
		expect(byslug.get('cli-contract')?.notStarted).toBe('not started: it waits for "Requirements" (EXECUTING) to be accepted');
		expect(byslug.get('root')?.notStarted).toMatch(/^not started: it waits for "Requirements" \(EXECUTING\)/);
		expect(l.only('recover'), 'the lane abandoned or re-ran beyond the run plan’s rule').toEqual([]);
		// ⛔ MOVED 2026-10-26 (`JAN-EXEC` Phase 7, package O; design D24, revision 3) — ~~`expect(record.end?.reason).toBe('complete')`~~:
		// eleven units were never offered, and the one pressed was never signed off, so the run did not complete. It ends
		// `withheld`, naming each with the page's reason (package M's check, finding 3, left this to the lead; D24 decides it).
		expect(record.end?.reason).toBe('withheld');
		expect(record.end?.detail).toContain('Requirements — pressed, and its sign-off never attempted: it stopped');
		expect(record.end?.detail).toContain('CLI contract — not started: it waits for "Requirements" (EXECUTING) to be accepted');
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package O — D24, THE RUN'S TRUE END (design revision 3; the lead's decision, flagged for the sponsor) ──
// `complete` only when EVERY unit was pressed and its sign-off attempted. A run whose loop ends with units the page never offered
// — or pressed and never signed off — ends `withheld`, naming each with the page's reason. ⛔ Before D24 such a run ended
// `complete`: package M's lane broke out of its loop when the page offered nothing more, whatever it had never pressed.
describe('⭐⭐ package O (D24) — a paid run ends `complete` only when every unit was pressed and its sign-off attempted; else `withheld`, each unit named', () => {
	it('⭐ THE PREDICTED RED — a paid run whose ROOT is never offered ends `withheld`: Verify’s row offers no Record Assurance, so it is never accepted and the root never offered; each named with the page’s reason, and the lane’s verdict says so', async () => {
		const l = halfBLane({ paid: true, signOffs: signedOff(['root', 'specify-wordfreq', 'build-wordfreq']) });
		const record = await l.run();
		expect(l.only('beginExecute'), 'arrangement: the children were pressed, the root never').toEqual(
			['specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end'].map((s) => `beginExecute ${s}`)
		);
		expect(record.end?.reason, 'a run that never offered its root was said to complete').toBe('withheld');
		expect(record.end?.detail).toBe(
			'wordfreq Realization — not started: it waits for "Verify wordfreq end to end" (EXECUTING) to be accepted; ' +
				'Verify wordfreq end to end — pressed, and its sign-off never attempted: its row offered no Record Assurance'
		);
		expect(laneVerdict(record)).toEqual([`the run ended 'withheld', not 'complete': ${record.end?.detail}`]);
		// ⭑ The final archive is taken, as a complete run's is: the run is recorded, whatever it reached.
		expect(l.only('archive 06-final')).toEqual(['archive 06-final']);
	});

	it('⭑ CONTROL — every unit pressed and signed off: the run ends `complete`, and its verdict holds nothing', async () => {
		const record = await halfBLane({ paid: true, signOffs: ALL_SIGNED_OFF }).run();
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	it('⭑ a DRY run still ends `dry-run-stop`: it presses nothing by design, and D24 asks nothing of it', async () => {
		const record = await halfBLane({ paid: false, signOffs: ALL_SIGNED_OFF }).run();
		expect(record.end?.reason).toBe('dry-run-stop');
	});

	it('⭐ THE REPORT LISTS EACH, with the page’s reason — read from the run’s own record, the lane’s own lines (`withheldUnitsOf`), in report.json and report.md', async () => {
		const l = halfBLane({ paid: true, signOffs: signedOff(['root', 'specify-wordfreq', 'build-wordfreq']) });
		const record = await l.run();
		const r = buildRunReport(halfBStore(), { ...halfBLaneRows(), run: l.written() }, { accountNames: NAMES }).report;
		expect(r.run.endReason).toBe('withheld');
		expect(
			r.run.withheld?.map((w) => `${w.title} — ${w.reason}`),
			'the report does not list what the run withheld, in the lane’s words'
		).toEqual(withheldUnitsOf(record));
		expect(r.run.withheld?.map((w) => w.slug)).toEqual(['root', 'verify-wordfreq-end-to-end']);
		expect(renderMarkdown(r)).toContain(
			'- **Withheld (design D24):** wordfreq Realization — not started: it waits for "Verify wordfreq end to end" (EXECUTING) ' +
				'to be accepted; Verify wordfreq end to end — pressed, and its sign-off never attempted: its row offered no Record ' +
				'Assurance.'
		);
	});

	it('⭑ CONTROL — a run that ended otherwise lists nothing withheld, its units unpressed though they may be', async () => {
		const r = buildRunReport(halfBStore(), halfBLaneRows(), { accountNames: NAMES }).report;
		expect(r.run.withheld).toBeNull();
		expect(renderMarkdown(r)).not.toContain('**Withheld');
	});
});

describe('⭐ REG-D-112 (E3’s review, 5) — units are identified by ID: two of one title are both run, and the repeat is reported', () => {
	// ⭐ THE PREDICTED RED: two units of one title were refused as a lane error once the PWA was published — a paid run
	// ended `lane-error` after its authoring's spend.
	// ⛔ MOVED (package M; `REG-D-135` (2); design D6, which names it): ~~presses in `SHARED_ORDER`, the root first~~ — the page
	// offers each review first (each waits for nothing), and a composite once its review is accepted; the tree's order breaks
	// the ties, so the first review, then its parent, then the second review, its parent, and the root LAST. The units keep
	// their identity — number, slug, id — in the tree's order.
	it('⭐ a shared child’s two units of one title: the run COMPLETES, each pressed once, by its own id, in the order the page offers — each review before its parent, the root last — and the repeat recorded', async () => {
		const l = halfBLane({
			paid: true,
			types: SHARED_TYPES,
			units: SHARED_UNITS,
			signOffs: signedOff(SHARED_ORDER.map(([slug]) => slug))
		});
		const record = await l.run();
		expect(record.end?.reason).toBe('complete');
		const pressed = ['review-wordfreq', 'design-wordfreq', 'review-wordfreq-2', 'build-wordfreq', 'root'];
		expect(l.only('beginExecute')).toEqual(pressed.map((slug) => `beginExecute ${slug}`));
		expect(record.order?.pressed).toEqual(pressed);
		expect(record.order?.dependencies, 'each composite waits for its review, the root for both composites').toEqual({
			root: ['design-wordfreq', 'build-wordfreq'],
			'design-wordfreq': ['review-wordfreq'],
			'review-wordfreq': [],
			'build-wordfreq': ['review-wordfreq-2'],
			'review-wordfreq-2': []
		});
		expect(record.units.map((u) => [u.slug, u.unitId])).toEqual(SHARED_ORDER);
		expect(record.authoring?.unitProblems).toEqual([
			'2 units are titled "Review wordfreq" — a type more than one parent permits is built once under each, and two types may share a name — so the lane tells them apart by id, never by the title their rows show (REG-D-112)'
		]);
	});

	it('⭐ the report says so too — and never calls a shared child’s repeat a re-proposal', () => {
		const r = buildRunReport(halfBStore({ types: SHARED_TYPES, units: SHARED_UNITS }), halfBLaneRows({ types: SHARED_TYPES, units: SHARED_UNITS }), {
			accountNames: NAMES
		}).report;
		expect(r.problems.filter((p) => p.includes('Review wordfreq'))).toEqual([
			'2 work units are titled "Review wordfreq", each read by its own id: a type more than one parent permits is built once under each (REG-D-112)'
		]);
	});
});

describe('⛔ REG-D-112 (E3’s review, 6) — the author’s model is pinned AND ENFORCED: another model, or none read, breaks stage 1', () => {
	const stageOneOf = (author: { configured: string | null; resolved: string | null }): MatrixCell =>
		cellOf(buildRunReport(halfBStore(), halfBLaneRows({ author }), { accountNames: NAMES }).report, '1', 'whole run');
	const PINNED = `${AUTHOR.providerId}/${AUTHOR.modelId}`;

	// ⭐ THE PREDICTED RED: a substituted author read as intended, with a warning beside it.
	it('⭐ the turn named another model than the one pinned: stage 1 BROKE, REG-F-509, and said', () => {
		const one = stageOneOf({ configured: PINNED, resolved: 'openai-codex/gpt-4.1' });
		expect([one.value, one.registerIds]).toEqual(['broke', ['REG-F-509']]);
		expect(one.basis).toContain(
			`the author that ran, openai-codex/gpt-4.1, is not the model pinned, ${PINNED}: Pi substituted another, unannounced (REG-F-509)`
		);
	});

	// ⭐ `REG-D-112` (E3's re-review, finding 2) — ~~BROKE, REG-F-509~~: a producer the lane could not read is no substitution
	// Pi made. The lane's READ is the unknown — the stream did not come within its bound, could not be read, or named none —
	// so the break is UNREGISTERED, P7-5's to name, and never counted as a known product entry.
	it('⭐ the turn named no model the lane could read: stage 1 BROKE, UNREGISTERED — the lane’s read named as the unknown, never REG-F-509', () => {
		const one = stageOneOf({ configured: PINNED, resolved: null });
		expect([one.value, one.registerIds, one.unregistered]).toEqual(['broke', [], true]);
		expect(one.basis).toContain(
			'the lane read no producer from the turn’s stream — it did not come within the lane’s bound, could not be read, or ' +
				`named none — so which model authored the PWA is unknown, and the pin, ${PINNED}, is not shown met`
		);
		expect(one.basis.join('\n')).not.toContain('REG-F-509');
	});

	it('⭐ CONTROL — a bare id pinned, the turn naming it under its provider, is the model pinned: as intended', () => {
		expect(stageOneOf({ configured: AUTHOR.modelId, resolved: PINNED }).value).toBe('as intended');
	});
});

describe('⭐ REG-D-112 (E3’s review, 7) — a half-B run that never sent its request has NOT REACHED stage 1', () => {
	const unsent = (end: string): LaneRows => {
		const lane = halfBLaneRows();
		return {
			...lane,
			run: {
				...(lane.run as object),
				mode: end === 'dry-run-stop' ? 'dry' : 'paid',
				units: [],
				end: { reason: end },
				authoring: { pwaId: PWA_ID, sent: false, candidate: null, accept: null, authorModel: { configured: 'm', resolved: null }, checks: null }
			}
		};
	};
	const drafted = halfBStore({ publication: 'DRAFT' });
	const store = { ...drafted, objects: drafted.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE') };

	// ⭐ THE PREDICTED RED: the dry rehearsal's draft read as a broken authoring — a floor MISSING, no hash, a DRAFT.
	it('⭐ the dry rehearsal stopped before Send: stage 1 NOT REACHED, saying why — never broke', () => {
		const one = cellOf(buildRunReport(store, unsent('dry-run-stop'), { accountNames: NAMES }).report, '1', 'whole run');
		expect([one.value, one.registerIds, one.unregistered]).toEqual(['not reached', [], undefined]);
		expect(one.basis).toEqual([
			'the request was never sent — the run ended dry-run-stop before Send — so no candidate was authored for the floor to judge'
		]);
	});

	it('⭐ … and so did a paid run the limit stopped before Send', () => {
		expect(cellOf(buildRunReport(store, unsent('paid-limit'), { accountNames: NAMES }).report, '1', 'whole run').value).toBe('not reached');
	});
});

// ── ⭐⭐ E3'S RE-REVIEW, AND ITS FINDINGS FIXED (`REG-D-112`) ─────────────────────────────────────────────────────────
// The re-review of E3's fix round found five more. Each fix is held here by the test that was RED before it, or — for a
// term no test could kill — by the test its ledger entry now dies on (E3-M72, E3-M75, E3-M76: each SURVIVED first).

/**
 * ⭐ `REG-D-112` (E3's re-review, finding 1) — A TYPE WHOSE PERMITTED CHILDREN ARE ALL CONDITIONAL, from the catalog
 * blueprints the agent builds from: the root over "Specify wordfreq" (MODEL) and "Build wordfreq", which declares
 * UNDECLARED and permits "Extend wordfreq" as C1 alone. Instantiation builds no conditional child (`planComposition`;
 * `REG-F-516`), so Build's unit has none: a LEAF of the tree instantiation built.
 */
const CONDITIONAL_TYPES: ObjectRow[] = [
	AGENT_TYPES[1]!,
	{
		id: 'pwutype_build',
		state: {
			pwaId: PWA_ID,
			name: 'Build wordfreq',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			purpose: 'Implement wordfreq and its unit tests.',
			workDischarge: 'UNDECLARED',
			isRoot: false,
			permittedChildTypeIds: ['pwutype_extend'],
			permittedChildren: [{ typeId: 'pwutype_extend', cardinality: 'C1' }],
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	},
	{
		id: 'pwutype_extend',
		state: {
			pwaId: PWA_ID,
			name: 'Extend wordfreq',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			purpose: 'Extend wordfreq where a person asks for it.',
			workDischarge: 'MODEL',
			isRoot: false,
			permittedChildTypeIds: [],
			promptTemplate: prompt('Extend {subject} for wordfreq: {purpose}'),
			requiredAssurancePolicyIds: ['pol_intent_preservation'],
			status: 'ACTIVE'
		}
	},
	{
		id: 'pwutype_root',
		state: {
			...AGENT_TYPES[3]!.state,
			permittedChildTypeIds: ['pwutype_specify', 'pwutype_build'],
			permittedChildren: [
				{ typeId: 'pwutype_specify', cardinality: 'M1' },
				{ typeId: 'pwutype_build', cardinality: 'M1' }
			]
		}
	}
];
/** The units instantiation builds of it: the root, Specify and Build — and nothing under Build. */
const CONDITIONAL_UNITS = AGENT_UNITS.filter((u) => u.id !== 'pwu_v');

describe('⛔ REG-D-112 (E3’s re-review, 1) — a composite is a unit the tree BUILT children under, never one whose type permits some', () => {
	const reportOf = (types: readonly ObjectRow[], units: readonly AgentUnit[], ran: Readonly<Record<string, 'model' | 'press'>>) =>
		buildRunReport(halfBStore({ types, units, ran }), halfBLaneRows({ types, units }), { accountNames: NAMES }).report;

	// ⭐ THE PREDICTED RED: its type permits a live child type, so both checks called it a composite — C4 recorded no trap, and
	// the report read its stage 3 as intended, "its work is theirs", with no child to do it: REG-F-505's false Yes.
	it('⭐ a type whose permitted children are all CONDITIONAL, pressed with no model, is a LEAF: broke REG-F-505 at stages 3 and 7, and so is the whole run', () => {
		const r = reportOf(CONDITIONAL_TYPES, CONDITIONAL_UNITS, { pwu_r: 'press', pwu_s: 'model', pwu_b: 'press' });
		expect([
			cellOf(r, '3', 'build-wordfreq').value,
			cellOf(r, '3', 'build-wordfreq').registerIds,
			cellOf(r, '7', 'build-wordfreq').value,
			cellOf(r, '7', 'build-wordfreq').registerIds,
			cellOf(r, '7', 'whole run').value
		]).toEqual(['broke', ['REG-F-505'], 'broke', ['REG-F-505'], 'broke']);
		expect(r.units.find((u) => u.slug === 'build-wordfreq')?.candidateFindings).toEqual(['model-leaf (REG-F-505, REG-F-507)']);
	});

	it('⭐ C4 records model-leaf for it: the plan gives it no child — and gives one to the root alone', () => {
		const checks = candidateChecks(CONDITIONAL_TYPES, AGENT_POLICIES);
		expect(checks.findings.map((f) => [f.check, f.typeName, f.registerIds])).toEqual([
			['model-leaf', 'Build wordfreq', ['REG-F-505', 'REG-F-507']]
		]);
		expect(checks.types.map((t) => [t.name, t.leaf])).toEqual([
			['Specify wordfreq', true],
			['Build wordfreq', true],
			['Extend wordfreq', true],
			['wordfreq Realization', false]
		]);
	});

	// ⭐ THE GENERAL FORM, AT THE ROOT: the report exempted the root by its PLACE, the first unit — §3.2's runs no model by
	// design because its work is its four phases'. A root the plan gives no child is the Undertaking's one unit, and its
	// press completing it with no model is the same false Yes: the whole run's.
	it('⭐ a ROOT whose permitted children are all conditional is the Undertaking’s one unit, a LEAF: pressed with no model, the whole run’s stage 7 is broke, REG-F-505', () => {
		const types: ObjectRow[] = [
			{
				id: 'pwutype_root',
				state: {
					...AGENT_TYPES[3]!.state,
					permittedChildTypeIds: ['pwutype_specify'],
					permittedChildren: [{ typeId: 'pwutype_specify', cardinality: 'C+' }]
				}
			},
			AGENT_TYPES[1]!
		];
		const r = reportOf(types, AGENT_UNITS.filter((u) => u.id === 'pwu_r'), { pwu_r: 'press' });
		expect([cellOf(r, '2', 'whole run').value, cellOf(r, '7', 'whole run').value, cellOf(r, '7', 'whole run').registerIds]).toEqual([
			'as intended',
			'broke',
			['REG-F-505']
		]);
		expect(candidateChecks(types, AGENT_POLICIES).findings.map((f) => [f.check, f.typeName])).toEqual([['model-leaf', 'wordfreq Realization']]);
	});

	it('⭐ CONTROL — a composite whose children were built reads as intended, and its basis NAMES the children it has', () => {
		const r = reportOf(SHARED_TYPES, SHARED_UNITS, { pwu_sr: 'press', pwu_sd: 'press', pwu_sb: 'press', pwu_rv_d: 'model', pwu_rv_b: 'model' });
		expect(['design-wordfreq', 'build-wordfreq'].map((slug) => [cellOf(r, '3', slug).value, cellOf(r, '3', slug).basis])).toEqual([
			['as intended', ['a composite of the tree, the parent of review-wordfreq: its work is theirs, and its press completed its step with no model run (REG-D-112)']],
			['as intended', ['a composite of the tree, the parent of review-wordfreq-2: its work is theirs, and its press completed its step with no model run (REG-D-112)']]
		]);
	});
});

describe('⛔ REG-D-112 (E3’s re-review, 2) — the author is checked once the turn SETTLED, against a producer READ; no pin is REG-F-531', () => {
	const PINNED = `${AUTHOR.providerId}/${AUTHOR.modelId}`;
	const drafted = halfBStore({ publication: 'DRAFT' });
	const store = { ...drafted, objects: drafted.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE') };
	/** A paid run whose turn never settled: Send pressed, and its candidate as the lane last read it. */
	const unsettled = (candidate: object | null, end: string): LaneRows => {
		const lane = halfBLaneRows();
		return {
			...lane,
			run: {
				...(lane.run as object),
				units: [],
				end: { reason: end },
				authoring: { pwaId: PWA_ID, sent: true, candidate, accept: null, authorModel: { configured: PINNED, resolved: null }, checks: null }
			}
		};
	};
	const stageOne = (lane: LaneRows): MatrixCell => cellOf(buildRunReport(store, lane, { accountNames: NAMES }).report, '1', 'whole run');

	// ⭐ THE PREDICTED RED: the lane asks the turn's stream only once its candidate has settled (`recordTheFloor`), so a turn
	// that never settled was never asked — and stage 1 said no producer "was read", filed under REG-F-509.
	it('⭐ the server refused the turn before it began — no candidate staged: the author is not checked, and nothing cites REG-F-509', () => {
		const one = stageOne(unsettled(null, 'authoring-stopped'));
		expect([one.value, one.registerIds, one.unregistered]).toEqual(['broke', [], true]);
		expect(one.basis).toContain(
			`the reviewer: none recorded; the author: not asked — the turn never settled, so the lane never read its stream (configured: ${PINNED})`
		);
		// ⭑ No author fault at all — neither a substitution nor an unread producer: the stream was never asked.
		expect(one.basis.filter((line) => /producer|REG-F-509/.test(line))).toEqual([]);
	});

	it('⭐ … and so with the allowance outlasted, its candidate still ASSURING', () => {
		const one = stageOne(unsettled({ status: 'ASSURING', candidateHash: null }, 'allowance-exceeded'));
		expect([one.value, one.registerIds]).toEqual(['broke', []]);
		expect(one.basis.filter((line) => /producer|REG-F-509/.test(line))).toEqual([]);
	});

	it('⛔ no author model pinned: stage 1 BROKE, REG-F-531, whatever the turn’s stream named', () => {
		const one = cellOf(
			buildRunReport(halfBStore(), halfBLaneRows({ author: { configured: null, resolved: PINNED } }), { accountNames: NAMES }).report,
			'1',
			'whole run'
		);
		expect([one.value, one.registerIds]).toEqual(['broke', ['REG-F-531']]);
		expect(one.basis).toContain('no author model was pinned: half B requires JPWB_AGENT_MODEL, and the record names none (design §4 C3)');
	});
});

describe('⛔ REG-D-112 (E3’s re-review, 3) — an authoring END is never relabelled by an archive that fails', () => {
	const FULL_DISK = 'ENOSPC: no space left on device, copyfile';
	const failing = async (): Promise<void> => {
		throw new Error(FULL_DISK);
	};

	// ⭐ THE PREDICTED RED: a failed archive at an authoring end was thrown, and the run ended `lane-error` in the archive's
	// words — the authoring's own reason lost from the run's record.
	it('⭐ each end keeps its own reason when its archive fails — the limit before Send, a candidate not assured, the allowance, the dry stop — the failure noted and recorded', async () => {
		const ends: Record<string, readonly [HalfBScript, string]> = {
			'the limit before Send': [{ paid: true, prior: PHASE7_PAID_LIMIT }, 'paid-limit'],
			'a candidate not assured': [{ paid: true, statuses: ['BLOCKED_EXTERNAL'] }, 'authoring-stopped'],
			'the allowance outlasted': [{ paid: true, statuses: ['ASSURING'] }, 'allowance-exceeded'],
			'the dry stop': [{ paid: false }, 'dry-run-stop']
		};
		for (const [why, [script, reason]] of Object.entries(ends)) {
			const l = halfBLane({ ...script, archive: failing });
			const record = await l.run().catch(() => l.written());
			expect([record.end?.reason, record.authoring?.archiveFailure, record.problems], why).toEqual([
				reason,
				FULL_DISK,
				[`the authoring archive, at the authoring’s end (${reason}): ${FULL_DISK}`]
			]);
		}
	});

	// ⭐ AND THE DRY REHEARSAL STILL FAILS ON IT: before, the throw ended it `lane-error`, which its verdict refused. Kept as
	// an end, a failed archive must be refused by name — the authoring archive is the one archive-and-check cycle half B's
	// rehearsal reaches.
	it('⛔ a DRY rehearsal whose archive failed fails its verdict, naming the archive — and still counts the model exchanges', async () => {
		const l = halfBLane({ paid: false, archive: failing });
		const record = await l.run().catch(() => l.written());
		expect([laneVerdict(record), record.dryRun]).toEqual([
			[`the dry run’s authoring archive failed, so the archive it rehearses is not proved: ${FULL_DISK}`],
			{ modelExchanges: 0 }
		]);
	});
});

describe('⛔ REG-D-112 (E3’s re-review, 4) — the limit before the root counts the calls the store RECORDS: the authoring floor’s', () => {
	/**
	 * ~~A model unit's worst case, as its allowance counts it: each try's review, and each reviewed command's — 140.~~ ~~⭐
	 * `REG-D-114` (14), as amended 2026-10-16 — what a MODEL root counts before its press: one try's reserve, 4.~~ ⭐ Package L —
	 * D16 (`REG-D-135` (4)): its whole press, (3 tries + 32 command runs) × 6 = 210, restated.
	 */
	const WHOLE_PRESS = (3 + 32) * 6;
	/**
	 * ⭐ The floor's worst case, its two runs' reviews of up to four calls each ⭐ (the review in parts, B6) of each of sixteen
	 * ~~anticipated~~ parts, ~~8~~ 128 ⭐ (six calls each, 192): ~~so Send's read, before it, stays under the limit~~ ⛔ package L2,
	 * D20 — the calls the arrangement has the floor record after Send, whose read counts the allowance and reaches the limit.
	 */
	const FLOOR_CALLS = phase7AuthoringReviewerCalls(SIXTEEN);
	/**
	 * ~~One call past the limit with the floor's recorded calls counted, and within it without them.~~ ⛔ MOVED (package M;
	 * `REG-D-135` (2); design D6, D7) — the root is pressed after its children, whose checks count a whole press too: so the
	 * prior lets each child's check reach the limit exactly WITH the floor's recorded calls counted, the last child spends one
	 * call, and the MODEL root's check is one call past the limit with every recorded call counted — and far within it without.
	 */
	const PRIOR = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS - FLOOR_CALLS;

	// ⭐ THE MUTANT THAT SURVIVED (E3-M75): no test's store held an exchange at the root's check, so the calls recorded were a
	// term no test could kill — dropped, a MODEL root was pressed with the floor's calls uncounted.
	// ⭐ Package L — D16 (`REG-D-135` (4)): MOVED DELIBERATELY — ~~one try's reserve~~ the whole press.
	it('⭐ a MODEL root whose ~~worst case~~ ~~one try’s reserve~~ ⭐ whole press fits only WITHOUT the floor’s recorded calls is never pressed: the run ends paid-limit, the calls counted', async () => {
		const l = halfBLane({
			paid: true,
			prior: PRIOR,
			types: MODEL_ROOT_TYPES,
			floorCalls: FLOOR_CALLS,
			unitCalls: { pwu_v: 1 },
			signOffs: ALL_SIGNED_OFF
		});
		const record = await l.run();
		expect([l.only('beginExecute root'), record.end?.reason, record.units[0]?.limitCheck]).toEqual([
			[],
			'paid-limit',
			{
				prior: PRIOR,
				recorded: FLOOR_CALLS + 1,
				reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
				ahead: WHOLE_PRESS,
				counted: 'its whole press’s worst case, (3 tries + 32 command runs) × 6 calls',
				total: PHASE7_PAID_LIMIT + 1,
				limit: PHASE7_PAID_LIMIT,
				allowed: false
			}
		]);
	});

	it('⭐ CONTROL — one floor call fewer, ~~the worst case~~ ~~one try’s reserve~~ ⭐ the whole press fits exactly: the MODEL root is pressed', async () => {
		// ⭑ Package M (D6, D7) — ~~one floor call fewer~~: the last child spends none, and the whole press fits exactly.
		const l = halfBLane({ paid: true, prior: PRIOR, types: MODEL_ROOT_TYPES, floorCalls: FLOOR_CALLS, signOffs: ALL_SIGNED_OFF });
		const record = await l.run();
		expect(l.only('beginExecute root')).toEqual(['beginExecute root']);
		expect(record.units[0]?.limitCheck).toMatchObject({ recorded: FLOOR_CALLS, total: PHASE7_PAID_LIMIT, allowed: true });
	});
});

// ── ⛔ R4 (the lead's round-4 item 6) — P76R-M52'S PROPERTY: A RE-RUN THE LIMIT STOPPED ENDS THE RUN `paid-limit` ─────────────
// ⭐ Package L — D16 (`REG-D-135` (4)): the rule's re-run of a stopped phase now counts its whole worst case — a re-run of the
// review its refused reviews × 6 — where the struck sentence follows. ~~Since `REG-D-114` (14), as amended 2026-10-16, the rule's
// re-run of a stopped phase counts one try's reserve (4), and in~~
// half A every later sign-off counts at least 8 (§3.2's least-declaring unit, two policies): the check that stops a re-run
// stops the next sign-off too, and the run ends `paid-limit` whatever the re-run's own stop set — P76R-M52 SURVIVED its half-A
// victim. Only a run whose later sign-offs count less than one try's reserve shows the re-run's own end: units that declare
// no policy, which an agent's PWA may hold.

describe('⛔ R4 (the lead’s round-4 item 6) — a re-run the limit stopped ends the run paid-limit, though every later check fits', () => {
	/** The agent's PWA, every type declaring NO policy: each sign-off counts none ahead. */
	const NO_POLICY_TYPES: ObjectRow[] = AGENT_TYPES.map((t) => ({ id: t.id, state: { ...t.state, requiredAssurancePolicyIds: [] } }));
	// ~~The authoring floor's worst case, counted before Send: ~~8~~ ⭐ (the review in parts, B6) 128, for sixteen anticipated
	// types (`FLOOR_WORST`).~~ ⭐ Package L — D16 (`REG-D-135` (4)): struck, no longer read — the arrangement below
	// reaches the limit with Specify's whole press, the floor spending nothing.

	it('⛔ the agent’s Specify phase stops, its re-run held back one call past the limit; the root’s sign-off, counting none, fits — and the run still ends paid-limit, never complete', async () => {
		// ⭑ ~~Send's read reaches the limit exactly; ⭐ (the review in parts, B6) the floor spends 8 short of the worst case Send
		// counted; Specify's own press spends 5, so the re-run's one try's reserve passes it by one call, and the root's sign-off,
		// counting none, stays 3 under it.~~ ⭐ Package L — D16 (`REG-D-135` (4)): MOVED DELIBERATELY to the whole-press count. Each
		// press now counts its whole worst case: Specify's, 210, reaches the limit exactly (the prior less the reserve and that
		// press; the floor spends nothing, so Send's read stays under it); Specify spends 13, so the re-run of its review —
		// these hands' store naming no refused review, every review the attempt holds, (1 + 32) × 6 = 198 — passes it by one
		// call, and the root's sign-off, counting none, stays 197 under it.
		const WHOLE_PRESS = (3 + 32) * 6;
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS;
		const l = halfBLane({
			paid: true,
			prior,
			floorCalls: 0,
			types: NO_POLICY_TYPES,
			stops: { pwu_s: { rerunReview: true, rerunWork: true, abandon: true } },
			unitCalls: { pwu_s: 13 }
		});
		const record = await l.run();
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~'beginExecute root' first, and the root's sign-off, counting none,
		// read after and fitting (197 under)~~ — the root waits for its children, and the lane presses and checks nothing after
		// the limit holds a re-run back: the run ends there, `paid-limit`, never `complete`.
		expect(l.only('beginExecute'), 'arrangement: Specify stops, and no later phase is pressed').toEqual([
			'beginExecute specify-wordfreq'
		]);
		expect(record.units[1]?.recovery.map((r) => [r.act, r.limitCheck?.total, r.limitCheck?.allowed, r.notPressed])).toEqual([
			['rerunReview', PHASE7_PAID_LIMIT + 1, false, `the limit: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls (D8)`]
		]);
		expect(
			record.units.map((u) => [u.slug, u.limitCheck === null, u.signOff]),
			'something was checked or signed off after the limit held the re-run back'
		).toEqual([
			['root', true, null],
			['specify-wordfreq', false, null],
			['build-wordfreq', true, null],
			['verify-wordfreq-end-to-end', true, null]
		]);
		expect(record.end?.reason, 'a run whose re-run the limit stopped ended as though it had completed').toBe('paid-limit');
	});
});

// ── ⛔ R4 (the lead's round-4 item 2) — THE LANE FAILS CLOSED ON A ROOT WHOSE TYPE IT CANNOT FIND OR READ ─────────────────────
// Paid, half B checks the limit before the agent's root is pressed, counting what its press may spend: ~~one try's reserve~~ ⭐ its
// whole press (package L, D16; `REG-D-135` (4)) for a
// root that declares MODEL, none for one that runs no model (`rootLimitCheck`). ⛔ A type the lane could not find or read was
// read as UNDECLARED (`dischargeOf`), counted none ahead and pressed: a root whose press may run a model, its calls uncounted.
// Now it is never pressed, and the run ends `root-type-unreadable`, why in its detail — the run report's own reading of such a
// root (`typeUnreadable`, R3-B F6). ⭑ Its control: a type read that names no discharge, which is UNDECLARED and runs no model.

describe('⛔ R4 (the lead’s round-4 item 2) — the lane FAILS CLOSED on a root whose type it cannot find or read: never pressed, why recorded, the run ended by name', () => {
	/** The agent's PWA, its root's type state replaced by `change`'s. */
	const withRootType = (change: (state: Record<string, unknown>) => Record<string, unknown>): ObjectRow[] =>
		AGENT_TYPES.map((t) => (t.state.isRoot === true ? { id: t.id, state: change({ ...t.state }) } : t));
	/** Why the lane ends such a run, as its record's end says it. */
	const unread = (why: string): string =>
		`the root’s type cannot be read (${why}): whether its press runs a model, and so what the limit must count before it, ` +
		'cannot be decided, so it is not pressed (D8; REG-D-112, finding 2)';

	it('⛔ a root whose type is NOT IN THE STORE is never pressed: the run ends root-type-unreadable, saying why', async () => {
		// ⛔ PREDICTED RED, read from the code: `dischargeOf` read a type it could not find as UNDECLARED, so the root counted
		// none ahead and was pressed.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~nothing pressed~~ — the root is pressed last, so its children run
		// and are signed off first; the root, when the page offers it, is never pressed.
		const l = halfBLane({ paid: true, types: AGENT_TYPES.filter((t) => t.state.isRoot !== true), signOffs: ALL_SIGNED_OFF });
		const record = await l.run();
		expect(l.only('beginExecute root'), 'a root whose type the lane cannot find was pressed').toEqual([]);
		expect(l.only('beginExecute'), 'arrangement: its three children ran first').toHaveLength(3);
		expect([record.end?.reason, record.end?.detail]).toEqual(['root-type-unreadable', unread('pwutype_root is not in the store')]);
		expect([record.units[0]?.limitCheck, l.written().end?.reason]).toEqual([null, 'root-type-unreadable']);
		expect(laneVerdict(record)).toEqual([
			`the run ended 'root-type-unreadable', not 'complete': ${unread('pwutype_root is not in the store')}`
		]);
	});

	it('⛔ and so is a root that names NO TYPE, and one whose type declares a discharge that is NO WORD', async () => {
		// ⛔ PREDICTED RED, read from the code: each was read as UNDECLARED, counted none ahead, and pressed.
		// ⭑ Package M (D6, D7) — each child signed off, so the root is offered last and its type read then.
		const noType = halfBLane({
			paid: true,
			units: AGENT_UNITS.map((u) => (u.id === 'pwu_r' ? { ...u, typeId: '' } : u)),
			signOffs: ALL_SIGNED_OFF
		});
		const noTypeRecord = await noType.run();
		const garbled = halfBLane({ paid: true, types: withRootType((s) => ({ ...s, workDischarge: 7 })), signOffs: ALL_SIGNED_OFF });
		const garbledRecord = await garbled.run();
		expect([noType.only('beginExecute root'), garbled.only('beginExecute root')], 'a root whose type the lane cannot read was pressed').toEqual([[], []]);
		expect([noTypeRecord.end?.reason, noTypeRecord.end?.detail, garbledRecord.end?.reason, garbledRecord.end?.detail]).toEqual([
			'root-type-unreadable',
			unread('the unit pwu_r names no type'),
			'root-type-unreadable',
			unread('pwutype_root declares a workDischarge that is no word: 7')
		]);
	});

	it('⭐ `typeUnreadableOf` reads each way a type cannot be read — the unit not in the store, no type named, the type not in the store, a discharge that is no word — and reads a type that names none, or names one', () => {
		const snap = (pwus: ObjectRow[], pwuTypes: ObjectRow[]): EngineSnapshot => ({ pwus, pwuTypes }) as unknown as EngineSnapshot;
		const unit = (pwuTypeId: unknown): ObjectRow => ({ id: 'pwu_r', state: { pwuTypeId } });
		const type = (state: Record<string, unknown>): ObjectRow => ({ id: 'pwutype_root', state });
		expect([
			typeUnreadableOf(snap([], [type({ workDischarge: 'MODEL' })]), 'pwu_r'),
			typeUnreadableOf(snap([unit(undefined)], [type({ workDischarge: 'MODEL' })]), 'pwu_r'),
			typeUnreadableOf(snap([unit('pwutype_root')], []), 'pwu_r'),
			typeUnreadableOf(snap([unit('pwutype_root')], [type({ workDischarge: ['MODEL'] })]), 'pwu_r'),
			typeUnreadableOf(snap([unit('pwutype_root')], [type({})]), 'pwu_r'),
			typeUnreadableOf(snap([unit('pwutype_root')], [type({ workDischarge: null })]), 'pwu_r'),
			typeUnreadableOf(snap([unit('pwutype_root')], [type({ workDischarge: 'MODEL' })]), 'pwu_r')
		]).toEqual([
			'the unit pwu_r is not in the store',
			'the unit pwu_r names no type',
			'pwutype_root is not in the store',
			'pwutype_root declares a workDischarge that is no word: ["MODEL"]',
			null,
			null,
			null
		]);
	});

	it('⭑ CONTROL — a root whose type names NO discharge is READ, UNDECLARED: it runs no model, counts none ahead, and is pressed', async () => {
		const l = halfBLane({
			paid: true,
			types: withRootType((s) => Object.fromEntries(Object.entries(s).filter(([key]) => key !== 'workDischarge'))),
			signOffs: ALL_SIGNED_OFF
		});
		const record = await l.run();
		expect(l.only('beginExecute root')).toEqual(['beginExecute root']);
		expect([record.units[0]?.limitCheck?.ahead, record.units[0]?.limitCheck?.counted, record.end?.reason]).toEqual([
			0,
			'none: it runs no model',
			'complete'
		]);
	});
});

// ── ⭐⭐ E3'S POLISH — THE CONFIRM OF 60c8a828, ITS TWO MINORS AS THE LEAD DECIDED THEM ──────────────────────────────
// The lead's delegated decisions of 2026-10-15, to be registered: stage 1 says the agent authored the PWA only when a
// candidate of its was accepted (2), and a root that declares MODEL has its cells reported like any phase's (3). Each is
// held here by the test that was RED before it.

describe('⛔ E3’s polish, 2 — stage 1 says the agent authored the PWA only when a candidate of its was ACCEPTED; else what the authoring came to', () => {
	const drafted = halfBStore({ publication: 'DRAFT' });
	const store = { ...drafted, objects: drafted.objects.filter((x) => x.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE') };
	/**
	 * A paid run whose authoring accepted nothing: Send pressed, then its candidate and its acceptance as the lane read them,
	 * and the run's end — null for a record that names none.
	 */
	const unaccepted = (candidate: object | null, accept: object | null, end: string | null): LaneRows => {
		const lane = halfBLaneRows();
		return {
			...lane,
			run: {
				...(lane.run as object),
				units: [],
				end: end === null ? undefined : { reason: end },
				authoring: {
					pwaId: PWA_ID,
					sent: true,
					candidate,
					accept,
					authorModel: { configured: `${AUTHOR.providerId}/${AUTHOR.modelId}`, resolved: null },
					checks: null
				}
			}
		};
	};
	const firstLine = (lane: LaneRows): string | undefined =>
		cellOf(buildRunReport(store, lane, { accountNames: NAMES }).report, '1', 'whole run').basis[0];
	const DRAFT_LINE =
		'the PWA "CLI Product Realization" is DRAFT, still the draft the lane created: no candidate of the agent’s was accepted into it';

	// ⭐ THE PREDICTED RED (the confirm's MINOR): the line said "authored by the agent from the request" whatever the authoring
	// came to — in the same cell as "not asked — the turn never settled". ⭐ AND HOW THE RUN ENDED (the check of 241158f4,
	// finding 2): every case here ended authoring-stopped, so a line that always said so passed. A turn that outlasted its
	// allowance ends otherwise, and a record can name no end.
	it('⭐ no candidate staged, or one the floor did not assure: still the lane’s draft, and the line says what the authoring came to and how the run ended', () => {
		expect([
			firstLine(unaccepted(null, null, 'authoring-stopped')),
			firstLine(unaccepted({ status: 'BLOCKED_EXTERNAL', candidateHash: null }, null, 'authoring-stopped')),
			firstLine(unaccepted({ status: 'ASSURING', candidateHash: null }, null, 'allowance-exceeded')),
			firstLine(unaccepted(null, null, null))
		]).toEqual([
			`${DRAFT_LINE} — the authoring came to no staged candidate, and the run ended authoring-stopped`,
			`${DRAFT_LINE} — the authoring came to a candidate BLOCKED_EXTERNAL, and the run ended authoring-stopped`,
			`${DRAFT_LINE} — the authoring came to a candidate ASSURING, and the run ended allowance-exceeded`,
			`${DRAFT_LINE} — the authoring came to no staged candidate, and the run ended with no end recorded`
		]);
	});

	// ⭐ A HASH IS NOT AN ACCEPTANCE: a record the lane wrote before the check of 241158f4 can hold a hash beside a refused
	// acceptance, read out of the refusal's words — "Acceptance hash does not match the exact candidate (…)" (the server's,
	// `authoring-turn.ts`). ⭐ THE PREDICTED RED (that check, finding 1): only the first line held to it. The fourth line, the
	// faults and the authoring summary, report.json's and report.md's, read the refused hash as accepted, and no line named
	// the refusal.
	it('⛔ an acceptance REFUSED, a hash recorded beside it: no candidate was accepted — never “authored by the agent”, no accepted hash anywhere, and the refusal named', () => {
		const ready = { status: 'READY_TO_COMMIT', candidateHash: CANDIDATE_HASH };
		const refusal = `Acceptance hash does not match the exact candidate (${CANDIDATE_HASH} != sha256:${'cd'.repeat(32)}).`;
		const refused = { envelopeType: 'failure', acceptedHash: CANDIDATE_HASH, refusal };
		expect(firstLine(unaccepted(ready, refused, 'authoring-stopped'))).toBe(
			`${DRAFT_LINE} — the authoring came to a candidate READY_TO_COMMIT, and the run ended authoring-stopped`
		);
		const r = buildRunReport(store, unaccepted(ready, refused, 'authoring-stopped'), { accountNames: NAMES }).report;
		const one = cellOf(r, '1', 'whole run');
		expect([one.basis[3], r.authoring?.acceptedHash]).toEqual([
			'the accepted hash: none; the candidate as the lane last read it: READY_TO_COMMIT',
			null
		]);
		expect(one.basis).toEqual(
			expect.arrayContaining([
				'the lane recorded no accepted hash: no one accepted a candidate',
				`the acceptance was refused: ${refusal}`
			])
		);
		const md = renderMarkdown(r);
		expect(md).toContain('  - the accepted hash: none; the candidate as the lane last read it: READY_TO_COMMIT');
		expect(md).toContain('- **The accepted hash:** none.');
	});

	// ⭐ "NAMED ITS HASH" (the lead's delegated decision of 2026-10-15): an acceptance answered success that named no hash is no
	// acceptance either. ⭐ The check of 241158f4 (finding 2): the first line's own conjunct was held by no test.
	it('⛔ an acceptance answered success that named NO hash: no candidate shown accepted — the first line, the fourth and the faults agree', () => {
		const ready = { status: 'READY_TO_COMMIT', candidateHash: CANDIDATE_HASH };
		const hashless = { envelopeType: 'success', acceptedHash: null, refusal: null };
		const r = buildRunReport(store, unaccepted(ready, hashless, 'authoring-stopped'), { accountNames: NAMES }).report;
		const one = cellOf(r, '1', 'whole run');
		expect([one.basis[0], one.basis[3], r.authoring?.acceptedHash]).toEqual([
			`${DRAFT_LINE} — the authoring came to a candidate READY_TO_COMMIT, and the run ended authoring-stopped`,
			'the accepted hash: none; the candidate as the lane last read it: READY_TO_COMMIT',
			null
		]);
		expect(one.basis).toContain('the lane recorded no accepted hash: no one accepted a candidate');
	});

	// ⛔ R3-B F5 (the lead's round-3 item 5) — AN ACCEPTANCE THAT GOT NO ANSWER
	// READS AS NO ANSWER: the lane pressed it and heard nothing back — it outlasted its bound, or its request failed in transit
	// (`pressFormAction`) — so the server may still have accepted the candidate. Never "no candidate accepted".
	it('⛔ R3-B F5 — an acceptance that got NO ANSWER reads as no answer, which the server may still have accepted — never “no candidate accepted”', () => {
		// ⛔ PREDICTED RED, read from the code: the first line said "no candidate of the agent’s was accepted into it", and the
		// faults "no one accepted a candidate", of an acceptance whose answer never came.
		const ready = { status: 'READY_TO_COMMIT', candidateHash: CANDIDATE_HASH };
		const outlasted = { status: null, envelopeType: null, timedOutAfterMs: 300_000, requestFailure: null, refusal: null, acceptedHash: null };
		const lost = { ...outlasted, timedOutAfterMs: null, requestFailure: 'net::ERR_EMPTY_RESPONSE' };
		for (const [accept, end, how] of [
			[outlasted, 'allowance-exceeded', 'no answer within 300000 ms'],
			[lost, 'request-failed', 'no answer: the request failed in transit (net::ERR_EMPTY_RESPONSE)']
		] as const) {
			const r = buildRunReport(store, unaccepted(ready, accept, end), { accountNames: NAMES }).report;
			const one = cellOf(r, '1', 'whole run');
			expect(one.basis[0], how).toBe(
				`the PWA "CLI Product Realization" is DRAFT: its acceptance of a candidate got ${how}, and the server may still have ` +
					`accepted it — the authoring came to a candidate READY_TO_COMMIT, and the run ended ${end}`
			);
			expect(one.basis, how).toContain(`the acceptance got ${how}: the server may still have accepted it, and the lane recorded no hash`);
			expect(one.basis.join('\n'), how).not.toMatch(/no candidate of the agent’s was accepted|no one accepted a candidate/);
			// ⛔ AND THE ACCEPTED HASH, as stage 1's fourth line and the authoring section read it, is none RECORDED, with why: a
			// bare "none" said no hash was accepted, of a press whose answer never came.
			const acceptedLine = renderMarkdown(r)
				.split('\n')
				.find((l) => l.startsWith('- **The accepted hash:**'));
			expect([one.basis[3], acceptedLine], how).toEqual([
				`the accepted hash: none recorded — the acceptance got ${how}; the candidate as the lane last read it: READY_TO_COMMIT`,
				`- **The accepted hash:** none recorded — the acceptance got ${how}, and the server may still have accepted it.`
			]);
			expect(r.authoring?.acceptedHash, how).toBeNull();
		}
	});

	it('⭐ R3-B F5 — from the lane’s own record: an acceptance that outlasted its bound ends the run there, and the report reads it as no answer', async () => {
		const l = halfBLane({
			paid: true,
			accept: { status: null, envelopeType: null, rawBody: null, decoded: null, timedOutAfterMs: 300_000, requestFailure: null }
		});
		const record = await l.run();
		expect(record.end?.reason, 'arrangement: the acceptance outlasted its bound').toBe('allowance-exceeded');
		const one = cellOf(buildRunReport(store, { ...halfBLaneRows(), run: l.written() }, { accountNames: NAMES }).report, '1', 'whole run');
		expect(one.basis).toContain('the acceptance got no answer within 300000 ms: the server may still have accepted it, and the lane recorded no hash');
	});
});

describe('⛔ E3’s polish, 3 — a root that declares MODEL has its cells reported like any phase’s; §3.2’s HUMAN root keeps its reading', () => {
	/** Every model exchange of `store` READABLE at stage 8: what it was asked and what it answered, each in the content store. */
	const retained = (store: StoreRows): StoreRows => {
		const content: StoredContent[] = [];
		const objects = store.objects.map((o) => {
			if (o.objectType !== 'MODEL_EXCHANGE') return o;
			const refs = ['materializedInputRef', 'answerSpanRef'].map((field) => {
				const storageKey = `${field}/${o.id}`;
				const contentHash = `sha256:${o.id}.${field}`;
				content.push({ storageKey, contentHash, byteSize: 1, purged: false, actualHash: contentHash, actualSize: 1 });
				return [field, { status: 'STORED', storageKey, contentHash, byteSize: 1 }] as const;
			});
			return { ...o, state: { ...o.state, ...Object.fromEntries(refs) } };
		});
		return { ...store, objects, content };
	};
	/** The root's FIRST try: answered, and not a JSON object — its account reached its review as not declared (K9, REG-F-519). */
	const firstTryUnparsed = (store: StoreRows): StoreRows => ({
		...store,
		objects: [
			{
				id: 'mex_pwu_r_first',
				objectType: 'MODEL_EXCHANGE',
				firstSequence: 0,
				state: {
					plane: 'EXECUTION',
					subjectObjectId: 'pwu_r',
					disposition: 'ACCEPTED',
					parseOutcome: {
						outcome: 'SCHEMA_COERCION_FAILED',
						detail: 'The answer is not a JSON object, so the execution contract’s envelope could not be read.'
					}
				}
			},
			...store.objects
		]
	});
	/** The agent's root declaring MODEL, its one permitted child C+: instantiation builds none, so it is the Undertaking's one unit. */
	const MODEL_ROOT_ALONE: ObjectRow[] = [
		{
			id: 'pwutype_root',
			state: {
				...MODEL_ROOT_TYPES[3]!.state,
				permittedChildTypeIds: ['pwutype_specify'],
				permittedChildren: [{ typeId: 'pwutype_specify', cardinality: 'C+' }]
			}
		},
		AGENT_TYPES[1]!
	];
	const ROOT_ALONE = AGENT_UNITS.filter((u) => u.id === 'pwu_r');
	const ALL_MODEL = { pwu_r: 'model', pwu_s: 'model', pwu_b: 'model', pwu_v: 'model' } as const;
	/** The run report of a half-B run whose model exchanges are all readable — and, asked, the root's first try not JSON. */
	const reportOf = (
		types: readonly ObjectRow[],
		units: readonly AgentUnit[],
		ran: Readonly<Record<string, 'model' | 'press'>>,
		rootFirstTryUnparsed: boolean
	): RunReport => {
		const stored = halfBStore({ types, units, ran });
		return buildRunReport(retained(rootFirstTryUnparsed ? firstTryUnparsed(stored) : stored), halfBLaneRows({ types, units }), {
			accountNames: NAMES
		}).report;
	};
	const broke = (r: RunReport) => r.matrix.filter((c) => c.value === 'broke').map((c) => [c.stage, c.row, c.registerIds]);

	// ⭐ THE PREDICTED RED (the confirm's MINOR): the root's cells for stages 3 to 6 and 8 were skipped by its PLACE, so a MODEL
	// root's own tries, reviews and exchanges were never measured — and a run whose root broke a stage read as intended.
	it('⭐ a MODEL root that broke a stage — its first answer not JSON (K9) — reads BROKE there, over its phases and as the Undertaking’s one unit', () => {
		expect([
			broke(reportOf(MODEL_ROOT_TYPES, AGENT_UNITS, ALL_MODEL, true)),
			broke(reportOf(MODEL_ROOT_ALONE, ROOT_ALONE, { pwu_r: 'model' }, true))
		]).toEqual([[['4', 'root', ['REG-F-519']]], [['4', 'root', ['REG-F-519']]]]);
	});

	it('⭐ … and it is measured like any phase: its cells at stages 3 to 8, its column of the matrix, and a phase of the runs the manifest counts', () => {
		const r = reportOf(MODEL_ROOT_TYPES, AGENT_UNITS, ALL_MODEL, false);
		expect(r.matrix.filter((c) => c.row === 'root').map((c) => [c.stage, c.value])).toEqual([
			['3', 'as intended'],
			['4', null],
			['5a', 'not reached'],
			['5b', 'not reached'],
			['6', null],
			['7', 'as intended'],
			['8', 'as intended']
		]);
		expect(renderMarkdown(r)).toContain('| Stage | root | specify-wordfreq | build-wordfreq | verify-wordfreq-end-to-end |');
		expect(Object.keys(r.manifest.unrecordedRuns)).toEqual(['root', 'specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end']);
	});

	// ⭑ THE CONTROL: §3.2's root declares HUMAN, and so may the agent's — it runs no model, its work is its phases', and it
	// keeps its reading: in the whole run's stage 7, never a column of its own.
	it('⭑ CONTROL — a HUMAN root keeps its reading: no cell of its own, no column of the matrix, no phase of the manifest', () => {
		const r = reportOf(AGENT_TYPES, AGENT_UNITS, { ...ALL_MODEL, pwu_r: 'press' }, false);
		expect(r.matrix.filter((c) => c.row === 'root')).toEqual([]);
		expect(renderMarkdown(r)).toContain('| Stage | specify-wordfreq | build-wordfreq | verify-wordfreq-end-to-end |');
		expect(Object.keys(r.manifest.unrecordedRuns)).toEqual(['specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end']);
	});

	// ⭑ AND A ROOT THAT DECLARES UNDECLARED (the check of 241158f4, finding 2): the control above held only HUMAN, and the
	// decision makes a phase of a MODEL root alone. UNDECLARED is `REG-F-505`'s own trap, as the agent's verify leaf declares
	// it here: a type that runs no model.
	it('⭑ CONTROL — a root that declares UNDECLARED keeps its reading too: no cell of its own, no column of the matrix, no phase of the manifest', () => {
		const undeclared = AGENT_TYPES.map((t) =>
			t.state.isRoot === true ? { id: t.id, state: { ...t.state, workDischarge: 'UNDECLARED' } } : t
		);
		const r = reportOf(undeclared, AGENT_UNITS, { ...ALL_MODEL, pwu_r: 'press' }, false);
		expect(r.matrix.filter((c) => c.row === 'root')).toEqual([]);
		expect(renderMarkdown(r)).toContain('| Stage | specify-wordfreq | build-wordfreq | verify-wordfreq-end-to-end |');
		expect(Object.keys(r.manifest.unrecordedRuns)).toEqual(['specify-wordfreq', 'build-wordfreq', 'verify-wordfreq-end-to-end']);
	});

	// ⛔ R3-B F6 (the lead's round-3 item 6) — A ROOT WHOSE TYPE CANNOT BE READ
	// FAILS CLOSED: whether its press ran a model cannot be decided, so its cells are reported — broke, or not determined —
	// each with why, never skipped. ⚠ A type READ to declare no discharge is UNDECLARED, the control above.
	/** The report of a half-B run whose root's type `store` cannot read, held to what failing closed reports. */
	const failsClosed = (store: StoreRows, why: string): RunReport => {
		const r = buildRunReport(retained(store), halfBLaneRows(), { accountNames: NAMES }).report;
		const cells = r.matrix.filter((c) => c.row === 'root');
		expect(cells.map((c) => c.stage), 'the root’s cells').toEqual(['3', '4', '5a', '5b', '6', '7', '8']);
		for (const c of cells) {
			expect(c.value === 'broke' || c.value === null, `${c.stage} reads ${String(c.value)}`).toBe(true);
			expect(c.basis, c.stage).toContain(
				`the root unit’s type cannot be read (${why}): whether its press ran a model, and so which of its stages apply, ` +
					'cannot be decided, so each is reported, never skipped'
			);
		}
		expect(renderMarkdown(r)).toMatch(/\| Stage \| root \|/);
		expect(Object.keys(r.manifest.unrecordedRuns)).toContain('root');
		return r;
	};
	const PRESSED_ROOT = { ...ALL_MODEL, pwu_r: 'press' } as const;

	it('⛔ R3-B F6 — a root whose type is NOT IN THE STORE has its cells reported, broke or not determined, each with why: never skipped', () => {
		// ⛔ PREDICTED RED, read from the code: a type the report could not find was read as UNDECLARED, so the root was skipped
		// by its place: its own cells at stages 3 to 8 were reported nowhere, and its completion only as its line in the whole
		// run's stage 7 — a fault hidden by the very read that failed.
		const stored = halfBStore({ ran: PRESSED_ROOT });
		failsClosed({ ...stored, objects: stored.objects.filter((o) => o.id !== 'pwutype_root') }, 'pwutype_root is not in the store');
	});

	it('⛔ R3-B F6 — and so does a root whose type declares a discharge that is no word', () => {
		// ⛔ PREDICTED RED, read from the code: a discharge that is no string was read as UNDECLARED, and the root skipped.
		const garbled = AGENT_TYPES.map((t) => (t.state.isRoot === true ? { id: t.id, state: { ...t.state, workDischarge: 7 } } : t));
		failsClosed(halfBStore({ types: garbled, ran: PRESSED_ROOT }), 'pwutype_root declares a workDischarge that is no word: 7');
	});

	it('⛔ R3-B F6 — a stage the unread root BROKE stays broke, its register ids kept and the reason beside it; every other is not determined', () => {
		// ⭑ The root ran a model here, its first answer not JSON (K9): stage 4 breaks, as a MODEL root's would.
		const stored = firstTryUnparsed(halfBStore({ ran: ALL_MODEL }));
		const r = failsClosed({ ...stored, objects: stored.objects.filter((o) => o.id !== 'pwutype_root') }, 'pwutype_root is not in the store');
		expect(r.matrix.filter((c) => c.row === 'root').map((c) => [c.stage, c.value, c.registerIds])).toEqual([
			['3', null, []],
			['4', 'broke', ['REG-F-519']],
			['5a', null, []],
			['5b', null, []],
			['6', null, []],
			['7', null, []],
			['8', null, []]
		]);
	});

	// ⛔ R4 (the lead's round-4 item 4) — THE RUN'S STAGE 7 NEVER CONTRADICTS A ROOT WHOSE OWN STAGE-7 CELL READS NOT DETERMINED:
	// it reads not determined too, the root's reason on its line and the cell owed to the same person. A break decides it still.
	it('⛔ R4 (the lead’s round-4 item 4) — the run’s stage 7 does not contradict a root whose own stage-7 cell reads not determined: it reads not determined too, with the root’s reason', () => {
		// ⛔ PREDICTED RED, read from the code: the whole run's stage 7 read the root by its completion alone — SATISFIED, its step
		// SUCCEEDED: as intended — beside the root's own stage-7 cell, not determined, failed closed (R3-B F6).
		const stored = halfBStore({ ran: PRESSED_ROOT });
		const r = failsClosed({ ...stored, objects: stored.objects.filter((o) => o.id !== 'pwutype_root') }, 'pwutype_root is not in the store');
		const own = cellOf(r, '7', 'root');
		const whole = cellOf(r, '7', 'whole run');
		expect([own.value, whole.value], 'the run’s stage 7 contradicts the root’s own').toEqual([null, null]);
		expect([whole.owedTo, whole.basis[0], whole.unregistered]).toEqual([
			own.owedTo,
			'root: not determined — the root unit’s type cannot be read (pwutype_root is not in the store): whether its press ran a ' +
				'model, and so which of its stages apply, cannot be decided, so each is reported, never skipped',
			undefined
		]);
		expect(renderMarkdown(r)).toContain('| 7 Completion | open: a person: the root unit’s type cannot be read |');
	});

	it('⭑ CONTROL — a break decides the run’s stage 7 still: another unit’s, beside a root whose own cell is not determined', () => {
		// ⭑ The Verify leaf ran no model here, so its stage 7 is broke (REG-F-505), and the run broke with it, whatever the
		// unread root's own cell reads.
		const stored = halfBStore({ ran: { ...PRESSED_ROOT, pwu_v: 'press' } });
		const r = failsClosed({ ...stored, objects: stored.objects.filter((o) => o.id !== 'pwutype_root') }, 'pwutype_root is not in the store');
		const whole = cellOf(r, '7', 'whole run');
		expect([cellOf(r, '7', 'root').value, whole.value, whole.registerIds, whole.owedTo]).toEqual([null, 'broke', ['REG-F-505'], undefined]);
		expect(whole.basis[0], 'the root’s line').toMatch(/^root: not determined — the root unit’s type cannot be read/);
	});
});

// ── ⭐⭐ THE CHECK OF 241158f4 — ITS TWO MINORS ─────────────────────────────────────────────────────────────────────
// (1) A hash alone is no acceptance for EVERY reader of the lane's acceptance — stage 1's lines and faults, and the
// authoring summary (E3's polish, 2, above) — and the lane records no accepted hash beside a refusal (below).
// (2) What the polish built and no test held, each now held where it was built (E3's polish, 2 and 3, above): the run's
// end in stage 1's first line, the conjunct "named its hash", and a root that declares UNDECLARED.

describe('⛔ The check of 241158f4, 1 — only an acceptance answered SUCCESS names an accepted hash: the lane records none beside a refusal', () => {
	// ⭐ THE PREDICTED RED: `acceptedHashOf` read the first hash out of ANY answer's body, and a refusal's words name two —
	// "Acceptance hash does not match the exact candidate (<the hash pressed> != <the candidate's>)" — so the lane recorded
	// the hash pressed as accepted.
	it('⛔ a refused acceptance whose words name hashes: none accepted, in `acceptedHashOf` and in the run record, the refusal kept', async () => {
		const refusal = `Acceptance hash does not match the exact candidate (${CANDIDATE_HASH} != sha256:${'cd'.repeat(32)}).`;
		expect(acceptedHashOf(refusedWith(refusal))).toBeNull();
		const l = halfBLane({ paid: true, accept: refusedWith(refusal) });
		const record = await l.run();
		expect([record.end?.reason, record.authoring?.accept?.acceptedHash, record.authoring?.accept?.refusal]).toEqual([
			'authoring-stopped',
			null,
			refusal
		]);
	});
});

// ── ⭐⭐ THE REVIEW IN PARTS, B6 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D6, D11; roadmap 9a.7) ───────────────────────
// The floor reviews each type of the candidate as a part, in each of its two possible rounds: the spend reserve before Send
// counts parts, the inventory the turn staged is counted against it, and the lane's record and the run report hold ONE round
// and its complete part set — never one Reasoning Review of the PWA as a whole, which a round in parts never records.

describe('⭐⭐ The review in parts, B6 — the authoring’s spend reserve counts parts, and the lane and the report record one round’s complete part set', () => {
	/**
	 * The authoring floor's worst case for ~~the inventory anticipated before Send~~ sixteen parts: 2 × 16 × ~~4~~ 6 — ⛔ package L2,
	 * D20: what Send's check counted in a run recorded before D20, the 16 anticipated types (the report's cases below read such a
	 * record); Send now counts the allowance it hands the authoring review.
	 */
	const FLOOR_WORST = phase7AuthoringReviewerCalls(SIXTEEN);
	/** The prior that brought Send's read to the limit exactly, before D20. */
	const AT_SEND = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - FLOOR_WORST;
	/** ⭐ D20 — the calls spent before P6 again, as planned: the allowance handed over, 1,279, is not sixteen types' 192. */
	const PLANNED_PRIOR = 1117;
	/** A candidate of TWENTY types: four more than anticipated. */
	const TWENTY_TYPES: ObjectRow[] = Array.from({ length: 20 }, (_, i) => ({
		id: `pwutype_more_${i + 1}`,
		state: { pwaId: PWA_ID, name: `More ${i + 1}`, pwuKind: 'PRODUCT_IMPLEMENTATION', isRoot: i === 0, permittedChildTypeIds: [], status: 'ACTIVE' }
	}));
	const STAGED_INVENTORY = 'the authoring floor’s worst case, for the types its turn staged';

	// ⭐ Package L — D16 (`REG-D-135` (4)): Send counts the authoring floor's worst case at SIX calls a review.
	// ⭐ MOVED DELIBERATELY by package L2 — D20 (the brief's step 3): ~~"192 for the sixteen anticipated before Send"~~ — Send
	// counts the allowance it hands the authoring review, and `PHASE7_AUTHORING_ANTICIPATED_PARTS` is removed, no allowance in
	// time needing the estimate; the two-round worst case of an inventory stands, read by no check.
	it('⭐ the authoring’s worst case counts each part in each of its two rounds, ~~four~~ six calls a review: ~~8~~ 12 for one part, ~~128~~ 192 for sixteen ~~anticipated before Send~~', () => {
		expect([1, 4, 16, 20].map(phase7AuthoringReviewerCalls)).toEqual(
			[1, 4, 16, 20].map((parts) => PHASE7_AUTHORING_FLOOR_RUNS * parts * LANE_BUDGET.reviewerCallsPerTry)
		);
		expect([FLOOR_WORST, phase7AuthoringReviewerCalls(1)]).toEqual([192, 12]);
	});

	// ⛔ PREDICTED RED, read from the code: no read counted the inventory the turn staged, so a candidate larger than the reserve
	// counted before Send inherited that reserve unsaid.
	// ⭐⭐ MOVED DELIBERATELY by package L2 — D20 (`REG-F-580`; the brief's step 3): ~~"Send's check is counted again for the
	// inventory it staged, its passing the limit recorded"~~ — Send's check counts the allowance the lane hands the authoring
	// review, which every round of its floor reserves against before its first reviewer call: a bound whatever the inventory, so
	// no inventory is anticipated, none is counted again (`inventoryCheck` stays null), and a larger candidate inherits no
	// estimate. ⛔ PREDICTED RED, read from the code at 59135143: the check counted 192, the 16 anticipated types', and the twenty
	// staged were counted again.
	it('⛔ a candidate staging twenty types: Send’s check counted the allowance it handed over — the bound every round keeps to, whatever the inventory — so nothing is counted again, and the candidate is accepted', async () => {
		const l = halfBLane({ paid: true, prior: PLANNED_PRIOR, staged: [TWENTY_TYPES] });
		const record = await l.run();
		expect(record.authoring?.limitCheck, 'Send’s check did not count the allowance it hands over').toEqual({
			prior: PLANNED_PRIOR,
			recorded: 0,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: phase7AuthoringReviewAllowance(PLANNED_PRIOR),
			counted: 'the allowance the lane hands the authoring review, which no round of its floor may pass',
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
		expect(record.authoring?.parts).toBe(20);
		expect(record.authoring?.inventoryCheck, 'an inventory was counted again beside the allowance').toBeNull();
		expect(l.only('author.accept')).toEqual(['author.accept']);
	});

	it('⭐ CONTROL — a candidate within the anticipated inventory is not counted again: the reserve held', async () => {
		const l = halfBLane({ paid: true, prior: AT_SEND, staged: [SIXTEEN_TYPES] });
		const record = await l.run();
		expect([record.authoring?.parts, record.authoring?.inventoryCheck]).toEqual([16, null]);
	});

	// ⭑ A RUN RECORDED BEFORE D20 (package L2): its Send check counted the 16 anticipated types and its inventory was counted again.
	// The lane makes neither now; the report still reads such a record as it was made.
	it('⭐ the report lists Send’s check counted again among the lane’s reads, after Send’s own, past the limit where it is', () => {
		const lane = halfBLaneRows();
		const inventoryCheck = {
			prior: AT_SEND,
			recorded: 0,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: phase7AuthoringReviewerCalls(20),
			counted: STAGED_INVENTORY,
			total: AT_SEND + PHASE7_NEGATIVE_CONTROL_RESERVE + phase7AuthoringReviewerCalls(20),
			limit: PHASE7_PAID_LIMIT,
			allowed: false
		};
		const sendCheck = { ...inventoryCheck, ahead: FLOOR_WORST, counted: 'the authoring floor’s worst case, for 16 anticipated types', total: PHASE7_PAID_LIMIT, allowed: true };
		const run = lane.run as { authoring: Record<string, unknown> };
		const out = buildRunReport(
			halfBStore(),
			{ ...lane, run: { ...run, authoring: { ...run.authoring, limitCheck: sendCheck, inventoryCheck } } },
			{ accountNames: NAMES }
		).report;
		expect(out.reviewerCalls.laneLimitChecks.map((c) => [c.unit, c.before, c.total, c.allowed]).slice(0, 2)).toEqual([
			['authoring', 'Send', PHASE7_PAID_LIMIT, true],
			['authoring', 'Send, counted again for the inventory its turn staged', inventoryCheck.total, false]
		]);
		expect(renderMarkdown(out)).toContain(
			`  - authoring, before Send, counted again for the inventory its turn staged: ${AT_SEND} + 0 + ` +
				`${PHASE7_NEGATIVE_CONTROL_RESERVE} + ${phase7AuthoringReviewerCalls(20)} ahead (${STAGED_INVENTORY}) = ` +
				`${inventoryCheck.total} of ${PHASE7_PAID_LIMIT}, past it: nothing held back, its rounds having run inside the Send press.`
		);
	});

	// ⭐⭐ Package L's check, finding 1 (`REG-D-135` (4); design D16) — THE CAVEAT BESIDE THAT READ IS TRUE OF IT. ⛔ It said the
	// lane presses nothing that would pass the limit, *"so the reviewer exchanges the store records cannot pass it"*, printed
	// beside the read above, past the limit: Send's check counts the authoring floor's worst case for the 16 types anticipated —
	// an estimate, never a bound (`PHASE7_AUTHORING_ANTICIPATED_PARTS`), for no candidate exists before Send — and a candidate
	// that stages more spends its floor's reviews inside the Send press, where nothing is checked (`inventoryCheck` refuses
	// nothing). D16's Send row asks for the floor's WHOLE worst case, which no count before Send can be while nothing bounds
	// the inventory an agent authors; so the caveat states the true value, and says which reads show it.
	// ⭐⭐ MOVED DELIBERATELY by package L2 — D20 (`REG-F-580`; the brief's step 4; `P6X-L-M31`'s pin, which moves with it to
	// `P6X-L2-M8`): ~~"the caveat beside a staged read past the limit says Send can pass it: Send counts the 16 anticipated
	// types, an estimate and not a bound"~~ — the clause package L's check added is false now, and goes: Send's check counts the
	// allowance the lane hands the authoring review, which every round of its floor reserves its worst case against before its
	// first reviewer call, so Send's press is bounded by it; no inventory is counted again, so no read names one. The caveat says
	// so, beside the Send read of a run the lane records under D20, and keeps the two things the bound does not reach.
	// ⛔ PREDICTED RED, read from the code at 59135143: the caveat said Send's count was an estimate that a larger candidate's
	// floor could pass in that press.
	it('⛔ the caveat beside Send’s read says Send’s press is bounded by the allowance the lane hands the authoring review — the rule bounding the recorded exchanges, a lower bound when a capture faults', () => {
		const lane = halfBLaneRows();
		const sendCheck = {
			prior: PLANNED_PRIOR,
			recorded: 0,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: phase7AuthoringReviewAllowance(PLANNED_PRIOR),
			counted: 'the allowance the lane hands the authoring review, which no round of its floor may pass',
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		};
		const run = lane.run as { authoring: Record<string, unknown> };
		const out = buildRunReport(
			halfBStore(),
			{ ...lane, run: { ...run, authoring: { ...run.authoring, limitCheck: sendCheck, inventoryCheck: null } } },
			{ accountNames: NAMES }
		).report;
		expect(
			out.reviewerCalls.laneLimitChecks.map((c) => [c.unit, c.before, c.total, c.allowed])[0],
			'arrangement: Send’s read reaches the limit'
		).toEqual(['authoring', 'Send', PHASE7_PAID_LIMIT, true]);
		expect(
			out.reviewerCalls.laneLimitChecks.map((c) => c.before),
			'arrangement: no inventory is read again'
		).not.toContain('Send, counted again for the inventory its turn staged');
		const caveat = out.reviewerCalls.limitCaveat;
		expect(caveat, 'the caveat does not say Send’s press is bounded by the allowance').toContain(
			'Send’s press is bounded by the allowance the lane hands the authoring review'
		);
		expect(caveat, 'the caveat does not say the rule bounds the recorded exchanges').toContain(
			'So the rule bounds the reviewer exchanges the store records.'
		);
		expect(caveat, 'the caveat does not keep the lower bound').toContain('⚠ The recorded count is a lower bound');
		// ⛔ The estimate's clause is gone: it is false of a press the allowance bounds.
		expect(caveat, 'the caveat still says Send counts an estimate').not.toContain('an estimate and not a bound');
		expect(caveat, 'the caveat still says Send’s press can pass the limit').not.toContain('can pass the limit in that press');
		expect(caveat, 'the caveat still names a read the lane no longer makes').not.toContain('counted again for the inventory');
		expect(renderMarkdown(out), 'report.md does not carry it').toContain(`- **Caveat:** ${caveat}`);
	});

	// ⭐⭐ Package L2's check, finding 1 — THE CAVEAT OF A RUN RECORDED BEFORE D20 IS TRUE OF THAT RUN. ⛔ The caveat was one
	// constant for every report, D20's: the report of a run whose Send check counted the 16 anticipated types — its staged
	// inventory counted again, past the limit, and read "nothing held back, its rounds having run inside the Send press" (the
	// report's case above) — said beside that read that Send's press is bounded by the allowance the lane hands the authoring
	// review, "So the rule bounds the reviewer exchanges the store records": false of a run whose server had no allowance, and
	// the contradiction `P6X-L-M31` was added to remove. The record says which lane made it: Send's check names what it counted
	// (`counted`), so the report chooses the caveat's Send clause from it, and states that run's own count.
	// ⛔ PREDICTED RED, read from the code at de18c9e0: `buildReviewerCalls` sets `limitCaveat: LIMIT_CAVEAT` for every record,
	// so this caveat says the rule bounds the recorded exchanges.
	it('⛔ the caveat of a run recorded before D20 — its Send check counted the anticipated types, its inventory past the limit — says Send’s count was an estimate its press could pass, never that the allowance bounds it', () => {
		const lane = halfBLaneRows();
		const inventoryCheck = {
			prior: AT_SEND,
			recorded: 0,
			reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
			ahead: phase7AuthoringReviewerCalls(20),
			counted: STAGED_INVENTORY,
			total: AT_SEND + PHASE7_NEGATIVE_CONTROL_RESERVE + phase7AuthoringReviewerCalls(20),
			limit: PHASE7_PAID_LIMIT,
			allowed: false
		};
		const ANTICIPATED = 'the authoring floor’s worst case, for 16 anticipated types';
		const sendCheck = { ...inventoryCheck, ahead: FLOOR_WORST, counted: ANTICIPATED, total: PHASE7_PAID_LIMIT, allowed: true };
		const run = lane.run as { authoring: Record<string, unknown> };
		const out = buildRunReport(
			halfBStore(),
			{ ...lane, run: { ...run, authoring: { ...run.authoring, limitCheck: sendCheck, inventoryCheck } } },
			{ accountNames: NAMES }
		).report;
		expect(
			out.reviewerCalls.laneLimitChecks.map((c) => [c.before, c.allowed]).slice(0, 2),
			'arrangement: Send’s read, and the inventory counted again past the limit'
		).toEqual([
			['Send', true],
			['Send, counted again for the inventory its turn staged', false]
		]);
		const caveat = out.reviewerCalls.limitCaveat;
		// ⛔ Neither of D20's claims: this run's server had no allowance.
		expect(caveat, 'the caveat says the rule bounds the exchanges of a run past the limit').not.toContain(
			'So the rule bounds the reviewer exchanges the store records.'
		);
		expect(caveat, 'the caveat says an allowance bounded a run recorded before D20').not.toContain(
			'Send’s press is bounded by the allowance'
		);
		// ⭐ The true value, the record's own: what Send's check counted, an estimate, which the Send press could pass.
		expect(caveat, 'the caveat does not say the run was recorded before D20').toContain(
			'This run was recorded before the lane handed the authoring review an allowance (REG-F-580; design D20)'
		);
		expect(caveat, 'the caveat does not state the run’s own count before Send').toContain(
			`its check counted ${FLOOR_WORST} ahead (${ANTICIPATED}), an estimate and not a bound`
		);
		expect(caveat, 'the caveat does not say the Send press could pass the limit').toContain(
			'so the reviewer exchanges the store records can pass the limit in that press'
		);
		expect(caveat, 'the caveat does not name the read that shows it').toContain(
			'the read “Send, counted again for the inventory its turn staged” states the larger candidate’s worst case'
		);
		// ⭑ What every caveat keeps: the lane's count before each other press, and the lower bound.
		expect(caveat).toContain('The lane counts each press’s whole worst case before it');
		expect(caveat, 'the caveat does not keep the lower bound').toContain('⚠ The recorded count is a lower bound');
		expect(renderMarkdown(out), 'report.md does not carry it').toContain(`- **Caveat:** ${caveat}`);
	});

	// ⭑ THE WORDS THE REPORT CHOOSES THE CAVEAT BY ARE THE LANE'S: restated in the report (`run-report-core.ts`
	// `SEND_COUNTED_THE_ALLOWANCE`, for `phase7-operator.ts` loads Playwright), and held equal here to the words Send's check
	// records (`COUNTED_AHEAD.authoringAllowance`) — so a D20 run's report can never read as a run recorded before D20.
	it('⭑ the words a D20 Send check records are the ones the report chooses the D20 caveat by', () => {
		expect(SEND_COUNTED_THE_ALLOWANCE).toBe(COUNTED_AHEAD.authoringAllowance);
	});

	// ⛔ PREDICTED RED, read from the code: given the types, the lane took each type's latest review in the whole fork, so a
	// refinement's round that held no review of a type borrowed the first round's.
	it('⛔ the lane records ONE round of the fork, its complete part set: a refinement’s round that holds no review of a type borrows none from the first round', async () => {
		const tokenOf = (round: number) => `authoring-floor:sha256:candidate-${round}:floorrun_${round}`;
		const first = floorOfTheCandidate(AGENT_TYPES).map((a) => ({ id: `r1_${a.id}`, state: a.state }));
		const second = floorOfTheCandidate(AGENT_TYPES)
			.filter((a) => (a.state.subjectObjectIds as string[])[0] !== 'pwutype_build')
			.map((a) => ({ id: `r2_${a.id}`, state: a.state }));
		const completion = (round: number) => (a: ObjectRow) => ({
			eventType: 'AssuranceAssessmentCompleted',
			aggregateId: a.id,
			correlationId: tokenOf(round)
		});
		const l = halfBLane({
			paid: true,
			candidateFloor: {
				assessments: [...first, ...second],
				completionEvents: [...first.map(completion(1)), ...second.map(completion(2))]
			}
		});
		const record = await l.run();
		const review = record.authoring?.floor.find((f) => f.policyId === 'floor.reasoning-review');
		expect(review?.parts?.map((p) => [p.typeName, p.state]), 'the second round borrowed the first round’s review of Build').toEqual(
			AGENT_TYPES.map((t) => [t.state.name, t.id === 'pwutype_build' ? 'MISSING' : 'SATISFIED'])
		);
		expect(review?.state).toBe('MISSING');
	});

	// ⛔ PREDICTED RED, read from the code: the report read each policy's latest assessment of the PWA, so its Reasoning Review was
	// the one PWA-subject review in the store, recorded last here, and the round's rejected part was never read.
	it('⛔ stage 1 reads the round’s parts, never one PWA-subject review: beside a whole-PWA review SATISFIED, a REJECTED part reads BROKE, by name', () => {
		const one = cellOf(
			buildRunReport(halfBStore({ parts: { pwutype_build: 'REJECTED' }, wholePwaReview: 'SATISFIED' }), halfBLaneRows(), {
				accountNames: NAMES
			}).report,
			'1',
			'whole run'
		);
		expect([one.value, one.unregistered]).toEqual(['broke', true]);
		expect(one.basis).toContain("the authoring floor's floor.reasoning-review reads REJECTED");
		expect(one.basis).toContain(
			"the authoring floor's reasoning review, by type: Verify wordfreq end to end SATISFIED, Specify wordfreq SATISFIED, " +
				'Build wordfreq REJECTED, wordfreq Realization SATISFIED'
		);
	});

	it('⛔ the report reads the latest ROUND alone: a type its round did not review is MISSING, never an older round’s review of it', () => {
		const store = halfBStore();
		// ⭑ An older round, recorded first and under a token of its own, which reviewed every type; the newer one, the store's,
		// holds no review of Build.
		const older: StoredObject[] = store.objects
			.filter((o) => o.objectType === 'ASSURANCE_ASSESSMENT')
			.map((o, i) => ({ ...o, id: `older_${o.id}`, firstSequence: -100 + i }));
		const newer = store.objects.filter(
			(o) => !(o.objectType === 'ASSURANCE_ASSESSMENT' && (o.state.subjectObjectIds as string[])[0] === 'pwutype_build')
		);
		const requested = (o: StoredObject, i: number, token: string): StoredEvent => ({
			sequence: i + 1,
			eventType: 'AssuranceAssessmentRequested',
			aggregateType: 'ASSURANCE_ASSESSMENT',
			aggregateId: o.id,
			commandId: null,
			correlationId: token,
			payload: { assessmentId: o.id }
		});
		const events = [
			...older.map((o, i) => requested(o, i, 'authoring-floor:older')),
			...newer
				.filter((o) => o.objectType === 'ASSURANCE_ASSESSMENT')
				.map((o, i) => requested(o, older.length + i, 'authoring-floor:newer'))
		];
		const r = buildRunReport({ ...store, objects: [...older, ...newer], events: [...events, ...store.events] }, halfBLaneRows(), {
			accountNames: NAMES
		}).report;
		expect(r.authoring?.floor.find((f) => f.policyId === 'floor.reasoning-review')).toEqual({
			policyId: 'floor.reasoning-review',
			state: 'MISSING',
			parts: AGENT_TYPES.map((t) => ({
				typeId: t.id,
				typeName: t.state.name,
				state: t.id === 'pwutype_build' ? 'MISSING' : 'SATISFIED'
			}))
		});
	});

	it('⭐ the report’s part set is the PWA’s own types: a type of another PWA in the store is no part of it', () => {
		const store = halfBStore();
		const other: StoredObject = {
			id: 'pwutype_other',
			objectType: 'PWU_TYPE',
			state: { pwaId: 'pwa_other', name: 'Another PWA’s type' },
			firstSequence: 1_000
		};
		const one = cellOf(
			buildRunReport({ ...store, objects: [...store.objects, other] }, halfBLaneRows(), { accountNames: NAMES }).report,
			'1',
			'whole run'
		);
		expect(one.value, 'another PWA’s type was read as an unreviewed part').toBe('as intended');
	});

	// ⛔ PREDICTED RED, read from the code (package C's check, the MATERIAL finding): the report's part set was every type of the
	// PWA in the store, and a type the agent's broker removed is still there after the commit, its status REMOVED
	// (`RemovePwuType`), so it read as an unreviewed part — MISSING — and stage 1 broke on a SATISFIED floor.
	it('⛔ the report’s part set is the PWA’s live types: a type of the PWA the turn REMOVED is no part of it, beside a round that reviewed every live type', () => {
		const store = halfBStore();
		const removed: StoredObject = {
			id: 'pwutype_removed',
			objectType: 'PWU_TYPE',
			state: { pwaId: PWA_ID, name: 'A type the refinement removed', status: 'REMOVED' },
			firstSequence: 1_000
		};
		const r = buildRunReport({ ...store, objects: [...store.objects, removed] }, halfBLaneRows(), { accountNames: NAMES }).report;
		const review = r.authoring?.floor.find((f) => f.policyId === 'floor.reasoning-review');
		expect(review?.state, 'the removed type was read as an unreviewed part').toBe('SATISFIED');
		expect(review?.parts?.map((p) => p.typeId)).toEqual(AGENT_TYPES.map((t) => t.id));
		expect(cellOf(r, '1', 'whole run').value, 'stage 1 broke on a removed type').toBe('as intended');
		expect(renderMarkdown(r)).not.toContain('A type the refinement removed');
	});

	it('⭐ report.json’s authoring floor carries the round’s part set beside its aggregate, and report.md prints it', () => {
		const r = buildRunReport(halfBStore({ parts: { pwutype_verify: 'INCONCLUSIVE' } }), halfBLaneRows(), { accountNames: NAMES }).report;
		expect(r.authoring?.floor).toEqual([
			{ policyId: 'floor.schema-invariant', state: 'SATISFIED' },
			{ policyId: 'floor.identity-provenance', state: 'SATISFIED' },
			{
				policyId: 'floor.reasoning-review',
				state: 'INCONCLUSIVE',
				parts: AGENT_TYPES.map((t) => ({
					typeId: t.id,
					typeName: t.state.name,
					state: t.id === 'pwutype_verify' ? 'INCONCLUSIVE' : 'SATISFIED'
				}))
			}
		]);
		expect(renderMarkdown(r)).toContain(
			'- **Its reasoning review, by type:** Verify wordfreq end to end INCONCLUSIVE, Specify wordfreq SATISFIED, ' +
				'Build wordfreq SATISFIED, wordfreq Realization SATISFIED.'
		);
	});
});
