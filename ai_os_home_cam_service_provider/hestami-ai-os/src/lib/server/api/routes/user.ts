import { z } from 'zod';
import { authedProcedure, successResponse } from '../router.js';
import { prisma } from '../../db.js';
import { ResponseMetaSchema } from '$lib/schemas/index.js';

export const userRouter = {
    /**
     * Find a user by email (Admin only ideally, but restricted return fields)
     * Used for staff onboarding to find the user to link
     */
    findUserByEmail: authedProcedure
        .input(
            z.object({
                email: z.string().email()
            })
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({
                    user: z.object({
                        id: z.string(),
                        email: z.string(),
                        name: z.string().nullable()
                    }).nullable()
                }),
                meta: ResponseMetaSchema
            })
        )
        .handler(async ({ input, context }) => {
            const user = await prisma.user.findUnique({
                where: { email: input.email },
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            });

            return successResponse(
                {
                    user: user
                },
                context
            );
        })
};
