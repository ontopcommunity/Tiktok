let currentMode = 'video';
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;

// Biến cho tab Xu Hướng
let trendingRegion = 'VN';

function switchTab(mode) {
    currentMode = mode;
    ['video', 'search', 'info', 'trending'].forEach(m => {
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
    
    searchCursor = 0;
    currentSearchKeyword = "";
    userVideoCursor = 0;
    currentUserProfile = "";
    fullUserData = null;
}

function generateFileName(author, videoId, ext) { return `${author}_${videoId}.${ext}`; }

const formatStatsClient = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
};

// ================= BYPASS DOWNLOAD =================
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

// ================= MODAL HIỂN THỊ CHI TIẾT (CINEMA UI) =================
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

    const safeDesc = (d.video_data.description || 'Tác giả rất lười, không để lại chữ nào.');

    document.getElementById('modal-video-info').innerHTML = `
        <div class="flex items-center gap-4 mb-6 p-3 -ml-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-all duration-300 group" onclick="searchUserFromModal('${d.author.uniqueId}')">
            <div class="relative">
                <div class="absolute inset-0 bg-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-60 transition duration-300"></div>
                <img src="${d.author.avatar}" class="w-14 h-14 rounded-full object-cover border-2 border-slate-700 group-hover:border-pink-500 relative z-10 shadow-lg" loading="lazy" decoding="async">
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-white text-lg group-hover:text-pink-400 transition">${d.author.nickname}</h3>
                <p class="text-pink-500/80 font-medium text-sm">@${d.author.uniqueId}</p>
            </div>
            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-pink-500/20 group-hover:text-pink-400 text-slate-500 transition">
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        </div>
        
        <p class="text-slate-300 text-[15px] leading-relaxed whitespace-pre-wrap mb-8 bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">${safeDesc}</p>
        
        <div class="grid grid-cols-2 gap-3 md:gap-4">
            <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border-t border-white/10 hover:-translate-y-1 transition duration-300">
                <i class="fa-solid fa-play text-slate-400 text-2xl mb-1.5 drop-shadow-md"></i>
                <span class="text-white text-xl font-black">${d.stats.play}</span>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Lượt xem</span>
            </div>
            <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border-t border-white/10 hover:-translate-y-1 transition duration-300">
                <i class="fa-solid fa-heart text-pink-500 text-2xl mb-1.5 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]"></i>
                <span class="text-white text-xl font-black">${d.stats.like}</span>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Yêu thích</span>
            </div>
            <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border-t border-white/10 hover:-translate-y-1 transition duration-300">
                <i class="fa-solid fa-comment text-blue-400 text-2xl mb-1.5 drop-shadow-[0_0_10px_rgba(96,165,250,0.6)]"></i>
                <span class="text-white text-xl font-black">${d.stats.comment}</span>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Bình luận</span>
            </div>
            <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border-t border-white/10 hover:-translate-y-1 transition duration-300">
                <i class="fa-solid fa-share text-emerald-400 text-2xl mb-1.5 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]"></i>
                <span class="text-white text-xl font-black">${d.stats.share}</span>
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Chia sẻ</span>
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

// ================= CÁC HÀM FETCH DỮ LIỆU =================

// FORMAT DATA CHUNG TỪ TIKWM
function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar || v.cover },
            video_data: { id: v.video_id, description: v.title },
            stats: { play: formatStatsClient(v.play_count), like: formatStatsClient(v.digg_count), comment: formatStatsClient(v.comment_count), share: formatStatsClient(v.share_count) },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// 1. TẢI BẰNG LINK
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");

    clearResults();
    showLoading(true, `Đang xử lý ${links.length} luồng dữ liệu...`);
    document.getElementById('fetch-video-btn').disabled = true;

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        fetchedVideos = results.filter(r => r.data && r.data.status === "Live");
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError("Lỗi: " + error.message); } 
    finally { showLoading(false); document.getElementById('fetch-video-btn').disabled = false; }
}

// 2. TÌM KIẾM
async function searchTikTok(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return showError("Nhập từ khóa vô!");

    if (!isLoadMore) {
        clearResults();
        currentSearchKeyword = kw; searchCursor = 0;
        document.getElementById('fetch-search-btn').disabled = true;
        document.getElementById('random-btn').disabled = true;
        showLoading(true, `Đang tìm: "${kw}"...`);
    } else {
        document.getElementById('load-more-btn').disabled = true;
        document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    }

    try {
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=20`);
        const resData = await response.json();
        if (resData.code !== 0 || !resData.data?.videos?.length) throw new Error("Không tìm thấy kết quả.");

        const formattedResults = formatTikWmToGrid(resData.data.videos);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        searchCursor = resData.data.cursor;
        
        renderVideoCards(formattedResults, isLoadMore, startIndex);
        checkLoadMoreUI(resData.data.hasMore);
    } catch (error) { if(!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-search-btn').disabled = false;
        document.getElementById('random-btn').disabled = false;
    }
}

