# 资料库（dsh-archive）

DSH 全局面板插件：把插件自带的一份书签库渲染成两级资料库。左栏是较窄的**一级分组列表**，右栏是当前分组的**可展开 / 收起的二级列表**，展开后是带 favicon 和标题的书签卡片，点击卡片在**系统默认浏览器**中打开链接。书签库可以在页面内**新增**、**导入**、**删除**和**移动**（永久写回 `data/bookmarks.json`）。

- 入口：左侧栏顶部面板行（`sidebar.panellist`，Plugins / Scheduled tasks / Travel Plotter 旁边）的**资料库**。
- 布局：页头（一级标题「资料库」+ 新增 / 导入按钮 + 搜索框）→ 主体左右分栏；左栏 `220px`（分组列表 + 底部规模统计），右栏自适应并独立滚动。左右两栏的栏头同高（`40px`）、同一条基线上，列表起点也对齐；右栏的分组标题与下方列表标题文字左边缘对齐（`32px` 栏线）。
- 字号层级：页头 `18px` ＞ 右栏分组标题 `16px` ＞ 列表标题 `14px` ＞ 左栏分组名 / 卡片 `13px` ＞ 元信息 `12px`。
- 图标：面板内所有 glyph 统一采用宿主 Web UI 的 16×16 线性图标集——`@deepseek-ai/dsh-client-ui-primitives` 中的 `archive-outline` / `chevron-right-outline` / `search-outline` / `trash-outline` / `check-outline` / `close-outline`，Regular 权重为 `1px` 描边、Medium 为 `1.3px`。路径数据内联在 `src/client/glyphs.js`，插件 bundle 保持自包含、不新增 Host 包依赖；侧栏面板图标沿用同一 archive 几何，打开时切换为 Medium。图标尺寸也按宿主惯例：列表箭头 / 搜索 / 垃圾桶 `14px`，勾选框与已选清单关闭 `12px`，页头与侧栏 archive `20px`。
- 数据：首次加载即带一份真实书签库（`data/bookmarks.json`，13 个分组 / 55 个列表 / 153 个书签）。
- 语言：界面文案走 Client locale，中文 / English 各一份；跟随 DSH 语言设置。
- 主题：只用 `--dsw-alias-*` 主题 token，明暗主题都跟随宿主。

## 功能

