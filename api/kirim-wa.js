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
// 3. Di Vercel Dashboard > Settings > Environment Variables, tambahin:
//      FONNTE_TOKEN = token device Fonnte kamu
//    (kalau sebelumnya ada WASENDER_API_KEY / WASENDER_WEBHOOK_SECRET,
//    boleh dihapus aja, udah ga kepake lagi)
// 4. Redeploy project-nya.
// =====================================================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, text } = req.body || {};
    if (!to || !text) {
        return res.status(400).json({ error: '"to" dan "text" wajib diisi' });
    }

    try {
        const resp = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                Authorization: process.env.FONNTE_TOKEN,
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
