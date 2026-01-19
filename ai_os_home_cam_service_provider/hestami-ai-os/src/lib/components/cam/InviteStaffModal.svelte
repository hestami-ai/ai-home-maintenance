<script lang="ts">
	import { X, Loader2, Mail, Shield, Check } from 'lucide-svelte';
	import { OrganizationTypeValues, PillarAccessValues, StaffRoleValues, UserRoleValues, orgStaffApi, type PillarAccess, type StaffRole } from '$lib/api/cam';
	import { nanoid } from 'nanoid';

	interface Props {
		open: boolean;
		orgType: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open = $bindable(false), orgType, onClose, onSuccess }: Props = $props();

	let email = $state('');
	let displayName = $state('');
	let title = $state('');
	let selectedRoles = $state<StaffRole[]>([]);
	let selectedPillars = $state<PillarAccess[]>([]);
	let canBeAssignedCases = $state(false);
	let isLoading = $state(false);
	let error = $state('');

	const roles: { value: StaffRole; label: string }[] = [
		{ value: StaffRoleValues.PLATFORM_ADMIN, label: 'Platform Admin' },
		{ value: StaffRoleValues.CAM_SPECIALIST, label: 'CAM Specialist' },
		{ value: StaffRoleValues.OPERATIONS_COORDINATOR, label: 'Operations Coordinator' },
		{ value: StaffRoleValues.CONCIERGE_OPERATOR, label: 'Concierge Operator' },
		{ value: StaffRoleValues.VENDOR_LIAISON, label: 'Vendor Liaison' }
	];

	const pillars: { value: PillarAccess; label: string }[] = [
		{ value: PillarAccessValues.CAM, label: 'CAM Pillar' },
		{ value: PillarAccessValues.CONCIERGE, label: 'Concierge Pillar' },
		{ value: PillarAccessValues.CONTRACTOR, label: 'Contractor Pillar' },
		{ value: UserRoleValues.VENDOR, label: 'Vendor Pillar' },
		{ value: UserRoleValues.ADMIN, label: 'Admin Pillar' }
	];

	// Enforce CAM-only for CAM org types
	const isCamOnly = $derived(([OrganizationTypeValues.MANAGEMENT_COMPANY, OrganizationTypeValues.COMMUNITY_ASSOCIATION] as string[]).includes(orgType));

	$effect(() => {
		if (open) {
			if (isCamOnly) {
				selectedPillars = [PillarAccessValues.CAM];
			}
		} else {
			// Reset form
			email = '';
			displayName = '';
			title = '';
			selectedRoles = [];
			selectedPillars = isCamOnly ? [PillarAccessValues.CAM] : [];
			canBeAssignedCases = false;
			error = '';
		}
	});

	function toggleRole(role: StaffRole) {
		if (selectedRoles.includes(role)) {
			selectedRoles = selectedRoles.filter((r) => r !== role);
		} else {
			selectedRoles = [...selectedRoles, role];
		}
	}

	function togglePillar(pillar: PillarAccess) {
		if (isCamOnly && pillar !== PillarAccessValues.CAM) return;
		if (selectedPillars.includes(pillar)) {
			selectedPillars = selectedPillars.filter((p) => p !== pillar);
		} else {
			selectedPillars = [...selectedPillars, pillar];
		}
	}

	async function handleInvite() {
		if (!email || !displayName || selectedRoles.length === 0 || selectedPillars.length === 0) {
			error = 'Please fill in all required fields.';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const res = await orgStaffApi.create({
				email,
				displayName,
				title: title || undefined,
				roles: selectedRoles,
				pillarAccess: selectedPillars,
				canBeAssignedCases,
				idempotencyKey: nanoid()
			});

			if (res.ok) {
				onSuccess();
				open = false;
			}
		} catch (e: any) {
			error = e.message || 'An unexpected error occurred.';
		} finally {
			isLoading = false;
		}
	}

	function handleCancel() {
		open = false;
		onClose();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-center justify-center">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick={handleCancel}></div>

		<div class="relative z-10 w-full max-w-xl flex-col rounded-xl border border-surface-300-700 bg-surface-50-950 shadow-2xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Invite Staff Member</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-200-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="max-h-[70vh] overflow-y-auto p-6 space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<div class="col-span-2 sm:col-span-1">
						<label for="email" class="block text-sm font-medium">User Email <span class="text-error-500">*</span></label>
						<div class="relative mt-1">
							<Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
							<input
								id="email"
								type="email"
								placeholder="staff@example.com"
								bind:value={email}
								class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>
					</div>
					<div class="col-span-2 sm:col-span-1">
						<label for="displayName" class="block text-sm font-medium">Display Name <span class="text-error-500">*</span></label>
						<input
							id="displayName"
							type="text"
							placeholder="e.g. John Doe"
							bind:value={displayName}
							class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div class="col-span-2">
						<label for="title" class="block text-sm font-medium">Title/Position (Optional)</label>
						<input
							id="title"
							type="text"
							placeholder="e.g. Senior Portfolio Manager"
							bind:value={title}
							class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<fieldset>
					<legend class="block text-sm font-medium mb-3">Roles <span class="text-error-500">*</span></legend>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{#each roles as role}
							<button
								type="button"
								onclick={() => toggleRole(role.value)}
								class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors {selectedRoles.includes(role.value) ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-surface-300-700 bg-surface-100-900 text-surface-500 hover:bg-surface-200-800'}"
							>
								<div class="h-4 w-4 shrink-0 rounded border border-current flex items-center justify-center">
									{#if selectedRoles.includes(role.value)}
										<Check class="h-3 w-3" />
									{/if}
								</div>
								{role.label}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset>
					<legend class="block text-sm font-medium mb-3">Pillar Access <span class="text-error-500">*</span></legend>
					<div class="space-y-2">
						{#each pillars as pillar}
							<button
								type="button"
								onclick={() => togglePillar(pillar.value)}
								disabled={isCamOnly && pillar.value !== PillarAccessValues.CAM}
								class="flex w-full items-center justify-between rounded-lg border p-3 transition-colors {selectedPillars.includes(pillar.value) ? 'border-primary-500 bg-primary-500/10' : 'border-surface-300-700 bg-surface-100-900 hover:bg-surface-200-800'} {isCamOnly && pillar.value !== PillarAccessValues.CAM ? 'opacity-50 cursor-not-allowed' : ''}"
							>
								<div class="flex items-center gap-3">
									<Shield class="h-5 w-5 {selectedPillars.includes(pillar.value) ? 'text-primary-500' : 'text-surface-500'}" />
									<div class="text-left">
										<p class="text-sm font-medium {selectedPillars.includes(pillar.value) ? 'text-primary-500' : ''}">{pillar.label}</p>
										{#if isCamOnly && pillar.value === PillarAccessValues.CAM}
											<p class="text-xs text-surface-500 italic">Enforced for your organization type</p>
										{/if}
									</div>
								</div>
								{#if selectedPillars.includes(pillar.value)}
									<Check class="h-5 w-5 text-primary-500" />
								{/if}
							</button>
						{/each}
					</div>
				</fieldset>

				<div class="flex items-center gap-3 pt-2">
					<input
						id="assign-cases"
						type="checkbox"
						bind:checked={canBeAssignedCases}
						class="h-4 w-4 rounded border-surface-300-700 bg-surface-100-900 text-primary-500 focus:ring-primary-500"
					/>
					<label for="assign-cases" class="text-sm font-medium">Can be assigned cases/tasks</label>
				</div>
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={isLoading}
					class="btn btn-sm preset-tonal-surface"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleInvite}
					disabled={isLoading || !email || !displayName || selectedRoles.length === 0}
					class="btn btn-sm preset-filled-primary-500 flex items-center gap-2"
				>
					{#if isLoading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{isLoading ? 'Inviting...' : 'Invite Staff Member'}
				</button>
			</div>
		</div>
	</div>
{/if}