- **左侧一级列表**：分组名 + 书签数；当前分组用自身色相的 12% 底色加左侧 2px 同色竖条选中（与悬停行的 `bg-layer-2` 区分开），点击切换右栏。分组名按数据文件里的 `name` 原样显示。选择态下，有选中项的分组在名称右侧显示品牌色已选数量徽标。
- **右侧二级列表**：每个列表是一个可折叠小节，标题行显示列表名、展开箭头和条目数（箭头在标题右侧，标题文字仍与分组标题对齐在 `32px` 栏线），最右侧是新增书签的 `+`；展开后是卡片网格（`auto-fill`，最小 228px），卡片统一按三行标题的高度（`min-height:76px`）预留、标题最多三行；favicon、悬停时的勾选框和垃圾桶都在卡片内垂直居中，网格底部留 `12px`，最后一行卡片与下一条分区线之间保持呼吸间距。空列表展开时显示「这个列表还没有书签」，不删除列表本身。
- **新增单个书签**：顶栏搜索框左侧的 `+` 打开「新增书签」，输入链接（缺省协议会自动补 `https://`）、可选标题，并选择现有分组 / 列表或新建一个；每个列表标题右上角的 `+` 则直接加入当前列表。提交后切到目标分组、展开目标列表并聚焦新卡片；同一列表内重复 URL 会提示并留在弹窗内。空书签库也能从顶栏创建第一个分组 / 列表。
- **导入 JSON**：顶栏搜索框左侧的导入按钮选择一个 JSON 文件；确认框显示文件名、大小和大致条目数。导入采用**合并**：同名分组 / 列表复用，同一列表内重复 URL 跳过，空分组 / 空列表保留；确认后 Toast 汇总新增书签、分组、列表和跳过的数量。文件里的导出器元信息（`version`、`type`、`labelIds`、`favIconUrl`、`customTitle`、`customDescription`、`description` 等）会被清洗掉，只保留 `name` / `title` / `url` / `icon`；同时兼容当前 `lists[].bookmarks[]` 和旧版 `lists[].cards[]` 结构，`customTitle` 用作标题、`favIconUrl` 用作图标。
- **单卡删除**：悬停卡片，卡片右侧垂直居中处出现红色垃圾桶；所有表示删除的图标、按钮和文案（悬停垃圾桶、「删除这个书签？」、单卡「删除」、底栏「删除」、批量删除弹窗标题/按钮与「删除后不可恢复。」）统一使用主题错误色 `--dsw-alias-state-error-primary`（在 `.ar-root` 上收敛为 `--ar-danger`）。点击垃圾桶后**卡片本身**浮出一层确认遮罩，提示「删除这个书签？」；提示文字与「删除 / 取消」两个按钮分两行水平居中（删除在左、取消在右），遮罩从右侧垃圾桶位置淡入并轻微展开，点击「取消」时沿相反方向退回该位置。确认后永久写回文件，不可撤销（写前保留 `.bak` 整文件备份，仅作写坏兜底）。确认层默认焦点在「取消」，`Esc` / 点卡片外可取消。
- **批量选择 / 移动 / 删除**：悬停卡片时图标位变成勾选框，键盘聚焦同样会露出勾选框。进入选择态后，其余卡片保持浏览时的外观（favicon 不动、不整片铺开勾选框），只有鼠标悬停 / 键盘聚焦到的那张卡才出现勾选框；已选卡片保留勾选框和品牌色描边底色。用鼠标取消勾选后，该卡片立即恢复原样（勾选框淡出、favicon 回来），移出再悬停才会重新出现。有已选项时底部浮出操作栏（已选数量 / 移动 / 删除 / 取消），勾选数量回到 0 时底栏直接收起，并退出选择态回到普通浏览。表头的「选择」按钮是键盘和触屏入口。选择**可以跨分组**：切分组不清空，左栏显示已选徽标，底栏显示「跨 M 个分组」，点数量可打开「已选清单」逐项核对 / 取消。搜索把已选项过滤掉时仍保留选中，底栏提示隐藏数量。
- **批量删除**：底栏「删除」打开居中模态框，列出前 4 个书签（跨组时带分组 / 列表前缀），二次确认后一次删除全部选中项；空列表 / 空分组保留，不自动清理。
- **移动**：底栏「移动」打开两个下拉——先选目标分组，再选目标列表（空列表可作为目标；空分组没有列表，不能作为目标）。默认当前分组、列表不预选；部分已选项已在目标列表时提示并跳过；一律追加到目标列表末尾。移动成功后不自动切换分组，源列表 / 源分组即使变空也保留。
- **空结构**：空列表、空分组都是合法数据，加载 / 展示 / 保存时都保留；统计仍计入空列表和空分组。数据文件为 `groups: []` 时显示「书签库是空的」。
- **拖拽排序**：左栏分组、右栏列表、书签卡片都可以在各自的父级元素内拖动排序。鼠标 / 触控笔移动超过 `24px` 才进入拖动（更小的移动仍按单击处理），无需长按；拖动开始时源位置保留一个虚线空白占位框，元素本身作为浮层跟随鼠标；当光标**完全离开**占位框后，占位框消失，后续元素以 `200ms` 的 FLIP 过渡补位，目标位置插入半透明预览作为落点（拖回原位时也会显示同样的插入预览），松开后浮层消失、真实元素平滑落位。右栏列表在展开状态下按**整个 section**（标题行 + 展开的书签卡片）一起拖动、占位和落位，不会只移动标题。触屏为避免和滚动冲突，仍保留约 `280ms` 的按住判定。快速单击不受影响：列表标题仍然收起 / 展开本栏，卡片仍然在系统浏览器中打开；发生拖动的那一次点击会被吞掉，不会误触。拖到滚动区域上下边缘会自动滚动，`Esc` 取消当前拖动。搜索过滤时列表和卡片的排序暂停（避免在过滤子集里重排完整顺序），分组排序仍可用。选择态 / 确认层 / 弹窗打开时暂停拖拽。顺序保存在本地（`dsh-archive:order:v3`），并用数据指纹校验，覆盖 `data/bookmarks.json` 后旧顺序会自动失效。
- **标题配色**：每个分组按位置循环取 8 种糖果色（草莓 / 蜜橘 / 芒果 / 薄荷 / 青碧 / 天蓝 / 葡萄 / 兰紫，色相 `20/45/75/150/195/240/285/330`）。左栏分组名用**高饱和**色（`oklch(0.74 0.21)` 混主题前景色，浅色主题对比度约 3.9–4.8）并加粗到 `600`（当前项 `700`）；右栏分组标题复用同一色相，因此和左栏对应行颜色完全一致；列表标题用同色相的低饱和色（`oklch(0.76 0.11)`，对比度约 4.0–4.4），箭头取更淡的一档——靠同色相 + 降饱和表示从属关系。OKLCH 固定感知亮度，明暗主题下都保持可读。
- **计数位置**：页头保留标题、新增 / 导入按钮和搜索框；全局规模（分组 / 列表 / 书签）竖排显示在左栏底部；当前分组的列表 / 书签数（搜索时为命中数）与分组标题同一行、垂直居中。
- **动效**：切换左栏分组时右栏整体淡入并按方向轻移 6px（`0.26s`，向上切换从上方进入，向下切换从下方进入）；列表展开 / 收起用 `grid-template-rows` 从 `0fr` 过渡到 `1fr` 做高度动画（`0.24s`），卡片随之淡入；底栏上滑、单卡删除遮罩从右侧垃圾桶位置淡入并轻微放大、取消时反向退回，批量删除模态框淡入；`prefers-reduced-motion` 下全部关闭。
- **分区与分界线（VS Code 方案）**：分区线一律 `1px` 实线、通栏、方角、无外边距，用宿主的两级边框 token 表达层级——页头底边与左右分栏用 `border-l2`（part 边界），栏头底边与列表分区线用 `border-l1`（pane 内分隔）。每个列表上方一条分区线；列表标题与下属卡片之间**不再画线**（展开状态没有下界线）。标题带悬停底色为通栏，不是圆角药丸。
- **书签卡片**：底色 = `--dsw-specific-sidebar-fill`（缺失时退回 `bg-base`）向主题前景色混一个固定比例，悬停再深一档并换 `border-l2`。比例是 `.ar-root` 上的 `--ar-card-lift` / `--ar-card-lift-hover` 两个变量：浅色 `3%` / `6%`，`body[data-ds-dark-theme]` 下覆盖为 `8%` / `14%`。因为混的是“背景色 → 文字色”的方向，任何主题（包括第三方主题、或侧栏填充恰好等于背景的主题）下卡片与背景都还能分辨（DSH 内置：浅色约 `#f1f2f3`，1.12:1；深色约 `#292a2b`，1.26:1）。`icon` 加载成功就显示 favicon，失效或缺失时退化成首字母色块；悬停显示完整标题和 URL。卡片外层是 `div`，内部用一层铺满卡片的透明链接保留右键复制 / 中键新标签，勾选框、垃圾桶、确认层是同级的真实按钮，避免了 `<a>` 嵌套按钮。
- **点击打开外部浏览器**：左键单击走 Host 的 `POST /dsh-archive/open`，由系统打开默认浏览器；`⌘ / Ctrl / Shift / 中键` 单击保留浏览器原生新标签行为，右键可复制链接地址。选择态下点击卡片改为切换选中，不打开链接。
- **搜索**：按标题或 URL 过滤当前分组；搜索时匹配到的列表自动展开、左栏显示每个分组的命中数，无命中的分组淡出。选择集不受搜索过滤影响，已选但被隐藏的项会在底栏提示。
- **状态记忆**：当前分组和每个列表的收起状态存在 `localStorage`（`dsh-archive:state:v2`），刷新后恢复；拖拽排序另行存在 `dsh-archive:order:v3`。
- **全部展开 / 收起**：右栏页头右侧的单个切换按钮——当前分组全部展开时显示「全部收起」，否则显示「全部展开」，只作用于当前分组。当前分组没有列表时隐藏该按钮。
- **滚动稳定性**：右栏（`.ar-main`）用 `scrollbar-gutter: stable` 常驻预留滚动条槽位，展开 / 收起列表导致滚动条出现或消失时，右侧标题、按钮和卡片都不会横向抖动，卡片网格也不会重新分列。
- 加载失败时给出明确提示和「重试」；打开链接失败时底部弹出一条提示。写操作失败时保持原状：新增 / 导入 / 批量删除 / 移动在弹窗内显示错误，单卡删除用 Toast 提示。

