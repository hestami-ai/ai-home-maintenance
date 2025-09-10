<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { goto } from '$app/navigation';
	
	// Form state
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let phoneNumber = $state('');
	let userRole = $state('homeowner'); // Default role
	let isLoading = $state(false);
	let errorMessage = $state('');
	
	// Form validation
	let passwordsMatch = $derived(password === confirmPassword || confirmPassword === '');
	let formValid = $derived(
		email && 
		password && 
		confirmPassword && 
		firstName && 
		lastName && 
		phoneNumber && 
		userRole && 
		passwordsMatch
	);
	
	// Form submission
	async function handleSubmit() {
		isLoading = true;
		errorMessage = '';
		
		if (!passwordsMatch) {
			errorMessage = 'Passwords do not match';
			isLoading = false;
			return;
		}
		
		try {
			// Use the SvelteKit API proxy instead of direct API calls
			const response = await fetch('/api/users/register/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					email, 
					password,
					confirm_password: confirmPassword,
					first_name: firstName,
					last_name: lastName,
					phone_number: phoneNumber,
					user_role: userRole,
					service_provider: null // Not required for registration
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				// Handle different types of errors
				if (errorData.email) {
					errorMessage = errorData.email[0];
				} else if (errorData.password) {
					errorMessage = errorData.password[0];
				} else if (errorData.error) {
					errorMessage = errorData.error;
				} else {
					errorMessage = 'Registration failed. Please try again.';
				}
				return;
			}
			
			// Registration successful, redirect to login
			goto('/login?registered=true');
		} catch (error) {
			console.error('Registration error:', error);
			errorMessage = 'An error occurred during registration';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Account - Hestami AI</title>
	<meta name="description" content="Sign up for a new Hestami AI account" />
</svelte:head>

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
	
	<!-- Registration Form -->
	<div class="flex-1 container mx-auto flex items-center justify-center p-4">
		<div class="card p-8 w-full max-w-md bg-surface-50-900-token">
			<header class="text-center mb-8">
				<h2 class="h2">Create Account</h2>
				<p class="text-surface-600-300-token">Sign up for a new account</p>
			</header>
			
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
				{#if errorMessage}
					<div class="alert variant-filled-error">
						<span>{errorMessage}</span>
					</div>
				{/if}
				
				<!-- Name fields (side by side) -->
				<div class="grid grid-cols-2 gap-4">
					<label class="label">
						<span>First Name</span>
						<input 
							type="text" 
							placeholder="John" 
							class="input" 
							required 
							bind:value={firstName}
						/>
					</label>
					
					<label class="label">
						<span>Last Name</span>
						<input 
							type="text" 
							placeholder="Doe" 
							class="input" 
							required 
							bind:value={lastName}
						/>
					</label>
				</div>
				
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
					<span>Phone Number</span>
					<input 
						type="tel" 
						placeholder="(123) 456-7890" 
						class="input" 
						required
						bind:value={phoneNumber}
					/>
				</label>
				
				<label class="label">
					<span>I am a</span>
					<select class="select" bind:value={userRole} required>
						<option value="PROPERTY_OWNER">Property Owner</option>
						<option value="SERVICE_PROVIDER">Service Provider</option>
					</select>
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
				
				<label class="label">
					<span>Confirm Password</span>
					<input 
						type="password" 
						placeholder="********" 
						class="input" 
						required 
						class:input-error={!passwordsMatch && confirmPassword !== ''}
						bind:value={confirmPassword}
					/>
					{#if !passwordsMatch && confirmPassword !== ''}
						<p class="text-error-500 text-sm mt-1">Passwords do not match</p>
					{/if}
				</label>
				
				<button type="submit" class="btn preset-filled-primary w-full" disabled={isLoading || !formValid}>
					{#if isLoading}
						Creating account...
					{:else}
						Create Account
					{/if}
				</button>
			</form>
			
			<div class="mt-6 text-center">
				<p>Already have an account? <a href="/login" class="anchor">Sign in</a></p>
			</div>
		</div>
	</div>
	
	<!-- Footer -->
	<footer class="py-4 text-center text-surface-600-300-token">
		<p>© 2025 Hestami AI. All rights reserved.</p>
	</footer>
</div>
