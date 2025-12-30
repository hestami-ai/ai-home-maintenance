import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
    const formData = await request.formData();
    const associationId = formData.get('associationId')?.toString();
    const redirectTo = formData.get('redirectTo')?.toString() || request.headers.get('referer') || '/app/cam';

    if (associationId) {
        cookies.set('cam_association_id', associationId, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365 // 1 year
        });
    }

    throw redirect(303, redirectTo);
};
