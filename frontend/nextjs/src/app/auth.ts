import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import TokenService from '@/lib/tokenService';
import { DefaultSession } from 'next-auth';

// Define our custom properties
interface CustomUser {
  id: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  emailVerified?: Date | null;
  [key: string]: any;
}

/**
 * Handles authentication via NextAuth
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/login/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          if (!response.ok) {
            console.error('Login failed:', response.status, response.statusText);
            return null;
          }

          const data = await response.json();
          
          if (data.access && data.refresh) {
            console.log('Login response data:', data);
            return {
              id: data.user.id.toString(),
              name: data.user.email,
              email: data.user.email,
              accessToken: data.access,
              refreshToken: data.refresh,
              role: data.user.user_role || 'user',
              firstName: data.user.first_name || '',
              lastName: data.user.last_name || '',
              phoneNumber: data.user.phone_number || null,
            };
          }
          
          return null;
        } catch (error) {
          console.error('Error during login:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        // Generate a unique session ID for Redis
        const sessionId = TokenService.generateSessionId();
        
        // Store the tokens in Redis
        await TokenService.storeTokens(sessionId, {
          accessToken: user.accessToken as string,
          refreshToken: user.refreshToken as string,
          userId: user.id as string,
        });
        
        return {
          ...token,
          sessionId,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }

      // Check if the session has been logged out
      if (token.sessionId) {
        const isLoggedOut = await TokenService.isSessionLoggedOut(token.sessionId as string);
        if (isLoggedOut) {
          return { 
            ...token, 
            error: 'RefreshAccessTokenError'
          };
        }
      }

      // Return the previous token if it hasn't expired
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // Add token data to the session
        session.user = {
          ...session.user,
          id: token.id || '',
          email: token.email || '',
          role: token.role || 'user',
          firstName: token.firstName || '',
          lastName: token.lastName || '',
          accessToken: token.accessToken || '',
          refreshToken: token.refreshToken || '',
        };
        session.sessionId = token.sessionId || '';
        session.error = token.error || '';
      }
      return session;
    },
  },
  events: {
    async signOut(params) {
      // Check if we have a token object in the params
      if ('token' in params && params.token?.sessionId) {
        try {
          // Mark the session as logged out in Redis
          await TokenService.markSessionAsLoggedOut(params.token.sessionId as string);
          
          // Try to logout from the backend
          const tokens = await TokenService.getTokens(params.token.sessionId as string);
          const accessToken = tokens.accessToken;
          const refreshToken = tokens.refreshToken;
          
          if (accessToken && refreshToken) {
            console.log('Auth.ts: Calling Django logout endpoint with refresh token');
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/logout/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  refresh_token: refreshToken
                }),
              });
              
              if (!response.ok) {
                console.error('Auth.ts: Django logout failed:', await response.text());
              } else {
                console.log('Auth.ts: Django logout successful');
              }
            } catch (error) {
              console.error('Error logging out from backend:', error);
            }
          } else {
            console.error('Auth.ts: Missing tokens for Django logout', { 
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken 
            });
          }
          
          // Remove the tokens from Redis
          await TokenService.removeTokens(params.token.sessionId as string);
        } catch (error) {
          console.error('Error during signOut event:', error);
        }
      }
    },
  },
});
