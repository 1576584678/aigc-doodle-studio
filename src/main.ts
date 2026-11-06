import { generateSvg, ApiError, type GenMode } from './api'
import {
  addToGallery,
  loadGallery,
  removeFromGallery,
  countGallery,
  MAX_ITEMS,
  type GalleryItem
} from './gallery'
import { sanitizeSvg } from './sanitize'

// ---------- DOM ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T

const baseUrlEl = $<HTMLInputElement>('baseUrl')
const apiKeyEl = $<HTMLInputElement>('apiKey')
const modelEl = $<HTMLInputElement>('model')
const promptEl = $<HTMLTextAreaElement>('prompt')
const generateBtn = $<HTMLButtonElement>('generate')
const statusEl = $<HTMLDivElement>('status')
const canvasEl = $<HTMLDivElement>('canvas')
const galleryEl = $<HTMLDivElement>('gallery')
const galleryCountEl = $<HTMLSpanElement>('gallery-count')
const toastRegionEl = $<HTMLDivElement>('toast-region')
const promptCountEl = $<HTMLSpanElement>('prompt-count')

const downloadBtn = $<HTMLButtonElement>('download')
const copyBtn = $<HTMLButtonElement>('copy')
const saveBtn = $<HTMLButtonElement>('save')

const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-btn'))
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('.chip'))

// ---------- 状态机 ----------
type State = 'idle' | 'generating' | 'cancelling' | 'success' | 'error'
let state: State = 'idle'
let controller: AbortController | null = null
let cancelReason: 'user' | 'timeout' | null = null
let retryCount = 0
let lastGeneratedPrompt = ''
let timer: number | null = null
let currentSvg = '' // 只存过滤后的安全 SVG
let currentMode: GenMode = 'doodle'
let currentSvgMode: GenMode = currentMode // 画布当前 SVG 的真实生成模式（可与模式按钮不同）

const TIMEOUT_MS = 60000 // 总上限，重试不重置

/**
 * 通过函数读取 state：click 处理器会在 await 期间把它改成 'cancelling'，
 * 而 TS 的控制流分析不建模跨回调写入，直接比较会被收窄成不可能的分支。
 */
function readState(): State { return state }

// ---------- 设置持久化 ----------
const SETTINGS_KEY = 'aigc_doodle_settings'
function loadSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as {
      baseUrl?: string
      apiKey?: string
      model?: string
    }
    baseUrlEl.value = s.baseUrl ?? ''
    apiKeyEl.value = s.apiKey ?? ''
    modelEl.value = s.model ?? ''
  } catch { /* ignore */ }
}
function persistSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      baseUrl: baseUrlEl.value,
      apiKey: apiKeyEl.value,
      model: modelEl.value
    }))
  } catch { /* 隐私模式下静默忽略 */ }
}

// ---------- 模式切换 ----------
function setMode(mode: GenMode): void {
  currentMode = mode
  modeBtns.forEach((b) => {
    const active = b.dataset.mode === mode
    b.classList.toggle('active', active)
    b.setAttribute('aria-pressed', String(active))
  })
}

// ---------- 状态显示 ----------
type StatusKind = 'info' | 'error' | 'ok'
function setStatus(text: string, kind: StatusKind = 'info'): void {
  // 文案相同不重写 textContent，避免 aria-live 重复播报
  if (statusEl.textContent === text) {
    if (statusEl.dataset.kind !== kind) {
      statusEl.className = `status ${kind}`
      statusEl.dataset.kind = kind
    }
    return
  }
  statusEl.textContent = text
  statusEl.className = `status ${kind}`
  statusEl.dataset.kind = kind
}
function clearStatus(): void {
  statusEl.textContent = ''
  statusEl.className = 'status'
  statusEl.removeAttribute('data-kind')
}
function markInvalid(el: HTMLElement): void {
  el.setAttribute('aria-invalid', 'true')
  el.focus()
}
function clearAllInvalid(): void {
  ;[promptEl, baseUrlEl, apiKeyEl].forEach((el) => el.removeAttribute('aria-invalid'))
}

// ---------- Toast ----------
type ToastKind = 'ok' | 'warn' | 'info'
function showToast(text: string, kind: ToastKind): void {
  const stack = toastRegionEl.querySelectorAll<HTMLElement>('.toast')
  if (stack.length >= 2) stack[0].remove() // 最多 2 条，超出移除最旧
  const toast = document.createElement('div')
  toast.className = `toast ${kind}`
  if (kind === 'warn') toast.setAttribute('role', 'alert') // 容量/存储类需要更强势播报
  toast.textContent = text
  toastRegionEl.appendChild(toast)
  window.setTimeout(() => {
    if (!toast.isConnected) return
    toast.classList.add('is-leaving')
    window.setTimeout(() => toast.remove(), 180)
  }, 2800)
}

