import { supabase } from '/config/supabase.js';

// ================= KONFIGURASI TOKO =================
const NAMA_TOKO = "Rama Store";
const TAGLINE_TOKO = "Belanja gampang, proses cepat";
const NOMOR_ADMIN_WA = "6283872851796"; // Ganti nomor WA admin di sini
//const WASENDER_API_KEY = 'wsm_wc8H2V1Be9DGkcxeFhERIYbftqp92zZ186cH53IrecQXbRin'; // Ganti API key kamu (dari app.wasender.dev)
//const WASENDER_ENDPOINT = 'https://app.wasender.dev/api/send-message';

// Pembayaran cuma DANA
const NOMOR_DANA = "6283872851796"; // Ganti nomor DANA tujuan pembayaran
const NAMA_PEMILIK_DANA = "Rama A'nur Maulana"; // Ganti nama pemilik akun DANA

let currentLang = localStorage.getItem('appLang') || 'id';
let sesiUser = JSON.parse(localStorage.getItem('sesiUser') || 'null');

let daftarProduk = [];
let daftarKategori = ['Semua'];
let kategoriAktif = 'Semua';
let cart = JSON.parse(localStorage.getItem('cartToko') || '[]');
let ratingSummaryMap = {}; // seller_id -> {avg, count}

document.addEventListener('DOMContentLoaded', () => {
    if (sesiUser) {
        masukKeApp();
    } else {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// ================= AUTH =================
window.switchAuthTab = function (tab, el) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(tab === 'login' ? 'formLogin' : 'formRegister').classList.add('active');
};

document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('regNama').value.trim();
    let noWa = document.getElementById('regWa').value.trim();
    const password = document.getElementById('regPassword').value;
    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);

    const spinner = document.getElementById('registerSpinner');
    spinner.style.display = 'inline-block';

    const { data: existing } = await supabase.from('users').select('id').eq('no_wa', noWa).maybeSingle();
    if (existing) {
        spinner.style.display = 'none';
        Swal.fire({ icon: 'error', title: 'Nomor Sudah Terdaftar', text: 'Nomor WA ini sudah punya akun, silakan Masuk.' });
        return;
    }

    const { data, error } = await supabase.from('users').insert([{ nama, no_wa: noWa, password, role: 'buyer' }]).select().single();
    spinner.style.display = 'none';

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Daftar', text: error.message });
        return;
    }

    sesiUser = data;
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    Swal.fire({ icon: 'success', title: 'Pendaftaran Berhasil!', timer: 1000, showConfirmButton: false });
    masukKeApp();
});

document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let noWa = document.getElementById('loginWa').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);

    const spinner = document.getElementById('loginSpinner');
    spinner.style.display = 'inline-block';

    const { data, error } = await supabase.rpc('login_user', { p_no_wa: noWa, p_password: password });
    spinner.style.display = 'none';

    if (error || !data || data.length === 0) {
        Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'Nomor WA atau password salah.' });
        return;
    }

    sesiUser = data[0];
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    masukKeApp();
});

window.logout = function () {
    localStorage.removeItem('sesiUser');
    sesiUser = null;
    location.reload();
};

function masukKeApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    document.getElementById('txtStoreName').innerText = NAMA_TOKO;
    document.getElementById('txtStoreTagline').innerText = TAGLINE_TOKO;
    document.getElementById('linkWaCs').href = `https://wa.me/${NOMOR_ADMIN_WA}?text=${encodeURIComponent('Halo admin, saya mau tanya-tanya')}`;

    segarkanSesiUser().then(() => {
        renderProfile();
        loadProduk();
        loadInfoToko();
        loadGaleri();
        renderCart();
        loadPesananSaya();
        loadStats();
        loadDaftarChat();
        dengarkanNotifRealtime();
    });
}

// Ambil ulang data user terbaru dari database (kolom password sengaja ga
// diminta karena udah ga bisa dibaca lewat API biasa), biar kalau admin baru
// approve jadi seller (atau ubah data lain), browser ga kepake data lama dari cache.
async function segarkanSesiUser() {
    const { data } = await supabase
        .from('users')
        .select('id, no_wa, nama, avatar_url, bio, asal, umur, nomor_dana, role, seller_status, seller_verified, wa_verified, created_at')
        .eq('id', sesiUser.id)
        .maybeSingle();
    if (data) {
        sesiUser = { ...sesiUser, ...data };
        localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    }
}

function formatRupiah(angka) { return 'Rp ' + Number(angka || 0).toLocaleString('id-ID'); }

// ================= NAVIGASI TAB UTAMA =================
window.switchTab = function (tabName, el) {
    document.querySelectorAll('#mainApp > .tab-content, #tabAkun.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('tab' + tabName).classList.add('active');
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.switchSellerTab = function (tabName, el) {
    document.querySelectorAll('.subtab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.seller-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('seller' + tabName).classList.add('active');
    el.classList.add('active');
};

// ================= PROFIL & AKUN =================
function renderProfile() {
    const avatarInitial = document.getElementById('avatarInitial');
    const avatarImg = document.getElementById('avatarImg');
    if (sesiUser.avatar_url) {
        avatarImg.src = sesiUser.avatar_url;
        avatarImg.style.display = 'block';
        avatarInitial.style.display = 'none';
    } else {
        avatarInitial.innerText = (sesiUser.nama || '?').charAt(0).toUpperCase();
        avatarInitial.style.display = 'flex';
        avatarImg.style.display = 'none';
    }
    document.getElementById('profileNama').childNodes[0].nodeValue = sesiUser.nama + ' ';
    document.getElementById('profileWa').innerText = sesiUser.no_wa;
    document.getElementById('profileBio').value = sesiUser.bio || '';
    document.getElementById('verifiedIcon').style.display = sesiUser.seller_verified ? 'inline-block' : 'none';

    document.getElementById('cardVerifWa').style.display = sesiUser.wa_verified ? 'none' : 'block';

    const badge = document.getElementById('profileRoleBadge');
    const cardAjukan = document.getElementById('cardAjukanSeller');
    const cardPending = document.getElementById('cardPendingSeller');
    const dashboard = document.getElementById('sellerDashboard');

    cardAjukan.style.display = 'none';
    cardPending.style.display = 'none';
    dashboard.style.display = 'none';

    if (sesiUser.role === 'seller' && sesiUser.seller_status === 'approved') {
        badge.className = 'role-badge seller';
        badge.innerText = 'Seller';
        dashboard.style.display = 'block';
        loadProdukSaya();
        loadPesananSeller();
    } else if (sesiUser.seller_status === 'pending') {
        badge.className = 'role-badge pending';
        badge.innerText = 'Menunggu';
        cardPending.style.display = 'block';
    } else {
        badge.className = 'role-badge buyer';
        badge.innerText = 'Buyer';
        cardAjukan.style.display = 'block';
    }
}

window.bukaFormAjukanSeller = function () {
    document.getElementById('asNama').value = sesiUser.nama || '';
    document.getElementById('asAsal').value = '';
    document.getElementById('asUmur').value = '';
    document.getElementById('asNomorDana').value = '';
    document.getElementById('ajukanSellerModal').style.display = 'flex';
};

window.tutupFormAjukanSeller = function () {
    document.getElementById('ajukanSellerModal').style.display = 'none';
};

document.getElementById('formAjukanSeller')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('asNama').value.trim();
    const asal = document.getElementById('asAsal').value.trim();
    const umur = Number(document.getElementById('asUmur').value);
    let nomorDana = document.getElementById('asNomorDana').value.trim();
    if (nomorDana.startsWith('0')) nomorDana = '62' + nomorDana.substring(1);

    const { error } = await supabase.from('users').update({
        nama, asal, umur, nomor_dana: nomorDana, seller_status: 'pending'
    }).eq('id', sesiUser.id);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        return;
    }

    sesiUser.nama = nama;
    sesiUser.asal = asal;
    sesiUser.umur = umur;
    sesiUser.nomor_dana = nomorDana;
    sesiUser.seller_status = 'pending';
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));

    document.getElementById('ajukanSellerModal').style.display = 'none';
    Swal.fire({ icon: 'success', title: 'Pengajuan Terkirim', text: 'Admin akan meninjau pengajuan kamu.' });
    renderProfile();
});

