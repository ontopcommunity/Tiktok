import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Lấy username từ query
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ 
      error: "Thieu username. Vui long goi api theo dang: /api?username=id_tiktok" 
    });
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
  } catch (err) { console.error("Loi doc file user-agent:", err); }

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
    "Referer": "https://www.tiktok.com/",
    "Accept-Language": "en-US,en;q=0.9"
  };

  try {
    // --- 3. REQUEST TIKTOK ---
    const targetUrl = `https://www.tiktok.com/@${username}`;
    const response = await fetch(targetUrl, { headers });
    
    // Check Acc Die
    if (!response.ok) {
        return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại hoặc bị ban" });
    }

    const html = await response.text();

    // --- 4. PARSE DATA ---
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die", error: "Khong tim thay data" });

    const jsonData = JSON.parse(dataMatch[1]);
    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
    
    let userInfo = null;
    let stats = null;

    try {
        if (defaultScope['webapp.user-detail'] && defaultScope['webapp.user-detail'].userInfo) {
            userInfo = defaultScope['webapp.user-detail'].userInfo.user;
            stats = defaultScope['webapp.user-detail'].userInfo.stats;
        } else {
             throw new Error();
        }
    } catch (e) {
        return res.status(404).json({ status: "Die", error: "Lỗi cấu trúc hoặc tài khoản bị ẩn" });
    }

    // --- 5. RESPONSE ---
    const result = {
      status: "Live",
      id: userInfo.id,
      uniqueId: userInfo.uniqueId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatarLarger,
      bio: userInfo.signature,
      bio_url: userInfo.bioLink?.link || "",
      verified: userInfo.verified,
      stats: {
          follower: formatStats(stats.followerCount),
          following: formatStats(stats.followingCount),
          heart: formatStats(stats.heartCount),
          video: formatStats(stats.videoCount)
      }
    };

    // Logic kiểm tra Livestream (Nếu ko live sẽ không hiện)
    const isLive = userInfo.isLive || (userInfo.roomId && userInfo.roomId !== "0");
    if (isLive) {
        result.live_status = "Đang Livestream 🔴";
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ status: "Error", error: error.message });
  }
}
