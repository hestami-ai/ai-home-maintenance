<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PasswordResetConfirmRequest, PasswordResetConfirmResponse } from '$lib/types';
	
	const dispatch = createEventDispatcher<{
		success: PasswordResetConfirmResponse;
		error: string;
	}>();
	
	// Props
	let { token = '' } = $props<{ token?: string }>();
	
	// Form state
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	
	// Password strength indicator
	const passwordStrength = $derived(() => {
		if (!newPassword) return { score: 0, label: '', color: '' };
		
		let score = 0;
		if (newPassword.length >= 8) score++;
		if (newPassword.length >= 12) score++;
		if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
		if (/\d/.test(newPassword)) score++;
		if (/[^a-zA-Z0-9]/.test(newPassword)) score++;
		
		if (score <= 1) return { score, label: 'Weak', color: 'bg-error-500' };
		if (score <= 3) return { score, label: 'Fair', color: 'bg-warning-500' };
		if (score <= 4) return { score, label: 'Good', color: 'bg-primary-500' };
		return { score, label: 'Strong', color: 'bg-success-500' };
	});
	
	// Validation
	function validateForm(): boolean {
		fieldErrors = {};
		
		if (!token) {
			errorMessage = 'Invalid or missing reset token';
			return false;
		}
		
		if (!newPassword) {
			fieldErrors.new_password = 'New password is required';
		} else if (newPassword.length < 8) {
			fieldErrors.new_password = 'Password must be at least 8 characters';
		}
		
		if (!confirmPassword) {
			fieldErrors.confirm_password = 'Please confirm your new password';
		} else if (newPassword !== confirmPassword) {
			fieldErrors.confirm_password = 'Passwords do not match';
		}
		
		return Object.keys(fieldErrors).length === 0;
	}
	
	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		errorMessage = null;
		
		if (!validateForm()) {
			return;
		}
		
		isSubmitting = true;
		
		try {
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
			
			const data = await response.json();
			
			if (!response.ok) {
				// Handle validation errors from backend
				if (data.error) {
					errorMessage = data.error;
				} else if (data.token) {
					errorMessage = Array.isArray(data.token) ? data.token[0] : data.token;
				} else if (data.new_password) {
					fieldErrors.new_password = Array.isArray(data.new_password)
						? data.new_password[0]
						: data.new_password;
				} else {
					errorMessage = 'Failed to reset password. The link may have expired.';
				}
				dispatch('error', errorMessage || 'Password reset failed');
				return;
			}
			
			// Success
			dispatch('success', data as PasswordResetConfirmResponse);
			
			// Clear form
			newPassword = '';
			confirmPassword = '';
			fieldErrors = {};
			
		} catch (error) {
			console.error('Password reset confirm error:', error);
			errorMessage = 'An unexpected error occurred. Please try again.';
			dispatch('error', errorMessage);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<h2 class="text-2xl font-semibold mb-2">Set New Password</h2>
	<p class="text-surface-600 mb-6">
		Enter your new password below.
	</p>
	
	{#if errorMessage}
		<div class="alert variant-filled-error">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<span>{errorMessage}</span>
		</div>
	{/if}
	
	<!-- New Password -->
	<div class="form-field">
		<label for="new-password" class="label">
			<span>New Password</span>
		</label>
		<input
			id="new-password"
			type="password"
			bind:value={newPassword}
			disabled={isSubmitting}
			class="input"
			class:input-error={fieldErrors.new_password}
			placeholder="Enter your new password"
			autocomplete="new-password"
		/>
		{#if fieldErrors.new_password}
			<p class="text-error-500 text-sm mt-1">{fieldErrors.new_password}</p>
		{/if}
		
		<!-- Password Strength Indicator -->
		{#if newPassword}
			<div class="mt-2">
				<div class="flex items-center gap-2 mb-1">
					<span class="text-sm text-surface-600">Strength:</span>
					<span class="text-sm font-medium">{passwordStrength().label}</span>
				</div>
				<div class="h-2 bg-surface-200 rounded-full overflow-hidden">
					<div 
						class="h-full transition-all duration-300 {passwordStrength().color}"
						style="width: {(passwordStrength().score / 5) * 100}%"
					></div>
				</div>
				<p class="text-xs text-surface-500 mt-1">
					Use at least 8 characters with a mix of uppercase, lowercase, numbers, and symbols
				</p>
			</div>
		{/if}
	</div>
	
	<!-- Confirm Password -->
	<div class="form-field">
		<label for="confirm-password" class="label">
			<span>Confirm New Password</span>
		</label>
		<input
			id="confirm-password"
			type="password"
			bind:value={confirmPassword}
			disabled={isSubmitting}
			class="input"
			class:input-error={fieldErrors.confirm_password}
			placeholder="Confirm your new password"
			autocomplete="new-password"
		/>
		{#if fieldErrors.confirm_password}
			<p class="text-error-500 text-sm mt-1">{fieldErrors.confirm_password}</p>
		{/if}
	</div>
	
	<!-- Submit Button -->
	<div class="flex gap-3 pt-4">
		<button
			type="submit"
			disabled={isSubmitting}
			class="btn variant-filled-primary flex-1"
		>
			{#if isSubmitting}
				<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Resetting Password...
			{:else}
				Reset Password
			{/if}
		</button>
	</div>
</form>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.input-error {
		border-color: rgb(var(--color-error-500));
	}
	
	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.5rem;
	}
</style>
