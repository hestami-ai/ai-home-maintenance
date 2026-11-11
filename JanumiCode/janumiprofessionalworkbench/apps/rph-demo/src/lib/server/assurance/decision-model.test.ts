// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; design §12.3) — THE PRODUCT'S DECISION MODEL, AS CONFIGURED: the client
// only when the operator configured it — the server's address, the model (no default model, `REG-D-052`) ~~and the identity its
// served digest and server version are held to~~ — and, unconfigured, none, so every review is refused as package Z1 left it.
// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z2b — D51, D54; the Z2b brief's item 3): the identity the client is held to is
// D54's records' own (`DECISION_MODEL_RECORDS_IDENTITY`), no longer two settings of the operator's: `JPWB_DECISION_MODEL_DIGEST` and
// `JPWB_DECISION_MODEL_SERVER_VERSION` go, and a model other than the records' is refused — its scores are not the ones recorded.
// ⛔ No model: the configured server is a local stub (`decision-model-stub.testing.ts`).
// ⭐⭐ Package L8 — D63 (`REG-D-152`; the lead's decision (A)): `configuredIndications` takes the versions accepted beside the records'.
// The cases written before L8 pass `[]` — the records' version alone, D53's form — so each pins what it pinned; the L8 block below
// drives the product's list (`DECISION_MODEL_ALSO_ACCEPTED`) and the product's review path (`createFloorRegistry`).
import {
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { configuredIndications, DECISION_MODEL_ALSO_ACCEPTED, DECISION_MODEL_VARIABLES } from './decision-model.js';
import { DECISION_MODEL_RECORDS_IDENTITY } from './decision-model-identity.js';
import { DECISION_MODEL_PROVIDER } from './decision-model-request.js';
import { startDecisionModelStub, STUB_MODEL, type DecisionModelStub } from './decision-model-stub.testing.js';
import { createExchangeSink } from './exchange-capture.js';
import { createFloorRegistry } from './index.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import { indicationsRefusedStatement, type IndicationRequest } from './reasoning-review-validator.js';

const REQUEST: readonly IndicationRequest[] = [{ kind: 'check', key: 'c00', id: 'RR-01', label: 'The answer follows from the evidence.' }];
const MATERIAL = 'x\n';
/** The settings Z2a read, and no longer read: set in every case below, so a client that read them would be seen to. */
const RETIRED = ['JPWB_DECISION_MODEL_DIGEST', 'JPWB_DECISION_MODEL_SERVER_VERSION'] as const;

beforeEach(() => {
	for (const v of [...Object.values(DECISION_MODEL_VARIABLES), ...RETIRED]) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐ Z2a — the decision model the product asks: the client, only as configured', () => {
	// ⛔ MOVED 2026-11-07 (Z2b, item 3): ~~the four settings, by name~~ — the two the operator sets; the identity is the records'.
	it('⭑ ~~the four settings, by name~~ the two settings, by name — the identity is not one of them (Z2b)', () => {
		expect(DECISION_MODEL_VARIABLES).toEqual({
			server: 'JPWB_DECISION_MODEL_SERVER',
			model: 'JPWB_DECISION_MODEL'
			// ~~digest: 'JPWB_DECISION_MODEL_DIGEST',~~
			// ~~serverVersion: 'JPWB_DECISION_MODEL_SERVER_VERSION'~~
		});
	});

	it('⛔ unconfigured: none, so the review is refused before any call, as package Z1 left it', () => {
		expect(configuredIndications([])).toBeUndefined();
	});

	// ⛔ MOVED 2026-11-07 (Z2b, item 3): ~~holding it to the configured identity~~ — held to the records' identity.
	it('⭐ configured: the client, asking the configured server for the configured model and holding it to ~~the configured identity~~ the records’ identity', async () => {
		const s = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: DECISION_MODEL_RECORDS_IDENTITY.serverVersion });
		const later = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: '0.40.16' });
		try {
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER', s.url);
			vi.stubEnv('JPWB_DECISION_MODEL', STUB_MODEL);
			// ⭑ Set, and read by nothing: a version the operator writes cannot stand in for the records'.
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER_VERSION', '0.40.16');
			const source = configuredIndications([]);
			expect(source).toBeDefined();
			const result = await source!(REQUEST, MATERIAL);
			expect(Object.keys('scores' in result ? result.scores : {})).toEqual(['c00']);
			// step 1's order: the digest, the version; whether the model is loaded; then `wait_gone` — absent — and its last read.
			expect(s.requests.map((r) => r.path)).toEqual(['/api/tags', '/api/version', '/api/ps', '/api/ps', '/api/ps', '/v1/systemone']);
			// ~~vi.stubEnv('JPWB_DECISION_MODEL_SERVER_VERSION', '0.40.16');~~ ⛔ MOVED (Z2b): a server of another version than the records'.
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER', later.url);
			const other = await configuredIndications([])!(REQUEST, MATERIAL);
			// ~~/^the server is Ollama 0\.40\.15, not 0\.40\.16/~~
			expect('refusal' in other && other.refusal).toMatch(/^the server is Ollama 0\.40\.16, not 0\.40\.15/);
		} finally {
			await s.close();
			await later.close();
		}
	});

	// ⛔ MOVED 2026-11-07 (Z2b, item 3): ~~JPWB_DECISION_MODEL, JPWB_DECISION_MODEL_DIGEST and JPWB_DECISION_MODEL_SERVER_VERSION are
	// not set~~ — of the two settings, the one missing.
	it('⛔ configured in part: a source that refuses every review, naming what is missing — never a default for it', async () => {
		vi.stubEnv('JPWB_DECISION_MODEL_SERVER', 'http://127.0.0.1:1');
		vi.stubEnv('JPWB_DECISION_MODEL', '  ');
		const result = await configuredIndications([])!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(
			// ~~'the decision model is configured in part: JPWB_DECISION_MODEL, JPWB_DECISION_MODEL_DIGEST and JPWB_DECISION_MODEL_SERVER_VERSION are not set (REG-D-052: no default stands in for them)'~~
			'the decision model is configured in part: JPWB_DECISION_MODEL is not set (REG-D-052: no default stands in for it)'
		);
	});

	// ⭐ Z2b (item 3) — the model the operator configures must be the records': another model's scores are not the ones recorded.
	it('⛔ Z2b — a model other than the records’ is refused, naming both: its scores are not the ones the records hold', async () => {
		vi.stubEnv('JPWB_DECISION_MODEL_SERVER', 'http://127.0.0.1:1');
		vi.stubEnv('JPWB_DECISION_MODEL', 'pplx-decider:27b-q8_0');
		const result = await configuredIndications([])!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(
			'the configured decision model is pplx-decider:27b-q8_0, not pplx-decider:27b-q4_K_M, the model D54’s records were made with (D51; REG-D-052)'
		);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L8 — design D63 (`REG-D-152`; the lead's decision (A)) — THE PRODUCT'S REVIEWS ACCEPT OLLAMA 0.40.16
// BESIDE THE RECORDS' 0.40.15, WITHOUT RE-MEASUREMENT: the version listed once, in `decision-model.ts`, beside the records' identity
// and not in it; `configuredIndications` takes the versions it is given, and the product's review path (`createFloorRegistry`) gives
// it the list. ⛔ PREDICTED RED, written first: at HEAD there is no list, the argument is not read, and a 0.40.16 server is refused.
// ⭑ The CONTROLS hold at HEAD and after: the records' identity, 0.40.15 with no list in it; the records' own version accepted with the
// list given; D53's form (`[]`) refusing 0.40.16 in today's words, byte for byte.
describe('⭐⭐ L8 (D63; REG-D-152) — the product accepts Ollama 0.40.16 beside the records’ 0.40.15, without re-measurement', () => {
	const stubs: DecisionModelStub[] = [];
	afterEach(async () => {
		for (const s of stubs.splice(0)) await s.close();
	});
	/** A server serving the records' model and digest and answering `version`, configured as the operator would. */
	const serving = async (version: string): Promise<DecisionModelStub> => {
		const s = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version });
		stubs.push(s);
		vi.stubEnv('JPWB_DECISION_MODEL_SERVER', s.url);
		vi.stubEnv('JPWB_DECISION_MODEL', STUB_MODEL);
		return s;
	};
	const questionsAsked = (s: DecisionModelStub) => s.requests.filter((r) => r.path === '/v1/systemone');

	it('⭐ the list: 0.40.16, the one version the sponsor accepted without re-measurement — frozen', () => {
		expect(DECISION_MODEL_ALSO_ACCEPTED).toEqual(['0.40.16']);
		expect(Object.isFrozen(DECISION_MODEL_ALSO_ACCEPTED)).toBe(true);
	});

	it('⭑ CONTROL — the records’ identity is unchanged: 0.40.15, and no list in it', () => {
		expect(DECISION_MODEL_RECORDS_IDENTITY).toEqual({
			model: 'pplx-decider:27b-q4_K_M',
			digest: '733585a9ebb6205d2d5b64a13748f0b1c9f1285885dd267780cfdb1c4c8ef141',
			serverVersion: '0.40.15'
		});
	});

	it('⭐ configured with the product’s list: a server answering 0.40.16 with the records’ digest is asked, and 0.40.16 is the version recorded', async () => {
		const s = await serving('0.40.16');
		const result = await configuredIndications(DECISION_MODEL_ALSO_ACCEPTED)!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal, 'the product’s client refused the version the sponsor accepted').toBe(false);
		expect(Object.keys('scores' in result ? result.scores : {})).toEqual(['c00']);
		expect(questionsAsked(s)).toHaveLength(1);
		expect(result.exchanges?.map((e) => e.served)).toEqual([
			{ model: STUB_MODEL, digest: DECISION_MODEL_RECORDS_IDENTITY.digest, serverVersion: '0.40.16' }
		]);
	});

	it('⭑ CONTROL — configured with the product’s list, the records’ own version is accepted as before', async () => {
		await serving(DECISION_MODEL_RECORDS_IDENTITY.serverVersion);
		const result = await configuredIndications(DECISION_MODEL_ALSO_ACCEPTED)!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(false);
		expect(result.exchanges?.map((e) => e.served.serverVersion)).toEqual(['0.40.15']);
	});

	it('⛔ configured with the product’s list: a server answering 0.40.17 is refused before any question, the refusal naming 0.40.15 and 0.40.16 and citing REG-D-152', async () => {
		const s = await serving('0.40.17');
		const result = await configuredIndications(DECISION_MODEL_ALSO_ACCEPTED)!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe('the server is Ollama 0.40.17, not 0.40.15 or 0.40.16 (D51; REG-F-608; REG-D-152)');
		expect(questionsAsked(s), 'no question asked').toEqual([]);
	});

	it('⭑ CONTROL — D53’s form, `configuredIndications([])`: a server answering 0.40.16 is refused in today’s words, byte for byte', async () => {
		await serving('0.40.16');
		const result = await configuredIndications([])!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe('the server is Ollama 0.40.16, not 0.40.15 (D51; REG-F-608)');
	});

	const SUBJECT: AssuranceSubject = {
		subjectId: 'pwa_decision_model',
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: 1,
		isAiProduced: true,
		producer: { actorType: 'AGENT', agentId: 'authoring-agent', modelId: 'executor-model', providerId: 'executor-provider' }
	};
	const CTX: ValidatorContext = {
		schemaInvariant: { schemaValid: true, invariantViolations: [] },
		reasoningReview: {
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			framing: 'PWA_GRAPH',
			prompt: 'Author a product realization PWA',
			content: '{"pwuTypes":[{"id":"t1"}]}',
			narration: ''
		}
	};

	/**
	 * THE PRODUCT'S REVIEW PATH: the floor registry as the host builds it (`createFloorRegistry`, `index.ts`), the reviewer agy with
	 * its model, its program stood in for by `print` — the seam the gate drives the wiring through — and the decision model as
	 * configured. What the reviewer was sent, the floor's recorded failures, and the decision model's tries on the record.
	 * ⛔ Hermetic: PATH points at an empty directory, and no replay is named.
	 */
	async function reviewedOnTheProductPath() {
		vi.stubEnv('PATH', noProgramsDirectory());
		for (const v of ['JPWB_REPLAY', 'JPWB_ASSURANCE_MODEL']) vi.stubEnv(v, undefined);
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-model');
		const prompts: string[] = [];
		const exchanges = createExchangeSink();
		const registry = createFloorRegistry({
			testMode: false,
			exchanges,
			print: async (p) => {
				prompts.push(p);
				return clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
			}
		});
		const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		return {
			prompts,
			failed: review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement),
			asked: exchanges
				.drain()
				.filter((r) => r.resolvedModelIdentity.kind === 'resolved' && r.resolvedModelIdentity.providerId === DECISION_MODEL_PROVIDER)
		};
	}

	it('⭐ the product’s review path (`createFloorRegistry`): a server answering 0.40.16 — the review is sent, its indications asked of that server, each try recorded as served by Ollama 0.40.16', async () => {
		const s = await serving('0.40.16');
		const { prompts, failed, asked } = await reviewedOnTheProductPath();
		expect(failed, 'the product’s review path refused the version the sponsor accepted').toEqual([]);
		expect(prompts, 'the review was sent, once').toHaveLength(1);
		expect(asked.length, 'every question asked is a try on the record').toBe(questionsAsked(s).length);
		expect(asked.length).toBeGreaterThan(0);
		for (const r of asked)
			expect(r.resolvedModelIdentity).toEqual({
				kind: 'resolved',
				modelId: STUB_MODEL,
				providerId: DECISION_MODEL_PROVIDER,
				evidence: 'PROVIDER_REPORTED',
				version: `${DECISION_MODEL_RECORDS_IDENTITY.digest} on Ollama 0.40.16`
			});
	});

	it('⛔ the product’s review path: a server answering 0.40.17 — refused before any reviewer call, the statement naming 0.40.15 and 0.40.16 and citing REG-D-152', async () => {
		const s = await serving('0.40.17');
		const { prompts, failed } = await reviewedOnTheProductPath();
		expect(failed).toEqual([
			indicationsRefusedStatement('the server is Ollama 0.40.17, not 0.40.15 or 0.40.16 (D51; REG-F-608; REG-D-152)')
		]);
		expect(prompts, 'no reviewer call').toEqual([]);
		expect(questionsAsked(s), 'no question asked').toEqual([]);
	});
});
