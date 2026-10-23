const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const nicknameInput = html.match(/<input\b[^>]*\bid="nickname"[^>]*>/i)?.[0] || '';
const initialNickname = nicknameInput.match(/\bvalue="([^"]*)"/i)?.[1] || '';

function makeApp({ wechat = false, profile = { available: false, configured: false }, profileRequest, avatarFails = false } = {}) {
  const elements = new Map(), operations = [], requests = [], redirects = [];
  function canvas() {
    const context = new Proxy({}, { get: (object, key) => object[key] || ((...args) => operations.push({ canvas: result, key, args })) });
    const result = { width: 300, height: 300, getContext: () => context, toDataURL: () => 'data:image/png;base64,default', toBlob: done => done({}) };
    return result;
  }
  function element() {
    return Object.assign(canvas(), {
      value: '', files: [], listeners: {}, classList: { add() {}, remove() {} },
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
      dispatchEvent(event) { event.target ||= this; this['on' + event.type]?.(event); for (const handler of this.listeners[event.type] || []) handler(event); },
      setAttribute() {}, append() {}, replaceChildren() {},
      showModal() { this.open = true; }, close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
    });
  }
  const sandbox = {
    console, Math, Map, Number, String, Array, Promise, URLSearchParams, setTimeout, clearTimeout, AbortController,
    navigator: { userAgent: wechat ? 'MicroMessenger/8.0' : 'Browser' },
    window: { location: { replace: url => redirects.push(url) }, scrollTo() {}, addEventListener() {} },
    URL: { createObjectURL: () => 'blob:avatar-fixture', revokeObjectURL() {} },
    Image: class { constructor() { this.width = this.naturalWidth = 256; this.height = 256; } async decode() { if (avatarFails && this.src.startsWith('blob:')) throw new Error('Unreadable'); } },
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: tag => tag === 'canvas' ? canvas() : element() },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === '/api/wechat/profile') return profileRequest ? profileRequest() : { ok: true, json: async () => profile };
      if (url === '/api/wechat/avatar') return { ok: true, blob: async () => ({ type: 'image/png', size: 1000 }) };
      return { ok: true, json: async () => [{id:'fixture',path:'assets/avatars/fixture.jpg',category:'female'}] };
    }
  };
  sandbox.document.getElementById('nickname').value = initialNickname;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8'), sandbox);
  return { run: code => vm.runInContext(code, sandbox), operations, elements, requests, redirects,
    profileRequests: () => requests.filter(request => request.url.startsWith('/api/wechat/')) };
}

