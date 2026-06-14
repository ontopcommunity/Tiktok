export default async function handler(req, res) {
    // Hỗ trợ cả GET và POST
    const keywords = req.query.keywords || req.body?.keywords;
    const cursor = req.query.cursor || req.body?.cursor || 0;
    const count = req.query.count || req.body?.count || 20;

    if (!keywords) {
        return res.status(400).json({ code: -1, error: "Thiếu từ khóa tìm kiếm" });
    }

    try {
        const formData = new URLSearchParams();
        formData.append('keywords', keywords);
        formData.append('count', count);
        formData.append('cursor', cursor);

        const response = await fetch('https://www.tikwm.com/api/feed/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        const data = await response.json();
        
        // Trả kết quả về cho frontend
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ code: -1, error: error.message });
    }
}

