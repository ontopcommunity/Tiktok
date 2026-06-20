let currentMode = 'video';
let linkMode = 'single'; 
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;

function switchTab(mode) {
    currentMode = mode;
    ['video', 'search', 'info', 'shadowban'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        const tabBtn = document.getElementById(`tab-${m}`);
        if(btn && tabBtn) {
            btn.classList.toggle('hidden', m !== mode);
            if(m === mode) {
                tabBtn.className = 'tab-btn tab-active';
            } else {
                tabBtn.className = 'tab-btn tab-inactive';
            }
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

function showLoading(show, text = "Đang xử lý...") {
    const loader = document.getElementById('loading');
    if(loader) {
        document.getElementById('loading-text').innerText = text;
        show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
    }
}

function showError(msg) {
    const errEl = document.getElementById('error-msg');
    if(errEl) {
        if(msg) {
            errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${msg}`;
            errEl.classList.remove('hidden');
        } else {
            errEl.classList.add('hidden');
        }
    }
}

function clearResults() {
    const userInfoArea = document.getElementById('user-info-area');
    if(userInfoArea) { userInfoArea.innerHTML = ''; userInfoArea.classList.add('hidden'); }
    
    const resultArea = document.getElementById('result-area');
    if(resultArea) { resultArea.innerHTML = ''; resultArea.className = "w-full max-w-[98%] xl:max-w-6xl mx-auto mt-6 pb-6"; }
    
    const specAction = document.getElementById('special-action-container');
    if(specAction) { specAction.innerHTML = ''; specAction.classList.add('hidden'); }
    
    const loadMoreBtn = document.getElementById('load-more-container');
    if(loadMoreBtn) loadMoreBtn.classList.add('hidden');
    
    const sbArea = document.getElementById('shadowban-area');
    if(sbArea) { sbArea.innerHTML = ''; sbArea.classList.add('hidden'); }
    
    showError('');
    fetchedVideos = [];
    searchCursor = 0; currentSearchKeyword = "";
    userVideoCursor = 0; currentUserProfile = ""; fullUserData = null;
}

function generateFileName(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

// Xử lý biến toàn cục an toàn
window.formatStatsClient = function(num) {
    num = parseInt(num);
    if (!num && num !== 0) return "0";
    if (num < 1000) return num.toString();
    if (num < 1000000) return (Math.floor(num / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(num / 100000) / 10).toString().replace('.', ',') + "M";
};

window.parseRawStats = function(str) {
    if(!str) return 0;
    if(typeof str === 'number') return str;
    let multi = 1;
    if(str.includes('K')) multi = 1000;
    if(str.includes('M')) multi = 1000000;
    return parseFloat(str.replace(/,/g, '.').replace(/[KM]/g, '')) * multi;
};

window.toggleExpand = function(id) {
    const box = document.getElementById(id);
    if(box) box.classList.toggle('expanded');
}

window.openGuide = function() { 
    const guide = document.getElementById('guide-window');
    if(guide) guide.classList.add('active'); 
}

window.loadMore = function() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
}

// KHÁM KÊNH SHADOWBAN BENTO STYLE
window.checkShadowban = async function() {
    let user = document.getElementById('shadowban-input').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if(!user) return showError("Vui lòng nhập ID kênh để khám!");

    showLoading(true, "Cào dữ liệu vẽ biểu đồ...");
    clearResults();
    const sbArea = document.getElementById('shadowban-area');

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=0`);
        const data = await response.json();
        
        if (data.status !== "Live" || !data.videos || data.videos.length < 5) {
            throw new Error("Kênh không tồn tại hoặc quá ít bài đăng (cần ít nhất 5).");
        }

        const sampleSize = Math.min(data.videos.length, 15);
        const videos = data.videos.slice(0, sampleSize).reverse();
        const viewsArray = videos.map(v => parseRawStats(v.stats.play));
        
        const recentCount = Math.min(5, Math.floor(sampleSize / 2));
        const recentViews = viewsArray.slice(-recentCount);
        const oldViews = viewsArray.slice(0, -recentCount);

        const avgRecent = recentViews.reduce((a,b)=>a+b, 0) / recentViews.length;
        const avgOld = oldViews.length > 0 ? (oldViews.reduce((a,b)=>a+b, 0) / oldViews.length) : avgRecent;
        const maxView = Math.max(...viewsArray) || 1;

        let statusText = "PHONG ĐỘ ỔN ĐỊNH";
        let statusColor = "text-emerald-500";
        let message = "Kênh phân phối hiển thị ổn định, không có dấu hiệu bị bóp tương tác.";

        if (avgRecent < 200 && avgOld > 1000) {
            statusText = "SHADOWBAN NẶNG";
            statusColor = "text-red-500";
            message = "CẢNH BÁO ĐỎ: Lượt xem rớt thê thảm. Khả năng cao kênh đã bị TikTok đánh gậy ẩn do vi phạm.";
        } else if (avgRecent < avgOld * 0.4 && avgOld > 500) {
            statusText = "FLOP / TỤT ĐỀ XUẤT";
            statusColor = "text-orange-500";
            message = "Lượt xem xu hướng giảm mạnh. Rà soát lại chất lượng nội dung ngay.";
        } else if (avgRecent > avgOld * 1.5 && avgRecent > 1000) {
            statusText = "ĐANG LÊN XU HƯỚNG";
            statusColor = "text-blue-500";
            message = "Tuyệt vời! Kênh đang có đà tăng trưởng cực kỳ tốt. Tiếp tục phát huy.";
        }

        let barsHtml = '';
        viewsArray.forEach((view, idx) => {
            const heightPct = Math.max((view / maxView) * 100, 2); 
            const isRecent = idx >= (viewsArray.length - recentCount);
            const barBg = isRecent ? (statusColor.includes('red') ? 'bg-red-500' : (statusColor.includes('orange') ? 'bg-orange-500' : 'bg-blue-500')) : 'bg-[#333]';
            
            barsHtml += `
                <div class="flex flex-col items-center justify-end h-40 group relative w-full mx-1">
                    <div class="absolute -top-7 bg-white text-black text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold whitespace-nowrap z-10">${formatStatsClient(view)}</div>
                    <div class="w-full max-w-[24px] ${barBg} rounded-t transition-all duration-700 ease-out" style="height: ${heightPct}%"></div>
                </div>
            `;
        });

        sbArea.innerHTML = `
            <div class="bento-card p-6 md:p-8 animate-slide-up w-full">
                <div class="text-center mb-6">
                    <h3 class="text-2xl font-black ${statusColor} mb-2 uppercase">${statusText}</h3>
                    <p class="text-zinc-400 text-sm leading-relaxed">${message}</p>
                </div>
                <div class="w-full bg-[#0a0a0a] rounded-2xl p-4 border border-[#222] flex items-end justify-between h-52">
                    ${barsHtml}
                </div>
                <div class="mt-4 flex justify-between items-center text-xs font-bold text-zinc-500">
                    <span class="flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left"></i> Cũ hơn</span>
                    <span class="flex items-center gap-1"><div class="w-2 h-2 rounded bg-blue-500"></div> ${recentCount} Mới nhất</span>
                </div>
            </div>
        `;
        sbArea.classList.remove('hidden');
        sbArea.classList.add('flex');

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}


window.forceDownload = async function(url, filename, btnObj) {
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
        try { await triggerDownload(`https://corsproxy.io/?${encodeURIComponent(url)}`); } 
        catch (e) { window.open(url, '_blank'); }
    } finally {
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
        setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
    }
}

window.downloadImages = async function(index, btnObj) {
    const d = fetchedVideos[index].data;
    if(!d.images) return;
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tải ${d.images.length} ảnh...`;
    btnObj.style.pointerEvents = 'none';

    for (let i = 0; i < d.images.length; i++) {
        const filename = `${d.author.uniqueId}_${d.video_data.id}_img_${i+1}.jpg`;
        try {
            const res = await fetch(d.images[i]);
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none'; a.href = downloadUrl; a.download = filename; 
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(downloadUrl); a.remove();
        } catch(e) {
            window.open(d.images[i], '_blank');
        }
        await new Promise(r => setTimeout(r, 400));
    }
    
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}

window.searchUserFromDetail = function(username) {
    closeDetailWindow('video-detail-window');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// PHÂN TÍCH DẠNG CỘT BENTO STYLE
window.analyzeSingleVideo = function(index) {
    const d = fetchedVideos[index].data;
    const play = parseRawStats(d.stats.play);
    const likes = parseRawStats(d.stats.like);
    const comments = parseRawStats(d.stats.comment);
    const shares = parseRawStats(d.stats.share);
    const downloads = parseRawStats(d.stats.download || 0);
    
    const er = play > 0 ? (((likes + comments + shares + downloads) / play) * 100).toFixed(2) : 0;
    const likeRatio = play > 0 ? ((likes / play) * 100).toFixed(1) : 0;
    
    const timestamp = d.video_data.create_time || d.video_data.createTime || null;
    let uploadDate = "Không xác định";
    if (timestamp) {
        uploadDate = new Date(timestamp * 1000).toLocaleString('vi-VN');
    }

    const logMax = Math.log10(play + 1) || 1;
    const getH = (val) => Math.max((Math.log10(val + 1) / logMax) * 100, 5); 

    const chartHtml = `
        <div class="w-full bg-[#0a0a0a] rounded-[20px] p-5 border border-[#222] flex items-end justify-around h-48 mt-2">
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-7 text-black font-bold text-[10px] bg-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(play)}</span>
                <div class="w-full max-w-[30px] bg-blue-500 rounded-t transition-all duration-700" style="height: ${getH(play)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-2 uppercase">View</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-7 text-black font-bold text-[10px] bg-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(likes)}</span>
                <div class="w-full max-w-[30px] bg-pink-500 rounded-t transition-all duration-700" style="height: ${getH(likes)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-2 uppercase">Tim</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-7 text-black font-bold text-[10px] bg-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(comments)}</span>
                <div class="w-full max-w-[30px] bg-emerald-500 rounded-t transition-all duration-700" style="height: ${getH(comments)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-2 uppercase">Cmt</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-7 text-black font-bold text-[10px] bg-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(shares)}</span>
                <div class="w-full max-w-[30px] bg-orange-500 rounded-t transition-all duration-700" style="height: ${getH(shares)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-2 uppercase">Share</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-7 text-black font-bold text-[10px] bg-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(downloads)}</span>
                <div class="w-full max-w-[30px] bg-zinc-600 rounded-t transition-all duration-700" style="height: ${getH(downloads)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-2 uppercase">Save</span>
            </div>
        </div>
    `;

    const infoBox = document.getElementById('detail-video-info');
    const oldHtml = infoBox.innerHTML;
    const oldActions = document.getElementById('detail-video-actions').innerHTML;

    infoBox.innerHTML = `
        <button onclick="restoreVideoDetail()" class="mb-4 text-zinc-400 font-bold flex items-center gap-2 hover:text-white transition text-sm">
            <i class="fa-solid fa-arrow-left"></i> Quay lại
        </button>
        <h3 class="text-xl font-bold text-white mb-2">Thống Kê Chi Tiết</h3>
        
        ${chartHtml}
        
        <div class="grid grid-cols-2 gap-3 mt-4">
            <div class="bg-[#111] p-4 rounded-[20px] border border-[#222] flex flex-col justify-center items-center">
                <span class="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mb-1">Tỷ lệ ER</span>
                <span class="text-white font-black text-xl">${er}%</span>
            </div>
            <div class="bg-[#111] p-4 rounded-[20px] border border-[#222] flex flex-col justify-center items-center">
                <span class="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mb-1">Chuyển đổi Like</span>
                <span class="text-white font-black text-xl">${likeRatio}%</span>
            </div>
            <div class="col-span-2 bg-[#111] p-3 px-4 rounded-[16px] border border-[#222] flex justify-between items-center">
                <span class="text-zinc-500 font-bold text-xs uppercase tracking-widest">Giờ Đăng:</span>
                <span class="text-zinc-300 font-medium text-xs">${uploadDate}</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = `
        <button onclick="restoreVideoDetail()" class="w-full col-span-2 bento-btn-secondary py-3 text-sm">
            Đóng Biểu Đồ
        </button>
    `;

    window.restoreVideoDetail = function() {
        infoBox.innerHTML = oldHtml;
        document.getElementById('detail-video-actions').innerHTML = oldActions;
    }
}

