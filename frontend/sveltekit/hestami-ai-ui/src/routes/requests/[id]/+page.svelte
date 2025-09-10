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
	import { enhance } from '$app/forms';
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
					<form
						method="POST"
						action="?/uploadMedia"
						enctype="multipart/form-data"
						use:enhance={({ formData }) => {
							// Reset states
							isUploading = true;
							uploadSuccess = false;
							uploadError = '';

							// Initialize progress tracking
							totalFiles = files ? files.length : 0;
							currentFileIndex = 0;
							overallProgress = 0;

							// Initialize progress tracking for each file
							if (files) {
								uploadResults = Array.from(files).map((file) => ({
									fileName: file.name,
									success: false,
									progress: 0
								}));
							}

							// Store original fetch to restore it later
							const originalFetch = window.fetch;

							// Override fetch with our custom implementation to track progress
							window.fetch = function (input, init) {
								// Only intercept POST requests with FormData body (file uploads)
								if (init && init.method === 'POST' && init.body instanceof FormData) {
									return new Promise((resolve, reject) => {
										const xhr = new XMLHttpRequest();

										// Open the request
										const url = typeof input === 'string' ? input : (input as Request).url || '';
										const method = init?.method || 'POST';
										xhr.open(method, url);

										// Set headers
										if (init.headers) {
											Object.entries(init.headers).forEach(([key, value]) => {
												if (typeof value === 'string') {
													xhr.setRequestHeader(key, value);
												}
											});
										}

										// Track upload progress
										xhr.upload.addEventListener('progress', (event) => {
											if (event.lengthComputable) {
												// Update progress for current file
												const fileProgress = Math.round((event.loaded / event.total) * 100);

												// Update the progress in uploadResults
												if (currentFileIndex < uploadResults.length) {
													uploadResults[currentFileIndex].progress = fileProgress;

													// Calculate overall progress
													const completedFiles = currentFileIndex;
													const currentProgress = fileProgress / 100;
													overallProgress = Math.round(
														((completedFiles + currentProgress) / totalFiles) * 100
													);
												}
											}
										});

										// Handle load completion
										xhr.addEventListener('load', () => {
											// Create headers object from response headers
											const responseHeaders = new Headers();
											const headerString = xhr.getAllResponseHeaders();
											const headerPairs = headerString.trim().split(/[\r\n]+/);

											headerPairs.forEach((line) => {
												const parts = line.split(': ');
												const header = parts.shift();
												const value = parts.join(': ');
												if (header && value) {
													responseHeaders.append(header, value);
												}
											});

											// Create response object
											const response = new Response(xhr.responseText, {
												status: xhr.status,
												statusText: xhr.statusText,
												headers: responseHeaders
											});

											resolve(response);
										});

										// Handle errors
										xhr.addEventListener('error', () => {
											reject(new Error('Network error'));
										});

										xhr.addEventListener('abort', () => {
											reject(new Error('Request aborted'));
										});

										// Send the request
										// Convert FormData to a format XMLHttpRequest can handle
										if (init.body instanceof FormData) {
											xhr.send(init.body);
										} else {
											// For other body types, convert or send null
											xhr.send(null);
										}
									});
								}

								// For non-file uploads, use the original fetch
								return originalFetch(input, init);
							};

							// Manually add files to the FormData - Django expects a single 'file' field
							if (files && files.length > 0) {
								formData.append('file', files[0]);
								formData.append('title', files[0].name);
								console.log(
									'File added to form data:',
									files[0].name,
									'Size:',
									files[0].size,
									'Type:',
									files[0].type
								);
							} else {
								console.log('No files to upload');
								// Show error message and cancel submission
								uploadError = 'Please select a file to upload';
								isUploading = false;
								return;
							}

							return async ({ result }) => {
								// Restore original fetch function
								window.fetch = originalFetch;

								// Reset uploading state
								isUploading = false;
								console.log('Upload result:', result);

								// Update progress to 100% for all files for visual feedback
								uploadResults = uploadResults.map((item) => ({
									...item,
									progress: 100
								}));

								if (result.type === 'success') {
									interface UploadResult {
										success: boolean;
										message: string;
										results?: Array<{ fileName: string; success: boolean; message?: string }>;
									}

									// First convert to unknown, then check properties
									const resultData = result.data as unknown;

									// Type guard function to check if data matches our interface
									function isUploadResult(data: unknown): data is UploadResult {
										return (
											data !== null &&
											typeof data === 'object' &&
											'success' in data &&
											typeof (data as any).success === 'boolean'
										);
									}

									// Check if the data has the expected structure
									if (isUploadResult(resultData)) {
										// Now TypeScript knows resultData is UploadResult
										uploadSuccess = resultData.success;

										// Update success/failure status from server response
										if (Array.isArray(resultData.results)) {
											// Merge server results with our progress tracking
											uploadResults = uploadResults.map((progressItem) => {
												const serverResult = resultData.results?.find(
													(r) => r.fileName === progressItem.fileName
												);
												return {
													...progressItem,
													success: serverResult ? serverResult.success : false,
													message: serverResult?.message
												};
											});
										}

										// Clear files after successful upload
										if (resultData.success) {
											// Wait a moment to show the success state
											setTimeout(() => {
												files = null;
											}, 1500);
											// Invalidate data to refresh media list
											invalidateAll();
										}
									} else {
										uploadSuccess = false;
										uploadError = 'Received unexpected response format';
									}
								} else if (result.type === 'failure') {
									// Handle the failure case
									uploadSuccess = false;

									// Try to parse the data if it's a string (which appears to be the case from the error)
									let parsedData;
									if (typeof result.data === 'string') {
										try {
											parsedData = JSON.parse(result.data);
											console.log('Parsed error data:', parsedData);

											// Check if it's an array with the error message
											if (Array.isArray(parsedData) && parsedData.length > 0) {
												// The last item in the array seems to be the error message
												const errorMessage = parsedData[parsedData.length - 1];
												if (typeof errorMessage === 'string') {
													uploadError = errorMessage;
													return;
												}
											}
										} catch (e) {
											console.error('Failed to parse error data:', e);
										}
									}

									// If we couldn't parse the data or extract a message, fall back to the original approach
									const resultData = parsedData || result.data;

									// Check if resultData is an object with a message property
									if (resultData && typeof resultData === 'object' && 'message' in resultData) {
										uploadError = String(resultData.message);
									} else if (result.status === 400) {
										// If we have a 400 status, it's likely the 'No files were uploaded' error
										uploadError = 'No files were selected for upload';
									} else {
										// Generic error message
										uploadError = `Failed to upload media (Status: ${result.status})`;
									}
								}
							};
						}}
						class="space-y-4"
					>
						<!-- File upload area -->
						<div
							class="file-upload-container border-surface-300-600-token rounded-lg border-2 border-dashed p-6 text-center"
						>
							<label
								for="file-upload-details"
								class="flex cursor-pointer flex-col items-center justify-center gap-2"
							>
								<Upload class="text-surface-500-400-token h-8 w-8" />
								<span class="text-surface-700-200-token">Click to upload or drag and drop</span>
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
							type="submit"
							class="btn variant-filled-primary w-full"
							disabled={!files || files.length === 0 || isUploading}
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
					</form>
				</div>
			</section>
		</div>
	</div>
</div>

<!-- Timeline styling is now handled with Tailwind classes -->
