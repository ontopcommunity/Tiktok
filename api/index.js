import fs from 'fs';
import path from 'path';

// Helper to perform fetch with a timeout using AbortController
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 10000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export default async function handler(req, res) {
  // CORS
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
res.setHeader(
  "Access-Control-Allow-Headers",
  "Origin, X-Requested-With, Content-Type, Accept, Authorization"
);

if (req.method === "OPTIONS") {
  return res.status(200).end();
}
  const username = req.query.username || req.body?.username;
  const cursor = req.query.cursor || 0; 
  
  if (!username) return res.status(400).json({ error: "Thiếu username" });

  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"; 
  try {
    const filePath = path.join(process.cwd(), 'user-agents.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const agents = fileContent.split('\n').filter(line => line.trim() !== '');
        if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
    }
  } catch (err) {}

  const formatStats = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    let result = { status: "Live" };
    
    const headers = {
        "User-Agent": userAgent,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.tikwm.com/"
    };

    let parsedCursor = parseInt(cursor) || 0;

    if (parsedCursor === 0) {
        try {
            const infoRes = await fetchWithTimeout(`https://www.tikwm.com/api/user/info?unique_id=${username}`, { headers });
            const contentType = infoRes.headers.get("content-type");
            if (infoRes.ok && contentType && contentType.includes("application/json")) {
                const infoData = await infoRes.json();
                if (infoData && infoData.code === 0 && infoData.data) {
                    const u = infoData.data.user;
                    const s = infoData.data.stats;
                    result.author = {
                        id: u.id || "",
                        uniqueId: u.unique_id || u.uniqueId || username,
                        nickname: u.nickname || "",
                        avatar: u.avatar_larger || u.avatarLarger || u.avatar || "",
                        signature: u.signature || "",
                        verified: u.is_verify || u.verified || false,
                        createTime: u.create_time || u.createTime || null,
                        bioLink: u.bio_link?.link || u.bioLink?.link || ""
                    };
                    result.stats_formatted = {
                        follower: formatStats(s.followerCount || s.follower_count || 0),
                        following: formatStats(s.followingCount || s.following_count || 0),
                        heart: formatStats(s.heartCount || s.heart_count || 0),
                        video: formatStats(s.videoCount || s.video_count || 0)
                    };
                }
            }
        } catch (err) {}
    }

    const channelRes = await fetchWithTimeout(`https://superinternetapi.vercel.app/api/channel?url=https://tiktok.com/@${username}`);
    let channelData = null;
    try {
        channelData = await channelRes.json();
    } catch (err) {}

    let videoLinks = [];
    const extractLinks = (obj) => {
        if (!obj) return;
        if (typeof obj === 'object') {
            if (obj.source && typeof obj.source === 'string') {
                videoLinks.push(obj.source);
            }
            for (let key in obj) {
                if (typeof obj[key] === 'object') extractLinks(obj[key]);
            }
        }
    };
    extractLinks(channelData);
    videoLinks = [...new Set(videoLinks)];

    const start = parsedCursor;
    const end = start + 30;
    const currentLinks = videoLinks.slice(start, end);

    const videoPromises = currentLinks.map(async (videoUrl) => {
        try {
            let scrapedData = {};
            let scrapedImages = null;
            let createTime = null;
            
            try {
                const htmlRes = await fetchWithTimeout(videoUrl, { headers: { "User-Agent": userAgent } });
                const html = await htmlRes.text();
                const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);
                
                if (dataMatch) {
                    const jsonData = JSON.parse(dataMatch[1]);
                    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
                    const itemStruct = defaultScope['webapp.video-detail']?.itemInfo?.itemStruct || defaultScope.ItemModule?.[Object.keys(defaultScope.ItemModule)[0]];
                    
                    if (itemStruct) {
                        scrapedData = itemStruct;
                        createTime = itemStruct.createTime;
                        if (itemStruct.imagePost && itemStruct.imagePost.images) {
                            scrapedImages = itemStruct.imagePost.images.map(img => img.imageURL.urlList[0]);
                        }
                    }
                }
            } catch (e) {}

            const response = await fetchWithTimeout(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`);
            let v = {};
            try {
                const tikwmData = await response.json();
                v = tikwmData.data || {};
            } catch (e) {}

            if (!v.id && !scrapedData.id) {
                return null;
            }

            const finalCreateTime = v.create_time || createTime || null;
            const finalImages = scrapedImages || v.images || null;

            return {
                id: v.id || scrapedData.id,
                caption: v.title || scrapedData.desc || "",
                createTime: finalCreateTime,
                link: videoUrl,
                urls: { 
                    cover: v.cover || scrapedData.video?.cover, 
                    no_watermark: v.play || scrapedData.video?.playAddr 
                },
                music: { 
                    playUrl: v.music || scrapedData.music?.playUrl, 
                    title: v.music_info?.title || scrapedData.music?.title || "Âm thanh gốc" 
                },
                stats: { 
                    play: formatStats(v.play_count || scrapedData.stats?.playCount || 0), 
                    like: formatStats(v.digg_count || scrapedData.stats?.diggCount || 0), 
                    comment: formatStats(v.comment_count || scrapedData.stats?.commentCount || 0), 
                    share: formatStats(v.share_count || scrapedData.stats?.shareCount || 0) 
                },
                images: finalImages,
                authorSample: {
                    uniqueId: v.author?.unique_id || scrapedData.author?.uniqueId,
                    nickname: v.author?.nickname || scrapedData.author?.nickname,
                    avatar: v.author?.avatar_larger || v.author?.avatar || scrapedData.author?.avatarLarger,
                    verified: v.author?.is_verify || scrapedData.author?.verified || false
                }
            };
        } catch (err) {
            return null;
        }
    });

    const resolvedVideos = (await Promise.all(videoPromises)).filter(v => v !== null);

    if (parsedCursor === 0 && !result.author && resolvedVideos.length > 0) {
        result.author = resolvedVideos[0].authorSample;
    }

    result.videos = resolvedVideos.map(v => {
        delete v.authorSample;
        return v;
    });

    result.hasMore = end < videoLinks.length;
    result.cursor = result.hasMore ? end : parsedCursor;

    if (!result.author && result.videos.length === 0) {
        return res.status(404).json({ status: "Die", error: "Không tìm thấy user hoặc bị chặn lấy dữ liệu." });
    }

    return res.status(200).json(result);
  } catch (error) { 
    return res.status(500).json({ status: "Error", error: error.message }); 
  }
}
