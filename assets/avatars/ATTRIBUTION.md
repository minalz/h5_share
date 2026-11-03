# 中国主题头像素材来源

当前 manifest 中的 100 张素材均由本项目使用 OpenAI 图像生成工具生成的图集切片，主题为中国。
人物是虚构形象，不能据此判断任何真实人物的身份或国籍；风景是中国主题合成场景，并非特定真实景点的实拍照片。卡通为生成的插画形象。

数量：女性人物 50、男性人物 10、中国主题风景 20、国风卡通 20。
按源图固定网格均匀切片，必要时居中裁为正方形，不放大、不拉伸，以 JPEG 95 保存。

现有 JPEG 经过无损编码优化：保留原尺寸、量化表、色度采样和元数据，只优化熵编码及渐进式扫描。100 张图像均验证了解码后像素逐字节一致，不重新量化或降低画质。

| 来源图集 | 类别 | 网格 | 数量 |
| --- | --- | --- | --- |
| china-female-a.png | female | 5 × 5 | 25 |
| china-female-b.png | female | 5 × 5 | 25 |
| china-male.png | male | 5 × 2 | 10 |
| china-landscape.png | landscape | 5 × 4 | 20 |
| china-cartoon.png | cartoon | 5 × 4 | 20 |

生成标记、源图集文件名、源像素裁切区域和尺寸保存在 manifest.json 中。原始图集已在部署清理中移除。应用运行时只读取本地 JPEG，不请求第三方头像服务；现有图库校验不依赖图集，重建时可向 scripts/build-avatar-library.js 提供外部源图文件。
旧 scripts/download-avatars.py 入口现在仅验证本地图库，不再下载或恢复旧网络素材。


## 2026-11-03 头像精简

当前运行图库为 60 张：女性 20、男性 0、风景 20、卡通 20。men 全部删除；women 原有 50 张，保留 20 张、删除 30 张，保留原文件名与图片字节。此记录替代上文旧图库数量说明。原分类比例不再能严格满足，超过 60 个自动点赞头像会使用现有的重复回退机制。

## 1314111 imported avatars
20 original JPEG files from https://1314111.com/post/45785.html; individual source URLs are recorded in manifest.json. Downloaded 2026-11-03. Third-party images; no license or identity verification is implied.


2026-11-03: Added 20 network avatars (wangluo_01 through wangluo_20), preserving original JPEG/PNG bytes; source page and image URL recorded per item in assets/avatars/manifest.json. Library now totals 100: female 44, male 2, landscape 26, cartoon 28. Sources: https://www.xdn001.com/article/50607.html , https://www.xdn001.com/article/55306.html , https://www.xdn001.com/article/56155.html , https://www.xdn001.com/article/48695.html . Third-party material; no license verification implied.
