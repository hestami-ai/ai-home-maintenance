import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user?: {
      id: string;
      email: string;
      role: string;
      firstName: string;
      lastName: string;
      accessToken?: string;
      refreshToken?: string;
      tokenExpiry?: string;
      phoneNumber?: string | null;
      emailVerified?: Date | null;
      [key: string]: any;
    };
    error?: string;
    sessionId?: string;
    [key: string]: any;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
    firstName?: string;
    lastName?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
    phoneNumber?: string | null;
    emailVerified?: Date | null;
    [key: string]: any;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    email?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
    phoneNumber?: string | null;
    emailVerified?: Date | null;
    error?: string;
    sessionId?: string;
    [key: string]: any;
  }
}
