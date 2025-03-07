# Hestami AI Development Guide

## Project Structure

```
hestami-ai/
  |-- archive/                    # Archived project files and resources
  
  |-- backend/                    # Backend services
      |-- django/                # Django-based backend
          |-- hestami_ai_project/  # Main Django project
              |-- ai_agents/     # AI agent management (NOT IMPLEMENTED)
              |-- availability/  # Availability management (NOT IMPLEMENTED)
              |-- bids/         # Bidding system (NOT IMPLEMENTED)
              |-- common/       # Shared utilities
              |-- communications/ # Communication system (NOT IMPLEMENTED)
              |-- hestami_ai/   # Core project settings
              |-- properties/   # Property management (IMPLEMENTED)
              |-- ratings/      # Rating system (NOT IMPLEMENTED)
              |-- services/     # Service management (PARTIALLY IMPLEMENTED)
              |-- users/        # User management  (IMPLEMENTED)
              |-- media/        # User uploaded files (IMPLEMENTED)
              |-- logs/         # Application logs (IMPLEMENTED)
      |-- fastapi/               # FastAPI-based backend
          |-- alembic/           # Database migrations (NOT IMPLEMENTED)
          |-- app/               # Main FastAPI application (PARTIALLY IMPLEMENTED)
              |-- api/           # API endpoints (NOT IMPLEMENTED)
              |-- core/          # Core functionality (NOT IMPLEMENTED)
              |-- models/        # Data models (NOT IMPLEMENTED)
          |-- docs/              # API documentation (NOT IMPLEMENTED)
      |-- static/                # Static files (IGNORE IN GIT)
  
  |-- docker/                     # Docker configurations 
      |-- frontend/              # Frontend container config (IMPLEMENTED)
      |-- backend/               # Backend container config (IMPLEMENTED)
      |-- nginx/                 # Nginx configuration (IMPLEMENTED)
  
  |-- docs/                       # Project documentation
      |-- alpha_deliveries/      # Alpha release documentation
      |-- backend/               # Backend documentation
      |-- django-5.1.1/          # Django framework docs
      |-- hestami-ai/            # Main project documentation
          |-- docs/              # Core documentation
              |-- Agentic Docs/  # Business and requirements
      |-- nextauthv5/           # NextAuth documentation
      |-- nextjs-14.2.18/       # Next.js framework docs
  
  |-- frontend/                   # Frontend application (IMPLEMENTED)
      |-- nextjs/                # Next.js frontend implementation
          |-- public/            # Static assets
          |-- src/               # Source code
              |-- app/           # Next.js app router pages
              |-- components/    # Reusable components
              |-- context/       # React context providers
              |-- hooks/         # Custom React hooks
              |-- middleware/    # Request middleware
              |-- styles/        # CSS and styling
              |-- types/         # TypeScript type definitions
              |-- utils/         # Utility functions
          |-- typescript-api/    # Generated API types
  
  |-- scripts/                    # Development and deployment scripts (OUT OF SCOPE - FOR NOW)
  
  |-- tests/                      # Test suites (OUT OF SCOPE - FOR NOW)
  
  |-- visual_concepts/            # Visual design assets (IGNORE)
  
  |-- volumes/                    # Docker persistent volumes (PARTIALLY IMPLEMENTED)
  
  |-- .env.local                 # Local environment configuration (IMPLEMENTED)
  |-- .env.prod                  # Production environment configuration (IMPLEMENTED)
  |-- compose.common.yaml        # Common Docker Compose settings (IMPLEMENTED)
  |-- compose.dev.yaml           # Development environment compose (IMPLEMENTED)
  |-- compose.prod.yaml          # Production environment compose (IMPLEMENTED)
```

## Development Setup

### Prerequisites
- Node.js 22.11.0 or later
- Python 3.12.7 or later
- Docker 27.3.1 or later
- Git 2.47.1 or later
- Poetry 1.8.4 or later

### Initial Setup

1. **Clone the Repository**
```bash
git clone https://github.com/your-org/hestami-ai.git
cd hestami-ai
```

2. **Set Up Environment Files**
```bash
cp .env.example .env.dev
cp .env.example .env.prod
```

3. **Install Dependencies**

Frontend:
```bash
cd frontend/nextjs
npm install
```

Backend:
```bash
cd backend/django
poetry install
```

