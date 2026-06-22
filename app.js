// TRẠNG THÁI TOÀN CỤC CHUẨN ĐỊNH
let currentMode = 'video';
let linkMode = 'single'; 
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;
let currentSortType = 'latest'; 

// ================= HÀM XỬ LÝ CHUỖI SỐ LIỆU CHUẨN XÁC 100% =================
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
    if(resultArea) { resultArea.innerHTML = ''; }
    
    const specAction = document.getElementById('special-action-container');
    if(specAction) { specAction.innerHTML = ''; specAction.classList.add('hidden'); }
    
    const loadMoreBtn = document.getElementById('load-more-container');
    if(loadMoreBtn) loadMoreBtn.classList.add('hidden');
    
    showError('');
    fetchedVideos = [];
    searchCursor = 0; currentSearchKeyword = "";
    userVideoCursor = 0; currentUserProfile = ""; fullUserData = null;
    currentSortType = 'latest'; 
}

function generateFileName(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

function toggleExpand(id) {
    const box = document.getElementById(id);
    if(box) box.classList.toggle('expanded');
}

function openGuide() { 
    const guide = document.getElementById('guide-window');
    if(guide) guide.classList.add('active'); 
}

function loadMore() {
    if (currentMode === 'search') searchTikTok(true);
    else if (currentMode === 'info') fetchUserInfo(true);
}

function checkLoadMoreUI(hasMore) {
    // Không dùng nút bấm phụ tải thêm nữa, quản lý trạng thái tĩnh ngầm
    const loadMoreContainer = document.getElementById('load-more-container');
    if(loadMoreContainer) loadMoreContainer.classList.add('hidden');
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

// SẮP XẾP BÀI ĐĂNG CÓ SẴN KHUNG CHỌN
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
    renderVideoCards(fetchedVideos, false, 0, false);
}

// ================= PHÂN TÍCH KÊNH SÂU XUNG NHỊP 1 GIÂY GOM ĐÚNG MỐC 200 BÀI =================
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID kênh cần phân tích!");

    const analyticsBtn = document.getElementById('fetch-analytics-btn');
    clearResults();
    currentMode = 'analytics';
    if(analyticsBtn) analyticsBtn.disabled = true;
    showLoading(true, "Đang kết nối kho tệp hệ thống...");

    try {
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let limitPages = 0; 
        
        let videosInCurrentSecond = 0;

        while(hasMore && limitPages < 150) {
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
            limitPages++;
            
            document.getElementById('loading-text').innerText = `XUNG NHỊP QUÉT: ĐÃ THU GOM THÀNH CÔNG ${allVideos.length} BÀI ĐĂNG`;
            
            // Ép xả nhịp chuẩn 1 giây sau khi quét được lũy kế 200 video chống nghẽn đường truyền
            if (videosInCurrentSecond >= 200) {
                await new Promise(r => setTimeout(r, 1000));
                videosInCurrentSecond = 0;
            }
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
            <div class="w-full bento-card p-6 md:p-8 animate-slide-up relative">
                <div id="analytics-profile-box" class="collapsible-box expanded relative">
                    <div class="flex items-center gap-4 mb-8 pb-6 border-b border-[#222]">
                        <img src="${pAuthor?.avatar}" class="w-16 h-16 rounded-full object-cover border border-[#333] bg-black" referrerpolicy="no-referrer">
                        <div>
                            <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">
                                ${pAuthor?.nickname || user}
                                ${pAuthor?.verified ? '<i class="fa-solid fa-circle-check text-cyan-500"></i>' : ''}
                            </h2>
                            <p class="text-cyan-400 font-medium text-sm">Báo cáo Phân tích từ ${videoCount} bài đăng</p>
                        </div>
                    </div>

                    <div class="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-[20px] border border-[#222] mb-6">
                        <div class="text-center flex-1 border-r border-[#222]">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Ngày Lập Kênh</span>
                            <span class="font-black text-white text-base">${createDate}</span>
                        </div>
                        <div class="text-center flex-1 border-r border-[#222]">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Video Mới</span>
                            <a href="${newestVid.link}" target="_blank" class="font-bold text-cyan-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem</a>
                        </div>
                        <div class="text-center flex-1">
                            <span class="block text-xs text-zinc-500 uppercase font-bold mb-1">Video Cũ</span>
                            <a href="${oldestVid.link}" target="_blank" class="font-bold text-cyan-400 text-sm hover:underline"><i class="fa-solid fa-link"></i> Xem</a>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                            <i class="fa-solid fa-fire text-orange-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${window.formatStatsClient(avgViews)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">View TB</span>
                        </div>
                        <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                            <i class="fa-solid fa-percent text-cyan-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${er}%</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tỷ lệ ER</span>
                        </div>
                        <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                            <i class="fa-solid fa-heart text-violet-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${window.formatStatsClient(totalLikes / videoCount)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tim TB</span>
                        </div>
                        <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                            <i class="fa-solid fa-play text-emerald-500 text-xl mb-2"></i>
                            <span class="text-xl font-black text-white">${window.formatStatsClient(totalPlays)}</span>
                            <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold text-center">Tổng View</span>
                        </div>
                    </div>

                    <div class="mb-2 text-left">
                        <h4 class="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-hashtag text-cyan-400"></i> Top Hashtag</h4>
                        <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                    </div>
                </div>
                <button class="expand-btn w-8 h-8 bg-[#1a1a1a] border border-[#333] rounded-full text-zinc-400 flex items-center justify-center hover:bg-white hover:text-black transition" onclick="toggleExpand('analytics-profile-box')">
                    <i class="fa-solid fa-chevron-down text-xs"></i>
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

        fetchedVideos = formattedResults;
        sortVideos('popular'); 

    } catch (error) { showError(error.message); } 
    finally { showLoading(false); if(analyticsBtn) analyticsBtn.disabled = false; }
}

// ================= TẢI NGUYÊN LIỆU PHƯƠNG TIỆN =================
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
    
    btnObj.innerHTML = `<i class="fa-solid fa-check"></i> Xong`;
    setTimeout(() => { btnObj.innerHTML = originalHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
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

function searchUserFromDetail(username) {
    closeDetailWindow('video-detail-window');
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= PHÂN TÍCH TỪNG MỤC DẠNG LIST NGUYÊN BẢN =================
function analyzeSingleVideo(index) {
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

    const typeStr = (d.images && d.images.length > 0) ? `<i class="fa-solid fa-images text-emerald-400"></i> Nhật Ký Ảnh (${d.images.length} tệp)` : `<i class="fa-solid fa-video text-sky-400"></i> Video Clip`;
    const durationStr = d.video_data.duration ? `${d.video_data.duration} giây` : 'Không xác định';
    const regionStr = d.video_data.region || 'Quốc tế';

    const infoBox = document.getElementById('detail-video-info');
    const oldHtml = infoBox.innerHTML;
    const oldActions = document.getElementById('detail-video-actions').innerHTML;

    infoBox.innerHTML = `
        <button onclick="restoreVideoDetail()" class="mb-4 text-zinc-400 font-bold flex items-center gap-2 hover:text-white transition text-sm">
            <i class="fa-solid fa-arrow-left"></i> Quay lại
        </button>
        <h3 class="text-xl font-bold text-white mb-4">Mục Lục Phân Tích</h3>
        
        <div class="space-y-3">
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-hashtag text-purple-400 w-4"></i> ID Tệp Tin:</span>
                <span class="text-white font-bold text-xs">${d.video_data.id}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-file-code text-emerald-400 w-4"></i> Định Dạng:</span>
                <span class="text-white font-bold text-xs">${typeStr}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-clock text-orange-400 w-4"></i> Khởi Tạo Chuẩn:</span>
                <span class="text-white font-bold text-xs">${uploadDate}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-earth-asia text-blue-400 w-4"></i> Khu Vực Đăng:</span>
                <span class="text-white font-bold text-xs uppercase">${regionStr}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-stopwatch text-rose-400 w-4"></i> Thời Lượng:</span>
                <span class="text-white font-bold text-xs">${durationStr}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-percent text-cyan-400 w-4"></i> Tương Tác ER:</span>
                <span class="text-white font-black text-sm ${er > 10 ? 'text-emerald-400' : ''}">${er}%</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-heart-pulse text-pink-500 w-4"></i> Chuyển Đổi Tim:</span>
                <span class="text-white font-bold text-xs">${likeRatio}%</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-download text-zinc-400 w-4"></i> Lượt Save:</span>
                <span class="text-white font-bold text-xs">${formatStatsClient(downloads)}</span>
            </div>
        </div>
    `;

    document.getElementById('detail-video-actions').innerHTML = `
        <button onclick="restoreVideoDetail()" class="w-full col-span-2 bento-btn-secondary py-3 text-sm">
            Quay Lại Bài Đăng
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
                <img src="${img}" class="max-w-full max-h-full object-contain" referrerpolicy="no-referrer">
                <span class="absolute bottom-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-lg">${i + 1} / ${d.images.length}</span>
            </div>
        `).join('');

        mediaHtml = `
            <div class="relative w-full h-full flex overflow-hidden group bg-[#0a0a0a]">
                <div class="w-full h-full flex overflow-x-auto snap-x snap-mandatory custom-scroll-x relative z-10 scroll-smooth" id="album-scroll-container">
                    ${slides}
                </div>
                <button onclick="let c=document.getElementById('album-scroll-container'); c.scrollBy({left: -c.clientWidth, behavior: 'smooth'})" class="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white border border-[#333] text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <button onclick="let c=document.getElementById('album-scroll-container'); c.scrollBy({left: c.clientWidth, behavior: 'smooth'})" class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white border border-[#333] text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"><i class="fa-solid fa-chevron-right text-xs"></i></button>
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
            <button onclick="analyzeSingleVideo(${index})" class="text-[10px] bg-[#111] text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-lg font-bold transition border border-[#222] flex items-center gap-1">
                <i class="fa-solid fa-chart-simple"></i> Phân Tích Nhanh
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

        <a href="${d.link}" target="_blank" class="w-full bg-[#111] hover:bg-white text-white hover:text-black border border-[#333] font-black py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm mt-6">
            <i class="fa-brands fa-tiktok text-lg"></i> Đi Đến TikTok
        </a>
    `;

    document.getElementById('detail-video-actions').innerHTML = isImagePost ? `
        <button onclick="downloadImages(${index}, this)" class="w-full col-span-2 bento-btn py-3.5 text-sm flex justify-center items-center gap-2">
            <i class="fa-solid fa-images"></i> Tải Trọn Bộ Ảnh Về
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

function closeDetailWindow(windowId) {
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
            stats: { 
                play: parseRawStats(v.play_count), 
                like: parseRawStats(v.digg_count), 
                comment: parseRawStats(v.comment_count), 
                share: parseRawStats(v.share_count), 
                download: parseRawStats(v.download_count || 0) 
            },
            urls: { cover: v.cover, no_watermark: v.play }, music: { playUrl: v.music, title: v.music_info?.title || "Âm thanh gốc" },
            images: v.images || null 
        }
    }));
}

// ================= CÁC TIẾN TRÌNH QUÉT MẠNG TỰ ĐỘNG =================
async function processVideos() {
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
        
        fetchedVideos = results.map(r => {
            if(r.data && r.data.stats) {
                r.data.stats.play = parseRawStats(r.data.stats.play);
                r.data.stats.like = parseRawStats(r.data.stats.like);
                r.data.stats.comment = parseRawStats(r.data.stats.comment);
                r.data.stats.share = parseRawStats(r.data.stats.share);
            }
            return r;
        });

        sortVideos(currentSortType);
    } catch (error) { showError("Lỗi: " + error.message); } 
    finally { showLoading(false); if(fetchBtn) fetchBtn.disabled = false; }
}

async function searchTikTok() {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw) return showError("Nhập từ khóa vô!");

    const searchBtn = document.getElementById('fetch-search-btn');
    clearResults();
    currentSearchKeyword = kw; searchCursor = 0;
    if(searchBtn) searchBtn.disabled = true;
    showLoading(true, "Quét kho dữ liệu tìm kiếm...");

    try {
        let hasMore = true;
        let loops = 0;
        
        while(hasMore && loops < 5) {
            const response = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=30`);
            const resData = await response.json();
            if (resData.code !== 0 || !resData.data?.videos?.length) break;
            
            const videos = resData.data.videos;
            searchCursor = resData.data.cursor;
            hasMore = resData.data.hasMore;
            
            let formattedResults = formatTikWmToGrid(videos);
            fetchedVideos.push(...formattedResults);
            loops++;
            
            document.getElementById('loading-text').innerText = `ĐANG TỰ ĐỘNG GOM TOÀN BỘ VIDEO... ĐÃ LẤY ${fetchedVideos.length} BÀI`;
        }
        
        if(fetchedVideos.length === 0) throw new Error("Không tìm thấy kết quả nào.");
        sortVideos(currentSortType);
    } catch (error) { showError(error.message); } 
    finally { showLoading(false); if(searchBtn) searchBtn.disabled = false; }
}

