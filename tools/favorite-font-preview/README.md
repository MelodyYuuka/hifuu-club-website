# 本命测试：独立字体试读

此试稿只在 tools 下，不进入 src 或 dist。不改正式 HTML/CSS、排序算法、分享格式及原版测试进度。

运行：

```powershell
node tools/favorite-font-preview.mjs 4186
```

- 对比入口：http://127.0.0.1:4186/fonts/
- 原版对照：http://127.0.0.1:4186/type/baseline/favorite/
- 雅致均衡：http://127.0.0.1:4186/type/serif/favorite/
- 温柔手记：http://127.0.0.1:4186/type/wenkai/favorite/
- 清爽现代：http://127.0.0.1:4186/type/sans/favorite/

对比页可切换操作小字放大，便于区分字体变化和字号变化。完整备选页面同时包含小字可读性改善：作品名 12–13px，编号与辅助文字 11px 起，窄屏作品列表两列，320px 模式卡片纵向排列。原版对照保留原字号。

每版完整试读存档使用 `hifuu.favorite.v1.font-preview.{baseline|serif|wenkai|sans}`，不会覆盖原版或此前三版页面试稿的存档。试读仍可开始、并列、撤销、暂停、刷新继续。原版 `/favorite/` 原样提供。

## 字体来源

- `noto-serif-sc.woff2`：本机已有 `C:\Windows\Fonts\NotoSerifSC-VF.ttf` 的网页子集（© 2017–2023 Adobe）。来源项目 https://github.com/notofonts/noto-cjk；对应字体 https://fonts.google.com/noto/specimen/Noto+Serif+SC。
- `noto-sans-sc.woff2`：本机已有 `C:\Windows\Fonts\NotoSansSC-VF.ttf` 的网页子集（© 2014–2021 Adobe）。对应字体 https://fonts.google.com/noto/specimen/Noto+Sans+SC。
- `lxgw-wenkai.woff2`：作者发布的 `LXGWWenKai-Regular.ttf` v1.530 的网页子集，https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530。

仅做按现有页面与角色名称收集字符的子集化及 WOFF2 转换，保留字体 name 表中的版权与许可记录。每款附带原项目 OFL 1.1 文本。霞鹜文楷的原项目额外许可允许仅用于网页分发的子集/格式转换保留原名字。所有字体以本地 HTTP 文件加载，不依赖 Google Fonts/CDN；未安装任何系统字体。三份 WOFF2 共约 1.00 MiB，各完整试读只需其使用的字体。

新增页面文案或角色时须重新生成子集（当前约 1160 个字符），正式采用前应把子集构建整合进构建工具，完整核对字体授权随包保留，并讨论结果图片 canvas 导出的字体一致性；当前结果导出原样保留。

运行 `node --test tests/favorite-font-preview.test.mjs` 验证独立存档、原版保留、HTTP 路由、防路径越界、CSS/JS 解析、WOFF2 与许可文本。

这是仅绑定 127.0.0.1 的开发预览服务，不用于公网部署。
