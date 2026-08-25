// Memanggil supabase dari folder config
import { supabase } from '../config/supabase.js';

// ================= KONFIGURASI TOKO =================
const NAMA_TOKO = "Rama Store";
const TAGLINE_TOKO = "Belanja gampang, proses cepat";
const NOMOR_ADMIN_WA = "6283894837190"; // Ganti nomor WA admin di sini
const WASENDER_API_KEY = 'wsm_BBKO2OYAwKC2hrxDgYlR3EXKMWeQ3ukYDMjUiQ02FlNgNyFQ'; // Ganti API key kamu (dari app.wasender.dev)
const WASENDER_ENDPOINT = 'https://app.wasender.dev/api/send-message';

// Pembayaran cuma DANA
const NOMOR_DANA = "6283872851796"; // Ganti nomor DANA tujuan pembayaran
const NAMA_PEMILIK_DANA = "Nama Pemilik DANA"; // Ganti nama pemilik akun DANA

let currentLang = localStorage.getItem('appLang') || 'id';
let daftarProduk = [];
let daftarKategori = ['Semua'];
let kategoriAktif = 'Semua';
let cart = JSON.parse(localStorage.getItem('cartToko') || '[]');

const translations = {
    id: {
        promoTitle: "Info & Promo",
        catalogTitle: "Produk Tersedia",
        csWelcome: "Halo 👋 Ada yang bisa dibantu seputar produk, harga, atau cara belanja?",
        csPlaceholder: "Tulis pertanyaan...",
        searchPh: "Cari produk...",
        navHome: "Beranda", navCs: "CS", navGaleri: "Galeri"
    },
    en: {
        promoTitle: "News & Promo",
        catalogTitle: "Available Products",
        csWelcome: "Hi 👋 Need help with products, pricing, or how to order?",
        csPlaceholder: "Type your question...",
        searchPh: "Search products...",
        navHome: "Home", navCs: "CS", navGaleri: "Gallery"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('txtStoreName').innerText = NAMA_TOKO;
    document.getElementById('txtStoreTagline').innerText = TAGLINE_TOKO;
    document.getElementById('linkWaCs').href = `https://wa.me/${NOMOR_ADMIN_WA}?text=${encodeURIComponent('Halo admin, saya mau tanya-tanya')}`;

    applyLanguage();
    loadProduk();
    loadInfoToko();
    loadGaleri();
    renderCart();
    dengarkanNotifRealtime();
});

// ================= BAHASA =================
window.toggleLanguage = function () {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    localStorage.setItem('appLang', currentLang);
    applyLanguage();
};

function applyLanguage() {
    const t = translations[currentLang];
    document.getElementById('langText').innerText = currentLang.toUpperCase();
    document.getElementById('txtPromoTitle').innerHTML = `<i class="fa-solid fa-bullhorn"></i> ${t.promoTitle}`;
    document.getElementById('txtCatalogTitle').innerHTML = `<i class="fa-solid fa-shop"></i> ${t.catalogTitle}`;
    document.getElementById('txtCsWelcome').innerText = t.csWelcome;
    document.getElementById('csQuery').placeholder = t.csPlaceholder;
    document.getElementById('searchProduk').placeholder = t.searchPh;
}

