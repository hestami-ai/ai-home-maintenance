<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Bell, X, Check } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { apiGet, apiPatch } from '$lib/client/api';
	
	interface Notification {
		id: string;
		title: string;
		message: string;
		notification_type: string;
		is_read: boolean;
		created_at: string;
		related_object_type?: string;
		related_object_id?: string;
	}
	
	// State
	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let isOpen = $state(false);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let pollInterval: number | null = null;
	
	// Fetch notifications
	async function fetchNotifications() {
		try {
			isLoading = true;
			error = null;
			
			const data = await apiGet<{ results: Notification[]; unread_count: number }>(
				'/api/notifications/'
			);
			
			notifications = data.results || [];
			unreadCount = data.unread_count || 0;
		} catch (err) {
			console.error('Error fetching notifications:', err);
			error = err instanceof Error ? err.message : 'Failed to load notifications';
		} finally {
			isLoading = false;
		}
	}
	
	// Mark notification as read
	async function markAsRead(notificationId: string) {
		try {
			await apiPatch(`/api/notifications/${notificationId}/`, { is_read: true });
			
			// Update local state
			notifications = notifications.map(n =>
				n.id === notificationId ? { ...n, is_read: true } : n
			);
			unreadCount = Math.max(0, unreadCount - 1);
		} catch (err) {
			console.error('Error marking notification as read:', err);
		}
	}
	
	// Mark all as read
	async function markAllAsRead() {
		try {
			await apiPatch('/api/notifications/mark-all-read/', {});
			
			// Update local state
			notifications = notifications.map(n => ({ ...n, is_read: true }));
			unreadCount = 0;
		} catch (err) {
			console.error('Error marking all as read:', err);
		}
	}
	
	// Toggle dropdown
	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen && notifications.length === 0) {
			fetchNotifications();
		}
	}
	
	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.notification-bell-container')) {
			isOpen = false;
		}
	}
	
	// Get notification link
	function getNotificationLink(notification: Notification): string {
		if (notification.related_object_type === 'service_request' && notification.related_object_id) {
			return `/staff/requests/${notification.related_object_id}`;
		}
		return '#';
	}
	
	// Handle notification click
	function handleNotificationClick(notification: Notification) {
		if (!notification.is_read) {
			markAsRead(notification.id);
		}
		isOpen = false;
	}
	
	// Format time
	function formatTime(dateString: string): string {
		try {
			return formatDistanceToNow(new Date(dateString), { addSuffix: true });
		} catch {
			return 'recently';
		}
	}
	
	// Get notification icon color
	function getNotificationColor(type: string): string {
		switch (type) {
			case 'bid_received':
				return 'text-success-500';
			case 'deadline_approaching':
				return 'text-warning-500';
			case 'assignment':
				return 'text-primary-500';
			case 'status_change':
				return 'text-secondary-500';
			default:
				return 'text-surface-500';
		}
	}
	
	// Lifecycle
	onMount(() => {
		// Initial fetch
		fetchNotifications();
		
		// Poll every 30 seconds
		pollInterval = window.setInterval(fetchNotifications, 30000);
		
		// Add click outside listener
		document.addEventListener('click', handleClickOutside);
	});
	
	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="notification-bell-container relative">
	<!-- Bell Button -->
	<button
		class="btn-icon variant-ghost-surface relative"
		onclick={toggleDropdown}
		aria-label="Notifications"
	>
		<Bell class="h-5 w-5" />
		{#if unreadCount > 0}
			<span class="badge-icon variant-filled-error absolute -top-1 -right-1 text-xs">
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>
	
	<!-- Dropdown -->
	{#if isOpen}
		<div class="card absolute right-0 mt-2 w-96 max-h-[32rem] overflow-hidden shadow-xl z-50">
			<!-- Header -->
			<div class="p-4 border-b border-surface-300-600-token flex justify-between items-center">
				<h3 class="font-semibold">Notifications</h3>
				{#if unreadCount > 0}
					<button
						class="btn btn-sm variant-ghost-primary"
						onclick={markAllAsRead}
					>
						<Check class="h-4 w-4 mr-1" />
						Mark all read
					</button>
				{/if}
			</div>
			
			<!-- Notifications List -->
			<div class="overflow-y-auto max-h-[28rem]">
				{#if isLoading}
					<div class="p-8 text-center">
						<div class="loading loading-spinner loading-md"></div>
					</div>
				{:else if error}
					<div class="p-4 text-center text-error-500">
						{error}
					</div>
				{:else if notifications.length === 0}
					<div class="p-8 text-center text-surface-600-300-token">
						<Bell class="h-12 w-12 mx-auto mb-2 opacity-50" />
						<p>No notifications</p>
					</div>
				{:else}
					{#each notifications as notification}
						<a
							href={getNotificationLink(notification)}
							class="block p-4 hover:bg-surface-100-800-token transition-colors border-b border-surface-200-700-token {!notification.is_read ? 'bg-primary-50 dark:bg-primary-900/10' : ''}"
							onclick={() => handleNotificationClick(notification)}
						>
							<div class="flex items-start gap-3">
								<div class="flex-shrink-0 mt-1">
									<Bell class="h-4 w-4 {getNotificationColor(notification.notification_type)}" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-start justify-between gap-2">
										<p class="font-semibold text-sm {!notification.is_read ? 'text-primary-700 dark:text-primary-300' : ''}">
											{notification.title}
										</p>
										{#if !notification.is_read}
											<span class="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-1"></span>
										{/if}
									</div>
									<p class="text-sm text-surface-600-300-token mt-1">
										{notification.message}
									</p>
									<p class="text-xs text-surface-500-400-token mt-1">
										{formatTime(notification.created_at)}
									</p>
								</div>
							</div>
						</a>
					{/each}
				{/if}
			</div>
			
			<!-- Footer -->
			{#if notifications.length > 0}
				<div class="p-2 border-t border-surface-300-600-token text-center">
					<a href="/staff/notifications" class="btn btn-sm variant-ghost-primary w-full">
						View All Notifications
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.badge-icon {
		min-width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		padding: 0 0.25rem;
		font-size: 0.625rem;
		font-weight: 600;
	}
</style>
