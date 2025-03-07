/**
 * Get the dashboard route for a given user role
 * @param userRole - The role of the user
 * @returns The dashboard route path for the user's role
 */
export function getDashboardRoute(userRole?: string): string {
  const route = (() => {
    switch (userRole?.toUpperCase()) {
      case 'PROPERTY_OWNER':
        return '/dashboard/property-owner';
      case 'SERVICE_PROVIDER':
        return '/dashboard/service-provider';
      case 'STAFF':
        return '/dashboard/staff';
      default:
        console.warn('Unknown or missing user role:', userRole);
        return '/login';
    }
  })();
  return route;
}
