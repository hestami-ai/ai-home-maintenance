# NextJS-Django Authentication Architecture with Server-Side Token Management

## ASCII Architecture Diagram

```
+----------------+        +-----------------+        +----------------+
|                |        |                 |        |                |
|  Client        |        |  NextJS Server  |------->|  Django API    |
|  Browser       |        |                 |        |  Backend       |
|                |        |                 |        |                |
+-------+--------+        +--------+--------+        +----------------+
        ^                          ^                          
        |                          |                          
        |                          |                          
        |                          v                          
        |                 +--------+--------+                 
        |                 |                 |                 
        |                 |  Redis          |                 
        |                 |  Token Store    |                 
        |                 |                 |                 
        |                 +-----------------+                 
        |                                                     
        +                                                     
                                                              


## 1. Login Flow

  Client                NextJS                Redis                 Django
    |                     |                     |                     |
    |  Login Request      |                     |                     |
    | (user/pass)         |                     |                     |
    |-------------------->|                     |                     |
    |                     |  Auth Request       |                     |
    |                     | (user/pass)         |                     |
    |                     |-------------------------------------------->|
    |                     |                     |                     |
    |                     |                     |                     |  Validate
    |                     |                     |                     |  Credentials
    |                     |                     |                     |
    |                     |  Auth Response      |                     |
    |                     | (access/refresh     |                     |
    |                     |  tokens)            |                     |
    |                     |<--------------------------------------------|
    |                     |                     |                     |
    |                     |  Store Tokens       |                     |
    |                     | (session_id, tokens)|                     |
    |                     |-------------------->|                     |
    |                     |                     |  Store in Redis     |
    |                     |                     |  with TTL           |
    |                     |  Store Confirmation |                     |
    |                     |<--------------------|                     |
    |                     |                     |                     |
    |  Auth Response      |                     |                     |
    | (NextAuth cookies   |                     |                     |
    |  only, NO tokens)   |                     |                     |
    |<--------------------|                     |                     |
    |                     |                     |                     |


## 2. API Request Flow

  Client                NextJS                Redis                 Django
    |                     |                     |                     |
    |  API Request        |                     |                     |
    | (NextAuth cookies)  |                     |                     |
    |-------------------->|                     |                     |
    |                     |  Get Tokens         |                     |
    |                     | (session_id)        |                     |
    |                     |-------------------->|                     |
    |                     |                     |  Retrieve from      |
    |                     |                     |  Redis             |
    |                     |  Return Tokens      |                     |
    |                     | (access/refresh)    |                     |
    |                     |<--------------------|                     |
    |                     |                     |                     |
    |                     |  API Request        |                     |
    |                     | (with access token) |                     |
    |                     |-------------------------------------------->|
    |                     |                     |                     |
    |                     |                     |                     |  Process
    |                     |                     |                     |  Request
    |                     |                     |                     |
    |                     |  API Response       |                     |
    |                     | (data)              |                     |
    |                     |<--------------------------------------------|
    |                     |                     |                     |
    |  API Response       |                     |                     |
    | (data only,         |                     |                     |
    |  NO tokens)         |                     |                     |
    |<--------------------|                     |                     |
    |                     |                     |                     |


## 3. Token Refresh Flow (Server-Side Only)

  NextJS                Redis                 Django
    |                     |                     |
    |  Check Token        |                     |
    |  Expiration         |                     |
    |                     |                     |
    |  Get Tokens         |                     |
    | (session_id)        |                     |
    |-------------------->|                     |
    |                     |  Retrieve from      |
    |                     |  Redis             |
    |  Return Tokens      |                     |
    | (access/refresh)    |                     |
    |<--------------------|                     |
    |                     |                     |
    |  Refresh Request    |                     |
    | (with refresh token)|                     |
    |-------------------------------------------->|
    |                     |                     |
    |                     |                     |  Validate
    |                     |                     |  Refresh Token
    |                     |                     |
    |  Refresh Response   |                     |
    | (new tokens)        |                     |
    |<--------------------------------------------|
    |                     |                     |
    |  Update Tokens      |                     |
    | (session_id, tokens)|                     |
    |-------------------->|                     |
    |                     |  Update in Redis    |
    |                     |  with new TTL       |
    |  Update Confirmation|                     |
    |<--------------------|                     |
    |                     |                     |


## Key Components

### Client Browser
- Stores only NextAuth cookies
- Never receives or handles Django tokens
- Makes all API requests to NextJS server

### NextJS Server
- Authenticates users with NextAuth
- Stores session IDs but not Django tokens
- Retrieves Django tokens from Redis when needed
- Proxies API requests to Django backend
- Handles token refresh logic

### Redis Token Store
- Stores mapping between NextAuth session IDs and Django tokens
- Sets appropriate TTLs (Time-To-Live) for tokens
- Provides fast, in-memory access to tokens
- Automatically expires tokens based on TTL

### Django Backend
- Validates credentials and issues tokens
- Processes API requests with valid tokens
- Provides token refresh functionality
- Has no knowledge of the Redis token store

## Security Benefits

1. **No Django Tokens on Client**: Django tokens (access/refresh) never leave the server environment
2. **Separate Auth Layers**: NextAuth handles client authentication; Django tokens handle API authentication
3. **XSS Protection**: Even if client-side JavaScript is compromised, attacker cannot access Django tokens
4. **Reduced Attack Surface**: Fewer credentials exposed to potentially vulnerable client environments
5. **Efficient Token Management**: Redis provides fast, reliable token storage with automatic expiration
6. **Stateless Django Backend**: Django remains stateless, improving scalability
7. **Leveraging Existing Infrastructure**: Uses already deployed Redis instance
