# AIGC 简笔画工坊 v0.3 · 视觉设计规范（Visual Spec）

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0（Phase 1 交付） |
| 对应产品版本 | v0.3（代码基线 v0.2，提交 `13cc02d`） |
| 上游依据 | `docs/PRD-v0.3.md` 第四章 / 第七章 FR-01~FR-14 / 第八章 NFR / 第九章状态机 / 第十一章 SEC / 附录 B、D、E |
| 视觉基线 | `src/style.css`（现有令牌 + 增量令牌）、`index.html`、`docs/preview/cat.svg`、`docs/preview/runner.svg` |
| 作者 | 视觉设计架构师（视觉方向） |
| 读者 | team-lead、Phase 2 体验设计师、Phase 3 前端工程师、合规确认人 |

> **交付边界**：本文档只定义视觉方向与可落地的规格数值。作者未修改、也不得修改 `index.html`、`src/**/*.ts`、`src/style.css`。所有 CSS 均为**追加式**草案，由 Phase 3 落地；示例 SVG 由 Phase 3 按 §1.3 绘制约束补齐。
>
> **读法**：§2 色板与 §7 类名清单是给前端直接复制的；§3 是全局标尺；§4 是 9 类界面的逐组件规格；§5、§6 是几何与坐标；§8 是不可协商的禁止项。凡标注「对比度」处均按 WCAG 2.1 相对亮度公式估算，误差 ±0.1。

---

## 0. 核心结论先行（给赶时间的人）

1. **不换设计语言**。全部新增色值从现有 `--primary #4f7cff`、`--err #e0483d`、`--text #1f2329`、`--info-text #5f6672` 四组同色相明度阶梯推导，不引入第 4 个色相（现有橙色 `#d2691e` 仍只服务 `.tag-stickman`）。
2. **发现两处存量对比度不达标**，必须在本期新增界面里规避：`--muted #8a9099` 在白底仅 **3.2:1**；白字压 `--primary #4f7cff` 仅 **3.7:1**、压 `--err #e0483d` 仅 **4.1:1**。修法见 §2.3，属同色相加深，不是推翻重做。
3. **示例 vs 用户作品的区分不靠颜色**：靠「虚线边框 + 中性灰角标 + 说明文案」三重结构标记，直接对应 RK-06 / FR-01 规则 2。
4. **所有新增正文用 `--text` / `--info-text` / `--primary-d` / `--err-700` / `--ok-text`**，均 ≥4.5:1；深色底仅保留现有 toast，禁止暗色卡片化。
5. **分享卡片是 Canvas 像素排版，不是 DOM 组件**，坐标见 §6；不含水印、二维码、诱导文案与任何配置字段。

---

## 1. 设计原则与延续性

### 1.1 五条设计原则

| 编号 | 原则 | 具体落地 | 明确避免 |
|---|---|---|---|
| P1 | **价值先行，配置后置** | 视觉权重顺序：示例作品墙 > 价值说明卡 > 生成表单 > 模型设置。权重靠「面积 / 留白 / 边框有无」建立，不靠加大字号或加颜色 | 避免把设置区做成默认展开的红色/深色重点块；避免用大标题抢画布注意力 |
| P2 | **同一套语言，只加不改** | 新增色值全部由现有令牌推导；圆角沿用 8 / 10 / 12 三级；边框沿用 1px + 2px 焦点环 + 3px 左强调；阴影沿用现有 `0 4px 14px rgba(0,0,0,.08)` | 避免新增饱和色相、渐变、玻璃拟态、大圆角（>16px）、双色阴影；避免改 `:root` 开头 12 个原令牌的值 |
| P3 | **区分靠结构，不靠颜色** | 示例作品：1px dashed 边框 + 中性板岩色「示例」角标 + 说明文案；用户作品：实线/无边框 + 无角标。分享卡片再用「示例作品 / 生成作品」类型胶囊 | 避免用醒目橙/红去标示例（会造成「警告」误读），也避免示例与用户作品共用同一视觉标记 |
| P4 | **克制的可信感** | 浅底、低饱和、1px 边框；阴影只给浮层（导出面板 / 确认弹窗 / tooltip）；费用、隐私、危险操作用文字说清，不用大面积红底制造焦虑 | 避免为了「高级感」把说明卡、导出面板、确认弹窗做成深色；避免用 emoji 当功能图标 |
| P5 | **无障碍是硬约束，不是补丁** | 正文 ≥4.5:1；可点击控件边界 ≥3:1；44px 触控目标；状态至少由「文案 + 图形 / 角标」两者共同表达，不单靠颜色；`prefers-reduced-motion` 必须降级 | 避免用 `--muted` 写新增正文；避免 disabled 态再叠低对比文字；避免只把边框变红当成错误提示 |

### 1.2 延续性清单（不得推翻的既有事实）

| 类别 | 现有值 / 类 | 本期处理 |
|---|---|---|
| 主题 | 浅色：`--bg #f6f7f9`、`--panel #ffffff`、`--border #e3e6ea`、`--text #1f2329` | 原值全部保留，不新增暗色皮肤 |
| 主色 | `--primary #4f7cff`、`--primary-d #3a63d8` | 保留；`#4f7cff` 降级为「非文字强调」专用（详见 §2.3） |
| 语义色 | `--ok #1faa6b`、`--err #e0483d`、`--muted #8a9099` | 保留值；`--muted` 降级为装饰/大字/禁用专用 |
| 增量令牌 | `--primary-050/100/200/300`、`--err-050/100/300/600/700`、`--focus-ring`、`--toast-bg`、`--info-text`、`--ok-text` | 全部原样复用，不重命名 |
| 字体 | `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` | 原样复用，一字不改 |
| 组件 | `.panel`、`.mode-toggle/.mode-btn`、`.chip`、`.primary`、`.status`、`.toast/.toast-region`、`.card/.thumb/.tag`、`.canvas`、`.stage-actions`、`.footer` | 新组件复用其视觉语汇；已有类不删改 |
| 交互基线 | `:is(a,button,input,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}`（`style.css:290`）、44px 触控、`@media (hover:hover)` 隔离 hover、reduced-motion 全局降级、760px 断点 | 全部沿用；新增 CSS 不得对 `:focus-visible` 设 `outline:none` |
| 页脚 | `.footer` 常驻「本站不收费 · 模型与 API Key 由你自备 · 数据仅存本机」+ 仓库文本链接 | 不改；设置区说明是它的展开补充，不是替代 |

### 1.3 示例作品的画风延续（6 张内置 SVG 的绘制约束）

现有 `cat.svg` / `runner.svg` 已经定义了画风。Phase 3 补齐另外 4 张时**必须**沿用，不得引入另一套插画风格：

| 约束 | 值 |
|---|---|
| 根节点 | `<svg xmlns viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="...">` |
| 主线条 | `fill="none" stroke="#222222"`，简笔画 `stroke-width="4"`，火柴人 `stroke-width="6"` |
| 线端 | `stroke-linecap="round" stroke-linejoin="round"` |
| 强调填充 | 仅允许单色浅蓝 `#cfe3ff`（如猫的帽子）；其余图元 `fill="none"`；实心点用 `#222222` + `stroke="none"` |
| 辅助线 | 速度线 / 动势线用 `#8a9099`，`stroke-width="4"` |
| 安全边距 | 主体距 viewBox 四边 ≥ 32 单位（8%），防缩略裁切 |
| 禁止节点 | `<text>`、`<image>`、`<filter>`、`<foreignObject>`、`<script>`、外部 `xlink:href`、`style` 属性、任何事件属性、`data:` 协议 |
| 体积 | 单张 ≤ 8KB，6 张合计 ≤ 60KB（NFR-03）；进入 DOM 前一律过 `sanitizeSvg`（FR-01 规则 1） |
| 内容 | 3 简笔画 + 3 火柴人，均为原创虚构物，不含个人信息、不含第三方素材（附录 D） |

---

## 2. 色彩系统

### 2.1 可复制的增量 `:root` 块（追加在现有增量 `:root` 之后）

```css
/* ===== v0.3 视觉方向 · 追加令牌（不覆盖开头 12 个原令牌与现有增量令牌） ===== */
:root {
  /* 主色阶梯：白字承载色 / hover 加深色 */
  --primary-700:#3a63d8;          /* 等同现有 --primary-d，语义别名，便于按阶梯引用 */
  --primary-800:#2f52bd;          /* 新增：实心主按钮 hover */

  /* 中性：表面与边界 */
  --surface-1:#fbfcfd;            /* 令牌化现有硬编码值；输入框 / 卡片底 */
  --surface-2:#f1f3f6;            /* 新增：禁用底 / 历史条底 / 空态底 */
  --border-strong:#cdd3dc;        /* 新增：装饰性分隔线（非交互边界） */
  --sample-border:#7b8595;        /* 新增：示例作品可点击边界，≥3:1 */
  --sample-badge-bg:#e7ebf1;      /* 新增：示例角标底 */
  --sample-badge-text:#4a5261;    /* 新增：示例角标字 */
  --text-inverse:#ffffff;         /* 新增：深色底上的文字 */
  --overlay:rgba(31,35,41,.45);   /* 新增：<dialog> 遮罩 */

  /* 语义：成功底 / 危险 hover */
  --ok-050:#eaf8f1;
  --err-800:#8e2e26;              /* 新增：危险按钮 hover */

  /* 分享卡片绘制常量（CSS 变量仅作文档锚点，Canvas 用同一 hex） */
  --share-paper:#ffffff;
  --share-ink:#1f2329;
  --share-meta:#5f6672;
  --share-link:#3a63d8;
  --share-line:#e3e6ea;
}
```

### 2.2 令牌关系表（与现有令牌的关系）

