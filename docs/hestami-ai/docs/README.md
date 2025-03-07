# Hestami AI Platform

A full-stack web application built with Next.js 14 and Django 5.1.

## Prerequisites

- Node.js 22.11.0 or later
- Python 3.12.7 or later
- Docker 27.3.1 or later
- Docker Compose
- PowerShell (Windows)

## Project Structure

The project follows a microservices architecture with the following main components:

- Frontend: Next.js 14 with TypeScript and Tailwind CSS
- Backend: Django 5.1 with Django REST Framework
- Database: PostgreSQL 17

## Quick Start

1. Clone the repository:
```powershell
git clone <repository-url>
cd hestami-ai
```

2. Copy the environment file:
```powershell
Copy-Item .env.example .env
```

3. Start the development environment:
```powershell
docker-compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Admin Interface: http://localhost:8000/admin

## Development Setup

### Frontend Development

The frontend is a Next.js 14 application with TypeScript and Tailwind CSS. To set up the development environment:

1. Navigate to the frontend directory:
```powershell
cd frontend/nextjs
```

2. Install dependencies:
```powershell
npm install
```

3. Start the development server:
```powershell
npm run dev
```

### Backend Development

The backend is a Django 5.1 application. To set up the development environment:

1. Navigate to the backend directory:
```powershell
cd backend/django
```

2. Create a virtual environment:
```powershell
python -m venv venv
.\venv\Scripts\Activate
```

3. Install dependencies:
```powershell
pip install -r requirements.txt
```

4. Run migrations:
```powershell
python manage.py migrate
```

5. Create a superuser:
```powershell
python manage.py createsuperuser
```

6. Start the development server:
```powershell
python manage.py runserver
```

## Available Routes

### Frontend Routes

- `/login` - Login page
- `/signup` - Registration page
- `/properties` - Property owners dashboard
- `/serviceprovider` - Service providers dashboard
- `/admin/dashboard` - Admin dashboard (Hestami AI Staff)

### API Endpoints

- `/api/auth/login/` - User login
- `/api/auth/register/` - User registration
- `/api/auth/refresh/` - Refresh access token
- `/api/properties/` - Property management
- `/api/services/` - Service provider features

## Security Features

- JWT-based authentication with access and refresh tokens
- HTTP-only cookies for token storage
- Role-based access control
- Password policy enforcement
- Session management
- Request rate limiting

## Contributing

Please refer to CONTRIBUTING.md for guidelines on how to contribute to this project.

## License

This project is proprietary and confidential. All rights reserved.
