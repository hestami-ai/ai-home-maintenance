/**
 * Password management types
 */

export interface PasswordChangeRequest {
	old_password: string;
	new_password: string;
	confirm_password?: string; // Optional frontend validation
}

export interface PasswordChangeResponse {
	message: string;
	success: boolean;
}

export interface PasswordResetRequest {
	email: string;
}

export interface PasswordResetResponse {
	message: string;
	success: boolean;
}

export interface PasswordResetConfirmRequest {
	token: string;
	new_password: string;
	confirm_password?: string; // Optional frontend validation
}

export interface PasswordResetConfirmResponse {
	message: string;
	success: boolean;
}

export interface PasswordValidationError {
	error: string;
	field?: string;
	details?: string[];
}
