'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';

interface ProfileData {
  business_name?: string;
  billing_address?: string;
  tax_id?: string;
  preferred_contact_method?: string;
  business_license?: string;
  insurance_info?: Record<string, unknown>;
  service_areas?: string[];
  service_categories?: string[];
  availability?: Record<string, unknown>;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const { mounted } = useThemeMode();

  const fetchProfileData = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const data = await response.json();
      setProfileData(data);
    } catch (_err) {
      setError('Failed to load profile data');
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchProfileData();
    }
  }, [session]);

  if (!mounted) {
    return null;
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleArrayInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'service_areas' | 'service_categories'
  ) => {
    const values = e.target.value.split(',').map((item) => item.trim());
    setProfileData((prev) => ({
      ...prev,
      [field]: values,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
    } catch (_err) {
      setError('Failed to update profile');
    }
  };

  const renderPropertyOwnerFields = () => (
    <>
      <div className="grid grid-cols-6 gap-6">
        <div className="col-span-6 sm:col-span-4">
          <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Company Name
          </label>
          <input
            type="text"
            name="business_name"
            id="business_name"
            value={profileData.business_name || ''}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="col-span-6">
          <label htmlFor="billing_address" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Billing Address
          </label>
          <textarea
            name="billing_address"
            id="billing_address"
            value={profileData.billing_address || ''}
            onChange={handleInputChange}
            disabled={!isEditing}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="tax_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Tax ID
          </label>
          <input
            type="text"
            name="tax_id"
            id="tax_id"
            value={profileData.tax_id || ''}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </>
  );

  const renderServiceProviderFields = () => (
    <>
      <div className="grid grid-cols-6 gap-6">
        <div className="col-span-6 sm:col-span-4">
          <label htmlFor="business_license" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Business License
          </label>
          <input
            type="text"
            name="business_license"
            id="business_license"
            value={profileData.business_license || ''}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="col-span-6">
          <label htmlFor="service_areas" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Service Areas (comma-separated)
          </label>
          <input
            type="text"
            name="service_areas"
            id="service_areas"
            value={profileData.service_areas?.join(', ') || ''}
            onChange={(e) => handleArrayInputChange(e, 'service_areas')}
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="col-span-6">
          <label htmlFor="service_categories" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Service Categories (comma-separated)
          </label>
          <input
            type="text"
            name="service_categories"
            id="service_categories"
            value={profileData.service_categories?.join(', ') || ''}
            onChange={(e) => handleArrayInputChange(e, 'service_categories')}
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-main focus:ring-primary-main sm:text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Profile Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Manage your account details and preferences.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-main hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6">
                {session?.user?.role === 'OWNER' && renderPropertyOwnerFields()}
                {session?.user?.role === 'PROVIDER' && renderServiceProviderFields()}

                {error && (
                  <div className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}
                {successMessage && (
                  <div className="mt-4 text-sm text-green-600 dark:text-green-400">{successMessage}</div>
                )}

                {isEditing && (
                  <div className="mt-6">
                    <button
                      type="submit"
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-main hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
