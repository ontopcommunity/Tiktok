import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Thiếu username (?username=...)" });

  // --- 1. RANDOM USER AGENT ---
  let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"; 
  const formatStats = (num) => {
    num = parseInt(num);
    if (!num) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
  };

  try {
    const targetUrl = `https://www.instagram.com/${username}/`;
    const response = await fetch(targetUrl, { headers: { "User-Agent": userAgent } });
    
    if (!response.ok) return res.status(404).json({ status: "Die", error: "Tài khoản không tồn tại" });

    const html = await response.text();
    // Instagram dùng cấu trúc JSON trong biến window._sharedData hoặc tương đương
    const jsonMatch = html.match(/<script.*?>window\._sharedData\s*=\s*(.*?);<\/script>/);

    if (!jsonMatch) return res.status(404).json({ status: "Die", error: "Instagram chặn truy cập" });

    const data = JSON.parse(jsonMatch[1]).entry_data.ProfilePage[0].graphql.user;

    return res.status(200).json({
      status: "Live",
      account: {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        avatar: data.profile_pic_url_hd,
        bio: data.biography,
        verified: data.is_verified,
        stats: {
          follower: formatStats(data.edge_followed_by.count),
          following: formatStats(data.edge_follow.count),
          posts: formatStats(data.edge_owner_to_timeline_media.count)
        }
      }
    });
  } catch (error) { return res.status(500).json({ status: "Error", error: error.message }); }
}
