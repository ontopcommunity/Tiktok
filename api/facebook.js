import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: "Thiếu user" });

  // --- 1. RANDOM USER AGENT ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) { console.error("Lỗi đọc user-agent:", err); }

  // --- 2. HÀM LÀM TRÒN SỐ (1,9K) ---
  const formatStats = (num) => {
    if (typeof num === 'string') num = num.replace(/[.,]/g, ''); // Xóa dấu chấm/phẩy nếu có
    num = parseInt(num);
    if (!num || isNaN(num)) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    const headers = { 
      "User-Agent": userAgent,
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      // QUAN TRỌNG: Phải dán Cookie vào đây để Facebook trả về dữ liệu Stats và Bio
      "Cookie": "sb=xxxx; datr=xxxx; c_user=xxxx; xs=xxxx;" 
    };

    const response = await fetch(`https://www.facebook.com/${user}`, { headers });
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại" });

    const html = await response.text();
    
    // --- 3. QUÉT DỮ LIỆU ---
    // ID Người dùng
    const fbId = html.match(/"entity_id":"(\d+)"/) || html.match(/"userID":"(\d+)"/) || html.match(/"profile_id":(\d+)/);
    
    // Tên hiển thị
    const nameMatch = html.match(/<title>(.*?)<\/title>/);
    let fullName = nameMatch ? nameMatch[1].split(" | ")[0] : "Facebook User";

    // Ảnh đại diện
    const avatar = html.match(/property="og:image" content="(.*?)"/) || html.match(/"profile_pic":\{"uri":"(.*?)"\}/);

    // Tiểu sử (Bio) - Quét từ Meta Description hoặc JSON ẩn
    const bioMatch = html.match(/"about_me_text":"(.*?)"/) || html.match(/meta name="description" content="(.*?)"/);
    let bio = bioMatch ? bioMatch[1].replace(/\\u([\d\w]{4})/gi, (m, g) => String.fromCharCode(parseInt(g, 16))) : "";

    // Thống kê: Follower và Bạn bè
    const follower = html.match(/"follower_count":(\d+)/) || html.match(/"subscriber_count":(\d+)/) || html.match(/([\d.,]+) người theo dõi/);
    const friends = html.match(/"friend_count":(\d+)/) || html.match(/([\d.,]+) bạn bè/);

    const result = {
      status: "Live",
      id: fbId ? fbId[1] : user,
      nickname: fullName,
      avatar: avatar ? avatar[1].replace(/&amp;/g, '&').replace(/\\/g, '') : "",
      bio: bio.split('...')[0], // Lấy phần bio chính xác
      stats: { 
        follower: formatStats(follower ? (follower[1] || follower[0]) : 0), 
        friends: formatStats(friends ? (friends[1] || friends[0]) : 0) 
      }
    };

    // Check Livestream
    if (html.includes('is_live":true') || html.includes('\"live_video\"')) {
        result.live_status = "Đang Livestream 🔴";
    }

    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ status: "Error", error: e.message }); }
}
