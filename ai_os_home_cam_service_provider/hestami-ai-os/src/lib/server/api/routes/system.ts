import { z } from 'zod';
import { publicProcedure, successResponse } from '../router.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('SystemRoute');

/**
 * System/health check procedures
 */
export const systemRouter = {
	/**
	 * Health check endpoint
	 */
	health: publicProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					status: z.string(),
					version: z.string(),
					timestamp: z.string()
				}),
				meta: z.object({
					requestId: z.string(),
					traceId: z.string().nullable(),
					spanId: z.string().nullable(),
					timestamp: z.string(),
					locale: z.string()
				})
			})
		)
		.handler(async ({ context }) => {
			return successResponse(
				{
					status: 'healthy',
					version: process.env.npm_package_version || '0.0.1',
					timestamp: new Date().toISOString()
				},
				context
			);
		}),

	/**
	 * Returns current user info (if authenticated)
	 */
	me: publicProcedure
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					authenticated: z.boolean(),
					user: z
						.object({
							id: z.string(),
							email: z.string(),
							name: z.string().nullable()
						})
						.nullable(),
					organization: z
						.object({
							id: z.string(),
							name: z.string(),
							type: z.string()
						})
						.nullable(),
					role: z.string().nullable()
				}),
				meta: z.object({
					requestId: z.string(),
					traceId: z.string().nullable(),
					spanId: z.string().nullable(),
					timestamp: z.string(),
					locale: z.string()
				})
			})
		)
		.handler(async ({ context }) => {
			return successResponse(
				{
					authenticated: !!context.user,
					user: context.user
						? {
								id: context.user.id,
								email: context.user.email,
								name: context.user.name
							}
						: null,
					organization: context.organization
						? {
								id: context.organization.id,
								name: context.organization.name,
								type: context.organization.type
							}
						: null,
					role: context.role
				},
				context
			);
		})
};
