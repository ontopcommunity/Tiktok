// ================= TRẠNG THÁI TOÀN CỤC =================
let currentMode = 'video';
let linkMode = 'single'; 
let fetchedVideos = []; 
let currentSortType = 'latest'; 
let currentVideoPlayer = null; 

// PWA Cài Đặt Web App
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-app-btn').classList.remove('hidden');
});

function installWebApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                document.getElementById('install-app-btn').classList.add('hidden');
            }
            deferredPrompt = null;
        });
    }
}

// ================= HÀM XỬ LÝ CHUỖI SỐ LIỆU =================
function parseRawStats(str) {
    if (str === null || str === undefined) return 0;
    if (typeof str === 'number') return str;
    let s = str.toString().toUpperCase().replace(/,/g, '.');
    let multi = 1;
    if (s.includes('K')) multi = 1000;
    if (s.includes('M')) multi = 1000000;
    if (s.includes('B')) multi = 1000000000;
    const parsed = parseFloat(s.replace(/[KMB\s]/g, ''));
    return isNaN(parsed) ? 0 : parsed * multi;
}

function formatStatsClient(num) {
    let rawNum = parseRawStats(num);
    if (rawNum === 0) return "0";
    if (rawNum < 1000) return rawNum.toString();
    if (rawNum < 1000000) return (Math.floor(rawNum / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(rawNum / 100000) / 10).toString().replace('.', ',') + "M";
}

// ================= HÀM ĐIỀU HƯỚNG GIAO DIỆN =================
function switchTab(mode) {
    currentMode = mode;
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        const tabBtn = document.getElementById(`tab-${m}`);
        if(btn && tabBtn) {
            btn.classList.toggle('hidden', m !== mode);
            tabBtn.className = (m === mode) ? 'tab-btn tab-active' : 'tab-btn tab-inactive';
        }
    });
    clearResults();
}

function setLinkMode(mode) {
    linkMode = mode;
    const btnSingle = document.getElementById('subtab-single');
    const btnMulti = document.getElementById('subtab-multi');
    const textArea = document.getElementById('tiktok-links');

    if(mode === 'single') {
        btnSingle.className = "px-4 py-1.5 rounded-lg bg-zinc-700 text-white font-semibold text-[11px] transition shadow-sm";
        btnMulti.className = "px-4 py-1.5 rounded-lg text-zinc-400 font-semibold text-[11px] hover:text-white transition";
        textArea.rows = 1;
        textArea.placeholder = "Dán link Video hoặc Nhật ký (Story)...";
    } else {
        btnMulti.className = "px-4 py-1.5 rounded-lg bg-zinc-700 text-white font-semibold text-[11px] transition shadow-sm";
        btnSingle.className = "px-4 py-1.5 rounded-lg text-zinc-400 font-semibold text-[11px] hover:text-white transition";
        textArea.rows = 4;
        textArea.placeholder = "Dán nhiều link (mỗi link 1 dòng)...";
    }
}

// QUẢN LÝ SKELETON LADING THAY THẾ
function setSkeletonState(isActive, isChannel = false, loadingText = "Đang quét dữ liệu...") {
    const skelArea = document.getElementById('skeleton-area');
    const skelProfile = document.getElementById('skel-profile');
    const txt = document.getElementById('loading-text');
    const resArea = document.getElementById('result-area');
    const errorBox = document.getElementById('error-msg');
    
    errorBox.classList.add('hidden');

    if (isActive) {
        skelArea.classList.remove('hidden');
        txt.innerText = loadingText;
        if (isChannel) {
            skelProfile.classList.remove('hidden');
            resArea.innerHTML = '';
        } else {
            skelProfile.classList.add('hidden');
            resArea.innerHTML = ''; 
        }
    } else {
        skelArea.classList.add('hidden');
    }
}

