#!/bin/bash


### NOTES on setting up the database
###
#### If the database doesn't exist, create it
#### if [ "$DATABASE" = "postgres" ] && [ "$CREATE_DB" = "true" ]; then
####     echo "Creating database..."
####     echo "CREATE DATABASE $SQL_NAME;" | docker exec -i postgres psql -U postgres
####     echo "Database created"
#### fi

#### Login
#### PGPASSWORD=$SQL_PASSWORD psql -h $SQL_HOST -U $SQL_USER

#### List databases
#### PGPASSWORD=$SQL_PASSWORD psql -h $SQL_HOST -U $SQL_USER -l

#### Drop the Django database
#### PGPASSWORD=$SQL_PASSWORD psql -h $SQL_HOST -U $SQL_USER -c "DROP DATABASE $SQL_DATABASE;"

#### python manage.py createsuperuser
#### Email: mhendricks@hestami-ai.com
#### Name: Marshall Hendricks
#### Password: 
#### Password (again): 
#### Superuser created successfully.

# Exit on any error
set -e


# Display environment variables
echo "Environment variables:"
echo "   DJANGO_SETTINGS_MODULE: $DJANGO_SETTINGS_MODULE"
echo "   SQL_HOST: $SQL_HOST"
echo "   SQL_PORT: $SQL_PORT"
echo "   SQL_USER: $SQL_USER"
if [ -n "$SQL_PASSWORD" ] && [ ${#SQL_PASSWORD} -ge 8 ]; then
    echo "   SQL_PASSWORD: ******"
else
    echo "   SQL_PASSWORD: Error Not Defined"
fi
echo "   SQL_DATABASE: $SQL_DATABASE"
echo "   SQL_ENGINE: $SQL_ENGINE"
if [ -n "$DJANGO_SECRET_KEY" ] && [ ${#DJANGO_SECRET_KEY} -ge 8 ]; then
    echo "   DJANGO_SECRET_KEY: ******"
else
    echo "   DJANGO_SECRET_KEY: Error Not Defined"
fi
echo ""

echo "PYTHONPATH: $PYTHONPATH"

# Wait for postgres
if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."

    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 1
    done

    echo "PostgreSQL started"
fi

# Wait for Redis
echo "Waiting for Redis..."
while ! nc -z redis 6379; do
    sleep 1
done
echo "Redis started"

echo ""

# Configure USDZ MIME type detection
echo "Configuring USDZ MIME type detection..."

# Check if USDZ is already configured in magic files
USDZ_CONFIGURED=false

# Check /etc/magic for any USDZ-related MIME types
if [ -f /etc/magic ] && (grep -q "model/vnd.usdz+zip" /etc/magic || grep -q "model/vnd.pixar.usd" /etc/magic); then
    echo "USDZ already configured in /etc/magic"
    USDZ_CONFIGURED=true
fi

# Check /usr/share/file/magic/ for any USDZ-related MIME types
if [ -d /usr/share/file/magic/ ] && (grep -r "model/vnd.usdz+zip" /usr/share/file/magic/ > /dev/null 2>&1 || grep -r "model/vnd.pixar.usd" /usr/share/file/magic/ > /dev/null 2>&1); then
    echo "USDZ already configured in /usr/share/file/magic/"
    USDZ_CONFIGURED=true
fi

# Check /usr/share/file/magic.mgc (compiled magic file)
if [ -f /usr/share/file/magic.mgc ]; then
    echo "Compiled magic file exists at /usr/share/file/magic.mgc"
    
    # Test if the compiled magic database recognizes USDZ
    # Create a temporary test file with USDZ-like signature
    TEST_FILE=$(mktemp)
    # Write ZIP signature (PK\003\004) followed by minimal ZIP header and .usda filename
    printf 'PK\003\004\024\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000model.usda' > "$TEST_FILE"
    
    # Test with file command
    DETECTED_MIME=$(file --mime-type -b "$TEST_FILE" 2>/dev/null)
    
    if [ "$DETECTED_MIME" = "model/vnd.usdz+zip" ] || [ "$DETECTED_MIME" = "model/vnd.pixar.usd-ascii+zip" ] || [ "$DETECTED_MIME" = "model/vnd.pixar.usd-text+zip" ]; then
        echo "Compiled magic database recognizes USDZ format (detected as: $DETECTED_MIME)"
        USDZ_CONFIGURED=true
    else
        echo "Compiled magic database does not recognize USDZ (detected as: $DETECTED_MIME)"
    fi
    
    # Clean up test file
    rm -f "$TEST_FILE"
fi

# If USDZ is not configured, add it to /etc/magic
if [ "$USDZ_CONFIGURED" = false ]; then
    echo "Adding USDZ MIME type detection to /etc/magic..."
    
    # Create /etc/magic if it doesn't exist
    if [ ! -f /etc/magic ]; then
        touch /etc/magic
        echo "Created /etc/magic"
    fi
    
    # Add USDZ magic pattern
    # USDZ files are ZIP archives containing USD files
    # We use distinct MIME types to differentiate between internal formats:
    # - USDA (ASCII) - Text format, supported by Three.js USDZLoader
    # - USDC (Crate) - Binary format, NOT YET supported by Three.js USDZLoader
    cat >> /etc/magic << 'EOF'

# USDZ (Universal Scene Description ZIP) - Apple AR format
# USDZ files are ZIP archives (PK signature) containing .usd, .usda, .usdc, or .usdt files
# Check for specific internal formats to provide more detailed MIME types
0       string          PK\003\004
# USDA (ASCII/Text) - Supported by Three.js USDZLoader
>30     search/256      .usda           model/vnd.usdz+zip
# USDC (Crate/Binary) - NOT YET supported by Three.js USDZLoader
>30     search/256      .usdc           model/vnd.pixar.usd-binary+zip
# Generic USD - Fallback
>30     search/256      .usd            model/vnd.usdz+zip
EOF
    
    echo "USDZ MIME type detection added to /etc/magic"
else
    echo "USDZ MIME type detection already configured"
fi

echo ""

#echo "Sleep 60 seconds..."
#sleep 60

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Make database migrations
echo "Making database migrations..."
python manage.py makemigrations

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate

# Generate API documentation
# echo "Generating API documentation..."
# python manage.py spectacular --file openapi-schema.json

# Start Celery worker
echo "Starting Celery worker..."
celery -A hestami_ai worker --loglevel=info &

# Start Celery Beat scheduler
echo "Starting Celery Beat scheduler..."
celery -A hestami_ai beat --loglevel=info &

# Start server
echo "Starting server..."
exec "$@"