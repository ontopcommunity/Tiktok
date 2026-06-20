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
    ['video', 'search', 'info', 'analytics', 'shadowban'].forEach(m => {
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

function setLinkMode(mode) {
    linkMode = mode;
    const btnSingle = document.getElementById('subtab-single');
    const btnMulti = document.getElementById('subtab-multi');
    const textArea = document.getElementById('tiktok-links');

    if(mode === 'single') {
        btnSingle.className = "px-5 py-2 rounded-lg bg-slate-700 text-white font-bold text-sm shadow-sm transition";
        btnMulti.className = "px-5 py-2 rounded-lg text-slate-400 font-bold text-sm hover:text-white transition";
        textArea.rows = 1;
        textArea.placeholder = "Dán link Video hoặc Nhật ký (Story) TikTok vào đây...";
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
    
    const sbArea = document.getElementById('shadowban-area');
    if(sbArea) {
        sbArea.innerHTML = '';
        sbArea.classList.add('hidden');
    }
    
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

function parseRawStats(str) {
    if(!str) return 0;
    if(typeof str === 'number') return str;
    let multi = 1;
    if(str.includes('K')) multi = 1000;
    if(str.includes('M')) multi = 1000000;
    return parseFloat(str.replace(/,/g, '.').replace(/[KM]/g, '')) * multi;
}

window.toggleExpand = function(id) {
    const box = document.getElementById(id);
    box.classList.toggle('expanded');
}

function openGuide() { document.getElementById('guide-window').classList.add('active'); }

function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
}

// ================= TÍNH NĂNG ĐƯỢC PHỤC HỒI: PHÂN TÍCH KÊNH =================
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    const analyticsBtn = document.getElementById('fetch-analytics-btn');

    clearResults();
    currentMode = 'analytics';
    if(analyticsBtn) analyticsBtn.disabled = true;
    showLoading(true, "Đang quét 100% video của kênh (Có thể hơi lâu)... Đã quét 0 video");

    try {
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let limitPages = 0; 
        
        while(hasMore && limitPages < 100) {
            const response = await fetch(`/api/index?username=${user}&cursor=${cur}`);
            const data = await response.json();
            if (data.status !== "Live") break;
            
            if(!pAuthor && data.author) pAuthor = data.author;
            if(data.videos) allVideos.push(...data.videos);
            
            cur = data.cursor;
            hasMore = data.hasMore;
            limitPages++;
            document.getElementById('loading-text').innerText = `Đang quét sâu 100% kênh... Đã gom ${allVideos.length} bài đăng`;
        }

        if (allVideos.length === 0) throw new Error("Kênh này chưa có bài đăng nào hoặc bị riêng tư.");

        let totalPlays = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        let hashtagCounts = {};

        let newestVid = allVideos[0];
        let oldestVid = allVideos[allVideos.length - 1];

        allVideos.forEach(v => {
            totalPlays += parseRawStats(v.stats.play);
            totalLikes += parseRawStats(v.stats.like);
            totalComments += parseRawStats(v.stats.comment);
            totalShares += parseRawStats(v.stats.share);

            let tags = (v.caption || "").match(/#[\w_À-ỹ]+/g);
            if(tags) tags.forEach(t => { let ct = t.toLowerCase(); hashtagCounts[ct] = (hashtagCounts[ct] || 0) + 1; });
        });

        const videoCount = allVideos.length;
        const avgViews = (totalPlays / videoCount);
        const er = totalPlays > 0 ? ((totalLikes + totalComments + totalShares) / totalPlays * 100).toFixed(2) : 0;
        
        let sortedTags = Object.entries(hashtagCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        let tagsHtml = sortedTags.length > 0 
            ? sortedTags.map(t => `<span class="bg-sky-500/10 border border-sky-500/30 text-sky-400 px-3 py-1 rounded-full text-xs font-bold">${t[0]} <span class="opacity-60 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-slate-500 text-sm italic">Không dùng Hashtag</span>';

        const createDate = pAuthor?.createTime ? new Date(pAuthor.createTime * 1000).toLocaleDateString('vi-VN') : 'Không rõ';

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full glass-panel rounded-[2rem] border border-white/10 shadow-2xl animate-fade-up relative">
                <div id="analytics-profile-box" class="collapsible-box expanded p-8 md:p-10 relative">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-sky-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    
                    <div class="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                        <img src="${pAuthor?.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)] bg-slate-800" referrerpolicy="no-referrer">
                        <div>
                            <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">
                                ${pAuthor?.nickname || user}
                                ${pAuthor?.verified ? '<i class="fa-solid fa-circle-check text-blue-500 drop-shadow-md" title="Tài khoản chính chủ"></i>' : ''}
                            </h2>
                            <p class="text-sky-400 font-medium text-sm">Báo cáo Phân tích dựa trên ${videoCount} bài đăng đã quét</p>
                        </div>
                    </div>

                    <div class="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-white/5 mb-6">
                        <div class="text-center flex-1 border-r border-white/10">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Ngày Lập Kênh</span>
                            <span class="font-black text-white text-base">${createDate}</span>
                        </div>
                        <div class="text-center flex-1 border-r border-white/10">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Bài Đăng Mới Nhất</span>
                            <a href="${newestVid.link}" target="_blank" class="font-bold text-sky-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem Bài</a>
                        </div>
                        <div class="text-center flex-1">
                            <span class="block text-xs text-slate-400 uppercase font-bold mb-1">Bài Đăng Cũ Nhất</span>
                            <a href="${oldestVid.link}" target="_blank" class="font-bold text-sky-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem Bài</a>
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
            
            <h3 class="text-center text-xl font-bold text-white mt-12 mb-2 flex items-center justify-center gap-2 animate-fade-up"><i class="fa-solid fa-crown text-yellow-400"></i> TOP 6 BÀI ĐĂNG VIRAL NHẤT</h3>
        `;
        if(container) container.classList.remove('hidden');

        let formattedResults = allVideos.map(v => ({
            link: v.link,
            data: {
                status: "Live",
                author: { uniqueId: user, nickname: pAuthor?.nickname || user, avatar: pAuthor?.avatar || "", verified: pAuthor?.verified || false },
                video_data: { id: v.id, description: v.caption, create_time: v.createTime || null },
                stats: v.stats, urls: v.urls, music: v.music, images: v.images || null,
                rawPlay: parseRawStats(v.stats.play)
            }
        }));

        formattedResults.sort((a, b) => b.data.rawPlay - a.data.rawPlay);
        fetchedVideos = formattedResults.slice(0, 6); 
        renderVideoCards(fetchedVideos, false, 0);

    } catch (error) { showError(error.message); } 
    finally { showLoading(false); if(analyticsBtn) analyticsBtn.disabled = false; }
}

// KHÁM KÊNH SHADOWBAN 
window.checkShadowban = async function() {
    let user = document.getElementById('shadowban-input').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if(!user) return showError("Vui lòng nhập ID kênh để khám!");

    showLoading(true, "Đang cào dữ liệu lịch sử kênh để vẽ biểu đồ...");
    clearResults();
    const sbArea = document.getElementById('shadowban-area');

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=0`);
        const data = await response.json();
        
        if (data.status !== "Live" || !data.videos || data.videos.length < 5) {
            throw new Error("Không thể phân tích. Kênh không tồn tại hoặc có quá ít bài đăng (cần ít nhất 5 bài).");
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

        let statusText = "PHONG ĐỘ BÌNH THƯỜNG";
        let statusColor = "text-emerald-400";
        let bgGlow = "shadow-[0_0_30px_rgba(16,185,129,0.2)] border-emerald-500/30";
        let message = "Kênh đang phân phối hiển thị ổn định, không có dấu hiệu bị bóp tương tác. Hãy tiếp tục duy trì!";

        if (avgRecent < 200 && avgOld > 1000) {
            statusText = "SHADOWBAN NẶNG (BÓP VIEW)";
            statusColor = "text-red-500";
            bgGlow = "shadow-[0_0_30px_rgba(239,68,68,0.2)] border-red-500/30";
            message = "CẢNH BÁO ĐỎ: Lượt xem các bài gần đây rớt thê thảm xuống đáy. Khả năng rất cao kênh đã bị TikTok đánh gậy ẩn (Shadowban) do vi phạm chính sách hoặc reup.";
        } else if (avgRecent < avgOld * 0.4 && avgOld > 500) {
            statusText = "FLOP / TỤT ĐỀ XUẤT";
            statusColor = "text-orange-400";
            bgGlow = "shadow-[0_0_30px_rgba(249,115,22,0.2)] border-orange-500/30";
            message = "Lượt xem đang có xu hướng giảm mạnh so với thời gian trước. Hãy rà soát lại chất lượng nội dung hoặc tần suất đăng bài.";
        } else if (avgRecent > avgOld * 1.5 && avgRecent > 1000) {
            statusText = "ĐANG LÊN XU HƯỚNG";
            statusColor = "text-blue-400";
            bgGlow = "shadow-[0_0_30px_rgba(96,165,250,0.2)] border-blue-500/30";
            message = "Tuyệt vời! Kênh đang có đà tăng trưởng cực kỳ tốt. Thuật toán đang đẩy rất nhiều view cho các bài đăng mới nhất của bạn.";
        }

        let barsHtml = '';
        viewsArray.forEach((view, idx) => {
            const heightPct = Math.max((view / maxView) * 100, 2); 
            const isRecent = idx >= (viewsArray.length - recentCount);
            const barColor = isRecent ? (statusColor.includes('red') ? 'bg-red-500' : (statusColor.includes('orange') ? 'bg-orange-400' : 'bg-pink-500')) : 'bg-slate-600';
            
            barsHtml += `
                <div class="flex flex-col items-center justify-end h-48 group relative">
                    <div class="absolute -top-8 bg-black/80 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">${formatStatsClient(view)}</div>
                    <div class="w-4 sm:w-8 ${barColor} rounded-t-sm transition-all duration-700 ease-out shadow-lg" style="height: ${heightPct}%"></div>
                </div>
            `;
        });

        sbArea.innerHTML = `
            <div class="bg-slate-800/80 p-8 rounded-[2rem] border shadow-inner animate-fade-up ${bgGlow}">
                <div class="text-center mb-8 border-b border-white/10 pb-6">
                    <h3 class="text-3xl font-black ${statusColor} mb-2 tracking-tight">${statusText}</h3>
                    <p class="text-slate-300 text-sm max-w-2xl mx-auto leading-relaxed">${message}</p>
                </div>
                
                <h4 class="text-xs text-slate-400 font-bold mb-4 uppercase tracking-widest flex justify-between">
                    <span><i class="fa-solid fa-chart-column mr-1"></i> Biểu đồ View ${sampleSize} bài gần nhất</span>
                    <span class="text-pink-400 flex items-center gap-2"><div class="w-3 h-3 bg-pink-500 rounded-sm"></div> ${recentCount} bài mới nhất</span>
                </h4>
                
                <div class="w-full bg-slate-900/50 rounded-xl p-4 border border-slate-700 overflow-x-auto custom-scroll-x flex items-end justify-between gap-1 sm:gap-2 px-2 pb-2 h-64">
                    ${barsHtml}
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
        try { await triggerDownload(`https://corsproxy.io/?${encodeURIComponent(url)}`); } 
        catch (e) { window.open(url, '_blank'); }
    } finally {
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
        setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
    }
}

async function downloadImages(index, btnObj) {
    const d = fetchedVideos[index].data;
    if(!d.images) return;
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải ${d.images.length} ảnh...`;
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
    
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong ${d.images.length} Ảnh`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}

function searchUserFromDetail(username) {
    closeDetailWindow('video-detail-window');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= PHÂN TÍCH CHUYÊN SÂU 1 BÀI ĐĂNG DẠNG CỘT =================
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

    // Xây dựng Biểu đồ cột Logarithmic để mọi chỉ số đều hiển thị được rõ ràng
    const logMax = Math.log10(play + 1) || 1;
    const getH = (val) => Math.max((Math.log10(val + 1) / logMax) * 100, 5); // Tối thiểu hiển thị 5% chiều cao

    const chartHtml = `
        <div class="w-full bg-slate-900/60 rounded-xl p-4 md:p-6 border border-slate-700 flex items-end justify-around gap-1 sm:gap-4 h-56 mt-2 shadow-inner">
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(play)}</span>
                <div class="w-full max-w-[40px] bg-sky-500 rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(14,165,233,0.4)]" style="height: ${getH(play)}%"></div>
                <span class="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">View</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(likes)}</span>
                <div class="w-full max-w-[40px] bg-pink-500 rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(236,72,153,0.4)]" style="height: ${getH(likes)}%"></div>
                <span class="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">Tim</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(comments)}</span>
                <div class="w-full max-w-[40px] bg-blue-400 rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(96,165,250,0.4)]" style="height: ${getH(comments)}%"></div>
                <span class="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">Cmt</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(shares)}</span>
                <div class="w-full max-w-[40px] bg-emerald-400 rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(52,211,153,0.4)]" style="height: ${getH(shares)}%"></div>
                <span class="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">Share</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">${formatStatsClient(downloads)}</span>
                <div class="w-full max-w-[40px] bg-zinc-400 rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(161,161,170,0.4)]" style="height: ${getH(downloads)}%"></div>
                <span class="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest">Save</span>
            </div>
        </div>
    `;

    const infoBox = document.getElementById('detail-video-info');
    const oldHtml = infoBox.innerHTML;
    const oldActions = document.getElementById('detail-video-actions').innerHTML;

    infoBox.innerHTML = `
        <button onclick="restoreVideoDetail()" class="mb-4 text-pink-400 font-bold flex items-center gap-2 hover:text-pink-300 transition">
            <i class="fa-solid fa-arrow-left"></i> Quay lại
        </button>
        <h3 class="text-xl md:text-2xl font-black text-white mb-2"><i class="fa-solid fa-chart-column text-sky-400"></i> Phân Tích Dạng Cột Chi Tiết</h3>
        
        ${chartHtml}
        
        <div class="grid grid-cols-2 gap-3 mt-5">
            <div class="bg-slate-800/60 p-4 rounded-xl border border-white/5 flex flex-col justify-center items-center shadow-inner hover:-translate-y-1 transition">
                <span class="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">Tỷ lệ Tương tác (ER)</span>
                <span class="text-white font-black text-xl md:text-2xl ${er > 10 ? 'text-emerald-400' : ''}">${er}%</span>
            </div>
            <div class="bg-slate-800/60 p-4 rounded-xl border border-white/5 flex flex-col justify-center items-center shadow-inner hover:-translate-y-1 transition">
                <span class="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">Tỷ lệ Chuyển đổi Like</span>
                <span class="text-white font-black text-xl md:text-2xl">${likeRatio}%</span>
            </div>
            <div class="col-span-2 bg-slate-800/60 p-4 rounded-xl border border-white/5 flex justify-between items-center shadow-inner">
                <span class="text-slate-400 font-bold text-sm uppercase tracking-widest"><i class="fa-solid fa-clock text-orange-400"></i> Thời Gian Đăng:</span>
                <span class="text-white font-bold text-sm md:text-base">${uploadDate}</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = `
        <button onclick="restoreVideoDetail()" class="w-full col-span-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            Đóng Bảng Phân Tích
        </button>
    `;

    window.restoreVideoDetail = function() {
        infoBox.innerHTML = oldHtml;
        document.getElementById('detail-video-actions').innerHTML = oldActions;
    }
}

// ================= CỬA SỔ HIỂN THỊ CHI TIẾT ĐA PHƯƠNG TIỆN =================
function openVideoDetail(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
    const isImagePost = d.images && d.images.length > 0;

    let mediaHtml = '';
    if (isImagePost) {
        let slides = d.images.map((img, i) => `
            <div class="w-full h-full flex-shrink-0 snap-center flex items-center justify-center relative">
                <img src="${img}" class="max-w-full max-h-full object-contain drop-shadow-2xl" referrerpolicy="no-referrer">
                <span class="absolute bottom-4 right-4 bg-black/70 text-white text-[10px] font-bold px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-lg">${i + 1} / ${d.images.length}</span>
            </div>
        `).join('');

        mediaHtml = `
            <div class="relative w-full h-full flex bg-slate-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] overflow-hidden group">
                <img src="${d.urls.cover}" class="w-full h-full object-cover blur-xl absolute opacity-30 z-0 pointer-events-none" referrerpolicy="no-referrer">
                
                <div class="w-full h-full flex overflow-x-auto snap-x snap-mandatory custom-scroll-x relative z-10 scroll-smooth" id="album-scroll-container">
                    ${slides}
                </div>
                
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: -300, behavior: 'smooth'})" class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-pink-600 border border-white/10 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-95 shadow-lg"><i class="fa-solid fa-chevron-left"></i></button>
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: 300, behavior: 'smooth'})" class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-pink-600 border border-white/10 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-95 shadow-lg"><i class="fa-solid fa-chevron-right"></i></button>

                <div class="absolute top-4 left-4 bg-pink-600/90 backdrop-blur-md text-white font-bold text-xs px-3 py-1.5 rounded-full z-20 shadow-lg border border-pink-400/50 flex items-center gap-1.5">
                    <i class="fa-regular fa-images"></i> Nhật Ký / Album ${d.images.length} Ảnh
                </div>
            </div>
        `;
    } else {
        mediaHtml = `
            <video controls playsinline autoplay class="w-full h-full object-contain max-h-[100%] bg-black/90 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" poster="${d.urls.cover}">
                <source src="${d.urls.no_watermark}" type="video/mp4">
            </video>
        `;
    }
    
    document.getElementById('detail-video-container').innerHTML = mediaHtml;

    const safeDesc = (d.video_data.description || 'Chưa có mô tả.').replace(/'/g, "\\'");
    
    document.getElementById('detail-video-info').innerHTML = `
        <div class="relative p-[1px] rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-5 group cursor-pointer hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all duration-300" onclick="searchUserFromDetail('${d.author.uniqueId}')">
            <div class="flex items-center gap-4 p-3 bg-slate-900/95 backdrop-blur-xl rounded-[15px]">
                <div class="relative w-14 h-14">
                    <div class="absolute inset-0 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-full animate-spin blur-[3px] opacity-70 group-hover:opacity-100 transition"></div>
                    <img src="${d.author.avatar}" class="w-14 h-14 rounded-full object-cover relative z-10 border-[2.5px] border-slate-900 bg-slate-800" loading="lazy" referrerpolicy="no-referrer">
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

        <div class="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5 mb-5 shadow-inner">
            <div class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                <i class="fa-solid fa-music text-purple-400 text-xs drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-white text-sm font-bold truncate tracking-wide">${d.music.title}</p>
                <p class="text-[10px] text-slate-500 uppercase font-semibold mt-0.5 tracking-widest">Âm thanh gốc</p>
            </div>
        </div>
        
        <div class="relative bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 shadow-inner mb-6">
            <i class="fa-solid fa-quote-left absolute top-3 right-4 text-4xl text-white/5"></i>
            <h4 class="text-[11px] text-pink-500 font-bold uppercase tracking-widest mb-2"><i class="fa-solid fa-align-left"></i> Mô tả</h4>
            <div class="relative group">
                <p class="text-slate-200 text-[14px] leading-relaxed whitespace-pre-wrap">${safeDesc}</p>
            </div>
        </div>
        
        <div class="flex justify-between items-center mb-3 pl-1">
            <h4 class="text-[11px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-chart-pie"></i> Tương tác số liệu</h4>
            <button onclick="analyzeSingleVideo(${index})" class="bg-gradient-to-r from-sky-600 to-blue-500 hover:from-sky-500 hover:to-blue-400 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 text-xs">
                <i class="fa-solid fa-chart-column"></i> Phân Tích Dạng Cột
            </button>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-6">
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
        
        <a href="${d.link}" target="_blank" class="w-full bg-black hover:bg-zinc-900 text-white border border-white/20 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm">
            <i class="fa-brands fa-tiktok text-lg"></i> Xem Tại Nguồn (TikTok)
        </a>
    `;

    document.getElementById('detail-video-actions').innerHTML = isImagePost ? `
        <button onclick="downloadImages(${index}, this)" class="w-full col-span-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-images text-lg"></i> Tải Trọn Bộ ${d.images.length} Ảnh (Nhật Ký)
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 border border-slate-600 shadow-lg flex items-center justify-center gap-2 text-base mt-1">
            <i class="fa-solid fa-music text-purple-400 text-lg"></i> Tải Nhạc MP3
        </button>
    ` : `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full col-span-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 text-base">
            <i class="fa-solid fa-download text-lg"></i> Tải Video Gốc (Không Logo)
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 border border-slate-600 shadow-lg flex items-center justify-center gap-2 text-base mt-1">
            <i class="fa-solid fa-music text-purple-400 text-lg"></i> Tải Nhạc Âm Thanh Gốc
        </button>
    `;

    document.getElementById('video-detail-window').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetailWindow(windowId) {
    document.getElementById(windowId).classList.remove('active');
    document.body.style.overflow = '';
    if(windowId === 'video-detail-window') {
        const videoEl = document.querySelector('#detail-video-container video');
        if (videoEl) { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); }
        document.getElementById('detail-video-container').innerHTML = ''; 
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

// ================= CÁC API CALLS CHÍNH =================
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    if (linkMode === 'single' && links.length > 1) return showError("Đang ở chế độ 1 Bài Đăng. Hãy chuyển sang Tab 'Nhiều Bài Đăng'!");

    const fetchBtn = document.getElementById('fetch-video-btn');
    clearResults();
    showLoading(true, `Đang xử lý ${links.length} luồng dữ liệu...`);
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

async function searchTikTok(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return showError("Nhập từ khóa vô!");

    const searchBtn = document.getElementById('fetch-search-btn');

    if (!isLoadMore) {
        clearResults();
        currentSearchKeyword = kw; searchCursor = 0;
        if(searchBtn) searchBtn.disabled = true;
        showLoading(true, `Đang tìm kiếm dữ liệu: "${kw}"...`);
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

        const specialBox = document.getElementById('special-action-container');
        if(specialBox) {
            specialBox.innerHTML = `
                <button id="random-btn" onclick="searchRandom()" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <i class="fa-solid fa-dice text-lg"></i> Lấy Ngẫu Nhiên
                </button>
            `;
            specialBox.classList.remove('hidden');
        }

    } catch (error) { if(!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { 
        showLoading(false); 
        if(searchBtn) searchBtn.disabled = false;
    }
}

async function searchRandom() {
    if(fetchedVideos.length === 0) return;
    
    const searchBtn = document.getElementById('fetch-search-btn');
    const randomBtn = document.getElementById('random-btn');
    
    if(searchBtn) searchBtn.disabled = true;
    if(randomBtn) randomBtn.disabled = true;

    showLoading(true, `Đang bốc thăm ngẫu nhiên...`);
    try {
        const randomCursor = Math.floor(Math.random() * 20);
        let response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${randomCursor}&count=20`);
        let resData = await response.json();
        
        if (resData.code !== 0 || !resData.data?.videos?.length) {
            response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=0&count=20`);
            resData = await response.json();
        }

        let videos = resData.data?.videos;
        if(videos && videos.length > 0) {
            clearResults();
            const luckyVideo = videos[Math.floor(Math.random() * videos.length)];
            fetchedVideos = formatTikWmToGrid([luckyVideo]);
            renderVideoCards(fetchedVideos, false, 0);
            
            const specialBox = document.getElementById('special-action-container');
            if(specialBox) {
                specialBox.innerHTML = `
                    <button id="random-btn" onclick="searchRandom()" class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                        <i class="fa-solid fa-dice text-lg"></i> Lấy Ngẫu Nhiên Khác
                    </button>
                `;
                specialBox.classList.remove('hidden');
            }
        }
    } catch (error) { showError(error.message); } 
    finally { 
        showLoading(false); 
        if(searchBtn) searchBtn.disabled = false;
        if(randomBtn) randomBtn.disabled = false;
    }
}

async function fetchUserInfo(isLoadMore = false) {
    let user = isLoadMore ? currentUserProfile : document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID vô mới quét được!");

    const infoBtn = document.getElementById('fetch-info-btn');

    if (!isLoadMore) {
        clearResults();
        currentUserProfile = user;
        if(infoBtn) infoBtn.disabled = true;
        showLoading(true, "Đang quét dữ liệu kênh...");
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
            if(data.author) {
                fullUserData = data; 
            } else {
                fullUserData = { author: { uniqueId: user, nickname: user, avatar: "", verified: false }, stats_formatted: {} };
            }
            
            const container = document.getElementById('user-info-area');
            const u = fullUserData.author;
            const s = fullUserData.stats_formatted || {};
            
            container.innerHTML = `
                <div class="w-full glass-panel rounded-[2rem] relative shadow-2xl animate-fade-up border border-white/10">
                    <div id="channel-profile-box" class="collapsible-box expanded p-8 md:p-10 text-center relative">
                        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-pink-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
                        <img src="${u.avatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-slate-800 shadow-[0_0_30px_rgba(236,72,153,0.5)] relative z-10 bg-slate-900" loading="lazy" referrerpolicy="no-referrer">
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
        checkLoadMoreUI(data.hasMore);
    } catch (error) { if (!isLoadMore) showError(error.message); else alert("Lỗi: " + error.message); } 
    finally { showLoading(false); if(infoBtn) infoBtn.disabled = false; }
}

