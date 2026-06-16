let currentMode = 'video';
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;

// Biến cho tính năng Music Scanner ngầm
let currentMusicUrl = "";
let currentMusicId = "";
let musicCursor = 0;

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
    document.getElementById('user-info-area').classList.add('hidden');
    document.getElementById('result-area').innerHTML = '';
    document.getElementById('result-area').className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-6 pb-6";
    document.getElementById('batch-download-container').classList.add('hidden');
    document.getElementById('load-more-container').classList.add('hidden');
    showError('');
    fetchedVideos = [];
    
    searchCursor = 0; currentSearchKeyword = "";
    userVideoCursor = 0; currentUserProfile = ""; fullUserData = null;
    musicCursor = 0; currentMusicUrl = ""; currentMusicId = "";
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

// Điều hướng nút tải thêm
function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
    else if (currentMode === 'music_scan') fetchMoreMusicVideos();
}

async function forceDownload(url, filename, btnObj) {
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btnObj.style.pointerEvents = 'none';

    const triggerDownload = async (targetUrl) => {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error("CORS Blocked");
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = downloadUrl; a.download = filename; 
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(downloadUrl); a.remove();
    };

    try { await triggerDownload(url); } 
    catch (error) {
        try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            await triggerDownload(proxyUrl);
        } catch (proxyError) { window.open(url, '_blank'); }
    } finally {
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
        setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
    }
}

