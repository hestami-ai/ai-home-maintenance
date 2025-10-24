/**
 * Password Management Service
 * Client-side API for password operations
 * All requests go through SvelteKit proxy to Django backend
 */

import type {
	PasswordChangeRequest,
	PasswordChangeResponse,
	PasswordResetRequest,
	PasswordResetResponse,
	PasswordResetConfirmRequest,
	PasswordResetConfirmResponse
} from '$lib/types';

export class PasswordService {
	/**
	 * Change user password (requires authentication)
	 */
	static async changePassword(
		oldPassword: string,
		newPassword: string,
		confirmPassword?: string
	): Promise<PasswordChangeResponse> {
		const requestBody: PasswordChangeRequest = {
			old_password: oldPassword,
			new_password: newPassword,
			confirm_password: confirmPassword
		};

		const response = await fetch('/api/users/password/change', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody),
			credentials: 'include' // Include cookies for authentication
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to change password');
		}

		return response.json();
	}

	/**
	 * Request password reset email (public endpoint)
	 */
	static async requestPasswordReset(email: string): Promise<PasswordResetResponse> {
		const requestBody: PasswordResetRequest = {
			email: email.trim().toLowerCase()
		};

		const response = await fetch('/api/users/password/reset', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to request password reset');
		}

		return response.json();
	}

	/**
	 * Confirm password reset with token (public endpoint)
	 */
	static async confirmPasswordReset(
		token: string,
		newPassword: string,
		confirmPassword?: string
	): Promise<PasswordResetConfirmResponse> {
		const requestBody: PasswordResetConfirmRequest = {
			token,
			new_password: newPassword,
			confirm_password: confirmPassword
		};

		const response = await fetch('/api/users/password/reset/confirm', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to reset password');
		}

		return response.json();
	}

	/**
	 * Validate password strength
	 * Returns score from 0-5 and suggestions
	 */
	static validatePasswordStrength(password: string): {
		score: number;
		label: string;
		suggestions: string[];
	} {
		let score = 0;
		const suggestions: string[] = [];

		if (password.length < 8) {
			suggestions.push('Use at least 8 characters');
		} else {
			score++;
		}

		if (password.length >= 12) {
			score++;
		} else {
			suggestions.push('Consider using 12 or more characters');
		}

		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
			score++;
		} else {
			suggestions.push('Include both uppercase and lowercase letters');
		}

		if (/\d/.test(password)) {
			score++;
		} else {
			suggestions.push('Include at least one number');
		}

		if (/[^a-zA-Z0-9]/.test(password)) {
			score++;
		} else {
			suggestions.push('Include at least one special character');
		}

		let label = 'Weak';
		if (score > 4) label = 'Strong';
		else if (score > 3) label = 'Good';
		else if (score > 1) label = 'Fair';

		return { score, label, suggestions };
	}

	/**
	 * Validate email format
	 */
	static isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}
}
