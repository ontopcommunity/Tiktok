import fs from 'fs';
import path from 'path';

async function safeFetch(url, headers) {
  try {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch (err) {}

  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        return await res.json();
      }
    } catch (err) {}
  }
  return null;
}

export default async function handler(req, res) {
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

    if (cursor == 0) {
        const infoData = await safeFetch(`https://www.tikwm.com/api/user/info?unique_id=${username}`, headers);
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

    const postsData = await safeFetch(`https://www.tikwm.com/api/user/posts?unique_id=${username}&count=30&cursor=${cursor}`, headers);

    if (!postsData) {
        return res.status(500).json({ 
            status: "Error", 
            error: "TikWM API không thể truy cập qua cả kết nối trực tiếp và Proxy trung gian." 
        });
    }

    if (cursor == 0 && !result.author && postsData.code === 0 && postsData.data && postsData.data.videos && postsData.data.videos.length > 0) {
        const sample = postsData.data.videos[0].author;
        result.author = { 
            uniqueId: sample.unique_id || sample.uniqueId, 
            nickname: sample.nickname, 
            avatar: sample.avatar_larger || sample.avatar, 
            verified: sample.is_verify || sample.verified || false 
        };
    }

    if (postsData.code === 0 && postsData.data && postsData.data.videos) {
        result.videos = postsData.data.videos.map(v => ({
            id: v.video_id || v.id, 
            caption: v.title || v.desc || "", 
            createTime: v.create_time,
            link: `https://www.tiktok.com/@${username}/video/${v.video_id || v.id}`,
            urls: { cover: v.cover, no_watermark: v.play }, 
            music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            stats: { 
                play: formatStats(v.play_count), 
                like: formatStats(v.digg_count), 
                comment: formatStats(v.comment_count), 
                share: formatStats(v.share_count) 
            }, 
            images: v.images || null
        }));
        result.hasMore = postsData.data.hasMore;
        result.cursor = postsData.data.cursor;
    } else {
        result.videos = []; 
        result.hasMore = false; 
        result.cursor = cursor;
    }

    if (!result.author && result.videos.length === 0) return res.status(404).json({ status: "Die", error: "Không tìm thấy user hoặc bị chặn lấy dữ liệu." });

    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
