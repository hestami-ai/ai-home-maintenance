<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		loading?: boolean;
		onConfirm: (data: { 
			name: string; 
			email?: string; 
			phone?: string; 
			position: string; 
			termStart: string; 
			termEnd?: string 
		}) => void;
		onCancel: () => void;
	}

	let {
		open,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let position = $state('');
	let termStart = $state('');
	let termEnd = $state('');
	let error = $state('');

	const positions = [
		'President',
		'Vice President',
		'Secretary',
		'Treasurer',
		'Director',
		'Member at Large'
	];

	function handleConfirm() {
		if (!name.trim()) {
			error = 'Name is required.';
			return;
		}
		if (!position) {
			error = 'Position is required.';
			return;
		}
		if (!termStart) {
			error = 'Term start date is required.';
			return;
		}
		error = '';
		onConfirm({
			name: name.trim(),
			email: email.trim() || undefined,
			phone: phone.trim() || undefined,
			position,
			termStart,
			termEnd: termEnd || undefined
		});
	}

	function handleCancel() {
		name = '';
		email = '';
		phone = '';
		position = '';
		termStart = '';
		termEnd = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			name = '';
			email = '';
			phone = '';
			position = '';
			termStart = '';
			termEnd = '';
			error = '';
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Add Board Member</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				<div>
					<label for="name" class="block text-sm font-medium">
						Name <span class="text-error-500">*</span>
					</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder="Enter member name"
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !name.trim()}
					/>
				</div>

				<div>
					<label for="position" class="block text-sm font-medium">
						Position <span class="text-error-500">*</span>
					</label>
					<select
						id="position"
						bind:value={position}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !position}
					>
						<option value="">Select a position</option>
						{#each positions as pos}
							<option value={pos}>{pos}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="email" class="block text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="email@example.com"
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="phone" class="block text-sm font-medium">
							Phone
						</label>
						<input
							id="phone"
							type="tel"
							bind:value={phone}
							placeholder="(555) 123-4567"
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="term-start" class="block text-sm font-medium">
							Term Start <span class="text-error-500">*</span>
						</label>
						<input
							id="term-start"
							type="date"
							bind:value={termStart}
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							class:border-error-500={error && !termStart}
						/>
					</div>
					<div>
						<label for="term-end" class="block text-sm font-medium">
							Term End
						</label>
						<input
							id="term-end"
							type="date"
							bind:value={termEnd}
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
						<p class="mt-1 text-xs text-surface-500">Leave blank for ongoing term</p>
					</div>
				</div>

				{#if error}
					<p class="text-sm text-error-500">{error}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={loading || !name.trim() || !position || !termStart}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Add Member
				</button>
			</div>
		</div>
	</div>
{/if}