(async () => {
  let app = makeApp();
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'default');
  assert.equal(app.run("$('nickname').value"), '', 'An ordinary browser starts with an empty nickname');
  assert.equal(app.profileRequests().length, 0, 'An ordinary browser does not attempt WeChat authorization');
  assert.ok(app.operations.some(op => op.key === 'moveTo' && op.args[0] === 1024 * .32 && op.args[1] === 512), 'Default avatar draws the requested plus');
  assert.equal(app.operations.filter(op => op.key === 'drawImage' && op.canvas === app.run('avatar')).length, 0, 'Default never crops the person from the template');

  app = makeApp({ wechat: true });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'default');
  assert.equal(app.run("$('nickname').value"), '', 'Missing WeChat profile leaves the nickname empty');
  assert.equal(app.redirects.length, 0, 'Missing account configuration keeps the default without a redirect');

  app = makeApp({ wechat: true, profile: { available: true, avatarUrl: '/api/wechat/avatar', nickname: '小林🌱' } });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'wechat');
  assert.equal(app.run("$('nickname').value"), '小林🌱', 'An authorized profile supplies the initial nickname');
  assert.ok(app.requests.some(request => request.url === '/api/wechat/avatar' && request.options.credentials === 'same-origin'));

  app = makeApp({ wechat: true, profile: { available: true, avatarUrl: 'https://untrusted.example/avatar.jpg' } });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'default');
  assert.equal(app.profileRequests().length, 1, 'Ignore arbitrary avatar URLs');

  app = makeApp({ wechat: true, profile: { available: true, avatarUrl: '/api/wechat/avatar', nickname: '头像失效仍可读昵称' }, avatarFails: true });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'default', 'Decode failure preserves a working default');
  assert.equal(app.run("$('nickname').value"), '头像失效仍可读昵称', 'Nickname is independent of avatar decode success');

  app = makeApp({ wechat: true, profile: { available: true, nickname: '只有昵称的微信用户' } });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'default');
  assert.equal(app.run("$('nickname').value"), '只有昵称的微信用户', 'A valid nickname does not require an avatar URL');
  app = makeApp({ wechat: true, profile: { available: false, configured: true, nickname: '已授权但无头像的昵称' } });
  await app.run('avatarReady');
  assert.equal(app.run("$('nickname').value"), '已授权但无头像的昵称', 'An authorized nickname is independent of the avatar availability flag');
  assert.equal(app.run('state.avatarOrigin'), 'default');
  assert.equal(app.redirects.length, 0, 'A nickname-only authorized profile does not need to authorize again');
  for (const nickname of [undefined, null, 123, true, {}, ['数组'], '', ' \t\r\n ']) {
    app = makeApp({ wechat: true, profile: { available: true, nickname } });
    await app.run('avatarReady');
    assert.equal(app.run("$('nickname').value"), '', 'Missing, non-string and blank profile nicknames keep the input empty');
  }
  app = makeApp({ wechat: true, profile: { available: true, nickname: '  小\u0000林\n🌱  ' } });
  await app.run('avatarReady');
  assert.equal(app.run("$('nickname').value"), '小林🌱', 'Profile nicknames trim surrounding whitespace and remove control characters');
  app = makeApp({ wechat: true, profile: { available: true, nickname: '🌱'.repeat(30) } });
  await app.run('avatarReady');
  assert.equal(app.run("$('nickname').value"), '🌱'.repeat(24), 'The nickname limit counts Unicode characters without splitting emoji');

  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  app = makeApp({ wechat: true, profileRequest: () => delayed });
  app.run("$('applyCrop').onclick()");
  release({ ok: true, json: async () => ({ available: true, avatarUrl: '/api/wechat/avatar', nickname: '上传头像后仍可取昵称' }) });
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'), 'upload', 'An uploaded avatar wins over a late WeChat response');
  assert.equal(app.run("$('nickname').value"), '上传头像后仍可取昵称', 'Manual avatar upload does not suppress an untouched WeChat nickname');

  for (const edit of [
    "$('nickname').value = '我手动输入的昵称'; $('nickname').dispatchEvent({type:'input'});",
    "$('nickname').value = '随后清空'; $('nickname').dispatchEvent({type:'input'}); $('nickname').value = ''; $('nickname').dispatchEvent({type:'input'});"
  ]) {
    let finishProfile;
    const pendingProfile = new Promise(resolve => { finishProfile = resolve; });
    app = makeApp({ wechat: true, profileRequest: () => pendingProfile });
    app.run(edit);
    const editedNickname = app.run("$('nickname').value");
    finishProfile({ ok: true, json: async () => ({ available: true, avatarUrl: '/api/wechat/avatar', nickname: '迟到的微信昵称' }) });
    await app.run('avatarReady');
    assert.equal(app.run("$('nickname').value"), editedNickname, 'Manual typing and clearing take priority over a late profile');
    assert.equal(app.run('state.avatarOrigin'), 'wechat', 'Editing the nickname does not suppress the independently authorized avatar');
  }

  app = makeApp({ wechat: true, profile: { available: false, configured: true, authorizeUrl: '/api/wechat/authorize' } });
  await app.run('avatarReady');
  assert.deepEqual(app.redirects, ['/api/wechat/authorize']);
  console.log('PASS: default avatar and empty nickname, independent authorized nickname/avatar, Unicode cleanup, manual typing/clear priorities and optional authorization');
})().catch(error => { console.error(error); process.exitCode = 1; });