function showError(msg) {
    const errEl = document.getElementById('error-msg');
    if(errEl) {
        if(msg) {
            errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${msg}`;
            errEl.classList.remove('hidden');
            document.getElementById('result-area').innerHTML = '';
        } else {
            errEl.classList.add('hidden');
        }
    }
}

function clearResults() {
    const userInfoArea = document.getElementById('user-info-area');
    if(userInfoArea) { userInfoArea.innerHTML = ''; userInfoArea.classList.add('hidden'); }
    
    const resultArea = document.getElementById('result-area');
    if(resultArea) { resultArea.innerHTML = ''; }
    
    const specAction = document.getElementById('special-action-container');
    if(specAction) { specAction.innerHTML = ''; specAction.classList.add('hidden'); }
    
    setSkeletonState(false);
    showError('');
    fetchedVideos = [];
    currentSortType = 'latest'; 
}

function generateFileName(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

function typeWriter(element, text, speed=25) {
    element.innerHTML = '';
    element.classList.add('typewriter-cursor');
    let i = 0;
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            element.classList.remove('typewriter-cursor');
        }
    }
    type();
}

// LOGIC SẮP XẾP LƯỚI
function sortVideos(type) {
    if(!fetchedVideos || fetchedVideos.length === 0) return;
    currentSortType = type;
    
    if (type === 'popular') {
        fetchedVideos.sort((a, b) => b.data.stats.play - a.data.stats.play);
    } else {
        fetchedVideos.sort((a, b) => {
            let tA = a.data.video_data.create_time || 0;
            let tB = b.data.video_data.create_time || 0;
            return tB - tA;
        });
    }
    renderVideoCards(fetchedVideos);
}

// ================= CÁC API CALLS TỰ ĐỘNG GOM SẠCH DỮ LIỆU =================
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    
    clearResults();
    setSkeletonState(true, false, "Đang cào dữ liệu tệp tĩnh...");

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        results = results.filter(r => r.data && r.data.status === "Live");
        
        fetchedVideos = results.map(r => {
            r.data.stats.play = parseRawStats(r.data.stats.play);
            r.data.stats.like = parseRawStats(r.data.stats.like);
            r.data.stats.comment = parseRawStats(r.data.stats.comment);
            r.data.stats.share = parseRawStats(r.data.stats.share);
            return r;
        });

        if(fetchedVideos.length === 0) throw new Error("Video bị riêng tư hoặc sai link.");
        setSkeletonState(false);
        sortVideos(currentSortType);
    } catch (error) { setSkeletonState(false); showError(error.message); } 
}

async function searchTikTok() {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw) return showError("Nhập từ khóa vô!");

    clearResults();
    setSkeletonState(true, false, "Đang vét mảng dữ liệu tìm kiếm...");

    try {
        let hasMore = true;
        let searchCursor = 0;
        let loops = 0;
        
        while(hasMore && loops < 5) {
            const response = await fetch(`/api/search?keywords=${encodeURIComponent(kw)}&cursor=${searchCursor}&count=30`);
            const resData = await response.json();
            if (resData.code !== 0 || !resData.data?.videos?.length) break;
            
            const videos = resData.data.videos;
            searchCursor = resData.data.cursor;
            hasMore = resData.data.hasMore;
            
            let formattedResults = formatTikWmToGrid(videos);
            fetchedVideos.push(...formattedResults);
            loops++;
            document.getElementById('loading-text').innerText = `Đang quét từ khóa... Đã bóc được ${fetchedVideos.length} bài.`;
        }
        
        if(fetchedVideos.length === 0) throw new Error("Không tìm thấy kết quả nào.");
        setSkeletonState(false);
        sortVideos(currentSortType);
    } catch (error) { setSkeletonState(false); showError(error.message); } 
}

async function fetchUserInfo() {
    let user = document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID vô mới quét được!");

    clearResults();
    setSkeletonState(true, true, "Đang khởi tạo bản đồ kết nối kênh...");

    try {
        let hasMore = true;
        let cur = 0;
        let isFirstPage = true;

        while(hasMore) {
            const response = await fetch(`/api/index?username=${user}&cursor=${cur}`);
            const data = await response.json();
            if (data.status !== "Live") throw new Error(data.error || "Kênh không tồn tại.");

            if (isFirstPage) {
                const u = data.author;
                const s = data.stats_formatted || {};
                
                const container = document.getElementById('user-info-area');
                container.innerHTML = `
                    <div class="w-full bento-card p-6 md:p-8 animate-slide-up">
                        <div class="text-center">
                            <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-[#222] bg-[#0a0a0a]" referrerpolicy="no-referrer">
                            <h2 class="text-xl font-bold mt-4 text-white flex items-center justify-center gap-1">
                                ${u.nickname || u.uniqueId} 
                                ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>' : ''}
                            </h2>
                            <p class="text-zinc-500 font-medium text-xs mt-1">@${u.uniqueId}</p>
                            <p id="channel-bio-text" class="mt-4 text-zinc-400 text-sm max-w-xl mx-auto min-h-[40px]"></p>
                            ${u.bioLink ? `
                                <div class="inline-flex w-full mb-4">
                                    <a href="${u.bioLink}" target="_blank" class="flex w-full max-w-sm mx-auto items-center justify-center gap-2 text-blue-400 text-xs font-bold bg-[#0d0d0d] border border-blue-500/30 px-3.5 py-3 rounded-xl hover:border-blue-500 hover:bg-[#111] transition shadow-md">
                                        <i class="fa-solid fa-link text-zinc-500 shrink-0"></i>
                                        <span class="truncate whitespace-nowrap">${u.bioLink}</span>
                                    </a>
                                </div>
                            ` : ''}
                            
                            <div class="grid grid-cols-3 gap-3 mt-4 pt-6 border-t border-[#222]">
                                <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.following || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Đang FL</span></div>
                                <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.follower || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Follower</span></div>
                                <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.heart || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Thích</span></div>
                            </div>
                        </div>
                    </div>
                `;
                container.classList.remove('hidden');
                setTimeout(() => { typeWriter(document.getElementById('channel-bio-text'), u.signature || 'Chưa có tiểu sử.', 25); }, 100);
                isFirstPage = false;
            }

            if (data.videos && data.videos.length > 0) {
                fetchedVideos.push(...formatTikWmToGrid(data.videos));
            }
            cur = data.cursor;
            hasMore = data.hasMore;
            document.getElementById('loading-text').innerText = `Quét ngầm: Lấy được ${fetchedVideos.length} bài đăng...`;
        }
        setSkeletonState(false);
        sortVideos(currentSortType);
    } catch (error) { setSkeletonState(false); showError(error.message); } 
}

// PHÂN TÍCH KÊNH 100% (VÉT TOÀN BỘ, TRẢ LẠI GIAO DIỆN NGÀY TẠO KÊNH)
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    clearResults();
    currentMode = 'analytics';
    setSkeletonState(true, true, "Đang khởi chạy luồng quét 100%...");

    try {
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let videosInCurrentSecond = 0;

        // Bỏ limitPages, quét bằng hết thì thôi
        while(hasMore) {
            const response = await fetch(`/api/index?username=${user}&cursor=${cur}`);
            const data = await response.json();
            if (data.status !== "Live") break;
            
            if(!pAuthor && data.author) pAuthor = data.author;
            if(data.videos) {
                allVideos.push(...data.videos);
                videosInCurrentSecond += data.videos.length;
            }
            
            cur = data.cursor;
            hasMore = data.hasMore;
            
            document.getElementById('loading-text').innerText = `XUNG NHỊP QUÉT: ĐÃ THU GOM ${allVideos.length} BÀI ĐĂNG`;
            
            // Ép delay 1s mỗi 200 bài để bảo vệ server
            if (videosInCurrentSecond >= 200) {
                await new Promise(r => setTimeout(r, 1000));
                videosInCurrentSecond = 0;
            }
        }

        if (allVideos.length === 0) throw new Error("Kênh trống hoặc bị riêng tư.");

        let totalPlays = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        let hashtagCounts = {};

        allVideos.forEach(v => {
            totalPlays += parseRawStats(v.stats.play);
            totalLikes += parseRawStats(v.stats.like);
            totalComments += parseRawStats(v.stats.comment);
            totalShares += parseRawStats(v.stats.share);

            let tags = (v.caption || "").match(/#[\w_À-ỹ]+/g);
            if(tags) tags.forEach(t => { let ct = t.toLowerCase(); hashtagCounts[ct] = (hashtagCounts[ct] || 0) + 1; });
        });

        // Xếp theo thời gian để tính ngày lập kênh
        allVideos.sort((a,b) => (b.createTime||0) - (a.createTime||0));
        let newestVid = allVideos[0];
        let oldestVid = allVideos[allVideos.length - 1];
        let createDate = oldestVid && oldestVid.createTime ? new Date(oldestVid.createTime * 1000).toLocaleDateString('vi-VN') : 'Không rõ';

        const avgViews = (totalPlays / allVideos.length);
        const er = totalPlays > 0 ? (((totalLikes + totalComments + totalShares) / totalPlays) * 100).toFixed(2) : 0;
        
        let sortedTags = Object.entries(hashtagCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        let tagsHtml = sortedTags.length > 0 
            ? sortedTags.map(t => `<span class="bg-[#0d0d0d] border border-[#222] text-cyan-400 px-3 py-1.5 rounded-xl text-xs font-bold">${t[0]} <span class="text-zinc-600 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-zinc-600 text-sm italic">Không dùng Hashtag</span>';

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full bento-card p-6 md:p-8 animate-slide-up relative">
                <div class="flex items-center gap-4 mb-8 pb-6 border-b border-[#222]">
                    <img src="${pAuthor?.avatar}" class="w-16 h-16 rounded-full object-cover border border-[#333] bg-black" referrerpolicy="no-referrer">
                    <div>
                        <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">${pAuthor?.nickname || user}</h2>
                        <p class="text-cyan-400 font-medium text-sm">Báo cáo Phân tích từ 100% (${allVideos.length}) bài đăng</p>
                    </div>
                </div>

                <div class="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-[20px] border border-[#222] mb-6">
                    <div class="text-center flex-1 border-r border-[#222]">
                        <span class="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Ngày Lập Kênh</span>
                        <span class="font-black text-white text-sm md:text-base">${createDate}</span>
                    </div>
                    <div class="text-center flex-1 border-r border-[#222]">
                        <span class="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Video Mới Nhất</span>
                        <a href="${newestVid.link}" target="_blank" class="font-bold text-cyan-400 text-xs md:text-sm hover:text-white transition"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem</a>
                    </div>
                    <div class="text-center flex-1">
                        <span class="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Video Đầu Tiên</span>
                        <a href="${oldestVid.link}" target="_blank" class="font-bold text-cyan-400 text-xs md:text-sm hover:text-white transition"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem</a>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-fire text-orange-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${formatStatsClient(avgViews)}</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">View TB Toàn Kênh</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-percent text-cyan-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${er}%</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Tỷ lệ ER Thực Tế</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-heart text-violet-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${formatStatsClient(totalLikes / allVideos.length)}</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Tim TB Toàn Kênh</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-play text-emerald-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${formatStatsClient(totalPlays)}</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Tổng View Đã Quét</span>
                    </div>
                </div>
                
                <div class="mb-2">
                    <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><i class="fa-solid fa-hashtag text-cyan-400"></i> Top Hashtag</h4>
                    <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                </div>
            </div>
            <h3 class="text-center text-sm font-bold text-zinc-400 mt-10 mb-2 uppercase tracking-[0.2em]">CÁC BÀI ĐĂNG VIRAL NHẤT</h3>
        `;
        container.classList.remove('hidden');

        // Phân tích giữ nguyên thẻ video và lưới. Đẩy top 50 video viral ra lưới để bấm xem
        fetchedVideos = formatTikWmToGrid(allVideos);
        setSkeletonState(false);
        sortVideos('popular'); 
    } catch (error) { setSkeletonState(false); showError(error.message); } 
}

function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar||v.cover, verified: v.author.is_verify||false },
            video_data: { id: v.video_id, description: v.title, create_time: v.create_time, duration: v.duration||0, region: v.region||'VN' }, 
            stats: { play: parseRawStats(v.play_count), like: parseRawStats(v.digg_count), comment: parseRawStats(v.comment_count), share: parseRawStats(v.share_count), download: parseRawStats(v.download_count||0) },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title||"Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// ================= RENDER LƯỚI VIDEO (CÓ NÚT SẮP XẾP) =================
function renderVideoCards(results) {
    const container = document.getElementById('result-area');
    const specialAction = document.getElementById('special-action-container');
    
    if(specialAction) {
        if (fetchedVideos.length > 1 && currentMode !== 'video') {
            specialAction.innerHTML = `
                <div class="flex items-center gap-1 bg-[#111] border border-[#222] p-1.5 rounded-xl">
                    <button onclick="sortVideos('latest')" class="px-4 py-2 rounded-lg ${currentSortType === 'latest' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition"><i class="fa-solid fa-bars"></i> Mới Nhất</button>
                    <button onclick="sortVideos('popular')" class="px-4 py-2 rounded-lg ${currentSortType === 'popular' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition"><i class="fa-solid fa-fire"></i> Phổ Biến</button>
                </div>
            `;
            specialAction.classList.remove('hidden');
            specialAction.classList.add('flex');
        } else if (currentMode === 'video' && linkMode === 'multi' && fetchedVideos.length > 1) {
            specialAction.innerHTML = `
                <button onclick="downloadAllVideos(this)" class="bg-[#111] text-white font-bold py-2.5 px-5 rounded-lg border border-[#222] shadow-md transition-colors hover:bg-blue-600 flex items-center gap-2 text-sm"><i class="fa-solid fa-download"></i> Tải Tất Cả File</button>
            `;
            specialAction.classList.remove('hidden');
            specialAction.classList.add('flex');
        } else {
            specialAction.classList.add('hidden');
        }
    }

    container.innerHTML = '';
    
    // Nếu ở Analytics mà kênh có 10.000 video, chỉ render Top 50 video để tránh đứng trình duyệt DOM
    const renderLimit = currentMode === 'analytics' ? results.slice(0, 50) : results;

    renderLimit.forEach((item, index) => {
        if (item.error || item.data.status !== "Live") return;
        const d = item.data;
        const mediaTypeBadge = (d.images && d.images.length > 0) 
            ? `<div class="absolute top-2 left-2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
            : '';

        container.insertAdjacentHTML('beforeend', `
            <div class="grid-item w-full animate-slide-up" onclick="openVideoDetail(${index})" style="animation-delay: ${(index % 10) * 0.05}s">
                <img src="${d.urls.cover}" class="thumb absolute inset-0 w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer">
                ${mediaTypeBadge}
                <div class="absolute top-2 right-2 bg-black/80 backdrop-blur border border-zinc-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20 flex items-center gap-1">
                    <i class="fa-solid fa-play text-blue-400"></i> ${formatStatsClient(d.stats.play)}
                </div>
                <div class="absolute inset-0 overlay-gradient z-10 flex flex-col justify-end p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <img src="${d.author.avatar}" class="w-6 h-6 rounded-full object-cover border border-zinc-600 bg-black" loading="lazy" referrerpolicy="no-referrer">
                        <span class="text-white font-semibold text-[11px] truncate">${d.author.nickname}</span>
                    </div>
                    <div class="flex gap-2 text-[9px] font-bold text-zinc-300">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-white"></i> ${formatStatsClient(d.stats.like)}</span>
                    </div>
                </div>
            </div>
        `);
    });
}

// ================= TIKTOK MOBILE PLAYER CHUẨN XÁC 100% =================
function openVideoDetail(index) {
    const item = fetchedVideos[index];
    if (!item) return;
    const d = item.data;
    const isImg = d.images && d.images.length > 0;

    // Cài thông tin lớp Overlay
    document.getElementById('tk-avatar').src = d.author.avatar;
    document.getElementById('tk-username').innerText = `@${d.author.uniqueId}`;
    document.getElementById('tk-caption').innerText = d.video_data.description || '';
    document.getElementById('tk-music').innerText = d.music?.title || 'Âm thanh gốc';
    
    document.getElementById('tk-like').innerText = formatStatsClient(d.stats.like);
    document.getElementById('tk-cmt').innerText = formatStatsClient(d.stats.comment);
    document.getElementById('tk-save').innerText = formatStatsClient(d.stats.download || 0);
    document.getElementById('tk-share').innerText = formatStatsClient(d.stats.share);

    // Cài nút Tải Bottom Bar
    const fnMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fnMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
    
    document.getElementById('tk-lbl-media').innerText = isImg ? "Lưu Bộ Ảnh" : "Lưu Video";
    document.getElementById('tk-btn-dl-media').onclick = function(e) {
        e.stopPropagation();
        if(isImg) downloadImages(index, this);
        else forceDownload(d.urls.no_watermark, fnMp4, this);
    };
    document.getElementById('tk-btn-dl-music').onclick = function(e) {
        e.stopPropagation();
        forceDownload(d.music?.playUrl, fnMp3, this);
    };

    // Chuẩn bị Sheet Phân Tích Kín (Nút 3 Chấm)
    const er = parseRawStats(d.stats.play) > 0 ? (((parseRawStats(d.stats.like) + parseRawStats(d.stats.comment) + parseRawStats(d.stats.share) + parseRawStats(d.stats.download)) / parseRawStats(d.stats.play)) * 100).toFixed(2) : 0;
    const lr = parseRawStats(d.stats.play) > 0 ? ((parseRawStats(d.stats.like) / parseRawStats(d.stats.play)) * 100).toFixed(1) : 0;
    const dateStr = d.video_data.create_time ? new Date(d.video_data.create_time * 1000).toLocaleString('vi-VN') : 'N/A';
    
    document.getElementById('tk-analytics-content').innerHTML = `
        <div class="flex items-center justify-between bg-[#1a1a1a] rounded-xl p-3 border border-[#333]">
            <span class="text-zinc-400 text-xs font-bold">ID Tệp</span><span class="text-white text-xs font-bold">${d.video_data.id}</span>
        </div>
        <div class="flex items-center justify-between bg-[#1a1a1a] rounded-xl p-3 border border-[#333]">
            <span class="text-zinc-400 text-xs font-bold">Ngày Đăng</span><span class="text-white text-xs font-bold">${dateStr}</span>
        </div>
        <div class="flex items-center justify-between bg-[#1a1a1a] rounded-xl p-3 border border-[#333]">
            <span class="text-zinc-400 text-xs font-bold">Tỷ Lệ Tương Tác ER</span><span class="text-cyan-400 text-sm font-black">${er}%</span>
        </div>
        <div class="flex items-center justify-between bg-[#1a1a1a] rounded-xl p-3 border border-[#333]">
            <span class="text-zinc-400 text-xs font-bold">Chuyển Đổi Tim</span><span class="text-pink-400 text-xs font-bold">${lr}%</span>
        </div>
        <div class="flex items-center justify-between bg-[#1a1a1a] rounded-xl p-3 border border-[#333]">
            <span class="text-zinc-400 text-xs font-bold">Khu Vực Phân Phối</span><span class="text-white text-xs font-bold uppercase">${d.video_data.region || 'N/A'}</span>
        </div>
    `;

    // Chuẩn bị Media (Khóa ngàm 1 ảnh cho Slider)
    const zone = document.getElementById('tk-media-zone');
    if(isImg) {
        const slides = d.images.map((img, i) => `
            <div class="tk-slide">
                <img src="${img}" referrerpolicy="no-referrer">
                <span class="absolute top-[80px] right-4 bg-black/60 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-white/10">${i+1}/${d.images.length}</span>
            </div>
        `).join('');
        zone.innerHTML = `
            <div id="tk-img-scroller" class="tk-image-scroller">${slides}</div>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller'); c.scrollBy({left: -c.clientWidth, behavior: 'smooth'})" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller'); c.scrollBy({left: c.clientWidth, behavior: 'smooth'})" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        `;
        document.getElementById('tk-center-pause').classList.remove('show');
    } else {
        // Video Native không có control, chạm để Pause.
        zone.innerHTML = `<video id="tk-video-el" src="${d.urls.no_watermark}" class="w-full h-full object-cover" loop playsinline autoplay></video>`;
        currentVideoPlayer = document.getElementById('tk-video-el');
        
        const playPromise = currentVideoPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(_ => {
                document.getElementById('tk-center-pause').classList.add('show');
            });
        }
    }

    document.getElementById('tk-player-modal').classList.add('active');
}

