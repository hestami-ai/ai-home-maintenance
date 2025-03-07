import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !session.user?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const queryPart = queryString ? `?${queryString}` : '';
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/services/requests/${queryPart}`,
      {
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    return NextResponse.json(
      data,
      { status: response.status }
    );
  } catch (error) {
    console.error('Error in service requests API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
