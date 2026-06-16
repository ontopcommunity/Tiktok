let currentMode = 'video';
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;

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
}

function generateFileName(author, videoId, ext) { return `${author}_${videoId}.${ext}`; }

const formatStatsClient = (num) => {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
};

// Hàm dịch chữ (Ví dụ: 1.5M -> 1500000) dùng cho Analytics
function parseRawStats(str) {
    if(!str) return 0;
    if(typeof str === 'number') return str;
    let multi = 1;
    if(str.includes('K')) multi = 1000;
    if(str.includes('M')) multi = 1000000;
    return parseFloat(str.replace(/,/g, '.').replace(/[KM]/g, '')) * multi;
}

function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
}

// Bypass Download 
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
        <div class="relative p-[1px] rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-5 group cursor-pointer hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all duration-300">
            <div class="flex items-center gap-4 p-3 bg-slate-900/95 backdrop-blur-xl rounded-[15px]" onclick="searchUserFromModal('${d.author.uniqueId}')">
                <div class="relative w-14 h-14">
                    <div class="absolute inset-0 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-full animate-spin blur-[3px] opacity-70 group-hover:opacity-100 transition"></div>
                    <img src="${d.author.avatar}" class="w-14 h-14 rounded-full object-cover relative z-10 border-[2.5px] border-slate-900 bg-slate-800" loading="lazy" decoding="async">
                </div>
                <div class="flex-1 truncate">
                    <h3 class="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 text-lg group-hover:from-pink-400 group-hover:to-purple-400 transition truncate">${d.author.nickname}</h3>
                    <p class="text-pink-500/80 font-medium text-xs mt-0.5 tracking-wide truncate">@${d.author.uniqueId}</p>
                </div>
                <div class="px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs font-bold border border-white/10 group-hover:bg-pink-500 transition-all flex items-center gap-1.5">
                    Kênh <i class="fa-solid fa-arrow-right"></i>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5 mb-5 shadow-inner">
            <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-[spin_4s_linear_infinite]">
                <i class="fa-solid fa-music text-purple-400 text-xs drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-white text-sm font-bold truncate tracking-wide">${d.music.title}</p>
                <p class="text-[10px] text-slate-500 uppercase font-semibold mt-0.5 tracking-widest">Âm thanh gốc</p>
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
            author: { uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar || v.cover },
            video_data: { id: v.video_id, description: v.title },
            stats: { play: formatStatsClient(v.play_count), like: formatStatsClient(v.digg_count), comment: formatStatsClient(v.comment_count), share: formatStatsClient(v.share_count) },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// GRID RENDER 3D CAO CẤP
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

// ================= TÍNH NĂNG 1: TẢI LINK =================
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

// ================= TÍNH NĂNG 2: TÌM KIẾM =================
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

        const videos = resData.data.videos;
        searchCursor = resData.data.cursor;

        let formattedResults = formatTikWmToGrid(videos);
        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);
        
        renderVideoCards(formattedResults, isLoadMore, startIndex);
        checkLoadMoreUI(resData.data.hasMore);
    } catch (error) { if(!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-search-btn').disabled = false;
        document.getElementById('random-btn').disabled = false;
    }
}

async function searchRandom() {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw) return showError("Cần có từ khóa để random!");

    clearResults();
    currentSearchKeyword = kw;
    document.getElementById('fetch-search-btn').disabled = true;
    document.getElementById('random-btn').disabled = true;
    showLoading(true, `Đang bốc thăm may mắn: "${kw}"...`);

    try {
        const randomCursor = Math.floor(Math.random() * 30);
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${randomCursor}&count=20`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data?.videos?.length) {
            const retryRes = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=0&count=20`);
            const retryData = await retryRes.json();
            if (retryData.code !== 0 || !retryData.data?.videos?.length) throw new Error("Không có video nào.");
            resData.data = retryData.data;
        }

        const videos = resData.data.videos;
        const luckyVideo = videos[Math.floor(Math.random() * videos.length)];
        fetchedVideos = formatTikWmToGrid([luckyVideo]);
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError(error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-search-btn').disabled = false;
        document.getElementById('random-btn').disabled = false;
    }
}