function searchUserFromModal(username) {
    closeModal('video-modal');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= TÍNH NĂNG SOI NHẠC TỪ MODAL =================
async function scanMusicFromModal(musicUrl, musicTitle) {
    closeModal('video-modal');
    clearResults();
    currentMode = 'music_scan'; // Chế độ ảo cho nhạc
    currentMusicUrl = musicUrl;
    musicCursor = 0;
    
    // Tắt viền Active các Tab
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`tab-${m}`);
        if(btn) btn.className = 'tab-btn tab-inactive focus:outline-none flex items-center gap-2 text-base md:text-lg';
    });

    showLoading(true, `Đang truy vết các video dùng chung âm thanh...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const response = await fetch(`/api/music?url=${encodeURIComponent(musicUrl)}`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data || !resData.data.videos || resData.data.videos.length === 0) {
            throw new Error("Không tìm thấy video nào dùng chung bản nhạc này.");
        }

        fetchedVideos = formatTikWmToGrid(resData.data.videos);
        musicCursor = resData.data.cursor;
        currentMusicId = resData.music_id;
        
        const userInfoArea = document.getElementById('user-info-area');
        userInfoArea.innerHTML = `
            <div class="w-full glass-panel rounded-[2rem] p-6 md:p-10 text-center border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] animate-fade-up">
                <div class="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.4)] mb-3 animate-[spin_4s_linear_infinite]">
                    <i class="fa-solid fa-music text-purple-400 text-2xl drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"></i>
                </div>
                <h2 class="text-2xl font-extrabold text-white">Kết Quả Quét Âm Thanh</h2>
                <p class="text-purple-400 font-bold text-sm mt-2 flex items-center justify-center gap-2">
                    <i class="fa-solid fa-compact-disc"></i> ${musicTitle}
                </p>
                <p class="text-slate-400 text-xs mt-3 italic">Toàn bộ video bên dưới đều sử dụng chung âm thanh này</p>
            </div>
        `;
        userInfoArea.classList.remove('hidden'); // HIỆN THÔNG BÁO QUÉT NHẠC

        renderVideoCards(fetchedVideos, false, 0);
        checkLoadMoreUI(resData.data.hasMore);
        
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

async function fetchMoreMusicVideos() {
    document.getElementById('load-more-btn').disabled = true;
    document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;

    try {
        const response = await fetch(`/api/music?music_id=${currentMusicId}&cursor=${musicCursor}`);
        const resData = await response.json();

        if (resData.code !== 0 || !resData.data || !resData.data.videos) throw new Error("Không thể tải thêm video.");

        const formattedResults = formatTikWmToGrid(resData.data.videos);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        musicCursor = resData.data.cursor;

        renderVideoCards(formattedResults, true, startIndex);
        checkLoadMoreUI(resData.data.hasMore);
    } catch (error) {
        alert("Lỗi tải thêm: " + error.message);
    } finally {
        document.getElementById('load-more-btn').disabled = false;
    }
}

// ================= MODAL HIỂN THỊ CHI TIẾT (CINEMA UI PREMIUM) =================
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

    const safeDesc = (d.video_data.description || 'Tác giả rất lười, không để lại chữ nào.').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeMusicTitle = (d.music.title || 'Âm thanh gốc').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    document.getElementById('modal-video-info').innerHTML = `
        <div class="relative p-[1px] rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-5 group cursor-pointer hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all duration-300">
            <div class="flex items-center gap-4 p-3 bg-slate-900/95 backdrop-blur-xl rounded-[15px]" onclick="searchUserFromModal('${d.author.uniqueId}')">
                <div class="relative w-14 h-14">
                    <div class="absolute inset-0 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-full animate-spin blur-[3px] opacity-70 group-hover:opacity-100 transition"></div>
                    <img src="${d.author.avatar}" class="w-14 h-14 rounded-full object-cover relative z-10 border-[2.5px] border-slate-900 bg-slate-800" loading="lazy" decoding="async">
                </div>
                <div class="flex-1 truncate">
                    <h3 class="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 text-lg group-hover:from-pink-400 group-hover:to-purple-400 transition truncate flex items-center gap-1.5">
                        ${d.author.nickname}
                        ${d.author.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-[14px] drop-shadow-md" title="Tài khoản chính chủ"></i>' : ''}
                    </h3>
                    <p class="text-pink-500/80 font-medium text-xs mt-0.5 tracking-wide truncate">@${d.author.uniqueId}</p>
                </div>
                <div class="px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs font-bold border border-white/10 group-hover:bg-pink-500 transition-all flex items-center gap-1.5 shadow-sm">
                    Kênh <i class="fa-solid fa-arrow-right"></i>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5 mb-5 shadow-inner cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/80 transition group" onclick="scanMusicFromModal('${d.music.playUrl}', '${safeMusicTitle}')" title="Bấm để truy vết toàn bộ video dùng nhạc này">
            <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-[spin_4s_linear_infinite]">
                <i class="fa-solid fa-music text-purple-400 text-xs drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-white text-sm font-bold truncate tracking-wide group-hover:text-purple-400 transition">${d.music.title}</p>
                <p class="text-[10px] text-slate-400 uppercase font-semibold mt-0.5 tracking-widest flex items-center gap-1.5">Bấm để soi nhạc <i class="fa-solid fa-arrow-right"></i></p>
            </div>
            <div class="px-2">
                <div class="flex gap-1 items-end h-3">
                    <div class="w-1 bg-purple-500 rounded-full animate-[bounce_1s_infinite] opacity-80 h-2"></div>
                    <div class="w-1 bg-pink-500 rounded-full animate-[bounce_1s_infinite_0.2s] opacity-80 h-3"></div>
                    <div class="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_0.4s] opacity-80 h-1.5"></div>
                </div>
            </div>
        </div>
        
        <div class="relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-5 rounded-2xl border border-slate-700/50 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] mb-6">
            <i class="fa-solid fa-quote-left absolute top-3 right-4 text-4xl text-white/5"></i>
            <h4 class="text-[11px] text-pink-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2"><i class="fa-solid fa-align-left"></i> Mô tả video</h4>
            <p class="text-slate-200 text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap relative z-10 font-medium">${safeDesc}</p>
        </div>
        
        <h4 class="text-[11px] text-blue-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2 pl-1"><i class="fa-solid fa-chart-pie"></i> Tương tác số liệu</h4>
        <div class="grid grid-cols-2 gap-3 md:gap-4 mb-2">
            <div class="relative overflow-hidden bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 hover:bg-slate-800/70 transition duration-300 group">
                <div class="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-slate-400/20 transition"></div>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 shadow-inner"><i class="fa-solid fa-play"></i></div>
                    <div><span class="block text-white text-lg font-black tracking-tight drop-shadow-md transition">${d.stats.play}</span><span class="block text-[10px] text-slate-400 uppercase font-bold mt-0.5">Lượt xem</span></div>
                </div>
            </div>
            <div class="relative overflow-hidden bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 hover:bg-slate-800/70 transition duration-300 group">
                <div class="absolute -right-4 -top-4 w-16 h-16 bg-pink-500/5 rounded-full blur-xl group-hover:bg-pink-500/20 transition"></div>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500"><i class="fa-solid fa-heart drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]"></i></div>
                    <div><span class="block text-white text-lg font-black tracking-tight drop-shadow-md transition">${d.stats.like}</span><span class="block text-[10px] text-slate-400 uppercase font-bold mt-0.5">Yêu thích</span></div>
                </div>
            </div>
            <div class="relative overflow-hidden bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 hover:bg-slate-800/70 transition duration-300 group">
                <div class="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/20 transition"></div>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><i class="fa-solid fa-comment drop-shadow-[0_0_5px_rgba(96,165,250,0.6)]"></i></div>
                    <div><span class="block text-white text-lg font-black tracking-tight drop-shadow-md transition">${d.stats.comment}</span><span class="block text-[10px] text-slate-400 uppercase font-bold mt-0.5">Bình luận</span></div>
                </div>
            </div>
            <div class="relative overflow-hidden bg-slate-800/40 p-3.5 rounded-2xl border border-white/5 hover:bg-slate-800/70 transition duration-300 group">
                <div class="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/20 transition"></div>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><i class="fa-solid fa-share drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]"></i></div>
                    <div><span class="block text-white text-lg font-black tracking-tight drop-shadow-md transition">${d.stats.share}</span><span class="block text-[10px] text-slate-400 uppercase font-bold mt-0.5">Chia sẻ</span></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-video-actions').innerHTML = `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-[0_10px_20px_-10px_rgba(236,72,153,0.6)] flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-download text-lg"></i> Tải Video Gốc
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 border border-slate-600 shadow-lg flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-music text-purple-400 text-lg"></i> Tải Nhạc MP3
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

// FORMAT API DATA TIKWM
function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { 
                uniqueId: v.author.unique_id, 
                nickname: v.author.nickname, 
                avatar: v.author.avatar || v.cover,
                verified: v.author.is_verify ||
