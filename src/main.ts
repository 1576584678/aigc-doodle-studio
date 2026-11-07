/**
 * main.ts —— 只保留五态状态机（idle / generating / cancelling / success / error）
 * 与跨模块事件编排。全部能力按 ux-spec §9.1 C-12 拆到独立模块。
 *
 * 事件边界铁律（ux-spec §4.6）：只有 submit() 能改 state；
 * 自检 / 历史 / 撤销 / 清除互不写入对方状态；删除只写 #toast-region。
 */
import { generateSvg, ApiError, apiErrorCategory, type GenMode } from './api'
import {
  addToGallery,
  loadGallery,
  removeFromGallery,
  MAX_ITEMS,
  type GalleryItem
} from './gallery'
import { sanitizeSvg } from './sanitize'
import { dom } from './dom'
import {
  setStatus,
  setStatusRich,
  clearStatus,
  markInvalid,
  clearAllInvalid,
  showToast,
  updatePromptCount,
  escapeHtml
} from './ui'
import {
  getWork,
  hasWork,
  currentSource,
  renderWork,
  setPrevOkBadge,
  showVeil,
  refreshActions,
  showSamples,
  resetToSamples
} from './work'
import { initHistory, pushHistory, clearHint } from './history'
import { initUndo, beginUndo, clearUndo } from './undo'
import { initClear, isDialogOpen } from './clear'
import { initExport, isExportOpen, closeExportPanel, downloadSvg } from './export'
import { generateShareCard } from './sharecard'
import { initSelfTest, setSelfTestEnabled, resetSelfTest } from './selftest'
import {
  initStylePicker,
  getActiveStyle,
  resetStyle,
  setEnabled as setStyleEnabled
} from './styles'
import { initLayout, syncMobileOrder } from './layout'
import { initPrint } from './print'
import { initRedo, setRedoVisible } from './redo'
import { track } from './telemetry'
import {
  styleLabel,
  type CurrentWork,
  type HistoryItem,
  type State,
  type CancelReason
} from './types'
import type { SampleItem } from './samples'

// ---------- 五态状态机 ----------
let state: State = 'idle'
let controller: AbortController | null = null
let cancelReason: CancelReason = null
let retryCount = 0
let attemptTimer: number | null = null
let totalTimer: number | null = null
let slowHintTimer: number | null = null
let lastGeneratedPrompt = ''
let currentModeValue: GenMode = 'doodle' // 模式按钮选中态（决定下一次生成，不等于画布内容）

const ATTEMPT_TIMEOUT_MS = 45000
const TOTAL_TIMEOUT_MS = 90000
const RETRY_DELAY_MS = 800
/** 早于硬超时的「无响应」提示：12s 没有结果就给可行动作，避免长时间干等转圈。 */
const SLOW_HINT_MS = 12000
/**
 * 超时不再归咎于描述长度：像「一只奔跑的小狗」这种短描述也超时，
 * 基本来自端点/模型侧（响应慢、思考模式、连接挂起），提示应指向排查动作。
 */
const TIMEOUT_MESSAGE =
  '生成超时：模型在限定时间内没有返回。请点「测试连接」确认端点可用，或换一个响应更快的模型/端点再试'

/** 通过函数读取 state，规避 TS 对跨回调写入的控制流收窄。 */
function readState(): State {
  return state
}

/**
 * 同理：cancelReason 会被总超时 / 单次超时计时器回调与「取消生成」按钮
 * 在异步流程之外写入，TS 控制流分析不建模跨回调写入，会把 catch/finally
 * 中的类型误收窄为 'single' | null（TS2367）。统一经带显式返回类型的函数
 * 读取，保留完整联合类型，且不改变任何运行时语义。
 */
function readCancelReason(): CancelReason {
  return cancelReason
}

/** 统一状态切换：同步 dataset、error 角标、自检/风格按钮可用性。 */
function setState(next: State): void {
  state = next
  dom.generate.dataset.state = next
  // C-18/C-19：error 不清空画布、不改边框；角标仅在 error + 画布非空 + 非示例
  setPrevOkBadge(next === 'error' && hasWork() && currentSource() !== 'sample')
  const interactive = next !== 'generating' && next !== 'cancelling'
  setSelfTestEnabled(interactive)
  setStyleEnabled(interactive)
  setRedoVisible(next === 'success' && hasWork() && currentSource() === 'gen')
}

