"""
=============================================================================
CORE SETTINGS (Django Proje Konfigürasyonu)
=============================================================================
Bu dosya Django projesinin ana ayarlarını, veritabanı bağlantısını, 
güvenlik kurallarını, yüklenen modülleri ve ortam değişkenlerini içerir.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# .env dosyasındaki özel değişkenleri (Gizli Anahtarlar, DB şifreleri vb.) yükler
load_dotenv()

# Projenin ana kök dizin yolunu belirler (Dizin referansı için kullanılır)
BASE_DIR = Path(__file__).resolve().parent.parent

# Güvenlik Anahtarı (SECRET_KEY): Django oturum şifrelemeleri için kullanılır
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-&%_8ap7)$ni$6ib$+z6e$!sib30(*i*pd(m&k^aum(!^%=1xnz')

# Geliştirici Modu (DEBUG): True iken detaylı hata ekranı gösterir, canlıda (Production) False olmalıdır
DEBUG = os.getenv('DEBUG', 'True') == 'True'

# Uygulamanın erişilmesine izin verilen etki alanları (Domainler)
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

# Django 4.0+ HTTPS form ve API isteklerinin güvenli kabul edileceği kaynaklar (Render & Localhost)
CSRF_TRUSTED_ORIGINS = [
    'https://*.onrender.com',
    'http://*.onrender.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]

# =============================================================================
# YÜKLENEN UYGULAMALAR (INSTALLED_APPS)
# =============================================================================
INSTALLED_APPS = [
    'jazzmin',                  # Modern & Özelleştirilebilir Admin Arayüzü Teması
    'django.contrib.admin',     # Dahili Django Yönetim Paneli
    'django.contrib.auth',      # Kullanıcı Kimlik Doğrulama ve Yetkilendirme
    'django.contrib.contenttypes', # Veritabanı Modelleri İçin Tür Takibi
    'django.contrib.sessions',  # Kullanıcı Oturum Yönetimi
    'django.contrib.messages',  # Bildirim / Mesaj Sistemi
    'django.contrib.staticfiles', # Statik Dosyalar (CSS, JS, Görseller)
    
    # Üçüncü Taraf Kütüphaneler (Third-party Packages)
    'rest_framework',           # Django REST Framework (JSON API Oluşturucu)
    'rest_framework.authtoken', # Token Tabanlı Giriş/Kimlik Doğrulama
    'corsheaders',              # Farklı domainlerden API çağrısına izin veren CORS katmanı
    
    # Bizim Uygulamamız
    'appointments',             # Berber, Randevu, Dükkan & Hizmet Mantığını Barındıran App
]

# REST Framework Kimlik Doğrulama Tipi (Token-based Auth)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
}

# =============================================================================
# ARA YAZILIMLAR (MIDDLEWARE)
# =============================================================================
# Gelen ve giden tüm HTTP isteklerini sırasıyla işleyen güvenlik ve yönetim katmanları
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # Canlıda CSS/JS dosyalarını yüksek performansla sunar
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',      # Cross-Origin İsteklerini İşler
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # Form ve İstek Sahteciliğine (CSRF) Karşı Kuma
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

# HTML Şablonlarının (Templates) Bulunduğu Klasör Yapılandırması
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'], # templates/ klasörünü hedef gösterir
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# =============================================================================
# VERİTABANI KONFİGÜRASYONU (DATABASE)
# =============================================================================
# SQLite3 hafif, dosya tabanlı veritabanı sürücüsü
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Özel Kullanıcı Modeli (AbstractUser genişletmesi)
# Varsayılan User modeli yerine appointments uygulamasındaki Barber modeli kullanılır
AUTH_USER_MODEL = 'appointments.Barber'

# CORS (Cross-Origin Resource Sharing) İzni
CORS_ALLOW_ALL_ORIGINS = True

# Dil ve Zaman Dilimi Ayarları
LANGUAGE_CODE = 'tr'
TIME_ZONE = 'Europe/Istanbul'
USE_I18N = True
USE_TZ = True

# =============================================================================
# STATİK VE MEDYA DOSYA AYARLARI (CSS, JS, YÜKLENEN RESİMLER)
# =============================================================================
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Müşteri veya Berberlerin yüklediği logo/resim dosyalarının tutulduğu dizin
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# JAZZMIN ADMİN TEMA AYARLARI
# =============================================================================
JAZZMIN_SETTINGS = {
    "site_title": "Berber Yönetimi",
    "site_header": "Berber Admin Paneli",
    "site_brand": "Berber App",
    "welcome_sign": "Yönetim Paneline Hoş Geldiniz",
    "search_model": "appointments.Barber",
    "show_ui_builder": False,
    "topmenu_links": [
        {"name": "Ana Sayfa", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "Müşteri Ekranı", "url": "/", "new_window": True},
    ],
}

JAZZMIN_UI_TWEAKS = {
    "theme": "default",
    "dark_mode_theme": "darkly",
}
