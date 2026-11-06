import { dom } from './dom'
import { clearAigcStorageKeys } from './gallery'
import { clearUndo } from './undo'
import { clearHistory } from './history'
import { resetToSamples, refreshActions } from './work'
import { resetStyle } from './styles'
import { syncMobileOrder } from './layout'
import { closeExportPanel } from './export'
import { clearStatus, showToast } from './ui'
import { track } from './telemetry'

export interface ClearHost {
  /** 清 attemptTimer/totalTimer、abort 在途请求、state=idle、cancelReason=null、复位生成按钮与 chips。 */
  resetGeneration: () => void
  /** 清空设置/prompt 输入框、计数归零、模式回简笔画、收起设置区与价值详情。 */
  clearFormAndSettings: () => void
  renderGallery: () => void
  resetSelfTest: () => void
}

let host: ClearHost | null = null

/** 弹窗关闭（取消 / ESC / 确认）统一归还焦点：断开或隐藏时降级到 .settings-head。 */
function returnFocus(): void {
  const target = dom.linkDanger
  if (target.isConnected) {
    target.focus({ preventScroll: true })
    if (document.activeElement === target) return
  }
  dom.settingsHead.focus({ preventScroll: true })
  if (document.activeElement === document.body || document.activeElement === null) {
    dom.generate.focus({ preventScroll: true })
  }
}

/**
 * FR-13 事务顺序固定（ux-spec §4.5）：
 * ① clearUndo → ② 清 aigc_doodle_* → ③ 清内存态 → ④ UI 复位
 * → ⑤ syncMobileOrder → ⑥ 焦点归还（close 事件）→ ⑦ toast + 事件名。
 * 取消 / ESC 分支全部不执行（不调用本函数），撤销窗口继续有效。
 */
function runClearTransaction(): void {
  // ① 终止撤销窗口：clearUndo 同步移除 .toast.is-undo，避免撤销把已清除作品写回
  clearUndo()
  // ② 仅清 aigc_doodle_* 前缀键，不扩大到其他站点数据
  clearAigcStorageKeys()
  // ③ 清内存态
  clearHistory()
  host?.resetGeneration()
  resetToSamples() // currentSvg='' / 画布回 6 格示例墙 / 角标移除 / 操作条禁用
  // ④ UI 复位
  host?.clearFormAndSettings()
  clearStatus()
  host?.renderGallery() // 计数 0 / 50、空态
  refreshActions()
  resetStyle()
  host?.resetSelfTest()
  // ⑤ 重新判定栏序（dialog 仍 open，内部会推迟到 close 后执行）
  syncMobileOrder()
}

export function initClear(h: ClearHost): void {
  host = h

  dom.linkDanger.addEventListener('click', () => {
    // UX-O-11：showModal 之前先关闭导出面板，禁止两层浮层叠加
    closeExportPanel(false)
    dom.dialog.showModal()
    // 默认焦点必须落在「取消」（危险操作安全默认）
    dom.btnQuiet.focus()
  })

  dom.btnQuiet.addEventListener('click', () => {
    dom.dialog.close('cancel')
  })

  dom.btnDanger.addEventListener('click', () => {
    runClearTransaction()
    dom.dialog.close('confirm')
    showToast('本机数据已清除', 'ok')
    track('clear_local_data')
  })

  // 不 preventDefault cancel：ESC 由原生 dialog 消费一次，语义=取消，数据零变更
  dom.dialog.addEventListener('close', returnFocus)

  // 点 ::backdrop 不关闭：禁止给 dialog 本身绑定任何 click 关闭逻辑。
  // 原生 showModal() 默认不会因点击 backdrop 关闭，这里不做任何处理。
}

/** 供 main.ts 的全局 keydown 首行判断使用。 */
export function isDialogOpen(): boolean {
  return dom.dialog.open
}
