import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // 1. Lấy link video từ query
  const { video } = req.query;

  if (!video) {
    return res.status(400).json({ 
      error: "Thiếu link video. Vui lòng gọi api theo dạng: /video=https://..." 
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
    "Referer": "https://www.tiktok.com/",
    "Accept-Language": "en-US,en;q=0.9"
  };

  try {
    // --- 3. XỬ LÝ REDIRECT & FETCH ---
    let targetUrl = video;
    const checkRedirect = await fetch(video, { method: 'HEAD', headers, redirect: 'manual' });
    if (checkRedirect.status === 301 || checkRedirect.status === 302) {
        const location = checkRedirect.headers.get('location');
        if (location) targetUrl = location;
    }

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản hoặc video không tồn tại" });

    const html = await response.text();

    // --- 4. PARSE DỮ LIỆU ---
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die", error: "Không tìm thấy data video" });

    const jsonData = JSON.parse(dataMatch[1]);
    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
    
    const findKey = (obj, key) => {
        if (typeof obj !== 'object' || obj === null) return null;
        if (obj[key]) return obj[key];
        for (const k in obj) {
            const found = findKey(obj[k], key);
            if (found) return found;
        }
        return null;
    };
    
    const itemStruct = findKey(defaultScope, 'itemStruct');
    if (!itemStruct) return res.status(404).json({ status: "Die", error: "Cấu trúc TikTok đã thay đổi" });

    // --- 5. TẠO LINK NO WATERMARK ---
    const videoId = itemStruct.id;
    const noWatermarkLink = `https://tikwm.com/video/media/play/${videoId}.mp4`; 

    // --- 6. TRẢ VỀ KẾT QUẢ ---
    const result = {
      status: "Live",
      id: videoId,
      desc: itemStruct.desc,
      createTime: itemStruct.createTime,
      author: {
          uniqueId: itemStruct.author.uniqueId,
          nickname: itemStruct.author.nickname,
          avatar: itemStruct.author.avatarLarger,
          verified: itemStruct.author.verified
      },
      stats: {
          play: formatStats(itemStruct.stats.playCount),
          like: formatStats(itemStruct.stats.diggCount),
          comment: formatStats(itemStruct.stats.commentCount),
          share: formatStats(itemStruct.stats.shareCount),
          save: formatStats(itemStruct.stats.collectCount)
      },
      video: {
          cover: itemStruct.video.cover,
          duration: itemStruct.video.duration,
          playAddr: itemStruct.video.playAddr, 
          noWatermark: noWatermarkLink,
          downloadAddr: itemStruct.video.downloadAddr
      }
    };

    // Logic livestream (Ẩn nếu ko Live)
    const isLive = itemStruct.author.isLive || (itemStruct.author.roomId && itemStruct.author.roomId !== "0");
    if (isLive) {
        result.live_status = "Đang Livestream 🔴";
    }

    return res.status(200).json(result);

  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
