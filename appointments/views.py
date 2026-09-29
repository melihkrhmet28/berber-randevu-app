"""
=============================================================================
APPOINTMENTS VIEWS (İş Mantığı ve API Uç Noktaları)
=============================================================================
Bu dosya uygulamanın kalbidir. Müşterilerin müsait saat hesaplamalarını, 
randevu oluşturma işlemlerini, SMS bildirimlerini, berber yönetim paneli 
istatistiklerini, hizmet yönetimini ve dükkan içi çalışan işlemlerini yürütür.
"""

import datetime
import os
import re
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import Shop, Barber, Schedule, Holiday, Appointment, BreakTime, BlockedSlot, Service
from .serializers import ShopSerializer, BarberSerializer, AppointmentSerializer, ServiceSerializer
from twilio.rest import Client


# =============================================================================
# HELPER: SMS BİLDİRİM GÖNDERİCİ (Twilio Entegrasyonu)
# =============================================================================
def send_sms_notification(to_phone, message):
    """ Twilio SMS servisi üzerinden randevu bilgi mesajı gönderir """
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    from_phone = os.getenv('TWILIO_PHONE_NUMBER')
    
    if account_sid and auth_token and from_phone:
        try:
            client = Client(account_sid, auth_token)
            client.messages.create(
                body=message,
                from_=from_phone,
                to=to_phone
            )
        except Exception as e:
            print(f"Twilio SMS Hatanız: {e}")
    else:
        print(f"SMS GÖNDERİLEMEDİ (Twilio ayarları eksik): {to_phone} -> {message}")


def clean_phone(phone_str):
    """ Telefon numarasından sadece rakamları ayıklar """
    if not phone_str:
        return ''
    return re.sub(r'\D', '', phone_str)


# =============================================================================
# HELPER: GECE SAATLERİ ZAMAN DÖNÜŞTÜRÜCÜSÜ (00:00 ve Gece Yarısı Desteği)
# =============================================================================
def to_datetime(target_date, time_obj, is_end=False):
    """
    Saat objesini datetime objesine dönüştürür. 
    Eğer bitiş saati 00:00 ise bunu ertesi günün ilk saniyesi olarak hesaplar.
    """
    if not time_obj:
        return None
    if is_end and (time_obj == datetime.time(0, 0) or time_obj == datetime.time(23, 59, 59) or time_obj == datetime.time(23, 59)):
        return datetime.datetime.combine(target_date + datetime.timedelta(days=1), datetime.time(0, 0))
    return datetime.datetime.combine(target_date, time_obj)


# =============================================================================
# 1. DÜKKAN VE BERBER DETAY API GÖRÜNÜMLERİ
# =============================================================================
class ShopDetailAPIView(APIView):
    """ Dükkan detaylarını ve dükkana bağlı berber listesini döner """
    def get(self, request, slug):
        shop = get_object_or_404(Shop, slug=slug)
        barbers = list(shop.barbers.all())
        if shop.owner and shop.owner not in barbers:
            barbers.insert(0, shop.owner) # Dükkan sahibini (Patron) listenin en başına koyar
            
        return Response({
            'shop': ShopSerializer(shop).data,
            'barbers': BarberSerializer(barbers, many=True).data
        })


class BarberDetailView(generics.RetrieveAPIView):
    """ Tekil bir berberin profil ve hizmet detaylarını döner """
    queryset = Barber.objects.all()
    serializer_class = BarberSerializer
    lookup_field = 'id'


