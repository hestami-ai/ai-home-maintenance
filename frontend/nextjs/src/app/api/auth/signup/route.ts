import { NextRequest, NextResponse } from 'next/server';
import { validateTurnstileRequest } from '@/middleware/turnstile';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      confirm_password,
      user_role,
      first_name,
      last_name,
      phone_number,
      cf_turnstile_response
    } = body;

    // Validate Turnstile token
    if (!cf_turnstile_response) {
      return NextResponse.json(
        { captcha: ['CAPTCHA verification required'] },
        { status: 400 }
      );
    }

    const isValidTurnstile = await validateTurnstileRequest(cf_turnstile_response);
    if (!isValidTurnstile) {
      return NextResponse.json(
        { captcha: ['CAPTCHA verification failed'] },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { email: ['Invalid email format'] },
        { status: 400 }
      );
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          password: [
            'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
          ]
        },
        { status: 400 }
      );
    }

    // Validate user role
    const validUserRoles = ['PROPERTY_OWNER', 'SERVICE_PROVIDER'];
    if (!validUserRoles.includes(user_role)) {
      return NextResponse.json(
        { user_role: ['Invalid user role'] },
        { status: 400 }
      );
    }

    // Send request to Django backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        confirm_password,
        user_role,
        first_name,
        last_name,
        phone_number,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('Django API error response:', error);
      console.log('Error response type:', typeof error);
      console.log('Error response stringified:', JSON.stringify(error));
      console.log('Error response keys:', Object.keys(error));
      console.log('Error response values:', Object.values(error));

      // Simply pass through the Django error response
      // Django always returns field-specific errors in the format { field: [messages] }
      const errorResponse = NextResponse.json(error, { status: response.status });
      console.log('Sending error response:', {
        status: response.status,
        body: error
      });
      return errorResponse;
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { general: ['Internal server error'] },
      { status: 500 }
    );
  }
}