// ---------- 设置持久化（SEC-04：勾选「本次不保存 Key」时排除 apiKey） ----------
const SETTINGS_KEY = 'aigc_doodle_settings'

function loadSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as {
      baseUrl?: string
      apiKey?: string
      model?: string
    }
    dom.baseUrl.value = s.baseUrl ?? ''
    dom.apiKey.value = s.apiKey ?? ''
    dom.model.value = s.model ?? ''
  } catch {
    /* 忽略损坏数据 */
  }
}

function persistSettings(): void {
  try {
    const payload: Record<string, string> = {
      baseUrl: dom.baseUrl.value,
      model: dom.model.value
    }
    // 勾选时不写入 apiKey；若此前已存过 Key，本次重写即把它从存储中移除
    if (!dom.dontSaveKey.checked) payload.apiKey = dom.apiKey.value
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))
  } catch {
    /* 隐私模式下静默忽略 */
  }
}

// ---------- 模式按钮（历史切换绝不调用） ----------
function setMode(mode: GenMode): void {
  currentModeValue = mode
  dom.modeBtns.forEach((b) => {
    const active = b.dataset.mode === mode
    b.classList.toggle('active', active)
    b.setAttribute('aria-pressed', String(active))
  })
}

// ---------- 作品载入编排（success / 示例 / 画廊 / 历史共用） ----------
function toHistory(meta: CurrentWork, model: string): HistoryItem {
  return { ...meta, ts: Date.now(), model }
}

/**
 * 载入一幅作品：
 * - error 态主动载入 → clearStatus + idle + 移除角标（C-20）
 * - 历史入队发生在 renderWork 之前，保证容量丢弃提示先于画布渲染出现（§1.3.2）
 * - 丢弃说明合并进 #status，只播报一次
 */
function loadWork(
  meta: CurrentWork,
  opts: { addHistory: boolean; model?: string; statusText?: string }
): void {
  if (state === 'error') {
    clearStatus()
    setState('idle')
  }
  const overflow = opts.addHistory
    ? pushHistory(toHistory(meta, opts.model ?? dom.model.value.trim()))
    : false
  renderWork(meta)
  // 点示例 / 画廊 / 历史时 loadWork 不一定走 setState，这里同步收起重画条，避免残留误导
  setRedoVisible(state === 'success' && hasWork() && currentSource() === 'gen')
  if (opts.statusText) {
    setStatus(
      overflow
        ? `${opts.statusText}；较早的一张已移出本次历史，可先存入画廊`
        : opts.statusText,
      'ok'
    )
  }
  refreshActions()
}

function onSampleSelect(s: SampleItem): void {
  const meta: CurrentWork = {
    svg: s.svg,
    prompt: s.prompt,
    mode: s.mode,
    style: 'minimal',
    source: 'sample'
  }
  // 示例：新增一条历史（不写 localStorage、不占 50 张配额），#status 不写
  loadWork(meta, { addHistory: true, model: '' })
  clearStatus()
  track('sample_view')
  // 示例墙被全幅 SVG 替换，触发按钮已断开：焦点归还到首个工作按钮，避免掉到 body
  dom.download.focus({ preventScroll: true })
}

function onHistorySelect(item: HistoryItem): void {
  // 不改 .mode-btn.active / .style-btn.is-active（FR-05 规则 3 / C-20）
  loadWork(
    {
      svg: item.svg,
      prompt: item.prompt,
      mode: item.mode,
      style: item.style,
      source: item.source
    },
    { addHistory: false }
  )
  clearStatus()
  // history.ts 的 render() 重建了列表，焦点回到当前项
  dom.historyStrip
    .querySelector<HTMLButtonElement>('.history-item.is-current')
    ?.focus({ preventScroll: true })
}

// ---------- 画廊渲染 ----------
function renderGallery(): void {
  const items = loadGallery()
  const count = items.length
  dom.galleryCount.textContent = `${count} / ${MAX_ITEMS}`
  dom.galleryCount.classList.toggle('is-full', count >= MAX_ITEMS)
  if (count === 0) {
    dom.gallery.innerHTML =
      '<p class="empty-gallery" role="listitem">还没有作品，生成后点"存入画廊"。</p>'
    refreshActions()
    return
  }
  dom.gallery.innerHTML = ''
  items.forEach((it) => dom.gallery.appendChild(galleryCard(it)))
  refreshActions()
}

