// ═══════════════════════════════════════════════════
//  TIKTOK STUDIO PRO — app.js
// ═══════════════════════════════════════════════════

// ── GLOBAL STATE ──
let currentMode     = 'video';
let linkMode        = 'single';
let fetchedVideos   = [];          // Toàn bộ mảng tệp đã lưu
let renderedCount   = 0;           // Render hiển thị lên lưới
const PAGE_SIZE     = 30;          

let currentSortType      = 'latest';
let currentSearchKeyword = '';
let searchCursor         = 0;
let searchHasMore        = false;
let isLoadingMore        = false;

let currentUserProfile = '';
let userVideoCursor    = 0;
let userHasMore        = false;
let fullUserData       = null;

// IntersectionObserver cho cuộn mượt
let scrollObserver = null;

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-app-btn');
    if(btn) btn.classList.remove('hidden');
});

window.installWebApp = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-app-btn').classList.add('hidden');
        }
        deferredPrompt = null;
    }
}

// ── BỘ XỬ LÝ CHUỖI SIÊU CẤP CHỐNG LỖI ──
function parseRaw(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const s = v.toString().toUpperCase().replace(/,/g, '.');
    const m = s.includes('B') ? 1e9 : s.includes('M') ? 1e6 : s.includes('K') ? 1e3 : 1;
    const n = parseFloat(s.replace(/[KMB\s]/g, ''));
    return isNaN(n) ? 0 : n * m;
}

function fmt(n) {
    const v = parseRaw(n); // Bọc kép an toàn
    if (v === 0)       return '0';
    if (v < 1000)      return v.toString();
    if (v < 1_000_000) return (Math.floor(v / 100) / 10).toFixed(1).replace('.0','') + 'K';
    return (Math.floor(v / 100_000) / 10).toFixed(1).replace('.0','') + 'M';
}

// ── UI HELPERS ──
function showLoading(show, text = 'Đang xử lý...') {
    const el = document.getElementById('loading');
    const tx = document.getElementById('loading-text');
    if (!el) return;
    if (tx) tx.textContent = text;
    el.classList.toggle('hidden', !show);
}

function showError(msg) {
    const box  = document.getElementById('error-msg');
    const text = document.getElementById('error-text');
    if (!box) return;
    if (msg) { if(text) text.textContent = msg; box.classList.remove('hidden'); }
    else box.classList.add('hidden');
}

function clearResults() {
    fetchedVideos   = [];
    renderedCount   = 0;
    searchCursor    = 0;
    searchHasMore   = false;
    userVideoCursor = 0;
    userHasMore     = false;
    currentSearchKeyword = '';
    currentUserProfile   = '';
    fullUserData         = null;
    currentSortType      = 'latest';

    showError('');

    const ids = ['user-info-area','result-area','toolbar-actions'];
    ids.forEach(id => { const e = document.getElementById(id); if(e) e.innerHTML = ''; });

    document.getElementById('user-info-area')?.classList.add('hidden');
    document.getElementById('toolbar')?.classList.add('hidden');
    document.getElementById('sort-btns')?.classList.add('hidden');
    document.getElementById('result-area').className = 'w-full';
    document.getElementById('load-more-indicator')?.classList.add('hidden');

    stopScrollObserver();
}

// ── TABS NẠP TRANG ──
function switchTab(mode) {
    currentMode = mode;
    ['video','search','info','analytics'].forEach(m => {
        document.getElementById(`mode-${m}`)?.classList.toggle('hidden', m !== mode);
        const tb = document.getElementById(`tab-${m}`);
        if(tb) { tb.className = 'tab-pill ' + (m === mode ? 'tab-on' : 'tab-off'); }
    });
    clearResults();
}

function setLinkMode(mode) {
    linkMode = mode;
    const btnS = document.getElementById('subtab-single');
    const btnM = document.getElementById('subtab-multi');
    const ta   = document.getElementById('tiktok-links');
    const on  = 'px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] text-white font-semibold text-[11px] transition';
    const off = 'px-3.5 py-1.5 rounded-lg text-zinc-500 font-semibold text-[11px] hover:text-white transition';
    if (mode === 'single') {
        btnS.className = on; btnM.className = off;
        ta.rows = 1; ta.placeholder = 'Dán link Video hoặc Nhật ký (Story)...';
    } else {
        btnM.className = on; btnS.className = off;
        ta.rows = 4; ta.placeholder = 'Dán nhiều link (mỗi link 1 dòng)...';
    }
}

function openGuide()  { document.getElementById('guide-window')?.classList.add('open'); }

function toggleExpand(id) {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('collapsed');
    b.classList.toggle('expanded');
}

