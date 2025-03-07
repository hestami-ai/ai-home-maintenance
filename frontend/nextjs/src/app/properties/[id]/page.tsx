'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
//import Image from 'next/image';
import Navbar from '@/components/Navbar';
import MainImageUpload from './components/MainImageUpload';
import ImagesSection from './components/ImagesSection';
import VideosSection from './components/VideosSection';
import MediaUploadModal from './components/MediaUpload/MediaUploadModal';
import VirtualTourSection from './components/VirtualTourSection';
import FloorplansSection from './components/FloorplansSection';
import DescriptivesSection from './components/DescriptivesSection';
import { ServiceSection, ServiceRequest, ServiceStatus } from './components/ServiceSection';
import { ChatButton } from '@/components/chat/ChatButton';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MediaType, MediaSubType } from './components/MediaUpload/types';

export interface PropertyMedia {
  id: string;
  file_url: string;
  location_type: string;
  location_sub_type: string;
  media_type: string;
  media_sub_type: string;
  location_display: string;
  is_deleted: boolean;
  thumbnail_large_url: string;
  thumbnail_medium_url: string;
  thumbnail_small_url: string;
  file_type: string;
  is_image: boolean;
  is_video: boolean;
  title: string;
  description: string;
  upload_date: string;
  file_size: number;
  parent_type: 'PROPERTY' | 'SERVICE_REQUEST' | 'SERVICE_REPORT';
  property_ref?: string;
  service_request?: string;
  service_report?: string;
  report_photo_type?: 'BEFORE' | 'AFTER';
}


interface PropertyDetails {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  description: string;
  title: string;
  virtualTourUrl?: string;
  service_requests: ServiceRequest[];
  media: PropertyMedia[];
  descriptives: any; // TODO: Type this properly using DescriptivesFormData
}

