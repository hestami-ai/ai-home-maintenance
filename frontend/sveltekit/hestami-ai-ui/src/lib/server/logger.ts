/**
 * Structured Logger Utility
 * 
 * A centralized logging utility using Winston for standardized logging
 * across the SvelteKit application. Provides consistent log formats
 * that can be easily processed by monitoring and observability tools.
 */
import winston from 'winston';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME } from './redis';

// Configure format based on environment
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    // Standard log format that's human-readable but can be parsed by tools
    const sessionId = meta.sessionId || 'no-session';
    const path = meta.path || '';
    const method = meta.method || '';
    const userAgent = meta.userAgent || '';
    
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] [${sessionId}]`;
    
    if (path) {
      logMessage += ` [${method} ${path}]`;
    }
    
    logMessage += `: ${message}`;
    
    // Add additional context if present
    if (Object.keys(meta).length > 0 && meta.data) {
      // Exclude sensitive data
      const safeData = { ...meta.data };
      // Type-safe property access
      if (typeof safeData === 'object' && safeData !== null) {
        if ('password' in safeData) safeData.password = '[REDACTED]';
        if ('token' in safeData) safeData.token = '[REDACTED]';
      }
      
      logMessage += ` - ${JSON.stringify(safeData)}`;
    }
    
    return logMessage;
  })
);

// Create the Winston logger
const logger = winston.createLogger({
  level: dev ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console()
  ]
});

// Helper function to extract session ID from cookies
export function getSessionId(cookies: Cookies): string {
  return cookies.get(SESSION_COOKIE_NAME) || 'no-session';
}

// Helper function to extract request info
export function getRequestInfo(request: Request, url: URL) {
  return {
    path: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent') || 'unknown'
  };
}

// API request logger
export function logApiRequest(cookies: Cookies, request: Request, url: URL, message?: string) {
  const sessionId = getSessionId(cookies);
  const { path, method, userAgent } = getRequestInfo(request, url);
  
  logger.info(message || `API request received`, {
    sessionId,
    path,
    method,
    userAgent
  });
}

// API response logger
export function logApiResponse(cookies: Cookies, request: Request, url: URL, status: number, data?: any) {
  const sessionId = getSessionId(cookies);
  const { path, method, userAgent } = getRequestInfo(request, url);
  
  logger.info(`API response sent with status ${status}`, {
    sessionId,
    path,
    method,
    userAgent,
    data: { status }
  });
}

// Error logger
export function logApiError(cookies: Cookies, request: Request, url: URL, error: any) {
  const sessionId = getSessionId(cookies);
  const { path, method, userAgent } = getRequestInfo(request, url);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  logger.error(`API error: ${errorMessage}`, {
    sessionId,
    path,
    method,
    userAgent,
    data: { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }
  });
}

// Export the logger for direct use
export default logger;
