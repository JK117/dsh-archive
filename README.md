# 资料库（dsh-archive）

DSH 全局面板插件：把浏览器扩展导出的书签集合变成一个两级资料库。左栏是较窄的**一级分组列表**，右栏是当前分组的**可展开 / 收起的二级列表**，展开后是带 favicon 和标题的书签卡片，点击卡片在**系统默认浏览器**中打开链接。

- 入口：左侧栏顶部面板行（`sidebar.panellist`，Plugins / Scheduled tasks / Travel Plotter 旁边）的**资料库**。
- 布局：页头（标题 + 规模统计 + 搜索框）→ 主体左右分栏；左栏 `220px`，右栏自适应并独立滚动。
- 数据：首次加载即带一份真实导出（`data/bookmarks.json`，13 个分组 / 55 个列表 / 153 个书签）。
- 语言：界面文案走 Client locale，中文 / English 各一份；跟随 DSH 语言设置。
- 主题：只用 `--dsw-alias-*` 主题 token，明暗主题都跟随宿主。

## 功能

- **左侧一级列表**：分组名 + 书签数；当前分组高亮，点击切换右栏。导出文件里的 `Import - ` 前缀会被去掉（`Import - CSS` → `CSS`），其余名称原样保留。
- **右侧二级列表**：每个列表是一个可折叠小节，标题行显示展开箭头、列表名和条目数；展开后是卡片网格（`auto-fill`，最小 228px），一行标题最多两行。
- **书签卡片**：`favIconUrl` 加载成功就显示 favicon，失效或缺失时退化成首字母色块；悬停显示完整标题和 URL。
- **点击打开外部浏览器**：左键单击走 Host 的 `POST /dsh-archive/open`，由系统打开默认浏览器；`⌘ / Ctrl / Shift / 中键` 单击保留浏览器原生新标签行为，右键可复制链接地址。
- **搜索**：按标题或 URL 过滤当前分组；搜索时匹配到的列表自动展开、左栏显示每个分组的命中数，无命中的分组淡出。
- **展开状态记忆**：当前分组和每个列表的收起状态存在 `localStorage`（`dsh-archive:state:v1`），刷新后恢复。
- **全部展开 / 全部收起**：右栏页头右侧的两个按钮，只作用于当前分组。
- 加载失败时给出明确提示和「重试」；打开链接失败时底部弹出一条提示。

## 目录结构

```text
dsh-archive/
├── package.json          # bundle 清单：dsh.bundle.patch + dsh.client
├── cordis.patch.yml      # 插入 id 为 archive 的插件行
├── index.js              # Host 半：书签路由 + 外部打开路由
├── client.js             # Client 半：panel 页面 + 侧栏图标
├── icon.svg              # 插件图标（资料盒）
├── locale/{zh,en}.json   # meta.title / meta.description（插件管理页展示）
└── data/bookmarks.json   # 书签集合（来自浏览器扩展导出）
```

## 数据格式

`data/bookmarks.json` 是浏览器扩展导出的原始结构，插件不要求你改写它：

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
          "cards": [
            {
              "title": "px、em、rem、vw、百分比的区别 - 知乎",
              "url": "https://zhuanlan.zhihu.com/p/337377745",
              "favIconUrl": "https://static.zhihu.com/heifetz/favicon.ico"
            }
          ]
        }
      ]
    }
  ]
}
```

Host 在读取时做一次归一化：`groups[].name` 作为一级标题、`lists[].title` 作为二级标题、`cards[]` 作为卡片；只保留 `http(s)` 链接（`javascript:` / `file:` 等会被丢弃），并生成稳定的 `g{组}-l{列表}` / `c{组}-{列表}-{序号}` id。空的列表和分组会被跳过。

**换一份书签**：直接覆盖 `data/bookmarks.json`，刷新页面即可（Host 每次请求都重新读文件，不做缓存）。想保留旧数据就先备份该文件。

## 路由

两个路由都只在 loopback 上、且校验同源：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/dsh-archive/bookmarks` | 返回归一化后的分组 / 列表 / 卡片集合 |
| `POST` | `/dsh-archive/open` | 请求体 `{ "url": "https://…" }`，交给系统默认浏览器打开 |

`open` 只接受绝对 `http(s)` URL，并通过固定 argv 调用系统打开器（macOS `open`、Windows `cmd /c start ""`、Linux `xdg-open`），不经过 shell，因此页面无法借此执行任意命令。

## 安装

插件已在本机 profile 中安装并生效。重新安装 / 在别的 profile 安装：

```bash
# 让 Agent 调用 plugin_manager：
# action: install_bundle
# target: <本目录的绝对路径>
```

安装后侧栏出现「资料库」图标，点击进入面板。修改 `client.js` 后需要刷新 DSH Web 页面才会加载新的浏览器模块（不是热更新）。

## 开发

无构建步骤：`index.js` / `client.js` 都是可直接运行的 ESM / 纯 JS，改完刷新页面即可。

```bash
node --check index.js
node --check client.js
```

自测路由（需要 DSH 正在运行，端口以实际为准）：

```bash
curl -s http://127.0.0.1:64993/dsh-archive/bookmarks | head -c 200
curl -s -X POST -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}' \
  http://127.0.0.1:64993/dsh-archive/open
```

## 已知限制

- 当前只读：能浏览、搜索、打开书签，暂不支持在页面内新增 / 编辑 / 删除书签或导入新文件（换数据靠覆盖 `data/bookmarks.json`）。
- 书签集合是单份文件；还没有多集合切换或分组排序。
- favicon 由各站点直连加载，离线或被墙的站点会退化成首字母块。