function galleryCard(it: GalleryItem): HTMLElement {
  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('role', 'listitem')
  const modeLabel = it.mode === 'stickman' ? '火柴人' : '简笔画'
  const promptText = it.prompt || lastGeneratedPrompt
  const esc = escapeHtml(promptText)
  let safeSvg = ''
  try {
    safeSvg = sanitizeSvg(it.svg)
  } catch {
    safeSvg = ''
  }

  card.innerHTML = `
    <button type="button" class="thumb" aria-label="在画布中查看：${esc}">${safeSvg}</button>
    <div class="meta">
      <span class="tag tag-${it.mode}">${modeLabel} · ${escapeHtml(styleLabel(it.style))}</span>
      <p class="desc" title="${esc}">${esc}</p>
    </div>
    <button class="del" type="button" title="删除" aria-label="删除作品：${esc}（${modeLabel}）">✕</button>
  `
  const innerSvg = card.querySelector('.thumb svg')
  if (innerSvg) innerSvg.setAttribute('aria-hidden', 'true')

  card.querySelector<HTMLButtonElement>('.thumb')?.addEventListener('click', () => {
    if (!safeSvg) {
      showToast('这幅作品的数据已损坏，无法显示', 'warn')
      return
    }
    lastGeneratedPrompt = promptText
    // 画廊查看作为一条新历史项，不覆盖当前项（FR-05 规则 4）
    loadWork(
      { svg: safeSvg, prompt: promptText, mode: it.mode, style: it.style, source: 'gallery' },
      { addHistory: true, model: '' }
    )
  })

  card.querySelector<HTMLButtonElement>('.del')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const cards = Array.from(dom.gallery.querySelectorAll<HTMLElement>('.card'))
    const index = cards.indexOf(card)
    const before = loadGallery()
    const remaining = removeFromGallery(it.id)
    if (remaining.length === before.length) {
      showToast('浏览器不允许本地保存，删除未能生效', 'warn')
      return
    }
    renderGallery()
    // 单一播报源：删除只写 toast，绝不写 #status（C-11，删除 main.ts:533 旧写法）
    beginUndo(it, index)
    // 焦点迁移沿用 v0.2：相邻卡片 .del → #gallery(tabindex=-1)
    const dels = Array.from(dom.gallery.querySelectorAll<HTMLButtonElement>('.del'))
    const next = dels[Math.min(index, dels.length - 1)]
    if (next) next.focus()
    else dom.gallery.focus()
  })
  return card
}

// ---------- 可中断重试延迟 ----------
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
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

