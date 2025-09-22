# DevSecOps Architecture Diagram

## CI/CD Pipeline Flow: From Developer to Production

```mermaid
graph TD
    %% Developer Actions
    A[Developer] -->|Git Clone| B[Local Repository]
    B -->|Code Changes| C[Local Testing]
    C -->|Git Push| D[GitHub Repository]
    
    %% Branch Logic
    D -->|Push to dev branch| E[GitHub Actions CI/CD]
    D -->|Push to main branch| F[GitHub Actions CI/CD]
    
    %% Dev Branch Flow
    E -->|Build| G[Build & Test]
    G -->|Scan| H[Security Scanning]
    H -->|Push Image| I[GHCR - Dev Image]
    I -->|Auto Deploy| J[Self-hosted Runner - Dev]
    J -->|Deploy| K[Dev Environment]
    
    %% Main Branch Flow
    F -->|Build| L[Build & Test]
    L -->|Scan| M[Security Scanning]
    M -->|Push Image| N[GHCR - Prod Image]
    N -->|Manual Approval| O[GitHub Environment: Production]
    O -->|Approved| P[Self-hosted Runner - Prod]
    P -->|Deploy| Q[Prod Environment]
    
    %% Dev Environment
    subgraph "Development Server"
        K -->|docker compose| K1[Traefik]
        K -->|docker compose| K2[Frontend]
        K -->|docker compose| K3[API]
        K -->|docker compose| K4[DB]
        K -->|docker compose| K5[AI Services]
        K1 -->|TLS Termination| K6[api.dev.hestami-ai.com]
        K6 -->|Basic Auth| K7[Internet]
    end
    
    %% Prod Environment
    subgraph "Production Server"
        Q -->|docker compose| Q1[Traefik]
        Q -->|docker compose| Q2[Frontend]
        Q -->|docker compose| Q3[API]
        Q -->|docker compose| Q4[DB]
        Q1 -->|TLS Termination| Q5[api.hestami-ai.com]
        Q5 -->|Security Headers| Q6[Internet]
    end
    
    %% Networks
    subgraph "Networks"
        K1 ---|traefik-public| K6
        K2 ---|backend-dev| K3
        K3 ---|backend-dev| K4
        K3 ---|backend-dev| K5
        
        Q1 ---|traefik-public| Q5
        Q2 ---|backend-prod| Q3
        Q3 ---|backend-prod| Q4
    end
    
    %% Deployment Process
    J -->|1. Pull Images| J1[Pull from GHCR]
    J -->|2. Update .env.local| J2[Set IMAGE_TAG]
    J -->|3. Run deploy.sh| J3[Deploy Script]
    J3 -->|4. docker compose up| K
    
    P -->|1. Pull Images| P1[Pull from GHCR]
    P -->|2. Update .env.prod| P2[Set IMAGE_TAG]
    P -->|3. Run deploy.sh| P3[Deploy Script]
    P3 -->|4. docker compose up| Q
    
    %% Security Scanning
    H -->|Trivy| H1[Container Scanning]
    H -->|Semgrep| H2[SAST]
    M -->|Trivy| M1[Container Scanning]
    M -->|Semgrep| M2[SAST]
    
    %% Styling
    classDef developer fill:#f9f,stroke:#333,stroke-width:2px
    classDef github fill:#24292e,color:#fff,stroke:#333
    classDef actions fill:#2088FF,color:#fff,stroke:#333
    classDef security fill:#cb2431,color:#fff,stroke:#333
    classDef registry fill:#6f42c1,color:#fff,stroke:#333
    classDef runner fill:#22863a,color:#fff,stroke:#333
    classDef environment fill:#0366d6,color:#fff,stroke:#333
    classDef traefik fill:#f0ad4e,stroke:#333
    classDef service fill:#5bc0de,stroke:#333
    classDef network fill:#d9534f,color:#fff,stroke:#333
    
    class A,B,C developer
    class D,O github
    class E,F,G,L actions
    class H,M,H1,H2,M1,M2 security
    class I,N registry
    class J,P,J1,J2,J3,P1,P2,P3 runner
    class K,Q environment
    class K1,Q1 traefik
    class K2,K3,K4,K5,Q2,Q3,Q4 service
    class K6,K7,Q5,Q6 network
```

## Component Details

### Developer Workflow
1. Developer clones the repository locally
2. Makes code changes and tests locally
3. Pushes changes to GitHub repository
   - Push to `dev` branch for development deployment
   - Push to `main` branch for production deployment

### CI/CD Pipeline - Development
1. GitHub Actions triggered on push to `dev` branch
2. Build and test the application
3. Security scanning with Trivy and Semgrep
4. Push container image to GitHub Container Registry (GHCR)
5. Self-hosted runner automatically deploys to development environment:
   - Pulls latest image from GHCR
   - Updates `.env.local` with new image tag
   - Runs deployment script
   - Executes `docker compose` commands to update services

### CI/CD Pipeline - Production
1. GitHub Actions triggered on push to `main` branch
2. Build and test the application
3. Security scanning with Trivy and Semgrep
4. Push container image to GitHub Container Registry (GHCR)
5. Manual approval required in GitHub Environment: Production
6. After approval, self-hosted runner deploys to production environment:
   - Pulls latest image from GHCR
   - Updates `.env.prod` with new image tag
   - Runs deployment script
   - Executes `docker compose` commands to update services

### Environment Architecture
- **Development Environment**:
  - Traefik as edge service (port 443)
  - Frontend (SvelteKit)
  - API (Django)
  - Database (PostgreSQL)
  - AI Services (FastAPI, Ollama, VLLM)
  - Protected by basic auth and IP allowlist
  - Accessible at api.dev.hestami-ai.com

- **Production Environment**:
  - Traefik as edge service (port 443)
  - Frontend (Next.js)
  - API (Django)
  - Database (PostgreSQL)
  - Enhanced security headers
  - Accessible at api.hestami-ai.com

### Networks
- `traefik-public`: External network for internet-facing services
- `backend-dev`: Internal network for development services
- `backend-prod`: Internal network for production services
- `temporal-network`: External network for temporal services (not shown in diagram)

## Security Features
- TLS termination at Traefik
- Container image scanning with Trivy
- Static Application Security Testing (SAST) with Semgrep
- Basic auth protection for development environment
- Enhanced security headers for production
- Secure environment variables management
- Manual approval gate for production deployments
