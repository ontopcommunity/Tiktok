import { proxyStatus, hasProxyConfigured } from "./_proxy.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    ok: true,
    message: hasProxyConfigured()
      ? "Proxy đã cấu hình — mỗi request sẽ chọn ngẫu nhiên 1 IP"
      : "Chưa có PROXY_URLS. Thêm env trên Vercel: PROXY_URLS=http://user:pass@ip:port,http://ip2:port",
    proxy: proxyStatus(),
  });
}