// 2b. TÌM KIẾM NGẪU NHIÊN 1 VIDEO
async function searchRandom() {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw) return showError("Cần có từ khóa để random!");

    clearResults();
    currentSearchKeyword = kw;
    document.getElementById('fetch-search-btn').disabled = true;
    document.getElementById('random-btn').disabled = true;
    showLoading(true, `Đang bốc thăm may mắn: "${kw}"...`);

    try {
        const randomCursor = Math.floor(Math.random() * 20);
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${randomCursor}&count=20`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data?.videos?.length) {
            const retryRes = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=0&count=20`);
            const retryData = await retryRes.json();
            if (retryData.code !== 0 || !retryData.data?.videos?.length) throw new Error("Không có video nào.");
            resData.data = retryData.data;
        }

        const luckyVideo = resData.data.videos[Math.floor(Math.random() * resData.data.videos.length)];
        fetchedVideos = formatTikWmToGrid([luckyVideo]);
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError(error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-search-btn').disabled = false;
        document.getElementById('random-btn').disabled = false;
    }
}

// 3. SOI KÊNH
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
            renderUserInfoCompact(); 
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = data.videos.map(v => ({
                link: v.link,
                data: {
                    status: "Live",
                    author: { uniqueId: user, nickname: fullUserData.author.nickname || user, avatar: fullUserData.author.avatar || "" },
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

// PROFILE UI
function renderUserInfoCompact() {
    const container = document.getElementById('user-info-area');
    const u = fullUserData.author;
    const s = fullUserData.stats_formatted;
    container.innerHTML = `
        <div class="w-full glass-panel rounded-[2rem] p-4 md:p-5 cursor-pointer hover:bg-slate-800 transition duration-300 shadow-xl flex items-center justify-between" onclick="renderUserInfoExpanded()">
            <div class="flex items-center gap-4">
                <img src="${u.avatar}" class="w-14 h-14 rounded-full object-cover border-2 border-pink-500 bg-slate-800" loading="lazy" decoding="async">
                <div class="text-left">
                    <h2 class="text-lg font-bold text-white flex items-center gap-1.5">${u.nickname} ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-400 text-xs"></i>' : ''}</h2>
                    <p class="text-slate-400 text-sm font-medium">@${u.uniqueId} • ${s?.follower || '0'} Fl</p>
                </div>
            </div>
            <div class="text-slate-500 flex flex-col items-center bg-slate-900/50 p-2 px-4 rounded-xl border border-white/5">
                <span class="text-xs font-bold text-pink-500">MỞ RỘNG</span>
                <i class="fa-solid fa-chevron-down mt-1"></i>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

function renderUserInfoExpanded() {
    const container = document.getElementById('user-info-area');
    const u = fullUserData.author;
    const s = fullUserData.stats_formatted;
    container.innerHTML = `
        <div class="w-full glass-panel rounded-[2.5rem] p-8 md:p-10 text-center relative overflow-hidden shadow-2xl animate-fade-up">
            <button class="absolute top-4 right-4 z-20 w-10 h-10 bg-slate-800 border border-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition" onclick="renderUserInfoCompact()"><i class="fa-solid fa-chevron-up"></i></button>
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-pink-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
            
            <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-slate-800 shadow-[0_0_30px_rgba(236,72,153,0.5)] relative z-10 bg-slate-900" loading="lazy" decoding="async">
            <h2 class="text-2xl font-extrabold mt-4 text-white flex items-center justify-center gap-2">${u.nickname} ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-400"></i>' : ''}</h2>
            <p class="text-pink-400 font-medium text-sm mt-0.5">@${u.uniqueId}</p>
            ${fullUserData.live_info ? `<div class="mt-3 inline-block bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">🔴 ${fullUserData.live_info.status}</div>` : ''}
            <p class="mt-4 text-slate-300 text-sm leading-relaxed max-w-xl mx-auto italic">${u.signature || 'Chưa có tiểu sử.'}</p>
            
            <div class="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-slate-700/50">
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.following || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Đang FL</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.follower || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Follower</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.heart || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Thích</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.video || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Video</span></div>
            </div>
        </div>
    `;
}

// 4. XU HƯỚNG MỚI THÊM
async function fetchTrending(isLoadMore = false) {
    if (!isLoadMore) {
        clearResults();
        trendingRegion = document.getElementById('trending-region').value;
        document.getElementById('fetch-trending-btn').disabled = true;
        showLoading(true, `Đang kết nối lấy dữ liệu Xu Hướng...`);
    } else {
        document.getElementById('load-more-btn').disabled = true;
        document.getElementById('load-more-btn').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    }

    try {
        const response = await fetch(`/api/trending?region=${trendingRegion}&count=20`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data || resData.data.length === 0) {
            throw new Error("Không thể lấy video xu hướng hiện tại. Thử đổi quốc gia.");
        }

        const formattedResults = formatTikWmToGrid(resData.data);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        
        renderVideoCards(formattedResults, isLoadMore, startIndex);
        
        // Tab Trending luôn có thể load thêm (nó trả ra random trending array mới mỗi lần)
        checkLoadMoreUI(true);

    } catch (error) { if(!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-trending-btn').disabled = false;
    }
}

// ĐIỀU HƯỚNG NÚT LOAD MORE CHUNG
function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
    else if (currentMode === 'trending') fetchTrending(true);
}

// RENDER GRID VIDEO CHUNG
function renderVideoCards(results, append = false, startIndex = 0) {
    requestAnimationFrame(() => {
        const container = document.getElementById('result-area');
        let html = '';

        if (fetchedVideos.length > 1 && currentMode === 'video') {
            document.getElementById('batch-download-container').classList.remove('hidden');
        } else {
            document.getElementById('batch-download-container').classList.add('hidden');
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