export default function PropertyDetailsPage() {
  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/login';
    },
  });

  const params = useParams();
  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [mainImage, setMainImage] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'descriptives' | 'virtualTour' | 'floorplans'>('images');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isImageGalleryLoaded, setIsImageGalleryLoaded] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPhotoSphereLoaded, setIsPhotoSphereLoaded] = useState(true); // Set to true by default since we don't need to wait for it to load
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoSphereRef = React.useRef(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeServiceRequest, setActiveServiceRequest] = useState<string | null>(null);

  const fetchPropertyDetails = async () => {
    if (!session?.user) return;

    try {
      const response = await fetch(`/api/properties/${params.id}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const typedServiceRequests = data.service_requests?.map((sr: any) => {
          const status = sr.status as ServiceStatus;
          return {
            id: sr.id,
            type: sr.report ? 'record' : 'request',
            title: sr.title,
            description: sr.description,
            category: sr.category,
            priority: sr.priority as ServiceRequest['priority'],
            preferred_schedule: sr.preferred_schedule,
            estimated_duration: sr.estimated_duration,
            budget: sr.budget_maximum,
            provider: sr.provider?.company_name,
            status,
            created_at: sr.created_at,
            updated_at: sr.updated_at,
            is_diy: sr.is_diy,
            media_details: sr.media_details?.map((media: any) => ({
              id: media.id,
              file_name: media.file_name || media.title || '',
              file_type: media.file_type || media.media_type || '',
              file_url: media.file_url,
              thumbnail_small_url: media.thumbnail_small_url,
              thumbnail_medium_url: media.thumbnail_medium_url,
              thumbnail_large_url: media.thumbnail_large_url,
            }))
          } satisfies ServiceRequest;
        }) || [];
        setProperty({
          ...data,
          service_requests: typedServiceRequests
        });
      }
    } catch (error) {
      console.error('Failed to fetch property details:', error);
    }
  };

  const fetchPropertyMedia = async () => {
    if (!session?.user || !params.id) return;
    try {
      const response = await fetch(`/api/media/properties/${params.id}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const mediaData = await response.json();
        setProperty(prev => prev ? { ...prev, media: mediaData } : null);

        // Update main image if it hasn't been set yet
        const streetViewImage = mediaData.find(
          (m: PropertyMedia) => (m.location_sub_type === 'STREET_VIEW' || m.location_sub_type === 'MAP_VIEW') && !m.is_deleted
        );
        if (!mainImage && streetViewImage) {
          setMainImage(streetViewImage.file_url);
        }

        // Set image gallery as loaded after media is fetched
        setIsImageGalleryLoaded(true);
      }
    } catch (error) {
      console.error('Failed to fetch property media:', error);
    }
  };

  const handleToggleRoom = async (roomName: string) => {
    const newSelectedRooms = new Set(selectedRooms);
    
    if (selectedRooms.has(roomName)) {
      // Don't allow deselecting if it's the last selected room
      if (selectedRooms.size > 1) {
        newSelectedRooms.delete(roomName);
      } else {
        // If trying to deselect the last room, do nothing
        return;
      }
    } else {
      newSelectedRooms.add(roomName);
    }
    
    setSelectedRooms(newSelectedRooms);
    
    // Force re-render by updating a state
    setIsImageGalleryLoaded(false);
    setTimeout(() => setIsImageGalleryLoaded(true), 10);
  };

  const handleOpenUploadModal = () => {
    setIsUploadModalOpen(true);
  };

  const formatMediaToGalleryImages = (media: PropertyMedia[]) => {
    // First filter out videos, 360 degree images, and floorplans
    let filteredMedia = media?.filter(item => 
      !item.is_video && 
      !item.media_sub_type.startsWith('360_DEGREE') && 
      !item.media_sub_type.startsWith('FLOORPLAN')
    ) || [];
    
    // Then filter by selected rooms - only show images from rooms that are selected
    if (selectedRooms.size > 0) {
      filteredMedia = filteredMedia.filter(item => 
        !item.location_display || selectedRooms.has(item.location_display)
      );
    }
    
    // Map to gallery format
    return filteredMedia.map(item => ({
      original: item.file_url,
      originalTitle: item.location_display || 'Property Image',
      originalAlt: item.location_display || `Property image from ${item.location_type || 'unspecified location'}`,
      description: item.description || '',
      thumbnail: item.thumbnail_small_url,
      thumbnailTitle: item.location_display || 'Property Image',
      thumbnailAlt: item.location_display || `Property image from ${item.location_type || 'unspecified location'}`,
      thumbnailLabel: item.location_display || '',
      thumbnailWidth: 100,
      thumbnailHeight: 100,
      originalWidth: 500,
      originalHeight: 500,
    }));
  };

  const formatVirtualTourData = (media: PropertyMedia[]) => {
    return media
      ?.filter(item => item.media_sub_type.startsWith('360_DEGREE'))
      .map(item => ({
        id: item.id,
        url: `/api/proxy?url=${encodeURIComponent(item.file_url)}`,
        room: item.location_display
      })) || [];
  };

  const formatFloorplanGalleryImages = (media: PropertyMedia[]) => {
    const floorplans = media?.filter(item => item.media_sub_type === 'FLOORPLAN' && !item.is_video).map(item => ({
      original: item.file_url,
      originalTitle: item.title || 'Floorplan',
      originalAlt: item.title || `Property floorplan${item.location_display ? ` for ${item.location_display}` : ''}`,
      description: item.description || '',
      thumbnail: item.thumbnail_small_url,
      thumbnailTitle: item.title || 'Floorplan',
      thumbnailAlt: item.title || `Property floorplan${item.location_display ? ` for ${item.location_display}` : ''}`,
      thumbnailLabel: item.location_display || '',
      thumbnailWidth: 100,
      thumbnailHeight: 100,
      originalWidth: 800,
      originalHeight: 600
    })) || [];
    return floorplans;
  };

  const handleAddServiceRecord = async (record: Omit<ServiceRequest, 'id'>) => {
    if (!property) {
      console.error('Property not found');
      return;
    }

    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/properties/${property.id}/services/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error('Failed to add service record');
      }

      const newRecord = await response.json();
      setProperty(prev => prev ? {
        ...prev,
        service_requests: [...prev.service_requests, {
          ...newRecord,
          media_details: newRecord.media_details?.map((media: any) => ({
            id: media.id,
            file_url: media.file_url,
            thumbnail_small_url: media.thumbnail_small_url,
            thumbnail_medium_url: media.thumbnail_medium_url,
            thumbnail_large_url: media.thumbnail_large_url,
            file_type: media.file_type,
            title: media.title,
            description: media.description,
            parent_type: media.parent_type as 'SERVICE_REQUEST' | 'SERVICE_REPORT',
            property_ref: media.property_ref,
            service_request: media.service_request,
            service_report: media.service_report,
            report_photo_type: media.report_photo_type as 'BEFORE' | 'AFTER' | undefined,
            upload_date: media.upload_date
          }))
        }]
      } : prev);
    } catch (error) {
      console.error('Error adding service record:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateServiceRequest = async (request: any) => {
    if (!property) {
      console.error('Property not found');
      return;
    }

    if (!session?.user?.accessToken) {
      console.error('No access token available');
      return;
    }

    try {
      // Convert estimated_duration from hours to ISO duration string
      const hours = parseInt(request.estimated_duration);
      const duration = `PT${hours}H`;

      // Format preferred_schedule as a JSON object
      const scheduleDate = new Date(request.preferred_schedule);
      const preferredSchedule = {
        date: scheduleDate.toISOString().split('T')[0],
        flexible: true,
      };

      const requestData = {
        property: property.id,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        preferred_schedule: preferredSchedule,
        estimated_duration: duration,
        is_diy: request.is_diy || false,
      };
      
      // First, create the service request
      const response = await fetch(`/api/services/requests/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Service request error:', errorData);
        throw new Error(`Failed to create service request: ${JSON.stringify(errorData)}`);
      }

      const createdRequest = await response.json();

      // Now upload any media files
      if (request.mediaFiles && request.mediaFiles.length > 0) {
        for (const file of request.mediaFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('service_request_ref', createdRequest.id);
          formData.append('media_purpose', 'SERVICE_REQUEST');
          formData.append('title', file.name);
          formData.append('file_type', file.type);
          formData.append('file_size', file.size.toString());
          formData.append('media_type', 'OTHER');
          formData.append('media_sub_type', 'OTHER');
          formData.append('location_type', 'OTHER');
          formData.append('location_sub_type', 'OTHER');

          const mediaResponse = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
          });

          if (!mediaResponse.ok) {
            console.error('Failed to upload media:', file.name, await mediaResponse.json());
          }
        }
      }

      // Refresh property data to get updated service history
      fetchPropertyDetails();
    } catch (error) {
      console.error('Error creating service request:', error);
      // TODO: Show error toast
    }
  };

  const handleServiceClick = (serviceId: string) => {
    setActiveServiceRequest(serviceId);
    setIsChatOpen(true);
  };

  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!session?.user || !params.id) return;

      try {
        if (isSubscribed) {
          await fetchPropertyDetails();
          await fetchPropertyMedia();
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [session?.user, params.id]);

  // Get unique room names from media
  const availableRooms = [...new Set(property?.media?.filter(item => 
    !item.is_video && 
    !item.media_sub_type.startsWith('360_DEGREE') && 
    !item.media_sub_type.startsWith('FLOORPLAN') && 
    item.location_display
  ).map(item => item.location_display) || [])];

  // Initialize selectedRooms with all available rooms when they become available
  const initialRoomsSetRef = React.useRef(false);
  
  useEffect(() => {
    if (property?.media && availableRooms.length > 0 && !initialRoomsSetRef.current) {
      setSelectedRooms(new Set(availableRooms));
      initialRoomsSetRef.current = true;
    }
  }, [property?.media, availableRooms]);

  // Get unique room names from virtual tours
  const availableTourRooms = [...new Set(property?.media?.filter(item => 
    item.media_sub_type.startsWith('360_DEGREE') && 
    item.location_display
  ).map(item => item.location_display) || [])];

  // Get unique room names from floorplans
  const availableFloorplanRooms = [...new Set(property?.media?.filter(item => 
    item.media_sub_type === 'FLOORPLAN' && 
    item.location_display
  ).map(item => item.location_display) || [])];

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-6 py-1">
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {/* Main Content */}
      <div className="pt-16">
        {/* Main Image Section */}
        <MainImageUpload
          propertyId={property.id}
          currentImage={mainImage}
          onImageUpdated={fetchPropertyDetails}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {property.address}
          </h1>

          {/* Media and Details Section */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Media</h3>
              <button
                onClick={handleOpenUploadModal}
                className="bg-secondary-main hover:bg-secondary-dark text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Media
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex">
                {(['images', 'videos', 'descriptives', 'virtualTour', 'floorplans'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm
                      ${activeTab === tab
                        ? 'border-primary-main text-primary-main dark:text-primary-light'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'images' && (
                <ImagesSection
                  images={formatMediaToGalleryImages(property?.media || [])}
                  selectedRooms={selectedRooms}
                  availableRooms={availableRooms}
                  isImageGalleryLoaded={isImageGalleryLoaded}
                  onToggleRoom={handleToggleRoom}
                  onOpenUploadModal={handleOpenUploadModal}
                />
              )}

              {activeTab === 'videos' && (
                <VideosSection
                  videos={property.media}
                  isCurrentOwner={true} // TODO: Update this based on actual ownership check
                  onVideoUpdated={fetchPropertyMedia}
                  onOpenUploadModal={() => setIsUploadModalOpen(true)}
                />
              )}

              {activeTab === 'descriptives' && (
                <DescriptivesSection
                  propertyId={property?.id || ''}
                  initialData={property?.descriptives}
                  onSave={async (data) => {
                    try {
                      const response = await fetch(`/api/properties/${property?.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          descriptives: data
                        }),
                      });
                      
                      if (!response.ok) {
                        throw new Error('Failed to update property descriptives');
                      }

                      const updatedProperty = await response.json();
                      setProperty(updatedProperty);
                    } catch (error) {
                      console.error('Error updating property descriptives:', error);
                      throw error; // Re-throw to be handled by the component
                    }
                  }}
                />
              )}

              {activeTab === 'virtualTour' && (
                <VirtualTourSection
                  tours={formatVirtualTourData(property?.media || [])}
                  selectedRooms={Array.from(selectedRooms)}
                  availableRooms={availableTourRooms}
                  onRoomSelect={(rooms) => {
                    setSelectedRooms(new Set(rooms));
                  }}
                />
              )}

              {activeTab === 'floorplans' && (
                <FloorplansSection
                  images={formatFloorplanGalleryImages(property?.media || [])}
                  selectedRooms={selectedRooms}
                  availableRooms={availableFloorplanRooms}
                  isImageGalleryLoaded={isImageGalleryLoaded}
                  onToggleRoom={handleToggleRoom}
                />
              )}
            </div>
          </div>

          {/* Service Section */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <ServiceSection
              propertyId={Array.isArray(params.id) ? params.id[0] : params.id}
              serviceHistory={property?.service_requests.map(service => ({
                id: service.id,
                type: service.type,
                title: service.title,
                description: service.description,
                category: service.category,
                priority: service.priority,
                preferred_schedule: service.preferred_schedule,
                estimated_duration: service.estimated_duration,
                budget: service.budget,
                provider: service.provider,
                status: service.status as ServiceStatus,
                created_at: service.created_at,
                updated_at: service.updated_at,
                media_details: service.media_details,
                is_diy: service.is_diy
              } as ServiceRequest))}
              onAddRecord={handleAddServiceRecord}
              onCreateServiceRequest={handleCreateServiceRequest}
              onServiceClick={handleServiceClick}
            />
          </div>

          {/* Media Upload Modal */}
          <MediaUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => {
              setIsUploadModalOpen(false);
              fetchPropertyMedia(); // Refresh media after upload
            }}
            propertyId={property.id}
          />

        </div>
      </div>

      {/* Chat Components */}
      {activeServiceRequest ? (
        <ChatWindow
          serviceRequestId={activeServiceRequest}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setActiveServiceRequest(null);
          }}
        />
      ) : (
        <ChatButton
          onClick={() => {
            // If no service request is selected, use the first one from the list
            if (property?.service_requests?.length > 0) {
              const firstServiceRequest = property.service_requests[0];
              setActiveServiceRequest(firstServiceRequest.id || null);
              setIsChatOpen(true);
            }
          }}
          isOpen={isChatOpen}
        />
      )}
    </div>
  );
}
