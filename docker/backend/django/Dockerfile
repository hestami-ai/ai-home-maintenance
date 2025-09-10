FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    netcat-traditional \
    gcc \
    ffmpeg \
    libpq-dev \
    python3-dev \
    libmagic1 \
    #libgl1-mesa-glx \
    libgl1 \
    libglx-mesa0 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE=hestami_ai.settings
ENV PYTHONPATH=/app

# Create django user and group
RUN groupadd -r django && useradd -r -g django django

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY ./backend/django/hestami_ai_project/requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt 

# Copy project
COPY ./backend/django/hestami_ai_project/ .
RUN chmod +x /app/entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /mnt/hestami-static/media /mnt/hestami-static/static /app/logs && \
    chown -R django:django /app /mnt/hestami-static && \
    chmod -R 755 /app && \
    chmod -R 775 /mnt/hestami-static/media /mnt/hestami-static/static

# Switch to django user
#USER django

ENTRYPOINT ["/app/entrypoint.sh"]
