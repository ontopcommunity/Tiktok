let currentMode = 'video';
let linkMode = 'single'; // 'single' hoặc 'multi'
let fetchedVideos = []; 
let currentSearchKeyword = "";
let currentSearchType = "video"; // 'video' hoặc 'image'
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;
let currentMusicId = "";
let musicCursor = 0;

// ================= GIAO DIỆN CƠ BẢN =================
function switchTab(mode) {
    currentMode = mode;
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        const tabBtn = document.getElementById(`tab-${m}`);
        if(btn && tabBtn) {
            btn.classList.toggle('hidden', m !== mode);
            tabBtn.className = (m === mode) 
                ? 'tab-btn tab-active focus:outline-none flex items-center gap-2 text-base md:text-lg'
                : 'tab-btn tab-inactive focus:outline-none flex items-center gap-2 text-base md:text-lg';
        }
    });
    clearResults();
}

// Tách chức năng Tải Link thành Single / Multi
function setLinkMode(mode) {
    linkMode = mode;
    const btnSingle = document.getElementById('subtab-single');
    const btnMulti = document.getElementById('subtab-multi');
    const textArea = document.getElementById('tiktok-links');

    if(mode === 'single') {
        btnSingle.className = "px-5 py-2 rounded-lg bg-slate-700 text-white font-bold text-sm shadow-sm transition";
        btnMulti.className = "px-5 py-2 rounded-lg text-slate-400 font-bold text-sm hover:text-white transition";
        textArea.rows = 1;
        textArea.placeholder = "Dán 1 link video TikTok vào đây...";
    } else {
        btnMulti.className = "px-5 py-2 rounded-lg bg-slate-700 text-white font-bold text-sm shadow-sm transition";
        btnSingle.className = "px-5 py-2 rounded-lg text-slate-400 font-bold text-sm hover:text-white transition";
        textArea.rows = 4;
        textArea.placeholder = "Dán nhiều link (mỗi link 1 dòng)...";
    }
}

function showLoading(show, text = "Đang xử lý...") {
    const loader = document.getElementById('loading');
    document.getElementById('loading-text').innerText = text;
    show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
}

function showError(msg) {
    const errEl = document.getElementById('error-msg');
    if(msg) {
        errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${msg}`;
        errEl.classList.remove('hidden');
    } else {
        errEl.classList.add('hidden');
    }
}

function clearResults() {
    document.getElementById('user-info-area').innerHTML = '';
    document.getElementById('user-info-area').className = "w-full hidden animate-fade-up";
    document.getElementById('result-area').innerHTML = '';
    document.getElementById('result-area').className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-6 pb-6";
    document.getElementById('special-action-container').classList.add('hidden');
    document.getElementById('load-more-container').classList.add('hidden');
    showError('');
    fetchedVideos = [];
    
    searchCursor = 0; currentSearchKeyword = "";
    userVideoCursor = 0; currentUserProfile = ""; fullUserData = null;
    musicCursor = 0; currentMusicId = "";
}

function generateFileName(author, videoId, ext) { return `${author}_${videoId}.${ext}`; }

const formatStatsClient = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
};

function parseRawStats(str) {
    if(!str) return 0;
    if(typeof str === 'number') return str;
    let multi = 1;
    if(str.includes('K')) multi = 1000;
    if(str.includes('M')) multi = 1000000;
    return parseFloat(str.replace(/,/g, '.').replace(/[KM]/g, '')) * multi;
}

// Chức năng Toggle (Mở rộng/Thu gọn) thẻ lớn
window.toggleExpand = function(id) {
    const box = document.getElementById(id);
    box.classList.toggle('expanded');
}

// Modal Hướng Dẫn
function openGuide() { document.getElementById('guide-modal').classList.add('active'); }

function loadMore() {
    if (currentMode === 'search') searchTikTok(currentSearchType, true);
    else if (currentMode === 'info') fetchUserInfo(true);
    else if (currentMode === 'music_scan') fetchMoreMusicVideos();
}

async function forceDownload(url, filename, btnObj) {
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btnObj.style.pointerEvents = 'none';

    const triggerDownload = async (targetUrl) => {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error("CORS");
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = downloadUrl; a.download = filename; 
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(downloadUrl); a.remove();
    };

    try { await triggerDownload(url); } 
    catch (error) {
        try { await triggerDownload(`https://corsproxy.io/?${encodeURIComponent(url)}`); } 
        catch (e) { window.open(url, '_blank'); }
    } finally {
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
        setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
    }
}

