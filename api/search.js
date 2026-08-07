// File: api/search.js (hoặc api/search/index.js)

export default async function handler(req, res) {
  // ==================== CORS HEADERS ====================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Xử lý preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ==================== LẤY THAM SỐ ====================
  const type = req.query.type || req.body?.type || "video"; // video | image | music
  const keywords = req.query.keywords || req.body?.keywords;
  const cursor = req.query.cursor || req.body?.cursor || 0;
  const count = req.query.count || req.body?.count || 20;

  // Kiểm tra từ khóa bắt buộc (trừ khi type = music và có url)
  if (type !== "music" && !keywords) {
    return res.status(400).json({ code: -1, error: "Thiếu từ khóa tìm kiếm (keywords)" });
  }

  try {
    // ==================== SOI NHẠC (MUSIC) ====================
    if (type === "music") {
      let music_id = req.query.music_id || req.body?.music_id;
      const url = req.query.url || req.body?.url;

      // Nếu chưa có music_id, trích xuất từ link video
      if (!music_id) {
        if (!url) {
          return res.status(400).json({ code: -1, error: "Thiếu link video (url) để soi nhạc" });
        }

        const vidRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const vidData = await vidRes.json();

        if (vidData.code !== 0 || !vidData.data || !vidData.data.music_info) {
          return res.status(404).json({ code: -1, error: "Không thể trích xuất ID nhạc từ video này." });
        }

        music_id = vidData.data.music_info.id;
      }

      // Lấy danh sách video dùng nhạc này
      const postsRes = await fetch(
        `https://www.tikwm.com/api/music/posts?music_id=${music_id}&count=${count}&cursor=${cursor}`
      );
      const postsData = await postsRes.json();

      return res.status(200).json({
        code: 0,
        data: postsData.data,
        music_id: music_id,
      });
    }

    // ==================== TÌM ẢNH (SLIDESHOW) ====================
    if (type === "image") {
      let collectedImages = [];
      let currentCursor = cursor;
      let hasMore = true;
      let loops = 0;

      while (collectedImages.length < 20 && hasMore && loops < 5) {
        const formData = new URLSearchParams();
        formData.append("keywords", keywords);
        formData.append("count", 30);
        formData.append("cursor", currentCursor);

        const response = await fetch("https://www.tikwm.com/api/feed/search", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const data = await response.json();

        if (data.code !== 0 || !data.data || !data.data.videos) break;

        // Lọc ra các video có ảnh (slideshow)
        const imgs = data.data.videos.filter((v) => v.images && v.images.length > 0);
        collectedImages.push(...imgs);

        currentCursor = data.data.cursor;
        hasMore = data.data.hasMore;
        loops++;
      }

      return res.status(200).json({
        code: 0,
        data: {
          videos: collectedImages.slice(0, 20),
          cursor: currentCursor,
          hasMore,
        },
      });
    }

    // ==================== TÌM VIDEO THÔNG THƯỜNG ====================
    const formData = new URLSearchParams();
    formData.append("keywords", keywords);
    formData.append("count", count);
    formData.append("cursor", cursor);

    const response = await fetch("https://www.tikwm.com/api/feed/search", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("Lỗi API:", error);
    return res.status(500).json({ code: -1, error: error.message });
  }
}
