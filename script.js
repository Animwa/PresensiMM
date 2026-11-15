function appData() {
    return {
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

        // Data dinamis yang diambil dari Spreadsheet
        masterWilayah: {},
        activities: [],
        presensiList: [],

        formActivity: {
            nama: '',
            waktu: '',
            tempat: ''
        },

        formPresensi: {
            hadir: 0,
            izin: 0,
            alfa: 0
        },

        initData() {
            // Shortcut Keyboard: Ctrl + Alt + M untuk Login Admin
            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.altKey && (e.key === 'm' || e.key === 'M')) {
                    e.preventDefault();
                    this.showLoginModal = true;
                }
            });

            // Proteksi klik kanan
            document.addEventListener('contextmenu', event => event.preventDefault());

            this.fetchServerData();
        },

        // Trigger tersembunyi: 5 kali klik pada logo/judul beranda
        handleLogoClick() {
            this.logoClickCount++;
            clearTimeout(this.logoClickTimer);
            
            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.showLoginModal = true;
            } else {
                this.logoClickTimer = setTimeout(() => {
                    this.logoClickCount = 0;
                }, 2000);
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

        fetchServerData() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler((data) => {
                        this.masterWilayah = data.masterWilayah || {};
                        this.activities = data.activities || [];
                        this.presensiList = data.presensi || [];
                    })
                    .getAppData();
            } else {
                // Mock data untuk pengujian offline lokal
                this.masterWilayah = {
                    "Banjarharjo": ["Mojotelu Timur", "Mojotelu Barat", "Babatok Selatan"],
                    "Kaling": ["Sarirejo", "Alastuwo"]
                };
                this.activities = [
                    { id: 'ACT_1', nama: 'Pengajian Rutin', waktu: '20 Jun 2026, 19:30', tempat: 'Aula Desa' }
                ];
                this.presensiList = [];
            }
        },

        submitAdminLogin() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler((isValid) => {
                        if (isValid) {
                            this.isAdmin = true;
                            this.showLoginModal = false;
                            this.adminPasswordInput = '';
                            alert('Login Admin Berhasil!');
                        } else {
                            alert('Password Salah!');
                        }
                    })
                    .verifyAdmin(this.adminPasswordInput);
            } else {
                if (this.adminPasswordInput === 'admin123') {
                    this.isAdmin = true;
                    this.showLoginModal = false;
                    this.adminPasswordInput = '';
                    alert('Login Admin Berhasil (Simulasi)!');
                } else {
                    alert('Password Salah!');
                }
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

        saveNewActivity() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(() => {
                        this.showAddModal = false;
                        this.fetchServerData();
                        alert('Kegiatan berhasil ditambahkan ke Spreadsheet!');
                    })
                    .addActivity(this.formActivity);
            } else {
                this.activities.push({
                    id: 'ACT_' + Date.now(),
                    ...this.formActivity
                });
                this.showAddModal = false;
                alert('Kegiatan berhasil ditambahkan (Lokal)!');
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

        submitPresensiData() {
            let payload = {
                kegiatanId: this.selectedActivity.id,
                desa: this.selectedDesa,
                kelompok: this.selectedKelompok,
                ...this.formPresensi
            };

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(() => {
                        this.showPresensiModal = false;
                        this.fetchServerData();
                        alert('Presensi berhasil disimpan ke Spreadsheet!');
                    })
                    .submitPresensi(payload);
            } else {
                let idx = this.presensiList.findIndex(p => p.kegiatanId === payload.kegiatanId && p.desa === payload.desa && p.kelompok === payload.kelompok);
                if (idx >= 0) {
                    this.presensiList[idx] = { id: this.presensiList[idx].id, ...payload };
                } else {
                    this.presensiList.push({ id: 'PRS_' + Date.now(), ...payload });
                }
                this.showPresensiModal = false;
                alert('Presensi berhasil disimpan (Lokal)!');
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

            // Chart 1: Kehadiran Keseluruhan
            const ctx1 = document.getElementById('attendanceChart');
            if (ctx1) {
                if (window.myAttChart) window.myAttChart.destroy();
                window.myAttChart = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: ['Hadir', 'Izin', 'Alfa'],
                        datasets: [{
                            data: [totalHadir, totalIzin, totalAlfa],
                            backgroundColor: ['#059669', '#d97706', '#e11d48']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }

            // Chart 2: Pengisian per Desa
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
                        datasets: [{
                            label: 'Jumlah Laporan Masuk',
                            data: Object.values(desaCounts),
                            backgroundColor: '#0d9488'
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
                });
            }
        }
    };
}
