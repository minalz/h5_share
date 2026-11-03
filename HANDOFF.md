# H5 项目交接记录

更新日期：2026-11-03。用途：更换 Codex 项目路径或新建聊天后，先读取本文件与 README.md，再核对实际代码。本文是关键上下文摘要，不是完整聊天记录；用户的新要求优先。

## 项目与当前任务

- 原工作区：`D:\wechatShareProject`；H5 源码：`D:\wechatShareProject\h5_share`。
- 本文件放在 H5 源码根目录。移动项目后，以本文件所在的新目录为准，不继续修改旧路径中的副本。
- 同级 `wechat_miniprogram` 是小程序项目。用户明确要求当前只改 H5，小程序先不改。
- 当前用户准备切换窗口和项目空间路径；新路径尚未指定。这次只整理交接，没有迁移目录，也没有新增功能需求。
- 技术栈为原生 HTML/CSS/JavaScript，Node 内置 HTTP 服务，无前端框架和运行依赖。

## 已确认的最终方向

用户最初要求生成朋友圈截图，后来澄清：需要在手机上显示仿朋友圈的详情网页，再使用手机系统截图。最终方向以此为准，不恢复历史的整图生成、PNG 下载或图片预览弹窗。

- 点击“发表”进入真正的 `detail.html?id=…` HTML 页面，标题为“详情”。
- 时间、Wi-Fi、电话卡信号、电量均使用手机真实系统状态栏。H5 不绘制、读取或随机生成这些图标和电量，不提供“选择本机状态栏”按钮。
- 微信内置浏览器：使用微信自己的标题栏，隐藏 H5 重复导航。微信的关闭符号、来源 IP/域名和底部浏览器工具栏不是网页可随意修改的元素。
- Safari 添加到主屏幕后以独立网页方式打开：保留系统状态栏，H5 绘制“〈 详情 …”。用户已经真机体验并认可此方式，表示仿真效果基本满意。
- 已有 manifest `display: standalone`、Apple 网页应用 meta 与安全区布局。当前仍为在线网页，没有离线服务；manifest 目前没有安装图标配置。安卓 Chrome 的安装效果未真机验证，不能保证局域网 HTTP 地址能安装成独立应用。安卓操作咨询当时要求只给步骤、不改代码。

## 用户要求与已实现行为

1. 布局参照用户提供的 iPhone 17 朋友圈截图（原始 1206×2622，展示折算为 942 宽），随屏幕宽度适配。保留认可的字体、间距和图标效果，图片不能拉伸。
2. 主头像可上传，裁剪支持单指拖动、双指缩放、确认与取消。没有头像时使用浅灰十字背景；没有昵称时为空。
3. 最近设置的头像和昵称保存在当前站点、当前浏览器的本地缓存；再次进入优先恢复，包括用户主动清空昵称的状态。用户暂时没有微信授权公众号配置，不能声称能直接静默获取微信头像昵称。
4. 每次打开、刷新配置页或从详情返回，朋友圈正文和配图都清空；头像昵称缓存保留。默认朋友圈配图已经删除，不重新加入默认文案或配图。
5. “随机”按钮已删除，“发表”位于原随机按钮的位置（昵称右侧）；“图文集赞”旁的返回箭头已删除。
6. 点赞人数不含自己，范围 0～100。填写数字后离焦或回车，生成对应用户数量；“添加用户”每次 +1；删除、清空与输入框同步；发表前再次核对人数。
7. 自动头像不得重复，素材为中国人物、风景和卡通主题。类别目标比例：男性 10%、女性 50%、风景 20%、卡通 20%，小样本使用最大余数法分配。手动设置的头像和昵称应保留。
8. 昵称包含日常网名、英文单词、成语、诗意短句、网络词语，避免大量真实姓名；同批自动昵称不重复。
9. 详情页点赞头像按八列方格布局；包含垃圾桶、两点按钮、爱心、底部“发表评论:”及笑脸和图片 SVG 图标。不要用字体符号替代这些图标。
10. 配图下方、时间上方有浅灰来源名称，默认“51Talk无忧英语”，可修改或清空。旧记录缺少字段时默认显示，明确清空时不显示。
11. 清理体积不能降低图片清晰度。100 张头像曾做像素一致的无损 JPEG 优化，默认配图和不用的原始素材已清理，不再为了减小文件数把清晰度降低。
12. 首屏按钮不等待全部 100 张头像下载解码；只加载当前选中的头像。发表时等待本次使用的图片准备完成，避免缺图；失败保留配置并允许重试。

