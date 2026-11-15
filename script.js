// ==========================================
// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbzpLfrCmrKH1xKiEyRwBx35F1fGU8WYkvs0mskFnb6V38OE41IDXk2fAiPtaebucum6/exec";

function appData() {
    return {
        loading: true,
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

        masterWilayah: {},
        activities: [],
        presensiList: [],

        formActivity: { nama: '', waktu: '', tempat: '' },
        formPresensi: { hadir: 0, izin: 0, alfa: 0 },

        initData() {
            // Shortcut Keyboard: Ctrl + Alt + M untuk Login Admin
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

        getTotalKelompokCount() {
            let total = 0;
            for (let desa in this.masterWilayah) {
                total += this.masterWilayah[desa].length;
            }
            return total;
        },

        async fetchServerData() {
            this.loading = true;
            try {
                let response = await fetch(`${API_URL}?action=getData`);
                let data = await response.json();
                this.masterWilayah = data.masterWilayah || {};
                this.activities = data.activities || [];
                this.presensiList = data.presensi || [];
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
            this.activeTab = 'beranda';
            alert('Anda telah keluar dari mode admin.');
        },

        openAddActivityModal() {
            this.formActivity = { nama: '', waktu: '', tempat: '' };
            this.showAddModal = true;
        },

        async saveNewActivity() {
            try {
                let response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'addActivity', payload: this.formActivity })
                });
                let result = await response.json();
                if (result.success) {
                    this.showAddModal = false;
                    this.fetchServerData();
                    alert('Kegiatan berhasil ditambahkan!');
                }
            } catch (error) {
                alert('Gagal menyimpan kegiatan.');
            }
        },

        openPresensiModal(act) {
            this.selectedActivity = act;
            let existing = this.getPresensiRecord(act.id, this.selectedDesa, this.selectedKelompok);
            if (existing) {
                this.formPresensi = { hadir: existing.hadir, izin: existing.izin, alfa: existing.alfa };
            } else {
                this.formPresensi = { hadir: 0, izin: 0, alfa: 0 };
            }
            this.showPresensiModal = true;
        },

        async submitPresensiData() {
            let payload = {
                kegiatanId: this.selectedActivity.id,
                desa: this.selectedDesa,
                kelompok: this.selectedKelompok,
                ...this.formPresensi
            };

            try {
                let response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'submitPresensi', payload: payload })
                });
                let result = await response.json();
                if (result.success) {
                    this.showPresensiModal = false;
                    this.fetchServerData();
                    alert('Presensi berhasil disimpan!');
                }
            } catch (error) {
                alert('Gagal menyimpan presensi.');
            }
        },

        getPresensiRecord(kegiatanId, desa, kelompok) {
            return this.presensiList.find(p => p.kegiatanId === kegiatanId && p.desa === desa && p.kelompok === kelompok);
        },

        getFilledCount(kegiatanId) {
            return this.presensiList.filter(p => p.kegiatanId === kegiatanId).length;
        },

        renderCharts() {
            let totalHadir = this.presensiList.reduce((acc, curr) => acc + curr.hadir, 0);
            let totalIzin = this.presensiList.reduce((acc, curr) => acc + curr.izin, 0);
            let totalAlfa = this.presensiList.reduce((acc, curr) => acc + curr.alfa, 0);

            const ctx1 = document.getElementById('attendanceChart');
            if (ctx1) {
                if (window.myAttChart) window.myAttChart.destroy();
                window.myAttChart = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: ['Hadir', 'Izin', 'Alfa'],
                        datasets: [{ data: [totalHadir, totalIzin, totalAlfa], backgroundColor: ['#059669', '#d97706', '#e11d48'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }

            let desaCounts = {};
            for (let desa in this.masterWilayah) {
                desaCounts[desa] = this.presensiList.filter(p => p.desa === desa).length;
            }

            const ctx2 = document.getElementById('desaChart');
            if (ctx2) {
                if (window.myDesaChart) window.myDesaChart.destroy();
                window.myDesaChart = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(desaCounts),
                        datasets: [{ label: 'Laporan Masuk', data: Object.values(desaCounts), backgroundColor: '#0d9488' }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
                });
            }
        }
    };
}
