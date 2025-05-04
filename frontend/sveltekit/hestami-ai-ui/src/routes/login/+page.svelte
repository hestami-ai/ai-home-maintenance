<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	
	// Form state
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');
	
	// Form submission
	async function handleSubmit() {
		isLoading = true;
		errorMessage = '';
		
		try {
			// Use the SvelteKit API proxy instead of direct API calls
			const response = await fetch('/api/users/login/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
				// No need for credentials: 'include' as we're using our own server as proxy
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				errorMessage = errorData.error || 'Invalid email or password';
				return;
			}
			
			// Check if there's a returnUrl in the query parameters
			const returnUrl = $page.url.searchParams.get('returnUrl');
			
			// Redirect to the returnUrl if it exists, otherwise go to dashboard
			if (returnUrl) {
				goto(returnUrl);
			} else {
				goto('/dashboard');
			}
		} catch (error) {
			console.error('Login error:', error);
			errorMessage = 'An error occurred during login';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex flex-col min-h-screen">
	<!-- App Bar -->
	<AppBar background="bg-surface-100-800-token" border="border-b border-surface-300-600-token">
		<!-- Use div with slot attribute instead of svelte:fragment -->
		<div slot="lead">
			<a href="/" class="flex items-center gap-2">
				<img src="/logo.svg" alt="Logo" class="w-8 h-8" />
				<h1 class="h3">Hestami AI</h1>
			</a>
		</div>
	</AppBar>
	
	<!-- Login Form -->
	<div class="flex-1 container mx-auto flex items-center justify-center p-4">
		<div class="card p-8 w-full max-w-md bg-surface-50-900-token">
			<header class="text-center mb-8">
				<h2 class="h2">Login</h2>
				<p class="text-surface-600-300-token">Sign in to your account</p>
			</header>
			
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
				{#if errorMessage}
					<div class="alert variant-filled-error">
						<span>{errorMessage}</span>
					</div>
				{/if}
				<label class="label">
					<span>Email</span>
					<input 
						type="email" 
						placeholder="your@email.com" 
						class="input" 
						required 
						bind:value={email}
					/>
				</label>
				
				<label class="label">
					<span>Password</span>
					<input 
						type="password" 
						placeholder="********" 
						class="input" 
						required 
						bind:value={password}
					/>
				</label>
				
				<div class="flex items-center justify-between">
					<label class="flex items-center space-x-2">
						<input 
							type="checkbox" 
							class="checkbox" 
							bind:checked={rememberMe}
						/>
						<span>Remember me</span>
					</label>
					
					<a href="/forgot-password" class="anchor">Forgot password?</a>
				</div>
				
				<button type="submit" class="btn preset-filled-primary w-full" disabled={isLoading}>
					{#if isLoading}
						Signing in...
					{:else}
						Sign In
					{/if}
				</button>
			</form>
			
			<div class="mt-6 text-center">
				<p>Don't have an account? <a href="/register" class="anchor">Sign up</a></p>
			</div>
		</div>
	</div>
	
	<!-- Footer -->
	<footer class="py-4 text-center text-surface-600-300-token">
		<p>© 2025 Hestami AI. All rights reserved.</p>
	</footer>
</div>