async function fetchUserInfo() {
    let user = document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return showError("Nhập ID vô mới quét được!");

    const infoBtn = document.getElementById('fetch-info-btn');
    clearResults();
    currentUserProfile = user;
    if(infoBtn) infoBtn.disabled = true;
    showLoading(true, "Đang cấu hình bản đồ kênh...");

    try {
        let hasMore = true;
        userVideoCursor = 0;
        let isFirstPage = true;

        while(hasMore) {
            const response = await fetch(`/api/index?username=${user}&cursor=${userVideoCursor}`);
            const data = await response.json();
            if (data.status !== "Live") throw new Error(data.error || "Mục tiêu không tồn tại.");

            if (isFirstPage) {
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
                            
                            <p id="channel-bio-text" class="mt-4 text-zinc-400 text-sm max-w-xl mx-auto min-h-[40px]"></p>
                            ${u.bioLink ? `<a href="${u.bioLink}" target="_blank" class="inline-flex mt-4 items-center justify-center gap-2 text-blue-400 text-[11px] bg-[#0a0a0a] px-4 py-2.5 rounded-lg border border-[#222] break-all w-full max-w-sm mx-auto shadow-sm hover:border-blue-500/50 hover:bg-[#111] transition-all"><i class="fa-solid fa-link text-zinc-500"></i> <span class="truncate">${u.bioLink}</span></a>` : ''}
                            
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

                setTimeout(() => {
                    const bioEl = document.getElementById('channel-bio-text');
                    if(bioEl) typeWriter(bioEl, u.signature || 'Chưa có tiểu sử.', 25);
                }, 100);
                isFirstPage = false;
            }

            if (data.videos && data.videos.length > 0) {
                let formattedResults = data.videos.map(v => ({
                    link: v.link,
                    data: {
                        status: "Live",
                        author: { uniqueId: user, nickname: fullUserData.author.nickname || user, avatar: fullUserData.author.avatar || "", verified: fullUserData.author.verified || false },
                        video_data: { id: v.id, description: v.caption, create_time: v.createTime || null },
                        stats: { play: parseRawStats(v.stats.play), like: parseRawStats(v.stats.like), comment: parseRawStats(v.stats.comment), share: parseRawStats(v.stats.share) }, 
                        urls: v.urls, music: v.music, images: v.images || null
                    }
                }));
                fetchedVideos.push(...formattedResults);
            }
            userVideoCursor = data.cursor;
            hasMore = data.hasMore;
            
            document.getElementById('loading-text').innerText = `VÉT SẠCH KÊNH HÀNG LOẠT: ĐẠT MỐC CHẠM ${fetchedVideos.length} VIDEO`;
        }

        sortVideos(currentSortType);
    } catch (error) { showError(error.message); } 
    finally { showLoading(false); if(infoBtn) infoBtn.disabled = false; }
}

