// api/webhook-fonnte.js
//
// Vercel Serverless Function — nangkep pesan WA MASUK lewat webhook Fonnte,
// terus balas otomatis kalau ada command tertentu (contoh: .listmenuproduk).
//
// ============================= CARA SETUP =============================
// 1. Taruh file ini persis di path: /api/webhook-fonnte.js di root project
//    Vercel kamu (folder "api" di root, sejajar sama folder "id" dkk).
//
// 2. Di Vercel Dashboard → project kamu → Settings → Environment Variables,
//    tambahin (lalu redeploy):
//      SUPABASE_URL              = URL project Supabase kamu
//      SUPABASE_SERVICE_ROLE_KEY = Settings > API > "service_role" key
//                                  (BUKAN anon key! cuma boleh dipakai di
//                                  server, jangan pernah taruh di kode yang
//                                  jalan di browser)
//      FONNTE_TOKEN               = token device Fonnte kamu (sama kayak
//                                  yang dipakai di kirim-wa.js)
//      FONNTE_WEBHOOK_SECRET       = bikin sendiri, string acak bebas —
//                                  ini buat proteksi ringan biar orang lain
//                                  ga bisa mancing-mancing bot kamu lewat
//                                  URL webhooknya kalau ketauan
//
// 3. Di dashboard Fonnte → Device kamu → Webhook, isi URL-nya:
//      https://ramastore16.vercel.app/api/webhook-fonnte?key=ISI_FONNTE_WEBHOOK_SECRET_DI_SINI
//    (kunci rahasianya ditaruh di URL sebagai query string ?key=...,
//    samain persis sama FONNTE_WEBHOOK_SECRET di langkah 2)
//
// 4. Command yang didukung — kirim ke NOMOR WA TOKO kamu (nomor yang
//    connect ke device Fonnte itu), bukan ke nomor pribadi kamu:
//      .listmenuproduk   -> balas daftar semua produk yang aktif
//      .help             -> balas daftar command yang ada
//
// ============================= CATATAN =============================
// Nama field di payload webhook Fonnte aku tebak berdasarkan pola umum
// (sender, message) — kalau bot ga pernah balas walau webhook-nya udah
// keregister, buka Vercel → project kamu → tab "Logs", kirim pesan test
// ke nomor WA toko, lihat baris "PAYLOAD MASUK DARI FONNTE:" di situ buat
// lihat bentuk aslinya, terus kabarin aku biar aku sesuaikan bagian
// ambilPengirimDanTeks() di bawah.
// =====================================================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true });
    }

    // Proteksi ringan: URL webhook harus disertai ?key=... yang cocok
    if (req.query.key !== process.env.FONNTE_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'invalid key' });
    }

    const payload = req.body;
    console.log('PAYLOAD MASUK DARI FONNTE:', JSON.stringify(payload));

    try {
        const { pengirim, teks } = ambilPengirimDanTeks(payload);

        if (!pengirim || !teks) {
            return res.status(200).json({ ok: true });
        }

        const perintah = teks.trim().toLowerCase();
        let balasan = null;

        if (perintah === '.listmenuproduk' || perintah === '.listproduk' || perintah === '.menu') {
            balasan = await buatDaftarProduk();
        } else if (perintah === '.help' || perintah === '.menu bantuan') {
            balasan = `*🤖 Menu Bot Rama Store*\n\n.listmenuproduk - lihat semua produk yang tersedia\n.help - lihat menu ini`;
        }

        if (balasan) {
            await kirimWA(pengirim, balasan);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Webhook error:', err);
        return res.status(200).json({ ok: true }); // tetap 200 biar Fonnte ga nge-retry terus
    }
}

// Ambil nomor pengirim + teks pesan dari payload Fonnte.
// Dibikin fleksibel (coba beberapa nama field) biar ga gampang patah.
function ambilPengirimDanTeks(payload) {
    const pengirim = payload?.sender || payload?.from || payload?.pengirim || null;
    const teks = (payload?.message || payload?.text || payload?.pesan || '').toString();
    return { pengirim, teks };
}

async function buatDaftarProduk() {
    const url = `${process.env.SUPABASE_URL}/rest/v1/produk?select=nama,harga,stok,kategori,seller:seller_id(nama)&aktif=eq.true&order=id.desc&limit=30`;

    const resp = await fetch(url, {
        headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const produkList = await resp.json();

    if (!Array.isArray(produkList) || produkList.length === 0) {
        return 'Belum ada produk yang tersedia saat ini. Coba cek lagi nanti ya 🙏';
    }

    const formatRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

    let teks = `*📦 DAFTAR PRODUK RAMA STORE*\n\n`;
    produkList.forEach((p, i) => {
        teks += `${i + 1}. *${p.nama}*\n`;
        teks += `   Kategori: ${p.kategori || '-'}\n`;
        teks += `   Harga: ${formatRupiah(p.harga)}\n`;
        teks += `   Stok: ${p.stok > 0 ? p.stok : 'Habis'}\n`;
        teks += `   Seller: ${p.seller?.nama || '-'}\n\n`;
    });
    teks += `Buka ${process.env.STORE_URL || 'toko online kami'} buat lihat detail & checkout ya!`;

    return teks;
}

async function kirimWA(to, text) {
    await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
            Authorization: process.env.FONNTE_TOKEN,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ target: to, message: text })
    });
}
