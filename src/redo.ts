/**
 * 重画兜底条（独立模块，不堆进 main.ts）。
 *
 * 只在「模型生成成功」的作品下出现（显隐由 main.ts 的 setState / loadWork 判定）；
 * 全部走既有入口：
 *   - 「再画一次」点击 #generate，复用 main.ts 的 submit()，不复制生成逻辑；
 *   - 「换个风格重画」点击对应 .style-btn，复用 styles.ts 的 initStylePicker 选中态逻辑，
 *     绝不直接写 activeStyle / 绕过 styles.ts；随后同样点击 #generate。
 * 不新增状态、锁、telemetry 事件；连点由 submit() 的 generating/cancelling 守卫兜住。
 */
import { dom } from './dom'
import { getActiveStyle } from './styles'
import { STYLE_LABELS, type StyleKey } from './types'

/** 切档顺序：minimal → cute → coloring → minimal。 */
const STYLE_ORDER: readonly StyleKey[] = ['minimal', 'cute', 'coloring']

let bar: HTMLDivElement | null = null
let styleButton: HTMLButtonElement | null = null

function nextStyle(current: StyleKey): StyleKey {
  const index = STYLE_ORDER.indexOf(current)
  // 理论上 getActiveStyle() 恒为合法值；兜底让未知值也能切到 cute 而不是卡死
  return STYLE_ORDER[index < 0 ? 1 : (index + 1) % STYLE_ORDER.length]
}

/** aria-label 始终写明「下一次点击会切到的档位」，切档后同步更新。 */
function syncStyleLabel(): void {
  if (!styleButton) return
  const target = nextStyle(getActiveStyle())
  styleButton.setAttribute('aria-label', `换成${STYLE_LABELS[target]}风格重画`)
}

/** 复用 #generate 的既有提交路径（submit()），此处不复制任何生成逻辑。 */
function regenerate(): void {
  document.querySelector<HTMLButtonElement>('#generate')?.click()
}

export function initRedo(): void {
  if (bar) return

  const el = document.createElement('div')
  el.className = 'redo-bar'
  el.setAttribute('role', 'group')
  el.setAttribute('aria-label', '重画选项')

  const tip = document.createElement('p')
  tip.className = 'redo-tip'
  tip.textContent = '画得不够清楚？换个画风或再试一次 · 同一句话，不同模型画出来会不一样'

  const actions = document.createElement('div')
  actions.className = 'redo-actions'

  const again = document.createElement('button')
  again.type = 'button'
  again.className = 'redo-again'
  again.dataset.action = 'redo-again'
  again.textContent = '再画一次'
  again.addEventListener('click', regenerate)

  const swap = document.createElement('button')
  swap.type = 'button'
  swap.className = 'redo-style'
  swap.dataset.action = 'redo-style'
  swap.textContent = '换个风格重画'
  swap.addEventListener('click', () => {
    const target = nextStyle(getActiveStyle())
    // 只触发 styles.ts 已绑定的 click，由它维护 activeStyle / aria-pressed
    document.querySelector<HTMLButtonElement>(`.style-btn[data-style="${target}"]`)?.click()
    syncStyleLabel()
    regenerate()
  })

  actions.append(again, swap)
  el.append(tip, actions)
  el.hidden = true // 初始隐藏

  // 挂在 .canvas-wrap 与 .history-strip 之间：即 .history-strip 之前
  const strip = dom.historyStrip
  const parent = strip.parentElement
  if (!parent) return
  parent.insertBefore(el, strip)

  bar = el
  styleButton = swap
  syncStyleLabel()

  // 用户直接从主风格选择器切档时，bubble 阶段晚于 styles.ts 的按钮 click，
  // 读到的已是最新 activeStyle；仅同步 aria-label，不改任何选中态 / 状态机
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target
    if (target instanceof Element && target.closest('.style-btn')) syncStyleLabel()
  })
}

/** 仅用 hidden 属性控制显隐，不写 display:none 硬编码。 */
export function setRedoVisible(visible: boolean): void {
  if (!bar) return
  // 每次重画条出现时都按当前真实档位重算标签：清除事务走 resetStyle() 把档位
  // 复位成 minimal，并不触发 .style-btn 的 click，仅靠 init / swap / click 同步
  // 会让 aria-label 停留在清除前那一档，读屏提示与实际点击结果不一致。
  if (visible) syncStyleLabel()
  bar.hidden = !visible
}
