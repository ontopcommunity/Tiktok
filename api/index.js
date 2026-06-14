import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const username = req.query.username || req.body?.username;
  const cursor = req.query.cursor || 0; // Trạng thái trang (0 = trang đầu)
  
  if (!username) return res.status(400).json({ error: "Thiếu username" });

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
    let result = { status: "Live" };

    // BƯỚC 1: Lấy Info User bằng thuật toán HTML cũ (Chỉ chạy ở trang đầu để tối ưu)
    if (cursor == 0) {
        try {
            const response = await fetch(`https://www.tiktok.com/@${username}`, { headers: { "User-Agent": userAgent } });
            if (response.ok) {
                const html = await response.text();
                const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                                  || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);
                
                if (dataMatch) {
                    const jsonData = JSON.parse(dataMatch[1]);
                    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
                    const userDetail = defaultScope['webapp.user-detail'];

                    if (userDetail && userDetail.userInfo) {
                        const u = userDetail.userInfo.user;
                        const s = userDetail.userInfo.stats;
                        
                        result.author = {
                            id: u.id,
                            uniqueId: u.uniqueId,
                            nickname: u.nickname,
                            avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb,
                            signature: u.signature,
                            verified: u.verified,
                            createTime: u.createTime || null,
                            bioLink: u.bioLink?.link || ""
                        };
                        result.stats_formatted = {
                            follower: formatStats(s.followerCount),
                            following: formatStats(s.followingCount),
                            heart: formatStats(s.heartCount),
                            video: formatStats(s.videoCount),
                            friend: formatStats(s.friendCount) // Cột Friend chỉ lấy từ HTML mới có
                        };
                        if (u.isLive || (u.roomId && u.roomId !== "0")) {
                            result.live_info = {
                                is_live: true,
                                status: "Đang Livestream 🔴",
                                roomId: u.roomId
                            };
                        }
                    }
                }
            }
        } catch (err) { console.error("Lỗi cào HTML, sẽ lấy Info phụ qua TikWM"); }
    }

    // BƯỚC 2: Gọi API lấy danh sách Video (Quét toàn bộ video có phân trang)
    const postsRes = await fetch(`https://www.tikwm.com/api/user/posts?unique_id=${username}&count=30&cursor=${cursor}`);
    const postsData = await postsRes.json();

    // Fallback nếu HTML ở bước 1 bị Cloudflare chặn
    if (cursor == 0 && !result.author && postsData.code === 0 && postsData.data && postsData.data.videos && postsData.data.videos.length > 0) {
        const sample = postsData.data.videos[0].author;
        result.author = {
            uniqueId: sample.unique_id,
            nickname: sample.nickname,
            avatar: sample.avatar || sample.avatar_larger
        };
    }

    // Format lại dữ liệu video
    if (postsData.code === 0 && postsData.data && postsData.data.videos) {
        result.videos = postsData.data.videos.map(v => ({
            id: v.video_id,
            caption: v.title,
            link: `https://www.tiktok.com/@${username}/video/${v.video_id}`,
            urls: { cover: v.cover, no_watermark: v.play },
            music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            stats: {
                play: formatStats(v.play_count),
                like: formatStats(v.digg_count),
                comment: formatStats(v.comment_count),
                share: formatStats(v.share_count)
            }
        }));
        result.hasMore = postsData.data.hasMore;
        result.cursor = postsData.data.cursor;
    } else {
        result.videos = [];
        result.hasMore = false;
        result.cursor = cursor;
    }

    if (!result.author && result.videos.length === 0) {
        return res.status(404).json({ status: "Die", error: "Không tìm thấy user hoặc bị chặn lấy dữ liệu." });
    }

    return res.status(200).json(result);
  } catch (error) { 
    return res.status(500).json({ status: "Error", error: error.message }); 
  }
}

