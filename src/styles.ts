import { dom } from './dom'
import { isStyleKey, type StyleKey } from './types'

export { STYLE_LABELS, styleLabel } from './types'

/**
 * FR-09 风格选择器：3 档纯文字 aria-pressed 单选。
 * 约束只由 prompts.ts 的 buildSystemPrompt 追加到 system prompt 末尾（8 条硬规范不变）。
 * 历史 / 画廊 / 清除复位一律不得改动这里的选中态以外的语义（FR-05 规则 3 / C-20）。
 */
let activeStyle: StyleKey = 'minimal'
let enabled = true
let onChange: ((s: StyleKey) => void) | null = null

export function getActiveStyle(): StyleKey {
  return activeStyle
}

export function resetStyle(): void {
  activeStyle = 'minimal'
  syncButtons()
}

/** 生成中禁用但不清空用户选择（FR-09 验收 6）。 */
export function setEnabled(v: boolean): void {
  enabled = v
  dom.styleBtns.forEach((b) => {
    b.disabled = !v
  })
}

function syncButtons(): void {
  dom.styleBtns.forEach((b) => {
    const raw = b.dataset.style
    const key: StyleKey = isStyleKey(raw) ? raw : 'minimal'
    const active = key === activeStyle
    b.classList.toggle('is-active', active)
    b.setAttribute('aria-pressed', String(active))
  })
}

export function initStylePicker(cb?: (s: StyleKey) => void): void {
  onChange = cb ?? null
  dom.styleBtns.forEach((b) => {
    b.addEventListener('click', () => {
      if (!enabled) return
      const raw = b.dataset.style
      if (!isStyleKey(raw)) return
      activeStyle = raw
      syncButtons()
      onChange?.(raw)
    })
  })
  syncButtons()
}
