from rest_framework import serializers
from .models import Barber, Shop, Schedule, BreakTime, Holiday, Appointment

class ShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = ['id', 'name', 'slug', 'logo', 'owner']

class BarberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barber
        fields = ['id', 'username', 'first_name', 'last_name', 'shop_name', 'slug', 'phone_number', 'logo', 'shop']

class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['id', 'barber', 'customer_name', 'customer_phone', 'date', 'start_time', 'end_time', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