// ================= UPLOAD FOTO PROFIL & BIO =================
document.getElementById('avatarFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Swal.fire({ title: 'Mengunggah foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const ext = file.name.split('.').pop();
    const path = `user-${sesiUser.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
        Swal.fire({ icon: 'error', title: 'Gagal Upload', text: uploadError.message });
        return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatar_url = urlData.publicUrl;

    const { error: updateError } = await supabase.from('users').update({ avatar_url }).eq('id', sesiUser.id);
    if (updateError) {
        Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: updateError.message });
        return;
    }

    sesiUser.avatar_url = avatar_url;
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    renderProfile();
    Swal.fire({ icon: 'success', title: 'Foto Profil Diperbarui', timer: 1000, showConfirmButton: false });
});

window.simpanBio = async function () {
    const bio = document.getElementById('profileBio').value.trim();
    const { error } = await supabase.from('users').update({ bio }).eq('id', sesiUser.id);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        return;
    }
    sesiUser.bio = bio;
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    Swal.fire({ icon: 'success', title: 'Bio Disimpan', timer: 900, showConfirmButton: false });
};

// ================= VERIFIKASI NOMOR WA (OTP via Wasender) =================
window.bukaVerifWa = function () {
    document.getElementById('verifWaNomor').innerText = sesiUser.no_wa;
    document.getElementById('verifWaStep1').style.display = 'block';
    document.getElementById('verifWaStep2').style.display = 'none';
    document.getElementById('inputKodeOtp').value = '';
    document.getElementById('verifWaModal').style.display = 'flex';
};

window.tutupVerifWa = function () { document.getElementById('verifWaModal').style.display = 'none'; };

window.kirimKodeOtp = async function () {
    const btn = document.getElementById('btnKirimOtp');
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`; }

    const kode = String(Math.floor(100000 + Math.random() * 900000));

    const { error } = await supabase.from('otp_verifikasi').insert([{ user_id: sesiUser.id, kode }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Kirim Kode', text: error.message });
        if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Kode Sekarang'; }
        return;
    }

    const pesanWA = `*Kode Verifikasi Rama Store*\n\nKode kamu: *${kode}*\n\nJangan berikan kode ini ke siapa pun.`;
    fetch('/api/send-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: NOMOR_ADMIN_WA, text: pesanWA })
    }).catch(err => console.error('Wasender Error:', err));

    document.getElementById('verifWaStep1').style.display = 'none';
    document.getElementById('verifWaStep2').style.display = 'block';
    if (btn) { btn.disabled = false; btn.innerHTML = 'Kirim Kode Sekarang'; }
    Swal.fire({ icon: 'success', title: 'Kode Terkirim', text: 'Cek WhatsApp kamu ya.', timer: 1200, showConfirmButton: false });
};

window.cekKodeOtp = async function () {
    const kodeInput = document.getElementById('inputKodeOtp').value.trim();
    if (!kodeInput) return;

    const { data: berhasil, error } = await supabase.rpc('verifikasi_wa_dengan_otp', { p_user_id: sesiUser.id, p_kode: kodeInput });

    if (error || !berhasil) {
        Swal.fire({ icon: 'error', title: 'Kode Salah / Kedaluwarsa', text: 'Coba cek lagi kode-nya, atau minta kode baru ya.' });
        return;
    }

    sesiUser.wa_verified = true;
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    document.getElementById('verifWaModal').style.display = 'none';
    Swal.fire({ icon: 'success', title: 'Nomor WA Terverifikasi!', timer: 1200, showConfirmButton: false });
    renderProfile();
};

// ================= LUPA PASSWORD (reset via PIN WA) =================
window.bukaLupaPassword = function () {
    document.getElementById('lupaNoWa').value = '';
    document.getElementById('lupaNama').value = '';
    document.getElementById('lupaKodePin').value = '';
    document.getElementById('lupaPasswordBaru').value = '';
    document.getElementById('lupaStep1').style.display = 'block';
    document.getElementById('lupaStep2').style.display = 'none';
    document.getElementById('lupaPasswordModal').style.display = 'flex';
};

window.tutupLupaPassword = function () { document.getElementById('lupaPasswordModal').style.display = 'none'; };