// ---------- 生成：五态状态机主体（FR-01 引导 / FR-11 分段超时） ----------
async function submit(): Promise<void> {
  if (state === 'generating' || state === 'cancelling') return

  const prompt = dom.prompt.value
    .replace(/[\s\u3000\u00A0\u200B-\u200D\uFEFF]+/g, ' ')
    .trim()
  const baseUrl = dom.baseUrl.value.trim()
  const apiKey = dom.apiKey.value.trim()
  const model = dom.model.value.trim()

  // 缺 Key / URL / Model → FR-01 引导（info 非红字、不标 aria-invalid、不聚焦报错框、不发请求）
  if (!baseUrl || !apiKey || !model) {
    clearAllInvalid()
    setStatusRich('先看看示例，或填写自己的模型配置', 'info', [
      {
        label: '看示例',
        onClick: () => {
          resetToSamples()
          dom.canvas.scrollIntoView({ block: 'center' })
        }
      },
      {
        label: '去配置',
        onClick: () => {
          openSettings()
        }
      }
    ])
    return
  }
  // 缺 prompt → EX-01（聚焦输入框、标 aria-invalid）
  if (!prompt) {
    setStatus('请先写下要画的内容，或点上方示例', 'error')
    markInvalid(dom.prompt)
    return
  }
  if (prompt.length > 300) {
    setStatus('描述太长啦，请精简到 300 字以内', 'error')
    markInvalid(dom.prompt)
    return
  }
  clearAllInvalid()

  // EX-17 离线：用 info 而非 error，不发请求
  if (!navigator.onLine) {
    setStatus('当前离线，示例作品与画廊仍可用', 'info')
    return
  }

  // ---- 进入 generating ----
  lastGeneratedPrompt = prompt
  setState('generating')
  cancelReason = null
  retryCount = 0
  clearUndo() // submit 终止撤销窗口（§4.6）

  dom.generate.textContent = '取消生成'
  dom.generate.classList.remove('is-cancelling')
  dom.generate.classList.add('is-generating')
  dom.generate.setAttribute('aria-busy', 'true')
  dom.generate.removeAttribute('aria-disabled')
  setStatus('正在生成，请稍候…', 'info')
  setPrevOkBadge(false)
  dom.chips.forEach((chip) => {
    chip.disabled = true
    chip.title = '生成中，示例暂不可用'
  })
  dom.canvas.setAttribute('aria-busy', 'true')
  showVeil(true)

  const t0 = Date.now()
  // 总上限从 t0 起算，永不重置；优先于任何 attempt 计时器
  totalTimer = window.setTimeout(() => {
    if (readCancelReason() !== null) return
    cancelReason = 'total'
    setStatus(TIMEOUT_MESSAGE, 'error')
    if (controller && !controller.signal.aborted) controller.abort()
  }, TOTAL_TIMEOUT_MS)

  // 早于硬超时的无响应提示：12s 内没有任何结果就给出可行动作，
  // 避免用户面对「正在生成」一直转圈却不知道可以取消或去做连接自检。
  slowHintTimer = window.setTimeout(() => {
    if (readCancelReason() !== null || readState() !== 'generating') return
    setStatus('模型还没有返回，可能响应较慢。可点「取消生成」停止，超时后点「测试连接」排查端点', 'info')
  }, SLOW_HINT_MS)

  const opts = {
    baseUrl,
    apiKey,
    model,
    mode: currentModeValue,
    style: getActiveStyle(),
    prompt
  }

  try {
    for (let attempt = 0; attempt <= 1; attempt++) {
      const ctrl = new AbortController()
      controller = ctrl
      let singleTimedOut = false
      // 每次 attempt 单独 45s；重试重新计满
      attemptTimer = window.setTimeout(() => {
        if (readCancelReason() !== null) return
        singleTimedOut = true
        ctrl.abort()
      }, ATTEMPT_TIMEOUT_MS)

      try {
        const svg = await generateSvg(opts, ctrl.signal)
        // T7b 不变量：cancelling / 超时期间任何 resolve 一律丢弃
        if (readCancelReason() === null) {
          loadWork(
            { svg, prompt, mode: opts.mode, style: opts.style, source: 'gen' },
            { addHistory: true, model, statusText: '生成成功，可以下载或存入画廊' }
          )
          setState('success')
          track('gen_ok')
        }
        break
      } catch (e) {
        const retryable =
          singleTimedOut ||
          (e instanceof ApiError &&
            (e.code === 'network' || (e.code === 'http' && (e.status ?? 0) >= 500)))
        const budgetLeft = TOTAL_TIMEOUT_MS - (Date.now() - t0) > RETRY_DELAY_MS
        if (retryable && attempt === 0 && readCancelReason() === null && budgetLeft) {
          retryCount++
          setStatus('网络没连上，正在重试一次…', 'info')
          await abortableDelay(RETRY_DELAY_MS, ctrl.signal)
          if (readCancelReason() !== null) break
          continue // 文案与实际发起第二次请求一致（FR-11 验收）
        }
        if (singleTimedOut && readCancelReason() === null) {
          cancelReason = 'single'
          setStatus(TIMEOUT_MESSAGE, 'error')
        }
        throw e
      } finally {
        if (attemptTimer !== null) {
          window.clearTimeout(attemptTimer)
          attemptTimer = null
        }
      }
    }
  } catch (e) {
    if (readCancelReason() === 'user') {
      setState('idle')
    } else if (
      readCancelReason() === 'total' ||
      readCancelReason() === 'single' ||
      readCancelReason() === 'timeout'
    ) {
      // 超时文案已由计时器设置，这里与 finally 均不覆盖
      setState('error')
      track('gen_fail_timeout')
    } else if (e instanceof ApiError) {
      setStatus(e.userMessage, 'error')
      setState('error')
      track(`gen_fail_${apiErrorCategory(e)}`)
    } else {
      setStatus('请求没被接受，请检查设置或换一句描述再试', 'error')
      setState('error')
      track('gen_fail_other')
    }
  } finally {
    const cancelledByUser = readCancelReason() === 'user'
    const timedOut =
      readCancelReason() === 'total' || readCancelReason() === 'single' || readCancelReason() === 'timeout'

    if (totalTimer !== null) {
      window.clearTimeout(totalTimer)
      totalTimer = null
    }
    if (attemptTimer !== null) {
      window.clearTimeout(attemptTimer)
      attemptTimer = null
    }
    if (slowHintTimer !== null) {
      window.clearTimeout(slowHintTimer)
      slowHintTimer = null
    }
    controller = null
    cancelReason = null
    retryCount = 0

    dom.generate.setAttribute('aria-busy', 'false')
    dom.canvas.setAttribute('aria-busy', 'false')
    dom.generate.removeAttribute('aria-disabled')
    dom.generate.textContent = '生成'
    dom.generate.classList.remove('is-generating', 'is-cancelling')
    showVeil(false)
    dom.chips.forEach((chip) => {
      chip.disabled = false
      chip.removeAttribute('title')
    })

    if (cancelledByUser) {
      setStatus('已取消，可以重新生成', 'info')
      setState('idle')
    } else if (timedOut) {
      setState('error') // 不覆盖超时文案
    } else if (readState() === 'cancelling') {
      setState('idle')
    } else {
      setState(state) // success / error：同步角标与控件可用性，文案保持
    }

    // 焦点兜底：cancelling 用 aria-disabled 而非原生 disabled，避免掉到 body
    if (document.activeElement === document.body || document.activeElement === null) {
      dom.generate.focus()
    }
  }
}

