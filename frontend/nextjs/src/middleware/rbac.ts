import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// Using a logger instead of console for better production handling
const logger = {
  log: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }
};

// Define route permissions
const routePermissions: Record<string, string[]> = {
  '/dashboard/property-owner': ['PROPERTY_OWNER'],
  '/dashboard/service-provider': ['SERVICE_PROVIDER'],
  '/dashboard/staff': ['STAFF'],
  '/properties': ['PROPERTY_OWNER', 'STAFF'],
  '/services': ['SERVICE_PROVIDER', 'STAFF'],
  '/admin': ['STAFF'],
};

export async function rbacMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  //logger.log('RBAC Middleware - Path:', path);

  // Skip auth check for public routes
  if (path === '/login' || path === '/signup' || path === '/api/auth/callback/credentials') {
    //logger.log('RBAC Middleware - Skipping auth for public route');
    return null;
  }

  const session = await auth();
  
  //logger.log('RBAC Middleware - Session:', session);

  // If no session or no user, redirect to login
  if (!session || !session.user) {
    //logger.log('RBAC Middleware - No session, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if the user has the required role for the route
  const userRole = session.user?.role || 'user';

  // Check if the route requires specific roles
  const requiredRoles = Object.entries(routePermissions).find(([route]) => 
    path.startsWith(route)
  )?.[1];

  if (requiredRoles && !requiredRoles.includes(userRole)) {
    //logger.log('RBAC Middleware - Insufficient permissions');
    
    // If accessing API routes without permission, return 403
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // For other routes, redirect to appropriate dashboard
    const dashboardUrl = new URL(getDashboardRoute(userRole), request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return null;
}

export function getDashboardRoute(userRole: string): string {
  switch (userRole?.toUpperCase()) {
    case 'PROPERTY_OWNER':
      return '/dashboard/property-owner';
    case 'SERVICE_PROVIDER':
      return '/dashboard/service-provider';
    case 'STAFF':
      return '/dashboard/staff';
    default:
      return '/login';
  }
}
