<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { AlertTriangle, RefreshCw } from 'lucide-svelte';
	
	// Get error type from URL
	$: errorType = $page.url.searchParams.get('type') || 'unknown';
	
	// Error messages based on type
	const errorMessages = {
		server: {
			title: 'Server Connection Error',
			message: 'We\'re having trouble connecting to our servers. This might be a temporary issue.',
			action: 'Try Again'
		},
		auth: {
			title: 'Authentication Error',
			message: 'Your session has expired or is invalid. Please log in again.',
			action: 'Log In'
		},
		unknown: {
			title: 'Something Went Wrong',
			message: 'An unexpected error occurred. Please try again later.',
			action: 'Go Home'
		}
	};
	
	// Get error details based on type
	$: error = errorMessages[errorType as keyof typeof errorMessages] || errorMessages.unknown;
	
	// Handle action button click
	function handleAction() {
		if (errorType === 'auth') {
			goto('/login');
		} else if (errorType === 'server') {
			window.location.reload();
		} else {
			goto('/');
		}
	}
</script>

<div class="container mx-auto p-4 flex items-center justify-center min-h-[70vh]">
	<div class="card p-8 max-w-md w-full text-center space-y-6">
		<div class="flex justify-center">
			<AlertTriangle class="h-16 w-16 text-warning-500" />
		</div>
		
		<h1 class="h2">{error.title}</h1>
		
		<p class="text-surface-600-300-token">{error.message}</p>
		
		<div class="flex justify-center pt-4">
			<button on:click={handleAction} class="btn variant-filled-primary">
				<RefreshCw class="h-4 w-4 mr-2" />
				{error.action}
			</button>
		</div>
	</div>
</div>
