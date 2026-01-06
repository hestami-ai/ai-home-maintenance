// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Organization, Association, UserRole } from '../generated/prisma/client';

/** User type from Better Auth session */
interface SessionUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

declare global {
	namespace App {
		interface Error {
			code?: string;
			message: string;
		}

		interface Locals {
			user: SessionUser | null;
			session: { id: string; expiresAt: Date } | null;
			organization: Organization | null;
			association: Association | null;
			role: UserRole | null;
			isStaff: boolean;
			/** OpenTelemetry trace ID */
			traceId: string | null;
			/** OpenTelemetry span ID */
			spanId: string | null;
		}

		interface PageData {
			user: SessionUser | null;
			organization: Organization | null;
			association: Association | null;
		}

		// interface PageState {}
		// interface Platform {}
	}
}

export { };
