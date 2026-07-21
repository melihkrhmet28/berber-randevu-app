document.addEventListener('DOMContentLoaded', () => {
    const appElement = document.getElementById('app');
    const path = window.location.pathname.replace(/^\/|\/$/g, '');

    // Router
    if (path === 'login') {
        renderLogin();
    } else if (path === 'dashboard') {
        renderDashboard();
    } else if (path === '') {
        appElement.innerHTML = `
            <div class="card">
                <div class="header">
                    <h1>Berber Randevu</h1>
                    <p>Müşterileriniz size ait özel bağlantı üzerinden randevu alabilirler.</p>
                </div>
                <button class="btn" onclick="window.location.href='/login'">Berber Girişi</button>
            </div>
        `;
    } else {
        // Assume it's a barber slug for booking
        initBookingFlow(path);
    }

    // --- LOGIN VIEWS ---
    function renderLogin() {
        appElement.innerHTML = `
            <div class="card">
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
        
        appElement.innerHTML = `
            <div class="card" style="max-width: 800px; width:100%;">
                <div class="header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <div style="position:relative; width: 60px; height: 60px;">
                            ${barber.logo ? `<img src="${barber.logo}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border:2px solid var(--primary-color);">` 
                                          : `<div style="width:100%; height:100%; background:var(--bg-color); border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px dashed var(--border-color); color:var(--text-secondary); font-size:0.75rem;">Logo Yok</div>`}
                            <label for="logo-upload" style="position:absolute; bottom:-5px; right:-5px; background:var(--primary-color); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; line-height:1;">+</label>
                            <input type="file" id="logo-upload" style="display:none;" accept="image/*" onchange="uploadLogo(this)">
                        </div>
                        <h1>Hoş Geldin, ${barber.shop_name || barber.username}</h1>
                    </div>
                    <button class="btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); width: auto; padding: 0.5rem 1rem;" onclick="localStorage.removeItem('berber_token'); window.location.href='/login';">Çıkış Yap</button>
                </div>
                
                <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem; text-align:center; border:1px solid var(--primary-color);">
                    <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.5rem;">Müşterilerinize Göndereceğiniz Randevu Linki:</p>
                    <a href="${shopUrl}" target="_blank" style="color:var(--primary-color); font-weight:600; text-decoration:none; display:block; margin-bottom:1rem; word-break: break-all;">${shopUrl}</a>
                    <button class="btn" style="padding:0.5rem 1rem; width:auto;" onclick="navigator.clipboard.writeText('${shopUrl}'); alert('Link kopyalandı!');">Linki Kopyala</button>
                </div>

                <div style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom: 2px solid var(--border-color);">
                    <button id="tab-calendar" class="tab-btn active-tab" style="background:none; border:none; padding:0.5rem 1rem; font-weight:bold; color:var(--primary-color); border-bottom:2px solid var(--primary-color); margin-bottom:-2px; cursor:pointer;">Takvim</button>
                    <button id="tab-schedule" class="tab-btn" style="background:none; border:none; padding:0.5rem 1rem; font-weight:bold; color:var(--text-secondary); cursor:pointer;">Haftalık Şablon</button>
                    ${isOwner ? `<button id="tab-employees" class="tab-btn" style="background:none; border:none; padding:0.5rem 1rem; font-weight:bold; color:var(--text-secondary); cursor:pointer;">Çalışanlar</button>` : ''}
                </div>

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

                <div id="view-schedule" style="display:none;">
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Her hafta standart olarak çalıştığınız günleri ve saatleri buradan belirleyin. Belirlediğiniz bu saatlerin dışındaki tüm aralıklar takvimde otomatik olarak kapalı gözükecektir.</p>
                    <div id="schedule-container">
                        <div class="loader">Yükleniyor...</div>
                    </div>
                </div>

                ${isOwner ? `
                <div id="view-employees" style="display:none;">
                    <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:300px;">
                            <h3 style="margin-bottom:1rem;">Çalışan Ekle</h3>
                            <form id="add-employee-form" style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                <div class="form-group">
                                    <label>Kullanıcı Adı</label>
                                    <input type="text" id="emp-username" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Şifre</label>
                                    <input type="password" id="emp-password" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Ad</label>
                                    <input type="text" id="emp-firstname" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>Soyad</label>
                                    <input type="text" id="emp-lastname" class="form-control">
                                </div>
                                <button type="submit" class="btn" id="add-emp-btn">Ekle</button>
                            </form>
                        </div>
                        <div style="flex:1; min-width:300px;">
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
        appElement.style.maxWidth = '800px';

        // Tabs Logic
        document.getElementById('tab-calendar').addEventListener('click', (e) => {
            e.target.style.color = 'var(--primary-color)';
            e.target.style.borderBottom = '2px solid var(--primary-color)';
            document.getElementById('tab-schedule').style.color = 'var(--text-secondary)';
            document.getElementById('tab-schedule').style.borderBottom = 'none';
            if (isOwner) {
                document.getElementById('tab-employees').style.color = 'var(--text-secondary)';
                document.getElementById('tab-employees').style.borderBottom = 'none';
                document.getElementById('view-employees').style.display = 'none';
            }
            document.getElementById('view-calendar').style.display = 'block';
            document.getElementById('view-schedule').style.display = 'none';
        });

        document.getElementById('tab-schedule').addEventListener('click', (e) => {
            e.target.style.color = 'var(--primary-color)';
            e.target.style.borderBottom = '2px solid var(--primary-color)';
            document.getElementById('tab-calendar').style.color = 'var(--text-secondary)';
            document.getElementById('tab-calendar').style.borderBottom = 'none';
            if (isOwner) {
                document.getElementById('tab-employees').style.color = 'var(--text-secondary)';
                document.getElementById('tab-employees').style.borderBottom = 'none';
                document.getElementById('view-employees').style.display = 'none';
            }
            document.getElementById('view-calendar').style.display = 'none';
            document.getElementById('view-schedule').style.display = 'block';
            loadWeeklySchedule(token);
        });

        if (isOwner) {
            document.getElementById('tab-employees').addEventListener('click', (e) => {
                e.target.style.color = 'var(--primary-color)';
                e.target.style.borderBottom = '2px solid var(--primary-color)';
                document.getElementById('tab-calendar').style.color = 'var(--text-secondary)';
                document.getElementById('tab-calendar').style.borderBottom = 'none';
                document.getElementById('tab-schedule').style.color = 'var(--text-secondary)';
                document.getElementById('tab-schedule').style.borderBottom = 'none';
                
                document.getElementById('view-calendar').style.display = 'none';
                document.getElementById('view-schedule').style.display = 'none';
                document.getElementById('view-employees').style.display = 'block';
                loadEmployees(token);
            });

            document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('add-emp-btn');
                btn.disabled = true;
                btn.innerText = 'Ekleniyor...';
                
                try {
                    const res = await fetch('/api/dashboard/employees/', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: document.getElementById('emp-username').value,
                            password: document.getElementById('emp-password').value,
                            first_name: document.getElementById('emp-firstname').value,
                            last_name: document.getElementById('emp-lastname').value
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Çalışan eklenemedi.');
                    alert('Çalışan eklendi!');
                    document.getElementById('add-employee-form').reset();
                    loadEmployees(token);
                } catch(err) {
                    alert(err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Ekle';
                }
            });
        }

        const dashDatePicker = document.getElementById('dash-date-picker');
        dashDatePicker.addEventListener('change', (e) => {
            loadDashboardSlots(e.target.value, token);
        });

        // Load initially
        loadDashboardSlots(dashDatePicker.value, token);
    }

    window.uploadLogo = async function(input) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        const token = localStorage.getItem('berber_token');
        
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
            const res = await fetch('/api/dashboard/logo/', {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Logo yüklenemedi.');
            alert('Logo başarıyla güncellendi!');
            window.location.reload();
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
            
            let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
            data.employees.forEach(emp => {
                html += `
                    <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>${emp.first_name} ${emp.last_name || ''}</strong>
                            <div style="font-size:0.875rem; color:var(--text-secondary);">@${emp.username}</div>
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

    // --- DRAG TO SELECT LOGIC ---
    let isDragging = false;
    let dragAction = null; // 'block' or 'unblock'
    let pendingUpdates = new Map(); // key: start_time, value: {start_time, end_time, action}

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
            // Background update success
        } catch(err) {
            console.error(err);
            // Revert changes on error
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

            // Attach drag-to-select events
            const buttons = container.querySelectorAll('.slot-btn:not([disabled])');
            buttons.forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent text selection
                    isDragging = true;
                    const state = btn.getAttribute('data-state');
                    dragAction = (state === 'available') ? 'block' : 'unblock';
                    toggleLocalButtonState(btn);
                });
                btn.addEventListener('mouseenter', (e) => {
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
        // If enforceAction is true, only change if the button's state is opposite of dragAction
        if (enforceAction) {
            if ((dragAction === 'block' && state === 'blocked') || 
                (dragAction === 'unblock' && state === 'available')) {
                return; // Already in target state
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
        if (!confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) {
            return;
        }
        
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
                    // Refresh current calendar date if we go back
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
    }


    // --- BOOKING FLOW VIEWS ---
    function initBookingFlow(shopSlug) {
        let selectedDate = new Date().toISOString().split('T')[0];
        let selectedSlot = null;
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
                        end_time: selectedSlot.end_time
                    })
                });

                if (!res.ok) throw new Error('Randevu oluşturulamadı. Lütfen tekrar deneyin.');
                
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
                        </div>
                    </div>
                `;
            } catch (error) {
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.innerText = 'Randevuyu Onayla';
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
                        <div class="form-group">
                            <label>Tarih Seçin</label>
                            <input type="date" id="date-picker" class="form-control" value="${selectedDate}" min="${new Date().toISOString().split('T')[0]}">
                        </div>
                        
                        <div class="form-group">
                            <label>Uygun Saatler</label>
                            <div id="slots-container"></div>
                        </div>

                        <div class="form-group">
                            <label>Adınız Soyadınız</label>
                            <input type="text" id="customer_name" class="form-control" placeholder="Ad Soyad" required>
                        </div>

                        <div class="form-group">
                            <label>Telefon Numaranız</label>
                            <input type="tel" id="customer_phone" class="form-control" placeholder="(05XX) XXX XX XX" required>
                        </div>

                        <button type="submit" class="btn" id="submit-btn">Randevuyu Onayla</button>
                    </form>
                </div>
            `;

            document.getElementById('date-picker').addEventListener('change', (e) => {
                selectedDate = e.target.value;
                selectedSlot = null;
                fetchSlots(selectedDate);
            });

            const phoneInput = document.getElementById('customer_phone');
            
            phoneInput.addEventListener('focus', (e) => {
                if (e.target.value.length === 0) {
                    e.target.value = '(05';
                }
            });

            phoneInput.addEventListener('blur', (e) => {
                if (e.target.value === '(05') {
                    e.target.value = '';
                }
            });

            phoneInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, ''); 
                
                if (!val.startsWith('05')) {
                    if (val.startsWith('0')) val = '05' + val.substring(1);
                    else if (val.startsWith('5')) val = '0' + val;
                    else val = '05' + val;
                }
                
                if (val.length > 11) val = val.substring(0, 11);
                
                let formatted = '';
                if (val.length > 0) {
                    formatted = '(' + val.substring(0, 4);
                }
                if (val.length >= 5) formatted += ') ' + val.substring(4, 7);
                if (val.length >= 8) formatted += ' ' + val.substring(7, 9);
                if (val.length >= 10) formatted += ' ' + val.substring(9, 11);
                
                e.target.value = formatted;
            });

            phoneInput.addEventListener('keydown', (e) => {
                if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.value.length <= 3) {
                    e.preventDefault();
                }
            });

            document.getElementById('booking-form').addEventListener('submit', submitAppointment);
        };

        fetchShop();
    }
});
