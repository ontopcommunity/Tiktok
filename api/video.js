import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // 1. Lay link video tu URL query (vd: /api/video?video=https://...)
  const { video } = req.query;

  if (!video) {
    return res.status(400).json({ 
      error: "Thieu link video. Vui long goi api theo dang: /api/video?video=https://www.tiktok.com/..." 
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

  // --- 2. FORMAT HELPER (1985 -> 1,9K) ---
  const formatStats = (num) => {
    // Chuyen string ve number neu can
    num = parseInt(num); 
    if (!num && num !== 0) return "0";
    
    // Duoi 1000 giu nguyen
    if (num < 1000) return num.toString();

    // Tu 1K den duoi 1M
    if (num < 1000000) {
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
    // Fetch follow redirect tu dong (neu user gui link rut gon vt.tiktok.com)
    const response = await fetch(video, { headers });
    
    if (!response.ok) {
        return res.status(response.status).json({ error: "Khong the truy cap link video nay" });
    }

    const html = await response.text();

    // --- 4. PARSE DATA ---
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) {
      return res.status(404).json({ error: "Khong tim thay data video trong HTML" });
    }

    const jsonStr = dataMatch[1];
    const jsonData = JSON.parse(jsonStr);
    
    let itemStruct = null;

    try {
        const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
        
        // Structure cho Video thuong nam o 'webapp.video-detail'
        if (defaultScope['webapp.video-detail'] && defaultScope['webapp.video-detail'].itemInfo) {
            itemStruct = defaultScope['webapp.video-detail'].itemInfo.itemStruct;
        } else {
             throw new Error("Cau truc JSON khong khop");
        }
    } catch (e) {
        // Fallback: Doi khi TikTok tra ve cau truc khac neu link la link ID truc tiep
        // Co the mo rong logic o day neu can
        return res.status(500).json({ error: "Loi parse struct Video TikTok: " + e.message });
    }

    // --- 5. RESPONSE ---
    const result = {
      id: itemStruct.id,
      desc: itemStruct.desc,
      createTime: itemStruct.createTime,
      author: {
          id: itemStruct.author.id,
          uniqueId: itemStruct.author.uniqueId,
          nickname: itemStruct.author.nickname,
          avatar: itemStruct.author.avatarLarger,
          signature: itemStruct.author.signature
      },
      stats: {
          play: formatStats(itemStruct.stats.playCount),
          like: formatStats(itemStruct.stats.diggCount),
          comment: formatStats(itemStruct.stats.commentCount),
          share: formatStats(itemStruct.stats.shareCount),
          save: formatStats(itemStruct.stats.collectCount)
      },
      music: {
          id: itemStruct.music.id,
          title: itemStruct.music.title,
          author: itemStruct.music.authorName,
          cover: itemStruct.music.coverLarge,
          playUrl: itemStruct.music.playUrl
      },
      video: {
          cover: itemStruct.video.cover,
          duration: itemStruct.video.duration,
          // Luu y: playAddr thuong co token hoac expire, co the khong play duoc neu thieu cookie
          playAddr: itemStruct.video.playAddr, 
          downloadAddr: itemStruct.video.downloadAddr,
          format: itemStruct.video.format
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
    }
