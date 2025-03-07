import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import TokenService from '@/lib/tokenService';

/**
 * API route to refresh the access token
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
    
    if (!tokens.refreshToken) {
      console.error('No refresh token found in cache');
      return NextResponse.json({ error: 'No refresh token found' }, { status: 401 });
    }
    
    // Call the Django token refresh endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: tokens.refreshToken }),
    });
    
    if (!response.ok) {
      console.error(`Token refresh failed: ${response.status}`);
      
      // If token is invalid or blacklisted (401), remove tokens from cache
      if (response.status === 401) {
        await TokenService.removeTokens(session.sessionId);
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
      }
      
      return NextResponse.json(
        { error: `Failed to refresh token: ${response.status}` }, 
        { status: response.status }
      );
    }
    
    // Get the new tokens from the response
    const data = await response.json();
    
    if (!data.access) {
      console.error('No access token found in response');
      return NextResponse.json({ error: 'Invalid token response' }, { status: 500 });
    }
    
    // Store the new access token in cache
    await TokenService.refreshTokens(session.sessionId, data.access);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
