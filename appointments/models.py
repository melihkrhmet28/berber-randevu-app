"""
=============================================================================
APPOINTMENTS MODELS (Veritabanı Tablo Tanımları)
=============================================================================
Bu dosya projenin veritabanı şemasını tanımlar. Django ORM (Object-Relational Mapping) 
sayesinde Python sınıfları SQL tablolarına dönüştürülür.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.text import slugify
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime


class Shop(models.Model):
    """
    DÜKKAN / İŞLETME MODELİ
    Dükkan adı, URL takısı (slug), logosu ve dükkan sahibini (owner) tutar.
    """
    name = models.CharField(max_length=100, verbose_name="Dükkan Adı")
    slug = models.SlugField(unique=True, blank=True, max_length=100, verbose_name="URL Bağlantısı")
    logo = models.ImageField(upload_to='shop_logos/', null=True, blank=True, verbose_name="Dükkan Logosu")
    owner = models.OneToOneField('appointments.Barber', on_delete=models.CASCADE, related_name='owned_shop', verbose_name='Patron (Dükkan Sahibi)')
    
    class Meta:
        verbose_name = 'Dükkan'
        verbose_name_plural = 'Dükkanlar'

    def save(self, *args, **kwargs):
        # Dükkan kaydedilirken adı "Kral Berber" ise otomatik "kral-berber" şeklinde slug üretir
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Barber(AbstractUser):
    """
    BERBER / PERSONEL MODELİ (Özel Kullanıcı Modeli)
    Django'nun standart AbstractUser sınıfından türetilmiştir. Hem giriş yapan berber 
    hesabını hem de profil bilgilerini temsil eder.
    """
    phone_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="Telefon Numarası")
    shop_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="İşletme / Salon Adı")
    slug = models.SlugField(unique=True, blank=True, max_length=100, verbose_name="Kullanıcı Bağlantısı")
    logo = models.ImageField(upload_to='barber_logos/', null=True, blank=True, verbose_name="Profil / Logo Görseli")
    shop = models.ForeignKey(Shop, on_delete=models.SET_NULL, null=True, blank=True, related_name='barbers', verbose_name="Ait Olduğu Dükkan")
    
    SLOT_CHOICES = (
        (30, '30 Dakika'),
        (60, '1 Saat'),
    )
    slot_duration_minutes = models.IntegerField(choices=SLOT_CHOICES, default=60, verbose_name='Randevu Periyodu (Dakika)')

    class Meta:
        verbose_name = 'Berber / Personel'
        verbose_name_plural = 'Berberler / Personeller'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.username)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.shop_name or self.username


class Schedule(models.Model):
    """
    HAFTALIK ÇALIŞMA ŞABLONU MODELİ
    Haftanın her bir günü (0=Pazartesi, ..., 6=Pazar) için berberin mesai başlangıç 
    ve bitiş saatlerini tutar.
    """
    DAYS_OF_WEEK = (
        (0, 'Pazartesi'),
        (1, 'Salı'),
        (2, 'Çarşamba'),
        (3, 'Perşembe'),
        (4, 'Cuma'),
        (5, 'Cumartesi'),
        (6, 'Pazar'),
    )
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='schedules', verbose_name="Berber")
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK, verbose_name="Haftanın Günü")
    start_time = models.TimeField(null=True, blank=True, verbose_name="Mesai Başlangıcı")
    end_time = models.TimeField(null=True, blank=True, verbose_name="Mesai Bitişi")
    is_off_day = models.BooleanField(default=False, verbose_name='Kapalı / İzin Günü mü?')

    class Meta:
        unique_together = ('barber', 'day_of_week') # Bir berberin bir gün için tek bir mesai şablonu olabilir
        verbose_name = 'Haftalık Şablon (Çalışma Saati)'
        verbose_name_plural = 'Haftalık Şablonlar'

    def __str__(self):
        return f"{self.barber.username} - {self.get_day_of_week_display()}"


class BreakTime(models.Model):
    """
    MOLA SAATLERİ MODELİ
    Mesai içinde öğle yemeği veya dinlenme saatlerini tanımlar.
    """
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='breaks')
    start_time = models.TimeField(verbose_name="Mola Başlangıcı")
    end_time = models.TimeField(verbose_name="Mola Bitişi")

    def __str__(self):
        return f"{self.schedule} Mola: {self.start_time} - {self.end_time}"


class Holiday(models.Model):
    """
    ÖZEL TATİL GÜNLERİ MODELİ
    Berberin izinli veya dükkanın kapalı olduğu spesifik takvim tarihleridir.
    """
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='holidays')
    date = models.DateField(verbose_name="Tatil Tarihi")

    def __str__(self):
        return f"{self.barber.username} - Tatil: {self.date}"


class Service(models.Model):
    """
    HİZMET KATEGORİSİ VE FİYATLANDIRMA MODELİ
    Örn: Saç Kesimi (300 TL, 30 dk), Sakal Tıraşı (150 TL, 15 dk).
    """
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='services', verbose_name='Berber')
    name = models.CharField(max_length=100, verbose_name='Hizmet Adı')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Fiyat (TL)')
    duration_minutes = models.IntegerField(default=30, verbose_name='Tahmini Süre (Dakika)')

    class Meta:
        verbose_name = 'Hizmet'
        verbose_name_plural = 'Hizmetler'

    def __str__(self):
        return f"{self.name} - {self.price} TL"


class Appointment(models.Model):
    """
    RANDEVU MODELİ
    Müşterilerin aldığı randevuları tutar. Berber, Müşteri Bilgileri, Seçilen Hizmetler 
    ve Toplam Fiyat kaydını barındırır.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Bekliyor'),
        ('CONFIRMED', 'Onaylandı'),
        ('CANCELLED', 'İptal Edildi'),
    )
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='appointments', verbose_name="Berber")
    customer_name = models.CharField(max_length=100, verbose_name="Müşteri Adı")
    customer_phone = models.CharField(max_length=20, verbose_name="Müşteri Telefonu")
    date = models.DateField(verbose_name="Randevu Tarihi")
    start_time = models.TimeField(verbose_name="Başlangıç Saati")
    end_time = models.TimeField(verbose_name="Bitiş Saati")
    services = models.ManyToManyField(Service, blank=True, related_name='appointments', verbose_name='Seçilen Hizmetler')
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='Toplam Tutar (TL)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED', verbose_name='Durum')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Oluşturulma Tarihi')

    class Meta:
        verbose_name = 'Randevu'
        verbose_name_plural = 'Randevular'

    def __str__(self):
        return f"{self.customer_name} - {self.date} {self.start_time}"