window.kirimPinLupaPassword = async function () {
    let noWa = document.getElementById('lupaNoWa').value.trim();
    const nama = document.getElementById('lupaNama').value.trim();
    if (!noWa || !nama) { Swal.fire({ icon: 'warning', title: 'Lengkapi Dulu', text: 'Isi nomor WA dan nama lengkap sesuai pas daftar.' }); return; }
    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);

    const btn = document.getElementById('btnKirimPinLupa');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengecek...`;

    // Wajib nomor WA DAN nama cocok, biar orang ga bisa asal nebak nomor buat
    // mancing/nge-spam PIN ke WA orang lain.
    const { data: userDitemukan } = await supabase
        .from('users')
        .select('id')
        .eq('no_wa', noWa)
        .ilike('nama', nama)
        .maybeSingle();

    btn.disabled = false;
    btn.innerHTML = 'Kirim PIN';

    if (!userDitemukan) {
        // Sengaja pesannya generik, ga bilang spesifik "nomor ga ada" atau
        // "nama ga cocok" — biar ga jadi celah buat nebak-nebak akun orang.
        Swal.fire({ icon: 'info', title: 'Kalau Data Cocok...', text: 'PIN akan dikirim ke WA yang bersangkutan. Cek lagi nomor & nama kamu kalau belum nerima.' });
        return;
    }

    const kode = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase.from('otp_verifikasi').insert([{ user_id: userDitemukan.id, kode }]);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Kirim PIN', text: error.message });
        return;
    }

    const pesanWA = `*Reset Password Rama Store*\n\nPIN kamu: *${kode}*\n\nJangan berikan PIN ini ke siapa pun. Berlaku 10 menit.`;
    fetch('/api/send-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: noWa, text: pesanWA })
    }).catch(err => console.error('Wasender Error:', err));

    document.getElementById('lupaStep1').style.display = 'none';
    document.getElementById('lupaStep2').style.display = 'block';
    Swal.fire({ icon: 'success', title: 'PIN Terkirim', text: 'Cek WhatsApp kamu ya.', timer: 1200, showConfirmButton: false });
};

window.submitResetPassword = async function () {
    let noWa = document.getElementById('lupaNoWa').value.trim();
    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);
    const kode = document.getElementById('lupaKodePin').value.trim();
    const passwordBaru = document.getElementById('lupaPasswordBaru').value;

    if (!kode || !passwordBaru) {
        Swal.fire({ icon: 'warning', title: 'Lengkapi Dulu', text: 'Isi kode PIN dan password baru.' });
        return;
    }

    const { data: berhasil, error } = await supabase.rpc('reset_password_dengan_pin', {
        p_no_wa: noWa, p_kode: kode, p_password_baru: passwordBaru
    });

    if (error || !berhasil) {
        Swal.fire({ icon: 'error', title: 'PIN Salah / Kedaluwarsa', text: 'Coba cek lagi PIN-nya, atau minta PIN baru.' });
        return;
    }

    document.getElementById('lupaPasswordModal').style.display = 'none';
    Swal.fire({ icon: 'success', title: 'Password Berhasil Diganti', text: 'Silakan login pakai password baru kamu.' });
};

// ================= STATS DASHBOARD =================
async function loadStats() {
    const { count: akunTersedia } = await supabase.from('produk').select('*', { count: 'exact', head: true }).eq('aktif', true).gt('stok', 0);
    const { count: totalUser } = await supabase.from('users').select('id', { count: 'exact', head: true });
    const { data: pesananSelesai } = await supabase.from('pesanan').select('items').eq('status', 'Selesai');

    const akunTerjual = (pesananSelesai || []).reduce((sum, p) => sum + (p.items || []).reduce((s, i) => s + i.qty, 0), 0);

    document.getElementById('statAkunTersedia').innerText = akunTersedia || 0;
    document.getElementById('statAkunTerjual').innerText = akunTerjual;
    document.getElementById('statTotalUser').innerText = totalUser || 0;
}

// ================= 1. KATALOG PRODUK =================
async function loadProduk() {
    const { data, error } = await supabase
        .from('produk')
        .select('*, users:seller_id(nama, seller_verified, nomor_dana)')
        .eq('aktif', true)
        .order('id', { ascending: false });

    if (error || !data) {
        daftarProduk = [];
    } else {
        daftarProduk = data;
        daftarKategori = ['Semua', ...new Set(data.map(p => p.kategori).filter(Boolean))];
    }

    await loadRatingSummary();
    renderKategoriChips();
    renderGameGrid();
    renderProduk();
}

function renderGameGrid() {
    const grid = document.getElementById('gameGrid');
    const kategoriSaja = daftarKategori.filter(k => k !== 'Semua');
    if (kategoriSaja.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; font-size:11px; color:#64748b;">Belum ada kategori produk.</p>`;
        return;
    }
    grid.innerHTML = kategoriSaja.map(cat => `
        <div class="game-tile" onclick="pilihKategoriDariGrid('${cat.replace(/'/g, "\\'")}')">
            <div class="icon">${cat.charAt(0).toUpperCase()}</div>
            <div class="lbl">${cat}</div>
        </div>
    `).join('');
}

