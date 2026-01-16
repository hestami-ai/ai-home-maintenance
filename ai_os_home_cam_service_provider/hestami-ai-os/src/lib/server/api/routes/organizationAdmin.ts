/**
 * Phase 37: Organization Admin Routes
 *
 * Provides cross-org organization management for Hestami staff in the Staff Portal.
 * Uses SECURITY DEFINER functions to bypass RLS for staff access.
 *
 * Authorization via Cerbos with hestami_staff and hestami_platform_admin roles.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	authedProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../router.js';
import { prisma } from '../../db.js';
import { createModuleLogger } from '../../logger.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';
import {
	OrganizationTypeSchema,
	OrganizationStatusSchema
} from '../../../../../generated/zod/index.js';

const log = createModuleLogger('OrganizationAdminRoute');

// =============================================================================
// Schemas
// =============================================================================

const OrganizationListItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	type: OrganizationTypeSchema,
	status: OrganizationStatusSchema,
	externalContactName: z.string().nullable(),
	externalContactEmail: z.string().nullable(),
	externalContactPhone: z.string().nullable(),
	memberCount: z.number(),
	activeCaseCount: z.number(),
	propertyCount: z.number(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const OrganizationDetailSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	type: OrganizationTypeSchema,
	status: OrganizationStatusSchema,
	settings: z.record(z.string(), z.unknown()).nullable(),
	externalContactName: z.string().nullable(),
	externalContactEmail: z.string().nullable(),
	externalContactPhone: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	// Stats
	memberCount: z.number(),
	activeCaseCount: z.number(),
	totalCaseCount: z.number(),
	propertyCount: z.number(),
	associationCount: z.number(),
	workOrderCount: z.number(),
	// Type-specific (SERVICE_PROVIDER)
	contractorProfile: z
		.object({
			id: z.string(),
			legalName: z.string().nullable(),
			isActive: z.boolean()
		})
		.nullable()
});

const OrganizationMemberSchema = z.object({
	id: z.string(),
	userId: z.string(),
	userEmail: z.string(),
	userName: z.string().nullable(),
	role: z.string(),
	isDefault: z.boolean(),
	joinedAt: z.string()
});

const OrganizationSummarySchema = z.object({
	total: z.number(),
	byStatus: z.object({
		active: z.number(),
		suspended: z.number(),
		inactive: z.number()
	}),
	byType: z.object({
		communityAssociation: z.number(),
		managementCompany: z.number(),
		serviceProvider: z.number(),
		individualPropertyOwner: z.number(),
		trustOrLlc: z.number(),
		commercialClient: z.number(),
		externalServiceProvider: z.number(),
		platformOperator: z.number()
	})
});

// =============================================================================
// Router
// =============================================================================

export const organizationAdminRouter = {
	/**
	 * List all organizations with filtering and pagination
	 */
	list: authedProcedure
		.input(
			PaginationInputSchema.extend({
				type: OrganizationTypeSchema.optional(),
				status: OrganizationStatusSchema.optional(),
				search: z.string().max(100).optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organizations: z.array(OrganizationListItemSchema),
					summary: OrganizationSummarySchema,
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify staff role
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('organization_admin', 'list', 'global');
			try {
				await requireAuthorization(principal, resource, 'list');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const limit = input?.limit ?? 50;

			// Use SECURITY DEFINER function
			interface OrgRow {
				id: string;
				name: string;
				slug: string;
				type: string;
				status: string;
				external_contact_name: string | null;
				external_contact_email: string | null;
				external_contact_phone: string | null;
				member_count: bigint;
				active_case_count: bigint;
				property_count: bigint;
				created_at: Date;
				updated_at: Date;
			}

			let rows: OrgRow[];
			try {
				rows = await prisma.$queryRaw<OrgRow[]>`
					SELECT * FROM get_all_organizations_for_staff(
						${input?.type ?? null},
						${input?.status ?? null},
						${input?.search ?? null},
						${limit + 1},
						${input?.cursor ?? null}
					)
				`;
			} catch (dbError) {
				log.error('Organization list database error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to fetch organizations'
				});
			}

			const hasMore = rows.length > limit;
			const items = hasMore ? rows.slice(0, -1) : rows;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			// Get summary counts using SECURITY DEFINER function
			interface SummaryRow {
				total_count: bigint;
				active_count: bigint;
				suspended_count: bigint;
				inactive_count: bigint;
				community_association_count: bigint;
				management_company_count: bigint;
				service_provider_count: bigint;
				individual_property_owner_count: bigint;
				trust_or_llc_count: bigint;
				commercial_client_count: bigint;
				external_service_provider_count: bigint;
				platform_operator_count: bigint;
			}

			let summaryRow: SummaryRow | undefined;
			try {
				const summaryRows = await prisma.$queryRaw<SummaryRow[]>`
					SELECT * FROM get_organization_summary_for_staff()
				`;
				summaryRow = summaryRows[0];
			} catch (dbError) {
				log.error('Organization summary database error', { error: dbError });
				// Non-fatal - continue without summary
			}

			const summary = {
				total: Number(summaryRow?.total_count ?? 0),
				byStatus: {
					active: Number(summaryRow?.active_count ?? 0),
					suspended: Number(summaryRow?.suspended_count ?? 0),
					inactive: Number(summaryRow?.inactive_count ?? 0)
				},
				byType: {
					communityAssociation: Number(summaryRow?.community_association_count ?? 0),
					managementCompany: Number(summaryRow?.management_company_count ?? 0),
					serviceProvider: Number(summaryRow?.service_provider_count ?? 0),
					individualPropertyOwner: Number(summaryRow?.individual_property_owner_count ?? 0),
					trustOrLlc: Number(summaryRow?.trust_or_llc_count ?? 0),
					commercialClient: Number(summaryRow?.commercial_client_count ?? 0),
					externalServiceProvider: Number(summaryRow?.external_service_provider_count ?? 0),
					platformOperator: Number(summaryRow?.platform_operator_count ?? 0)
				}
			};

			return successResponse(
				{
					organizations: items.map((row) => ({
						id: row.id,
						name: row.name,
						slug: row.slug,
						type: row.type as z.infer<typeof OrganizationTypeSchema>,
						status: row.status as z.infer<typeof OrganizationStatusSchema>,
						externalContactName: row.external_contact_name,
						externalContactEmail: row.external_contact_email,
						externalContactPhone: row.external_contact_phone,
						memberCount: Number(row.member_count),
						activeCaseCount: Number(row.active_case_count),
						propertyCount: Number(row.property_count),
						createdAt: row.created_at.toISOString(),
						updatedAt: row.updated_at.toISOString()
					})),
					summary,
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get single organization details
	 */
	get: authedProcedure
		.input(z.object({ organizationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					organization: OrganizationDetailSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			NOT_FOUND: { message: 'Organization not found' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('organization_admin', input.organizationId, 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			interface DetailRow {
				id: string;
				name: string;
				slug: string;
				type: string;
				status: string;
				settings: Record<string, unknown> | null;
				external_contact_name: string | null;
				external_contact_email: string | null;
				external_contact_phone: string | null;
				created_at: Date;
				updated_at: Date;
				member_count: bigint;
				active_case_count: bigint;
				total_case_count: bigint;
				property_count: bigint;
				association_count: bigint;
				work_order_count: bigint;
				contractor_profile_id: string | null;
				contractor_legal_name: string | null;
				contractor_is_active: boolean | null;
			}

			let rows: DetailRow[];
			try {
				rows = await prisma.$queryRaw<DetailRow[]>`
					SELECT * FROM get_organization_details_for_staff(${input.organizationId})
				`;
			} catch (dbError) {
				log.error('Organization detail database error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to fetch organization'
				});
			}

			if (rows.length === 0) {
				throw errors.NOT_FOUND({ message: 'Organization not found' });
			}

			const row = rows[0];

			return successResponse(
				{
					organization: {
						id: row.id,
						name: row.name,
						slug: row.slug,
						type: row.type as z.infer<typeof OrganizationTypeSchema>,
						status: row.status as z.infer<typeof OrganizationStatusSchema>,
						settings: row.settings,
						externalContactName: row.external_contact_name,
						externalContactEmail: row.external_contact_email,
						externalContactPhone: row.external_contact_phone,
						createdAt: row.created_at.toISOString(),
						updatedAt: row.updated_at.toISOString(),
						memberCount: Number(row.member_count),
						activeCaseCount: Number(row.active_case_count),
						totalCaseCount: Number(row.total_case_count),
						propertyCount: Number(row.property_count),
						associationCount: Number(row.association_count),
						workOrderCount: Number(row.work_order_count),
						contractorProfile: row.contractor_profile_id
							? {
									id: row.contractor_profile_id,
									legalName: row.contractor_legal_name,
									isActive: row.contractor_is_active ?? false
								}
							: null
					}
				},
				context
			);
		}),

	/**
	 * Get organization members
	 */
	getMembers: authedProcedure
		.input(
			z.object({
				organizationId: z.string(),
				limit: z.number().int().min(1).max(100).default(50),
				cursor: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					members: z.array(OrganizationMemberSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
		.handler(async ({ input, context, errors }) => {
			// Authorization
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('organization_admin', input.organizationId, 'global');
			try {
				await requireAuthorization(principal, resource, 'view_members');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			interface MemberRow {
				id: string;
				user_id: string;
				user_email: string;
				user_name: string | null;
				role: string;
				is_default: boolean;
				joined_at: Date;
			}

			let rows: MemberRow[];
			try {
				rows = await prisma.$queryRaw<MemberRow[]>`
					SELECT * FROM get_organization_members_for_staff(
						${input.organizationId},
						${input.limit + 1},
						${input.cursor ?? null}
					)
				`;
			} catch (dbError) {
				log.error('Organization members database error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to fetch members'
				});
			}

			const hasMore = rows.length > input.limit;
			const items = hasMore ? rows.slice(0, -1) : rows;
			const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

			return successResponse(
				{
					members: items.map((row) => ({
						id: row.id,
						userId: row.user_id,
						userEmail: row.user_email,
						userName: row.user_name,
						role: row.role,
						isDefault: row.is_default,
						joinedAt: row.joined_at.toISOString()
					})),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Update organization status (suspend/activate)
	 * Platform Admin only
	 */
	updateStatus: authedProcedure
		.input(
			z.object({
				organizationId: z.string(),
				status: OrganizationStatusSchema,
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					previousStatus: z.string(),
					newStatus: z.string(),
					updatedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Platform admin access required' },
			NOT_FOUND: { message: 'Organization not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update status' }
		})
		.handler(async ({ input, context, errors }) => {
			// Authorization - platform admin only
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('organization_admin', input.organizationId, 'global');
			try {
				await requireAuthorization(principal, resource, 'update_status');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Platform admin access required'
				});
			}

			interface ResultRow {
				success: boolean;
				previous_status: string | null;
				new_status: string | null;
				updated_at: Date | null;
			}

			let rows: ResultRow[];
			try {
				rows = await prisma.$queryRaw<ResultRow[]>`
					SELECT * FROM update_organization_status_for_staff(
						${input.organizationId},
						${input.status},
						${input.reason},
						${context.user!.id}
					)
				`;
			} catch (dbError) {
				log.error('Organization status update error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to update status'
				});
			}

			if (!rows[0]?.success) {
				throw errors.NOT_FOUND({ message: 'Organization not found' });
			}

			const result = rows[0];
			return successResponse(
				{
					previousStatus: result.previous_status!,
					newStatus: result.new_status!,
					updatedAt: result.updated_at!.toISOString()
				},
				context
			);
		}),

	/**
	 * Update organization info (name, contact)
	 * Platform Admin only
	 */
	update: authedProcedure
		.input(
			z.object({
				organizationId: z.string(),
				name: z.string().min(1).max(255).optional(),
				externalContactName: z.string().max(255).nullable().optional(),
				externalContactEmail: z.string().email().nullable().optional(),
				externalContactPhone: z.string().max(50).nullable().optional(),
				idempotencyKey: z.string().uuid()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					id: z.string(),
					name: z.string(),
					externalContactName: z.string().nullable(),
					externalContactEmail: z.string().nullable(),
					externalContactPhone: z.string().nullable(),
					updatedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Platform admin access required' },
			NOT_FOUND: { message: 'Organization not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update organization' }
		})
		.handler(async ({ input, context, errors }) => {
			// Authorization
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('organization_admin', input.organizationId, 'global');
			try {
				await requireAuthorization(principal, resource, 'edit');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Platform admin access required'
				});
			}

			interface ResultRow {
				success: boolean;
				id: string | null;
				name: string | null;
				external_contact_name: string | null;
				external_contact_email: string | null;
				external_contact_phone: string | null;
				updated_at: Date | null;
			}

			let rows: ResultRow[];
			try {
				rows = await prisma.$queryRaw<ResultRow[]>`
					SELECT * FROM update_organization_info_for_staff(
						${input.organizationId},
						${input.name ?? null},
						${input.externalContactName ?? null},
						${input.externalContactEmail ?? null},
						${input.externalContactPhone ?? null},
						${context.user!.id}
					)
				`;
			} catch (dbError) {
				log.error('Organization update error', { error: dbError });
				throw errors.INTERNAL_SERVER_ERROR({
					message: dbError instanceof Error ? dbError.message : 'Failed to update organization'
				});
			}

			if (!rows[0]?.success) {
				throw errors.NOT_FOUND({ message: 'Organization not found' });
			}

			const result = rows[0];
			return successResponse(
				{
					id: result.id!,
					name: result.name!,
					externalContactName: result.external_contact_name,
					externalContactEmail: result.external_contact_email,
					externalContactPhone: result.external_contact_phone,
					updatedAt: result.updated_at!.toISOString()
				},
				context
			);
		})
};
