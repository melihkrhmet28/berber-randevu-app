from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from .views import (
    BarberDetailView, AvailableSlotsView, CreateAppointmentView, 
    DashboardAPIView, DashboardCalendarAPIView, WeeklyScheduleAPIView, 
    CancelAppointmentAPIView, BarberLogoUploadAPIView, ShopDetailAPIView,
    ShopEmployeesAPIView
)

urlpatterns = [
    path('auth/login/', obtain_auth_token, name='api_token_auth'),
    path('dashboard/', DashboardAPIView.as_view(), name='dashboard'),
    path('dashboard/logo/', BarberLogoUploadAPIView.as_view(), name='dashboard-logo'),
    path('dashboard/employees/', ShopEmployeesAPIView.as_view(), name='dashboard-employees'),
    path('dashboard/calendar/<str:date_str>/', DashboardCalendarAPIView.as_view(), name='dashboard-calendar'),
    path('dashboard/schedule/', WeeklyScheduleAPIView.as_view(), name='dashboard-schedule'),
    path('appointments/<int:pk>/cancel/', CancelAppointmentAPIView.as_view(), name='cancel-appointment'),
    path('appointments/create/', CreateAppointmentView.as_view(), name='create-appointment'),
    
    path('shops/<slug:slug>/', ShopDetailAPIView.as_view(), name='shop-detail'),
    path('barbers/<int:id>/', BarberDetailView.as_view(), name='barber-detail'),
    path('barbers/<int:pk>/slots/<str:date_str>/', AvailableSlotsView.as_view(), name='available-slots'),
]
