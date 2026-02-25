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
import { VendorCandidateWorkflowAction } from '../../workflows/vendorCandidateWorkflow.js';
import type { VendorCandidateStatus as VendorCandidateStatusType } from '../../../../../generated/prisma/client.js';
import { ActivityEntityType, ActivityActionType, VendorCandidateStatus } from '../../../../../generated/prisma/enums.js';

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
const VALID_STATUS_TRANSITIONS: Record<VendorCandidateStatusType, VendorCandidateStatusType[]> = {
	[VendorCandidateStatus.IDENTIFIED]: [VendorCandidateStatus.CONTACTED, VendorCandidateStatus.REJECTED, VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.CONTACTED]: [VendorCandidateStatus.RESPONDED, VendorCandidateStatus.REJECTED, VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.RESPONDED]: [VendorCandidateStatus.QUOTED, VendorCandidateStatus.REJECTED, VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.QUOTED]: [VendorCandidateStatus.SELECTED, VendorCandidateStatus.REJECTED, VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.SELECTED]: [VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.REJECTED]: [VendorCandidateStatus.ARCHIVED],
	[VendorCandidateStatus.ARCHIVED]: []
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
// Fuzzy Matching Utilities for Duplicate Detection
// =============================================================================

/**
 * Normalize a string for comparison:
 * - Lowercase
 * - Remove common business suffixes (LLC, Inc, Corp, etc.)
 * - Remove special characters
 * - Collapse whitespace
 */
function normalizeVendorName(name: string): string {
	return name
		.toLowerCase()
		.replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp|plc|pllc|pc)\b/gi, '')
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Normalize a phone number for comparison (digits only)
 */
function normalizePhone(phone: string | null | undefined): string | null {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, '');
	// Return last 10 digits (strip country code if present)
	return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Normalize email for comparison (lowercase, trim)
 */
function normalizeEmail(email: string | null | undefined): string | null {
	if (!email) return null;
	return email.toLowerCase().trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	// Initialize first column
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}

	// Initialize first row
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	// Fill in the rest of the matrix
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b[i - 1] === a[j - 1]) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function stringSimilarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length === 0 || b.length === 0) return 0;

	const distance = levenshteinDistance(a, b);
	const maxLength = Math.max(a.length, b.length);
	return 1 - distance / maxLength;
}

/**
 * Calculate token-based similarity (Jaccard index of word tokens)
 */
function tokenSimilarity(a: string, b: string): number {
	const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 1));
	const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 1));

	if (tokensA.size === 0 || tokensB.size === 0) return 0;

	const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
	const union = new Set([...tokensA, ...tokensB]);

	return intersection.size / union.size;
}

/**
 * Calculate overall similarity score between two vendor names
 * Returns a score from 0-1
 */
function calculateVendorSimilarity(
	newVendor: { name: string; email?: string | null; phone?: string | null },
	existingVendor: { name: string; email?: string | null; phone?: string | null }
): { score: number; reasons: string[] } {
	const reasons: string[] = [];
	let score = 0;

	// Normalize names
	const normalizedNew = normalizeVendorName(newVendor.name);
	const normalizedExisting = normalizeVendorName(existingVendor.name);

	// Exact match (after normalization)
	if (normalizedNew === normalizedExisting) {
		score = 0.95;
		reasons.push('Exact name match (normalized)');
	} else {
		// String similarity (Levenshtein-based)
		const stringSim = stringSimilarity(normalizedNew, normalizedExisting);
		// Token similarity (word overlap)
		const tokenSim = tokenSimilarity(normalizedNew, normalizedExisting);

		// Combined score (weighted average)
		const nameSim = stringSim * 0.6 + tokenSim * 0.4;
		score = nameSim;

		if (stringSim > 0.7) {
			reasons.push(`High string similarity (${Math.round(stringSim * 100)}%)`);
		}
		if (tokenSim > 0.5) {
			reasons.push(`Common words in name (${Math.round(tokenSim * 100)}%)`);
		}
	}

	// Email match (boost score significantly)
	const normalizedNewEmail = normalizeEmail(newVendor.email);
	const normalizedExistingEmail = normalizeEmail(existingVendor.email);
	if (normalizedNewEmail && normalizedExistingEmail && normalizedNewEmail === normalizedExistingEmail) {
		score = Math.max(score, 0.9);
		score = Math.min(score + 0.3, 1);
		reasons.push('Matching email address');
	}

	// Phone match (boost score significantly)
	const normalizedNewPhone = normalizePhone(newVendor.phone);
	const normalizedExistingPhone = normalizePhone(existingVendor.phone);
	if (normalizedNewPhone && normalizedExistingPhone && normalizedNewPhone === normalizedExistingPhone) {
		score = Math.max(score, 0.85);
		score = Math.min(score + 0.25, 1);
		reasons.push('Matching phone number');
	}

	return { score, reasons };
}

