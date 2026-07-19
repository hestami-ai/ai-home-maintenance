// #1c — waiverRules ENFORCED (settable -> governing). A policy governs its OWN waivability (DOC-004 §12;
// WaiverRule): a RequestWaiver must be eligible under a rule that allows waiving the cited criterion, and must
// carry every compensating control that rule requires (DOC-004 §12.2 / JCPWA §36.4 — a waiver may not drop a
// control to nothing). An EMPTY waiverRules array (the seeded default) stays permissive, so floor/reference/demo
// waivers are unaffected. These drive that live against a policy that declares real rules.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-18T00:00:00Z';
const actor: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Lead' };
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5WVR';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5WSB';

describe('requestWaiver — waiverRules enforcement (#1c)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const cmd = (
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	): DomainCommand => {
		const n = ++seq;
		return {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
	};
	const dispatchOk = (c: DomainCommand): void => {
		const r = engine.dispatch(c);
		if (r.status !== 'ACCEPTED') throw new Error(`${c.commandType} rejected: ${JSON.stringify(r.error)}`);
	};

	/** A complete WaiverRule with permissive defaults, overridden per test. */
	const rule = (over: Record<string, unknown>) => ({
		waiverAllowed: true,
		eligibleCriteriaIds: [] as string[],
		prohibitedFindingSeverities: [] as string[],
		requiredAuthorityType: 'HUMAN',
		requiredRationaleFields: [] as string[],
		...over
	});

	function createPolicy(waiverRules: unknown[]): void {
		dispatchOk(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'Waivable policy',
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'd',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: 'NONE',
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE', 'REQUEST_HUMAN_DECISION', 'RESHAPE_PWU'],
				waiverRules
			})
		);
	}

	let waiverSeq = 0;
	function requestWaiver(criterionId: string, compensatingControls: string[]) {
		const wid = `dec_01ARZ3NDEKTSV4RRFFQ69G5W${waiverSeq++}0`;
		return engine.dispatch(
			cmd('RequestWaiver', wid, 'DECISION', {
				subjectObjectIds: [SUBJECT],
				scope: 'CRITERION',
				rationale: 'operational necessity',
				duration: 'P30D',
				affectedObjectIds: [],
				waivedPolicyId: POLICY,
				waivedCriterionId: criterionId,
				waivedFindingIds: [],
				compensatingControls,
				reviewConditions: []
			})
		);
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		waiverSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	it('rejects a waiver of a criterion no rule makes eligible', () => {
		createPolicy([rule({ eligibleCriteriaIds: ['C1'] })]);
		expect(requestWaiver('C1', []).status).toBe('ACCEPTED'); // C1 is eligible
		expect(requestWaiver('C2', []).status).toBe('REJECTED'); // C2 is not
	});

	it('rejects a policy that forbids waivers (waiverAllowed:false)', () => {
		createPolicy([rule({ waiverAllowed: false })]);
		expect(requestWaiver('C1', []).status).toBe('REJECTED');
	});

	it('requires the rule’s compensating controls — a waiver may not drop a control to nothing (§36.4)', () => {
		createPolicy([rule({ eligibleCriteriaIds: ['C1'], requiredCompensatingControls: ['audit-log'] })]);
		expect(requestWaiver('C1', []).status).toBe('REJECTED'); // no compensating control
		expect(requestWaiver('C1', ['other']).status).toBe('REJECTED'); // wrong one
		expect(requestWaiver('C1', ['audit-log']).status).toBe('ACCEPTED'); // the required one
	});

	it('an empty waiverRules array stays permissive (the seeded default is unaffected)', () => {
		createPolicy([]);
		expect(requestWaiver('C1', []).status).toBe('ACCEPTED');
	});
});
