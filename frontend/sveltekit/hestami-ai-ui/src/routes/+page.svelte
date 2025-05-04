<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
</script>

<div class="flex flex-col min-h-screen">
	<!-- App Bar -->
	<AppBar background="bg-surface-100-800-token" border="border-b border-surface-300-600-token">
		<svelte:fragment slot="lead">
			<a href="/" class="flex items-center gap-2">
				<img src="/logo.svg" alt="Logo" class="w-8 h-8" />
				<h1 class="h3">Hestami AI</h1>
			</a>
		</svelte:fragment>
		
		<svelte:fragment slot="trail">
			<div class="flex items-center gap-4">
				<a href="/login" class="btn preset-filled-primary">Login</a>
			</div>
		</svelte:fragment>
	</AppBar>
	
	<!-- Hero Section -->
	<div class="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
		<h1 class="h1 mb-4">Home Maintenance Made Intelligent</h1>
		<p class="text-xl mb-8 max-w-2xl">Hestami AI helps you manage your home maintenance tasks with the power of artificial intelligence.</p>
		
		<div class="flex flex-col sm:flex-row gap-4">
			<a href="/login" class="btn preset-filled-primary">Get Started</a>
			<a href="#features" class="btn preset-outlined">Learn More</a>
		</div>
	</div>
	
	<!-- Features Section -->
	<section id="features" class="bg-surface-50-900-token py-16">
		<div class="container mx-auto px-4">
			<h2 class="h2 text-center mb-12">Key Features</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div class="card p-6 flex flex-col items-center text-center">
					<div class="bg-primary-500/20 p-4 rounded-full mb-4">
						<!-- Icon would go here -->
					</div>
					<h3 class="h3 mb-2">Smart Scheduling</h3>
					<p>AI-powered maintenance schedules based on your home's specific needs.</p>
				</div>
				
				<div class="card p-6 flex flex-col items-center text-center">
					<div class="bg-secondary-500/20 p-4 rounded-full mb-4">
						<!-- Icon would go here -->
					</div>
					<h3 class="h3 mb-2">Maintenance Tracking</h3>
					<p>Keep track of all your home maintenance tasks in one place.</p>
				</div>
				
				<div class="card p-6 flex flex-col items-center text-center">
					<div class="bg-tertiary-500/20 p-4 rounded-full mb-4">
						<!-- Icon would go here -->
					</div>
					<h3 class="h3 mb-2">Expert Guidance</h3>
					<p>Get AI-powered recommendations for home maintenance issues.</p>
				</div>
			</div>
		</div>
	</section>
	
	<!-- Footer -->
	<footer class="bg-surface-900-50-token text-surface-50-900-token py-8">
		<div class="container mx-auto px-4 text-center">
			<p>© 2025 Hestami AI. All rights reserved.</p>
		</div>
	</footer>
</div>
