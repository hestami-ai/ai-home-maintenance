import { OpenAPIGenerator } from '@orpc/openapi';
import { appRouter } from './index.js';

/**
 * OpenAPI specification generator for the Hestami API
 */
export const openAPIGenerator = new OpenAPIGenerator({
	schemaConverters: []
});

/**
 * Generate OpenAPI specification from the app router
 */
export function generateOpenAPISpec() {
	return openAPIGenerator.generate(appRouter, {
		info: {
			title: 'Hestami AI OS API',
			version: '1.0.0',
			description: `
Hestami Platform API for Community Association Management, Homeowner Concierge Services, and Service Provider Operations.

## Authentication
All authenticated endpoints require a valid session token in the Authorization header:
\`\`\`
Authorization: Bearer <session_token>
\`\`\`

## Organization Context
Organization-scoped endpoints require the X-Org-Id header:
\`\`\`
X-Org-Id: <organization_id>
\`\`\`

## Idempotency
All mutating operations require an idempotency key:
\`\`\`json
{ "idempotencyKey": "<uuid>" }
\`\`\`

## Error Responses
All errors follow the standard envelope format:
\`\`\`json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "type": "error_type",
    "httpStatus": 400,
    "message": "Human readable message",
    "fieldErrors": []
  },
  "meta": {
    "requestId": "req_xxx",
    "traceId": "trace_xxx",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
\`\`\`
      `.trim()
		},
		servers: [
			{
				url: '/api/v1/rpc',
				description: 'API v1'
			}
		],
		security: [
			{
				bearerAuth: []
			}
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT'
				}
			}
		}
	});
}
