// ================= TRẠNG THÁI TOÀN CỤC =================
window.currentMode = 'video';
window.linkMode = 'single'; 
window.fetchedVideos = []; 
window.currentSortType = 'latest'; 

window.currentSearchKeyword = '';
window.searchCursor = 0;
window.searchHasMore = false;
window.isLoadingMore = false;

window.currentUserProfile = '';
window.userVideoCursor = 0;
window.userHasMore = false;
window.fullUserData = null;

window.currentVideoPlayer = null; 
window.feedObserver = null;
window.scrollObserver = null;

// PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-app-btn')?.classList.remove('hidden');
});

window.installWebApp = function() {
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

// ================= UTILS BÓC TÁCH SỐ LIỆU CHỐNG LỖI 100% =================
window.parseRawStats = function(str) {
    if (str == null) return 0;
    if (typeof str === 'number') return str;
    let s = str.toString().toUpperCase().replace(/,/g, '.');
    let multi = 1;
    if (s.includes('K')) multi = 1000;
    if (s.includes('M')) multi = 1000000;
    if (s.includes('B')) multi = 1000000000;
    const parsed = parseFloat(s.replace(/[KMB\s]/g, ''));
    return isNaN(parsed) ? 0 : parsed * multi;
}

window.formatStatsClient = function(num) {
    let rawNum = window.parseRawStats(num);
    if (rawNum === 0) return "0";
    if (rawNum < 1000) return rawNum.toString();
    if (rawNum < 1000000) return (Math.floor(rawNum / 100) / 10).toString().replace('.', ',') + "K";
    return (Math.floor(rawNum / 100000) / 10).toString().replace('.', ',') + "M";
}

// ================= UNIVERSAL MAPPER (BẢO VỆ UNDEFINED AVATAR VÀ ẢNH LỖI) =================
window.universalVideoMapper = function(videosArray, fallbackAuthor = null) {
    return videosArray.map(v => {
        // Bọc thép đối tượng Author: Nếu v.author null, lấy fallback, nếu fallback null thì tạo object rỗng
        const a = v.author || fallbackAuthor || {};
        const uId = a.unique_id || a.uniqueId || 'user';
        const vId = v.video_id || v.id || '';
        
        // Bọc thép Avatar: Thử 3 nguồn, nếu vẫn chết thì xài ảnh random tạo từ tên uniqueId
        const avatar = a.avatar || a.avatarLarger || v.cover || `https://ui-avatars.com/api/?name=${uId}&background=random`;
        
        // Bọc thép Ảnh Cover
        const cover = v.cover || v.origin_cover || v.video?.cover || v.video?.origin_cover || '';

        return {
            link: v.link || `https://www.tiktok.com/@${uId}/video/${vId}`,
            data: {
                status: "Live",
                author: { 
                    uniqueId: uId, 
                    nickname: a.nickname || uId, 
                    avatar: avatar, 
                    verified: a.is_verify || a.verified || false 
                },
                video_data: { 
                    id: vId, 
                    description: v.title || v.caption || v.desc || '', 
                    create_time: v.create_time || v.createTime || 0, 
                    duration: v.duration || 0, 
                    region: v.region || 'VN' 
                }, 
                stats: { 
                    play: window.parseRawStats(v.play_count || v.stats?.play || v.stats?.playCount), 
                    like: window.parseRawStats(v.digg_count || v.stats?.like || v.stats?.diggCount), 
                    comment: window.parseRawStats(v.comment_count || v.stats?.comment || v.stats?.commentCount), 
                    share: window.parseRawStats(v.share_count || v.stats?.share || v.stats?.shareCount), 
                    download: window.parseRawStats(v.download_count || v.stats?.download || 0) 
                },
                urls: { 
                    cover: cover, 
                    no_watermark: v.hdplay || v.play || v.urls?.no_watermark || v.video?.playAddr 
                }, 
                music: { playUrl: v.music?.playUrl || v.music, title: v.music_info?.title || v.music?.title || "Âm thanh gốc" },
                images: v.images || null 
            }
        };
    });
}

// ================= ĐIỀU HƯỚNG TAB =================
window.switchTab = function(mode) {
    window.currentMode = mode;
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        const tabBtn = document.getElementById(`tab-${m}`);
        if(btn && tabBtn) {
            btn.classList.toggle('hidden', m !== mode);
            tabBtn.className = (m === mode) ? 'tab-btn tab-active' : 'tab-btn tab-inactive';
        }
    });
    window.clearResults();
}