| 新令牌 | HEX | 与现有令牌的关系 | 用途 |
|---|---|---|---|
| `--primary-700` | `#3a63d8` | **= 现有 `--primary-d`**（别名，不新增色值） | 实心主按钮 / 危险级以下的强调文字 / 链接 |
| `--primary-800` | `#2f52bd` | `--primary-d` 同色相再降明度约 18% | 实心主按钮 hover |
| `--primary` | `#4f7cff` | 保留原值，**用途收窄** | 焦点环、选中描边、加载环、非文字色块、进度条；**不再承载白字正文** |
| `--primary-050/100/200/300` | 现有 | 原样复用 | 说明卡底 / 选中底 / hover 底 / toast 进度点 |
| `--err-050/100/300/600/700` | 现有 | 原样复用 | 错误底 / 警示边 / 错误正文 |
| `--err-800` | `#8e2e26` | `--err-700 #a8392f` 再降明度 | 危险按钮 hover |
| `--err` | `#e0483d` | 保留原值，**用途收窄** | 左边框、圆点、图形；不作白字底 |
| `--ok-050` | `#eaf8f1` | `--ok #1faa6b` 的极浅 tint | 「上次成功结果」角标底 |
| `--ok-text` | `#147a4d` | 现有 | 成功正文 / 成功角标字 |
| `--muted` | `#8a9099` | 保留原值，**降级** | 仅装饰性分隔、≥24px 大字、禁用态（WCAG 豁免）、SVG 速度线；**禁止用于新增正文** |
| `--info-text` | `#5f6672` | 现有，本期**升格为次要正文唯一色** | 所有新增说明 / 标签 / 计数 / 页脚 |
| `--surface-1` | `#fbfcfd` | 现有硬编码值令牌化 | 输入框、卡片、示例格底 |
| `--surface-2` | `#f1f3f6` | `--bg #f6f7f9` 同色相降 2% | 禁用底、历史条容器底 |
| `--border-strong` | `#cdd3dc` | `--border #e3e6ea` 降明度 | 装饰分隔线（**禁止**作为可点击控件唯一边界） |
| `--sample-border` | `#7b8595` | `--muted #8a9099` 同色相降明度至通过 3:1 | 示例格虚线框、示例角标边 |
| `--sample-badge-bg/text` | `#e7ebf1` / `#4a5261` | 中性板岩，非品牌色、非警示色 | 示例角标 |
| `--toast-bg` | `#1f2329` | 现有 | **唯一允许大面积深色的现有组件**，本期不扩大其使用范围 |
| `--overlay` | `rgba(31,35,41,.45)` | `--toast-bg` 的透明化 | `<dialog>::backdrop` |

> **不引入第 4 个色相**：现有 `#d2691e`（`.tag-stickman` 橙）继续只服务火柴人标签；示例角标刻意用中性板岩，避免与「火柴人」标签撞色、也避免被误读为警告。

### 2.3 对比度核算表（WCAG 2.1 相对亮度公式估算）

| # | 前景 | 背景 | 估算对比度 | 判定 | 用途 |
|---|---|---|---|---|---|
| C-01 | `--text #1f2329` | `--panel #ffffff` | **15.8:1** | AA / AAA | 正文、标题 |
| C-02 | `--text #1f2329` | `--bg #f6f7f9` | **14.7:1** | AA / AAA | 页面正文 |
| C-03 | `--info-text #5f6672` | `#ffffff` | **5.8:1** | AA | 次要说明、标签、计数 |
| C-04 | `--info-text #5f6672` | `--bg #f6f7f9` | **5.4:1** | AA | 页脚、说明卡内文 |
| C-05 | `--info-text #5f6672` | `--surface-1 #fbfcfd` | **5.6:1** | AA | 输入框旁说明 |
| C-06 | `--info-text #5f6672` | `--primary-050 #f5f8ff` | **5.4:1** | AA | 价值说明卡内文 |
| C-07 | `--primary-d #3a63d8` | `#ffffff` | **5.3:1** | AA | 链接、激活态文字 |
| C-08 | `--primary-d #3a63d8` | `--primary-100 #eef3ff` | **4.8:1** | AA（贴近下限，勿再减淡） | `.mode-btn.active` / `.style-btn.is-active` / 导出选项激活 |
| C-09 | `--primary-d #3a63d8` | `--primary-050 #f5f8ff` | **5.0:1** | AA | 历史丢弃提示、说明卡强调 |
| C-10 | `#ffffff` | `--primary-700 #3a63d8` | **5.3:1** | AA | **实心主按钮白字** |
| C-11 | `#ffffff` | `--primary-800 #2f52bd` | **6.9:1** | AA | 主按钮 hover 白字 |
| C-12 | `--err-700 #a8392f` | `--err-050 #fdf3f2` | **5.9:1** | AA | 错误正文、明文 Key 警示、危险清单 |
| C-13 | `#ffffff` | `--err-700 #a8392f` | **6.4:1** | AA | **危险按钮白字** |
| C-14 | `#ffffff` | `--err-800 #8e2e26` | **8.2:1** | AA | 危险按钮 hover |
| C-15 | `--ok-text #147a4d` | `#ffffff` | **5.4:1** | AA | 成功状态正文 |
| C-16 | `--ok-text #147a4d` | `--ok-050 #eaf8f1` | **4.9:1** | AA | 「上次成功结果」角标 |
| C-17 | `--sample-badge-text #4a5261` | `--sample-badge-bg #e7ebf1` | **6.6:1** | AA | 「示例」角标 |
| C-18 | `#ffffff` | `--toast-bg #1f2329` | **15.8:1** | AA / AAA | 撤销 toast 文字与按钮 |
| C-19 | `--sample-border #7b8595` | `#ffffff` | **3.7:1** | 非文字 UI ≥3:1 | 示例格虚线边界 |
| C-20 | `--focus-ring #4f7cff` | `#ffffff` | **3.7:1** | 非文字 UI ≥3:1 | 全局焦点环 |

**存量不达标项（本期必须规避，不要求回改旧代码）**

| # | 组合 | 实测 | 问题 | 修法 |
|---|---|---|---|---|
| X-01 | `--muted #8a9099` on `#ffffff` | **3.2:1** | 低于 4.5:1。旧 `.hint` / `.subtitle` / `.desc` / `.empty-gallery` 用它 | 新增界面一律改用 `--info-text`；`--muted` 仅留给装饰/大字/禁用。Phase 3 若无成本可顺手把存量 `.hint` 等替换为 `--info-text`（增量修复，非推翻） |
| X-02 | `#ffffff` on `--primary #4f7cff` | **3.7:1** | `.primary` 现有 15px/600 白字不属「大字号」，不达 AA | 实心主按钮底色改用 `--primary-700 #3a63d8`（5.3:1），hover 用 `--primary-800`；`#4f7cff` 保留作焦点环/描边/脉冲 |
| X-03 | `#ffffff` on `--err #e0483d` | **4.1:1** | `.status.error::before` 的「!」、`.del:hover` 的叉 | 需要白字时改用 `--err-700 #a8392f`（6.4:1）；`#e0483d` 只作边框与圆点 |

> 三条修法均为**同色相明度调整**，色相不变、视觉语言不变，符合「延续、不推翻」要求。若 Phase 3 因回归风险选择不改存量 X-02/X-03，则**所有新增**实心按钮/危险按钮必须按 C-10 / C-13 执行，不得复制旧写法。

### 2.4 深色填充控件的焦点环补强

全局 `:focus-visible` 的蓝环在浅底页面上是 3.7:1（合格），但落在深色实心按钮上仅约 1.7:1，几乎不可见；且 `outline-offset:2px` 会把环画到白色页面上。深色填充按钮统一使用**内外双环**：

```css
/* 只作用于深色填充控件，其余控件沿用 style.css:290 的全局焦点环 */
.btn-danger:focus-visible,
.export-go:focus-visible,
.toast-undo:focus-visible {
  outline: 2px solid #ffffff;          /* 内环：白 on 深底 ≥6.3:1 */
  outline-offset: -5px;               /* 内嵌，避免压住文字 */
  box-shadow: 0 0 0 2px var(--focus-ring); /* 外环：蓝 on 白页 3.7:1 */
}
```

---

## 3. 排印、间距、圆角、阴影、边框的层级规范

### 3.1 字号阶梯（沿用现有系统字体栈，不新增任何字体）

| 令牌 | px | line-height | font-weight | 用途 | 文字色（须达标） |
|---|---|---|---|---|---|
| `--fs-11` | 11 | 1.4 | 600 | 角标、计数、胶囊、tooltip 辅助 | `--sample-badge-text` / `--info-text`（≥5.4:1） |
| `--fs-12` | 12 | 1.5 | 400 | 说明、hint、页脚、元信息、危险清单副文 | `--info-text` / `--err-700` |
| `--fs-13` | 13 | 1.55 | 400 | 状态文案、label、次级按钮、历史说明 | `--info-text` / `--ok-text` / `--err-700` |
| `--fs-14` | 14 | 1.55 | 400 | 表单输入、正文默认、确认弹窗正文 | `--text` |
| `--fs-15` | 15 | 1.5 | 600 | 主按钮 | `#ffffff` on `--primary-700` |
| `--fs-16` | 16 | 1.4 | 600 | 区块标题（画廊标题、设置区小节标题） | `--text` |
| `--fs-18` | 18 | 1.35 | 600 | 示例墙标题、确认弹窗标题 | `--text` |
| `--fs-22` | 22 | 1.3 | 700 | `h1`（保留现值 `22px`） | `--text` |

规则：
- **不新增 9px / 10px / 20px / 24px+ 的界面字号**；字号阶梯只做 8 级，避免堆砌。
- 中文不设 `letter-spacing`（例外：11px 角标可加 `0.02em`）；数字（计数 / 倒计时 / 尺寸）统一 `font-variant-numeric: tabular-nums`，防跳字。
- 760px 下正文不低于 12px；表单 `input/textarea` 保持现有 `font-size:16px`（防 iOS 自动缩放）。
- 所有文字色与背景色组合按 §2.3 取值，**禁止临时写 `rgba(0,0,0,.5)` 之类的半透明文字色**（在棋盘格画布上会失准）。

### 3.2 间距标尺（4px 基）

| 令牌 | px | 用途 |
|---|---|---|
| `--sp-1` | 4 | 图标与文字间隙、角标内边距 |
| `--sp-2` | 8 | 按钮组 gap、缩略条 gap、chip gap（沿用现有 8） |
| `--sp-3` | 12 | 控件内边距、面板内小间距（沿用现有 12） |
| `--sp-4` | 16 | 面板间距、分区间距（沿用现有 16） |
| `--sp-5` | 20 | 栅格 gap（沿用现有 20） |
| `--sp-6` | 24 | 浮层内边距、区块上下留白 |
| `--sp-8` | 32 | 大区块间隔 |
| `--sp-10` | 40 | 页面底部留白（沿用现有 40） |

