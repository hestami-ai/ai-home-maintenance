<script lang="ts">
	import {
		Users,
		Plus,
		Search,
		Phone,
		Mail,
		Calendar,
		Award,
		Clock,
		MapPin,
		TrendingUp,
		Wrench,
		UserCheck,
		UserX
	} from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';

	interface Technician {
		id: string;
		organizationId: string;
		branchId: string | null;
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		employeeId: string | null;
		isActive: boolean;
		hireDate: string | null;
		terminationDate: string | null;
		timezone: string;
		createdAt: string;
		updatedAt: string;
	}

	interface Skill {
		id: string;
		technicianId: string;
		trade: string;
		level: number;
		notes: string | null;
		createdAt: string;
		updatedAt: string;
	}

	interface Certification {
		id: string;
		technicianId: string;
		name: string;
		authority: string | null;
		certificationId: string | null;
		issuedAt: string | null;
		expiresAt: string | null;
		documentUrl: string | null;
		createdAt: string;
		updatedAt: string;
	}

	interface Availability {
		id: string;
		technicianId: string;
		monday: Array<{ start: string; end: string }> | null;
		tuesday: Array<{ start: string; end: string }> | null;
		wednesday: Array<{ start: string; end: string }> | null;
		thursday: Array<{ start: string; end: string }> | null;
		friday: Array<{ start: string; end: string }> | null;
		saturday: Array<{ start: string; end: string }> | null;
		sunday: Array<{ start: string; end: string }> | null;
		createdAt: string;
		updatedAt: string;
	}

	interface TimeOff {
		id: string;
		technicianId: string;
		startsAt: string;
		endsAt: string;
		reason: string | null;
		createdAt: string;
		updatedAt: string;
	}

	interface Territory {
		id: string;
		technicianId: string;
		serviceAreaId: string;
		isPrimary: boolean;
		createdAt: string;
		updatedAt: string;
	}

	interface Props {
		data: {
			technicians: Technician[];
			filters: {
				status: string;
			};
		};
	}

	let { data }: Props = $props();

	let technicians = $state<Technician[]>([]);
	let selectedTechnician = $state<Technician | null>(null);
	let isLoading = $state(false);
	let searchQuery = $state('');
	let statusFilter = $state('');

	// Synchronize server technicians to local state
	$effect(() => {
		if (!data) return;
		if (data.technicians) {
			technicians = [...data.technicians];
		}
		statusFilter = data.filters?.status ?? '';
	});

	// Detail data
	let skills = $state<Skill[]>([]);
	let certifications = $state<Certification[]>([]);
	let availability = $state<Availability | null>(null);
	let timeOff = $state<TimeOff[]>([]);
	let territories = $state<Territory[]>([]);
	let detailLoading = $state(false);

	// Active tab tracking
	let activeTab = $state('profile');

	const weekDays = [
		{ key: 'monday', label: 'Monday' },
		{ key: 'tuesday', label: 'Tuesday' },
		{ key: 'wednesday', label: 'Wednesday' },
		{ key: 'thursday', label: 'Thursday' },
		{ key: 'friday', label: 'Friday' },
		{ key: 'saturday', label: 'Saturday' },
		{ key: 'sunday', label: 'Sunday' }
	] as const;

	const statusOptions = [
		{ value: 'all', label: 'All Technicians' },
		{ value: 'active', label: 'Active Only' },
		{ value: 'inactive', label: 'Inactive Only' }
	];

	async function loadTechnicians() {
		// Guard against undefined data during navigation
		if (data == null || data.filters == null) return;
		if (statusFilter === data.filters.status) return;

		const params = new URLSearchParams();
		if (statusFilter !== 'all') params.set('status', statusFilter);

		const newUrl = `/app/contractor/technicians${params.toString() ? '?' + params.toString() : ''}`;
		window.location.href = newUrl;
	}

	async function loadTechnicianDetails(techId: string) {
		detailLoading = true;
		try {
			const [skillsRes, certsRes, availRes, timeOffRes, territoriesRes] = await Promise.all([
				orpc.technician.listSkills({ technicianId: techId }),
				orpc.technician.listCertifications({ technicianId: techId }),
				orpc.technician.getAvailability({ technicianId: techId }),
				orpc.technician.listTimeOff({ technicianId: techId }),
				orpc.technician.listTerritories({ technicianId: techId })
			]);

			if (skillsRes.ok) skills = skillsRes.data?.skills ?? [];
			if (certsRes.ok) certifications = certsRes.data?.certifications ?? [];
			if (availRes.ok) availability = availRes.data?.availability ?? null;
			if (timeOffRes.ok) timeOff = timeOffRes.data?.timeOff ?? [];
			if (territoriesRes.ok) territories = territoriesRes.data?.territories ?? [];
		} catch (error) {
			console.error('Failed to load technician details:', error);
		} finally {
			detailLoading = false;
		}
	}

	function selectTechnician(tech: Technician) {
		selectedTechnician = tech;
		activeTab = 'profile';
		loadTechnicianDetails(tech.id);
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTrade(trade: string): string {
		return trade
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function getSkillLevelLabel(level: number): string {
		const labels = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
		return labels[level - 1] || 'Unknown';
	}

	function formatTimeRange(ranges: Array<{ start: string; end: string }> | null): string {
		if (!ranges || ranges.length === 0) return 'Off';
		return ranges.map((r) => `${r.start} - ${r.end}`).join(', ');
	}

	const filteredTechnicians = $derived(
		technicians.filter((t) => {
			const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
			const query = searchQuery.toLowerCase();
			return (
				fullName.includes(query) ||
				(t.email?.toLowerCase().includes(query) ?? false) ||
				(t.employeeId?.toLowerCase().includes(query) ?? false)
			);
		})
	);
</script>

<svelte:head>
	<title>Manage Technicians | Contractor | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedTechnician}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Technicians</h1>
						<a href="/app/contractor/technicians/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							Add
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search technicians..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<select
						bind:value={statusFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredTechnicians.length === 0}
					<div class="p-6">
						<EmptyState
							title="No technicians found"
							description={searchQuery || statusFilter !== 'active'
								? 'Try adjusting your filters.'
								: 'Add your first technician to get started.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredTechnicians as tech}
							<button
								type="button"
								onclick={() => selectTechnician(tech)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedTechnician?.id === tech.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<p class="font-medium">{tech.firstName} {tech.lastName}</p>
											{#if tech.employeeId}
												<span class="text-xs text-surface-400">#{tech.employeeId}</span>
											{/if}
										</div>
										{#if tech.email}
											<p class="mt-0.5 truncate text-sm text-surface-500">{tech.email}</p>
										{/if}
									</div>
									<span
										class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {tech.isActive
											? 'bg-success-500/10 text-success-500'
											: 'bg-surface-500/10 text-surface-500'}"
									>
										{tech.isActive ? 'Active' : 'Inactive'}
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedTechnician}
			<DetailPanel>
				{#snippet header()}
					{@const tech = selectedTechnician!}
					<div>
						<div class="flex items-center gap-2">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium {tech.isActive
									? 'bg-success-500/10 text-success-500'
									: 'bg-surface-500/10 text-surface-500'}"
							>
								{tech.isActive ? 'Active' : 'Inactive'}
							</span>
							{#if tech.employeeId}
								<span class="text-xs text-surface-400">ID: {tech.employeeId}</span>
							{/if}
						</div>
						<h2 class="mt-1 text-xl font-semibold">{tech.firstName} {tech.lastName}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const tech = selectedTechnician!}
					<a href="/app/contractor/technicians/{tech.id}" class="btn btn-sm preset-tonal-surface">
						Edit
					</a>
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{ id: 'profile', label: 'Profile', content: profileTab },
							{ id: 'skills', label: 'Skills', content: skillsTab, badge: skills.length },
							{ id: 'certifications', label: 'Certifications', content: certificationsTab, badge: certifications.length },
							{ id: 'availability', label: 'Availability', content: availabilityTab },
							{ id: 'timeoff', label: 'Time Off', content: timeOffTab, badge: timeOff.length },
							{ id: 'territories', label: 'Territories', content: territoriesTab, badge: territories.length }
						]}
						activeTab={activeTab}
						onTabChange={(tab) => (activeTab = tab)}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<Users class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a technician to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet profileTab()}
	{#if selectedTechnician}
		{@const tech = selectedTechnician}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Full Name</h3>
					<p class="mt-1">{tech.firstName} {tech.lastName}</p>
				</div>
				{#if tech.employeeId}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Employee ID</h3>
						<p class="mt-1">{tech.employeeId}</p>
					</div>
				{/if}
				{#if tech.email}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Email</h3>
						<p class="mt-1">
							<a href="mailto:{tech.email}" class="flex items-center gap-1 text-primary-500 hover:underline">
								<Mail class="h-4 w-4" />
								{tech.email}
							</a>
						</p>
					</div>
				{/if}
				{#if tech.phone}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Phone</h3>
						<p class="mt-1">
							<a href="tel:{tech.phone}" class="flex items-center gap-1 text-primary-500 hover:underline">
								<Phone class="h-4 w-4" />
								{tech.phone}
							</a>
						</p>
					</div>
				{/if}
				<div>
					<h3 class="text-sm font-medium text-surface-500">Hire Date</h3>
					<p class="mt-1 flex items-center gap-1">
						<Calendar class="h-4 w-4 text-surface-400" />
						{formatDate(tech.hireDate)}
					</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Timezone</h3>
					<p class="mt-1">{tech.timezone}</p>
				</div>
				{#if tech.terminationDate}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Termination Date</h3>
						<p class="mt-1 text-error-500">{formatDate(tech.terminationDate)}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet skillsTab()}
	{#if detailLoading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{:else if skills.length === 0}
		<EmptyState title="No skills" description="Add trade skills to track technician capabilities." />
	{:else}
		<div class="space-y-3">
			{#each skills as skill}
				<div class="rounded-lg border border-surface-300-700 p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Wrench class="h-5 w-5 text-primary-500" />
							<span class="font-medium">{formatTrade(skill.trade)}</span>
						</div>
						<div class="flex items-center gap-1">
							{#each Array(5) as _, i}
								<div
									class="h-2 w-4 rounded-sm {i < skill.level ? 'bg-primary-500' : 'bg-surface-300-700'}"
								></div>
							{/each}
							<span class="ml-2 text-sm text-surface-500">{getSkillLevelLabel(skill.level)}</span>
						</div>
					</div>
					{#if skill.notes}
						<p class="mt-2 text-sm text-surface-500">{skill.notes}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet certificationsTab()}
	{#if detailLoading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{:else if certifications.length === 0}
		<EmptyState title="No certifications" description="Add licenses and certifications to track compliance." />
	{:else}
		<div class="space-y-3">
			{#each certifications as cert}
				{@const isExpired = cert.expiresAt && new Date(cert.expiresAt) < new Date()}
				{@const isExpiringSoon = cert.expiresAt && !isExpired && new Date(cert.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
				<div class="rounded-lg border border-surface-300-700 p-4">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2">
								<Award class="h-5 w-5 text-secondary-500" />
								<span class="font-medium">{cert.name}</span>
							</div>
							{#if cert.authority}
								<p class="mt-1 text-sm text-surface-500">Issued by: {cert.authority}</p>
							{/if}
							{#if cert.certificationId}
								<p class="text-sm text-surface-400">ID: {cert.certificationId}</p>
							{/if}
						</div>
						{#if isExpired}
							<span class="rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-medium text-error-500">
								Expired
							</span>
						{:else if isExpiringSoon}
							<span class="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-500">
								Expiring Soon
							</span>
						{:else if cert.expiresAt}
							<span class="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-500">
								Valid
							</span>
						{/if}
					</div>
					<div class="mt-2 flex gap-4 text-sm text-surface-500">
						{#if cert.issuedAt}
							<span>Issued: {formatDate(cert.issuedAt)}</span>
						{/if}
						{#if cert.expiresAt}
							<span class:text-error-500={isExpired} class:text-warning-500={isExpiringSoon}>
								Expires: {formatDate(cert.expiresAt)}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet availabilityTab()}
	{#if detailLoading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{:else if !availability}
		<EmptyState title="No availability set" description="Set weekly availability to enable scheduling." />
	{:else}
		<div class="space-y-2">
			{#each weekDays as day}
				{@const ranges = availability[day.key]}
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 px-4 py-3">
					<span class="font-medium">{day.label}</span>
					<span class="text-sm {ranges && ranges.length > 0 ? 'text-surface-700-300' : 'text-surface-400'}">
						<Clock class="mr-1 inline h-4 w-4" />
						{formatTimeRange(ranges)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet timeOffTab()}
	{#if detailLoading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{:else if timeOff.length === 0}
		<EmptyState title="No time off scheduled" description="Time off and PTO entries will appear here." />
	{:else}
		<div class="space-y-3">
			{#each timeOff as entry}
				{@const isPast = new Date(entry.endsAt) < new Date()}
				{@const isCurrent = new Date(entry.startsAt) <= new Date() && new Date(entry.endsAt) >= new Date()}
				<div class="rounded-lg border border-surface-300-700 p-4 {isPast ? 'opacity-60' : ''}">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2">
								<Calendar class="h-5 w-5 text-warning-500" />
								<span class="font-medium">
									{formatDate(entry.startsAt)} — {formatDate(entry.endsAt)}
								</span>
							</div>
							{#if entry.reason}
								<p class="mt-1 text-sm text-surface-500">{entry.reason}</p>
							{/if}
						</div>
						{#if isCurrent}
							<span class="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-500">
								Current
							</span>
						{:else if isPast}
							<span class="rounded-full bg-surface-500/10 px-2 py-0.5 text-xs font-medium text-surface-500">
								Past
							</span>
						{:else}
							<span class="rounded-full bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-primary-500">
								Upcoming
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet territoriesTab()}
	{#if detailLoading}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{:else if territories.length === 0}
		<EmptyState title="No territories assigned" description="Assign service areas to define coverage zones." />
	{:else}
		<div class="space-y-3">
			{#each territories as territory}
				<div class="rounded-lg border border-surface-300-700 p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<MapPin class="h-5 w-5 text-tertiary-500" />
							<span class="font-medium">Service Area: {territory.serviceAreaId}</span>
						</div>
						{#if territory.isPrimary}
							<span class="rounded-full bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-primary-500">
								Primary
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}
