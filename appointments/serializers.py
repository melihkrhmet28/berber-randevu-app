"""
=============================================================================
APPOINTMENTS SERIALIZERS (JSON Dönüştürücüler ve Doğrulayıcılar)
=============================================================================
Serializer'lar, Django veritabanı nesnelerini (Python Nesnesi) istemciye (Javascript/Browser) 
JSON formatında göndermek veya istemciden gelen JSON verilerini doğrulayıp 
veritabanına kaydetmek için kullanılır.
"""

from rest_framework import serializers
from .models import Barber, Shop, Schedule, BreakTime, Holiday, Appointment, Service


class ShopSerializer(serializers.ModelSerializer):
    """ Dükkan nesnesini JSON formatına çevirir """
    class Meta:
        model = Shop
        fields = ['id', 'name', 'slug', 'logo', 'owner']


class ServiceSerializer(serializers.ModelSerializer):
    """ Hizmet (Saç Kesimi, Sakal Tıraşı vb.) JSON dönüştürücüsü """
    class Meta:
        model = Service
        fields = ['id', 'barber', 'name', 'price', 'duration_minutes']
        read_only_fields = ['id', 'barber']


class BarberSerializer(serializers.ModelSerializer):
    """ Berber profillerini ve berberin sunduğu hizmet listesini JSON olarak döner """
    services = ServiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Barber
        fields = ['id', 'username', 'first_name', 'last_name', 'shop_name', 'slug', 'phone_number', 'logo', 'shop', 'services']


class AppointmentSerializer(serializers.ModelSerializer):
    """ Randevu alma ve görüntüleme JSON dönüştürücüsü """
    services_detail = ServiceSerializer(source='services', many=True, read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'barber', 'customer_name', 'customer_phone', 'date', 'start_time', 'end_time', 'services', 'services_detail', 'total_price', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
