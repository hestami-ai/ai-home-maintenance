<script lang="ts">
  /**
   * Chat Input Component
   * 
   * Text input with send button and file upload support.
   * Files are uploaded via /api/chat/files/upload before sending the message.
   */
  
  // Allowed file extensions (must match backend)
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'md', 'pdf', 'docx', 'txt', 'doc', 'usdz'];
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  
  interface UploadedFile {
    file_id: string;
    _id?: string;
    filename: string;
    type: string;
    size: number;
    width?: number;
    height?: number;
    filepath?: string;
  }
  
  interface PendingFile {
    file: File;
    status: 'pending' | 'uploading' | 'uploaded' | 'error';
    error?: string;
    uploadedData?: UploadedFile;
    width?: number;
    height?: number;
  }
  
  interface Props {
    disabled?: boolean;
    onSend?: (data: { text: string; files: UploadedFile[] }) => void;
  }
  
  let { disabled = false, onSend }: Props = $props();
  
  let inputText = $state('');
  let fileInput: HTMLInputElement | undefined = $state();
  let pendingFiles: PendingFile[] = $state([]);
  let isUploading = $state(false);
  
  /**
   * Get image dimensions from a File object
   */
  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  }
  
  /**
   * Upload a single file to the server
   */
  async function uploadFile(pendingFile: PendingFile): Promise<UploadedFile | null> {
    const formData = new FormData();
    formData.append('file', pendingFile.file);
    formData.append('endpoint', 'google'); // Default endpoint
    
    // Include image dimensions if available
    if (pendingFile.width && pendingFile.height) {
      formData.append('width', pendingFile.width.toString());
      formData.append('height', pendingFile.height.toString());
    }
    
    try {
      const response = await fetch('/api/chat/files/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        file_id: result.file_id,
        _id: result._id,
        filename: result.filename,
        type: result.type,
        size: result.size,
        width: result.width,
        height: result.height,
        filepath: result.filepath
      };
    } catch (err) {
      console.error('File upload error:', err);
      throw err;
    }
  }
  
  /**
   * Upload all pending files
   */
  async function uploadAllFiles(): Promise<UploadedFile[]> {
    const uploadedFiles: UploadedFile[] = [];
    
    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i];
      if (pf.status === 'uploaded' && pf.uploadedData) {
        uploadedFiles.push(pf.uploadedData);
        continue;
      }
      
      pendingFiles[i] = { ...pf, status: 'uploading' };
      pendingFiles = [...pendingFiles]; // Trigger reactivity
      
      try {
        const result = await uploadFile(pf);
        if (result) {
          pendingFiles[i] = { ...pf, status: 'uploaded', uploadedData: result };
          uploadedFiles.push(result);
        }
      } catch (err) {
        pendingFiles[i] = { 
          ...pf, 
          status: 'error', 
          error: err instanceof Error ? err.message : 'Upload failed' 
        };
      }
      pendingFiles = [...pendingFiles]; // Trigger reactivity
    }
    
    return uploadedFiles;
  }
  
  async function handleSubmit() {
    if ((!inputText.trim() && pendingFiles.length === 0) || disabled || isUploading) return;
    
    isUploading = true;
    
    try {
      // Upload any pending files first
      const uploadedFiles = await uploadAllFiles();
      
      // Check if any uploads failed
      const failedUploads = pendingFiles.filter(pf => pf.status === 'error');
      if (failedUploads.length > 0) {
        // Don't send message if uploads failed
        isUploading = false;
        return;
      }
      
      // Call the onSend callback with text and uploaded files
      onSend?.({ 
        text: inputText,
        files: uploadedFiles
      });
      
      // Clear input
      inputText = '';
      pendingFiles = [];
    } finally {
      isUploading = false;
    }
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      const newFiles = Array.from(target.files);
      
      // Validate each file
      for (const file of newFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          alert(`File type .${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
          continue;
        }
        
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Maximum size is 100MB.`);
          continue;
        }
        
        // For images, extract dimensions before adding to pending files
        const isImage = IMAGE_EXTENSIONS.includes(ext);
        if (isImage) {
          // Extract dimensions asynchronously
          getImageDimensions(file)
            .then(({ width, height }) => {
              pendingFiles = [...pendingFiles, { file, status: 'pending', width, height }];
            })
            .catch((err) => {
              console.warn('Failed to get image dimensions:', err);
              // Still add the file, server will handle it
              pendingFiles = [...pendingFiles, { file, status: 'pending' }];
            });
        } else {
          pendingFiles = [...pendingFiles, { file, status: 'pending' }];
        }
      }
      
      // Reset file input
      target.value = '';
    }
  }
  
  function removeFile(index: number) {
    pendingFiles = pendingFiles.filter((_, i) => i !== index);
  }
  
  function triggerFileInput() {
    fileInput?.click();
  }
  
  // Computed: check if we can submit
  let canSubmit = $derived((inputText.trim() || pendingFiles.length > 0) && !disabled && !isUploading);
  let hasErrors = $derived(pendingFiles.some(pf => pf.status === 'error'));
</script>

