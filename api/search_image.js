export default async function handler(req, res) {
    const keywords = req.query.keywords || req.body?.keywords;
    let cursor = req.query.cursor || req.body?.cursor || 0;
    
    if (!keywords) return res.status(400).json({ code: -1, error: "Thiếu từ khóa tìm kiếm" });

    try {
        let collectedImages = [];
        let hasMore = true;

        // Quét liên tục đến khi gom đủ 20 bài đăng ảnh hoặc hết dữ liệu (Tối đa 5 vòng lặp để chống Timeout)
        let loops = 0;
        while (collectedImages.length < 20 && hasMore && loops < 5) {
            const formData = new URLSearchParams();
            formData.append('keywords', keywords);
            formData.append('count', 30); // Kéo nhiều để lọc
            formData.append('cursor', cursor);

            const response = await fetch('https://www.tikwm.com/api/feed/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            const data = await response.json();
            if (data.code !== 0 || !data.data || !data.data.videos) break;
            
            // Lọc chỉ lấy bài đăng có mảng images
            const imgs = data.data.videos.filter(v => v.images && v.images.length > 0);
            collectedImages.push(...imgs);
            
            cursor = data.data.cursor;
            hasMore = data.data.hasMore;
            loops++;
        }
        
        return res.status(200).json({
            code: 0,
            data: {
                videos: collectedImages.slice(0, 20),
                cursor: cursor,
                hasMore: hasMore
            }
        });
    } catch (error) {
        return res.status(500).json({ code: -1, error: error.message });
    }
}

