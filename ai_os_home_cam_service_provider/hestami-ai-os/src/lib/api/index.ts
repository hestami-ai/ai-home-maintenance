// Type-safe oRPC client (preferred)
export { orpc, createOrgClient, type AppRouter } from './orpc.js';

// Legacy manual API client (deprecated - use orpc instead)
export { apiCall, organizationApi } from './client.js';
