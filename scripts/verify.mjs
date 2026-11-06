#!/usr/bin/env node
/**
 * FR-12 构建前置校验（零第三方依赖，仅使用 Node 原生 ESM 能力）。
 *
 * 用法：node scripts/verify.mjs   （或 npm run verify / npm test）
 *
 * 检查项：
 *   1. tests/sanitize-vectors.mjs 可导入、条数 >= 20、每条结构合法
 *   2. 向量覆盖关键词（script / foreignObject / onload / javascript / DOCTYPE /
 *      CDATA / data: / vbscript / expression( 等）
 *   3. index.html、src/**\/*.ts、src/style.css、docs/preview/*.svg 无夸大话术、
 *      明文 API Key、外部 script[src]、远程字体 @import / @font-face、第三方域
 *   4. package.json 无运行时 dependencies，且保留 dev/build/preview
 *   5. 内置示例 SVG（src/samples.ts）合计 <= 60KB；文件暂不存在只给 warning
 *   6. tests/sanitize.test.html 存在且含必要挂载点与本地 import
 *
 * 输出：中文摘要 + 一行 JSON { "ok": ..., "vectors": n, "errors": [...] }
 * 有致命问题时 process.exit(1)。并行开发中「文件暂不存在」一律记为 warning，不崩溃。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const errors = []
const warnings = []
const notes = []

const fail = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)
const note = (msg) => notes.push(msg)

function readText(absPath) {
  return readFileSync(absPath, 'utf8')
}

/** 递归收集符合条件的文件；目录不存在时安静返回空数组。 */
function walkFiles(dir, predicate, acc = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(p, predicate, acc)
    else if (entry.isFile() && predicate(p)) acc.push(p)
  }
  return acc
}

// ---------------------------------------------------------------- 1) 向量模块
let vectors = null
let vectorCount = 0

const vectorsPath = join(ROOT, 'tests', 'sanitize-vectors.mjs')
if (!existsSync(vectorsPath)) {
  fail('缺少 tests/sanitize-vectors.mjs（FR-12 回归向量数据模块）')
} else {
  try {
    const mod = await import(pathToFileURL(vectorsPath).href)
    vectors = mod.vectors
  } catch (e) {
    fail('导入 tests/sanitize-vectors.mjs 失败：' + (e && e.message ? e.message : String(e)))
  }
}

if (Array.isArray(vectors)) {
  vectorCount = vectors.length
  note('回归向量条数：' + vectorCount + ' 条（FR-12 要求不少于 20 条）')
  if (vectorCount < 20) {
    fail('回归向量仅 ' + vectorCount + ' 条，少于 FR-12 要求的 20 条')
  }

  const seenNames = new Set()
  vectors.forEach((v, i) => {
    const tag = '向量 #' + (i + 1)
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      fail(tag + ' 不是对象')
      return
    }
    if (typeof v.name !== 'string' || !v.name.trim()) {
      fail(tag + ' 缺少有效的 name')
    } else if (seenNames.has(v.name)) {
      warn(tag + ' 名称重复：' + v.name)
    } else {
      seenNames.add(v.name)
    }
    if (typeof v.svg !== 'string') fail(tag + ' 缺少字符串类型的 svg')
    if (v.expect !== 'accept' && v.expect !== 'reject') {
      fail(tag + ' 的 expect 非法（只允许 accept / reject）：' + String(v.expect))
    }
    const mc = v.mustContain
    const mn = v.mustNotContain
    if (mc !== undefined && (!Array.isArray(mc) || mc.some((x) => typeof x !== 'string'))) {
      fail(tag + ' 的 mustContain 必须是字符串数组')
    }
    if (mn !== undefined && (!Array.isArray(mn) || mn.some((x) => typeof x !== 'string'))) {
      fail(tag + ' 的 mustNotContain 必须是字符串数组')
    }
    if (v.expect === 'accept' && (!Array.isArray(mc) || mc.length === 0)) {
      fail(tag + ' 是 accept 样本，必须提供非空 mustContain')
    }
    if (v.expect === 'reject' && (!Array.isArray(mn) || mn.length === 0)) {
      fail(tag + ' 是 reject 样本，必须提供非空 mustNotContain（否则断言为空）')
    }
  })
} else if (vectors !== null) {
  fail('tests/sanitize-vectors.mjs 导出的 vectors 不是数组')
}

