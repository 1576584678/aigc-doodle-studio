import { dom } from './dom'
import { sanitizeSvg } from './sanitize'
import { countGallery, MAX_ITEMS } from './gallery'
import { createSampleWall, type SampleItem } from './samples'
import type { CurrentWork, GenMode } from './types'

let current: CurrentWork | null = null
let samplesCallback: (s: SampleItem) => void = () => {}

export function getWork(): CurrentWork | null {
  return current
}

export function hasWork(): boolean {
  return current !== null
}

/** 画布当前内容来源，供角标/保存按钮判定。 */
export function currentSource(): 'gen' | 'sample' | 'gallery' | null {
  return current ? current.source : null
}

/** 画布当前 SVG 的真实模式（可与模式按钮选中态不同）。 */
export function currentMode(): GenMode | null {
  return current ? current.mode : null
}

function removeBadge(selector: string): void {
  dom.canvas.querySelector(selector)?.remove()
}

/**
 * 渲染一幅作品到画布（二次过滤，防存储型 XSS）。
 * 只在 success / 示例 / 画廊 / 历史路径调用；error 态绝不调用（PRD 9.1 不清空画布）。
 */
export function renderWork(meta: CurrentWork): void {
  let safe = ''
  try {
    safe = sanitizeSvg(meta.svg)
  } catch {
    return
  }
  current = { ...meta, svg: safe }
  dom.canvas.classList.remove('empty', 'is-sample')
  dom.canvas.innerHTML = safe

  const svgEl = dom.canvas.querySelector('svg')
  if (svgEl) {
    svgEl.setAttribute('role', 'img')
    const modeText = meta.mode === 'stickman' ? '火柴人' : '简笔画'
    const prefix = meta.source === 'sample' ? '示例作品（非模型生成）' : `生成的${modeText}`
    svgEl.setAttribute('aria-label', `${prefix}：${meta.prompt}`)
    svgEl.setAttribute('aria-hidden', 'false')
  }

  removeBadge('.canvas-badge--prev-ok')
  removeBadge('.canvas-badge--sample')
  if (meta.source === 'sample') {
    dom.canvas.classList.add('is-sample')
    const badge = document.createElement('span')
    badge.className = 'canvas-badge canvas-badge--sample'
    badge.textContent = '示例作品 · 非模型生成'
    dom.canvas.appendChild(badge)
  }
  dom.canvasBack.hidden = meta.source !== 'sample'
  refreshActions()
}

/** 「上次成功结果」角标：仅 error 态 + 画布非空 + 非示例时显示；无 live、无 role=status。 */
export function setPrevOkBadge(show: boolean): void {
  if (!show) {
    removeBadge('.canvas-badge--prev-ok')
    return
  }
  if (!current || current.source === 'sample') {
    removeBadge('.canvas-badge--prev-ok')
    return
  }
  if (dom.canvas.querySelector('.canvas-badge--prev-ok')) return
  const badge = document.createElement('span')
  badge.className = 'canvas-badge canvas-badge--prev-ok'
  badge.textContent = '上次成功结果'
  dom.canvas.appendChild(badge)
}

/** 生成中的加载遮罩（reduced-motion 下由 CSS 静态兜底）。 */
export function showVeil(show: boolean): void {
  if (!show) {
    dom.canvas.querySelector('.canvas-veil')?.remove()
    return
  }
  if (dom.canvas.querySelector('.canvas-veil')) return
  const veil = document.createElement('div')
  veil.className = 'canvas-veil'
  veil.setAttribute('aria-hidden', 'true')
  const spinner = document.createElement('span')
  spinner.className = 'spinner'
  const text = document.createElement('span')
  text.className = 'canvas-veil-text'
  text.textContent = '正在生成…'
  veil.appendChild(spinner)
  veil.appendChild(text)
  dom.canvas.appendChild(veil)
}

/**
 * 操作条启用状态。仅由「画布是否有作品」决定；
 * 生成中仍允许对上一张保留图做导出/分享/打印（ux-spec §4.1）。
 */
export function refreshActions(): void {
  const has = current !== null
  const isSample = current?.source === 'sample'
  const full = countGallery() >= MAX_ITEMS
  ;[dom.download, dom.copy, dom.exportTrigger, dom.shareBtn, dom.printBtn].forEach((b) => {
    b.disabled = !has
  })
  dom.save.disabled = !has || isSample || full
  if (dom.save.disabled) {
    dom.save.title = isSample
      ? '示例作品不占用画廊配额'
      : full
        ? '画廊已满 50 张，请先删除几张再存入'
        : '请先生成或查看一幅作品'
  } else {
    dom.save.removeAttribute('title')
  }
}

/** 空态示例墙。onSelect 由 main.ts 注入，FR-13 复位时复用同一回调。 */
export function showSamples(onSelect: (s: SampleItem) => void): void {
  samplesCallback = onSelect
  mountSamples()
}

/** 重新挂载示例墙（FR-13 清除后回到初始态）。 */
export function resetToSamples(): void {
  mountSamples()
}

function mountSamples(): void {
  current = null
  dom.canvas.className = 'canvas empty'
  dom.canvas.innerHTML = ''
  dom.canvas.appendChild(createSampleWall(samplesCallback))
  dom.canvasBack.hidden = true
  refreshActions()
}
