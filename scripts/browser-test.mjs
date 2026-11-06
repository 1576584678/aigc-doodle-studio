#!/usr/bin/env node
/**
 * 浏览器侧真实断言（零第三方依赖，仅 Node 内置模块）。
 *
 * 用法：node scripts/browser-test.mjs   （或 npm run test:browser）
 *
 * 为什么需要这一层：
 *   src/sanitize.ts 依赖 DOMParser / XMLSerializer，交互层依赖完整 DOM 与
 *   Canvas / Blob / dialog，Node 都没有；scripts/verify.mjs 只能做静态门禁。
 *
 * 依次在真实无头浏览器里跑两个页面：
 *   1. /tests/sanitize.test.html    —— 38 条 SVG 白名单回归（FR-12）
 *   2. /tests/interaction.test.html —— 同源 iframe 加载真实应用，Must 项交互断言
 * 任一页 ok !== true || failed > 0 || done === false 即 exit 1。
 *
 * 流程：
 *   1. child_process.spawn 启动 Vite（直接跑 node_modules/vite/bin/vite.js，
 *      避开 Windows 下 .cmd / npx 的兼容问题），端口默认 5199，--strictPort
 *   2. 用 Node 原生 fetch 轮询等待服务可访问
 *   3. 探测系统已安装的 Edge / Chromium（环境变量覆盖 → 常见安装路径 → PATH）
 *   4. 以 --headless --virtual-time-budget --dump-dom 加载每个测试页
 *   5. 从 DOM 的 <pre id="machine"> 提取结构化 JSON 并断言
 *   6. finally 关闭 dev server（含子进程）并删除临时浏览器 profile，不留残留
 *
 * 约定：
 *   - 找不到浏览器时输出中文「跳过」原因并 exit(0)：浏览器断言是可选的第二层，
 *     不能让无图形浏览器的 CI 环境构建失败。
 *   - 浏览器存在但服务起不来 / 任一页断言失败 / 页面未跑完 → exit(1)。
 *   - 输出：两页各自摘要 + 总 JSON
 *     { "ok": ..., "total": ..., "passed": ..., "failed": ..., "skipped": ...,
 *       "skippedItems": n, "pages": { ... } }
 *
 * 可选环境变量：
 *   BROWSER_TEST_PORT         端口，默认 5199
 *   BROWSER_TEST_BROWSER      直接指定浏览器可执行文件
 *   BROWSER_PATH / EDGE_PATH / CHROME_PATH  同上（按序取第一个存在的）
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.BROWSER_TEST_PORT || 5199)
const ORIGIN = `http://127.0.0.1:${PORT}`
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

/** 每个页面可单独设置虚拟时间预算；交互页有 iframe 导航 / Blob 解码，需要更长。 */
const PAGES = [
  {
    key: 'sanitize',
    label: 'FR-12 SVG 白名单回归',
    path: '/tests/sanitize.test.html',
    budget: 12000,
    minTotal: 20
  },
  {
    key: 'interaction',
    label: 'FR / Must 项交互断言',
    path: '/tests/interaction.test.html',
    budget: 60000,
    minTotal: 1
  }
]

const START_TIMEOUT_MS = 25000
const VIRTUAL_TIME_BUDGET_MAX = 120000

const notes = []
const errors = []
const pageResults = {}
const profileDirs = []
let skipped = false
let skipReason = ''
let total = 0
let passed = 0
let failed = 0
let skippedItems = 0
let vite = null
let viteLog = ''
let viteExited = false
let viteExitCode = null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------ 浏览器探测
function findBrowser() {
  const overrides = [
    process.env.BROWSER_TEST_BROWSER,
    process.env.BROWSER_PATH,
    process.env.EDGE_PATH,
    process.env.CHROME_PATH
  ].filter(Boolean)
  for (const p of overrides) {
    if (existsSync(p)) return p
  }

  const pf86 = process.env['ProgramFiles(x86)'] || ''
  const pf = process.env.ProgramFiles || ''
  const local = process.env.LOCALAPPDATA || ''
  const candidates = [
    ...(pf86 ? [
      join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ] : []),
    ...(pf ? [
      join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ] : []),
    ...(local ? [
      join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ] : []),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome', '/snap/bin/chromium'
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }

  // 最后扫 PATH（纯 fs 判断，不调用 which/where 外部命令）
  const names = process.platform === 'win32'
    ? ['msedge.exe', 'chrome.exe', 'chromium.exe', 'msedge', 'chrome', 'chromium']
    : ['msedge', 'microsoft-edge', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const p = join(dir.replace(/^"|"$/g, ''), name)
      if (existsSync(p)) return p
    }
  }
  return null
}

// ------------------------------------------------------------ DOM 结果提取
function decodeEntities(text) {
  const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (entity[0] === '#') {
      const cp = entity[1].toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole
    }
    return Object.prototype.hasOwnProperty.call(named, entity.toLowerCase())
      ? named[entity.toLowerCase()]
      : whole
  })
}

