import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../db.js';
import { BETTER_AUTH_SECRET } from '$env/static/private';

/**
 * Better-Auth configuration
 */
export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: 'postgresql'
	}),
	trustedOrigins: [
		'http://localhost:3000',
		'http://localhost:5173',
		'http://127.0.0.1:3000',
		'http://127.0.0.1:5173',
		'https://dev-homeservices.hestami-ai.com'
	],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false // Set to true in production
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update session every 24 hours
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5 // 5 minutes
		}
	},
	user: {
		additionalFields: {
			// Additional user fields can be added here
		}
	}
});

/**
 * Auth types for use in application
 */
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
