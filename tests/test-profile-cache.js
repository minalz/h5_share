'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ProfileCache = require('../profile-cache');
const KEY = ProfileCache.DEFAULT_KEY;
const AVATAR_A = 'data:image/jpeg;base64,/9j/AA==';
const AVATAR_B = 'data:image/png;base64,iVBORw0KGgo=';
function storage(seed) {
  const values = new Map(seed === undefined ? [] : [[KEY, seed]]);
  return {
    values, writes: [],
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { this.writes.push({ key, value }); values.set(key, value); }
  };
}
async function main() {
  const backing = storage(), cache = ProfileCache.create({ storage: backing });
  assert.deepEqual(await cache.restore(), { hasNickname: false, nickname: '', avatarDataUrl: '' });
  assert.equal(await cache.saveNickname('橘子海'), true);
  assert.equal(await cache.saveAvatar(AVATAR_A), true);
  assert.deepEqual(await ProfileCache.create({ storage: backing }).restore(), { hasNickname: true, nickname: '橘子海', avatarDataUrl: AVATAR_A }, 'a new page instance restores the exact saved identity');
  assert.equal(await cache.saveNickname(''), true);
  assert.deepEqual(await cache.restore(), { hasNickname: true, nickname: '', avatarDataUrl: AVATAR_A }, 'intentional empty nickname remains a saved choice');
  await cache.saveAvatar(AVATAR_B);
  assert.equal((await cache.restore()).nickname, '', 'avatar replacement does not restore an older nickname');
  await Promise.all([cache.saveNickname('先前'), cache.saveAvatar(AVATAR_A), cache.saveNickname('最新'), cache.saveAvatar(AVATAR_B)]);
  assert.deepEqual(await cache.restore(), { hasNickname: true, nickname: '最新', avatarDataUrl: AVATAR_B }, 'rapid partial saves persist each latest field without stale overwrites');
  const another = ProfileCache.create({ storage: backing });
  await another.saveNickname('同一浏览器');
  await cache.saveAvatar(AVATAR_A);
  assert.equal((await cache.restore()).nickname, '同一浏览器', 'each partial write merges fresh persisted fields from other cache instances');
  const errors = [];
  const broken = storage('{broken'), recovering = ProfileCache.create({ storage: broken, onError: (error, operation) => errors.push(operation) });
  assert.deepEqual(await recovering.restore(), { hasNickname: false, nickname: '', avatarDataUrl: '' });
  assert.equal(await recovering.saveNickname('恢复'), true);
  assert.equal((await recovering.restore()).nickname, '恢复');
  assert.ok(errors.includes('restore'), 'corrupt cache is reported without preventing normal editing or recovery');
  for (const seed of ['null','[]','{"version":2,"nickname":"旧格式"}','{"version":1,"nickname":null,"avatarDataUrl":"https://example.com/a.jpg"}']) {
    assert.deepEqual(await ProfileCache.create({ storage: storage(seed) }).restore(), { hasNickname: false, nickname: '', avatarDataUrl: '' });
  }
  const quotaStorage = storage(JSON.stringify({ version: 1, nickname: '已成功保存', avatarDataUrl: AVATAR_A }));
  quotaStorage.setItem = () => { throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' }); };
  const failedWrites = [], full = ProfileCache.create({ storage: quotaStorage, onError: (error, operation) => failedWrites.push({ name: error.name, operation }) });
  assert.equal(await full.saveNickname('没保存成功'), false);
  assert.equal(await full.saveAvatar(AVATAR_B), false);
  assert.deepEqual(await full.restore(), { hasNickname: true, nickname: '已成功保存', avatarDataUrl: AVATAR_A });
  assert.equal(failedWrites.length, 2, 'storage quota failure never claims that a profile was persisted');
  const denied = ProfileCache.create({ storage: { getItem() { throw new Error('SecurityError'); }, setItem() { assert.fail('unreadable storage must not be overwritten'); } }, onError() { throw new Error('Feedback error'); } });
  assert.deepEqual(await denied.restore(), { hasNickname: false, nickname: '', avatarDataUrl: '' });
  assert.equal(await denied.saveNickname('不可用'), false);
  assert.equal(await denied.saveAvatar(AVATAR_A), false);
  assert.equal(await ProfileCache.create({ storage: null }).saveNickname('不可用'), false);
  const before = backing.writes.length;
  for (const avatar of ['blob:test', 'https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,YQ==', 'data:image/png;base64,', 'data:image/png;base64,' + 'A'.repeat(ProfileCache.MAX_AVATAR_LENGTH), null, {}]) {
    assert.equal(await cache.saveAvatar(avatar), false, 'untrusted or excessive avatar data must not enter the persistent profile');
  }
  assert.equal(await cache.saveNickname({ name: '不是昵称' }), false);
  assert.equal(backing.writes.length, before);
  await cache.saveNickname('  🌙\u0000清风明月  ');
  assert.equal((await cache.restore()).nickname, '🌙清风明月');
  const browser = { localStorage: backing };
  vm.createContext(browser);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../profile-cache.js'), 'utf8'), browser);
  assert.equal(typeof browser.ProfileCache.create, 'function', 'the browser script exposes its UMD global');
  assert.equal((await browser.ProfileCache.create().restore()).avatarDataUrl, AVATAR_A);
  const restricted = {};
  Object.defineProperty(restricted, 'localStorage', { get() { throw new Error('Denied by browser'); } });
  vm.createContext(restricted);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../profile-cache.js'), 'utf8'), restricted);
  assert.equal(await restricted.ProfileCache.create().saveAvatar(AVATAR_A), false, 'a throwing localStorage getter cannot break app initialization');
  console.log('PASS: latest persistent avatar/nickname, intentional blank, ordered partial saves, corruption recovery, disabled/quota storage and safe browser image data');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
