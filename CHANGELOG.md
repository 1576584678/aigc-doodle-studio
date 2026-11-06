# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 的格式与语义化版本约定。
所有版本日期以仓库提交时间为准。

## [0.3.0] - 2026-11-06

> 完整范围、验收标准与风险登记见 [`docs/PRD-v0.3.md`](docs/PRD-v0.3.md)；界面与交互依据见 [`docs/design/visual-spec.md`](docs/design/visual-spec.md) 与 [`docs/design/ux-spec.md`](docs/design/ux-spec.md)。

### 新增

- 6 张内置原创示例作品，无 API Key 也能查看、下载、导出 PNG、生成分享图、打印；带「示例」角标与用户作品明确区分
- 首屏价值说明与费用/隐私静态文案，模型设置默认收起；新增「本次不保存 Key」勾选
- 端点预设与连接自检：6 秒超时、单次不重试、六类错误分类（CORS/网络、401/403、404、429、超时、其他），每条含可行动作
- PNG 导出：透明底 / 白底 × 1x / 2x / 4x，按 viewBox 等比输出、失败降级为下载 SVG、全程零网络
- 1080×1440 分享卡片（纯前端 Canvas 合成，localhost 不显示地址、无水印/二维码/诱导文案）
- A4 单图打印（浏览器原生 `window.print()`，零 PDF 依赖）
- 画布历史最近 5 张（仅内存）、画廊删除 5 秒撤销（恢复原 id / ts / 原索引）
- 3 档画风选择器，风格随作品记入历史与画廊，旧数据缺 `style` 按「极简线稿」兼容
- 清除本机数据：二次确认、列出三类不可恢复数据、终止未结束的撤销窗口、清空内存态并回到初始态
- 平台侧匿名事件名钩子（默认 no-op，仅事件名，不含任何参数值）
- 移动端按已有 Key 分流 + 物理 DOM 重排（禁用 CSS `order`），保证 DOM 序 = 视觉序 = Tab 序
- 设计文档：`docs/design/visual-spec.md`（视觉规范）与 `docs/design/ux-spec.md`（体验规范与 28 条落地约束）

### 修复

- 60s 总超时与自动重试共用计时器 → 改为单次 45s / 重试独立计时 / 总上限 90s
- 删除不可撤销 → 5 秒窗口，且窗口由 `setTimeout` 驱动（避免 reduced-motion 下 `animationend` 让撤销权失效）
- 新图覆盖旧图 → 画布历史保留最近 5 张
- 自检与生成共用状态 → 自检改为独立子状态机，不读写主状态机、不写状态区
- `src/api.ts` 历史遗留的默认模型名硬编码 → 改为读取用户填写值，缺 Model 走无配置引导
- `src/sanitize.ts` 补充外部 `url(http…)` 引用拦截，同时保留本地 `url(#id)`
- 移动端 CSS `order` 造成的焦点/读屏顺序倒挂 → 物理 DOM 重排 + 跨断点焦点恢复

### 测试

- `tests/sanitize-vectors.mjs`：38 条攻击向量与合法样本（30 拒绝 / 8 合法）
- `tests/sanitize.test.html`：浏览器内真实 `sanitizeSvg` 断言，38/38 通过
- `tests/interaction.test.html`：真实应用交互断言 44 条（示例墙、历史、无配置引导、PNG 字节与像素、分享卡、删除撤销、清除事务、打印、自检错误分类）
- 浏览器断言合计 82 条通过 / 0 失败；1 项 Canvas 像素文本断言如实跳过，不伪造通过
- `scripts/verify.mjs`：纯 Node 静态门禁（向量条数、覆盖关键词、违禁词、运行时依赖、示例体积），已串入 `npm run build` 前置
- `scripts/browser-test.mjs`：零依赖启动 Vite + 系统无头浏览器，无可用浏览器时明确跳过且不阻塞构建

### 已知限制

- 不填 Key 只能浏览与导出内置示例；浏览器直连要求端点 HTTPS 且允许 CORS
- 分享回流、留存率、用户级去重在无后端无账号下不可测；平台统计不可用时只保留访问量
- 画廊与历史仅存本机；A4 打印本期只支持单图

## [0.2.0] - 2026-11-06

首个公开提交（`13cc02d`）。

### 新增

- SVG 白名单过滤，阻断不可信模型输出经 `innerHTML` 注入的 XSS
- API Key 必填校验与明文存储风险提示
- 生成请求 60s 超时、用户取消、失败单次重试与分类错误文案
- 画廊 50 张上限与存储写入降级，不再静默删除作品
- 示例 Prompt、`Ctrl / ⌘ + Enter` 快捷提交、Toast 反馈
- 无障碍：`aria` 标注、`:focus-visible`、`prefers-reduced-motion`、响应式与对比度修正

### 已知限制

- 仅导出 SVG，无位图格式
- 新图覆盖画布旧图，未存入画廊即丢失
- 画廊删除不可撤销
- 在线 Demo 需自备 Key；浏览器直连要求端点为 HTTPS 且允许 CORS