// ── CÔNG CỤ SẮP XẾP CHUẨN XÁC ──
function sortVideos(type) {
    if (!fetchedVideos.length) return;
    currentSortType = type;

    ['latest','popular'].forEach(t => {
        const b = document.getElementById(`sort-${t}`);
        if(b) b.className = 'sort-pill ' + (t === type ? 'sort-on' : 'sort-off');
    });

    if (type === 'popular') {
        fetchedVideos.sort((a,b) => parseRaw(b.data.stats.play) - parseRaw(a.data.stats.play));
    } else {
        fetchedVideos.sort((a,b) => (b.data.video_data.create_time||0) - (a.data.video_data.create_time||0));
    }

    renderedCount = 0;
    const area = document.getElementById('result-area');
    if (area) area.innerHTML = '';
    renderNextPage();
}

// ── QUẢN LÝ CUỘN (INFINITE SCROLL CHỈ HIỂN THỊ DỮ LIỆU ĐÃ TẢI) ──
function startScrollObserver() {
    stopScrollObserver();
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) onScrollEnd();
    }, { rootMargin: '200px' });
    scrollObserver.observe(sentinel);
}

function stopScrollObserver() {
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
}

async function onScrollEnd() {
    if (isLoadingMore) return;
    // Bơm dần dữ liệu lên lưới (Mỗi lần 30 bài để giữ app mượt)
    if (renderedCount < fetchedVideos.length) {
        renderNextPage();
        return;
    }

    if (currentMode === 'search' && searchHasMore) {
        await loadMoreSearch();
        return;
    }
    if (currentMode === 'info' && userHasMore) {
        await loadMoreUser();
        return;
    }
    stopScrollObserver();
}

function showLoadMore(show) {
    document.getElementById('load-more-indicator')?.classList.toggle('hidden', !show);
}

// ── RENDER CARD VÀO LƯỚI ──
function renderNextPage() {
    const area = document.getElementById('result-area');
    if (!area) return;

    if (renderedCount === 0) {
        if (fetchedVideos.length === 1) {
            area.className = 'w-full max-w-[280px] mx-auto';
        } else {
            // Class video-grid mặc định là 2 cột cho mobile
            area.className = 'w-full video-grid';
        }
    }

    const slice = fetchedVideos.slice(renderedCount, renderedCount + PAGE_SIZE);
    slice.forEach((item, i) => {
        if (item.error || item.data?.status !== 'Live') return;
        area.insertAdjacentHTML('beforeend', buildCard(item, renderedCount + i));
    });
    renderedCount += slice.length;
}

function buildCard(item, index) {
    const d = item.data;
    const isImg = d.images && d.images.length > 0;
    const delay = (index % PAGE_SIZE) * 0.03;
    return `
    <div class="vcard anim-fadeup" style="animation-delay:${delay}s" onclick="openVideoDetail(${index})">
        <img class="thumb" src="${d.urls.cover}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.src=''">
        <div class="vcard-overlay"></div>
        <div class="vcard-top">
            ${isImg ? `<span class="badge badge-img"><i class="fa-regular fa-images"></i>${d.images.length}</span>` : '<span></span>'}
            <span class="badge badge-dark"><i class="fa-solid fa-play text-blue-400 text-[8px]"></i>${fmt(d.stats.play)}</span>
        </div>
        <div class="vcard-bot">
            <div class="flex items-center gap-1.5 mb-1.5">
                <img src="${d.author.avatar}" class="w-5 h-5 rounded-full object-cover border border-white/10 bg-zinc-800 shrink-0" loading="lazy" referrerpolicy="no-referrer">
                <span class="text-white font-semibold text-[11px] truncate">${d.author.nickname}</span>
            </div>
            <div class="flex gap-2.5 text-[9.5px] font-bold text-zinc-300">
                <span><i class="fa-solid fa-heart text-pink-400"></i> ${fmt(d.stats.like)}</span>
                <span><i class="fa-solid fa-comment text-zinc-400"></i> ${fmt(d.stats.comment)}</span>
            </div>
        </div>
    </div>`;
}

// ── TOOLS PANEL ──
function showToolbar(showSort, extraHtml = '') {
    document.getElementById('toolbar')?.classList.remove('hidden');

    const sb = document.getElementById('sort-btns');
    if (sb) sb.classList.toggle('hidden', !showSort);

    const ta = document.getElementById('toolbar-actions');
    if (ta) ta.innerHTML = extraHtml;
}

function typeWriter(el, text, speed = 22) {
    el.innerHTML = '';
    el.classList.add('tw-cursor');
    let i = 0;
    function t() { if (i < text.length) { el.innerHTML += text[i++]; setTimeout(t, speed); } else el.classList.remove('tw-cursor'); }
    t();
}

function genFile(author, id, ext) { return `${author}_${id}.${ext}`; }

