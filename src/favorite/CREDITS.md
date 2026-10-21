# 本命角色测试 · 素材与致谢

## 页面与玩法

本页为云梦都 HifuuCraft的非官方、非商业东方同人页面。
玩法参考：
- 東方キャラソート・MF：http://readalittle.net/sort/
- 二色幽紫蝶本命测试：https://uzkk.github.io/favorite/

页面布局、交互、存档、分享、图片导出与 FavoriteSorter 排序器在本项目中独立实现；未直接复用 uzkk/favorite 的 Vue 页面组件或排序代码。

## 角色资料

角色名字、短简介与搜索别名由本地 YuukaBot-v6 数据重新生成：
- YuukaBot/data/text/thbwiki/characters_bot.json，档案生成时间为 2026-08-19T13:56:35+08:00，共 179 条。
- YuukaBot/data/text/touhou/altname.json，本次导入时的本地别名表。
- 上游资料为 THBWiki：https://thbwiki.cc/官方角色列表 ，具体角色见对应条目及历史记录；文本许可沿用下节所列 CC BY-NC-SA 3.0。

当前 173 位中，170 位对应独立档案；云山由别名表及云居一轮档案中的入道、守护关系补充，人偶由别名表及爱丽丝的操偶能力补充，易者的名字与占卜师身份取自别名表。
转换使用本项目维护的稳定 ID 映射；不导入全部 179 条，也不按初登场字段覆盖逐作出场标签。作品筛选沿用已独立核对的 THBWiki 记录，详见 WORKS.md。
可复现的导入工具为 tools/import-favorite-characters.mjs，映射为 tools/favorite-character-sources.json。

短简介不等同于统一的官方称号。莲子、梅莉的长简介按学科身份压缩；堇子按别名表的“会长”称呼保留本站原表述，不采用档案摘要中的“部长”；九十九姐妹按同档案正文分别校正为琵琶、琴的付丧神，未采用写反的摘要；一轮与云山继续分别建档。蓬莱人形两位角色保留社群通称，不把描述性条目名当作正式姓名。旧译名只作为搜索别名保留。
当前共 173 位，覆盖至《东方锦上京》（TH20），但并非东方全角色全集。旧作与新作的同名角色合并。
出场标签仅供本测试筛选，不是完整官方年表。

## 锦上京资料更新（2026-10-19）

第 20 作官方介绍：https://touhou-project.news/news/13976/
本次加入 6 位新角色：尘塚姥芽、封兽魑魅、道神驯子、维缦·浅间、磐永阿梨夜、渡里贝子。
同时补充灵梦、魔理沙、绵月丰姬及 16 位结局登场角色的 TH20 出场标签；不为老角色建立重复条目。
TH20 筛选共 25 位角色，按实际登场计算，不把仅被提及的名字或无名异变敌另列为角色。

中文译名、称号及实际登场记录核对来源：
- https://thbwiki.cc/东方锦上京 （自机、BOSS、其他角色章节）
- https://thbwiki.cc/东方锦上京/角色立绘

THBWiki 相关翻译文本适用署名—非商业性使用—相同方式共享 3.0 协议（CC BY-NC-SA 3.0）；本次对应翻译资料注明该来源及许可，不将其作为代码的 ISC 许可重新授权。
资料变化：整理为本测试角色条目，使用本地稳定 ID，并将自机、BOSS、结局登场记录合并为作品筛选标签。
原站贡献者署名见对应页面及历史记录；许可：https://creativecommons.org/licenses/by-nc-sa/3.0/

## 历史细分资料核对（2026-10-19）

曾为 57 项细分作品核对出场资料；当前展示 36 个作品 / 分类选项，其中格斗与动作 7 部、外传 STG 6 部分别列出，书籍和音乐 CD 继续合并。使用已经核对的逐作角色记录，历史映射用于旧存档兼容与回归测试。
新增映射核对 THBWiki 对应作品的角色、主要角色、目录及封面信息，详细来源见 WORKS.md。
CD 仅收录故事主角与碟面角色，未根据角色主题曲推断出场；书籍主要人物与设定条目并不代表完整客串名录。
这些新增资料与翻译的署名、非商业、相同方式共享条款沿用上节所列 THBWiki CC BY-NC-SA 3.0 声明；与立绘、字体、二维码等其他素材的许可各自独立。

## 立绘（不属于 MIT / ISC 许可范围）

作者：dairi / はるか
作者及素材条款：https://www.pixiv.net/users/4920496
条款核对日期：2026-10-19（作者公开个人资料）。

