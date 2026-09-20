// File: api/search.js - Fixed: fallback when tikwm blocked by Cloudflare

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const type = req.query.type || req.body?.type || "video";
  const keywords = req.query.keywords || req.body?.keywords;
  const cursor = req.query.cursor || req.body?.cursor || 0;
  const count = Math.min(parseInt(req.query.count || req.body?.count || 20, 10) || 20, 30);

  if (type !== "music" && !keywords) {
    return res.status(400).json({ code: -1, error: "Thiếu từ khóa tìm kiếm (keywords)" });
  }

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    // ==================== MUSIC ====================
    if (type === "music") {
      let music_id = req.query.music_id || req.body?.music_id;
      const url = req.query.url || req.body?.url;

      if (!music_id) {
        if (!url) {
          return res.status(400).json({ code: -1, error: "Thiếu link video (url) để soi nhạc" });
        }
        const vidRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const text = await vidRes.text();
        let vidData;
        try {
          vidData = JSON.parse(text);
        } catch {
          return res.status(502).json({ code: -1, error: "tikwm bị chặn (Cloudflare)" });
        }
        if (vidData.code !== 0 || !vidData.data?.music_info) {
          return res.status(404).json({ code: -1, error: "Không thể trích xuất ID nhạc từ video này." });
        }
        music_id = vidData.data.music_info.id;
      }

      const postsRes = await fetch(
        `https://www.tikwm.com/api/music/posts?music_id=${music_id}&count=${count}&cursor=${cursor}`
      );
      const postsText = await postsRes.text();
      let postsData;
      try {
        postsData = JSON.parse(postsText);
      } catch {
        return res.status(502).json({ code: -1, error: "tikwm bị chặn (Cloudflare)" });
      }
      return res.status(200).json({ code: 0, data: postsData.data, music_id });
    }

    // ==================== SEARCH VIDEO / IMAGE ====================
    // 1) Try tikwm first
    let tikwmOk = false;
    let data = null;

    try {
      const formData = new URLSearchParams();
      formData.append("keywords", keywords);
      formData.append("count", String(count));
      formData.append("cursor", String(cursor));

      const response = await fetch("https://www.tikwm.com/api/feed/search", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: formData.toString(),
      });
      const text = await response.text();
      if (text.trim().startsWith("{")) {
        data = JSON.parse(text);
        if (data.code === 0 && data.data?.videos) {
          tikwmOk = true;
        }
      }
    } catch (e) {
      console.error("tikwm search failed:", e.message);
    }

    if (tikwmOk) {
      if (type === "image") {
        const imgs = (data.data.videos || []).filter((v) => v.images && v.images.length > 0);
        return res.status(200).json({
          code: 0,
          data: { videos: imgs.slice(0, count), cursor: data.data.cursor, hasMore: data.data.hasMore },
        });
      }
      return res.status(200).json(data);
    }

    // 2) Fallback: scrape TikTok search page
    const searchUrl = `https://www.tiktok.com/search/video?q=${encodeURIComponent(keywords)}`;
    const htmlRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
      redirect: "follow",
    });
    const html = await htmlRes.text();

    const dataMatch =
      html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) ||
      html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

    let videos = [];

    if (dataMatch) {
      try {
        const jsonData = JSON.parse(dataMatch[1]);
        const scope = jsonData.__DEFAULT_SCOPE__ || jsonData;

        // Try various paths for search results
        const searchDetail =
          scope["webapp.search-video"] ||
          scope["webapp.search"] ||
          scope["search_video"] ||
          null;

        // ItemModule style
        if (scope.ItemModule) {
          videos = Object.values(scope.ItemModule).map((v) => mapItem(v));
        }

        // Collect from any nested itemList
        const walk = (obj, depth = 0) => {
          if (!obj || depth > 6 || videos.length >= count) return;
          if (Array.isArray(obj)) {
            for (const item of obj) walk(item, depth + 1);
            return;
          }
          if (typeof obj !== "object") return;
          if (obj.id && (obj.desc !== undefined || obj.video || obj.stats)) {
            videos.push(mapItem(obj));
            return;
          }
          if (obj.itemList && Array.isArray(obj.itemList)) {
            for (const item of obj.itemList) walk(item, depth + 1);
          }
          for (const k of Object.keys(obj)) {
            if (["itemList", "data", "video_list", "videos", "list"].includes(k) || k.includes("item")) {
              walk(obj[k], depth + 1);
            }
          }
        };
        if (videos.length === 0) walk(scope);
      } catch (e) {
        console.error("Parse search HTML error:", e.message);
      }
    }

    // Also try extract from JSON blobs in page
    if (videos.length === 0) {
      const idMatches = [...html.matchAll(/"id":"(\d{15,})"/g)].map((m) => m[1]);
      const uniqueIds = [...new Set(idMatches)].slice(0, count);
      videos = uniqueIds.map((id) => ({
        video_id: id,
        id,
        title: "",
        author: { unique_id: "unknown", nickname: "unknown" },
        play_count: 0,
        digg_count: 0,
        comment_count: 0,
        share_count: 0,
        create_time: 0,
        cover: "",
        play: "",
        link: `https://www.tiktok.com/video/${id}`,
      }));
    }

    videos = videos.slice(0, count);

    return res.status(200).json({
      code: 0,
      data: {
        videos,
        cursor: Number(cursor) + videos.length,
        hasMore: videos.length >= count,
        source: tikwmOk ? "tikwm" : "scrape_fallback",
      },
    });
  } catch (error) {
    console.error("Lỗi API search:", error);
    return res.status(500).json({ code: -1, error: error.message });
  }
}

function mapItem(v) {
  const a = v.author || {};
  const uId = a.uniqueId || a.unique_id || "user";
  const vId = v.id || v.video_id || "";
  return {
    video_id: vId,
    id: vId,
    title: v.desc || v.title || v.caption || "",
    author: {
      unique_id: uId,
      nickname: a.nickname || uId,
      avatar: a.avatarLarger || a.avatarThumb || a.avatar || "",
    },
    play_count: v.stats?.playCount || v.play_count || 0,
    digg_count: v.stats?.diggCount || v.digg_count || 0,
    comment_count: v.stats?.commentCount || v.comment_count || 0,
    share_count: v.stats?.shareCount || v.share_count || 0,
    create_time: v.createTime || v.create_time || 0,
    cover: v.video?.cover || v.cover || "",
    play: v.video?.playAddr || v.play || "",
    duration: v.video?.duration || v.duration || 0,
    images: v.imagePost?.images || v.images || null,
    link: `https://www.tiktok.com/@${uId}/video/${vId}`,
  };
}
