# **ROLE**

You are a senior DevOps engineer. Implement a **pull-based** CI/CD pipeline for a single VM with **DEV** and **PROD** docker-compose stacks behind **Traefik**, using **GitHub Actions** and a **self-hosted runner** (no inbound SSH).

# **CONTEXT**

* One public IP, one VM (“deployment server”).

* Traefik as the only edge service publishing port 443 for internet-facing services.

* Two compose stacks on the same server: `dev` and `prod` (separate compose project names).

* GitHub repository is the source of truth. Builds happen in cloud runners; deployment happens on the self-hosted runner on the server (pull model).

* Container images live in **GHCR** (GitHub Container Registry).

# **OBJECTIVE**

Deliver a repo structure, workflows, and server scripts so that:

* Push to `dev` → build, scan, push image → **auto-deploy** to DEV stack via self-hosted runner.

* Push to `main` → build, scan, push image → **manual approval gate** → deploy to PROD stack via self-hosted runner.

* DEV uses basic-auth/IP allowlist via Traefik; PROD uses stricter security headers. Only Traefik exposes host ports.

# **DELIVERABLES**

**Repo layout** (create/modify as needed):

 `.`  
`├── compose.common.yaml`  
`├── compose.dev.yaml`  
`├── compose.prod.yaml`  
`├── traefik/`  
`│   ├── dynamic/common.yaml`  
`│   └── (README.md with quick notes)`  
`├── scripts/`  
`│   ├── deploy.sh`  
`│   └── runner-install.md`  
`├── .github/workflows/cicd.yml`  
`├── .semgrep.yml                  # optional, basic ruleset`  
`├── Makefile`  
`└── README.md`

1.   
2. **`compose.common.yaml`**

   * Define shared services (e.g., `api`) using image tag `${IMAGE_TAG}`.

   * Attach to `traefik-public` (external), `backend-dev` (for dev environment), and `backend-prod` (for prod environment).

   * No host port publishes anywhere except Traefik (Traefik runs in its own stack).

Example snippet:

 `services:`  
  `api:`  
    `build:`  
      `context: .`  
      `dockerfile: ./docker/backend/django/Dockerfile`  
    `container_name: api-dev`  
    `command: python manage.py runserver 0.0.0.0:8050`  
    `volumes:`  
      `- ./backend/django/hestami_ai_project:/app:rw`  
      `- "./volumes/dev/static/hestami_media_data_dev:/mnt/hestami-static:rw"`  
    `depends_on:`  
      `- db`  
      `- redis`  
    `env_file:`  
      `- ./.env.local`  
    `networks: [traefik-public, backend-dev]`  
`networks:`  
  `traefik-public:`  
    `external: true`  
  `backend-dev:`  
    `external: false`  
  `backend-prod:`  
    `external: false`

*   
3. **`compose.dev.yaml`**

   * DEV router \+ middlewares (basic-auth/IP allowlist).

   * Use `-p dev` at deploy time.

Example labels:

 `services:`  
  `frontend:`  
    `labels:`  
      `- traefik.enable=true`  
      `- traefik.http.routers.frontend-dev.rule=Host(`${DEV_API_HOST}`)`  
      `- traefik.http.routers.frontend-dev.entrypoints=websecure`  
      `- traefik.http.routers.frontend-dev.tls=true`  
      `- traefik.http.services.frontend-dev.loadbalancer.server.port=3000`  
      `- traefik.http.routers.frontend-dev.middlewares=secure-headers@file,basic-auth@file`

*   
4. **`compose.prod.yaml`**

   * PROD router without basic-auth, security headers via file provider.

Use `-p prod` at deploy time.

 `services:`  
  `app:`  
    `labels:`  
      `- traefik.enable=true`  
      `- traefik.http.routers.frontend.rule=Host(`${PROD_API_HOST}`)`  
      `- traefik.http.routers.frontend.tls=true`  
      `- traefik.http.services.frontend.loadbalancer.server.port=3000`  
      `- traefik.http.routers.frontend.middlewares=secure-headers@file`