// ================= MODAL XEM CHI TIẾT & PHÂN TÍCH VIDEO =================
function searchUserFromModal(username) {
    closeModal('video-modal');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.analyzeSingleVideo = function(index) {
    const d = fetchedVideos[index].data;
    const play = parseRawStats(d.stats.play);
    const likes = parseRawStats(d.stats.like);
    const comments = parseRawStats(d.stats.comment);
    const shares = parseRawStats(d.stats.share);
    
    const er = play > 0 ? (((likes + comments + shares) / play) * 100).toFixed(2) : 0;
    const likeRatio = play > 0 ? ((likes / play) * 100).toFixed(1) : 0;
    
    // Ngày giờ (TikWM trả create_time dạng Unix timestamp)
    let uploadDate = "Không xác định";
    if (d.video_data.create_time) {
        uploadDate = new Date(d.video_data.create_time * 1000).toLocaleString('vi-VN');
    }

    const infoBox = document.getElementById('modal-video-info');
    const oldHtml = infoBox.innerHTML;
    const oldActions = document.getElementById('modal-video-actions').innerHTML;

    infoBox.innerHTML = `
        <button onclick="restoreVideoModal()" class="mb-4 text-pink-400 font-bold flex items-center gap-2 hover:text-pink-300 transition">
            <i class="fa-solid fa-arrow-left"></i> Quay lại Video
        </button>
        <h3 class="text-2xl font-black text-white mb-6 border-b border-white/10 pb-4"><i class="fa-solid fa-chart-simple text-sky-400"></i> Phân Tích Video Phân Hạng</h3>
        
        <div class="space-y-4">
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center border border-white/5 shadow-inner">
                <span class="text-slate-400 font-bold text-sm"><i class="fa-solid fa-clock text-orange-400"></i> Thời gian đăng:</span>
                <span class="text-white font-bold">${uploadDate}</span>
            </div>
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center border border-white/5 shadow-inner">
                <span class="text-slate-400 font-bold text-sm"><i class="fa-solid fa-percent text-sky-400"></i> Tỷ lệ Tương tác (ER):</span>
                <span class="text-white font-black text-lg ${er > 10 ? 'text-emerald-400' : ''}">${er}%</span>
            </div>
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center border border-white/5 shadow-inner">
                <span class="text-slate-400 font-bold text-sm"><i class="fa-solid fa-heart-pulse text-pink-500"></i> Tỷ lệ Chuyển đổi Like:</span>
                <span class="text-white font-bold">${likeRatio}% (trên lượt xem)</span>
            </div>
            <div class="glass-panel p-4 rounded-xl border border-white/5 shadow-inner">
                <span class="text-slate-400 font-bold text-sm block mb-2"><i class="fa-solid fa-quote-left text-indigo-400"></i> Hashtag sử dụng:</span>
                <div class="flex flex-wrap gap-2">
                    ${(d.video_data.description.match(/#[\w_À-ỹ]+/g) || []).map(t => `<span class="bg-white/10 px-2 py-1 rounded text-xs text-white">${t}</span>`).join('') || '<span class="text-slate-500 text-xs">Không có hashtag</span>'}
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-video-actions').innerHTML = `
        <button onclick="restoreVideoModal()" class="w-full col-span-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            Đóng Phân Tích
        </button>
    `;

    // Lưu tạm state để khôi phục
    window.restoreVideoModal = function() {
        infoBox.innerHTML = oldHtml;
        document.getElementById('modal-video-actions').innerHTML = oldActions;
    }
}

function openVideoModal(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
    const isImagePost = d.images && d.images.length > 0;

    document.getElementById('modal-video-container').innerHTML = isImagePost 
        ? `<div class="relative w-full h-full flex flex-col items-center justify-center bg-slate-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
             <img src="${d.urls.cover}" class="w-full h-full object-contain blur-sm absolute opacity-30 z-0">
             <img src="${d.images[0]}" class="w-full h-full object-contain z-10 relative">
             <div class="absolute top-4 left-4 bg-pink-600 text-white font-bold text-xs px-3 py-1 rounded-full z-20 shadow-lg"><i class="fa-regular fa-images"></i> Bài đăng ${d.images.length} Ảnh</div>
           </div>`
        : `<video controls playsinline autoplay class="w-full h-full object-contain max-h-[100%] bg-black/90 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" poster="${d.urls.cover}">
            <source src="${d.urls.no_watermark}" type="video/mp4">
           </video>`;

    const safeDesc = (d.video_data.description || 'Chưa có mô tả.').replace(/'/g, "\\'");
    const safeMusicTitle = (d.music.title || 'Âm thanh gốc').replace(/'/g, "\\'");

    document.getElementById('modal-video-info').innerHTML = `
        <div class="relative p-[1px] rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-5 group cursor-pointer hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all duration-300" onclick="searchUserFromModal('${d.author.uniqueId}')">
            <div class="flex items-center gap-4 p-3 bg-slate-900/95 backdrop-blur-xl rounded-[15px]">
                <div class="relative w-14 h-14">
                    <div class="absolute inset-0 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-full animate-spin blur-[3px] opacity-70 group-hover:opacity-100 transition"></div>
                    <img src="${d.author.avatar}" class="w-14 h-14 rounded-full object-cover relative z-10 border-[2.5px] border-slate-900 bg-slate-800" loading="lazy">
                </div>
                <div class="flex-1 truncate">
                    <h3 class="font-extrabold text-white text-lg group-hover:text-pink-400 transition flex items-center gap-1.5 truncate">
                        ${d.author.nickname} ${d.author.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-[14px]"></i>' : ''}
                    </h3>
                    <p class="text-pink-500/80 font-medium text-xs mt-0.5 truncate">@${d.author.uniqueId}</p>
                </div>
                <div class="px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs font-bold group-hover:bg-pink-500 transition-all flex items-center gap-1.5">
                    Kênh <i class="fa-solid fa-arrow-right"></i>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5 mb-5 cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/80 transition group" onclick="scanMusicFromModal('${d.music.playUrl}', '${safeMusicTitle}')">
            <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 animate-[spin_4s_linear_infinite]">
                <i class="fa-solid fa-music text-purple-400 text-xs"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-white text-sm font-bold truncate group-hover:text-purple-400 transition">${d.music.title}</p>
                <p class="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Bấm để soi nhạc <i class="fa-solid fa-arrow-right"></i></p>
            </div>
            <div class="px-2 flex gap-1 items-end h-3">
                <div class="w-1 bg-purple-500 rounded-full animate-[bounce_1s_infinite] opacity-80 h-2"></div>
                <div class="w-1 bg-pink-500 rounded-full animate-[bounce_1s_infinite_0.2s] opacity-80 h-3"></div>
                <div class="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_0.4s] opacity-80 h-1.5"></div>
            </div>
        </div>
        
        <div class="relative bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 shadow-inner mb-6">
            <i class="fa-solid fa-quote-left absolute top-3 right-4 text-4xl text-white/5"></i>
            <h4 class="text-[11px] text-pink-500 font-bold uppercase tracking-widest mb-2"><i class="fa-solid fa-align-left"></i> Mô tả video</h4>
            <div class="relative group">
                <p class="text-slate-200 text-[14px] leading-relaxed whitespace-pre-wrap">${safeDesc}</p>
            </div>
        </div>
        
        <div class="flex justify-between items-center mb-3 pl-1">
            <h4 class="text-[11px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-chart-pie"></i> Tương tác số liệu</h4>
            <button onclick="analyzeSingleVideo(${index})" class="text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/40 px-3 py-1 rounded-full font-bold transition flex items-center gap-1">
                <i class="fa-solid fa-chart-simple"></i> Phân Tích
            </button>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-2">
            <div class="bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300"><i class="fa-solid fa-play"></i></div>
                <div><span class="block text-white text-lg font-black drop-shadow-md">${d.stats.play}</span><span class="block text-[10px] text-slate-400 uppercase font-bold">Lượt xem</span></div>
            </div>
            <div class="bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500"><i class="fa-solid fa-heart drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]"></i></div>
                <div><span class="block text-white text-lg font-black drop-shadow-md">${d.stats.like}</span><span class="block text-[10px] text-slate-400 uppercase font-bold">Yêu thích</span></div>
            </div>
            <div class="bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><i class="fa-solid fa-comment drop-shadow-[0_0_5px_rgba(96,165,250,0.6)]"></i></div>
                <div><span class="block text-white text-lg font-black drop-shadow-md">${d.stats.comment}</span><span class="block text-[10px] text-slate-400 uppercase font-bold">Bình luận</span></div>
            </div>
            <div class="bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><i class="fa-solid fa-share drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]"></i></div>
                <div><span class="block text-white text-lg font-black drop-shadow-md">${d.stats.share}</span><span class="block text-[10px] text-slate-400 uppercase font-bold">Chia sẻ</span></div>
            </div>
        </div>
    `;

    document.getElementById('modal-video-actions').innerHTML = `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-download text-lg"></i> Tải Video Gốc
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 border border-slate-600 shadow-lg flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-music text-purple-400 text-lg"></i> Tải MP3
        </button>
    `;

    document.getElementById('video-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
    if(modalId === 'video-modal') {
        const videoEl = document.querySelector('#modal-video-container video');
        if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); }
        document.getElementById('modal-video-container').innerHTML = ''; 
    }
}

// ================= SOI NHẠC =================
async function scanMusicFromModal(musicUrl, musicTitle) {
    closeModal('video-modal');
    clearResults();
    currentMode = 'music_scan';
    currentMusicUrl = musicUrl;
    musicCursor = 0;
    
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`tab-${m}`);
        if(btn) btn.className = 'tab-btn tab-inactive focus:outline-none flex items-center gap-2 text-base md:text-lg';
    });

    showLoading(true, `Đang truy vết âm thanh...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const response = await fetch(`/api/music?url=${encodeURIComponent(musicUrl)}`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data || !resData.data.videos || resData.data.videos.length === 0) throw new Error("Không tìm thấy video nào.");

        fetchedVideos = formatTikWmToGrid(resData.data.videos);
        musicCursor = resData.data.cursor;
        currentMusicId = resData.music_id;
        
        const userInfoArea = document.getElementById('user-info-area');
        userInfoArea.innerHTML = `
            <div class="w-full glass-panel rounded-[2rem] p-6 text-center border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] animate-fade-up">
                <div class="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.4)] mb-3 animate-[spin_4s_linear_infinite]"><i class="fa-solid fa-music text-purple-400 text-2xl"></i></div>
                <h2 class="text-xl font-extrabold text-white">Kết Quả Quét Âm Thanh</h2>
                <p class="text-purple-400 font-bold text-sm mt-2 flex items-center justify-center gap-2"><i class="fa-solid fa-compact-disc"></i> ${musicTitle}</p>
            </div>
        `;
        userInfoArea.classList.remove('hidden'); 

        renderVideoCards(fetchedVideos, false, 0);
        checkLoadMoreUI(resData.data.hasMore);
    } catch (error) { showError(error.message); } 
    finally { showLoading(false); }
}