现有代码中的 `6 / 10 / 14 / 18 / 26 / 28` 为历史值，**保留不动**；新增组件一律用上表 4 的倍数。所有新增容器必须 `min-width:0` 且 `max-width:100%`。

### 3.3 圆角 / 阴影 / 边框

| 层级 | 值 | 用于 |
|---|---|---|
| `--radius-sm` | `8px` | 按钮、输入框、chip、角标、toast、次要按钮（沿用现有 8） |
| `--radius-md` | `10px` | 卡片、导出面板、tooltip（沿用现有 `.card 10px` / `.chip 8px`） |
| `--radius` | `12px` | `.panel`、价值说明卡、`<dialog>`、`.canvas`（沿用现有 12） |
| `--radius-pill` | `999px` | 类型胶囊、状态圆点 |
| `--shadow-1` | `0 1px 2px rgba(31,35,41,.06)` | 示例格 hover、历史当前项 |
| `--shadow-2` | `0 4px 14px rgba(31,35,41,.08)` | 卡片 hover（沿用现有）、tooltip |
| `--shadow-3` | `0 12px 32px rgba(31,35,41,.18)` | 导出面板、`<dialog>`（现有 toast 用 `0 6px 20px rgba(0,0,0,.16)`，保留） |
| 边框 L1 | `1px solid var(--border)` | 默认控件、面板、卡片 |
| 边框 L2 | `1px solid var(--primary-300)` | hover 边界 |
| 边框 L3 | `1px dashed var(--sample-border)` | **示例作品专用**，3.7:1 可点击边界 |
| 边框 L4 | `2px solid var(--focus-ring)` + `offset 2px` | 全局焦点环（沿用） |
| 边框 L5 | `3px solid var(--err)` / `var(--err-300)` | 警示块左强调（沿用现有 `.key-warning` / `.status.error`） |
| 边框 L6 | `inset 0 0 0 2px var(--primary)` | 历史当前项高亮（避免改 border 造成 1px 位移） |

> **禁止**：>16px 圆角、双色/彩色阴影、渐变描边、发光效果、玻璃拟态 `backdrop-filter`。

### 3.4 栅格与断点

| 断点 | 栅格 | 栏宽 | 页面 padding |
|---|---|---|---|
| > 760px | `.layout{grid-template-columns:360px 1fr;gap:20px}` | 左 360 / 右自适应 | `16px 28px 40px`（沿用） |
| ≤ 760px | 单列 `1fr` | 全宽 | `12px 14px 32px`（沿用） |
| ≤ 375px | 单列 `1fr` | 全宽 | `10px 12px 28px` |

右栏画布：`max-width:460px; aspect-ratio:1/1`（桌面）；≤760px `max-width:100%`。示例墙、历史条、操作条均在画布宽度内自适应，不产生横向滚动。

---

## 4. 九类界面组件视觉规格

### 4.0 通用状态矩阵（所有可交互控件必须实现）

| 状态 | 视觉表现 | 对比度要求 |
|---|---|---|
| default | `background:#fff` / `1px solid var(--border)` / `color:var(--text)` / `border-radius:8px` / `min-height:44px` | 文字 ≥4.5:1（C-01） |
| hover | 仅 `@media (hover:hover)` 内生效：`background:var(--primary-050)`、`border-color:var(--primary-300)`、`color:var(--primary-d)`；不加位移、不加缩放 | C-09 5.0:1 |
| focus-visible | 沿用全局 `2px solid var(--focus-ring)` + `offset 2px`；深色填充按钮用 §2.4 双环 | 环 ≥3:1（C-20） |
| disabled | `opacity:.45`、`cursor:default`、`background:var(--surface-2)`；**不叠 `--muted`**；hover 装饰必须失效 | WCAG 对禁用态豁免，但边界仍需可辨 |
| busy | `cursor:progress`、`aria-busy="true"`、文案改「…中」、前置 12px 纯 CSS 旋转环（`2px solid var(--primary-200)` + `border-top-color:var(--primary)`，`0.8s linear infinite`）、重复点击吞掉；**不改盒模型尺寸**（沿用 `.primary.is-generating` 的做法） | 环 ≥3:1 |
| reduced-motion | 旋转环改静态圆环 + 静态文字；所有 transition / animation 由 `style.css:284` 全局降级接管 | — |

角标位置统一约定（避免各组件各写一套）：

| 角标 | 位置 | 尺寸 | 配色 |
|---|---|---|---|
| 「示例」（格内） | 格内 `top:4px; left:4px` | 高 18px，`padding:1px 5px`，`--fs-11`/600，`radius:4px` | `--sample-badge-bg` / `--sample-badge-text` / 1px solid `--sample-border`（C-17） |
| 「示例作品 · 非模型生成」（画布） | `.canvas` 内 `top:10px; left:10px` | 高 24px，`padding:3px 8px`，`--fs-11`/600，`radius:6px` | 同上；画布边框同步改 dashed `--sample-border` |
| 「上次成功结果」（error 态） | `.canvas` 内 `top:10px; right:10px`（与左侧示例角标不冲突） | 高 24px，`padding:3px 8px`，`--fs-11`/600 | `--ok-050` / `--ok-text` / 1px solid `--ok`（C-16） |
| 历史当前项 | 无角标，用 `inset 0 0 0 2px var(--primary)` + `--primary-050` 底 | — | C-20 |
| 分享卡片类型胶囊 | 见 §6 坐标表 | — | 示例用 C-17；生成用 C-08 |

---

### 4.1 首屏价值说明卡 + 默认收起的「模型设置」区

**布局顺序**（`section.panel.left` 内，由上至下）：`.value-card` → `details.settings`（默认收起）→ 模式 → 风格 → 示例 chips → 描述框 → 生成按钮 → `.status`。

#### `.value-card` 价值说明卡（常驻可见，不可折叠）

| 项 | 值 |
|---|---|
| 尺寸 | `width:100%`；收起态总高 ≤ 108px；`padding:14px 16px`；`margin-bottom:16px` |
| 底 / 边 | `background:var(--primary-050) #f5f8ff`；`1px solid var(--primary-200) #dbe6ff`；`radius:12px`；**无阴影** |
| 标题 | `--fs-14`/600/`--text`，一句话价值说明，例：「写一句话，得到一张能直接下载、打印、转发的简笔画」。不写「最」「第一」「顶级」 |
| 三条事实 | 横排（桌面）/ 自动换行（375px），每条 `--fs-12`/400/`--info-text`（C-06 5.4:1），前缀 6px 圆点 `--primary`（非文字图形）。三条固定文案：「本站不收费」「模型与 Key 自备」「数据仅存本机」 |
| 费用/隐私入口 | `.value-more`，`--fs-12`/600/`--primary-d`（C-07 5.3:1），`background:none;border:0;text-decoration:underline`（仅 hover 显示下划线），`min-height:32px`，带 `aria-expanded` |
| 展开详情 | `.value-detail`：`--fs-12`/`--info-text`，`line-height:1.6`，`padding-top:12px`，`border-top:1px solid var(--primary-200)`；静态文本，采用附录 E 建议稿口径；**不做弹窗、不做遮罩、不自动跳转** |
| 状态 | hover（仅链接）：下划线 + `--primary-800`；focus-visible：全局焦点环；无 disabled / busy |

> 费用说明在设置区**收起**时仍必须可见（FR-01 规则 5 / 附录 B），由本卡承担；页脚 `.footer` 的常驻说明同时保留。

#### `details.settings` 默认收起

| 项 | 值 |
|---|---|
| 默认态 | 移除 `open` 属性；`summary` 为唯一可见行，`min-height:44px` |
| `summary` 视觉 | `display:flex;align-items:center;justify-content:space-between`；`background:var(--surface-1)`；`1px solid var(--border)`；`border-radius:8px`；`padding:0 12px`；`--fs-14`/600/`--text`；`cursor:pointer`；去掉默认三角标记（`list-style:none` + `::-webkit-details-marker{display:none}`） |
| 展开指示 | `summary::after` 纯 CSS 箭头（`6px` border 旋转 45°，`--info-text`），展开时 `rotate(135deg)`；**不用图标字体 / 不用 emoji 新增** |
| 收起态右侧提示 | `.settings-hint`，`--fs-12`/400/`--info-text`：「可选 · 不填也能看示例」，与箭头同排右对齐；375px 下换行到第二行 |
| 顶部小节标题 | `.settings-section-title`，`--fs-13`/600/`--info-text`，`margin:0 0 8px`；展开后**费用说明与明文警示置顶**（附录 B） |
| 展开体 | `.settings-body`：`padding-top:12px`；沿用现有 `.settings` 的下分隔线；字段沿用现有 `input` 样式（`9px 11px`、`8px` 圆角、`#fbfcfd` 底） |
| 状态 | default / hover（`--primary-050` 底 + `--primary-300` 边）/ focus-visible（全局环）/ open（箭头旋转、下圆角收为 0）；无 disabled |

#### 设置区内部新增控件

