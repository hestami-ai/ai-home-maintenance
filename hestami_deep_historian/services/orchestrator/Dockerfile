# Orchestrator Service for Historian Agent Platform
# Historian workflow engine with DBOS for durable execution
#
# The orchestrator coordinates the verification workflow:
# Proposal → Claims → Evidence → Reasoning → Judgment

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY README.md .
COPY orchestrator/src ./orchestrator/src
COPY tests ./tests

# Install dependencies using uv (including dev for testing)
RUN uv pip install --system -e ".[dev]"

# Create necessary directories
RUN mkdir -p /logs/audit_bundles /config

# Set Python path
ENV PYTHONPATH=/app/orchestrator/src

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8080/health')" || exit 1

# Default command runs the CLI in serve mode
CMD ["python", "-m", "historian.cli", "serve", "--host", "0.0.0.0", "--port", "8080"]
