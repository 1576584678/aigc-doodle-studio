import { dom } from './dom'
import { sanitizeSvg } from './sanitize'
import { getWork } from './work'
import { track } from './telemetry'
import type { GenMode } from './api'

type Background = 'transparent' | 'white'
type Scale = 1 | 2 | 4

// 导出选项仅内存记住，不写 localStorage（C-25）
let bg: Background = 'transparent'
let scale: Scale = 1
let busy = false
let metaEl: HTMLElement | null = null
let goBtn: HTMLButtonElement | null = null
let errEl: HTMLElement | null = null

export function isExportOpen(): boolean {
  return !dom.exportPanel.hidden
}

/** 从（已过滤）SVG 读取 viewBox 实际宽高；缺失时回落到 400×400。 */
export function svgDimensions(svg: string): { w: number; h: number } {
  const m = svg.match(
    /viewBox\s*=\s*["']\s*(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)\s*["']/i
  )
  if (m) {
    const w = Number(m[3])
    const h = Number(m[4])
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h }
  }
  return { w: 400, h: 400 }
}

/**
 * 给 SVG 根节点补上与实际 viewBox 一致的 width/height，
 * 避免只带 viewBox 的 SVG 被 Image 当作 300×150 默认尺寸，保证不拉伸变形。
 */