window.pilihKategoriDariGrid = function (cat) {
    kategoriAktif = cat;
    renderKategoriChips();
    renderProduk();
    document.getElementById('categoryScroll').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

async function loadRatingSummary() {
    const { data } = await supabase.from('rating_seller').select('seller_id, rating');
    ratingSummaryMap = {};
    (data || []).forEach(r => {
        if (!ratingSummaryMap[r.seller_id]) ratingSummaryMap[r.seller_id] = { total: 0, count: 0 };
        ratingSummaryMap[r.seller_id].total += r.rating;
        ratingSummaryMap[r.seller_id].count += 1;
    });
}

function renderStars(avg) {
    const rounded = Math.round(avg);
    let html = '<span class="stars">';
    for (let i = 1; i <= 5; i++) html += `<i class="fa-solid fa-star ${i > rounded ? 'empty' : ''}"></i>`;
    html += '</span>';
    return html;
}

function renderKategoriChips() {
    const wrap = document.getElementById('categoryScroll');
    wrap.innerHTML = daftarKategori.map(cat => `
        <div class="cat-chip ${cat === kategoriAktif ? 'active' : ''}" onclick="pilihKategori('${cat.replace(/'/g, "\\'")}', this)">${cat}</div>
    `).join('');
}

window.pilihKategori = function (cat, el) {
    kategoriAktif = cat;
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderProduk();
};

window.renderProduk = function () {
    const grid = document.getElementById('productGrid');
    const keyword = (document.getElementById('searchProduk').value || '').toLowerCase().trim();

    let hasil = daftarProduk.filter(p => {
        const cocokKategori = kategoriAktif === 'Semua' || p.kategori === kategoriAktif;
        const cocokKeyword = !keyword || p.nama.toLowerCase().includes(keyword);
        return cocokKategori && cocokKeyword;
    });

    if (hasil.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; font-size: 12px; color: #64748b; text-align: center; padding: 20px 0;">Produk tidak ditemukan.</p>`;
        return;
    }

    grid.innerHTML = hasil.map(p => {
        const rs = ratingSummaryMap[p.seller_id];
        const avg = rs ? rs.total / rs.count : 0;
        const namaSeller = p.users?.nama || 'Seller';
        const verified = p.users?.seller_verified;
        return `
        <div class="product-card" onclick="bukaDetail(${p.id})">
            <img src="${p.gambar_url || 'https://placehold.co/300x200/1e293b/38bdf8?text=Produk'}" alt="${p.nama}">
            <div class="product-body">
                <span class="product-cat">${p.kategori || 'Umum'}</span>
                <div class="product-name">${p.nama}</div>
                <div style="font-size: 10px; color: #94a3b8;">${namaSeller} ${verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
                ${rs ? `<div class="rating-summary">${renderStars(avg)} <span>${avg.toFixed(1)} (${rs.count})</span></div>` : ''}
                <div class="product-price">${formatRupiah(p.harga)}</div>
                <div class="product-stock ${p.stok <= 0 ? 'habis' : ''}">${p.stok > 0 ? 'Stok: ' + p.stok : 'Stok Habis'}</div>
                <div class="product-actions">
                    <button class="btn-add-cart" ${p.stok <= 0 ? 'disabled' : ''} onclick="event.stopPropagation(); tambahKeranjang(${p.id})"><i class="fa-solid fa-cart-plus"></i></button>
                    <button class="btn-buy-now" ${p.stok <= 0 ? 'disabled' : ''} onclick="event.stopPropagation(); beliSekarang(${p.id})">Beli</button>
                </div>
            </div>
        </div>`;
    }).join('');
};

// ================= 2. DETAIL PRODUK + RATING + KOMENTAR/QA =================
window.bukaDetail = async function (produkId) {
    const p = daftarProduk.find(x => x.id === produkId);
    if (!p) return;

    const rs = ratingSummaryMap[p.seller_id];
    const avg = rs ? rs.total / rs.count : 0;
    const namaSeller = p.users?.nama || 'Seller';
    const verified = p.users?.seller_verified;

    const { data: komentarList } = await supabase
        .from('komentar_produk')
        .select('*, users:user_id(nama)')
        .eq('produk_id', produkId)
        .order('created_at', { ascending: true });

    const pertanyaan = (komentarList || []).filter(k => !k.parent_id);

    document.getElementById('detailBody').innerHTML = `
        <img src="${p.gambar_url || 'https://placehold.co/400x250/1e293b/38bdf8?text=Produk'}" style="width:100%; height:160px; object-fit:cover; border-radius:14px; margin-bottom:12px;">
        <span class="product-cat">${p.kategori || 'Umum'}</span>
        <h3 style="margin: 4px 0;">${p.nama}</h3>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">Dijual oleh <b>${namaSeller}</b> ${verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
        ${rs ? `<div class="rating-summary">${renderStars(avg)} <span>${avg.toFixed(1)} dari ${rs.count} rating</span></div>` : `<div class="rating-summary">Belum ada rating</div>`}
        <div class="product-price" style="margin: 10px 0;">${formatRupiah(p.harga)}</div>
        <p style="font-size: 12.5px; color: #cbd5e1; margin-bottom: 14px;">${p.deskripsi || 'Tidak ada deskripsi.'}</p>

        <div class="product-actions" style="margin-bottom: 12px;">
            <button class="btn-add-cart" ${p.stok <= 0 ? 'disabled' : ''} onclick="tambahKeranjang(${p.id})" style="padding:12px;"><i class="fa-solid fa-cart-plus"></i> Keranjang</button>
            <button class="btn-buy-now" ${p.stok <= 0 ? 'disabled' : ''} onclick="beliSekarang(${p.id})" style="padding:12px;">Beli Sekarang</button>
        </div>
        ${sesiUser.id !== p.seller_id ? `<button class="btn-outline" style="margin-bottom: 18px;" onclick="mulaiChatDenganSeller(${p.seller_id}, '${namaSeller.replace(/'/g, "\\'")}')"><i class="fa-solid fa-comments"></i> Chat Seller</button>` : ''}

        <h4 style="font-size: 13px; color: #ef4444; margin-bottom: 8px;"><i class="fa-solid fa-comments"></i> Tanya Seller</h4>
        <div class="comment-thread" id="commentThread">
            ${pertanyaan.length === 0 ? '<p style="font-size:12px; color:#64748b;">Belum ada pertanyaan. Jadilah yang pertama!</p>' :
                pertanyaan.map(q => {
                    const balasan = (komentarList || []).filter(k => k.parent_id === q.id);
                    return `
                    <div class="comment-item">
                        <div class="comment-head">${q.users?.nama || 'User'}</div>
                        <div class="comment-text">${q.pesan}</div>
                        <div class="comment-time">${new Date(q.created_at).toLocaleString('id-ID')}</div>
                    </div>
                    ${balasan.map(b => `
                    <div class="comment-item reply">
                        <div class="comment-head">${b.users?.nama || 'Seller'} <span class="seller-tag">Seller</span></div>
                        <div class="comment-text">${b.pesan}</div>
                        <div class="comment-time">${new Date(b.created_at).toLocaleString('id-ID')}</div>
                    </div>`).join('')}
                    ${(sesiUser.role === 'seller' && sesiUser.id === p.seller_id && balasan.length === 0) ? `
                    <div style="display:flex; gap:6px; margin-top: 6px;">
                        <input type="text" id="replyInput-${q.id}" placeholder="Balas pertanyaan..." style="flex:1; padding:8px; background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:white; font-size:12px; outline:none;">
                        <button class="btn-primary" style="width:auto; padding:8px 12px;" onclick="kirimBalasan(${produkId}, ${q.id})"><i class="fa-solid fa-reply"></i></button>
                    </div>` : ''}
                    `;
                }).join('')
            }
        </div>
        <div style="display:flex; gap:8px;">
            <input type="text" id="qaInput" placeholder="Tulis pertanyaan (contoh: stocknya masi ada?)" style="flex:1; padding:10px; background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:white; font-size:13px; outline:none;">
            <button class="btn-primary" style="width:auto; padding:10px 14px;" onclick="kirimPertanyaan(${produkId})"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
    `;

    document.getElementById('detailModal').style.display = 'flex';
};

window.tutupDetail = function () { document.getElementById('detailModal').style.display = 'none'; };

window.kirimPertanyaan = async function (produkId) {
    const input = document.getElementById('qaInput');
    const pesan = input.value.trim();
    if (!pesan) return;

    const { error } = await supabase.from('komentar_produk').insert([{ produk_id: produkId, user_id: sesiUser.id, pesan, is_seller_reply: false }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
        return;
    }
    input.value = '';
    bukaDetail(produkId);
};

window.kirimBalasan = async function (produkId, parentId) {
    const input = document.getElementById(`replyInput-${parentId}`);
    const pesan = input.value.trim();
    if (!pesan) return;

    const { error } = await supabase.from('komentar_produk').insert([{ produk_id: produkId, user_id: sesiUser.id, parent_id: parentId, pesan, is_seller_reply: true }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
        return;
    }
    bukaDetail(produkId);
};

// ================= 3. KERANJANG =================
function simpanCart() { localStorage.setItem('cartToko', JSON.stringify(cart)); renderCart(); }

window.tambahKeranjang = function (produkId) {
    const produk = daftarProduk.find(p => p.id === produkId);
    if (!produk) return;
    const existing = cart.find(i => i.id === produkId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: produk.id, nama: produk.nama, harga: produk.harga, gambar_url: produk.gambar_url, qty: 1, seller_id: produk.seller_id, seller_nama: produk.users?.nama || 'Seller', seller_dana: produk.users?.nomor_dana || null });
    }
    simpanCart();
    Swal.fire({ icon: 'success', title: 'Ditambahkan ke keranjang', timer: 900, showConfirmButton: false });
};

window.ubahQty = function (produkId, delta) {
    const item = cart.find(i => i.id === produkId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== produkId);
    simpanCart();
};

window.hapusDariKeranjang = function (produkId) {
    cart = cart.filter(i => i.id !== produkId);
    simpanCart();
};

function renderCart() {
    const list = document.getElementById('cartList');
    const footer = document.getElementById('cartFooter');
    const badge = document.getElementById('cartBadge');

    const totalItem = cart.reduce((sum, i) => sum + i.qty, 0);
    badge.style.display = totalItem > 0 ? 'flex' : 'none';
    badge.innerText = totalItem;

    if (cart.length === 0) {
        list.innerHTML = `<div class="cart-empty"><i class="fa-solid fa-cart-shopping"></i>Keranjang kamu masih kosong.</div>`;
        footer.style.display = 'none';
        return;
    }

    // Kelompokkan tampilan per seller biar jelas nanti dipecah jadi beberapa pesanan
    const perSeller = {};
    cart.forEach(i => { (perSeller[i.seller_nama] = perSeller[i.seller_nama] || []).push(i); });

    list.innerHTML = Object.entries(perSeller).map(([sellerNama, items]) => `
        <div style="font-size:11px; color:#ef4444; font-weight:700; margin: 10px 0 4px;"><i class="fa-solid fa-store"></i> ${sellerNama}</div>
        ${items.map(i => `
        <div class="cart-item">
            <img src="${i.gambar_url || 'https://placehold.co/100x100/1e293b/38bdf8?text=Produk'}" alt="${i.nama}">
            <div class="cart-item-info">
                <div class="nm">${i.nama}</div>
                <div class="pr">${formatRupiah(i.harga)}</div>
                <div class="qty-control">
                    <button onclick="ubahQty(${i.id}, -1)">-</button>
                    <span>${i.qty}</span>
                    <button onclick="ubahQty(${i.id}, 1)">+</button>
                </div>
            </div>
            <button class="btn-danger" onclick="hapusDariKeranjang(${i.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('')}
    `).join('');

    const total = cart.reduce((sum, i) => sum + i.harga * i.qty, 0);
    document.getElementById('cartTotal').innerText = formatRupiah(total);
    footer.style.display = 'block';
}

// ================= 4. CHECKOUT (dipecah per seller) =================
let checkoutMode = 'cart';
let itemBeliSekarang = null;

window.beliSekarang = function (produkId) {
    const produk = daftarProduk.find(p => p.id === produkId);
    if (!produk) return;
    itemBeliSekarang = { id: produk.id, nama: produk.nama, harga: produk.harga, qty: 1, seller_id: produk.seller_id, seller_nama: produk.users?.nama || 'Seller', seller_dana: produk.users?.nomor_dana || null };
    checkoutMode = 'buy-now';
    bukaCheckout();
};

window.bukaCheckout = function () {
    if (checkoutMode !== 'buy-now' && cart.length === 0) return;
    const items = checkoutMode === 'buy-now' ? [itemBeliSekarang] : cart;
    const total = items.reduce((sum, i) => sum + i.harga * i.qty, 0);

    const perSeller = {};
    items.forEach(i => { (perSeller[i.seller_nama] = perSeller[i.seller_nama] || []).push(i); });

    document.getElementById('checkoutSummary').innerHTML = Object.entries(perSeller).map(([sellerNama, its]) => `
        <div style="font-size:11px; color:#ef4444; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-store"></i> ${sellerNama}</div>
        ${its.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${i.nama} x${i.qty}</span><span>${formatRupiah(i.harga * i.qty)}</span></div>`).join('')}
        <div style="font-size:10.5px; color:#4ade80; margin-bottom:8px;"><i class="fa-brands fa-cc-visa"></i> DANA: ${its[0].seller_dana || 'belum diisi seller, hubungi lewat WA'}</div>
    `).join('') + `<div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:8px; padding-top:8px; display:flex; justify-content:space-between; font-weight:700; color:#4ade80;"><span>Total</span><span>${formatRupiah(total)}</span></div>`;

    document.getElementById('checkoutModal').style.display = 'flex';
};

