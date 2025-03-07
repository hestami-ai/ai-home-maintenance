import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/app/auth';

// Export the auth middleware
export default auth((req) => {
  // Continue with the auth middleware
  return NextResponse.next();
});

// Define a config for the middleware
export const config = {
  // Skip auth check for public routes and static files
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (API routes for authentication)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
