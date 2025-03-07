'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';
import { format } from 'date-fns';
import ResearchForm from '@/components/services/ResearchForm';
import ResearchHistory from '@/components/services/ResearchHistory';

// Types
interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  category_display: string;
  created_at: string;
  updated_at: string;
  property_details: {
    address: string;
    city: string;
    state: string;
    zip_code: string;
  };
  created_by_details: {
    name: string;
    email: string;
  };
  research_entries: ResearchEntry[];
}

interface ResearchEntry {
  id: string;
  research_data: any;
  research_content: string;
  notes: string;
  created_at: string;
  updated_at: string;
  researched_by_details: {
    name: string;
    email: string;
  };
}

export default function ServiceRequestDetail() {
  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/login';
    },
  });
  const { mounted } = useThemeMode();
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id as string;
  
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch service request details
  useEffect(() => {
    const fetchRequestDetails = async () => {
      if (!session?.user || !requestId) return;
      
      try {
        setLoading(true);
        
        const response = await fetch(`/api/services/requests/${requestId}`, {
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setRequest(data);
        } else {
          console.error('Failed to fetch service request details');
          setError('Failed to load service request details');
        }
      } catch (error) {
        console.error('Error fetching service request details:', error);
        setError('An error occurred while loading the service request');
      } finally {
        setLoading(false);
      }
    };

    fetchRequestDetails();
  }, [session, requestId]);

  // Handle research submission
  const handleResearchSubmit = async (formData: any) => {
    if (!session?.user || !requestId) return;
    
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const response = await fetch(`/api/services/requests/${requestId}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update the request with the new research entry
        setRequest(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            research_entries: [data, ...prev.research_entries],
            status: formData.update_status ? 'IN_RESEARCH' : prev.status,
          };
        });
        
        setSuccess('Research data added successfully');
        setShowResearchForm(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add research data');
      }
    } catch (error) {
      console.error('Error submitting research data:', error);
      setError('An error occurred while submitting research data');
    } finally {
      setSubmitting(false);
    }
  };

  // Prevent hydration mismatch
  if (!mounted || !session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Service Requests
          </button>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Loading service request details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          ) : request ? (
            <>
              {success && (
                <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-400 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700 dark:text-green-200">{success}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Service Request Header */}
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg mb-8">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {request.title}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                      Service Request #{request.id.substring(0, 8)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    request.status === 'IN_RESEARCH' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    request.status === 'BIDDING' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                    request.status === 'SCHEDULED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                    request.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                    request.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    request.status === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {request.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Category
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {request.category_display}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Priority
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {request.priority}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Created By
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {request.created_by_details.name} ({request.created_by_details.email})
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Created At
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Last Updated
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {format(new Date(request.updated_at), 'MMM d, yyyy h:mm a')}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Location
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {request.property_details.address}, {request.property_details.city}, {request.property_details.state} {request.property_details.zip_code}
                      </dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Description
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">
                        {request.description}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              {/* Research Section */}
              <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mb-8">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Research History
                  </h2>
                  <button
                    onClick={() => setShowResearchForm(!showResearchForm)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-main hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main"
                  >
                    {showResearchForm ? 'Cancel' : 'Add Research'}
                  </button>
                </div>
                
                {showResearchForm && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                    <ResearchForm 
                      serviceRequestId={requestId}
                      onSubmit={handleResearchSubmit}
                      submitting={submitting}
                    />
                  </div>
                )}
                
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <ResearchHistory 
                    researchEntries={request.research_entries}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Service request not found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
