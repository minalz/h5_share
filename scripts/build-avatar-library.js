/* Build local China-themed fictional avatars. No network or image resizing. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..'), AVATARS = path.join(ROOT, 'assets', 'avatars');
const TARGET_COUNTS = { female: 50, male: 10, landscape: 20, cartoon: 20 };
const SHEETS = [
  { flag: 'female-a', prefix: 'women', category: 'female', columns: 5, rows: 5, offset: 0 },
  { flag: 'female-b', prefix: 'women', category: 'female', columns: 5, rows: 5, offset: 25 },
  { flag: 'male', prefix: 'men', category: 'male', columns: 5, rows: 2, offset: 0 },
  { flag: 'landscape', prefix: 'daily', category: 'landscape', columns: 5, rows: 4, offset: 0 },
  { flag: 'cartoon', prefix: 'cartoon', category: 'cartoon', columns: 5, rows: 4, offset: 0 }
];
function getSharp() {
  const candidates = [process.env.SHARP_MODULE_PATH, 'sharp', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'sharp')].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('sharp unavailable. Set SHARP_MODULE_PATH to an existing local sharp module directory.');
}
const sharp = getSharp();
function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (flag === '--validate') { options.validate = true; continue; }
    if (!SHEETS.some(sheet => flag === `--${sheet.flag}`)) throw new Error(`Unknown argument: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing image path for ${flag}`);
    options[flag.slice(2)] = path.resolve(value);
  }
  return options;
}
function safeImagePath(relative) {
  if (!/^assets\/avatars\/(women|men|daily|cartoon)-\d+\.jpg$/.test(relative)) throw new Error(`Unexpected avatar path: ${relative}`);
  return path.join(ROOT, relative);
}
async function validate(items, options = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('Manifest must contain an avatar array.');
  const ids = new Set(), paths = new Set(), hashes = new Set();
  const counts = { female: 0, male: 0, landscape: 0, cartoon: 0 };
  for (const item of items) {
    if (!(item.category in counts)) throw new Error(`Unknown category for ${item.id}`);
    if (ids.has(item.id) || paths.has(item.path)) throw new Error(`Duplicate avatar: ${item.id}`);
    ids.add(item.id); paths.add(item.path); counts[item.category]++;
    const file = options.staging ? path.join(options.staging, path.basename(safeImagePath(item.path))) : safeImagePath(item.path);
    const content = await fs.readFile(file), image = sharp(content, { failOn: 'warning' });
    const metadata = await image.metadata();
    await image.raw().toBuffer(); // Force complete decode, not just header validation.
    if (metadata.format !== 'jpeg' || metadata.width !== item.width || metadata.height !== item.height) throw new Error(`Invalid JPEG dimensions: ${item.id}`);
    if (options.generated) {
      if (!item.generated || item.theme !== 'China' || !item.fictional || item.width !== item.height || item.width < 128) throw new Error(`Missing generated provenance or invalid crop: ${item.id}`);
      const digest = crypto.createHash('sha256').update(content).digest('hex');
      if (hashes.has(digest)) throw new Error(`Duplicate generated image: ${item.id}`);
      hashes.add(digest);
    }
  }
  if (options.generated) for (const [category, target] of Object.entries(TARGET_COUNTS)) {
    if (counts[category] !== target) throw new Error(`Expected ${target} ${category} images, got ${counts[category]}`);
  }
  return counts;
}
function documentation(sheets) {
  return '# 中国主题头像素材来源\n\n' +
    '当前 manifest 中的 100 张素材均由本项目使用 OpenAI 图像生成工具生成的图集切片，主题为中国。\n' +
    '人物是虚构形象，不能据此判断任何真实人物的身份或国籍；风景是中国主题合成场景，并非特定真实景点的实拍照片。卡通为生成的插画形象。\n\n' +
    '数量：女性人物 50、男性人物 10、中国主题风景 20、国风卡通 20。\n' +
    '按源图固定网格均匀切片，必要时居中裁为正方形，不放大、不拉伸，以 JPEG 95 保存。\n\n' +
    '| 来源图集 | 类别 | 网格 | 数量 |\n| --- | --- | --- | --- |\n' +
    sheets.map(sheet => `| ${path.basename(sheet.source)} | ${sheet.category} | ${sheet.columns} × ${sheet.rows} | ${sheet.columns * sheet.rows} |`).join('\n') +
    '\n\n生成标记、源图集文件名、源像素裁切区域和尺寸保存在 manifest.json 中。应用运行时只读取本地 JPEG，不请求第三方头像服务。源码目录可不保留原始图集；重建时向 scripts/build-avatar-library.js 提供外部源图文件，现有图库校验不需要图集。\n' +
    '旧 scripts/download-avatars.py 入口现在仅验证本地图库，不再下载或恢复旧网络素材。\n';
}
async function cleanupStaging(staging) {
  const resolved = path.resolve(staging);
  if (!resolved.startsWith(path.resolve(AVATARS) + path.sep) || !path.basename(resolved).startsWith('.avatar-build-')) throw new Error('Refusing to remove an unexpected staging directory.');
  await fs.rm(resolved, { recursive: true, force: true });
}
async function build(options) {
  for (const sheet of SHEETS) if (!options[sheet.flag]) throw new Error(`Missing --${sheet.flag} image path.`);
  const sources = SHEETS.map(sheet => ({ ...sheet, source: options[sheet.flag] }));
  await fs.mkdir(AVATARS, { recursive: true });
  const staging = await fs.mkdtemp(path.join(AVATARS, '.avatar-build-')), manifest = [];
  try {
    for (const sheet of sources) {
      const buffer = await fs.readFile(sheet.source), info = await sharp(buffer, { failOn: 'warning' }).metadata();
      const sourceSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      if (!info.width || !info.height || info.pages > 1) throw new Error(`Invalid single image sheet: ${sheet.source}`);
      if (info.orientation && info.orientation !== 1) throw new Error(`Normalize EXIF orientation before using sheet: ${sheet.source}`);
      for (let row = 0; row < sheet.rows; row++) for (let column = 0; column < sheet.columns; column++) {
        const left = Math.floor(column * info.width / sheet.columns), top = Math.floor(row * info.height / sheet.rows);
        const width = Math.floor((column + 1) * info.width / sheet.columns) - left;
        const height = Math.floor((row + 1) * info.height / sheet.rows) - top, size = Math.min(width, height);
        if (size < 128) throw new Error(`Source cells are too small in ${sheet.source}`);
        const crop = { left: left + Math.floor((width - size) / 2), top: top + Math.floor((height - size) / 2), width: size, height: size };
        const id = `${sheet.prefix}-${sheet.offset + row * sheet.columns + column}`;
        await sharp(buffer, { failOn: 'warning' }).extract(crop).flatten({ background: '#ffffff' }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(path.join(staging, `${id}.jpg`));
        manifest.push({ id, category: sheet.category, path: `assets/avatars/${id}.jpg`, width: size, height: size,
          generated: true, theme: 'China', fictional: true, source: 'Generated for this project with OpenAI image generation',
          sourceSheet: path.basename(sheet.source), sourceSha256, sourceGrid: { columns: sheet.columns, rows: sheet.rows, column, row },
          sourceCrop: crop, sourceDimensions: { width: info.width, height: info.height },
          note: sheet.category === 'landscape' ? 'Fictional China-themed scenery; not a photograph of a verified location.' : 'Fictional generated character; not a real person or a nationality determination.' });
      }
    }
    const counts = await validate(manifest, { staging, generated: true });
    // Do not change any served files until every source and all 100 crops pass.
    for (const item of manifest) await fs.copyFile(path.join(staging, `${item.id}.jpg`), safeImagePath(item.path));
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await fs.rename(path.join(staging, 'manifest.json'), path.join(AVATARS, 'manifest.json'));
    await fs.writeFile(path.join(AVATARS, 'ATTRIBUTION.md'), documentation(sources), 'utf8');
    console.log(`Built and fully decoded ${manifest.length} local generated avatars: ${JSON.stringify(counts)}`);
    return counts;
  } finally { await cleanupStaging(staging); }
}
async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) { console.log('Build: node scripts/build-avatar-library.js --female-a FILE --female-b FILE --male FILE --landscape FILE --cartoon FILE\nValidate: node scripts/build-avatar-library.js --validate\nNo network access. Grids: female 5x5 twice; male 5x2; landscape/cartoon 5x4.'); return; }
  if (options.validate) {
    const items = JSON.parse(await fs.readFile(path.join(AVATARS, 'manifest.json'), 'utf8'));
    const generated = items.every(item => item.generated === true), counts = await validate(items, { generated });
    console.log(`Validated ${items.length} local ${generated ? 'generated' : 'legacy'} avatars: ${JSON.stringify(counts)}. No downloads performed.`); return;
  }
  await build(options);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { build, validate, parseArguments, TARGET_COUNTS };
