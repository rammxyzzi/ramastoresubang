export default async function handler(req, res) {
    // Pastikan request menggunakan method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { to, text } = req.body;

    // API Key kamu aman di sisi server ini
    const WASENDER_API_KEY = 'wsm_wc8H2V1Be9DGkcxeFhERIYbftqp92zZ186cH53IrecQXbRin';
    const WASENDER_ENDPOINT = 'https://app.wasender.dev/api/send-message';

    try {
        const response = await fetch(WASENDER_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${WASENDER_API_KEY}` 
            },
            body: JSON.stringify({ to, text })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error wasender:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
