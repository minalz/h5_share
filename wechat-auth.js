const crypto = require('node:crypto');
const net = require('node:net');

const PROFILE_PATH = '/api/wechat/profile';
const AUTHORIZE_PATH = '/api/wechat/authorize';
const CALLBACK_PATH = '/api/wechat/callback';
const AVATAR_PATH = '/api/wechat/avatar';
const STATE_COOKIE = '__Host-wx_oauth_state';
const ATTEMPT_COOKIE = '__Host-wx_oauth_attempt';
const SESSION_COOKIE = '__Host-wx_avatar_session';
const STATE_TTL = 5 * 60 * 1000;
const ATTEMPT_TTL = 10 * 60 * 1000;
const SESSION_TTL = 60 * 60 * 1000;
const MAX_RECORDS = 200;
const AVATAR_HOSTS = new Set(['wx.qlogo.cn', 'thirdwx.qlogo.cn']);
const API_LIMIT = 256 * 1024;
const AVATAR_LIMIT = 2 * 1024 * 1024;
const nicknameSegments = new Intl.Segmenter('zh', { granularity: 'grapheme' });

function safeNickname(value) {
  if (typeof value !== 'string') return '';
  // Keep emoji joiners/variation selectors while removing controls and bidi overrides.
  const cleaned = Array.from(value.replace(/[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, ''))
    .filter(character => { const point = character.codePointAt(0); return point < 0xd800 || point > 0xdfff; }).join('').trim();
  let result = '';
  let count = 0;
  let bytes = 0;
  for (const { segment } of nicknameSegments.segment(cleaned)) {
    const size = Buffer.byteLength(segment, 'utf8');
    if (count >= 64 || bytes + size > 512) break;
    result += segment;
    bytes += size;
    count++;
  }
  return result.trim();
}

function publicHostname(hostname) {
  const host = hostname.toLowerCase();
  return !net.isIP(host.replace(/^\[|\]$/g, '')) && host.includes('.') &&
    !/^(localhost|.*\.(localhost|local|internal|lan|home|test|invalid))$/.test(host) &&
    /^[a-z0-9.-]+$/.test(host) && !host.endsWith('.');
}

function readConfig(env) {
  const appId = String(env.WECHAT_APP_ID || '').trim();
  const appSecret = String(env.WECHAT_APP_SECRET || '').trim();
  let redirect;
  try { redirect = new URL(String(env.WECHAT_OAUTH_REDIRECT_URI || '').trim()); } catch { return null; }
  if (!/^wx[a-zA-Z0-9]{8,64}$/.test(appId) || !appSecret || /[\s\x00-\x1f]/.test(appSecret) ||
      redirect.protocol !== 'https:' || !publicHostname(redirect.hostname) || redirect.port ||
      redirect.username || redirect.password || redirect.pathname !== CALLBACK_PATH || redirect.search || redirect.hash) return null;
  return { appId, appSecret, redirect };
}

function cookies(req) {
  const result = Object.create(null);
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (Object.hasOwn(result, name)) continue;
    result[name] = part.slice(index + 1).trim();
  }
  return result;
}

