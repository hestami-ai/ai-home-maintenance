import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDeterministicHarness, type DeterministicHarness } from '../../helpers/deterministicHarness';

interface FakeClassList {
	add: (...tokens: string[]) => void;
	remove: (...tokens: string[]) => void;
	contains: (token: string) => boolean;
}

interface FakeElement {
	className: string;
	textContent: string;
	disabled: boolean;
	readOnly: boolean;
	style: Record<string, string>;
	dataset: Record<string, string>;
	classList: FakeClassList;
	querySelector: (selector: string) => FakeElement | null;
	querySelectorAll: (selector: string) => FakeElement[];
	appendChild: (child: FakeElement) => void;
	closest: (selector: string) => FakeElement | null;
}

interface DomHarness {
	document: Document;
	submitButton: FakeElement;
	submitBar: FakeElement;
	cardButton: FakeElement;
	cardTextarea: FakeElement;
	optionCard: FakeElement;
}

function createClassList(initial: string[] = []): FakeClassList {
	const values = new Set(initial);
	return {
		add: (...tokens: string[]) => {
			for (const token of tokens) { values.add(token); }
		},
		remove: (...tokens: string[]) => {
			for (const token of tokens) { values.delete(token); }
		},
		contains: (token: string) => values.has(token),
	};
}

function createFakeElement(overrides?: Partial<FakeElement>): FakeElement {
	return {
		className: '',
		textContent: '',
		disabled: false,
		readOnly: false,
		style: {},
		dataset: {},
		classList: createClassList(),
		querySelector: () => null,
		querySelectorAll: () => [],
		appendChild: () => {},
		closest: () => null,
		...overrides,
	};
}

function createDomHarness(cardId: string): DomHarness {
	const submitButton = createFakeElement({ textContent: 'Submit Decisions' });
	const cardButton = createFakeElement();
	const cardTextarea = createFakeElement();
	const optionCard = createFakeElement();

	const mirrorText = createFakeElement({ textContent: 'Tenant portal' });
	const mirrorItem = createFakeElement({
		dataset: { mmpMirrorId: 'MIR-1' },
		querySelector: (selector: string) => selector === '.mmp-mirror-item-text' ? mirrorText : null,
	});

	const submitBarChildren: FakeElement[] = [];
	const submitBar = createFakeElement({
		classList: createClassList(),
		querySelector: (selector: string) => {
			if (selector === '.mmp-submit-btn') { return submitButton; }
			if (selector === '.mmp-submit-error') {
				for (const child of submitBarChildren) {
					if (child.className === 'mmp-submit-error') { return child; }
				}
			}
			return null;
		},
		appendChild: (child: FakeElement) => {
			submitBarChildren.push(child);
		},
	});

	const mmpContainer = createFakeElement({
		querySelectorAll: (selector: string) => {
			switch (selector) {
				case '.mmp-mirror-item': return [mirrorItem];
				case '.mmp-menu-item': return [];
				case '.mmp-premortem-item': return [];
				case '[data-pd-edit-field]': return [];
				case 'button': return [cardButton];
				case 'textarea': return [cardTextarea];
				case '.mmp-option-card': return [optionCard];
				default: return [];
			}
		},
		closest: () => null,
	});

	const fakeDocument = {
		querySelector: (selector: string) => {
			if (selector === '[data-mmp-card-id="' + cardId + '"]') { return mmpContainer; }
			if (selector === '[data-mmp-submit-bar="' + cardId + '"]') { return submitBar; }
			return null;
		},
		querySelectorAll: () => [],
		createElement: () => createFakeElement(),
	} as unknown as Document;

	return {
		document: fakeDocument,
		submitButton,
		submitBar,
		cardButton,
		cardTextarea,
		optionCard,
	};
}