| 控件 | 规格 |
|---|---|
| `.notice`（费用说明 / 隐私说明） | `--fs-12`/`--info-text`，`line-height:1.6`，`padding:10px 12px`，`background:var(--surface-1)`，`1px solid var(--border)`，`radius:8px`，`margin:8px 0`。纯静态文本，不引入第三方脚本或远程字图 |
| `.key-warning` | **完全复用现有样式，不改一个值**（`--err-050` 底 / `--err-100` 边 / 3px `--err-300` 左条 / `--err-700` 字，C-12 5.9:1）。位置：紧随费用说明之后、字段之前 |
| `.preset-select`（端点预设下拉） | 复用 `input` 视觉：高 40px（≥44px 触控用 `min-height:44px`）、`1px solid var(--border)`、`radius:8px`、`--fs-13`/`--text`。右侧 `.preset-note`：`--fs-11`/`--info-text`：「仅填地址，本站不验证第三方服务」+「测试会产生一次极小的模型调用」。下拉箭头用原生 `select` appearance 或纯 CSS，**不用图标库** |
| `.btn-test`（测试连接） | 次要按钮，不与 `.primary` 抢注意力：`background:#fff`、`1px solid var(--border)`、`--fs-13`/600/`--text`、`min-height:40px`（粗指针 44px）、`radius:8px`、`width:auto;padding:0 16px`。busy：spinner + 「测试中…」+ `cursor:progress`；可取消时文案「取消测试」，`color:var(--primary-d)` |
| `.test-result` | 成功：`--ok-text` on `#fff`（C-15）；失败：复用 `.status.error`（C-12）；`--fs-13`，`min-height:42px` 防跳变（沿用 `.status` 的 42px 设计）；不得出现任何 Key 片段 |
| `.check-row`（本次不保存 Key） | `display:flex;gap:8px;align-items:flex-start`；原生 `checkbox` 保持 16px，`accent-color:var(--primary-700)`；label `--fs-13`/`--text`；`.check-note` `--fs-12`/`--info-text`：「选用后 Key 仅存内存，刷新即失效」。勾选区 `min-height:44px` |
| `.link-danger`（清除本机数据入口） | 文本按钮，非实心红块：`background:none;border:0`、`--fs-12`/600/`--err-700`（C-12 5.9:1）、`text-decoration:underline`、`min-height:44px`、`padding:0`；`margin-top:16px`；前置 3px `--err` 竖条作危险暗示。hover：`--err-800`。点击打开 §4.8 弹窗 |
| `.clear-note` | `--fs-11`/`--info-text`：「仅清除本站保存在本机的数据；清除过程不联网」 |

---

### 4.2 示例作品墙（右栏空态画布）

**结构**：`.canvas.empty` 内的 `.placeholder` 文字占位替换为 `.sample-wall`；画布仍保留 `1px dashed` 虚线与棋盘格底（`style.css:114-120` 原样不动），示例格自身为白底，形成「棋盘格 → 白格」的层次。

| 项 | 值 |
|---|---|
| 网格 | `.sample-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,auto);gap:8px;width:100%;align-content:center;justify-items:center}`；整墙在正方形画布内**垂直居中**，四周留白 |
| 6 格排布 | 第 1 行 3 张简笔画、第 2 行 3 张火柴人（DOM 顺序即此顺序）；`role="list"` / `role="listitem"` 由容器承担 |
| `.sample-tile` | 可点击 `button`；`aspect-ratio:1/1`；`width:100%`；`background:#fff`；`1px dashed var(--sample-border)`（L3，C-19 3.7:1）；`border-radius:8px`；`padding:6px`；`overflow:hidden`；`position:relative`；`min-width:0` |
| `.sample-art svg` | `width:100%;height:100%;display:block`；`preserveAspectRatio="xMidYMid meet"`，**禁止拉伸**；画风按 §1.3 |
| 「示例」角标 | 格内 `top:4px;left:4px`，规格见 §4.0 表；文字固定「示例」，不加模式、不加 emoji |
| `.sample-caption` | 网格下方 `--fs-12`/`--info-text`，居中，单行：「6 幅内置示例 · 点开即可导出 · 无需填写 Key」。375px 下可折 2 行，`text-align:center` |
| 点击后 | 画布切为全幅 SVG（`.canvas.is-sample`）：保留 `1px dashed var(--sample-border)`；左上角标「示例作品 · 非模型生成」（§4.0）；操作条全部启用（下载 SVG / 导出 PNG / 复制代码 / 生成分享图 / 打印），「存入画廊」**保持禁用**（FR-01 规则 4：示例不占配额、不写 localStorage） |
| 三重区分 | ① 虚线边框；② 中性灰「示例」角标（非蓝非橙非红）；③ 文案「非模型生成」。用户生成作品：无角标、实线/无边框、模式标签沿用现有 `.tag-doodle` / `.tag-stickman` |
| 状态 | default：白底虚线；hover（仅 hover 设备）：`--primary-050` 底 + `1px solid var(--primary-300)` + `--shadow-1`，角标不变；focus-visible：全局环；active/pressed：`--primary-100`；`.is-active`（当前载入）：`1px solid var(--primary)` + `--primary-050` 底；`.is-broken`（EX-16）：虚线占位 + `--fs-12`/`--info-text`「这幅示例暂时无法显示」，其余 5 格照常 |
| 对比度 | 角标 C-17 6.6:1；说明 C-03 5.8:1；边界 C-19 3.7:1；SVG 线条 `#222` on `#fff` ≈ 15.8:1 |

---

### 4.3 风格选择器（3 档）

**位置**：`.mode-toggle` 下方，独立于模式组（`role="group" aria-label="画风"`，`aria-pressed` 单选语义）；视觉语汇**完全复用** `.mode-btn`。

| 项 | 值 |
|---|---|
| 标签 | `.style-label`，`--fs-13`/400/`--info-text`，`margin-top:14px`（沿用 `.mode-label`） |
| 布局 | `.style-picker{display:flex;gap:6px;margin-top:8px}`；3 个 `.style-btn` 等宽 `flex:1 1 0;min-width:0`；`min-height:44px`；`radius:8px`；375px 下**仍保持 3 列不换行**（每列约 111px，「圆润可爱」4 字 @13px ≈ 52px，可容纳） |
| 文案 | 极简线稿 / 圆润可爱 / 涂色线稿，**纯文字，无图标、无副标题、无 emoji** |
| default | `#fbfcfd` 底、`1px solid var(--border)`、`--fs-13`/400/`--text` |
| `.is-active` | `--primary-100 #eef3ff` 底、`1px solid var(--primary)`、`--fs-13`/600/`--primary-d`（**C-08 4.8:1，贴近下限，禁止再减淡或降字重**） |
| hover | `--primary-050` 底 + `--primary-300` 边 + `--primary-d` 字 |
| focus / disabled / busy | 全局环 / `opacity:.45` + `--surface-2`（生成中沿用 `.chip:disabled` 的处理，禁用但**不清空**用户选择）/ 无 busy |
| 避免 | 不为「涂色线稿」单独配色（易被误读为「打印模式已激活」）；不加描边样例缩略图（增加体积，违背 NFR-03）；不改变 `.mode-btn.active` 的任何样式（FR-05 规则 3：历史切换不得改动模式选中态） |

---

### 4.4 画布历史缩略条

**位置**：`.canvas` 与 `.stage-actions` 之间。

| 项 | 值 |
|---|---|
| `.history-head` | `display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap`；`--fs-12`/`--info-text` |
| 标题 / 说明 | 左「本次会话历史」，右「仅本次会话有效，重要作品请存入画廊」（FR-05 规则 1）。两者均 C-03 5.8:1 |
| `.history-list` | `display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px`（给焦点环留空间）；`min-height:60px`；`min-width:0`；DOM 顺序 = 时间倒序，**最新在左**，`scrollLeft` 默认 0 |
| `.history-item` | `flex:0 0 56px;width:56px;height:56px`；白底；`1px solid var(--border)`；`radius:8px`；`padding:2px`；`cursor:pointer`；svg `width:100%;height:100%`；`title` + `aria-label` 带 prompt |
| `.is-current` | `box-shadow:inset 0 0 0 2px var(--primary)` + `background:var(--primary-050)`（L6，不改 border 避免 1px 位移）；**不改变尺寸** |
| `.history-tip` | `:hover` / `:focus-visible` 时由 `::after{content:attr(data-prompt)}` 生成：白底 `--panel`、`1px solid var(--border)`、`--shadow-2`、`--fs-12`/`--text`（15.8:1）、`max-width:220px`、`radius:8px`、`padding:6px 8px`、定位在项上方 8px；`pointer-events:none`；reduced-motion 下无过渡 |
| `.history-empty` | `--fs-12`/`--info-text`，刷新后显示「还没有历史 · 仅本次会话有效」（FR-05 验收） |
| `.history-hint`（容量 5 丢弃前） | `--fs-12`/`--primary-d` on `--primary-050`（C-09 5.0:1），`radius:8px`，`padding:6px 10px`，文案「较早的一张已移出本次历史，可先存入画廊」。** informational，不用红色**（避免告警疲劳） |
| 状态 | hover：`border-color:var(--primary-300)`；focus-visible：全局环（列表 `padding:2px` 保证环不被裁）；无 disabled / busy；切换时同步画布 `aria-label` 与模式标签，但**不得**改 `.mode-btn.active`（FR-05 规则 3） |

---

### 4.5 操作条与 PNG 导出面板

#### `.stage-actions` 操作条（6 个动作）

| 项 | 值 |
|---|---|
| 布局 | 覆盖现有 flex 为 `display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px` → 桌面 2 行 × 3 列；≤760px `repeat(2,minmax(0,1fr))` → 3 行 × 2 列（见 §5） |
| 顺序 | 下载 SVG → 导出 PNG → 存入画廊 → 复制代码 → 生成分享图 → 打印 / PDF |
| `.act-btn` | `min-height:44px`；`--fs-13`/400/`--text`（C-01 15.8:1）；`#fff` 底；`1px solid var(--border)`；`radius:8px`；`display:inline-flex;align-items:center;justify-content:center;gap:6px`；`min-width:0`；`overflow-wrap:anywhere` |
| 主次 | 第一行 3 个为默认样式；第二行 3 个用 `.act-btn--quiet`（`background:var(--surface-1)`，其余相同），**不降低字号、不降低对比度**，仅靠底色区分层级 |
| 图标 | **一律纯文字**，不加图标、不加 emoji、不加图标字体（跨平台字形不一致 + 零依赖约束）。现有标题里的 emoji 保留，不再新增 |
| 状态 | hover：`--primary-050` + `--primary-300` 边 + `--primary-d` 字（C-09）；focus：全局环；disabled：`opacity:.45` + `--surface-2` + `cursor:default`；busy：`.is-busy` spinner + 「导出中…」/「合成中…」，`cursor:progress`，`aria-busy="true"`，重复点击吞掉；**盒模型尺寸不变** |
| 「存入画廊」禁用 | 示例作品 / 画廊满 50 时禁用，附 `title` 说明；禁止只靠灰化表达，需保留可读文字 |

