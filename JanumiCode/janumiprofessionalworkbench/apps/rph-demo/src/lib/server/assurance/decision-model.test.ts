// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; design §12.3) — THE PRODUCT'S DECISION MODEL, AS CONFIGURED: the client
// only when the operator configured it — the server's address, the model (no default model, `REG-D-052`) and the identity its
// served digest and server version are held to — and, unconfigured, none, so every review is refused as package Z1 left it.
// ⛔ No model: the configured server is a local stub (`decision-model-stub.testing.ts`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configuredIndications, DECISION_MODEL_VARIABLES } from './decision-model.js';
import { startDecisionModelStub, STUB_DIGEST, STUB_MODEL, STUB_VERSION } from './decision-model-stub.testing.js';
import type { IndicationRequest } from './reasoning-review-validator.js';

const REQUEST: readonly IndicationRequest[] = [{ kind: 'check', key: 'c00', id: 'RR-01', label: 'The answer follows from the evidence.' }];
const MATERIAL = 'x\n';

beforeEach(() => {
	for (const v of Object.values(DECISION_MODEL_VARIABLES)) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐ Z2a — the decision model the product asks: the client, only as configured', () => {
	it('⭑ the four settings, by name', () => {
		expect(DECISION_MODEL_VARIABLES).toEqual({
			server: 'JPWB_DECISION_MODEL_SERVER',
			model: 'JPWB_DECISION_MODEL',
			digest: 'JPWB_DECISION_MODEL_DIGEST',
			serverVersion: 'JPWB_DECISION_MODEL_SERVER_VERSION'
		});
	});

	it('⛔ unconfigured: none, so the review is refused before any call, as package Z1 left it', () => {
		expect(configuredIndications()).toBeUndefined();
	});

	it('⭐ configured: the client, asking the configured server for the configured model and holding it to the configured identity', async () => {
		const s = await startDecisionModelStub();
		try {
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER', s.url);
			vi.stubEnv('JPWB_DECISION_MODEL', STUB_MODEL);
			vi.stubEnv('JPWB_DECISION_MODEL_DIGEST', STUB_DIGEST.slice(0, 12));
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER_VERSION', STUB_VERSION);
			const source = configuredIndications();
			expect(source).toBeDefined();
			const result = await source!(REQUEST, MATERIAL);
			expect(Object.keys('scores' in result ? result.scores : {})).toEqual(['c00']);
			// step 1's order: the digest, the version; whether the model is loaded; then `wait_gone` — absent — and its last read.
			expect(s.requests.map((r) => r.path)).toEqual(['/api/tags', '/api/version', '/api/ps', '/api/ps', '/api/ps', '/v1/systemone']);
			vi.stubEnv('JPWB_DECISION_MODEL_SERVER_VERSION', '0.40.16');
			const other = await configuredIndications()!(REQUEST, MATERIAL);
			expect('refusal' in other && other.refusal).toMatch(/^the server is Ollama 0\.40\.15, not 0\.40\.16/);
		} finally {
			await s.close();
		}
	});

	it('⛔ configured in part: a source that refuses every review, naming what is missing — never a default for it', async () => {
		vi.stubEnv('JPWB_DECISION_MODEL_SERVER', 'http://127.0.0.1:1');
		vi.stubEnv('JPWB_DECISION_MODEL_DIGEST', '  ');
		const result = await configuredIndications()!(REQUEST, MATERIAL);
		expect('refusal' in result && result.refusal).toBe(
			'the decision model is configured in part: JPWB_DECISION_MODEL, JPWB_DECISION_MODEL_DIGEST and JPWB_DECISION_MODEL_SERVER_VERSION are not set (REG-D-052: no default stands in for them)'
		);
	});
});