## 主要文件

- `index.html`、`app.js`、`styles.css`：配置页、头像裁剪、点赞用户管理和共用样式。
- `moments-view.js`：详情内容布局和图标。
- `detail.html`、`detail-page.js`：详情网页入口、导航与生命周期。
- `detail-store.js`：本地详情记录，IndexedDB 优先、sessionStorage 备用。
- `profile-cache.js`：最近头像和昵称的持久缓存。
- `manifest.webmanifest`：主屏幕网页应用配置。
- `assets/avatars/manifest.json` 与 100 张 JPEG：运行头像素材；来源记录见该目录 ATTRIBUTION.md。
- `server.js`、`wechat-auth.js`：本地服务器和可选微信授权后端。
- `scripts/build-static.js`：按运行文件白名单创建 dist。
- `tests/`：已有逻辑回归测试；README.md 有更完整的使用与部署说明。

## 启动、验证、部署

在新的 H5 源码根目录运行（Windows PowerShell 中可以用 npm.cmd）：

```powershell
npm.cmd start
```

默认端口 5173，监听 `0.0.0.0`；电脑用 `http://localhost:5173/`，同一局域网手机用电脑当前 IP。旧 IP 为 `192.168.3.100`，换网络后须重新确认。旧服务可能仍占用端口，迁移后先核对运行目录，避免看到旧副本。

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run avatars:check
npm.cmd run build
```

- 部署只上传 `dist` 内的内容，保持目录结构。构建为白名单，本交接文件、README、测试、维护脚本不会进入静态发布包。
- 当前版本标记 `20261022-2`；README 记录发布包约 4.91 MB、110 个运行文件加构建标记。重新构建后以实际输出为准。
- 之前开发轮次已经通过相关检查和回归测试；本次交接仅核对文档、配置和构建脚本，没有重新运行整套测试，也没有修改运行代码。
- 最近一次启动检查成功返回 HTTP 200。但这不是对未来进程仍在运行的保证，新窗口需现场确认。

## 保留的限制与注意事项

- 本地头像昵称缓存按浏览器和站点来源隔离。更换协议、域名或端口可能需要重新设置；仅改变本机源码文件夹不等于迁移浏览器数据。
- 详情记录保留 24 小时、最多 20 份。详情 URL 中的 ID 读取本机数据，不是跨手机分享内容的服务器链接。
- 没有真实公众号端到端授权验证；AppSecret 不应进入前端或发布包。
- 手机状态栏与浏览器界面需要真机核对，桌面页面截图不能证明真实手机系统栏效果。
- 历史参考图来自聊天附件与临时目录，未打包进本交接文件。如需再次逐像素对照且原图不可访问，应请用户重新提供相关图片。
- 新窗口先读取交接和 README，确认当前工作目录与用户后续要求后继续，不把已经完成或被后续需求替代的旧请求重新执行。


## 2026-11-03 头像精简

当前运行图库为 60 张：女性 20、男性 0、风景 20、卡通 20。men 全部删除；women 原有 50 张，保留 20 张、删除 30 张，保留原文件名与图片字节。此记录替代上文旧图库数量说明。原分类比例不再能严格满足，超过 60 个自动点赞头像会使用现有的重复回退机制。


2026-11-03: Added 20 original JPEG avatars from https://1314111.com/post/45785.html, named 1314111_01.jpg through 1314111_20.jpg. Current library: 80 images (40 female, 0 male, 20 landscape, 20 cartoon). Individual source URLs are in the avatar manifest.


2026-11-03: Added 20 network avatars (wangluo_01 through wangluo_20), preserving original JPEG/PNG bytes; source page and image URL recorded per item in assets/avatars/manifest.json. Library now totals 100: female 44, male 2, landscape 26, cartoon 28. Sources: https://www.xdn001.com/article/50607.html , https://www.xdn001.com/article/55306.html , https://www.xdn001.com/article/56155.html , https://www.xdn001.com/article/48695.html . Third-party material; no license verification implied.


2026-11-03: Default publish time now initializes to a random integer 1–59 minutes ago on page load; self-like checkbox defaults off. Users can still edit either setting.
