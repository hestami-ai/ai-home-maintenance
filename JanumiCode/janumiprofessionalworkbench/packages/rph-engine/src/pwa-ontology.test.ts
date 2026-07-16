// Proves the published-PWA → EngineOntology round-trip: author + publish a NEW PWA through the PWA Design context,
// project it to an EngineOntology, and stand up a fresh engine bound to that authored PWA — closing the loop
// (author a PWA, then run Undertakings under it).
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { createEngine, engineOntologyForPwa } from './index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'des', actorType: 'HUMAN' as const, displayName: 'D' };
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Q00';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q10';
const CHILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Q20';

describe('published-PWA -> EngineOntology seam', () => {
	it('authors + publishes a PWA and stands up an engine bound to it', () => {
		let seq = 0;
		const author = createEngine({ ontology, now: () => TS, newEventId: () => `e${++seq}` });
		const send = (commandType: string, payload: unknown, id: string, type: string) => {
			const n = ++seq;
			const command: DomainCommand = {
				commandId: `c-${n}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType: type,
				targetAggregateId: id,
				issuedAt: TS,
				issuedBy: actor,
				correlationId: 'corr',
				idempotencyKey: `k-${n}`,
				payload
			};
			const r = author.dispatch(command);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		};

		send(
			'CreatePwa',
			{ pwaId: PWA, name: 'Legal Compliance', description: 'd', domain: 'legal', version: '2.0.0' },
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		send(
			'DefinePwuType',
			{
				pwuTypeId: ROOT,
				pwaId: PWA,
				pwuKind: 'COMPLIANCE_ROOT',
				name: 'Compliance',
				purpose: 'root',
				isRoot: true,
				// Link the root to its child so the graph is a valid recursive decomposition — every non-root type
				// reachable from the one root (§11.6, §16 item 9). Without this rule Control is an orphan, which
				// ValidatePwa now rejects. The premise was "define two types"; the contract is "define a composition".
				permittedChildTypeIds: [CHILD]
			},
			ROOT,
			'PWU_TYPE'
		);
		send(
			'DefinePwuType',
			{
				pwuTypeId: CHILD,
				pwaId: PWA,
				pwuKind: 'CONTROL',
				name: 'Control',
				purpose: 'child',
				isRoot: false
			},
			CHILD,
			'PWU_TYPE'
		);
		send('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		send('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		send('PublishPwa', { rootPwuTypeId: ROOT }, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		const authored = engineOntologyForPwa(author, PWA);
		expect(authored.version).toBe('2.0.0');
		expect(authored.pwuTemplates).toHaveLength(2);
		expect(authored.pwuTemplates.filter((t) => t.isRoot)).toHaveLength(1);

		// The authored PWA can stand up a fresh engine (createEngine's one-root gate passes).
		const runtime = createEngine({
			ontology: authored,
			now: () => TS,
			newEventId: () => `r${++seq}`
		});
		expect(runtime.ontology.version).toBe('2.0.0');
		runtime.close();
		author.close();
	});
});