function formatRupiah(angka) {
    return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

// ================= NAVIGASI TAB =================
window.switchTab = function (tabName, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('tab' + tabName).classList.add('active');
    if (el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ================= 1. KATALOG PRODUK =================
async function loadProduk() {
    const { data, error } = await supabase.from('produk').select('*').eq('aktif', true).order('id', { ascending: false });
    if (error || !data) {
        daftarProduk = [];
    } else {
        daftarProduk = data;
        daftarKategori = ['Semua', ...new Set(data.map(p => p.kategori).filter(Boolean))];
    }
    renderKategoriChips();
    renderProduk();
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

    grid.innerHTML = hasil.map(p => `
        <div class="product-card">
            <img src="${p.gambar_url || 'https://placehold.co/300x200/1e293b/38bdf8?text=Produk'}" alt="${p.nama}">
            <div class="product-body">
                <span class="product-cat">${p.kategori || 'Umum'}</span>
                <div class="product-name">${p.nama}</div>
                <div class="product-price">${formatRupiah(p.harga)}</div>
                <div class="product-stock ${p.stok <= 0 ? 'habis' : ''}">${p.stok > 0 ? 'Stok: ' + p.stok : 'Stok Habis'}</div>
                <div class="product-actions">
                    <button class="btn-add-cart" ${p.stok <= 0 ? 'disabled' : ''} onclick="tambahKeranjang(${p.id})"><i class="fa-solid fa-cart-plus"></i></button>
                    <button class="btn-buy-now" ${p.stok <= 0 ? 'disabled' : ''} onclick="beliSekarang(${p.id})">Beli</button>
                </div>
            </div>
        </div>
    `).join('');
};

// ================= 2. KERANJANG =================
function simpanCart() {
    localStorage.setItem('cartToko', JSON.stringify(cart));
    renderCart();
}

window.tambahKeranjang = function (produkId) {
    const produk = daftarProduk.find(p => p.id === produkId);
    if (!produk) return;
    const existing = cart.find(i => i.id === produkId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: produk.id, nama: produk.nama, harga: produk.harga, gambar_url: produk.gambar_url, qty: 1 });
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
    if (totalItem > 0) {
        badge.style.display = 'flex';
        badge.innerText = totalItem;
    } else {
        badge.style.display = 'none';
    }

    if (cart.length === 0) {
        list.innerHTML = `<div class="cart-empty"><i class="fa-solid fa-cart-shopping"></i>Keranjang kamu masih kosong.</div>`;
        footer.style.display = 'none';
        return;
    }

    list.innerHTML = cart.map(i => `
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
        </div>
    `).join('');

    const total = cart.reduce((sum, i) => sum + i.harga * i.qty, 0);
    document.getElementById('cartTotal').innerText = formatRupiah(total);
    footer.style.display = 'block';
}

// ================= 3. CHECKOUT =================
let checkoutMode = 'cart'; // 'cart' atau 'buy-now'
let itemBeliSekarang = null;

window.beliSekarang = function (produkId) {
    const produk = daftarProduk.find(p => p.id === produkId);
    if (!produk) return;
    itemBeliSekarang = { id: produk.id, nama: produk.nama, harga: produk.harga, qty: 1 };
    checkoutMode = 'buy-now';
    bukaCheckout();
};

window.bukaCheckout = function () {
    if (checkoutMode !== 'buy-now' && cart.length === 0) return;
    const items = checkoutMode === 'buy-now' ? [itemBeliSekarang] : cart;
    const total = items.reduce((sum, i) => sum + i.harga * i.qty, 0);

    document.getElementById('checkoutSummary').innerHTML = items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${i.nama} x${i.qty}</span><span>${formatRupiah(i.harga * i.qty)}</span>
        </div>
    `).join('') + `<div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:8px; padding-top:8px; display:flex; justify-content:space-between; font-weight:700; color:#4ade80;">
            <span>Total</span><span>${formatRupiah(total)}</span>
        </div>`;

    document.getElementById('checkoutModal').style.display = 'flex';
};

window.tutupCheckout = function () {
    document.getElementById('checkoutModal').style.display = 'none';
    checkoutMode = 'cart';
    itemBeliSekarang = null;
};

document.getElementById('formCheckout')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('ckNama').value.trim();
    let noWa = document.getElementById('ckWa').value.trim();
    const catatan = document.getElementById('ckCatatan').value.trim();
    const btn = document.getElementById('btnSubmitCheckout');

    if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);

    const items = checkoutMode === 'buy-now' ? [itemBeliSekarang] : cart;
    const total = items.reduce((sum, i) => sum + i.harga * i.qty, 0);

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;

    const { error } = await supabase.from('pesanan').insert([{
        nama_pembeli: nama,
        no_wa: noWa,
        catatan: catatan || null,
        items: items,
        total: total,
        status: 'Menunggu'
    }]);

    if (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengirim', text: error.message });
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Pesanan`;
        return;
    }

    // Notifikasi WA ke admin
    const rincianItem = items.map(i => `- ${i.nama} x${i.qty} (${formatRupiah(i.harga * i.qty)})`).join('\n');
    const pesanWA =
        `*🛒 PESANAN BARU MASUK*\n\n` +
        `👤 Nama: *${nama}*\n` +
        `📱 WA: *${noWa}*\n\n` +
        `📦 Item:\n${rincianItem}\n\n` +
        `💰 Total: *${formatRupiah(total)}*\n` +
        `💳 Metode Bayar: *DANA*\n` +
        (catatan ? `📝 Catatan: ${catatan}\n\n` : '\n') +
        `_Segera hubungi customer untuk konfirmasi pembayaran DANA & pengiriman akun._`;

    fetch(WASENDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WASENDER_API_KEY}` },
        body: JSON.stringify({ to: NOMOR_ADMIN_WA, text: pesanWA })
    }).catch(err => console.error('Wasender Error:', err));

    // Bersihkan keranjang jika checkout dari cart
    if (checkoutMode === 'cart') {
        cart = [];
        simpanCart();
    }

    document.getElementById('checkoutModal').style.display = 'none';
    document.getElementById('formCheckout').reset();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Pesanan`;
    checkoutMode = 'cart';
    itemBeliSekarang = null;

    Swal.fire({
        icon: 'success',
        title: 'Pesanan Terkirim!',
        html: `Admin akan segera menghubungi WhatsApp kamu.<br><br>
            <b>Pembayaran hanya via DANA</b><br>
            No. DANA: <b>${NOMOR_DANA}</b><br>
            a.n. ${NAMA_PEMILIK_DANA}<br><br>
            <span style="font-size:12px; color:#94a3b8;">Kirim bukti transfer ke WA admin setelah membayar.</span>`
    });
});

