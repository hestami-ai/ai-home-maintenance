'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';
import { Session } from 'next-auth';

interface PropertyOwnerStats {
  totalProperties: number;
  activeListings: number;
  pendingRequests: number;
  completedServices: number;
}

interface Property {
  id: string;
  address: string;
}

export default function PropertyOwnerDashboard() {
  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/login';
    },
  });
  const { mounted } = useThemeMode();
  const [stats, setStats] = useState<PropertyOwnerStats>({
    totalProperties: 0,
    activeListings: 0,
    pendingRequests: 0,
    completedServices: 0,
  });
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!session?.user) return;

      try {
        if (isSubscribed) {
          const [statsResponse, propertiesResponse] = await Promise.all([
            fetch('/api/dashboard/property-owner/stats', {
              headers: {
                Authorization: `Bearer ${session.user.accessToken}`,
              },
            }),
            fetch('/api/properties', {
              headers: {
                Authorization: `Bearer ${session.user.accessToken}`,
              },
            })
          ]);

          if (statsResponse.ok && isSubscribed) {
            const statsData = await statsResponse.json();
            setStats(statsData);
          }

          if (propertiesResponse.ok && isSubscribed) {
            const propertiesData = await propertiesResponse.json();
            setProperties(propertiesData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [session?.user?.accessToken]);

  // Prevent hydration mismatch and ensure user is authenticated
  if (!mounted || !session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {session.user?.firstName || 'User'}!
          </h1>

          {/* Stats Grid */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-primary-main" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Properties</dt>
                      <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {properties.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

{/*
             <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Active Listings
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {stats.activeListings}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
 */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Pending Requests
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {stats.pendingRequests}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
{/* 
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Completed Services
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {stats.completedServices}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
             </div>
*/}
          </div>


          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href={{
                  pathname: '/properties/add'
                }}
                className="block p-6 bg-white dark:bg-gray-800 shadow rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-primary-main" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add Property</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">List a new property</p>
                  </div>
                </div>
              </Link>
{/* 
              <Link
                href={{
                  pathname: '/requests'
                }}
                className="block p-6 bg-white dark:bg-gray-800 shadow rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-primary-main" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Service Requests</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and manage requests</p>
                  </div>
                </div>
              </Link>

              <Link
                href={{
                  pathname: '/profile'
                }}
                className="block p-6 bg-white dark:bg-gray-800 shadow rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-primary-main" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Profile Settings</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your profile</p>
                  </div>
                </div>
              </Link> 
*/}
            </div>
          </div>

          {/* Properties Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-gray-900 dark:text-white text-2xl font-semibold">Properties</h2>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 text-center py-8 bg-muted rounded-lg">
                  <div className="text-4xl mb-2">🏠</div>
                  <p className="text-gray-900 dark:text-white text-muted-foreground">No properties added yet.</p>
                  <Link
                    href="/properties/add"
                    className="text-primary hover:underline mt-2 inline-block"
                  >
                    Add your first property
                  </Link>
                </div>
              ) : (
                properties.map((property) => (
                  <Link
                    key={property.id}
                    href={`/properties/${property.id}`}
                    className="bg-white dark:bg-gray-800 text-card-foreground rounded-lg shadow-md hover:shadow-md transition-shadow p-6 dark:hover:bg-secondary-main"
                  >
                    <div className="flex flex-col items-center">
                      <div className="text-4xl mb-4">🏠</div>
                      <p className="text-gray-900 dark:text-white text-center">{property.address}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
