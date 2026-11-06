import { dom } from './dom'

const MQ = '(max-width: 760px)'

let mq: MediaQueryList | null = null
let pendingReorder = false

/** 只读 v0.2 既有的 aigc_doodle_settings.apiKey，不新增/不写入任何 localStorage 键。 */
function hasSavedKey(): boolean {
  try {
    const raw = localStorage.getItem('aigc_doodle_settings')
    if (!raw) return false
    const parsed = JSON.parse(raw) as { apiKey?: unknown }
    return typeof parsed.apiKey === 'string' && parsed.apiKey.trim() !== ''
  } catch {
    return false
  }
}

/**
 * ≤760px 且 apiKey 为空 → insertBefore(rightEl,leftEl) 物理重排；
 * 有 Key 或 >760px → 还原 left→right；禁止 CSS order（C-04 / §1.1）。
 * 重排前后保存/恢复 activeElement；dialog.open 时推迟到 close 后。
 */
export function syncMobileOrder(): void {
  if (dom.dialog.open) {
    pendingReorder = true
    return
  }
  pendingReorder = false

  const narrow = mq ? mq.matches : window.matchMedia(MQ).matches
  const reorder = narrow && !hasSavedKey()
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const rightIsFirst = dom.layout.children[0] === dom.right

  if (reorder && !rightIsFirst) {
    dom.layout.insertBefore(dom.right, dom.left)
  } else if (!reorder && rightIsFirst) {
    dom.layout.insertBefore(dom.left, dom.right)
  }

  if (active && active.isConnected && document.activeElement !== active) {
    active.focus({ preventScroll: true })
  }
  // 条件 B：程序化 focus 后浏览器不一定重新触发 :focus-visible，
  // 显式补一个局部可见焦点环（按 §2.4 局部覆盖方式，绝不写 outline:none）。
  if (active && active.isConnected && document.activeElement === active && active !== document.body) {
    active.classList.add('refocus-ring')
    window.setTimeout(() => active.classList.remove('refocus-ring'), 1200)
  }
}

export function initLayout(): void {
  mq = window.matchMedia(MQ)
  mq.addEventListener('change', () => syncMobileOrder())
  // dialog 打开期间推迟重排，关闭后再判定
  dom.dialog.addEventListener('close', () => {
    if (pendingReorder) syncMobileOrder()
  })
  // C-04：模块初始化、loadSettings 之后、任何 DOM 注入之前执行
  syncMobileOrder()
}
