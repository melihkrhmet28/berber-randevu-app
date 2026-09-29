"""
=============================================================================
APPOINTMENTS URLS (API Haritası)
=============================================================================
Javascript (Frontend) tarafından yapılan tüm HTTP (fetch) isteklerinin hangi 
Python sınıfına (APIView) yöneleceğini belirleyen API rotalarıdır.
"""

from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    BarberDetailView, AvailableSlotsView, CreateAppointmentView, 
    DashboardAPIView, DashboardCalendarAPIView, WeeklyScheduleAPIView, 
    CancelAppointmentAPIView, BarberLogoUploadAPIView, ShopDetailAPIView,
    ShopEmployeesAPIView, ServiceListCreateAPIView, ServiceDetailAPIView,
    CustomerLookupAPIView, CustomerCancelAPIView
)

urlpatterns = [
    # 1. Kimlik Doğrulama (Giriş Yapıp Token Alma)
    path('auth/login/', obtain_auth_token, name='api_token_auth'),
    
    # 2. Berber Paneli Ana Verileri & Logo
    path('dashboard/', DashboardAPIView.as_view(), name='dashboard'),
    path('dashboard/logo/', BarberLogoUploadAPIView.as_view(), name='dashboard-logo'),
    
    # 3. Dükkan İçi Çalışan Yönetimi (Patron Özel)
    path('dashboard/employees/', ShopEmployeesAPIView.as_view(), name='dashboard-employees'),
    path('dashboard/employees/<int:pk>/', ShopEmployeesAPIView.as_view(), name='dashboard-employee-detail'),
    
    # 4. Hizmet ve Fiyatlandırma Yönetimi
    path('dashboard/services/', ServiceListCreateAPIView.as_view(), name='dashboard-services'),
    path('dashboard/services/<int:pk>/', ServiceDetailAPIView.as_view(), name='dashboard-service-detail'),
    
    # 5. Paneli Takvimi ve Haftalık Çalışma Şablonu
    path('dashboard/calendar/<str:date_str>/', DashboardCalendarAPIView.as_view(), name='dashboard-calendar'),
    path('dashboard/schedule/', WeeklyScheduleAPIView.as_view(), name='dashboard-schedule'),
    
    # 6. Randevu İşlemleri (Oluşturma, İptal, Müşteri Sorgulama)
    path('appointments/<int:pk>/cancel/', CancelAppointmentAPIView.as_view(), name='cancel-appointment'),
    path('appointments/create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('appointments/lookup/', CustomerLookupAPIView.as_view(), name='customer-lookup'),
    path('appointments/<int:pk>/customer-cancel/', CustomerCancelAPIView.as_view(), name='customer-cancel'),
    
    # 7. Müşteri Randevu Alma Ekranı Verileri
    path('shops/<slug:slug>/', ShopDetailAPIView.as_view(), name='shop-detail'),
    path('barbers/<int:id>/', BarberDetailView.as_view(), name='barber-detail'),
    path('barbers/<int:pk>/slots/<str:date_str>/', AvailableSlotsView.as_view(), name='available-slots'),
]
