import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateOpenAPISpec } from '$server/api/openapi';

/**
 * OpenAPI JSON specification endpoint
 * GET /api/docs returns the OpenAPI spec
 */
export const GET: RequestHandler = async () => {
	const spec = generateOpenAPISpec();
	return json(spec);
};
