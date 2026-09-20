/**
 * Search API — bypass CF tối đa trên Vercel free
 * 1) tikwm.com feed/search
 * 2) nếu keyword giống username → user posts + scrape profile IDs
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") return res.status(200).end();

  const type = req.query.type || req.body?.type || "video";
  const keywords = (req.query.keywords || req.body?.keywords || "").trim();
  const cursor = req.query.cursor || req.body?.cursor || 0;
  const count = Math.min(parseInt(req.query.count || req.body?.count || 20, 10) || 20, 30);

  if (type !== "music" && !keywords) {
    return res.status(400).json({ code: -1, error: "Thiếu từ khóa (keywords)" });
  }

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const TIKWM = "https://tikwm.com";

  try {
    if (type === "music") {
      let music_id = req.query.music_id || req.body?.music_id;
      const url = req.query.url || req.body?.url;
      if (!music_id) {
        if (!url) return res.status(400).json({ code: -1, error: "Thiếu url video" });
        const vidRes = await fetch(`${TIKWM}/api/?url=${encodeURIComponent(url)}`, {
          headers: { "User-Agent": UA },
        });
        const text = await vidRes.text();
        if (!text.trim().startsWith("{")) {
          return res.status(502).json({ code: -1, error: "tikwm bị Cloudflare chặn" });
        }
        const vidData = JSON.parse(text);
        music_id = vidData?.data?.music_info?.id;
        if (!music_id) return res.status(404).json({ code: -1, error: "Không lấy được music_id" });
      }
      const postsRes = await fetch(
        `${TIKWM}/api/music/posts?music_id=${music_id}&count=${count}&cursor=${cursor}`,
        { headers: { "User-Agent": UA } }
      );
      const postsText = await postsRes.text();
      if (!postsText.trim().startsWith("{")) {
        return res.status(502).json({ code: -1, error: "tikwm music/posts bị CF" });
      }
      return res.status(200).json({ code: 0, data: JSON.parse(postsText).data, music_id });
    }

    let videos = [];
    let source = null;
    let hasMore = false;
    let nextCursor = cursor;

    // 1) tikwm search
    try {
      const formData = new URLSearchParams();
      formData.append("keywords", keywords);
      formData.append("count", String(count));
      formData.append("cursor", String(cursor));

      const response = await fetch(`${TIKWM}/api/feed/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          Accept: "application/json",
          Origin: "https://tikwm.com",
          Referer: "https://tikwm.com/",
        },
        body: formData.toString(),
      });
      const text = await response.text();
      if (text.trim().startsWith("{")) {
        const data = JSON.parse(text);
        if (data.code === 0 && data.data?.videos?.length) {
          videos = data.data.videos.map(mapTikwmVideo);
          source = "tikwm";
          hasMore = !!data.data.hasMore;
          nextCursor = data.data.cursor;
        }
      }
    } catch (e) {
      console.error("tikwm search:", e.message);
    }

    // 2) username-like → user posts
    const possibleUser = keywords.replace(/^@/, "").split(/\s+/)[0];
    if (videos.length === 0 && /^[a-zA-Z0-9._]{2,24}$/.test(possibleUser)) {
      try {
        const up = await fetch(
          `${TIKWM}/api/user/posts?unique_id=${encodeURIComponent(possibleUser)}&count=${count}`,
          { headers: { "User-Agent": UA } }
        );
        const upText = await up.text();
        if (upText.trim().startsWith("{")) {
          const upData = JSON.parse(upText);
          const list = upData?.data?.videos || [];
          if (list.length) {
            videos = list.map(mapTikwmVideo);
            source = "tikwm_user_posts";
          }
        }
      } catch (e) {
        console.error("user posts:", e.message);
      }
    }

    // 3) scrape profile for /video/IDs
    if (videos.length === 0 && /^[a-zA-Z0-9._]{2,24}$/.test(possibleUser)) {
      try {
        const page = await fetch(`https://www.tiktok.com/@${possibleUser}`, {
          headers: { "User-Agent": UA, Accept: "text/html" },
        });
        const html = await page.text();
        const ids = [...new Set([...html.matchAll(/\/video\/(\d{15,})/g)].map((m) => m[1]))];
        if (ids.length) {
          videos = ids.slice(0, count).map((id) => ({
            video_id: id,
            id,
            title: "",
            author: { unique_id: possibleUser, nickname: possibleUser },
            play_count: 0,
            digg_count: 0,
            comment_count: 0,
            share_count: 0,
            create_time: 0,
            cover: "",
            play: "",
            link: `https://www.tiktok.com/@${possibleUser}/video/${id}`,
          }));
          source = "profile_scrape_ids";
        }
      } catch (e) {
        console.error("profile scrape:", e.message);
      }
    }

    if (videos.length === 0) {
      return res.status(200).json({
        code: -1,
        error:
          "Search đang bị Cloudflare chặn (datacenter IP). Thử /tiktok {username} hoặc /video {link}. Bypass full cần residential proxy / Playwright.",
        data: { videos: [], cursor: 0, hasMore: false, source: null },
      });
    }

    if (type === "image") {
      videos = videos.filter((v) => v.images && v.images.length > 0);
    }

    return res.status(200).json({
      code: 0,
      data: {
        videos: videos.slice(0, count),
        cursor: nextCursor,
        hasMore,
        source,
      },
    });
  } catch (error) {
    return res.status(500).json({ code: -1, error: error.message });
  }
}

function mapTikwmVideo(v) {
  const uId = v.author?.unique_id || v.author?.uniqueId || "user";
  const vId = v.video_id || v.id || "";
  return {
    video_id: vId,
    id: vId,
    title: v.title || v.desc || "",
    author: {
      unique_id: uId,
      nickname: v.author?.nickname || uId,
      avatar: v.author?.avatar || "",
    },
    play_count: v.play_count || v.playCount || 0,
    digg_count: v.digg_count || v.diggCount || 0,
    comment_count: v.comment_count || 0,
    share_count: v.share_count || 0,
    create_time: v.create_time || 0,
    cover: v.cover || "",
    play: v.play || "",
    duration: v.duration || 0,
    images: v.images || null,
    link: `https://www.tiktok.com/@${uId}/video/${vId}`,
  };
}