> **实现注意（给 Phase 3）**：现有 `@media (max-width:760px)` 里有 `.stage-actions button{flex:1 1 100%;min-height:44px;font-size:12px}`（选择器权重 0,1,1）。改为 grid 后，760px 覆盖规则请写成 `.stage-actions .act-btn{...}`（权重 0,2,0）才能稳定覆盖；不要删除旧的 flex 规则，追加即可。

#### `.export-panel` PNG 导出小面板

| 项 | 值 |
|---|---|
| 触发 | 「导出 PNG」按钮，`aria-expanded`；面板 `hidden` 时完全不渲染（不占布局） |
| 桌面定位 | `.act-wrap{position:relative}`；面板 `position:absolute;right:0;bottom:calc(100% + 8px);width:232px;z-index:40` |
| 容器 | `--panel` 白底、`1px solid var(--border)`、`radius:10px`、`--shadow-3`、`padding:12px` |
| 标题 | `--fs-12`/600/`--info-text`「PNG 导出选项」 |
| 两组选项 | 底色：透明底 / 白底（2 列）；倍率：1x / 2x / 4x（3 列）。复用 `.style-picker` 的选项视觉：`--fs-12`、`min-height:44px`、`radius:8px`、`#fbfcfd` 底、`1px solid var(--border)`；`.is-active` 用 `--primary-100` 底 + `1px solid var(--primary)` + `--primary-d` 字（C-08 4.8:1） |
| 组标签 | `--fs-11`/600/`--info-text`，`margin-bottom:6px` |
| `.export-meta` | `--fs-11`/`--info-text`，例：「透明底 2x = 800 × 800」「线条含文字时，导出效果可能因系统字体略有不同」（FR-04 规则 5） |
| `.export-go` | 实心主按钮：`background:var(--primary-700)`、白字（C-10 5.3:1）、`--fs-14`/600、`min-height:44px`、`width:100%`、hover `--primary-800`；focus-visible 用 §2.4 双环 |
| 状态 | 面板 ESC / 点击外部关闭（交互规则由 Phase 2 定义）；导出中 `.export-go.is-busy`；失败时复用 `.status.error` 并保留「下载 SVG」降级入口（EX-14） |
| ≤760px | `position:fixed;left:12px;right:12px;bottom:12px;width:auto;max-height:70vh;overflow-y:auto`（底部面板形态，避免 375px 溢出） |

#### 打印 / PDF（FR-10）

`@media print` 追加规则（零依赖，不引 PDF 库）：

```css
@page { size: A4; margin: 12mm; }
@media print {
  .topbar,.left,.gallery-title,.gallery,.stage-actions,.history-strip,
  .footer,.toast-region,.export-panel,.value-card,.mobile-lead,.print-hide { display:none !important; }
  .layout { display:block; padding:0; }
  .panel.right { border:0; padding:0; box-shadow:none; }
  .canvas { border:0; background:#fff; max-width:none; width:100%; aspect-ratio:auto; }
  .canvas svg { width:160mm; height:160mm; margin:0 auto; display:block; }
  .print-caption { display:block; text-align:center; font-size:12px;
                   color:#1f2329; margin-top:8mm; }
}
```

`.print-caption` 为唯一保留文字（一行说明），不含 Key / 端点 / 模型名。

---

### 4.6 删除撤销 toast

复用现有 `.toast-region` / `.toast`（`--toast-bg #1f2329`、白字 C-18 15.8:1、`radius:8px`、`0 6px 20px` 阴影、`toast-in .18s`），只加撤销变体，不改基础样式。

| 元素 | 规格 |
|---|---|
| `.toast.is-undo` | `display:flex;align-items:center;gap:8px;position:relative;padding:10px 14px 14px`（底部多留 4px 给进度条）；`max-width:min(360px,calc(100vw - 32px))`（沿用） |
| `.toast-msg` | `flex:1 1 auto;--fs-13;line-height:1.45;color:#fff`；文案「已删除 1 张作品」，不含作品名 / Key |
| `.toast-undo` | `flex:0 0 auto;min-height:36px`（粗指针 44px）；`--fs-13`/600/`#fff`；`background:transparent`；`1px solid rgba(255,255,255,.55)`；`radius:6px`；`padding:4px 10px`；`cursor:pointer`；键盘可达且焦点环可见（FR-06 规则 3）；focus-visible 用 §2.4 双环；hover：`background:rgba(255,255,255,.12)` |
| `.toast-timer` | `position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--primary-300) #b9ceff`；`animation:toast-timer 5s linear forwards`；`@keyframes toast-timer{from{width:100%}to{width:0}}`。5 秒结束→ `.is-leaving`（现有退场过渡）→ 移除节点 |
| 静态兜底 | 同时渲染 `--fs-11`/`#fff` 文本「5 秒」；`prefers-reduced-motion` 下**隐藏进度条动画**，改显静态文案「5 秒内可撤销」，不播报倒计时（避免 aria-live 反复打断） |
| 失败态 | EX-13「恢复失败，作品未找回」用现有 `.toast.warn`（`--err` 圆点），无撤销按钮 |
| 清除终止 | 执行「清除本机数据」时，未结束的撤销窗口立即 `.is-leaving` 移除（FR-13 规则 5），视觉上不得残留撤销入口 |
| 定位 | ≤760px 沿用现有 `.toast-region{left:12px;right:12px;bottom:16px;transform:none;align-items:stretch}`；不得遮挡撤销按钮 |

---

### 4.7 分享卡片（视觉总述）

**它是 Canvas 逐像素绘制的 PNG，不是 DOM 组件**，因此不新增 UI 类名；精确坐标见 §6。视觉规则：

| 项 | 值 |
|---|---|
| 画布 | 1080 × 1440，`--share-paper #ffffff` 纯白底；导出 1:1，不做 `devicePixelRatio` 二次缩放（避免跨机器尺寸漂移） |
| 字体串 | 与 `body` 完全一致的系统字体栈；**禁止远程字体**；`textBaseline` 统一 `top` |
| 三区 | 作品区（含类型胶囊）/ 描述区（2 行截断 + 省略号）/ 来源区（站点地址 + 「本站不收费，模型自备」） |
| 「示例 / 生成」标识 | 顶部右侧类型胶囊；示例另加作品容器 1px dashed `--sample-border`（FR-07 规则 3 / RK-06） |
| 描述截断 | `ctx.measureText` 逐字符累加，宽 800px、最多 2 行，超出以单个「…」收尾；**禁止溢出、禁止绘制半行** |
| 站点地址 | 取 `location.origin` 的静态部署域名（`--share-link #3a63d8`，C-07 5.3:1）；`localhost` 时不渲染该行、不绘制占位框（FR-07 规则 2 / 验收） |
| 作品栅格化 | 先把已过滤 SVG 以 4×（1600×1600）栅格化，再 `drawImage` 到 736×736 区，`imageSmoothingQuality='high'`，避免 400→736 放大后线条锯齿 |
| 禁止内容 | 水印、二维码、诱导分享文案、求 Star 文案、API Key / Base URL / 模型名、任何配置字段、logo 图形、暗色底块（FR-07 规则 4/6、SEC-06、附录 D） |
| 渲染顺序 | 白底 → 顶部信息行 → 分隔线 → 作品容器与图 → 描述 → 分隔线 → 来源区。全程零网络（FR-07 规则 1） |

---

### 4.8 清除本机数据的二次确认（危险操作）

用原生 `<dialog>` + `showModal()`（零依赖，自带焦点陷阱与 ESC），**不用自绘遮罩层**。

| 项 | 值 |
|---|---|
| `::backdrop` | `background:var(--overlay) rgba(31,35,41,.45)`；reduced-motion 下无淡入 |
| `.confirm-dialog` | `width:min(420px,calc(100vw - 32px))`；`--panel` 白底；`border:0`；`radius:12px`；`--shadow-3`；`padding:24px`；375px `width:calc(100vw - 24px);padding:20px` |
| 标题区 | `--fs-18`/600/`--text`「清除本机数据？」，前置 3px × 20px `--err` 竖条；右侧 `.confirm-tag` `--fs-11`/600/`--err-700` on `--err-050`（C-12 5.9:1），`radius:4px`，`padding:2px 7px`「不可恢复」 |
| 说明 | `--fs-14`/400/`--text`，`line-height:1.6`：「将删除以下数据，删除后无法恢复：」 |
| `.confirm-list` | `--err-050 #fdf3f2` 底、`border-left:3px solid var(--err)`、`radius:8px`、`padding:10px 12px`；`--text` on `#fdf3f2` ≈ **14.5:1** |
| 三项清单 | `--fs-13`/400/`--text`，`line-height:1.6`，`::before` 用短横「–」（`--err-700`，**不用 emoji**）。严格三类（FR-13 规则 1）：① API Key 与模型配置（Base URL / Model / 端点预设）② 全部画廊作品（含描述与生成参数）③ 本次会话的画布历史与当前作品 |
| `.confirm-note` | `--fs-12`/`--info-text`：「仅清除本站保存在本机的数据，不会影响其他站点；清除过程不联网。」放在清单下方 |
| `.confirm-actions` | `display:flex;justify-content:flex-end;gap:8px;margin-top:24px`；两按钮各 `min-height:44px`、`radius:8px`、`--fs-14`/600 |
| 「取消」`.btn-quiet` | `#fff` 底、`1px solid var(--border)`、`--text`；hover `--surface-2`；**打开弹窗时默认焦点落在「取消」**（安全默认，交互规则由 Phase 2 确认） |
| 「确认清除」`.btn-danger` | `background:var(--err-700) #a8392f`、白字（C-13 6.4:1）；hover `--err-800 #8e2e26`（C-14 8.2:1）；focus-visible 用 §2.4 双环 |
| 禁止 | 不做红色实心大色块弹窗、不用「删除成功」庆祝态、不加倒计时营销、不加二次弹窗叠弹窗 |

---

### 4.9 状态四态（空 / 加载 / 错误 / 边界）

**总原则**：画布内容在 success / error 态一律保留上一张成功图（PRD 9.1 规则 1），状态只通过「`.status` 文案 + 画布角标 + 控件禁用」表达；**错误时画布边框不变红**（避免误以为作品本身损坏）。状态区沿用 `.status` 的 `min-height:42px` 防跳变设计。

