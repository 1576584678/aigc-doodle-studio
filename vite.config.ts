import { defineConfig } from 'vite'

/** 解析静态资源 base。只接受以 / 开头的 POSIX 子路径。 */
function resolveBase(): string {
  const raw = process.env.VITE_BASE
  if (!raw) return '/'
  // Git Bash / MSYS 会把以 / 开头的命令行参数改写成 Windows 盘符路径，
  // 这类值一律视为无效并回退到根路径，避免构建出错误的资源 URL。
  if (!raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || raw.includes('\\')) return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

export default defineConfig({
  // 静态托管在子路径时用 VITE_BASE 指定，例如 GitHub Pages 项目页：
  // VITE_BASE=/aigc-doodle-studio/ npm run build
  // 本地开发与自定义域名根路径部署时默认为 '/'
  base: resolveBase(),
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist'
  }
})
