<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Calendar,
		Clock,
		Home,
		MapPin,
		Tag,
		AlertTriangle,
		Upload,
		X,
		Check,
		Image
	} from 'lucide-svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import MediaGallery from '$lib/components/MediaGallery.svelte';
	import { invalidateAll } from '$app/navigation';
	import { format } from 'date-fns';
	import type { ServiceRequest, Media } from '$lib/types';

	// Get data from server-side load function
	export let data: {
		serviceRequest: ServiceRequest;
		media: Media[];
		error: string | null;
	};

	// Reactive variables
	$: serviceRequest = data.serviceRequest;
	$: media = data.media;
	$: error = data.error;

	// Media upload state
	let files: FileList | null = null;
	let isUploading = false;
	let uploadSuccess = false;
	let uploadError = '';
	let uploadResults: Array<{
		fileName: string;
		success: boolean;
		message?: string;
		progress?: number;
	}> = [];
	let currentFileIndex = 0;
	let totalFiles = 0;
	let overallProgress = 0;

	// Handle media upload using direct fetch to API route
	async function handleMediaUpload() {
		if (!files || files.length === 0) {
			uploadError = 'Please select at least one file to upload';
			return;
		}

		// Reset states
		isUploading = true;
		uploadSuccess = false;
		uploadError = '';
		totalFiles = files.length;
		currentFileIndex = 0;
		overallProgress = 0;

		// Initialize progress tracking for each file
		uploadResults = Array.from(files).map((file) => ({
			fileName: file.name,
			success: false,
			progress: 0
		}));

		try {
			// Upload each file
			for (let i = 0; i < files.length; i++) {
				currentFileIndex = i;
				const file = files[i];

				// Create FormData for this file
				const formData = new FormData();
				formData.append('file', file);
				formData.append('title', file.name);

				try {
					// Upload using XMLHttpRequest for progress tracking
					const result = await uploadFileWithProgress(
						`/api/media/services/requests/${serviceRequest.id}/upload`,
						formData,
						i
					);

					uploadResults[i].success = true;
					uploadResults[i].progress = 100;
				} catch (error) {
					console.error(`Error uploading file ${file.name}:`, error);
					uploadResults[i].success = false;
					uploadResults[i].message = error instanceof Error ? error.message : 'Upload failed';
					uploadResults[i].progress = 0;
				}

				// Update overall progress
				overallProgress = Math.round(((i + 1) / totalFiles) * 100);
			}

			// Check if all uploads succeeded
			const allSuccess = uploadResults.every((r) => r.success);
			uploadSuccess = allSuccess;

			if (!allSuccess) {
				uploadError = 'Some files failed to upload';
			} else {
				// Clear files after successful upload
				setTimeout(() => {
					files = null;
					uploadResults = [];
				}, 1500);
				// Refresh media list
				invalidateAll();
			}
		} catch (error) {
			console.error('Error during upload process:', error);
			uploadError = error instanceof Error ? error.message : 'An unexpected error occurred';
		} finally {
			isUploading = false;
		}
	}

	// Upload a single file with progress tracking
	function uploadFileWithProgress(
		url: string,
		formData: FormData,
		fileIndex: number
	): Promise<any> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			// Track upload progress
			xhr.upload.addEventListener('progress', (event) => {
				if (event.lengthComputable) {
					const fileProgress = Math.round((event.loaded / event.total) * 100);
					uploadResults[fileIndex].progress = fileProgress;
				}
			});

			// Handle completion
			xhr.addEventListener('load', () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						const response = JSON.parse(xhr.responseText);
						resolve(response);
					} catch (e) {
						resolve(xhr.responseText);
					}
				} else {
					reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
				}
			});

			// Handle errors
			xhr.addEventListener('error', () => {
				reject(new Error('Network error during upload'));
			});

			xhr.addEventListener('abort', () => {
				reject(new Error('Upload aborted'));
			});

			// Send the request
			xhr.open('POST', url);
			xhr.send(formData);
		});
	}

	// Format date for display
	function formatDate(dateString: string): string {
		return format(new Date(dateString), 'MMM d, yyyy');
	}

	// Format time for display
	function formatTime(dateString: string): string {
		return format(new Date(dateString), 'h:mm a');
	}

	// Get status badge class based on status
	function getStatusClass(status: string): string {
		switch (status) {
			case 'PENDING':
				return 'badge-warning';
			case 'IN_RESEARCH':
				return 'badge-secondary';
			case 'BIDDING':
				return 'badge-primary';
			case 'ACCEPTED':
				return 'badge-success';
			case 'SCHEDULED':
				return 'badge-tertiary';
			case 'IN_PROGRESS':
				return 'badge-primary';
			case 'COMPLETED':
				return 'badge-success';
			case 'CANCELLED':
				return 'badge-error';
			case 'DECLINED':
				return 'badge-error';
			default:
				return 'badge-surface';
		}
	}

	// Format status for display
	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	// Get priority badge class based on priority
	function getPriorityClass(priority: string): string {
		switch (priority) {
			case 'LOW':
				return 'badge-success';
			case 'MEDIUM':
				return 'badge-warning';
			case 'HIGH':
				return 'badge-error';
			case 'URGENT':
				return 'badge-tertiary';
			default:
				return 'badge-surface';
		}
	}

	// Format priority for display
	function formatPriority(priority: string): string {
		return priority.charAt(0) + priority.slice(1).toLowerCase();
	}

	// Check for authentication errors and handle them
	onMount(() => {
		if ($page.error) {
			const errorMessage = $page.error.message || '';
			if (
				errorMessage.includes('Authentication failed') ||
				errorMessage.includes('Unauthorized') ||
				errorMessage.includes('401')
			) {
				goto('/login?returnUrl=' + encodeURIComponent($page.url.pathname));
			}
		}
	});
