// SPIKE — IS THE EVIDENCE JOIN ONE LINE OR A REDESIGN?
//
// The brief: every production `CompleteExecutionStep` hard-codes `proposedEvidenceIds: []`, yet `ProposeEvidence`
// with `evidenceType: 'TEST_RESULT'` has been driven successfully through the real bus. If that is merely an
// unwired caller, an AI-produced step naming a real TEST_RESULT must be ACCEPTED by the engine today.
//
// ⛔ THE EXISTING PROOF IS ON A HUMAN STEP. `execution-exe006-explicit-result.test.ts` drives exactly this pair
// and its own header says the fixture is *"a NON-AI TRANSFORMATION with HUMAN provenance"*, pinned so the AI
// floor *"cannot fire"*. A step that ran a command under a model is AI-produced on every signal, so the proven
// case and the case we need are on opposite sides of the one gate that separates them. This drives BOTH.
import { it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { Engine } from '@janumipwb/rph-application';

const LOG = 'spike/evidence-transcript.txt';
writeFileSync(LOG, '');

const TS = '2026-09-14T00:00:00Z';
const HUMAN = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'Operator' };
const AGENT = { actorId: 'agent-x', actorType: 'AGENT' as const, displayName: 'Execution Agent' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GX100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GX110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GX120';
const EVD = 'evd_01ARZ3NDEKTSV4RRFFQ69GX130';
const S1 = `${PLAN}-s1`;

it('SPIKE — can an AI-produced step complete naming a TEST_RESULT?', async () => {
	const say = (s: string): void => { console.log(s); appendFileSync(LOG, s + String.fromCharCode(10)); };
	const rule = (s: string): void => say(String.fromCharCode(10) + '='.repeat(96) + String.fromCharCode(10) + s + String.fromCharCode(10) + '='.repeat(96));

	let origin = 'HUMAN_DECISION';
	const run = (aiProduced: boolean, stepType = 'TOOL_INVOCATION') => {
		let seq = 0;
		const store = new SqliteStorageAdapter({ now: () => TS });
		const engine: AuthedEngine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		const dispatch = (commandType: string, payload: unknown, id = PLAN, aggType = 'EXECUTION_PLAN') => {
			const n = ++seq;
			const command: DomainCommand = {
				commandId: `c-${n}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType: aggType,
				targetAggregateId: id,
				issuedAt: TS,
				correlationId: 'spike-evd',
				idempotencyKey: `k-${n}`,
				payload
			};
			return engine.dispatch(command);
		};

		dispatch('CaptureIntent', { intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' }, INTENT, 'INTENT');
		dispatch('ProposePwu', {
			pwuId: PWU, pwuKind: 'ARCHITECTURE', title: 'Arch', description: 'd', intentId: INTENT,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [], constraintIds: [], assumptionIds: [], expectedOutputs: [], assurancePolicyIds: [],
			riskProfile: { consequence: 'MEDIUM', uncertainty: 'MEDIUM', irreversibility: 'LOW', securitySensitivity: 'LOW', regulatoryExposure: 'NONE' }
		}, PWU, 'PROFESSIONAL_WORK_UNIT');
		const proposed = dispatch('ProposeExecutionPlan', {
			executionPlanId: PLAN, workUnitId: PWU,
			steps: [{
				id: S1, executionPlanId: PLAN,
				// ⭑ THE RATIFIED STEP TYPE FOR A TOOL. Nothing dispatches on it; the plan accepts it.
				stepType,
				purpose: 'run the suite',
				inputBindings: [], outputBindings: [{ bindingKind: 'EVIDENCE', name: 'the test result' }],
				preconditions: [], postconditions: [], stepState: 'QUEUED'
			}],
			transitions: [], retryPolicy: { maxAttempts: 3 }, tacticalChangePolicy: {}, escalationPolicy: {}, terminationPolicy: {}
		});
		say(`ProposeExecutionPlan(stepType=${stepType}) -> ${proposed.status} ${proposed.error?.message ?? ''}`);
		dispatch('ApproveExecutionPlan', {});
		dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		say(`StartExecutionStep -> ${dispatch('StartExecutionStep', { stepId: S1 }).status}`);

		// The evidence a real command run would produce: a TEST_RESULT whose content is the captured output.
		const pe = dispatch('ProposeEvidence', {
			evidenceId: EVD,
			evidenceType: 'TEST_RESULT',
			contentReference: { artifactId: 'art-x', contentHash: 'sha256:deadbeef' },
			producedBy: aiProduced ? AGENT : HUMAN,
			supportsClaimIds: [], contradictsClaimIds: [],
			scope: 'node greet.js, exit code 0',
			limitations: [], capturedAt: TS
		}, EVD, 'EVIDENCE');
		say(`ProposeEvidence(TEST_RESULT) -> ${pe.status} ${pe.error?.message ?? ''}`);

		const completion = {
			executionStepId: S1,
			executionAttemptId: `${S1}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			// ⭑⭑ THE FIELD THE BRIEF SAYS IS ALWAYS `[]` IN PRODUCTION.
			proposedEvidenceIds: [EVD],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: aiProduced
				? { originType: 'MODEL_GENERATION', executedBy: AGENT }
				: { originType: origin, executedBy: HUMAN }
		};
		const r = dispatch('CompleteExecutionStep', completion);
		say(`CompleteExecutionStep(stepType=${stepType}, aiProvenance=${aiProduced}, proposedEvidenceIds=[EVD])`);
		say(`   -> status = ${r.status}`);
		if (r.error) {
			say(`   -> code    = ${r.error.code}`);
			say('   -> VERBATIM MESSAGE:');
			say('   ---8<---');
			say(r.error.message);
			say('   --->8---');
		}
		const plan = store.loadObject(PLAN)!;
		const st = (plan.state as { steps: { id: string; stepState: string }[] }).steps.find((s) => s.id === S1)?.stepState;
		say(`   -> step state = ${st}`);
		return r;
	};

	const runToolOutput = () => {
		// Same as run(false) except originType is TOOL_OUTPUT and executedBy stays HUMAN, so ONLY the origin
		// class can raise aiProduced. If the floor fires, TOOL_OUTPUT alone is sufficient.
		const saved = origin;
		origin = 'TOOL_OUTPUT';
		run(false, 'TOOL_INVOCATION');
		origin = saved;
	};

	rule('A — HUMAN-produced step naming a TEST_RESULT (the shape already proven in the suite).');
	run(false);

	rule('B — AI-PRODUCED step naming the SAME TEST_RESULT. This is what a tool-executing step is.');
	run(true);

	rule('C — ISOLATING SIGNAL 1. Identical HUMAN provenance, HUMAN issuer, NO runtime binding.');
	say('Only stepType differs. floor-gate.ts:30 AI_STEP_TYPES = {MODEL_INVOCATION} — TOOL_INVOCATION is absent.');
	say(String.fromCharCode(10) + '-- stepType = MODEL_INVOCATION --');
	run(false, 'MODEL_INVOCATION');
	say(String.fromCharCode(10) + '-- stepType = TOOL_INVOCATION --');
	run(false, 'TOOL_INVOCATION');

	rule('D — TOOL_OUTPUT provenance on a TOOL_INVOCATION step (AI_ORIGIN_TYPES includes TOOL_OUTPUT).');
	runToolOutput();
}, 300_000);