| 态 | 画布 | 设置区 | 状态文案 | 角标 / 对比度 |
|---|---|---|---|---|
| **空 empty** | `.canvas.empty` → 6 格示例墙（§4.2），虚线框 + 棋盘格；生成类按钮按能力启用（示例相关操作可用，「存入画廊」禁用） | `<details>` 收起；价值说明卡常驻，费用说明可见；字段空但**不用红字报错**（EX-02） | 无报错；首屏零错误文案（FR-01 验收） | 「示例」角标 C-17 6.6:1 |
| **加载 busy** | 有上一张图：**不清空**，叠加 `.canvas-veil` = `rgba(255,255,255,.72)` + 居中 24px 纯 CSS 旋转环（`--primary-200` / `--primary`）+ `--fs-13`/`--text`「正在生成…」；无上一张图：保留示例墙，仅置灰 veil，不显示空白画布 | 「测试连接」`.is-busy` + spinner + 「测试中…」，支持取消；其余字段 `disabled` 但**不清空值**；示例 chips `.chip:disabled` 沿用现有 `opacity:.5` | `.status.info` `--info-text`（C-03 5.8:1）；「正在重试一次…」等按 FR-11 文案 | 环 ≥3:1；reduced-motion 下旋转环改静态圆环 |
| **错误 error** | 保留上一张成功图，**右上角**「上次成功结果」角标（`--ok-050` / `--ok-text`，C-16 4.9:1）；画布边框不变色；无上一张成功图则回落示例墙，并给出「先看看示例」次要按钮（不聚焦报错框，EX-02 / FR-01 规则 3） | `.status.error` 完全复用现有样式（`--err-050` 底 + 3px `--err` 左条 + `--err-700` 字，C-12 5.9:1）；分类文案须含可行动作；附 `.status-action` 内联次要按钮（`--fs-12`/`--primary-d`，C-07）如「换用支持跨域的端点」；**状态区不得出现任何 Key 片段** | CORS / 401 / 404 / 429 / 超时 / 其他六类（FR-03 规则 3），不用统一「网络没连上」 | 成功角标 C-16；错误正文 C-12 |
| **边界 boundary** | 描述 2 行截断（分享卡片）、示例损坏跳过单格、离线仍可浏览示例与画廊 | 300 字上限：`.prompt-count.is-limit` 改 `--err-700`/600 + textarea 边框 `--err`（C-12 5.9:1），不弹窗、不截断输入；画廊 50 张满：`.gallery-count.is-full` 改 `--err-700`/600 + toast（EX-11），「存入画廊」禁用并附 `title`；历史 5 张满：`.history-hint`（C-09 5.0:1） | 离线 EX-17：「当前离线，示例作品与画廊仍可用」，用 `.status.info` 而非 error；统计不可用 EX-18：无用户可见错误 | 所有边界文案 ≥4.5:1 |

**状态表达的冗余要求**：错误态 = 红色状态块（色）+「上次成功结果」/「换用支持跨域的端点」（文案）+ 左条与「!」圆点（图形），三者取二以上；不得仅靠颜色。

---

## 5. 移动端布局规则（760px / 375px）

### 5.1 ≤ 760px（单列，沿用现有断点）

| 规则 | 值 |
|---|---|
| 栅格 | `.layout{grid-template-columns:1fr;padding:12px 14px 32px;gap:14px}`（沿用现有）；`.panel{padding:14px}` |
| **栏序（视觉目标采纳；实现手段已由 Phase 2 否决，见 §9）** | **视觉目标与几何不变**：无 Key 陌生访客在 ≤760px 首屏先见 6 张示例；本表其余各行与 §5.2 的 375px 实算（每格 ≈95px）全部保留。**实现手段否决**：禁止无条件 CSS `order`——纯 CSS `order` 只改视觉序、不改 DOM / Tab / 读屏序，违反 WCAG 1.3.2「有意义的顺序」、2.4.3「焦点顺序」与 NFR-08，且会把回流用户的表单推到第二屏；`.right{order:-1}` **仅作几何参考，不是实现指令**。替代实现以 `ux-spec.md` §1 裁决为准：按 `aigc_doodle_settings.apiKey` 分流（无 Key → 右栏置顶；有 Key → 不重排）+ 物理 DOM 重排 `insertBefore`（桌面始终 left→right，禁用 CSS `order`）+ 跨断点焦点恢复。右栏顶部引导行升级为 `.mobile-lead`（费用/隐私摘要）+ `.lead-jump`（44px「开始创作」跳转），视觉规格见 §7.7 |
| 画布 | `.canvas{max-width:100%;aspect-ratio:1/1}`；示例墙 3×2 不变，格宽约 92px（≥44px 触控），整墙垂直居中 |
| 操作条 | `.stage-actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}`；`.stage-actions .act-btn{min-height:44px;font-size:12px;flex:none}`（权重 0,2,0 覆盖旧 flex 规则） |
| 导出面板 | `position:fixed;left:12px;right:12px;bottom:12px;width:auto;max-height:70vh;overflow-y:auto` |
| 设置区 | `.settings summary{min-height:44px}`；`.settings-hint` 折到第二行；`.key-warning{padding-left:30px;font-size:12px}`（沿用现有） |
| 风格选择器 | 3 列不换行，`.style-btn{min-height:44px;font-size:12px;min-width:0}` |
| 历史条 | `.history-head` 折行；`.history-list` 横向可滚，格 52px；`.history-tip` 限制 `max-width:min(220px,calc(100vw - 40px))` |
| 表单 / 按钮 | `input,textarea{font-size:16px;min-height:44px}`（沿用现有）；`.primary{width:100%;min-height:44px}` |
| toast | `.toast-region{left:12px;right:12px;bottom:16px;transform:none;align-items:stretch}`（沿用）；`.toast{width:100%;font-size:12px}` |
| 页脚 | `.footer{padding:0 14px 24px;gap:4px 12px}`（沿用） |
| 防溢出 | 所有新增容器追加 `min-width:0;max-width:100%`；文字 `overflow-wrap:anywhere`；页面无横向滚动条（FR-14 验收） |

> **视觉不变量检查（Phase 2 裁决后追加）**
> 1. **几何不变量未被破坏**：无 Key 路径下物理 DOM 重排与 `order:-1` 的最终视觉序一致，示例墙、画布、操作条、历史条、导出面板的尺寸 / 间距 / 角标位置 / 对比度全部沿用 §4 与 §5.2；有 Key 路径不重排，左栏（含 `.value-card`）回到首位，仅改变两栏先后，不改变任一组件内部视觉规格。
> 2. **费用说明「收起态仍可见」需条件成立**（FR-01 规则 5）：无 Key 路径下 `.value-card` 随左栏移到示例墙下方，首屏的费用/隐私摘要改由 `.mobile-lead` 承担，因此 `.mobile-lead` 在该路径下**必须渲染**、不得省略或折叠；页脚 `.footer` 的常驻说明同时保留作兜底。这是本次裁决唯一新增的视觉依赖。
> 3. **焦点环需跨断点验证**：物理 DOM 重排（尤其 `insertBefore`）可能使当前焦点元素失焦；程序化恢复焦点时浏览器不一定重新触发 `:focus-visible`。Phase 3 须在跨断点恢复后确认全局 2px 焦点环仍可见，否则按 §2.4 或由 Phase 2 定义的兜底显式补环，不得出现「焦点在但看不见」。
> 4. **无新增视觉层级**：`.lead-jump` 采用 `--primary-d` 文字 + 白底描边的次要按钮，不做 `--primary-700` 实心填充，避免首屏出现第二个与「生成」同级的高强调 CTA（P1 视觉权重顺序 / §8 #8）。

### 5.2 ≤ 375px（窄屏收紧）

| 规则 | 值 |
|---|---|
| 页面 / 面板 | `.layout{padding:10px 12px 28px}`；`.panel{padding:12px}`；`.topbar{padding:16px 12px 6px}` |
| 标题 | `h1` 由 22px 收到 `--fs-18`（防折行）；`.subtitle --fs-12` |
| 价值卡 | `padding:12px`；三条事实折 2 行；`.value-more` 保持 44px 触控高 |
| 画布 | 375 − 24（layout）− 24（panel）− 2（border）≈ **325px** 见方；减去画布内 24px padding → 内容 301px；3 格 gap 8 → 每格 ≈ **95px**；2 行共 ≈ 198px，上下各约 51px 留白，由 `.sample-caption` 补在网格下方 |
| 「示例」角标 | 95px 格内角标仍占 ≤ 46px 宽，不遮主体；角标 11px 不缩小（≥44px 触控由整格承担） |
| 操作条 | 2 列 × 3 行；单格宽 ≈ (347 − 8)/2 ≈ 169px，「生成分享图」5 字 @12px ≈ 60px，可容纳；`overflow-wrap:anywhere` 兜底 |
| 导出面板 | 底部面板宽 = 375 − 24 = 351px；底色 2 列 / 倍率 3 列各 ≥ 44px 高 |
| 确认弹窗 | `width:calc(100vw - 24px);padding:20px`；两按钮并排（各约 151px，「确认清除」4 字适配）；三项清单折行不溢出 |
| 风格选择器 | 3 列，每列约 111px，`--fs-12`，不换行 |
| 历史条 / 画廊 | `.gallery{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}`（沿用现有）；历史格 52px 横滚 |
| 触控 | 全部可点元素 ≥44px；沿用 `@media (hover:none) and (pointer:coarse){.del{width:32px;height:32px}}` 的特殊处理，不新增例外 |
| 动效 | 沿用 `prefers-reduced-motion` 全局降级；不新增 >200ms 过渡（例外：5s 撤销进度条、现有 2s 生成脉冲） |

---

## 6. 分享卡片精确排版（1080 × 1440）

坐标原点为左上角，单位 px；左右安全边距 72（内容宽 936，x = 72…1008）。

