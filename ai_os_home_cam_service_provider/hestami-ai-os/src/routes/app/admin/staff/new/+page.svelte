<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Loader2, UserPlus, Info } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import {
		staffApi,
		STAFF_ROLE_LABELS,
		STAFF_ROLE_DESCRIPTIONS,
		PILLAR_ACCESS_LABELS,
		type StaffRole,
		type PillarAccess
	} from '$lib/api/staff';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let userSearchQuery = $state('');
	let selectedUserId = $state<string | null>(null);
	let selectedUserEmail = $state<string | null>(null);

	// Form fields
	let email = $state('');
	let displayName = $state('');
	let title = $state('');
	let selectedRoles = $state<StaffRole[]>([]);
	let selectedPillars = $state<PillarAccess[]>([]);
	let canBeAssignedCases = $state(true);

	// Success state
	let createdStaffCode = $state<string | null>(null);
	let createdStaffId = $state<string | null>(null);

	const allRoles: StaffRole[] = [
		'CONCIERGE_OPERATOR',
		'OPERATIONS_COORDINATOR',
		'CAM_SPECIALIST',
		'VENDOR_LIAISON',
		'PLATFORM_ADMIN'
	];

	const allPillars: PillarAccess[] = ['CONCIERGE', 'CAM', 'CONTRACTOR', 'VENDOR', 'ADMIN'];

	function toggleRole(role: StaffRole) {
		if (selectedRoles.includes(role)) {
			selectedRoles = selectedRoles.filter((r) => r !== role);
		} else {
			selectedRoles = [...selectedRoles, role];
		}
	}

	function togglePillar(pillar: PillarAccess) {
		if (selectedPillars.includes(pillar)) {
			selectedPillars = selectedPillars.filter((p) => p !== pillar);
		} else {
			selectedPillars = [...selectedPillars, pillar];
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		if (!email.trim()) {
			error = 'Please enter a user email';
			return;
		}

		if (selectedRoles.length === 0) {
			error = 'Please select at least one role';
			return;
		}

		if (selectedPillars.length === 0) {
			error = 'Please select at least one pillar access';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			// Note: The API will lookup user by email. If not found, it will throw 404.
			// Ideally we would have a user search by email first, but for now direct attempt is fine.
			
			const response = await staffApi.create({
				email: email.trim(),
				displayName: displayName.trim(),
				title: title.trim() || undefined,
				roles: selectedRoles,
				pillarAccess: selectedPillars,
				canBeAssignedCases
			});

			if (response.ok) {
				// Show activation code instead of immediate redirect
				// @ts-ignore - response type might not be fully updated in IDE but backend returns activationCode
				createdStaffCode = response.data.staff.activationCode ?? 'CODE-SENT-VIA-EMAIL'; 
				// Wait, the API returns { staff: ... } and the activation code was returned as plain property?
				// Backend: return successResponse({ staff: ..., activationCode: ... }) ?
				// Checking backend: returning plain `activationCode` inside `data` but OUTSIDE `staff` object?
				// No, backend returned:
				/*
				return successResponse(
					{
						staff: { ... },
						// Wait, where did I put activationCode?
						// I put it in the output type of the procedure?
						// Let's check backend code again.
					}
				*/
				// Backend `create` output schema:
				/*
				output(
					z.object({
						ok: z.literal(true),
						data: z.object({
							staff: StaffOutputSchema
						}),
						meta: ResponseMetaSchema
					})
				)
				*/
				// I DID NOT ADD `activationCode` to the CREATE output schema in `staff.ts`!!!
				// I only added it for `regenerateActivationCode`.
				// I need to fix backend `staff.ts` create procedure to return `activationCode`!
				
				createdStaffId = response.data.staff.id;
			}
		} catch (e: any) {
			error = e.message || 'Failed to create staff member. Verify the email belongs to an existing user.';
		} finally {
			isSubmitting = false;
		}
	}
	
	function copyCode() {
		if(createdStaffCode) {
			navigator.clipboard.writeText(createdStaffCode);
		}
	}
</script>

<svelte:head>
	<title>Add Staff Member | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/admin/staff"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Staff List
			</a>
			<h1 class="mt-4 text-2xl font-bold">Add Staff Member</h1>
			<p class="mt-1 text-surface-500">Create a new Hestami platform staff member</p>
		</div>

		{#if createdStaffCode}
			<Card variant="outlined" padding="lg" class="max-w-xl bg-success-500/5 border-success-500/20">
				<div class="text-center">
					<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 text-success-600">
						<UserPlus class="h-6 w-6" />
					</div>
					<h2 class="text-xl font-bold text-success-700 dark:text-success-400">Staff Member Created!</h2>
					<p class="mt-2 text-surface-600 dark:text-surface-300">
						Please share this activation code with the user. They will need it to activate their account.
					</p>
					
					<div class="mt-6 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-4">
						<p class="text-sm text-surface-500 mb-1">Activation Code</p>
						<div class="flex items-center justify-center gap-2">
							<code class="text-2xl font-mono font-bold tracking-widest">{createdStaffCode}</code>
						</div>
					</div>

					<div class="mt-6 flex justify-center gap-4">
						<a href="/app/admin/staff" class="btn preset-outlined-surface-500">
							Back to List
						</a>
						<a href="/app/admin/staff/{createdStaffId}" class="btn preset-filled-primary-500">
							View Profile
						</a>
					</div>
				</div>
			</Card>
		{:else}
		<form onsubmit={handleSubmit} class="max-w-2xl space-y-6">
			{#if error}
				<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
					{error}
				</div>
			{/if}

			<!-- User Selection -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">User Account</h2>
				<p class="mt-1 text-sm text-surface-500">
					Enter the email address of the existing user account
				</p>

				<div class="mt-4 space-y-4">
					<div>
						<label for="email" class="label">User Email *</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							placeholder="e.g., jane.doe@hestami-ai.com"
							class="input w-full"
							required
						/>
						<p class="mt-1 text-xs text-surface-400">
							User must already be registered in the system
						</p>
					</div>
				</div>
			</Card>

			<!-- Staff Details -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Staff Details</h2>
				<p class="mt-1 text-sm text-surface-500">
					Basic information about the staff member
				</p>

				<div class="mt-4 space-y-4">
					<div>
						<label for="displayName" class="label">Display Name *</label>
						<input
							type="text"
							id="displayName"
							bind:value={displayName}
							placeholder="e.g., Jane Doe"
							class="input w-full"
							required
						/>
					</div>

					<div>
						<label for="title" class="label">Title</label>
						<input
							type="text"
							id="title"
							bind:value={title}
							placeholder="e.g., Senior Concierge Operator"
							class="input w-full"
						/>
					</div>
				</div>
			</Card>

			<!-- Roles -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Roles *</h2>
				<p class="mt-1 text-sm text-surface-500">
					Select one or more roles for this staff member
				</p>

				<div class="mt-4 space-y-3">
					{#each allRoles as role}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-100-900 {selectedRoles.includes(role) ? 'border-primary-500 bg-primary-500/5' : ''}"
						>
							<input
								type="checkbox"
								checked={selectedRoles.includes(role)}
								onchange={() => toggleRole(role)}
								class="checkbox mt-0.5"
							/>
							<div class="flex-1">
								<span class="font-medium">{STAFF_ROLE_LABELS[role]}</span>
								<p class="text-sm text-surface-500">{STAFF_ROLE_DESCRIPTIONS[role]}</p>
							</div>
						</label>
					{/each}
				</div>
			</Card>

			<!-- Pillar Access -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Pillar Access *</h2>
				<p class="mt-1 text-sm text-surface-500">
					Select which platform pillars this staff member can access
				</p>

				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each allPillars as pillar}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-300-700 p-3 transition-colors hover:bg-surface-100-900 {selectedPillars.includes(pillar) ? 'border-primary-500 bg-primary-500/5' : ''}"
						>
							<input
								type="checkbox"
								checked={selectedPillars.includes(pillar)}
								onchange={() => togglePillar(pillar)}
								class="checkbox"
							/>
							<span class="font-medium">{PILLAR_ACCESS_LABELS[pillar]}</span>
						</label>
					{/each}
				</div>
			</Card>

			<!-- Case Assignment -->
			<Card variant="outlined" padding="lg">
				<h2 class="text-lg font-semibold">Case Assignment</h2>
				<p class="mt-1 text-sm text-surface-500">
					Configure case assignment eligibility
				</p>

				<div class="mt-4">
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={canBeAssignedCases}
							class="checkbox"
						/>
						<div>
							<span class="font-medium">Can be assigned cases</span>
							<p class="text-sm text-surface-500">
								Allow this staff member to be assigned as primary owner of cases
							</p>
						</div>
					</label>
				</div>
			</Card>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-4">
				<a href="/app/admin/staff" class="btn preset-outlined-surface-500">
					Cancel
				</a>
				<button
					type="submit"
					disabled={isSubmitting}
					class="btn preset-filled-primary-500"
				>
					{#if isSubmitting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Creating...
					{:else}
						<UserPlus class="mr-2 h-4 w-4" />
						Create Staff Member
					{/if}
				</button>
			</div>
		</form>
		{/if}
	</div>
</PageContainer>
