<script lang="ts">
	import { page } from '$app/stores';
	import { Save } from 'lucide-svelte';
	
	// User profile settings
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phoneNumber = $state('');
	
	// Notification settings
	let emailNotifications = $state(true);
	let smsNotifications = $state(false);
	let pushNotifications = $state(true);
	
	// Initialize form with user data if available
	$effect(() => {
		if ($page.data.user) {
			firstName = $page.data.user.first_name || '';
			lastName = $page.data.user.last_name || '';
			email = $page.data.user.email || '';
			phoneNumber = $page.data.user.phone_number || '';
		}
	});
	
	// Handle profile update
	function updateProfile() {
		// In a real app, this would call an API to update the user profile
		console.log('Profile updated', { firstName, lastName, email, phoneNumber });
		// Show success message
		alert('Profile updated successfully');
	}
	
	// Handle notification settings update
	function updateNotificationSettings() {
		// In a real app, this would call an API to update notification settings
		console.log('Notification settings updated', { 
			emailNotifications, 
			smsNotifications, 
			pushNotifications 
		});
		// Show success message
		alert('Notification settings updated successfully');
	}
</script>

<svelte:head>
	<title>Settings - Hestami AI</title>
	<meta name="description" content="Manage your account settings and preferences" />
</svelte:head>

<div class="container mx-auto p-4 space-y-8">
	<header>
		<h1 class="h1">Settings</h1>
		<p class="text-surface-600-300-token">Manage your account settings and preferences</p>
	</header>
	
	<!-- Profile Settings -->
	<div class="card p-6">
		<h2 class="h3 mb-4">Profile Information</h2>
		
		<form onsubmit={(e) => { e.preventDefault(); updateProfile(); }} class="space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- First Name -->
				<div class="form-field">
					<label class="label" for="first-name">
						<span>First Name</span>
					</label>
					<input
						id="first-name"
						class="input"
						type="text"
						bind:value={firstName}
						placeholder="Enter your first name"
					/>
				</div>
				
				<!-- Last Name -->
				<div class="form-field">
					<label class="label" for="last-name">
						<span>Last Name</span>
					</label>
					<input
						id="last-name"
						class="input"
						type="text"
						bind:value={lastName}
						placeholder="Enter your last name"
					/>
				</div>
			</div>
			
			<!-- Email -->
			<div class="form-field">
				<label class="label" for="email">
					<span>Email</span>
				</label>
				<input
					id="email"
					class="input"
					type="email"
					bind:value={email}
					placeholder="Enter your email"
					readonly
				/>
				<p class="text-sm text-surface-600-300-token mt-1">Email cannot be changed. Contact support for assistance.</p>
			</div>
			
			<!-- Phone Number -->
			<div class="form-field">
				<label class="label" for="phone-number">
					<span>Phone Number</span>
				</label>
				<input
					id="phone-number"
					class="input"
					type="tel"
					bind:value={phoneNumber}
					placeholder="Enter your phone number"
				/>
			</div>
			
			<!-- Submit Button -->
			<div class="flex justify-end mt-6">
				<button type="submit" class="btn variant-filled-primary">
					<Save class="h-5 w-5 mr-2" />
					Save Changes
				</button>
			</div>
		</form>
	</div>
	
	<!-- Notification Settings -->
	<div class="card p-6">
		<h2 class="h3 mb-4">Notification Settings</h2>
		
		<form onsubmit={(e) => { e.preventDefault(); updateNotificationSettings(); }} class="space-y-4">
			<!-- Email Notifications -->
			<div class="form-field">
				<label class="label flex items-center space-x-2">
					<input
						type="checkbox"
						bind:checked={emailNotifications}
						class="checkbox"
					/>
					<span>Email Notifications</span>
				</label>
				<p class="text-sm text-surface-600-300-token ml-6 mt-1">
					Receive notifications about service requests, updates, and important announcements via email.
				</p>
			</div>
			
			<!-- SMS Notifications -->
			<div class="form-field">
				<label class="label flex items-center space-x-2">
					<input
						type="checkbox"
						bind:checked={smsNotifications}
						class="checkbox"
					/>
					<span>SMS Notifications</span>
				</label>
				<p class="text-sm text-surface-600-300-token ml-6 mt-1">
					Receive text message alerts for urgent updates and service request status changes.
				</p>
			</div>
			
			<!-- Push Notifications -->
			<div class="form-field">
				<label class="label flex items-center space-x-2">
					<input
						type="checkbox"
						bind:checked={pushNotifications}
						class="checkbox"
					/>
					<span>Push Notifications</span>
				</label>
				<p class="text-sm text-surface-600-300-token ml-6 mt-1">
					Receive browser notifications when using the web application.
				</p>
			</div>
			
			<!-- Submit Button -->
			<div class="flex justify-end mt-6">
				<button type="submit" class="btn variant-filled-primary">
					<Save class="h-5 w-5 mr-2" />
					Save Preferences
				</button>
			</div>
		</form>
	</div>
	
	<!-- Password Settings -->
	<div class="card p-6">
		<h2 class="h3 mb-4">Security Settings</h2>
		
		<div class="space-y-4">
			<p class="text-surface-600-300-token">
				Manage your password and security settings.
			</p>
			
			<a href="/settings/password" class="btn variant-soft">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
					<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
				</svg>
				Change Password
			</a>
		</div>
	</div>
</div>
