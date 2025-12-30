import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
    const { organization } = await parent();
    if (!organization) {
        throw error(401, 'Unauthorized');
    }

    // Build context for direct server-side calling
    let orgRoles: Record<string, any> = {};
    if (locals.user) {
        const memberships = await prisma.userOrganization.findMany({ where: { userId: locals.user.id } });
        for (const m of memberships) {
            orgRoles[m.organizationId] = m.role;
        }
    }
    
    // Pass organization through options (don't mutate locals)
    const role = orgRoles[organization.id];
    const context = buildServerContext(locals, { orgRoles, organization, role });
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
            throw error(404, 'Technician not found');
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
