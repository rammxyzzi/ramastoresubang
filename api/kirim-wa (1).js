// api/kirim-wa.js
//
// Vercel Serverless Function — jadi "perantara" buat kirim pesan WA lewat
// Wasender. Kenapa perlu ini? Karena Wasender ga ngizinin browser manggil
// API mereka LANGSUNG dari halaman web (diblokir CORS). Jadi alurnya:
//
//   browser (user.js/admin.js) --> fungsi ini (/api/kirim-wa) --> Wasender
//
// Ini juga sekalian bikin WASENDER_API_KEY ga perlu lagi nongol di kode yang
// jalan di browser (user.js/admin.js) — sekarang cuma disimpan di server,
// jauh lebih aman.
//
// ============================= CARA SETUP =============================
// 1. Taruh file ini di /api/kirim-wa.js (sejajar sama webhook-wasender.js
//    di folder /api yang sama).
// 2. Di Vercel Dashboard > Settings > Environment Variables, pastikan ada:
//      WASENDER_API_KEY = API key Wasender kamu
//    (kalau kamu udah nambahin ini buat webhook-wasender.js sebelumnya,
//    berarti udah beres, ga perlu nambah lagi)
// 3. Redeploy project-nya.
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
        const resp = await fetch('https://www.wasenderapi.com/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.WASENDER_API_KEY}`
            },
            body: JSON.stringify({ to, text })
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            console.error('Wasender gagal kirim:', resp.status, data);
            return res.status(resp.status).json({ error: 'Gagal kirim WA', detail: data });
        }

        return res.status(200).json({ ok: true, data });
    } catch (err) {
        console.error('Error kirim WA:', err);
        return res.status(500).json({ error: err.message });
    }
}
