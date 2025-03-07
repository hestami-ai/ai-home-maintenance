'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

// Using a logger instead of console for better production handling
const logger = {
  log: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

interface SessionTimeoutConfig {
  // Time in milliseconds before showing warning
  warningTime?: number;
  // Time in milliseconds before session expires
  signOutTime?: number;
  // Time in milliseconds before refreshing token
  tokenRefreshTime?: number;
  // Optional callback when warning shows
  onWarning?: () => void;
  // Optional callback when session expires
  onTimeout?: () => void;
  // Optional callback when token refresh fails
  onTokenRefreshError?: () => void;
}

interface SessionTimeoutHook {
  showWarning: boolean;
  resetTimers: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const useSessionTimeout = ({
  warningTime = 14 * 60 * 1000, // 14 minutes
  signOutTime = 15 * 60 * 1000, // 15 minutes
  tokenRefreshTime = 13 * 60 * 1000, // 13 minutes (refresh before warning)
  onWarning,
  onTimeout,
  onTokenRefreshError,
}: SessionTimeoutConfig = {}): SessionTimeoutHook => {
  const { data: session, update } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();
  const warningTimeout = useRef<NodeJS.Timeout>();
  const signOutTimeout = useRef<NodeJS.Timeout>();
  const refreshTimeout = useRef<NodeJS.Timeout>();
  const lastActivity = useRef<number>(Date.now());
  const isRefreshing = useRef<boolean>(false);

  const getTokenAge = (): number => {
    if (!session?.user?.tokenExpiry) {
      return signOutTime; // Default to signOutTime if no token expiry
    }
    const expiryTime = new Date(session.user.tokenExpiry).getTime();
    const now = new Date().getTime();
    return Math.max(0, expiryTime - now);
  };

  const handleSessionExpired = async (): Promise<void> => {
    setShowWarning(false);
    onTimeout?.();
    // Clear all timeouts before redirecting
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    if (signOutTimeout.current) clearTimeout(signOutTimeout.current);
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    await signOut({ redirect: false });
    router.push('/login');
  };

  const refreshToken = async (): Promise<boolean> => {
    if (isRefreshing.current) {
      return false;
    }

    try {
      isRefreshing.current = true;
      const result = await update();
      
      if (!result) {
        logger.error('Token refresh failed: No result from update');
        onTokenRefreshError?.();
        await handleSessionExpired();
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      onTokenRefreshError?.();
      await handleSessionExpired();
      return false;
    } finally {
      isRefreshing.current = false;
    }
  };

  const resetTimers = async (): Promise<void> => {
    const tokenAge = getTokenAge();
    
    // If token is close to expiry or expired, refresh it first
    if (tokenAge <= tokenRefreshTime) {
      const success = await refreshToken();
      if (!success) {
        return; // Don't reset timers if refresh failed
      }
    }

    // Update last activity timestamp
    lastActivity.current = Date.now();

    // Clear existing timers
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    if (signOutTimeout.current) clearTimeout(signOutTimeout.current);
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);

    setShowWarning(false);

    // Set warning timeout
    warningTimeout.current = setTimeout(() => {
      setShowWarning(true);
      onWarning?.();
    }, warningTime);

    // Set signout timeout
    signOutTimeout.current = setTimeout(async () => {
      await handleSessionExpired();
    }, signOutTime);

    // Set token refresh timeout
    refreshTimeout.current = setTimeout(async () => {
      const success = await refreshToken();
      if (success) {
        logger.log('Token refresh successful');
        await resetTimers(); // Reset all timers after successful refresh
      }
    }, tokenRefreshTime);
  };

  useEffect(() => {
    if (!session) return;

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focus',
    ];

    const handleActivity = async (): Promise<void> => {
      const now = Date.now();
      if (now - lastActivity.current >= 1000) { // Debounce activity checks
        await resetTimers(); // Now properly awaits the reset including potential token refresh
      }
    };

    // Set up initial timers
    void resetTimers();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check for session status periodically
    const activityInterval = setInterval(async () => {
      const tokenAge = getTokenAge();
      
      if (tokenAge <= 0) {
        await handleSessionExpired();
      } else if (tokenAge <= warningTime) {
        setShowWarning(true);
        onWarning?.();
      }
    }, 30000); // Check every 30 seconds

    // Cleanup function
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      
      clearInterval(activityInterval);
      
      if (warningTimeout.current) clearTimeout(warningTimeout.current);
      if (signOutTimeout.current) clearTimeout(signOutTimeout.current);
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    };
  }, [session]); // Only depend on session to prevent unnecessary re-renders

  return {
    showWarning,
    resetTimers,
    refreshToken,
  };
};