## 目录结构

```text
dsh-archive/
├── package.json           # bundle 清单 + build / test 脚本
├── cordis.patch.yml       # 插入 id 为 archive 的插件行
├── index.js               # Host 入口：注册三个路由
├── routes.js              # GET 书签库 / POST 外部打开 / POST 删除移动
├── lib/
│   ├── config.js          # 路由路径、数据文件、大小与批量上限
│   ├── library.js         # 数据校验、稳定 ID、读写与原子落盘
│   ├── http.js            # JSON 响应、同源校验、限长读取
│   ├── url.js             # 只接受 http(s) URL
│   └── external.js        # 固定 argv 调系统默认打开器
├── client.js              # 生成物：单文件 Client bundle（勿直接改）
├── src/client/            # Client 源码：panel / bookmarks / dialogs / selection / sortable ...
├── scripts/
│   ├── build-client.mjs   # 把 src/client 打包成 client.js
│   └── smoke.mjs          # 无浏览器冒烟测试
├── icon.svg               # 插件图标（资料盒）
├── locale/{zh,en}.json    # meta.title / meta.description（插件管理页展示）
└── data/bookmarks.json    # 书签库（插件自有格式）
```

## 数据格式

`data/bookmarks.json` 是插件自己的书签库，不再沿用浏览器扩展的导出结构，也不再包含导入器留下的 `type` / `customTitle` / `description` / `labelIds` / `favIconUrl` 等字段。只保留当前页面用到的层级、标题、链接和图标：

