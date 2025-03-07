import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/signup', '/login'];

// Using a logger instead of console for better production handling
const logger = {
  log: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

export async function validateTurnstileRequest(token: string): Promise<boolean> {
  try {
    logger.log('Validating Turnstile token:', token);
    
    const verifyFormData = new FormData();
    verifyFormData.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    verifyFormData.append('response', token);
    
    // Get IP address if available
    const ip = headers().get('x-real-ip');
    if (ip) {
      verifyFormData.append('remoteip', ip);
    }

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    
    const result = await fetch(url, {
      method: 'POST',
      body: verifyFormData,
    });

    const outcome = await result.json();
    logger.log('Turnstile validation result:', outcome);
    
    return outcome.success;
  } catch (error) {
    logger.error('Turnstile validation failed:', error);
    return false;
  }
}

export async function turnstileMiddleware(req: NextRequest): Promise<NextResponse | undefined> {
  const path = req.nextUrl.pathname;
  
  // Only check Turnstile for protected routes
  if (!PROTECTED_ROUTES.some(route => path.startsWith(route))) {
    return undefined;
  }

  const token = req.headers.get('cf-turnstile-response');
  if (!token) {
    return NextResponse.json(
      { error: 'Turnstile token missing' },
      { status: 400 }
    );
  }

  const isValid = await validateTurnstileRequest(token);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Turnstile validation failed' },
      { status: 403 }
    );
  }

  return undefined;
}
