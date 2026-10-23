/* Persistent last-used profile. Stored images stay in this browser only. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfileCache = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const DEFAULT_KEY = 'h5-share-profile-v1';
  const MAX_AVATAR_LENGTH = 2 * 1024 * 1024;
  const MAX_RECORD_LENGTH = MAX_AVATAR_LENGTH + 4096;
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function empty() { return { hasNickname: false, nickname: '', avatarDataUrl: '' }; }
  function cleanNickname(value) {
    const clean = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
    const characters = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean), item => item.segment)
      : Array.from(clean);
    return characters.slice(0, 24).join('');
  }
  function validAvatar(value) {
    return typeof value === 'string' && value.length <= MAX_AVATAR_LENGTH &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  }
  function create(options = {}) {
    const key = typeof options.key === 'string' && options.key ? options.key : DEFAULT_KEY;
    let storage, storageError, queue = Promise.resolve();
    try { storage = hasOwn(options, 'storage') ? options.storage : root.localStorage; }
    catch (error) { storageError = error; }
    function report(error, operation) {
      if (typeof options.onError === 'function') {
        try { options.onError(error, operation); } catch (_) { /* Feedback must not break editing. */ }
      }
    }
    function read(operation) {
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
        report(storageError || new Error('Profile storage unavailable'), operation);
        return null;
      }
      let serialized;
      try { serialized = storage.getItem(key); }
      catch (error) { report(error, operation); return null; }
      if (serialized === null || serialized === undefined || serialized === '') return {};
      try {
        if (typeof serialized !== 'string' || serialized.length > MAX_RECORD_LENGTH) throw new Error('Invalid profile cache size');
        const value = JSON.parse(serialized);
        if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) throw new Error('Invalid profile cache format');
        // Copy known fields only; do not carry untrusted properties into a write.
        const record = {};
        if (hasOwn(value, 'nickname') && typeof value.nickname === 'string') record.nickname = cleanNickname(value.nickname);
        if (validAvatar(value.avatarDataUrl)) record.avatarDataUrl = value.avatarDataUrl;
        return record;
      } catch (error) { report(error, operation); return {}; }
    }
    function enqueue(action) {
      const operation = queue.then(action, action);
      // A failed caller or callback never prevents a later settings change.
      queue = operation.catch(() => {});
      return operation;
    }
    function write(field, value) {
      return enqueue(() => {
        const record = read(field);
        if (record === null) return false;
        record[field] = value;
        try { storage.setItem(key, JSON.stringify(Object.assign({ version: 1 }, record))); return true; }
        catch (error) { report(error, field); return false; }
      });
    }
    return {
      restore() {
        return enqueue(() => {
          const record = read('restore');
          if (record === null) return empty();
          return {
            hasNickname: hasOwn(record, 'nickname'),
            nickname: record.nickname || '',
            avatarDataUrl: record.avatarDataUrl || ''
          };
        });
      },
      saveNickname(value) {
        if (typeof value !== 'string') return Promise.resolve(false);
        return write('nickname', cleanNickname(value));
      },
      saveAvatar(dataUrl) {
        if (!validAvatar(dataUrl)) {
          report(new Error('Avatar cache requires a local JPEG, PNG or WebP data URL under 2 MiB'), 'avatarDataUrl');
          return Promise.resolve(false);
        }
        return write('avatarDataUrl', dataUrl);
      }
    };
  }
  return { create, DEFAULT_KEY, MAX_AVATAR_LENGTH };
});
