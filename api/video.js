import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { video } = req.query;
  if (!video) return res.status(400).json({ error: "Thieu link video" });

  // --- 1. RANDOM USER AGENT ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) { console.error("Loi doc user-agent:", err); }

  const formatStats = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    let targetUrl = video;
    const response = await fetch(targetUrl, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Video khong ton tai" });

    const html = await response.text();
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die" });

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
    
    const item = findKey(defaultScope, 'itemStruct');
    if (!item) return res.status(404).json({ status: "Die" });

    // --- NÂNG CẤP FULL THÔNG TIN VIDEO ---
    const result = {
      status: "Live",
      video_data: {
          id: item.id,
          description: item.desc,
          createTime: item.createTime,
          duration: item.video.duration,
          ratio: item.video.ratio,
          definition: item.video.definition,
          hashtags: item.challenges?.map(c => c.title) || [],
          mentions: item.contents?.filter(c => c.type === 1).map(c => c.userUniqueId) || []
      },
      author: {
          id: item.author.id,
          uniqueId: item.author.uniqueId,
          nickname: item.author.nickname,
          avatar: item.author.avatarLarger,
          verified: item.author.verified,
          secUid: item.author.secUid
      },
      music: {
          id: item.music.id,
          title: item.music.title,
          author: item.music.authorName,
          playUrl: item.music.playUrl ? item.music.playUrl.replace(/\.mp4/g, '.mp3') : item.music.playUrl,
          duration: item.music.duration,
          cover: item.music.coverLarge
      },
      stats: {
          play: formatStats(item.stats.playCount),
          like: formatStats(item.stats.diggCount),
          comment: formatStats(item.stats.commentCount),
          share: formatStats(item.stats.shareCount),
          save: formatStats(item.stats.collectCount),
          raw: item.stats
      },
      urls: {
          cover: item.video.cover,
          origin: item.video.playAddr,
          no_watermark: `https://tikwm.com/video/media/play/${item.id}.mp4`,
          download: item.video.downloadAddr
      }
    };

    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
