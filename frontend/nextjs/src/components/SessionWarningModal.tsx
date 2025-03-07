'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';

// Using a logger instead of console for better production handling
const logger = {
  error: (message: string, ...args: unknown[]): void => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

interface SessionWarningModalProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onLogout: () => void;
}

export const SessionWarningModal = ({
  isOpen,
  onExtendSession,
  onLogout,
}: SessionWarningModalProps): JSX.Element => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): (() => void) => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return () => {}; // Return a no-op cleanup function
    }

    if (isOpen && !dialog.open) {
      try {
        dialog.showModal();
      } catch (err) {
        logger.error('Failed to show modal:', err);
        // Fallback for browsers that don't support dialog
        dialog.setAttribute('open', '');
        dialog.style.display = 'block';
      }
    } else if (!isOpen && dialog.open) {
      try {
        dialog.close();
      } catch (err) {
        logger.error('Failed to close modal:', err);
        // Fallback for browsers that don't support dialog
        dialog.removeAttribute('open');
        dialog.style.display = 'none';
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && dialog.open) {
        event.preventDefault();
        // Prevent closing with escape key
      }
    };

    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleExtendSession = (e: React.MouseEvent): void => {
    e.preventDefault();
    onExtendSession();
  };

  const handleLogout = (e: React.MouseEvent): void => {
    e.preventDefault();
    onLogout();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 rounded-lg p-4 backdrop:bg-gray-500/75 backdrop:dark:bg-gray-900/75 
                bg-white dark:bg-gray-800 shadow-xl max-w-lg w-full m-auto"
      onClose={(e: React.SyntheticEvent): void => {
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent): void => {
        // Prevent closing when clicking outside
        if (e.target === dialogRef.current) {
          e.preventDefault();
        }
      }}
    >
      <div className="w-full">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
          <ExclamationTriangleIcon
            className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
            aria-hidden="true"
          />
        </div>
        <div className="mt-3 text-center">
          <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Session Expiring Soon
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your session will expire in 1 minute due to inactivity. Would you like to continue working?
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
            onClick={handleLogout}
          >
            Log Out
          </button>
          <button
            type="button"
            className="inline-flex justify-center rounded-md bg-primary-main px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
            onClick={handleExtendSession}
            autoFocus
          >
            Continue Session
          </button>
        </div>
      </div>
    </dialog>
  );
};
