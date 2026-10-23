# 中国主题图集构建说明

使用本地生成图集构建素材，保留源文件以便复现。源图集准备齐全并通过所有切片校验后，构建器才更新应用正在读取的 manifest。

| 参数 | 内容 | 网格 | 输出 |
| --- | --- | --- | --- |
| `--female-a` | 中国女性人物主题，虚构 | 5 列 × 5 行 | women-0 至 women-24 |
| `--female-b` | 中国女性人物主题，虚构 | 5 列 × 5 行 | women-25 至 women-49 |
| `--male` | 中国男性人物主题，虚构 | 5 列 × 2 行 | men-0 至 men-9 |
| `--landscape` | 中国主题合成风景 | 5 列 × 4 行 | daily-0 至 daily-19 |
| `--cartoon` | 国风卡通，虚构 | 5 列 × 4 行 | cartoon-0 至 cartoon-19 |

图集无边框、无间隙。按 `floor(index * pixels / cellCount)` 计算每格边界，覆盖源图完整宽高；每格必要时居中裁成正方形，以源像素保存，完全不放大或拉伸。JPEG 使用 quality 95、4:4:4 色度采样，在发布 manifest 前完整解码校验。

示例（替换为实际本地图集）：

```powershell
node scripts/build-avatar-library.js --female-a "SOURCE/women-a.png" --female-b "SOURCE/women-b.png" --male "SOURCE/men.png" --landscape "SOURCE/landscape.png" --cartoon "SOURCE/cartoon.png"
node scripts/build-avatar-library.js --validate
python scripts/download-avatars.py
```

后两条命令仅校验本地文件，不下载网络图片。脚本优先使用项目中的 sharp；也支持环境变量 `SHARP_MODULE_PATH` 或 Codex 自带的本地 sharp。

manifest 记录 `generated: true`、`theme: "China"`、`fictional: true`、源图文件名、网格位置、裁切区域、原生尺寸。China 是素材主题，不能据此判定真实人物国籍。人物全部虚构；风景为中国主题合成场景，不能称为已核验真实景点照片。构建成功后自动更新 ATTRIBUTION.md。

旧网络素材不会再次下载，旧网络 JPEG 已按 manifest 精确清理。当前发布头像目录仅包含清单引用的 100 张生成 JPEG 和相关文档。
