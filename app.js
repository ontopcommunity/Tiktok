let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

function switchTab(mode) {
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

function showLoading(show, text = "Đang đồng bộ dữ liệu...") {
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
    document.getElementById('result-area').innerHTML = '';
    document.getElementById('result-area').className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-6 pb-6";
    document.getElementById('batch-download-container').classList.add('hidden');
    document.getElementById('load-more-container').classList.add('hidden');
    showError('');
    fetchedVideos = [];
    searchCursor = 0;
    currentSearchKeyword = "";
}

function generateFileName(author, videoId, ext) {
    return `${author}_${videoId}.${ext}`;
}

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
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    btnObj.style.pointerEvents = 'none';

    const triggerDownload = async (targetUrl) => {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error("CORS Blocked");
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = filename; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
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
        btnObj.innerHTML = originalHTML;
        btnObj.style.pointerEvents = 'auto';
    }
}

// ================= XỬ LÝ MODAL =================
function openVideoModal(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');

    document.getElementById('modal-video-container').innerHTML = `
        <video controls playsinline autoplay class="w-full h-full object-contain max-h-[60vh] md:max-h-full" poster="${d.urls.cover}">
            <source src="${d.urls.no_watermark}" type="video/mp4">
        </video>
    `;

    document.getElementById('modal-video-info').innerHTML = `
        <div class="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
            <img src="${d.author.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] bg-slate-800">
            <div>
                <h3 class="font-extrabold text-white text-xl">${d.author.nickname}</h3>
                <p class="text-pink-400 font-medium">@${d.author.uniqueId}</p>
            </div>
        </div>
        
        <p class="text-slate-300 mb-6 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${d.video_data.description || 'Không có nội dung mô tả.'}</p>
        
        <div class="grid grid-cols-2 gap-3 md:gap-4 mb-8">
            <div class="bg-slate-800/50 p-3 md:p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                <i class="fa-solid fa-play text-slate-400 text-xl mb-1"></i>
                <span class="text-white font-bold text-lg">${d.stats.play}</span>
                <span class="text-[10px] md:text-xs text-slate-500 uppercase">Lượt xem</span>
            </div>
            <div class="bg-slate-800/50 p-3 md:p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                <i class="fa-solid fa-heart text-pink-500 text-xl mb-1 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]"></i>
                <span class="text-white font-bold text-lg">${d.stats.like}</span>
                <span class="text-[10px] md:text-xs text-slate-500 uppercase">Yêu thích</span>
            </div>
            <div class="bg-slate-800/50 p-3 md:p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                <i class="fa-solid fa-comment text-blue-400 text-xl mb-1"></i>
                <span class="text-white font-bold text-lg">${d.stats.comment}</span>
                <span class="text-[10px] md:text-xs text-slate-500 uppercase">Bình luận</span>
            </div>
            <div class="bg-slate-800/50 p-3 md:p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                <i class="fa-solid fa-share text-emerald-400 text-xl mb-1"></i>
                <span class="text-white font-bold text-lg">${d.stats.share}</span>
                <span class="text-[10px] md:text-xs text-slate-500 uppercase">Chia sẻ</span>
            </div>
        </div>

        <div class="flex flex-col gap-3 mt-auto">
            <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" 
                class="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3.5 md:py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 text-base md:text-lg">
                <i class="fa-solid fa-video"></i> Tải Video Không Logo
            </button>
            <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" 
                class="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold py-3.5 md:py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm md:text-base">
                <i class="fa-solid fa-music text-purple-400"></i> Tải Nhạc (Bypass Tab)
            </button>
        </div>
    `;

    document.getElementById('video-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openAvatarModal(url) {
    document.getElementById('modal-avatar-img').src = url;
    document.getElementById('avatar-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = 'auto';
    if(modalId === 'video-modal') {
        document.getElementById('modal-video-container').innerHTML = ''; 
    }
}

// ================= TÍNH NĂNG 1: XỬ LÝ LINK =================
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    if (links.length === 0) return showError("Hãy dán ít nhất 1 link bạn ơi.");
    if (links.length > 20) return showError("Hệ thống chỉ chạy tối đa 20 link/lần để tránh nghẽn.");

    clearResults();
    showLoading(true, `Đang mã hóa ${links.length} luồng dữ liệu...`);
    const btn = document.getElementById('fetch-video-btn');
    btn.disabled = true;

    try {
        const promises = links.map(link => 
            fetch(`/api/video?video=${encodeURIComponent(link)}`)
            .then(res => res.json())
            .then(data => ({ link, data }))
            .catch(err => ({ link, error: err.message }))
        );

        const results = await Promise.all(promises);
        fetchedVideos = results.map((r, idx) => ({ ...r, originalIndex: idx })).filter(r => r.data && r.data.status === "Live");

        renderVideoCards(fetchedVideos, false, 0);

    } catch (error) {
        showError("Lỗi Server: " + error.message);
    } finally {
        showLoading(false);
        btn.disabled = false;
    }
}

// ================= TÍNH NĂNG 2: TÌM KIẾM VIDEO (Gọi API Vercel) =================
async function searchTikTok(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw) return showError("Hãy nhập từ khóa gì đó đi!");

    if (!isLoadMore) {
        clearResults();
        currentSearchKeyword = kw;
        searchCursor = 0;
        document.getElementById('fetch-search-btn').disabled = true;
        showLoading(true, `Đang quét vệ tinh tìm: "${kw}"...`);
    } else {
        const loadBtn = document.getElementById('load-more-btn');
        loadBtn.disabled = true;
        loadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang load thêm...`;
    }

    try {
        // Gọi thẳng vào API backend của bạn thay vì gọi trực tiếp TikWM
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=20`);
        const resData = await response.json();

        if (resData.code !== 0 || !resData.data || !resData.data.videos || resData.data.videos.length === 0) {
            throw new Error("Không tìm thấy video nào. Hãy thử từ khóa khác.");
        }

        const videos = resData.data.videos;
        searchCursor = resData.data.cursor;
        const hasMore = resData.data.hasMore;

        const formattedResults = videos.map(v => ({
            link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
            data: {
                status: "Live",
                author: {
                    uniqueId: v.author.unique_id,
                    nickname: v.author.nickname,
                    avatar: v.author.avatar || v.cover
                },
                video_data: {
                    id: v.video_id,
                    description: v.title
                },
                stats: {
                    play: formatStatsClient(v.play_count),
                    like: formatStatsClient(v.digg_count),
                    comment: formatStatsClient(v.comment_count),
                    share: formatStatsClient(v.share_count)
                },
                urls: {
                    cover: v.cover,
                    no_watermark: v.play
                },
                music: {
                    playUrl: v.music
                }
            }
        }));

        const startIndex = fetchedVideos.length;
        fetchedVideos.push(...formattedResults);

        renderVideoCards(formattedResults, isLoadMore, startIndex);

        const loadMoreContainer = document.getElementById('load-more-container');
        if (hasMore) {
            loadMoreContainer.classList.remove('hidden');
            const loadBtn = document.getElementById('load-more-btn');
            loadBtn.disabled = false;
            loadBtn.innerHTML = `<i class="fa-solid fa-angle-down"></i> Tải Thêm Video Nữa`;
        } else {
            loadMoreContainer.classList.add('hidden');
        }

    } catch (error) {
        if(!isLoadMore) showError(error.message);
        else alert("Lỗi khi tải thêm: " + error.message);
    } finally {
        showLoading(false);
        document.getElementById('fetch-search-btn').disabled = false;
    }
}