export function ensureSvgSize(svg: string): { markup: string; w: number; h: number } {
  const { w, h } = svgDimensions(svg)
  const stripped = svg.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '')
  const markup = stripped.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`)
  return { markup, w, h }
}

/** 下载 SVG（主操作条与 PNG 失败降级共用）。零网络。 */
export function downloadSvg(svg: string, mode: GenMode): void {
  let safe = ''
  try {
    safe = sanitizeSvg(svg)
  } catch {
    return
  }
  const blob = new Blob([safe], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `doodle_${mode}_${Date.now()}.svg`
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  track('export_svg')
}

/**
 * FR-04 固定链路：sanitizeSvg(currentSvg) → Blob → createObjectURL → Image.onload
 * → Canvas（白底先填 #FFFFFF）→ drawImage → toBlob('image/png') → 下载 → revokeObjectURL。
 * onload / onerror 两条路径都释放 URL；任一环抛错返回 false 交由面板降级。
 */
export async function exportPng(
  svg: string,
  mode: GenMode,
  opts: { bg: Background; scale: Scale }
): Promise<boolean> {
  let safe = ''
  try {
    safe = sanitizeSvg(svg)
  } catch {
    return false
  }
  const sized = ensureSvgSize(safe)
  const blob = new Blob([sized.markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  let revoked = false
  const revoke = (): void => {
    if (!revoked) {
      revoked = true
      URL.revokeObjectURL(url)
    }
  }
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
    const w = Math.max(1, Math.round(sized.w * opts.scale))
    const h = Math.max(1, Math.round(sized.h * opts.scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    if (opts.bg === 'white') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('toBlob failed')
    const pngUrl = URL.createObjectURL(png)
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = `doodle_${mode}_${opts.bg}_${opts.scale}x_${Date.now()}.png`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
    track('export_png')
    return true
  } catch {
    return false
  } finally {
    revoke()
  }
}

function optButton(value: string, label: string, kind: 'bg' | 'scale'): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'export-opt'
  b.textContent = label
  if (kind === 'bg') b.dataset.bg = value
  else b.dataset.scale = value
  b.addEventListener('click', () => {
    if (kind === 'bg') bg = value as Background
    else scale = Number(value) as Scale
    clearError()
    syncOptions()
  })
  return b
}

function group(label: string, buttons: HTMLButtonElement[]): HTMLElement {
  const g = document.createElement('div')
  g.className = 'export-group'
  const l = document.createElement('p')
  l.className = 'export-group-label'
  l.textContent = label
  const row = document.createElement('div')
  row.className = 'export-row'
  buttons.forEach((b) => row.appendChild(b))
  g.appendChild(l)
  g.appendChild(row)
  return g
}

function buildPanel(): void {
  const p = dom.exportPanel
  p.innerHTML = ''
  p.setAttribute('role', 'group')
  p.setAttribute('aria-label', 'PNG 导出选项')

  const title = document.createElement('p')
  title.className = 'export-group-label'
  title.textContent = 'PNG 导出选项'
  p.appendChild(title)

  p.appendChild(group('底色', [optButton('transparent', '透明底', 'bg'), optButton('white', '白底', 'bg')]))
  p.appendChild(
    group('倍率', [
      optButton('1', '1x', 'scale'),
      optButton('2', '2x', 'scale'),
      optButton('4', '4x', 'scale')
    ])
  )

  metaEl = document.createElement('p')
  metaEl.className = 'export-meta'
  p.appendChild(metaEl)

  goBtn = document.createElement('button')
  goBtn.type = 'button'
  goBtn.className = 'export-go'
  goBtn.textContent = '导出 PNG'
  goBtn.addEventListener('click', () => {
    void runExport()
  })
  p.appendChild(goBtn)
  syncOptions()
}

function syncOptions(): void {
  dom.exportPanel.querySelectorAll<HTMLButtonElement>('.export-opt').forEach((b) => {
    const active = b.dataset.bg ? b.dataset.bg === bg : Number(b.dataset.scale) === scale
    b.classList.toggle('is-active', active)
    b.setAttribute('aria-pressed', String(active))
  })
  updateMeta()
}

function updateMeta(): void {
  if (!metaEl) return
  const work = getWork()
  const dims = work ? svgDimensions(work.svg) : { w: 400, h: 400 }
  const label = bg === 'white' ? '白底' : '透明底'
  const ratio = dims.w !== 400 || dims.h !== 400 ? '（按实际 viewBox 等比）' : ''
  metaEl.textContent = `${label} ${scale}x = ${Math.round(dims.w * scale)} × ${Math.round(dims.h * scale)}${ratio}。线条含文字时，导出效果可能因系统字体略有不同。`
}

function clearError(): void {
  if (errEl) {
    errEl.remove()
    errEl = null
  }
}

function showError(message: string): void {
  clearError()
  const el = document.createElement('div')
  el.className = 'status error export-error'
  el.setAttribute('role', 'status')
  el.setAttribute('tabindex', '-1')
  el.textContent = message
  const action = document.createElement('button')
  action.type = 'button'
  action.className = 'status-action'
  action.textContent = '下载 SVG'
  action.addEventListener('click', () => {
    const w = getWork()
    if (w) downloadSvg(w.svg, w.mode)
  })
  el.appendChild(action)
  if (goBtn) dom.exportPanel.insertBefore(el, goBtn)
  else dom.exportPanel.appendChild(el)
  errEl = el
  el.focus({ preventScroll: true })
}

async function runExport(): Promise<void> {
  if (busy || !goBtn) return
  const work = getWork()
  if (!work) return
  busy = true
  clearError()
  goBtn.classList.add('is-busy')
  goBtn.setAttribute('aria-busy', 'true')
  goBtn.setAttribute('aria-disabled', 'true')
  goBtn.textContent = '导出中…'
  const ok = await exportPng(work.svg, work.mode, { bg, scale })
  busy = false
  goBtn.classList.remove('is-busy')
  goBtn.setAttribute('aria-busy', 'false')
  goBtn.removeAttribute('aria-disabled')
  goBtn.textContent = '导出 PNG'
  if (!ok) {
    // EX-14：面板保持打开，面板内错误容器一次播报，主操作条「下载 SVG」仍可用
    showError('PNG 导出失败，可改用下载 SVG')
  } else {
    closeExportPanel(true)
  }
}

export function openExportPanel(): void {
  dom.exportPanel.hidden = false
  dom.exportTrigger.setAttribute('aria-expanded', 'true')
  clearError()
  updateMeta()
  // 非模态：不抢焦点，焦点留在触发按钮，由 DOM 顺序自然进入第一个 .export-opt
}

export function closeExportPanel(returnFocus = true): void {
  if (dom.exportPanel.hidden) return
  const active = document.activeElement
  dom.exportPanel.hidden = true
  dom.exportTrigger.setAttribute('aria-expanded', 'false')
  if (
    returnFocus &&
    (active === document.body || active === null || dom.exportPanel.contains(active))
  ) {
    dom.exportTrigger.focus({ preventScroll: true })
  }
}

export function initExport(): void {
  buildPanel()
  dom.exportTrigger.addEventListener('click', () => {
    if (isExportOpen()) closeExportPanel(true)
    else openExportPanel()
  })
  // 点面板外关闭用 pointerdown；触发按钮自身与面板内部不关（C-08）
  document.addEventListener('pointerdown', (e) => {
    if (dom.exportPanel.hidden) return
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('.export-panel') || t.closest('[data-action="export-png"]')) return
    closeExportPanel(true)
  })
}