// ---------- 主按钮：按状态分派（生成 / 取消） ----------
dom.generate.addEventListener('click', () => {
  if (state === 'generating') {
    setState('cancelling')
    cancelReason = 'user'
    setStatus('正在取消…', 'info')
    dom.generate.textContent = '正在取消…'
    dom.generate.classList.remove('is-generating')
    dom.generate.classList.add('is-cancelling')
    dom.generate.dataset.state = 'cancelling'
    dom.generate.setAttribute('aria-disabled', 'true')
    if (controller && !controller.signal.aborted) controller.abort()
    return
  }
  if (state === 'cancelling') return
  void submit()
})

// ---------- 全局 keydown（C-07：首行 dialog.open 守卫） ----------
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (isDialogOpen()) return
  if (e.key === 'Escape') {
    if (isExportOpen()) {
      e.preventDefault()
      closeExportPanel(true)
    }
    return
  }
  if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return
  const target = e.target
  if (target instanceof Element) {
    if (
      target.closest('.del') ||
      target.closest('.export-panel') ||
      target.closest('.toast-undo') ||
      target.closest('.btn-test') ||
      target.closest('dialog')
    ) {
      return
    }
  }
  e.preventDefault()
  void submit()
})

// ---------- 模式按钮 / 示例 chips ----------
dom.modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.mode === 'stickman' ? 'stickman' : 'doodle')
  })
})

dom.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const text = chip.dataset.prompt ?? ''
    const mode: GenMode = chip.dataset.mode === 'stickman' ? 'stickman' : 'doodle'
    const switched = mode !== currentModeValue
    dom.prompt.value = text
    if (switched) setMode(mode)
    updatePromptCount()
    dom.prompt.removeAttribute('aria-invalid')
    if (state === 'error' || dom.status.dataset.kind === 'error') {
      clearStatus()
      setState('idle')
    }
    const suffix = switched
      ? mode === 'stickman'
        ? '（已切换到火柴人模式）'
        : '（已切换到简笔画模式）'
      : ''
    setStatus('已填入示例，可修改后生成' + suffix, 'info')
    dom.prompt.focus()
    dom.prompt.setSelectionRange(text.length, text.length)
  })
})

// ---------- 输入事件 ----------
;[dom.baseUrl, dom.apiKey, dom.model].forEach((el) => {
  el.addEventListener('change', persistSettings)
  el.addEventListener('input', () => {
    el.removeAttribute('aria-invalid')
    if (state === 'error') {
      clearStatus()
      setState('idle')
    }
  })
})
dom.prompt.addEventListener('input', () => {
  updatePromptCount()
  dom.prompt.removeAttribute('aria-invalid')
  if (state === 'error' || dom.status.dataset.kind === 'error') {
    clearStatus()
    setState('idle')
  }
})
dom.dontSaveKey.addEventListener('change', persistSettings)