// ================= 4. INFO & PROMO =================
async function loadInfoToko() {
    const list = document.getElementById('infoTokoList');
    const { data } = await supabase.from('info_toko').select('*').order('id', { ascending: false }).limit(5);

    if (data && data.length > 0) {
        list.innerHTML = data.map(info => `
            <div class="promo-card">
                <div class="promo-date">${new Date(info.created_at).toLocaleDateString('id-ID')}</div>
                <div class="promo-title">${info.judul}</div>
                <p>${info.isi}</p>
            </div>
        `).join('');
    } else {
        list.innerHTML = `<p style="font-size: 12px; color: #64748b;">Belum ada info terbaru.</p>`;
    }
}

// ================= 5. GALERI / TESTIMONI =================
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
            </div>
        `).join('');
    } else {
        grid.innerHTML = `<p style="grid-column: 1/-1; font-size: 12px; color: #64748b;">Belum ada galeri.</p>`;
    }
}

// ================= 6. CUSTOMER SERVICE CHAT =================
const formCsChat = document.getElementById('formCsChat');
const chatContainer = document.getElementById('chatContainer');

const faqCanned = [
    { keys: ['cara belanja', 'cara beli', 'cara order', 'cara pesan'], jawab: 'Gampang! Pilih produk di tab Beranda, klik "Beli" atau masukkan ke Keranjang, lalu isi nama & nomor WA kamu di form checkout. Admin akan hubungi kamu untuk proses selanjutnya 🙌' },
    { keys: ['bayar', 'pembayaran', 'transfer', 'metode bayar', 'dana'], jawab: 'Pembayaran hanya menerima DANA ya. Setelah checkout, nomor DANA tujuan akan langsung muncul, tinggal transfer lalu kirim bukti ke WA admin.' },
    { keys: ['lama proses', 'berapa lama', 'kapan dikirim', 'proses berapa'], jawab: 'Setelah pembayaran dikonfirmasi, pesanan biasanya diproses dan dikirim dalam beberapa saat hingga beberapa jam, tergantung antrian.' },
    { keys: ['garansi'], jawab: 'Sebagian produk kami sertakan garansi. Silakan cek detail garansi produk terkait dengan admin via WhatsApp ya.' }
];

function jawabCanned(prompt) {
    const p = prompt.toLowerCase();
    const found = faqCanned.find(f => f.keys.some(k => p.includes(k)));
    if (found) return found.jawab;
    return `Terima kasih atas pertanyaanmu! Untuk jawaban yang lebih pasti seputar "${prompt}", langsung chat admin kami ya via tombol WhatsApp di bawah 👇`;
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

// ================= 7. NOTIFIKASI PROMO REALTIME =================
function dengarkanNotifRealtime() {
    supabase
        .channel('notif_toko_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notif_toko' }, (payload) => {
            const n = payload.new;
            Swal.fire({
                icon: 'info',
                title: n.judul,
                text: n.pesan,
                confirmButtonText: 'Oke'
            });
        })
        .subscribe();
}
