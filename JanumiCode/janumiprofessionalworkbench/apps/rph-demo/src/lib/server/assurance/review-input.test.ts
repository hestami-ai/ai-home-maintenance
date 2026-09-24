// ⭐ `JAN-CRITREAD` J2-1 — THE REVIEW INPUT BUILDERS ARE PRODUCTION'S OWN, BYTE FOR BYTE.
//
// Reviewer qualification (DESIGN-what-the-tests-prove.md §5.2) runs a CASE through the reviewer-side assembly the
// product uses, and nothing else. That assembly — the `ReasoningReviewInput` the authoring floor and the
// work-product floor hand the reasoning-review validator — was written inline in `runPwaFloor` and
// `runWorkProductFloor`. `review-input.ts` holds it now, and both call sites build through it.
//
// TWO LIMBS, AND WHY BOTH:
//   · THE CALL SITES — each production floor runs over real inputs (the reference workbench's graph; the demo
//     backend's own work product) and over literal ones, and what it handed the validator (captured at
//     `runFloorAndPlanRecording`) and the prompt the validator materialized from it (captured at the `print`
//     seam) must equal what the module builds from the same inputs. While the inline code existed this compared
//     two implementations. Once it was deleted it compares the call site's WIRING with the module — a call site
//     that passed the wrong argument, or none, reddens it.
//   · THE PINS — the module's output on literal inputs, written out in full. They were shown equal to the INLINE
//     code's output while it still existed (the literal inputs below are run through production too), so after
//     the deletion they are what still discriminates a change inside the module: both limbs of the first kind
//     would move together.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** Every `ReasoningReviewInput` a production floor handed the validator, in call order. */
const seen = vi.hoisted(() => ({ inputs: [] as unknown[] }));

// ⚠ THE ONE SEAM THAT SEES THE INPUT ITSELF. The validator's `print` seam sees only the materialized prompt, which
// cannot tell `narration: ''` from `narration: undefined`, nor see `criteria`' severities. Wrapping the export the
// floors call — and delegating to the real one — records the input exactly as built, and changes nothing else.
vi.mock('@janumipwb/rph-assurance', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@janumipwb/rph-assurance')>();
	const runFloorAndPlanRecording: typeof actual.runFloorAndPlanRecording = (subject, ctx, registry, opts) => {
		seen.inputs.push(ctx.reasoningReview);
		return actual.runFloorAndPlanRecording(subject, ctx, registry, opts);
	};
	return { ...actual, runFloorAndPlanRecording };
});

import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ProfessionalRationaleSummary,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { listPwas, listPwuTypes, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from '../identity.js';
import { buildPwaExport, getEngine, resetEngine } from '../workbench.js';
import { reasoningReviewCriteria, runPwaFloor, type FloorProducer } from '../floor.js';
import { runWorkProductFloor } from '../execution/work-product-floor.js';
import { deterministicExecutionPrint } from '../execution/model.js';
import { splitExecutionEnvelope } from '../execution/execution-contract.js';
import { clearingJudgement, withLiveReviewerSeam } from './clearing-reviewer.testing.js';
import { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';
import { graphReviewInput, workProductReviewInput } from './review-input.js';

const PRODUCER: FloorProducer = {
	agentId: 'jpwb-authoring-agent',
	modelId: 'pi-authoring',
	providerId: 'janumi'
};

const RATIONALE: ProfessionalRationaleSummary = {
	rationale: 'Each obligation is a type, wired so every deliverable reaches the step that consumes it.',
	assumptions: ['The instruction is complete.'],
	limitations: ['Fabrication is outside the instruction.'],
	residualUncertainty: ['The ground conditions are unconfirmed.']
};

/** The prompt the REAL validator materializes from an input — what the model would be sent. */
async function materialize(input: ReasoningReviewInput): Promise<string> {
	const prompts: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		agentId: 'agy',
		modelId: 'test-judge-model',
		providerId: 'google',
		print: async (prompt) => {
			prompts.push(prompt);
			return clearingJudgement(input.criteria);
		}
	});
	const subject: AssuranceSubject = {
		subjectId: 'subject',
		objectType: 'ARTIFACT',
		semanticVersion: 1,
		isAiProduced: true,
		producer: { actorType: 'AGENT', agentId: 'p', modelId: 'p', providerId: 'p' }
	};
	await validator.evaluate(subject, { reasoningReview: input });
	expect(prompts, 'the validator sends exactly one prompt for a clean reply').toHaveLength(1);
	return prompts[0]!;
}

