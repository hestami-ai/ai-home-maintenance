<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, KeyRound, CheckCircle, AlertCircle } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { invitationApi } from '$lib/api/invitation.js';

	let activationCode = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);
	let acceptedOrg = $state<{ name: string; role: string } | null>(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		const code = activationCode.trim().toUpperCase();
		if (code.length !== 8) {
			error = 'Activation code must be 8 characters';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await invitationApi.accept(code);
			
			if (response.ok && response.data.success) {
				success = true;
				acceptedOrg = {
					name: response.data.organizationName,
					role: response.data.role
				};
				setTimeout(() => {
					goto('/app');
				}, 2000);
			}
		} catch (e: unknown) {
			console.error(e);
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = 'Failed to accept invitation. Please check your code and try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	function formatCode(value: string): string {
		return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		activationCode = formatCode(target.value);
	}
</script>

<svelte:head>
	<title>Join Organization | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="sm">
	<div class="py-12">
		<a
			href="/onboarding"
			class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 transition-colors"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to options
		</a>

		<div class="mt-8 text-center">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-500/10">
				<KeyRound class="h-8 w-8 text-tertiary-500" />
			</div>
			<h1 class="mt-4 text-2xl font-bold">Join an Organization</h1>
			<p class="mt-2 text-surface-500">
				Enter the 8-character invitation code you received from your organization administrator.
			</p>
		</div>

		{#if success && acceptedOrg}
			<Card variant="filled" padding="lg" class="mt-8 text-center">
				<div class="flex flex-col items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/20">
						<CheckCircle class="h-6 w-6 text-success-500" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-success-700 dark:text-success-400">
							Welcome to {acceptedOrg.name}!
						</h2>
						<p class="mt-1 text-sm text-surface-500">
							You've been added as <strong>{acceptedOrg.role}</strong>. Redirecting to your dashboard...
						</p>
					</div>
				</div>
			</Card>
		{:else}
			<form onsubmit={handleSubmit} class="mt-8">
				<Card variant="outlined" padding="lg">
					<div class="space-y-6">
						<div>
							<label for="code" class="block text-sm font-medium">
								Invitation Code
							</label>
							<input
								type="text"
								id="code"
								value={activationCode}
								oninput={handleInput}
								placeholder="XXXXXXXX"
								class="mt-2 block w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-surface-600 dark:bg-surface-800"
								maxlength="8"
								autocomplete="off"
								autocapitalize="characters"
								spellcheck="false"
								disabled={isSubmitting}
							/>
							<p class="mt-2 text-xs text-surface-500 text-center">
								The code is 8 characters, letters and numbers only
							</p>
						</div>

						{#if error}
							<div class="flex items-start gap-3 rounded-lg bg-error-50 p-4 dark:bg-error-900/20">
								<AlertCircle class="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
								<p class="text-sm text-error-700 dark:text-error-400">{error}</p>
							</div>
						{/if}

						<button
							type="submit"
							class="btn preset-filled-primary-500 w-full"
							disabled={isSubmitting || activationCode.length !== 8}
						>
							{#if isSubmitting}
								<span class="loading loading-spinner loading-sm"></span>
								Verifying...
							{:else}
								Join Organization
							{/if}
						</button>
					</div>
				</Card>
			</form>

			<div class="mt-6 text-center">
				<p class="text-sm text-surface-500">
					Don't have a code? Ask your organization administrator to send you an invitation.
				</p>
			</div>
		{/if}
	</div>
</PageContainer>
