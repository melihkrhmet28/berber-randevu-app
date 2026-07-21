#!/bin/sh
set -e

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Applying database migrations..."
python manage.py migrate

echo "Ensuring admin and barber user passwords..."
python manage.py shell -c "
from appointments.models import Barber

# Guarantee admin account with password 'admin'
admin_user, created = Barber.objects.get_or_create(username='admin', defaults={'email': 'admin@example.com'})
admin_user.set_password('admin')
admin_user.is_staff = True
admin_user.is_superuser = True
admin_user.save()
print('Admin user ready: username=admin, password=admin')

# Reset/ensure barber accounts if needed
for username in ['mustafa', 'semih', 'melih2', 'semih2']:
    b = Barber.objects.filter(username=username).first()
    if b:
        b.set_password('123456')
        b.save()
        print(f'Barber user updated: username={username}, password=123456')
"

echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8000}
