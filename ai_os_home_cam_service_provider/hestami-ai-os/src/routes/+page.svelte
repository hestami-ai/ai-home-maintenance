<script lang="ts">
	import { Home, Building2, Wrench, ArrowRight } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { auth } from '$lib/stores';
</script>

<PageContainer>
	<div class="py-12 sm:py-20">
		<!-- Hero Section -->
		<div class="text-center">
			<h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
				<span class="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
					Hestami AI
				</span>
			</h1>
			<p class="mx-auto mt-4 max-w-2xl text-lg text-surface-600 dark:text-surface-400">
				The intelligent operating system for property management, community associations, and service providers.
			</p>
			<div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
				{#if $auth.isAuthenticated}
					<a href="/app" class="btn preset-filled-primary-500 px-8 py-3">
						Go to Dashboard
						<ArrowRight class="ml-2 h-4 w-4" />
					</a>
				{:else}
					<a href="/register" class="btn preset-filled-primary-500 px-8 py-3">
						Get Started
						<ArrowRight class="ml-2 h-4 w-4" />
					</a>
					<a href="/login" class="btn preset-tonal-surface px-8 py-3">
						Sign In
					</a>
				{/if}
			</div>
		</div>

		<!-- Features Section -->
		<div class="mt-20">
			<h2 class="text-center text-2xl font-semibold">Built for Everyone in the Property Ecosystem</h2>
			<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<!-- Property Owners -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500/10">
							<Home class="h-6 w-6 text-secondary-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">Property Owners</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Manage your property, find trusted service providers, and track maintenance with AI-powered assistance.
						</p>
					</div>
				</Card>

				<!-- Community Associations -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
							<Building2 class="h-6 w-6 text-primary-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">HOAs & Communities</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Streamline governance, compliance, and community management with powerful tools and automation.
						</p>
					</div>
				</Card>

				<!-- Service Providers -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10">
							<Wrench class="h-6 w-6 text-success-500" />
						</div>
						<h3 class="mt-4 text-lg font-semibold">Service Providers</h3>
						<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							Run your contracting business efficiently with job management, scheduling, and invoicing.
						</p>
					</div>
				</Card>
			</div>
		</div>
	</div>
</PageContainer>
