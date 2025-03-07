'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import AddPropertyForm from './components/AddPropertyForm';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function AddPropertyPage() {
  const { data: session, status } = useSession();
  const { mounted } = useThemeMode();

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
            <div className="h-96 bg-gray-100 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Add New Property
        </h1>
        <AddPropertyForm />
      </div>
    </div>
  );
}
