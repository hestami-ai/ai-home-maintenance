import { auth } from '$server/auth';
import type { RequestHandler } from './$types';

/**
 * Better-Auth catch-all handler for /api/auth/*
 */
export const GET: RequestHandler = async ({ request }) => {
	return auth.handler(request);
};

export const POST: RequestHandler = async ({ request }) => {
	return auth.handler(request);
};