// ---------- 设置区附加控件 ----------
dom.valueMore.addEventListener('click', () => {
  const willOpen = dom.valueDetail.hidden
  dom.valueDetail.hidden = !willOpen
  dom.valueMore.setAttribute('aria-expanded', String(willOpen))
})

dom.presetSelect.addEventListener('change', () => {
  const v = dom.presetSelect.value
  if (!v) return
  dom.baseUrl.value = v // 仅填地址，保留手输能力
  dom.baseUrl.removeAttribute('aria-invalid')
  persistSettings()
})

dom.leadJump.addEventListener('click', () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  dom.prompt.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  dom.prompt.focus({ preventScroll: true })
})

// ---------- 模型设置弹框（替代原 <details> 内联展开，避免左栏过长） ----------
function openSettings(): void {
  // 与清除弹框一致：打开前先关导出面板，禁止两层浮层叠加
  closeExportPanel(false)
  dom.settingsDialog.showModal()
  dom.baseUrl.focus({ preventScroll: true })
}
function closeSettings(): void {
  if (dom.settingsDialog.open) dom.settingsDialog.close()
}
dom.settingsBtn.addEventListener('click', openSettings)
dom.settingsClose.addEventListener('click', closeSettings)
// 非破坏性弹框：点击遮罩区域关闭（原生 <dialog> 默认不会因 backdrop 关闭）
dom.settingsDialog.addEventListener('click', (e: MouseEvent) => {
  if (e.target === dom.settingsDialog) closeSettings()
})
// 关闭后焦点归还 opener；若清除事务已顺手关闭本弹框，回落到生成按钮
dom.settingsDialog.addEventListener('close', () => {
  const a = document.activeElement
  if (a === document.body || a === null) dom.generate.focus({ preventScroll: true })
  else dom.settingsBtn.focus({ preventScroll: true })
})

// ---------- 画布：返回示例墙 ----------
dom.canvasBack.addEventListener('click', () => {
  resetToSamples()
  clearStatus()
  dom.canvas.scrollIntoView({ block: 'center' })
})

// ---------- 画板右上角操作菜单（替代下方操作条，杜绝子面板遮挡） ----------
function openTools(): void {
  dom.toolsMenu.hidden = false
  dom.toolsToggle.setAttribute('aria-expanded', 'true')
}
function closeTools(): void {
  if (dom.toolsMenu.hidden) return
  dom.toolsMenu.hidden = true
  dom.toolsToggle.setAttribute('aria-expanded', 'false')
}
dom.toolsToggle.addEventListener('click', () => {
  if (dom.toolsMenu.hidden) openTools()
  else closeTools()
})
// click 冒泡阶段收起：保证按钮自身业务 click 先执行；导出项不收起（交给 export.ts 切换面板）
document.addEventListener('click', (e: MouseEvent) => {
  if (dom.toolsMenu.hidden) return
  const t = e.target
  if (!(t instanceof Element)) return
  if (t.closest('.canvas-tools')) {
    if (t.closest('[data-action="export-png"]') || t.closest('[data-action="toggle-tools"]')) return
    closeTools()
    return
  }
  closeTools()
})
// ESC 关闭菜单（设置/导出弹层优先，已在既有 keydown 处理）
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !dom.toolsMenu.hidden) {
    closeTools()
    dom.toolsToggle.focus({ preventScroll: true })
  }
})

// ---------- 操作条：下载 / 复制 / 存画廊 / 分享 / 打印 ----------
dom.download.addEventListener('click', () => {
  const work = getWork()
  if (work) downloadSvg(work.svg, work.mode)
})

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
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  if (active && typeof active.focus === 'function') active.focus()
  if (selection) {
    selection.removeAllRanges()
    savedRanges.forEach((r) => selection.addRange(r))
  }
  return ok
}

function leaveSelection(text: string): void {
  document.querySelectorAll('textarea.copy-fallback').forEach((el) => el.remove())
  const ta = document.createElement('textarea')
  ta.className = 'copy-fallback'
  ta.readOnly = true
  ta.value = text
  ta.setAttribute('aria-hidden', 'true')
  ta.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
}

