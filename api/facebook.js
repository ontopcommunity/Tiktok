import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Nhận tham số 'user' (có thể là username hoặc ID số)
  const { user } = req.query;

  if (!user) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng (?user=username_hoac_ID)" });
  }

  // --- 1. RANDOM USER AGENT ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; 
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

  // --- 2. HÀM LÀM TRÒN SỐ (1985 -> 1,9K) ---
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
    "Referer": "https://www.facebook.com/",
    "Sec-Fetch-Mode": "navigate"
  };

  try {
    const targetUrl = `https://www.facebook.com/${user}`;
    const response = await fetch(targetUrl, { headers });
    
    // Check Acc Live hay Die
    if (!response.ok) {
        return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại hoặc bị chặn" });
    }

    const html = await response.text();

    // Kiểm tra dấu hiệu tài khoản bị ẩn hoặc lỗi nội dung
    if (html.includes("Content Not Found") || html.includes("Trang này không hiển thị")) {
        return res.status(404).json({ status: "Die", error: "Tài khoản bị ẩn hoặc không tồn tại" });
    }

    // --- 3. TRÍCH XUẤT DỮ LIỆU (REGEX) ---
    // Tìm ID số của tài khoản
    const fbIdMatch = html.match(/"entity_id":"(\d+)"/) 
                   || html.match(/"userID":"(\d+)"/) 
                   || html.match(/"profile_id":(\d+)/);

    // Tìm tên hiển thị từ thẻ title
    const nameMatch = html.match(/<title>(.*?)<\/title>/);
    let fullName = nameMatch ? nameMatch[1].split(" | ")[0] : "Facebook User";

    const result = {
      status: "Live",
      account: {
        id: fbIdMatch ? fbIdMatch[1] : user,
        username: user,
        nickname: fullName,
        avatar: html.match(/property="og:image" content="(.*?)"/) ? html.match(/property="og:image" content="(.*?)"/)[1].replace(/&amp;/g, '&') : "N/A",
        stats: {
          follower: formatStats(10500), // Dữ liệu mẫu - Cần Cookie để lấy số thực
          friends: formatStats(4900)
        }
      }
    };

    // --- 4. LOGIC CHECK LIVESTREAM (Chỉ hiện nếu đang Live) ---
    if (html.includes('is_live":true') || html.includes('\"live_video\"')) {
        result.live_status = "Đang Livestream 🔴";
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ status: "Error", error: error.message });
  }
}
