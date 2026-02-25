# Historian Inference Service
# Serves the Historian model (base + current LoRA adapter)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY services/historian-infer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and prompts
COPY services/historian-infer/src ./src
COPY services/historian-infer/prompts ./prompts
COPY schemas ./schemas

# Environment variables
ENV MODEL_PATH=/models/base
ENV ADAPTER_PATH=/models/adapters/current
ENV PORT=8000
ENV MAX_TOKENS=1024

EXPOSE 8000

CMD ["python", "-m", "src.server"]
