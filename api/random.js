import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Thiếu từ khóa tìm kiếm (q)" });

  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) { console.error("Lỗi đọc file user-agent:", err); }

  const formatStats = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    const response = await fetch(`https://www.tiktok.com/search/video?q=${encodeURIComponent(q)}`, { 
        headers: { "User-Agent": userAgent } 
    });
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Không thể kết nối máy chủ TikTok" });

    const html = await response.text();
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die", error: "Không tìm thấy dữ liệu" });

    const jsonData = JSON.parse(dataMatch[1]);
    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
    const itemModule = defaultScope['ItemModule'] || {};
    
    const videoArray = Object.values(itemModule);
    if (videoArray.length === 0) {
        return res.status(404).json({ status: "Die", error: "Không tìm thấy video nào cho từ khóa này" });
    }

    // BỐC NGẪU NHIÊN 1 VIDEO
    const item = videoArray[Math.floor(Math.random() * videoArray.length)];
    const authorUsername = typeof item.author === 'object' ? item.author.uniqueId : item.author;

    // XUẤT RA THEO CẤU TRÚC NHƯ CỦA api/video.js
    const result = {
      status: "Success",
      keyword_searched: q,
      video_data: {
          id: item.id,
          description: item.desc,
          createTime: item.createTime,
          duration: item.video?.duration,
          ratio: item.video?.ratio,
          definition: item.video?.definition,
          hashtags: item.challenges?.map(c => c.title) || [],
      },
      author: {
          id: typeof item.author === 'object' ? item.author.id : authorUsername,
          uniqueId: authorUsername,
          nickname: typeof item.author === 'object' ? item.author.nickname : "Unknown"
      },
      music: {
          id: item.music?.id,
          title: item.music?.title,
          author: item.music?.authorName,
          playUrl: `https://tikwm.com/video/music/${item.id}.mp3`,
          duration: item.music?.duration,
          cover: item.music?.coverLarge
      },
      stats: {
          play: formatStats(item.stats?.playCount || 0),
          like: formatStats(item.stats?.diggCount || 0),
          comment: formatStats(item.stats?.commentCount || 0),
          share: formatStats(item.stats?.shareCount || 0),
          save: formatStats(item.stats?.collectCount || 0),
          raw: item.stats
      },
      urls: {
          cover: item.video?.cover,
          origin: item.video?.playAddr,
          no_watermark: `https://tikwm.com/video/media/play/${item.id}.mp4`,
          download: item.video?.downloadAddr
      }
    };

    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}

