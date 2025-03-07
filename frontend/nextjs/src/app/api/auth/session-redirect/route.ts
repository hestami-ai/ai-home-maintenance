import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

function getDashboardRoute(userType: string): string {
  switch (userType.toUpperCase()) {
    case 'OWNER':
    case 'PROPERTY_OWNER':
      return '/dashboard/property-owner';
    case 'PROVIDER':
    case 'SERVICE_PROVIDER':
      return '/dashboard/service-provider';
    case 'STAFF':
      return '/dashboard/staff';
    default:
      return '/login';
  }
}

export async function GET(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  if (!token || !token.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const dashboardRoute = getDashboardRoute(token.role as string);
  return NextResponse.redirect(new URL(dashboardRoute, request.url));
}