// ================= RENDER CARD VIDEO (Dùng chung cho Link & Search) =================
function renderVideoCards(results, append = false, startIndex = 0) {
    const container = document.getElementById('result-area');
    let html = '';

    if (fetchedVideos.length > 1) {
        document.getElementById('batch-download-container').classList.remove('hidden');
    }

    if (!append) {
        container.innerHTML = '';
        if (fetchedVideos.length === 1) {
            container.className = "w-full max-w-md mx-auto z-10 mt-8 grid grid-cols-1 gap-5 pb-8";
        } else if (fetchedVideos.length >= 2) {
            container.className = "w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto z-10 mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 pb-8";
        }
    }

    results.forEach((item, index) => {
        const delay = (index % 20) * 0.05; 
        
        if (item.error || item.data.status !== "Live") {
            html += `
                <div class="col-span-full glass-dark rounded-2xl p-4 border border-red-500/30 text-red-400 text-sm animate-fade-up flex items-center gap-3" style="animation-delay: ${delay}s">
                    <i class="fa-solid fa-skull-crossbones text-xl"></i>
                    <span>Lỗi hoặc riêng tư: <span class="opacity-70">${item.link}</span></span>
                </div>`;
            return;
        }

        const d = item.data;
        const currentIndex = startIndex + index; 
        
        html += `
            <div onclick="openVideoModal(${currentIndex})" class="glass-dark rounded-2xl sm:rounded-3xl overflow-hidden animate-fade-up video-card-hover relative group border border-slate-700/50 flex flex-col h-full" style="animation-delay: ${delay}s">
                
                <div class="w-full aspect-[3/4] relative overflow-hidden bg-slate-900 flex-shrink-0">
                    <img src="${d.urls.cover}" class="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-300">
                    
                    <div class="play-overlay absolute inset-0 flex items-center justify-center opacity-0 transform scale-50 transition-all duration-300">
                        <div class="w-12 h-12 sm:w-16 sm:h-16 bg-pink-600/80 rounded-full flex items-center justify-center backdrop-blur-sm shadow-[0_0_30px_rgba(236,72,153,0.8)] text-white text-xl sm:text-2xl pl-1">
                            <i class="fa-solid fa-play"></i>
                        </div>
                    </div>

                    <div class="absolute bottom-0 left-0 w-full p-2 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                        <div class="flex items-center gap-1.5 sm:gap-2">
                            <img src="${d.author.avatar}" class="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-white/20 object-cover bg-slate-800">
                            <span class="text-white font-bold text-[10px] sm:text-sm line-clamp-1">${d.author.nickname}</span>
                        </div>
                    </div>
                </div>

                <div class="mt-auto grid grid-cols-3 divide-x divide-white/10 bg-black/40 border-t border-white/5 py-2 sm:py-3">
                    <div class="flex flex-col items-center justify-center px-1">
                        <i class="fa-solid fa-play text-slate-400 text-[10px] sm:text-xs mb-0.5 sm:mb-1"></i>
                        <span class="text-white font-bold text-[10px] sm:text-xs">${d.stats.play}</span>
                    </div>
                    <div class="flex flex-col items-center justify-center px-1">
                        <i class="fa-solid fa-heart text-pink-500 text-[10px] sm:text-xs mb-0.5 sm:mb-1"></i>
                        <span class="text-white font-bold text-[10px] sm:text-xs">${d.stats.like}</span>
                    </div>
                    <div class="flex flex-col items-center justify-center px-1">
                        <i class="fa-solid fa-comment text-blue-400 text-[10px] sm:text-xs mb-0.5 sm:mb-1"></i>
                        <span class="text-white font-bold text-[10px] sm:text-xs">${d.stats.comment}</span>
                    </div>
                </div>
            </div>
        `;
    });

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }
}

