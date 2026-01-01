import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Thiếu username (?username=...)" });

  // --- 1. LOGIC CHUNG (Giữ nguyên cấu trúc TikTok) ---
  const formatStats = (num) => {
    num = parseInt(num);
    if (!num) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    const targetUrl = `https://www.threads.net/@${username}`;
    const response = await fetch(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản Threads không tồn tại" });

    const html = await response.text();
    // Threads lưu dữ liệu trong script __REDUX_STATE__ hoặc tương đương
    const jsonMatch = html.match(/<script.*?>window\.__additionalDataLoaded\(.*?,(.*?)\);<\/script>/);

    const result = {
      status: "Live",
      account: {
        username: username,
        nickname: "Tên Threads",
        avatar: "Link avatar",
        stats: {
          follower: formatStats(12500), // Ví dụ 12,5K
        }
      }
    };

    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
