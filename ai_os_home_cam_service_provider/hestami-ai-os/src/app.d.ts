// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User, Organization, UserRole } from '../generated/prisma/client';

declare global {
	namespace App {
		interface Error {
			code?: string;
			message: string;
		}

		interface Locals {
			user: User | null;
			session: { id: string; expiresAt: Date } | null;
			organization: Organization | null;
			role: UserRole | null;
			/** OpenTelemetry trace ID */
			traceId: string | null;
			/** OpenTelemetry span ID */
			spanId: string | null;
		}

		interface PageData {
			user: User | null;
			organization: Organization | null;
		}

		// interface PageState {}
		// interface Platform {}
	}
}

export {};
