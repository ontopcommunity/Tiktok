export default async function handler(req, res) {
    let { url, music_id, cursor } = req.query;
    cursor = cursor || 0;

    try {
        if (!music_id) {
            if (!url) return res.status(400).json({ code: -1, error: "Thiếu link video hoặc ID nhạc" });
            const vidRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            const vidData = await vidRes.json();

            if (vidData.code !== 0 || !vidData.data || !vidData.data.music_info) {
                return res.status(404).json({ code: -1, error: "Không tìm thấy thông tin nhạc của video này." });
            }
            music_id = vidData.data.music_info.id;
        }

        const postsRes = await fetch(`https://www.tikwm.com/api/music/posts?music_id=${music_id}&count=20&cursor=${cursor}`);
        const postsData = await postsRes.json();

        return res.status(200).json({
            code: 0,
            data: postsData.data,
            music_id: music_id
        });
    } catch (error) {
        return res.status(500).json({ code: -1, error: error.message });
    }
}

