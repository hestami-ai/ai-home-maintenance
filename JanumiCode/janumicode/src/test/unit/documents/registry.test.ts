import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAvailableDocuments, DOCUMENT_DEFINITIONS } from '../../../lib/documents/registry';
import { DocumentType } from '../../../lib/documents/types';

import { getWorkflowState } from '../../../lib/workflow/stateMachine';
import { getIntakeConversation, getClaims } from '../../../lib/events/reader';
import { getArchitectureDocumentForDialogue } from '../../../lib/database/architectureStore';

vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/events/reader');
vi.mock('../../../lib/database/architectureStore');

describe('Document Registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('DOCUMENT_DEFINITIONS', () => {
		it('defines all document types', () => {
			expect(DOCUMENT_DEFINITIONS[DocumentType.VISION]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.CONOPS]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.PRD]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.DOMAIN_MODEL]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.ARCHITECTURE]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.IMPLEMENTATION_ROADMAP]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.TECHNICAL_BRIEF]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.CHANGE_IMPACT]).toBeDefined();
			expect(DOCUMENT_DEFINITIONS[DocumentType.VERIFICATION_SUMMARY]).toBeDefined();
		});

		it('includes system prompts for all types', () => {
			for (const def of Object.values(DOCUMENT_DEFINITIONS)) {
				expect(def.systemPrompt).toBeTruthy();
				expect(def.systemPrompt.length).toBeGreaterThan(0);
			}
		});

		it('includes labels and descriptions', () => {
			for (const def of Object.values(DOCUMENT_DEFINITIONS)) {
				expect(def.label).toBeTruthy();
				expect(def.description).toBeTruthy();
			}
		});

		it('assigns applicable categories', () => {
			expect(DOCUMENT_DEFINITIONS[DocumentType.VISION].applicableCategory).toBe('product_or_feature');
			expect(DOCUMENT_DEFINITIONS[DocumentType.TECHNICAL_BRIEF].applicableCategory).toBe('technical_task');
			expect(DOCUMENT_DEFINITIONS[DocumentType.DOMAIN_MODEL].applicableCategory).toBe('any');
		});
	});

	describe('getAvailableDocuments', () => {
		it('returns empty array if workflow state not found', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			const result = getAvailableDocuments('dialogue-999');

			expect(result).toEqual([]);
		});

		it('returns vision when plan has summary', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Test summary',
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.VISION)).toBe(true);
		});

		it('returns vision when plan has product vision', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					finalizedPlan: {
						productVision: 'Vision statement',
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.VISION)).toBe(true);
		});

		it('returns ConOps when plan has personas', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						personas: [{ id: 'P1', name: 'User' }],
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.CONOPS)).toBe(true);
		});

		it('returns ConOps when plan has user journeys', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						userJourneys: [{ id: 'J1', title: 'Journey' }],
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.CONOPS)).toBe(true);
		});

		it('returns PRD when plan has requirements and summary', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Summary',
						requirements: [{ id: 'REQ-1', text: 'Requirement' }],
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.PRD)).toBe(true);
		});

		it('returns Domain Model when plan has domain proposals', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						businessDomainProposals: [{ id: 'BD-1', name: 'Domain' }],
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.DOMAIN_MODEL)).toBe(true);
		});

		it('returns Architecture when architecture doc exists', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'ARCHITECTURE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: true,
				value: {
					doc_id: 'doc-123',
					capabilities: [],
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.ARCHITECTURE)).toBe(true);
		});

		it('returns Implementation Roadmap when architecture has sequence', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'ARCHITECTURE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: true,
				value: {
					doc_id: 'doc-123',
					implementation_sequence: [
						{ sort_order: 1, label: 'Step 1' },
					],
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.IMPLEMENTATION_ROADMAP)).toBe(true);
		});

		it('returns Technical Brief when task has requirements', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Fix bug',
						requirements: [{ id: 'REQ-1', text: 'Fix issue' }],
						requestCategory: 'technical_task',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.TECHNICAL_BRIEF)).toBe(true);
		});

		it('returns Change Impact when claims exist', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'PROPOSE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [
					{ claim_id: 'claim-1', statement: 'Claim' },
				],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.CHANGE_IMPACT)).toBe(true);
		});

		it('returns Verification Summary when claims exist', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'VERIFY' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [
					{ claim_id: 'claim-1', statement: 'Claim' },
				],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.VERIFICATION_SUMMARY)).toBe(true);
		});

		it('filters by request category', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Fix bug',
						requirements: [{ id: 'REQ-1' }],
						requestCategory: 'technical_task',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.TECHNICAL_BRIEF)).toBe(true);
			expect(result.some(d => d.type === DocumentType.VISION)).toBe(false);
		});

		it('allows "any" category documents for all request types', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						businessDomainProposals: [{ id: 'BD-1' }],
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.DOMAIN_MODEL)).toBe(true);
		});

		it('allows product docs when category is unknown', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Summary',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.VISION)).toBe(true);
		});

		it('blocks technical docs when category is unknown', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Summary',
						requirements: [{ id: 'REQ-1' }],
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.TECHNICAL_BRIEF)).toBe(false);
		});

		it('handles missing intake conversation', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: false,
				error: new Error('Not found'),
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result).toEqual([]);
		});

		it('prefers finalized plan over draft plan', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						summary: 'Draft summary',
					},
					finalizedPlan: {
						summary: 'Final summary',
						productVision: 'Vision',
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.VISION)).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles plan with entity proposals only', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						entityProposals: [{ id: 'E-1', name: 'Entity' }],
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.DOMAIN_MODEL)).toBe(true);
		});

		it('handles plan with phasing strategy for roadmap', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						phasingStrategy: [{ phase: 'Phase 1' }],
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.IMPLEMENTATION_ROADMAP)).toBe(true);
		});

		it('handles change impact with constraints but no claims', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'INTAKE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					draftPlan: {
						requirements: [{ id: 'REQ-1' }],
						constraints: [{ id: 'CON-1' }],
					},
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.some(d => d.type === DocumentType.CHANGE_IMPACT)).toBe(true);
		});

		it('returns multiple available documents', () => {

			vi.mocked(getWorkflowState).mockReturnValue({
				success: true,
				value: { current_phase: 'ARCHITECTURE' },
			} as any);

			vi.mocked(getIntakeConversation).mockReturnValue({
				success: true,
				value: {
					finalizedPlan: {
						summary: 'Summary',
						productVision: 'Vision',
						requirements: [{ id: 'REQ-1' }],
						personas: [{ id: 'P1' }],
						userJourneys: [{ id: 'J1' }],
						businessDomainProposals: [{ id: 'BD-1' }],
						requestCategory: 'product_or_feature',
					},
				},
			} as any);

			vi.mocked(getArchitectureDocumentForDialogue).mockReturnValue({
				success: true,
				value: {
					doc_id: 'doc-123',
					implementation_sequence: [{ sort_order: 1 }],
				},
			} as any);

			vi.mocked(getClaims).mockReturnValue({
				success: true,
				value: [{ claim_id: 'claim-1' }],
			} as any);

			const result = getAvailableDocuments('dialogue-123');

			expect(result.length).toBeGreaterThan(1);
		});
	});
});
