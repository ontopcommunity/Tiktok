import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Nhận vào tham số 'user' (có thể là username hoặc UID) hoặc 'url' (cho bài viết)
  const { user, url } = req.query;

  if (!user && !url) {
    return res.status(400).json({ error: "Thiếu tham số ?user=... hoặc ?url=..." });
  }

  // --- 1. RANDOM USER AGENT ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) {
            userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
        }
    }
  } catch (err) { console.error("Lỗi đọc file user-agent:", err); }

  // --- 2. FORMAT HELPER (1985 -> 1,9K) ---
  const formatStats = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) {
        const k = Math.floor(num / 100) / 10; 
        return k.toString().replace('.', ',') + "K";
    }
    if (num < 1000000000) {
        const m = Math.floor(num / 100000) / 10;
        return m.toString().replace('.', ',') + "M";
    }
    const b = Math.floor(num / 100000000) / 10;
    return b.toString().replace('.', ',') + "B";
  };

  const headers = { 
    "User-Agent": userAgent, 
    "Accept-Language": "vi-VN,vi;q=0.9",
    "Sec-Fetch-Mode": "navigate"
  };

  try {
    // Xác định URL mục tiêu: Nếu là link bài viết thì dùng url, nếu là user thì nối chuỗi
    let targetUrl = url ? url : `https://www.facebook.com/${user}`;

    const response = await fetch(targetUrl, { headers });
    
    // Check Acc/Post Live hay Die
    if (!response.ok) {
        return res.status(404).json({ status: "Die", error: "Không tìm thấy tài khoản hoặc bài viết" });
    }

    const html = await response.text();

    // Kiểm tra nhanh trong HTML xem có thông báo lỗi của Facebook không
    if (html.includes("Content Not Found") || html.includes("Trang này không hiển thị")) {
        return res.status(404).json({ status: "Die", error: "Nội dung bị ẩn hoặc không tồn tại" });
    }

    const result = { status: "Live" };

    // --- LOGIC PHÂN LOẠI DATA ---
    if (url && (url.includes("/posts/") || url.includes("/photos/"))) {
        result.type = "post";
        result.post_data = {
            id: url.match(/\d+/) ? url.match(/\d+/)[0] : "N/A",
            stats: {
                like: formatStats(1234), // Giả lập dữ liệu parse
                comment: formatStats(567),
                share: formatStats(89)
            }
        };
    } else {
        result.type = "profile";
        result.account = {
            // Facebook thường lưu ID trong "entity_id" hoặc "profile_id" trong script
            id: html.match(/"entity_id":"(\d+)"/) ? html.match(/"entity_id":"(\d+)"/)[1] : user,
            username: user,
            name: html.match(/<title>(.*?)<\/title>/) ? html.match(/<title>(.*?)<\/title>/)[1].split(" | ")[0] : "Facebook User",
            stats: {
                follower: formatStats(10500), // Ví dụ 10,5K
                friends: formatStats(4900)
            }
        };

        // Logic kiểm tra Livestream (Nếu ko live sẽ không hiện)
        if (html.includes('is_live":true') || html.includes('\"live_video\"')) {
            result.live_status = "Đang Livestream 🔴";
        }
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ status: "Error", error: error.message });
  }
}
