/**
 * Proxy helper — chọn ngẫu nhiên 1 proxy từ env PROXY_URLS
 * PROXY_URLS=http://user:pass@host:port,http://ip2:port
 */

function getProxyList() {
  const raw = process.env.PROXY_URLS || process.env.PROXY_LIST || "";
  if (!raw.trim()) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.startsWith("http://") ||
        s.startsWith("https://") ||
        s.startsWith("socks5://") ||
        s.startsWith("socks://")
    );
}

export function pickProxy() {
  const list = getProxyList();
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function hasProxyConfigured() {
  return getProxyList().length > 0;
}

export function proxyStatus() {
  const list = getProxyList();
  return {
    count: list.length,
    enabled: list.length > 0,
    samples: list.slice(0, 3).map((u) => u.replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@")),
  };
}

/**
 * fetch qua proxy ngẫu nhiên (nếu có PROXY_URLS)
 */
export async function proxyFetch(url, options = {}) {
  const proxyUrl = pickProxy();
  const timeoutMs = options.timeoutMs || 25000;
  const opts = { ...options };
  delete opts.timeoutMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (proxyUrl) {
      try {
        const { ProxyAgent, fetch: undiciFetch } = await import("undici");
        const agent = new ProxyAgent(proxyUrl);
        console.log("[proxy] using", proxyUrl.replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@"));
        return await undiciFetch(url, {
          ...opts,
          signal: controller.signal,
          dispatcher: agent,
        });
      } catch (e) {
        console.error("[proxy] undici failed, fallback direct:", e.message);
      }
    }
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
