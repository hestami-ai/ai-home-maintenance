/**
 * Phase 16.5: Vendor Candidate Routes
 * 
 * Manages vendor candidates discovered during case research.
 * Supports the vendor discovery workflow with extraction and confirmation.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../router.js';
import { VendorCandidateStatusSchema } from '../schemas.js';
import { prisma } from '../../db.js';
import { recordIntent, recordExecution } from '../middleware/activityEvent.js';
import { startVendorCandidateWorkflow } from '../../workflows/index.js';
import type { VendorCandidateStatus } from '../../../../../generated/prisma/client.js';

// =============================================================================
// Schemas
// =============================================================================

// VendorCandidateStatusSchema now imported from schemas.js

const VendorCandidateOutputSchema = z.object({
	id: z.string(),
	caseId: z.string(),
	vendorName: z.string(),
	vendorContactName: z.string().nullable(),
	vendorContactEmail: z.string().nullable(),
	vendorContactPhone: z.string().nullable(),
	vendorAddress: z.string().nullable(),
	vendorWebsite: z.string().nullable(),
	serviceCategories: z.array(z.string()).nullable(),
	coverageArea: z.string().nullable(),
	licensesAndCerts: z.array(z.string()).nullable(),
	status: VendorCandidateStatusSchema,
	statusChangedAt: z.string().nullable(),
	sourceUrl: z.string().nullable(),
	extractedAt: z.string().nullable(),
	extractionConfidence: z.number().nullable(),
	notes: z.string().nullable(),
	riskFlags: z.array(z.string()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const VendorCandidateListItemSchema = z.object({
	id: z.string(),
	caseId: z.string(),
	vendorName: z.string(),
	vendorContactEmail: z.string().nullable(),
	vendorContactPhone: z.string().nullable(),
	serviceCategories: z.array(z.string()).nullable(),
	status: VendorCandidateStatusSchema,
	extractionConfidence: z.number().nullable(),
	createdAt: z.string()
});

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
	IDENTIFIED: ['CONTACTED', 'REJECTED', 'ARCHIVED'],
	CONTACTED: ['RESPONDED', 'REJECTED', 'ARCHIVED'],
	RESPONDED: ['QUOTED', 'REJECTED', 'ARCHIVED'],
	QUOTED: ['SELECTED', 'REJECTED', 'ARCHIVED'],
	SELECTED: ['ARCHIVED'],
	REJECTED: ['ARCHIVED'],
	ARCHIVED: []
};

// =============================================================================
// Helper Functions
// =============================================================================

function serializeVendorCandidate(vc: any) {
	return {
		id: vc.id,
		caseId: vc.caseId,
		vendorName: vc.vendorName,
		vendorContactName: vc.vendorContactName,
		vendorContactEmail: vc.vendorContactEmail,
		vendorContactPhone: vc.vendorContactPhone,
		vendorAddress: vc.vendorAddress,
		vendorWebsite: vc.vendorWebsite,
		serviceCategories: vc.serviceCategories as string[] | null,
		coverageArea: vc.coverageArea,
		licensesAndCerts: vc.licensesAndCerts as string[] | null,
		status: vc.status,
		statusChangedAt: vc.statusChangedAt?.toISOString() ?? null,
		sourceUrl: vc.sourceUrl,
		extractedAt: vc.extractedAt?.toISOString() ?? null,
		extractionConfidence: vc.extractionConfidence,
		notes: vc.notes,
		riskFlags: vc.riskFlags as string[] | null,
		createdAt: vc.createdAt.toISOString(),
		updatedAt: vc.updatedAt.toISOString()
	};
}

function serializeVendorCandidateListItem(vc: any) {
	return {
		id: vc.id,
		caseId: vc.caseId,
		vendorName: vc.vendorName,
		vendorContactEmail: vc.vendorContactEmail,
		vendorContactPhone: vc.vendorContactPhone,
		serviceCategories: vc.serviceCategories as string[] | null,
		status: vc.status,
		extractionConfidence: vc.extractionConfidence,
		createdAt: vc.createdAt.toISOString()
	};
}

// =============================================================================
// Router
// =============================================================================

export const vendorCandidateRouter = {
	/**
	 * Create a new vendor candidate (manual entry or from extraction)
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				vendorName: z.string().min(1).max(255),
				vendorContactName: z.string().max(255).optional(),
				vendorContactEmail: z.string().email().optional(),
				vendorContactPhone: z.string().max(50).optional(),
				vendorAddress: z.string().optional(),
				vendorWebsite: z.string().url().optional(),
				serviceCategories: z.array(z.string()).optional(),
				coverageArea: z.string().optional(),
				licensesAndCerts: z.array(z.string()).optional(),
				notes: z.string().optional(),
				// Provenance fields (for extracted vendors)
				sourceUrl: z.string().url().optional(),
				sourceHtml: z.string().optional(),
				sourcePlainText: z.string().optional(),
				extractionConfidence: z.number().min(0).max(1).optional(),
				extractionMetadata: z.record(z.string(), z.unknown()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendorCandidate: VendorCandidateOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Case not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case exists and belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('create', 'vendor_candidate', 'new');

			// Create vendor candidate via workflow
			const result = await startVendorCandidateWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						caseId: input.caseId,
						vendorName: input.vendorName,
						vendorContactName: input.vendorContactName,
						vendorContactEmail: input.vendorContactEmail,
						vendorContactPhone: input.vendorContactPhone,
						vendorAddress: input.vendorAddress,
						vendorWebsite: input.vendorWebsite,
						serviceCategories: input.serviceCategories,
						coverageArea: input.coverageArea,
						licensesAndCerts: input.licensesAndCerts,
						notes: input.notes,
						sourceUrl: input.sourceUrl,
						sourceHtml: input.sourceHtml,
						sourcePlainText: input.sourcePlainText,
						extractionConfidence: input.extractionConfidence,
						extractionMetadata: input.extractionMetadata as Record<string, unknown> | undefined
					}
				},
				input.idempotencyKey
			);

			if (!result.success || !result.vendorCandidateId) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to create vendor candidate' });
			}

			// Fetch the created vendor candidate
			const vendorCandidate = await prisma.vendorCandidate.findUnique({
				where: { id: result.vendorCandidateId }
			});

			// Record activity event
			await recordIntent(context, {
				entityType: 'VENDOR_CANDIDATE',
				entityId: vendorCandidate.id,
				action: 'CREATE',
				summary: `Vendor candidate identified: ${vendorCandidate.vendorName}`,
				caseId: input.caseId,
				newState: {
					vendorName: vendorCandidate.vendorName,
					status: vendorCandidate.status,
					sourceUrl: vendorCandidate.sourceUrl
				}
			});

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * Get vendor candidate by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendorCandidate: VendorCandidateOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Vendor candidate not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const vendorCandidate = await prisma.vendorCandidate.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!vendorCandidate) {
				throw errors.NOT_FOUND({ message: 'VendorCandidate' });
			}

			await context.cerbos.authorize('view', 'vendor_candidate', vendorCandidate.id);

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * List vendor candidates for a case
	 */
	listByCase: orgProcedure
		.input(
			PaginationInputSchema.extend({
				caseId: z.string(),
				status: VendorCandidateStatusSchema.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendorCandidates: z.array(VendorCandidateListItemSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			NOT_FOUND: { message: 'Case not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve vendor candidates' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'vendor_candidate', 'list');

			const limit = input.limit ?? 50;
			const vendorCandidates = await prisma.vendorCandidate.findMany({
				where: {
					organizationId: context.organization.id,
					caseId: input.caseId,
					deletedAt: null,
					...(input.status && { status: input.status as VendorCandidateStatus })
				},
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = vendorCandidates.length > limit;
			const items = hasMore ? vendorCandidates.slice(0, -1) : vendorCandidates;

			return successResponse(
				{
					vendorCandidates: items.map(serializeVendorCandidateListItem),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Update vendor candidate details
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				vendorName: z.string().min(1).max(255).optional(),
				vendorContactName: z.string().max(255).nullable().optional(),
				vendorContactEmail: z.string().email().nullable().optional(),
				vendorContactPhone: z.string().max(50).nullable().optional(),
				vendorAddress: z.string().nullable().optional(),
				vendorWebsite: z.string().url().nullable().optional(),
				serviceCategories: z.array(z.string()).optional(),
				coverageArea: z.string().nullable().optional(),
				licensesAndCerts: z.array(z.string()).optional(),
				notes: z.string().nullable().optional(),
				riskFlags: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendorCandidate: VendorCandidateOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Vendor candidate not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.vendorCandidate.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'VendorCandidate' });
			}

			await context.cerbos.authorize('update', 'vendor_candidate', existing.id);

			// Update vendor candidate via workflow
			const result = await startVendorCandidateWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					vendorCandidateId: input.id,
					data: {
						vendorName: input.vendorName,
						vendorContactName: input.vendorContactName,
						vendorContactEmail: input.vendorContactEmail,
						vendorContactPhone: input.vendorContactPhone,
						vendorAddress: input.vendorAddress,
						vendorWebsite: input.vendorWebsite,
						serviceCategories: input.serviceCategories,
						coverageArea: input.coverageArea,
						licensesAndCerts: input.licensesAndCerts,
						notes: input.notes,
						riskFlags: input.riskFlags
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to update vendor candidate' });
			}

			// Fetch updated vendor candidate
			const vendorCandidate = await prisma.vendorCandidate.findUnique({
				where: { id: input.id }
			});

			await recordExecution(context, {
				entityType: 'VENDOR_CANDIDATE',
				entityId: vendorCandidate.id,
				action: 'UPDATE',
				summary: `Vendor candidate updated: ${vendorCandidate.vendorName}`,
				caseId: existing.caseId,
				previousState: { vendorName: existing.vendorName },
				newState: { vendorName: vendorCandidate.vendorName }
			});

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * Update vendor candidate status
	 */
	updateStatus: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				status: VendorCandidateStatusSchema,
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendorCandidate: VendorCandidateOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Vendor candidate not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.vendorCandidate.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'VendorCandidate' });
			}

			// Validate status transition
			const validTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
			if (!validTransitions.includes(input.status)) {
				throw errors.BAD_REQUEST({
					message: `Invalid status transition from ${existing.status} to ${input.status}`
				});
			}

			await context.cerbos.authorize('update_status', 'vendor_candidate', existing.id);

			// Update status via workflow
			const result = await startVendorCandidateWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization.id,
					userId: context.user!.id,
					vendorCandidateId: input.id,
					data: {
						status: input.status
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to update vendor candidate status' });
			}

			// Fetch updated vendor candidate
			const vendorCandidate = await prisma.vendorCandidate.findUnique({
				where: { id: input.id }
			});

			await recordExecution(context, {
				entityType: 'VENDOR_CANDIDATE',
				entityId: vendorCandidate.id,
				action: 'STATUS_CHANGE',
				summary: `Vendor candidate status changed: ${existing.status} → ${input.status}${input.reason ? `: ${input.reason}` : ''}`,
				caseId: existing.caseId,
				previousState: { status: existing.status },
				newState: { status: input.status }
			});

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * Delete (soft) a vendor candidate
	 */
	delete: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Vendor candidate not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.vendorCandidate.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'VendorCandidate' });
			}

			await context.cerbos.authorize('delete', 'vendor_candidate', existing.id);

			// Delete vendor candidate via workflow
			const result = await startVendorCandidateWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					vendorCandidateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to delete vendor candidate' });
			}

			await recordExecution(context, {
				entityType: 'VENDOR_CANDIDATE',
				entityId: existing.id,
				action: 'DELETE',
				summary: `Vendor candidate deleted: ${existing.vendorName}`,
				caseId: existing.caseId
			});

			return successResponse({ success: true }, context);
		}),

	/**
	 * Extract vendor information from provided source (stub for AI extraction)
	 * This would call an AI service to extract structured vendor data
	 */
	extract: orgProcedure
		.input(
			z.object({
				caseId: z.string(),
				sourceUrl: z.string().url().optional(),
				sourceHtml: z.string().optional(),
				sourcePlainText: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					extracted: z.object({
						vendorName: z.string().nullable(),
						vendorContactName: z.string().nullable(),
						vendorContactEmail: z.string().nullable(),
						vendorContactPhone: z.string().nullable(),
						vendorAddress: z.string().nullable(),
						vendorWebsite: z.string().nullable(),
						serviceCategories: z.array(z.string()),
						coverageArea: z.string().nullable(),
						licensesAndCerts: z.array(z.string()),
						confidence: z.number(),
						fieldConfidences: z.record(z.string(), z.number())
					}),
					multipleVendorsDetected: z.boolean(),
					rawSource: z.string().nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Case not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case exists
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			await context.cerbos.authorize('create', 'vendor_candidate', 'new');

			// TODO: Integrate with AI extraction service
			// For now, return a stub response indicating extraction is not yet implemented
			// In production, this would:
			// 1. Send sourceHtml/sourcePlainText to an AI service
			// 2. Parse the response into structured vendor data
			// 3. Return confidence scores for each field

			// Stub extraction - in production this would call AI service
			const extracted = {
				vendorName: null as string | null,
				vendorContactName: null as string | null,
				vendorContactEmail: null as string | null,
				vendorContactPhone: null as string | null,
				vendorAddress: null as string | null,
				vendorWebsite: input.sourceUrl || null,
				serviceCategories: [] as string[],
				coverageArea: null as string | null,
				licensesAndCerts: [] as string[],
				confidence: 0,
				fieldConfidences: {} as Record<string, number>
			};

			// Simple extraction from plain text if provided
			if (input.sourcePlainText) {
				// Extract email
				const emailMatch = input.sourcePlainText.match(/[\w.-]+@[\w.-]+\.\w+/);
				if (emailMatch) {
					extracted.vendorContactEmail = emailMatch[0];
					extracted.fieldConfidences['vendorContactEmail'] = 0.8;
				}

				// Extract phone
				const phoneMatch = input.sourcePlainText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
				if (phoneMatch) {
					extracted.vendorContactPhone = phoneMatch[0];
					extracted.fieldConfidences['vendorContactPhone'] = 0.7;
				}

				// Calculate overall confidence
				const confidences = Object.values(extracted.fieldConfidences);
				extracted.confidence = confidences.length > 0
					? confidences.reduce((a, b) => a + b, 0) / confidences.length
					: 0;
			}

			return successResponse(
				{
					extracted,
					multipleVendorsDetected: false,
					rawSource: input.sourcePlainText || input.sourceHtml || null
				},
				context
			);
		})
};
