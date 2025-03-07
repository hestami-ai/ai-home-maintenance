'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useNonce } from '@/hooks/useNonce';
import { Turnstile } from 'next-turnstile';

export default function SignupPage() {
  const router = useRouter();
  const nonce = useNonce();
  type ErrorType = {
    [key: string]: string | string[];
  };
  const [errors, setErrors] = useState<ErrorType>({});
  const [isLoading, setIsLoading] = useState(false);
  const { mounted } = useThemeMode();
  const [captchaToken, setCaptchaToken] = useState('');

  // Add useEffect to monitor errors state
  useEffect(() => {
    console.log('Errors state updated:', errors);
  }, [errors]);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const handleCaptchaVerify = (token: string) => {
    console.log('Turnstile token generated:', token);
    setCaptchaToken(token);
  };

  const resetCaptcha = () => {
    setCaptchaToken('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset previous errors
    setErrors({});

    // Validate CAPTCHA token
    if (!captchaToken) {
      setErrors({ captcha: 'Please complete the CAPTCHA' });
      return;
    }

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const userRole = formData.get('userRole') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;

    if (password !== confirmPassword) {
      setErrors({
        password: ['Passwords do not match.']
      });
      setIsLoading(false);
      // Reset Turnstile on validation error
      resetCaptcha();
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          confirm_password: confirmPassword,
          user_role: userRole,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          cf_turnstile_response: captchaToken,
        }),
      });

      const data = await response.json();
      console.log('Raw signup response:', data);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Type of data:', typeof data);
      console.log('Is data null?', data === null);
      if (typeof data === 'object') {
        console.log('Data keys:', Object.keys(data));
        console.log('Data values:', Object.values(data));
      }

      if (!response.ok) {
        console.log('Response not OK, handling error...');
        if (typeof data === 'object' && data !== null) {
          console.log('Setting errors to:', JSON.stringify(data, null, 2));
          setErrors(data);
          // Use setTimeout to log the state after it's updated
          setTimeout(() => {
            console.log('Errors state after update:', errors);
          }, 0);
        } else {
          console.log('Setting general error');
          setErrors({ general: ['Registration failed'] });
        }

        // Reset Turnstile on any error
        resetCaptcha();
        return;
      }

      // Redirect to login page on successful signup
      router.push('/login');
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ general: ['An unexpected error occurred. Please try again.'] });
      // Reset Turnstile on any error
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Create your account
            </h2>
          </div>
          {/* Show error messages */}
          {errors.general && (Array.isArray(errors.general) ? errors.general[0] : errors.general) && (
            <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
              {Array.isArray(errors.general) ? errors.general[0] : errors.general}
            </div>
          )}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <input type="hidden" name="remember" value="true" />
            <div className="rounded-md shadow-sm space-y-4">
              {/* Email field first */}
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
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="Email address"
                />
                {errors.email && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.email) ? errors.email[0] : errors.email}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="sr-only">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.first_name ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="First Name"
                />
                {errors.first_name && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.first_name) ? errors.first_name[0] : errors.first_name}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="sr-only">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.last_name ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="Last Name"
                />
                {errors.last_name && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.last_name) ? errors.last_name[0] : errors.last_name}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="phoneNumber" className="sr-only">
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.phone_number ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="Phone Number"
                />
                {errors.phone_number && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.phone_number) ? errors.phone_number[0] : errors.phone_number}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="Password"
                />
                {errors.password && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.password) ? errors.password[0] : errors.password}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.confirm_password ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                  placeholder="Confirm Password"
                />
                {errors.confirm_password && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.confirm_password) ? errors.confirm_password[0] : errors.confirm_password}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* User Role */}
              <div>
                <label htmlFor="userRole" className="sr-only">
                  User Role
                </label>
                <select
                  id="userRole"
                  name="userRole"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.user_role ? 'border-red-500' : 'border-gray-300'
                  } dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary-main focus:border-primary-main focus:z-10 sm:text-sm`}
                >
                  <option value="">Select User Role</option>
                  <option value="PROPERTY_OWNER">Property Owner</option>
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                </select>
                {errors.user_role && (
                  <div className="mt-1 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                      </svg>
                      <span>
                        {Array.isArray(errors.user_role) ? errors.user_role[0] : errors.user_role}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-center">
                <Turnstile
                  id="signup-turnstile"
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  onVerify={handleCaptchaVerify}
                  theme="auto"
                  refreshExpired="auto"
                  onExpire={() => {
                    setCaptchaToken('');
                    setErrors(prev => ({
                      ...prev,
                      captcha: 'Verification expired. Please try again.'
                    }));
                  }}
                  onError={() => {
                    setErrors(prev => ({
                      ...prev,
                      captcha: 'Failed to verify you are human. Please try again.'
                    }));
                  }}
                />
              </div>
              {errors.captcha && (
                <div className="mt-2 p-2 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                    </svg>
                    <span>
                      {errors.captcha}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-main hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-main"
              >
                {isLoading ? 'Creating Account...' : 'Sign up'}
              </button>
            </div>

            <div className="text-sm text-center">
              <Link
                href="/login"
                className="font-medium dark:text-white text-primary-main hover:text-primary-main"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
