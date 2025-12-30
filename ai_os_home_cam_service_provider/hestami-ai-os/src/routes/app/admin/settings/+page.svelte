<script lang="ts">
	import {
		Settings,
		Bell,
		Globe,
		Database,
		Shield,
		Building2,
		ToggleLeft,
		Clock,
		FileText,
		CheckCircle,
		XCircle,
		AlertTriangle
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';

	// Tab state
	type TabId = 'platform' | 'organization' | 'notifications' | 'integrations' | 'security' | 'data';
	let activeTab = $state<TabId>('platform');

	const tabs = [
		{ id: 'platform' as TabId, label: 'Platform', icon: Settings },
		{ id: 'organization' as TabId, label: 'Organization', icon: Building2 },
		{ id: 'notifications' as TabId, label: 'Notifications', icon: Bell },
		{ id: 'integrations' as TabId, label: 'Integrations', icon: Globe },
		{ id: 'security' as TabId, label: 'Security', icon: Shield },
		{ id: 'data' as TabId, label: 'Data', icon: Database }
	];

	// Mock platform settings (read-only display for Phase 22.1)
	const platformSettings = {
		general: {
			platformName: 'Hestami AI',
			supportEmail: 'support@hestami.ai',
			supportPhone: '+1 (555) 123-4567',
			defaultTimezone: 'America/New_York',
			defaultLanguage: 'en-US'
		},
		limits: {
			maxFileSize: 100, // MB
			sessionTimeout: 30, // minutes
			apiRateLimit: 1000, // requests per minute
			maxConcurrentSessions: 5
		}
	};

	// Mock feature flags
	const featureFlags = [
		{ id: 'ai_assistance', name: 'AI Assistance', description: 'Enable AI-powered features', enabled: true },
		{ id: 'vendor_discovery', name: 'Vendor Discovery', description: 'Automated vendor discovery', enabled: true },
		{ id: 'document_ocr', name: 'Document OCR', description: 'Document text extraction', enabled: false },
		{ id: 'beta_features', name: 'Beta Features', description: 'Enable beta feature access', enabled: false }
	];

	// Mock integrations
	const integrations = [
		{ id: 'stripe', name: 'Stripe', description: 'Payment processing', status: 'connected' },
		{ id: 'sendgrid', name: 'SendGrid', description: 'Email delivery', status: 'connected' },
		{ id: 'twilio', name: 'Twilio', description: 'SMS delivery', status: 'disconnected' },
		{ id: 'aws_s3', name: 'AWS S3', description: 'File storage', status: 'connected' },
		{ id: 'openai', name: 'OpenAI', description: 'AI services', status: 'connected' },
		{ id: 'signoz', name: 'SigNoz', description: 'Observability', status: 'connected' }
	];

	// Mock security settings
	const securitySettings = {
		authentication: {
			passwordMinLength: 12,
			passwordComplexity: true,
			passwordExpiry: 90, // days, 0 = never
			twoFactorRequired: false,
			twoFactorMethods: ['TOTP', 'Email']
		},
		session: {
			sessionDuration: 8, // hours
			idleTimeout: 30, // minutes
			concurrentSessions: 5,
			rememberMeDuration: 30 // days
		},
		access: {
			ipAllowlist: [],
			failedLoginLockout: 5,
			lockoutDuration: 15 // minutes
		}
	};

	// Mock data retention
	const dataRetention = [
		{ type: 'Activity Logs', retention: '365 days', description: 'User activity events' },
		{ type: 'Audit Logs', retention: '7 years', description: 'Compliance audit trail' },
		{ type: 'Deleted Records', retention: '90 days', description: 'Soft-deleted data' },
		{ type: 'Session Data', retention: '30 days', description: 'Login sessions' },
		{ type: 'Temp Files', retention: '7 days', description: 'Uploaded temp files' }
	];

	function getStatusIcon(status: string) {
		switch (status) {
			case 'connected': return CheckCircle;
			case 'disconnected': return XCircle;
			default: return AlertTriangle;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'connected': return 'text-success-500';
			case 'disconnected': return 'text-surface-400';
			default: return 'text-warning-500';
		}
	}
</script>

<svelte:head>
	<title>Settings | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">System Settings</h1>
				<p class="mt-1 text-surface-500">
					Configure platform-wide settings and preferences
				</p>
			</div>
		</div>

		<!-- Tabs -->
		<div class="mt-6 border-b border-surface-300-700">
			<nav class="flex gap-4 overflow-x-auto">
				{#each tabs as tab}
					<button
						onclick={() => (activeTab = tab.id)}
						class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap {activeTab === tab.id
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}"
					>
						<tab.icon class="h-4 w-4" />
						{tab.label}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Content -->
		<div class="mt-6">
			{#if activeTab === 'platform'}
				<!-- Platform Settings -->
				<div class="space-y-6">
					<!-- General Settings -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">General Settings</h3>
						<p class="mt-1 text-sm text-surface-500">Basic platform configuration</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Platform Name</p>
								<p class="mt-1 font-medium">{platformSettings.general.platformName}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Support Email</p>
								<p class="mt-1 font-medium">{platformSettings.general.supportEmail}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Support Phone</p>
								<p class="mt-1 font-medium">{platformSettings.general.supportPhone}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Default Timezone</p>
								<p class="mt-1 font-medium">{platformSettings.general.defaultTimezone}</p>
							</div>
						</div>
					</Card>

					<!-- Feature Flags -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Feature Flags</h3>
						<p class="mt-1 text-sm text-surface-500">Platform-wide feature toggles</p>
						<div class="mt-4 space-y-3">
							{#each featureFlags as flag}
								<div class="flex items-center justify-between rounded-lg border border-surface-200-800 p-4">
									<div>
										<p class="font-medium">{flag.name}</p>
										<p class="text-sm text-surface-500">{flag.description}</p>
									</div>
									<div class="flex items-center gap-2">
										{#if flag.enabled}
											<span class="badge preset-filled-success-500">Enabled</span>
										{:else}
											<span class="badge preset-filled-surface-500">Disabled</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
						<p class="mt-4 text-sm text-surface-500">
							Feature flag editing coming in Phase 22.2.
						</p>
					</Card>

					<!-- Operational Limits -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Operational Limits</h3>
						<p class="mt-1 text-sm text-surface-500">System resource limits</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Max File Size</p>
								<p class="mt-1 text-xl font-bold">{platformSettings.limits.maxFileSize} MB</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Session Timeout</p>
								<p class="mt-1 text-xl font-bold">{platformSettings.limits.sessionTimeout} min</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">API Rate Limit</p>
								<p class="mt-1 text-xl font-bold">{platformSettings.limits.apiRateLimit}/min</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Max Sessions</p>
								<p class="mt-1 text-xl font-bold">{platformSettings.limits.maxConcurrentSessions}</p>
							</div>
						</div>
					</Card>
				</div>

			{:else if activeTab === 'organization'}
				<!-- Organization Settings (Placeholder) -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10">
							<Building2 class="h-10 w-10 text-primary-500" />
						</div>
						<h2 class="text-xl font-semibold">Organization Settings</h2>
						<p class="mt-2 max-w-md text-surface-500">
							View and manage organization-specific settings overrides.
							Coming in Phase 22.3.
						</p>
					</div>
				</Card>

			{:else if activeTab === 'notifications'}
				<!-- Notification Settings (Placeholder) -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10">
							<Bell class="h-10 w-10 text-primary-500" />
						</div>
						<h2 class="text-xl font-semibold">Notification Settings</h2>
						<p class="mt-2 max-w-md text-surface-500">
							Configure notification channels and templates.
							Coming in Phase 22.2.
						</p>
					</div>
				</Card>

			{:else if activeTab === 'integrations'}
				<!-- Integrations -->
				<Card variant="outlined" padding="lg">
					<h3 class="text-lg font-semibold">Active Integrations</h3>
					<p class="mt-1 text-sm text-surface-500">Third-party service connections</p>
					<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each integrations as integration}
							{@const StatusIcon = getStatusIcon(integration.status)}
							<div class="rounded-lg border border-surface-200-800 p-4">
								<div class="flex items-start justify-between">
									<div>
										<p class="font-medium">{integration.name}</p>
										<p class="text-sm text-surface-500">{integration.description}</p>
									</div>
									<StatusIcon class="h-5 w-5 {getStatusColor(integration.status)}" />
								</div>
								<div class="mt-3">
									<span class="badge {integration.status === 'connected' ? 'preset-outlined-success-500' : 'preset-outlined-surface-500'}">
										{integration.status === 'connected' ? 'Connected' : 'Disconnected'}
									</span>
								</div>
							</div>
						{/each}
					</div>
					<p class="mt-4 text-sm text-surface-500">
						Integration management coming in Phase 22.3.
					</p>
				</Card>

			{:else if activeTab === 'security'}
				<!-- Security Settings -->
				<div class="space-y-6">
					<!-- Authentication -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Authentication</h3>
						<p class="mt-1 text-sm text-surface-500">Password and 2FA policies</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Min Password Length</p>
								<p class="mt-1 font-medium">{securitySettings.authentication.passwordMinLength} characters</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Password Complexity</p>
								<p class="mt-1 font-medium">{securitySettings.authentication.passwordComplexity ? 'Required' : 'Not Required'}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Password Expiry</p>
								<p class="mt-1 font-medium">{securitySettings.authentication.passwordExpiry > 0 ? `${securitySettings.authentication.passwordExpiry} days` : 'Never'}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Two-Factor Auth</p>
								<p class="mt-1 font-medium">{securitySettings.authentication.twoFactorRequired ? 'Required' : 'Optional'}</p>
							</div>
						</div>
					</Card>

					<!-- Session Management -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Session Management</h3>
						<p class="mt-1 text-sm text-surface-500">Session duration and limits</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Session Duration</p>
								<p class="mt-1 text-xl font-bold">{securitySettings.session.sessionDuration}h</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Idle Timeout</p>
								<p class="mt-1 text-xl font-bold">{securitySettings.session.idleTimeout} min</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Max Sessions</p>
								<p class="mt-1 text-xl font-bold">{securitySettings.session.concurrentSessions}</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Remember Me</p>
								<p class="mt-1 text-xl font-bold">{securitySettings.session.rememberMeDuration}d</p>
							</div>
						</div>
					</Card>

					<!-- Access Control -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Access Control</h3>
						<p class="mt-1 text-sm text-surface-500">Login security settings</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Failed Login Lockout</p>
								<p class="mt-1 font-medium">{securitySettings.access.failedLoginLockout} attempts</p>
							</div>
							<div class="rounded-lg border border-surface-200-800 p-4">
								<p class="text-sm text-surface-500">Lockout Duration</p>
								<p class="mt-1 font-medium">{securitySettings.access.lockoutDuration} minutes</p>
							</div>
						</div>
						<p class="mt-4 text-sm text-surface-500">
							Security settings editing coming in Phase 22.3.
						</p>
					</Card>
				</div>

			{:else if activeTab === 'data'}
				<!-- Data Management -->
				<div class="space-y-6">
					<!-- Data Retention -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Data Retention</h3>
						<p class="mt-1 text-sm text-surface-500">How long different data types are retained</p>
						<div class="mt-4">
							<table class="w-full">
								<thead class="border-b border-surface-300-700">
									<tr>
										<th class="pb-3 text-left text-sm font-medium text-surface-500">Data Type</th>
										<th class="pb-3 text-left text-sm font-medium text-surface-500">Retention</th>
										<th class="pb-3 text-left text-sm font-medium text-surface-500">Description</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-200-800">
									{#each dataRetention as item}
										<tr>
											<td class="py-3 font-medium">{item.type}</td>
											<td class="py-3">
												<span class="badge preset-outlined-primary-500">{item.retention}</span>
											</td>
											<td class="py-3 text-sm text-surface-500">{item.description}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</Card>

					<!-- Backup & Export (Placeholder) -->
					<Card variant="outlined" padding="lg">
						<div class="flex flex-col items-center justify-center py-8 text-center">
							<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10">
								<Database class="h-8 w-8 text-primary-500" />
							</div>
							<h3 class="text-lg font-semibold">Backup & Export</h3>
							<p class="mt-2 max-w-md text-surface-500">
								Backup configuration and data export features coming in Phase 22.4.
							</p>
						</div>
					</Card>
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