// ---------- 字数计数 ----------
function updatePromptCount(): void {
  promptCountEl.textContent = `${promptEl.value.length} / 300`
}

// ---------- 渲染 SVG 到舞台（二次过滤，防存储型 XSS） ----------
function renderSvg(svg: string, mode: GenMode = currentMode): void {
  const safe = sanitizeSvg(svg)
  currentSvg = safe
  currentSvgMode = mode // 画布内容与模式元数据始终绑定
  canvasEl.classList.remove('empty')
  canvasEl.innerHTML = safe
  const svgEl = canvasEl.querySelector('svg')
  if (svgEl) {
    svgEl.setAttribute('role', 'img')
    svgEl.setAttribute(
      'aria-label',
      `${mode === 'stickman' ? '生成的火柴人：' : '生成的简笔画：'}${lastGeneratedPrompt}`
    )
  }
  ;[downloadBtn, copyBtn, saveBtn].forEach((b) => { b.disabled = false })
}

// ---------- 生成：统一 submit ----------
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) { resolve(); return }
    let timerId = 0
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timerId)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    timerId = window.setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

async function submit(): Promise<void> {
  // 首行守卫：生成中 / 取消中一律吞掉重复提交
  if (state === 'generating' || state === 'cancelling') return

  // ---- 前置校验（顺序 + focus，任一失败不发请求、保持原态） ----
  const prompt = promptEl.value.replace(/[\s\u3000\u00A0\u200B-\u200D\uFEFF]+/g, ' ').trim()
  if (!prompt) {
    setStatus('请先写下要画的内容，或点上方示例', 'error')
    markInvalid(promptEl)
    return
  }
  if (!baseUrlEl.value.trim()) {
    setStatus('请先填写 API 地址，才能开始生成', 'error')
    markInvalid(baseUrlEl)
    return
  }
  if (!apiKeyEl.value.trim()) {
    setStatus('请先填写 API Key，才能开始生成', 'error')
    markInvalid(apiKeyEl)
    return
  }
  if (prompt.length > 300) {
    setStatus('描述太长啦，请精简到 300 字以内', 'error')
    markInvalid(promptEl)
    return
  }
  clearAllInvalid()

  // ---- 进入 generating ----
  lastGeneratedPrompt = prompt
  state = 'generating'
  cancelReason = null
  retryCount = 0

  generateBtn.textContent = '取消生成' // 全宽按钮，只改 textContent 不影响盒模型高度
  generateBtn.classList.remove('is-cancelling')
  generateBtn.classList.add('is-generating')
  generateBtn.dataset.state = 'generating'
  generateBtn.setAttribute('aria-busy', 'true')
  generateBtn.removeAttribute('aria-disabled')
  setStatus('正在生成，请稍候…', 'info')
  chips.forEach((chip) => {
    chip.disabled = true
    chip.title = '生成中，示例暂不可用'
  })
  canvasEl.setAttribute('aria-busy', 'true')

  const ctrl = new AbortController()
  controller = ctrl
  timer = window.setTimeout(() => {
    if (cancelReason !== null) return
    cancelReason = 'timeout'
    setStatus('生成时间太长，已停止。请缩短描述或稍后再试', 'error')
    if (!ctrl.signal.aborted) ctrl.abort()
  }, TIMEOUT_MS)

  const opts = {
    baseUrl: baseUrlEl.value,
    apiKey: apiKeyEl.value,
    model: modelEl.value,
    mode: currentMode,
    prompt
  }

  try {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const svg = await generateSvg(opts, ctrl.signal)
        // T7b：cancelling 期间任何 resolve 一律丢弃，不 renderSvg、不报成功
        if (cancelReason === null) {
          renderSvg(svg)
          setStatus('生成成功，可以下载或存入画廊', 'ok')
          state = 'success'
        }
        break
      } catch (e) {
        const retryable =
          e instanceof ApiError &&
          (e.code === 'network' || (e.code === 'http' && (e.status ?? 0) >= 500))
        if (retryable && attempt === 0 && cancelReason === null) {
          retryCount++
          setStatus('网络没连上，正在重试一次…', 'info')
          await abortableDelay(800, ctrl.signal) // 可被 abort 打断
          if (cancelReason !== null) break
          continue
        }
        // 4xx / invalid-svg / 校验错误一律不重试
        throw e
      }
    }
  } catch (e) {
    if (cancelReason === 'user') {
      state = 'idle'
    } else if (cancelReason === 'timeout') {
      // 超时文案已由 timer 设置，这里不覆盖
      state = 'error'
    } else if (e instanceof ApiError) {
      setStatus(e.userMessage, 'error')
      if (e.detail) console.error(e.detail)
      state = 'error'
    } else {
      setStatus('请求没被接受，请检查设置或换一句描述再试', 'error')
      console.error(e)
      state = 'error'
    }
  } finally {
    const cancelledByUser = cancelReason === 'user'
    const timedOut = cancelReason === 'timeout'

    // 统一清理
    if (timer !== null) { window.clearTimeout(timer); timer = null }
    controller = null
    cancelReason = null
    retryCount = 0

    generateBtn.setAttribute('aria-busy', 'false')
    canvasEl.setAttribute('aria-busy', 'false')
    generateBtn.removeAttribute('aria-disabled')
    generateBtn.textContent = '生成'
    generateBtn.classList.remove('is-generating', 'is-cancelling')
    chips.forEach((chip) => {
      chip.disabled = false
      chip.removeAttribute('title')
    })

    if (cancelledByUser) {
      setStatus('已取消，可以重新生成', 'info')
      state = 'idle'
    } else if (timedOut) {
      state = 'error'
    } else if (readState() === 'cancelling') {
      state = 'idle'
    }
    generateBtn.dataset.state = state

    // 焦点留在 #generate：cancelling 用 aria-disabled 而非原生 disabled，避免掉到 body
    if (document.activeElement === document.body || document.activeElement === null) {
      generateBtn.focus()
    }
  }
}

