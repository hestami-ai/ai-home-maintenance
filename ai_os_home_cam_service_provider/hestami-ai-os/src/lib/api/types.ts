/**
 * Shared API types for client-side usage
 * 
 * This file re-exports the AppRouter type in a way that's safe for client-side imports.
 * The actual type comes from the server, but this indirection allows the bundler
 * to properly handle the type-only import.
 */

// Re-export the AppRouter type from the server
// This is safe because it's a type-only export that gets erased at runtime
export type { AppRouter } from '$server/api';
