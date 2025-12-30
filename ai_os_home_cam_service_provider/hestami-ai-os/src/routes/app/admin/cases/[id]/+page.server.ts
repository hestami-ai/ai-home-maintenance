import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import { setOrgContextForWorkItem, clearOrgContext } from '$lib/server/db/rls';

/**
 * Server-side load function for admin case detail view.
 * 
 * This handles the cross-org access pattern for staff:
 * 1. Look up the case's organization ID
 * 2. Set RLS context to that organization
 * 3. Fetch the case with related data
 * 4. Clear the RLS context
 * 
 * This keeps the org lookup internal to the server, not exposed to the client.
 */
export const load: PageServerLoad = async ({ params, parent }) => {
    const { staff, user } = await parent();

    // Verify the user is active staff (layout already checks but double-check)
    if (!staff || staff.status !== 'ACTIVE' || !user) {
        throw error(403, 'Staff access required');
    }

    const caseId = params.id;
    if (!caseId) {
        throw error(400, 'Case ID required');
    }

    let orgContextSet = false;

    try {
        // Step 1: Look up the case's organization and set RLS context
        const orgId = await setOrgContextForWorkItem(user.id, 'CONCIERGE_CASE', caseId);

        if (!orgId) {
            throw error(404, 'Case not found');
        }
        orgContextSet = true;

        // Step 2: Fetch the case with all related data (RLS now allows access)
        const conciergeCase = await prisma.conciergeCase.findFirst({
            where: {
                id: caseId,
                deletedAt: null
            },
            include: {
                property: {
                    include: {
                        ownerOrg: {
                            include: {
                                memberships: {
                                    where: { role: 'ADMIN' },
                                    take: 1,
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                assignedConcierge: true,
                statusHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                notes: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                },
                actions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                },
                participants: {
                    include: {
                        party: true
                    }
                }
            }
        });

        if (!conciergeCase) {
            throw error(404, 'Case not found');
        }

        // Get owner contact info from the property's owner organization
        const ownerMember = conciergeCase.property.ownerOrg?.memberships?.[0];
        const ownerContact = ownerMember ? {
            name: ownerMember.user.name,
            email: ownerMember.user.email,
            organizationName: conciergeCase.property.ownerOrg?.name ?? null
        } : null;

        // Transform to the shape expected by the page
        return {
            caseDetail: {
                case: {
                    id: conciergeCase.id,
                    caseNumber: conciergeCase.caseNumber,
                    propertyId: conciergeCase.propertyId,
                    title: conciergeCase.title,
                    description: conciergeCase.description,
                    status: conciergeCase.status,
                    priority: conciergeCase.priority,
                    originIntentId: conciergeCase.originIntentId,
                    assignedConciergeUserId: conciergeCase.assignedConciergeUserId,
                    assignedConciergeName: conciergeCase.assignedConcierge?.name ?? null,
                    resolvedAt: conciergeCase.resolvedAt?.toISOString() ?? null,
                    resolutionSummary: conciergeCase.resolutionSummary,
                    closedAt: conciergeCase.closedAt?.toISOString() ?? null,
                    cancelledAt: conciergeCase.cancelledAt?.toISOString() ?? null,
                    cancelReason: conciergeCase.cancelReason,
                    createdAt: conciergeCase.createdAt.toISOString(),
                    updatedAt: conciergeCase.updatedAt.toISOString()
                },
                property: {
                    id: conciergeCase.property.id,
                    name: conciergeCase.property.name,
                    addressLine1: conciergeCase.property.addressLine1
                },
                ownerContact,
                statusHistory: conciergeCase.statusHistory.map(h => ({
                    id: h.id,
                    fromStatus: h.fromStatus,
                    toStatus: h.toStatus,
                    reason: h.reason,
                    createdAt: h.createdAt.toISOString()
                })),
                notes: conciergeCase.notes.map(n => ({
                    id: n.id,
                    content: n.content,
                    noteType: n.noteType,
                    isInternal: n.isInternal,
                    createdAt: n.createdAt.toISOString()
                })),
                actions: conciergeCase.actions.map(a => ({
                    id: a.id,
                    actionType: a.actionType,
                    description: a.description,
                    status: a.status,
                    createdAt: a.createdAt.toISOString()
                })),
                participants: conciergeCase.participants.map(p => ({
                    id: p.id,
                    role: p.role,
                    partyName: p.party ? `${p.party.firstName ?? ''} ${p.party.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown',
                    partyEmail: p.party?.email ?? null
                }))
            }
        };
    } catch (err) {
        // Re-throw SvelteKit errors as-is
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        console.error('Error loading case:', err);
        throw error(500, 'Failed to load case details');
    } finally {
        // Always clear the RLS context
        if (orgContextSet) {
            await clearOrgContext(user.id);
        }
    }
};
