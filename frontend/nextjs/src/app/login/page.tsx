'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { mounted } = useThemeMode();
  const { status } = useSession();
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Effect to clear any redirect flags on load
  useEffect(() => {
    // Clear any redirect flags to ensure we start with a clean state
    sessionStorage.removeItem('redirecting_to_login');
    sessionStorage.removeItem('session_fetch_fail_count');
    sessionStorage.removeItem('session_fetch_last_fail');
    sessionStorage.removeItem('verification_fail_count');
    sessionStorage.removeItem('verification_last_fail');
    sessionStorage.removeItem('logout_in_progress');
    
    console.log('Login page loaded, cleared all session flags and counters');
  }, []);

  // Function to redirect based on user role
  const redirectBasedOnRole = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const session = await response.json();
      
      if (session?.user?.role) {
        console.log('User role from session:', session.user.role);
        switch (session.user.role) {
          case 'PROPERTY_OWNER':
            router.push('/dashboard/property-owner');
            break;
          case 'SERVICE_PROVIDER':
            router.push('/dashboard/service-provider');
            break;
          case 'STAFF':
            router.push('/dashboard/staff');
            break;
          default:
            console.warn('Unknown role:', session.user.role);
            router.push('/');
        }
      } else {
        console.warn('No role found in session:', session);
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      router.push('/');
    }
  };

  // Effect to handle post-login actions
  useEffect(() => {
    if (loginSuccess) {
      console.log('Login successful, redirecting to appropriate dashboard');
      redirectBasedOnRole();
    }
  }, [loginSuccess, router]);

  // If already authenticated, redirect to appropriate dashboard
  useEffect(() => {
    // Add a small delay before checking auth status to ensure everything is settled
    const timer = setTimeout(() => {
      if (status === 'authenticated') {
        console.log('User already authenticated, redirecting to appropriate dashboard');
        redirectBasedOnRole();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      console.log('Attempting to sign in...');
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      console.log('Sign in result:', result);

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        setLoginSuccess(true);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during sign in');
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Sign in to your account
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-main hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            
            <div className="text-sm text-center mt-4">
              <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
              <Link 
                href="/signup" 
                className="font-medium dark:text-white text-primary-main hover:text-primary-main"
              >
                Sign up here
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
