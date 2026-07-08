export default async function handler(req, res) {
    // Cấu hình CORS để cho phép frontend gọi API mượt mà
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Bỏ qua request OPTIONS của trình duyệt (Preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Lấy các tham số từ URL do frontend gửi lên
    const { url, id, cursor = 0, count = 30 } = req.query;

    if (!url && !id) {
        return res.status(400).json({ error: 'Thiếu tham số url hoặc id của video' });
    }

    try {
        // Ưu tiên dùng URL, nếu không có URL thì tự động ráp link từ ID
        const targetUrl = url || `https://www.tiktok.com/@user/video/${id}`;
        
        // Gọi đến API chuyên dụng để cào bình luận
        const apiUrl = `https://www.tikwm.com/api/comment/list/?url=${encodeURIComponent(targetUrl)}&count=${count}&cursor=${cursor}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        // Kiểm tra xem dữ liệu cào về có thành công không
        if (data.code === 0) {
            // Trả về trực tiếp object data (chứa comments, cursor, hasMore) cho frontend
            return res.status(200).json(data.data);
        } else {
            return res.status(400).json({ error: data.msg || 'Không thể lấy dữ liệu bình luận từ video này (Có thể video bị khóa bình luận).' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Lỗi máy chủ khi truy xuất bình luận.', details: error.message });
    }
}
