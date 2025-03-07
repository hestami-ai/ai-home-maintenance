'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { useThemeMode } from '@/hooks/useThemeMode';

// Define interfaces for TinyMCE types
interface BlobInfo {
  blob: () => Blob;
  base64: () => string;
  filename: () => string;
  name: () => string;
}

interface ResearchFormProps {
  serviceRequestId: string;
  onSubmit: (formData: any) => Promise<void>;
  submitting: boolean;
}

export default function ResearchForm({ serviceRequestId, onSubmit, submitting }: ResearchFormProps) {
  // Define the editor type properly
  const editorRef = useRef<any>(null);
  const [notes, setNotes] = useState('');
  const [updateStatus, setUpdateStatus] = useState(true);
  const [researchData, setResearchData] = useState<Record<string, any>>({});
  const { isDarkMode } = useThemeMode();
  
  // State to store editor content
  const [editorContent, setEditorContent] = useState('');
  const [editorKey, setEditorKey] = useState(Date.now());
  
  // Load saved content on initial render
  useEffect(() => {
    const savedContent = localStorage.getItem(`research-editor-${serviceRequestId}`);
    if (savedContent) {
      setEditorContent(savedContent);
    }
  }, [serviceRequestId]);
  
  // Force editor to remount with correct theme when visibility changes
  useEffect(() => {
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force remount of editor with current theme when tab becomes visible
        setEditorKey(Date.now());
      }
    };
    
    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Save content when it changes
  const handleEditorChange = (content: string) => {
    setEditorContent(content);
    localStorage.setItem(`research-editor-${serviceRequestId}`, content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get the latest content from the editor
    const currentContent = editorRef.current ? editorRef.current.getContent() : editorContent;
    
    const formData = {
      research_data: researchData,
      research_content: currentContent,
      notes: notes,
      update_status: updateStatus
    };
    
    await onSubmit(formData);
  };

  // Function to compress images before Base64 encoding
  const compressImage = (file: Blob, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 with compression
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Create editor configuration
  const getEditorConfig = useCallback(() => {
    return {
      license_key: 'gpl',
      directionality: 'ltr',
      height: 400,
      menubar: true,
      skin: isDarkMode ? 'oxide-dark' : 'oxide',
      content_css: isDarkMode ? 'dark' : 'default',
      plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount directionality',
      toolbar: 'undo redo | formatselect | ' +
        'bold italic backcolor | alignleft aligncenter ' +
        'alignright alignjustify | bullist numlist outdent indent | ' +
        'removeformat | help | image ',
      paste_data_images: true,
      convert_urls: false,
      paste_postprocess: function(plugin: any, args: any) {
        // Find all images in pasted content
        const images = args.node.querySelectorAll('img');
        
        // Process each image
        images.forEach((img: HTMLImageElement) => {
          const src = img.getAttribute('src');
          
          // Only process external images (not data: or blob: URLs)
          if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
            // Create a placeholder while the image loads
            const originalSrc = src;
            img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%2250%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23eee%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ELoading...%3C%2Ftext%3E%3C%2Fsvg%3E');
            
            // Load the image via canvas to convert to data URL
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const newImg = new Image();
            
            // Handle CORS issues
            newImg.crossOrigin = 'anonymous';
            
            newImg.onload = function() {
              // Set canvas dimensions to match image
              canvas.width = newImg.width;
              canvas.height = newImg.height;
              
              // Draw image to canvas and convert to data URL
              ctx?.drawImage(newImg, 0, 0);
              try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                img.setAttribute('src', dataUrl);
              } catch (e) {
                console.error('Could not convert image to data URL:', e);
                // If conversion fails, try to use the original URL
                img.setAttribute('src', originalSrc);
              }
            };
            
            newImg.onerror = function() {
              console.error('Could not load image:', originalSrc);
              // If loading fails, show an error placeholder
              img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%2250%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23f8d7da%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%23721c24%22%3EImage%20failed%20to%20load%3C%2Ftext%3E%3C%2Fsvg%3E');
            };
            
            // Add a proxy URL or try directly if your CSP allows it
            try {
              newImg.src = originalSrc;
            } catch (e) {
              console.error('Error setting image source:', e);
            }
          }
        });
      },
      images_upload_handler: async (blobInfo: BlobInfo, progress: (percent: number) => void) => {
        try {
          const compressedImage = await compressImage(blobInfo.blob());
          return compressedImage;
        } catch (error) {
          console.error('Error processing image:', error);
          return '';
        }
      },
      setup: (editor: any) => {
        // Save content on blur
        editor.on('blur', () => {
          const content = editor.getContent();
          localStorage.setItem(`research-editor-${serviceRequestId}`, content);
        });
        
        // Save content periodically
        editor.on('change', () => {
          const content = editor.getContent();
          localStorage.setItem(`research-editor-${serviceRequestId}`, content);
        });
      }
    };
  }, [isDarkMode, serviceRequestId]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="research-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Research Content
        </label>
        <div className="mt-1">
          <Editor
            key={editorKey}
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            onInit={(evt: any, editor: any) => editorRef.current = editor}
            value={editorContent}
            onEditorChange={handleEditorChange}
            init={getEditorConfig()}
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Additional Notes
        </label>
        <div className="mt-1">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="shadow-sm focus:ring-primary-main focus:border-primary-main block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Add any additional notes or context about your research"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="update-status"
            name="update-status"
            type="checkbox"
            className="focus:ring-primary-main h-4 w-4 text-primary-main border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
            checked={updateStatus}
            onChange={(e) => setUpdateStatus(e.target.checked)}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="update-status" className="font-medium text-gray-700 dark:text-gray-300">
            Update request status to "In Research"
          </label>
          <p className="text-gray-500 dark:text-gray-400">
            This will notify the property owner that their request is being researched.
          </p>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-main hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main ${
            submitting ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Research'}
        </button>
      </div>
    </form>
  );
}
