import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization');
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_AGENTS_URL}/api/v1/agent-chat/history/${params.id}`,
      {
        headers: {
          'Authorization': token,
        },
      }
    );

    if (!response.ok) {
      // Forward the status code from the FastAPI backend
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in chat history route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
