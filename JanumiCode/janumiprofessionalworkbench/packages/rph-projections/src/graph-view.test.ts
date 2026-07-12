// The reusable UI-ready graph View seam (pwuGraphNode): asserts the node shape + the no-green-without-assurance
// rule (INV-5 / Property P1) across its branches. Concrete Undertaking-instance graphs (the field-service
// Reference Undertaking) are demo seed data built + shown in apps/rph-demo — not gated here.
import { describe, expect, it } from 'vitest';
import { pwuGraphNode, type PwuAxesView } from './index.js';

const axes = (executionState: string, assuranceState: string): PwuAxesView => ({
	workLifecycleState: 'ACTIVE',
	executionState,
	assuranceState,
	shapeIntegrityState: 'PRESERVED'
});

describe('pwuGraphNode — the reusable UI-ready View seam', () => {
	it('exposes the four state axes + the pwuKind/label/baselined fields', () => {
		const n = pwuGraphNode(
			'pwu_1',
			'Intent',
			'INTENT_DEFINITION',
			axes('SUCCEEDED', 'SATISFIED'),
			true
		);
		expect(n.id).toBe('pwu_1');
		expect(n.label).toBe('Intent');
		expect(n.pwuKind).toBe('INTENT_DEFINITION');
		expect(n.baselined).toBe(true);
		expect(Object.keys(n.axes).sort()).toEqual([
			'assuranceState',
			'executionState',
			'shapeIntegrityState',
			'workLifecycleState'
		]);
	});

	it('no green without assurance (INV-5 / P1): qualifiedSuccess ONLY when execution SUCCEEDED AND assurance SATISFIED', () => {
		// the one green case
		expect(pwuGraphNode('a', 'a', 'K', axes('SUCCEEDED', 'SATISFIED')).qualifiedSuccess).toBe(true);
		// succeeded but only CONDITIONALLY assured => NOT green (the exec≠assurance gap made visible)
		expect(
			pwuGraphNode('b', 'b', 'K', axes('SUCCEEDED', 'CONDITIONALLY_SATISFIED')).qualifiedSuccess
		).toBe(false);
		// succeeded but assurance REJECTED => NOT green
		expect(pwuGraphNode('c', 'c', 'K', axes('SUCCEEDED', 'REJECTED')).qualifiedSuccess).toBe(false);
		// not yet executed => NOT green even if pending
		expect(pwuGraphNode('d', 'd', 'K', axes('NOT_PLANNED', 'PENDING')).qualifiedSuccess).toBe(
			false
		);
		// assured but still RUNNING => NOT green (execution not yet succeeded)
		expect(pwuGraphNode('e', 'e', 'K', axes('RUNNING', 'SATISFIED')).qualifiedSuccess).toBe(false);
	});

	it('baselined defaults to false', () => {
		expect(pwuGraphNode('x', 'x', 'K', axes('SUCCEEDED', 'SATISFIED')).baselined).toBe(false);
	});
});
