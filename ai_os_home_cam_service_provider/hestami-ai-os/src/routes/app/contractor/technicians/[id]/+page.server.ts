import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    // Get organization and memberships from parent layout (fetched via SECURITY DEFINER)
    const { organization, memberships, staff } = await parent();

    if (!organization) {
        throw error(401, 'Unauthorized');
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
    const { id } = params;
    const client = createDirectClient(context);

    try {
        const [techRes, skillsRes, certsRes, availRes] = await Promise.all([
            client.technician.get({ id }),
            client.technician.listSkills({ technicianId: id }),
            client.technician.listCertifications({ technicianId: id }),
            client.technician.getAvailability({ technicianId: id })
        ]);

        if (!techRes.ok) {
            const errResponse = techRes as any;
            const status = errResponse.error?.status || 500;
            const message = errResponse.error?.message || 'Technician not found';
            throw error(status, message);
        }

        return {
            technician: techRes.data.technician,
            skills: skillsRes.ok ? skillsRes.data.skills : [],
            certifications: certsRes.ok ? certsRes.data.certifications : [],
            availability: availRes.ok ? availRes.data.availability : null
        };
    } catch (err) {
        console.error('Failed to load technician details:', err);
        throw error(500, 'Failed to load technician details');
    }
};
