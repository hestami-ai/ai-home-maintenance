import type { PageServerLoad } from './$types';
import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();
    const documentId = params.id;

    if (!organization) {
        throw error(401, 'Organization context required');
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
        const result = await client.document.getDocument({ id: documentId });

        if (!result.ok) {
            const errResponse = result as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Document not found';
            throw error(status, message);
        }

        // Fetch presigned URLs for the document and thumbnail (SSR - has org context)
        const [urlResult, thumbResult] = await Promise.all([
            client.document.getDownloadUrl({ id: documentId }).catch(() => null),
            client.document.getThumbnailUrl({ id: documentId }).catch(() => null)
        ]);
        const presignedFileUrl = urlResult?.data?.downloadUrl || null;
        const presignedThumbnailUrl = thumbResult?.data?.thumbnailUrl || null;

        return {
            document: {
                ...result.data.document,
                presignedFileUrl,
                presignedThumbnailUrl
            },
            contextBindings: result.data.contextBindings,
            organization
        };
    } catch (err) {
        console.error(`Failed to load document detail for ${documentId}:`, err);
        throw error(500, 'Failed to load document details');
    }
};
