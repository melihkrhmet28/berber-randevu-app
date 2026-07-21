import datetime
import os
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from .models import Shop, Barber, Schedule, Holiday, Appointment, BreakTime, BlockedSlot
from .serializers import ShopSerializer, BarberSerializer, AppointmentSerializer
from twilio.rest import Client

def send_sms_notification(to_phone, message):
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
            print(f"Twilio SMS Error: {e}")
    else:
        print(f"SMS GÖNDERILEMEDI (Twilio ayarları eksik): {to_phone} -> {message}")


class ShopDetailAPIView(APIView):
    def get(self, request, slug):
        shop = get_object_or_404(Shop, slug=slug)
        barbers = list(shop.barbers.all())
        if shop.owner and shop.owner not in barbers:
            barbers.insert(0, shop.owner) # Patronu en başa ekleyelim
            
        return Response({
            'shop': ShopSerializer(shop).data,
            'barbers': BarberSerializer(barbers, many=True).data
        })

class BarberDetailView(generics.RetrieveAPIView):
    queryset = Barber.objects.all()
    serializer_class = BarberSerializer
    lookup_field = 'id'

def to_datetime(target_date, time_obj, is_end=False):
    if not time_obj:
        return None
    if is_end and (time_obj == datetime.time(0, 0) or time_obj == datetime.time(23, 59, 59) or time_obj == datetime.time(23, 59)):
        return datetime.datetime.combine(target_date + datetime.timedelta(days=1), datetime.time(0, 0))
    return datetime.datetime.combine(target_date, time_obj)

class AvailableSlotsView(APIView):
    def get(self, request, pk, date_str):
        barber = get_object_or_404(Barber, pk=pk)
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Geçersiz tarih formatı. YYYY-MM-DD olmalı.'}, status=status.HTTP_400_BAD_REQUEST)

        # Tatil kontrolü
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

        while current_time + slot_duration <= end_dt:
            slot_start_dt = current_time
            slot_end_dt = current_time + slot_duration

            # Mola çakışması kontrolü
            is_break = False
            for b in breaks:
                b_start = to_datetime(target_date, b.start_time)
                b_end = to_datetime(target_date, b.end_time, is_end=True)
                if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                    is_break = True
                    break
            
            # Kapatılmış saat kontrolü
            is_blocked = False
            for b in blocked:
                b_start = to_datetime(target_date, b.start_time)
                b_end = to_datetime(target_date, b.end_time, is_end=True)
                if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                    is_blocked = True
                    break

            # Randevu çakışması kontrolü
            is_booked = False
            for appt in appointments:
                a_start = to_datetime(target_date, appt.start_time)
                a_end = to_datetime(target_date, appt.end_time, is_end=True)
                if not (slot_end_dt <= a_start or slot_start_dt >= a_end):
                    is_booked = True
                    break

            if not is_break and not is_booked and not is_blocked:
                slots.append({
                    'start_time': slot_start_dt.strftime('%H:%M'),
                    'end_time': slot_end_dt.strftime('%H:%M')
                })

            current_time += slot_duration

        return Response({'slots': slots})


class CreateAppointmentView(generics.CreateAPIView):
    serializer_class = AppointmentSerializer

    def perform_create(self, serializer):
        appointment = serializer.save()
        barber = appointment.barber
        
        # Müşteriye SMS
        customer_msg = f"Merhaba {appointment.customer_name}, {barber.shop_name or barber.username} için {appointment.date.strftime('%d.%m.%Y')} saat {appointment.start_time.strftime('%H:%M')} randevunuz onaylanmıştır."
        send_sms_notification(appointment.customer_phone, customer_msg)
        
        # Berbere SMS
        if barber.phone_number:
            barber_msg = f"Yeni Randevu! Müşteri: {appointment.customer_name} ({appointment.customer_phone}) Tarih: {appointment.date.strftime('%d.%m.%Y')} {appointment.start_time.strftime('%H:%M')}"
            send_sms_notification(barber.phone_number, barber_msg)

from rest_framework.permissions import IsAuthenticated

class DashboardAPIView(APIView):
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
            
        return Response(data)

class DashboardCalendarAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, date_str):
        barber = request.user
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date'}, status=400)

        appointments = Appointment.objects.filter(barber=barber, date=target_date, status__in=['PENDING', 'CONFIRMED'])
        blocked = BlockedSlot.objects.filter(barber=barber, date=target_date)

        day_of_week = target_date.weekday()
        schedule = Schedule.objects.filter(barber=barber, day_of_week=day_of_week).first()
        breaks = BreakTime.objects.filter(schedule=schedule) if schedule else []

        start_bound = datetime.datetime.combine(target_date, datetime.time(6, 0))
        end_bound = datetime.datetime.combine(target_date + datetime.timedelta(days=1), datetime.time(0, 0))

        current_time = start_bound
        slot_duration = datetime.timedelta(minutes=barber.slot_duration_minutes)

        slots = []
        while current_time + slot_duration <= end_bound:
            slot_start_dt = current_time
            slot_end_dt = current_time + slot_duration

            state = 'available'
            
            # Check appointments
            for appt in appointments:
                a_start = to_datetime(target_date, appt.start_time)
                a_end = to_datetime(target_date, appt.end_time, is_end=True)
                if not (slot_end_dt <= a_start or slot_start_dt >= a_end):
                    state = 'booked'
                    break
            
            if state != 'booked':
                # Check blocked
                for b in blocked:
                    b_start = to_datetime(target_date, b.start_time)
                    b_end = to_datetime(target_date, b.end_time, is_end=True)
                    if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                        state = 'blocked'
                        break

            if state == 'available':
                is_outside_schedule = False
                if schedule:
                    if schedule.is_off_day:
                        is_outside_schedule = True
                    elif schedule.start_time and schedule.end_time:
                        sched_start = to_datetime(target_date, schedule.start_time)
                        sched_end = to_datetime(target_date, schedule.end_time, is_end=True)
                        if sched_end <= sched_start:
                            sched_end += datetime.timedelta(days=1)
                        if slot_start_dt < sched_start or slot_end_dt > sched_end:
                            is_outside_schedule = True
                else:
                    is_outside_schedule = True

                if is_outside_schedule:
                    state = 'blocked'
                else:
                    for b in breaks:
                        b_start = to_datetime(target_date, b.start_time)
                        b_end = to_datetime(target_date, b.end_time, is_end=True)
                        if not (slot_end_dt <= b_start or slot_start_dt >= b_end):
                            state = 'blocked'
                            break

            slots.append({
                'start_time': slot_start_dt.strftime('%H:%M'),
                'end_time': slot_end_dt.strftime('%H:%M'),
                'state': state
            })
            current_time += slot_duration

        appointments_data = []
        for appt in appointments:
            appointments_data.append({
                'id': appt.id,
                'name': appt.customer_name,
                'phone': appt.customer_phone,
                'start_time': appt.start_time.strftime('%H:%M'),
                'end_time': appt.end_time.strftime('%H:%M')
            })

        return Response({
            'slots': slots,
            'appointments': appointments_data
        })

    def post(self, request, date_str):
        # Batch Toggle slots
        barber = request.user
        try:
            target_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date'}, status=400)

        updates = request.data.get('updates', [])
        if not updates:
            # Fallback for single update
            start_time_str = request.data.get('start_time')
            end_time_str = request.data.get('end_time')
            action = request.data.get('action')
            if start_time_str and action:
                updates = [{'start_time': start_time_str, 'end_time': end_time_str, 'action': action}]

        for update in updates:
            try:
                st = datetime.datetime.strptime(update['start_time'], '%H:%M').time()
                et = datetime.datetime.strptime(update['end_time'], '%H:%M').time()
                action = update['action']
            except:
                continue
            
            if action == 'block':
                BlockedSlot.objects.get_or_create(barber=barber, date=target_date, start_time=st, end_time=et)
            elif action == 'unblock':
                BlockedSlot.objects.filter(barber=barber, date=target_date, start_time=st, end_time=et).delete()

        return Response({'status': 'success'})

class WeeklyScheduleAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barber = request.user
        # Ensure 7 days exist
        schedules = []
        for i in range(7):
            sched, created = Schedule.objects.get_or_create(barber=barber, day_of_week=i)
            schedules.append({
                'day_of_week': sched.day_of_week,
                'start_time': sched.start_time.strftime('%H:%M') if sched.start_time else '09:00',
                'end_time': sched.end_time.strftime('%H:%M') if sched.end_time else '23:00',
                'is_off_day': sched.is_off_day
            })
        return Response({
            'schedules': schedules,
            'slot_duration': barber.slot_duration_minutes
        })

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

class CancelAppointmentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        appointment = get_object_or_404(Appointment, pk=pk, barber=request.user)
        appointment.status = 'CANCELLED'
        appointment.save()

        # Iptal sms atılabilir, ancak opsiyonel
        # customer_msg = f"Merhaba {appointment.customer_name}, {appointment.date.strftime('%d.%m.%Y')} {appointment.start_time.strftime('%H:%M')} tarihli randevunuz iptal edilmiştir."
        # send_sms_notification(appointment.customer_phone, customer_msg)

        return Response({'status': 'success'})

class BarberLogoUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        barber = request.user
        if 'logo' in request.FILES:
            barber.logo = request.FILES['logo']
            barber.save()
            return Response({
                'status': 'success',
                'logo_url': barber.logo.url
            })
        return Response({'status': 'error', 'message': 'No file provided'}, status=400)

class ShopEmployeesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Not an owner'}, status=403)
        barbers = request.user.owned_shop.barbers.all()
        return Response({'employees': BarberSerializer(barbers, many=True).data})

    def post(self, request):
        if not hasattr(request.user, 'owned_shop'):
            return Response({'error': 'Not an owner'}, status=403)
        
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        if Barber.objects.filter(username=username).exists():
            return Response({'error': 'Bu kullanıcı adı zaten alınmış.'}, status=400)
            
        new_barber = Barber.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            shop=request.user.owned_shop
        )
        return Response({'status': 'success', 'employee': BarberSerializer(new_barber).data})

