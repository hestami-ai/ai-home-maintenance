<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Bell, CalendarClock, Shield } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Hestami AI - Home Maintenance Made Intelligent</title>
	<meta name="description" content="Hestami AI helps you manage your home maintenance tasks with the power of artificial intelligence." />
</svelte:head>

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
	<div class="relative bg-surface-900-50-token">
		<!-- Hero Background Image -->
		<div class="absolute inset-0 overflow-hidden">
			<img 
				src="https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?q=80&w=2070" 
				alt="Modern home interior" 
				class="w-full h-full object-cover opacity-20"
			/>
			<div class="absolute inset-0 bg-gradient-to-r from-primary-900/50 to-tertiary-900/50"></div>
		</div>

		<!-- Hero Content -->
		<div class="relative container mx-auto px-4 py-24 md:py-32 flex flex-col items-center justify-center text-center">
			<h1 class="h1 mb-6 text-white text-4xl md:text-5xl lg:text-6xl font-bold">Home Maintenance Made Intelligent</h1>
			<p class="text-xl mb-10 max-w-2xl text-white/90">Hestami AI helps you manage your home maintenance tasks with the power of artificial intelligence.</p>
			
			<div class="flex flex-col sm:flex-row gap-6">
				<a href="/login" class="btn preset-filled-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold flex items-center justify-center gap-2">
					<span>Get Started</span>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" class="bi bi-arrow-right">
						<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
					</svg>
				</a>
				<a href="#features" class="btn variant-ringed-surface text-lg px-8 py-4 text-white hover:variant-filled-surface hover:scale-105 transition-all duration-300 font-semibold">Learn More</a>
			</div>
		</div>
	</div>
	
	<!-- Features Section -->
	<section id="features" class="bg-surface-50-900-token py-16">
		<div class="container mx-auto px-4">
			<h2 class="h2 text-center mb-12">Key Features</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div class="card p-8 flex flex-col items-center text-center hover:variant-soft-primary transition-all duration-200">
					<div class="mb-6 bg-primary-500/15 p-6 rounded-full">
						<Bell size={48} class="text-primary-500" strokeWidth={1.5} />
					</div>
					<h3 class="h3 mb-4">Proactive Maintenance Alerts</h3>
					<p class="text-lg">Receive notifications when it's time to service your HVAC system, check your roof, or replace your water heater anode rod.</p>
				</div>
				
				<div class="card p-8 flex flex-col items-center text-center hover:variant-soft-secondary transition-all duration-200">
					<div class="mb-6 bg-secondary-500/15 p-6 rounded-full">
						<CalendarClock size={48} class="text-secondary-500" strokeWidth={1.5} />
					</div>
					<h3 class="h3 mb-4">Seamless Contractor Coordination</h3>
					<p class="text-lg">We match you with pre-vetted, reliable contractors for any maintenance or repair task - centered around your schedule.</p>
				</div>
				
				<div class="card p-8 flex flex-col items-center text-center hover:variant-soft-tertiary transition-all duration-200">
					<div class="mb-6 bg-tertiary-500/15 p-6 rounded-full">
						<Shield size={48} class="text-tertiary-500" strokeWidth={1.5} />
					</div>
					<h3 class="h3 mb-4">Peace of Mind</h3>
					<p class="text-lg">Know that your home is in good hands, with technology working behind the scenes to keep everything running smoothly.</p>
				</div>
			</div>
		</div>
	</section>
	
	<!-- Call to Action Section -->
	<section class="py-16 bg-primary-900/10">
		<div class="container mx-auto px-4 text-center">
			<div class="max-w-3xl mx-auto">
				<h2 class="h2 mb-6">Ready to simplify your home maintenance?</h2>
				<p class="text-lg mb-8">Join homeowners who trust Hestami AI to keep their homes in perfect condition.</p>
				<div class="flex justify-center">
					<a href="/login" class="btn preset-filled-primary text-lg px-10 py-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold flex items-center justify-center gap-2">
						<span>Get Started Today</span>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" class="bi bi-arrow-right">
							<path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
						</svg>
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-surface-900-50-token text-surface-50-900-token py-8">
		<div class="container mx-auto px-4 text-center">
			<div class="flex justify-center items-center gap-2 mb-4">
				<img src="/logo.svg" alt="Logo" class="w-6 h-6" />
				<h3 class="h4">Hestami AI</h3>
			</div>
			<p>© 2025 Hestami AI. All rights reserved.</p>
		</div>
	</footer>
</div>
