<script lang="ts">
	import PasswordResetRequestForm from '$lib/components/PasswordResetRequestForm.svelte';
	import type { PasswordResetResponse } from '$lib/types';
	
	function handleSuccess(event: CustomEvent<PasswordResetResponse>) {
		console.log('Password reset email sent:', event.detail);
		// Success message is shown in the form component
	}
	
	function handleError(event: CustomEvent<string>) {
		console.error('Password reset request failed:', event.detail);
		// Error is already displayed in the form component
	}
</script>

<svelte:head>
	<title>Reset Password - Hestami AI</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-12 bg-surface-50">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-surface-900">Hestami AI</h1>
			<p class="text-surface-600 mt-2">Home Services Management</p>
		</div>
		
		<div class="card p-6 md:p-8 shadow-lg">
			<PasswordResetRequestForm 
				onsuccess={handleSuccess}
				onerror={handleError}
			/>
		</div>
	</div>
</div>