```json
{
  "groups": [
    {
      "name": "CSS",
      "lists": [
        {
          "title": "Positioning",
          "bookmarks": [
            {
              "title": "px、em、rem、vw、百分比的区别 - 知乎",
              "url": "https://zhuanlan.zhihu.com/p/337377745",
              "icon": "https://static.zhihu.com/heifetz/favicon.ico"
            }
          ]
        }
      ]
    }
  ]
}
```

- 一级分组用 `name`，二级列表用 `title`，卡片用 `bookmarks[]`；`icon` 可省略。
- `url` 与 `icon` 只接受绝对 `http(s)` 链接（`javascript:` / `file:` / `data:` 会被丢弃）；没有合法 URL 的书签、没有标题的列表 / 分组会被丢弃。丢弃后允许列表或分组变空。
- **空列表、空分组是合法数据**，加载 / 展示 / 保存时都保留；`"lists": []`、`"bookmarks": []` 都可以出现。`"groups": []` 表示空书签库，页面显示空状态而不是报错。
- 文件里不存 id、计数或统计：Host 读取时生成**内容派生**的稳定 id（`g_…` / `l_…` / `b_…`），删除或移动某一项不会让其他项的 id 平移；列表 / 分组计数和全局统计也由 Host 派生。id 不写回文件。

**导入一份书签**：页面内的导入会先在本机清洗、再合并进当前库。也可以直接覆盖 `data/bookmarks.json`，刷新页面即可（Host 每次请求都重新读文件，不做缓存）。想保留旧数据就先备份该文件。

导入接受的 JSON 是两级结构 `groups[].lists[].bookmarks[]`（或旧版 `groups[].lists[].cards[]`）。下面这份示例已经包含导出器元信息，导入后会被清洗：

```json
{
  "version": 4,
  "groups": [
    {
      "name": "Import - CSS",
      "type": "public",
      "lists": [
        {
          "title": "Positioning",
          "labelIds": [],
          "cards": [
            {
              "title": "px、em、rem、vw、百分比的区别 - 知乎",
              "url": "https://zhuanlan.zhihu.com/p/337377745",
              "favIconUrl": "https://static.zhihu.com/heifetz/favicon.ico",
              "customTitle": "",
              "description": ""
            }
          ]
        }
      ]
    }
  ]
}
```

- 分组名开头的 `Import - ` 前缀会被去掉；`customTitle` 优先作为书签标题，缺失时用 `title`，再缺失时用 URL。
- 只接受绝对 `http(s)` URL；无效书签、没有标题的列表、没有名称的分组会被丢弃并在导入结果里计入「跳过」。
- 导入是**合并**，不是替换：同名分组 / 列表按名称复用，不删除现有内容；同一列表内按规范化 URL 去重。要整体替换，请直接覆盖数据文件。
- 导入文件上限 8 MB，与数据文件上限一致。

**写操作**：页面内的新增 / 导入 / 删除 / 移动都会永久修改 `data/bookmarks.json`。Host 会先校验 revision、把原文件备份为 `data/bookmarks.json.bak`，再用同目录临时文件原子替换，因此请求失败不会留下半个文件。删除不可撤销，没有回收站。

## 路由