async function fetchMoreMusicVideos() {
    document.getElementById('load-more-btn').disabled = true;
    document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;

    try {
        const response = await fetch(`/api/music?music_id=${currentMusicId}&cursor=${musicCursor}`);
        const resData = await response.json();
        if (resData.code !== 0 || !resData.data || !resData.data.videos) throw new Error("Không thể tải thêm.");

        const formattedResults = formatTikWmToGrid(resData.data.videos);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        musicCursor = resData.data.cursor;

        renderVideoCards(formattedResults, true, startIndex);
        checkLoadMoreUI(resData.data.hasMore);
    } catch (error) { alert("Lỗi tải thêm: " + error.message); } 
    finally { document.getElementById('load-more-btn').disabled = false; }
}

// FORMAT TIKWM
function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { 
                uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar || v.cover, verified: v.author.is_verify || v.author.verified || false
            },
            video_data: { id: v.video_id, description: v.title, create_time: v.create_time }, // Thêm create_time để Analytics tính
            stats: { play: formatStatsClient(v.play_count), like: formatStatsClient(v.digg_count), comment: formatStatsClient(v.comment_count), share: formatStatsClient(v.share_count) },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// ================= 1. TẢI LINK =================
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    if (links.length > 1 && linkMode === 'single') return showError("Bạn đang chọn chế độ 1 Video. Hãy chuyển sang tab 'Nhiều Video'!");

    clearResults();
    showLoading(true, `Đang xử lý ${links.length} luồng dữ liệu...`);
    document.getElementById('fetch-video-btn').disabled = true;

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        results = results.filter(r => r.data && r.data.status === "Live");
        
        fetchedVideos = results;
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError("Lỗi: " + error.message); } 
    finally { showLoading(false); document.getElementById('fetch-video-btn').disabled = false; }
}

