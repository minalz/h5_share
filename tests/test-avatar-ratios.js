// Generated-avatar quotas and editing regressions, using the real application.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const categories = ['male', 'female', 'landscape', 'cartoon'];
const weights = { male: 1, female: 5, landscape: 2, cartoon: 2 };
const capacities = { male: 10, female: 50, landscape: 20, cartoon: 20 };
const manifest = categories.flatMap(category => Array.from({ length: capacities[category] }, (_, index) => ({
  id: `${category}-${index}`, category, path: `test-avatars/${category}-${index}.jpg`
})));
const elements = new Map(), drawCalls = [], mountedSnapshots = [], pngExports = [], downloadedLinks = [], savedPages = [], navigations = [];
function canvas() {
  const context = new Proxy({
    measureText: value => ({ width: value.length * 38 }),
    drawImage: (...args) => drawCalls.push(args)
  }, { get: (object, key) => object[key] || (() => {}) });
  return {
    width: 300, height: 300, getContext: () => context,
    toDataURL: () => 'data:image/png;base64,', toBlob: done => done({}),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 240, height: 320 }),
    setPointerCapture() {}
  };
}
function element() {
  return Object.assign(canvas(), {
    value: '', checked: true, files: [], children: [], listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, removeAttribute() {}, remove() {}, addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }, click() {},
    showModal() { this.open = true; }, close() { this.open = false; for (const handler of this.listeners.close || []) handler(); }
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
  console, Math, Map, Set, Number, String, Array, setTimeout, clearTimeout, document,
  window: browserWindow, URLSearchParams,
  DetailStore: { create: () => ({ async save(payload) { savedPages.push(payload); return '0123456789abcdef0123456789abcdef'; }, async load() { return null; } }) },
  MomentsView: {
    mount(root, snapshot, callbacks) { mountedSnapshots.push({ root, snapshot, callbacks }); return { destroy() {} }; },
    async renderPNG(snapshot, options) { pngExports.push({ snapshot, options }); return { blob: { size: 100 }, width: 1206, height: 2622, filename: '详情.png' }; }
  },
  fetch: async url => {
    assert.equal(url, 'assets/avatars/manifest.json', 'An ordinary browser initializes without requesting OAuth');
    return { ok: true, json: async () => manifest };
  },
  navigator: { userAgent: 'ordinary-browser' },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  Image: class { constructor() { this.width = this.naturalWidth = 1206; this.height = 2622; } async decode() {} }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8'), sandbox);
const run = code => vm.runInContext(code, sandbox);
const quota = total => JSON.parse(run(`JSON.stringify(avatarCategoryTargets(${total}))`));
function input(value) {
  elements.get('likeCount').value = String(value);
  elements.get('likeCount').oninput?.();
  elements.get('likeCount').onblur();
}
function checkCount(expected) {
  assert.equal(run('state.users.length'), expected);
  assert.equal(elements.get('likeCount').value, String(expected));
  assert.equal(elements.get('users').children.length, expected);
  assert.equal(elements.get('userCount').textContent, `（${expected}人）`);
}
function checkRatios() {
  const library = run('state.library'), users = run('state.users');
  const byImage = new Map(library.map(item => [item.image, item.category]));
  const autoUsers = users.filter(user => !user.avatarCustom);
  const actual = { male: 0, female: 0, landscape: 0, cartoon: 0 };
  for (const user of autoUsers) {
    const category = byImage.get(user.image);
    assert.ok(categories.includes(category), 'Every automatic avatar uses a classified library image');
    actual[category]++;
  }
  assert.deepEqual(actual, quota(autoUsers.length), `Automatic avatar distribution at ${autoUsers.length} users`);
  assert.equal(new Set(autoUsers.map(user => user.image)).size, autoUsers.length, 'Enough source material means automatic avatars do not repeat');
}
function removeUser(index) {
  const row = elements.get('users').children[index];
  row.children.find(child => child.className === 'remove-user').onclick();
}
async function main() {
  await run('editorReady');
  checkCount(5); checkRatios();
  assert.deepEqual(quota(10), { male: 1, female: 5, landscape: 2, cartoon: 2 });
  assert.deepEqual(quota(20), { male: 2, female: 10, landscape: 4, cartoon: 4 });
  assert.deepEqual(quota(100), { male: 10, female: 50, landscape: 20, cartoon: 20 });
  assert.deepEqual(quota(5), { male: 0, female: 3, landscape: 1, cartoon: 1 }, 'Female receives the tied fractional seat');
  for (let total = 0; total <= 100; total++) {
    const targets = quota(total);
    assert.deepEqual(Object.keys(targets).sort(), [...categories].sort());
    assert.equal(Object.values(targets).reduce((sum, count) => sum + count, 0), total, 'Integer quotas sum to requested number');
    for (const category of categories) {
      const floor = Math.floor(total * weights[category] / 10), count = targets[category];
      assert.ok(Number.isInteger(count) && count >= 0, 'Quotas are nonnegative integers');
      assert.ok(count === floor || count === Math.ceil(total * weights[category] / 10), 'Each quota rounds its exact percentage');
      if (count > floor) {
        for (const other of categories) {
          if (targets[other] === Math.floor(total * weights[other] / 10)) {
            assert.ok(total * weights[category] % 10 >= total * weights[other] % 10, 'Allocated seats follow largest remainders');
          }
        }
      }
    }
    input(total); checkCount(total); checkRatios();
  }

  input(10);
  run("state.users[0].name = '保留的自定义昵称'; const retainedUsers = [...state.users]; const retainedImages = state.users.map(user => user.image); rebalanceUserAvatars();");
  assert.equal(run('state.users.every((user, index) => user === retainedUsers[index] && user.image === retainedImages[index])'), true, 'Rebalancing a correct list preserves objects and images');
  input(20); checkCount(20); checkRatios();
  assert.equal(run('retainedUsers.every((user, index) => state.users[index] === user)'), true, 'Increasing count retains existing user objects');
  assert.equal(run('state.users[0].name'), '保留的自定义昵称');
  removeUser(3); checkCount(19); checkRatios();
  elements.get('addUser').onclick(); checkCount(20); checkRatios();
  elements.get('likeCount').value = '20'; elements.get('addUser').onclick(); checkCount(21); checkRatios();
  elements.get('likeCount').value = '17';
  elements.get('addUser').onclick(); checkCount(18); checkRatios();
  elements.get('clearUsers').onclick(); checkCount(0); checkRatios();

  // Use the same crop commit as a manual uploaded image, rather than setting its flag ourselves.
  input(10);
  run("const customUser = state.users[0]; openCrop({ width: 1600, height: 1200 }, customUser); $('applyCrop').onclick(); const customImage = customUser.image;");
  assert.equal(run('customUser.avatarCustom'), true, 'Manual crop commits mark a custom avatar');
  checkCount(10); checkRatios();
  input(20); checkCount(20); checkRatios();
  assert.equal(run('state.users[0] === customUser && customUser.image === customImage'), true, 'Increasing count preserves a manually uploaded image');
  removeUser(1); checkCount(19); checkRatios();
  run('rebalanceUserAvatars()');
  assert.equal(run('customUser.image === customImage && customUser.avatarCustom === true'), true, 'Deleting and rebalancing preserves the manual override');
  elements.get('addUser').onclick(); checkCount(20); checkRatios();

  // Publishing also respects a value that has not emitted an input/blur event.
  elements.get('likeCount').value = '32';
  await run("$('generate').onclick()"); checkCount(32); checkRatios();
  assert.equal(navigations.length, 1);
  assert.match(navigations[0], /^detail\.html\?id=[A-Za-z0-9_-]+$/);
  assert.equal(run('customUser.image === customImage'), true, 'The native snapshot preserves the manual override');
  assert.equal(mountedSnapshots.length, 0, 'Successful publication does not create an intermediate preview in the editor');
  assert.equal(savedPages.length, 1);
  const published = savedPages[0].snapshot;
  assert.ok(savedPages[0].draft, 'The saved publication carries a separate editable draft');
  assert.equal(pngExports.length, 0, 'A publication shows the native screenshot page without rendering a PNG');
  assert.equal(downloadedLinks.length, 0, 'A publication does not start a download');
  assert.equal(published.likers.length, 33, 'The native result includes all 32 configured users plus the own like');
  assert.equal(published.likers[0].src, published.avatar);
  assert.equal(published.likers[1].src, run('bitmapSource(customImage)'));
  assert.equal(published.likers[1].name, run('customUser.name'));
  assert.deepEqual(Array.from(published.likers.slice(1), user => user.name), Array.from(run('state.users.map(user => user.name)')));
  run("$('selfLike').checked = false");
  const withoutOwnLike = run('makeMomentsSnapshot()'); checkCount(32); checkRatios();
  assert.equal(withoutOwnLike.likers.length, 32, 'Disabling the own like preserves precisely the configured 32 users');
  assert.equal(withoutOwnLike.likers[0].name, run('customUser.name'));
  elements.get('clearUsers').onclick(); checkCount(0); checkRatios();

  // A failed category file should use a different unused asset before repeating
  // one of the remaining photos solely to satisfy its preferred category.
  run("const completeLibrary = state.library; state.library = state.library.filter(item => item.category !== 'male');");
  input(20); checkCount(20);
  assert.equal(run('new Set(state.users.map(user => user.image)).size'), 20, 'Unavailable category falls back to unused photographs');
  assert.equal(run('state.users.every(user => state.library.some(item => item.image === user.image))'), true);
  run('state.library = completeLibrary; usersUI();'); checkCount(20); checkRatios();
  console.log('PASS: 10/50/20/20 quotas for 0–100 users, +1 add/blur/delete/clear synchronization, unique automatic avatars and shortage fallback, preserved custom uploads and saved HTML detail snapshots without PNG');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
