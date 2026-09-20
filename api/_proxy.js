/**
 * Proxy helper
 * 1) PROXY_URLS (manual list)
 * 2) Auto-fetch free list từ ProxyScrape (cache 5 phút)
 * Mỗi request chọn ngẫu nhiên 1 IP
 */

const PROXY_SCRAPE_DEFAULT =
  "https://api.proxyscrape.com/v4/free-proxy-list/get?protocol=http&timeout=5000&country=all&ssl=all&anonymity=all&limit=500&request=getproxies";

let cachedProxies = [];
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function parseList(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("socks")) return s;
      // host:port → http://host:port
      if (/^[\d.]+:\d+$/.test(s) || /^[a-zA-Z0-9.-]+:\d+$/.test(s)) return `http://${s}`;
      return s;
    })
    .filter(
      (s) =>
        s.startsWith("http://") ||
        s.startsWith("https://") ||
        s.startsWith("socks5://") ||
        s.startsWith("socks://")
    );
}

async function fetchProxyScrape() {
  const url = process.env.PROXY_SCRAPE_URL || PROXY_SCRAPE_DEFAULT;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    const list = parseList(text);
    console.log("[proxy] scraped", list.length, "proxies");
    return list;
  } catch (e) {
    console.error("[proxy] scrape failed:", e.message);
    return [];
  }
}

async function getProxyList() {
  const manual = parseList(process.env.PROXY_URLS || process.env.PROXY_LIST || "");
  const auto = process.env.PROXY_AUTO !== "0";

  let scraped = [];
  if (auto) {
    if (cachedProxies.length && Date.now() - cacheAt < CACHE_MS) {
      scraped = cachedProxies;
    } else {
      scraped = await fetchProxyScrape();
      if (scraped.length) {
        cachedProxies = scraped;
        cacheAt = Date.now();
      } else {
        scraped = cachedProxies; // keep old cache if scrape fails
      }
    }
  }

  // Gộp manual + scraped, bỏ trùng
  const seen = new Set();
  const merged = [];
  for (const p of [...manual, ...scraped]) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }
  return merged;
}

export async function pickProxy() {
  const list = await getProxyList();
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export async function hasProxyConfigured() {
  const list = await getProxyList();
  return list.length > 0;
}

export async function proxyStatus() {
  const manual = parseList(process.env.PROXY_URLS || process.env.PROXY_LIST || "");
  const list = await getProxyList();
  let source = "none";
  if (manual.length && list.length > manual.length) source = "manual+auto";
  else if (manual.length) source = "PROXY_URLS";
  else if (list.length) source = "proxyscrape_auto";
  return {
    count: list.length,
    enabled: list.length > 0,
    source,
    cache_age_sec: cacheAt ? Math.floor((Date.now() - cacheAt) / 1000) : null,
    samples: list.slice(0, 3).map((u) => u.replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@")),
  };
}

/**
 * fetch qua proxy ngẫu nhiên; thử tối đa 3 proxy nếu fail
 */
export async function proxyFetch(url, options = {}) {
  const timeoutMs = options.timeoutMs || 6000;
  const maxTries = options.maxProxyTries || 2;
  const opts = { ...options };
  delete opts.timeoutMs;
  delete opts.maxProxyTries;

  const list = await getProxyList();
  const tried = new Set();

  // Shuffle a few candidates
  const candidates = [];
  if (list.length) {
    const copy = [...list];
    for (let i = 0; i < Math.min(maxTries, copy.length); i++) {
      const idx = Math.floor(Math.random() * copy.length);
      candidates.push(copy.splice(idx, 1)[0]);
    }
  } else {
    candidates.push(null); // direct
  }

  let lastErr = null;

  for (const proxyUrl of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (proxyUrl) {
        const { ProxyAgent, fetch: undiciFetch } = await import("undici");
        const agent = new ProxyAgent(proxyUrl);
        console.log("[proxy] try", proxyUrl.replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@"));
        const res = await undiciFetch(url, {
          ...opts,
          signal: controller.signal,
          dispatcher: agent,
        });
        // Nếu CF HTML, thử proxy khác
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html") && url.includes("tikwm")) {
          const peek = await res.clone().text();
          if (peek.includes("Just a moment") || peek.includes("cf-browser-verification")) {
            console.log("[proxy] CF challenge, next...");
            lastErr = new Error("CF challenge");
            continue;
          }
          // reconstruct - already consumed clone, use original if not CF
          // actually we peeked clone, original still ok
          return res;
        }
        return res;
      }
      // direct
      return await fetch(url, { ...opts, signal: controller.signal });
    } catch (e) {
      lastErr = e;
      console.error("[proxy] fail:", e.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // last resort direct
  try {
    return await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw lastErr || e;
  }
}