/** What a production floor built and sent: the input it handed the validator, and the prompt it materialized. */
interface Built {
	readonly input: ReasoningReviewInput;
	readonly prompt: string;
}

/** Run `floor` on the live reviewer seam, capturing both halves of what it built. */
async function captureProduction(floor: (print: (p: string) => Promise<string>) => Promise<unknown>): Promise<Built> {
	seen.inputs.length = 0;
	const prompts: string[] = [];
	await withLiveReviewerSeam(() =>
		floor(async (prompt) => {
			prompts.push(prompt);
			return clearingJudgement((seen.inputs.at(-1) as ReasoningReviewInput).criteria);
		})
	);
	expect(seen.inputs, 'the floor handed the validator exactly one reasoning-review input').toHaveLength(1);
	expect(prompts, 'the floor sent exactly one prompt').toHaveLength(1);
	return { input: seen.inputs[0] as ReasoningReviewInput, prompt: prompts[0]! };
}

/**
 * Byte identity of two inputs: the same keys in the same order, each value strictly equal (an own `undefined` is not an
 * absent key) and named when it is not, then the whole. `what` says which comparison this is.
 */
function expectSameInput(actual: ReasoningReviewInput, expected: ReasoningReviewInput, what: string): void {
	expect(Object.keys(actual), `${what}: the same keys, in the same order`).toEqual(Object.keys(expected));
	for (const key of Object.keys(expected) as (keyof ReasoningReviewInput)[])
		expect(actual[key], `${what}: the input's ${key}`).toStrictEqual(expected[key]);
	expect(actual, what).toStrictEqual(expected);
}

// ── the graph arm ────────────────────────────────────────────────────────────────────────────────────────────────

/** The options `runPwaFloor` takes that reach the reviewer's input. */
interface GraphOptions {
	readonly prompt: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly candidateSubjectHash?: string;
	readonly narration?: string;
	readonly priorGaps?: string[];
}
type GraphLabel = 'every option present' | 'no option at all' | 'an empty hash, empty prior gaps and empty narration';

/** Every option the authoring route can pass, and every absence of one. */
const GRAPH_OPTIONS: readonly { readonly label: GraphLabel; readonly opts: GraphOptions }[] = [
	{
		label: 'every option present',
		opts: {
			prompt: 'Design the architecture for the structural review of a footbridge.',
			rationale: RATIONALE,
			candidateSubjectHash: 'sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
			narration: 'Defined the types and wired their inputs and outputs.',
			priorGaps: ['RR-02-no-obligation-elision: the independent check is missing.', 'RR-08: a second gap']
		}
	},
	{ label: 'no option at all', opts: { prompt: 'Assess it.' } },
	{
		// ⚠ THE EMPTY HASH IS A BOUNDARY, NOT AN ABSENCE THE ROUTE NEVER SENDS: the builder appends the hash only when it
		// is non-empty, and a case's data could carry ''. Without it here, a builder that appended any DEFINED hash —
		// `"candidateSubjectHash":""` in the content — would pass every pin.
		label: 'an empty hash, empty prior gaps and empty narration',
		opts: { prompt: 'Assess it again.', rationale: RATIONALE, candidateSubjectHash: '', narration: '', priorGaps: [] }
	}
];

function moduleGraphInput(
	engine: AuthedEngineHandle,
	pwaId: string,
	opts: GraphOptions
): ReasoningReviewInput {
	const graph = buildPwaExport(pwaId, engine);
	if (!graph) throw new Error(`no export for ${pwaId}`);
	return graphReviewInput({ criteria: reasoningReviewCriteria(engine), graph, ...opts });
}

