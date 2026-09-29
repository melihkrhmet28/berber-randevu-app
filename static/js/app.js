/**
 * =============================================================================
 * APP.JS - SINGLE PAGE APPLICATION (SPA) İSTEMCİ MANTIĞI
 * =============================================================================
 * Bu dosya kullanıcının tarayıcısında (Frontend) çalışan ana Javascript kodudur.
 * Sayfa yenilenmeden URL değişimlerini (Routing) dinler, Django REST API'ye 
 * HTTP (fetch) istekleri atar ve dönen JSON verilerine göre ekranı dinamik olarak çizer.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const appElement = document.getElementById('app');
    
    // URL yolunu alır (Örn: "/login" -> "login", "/kral-berber" -> "kral-berber")
    const path = window.location.pathname.replace(/^\/|\/$/g, '');

    // =============================================================================
    // 1. İSTEMCİ YÖNLENDİRİCİSİ (FRONTEND ROUTER)
    // URL'ye göre ilgili görünüm (render) fonksiyonunu çağırır
    // =============================================================================
    if (path === 'login') {
        renderLogin();
    } else if (path === 'dashboard') {
        renderDashboard();
    } else if (path === 'lookup') {
        renderCustomerLookup();
    } else if (path === '') {
        // Ana Sayfa Ekranı
        appElement.innerHTML = `
            <div class="card">
                <div class="header">
                    <h1>💈 Berber Randevu Sistemi</h1>
                    <p>Hızlı ve kolay çevrimiçi randevu alımı & yönetim paneli.</p>
                </div>
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <button class="btn" onclick="window.location.href='/lookup'">🔍 Randevu Sorgula & İptal Et</button>
                    <button class="btn" style="background:transparent; border:1px solid var(--primary-color); color:var(--primary-color);" onclick="window.location.href='/login'">✂️ Berber / İşletme Girişi</button>
                </div>
            </div>
        `;
    } else {
        // URL boş değilse bunu bir dükkan/berber slug'ı kabul eder (Örn: /kral-berber)
        initBookingFlow(path);
    }


    // --- CUSTOMER APPOINTMENT LOOKUP VIEW ---
    function renderCustomerLookup() {
        appElement.innerHTML = `
            <div class="card">
                <button class="btn" style="background:transparent; color:var(--text-secondary); border:none; text-align:left; padding:0; margin-bottom:1rem; cursor:pointer;" onclick="window.location.href='/'">← Ana Sayfaya Dön</button>
                <div class="header">
                    <h1>🔍 Randevu Sorgula</h1>
                    <p>Telefon numaranızı girerek aktif ve geçmiş randevularınızı listeleyin.</p>
                </div>
                <form id="lookup-form" style="margin-bottom:1.5rem;">
                    <div class="form-group">
                        <label>Telefon Numaranız</label>
                        <input type="tel" id="lookup-phone" class="form-control" placeholder="05XXXXXXXXX" required>
                    </div>
                    <button type="submit" class="btn" id="lookup-btn">Randevuları Getir</button>
                </form>
                <div id="lookup-results"></div>
            </div>
        `;

        document.getElementById('lookup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('lookup-phone').value.trim();
            const btn = document.getElementById('lookup-btn');
            const resultsContainer = document.getElementById('lookup-results');

            btn.disabled = true;
            btn.innerText = 'Aranıyor...';
            resultsContainer.innerHTML = '<div class="loader">Aranıyor...</div>';

            try {
                const res = await fetch(`/api/appointments/lookup/?phone=${encodeURIComponent(phone)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Arama yapılamadı.');

                if (data.appointments.length === 0) {
                    resultsContainer.innerHTML = '<div class="error-message">Bu telefon numarasına ait randevu bulunamadı.</div>';
                    return;
                }

                let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
                data.appointments.forEach(appt => {
                    let statusColor = '#10b981';
                    if (appt.status === 'CANCELLED') statusColor = '#ef4444';
                    else if (appt.status === 'PENDING') statusColor = '#f59e0b';

                    html += `
                        <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); position:relative;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                <div>
                                    <strong style="font-size:1.05rem;">${appt.barber_name}</strong>
                                    ${appt.shop_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${appt.shop_name}</div>` : ''}
                                </div>
                                <span style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}; font-size:0.75rem; font-weight:bold; padding:0.2rem 0.5rem; border-radius:var(--radius-sm);">
                                    ${appt.status_display}
                                </span>
                            </div>
                            <div style="font-size:0.9rem; margin-bottom:0.5rem; color:var(--text-secondary);">
                                📅 <strong>${appt.date}</strong> | ⏰ <strong>${appt.start_time} - ${appt.end_time}</strong>
                            </div>
                            ${appt.services && appt.services.length > 0 ? `<div style="font-size:0.85rem; color:var(--primary-color); margin-bottom:0.5rem;">💇 Hizmetler: ${appt.services.join(', ')}</div>` : ''}
                            ${appt.total_price && appt.total_price !== '0.00' ? `<div style="font-size:0.9rem; font-weight:bold; color:var(--success-color); margin-bottom:0.5rem;">💰 Toplam: ${appt.total_price} TL</div>` : ''}
                            
                            ${appt.status !== 'CANCELLED' ? `
                                <button class="btn" style="background:none; border:1px solid var(--error-color); color:var(--error-color); padding:0.4rem 0.8rem; font-size:0.85rem; margin-top:0.5rem;" onclick="customerCancelAppt(${appt.id}, '${phone}')">Randevuyu İptal Et</button>
                            ` : ''}
                        </div>
                    `;
                });
                html += '</div>';
                resultsContainer.innerHTML = html;

            } catch (err) {
                resultsContainer.innerHTML = `<div class="error-message">${err.message}</div>`;
            } finally {
                btn.disabled = false;
                btn.innerText = 'Randevuları Getir';
            }
        });
    }

    window.customerCancelAppt = async function(apptId, phone) {
        if (!confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) return;
        try {
            const res = await fetch(`/api/appointments/${apptId}/customer-cancel/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone })
            });
            if (!res.ok) throw new Error('İptal işlemi başarısız oldu.');
            alert('Randevunuz başarıyla iptal edildi.');
            document.getElementById('lookup-form').dispatchEvent(new Event('submit'));
        } catch (err) {
            alert(err.message);
        }
    };

    // --- LOGIN VIEWS ---
    function renderLogin() {
        appElement.innerHTML = `
            <div class="card">
                <button class="btn" style="background:transparent; color:var(--text-secondary); border:none; text-align:left; padding:0; margin-bottom:1rem; cursor:pointer;" onclick="window.location.href='/'">← Ana Sayfaya Dön</button>
                <div class="header">
                    <h1>Berber Girişi</h1>
                    <p>Yönetim paneline erişmek için giriş yapın.</p>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label>Kullanıcı Adı</label>
                        <input type="text" id="username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Şifre</label>
                        <input type="password" id="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn" id="login-btn">Giriş Yap</button>
                </form>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.innerText = 'Giriş Yapılıyor...';

            try {
                const res = await fetch('/api/auth/login/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('username').value,
                        password: document.getElementById('password').value
                    })
                });
                
                if (!res.ok) throw new Error('Kullanıcı adı veya şifre hatalı!');
                
                const data = await res.json();
                localStorage.setItem('berber_token', data.token);
                window.location.href = '/dashboard';
            } catch (error) {
                alert(error.message);
                btn.disabled = false;
                btn.innerText = 'Giriş Yap';
            }
        });
    }

    // --- DASHBOARD VIEWS ---
    async function renderDashboard() {
        const token = localStorage.getItem('berber_token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        appElement.innerHTML = '<div class="loader">Panel Yükleniyor...</div>';
        let barber = null;
        let data = null;

        try {
            const res = await fetch('/api/dashboard/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('berber_token');
                window.location.href = '/login';
                return;
            }
            if (!res.ok) throw new Error('Panel bilgileri alınamadı.');
            data = await res.json();
            barber = data.barber;
        } catch (error) {
            appElement.innerHTML = `<div class="card"><div class="error-message">${error.message}</div></div>`;
            return;
        }

        const isOwner = data.is_owner;
        const shop = data.shop;
        const shopUrl = shop ? `${window.location.origin}/${shop.slug}` : '';
        const analytics = data.analytics || { today_count: 0, today_revenue: '0.00', week_revenue: '0.00', total_appts_count: 0 };
        
        appElement.innerHTML = `
            <div class="card" style="max-width: 850px; width:100%;">
                <div class="header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <div style="position:relative; width: 60px; height: 60px;">
                            ${barber.logo ? `<img src="${barber.logo}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border:2px solid var(--primary-color);">` 
                                          : `<div style="width:100%; height:100%; background:var(--bg-color); border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px dashed var(--border-color); color:var(--text-secondary); font-size:0.75rem;">Logo Yok</div>`}
                            <label for="logo-upload" style="position:absolute; bottom:-5px; right:-5px; background:var(--primary-color); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; line-height:1;">+</label>
                            <input type="file" id="logo-upload" style="display:none;" accept="image/*" onchange="uploadLogo(this)">
                        </div>
                        <div>
                            <h1 style="font-size:1.3rem; margin:0;">Hoş Geldin, ${barber.first_name || barber.shop_name || barber.username}</h1>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">${isOwner ? '👑 Dükkan Sahibi (Patron)' : '✂️ Berber'}</span>
                        </div>
                    </div>
                    <button class="btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); width: auto; padding: 0.5rem 1rem;" onclick="localStorage.removeItem('berber_token'); window.location.href='/login';">Çıkış Yap</button>
                </div>

                <!-- ANALYTICS CARDS -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:0.75rem; margin-bottom:1.5rem;">
                    <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:1.5rem; display:block;">📅</span>
                        <div style="font-size:1.3rem; font-weight:bold; color:var(--primary-color); margin:0.25rem 0;">${analytics.today_count}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Bugünkü Randevu</div>
                    </div>
                    <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:1.5rem; display:block;">💵</span>
                        <div style="font-size:1.3rem; font-weight:bold; color:var(--success-color); margin:0.25rem 0;">${analytics.today_revenue} TL</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Bugünkü Kazanç</div>
                    </div>
                    <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:1.5rem; display:block;">📈</span>
                        <div style="font-size:1.3rem; font-weight:bold; color:#f59e0b; margin:0.25rem 0;">${analytics.week_revenue} TL</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Bu Haftaki Kazanç</div>
                    </div>
                    <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:1.5rem; display:block;">📊</span>
                        <div style="font-size:1.3rem; font-weight:bold; color:var(--text-primary); margin:0.25rem 0;">${analytics.total_appts_count}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Toplam Randevular</div>
                    </div>
                </div>
                
                <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem; text-align:center; border:1px solid var(--primary-color);">
                    <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.5rem;">Müşterilerinize Göndereceğiniz Randevu Linki:</p>
                    <a href="${shopUrl}" target="_blank" style="color:var(--primary-color); font-weight:600; text-decoration:none; display:block; margin-bottom:1rem; word-break: break-all;">${shopUrl}</a>
                    <button class="btn" style="padding:0.5rem 1rem; width:auto;" onclick="navigator.clipboard.writeText('${shopUrl}'); alert('Link kopyalandı!');">Linki Kopyala</button>
                </div>

                <!-- TABS -->
                <div class="tabs-nav">
                    <button id="tab-calendar" class="tab-btn active-tab">Takvim</button>
                    <button id="tab-services" class="tab-btn">Hizmetlerim</button>
                    <button id="tab-schedule" class="tab-btn">Haftalık Şablon</button>
                    ${isOwner ? `<button id="tab-employees" class="tab-btn">Çalışanlar</button>` : ''}
                </div>

                <!-- TAB 1: CALENDAR -->
                <div id="view-calendar">
                    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 300px;">
                            <input type="date" id="dash-date-picker" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="margin-bottom:1rem;">
                            <div id="dash-slots-container" style="user-select: none;">
                                <p style="color:var(--text-secondary);">Saatleri görmek için tarih seçin.</p>
                            </div>
                        </div>
                        <div style="flex: 1; min-width: 300px;">
                            <div id="dash-instructions" style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1rem;">
                                <strong>Kullanım:</strong><br><br>
                                <span style="display:inline-block; width:12px; height:12px; background:var(--bg-color); border:1px solid var(--border-color); margin-right:5px;"></span> Müsait<br>
                                <span style="display:inline-block; width:12px; height:12px; background:var(--text-secondary); margin-right:5px;"></span> Kapalı / Mola<br>
                                <span style="display:inline-block; width:12px; height:12px; background:var(--primary-color); margin-right:5px;"></span> Dolu Randevu<br><br>
                                <em>İpucu: Birden fazla saati hızlıca kapatmak için fareyle basılı tutarak sürükleyebilirsiniz.</em>
                            </div>
                            
                            <div id="daily-appointments-container" style="background: var(--bg-color); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <h3 style="font-size:1.1rem; margin-bottom:1rem;">Seçili Günün Randevuları</h3>
                                <div id="daily-appointments-list">
                                    <p style="color:var(--text-secondary); font-size:0.875rem;">Randevuları görmek için tarih seçin.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB 2: SERVICES -->
                <div id="view-services" style="display:none;">
                    <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:280px;">
                            <h3 id="srv-form-title" style="margin-bottom:1rem;">Yeni Hizmet Ekle</h3>
                            <form id="add-service-form" style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                <input type="hidden" id="srv-edit-id" value="">
                                <div class="form-group">
                                    <label>Hizmet Adı</label>
                                    <input type="text" id="srv-name" class="form-control" placeholder="Örn: Saç Kesimi" required>
                                </div>
                                <div class="form-group">
                                    <label>Fiyat (TL)</label>
                                    <input type="number" id="srv-price" class="form-control" placeholder="300" step="0.01" required>
                                </div>
                                <div class="form-group">
                                    <label>Tahmini Süre (Dakika)</label>
                                    <input type="number" id="srv-duration" class="form-control" value="30" required>
                                </div>
                                <div style="display:flex; gap:0.5rem;">
                                    <button type="submit" class="btn" id="add-srv-btn">Hizmet Ekle</button>
                                    <button type="button" class="btn" id="cancel-srv-edit-btn" style="display:none; background:var(--border-color);" onclick="resetServiceForm()">İptal</button>
                                </div>
                            </form>
                        </div>
                        <div style="flex:1; min-width:280px;">
                            <h3 style="margin-bottom:1rem;">Sunduğunuz Hizmetler</h3>
                            <div id="services-list"><div class="loader">Yükleniyor...</div></div>
                        </div>
                    </div>
                </div>

                <!-- TAB 3: SCHEDULE -->
                <div id="view-schedule" style="display:none;">
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Her hafta standart olarak çalıştığınız günleri ve saatleri buradan belirleyin.</p>
                    <div id="schedule-container">
                        <div class="loader">Yükleniyor...</div>
                    </div>
                </div>

                <!-- TAB 4: EMPLOYEES (OWNER ONLY) -->
                ${isOwner ? `
                <div id="view-employees" style="display:none;">
                    <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:280px;">
                            <h3 id="emp-form-title" style="margin-bottom:1rem;">Çalışan Ekle / Düzenle</h3>
                            <form id="add-employee-form" style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                <input type="hidden" id="emp-edit-id" value="">
                                <div class="form-group">
                                    <label>Kullanıcı Adı</label>
                                    <input type="text" id="emp-username" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
                                    <input type="password" id="emp-password" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Ad</label>
                                    <input type="text" id="emp-firstname" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Soyad</label>
                                    <input type="text" id="emp-lastname" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Telefon</label>
                                    <input type="tel" id="emp-phone" class="form-control" placeholder="05XXXXXXXXX">
                                </div>
                                <div style="display:flex; gap:0.5rem;">
                                    <button type="submit" class="btn" id="add-emp-btn">Ekle / Güncelle</button>
                                    <button type="button" class="btn" id="cancel-emp-edit-btn" style="display:none; background:var(--border-color);" onclick="resetEmployeeForm()">İptal</button>
                                </div>
                            </form>
                        </div>
                        <div style="flex:1; min-width:280px;">
                            <h3 style="margin-bottom:1rem;">Mevcut Çalışanlar</h3>
                            <div id="employees-list">
                                <div class="loader">Yükleniyor...</div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        appElement.style.maxWidth = '850px';

        // Tab Navigation Logic
        const tabBtns = ['calendar', 'services', 'schedule', ...(isOwner ? ['employees'] : [])];
        tabBtns.forEach(tName => {
            const btn = document.getElementById(`tab-${tName}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    tabBtns.forEach(other => {
                        const b = document.getElementById(`tab-${other}`);
                        const v = document.getElementById(`view-${other}`);
                        if (b && v) {
                            if (other === tName) {
                                b.classList.add('active-tab');
                                v.style.display = 'block';
                            } else {
                                b.classList.remove('active-tab');
                                v.style.display = 'none';
                            }
                        }
                    });

                    if (tName === 'services') loadServices(token);
                    else if (tName === 'schedule') loadWeeklySchedule(token);
                    else if (tName === 'employees') loadEmployees(token);
                });
            }
        });

        // Employee Form Submit
        if (isOwner) {
            document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const editId = document.getElementById('emp-edit-id').value;
                const btn = document.getElementById('add-emp-btn');
                btn.disabled = true;
                btn.innerText = 'Kaydediliyor...';
                
                const payload = {
                    username: document.getElementById('emp-username').value,
                    password: document.getElementById('emp-password').value,
                    first_name: document.getElementById('emp-firstname').value,
                    last_name: document.getElementById('emp-lastname').value,
                    phone_number: document.getElementById('emp-phone').value
                };

                try {
                    let url = '/api/dashboard/employees/';
                    let method = 'POST';

                    if (editId) {
                        url = `/api/dashboard/employees/${editId}/`;
                        method = 'PUT';
                    }

                    const res = await fetch(url, {
                        method: method,
                        headers: { 
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'İşlem başarısız oldu.');
                    alert(editId ? 'Çalışan bilgileri güncellendi!' : 'Yeni çalışan eklendi!');
                    resetEmployeeForm();
                    loadEmployees(token);
                } catch(err) {
                    alert(err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Ekle / Güncelle';
                }
            });
        }

        // Service Form Submit
        document.getElementById('add-service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = document.getElementById('srv-edit-id').value;
            const btn = document.getElementById('add-srv-btn');
            btn.disabled = true;
            btn.innerText = 'Kaydediliyor...';

            const payload = {
                name: document.getElementById('srv-name').value,
                price: parseFloat(document.getElementById('srv-price').value),
                duration_minutes: parseInt(document.getElementById('srv-duration').value)
            };

            try {
                let url = '/api/dashboard/services/';
                let method = 'POST';

                if (editId) {
                    url = `/api/dashboard/services/${editId}/`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method: method,
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'İşlem başarısız oldu.');
                alert(editId ? 'Hizmet güncellendi!' : 'Hizmet eklendi!');
                resetServiceForm();
                loadServices(token);
            } catch(err) {
                alert(err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = editId ? 'Güncelle' : 'Hizmet Ekle';
            }
        });

        const dashDatePicker = document.getElementById('dash-date-picker');
        dashDatePicker.addEventListener('change', (e) => {
            loadDashboardSlots(e.target.value, token);
        });

        // Load initially
        loadDashboardSlots(dashDatePicker.value, token);
    }

    window.resetEmployeeForm = function() {
        document.getElementById('emp-edit-id').value = '';
        document.getElementById('emp-username').disabled = false;
        document.getElementById('add-employee-form').reset();
        document.getElementById('emp-form-title').innerText = 'Çalışan Ekle';
        document.getElementById('cancel-emp-edit-btn').style.display = 'none';
    };

    window.resetServiceForm = function() {
        document.getElementById('srv-edit-id').value = '';
        document.getElementById('add-service-form').reset();
        document.getElementById('srv-form-title').innerText = 'Yeni Hizmet Ekle';
        document.getElementById('add-srv-btn').innerText = 'Hizmet Ekle';
        document.getElementById('cancel-srv-edit-btn').style.display = 'none';
    };

    window.editService = function(srv) {
        document.getElementById('srv-edit-id').value = srv.id;
        document.getElementById('srv-name').value = srv.name;
        document.getElementById('srv-price').value = srv.price;
        document.getElementById('srv-duration').value = srv.duration_minutes;
        
        document.getElementById('srv-form-title').innerText = `Hizmeti Düzenle: ${srv.name}`;
        document.getElementById('add-srv-btn').innerText = 'Güncelle';
        document.getElementById('cancel-srv-edit-btn').style.display = 'inline-block';
    };

    async function loadServices(token) {
        const container = document.getElementById('services-list');
        container.innerHTML = '<div class="loader">Yükleniyor...</div>';
        try {
            const res = await fetch('/api/dashboard/services/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) throw new Error('Hizmetler alınamadı.');
            const data = await res.json();

            if (data.services.length === 0) {
                container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.875rem;">Henüz hizmet eklemediniz.</p>';
                return;
            }

            let html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            data.services.forEach(srv => {
                html += `
                    <div style="background:var(--bg-color); padding:0.875rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="display:block; font-size:1rem;">${srv.name}</strong>
                            <span style="font-size:0.85rem; color:var(--success-color); font-weight:bold;">${srv.price} TL</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:8px;">⏱️ ${srv.duration_minutes} dk</span>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick='editService(${JSON.stringify(srv)})' style="background:none; border:1px solid var(--primary-color); color:var(--primary-color); padding:0.3rem 0.6rem; border-radius:var(--radius-sm); font-size:0.8rem; cursor:pointer;">Düzenle</button>
                            <button onclick="deleteService(${srv.id})" style="background:none; border:1px solid var(--error-color); color:var(--error-color); padding:0.3rem 0.6rem; border-radius:var(--radius-sm); font-size:0.8rem; cursor:pointer;">Sil</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch(err) {
            container.innerHTML = `<div class="error-message">${err.message}</div>`;
        }
    }

    window.deleteService = async function(id) {
        if (!confirm('Bu hizmeti silmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('berber_token');
        try {
            const res = await fetch(`/api/dashboard/services/${id}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) throw new Error('Silinemedi.');
            loadServices(token);
        } catch(err) {
            alert(err.message);
        }
    };

    async function loadEmployees(token) {
        const container = document.getElementById('employees-list');
        container.innerHTML = '<div class="loader">Yükleniyor...</div>';
        
        try {
            const res = await fetch('/api/dashboard/employees/', {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) throw new Error('Çalışanlar alınamadı.');
            const data = await res.json();
            
            if (data.employees.length === 0) {
                container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.875rem;">Henüz çalışan eklemediniz.</p>';
                return;
            }
            
            let html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            data.employees.forEach(emp => {
                html += `
                    <div style="background:var(--bg-color); padding:0.875rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="display:block; font-size:1rem;">${emp.first_name} ${emp.last_name || ''}</strong>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">@${emp.username} ${emp.phone_number ? '| 📞 ' + emp.phone_number : ''}</div>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick='editEmployee(${JSON.stringify(emp)})' style="background:none; border:1px solid var(--primary-color); color:var(--primary-color); padding:0.3rem 0.6rem; border-radius:var(--radius-sm); font-size:0.8rem; cursor:pointer;">Düzenle</button>
                            <button onclick="deleteEmployee(${emp.id})" style="background:none; border:1px solid var(--error-color); color:var(--error-color); padding:0.3rem 0.6rem; border-radius:var(--radius-sm); font-size:0.8rem; cursor:pointer;">Sil</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch(err) {
            container.innerHTML = `<div class="error-message">${err.message}</div>`;
        }
    }

    window.editEmployee = function(emp) {
        document.getElementById('emp-edit-id').value = emp.id;
        document.getElementById('emp-username').value = emp.username;
        document.getElementById('emp-username').disabled = true;
        document.getElementById('emp-firstname').value = emp.first_name || '';
        document.getElementById('emp-lastname').value = emp.last_name || '';
        document.getElementById('emp-phone').value = emp.phone_number || '';
        document.getElementById('emp-password').value = '';
        
        document.getElementById('emp-form-title').innerText = `Çalışan Düzenle: @${emp.username}`;
        document.getElementById('cancel-emp-edit-btn').style.display = 'inline-block';
    };

    window.deleteEmployee = async function(id) {
        if (!confirm('Bu çalışanı silmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('berber_token');
        try {
            const res = await fetch(`/api/dashboard/employees/${id}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Silinemedi.');
            loadEmployees(token);
        } catch(err) {
            alert(err.message);
        }
    };

    // --- DRAG TO SELECT & DASHBOARD SLOTS LOGIC ---
    let isDragging = false;
    let dragAction = null;
    let pendingUpdates = new Map();

    document.addEventListener('mouseup', async () => {
        if (isDragging) {
            isDragging = false;
            if (pendingUpdates.size > 0) {
                await sendBatchUpdates();
            }
        }
    });

    async function sendBatchUpdates() {
        const token = localStorage.getItem('berber_token');
        const dateStr = document.getElementById('dash-date-picker').value;
        const updates = Array.from(pendingUpdates.values());
        pendingUpdates.clear();

        try {
            const res = await fetch(`/api/dashboard/calendar/${dateStr}/`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ updates: updates })
            });
            if (!res.ok) throw new Error('İşlem başarısız');
        } catch(err) {
            console.error(err);
            loadDashboardSlots(dateStr, token);
        }
    }

    async function loadDashboardSlots(dateStr, token) {
        const container = document.getElementById('dash-slots-container');
        const apptListContainer = document.getElementById('daily-appointments-list');
        
        container.innerHTML = '<div class="loader">Yükleniyor...</div>';
        apptListContainer.innerHTML = '<div class="loader" style="transform: scale(0.6);">...</div>';
        pendingUpdates.clear();
        
        try {
            const res = await fetch(`/api/dashboard/calendar/${dateStr}/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) throw new Error('Saatler alınamadı.');
            const data = await res.json();
            
            let html = '<div class="slots-grid">';
            let apptHtml = '';
            
            data.slots.forEach(slot => {
                let bgColor = 'var(--bg-color)';
                let color = 'var(--text-primary)';
                let isClickable = true;
                let currentState = slot.state;

                if (slot.state === 'booked') {
                    bgColor = 'var(--primary-color)';
                    color = 'white';
                    isClickable = false;
                } else if (slot.state === 'blocked') {
                    bgColor = 'var(--text-secondary)';
                    color = 'white';
                }

                html += `<button type="button" class="slot-btn" 
                            data-start="${slot.start_time}" data-end="${slot.end_time}" data-state="${currentState}"
                            style="background:${bgColor}; color:${color}; ${!isClickable ? 'cursor:not-allowed; opacity:0.8;' : 'cursor:pointer;'} touch-action: none;"
                            ${!isClickable ? 'disabled' : ''}
                        >${slot.start_time}</button>`;
            });
            html += '</div>';
            container.innerHTML = html;

            if (data.appointments && data.appointments.length > 0) {
                data.appointments.forEach(appt => {
                    apptHtml += `
                        <div style="background: rgba(59, 130, 246, 0.05); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 4px solid var(--primary-color); margin-bottom: 0.5rem; position: relative;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 0.25rem;">
                                <strong style="color:var(--text-primary);">${appt.name}</strong>
                                <span style="color:var(--primary-color); font-weight:bold;">${appt.start_time} - ${appt.end_time}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary); font-size: 0.85rem;">
                                    📞 ${appt.phone}
                                </span>
                                <div style="display:flex; gap: 0.5rem;">
                                    <a href="tel:${appt.phone}" style="display:inline-block; padding:0.25rem 0.5rem; background:var(--primary-color); color:white; border-radius:var(--radius-sm); font-size:0.8rem; text-decoration:none;">📞 Ara</a>
                                    <button onclick="cancelAppointment(${appt.id}, '${dateStr}')" style="background:none; border:1px solid #ef4444; border-radius:var(--radius-sm); padding:0.25rem 0.5rem; color:#ef4444; font-size:0.8rem; cursor:pointer; font-weight:bold;">İptal Et</button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            apptListContainer.innerHTML = apptHtml || '<p style="color:var(--text-secondary); font-size:0.875rem;">Bu tarihte randevu bulunmuyor.</p>';

            const buttons = container.querySelectorAll('.slot-btn:not([disabled])');
            buttons.forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    isDragging = true;
                    const state = btn.getAttribute('data-state');
                    dragAction = (state === 'available') ? 'block' : 'unblock';
                    toggleLocalButtonState(btn);
                });
                btn.addEventListener('mouseenter', () => {
                    if (isDragging) {
                        toggleLocalButtonState(btn, true);
                    }
                });
            });

        } catch(err) {
            container.innerHTML = `<div class="error-message">${err.message}</div>`;
        }
    }

    function toggleLocalButtonState(btn, enforceAction = false) {
        const state = btn.getAttribute('data-state');
        if (enforceAction) {
            if ((dragAction === 'block' && state === 'blocked') || 
                (dragAction === 'unblock' && state === 'available')) {
                return;
            }
        }

        const newState = (dragAction === 'block') ? 'blocked' : 'available';
        btn.setAttribute('data-state', newState);
        
        if (newState === 'blocked') {
            btn.style.background = 'var(--text-secondary)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-color)';
            btn.style.color = 'var(--text-primary)';
        }

        const start = btn.getAttribute('data-start');
        const end = btn.getAttribute('data-end');
        pendingUpdates.set(start, { start_time: start, end_time: end, action: dragAction });
    }

    window.cancelAppointment = async function(id, dateStr) {
        if (!confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) return;
        const token = localStorage.getItem('berber_token');
        try {
            const res = await fetch(`/api/appointments/${id}/cancel/`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error('İptal işlemi başarısız oldu.');
            alert('Randevu başarıyla iptal edildi.');
            loadDashboardSlots(dateStr, token);
        } catch(err) {
            alert(err.message);
        }
    };

    // --- WEEKLY SCHEDULE LOGIC ---
    const daysMap = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    
    async function loadWeeklySchedule(token) {
        const container = document.getElementById('schedule-container');
        container.innerHTML = '<div class="loader">Yükleniyor...</div>';

        try {
            const res = await fetch(`/api/dashboard/schedule/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) throw new Error('Şablon alınamadı.');
            const data = await res.json();
            
            let html = '<form id="schedule-form">';
            html += `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <strong style="display:block; margin-bottom: 0.5rem;">Randevu Periyodu (Süresi)</strong>
                    <label style="margin-right: 1rem; cursor:pointer;">
                        <input type="radio" name="slot_duration" value="30" ${data.slot_duration === 30 ? 'checked' : ''}> 30 Dakika
                    </label>
                    <label style="cursor:pointer;">
                        <input type="radio" name="slot_duration" value="60" ${data.slot_duration === 60 ? 'checked' : ''}> 60 Dakika (1 Saat)
                    </label>
                </div>
            `;
            data.schedules.sort((a,b) => a.day_of_week - b.day_of_week).forEach(sched => {
                html += `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem; background:var(--bg-color); border:1px solid var(--border-color); margin-bottom:0.5rem; border-radius:var(--radius-sm);">
                        <div style="width: 100px; font-weight:600;">${daysMap[sched.day_of_week]}</div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <input type="time" name="start_${sched.day_of_week}" value="${sched.start_time}" class="form-control" style="width:auto; padding:0.25rem;" ${sched.is_off_day ? 'disabled' : ''}>
                            <span>-</span>
                            <input type="time" name="end_${sched.day_of_week}" value="${sched.end_time}" class="form-control" style="width:auto; padding:0.25rem;" ${sched.is_off_day ? 'disabled' : ''}>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem; width: 120px;">
                            <input type="checkbox" id="off_${sched.day_of_week}" name="off_${sched.day_of_week}" ${sched.is_off_day ? 'checked' : ''} onchange="toggleScheduleInputs(${sched.day_of_week})">
                            <label for="off_${sched.day_of_week}" style="margin:0; cursor:pointer;">İzin Günü</label>
                        </div>
                    </div>
                `;
            });
            html += '<button type="submit" class="btn" id="save-schedule-btn" style="margin-top:1rem;">Şablonu Kaydet</button>';
            html += '</form>';
            container.innerHTML = html;

            document.getElementById('schedule-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-schedule-btn');
                btn.disabled = true;
                btn.innerText = 'Kaydediliyor...';

                const form = e.target;
                const updates = [];
                for (let i = 0; i < 7; i++) {
                    updates.push({
                        day_of_week: i,
                        start_time: form[`start_${i}`].value,
                        end_time: form[`end_${i}`].value,
                        is_off_day: form[`off_${i}`].checked
                    });
                }

                try {
                    const postRes = await fetch(`/api/dashboard/schedule/`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            schedules: updates,
                            slot_duration: parseInt(form.elements['slot_duration'].value)
                        })
                    });
                    if (!postRes.ok) throw new Error('Kaydedilemedi');
                    alert('Haftalık şablon başarıyla kaydedildi!');
                    const dateStr = document.getElementById('dash-date-picker').value;
                    loadDashboardSlots(dateStr, token);
                } catch(err) {
                    alert(err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Şablonu Kaydet';
                }
            });

        } catch(err) {
            container.innerHTML = `<div class="error-message">${err.message}</div>`;
        }
    }

    window.toggleScheduleInputs = function(day) {
        const isOff = document.getElementById(`off_${day}`).checked;
        const form = document.getElementById('schedule-form');
        form[`start_${day}`].disabled = isOff;
        form[`end_${day}`].disabled = isOff;
    };


    // --- BOOKING FLOW VIEWS (WITH SERVICES SELECTION) ---
    function initBookingFlow(shopSlug) {
        let selectedDate = new Date().toISOString().split('T')[0];
        let selectedSlot = null;
        let selectedServices = [];
        let shopData = null;
        let barberData = null;
        let availableSlots = [];

        const fetchShop = async () => {
            try {
                const res = await fetch(`/api/shops/${shopSlug}/`);
                if (!res.ok) throw new Error('Dükkan bulunamadı.');
                const data = await res.json();
                shopData = data.shop;
                const barbers = data.barbers;
                
                if (barbers.length === 0) {
                    throw new Error('Bu dükkanda henüz berber bulunmuyor.');
                }
                
                if (barbers.length === 1) {
                    barberData = barbers[0];
                    renderBookingForm();
                    fetchSlots(selectedDate);
                } else {
                    renderBarberSelection(barbers);
                }
            } catch (error) {
                appElement.innerHTML = `<div class="card"><div class="error-message">Hata: ${error.message}</div><a href="/" style="color:var(--primary-color); text-decoration:none; text-align:center; display:block;">Ana Sayfa</a></div>`;
            }
        };

        const renderBarberSelection = (barbers) => {
            let html = `
                <div class="card">
                    <div class="header" style="text-align:center;">
                        ${shopData.logo ? `<img src="${shopData.logo}" alt="Logo" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid var(--primary-color); margin: 0 auto 1rem auto; display: block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">` : ''}
                        <h1>${shopData.name}</h1>
                        <p>Lütfen randevu almak istediğiniz berberi seçin.</p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:1rem; margin-top:2rem;">
            `;
            
            barbers.forEach((b, idx) => {
                html += `
                    <button class="btn barber-select-btn" data-index="${idx}" style="background:var(--bg-color); color:var(--text-primary); border:2px solid var(--border-color); display:flex; align-items:center; gap:1rem; text-align:left; padding:1rem; border-radius:var(--radius-md);">
                        ${b.logo ? `<img src="${b.logo}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">` : `<div style="width:50px; height:50px; border-radius:50%; background:var(--border-color); display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-weight:bold;">${b.first_name ? b.first_name[0] : b.username[0]}</div>`}
                        <div>
                            <strong style="display:block; font-size:1.1rem;">${b.first_name} ${b.last_name || b.username}</strong>
                        </div>
                    </button>
                `;
            });
            
            html += `</div></div>`;
            appElement.innerHTML = html;
            
            document.querySelectorAll('.barber-select-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.currentTarget.dataset.index;
                    barberData = barbers[idx];
                    renderBookingForm();
                    fetchSlots(selectedDate);
                });
            });
        };

        const fetchSlots = async (date) => {
            const slotsContainer = document.getElementById('slots-container');
            if (!slotsContainer) return;
            
            slotsContainer.innerHTML = '<div class="loader">Saatler yükleniyor...</div>';
            try {
                const res = await fetch(`/api/barbers/${barberData.id}/slots/${date}/`);
                if (!res.ok) throw new Error('Saatler alınamadı.');
                const data = await res.json();
                availableSlots = data.slots;
                renderSlots();
            } catch (error) {
                slotsContainer.innerHTML = `<div class="error-message">Saatler yüklenemedi.</div>`;
            }
        };

        const submitAppointment = async (e) => {
            e.preventDefault();
            if (!selectedSlot) {
                alert('Lütfen bir saat seçin.');
                return;
            }

            const name = document.getElementById('customer_name').value;
            const phone = document.getElementById('customer_phone').value;
            const submitBtn = document.getElementById('submit-btn');

            submitBtn.disabled = true;
            submitBtn.innerText = 'Onaylanıyor...';

            try {
                const res = await fetch('/api/appointments/create/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        barber: barberData.id,
                        customer_name: name,
                        customer_phone: phone,
                        date: selectedDate,
                        start_time: selectedSlot.start_time,
                        end_time: selectedSlot.end_time,
                        services: selectedServices
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Randevu oluşturulamadı. Lütfen tekrar deneyin.');
                }
                
                appElement.innerHTML = `
                    <div class="card">
                        <div class="success-message">
                            <div class="success-icon">✓</div>
                            <h2>Randevunuz Onaylandı!</h2>
                            <p style="color: var(--text-secondary); margin-top: 1rem;">
                                ${name}, randevunuz başarıyla oluşturuldu.<br><br>
                                Tarih: <strong>${selectedDate}</strong><br>
                                Saat: <strong>${selectedSlot.start_time}</strong><br>
                                Berber: <strong>${barberData.shop_name || barberData.username}</strong>
                            </p>
                            <button class="btn" style="margin-top:1.5rem;" onclick="window.location.href='/'">Ana Sayfaya Dön</button>
                        </div>
                    </div>
                `;
            } catch (error) {
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.innerText = 'Randevuyu Onayla';
                fetchSlots(selectedDate);
            }
        };

        const renderSlots = () => {
            const slotsContainer = document.getElementById('slots-container');
            if (!slotsContainer) return;

            if (availableSlots.length === 0) {
                slotsContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Bu tarih için uygun saat bulunmamaktadır.</p>';
                selectedSlot = null;
                return;
            }

            let html = '<div class="slots-grid">';
            availableSlots.forEach((slot, index) => {
                html += `<button type="button" class="slot-btn" data-index="${index}">${slot.start_time}</button>`;
            });
            html += '</div>';
            slotsContainer.innerHTML = html;

            document.querySelectorAll('.slot-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                    e.target.classList.add('selected');
                    selectedSlot = availableSlots[e.target.dataset.index];
                });
            });
        };

        const renderBookingForm = () => {
            const services = barberData.services || [];
            
            let servicesHtml = '';
            if (services.length > 0) {
                servicesHtml = `
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label>Hizmet Seçimi (Opsiyonel)</label>
                        <div style="display:flex; flex-direction:column; gap:0.5rem;">
                `;
                services.forEach(srv => {
                    servicesHtml += `
                        <label style="background:var(--bg-color); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                            <div>
                                <input type="checkbox" class="srv-checkbox" value="${srv.id}" data-price="${srv.price}">
                                <span style="margin-left:8px; font-weight:500;">${srv.name}</span>
                                <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:5px;">(${srv.duration_minutes} dk)</span>
                            </div>
                            <strong style="color:var(--success-color);">${srv.price} TL</strong>
                        </label>
                    `;
                });
                servicesHtml += `
                        </div>
                        <div id="total-price-badge" style="margin-top:0.75rem; text-align:right; font-weight:bold; font-size:1.05rem; color:var(--primary-color);">Toplam Tutar: 0.00 TL</div>
                    </div>
                `;
            }

            appElement.innerHTML = `
                <div class="card">
                    <button class="btn" style="background:transparent; color:var(--text-secondary); border:none; text-align:left; padding:0; margin-bottom:1rem; cursor:pointer;" onclick="window.location.reload();">← Geri Dön</button>
                    <div class="header" style="text-align:center;">
                        ${shopData.logo ? `<img src="${shopData.logo}" alt="Logo" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid var(--primary-color); margin: 0 auto 1rem auto; display: block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">` : ''}
                        <h1 style="font-size:1.5rem; margin-bottom:0.25rem;">${shopData.name}</h1>
                        <h3 style="color:var(--primary-color); margin-bottom:1rem;">Berber: ${barberData.first_name} ${barberData.last_name || barberData.username}</h3>
                        <p>Randevunuzu oluşturmak için tarih ve saat seçin.</p>
                    </div>
                    <form id="booking-form">
                        ${servicesHtml}
                        <div class="form-group">
                            <label>Tarih Seçin</label>
                            <input type="date" id="date-picker" class="form-control" value="${selectedDate}" min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Saat Seçin</label>
                            <div id="slots-container"></div>
                        </div>
                        <div class="form-group">
                            <label>Adınız Soyadınız</label>
                            <input type="text" id="customer_name" class="form-control" placeholder="Ahmet Yılmaz" required>
                        </div>
                        <div class="form-group">
                            <label>Telefon Numaranız</label>
                            <input type="tel" id="customer_phone" class="form-control" placeholder="05XXXXXXXXX" required>
                        </div>
                        <button type="submit" class="btn" id="submit-btn" style="margin-top: 1rem;">Randevuyu Onayla</button>
                    </form>
                </div>
            `;

            // Calculate total price on checkbox toggle
            const checkboxes = document.querySelectorAll('.srv-checkbox');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    selectedServices = Array.from(document.querySelectorAll('.srv-checkbox:checked')).map(c => parseInt(c.value));
                    const total = Array.from(document.querySelectorAll('.srv-checkbox:checked')).reduce((acc, c) => acc + parseFloat(c.dataset.price), 0);
                    const badge = document.getElementById('total-price-badge');
                    if (badge) badge.innerText = `Toplam Tutar: ${total.toFixed(2)} TL`;
                });
            });

            document.getElementById('date-picker').addEventListener('change', (e) => {
                selectedDate = e.target.value;
                selectedSlot = null;
                fetchSlots(selectedDate);
            });

            document.getElementById('booking-form').addEventListener('submit', submitAppointment);
        };

        fetchShop();
    }
});