// Bấm giữa màn hình để Dừng/Phát - Hiện Icon Play chuẩn TikTok
function toggleTkPlayPause() {
    if(!currentVideoPlayer) return; 
    const icon = document.getElementById('tk-center-pause');
    if(currentVideoPlayer.paused) {
        currentVideoPlayer.play();
        icon.classList.remove('show');
    } else {
        currentVideoPlayer.pause();
        icon.classList.add('show');
    }
}

function toggleAnalyticsCard(e) {
    if(e) e.stopPropagation();
    document.getElementById('tk-analytics-sheet').classList.toggle('show');
}

function closeTkPlayer() {
    document.getElementById('tk-player-modal').classList.remove('active');
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    const zone = document.getElementById('tk-media-zone');
    if(currentVideoPlayer) {
        currentVideoPlayer.pause();
        currentVideoPlayer.src = '';
        currentVideoPlayer.load();
        currentVideoPlayer = null;
    }
    document.getElementById('tk-center-pause').classList.remove('show');
    zone.innerHTML = '';
}

// ================= TRÌNH DOWNLOADER HOÀN CHỈNH =================
async function forceDownload(url, filename, btnObj) {
    if (!url) return;
    const origHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btnObj.style.pointerEvents = 'none';

    try {
        const r = await fetch(url);
        const blob = await r.blob();
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename, style: 'display:none' });
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    } catch { window.open(url, '_blank'); }
    
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
    setTimeout(() => { btnObj.innerHTML = origHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}

async function downloadImages(index, btnObj) {
    const d = fetchedVideos[index].data;
    if (!d.images?.length) return;
    const origHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tải ${d.images.length} ảnh...`;
    btnObj.style.pointerEvents = 'none';

    for (let i = 0; i < d.images.length; i++) {
        const fname = `${d.author.uniqueId}_${d.video_data.id}_${i+1}.jpg`;
        try {
            const r = await fetch(d.images[i]);
            const blob = await r.blob();
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fname, style: 'display:none' });
            document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
        } catch { window.open(d.images[i], '_blank'); }
        await new Promise(r => setTimeout(r, 400));
    }
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn tất`;
    setTimeout(() => { btnObj.innerHTML = origHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}

async function downloadAllVideos(btnObj) {
    if (!fetchedVideos || fetchedVideos.length === 0) return;
    const orig = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải hàng loạt...`;
    btnObj.style.pointerEvents = 'none';

    for (let i = 0; i < fetchedVideos.length; i++) {
        const d = fetchedVideos[i].data;
        if (d.images && d.images.length > 0) {
            for (let j=0; j<d.images.length; j++){
                const fname = `${d.author.uniqueId}_${d.video_data.id}_${j+1}.jpg`;
                try {
                    const r = await fetch(d.images[j]);
                    const blob = await r.blob();
                    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'});
                    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
                } catch(e) { window.open(d.images[j], '_blank'); }
                await new Promise(r => setTimeout(r, 380));
            }
        } else {
            const fname = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
            try {
                const r = await fetch(d.urls.no_watermark);
                const blob = await r.blob();
                const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'});
                document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
            } catch(e) { window.open(d.urls.no_watermark, '_blank'); }
        }
        await new Promise(r => setTimeout(r, 800)); 
    }
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
    setTimeout(() => { btnObj.innerHTML = orig; btnObj.style.pointerEvents = 'auto'; }, 3000);
}