describe('webview MMP submit ack/reject contract', () => {
	const cardId = 'PD-REVIEW-1';
	let postedMessages: Array<Record<string, unknown>>;
	let persistedState: Record<string, unknown>;
	let deterministic: DeterministicHarness;

	beforeEach(() => {
		deterministic = useDeterministicHarness();
		vi.resetModules();
		postedMessages = [];
		persistedState = {};
	});

	afterEach(() => {
		deterministic.restore();
		Reflect.deleteProperty(globalThis as object, 'acquireVsCodeApi');
		Reflect.deleteProperty(globalThis as object, 'document');
	});

	it('keeps UI pending after mmpSubmit and commits only on accepted ack', async () => {
		const dom = createDomHarness(cardId);
		(globalThis as Record<string, unknown>).document = dom.document as unknown;
		(globalThis as Record<string, unknown>).acquireVsCodeApi = () => ({
			postMessage: (message: Record<string, unknown>) => postedMessages.push(message),
			getState: () => persistedState,
			setState: (next: unknown) => {
				if (next && typeof next === 'object') {
					persistedState = next as Record<string, unknown>;
				}
			},
		});

		const { handleMMPSubmit, handleMmpSubmitAccepted } = await import('../../../webview/mmp');
		const { state } = await import('../../../webview/state');

		state.mmpMirrorDecisions[cardId + ':MIR-1'] = { status: 'accepted' };
		state.mmpMenuSelections[cardId + ':MENU-1'] = { selectedOptionId: 'FULL' };
		state.mmpPreMortemDecisions[cardId + ':RISK-1'] = { status: 'accepted' };
		state.mmpMirrorDecisions['OTHER-CARD:MIR-9'] = { status: 'accepted' };

		handleMMPSubmit(cardId);

		expect(postedMessages.length).toBe(1);
		expect(postedMessages[0].type).toBe('mmpSubmit');
		expect(postedMessages[0].cardId).toBe(cardId);
		expect(dom.submitButton.textContent).toBe('Submitting...');
		expect(dom.submitButton.disabled).toBe(true);
		expect(dom.submitBar.classList.contains('submitted')).toBe(false);
		expect(dom.cardButton.disabled).toBe(false);
		expect(dom.cardTextarea.readOnly).toBe(false);
		expect(dom.optionCard.style.pointerEvents).toBeUndefined();
		expect(Object.keys(state.mmpMirrorDecisions)).toContain(cardId + ':MIR-1');

		handleMmpSubmitAccepted(cardId);

		expect(dom.submitBar.classList.contains('submitted')).toBe(true);
		expect(dom.submitButton.textContent).toBe('Decisions Submitted');
		expect(dom.submitButton.disabled).toBe(true);
		expect(dom.cardButton.disabled).toBe(true);
		expect(dom.cardTextarea.readOnly).toBe(true);
		expect(dom.optionCard.style.pointerEvents).toBe('none');
		expect(Object.keys(state.mmpMirrorDecisions)).not.toContain(cardId + ':MIR-1');
		expect(Object.keys(state.mmpMenuSelections)).not.toContain(cardId + ':MENU-1');
		expect(Object.keys(state.mmpPreMortemDecisions)).not.toContain(cardId + ':RISK-1');
		expect(Object.keys(state.mmpMirrorDecisions)).toContain('OTHER-CARD:MIR-9');
	});

	it('restores retry state on rejected ack and preserves decisions', async () => {
		const dom = createDomHarness(cardId);
		(globalThis as Record<string, unknown>).document = dom.document as unknown;
		(globalThis as Record<string, unknown>).acquireVsCodeApi = () => ({
			postMessage: (message: Record<string, unknown>) => postedMessages.push(message),
			getState: () => persistedState,
			setState: (next: unknown) => {
				if (next && typeof next === 'object') {
					persistedState = next as Record<string, unknown>;
				}
			},
		});

		const { handleMMPSubmit, handleMmpSubmitRejected } = await import('../../../webview/mmp');
		const { state } = await import('../../../webview/state');

		state.mmpMirrorDecisions[cardId + ':MIR-1'] = { status: 'accepted' };
		handleMMPSubmit(cardId);
		expect(dom.submitButton.textContent).toBe('Submitting...');
		expect(dom.submitButton.disabled).toBe(true);

		handleMmpSubmitRejected(cardId, 'Failed to save decisions');

		expect(dom.submitBar.classList.contains('submitted')).toBe(false);
		expect(dom.submitButton.textContent).toBe('Submit Decisions');
		expect(dom.submitButton.disabled).toBe(false);
		expect(Object.keys(state.mmpMirrorDecisions)).toContain(cardId + ':MIR-1');
		const errorNode = dom.submitBar.querySelector('.mmp-submit-error');
		expect(errorNode).toBeTruthy();
		expect(errorNode?.textContent).toBe('Failed to save decisions');
	});
});
