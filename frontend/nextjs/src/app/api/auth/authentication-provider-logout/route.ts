import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import TokenService from '@/lib/tokenService';

/**
 * API route to handle authentication provider logout
 * This ensures backend tokens are invalidated before NextAuth session is ended
 */
export async function POST(req: NextRequest) {
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
    
    if (!tokens.refreshToken) {
      console.error('No refresh token found in cache');
      return NextResponse.json({ error: 'No refresh token found' }, { status: 401 });
    }
    
    // Call the Django logout endpoint with refresh token in the body
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        refresh_token: tokens.refreshToken
      }),
    });
    
    if (!response.ok) {
      console.error('Django logout failed:', await response.text());
    } else {
      console.log('Django logout successful');
    }
    
    // Mark the session as logged out in cache
    await TokenService.markSessionAsLoggedOut(session.sessionId);
    
    // Remove the tokens from cache
    await TokenService.removeTokens(session.sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during authentication provider logout:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