// ---------- 主按钮：按状态分派（生成 / 取消） ----------
generateBtn.addEventListener('click', () => {
  if (state === 'generating') {
    // 先同步状态与文案，再 abort；不使用原生 disabled
    state = 'cancelling'
    cancelReason = 'user'
    setStatus('正在取消…', 'info')
    generateBtn.textContent = '正在取消…'
    generateBtn.classList.remove('is-generating')
    generateBtn.classList.add('is-cancelling')
    generateBtn.dataset.state = 'cancelling'
    generateBtn.setAttribute('aria-disabled', 'true')
    if (controller && !controller.signal.aborted) controller.abort()
    return
  }
  if (state === 'cancelling') return // 重复点击防护
  void submit()
})

// ---------- FR-07: Ctrl / ⌘ + Enter ----------
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return
  e.preventDefault()
  const target = e.target
  if (target instanceof Element && target.closest('.del')) return
  void submit() // generating / cancelling 时由首行守卫吞掉
})

// ---------- 模式按钮 ----------
modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.mode === 'stickman' ? 'stickman' : 'doodle')
  })
})

// ---------- 示例 chips ----------
chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const text = chip.dataset.prompt ?? ''
    const mode: GenMode = chip.dataset.mode === 'stickman' ? 'stickman' : 'doodle'
    const switched = mode !== currentMode
    promptEl.value = text
    if (switched) setMode(mode)
    updatePromptCount()
    promptEl.removeAttribute('aria-invalid')
    if (statusEl.dataset.kind === 'error') clearStatus()
    const suffix = switched
      ? (mode === 'stickman' ? '（已切换到火柴人模式）' : '（已切换到简笔画模式）')
      : ''
    setStatus('已填入示例，可修改后生成' + suffix, 'info')
    promptEl.focus()
    promptEl.setSelectionRange(text.length, text.length)
    // 不提交、不滚动
  })
})

// ---------- 输入事件 ----------
;[baseUrlEl, apiKeyEl, modelEl].forEach((el) => {
  el.addEventListener('change', persistSettings)
  el.addEventListener('input', () => el.removeAttribute('aria-invalid'))
})
promptEl.addEventListener('input', () => {
  updatePromptCount()
  promptEl.removeAttribute('aria-invalid')
  // T9：error 态下用户重新输入即清空错误文案并回到 idle
  if (state === 'error' || statusEl.dataset.kind === 'error') {
    clearStatus()
    state = 'idle'
  }
})

