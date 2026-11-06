# 贡献指南

谢谢你愿意花时间看这个项目。它是一个纯前端、零运行时依赖的小工具，保持简单是刻意的设计目标。

## 提 Issue 之前

- 先确认你用的是最新 `main` 分支、`npm run build` 能通过。
- **不要**在 Issue 正文、截图、日志里粘贴真实 API Key、Base URL 或模型返回原文。
- 生成失败类问题请说明：浏览器与版本、错误文案、端点是否为 HTTPS 且允许 CORS、能否在别处调通该端点、是否已排除 401/404/429。不需要提供端点地址本身。
- 安全问题**不要公开提 Issue**，见 [`SECURITY.md`](SECURITY.md)。

## 提交 PR

1. Fork 后从 `main` 建分支，分支名建议 `fix/xxx` 或 `feat/xxx`。
2. 保持零运行时依赖：新增能力优先用浏览器原生 API 实现；确需引入依赖请在 Issue 里先说明理由。
3. 提交前执行 `npm run build`（已串入 `scripts/verify.mjs` 静态门禁 + `tsc --noEmit`）。
4. 执行 `npm test`（向量条数 / 违禁词 / 运行时依赖 / 示例体积）与 `npm run test:browser`（真实浏览器跑 SVG 过滤与交互断言；本机无可用浏览器时会明确跳过）。
5. 涉及 `src/sanitize.ts` 的改动，必须同时在 `tests/sanitize-vectors.mjs` 补充攻击向量样本；安全过滤的放宽需要明确论证。
6. PR 描述里写清：解决了什么、怎么验证、是否影响现有 localStorage 数据格式。
7. 不要提交 `dist/`、`node_modules/`、`.workbuddy/` 或任何含凭据的文件。

## 设计原则

| 原则 | 含义 |
|---|---|
| 零后端 | 不引入服务器、数据库、账号体系；用户自带模型与 Key |
| 零采集 | 不引入第三方统计 SDK，不上报 prompt / Key / SVG |
| 过滤前置 | 任何不可信 SVG 进入 DOM、存储、剪贴板、下载文件前必须经过 `sanitizeSvg` |
| 状态完整 | 空 / 加载 / 错误 / 边界四态都要有可见反馈 |
| 不打扰 | 不做求 Star 弹窗、不做强制授权、不做诱导分享 |

## 关于 Star

欢迎自发点 Star，它是继续维护的反馈。本项目不会以奖励、功能解锁或任何形式换取 Star，也不接受批量刷 Star 的行为。

## 许可

贡献即表示你同意以 [MIT](LICENSE) 许可发布你的贡献内容。