// ================= TẢI TOÀN BỘ BATCH =================
async function downloadAllVideos(btnObj) {
    if (!fetchedVideos || fetchedVideos.length === 0) return;
    
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang xếp hàng tải...`;
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
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch(e) {
            window.open(vid.urls.no_watermark, '_blank');
        }
        
        await sleep(1000); 
    }

    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất ${fetchedVideos.length} Video`;
    setTimeout(() => {
        btnObj.innerHTML = originalHTML;
        btnObj.disabled = false;
    }, 3000);
}

// ================= TÍNH NĂNG 3: SOI KÊNH =================
async function fetchUserInfo() {
    let user = document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Bỏ trống ID thì soi bằng niềm tin à?");

    clearResults();
    document.getElementById('result-area').className = "w-full max-w-4xl z-10 mt-8 flex flex-col items-center pb-20 mx-auto"; 
    showLoading(true, "Đang thâm nhập radar quét kênh...");
    const btn = document.getElementById('fetch-info-btn');
    btn.disabled = true;

    try {
        const response = await fetch(`/api/index?username=${user}`);
        const data = await response.json();
        if (data.status !== "Live") throw new Error(data.error || "Mục tiêu không tồn tại hoặc radar bị chặn.");
        renderUserInfo(data);
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
        btn.disabled = false;
    }
}