window.tutupCheckout = function () {
    document.getElementById('checkoutModal').style.display = 'none';
    checkoutMode = 'cart';
    itemBeliSekarang = null;
};

document.getElementById('formCheckout')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const catatan = document.getElementById('ckCatatan').value.trim();
    const btn = document.getElementById('btnSubmitCheckout');
    const items = checkoutMode === 'buy-now' ? [itemBeliSekarang] : cart;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengecek stok...`;

    // Cek stok terbaru dulu sebelum checkout, biar ga oversell
    const idProdukDicek = items.map(i => i.id);
    const { data: stokTerbaru } = await supabase.from('produk').select('id, nama, stok').in('id', idProdukDicek);
    const stokMap = {};
    (stokTerbaru || []).forEach(p => { stokMap[p.id] = p; });

    for (const i of items) {
        const stokSekarang = stokMap[i.id]?.stok ?? 0;
        if (stokSekarang < i.qty) {
            Swal.fire({ icon: 'error', title: 'Stok Tidak Cukup', text: `Stok "${i.nama}" tinggal ${stokSekarang}, kamu minta ${i.qty}. Kurangi jumlahnya dulu ya.` });
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Pesanan`;
            return;
        }
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;

    // Kelompokkan per seller -> 1 pesanan per seller
    const perSeller = {};
    items.forEach(i => { (perSeller[i.seller_id] = perSeller[i.seller_id] || []).push(i); });

    const insertRows = Object.entries(perSeller).map(([sellerId, its]) => ({
        buyer_id: sesiUser.id,
        seller_id: Number(sellerId),
        nama_pembeli: sesiUser.nama,
        no_wa: sesiUser.no_wa,
        catatan: catatan || null,
        items: its.map(i => ({ id: i.id, nama: i.nama, harga: i.harga, qty: i.qty })),
        total: its.reduce((sum, i) => sum + i.harga * i.qty, 0),
        status: 'Menunggu'
    }));

    const { error } = await supabase.from('pesanan').insert(insertRows);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Pesanan`;
        return;
    }

    // Kurangi stok masing-masing produk sesuai qty yang dibeli
    for (const i of items) {
        await supabase.rpc('kurangi_stok', { p_produk_id: i.id, p_qty: i.qty });
    }
    loadProduk();
    loadStats();

    const totalSemua = insertRows.reduce((sum, r) => sum + r.total, 0);
    const rincianItem = items.map(i => `- ${i.nama} x${i.qty} (${formatRupiah(i.harga * i.qty)}) — Seller: ${i.seller_nama}`).join('\n');
    const pesanWA =
        `*🛒 PESANAN BARU MASUK*\n\n` +
        `👤 Nama: *${sesiUser.nama}*\n` +
        `📱 WA: *${sesiUser.no_wa}*\n\n` +
        `📦 Item:\n${rincianItem}\n\n` +
        `💰 Total: *${formatRupiah(totalSemua)}*\n` +
        `💳 Metode Bayar: *DANA*\n` +
        (catatan ? `📝 Catatan: ${catatan}\n\n` : '\n') +
        `_Segera hubungi customer untuk konfirmasi pembayaran DANA & pengiriman akun._`;

    fetch(WASENDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_API_KEY}` },
        body: JSON.stringify({ to: NOMOR_ADMIN_WA, text: pesanWA })
    }).catch(err => console.error('Wasender Error:', err));

    if (checkoutMode === 'cart') { cart = []; simpanCart(); }

    document.getElementById('checkoutModal').style.display = 'none';
    document.getElementById('formCheckout').reset();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Pesanan`;
    checkoutMode = 'cart';
    itemBeliSekarang = null;

    Swal.fire({
        icon: 'success',
        title: 'Pesanan Terkirim!',
        html: `Seller akan segera menghubungi WhatsApp kamu.<br><br>
            ${Object.entries(perSeller).map(([sellerId, its]) => `
                <b>${its[0].seller_nama}</b> — DANA: <b>${its[0].seller_dana || 'hubungi via WA'}</b><br>
            `).join('')}
            <span style="font-size:12px; color:#94a3b8;">Kirim bukti transfer ke WA seller/admin setelah membayar.</span>`
    });

    loadPesananSaya();
});

// ================= 5. PESANAN SAYA (SEBAGAI PEMBELI) + RATING =================
async function loadPesananSaya() {
    const wrap = document.getElementById('pesananSayaList');
    const { data: pesananList } = await supabase.from('pesanan').select('*, users:seller_id(nama)').eq('buyer_id', sesiUser.id).order('id', { ascending: false });
    const { data: ratingList } = await supabase.from('rating_seller').select('pesanan_id').eq('buyer_id', sesiUser.id);
    const sudahDirating = new Set((ratingList || []).map(r => r.pesanan_id));

    if (!pesananList || pesananList.length === 0) {
        wrap.innerHTML = `<p style="font-size:12px; color:#64748b;">Belum ada pesanan.</p>`;
        return;
    }

    wrap.innerHTML = pesananList.map(p => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 12px; margin-bottom: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:12px; font-weight:700;"><i class="fa-solid fa-store"></i> ${p.users?.nama || 'Seller'}</span>
                <span class="status-pill status-${p.status}" style="font-size:10px; padding:3px 8px; border-radius:999px;">${p.status}</span>
            </div>
            <div style="font-size:11.5px; color:#94a3b8; margin-bottom: 4px;">${(p.items || []).map(i => `${i.nama} x${i.qty}`).join(', ')}</div>
            <div style="font-size:12px; color:#4ade80; font-weight:700;">${formatRupiah(p.total)}</div>
            ${p.status === 'Selesai' && !sudahDirating.has(p.id) ? `<button class="btn-primary" style="margin-top:8px; padding:8px;" onclick="bukaRating(${p.id}, ${p.seller_id})">Beri Rating</button>` : ''}
            ${p.status === 'Selesai' && sudahDirating.has(p.id) ? `<div style="font-size:11px; color:#4ade80; margin-top:6px;"><i class="fa-solid fa-check"></i> Sudah diberi rating</div>` : ''}
        </div>
    `).join('');
}

