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
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại hoặc bị chặn IP" });

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

    // --- BƯỚC 1: LẤY CHẮC CHẮN VIDEO TỪ HTML GỐC (Cách mới) ---
    let allVideos = [];
    let currentCursor = cursor;
    let hasMoreData = true;
    let tikwmStatus = "Pending";

    if (cursor == 0) {
        const itemModule = defaultScope['ItemModule'] || {};
        // Quét cạn toàn bộ Object thay vì phụ thuộc vào ItemList (TikTok hay giấu cái này)
        const htmlVideos = Object.values(itemModule).map(v => {
            if (!v || !v.id) return null;
            return {
                caption: v.desc || "",
                author: username,
                stats: {
                    play: formatStats(v.stats?.playCount || 0),
                    heart: formatStats(v.stats?.diggCount || 0),
                    comment: formatStats(v.stats?.commentCount || 0),
                    share: formatStats(v.stats?.shareCount || 0),
                    save: formatStats(v.stats?.collectCount || 0)
                },
                link: `https://www.tiktok.com/@${username}/video/${v.id}`
            };
        }).filter(Boolean);
        
        allVideos = [...htmlVideos];
    }

    // --- BƯỚC 2: VÉT CẠN THÊM BẰNG TIKWM VỚI HEADER VƯỢT CLOUDFLARE ---
    const startTime = Date.now();

    while (hasMoreData) {
        if (Date.now() - startTime > 6500) {
            tikwmStatus = "Stopped_To_Prevent_Timeout";
            break; 
        }

        try {
            const tikRes = await fetch(`https://tikwm.com/api/user/posts?unique_id=${username}&count=33&cursor=${currentCursor}`, {
                headers: {
                    "User-Agent": userAgent,
                    "Accept": "application/json, text/plain, */*",
                    "Referer": "https://tikwm.com/"
                }
            });
            
            const textData = await tikRes.text();
            
            try {
                const tikData = JSON.parse(textData);
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

                    parsedVideos.forEach(pv => {
                        if (!allVideos.some(av => av.link === pv.link)) {
                            allVideos.push(pv);
                        }
                    });

                    currentCursor = tikData.data.cursor;
                    hasMoreData = tikData.data.hasMore;
                } else {
                    tikwmStatus = tikData?.msg || "No_More_Videos_Or_Limit";
                    hasMoreData = false;
                }
            } catch (jsonErr) {
                // Lỗi xảy ra khi TikWM trả về nguyên cái bảng HTML chặn bot của Cloudflare
                tikwmStatus = `Blocked_By_Cloudflare (HTTP ${tikRes.status})`;
                hasMoreData = false;
            }
        } catch (err) {
            tikwmStatus = `Network_Error: ${err.message}`;
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
      debug_tikwm: tikwmStatus, 
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

