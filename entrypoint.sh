#!/bin/sh
# =============================================================================
# DOCKER ENTRYPOINT SCRIPT (Konteyner Başlangıç Betiği)
# =============================================================================
# Docker konteyneri çalıştırıldığında ilk olarak bu kabuk betiği devreye girer.
# Sırasıyla statik dosyaları toplar, veritabanı tablolarını günceller ve sunucuyu başlatır.
# =============================================================================

# Herhangi bir komut hata verirse işlemi anında durdurur (Güvenlik tedbiri)
set -e

# 1. Statik dosyaları (CSS/JS/Görseller) staticfiles/ dizininde bir araya getirir
echo "Statik dosyalar toplanıyor (collectstatic)..."
python manage.py collectstatic --noinput

# 2. Veritabanı tablolarını günceller (Migrations)
echo "Veritabanı tabloları güncelleniyor (migrate)..."
python manage.py migrate

# 3. İlk kurulumda varsayılan Admin ve Berber hesaplarının oluşturulması
echo "İlk kullanıcı hesapları doğrulanıyor..."
python manage.py shell -c "
from appointments.models import Barber

# Varsayılan Admin hesabı yoksa oluşturulur (Kullanıcı Adı: admin, Şifre: admin)
admin_user, created = Barber.objects.get_or_create(username='admin', defaults={'email': 'admin@example.com'})
if created:
    admin_user.set_password('admin')
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    print('Varsayılan Admin hesabı kuruldu: admin / admin')

# İlk berber kullanıcılarının şifreleri boşsa atanır
for username in ['mustafa', 'semih', 'melih2', 'semih2']:
    b = Barber.objects.filter(username=username).first()
    if b and not b.password:
        b.set_password('123456')
        b.save()
        print(f'{username} için varsayılan şifre belirlendi.')
"

# 4. Gunicorn HTTP Prodüksiyon Sunucusunu Başlatır (PORT değişkeni dinlenir)
echo "Gunicorn Web Sunucusu başlatılıyor..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8000}