*   
5. **Traefik dynamic config** at `traefik/dynamic/common.yaml`

Shared security headers, TLS options, basic-auth user (htpasswd hash placeholder).

 `http:`  
  `middlewares:`  
    `secure-headers:`  
      `headers:`  
        `stsSeconds: 31536000`  
        `stsIncludeSubdomains: true`  
        `stsPreload: true`  
        `frameDeny: true`  
        `contentTypeNosniff: true`  
        `referrerPolicy: no-referrer`  
        `customResponseHeaders:`  
          `X-Content-Type-Options: nosniff`  
          `X-Frame-Options: DENY`  
    `basic-auth:`  
      `basicAuth:`  
        `users:`  
          `- "devuser:REPLACE_WITH_HTPASSWD_HASH"`  
`tls:`  
  `options:`  
    `default:`  
      `minVersion: VersionTLS12`

*   
  * Add a short `README.md` under `traefik/` describing how to create htpasswd hash.

6. **Deployment script** at `scripts/deploy.sh` (POSIX sh, idempotent):

   * Usage: `./deploy.sh <dev|prod> <IMAGE_TAG>`

Loads `.env.local` (for dev) or `.env.prod` from the project root directory, sets `IMAGE_TAG`, runs:

 `docker compose -p <proj> -f compose.common.yaml -f compose.<env>.yaml pull`  
`docker compose -p <proj> -f compose.common.yaml -f compose.<env>.yaml up -d --remove-orphans`

*   
  * Prunes old images older than 7 days.

7. **Self-hosted runner install guide** at `scripts/runner-install.md`

   * Steps to install two runners on the same box with labels `dev` and `prod` (or one runner with both labels).

   * Ensure runner user added to `docker` group.

Describe directory layout on server:

 `/home/mhendricks/projects/hestami-ai/`  
  `compose.common.yaml`  
  `compose.dev.yaml`  
  `compose.prod.yaml`  
  `.env.local`  
  `.env.prod`  
  `scripts/deploy.sh`

*   
8. **GitHub Actions workflow** at `.github/workflows/cicd.yml`

   * Triggers on push to `dev` and `main`.

   * Job 1 (`build-test-scan`, GitHub-hosted):

     * Checkout

     * Compute `IMAGE_TAG=${{ github.sha }}`

     * Login to GHCR

     * Build app image

     * **Trivy** image scan (fail on HIGH/CRITICAL)

     * (Optional) **Semgrep** SAST using `.semgrep.yml`

     * Push image (`:sha` and `:latest`)

     * Output `image_tag`

   * Job 2 (`deploy-dev`, self-hosted runner with label `dev`):

     * Condition: `ref == dev`

     * Login to GHCR

`ssh` not used. Instead, run locally on the self-hosted runner:

 `export IMAGE_TAG=${{ needs.build-test-scan.outputs.image_tag }}`  
`cd /home/mhendricks/projects/hestami-ai`  
`sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env.local || echo "IMAGE_TAG=${IMAGE_TAG}" >> .env.local`  
`./scripts/deploy.sh dev "${IMAGE_TAG}"`

*   
  * Job 3 (`deploy-prod`, self-hosted runner with label `prod`):

    * Condition: `ref == main`

    * Uses **GitHub Environments** `production` for a manual approval gate.

    * Same steps as DEV, but targets `.env.prod` and `deploy.sh prod`.

  * Provide a complete, syntactically correct YAML.

**Makefile** with local helpers (for dev convenience):

 `build:`  
`\tdocker build -t ghcr.io/${GHCR_NAMESPACE}/${APP_NAME}:dev .`  
`run-dev:`  
`\tdocker compose -p dev -f compose.common.yaml -f compose.dev.yaml up -d`  
`run-prod:`  
`\tdocker compose -p prod -f compose.common.yaml -f compose.prod.yaml up -d`  
`scan:`  
`\ttrivy fs --severity HIGH,CRITICAL .`

