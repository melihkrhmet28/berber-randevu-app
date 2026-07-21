FROM python:3.11

# Ortam değişkenlerini ayarla
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Çalışma dizinini ayarla
WORKDIR /app

# Gerekli sistem paketlerini kur (psycopg2 ve Pillow için gerekebilir)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Gereksinimleri kopyala ve kur
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Proje dosyalarını kopyala
COPY . /app/

# Portu dışa aç
EXPOSE 8000

# Uygulamayı başlat
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
