import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const videoUrl = req.query.video || req.body?.video;
    if (!videoUrl) return res.status(400).json({ error: "Thiếu link video" });
    
    // Tích hợp random User-Agent để vượt rào TikTok khi cào HTML
    let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    try {
        const filePath = path.join(process.cwd(), 'user-agents.txt');
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const agents = fileContent.split('\n').filter(line => line.trim() !== '');
            if (agents.length > 0) userAgent = agents[Math.floor(Math.random() * agents.length)].trim();
        }
    } catch (err) {}

    try {
        let scrapedData = {};
        let scrapedImages = null;
        let createTime = null;

        // BƯỚC 1: CÀO HTML (Ưu tiên lấy mảng Ảnh gốc và thông tin siêu tốc)
        try {
            const htmlRes = await fetch(videoUrl, { headers: { "User-Agent": userAgent } });
            const html = await htmlRes.text();
            const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/) || html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/);
            
            if (dataMatch) {
                const jsonData = JSON.parse(dataMatch[1]);
                const defaultScope = jsonData.__DEFAULT_SCOPE__ || jsonData;
                const itemStruct = defaultScope['webapp.video-detail']?.itemInfo?.itemStruct || defaultScope.ItemModule?.[Object.keys(defaultScope.ItemModule)[0]];
                
                if (itemStruct) {
                    scrapedData = itemStruct;
                    createTime = itemStruct.createTime;
                    // Bóc mảng ảnh từ HTML nếu là dạng Slideshow hoặc Nhật ký
                    if (itemStruct.imagePost && itemStruct.imagePost.images) {
                        scrapedImages = itemStruct.imagePost.images.map(img => img.imageURL.urlList[0]);
                    }
                }
            }
        } catch (e) {
            console.error("Lỗi cào HTML, chuyển sang API dự phòng...");
        }

        // BƯỚC 2: GỌI TIKWM (Lấy chính xác create_time, link video MP4 gốc)
        const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`);
        const tikwmData = await response.json();
        const v = tikwmData.data || {};

        if (!v.id && !scrapedData.id) {
            throw new Error("Bài đăng lỗi hoặc bị khóa riêng tư.");
        }

        // KẾT HỢP DỮ LIỆU: Ưu tiên TikWM lấy Thời Gian, Ưu tiên HTML lấy Ảnh
        const finalCreateTime = v.create_time || createTime || null;
        const finalImages = scrapedImages || v.images || null;

        const result = {
            status: "Live",
            author: { 
                uniqueId: v.author?.unique_id || scrapedData.author?.uniqueId, 
                nickname: v.author?.nickname || scrapedData.author?.nickname, 
                avatar: v.author?.avatar || scrapedData.author?.avatarLarger || v.cover, 
                avatarHD: scrapedData.author?.avatarLarger || v.author?.avatar_larger || v.author?.avatar, // Bóc Avatar siêu nét
                verified: v.author?.is_verify || scrapedData.author?.verified || false 
            },
            video_data: { 
                id: v.id || scrapedData.id, 
                description: v.title || scrapedData.desc, 
                create_time: finalCreateTime, // Đã lấy được chuẩn xác thời gian
                duration: v.duration || 0,
                region: v.region || 'VN'
            },
            stats: { 
                play: v.play_count || scrapedData.stats?.playCount || 0, 
                like: v.digg_count || scrapedData.stats?.diggCount || 0, 
                comment: v.comment_count || scrapedData.stats?.commentCount || 0, 
                share: v.share_count || scrapedData.stats?.shareCount || 0,
                download: v.download_count || 0
            },
            urls: { 
                cover: v.cover || scrapedData.video?.cover, 
                coverHD: scrapedData.video?.cover || v.cover, // Bóc Ảnh bìa gốc
                no_watermark: v.play || scrapedData.video?.playAddr 
            },
            music: { 
                playUrl: v.music || scrapedData.music?.playUrl, 
                title: v.music_info?.title || scrapedData.music?.title || "Âm thanh gốc" 
            },
            images: finalImages // Album ảnh hoàn chỉnh
        };
        
        return res.status(200).json(result);
    } catch (error) { 
        return res.status(500).json({ error: error.message }); 
    }
}
