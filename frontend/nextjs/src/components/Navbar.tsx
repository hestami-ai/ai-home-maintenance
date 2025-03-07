'use client';

import { useSession, signOut, getSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useRouter } from 'next/navigation';

// Logger utility for better production handling
const logger = {
  log: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

// Define route types
const routes = {
  home: '/' as const,
  login: '/login' as const,
  propertyOwnerDashboard: '/dashboard/property-owner' as const,
  serviceProviderDashboard: '/dashboard/service-provider' as const,
  adminDashboard: '/dashboard/admin' as const,
} satisfies Record<string, string>;

const getDashboardRoute = (role?: string): string => {
  switch (role?.toLowerCase()) {
    case 'property_owner':
      return routes.propertyOwnerDashboard;
    case 'service_provider':
      return routes.serviceProviderDashboard;
    case 'admin':
      return routes.adminDashboard;
    default:
      return routes.home;
  }
};

export default function Navbar(): JSX.Element {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isDarkMode, toggleDarkMode, mounted } = useThemeMode();
  const router = useRouter();

  const dashboardRoute = getDashboardRoute(session?.user?.role);

  // Show basic navbar structure while mounting to prevent layout shift
  if (!mounted) {
    return (
      <nav className="bg-primary-main dark:bg-primary-light transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="ml-2 h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <nav className="bg-primary-main dark:bg-primary-light transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo section */}
            <div className="flex-shrink-0">
              <Link href={routes.home} className="flex items-center">
                <Image
                  src="/hestami-ai-company-logo-light-w-green.png"
                  alt="HestamiAI Home Maintenance Concierge"
                  width={40}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
                <span className="ml-2 text-white font-semibold text-lg">
                  Hestami AI
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const handleSignOut = async (): Promise<void> => {
    try {
      logger.log('Logout process started');
      
      // First, call our authentication provider logout endpoint
      // This will mark the session as logged out in Redis
      const providerLogoutResponse = await fetch('/api/auth/authentication-provider-logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      const providerLogoutResult = await providerLogoutResponse.json();
      logger.log('Authentication provider signout response:', providerLogoutResult);
      
      // Then sign out from NextAuth and let it handle the redirect
      await signOut({
        redirect: true,
        callbackUrl: routes.login // Redirect to login page
      });
    } catch (error) {
      logger.error('Error during sign out:', error);
      
      // If there's an error, still try to sign out with NextAuth
      await signOut({
        redirect: true,
        callbackUrl: routes.login
      });
    }
  };

  return (
    <nav className="bg-primary-main dark:bg-primary-light transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo section */}
          <div className="flex-shrink-0">
            <Link
              href={status === 'authenticated' ? dashboardRoute : routes.home}
              className="flex items-center"
            >
              <Image
                src="/hestami-ai-company-logo-light-w-green.png"
                alt="HestamiAI Home Maintenance Concierge"
                width={40}
                height={40}
                className="h-10 w-auto"
                priority
              />
              <span className="ml-2 text-white font-semibold text-lg">
                Hestami AI
              </span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {status === 'authenticated' && session ? (
              <>
                {/*
                <Link
                  href={dashboardRoute}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
              */}
                <span className="text-gray-300">
                  {session.user?.email}
                </span>
                {/* Theme Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 text-gray-300 hover:text-white rounded-md"
                  aria-label="Toggle dark mode"
                >
                  {isDarkMode ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={handleSignOut}
                  className="bg-secondary-main hover:bg-secondary-dark text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href={routes.login}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
              </>
            )}
          </div>



          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-300 hover:text-white rounded-md mr-2"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {status === 'authenticated' && session ? (
                <>
                  <Link
                    href={dashboardRoute}
                    className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                  >
                    Dashboard
                  </Link>
                  <div className="text-gray-300 block px-3 py-2 rounded-md text-base font-medium">
                    {session.user?.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left bg-secondary-main hover:bg-secondary-dark text-white block px-3 py-2 rounded-md text-base font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href={routes.login}
                  className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