// ---------------------------------------------------------- 2) 覆盖关键词检查
const REQUIRED_KEYWORDS = [
  // FR-12 验收标准点名的攻击面
  'script', 'foreignobject', 'onload', 'javascript', 'doctype', 'cdata',
  'data:', 'vbscript', 'expression(',
  // 其余必须覆盖的元素 / 属性 / 协议
  'entity', 'onclick', 'xlink:href', 'href', 'url(', '<style', '<a ',
  '<animate', '<set', '<use', '<iframe', '<image', '<filter', '<mask',
  '<pattern', '<defs', '<object', '<embed', '<link', '<meta', '<svg',
  // 合法样本需保留的结构
  'viewbox', 'xmlns', 'transform', '<text', '<tspan', '<title', '<path'
]

if (Array.isArray(vectors) && vectorCount > 0) {
  const haystack = vectors
    .map((v) => String(v.name == null ? '' : v.name) + '\n' + String(v.svg == null ? '' : v.svg))
    .join('\n')
    .toLowerCase()
  const missing = REQUIRED_KEYWORDS.filter((k) => !haystack.includes(k))
  if (missing.length) {
    fail('向量覆盖关键词缺失 ' + missing.length + ' 项：' + missing.join('、'))
  } else {
    note('向量覆盖关键词：' + REQUIRED_KEYWORDS.length + ' 项全部命中')
  }
  const accepts = vectors.filter((v) => v && v.expect === 'accept').length
  const rejects = vectors.filter((v) => v && v.expect === 'reject').length
  note('向量构成：accept ' + accepts + ' 条 / reject ' + rejects + ' 条')
  if (accepts < 4) fail('合法样本（accept）仅 ' + accepts + ' 条，PRD 要求至少 4 条')
}

// ------------------------------------------------------------ 3) 源码合规扫描
const scanTargets = []
function addTarget(absPath, label) {
  const pretty = String(label).replace(/\\/g, '/')
  if (existsSync(absPath)) scanTargets.push({ abs: absPath, label: pretty })
  else warn('文件暂不存在，跳过扫描（并行开发中属正常）：' + pretty)
}

addTarget(join(ROOT, 'index.html'), 'index.html')

const srcDir = join(ROOT, 'src')
const tsFiles = walkFiles(srcDir, (p) => /\.tsx?$/i.test(p), [])
if (!tsFiles.length) warn('src/ 下暂未发现 .ts 文件，跳过源码扫描')
tsFiles.forEach((p) => addTarget(p, relative(ROOT, p)))

addTarget(join(ROOT, 'src', 'style.css'), 'src/style.css')

const previewDir = join(ROOT, 'docs', 'preview')
const svgPreviews = walkFiles(previewDir, (p) => /\.svg$/i.test(p), [])
if (!svgPreviews.length) warn('docs/preview/ 下暂无 .svg，跳过预览 SVG 扫描')
svgPreviews.forEach((p) => addTarget(p, relative(ROOT, p)))

// 测试页也纳入「不得引入外部资源」的扫描（额外加固，不改变原有扫描清单）
addTarget(join(ROOT, 'tests', 'sanitize.test.html'), 'tests/sanitize.test.html')

const THIRD_PARTY_HOSTS = [
  'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net',
  'cdn.jsdelivr.com', 'cdnjs.cloudflare.com', 'unpkg.com',
  'code.jquery.com', 'ajax.googleapis.com', 'google-analytics.com',
  'googletagmanager.com', 'static.cloudflareinsights.com',
  'cdn.bootcdn.net', 'polyfill.io', 'connect.facebook.net'
]

