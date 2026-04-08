import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { username, cursor = 0 } = req.query; 
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
    const response = await fetch(`https://www.tiktok.com/@${username}`, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại" });

    const html = await response.text();
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                      || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    if (!dataMatch) return res.status(404).json({ status: "Die", error: "Không tìm thấy data user" });

    const jsonData = JSON.parse(dataMatch[1]);
    const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
    const userDetail = defaultScope['webapp.user-detail'];

    if (!userDetail) return res.status(404).json({ status: "Die", error: "Lỗi cấu trúc dữ liệu" });

    const u = userDetail.userInfo.user;
    const s = userDetail.userInfo.stats;

    // --- BƯỚC 1: LẤY CHẮC CHẮN VIDEO TỪ HTML GỐC ---
    let allVideos = [];
    let currentCursor = cursor;
    let hasMoreData = true;
    let tikwmStatus = "Pending";

    // Chỉ lấy từ HTML nếu đây là lần tải đầu tiên (cursor = 0)
    if (cursor == 0) {
        const itemModule = defaultScope['ItemModule'] || {};
        const videoListIds = defaultScope['ItemList']?.['user-post']?.list || [];
        
        const htmlVideos = videoListIds.map(id => {
            const v = itemModule[id];
            if(!v) return null;
            return {
                caption: v.desc || "",
                author: username,
                stats: {
                    play: formatStats(v.stats?.playCount),
                    heart: formatStats(v.stats?.diggCount),
                    comment: formatStats(v.stats?.commentCount),
                    share: formatStats(v.stats?.shareCount),
                    save: formatStats(v.stats?.collectCount)
                },
                link: `https://www.tiktok.com/@${username}/video/${v.id}`
            };
        }).filter(Boolean);
        
        allVideos = [...htmlVideos];
    }

    // --- BƯỚC 2: VÉT CẠN THÊM BẰNG TIKWM (Để lấy video cũ) ---
    const startTime = Date.now();

    while (hasMoreData) {
        if (Date.now() - startTime > 6500) {
            break; // Ngắt sớm tránh timeout Vercel
        }

        try {
            const tikRes = await fetch(`https://www.tikwm.com/api/user/posts?unique_id=${username}&count=33&cursor=${currentCursor}`);
            const tikData = await tikRes.json();

            if (tikData && tikData.code === 0 && tikData.data && tikData.data.videos) {
                tikwmStatus = "Success";
                const parsedVideos = tikData.data.videos.map(v => ({
                    caption: v.title || "",
                    author: username,
                    stats: {
                        play: formatStats(v.play_count),
                        heart: formatStats(v.digg_count),
                        comment: formatStats(v.comment_count),
                        share: formatStats(v.share_count),
                        save: formatStats(v.download_count)
                    },
                    link: `https://www.tiktok.com/@${username}/video/${v.video_id}`
                }));

                // Lọc trùng lặp (tránh việc TikWM trả về video đã có ở Bước 1)
                parsedVideos.forEach(pv => {
                    if (!allVideos.some(av => av.link === pv.link)) {
                        allVideos.push(pv);
                    }
                });

                currentCursor = tikData.data.cursor;
                hasMoreData = tikData.data.hasMore;
            } else {
                // TikWM báo lỗi hoặc hết video
                tikwmStatus = tikData?.msg || "Failed_or_End";
                hasMoreData = false;
            }
        } catch (err) {
            tikwmStatus = "Error_Fetch";
            hasMoreData = false;
        }
    }

    // --- 3. TỔNG HỢP KẾT QUẢ ---
    const result = {
      status: "Live",
      author: {
          id: u.id,
          uniqueId: u.uniqueId,
          nickname: u.nickname,
          avatar: u.avatarLarger,
          signature: u.signature,
          verified: u.verified,
          createTime: u.createTime || null,
          bioLink: u.bioLink?.link || ""
      },
      stats_formatted: {
          follower: formatStats(s.followerCount),
          following: formatStats(s.followingCount),
          heart: formatStats(s.heartCount),
          video: formatStats(s.videoCount),
          friend: formatStats(s.friendCount)
      },
      debug_tikwm: tikwmStatus, // Hiện trạng thái TikWM để bạn dễ debug nếu lỗi
      video_retrieved_count: allVideos.length,
      has_more_videos: hasMoreData,
      next_cursor: currentCursor,
      videos: allVideos 
    };

    if (u.isLive || (u.roomId && u.roomId !== "0")) {
        result.live_info = {
            is_live: true,
            status: "Đang Livestream 🔴",
            roomId: u.roomId
        };
    }

    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
