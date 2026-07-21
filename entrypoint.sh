#!/bin/sh
set -e

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Applying database migrations..."
python manage.py migrate

echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8000}