# =============================================================================
# 2. MÜSAİT SAAT HESAPLAMA ALGORİTMASI (AvailableSlotsView)
# =============================================================================
class AvailableSlotsView(APIView):
    """
    Müşterinin seçtiği tarihte berberin boşta olan saat dilimlerini hesaplar.
    Hesaplamada: Çalışma saatleri, Molalar, Mevcut Randevular, Özel Tatiller,
    Berberin Kapattığı Saatler ve Geçmiş Saat Filtresi hesaba katılır.
    """
    def get(self, request, pk, date_str):
        barber = get_object_or_404(Barber, pk=pk)
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Geçersiz tarih formatı. YYYY-MM-DD olmalı.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        # Geçmiş gün kontrolü
        if target_date < today:
            return Response({'slots': []})

        # Berber o gün tatildeyse saat listesi boş döner
        if Holiday.objects.filter(barber=barber, date=target_date).exists():
            return Response({'slots': []})

        day_of_week = target_date.weekday()
        schedule = Schedule.objects.filter(barber=barber, day_of_week=day_of_week).first()
        
        if not schedule or schedule.is_off_day or not schedule.start_time or not schedule.end_time:
            return Response({'slots': []})

        appointments = Appointment.objects.filter(barber=barber, date=target_date, status__in=['PENDING', 'CONFIRMED'])
        breaks = BreakTime.objects.filter(schedule=schedule)
        blocked = BlockedSlot.objects.filter(barber=barber, date=target_date)

        start_dt = to_datetime(target_date, schedule.start_time)
        end_dt = to_datetime(target_date, schedule.end_time, is_end=True)
        if end_dt <= start_dt:
            end_dt += datetime.timedelta(days=1)

        slot_duration = datetime.timedelta(minutes=barber.slot_duration_minutes)

        slots = []
        current_time = start_dt
        now_dt = timezone.localtime().replace(tzinfo=None) if timezone.is_aware(timezone.localtime()) else datetime.datetime.now()

        # Mesai başlangıcından bitişine kadar belirtilen periyotlarla (30dk/1saat) döngü kurar
        while current_time + slot_duration <= end_dt:
            slot_start_dt = current_time
            slot_end_dt = current_time + slot_duration

            # Eğer seçilen gün bugün ise geçmiş saatleri filtrele
            if target_date == today and slot_start_dt <= now_dt:
                current_time += slot_duration
                continue

            # Mola çakışması kontrolü
            is_break = False
            for b in breaks:
                b_start = to_datetime(target_date, b.start_time)
                b_end = to_datetime(target_date, b.end_time, is_end=True)
                if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                    is_break = True
                    break
            
            # Kapalı / Engellenmiş saat kontrolü
            is_blocked = False
            for blk in blocked:
                blk_start = to_datetime(target_date, blk.start_time)
                blk_end = to_datetime(target_date, blk.end_time, is_end=True)
                if not (slot_end_dt <= blk_start or slot_start_dt >= blk_end):
                    is_blocked = True
                    break

            # Dolu randevu çakışması kontrolü
            is_booked = False
            for appt in appointments:
                appt_start = to_datetime(target_date, appt.start_time)
                appt_end = to_datetime(target_date, appt.end_time, is_end=True)
                if not (slot_end_dt <= appt_start or slot_start_dt >= appt_end):
                    is_booked = True
                    break

            # Saat hiçbir yere takılmıyorsa müşteriye seçilebilir olarak verilir
            if not is_break and not is_blocked and not is_booked:
                slots.append({
                    'start_time': slot_start_dt.strftime('%H:%M'),
                    'end_time': slot_end_dt.strftime('%H:%M')
                })

            current_time += slot_duration

        return Response({'slots': slots})


