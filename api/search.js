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
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Không thể lấy dữ liệu tìm kiếm" });

    const html = await response.text();
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die", error: "Không tìm thấy data trên trang tìm kiếm" });

    const jsonData = JSON.parse(dataMatch[1]);
    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
    
    // Lấy toàn bộ video trả về trong object ItemModule
    const itemModule = defaultScope['ItemModule'] || {};
    
    const videos = Object.values(itemModule).map(v => {
        if (!v || !v.id) return null;
        
        // Cấu trúc author trong search đôi khi là string (ID), đôi khi là object
        const authorUsername = typeof v.author === 'object' ? v.author.uniqueId : v.author;

        return {
            caption: v.desc || "",
            author: authorUsername,
            stats: {
                play: formatStats(v.stats?.playCount || 0),
                heart: formatStats(v.stats?.diggCount || 0),
                comment: formatStats(v.stats?.commentCount || 0),
                share: formatStats(v.stats?.shareCount || 0),
                save: formatStats(v.stats?.collectCount || 0)
            },
            link: `https://www.tiktok.com/@${authorUsername}/video/${v.id}`
        };
    }).filter(Boolean);

    return res.status(200).json({
        status: "Success",
        keyword: q,
        total_retrieved: videos.length, // Lấy được bao nhiêu sẽ hiển thị bấy nhiêu (thường max ~30)
        data: videos
    });
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}

