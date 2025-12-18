import { z } from 'zod';
import { ContractorTradeType } from '../../../../../../generated/prisma/client.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { recordExecution } from '../../middleware/activityEvent.js';

const assertServiceProviderOrg = async (organizationId: string) => {
	const org = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			type: { in: ['SERVICE_PROVIDER', 'EXTERNAL_SERVICE_PROVIDER'] },
			deletedAt: null
		}
	});
	if (!org) throw ApiException.forbidden('This feature is only available for service provider organizations');
	return org;
};

const assertBranchBelongsToOrg = async (branchId: string, organizationId: string) => {
	const branch = await prisma.contractorBranch.findFirst({
		where: { id: branchId, organizationId, isActive: true }
	});
	if (!branch) {
		throw ApiException.forbidden('Branch not found for this organization');
	}
	return branch;
};

const timeRangeSchema = z.object({
	start: z.string().min(1),
	end: z.string().min(1)
});

const technicianOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	branchId: z.string().nullable(),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	employeeId: z.string().nullable(),
	isActive: z.boolean(),
	hireDate: z.string().nullable(),
	terminationDate: z.string().nullable(),
	timezone: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const technicianListOutput = z.object({
	technicians: z.array(technicianOutput),
	pagination: PaginationOutputSchema
});

const technicianUpsertInput = z
	.object({
		id: z.string().optional(),
		firstName: z.string().min(1),
		lastName: z.string().min(1),
		email: z.string().email().optional(),
		phone: z.string().optional(),
		employeeId: z.string().optional(),
		branchId: z.string().optional(),
		isActive: z.boolean().optional(),
		hireDate: z.string().optional(),
		terminationDate: z.string().optional(),
		timezone: z.string().optional()
	})
	.merge(IdempotencyKeySchema);

const tradeEnum = z.nativeEnum(ContractorTradeType);

const skillOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	trade: tradeEnum,
	level: z.number(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const certificationOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	name: z.string(),
	authority: z.string().nullable(),
	certificationId: z.string().nullable(),
	issuedAt: z.string().nullable(),
	expiresAt: z.string().nullable(),
	documentUrl: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const availabilityOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	monday: z.array(timeRangeSchema).nullable(),
	tuesday: z.array(timeRangeSchema).nullable(),
	wednesday: z.array(timeRangeSchema).nullable(),
	thursday: z.array(timeRangeSchema).nullable(),
	friday: z.array(timeRangeSchema).nullable(),
	saturday: z.array(timeRangeSchema).nullable(),
	sunday: z.array(timeRangeSchema).nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const timeOffOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	startsAt: z.string(),
	endsAt: z.string(),
	reason: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const territoryOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	serviceAreaId: z.string(),
	isPrimary: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const kpiOutput = z.object({
	id: z.string(),
	technicianId: z.string(),
	periodStart: z.string(),
	periodEnd: z.string(),
	jobsCompleted: z.number(),
	onTimeRate: z.number(),
	callbackRate: z.number(),
	revenue: z.string(),
	laborHours: z.number(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const serializeTechnician = (t: any) => ({
	id: t.id,
	organizationId: t.organizationId,
	branchId: t.branchId,
	firstName: t.firstName,
	lastName: t.lastName,
	email: t.email,
	phone: t.phone,
	employeeId: t.employeeId,
	isActive: t.isActive,
	hireDate: t.hireDate ? t.hireDate.toISOString() : null,
	terminationDate: t.terminationDate ? t.terminationDate.toISOString() : null,
	timezone: t.timezone,
	createdAt: t.createdAt.toISOString(),
	updatedAt: t.updatedAt.toISOString()
});

const serializeSkill = (s: any) => ({
	id: s.id,
	technicianId: s.technicianId,
	trade: s.trade,
	level: s.level,
	notes: s.notes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

const serializeCertification = (c: any) => ({
	id: c.id,
	technicianId: c.technicianId,
	name: c.name,
	authority: c.authority,
	certificationId: c.certificationId,
	issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
	expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
	documentUrl: c.documentUrl,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString()
});

const serializeAvailability = (a: any) => ({
	id: a.id,
	technicianId: a.technicianId,
	monday: a.monday as any,
	tuesday: a.tuesday as any,
	wednesday: a.wednesday as any,
	thursday: a.thursday as any,
	friday: a.friday as any,
	saturday: a.saturday as any,
	sunday: a.sunday as any,
	createdAt: a.createdAt.toISOString(),
	updatedAt: a.updatedAt.toISOString()
});

const serializeTimeOff = (t: any) => ({
	id: t.id,
	technicianId: t.technicianId,
	startsAt: t.startsAt.toISOString(),
	endsAt: t.endsAt.toISOString(),
	reason: t.reason,
	createdAt: t.createdAt.toISOString(),
	updatedAt: t.updatedAt.toISOString()
});

const serializeTerritory = (t: any) => ({
	id: t.id,
	technicianId: t.technicianId,
	serviceAreaId: t.serviceAreaId,
	isPrimary: t.isPrimary,
	createdAt: t.createdAt.toISOString(),
	updatedAt: t.updatedAt.toISOString()
});

const serializeKpi = (k: any) => ({
	id: k.id,
	technicianId: k.technicianId,
	periodStart: k.periodStart.toISOString(),
	periodEnd: k.periodEnd.toISOString(),
	jobsCompleted: k.jobsCompleted,
	onTimeRate: k.onTimeRate,
	callbackRate: k.callbackRate,
	revenue: k.revenue.toString(),
	laborHours: k.laborHours,
	createdAt: k.createdAt.toISOString(),
	updatedAt: k.updatedAt.toISOString()
});

export const technicianRouter = {
	// Technician CRUD
	upsert: orgProcedure
		.input(technicianUpsertInput)
		.output(z.object({ ok: z.literal(true), data: z.object({ technician: technicianOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await assertServiceProviderOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'technician', input.id ?? 'new');

			const { id, idempotencyKey, hireDate, terminationDate, branchId, ...rest } = input;

			if (branchId) {
				await assertBranchBelongsToOrg(branchId, context.organization.id);
			}

			const parsedHire = hireDate ? new Date(hireDate) : undefined;
			const parsedTermination = terminationDate ? new Date(terminationDate) : undefined;

			const work = async () => {
				if (id) {
					const existing = await prisma.technician.findFirst({
						where: { id, organizationId: context.organization.id }
					});
					if (!existing) throw ApiException.notFound('Technician');
					return prisma.technician.update({
						where: { id },
						data: {
							...rest,
							branchId: branchId ?? null,
							hireDate: parsedHire,
							terminationDate: parsedTermination
						}
					});
				}
				return prisma.technician.create({
					data: {
						organizationId: context.organization.id,
						...rest,
						branchId: branchId ?? null,
						hireDate: parsedHire,
						terminationDate: parsedTermination
					}
				});
			};

			const result = await withIdempotency(idempotencyKey, context, work);

			// Record activity event
			await recordExecution(context, {
				entityType: 'TECHNICIAN',
				entityId: result.result.id,
				action: input.id ? 'UPDATE' : 'CREATE',
				summary: `Technician ${input.id ? 'updated' : 'created'}: ${result.result.firstName} ${result.result.lastName}`,
				technicianId: result.result.id,
				newState: {
					firstName: result.result.firstName,
					lastName: result.result.lastName,
					isActive: result.result.isActive
				}
			});

			return successResponse({ technician: serializeTechnician(result.result) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ technician: technicianOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician', tech.id);
			return successResponse({ technician: serializeTechnician(tech) }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				includeInactive: z.boolean().optional(),
				branchId: z.string().optional()
			}).optional()
		)
		.output(z.object({ ok: z.literal(true), data: technicianListOutput, meta: z.any() }))
		.handler(async ({ input, context }) => {
			await assertServiceProviderOrg(context.organization.id);
			await context.cerbos.authorize('view', 'technician', '*');

			const limit = input?.limit ?? 50;
			const cursor = input?.cursor;

			const where: Record<string, unknown> = {
				organizationId: context.organization.id
			};
			if (!input?.includeInactive) where['isActive'] = true;
			if (input?.branchId) where['branchId'] = input.branchId;

			const technicians = await prisma.technician.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }],
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = technicians.length > limit;
			const results = hasMore ? technicians.slice(0, limit) : technicians;

			return successResponse(
				{
					technicians: results.map(serializeTechnician),
					pagination: {
						hasMore,
						nextCursor: hasMore ? results[results.length - 1].id : null
					}
				},
				context
			);
		}),

	// Skills
	upsertSkill: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					technicianId: z.string(),
					trade: tradeEnum,
					level: z.number().int().min(1).max(5).default(1),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ skill: skillOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('edit', 'technician_skill', input.id ?? 'new');

			const { id, idempotencyKey, technicianId: _ignoredTechId, ...data } = input;
			const work = async () => {
				if (id) {
					const existing = await prisma.technicianSkill.findFirst({
						where: { id, technicianId: tech.id }
					});
					if (!existing) throw ApiException.notFound('TechnicianSkill');
					return prisma.technicianSkill.update({
						where: { id },
						data: {
							...data,
							trade: data.trade
						}
					});
				}
				return prisma.technicianSkill.upsert({
					where: { technicianId_trade: { technicianId: tech.id, trade: data.trade as any } },
					update: {
						...data,
						trade: data.trade
					},
					create: {
						technicianId: tech.id,
						...data,
						trade: data.trade
					}
				});
			};

			const result = await withIdempotency(idempotencyKey, context, work);
			return successResponse({ skill: serializeSkill(result.result) }, context);
		}),

	listSkills: orgProcedure
		.input(z.object({ technicianId: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ skills: z.array(skillOutput) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_skill', '*');

			const skills = await prisma.technicianSkill.findMany({ where: { technicianId: tech.id } });
			return successResponse({ skills: skills.map(serializeSkill) }, context);
		}),

	// Certifications
	upsertCertification: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					technicianId: z.string(),
					name: z.string().min(1),
					authority: z.string().optional(),
					certificationId: z.string().optional(),
					issuedAt: z.string().optional(),
					expiresAt: z.string().optional(),
					documentUrl: z.string().url().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ certification: certificationOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('edit', 'technician_certification', input.id ?? 'new');

			const { id, idempotencyKey, technicianId: _ignoredTechId, issuedAt, expiresAt, ...data } = input;
			const work = async () => {
				if (id) {
					const existing = await prisma.technicianCertification.findFirst({
						where: { id, technicianId: tech.id }
					});
					if (!existing) throw ApiException.notFound('TechnicianCertification');
					return prisma.technicianCertification.update({
						where: { id },
						data: {
							...data,
							issuedAt: issuedAt ? new Date(issuedAt) : null,
							expiresAt: expiresAt ? new Date(expiresAt) : null
						}
					});
				}
				return prisma.technicianCertification.create({
					data: {
						technicianId: tech.id,
						...data,
						issuedAt: issuedAt ? new Date(issuedAt) : null,
						expiresAt: expiresAt ? new Date(expiresAt) : null
					}
				});
			};
			const result = await withIdempotency(idempotencyKey, context, work);
			return successResponse({ certification: serializeCertification(result.result) }, context);
		}),

	listCertifications: orgProcedure
		.input(z.object({ technicianId: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ certifications: z.array(certificationOutput) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_certification', '*');

			const certs = await prisma.technicianCertification.findMany({ where: { technicianId: tech.id } });
			return successResponse({ certifications: certs.map(serializeCertification) }, context);
		}),

	// Availability (single record per technician)
	setAvailability: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					monday: z.array(timeRangeSchema).optional(),
					tuesday: z.array(timeRangeSchema).optional(),
					wednesday: z.array(timeRangeSchema).optional(),
					thursday: z.array(timeRangeSchema).optional(),
					friday: z.array(timeRangeSchema).optional(),
					saturday: z.array(timeRangeSchema).optional(),
					sunday: z.array(timeRangeSchema).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ availability: availabilityOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('edit', 'technician_availability', tech.id);

			const { idempotencyKey, technicianId: _ignoredTechId, ...data } = input;

			const validateRanges = (dayName: string, ranges?: Array<{ start: string; end: string }>) => {
				if (!ranges) return;
				const parsed = ranges.map((r, idx) => {
					const [sh, sm] = r.start.split(':').map(Number);
					const [eh, em] = r.end.split(':').map(Number);
					if (
						Number.isNaN(sh) ||
						Number.isNaN(sm) ||
						Number.isNaN(eh) ||
						Number.isNaN(em) ||
						sh < 0 ||
						sh > 23 ||
						eh < 0 ||
						eh > 23 ||
						sm < 0 ||
						sm > 59 ||
						em < 0 ||
						em > 59
					) {
						throw ApiException.badRequest(`Invalid time format for ${dayName} entry ${idx + 1} (HH:MM expected)`);
					}
					const startMinutes = sh * 60 + sm;
					const endMinutes = eh * 60 + em;
					if (endMinutes <= startMinutes) {
						throw ApiException.badRequest(`Availability end must be after start for ${dayName} entry ${idx + 1}`);
					}
					return { startMinutes, endMinutes };
				});
				const sorted = parsed.toSorted((a, b) => a.startMinutes - b.startMinutes);
				for (let i = 1; i < sorted.length; i++) {
					if (sorted[i].startMinutes < sorted[i - 1].endMinutes) {
						throw ApiException.conflict(`Availability overlaps on ${dayName}`);
					}
				}
			};

			validateRanges('monday', data.monday);
			validateRanges('tuesday', data.tuesday);
			validateRanges('wednesday', data.wednesday);
			validateRanges('thursday', data.thursday);
			validateRanges('friday', data.friday);
			validateRanges('saturday', data.saturday);
			validateRanges('sunday', data.sunday);

			const work = async () =>
				prisma.technicianAvailability.upsert({
					where: { technicianId: tech.id },
					update: data,
					create: { technicianId: tech.id, ...data }
				});

			const result = await withIdempotency(idempotencyKey, context, work);
			return successResponse({ availability: serializeAvailability(result.result) }, context);
		}),

	getAvailability: orgProcedure
		.input(z.object({ technicianId: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ availability: availabilityOutput.nullable() }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_availability', tech.id);

			const avail = await prisma.technicianAvailability.findUnique({ where: { technicianId: tech.id } });
			return successResponse({ availability: avail ? serializeAvailability(avail) : null }, context);
		}),

	// Time off
	addTimeOff: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					startsAt: z.string(),
					endsAt: z.string(),
					reason: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ timeOff: timeOffOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('edit', 'technician_time_off', tech.id);

			const { idempotencyKey, technicianId: _ignoredTechId, ...data } = input;
			const newStart = new Date(data.startsAt);
			const newEnd = new Date(data.endsAt);
			if (newEnd <= newStart) {
				throw ApiException.badRequest('Time off end must be after start');
			}

			const overlap = await prisma.technicianTimeOff.findFirst({
				where: {
					technicianId: tech.id,
					startsAt: { lt: newEnd },
					endsAt: { gt: newStart }
				}
			});
			if (overlap) {
				throw ApiException.conflict('Time off overlaps an existing entry');
			}

			const work = async () =>
				prisma.technicianTimeOff.create({
					data: {
						technicianId: tech.id,
						startsAt: newStart,
						endsAt: newEnd,
						reason: data.reason
					}
				});
			const result = await withIdempotency(idempotencyKey, context, work);
			return successResponse({ timeOff: serializeTimeOff(result.result) }, context);
		}),

	listTimeOff: orgProcedure
		.input(z.object({ technicianId: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ timeOff: z.array(timeOffOutput) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_time_off', tech.id);

			const items = await prisma.technicianTimeOff.findMany({
				where: { technicianId: tech.id },
				orderBy: [{ startsAt: 'desc' }]
			});
			return successResponse({ timeOff: items.map(serializeTimeOff) }, context);
		}),

	// Territories
	assignTerritory: orgProcedure
		.input(
			z
				.object({
					technicianId: z.string(),
					serviceAreaId: z.string(),
					isPrimary: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ territory: territoryOutput }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('edit', 'technician_territory', input.serviceAreaId);

			// ensure service area belongs to same org
			const area = await prisma.serviceArea.findFirst({
				where: { id: input.serviceAreaId, serviceProviderOrgId: tech.organizationId }
			});
			if (!area) throw ApiException.forbidden('Service area not found for this organization');

			const { idempotencyKey, technicianId: _ignoredTechId, isPrimary = false, ...data } = input;
			const work = async () => {
				if (isPrimary) {
					await prisma.technicianTerritory.updateMany({
						where: { technicianId: tech.id, isPrimary: true },
						data: { isPrimary: false }
					});
				}
				return prisma.technicianTerritory.upsert({
					where: { technicianId_serviceAreaId: { technicianId: tech.id, serviceAreaId: data.serviceAreaId } },
					update: { isPrimary },
					create: { technicianId: tech.id, serviceAreaId: data.serviceAreaId, isPrimary }
				});
			};
			const result = await withIdempotency(idempotencyKey, context, work);
			return successResponse({ territory: serializeTerritory(result.result) }, context);
		}),

	listTerritories: orgProcedure
		.input(z.object({ technicianId: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ territories: z.array(territoryOutput) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_territory', '*');

			const territories = await prisma.technicianTerritory.findMany({
				where: { technicianId: tech.id },
				orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
			});
			return successResponse({ territories: territories.map(serializeTerritory) }, context);
		}),

	// KPIs (read-only list for now)
	listKpis: orgProcedure
		.input(
			PaginationInputSchema.extend({
				technicianId: z.string()
			})
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ kpis: z.array(kpiOutput), pagination: PaginationOutputSchema }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			const tech = await prisma.technician.findFirst({
				where: { id: input.technicianId, organizationId: context.organization.id }
			});
			if (!tech) throw ApiException.notFound('Technician');
			await assertServiceProviderOrg(tech.organizationId);
			await context.cerbos.authorize('view', 'technician_kpi', '*');

			const limit = input.limit ?? 50;
			const cursor = input.cursor;

			const kpis = await prisma.technicianKPI.findMany({
				where: { technicianId: tech.id },
				orderBy: [{ periodStart: 'desc' }],
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = kpis.length > limit;
			const results = hasMore ? kpis.slice(0, limit) : kpis;

			return successResponse(
				{
					kpis: results.map(serializeKpi),
					pagination: {
						hasMore,
						nextCursor: hasMore ? results[results.length - 1].id : null
					}
				},
				context
			);
		})
};
