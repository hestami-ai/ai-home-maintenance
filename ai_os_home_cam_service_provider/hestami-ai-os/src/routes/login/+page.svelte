<script lang="ts">
	import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-svelte';
	import { PageContainer, Card, Logo } from '$lib/components/ui';
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		isLoading = true;

		try {
			const result = await signIn.email({
				email,
				password
			});

			if (result.error) {
				error = result.error.message || 'Invalid email or password';
				isLoading = false;
				return;
			}

			// Redirect to app or onboarding based on user state
			// For now, redirect to home which will handle the routing
			goto('/');
		} catch (err) {
			error = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="sm">
	<div class="flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
		<Card variant="outlined" padding="lg" class="w-full">
			<div class="text-center">
				<div class="flex justify-center">
					<Logo size="lg" showText={false} />
				</div>
				<h1 class="mt-4 text-2xl font-bold">Welcome back</h1>
				<p class="mt-1 text-sm text-surface-500">Sign in to your account</p>
			</div>

			<form onsubmit={handleSubmit} class="mt-8 space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div class="space-y-4">
					<!-- Email -->
					<div>
						<label for="email" class="block text-sm font-medium">Email</label>
						<div class="relative mt-1">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<Mail class="h-4 w-4 text-surface-400" />
							</div>
							<input
								type="email"
								id="email"
								bind:value={email}
								required
								class="input w-full pl-10"
								placeholder="you@example.com"
								disabled={isLoading}
							/>
						</div>
					</div>

					<!-- Password -->
					<div>
						<label for="password" class="block text-sm font-medium">Password</label>
						<div class="relative mt-1">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<Lock class="h-4 w-4 text-surface-400" />
							</div>
							<input
								type={showPassword ? 'text' : 'password'}
								id="password"
								bind:value={password}
								required
								class="input w-full pl-10 pr-10"
								placeholder="••••••••"
								disabled={isLoading}
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute inset-y-0 right-0 flex items-center pr-3"
								tabindex={-1}
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4 text-surface-400" />
								{:else}
									<Eye class="h-4 w-4 text-surface-400" />
								{/if}
							</button>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2">
						<input type="checkbox" class="checkbox" />
						<span class="text-sm">Remember me</span>
					</label>
					<a href="/forgot-password" class="text-sm text-primary-500 hover:underline">
						Forgot password?
					</a>
				</div>

				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full py-3"
					disabled={isLoading}
				>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Signing in...
					{:else}
						Sign in
					{/if}
				</button>

				<p class="text-center text-sm text-surface-500">
					Don't have an account?
					<a href="/register" class="text-primary-500 hover:underline">Sign up</a>
				</p>
			</form>
		</Card>
	</div>
</PageContainer>
