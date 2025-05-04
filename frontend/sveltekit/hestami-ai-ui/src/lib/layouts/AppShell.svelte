<script lang="ts">
	import { page } from '$app/stores';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	
	// Import icons
	import Menu from 'lucide-svelte/icons/menu';
	import Home from 'lucide-svelte/icons/home';
	import Settings from 'lucide-svelte/icons/settings';
	import Users from 'lucide-svelte/icons/users';
	import X from 'lucide-svelte/icons/x';
	import LogOut from 'lucide-svelte/icons/log-out';
	import User from 'lucide-svelte/icons/user';
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import ClipboardList from 'lucide-svelte/icons/clipboard-list';
	import ChartArea from 'lucide-svelte/icons/chart-area';
	
	
	
	// Define user data interface for TypeScript
	interface UserData {
		first_name?: string;
		last_name?: string;
		user_role?: string;
		[key: string]: any;
	}
	
	// Define props using Svelte 5 runes syntax
	const { user = null, children } = $props<{ user: UserData | null, children?: any }>();
	
	// Drawer state
	let drawerOpen = $state(false);
	
	// Sidebar collapse state
	let sidebarCollapsed = $state(false);
	
	// Dark mode state - initialize with false for SSR, then update in onMount
	let darkMode = $state(false);
	
	// Function to toggle dark mode
	function toggleDarkMode() {
		darkMode = !darkMode;
		localStorage.setItem('darkMode', darkMode.toString());
		
		// Apply dark mode to document
		if (darkMode) {
			document.documentElement.classList.add('dark');
			document.documentElement.setAttribute('data-mode', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			document.documentElement.setAttribute('data-mode', 'light');
		}
	}
	
	// Initialize dark mode and sidebar state on component mount
	$effect(() => {
		if (browser) {
			// Check if there's a saved preference in localStorage
			const savedMode = localStorage.getItem('darkMode');
			
			// If no saved preference, use the initial HTML attribute
			if (savedMode === null) {
				darkMode = document.documentElement.getAttribute('data-mode') === 'dark';
				// Save this initial state to localStorage
				localStorage.setItem('darkMode', darkMode.toString());
			} else {
				// Use the saved preference
				darkMode = savedMode === 'true';
			}
			
			// Apply the theme
			if (darkMode) {
				document.documentElement.classList.add('dark');
				document.documentElement.setAttribute('data-mode', 'dark');
			} else {
				document.documentElement.classList.remove('dark');
				document.documentElement.setAttribute('data-mode', 'light');
			}
			
			// Load sidebar collapsed state
			const savedSidebarState = localStorage.getItem('sidebarCollapsed');
			if (savedSidebarState !== null) {
				sidebarCollapsed = savedSidebarState === 'true';
			}
		}
	});
	
	// Function to toggle the drawer
	function toggleDrawer() {
		drawerOpen = !drawerOpen;
	}
	
	// Function to toggle sidebar collapse state
	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		// Save preference to localStorage
		if (browser) {
			localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
		}
	}
	
	// Handle logout
	async function handleLogout() {
		try {
			// Use the SvelteKit API proxy instead of direct API calls
			const response = await fetch('/api/users/logout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
				// No need for credentials: 'include' as we're using our own server as proxy
			});
			
			if (!response.ok) {
				console.error('Logout failed with status:', response.status);
			}
			
			// Redirect to home page
			goto('/');
		} catch (error) {
			console.error('Logout error:', error);
			// Still redirect to home page even if logout fails
			goto('/');
		}
	}
	
	// Format user name
	const userName = $derived(user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'User');
	
	// Close drawer when route changes (for mobile)
	$effect(() => {
		if ($page.url.pathname && drawerOpen) {
			drawerOpen = false;
		}
	});
	
	// Determine if user is a property owner
	const isPropertyOwner = $derived(user?.user_role === 'PROPERTY_OWNER');
	
	// Sidebar items with icon names instead of components
	const sidebarItemsArray = $derived([
		{
			name: 'Dashboard',
			iconType: 'chart-area',
			href: '/dashboard',
			active: $page.url.pathname === '/dashboard'
		},
		// Property management for property owners only
		...(isPropertyOwner ? [
			{
				name: 'My Properties',
				iconType: 'home',
				href: '/properties',
				active: $page.url.pathname.startsWith('/properties')
			}
		] : []),
		{
			name: 'Service Requests',
			iconType: 'clipboard',
			href: '/requests',
			active: $page.url.pathname.startsWith('/requests')
		},
		// Admin items for staff users
		...(user?.user_role === 'STAFF' ? [
			{
				name: 'Users',
				iconType: 'users',
				href: '/users',
				active: $page.url.pathname.startsWith('/users')
			}
		] : []),
		// Settings for all users
		{
			name: 'Settings',
			iconType: 'settings',
			href: '/settings',
			active: $page.url.pathname.startsWith('/settings')
		}
	]);
</script>

