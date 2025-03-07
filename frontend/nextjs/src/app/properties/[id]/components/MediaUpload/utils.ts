import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from './types';

export const generateUniqueId = () => uuidv4();

export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size
  if (file.size > CONFIG.maxFileSize) {
    return {
      isValid: false,
      error: `File size exceeds ${CONFIG.maxFileSize / (1024 * 1024)}MB limit`
    };
  }

  // Check file type
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension || !CONFIG.allowedExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${CONFIG.allowedExtensions.join(', ')}`
    };
  }

  if (!CONFIG.allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} not allowed`
    };
  }

  return { isValid: true };
};

export const createFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to create file preview'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};