// ═══════════════════════════════════════════════════
//  TAB 1: TRUY XUẤT TỆP
// ═══════════════════════════════════════════════════
async function processVideos() {
    const input = document.getElementById('tiktok-links').value;
    const links = input.split('\n').map(l => l.trim()).filter(Boolean);
    if (!links.length) return showError('Dán link vô đi nào!');
    if (linkMode === 'single' && links.length > 1) return showError('Đang ở chế độ Đơn tệp. Chuyển sang Hàng loạt để dán nhiều link!');

    const btn = document.getElementById('fetch-video-btn');
    clearResults();
    showLoading(true, 'Truy xuất dữ liệu...');
    if (btn) btn.disabled = true;

    try {
        const promises = links.map(link =>
            fetch(`/api/video?video=${encodeURIComponent(link)}`)
                .then(r => r.json()).then(data => ({ link, data })).catch(e => ({ link, error: e.message }))
        );
        let results = await Promise.all(promises);
        results = results.filter(r => r.data?.status === 'Live');
        if (!results.length) throw new Error('Không lấy được video. Kiểm tra lại link!');

        results.forEach(r => {
            if (r.data?.stats) {
                r.data.stats.play    = parseRaw(r.data.stats.play);
                r.data.stats.like    = parseRaw(r.data.stats.like);
                r.data.stats.comment = parseRaw(r.data.stats.comment);
                r.data.stats.share   = parseRaw(r.data.stats.share);
            }
        });

        fetchedVideos = results;
        renderedCount = 0;
        renderNextPage();

        if (linkMode === 'multi' && fetchedVideos.length > 1) {
            showToolbar(false, `<button onclick="downloadAllVideos(this)" class="btn-ghost px-4 py-2 text-xs flex items-center gap-2"><i class="fa-solid fa-download"></i> Tải Tất Cả</button>`);
        }
        startScrollObserver();
    } catch(e) { showError(e.message); }
    finally { showLoading(false); if(btn) btn.disabled = false; }
}

// ═══════════════════════════════════════════════════
//  TAB 2: TÌM KIẾM THEO TỪ KHÓA
// ═══════════════════════════════════════════════════
async function searchTikTok() {
    const kw = document.getElementById('tiktok-keyword').value.trim();
    if (!kw) return showError('Nhập từ khóa vô!');

    const btn = document.getElementById('fetch-search-btn');
    clearResults();
    currentSearchKeyword = kw;
    searchCursor = 0;
    if(btn) btn.disabled = true;
    showLoading(true, 'Đang quét mảng tìm kiếm...');

    try {
        const r    = await fetch(`/api/search?keywords=${encodeURIComponent(kw)}&cursor=0&count=30`);
        const data = await r.json();

        if (data.code !== 0 || !data.data?.videos?.length) throw new Error('Không tìm thấy kết quả nào.');

        fetchedVideos  = formatTikWm(data.data.videos);
        searchCursor   = data.data.cursor;
        searchHasMore  = !!data.data.hasMore;
        renderedCount  = 0;

        renderNextPage();
        showToolbar(true,
            `<button onclick="searchRandom()" class="btn-ghost px-4 py-2 text-xs flex items-center gap-2"><i class="fa-solid fa-dice"></i> Ngẫu Nhiên</button>`
        );
        sortVideos(currentSortType);
        startScrollObserver();
    } catch(e) { showError(e.message); }
    finally { showLoading(false); if(btn) btn.disabled = false; }
}

