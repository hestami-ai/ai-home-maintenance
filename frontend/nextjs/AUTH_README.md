# Authentication System Simplification

## Overview

The session timeout management functionality has been removed and replaced with a simpler authentication system. This document explains the changes made and how to use the new system.

## Changes Made

1. **Removed Complex Session Manager**
   - Removed the `SessionManager` class and the `useSessionManager` hook
   - Replaced with a simpler `useAuth` hook in `src/lib/authUtils.ts`

2. **Simplified UI Components**
   - Removed the complex `SessionMonitor` component
   - Added a new `AuthStatus` component that shows basic authentication status and provides logout functionality

3. **Simplified API Endpoints**
   - Simplified `/api/auth/verify-token` endpoint to just check if the session is valid
   - Simplified `/api/auth/token` endpoint to just refresh the token without complex error handling

## How to Use the New System

### Basic Authentication

The application now relies on NextAuth's built-in session management. You can use the `useSession` hook from `next-auth/react` to check if a user is authenticated:

```tsx
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') {
    return <div>Loading...</div>;
  }
  
  if (status === 'unauthenticated') {
    return <div>Not authenticated</div>;
  }
  
  return <div>Welcome, {session.user.email}</div>;
}
```

### Token Refresh

You can use the `useAuth` hook to refresh the token:

```tsx
import { useAuth } from '@/lib/authUtils';

function MyComponent() {
  const { refreshToken } = useAuth();
  
  const handleRefresh = async () => {
    const success = await refreshToken();
    if (success) {
      console.log('Token refreshed successfully');
    } else {
      console.error('Failed to refresh token');
    }
  };
  
  return <button onClick={handleRefresh}>Refresh Token</button>;
}
```

### Logout

You can use the `useAuth` hook to log out:

```tsx
import { useAuth } from '@/lib/authUtils';

function MyComponent() {
  const { logout } = useAuth();
  
  return <button onClick={logout}>Logout</button>;
}
```

### Authentication Status UI

You can use the `AuthStatus` component to show the authentication status:

```tsx
import AuthStatus from '@/components/AuthStatus';

function MyLayout() {
  return (
    <div>
      <main>
        {/* Your content */}
      </main>
      <AuthStatus />
    </div>
  );
}
```

## Next Steps

Consider implementing one of these options for better session management:

1. **Use NextAuth's Built-in Session Management**
   - NextAuth provides built-in session management with configurable session duration
   - Configure session duration in the NextAuth options

2. **Implement JWT Expiry Handling**
   - Set a reasonable expiry time for JWTs
   - Implement automatic token refresh when tokens are about to expire

3. **Use Server-Side Session Validation**
   - Validate sessions on the server side for critical operations
   - Use middleware to check authentication status for protected routes
