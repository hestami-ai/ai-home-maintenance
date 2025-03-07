'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';

export default function ProfileLayout({ children }: PropsWithChildren) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Profile Settings
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage your account information and preferences
              </p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