function renderUserInfo(data) {
    const container = document.getElementById('result-area');
    const u = data.author;
    const s = data.stats_formatted;

    container.innerHTML = `
        <div class="w-full glass-dark rounded-[2.5rem] p-8 md:p-12 text-center animate-fade-up relative overflow-hidden border border-white/10 shadow-2xl">
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-48 bg-pink-600 rounded-full mix-blend-screen filter blur-[80px] opacity-40"></div>
            
            <div class="relative inline-block mt-4 cursor-pointer group" onclick="openAvatarModal('${u.avatar}')">
                <img src="${u.avatar}" class="w-32 h-32 rounded-full mx-auto object-cover border-4 border-slate-800 shadow-[0_0_30px_rgba(236,72,153,0.3)] relative z-10 group-hover:scale-105 transition-transform duration-300">
                <div class="absolute inset-0 bg-black/40 rounded-full z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm border-4 border-pink-500">
                    <i class="fa-solid fa-magnifying-glass-plus text-white text-3xl"></i>
                </div>
            </div>
            
            <h2 class="text-3xl md:text-4xl font-extrabold mt-6 text-white flex items-center justify-center gap-3 drop-shadow-md">
                ${u.nickname} ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-400 text-2xl drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]"></i>' : ''}
            </h2>
            <p class="text-pink-400 font-bold text-lg mt-1 tracking-wide">@${u.uniqueId}</p>
            
            ${data.live_info ? `<div class="mt-4 inline-flex items-center gap-2 bg-red-900/50 border border-red-500/50 text-red-400 px-5 py-2 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> ${data.live_info.status}</div>` : ''}

            <p class="mt-8 text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mx-auto italic whitespace-pre-wrap px-4">${u.signature || 'Hành tung bí ẩn, chưa có tiểu sử.'}</p>
            ${u.bioLink ? `<a href="${u.bioLink}" target="_blank" class="inline-block mt-4 text-blue-400 hover:text-blue-300 hover:underline text-sm bg-blue-900/30 px-4 py-2 rounded-full border border-blue-500/30 transition-all"><i class="fa-solid fa-link mr-2"></i>${u.bioLink}</a>` : ''}
            
            <div class="flex justify-center divide-x divide-slate-700/50 mt-12 pt-8 border-t border-slate-700/50">
                <div class="px-4 md:px-10 flex flex-col items-center">
                    <span class="text-3xl md:text-4xl font-black text-white drop-shadow-md">${s.following}</span>
                    <span class="text-xs md:text-sm text-slate-400 uppercase tracking-widest mt-2 font-bold">Đang follow</span>
                </div>
                <div class="px-4 md:px-10 flex flex-col items-center">
                    <span class="text-3xl md:text-4xl font-black text-white drop-shadow-md">${s.follower}</span>
                    <span class="text-xs md:text-sm text-slate-400 uppercase tracking-widest mt-2 font-bold">Follower</span>
                </div>
                <div class="px-4 md:px-10 flex flex-col items-center">
                    <span class="text-3xl md:text-4xl font-black text-white drop-shadow-md">${s.heart}</span>
                    <span class="text-xs md:text-sm text-slate-400 uppercase tracking-widest mt-2 font-bold">Lượt thích</span>
                </div>
            </div>
        </div>
    `;
}

