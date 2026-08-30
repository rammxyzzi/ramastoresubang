// api/kirim-wa.js
//
// Vercel Serverless Function — perantara buat kirim pesan WA lewat Fonnte.
// Fonnte sendiri bilang di dokumentasinya token mereka "must be kept
// confidential" dan ga disaranin dipanggil langsung dari frontend — jadi
// tetap butuh perantara kayak ini biar token-nya aman & ga kena isu CORS.
//
//   browser (user.js/admin.js) --> fungsi ini (/api/kirim-wa) --> Fonnte
//
// ============================= CARA SETUP =============================
// 1. Daftar/login di https://fonnte.com, tambah device (nomor WA toko kamu),
//    scan QR buat connect, lalu copy TOKEN device itu dari dashboard.
// 2. Taruh file ini di /api/kirim-wa.js (root project, folder "api").
// 3. Di Vercel Dashboard > Settings > Environment Variables, tambahin
//    SATU variable ini aja (isinya JSON, gampang diinget & dikelola):
//
//      Name  : APP_CONFIG
//      Value : {"FONNTE_TOKEN":"token-device-fonnte-kamu","FONNTE_WEBHOOK_SECRET":"bebas-string-acak","SUPABASE_URL":"https://xxxxx.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"key-service-role-supabase-kamu"}
//
//    (ganti nilai di dalam tanda kutip-nya sesuai punya kamu, JSON-nya
//    harus tetap dalam 1 baris, jangan ada enter di tengah)
//
// 4. Redeploy project-nya.
//
// PENTING: JANGAN taruh nilai-nilai ini di file kode yang ikut ke-commit
// ke GitHub (misal config.json yang di-push) — kalau repo kamu publik,
// semua orang bisa lihat & pakai token Fonnte + Supabase service role key
// kamu. Environment Variable di Vercel itu satu-satunya tempat yang aman
// buat nyimpen ini, karena ga pernah ikut ke-commit ke Git.
// =====================================================================

const CONFIG = JSON.parse(process.env.APP_CONFIG || '{}');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, text } = req.body || {};
    if (!to || !text) {
        return res.status(400).json({ error: '"to" dan "text" wajib diisi' });
    }

    if (!CONFIG.FONNTE_TOKEN) {
        return res.status(500).json({ error: 'APP_CONFIG belum di-set / FONNTE_TOKEN kosong' });
    }

    try {
        const resp = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                Authorization: CONFIG.FONNTE_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ target: to, message: text })
        });

        const data = await resp.json().catch(() => ({}));

        // Fonnte biasanya tetap balas HTTP 200 walau gagal, statusnya ada
        // di field "status" (true/false) dalam body JSON-nya.
        if (!resp.ok || data.status === false) {
            console.error('Fonnte gagal kirim:', resp.status, data);
            return res.status(resp.ok ? 400 : resp.status).json({ error: 'Gagal kirim WA', detail: data });
        }

        return res.status(200).json({ ok: true, data });
    } catch (err) {
        console.error('Error kirim WA:', err);
        return res.status(500).json({ error: err.message });
    }
}