function addCookie(res, name, value, ttl) {
  const previous = res.getHeader('Set-Cookie') || [];
  const cookie = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(ttl / 1000)}`;
  res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), cookie]);
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

function redirectHome(res) {
  res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
}

function avatarUrl(value) {
  try {
    const url = new URL(value);
    // Older WeChat accounts can return an http URL for the same Tencent endpoint.
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || !AVATAR_HOSTS.has(url.hostname) || url.port || url.username || url.password ||
        !url.pathname.startsWith('/mmopen/') || url.hash) return null;
    return url.href;
  } catch { return null; }
}

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) return 'image/gif';
  return null;
}

function createWechatAuth({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const config = readConfig(env);
  const states = new Map();
  const sessions = new Map();

  function purge(map) {
    const timestamp = now();
    for (const [key, value] of map) if (value.expiresAt <= timestamp) map.delete(key);
    while (map.size > MAX_RECORDS) map.delete(map.keys().next().value);
  }

  function remember(map, key, value) {
    if (map.size >= MAX_RECORDS) map.delete(map.keys().next().value);
    map.set(key, value);
  }

  function expectedHost(req) {
    if (!config || !req.headers.host) return false;
    try {
      const host = String(req.headers.host);
      const parsed = new URL('https://' + host);
      return parsed.host === config.redirect.host && parsed.pathname === '/' && !parsed.username && !parsed.password &&
        !parsed.search && !parsed.hash && !/[\s\\/]/.test(host);
    } catch { return false; }
  }

  function isWechat(req) { return /MicroMessenger\//i.test(String(req.headers['user-agent'] || '')); }

  function session(req) {
    if (!expectedHost(req)) return null;
    const id = cookies(req)[SESSION_COOKIE];
    const stored = typeof id === 'string' && /^[a-f0-9]{64}$/.test(id) ? sessions.get(id) : null;
    if (!stored) return null;
    if (stored.expiresAt <= now()) { sessions.delete(id); return null; }
    return stored;
  }

  async function limitedFetch(url, limit, acceptedType) {
    if (typeof fetchImpl !== 'function') throw new Error('Unavailable');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: acceptedType } });
      if (!response.ok || response.redirected || !response.body) throw new Error('Invalid response');
      const declaredLength = Number(response.headers.get('content-length'));
      if (declaredLength > limit) { controller.abort(); throw new Error('Too large'); }
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > limit) { controller.abort(); await reader.cancel().catch(() => {}); throw new Error('Too large'); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      return { buffer: Buffer.concat(chunks, length), type: String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
    } finally { clearTimeout(timer); }
  }

  async function apiJson(url) {
    const { buffer } = await limitedFetch(url, API_LIMIT, 'application/json');
    const body = JSON.parse(buffer.toString('utf8'));
    if (!body || typeof body !== 'object' || (body.errcode && body.errcode !== 0)) throw new Error('WeChat rejected request');
    return body;
  }

  return async function handleWechatAuth(req, res) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return false; }
    if (![PROFILE_PATH, AUTHORIZE_PATH, CALLBACK_PATH, AVATAR_PATH].includes(url.pathname)) return false;
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      json(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    purge(states);
    purge(sessions);
    const jar = cookies(req);
    try {
      if (url.pathname === PROFILE_PATH) {
        const stored = session(req);
        if (stored) {
          const result = { available: Boolean(stored.avatar), nickname: stored.nickname };
          if (stored.avatar) result.avatarUrl = AVATAR_PATH;
          else result.configured = true;
          json(res, 200, result);
        }
        else {
          const result = { available: false, configured: Boolean(config) };
          if (expectedHost(req) && isWechat(req) && !jar[ATTEMPT_COOKIE]) result.authorizeUrl = AUTHORIZE_PATH;
          json(res, 200, result);
        }
      } else if (url.pathname === AUTHORIZE_PATH) {
        const origin = req.headers.origin;
        if (!expectedHost(req) || !isWechat(req) || jar[ATTEMPT_COOKIE] ||
            (origin && origin !== config.redirect.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
          redirectHome(res);
          return true;
        }
        const state = crypto.randomBytes(32).toString('hex');
        remember(states, state, { expiresAt: now() + STATE_TTL });
        addCookie(res, STATE_COOKIE, state, STATE_TTL);
        addCookie(res, ATTEMPT_COOKIE, '1', ATTEMPT_TTL);
        const authorize = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
        authorize.search = new URLSearchParams({ appid: config.appId, redirect_uri: config.redirect.href,
          response_type: 'code', scope: 'snsapi_userinfo', state }).toString();
        authorize.hash = 'wechat_redirect';
        res.writeHead(302, { Location: authorize.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        res.end();
      } else if (url.pathname === CALLBACK_PATH) {
        addCookie(res, STATE_COOKIE, '', 0);
        addCookie(res, ATTEMPT_COOKIE, '1', ATTEMPT_TTL);
        const state = url.searchParams.get('state');
        const bound = jar[STATE_COOKIE];
        const pending = typeof bound === 'string' ? states.get(bound) : null;
        if (!expectedHost(req) || !pending || pending.expiresAt <= now() ||
            !state || !/^[a-f0-9]{64}$/.test(state) || state !== bound) {
          redirectHome(res);
          return true;
        }
        states.delete(bound);
        const code = url.searchParams.get('code');
        if (!code || code.length > 1024) { redirectHome(res); return true; }
        const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
        tokenUrl.search = new URLSearchParams({ appid: config.appId, secret: config.appSecret, code, grant_type: 'authorization_code' }).toString();
        const token = await apiJson(tokenUrl.href);
        if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 4096 ||
            typeof token.openid !== 'string' || !token.openid || token.openid.length > 256) throw new Error('Invalid token');
        const infoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
        infoUrl.search = new URLSearchParams({ access_token: token.access_token, openid: token.openid, lang: 'zh_CN' }).toString();
        const info = await apiJson(infoUrl.href);
        if (info.openid && info.openid !== token.openid) throw new Error('Invalid profile');
        const avatar = typeof info.headimgurl === 'string' ? avatarUrl(info.headimgurl) : null;
        const id = crypto.randomBytes(32).toString('hex');
        remember(sessions, id, { avatar, nickname: safeNickname(info.nickname), expiresAt: now() + SESSION_TTL });
        addCookie(res, SESSION_COOKIE, id, SESSION_TTL);
        redirectHome(res);
      } else {
        const stored = session(req);
        if (!stored || !stored.avatar) { json(res, 404, { error: 'avatar_unavailable' }); return true; }
        const { buffer, type } = await limitedFetch(stored.avatar, AVATAR_LIMIT, 'image/jpeg,image/png,image/webp,image/gif');
        const detectedType = imageType(buffer);
        if (!detectedType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new Error('Invalid avatar');
        res.writeHead(200, { 'Content-Type': detectedType, 'Content-Length': buffer.length,
          'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
        res.end(buffer);
      }
    } catch {
      // OAuth codes, tokens and account secrets must never appear in logs or responses.
      if (url.pathname === CALLBACK_PATH || url.pathname === AUTHORIZE_PATH) redirectHome(res);
      else json(res, 502, { error: 'avatar_unavailable' });
    }
    return true;
  };
}

module.exports = { createWechatAuth };
