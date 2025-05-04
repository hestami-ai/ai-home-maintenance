<script lang="ts">
	// Component props using Svelte 5 runes
	const props = $props();
	
	// Provide defaults for props
	const startDate = props.startDate ?? null;
	const endDate = props.endDate ?? null;
	const onRangeChange = props.onRangeChange ?? (() => {});
	const containerClass = props.containerClass ?? '';
	const inputClass = props.inputClass ?? '';
	const buttonClass = props.buttonClass ?? '';
	
	// Internal state
	let localStartDate = $state(startDate ? new Date(startDate).toISOString().split('T')[0] : '');
	let localEndDate = $state(endDate ? new Date(endDate).toISOString().split('T')[0] : '');
	let isOpen = $state(false);
	
	// Update local dates when props change
	$effect(() => {
		if (startDate) {
			localStartDate = new Date(startDate).toISOString().split('T')[0];
		}
		if (endDate) {
			localEndDate = new Date(endDate).toISOString().split('T')[0];
		}
	});
	
	// Handle start date change
	function handleStartDateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		localStartDate = target.value;
		applyDateRange();
	}
	
	// Handle end date change
	function handleEndDateChange(e: Event) {
		const target = e.target as HTMLInputElement;
		localEndDate = target.value;
		applyDateRange();
	}
	
	// Apply the date range
	function applyDateRange() {
		let startDate = localStartDate ? new Date(localStartDate) : null;
		let endDate = localEndDate ? new Date(localEndDate) : null;
		
		// If end date is provided but no start date, set start date to earliest possible
		if (!startDate && endDate) {
			startDate = new Date(0); // January 1, 1970
		}
		
		// If start date is provided but no end date, set end date to today
		if (startDate && !endDate) {
			endDate = new Date();
		}
		
		// Ensure end date is not before start date
		if (startDate && endDate && startDate > endDate) {
			endDate = new Date(startDate);
		}
		
		onRangeChange({ startDate, endDate });
	}
	
	// Clear the date range
	function clearDateRange() {
		localStartDate = '';
		localEndDate = '';
		onRangeChange({ startDate: null, endDate: null });
	}
	
	// Toggle the date picker
	function toggleDatePicker() {
		isOpen = !isOpen;
	}
</script>

<div class="date-range-picker {containerClass}">
	<button 
		type="button" 
		class="btn variant-soft btn-sm {buttonClass}" 
		onclick={toggleDatePicker}
		aria-label={isOpen ? "Close date range picker" : "Open date range picker"}
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 mr-1"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
		{#if localStartDate || localEndDate}
			{localStartDate ? new Date(localStartDate).toLocaleDateString() : 'Any'} - {localEndDate ? new Date(localEndDate).toLocaleDateString() : 'Present'}
		{:else}
			Filter by date
		{/if}
	</button>
	
	{#if isOpen}
		<div class="card p-4 date-picker-dropdown shadow-xl border border-surface-300-600-token rounded-lg bg-white dark:bg-surface-900">
			<div class="date-inputs">
				<div class="input-group">
					<label for="start-date" class="label">Start Date</label>
					<input 
						type="date" 
						id="start-date" 
						class="input variant-form-material {inputClass}" 
						value={localStartDate} 
						onchange={handleStartDateChange}
						max={localEndDate || undefined}
					/>
				</div>
				
				<div class="input-group">
					<label for="end-date" class="label">End Date</label>
					<input 
						type="date" 
						id="end-date" 
						class="input variant-form-material {inputClass}" 
						value={localEndDate} 
						onchange={handleEndDateChange}
						min={localStartDate || undefined}
						max={new Date().toISOString().split('T')[0]}
					/>
				</div>
			</div>
			
			<div class="flex justify-between gap-2 my-4">
				<button 
					type="button" 
					class="btn variant-soft btn-sm {buttonClass}" 
					onclick={clearDateRange}
					aria-label="Clear date range"
				>
					Clear
				</button>
				
				<button 
					type="button" 
					class="btn variant-filled-primary btn-sm {buttonClass}" 
					onclick={() => { applyDateRange(); toggleDatePicker(); }}
					aria-label="Apply date range"
				>
					Apply
				</button>
			</div>
			
			<hr class="!border-t !border-surface-300-600-token my-2" />
			
			<div class="flex flex-col gap-1">
				<button 
					type="button" 
					class="btn variant-ghost btn-sm justify-start {buttonClass}" 
					onclick={() => {
						const today = new Date();
						const lastWeek = new Date();
						lastWeek.setDate(today.getDate() - 7);
						localStartDate = lastWeek.toISOString().split('T')[0];
						localEndDate = today.toISOString().split('T')[0];
						applyDateRange();
					}}
				>
					Last 7 days
				</button>
				
				<button 
					type="button" 
					class="btn variant-ghost btn-sm justify-start {buttonClass}" 
					onclick={() => {
						const today = new Date();
						const lastMonth = new Date();
						lastMonth.setMonth(today.getMonth() - 1);
						localStartDate = lastMonth.toISOString().split('T')[0];
						localEndDate = today.toISOString().split('T')[0];
						applyDateRange();
					}}
				>
					Last 30 days
				</button>
				
				<button 
					type="button" 
					class="btn variant-ghost btn-sm justify-start {buttonClass}" 
					onclick={() => {
						const today = new Date();
						const lastYear = new Date();
						lastYear.setFullYear(today.getFullYear() - 1);
						localStartDate = lastYear.toISOString().split('T')[0];
						localEndDate = today.toISOString().split('T')[0];
						applyDateRange();
					}}
				>
					Last year
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.date-range-picker {
		position: relative;
		display: inline-block;
	}
	
	.date-picker-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 50;
		width: 300px;
		margin-top: 0.5rem;
		max-height: 90vh;
		overflow-y: auto;
	}
	
	/* Ensure dropdown stays in viewport */
	@media (max-width: 400px) {
		.date-picker-dropdown {
			right: -50px;
			width: 280px;
		}
	}
	
	.date-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	/* Fix date input styling for dark mode */
	:global(.dark) .input[type="date"] {
		color-scheme: dark;
	}
</style>