async function searchRandom() {
    if(fetchedVideos.length === 0) return;
    
    const searchBtn = document.getElementById('fetch-search-btn');
    if(searchBtn) searchBtn.disabled = true;

    showLoading(true, "Đang chắt lọc ngẫu nhiên...");
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
            
            const specialAction = document.getElementById('special-action-container');
            if(specialAction) {
                specialAction.innerHTML = `
                    <button onclick="searchRandom()" class="px-5 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-sm shadow-md transition-colors hover:bg-zinc-700 flex items-center gap-2">
                        <i class="fa-solid fa-dice"></i> Random Khác
                    </button>
                `;
                specialAction.classList.remove('hidden');
                specialAction.classList.add('flex');
            }
        }
    } catch (error) { showError(error.message); } 
    finally { showLoading(false); if(searchBtn) searchBtn.disabled = false; }
}

// ================= RENDER CARD VIDEO (HIỆU ỨNG TRƯỢT 2 BÊN XEN KẼ) =================
function renderVideoCards(results, append = false, startIndex = 0, keepActionUI = false) {
    requestAnimationFrame(() => {
        const container = document.getElementById('result-area');
        let html = '';

        if (!keepActionUI) {
            const specialAction = document.getElementById('special-action-container');
            if(specialAction) {
                if (fetchedVideos.length > 1 && currentMode !== 'video') {
                    specialAction.innerHTML = `
                        <div class="flex items-center gap-1 bg-[#111] border border-[#222] p-1.5 rounded-xl">
                            <button id="sort-latest-btn" onclick="sortVideos('latest')" class="px-4 py-2 rounded-lg ${currentSortType === 'latest' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition"><i class="fa-solid fa-bars"></i> Mới Nhất</button>
                            <button id="sort-popular-btn" onclick="sortVideos('popular')" class="px-4 py-2 rounded-lg ${currentSortType === 'popular' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition"><i class="fa-solid fa-fire"></i> Phổ Biến</button>
                        </div>
                        ${currentMode === 'search' ? `<button onclick="searchRandom()" class="px-4 py-2.5 rounded-xl bg-[#1a1a1a] text-zinc-300 border border-[#333] font-bold text-xs hover:bg-white hover:text-black transition flex items-center gap-2 ml-2"><i class="fa-solid fa-dice"></i> Lấy Ngẫu Nhiên</button>` : ''}
                    `;
                    specialAction.classList.remove('hidden');
                    specialAction.classList.add('flex');
                } else if (currentMode === 'video' && linkMode === 'multi' && fetchedVideos.length > 1) {
                    specialAction.innerHTML = `
                        <button onclick="downloadAllVideos(this)" class="bg-[#111] text-white font-bold py-2.5 px-5 rounded-lg border border-[#222] shadow-md transition-colors hover:bg-blue-600 hover:border-blue-500 flex items-center gap-2 text-sm">
                            <i class="fa-solid fa-download"></i> Tải Tất Cả
                        </button>
                    `;
                    specialAction.classList.remove('hidden');
                    specialAction.classList.add('flex');
                } else {
                    specialAction.classList.add('hidden');
                }
            }
        }

        if (!append) {
            container.innerHTML = '';
            if (results.length === 1) container.className = "w-full max-w-[340px] mx-auto z-10 mt-6 pb-8";
            else container.className = "w-full max-w-[98%] xl:max-w-6xl mx-auto z-10 mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 pb-8";
        }

        results.forEach((item, index) => {
            if (item.error || item.data.status !== "Live") return;
            const d = item.data;
            const currentIndex = startIndex + index; 
            
            // Hiệu ứng trượt trái / trượt phải xen kẽ chuẩn bento
            const animClass = (index % 2 === 0) ? 'animate-slide-left' : 'animate-slide-right';
            
            const mediaTypeBadge = (d.images && d.images.length > 0) 
                ? `<div class="absolute top-2 left-2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
                : '';

            html += `
                <div class="grid-item w-full aspect-[3/4] ${animClass}" onclick="openVideoDetail(${currentIndex})" style="animation-delay: ${(index % 10) * 0.05}s">
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

// ================= EXPOSE TẤT CẢ HÀM RA GLOBAL (CẦN CHO onclick TRONG HTML) =================
window.switchTab = switchTab;
window.setLinkMode = setLinkMode;
window.openGuide = openGuide;
window.loadMore = loadMore;
window.toggleExpand = toggleExpand;
window.sortVideos = sortVideos;
window.processVideos = processVideos;
window.searchTikTok = searchTikTok;
window.searchRandom = searchRandom;
window.fetchUserInfo = fetchUserInfo;
window.fetchAnalytics = fetchAnalytics;
window.openVideoDetail = openVideoDetail;
window.closeDetailWindow = closeDetailWindow;
window.analyzeSingleVideo = analyzeSingleVideo;
window.searchUserFromDetail = searchUserFromDetail;
window.forceDownload = forceDownload;
window.downloadImages = downloadImages;
window.downloadAllVideos = downloadAllVideos;
window.formatStatsClient = formatStatsClient;