<div class="chat-input-container">
  {#if pendingFiles.length > 0}
    <div class="uploaded-files mb-2 flex flex-wrap gap-2">
      {#each pendingFiles as pf, index}
        <div class="file-chip" class:uploading={pf.status === 'uploading'} class:error={pf.status === 'error'} class:uploaded={pf.status === 'uploaded'}>
          {#if pf.status === 'uploading'}
            <svg class="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else if pf.status === 'uploaded'}
            <svg class="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else if pf.status === 'error'}
            <svg class="h-4 w-4 mr-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {/if}
          <span class="file-name" title={pf.error || pf.file.name}>{pf.file.name}</span>
          <button
            type="button"
            onclick={() => removeFile(index)}
            class="remove-file"
            aria-label="Remove file"
            disabled={pf.status === 'uploading'}
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
    {#if hasErrors}
      <div class="text-red-500 text-sm mb-2">
        Some files failed to upload. Remove them or try again.
      </div>
    {/if}
  {/if}
  
  <div class="input-wrapper">
    <input
      type="file"
      bind:this={fileInput}
      onchange={handleFileSelect}
      accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.md,.pdf,.docx,.txt,.doc,.usdz"
      multiple
      class="hidden"
    />
    
    <button
      type="button"
      onclick={triggerFileInput}
      {disabled}
      class="attach-button"
      aria-label="Attach file"
      title="Attach file"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    </button>
    
    <textarea
      bind:value={inputText}
      onkeydown={handleKeyDown}
      {disabled}
      placeholder="Type your message... (Shift+Enter for new line)"
      class="message-input"
      rows="1"
    ></textarea>
    
    <button
      type="button"
      onclick={handleSubmit}
      disabled={!canSubmit}
      class="send-button"
      aria-label="Send message"
    >
      {#if disabled || isUploading}
        <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else}
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .chat-input-container {
    width: 100%;
  }
  
  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background-color: rgb(var(--color-surface-100));
    border-radius: 0.5rem;
    border: 1px solid rgb(var(--color-surface-300));
    padding: 0.5rem;
  }
  
  .input-wrapper:focus-within {
    border-color: rgb(var(--color-primary-500));
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow: 0 0 0 1px rgb(var(--color-primary-500));
  }
  
  :global(.dark) .input-wrapper {
    background-color: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }
  
  .attach-button {
    flex-shrink: 0;
    padding: 0.5rem;
    color: rgb(var(--color-surface-500));
    border-radius: 0.5rem;
    transition: all 0.2s;
  }
  
  .attach-button:hover:not(:disabled) {
    color: rgb(var(--color-surface-700));
    background-color: rgb(var(--color-surface-200));
  }
  
  .attach-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  :global(.dark) .attach-button:hover:not(:disabled) {
    color: rgb(var(--color-surface-300));
    background-color: rgb(var(--color-surface-700));
  }
  
  .message-input {
    flex: 1;
    resize: none;
    border: 0;
    background: transparent;
    font-size: 0.875rem;
    max-height: 8rem;
    overflow-y: auto;
    color: rgb(var(--color-surface-900));
  }
  
  :global(.dark) .message-input {
    color: rgb(var(--color-surface-100));
  }
  
  .message-input:focus {
    outline: none;
    box-shadow: none;
  }
  
  .message-input::placeholder {
    color: rgb(var(--color-surface-400));
  }
  
  :global(.dark) .message-input::placeholder {
    color: rgb(var(--color-surface-500));
  }
  
  .send-button {
    flex-shrink: 0;
    padding: 0.5rem;
    background-color: rgb(var(--color-primary-500));
    color: white;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }
  
  .send-button:hover:not(:disabled) {
    background-color: rgb(var(--color-primary-600));
  }
  
  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: rgb(var(--color-primary-500));
  }
  
  .uploaded-files {
    padding: 0.5rem;
    background-color: rgb(var(--color-surface-100));
    border-radius: 0.5rem;
  }
  
  :global(.dark) .uploaded-files {
    background-color: rgb(var(--color-surface-800));
  }
  
  .file-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background-color: rgb(var(--color-surface-50));
    border: 1px solid rgb(var(--color-surface-300));
    border-radius: 9999px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .file-chip.uploading {
    opacity: 0.7;
    border-color: rgb(var(--color-primary-400));
  }
  
  .file-chip.uploaded {
    border-color: rgb(var(--color-success-500, 34, 197, 94));
  }
  
  .file-chip.error {
    border-color: rgb(var(--color-error-500));
    background-color: rgb(var(--color-error-50, 254, 242, 242));
  }
  
  :global(.dark) .file-chip {
    background-color: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }
  
  :global(.dark) .file-chip.error {
    background-color: rgb(var(--color-error-900, 127, 29, 29));
  }
  
  .file-name {
    color: rgb(var(--color-surface-700));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20rem;
  }
  
  :global(.dark) .file-name {
    color: rgb(var(--color-surface-300));
  }
  
  .remove-file {
    color: rgb(var(--color-surface-400));
    transition: color 0.2s;
  }
  
  .remove-file:hover {
    color: rgb(var(--color-error-500));
  }
</style>
