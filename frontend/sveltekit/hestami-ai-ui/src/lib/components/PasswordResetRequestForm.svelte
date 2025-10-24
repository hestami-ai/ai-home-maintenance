<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PasswordResetRequest, PasswordResetResponse } from '$lib/types';
	
	const dispatch = createEventDispatcher<{
		success: PasswordResetResponse;
		error: string;
	}>();
	
	// Form state
	let email = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	
	// Email validation
	function isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}
	
	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		errorMessage = null;
		successMessage = null;
		
		// Validate email
		if (!email) {
			errorMessage = 'Email address is required';
			return;
		}
		
		if (!isValidEmail(email)) {
			errorMessage = 'Please enter a valid email address';
			return;
		}
		
		isSubmitting = true;
		
		try {
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
			
			const data = await response.json();
			
			if (!response.ok) {
				if (data.error) {
					errorMessage = data.error;
				} else if (data.email) {
					errorMessage = Array.isArray(data.email) ? data.email[0] : data.email;
				} else {
					errorMessage = 'Failed to send reset email. Please try again.';
				}
				dispatch('error', errorMessage);
				return;
			}
			
			// Success
			successMessage = data.message || 'Password reset email sent! Please check your inbox.';
			dispatch('success', data as PasswordResetResponse);
			
			// Clear form
			email = '';
			
		} catch (error) {
			console.error('Password reset request error:', error);
			errorMessage = 'An unexpected error occurred. Please try again.';
			dispatch('error', errorMessage);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<h2 class="text-2xl font-semibold mb-2">Reset Password</h2>
	<p class="text-surface-600 mb-6">
		Enter your email address and we'll send you a link to reset your password.
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
	
	{#if successMessage}
		<div class="alert variant-filled-success">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
				<polyline points="22 4 12 14.01 9 11.01"></polyline>
			</svg>
			<span>{successMessage}</span>
		</div>
	{/if}
	
	<!-- Email Input -->
	<div class="form-field">
		<label for="email" class="label">
			<span>Email Address</span>
		</label>
		<input
			id="email"
			type="email"
			bind:value={email}
			disabled={isSubmitting || !!successMessage}
			class="input"
			placeholder="your.email@example.com"
			autocomplete="email"
		/>
	</div>
	
	<!-- Submit Button -->
	<div class="flex gap-3 pt-4">
		<button
			type="submit"
			disabled={isSubmitting || !!successMessage}
			class="btn variant-filled-primary flex-1"
		>
			{#if isSubmitting}
				<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Sending...
			{:else}
				Send Reset Link
			{/if}
		</button>
	</div>
	
	<p class="text-sm text-surface-500 text-center pt-4">
		Remember your password? <a href="/login" class="text-primary-500 hover:underline">Sign in</a>
	</p>
</form>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.5rem;
	}
</style>
