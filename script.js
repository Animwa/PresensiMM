// ==========================================
// URL WEB APP GOOGLE APPS SCRIPT ANDA
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyo9oYoJNTAbbgFMzCnIHAc64V8g8Y2herSHjpEcFWLCs_xV3PB8tfKXU_1foBhL7RhHQ/exec";

function appData() {
    return {
        loading: true,
        submitting: false,
        activeTab: 'beranda',
        isAdmin: false,
        logoClickCount: 0,
        logoClickTimer: null,
        
        showLoginModal: false,
        showAddModal: false,
        showPresensiModal: false,

        adminPasswordInput: '',
        selectedDesa: '',
        selectedKelompok: '',
        selectedActivity: null,

        monitoringFilterActId: 'all',
        evalMode: 'kegiatan', // 'kegiatan' atau 'bulan'
        selectedEvalActivity: 'all',
        selectedEvalMonth: 'all',

        masterWilayah: {},
        activities: [],
        presensiList: [],

        formActivity: { nama: '', tanggalRaw: '', waktu: '', tempat: '' },
        formPresensi: { hadir: '', izin: '', alfa: '' },

        initData() {
            // Cek status login admin yang tersimpan di localStorage agar tidak perlu login ulang
            if (localStorage.getItem('kmm_admin_logged_in') === 'true') {
                this.isAdmin = true;
            }

            // Pulihkan pilihan Desa & Kelompok terakhir jika ada
            const savedDesa = localStorage.getItem('kmm_selected_desa');
            const savedKelompok = localStorage.getItem('kmm_selected_kelompok');
            if (savedDesa) this.selectedDesa = savedDesa;
            if (savedKelompok) this.selectedKelompok = savedKelompok;

            this.$watch('selectedDesa', val => localStorage.setItem('kmm_selected_desa', val));
            this.$watch('selectedKelompok', val => localStorage.setItem('kmm_selected_kelompok', val));

            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.altKey && (e.key === 'm' || e.key === 'M')) {
                    e.preventDefault();
                    this.showLoginModal = true;
                }
            });

            document.addEventListener('contextmenu', event => event.preventDefault());
            this.fetchServerData();
        },

        handleLogoClick() {
            this.logoClickCount++;
            clearTimeout(this.logoClickTimer);
            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.showLoginModal = true;
            } else {
                this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, 2000);
            }
        },

        get availableKelompok() {
            return (this.selectedDesa && this.masterWilayah[this.selectedDesa]) ? this.masterWilayah[this.selectedDesa] : [];
        },

        get filteredMonitoringActivities() {
            if (this.monitoringFilterActId === 'all') return this.activities;
            return this.activities.filter(a => String(a.id) === String(this.monitoringFilterActId));
        },

        getTotalKelompokCount() {
            let total = 0;
            for (let desa in this.masterWilayah) {
                total += this.masterWilayah[desa].length;
            }
            return total;
        },

        // Mengonversi format tanggal ISO (2026-11-15T17:00:00.000Z) atau YYYY-MM-DD ke Hari, Tanggal Bulan Tahun
        formatTanggalIndo(val) {
            if (!val) return '';
            const strVal = String(val).trim();
            
            // Jika format ISO timestamp atau YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
                const dateObj = new Date(strVal);
                if (!isNaN(dateObj.getTime())) {
                    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    
                    const hariStr = namaHari[dateObj.getDay()];
                    const tglStr = dateObj.getDate();
                    const bulanStr = namaBulan[dateObj.getMonth()];
                    const tahunStr = dateObj.getFullYear();
                    
                    return `${hariStr}, ${tglStr} ${bulanStr} ${tahunStr}`;
                }
            }
            return strVal;
        },

        // Otomatis menghasilkan Nama Hari + Tanggal Indonesia saat admin memilih tanggal
        updateFormattedDate() {
            if (!this.formActivity.tanggalRaw) {
                this.formActivity.waktu = '';
                return;
            }
            const [year, month, day] = this.formActivity.tanggalRaw.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            
            const hariStr = namaHari[dateObj.getDay()];
            const bulanStr = namaBulan[dateObj.getMonth()];
            this.formActivity.waktu = `${hariStr}, ${day} ${bulanStr} ${year}`;
        },

        // Ekstrak nama Bulan & Tahun dari string waktu kegiatan
        extractMonthYear(waktuStr) {
            if (!waktuStr) return 'Lainnya';
            const daftarBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            for (let bln of daftarBulan) {
                if (waktuStr.includes(bln)) {
                    const yearMatch = waktuStr.match(/\b20\d{2}\b/);
                    return yearMatch ? `${bln} ${yearMatch[0]}` : bln;
                }
            }
            return 'Lainnya';
        },

        get availableMonths() {
            const setBulan = new Set();
            this.activities.forEach(act => {
                setBulan.add(this.extractMonthYear(act.waktu));
            });
            return Array.from(setBulan);
        },

        // Filter data presensi untuk Tab Evaluasi
        get filteredEvalPresensi() {
            if (this.evalMode === 'kegiatan') {
                if (this.selectedEvalActivity === 'all') return this.presensiList;
                return this.presensiList.filter(p => String(p.kegiatanId) === String(this.selectedEvalActivity));
            } else {
                if (this.selectedEvalMonth === 'all') return this.presensiList;
                const matchingActIds = this.activities
                    .filter(act => this.extractMonthYear(act.waktu) === this.selectedEvalMonth)
                    .map(act => String(act.id));
                return this.presensiList.filter(p => matchingActIds.includes(String(p.kegiatanId)));
            }
        },

        // Statistik Total & Persentase untuk Evaluasi
        get evalStats() {
            const list = this.filteredEvalPresensi;
            const hadir = list.reduce((sum, item) => sum + (Number(item.hadir) || 0), 0);
            const izin = list.reduce((sum, item) => sum + (Number(item.izin) || 0), 0);
            const alfa = list.reduce((sum, item) => sum + (Number(item.alfa) || 0), 0);
            const total = hadir + izin + alfa;

            const calcPct = (val) => total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';

            return {
                hadir,
                izin,
                alfa,
                total,
                hadirPct: calcPct(hadir),
                izinPct: calcPct(izin),
                alfaPct: calcPct(alfa)
            };
        },

        // Baris tabel rekapitulasi per kegiatan atau per bulan
        get evalTableRows() {
            if (this.evalMode === 'kegiatan') {
                return this.activities.map(act => {
                    const records = this.presensiList.filter(p => String(p.kegiatanId) === String(act.id));
                    const hadir = records.reduce((s, r) => s + (Number(r.hadir) || 0), 0);
                    const izin = records.reduce((s, r) => s + (Number(r.izin) || 0), 0);
                    const alfa = records.reduce((s, r) => s + (Number(r.alfa) || 0), 0);
                    const total = hadir + izin + alfa;
                    const pct = (v) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
                    return {
                        label: `${act.nama} (${act.waktu})`,
                        kelompokCount: `${records.length} / ${this.getTotalKelompokCount()}`,
                        hadir, izin, alfa, total,
                        hadirPct: pct(hadir),
                        izinPct: pct(izin),
                        alfaPct: pct(alfa)
                    };
                });
            } else {
                return this.availableMonths.map(bln => {
                    const actIds = this.activities
                        .filter(a => this.extractMonthYear(a.waktu) === bln)
                        .map(a => String(a.id));
                    const records = this.presensiList.filter(p => actIds.includes(String(p.kegiatanId)));
                    const hadir = records.reduce((s, r) => s + (Number(r.hadir) || 0), 0);
                    const izin = records.reduce((s, r) => s + (Number(r.izin) || 0), 0);
                    const alfa = records.reduce((s, r) => s + (Number(r.alfa) || 0), 0);
                    const total = hadir + izin + alfa;
                    const pct = (v) => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
                    return {
                        label: bln,
                        kelompokCount: `${records.length} Laporan`,
                        hadir, izin, alfa, total,
                        hadirPct: pct(hadir),
                        izinPct: pct(izin),
                        alfaPct: pct(alfa)
                    };
                });
            }
        },

        switchToEvaluasi() {
            this.activeTab = 'evaluasi';
            this.$nextTick(() => this.renderCharts());
        },

        async fetchServerData() {
            this.loading = true;
            try {
                let response = await fetch(`${API_URL}?action=getData`);
                let data = await response.json();
                this.masterWilayah = data.masterWilayah || {};
                
                // Format waktu agar selalu tampil Hari, Tanggal Bulan Tahun
                this.activities = (data.activities || []).map(act => ({
                    ...act,
                    waktu: this.formatTanggalIndo(act.waktu)
                }));
                
                this.presensiList = data.presensi || [];
                if (this.activeTab === 'evaluasi' && this.isAdmin) {
                    this.$nextTick(() => this.renderCharts());
                }
            } catch (error) {
                console.error('Gagal mengambil data:', error);
                alert('Gagal terhubung ke database Google Sheets.');
            } finally {
                this.loading = false;
            }
        },

        async submitAdminLogin() {
            try {
                let response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'verifyAdmin', password: this.adminPasswordInput })
                });
                let result = await response.json();
                if (result.isValid) {
                    this.isAdmin = true;
                    // Simpan status login agar tidak perlu selalu login ulang
                    localStorage.setItem('kmm_admin_logged_in', 'true');
                    this.showLoginModal = false;
                    this.adminPasswordInput = '';
                    alert('Login Admin Berhasil!');
                } else {
                    alert('Password Salah!');
                }
            } catch (error) {
                alert('Terjadi kesalahan koneksi.');
            }
        },

        logoutAdmin() {
            this.isAdmin = false;
            localStorage.removeItem('kmm_admin_logged_in');
            this.activeTab = 'beranda';
        },

        openAddActivityModal() {
            this.formActivity = { nama: '', tanggalRaw: '', waktu: '', tempat: '' };
            this.showAddModal = true;
        },

        async saveNewActivity() {
            if (!this.formActivity.waktu) {
                this.updateFormattedDate();
            }
            this.submitting = true;
            try {
                let response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: 'addActivity', 
                        payload: {
                            nama: this.formActivity.nama,
                            waktu: this.formActivity.waktu,
                            tempat: this.formActivity.tempat
                        } 
                    })
                });
                let result = await response.json();
                if (result.success) {
                    this.showAddModal = false;
                    await this.fetchServerData();
                    alert('Kegiatan berhasil ditambahkan!');
                }
            } catch (error) {
                alert('Gagal menyimpan kegiatan.');
            } finally {
                this.submitting = false;
            }
        },

        openPresensiModal(act) {
            this.selectedActivity = act;
            let existing = this.getPresensiRecord(act.id, this.selectedDesa, this.selectedKelompok);
            if (existing) {
                this.formPresensi = { 
                    hadir: existing.hadir > 0 ? existing.hadir : '', 
                    izin: existing.izin > 0 ? existing.izin : '', 
                    alfa: existing.alfa > 0 ? existing.alfa : '' 
                };
            } else {
                this.formPresensi = { hadir: '', izin: '', alfa: '' };
            }
            this.showPresensiModal = true;
        },

        async submitPresensiData() {
            this.submitting = true;
            let payload = {
                kegiatanId: this.selectedActivity.id,
                desa: this.selectedDesa,
                kelompok: this.selectedKelompok,
                hadir: this.formPresensi.hadir === '' ? 0 : Number(this.formPresensi.hadir),
                izin: this.formPresensi.izin === '' ? 0 : Number(this.formPresensi.izin),
                alfa: this.formPresensi.alfa === '' ? 0 : Number(this.formPresensi.alfa)
            };

            try {
                let response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'submitPresensi', payload: payload })
                });
                let result = await response.json();
                if (result.success) {
                    this.showPresensiModal = false;
                    await this.fetchServerData();
                    alert('Presensi berhasil tersimpan!');
                }
            } catch (error) {
                alert('Gagal menyimpan presensi.');
            } finally {
                this.submitting = false;
            }
        },

        getPresensiRecord(kegiatanId, desa, kelompok) {
            return this.presensiList.find(p => String(p.kegiatanId) === String(kegiatanId) && p.desa === desa && p.kelompok === kelompok);
        },

        getFilledCount(kegiatanId) {
            return this.presensiList.filter(p => String(p.kegiatanId) === String(kegiatanId)).length;
        },

        renderCharts() {
            const stats = this.evalStats;
            const list = this.filteredEvalPresensi;

            const ctx1 = document.getElementById('attendanceChart');
            if (ctx1) {
                if (window.myAttChart) window.myAttChart.destroy();
                window.myAttChart = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: [
                            `Hadir (${stats.hadirPct}%)`, 
                            `Izin (${stats.izinPct}%)`, 
                            `Alfa (${stats.alfaPct}%)`
                        ],
                        datasets: [{ 
                            data: [stats.hadir, stats.izin, stats.alfa], 
                            backgroundColor: ['#059669', '#f59e0b', '#e11d48'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }

            const desaNames = Object.keys(this.masterWilayah);
            const dataHadirDesa = desaNames.map(d => list.filter(p => p.desa === d).reduce((s, r) => s + (Number(r.hadir) || 0), 0));
            const dataIzinDesa = desaNames.map(d => list.filter(p => p.desa === d).reduce((s, r) => s + (Number(r.izin) || 0), 0));
            const dataAlfaDesa = desaNames.map(d => list.filter(p => p.desa === d).reduce((s, r) => s + (Number(r.alfa) || 0), 0));

            const ctx2 = document.getElementById('desaChart');
            if (ctx2) {
                if (window.myDesaChart) window.myDesaChart.destroy();
                window.myDesaChart = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: desaNames,
                        datasets: [
                            { label: 'Hadir', data: dataHadirDesa, backgroundColor: '#059669', borderRadius: 4 },
                            { label: 'Izin', data: dataIzinDesa, backgroundColor: '#f59e0b', borderRadius: 4 },
                            { label: 'Alfa', data: dataAlfaDesa, backgroundColor: '#e11d48', borderRadius: 4 }
                        ]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        scales: { 
                            x: { stacked: true },
                            y: { stacked: true, beginAtZero: true } 
                        },
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }
        }
    };
}
