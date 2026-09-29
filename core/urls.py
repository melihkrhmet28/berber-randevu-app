"""
=============================================================================
CORE URL CONF (Ana Yönlendirme Haritası)
=============================================================================
Bu dosya gelen tüm HTTP isteklerinin (URL) hangi görünüme (View) veya hangi 
alt URL dosyasına yönlendirileceğini belirler.
"""

from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # 1. Django Admin Paneli Yönlendirmesi
    path('admin/', admin.site.urls),
    
    # 2. REST API Yönlendirmesi (/api/ ile başlayan tüm istekler appointments/urls.py dosyasına aktarılır)
    path('api/', include('appointments.urls')),
    
    # 3. Tek Sayfa Uygulama (SPA - Single Page Application) Yönlendirmeleri:
    # Sayfa yenilense dahi index.html şablonu yüklenir, Javascript (app.js) URL'yi okuyup doğru ekranı çizer.
    path('', TemplateView.as_view(template_name='index.html')),
    path('login/', TemplateView.as_view(template_name='index.html')),
    path('dashboard/', TemplateView.as_view(template_name='index.html')),
    path('lookup/', TemplateView.as_view(template_name='index.html')),
    
    # Dükkan ve Berber özel bağlantıları (Örn: /kral-berber) -> index.html'e yönlenir
    path('<path:slug>/', TemplateView.as_view(template_name='index.html')),
]

# Geliştirme modunda (DEBUG=True) yüklenen medya resimlerini (logolar vb.) doğrudan sunmak için:
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