let ratingTarget = { pesananId: null, sellerId: null, nilai: 0 };

window.bukaRating = function (pesananId, sellerId) {
    ratingTarget = { pesananId, sellerId, nilai: 0 };
    document.querySelectorAll('#ratingStarsInput i').forEach(s => s.classList.remove('active'));
    document.getElementById('ratingKomentar').value = '';
    document.getElementById('ratingModal').style.display = 'flex';
};

window.tutupRating = function () { document.getElementById('ratingModal').style.display = 'none'; };

document.querySelectorAll('#ratingStarsInput i').forEach(star => {
    star.addEventListener('click', () => {
        const val = Number(star.dataset.val);
        ratingTarget.nilai = val;
        document.querySelectorAll('#ratingStarsInput i').forEach(s => s.classList.toggle('active', Number(s.dataset.val) <= val));
    });
});

document.getElementById('formRating')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ratingTarget.nilai) {
        Swal.fire({ icon: 'warning', title: 'Pilih Bintang Dulu' });
        return;
    }
    const komentar = document.getElementById('ratingKomentar').value.trim();

    const { error } = await supabase.from('rating_seller').insert([{
        pesanan_id: ratingTarget.pesananId,
        seller_id: ratingTarget.sellerId,
        buyer_id: sesiUser.id,
        rating: ratingTarget.nilai,
        komentar: komentar || null
    }]);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim Rating', text: error.message });
        return;
    }

    document.getElementById('ratingModal').style.display = 'none';
    Swal.fire({ icon: 'success', title: 'Terima Kasih!', text: 'Rating kamu sudah dikirim.', timer: 1200, showConfirmButton: false });
    loadPesananSaya();
    loadRatingSummary().then(renderProduk);
});

// ================= 6. DASHBOARD SELLER: PRODUK SAYA =================
let produkSayaCache = [];

async function loadProdukSaya() {
    const table = document.getElementById('listProdukSayaTable');
    const { data } = await supabase.from('produk').select('*').eq('seller_id', sesiUser.id).order('id', { ascending: false });
    produkSayaCache = data || [];

    if (produkSayaCache.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Belum ada produk.</td></tr>`;
        return;
    }

    table.innerHTML = produkSayaCache.map(p => `
        <tr>
            <td><b>${p.nama}</b></td>
            <td>${formatRupiah(p.harga)}</td>
            <td>${p.stok}</td>
            <td><span class="status-pill ${p.aktif ? 'status-Selesai' : 'status-Batal'}" style="cursor:pointer;" onclick="toggleAktifProdukSaya(${p.id}, ${p.aktif})">${p.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
            <td style="display:flex; gap:6px;">
                <button class="btn-outline" style="width:auto; padding:8px 10px;" onclick="bukaEditProduk(${p.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="hapusProdukSaya(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('formTambahProduk')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('pNama').value.trim();
    const kategori = document.getElementById('pKategori').value.trim();
    const harga = Number(document.getElementById('pHarga').value);
    const stok = Number(document.getElementById('pStok').value);
    const gambar_url = document.getElementById('pGambar').value.trim();
    const deskripsi = document.getElementById('pDeskripsi').value.trim();

    const { error } = await supabase.from('produk').insert([{ seller_id: sesiUser.id, nama, kategori, harga, stok, gambar_url, deskripsi, aktif: true }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        return;
    }
    Swal.fire({ icon: 'success', title: 'Produk Ditambahkan', timer: 1000, showConfirmButton: false });
    document.getElementById('formTambahProduk').reset();
    loadProdukSaya();
    loadProduk();
});

let produkYangDiedit = null;

window.bukaEditProduk = function (id) {
    const p = produkSayaCache.find(x => x.id === id);
    if (!p) return;
    produkYangDiedit = id;
    document.getElementById('epNama').value = p.nama;
    document.getElementById('epKategori').value = p.kategori || '';
    document.getElementById('epHarga').value = p.harga;
    document.getElementById('epStok').value = p.stok;
    document.getElementById('epGambar').value = p.gambar_url || '';
    document.getElementById('epDeskripsi').value = p.deskripsi || '';
    document.getElementById('editProdukModal').style.display = 'flex';
};

window.tutupEditProduk = function () {
    document.getElementById('editProdukModal').style.display = 'none';
    produkYangDiedit = null;
};

document.getElementById('formEditProduk')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!produkYangDiedit) return;

    const { error } = await supabase.from('produk').update({
        nama: document.getElementById('epNama').value.trim(),
        kategori: document.getElementById('epKategori').value.trim(),
        harga: Number(document.getElementById('epHarga').value),
        stok: Number(document.getElementById('epStok').value),
        gambar_url: document.getElementById('epGambar').value.trim(),
        deskripsi: document.getElementById('epDeskripsi').value.trim()
    }).eq('id', produkYangDiedit);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        return;
    }

    document.getElementById('editProdukModal').style.display = 'none';
    Swal.fire({ icon: 'success', title: 'Produk Diperbarui', timer: 1000, showConfirmButton: false });
    produkYangDiedit = null;
    loadProdukSaya();
    loadProduk();
});

