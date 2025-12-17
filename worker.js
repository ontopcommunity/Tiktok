export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    // 1. Kiểm tra xem có username không
    if (!username) {
      return new Response(JSON.stringify({ error: "Vui lòng nhập ?username=id_tiktok" }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // 2. Cấu hình Headers để giả lập trình duyệt thật (Tránh bị chặn cơ bản)
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": "https://www.tiktok.com/"
    };

    const targetUrl = `https://www.tiktok.com/@${username}`;

    try {
      // 3. Gọi đến TikTok
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers
      });

      // Kiểm tra nếu TikTok chặn (thường là 403 hoặc yêu cầu Captcha)
      if (response.status !== 200) {
         return new Response(JSON.stringify({ 
           error: "Không thể lấy dữ liệu. TikTok có thể đã chặn IP của Worker.",
           status_code: response.status 
         }), { status: 500, headers: { 'content-type': 'application/json' }});
      }

      const html = await response.text();

      // 4. Phân tích HTML để lấy dữ liệu (Parsing)
      // TikTok lưu dữ liệu trong một thẻ script có id là __UNIVERSAL_DATA_FOR_REHYDRATION__ hoặc SIGI_STATE
      // Logic này dùng Regex để bắt chuỗi JSON đó.
      
      const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) 
                        || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);

      if (!dataMatch) {
        return new Response(JSON.stringify({ error: "Không tìm thấy dữ liệu user trong HTML (Cấu trúc TikTok có thể đã đổi)." }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }

      const jsonStr = dataMatch[1];
      const jsonData = JSON.parse(jsonStr);

      // 5. Trích xuất thông tin cần thiết
      // Lưu ý: Cấu trúc object này phụ thuộc vào TikTok, có thể thay đổi
      // Thông thường nó nằm ở: jsonData.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user
      
      let userInfo = null;
      let stats = null;

      try {
        // Cố gắng tìm object user trong cấu trúc JSON phức tạp của TikTok
        const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
        // Duyệt qua các keys để tìm thông tin user
        const userModule = defaultScope['webapp.user-detail'];
        
        if (userModule && userModule.userInfo) {
            userInfo = userModule.userInfo.user;
            stats = userModule.userInfo.stats;
        }
      } catch (e) {
          // Fallback nếu cấu trúc parse lỗi
      }

      if (!userInfo) {
         return new Response(JSON.stringify({ error: "Không parse được thông tin user cụ thể." }), { status: 500 });
      }

      // 6. Trả về kết quả JSON sạch đẹp
      const result = {
        id: userInfo.id,
        username: userInfo.uniqueId,
        nickname: userInfo.nickname,
        avatar: userInfo.avatarLarger,
        bio: userInfo.signature,
        verified: userInfo.verified,
        stats: {
          followerCount: stats.followerCount,
          followingCount: stats.followingCount,
          heartCount: stats.heartCount,
          videoCount: stats.videoCount
        },
        profile_url: targetUrl
      };

      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*' // Cho phép gọi từ web khác (CORS)
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }
};