function extractResult(dom) {
  const m = dom.match(/<pre id="machine"[^>]*>([\s\S]*?)<\/pre>/i)
  if (!m) return null
  try {
    return JSON.parse(decodeEntities(m[1]).trim())
  } catch {
    return null
  }
}

// ------------------------------------------------------------ 进程清理
async function killVite() {
  if (!vite || vite.pid == null) return
  const pid = vite.pid
  try { vite.kill('SIGTERM') } catch { /* 已退出 */ }
  if (process.platform === 'win32') {
    // /T 连带结束子进程树（Vite 会拉起 esbuild service）
    try {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true, timeout: 8000
      })
    } catch { /* 忽略 */ }
  } else {
    try { process.kill(-pid, 'SIGTERM') } catch { /* 已退出 */ }
    await sleep(200)
    try { process.kill(-pid, 'SIGKILL') } catch { /* 已退出 */ }
  }
  vite = null
}

async function cleanup() {
  await killVite()
  for (const dir of profileDirs) {
    // Edge/Chrome 可能短暂占用 profile，做几次重试，确保不留临时文件
    for (let i = 0; i < 4; i += 1) {
      try {
        rmSync(dir, { recursive: true, force: true })
        break
      } catch {
        await sleep(200)
      }
    }
  }
  profileDirs.length = 0
}

// ------------------------------------------------------------ 页面执行
async function waitForServer() {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (viteExited) return false
    try {
      const res = await fetch(ORIGIN + '/', { signal: AbortSignal.timeout(1500) })
      await res.arrayBuffer() // 释放连接
      return true
    } catch {
      await sleep(250)
    }
  }
  return false
}