window.toggleAktifProdukSaya = async function (id, statusSaatIni) {
    await supabase.from('produk').update({ aktif: !statusSaatIni }).eq('id', id);
    loadProdukSaya();
    loadProduk();
};

window.hapusProdukSaya = async function (id) {
    if (confirm('Yakin ingin menghapus produk ini?')) {
        await supabase.from('produk').delete().eq('id', id);
        loadProdukSaya();
        loadProduk();
    }
};

// ================= 7. DASHBOARD SELLER: PESANAN MASUK =================
async function loadPesananSeller() {
    const table = document.getElementById('listPesananSellerTable');
    const { data } = await supabase.from('pesanan').select('*').eq('seller_id', sesiUser.id).order('id', { ascending: false });

    if (!data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Belum ada pesanan.</td></tr>`;
        return;
    }

    const statusOptions = ['Menunggu', 'Diproses', 'Selesai', 'Batal'];
    table.innerHTML = data.map(p => `
        <tr>
            <td>${new Date(p.created_at).toLocaleString('id-ID')}</td>
            <td><b>${p.nama_pembeli}</b><br><a href="https://wa.me/${p.no_wa}" target="_blank" style="color:#ef4444; font-size:10px;">${p.no_wa}</a></td>
            <td>${(p.items || []).map(i => `${i.nama} x${i.qty}`).join(', ')}</td>
            <td>${formatRupiah(p.total)}</td>
            <td>
                <select class="status-select" onchange="ubahStatusPesananSeller(${p.id}, this.value)">
                    ${statusOptions.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
        </tr>
    `).join('');
}

window.ubahStatusPesananSeller = async function (id, status) {
    const { error } = await supabase.from('pesanan').update({ status }).eq('id', id);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Update Status', text: error.message });
        return;
    }
    Swal.fire({ icon: 'success', title: 'Status Diperbarui', timer: 800, showConfirmButton: false });
};

// ================= 8. INFO & PROMO =================
async function loadInfoToko() {
    const list = document.getElementById('infoTokoList');
    const { data } = await supabase.from('info_toko').select('*').order('id', { ascending: false }).limit(5);
    if (data && data.length > 0) {
        list.innerHTML = data.map(info => `
            <div class="promo-card">
                <div class="promo-date">${new Date(info.created_at).toLocaleDateString('id-ID')}</div>
                <div class="promo-title">${info.judul}</div>
                <p>${info.isi}</p>
            </div>`).join('');
    } else {
        list.innerHTML = `<p style="font-size: 12px; color: #64748b;">Belum ada info terbaru.</p>`;
    }
}

// ================= 9. GALERI / TESTIMONI =================
async function loadGaleri() {
    const grid = document.getElementById('galeriGrid');
    const { data } = await supabase.from('galeri_toko').select('*').order('id', { ascending: false });
    if (data && data.length > 0) {
        grid.innerHTML = data.map(g => `
            <div class="memory-card">
                <img src="${g.foto_url || 'https://placehold.co/300x200/1e293b/38bdf8?text=Galeri'}" alt="Galeri">
                <div class="memory-body">
                    <div style="font-weight: 700; font-size: 12px;">${g.judul}</div>
                    <p style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${g.deskripsi || ''}</p>
                </div>
            </div>`).join('');
    } else {
        grid.innerHTML = `<p style="grid-column: 1/-1; font-size: 12px; color: #64748b;">Belum ada galeri.</p>`;
    }
}

// ================= 10. CUSTOMER SERVICE CHAT =================
const formCsChat = document.getElementById('formCsChat');
const chatContainer = document.getElementById('chatContainer');

const faqCanned = [
    { keys: ['cara belanja', 'cara beli', 'cara order', 'cara pesan'], jawab: 'Login/daftar dulu, pilih produk, klik "Beli" atau masukkan ke Keranjang, lalu checkout. Seller/admin akan hubungi kamu via WA 🙌' },
    { keys: ['bayar', 'pembayaran', 'transfer', 'metode bayar', 'dana'], jawab: 'Pembayaran hanya menerima DANA ya. Setelah checkout, nomor DANA tujuan akan langsung muncul.' },
    { keys: ['jadi seller', 'jualan', 'daftar seller', 'gimana jadi seller'], jawab: 'Buka tab Akun, lalu klik "Ajukan Jadi Seller". Admin akan meninjau pengajuan kamu sebelum disetujui.' },
    { keys: ['lama proses', 'berapa lama', 'kapan dikirim'], jawab: 'Setelah pembayaran dikonfirmasi, pesanan biasanya diproses seller dalam beberapa saat hingga beberapa jam.' },
    { keys: ['garansi'], jawab: 'Sebagian produk ada garansi. Cek langsung di kolom Tanya Seller pada produk terkait ya.' }
];

function jawabCanned(prompt) {
    const p = prompt.toLowerCase();
    const found = faqCanned.find(f => f.keys.some(k => p.includes(k)));
    if (found) return found.jawab;
    return `Terima kasih atas pertanyaanmu! Untuk jawaban lebih pasti seputar "${prompt}", langsung chat admin kami via tombol WhatsApp di bawah 👇`;
}

window.tanyaCepat = function (teks) {
    document.getElementById('csQuery').value = teks;
    formCsChat.dispatchEvent(new Event('submit'));
};

formCsChat?.addEventListener('submit', (e) => {
    e.preventDefault();
    const queryInput = document.getElementById('csQuery');
    const prompt = queryInput.value.trim();
    if (!prompt) return;
    chatContainer.innerHTML += `<div class="chat-msg user">${prompt}</div>`;
    queryInput.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;
    setTimeout(() => {
        chatContainer.innerHTML += `<div class="chat-msg bot">${jawabCanned(prompt)}</div>`;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 500);
});

// ================= 12. CHAT ANTAR USER =================
let chatLawanBicara = null; // {id, nama, avatar_url, seller_verified}
let chatRealtimeChannel = null;

async function loadDaftarChat() {
    const wrap = document.getElementById('daftarChatList');
    const { data: pesanList } = await supabase
        .from('pesan_chat')
        .select('*')
        .or(`dari_id.eq.${sesiUser.id},ke_id.eq.${sesiUser.id}`)
        .order('created_at', { ascending: false });

    if (!pesanList || pesanList.length === 0) {
        wrap.innerHTML = `<p style="font-size:12px; color:#64748b; text-align:center; padding:12px;">Belum ada percakapan.</p>`;
        return;
    }

    // Ambil lawan bicara unik + pesan terakhir masing-masing
    const percakapan = {};
    pesanList.forEach(p => {
        const lawanId = p.dari_id === sesiUser.id ? p.ke_id : p.dari_id;
        if (!percakapan[lawanId]) percakapan[lawanId] = p;
    });

    const lawanIds = Object.keys(percakapan);
    const { data: usersData } = await supabase.from('users').select('id, nama, avatar_url, seller_verified').in('id', lawanIds);
    const usersMap = {};
    (usersData || []).forEach(u => { usersMap[u.id] = u; });

    wrap.innerHTML = Object.entries(percakapan).map(([lawanId, pesanTerakhir]) => {
        const u = usersMap[lawanId];
        if (!u) return '';
        const belumDibaca = pesanTerakhir.ke_id === sesiUser.id && !pesanTerakhir.dibaca;
        return `
        <div class="chat-list-item" onclick='bukaThreadChat(${JSON.stringify({ id: u.id, nama: u.nama, avatar_url: u.avatar_url, seller_verified: u.seller_verified })})'>
            ${u.avatar_url ? `<img src="${u.avatar_url}">` : `<div class="avatar-fallback">${u.nama.charAt(0).toUpperCase()}</div>`}
            <div class="chat-list-info">
                <div class="nm">${u.nama} ${u.seller_verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
                <div class="last-msg">${pesanTerakhir.pesan}</div>
            </div>
            ${belumDibaca ? '<div class="chat-unread-dot"></div>' : ''}
        </div>`;
    }).join('');
}

window.cariUserUntukChat = async function () {
    const keyword = document.getElementById('cariUserChat').value.trim();
    const hasil = document.getElementById('hasilCariUser');
    if (!keyword) { hasil.innerHTML = ''; return; }

    const { data } = await supabase.from('users').select('id, nama, avatar_url, seller_verified').ilike('nama', `%${keyword}%`).neq('id', sesiUser.id).limit(8);

    if (!data || data.length === 0) {
        hasil.innerHTML = `<p style="font-size:11px; color:#64748b; padding:8px;">User tidak ditemukan.</p>`;
        return;
    }

    hasil.innerHTML = data.map(u => `
        <div class="user-search-result" onclick='bukaThreadChat(${JSON.stringify({ id: u.id, nama: u.nama, avatar_url: u.avatar_url, seller_verified: u.seller_verified })})'>
            ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">` : `<div class="avatar-fallback" style="width:36px;height:36px;">${u.nama.charAt(0).toUpperCase()}</div>`}
            <div style="font-size:12.5px; font-weight:600;">${u.nama} ${u.seller_verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
        </div>
    `).join('');
};

window.mulaiChatDenganSeller = function (sellerId, sellerNama) {
    switchTab('Chat', document.querySelector('.bottom-nav .nav-item:nth-child(2)'));
    tutupDetail();
    bukaThreadChat({ id: sellerId, nama: sellerNama, avatar_url: null, seller_verified: true });
};

window.bukaThreadChat = async function (lawan) {
    chatLawanBicara = lawan;
    document.getElementById('chatListView').style.display = 'none';
    document.getElementById('chatThreadView').style.display = 'block';

    document.getElementById('chatThreadHeader').innerHTML = `
        ${lawan.avatar_url ? `<img src="${lawan.avatar_url}">` : `<div class="avatar-fallback">${lawan.nama.charAt(0).toUpperCase()}</div>`}
        <div style="font-size:13px; font-weight:700;">${lawan.nama} ${lawan.seller_verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}</div>
    `;

    await renderThreadMessages();
    await supabase.from('pesan_chat').update({ dibaca: true }).eq('dari_id', lawan.id).eq('ke_id', sesiUser.id);

    if (chatRealtimeChannel) supabase.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = supabase
        .channel('chat_thread_' + lawan.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_chat' }, (payload) => {
            const p = payload.new;
            const cocok = (p.dari_id === lawan.id && p.ke_id === sesiUser.id) || (p.dari_id === sesiUser.id && p.ke_id === lawan.id);
            if (cocok) renderThreadMessages();
        })
        .subscribe();
};

async function renderThreadMessages() {
    if (!chatLawanBicara) return;
    const box = document.getElementById('chatThreadMessages');
    const { data } = await supabase
        .from('pesan_chat')
        .select('*')
        .or(`and(dari_id.eq.${sesiUser.id},ke_id.eq.${chatLawanBicara.id}),and(dari_id.eq.${chatLawanBicara.id},ke_id.eq.${sesiUser.id})`)
        .order('created_at', { ascending: true });

    box.innerHTML = (data || []).map(p => `
        <div class="chat-bubble-row ${p.dari_id === sesiUser.id ? 'me' : ''}">
            <div class="chat-bubble">${p.pesan}</div>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

window.tutupThreadChat = function () {
    document.getElementById('chatThreadView').style.display = 'none';
    document.getElementById('chatListView').style.display = 'block';
    if (chatRealtimeChannel) { supabase.removeChannel(chatRealtimeChannel); chatRealtimeChannel = null; }
    chatLawanBicara = null;
    loadDaftarChat();
};

document.getElementById('formKirimChat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!chatLawanBicara) return;
    const input = document.getElementById('chatThreadInput');
    const pesan = input.value.trim();
    if (!pesan) return;

    const { error } = await supabase.from('pesan_chat').insert([{ dari_id: sesiUser.id, ke_id: chatLawanBicara.id, pesan }]);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
        return;
    }
    input.value = '';
    renderThreadMessages();
});

// ================= 13. NOTIFIKASI PROMO REALTIME =================
function dengarkanNotifRealtime() {
    supabase
        .channel('notif_toko_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notif_toko' }, (payload) => {
            const n = payload.new;
            Swal.fire({ icon: 'info', title: n.judul, text: n.pesan, confirmButtonText: 'Oke' });
        })
        .subscribe();
}

// ================= BAHASA (ID/EN sederhana) =================
window.toggleLanguage = function () {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    localStorage.setItem('appLang', currentLang);
    document.getElementById('langText').innerText = currentLang.toUpperCase();
};
