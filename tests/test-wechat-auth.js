const assert = require('node:assert/strict');
const { createWechatAuth } = require('../wechat-auth');

const env = { WECHAT_APP_ID: 'wx1234567890abcdef', WECHAT_APP_SECRET: 'fixture-secret', WECHAT_OAUTH_REDIRECT_URI: 'https://moments.example.com/api/wechat/callback' };
const wechatHeaders = { host: 'moments.example.com', 'user-agent': 'MicroMessenger/8.0' };

async function request(handler, url, headers = {}, method = 'GET') {
  const response = {
    status: 0, headers: {}, body: '',
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(status, headers = {}) { this.status = status; for (const [name, value] of Object.entries(headers)) this.setHeader(name, value); return this; },
    end(body = '') { this.body = body; return this; },
  };
  response.handled = await handler({ url, method, headers: { host: 'localhost:5173', ...headers } }, response);
  return response;
}

function jar(response) { return (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; '); }
function body(response) { return JSON.parse(response.body); }

(async () => {
  let fetchCalls = 0;
  const noNetwork = async () => { fetchCalls++; throw new Error('Test must not access network'); };
  const unconfigured = createWechatAuth({ env: {}, fetchImpl: noNetwork });
  assert.deepEqual(body(await request(unconfigured, '/api/wechat/profile')), { available: false, configured: false });
  assert.deepEqual(body(await request(unconfigured, '/api/wechat/profile', wechatHeaders)), { available: false, configured: false });
  assert.equal((await request(unconfigured, '/api/wechat/authorize', wechatHeaders)).headers.location, '/');
  assert.equal((await request(unconfigured, '/api/wechat/callback?code=untrusted&state=x', wechatHeaders)).headers.location, '/');
  assert.equal((await request(unconfigured, '/api/wechat/avatar?url=https://example.com')).status, 404);
  assert.equal((await request(unconfigured, '/api/wechat/profile', {}, 'POST')).status, 405);
  assert.equal((await request(unconfigured, '/app.js')).handled, false);
  assert.equal(fetchCalls, 0);

  for (const redirect of ['http://moments.example.com/api/wechat/callback', 'https://127.0.0.1/api/wechat/callback', 'https://192.168.1.1/api/wechat/callback', 'https://localhost/api/wechat/callback']) {
    const handler = createWechatAuth({ env: { ...env, WECHAT_OAUTH_REDIRECT_URI: redirect }, fetchImpl: noNetwork });
    assert.equal(body(await request(handler, '/api/wechat/profile', wechatHeaders)).configured, false);
  }

  const handler = createWechatAuth({ env, fetchImpl: noNetwork });
  assert.deepEqual(body(await request(handler, '/api/wechat/profile')), { available: false, configured: true });
  assert.equal(body(await request(handler, '/api/wechat/profile', wechatHeaders)).authorizeUrl, '/api/wechat/authorize');
  assert.equal(body(await request(handler, '/api/wechat/profile', { ...wechatHeaders, host: '192.168.1.1:5173' })).authorizeUrl, undefined);
  assert.equal(body(await request(handler, '/api/wechat/profile', { ...wechatHeaders, 'user-agent': 'Desktop' })).authorizeUrl, undefined);
  assert.equal((await request(handler, '/api/wechat/authorize', { ...wechatHeaders, 'sec-fetch-site': 'cross-site' })).headers.location, '/');

  const authorization = await request(handler, '/api/wechat/authorize', wechatHeaders);
  assert.equal(authorization.status, 302);
  const authorizeUrl = new URL(authorization.headers.location);
  assert.equal(authorizeUrl.origin, 'https://open.weixin.qq.com');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'snsapi_userinfo');
  assert(!authorization.headers.location.includes('fixture-secret'));
  assert(authorization.headers['set-cookie'].every(cookie => cookie.includes('HttpOnly; Secure; SameSite=Lax')));
  assert.equal(body(await request(handler, '/api/wechat/profile', { ...wechatHeaders, cookie: jar(authorization) })).authorizeUrl, undefined);
  await request(handler, '/api/wechat/callback?code=unused&state=' + 'a'.repeat(64), { ...wechatHeaders, cookie: jar(authorization) });
  assert.equal(fetchCalls, 0);

  const remoteRequests = [];
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  let avatar = 'http://thirdwx.qlogo.cn/mmopen/test/132';
  let nickname = '  小\u0000李\n👩🏽‍💻  ';
  let mode = 'ok';
  let timestamp = 1000;
  const configured = createWechatAuth({ env, now: () => timestamp, fetchImpl: async (url, options) => {
    remoteRequests.push(url);
    assert.equal(options.redirect, 'error');
    if (url.startsWith('https://api.weixin.qq.com/sns/oauth2/access_token')) return Response.json({ access_token: 'private-token', openid: 'private-openid' });
    if (url.startsWith('https://api.weixin.qq.com/sns/userinfo')) return Response.json({ openid: 'private-openid', headimgurl: avatar, nickname });
    if (mode === 'redirect') return new Response('', { status: 302, headers: { Location: 'https://untrusted.example.org/avatar' } });
    if (mode === 'oversize') return new Response(png, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(3 * 1024 * 1024) } });
    if (mode === 'html') return new Response('<html>bad</html>', { headers: { 'Content-Type': 'image/png' } });
    return new Response(png, { headers: { 'Content-Type': 'image/png' } });
  } });
  async function login() {
    const start = await request(configured, '/api/wechat/authorize', wechatHeaders);
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(configured, '/api/wechat/callback?code=fixture-code&state=' + state, { ...wechatHeaders, cookie: jar(start) });
    assert.equal(callback.headers.location, '/');
    return { start, state, callback, headers: { ...wechatHeaders, cookie: jar(callback) } };
  }
  const loggedIn = await login();
  const initialProfile = await request(configured, '/api/wechat/profile', loggedIn.headers);
  assert.deepEqual(body(initialProfile), { available: true, avatarUrl: '/api/wechat/avatar', nickname: '小李👩🏽‍💻' });
  assert(!initialProfile.body.includes('private-token'));
  assert(!initialProfile.body.includes('private-openid'));
  assert(!initialProfile.body.includes('fixture-secret'));
  const downloaded = await request(configured, '/api/wechat/avatar?url=https://untrusted.example.org', loggedIn.headers);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(downloaded.body, png);
  assert.equal(remoteRequests.at(-1), 'https://thirdwx.qlogo.cn/mmopen/test/132');
  const callsBeforeReplay = remoteRequests.length;
  await request(configured, '/api/wechat/callback?code=fixture-code&state=' + loggedIn.state, { ...wechatHeaders, cookie: jar(loggedIn.start) });
  assert.equal(remoteRequests.length, callsBeforeReplay);
  for (mode of ['redirect', 'oversize', 'html']) assert.equal((await request(configured, '/api/wechat/avatar', loggedIn.headers)).status, 502);
  avatar = 'https://untrusted.example.org/mmopen/avatar';
  nickname = '无头像的昵称🌻';
  const invalid = await login();
  assert.deepEqual(body(await request(configured, '/api/wechat/profile', invalid.headers)), { available: false, configured: true, nickname: '无头像的昵称🌻' });
  const beforeMissingAvatar = remoteRequests.length;
  assert.equal((await request(configured, '/api/wechat/avatar', invalid.headers)).status, 404);
  assert.equal(remoteRequests.length, beforeMissingAvatar, 'Missing avatar must not cause any remote fetch');
  for (nickname of ['', '  \r\n\t\u0000\u0085\u202e  ', null, 123, {}, ['昵称']]) {
    const empty = await login();
    assert.deepEqual(body(await request(configured, '/api/wechat/profile', empty.headers)), { available: false, configured: true, nickname: '' });
  }
  avatar = '';
  nickname = '👩🏽‍💻'.repeat(70);
  const longEmoji = await login();
  const clipped = body(await request(configured, '/api/wechat/profile', longEmoji.headers)).nickname;
  const emojiCount = [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(clipped)].length;
  assert(clipped.length > 0 && Buffer.byteLength(clipped, 'utf8') <= 512);
  assert(emojiCount <= 64);
  assert.equal(clipped, '👩🏽‍💻'.repeat(emojiCount));
  nickname = '李'.repeat(80);
  const longChinese = await login();
  assert.equal(body(await request(configured, '/api/wechat/profile', longChinese.headers)).nickname, '李'.repeat(64));
  nickname = '昵称\ud800';
  const malformed = await login();
  assert.equal(body(await request(configured, '/api/wechat/profile', malformed.headers)).nickname, '昵称');
  timestamp += 61 * 60 * 1000;
  assert.equal(body(await request(configured, '/api/wechat/profile', loggedIn.headers)).available, false);
  assert.equal(body(await request(configured, '/api/wechat/profile', loggedIn.headers)).nickname, undefined);
  assert.equal(body(await request(configured, '/api/wechat/profile', invalid.headers)).nickname, undefined);
  assert.equal((await request(configured, '/api/wechat/avatar', loggedIn.headers)).status, 404);
  console.log('WeChat profile/nickname fallback, OAuth state/session and restricted avatar tests passed. No network requests made.');
})().catch(error => { console.error(error); process.exitCode = 1; });
