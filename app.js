let currentMode = 'video';
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let currentUserAvatar = "";
let currentUserNickname = "";
let fullUserData = null;

function switchTab(mode) {
    currentMode = mode;
    document.getElementById('mode-video').classList.toggle('hidden', mode !== 'video');
    document.getElementById('mode-search').classList.toggle('hidden', mode !== 'search');
    document.getElementById('mode-info').classList.toggle('hidden', mode !== 'info');
    
    ['video', 'search', 'info'].forEach(m => {
        const btn = document.getElementById(`tab-${m}`);
        if (m === mode) {
            btn.className = 'tab-btn tab-active focus:outline-none flex items-center gap-2 text-base md:text-lg';
        } else {
            btn.className = 'tab-btn tab-inactive focus:outline-none flex items-center gap-2 text-base md:text-lg';
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

function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
}

async function forceDownload(url, filename, btnObj) {
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang nén...`;
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

    try {
        await triggerDownload(url);
    } catch (error) {
        try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            await triggerDownload(proxyUrl);
        } catch (proxyError) {
            window.open(url, '_blank');
        }
    } finally {
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
        setTimeout(() => {
            btnObj.innerHTML = originalHTML;
            btnObj.style.pointerEvents = 'auto';
        }, 2000);
    }
}

function searchUserFromModal(username) {
    closeModal('video-modal');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openVideoModal(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');

    document.getElementById('modal-video-container').innerHTML = `
        <video controls playsinline autoplay class="w-full h-full object-contain max-h-[100%] bg-black" poster="${d.urls.cover}">
            <source src="${d.urls.no_watermark}" type="video/mp4">
        </video>
    `;

    document.getElementById('modal-video-info').innerHTML = `
        <div class="flex items-center gap-3 mb-4 p-2 -ml-2 rounded-xl hover:bg-white/5 cursor-pointer transition group" onclick="searchUserFromModal('${d.author.uniqueId}')">
            <!-- Thêm decoding="async" để chống lag -->
            <img src="${d.author.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-pink-500 transition shadow-sm bg-slate-800" loading="lazy" decoding="async">
            <div class="flex-1">
                <h3 class="font-bold text-white text-base group-hover:text-pink-400 transition">${d.author.nickname}</h3>
                <p class="text-slate-400 text-xs">@${d.author.uniqueId}</p>
            </div>
            <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-pink-500 transition text-sm"></i>
        </div>
        
        <p class="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap mb-5">${d.video_data.description || 'Không có mô tả.'}</p>
        
        <div class="flex gap-4 border-t border-white/5 pt-4">
            <div class="flex items-center gap-2"><i class="fa-solid fa-play text-slate-500"></i><span class="text-white text-sm font-bold">${d.stats.play}</span></div>
            <div class="flex items-center gap-2"><i class="fa-solid fa-heart text-pink-500"></i><span class="text-white text-sm font-bold">${d.stats.like}</span></div>
            <div class="flex items-center gap-2"><i class="fa-solid fa-comment text-blue-400"></i><span class="text-white text-sm font-bold">${d.stats.comment}</span></div>
            <div class="flex items-center gap-2"><i class="fa-solid fa-share text-emerald-400"></i><span class="text-white text-sm font-bold">${d.stats.share}</span></div>
        </div>
    `;

    document.getElementById('modal-video-actions').innerHTML = `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 text-sm">
            <i class="fa-solid fa-video"></i> Tải Video
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm">
            <i class="fa-solid fa-music text-purple-400"></i> Tải MP3
        </button>
    `;

    document.getElementById('video-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
    if(modalId === 'video-modal') {
        // TỐI ƯU SIÊU CẤP: Ép giải phóng bộ nhớ của Thẻ Video khi tắt (Chống rò rỉ RAM)
        const videoEl = document.querySelector('#modal-video-container video');
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute('src'); 
            videoEl.load();
        }
        document.getElementById('modal-video-container').innerHTML = ''; 
    }
}

async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    if (links.length > 20) return showError("Hệ thống xử lý tối đa 20 link/lần.");

    clearResults();
    showLoading(true, `Đang xử lý ${links.length} luồng dữ liệu...`);
    document.getElementById('fetch-video-btn').disabled = true;

    try {
        const promises = links.map(link => 
            fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message }))
        );
        const results = await Promise.all(promises);
        fetchedVideos = results.map((r, idx) => ({ ...r, originalIndex: idx })).filter(r => r.data && r.data.status === "Live");
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError("Lỗi: " + error.message); } 
    finally { showLoading(false); document.getElementById('fetch-video-btn').disabled = false; }
}

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

        const formattedResults = formatTikWmToGrid(videos, "");
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
        const formattedResults = formatTikWmToGrid([luckyVideo], "");
        fetchedVideos = formattedResults;
        
        renderVideoCards(formattedResults, false, 0);
    } catch (error) { showError(error.message); } 
    finally { 
        showLoading(false); 
        document.getElementById('fetch-search-btn').disabled = false;
        document.getElementById('random-btn').disabled = false;
    }
}

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
            currentUserAvatar = data.author.avatar;
            currentUserNickname = data.author.nickname;
            fullUserData = data; 
            renderUserInfoCompact(); 
        }

        if (data.videos && data.videos.length > 0) {
            const formattedResults = data.videos.map(v => ({
                link: v.link,
                data: {
                    status: "Live",
                    author: { uniqueId: user, nickname: currentUserNickname || user, avatar: currentUserAvatar || "" },
                    video_data: { id: v.id, description: v.caption },
                    stats: v.stats, urls: v.urls, music: v.music
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

function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar || v.cover },
            video_data: { id: v.video_id, description: v.title },
            stats: { play: formatStatsClient(v.play_count), like: formatStatsClient(v.digg_count), comment: formatStatsClient(v.comment_count), share: formatStatsClient(v.share_count) },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music }
        }
    }));
}

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
            <div class="text-slate-500 flex flex-col items-center bg-slate-900/50 p-2 px-4 rounded-xl">
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
            <button class="absolute top-4 right-4 z-20 w-10 h-10 bg-slate-800 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition" onclick="renderUserInfoCompact()"><i class="fa-solid fa-chevron-up"></i></button>
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-pink-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
            
            <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-slate-800 shadow-[0_0_20px_rgba(236,72,153,0.3)] relative z-10 bg-slate-900" loading="lazy" decoding="async">
            <h2 class="text-2xl font-extrabold mt-3 text-white flex items-center justify-center gap-2">${u.nickname} ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-400"></i>' : ''}</h2>
            <p class="text-pink-400 font-medium text-sm mt-0.5">@${u.uniqueId}</p>
            ${fullUserData.live_info ? `<div class="mt-3 inline-block bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">🔴 ${fullUserData.live_info.status}</div>` : ''}
            <p class="mt-4 text-slate-300 text-sm leading-relaxed max-w-xl mx-auto italic">${u.signature || 'Chưa có tiểu sử.'}</p>
            ${u.bioLink ? `<a href="${u.bioLink}" target="_blank" class="inline-block mt-3 text-blue-400 text-xs bg-slate-800 px-3 py-1.5 rounded-lg"><i class="fa-solid fa-link mr-1"></i>${u.bioLink}</a>` : ''}
            
            <div class="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-slate-700/50">
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.following || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5">Đang FL</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.follower || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5">Follower</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.heart || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5">Thích</span></div>
                <div class="flex flex-col"><span class="text-xl font-bold text-white">${s?.video || '0'}</span><span class="text-[10px] text-slate-400 uppercase mt-0.5">Video</span></div>
            </div>
        </div>
    `;
}

function renderVideoCards(results, append = false, startIndex = 0) {
    // TỐI ƯU SIÊU CẤP: Dùng requestAnimationFrame để đẩy việc Render vào luồng chống giật (Trình duyệt sẽ vẽ khi sẵn sàng)
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
            if (fetchedVideos.length === 1) container.className = "w-full max-w-[320px] mx-auto z-10 mt-6 pb-8";
            else container.className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 pb-8";
        }

        results.forEach((item, index) => {
            if (item.error || item.data.status !== "Live") return;
            const d = item.data;
            const currentIndex = startIndex + index; 
            
            // Tối ưu ảnh: loading="lazy" và decoding="async" giúp load hàng ngàn ảnh không bị nghẽn
            html += `
                <div onclick="openVideoModal(${currentIndex})" class="glass-card rounded-2xl overflow-hidden relative group flex flex-col h-full cursor-pointer animate-fade-up" style="animation-delay: ${(index % 20) * 0.03}s">
                    <div class="w-full aspect-[3/4] relative bg-slate-900">
                        <img src="${d.urls.cover}" class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-300" loading="lazy" decoding="async">
                        <div class="play-overlay absolute inset-0 flex items-center justify-center opacity-0 transform scale-50 transition-all duration-300">
                            <div class="w-14 h-14 bg-pink-600/90 rounded-full flex items-center justify-center text-white text-xl pl-1 shadow-lg"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>
                    
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <div class="flex items-center gap-2 mb-1.5 px-1">
                            <img src="${d.author.avatar}" class="w-5 h-5 rounded-full object-cover bg-slate-800" loading="lazy" decoding="async">
                            <span class="text-white font-semibold text-[11px] truncate shadow-black">${d.author.nickname}</span>
                        </div>
                        <div class="flex justify-between px-1 text-[10px] text-white/80 font-medium">
                            <span class="flex items-center gap-1"><i class="fa-solid fa-play text-slate-400"></i> ${d.stats.play}</span>
                            <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-pink-500"></i> ${d.stats.like}</span>
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

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < fetchedVideos.length; i++) {
        const vid = fetchedVideos[i].data;
        const filename = generateFileName(vid.author.uniqueId, vid.video_data.id, 'mp4');
        try {
            const response = await fetch(vid.urls.no_watermark);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none'; a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); a.remove();
        } catch(e) { window.open(vid.urls.no_watermark, '_blank'); }
        await sleep(800); 
    }
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong ${fetchedVideos.length} Video`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.disabled = false; }, 3000);
}
