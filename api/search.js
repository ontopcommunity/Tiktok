export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  return res.status(200).json({
    code: -1,
    error: "Search đã tắt trên bot. Dùng /tiktok {user} hoặc /video {link}.",
    data: { videos: [] },
  });
}