9.   
10. **README.md** with:

    * Overview diagram/flow (textual ok): push → build/scan → push → self-hosted runner deploy.

    * Prereqs: Docker/Compose, Traefik running on server with `traefik-public` external network and `exposedByDefault=false`, TLS configured, dashboard secured.

    * Secrets to create in GitHub:

      * `GHCR_USER`, `GHCR_TOKEN` (or use `GITHUB_TOKEN` where possible)

    * Variables to set:

      * `GHCR_NAMESPACE`, `APP_NAME`, `DEV_API_HOST`, `PROD_API_HOST`

    * How to create `.env.dev` / `.env.prod` on server (contain `IMAGE_TAG=latest`, and any app secrets).

    * Runner labels and how jobs target them.

    * Rollback: set `IMAGE_TAG` back to a prior SHA and re-run deploy job.

    * Disaster recovery: backup `/srv/yourapp` and Traefik `acme.json`.

# **ACCEPTANCE CRITERIA**

* ✅ Pushing to `dev` branch builds, scans, publishes image and updates the **DEV** stack on the server automatically, with Traefik routing `DEV_API_HOST` to the dev service protected by basic-auth.

* ✅ Pushing to `main` builds, scans, publishes image and—after manual approval—updates the **PROD** stack, routed at `PROD_API_HOST`.

* ✅ No inbound SSH required; the server only needs outbound HTTPS to GitHub and GHCR.

* ✅ Only Traefik publishes host ports; app containers are internal.

* ✅ Security checks run on every build (Trivy; optional Semgrep).

* ✅ Documentation (README \+ runner-install.md) enables a fresh machine setup end-to-end.

# **CONSTRAINTS & QUALITY**

* Use Docker Compose v2 syntax.

* Keep secrets out of git; use GitHub Secrets and local `.env.*` on server.

* Make scripts idempotent and safe for repeated runs.

* Provide sane error handling and comments in YAML and scripts.

* Keep everything minimal but production-credible; no unnecessary complexity.

# **OPTIONAL ENHANCEMENTS (if time permits)**

* Add Prometheus metrics and Traefik access logs (JSON) guidance.

* Add Watchtower example (commented) for image auto-pull (not default).

* Add blue/green or weighted service example via Traefik file provider.

* Add Crow dSec/fail2ban notes for port 443.

# **VARIABLES (fill with placeholders, top of files or README)**

* `GHCR_NAMESPACE=yourorg`

* `APP_NAME=hestami-ai`

* `DEV_API_HOST=api.dev.hestami-ai.com`

* `PROD_API_HOST=api.hestami-ai.com`

Produce all files with complete content, ready to commit. Include inline comments where trade-offs matter.

# **CURRENT IMPLEMENTATION NOTES**

The current implementation of the hestami-ai project uses the following structure and services:

1. **Docker Compose Files**:
   - `compose.common.yaml`: Contains shared services like Traefik, Joomla, and MariaDB
   - `compose.dev.yaml`: Development environment with frontend, API, database, and AI services
   - `compose.prod.yaml`: Production environment with streamlined services

2. **Key Services**:
   - **Frontend**: SvelteKit (dev) / Next.js (prod) application
   - **API**: Django backend service
   - **Static**: Nginx server for static files
   - **DB**: PostgreSQL database
   - **AI Services**: FastAPI, Ollama, VLLM for AI functionality
   - **Support Services**: Redis, ClamAV, Elasticsearch

3. **Networking**:
   - `traefik-public`: External network for internet-facing services
   - `backend-dev`: Internal network for development services
   - `backend-prod`: Internal network for production services
   - `temporal-network`: External network for temporal services

4. **Environment Files**:
   - `.env.local`: Development environment variables
   - `.env.prod`: Production environment variables

