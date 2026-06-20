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
            if (m === mode) {
                tabBtn.className = 'w-full py-3 rounded-xl bg-zinc-800 text-white font-bold shadow-md transition-all flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap px-4';
            } else {
                tabBtn.className = 'w-full py-3 rounded-xl text-zinc-400 font-medium hover:text-white hover:bg-zinc-800/50 transition-all flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap px-4';
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
        btnSingle.className = "px-5 py-1.5 rounded-lg bg-zinc-700 text-white font-semibold text-xs transition";
        btnMulti.className = "px-5 py-1.5 rounded-lg text-zinc-400 font-semibold text-xs hover:text-white transition";
        textArea.rows = 1;
        textArea.placeholder = "Dán link Video hoặc Nhật ký (Story) vào đây...";
    } else {
        btnMulti.className = "px-5 py-1.5 rounded-lg bg-zinc-700 text-white font-semibold text-xs transition";
        btnSingle.className = "px-5 py-1.5 rounded-lg text-zinc-400 font-semibold text-xs hover:text-white transition";
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

// LOGIC KHÁM KÊNH GIỮ NGUYÊN HOÀN TOÀN, ĐỔI STYLE CLASS CHO HỢP THEME
window.checkShadowban = async function() {
    let user = document.getElementById('shadowban-input').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if(!user) return showError("Vui lòng nhập ID kênh để khám!");

    showLoading(true, "Đang trích xuất lịch sử kênh...");
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

        let statusText = "PHONG ĐỘ ỔN ĐỊNH";
        let statusColor = "text-emerald-400";
        let bgGlow = "border-emerald-500/20";
        let message = "Kênh đang phân phối hiển thị ổn định, không có dấu hiệu bị bóp tương tác. Hãy tiếp tục duy trì!";

        if (avgRecent < 200 && avgOld > 1000) {
            statusText = "SHADOWBAN NẶNG";
            statusColor = "text-red-500";
            bgGlow = "border-red-500/30";
            message = "CẢNH BÁO ĐỎ: Lượt xem rớt thê thảm. Khả năng rất cao kênh đã bị TikTok đánh gậy ẩn (Shadowban) do vi phạm chính sách hoặc reup.";
        } else if (avgRecent < avgOld * 0.4 && avgOld > 500) {
            statusText = "FLOP / TỤT ĐỀ XUẤT";
            statusColor = "text-orange-400";
            bgGlow = "border-orange-500/30";
            message = "Lượt xem đang có xu hướng giảm mạnh so với thời gian trước. Rà soát lại chất lượng nội dung ngay.";
        } else if (avgRecent > avgOld * 1.5 && avgRecent > 1000) {
            statusText = "ĐANG LÊN XU HƯỚNG";
            statusColor = "text-cyan-400";
            bgGlow = "border-cyan-500/30";
            message = "Tuyệt vời! Kênh đang có đà tăng trưởng cực kỳ tốt. Thuật toán đang đẩy rất nhiều view cho các bài đăng mới nhất.";
        }

        let barsHtml = '';
        viewsArray.forEach((view, idx) => {
            const heightPct = Math.max((view / maxView) * 100, 2); 
            const isRecent = idx >= (viewsArray.length - recentCount);
            const barColor = isRecent ? (statusColor.includes('red') ? 'bg-red-500' : (statusColor.includes('orange') ? 'bg-orange-400' : 'bg-cyan-400')) : 'bg-zinc-700';
            
            barsHtml += `
                <div class="flex flex-col items-center justify-end h-48 group relative">
                    <div class="absolute -top-8 bg-black border border-zinc-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">${formatStatsClient(view)}</div>
                    <div class="w-4 sm:w-8 ${barColor} rounded-t-sm transition-all duration-700 ease-out shadow-lg" style="height: ${heightPct}%"></div>
                </div>
            `;
        });

        sbArea.innerHTML = `
            <div class="bg-zinc-900 p-8 rounded-[2rem] border ${bgGlow} shadow-inner animate-fade-up">
                <div class="text-center mb-8 border-b border-zinc-800 pb-6">
                    <h3 class="text-2xl font-black ${statusColor} mb-2 tracking-tight">${statusText}</h3>
                    <p class="text-zinc-400 text-sm max-w-2xl mx-auto leading-relaxed">${message}</p>
                </div>
                
                <h4 class="text-xs text-zinc-500 font-bold mb-4 uppercase tracking-widest flex justify-between">
                    <span><i class="fa-solid fa-chart-column mr-1"></i> Biểu đồ ${sampleSize} video</span>
                    <span class="text-zinc-300 flex items-center gap-2"><div class="w-3 h-3 bg-cyan-500 rounded-sm"></div> ${recentCount} bài mới</span>
                </h4>
                
                <div class="w-full bg-zinc-950 rounded-xl p-4 border border-zinc-800 overflow-x-auto custom-scroll-x flex items-end justify-between gap-1 sm:gap-2 px-2 pb-2 h-64">
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

// LOGIC PHÂN TÍCH 100% KÊNH
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    const analyticsBtn = document.getElementById('fetch-analytics-btn');

    clearResults();
    currentMode = 'analytics';
    if(analyticsBtn) analyticsBtn.disabled = true;
    showLoading(true, "Quét sâu 100% video kênh...");

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
            document.getElementById('loading-text').innerText = `Đang quét... gom được ${allVideos.length} bài`;
        }

        if (allVideos.length === 0) throw new Error("Kênh trống hoặc bị riêng tư.");

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
            ? sortedTags.map(t => `<span class="bg-zinc-800 border border-zinc-700 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold">${t[0]} <span class="opacity-60 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-zinc-600 text-sm italic">Không dùng Hashtag</span>';

        const createDate = pAuthor?.createTime ? new Date(pAuthor.createTime * 1000).toLocaleDateString('vi-VN') : 'Không rõ';

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl animate-fade-up relative">
                <div id="analytics-profile-box" class="collapsible-box expanded p-8 md:p-10 relative">
                    <div class="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-800">
                        <img src="${pAuthor?.avatar}" class="w-16 h-16 rounded-full object-cover border border-zinc-700 bg-black" referrerpolicy="no-referrer">
                        <div>
                            <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">
                                ${pAuthor?.nickname || user}
                                ${pAuthor?.verified ? '<i class="fa-solid fa-circle-check text-cyan-500"></i>' : ''}
                            </h2>
                            <p class="text-cyan-400 font-medium text-sm">Báo cáo Phân tích từ ${videoCount} bài đăng</p>
                        </div>
                    </div>

                    <div class="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6">
                        <div class="text-center flex-1 border-r border-zinc-800">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Ngày Lập Kênh</span>
                            <span class="font-black text-white text-base">${createDate}</span>
                        </div>
                        <div class="text-center flex-1 border-r border-zinc-800">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Video Mới</span>
                            <a href="${newestVid.link}" target="_blank" class="font-bold text-cyan-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem</a>
                        </div>
                        <div class="text-center flex-1">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Video Cũ</span>
                            <a href="${oldestVid.link}" target="_blank" class="font-bold text-cyan-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem</a>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div class="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                            <i class="fa-solid fa-fire text-orange-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${formatStatsClient(avgViews)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">View TB</span>
                        </div>
                        <div class="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                            <i class="fa-solid fa-percent text-cyan-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${er}%</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tỷ lệ ER</span>
                        </div>
                        <div class="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                            <i class="fa-solid fa-heart text-violet-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${formatStatsClient(totalLikes / videoCount)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tim TB</span>
                        </div>
                        <div class="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                            <i class="fa-solid fa-play text-emerald-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${formatStatsClient(totalPlays)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tổng View</span>
                        </div>
                    </div>

                    <div class="mb-2 text-left">
                        <h4 class="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-hashtag text-cyan-400"></i> Top Hashtag</h4>
                        <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                    </div>
                </div>
                <button class="expand-btn w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300 shadow-lg flex items-center justify-center hover:bg-cyan-600 hover:text-white transition" onclick="toggleExpand('analytics-profile-box')">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            
            <h3 class="text-center text-sm font-bold text-zinc-400 mt-10 mb-2 uppercase tracking-[0.2em]">TOP 6 BÀI ĐĂNG VIRAL NHẤT</h3>
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

async function forceDownload(url, filename, btnObj) {
    const originalHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tải...`;
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
        btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
        setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
    }
}

async function downloadImages(index, btnObj) {
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

// LOGIC PHÂN TÍCH DẠNG CỘT (CẬP NHẬT GIAO DIỆN CYBER)
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
        <div class="w-full bg-zinc-950/80 rounded-xl p-4 md:p-6 border border-zinc-800 flex items-end justify-around gap-2 h-56 mt-2">
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-800">${formatStatsClient(play)}</span>
                <div class="w-full max-w-[35px] bg-zinc-600 rounded-t-sm transition-all duration-700 ease-out" style="height: ${getH(play)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-3 uppercase">View</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-800">${formatStatsClient(likes)}</span>
                <div class="w-full max-w-[35px] bg-violet-500 rounded-t-sm transition-all duration-700 ease-out" style="height: ${getH(likes)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-3 uppercase">Tim</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-800">${formatStatsClient(comments)}</span>
                <div class="w-full max-w-[35px] bg-blue-500 rounded-t-sm transition-all duration-700 ease-out" style="height: ${getH(comments)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-3 uppercase">Cmt</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-800">${formatStatsClient(shares)}</span>
                <div class="w-full max-w-[35px] bg-emerald-500 rounded-t-sm transition-all duration-700 ease-out" style="height: ${getH(shares)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-3 uppercase">Share</span>
            </div>
            <div class="flex flex-col items-center justify-end h-full w-full group relative">
                <span class="absolute -top-6 text-white font-bold text-[10px] sm:text-xs bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-800">${formatStatsClient(downloads)}</span>
                <div class="w-full max-w-[35px] bg-orange-500 rounded-t-sm transition-all duration-700 ease-out" style="height: ${getH(downloads)}%"></div>
                <span class="text-[9px] text-zinc-500 font-bold mt-3 uppercase">Save</span>
            </div>
        </div>
    `;

    const infoBox = document.getElementById('detail-video-info');
    const oldHtml = infoBox.innerHTML;
    const oldActions = document.getElementById('detail-video-actions').innerHTML;

    infoBox.innerHTML = `
        <button onclick="restoreVideoDetail()" class="mb-4 text-cyan-400 font-bold flex items-center gap-2 hover:text-cyan-300 transition text-sm">
            <i class="fa-solid fa-arrow-left"></i> Quay lại
        </button>
        <h3 class="text-xl font-black text-white mb-2 tracking-tight">Thống Kê Dạng Cột</h3>
        
        ${chartHtml}
        
        <div class="grid grid-cols-2 gap-3 mt-4">
            <div class="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col justify-center items-center">
                <span class="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mb-1">Tỷ lệ ER</span>
                <span class="text-white font-black text-xl ${er > 10 ? 'text-emerald-400' : ''}">${er}%</span>
            </div>
            <div class="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col justify-center items-center">
                <span class="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mb-1">Chuyển đổi Like</span>
                <span class="text-white font-black text-xl">${likeRatio}%</span>
            </div>
            <div class="col-span-2 bg-zinc-900 p-3 px-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                <span class="text-zinc-500 font-bold text-xs uppercase tracking-widest"><i class="fa-solid fa-clock mr-1"></i> Xuất bản:</span>
                <span class="text-zinc-300 font-medium text-xs">${uploadDate}</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = `
        <button onclick="restoreVideoDetail()" class="w-full col-span-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl transition-all border border-zinc-700 text-sm">
            Đóng Biểu Đồ
        </button>
    `;

    window.restoreVideoDetail = function() {
        infoBox.innerHTML = oldHtml;
        document.getElementById('detail-video-actions').innerHTML = oldActions;
    }
}

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
                <span class="absolute bottom-4 right-4 bg-black/70 text-white text-[10px] font-bold px-3 py-1 rounded border border-zinc-800">${i + 1} / ${d.images.length}</span>
            </div>
        `).join('');

        mediaHtml = `
            <div class="relative w-full h-full flex overflow-hidden group">
                <img src="${d.urls.cover}" class="w-full h-full object-cover blur-xl absolute opacity-20 z-0 pointer-events-none" referrerpolicy="no-referrer">
                <div class="w-full h-full flex overflow-x-auto snap-x snap-mandatory custom-scroll-x relative z-10 scroll-smooth" id="album-scroll-container">
                    ${slides}
                </div>
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: -300, behavior: 'smooth'})" class="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-cyan-600 border border-zinc-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <button onclick="document.getElementById('album-scroll-container').scrollBy({left: 300, behavior: 'smooth'})" class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-cyan-600 border border-zinc-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                <div class="absolute top-4 left-4 bg-zinc-900/90 text-zinc-300 font-semibold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-zinc-800 z-20 flex items-center gap-1.5">
                    <i class="fa-regular fa-images text-cyan-400"></i> Dạng Ảnh (Lướt)
                </div>
            </div>
        `;
    } else {
        mediaHtml = `
            <video controls playsinline autoplay class="w-full h-full object-contain max-h-[100%] bg-black" poster="${d.urls.cover}">
                <source src="${d.urls.no_watermark}" type="video/mp4">
            </video>
        `;
    }
    
    document.getElementById('detail-video-container').innerHTML = mediaHtml;

    const safeDesc = (d.video_data.description || 'Không có văn bản mô tả.').replace(/'/g, "\\'");
    
    document.getElementById('detail-video-info').innerHTML = `
        <div class="relative p-[1px] rounded-2xl bg-gradient-to-r from-zinc-800 to-zinc-800 hover:from-cyan-500 hover:to-violet-500 mb-5 group cursor-pointer transition-all duration-500" onclick="searchUserFromDetail('${d.author.uniqueId}')">
            <div class="flex items-center gap-4 p-3 bg-zinc-950 rounded-[15px]">
                <img src="${d.author.avatar}" class="w-12 h-12 rounded-full object-cover border border-zinc-800 bg-black" loading="lazy" referrerpolicy="no-referrer">
                <div class="flex-1 truncate">
                    <h3 class="font-bold text-white text-base group-hover:text-cyan-400 transition flex items-center gap-1.5 truncate">
                        ${d.author.nickname} ${d.author.verified ? '<i class="fa-solid fa-circle-check text-cyan-500 text-[12px]"></i>' : ''}
                    </h3>
                    <p class="text-zinc-500 font-medium text-xs mt-0.5 truncate">@${d.author.uniqueId}</p>
                </div>
                <div class="px-3 py-1 rounded bg-zinc-900 text-zinc-400 text-xs font-bold group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                    Hồ Sơ
                </div>
            </div>
        </div>

        <div class="flex items-center gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 mb-5">
            <div class="w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800">
                <i class="fa-solid fa-music text-violet-400 text-[10px]"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="text-zinc-200 text-xs font-bold truncate">${d.music.title}</p>
            </div>
        </div>
        
        <div class="relative bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 mb-6">
            <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Văn Bản</h4>
            <p class="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">${safeDesc}</p>
        </div>
        
        <div class="flex justify-between items-center mb-3">
            <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Tương tác</h4>
            <button onclick="analyzeSingleVideo(${index})" class="text-[10px] bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 px-3 py-1.5 rounded uppercase font-bold transition flex items-center gap-1 border border-cyan-500/20">
                <i class="fa-solid fa-chart-column"></i> Cột Phân Tích
            </button>
        </div>

        <div class="grid grid-cols-4 gap-2 mb-6">
            <div class="bg-zinc-900 border border-zinc-800 py-3 rounded-xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-black">${formatStatsClient(d.stats.play)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">View</span>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 py-3 rounded-xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-black">${formatStatsClient(d.stats.like)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Tim</span>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 py-3 rounded-xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-black">${formatStatsClient(d.stats.comment)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Cmt</span>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 py-3 rounded-xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-black">${formatStatsClient(d.stats.share)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Share</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = isImagePost ? `
        <button onclick="downloadImages(${index}, this)" class="w-full col-span-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2">
            <i class="fa-solid fa-images"></i> Tải Toàn Bộ Ảnh Về Máy
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl transition-all border border-zinc-700 text-sm flex justify-center items-center gap-2 mt-1">
            <i class="fa-solid fa-music text-violet-400"></i> Tải Nhạc MP3
        </button>
    ` : `
        <button onclick="forceDownload('${d.urls.no_watermark}', '${fileNameMp4}', this)" class="w-full col-span-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2">
            <i class="fa-solid fa-download"></i> Tải Video Không Logo
        </button>
        <button onclick="forceDownload('${d.music.playUrl}', '${fileNameMp3}', this)" class="w-full col-span-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl transition-all border border-zinc-700 text-sm flex justify-center items-center gap-2 mt-1">
            <i class="fa-solid fa-music text-violet-400"></i> Tải Nhạc MP3
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

// LOGIC CÁC API CALLS CÒN LẠI GIỮ NGUYÊN 100%
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

async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return showError("Dán link vô đi nào!");
    if (linkMode === 'single' && links.length > 1) return showError("Đang ở chế độ 1 Bài Đăng. Hãy chuyển sang Tab 'Nhiều Bài Đăng'!");

    const fetchBtn = document.getElementById('fetch-video-btn');
    clearResults();
    showLoading(true, "Đang xử lý luồng dữ liệu...");
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
        showLoading(true, "Đang tìm kiếm dữ liệu...");
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
    finally { showLoading(false); if(searchBtn) searchBtn.disabled = false; }
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
            if(data.author) fullUserData = data; 
            else fullUserData = { author: { uniqueId: user, nickname: user, avatar: "", verified: false }, stats_formatted: {} };
            
            const container = document.getElementById('user-info-area');
            const u = fullUserData.author;
            const s = fullUserData.stats_formatted || {};
            
            container.innerHTML = `
                <div class="w-full bg-zinc-900 rounded-[2rem] relative shadow-2xl animate-fade-up border border-zinc-800">
                    <div id="channel-profile-box" class="collapsible-box expanded p-8 md:p-10 text-center relative">
                        <img src="${u.avatar}" class="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto object-cover border-4 border-zinc-800 bg-black relative z-10" loading="lazy" referrerpolicy="no-referrer">
                        <h2 class="text-xl md:text-2xl font-black mt-4 text-white flex items-center justify-center gap-2">
                            ${u.nickname || u.uniqueId} 
                            ${u.verified ? '<i class="fa-solid fa-circle-check text-cyan-500"></i>' : ''}
                        </h2>
                        <p class="text-zinc-500 font-medium text-xs mt-1">@${u.uniqueId}</p>
                        
                        <p class="mt-4 text-zinc-300 text-sm leading-relaxed max-w-xl mx-auto">${u.signature || 'Chưa có tiểu sử.'}</p>
                        ${u.bioLink ? `<a href="${u.bioLink}" target="_blank" class="inline-block mt-3 text-cyan-400 text-xs bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800"><i class="fa-solid fa-link mr-1"></i>Link Profile</a>` : ''}
                        
                        <div class="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-zinc-800">
                            <div class="flex flex-col"><span class="text-lg font-black text-white">${s.following || '0'}</span><span class="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">Đang FL</span></div>
                            <div class="flex flex-col"><span class="text-lg font-black text-white">${s.follower || '0'}</span><span class="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">Follower</span></div>
                            <div class="flex flex-col"><span class="text-lg font-black text-white">${s.heart || '0'}</span><span class="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">Thích</span></div>
                        </div>
                    </div>
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
                    <button onclick="downloadAllVideos(this)" class="bg-zinc-800 text-white font-bold py-2.5 px-5 rounded-lg border border-zinc-700 shadow-md transition-colors hover:bg-cyan-600 hover:border-cyan-500 flex items-center gap-2 text-sm">
                        <i class="fa-solid fa-download"></i> Tải Tất Cả File
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
                ? `<div class="absolute top-2 left-2 bg-black/80 backdrop-blur border border-zinc-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20"><i class="fa-regular fa-images text-cyan-400"></i> ${d.images.length}</div>` 
                : '';

            html += `
                <div class="premium-card animate-fade-up relative w-full aspect-[3/4] flex flex-col cursor-pointer group" onclick="openVideoDetail(${currentIndex})" style="animation-delay: ${(index % 20) * 0.02}s">
                    <img src="${d.urls.cover}" class="cover-img absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                    ${mediaTypeBadge}
                    
                    <div class="absolute top-2 right-2 bg-black/80 backdrop-blur border border-zinc-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20 flex items-center gap-1">
                        <i class="fa-solid fa-play text-cyan-400"></i> ${d.stats.play}
                    </div>

                    <div class="play-aura absolute inset-0 flex items-center justify-center opacity-0 transform scale-50 z-20 pointer-events-none transition-all duration-300">
                        <div class="w-12 h-12 bg-cyan-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-lg pl-1 shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                            <i class="fa-solid fa-play"></i>
                        </div>
                    </div>

                    <div class="absolute bottom-0 left-0 w-full pt-16 pb-3 px-3 bg-gradient-to-t from-black via-black/70 to-transparent z-10 flex flex-col justify-end">
                        <div class="flex items-center gap-2 mb-2">
                            <img src="${d.author.avatar}" class="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-500 bg-black" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                            <span class="text-white font-semibold text-xs truncate shadow-sm">${d.author.nickname}</span>
                        </div>
                        <div class="flex gap-2 text-[9px] font-bold text-zinc-300">
                            <span class="bg-black/50 border border-zinc-700 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-heart text-violet-400"></i> ${d.stats.like}</span>
                            <span class="bg-black/50 border border-zinc-700 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-comment text-blue-400"></i> ${d.stats.comment}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        if (append) container.insertAdjacentHTML('beforeend', html);
        else container.innerHTML = html;
    });
}