// ================= 2. TÌM KIẾM (Video / Ảnh) =================
async function searchTikTok(type = 'video', isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return showError("Nhập từ khóa vô!");

    if (!isLoadMore) {
        clearResults();
        currentSearchKeyword = kw; searchCursor = 0; currentSearchType = type;
        showLoading(true, `Đang tìm ${type === 'image' ? 'Ảnh' : 'Video'}: "${kw}"...`);
    } else {
        document.getElementById('load-more-btn').disabled = true;
        document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    }

    try {
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=30`);
        const resData = await response.json();
        if (resData.code !== 0 || !resData.data?.videos?.length) throw new Error("Không tìm thấy kết quả.");

        let videos = resData.data.videos;
        searchCursor = resData.data.cursor;

        // Lọc Ảnh nếu người dùng chọn Tìm Ảnh
        if (currentSearchType === 'image') {
            videos = videos.filter(v => v.images && v.images.length > 0);
            if(videos.length === 0 && !isLoadMore) throw new Error("Không tìm thấy bài đăng Ảnh nào. Thử từ khóa khác.");
        }

        let formattedResults = formatTikWmToGrid(videos);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        
        renderVideoCards(formattedResults, isLoadMore, startIndex);
        checkLoadMoreUI(resData.data.hasMore);
        
        // Hiện Nút Random trong Box riêng sau khi tìm kiếm thành công
        const specialBox = document.getElementById('special-action-container');
        specialBox.innerHTML = `
            <button onclick="searchRandom()" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                <i class="fa-solid fa-dice text-lg"></i> Lấy 1 Video Random
            </button>
        `;
        specialBox.classList.remove('hidden');

    } catch (error) { if(!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { showLoading(false); }
}

async function searchRandom() {
    if(fetchedVideos.length === 0) return;
    showLoading(true, `Đang bốc thăm may mắn...`);
    try {
        const randomCursor = Math.floor(Math.random() * 20);
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${randomCursor}&count=20`);
        const resData = await response.json();
        
        let videos = resData.data?.videos;
        if (!videos) {
            const retryRes = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=0&count=20`);
            const retryData = await retryRes.json();
            videos = retryData.data?.videos;
        }

        if(videos && videos.length > 0) {
            if (currentSearchType === 'image') videos = videos.filter(v => v.images && v.images.length > 0);
            if(videos.length > 0) {
                clearResults();
                const luckyVideo = videos[Math.floor(Math.random() * videos.length)];
                fetchedVideos = formatTikWmToGrid([luckyVideo]);
                renderVideoCards(fetchedVideos, false, 0);
                
                // Hiện lại nút random
                const specialBox = document.getElementById('special-action-container');
                specialBox.innerHTML = `
                    <button onclick="searchRandom()" class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                        <i class="fa-solid fa-dice text-lg"></i> Lấy Video Random Khác
                    </button>
                `;
                specialBox.classList.remove('hidden');
            }
        }
    } catch (error) { showError(error.message); } 
    finally { showLoading(false); }
}

// ================= 3. SOI KÊNH (BUNG FULL) =================
async function fetchUserInfo(isLoadMore = false) {
    let user = isLoadMore ? currentUserProfile : document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID vô mới quét được!");

    if (!isLoadMore) {
        clearResults();
        currentUserProfile = user;
        document.getElementById('fetch-info-btn').disabled = true;
        showLoading(true, "Đang quét dữ liệu kênh...");
    } else {
        document.getElementById('load-more-btn').disabled = true;
        document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    }

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=${userVideoCursor}`);
        const data = await response.json();
        if (data.status !== "Live") throw new Error(data.error || "Mục tiêu không tồn tại.");

        if (!isLoadMore && data.author) {
            fullUserData = data; 
            
            // Bung hồ sơ bằng Collapsible Box
            const container = document.getElementById('user-info-area');
            const u = fullUserData.author;
            const s = fullUserData.stats_formatted || {};
            
            container.innerHTML = `
                <div class="w-full glass-panel rounded-[2rem] relative shadow-2xl animate-fade-up border border-white/10">
                    <div id="channel-profile-box" class="collapsible-box p-8 md:p-10 text-center relative">
                        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-pink-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
                        <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-slate-800 shadow-[0_0_30px_rgba(236,72,153,0.5)] relative z-10 bg-slate-900" loading="lazy">
                        <h2 class="text-2xl font-extrabold mt-4 text-white flex items-center justify-center gap-2">
                            ${u.nickname || u.uniqueId} 
                            ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-xl drop-shadow-md" title="Tài khoản chính chủ"></i>' : ''}
                        </h2>
                        <p class="text-pink-400 font-medium text-sm mt-0.5">@${u.uniqueId}</p>
                        
                        ${fullUserData.live_info ? `<div class="mt-3 inline-block bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">🔴 ${fullUserData.live_info.status}</div>` : ''}
                        <p class="mt-4 text-slate-300 text-sm leading-relaxed max-w-xl mx-auto italic">${u.signature || 'Chưa có tiểu sử.'}</p>
                        ${u.bioLink ? `<a href="${u.bioLink}" target="_blank" class="inline-block mt-3 text-blue-400 text-xs bg-slate-800 px-4 py-2 rounded-xl border border-white/5"><i class="fa-solid fa-link mr-1"></i>${u.bioLink}</a>` : ''}
                        
                        <div class="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-slate-700/50">
                            <div class="flex flex-col"><span class="text-xl font-bold text-white">${s.following || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Đang FL</span></div>
                            <div class="flex flex-col"><span class="text-xl font-bold text-white">${s.follower || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Follower</span></div>
                            <div class="flex flex-col"><span class="text-xl font-bold text-white">${s.heart || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Thích</span></div>
                            <div class="flex flex-col"><span class="text-xl font-bold text-white">${s.video || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Video</span></div>
                        </div>
                    </div>
                    <button class="expand-btn w-10 h-10 bg-slate-800 border border-slate-600 rounded-full text-white shadow-lg flex items-center justify-center hover:bg-pink-600 transition" onclick="toggleExpand('channel-profile-box')">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
            `;
            container.classList.remove('hidden');
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = data.videos.map(v => ({
                link: v.link,
                data: {
                    status: "Live",
                    author: { 
                        uniqueId: user, 
                        nickname: fullUserData.author.nickname || user, 
                        avatar: fullUserData.author.avatar || "",
                        verified: fullUserData.author.verified || false
                    },
                    video_data: { id: v.id, description: v.caption },
                    stats: v.stats, urls: v.urls, music: v.music, images: v.images || null
                }
            }));
            const startIndex = fetchedVideos.length;
            fetchedVideos.push(...formattedResults);
            renderVideoCards(formattedResults, isLoadMore, startIndex);
        }

        userVideoCursor = data.cursor;
        checkLoadMoreUI(data.hasMore);
    } catch (error) { if (!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { showLoading(false); document.getElementById('fetch-info-btn').disabled = false; }
}

// ================= 4. PHÂN TÍCH KÊNH CỰC SÂU (ANALYTICS) =================
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    clearResults();
    currentMode = 'analytics';
    document.getElementById('fetch-analytics-btn').disabled = true;
    showLoading(true, "Đang quét sâu dữ liệu kênh để trích xuất báo cáo...");

    try {
        // Quét 2 trang (tối đa 60 video) để phân tích cho chuẩn
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        
        for(let i=0; i<2; i++) {
            const response = await fetch(`/api/index?username=${user}&cursor=${cur}`);
            const data = await response.json();
            if (data.status !== "Live" || !data.videos) break;
            if (i === 0) pAuthor = data.author;
            allVideos = allVideos.concat(data.videos);
            cur = data.cursor;
            if(!data.hasMore) break;
        }

        if (allVideos.length === 0) throw new Error("Kênh này không có video hoặc bị khóa riêng tư.");

        let totalPlays = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        let hashtagCounts = {};

        // Sắp xếp lại mảng theo create_time (nếu có, nếu không lấy thứ tự API)
        // Lưu ý: api/index.js chưa trả create_time, ta tính tạm qua video đầu/cuối
        let newestVid = allVideos[0];
        let oldestVid = allVideos[allVideos.length - 1];

        allVideos.forEach(v => {
            totalPlays += parseRawStats(v.stats.play);
            totalLikes += parseRawStats(v.stats.like);
            totalComments += parseRawStats(v.stats.comment);
            totalShares += parseRawStats(v.stats.share);

            let desc = v.caption || "";
            let tags = desc.match(/#[\w_À-ỹ]+/g);
            if(tags) {
                tags.forEach(t => {
                    let cleanTag = t.toLowerCase();
                    hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
                });
            }
        });

        const videoCount = allVideos.length;
        const avgViews = (totalPlays / videoCount);
        const er = totalPlays > 0 ? ((totalLikes + totalComments + totalShares) / totalPlays * 100).toFixed(2) : 0;
        
        let sortedTags = Object.entries(hashtagCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        let tagsHtml = sortedTags.length > 0 
            ? sortedTags.map(t => `<span class="bg-sky-500/10 border border-sky-500/30 text-sky-400 px-3 py-1 rounded-full text-xs font-bold">${t[0]} <span class="opacity-60 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-slate-500 text-sm italic">Kênh này không dùng Hashtag nào</span>';

        const container = document.getElementById('user-info-area');
        
        // Định dạng ngày
        const createDate = pAuthor?.createTime ? new Date(pAuthor.createTime * 1000).toLocaleDateString('vi-VN') : 'Không rõ';
        
        container.innerHTML = `
            <div class="w-full glass-panel rounded-[2rem] border border-white/10 shadow-2xl animate-fade-up relative">
                <div id="analytics-profile-box" class="collapsible-box p-8 md:p-10 relative">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-sky-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    
                    <div class="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                        <img src="${pAuthor?.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)] bg-slate-800">
                        <div>
                            <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">
                                ${pAuthor?.nickname || user}
                                ${pAuthor?.verified ? '<i class="fa-solid fa-circle-check text-blue-500 drop-shadow-md" title="Tài khoản chính chủ"></i>' : ''}
                            </h2>
                            <p class="text-sky-400 font-medium text-sm">Báo cáo Phân tích dựa trên ${videoCount} video gần nhất</p>
                        </div>
                    </div>

                    <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-white/5 mb-6">
                        <div class="text-center flex-1 border-r border-white/10">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Ngày Lập Kênh</span>
                            <span class="font-black text-white text-base">${createDate}</span>
                        </div>
                        <div class="text-center flex-1 border-r border-white/10">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Video Mới Nhất</span>
                            <a href="${newestVid.link}" target="_blank" class="font-bold text-sky-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem Video</a>
                        </div>
                        <div class="text-center flex-1">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Video Cũ Nhất (Đã Quét)</span>
                            <a href="${oldestVid.link}" target="_blank" class="font-bold text-sky-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem Video</a>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner hover:-translate-y-1 transition">
                            <i class="fa-solid fa-fire text-orange-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"></i>
                            <span class="text-2xl font-black text-white">${formatStatsClient(avgViews)}</span>
                            <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold text-center">View Trung Bình</span>
                        </div>
                        <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner hover:-translate-y-1 transition">
                            <i class="fa-solid fa-percent text-sky-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]"></i>
                            <span class="text-2xl font-black text-white">${er}%</span>
                            <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold text-center">Tỷ lệ ER</span>
                        </div>
                        <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner hover:-translate-y-1 transition">
                            <i class="fa-solid fa-heart text-pink-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"></i>
                            <span class="text-2xl font-black text-white">${formatStatsClient(totalLikes / videoCount)}</span>
                            <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold text-center">Like Trung Bình</span>
                        </div>
                        <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner hover:-translate-y-1 transition">
                            <i class="fa-solid fa-play text-emerald-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"></i>
                            <span class="text-2xl font-black text-white">${formatStatsClient(totalPlays)}</span>
                            <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold text-center">Tổng View Đã Quét</span>
                        </div>
                    </div>

                    <div class="mb-2 text-left">
                        <h4 class="text-xs text-slate-300 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-hashtag text-sky-400"></i> Top Hashtag Sử Dụng</h4>
                        <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                    </div>
                </div>
                <button class="expand-btn w-10 h-10 bg-slate-800 border border-slate-600 rounded-full text-white shadow-lg flex items-center justify-center hover:bg-sky-500 transition" onclick="toggleExpand('analytics-profile-box')">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            
            <h3 class="text-center text-xl font-bold text-white mt-12 mb-2 flex items-center justify-center gap-2 animate-fade-up"><i class="fa-solid fa-crown text-yellow-400"></i> TOP 6 VIDEO VIRAL NHẤT</h3>
        `;
        container.classList.remove('hidden');

        let formattedResults = allVideos.map(v => ({
            link: v.link,
            data: {
                status: "Live",
                author: { 
                    uniqueId: user, 
                    nickname: pAuthor?.nickname || user, 
                    avatar: pAuthor?.avatar || "",
                    verified: pAuthor?.verified || false
                },
                video_data: { id: v.id, description: v.caption, create_time: v.createTime || null },
                stats: v.stats, urls: v.urls, music: v.music, images: v.images || null,
                rawPlay: parseRawStats(v.stats.play)
            }
        }));

        formattedResults.sort((a, b) => b.data.rawPlay - a.data.rawPlay);
        fetchedVideos = formattedResults.slice(0, 6); 
        
        renderVideoCards(fetchedVideos, false, 0);

    } catch (error) { showError(error.message); } 
    finally { showLoading(false); document.getElementById('fetch-analytics-btn').disabled = false; }
}

// RENDER GRID VIDEO CHUNG
function renderVideoCards(results, append = false, startIndex = 0) {
    requestAnimationFrame(() => {
        const container = document.getElementById('result-area');
        let html = '';

        const specialAction = document.getElementById('special-action-container');
        if (fetchedVideos.length > 1 && (currentMode === 'video' || linkMode === 'multi')) {
            specialAction.innerHTML = `
                <button onclick="downloadAllVideos(this)" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <i class="fa-solid fa-boxes-packing"></i> Tải Toàn Bộ Video Dưới Đây
                </button>
            `;
            specialAction.classList.remove('hidden');
        } else if (currentMode === 'video' && linkMode === 'single') {
            specialAction.classList.add('hidden'); // Giấu đi nếu Single
        }

        if (!append) {
            container.innerHTML = '';
            if (fetchedVideos.length === 1) container.className = "w-full max-w-[340px] mx-auto z-10 mt-6 pb-8";
            else container.className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 pb-8";
        }

        results.forEach((item, index) => {
            if (item.error || item.data.status !== "Live") return;
            const d = item.data;
            const currentIndex = startIndex + index; 
            
            const mediaTypeBadge = (d.images && d.images.length > 0) 
                ? `<div class="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-lg z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
                : '';

            html += `
                <div class="premium-card-wrapper animate-fade-up" style="animation-delay: ${(index % 20) * 0.03}s">
                    <div onclick="openVideoModal(${currentIndex})" class="premium-card rounded-3xl overflow-hidden relative w-full aspect-[3/4] flex flex-col cursor-pointer group">
                        
                        <div class="absolute inset-0 bg-slate-900 z-0 overflow-hidden">
                            <img src="${d.urls.cover}" class="cover-img w-full h-full object-cover opacity-80" loading="lazy" decoding="async">
                        </div>
                        
                        ${mediaTypeBadge}
                        <div class="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 z-20 shadow-lg">
                            <i class="fa-solid fa-play text-pink-500"></i> ${d.stats.play}
                        </div>

                        <div class="play-aura absolute inset-0 flex items-center justify-center opacity-0 transform scale-50 z-20 pointer-events-none">
                            <div class="w-14 h-14 bg-pink-600/90 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-xl pl-1 border border-pink-400/50">
                                <i class="fa-solid fa-play"></i>
                            </div>
                        </div>

                        <div class="info-bar absolute bottom-0 left-0 w-full pt-16 pb-4 px-4 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent z-10 flex flex-col justify-end">
                            <div class="flex items-center gap-2.5 mb-2.5">
                                <img src="${d.author.avatar}" class="w-7 h-7 rounded-full object-cover ring-2 ring-pink-500/40 group-hover:ring-pink-500 transition-all shadow-lg bg-slate-800" loading="lazy" decoding="async">
                                <span class="text-white font-bold text-xs truncate drop-shadow-md tracking-wide">${d.author.nickname}</span>
                            </div>
                            
                            <div class="flex gap-2 text-[10px] font-bold text-white/90">
                                <span class="bg-white/10 border border-white/5 px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5 shadow-sm"><i class="fa-solid fa-heart text-pink-500"></i> ${d.stats.like}</span>
                                <span class="bg-white/10 border border-white/5 px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5 shadow-sm"><i class="fa-solid fa-comment text-blue-400"></i> ${d.stats.comment}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (append) container.insertAdjacentHTML('beforeend', html);
        else container.innerHTML = html;
    });
}

function checkLoadMoreUI(hasMore) {
    const loadMoreContainer = document.getElementById('load-more-container');
    if (hasMore) {
        loadMoreContainer.classList.remove('hidden');
        document.getElementById('load-more-btn').disabled = false;
        document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-angle-down"></i> Tải Thêm Video`;
    } else loadMoreContainer.classList.add('hidden');
}

async function downloadAllVideos(btnObj) {
    if (!fetchedVideos || fetchedVideos.length === 0) return;
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btnObj.disabled = true;

    for (let i = 0; i < fetchedVideos.length; i++) {
        const d = fetchedVideos[i].data;
        const filename = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
        try {
            const response = await fetch(d.urls.no_watermark);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none'; a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); a.remove();
        } catch(e) { window.open(d.urls.no_watermark, '_blank'); }
        await new Promise(r => setTimeout(r, 800)); 
    }
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.disabled = false; }, 3000);
}
