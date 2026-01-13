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
      "Accept-Language": "vi-VN,vi;q=0.9",
      // QUAN TRỌNG: Bạn dán Cookie vào đây để lấy được 100% số liệu thực
      "Cookie": "datr=xxxx; sb=xxxx; c_user=xxxx; xs=xxxx;" 
    };

    const response = await fetch(`https://www.facebook.com/${user}`, { headers });
    if (!response.ok) return res.status(404).json({ status: "Die" });

    const html = await response.text();
    
    // --- 2. QUÉT DỮ LIỆU TỪ NHIỀU NGUỒN TRONG HTML ---
    const fbId = html.match(/"entity_id":"(\d+)"/) || html.match(/"userID":"(\d+)"/) || html.match(/"profile_id":(\d+)/);
    
    // Quét số Follower (Dùng cho cả Fanpage và Profile)
    const follower = html.match(/"follower_count":(\d+)/) || html.match(/(\d+) người theo dõi/);
    // Quét số Bạn bè
    const friends = html.match(/"friend_count":(\d+)/) || html.match(/(\d+) bạn bè/);

    const result = {
      status: "Live",
      id: fbId ? fbId[1] : user,
      nickname: html.match(/<title>(.*?)<\/title>/) ? html.match(/<title>(.*?)<\/title>/)[1].split(" | ")[0] : "User",
      avatar: html.match(/property="og:image" content="(.*?)"/) ? html.match(/property="og:image" content="(.*?)"/)[1].replace(/&amp;/g, '&') : "",
      stats: { 
        follower: formatStats(follower ? follower[1] : 0), 
        friends: formatStats(friends ? friends[1] : 0) 
      }
    };

    if (html.includes('is_live":true')) result.live_status = "Đang Livestream 🔴";
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ status: "Error", error: e.message }); }
}
