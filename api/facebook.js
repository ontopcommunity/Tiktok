import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: "Thieu user" });

  // --- 1. RANDOM USER AGENT (Dùng lại của bạn) ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) { console.error("Loi user-agent:", err); }

  // --- 2. HÀM LÀM TRÒN SỐ CHUẨN (Giữ nguyên của bạn) ---
  const formatStats = (num) => {
    num = parseInt(num);
    if (!num || isNaN(num)) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    const response = await fetch(`https://www.facebook.com/${user}`, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return res.status(404).json({ status: "Die" });

    const html = await response.text();
    
    // --- 3. QUÉT DỮ LIỆU THỰC TẾ ---
    const fbIdMatch = html.match(/"entity_id":"(\d+)"/) || html.match(/"userID":"(\d+)"/);
    
    // Tìm số follower và bạn bè trong JSON ẩn của Facebook
    const followerMatch = html.match(/"follower_count":(\d+)/) || html.match(/"subscriber_count":(\d+)/);
    const friendMatch = html.match(/"friend_count":(\d+)/) || html.match(/"friends":.*?count":(\d+)/);

    const result = {
      status: "Live",
      id: fbIdMatch ? fbIdMatch[1] : user,
      nickname: html.match(/<title>(.*?)<\/title>/) ? html.match(/<title>(.*?)<\/title>/)[1].split(" | ")[0] : "User",
      avatar: html.match(/property="og:image" content="(.*?)"/) ? html.match(/property="og:image" content="(.*?)"/)[1].replace(/&amp;/g, '&') : "",
      stats: { 
        follower: formatStats(followerMatch ? followerMatch[1] : 0), 
        friends: formatStats(friendMatch ? friendMatch[1] : 0) 
      }
    };

    if (html.includes('is_live":true')) result.live_status = "Đang Livestream 🔴";
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ status: "Error", error: e.message }); }
}