async function loadMoreSearch() {
    if (isLoadingMore || !searchHasMore) return;
    isLoadingMore = true;
    showLoadMore(true);

    try {
        const r    = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${searchCursor}&count=30`);
        const data = await r.json();

        if (data.code === 0 && data.data?.videos?.length) {
            const newVids = formatTikWm(data.data.videos);
            fetchedVideos.push(...newVids);
            searchCursor  = data.data.cursor;
            searchHasMore = !!data.data.hasMore;
            renderNextPage();
        } else {
            searchHasMore = false;
        }
    } catch(e) { /* silently fail */ }
    finally { isLoadingMore = false; showLoadMore(false); }
}

async function searchRandom() {
    if (!currentSearchKeyword) return;
    const btn = document.getElementById('fetch-search-btn');
    if(btn) btn.disabled = true;
    showLoading(true, 'Chắt lọc ngẫu nhiên...');
    try {
        const cur = Math.floor(Math.random() * 15);
        const r = await fetch(`/api/search?keywords=${encodeURIComponent(currentSearchKeyword)}&cursor=${cur}&count=20`);
        const d = await r.json();
        const vids = d.data?.videos;
        if (vids?.length) {
            clearResults();
            currentSearchKeyword = document.getElementById('tiktok-keyword').value.trim();
            fetchedVideos = formatTikWm([vids[Math.floor(Math.random() * vids.length)]]);
            renderedCount = 0;
            renderNextPage();
            showToolbar(false, `<button onclick="searchRandom()" class="btn-ghost px-4 py-2 text-xs flex items-center gap-2"><i class="fa-solid fa-dice"></i> Random Khác</button>`);
        }
    } catch(e) { showError(e.message); }
    finally { showLoading(false); if(btn) btn.disabled = false; }
}

// ═══════════════════════════════════════════════════
//  TAB 3: SOI HỒ SƠ KÊNH
// ═══════════════════════════════════════════════════
async function fetchUserInfo() {
    let user = document.getElementById('tiktok-username').value.trim().replace(/^@/, '');
    if (!user) return showError('Nhập ID vô mới quét được!');

    const btn = document.getElementById('fetch-info-btn');
    clearResults();
    currentUserProfile = user;
    if(btn) btn.disabled = true;
    showLoading(true, 'Đang kết nối tải hồ sơ...');

    try {
        const r0   = await fetch(`/api/index?username=${user}&cursor=0`);
        const d0   = await r0.json();
        if (d0.status !== 'Live') throw new Error(d0.error || 'Kênh không tồn tại hoặc bị riêng tư.');

        fullUserData    = d0;
        userVideoCursor = d0.cursor;
        userHasMore     = !!d0.hasMore;

        renderUserProfile(d0.author, d0.stats_formatted);

        if (d0.videos?.length) {
            fetchedVideos = mapUserVideos(d0.videos, user, d0.author);
        }

        renderedCount = 0;
        renderNextPage();
        showToolbar(true);
        sortVideos('latest');
        startScrollObserver();

    } catch(e) { showError(e.message); }
    finally { showLoading(false); if(btn) btn.disabled = false; }
}

async function loadMoreUser() {
    if (isLoadingMore || !userHasMore || !currentUserProfile) return;
    isLoadingMore = true;
    showLoadMore(true);

    try {
        const r = await fetch(`/api/index?username=${currentUserProfile}&cursor=${userVideoCursor}`);
        const d = await r.json();
        if (d.status === 'Live' && d.videos?.length) {
            const newVids = mapUserVideos(d.videos, currentUserProfile, fullUserData?.author);
            fetchedVideos.push(...newVids);
            userVideoCursor = d.cursor;
            userHasMore     = !!d.hasMore;
            renderNextPage();
        } else {
            userHasMore = false;
        }
    } catch(e) { /* silently fail */ }
    finally { isLoadingMore = false; showLoadMore(false); }
}

function mapUserVideos(videos, user, author) {
    return videos.map(v => ({
        link: v.link,
        data: {
            status: 'Live',
            author: { uniqueId: user, nickname: author?.nickname || user, avatar: author?.avatar || '', verified: author?.verified || false },
            video_data: { id: v.id, description: v.caption, create_time: v.createTime || null, duration: v.duration || 0, region: v.region || '' },
            stats: { play: parseRaw(v.stats.play), like: parseRaw(v.stats.like), comment: parseRaw(v.stats.comment), share: parseRaw(v.stats.share) },
            urls: v.urls, music: v.music, images: v.images || null
        }
    }));
}

function renderUserProfile(u, s) {
    const area = document.getElementById('user-info-area');
    if (!area) return;

    area.innerHTML = `
    <div class="card p-6 md:p-7 anim-fadeup relative mb-2">
        <div id="profile-body" class="collapse-body expanded">
            <div class="flex items-center gap-4 mb-5">
                <img src="${u.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-[#222] bg-zinc-900 shrink-0" referrerpolicy="no-referrer">
                <div>
                    <h2 class="font-black text-white text-lg flex items-center gap-1.5">
                        ${u.nickname || u.uniqueId}
                        ${u.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>' : ''}
                    </h2>
                    <p class="text-zinc-500 text-xs font-medium mt-0.5">@${u.uniqueId}</p>
                </div>
            </div>
            
            <p id="bio-text" class="text-zinc-400 text-sm leading-relaxed mb-4 min-h-[20px]"></p>
            
            ${u.bioLink ? `
            <div class="inline-flex w-full mb-4">
                <a href="${u.bioLink}" target="_blank" class="flex w-full max-w-sm items-center justify-center gap-2 text-blue-400 text-xs font-bold bg-[#0d0d0d] border border-blue-500/30 px-3.5 py-3 rounded-xl hover:border-blue-500 hover:bg-[#111] transition shadow-md">
                    <i class="fa-solid fa-link text-zinc-500 shrink-0"></i>
                    <span class="truncate whitespace-nowrap">${u.bioLink}</span>
                </a>
            </div>
            ` : ''}

            <div class="grid grid-cols-3 gap-2 pt-4 border-t border-[#1e1e1e]">
                <div class="stat-box"><span class="font-black text-white text-base">${s?.following||'0'}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Đang FL</span></div>
                <div class="stat-box"><span class="font-black text-white text-base">${s?.follower||'0'}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Follower</span></div>
                <div class="stat-box"><span class="font-black text-white text-base">${s?.heart||'0'}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Yêu thích</span></div>
            </div>
        </div>
        <button onclick="toggleExpand('profile-body')" class="mt-3 mx-auto flex items-center gap-1.5 text-zinc-600 hover:text-white text-xs font-semibold transition" id="profile-toggle">
            <i class="fa-solid fa-chevron-up"></i> Thu gọn
        </button>
    </div>`;

    area.classList.remove('hidden');
    setTimeout(() => { const b = document.getElementById('bio-text'); if(b) typeWriter(b, u.signature || 'Chưa có tiểu sử.'); }, 80);
}

// ═══════════════════════════════════════════════════
//  TAB 4: PHÂN TÍCH KÊNH 100% (VÉT SẠCH KÊNH)
// ═══════════════════════════════════════════════════
async function fetchAnalytics() {
    let user = document.getElementById('tiktok-analytics-id').value.trim().replace(/^@/, '');
    if (!user) return showError('Nhập ID kênh cần phân tích!');

    const btn = document.getElementById('fetch-analytics-btn');
    clearResults();
    currentMode = 'analytics';
    if(btn) btn.disabled = true;
    showLoading(true, 'Khởi động động cơ vét kênh 100%...');

    try {
        let allVids = [];
        let cur = 0;
        let pAuthor = null;
        let hasMore = true;
        let limitPages = 0; 
        
        // Cứ mỗi trang là 30 vid, vét đến bao giờ hết thì thôi
        while(hasMore && limitPages < 500) {
            const r = await fetch(`/api/index?username=${user}&cursor=${cur}`);
            const d = await r.json();
            if (d.status !== 'Live') break;
            
            if (!pAuthor && d.author) pAuthor = d.author;
            if (d.videos?.length) allVids.push(...d.videos);
            
            cur = d.cursor;
            hasMore = !!d.hasMore;
            limitPages++;
            
            showLoading(true, `Vét dữ liệu ngầm... Đã tải ${allVids.length} bài đăng.`);
            
            // Xả nhịp chống dính Rate Limit
            if (limitPages % 6 === 0) {
                await new Promise(res => setTimeout(res, 800));
            }
        }

        if (!allVids.length) throw new Error('Kênh trống hoặc bị khóa riêng tư.');

        let totalPlay=0, totalLike=0, totalCmt=0, totalShare=0, hashMap={};
        
        allVids.forEach(v => {
            totalPlay  += parseRaw(v.stats.play);
            totalLike  += parseRaw(v.stats.like);
            totalCmt   += parseRaw(v.stats.comment);
            totalShare += parseRaw(v.stats.share);
            (v.caption||'').match(/#[\w_À-ỹ]+/g)?.forEach(t => { const k=t.toLowerCase(); hashMap[k]=(hashMap[k]||0)+1; });
        });

        // Tìm Mới Nhất & Cũ Nhất theo timestamp
        allVids.sort((a,b) => (b.createTime||0) - (a.createTime||0));
        let newestVid = allVids[0];
        let oldestVid = allVids[allVids.length - 1];

        // Lấy ngày tạo từ video cũ nhất vì đó là lúc lập kênh (tương đối)
        let createDate = 'Không rõ';
        if (oldestVid && oldestVid.createTime) {
            createDate = new Date(oldestVid.createTime * 1000).toLocaleDateString('vi-VN');
        }

        const avgView = totalPlay / allVids.length;
        const er = totalPlay > 0 ? (((totalLike+totalCmt+totalShare)/totalPlay)*100).toFixed(2) : '0';
        
        const topTags = Object.entries(hashMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
        const tagsHtml = topTags.length
            ? topTags.map(([t,c])=>`<span class="bg-[#0d0d0d] border border-[#222] text-cyan-400 px-3 py-1 rounded-full text-[11px] font-bold">${t} <span class="text-zinc-600 ml-0.5">×${c}</span></span>`).join('')
            : '<span class="text-zinc-600 text-xs italic">Không dùng hashtag</span>';

        const area = document.getElementById('user-info-area');
        area.innerHTML = `
        <div class="card p-6 md:p-7 anim-fadeup mb-4">
            <div class="flex items-center gap-4 mb-6 pb-5 border-b border-[#1e1e1e]">
                <img src="${pAuthor?.avatar||''}" class="w-14 h-14 rounded-full object-cover border border-[#222] bg-zinc-900 shrink-0" referrerpolicy="no-referrer">
                <div>
                    <h2 class="font-black text-white text-lg flex items-center gap-2">
                        ${pAuthor?.nickname || user}
                        ${pAuthor?.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>' : ''}
                    </h2>
                    <p class="text-zinc-500 text-xs mt-0.5">Thuật toán phân tích quét toàn bộ <strong class="text-cyan-400">${allVids.length}</strong> bài đăng trên kênh</p>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-6 bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4">
                <div class="text-center border-r border-[#222]">
                    <span class="block text-[9px] text-zinc-500 font-bold uppercase mb-1">Ngày Lập Kênh</span>
                    <span class="font-bold text-white text-sm">${createDate}</span>
                </div>
                <div class="text-center border-r border-[#222] flex flex-col justify-center items-center">
                    <span class="block text-[9px] text-zinc-500 font-bold uppercase mb-1">Video Mới</span>
                    <a href="${newestVid.link}" target="_blank" class="font-bold text-blue-400 hover:text-white transition text-xs flex items-center gap-1.5"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở Nguồn</a>
                </div>
                <div class="text-center flex flex-col justify-center items-center">
                    <span class="block text-[9px] text-zinc-500 font-bold uppercase mb-1">Video Cũ</span>
                    <a href="${oldestVid.link}" target="_blank" class="font-bold text-blue-400 hover:text-white transition text-xs flex items-center gap-1.5"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở Nguồn</a>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div class="stat-box"><i class="fa-solid fa-fire text-orange-500 mb-1"></i><span class="font-black text-white text-lg">${fmt(avgView)}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">View TB</span></div>
                <div class="stat-box"><i class="fa-solid fa-percent text-cyan-400 mb-1"></i><span class="font-black text-white text-lg">${er}%</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Tỷ lệ ER Toàn Kênh</span></div>
                <div class="stat-box"><i class="fa-solid fa-heart text-pink-500 mb-1"></i><span class="font-black text-white text-lg">${fmt(totalLike/allVids.length)}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Tim TB</span></div>
                <div class="stat-box"><i class="fa-solid fa-play text-emerald-400 mb-1"></i><span class="font-black text-white text-lg">${fmt(totalPlay)}</span><span class="text-[9px] text-zinc-500 uppercase font-bold">Tổng View Đã Quét</span></div>
            </div>

            <div class="mb-2">
                <h4 class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"><i class="fa-solid fa-hashtag text-cyan-400"></i> Bảng băm Top Hashtag</h4>
                <div class="flex flex-wrap gap-1.5">${tagsHtml}</div>
            </div>
        </div>
        <h3 class="text-center text-xs font-black text-zinc-600 uppercase tracking-[0.3em] mb-4 mt-8"><i class="fa-solid fa-crown text-yellow-500 mr-1"></i> Các Tệp Lan Truyền Nhất Kênh</h3>
        `;
        area.classList.remove('hidden');

        // Bơm data vào thẻ Lưới Grid Cards chuẩn
        fetchedVideos = mapUserVideos(allVids, user, pAuthor);
        
        // Mặc định ở Analytics sẽ lọc top 10 video viral nhất để hiển thị
        fetchedVideos.sort((a,b) => parseRaw(b.data.stats.play) - parseRaw(a.data.stats.play));
        fetchedVideos = fetchedVideos.slice(0, 10);
        
        renderedCount = 0;
        showToolbar(false); // Hide sort tools inside Analytics to keep it clean
        renderNextPage();
        
    } catch(e) { showError(e.message); }
    finally { showLoading(false); if(btn) btn.disabled = false; }
}

// ═══════════════════════════════════════════════════
//  MODAL CHI TIẾT TỆP
// ═══════════════════════════════════════════════════
function openVideoDetail(index) {
    const item = fetchedVideos[index];
    if (!item) return;
    const d = item.data;
    const isImg = d.images && d.images.length > 0;

    // Lõi Truyền Thông
    const media = document.getElementById('detail-media');
    if (isImg) {
        // STYLE NHẬT KÝ ẢNH (CUỘN KHÓA 1 ẢNH)
        const slides = d.images.map((img,i) => `
            <div class="w-full h-full shrink-0 flex items-center justify-center snap-center" style="scroll-snap-stop: always;">
                <img src="${img}" class="max-w-full max-h-full object-contain" referrerpolicy="no-referrer">
                <span class="absolute bottom-3 right-3 text-[10px] font-bold bg-black/70 px-2.5 py-1 rounded-lg text-white border border-white/10">${i+1}/${d.images.length}</span>
            </div>`).join('');
            
        media.innerHTML = `
            <div class="relative w-full h-full group">
                <div id="slides-wrap" class="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth" style="scrollbar-width:none">
                    ${slides}
                </div>
                <button onclick="let c=document.getElementById('slides-wrap'); c.scrollBy({left:-c.clientWidth,behavior:'smooth'})" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition border border-white/10"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <button onclick="let c=document.getElementById('slides-wrap'); c.scrollBy({left:c.clientWidth,behavior:'smooth'})"  class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition border border-white/10"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                <span class="absolute top-3 left-3 badge badge-img shadow-lg"><i class="fa-regular fa-images"></i> Nhật Ký Ảnh</span>
            </div>`;
    } else {
        media.innerHTML = `<video controls playsinline autoplay class="w-full h-full object-contain" poster="${d.urls.cover}"><source src="${d.urls.no_watermark}" type="video/mp4"></video>`;
    }

    // Khối Thông Tin
    const safe = (d.video_data.description||'Không có mô tả.').replace(/</g,'&lt;');
    document.getElementById('detail-info').innerHTML = `
        <div onclick="searchUserFromDetail('${d.author.uniqueId}')" class="flex items-center gap-3 bg-[#131313] border border-[#1e1e1e] rounded-2xl p-3.5 mb-4 cursor-pointer hover:border-blue-500/40 transition">
            <img src="${d.author.avatar}" class="w-10 h-10 rounded-full object-cover border border-[#222] bg-zinc-800 shrink-0" referrerpolicy="no-referrer">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-white text-sm flex items-center gap-1 truncate">${d.author.nickname}${d.author.verified?'<i class="fa-solid fa-circle-check text-blue-500 text-xs"></i>':''}</p>
                <p class="text-zinc-500 text-xs truncate">@${d.author.uniqueId}</p>
            </div>
            <i class="fa-solid fa-arrow-right text-zinc-600 text-xs"></i>
        </div>

        <div class="flex items-center gap-2.5 bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3 mb-4">
            <div class="w-7 h-7 rounded-full bg-[#151515] border border-[#222] flex items-center justify-center shrink-0"><i class="fa-solid fa-music text-blue-400 text-[10px]"></i></div>
            <p class="text-zinc-300 text-xs font-semibold truncate">${d.music?.title||'Âm thanh gốc'}</p>
        </div>

        <div class="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-4 mb-5">
            <p class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">Đoạn văn</p>
            <p class="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">${safe}</p>
        </div>

        <h4 class="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2"><i class="fa-solid fa-list-ul"></i> Mục Lục Báo Cáo</h4>
        <div class="space-y-2 mb-6">
            ${[
                ['fa-hashtag text-purple-400','ID Tệp',d.video_data.id],
                ['fa-clock text-orange-400','Ngày Đăng',d.video_data.create_time ? new Date(d.video_data.create_time*1000).toLocaleString('vi-VN') : 'N/A'],
                ['fa-earth-asia text-blue-400','Khu Vực',(d.video_data.region||'Quốc tế').toUpperCase()],
                ['fa-stopwatch text-rose-400','Thời Lượng',d.video_data.duration ? d.video_data.duration+'s' : 'N/A'],
                ['fa-heart-pulse text-pink-400','Like / View', (parseRaw(d.stats.play)>0 ? ((parseRaw(d.stats.like)/parseRaw(d.stats.play))*100).toFixed(1) : 0) + '%'],
                ['fa-download text-zinc-400','Lượt Save',fmt(d.stats.download)],
            ].map(([ic,lbl,val])=>`
            <div class="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5">
                <span class="text-zinc-500 text-[11px] font-bold flex items-center gap-1.5"><i class="fa-solid ${ic} w-4 text-center"></i>${lbl}</span>
                <span class="text-white text-xs font-bold">${val}</span>
            </div>`).join('')}
        </div>

        <div class="grid grid-cols-4 gap-2 mb-6">
            ${[['play','View','blue'],['like','Tim','pink'],['comment','Cmt','zinc'],['share','Share','zinc']].map(([k,l,c])=>`<div class="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl py-3 flex flex-col items-center gap-0.5"><span class="font-black text-white text-sm">${fmt(d.stats[k])}</span><span class="text-[9px] text-zinc-500 font-bold uppercase">${l}</span></div>`).join('')}
        </div>
        
        <a href="${item.link}" target="_blank" class="w-full bg-[#111] hover:bg-white text-white hover:text-black border border-[#222] font-black py-4 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-md">
            <i class="fa-brands fa-tiktok text-lg"></i> Mở trên ứng dụng TikTok
        </a>
    `;

    // CỤM ACTION NÚT TẢI
    const fnMp4 = genFile(d.author.uniqueId, d.video_data.id, 'mp4');
    const fnMp3 = genFile(d.author.uniqueId, d.video_data.id, 'mp3');
    document.getElementById('detail-actions').innerHTML = isImg ? `
        <button onclick="downloadImages(${index},this)" class="btn-primary py-3 text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-images"></i> Tải Trọn Bộ Ảnh</button>
        <button onclick="forceDownload('${d.music?.playUrl||''}','${fnMp3}',this)" class="btn-ghost py-2.5 text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-music"></i> Tải Nhạc MP3</button>
    ` : `
        <button onclick="forceDownload('${d.urls.no_watermark}','${fnMp4}',this)" class="btn-primary py-3 text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-download"></i> Tải Video MP4</button>
        <button onclick="forceDownload('${d.music?.playUrl||''}','${fnMp3}',this)" class="btn-ghost py-2.5 text-sm flex items-center justify-center gap-2"><i class="fa-solid fa-music"></i> Tải Nhạc MP3</button>
    `;

    document.getElementById('video-detail-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    document.getElementById('video-detail-modal')?.classList.remove('open');
    document.body.style.overflow = '';
    const v = document.querySelector('#detail-media video');
    if (v) { v.pause(); v.src = ''; v.load(); }
    document.getElementById('detail-media').innerHTML = '';
}

function searchUserFromDetail(username) {
    closeDetailModal();
    switchTab('info');
    document.getElementById('tiktok-username').value = username;
    fetchUserInfo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════
//  DOWNLOAD HELPERS (TRÌNH QUẢN LÝ TẢI)
// ═══════════════════════════════════════════════════
async function forceDownload(url, filename, btn) {
    if (!url) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tải...';
    btn.style.pointerEvents = 'none';

    const dl = async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error('fail');
        const blob = await r.blob();
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename, style: 'display:none' });
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
    };

    try { await dl(url); }
    catch { try { await dl(`https://corsproxy.io/?${encodeURIComponent(url)}`); } catch { window.open(url,'_blank'); } }
    finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Xong';
        setTimeout(() => { btn.innerHTML = orig; btn.style.pointerEvents = 'auto'; }, 2000);
    }
}

async function downloadImages(index, btn) {
    const d = fetchedVideos[index].data;
    if (!d.images?.length) return;
    const orig = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Tải ${d.images.length} ảnh...`;
    btn.style.pointerEvents = 'none';
    for (let i = 0; i < d.images.length; i++) {
        const fname = `${d.author.uniqueId}_${d.video_data.id}_${i+1}.jpg`;
        try {
            const r = await fetch(d.images[i]);
            const blob = await r.blob();
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fname, style: 'display:none' });
            document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
        } catch { window.open(d.images[i], '_blank'); }
        await new Promise(r => setTimeout(r, 380));
    }
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Xong';
    setTimeout(() => { btn.innerHTML = orig; btn.style.pointerEvents = 'auto'; }, 2000);
}

async function downloadAllVideos(btn) {
    if (!fetchedVideos.length) return;
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    for (const item of fetchedVideos) {
        const d = item.data;
        if (d.images?.length) {
            for (let j=0;j<d.images.length;j++) {
                const fname = `${d.author.uniqueId}_${d.video_data.id}_${j+1}.jpg`;
                try { const r=await fetch(d.images[j]); const blob=await r.blob(); const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'}); document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove(); } catch { window.open(d.images[j],'_blank'); }
                await new Promise(r => setTimeout(r, 380));
            }
        } else {
            const fname = genFile(d.author.uniqueId, d.video_data.id, 'mp4');
            try { const r=await fetch(d.urls.no_watermark); const blob=await r.blob(); const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:fname,style:'display:none'}); document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove(); } catch { window.open(d.urls.no_watermark,'_blank'); }
        }
        await new Promise(r => setTimeout(r, 750));
    }
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Hoàn Tất';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
}

// ── FORMAT TIKWM ĐỊNH DẠNG GRID ──
function formatTikWm(vids) {
    return vids.map(v => ({
        link: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
        data: {
            status: 'Live',
            author: { uniqueId: v.author.unique_id, nickname: v.author.nickname, avatar: v.author.avatar||v.cover, verified: v.author.is_verify||v.author.verified||false },
            video_data: { id: v.video_id, description: v.title, create_time: v.create_time, duration: v.duration||0, region: v.region||'VN' },
            stats: { play: parseRaw(v.play_count), like: parseRaw(v.digg_count), comment: parseRaw(v.comment_count), share: parseRaw(v.share_count), download: parseRaw(v.download_count||0) },
            urls: { cover: v.cover, no_watermark: v.play },
            music: { playUrl: v.music, title: v.music_info?.title||'Âm thanh gốc' },
            images: v.images||null
        }
    }));
}

// ── XUẤT WINDOW GLOBALS BẢO VỆ ──
window.switchTab          = switchTab;
window.setLinkMode        = setLinkMode;
window.openGuide          = openGuide;
window.toggleExpand       = toggleExpand;
window.sortVideos         = sortVideos;
window.processVideos      = processVideos;
window.searchTikTok       = searchTikTok;
window.searchRandom       = searchRandom;
window.fetchUserInfo      = fetchUserInfo;
window.fetchAnalytics     = fetchAnalytics;
window.openVideoDetail    = openVideoDetail;
window.closeDetailModal   = closeDetailModal;
window.searchUserFromDetail = searchUserFromDetail;
window.forceDownload      = forceDownload;
window.downloadImages     = downloadImages;
window.downloadAllVideos  = downloadAllVideos;
