'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import ServiceMediaUpload from './ServiceMediaUpload/ServiceMediaUpload';
import MediaPreviewGrid from '../components/MediaUpload/MediaPreviewGrid';

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
}

export interface ServiceMedia {
  id: string;
  file_url: string;
  thumbnail_small_url?: string;
  thumbnail_medium_url?: string;
  thumbnail_large_url?: string;
  file_type: string;
  title: string;
  description: string;
  parent_type: 'SERVICE_REQUEST' | 'SERVICE_REPORT';
  property_ref: string;
  service_request?: string;
  service_report?: string;
  report_photo_type?: 'BEFORE' | 'AFTER';
  upload_date: string;
}

export interface ServiceRequest {
  id?: string;
  type: 'record' | 'request';
  title: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  preferred_schedule: string;
  estimated_duration: number;
  budget?: number;
  provider?: string;
  status?: 'PENDING' | 'BIDDING' | 'REOPENED_BIDDING' | 'ACCEPTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'IN_RESEARCH';
  created_at?: string;
  updated_at?: string;
  media?: string[];  // Array of media IDs for creation
  media_details?: ServiceMedia[];
  mediaFiles?: File[]; // Added mediaFiles property
  is_diy?: boolean;
}

export type ServiceStatus = ServiceRequest['status'];

interface ServiceSectionProps {
  propertyId: string;
  serviceHistory: ServiceRequest[];
  onAddRecord: (record: Omit<ServiceRequest, 'id'>) => Promise<void>;
  onCreateServiceRequest: (request: Omit<ServiceRequest, 'id'>) => Promise<void>;
  onServiceClick?: (serviceId: string) => void;
}

export const ServiceSection: React.FC<ServiceSectionProps> = ({
  propertyId,
  serviceHistory,
  onAddRecord,
  onCreateServiceRequest,
  onServiceClick,
}) => {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaUploadRef = useRef<{ uploadFiles: () => Promise<string[]> }>(null);
  const [formData, setFormData] = useState<ServiceRequest>({
    type: 'request',
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM',
    preferred_schedule: format(new Date(), 'yyyy-MM-dd'),
    estimated_duration: 1,
    media_details: [],
    is_diy: false,
  });

  useEffect(() => {
    const fetchCategories = async () => {
      if (!session?.user?.accessToken) {
        console.error('No access token available');
        return;
      }

      try {
        const response = await fetch('/api/services/categories', {
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }
        
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (session?.user?.accessToken) {
      fetchCategories();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let mediaFiles: File[] = [];
      if (mediaUploadRef.current) {
        const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
        fileInputs.forEach(input => {
          if (input.files) {
            const files = Array.from(input.files) as File[];
            mediaFiles = [...mediaFiles, ...files];
          }
        });
      }

      const serviceData = {
        ...formData,
        property: propertyId,
        mediaFiles // Pass the files to the parent handler
      };

      await onCreateServiceRequest(serviceData);

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error submitting service entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'request',
      title: '',
      description: '',
      category: '',
      priority: 'MEDIUM',
      preferred_schedule: format(new Date(), 'yyyy-MM-dd'),
      estimated_duration: 1,
      media_details: [],
      is_diy: false,
    });
  };

  const handleMediaUploaded = (mediaIds: string[]) => {
    // We'll handle the media IDs during form submission
    console.log('Media files selected:', mediaIds);
  };

  const handleServiceItemClick = (serviceId: string) => {
    if (onServiceClick) {
      onServiceClick(serviceId);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors duration-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Service History</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200"
        >
          Add Service Entry
        </button>
      </div>

      {/* Service History Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Media
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {serviceHistory.map((entry, index) => (
              <tr
                key={index}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                onClick={() => entry.id && handleServiceItemClick(entry.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {format(
                    entry.created_at 
                      ? new Date(entry.created_at)
                      : entry.preferred_schedule 
                        ? new Date(entry.preferred_schedule)
                        : new Date(),
                    'MMM d, yyyy'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {entry.is_diy ? 'DIY' : 'Request'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {entry.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {entry.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      entry.is_diy 
                        ? ''
                        : entry.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                        : entry.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                        : entry.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {entry.is_diy  ? 'N/A' : entry.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {entry.media_details && entry.media_details.length > 0 && (
                    <MediaPreviewGrid
                      items={entry.media_details.map(media => ({
                        id: media.id,
                        name: media.title,
                        type: media.file_type,
                        url: media.file_url,
                        thumbnailUrl: media.thumbnail_small_url,
                      }))}
                      maxDisplay={3}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add Service Entry</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
              <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_diy"
                    name="is_diy"
                    checked={formData.is_diy}
                    onChange={(e) => setFormData({ ...formData, is_diy: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_diy" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    DIY (Do It Yourself)
                  </label>
                </div>
                
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as ServiceRequest['priority'] })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="preferred_schedule" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Preferred Schedule
                  </label>
                  <input
                    type="date"
                    id="preferred_schedule"
                    name="preferred_schedule"
                    value={formData.preferred_schedule}
                    onChange={(e) => setFormData({ ...formData, preferred_schedule: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="estimated_duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Duration (hours)
                  </label>
                  <input
                    type="number"
                    id="estimated_duration"
                    name="estimated_duration"
                    value={formData.estimated_duration}
                    onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Required Attachments
                </label>
                <ServiceMediaUpload
                  ref={mediaUploadRef}
                  propertyId={propertyId}
                  serviceType="request"
                  onMediaUploaded={handleMediaUploaded}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!mediaUploadRef.current}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {formData.is_diy ? "Submit Record" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
