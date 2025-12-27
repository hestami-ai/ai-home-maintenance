<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
</script>

<svelte:head>
	<title>Account Pending | Hestami AI</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-50-950 p-4">
	<Card variant="outlined" class="w-full max-w-md p-8 text-center">
		<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
			<Loader2 class="h-8 w-8 animate-spin" />
		</div>
		
		<h1 class="text-2xl font-bold">Account Pending Approval</h1>
		
		<div class="mt-4 space-y-4 text-surface-500">
			<p>
				Your Hestami staff account has been registered but is pending administrator approval and configuration.
			</p>
			<p>
				Please contact your manager or system administrator to complete your onboarding process.
			</p>
			<p class="text-sm">
				Once approved, you will receive an invitation with an activation code.
			</p>
		</div>

		<div class="mt-8 border-t border-surface-200-800 pt-6">
			<a href="/login" class="text-sm font-medium text-primary-500 hover:text-primary-600 hover:underline">
				Return to Login
			</a>
		</div>
	</Card>
</div>