window.setLinkMode = function(mode) {
    window.linkMode = mode;
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

window.setSkeletonState = function(isActive, isChannel = false, loadingText = "Đang quét dữ liệu...") {
    const skelArea = document.getElementById('skeleton-area');
    const skelProfile = document.getElementById('skel-profile');
    const txt = document.getElementById('loading-text');
    const resArea = document.getElementById('result-area');
    const errorBox = document.getElementById('error-msg');
    
    if(errorBox) errorBox.classList.add('hidden');

    if (isActive) {
        if(skelArea) skelArea.classList.remove('hidden');
        if(txt) txt.innerText = loadingText;
        if (isChannel) {
            if(skelProfile) skelProfile.classList.remove('hidden');
            if(resArea) resArea.innerHTML = '';
        } else {
            if(skelProfile) skelProfile.classList.add('hidden');
            if(resArea) resArea.innerHTML = ''; 
        }
    } else {
        if(skelArea) skelArea.classList.add('hidden');
    }
}

window.showError = function(msg) {
    const errEl = document.getElementById('error-msg');
    if(errEl) {
        if(msg) {
            errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${msg}`;
            errEl.classList.remove('hidden');
            const resArea = document.getElementById('result-area');
            if(resArea) resArea.innerHTML = '';
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
    
    window.setSkeletonState(false);
    window.showError('');
    window.fetchedVideos = [];
    window.currentSortType = 'latest'; 
    window.stopScrollObserver();
}

window.generateFileName = function(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

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
}

// LOGIC SẮP XẾP LƯỚI
window.sortVideos = function(type) {
    if(!window.fetchedVideos || window.fetchedVideos.length === 0) return;
    window.currentSortType = type;
    
    if (type === 'popular') {
        window.fetchedVideos.sort((a, b) => b.data.stats.play - a.data.stats.play);
    } else {
        window.fetchedVideos.sort((a, b) => {
            let tA = a.data.video_data.create_time || 0;
            let tB = b.data.video_data.create_time || 0;
            return tB - tA;
        });
    }
    
    window.renderVideoCards(window.fetchedVideos, false, 0);
    
    const playerModal = document.getElementById('tk-player-modal');
    if(playerModal && playerModal.classList.contains('active')) {
        const scroller = document.getElementById('tk-feed-scroller');
        if(scroller) {
            scroller.innerHTML = window.fetchedVideos.map((v, i) => window.createFeedSlideHTML(v, i)).join('');
            document.getElementById(`feed-item-0`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
            window.reObserveFeed();
        }
    }
}

// ================= API FETCHING =================
window.processVideos = async function() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return window.showError("Dán link vô đi nào!");
    
    window.clearResults();
    window.setSkeletonState(true, false, "Đang cào dữ liệu tĩnh...");

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        results = results.filter(r => r.data && r.data.status === "Live");
        
        window.fetchedVideos = window.universalVideoMapper(results.map(r => r.data));

        if(window.fetchedVideos.length === 0) throw new Error("Video bị riêng tư hoặc sai link.");
        window.setSkeletonState(false);
        window.sortVideos(window.currentSortType);
    } catch (error) { window.setSkeletonState(false); window.showError(error.message); } 
}

// TÌM KIẾM
window.searchTikTok = async function(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return window.showError("Nhập từ khóa vô!");

    if(!isLoadMore) {
        window.clearResults();
        window.currentSearchKeyword = kw; 
        window.searchCursor = 0;
        window.setSkeletonState(true, false, "Đang truy xuất mạng lưới...");
    }

    if(window.isLoadingMore) return;
    window.isLoadingMore = true;
    if(isLoadMore) document.getElementById('load-more-indicator')?.classList.remove('hidden');

    try {
        const response = await fetch(`/api/search?keywords=${encodeURIComponent(window.currentSearchKeyword)}&cursor=${window.searchCursor}&count=30`);
        const resData = await response.json();
        
        if (resData.code !== 0 || !resData.data?.videos?.length) {
            if(!isLoadMore) throw new Error("Không tìm thấy kết quả nào.");
            window.searchHasMore = false;
        } else {
            const videos = resData.data.videos;
            window.searchCursor = resData.data.cursor;
            window.searchHasMore = resData.data.hasMore;
            
            let formattedResults = window.universalVideoMapper(videos);
            const startIndex = window.fetchedVideos.length;
            window.fetchedVideos.push(...formattedResults);
            
            if(!isLoadMore) {
                window.setSkeletonState(false);
                window.sortVideos(window.currentSortType);
                window.startScrollObserver();
            } else {
                window.appendVideoCards(formattedResults, startIndex);
            }
        }
    } catch (error) { if(!isLoadMore) { window.setSkeletonState(false); window.showError(error.message); } } 
    finally { 
        window.isLoadingMore = false; 
        document.getElementById('load-more-indicator')?.classList.add('hidden'); 
    }
}

// SOI KÊNH
window.fetchUserInfo = async function(isLoadMore = false) {
    let user = isLoadMore ? window.currentUserProfile : document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return window.showError("Nhập ID vô mới quét được!");

    if(!isLoadMore) {
        window.clearResults();
        window.currentUserProfile = user;
        window.setSkeletonState(true, true, "Đang nạp hồ sơ...");
    }

    if(window.isLoadingMore) return;
    window.isLoadingMore = true;
    if(isLoadMore) document.getElementById('load-more-indicator')?.classList.remove('hidden');

    try {
        const response = await fetch(`/api/index?username=${user}&cursor=${window.userVideoCursor}`);
        const data = await response.json();
        if (data.status !== "Live") throw new Error(data.error || "Kênh không tồn tại.");

        if (!isLoadMore) {
            // Bọc thép lỗi không có author
            const u = data.author || {};
            window.fullUserData = { author: u, stats_formatted: data.stats_formatted || {} };
            const s = window.fullUserData.stats_formatted;
            
            const safeAvatar = u.avatar || u.avatarLarger || `https://ui-avatars.com/api/?name=${u.uniqueId||user}&background=random`;
            const safeNickname = u.nickname || u.uniqueId || user;
            const safeUniqueId = u.uniqueId || user;
            
            const container = document.getElementById('user-info-area');
            container.innerHTML = `
                <div class="w-full bento-card p-6 md:p-8 animate-slide-up">
                    <div class="text-center">
                        <img src="${safeAvatar}" class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-[#222] bg-[#0a0a0a]" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${safeUniqueId}&background=random'">
                        <h2 class="text-xl font-bold mt-4 text-white flex items-center justify-center gap-1">
                            ${safeNickname} 
                            ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>' : ''}
                        </h2>
                        <p class="text-zinc-500 font-medium text-xs mt-1">@${safeUniqueId}</p>
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
            setTimeout(() => { window.typeWriter(document.getElementById('channel-bio-text'), u.signature || 'Chưa có tiểu sử.', 25); }, 100);
            
            window.setSkeletonState(false);
            window.startScrollObserver();
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = window.universalVideoMapper(data.videos, window.fullUserData?.author);
            const startIndex = window.fetchedVideos.length;
            window.fetchedVideos.push(...formattedResults);
            
            if (!isLoadMore) {
                window.sortVideos(window.currentSortType);
            } else {
                window.appendVideoCards(formattedResults, startIndex);
            }
        }
        window.userVideoCursor = data.cursor;
        window.userHasMore = data.hasMore;

    } catch (error) { if(!isLoadMore) { window.setSkeletonState(false); window.showError(error.message); } } 
    finally { window.isLoadingMore = false; document.getElementById('load-more-indicator')?.classList.add('hidden'); }
}

// PHÂN TÍCH KÊNH 100%
window.fetchAnalytics = async function() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return window.showError("Nhập ID kênh cần phân tích!");

    window.clearResults();
    window.currentMode = 'analytics';
    window.setSkeletonState(true, true, "Đang khởi chạy cỗ máy vét 100% video...");

    try {
        let allVideos = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let videosInCurrentSecond = 0;

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
            
            document.getElementById('loading-text').innerText = `XUNG NHỊP QUÉT: ĐÃ THU GOM ĐƯỢC ${allVideos.length} BÀI ĐĂNG TỪ MÁY CHỦ...`;
            
            if (videosInCurrentSecond >= 200) {
                await new Promise(r => setTimeout(r, 1000));
                videosInCurrentSecond = 0;
            }
        }

        if (allVideos.length === 0) throw new Error("Kênh trống hoặc bị riêng tư.");

        let totalPlays = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
        let hashtagCounts = {};

        const parsedVideos = window.universalVideoMapper(allVideos, pAuthor);

        parsedVideos.forEach(item => {
            const v = item.data;
            totalPlays += v.stats.play;
            totalLikes += v.stats.like;
            totalComments += v.stats.comment;
            totalShares += v.stats.share;

            let tags = (v.video_data.description || "").match(/#[\w_À-ỹ]+/g);
            if(tags) tags.forEach(t => { let ct = t.toLowerCase(); hashtagCounts[ct] = (hashtagCounts[ct] || 0) + 1; });
        });

        parsedVideos.sort((a,b) => (b.data.video_data.create_time||0) - (a.data.video_data.create_time||0));
        let newestVid = parsedVideos[0];
        let oldestVid = parsedVideos[parsedVideos.length - 1];
        let createDate = oldestVid && oldestVid.data.video_data.create_time ? new Date(oldestVid.data.video_data.create_time * 1000).toLocaleDateString('vi-VN') : 'Không rõ';

        const avgViews = (totalPlays / parsedVideos.length);
        const er = totalPlays > 0 ? (((totalLikes + totalComments + totalShares) / totalPlays) * 100).toFixed(2) : 0;
        
        let sortedTags = Object.entries(hashtagCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        let tagsHtml = sortedTags.length > 0 
            ? sortedTags.map(t => `<span class="bg-[#0d0d0d] border border-[#222] text-cyan-400 px-3 py-1.5 rounded-xl text-xs font-bold">${t[0]} <span class="text-zinc-600 ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-zinc-600 text-sm italic">Không dùng Hashtag</span>';

        // Bảo vệ hiển thị profile
        const safeAvatar = pAuthor?.avatar || pAuthor?.avatarLarger || `https://ui-avatars.com/api/?name=${user}&background=random`;
        const safeNickname = pAuthor?.nickname || user;

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full bento-card p-6 md:p-8 animate-slide-up relative">
                <div class="flex items-center gap-4 mb-8 pb-6 border-b border-[#222]">
                    <img src="${safeAvatar}" class="w-16 h-16 rounded-full object-cover border border-[#333] bg-black" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${user}&background=random'">
                    <div>
                        <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">${safeNickname}</h2>
                        <p class="text-cyan-400 font-medium text-sm">Báo cáo Phân tích từ 100% (${parsedVideos.length}) bài đăng</p>
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
                        <span class="text-xl font-black text-white">${window.formatStatsClient(avgViews)}</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">View TB Toàn Kênh</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-percent text-cyan-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${er}%</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Tỷ lệ ER Thực Tế</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-heart text-violet-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${window.formatStatsClient(totalLikes / parsedVideos.length)}</span>
                        <span class="text-[10px] text-zinc-500 uppercase mt-1 font-bold">Tim TB Toàn Kênh</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#222] p-5 rounded-[20px] flex flex-col items-center justify-center">
                        <i class="fa-solid fa-play text-emerald-500 text-xl mb-2"></i>
                        <span class="text-xl font-black text-white">${window.formatStatsClient(totalPlays)}</span>
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

        window.fetchedVideos = parsedVideos;
        window.setSkeletonState(false);
        window.sortVideos('popular'); 
    } catch (error) { window.setSkeletonState(false); window.showError(error.message); } 
}

// ================= RENDER LƯỚI & SẮP XẾP CUỘN NGANG =================
window.renderVideoCards = function(results, append = false, startIndex = 0) {
    const container = document.getElementById('result-area');
    const specialAction = document.getElementById('special-action-container');
    
    if(specialAction && !append) {
        if (window.fetchedVideos.length > 1 && window.currentMode !== 'video') {
            specialAction.innerHTML = `
                <div class="flex items-center gap-1.5 bg-[#111] border border-[#222] p-1.5 rounded-2xl overflow-x-auto scrollbar-hide max-w-full">
                    <button onclick="window.sortVideos('latest')" class="px-4 py-2.5 rounded-xl ${window.currentSortType === 'latest' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition shrink-0"><i class="fa-solid fa-bars"></i> Mới Nhất</button>
                    <button onclick="window.sortVideos('popular')" class="px-4 py-2.5 rounded-xl ${window.currentSortType === 'popular' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white'} font-bold text-xs flex items-center gap-2 transition shrink-0"><i class="fa-solid fa-fire"></i> Phổ Biến</button>
                    ${window.currentMode === 'search' ? `<button onclick="window.searchRandom()" class="px-4 py-2.5 rounded-xl bg-[#1a1a1a] text-zinc-300 border border-[#333] font-bold text-xs hover:bg-white hover:text-black transition flex items-center gap-2 shrink-0 ml-1"><i class="fa-solid fa-dice"></i> Ngẫu Nhiên</button>` : ''}
                </div>
            `;
            specialAction.classList.remove('hidden');
            specialAction.classList.add('flex');
        } else if (window.currentMode === 'video' && window.linkMode === 'multi' && window.fetchedVideos.length > 1) {
            specialAction.innerHTML = `
                <button onclick="window.downloadAllVideos(this)" class="px-5 py-3 rounded-xl bg-[#111] text-white font-bold text-xs hover:bg-blue-600 border border-[#222] transition shadow-md flex items-center gap-2"><i class="fa-solid fa-download"></i> Tải Tất Cả Tệp Media</button>
            `;
            specialAction.classList.remove('hidden');
            specialAction.classList.add('flex');
        } else {
            specialAction.classList.add('hidden');
        }
    }

    if (!append) container.innerHTML = '';
    
    const renderLimit = window.currentMode === 'analytics' && !append ? results.slice(0, 100) : results;

    let html = '';
    renderLimit.forEach((item, index) => {
        if (item.error || item.data.status !== "Live") return;
        const d = item.data;
        const currentIndex = startIndex + index; 
        
        const animClass = (index % 2 === 0) ? 'animate-slide-left' : 'animate-slide-right';
        const mediaTypeBadge = (d.images && d.images.length > 0) 
            ? `<div class="absolute top-2 left-2 bg-white/90 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
            : '';

        // Thêm bắt lỗi ảnh Thumbnail bằng placeholder xám
        html += `
            <div class="grid-item w-full ${animClass}" onclick="window.openVideoDetail(${currentIndex})" style="animation-delay: ${(index % 10) * 0.04}s">
                <img src="${d.urls.cover}" class="thumb absolute inset-0 w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/400x600/111/444?text=Không+thể+tải+ảnh'">
                ${mediaTypeBadge}
                <div class="absolute top-2 right-2 bg-black/80 backdrop-blur border border-zinc-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20 flex items-center gap-1">
                    <i class="fa-solid fa-play text-blue-400"></i> ${window.formatStatsClient(d.stats.play)}
                </div>
                <div class="absolute inset-0 overlay-gradient z-10 flex flex-col justify-end p-3 pointer-events-none">
                    <div class="flex items-center gap-2 mb-1.5">
                        <img src="${d.author.avatar}" class="w-6 h-6 rounded-full object-cover border border-zinc-600 bg-black shrink-0" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${d.author.uniqueId}&background=random'">
                        <span class="text-white font-semibold text-[11px] truncate shadow-sm">${d.author.nickname}</span>
                    </div>
                    <div class="flex gap-2 text-[9.5px] font-bold text-zinc-300">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-white"></i> ${window.formatStatsClient(d.stats.like)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    if (append) container.insertAdjacentHTML('beforeend', html);
    else container.innerHTML = html;
}

window.appendVideoCards = function(newItems, startIndex) {
    window.renderVideoCards(newItems, true, startIndex);
    
    const scroller = document.getElementById('tk-feed-scroller');
    if(scroller && document.getElementById('tk-player-modal').classList.contains('active')) {
        const slidesHtml = newItems.map((v, i) => window.createFeedSlideHTML(v, startIndex + i)).join('');
        scroller.insertAdjacentHTML('beforeend', slidesHtml);
        window.reObserveFeed();
    }
}

// ================= INFINITE SCROLL OBSERVER (TỰ ĐỘNG LOAD THÊM NGẦM) =================
window.startScrollObserver = function() {
    if(window.scrollObserver) window.scrollObserver.disconnect();
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    
    window.scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            if (window.currentMode === 'search' && window.searchHasMore) window.searchTikTok(true);
            else if (window.currentMode === 'info' && window.userHasMore) window.fetchUserInfo(true);
        }
    }, { rootMargin: '300px' });
    
    window.scrollObserver.observe(sentinel);
}

window.stopScrollObserver = function() {
    if (window.scrollObserver) { window.scrollObserver.disconnect(); window.scrollObserver = null; }
}

// ================= TIKTOK PLAYER VERTICAL FEED =================
window.createFeedSlideHTML = function(item, index) {
    const d = item.data;
    const isImg = d.images && d.images.length > 0;
    
    const sidebar = `
        <div class="tk-sidebar" onclick="event.stopPropagation()">
            <div class="tk-avatar-wrap" onclick="window.searchUserFromDetail('${d.author.uniqueId}')">
                <img src="${d.author.avatar}" class="tk-avatar" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${d.author.uniqueId}&background=random'">
                <div class="tk-plus-btn"><i class="fa-solid fa-plus text-[10px]"></i></div>
            </div>
            <div class="tk-icon-wrap"><i class="fa-solid fa-heart tk-icon"></i><span class="text-[11px] font-bold mt-1 text-shadow">${window.formatStatsClient(d.stats.like)}</span></div>
            <div class="tk-icon-wrap"><i class="fa-solid fa-comment-dots tk-icon"></i><span class="text-[11px] font-bold mt-1 text-shadow">${window.formatStatsClient(d.stats.comment)}</span></div>
            <div class="tk-icon-wrap"><i class="fa-solid fa-bookmark tk-icon"></i><span class="text-[11px] font-bold mt-1 text-shadow">${window.formatStatsClient(d.stats.download||0)}</span></div>
            
            <!-- SHARE: Mở Sheet Liên Kết -->
            <div class="tk-icon-wrap" onclick="window.openShareSheet(${index}, event)">
                <i class="fa-solid fa-share tk-icon"></i>
                <span class="text-[11px] font-bold mt-1 text-shadow">${window.formatStatsClient(d.stats.share)}</span>
            </div>
            
            <div class="tk-icon-wrap mt-2" onclick="window.openAnalyticsSheet(${index}, event)">
                <div class="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                    <i class="fa-solid fa-ellipsis text-white text-xl"></i>
                </div>
            </div>

            <div class="tk-vinyl-record mt-1">
                <i class="fa-solid fa-music text-[10px] text-zinc-400"></i>
            </div>
        </div>
    `;

    const info = `
        <div class="tk-bottom-info" onclick="event.stopPropagation()">
            <h3 class="tk-username" onclick="window.searchUserFromDetail('${d.author.uniqueId}')">@${d.author.uniqueId}</h3>
            <p class="tk-caption">${(d.video_data.description||'').replace(/</g,'&lt;')}</p>
            <div class="tk-music-ticker">
                <i class="fa-solid fa-music text-[10px]"></i>
                <div class="tk-marquee-container"><span class="tk-marquee">${d.music?.title || 'Âm thanh gốc'}</span></div>
            </div>
        </div>
    `;

    let media = '';
    if (isImg) {
        const slides = d.images.map((img, i) => `
            <div class="tk-slide">
                <img src="${img}" referrerpolicy="no-referrer">
                <span class="absolute top-[80px] right-4 bg-black/60 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">${i+1}/${d.images.length}</span>
            </div>
        `).join('');
        media = `
            <div id="tk-img-scroller-${index}" class="tk-image-scroller" onclick="event.stopPropagation()">${slides}</div>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller-${index}'); c.scrollBy({left: -c.clientWidth, behavior: 'smooth'})" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition z-20"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller-${index}'); c.scrollBy({left: c.clientWidth, behavior: 'smooth'})" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition z-20"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        `;
    } else {
        media = `<video data-src="${d.urls.no_watermark}" poster="${d.urls.cover}" loop playsinline class="w-full h-full object-cover"></video>`;
    }

    return `
        <div class="tk-feed-item" data-index="${index}" id="feed-item-${index}" onclick="window.togglePlayPause(${index})">
            ${media}
            <div id="tk-pause-${index}" class="tk-pause-icon">
                <i class="fa-solid fa-play text-white opacity-80" style="font-size: 65px; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
            </div>
            ${sidebar}
            ${info}
        </div>
    `;
}

window.openVideoDetail = function(startIndex) {
    const scroller = document.getElementById('tk-feed-scroller');
    
    let toRender = window.fetchedVideos;
    if(window.fetchedVideos.length > 100) {
        let start = Math.max(0, startIndex - 10);
        let end = Math.min(window.fetchedVideos.length, startIndex + 20);
        toRender = window.fetchedVideos.slice(start, end);
        scroller.innerHTML = toRender.map((v, i) => window.createFeedSlideHTML(v, start + i)).join('');
    } else {
        scroller.innerHTML = window.fetchedVideos.map((v, i) => window.createFeedSlideHTML(v, i)).join('');
    }

    window.updateBottomActionBar(startIndex);
    document.getElementById('tk-player-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const target = document.getElementById(`feed-item-${startIndex}`);
        if(target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
        
        if(window.feedObserver) window.feedObserver.disconnect();
        window.feedObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const idx = parseInt(entry.target.dataset.index);
                const vid = entry.target.querySelector('video');
                const icon = document.getElementById(`tk-pause-${idx}`);
                
                if (entry.isIntersecting) {
                    window.updateBottomActionBar(idx);
                    
                    if(vid) {
                        window.currentVideoPlayer = vid;
                        if(vid.dataset.src) { vid.src = vid.dataset.src; vid.removeAttribute('data-src'); }
                        
                        const playPromise = vid.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => { if(icon) icon.classList.remove('show'); })
                                       .catch(() => { if(icon) icon.classList.add('show'); });
                        }
                    } else {
                        window.currentVideoPlayer = null; 
                    }

                    if (idx >= window.fetchedVideos.length - 3 && !window.isLoadingMore) {
                        if (window.currentMode === 'search' && window.searchHasMore) window.searchTikTok(true);
                        else if (window.currentMode === 'info' && window.userHasMore) window.fetchUserInfo(true);
                    }

                } else {
                    if(vid && !vid.paused) {
                        vid.pause();
                        if(icon) icon.classList.add('show');
                    }
                }
            });
        }, { threshold: 0.6 });

        document.querySelectorAll('.tk-feed-item').forEach(el => window.feedObserver.observe(el));
    }, 50);
}

