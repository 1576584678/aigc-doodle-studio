import { dom } from './dom'
import { classifyNetwork, testConnectionRequest } from './api'
import { track } from './telemetry'

const TEST_TIMEOUT_MS = 6000
const RAPID_CLICK_GUARD_MS = 350

let enabled = true
let busy = false
let cancelRequested = false
let startedAt = 0
let controller: AbortController | null = null
let timeoutId: number | null = null
let epoch = 0

/** 主状态机进入 generating / cancelling 时禁用，避免与 AbortController 串扰（C-10）。 */
export function setSelfTestEnabled(v: boolean): void {
  enabled = v
  dom.btnTest.disabled = !v
}

/** FR-13 清除时复位自检，并作废在途结果写入。 */
export function resetSelfTest(): void {
  epoch++
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId)
    timeoutId = null
  }
  if (controller && !controller.signal.aborted) controller.abort()
  controller = null
  busy = false
  cancelRequested = false
  dom.btnTest.classList.remove('is-busy')
  dom.btnTest.setAttribute('aria-busy', 'false')
  dom.btnTest.removeAttribute('aria-disabled')
  dom.btnTest.textContent = '测试连接'
  dom.testResult.textContent = ''
  dom.testResult.className = 'test-result'
}

function writeResult(ok: boolean, message: string, action: string, myEpoch: number): void {
  if (myEpoch !== epoch) return
  const el = dom.testResult
  el.textContent = action ? `${message}；${action}` : message
  el.className = `test-result ${ok ? 'is-ok' : 'is-fail'}`
}

async function runTest(): Promise<void> {
  const baseUrl = dom.baseUrl.value.trim()
  const apiKey = dom.apiKey.value.trim()
  const model = dom.model.value.trim()
  const myEpoch = epoch

  if (!baseUrl || !apiKey || !model) {
    writeResult(false, '请先填写 API 地址、API Key 与 Model，再测试连接', '请展开模型设置补全配置', myEpoch)
    return
  }

  busy = true
  cancelRequested = false
  startedAt = Date.now()
  const ctrl = new AbortController()
  controller = ctrl
  dom.btnTest.classList.add('is-busy')
  dom.btnTest.setAttribute('aria-busy', 'true')
  dom.btnTest.setAttribute('aria-disabled', 'true')
  dom.btnTest.textContent = '取消测试'
  dom.testResult.textContent = ''
  dom.testResult.className = 'test-result'

  let timedOut = false
  timeoutId = window.setTimeout(() => {
    timedOut = true
    if (!ctrl.signal.aborted) ctrl.abort()
  }, TEST_TIMEOUT_MS)

  try {
    // 单次请求、不重试（C-17）；不携带任何用户作品数据
    const res = await testConnectionRequest({ baseUrl, apiKey, model }, ctrl.signal)
    if (myEpoch !== epoch) return
    if (cancelRequested) {
      writeResult(false, '测试已取消', '可重新点击「测试连接」', myEpoch)
      return
    }
    if (res.ok) {
      writeResult(true, '连接可用', '现在可以输入描述并点「生成」', myEpoch)
      track('test_conn_ok')
    } else {
      const info = res.info ?? classifyNetwork()
      writeResult(false, info.message, info.action, myEpoch)
      track(`test_conn_fail_${info.category}`)
    }
  } catch {
    if (myEpoch !== epoch) return
    if (cancelRequested) {
      writeResult(false, '测试已取消', '可重新点击「测试连接」', myEpoch)
    } else if (timedOut) {
      writeResult(false, '测试超时，请检查端点或稍后再试', '请换一个端点或稍后重试', myEpoch)
      track('test_conn_fail_timeout')
    } else {
      writeResult(false, '测试未通过，请检查配置或换一个端点', '请检查配置或看示例', myEpoch)
      track('test_conn_fail_other')
    }
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
    if (myEpoch === epoch) {
      busy = false
      cancelRequested = false
      controller = null
      dom.btnTest.classList.remove('is-busy')
      dom.btnTest.setAttribute('aria-busy', 'false')
      dom.btnTest.removeAttribute('aria-disabled')
      dom.btnTest.textContent = '测试连接'
    }
  }
}

function onClick(): void {
  if (busy) {
    // 防重复点击：进入 busy 后极短时间内的连点一律吞掉；
    // 之后显式点「取消测试」才取消，且只取消一次，保证「连点 3 次仅 1 次请求」
    if (Date.now() - startedAt < RAPID_CLICK_GUARD_MS) return
    if (!cancelRequested && controller) {
      cancelRequested = true
      dom.btnTest.textContent = '正在取消…'
      controller.abort()
    }
    return
  }
  if (!enabled) return
  void runTest()
}

/**
 * 自检子状态机完全独立：不读写 state / cancelReason / controller / retryCount /
 * currentSvg / 历史队列，不写 #status，结果只写 .test-result（C-10 / §4.2）。
 */
export function initSelfTest(): void {
  dom.btnTest.addEventListener('click', onClick)
}