interface DuplicateMatch {
	vendorCandidateId: string;
	vendorName: string;
	caseId: string;
	caseSummary: string | null;
	status: string;
	similarityScore: number;
	matchReasons: string[];
	email: string | null;
	phone: string | null;
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
					action: VendorCandidateWorkflowAction.CREATE,
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
			const vendorCandidate = await prisma.vendorCandidate.findFirstOrThrow({
				where: { id: result.vendorCandidateId, organizationId: context.organization.id }
			});

			// Record activity event
			await recordIntent(context, {
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: vendorCandidate.id,
				action: VendorCandidateWorkflowAction.CREATE,
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
					...(input.status && { status: input.status as VendorCandidateStatusType })
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
					action: VendorCandidateWorkflowAction.UPDATE,
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
			const vendorCandidate = await prisma.vendorCandidate.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			await recordExecution(context, {
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: vendorCandidate.id,
				action: VendorCandidateWorkflowAction.UPDATE,
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
					action: VendorCandidateWorkflowAction.UPDATE_STATUS,
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
			const vendorCandidate = await prisma.vendorCandidate.findFirstOrThrow({
				where: { id: input.id, organizationId: context.organization.id }
			});

			await recordExecution(context, {
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: vendorCandidate.id,
				action: ActivityActionType.STATUS_CHANGE,
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
					action: VendorCandidateWorkflowAction.DELETE,
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
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: existing.id,
				action: VendorCandidateWorkflowAction.DELETE,
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
		}),

	/**
	 * Annotate/correct a specific field on a vendor candidate
	 * Records the original value and the correction for audit purposes
	 */
	annotateField: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				fieldName: z.enum([
					'vendorName',
					'vendorContactName',
					'vendorContactEmail',
					'vendorContactPhone',
					'vendorAddress',
					'vendorWebsite',
					'coverageArea'
				]),
				newValue: z.string(),
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
			BAD_REQUEST: { message: 'Invalid field' }
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

			// Get the old value
			const oldValue = (existing as any)[input.fieldName];

			// Build the update data
			const updateData: Record<string, any> = {
				[input.fieldName]: input.newValue
			};

			// Store annotation in extractionMetadata
			const currentMetadata = (existing.extractionMetadata as Record<string, any>) || {};
			const fieldAnnotations = currentMetadata.fieldAnnotations || {};
			fieldAnnotations[input.fieldName] = {
				originalValue: oldValue,
				annotatedValue: input.newValue,
				annotatedAt: new Date().toISOString(),
				annotatedBy: context.user?.id,
				reason: input.reason
			};
			updateData.extractionMetadata = {
				...currentMetadata,
				fieldAnnotations
			};

			// Update the vendor candidate
			const vendorCandidate = await prisma.vendorCandidate.update({
				where: { id: input.id },
				data: updateData
			});

			await recordExecution(context, {
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: vendorCandidate.id,
				action: ActivityActionType.UPDATE,
				summary: `Field ${input.fieldName} annotated: "${oldValue || '(empty)'}" → "${input.newValue}"${input.reason ? ` (${input.reason})` : ''}`,
				caseId: existing.caseId,
				previousState: { [input.fieldName]: oldValue },
				newState: { [input.fieldName]: input.newValue },
				metadata: {
					authoritySource: {
						type: 'MANUAL' as const,
						description: input.reason || 'Manual field correction'
					}
				}
			});

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * Remove/clear a specific field from a vendor candidate
	 * Useful for removing incorrectly extracted data
	 */
	removeField: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				fieldName: z.enum([
					'vendorContactName',
					'vendorContactEmail',
					'vendorContactPhone',
					'vendorAddress',
					'vendorWebsite',
					'coverageArea'
				]),
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

			// Get the old value
			const oldValue = (existing as any)[input.fieldName];

			// Build the update data
			const updateData: Record<string, any> = {
				[input.fieldName]: null
			};

			// Store removal in extractionMetadata
			const currentMetadata = (existing.extractionMetadata as Record<string, any>) || {};
			const fieldRemovals = currentMetadata.fieldRemovals || [];
			fieldRemovals.push({
				fieldName: input.fieldName,
				removedValue: oldValue,
				removedAt: new Date().toISOString(),
				removedBy: context.user?.id,
				reason: input.reason
			});
			updateData.extractionMetadata = {
				...currentMetadata,
				fieldRemovals
			};

			// Update the vendor candidate
			const vendorCandidate = await prisma.vendorCandidate.update({
				where: { id: input.id },
				data: updateData
			});

			await recordExecution(context, {
				entityType: ActivityEntityType.VENDOR_CANDIDATE,
				entityId: vendorCandidate.id,
				action: ActivityActionType.UPDATE,
				summary: `Field ${input.fieldName} removed: "${oldValue || '(empty)'}"${input.reason ? ` (${input.reason})` : ''}`,
				caseId: existing.caseId,
				previousState: { [input.fieldName]: oldValue },
				newState: { [input.fieldName]: null },
				metadata: {
					authoritySource: {
						type: 'MANUAL' as const,
						description: input.reason || 'Manual field removal'
					}
				}
			});

			return successResponse(
				{ vendorCandidate: serializeVendorCandidate(vendorCandidate) },
				context
			);
		}),

	/**
	 * Check for potential duplicate vendors before creating
	 * Uses fuzzy matching on name, email, and phone
	 */
	checkDuplicates: orgProcedure
		.input(
			z.object({
				vendorName: z.string().min(1),
				vendorEmail: z.string().email().optional(),
				vendorPhone: z.string().optional(),
				excludeCaseId: z.string().optional(), // Optionally exclude vendors from a specific case
				threshold: z.number().min(0).max(1).default(0.5) // Minimum similarity to be considered a match
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					potentialDuplicates: z.array(
						z.object({
							vendorCandidateId: z.string(),
							vendorName: z.string(),
							caseId: z.string(),
							caseSummary: z.string().nullable(),
							status: z.string(),
							similarityScore: z.number(),
							matchReasons: z.array(z.string()),
							email: z.string().nullable(),
							phone: z.string().nullable()
						})
					),
					hasHighConfidenceMatch: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'vendor_candidate', 'list');

			// Fetch all non-archived vendor candidates in the organization
			const existingVendors = await prisma.vendorCandidate.findMany({
				where: {
					organizationId: context.organization.id,
					deletedAt: null,
					status: {
						not: VendorCandidateStatus.ARCHIVED
					},
					...(input.excludeCaseId && { caseId: { not: input.excludeCaseId } })
				},
				include: {
					case: {
						select: {
							id: true,
							title: true
						}
					}
				}
			});

			// Calculate similarity for each existing vendor
			const matches: DuplicateMatch[] = [];
			const newVendor = {
				name: input.vendorName,
				email: input.vendorEmail,
				phone: input.vendorPhone
			};

			for (const vendor of existingVendors) {
				const existingVendor = {
					name: vendor.vendorName,
					email: vendor.vendorContactEmail,
					phone: vendor.vendorContactPhone
				};

				const { score, reasons } = calculateVendorSimilarity(newVendor, existingVendor);

				if (score >= input.threshold) {
					matches.push({
						vendorCandidateId: vendor.id,
						vendorName: vendor.vendorName,
						caseId: vendor.caseId,
						caseSummary: vendor.case?.title ?? null,
						status: vendor.status,
						similarityScore: Math.round(score * 100) / 100,
						matchReasons: reasons,
						email: vendor.vendorContactEmail,
						phone: vendor.vendorContactPhone
					});
				}
			}

			// Sort by similarity score (highest first)
			matches.sort((a, b) => b.similarityScore - a.similarityScore);

			// Limit to top 10 matches
			const topMatches = matches.slice(0, 10);

			// Check if there's a high confidence match (>= 0.8)
			const hasHighConfidenceMatch = topMatches.some(m => m.similarityScore >= 0.8);

			return successResponse(
				{
					potentialDuplicates: topMatches,
					hasHighConfidenceMatch
				},
				context
			);
		})
};