// ---------- 下载 ----------
downloadBtn.addEventListener('click', () => {
  if (!currentSvg) return
  const blob = new Blob([currentSvg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `doodle_${Date.now()}.svg`
  a.click()
  URL.revokeObjectURL(url)
})

// ---------- 复制代码 ----------
function legacyCopy(text: string): boolean {
  const active = document.activeElement as HTMLElement | null
  const selection = window.getSelection()
  const savedRanges: Range[] = []
  if (selection) {
    for (let i = 0; i < selection.rangeCount; i++) savedRanges.push(selection.getRangeAt(i))
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  if (active && typeof active.focus === 'function') active.focus()
  if (selection) {
    selection.removeAllRanges()
    savedRanges.forEach((r) => selection.addRange(r))
  }
  return ok
}

/** 两级降级都失败时，留下一个不可见的已选中文本域，让 Ctrl/⌘+C 仍能生效。 */
function leaveSelection(text: string): void {
  document.querySelectorAll('textarea.copy-fallback').forEach((el) => el.remove())
  const ta = document.createElement('textarea')
  ta.className = 'copy-fallback'
  ta.readOnly = true
  ta.value = text
  ta.setAttribute('aria-hidden', 'true')
  ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
}

copyBtn.addEventListener('click', async () => {
  if (!currentSvg) return
  try {
    await navigator.clipboard.writeText(currentSvg)
    setStatus('SVG 代码已复制', 'ok')
    return
  } catch { /* 降级到 execCommand */ }
  if (legacyCopy(currentSvg)) {
    setStatus('SVG 代码已复制', 'ok')
  } else {
    leaveSelection(currentSvg)
    setStatus('无法自动复制，代码已为你选中，按 Ctrl/⌘ + C 即可复制；也可点「下载 SVG」', 'error')
  }
})

// ---------- 存入画廊 ----------
saveBtn.addEventListener('click', () => {
  if (!currentSvg) return
  const result = addToGallery({
    prompt: lastGeneratedPrompt || promptEl.value.trim(),
    svg: currentSvg,
    mode: currentSvgMode
  })
  if (result.ok) {
    renderGallery()
    setStatus(`已存入画廊（${result.count}/${MAX_ITEMS}）`, 'ok')
  } else if (result.reason === 'full') {
    showToast('画廊最多保存 50 张，请先删除几张再存入', 'warn')
  } else if (result.reason === 'quota') {
    showToast('浏览器存储空间不足，请先删除几张作品再试', 'warn')
  } else {
    showToast('浏览器不允许本地保存，本次仍可下载', 'info')
  }
  // 失败时画廊保持不变，不重复写左栏 status
})

// ---------- 画廊渲染 ----------
function renderGallery(): void {
  const items = loadGallery()
  galleryCountEl.textContent = `${countGallery()} / ${MAX_ITEMS}`
  if (items.length === 0) {
    galleryEl.innerHTML = '<p class="empty-gallery" role="listitem">还没有作品，生成后点"存入画廊"。</p>'
    return
  }
  galleryEl.innerHTML = ''
  items.forEach((it) => galleryEl.appendChild(galleryCard(it)))
}

function galleryCard(it: GalleryItem): HTMLElement {
  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('role', 'listitem')
  const modeLabel = it.mode === 'stickman' ? '火柴人' : '简笔画'
  // 使用存入时的 prompt 快照，绝不实时读 promptEl.value
  const promptText = it.prompt || lastGeneratedPrompt
  const esc = escapeHtml(promptText)
  let safeSvg = ''
  try { safeSvg = sanitizeSvg(it.svg) } catch { safeSvg = '' }

  card.innerHTML = `
    <button type="button" class="thumb" aria-label="在画布中查看：${esc}">${safeSvg}</button>
    <div class="meta">
      <span class="tag tag-${it.mode}">${modeLabel}</span>
      <p class="desc" title="${esc}">${esc}</p>
    </div>
    <button class="del" type="button" title="删除" aria-label="删除作品：${esc}（${modeLabel}）">✕</button>
  `
  const innerSvg = card.querySelector('.thumb svg')
  if (innerSvg) innerSvg.setAttribute('aria-hidden', 'true')

  const thumb = card.querySelector<HTMLButtonElement>('.thumb')
  thumb?.addEventListener('click', () => {
    if (!safeSvg) {
      showToast('这幅作品的数据已损坏，无法显示', 'warn')
      return
    }
    lastGeneratedPrompt = promptText
    renderSvg(safeSvg, it.mode)
  })

  const del = card.querySelector<HTMLButtonElement>('.del')
  del?.addEventListener('click', (e) => {
    e.stopPropagation()
    const cards = Array.from(galleryEl.querySelectorAll<HTMLElement>('.card'))
    const index = cards.indexOf(card)
    const before = loadGallery()
    const remaining = removeFromGallery(it.id)
    if (remaining.length === before.length) {
      // saveGallery 失败：返回的是删除前数组，让调用方感知
      showToast('浏览器不允许本地保存，删除未能生效', 'warn')
      return
    }
    renderGallery()
    setStatus('已从画廊删除', 'info')
    // 焦点移到相邻卡片的 .del，无相邻则回到 #gallery（tabindex=-1）
    const dels = Array.from(galleryEl.querySelectorAll<HTMLButtonElement>('.del'))
    const next = dels[Math.min(index, dels.length - 1)]
    if (next) next.focus()
    else galleryEl.focus()
  })
  return card
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c)
}

// ---------- 初始化 ----------
loadSettings()
setMode('doodle') // 同步 aria-pressed
updatePromptCount()
renderGallery() // 同步计数