三个路由都只在 loopback 上、且校验同源：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/dsh-archive/bookmarks` | 返回归一化后的分组 / 列表 / 书签集合（含派生计数）、`revision` 和 `capabilities.mutate` |
| `POST` | `/dsh-archive/open` | 请求体 `{ "url": "https://…" }`，交给系统默认浏览器打开 |
| `POST` | `/dsh-archive/mutate` | 请求体 `{ "revision": "…", "op": { … } }`，删除、移动、新增或导入书签，返回最新书签库 |

`open` 只接受绝对 `http(s)` URL，并通过固定 argv 调用系统打开器（macOS `open`、Windows `cmd /c start ""`、Linux `xdg-open`），不经过 shell，因此页面无法借此执行任意命令。

`mutate` 接受四种操作：`{ "type": "delete", "ids": ["b_…"] }`、`{ "type": "move", "ids": ["b_…"], "target": { "groupId": "g_…", "listId": "l_…" } }`、`{ "type": "create", "bookmark": { "url": "https://…", "title": "…", "icon": "https://…" }, "target": { … } }` 和 `{ "type": "import", "data": { "groups": [ … ] } }`。`create` 的 `target` 可以给 `groupId` / `listId`，也可以用 `groupName` / `listTitle` 指定或新建目标；同一列表内重复 URL 返回 409 `duplicate-bookmark`。`import` 会清洗并合并导入数据，返回体额外带 `imported` 统计；`create` 额外带 `created` 的三个 id。删除 / 移动单次最多 500 个 id；`revision` 不一致返回 409 和最新书签库，由页面刷新；请求非法返回 400，目标 / 书签不存在返回 404，写盘失败返回 500。写操作在 Host 内串行执行，请求体上限 8 MB（`open` 仍为 8 KB）。

## 安装

插件已在本机 profile 中安装并生效。重新安装 / 在别的 profile 安装：

```bash
# 让 Agent 调用 plugin_manager：
# action: install_bundle
# target: <本目录的绝对路径>
```

安装后侧栏出现「资料库」图标，点击进入面板。`client.js` 是构建产物；修改 `src/client/` 后运行 `npm run build:client`，再刷新 DSH Web 页面加载新的浏览器模块（不是热更新）。Host 半（`index.js` / `routes.js` / `lib/`）的改动在 DSH 重启或插件重新加载后生效。写操作会直接修改插件目录下的 `data/bookmarks.json`，重装 / 覆盖数据前先备份。

## 开发

Client 源码按职责拆在 `src/client/`：`index.js` 只做注册，`panel.js` 管页面状态与布局，`bookmarks.js` / `sidebar.js` / `header.js` 是展示组件，`dialogs.js` 是批量删除 / 移动 / 已选清单，`selection.js` 是选择集合的纯函数，`sortable.js` 是拖拽排序，`storage.js` 与 `order.js` 管本地状态和顺序，`styles.js` / `i18n.js` / `api.js` 分别是样式、文案和 Host 调用。DSH 每个插件只加载一个自包含的 `client.js`，因此 `scripts/build-client.mjs` 用零依赖的方式把这些源码模块包进同一个 lazy-CJS bundle：

```bash
npm run build:client   # 重写 client.js
npm test               # 数据模型、空结构、导入清洗、稳定 ID、增删改、bundle、顺序、选择、存储、路由
npm run check          # 构建一致性 + 语法 + 冒烟检查
```

`client.js` 由构建生成，不要直接编辑。宿主侧没有构建步骤，`index.js` / `routes.js` / `lib/*.js` 都是可直接运行的 ESM。

自测路由（需要 DSH 正在运行；端口以实际为准，若页面启用了鉴权还需带上同一会话的凭据）：

```bash
curl -s http://127.0.0.1:54677/dsh-archive/bookmarks | head -c 200
curl -s -X POST -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}' \
  http://127.0.0.1:54677/dsh-archive/open
```

写操作会改真实数据。要手工试 `mutate`，先备份并用 GET 返回的 `revision`：

```bash
cp data/bookmarks.json /tmp/bookmarks.json
curl -s -X POST -H 'content-type: application/json' \
  -d '{"revision":"<GET 返回的 revision>","op":{"type":"delete","ids":["<b_…>"]}}' \
  http://127.0.0.1:54677/dsh-archive/mutate
```

## 已知限制

- **永久删除**：没有回收站 / 撤销；只有写前 `.bak` 整文件备份，不在 UI 提供恢复入口。
- 页面内支持新增 / 导入 / 删除 / 移动书签，但不支持编辑已有书签的标题 / URL、重命名 / 删除分组和列表；空分组 / 空列表可以由“删掉最后一张卡片”或导入产生，但界面不提供单独新建空结构的入口（新增书签时会顺带创建目标结构）。
- 导入按名称合并，无法在导入时选择“替换整个库”；同一链接可以存在于不同列表，同一列表内不允许重复 URL。
- 数据格式升级后旧的 `dsh-archive:order:v2` / `state:v1` 不再读取，首次打开按文件顺序显示；重新拖动 / 折叠会写入新的 `v3` / `v2`。
- 书签库是单份文件；还没有多集合切换。拖拽排序只在浏览器本地保存，不写回 `data/bookmarks.json`，因此换浏览器 / 清空站点数据后会回到文件顺序。
- 触屏没有 hover：单卡删除走「选择」入口的底部栏，不常驻显示每张卡片的垃圾桶。
- favicon 由各站点直连加载，离线或被墙的站点会退化成首字母块。
