// User-count and interaction-order regressions; no browser dependency required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const elements = new Map(), drawCalls = [], mountedSnapshots = [], pngExports = [], downloadedLinks = [], savedPages = [], navigations = [];
function canvas() {
  const context = new Proxy({
    measureText: value => ({ width: value.length * 38 }),
    drawImage: (...args) => drawCalls.push(args)
  }, { get: (object, key) => object[key] || (() => {}) });
  return { width: 300, height: 300, getContext: () => context, toDataURL: () => 'data:image/png;base64,', toBlob: done => done({}), getBoundingClientRect: () => ({ left: 0, top: 0, width: 402, height: 812 }) };
}
function element() {
  return Object.assign(canvas(), {
    value: '', checked: true, files: [], children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, removeAttribute() {}, remove() {}, addEventListener() {}, click() {},
    showModal() { this.open = true; }, close() { this.open = false; }
  });
}
const document = {
  activeElement: null,
  body: { classList: { add() {}, remove() {} }, append(link) { downloadedLinks.push(link); } },
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  createElement: tag => tag === 'canvas' ? canvas() : element()
};
document.getElementById('likeCount').value = '5';
document.getElementById('resultPage').hidden = true;
const browserWindow = {
  location: { href: 'http://localhost:5173/', hash: '', pathname: '/', search: '', assign(url) { navigations.push(url); } },
  history: { state: null, pushState(value, title, hash) { this.state = value; browserWindow.location.hash = hash; }, replaceState(value) { this.state = value; }, back() {} },
  addEventListener() {}, scrollTo() {}
};
const sandbox = {
  console, Math: Object.create(Math), Map, Number, String, Array, setTimeout, clearTimeout, document,
  window: browserWindow, URLSearchParams,
  DetailStore: { create: () => ({ async save(payload) { savedPages.push(payload); return '0123456789abcdef0123456789abcdef'; }, async load() { return null; } }) },
  MomentsView: {
    mount(root, snapshot, callbacks) { mountedSnapshots.push({ root, snapshot, callbacks }); return { destroy() {} }; },
    async renderPNG(snapshot, options) { pngExports.push({ snapshot, options, cancelledOnStart: options.shouldCancel() }); return { blob: { size: 100 }, width: 1206, height: 2622, filename: '详情.png' }; }
  },
  fetch: async () => ({ ok: true, json: async () => Array.from({ length: 100 }, (_, i) => ({ path: `photo-${i}.jpg`, category: i < 10 ? 'male' : i < 60 ? 'female' : i < 80 ? 'landscape' : 'cartoon' })) }),
  navigator: { userAgent: '' }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  Image: class { constructor() { this.width = this.naturalWidth = 1206; this.height = 2622; } async decode() {} }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8'), sandbox);
const run = code => vm.runInContext(code, sandbox);
function checkCount(expected) {
  assert.equal(run('state.users.length'), expected, 'Model matches requested count');
  assert.equal(elements.get('likeCount').value, String(expected), 'Number input matches model');
  assert.equal(elements.get('users').children.length, expected, 'Avatar grid matches model');
  assert.equal(elements.get('userCount').textContent, `（${expected}人）`, 'Heading matches model');
}
function input(value) {
  elements.get('likeCount').value = value;
  elements.get('likeCount').oninput?.();
}
function blurCount() { elements.get('likeCount').onblur({ relatedTarget: elements.get('nickname') }); document.activeElement = elements.get('nickname'); }
function commit(value) { input(value); blurCount(); }
function focusCount() {
  document.activeElement = elements.get('likeCount');
  elements.get('likeCount').onfocus?.();
}
function clickAddFromCount() {
  elements.get('addUser').onpointerdown?.();
  elements.get('likeCount').onchange?.();
  elements.get('likeCount').onblur({ relatedTarget: elements.get('addUser') });
  document.activeElement = elements.get('addUser');
  elements.get('addUser').onclick();
}
async function main() {
  elements.get('addUser').onclick(); checkCount(6);
  assert.equal(run('state.users.every(user => Boolean(user.image))'), true, 'Adding before material loading still provides usable placeholder avatars');
  await run('editorReady');
  checkCount(6);
  run("state.users[0].name = '用户自定义昵称'; state.users[0].avatarCustom = true; const savedUser = state.users[0]; const savedImage = state.users[0].image;");
  const initialCards = elements.get('users').children;
  focusCount(); input('1');
  assert.equal(run('state.users.length'), 6, 'Typing the first digit does not generate or discard users');
  input('12');
  assert.equal(run('state.users.length'), 6, 'A two-digit draft is not committed while typing');
  assert.equal(elements.get('users').children, initialCards, 'Typing does not rebuild the avatar list');
  blurCount(); checkCount(12);
  assert.equal(run('state.users[0] === savedUser && state.users[0].image === savedImage'), true, 'Growing preserves custom user identity and photo');
  assert.equal(run('state.users[0].name'), '用户自定义昵称');
  clickAddFromCount(); checkCount(13);
  elements.get('addUser').onclick(); elements.get('addUser').onclick(); checkCount(15);
  assert.equal(run('state.users[0] === savedUser && state.users[0].image === savedImage'), true, 'Adding one user preserves existing custom users');

  focusCount(); input('3'); assert.equal(run('state.users.length'), 15); blurCount(); checkCount(3);
  // A pending field value is first applied, then this click adds exactly one.
  elements.get('likeCount').value = '7'; elements.get('addUser').onclick(); checkCount(8);
  run("$('users').children[1].children[3].onclick()"); checkCount(7);
  assert.equal(run('state.users[0] === savedUser'), true, 'Deleting another user retains the customized first user');
  elements.get('clearUsers').onclick(); checkCount(0);
  document.activeElement = null;
  elements.get('addUser').onclick(); checkCount(1);

  for (const [value, expected] of [['', 0], ['invalid', 0], ['-4', 0], ['2.9', 2], ['1000', 100], ['Infinity', 0], ['100', 100]]) {
    commit(value); checkCount(expected);
  }
  elements.get('likeCount').onblur({ relatedTarget: null });
  elements.get('addUser').onclick(); elements.get('addUser').onclick(); checkCount(100);
  run("$('users').children[99].children[3].onclick()"); checkCount(99);

  // Blur commits the target, and the subsequent independent add is always +1.
  focusCount(); input('4');
  elements.get('likeCount').onblur({ relatedTarget: elements.get('nickname') });
  document.activeElement = elements.get('nickname');
  elements.get('addUser').onclick(); checkCount(5);
  focusCount(); input('12'); clickAddFromCount(); checkCount(13);
  input('16');
  let prevented = false;
  elements.get('likeCount').onkeydown({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); checkCount(16);
  elements.get('addUser').onclick(); checkCount(17);

  for (let target = 0; target <= 100; target++) {
    commit(String(target)); checkCount(target);
    elements.get('addUser').onclick(); elements.get('addUser').onclick();
    checkCount(Math.min(100, target + 2));
  }

  // The available name pool has multiple styles and never falls back to repeated
  // real-name combinations, even with the least helpful deterministic random.
  run("Math.random = () => 0; state.users = []; $('likeCount').value = '100'; syncUsersFromCount();");
  checkCount(100);
  assert.equal(run('new Set(state.users.map(user => user.name)).size'), 100);
  assert.equal(run('new Set(state.users.map(user => user.image)).size'), 100, 'One hundred generated users use one hundred different images');
  assert.equal(run('state.users.every(user => nicknamePool.includes(user.name))'), true);
  assert.equal(run('nicknameGroups.every(group => state.users.filter(user => group.includes(user.name)).length >= 15)'), true, 'English, idioms, poetic phrases, memes and casual names all appear');
  assert.equal(run('state.users.every(user => user.name && Array.from(user.name).length <= 24)'), true);
  run("$('nickname').value = 'Sunshine';");
  assert.equal(elements.get('nickname').value, 'Sunshine', 'The profile nickname remains a manual setting');
  run('delete Math.random;');

  // Native snapshots and publication consume a pending field value even when
  // neither an input nor blur event has been emitted by the browser.
  elements.get('likeCount').value = '7';
  const seven = run('makeMomentsSnapshot()'); checkCount(7);
  assert.equal(seven.likers.length, 8, 'Native result includes seven users plus the selected own like');
  assert.equal(seven.likers[0].src, seven.avatar);
  assert.deepEqual(Array.from(seven.likers.slice(1), user => user.name), Array.from(run('state.users.map(user => user.name)')));
  elements.get('likeCount').value = '2';
  await run("$('generate').onclick()"); checkCount(2);
  assert.equal(savedPages.length, 1);
  assert.equal(savedPages[0].snapshot.likers.length, 3, 'Publication captures exactly two users and the own like');
  assert.ok(savedPages[0].draft, 'The separately saved draft supports returning to editing');
  assert.equal(mountedSnapshots.length, 0, 'Successful publication has no intermediate editor-page preview');
  assert.equal(pngExports.length, 0, 'Publication never renders a PNG automatically');
  assert.equal(downloadedLinks.length, 0, 'Publication never starts a file download');
  assert.equal(navigations.length, 1);
  assert.match(navigations[0], /^detail\.html\?id=[A-Za-z0-9_-]+$/, 'Publication enters the dedicated HTML result with a safe opaque id');
  run("$('selfLike').checked = false"); checkCount(2);
  assert.equal(run('makeMomentsSnapshot().likers.length'), 2, 'Disabling the own like leaves precisely the configured users');
  elements.get('likeCount').value = '0';
  const empty = run('makeMomentsSnapshot()'); checkCount(0);
  assert.equal(empty.likers.length, 0, 'Zero users without an own like renders an empty liker list');
  run("$('selfLike').checked = true");
  assert.equal(run('makeMomentsSnapshot().likers.length'), 1, 'Zero configured users can still show exactly one own like');
  assert.equal(savedPages[0].snapshot.likers.length, 3, 'Later editor changes do not mutate the previously published snapshot');
  console.log('PASS: deferred blur generation, +1 add and synchronized counts, focus/click ordering, boundaries, preserved custom users, 100 unique portraits and varied unique nicknames, saved HTML detail navigation without PNG');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