function runBrowser(browser, headlessFlag, pageUrl, budget) {
  const profile = mkdtempSync(join(tmpdir(), 'fr12-browser-'))
  profileDirs.push(profile)
  const args = [
    headlessFlag,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--virtual-time-budget=${budget}`,
    '--dump-dom',
    pageUrl
  ]
  return spawnSync(browser, args, {
    encoding: 'utf8',
    timeout: Math.min(VIRTUAL_TIME_BUDGET_MAX, budget + 60000),
    maxBuffer: 24 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

/** 跑一个测试页：返回 { total, passed, failed, skipped, ok, errors, skippedList, domLen } */
function runPage(browser, page) {
  const pageUrl = ORIGIN + page.path
  const budgets = [page.budget, Math.min(VIRTUAL_TIME_BUDGET_MAX, page.budget * 2)]
  let dom = ''
  let lastError = null
  let usedFlag = ''

  outer:
  for (const budget of budgets) {
    for (const flag of ['--headless=new', '--headless']) {
      const run = runBrowser(browser, flag, pageUrl, budget)
      const out = run.stdout || ''
      if (!dom) dom = out
      if (/<pre id="machine"/i.test(out)) {
        dom = out
        lastError = null
        usedFlag = flag + ' / budget=' + budget
        break outer
      }
      lastError = run.error || new Error('DOM 输出中缺少 <pre id="machine">（页面可能未加载完成）')
    }
  }

  const empty = {
    total: 0, passed: 0, failed: 0, skipped: 0, ok: false,
    errors: [], skippedList: [], domLen: dom.length
  }
  if (lastError) {
    empty.errors.push(
      '[' + page.key + '] 浏览器未能产出可用的测试页 DOM：' + (lastError.message || String(lastError)) +
      (dom ? '（DOM 片段：' + dom.slice(0, 300).replace(/\s+/g, ' ') + '）' : '')
    )
    return empty
  }

  const result = extractResult(dom)
  if (!result || typeof result !== 'object') {
    empty.errors.push('[' + page.key + '] 无法从 <pre id="machine"> 提取有效 JSON')
    return empty
  }

  const t = Number(result.total) || 0
  const p = Number(result.passed) || 0
  const f = Number(result.failed) || 0
  const s = Array.isArray(result.skipped) ? result.skipped.length : (Number(result.skipped) || 0)
  const errorsHere = []

  if (result.done === false) errorsHere.push('[' + page.key + '] 测试页 done=false（异步断言未跑完，不能判为通过）')
  if (result.ok !== true) errorsHere.push('[' + page.key + '] 测试页返回 ok=' + String(result.ok) + '（要求 true）')
  if (f !== 0) {
    const detail = Array.isArray(result.failures)
      ? result.failures.map((x) => String(x && x.name) + '[' + (Array.isArray(x && x.reasons) ? x.reasons.join('/') :
        Array.isArray(x && x.reason) ? x.reason.join('/') : String(x && x.reason || '')) + ']').join('；')
      : ''
    errorsHere.push('[' + page.key + '] 断言存在 ' + f + ' 条失败' + (detail ? '：' + detail : ''))
  }
  if (t < page.minTotal) errorsHere.push('[' + page.key + '] 实际执行断言 ' + t + ' 条，少于要求的 ' + page.minTotal + ' 条')
  if (p !== t) errorsHere.push('[' + page.key + '] 通过数 ' + p + ' 与总数 ' + t + ' 不一致')

  const skippedList = Array.isArray(result.skipped)
    ? result.skipped.map((x) => typeof x === 'string' ? { name: x, reason: '' } : { name: String(x && x.name), reason: String(x && x.reason || '') })
    : []
  notes.push('[' + page.key + '] ' + usedFlag)

  return {
    total: t, passed: p, failed: f, skipped: s,
    ok: errorsHere.length === 0,
    errors: errorsHere,
    skippedList,
    domLen: dom.length
  }
}

// ------------------------------------------------------------ 主流程
async function main() {
  if (!existsSync(VITE_BIN)) {
    errors.push('未找到 Vite 可执行文件：' + VITE_BIN + '（请先 npm install，本项目不新增任何依赖）')
    return
  }
  for (const page of PAGES) {
    if (!existsSync(join(ROOT, page.path.replace(/^\//, '')))) {
      errors.push('缺少 ' + page.path + '，无法执行浏览器断言')
    }
  }
  if (errors.length) return

  const browser = findBrowser()
  if (!browser) {
    skipped = true
    skipReason = '未探测到可用的 Edge / Chromium 浏览器（已依次检查 BROWSER_TEST_BROWSER / BROWSER_PATH / EDGE_PATH / CHROME_PATH、Windows/macOS/Linux 常见安装路径与 PATH）。浏览器断言是可选的第二层门禁，跳过不影响构建；如需启用，请设置 BROWSER_TEST_BROWSER 指向浏览器可执行文件。'
    return
  }
  notes.push('浏览器：' + basename(browser) + ' → ' + browser)

  // 端口预检：--strictPort 下若已被占用，Vite 会立刻退出，先给出清晰提示
  let portBusy = false
  try {
    const res = await fetch(ORIGIN + '/', { signal: AbortSignal.timeout(800) })
    await res.arrayBuffer()
    portBusy = true
  } catch { /* 未监听，正常 */ }
  if (portBusy) {
    errors.push(`端口 ${PORT} 已被占用，请先关闭占用进程，或用 BROWSER_TEST_PORT 指定其他端口`)
    return
  }

  // 1) 启动 Vite dev server
  vite = spawn(process.execPath, [VITE_BIN, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', // POSIX 下独立进程组，便于整组关闭
    windowsHide: true
  })
  const collect = (chunk) => { viteLog = (viteLog + String(chunk)).slice(-4000) }
  vite.stdout?.on('data', collect)
  vite.stderr?.on('data', collect)
  vite.on('exit', (code) => { viteExited = true; viteExitCode = code })
  vite.on('error', (e) => { collect('\n[spawn error] ' + (e && e.message ? e.message : String(e))) })
  notes.push(`Vite dev server 启动中：${ORIGIN}`)

  // 2) 等待服务可访问
  if (!(await waitForServer())) {
    errors.push(
      `Vite dev server 未能在 ${START_TIMEOUT_MS / 1000}s 内就绪` +
      (viteExited ? `（进程已退出，code=${viteExitCode}）` : '') +
      (viteLog ? '\n--- Vite 输出 ---\n' + viteLog.trim() : '')
    )
    return
  }
  notes.push('Vite dev server 已就绪')

  // 3) 依次跑两个测试页
  for (const page of PAGES) {
    const r = runPage(browser, page)
    pageResults[page.key] = {
      label: page.label,
      path: page.path,
      total: r.total,
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      ok: r.ok,
      skippedList: r.skippedList
    }
    total += r.total
    passed += r.passed
    failed += r.failed
    skippedItems += r.skipped
    errors.push(...r.errors)
  }
}

// ------------------------------------------------------------ 执行与输出
let ok = false
try {
  await main()
} catch (e) {
  errors.push('未捕获异常：' + (e && e.message ? e.message : String(e)))
} finally {
  await cleanup()
}

ok = errors.length === 0
if (skipped) ok = true

console.log('===== 浏览器侧真实断言（scripts/browser-test.mjs）=====')
for (const n of notes) console.log('  [信息] ' + n)
if (skipped) {
  console.log('  [跳过] ' + skipReason)
} else {
  PAGES.forEach((page, i) => {
    const r = pageResults[page.key]
    if (!r) return
    console.log(
      `  [页 ${i + 1}/${PAGES.length}] ${page.path}（${page.label}）：` +
      `共 ${r.total} 条 · 通过 ${r.passed} · 失败 ${r.failed} · 跳过 ${r.skipped} → ${r.ok ? '通过' : '不通过'}`
    )
    r.skippedList.forEach((s) => console.log('     跳过：' + s.name + ' —— ' + s.reason))
  })
}
for (const e of errors) console.log('  [致命] ' + e)
console.log(
  '----- 摘要：' + (skipped ? '已跳过（可选层）' : `两页合计 ${total} 条 · 通过 ${passed} · 失败 ${failed} · 跳过 ${skippedItems}`) +
  ' · 结论 ' + (ok ? '通过' : '不通过') + ' -----'
)
console.log(JSON.stringify({
  ok, total, passed, failed, skipped, skippedItems, pages: pageResults
}))

if (!ok) process.exit(1)
