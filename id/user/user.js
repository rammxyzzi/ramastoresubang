import { supabase } from '/config/supabase.js';

// ================= KONFIGURASI TOKO =================
const NAMA_TOKO = "Rama Store";
const TAGLINE_TOKO = "Belanja gampang, proses cepat";
const NOMOR_ADMIN_WA = "6283872851796"; // Ganti nomor WA admin di sini
const WASENDER_API_KEY = '50021fcdb8bb9825a200cbda9a944ea6bbcf4c5454e7512cf12cff23ddc9dd56'; // Ganti API key kamu (dari app.wasender.dev)
const WASENDER_ENDPOINT = 'https://app.wasender.dev/api/send-message';

// Pembayaran cuma DANA
const NOMOR_DANA = "6283872851796"; // Ganti nomor DANA tujuan pembayaran
const NAMA_PEMILIK_DANA = "Nama Pemilik DANA"; // Ganti nama pemilik akun DANA

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

    const { data, error } = await supabase.from('users').select('*').eq('no_wa', noWa).eq('password', password).maybeSingle();
    spinner.style.display = 'none';

    if (error || !data) {
        Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'Nomor WA atau password salah.' });
        return;
    }

    sesiUser = data;
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

    renderProfile();
    loadProduk();
    loadInfoToko();
    loadGaleri();
    renderCart();
    loadPesananSaya();
    dengarkanNotifRealtime();
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
    document.getElementById('avatarInitial').innerText = (sesiUser.nama || '?').charAt(0).toUpperCase();
    document.getElementById('profileNama').childNodes[0].nodeValue = sesiUser.nama + ' ';
    document.getElementById('profileWa').innerText = sesiUser.no_wa;
    document.getElementById('verifiedIcon').style.display = sesiUser.seller_verified ? 'inline-block' : 'none';

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

window.ajukanSeller = async function () {
    const { error } = await supabase.from('users').update({ seller_status: 'pending' }).eq('id', sesiUser.id);
    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: error.message });
        return;
    }
    sesiUser.seller_status = 'pending';
    localStorage.setItem('sesiUser', JSON.stringify(sesiUser));
    Swal.fire({ icon: 'success', title: 'Pengajuan Terkirim', text: 'Admin akan meninjau pengajuan kamu.' });
    renderProfile();
};

// ================= 1. KATALOG PRODUK =================
async function loadProduk() {
    const { data, error } = await supabase
        .from('produk')
        .select('*, users:seller_id(nama, seller_verified)')
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
    renderProduk();
}

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

        <div class="product-actions" style="margin-bottom: 18px;">
            <button class="btn-add-cart" ${p.stok <= 0 ? 'disabled' : ''} onclick="tambahKeranjang(${p.id})" style="padding:12px;"><i class="fa-solid fa-cart-plus"></i> Keranjang</button>
            <button class="btn-buy-now" ${p.stok <= 0 ? 'disabled' : ''} onclick="beliSekarang(${p.id})" style="padding:12px;">Beli Sekarang</button>
        </div>

        <h4 style="font-size: 13px; color: #38bdf8; margin-bottom: 8px;"><i class="fa-solid fa-comments"></i> Tanya Seller</h4>
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
        cart.push({ id: produk.id, nama: produk.nama, harga: produk.harga, gambar_url: produk.gambar_url, qty: 1, seller_id: produk.seller_id, seller_nama: produk.users?.nama || 'Seller' });
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
        <div style="font-size:11px; color:#38bdf8; font-weight:700; margin: 10px 0 4px;"><i class="fa-solid fa-store"></i> ${sellerNama}</div>
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
    itemBeliSekarang = { id: produk.id, nama: produk.nama, harga: produk.harga, qty: 1, seller_id: produk.seller_id, seller_nama: produk.users?.nama || 'Seller' };
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
        <div style="font-size:11px; color:#38bdf8; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-store"></i> ${sellerNama}</div>
        ${its.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${i.nama} x${i.qty}</span><span>${formatRupiah(i.harga * i.qty)}</span></div>`).join('')}
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
        html: `Admin/seller akan segera menghubungi WhatsApp kamu.<br><br>
            <b>Pembayaran hanya via DANA</b><br>
            No. DANA: <b>${NOMOR_DANA}</b><br>
            a.n. ${NAMA_PEMILIK_DANA}<br><br>
            <span style="font-size:12px; color:#94a3b8;">Kirim bukti transfer ke WA admin/seller setelah membayar.</span>`
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
async function loadProdukSaya() {
    const table = document.getElementById('listProdukSayaTable');
    const { data } = await supabase.from('produk').select('*').eq('seller_id', sesiUser.id).order('id', { ascending: false });

    if (!data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Belum ada produk.</td></tr>`;
        return;
    }

    table.innerHTML = data.map(p => `
        <tr>
            <td><b>${p.nama}</b></td>
            <td>${formatRupiah(p.harga)}</td>
            <td>${p.stok}</td>
            <td><span class="status-pill ${p.aktif ? 'status-Selesai' : 'status-Batal'}" style="cursor:pointer;" onclick="toggleAktifProdukSaya(${p.id}, ${p.aktif})">${p.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
            <td><button class="btn-danger" onclick="hapusProdukSaya(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
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
            <td><b>${p.nama_pembeli}</b><br><a href="https://wa.me/${p.no_wa}" target="_blank" style="color:#38bdf8; font-size:10px;">${p.no_wa}</a></td>
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

// ================= 11. NOTIFIKASI PROMO REALTIME =================
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
