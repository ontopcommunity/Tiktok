export default async function handler(req, res) {
    const region = req.query.region || 'VN';
    const count = req.query.count || 20;

    try {
        const response = await fetch(`https://www.tikwm.com/api/feed/list?region=${region}&count=${count}`);
        const data = await response.json();
        
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ code: -1, error: error.message });
    }
}