window.reObserveFeed = function() {
    if(!window.feedObserver) return;
    document.querySelectorAll('.tk-feed-item').forEach(el => window.feedObserver.observe(el));
}

window.updateBottomActionBar = function(index) {
    const item = window.fetchedVideos[index];
    if(!item) return;
    const d = item.data;
    const isImg = d.images && d.images.length > 0;

    const fnMp4 = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
    const fnMp3 = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp3');
    
    document.getElementById('tk-lbl-media').innerText = isImg ? "Lưu Bộ Ảnh" : "Lưu Video";
    
    const btnMedia = document.getElementById('tk-btn-dl-media');
    btnMedia.onclick = function(e) {
        e.stopPropagation();
        if(isImg) window.downloadImages(index, this);
        else window.forceDownload(d.urls.no_watermark, fnMp4, this);
    };
    
    const btnMusic = document.getElementById('tk-btn-dl-music');
    btnMusic.onclick = function(e) {
        e.stopPropagation();
        window.forceDownload(d.music?.playUrl, fnMp3, this);
    };
}

window.togglePlayPause = function(index) {
    const item = document.getElementById(`feed-item-${index}`);
    if(!item) return;
    const vid = item.querySelector('video');
    const icon = document.getElementById(`tk-pause-${index}`);
    if(!vid) return; 

    if (vid.paused) {
        vid.play();
        if(icon) icon.classList.remove('show');
    } else {
        vid.pause();
        if(icon) icon.classList.add('show');
    }
}

