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