<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PasswordResetConfirmForm from '$lib/components/PasswordResetConfirmForm.svelte';
	import type { PasswordResetConfirmResponse } from '$lib/types';
	
	// Get token from URL query parameter
	const token = $derived($page.url.searchParams.get('token') || '');
	
	let showSuccessMessage = $state(false);
	
	function handleSuccess(event: CustomEvent<PasswordResetConfirmResponse>) {
		console.log('Password reset successful:', event.detail);
		showSuccessMessage = true;
		
		// Redirect to login after 3 seconds
		setTimeout(() => {
			goto('/login');
		}, 3000);
	}
	
	function handleError(event: CustomEvent<string>) {
		console.error('Password reset failed:', event.detail);
		// Error is already displayed in the form component
	}
</script>

<svelte:head>
	<title>Set New Password - Hestami AI</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-12 bg-surface-50">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-surface-900">Hestami AI</h1>
			<p class="text-surface-600 mt-2">Home Services Management</p>
		</div>
		
		<div class="card p-6 md:p-8 shadow-lg">
			{#if showSuccessMessage}
				<div class="alert variant-filled-success mb-6">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
					<div>
						<p class="font-semibold">Password Reset Successful!</p>
						<p class="text-sm">Redirecting to login...</p>
					</div>
				</div>
			{:else if !token}
				<div class="alert variant-filled-error mb-6">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
					<div>
						<p class="font-semibold">Invalid Reset Link</p>
						<p class="text-sm">This password reset link is invalid or has expired.</p>
					</div>
				</div>
				<a href="/password-reset" class="btn variant-filled-primary w-full">
					Request New Reset Link
				</a>
			{:else}
				<PasswordResetConfirmForm 
					{token}
					onsuccess={handleSuccess}
					onerror={handleError}
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	.alert {
		display: flex;
		align-items: start;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.5rem;
	}
</style>