// BẢNG PHÂN TÍCH
window.openAnalyticsSheet = function(index, event) {
    if(event) event.stopPropagation();
    const d = window.fetchedVideos[index].data;
    const er = window.parseRawStats(d.stats.play) > 0 ? (((window.parseRawStats(d.stats.like) + window.parseRawStats(d.stats.comment) + window.parseRawStats(d.stats.share) + window.parseRawStats(d.stats.download)) / window.parseRawStats(d.stats.play)) * 100).toFixed(2) : 0;
    const lr = window.parseRawStats(d.stats.play) > 0 ? ((window.parseRawStats(d.stats.like) / window.parseRawStats(d.stats.play)) * 100).toFixed(1) : 0;
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
            <span class="text-zinc-400 text-xs font-bold">Khu Vực Phân Phối</span><span class="text-white text-xs font-bold uppercase">${d.video_data.region || 'Quốc tế'}</span>
        </div>
    `;
    document.getElementById('tk-share-sheet').classList.remove('show');
    document.getElementById('tk-analytics-sheet').classList.add('show');
}

window.closeAnalyticsSheet = function(event) {
    if(event) event.stopPropagation();
    document.getElementById('tk-analytics-sheet').classList.remove('show');
}

// BẢNG CHIA SẺ (SHARE) VÀ MỞ NATIVE TIKTOK
window.openShareSheet = function(index, event) {
    if(event) event.stopPropagation();
    const item = window.fetchedVideos[index];
    const link = item.link;

    document.getElementById('tk-share-content').innerHTML = `
        <div class="flex flex-col items-center gap-2 cursor-pointer transition transform active:scale-90" onclick="window.copyToClipboard('${link}', this)">
            <div class="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center text-white text-lg">
                <i class="fa-solid fa-link"></i>
            </div>
            <span class="text-[10px] text-zinc-300 font-bold">Sao chép link</span>
        </div>
        
        <a href="${link}" target="_blank" class="flex flex-col items-center gap-2 cursor-pointer transition transform active:scale-90">
            <div class="w-12 h-12 rounded-full bg-black border border-[#333] shadow-lg flex items-center justify-center text-white text-lg">
                <i class="fa-brands fa-tiktok"></i>
            </div>
            <span class="text-[10px] text-zinc-300 font-bold">Mở bằng TikTok</span>
        </a>
    `;
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    document.getElementById('tk-share-sheet').classList.add('show');
}

window.closeShareSheet = function(event) {
    if(event) event.stopPropagation();
    document.getElementById('tk-share-sheet').classList.remove('show');
}

window.copyToClipboard = function(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        icon.className = "fa-solid fa-check text-green-400";
        span.innerText = "Đã chép";
        setTimeout(() => {
            icon.className = "fa-solid fa-link";
            span.innerText = "Sao chép link";
        }, 2000);
    });
}

window.closeTkPlayer = function() {
    document.getElementById('tk-player-modal').classList.remove('active');
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    document.getElementById('tk-share-sheet').classList.remove('show');
    document.body.style.overflow = '';
    
    if(window.feedObserver) { window.feedObserver.disconnect(); window.feedObserver = null; }
    
    if(window.currentVideoPlayer) {
        window.currentVideoPlayer.pause();
        window.currentVideoPlayer.src = '';
        window.currentVideoPlayer.load();
        window.currentVideoPlayer = null;
    }
    
    document.getElementById('tk-feed-scroller').innerHTML = '';
}

window.searchUserFromDetail = function(username) {
    window.closeTkPlayer();
    window.switchTab('info');
    document.getElementById('tiktok-username').value = username;
    window.fetchUserInfo(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= TRÌNH DOWNLOADER =================
window.forceDownload = async function(url, filename, btnObj) {
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

window.downloadImages = async function(index, btnObj) {
    const d = window.fetchedVideos[index].data;
    if (!d.images?.length) return;
    const origHTML = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải ${d.images.length} ảnh...`;
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

window.downloadAllVideos = async function(btnObj) {
    if (!window.fetchedVideos || window.fetchedVideos.length === 0) return;
    const orig = btnObj.innerHTML;
    btnObj.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải hàng loạt...`;
    btnObj.style.pointerEvents = 'none';

    for (let i = 0; i < window.fetchedVideos.length; i++) {
        const d = window.fetchedVideos[i].data;
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
            const fname = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
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
