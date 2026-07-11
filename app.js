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

window.currentCommentVideoId = null;
window.currentCommentLink = null;
window.commentCursor = 0;
window.commentHasMore = false;
window.isLoadingComments = false;
window.activeReplyCursors = {}; 

window.currentVideoPlayer = null; 
window.feedObserver = null;
window.scrollObserver = null;

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

window.universalVideoMapper = function(videosArray, fallbackAuthor = null) {
    return videosArray.map(v => {
        const a = v.author || fallbackAuthor || {};
        const uId = a.unique_id || a.uniqueId || 'user';
        const vId = v.id || v.video_id || '';
        const avatar = a.avatar || a.avatarLarger || `https://ui-avatars.com/api/?name=${uId}&background=random`;
        const cover = (v.urls && v.urls.cover) ? v.urls.cover : (v.cover || '');

        return {
            link: v.link || `https://www.tiktok.com/@${uId}/video/${vId}`,
            data: {
                status: v.status || "Live",
                author: { uniqueId: uId, nickname: a.nickname || uId, avatar: avatar || cover, verified: a.is_verify || a.verified || false },
                video_data: { id: vId, description: v.caption || v.title || v.desc || '', create_time: v.createTime || v.create_time || 0, duration: v.duration || 0, region: v.region || 'VN' }, 
                stats: { 
                    play: window.parseRawStats(v.stats?.play || v.play_count || v.stats?.playCount), 
                    like: window.parseRawStats(v.stats?.like || v.digg_count || v.stats?.diggCount), 
                    comment: window.parseRawStats(v.stats?.comment || v.comment_count || v.stats?.commentCount), 
                    share: window.parseRawStats(v.stats?.share || v.share_count || v.stats?.shareCount), 
                    download: window.parseRawStats(v.stats?.download || v.download_count || 0) 
                },
                urls: { cover: cover, no_watermark: (v.urls && v.urls.no_watermark) ? v.urls.no_watermark : (v.hdplay || v.play || v.video?.playAddr) }, 
                music: { playUrl: (v.music && v.music.playUrl) ? v.music.playUrl : (v.music || ''), title: (v.music && v.music.title) ? v.music.title : (v.music_info?.title || "Âm thanh gốc") },
                images: v.images || null 
            }
        };
    });
}

