import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { username } = req.query; 
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

    // --- BÓC TÁCH VIDEO GỐC TỪ HTML ---
    const itemModule = defaultScope['ItemModule'] || {};
    
    let videos = Object.values(itemModule).map(v => {
        if (!v || !v.id) return null;
        return {
            caption: v.desc || "",
            author: username,
            createTime: v.createTime || 0, // Dùng để sắp xếp
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

    // Sắp xếp video từ mới nhất đến cũ nhất dựa trên createTime
    videos.sort((a, b) => b.createTime - a.createTime);

    // Xóa trường createTime ra khỏi kết quả cuối (vì bạn không yêu cầu hiển thị nó) và cắt đúng 20 video
    const latest20Videos = videos.slice(0, 20).map(v => {
        delete v.createTime;
        return v;
    });

    // --- TỔNG HỢP KẾT QUẢ ---
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
      video_retrieved_count: latest20Videos.length,
      videos: latest20Videos 
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
