FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY backend/temporal-workers/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/temporal-workers/src /app/src

# Set Python path to include the src directory
ENV PYTHONPATH=/app/src

# Run the worker
WORKDIR /app/src
CMD ["python", "worker.py"]