4. **Initialize Development Database**
```bash
./scripts/setup/init-db.sh
```

### Development Workflow

#### Running the Application

1. **Start Development Services**
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

2. **Watch for Changes**
Frontend (http://hestami.local:3000):
```bash
cd frontend/nextjs
npm run dev
```

Backend (http://api.hestami.local:8000):
```bash
cd backend/django
poetry run python manage.py runserver
```

#### Code Quality Tools

1. **Frontend**
```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format

# Run tests
npm run test
```

2. **Backend**
```bash
# Format code
poetry run black .

# Lint code
poetry run flake8

# Type checking
poetry run mypy .

# Run tests
poetry run pytest
```

### VS Code Integration

1. **Recommended Extensions**
- Python
- ESLint
- Prettier
- Docker
- GitLens
- Python Test Explorer

2. **Debugging**
- Use the provided launch configurations in `.vscode/launch.json`
- Breakpoints work for both frontend and backend code
- Integrated terminal for running commands

### Git Workflow

1. **Branches**
- `main`: Production-ready code
- `develop`: Development branch
- Feature branches: `feature/feature-name`
- Bug fixes: `fix/bug-name`

2. **Commits**
- Use conventional commits format
- Include ticket numbers if applicable
- Keep commits focused and atomic

3. **Pull Requests**
- Use provided PR template
- Require code review
- Must pass CI checks
- Must have updated tests

### Documentation

1. **API Documentation**
- Update Swagger/OpenAPI specs
- Document new endpoints in `/docs/api`
- Include request/response examples

2. **Code Documentation**
- Use docstrings for Python code
- JSDoc for JavaScript/TypeScript
- Update README files in directories

3. **Architecture Documentation**
- Update architecture diagrams
- Document new services
- Update deployment guides

### Testing Strategy

1. **Unit Tests**
- Frontend: Jest + React Testing Library
- Backend: pytest
- Aim for high coverage

2. **Integration Tests**
- API tests with pytest
- Database integration tests
- Service integration tests

3. **End-to-End Tests**
- Cypress for frontend
- Selenium for complex flows
- Test critical user journeys

### Performance Monitoring

1. **Frontend**
- Lighthouse scores
- Bundle size monitoring
- Performance metrics

2. **Backend**
- API response times
- Database query performance
- Memory usage

3. **Infrastructure**
- Container health
- Resource utilization
- Network performance

### Security Considerations

1. **Code Security**
- Regular dependency updates
- Security linting
- Code scanning

2. **Development Security**
- Secure environment variables
- Local HTTPS
- Database security

3. **Access Control**
- Role-based access
- API authentication
- Development credentials

### Windows Development Environment Setup

#### Prerequisites
1. **Windows Requirements:**
   - Windows 10/11 with latest updates
   - PowerShell 7.0 or later (`winget install Microsoft.PowerShell`)
   - Windows Terminal (recommended) (`winget install Microsoft.WindowsTerminal`)
   - Git for Windows (`winget install Git.Git`)
   - Docker Desktop for Windows (`winget install Docker.DockerDesktop`)

2. **Optional Tools:**
   - WSL2 for Linux tooling
   - Visual Studio Code (`winget install Microsoft.VisualStudioCode`)
   - Windows Package Manager (winget)

#### PowerShell Configuration
1. Enable script execution (Run as Administrator):
   ```powershell
   Set-ExecutionPolicy RemoteSigned
   ```

2. Install development tools:
   ```powershell
   # Install Node.js LTS
   winget install OpenJS.NodeJS.LTS

   # Install Python 3.12
   winget install Python.Python.3.12

   # Install PostgreSQL
   winget install PostgreSQL.PostgreSQL
   ```

3. Configure Git for Windows:
   ```powershell
   git config --global core.autocrlf true
   git config --global core.eol lf
   ```

#### Docker Configuration
1. Enable WSL2 backend in Docker Desktop
2. Configure resource limits:
   - CPUs: Minimum 2 cores
   - Memory: Minimum 4GB
   - Swap: Minimum 1GB
3. Enable file sharing for project directory

#### Environment Variables
Configure system environment variables through PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable('DOCKER_BUILDKIT', '1', 'Machine')
[System.Environment]::SetEnvironmentVariable('COMPOSE_DOCKER_CLI_BUILD', '1', 'Machine')
```