let setupSeq = 0;
function dispatch(
	engine: AuthedEngineHandle,
	commandType: string,
	targetAggregateType: string,
	targetAggregateId: string,
	payload: unknown
): void {
	setupSeq += 1;
	const command: DomainCommand = {
		commandId: `j21-setup-${setupSeq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType,
		targetAggregateId,
		issuedAt: '2026-09-24T09:00:00Z',
		correlationId: 'j21-setup',
		idempotencyKey: `j21-setup-${setupSeq}`,
		payload
	};
	const result = engine.dispatch(command);
	expect(result.status, `${commandType} ${targetAggregateId}: ${JSON.stringify(result.error)}`).toBe('ACCEPTED');
}

/** A small literal graph — the pins below are written against it. */
const LITERAL_PWA = 'pwa_01K5QFBR8Z0000000000000P01';
const LITERAL_NODES: readonly PwaGraphNode[] = [
	{
		id: 'pwut_01K5QFBR8Z0000000000000T01',
		name: 'Review',
		pwuKind: 'STRUCTURAL_REVIEW',
		isRoot: true,
		permittedChildTypeIds: ['pwut_01K5QFBR8Z0000000000000T02'],
		requiredInputs: [],
		requiredOutputs: [],
		executionBoundary: 'INTERNAL'
	},
	{
		id: 'pwut_01K5QFBR8Z0000000000000T02',
		name: 'Survey',
		pwuKind: 'SITE_INVESTIGATION',
		isRoot: false,
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: ['site-survey'],
		executionBoundary: 'INTERNAL'
	}
];
const LITERAL_EXPORT = buildPwaGraphExport(
	{ id: LITERAL_PWA, name: 'Footbridge', domain: 'civil-engineering', version: '1.0.0', publicationStatus: 'DRAFT' },
	LITERAL_NODES
);
/** `LITERAL_EXPORT` as production serializes it, written out — the pins' expected content starts with it. */
const LITERAL_EXPORT_JSON =
	'{"pwa":{"id":"pwa_01K5QFBR8Z0000000000000P01","name":"Footbridge","domain":"civil-engineering","version":"1.0.0","publicationStatus":"DRAFT"},' +
	'"nodes":[{"id":"pwut_01K5QFBR8Z0000000000000T01","name":"Review","pwuKind":"STRUCTURAL_REVIEW","isRoot":true,"permittedChildTypeIds":["pwut_01K5QFBR8Z0000000000000T02"],"requiredInputs":[],"requiredOutputs":[],"executionBoundary":"INTERNAL"},' +
	'{"id":"pwut_01K5QFBR8Z0000000000000T02","name":"Survey","pwuKind":"SITE_INVESTIGATION","isRoot":false,"permittedChildTypeIds":[],"requiredInputs":[],"requiredOutputs":["site-survey"],"executionBoundary":"INTERNAL"}],' +
	'"permits":[{"parent":"pwut_01K5QFBR8Z0000000000000T01","child":"pwut_01K5QFBR8Z0000000000000T02"}],' +
	'"dataFlow":[],"artifacts":[{"name":"site-survey","producedBy":["pwut_01K5QFBR8Z0000000000000T02"],"consumedBy":[]}],' +
	'"roots":["pwut_01K5QFBR8Z0000000000000T01"]';

/** Put `LITERAL_NODES` into an engine through the commands an author uses, so production can export and review it. */
function realizeLiteralGraph(engine: AuthedEngineHandle): void {
	dispatch(engine, 'CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', LITERAL_PWA, {
		pwaId: LITERAL_PWA,
		name: 'Footbridge',
		description: 'A literal graph the pins are written against.',
		domain: 'civil-engineering',
		version: '1.0.0'
	});
	// In node order: the engine lists types in the order they were defined, and the export keeps it.
	for (const n of LITERAL_NODES)
		dispatch(engine, 'DefinePwuType', 'PWU_TYPE', n.id, {
			pwuTypeId: n.id,
			pwaId: LITERAL_PWA,
			pwuKind: n.pwuKind,
			name: n.name,
			purpose: n.name,
			isRoot: n.isRoot,
			permittedChildTypeIds: [...n.permittedChildTypeIds],
			requiredInputs: [...n.requiredInputs],
			requiredOutputs: [...n.requiredOutputs]
		});
}

describe('JAN-CRITREAD J2-1 — the graph arm: graphReviewInput is what runPwaFloor builds', () => {
	it('⭐ the REFERENCE workbench graph — the call site and the module agree, input and prompt, under every option set', async () => {
		resetEngine('reference');
		const session = getEngine().as(SESSION_CREDENTIAL);
		// The largest seeded graph: the real subject a professional would first review.
		const pwaId = listPwas(session)
			.map((p) => p.id)
			.sort((a, b) => listPwuTypes(session, b).length - listPwuTypes(session, a).length)[0]!;
		expect(listPwuTypes(session, pwaId).length, 'a real graph, not a stub').toBeGreaterThan(3);
		for (const { label, opts } of GRAPH_OPTIONS) {
			const production = await captureProduction((print) =>
				runPwaFloor(pwaId, { ...opts, producer: PRODUCER, print }, session)
			);
			const module = moduleGraphInput(session, pwaId, opts);
			expectSameInput(module, production.input, `the call site — ${label}`);
			expect(await materialize(module), `the materialized prompt — ${label}`).toBe(production.prompt);
		}
	});

	it('⭐ a LITERAL graph put in an engine — the call site, the module and the pins agree', async () => {
		resetEngine('empty');
		const session = getEngine().as(SESSION_CREDENTIAL);
		realizeLiteralGraph(session);
		expect(JSON.stringify(buildPwaExport(LITERAL_PWA, session)), 'the engine exports the literal graph').toBe(
			JSON.stringify(LITERAL_EXPORT)
		);
		for (const { label, opts } of GRAPH_OPTIONS) {
			const production = await captureProduction((print) =>
				runPwaFloor(LITERAL_PWA, { ...opts, producer: PRODUCER, print }, session)
			);
			const module = moduleGraphInput(session, LITERAL_PWA, opts);
			expectSameInput(module, production.input, `the call site — ${label}`);
			expect(await materialize(module), `the materialized prompt — ${label}`).toBe(production.prompt);
			expectSameInput(module, GRAPH_PINS[label], `the pin — ${label}`);
		}
	});

	it('⛔ the PINS — graphReviewInput over the literal graph, written out (every branch of the assembly)', () => {
		for (const { label, opts } of GRAPH_OPTIONS) {
			const built = graphReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, graph: LITERAL_EXPORT, ...opts });
			expectSameInput(built, GRAPH_PINS[label], `the pin — ${label}`);
		}
	});
});

/** The graph builder's output on `LITERAL_EXPORT`, per option set — written out, not derived. */
const GRAPH_PINS: Record<GraphLabel, ReasoningReviewInput> = {
	'every option present': {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'PWA_GRAPH',
		prompt: 'Design the architecture for the structural review of a footbridge.',
		content:
			LITERAL_EXPORT_JSON +
			',"candidateSubjectHash":"sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0"}',
		rationale: RATIONALE,
		narration: 'Defined the types and wired their inputs and outputs.',
		prior: {
			gaps: ['RR-02-no-obligation-elision: the independent check is missing.', 'RR-08: a second gap']
		}
	},
	'no option at all': {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'PWA_GRAPH',
		prompt: 'Assess it.',
		content: `${LITERAL_EXPORT_JSON}}`,
		narration: ''
	},
	'an empty hash, empty prior gaps and empty narration': {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'PWA_GRAPH',
		prompt: 'Assess it again.',
		// No `"candidateSubjectHash":""`: an empty hash is appended as nothing.
		content: `${LITERAL_EXPORT_JSON}}`,
		rationale: RATIONALE,
		narration: ''
	}
};

// ── the work-product arm ─────────────────────────────────────────────────────────────────────────────────────────

const TS = '2026-09-24T09:00:00Z';
/** One sequence for the whole file: two runs in one engine must never mint the same id. */
let wpIdSeq = 0;

/** What `runWorkProductFloor`'s subject carries that reaches the reviewer's input. */
interface WorkProductSource {
	readonly producingPrompt: string;
	readonly answer: string;
	readonly rationale?: ProfessionalRationaleSummary;
	readonly priorGaps?: readonly string[];
}
type WorkProductLabel = 'rationale and prior gaps' | 'neither' | 'empty prior gaps';

/** A work product through the real floor, with the retained-exchange plumbing `verifyExchangeContent` reads. */
async function runWorkProduct(
	engine: AuthedEngineHandle,
	source: WorkProductSource,
	print: (p: string) => Promise<string>
): Promise<void> {
	const artifacts = createInMemoryArtifactStore();
	const ref = await artifacts.put({
		tenantPrefix: 'tnt-t',
		bytes: source.answer,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const stored = {
		status: 'STORED' as const,
		storageKey: ref.storageKey,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		purgeability: 'RETAINED_BY_PARTICIPATION' as const,
		contentDurability: artifacts.durability
	};
	await runWorkProductFloor(
		{
			artifactId: 'art_01K5QFBR8Z0000000000000W01',
			artifact: { semanticVersion: 1, provenance: {}, producingPwuId: 'pwu_1' },
			exchange: {
				exchangeId: 'mex_1',
				materializedInputRef: stored,
				rawOutputBeforeCoercionRef: stored,
				answerSpanRef: stored,
				volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
			} as never,
			answer: source.answer,
			producingPrompt: source.producingPrompt,
			producerModelId: 'test-producer-model',
			producerProviderId: 'test-provider',
			...(source.rationale ? { rationale: source.rationale } : {}),
			...(source.priorGaps ? { priorGaps: source.priorGaps } : {})
		},
		engine,
		{
			artifacts,
			now: () => TS,
			newId: (p) => `${p}_01K5QFBR8Z${String(++wpIdSeq).padStart(16, '0')}`,
			criteria: reasoningReviewCriteria(engine),
			print
		}
	);
}

const WP_LITERAL = {
	producingPrompt: 'Summarise the load analysis for the footbridge.',
	answer: '{"pedestrianLoad":"5.0 kN/m²","vibration":"2.1 Hz — checked; 0.52 m/s² below 0.7 m/s²"}'
} as const;

const WP_OPTIONS: readonly { readonly label: WorkProductLabel; readonly source: WorkProductSource }[] = [
	{
		label: 'rationale and prior gaps',
		source: {
			...WP_LITERAL,
			rationale: RATIONALE,
			priorGaps: ['RR-04-no-proxy-satisfaction: vibration was asserted, not shown.']
		}
	},
	{ label: 'neither', source: { ...WP_LITERAL } },
	{ label: 'empty prior gaps', source: { ...WP_LITERAL, rationale: RATIONALE, priorGaps: [] } }
];

describe('JAN-CRITREAD J2-1 — the work-product arm: workProductReviewInput is what runWorkProductFloor builds', () => {
	it('⭐ the demo backend’s OWN work product — the call site and the module agree, input and prompt', async () => {
		resetEngine('empty');
		const session = getEngine().as(SESSION_CREDENTIAL);
		// The deterministic backend's real reply, split exactly as `runModelInvocationStep` splits it.
		const producingPrompt = 'Assess the northern delivery route against the safety rubric, and state the risk.';
		const envelope = splitExecutionEnvelope(await deterministicExecutionPrint(producingPrompt));
		expect(envelope.rationale, 'the backend declares a rationale').toBeDefined();
		for (const priorGaps of [undefined, ['RR-01-no-problem-substitution: the route was not assessed.']]) {
			const source = {
				producingPrompt,
				answer: envelope.workProduct,
				...(envelope.rationale ? { rationale: envelope.rationale } : {}),
				...(priorGaps ? { priorGaps } : {})
			};
			const production = await captureProduction((print) => runWorkProduct(session, source, print));
			const module = workProductReviewInput({ criteria: reasoningReviewCriteria(session), ...source });
			expectSameInput(module, production.input, `the call site — prior gaps ${priorGaps ? 'present' : 'absent'}`);
			expect(await materialize(module)).toBe(production.prompt);
		}
	});

	it('⭐ a LITERAL work product — the call site, the module and the pins agree', async () => {
		resetEngine('empty');
		const session = getEngine().as(SESSION_CREDENTIAL);
		for (const { label, source } of WP_OPTIONS) {
			const production = await captureProduction((print) => runWorkProduct(session, source, print));
			const module = workProductReviewInput({ criteria: reasoningReviewCriteria(session), ...source });
			expectSameInput(module, production.input, `the call site — ${label}`);
			expect(await materialize(module), `the materialized prompt — ${label}`).toBe(production.prompt);
			expectSameInput(module, WP_PINS[label], `the pin — ${label}`);
		}
	});

	it('⛔ the PINS — workProductReviewInput over the literal work product, written out', () => {
		for (const { label, source } of WP_OPTIONS) {
			const built = workProductReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, ...source });
			expectSameInput(built, WP_PINS[label], `the pin — ${label}`);
		}
	});
});

/** The work-product builder's output, per option set — written out. Note the OWN `undefined`s: the work-product arm
 *  passes `rationale`, `narration` and `prior` unconditionally, and a strict comparison holds it to that. */
const WP_PINS: Record<WorkProductLabel, ReasoningReviewInput> = {
	'rationale and prior gaps': {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Summarise the load analysis for the footbridge.',
		content: '{"pedestrianLoad":"5.0 kN/m²","vibration":"2.1 Hz — checked; 0.52 m/s² below 0.7 m/s²"}',
		rationale: RATIONALE,
		narration: undefined,
		prior: { gaps: ['RR-04-no-proxy-satisfaction: vibration was asserted, not shown.'] }
	},
	neither: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Summarise the load analysis for the footbridge.',
		content: '{"pedestrianLoad":"5.0 kN/m²","vibration":"2.1 Hz — checked; 0.52 m/s² below 0.7 m/s²"}',
		rationale: undefined,
		narration: undefined,
		prior: undefined
	},
	'empty prior gaps': {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Summarise the load analysis for the footbridge.',
		content: '{"pedestrianLoad":"5.0 kN/m²","vibration":"2.1 Hz — checked; 0.52 m/s² below 0.7 m/s²"}',
		rationale: RATIONALE,
		narration: undefined,
		prior: undefined
	}
};
