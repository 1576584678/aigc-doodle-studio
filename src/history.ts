import { dom } from './dom'
import { sanitizeSvg } from './sanitize'
import type { HistoryItem } from './types'

const MAX_HISTORY = 5

let items: HistoryItem[] = []
let currentIndex = -1
let hintVisible = false
let onSelect: (item: HistoryItem) => void = () => {}

/** 初始化：注入「点历史项」回调并渲染空态（仅内存，刷新即空）。 */
export function initHistory(cb: (item: HistoryItem) => void): void {
  onSelect = cb
  render()
}

/**
 * 入队一条历史。返回本次是否发生容量丢弃。
 * 丢弃提示必须在 shift() 之前设定（FR-05 规则 2 / ux-spec §1.3.2）。
 */
export function pushHistory(item: HistoryItem): boolean {
  hintVisible = false // 下一次写入先移除旧 hint，避免连续堆叠
  let overflow = false
  if (items.length >= MAX_HISTORY) {
    hintVisible = true
    items.shift()
    overflow = true
  }
  items.unshift(item)
  currentIndex = 0
  render()
  return overflow
}

/** 点历史项：切当前项，不改模式 / 风格按钮选中态（由 main.ts 保证）。 */
export function selectHistory(index: number): void {
  const item = items[index]
  if (!item) return
  currentIndex = index
  hintVisible = false // 视为已读
  render()
  onSelect(item)
}

/** 用户完成「存入画廊」后调用：丢弃提示中的可行动作已执行。 */
export function clearHint(): void {
  if (!hintVisible) return
  hintVisible = false
  render()
}

export function clearHistory(): void {
  items = []
  currentIndex = -1
  hintVisible = false
  render()
}

export function historyCount(): number {
  return items.length
}

function thumbnailSvg(svg: string): string {
  try {
    return sanitizeSvg(svg)
  } catch {
    return ''
  }
}

function render(): void {
  const strip = dom.historyStrip
  strip.innerHTML = ''

  const head = document.createElement('div')
  head.className = 'history-head'
  const title = document.createElement('span')
  title.className = 'history-title'
  title.textContent = '本次会话历史'
  const count = document.createElement('span')
  count.className = 'history-count'
  count.textContent = `${items.length} / ${MAX_HISTORY}`
  head.appendChild(title)
  head.appendChild(count)
  strip.appendChild(head)

  const tip = document.createElement('p')
  tip.className = 'history-note'
  tip.textContent = '仅本次会话有效，重要作品请存入画廊'
  strip.appendChild(tip)

  if (hintVisible) {
    const hint = document.createElement('p')
    hint.className = 'history-hint'
    // 无 aria-live：静态可读，说明合并进当次 #status 只播报一次
    hint.textContent = '较早的一张已移出本次历史，可先存入画廊'
    strip.appendChild(hint)
  }

  const list = document.createElement('div')
  list.className = 'history-list'
  list.setAttribute('role', 'list')
  list.setAttribute('aria-label', '本次会话画布历史')

  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'history-empty'
    empty.textContent = '还没有历史 · 仅本次会话有效'
    strip.appendChild(empty)
  } else {
    items.forEach((it, i) => {
      const cell = document.createElement('div')
      cell.setAttribute('role', 'listitem')

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'history-item' + (i === currentIndex ? ' is-current' : '')
      const modeText = it.mode === 'stickman' ? '火柴人' : '简笔画'
      btn.setAttribute('aria-label', `查看第 ${i + 1} 张历史：${it.prompt}（${modeText}）`)
      btn.title = it.prompt
      btn.dataset.prompt = it.prompt
      const safe = thumbnailSvg(it.svg)
      if (safe) {
        const art = document.createElement('span')
        art.className = 'history-art'
        art.innerHTML = safe
        art.querySelector('svg')?.setAttribute('aria-hidden', 'true')
        btn.appendChild(art)
      }
      btn.addEventListener('click', () => selectHistory(i))
      cell.appendChild(btn)
      list.appendChild(cell)
    })
    strip.appendChild(list)
  }
}

/** 供导出/分享等只读用途：取当前历史项的 prompt 快照（不改动队列）。 */
export function currentHistoryItem(): HistoryItem | null {
  return currentIndex >= 0 ? items[currentIndex] ?? null : null
}
