import { supabase } from '/config/supabase.js';

const WASENDER_API_KEY = '50021fcdb8bb9825a200cbda9a944ea6bbcf4c5454e7512cf12cff23ddc9dd56'; // Ganti API key kamu (dari app.wasender.dev)
const WASENDER_ENDPOINT = 'https://app.wasender.dev/api/send-message';
const NOMOR_ADMIN_WA = '6283872851796'; // Ganti nomor WA admin

document.addEventListener('DOMContentLoaded', () => {
    cekAdminSession();
});

function cekAdminSession() {
    const sesi = JSON.parse(localStorage.getItem('sesiAdmin') || 'null');
    if (sesi) {
        document.getElementById('adminLoginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadPesananData();
        loadSellerReqData();
        loadProdukData();
        loadInfoData();
        loadGaleriData();
    } else {
        document.getElementById('adminLoginScreen').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
    }
}

// LOGIN / LOGOUT ADMIN — dicek dari tabel users (role = 'admin')
document.getElementById('formAdminLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let noWa = document.getElementById('adminWa').value.trim();
    const pass = document.getElementById('adminPass').value;
    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);

    const { data, error } = await supabase.from('users').select('*').eq('no_wa', noWa).eq('password', pass).eq('role', 'admin').maybeSingle();

    if (error || !data) {
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Nomor WA atau Password Admin salah!' });
        return;
    }

    localStorage.setItem('sesiAdmin', JSON.stringify(data));
    Swal.fire({ icon: 'success', title: 'Login Admin Berhasil', timer: 1000, showConfirmButton: false });
    cekAdminSession();
});

document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
    localStorage.removeItem('sesiAdmin');
    location.reload();
});

function formatRupiah(angka) { return 'Rp ' + Number(angka || 0).toLocaleString('id-ID'); }

// ================= 1. PESANAN MASUK (SEMUA SELLER) =================
window.loadPesananData = async function () {
    const table = document.getElementById('listPesananTable');
    const filterTanggal = document.getElementById('filterPesananAdmin')?.value;

    table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8;">Memuat data pesanan...</td></tr>`;

    const { data, error } = await supabase.from('pesanan').select('*, seller:seller_id(nama)').order('id', { ascending: false });

    if (error || !data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Belum ada pesanan.</td></tr>`;
        return;
    }

    const filteredData = data.filter(item => !filterTanggal || new Date(item.created_at).toDateString() === new Date(filterTanggal).toDateString());

    if (filteredData.length === 0) {
        table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Tidak ada pesanan untuk tanggal ini.</td></tr>`;
        return;
    }

    const statusOptions = ['Menunggu', 'Diproses', 'Selesai', 'Batal'];

    table.innerHTML = filteredData.map(item => `
        <tr>
            <td>${new Date(item.created_at).toLocaleString('id-ID')}</td>
            <td><b>${item.nama_pembeli}</b></td>
            <td>${item.seller?.nama || '-'}</td>
            <td><a href="https://wa.me/${item.no_wa}" target="_blank" style="color:#38bdf8; text-decoration:none;">${item.no_wa}</a></td>
            <td>${(item.items || []).map(i => `${i.nama} x${i.qty}`).join(', ')}</td>
            <td>${formatRupiah(item.total)}</td>
            <td>
                <select class="status-select" onchange="ubahStatusPesanan(${item.id}, this.value)">
                    ${statusOptions.map(s => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
        </tr>
    `).join('');
};

window.ubahStatusPesanan = async function (id, status) {
    const { error } = await supabase.from('pesanan').update({ status }).eq('id', id);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Update Status', text: error.message });
    } else {
        Swal.fire({ icon: 'success', title: 'Status Diperbarui', timer: 800, showConfirmButton: false });
    }
};

