'use client';

import { useState } from 'react';
import AddressStep from './steps/AddressStep';
import Toast from '@/components/Toast';
import { useRouter } from 'next/navigation';

export type PropertyFormData = {
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  title: string;
};

const initialFormData: PropertyFormData = {
  address: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  },
  title: '',
};

export default function AddPropertyForm() {
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const router = useRouter();

  const handleCancel = () => {
    router.push('/dashboard/property-owner');
  };

  const handleSubmit = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('address', formData.address.street);
      formDataToSend.append('city', formData.address.city);
      formDataToSend.append('state', formData.address.state);
      formDataToSend.append('zip_code', formData.address.zipCode);
      formDataToSend.append('country', formData.address.country);

      const response = await fetch('/api/properties', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error('Failed to create property');
      }

      setToastMessage('Property created successfully!');
      setToastType('success');
      setShowToast(true);

      // Redirect to dashboard after successful submission
      setTimeout(() => {
        router.push('/dashboard/property-owner');
      }, 2000);
    } catch (error) {
      console.error('Error creating property:', error);
      setToastMessage('Failed to create property. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Add New Property</h2>
      <AddressStep
        address={formData.address}
        title={formData.title}
        onChange={(address) => setFormData({ ...formData, address })}
        onChangeTitle={(title) => setFormData({ ...formData, title })}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
