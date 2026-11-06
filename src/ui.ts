import { dom } from './dom'

export type StatusKind = 'info' | 'error' | 'ok' | 'warn'
export type ToastKind = 'ok' | 'warn' | 'info'

/**
 * 单一播报源：#status 只在文案真正变化时写一次（沿用 main.ts 的去重）。
 * 自检 / 删除 / 容量 toast 均不得调用本函数写 #status（见 ux-spec §4.6）。
 */
export function setStatus(text: string, kind: StatusKind = 'info'): void {
  const el = dom.status
  if (el.textContent === text) {
    if (el.dataset.kind !== kind) {
      el.className = `status ${kind}`
      el.dataset.kind = kind
    }
    return
  }
  el.textContent = text
  el.className = `status ${kind}`
  el.dataset.kind = kind
}

export interface StatusAction {
  label: string
  onClick: () => void
}

/** 带内联次要动作的状态文案（无 Key 引导 / 分类错误的可行动作）。 */
export function setStatusRich(text: string, kind: StatusKind, actions: StatusAction[]): void {
  const el = dom.status
  el.textContent = text
  el.className = `status ${kind}`
  el.dataset.kind = kind
  actions.forEach((a) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'status-action'
    btn.textContent = a.label
    btn.addEventListener('click', a.onClick)
    el.appendChild(btn)
  })
}

export function clearStatus(): void {
  const el = dom.status
  el.textContent = ''
  el.className = 'status'
  el.removeAttribute('data-kind')
}

export function markInvalid(el: HTMLElement): void {
  el.setAttribute('aria-invalid', 'true')
  el.focus()
}

export function clearAllInvalid(): void {
  ;[dom.prompt, dom.baseUrl, dom.apiKey, dom.model].forEach((el) =>
    el.removeAttribute('aria-invalid')
  )
}

/** 普通 toast（容量 / quota / 恢复失败 / 清除完成 / 示例损坏）。撤销 toast 由 undo.ts 自行构造。 */
export function showToast(text: string, kind: ToastKind): void {
  const stack = Array.from(dom.toastRegion.querySelectorAll<HTMLElement>('.toast'))
  if (stack.length >= 2) {
    // 不误杀撤销窗口：优先移除最旧的非撤销 toast
    const victim = stack.find((t) => !t.classList.contains('is-undo')) ?? stack[0]
    victim.remove()
  }
  const toast = document.createElement('div')
  toast.className = `toast ${kind}`
  if (kind === 'warn') toast.setAttribute('role', 'alert')
  toast.textContent = text
  dom.toastRegion.appendChild(toast)
  window.setTimeout(() => {
    if (!toast.isConnected) return
    toast.classList.add('is-leaving')
    window.setTimeout(() => toast.remove(), 180)
  }, 2800)
}

export function updatePromptCount(): void {
  const n = dom.prompt.value.length
  dom.promptCount.textContent = `${n} / 300`
  const limit = n >= 300
  dom.promptCount.classList.toggle('is-limit', limit)
  dom.prompt.classList.toggle('field-error', limit)
}

export function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c)
}
