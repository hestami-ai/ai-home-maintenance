# Hestami AI System Requirements Specification

This document outlines the system requirements for creating a secure full-stack web application using Next.js 14 (App Router) and Typescript for the frontend, NextAuth.js 5.0 for authentication, and Django 5.1 with Django REST Framework (DRF) for the backend with Python 3.12 as the base requirement. The application will use PostgreSQL 17 or later as the database and will be containerized with Docker and docker-compose. The application must support both production and development environments running on the same host machine using the following approach.

We will be using Agile's "Thin Vertical Slice" concept to generate the implementation roadmap. Since this is being developed by AI Agents,  the roadmap does not need refer to time boxes like "week 1" or "week 2".

### Operating System Requirements
- **Development Environment:** Windows
- **Shell Requirements:**
    - PowerShell as primary shell
    - Command Prompt (CMD) as fallback
    - WSL2 (optional) for Linux-specific tools
- **Production Environment:** Linux (Docker containers)

## System Requirements

### Frontend Specifications:

- **Framework:** Next.js 14 with the App Router. Use --yes flag to accept all defaults to avoid running interactively or ask the user to run the command for you.
- **Authentication:** NextAuth.js 5.0 with session, access, and refresh tokens stored as HTTP-only cookies.
- **Styling Framework:** Tailwind CSS.
- **Routing and Pages:**
    - Login Page: Accessible at /login.
    - Signup/Register Page: Accessible if the user does not have an account.
        - Users must select a type during signup:
            - Property Owners
            - Service Providers
    - Post-login Routing:
        - Property Owners: Redirected to /properties.
        - Service Providers: Redirected to /serviceprovider.
        - Privileged Hestami AI Staff Users: Redirected to /admin/dashboard.
- **Token Management:**
    - Tokens (access_token and refresh_token) stored securely as HTTP-only, Secure, and SameSite=Lax cookies.
    - Refresh tokens only used server-side to issue new access tokens.
- **State Management:**
    - Use React Context for maintaining and updating user authentication status.
- **Middleware:**
    - Protect sensitive routes (e.g., /properties, /serviceprovider, /admin/dashboard) with authentication middleware and role-based access controls.

### Backend Specifications:

- **Framework:** Django 5.1 with Django REST Framework (DRF).
- **Authentication:**
    - Use SimpleJWT for token-based authentication.
    - Provide endpoints for login, signup, token refresh, and user roles.
    - Return tokens via Set-Cookie headers for secure storage.
    
    Password Policies:
        - Minimum length: 12 characters
        - Must contain at least:
            - One uppercase letter
            - One lowercase letter
            - One number
            - One special character
        - Cannot contain common patterns or dictionary words
        - Cannot be similar to user's personal information
        - Password change required every 90 days for staff users
        - Cannot reuse last 5 passwords
        - Account lockout after 5 failed attempts for 15 minutes
    
    Session Management:
        - Access token validity: 15 minutes
        - Refresh token validity: 7 days
        - Maximum 3 concurrent sessions per user
        - Force logout on password change
        - "Remember me" extends refresh token to 30 days
        - Session invalidation on:
            - Password change
            - Role change
            - Account suspension
            - Security breach detection
- **User Model:**
    - Extend the Django User model to support custom roles:
        - Regular Users:
            - Property Owners
            - Service Providers
        - Privileged Users:
            - Hestami AI Staff Users
