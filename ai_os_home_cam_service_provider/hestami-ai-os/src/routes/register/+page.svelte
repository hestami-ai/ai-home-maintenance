<script lang="ts">
	import { Mail, Lock, User, Eye, EyeOff, Loader2, Check, X } from 'lucide-svelte';
	import { PageContainer, Card, Logo } from '$lib/components/ui';
	import { signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Password strength checks
	const passwordChecks = $derived({
		minLength: password.length >= 8,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasNumber: /[0-9]/.test(password)
	});

	const passwordStrength = $derived(
		Object.values(passwordChecks).filter(Boolean).length
	);

	const passwordsMatch = $derived(password === confirmPassword && confirmPassword.length > 0);

	const isFormValid = $derived(
		name.trim().length > 0 &&
		email.trim().length > 0 &&
		passwordStrength >= 3 &&
		passwordsMatch
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;

		if (!isFormValid) {
			error = 'Please fill in all fields correctly';
			return;
		}

		isLoading = true;

		try {
			const result = await signUp.email({
				email,
				password,
				name
			});

			if (result.error) {
				error = result.error.message || 'Registration failed. Please try again.';
				isLoading = false;
				return;
			}

			// Redirect to onboarding after successful registration
			goto('/onboarding');
		} catch (err) {
			error = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign Up | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="sm">
	<div class="flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
		<Card variant="outlined" padding="lg" class="w-full">
			<div class="text-center">
				<div class="flex justify-center">
					<Logo size="lg" showText={false} />
				</div>
				<h1 class="mt-4 text-2xl font-bold">Create your account</h1>
				<p class="mt-1 text-sm text-surface-500">Get started with Hestami AI</p>
			</div>

			<form onsubmit={handleSubmit} class="mt-8 space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div class="space-y-4">
					<!-- Name -->
					<div>
						<label for="name" class="block text-sm font-medium">Full Name</label>
						<div class="relative mt-1">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<User class="h-4 w-4 text-surface-400" />
							</div>
							<input
								type="text"
								id="name"
								bind:value={name}
								required
								class="input w-full pl-10"
								placeholder="John Doe"
								disabled={isLoading}
							/>
						</div>
					</div>

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

						<!-- Password strength indicator -->
						{#if password.length > 0}
							<div class="mt-2 space-y-2">
								<div class="flex gap-1">
									{#each [1, 2, 3, 4] as level}
										<div
											class="h-1 flex-1 rounded-full transition-colors
												{passwordStrength >= level
													? passwordStrength >= 3
														? 'bg-success-500'
														: passwordStrength >= 2
															? 'bg-warning-500'
															: 'bg-error-500'
													: 'bg-surface-300'}"
										></div>
									{/each}
								</div>
								<ul class="space-y-1 text-xs">
									<li class="flex items-center gap-1 {passwordChecks.minLength ? 'text-success-500' : 'text-surface-500'}">
										{#if passwordChecks.minLength}<Check class="h-3 w-3" />{:else}<X class="h-3 w-3" />{/if}
										At least 8 characters
									</li>
									<li class="flex items-center gap-1 {passwordChecks.hasUppercase ? 'text-success-500' : 'text-surface-500'}">
										{#if passwordChecks.hasUppercase}<Check class="h-3 w-3" />{:else}<X class="h-3 w-3" />{/if}
										One uppercase letter
									</li>
									<li class="flex items-center gap-1 {passwordChecks.hasLowercase ? 'text-success-500' : 'text-surface-500'}">
										{#if passwordChecks.hasLowercase}<Check class="h-3 w-3" />{:else}<X class="h-3 w-3" />{/if}
										One lowercase letter
									</li>
									<li class="flex items-center gap-1 {passwordChecks.hasNumber ? 'text-success-500' : 'text-surface-500'}">
										{#if passwordChecks.hasNumber}<Check class="h-3 w-3" />{:else}<X class="h-3 w-3" />{/if}
										One number
									</li>
								</ul>
							</div>
						{/if}
					</div>

					<!-- Confirm Password -->
					<div>
						<label for="confirmPassword" class="block text-sm font-medium">Confirm Password</label>
						<div class="relative mt-1">
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
								<Lock class="h-4 w-4 text-surface-400" />
							</div>
							<input
								type={showPassword ? 'text' : 'password'}
								id="confirmPassword"
								bind:value={confirmPassword}
								required
								class="input w-full pl-10"
								placeholder="••••••••"
								disabled={isLoading}
							/>
						</div>
						{#if confirmPassword.length > 0 && !passwordsMatch}
							<p class="mt-1 text-xs text-error-500">Passwords do not match</p>
						{/if}
					</div>
				</div>

				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full py-3"
					disabled={isLoading || !isFormValid}
				>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Creating account...
					{:else}
						Create account
					{/if}
				</button>

				<p class="text-center text-sm text-surface-500">
					Already have an account?
					<a href="/login" class="text-primary-500 hover:underline">Sign in</a>
				</p>
			</form>
		</Card>
	</div>
</PageContainer>
