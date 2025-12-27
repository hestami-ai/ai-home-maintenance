<script lang="ts">
	import { goto } from '$app/navigation';
	import { ShieldCheck, Loader2, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { staffApi } from '$lib/api/staff';

	let activationCode = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (activationCode.length !== 8) {
			error = 'Activation code must be 8 characters';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			// Directly call the RPC endpoint
			// Note: We need to ensure the client-side API definition includes this new procedure
			// If not available in typed client yet, we might need a raw fetch or verify client generation
			const response = await staffApi.activateWithCode({ code: activationCode });
			
			if (response.ok && response.data.success) {
				success = true;
				// Redirect after short delay
				setTimeout(() => {
					goto('/app');
				}, 2000);
			}
		} catch (e: any) {
			console.error(e);
			error = e.message || 'Activation failed. Please check your code and try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Activate Account | Hestami AI</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-50-950 p-4">
	<Card variant="outlined" class="w-full max-w-md p-8">
		<div class="text-center">
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
				<ShieldCheck class="h-8 w-8" />
			</div>
			
			<h1 class="text-2xl font-bold">Activate Account</h1>
			<p class="mt-2 text-surface-500">
				Enter the activation code provided by your administrator to securely access the Hestami platform.
			</p>
		</div>

		{#if success}
			<div class="mt-8 rounded-lg bg-success-500/10 p-4 text-center text-success-600 dark:text-success-400">
				<p class="font-medium">Account activated successfully!</p>
				<p class="mt-1 text-sm">Redirecting to dashboard...</p>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="mt-8 space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-4 text-error-500 text-center">
						{error}
					</div>
				{/if}

				<div>
					<label for="code" class="label sr-only">Activation Code</label>
					<div class="relative">
						<input
							type="text"
							id="code"
							bind:value={activationCode}
							maxlength="8"
							placeholder="ENTER CODE"
							class="input w-full text-center text-2xl font-mono tracking-widest uppercase"
							required
						/>
					</div>
					<p class="mt-2 text-center text-xs text-surface-400">
						8-character alphanumeric code
					</p>
				</div>

				<button
					type="submit"
					disabled={isSubmitting || activationCode.length !== 8}
					class="btn preset-filled-primary-500 w-full"
				>
					{#if isSubmitting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Activating...
					{:else}
						Activate Account
						<ArrowRight class="ml-2 h-4 w-4" />
					{/if}
				</button>
			</form>
		{/if}

		<div class="mt-8 border-t border-surface-200-800 pt-6 text-center">
			<p class="text-sm text-surface-500">
				Having trouble? <a href="mailto:support@hestami-ai.com" class="text-primary-500 hover:underline">Contact Support</a>
			</p>
		</div>
	</Card>
</div>
