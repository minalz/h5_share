const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createWechatAuth } = require('./wechat-auth');
const handleWechatAuth = createWechatAuth();
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
http.createServer(async (req, res) => {
  if (await handleWechatAuth(req, res)) return;
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  const relative = path.relative(root, file);
  const resource = relative.split(path.sep).join('/');
  const allowed = ['index.html', 'detail.html', 'detail-store.js', 'detail-page.js', 'manifest.webmanifest', 'app.js', 'profile-cache.js', 'moments-view.js', 'styles.css', 'assets/avatars/manifest.json'].includes(resource) || /^assets\/avatars\/(women|men|daily|cartoon)-\d+\.jpg$/.test(resource);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !allowed) { res.writeHead(404).end(); return; }
  fs.readFile(file, (error, content) => { if (error) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store, max-age=0', 'X-H5-Share-Version':'20261022-2' }); res.end(content); });
}).listen(Number(process.env.PORT) || 5173, '0.0.0.0', () => console.log('Local: http://localhost:' + (process.env.PORT || 5173) + '\n手机请使用本机局域网 IP 和相同端口访问。'));
