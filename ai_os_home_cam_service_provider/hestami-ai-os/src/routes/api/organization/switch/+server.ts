import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';
import { createModuleLogger } from '$lib/server/logger';
import { OrganizationType } from '../../../../../generated/prisma/enums.js';

const log = createModuleLogger('ApiOrgSwitch');

export const POST: RequestHandler = async ({ request, locals }) => {
    // 1. Validate Session
    if (!locals.user) {
        throw error(401, 'Unauthorized');
    }

    const formData = await request.formData();
    const organizationId = formData.get('organizationId')?.toString();

    if (!organizationId) {
        throw error(400, 'Organization ID is required');
    }

    log.info('Processing organization switch', {
        userId: locals.user.id,
        targetOrgId: organizationId
    });

    // 2. Verify Membership & 3. Update Default Status
    const userId = locals.user.id;
    const targetMembership = await prisma.$transaction(async (tx) => {
        // Verify membership exists
        const membership = await tx.userOrganization.findUnique({
            where: {
                userId_organizationId: {
                    userId: userId,
                    organizationId: organizationId
                }
            },
            include: {
                organization: true
            }
        });

        if (!membership) {
            throw error(403, 'User is not a member of this organization');
        }

        // Update default status
        // First, unset default for all user's memberships
        await tx.userOrganization.updateMany({
            where: { userId: userId },
            data: { isDefault: false }
        });

        // Then set default for the target membership
        await tx.userOrganization.update({
            where: {
                userId_organizationId: {
                    userId: userId,
                    organizationId: organizationId
                }
            },
            data: { isDefault: true }
        });

        return membership;
    });

    // 4. Determine Redirect URL
    const orgType = targetMembership.organization.type;
    let redirectUrl = '/app/concierge';

    switch (orgType) {
        case OrganizationType.COMMUNITY_ASSOCIATION:
        case OrganizationType.MANAGEMENT_COMPANY:
            redirectUrl = '/app/cam';
            break;
        case OrganizationType.SERVICE_PROVIDER:
            redirectUrl = '/app/contractor';
            break;
        case OrganizationType.INDIVIDUAL_PROPERTY_OWNER:
        case OrganizationType.TRUST_OR_LLC:
            redirectUrl = '/app/concierge';
            break;
        default:
            redirectUrl = '/app/concierge';
    }

    log.info('Organization switch successful, redirecting', {
        userId: locals.user.id,
        newOrgId: organizationId,
        redirectUrl
    });

    throw redirect(303, redirectUrl);
};
