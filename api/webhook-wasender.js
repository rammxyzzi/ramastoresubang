// api/webhook-wasender.js
//
// Vercel Serverless Function — nangkep pesan WA MASUK lewat webhook wasender.dev,
// terus balas otomatis kalau ada command tertentu (contoh: .listmenuproduk).
//
// ============================= CARA SETUP =============================
// 1. Taruh file ini persis di path: /api/webhook-wasender.js di root project
//    Vercel kamu (folder "api" di root, sejajar sama folder "id" dkk).
//
// 2. Di Vercel Dashboard → project kamu → Settings → Environment Variables,
//    tambahin 4 ini (lalu redeploy):
//      SUPABASE_URL              = URL project Supabase kamu
//      SUPABASE_SERVICE_ROLE_KEY = Settings > API > "service_role" key
//                                  (BUKAN anon key! ini kunci rahasia,
//                                  jangan pernah taruh di file yang jalan
//                                  di browser, cuma boleh di sini/server)
//      WASENDER_API_KEY          = Session Token nomor kamu (wsk_sg_...),
//                                  lihat di wasender.dev > Numbers > nomor kamu
//      WASENDER_WEBHOOK_SECRET   = "Signing secret" yang muncul di popup
//                                  Webhook wasender.dev (formatnya "whsec_...")
//                                  — COPY PERSIS dari situ, jangan bikin sendiri
//
// 3. Di dashboard wasender.dev → Numbers → nomor kamu → titik tiga → Webhook:
//      Endpoint URL   : https://ramastore16.vercel.app/api/webhook-wasender
//      (Signing secret otomatis dikasih di situ juga — itu yang dipakai
//      buat WASENDER_WEBHOOK_SECRET di langkah 2)
//      Save webhook, pastikan Status: Active
//
// 4. Command yang didukung — kirim ke NOMOR WA TOKO kamu (nomor yang
//    "Connected" di dashboard wasender.dev), bukan ke nomor pribadi kamu:
//      .listmenuproduk   -> balas daftar semua produk yang aktif
//      .help             -> balas daftar command yang ada
//
// ============================= CATATAN =============================
// wasender.dev nandatanganin tiap webhook pakai HMAC-SHA256 dari signing
// secret + isi mentah request body — kode di bawah udah ngecek itu.
// Header yang dipakai buat kirim tanda tangannya aku tebak "x-webhook-signature"
// (paling umum dipakai provider lain juga). Kalau webhook-nya ga pernah
// masuk/selalu ditolak, buka Vercel → project kamu → tab "Logs", kirim pesan
// test ke nomor WA toko, lihat baris "HEADERS MASUK:" buat lihat nama header
// yang sebenarnya dipakai — kabarin aku kalau beda, biar aku sesuaikan.
//
// Struktur payload pesannya juga aku tebak ngikutin pola umum (key.remoteJid,
// message.conversation) — kalau bot ga balas walau webhook udah masuk (lolos
// verifikasi signature), cek baris "PAYLOAD MASUK:" di log yang sama buat
// lihat bentuk aslinya.
// =====================================================================

import crypto from 'crypto';

// Wajib matiin body parser otomatis Vercel, karena verifikasi HMAC butuh
// bytes MENTAH dari request body (bukan hasil parse JSON).
export const config = {
    api: {
        bodyParser: false
    }
};

function bacaRawBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function verifikasiSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;
    const bersih = signatureHeader.replace(/^sha256=/, '');
    const hitung = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(hitung), Buffer.from(bersih));
    } catch {
        return false; // panjang beda dll -> otomatis ga valid
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true });
    }

    const rawBody = await bacaRawBody(req);
    console.log('HEADERS MASUK:', JSON.stringify(req.headers));

    const signatureHeader =
        req.headers['x-webhook-signature'] ||
        req.headers['x-signature'] ||
        req.headers['x-wasender-signature'];

    if (!verifikasiSignature(rawBody, signatureHeader, process.env.WASENDER_WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'invalid signature' });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return res.status(400).json({ error: 'invalid json' });
    }

    console.log('PAYLOAD MASUK:', JSON.stringify(payload));

    // Cuma proses event pesan masuk, abaikan event lain (status update dll)
    if (payload?.event !== 'messages.received' && payload?.event !== 'messages.upsert') {
        return res.status(200).json({ ok: true });
    }

    try {
        const { teks, nomorPengirim, dariSayaSendiri } = ambilTeksDanPengirim(payload);

        if (dariSayaSendiri || !teks || !nomorPengirim) {
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
            await kirimWA(nomorPengirim, balasan);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Webhook error:', err);
        // Tetap balas 200 biar wasender.dev ga nge-retry event yang sama berkali-kali
        return res.status(200).json({ ok: true });
    }
}

// Ambil teks pesan + nomor pengirim dari payload ala-Baileys.
// Dibikin fleksibel (coba beberapa kemungkinan struktur) biar ga gampang patah.
function ambilTeksDanPengirim(payload) {
    const msg = payload?.data?.messages || payload?.data?.message || payload?.data || {};
    const key = msg?.key || {};
    const dariSayaSendiri = !!key.fromMe;
    const remoteJid = key.remoteJid || msg?.remoteJid || payload?.from || '';
    const nomorPengirim = (remoteJid || '').split('@')[0] || null;

    const teks =
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.text ||
        msg?.body ||
        payload?.body ||
        '';

    return { teks, nomorPengirim, dariSayaSendiri };
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
    await fetch('https://api.wasender.dev/messages/text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WASENDER_API_KEY}`
        },
        body: JSON.stringify({ to, body: text })
    });
}
