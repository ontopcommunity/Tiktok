export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    // Thêm tham số commentId để lấy bình luận trả lời
    const { url, id, cursor = 0, count = 30, commentId } = req.query;

    if (!url && !id) { return res.status(400).json({ error: 'Thiếu url hoặc id' }); }

    try {
        let apiUrl = '';
        if (commentId) {
            // Nếu có commentId -> Gọi API lấy bình luận trả lời (replies)
            apiUrl = `https://www.tikwm.com/api/comment/reply/?comment_id=${commentId}&video_id=${id}&cursor=${cursor}&count=${count}`;
        } else {
            // Nếu không -> Gọi API lấy bình luận gốc
            const targetUrl = url || `https://www.tiktok.com/@user/video/${id}`;
            apiUrl = `https://www.tikwm.com/api/comment/list/?url=${encodeURIComponent(targetUrl)}&count=${count}&cursor=${cursor}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.code === 0) {
            return res.status(200).json(data.data);
        } else {
            return res.status(400).json({ error: data.msg || 'Không thể lấy dữ liệu.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Lỗi máy chủ.', details: error.message });
    }
}