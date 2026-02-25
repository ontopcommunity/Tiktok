const axios = require('axios');

// Hàm tự động quét lấy Client ID mới nhất
async function getLiveClientId() {
    try {
        const homePage = await axios.get('https://soundcloud.com', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const scriptUrls = homePage.data.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[a-zA-Z0-9-]+\.js/g);
        for (const url of scriptUrls.reverse()) {
            const scriptContent = await axios.get(url);
            const match = scriptContent.data.match(/client_id[:=]\s*["']([a-zA-Z0-9]{32})["']/);
            if (match && match[1]) return match[1];
        }
    } catch (e) { return null; }
}

export default async function handler(req, res) {
    const { q } = req.query; // Lấy từ khóa từ query string (?q=...)
    const clientId = await getLiveClientId();
    
    if (!clientId) return res.status(500).json({ error: "Lỗi lấy Client ID" });

    // Xác định URL: Nếu có 'q' thì tìm kiếm, không thì lấy Charts (Top 10)
    const baseUrl = q 
        ? `https://api-v2.soundcloud.com/search/tracks` 
        : `https://api-v2.soundcloud.com/charts`;

    const params = q ? {
        q: q, // Axios sẽ tự động encodeURIComponent cho bạn ở đây
        client_id: clientId,
        limit: 10
    } : {
        kind: 'top',
        genre: 'soundcloud:genres:all-music',
        client_id: clientId,
        limit: 10
    };

    try {
        const response = await axios.get(baseUrl, {
            params: params,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        // SoundCloud trả về cấu trúc khác nhau giữa Search và Charts
        const rawData = q ? response.data.collection : response.data.collection.map(item => item.track);

        const result = rawData.slice(0, 10).map((t, index) => {
            const mins = Math.floor(t.duration / 60000);
            const secs = Math.floor((t.duration % 60000) / 1000);
            return {
                rank: index + 1,
                title: t.title,
                artist: t.user.username,
                duration: `${mins}:${secs.toString().padStart(2, '0')}`,
                play_count: t.playback_count || 0,
                link: t.permalink_url,
                thumbnail: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : t.user.avatar_url
            };
        });

        res.status(200).json({
            type: q ? "search" : "charts",
            query: q || "top-10",
            data: result
        });

    } catch (error) {
        res.status(500).json({ error: "Lỗi kết nối SoundCloud API" });
    }
}