const FORBIDDEN_PATTERNS = [
  {
    label: '夸大免费话术 / 模型代号 / 第三方品牌',
    re: /完全免费|零成本|无限免费生成|glm-5\.2|aibox|richaibox/i
  },
  {
    // 加 (?:^|[^A-Za-z0-9]) 避免把 CSS 里的 mask-image 等误判为 sk- 开头的密钥
    label: '疑似明文 API Key（sk-...）',
    re: /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9]{12,}/m
  },
  {
    label: '远程字体 @import',
    re: /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\//i
  },
  {
    label: '@font-face 外链字体',
    re: /@font-face[\s\S]{0,400}?url\(\s*["']?(?:https?:)?\/\//i
  }
]

const SCRIPT_SRC_RE = /<script\b[^>]*?\s+src\s*=\s*["']([^"']+)["'][^>]*>/gi
const LINK_HREF_RE = /<link\b[^>]*?\s+href\s*=\s*["']([^"']+)["'][^>]*>/gi

function isExternalUrl(url) {
  return /^(?:https?:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
}

for (const target of scanTargets) {
  let text
  try {
    text = readText(target.abs)
  } catch (e) {
    warn(target.label + ' 读取失败，跳过：' + (e && e.message ? e.message : String(e)))
    continue
  }

  for (const p of FORBIDDEN_PATTERNS) {
    const hit = text.match(p.re)
    if (hit) {
      fail(target.label + '：命中禁用模式「' + p.label + '」，片段 → ' + String(hit[0]).slice(0, 80))
    }
  }

  const lower = text.toLowerCase()
  for (const host of THIRD_PARTY_HOSTS) {
    if (lower.includes(host)) fail(target.label + '：出现第三方外部域 ' + host)
  }

  // 预览 SVG 属于随站点分发的静态资产，额外禁止可执行/注入型内容
  if (/\.svg$/i.test(target.label)) {
    const SVG_FORBIDDEN = [
      { label: 'script 元素', re: /<script/i },
      { label: 'foreignObject', re: /<foreignObject/i },
      { label: 'on* 事件属性', re: /\son[a-z]+\s*=/i },
      { label: 'javascript: 协议', re: /javascript:/i },
      { label: 'DOCTYPE / ENTITY', re: /<!DOCTYPE|<!ENTITY/i },
      { label: 'CDATA 段', re: /<!\[CDATA\[/i }
    ]
    for (const s of SVG_FORBIDDEN) {
      if (s.re.test(text)) fail(target.label + '：预览 SVG 含禁止内容「' + s.label + '」')
    }
  }

  let m
  SCRIPT_SRC_RE.lastIndex = 0
  while ((m = SCRIPT_SRC_RE.exec(text)) !== null) {
    const url = m[1].trim()
    if (isExternalUrl(url) || THIRD_PARTY_HOSTS.some((h) => url.toLowerCase().includes(h))) {
      fail(target.label + '：外部 script[src] 指向非本站 → ' + url)
    }
  }
  LINK_HREF_RE.lastIndex = 0
  while ((m = LINK_HREF_RE.exec(text)) !== null) {
    const url = m[1].trim()
    if (isExternalUrl(url) || THIRD_PARTY_HOSTS.some((h) => url.toLowerCase().includes(h))) {
      fail(target.label + '：外部 link[href] 资源指向非本站 → ' + url)
    }
  }
}
note('源码合规扫描：共检查 ' + scanTargets.length + ' 个文件')

// ------------------------------------------------------------- 4) package.json
const pkgPath = join(ROOT, 'package.json')
if (!existsSync(pkgPath)) {
  fail('缺少 package.json')
} else {
  try {
    const pkg = JSON.parse(readText(pkgPath))
    const deps = pkg.dependencies
    if (deps && typeof deps === 'object' && Object.keys(deps).length > 0) {
      fail('package.json 存在 ' + Object.keys(deps).length + ' 个运行时 dependencies：' + Object.keys(deps).join('、'))
    } else {
      note('package.json：运行时依赖为 0（无 dependencies）')
    }
    for (const key of ['dev', 'build', 'preview']) {
      if (!pkg.scripts || typeof pkg.scripts[key] !== 'string') {
        fail('package.json 缺少必需的 scripts.' + key)
      }
    }
    for (const key of ['test', 'verify', 'test:browser']) {
      if (!pkg.scripts || typeof pkg.scripts[key] !== 'string') {
        warn('package.json 缺少 scripts.' + key + '（构建前置/浏览器断言入口）')
      }
    }
  } catch (e) {
    fail('package.json 解析失败：' + (e && e.message ? e.message : String(e)))
  }
}

// ------------------------------------------------- 5) 内置示例 SVG 体积 <= 60KB
const SAMPLE_LIMIT = 60 * 1024
const samplesPath = join(ROOT, 'src', 'samples.ts')
if (!existsSync(samplesPath)) {
  warn('src/samples.ts 暂不存在，跳过内置示例 SVG 体积统计（上限 60KB）')
} else {
  try {
    const text = readText(samplesPath)
    // 提取字符串字面量（含转义字符），只统计看起来是 SVG 的片段；
    // 若没有 SVG 字面量则退回全部字符串，避免把代码注释算进去。
    const literals = []
    const strRe = /(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g
    let m
    while ((m = strRe.exec(text)) !== null) literals.push(m[2])
    const svgLiterals = literals.filter((s) => /<svg/i.test(s))
    const picked = svgLiterals.length ? svgLiterals : literals
    const bytes = picked.reduce((n, s) => n + Buffer.byteLength(s, 'utf8'), 0)
    if (bytes > SAMPLE_LIMIT) {
      fail('内置示例 SVG 合计 ' + bytes + ' B，超过 60KB 上限（' + SAMPLE_LIMIT + ' B）')
    } else {
      note('内置示例 SVG 合计 ' + bytes + ' B / ' + SAMPLE_LIMIT + ' B（统计 ' + picked.length + ' 段字符串字面量）')
    }
  } catch (e) {
    warn('src/samples.ts 读取失败，跳过体积统计：' + (e && e.message ? e.message : String(e)))
  }
}

// ------------------------------------------- 6) 浏览器测试页关键内容存在性检查
const pagePath = join(ROOT, 'tests', 'sanitize.test.html')
if (!existsSync(pagePath)) {
  fail('缺少 tests/sanitize.test.html')
} else {
  try {
    const html = readText(pagePath)
    const required = ['/src/sanitize.ts', './sanitize-vectors.mjs', '__SANITIZE_TEST_RESULT__', 'type="module"']
    const missing = required.filter((s) => !html.includes(s))
    if (missing.length) fail('tests/sanitize.test.html 缺少关键内容：' + missing.join('、'))
    else note('tests/sanitize.test.html：import 路径与结构化结果挂载点齐全')
  } catch (e) {
    warn('tests/sanitize.test.html 读取失败：' + (e && e.message ? e.message : String(e)))
  }
}

// --------------------------------------------------------------------- 输出
console.log('===== FR-12 构建前置校验（node scripts/verify.mjs）=====')
for (const n of notes) console.log('  [信息] ' + n)
for (const w of warnings) console.log('  [警告] ' + w)
for (const e of errors) console.log('  [致命] ' + e)
console.log(
  '----- 摘要：向量 ' + vectorCount + ' 条 · 致命 ' + errors.length +
  ' · 警告 ' + warnings.length + ' · 结论 ' + (errors.length ? '不通过' : '通过') + ' -----'
)
console.log(JSON.stringify({ ok: errors.length === 0, vectors: vectorCount, errors }))

if (errors.length) process.exit(1)
