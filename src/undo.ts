import { dom } from './dom'
import { setStatus, showToast } from './ui'
import { restoreGalleryItem, type GalleryItem } from './gallery'

interface PendingUndo {
  item: GalleryItem
  index: number
  id: string
  ts: number
}

export interface UndoHost {
  renderGallery: () => void
  /** 撤销成功后把焦点落到被恢复卡片的 .del（由 main.ts 实现）。 */
  focusDel: (index: number) => void
}

let pendingUndo: PendingUndo | null = null
let undoTimer: number | null = null
let toastEl: HTMLElement | null = null
let host: UndoHost | null = null

export function initUndo(h: UndoHost): void {
  host = h
}

/** 焦点若停留在撤销按钮上，移除前先归还到画廊 / 相邻 .del，绝不落到 body。 */
function returnFocusFromToast(node: HTMLElement): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !node.contains(active)) return
  const del = dom.gallery.querySelector<HTMLButtonElement>('.del')
  ;(del ?? dom.gallery).focus({ preventScroll: true })
  if (document.activeElement === document.body || document.activeElement === null) {
    dom.gallery.focus({ preventScroll: true })
  }
}

function removeNode(node: HTMLElement | null): void {
  if (!node) return
  returnFocusFromToast(node)
  node.remove()
  if (toastEl === node) toastEl = null
}

/**
 * 幂等终止窗口：clearTimeout + pendingUndo=null + 立即移除节点（不等 .is-leaving 180ms）。
 * FR-13 事务第 1 步 / 并发删除 / 其他写操作均调用它。
 */
export function clearUndo(): void {
  if (undoTimer !== null) {
    window.clearTimeout(undoTimer)
    undoTimer = null
  }
  pendingUndo = null
  removeNode(toastEl)
}

export function isUndoActive(): boolean {
  return pendingUndo !== null
}

/** 删除成功后开启 5 秒窗口；并发删除会先终止旧窗口。 */
export function beginUndo(item: GalleryItem, index: number): void {
  clearUndo()
  pendingUndo = { item, index, id: item.id, ts: item.ts }

  const toast = document.createElement('div')
  toast.className = 'toast is-undo'
  toast.setAttribute('role', 'group')
  toast.setAttribute('aria-label', '删除撤销')

  const msg = document.createElement('span')
  msg.className = 'toast-msg'
  msg.textContent = '已删除 1 张作品，5 秒内可撤销'

  const undoBtn = document.createElement('button')
  undoBtn.type = 'button'
  undoBtn.className = 'toast-undo'
  undoBtn.textContent = '撤销'
  undoBtn.setAttribute('aria-label', '撤销删除，恢复这张作品')

  const timerBar = document.createElement('span')
  timerBar.className = 'toast-timer'
  timerBar.setAttribute('aria-hidden', 'true')

  const count = document.createElement('span')
  count.className = 'toast-count'
  count.setAttribute('aria-hidden', 'true')
  count.textContent = '5 秒'

  toast.appendChild(msg)
  toast.appendChild(undoBtn)
  toast.appendChild(timerBar)
  toast.appendChild(count)
  dom.toastRegion.appendChild(toast)
  toastEl = toast

  // toast-region 最多 2 条：优先清掉最旧的非撤销 toast
  const all = Array.from(dom.toastRegion.querySelectorAll<HTMLElement>('.toast'))
  if (all.length > 2) {
    const victim = all.find((t) => t !== toast && !t.classList.contains('is-undo')) ?? all[0]
    if (victim !== toast) victim.remove()
  }

  undoBtn.addEventListener('click', () => {
    const p = pendingUndo
    if (!p) return
    clearUndo() // 立即移除 toast 并归还焦点，终止计时器
    const ok = restoreGalleryItem(p.item, p.index)
    if (ok) {
      host?.renderGallery()
      setStatus('已恢复 1 张作品', 'ok')
      host?.focusDel(p.index)
    } else {
      // EX-13：warn toast（role=alert）、无撤销按钮，强势播报一次
      showToast('恢复失败，作品未找回', 'warn')
    }
  })

  // 5 秒窗口只由 setTimeout 驱动；.toast-timer 的 CSS 动画纯视觉，绝不监听 animationend
  undoTimer = window.setTimeout(() => {
    if (pendingUndo === null) return
    pendingUndo = null
    undoTimer = null
    const node = toastEl
    if (node) {
      node.classList.add('is-leaving')
      window.setTimeout(() => removeNode(node), 180)
    }
  }, 5000)
}