- **Database:** PostgreSQL 17 or later.
- **Database Models:**
    - Base User Model (extends Django's AbstractUser):
        ```python
        class User:
            # Authentication Fields
            email = EmailField(unique=True)  # Used as username
            password = PasswordField()
            
            # Role Fields
            USER_TYPE_CHOICES = [
                ('PROPERTY_OWNER', 'Property Owner'),
                ('SERVICE_PROVIDER', 'Service Provider'),
                ('STAFF', 'Hestami AI Staff')
            ]
            user_type = CharField(choices=USER_TYPE_CHOICES)
            
            # Account Status
            STATUS_CHOICES = [
                ('ACTIVE', 'Active'),
                ('INACTIVE', 'Inactive'),
                ('SUSPENDED', 'Suspended')
            ]
            status = CharField(choices=STATUS_CHOICES, default='INACTIVE')
            
            # Common Profile Fields
            first_name = CharField()
            last_name = CharField()
            phone_number = CharField()
            date_joined = DateTimeField(auto_now_add=True)
            last_login = DateTimeField(auto_now=True)
        ```
    - Property Owner Profile:
        ```python
        class PropertyOwnerProfile:
            user = OneToOneField(User)
            company_name = CharField(null=True, blank=True)
            billing_address = TextField()
            tax_id = CharField(null=True, blank=True)
            preferred_contact_method = CharField(choices=['EMAIL', 'PHONE'])
        ```
    - Service Provider Profile:
        ```python
        class ServiceProviderProfile:
            user = OneToOneField(User)
            company_name = CharField()
            business_license = CharField()
            insurance_info = JSONField()
            service_areas = ArrayField(CharField())  # Geographic areas served
            service_categories = ArrayField(CharField())  # Types of services offered
            availability = JSONField()  # Working hours/availability
        ```
    - Staff Profile:
        ```python
        class StaffProfile:
            user = OneToOneField(User)
            department = CharField()
            role = CharField()
            access_level = IntegerField()  # For granular permissions
            emergency_contact = JSONField()
        ```
    - Key Relationships and Constraints:
        - One-to-One relationship between User and respective Profile models
        - User email must be unique
        - User type determines which profile type can be created
        - Staff users automatically get Django admin access
        - Profiles are created/updated through signals when user is created/updated
- **User APIs:**
    - Signup API: Accept user information (e.g., email, password, user type) and register users.
    - Login API: Authenticate users and issue tokens.
    - Role-based Routing API: Determine user type after login and route accordingly.
- **Custom Serializers:**
    - Implement serializers to handle user roles and custom fields (e.g., user_type).
- **Views:**
    - Views for creating, managing, and retrieving users based on their roles.
    - Implement DRF views for:
        - Login
        - Signup
        - User profile management
        - Privileged access checks for Hestami AI staff.

### Routing and Roles:

- **User Types:**
    - Regular Users:
        - Property Owners: Redirected to /properties after login.
        - Service Providers: Redirected to /serviceprovider after login.
    - Privileged Users:
        - Hestami AI Staff Users: Redirected to /admin/dashboard after login.
- **Role-Based Access Control:**
    - Django and Next.js middleware enforce access restrictions for specific user roles.

### Domain Structure and CORS Configuration

#### Development Domains
- Frontend (Next.js): `app.hestami.local`
- Backend API (Django): `api.hestami.local`
- Static Files: `static.hestami.local`
- Admin Interface: `admin.hestami.local`

#### Production Domains
- Frontend (Next.js): `app.hestami-ai.com`
- Backend API (Django): `api.hestami-ai.com`
- Static Files: `static.hestami-ai.com`
- Admin Interface: `admin.hestami-ai.com`

#### CORS and API Request Handling
- All API requests proxied through Next.js server
- No direct browser-to-Django communication
- Next.js API routes configuration:
    ```javascript
    // next.config.js
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: process.env.NEXT_PUBLIC_API_URL + '/:path*'
        }
      ]
    }
    ```
- Environment variables:
    ```
    # Development
    NEXT_PUBLIC_API_URL=http://api.hestami.local

    # Production
    NEXT_PUBLIC_API_URL=https://api.hestami-ai.com
    ```

### Docker and Deployment Specifications:

- **Dockerization:**
    - The project will use Docker for containerization.
    - A docker-compose.yml file will manage all services under the hestami-ai project.
- **Docker Compose Networks:**
    - traefik-public: For inbound internet traffic routed to the Next.js server.
    - backend: For internal backend communication connecting the Next.js server to Django, PostgreSQL, Redis, ClamAV, and other backend services.
- **Services in docker-compose.yml:**
    - frontend: Next.js service
        - Exposed on the traefik-public network.
        - Connects to the backend network to communicate with Django.
    - backend: Django with DRF
        - Only accessible on the backend network.
    - db: PostgreSQL 17 or later
        - Only accessible on the backend network.
    - redis: For caching and session management
        - Only accessible on the backend network.
    - clamav: For file scanning
        - Only accessible on the backend network.
    - traefik: v3.2.1 version, acting as a reverse proxy and load balancer.
        - Connected to the traefik-public network.
    - static: NGINX 1.26.2 (alpine 3.20.3) to serve static files
        - Connected to the backend network.
        - Built with http_secure_link_module manually compiled.
- **NGINX Configuration:**
    - Use http_secure_link_module for secure content delivery.
    - Serve pre-built static content.
- **Docker Network Separation:**
    - traefik-public handles public internet traffic to the frontend.
    - backend is isolated for backend services only.

## 1. Development Workflow and Tools Configuration

### Hot-Reload Development:
- **Frontend:**
    - Enable Next.js built-in hot-reload functionality
    - Configure for development environment
- **Backend:**
    - Enable Django debug toolbar
    - Configure Django auto-reload functionality
    - Set up development-specific settings

### Code Quality Tools:
- **Frontend:**
    - ESLint for JavaScript/TypeScript linting
    - Prettier for code formatting
    - TypeScript in strict mode
    - Configure Next.js recommended linting rules
- **Backend:**
    - Black for Python code formatting
    - Flake8 for Python linting
    - MyPy for Python type checking
    - Pytest for testing framework
    - Pytest-django for Django-specific testing

### VS Code Debug Configurations:
- **Frontend Debugging:**
    - Next.js debugging configuration
    - Source map support
    - Hot-reload compatibility
- **Backend Debugging:**
    - Django debugging configuration
    - Django shell integration
    - Test debugging support
    - Remote debugging capability

### Git Pre-commit Hooks:
- **Code Quality Checks:**
    - Trailing whitespace removal
    - End of file fixing
    - YAML syntax checking
    - Large file checking
- **Frontend Checks:**
    - ESLint running
    - Prettier formatting
    - TypeScript type checking
- **Backend Checks:**
    - Black formatting
    - Flake8 linting
    - MyPy type checking
- **General:**
    - Automatic hook installation
    - Pre-commit framework integration
    - Local and CI/CD compatibility

## 2. Project Structure

### Project Name: hestami-ai
### Directory Structure:

```
hestami-ai/
  |-- backend/
      |-- django/
      |-- static/
      |-- clamav/
  |-- frontend/
      |-- nextjs/
  |-- docker-compose.yml
  |-- docker-compose.prod.yml
  |-- docker-compose.dev.yml
  |-- .env.prod
  |-- .env.dev
```

## 3. Multi-Environment Support Using Docker Compose

Both production and development instances will run on the same host machine.
Use docker-compose.yml as the primary file and override configurations with:
- docker-compose.dev.yml for development services.
- docker-compose.prod.yml for production services.

### Environment-Specific Configuration

Sensitive data like database credentials must be stored in .env.prod and .env.dev files.

#### Example .env.dev
```
POSTGRES_USER=dev_user
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=hestami_dev
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DJANGO_SECRET_KEY=dev_secret_key
DJANGO_DEBUG=True
```

#### Example .env.prod
```
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=prod_password
POSTGRES_DB=hestami_prod
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DJANGO_SECRET_KEY=prod_secret_key
DJANGO_DEBUG=False
```

## 4. Docker Compose Configuration

### Primary docker-compose.yml

Defines common services shared by both production and development instances.

```yaml
volumes:
  postgres_data_dev:
  postgres_data_prod:

networks:
  traefik-public:
    external: true
  backend-dev:
    driver: bridge
  backend-prod:
    driver: bridge

services:
  frontend:
    build: ./frontend/nextjs
    container_name: hestami-frontend
    ports:
      - "3000:3000"
    networks:
      - traefik-public
      - backend-dev
      - backend-prod

  backend:
    build: ./backend/django
    container_name: hestami-backend
    depends_on:
      - db
      - redis
    networks:
      - backend-dev
      - backend-prod

  db:
    image: postgres:17
    networks:
      - backend-dev
      - backend-prod

  redis:
    image: redis:latest
    networks:
      - backend-dev
      - backend-prod

  clamav:
    image: clamav/clamav:latest
    networks:
      - backend-dev
      - backend-prod

  traefik:
    image: traefik:v3.2.1
    container_name: hestami-traefik
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - traefik-public

  static:
    build:
      context: ./backend/static
      dockerfile: Dockerfile
    networks:
      - backend-dev
      - backend-prod
```

### docker-compose.dev.yml

Overrides for development-specific configurations.

```yaml
services:
  frontend:
    container_name: hestami-frontend-dev
    environment:
      - NODE_ENV=development
    env_file:
      - .env.dev
    networks:
      - backend-dev

  backend:
    container_name: hestami-backend-dev
    environment:
      - DJANGO_DEBUG=True
    env_file:
      - .env.dev
    networks:
      - backend-dev

  db:
    container_name: hestami-db-dev
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    env_file:
      - .env.dev
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    networks:
      - backend-dev
```

### docker-compose.prod.yml

Overrides for production-specific configurations.

```yaml
services:
  frontend:
    container_name: hestami-frontend-prod
    environment:
      - NODE_ENV=production
    env_file:
      - .env.prod
    networks:
      - backend-prod

  backend:
    container_name: hestami-backend-prod
    environment:
      - DJANGO_DEBUG=False
    env_file:
      - .env.prod
    networks:
      - backend-prod

  db:
    container_name: hestami-db-prod
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    env_file:
      - .env.prod
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    networks:
      - backend-prod
```

## 5. Commands for Managing Services

### For Development

Bring Up Development Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Bring Down Development Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

Rebuild Development Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
```

### For Production

Bring Up Production Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Bring Down Production Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

Rebuild Production Services:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```
