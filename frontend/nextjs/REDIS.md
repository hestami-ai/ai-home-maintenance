# Redis Implementation for Authentication

This document explains the Redis implementation for token management in the authentication system.

## Overview

The authentication system uses Redis to store and manage tokens for user sessions. The implementation has been designed to work in both Node.js and Edge Runtime environments.

## Implementation Details

### Redis Client

We use Upstash Redis, which is compatible with both Node.js and Edge Runtime. This allows our authentication system to work seamlessly in all Next.js environments, including middleware.

The Redis client is implemented in `src/lib/redis.ts` and provides:

- Connection to Upstash Redis using REST API
- Automatic fallback to in-memory cache if Redis is unavailable
- Consistent API for both environments

### Token Service

The Token Service (`src/lib/tokenService.ts`) provides methods for:

- Storing tokens in Redis with appropriate TTL
- Retrieving tokens from Redis
- Removing tokens from Redis
- Marking sessions as logged out
- Checking if a session is logged out
- Refreshing access tokens

## Configuration

To configure Upstash Redis, you need to set the following environment variables in your `.env.local` file:

```
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
```

You can get these credentials by creating a Redis database on [Upstash](https://upstash.com/).

## Token Expiration

- Access tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- User IDs expire after 7 days
- Logged out flags expire after 7 days

## Error Handling

The implementation includes robust error handling to ensure that authentication continues to work even if Redis is temporarily unavailable. In such cases, it falls back to an in-memory cache.

## Security Considerations

- Tokens are never exposed to the client
- Redis keys are prefixed with `auth:${sessionId}:` to prevent key collisions
- TTL ensures that tokens are automatically removed when they expire
