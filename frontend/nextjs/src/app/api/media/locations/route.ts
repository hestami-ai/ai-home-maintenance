import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
    try {
        const token = await getToken({ 
            req,
            secret: process.env.NEXTAUTH_SECRET 
        });
        
        if (!token) {
            console.error('Location types API: No auth token found');
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

       // console.log('Location types API: Fetching from Django:', `${process.env.NEXT_PUBLIC_API_URL}/api/media/locations/`);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/locations/`, {
            headers: {
                'Authorization': `Bearer ${token.accessToken}`,
                'Content-Type': 'application/json',
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Location types API: Failed to fetch from Django:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData,
                url: `${process.env.NEXT_PUBLIC_API_URL}/api/media/locations/`
            });
            return NextResponse.json(
                { error: `Failed to fetch location types: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        //console.log('Location types API: Received data from Django:', JSON.stringify(data, null, 2));
        return NextResponse.json(data);
    } catch (error) {
        console.error('Location types API: Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch location types' },
            { status: 500 }
        );
    }
}
