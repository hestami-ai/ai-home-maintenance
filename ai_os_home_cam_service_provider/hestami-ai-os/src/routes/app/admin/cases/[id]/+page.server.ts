import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lookupWorkItemOrgId, orgTransaction } from '$lib/server/db/rls';
import { StaffStatus, UserRole, DocumentContextType, DocumentStatus, ActivityEntityType, StorageProvider } from '../../../../../../generated/prisma/enums.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 Client for SeaweedFS (presigned URLs for media viewing)
const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    },
    forcePathStyle: true // Required for SeaweedFS
});

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
    if (!staff || staff.status !== StaffStatus.ACTIVE || !user) {
        throw error(403, 'Staff access required');
    }

    const caseId = params.id;
    if (!caseId) {
        throw error(400, 'Case ID required');
    }

    try {
        // Step 1: Look up the case's organization ID using SECURITY DEFINER function
        const orgId = await lookupWorkItemOrgId(ActivityEntityType.CONCIERGE_CASE, caseId);

        if (!orgId) {
            throw error(404, 'Case not found');
        }

        // Step 2: Use orgTransaction to ensure RLS context is set on the same connection
        const result = await orgTransaction(orgId, async (tx) => {
            // Fetch the case with all related data (RLS now allows access)
            const conciergeCase = await tx.conciergeCase.findFirst({
            where: {
                id: caseId,
                deletedAt: null
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                property: {
                    include: {
                        ownerOrg: {
                            include: {
                                memberships: {
                                    where: { role: UserRole.ADMIN },
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
                return null; // Will throw 404 outside transaction
            }

            // Fetch document bindings for attachments
            const documentBindings = await tx.documentContextBinding.findMany({
            where: {
                contextType: DocumentContextType.CASE,
                contextId: caseId
            },
            include: {
                document: true
            },
            orderBy: { createdAt: 'desc' }
            });

            return { conciergeCase, documentBindings };
        }, { userId: user.id, reason: 'Staff viewing case detail', itemType: ActivityEntityType.CONCIERGE_CASE, itemId: caseId });

        if (!result || !result.conciergeCase) {
            throw error(404, 'Case not found');
        }

        const { conciergeCase, documentBindings } = result;

        // Transform document bindings to attachment format with presigned URLs
        const s3Bucket = process.env.S3_BUCKET || 'uploads';
        const expiresIn = 3600; // 1 hour

        const attachments = await Promise.all(
            documentBindings
                .filter((b) => b.document.status === DocumentStatus.ACTIVE)
                .map(async (b) => {
                    let presignedFileUrl: string | null = null;
                    let presignedThumbnailUrl: string | null = null;

                    // Generate presigned URL for the main file
                    if (b.document.storageProvider === StorageProvider.SEAWEEDFS || b.document.storageProvider === StorageProvider.S3) {
                        try {
                            const command = new GetObjectCommand({
                                Bucket: s3Bucket,
                                Key: b.document.storagePath
                            });
                            presignedFileUrl = await getSignedUrl(s3Client, command, { expiresIn });
                        } catch {
                            // Silently fail for URL generation - fallback to fileUrl
                            presignedFileUrl = b.document.fileUrl ?? null;
                        }

                        // Generate presigned URL for thumbnail if exists
                        if (b.document.thumbnailUrl) {
                            try {
                                const thumbnailKey = b.document.thumbnailUrl.includes('/uploads/')
                                    ? b.document.thumbnailUrl.split('/uploads/')[1]
                                    : b.document.thumbnailUrl;

                                const thumbCommand = new GetObjectCommand({
                                    Bucket: s3Bucket,
                                    Key: thumbnailKey
                                });
                                presignedThumbnailUrl = await getSignedUrl(s3Client, thumbCommand, { expiresIn });
                            } catch {
                                // Silently fail for thumbnail URL generation
                            }
                        }
                    } else {
                        // Local storage - use fileUrl directly
                        presignedFileUrl = b.document.fileUrl ?? null;
                    }

                    return {
                        id: b.document.id,
                        fileName: b.document.fileName,
                        fileSize: b.document.fileSize,
                        mimeType: b.document.mimeType,
                        fileUrl: b.document.fileUrl ?? '',
                        presignedFileUrl,
                        presignedThumbnailUrl,
                        thumbnailUrl: b.document.thumbnailUrl,
                        uploadedBy: b.document.uploadedBy,
                        createdAt: b.document.createdAt.toISOString()
                    };
                })
        );

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
                organization: conciergeCase.organization ? {
                    id: conciergeCase.organization.id,
                    name: conciergeCase.organization.name,
                    type: conciergeCase.organization.type
                } : null,
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
                })),
                attachments
            }
        };
    } catch (err) {
        // Re-throw SvelteKit errors as-is
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        console.error('Error loading case:', err);
        throw error(500, 'Failed to load case details');
    }
};