window.openVideoDetail = function(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
    const isImagePost = d.images && d.images.length > 0;

    let mediaHtml = '';
    if (isImagePost) {
        let slides = d.images.map((img, i) => `
            <div class="w-full h-full flex-shrink-0 snap-center flex items-center justify-center relative">
                <img src="${img}" class="max-w-full max-h-full object-contain" referrerpolicy="no-referrer">
                <span class="absolute bottom-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-lg">${i + 1} / ${d.images.length}</span>
            </div>
        `).join('');

        mediaHtml = `
            <div class="relative w-full h-full flex overflow-hidden group bg-[#0a0a0a]">
                <div class="w-full h-full flex overflow-x-auto snap-x snap-mandatory custom-scroll-x relative z-10 scroll-smooth" id="album-scroll-container">
                    ${slides}
                </div>
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: -300, behavior: 'smooth'})" class="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white border border-[#333] text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: 300, behavior: 'smooth'})" class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white border border-[#333] text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                <div class="absolute top-4 left-4 bg-[#111]/90 text-white font-bold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[#222] z-20">
                    <i class="fa-regular fa-images"></i> Nhật Ký Ảnh
                </div>
            </div>
        `;
    } else {
        mediaHtml = `
            <video controls playsinline autoplay class="w-full h-full object-contain max-h-[100%] bg-[#0a0a0a]" poster="${d.urls.cover}">
                <source src="${d.urls.no_watermark}" type="video/mp4">
            </video>
        `;
    }
    
    document.getElementById('detail-video-container').innerHTML = mediaHtml;

    const safeDesc = (d.video_data.description || 'Không có văn bản mô tả.').replace(/'/g, "\\'");
    
    document.getElementById('detail-video-info').innerHTML = `
        <div class="flex items-center gap-4 p-4 bg-[#111] rounded-[24px] border border-[#222] mb-5 cursor-pointer hover:border-blue-500 transition" onclick="searchUserFromDetail('${d.author.uniqueId}')">
            <img src="${d.author.avatar}" class="w-12 h-12 rounded-full object-cover border border-[#333] bg-black" loading="lazy" referrerpolicy="no-referrer">
            <div class="flex-1 truncate">
                <h3 class="font-bold text-white text-sm truncate flex items-center gap-1">
                    ${d.author.nickname} ${d.author.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-[12px]"></i>' : ''}
                </h3>
                <p class="text-zinc-500 font-medium text-xs mt-0.5 truncate">@${d.author.uniqueId}</p>
            </div>
            <i class="fa-solid fa-arrow-right text-zinc-600"></i>
        </div>

        <div class="flex items-center gap-3 bg-[#0a0a0a] p-3 rounded-2xl border border-[#222] mb-5">
            <div class="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center border border-[#333]">
                <i class="fa-solid fa-music text-blue-500 text-[10px]"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-zinc-200 text-xs font-bold truncate">${d.music.title}</p>
            </div>
        </div>
        
        <div class="relative bg-[#0a0a0a] p-4 rounded-[20px] border border-[#222] mb-6">
            <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Mô tả</h4>
            <p class="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">${safeDesc}</p>
        </div>
        
        <div class="flex justify-between items-center mb-3">
            <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Tương tác</h4>
            <button onclick="analyzeSingleVideo(${index})" class="text-[10px] bg-[#111] text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-lg font-bold transition border border-[#222]">
                <i class="fa-solid fa-chart-column"></i> Cột Phân Tích
            </button>
        </div>

        <div class="grid grid-cols-4 gap-2 mb-6">
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${formatStatsClient(d.stats.play)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">View</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${formatStatsClient(d.stats.like)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Tim</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${formatStatsClient(d.stats.comment)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Cmt</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${formatStatsClient(d.stats.share)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Share</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = isImagePost ? `
        <button onclick="downloadImages(${index}, this)" class="w-full col-span-2 bento-btn py-3.5 text-sm flex justify-center items-center gap-2">
            <i class="fa-solid fa-images"></i> Tải Toàn Bộ Ảnh Về
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bento-btn-secondary py-3 text-sm flex justify-center items-center gap-2 mt-1">
            <i class="fa-solid fa-music"></i> Tải Nhạc MP3
        </button>
    ` : `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full col-span-2 bento-btn py-3.5 text-sm flex justify-center items-center gap-2">
            <i class="fa-solid fa-download"></i> Tải Video MP4 Gốc
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bento-btn-secondary py-3 text-sm flex justify-center items-center gap-2 mt-1">
            <i class="fa-solid fa-music"></i> Tải Nhạc MP3
        </button>
    `;

    const w = document.getElementById('video-detail-window');
    if(w) w.classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.closeDetailWindow = function(windowId) {
    const w = document.getElementById(windowId);
    if(w) w.classList.remove('active');
    document.body.style.overflow = '';
    if(windowId === 'video-detail-window') {
        const videoEl = document.querySelector('#detail-video-container video');
        if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); }
        const c = document.getElementById('detail-video-container');
        if(c) c.innerHTML = ''; 
    }
}

function formatTikWmToGrid(videosArray) {
    return videosArray.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: "Live",
            author: { 
                uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar || v.cover, verified: v.author.is_verify || v.author.verified || false
            },
            video_data: { id: v.video_id, description: v.title, create_time: v.create_time, duration: v.duration || 0, region: v.region || 'VN' }, 
            stats: { play: formatStatsClient(v.play_count), like: formatStatsClient(v.digg_count), comment: formatStatsClient(v.comment_count), share: formatStatsClient(v.share_count), download: v.download_count || 0 },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// BENTO CALLS
window.processVideos = async function() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    if (linkMode === 'single' && links.length > 1) return showError("Đang ở chế độ 1 Bài Đăng. Hãy chuyển sang Tab 'Nhiều Bài Đăng'!");

    const fetchBtn = document.getElementById('fetch-video-btn');
    clearResults();
    showLoading(true, "Truy xuất dữ liệu tĩnh...");
    if(fetchBtn) fetchBtn.disabled = true;

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        results = results.filter(r => r.data && r.data.status === "Live");
        
        fetchedVideos = results;
        renderVideoCards(fetchedVideos, false, 0);
    } catch (error) { showError("Lỗi: " + error.message); } 
    finally { showLoading(false); if(fetchBtn) fetchBtn.disabled = false; }
}

window.searchTikTok = async function(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return showError("Nhập từ khóa vô!");

    const searchBtn = document.getElementById('fetch-search-btn');

    if (!isLoadMore) {
        clearResults();
        currentSearchKeyword = kw; searchCursor = 0;
        if(searchBtn) searchBtn.disabled = true;
        showLoading(true, "Quét kho dữ liệu tìm kiếm...");
    } else {
        const loadBtn = document.getElementById('load-more-btn');
        if(loadBtn) {
            loadBtn.disabled = true;
            loadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
        }
    }

    try {
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=20`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data?.videos?.length) {
            throw new Error("Không tìm thấy kết quả. Thử từ khóa khác.");
        }

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
        if(searchBtn) searchBtn.disabled = false;
    }
}

