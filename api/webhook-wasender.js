// api/webhook-wasender.js
//
// Vercel Serverless Function — nangkep pesan WA MASUK lewat webhook Wasender,
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
//      WASENDER_API_KEY          = API key Wasender kamu
//      WASENDER_WEBHOOK_SECRET   = bikin sendiri, string acak bebas
//                                  (contoh: openssl rand -hex 16), ini buat
//                                  mastiin webhook yang masuk beneran dari
//                                  Wasender bukan orang iseng
//
// 3. Di dashboard Wasender (app.wasender.dev) → Session Settings → Webhook:
//      Webhook URL    : https://ramastore16.vercel.app/api/webhook-wasender
//      Webhook Secret : sama persis kayak WASENDER_WEBHOOK_SECRET di atas
//      Aktifkan event : "messages.received"
//
// 4. Command yang didukung — kirim ke NOMOR WA TOKO kamu (nomor yang
//    kesambung ke sesi Wasender), bukan ke nomor pribadi kamu:
//      .listmenuproduk   -> balas daftar semua produk yang aktif
//      .help             -> balas daftar command yang ada
//
// ============================= CATATAN =============================
// Wasender itu berbasis Baileys, jadi struktur payload pesannya aku tebak
// ngikutin pola Baileys yang umum (key.remoteJid, message.conversation, dst)
// — sama kayak pola yang kepake di Zara Bot kamu. TAPI setiap provider bisa
// beda dikit. Kalau bot ga balas sama sekali abis setup, buka Vercel →
// project kamu → tab "Logs", kirim pesan test, terus lihat baris
// "PAYLOAD MASUK:" di log itu buat lihat bentuk asli datanya — kalau
// field-nya beda dari yang aku tebak di sini, kabarin aku bentuknya kayak
// apa, biar aku sesuaikan bagian ambilTeksDanPengirim() di bawah.
// =====================================================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true });
    }

    // Verifikasi ini beneran dari Wasender, bukan orang lain nembak endpoint kita
    const signature = req.headers['x-webhook-signature'];
    if (!process.env.WASENDER_WEBHOOK_SECRET || signature !== process.env.WASENDER_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'invalid signature' });
    }

    const payload = req.body;
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
        // Tetap balas 200 biar Wasender ga nge-retry event yang sama berkali-kali
        return res.status(200).json({ ok: true });
    }
}

// Ambil teks pesan + nomor pengirim dari payload ala-Baileys.
// Dibikin fleksibel (coba beberapa kemungkinan struktur) biar ga gampang patah.
function ambilTeksDanPengirim(payload) {
    const msg = payload?.data?.messages || payload?.data?.message || payload?.data || {};
    const key = msg?.key || {};
    const dariSayaSendiri = !!key.fromMe;
    const remoteJid = key.remoteJid || msg?.remoteJid || '';
    const nomorPengirim = remoteJid.split('@')[0] || null;

    const teks =
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.text ||
        msg?.body ||
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
    await fetch('https://app.wasender.dev/api/send-message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WASENDER_API_KEY}`
        },
        body: JSON.stringify({ to, text })
    });
}
