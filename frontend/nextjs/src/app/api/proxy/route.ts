import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
    try {
        const token = await getToken({ 
            req,
            secret: process.env.NEXTAUTH_SECRET 
        });
        
        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const url = req.nextUrl.searchParams.get('url');
        if (!url) {
            return NextResponse.json(
                { error: 'URL parameter is required' },
                { status: 400 }
            );
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token.accessToken}`,
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch resource' },
                { status: response.status }
            );
        }

        // Get the content type from the response
        const contentType = response.headers.get('content-type');

        // Create a new response with the same body and content type
        const newResponse = new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
            },
        });

        return newResponse;
    } catch (error) {
        console.error('Error in proxy route:', error);
        return NextResponse.json(
            { error: 'Failed to proxy request' },
            { status: 500 }
        );
    }
}
