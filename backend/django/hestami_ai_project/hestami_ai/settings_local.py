# Local development settings
import os
from pathlib import Path

# Database credentials
DB_NAME = os.getenv('DB_NAME', 'hestami_ai_db')
DB_USER = os.getenv('DB_USER', 'hestami_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'hestami_password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).resolve().parent.parent / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

# Debug settings
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Email settings for development (using console backend)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# CORS settings for development
CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True
