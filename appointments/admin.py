from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Barber, Shop, Schedule, Appointment

class BarberAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Berber Bilgileri', {'fields': ('phone_number', 'shop_name', 'slug', 'logo', 'shop', 'slot_duration_minutes')}),
    )
    list_display = ['username', 'first_name', 'last_name', 'shop', 'phone_number']
    list_filter = ['shop', 'is_staff', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'phone_number']

class BarberInlineForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, required=False, label="Şifre", help_text="Sadece şifre belirlemek veya değiştirmek için doldurun.")

    class Meta:
        model = Barber
        fields = ('username', 'password', 'first_name', 'last_name', 'phone_number', 'is_active')

    def save(self, commit=True):
        barber = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            barber.set_password(password)
        if commit:
            barber.save()
        return barber

class BarberInline(admin.TabularInline):
    model = Barber
    form = BarberInlineForm
    fk_name = 'shop'
    extra = 0
    verbose_name = "Çalışan"
    verbose_name_plural = "Çalışanlar"

class ShopAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'slug')
    search_fields = ('name', 'slug')
    list_filter = ('owner',)
    inlines = [BarberInline]

class ScheduleAdmin(admin.ModelAdmin):
    list_display = ['barber', 'get_day_of_week_display', 'start_time', 'end_time', 'is_off_day']
    list_filter = ['barber', 'day_of_week', 'is_off_day']
    search_fields = ['barber__username']

class BreakTimeAdmin(admin.ModelAdmin):
    list_display = ['schedule', 'start_time', 'end_time']
    search_fields = ['schedule__barber__username']
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'barber', 'date', 'start_time', 'end_time', 'status']
    list_filter = ['status', 'date', 'barber']
    search_fields = ['customer_name', 'customer_phone']

from django.contrib.auth.models import Group

admin.site.unregister(Group)

admin.site.register(Barber, BarberAdmin)
admin.site.register(Shop, ShopAdmin)
admin.site.register(Schedule, ScheduleAdmin)
admin.site.register(Appointment, AppointmentAdmin)
