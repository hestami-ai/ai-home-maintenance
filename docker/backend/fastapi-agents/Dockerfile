FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ./backend/fastapi/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Make startup script executable
COPY ./backend/fastapi/startup.sh /app/
RUN chmod +x /app/startup.sh

# Expose FastAPI port
EXPOSE 8001

# Start services using startup script
CMD ["/app/startup.sh"]
