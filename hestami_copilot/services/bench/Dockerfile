# Benchmark/Regression Service
# Runs benchmark suite against Historian model
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY services/bench/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY services/bench/src ./src
COPY services/bench/cases ./cases
COPY schemas ./schemas

# Environment variables
ENV HISTORIAN_URL=http://historian-infer:8000
ENV DATABASE_URL=postgresql://hestami:hestami@registry-db:5432/historian_registry

CMD ["python", "-m", "src.runner"]
