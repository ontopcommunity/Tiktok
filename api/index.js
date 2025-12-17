// api/index.js
export default async function handler(req, res) {
  // 1. Lay username tu URL
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ 
      error: "Thieu username. Vui long goi api theo dang: /api?username=id_tiktok" 
    });
  }

  // 2. Gia lap trinh duyet
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Referer": "https://www.tiktok.com/"
  };

  try {
    const targetUrl = `https://www.tiktok.com/@${username}`;
    
    // 3. Goi request den TikTok
    const response = await fetch(targetUrl, { headers });
    
    if (!response.ok) {
        return res.status(response.status).json({ error: "TikTok chan hoac khong tim thay user" });
    }

    const html = await response.text();

    // 4. Tim du lieu JSON trong HTML (Regex)
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) {
      return res.status(404).json({ error: "Khong tim thay du lieu trong HTML" });
    }

    // 5. Parse JSON
    const jsonStr = dataMatch[1];
    const jsonData = JSON.parse(jsonStr);
    
    let userInfo = null;
    let stats = null;

    try {
        const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
        const userModule = defaultScope['webapp.user-detail'];
        userInfo = userModule.userInfo.user;
        stats = userModule.userInfo.stats;
    } catch (e) {
        return res.status(500).json({ error: "Cau truc TikTok da thay doi, khong parse duoc" });
    }

    // 6. Tra ve ket qua
    const result = {
      id: userInfo.id,
      uniqueId: userInfo.uniqueId,
      nickname: userInfo.nickname,
      avatar: userInfo.avatarLarger,
      bio: userInfo.signature,
      verified: userInfo.verified,
      stats: {
          follower: stats.followerCount,
          following: stats.followingCount,
          heart: stats.heartCount,
          video: stats.videoCount
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
      }
