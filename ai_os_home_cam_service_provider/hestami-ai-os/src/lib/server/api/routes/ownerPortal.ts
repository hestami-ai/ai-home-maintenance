import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { orgProcedure, successResponse } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';

import { PaginationInputSchema, PaginationOutputSchema, IdempotencyKeySchema } from '../router.js';
import { startOwnerPortalWorkflow } from '../../workflows/ownerPortalWorkflow.js';
import type { RequestContext } from '../context.js';

const ContactPreferenceChannelEnum = z.enum(['EMAIL', 'SMS', 'PUSH', 'MAIL', 'PORTAL']);
const NotificationCategoryEnum = z.enum([
	'GENERAL',
	'BILLING',
	'MAINTENANCE',
	'GOVERNANCE',
	'ARC',
	'VIOLATION',
	'COMMUNICATION'
]);

const OwnerRequestStatusEnum = z.enum([
	'DRAFT',
	'SUBMITTED',
	'IN_PROGRESS',
	'RESOLVED',
	'CLOSED',
	'CANCELLED'
]);

const OwnerRequestCategoryEnum = z.enum([
	'GENERAL_INQUIRY',
	'MAINTENANCE',
	'BILLING',
	'ARCHITECTURAL',
	'VIOLATION',
	'GOVERNANCE',
	'AMENITY',
	'OTHER'
]);

const JsonRecord = z.record(z.string(), z.any());


const ensureParty = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({
		where: { id: partyId, organizationId, deletedAt: null }
	});
	if (!party) throw ApiException.notFound('Party');
	return party;
};

