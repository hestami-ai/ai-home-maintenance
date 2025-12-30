<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Loader2,
		Save,
		Phone,
		Mail,
		Calendar,
		Award,
		Clock,
		MapPin,
		Wrench,
		Plus,
		Trash2
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { v4 as uuidv4 } from 'uuid';

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
	}

	interface Availability {
		monday: Array<{ start: string; end: string }> | null;
		tuesday: Array<{ start: string; end: string }> | null;
		wednesday: Array<{ start: string; end: string }> | null;
		thursday: Array<{ start: string; end: string }> | null;
		friday: Array<{ start: string; end: string }> | null;
		saturday: Array<{ start: string; end: string }> | null;
		sunday: Array<{ start: string; end: string }> | null;
	}

	const technicianId = $derived(page.params.id as string);

	const weekDays = [
		{ key: 'monday', label: 'Monday' },
		{ key: 'tuesday', label: 'Tuesday' },
		{ key: 'wednesday', label: 'Wednesday' },
		{ key: 'thursday', label: 'Thursday' },
		{ key: 'friday', label: 'Friday' },
		{ key: 'saturday', label: 'Saturday' },
		{ key: 'sunday', label: 'Sunday' }
	] as const;

	interface Props {
		data: {
			technician: Technician;
			skills: Skill[];
			certifications: Certification[];
			availability: Availability | null;
		};
	}

	let { data }: Props = $props();

	let technician = $state<Technician | null>(null);
	let skills = $state<Skill[]>([]);
	let certifications = $state<Certification[]>([]);
	let availability = $state<Availability | null>(null);

	let isLoading = $state(false);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let activeSection = $state<'profile' | 'skills' | 'certifications' | 'availability'>('profile');

	// Data for form selects
	const timezones = [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Phoenix',
		'America/Anchorage',
		'Pacific/Honolulu'
	];

	const tradeOptions = [
		'HVAC',
		'ELECTRICAL',
		'PLUMBING',
		'CARPENTRY',
		'PAINTING',
		'ROOFING',
		'FLOORING',
		'GENERAL_MAINTENANCE',
		'LANDSCAPING',
		'APPLIANCE_REPAIR',
		'LOCKSMITH',
		'PEST_CONTROL',
		'CLEANING',
		'POOL_SERVICE',
		'OTHER'
	];

	// Form state
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let employeeId = $state('');
	let hireDate = $state('');
	let terminationDate = $state('');
	let timezone = $state('');
	let isActive = $state(false);

	// Synchronize server data to local state
	$effect(() => {
		if (data.technician) {
			technician = data.technician;
			firstName = technician.firstName;
			lastName = technician.lastName;
			email = technician.email || '';
			phone = technician.phone || '';
			employeeId = technician.employeeId || '';
			hireDate = technician.hireDate ? technician.hireDate.split('T')[0] : '';
			terminationDate = technician.terminationDate ? technician.terminationDate.split('T')[0] : '';
			timezone = technician.timezone;
			isActive = technician.isActive;
		}
		if (data.skills) skills = data.skills;
		if (data.certifications) certifications = data.certifications;
		if (data.availability) availability = data.availability;
	});


	async function saveProfile() {
		isSaving = true;
		error = null;
		successMessage = null;

		try {
			const response = await orpc.technician.upsert({
				id: technicianId,
				firstName,
				lastName,
				email: email || undefined,
				phone: phone || undefined,
				employeeId: employeeId || undefined,
				hireDate: hireDate || undefined,
				terminationDate: terminationDate || undefined,
				timezone,
				isActive,
				idempotencyKey: uuidv4()
			});

			if (response.ok) {
				successMessage = 'Profile saved successfully';
				setTimeout(() => (successMessage = null), 3000);
			} else {
				error = 'Failed to save profile';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save profile';
		} finally {
			isSaving = false;
		}
	}

	// Skill management
	let newSkillTrade = $state('');
	let newSkillLevel = $state(3);
	let newSkillNotes = $state('');
	let isAddingSkill = $state(false);

	async function addSkill() {
		if (!newSkillTrade) return;
		isAddingSkill = true;

		try {
			const response = await orpc.technician.upsertSkill({
				technicianId: technicianId!,
				trade: newSkillTrade as any,
				level: newSkillLevel,
				notes: newSkillNotes || undefined,
				idempotencyKey: uuidv4()
			});

			if (response.ok) {
				skills = [...skills, response.data.skill];
				newSkillTrade = '';
				newSkillLevel = 3;
				newSkillNotes = '';
			}
		} catch (err) {
			console.error('Failed to add skill:', err);
		} finally {
			isAddingSkill = false;
		}
	}

	// Certification management
	let newCertName = $state('');
	let newCertAuthority = $state('');
	let newCertId = $state('');
	let newCertIssued = $state('');
	let newCertExpires = $state('');
	let isAddingCert = $state(false);

	async function addCertification() {
		if (!newCertName) return;
		isAddingCert = true;

		try {
			const response = await orpc.technician.upsertCertification({
				technicianId: technicianId!,
				name: newCertName,
				authority: newCertAuthority || undefined,
				certificationId: newCertId || undefined,
				issuedAt: newCertIssued || undefined,
				expiresAt: newCertExpires || undefined,
				idempotencyKey: uuidv4()
			});

			if (response.ok) {
				certifications = [...certifications, response.data.certification];
				newCertName = '';
				newCertAuthority = '';
				newCertId = '';
				newCertIssued = '';
				newCertExpires = '';
			}
		} catch (err) {
			console.error('Failed to add certification:', err);
		} finally {
			isAddingCert = false;
		}
	}

	// Availability management
	let availabilityForm = $state<Availability>({
		monday: null,
		tuesday: null,
		wednesday: null,
		thursday: null,
		friday: null,
		saturday: null,
		sunday: null
	});
	let isSavingAvailability = $state(false);

	function initAvailabilityForm() {
		if (availability) {
			availabilityForm = { ...availability };
		} else {
			// Default 9-5 weekdays
			availabilityForm = {
				monday: [{ start: '09:00', end: '17:00' }],
				tuesday: [{ start: '09:00', end: '17:00' }],
				wednesday: [{ start: '09:00', end: '17:00' }],
				thursday: [{ start: '09:00', end: '17:00' }],
				friday: [{ start: '09:00', end: '17:00' }],
				saturday: null,
				sunday: null
			};
		}
	}

	async function saveAvailability() {
		isSavingAvailability = true;
		error = null;

		try {
			const response = await orpc.technician.setAvailability({
				technicianId: technicianId!,
				monday: availabilityForm.monday ?? undefined,
				tuesday: availabilityForm.tuesday ?? undefined,
				wednesday: availabilityForm.wednesday ?? undefined,
				thursday: availabilityForm.thursday ?? undefined,
				friday: availabilityForm.friday ?? undefined,
				saturday: availabilityForm.saturday ?? undefined,
				sunday: availabilityForm.sunday ?? undefined,
				idempotencyKey: uuidv4()
			});

			if (response.ok) {
				availability = availabilityForm;
				successMessage = 'Availability saved successfully';
				setTimeout(() => (successMessage = null), 3000);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save availability';
		} finally {
			isSavingAvailability = false;
		}
	}

	function formatTrade(trade: string): string {
		return trade
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}


	$effect(() => {
		if (availability) {
			initAvailabilityForm();
		}
	});
</script>

<svelte:head>
	<title>{technician ? `${technician.firstName} ${technician.lastName}` : 'Technician'} | Contractor | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="2xl">
	<div class="py-6">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/contractor/technicians')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				{#if isLoading}
					<div class="h-8 w-48 animate-pulse rounded bg-surface-200-800"></div>
				{:else if technician}
					<h1 class="text-2xl font-bold">{technician.firstName} {technician.lastName}</h1>
					<p class="mt-1 text-surface-500">
						{technician.isActive ? 'Active' : 'Inactive'} Technician
						{#if technician.employeeId}
							• ID: {technician.employeeId}
						{/if}
					</p>
				{:else}
					<h1 class="text-2xl font-bold">Technician Not Found</h1>
				{/if}
			</div>
		</div>

		{#if isLoading}
			<div class="mt-8 flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else if error && !technician}
			<Card variant="outlined" padding="lg" class="mt-8">
				<EmptyState title="Error" description={error}>
					{#snippet actions()}
						<button onclick={() => goto('/app/contractor/technicians')} class="btn preset-filled-primary-500">
							Back to Technicians
						</button>
					{/snippet}
				</EmptyState>
			</Card>
		{:else if technician}
			{#if successMessage}
				<div class="mt-4 rounded-lg bg-success-500/10 p-3 text-sm text-success-500">
					{successMessage}
				</div>
			{/if}

			{#if error}
				<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
					{error}
				</div>
			{/if}

			<!-- Section Tabs -->
			<div class="mt-6 border-b border-surface-300-700">
				<nav class="-mb-px flex space-x-6">
					{#each [
						{ id: 'profile', label: 'Profile' },
						{ id: 'skills', label: 'Skills', badge: skills.length },
						{ id: 'certifications', label: 'Certifications', badge: certifications.length },
						{ id: 'availability', label: 'Availability' }
					] as tab}
						<button
							type="button"
							onclick={() => (activeSection = tab.id as typeof activeSection)}
							class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors"
							class:border-primary-500={activeSection === tab.id}
							class:text-primary-500={activeSection === tab.id}
							class:border-transparent={activeSection !== tab.id}
							class:text-surface-500={activeSection !== tab.id}
						>
							{tab.label}
							{#if tab.badge !== undefined && tab.badge > 0}
								<span class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-200-800 px-1.5 text-xs">
									{tab.badge}
								</span>
							{/if}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Profile Section -->
			{#if activeSection === 'profile'}
				<form onsubmit={(e) => { e.preventDefault(); saveProfile(); }} class="mt-6">
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Basic Information</h2>

						<div class="mt-6 space-y-6">
							<div class="grid gap-6 sm:grid-cols-2">
								<div>
									<label for="firstName" class="block text-sm font-medium">
										First Name <span class="text-error-500">*</span>
									</label>
									<input
										type="text"
										id="firstName"
										bind:value={firstName}
										required
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
								<div>
									<label for="lastName" class="block text-sm font-medium">
										Last Name <span class="text-error-500">*</span>
									</label>
									<input
										type="text"
										id="lastName"
										bind:value={lastName}
										required
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
							</div>

							<div class="grid gap-6 sm:grid-cols-2">
								<div>
									<label for="email" class="block text-sm font-medium">Email</label>
									<input
										type="email"
										id="email"
										bind:value={email}
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
								<div>
									<label for="phone" class="block text-sm font-medium">Phone</label>
									<input
										type="tel"
										id="phone"
										bind:value={phone}
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
							</div>

							<div class="grid gap-6 sm:grid-cols-2">
								<div>
									<label for="employeeId" class="block text-sm font-medium">Employee ID</label>
									<input
										type="text"
										id="employeeId"
										bind:value={employeeId}
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
								<div>
									<label for="timezone" class="block text-sm font-medium">Timezone</label>
									<select
										id="timezone"
										bind:value={timezone}
										class="select mt-1 w-full"
										disabled={isSaving}
									>
										{#each timezones as tz}
											<option value={tz}>{tz.replace(/_/g, ' ')}</option>
										{/each}
									</select>
								</div>
							</div>

							<div class="grid gap-6 sm:grid-cols-2">
								<div>
									<label for="hireDate" class="block text-sm font-medium">Hire Date</label>
									<input
										type="date"
										id="hireDate"
										bind:value={hireDate}
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
								<div>
									<label for="terminationDate" class="block text-sm font-medium">Termination Date</label>
									<input
										type="date"
										id="terminationDate"
										bind:value={terminationDate}
										class="input mt-1 w-full"
										disabled={isSaving}
									/>
								</div>
							</div>

							<div>
								<label class="flex items-center gap-2">
									<input
										type="checkbox"
										bind:checked={isActive}
										class="checkbox"
										disabled={isSaving}
									/>
									<span class="text-sm font-medium">Active</span>
								</label>
								<p class="mt-1 text-xs text-surface-400">Inactive technicians won't appear in scheduling</p>
							</div>
						</div>

						<div class="mt-8 flex justify-end">
							<button type="submit" class="btn preset-filled-primary-500" disabled={isSaving}>
								{#if isSaving}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Saving...
								{:else}
									<Save class="mr-2 h-4 w-4" />
									Save Changes
								{/if}
							</button>
						</div>
					</Card>
				</form>
			{/if}

			<!-- Skills Section -->
			{#if activeSection === 'skills'}
				<div class="mt-6 space-y-6">
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Add Skill</h2>
						<div class="mt-4 grid gap-4 sm:grid-cols-4">
							<div>
								<label for="newSkillTrade" class="block text-sm font-medium">Trade</label>
								<select
									id="newSkillTrade"
									bind:value={newSkillTrade}
									class="select mt-1 w-full"
									disabled={isAddingSkill}
								>
									<option value="">Select trade...</option>
									{#each tradeOptions as trade}
										<option value={trade}>{formatTrade(trade)}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="newSkillLevel" class="block text-sm font-medium">Level (1-5)</label>
								<input
									type="number"
									id="newSkillLevel"
									bind:value={newSkillLevel}
									min="1"
									max="5"
									class="input mt-1 w-full"
									disabled={isAddingSkill}
								/>
							</div>
							<div>
								<label for="newSkillNotes" class="block text-sm font-medium">Notes</label>
								<input
									type="text"
									id="newSkillNotes"
									bind:value={newSkillNotes}
									class="input mt-1 w-full"
									placeholder="Optional notes"
									disabled={isAddingSkill}
								/>
							</div>
							<div class="flex items-end">
								<button
									type="button"
									onclick={addSkill}
									class="btn preset-filled-primary-500 w-full"
									disabled={!newSkillTrade || isAddingSkill}
								>
									{#if isAddingSkill}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<Plus class="mr-2 h-4 w-4" />
									{/if}
									Add
								</button>
							</div>
						</div>
					</Card>

					{#if skills.length === 0}
						<Card variant="outlined" padding="lg">
							<EmptyState title="No skills" description="Add trade skills to track technician capabilities." />
						</Card>
					{:else}
						<Card variant="outlined" padding="none">
							<div class="divide-y divide-surface-300-700">
								{#each skills as skill}
									<div class="flex items-center justify-between px-6 py-4">
										<div class="flex items-center gap-3">
											<Wrench class="h-5 w-5 text-primary-500" />
											<div>
												<p class="font-medium">{formatTrade(skill.trade)}</p>
												{#if skill.notes}
													<p class="text-sm text-surface-500">{skill.notes}</p>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-2">
											{#each Array(5) as _, i}
												<div
													class="h-2 w-4 rounded-sm {i < skill.level ? 'bg-primary-500' : 'bg-surface-300-700'}"
												></div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</Card>
					{/if}
				</div>
			{/if}

			<!-- Certifications Section -->
			{#if activeSection === 'certifications'}
				<div class="mt-6 space-y-6">
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Add Certification</h2>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div>
								<label for="newCertName" class="block text-sm font-medium">
									Name <span class="text-error-500">*</span>
								</label>
								<input
									type="text"
									id="newCertName"
									bind:value={newCertName}
									class="input mt-1 w-full"
									placeholder="e.g., EPA 608 Certification"
									disabled={isAddingCert}
								/>
							</div>
							<div>
								<label for="newCertAuthority" class="block text-sm font-medium">Issuing Authority</label>
								<input
									type="text"
									id="newCertAuthority"
									bind:value={newCertAuthority}
									class="input mt-1 w-full"
									placeholder="e.g., EPA"
									disabled={isAddingCert}
								/>
							</div>
							<div>
								<label for="newCertId" class="block text-sm font-medium">Certificate ID</label>
								<input
									type="text"
									id="newCertId"
									bind:value={newCertId}
									class="input mt-1 w-full"
									placeholder="Optional"
									disabled={isAddingCert}
								/>
							</div>
							<div>
								<label for="newCertIssued" class="block text-sm font-medium">Issue Date</label>
								<input
									type="date"
									id="newCertIssued"
									bind:value={newCertIssued}
									class="input mt-1 w-full"
									disabled={isAddingCert}
								/>
							</div>
							<div>
								<label for="newCertExpires" class="block text-sm font-medium">Expiration Date</label>
								<input
									type="date"
									id="newCertExpires"
									bind:value={newCertExpires}
									class="input mt-1 w-full"
									disabled={isAddingCert}
								/>
							</div>
							<div class="flex items-end">
								<button
									type="button"
									onclick={addCertification}
									class="btn preset-filled-primary-500 w-full"
									disabled={!newCertName || isAddingCert}
								>
									{#if isAddingCert}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<Plus class="mr-2 h-4 w-4" />
									{/if}
									Add
								</button>
							</div>
						</div>
					</Card>

					{#if certifications.length === 0}
						<Card variant="outlined" padding="lg">
							<EmptyState title="No certifications" description="Add licenses and certifications to track compliance." />
						</Card>
					{:else}
						<Card variant="outlined" padding="none">
							<div class="divide-y divide-surface-300-700">
								{#each certifications as cert}
									{@const isExpired = cert.expiresAt && new Date(cert.expiresAt) < new Date()}
									<div class="flex items-center justify-between px-6 py-4">
										<div class="flex items-center gap-3">
											<Award class="h-5 w-5 text-secondary-500" />
											<div>
												<p class="font-medium">{cert.name}</p>
												{#if cert.authority}
													<p class="text-sm text-surface-500">{cert.authority}</p>
												{/if}
											</div>
										</div>
										<div class="text-right">
											{#if isExpired}
												<span class="rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-medium text-error-500">
													Expired
												</span>
											{:else if cert.expiresAt}
												<span class="text-sm text-surface-500">
													Expires: {formatDate(cert.expiresAt)}
												</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</Card>
					{/if}
				</div>
			{/if}

			<!-- Availability Section -->
			{#if activeSection === 'availability'}
				<div class="mt-6">
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Weekly Availability</h2>
							<button
								type="button"
								onclick={initAvailabilityForm}
								class="btn btn-sm preset-tonal-surface"
							>
								Reset to Default
							</button>
						</div>

						<div class="mt-6 space-y-4">
							{#each weekDays as day}
								{@const ranges = availabilityForm[day.key]}
								<div class="flex items-center gap-4 rounded-lg border border-surface-300-700 p-4">
									<div class="w-28 font-medium">{day.label}</div>
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											checked={ranges !== null && ranges.length > 0}
											onchange={(e) => {
												if (e.currentTarget.checked) {
													availabilityForm[day.key] = [{ start: '09:00', end: '17:00' }];
												} else {
													availabilityForm[day.key] = null;
												}
											}}
											class="checkbox"
										/>
										<span class="text-sm">Working</span>
									</label>
									{#if ranges && ranges.length > 0}
										<div class="flex items-center gap-2">
											<input
												type="time"
												value={ranges[0].start}
												onchange={(e) => {
													if (availabilityForm[day.key]) {
														availabilityForm[day.key]![0].start = e.currentTarget.value;
													}
												}}
												class="input w-32"
											/>
											<span class="text-surface-500">to</span>
											<input
												type="time"
												value={ranges[0].end}
												onchange={(e) => {
													if (availabilityForm[day.key]) {
														availabilityForm[day.key]![0].end = e.currentTarget.value;
													}
												}}
												class="input w-32"
											/>
										</div>
									{:else}
										<span class="text-sm text-surface-400">Off</span>
									{/if}
								</div>
							{/each}
						</div>

						<div class="mt-6 flex justify-end">
							<button
								type="button"
								onclick={saveAvailability}
								class="btn preset-filled-primary-500"
								disabled={isSavingAvailability}
							>
								{#if isSavingAvailability}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Saving...
								{:else}
									<Save class="mr-2 h-4 w-4" />
									Save Availability
								{/if}
							</button>
						</div>
					</Card>
				</div>
			{/if}
		{/if}
	</div>
</PageContainer>
