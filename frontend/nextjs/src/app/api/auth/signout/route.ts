import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/app/auth';

export async function POST() {
  try {
    const headersList = headers();
    const cookieHeader = headersList.get('cookie') || '';
    
    const djangoUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!djangoUrl) {
      console.error('Django API URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get session to access the token
    const session = await auth();
    const accessToken = session?.user?.accessToken;
    const refreshToken = session?.user?.refreshToken;

    if (accessToken && refreshToken) {
      console.log('Calling Django logout endpoint with refresh token');
      
      // Call Django logout endpoint
      const djangoRes = await fetch(`${djangoUrl}/api/users/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        }),
        cache: 'no-store'
      });

      if (!djangoRes.ok) {
        console.error('Django logout failed:', await djangoRes.text());
      } else {
        console.log('Django logout successful');
      }
    } else {
      console.error('Missing tokens for Django logout', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken 
      });
    }

    // Clear cookies regardless of Django logout success
    const response = NextResponse.json({ success: true });
    const cookieOptions = {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
      httpOnly: true
    };

    // Delete all auth-related cookies
    const cookiesToClear = [
      'access_token',
      'refresh_token',
      'next-auth.session-token',
      'authjs.session-token',
      'authjs.callback-url',
      'authjs.csrf-token',
      'sessionid',
      'csrftoken'
    ];

    const cookieStore = cookies();
    for (const cookie of cookiesToClear) {
      cookieStore.delete(cookie);
      response.cookies.set(cookie, '', cookieOptions);
    }
    
    return response;
  } catch (error: unknown) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error during logout' },
      { status: 500 }
    );
  }
}
