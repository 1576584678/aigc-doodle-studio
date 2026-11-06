/**
 * 平台侧匿名统计钩子（FR-08）。
 *
 * - 默认完全 no-op：只有宿主显式注入全局钩子函数时才会被调用。
 * - 只传事件名，绝不携带 prompt / Key / Base URL / Model / SVG / 作品 id / referrer。
 * - 不引入任何第三方脚本 / SDK / 统计像素；平台不支持时所有功能照常（EX-18）。
 */
type TrackHook = (eventName: string) => void

interface TelemetryHost {
  __aigcDoodleTrack?: unknown
}

export function track(eventName: string): void {
  try {
    const host = globalThis as unknown as TelemetryHost
    const hook = host.__aigcDoodleTrack
    if (typeof hook === 'function') (hook as TrackHook)(eventName)
  } catch {
    // 静默降级：统计不可用不得影响任何功能、不得产生用户可见错误
  }
}