dom.copy.addEventListener('click', async () => {
  const work = getWork()
  if (!work) return
  try {
    await navigator.clipboard.writeText(work.svg)
    setStatus('SVG 代码已复制', 'ok')
    return
  } catch {
    /* 降级到 execCommand */
  }
  if (legacyCopy(work.svg)) {
    setStatus('SVG 代码已复制', 'ok')
  } else {
    leaveSelection(work.svg)
    setStatus(
      '无法自动复制，代码已为你选中，按 Ctrl/⌘ + C 即可复制；也可点「下载 SVG」',
      'error'
    )
  }
})

dom.save.addEventListener('click', () => {
  const work = getWork()
  if (!work || work.source === 'sample') return
  clearUndo() // gallery_save 终止撤销窗口（§4.6）
  const result = addToGallery({
    prompt: work.prompt || lastGeneratedPrompt,
    svg: work.svg,
    mode: work.mode,
    style: work.style
  })
  if (result.ok) {
    renderGallery()
    clearHint()
    setStatus(`已存入画廊（${result.count}/${MAX_ITEMS}）`, 'ok')
    track('gallery_save')
  } else if (result.reason === 'full') {
    showToast('画廊最多保存 50 张，请先删除几张再存入', 'warn')
  } else if (result.reason === 'quota') {
    showToast('浏览器存储空间不足，请先删除几张作品再试', 'warn')
  } else {
    showToast('浏览器不允许本地保存，本次仍可下载', 'info')
  }
})

let shareBusy = false
dom.shareBtn.addEventListener('click', async () => {
  const work = getWork()
  if (!work || shareBusy) return
  shareBusy = true
  dom.shareBtn.classList.add('is-busy')
  dom.shareBtn.setAttribute('aria-busy', 'true')
  const ok = await generateShareCard(work)
  shareBusy = false
  dom.shareBtn.classList.remove('is-busy')
  dom.shareBtn.setAttribute('aria-busy', 'false')
  if (!ok) setStatus('分享图生成失败，请稍后再试', 'error')
})

// ---------- 模块接线 ----------
initHistory(onHistorySelect)
initUndo({
  renderGallery,
  focusDel: (index: number) => {
    const dels = Array.from(dom.gallery.querySelectorAll<HTMLButtonElement>('.del'))
    dels[index]?.focus()
  }
})
initSelfTest()
initExport()
initPrint()
initStylePicker()
initRedo()

initClear({
  resetGeneration: () => {
    if (totalTimer !== null) {
      window.clearTimeout(totalTimer)
      totalTimer = null
    }
    if (attemptTimer !== null) {
      window.clearTimeout(attemptTimer)
      attemptTimer = null
    }
    if (controller && !controller.signal.aborted) controller.abort()
    controller = null
    cancelReason = null
    retryCount = 0
    lastGeneratedPrompt = ''
    dom.generate.textContent = '生成'
    dom.generate.classList.remove('is-generating', 'is-cancelling')
    dom.generate.setAttribute('aria-busy', 'false')
    dom.generate.removeAttribute('aria-disabled')
    dom.canvas.setAttribute('aria-busy', 'false')
    showVeil(false)
    setPrevOkBadge(false)
    dom.chips.forEach((chip) => {
      chip.disabled = false
      chip.removeAttribute('title')
    })
    setState('idle')
  },
  clearFormAndSettings: () => {
    dom.baseUrl.value = ''
    dom.apiKey.value = ''
    dom.model.value = ''
    dom.prompt.value = ''
    dom.dontSaveKey.checked = false
    dom.presetSelect.value = ''
    closeSettings()
    dom.valueDetail.hidden = true
    dom.valueMore.setAttribute('aria-expanded', 'false')
    clearAllInvalid()
    updatePromptCount()
    setMode('doodle')
    // 注意：不重新 persistSettings()，否则会把空配置写回刚清空的 localStorage
  },
  renderGallery,
  resetSelfTest
})

// ---------- 初始化顺序：loadSettings → syncMobileOrder（DOM 注入前）→ 其余 ----------
loadSettings()
initLayout() // C-04：内部同步调用 syncMobileOrder()
setMode('doodle')
updatePromptCount()
showSamples(onSampleSelect)
renderGallery()
refreshActions()
setState('idle')
track('page_view')
