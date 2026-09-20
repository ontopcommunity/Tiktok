import { proxyStatus, hasProxyConfigured } from "./_proxy.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const status = await proxyStatus();
  const enabled = await hasProxyConfigured();
  return res.status(200).json({
    ok: true,
    message: enabled
      ? `Proxy sẵn sàng (${status.count} IP, source: ${status.source}) — mỗi request chọn ngẫu nhiên`
      : "Chưa có proxy. Set PROXY_URLS hoặc để PROXY_AUTO (mặc định) lấy từ ProxyScrape",
    proxy: status,
    note: "Free proxy thường chết nhanh. Nên dùng PROXY_URLS residential nếu cần ổn định.",
    playwright:
      "Playwright không chạy ổn trên Vercel serverless (thiếu browser binary + timeout). Cần VPS riêng nếu muốn.",
  });
}
