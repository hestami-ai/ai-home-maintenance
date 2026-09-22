// THE PREMISE GUARD'S OWN CONTROL (`JAN-CRITREAD` `DD-6`) — proof that `draft-dependency-premises.ts` is REACHED,
// that it READ the turn's declared groups, and that it MEASURED commits. A guard whose population is empty passes
// silently, which is the failure mode its sibling `emitted-event-guard.test.ts` exists to rule out for the same
// instrumentation; and a guard whose key fields came back empty would measure nothing while looking green.
//
// The drive below is small and deliberate: two of the four group types are born and then EDITED here, so this file's
// own worker has a population for the key-field premise. The other two (assessments, exchanges) are measured in the
// workers that commit them — across the suite, which is the point of instrumenting `commit` rather than one drive.
import { createEngine } from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	GROUP_KEY_FIELDS,
	keyFieldRewrites,
	premiseLiveness,
	stateChangesWithoutTheirOwnEvent
} from './draft-dependency-premises.js';

const TS = '2026-09-22T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5V00';
const TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CONV = 'conv_01ARZ3NDEKTSV4RRFFQ69G5V02';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5V03';

describe('the draft-dependency premise guard measures what it claims', () => {
	it('it read the turn’s declared groups — every group type, with the key fields it keys on', () => {
		expect([...GROUP_KEY_FIELDS.keys()].sort()).toEqual([
			'ASSURANCE_ASSESSMENT',
			'AUTHORING_CONVERSATION',
			'MODEL_EXCHANGE',
			'PWU_TYPE'
		]);
		expect(GROUP_KEY_FIELDS.get('AUTHORING_CONVERSATION')).toEqual(['pwaId']);
		expect(GROUP_KEY_FIELDS.get('PWU_TYPE')).toEqual(['pwaId']);
		expect(GROUP_KEY_FIELDS.get('ASSURANCE_ASSESSMENT')).toEqual([
			'subjectObjectIds',
			'assurancePolicyId'
		]);
		expect(GROUP_KEY_FIELDS.get('MODEL_EXCHANGE')).toEqual(['subjectObjectId']);
	});

	it('it is reached by real commits, and a birth followed by an edit keeps its key field', () => {
		let n = 0;
		const engine = createEngine({
			authenticate: testAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_premise_${++n}`
		}).as(TEST_CRED.human);
		let seq = 0;
		const send = (
			commandType: string,
			targetAggregateType: string,
			id: string,
			payload: unknown
		) => {
			seq += 1;
			const command: DomainCommand = {
				commandId: `premise-${seq}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType,
				targetAggregateId: id,
				issuedAt: TS,
				correlationId: 'premise',
				idempotencyKey: `premise-idem-${seq}`,
				payload
			};
			return engine.dispatch(command);
		};
		const before = premiseLiveness.commits;

		expect(
			send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'Premise PWA',
				description: 'Born to be measured.',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			send('DefinePwuType', 'PWU_TYPE', TYPE, {
				pwuTypeId: TYPE,
				pwaId: PWA,
				pwuKind: 'PLAN',
				name: 'Plan',
				purpose: 'Plan the work',
				isRoot: true,
				permittedChildTypeIds: [],
				requiredInputs: [],
				requiredOutputs: [],
				requiredAssurancePolicyIds: []
			}).status
		).toBe('ACCEPTED');
		expect(
			send('EditPwuType', 'PWU_TYPE', TYPE, { pwuTypeId: TYPE, purpose: 'Plan it better' }).status,
			'an EDIT of a group member, so the key field is compared against its birth'
		).toBe('ACCEPTED');
		expect(
			send('AppendConversationEntries', 'AUTHORING_CONVERSATION', CONV, {
				conversationId: CONV,
				pwaId: PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'one' }]
			}).status
		).toBe('ACCEPTED');
		expect(
			send('AppendConversationEntries', 'AUTHORING_CONVERSATION', CONV, {
				conversationId: CONV,
				pwaId: PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'two' }]
			}).status,
			'a SECOND append, so the conversation is compared against its birth too'
		).toBe('ACCEPTED');

		// ⭐ THE PREMISE, ATTACKED RATHER THAN ONLY MEASURED. An append that NAMES ANOTHER PWA must not move the field
		// G1 keys on: if it could, a conversation would leave one PWA's group and join another's between a fork and
		// its commit. Nothing else in the suite tries this, so without this case the guard above measures a property
		// no test ever puts under pressure — and its own control mutant would survive.
		expect(
			send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', OTHER_PWA, {
				pwaId: OTHER_PWA,
				name: 'Another PWA',
				description: 'The one the append will name.',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			send('AppendConversationEntries', 'AUTHORING_CONVERSATION', CONV, {
				conversationId: CONV,
				pwaId: OTHER_PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'named at another PWA' }]
			}).status,
			'the append itself is accepted — it is the OWNER that must not move'
		).toBe('ACCEPTED');
		expect(
			(engine.loadObject(CONV)?.state as { pwaId?: string }).pwaId,
			'the conversation still belongs to the PWA it was born under'
		).toBe(PWA);

		expect(premiseLiveness.commits, 'the guard saw these commits').toBeGreaterThan(before);
		expect([...premiseLiveness.typesSeen].sort()).toEqual(
			expect.arrayContaining(['AUTHORING_CONVERSATION', 'PWU_TYPE'])
		);
		expect(keyFieldRewrites, 'no key field moved after birth').toEqual([]);
		expect(stateChangesWithoutTheirOwnEvent, 'every state change carried its own event').toEqual(
			[]
		);
		engine.close();
	});
});
