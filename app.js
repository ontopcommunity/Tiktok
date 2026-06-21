// TRẠNG THÁI TOÀN CỤC KHÔNG ĐỔI
let currentMode = 'video';
let linkMode = 'single'; 
let fetchedVideos = []; 
let currentSearchKeyword = "";
let searchCursor = 0;

let currentUserProfile = "";
let userVideoCursor = 0;
let fullUserData = null;
let currentSortType = 'latest'; 

// ================= HÀM XỬ LÝ CHUỖI SỐ LIỆU CHUẨN XÁC =================
window.parseRawStats = function(str) {
    if (str === null || str === undefined) return 0;
    if (typeof str === 'number') return str;
    let s = str.toString().toUpperCase().replace(/,/g, '.');
    let multi = 1;
    if (s.includes('K')) multi = 1000;
    if (s.includes('M')) multi = 1000000;
    if (s.includes('B')) multi = 1000000000;
    const parsed = parseFloat(s.replace(/[KMB\s]/g, ''));
    return isNaN(parsed) ? 0 : parsed * multi;
};

window.formatStatsClient = function(num) {
    let rawNum = window.parseRawStats(num);
    if (rawNum === 0) return "0";
    if (rawNum < 1000) return rawNum.toString();
    if (rawNum < 1000000) return (Math.floor(rawNum / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(rawNum / 100000) / 10).toString().replace('.', ',') + "M";
};

// ================= HÀM ĐIỀU HƯỚNG GIAO DIỆN =================
window.switchTab = function(mode) {
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

window.setLinkMode = function(mode) {
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

window.showLoading = function(show, text = "Đang xử lý...") {
    const loader = document.getElementById('loading');
    if(loader) {
        document.getElementById('loading-text').innerText = text;
        show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
    }
}

window.showError = function(msg) {
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

window.clearResults = function() {
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

window.generateFileName = function(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

window.toggleExpand = function(id) {
    const box = document.getElementById(id);
    if(box) box.classList.toggle('expanded');
}

window.openGuide = function() { 
    const guide = document.getElementById('guide-window');
    if(guide) guide.classList.add('active'); 
}

// HIỆU ỨNG GÕ CHỮ BIO MƯỢT MÀ
window.typeWriter = function(element, text, speed=25) {
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
};

// SẮP XẾP BÀI ĐĂNG
window.sortVideos = function(type) {
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
    window.renderVideoCards(fetchedVideos, false, 0, false);
}

// ================= PHÂN TÍCH CHUYÊN SÂU 1 KÊNH (1 GIÂY GOM ĐÚNG MỐC 200 VIDEO) =================
window.fetchAnalytics = async function() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return window.showError("Nhập ID kênh cần phân tích!");

    const analyticsBtn = document.getElementById('fetch-analytics-btn');
    window.clearResults();
    currentMode = 'analytics';
    if(analyticsBtn) analyticsBtn.disabled = true;
    window.showLoading(true, "Đang kết nối kho tệp hệ thống...");

    try {
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let limitPages = 0; 
        
        let videosInCurrentSecond = 0; // Đếm số video tích lũy trong giây hiện tại

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
            
            // LỆNH SỐ 5: Mỗi lần gom chạm mốc 200 video, cưỡng bức dừng chuẩn 1 giây để khớp nhịp độ
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
            totalPlays += window.parseRawStats(v.stats.play);
            totalLikes += window.parseRawStats(v.stats.like);
            totalComments += window.parseRawStats(v.stats.comment);
            totalShares += window.parseRawStats(v.stats.share);

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
                rawPlay: window.parseRawStats(v.stats.play)
            }
        }));

        fetchedVideos = formattedResults;
        window.sortVideos('popular'); 

    } catch (error) { window.showError(error.message); } 
    finally { window.showLoading(false); if(analyticsBtn) analyticsBtn.disabled = false; }
}

// ================= PHÂN TÍCH TỪNG MỤC LIST CHI TIẾT BÊN TRONG CARD =================
window.analyzeSingleVideo = function(index) {
    const d = fetchedVideos[index].data;
    const play = window.parseRawStats(d.stats.play);
    const likes = window.parseRawStats(d.stats.like);
    const comments = window.parseRawStats(d.stats.comment);
    const shares = window.parseRawStats(d.stats.share);
    const downloads = window.parseRawStats(d.stats.download || 0);
    
    const er = play > 0 ? (((likes + comments + shares + downloads) / play) * 100).toFixed(2) : 0;
    const likeRatio = play > 0 ? ((likes / play) * 100).toFixed(1) : 0;
    
    const timestamp = d.video_data.create_time || d.video_data.createTime || null;
    let uploadDate = "Không xác định";
    if (timestamp) {
        uploadDate = new Date(timestamp * 1000).toLocaleString('vi-VN');
    }

    const typeStr = (d.images && d.images.length > 0) ? `<i class="fa-solid fa-images text-emerald-400"></i> Nhật Ký / Album Ảnh (${d.images.length} tệp)` : `<i class="fa-solid fa-video text-sky-400"></i> Video Gốc`;
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
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-file-code text-emerald-400 w-4"></i> Loại Bài Đăng:</span>
                <span class="text-white font-bold text-xs">${typeStr}</span>
            </div>
            <div class="bg-[#111] p-4 rounded-xl border border-[#222] flex justify-between items-center transition hover:border-[#333]">
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-clock text-orange-400 w-4"></i> Khởi TạoChuẩn:</span>
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
                <span class="text-zinc-400 font-bold text-xs"><i class="fa-solid fa-download text-zinc-400 w-4"></i> Đã Lưu:</span>
                <span class="text-white font-bold text-xs">${window.formatStatsClient(downloads)}</span>
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

window.openVideoDetail = function(index) {
    const d = fetchedVideos[index].data;
    const fileNameMp4 = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fileNameMp3 = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
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
                <span class="text-white text-sm font-bold">${window.formatStatsClient(d.stats.play)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">View</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${window.formatStatsClient(d.stats.like)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Tim</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${window.formatStatsClient(d.stats.comment)}</span>
                <span class="text-[9px] text-zinc-500 uppercase font-bold">Cmt</span>
            </div>
            <div class="bg-[#111] border border-[#222] py-3 rounded-2xl flex flex-col items-center gap-1">
                <span class="text-white text-sm font-bold">${window.formatStatsClient(d.stats.share)}</span>
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
</script>
</body>
</html>
