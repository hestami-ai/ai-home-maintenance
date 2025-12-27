FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    clamav \
    clamav-daemon \
    libimage-exiftool-perl \
    libvips \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Update ClamAV definitions (this might fail during build if no internet, 
# typically handled in entrypoint or cron in prod, but let's try initial fetch)
# RUN freshclam || true

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