# =============================================================================
# 3. RANDEVU OLUŞTURMA (CreateAppointmentView)
# =============================================================================
class CreateAppointmentView(generics.CreateAPIView):
    """ 
    Müşteriden gelen yeni randevuyu doğrular, çifte rezervasyon (double booking) 
    çakışmalarını engeller, veritabanına kaydeder ve SMS bildirimi gönderir.
    """
    serializer_class = AppointmentSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        barber = serializer.validated_data['barber']
        target_date = serializer.validated_data['date']
        start_time = serializer.validated_data['start_time']
        end_time = serializer.validated_data['end_time']
        
        today = timezone.localdate()
        now_dt = timezone.localtime().replace(tzinfo=None) if timezone.is_aware(timezone.localtime()) else datetime.datetime.now()
        appt_start_dt = datetime.datetime.combine(target_date, start_time)
        appt_end_dt = to_datetime(target_date, end_time, is_end=True)

        # 1. Geçmiş tarih / saat kontrolü
        if target_date < today or (target_date == today and appt_start_dt <= now_dt):
            return Response({'error': 'Geçmiş bir tarih veya saate randevu oluşturulamaz.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Tatil kontrolü
        if Holiday.objects.filter(barber=barber, date=target_date).exists():
            return Response({'error': 'Berber seçilen tarihte izinli veya tatildedir.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Haftalık mesai ve izin günü kontrolü
        schedule = Schedule.objects.filter(barber=barber, day_of_week=target_date.weekday()).first()
        if not schedule or schedule.is_off_day or not schedule.start_time or not schedule.end_time:
            return Response({'error': 'Berber seçilen tarihte çalışmamaktadır.'}, status=status.HTTP_400_BAD_REQUEST)

        sched_start_dt = to_datetime(target_date, schedule.start_time)
        sched_end_dt = to_datetime(target_date, schedule.end_time, is_end=True)
        if appt_start_dt < sched_start_dt or appt_end_dt > sched_end_dt:
            return Response({'error': 'Randevu saati berberin mesai saatleri dışındadır.'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Mola çakışması kontrolü
        for b in BreakTime.objects.filter(schedule=schedule):
            b_start = to_datetime(target_date, b.start_time)
            b_end = to_datetime(target_date, b.end_time, is_end=True)
            if not (appt_end_dt <= b_start or appt_start_dt >= b_end):
                return Response({'error': 'Seçilen saat berberin mola saatine denk gelmektedir.'}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Berberin kapattığı saat kontrolü
        for blk in BlockedSlot.objects.filter(barber=barber, date=target_date):
            blk_start = to_datetime(target_date, blk.start_time)
            blk_end = to_datetime(target_date, blk.end_time, is_end=True)
            if not (appt_end_dt <= blk_start or appt_start_dt >= blk_end):
                return Response({'error': 'Bu saat dilimi berber tarafından randevuya kapatılmıştır.'}, status=status.HTTP_400_BAD_REQUEST)

        # 6. Çifte Randevu (Race condition & double booking) Çakışma Kontrolü
        conflict_appts = Appointment.objects.select_for_update().filter(
            barber=barber,
            date=target_date,
            status__in=['PENDING', 'CONFIRMED']
        )
        for appt in conflict_appts:
            existing_start = to_datetime(target_date, appt.start_time)
            existing_end = to_datetime(target_date, appt.end_time, is_end=True)
            if not (appt_end_dt <= existing_start or appt_start_dt >= existing_end):
                return Response({'error': 'Seçtiğiniz saat dilimi az önce başka bir müşteri tarafından rezerve edildi. Lütfen başka bir saat seçin.'}, status=status.HTTP_400_BAD_REQUEST)

        # Randevuyu kaydet
        appointment = serializer.save()

        # Hizmetleri bağla ve toplam tutarı güncelle
        service_ids = request.data.get('services', [])
        if service_ids:
            services = Service.objects.filter(id__in=service_ids, barber=appointment.barber)
            appointment.services.set(services)
            total = sum(s.price for s in services)
            appointment.total_price = total
            appointment.save()

        # Müşteriye Bilgilendirme SMS'i
        customer_msg = f"Merhaba {appointment.customer_name}, {barber.shop_name or barber.username} için {appointment.date.strftime('%d.%m.%Y')} saat {appointment.start_time.strftime('%H:%M')} randevunuz onaylanmıştır."
        send_sms_notification(appointment.customer_phone, customer_msg)
        
        # Berbere Yeni Randevu SMS'i
        if barber.phone_number:
            barber_msg = f"Yeni Randevu! Müşteri: {appointment.customer_name} ({appointment.customer_phone}) Tarih: {appointment.date.strftime('%d.%m.%Y')} {appointment.start_time.strftime('%H:%M')}"
            send_sms_notification(barber.phone_number, barber_msg)

        headers = self.get_success_headers(serializer.data)
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED, headers=headers)


# =============================================================================
# 4. BERBER YÖNETİM PANELİ API (DashboardAPIView & Analytics)
# =============================================================================
class DashboardAPIView(APIView):
    """
    Giriş yapmış berberin yönetim paneli verilerini döner. 
    İçeriğinde: Berber Bilgisi, Randevular ve Canlı İstatistikler (Bugünkü/Haftalık Kazanç) yer alır.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barber = request.user
        data = {
            'barber': BarberSerializer(barber).data,
            'is_owner': False
        }
        if hasattr(barber, 'owned_shop'):
            data['is_owner'] = True
            data['shop'] = ShopSerializer(barber.owned_shop).data
        elif barber.shop:
            data['shop'] = ShopSerializer(barber.shop).data
        
        appointments = Appointment.objects.filter(barber=barber).order_by('-date', '-start_time')
        data['appointments'] = AppointmentSerializer(appointments, many=True).data

        # İstatistik İpuçları Hesaplama
        today = datetime.date.today()
        today_appts = Appointment.objects.filter(barber=barber, date=today, status='CONFIRMED')
        today_count = today_appts.count()
        today_revenue = sum(a.total_price for a in today_appts)

        week_start = today - datetime.timedelta(days=today.weekday())
        week_appts = Appointment.objects.filter(barber=barber, date__gte=week_start, status='CONFIRMED')
        week_revenue = sum(a.total_price for a in week_appts)
        total_appts_count = Appointment.objects.filter(barber=barber).count()

        data['analytics'] = {
            'today_count': today_count,
            'today_revenue': str(today_revenue),
            'week_revenue': str(week_revenue),
            'total_appts_count': total_appts_count
        }

        return Response(data)


class DashboardCalendarAPIView(APIView):
    """
    Berber paneli takvimindeki saatleri yönetir.
    Berberin paneli üzerinden tıklayarak veya sürükleyerek saat kapatmasını / açmasını sağlar.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, date_str):
        barber = request.user
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Geçersiz tarih.'}, status=400)

        day_of_week = target_date.weekday()
        schedule = Schedule.objects.filter(barber=barber, day_of_week=day_of_week).first()

        if not schedule or schedule.is_off_day or not schedule.start_time or not schedule.end_time:
            return Response({'slots': [], 'message': 'İzin günü'})

        start_dt = to_datetime(target_date, schedule.start_time)
        end_dt = to_datetime(target_date, schedule.end_time, is_end=True)

        slot_duration = datetime.timedelta(minutes=barber.slot_duration_minutes)
        appointments = Appointment.objects.filter(barber=barber, date=target_date, status__in=['PENDING', 'CONFIRMED'])
        blocked = BlockedSlot.objects.filter(barber=barber, date=target_date)
        breaks = BreakTime.objects.filter(schedule=schedule)

        slots = []
        current_time = start_dt

        while current_time + slot_duration <= end_dt:
            slot_start_dt = current_time
            slot_end_dt = current_time + slot_duration
            
            # Durum belirleme
            state = 'available'

            # 1. Mola mı?
            for b in breaks:
                b_start = to_datetime(target_date, b.start_time)
                b_end = to_datetime(target_date, b.end_time, is_end=True)
                if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                    state = 'blocked'
                    break

            # 2. Berber eliyle kapattı mı?
            for blk in blocked:
                blk_start = to_datetime(target_date, blk.start_time)
                blk_end = to_datetime(target_date, blk.end_time, is_end=True)
                if not (slot_end_dt <= blk_start or slot_start_dt >= blk_end):
                    state = 'blocked'
                    break

            # 3. Dolu randevu var mı?
            for appt in appointments:
                appt_start = to_datetime(target_date, appt.start_time)
                appt_end = to_datetime(target_date, appt.end_time, is_end=True)
                if not (slot_end_dt <= appt_start or slot_start_dt >= appt_end):
                    state = 'booked'
                    break

            slots.append({
                'start_time': slot_start_dt.strftime('%H:%M'),
                'end_time': slot_end_dt.strftime('%H:%M'),
                'state': state
            })

            current_time += slot_duration

        # Seçilen günün randevu detay listesini döner
        daily_appts = []
        for appt in appointments:
            daily_appts.append({
                'id': appt.id,
                'name': appt.customer_name,
                'phone': appt.customer_phone,
                'start_time': appt.start_time.strftime('%H:%M'),
                'end_time': appt.end_time.strftime('%H:%M'),
                'status': appt.status
            })

        return Response({'slots': slots, 'appointments': daily_appts})

    def post(self, request, date_str):
        """ Toplu olarak saatleri kapatma / açma (Drag & Drop güncellemesi) """
        barber = request.user
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Geçersiz tarih.'}, status=400)

        updates = request.data.get('updates', [])
        for item in updates:
            start_str = item.get('start_time')
            end_str = item.get('end_time')
            action = item.get('action') # 'block' veya 'unblock'

            start_t = datetime.datetime.strptime(start_str, '%H:%M').time()
            end_t = datetime.datetime.strptime(end_str, '%H:%M').time()

            if action == 'block':
                BlockedSlot.objects.get_or_create(
                    barber=barber,
                    date=target_date,
                    start_time=start_t,
                    end_time=end_t
                )
            elif action == 'unblock':
                BlockedSlot.objects.filter(
                    barber=barber,
                    date=target_date,
                    start_time=start_t,
                    end_time=end_t
                ).delete()

        return Response({'status': 'success'})


# =============================================================================
# 5. HAFTALIK MESAİ VE MOLA ŞABLONU YÖNETİMİ
# =============================================================================
class WeeklyScheduleAPIView(APIView):
    """ Berberin haftalık çalışma günlerini ve periyodunu düzenlemesini sağlar """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barber = request.user
        schedules = Schedule.objects.filter(barber=barber).order_by('day_of_week')
        data = []
        for s in schedules:
            data.append({
                'day_of_week': s.day_of_week,
                'start_time': s.start_time.strftime('%H:%M') if s.start_time else '',
                'end_time': s.end_time.strftime('%H:%M') if s.end_time else '',
                'is_off_day': s.is_off_day
            })
        return Response({'schedules': data, 'slot_duration': barber.slot_duration_minutes})

    def post(self, request):
        barber = request.user
        schedules_data = request.data.get('schedules', [])
        slot_duration = request.data.get('slot_duration')

        if slot_duration in [30, 60]:
            barber.slot_duration_minutes = slot_duration
            barber.save()

        for data in schedules_data:
            day = data.get('day_of_week')
            start_time_str = data.get('start_time')
            end_time_str = data.get('end_time')
            is_off_day = data.get('is_off_day', False)

            sched = Schedule.objects.filter(barber=barber, day_of_week=day).first()
            if sched:
                sched.is_off_day = is_off_day
                if start_time_str and not is_off_day:
                    sched.start_time = datetime.datetime.strptime(start_time_str, '%H:%M').time()
                if end_time_str and not is_off_day:
                    sched.end_time = datetime.datetime.strptime(end_time_str, '%H:%M').time()
                sched.save()

        return Response({'status': 'success'})


# =============================================================================
# 6. RANDEVU İPTALİ VE LOGO YÜKLEME
# =============================================================================
class CancelAppointmentAPIView(APIView):
    """ Berberin kendi panelinden bir randevuyu iptal etmesi """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        appointment = get_object_or_404(Appointment, pk=pk, barber=request.user)
        appointment.status = 'CANCELLED'
        appointment.save()
        return Response({'status': 'success'})


class BarberLogoUploadAPIView(APIView):
    """ Berber veya Dükkan logosu yükleme uç noktası """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        barber = request.user
        if 'logo' in request.FILES:
            barber.logo = request.FILES['logo']
            barber.save()
            return Response({'status': 'success', 'logo_url': barber.logo.url})
        return Response({'status': 'error', 'message': 'Dosya bulunamadı.'}, status=400)


# =============================================================================
# 7. ÇALIŞAN HESABI YÖNETİMİ (DÜKKAN SAHİBİ / PATRON ÖZEL)
# =============================================================================
class ShopEmployeesAPIView(APIView):
    """ Dükkan Sahibinin (Patron) çalışan eklemesi, düzenlemesi ve silmesini sağlar """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Bu işlem sadece dükkan sahibine özeldir.'}, status=403)
        barbers = request.user.owned_shop.barbers.all()
        return Response({'employees': BarberSerializer(barbers, many=True).data})

    def post(self, request):
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Bu işlem sadece dükkan sahibine özeldir.'}, status=403)
        
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        phone_number = request.data.get('phone_number', '')
        
        if Barber.objects.filter(username=username).exists():
            return Response({'error': 'Bu kullanıcı adı zaten alınmış.'}, status=400)
            
        new_barber = Barber.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            shop=request.user.owned_shop
        )
        return Response({'status': 'success', 'employee': BarberSerializer(new_barber).data})

    def put(self, request, pk):
        """ Çalışan hesabı düzenleme """
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Bu işlem sadece dükkan sahibine özeldir.'}, status=403)
        
        employee = get_object_or_404(Barber, pk=pk, shop=request.user.owned_shop)
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        phone_number = request.data.get('phone_number')
        password = request.data.get('password')

        if first_name is not None:
            employee.first_name = first_name
        if last_name is not None:
            employee.last_name = last_name
        if phone_number is not None:
            employee.phone_number = phone_number
        if password:
            employee.set_password(password)

        employee.save()
        return Response({'status': 'success', 'employee': BarberSerializer(employee).data})

    def delete(self, request, pk):
        """ Çalışan hesabı silme """
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Bu işlem sadece dükkan sahibine özeldir.'}, status=403)
        
        employee = get_object_or_404(Barber, pk=pk, shop=request.user.owned_shop)
        if employee == request.user:
            return Response({'error': 'Kendi patron hesabınızı bu ekrandan silemezsiniz.'}, status=400)
            
        employee.delete()
        return Response({'status': 'success'})


# =============================================================================
# 8. HİZMET VE FİYATLANDIRMA YÖNETİMİ API
# =============================================================================
class ServiceListCreateAPIView(APIView):
    """ Berberin hizmet eklemesi ve sunulan hizmetleri listelemesi """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        services = Service.objects.filter(barber=request.user)
        return Response({'services': ServiceSerializer(services, many=True).data})

    def post(self, request):
        name = request.data.get('name')
        price = request.data.get('price', 0)
        duration = request.data.get('duration_minutes', 30)
        if not name:
            return Response({'error': 'Hizmet adı zorunludur.'}, status=400)
        
        service = Service.objects.create(
            barber=request.user,
            name=name,
            price=price,
            duration_minutes=duration
        )
        return Response({'status': 'success', 'service': ServiceSerializer(service).data})


class ServiceDetailAPIView(APIView):
    """ Hizmet düzenleme ve silme uç noktası """
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        service = get_object_or_404(Service, pk=pk, barber=request.user)
        name = request.data.get('name')
        price = request.data.get('price')
        duration = request.data.get('duration_minutes')

        if name is not None:
            if not str(name).strip():
                return Response({'error': 'Hizmet adı boş bırakılamaz.'}, status=status.HTTP_400_BAD_REQUEST)
            service.name = str(name).strip()
        if price is not None:
            try:
                service.price = float(price)
            except (ValueError, TypeError):
                return Response({'error': 'Geçersiz fiyat formatı.'}, status=status.HTTP_400_BAD_REQUEST)
        if duration is not None:
            try:
                service.duration_minutes = int(duration)
            except (ValueError, TypeError):
                return Response({'error': 'Geçersiz süre formatı.'}, status=status.HTTP_400_BAD_REQUEST)

        service.save()
        return Response({'status': 'success', 'service': ServiceSerializer(service).data})

    def delete(self, request, pk):
        service = get_object_or_404(Service, pk=pk, barber=request.user)
        service.delete()
        return Response({'status': 'success'})


# =============================================================================
# 9. MÜŞTERİ RANDEVU SORGULAMA VE İPTALİ
# =============================================================================
class CustomerLookupAPIView(APIView):
    """ 
    Müşterinin telefon numarası ile randevularını araması.
    Veri güvenliği için tam telefon eşleşmesi ve format doğrulaması yapar.
    """
    def get(self, request):
        raw_phone = request.query_params.get('phone', '').strip()
        digits = clean_phone(raw_phone)
        
        # En az 10 basamak (örn: 5321234567 veya 05321234567) zorunluluğu
        if not digits or len(digits) < 10:
            return Response({'error': 'Lütfen geçerli ve eksiksiz bir telefon numarası girin (en az 10 hane).'}, status=status.HTTP_400_BAD_REQUEST)

        # Türkiye format çeşitlerini kapsar: '05XXXXXXXXX', '5XXXXXXXXX', '+905XXXXXXXXX'
        phone_variations = {raw_phone, digits}
        if digits.startswith('90') and len(digits) == 12:
            phone_variations.add('0' + digits[2:])
            phone_variations.add(digits[2:])
            phone_variations.add('+' + digits)
        elif digits.startswith('0') and len(digits) == 11:
            phone_variations.add(digits[1:])
            phone_variations.add('90' + digits[1:])
            phone_variations.add('+90' + digits[1:])
        elif len(digits) == 10:
            phone_variations.add('0' + digits)
            phone_variations.add('90' + digits)
            phone_variations.add('+90' + digits)

        appointments = Appointment.objects.filter(customer_phone__in=phone_variations).order_by('-date', '-start_time')
        data = []
        for appt in appointments:
            data.append({
                'id': appt.id,
                'barber_name': appt.barber.get_full_name() or appt.barber.shop_name or appt.barber.username,
                'shop_name': appt.barber.shop.name if appt.barber.shop else '',
                'customer_name': appt.customer_name,
                'customer_phone': appt.customer_phone,
                'date': appt.date.strftime('%d.%m.%Y'),
                'start_time': appt.start_time.strftime('%H:%M'),
                'end_time': appt.end_time.strftime('%H:%M'),
                'status': appt.status,
                'status_display': appt.get_status_display(),
                'total_price': str(appt.total_price),
                'services': [s.name for s in appt.services.all()]
            })
        return Response({'appointments': data})


class CustomerCancelAPIView(APIView):
    """ Müşterinin randevusunu kendisinin güvenli şekilde iptal etmesi """
    def post(self, request, pk):
        phone = request.data.get('phone', '').strip()
        appointment = get_object_or_404(Appointment, pk=pk)
        
        # Telefon numaralarını temizleyerek karşılaştır
        if clean_phone(appointment.customer_phone) != clean_phone(phone) and appointment.customer_phone != phone:
            return Response({'error': 'Bu randevuyu iptal etme yetkiniz bulunmamaktadır.'}, status=status.HTTP_403_FORBIDDEN)
            
        appointment.status = 'CANCELLED'
        appointment.save()
        return Response({'status': 'success'})