| 区块 | 元素 | x | y | w | h | 字号 / 字重 | 颜色 | 对比度 |
|---|---|---|---|---|---|---|---|---|
| 顶部信息 | 站名文字 | 72 | 76 | 600 | 32 | 28 / 600 | `--share-meta #5f6672` | C-03 5.8:1 |
| 顶部信息 | 站名前 12×12 方点 | 72 | 86 | 12 | 12 | — | `--primary #4f7cff`（图形） | C-20 3.7:1 |
| 顶部信息 | 类型胶囊（右对齐，右缘 x=1008） | 右缘 1008 | 72 | ≥120 | 36 | 24 / 600 | 示例：`#e7ebf1` 底 / `#4a5261` 字；生成：`#eef3ff` 底 / `#3a63d8` 字 | C-17 6.6:1 / C-08 4.8:1 |
| 分隔 | 分隔线 1 | 72 | 132 | 936 | 1 | — | `--share-line #e3e6ea` | 装饰 |
| 作品区 | 作品容器 | 140 | 176 | 800 | 800 | — | `#ffffff` 底；生成 `1px solid #e3e6ea`，示例 `1px dashed #7b8595`；`radius:24px` | C-19 3.7:1 |
| 作品区 | 作品 SVG（等比 contain） | 172 | 208 | 736 | 736 | — | 4× 栅格化后 drawImage，不拉伸 | — |
| 描述区 | 标签「作品描述」 | 140 | 1012 | 800 | 28 | 24 / 400 | `--share-meta #5f6672` | C-03 |
| 描述区 | 描述正文（≤2 行） | 140 | 1056 | 800 | 120 | 40 / 400，`line-height:60px` | `--share-ink #1f2329` | C-01 15.8:1 |
| 分隔 | 分隔线 2 | 72 | 1240 | 936 | 1 | — | `--share-line #e3e6ea` | 装饰 |
| 来源区 | 站点地址（单行截断） | 72 | 1264 | 936 | 40 | 30 / 600 | `--share-link #3a63d8` | C-07 5.3:1 |
| 来源区 | 「本站不收费，模型自备」 | 72 | 1320 | 936 | 32 | 28 / 400 | `--share-meta #5f6672` | C-03 5.8:1 |
| 底部 | 留白 | — | 1352…1440 | — | 88 | — | `#ffffff` | — |

**比例对照（便于按比例复算）**：作品容器 800/1080 = 74.1% 宽、居中；描述区顶 = 1056/1440 = 73.3%；来源区顶 = 1264/1440 = 87.8%；上下安全边 72px = 5%。

**截断规则**：`ctx.font` 设为上表字号 + 系统字体栈；逐字符 `measureText` 累加，宽度超 800px 换行，累计 2 行后停止并以单字符「…」替换末字符；`localhost` 时不渲染「站点地址」行，将「费用说明」上移到 y=1264、分隔线 2 保持 y=1240，**不绘制任何占位框/虚线框**（FR-07 验收：不显示地址且无空白占位）；此时底部留白增至约 144px，允许，但不得居中拉伸留白或补装饰元素。

**绘制常量（供 Phase 3 换算，非实现代码）**：`W=1080`、`H=1440`、`SAFE=72`、`ART={140,176,800,800}`、`ART_INNER_PAD=32`、`DESC={140,1056,800,120}`、`DESC_LINE=60`、`DESC_MAX_LINES=2`、`SRC_LINE1_Y=1264`、`SRC_LINE2_Y=1320`。

---

## 7. 新增 CSS 类名清单（供 Phase 3 直接落地）

> 命名约定：全部 `kebab-case`；状态统一用 `is-` 前缀（`is-active / is-current / is-busy / is-leaving / is-broken / is-limit / is-full / is-collapsed / is-undo`）；不新增 ID；不覆盖任何现有类名。所有规则**追加**到 `src/style.css`，追加位置在全局 `:focus-visible` 规则之后亦可，但禁止在新规则中对 `:focus-visible` 设 `outline:none`（深色填充按钮除外，用 §2.4）。

### 7.1 价值卡与设置区

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.value-card` | `div` | 常驻说明卡：`--primary-050` 底、`--primary-200` 边、12px 圆角、14/16 padding |
| `.value-title` | `p` | 14/600 `--text` 一句话价值说明 |
| `.value-facts` | `ul` | 三条事实横排，`gap:8px`，375px 折行 |
| `.value-fact` | `li` | 12/400 `--info-text` + 6px `--primary` 圆点 |
| `.value-more` | `button` | 12/600 `--primary-d` 文本按钮，`aria-expanded` |
| `.value-detail` | `div` | 12px 静态费用/隐私说明，`border-top` 1px |
| `.settings.is-collapsed` | `details` | 收起态（由 `open` 属性驱动，类仅作样式钩子） |
| `.settings-head` | `summary` | 44px 高、`--surface-1` 底、8px 圆角、纯 CSS 箭头 |
| `.settings-hint` | `span` | 12px `--info-text` 收起态右侧提示 |
| `.settings-body` | `div` | 展开体，`padding-top:12px` |
| `.settings-section` / `.settings-section-title` | `div` / `p` | 小节容器与 13/600 标题 |
| `.notice` | `p` | 12px 静态说明块，`--surface-1` 底 + 1px 边 |
| `.preset-row` / `.preset-select` / `.preset-note` | `div` / `select` / `span` | 端点预设行、下拉、11px 免责说明 |
| `.btn-test` / `.btn-test.is-busy` | `button` | 次要测试按钮及 busy 态 |
| `.test-result` / `.test-result.is-ok` / `.test-result.is-fail` | `div` | 42px 防跳变结果区 |
| `.check-row` / `.check-row input` / `.check-note` | `label` / `input` / `span` | 「本次不保存 Key」勾选项 |
| `.link-danger` / `.clear-note` | `button` / `p` | 清除入口文本按钮与 11px 说明 |

### 7.2 示例墙与画布角标

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.sample-wall` | `div` | 画布空态容器，垂直居中 |
| `.sample-grid` | `div[role=list]` | 3×2 网格，`gap:8px`，`min-width:0` |
| `.sample-tile` / `.sample-tile.is-active` / `.sample-tile.is-broken` | `button` | 1:1 白格、1px dashed `--sample-border`、8px 圆角 |
| `.sample-art` | `div` | SVG 等比容器，`svg{width:100%;height:100%}` |
| `.sample-badge` | `span` | 格内左上「示例」角标，11/600 |
| `.sample-caption` | `p` | 12px `--info-text` 居中文案 |
| `.broken-note` | `span` | 单格损坏占位文案 |
| `.canvas.is-sample` | `#canvas` | 画布边框改 dashed `--sample-border` |
| `.canvas-badge` / `.canvas-badge--sample` / `.canvas-badge--prev-ok` | `span` | 画布左上「示例作品 · 非模型生成」/ 右上「上次成功结果」 |
| `.canvas-veil` / `.canvas-veil-text` | `div` / `span` | `rgba(255,255,255,.72)` 加载遮罩 + 13px 文案 |

### 7.3 风格选择器

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.style-label` | `label` | 13px `--info-text` 组标题 |
| `.style-picker` | `div[role=group]` | 3 等列 flex，`gap:6px` |
| `.style-btn` / `.style-btn.is-active` | `button` | 44px 分段按钮；激活 `--primary-100` + `--primary-d` |

### 7.4 画布历史

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.history-strip` / `.history-head` / `.history-title` / `.history-note` | `section` / `div` / `span` | 标题行与「仅本次会话有效」说明 |
| `.history-list` | `div` | 横滚 5 格，`scroll-snap-type:x proximity` |
| `.history-item` / `.history-item.is-current` | `button` | 56×56 缩略；当前项 `inset 0 0 0 2px --primary` |
| `.history-tip` | `::after` | hover/focus 显示 `attr(data-prompt)` 的白色 tooltip |
| `.history-empty` | `p` | 12px 空态文案 |
| `.history-hint` | `p` | `--primary-050` 底 / `--primary-d` 字的丢弃提示 |

### 7.5 操作条 / 导出 / 打印

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.stage-actions` | `div` | **追加 grid 覆盖**：桌面 3 列、≤760px 2 列 |
| `.act-wrap` | `div` | 导出按钮的 `position:relative` 锚点 |
| `.act-btn` / `.act-btn--quiet` / `.act-btn.is-busy` | `button` | 44px 操作按钮；次行浅底；busy spinner |
| `.spinner` | `span` | 12px 纯 CSS 旋转环（reduced-motion 转静态） |
| `.export-panel` / `.export-panel[hidden]` | `div` | 232px 浮层 / 760px 底部面板 |
| `.export-group` / `.export-group-label` | `div` / `p` | 底色组、倍率组与 11/600 组标签 |
| `.export-opt` / `.export-opt.is-active` | `button` | 44px 选项；激活 C-08 4.8:1 |
| `.export-meta` / `.export-note` | `p` | 11px 尺寸与字体差异说明 |
| `.export-go` | `button` | `--primary-700` 实心主按钮（C-10） |
| `.print-hide` / `.print-caption` | 任意 / `p` | 打印隐藏工具类 / 唯一保留的一行说明 |
| `.status-action` | `button` | 错误状态区内联次要动作按钮 |

### 7.6 Toast / 确认弹窗 / 状态

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.toast.is-undo` / `.toast-msg` / `.toast-undo` | `div` / `span` / `button` | 撤销 toast 三件套 |
| `.toast-timer` / `.toast-timer.is-static` | `span` | 5s 进度条 / reduced-motion 静态兜底 |
| `.confirm-dialog` / `.confirm-title` / `.confirm-tag` | `dialog` / `h2` / `span` | 危险确认弹窗与标题区 |
| `.confirm-desc` / `.confirm-list` / `.confirm-item` / `.confirm-note` | `p` / `ul` / `li` | 三类不可恢复数据清单 |
| `.confirm-actions` / `.btn-quiet` / `.btn-danger` | `div` / `button` | 44px 取消 / 危险确认双按钮 |
| `.dark-focus` | 任意深色填充按钮 | §2.4 双环焦点补强的语义钩子 |
| `.prompt-count.is-limit` / `.gallery-count.is-full` | `span` | 边界态文字改 `--err-700`/600 |
| `.field-error` | `input/textarea` | 边框 `--err`（仅配合 300 字上限） |
| `.sr-only` | `span` | 屏幕阅读器专用文本（复用型工具类） |
| `.no-print` | 任意 | `@media print` 隐藏工具类 |

### 7.7 移动端顶部引导行（Phase 2 裁决追加，仅 ≤760px）

