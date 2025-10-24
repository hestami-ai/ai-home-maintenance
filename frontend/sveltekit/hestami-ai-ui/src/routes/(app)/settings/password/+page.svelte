<script lang="ts">
	import PasswordChangeForm from '$lib/components/PasswordChangeForm.svelte';
	import { goto } from '$app/navigation';
	import type { PasswordChangeResponse } from '$lib/types';
	
	let showSuccessMessage = $state(false);
	
	function handleSuccess(event: CustomEvent<PasswordChangeResponse>) {
		console.log('Password changed successfully:', event.detail);
		showSuccessMessage = true;
		
		// Hide success message after 5 seconds
		setTimeout(() => {
			showSuccessMessage = false;
		}, 5000);
	}
	
	function handleError(event: CustomEvent<string>) {
		console.error('Password change failed:', event.detail);
		// Error is already displayed in the form component
	}
</script>

<svelte:head>
	<title>Change Password - Hestami AI</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="card p-6 md:p-8">
		{#if showSuccessMessage}
			<div class="alert variant-filled-success mb-6">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
					<polyline points="22 4 12 14.01 9 11.01"></polyline>
				</svg>
				<div>
					<p class="font-semibold">Password Changed Successfully!</p>
					<p class="text-sm">Your password has been updated.</p>
				</div>
			</div>
		{/if}
		
		<PasswordChangeForm 
			onsuccess={handleSuccess}
			onerror={handleError}
		/>
		
		<div class="mt-6 pt-6 border-t border-surface-200">
			<a href="/settings" class="text-primary-500 hover:underline text-sm">
				← Back to Settings
			</a>
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