</script>

<svelte:head>
	<title>Service Request: {serviceRequest.title} - Hestami AI</title>
	<meta name="description" content="Service request details for {serviceRequest.title}" />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
	<!-- Header with back button -->
	<header class="mb-6 flex items-center gap-2">
		<a href="/requests" class="btn-icon variant-soft-surface">
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="h1">{serviceRequest.title}</h1>
		</div>
	</header>

	{#if error}
		<div class="alert variant-filled-warning flex items-center gap-2">
			<AlertTriangle class="h-5 w-5 flex-shrink-0" />
			<span class="text-error-500">{error}</span>
		</div>
	{/if}

	<!-- Actions Section -->
	<section class="card space-y-4 p-4">
		<h2 class="h3">Actions</h2>
		<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row">
			{#if $page.data.user?.user_role === 'STAFF'}
				<button type="button" class="btn preset-filled-primary-500">Update Status</button>
			{/if}
			<a href="#timeline-comment-form" class="btn preset-filled-primary-500">Add Comment</a>
			<button type="button" class="btn preset-filled-primary-500">Cancel Request</button>
		</nav>
	</section>

	<!-- Use a single column layout for better spacing -->
	<div class="space-y-6">
		<!-- Two-column grid for key details -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Left column: Property info -->
			<section class="card space-y-4 p-4">
				<h2 class="h3">Property</h2>
				<div class="space-y-2">
					<div class="flex items-start gap-2">
						<Home class="text-surface-600-300-token mt-0.5 h-5 w-5 flex-shrink-0" />
						<div>
							<p class="font-semibold">{serviceRequest.property_details.title}</p>
						</div>
					</div>
					<div class="flex items-start gap-2">
						<MapPin class="text-surface-600-300-token mt-0.5 h-5 w-5 flex-shrink-0" />
						<p>
							{serviceRequest.property_details.address}, {serviceRequest.property_details.city}, {serviceRequest
								.property_details.state}
						</p>
					</div>
				</div>
				<a href="/properties/{serviceRequest.property}" class="btn variant-soft w-full"
					>View Property</a
				>
			</section>

			<!-- Right column: Request details -->
			<section class="card space-y-4 p-4">
				<h2 class="h3">Details</h2>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-surface-600-300-token">Category</span>
						<span>{serviceRequest.category_display}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-600-300-token">Priority</span>
						<span class="badge {getPriorityClass(serviceRequest.priority)}"
							>{formatPriority(serviceRequest.priority)}</span
						>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-600-300-token">Status</span>
						<span class="badge {getStatusClass(serviceRequest.status)}"
							>{formatStatus(serviceRequest.status)}</span
						>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-surface-600-300-token">Created</span>
						<span>{formatDate(serviceRequest.created_at)}</span>
					</div>
					{#if serviceRequest.scheduled_start}
						<div class="flex items-center justify-between">
							<span class="text-surface-600-300-token">Scheduled</span>
							<span>{formatDate(serviceRequest.scheduled_start)}</span>
						</div>
					{/if}
				</div>
			</section>
		</div>

		<!-- Description card (full width) -->
		<section class="card space-y-4 p-4">
			<h2 class="h3">Description</h2>
			<p class="whitespace-pre-line">{serviceRequest.description}</p>
		</section>

		<!-- Timeline/Activity -->
		<section class="card space-y-4 p-4">
			<Timeline 
				serviceRequestId={serviceRequest.id} 
				refreshData={() => invalidateAll()} 
			/>
		</section>

			<!-- Media Attachments Section -->
			<section class="card space-y-4 p-4">
				<div class="flex items-center gap-2">
					<Image class="h-5 w-5 text-primary-500" />
					<h2 class="h3">Media Attachments</h2>
				</div>

				{#if media && media.length > 0}
					<MediaGallery 
						mediaItems={media}
						title=""
						emptyMessage="No media has been uploaded for this service request"
						columns={3}
						aspectRatio="16/9"
						size="medium"
						showTitles={true}
					/>
				{:else}
					<div class="p-4 text-center text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 rounded-lg">
						No media has been uploaded for this service request
					</div>
				{/if}
			</section>
	</div>
	<div>
		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Category info -->
			<section class="card space-y-4 p-4">
				<div class="space-y-2">
					<!-- Upload feedback messages -->
					{#if uploadSuccess}
						<div class="alert variant-filled-success">
							<Check class="h-5 w-5" />
							<p>Media uploaded successfully!</p>
						</div>
					{:else if uploadError}
						<div class="alert variant-filled-warning flex items-center gap-2">
							<AlertTriangle class="h-5 w-5 flex-shrink-0" />
							<span class="text-error-500">{uploadError}</span>
						</div>
					{/if}

					<!-- Upload form -->
					<div class="space-y-4">
						<!-- File upload area -->
						<div
							class="file-upload-container border-surface-300-600-token rounded-lg border-2 border-dashed p-6 text-center"
						>
							<label
								for="file-upload-details"
								class="flex cursor-pointer flex-col items-center justify-center gap-2"
							>
								<Upload class="text-surface-500-400-token h-8 w-8" />
								<span class="text-surface-700-200-token">Click to select files or drag and drop</span>
								<span class="text-surface-500-400-token text-xs">PNG, JPG, MP4 up to 10MB</span>
							</label>
							<input
								id="file-upload-details"
								name="files"
								type="file"
								accept="image/png, image/jpeg, video/mp4"
								multiple
								bind:files
								class="hidden"
							/>
						</div>

						<!-- File preview area -->
						{#if files && files.length > 0}
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
								{#each Array.from(files) as file, i}
									<div
										class="bg-surface-200-700-token relative aspect-square overflow-hidden rounded-lg"
									>
										{#if file.type.startsWith('image/')}
											<img
												src={URL.createObjectURL(file)}
												alt="Preview"
												class="h-full w-full object-cover"
											/>
										{:else if file.type.startsWith('video/')}
											<!-- Using a video poster approach instead of actual video for preview -->
											<div class="flex h-full w-full items-center justify-center bg-black">
												<span class="badge variant-filled-primary p-2"> Video File </span>
											</div>
											<!-- File name as additional context -->
											<div
												class="absolute right-0 bottom-0 left-0 truncate bg-black/60 p-1 text-xs text-white"
											>
												{file.name}
											</div>
										{/if}
										<button
											type="button"
											class="btn-icon btn-icon-sm variant-filled-error absolute top-1 right-1"
											on:click={() => {
												if (files) {
													const newFiles = Array.from(files).filter((_, index) => index !== i);
													const dt = new DataTransfer();
													newFiles.forEach((f) => dt.items.add(f));
													files = dt.files;
												}
											}}
										>
											<X class="h-3 w-3" />
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Upload progress indicator -->
						{#if isUploading && uploadResults.length > 0}
							<div class="upload-progress-container space-y-3">
								<!-- Overall progress -->
								<div class="space-y-1">
									<div class="flex justify-between text-sm">
										<span>Overall Progress</span>
										<span>{currentFileIndex + 1} of {totalFiles} files</span>
									</div>
									<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
										<div
											class="h-full rounded-full bg-blue-500 transition-all duration-300 ease-in-out"
											style="width: {overallProgress}%"
										></div>
									</div>
								</div>

								<!-- Individual file progress -->
								<div
									class="max-h-40 space-y-2 overflow-y-auto rounded-md bg-gray-50 p-2 dark:bg-gray-800"
								>
									{#each uploadResults as result, i}
										<div class="file-progress space-y-1">
											<div class="flex justify-between text-xs">
												<span class="max-w-[80%] truncate" title={result.fileName}
													>{result.fileName}</span
												>
												<span>{result.progress || 0}%</span>
											</div>
											<div
												class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
											>
												<div
													class="h-full rounded-full transition-all duration-300 ease-in-out"
													class:bg-blue-500={!result.success && !result.message}
													class:bg-green-500={result.success}
													class:bg-red-500={!result.success && result.message}
													style="width: {result.progress || 0}%"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Upload button -->
						<button
							type="button"
							class="btn variant-filled-primary w-full"
							disabled={!files || files.length === 0 || isUploading}
							on:click={handleMediaUpload}
						>
							{#if isUploading}
								<div class="flex items-center justify-center gap-2">
									<div
										class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
									></div>
									Uploading...
								</div>
							{:else}
								Upload Media
							{/if}
						</button>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

<!-- Timeline styling is now handled with Tailwind classes -->