| 类名 | 挂载 | 一句话规格 |
|---|---|---|
| `.mobile-lead` | `div` | 右栏顶部的费用/隐私摘要行。基础 `display:none`，仅 `@media (max-width:760px)` 内 `display:flex`；`flex-wrap:wrap;align-items:center;gap:8px 12px`；`padding:8px 12px`；`background:var(--surface-1)`；`1px solid var(--border)`；`border-radius:8px`；`margin-bottom:12px`；`min-width:0;max-width:100%`。文字 `--fs-12`/400/`--info-text`（`--surface-1` 上 C-05 5.6:1），`line-height:1.5`；文案采用附录 E 口径的「本站不收费 / 数据仅存本机」摘要，不加绝对化用语、不加诱导文案；`@media print` 中已随 §4.5 打印隐藏列表一并隐藏 |
| `.lead-jump` | `button` | 44px「开始创作」跳转，指向左栏输入区。`min-height:44px;min-width:44px`；`padding:0 14px`；`--fs-13`/600/`--primary-d`（C-07 5.3:1）；`background:#fff`；`1px solid var(--primary-700)`（同为 5.3:1，保证可点击边界 ≥3:1）；`border-radius:8px`；`cursor:pointer`；`white-space:nowrap`；`max-width:100%;overflow-wrap:anywhere`。hover（仅 `@media (hover:hover)`）：`background:var(--primary-050)` + `color/border-color:var(--primary-800)`（6.9:1）；focus-visible：沿用全局 2px 焦点环（C-20 3.7:1）；无 disabled / busy。**禁止**做成 `--primary-700` 实心填充，避免与 `.primary`「生成」抢视觉权重（§8 #8）；不加 emoji / 图标 |

> 两个类名只复用既有 `--info-text` / `--primary-d` / `--primary-050` / `--primary-700` / `--surface-1` 与 44px 触控基线，**不新增任何色值、不改动既有类名与既有令牌**。`.mobile-lead` 的位置恒为右栏顶部（与栏序无关）；**无 Key 路径必须渲染**（§5.1 视觉不变量检查第 2 条），有 Key 路径是否渲染属交互决策，由 `ux-spec.md` §1 / Phase 2 定义，本节只规定其渲染时的视觉规格。

> 分享卡片（§4.7 / §6）为 Canvas 像素绘制，**无新增 CSS 类**；上表（含 §7.7）已覆盖 9 类界面的全部 DOM 组件。

---

## 8. 禁止项（不可协商）

| # | 禁止 | 判定口径 |
|---|---|---|
| 1 | **远程字体 / 图标字体 / `@font-face` 外链**：Google Fonts、任何 `fonts.*` 域名、webfont 文件、iconfont | 字体串必须等于 `style.css:18` 原值，一字不改；分享卡片 `ctx.font` 用同一串 |
| 2 | **第三方脚本 / CDN 资源 / 统计像素 / 外链图片**：任何 `script[src]` 指向非本站域、任何 `<link>` 到外部域 | 与 CSP `default-src 'self'`（NFR-05）、SEC-02、FR-08 规则 1 一致；示例 SVG 必须本地或内联且过 `sanitizeSvg` |
| 3 | **绝对化用语与免费误导**：「最」「第一」「顶级」「国家级」「完全免费」「零成本」「无限免费生成」；不得承诺生成效果 | 统一表述「**本站不收费**」+ 附录 E 费用边界文案（FR-02 规则 1/2、SEC-08、附录 D） |
| 4 | **诱导分享 / 求 Star / 营销装置**：产品内求 Star 弹窗、倒计时、奖励解锁、遮罩、二维码、水印、「分享给好友解锁」 | 4.2 Won't / 2.4 禁止清单 / FR-07 规则 4；页脚仅保留不打扰的源码文本链接 |
| 5 | **暗色卡片滥用**：把价值卡、示例墙、导出面板、确认弹窗、tooltip、分享卡片做成深色底 | 唯一允许大面积深色的是现有 `.toast`（`--toast-bg`）；其余一律 `#ffffff` / `--primary-050` / `--err-050` / `--surface-1` |
| 6 | **对比度不足**：新增正文用 `--muted #8a9099`（3.2:1）；白字压 `--primary #4f7cff`（3.7:1）或 `--err #e0483d`（4.1:1）；用半透明黑字（如 `rgba(0,0,0,.5)`） | 所有新增组合必须命中 §2.3 的 C-01…C-20；正文 ≥4.5:1，可点击控件边界 ≥3:1 |
| 7 | **新增任何 npm 依赖 / 运行时库**：PDF 库（jsPDF）、图像处理库、动画库、图标库、组件库 | NFR-11、FR-10 规则 1；PNG / 分享卡 / 打印只能用原生 Canvas + Blob + `window.print()` |
| 8 | **主色大面积填充**：`--primary` 作 >25% 视口的底色块 | 主色只作焦点环、选中描边、加载环、角标圆点、进度条 |
| 9 | **emoji 当功能图标**：按钮、角标、清单、导出选项里新增 emoji | 跨平台字形不一致；纯文字或纯 CSS 图形；现有标题 emoji 保留不扩散 |
| 10 | **分享卡片 / 导出文件 / 打印稿 / 统计事件携带配置字段**：API Key、Base URL、Model、端点预设 | SEC-03 / SEC-06 / FR-07 规则 6；卡片只含作品、描述、站点地址、费用说明、类型标识 |
| 11 | **示例与用户作品共用视觉标记**：示例无角标、或用户作品出现「示例」字样 | RK-06 / FR-01 规则 2；三重区分见 §4.2 |
| 12 | **改动现有令牌与全局规则**：改 `:root` 开头 12 个原令牌值、删 `.footer`、覆盖 `:focus-visible` 为 `outline:none`、删 44px 触控 / reduced-motion / 760px 断点 | 全部增量追加；深色填充按钮焦点只按 §2.4 局部覆盖 |
| 13 | **375px 横向溢出**：固定宽度浮层、不换行长文案、缺 `min-width:0` 的 flex/grid 子项 | §5.2；FR-14 验收「375px 无横向滚动条」 |
| 14 | **过度动效**：新增 >200ms 的 transition/animation、位移/缩放 hover、视差 | 例外仅：现有 2s 生成脉冲、5s 撤销进度条；reduced-motion 必须静态降级 |
| 15 | **仅在错误态把画布边框变红 / 清空上一张成功图** | PRD 9.1 规则 1；错误由状态区 + 角标表达 |
| 16 | **红色实心大色块弹窗 / 庆祝式成功态 / 二次弹窗叠加** | 危险确认只用白底 + `--err-050` 清单 + `--err-700` 按钮 |

---

## 9. 给下一阶段的落地备注

> **实现优先级（Phase 2 裁决，本次一致性维护追加）**：**Phase 3 落地以 `ux-spec.md` §1 裁决为准**——按 `aigc_doodle_settings.apiKey` 分流（无 Key → 右栏置顶；有 Key → 不重排）+ 物理 DOM 重排 `insertBefore`（桌面始终 left→right，**禁用 CSS `order`**）+ 跨断点焦点恢复。本文档 §5.1 的 `.right{order:-1}` 一行**仅作几何参考，不是实现指令**；其视觉目标、几何规格与 §5.2 的 375px 实算全部保留有效。§7.7 的 `.mobile-lead` / `.lead-jump` 为该裁决追加的视觉组件；未破坏任何视觉不变量，但须满足 §5.1「视觉不变量检查」第 2、3 条两个条件。

**给 Phase 2 体验设计师（3 条，已在交接消息中展开；第 1 条已裁决）**
1. 移动端栏序**已由 `ux-spec.md` §1 裁决**：视觉目标采纳，无条件 CSS `order` 否决（WCAG 1.3.2 / 2.4.3 / NFR-08，且不改 DOM / Tab / 读屏序、会把回流用户表单推到第二屏），改为按 Key 分流 + 物理 DOM 重排 + 跨断点焦点恢复。§5.1 已同步加注，§7.7 已补两个新类名。视觉侧剩余待验收项见 §5.1「视觉不变量检查」第 2、3 条：无 Key 路径 `.mobile-lead` 必须渲染；跨断点焦点恢复后 2px 焦点环须仍可见。
2. 导出面板与 `<dialog>` 的 ESC / 点击外部关闭、打开时焦点落点、关闭后焦点归还、危险弹窗默认焦点落在「取消」，以及 5 秒撤销窗口的终止条件，属交互验收，需写入用例；本文档只定义视觉与几何。
3. 状态四态的提示时序、`aria-live` 播报顺序（避免 5 秒内反复打断）、「上次成功结果」角标与错误文案的出现/消失条件，需与 §4.9 的视觉方案对齐。

**给 Phase 3 前端工程师**
- **栏序实现以 `ux-spec.md` §1 为准**：禁用 CSS `order`，用 `insertBefore` 物理重排 + 按 `aigc_doodle_settings.apiKey` 分流 + 跨断点焦点恢复；§5.1 的 `.right{order:-1}` 仅作几何参考（见本节顶部实现优先级说明），并落地 §7.7 的 `.mobile-lead` / `.lead-jump` 与 §4.5 打印隐藏列表。
- CSS 全部追加，不改现有产品代码结构；`:focus-visible` 全局规则不得被 `outline:none` 覆盖。
- 注意 §4.5 的 CSS 权重提示：760px 覆盖请写 `.stage-actions .act-btn{...}`。
- 补齐 4 张示例 SVG 时严格按 §1.3；6 张合计 ≤60KB，全部过 `sanitizeSvg`。
- 实心按钮一律 `--primary-700` / `--err-700` 白字（§2.3 X-02/X-03 修法），不要复制旧 `.primary` 的 `--primary` 白字写法到新组件。
- 分享卡片坐标按 §6 常量表换算，作品先 4× 栅格化再 `drawImage`。
- 打印样式用 §4.5 的 `@media print` 草案，配合 `.print-hide` / `.print-caption`。

**合规自查映射**：§8 #1/#2 → NFR-05、SEC-02；#3/#4 → FR-02、FR-07、附录 D；#5/#6 → NFR-08；#7 → NFR-11；#10 → SEC-03/06；#11 → RK-06；#13 → NFR-07。
