# 💈 Berber Randevu & Yönetim Sistemi (Barber Appointment App)

![Django](https://img.shields.io/badge/Django-4.2-092E20?style=for-the-badge&logo=django&logoColor=white)
![Django REST Framework](https://img.shields.io/badge/DRF-3.17-red?style=for-the-badge&logo=django&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

Berberler, kuaförler ve dükkan sahipleri için geliştirilmiş modern, hızlı ve Docker destekli çevrimiçi randevu yönetim sistemi.

---

## 🌟 Öne Çıkan Özellikler

- **🏢 Dükkan & Personel Yönetimi:** Dükkan sahipleri (Patron) ve çalışan berberler için özel yapı.
- **📅 Esnek Çalışma Saatleri & Molalar:** Berber bazlı haftalık çalışma şablonları, özel tatil günleri ve gün içi mola (break time) tanımlama.
- **⏰ Slot Bazlı Randevu Alımı:** 30 dakikalık veya 1 saatlik periyotlarla çakışmasız canlı randevu oluşturma.
- **🚫 Saat Engelleme (Blocked Slots):** Berberlerin istedikleri saat aralıklarını randevuya kapatabilmesi.
- **📱 Twilio SMS Entegrasyonu:** Müşteri ve berberlere otomatik randevu bilgilendirme SMS'leri.
- **🎨 Jazzmin Admin Paneli:** Özelleştirilmiş, modern ve kullanıcı dostu yönetim arayüzü.
- **🐳 Docker & Docker Compose Hazır:** Tek komutla tüm uygulamayı ayağa kaldırma imkanı.

---

## 🛠️ Teknolojiler

- **Backend:** Python 3.11, Django 4.2, Django REST Framework
- **Yönetim Paneli:** Django Jazzmin
- **Veritabanı:** SQLite / PostgreSQL (psycopg2 destekli)
- **Containerization:** Docker, Docker Compose
- **SMS Servisi:** Twilio API

---

## 🚀 Hızlı Başlangıç

### Yöntem 1: Docker ile Çalıştırma (Tavsiye Edilen)

Projede Docker varsayılan olarak yapılandırılmıştır.

```bash
# 1. Depoyu klonlayın
git clone https://github.com/melihkrhmet28/berber-randevu-app.git
cd berber-randevu-app

# 2. .env dosyasını oluşturun
cp .env.example .env  # veya kendi .env dosyanızı ekleyin

# 3. Docker konteynerini başlatın
docker compose up -d --build
```

Uygulamanız **`http://localhost:8000`** adresinde hazır olacaktır! 🎉

---

### Yöntem 2: Yerel Geliştirme Ortamı (Local Setup)

```bash
# 1. Sanal ortam oluşturun ve aktifleştirin
python -m venv .venv
source .venv/bin/activate  # Windows için: .venv\Scripts\activate

# 2. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 3. Veritabanı migrasyonlarını uygulayın
python manage.py migrate

# 4. Süper kullanıcı (Admin) oluşturun
python manage.py createsuperuser

# 5. Sunucuyu başlatın
python manage.py runserver
```

---

## ⚙️ Çevresel Değişkenler (.env)

Proje kök dizininde `.env` dosyası oluşturup aşağıdaki değerleri tanımlayabilirsiniz:

```env
SECRET_KEY=your_secret_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Twilio SMS Ayarları (Opsiyonel)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

---

## 📁 Proje Yapısı

```text
berber_app/
├── appointments/          # Randevu, Berber, Dükkan ve Takvim Modülleri
│   ├── models.py          # Veritabanı Modelleri
│   ├── views.py           # API ve Sayfa Görünümleri
│   ├── admin.py           # Jazzmin Admin Yapılandırması
│   └── urls.py            # Uygulama URL Yönlendirmeleri
├── core/                  # Django Ana Ayarlar ve Konfigürasyon
│   ├── settings.py
│   └── urls.py
├── static/                # CSS ve JavaScript Dosyaları
├── templates/             # HTML Şablonları
├── Dockerfile             # Docker İmaj Yapılandırması
├── docker-compose.yml     # Docker Compose Yapılandırması
├── requirements.txt       # Python Bağımlılıkları
└── manage.py
```

---

## 📝 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.