export const ownerPortalRouter = {
	upsertUserProfile: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				preferredName: z.string().max(255).optional(),
				profilePhotoUrl: z.string().url().optional(),
				language: z.string().max(10).optional(),
				timezone: z.string().max(100).optional(),
				mailingAddress: JsonRecord.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					profile: z.object({
						id: z.string(),
						partyId: z.string(),
						preferredName: z.string().nullable(),
						profilePhotoUrl: z.string().nullable(),
						language: z.string(),
						timezone: z.string(),
						mailingAddress: JsonRecord.nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('update', 'userProfile', input.partyId);

			const { mailingAddress, partyId, ...rest } = input;
			const profile = await prisma.userProfile.upsert({
				where: { partyId },
				create: {
					partyId,
					...rest,
					...(mailingAddress !== undefined && {
						mailingAddress: mailingAddress as Prisma.InputJsonValue
					})
				},
				update: {
					...rest,
					...(mailingAddress !== undefined && {
						mailingAddress: mailingAddress as Prisma.InputJsonValue
					})
				}
			});

			return successResponse(
				{
					profile: {
						id: profile.id,
						partyId: profile.partyId,
						preferredName: profile.preferredName ?? null,
						profilePhotoUrl: profile.profilePhotoUrl ?? null,
						language: profile.language,
						timezone: profile.timezone,
						mailingAddress: (profile.mailingAddress as Record<string, unknown> | null) ?? null
					}
				},
				context
			);
		}),

	getUserProfile: orgProcedure
		.input(z.object({ partyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					profile: z.object({
						id: z.string(),
						partyId: z.string(),
						preferredName: z.string().nullable(),
						profilePhotoUrl: z.string().nullable(),
						language: z.string(),
						timezone: z.string(),
						mailingAddress: JsonRecord.nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('view', 'userProfile', input.partyId);

			const profile = await prisma.userProfile.findFirst({
				where: { partyId: input.partyId, deletedAt: null }
			});

			if (!profile) throw ApiException.notFound('UserProfile');

			return successResponse(
				{
					profile: {
						id: profile.id,
						partyId: profile.partyId,
						preferredName: profile.preferredName ?? null,
						profilePhotoUrl: profile.profilePhotoUrl ?? null,
						language: profile.language,
						timezone: profile.timezone,
						mailingAddress: (profile.mailingAddress as Record<string, unknown> | null) ?? null
					}
				},
				context
			);
		}),

	deleteUserProfile: orgProcedure
		.input(z.object({ partyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('delete', 'userProfile', input.partyId);

			const now = new Date();
			const updated = await prisma.userProfile.updateMany({
				where: { partyId: input.partyId, deletedAt: null },
				data: { deletedAt: now }
			});

			if (updated.count === 0) throw ApiException.notFound('UserProfile');

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	upsertContactPreference: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				channel: ContactPreferenceChannelEnum,
				isEnabled: z.boolean().default(true),
				allowTransactional: z.boolean().default(true),
				allowMarketing: z.boolean().default(false),
				allowEmergency: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					preference: z.object({
						id: z.string(),
						partyId: z.string(),
						channel: ContactPreferenceChannelEnum,
						isEnabled: z.boolean(),
						allowTransactional: z.boolean(),
						allowMarketing: z.boolean(),
						allowEmergency: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('update', 'contactPreference', input.partyId);

			const preference = await prisma.contactPreference.upsert({
				where: { partyId_channel: { partyId: input.partyId, channel: input.channel } },
				create: input,
				update: {
					isEnabled: input.isEnabled,
					allowTransactional: input.allowTransactional,
					allowMarketing: input.allowMarketing,
					allowEmergency: input.allowEmergency
				}
			});

			return successResponse(
				{
					preference: {
						id: preference.id,
						partyId: preference.partyId,
						channel: preference.channel,
						isEnabled: preference.isEnabled,
						allowTransactional: preference.allowTransactional,
						allowMarketing: preference.allowMarketing,
						allowEmergency: preference.allowEmergency
					}
				},
				context
			);
		}),

	listContactPreferences: orgProcedure
		.input(z.object({ partyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					preferences: z.array(
						z.object({
							id: z.string(),
							channel: ContactPreferenceChannelEnum,
							isEnabled: z.boolean(),
							allowTransactional: z.boolean(),
							allowMarketing: z.boolean(),
							allowEmergency: z.boolean(),
							createdAt: z.string(),
							updatedAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('view', 'contactPreference', input.partyId);

			const preferences = await prisma.contactPreference.findMany({
				where: { partyId: input.partyId, deletedAt: null }
			});

			return successResponse(
				{
					preferences: preferences.map((p) => ({
						id: p.id,
						channel: p.channel,
						isEnabled: p.isEnabled,
						allowTransactional: p.allowTransactional,
						allowMarketing: p.allowMarketing,
						allowEmergency: p.allowEmergency,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt.toISOString()
					}))
				},
				context
			);
		}),

	deleteContactPreference: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				channel: ContactPreferenceChannelEnum
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('delete', 'contactPreference', input.partyId);

			const now = new Date();
			const result = await prisma.contactPreference.updateMany({
				where: {
					partyId: input.partyId,
					channel: input.channel,
					deletedAt: null
				},
				data: { deletedAt: now }
			});

			if (result.count === 0) throw ApiException.notFound('ContactPreference');

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	upsertNotificationSetting: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				category: NotificationCategoryEnum,
				channel: ContactPreferenceChannelEnum,
				isEnabled: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					setting: z.object({
						id: z.string(),
						partyId: z.string(),
						category: NotificationCategoryEnum,
						channel: ContactPreferenceChannelEnum,
						isEnabled: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('update', 'notificationSetting', input.partyId);

			const setting = await prisma.notificationSetting.upsert({
				where: {
					partyId_category_channel: {
						partyId: input.partyId,
						category: input.category,
						channel: input.channel
					}
				},
				create: input,
				update: { isEnabled: input.isEnabled }
			});

			return successResponse(
				{
					setting: {
						id: setting.id,
						partyId: setting.partyId,
						category: setting.category,
						channel: setting.channel,
						isEnabled: setting.isEnabled
					}
				},
				context
			);
		}),

	listNotificationSettings: orgProcedure
		.input(z.object({ partyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					settings: z.array(
						z.object({
							id: z.string(),
							category: NotificationCategoryEnum,
							channel: ContactPreferenceChannelEnum,
							isEnabled: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('view', 'notificationSetting', input.partyId);

			const settings = await prisma.notificationSetting.findMany({
				where: { partyId: input.partyId, deletedAt: null }
			});

			return successResponse(
				{
					settings: settings.map((s) => ({
						id: s.id,
						category: s.category,
						channel: s.channel,
						isEnabled: s.isEnabled
					}))
				},
				context
			);
		}),

	deleteNotificationSetting: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				category: NotificationCategoryEnum,
				channel: ContactPreferenceChannelEnum
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('delete', 'notificationSetting', input.partyId);

			const now = new Date();
			const result = await prisma.notificationSetting.updateMany({
				where: {
					partyId: input.partyId,
					category: input.category,
					channel: input.channel,
					deletedAt: null
				},
				data: { deletedAt: now }
			});

			if (result.count === 0) throw ApiException.notFound('NotificationSetting');

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	// =========================================================================
	// Owner Request APIs
	// =========================================================================

	createRequest: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				associationId: z.string(),
				unitId: z.string().optional(),
				partyId: z.string(),
				category: OwnerRequestCategoryEnum,
				subject: z.string().max(255),
				description: z.string(),
				attachments: z.array(z.record(z.string(), z.any())).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						requestNumber: z.string(),
						status: OwnerRequestStatusEnum,
						category: OwnerRequestCategoryEnum,
						subject: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('create', 'ownerRequest', 'new');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			if (input.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: input.unitId, deletedAt: null },
					include: { property: true }
				});
				if (!unit || unit.property.associationId !== input.associationId) {
					throw ApiException.notFound('Unit');
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'CREATE_OWNER_REQUEST',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						unitId: input.unitId,
						requesterPartyId: input.partyId,
						category: input.category,
						subject: input.subject,
						description: input.description,
						metadata: input.attachments
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to create owner request');
			}

			const request = await prisma.ownerRequest.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			await prisma.ownerRequestHistory.create({
				data: {
					requestId: request.id,
					action: 'CREATED',
					newStatus: 'DRAFT',
					performedBy: context.user.id
				}
			});

			return successResponse(
				{
					request: {
						id: request.id,
						requestNumber: request.requestNumber,
						status: request.status,
						category: request.category,
						subject: request.subject,
						createdAt: request.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getRequest: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						requestNumber: z.string(),
						status: OwnerRequestStatusEnum,
						category: OwnerRequestCategoryEnum,
						subject: z.string(),
						description: z.string(),
						attachments: z.array(z.record(z.string(), z.any())).nullable(),
						submittedAt: z.string().nullable(),
						resolvedAt: z.string().nullable(),
						closedAt: z.string().nullable(),
						resolutionNotes: z.string().nullable(),
						workOrderId: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					party: z.object({ id: z.string(), displayName: z.string() }),
					unit: z.object({ id: z.string(), unitNumber: z.string() }).nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.ownerRequest.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					association: true,
					party: true,
					unit: true
				}
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('OwnerRequest');
			}

			await context.cerbos.authorize('view', 'ownerRequest', request.id);

			const displayName =
				request.party.partyType === 'INDIVIDUAL'
					? `${request.party.firstName ?? ''} ${request.party.lastName ?? ''}`.trim()
					: request.party.entityName ?? '';

			return successResponse(
				{
					request: {
						id: request.id,
						requestNumber: request.requestNumber,
						status: request.status,
						category: request.category,
						subject: request.subject,
						description: request.description,
						attachments: (request.attachments as Record<string, unknown>[] | null) ?? null,
						submittedAt: request.submittedAt?.toISOString() ?? null,
						resolvedAt: request.resolvedAt?.toISOString() ?? null,
						closedAt: request.closedAt?.toISOString() ?? null,
						resolutionNotes: request.resolutionNotes ?? null,
						workOrderId: request.workOrderId ?? null,
						createdAt: request.createdAt.toISOString(),
						updatedAt: request.updatedAt.toISOString()
					},
					party: { id: request.party.id, displayName },
					unit: request.unit
						? { id: request.unit.id, unitNumber: request.unit.unitNumber }
						: null
				},
				context
			);
		}),

	listRequests: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				partyId: z.string().optional(),
				status: OwnerRequestStatusEnum.optional(),
				category: OwnerRequestCategoryEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requests: z.array(
						z.object({
							id: z.string(),
							requestNumber: z.string(),
							status: OwnerRequestStatusEnum,
							category: OwnerRequestCategoryEnum,
							subject: z.string(),
							partyName: z.string(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'ownerRequest', 'list');

			const requests = await prisma.ownerRequest.findMany({
				where: {
					deletedAt: null,
					association: { organizationId: context.organization.id, deletedAt: null },
					...(input.associationId && { associationId: input.associationId }),
					...(input.partyId && { partyId: input.partyId }),
					...(input.status && { status: input.status }),
					...(input.category && { category: input.category })
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' },
				include: { party: true }
			});

			const hasMore = requests.length > input.limit;
			const items = hasMore ? requests.slice(0, -1) : requests;

			return successResponse(
				{
					requests: items.map((r) => ({
						id: r.id,
						requestNumber: r.requestNumber,
						status: r.status,
						category: r.category,
						subject: r.subject,
						partyName:
							r.party.partyType === 'INDIVIDUAL'
								? `${r.party.firstName ?? ''} ${r.party.lastName ?? ''}`.trim()
								: r.party.entityName ?? '',
						createdAt: r.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	submitRequest: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						status: OwnerRequestStatusEnum,
						submittedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.ownerRequest.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('OwnerRequest');
			}

			if (request.status !== 'DRAFT') {
				throw ApiException.badRequest('Request must be in DRAFT status to submit');
			}

			await context.cerbos.authorize('submit', 'ownerRequest', request.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'SUBMIT_OWNER_REQUEST',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to submit owner request');
			}

			const updated = await prisma.ownerRequest.findUniqueOrThrow({ where: { id: input.id } });

			await prisma.ownerRequestHistory.create({
				data: {
					requestId: request.id,
					action: 'SUBMITTED',
					previousStatus: 'DRAFT',
					newStatus: 'SUBMITTED',
					performedBy: context.user.id
				}
			});

			return successResponse(
				{
					request: {
						id: updated.id,
						status: updated.status,
						submittedAt: updated.submittedAt!.toISOString()
					}
				},
				context
			);
		}),

	updateRequestStatus: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				status: OwnerRequestStatusEnum,
				resolutionNotes: z.string().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						status: OwnerRequestStatusEnum,
						resolvedAt: z.string().nullable(),
						closedAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.ownerRequest.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('OwnerRequest');
			}

			await context.cerbos.authorize('update', 'ownerRequest', request.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'UPDATE_REQUEST_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.id,
					data: {
						status: input.status,
						resolution: input.resolutionNotes
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to update request status');
			}

			const updated = await prisma.ownerRequest.findUniqueOrThrow({ where: { id: input.id } });

			await prisma.ownerRequestHistory.create({
				data: {
					requestId: request.id,
					action: input.status,
					previousStatus: request.status,
					newStatus: input.status,
					notes: input.notes,
					performedBy: context.user.id
				}
			});

			return successResponse(
				{
					request: {
						id: updated.id,
						status: updated.status,
						resolvedAt: updated.resolvedAt?.toISOString() ?? null,
						closedAt: updated.closedAt?.toISOString() ?? null
					}
				},
				context
			);
		}),

	convertToWorkOrder: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				workOrderId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						workOrderId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.ownerRequest.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('OwnerRequest');
			}

			await context.cerbos.authorize('update', 'ownerRequest', request.id);

			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId },
				include: { association: true }
			});

			if (!workOrder || workOrder.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('WorkOrder');
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'LINK_WORK_ORDER',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.id,
					data: {
						workOrderId: input.workOrderId
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to link work order');
			}

			const updated = await prisma.ownerRequest.findUniqueOrThrow({ where: { id: input.id } });

			await prisma.ownerRequestHistory.create({
				data: {
					requestId: request.id,
					action: 'LINKED_TO_WORK_ORDER',
					notes: `Linked to work order ${workOrder.workOrderNumber}`,
					performedBy: context.user.id
				}
			});

			return successResponse(
				{
					request: {
						id: updated.id,
						workOrderId: updated.workOrderId!
					}
				},
				context
			);
		}),

	getRequestHistory: orgProcedure
		.input(z.object({ requestId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					history: z.array(
						z.object({
							id: z.string(),
							action: z.string(),
							previousStatus: z.string().nullable(),
							newStatus: z.string().nullable(),
							notes: z.string().nullable(),
							performedBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.ownerRequest.findFirst({
				where: { id: input.requestId, deletedAt: null },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('OwnerRequest');
			}

			await context.cerbos.authorize('view', 'ownerRequest', request.id);

			const history = await prisma.ownerRequestHistory.findMany({
				where: { requestId: input.requestId },
				orderBy: { createdAt: 'desc' }
			});

			return successResponse(
				{
					history: history.map((h) => ({
						id: h.id,
						action: h.action,
						previousStatus: h.previousStatus ?? null,
						newStatus: h.newStatus ?? null,
						notes: h.notes ?? null,
						performedBy: h.performedBy,
						createdAt: h.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	// =========================================================================
	// Payment Preference APIs
	// =========================================================================

	addPaymentMethod: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				partyId: z.string(),
				methodType: z.enum(['BANK_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD']),
				nickname: z.string().max(100).optional(),
				lastFour: z.string().length(4),
				expirationMonth: z.number().int().min(1).max(12).optional(),
				expirationYear: z.number().int().min(2024).optional(),
				bankName: z.string().max(100).optional(),
				processorToken: z.string(),
				processorType: z.string(),
				isDefault: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					paymentMethod: z.object({
						id: z.string(),
						methodType: z.enum(['BANK_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD']),
						nickname: z.string().nullable(),
						lastFour: z.string(),
						isDefault: z.boolean(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('create', 'paymentMethod', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'ADD_PAYMENT_METHOD',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						partyId: input.partyId,
						methodType: input.methodType,
						last4: input.lastFour,
						expirationMonth: input.expirationMonth,
						expirationYear: input.expirationYear,
						bankName: input.bankName,
						providerToken: input.processorToken,
						isDefault: input.isDefault ?? false
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to add payment method');
			}

			const method = await prisma.storedPaymentMethod.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					paymentMethod: {
						id: method.id,
						methodType: method.methodType,
						nickname: method.nickname ?? null,
						lastFour: method.lastFour,
						isDefault: method.isDefault,
						createdAt: method.createdAt.toISOString()
					}
				},
				context
			);
		}),

	listPaymentMethods: orgProcedure
		.input(z.object({ partyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					paymentMethods: z.array(
						z.object({
							id: z.string(),
							methodType: z.enum(['BANK_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD']),
							nickname: z.string().nullable(),
							lastFour: z.string(),
							expirationMonth: z.number().nullable(),
							expirationYear: z.number().nullable(),
							bankName: z.string().nullable(),
							isDefault: z.boolean(),
							isVerified: z.boolean(),
							createdAt: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('view', 'paymentMethod', input.partyId);

			const methods = await prisma.storedPaymentMethod.findMany({
				where: { partyId: input.partyId, deletedAt: null },
				orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
			});

			return successResponse(
				{
					paymentMethods: methods.map((m) => ({
						id: m.id,
						methodType: m.methodType,
						nickname: m.nickname ?? null,
						lastFour: m.lastFour,
						expirationMonth: m.expirationMonth ?? null,
						expirationYear: m.expirationYear ?? null,
						bankName: m.bankName ?? null,
						isDefault: m.isDefault,
						isVerified: m.isVerified,
						createdAt: m.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	setDefaultPaymentMethod: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				partyId: z.string(),
				paymentMethodId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('update', 'paymentMethod', input.paymentMethodId);

			const method = await prisma.storedPaymentMethod.findFirst({
				where: { id: input.paymentMethodId, partyId: input.partyId, deletedAt: null }
			});
			if (!method) throw ApiException.notFound('PaymentMethod');

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'SET_DEFAULT_PAYMENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						partyId: input.partyId,
						methodId: input.paymentMethodId
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to set default payment method');
			}

			return successResponse({ success: true }, context);
		}),

	deletePaymentMethod: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				paymentMethodId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean(), deletedAt: z.string() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('delete', 'paymentMethod', input.paymentMethodId);

			const method = await prisma.storedPaymentMethod.findFirst({
				where: { id: input.paymentMethodId, partyId: input.partyId, deletedAt: null }
			});
			if (!method) throw ApiException.notFound('PaymentMethod');

			const now = new Date();
			await prisma.storedPaymentMethod.update({
				where: { id: input.paymentMethodId },
				data: { deletedAt: now }
			});

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	upsertAutoPay: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				partyId: z.string(),
				paymentMethodId: z.string(),
				isEnabled: z.boolean(),
				frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ON_DUE_DATE']),
				dayOfMonth: z.number().int().min(1).max(28).optional(),
				maxAmount: z.number().positive().optional(),
				associationId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					autoPay: z.object({
						id: z.string(),
						isEnabled: z.boolean(),
						frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ON_DUE_DATE']),
						dayOfMonth: z.number().nullable(),
						maxAmount: z.string().nullable(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('update', 'autoPay', input.partyId);

			const method = await prisma.storedPaymentMethod.findFirst({
				where: { id: input.paymentMethodId, partyId: input.partyId, deletedAt: null }
			});
			if (!method) throw ApiException.notFound('PaymentMethod');

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'CONFIGURE_AUTO_PAY',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						partyId: input.partyId,
						methodId: input.paymentMethodId,
						associationId: input.associationId,
						isEnabled: input.isEnabled,
						maxAmount: input.maxAmount,
						paymentDayOfMonth: input.dayOfMonth
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to configure auto-pay');
			}

			const autoPay = await prisma.autoPaySetting.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					autoPay: {
						id: autoPay.id,
						isEnabled: autoPay.isEnabled,
						frequency: autoPay.frequency,
						dayOfMonth: autoPay.dayOfMonth ?? null,
						maxAmount: autoPay.maxAmount?.toString() ?? null,
						createdAt: autoPay.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getAutoPay: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				associationId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					autoPay: z
						.object({
							id: z.string(),
							paymentMethodId: z.string(),
							isEnabled: z.boolean(),
							frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ON_DUE_DATE']),
							dayOfMonth: z.number().nullable(),
							maxAmount: z.string().nullable(),
							createdAt: z.string()
						})
						.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('view', 'autoPay', input.partyId);

			const autoPay = await prisma.autoPaySetting.findFirst({
				where: {
					partyId: input.partyId,
					associationId: input.associationId ?? null,
					assessmentTypeId: null,
					deletedAt: null
				}
			});

			return successResponse(
				{
					autoPay: autoPay
						? {
								id: autoPay.id,
								paymentMethodId: autoPay.paymentMethodId,
								isEnabled: autoPay.isEnabled,
								frequency: autoPay.frequency,
								dayOfMonth: autoPay.dayOfMonth ?? null,
								maxAmount: autoPay.maxAmount?.toString() ?? null,
								createdAt: autoPay.createdAt.toISOString()
							}
						: null
				},
				context
			);
		}),

	deleteAutoPay: orgProcedure
		.input(
			z.object({
				partyId: z.string(),
				autoPayId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean(), deletedAt: z.string() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await ensureParty(input.partyId, context.organization.id);
			await context.cerbos.authorize('delete', 'autoPay', input.autoPayId);

			const autoPay = await prisma.autoPaySetting.findFirst({
				where: { id: input.autoPayId, partyId: input.partyId, deletedAt: null }
			});
			if (!autoPay) throw ApiException.notFound('AutoPaySetting');

			const now = new Date();
			await prisma.autoPaySetting.update({
				where: { id: input.autoPayId },
				data: { deletedAt: now }
			});

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	// =========================================================================
	// Document Access APIs
	// =========================================================================

	listDocuments: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string(),
				category: z
					.enum([
						'GOVERNING_DOCS',
						'FINANCIAL',
						'MEETING',
						'LEGAL',
						'INSURANCE',
						'MAINTENANCE',
						'ARCHITECTURAL',
						'GENERAL'
					])
					.optional(),
				partyId: z.string().optional() // For visibility filtering
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					documents: z.array(
						z.object({
							id: z.string(),
							title: z.string(),
							description: z.string().nullable(),
							category: z.string(),
							visibility: z.string(),
							fileName: z.string(),
							fileSize: z.number(),
							mimeType: z.string(),
							version: z.number(),
							effectiveDate: z.string().nullable(),
							tags: z.array(z.string()),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'document', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			// Build visibility filter based on party role
			const visibilityFilter: string[] = ['PUBLIC'];
			if (input.partyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.partyId, organizationId: context.organization.id, deletedAt: null }
				});
				if (party) {
					visibilityFilter.push('OWNERS_ONLY');
					// Check if party is an active board member
					const boardMembership = await prisma.boardMember.findFirst({
						where: { partyId: input.partyId, isActive: true }
					});
					if (boardMembership) {
						visibilityFilter.push('BOARD_ONLY');
					}
				}
			}

			const documents = await prisma.document.findMany({
				where: {
					organizationId: context.organization.id,
					deletedAt: null,
					visibility: { in: visibilityFilter as any },
					...(input.category && { category: input.category }),
					contextBindings: {
						some: {
							contextType: 'ASSOCIATION',
							contextId: input.associationId
						}
					}
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = documents.length > input.limit;
			const items = hasMore ? documents.slice(0, -1) : documents;

			return successResponse(
				{
					documents: items.map((d: { id: string; title: string; description: string | null; category: string; visibility: string; fileName: string; fileSize: number; mimeType: string; version: number; effectiveDate: Date | null; tags: string[]; createdAt: Date }) => ({
						id: d.id,
						title: d.title,
						description: d.description ?? null,
						category: d.category,
						visibility: d.visibility,
						fileName: d.fileName,
						fileSize: d.fileSize,
						mimeType: d.mimeType,
						version: d.version,
						effectiveDate: d.effectiveDate?.toISOString() ?? null,
						tags: d.tags,
						createdAt: d.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	getDocument: orgProcedure
		.input(z.object({ id: z.string(), partyId: z.string().optional() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					document: z.object({
						id: z.string(),
						title: z.string(),
						description: z.string().nullable(),
						category: z.string(),
						visibility: z.string(),
						fileUrl: z.string(),
						fileName: z.string(),
						fileSize: z.number(),
						mimeType: z.string(),
						version: z.number(),
						effectiveDate: z.string().nullable(),
						expirationDate: z.string().nullable(),
						tags: z.array(z.string()),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					canAccess: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: { accessGrants: true }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await context.cerbos.authorize('view', 'document', document.id);

			// Check access
			let canAccess = document.visibility === 'PUBLIC';
			if (!canAccess && input.partyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.partyId, organizationId: context.organization.id, deletedAt: null }
				});

				if (party) {
					if (document.visibility === 'OWNERS_ONLY') canAccess = true;
					if (document.visibility === 'BOARD_ONLY') {
						const boardMembership = await prisma.boardMember.findFirst({
							where: { partyId: input.partyId, isActive: true }
						});
						if (boardMembership) canAccess = true;
					}
					if (document.visibility === 'PRIVATE') {
						const grant = document.accessGrants.find(
							(g: { partyId: string; revokedAt: Date | null; expiresAt: Date | null }) => g.partyId === input.partyId && !g.revokedAt && (!g.expiresAt || g.expiresAt > new Date())
						);
						canAccess = !!grant;
					}
				}
			}

			return successResponse(
				{
					document: {
						id: document.id,
						title: document.title,
						description: document.description ?? null,
						category: document.category,
						visibility: document.visibility,
						fileUrl: canAccess ? document.fileUrl : '',
						fileName: document.fileName,
						fileSize: document.fileSize,
						mimeType: document.mimeType,
						version: document.version,
						effectiveDate: document.effectiveDate?.toISOString() ?? null,
						expirationDate: document.expirationDate?.toISOString() ?? null,
						tags: document.tags,
						createdAt: document.createdAt.toISOString(),
						updatedAt: document.updatedAt.toISOString()
					},
					canAccess
				},
				context
			);
		}),

	logDocumentDownload: orgProcedure
		.input(
			z.object({
				documentId: z.string(),
				partyId: z.string().optional(),
				ipAddress: z.string().optional(),
				userAgent: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ logged: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await prisma.documentDownloadLog.create({
				data: {
					documentId: input.documentId,
					partyId: input.partyId,
					userId: context.user.id,
					ipAddress: input.ipAddress,
					userAgent: input.userAgent
				}
			});

			return successResponse({ logged: true }, context);
		}),

	grantDocumentAccess: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				documentId: z.string(),
				partyId: z.string(),
				expiresAt: z.string().datetime().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					grant: z.object({
						id: z.string(),
						documentId: z.string(),
						partyId: z.string(),
						grantedAt: z.string(),
						expiresAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('update', 'document', input.documentId);

			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!document) {
				throw ApiException.notFound('Document');
			}

			await ensureParty(input.partyId, context.organization.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerPortalWorkflow(
				{
					action: 'GRANT_DOCUMENT_ACCESS',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						documentId: input.documentId,
						partyId: input.partyId,
						accessLevel: 'VIEW',
						expiresAt: input.expiresAt
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw ApiException.internal(workflowResult.error || 'Failed to grant document access');
			}

			const grant = await prisma.documentAccessGrant.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					grant: {
						id: grant.id,
						documentId: grant.documentId,
						partyId: grant.partyId,
						grantedAt: grant.grantedAt.toISOString(),
						expiresAt: grant.expiresAt?.toISOString() ?? null
					}
				},
				context
			);
		}),

	revokeDocumentAccess: orgProcedure
		.input(
			z.object({
				documentId: z.string(),
				partyId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean(), revokedAt: z.string() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('update', 'document', input.documentId);

			const grant = await prisma.documentAccessGrant.findFirst({
				where: {
					documentId: input.documentId,
					partyId: input.partyId,
					revokedAt: null,
					document: { organizationId: context.organization.id }
				}
			});

			if (!grant) {
				throw ApiException.notFound('DocumentAccessGrant');
			}

			const now = new Date();
			await prisma.documentAccessGrant.update({
				where: { id: grant.id },
				data: { revokedAt: now }
			});

			return successResponse({ success: true, revokedAt: now.toISOString() }, context);
		})
};
