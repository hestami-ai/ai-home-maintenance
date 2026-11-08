// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; design §12.3) — THE PRODUCT'S DECISION MODEL, AS CONFIGURED: the client
// only when the operator configured it — the server's address, the model (no default model, `REG-D-052`) ~~and the identity its
// served digest and server version are held to~~ — and, unconfigured, none, so every review is refused as package Z1 left it.
// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z2b — D51, D54; the Z2b brief's item 3): the identity the client is held to is
// D54's records' own (`DECISION_MODEL_RECORDS_IDENTITY`), no longer two settings of the operator's: `JPWB_DECISION_MODEL_DIGEST` and
// `JPWB_DECISION_MODEL_SERVER_VERSION` go, and a model other than the records' is refused — its scores are not the ones recorded.
// ⛔ No model: the configured server is a local stub (`decision-model-stub.testing.ts`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configuredIndications, DECISION_MODEL_VARIABLES } from './decision-model.js';
import { DECISION_MODEL_RECORDS_IDENTITY } from './decision-model-identity.js';
import { startDecisionModelStub, STUB_MODEL } from './decision-model-stub.testing.js';
import type { IndicationRequest } from './reasoning-review-validator.js';

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
		expect(configuredIndications()).toBeUndefined();
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
			const source = configuredIndications();
			expect(source).toBeDefined();
			const result = await source!(REQUEST, MATERIAL);
			expect(Object.keys('scores' in result ? result.scores : {})).toEqual(['c00']);
			// step 1's order: the digest, the version; whether the model is loaded; then `wait_gone` — absent — and its last read.
			expect(s.requests.map((r) => r.path)).toEqual(['/api/tags', '/api/version', '/api/ps', '/api/ps', '/api/ps', '/v1/systemone']);
			// ~~vi.stubEnv('JPWB_DECISION_MODEL_SERVER_VERSION', '0.40.16');~~ ⛔ MOVED (Z2b): a server of another version than the records'.
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER', later.url);
			const other = await configuredIndications()!(REQUEST, MATERIAL);
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
		const result = await configuredIndications()!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(
			// ~~'the decision model is configured in part: JPWB_DECISION_MODEL, JPWB_DECISION_MODEL_DIGEST and JPWB_DECISION_MODEL_SERVER_VERSION are not set (REG-D-052: no default stands in for them)'~~
			'the decision model is configured in part: JPWB_DECISION_MODEL is not set (REG-D-052: no default stands in for it)'
		);
	});

	// ⭐ Z2b (item 3) — the model the operator configures must be the records': another model's scores are not the ones recorded.
	it('⛔ Z2b — a model other than the records’ is refused, naming both: its scores are not the ones the records hold', async () => {
		vi.stubEnv('JPWB_DECISION_MODEL_SERVER', 'http://127.0.0.1:1');
		vi.stubEnv('JPWB_DECISION_MODEL', 'pplx-decider:27b-q8_0');
		const result = await configuredIndications()!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(
			'the configured decision model is pplx-decider:27b-q8_0, not pplx-decider:27b-q4_K_M, the model D54’s records were made with (D51; REG-D-052)'
		);
	});
});
