import { error } from '@sveltejs/kit';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    if (!organization) {
        throw error(401, 'Organization required');
    }

    // Build context using data from parent layout
    const orgRoles: Record<string, any> = {};
    for (const m of memberships ?? []) {
        orgRoles[m.organization.id] = m.role;
    }
    const staffRoles = staff?.roles ?? [];
    const pillarAccess = staff?.pillarAccess ?? [];
    const role = orgRoles[organization.id];

    const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
    const client = createDirectClient(context);

    try {
        // Load property details
        const propertyResponse = await client.individualProperty.get({
            propertyId: params.id
        });

        if (!propertyResponse.ok) {
            const errResponse = propertyResponse as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Property not found';
            throw error(status, message);
        }

        // Load documents and service history in parallel (SSR to avoid client-side race conditions)
        const [documentsResult, serviceCallsResult] = await Promise.all([
            client.document.listDocuments({
                contextType: 'PROPERTY',
                contextId: params.id,
                limit: 100
            }).catch((err) => {
                console.error('Failed to load documents:', err);
                return null;
            }),
            client.conciergeCase.list({
                propertyId: params.id,
                limit: 50
            }).catch((err) => {
                console.error('Failed to load service history:', err);
                return null;
            })
        ]);

        // Separate documents into documents and media
        const allDocuments = documentsResult?.data?.documents ?? [];
        const documents = allDocuments.filter(
            (d) => !d.mimeType.startsWith('image/') && !d.mimeType.startsWith('video/')
        );
        const mediaDocuments = allDocuments.filter(
            (d) => d.mimeType.startsWith('image/') || d.mimeType.startsWith('video/')
        );

        // Fetch presigned URLs for media items (SSR - has org context)
        const mediaItems = await Promise.all(
            mediaDocuments.map(async (doc) => {
                try {
                    const urlResult = await client.document.getDownloadUrl({ id: doc.id }).catch(() => null);
                    const presignedUrl = urlResult?.data?.downloadUrl || null;
                    
                    return {
                        ...doc,
                        // Use presigned URL for both thumbnail and full file
                        // (thumbnail generation may not have completed, so fall back to original)
                        thumbnailUrl: presignedUrl,
                        fileUrl: presignedUrl
                    };
                } catch {
                    return {
                        ...doc,
                        thumbnailUrl: null,
                        fileUrl: null
                    };
                }
            })
        );

        // Map service calls
        const serviceCalls = (serviceCallsResult?.data?.cases ?? []).map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            title: c.title,
            status: c.status,
            priority: c.priority,
            createdAt: c.createdAt
        }));

        return {
            property: propertyResponse.data.property,
            documents,
            mediaItems,
            serviceCalls
        };
    } catch (err) {
        console.error('Failed to load property:', err);
        throw error(500, 'Internal Server Error');
    }
};