window.fetchUserInfo = async function(isLoadMore = false) {
    let user = isLoadMore ? currentUserProfile : document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID vô mới quét được!");

    const infoBtn = document.getElementById('fetch-info-btn');

    if (!isLoadMore) {
        clearResults();
        currentUserProfile = user;
        if(infoBtn) infoBtn.disabled = true;
        showLoading(true, "Lập bản đồ kênh...");
    } else {
        const loadBtn = document.getElementById('load-more-btn');
        if(loadBtn) {
            loadBtn.disabled = true;
            loadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
        }
    }

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=${userVideoCursor}`);
        const data = await response.json();
        if (data.status !== "Live") throw new Error(data.error || "Mục tiêu không tồn tại.");

        if (!isLoadMore) {
            if(data.author) fullUserData = data; 
            else fullUserData = { author: { uniqueId: user, nickname: user, avatar: "", verified: false }, stats_formatted: {} };
            
            const container = document.getElementById('user-info-area');
            const u = fullUserData.author;
            const s = fullUserData.stats_formatted || {};
            
            container.innerHTML = `
                <div class="w-full bento-card p-6 md:p-8 relative shadow-xl animate-fade-up">
                    <div id="channel-profile-box" class="collapsible-box expanded text-center relative">
                        <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-[#222] bg-[#0a0a0a]" loading="lazy" referrerpolicy="no-referrer">
                        <h2 class="text-xl font-bold mt-4 text-white flex items-center justify-center gap-1">
                            ${u.nickname || u.uniqueId} 
                            ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>' : ''}
                        </h2>
                        <p class="text-zinc-500 font-medium text-xs mt-1">@${u.uniqueId}</p>
                        
                        <p class="mt-4 text-zinc-400 text-sm leading-relaxed max-w-xl mx-auto">${u.signature || 'Chưa có tiểu sử.'}</p>
                        
                        <div class="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#222]">
                            <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.following || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Đang FL</span></div>
                            <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.follower || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Follower</span></div>
                            <div class="bg-[#0a0a0a] p-3 rounded-2xl border border-[#262626] flex flex-col"><span class="text-lg font-black text-white">${s.heart || '0'}</span><span class="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">Thích</span></div>
                        </div>
                    </div>
                    <button class="expand-btn w-8 h-8 bg-[#1a1a1a] border border-[#333] rounded-full text-zinc-400 flex items-center justify-center hover:bg-white hover:text-black transition" onclick="toggleExpand('channel-profile-box')">
                        <i class="fa-solid fa-chevron-down text-xs"></i>
                    </button>
                </div>
            `;
            if(container) container.classList.remove('hidden');
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = data.videos.map(v => ({
                link: v.link,
                data: {
                    status: "Live",
                    author: { uniqueId: user, nickname: fullUserData.author.nickname || user, avatar: fullUserData.author.avatar || "", verified: fullUserData.author.verified || false },
                    video_data: { id: v.id, description: v.caption, create_time: v.createTime || null },
                    stats: v.stats, urls: v.urls, music: v.music, images: v.images || null
                }
            }));
            const startIndex = fetchedVideos.length;
            fetchedVideos.push(...formattedResults);
            renderVideoCards(formattedResults, isLoadMore, startIndex);
        }

        userVideoCursor = data.cursor;
        window.checkLoadMoreUI(data.hasMore);
    } catch (error) { if (!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { showLoading(false); if(infoBtn) infoBtn.disabled = false; }
}

window.checkLoadMoreUI = function(hasMore) {
    const loadMoreContainer = document.getElementById('load-more-container');
    if (hasMore) {
        if(loadMoreContainer) loadMoreContainer.classList.remove('hidden');
        const loadBtn = document.getElementById('load-more-btn');
        if(loadBtn) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = `Tải Thêm Dữ Liệu <i class="fa-solid fa-arrow-down ml-1"></i>`;
        }
    } else {
        if(loadMoreContainer) loadMoreContainer.classList.add('hidden');
    }
}

function renderVideoCards(results, append = false, startIndex = 0) {
    requestAnimationFrame(() => {
        const container = document.getElementById('result-area');
        let html = '';

        if (!append) {
            container.innerHTML = '';
            if (fetchedVideos.length === 1) container.className = "w-full max-w-[340px] mx-auto z-10 mt-6 pb-8";
            else container.className = "w-full max-w-[98%] xl:max-w-6xl mx-auto z-10 mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 pb-8";
        }

        results.forEach((item, index) => {
            if (item.error || item.data.status !== "Live") return;
            const d = item.data;
            const currentIndex = startIndex + index; 
            
            const mediaTypeBadge = (d.images && d.images.length > 0) 
                ? `<div class="absolute top-2 left-2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
                : '';

            html += `
                <div class="grid-item animate-fade-up w-full aspect-[3/4]" onclick="openVideoDetail(${currentIndex})" style="animation-delay: ${(index % 20) * 0.02}s">
                    <img src="${d.urls.cover}" class="thumb absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                    ${mediaTypeBadge}
                    
                    <div class="absolute top-2 right-2 bg-black/80 backdrop-blur border border-zinc-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20 flex items-center gap-1">
                        <i class="fa-solid fa-play text-blue-400"></i> ${formatStatsClient(d.stats.play)}
                    </div>

                    <div class="absolute inset-0 overlay-gradient z-10 flex flex-col justify-end p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <img src="${d.author.avatar}" class="w-6 h-6 rounded-full object-cover border border-zinc-600 bg-black" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                            <span class="text-white font-semibold text-[11px] truncate shadow-sm">${d.author.nickname}</span>
                        </div>
                        <div class="flex gap-2 text-[9px] font-bold text-zinc-300">
                            <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-white"></i> ${formatStatsClient(d.stats.like)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        if (append) container.insertAdjacentHTML('beforeend', html);
        else container.innerHTML = html;
    });
}
