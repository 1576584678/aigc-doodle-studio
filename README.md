# AIGC 简笔画工坊

> 描述一句话，生成可直接下载的 SVG 简笔画 / 火柴人。
> A tiny, serverless doodle studio: describe it in one sentence, get a clean SVG.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)
![Zero backend](https://img.shields.io/badge/backend-none-6b7280.svg)
![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-1faa6b.svg)

**在线 Demo**：<https://1576584678.github.io/aigc-doodle-studio/>（首次 Pages 部署完成后可用）
**源码**：<https://github.com/1576584678/aigc-doodle-studio>

<table>
  <tr>
    <td align="center"><img src="docs/preview/cat.svg" width="230" alt="戴帽子的猫，简笔画示例"><br><sub>简笔画模式 · 内置示例</sub></td>
    <td align="center"><img src="docs/preview/runner.svg" width="230" alt="正在跑步的火柴人，火柴人示例"><br><sub>火柴人模式 · 内置示例</sub></td>
  </tr>
</table>

<sub>上方为仓库内置的原创 SVG 示例作品，非模型实时生成结果。</sub>

---

## 它是什么

一个**纯静态前端**小工具：浏览器直接调用你自己配置的 OpenAI 兼容 `chat/completions` 端点，让模型输出一段 SVG，前端清洗后渲染到画布，可下载、可复制、可存进本地画廊。

| 关键事实 | 说明 |
|---|---|
| 没有服务器 | 静态 HTML/CSS/JS，可托管在任意静态站点 |
| 没有账号 | 不注册、不登录、不收集任何个人信息 |
| 不收费 | 本站不收费；模型调用费用由你与所选服务商结算 |
| Bring Your Own Key | API Key、Base URL、Model 由你填写，只保存在本机浏览器 |
| 零运行时依赖 | 仅 TypeScript + Vite 构建，产物不含第三方运行时库 |

> 配置提示：因为是浏览器直连，你填写的端点需要是 **HTTPS** 且**允许跨域（CORS）**。纯前端站点无法代为转发请求。若端点不满足这两个条件，生成会失败——这是架构选择带来的已知约束，不是 bug。

---

## 为什么值得看代码

这类「让大模型吐 SVG」的 demo 常见，本项目把力气花在了**不可信模型输出进入 DOM 之前**这一段上。

**1. SVG 白名单安全过滤**（`src/sanitize.ts`）

模型输出是不可信输入，直接 `innerHTML` 等于把 XSS 入口敞开。这里用 DOMParser 解析为 XML 文档后做「元素白名单 + 属性白名单 + 显式黑名单」双保险：

- 只保留 `svg/g/path/line/circle/rect/ellipse/polyline/polygon/text/tspan/title/desc`，非白名单元素**连同整棵子树**删除；
- 显式封禁 `script / foreignObject / image / style / animate / use / a / iframe / filter / mask / pattern / defs / set` 等向量；
- 所有 `on*` 事件属性删除；属性值经去空白与控制字符的 `squash` 处理后拦截 `javascript:` / `data:` / `vbscript:` / `expression(`，抵御 `java\tscript:` 类混淆；
- 拒绝 `DOCTYPE` / `ENTITY`（防实体展开），CDATA 降级为普通文本节点，注释与处理指令移除；
- 强制补全合法 `xmlns`，序列化后再校验根节点与命名空间。

过滤执行**三次**：生成侧（`api.ts`）、画布渲染侧（`main.ts`）、画廊读取侧（`main.ts`）。第三处用于防「localStorage 被篡改后的存储型 XSS」。下载、复制、分享出去的 SVG 都来自过滤后的同一份字符串。

**2. 生成状态机**（`src/main.ts`）

`idle → generating → cancelling / success / error` 五态。要点：`AbortController` 取消、60s 总超时、网络错误/5xx 单次重试、取消期间任何 `resolve` 一律丢弃（不渲染、不报成功）、重试等待可被 abort 打断、`finally` 统一清理计时器与 DOM 状态、焦点不丢失。以 `aria-busy` / `aria-live` / `aria-pressed` 同步给读屏。

**3. 本地画廊的鲁棒性**（`src/gallery.ts`）

读取时清洗脏数据（非数组、缺 id/svg、字段类型异常一律丢弃）；满 50 张时**前置拒绝，不静默删除旧作品**；`QuotaExceededError` 与「浏览器禁止存储」分开分类；写入失败不保留内存中的半截数据，以重新读回为准；删除失败返回删除前数组让调用方感知。

**4. 无障碍与状态完整性**

`prefers-reduced-motion`、`:focus-visible` 焦点环、44px 触屏点击目标、760px 响应式、空/加载/错误/边界四态、剪贴板两级降级失败后留下已选中文本域供手动复制、Toast 最多堆叠 2 条。

---

## 快速开始

```bash
git clone https://github.com/1576584678/aigc-doodle-studio.git
cd aigc-doodle-studio
npm install
npm run dev          # http://localhost:5173
```

构建与本地预览：

```bash
npm run build        # tsc --noEmit && vite build，产物在 dist/
npm run preview
```

部署到 GitHub Pages 项目页时需要指定 base（本仓库的 Actions 工作流已自动设置该环境变量）：

```bash
VITE_BASE=/aigc-doodle-studio/ npm run build
```

**使用步骤**：展开「模型设置」→ 填 Base URL / API Key / Model → 选模式（简笔画 / 火柴人）→ 写一句描述 → 生成 → 下载 SVG / 复制代码 / 存入画廊。也可用 `Ctrl / ⌘ + Enter` 提交，或点预设示例快速填入。

> ⚠️ API Key 以**明文**存在浏览器 `localStorage`，页面已就该风险给出提示。公用电脑请勿保存，用后可在浏览器清除站点数据。请勿把真实 Key 写进 issue、截图或提交记录。

---

## 目录结构

```
├── index.html              # 页面结构与全部静态文案
├── src/
│   ├── main.ts             # 状态机、交互、渲染、下载/复制/画廊
│   ├── api.ts              # OpenAI 兼容端点调用、SVG 抽取、错误契约
│   ├── sanitize.ts         # SVG 白名单安全过滤（核心）
│   ├── gallery.ts          # localStorage 画廊读写与清洗
│   ├── prompts.ts          # 两种模式各自的 system prompt
│   └── style.css           # 设计令牌、响应式、无障碍样式
├── docs/
│   ├── PRD-v0.3.md         # v0.3 完整产品需求文档
│   └── preview/            # README 用的原创示例 SVG
├── .github/workflows/      # Pages 自动部署
└── vite.config.ts
```

---

## 路线图

当前为 **v0.2**。v0.3 的目标是把「能生成」补成「陌生人打开就能用、用完能带走」，完整范围、验收标准与风险登记见 [`docs/PRD-v0.3.md`](docs/PRD-v0.3.md)。

| 优先级 | 内容 | 状态 |
|---|---|---|
| P0 | 免配置示例作品（无 Key 也能看、能导出） | 规划中 |
| P0 | PNG 导出（透明底 / 白底，1x/2x/4x） | 规划中 |
| P0 | 端点预设与连接自检（CORS / 401 / 404 / 429 分类提示） | 规划中 |
| P1 | 画布历史（最近 5 张，防新图覆盖旧图） | 规划中 |
| P1 | 删除撤销、清除本机数据、作品分享卡片 | 规划中 |
| P1 | 分段超时修复、`sanitize.ts` 单元测试 | 规划中 |
| P2 | 风格选择器、涂色卡 A4 打印、平台侧匿名统计 | 规划中 |

**当前已知限制**：在线 Demo 需要自备 Key 才能生成；无 Key 访客暂时只能看到示例 prompt，看不到成品。这正是 v0.3 P0 要解决的首要问题。

---

## 参与贡献

欢迎提 Issue 与 PR，见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。发现安全漏洞请走 [`SECURITY.md`](SECURITY.md) 的私下披露路径，不要公开提 Issue。

如果这个项目对你有参考价值，欢迎点一个 ⭐ Star —— 这是对我继续维护它的反馈。本项目不会以任何奖励换取 Star，也不会在产品内做求 Star 的弹窗或功能门槛。

## 许可

[MIT](LICENSE) © 2026 Li Yuelin

## 声明

本项目为独立开发的开源作品。文中提到的模型服务均为用户自行选择的第三方服务，与本项目无关联，本项目不对其可用性、费用或合规性作任何承诺。README 中的示例数据均为原创或虚构。