<div class="flex flex-col h-screen">
	<!-- App Bar -->
	<div class="sticky top-0 z-10 w-full">
		<div class="bg-tertiary-100 dark:bg-tertiary-900/30 border-b border-surface-300-600-token p-3 shadow-md">
			<div class="container mx-auto flex justify-between items-center">
				<!-- Lead section (left side) -->
				<div class="flex items-center gap-3">
					<!-- Mobile menu button -->
					<button class="btn md:hidden" onclick={toggleDrawer}>
						<Menu />
					</button>
					
					<!-- App logo/title -->
					<a href="/" class="flex items-center gap-2">
						<img src="/logo.svg" alt="Logo" class="w-8 h-8" />
						<h1 class="h3">Hestami AI</h1>
					</a>
				</div>
				
				<!-- Trail section (right side) -->
				<div class="flex items-center gap-4">
					<!-- Dark mode toggle -->
					<button 
						class="btn-icon variant-ghost-tertiary" 
						onclick={toggleDarkMode}
						aria-label="Toggle dark mode"
					>
						{#if darkMode}
							<Sun class="h-5 w-5" />
						{:else}
							<Moon class="h-5 w-5" />
						{/if}
					</button>
					
					<!-- User profile section -->
					<div class="flex items-center gap-2">
						<div class="hidden md:flex flex-col items-end">
							<span class="font-semibold">{userName}</span>
							<span class="text-xs text-surface-500-400-token">{user?.user_role || 'Guest'}</span>
						</div>
						
						<button class="btn-icon variant-ghost-tertiary">
							<User />
						</button>
						
						<button class="btn-icon variant-ghost-tertiary" onclick={handleLogout} aria-label="Logout">
							<LogOut />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	
	<!-- Main Content Area with Sidebar -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Desktop Sidebar - always visible on md+ screens -->
		<div class="hidden md:flex flex-col bg-tertiary-100 dark:bg-tertiary-900/30 border-r border-surface-300-600-token transition-all duration-300 ease-in-out" class:w-64={!sidebarCollapsed} class:w-16={sidebarCollapsed}>
			<!-- Sidebar header with collapse toggle -->
			<div class="flex justify-end p-2 border-b border-surface-300-600-token">
				<button 
					class="btn-icon variant-soft-tertiary" 
					onclick={toggleSidebar}
					aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{#if sidebarCollapsed}
						<ChevronRight class="h-5 w-5" />
					{:else}
						<ChevronLeft class="h-5 w-5" />
					{/if}
				</button>
			</div>
			
			<nav class="p-2 space-y-2 flex-1">
				{#each sidebarItemsArray as item}
					<a 
						href={item.href} 
						class="flex items-center gap-3 p-3 rounded-container-token {item.active ? 'bg-tertiary-500/20 text-tertiary-700 dark:text-tertiary-200' : 'hover:bg-tertiary-300/20 dark:hover:bg-tertiary-700/30 hover:text-tertiary-800 dark:hover:text-tertiary-200'}"
						title={sidebarCollapsed ? item.name : ''}
					>
						<div class="flex-shrink-0">
							{#if item.iconType === 'home'}
								<Home />
							{:else if item.iconType === 'users'}
								<Users />
							{:else if item.iconType === 'settings'}
								<Settings />
							{:else if item.iconType === 'clipboard'}
								<ClipboardList />
							{:else if item.iconType === 'chart-area'}
								<ChartArea />
							{/if}
						</div>
						{#if !sidebarCollapsed}
							<span class="truncate">{item.name}</span>
						{/if}
					</a>
				{/each}
			</nav>
		</div>
		
		<!-- Mobile Drawer - only visible when toggled -->
		{#if drawerOpen}
			<button type="button" class="fixed inset-0 bg-black/50 z-40" onclick={toggleDrawer} aria-label="Close menu"></button>
			<div class="fixed top-0 left-0 bottom-0 w-64 bg-tertiary-100 dark:bg-tertiary-900/30 z-50 shadow-xl">
				<div class="p-4 flex justify-between items-center border-b border-surface-300-600-token">
					<h2 class="h3">Menu</h2>
					<button class="btn-icon variant-soft-tertiary" onclick={toggleDrawer}>
						<X />
					</button>
				</div>
				
				<nav class="p-4 space-y-4">
					{#each sidebarItemsArray as item}
						<a 
							href={item.href} 
							class="flex items-center gap-3 p-3 rounded-container-token {item.active ? 'bg-tertiary-500/20 text-tertiary-700 dark:text-tertiary-200' : 'hover:bg-tertiary-300/20 dark:hover:bg-tertiary-700/30 hover:text-tertiary-800 dark:hover:text-tertiary-200'}"
						>
							{#if item.iconType === 'home'}
								<Home />
							{:else if item.iconType === 'users'}
								<Users />
							{:else if item.iconType === 'settings'}
								<Settings />
							{:else if item.iconType === 'clipboard'}
								<ClipboardList />
							{/if}
							<span>{item.name}</span>
						</a>
					{/each}
				</nav>
			</div>
		{/if}
		
		<!-- Main Content -->
		<main class="flex-1 overflow-auto p-4 transition-all duration-300 ease-in-out">
			<!-- Main content -->
			{@render children?.()}
		</main>
	</div>
</div>
