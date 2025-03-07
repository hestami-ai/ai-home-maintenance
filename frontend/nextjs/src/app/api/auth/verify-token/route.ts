import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import TokenService from '@/lib/tokenService';

/**
 * API route to verify the access token
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.sessionId) {
      console.error('No session ID found in session');
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }
    
    // Get tokens from cache
    const tokens = await TokenService.getTokens(session.sessionId);
    
    if (!tokens.accessToken) {
      console.error('No access token found in cache');
      return NextResponse.json({ error: 'No access token found' }, { status: 401 });
    }
    
    // Call the Django token verify endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/token/verify/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokens.accessToken }),
    });
    
    if (!response.ok) {
      console.error(`Token verification failed: ${response.status}`);
      return NextResponse.json({ valid: false, error: response.statusText }, { status: 200 });
    }
    
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json({ valid: false, error: String(error) }, { status: 200 });
  }
}