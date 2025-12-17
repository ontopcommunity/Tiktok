import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
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
  } catch (err) {
    console.error("Loi doc file user-agent:", err);
  }

  // --- 2. FORMAT HELPER (CUSTOM FLOOR) ---
  // Yeu cau: 1985 -> 1,9K (khong lam tron len 2K)
  const formatStats = (num) => {
    if (!num && num !== 0) return "0";
    
    // Duoi 1000 giu nguyen
    if (num < 1000) return num.toString();

    // Tu 1K den duoi 1M
    if (num < 1000000) {
        // Chia 100 roi lam tron xuong, sau do chia 10 de lay 1 so thap phan
        // VD: 1985 / 100 = 19.85 -> floor = 19 -> /10 = 1.9
        const k = Math.floor(num / 100) / 10; 
        return k.toString().replace('.', ',') + "K";
    }

    // Tu 1M den duoi 1B
    if (num < 1000000000) {
        const m = Math.floor(num / 100000) / 10;
        return m.toString().replace('.', ',') + "M";
    }

    // Tren 1B
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
    
    if (!response.ok) {
        return res.status(response.status).json({ error: "TikTok chan hoac khong tim thay user" });
    }

    const html = await response.text();

    // --- 4. PARSE DATA ---
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) {
      return res.status(404).json({ error: "Khong tim thay data trong HTML" });
    }

    const jsonStr = dataMatch[1];
    const jsonData = JSON.parse(jsonStr);
    
    let userInfo = null;
    let stats = null;

    try {
        const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
        if (defaultScope['webapp.user-detail'] && defaultScope['webapp.user-detail'].userInfo) {
            userInfo = defaultScope['webapp.user-detail'].userInfo.user;
            stats = defaultScope['webapp.user-detail'].userInfo.stats;
        } else {
             throw new Error("Cau truc JSON khong khop");
        }
    } catch (e) {
        return res.status(500).json({ error: "Loi parse struct TikTok" });
    }

    // --- 5. LAY BIO LINK ---
    // TikTok luu link o userInfo.bioLink.link
    let bioUrl = "";
    if (userInfo.bioLink && userInfo.bioLink.link) {
        bioUrl = userInfo.bioLink.link;
    }

    // --- 6. RESPONSE ---
    const result = {
      id: userInfo.id,
      uniqueId: userInfo.uniqueId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatarLarger,
      bio: userInfo.signature,
      bio_url: bioUrl, // <--- Link bio o day
      verified: userInfo.verified,
      stats: {
          follower: formatStats(stats.followerCount),
          following: formatStats(stats.followingCount),
          heart: formatStats(stats.heartCount),
          video: formatStats(stats.videoCount)
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
