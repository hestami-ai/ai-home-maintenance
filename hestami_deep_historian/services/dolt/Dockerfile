# Dolt SQL Server for Historian Agent Platform
# Git-for-data versioned SQL database for truth state management

FROM dolthub/dolt:1.81.4

# Create historian database directory
RUN mkdir -p /var/lib/dolt /docker-entrypoint-initdb.d

WORKDIR /var/lib/dolt

# Copy initialization files
COPY services/dolt/init/init.sql /docker-entrypoint-initdb.d/
COPY services/dolt/entrypoint.sh /entrypoint.sh

# Fix line endings (Windows CRLF -> Unix LF) and make executable
RUN tr -d '\r' < /entrypoint.sh > /entrypoint-fixed.sh && \
    mv /entrypoint-fixed.sh /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Expose MySQL-compatible port
EXPOSE 3306

# Use entrypoint script for initialization
ENTRYPOINT ["/entrypoint.sh"]
