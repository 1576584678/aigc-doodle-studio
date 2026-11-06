import { dom } from './dom'
import { hasWork } from './work'

/**
 * FR-10：只用 window.print() + @media print（样式在 style.css），不引任何 PDF 库。
 * 隐藏全部控件、仅保留作品与一行 .print-caption，由 CSS 完成；此处只负责触发。
 */
export function initPrint(): void {
  dom.printBtn.addEventListener('click', () => {
    if (!hasWork()) return
    // 焦点留在「打印 / PDF」按钮，打印后状态不变
    window.print()
  })
}