window.switchTab = function(mode) {
    window.currentMode = mode;
    ['video', 'search', 'info', 'analytics'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        const tabBtn = document.getElementById(`tab-${m}`);
        if(btn && tabBtn) {
            btn.classList.toggle('hidden', m !== mode);
            if (m === mode) {
                tabBtn.classList.add('pixel-tab-active');
            } else {
                tabBtn.classList.remove('pixel-tab-active');
            }
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
        btnSingle.className = "px-4 py-1.5 bg-[#e0e0e0] text-[#000] border-2 border-[#fff] shadow-[2px_2px_0_#555] active-btn";
        btnMulti.className = "px-4 py-1.5 bg-[#222] text-[#aaa] border-2 border-[#333] hover:bg-[#333]";
        textArea.rows = 1;
        textArea.placeholder = "Dán link Video hoặc Story vào đây...";
    } else {
        btnMulti.className = "px-4 py-1.5 bg-[#e0e0e0] text-[#000] border-2 border-[#fff] shadow-[2px_2px_0_#555] active-btn";
        btnSingle.className = "px-4 py-1.5 bg-[#222] text-[#aaa] border-2 border-[#333] hover:bg-[#333]";
        textArea.rows = 4;
        textArea.placeholder = "Dán nhiều link (mỗi link 1 dòng)...";
    }
}

window.setSkeletonState = function(isActive, isChannel = false, loadingText = "Đang kết nối...") {
    const skelArea = document.getElementById('skeleton-area');
    const skelProfile = document.getElementById('skel-profile');
    const txt = document.getElementById('loading-text');
    const resArea = document.getElementById('result-area');
    const errorBox = document.getElementById('error-msg');
    
    if(errorBox) errorBox.classList.add('hidden');

    if (isActive) {
        if(skelArea) skelArea.classList.remove('hidden');
        if(txt && loadingText) txt.innerText = loadingText;
        if(txt && !loadingText) txt.innerText = '';
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
            errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> LỖI: ${msg}`;
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
    
    const pBarContainer = document.getElementById('scan-progress-container');
    if(pBarContainer) { pBarContainer.classList.add('hidden'); }
    
    const txt = document.getElementById('loading-text');
    if(txt) txt.classList.remove('hidden');
    
    window.setSkeletonState(false);
    window.showError('');
    window.fetchedVideos = [];
    window.currentSortType = 'latest'; 
    window.activeReplyCursors = {};
    
    window.userVideoCursor = 0;
    window.userHasMore = false;
    window.searchCursor = 0;
    window.searchHasMore = false;
    window.commentCursor = 0;
    window.commentHasMore = false;

    window.stopScrollObserver();
}

window.generateFileName = function(author, videoId, ext) { 
    return `${author}_${videoId}.${ext}`; 
}

window.sortVideos = function(type) {
    if(!window.fetchedVideos || window.fetchedVideos.length === 0) return;
    window.currentSortType = type;
    
    if (type === 'popular') {
        window.fetchedVideos.sort((a, b) => b.data.stats.play - a.data.stats.play);
    } else if (type === 'oldest') {
        window.fetchedVideos.sort((a, b) => {
            let tA = a.data.video_data.create_time || 0;
            let tB = b.data.video_data.create_time || 0;
            return tA - tB;
        });
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

// API FETCHING
window.processVideos = async function() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (links.length === 0) return window.showError("Vui lòng nhập link!");
    
    window.clearResults();
    window.setSkeletonState(true, false, "Đang truy xuất media...");

    try {
        const promises = links.map(link => fetch(`/api/video?video=${encodeURIComponent(link)}`).then(res => res.json()).then(data => ({ link, data })).catch(err => ({ link, error: err.message })));
        let results = await Promise.all(promises);
        results = results.filter(r => r.data && r.data.status === "Live");
        
        window.fetchedVideos = window.universalVideoMapper(results.map(r => r.data));

        if(window.fetchedVideos.length === 0) throw new Error("Video riêng tư hoặc bị lỗi.");
        window.setSkeletonState(false);
        window.sortVideos(window.currentSortType);
    } catch (error) { window.setSkeletonState(false); window.showError(error.message); } 
}

// TÌM KIẾM
window.searchTikTok = async function(isLoadMore = false) {
    let kw = document.getElementById('tiktok-keyword').value.trim();
    if(!kw && !isLoadMore) return window.showError("Nhập từ khóa để tìm kiếm.");

    if(!isLoadMore) {
        window.clearResults();
        window.currentSearchKeyword = kw; 
        window.searchCursor = 0;
        window.setSkeletonState(true, false, "Đang tìm kiếm mạng lưới...");
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
    finally { window.isLoadingMore = false; document.getElementById('load-more-indicator')?.classList.add('hidden'); }
}

// TRA CỨU KÊNH
window.fetchUserInfo = async function(isLoadMore = false) {
    let user = isLoadMore ? window.currentUserProfile : document.getElementById('tiktok-username').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return window.showError("Vui lòng nhập ID kênh.");

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
        if (data.status !== "Live") throw new Error(data.error || "Kênh ẩn hoặc không tồn tại.");

        if (!isLoadMore) {
            const u = data.author || {};
            window.fullUserData = { author: u, stats_formatted: data.stats_formatted || {} };
            const s = window.fullUserData.stats_formatted;
            
            const safeAvatar = u.avatar || u.avatarLarger || `https://ui-avatars.com/api/?name=${u.uniqueId||user}&background=random`;
            const safeNickname = u.nickname || u.uniqueId || user;
            const safeUniqueId = u.uniqueId || user;
            const totalVideos = window.formatStatsClient(u.videoCount || u.video || s.videoCount || s.video || 0);
            
            const container = document.getElementById('user-info-area');
            container.innerHTML = `
                <div class="w-full pixel-card p-6 md:p-8 animate-slide-up">
                    <div class="text-center">
                        <img src="${safeAvatar}" class="w-24 h-24 mx-auto object-cover border-2 border-white shadow-[2px_2px_0_#555]" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${safeUniqueId}&background=random'">
                        <h2 class="text-xl mt-4 text-white flex items-center justify-center gap-2">
                            ${safeNickname} ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-400"></i>' : ''}
                        </h2>
                        <p class="text-[#888] text-sm mt-1">@${safeUniqueId}</p>
                        <p id="channel-bio-text" class="mt-4 text-[#ccc] text-sm max-w-xl mx-auto px-2 leading-relaxed whitespace-pre-wrap"></p>
                        ${u.bioLink ? `
                            <div class="inline-flex w-full mt-4 mb-2">
                                <a href="${u.bioLink}" target="_blank" class="flex w-full max-w-sm mx-auto items-center justify-center gap-2 text-blue-300 text-sm bg-[#1a1a1a] border-2 border-[#333] px-3 py-2 hover:bg-[#222] transition">
                                    <i class="fa-solid fa-link shrink-0"></i>
                                    <span class="truncate whitespace-nowrap">${u.bioLink}</span>
                                </a>
                            </div>
                        ` : ''}
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t-2 border-[#222]">
                            <div class="bg-[#111] p-3 border-2 border-[#333] flex flex-col"><span class="text-xl text-white">${s.following || '0'}</span><span class="text-[12px] text-[#888] mt-1">Đang Follow</span></div>
                            <div class="bg-[#111] p-3 border-2 border-[#333] flex flex-col"><span class="text-xl text-white">${s.follower || '0'}</span><span class="text-[12px] text-[#888] mt-1">Follower</span></div>
                            <div class="bg-[#111] p-3 border-2 border-[#333] flex flex-col"><span class="text-xl text-white">${s.heart || '0'}</span><span class="text-[12px] text-[#888] mt-1">Thích</span></div>
                            <div class="bg-[#111] p-3 border-2 border-[#333] flex flex-col">
                                <span class="text-xl text-cyan-400">${totalVideos}</span>
                                <span class="text-[12px] text-[#888] mt-1">Số Video</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.classList.remove('hidden');
            setTimeout(() => { document.getElementById('channel-bio-text').innerText = u.signature || 'Không có tiểu sử.'; }, 100);
            
            window.setSkeletonState(false);
            window.startScrollObserver();
        }

        if (data.videos && data.videos.length > 0) {
            let formattedResults = window.universalVideoMapper(data.videos, window.fullUserData?.author);
            const startIndex = window.fetchedVideos.length;
            window.fetchedVideos.push(...formattedResults);
            
            if (!isLoadMore) window.sortVideos(window.currentSortType);
            else window.appendVideoCards(formattedResults, startIndex);
        }
        window.userVideoCursor = data.cursor;
        window.userHasMore = data.hasMore;

    } catch (error) { if(!isLoadMore) { window.setSkeletonState(false); window.showError(error.message); } } 
    finally { window.isLoadingMore = false; document.getElementById('load-more-indicator')?.classList.add('hidden'); }
}


// PHÂN TÍCH KÊNH 100% - RADAR LƯỢNG TỬ
window.fetchAnalytics = async function() {
    let user = document.getElementById('tiktok-analytics-id').value.trim();
    if (user.startsWith('@')) user = user.substring(1);
    if (!user) return window.showError("Vui lòng nhập ID kênh.");

    window.clearResults();
    window.currentMode = 'analytics';
    window.setSkeletonState(true, true, "");
    document.getElementById('loading-text').classList.add('hidden');

    const skelArea = document.getElementById('skeleton-area');
    let pBarContainer = document.getElementById('scan-progress-container');
    
    // Giao diện Radar
    if (!pBarContainer) {
        skelArea.insertAdjacentHTML('afterbegin', `
            <div id="scan-progress-container" class="w-full mx-auto mb-6 bg-[#0a0a0a] border-2 border-[#333] p-5 hidden">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-sm text-cyan-400 flex items-center gap-2 font-bold"><i class="fa-solid fa-satellite-dish animate-pulse"></i> RADAR LƯỢNG TỬ</span>
                    <span id="scan-progress-text" class="text-sm text-white font-bold">0 / 0</span>
                </div>
                <div class="w-full h-4 bg-[#111] border-2 border-[#333] relative overflow-hidden">
                    <div id="scan-progress-bar" class="h-full bg-cyan-400 transition-none shadow-[0_0_10px_#00ffff]" style="width: 0%"></div>
                </div>
                <p id="scan-status-text" class="text-center text-[11px] text-[#888] mt-3 font-mono">Khởi động hệ thống kết nối...</p>
            </div>
        `);
        pBarContainer = document.getElementById('scan-progress-container');
    }
    
    pBarContainer.classList.remove('hidden');
    document.getElementById('scan-progress-bar').style.width = '0%';
    document.getElementById('scan-progress-text').innerText = '0 Video';
    let statusEl = document.getElementById('scan-status-text');
    statusEl.innerText = 'Chuẩn bị lõi Radar...';

    let allVideos = [];
    let cur = 0;
    let pAuthor = null;
    let hasMore = true;
    let expectedTotal = 0;

    // ENGINE ANIMATION ĐỘC LẬP GIÚP CHẠY SỐ MƯỢT MÀ KHÔNG BỊ GIẬT
    let displayedCount = 0;
    let targetCount = 0;
    let isFetching = true;
    let hexChars = '0123456789ABCDEF';

    let visualInterval = setInterval(() => {
        let randomHex = '';
        for(let i=0; i<6; i++) randomHex += hexChars[Math.floor(Math.random() * 16)];

        if (displayedCount < targetCount) {
            // Hiệu ứng chạy số gia tốc (Easing)
            let diff = targetCount - displayedCount;
            let step = Math.max(1, Math.ceil(diff / 8)); 
            displayedCount += step;
            if (displayedCount > targetCount) displayedCount = targetCount;

            let percentage = expectedTotal > 0 ? Math.min((displayedCount / expectedTotal) * 100, 100) : 100;
            document.getElementById('scan-progress-bar').style.width = `${percentage}%`;
            document.getElementById('scan-progress-text').innerText = expectedTotal > 0 ? `${displayedCount} / ${expectedTotal}` : `${displayedCount}`;
            statusEl.innerText = `[0x${randomHex}] TRÍCH XUẤT: ĐÃ TẢI ${displayedCount} KHỐI DỮ LIỆU...`;
        } else if (!isFetching) {
            statusEl.innerText = `[SYSTEM OK] HOÀN TẤT LẤY ${displayedCount} VIDEO.`;
        } else {
            statusEl.innerText = `[0x${randomHex}] ĐANG YÊU CẦU LÔ DATA MAX (1000 VIDEO/LƯỢT)...`;
        }
    }, 40);

    try {
        while(hasMore) {
            // Ép API đẩy tối đa 1000 video/lượt quét
            const response = await fetch(`/api/index?username=${user}&cursor=${cur}&count=1000`);
            const data = await response.json();
            if (data.status !== "Live") break;
            
            if(!pAuthor && data.author) pAuthor = data.author;
            if (expectedTotal === 0) expectedTotal = pAuthor?.videoCount || pAuthor?.video || data.stats_formatted?.videoCount || data.stats_formatted?.video || 0;

            if(data.videos && data.videos.length > 0) {
                allVideos.push(...data.videos);
                targetCount = allVideos.length; // Truyền lượng thực tế vào để Frame Engine chạy theo
            }
            
            cur = data.cursor;
            hasMore = data.hasMore;
            if (expectedTotal < targetCount) expectedTotal = targetCount;
            
            // Chống văng máy chủ (Delay nhẹ giữa các request)
            await new Promise(r => setTimeout(r, 200)); 
        }

        isFetching = false;
        // Chờ thanh process bar chạy đủ 100% số lượng mới đóng
        while(displayedCount < targetCount) {
            await new Promise(r => setTimeout(r, 50));
        }
        clearInterval(visualInterval);

        if (allVideos.length === 0) throw new Error("Kênh trống hoặc bị lỗi.");

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
            ? sortedTags.map(t => `<span class="bg-[#111] border-2 border-[#333] text-cyan-300 px-3 py-1 text-xs">${t[0]} <span class="text-[#888] ml-1">x${t[1]}</span></span>`).join('')
            : '<span class="text-[#888] text-sm">Không có Hashtag</span>';

        const safeAvatar = pAuthor?.avatar || pAuthor?.avatarLarger || `https://ui-avatars.com/api/?name=${user}&background=random`;
        const safeNickname = pAuthor?.nickname || user;

        const container = document.getElementById('user-info-area');
        container.innerHTML = `
            <div class="w-full pixel-card p-6 md:p-8 animate-slide-up bg-[#0a0a0a]">
                <div class="flex items-center gap-4 mb-6 pb-6 border-b-2 border-[#222]">
                    <img src="${safeAvatar}" class="w-16 h-16 object-cover border-2 border-white shadow-[2px_2px_0_#555]" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${user}&background=random'">
                    <div>
                        <h2 class="text-xl text-white flex items-center gap-2">${safeNickname}</h2>
                        <p class="text-cyan-400 text-xs mt-1">Dữ liệu quét từ ${parsedVideos.length} video</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 bg-[#111] p-4 border-2 border-[#333] mb-6 gap-y-4 gap-x-2">
                    <div class="text-center flex-1 md:border-r-2 border-[#222]">
                        <span class="block text-[12px] text-[#888] mb-1">Ngày lập</span>
                        <span class="text-white text-sm md:text-base">${createDate}</span>
                    </div>
                    <div class="text-center flex-1 md:border-r-2 border-[#222]">
                        <span class="block text-[12px] text-[#888] mb-1">Tổng Video</span>
                        <span class="text-cyan-400 text-sm md:text-base">${window.formatStatsClient(parsedVideos.length)}</span>
                    </div>
                    <div class="text-center flex-1 md:border-r-2 border-[#222]">
                        <span class="block text-[12px] text-[#888] mb-1">Mới nhất</span>
                        <a href="${newestVid.link}" target="_blank" class="text-blue-400 hover:text-white underline text-sm">Xem ngay</a>
                    </div>
                    <div class="text-center flex-1">
                        <span class="block text-[12px] text-[#888] mb-1">Cũ nhất</span>
                        <a href="${oldestVid.link}" target="_blank" class="text-blue-400 hover:text-white underline text-sm">Xem ngay</a>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-[#111] border-2 border-[#333] p-4 flex flex-col items-center justify-center text-center">
                        <span class="text-xl text-white">${window.formatStatsClient(avgViews)}</span>
                        <span class="text-[12px] text-[#888] mt-2">View Trung Bình</span>
                    </div>
                    <div class="bg-[#111] border-2 border-[#333] p-4 flex flex-col items-center justify-center text-center">
                        <span class="text-xl text-cyan-400">${er}%</span>
                        <span class="text-[12px] text-[#888] mt-2">Tỷ lệ ER</span>
                    </div>
                    <div class="bg-[#111] border-2 border-[#333] p-4 flex flex-col items-center justify-center text-center">
                        <span class="text-xl text-pink-400">${window.formatStatsClient(totalLikes / parsedVideos.length)}</span>
                        <span class="text-[12px] text-[#888] mt-2">Tim Trung Bình</span>
                    </div>
                    <div class="bg-[#111] border-2 border-[#333] p-4 flex flex-col items-center justify-center text-center">
                        <span class="text-xl text-white">${window.formatStatsClient(totalPlays)}</span>
                        <span class="text-[12px] text-[#888] mt-2">Tổng View</span>
                    </div>
                </div>
                
                <div class="mb-2">
                    <h4 class="text-[13px] text-white mb-3 flex items-center gap-2"><i class="fa-solid fa-hashtag text-[#888]"></i> HASHTAG PHỔ BIẾN</h4>
                    <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                </div>
            </div>
            
            <div class="w-full flex justify-center gap-4 mt-8 mb-4">
                <button onclick="window.sortVideos('latest')" class="pixel-btn px-6 py-2.5 bg-[#e0e0e0] text-black">MỚI NHẤT</button>
                <button onclick="window.sortVideos('oldest')" class="pixel-btn px-6 py-2.5 bg-[#222] text-white hover:bg-white hover:text-black">CŨ NHẤT</button>
            </div>
        `;
        container.classList.remove('hidden');

        window.fetchedVideos = parsedVideos;
        window.setSkeletonState(false);
        window.sortVideos('latest');
    } catch (error) { 
        clearInterval(visualInterval); 
        window.setSkeletonState(false); 
        window.showError(error.message); 
    } 
}

// RENDER LƯỚI THUMBNAIL CHỐNG CẮT HÌNH
window.renderVideoCards = function(results, append = false, startIndex = 0) {
    const container = document.getElementById('result-area');
    const specialAction = document.getElementById('special-action-container');
    
    if(specialAction && !append) {
        if (window.currentMode === 'video' && window.linkMode === 'multi' && window.fetchedVideos.length > 1) {
            specialAction.innerHTML = `
                <button onclick="window.downloadAllVideos(this)" class="pixel-btn px-6 py-3 bg-[#e0e0e0] text-black"><i class="fa-solid fa-download"></i> TẢI TẤT CẢ MEDIA</button>
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
            ? `<div class="absolute top-2 left-2 bg-black border border-white text-white text-[11px] px-2 py-0.5 z-20"><i class="fa-regular fa-images"></i> ${d.images.length}</div>` 
            : '';

        html += `
            <div class="grid-item w-full ${animClass}" onclick="window.openVideoDetail(${currentIndex})" style="animation-delay: ${(index % 10) * 0.04}s">
                <img src="${d.urls.cover}" class="thumb absolute inset-0 w-full h-full object-contain bg-[#050505]" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/400x600/111/444?text=LỖI'">
                ${mediaTypeBadge}
                <div class="absolute top-2 right-2 bg-black/80 border border-[#333] text-white text-[11px] px-2 py-0.5 z-20 flex items-center gap-1">
                    <i class="fa-solid fa-play text-cyan-400"></i> ${window.formatStatsClient(d.stats.play)}
                </div>
                <div class="absolute inset-0 overlay-gradient z-10 flex flex-col justify-end p-3 pointer-events-none">
                    <div class="flex gap-2 text-[11px] text-[#ccc]">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-pink-400"></i> ${window.formatStatsClient(d.stats.like)}</span>
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

// TIKTOK PLAYER VERTICAL FEED (FULL KÍCH THƯỚC GỐC VIDEO)
window.createFeedSlideHTML = function(item, index) {
    const d = item.data;
    const isImg = d.images && d.images.length > 0;
    
    const sidebar = `
        <div class="tk-sidebar" onclick="event.stopPropagation()">
            <div class="tk-avatar-wrap" onclick="window.searchUserFromDetail('${d.author.uniqueId}')">
                <img src="${d.author.avatar}" class="tk-avatar border-2 border-white" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${d.author.uniqueId}&background=random'">
            </div>
            <div class="tk-icon-wrap"><i class="fa-solid fa-heart tk-icon text-white"></i><span class="text-[12px] mt-1 text-shadow text-white">${window.formatStatsClient(d.stats.like)}</span></div>
            <div class="tk-icon-wrap" onclick="window.openCommentSheet(${index}, event)">
                <i class="fa-solid fa-comment-dots tk-icon text-white"></i>
                <span class="text-[12px] mt-1 text-shadow text-white">${window.formatStatsClient(d.stats.comment)}</span>
            </div>
            <div class="tk-icon-wrap"><i class="fa-solid fa-bookmark tk-icon text-white"></i><span class="text-[12px] mt-1 text-shadow text-white">${window.formatStatsClient(d.stats.download||0)}</span></div>
            <div class="tk-icon-wrap" onclick="window.openShareSheet(${index}, event)">
                <i class="fa-solid fa-share tk-icon text-white"></i>
                <span class="text-[12px] mt-1 text-shadow text-white">${window.formatStatsClient(d.stats.share)}</span>
            </div>
            <div class="tk-icon-wrap mt-2" onclick="window.openAnalyticsSheet(${index}, event)">
                <div class="w-9 h-9 bg-black/60 border-2 border-white flex items-center justify-center">
                    <i class="fa-solid fa-bars text-white text-xl"></i>
                </div>
            </div>
        </div>
    `;

    const info = `
        <div class="tk-bottom-info" onclick="event.stopPropagation()">
            <h3 class="text-[16px] mb-2 text-cyan-300" onclick="window.searchUserFromDetail('${d.author.uniqueId}')">@${d.author.uniqueId}</h3>
            <p class="text-[14px] mb-3 leading-relaxed">${(d.video_data.description||'').replace(/</g,'&lt;')}</p>
            <div class="flex items-center gap-2 text-[12px] bg-black/60 w-fit px-2 py-1 border border-[#555]">
                <i class="fa-solid fa-music text-[#888]"></i>
                <div class="w-32 overflow-hidden whitespace-nowrap"><span class="tk-marquee text-white">${d.music?.title || 'Âm thanh gốc'}</span></div>
            </div>
        </div>
    `;

    let media = '';
    if (isImg) {
        const slides = d.images.map((img, i) => `
            <div class="tk-slide">
                <img src="${img}" class="w-full h-full object-contain bg-black" referrerpolicy="no-referrer">
                <span class="absolute top-[80px] right-4 bg-black border border-white text-white text-[12px] px-3 py-1 shadow-[2px_2px_0_#fff]">${i+1}/${d.images.length}</span>
            </div>
        `).join('');
        media = `
            <div id="tk-img-scroller-${index}" class="tk-image-scroller bg-black" onclick="event.stopPropagation()">${slides}</div>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller-${index}'); c.scrollBy({left: -c.clientWidth, behavior: 'smooth'})" class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 border border-white text-white flex items-center justify-center z-20 hover:bg-white hover:text-black"><i class="fa-solid fa-chevron-left text-lg"></i></button>
            <button onclick="event.stopPropagation(); let c=document.getElementById('tk-img-scroller-${index}'); c.scrollBy({left: c.clientWidth, behavior: 'smooth'})" class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 border border-white text-white flex items-center justify-center z-20 hover:bg-white hover:text-black"><i class="fa-solid fa-chevron-right text-lg"></i></button>
        `;
    } else {
        media = `<video data-src="${d.urls.no_watermark}" poster="${d.urls.cover}" loop playsinline class="w-full h-full object-contain bg-black"></video>`;
    }

    return `
        <div class="tk-feed-item bg-black" data-index="${index}" id="feed-item-${index}" onclick="window.togglePlayPause(${index})">
            ${media}
            <div id="tk-pause-${index}" class="tk-pause-icon">
                <i class="fa-solid fa-play text-white/70 text-7xl"></i>
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
                            playPromise.then(() => { if(icon) icon.classList.remove('show'); }).catch(() => { if(icon) icon.classList.add('show'); });
                        }
                    } else { window.currentVideoPlayer = null; }
                    if (idx >= window.fetchedVideos.length - 3 && !window.isLoadingMore) {
                        if (window.currentMode === 'search' && window.searchHasMore) window.searchTikTok(true);
                        else if (window.currentMode === 'info' && window.userHasMore) window.fetchUserInfo(true);
                    }
                } else {
                    if(vid && !vid.paused) { vid.pause(); if(icon) icon.classList.add('show'); }
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
    
    document.getElementById('tk-lbl-media').innerText = isImg ? "TẢI ẢNH" : "TẢI VIDEO";
    
    const btnMedia = document.getElementById('tk-btn-dl-media');
    btnMedia.onclick = function(e) { e.stopPropagation(); if(isImg) window.downloadImages(index, this); else window.forceDownload(d.urls.no_watermark, fnMp4, this); };
    
    const btnMusic = document.getElementById('tk-btn-dl-music');
    btnMusic.onclick = function(e) { e.stopPropagation(); window.forceDownload(d.music?.playUrl, fnMp3, this); };
}

window.togglePlayPause = function(index) {
    const item = document.getElementById(`feed-item-${index}`);
    if(!item) return;
    const vid = item.querySelector('video');
    const icon = document.getElementById(`tk-pause-${index}`);
    if(!vid) return; 
    if (vid.paused) { vid.play(); if(icon) icon.classList.remove('show'); } else { vid.pause(); if(icon) icon.classList.add('show'); }
}

// ================= BẢNG BÌNH LUẬN & TRẢ LỜI =================
window.openCommentSheet = function(index, event) {
    if(event) event.stopPropagation();
    const item = window.fetchedVideos[index];
    const d = item.data;
    const vId = d.video_data.id;
    
    document.getElementById('tk-comment-count').innerText = window.formatStatsClient(d.stats.comment);
    document.getElementById('tk-share-sheet').classList.remove('show');
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    document.getElementById('tk-comment-sheet').classList.add('show');
    
    if (window.currentCommentVideoId !== vId) {
        window.currentCommentVideoId = vId;
        window.currentCommentLink = item.link;
        window.commentCursor = 0;
        window.commentHasMore = true;
        window.activeReplyCursors = {};
        document.getElementById('tk-comment-content').innerHTML = '<div class="text-center text-[#888] text-[14px] py-6"><i class="fa-solid fa-spinner fa-spin text-lg mb-2 block"></i> Đang tải...</div>';
        window.fetchComments(false);
    }
}

window.closeCommentSheet = function(event) {
    if(event) event.stopPropagation();
    document.getElementById('tk-comment-sheet').classList.remove('show');
}

window.fetchComments = async function(isLoadMore = false) {
    if (window.isLoadingComments || (!window.commentHasMore && isLoadMore)) return;
    window.isLoadingComments = true;
    
    const contentDiv = document.getElementById('tk-comment-content');
    if (isLoadMore) {
        contentDiv.insertAdjacentHTML('beforeend', '<div id="comment-loading-more" class="text-center text-[#888] text-[14px] py-3"><i class="fa-solid fa-spinner fa-spin"></i> Tải thêm...</div>');
    }

    try {
        const urlParams = new URLSearchParams({ url: window.currentCommentLink, id: window.currentCommentVideoId, cursor: window.commentCursor, count: 30 });
        const response = await fetch(`/api/comment?${urlParams.toString()}`);
        const textData = await response.text();
        let resData;
        try { resData = JSON.parse(textData); } catch (e) { throw new Error(`Lỗi máy chủ/API.`); }
        
        if (document.getElementById('comment-loading-more')) document.getElementById('comment-loading-more').remove();
        if (!isLoadMore) contentDiv.innerHTML = '';

        const comments = resData.comments || resData.data?.comments || [];
        window.commentCursor = resData.cursor ?? resData.data?.cursor ?? (window.commentCursor + 30);
        window.commentHasMore = resData.hasMore ?? resData.has_more ?? resData.data?.hasMore ?? resData.data?.has_more ?? false;

        if (comments.length === 0 && !isLoadMore) {
            contentDiv.innerHTML = '<div class="text-center text-[#888] text-[14px] py-4">Chưa có bình luận.</div>';
        } else {
            let html = comments.map(c => window.createCommentHTML(c, window.currentCommentVideoId, false)).join('');
            contentDiv.insertAdjacentHTML('beforeend', html);
        }
    } catch (error) {
        if (document.getElementById('comment-loading-more')) document.getElementById('comment-loading-more').remove();
        if (!isLoadMore) contentDiv.innerHTML = `<div class="text-center text-red-400 text-[14px] py-4 px-2">Lỗi: ${error.message}</div>`;
    } finally { window.isLoadingComments = false; }
}

window.createCommentHTML = function(c, vId, isReply = false) {
    const user = c.user || c.author || {};
    const uniqueId = user.unique_id || user.uniqueId || 'user';
    const nickname = user.nickname || uniqueId;
    const avatar = user.avatar || user.avatar_thumb || user.avatarLarger || `https://ui-avatars.com/api/?name=${uniqueId}&background=random`;
    const text = c.text || c.comment || '';
    const verified = user.is_verify || user.verified || user.custom_verify || false;
    const diggCount = window.formatStatsClient(c.digg_count || c.like_count || c.diggCount || 0);
    const hasReplies = c.reply_comment_total > 0;
    
    let mediaHtml = '';
    if (c.image_list && c.image_list.length > 0) {
        mediaHtml += `<div class="flex gap-2 mt-2 overflow-x-auto scrollbar-hide py-1">`;
        c.image_list.forEach(img => {
            const imgUrl = img.image_url?.url_list?.[0] || '';
            if(imgUrl) mediaHtml += `<img src="${imgUrl}" class="h-24 w-auto object-contain border border-[#444] bg-black" referrerpolicy="no-referrer" />`;
        });
        mediaHtml += `</div>`;
    }
    if (c.sticker && c.sticker.static_url) {
        mediaHtml += `<div class="mt-2"><img src="${c.sticker.static_url}" class="h-16 w-auto object-contain" referrerpolicy="no-referrer" /></div>`;
    }

    const paddingClass = isReply ? "pl-2 border-l border-[#333] ml-3 mt-3" : "mt-4";
    const avatarSize = isReply ? "w-8 h-8" : "w-10 h-10";

    return `
        <div class="flex gap-3 items-start animate-slide-up ${paddingClass}">
            <img src="${avatar}" class="${avatarSize} object-cover shrink-0 cursor-pointer bg-[#222]" onclick="window.searchUserFromDetail('${uniqueId}')" referrerpolicy="no-referrer" onerror="this.src='https://ui-avatars.com/api/?name=${uniqueId}&background=random'">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 cursor-pointer w-fit" onclick="window.searchUserFromDetail('${uniqueId}')">
                    <span class="text-[#888] text-[13px] hover:text-white">${nickname}</span>
                    ${verified ? '<i class="fa-solid fa-circle-check text-blue-400 text-[11px]"></i>' : ''}
                </div>
                <p class="text-white text-[14px] mt-1 break-words">${text}</p>
                ${mediaHtml}
                
                ${(!isReply && hasReplies) ? `
                    <button onclick="window.fetchReplies('${c.cid}', '${vId}', this)" class="text-[#888] hover:text-white text-[12px] mt-2 flex items-center gap-1"><i class="fa-solid fa-reply"></i> Xem ${c.reply_comment_total} trả lời</button>
                ` : ''}
                <div id="replies-${c.cid}" class="space-y-1"></div>
            </div>
            <div class="flex flex-col items-center gap-1 shrink-0 text-[#888] ml-2 mt-1">
                <i class="fa-regular fa-heart text-[12px]"></i>
                <span class="text-[11px]">${diggCount}</span>
            </div>
        </div>
    `;
}

window.fetchReplies = async function(commentId, videoId, btnObj) {
    let cursor = window.activeReplyCursors[commentId] || 0;
    if(btnObj) { btnObj.innerHTML = 'Đang tải...'; btnObj.disabled = true; }
    
    try {
        const response = await fetch(`/api/comment?id=${videoId}&commentId=${commentId}&cursor=${cursor}`);
        const resData = JSON.parse(await response.text());
        
        const comments = resData.comments || resData.data?.comments || [];
        window.activeReplyCursors[commentId] = resData.cursor ?? resData.data?.cursor ?? (cursor + 30);
        let hasMore = resData.hasMore ?? resData.has_more ?? resData.data?.hasMore ?? resData.data?.has_more ?? false;
        
        let html = comments.map(c => window.createCommentHTML(c, videoId, true)).join('');
        document.getElementById(`replies-${commentId}`).insertAdjacentHTML('beforeend', html);
        
        if (hasMore) {
            if(btnObj) { btnObj.innerHTML = `<i class="fa-solid fa-reply"></i> Xem tiếp`; btnObj.disabled = false; }
        } else {
            if(btnObj) btnObj.remove();
        }
    } catch(e) {
        if(btnObj) { btnObj.innerHTML = 'Lỗi!'; btnObj.disabled = false; }
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
        <div class="flex items-center justify-between bg-[#111] border border-[#333] p-3 mb-2">
            <span class="text-[#888] text-[13px]">ID tệp</span><span class="text-white text-[13px]">${d.video_data.id}</span>
        </div>
        <div class="flex items-center justify-between bg-[#111] border border-[#333] p-3 mb-2">
            <span class="text-[#888] text-[13px]">Ngày đăng</span><span class="text-white text-[13px]">${dateStr}</span>
        </div>
        <div class="flex items-center justify-between bg-[#111] border border-[#333] p-3 mb-2">
            <span class="text-[#888] text-[13px]">Tương tác ER</span><span class="text-cyan-400 text-[14px] font-bold">${er}%</span>
        </div>
        <div class="flex items-center justify-between bg-[#111] border border-[#333] p-3 mb-2">
            <span class="text-[#888] text-[13px]">Chuyển đổi Tim</span><span class="text-pink-400 text-[14px] font-bold">${lr}%</span>
        </div>
        <div class="flex items-center justify-between bg-[#111] border border-[#333] p-3">
            <span class="text-[#888] text-[13px]">Phân phối</span><span class="text-white text-[13px] uppercase">${d.video_data.region || 'Quốc tế'}</span>
        </div>
    `;
    document.getElementById('tk-share-sheet').classList.remove('show');
    document.getElementById('tk-comment-sheet').classList.remove('show');
    document.getElementById('tk-analytics-sheet').classList.add('show');
}
window.closeAnalyticsSheet = function(event) { if(event) event.stopPropagation(); document.getElementById('tk-analytics-sheet').classList.remove('show'); }

// BẢNG CHIA SẺ
window.openShareSheet = function(index, event) {
    if(event) event.stopPropagation();
    const item = window.fetchedVideos[index];
    const link = item.link;

    document.getElementById('tk-share-content').innerHTML = `
        <div class="flex flex-col items-center gap-2 cursor-pointer" onclick="window.copyToClipboard('${link}', this)">
            <div class="w-14 h-14 bg-[#111] border border-[#333] flex items-center justify-center text-white text-xl hover:bg-[#222]">
                <i class="fa-solid fa-link"></i>
            </div>
            <span class="text-[12px] text-[#888]">Copy Link</span>
        </div>
        
        <a href="${link}" target="_blank" class="flex flex-col items-center gap-2 cursor-pointer">
            <div class="w-14 h-14 bg-[#111] border border-[#333] flex items-center justify-center text-white text-xl hover:bg-[#222]">
                <i class="fa-brands fa-tiktok"></i>
            </div>
            <span class="text-[12px] text-[#888]">Mở TikTok</span>
        </a>
    `;
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    document.getElementById('tk-comment-sheet').classList.remove('show');
    document.getElementById('tk-share-sheet').classList.add('show');
}
window.closeShareSheet = function(event) { if(event) event.stopPropagation(); document.getElementById('tk-share-sheet').classList.remove('show'); }

window.copyToClipboard = function(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        icon.className = "fa-solid fa-check text-cyan-400";
        span.innerText = "Đã copy!";
        setTimeout(() => { icon.className = "fa-solid fa-link"; span.innerText = "Copy Link"; }, 2000);
    });
}

window.closeTkPlayer = function() {
    document.getElementById('tk-player-modal').classList.remove('active');
    document.getElementById('tk-analytics-sheet').classList.remove('show');
    document.getElementById('tk-share-sheet').classList.remove('show');
    document.getElementById('tk-comment-sheet').classList.remove('show');
    document.body.style.overflow = '';
    if(window.feedObserver) { window.feedObserver.disconnect(); window.feedObserver = null; }
    if(window.currentVideoPlayer) { window.currentVideoPlayer.pause(); window.currentVideoPlayer.src = ''; window.currentVideoPlayer.load(); window.currentVideoPlayer = null; }
    document.getElementById('tk-feed-scroller').innerHTML = '';
}

window.searchUserFromDetail = function(username) {
    window.closeTkPlayer();
    window.switchTab('info');
    document.getElementById('tiktok-username').value = username;
    window.fetchUserInfo(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// DOWNLOADING
window.forceDownload = async function(url, filename, btnObj) {
    if (!url) return;
    const origHTML = btnObj.innerHTML;
    btnObj.innerHTML = `ĐANG TẢI...`;
    btnObj.style.pointerEvents = 'none';
    try {
        const r = await fetch(url); const blob = await r.blob();
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename, style: 'display:none' });
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    } catch { window.open(url, '_blank'); }
    btnObj.innerHTML = `XONG`;
    setTimeout(() => { btnObj.innerHTML = origHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}
window.downloadImages = async function(index, btnObj) {
    const d = window.fetchedVideos[index].data;
    if (!d.images?.length) return;
    const origHTML = btnObj.innerHTML;
    btnObj.innerHTML = `ĐANG TẢI...`;
    btnObj.style.pointerEvents = 'none';
    for (let i = 0; i < d.images.length; i++) {
        const fname = `${d.author.uniqueId}_${d.video_data.id}_${i+1}.jpg`;
        try {
            const r = await fetch(d.images[i]); const blob = await r.blob();
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fname, style: 'display:none' });
            document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
        } catch { window.open(d.images[i], '_blank'); }
        await new Promise(r => setTimeout(r, 400));
    }
    btnObj.innerHTML = `XONG`;
    setTimeout(() => { btnObj.innerHTML = origHTML; btnObj.style.pointerEvents = 'auto'; }, 2000);
}
window.downloadAllVideos = async function(btnObj) {
    if (!window.fetchedVideos || window.fetchedVideos.length === 0) return;
    const orig = btnObj.innerHTML;
    btnObj.innerHTML = `ĐANG TẢI...`;
    btnObj.style.pointerEvents = 'none';
    for (let i = 0; i < window.fetchedVideos.length; i++) {
        const d = window.fetchedVideos[i].data;
        if (d.images && d.images.length > 0) {
            for (let j=0; j<d.images.length; j++){
                const fname = `${d.author.uniqueId}_${d.video_data.id}_${j+1}.jpg`;
                try {
                    const r = await fetch(d.images[j]); const blob = await r.blob();
                    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'});
                    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
                } catch(e) { window.open(d.images[j], '_blank'); }
                await new Promise(r => setTimeout(r, 380));
            }
        } else {
            const fname = window.generateFileName(d.author.uniqueId, d.video_data.id, 'mp4');
            try {
                const r = await fetch(d.urls.no_watermark); const blob = await r.blob();
                const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'});
                document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
            } catch(e) { window.open(d.urls.no_watermark, '_blank'); }
        }
        await new Promise(r => setTimeout(r, 800)); 
    }
    btnObj.innerHTML = `XONG`;
    setTimeout(() => { btnObj.innerHTML = orig; btnObj.style.pointerEvents = 'auto'; }, 3000);
}