'use strict';
const $ = id => document.getElementById(id);
const EDITOR_TITLE = '图文集赞', RESULT_TITLE = '详情';
const DEFAULT_SOURCE_NAME = '51Talk无忧英语';
$('sourceName').value=DEFAULT_SOURCE_NAME;
const avatar = document.createElement('canvas'); avatar.width = avatar.height = 1024;
const draftAvatar = document.createElement('canvas'); draftAvatar.width = draftAvatar.height = 2048;
let cropTarget = null, publishing = false;
const state = { avatarOrigin: 'default', avatarRevision: 0, nicknameRevision: 0, hasUserEdited: false, library: [], ready: false, uploaded: null, zoom: 1, x: 0, y: 0, photos: [], users: [] };
let toastTimer, resultSnapshot, mountedResult;
const profileCache = typeof ProfileCache === 'object' ? ProfileCache.create() : {restore:async()=>({hasNickname:false,nickname:'',avatarDataUrl:null}),saveNickname:async()=>false,saveAvatar:async()=>false};
const detailStore = typeof DetailStore === 'object' ? DetailStore.create() : null;
let cachedNickname = false;
let finishLocalProfile;
const localProfileReady = new Promise(resolve => { finishLocalProfile = resolve; });
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
function rounded(ctx, img, x, y, w, h, radius = 7) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip(); const ratio = Math.max(w / img.width, h / img.height); const sw = w / ratio, sh = h / ratio; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); ctx.restore(); }
function smooth(ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; return ctx; }
function bitmapSource(bitmap) {
  if(typeof bitmap.toDataURL==='function')return bitmap.toDataURL('image/png');
  const material=state.library.find(item=>item.image===bitmap);
  if(material&&(!bitmap.src||material.imageFailed)){
    if(material.imageFailed){material.imageFailed=false;material.retry=(material.retry||0)+1;}
    bitmap.src=material.path+(material.retry?'?retry='+material.retry:'');
  }
  return bitmap.src;
}
function makeMomentsSnapshot() {
  syncUsersFromCount(); rebalanceUserAvatars();
  const avatarSource=bitmapSource(avatar);
  return {avatar:avatarSource,nickname:$('nickname').value,content:$('content').value,sourceName:$('sourceName').value.trim().slice(0,60),
    photos:state.photos.map(photo=>({src:bitmapSource(photo),width:photo.width,height:photo.height})),
    likers:[...($('selfLike').checked?[{src:avatarSource,name:$('nickname').value}]:[]),...state.users.map(user=>({src:bitmapSource(user.image),name:user.name}))],
    timeLabel:publicationLabel()};
}
function makeEditorDraft() {
  return {version:1,selfLike:$('selfLike').checked,publishAt:$('publishAt').value,
    users:state.users.map(user=>({name:user.name,avatarCustom:Boolean(user.avatarCustom),avatarCategory:user.avatarCategory||'custom'}))};
}
function cacheNickname() {
  cachedNickname = true;
  profileCache.saveNickname($('nickname').value);
}
async function cacheOwnAvatar(silent=false) {
  const reduced=document.createElement('canvas');reduced.width=reduced.height=1024;
  smooth(reduced.getContext('2d')).drawImage(avatar,0,0,1024,1024);
  const saved=await profileCache.saveAvatar(reduced.toDataURL('image/jpeg',0.94));
  if(!saved && !silent)toast('当前浏览器未能保存头像缓存，下次打开可能需要重新选择');
}
function cropAvatar() {
  const target = $('cropDialog').open ? draftAvatar : avatar;
  const ctx = smooth(target.getContext('2d')); ctx.clearRect(0, 0, target.width, target.height);
  if (state.uploaded) {
    const img = state.uploaded; const size = Math.min(img.width, img.height) / state.zoom;
    state.x = Math.max(-(img.width - size) / 2, Math.min((img.width - size) / 2, state.x));
    state.y = Math.max(-(img.height - size) / 2, Math.min((img.height - size) / 2, state.y));
    ctx.drawImage(img, (img.width - size) / 2 + state.x, (img.height - size) / 2 + state.y, size, size, 0, 0, target.width, target.height);
  } else drawDefaultAvatar(target);
  if ($('cropDialog').open) { renderCrop(); return; }
  refreshAvatar();
}
function refreshAvatar() {
  // Keep the small UI thumbnail separate from the high-resolution export source.
  const thumb = document.createElement('canvas'); thumb.width = thumb.height = 184; smooth(thumb.getContext('2d')).drawImage(avatar, 0, 0, 184, 184);
  $('avatarThumb').src = thumb.toDataURL('image/png');
}
function drawDefaultAvatar(target = avatar) {
  const ctx = target.getContext('2d'), size = target.width;
  ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = size * .018; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(size * .32, size * .5); ctx.lineTo(size * .68, size * .5);
  ctx.moveTo(size * .5, size * .32); ctx.lineTo(size * .5, size * .68); ctx.stroke();
}
function cleanWechatNickname(value) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const characters = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean), item => item.segment)
    : Array.from(clean);
  return characters.slice(0, 24).join('');
}
async function initializeAvatar() {
  drawDefaultAvatar(); refreshAvatar();
  const revision = state.avatarRevision, nicknameRevision = state.nicknameRevision;
  let cached={hasNickname:false,nickname:'',avatarDataUrl:''};
  try{
  cached = await profileCache.restore();
  if(state.nicknameRevision===nicknameRevision && cached.hasNickname){$('nickname').value=cleanWechatNickname(cached.nickname);cachedNickname=true;}
  if(cached.avatarDataUrl && state.avatarRevision===revision){
    let timeout;
    try{const image=new Image();image.src=cached.avatarDataUrl;
      await Promise.race([image.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('cached avatar timeout')),2500);})]);
      if(state.avatarRevision===revision){avatar.width=avatar.height=1024;smooth(avatar.getContext('2d')).drawImage(image,0,0,1024,1024);state.avatarOrigin='cache';refreshAvatar();}
    }catch(_){}finally{clearTimeout(timeout);}
  }
  }catch(_){/* A blocked profile cache does not block editing or publication. */}
  finally{finishLocalProfile();}
  if(!/MicroMessenger/i.test(navigator.userAgent)||(state.avatarOrigin==='cache'&&cachedNickname))return state.avatarOrigin==='cache';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('/api/wechat/profile', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return false;
    const profile = await response.json();
    // Nickname availability is independent of avatar availability or manual uploads.
    if (state.nicknameRevision === nicknameRevision && !cachedNickname && !$('nickname').value) { $('nickname').value = cleanWechatNickname(profile.nickname); if($('nickname').value)cacheNickname(); }
    if (state.avatarRevision !== revision || state.avatarOrigin === 'cache') return false;
    if (profile.available && profile.avatarUrl === '/api/wechat/avatar') {
      // The server supplies only an authenticated same-origin avatar; no remote canvas taint.
      const photoResponse = await fetch(profile.avatarUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!photoResponse.ok) return false;
      const blob = await photoResponse.blob();
      if (!blob.type.startsWith('image/') || !blob.size || blob.size > 10 * 1024 * 1024) return false;
      const url = URL.createObjectURL(blob);
      let decodeTimer;
      try {
        const image = new Image(); image.src = url;
        await Promise.race([image.decode(), new Promise((_, reject) => { decodeTimer = setTimeout(() => reject(new Error('头像读取超时')), 4000); })]);
        if (state.avatarRevision !== revision || state.avatarOrigin === 'upload') return false;
        const ctx = smooth(avatar.getContext('2d')); ctx.clearRect(0, 0, avatar.width, avatar.height);
        rounded(ctx, image, 0, 0, avatar.width, avatar.height, 0);
        state.avatarOrigin = 'wechat'; refreshAvatar(); cacheOwnAvatar(true); return true;
      } finally { clearTimeout(decodeTimer); URL.revokeObjectURL(url); }
    }
    if (profile.configured && profile.authorizeUrl === '/api/wechat/authorize' && !state.hasUserEdited) {
      window.location.replace(profile.authorizeUrl);
    }
  } catch { /* Denied, unconfigured, unavailable, or expired authorization keeps the default. */ }
  finally { clearTimeout(timer); }
  return false;
}
function renderCrop() {
  const canvas = $('cropCanvas'), ctx = smooth(canvas.getContext('2d'));
  const side = canvas.width * .86, left = (canvas.width - side) / 2, top = (canvas.height - side) / 2;
  const img = state.uploaded, size = Math.min(img.width, img.height) / state.zoom, scale = side / size;
  ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, canvas.width / 2 - (img.width / 2 + state.x) * scale, canvas.height / 2 - (img.height / 2 + state.y) * scale, img.width * scale, img.height * scale);
  ctx.fillStyle = '#0009'; ctx.fillRect(0, 0, canvas.width, top); ctx.fillRect(0, top + side, canvas.width, canvas.height - top - side); ctx.fillRect(0, top, left, side); ctx.fillRect(left + side, top, left, side);
  ctx.strokeStyle = '#fffc'; ctx.lineWidth = 2; ctx.strokeRect(left, top, side, side);
  ctx.strokeStyle = '#fff5'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(left + side * i / 3, top); ctx.lineTo(left + side * i / 3, top + side); ctx.moveTo(left, top + side * i / 3); ctx.lineTo(left + side, top + side * i / 3); ctx.stroke(); }
}
function openCrop(image, target) {
  cropTarget = target; state.uploaded = image; state.zoom = 1; state.x = state.y = 0; pointers.clear();
  $('cropDialog').showModal(); cropAvatar();
}
$('applyCrop').onclick = () => {
  if (cropTarget) { const image = document.createElement('canvas'); image.width = image.height = 2048; image.getContext('2d').drawImage(draftAvatar, 0, 0); cropTarget.image = image; cropTarget.avatarCustom = true; cropTarget.avatarCategory = 'custom'; usersUI(); }
  else { state.avatarRevision++; state.avatarOrigin = 'upload'; avatar.width = avatar.height = 2048; avatar.getContext('2d').drawImage(draftAvatar, 0, 0); refreshAvatar(); cacheOwnAvatar(); }
  $('cropDialog').close(); pointers.clear();
};
$('cancelCrop').onclick = () => $('cropDialog').close();
$('cropDialog').addEventListener('close', () => { pointers.clear(); cropTarget = null; });
function publicationLabel(now = Date.now()) {
  const date = new Date($('publishAt').value); if (!Number.isFinite(date.getTime())) return '刚刚';
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes >= 0 && minutes < 1) return '刚刚';
  if (minutes >= 1 && minutes < 60) return `${minutes}分钟前`;
  if (minutes >= 60 && minutes < 1440) return `${Math.floor(minutes / 60)}小时前`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function localDateValue(date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
$('publishAt').value = localDateValue(new Date(Date.now() - 6 * 60000));
function fitSize(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}
async function readPhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); const ratio = Math.min(1, 8192 / Math.max(img.width, img.height), Math.sqrt(32000000 / (img.width * img.height)));
    c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio)); smooth(c.getContext('2d')).drawImage(img, 0, 0, c.width, c.height); return c;
  } catch { throw new Error('这张图片无法读取，请转换为 JPG 或 PNG 后重试'); } finally { URL.revokeObjectURL(url); }
}
function imageElement(bitmap) { const img = document.createElement('img'); img.src = bitmapSource(bitmap); img.alt = '头像或配图'; return img; }
function photosUI() {
  $('photoList').replaceChildren();
  state.photos.forEach((photo, index) => { const item = document.createElement('div'); item.className = 'photo-item'; item.append(imageElement(photo)); const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', '移除配图'); remove.onclick = () => { state.photos.splice(index, 1); photosUI(); }; item.append(remove); $('photoList').append(item); });
  if (state.photos.length < 9) { const add = document.createElement('button'); add.className = 'photo-add'; add.textContent = '+'; add.setAttribute('aria-label', '添加配图'); add.onclick = () => $('photoInput').click(); $('photoList').append(add); }
}
const nicknameGroups = [
  ['小满', '橙子汽水', '半糖', '小饼干', '南瓜粥', '柚子茶', '可乐加冰', '奶油泡芙', '山茶花', '向日葵', '小岛来信', '小鱼干', '栗子', '棉花糖', '糯米团子', '咕噜咕噜', '七喜', '桃桃乌龙', '芝士奶盖', '豆乳盒子', '一颗橘子', '白日梦', '早安晚安', '小熊软糖', '四季如你', '半颗星星', '小狗的信', '云朵收藏家', '薄荷糖', '月亮邮局', '微糖', '芋泥啵啵', '小小世界', '鱼丸粗面', '海盐', '小羊咩咩', '岛屿日记', '慢慢来', '🍀', '🌱'],
  ['Sunshine', 'Moonlight', 'Cloud Nine', 'Blue Hour', 'Serendipity', 'Daydream', 'Sunday', 'Mint', 'Peach', 'Coffee', 'Serein', 'Echo', 'Breeze', 'Amber', 'Aurora', 'Mellow', 'Lucky', 'Silver Lining', 'Ocean', 'Starry', 'Clover', 'Mango', 'Daisy', 'Hush', 'Rainy', 'Lemonade', 'Galaxy', 'Warmth', 'Hello world', 'Dream On', 'Blueberry', 'Honey', 'Spring', 'Wildflower', 'A Little Joy', 'Sunny Side', 'Solace', 'Still Waters', 'Light Years', 'Sweet Pea'],
  ['云淡风轻', '随遇而安', '知足常乐', '春和景明', '心有灵犀', '悠然自得', '风和日丽', '岁月静好', '行云流水', '水到渠成', '花好月圆', '清风明月', '怡然自乐', '闲云野鹤', '一见如故', '一念花开', '山高水长', '细水长流', '海阔天空', '未来可期', '如沐春风', '恰到好处', '相得益彰', '美不胜收', '柳暗花明', '宁静致远', '温润如玉', '宠辱不惊', '逍遥自在', '一帆风顺', '欣欣向荣', '笑口常开', '否极泰来', '大智若愚', '和光同尘', '返璞归真', '浮生若梦', '繁花似锦', '好事多磨', '得偿所愿'],
  ['一蓑烟雨', '灯火阑珊', '山间明月', '人间晚晴', '清风徐来', '掬水月在手', '长风几万里', '落花时节', '江上清风', '松间明月', '人间有味是清欢', '星河欲转', '疏影横斜', '一庭春雨', '坐看云起时', '满船清梦', '海棠依旧', '山色有无中', '月是故乡明', '听风看雨', '且听风吟', '一枕星河', '晚来天欲雪', '归去也无风雨', '南风知我意', '昨夜星辰', '竹露滴清响', '绿蚁新醅酒', '山月不知心底事', '桂花同载酒', '野渡无人', '烟雨任平生', '浮云一别后', '江南无所有', '采菊东篱下', '春水碧于天', '此心安处', '清泉石上流', '云深不知处', '小楼听春雨'],
  ['人间干饭客', '快乐小狗', '今天也想摸鱼', '精神状态良好', '一只打工人', '拒绝内耗', '摆烂又支棱', '保持可爱', '早八暂停营业', '别催在路上', '有空一起发呆', '暴富进行时', '不想起床协会', '吃饱了再说', '熬夜冠军', '心态稳得很', '快乐加载中', '今天有点困', '电子榨菜', '碳水脑袋', '奶茶续命中', '打工人小队长', '周末请快进', '生活要有盼头', '明天一定早睡', '社恐营业中', '好运请签收', '宇宙第一闲人', '可爱超标了', '不会吧不会吧', '这很难评', '情绪稳定版', '轻舟已过万重山', '小小发呆选手', '拿捏', '随时准备下班', '小猫不讲道理', '别焦绿', '咸鱼也有梦想', '快乐永不打烊']
];
// Interleave styles so even a deterministic random source produces a varied,
// finite batch instead of surname combinations or numbered fallback names.
const nicknamePool = [...new Set(Array.from({ length: Math.max(...nicknameGroups.map(group => group.length)) }, (_, index) => nicknameGroups.map(group => group[index])).flat().filter(Boolean))];
function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function createNickname(excluded = []) {
  const used = new Set(excluded.filter(name => typeof name === 'string').map(name => name.trim()));
  const available = nicknamePool.filter(name => !used.has(name));
  return pick(available.length ? available : nicknamePool);
}
const avatarCategories = ['male', 'female', 'landscape', 'cartoon'];
const avatarCategoryWeights = { male: 1, female: 5, landscape: 2, cartoon: 2 };
const avatarCategoryLabels = { male: '男性', female: '女性', landscape: '风景', cartoon: '卡通', custom: '自定义' };
function avatarCategoryTargets(total) {
  const count = Math.max(0, Math.min(100, Math.floor(Number(total) || 0)));
  const targets = Object.fromEntries(avatarCategories.map(category => [category, Math.floor(count * avatarCategoryWeights[category] / 10)]));
  let remaining = count - Object.values(targets).reduce((sum, value) => sum + value, 0);
  const priority = [...avatarCategories].sort((a, b) => (count * avatarCategoryWeights[b] % 10) - (count * avatarCategoryWeights[a] % 10) || avatarCategoryWeights[b] - avatarCategoryWeights[a] || avatarCategories.indexOf(a) - avatarCategories.indexOf(b));
  for (const category of priority) if (remaining > 0) { targets[category]++; remaining--; }
  return targets;
}
function materialCategory(item) {
  if (avatarCategories.includes(item.category)) return item.category;
  // Classify older manifests from their source metadata, never by image recognition.
  if (/^women-/.test(item.id || '')) return 'female';
  if (/^men-/.test(item.id || '')) return 'male';
  if (item.category === 'daily' || /^daily-/.test(item.id || '')) return 'landscape';
  return null;
}
function rebalanceUserAvatars() {
  if (!state.library.length) return;
  const automatic = state.users.filter(user => !user.avatarCustom);
  const targets = avatarCategoryTargets(automatic.length);
  const assets = new Map(state.library.map(item => [item.image, item]));
  const used = new Set(state.users.filter(user => user.avatarCustom).map(user => user.image));
  const replace = [];
  for (const user of automatic) {
    const category = assets.has(user.image) ? materialCategory(assets.get(user.image)) : null;
    if (category && targets[category] > 0 && !used.has(user.image)) {
      user.avatarCategory = category; targets[category]--; used.add(user.image);
    } else replace.push(user);
  }
  for (const category of avatarCategories) {
    const pool = state.library.filter(item => materialCategory(item) === category);
    while (targets[category]-- > 0 && replace.length) {
      const user = replace.shift();
      const available = pool.filter(item => !used.has(item.image));
      const fallback = state.library.filter(item => !used.has(item.image));
      // Keep photos unique before relaxing the preferred category when a file
      // has failed to load or a custom portrait occupies one of its slots.
      const selected = pick(available.length ? available : fallback.length ? fallback : pool.length ? pool : state.library);
      user.image = selected.image; user.avatarCategory = materialCategory(selected); used.add(user.image);
    }
  }
  for (const user of state.users) if (user.avatarCustom) user.avatarCategory = 'custom';
}
async function loadAvatarLibrary() {
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timeout;
  try {
    const request=(async()=>{
      const response = await fetch('assets/avatars/manifest.json',controller?{signal:controller.signal}:undefined);
      if (!response.ok) throw new Error('素材清单加载失败');
      return response.json();
    })();
    const manifest=await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>{controller?.abort();reject(new Error('头像清单加载超时'));},8000);})]);
    // Register every distinct image for the existing category/uniqueness rules.
    // Only an avatar selected for the visible list receives a src and downloads.
    state.library = manifest.filter(item=>item&&typeof item.path==='string').map(item=>({...item,image:new Image()}));
    if (!state.library.length) throw new Error('照片素材加载失败');

  } catch (error) {

    toast(error.message + '，请刷新或上传自己的图片');
  }finally{clearTimeout(timeout);}
}
async function readyImage(image){
  if(typeof image.decode!=='function')return;
  bitmapSource(image);
  let timeout;
  try{
    await Promise.race([image.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('点赞头像加载超时，请检查网络后重试')),8000);})]);
  }catch(_){
    const material=state.library.find(item=>item.image===image);if(material)material.imageFailed=true;
    throw new Error('点赞头像未能完整加载，请检查网络后重新发表');
  }
  finally{clearTimeout(timeout);}
}
function chooseAvatar(exclude) {
  // Default material configuration: mix all locally bundled photographs.
  const all = state.library;
  const used = new Set(state.users.map(user => user.image));
  const unused = all.filter(item => !used.has(item.image) && item.image !== exclude);
  const candidates = unused.length ? unused : all.filter(item => item.image !== exclude);
  return pick(candidates.length ? candidates : all)?.image || avatar;
}
function newUser() {
  return { name: createNickname([...state.users.map(user => user.name), $('nickname').value]), image: chooseAvatar() };
}
function normalizedLikeCount() {
  const value = Number(String($('likeCount').value).trim());
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : 0;
}
function syncUsersFromCount() {
  const count = normalizedLikeCount(), changed = state.users.length !== count;
  while (state.users.length < count) state.users.push(newUser());
  state.users.length = count;
  $('likeCount').value = String(count);
  if (changed) usersUI();
  return changed;
}
function usersUI() {
  rebalanceUserAvatars();
  $('users').replaceChildren(); $('likeCount').value = String(state.users.length); $('userCount').textContent = `（${state.users.length}人）`;
  state.users.forEach((user, index) => {
    const row = document.createElement('div'); row.className = 'user'; row.setAttribute('data-avatar-category', user.avatarCategory || 'custom'); const pic = document.createElement('button'); pic.className = 'user-avatar'; pic.setAttribute('aria-label', '替换点赞用户头像'); const thumb = imageElement(user.image); thumb.alt = `${avatarCategoryLabels[user.avatarCategory] || '用户'}头像`; pic.append(thumb);
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    file.onchange = async () => { try { if (file.files[0]) openCrop(await readPhoto(file.files[0]), user); } catch (e) { toast(e.message); } finally { file.value = ''; } }; pic.onclick = () => file.click();
    const name = document.createElement('input'); name.value = user.name; name.maxLength = 24; name.setAttribute('aria-label', '点赞用户昵称'); name.oninput = () => { user.name = name.value; };
    const random = document.createElement('button'); random.className = 'regenerate-avatar'; random.textContent = '换一张'; random.setAttribute('aria-label', '重新生成此用户头像'); random.onclick = () => { user.image = chooseAvatar(user.image); usersUI(); };
    const remove = document.createElement('button'); remove.className = 'remove-user'; remove.textContent = '×'; remove.setAttribute('aria-label', '移除点赞用户'); remove.onclick = () => { state.users.splice(index, 1); usersUI(); }; row.append(pic, file, name, remove); $('users').append(row);
  });
}
for (const id of ['avatarButton']) $(id).onclick = () => $('avatarInput').click();
$('avatarInput').onchange = async event => { const file = event.target.files[0]; if (!file) return; state.avatarRevision++; state.hasUserEdited = true; try { openCrop(await readPhoto(file), null); } catch (e) { toast(e.message); } finally { event.target.value = ''; } };
function zoomAt(zoom, px = 0.5, py = 0.5) {
  if (!state.uploaded) return;
  const next = Math.max(1, Math.min(6, zoom)); const edge = Math.min(state.uploaded.width, state.uploaded.height);
  const change = edge / state.zoom - edge / next;
  state.x += (px - 0.5) * change; state.y += (py - 0.5) * change; state.zoom = next;
}
const pointers = new Map();
function gesture() {
  const points = [...pointers.values()];
  const a = points[0], b = points[1] || a;
  return a ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) } : null;
}
$('cropCanvas').onpointerdown = event => { pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); $('cropCanvas').setPointerCapture(event.pointerId); };
$('cropCanvas').onpointermove = event => {
  if (!pointers.has(event.pointerId) || !state.uploaded) return;
  const before = gesture(); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); const after = gesture();
  const rect = $('cropCanvas').getBoundingClientRect();
  const side = rect.width * .86, left = rect.left + rect.width * .07, top = rect.top + (rect.height - side) / 2;
  const scale = Math.min(state.uploaded.width, state.uploaded.height) / state.zoom / side;
  state.x -= (after.x - before.x) * scale; state.y -= (after.y - before.y) * scale;
  if (pointers.size > 1 && before.distance > 0) zoomAt(state.zoom * after.distance / before.distance, (after.x - left) / side, (after.y - top) / side);
  cropAvatar();
};
for (const name of ['onpointerup', 'onpointercancel', 'onlostpointercapture']) $('cropCanvas')[name] = event => pointers.delete(event.pointerId);
$('cropCanvas').addEventListener('wheel', event => { if (!state.uploaded) return; event.preventDefault(); const rect = $('cropCanvas').getBoundingClientRect(), side = rect.width * .86; zoomAt(state.zoom * Math.exp(-event.deltaY * 0.002), (event.clientX - rect.left - rect.width * .07) / side, (event.clientY - rect.top - (rect.height - side) / 2) / side); cropAvatar(); }, { passive: false });
$('resetCrop').onclick = () => { pointers.clear(); state.zoom = 1; state.x = state.y = 0; cropAvatar(); };
$('photoInput').onchange = async event => { const files = [...event.target.files]; if (files.length + state.photos.length > 9) toast('最多添加 9 张配图'); for (const file of files) { if (state.photos.length >= 9) break; try { state.photos.push(await readPhoto(file)); } catch (e) { toast(e.message); } } event.target.value = ''; photosUI(); };
$('likeCount').onblur = syncUsersFromCount;
$('likeCount').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); syncUsersFromCount(); $('likeCount').blur?.(); } };
$('clearUsers').onclick = () => { state.users = []; usersUI(); };
// Browser blur commits a pending target before click. Also synchronize here for
// keyboard/programmatic clicks that arrive without a preceding blur event.
$('addUser').onclick = () => {
  syncUsersFromCount();
  if (state.users.length >= 100) return;
  state.users.push(newUser()); usersUI();
};
function closeResult(fromHistory=false) {
  if($('resultMenu').open)$('resultMenu').close();
  if(fromHistory || !window.history?.state?.momentsDetail){
    $('resultPage').hidden=true; $('editorPage').hidden=false; document.body.classList.remove('viewing-detail');
    document.title=EDITOR_TITLE; mountedResult?.destroy();mountedResult=null;
    $('generate').focus?.({preventScroll:true});
  }else window.history.back();
}
function openResultMenu() { if(resultSnapshot && !$('resultMenu').open)$('resultMenu').showModal(); }
function presentResult(snapshot,pushHistory=true) {
  mountedResult?.destroy();
  const standalone=Boolean(navigator.standalone||(typeof window.matchMedia==='function'&&window.matchMedia('(display-mode: standalone)').matches));
  const nativeHeader=typeof MomentsView.usesNativeHeader==='function'&&MomentsView.usesNativeHeader(navigator.userAgent,standalone);
  mountedResult=MomentsView.mount($('momentsRoot'),snapshot,{onBack:()=>closeResult(),onMenu:openResultMenu,nativeHeader});
  $('editorPage').hidden=true; $('resultPage').hidden=false; document.body.classList.add('viewing-detail');
  document.title=RESULT_TITLE;
  if(pushHistory && window.location.hash!=='#detail')window.history.pushState({momentsDetail:true},'', '#detail');
  window.scrollTo({top:0,behavior:'instant'});
}
function resetPublish(){publishing=false;$('generate').disabled=!state.ready;$('generate').textContent='发表';}
$('generate').onclick = async () => {
  if(!state.ready || publishing)return;
  document.activeElement?.blur?.();state.hasUserEdited=true;
  publishing=true;$('generate').disabled=true;$('generate').textContent='准备详情…';
  let snapshot,draft;
  try{
    // Restore the local identity without waiting for optional remote OAuth.
    await localProfileReady;
    state.avatarRevision++;cacheNickname();
    if(state.users.some(user=>!user.avatarCustom)||normalizedLikeCount()>state.users.length)await editorReady;
    syncUsersFromCount();
    if(state.users.some(user=>!user.avatarCustom)&&!state.library.length)throw new Error('头像素材尚未加载，请检查网络后重新发表');
    snapshot=makeMomentsSnapshot();draft=makeEditorDraft();
    // Capture the exact selected images before waiting; later edits cannot
    // change the post or user count already committed by this click.
    const selected=[...new Set(state.users.map(user=>user.image))];
    await Promise.all(selected.map(readyImage));
  }catch(error){toast(error.message||'详情准备失败，请重试');resetPublish();return;}
  $('generate').textContent='打开详情…';
  try{
    if(!detailStore)throw new Error('详情存储不可用');
    const id=await detailStore.save({snapshot,draft});
    if(!/^[A-Za-z0-9_-]{16,80}$/.test(id))throw new Error('详情未能保存');
    clearPost();
    window.location.assign('detail.html?id='+encodeURIComponent(id));
  }catch(_){
    // Even when browser storage is blocked, the result remains HTML in this tab.
    resultSnapshot=snapshot;presentResult(snapshot);resetPublish();
  }
};
$('menuBack').onclick=()=>closeResult();
$('menuCancel').onclick=()=>$('resultMenu').close();
window.addEventListener?.('popstate',()=>{if(window.history.state?.momentsDetail && resultSnapshot)presentResult(resultSnapshot,false);else closeResult(true);});
window.addEventListener?.('pageshow',event=>{if(event.persisted){clearPost();resetPublish();}});
if(window.location?.hash==='#detail')window.history.replaceState?.(null,'',window.location.pathname+window.location.search);
function clearPost(){ $('content').value='';state.photos=[];photosUI(); }
for (const id of ['nickname', 'content', 'sourceName', 'publishAt', 'likeCount']) $(id).addEventListener('input', () => { state.hasUserEdited = true; if (id === 'nickname') { state.nicknameRevision++; cacheNickname(); } });
const avatarReady = initializeAvatar();
clearPost();syncUsersFromCount();state.ready=true;resetPublish();
const editorReady = loadAvatarLibrary().then(()=>{usersUI();});
// Old bookmarks may still carry a draft id. Fresh entry never restores a post.
const entryQuery=new URLSearchParams(window.location?.search||'');
if(entryQuery.has('draft')){
  entryQuery.delete('draft');const query=entryQuery.toString();
  window.history.replaceState?.(null,'',(window.location.pathname||'/')+(query?'?'+query:''));
}
