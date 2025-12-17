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

  // --- 2. FORMAT HELPER (20100 -> 20,1K) ---
  const formatStats = (num) => {
    if (!num && num !== 0) return "0";
    const formatted = new Intl.NumberFormat('en-US', {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1 
    }).format(num);
    return formatted.replace('.', ',');
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
        // Logic uu tien cau truc moi nhat
        if (defaultScope['webapp.user-detail'] && defaultScope['webapp.user-detail'].userInfo) {
            userInfo = defaultScope['webapp.user-detail'].userInfo.user;
            stats = defaultScope['webapp.user-detail'].userInfo.stats;
        } else {
             // Fallback
             throw new Error("Cau truc JSON khong khop");
        }
    } catch (e) {
        return res.status(500).json({ error: "Loi parse struct TikTok" });
    }

    // --- 5. RESPONSE ---
    const result = {
      id: userInfo.id,
      uniqueId: userInfo.uniqueId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatarLarger,
      bio: userInfo.signature,
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