function renderVideoCards(results, append = false, startIndex = 0) {
    requestAnimationFrame(() => {
        const container = document.getElementById('result-area');
        let html = '';

        const specialAction = document.getElementById('special-action-container');
        if (fetchedVideos.length > 1 && (currentMode === 'video' && linkMode === 'multi')) {
            if(specialAction) {
                specialAction.innerHTML = `
                    <button onclick="downloadAllVideos(this)" class="bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                        <i class="fa-solid fa-boxes-packing"></i> Tải Toàn Bộ Bài Đăng Bên Dưới
                    </button>
                `;
                specialAction.classList.remove('hidden');
            }
        } else if (currentMode === 'video' && linkMode === 'single') {
            if(specialAction) specialAction.classList.add('hidden'); 
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
                    <div onclick="openVideoDetail(${currentIndex})" class="premium-card rounded-3xl overflow-hidden relative w-full aspect-[3/4] flex flex-col cursor-pointer group">
                        
                        <div class="absolute inset-0 bg-slate-900 z-0 overflow-hidden">
                            <img src="${d.urls.cover}" class="cover-img w-full h-full object-cover opacity-80" loading="lazy" decoding="async" referrerpolicy="no-referrer">
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
                                <img src="${d.author.avatar}" class="w-7 h-7 rounded-full object-cover ring-2 ring-pink-500/40 group-hover:ring-pink-500 transition-all shadow-lg bg-slate-800" loading="lazy" decoding="async" referrerpolicy="no-referrer">
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
        if(loadMoreContainer) loadMoreContainer.classList.remove('hidden');
        const loadBtn = document.getElementById('load-more-btn');
        if(loadBtn) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = `<i class="fa-solid fa-angle-down"></i> Tải Thêm Dữ Liệu`;
        }
    } else {
        if(loadMoreContainer) loadMoreContainer.classList.add('hidden');
    }
}

async function downloadAllVideos(btnObj) {
    if (!fetchedVideos || fetchedVideos.length === 0) return;
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btnObj.disabled = true;

    for (let i = 0; i < fetchedVideos.length; i++) {
        const d = fetchedVideos[i].data;
        if (d.images && d.images.length > 0) {
            for (let j=0; j<d.images.length; j++){
                const fname = `${d.author.uniqueId}_${d.video_data.id}_img_${j+1}.jpg`;
                try {
                    const res = await fetch(d.images[j]);
                    const blob = await res.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none'; a.href = downloadUrl; a.download = fname; 
                    document.body.appendChild(a); a.click();
                    window.URL.revokeObjectURL(downloadUrl); a.remove();
                } catch(e) { window.open(d.images[j], '_blank'); }
                await new Promise(r => setTimeout(r, 400));
            }
        } else {
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
        }
        await new Promise(r => setTimeout(r, 800)); 
    }
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn Tất`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.disabled = false; }, 3000);
}
