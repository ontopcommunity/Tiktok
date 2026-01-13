import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: "Thieu user" });

  // --- 1. RANDOM USER AGENT (Dùng lại logic của bạn) ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) { console.error("Loi user-agent:", err); }

  // --- 2. HÀM LÀM TRÒN SỐ (Giữ nguyên phong cách của bạn) ---
  const formatStats = (num) => {
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
      // LƯU Ý: Nếu stats vẫn về 0, bạn BẮT BUỘC phải dán Cookie vào đây
      "Cookie": "sb=xxxx; datr=xxxx; c_user=xxxx; xs=xxxx;" 
    };

    const response = await fetch(`https://www.facebook.com/${user}`, { headers });
    if (!response.ok) return res.status(404).json({ status: "Die" });

    const html = await response.text();
    
    // --- 3. QUÉT DỮ LIỆU SÂU (REGEX CHUẨN 2026) ---
    const fbId = html.match(/"entity_id":"(\d+)"/) || html.match(/"userID":"(\d+)"/) || html.match(/"profile_id":(\d+)/);
    
    // Quét Bio (Tiểu sử)
    const bioMatch = html.match(/"about_me_text":"(.*?)"/) || html.match(/meta name="description" content="(.*?)"/);
    let bio = bioMatch ? bioMatch[1].replace(/\\u([\d\w]{4})/gi, (match, grp) => String.fromCharCode(parseInt(grp, 16))) : "";

    // Quét số Follower và Bạn bè trong JSON
    const followerCount = html.match(/"follower_count":(\d+)/) || html.match(/"subscriber_count":(\d+)/) || html.match(/([\d.,]+) người theo dõi/);
    const friendCount = html.match(/"friend_count":(\d+)/) || html.match(/([\d.,]+) bạn bè/);

    const result = {
      status: "Live",
      id: fbId ? fbId[1] : user,
      nickname: html.match(/<title>(.*?)<\/title>/) ? html.match(/<title>(.*?)<\/title>/)[1].split(" | ")[0] : "User",
      avatar: html.match(/property="og:image" content="(.*?)"/) ? html.match(/property="og:image" content="(.*?)"/)[1].replace(/&amp;/g, '&') : "",
      bio: bio,
      stats: { 
        follower: formatStats(followerCount ? followerCount[1].replace(/[.,]/g, '') : 0), 
        friends: formatStats(friendCount ? friendCount[1].replace(/[.,]/g, '') : 0) 
      }
    };

    if (html.includes('is_live":true')) result.live_status = "Đang Livestream 🔴";
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ status: "Error", error: e.message }); }
}
