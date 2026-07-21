from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.text import slugify

class Shop(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True, max_length=100)
    logo = models.ImageField(upload_to='shop_logos/', null=True, blank=True)
    owner = models.OneToOneField('appointments.Barber', on_delete=models.CASCADE, related_name='owned_shop', verbose_name='Patron (Dükkan Sahibi)')
    
    class Meta:
        verbose_name = 'Dükkan'
        verbose_name_plural = 'Dükkanlar'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Barber(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    shop_name = models.CharField(max_length=100, blank=True, null=True)
    slug = models.SlugField(unique=True, blank=True, max_length=100)
    logo = models.ImageField(upload_to='barber_logos/', null=True, blank=True)
    shop = models.ForeignKey(Shop, on_delete=models.SET_NULL, null=True, blank=True, related_name='barbers')
    
    SLOT_CHOICES = (
        (30, '30 Dakika'),
        (60, '1 Saat'),
    )
    slot_duration_minutes = models.IntegerField(choices=SLOT_CHOICES, default=60, verbose_name='Randevu Periyodu')

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
    DAYS_OF_WEEK = (
        (0, 'Pazartesi'),
        (1, 'Salı'),
        (2, 'Çarşamba'),
        (3, 'Perşembe'),
        (4, 'Cuma'),
        (5, 'Cumartesi'),
        (6, 'Pazar'),
    )
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='schedules')
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_off_day = models.BooleanField(default=False, verbose_name='Kapalı Gün')

    class Meta:
        unique_together = ('barber', 'day_of_week')
        verbose_name = 'Haftalık Şablon (Çalışma Saati)'
        verbose_name_plural = 'Haftalık Şablonlar'

    def __str__(self):
        return f"{self.barber.username} - {self.get_day_of_week_display()}"


class BreakTime(models.Model):
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='breaks')
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.schedule} Mola: {self.start_time} - {self.end_time}"


class Holiday(models.Model):
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='holidays')
    date = models.DateField()

    def __str__(self):
        return f"{self.barber.username} - Tatil: {self.date}"


class Appointment(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Bekliyor'),
        ('CONFIRMED', 'Onaylandı'),
        ('CANCELLED', 'İptal Edildi'),
    )
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='appointments')
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=20)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMED', verbose_name='Durum')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Oluşturulma Tarihi')

    class Meta:
        verbose_name = 'Randevu'
        verbose_name_plural = 'Randevular'

    def __str__(self):
        return f"{self.customer_name} - {self.date} {self.start_time}"

from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime

@receiver(post_save, sender=Barber)
def create_default_schedule(sender, instance, created, **kwargs):
    if created:
        for i in range(7):
            is_off = (i == 6) # Pazar günü (0=Pazartesi, ..., 6=Pazar)
            start = datetime.time(9, 0) if not is_off else None
            end = datetime.time(23, 0) if not is_off else None
            Schedule.objects.create(
                barber=instance,
                day_of_week=i,
                start_time=start,
                end_time=end,
                is_off_day=is_off
            )

class BlockedSlot(models.Model):
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='blocked_slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        unique_together = ('barber', 'date', 'start_time', 'end_time')

    def __str__(self):
        return f"{self.barber.username} kapalı: {self.date} {self.start_time}-{self.end_time}"

