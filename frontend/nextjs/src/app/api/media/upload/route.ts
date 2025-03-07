import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    
    // Validate required fields
    const file = formData.get('file');
    const propertyRef = formData.get('property_ref');
    const serviceRequestRef = formData.get('service_request_ref');
    const serviceReportRef = formData.get('service_report_ref');
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    
    // Determine the correct endpoint based on the provided reference
    let endpoint = '';
    if (propertyRef) {
      endpoint = `/api/media/properties/${propertyRef}/upload/`;
    } else if (serviceRequestRef) {
      endpoint = `/api/media/services/requests/${serviceRequestRef}/upload/`;
    } else if (serviceReportRef) {
      endpoint = `/api/media/services/reports/${serviceReportRef}/upload/`;
    } else {
      return NextResponse.json({ error: 'Either property_ref, service_request_ref, or service_report_ref is required' }, { status: 400 });
    }

    // Forward the request to Django backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
