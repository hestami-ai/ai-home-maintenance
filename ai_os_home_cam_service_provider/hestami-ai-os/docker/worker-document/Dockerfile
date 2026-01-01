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

# Configure ClamAV freshclam
RUN mkdir -p /var/lib/clamav && \
    echo "DatabaseMirror database.clamav.net" > /etc/clamav/freshclam.conf && \
    echo "DatabaseDirectory /var/lib/clamav" >> /etc/clamav/freshclam.conf && \
    chown -R clamav:clamav /var/lib/clamav

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Entrypoint script handles ClamAV updates and starts the server
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
