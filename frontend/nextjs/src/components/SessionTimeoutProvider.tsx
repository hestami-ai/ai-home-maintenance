'use client';

import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionWarningModal } from './SessionWarningModal';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export const SessionTimeoutProvider = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element => {
  const router = useRouter();
  const { showWarning, resetTimers } = useSessionTimeout({
    warningTime: 14 * 60 * 1000, // Show warning after 14 minutes
    signOutTime: 15 * 60 * 1000, // Sign out after 15 minutes
  });

  const handleExtendSession = (): void => {
    resetTimers();
  };

  const handleLogout = async (): Promise<void> => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <>
      {children}
      <SessionWarningModal
        isOpen={showWarning}
        onExtendSession={handleExtendSession}
        onLogout={handleLogout}
      />
    </>
  );
};
