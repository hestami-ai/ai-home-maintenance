# PageIndex Service for Historian Agent Platform
# Vectorless, Reasoning-based RAG using FORKED VectifyAI PageIndex
# Fork location: services/pageindex/app/3rdParty/pageindex
# Original: https://github.com/VectifyAI/PageIndex

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY services/pageindex/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the PageIndex service wrapper (includes forked PageIndex at app/3rdParty/pageindex)
COPY services/pageindex/app ./app

# Create symlink so 'import pageindex' uses our forked version
RUN ln -s /app/app/3rdParty/pageindex /app/pageindex

# Create directories for data
RUN mkdir -p /data/specs /data/index

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