class BlockedSlot(models.Model):
    """
    KAPALI / ENGELLENMİŞ SAAT MODELİ
    Berberin paneli üzerinden fareyle sürükleyerek veya tıklayarak kapattığı spesifik saat dilimleridir.
    """
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='blocked_slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        unique_together = ('barber', 'date', 'start_time', 'end_time')

    def __str__(self):
        return f"{self.barber.username} kapalı: {self.date} {self.start_time}-{self.end_time}"


# =============================================================================
# OTO-SİNYAL (SIGNALS): YENİ BERBER OLUŞTURULDUĞUNDA VARSAYILAN ŞABLON OLUŞTURMA
# =============================================================================
@receiver(post_save, sender=Barber)
def create_default_schedule(sender, instance, created, **kwargs):
    """
    Yeni bir Berber hesabı açıldığında haftanın 7 günü için varsayılan 09:00-23:00 mesai şablonunu otomatik kurar.
    Pazar günleri varsayılan izin günü yapılır.
    """
    if created:
        for i in range(7):
            is_off = (i == 6) # Pazar günü izin
            start = datetime.time(9, 0) if not is_off else None
            end = datetime.time(23, 0) if not is_off else None
            Schedule.objects.create(
                barber=instance,
                day_of_week=i,
                start_time=start,
                end_time=end,
                is_off_day=is_off
            )