// ================= TÍNH NĂNG 3: SOI KÊNH =================
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
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = data.videos.map(v => ({
                link: v.link,
                data: {
                    status: "Live",
                    author: { uniqueId: user, nickname: fullUserData?.author?.nickname || user, avatar: fullUserData?.author?.avatar || "" },
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

// ================= TÍNH NĂNG 4: PHÂN TÍCH KÊNH =================
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    clearResults();
    currentMode = 'analytics';
    document.getElementById('fetch-analytics-btn').disabled = true;
    showLoading(true, "Đang tổng hợp dữ liệu 30 video gần nhất để lên báo cáo...");

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=0`);
        const data = await response.json();
        if (data.status !== "Live") throw new Error(data.error || "Mục tiêu không tồn tại.");
        if (!data.videos || data.videos.length === 0) throw new Error("Kênh này chưa có video nào để phân tích.");

        let totalPlays = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        let hashtagCounts = {};

        data.videos.forEach(v => {
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

        const videoCount = data.videos.length;
        const avgViews = (totalPlays / videoCount);
        const er = totalPlays > 0 ? ((totalLikes + totalComments + totalShares) / totalPlays * 100).toFixed(2) : 0;
        
        let sortedTags = Object.entries(hashtagCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        let tagsHtml = sortedTags.length > 0 
            ? sortedTags.map(t => `<span class="bg-pink-500/10 border border-pink-500/30 text-pink-400 px-3 py-1 rounded-full text-xs font-bold">${t[0]} <span class="opacity-60 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-slate-500 text-sm italic">Kênh này không dùng Hashtag nào</span>';

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full glass-panel rounded-[2rem] p-8 relative overflow-hidden shadow-2xl animate-fade-up">
                <div class="absolute top-0 right-0 w-64 h-64 bg-sky-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                
                <div class="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                    <img src="${data.author?.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)] bg-slate-800">
                    <div>
                        <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">${data.author?.nickname || user}</h2>
                        <p class="text-sky-400 font-medium text-sm">Báo cáo Phân tích ${videoCount} video gần nhất</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                        <i class="fa-solid fa-fire text-orange-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"></i>
                        <span class="text-2xl font-black text-white">${formatStatsClient(avgViews)}</span>
                        <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold">View Trung Bình</span>
                    </div>
                    <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                        <i class="fa-solid fa-percent text-sky-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]"></i>
                        <span class="text-2xl font-black text-white">${er}%</span>
                        <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold">Tỷ lệ tương tác (ER)</span>
                    </div>
                    <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                        <i class="fa-solid fa-heart text-pink-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"></i>
                        <span class="text-2xl font-black text-white">${formatStatsClient(totalLikes / videoCount)}</span>
                        <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold">Like Trung Bình</span>
                    </div>
                    <div class="bg-slate-800/60 border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                        <i class="fa-solid fa-play text-emerald-500 text-2xl mb-2 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"></i>
                        <span class="text-2xl font-black text-white">${formatStatsClient(totalPlays)}</span>
                        <span class="text-[10px] text-slate-400 uppercase mt-1 font-bold">Tổng View (30 Vid)</span>
                    </div>
                </div>

                <div class="mb-2">
                    <h4 class="text-xs text-slate-300 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-hashtag text-sky-400"></i> Top Hashtag Sử Dụng</h4>
                    <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                </div>
            </div>
            
            <h3 class="text-center text-xl font-bold text-white mt-12 mb-2 flex items-center justify-center gap-2 animate-fade-up"><i class="fa-solid fa-crown text-yellow-400"></i> TOP 6 VIDEO VIRAL NHẤT</h3>
        `;
        container.classList.remove('hidden');

        // Render Top 6 Viral Videos
        let formattedResults = data.videos.map(v => ({
            link: v.link,
            data: {
                status: "Live",
                author: { uniqueId: user, nickname: data.author?.nickname || user, avatar: data.author?.avatar || "" },
                video_data: { id: v.id, description: v.caption },
                stats: v.stats, urls: v.urls, music: v.music, images: v.images || null,
                rawPlay: parseRawStats(v.stats.play)
            }
        }));

        formattedResults.sort((a, b) => b.data.rawPlay - a.data.rawPlay);
        fetchedVideos = formattedResults.slice(0, 6); // Lấy 6 cái hot nhất
        
        renderVideoCards(fetchedVideos, false, 0);

    } catch (error) { showError(error.message); } 
    finally { showLoading(false); document.getElementById('fetch-analytics-btn').disabled = false; }
}