// ================= 2. PERMINTAAN SELLER =================
async function loadSellerReqData() {
    const pendingTable = document.getElementById('listSellerReqTable');
    const aktifTable = document.getElementById('listSellerAktifTable');

    const { data } = await supabase.from('users').select('*').order('id', { ascending: false });
    if (!data) return;

    const pending = data.filter(u => u.seller_status === 'pending');
    const aktif = data.filter(u => u.role === 'seller' && u.seller_status === 'approved');

    pendingTable.innerHTML = pending.length > 0 ? pending.map(u => `
        <tr>
            <td><b>${u.nama}</b></td>
            <td><a href="https://wa.me/${u.no_wa}" target="_blank" style="color:#38bdf8; text-decoration:none;">${u.no_wa}</a></td>
            <td>${new Date(u.created_at).toLocaleDateString('id-ID')}</td>
            <td style="display:flex; gap:6px;">
                <button class="btn-primary" style="width:auto; padding:8px 12px; font-size:11px;" onclick="setujuiSeller(${u.id})">Setujui</button>
                <button class="btn-danger" onclick="tolakSeller(${u.id})">Tolak</button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align:center; color:#64748b;">Tidak ada pengajuan baru.</td></tr>`;

    aktifTable.innerHTML = aktif.length > 0 ? aktif.map(u => `
        <tr>
            <td><b>${u.nama}</b></td>
            <td><a href="https://wa.me/${u.no_wa}" target="_blank" style="color:#38bdf8; text-decoration:none;">${u.no_wa}</a></td>
            <td>
                <span class="status-pill ${u.seller_verified ? 'status-Selesai' : 'status-Menunggu'}" style="cursor:pointer;" onclick="toggleVerifiedSeller(${u.id}, ${u.seller_verified})">
                    ${u.seller_verified ? 'Terverifikasi' : 'Belum'}
                </span>
            </td>
            <td><button class="btn-danger" onclick="cabutSeller(${u.id})">Cabut Akses</button></td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada seller aktif.</td></tr>`;
}

window.setujuiSeller = async function (id) {
    const { error } = await supabase.from('users').update({ role: 'seller', seller_status: 'approved' }).eq('id', id);
    if (error) { Swal.fire({ icon: 'error', title: 'Gagal', text: error.message }); return; }
    Swal.fire({ icon: 'success', title: 'Seller Disetujui', timer: 1000, showConfirmButton: false });
    loadSellerReqData();
};

window.tolakSeller = async function (id) {
    const { error } = await supabase.from('users').update({ seller_status: 'rejected' }).eq('id', id);
    if (error) { Swal.fire({ icon: 'error', title: 'Gagal', text: error.message }); return; }
    Swal.fire({ icon: 'success', title: 'Pengajuan Ditolak', timer: 1000, showConfirmButton: false });
    loadSellerReqData();
};

window.toggleVerifiedSeller = async function (id, statusSaatIni) {
    await supabase.from('users').update({ seller_verified: !statusSaatIni }).eq('id', id);
    loadSellerReqData();
};

window.cabutSeller = async function (id) {
    if (!confirm('Cabut akses seller user ini? Produknya tetap ada tapi dia kembali jadi buyer biasa.')) return;
    await supabase.from('users').update({ role: 'buyer', seller_status: null }).eq('id', id);
    loadSellerReqData();
};

// ================= 3. MODERASI PRODUK (semua seller) =================
window.loadProdukData = async function () {
    const table = document.getElementById('listProdukTable');
    const { data } = await supabase.from('produk').select('*, seller:seller_id(nama)').order('id', { ascending: false });

    if (data && data.length > 0) {
        table.innerHTML = data.map(p => `
            <tr>
                <td><img class="product-thumb" src="${p.gambar_url || 'https://placehold.co/80x80/1e293b/38bdf8?text=P'}"><b>${p.nama}</b></td>
                <td>${p.seller?.nama || '-'}</td>
                <td>${p.kategori || '-'}</td>
                <td>${formatRupiah(p.harga)}</td>
                <td>${p.stok}</td>
                <td><span class="status-pill ${p.aktif ? 'status-Selesai' : 'status-Batal'}" style="cursor:pointer;" onclick="toggleAktifProduk(${p.id}, ${p.aktif})">${p.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
                <td><button class="btn-danger" onclick="hapusProduk(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
    } else {
        table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Belum ada produk.</td></tr>`;
    }
};

window.toggleAktifProduk = async function (id, statusSaatIni) {
    await supabase.from('produk').update({ aktif: !statusSaatIni }).eq('id', id);
    loadProdukData();
};

window.hapusProduk = async function (id) {
    if (confirm('Yakin ingin menghapus produk ini? (moderasi — biasanya karena melanggar aturan)')) {
        await supabase.from('produk').delete().eq('id', id);
        loadProdukData();
    }
};

// ================= 4. INFO & PROMO =================
async function loadInfoData() {
    const list = document.getElementById('adminInfoList');
    const { data } = await supabase.from('info_toko').select('*').order('id', { ascending: false });

    if (data && data.length > 0) {
        list.innerHTML = data.map(info => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 14px; color: #38bdf8;">${info.judul}</div>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${info.isi}</p>
                </div>
                <button class="btn-danger" onclick="hapusInfo(${info.id})" style="margin-left: 10px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    } else {
        list.innerHTML = `<p style="font-size: 12px; color: #64748b;">Belum ada info/promo.</p>`;
    }
}

document.getElementById('formTambahInfo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const judul = document.getElementById('addInfoJudul').value.trim();
    const isi = document.getElementById('addInfoIsi').value.trim();

    const { error } = await supabase.from('info_toko').insert([{ judul, isi }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
    } else {
        Swal.fire({ icon: 'success', title: 'Info Dipublikasikan', timer: 1000, showConfirmButton: false });
        document.getElementById('formTambahInfo').reset();
        loadInfoData();
    }
});

window.hapusInfo = async function (id) {
    if (confirm('Hapus info/promo ini?')) {
        await supabase.from('info_toko').delete().eq('id', id);
        loadInfoData();
    }
};

// ================= 5. GALERI / TESTIMONI =================
async function loadGaleriData() {
    const grid = document.getElementById('adminGaleriGrid');
    const { data } = await supabase.from('galeri_toko').select('*').order('id', { ascending: false });

    if (data && data.length > 0) {
        grid.innerHTML = data.map(g => `
            <div class="admin-memory-item">
                <img src="${g.foto_url}" alt="Galeri">
                <div class="admin-memory-info">
                    <div style="font-weight: 700; font-size: 12px;">${g.judul}</div>
                    <p style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${g.deskripsi || ''}</p>
                    <button class="btn-danger" onclick="hapusGaleri(${g.id})" style="width: 100%; margin-top: 8px;"><i class="fa-solid fa-trash"></i> Hapus</button>
                </div>
            </div>
        `).join('');
    } else {
        grid.innerHTML = `<p style="font-size: 12px; color: #64748b; grid-column: 1 / -1;">Belum ada galeri.</p>`;
    }
}

document.getElementById('formTambahGaleri')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const judul = document.getElementById('addGalJudul').value.trim();
    const foto_url = document.getElementById('addGalFotoUrl').value.trim();
    const deskripsi = document.getElementById('addGalDeskripsi').value.trim();

    const { error } = await supabase.from('galeri_toko').insert([{ judul, foto_url, deskripsi }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
    } else {
        Swal.fire({ icon: 'success', title: 'Foto Ditambahkan', timer: 1000, showConfirmButton: false });
        document.getElementById('formTambahGaleri').reset();
        loadGaleriData();
    }
});

window.hapusGaleri = async function (id) {
    if (confirm('Hapus foto ini?')) {
        await supabase.from('galeri_toko').delete().eq('id', id);
        loadGaleriData();
    }
};

// ================= 6. NOTIF REALTIME KE PENGUNJUNG =================
document.getElementById('formKirimNotif')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const judul = document.getElementById('notifAdminJudul').value.trim();
    const pesan = document.getElementById('notifAdminPesan').value.trim();
    const btn = document.getElementById('btnBroadcast');

    btn.innerText = "Mengirim...";
    btn.disabled = true;

    const { error } = await supabase.from('notif_toko').insert([{ judul, pesan }]);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
    } else {
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Notifikasi berhasil dikirim ke seluruh pengunjung yang sedang online.', timer: 1500, showConfirmButton: false });
        document.getElementById('formKirimNotif').reset();
    }

    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Notifikasi Sekarang`;
    btn.disabled = false;
});

// ================= 7. CETAK EXCEL PESANAN & KIRIM WA =================
window.cetakLaporanExcel = async function () {
    Swal.fire({ title: 'Memproses Excel...', text: 'Mengambil data...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const { data, error } = await supabase.from('pesanan').select('*, seller:seller_id(nama)').order('id', { ascending: false });
        if (error) throw error;

        const filterTanggal = document.getElementById('filterPesananAdmin')?.value;
        let finalData = data;
        if (filterTanggal) {
            finalData = data.filter(item => new Date(item.created_at).toDateString() === new Date(filterTanggal).toDateString());
        }

        if (!finalData || finalData.length === 0) {
            Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada pesanan untuk dicetak.' });
            return;
        }

        const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let tableRows = finalData.map((item, index) => `
            <tr>
                <td style="border: 1px solid #000; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #000;">${new Date(item.created_at).toLocaleString('id-ID')}</td>
                <td style="border: 1px solid #000;">${item.nama_pembeli}</td>
                <td style="border: 1px solid #000;">${item.seller?.nama || '-'}</td>
                <td style="border: 1px solid #000;">${item.no_wa}</td>
                <td style="border: 1px solid #000;">${(item.items || []).map(i => `${i.nama} x${i.qty}`).join(', ')}</td>
                <td style="border: 1px solid #000; text-align: right;">${formatRupiah(item.total)}</td>
                <td style="border: 1px solid #000; text-align: center;">${item.status}</td>
            </tr>
        `).join('');

        let excelDoc = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style> table { border-collapse: collapse; } th, td { font-family: Arial, sans-serif; } th { background-color: #d1d5db; font-weight: bold; border: 1px solid #000; } </style>
            </head>
            <body>
                <table>
                    <tr><td colspan="8" style="text-align: center; font-size: 16px; font-weight: bold;">LAPORAN PESANAN TOKO</td></tr>
                    <tr><td colspan="8" style="text-align: right; font-size: 11px;">Dicetak pada: ${tanggalCetak}</td></tr>
                    <tr></tr>
                    <tr><th>No</th><th>Waktu</th><th>Pembeli</th><th>Seller</th><th>No WA</th><th>Item</th><th>Total</th><th>Status</th></tr>
                    ${tableRows}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', excelDoc], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const namaFileTanggal = filterTanggal ? `_${filterTanggal}` : '';
        a.href = url;
        a.download = `Laporan_Pesanan${namaFileTanggal}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const totalOmzet = finalData.reduce((sum, i) => sum + Number(i.total || 0), 0);
        const pesanWA =
            `*📊 LAPORAN PESANAN (EXCEL) BERHASIL DICETAK*\n\n` +
            `📅 Filter Tanggal: *${filterTanggal || 'Semua Waktu'}*\n` +
            `📝 Total Pesanan: *${finalData.length}*\n` +
            `💰 Total Omzet: *${formatRupiah(totalOmzet)}*\n` +
            `⏰ Tanggal Cetak: ${tanggalCetak}\n\n` +
            `_File Excel (.xls) telah diunduh otomatis ke perangkat admin._`;

        await fetch(WASENDER_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_API_KEY}` },
            body: JSON.stringify({ to: NOMOR_ADMIN_WA, text: pesanWA })
        }).catch(err => console.error('Wasender Error:', err));

        Swal.fire({ icon: 'success', title: 'Berhasil Cetak & Kirim WA!', text: 'File Excel (.xls) telah diunduh dan notifikasi terkirim via WhatsApp.' });

    } catch (err) {
        console.error("Gagal mencetak Excel:", err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
};

// SWITCH TAB MENU ADMIN
window.switchAdminTab = function (tabName, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab' + tabName).classList.add('active');
    if (el) el.classList.add('active');
};