作者条款要求避免商业使用、素材再分发；允许加工与作品公开；禁止冒称原创，及以素材本身为主体的再分发。
网站广告收入等例外以作者原文为准。使用东方等二创素材还须遵守原作方指南。
本仓库中的立绘仅作为本非商业同人测试页面的展示依赖，不作为独立素材包提供。
请勿从这里提取、再分发、出售，或认为代码的 MIT / ISC 许可涵盖图片。
商业化、素材包分发或改作其他用途时，请先确认原作者当前条款或另行取得许可。

本地文件是用于页面展示的压缩 WebP，保持透明背景；未移除作者署名或水印。
来源对应关系：
- assets/characters/001.webp 至 153.webp 中实际收录的编号：
  https://uzkk.github.io/favorite/assets/th-char/default/c{三位编号}.png
- assets/characters/177.webp 至 205.webp：
  http://readalittle.net/sort/char/c{三位编号}.png

未使用参考站中由 kaoru 绘制的 154–156 号素材。

## 原作

东方 Project 及角色 © 上海アリス幻樂団 / ZUN。
二次创作指南：https://touhou-project.news/guideline/
二创开放不等于公有领域；第三方立绘作者仍保有其作品权利。
本测试不代表原作官方，也不使用官方标识暗示认可。

## 蓬莱人形补充（2026-10-19）

- 206：封套子（夹克子），两版封面及 C63 碟面角色。
- 207：碟面子（Label子），C62 碟面角色。
- 身份及俗称来源：YuukaBot-v6/YuukaBot/data/text/thbwiki/characters_bot.json（2026-08-19 快照），并核对 https://thbwiki.cc/蓬莱人形#封面角色 。两者均没有已确认的正式姓名，不赋予未经确认的设定。相关文本来源遵循前述 THBWiki 许可。
- 206.webp 图像作者 ZUN，取自官方专辑封面：https://www16.big.or.jp/~zun/img/hr01/hr01_jk00.jpg ，官方专辑页：https://www16.big.or.jp/~zun/html/hr01.html 。原图 400×395，裁切 (68,90)–(347,380)。
- 207.webp 图像作者 ZUN，取自 THBWiki 展示的专辑光盘照片右侧 C62 碟面：https://upload.thbwiki.cc/c/c0/蓬莱人形光盘.jpg （文件页：https://thbwiki.cc/文件:蓬莱人形光盘.jpg ）。原图 497×262，裁切 (341,39)–(495,246)。
- 两张均为原图裁切与 WebP 转换，并非 dairi / はるか的立绘，不适用其立绘署名；原作图像版权归上海アリス幻樂団 / ZUN，遵守其二创指南。

## 导出二维码

二维码在本地生成，使用 qrcode-generator 2.0.4（Kazuhiko Arase，MIT）。来源：https://www.npmjs.com/package/qrcode-generator/v/2.0.4 ，保留源码头部声明，完整许可见 vendor/qrcode-generator.LICENSE.txt。

## 结果图背景（2026-10-21）

- 本地文件：assets/backgrounds/hakugyokurou.jpg。
- 作品：C.Z.《あの西行妖の満開なこと》，白玉楼／西行妖樱花庭院。
- 原作页面：https://www.pixiv.net/artworks/18696022 。
- 当前文件为已确认效果预览使用的网页截图裁片，694 × 462；未重新下载原图、未另行修改此 JPEG。用于结果图时保持比例，添加浅色渐变及透明度处理。
- 按用户确认接入结果图。作者许可尚未确认，记录来源不等于取得授权；图片不受仓库代码许可证覆盖，后续应补充作者许可记录或替换为已授权素材。

## 页面字体（2026-10-22）

- 用户确认采用“雅致均衡”：Noto Serif SC 标题 + Noto Sans SC 正文与操作区，配套增加小字号和文字对比度。
- 本地网页字体：`assets/fonts/noto-serif-sc.woff2`、`assets/fonts/noto-sans-sc.woff2`。仅进行字符子集化及 WOFF2 转换，不依赖外部字体 CDN，不安装系统字体。
- Noto Serif SC 源文件：已有 `NotoSerifSC-VF.ttf`（© 2017–2023 Adobe）。Noto Sans SC 源文件：已有 `NotoSansSC-VF.ttf`（© 2014–2021 Adobe，Reserved Font Name “Source”）。源项目：https://github.com/notofonts/noto-cjk 。
- 两份字体分别附带 `assets/fonts/OFL-noto-serif-sc.txt` 与 `assets/fonts/OFL-noto-sans-sc.txt`；字体内 name 表保留原版权与许可信息。字体适用 SIL Open Font License 1.1，不适用仓库代码许可证或角色图像许可。
- 重建子集：`python tools/subset-favorite-fonts.py`，或显式传入完整字体源文件 `--sans /path/to/NotoSansSC.ttf --serif /path/to/NotoSerifSC.ttf`。只覆盖两份生成的 WOFF2 与子集清单，不修改许可文本。
