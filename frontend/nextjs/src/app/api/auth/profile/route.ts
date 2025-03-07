import { auth } from '../../../auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session) {
    return new NextResponse(
      JSON.stringify({ error: 'You must be signed in to view your profile' }),
      { status: 401 }
    );
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/profile/`, {
      headers: {
        'Authorization': `Bearer ${session.user?.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch profile data');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch profile data' }),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return new NextResponse(
      JSON.stringify({ error: 'You must be signed in to update your profile' }),
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/profile/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.user?.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: 'Failed to update profile' }),
      { status: 500 }
    );
  }
}
