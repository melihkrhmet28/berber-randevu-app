# =============================================================================
# DOCKERFILE (Konteyner İmaj Tarifi)
# =============================================================================
# Uygulamanın hangi işletim sisteminde, hangi Python sürümünde ve hangi 
# bağımlılıklarla çalışacağını adım adım tarif eden imaj dosyasıdır.
# =============================================================================

# 1. Taban İmaj: Resmi Python 3.11 Linux imajı kullanılır
FROM python:3.11

# 2. Python Ortam Değişkenleri
# PYTHONDONTWRITEBYTECODE 1 -> .pyc derleme dosyalarının oluşturulmasını engeller
ENV PYTHONDONTWRITEBYTECODE 1
# PYTHONUNBUFFERED 1 -> Konsol çıktılarını anında ekrana basar (Loglama için önemlidir)
ENV PYTHONUNBUFFERED 1

# 3. Konteyner İçindeki Çalışma Dizinini Belirle (/app)
WORKDIR /app

# 4. Gerekli Sistem Bağımlılıklarını Kur (C++ Derleyici ve Veritabanı Başlık Dosyaları)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 5. Proje Bağımlılıklarını Kopyala ve Kur (requirements.txt)
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# 6. Projenin Tüm Kodlarını Konteyner İçine Kopyala
COPY . /app/

# 7. Başlangıç Betiğine Çalıştırma İzni Ver
RUN chmod +x /app/entrypoint.sh

# 8. Konteynerin 8000 Portunu Dış Dünyaya Açar
EXPOSE 8000

# 9. Konteyner Başladığında Çalıştırılacak Komut
ENTRYPOINT ["/app/entrypoint.sh"]
