// 共享类型与纯函数（无运行时依赖，供各能力模块与构建测试复用）

import type { GenMode } from './api'
export type { GenMode }

export type StyleKey = 'minimal' | 'cute' | 'coloring'
export type WorkSource = 'gen' | 'sample' | 'gallery'
export type State = 'idle' | 'generating' | 'cancelling' | 'success' | 'error'
export type CancelReason = 'user' | 'timeout' | 'single' | 'total' | null
export type TestCategory =
  | 'ok' | 'cors' | 'network' | '401' | '403' | '404' | '429' | 'timeout' | 'other'

/** 3 档风格的显示标签（旧画廊数据缺 style 时按「极简线稿」兼容）。 */
export const STYLE_LABELS: Record<StyleKey, string> = {
  minimal: '极简线稿',
  cute: '圆润可爱',
  coloring: '涂色线稿'
}

export function isStyleKey(v: unknown): v is StyleKey {
  return v === 'minimal' || v === 'cute' || v === 'coloring'
}

/** 缺 style / 非法 style 一律回落到极简线稿（FR-09 规则 3）。 */
export function styleLabel(v: unknown): string {
  return STYLE_LABELS[isStyleKey(v) ? v : 'minimal']
}

/** 画布当前作品：svg 一律为已过滤的安全字符串。 */
export interface CurrentWork {
  svg: string
  prompt: string
  mode: GenMode
  style: StyleKey
  source: WorkSource
}

/** 历史项：仅内存，含复现用的 model 快照。 */
export interface HistoryItem extends CurrentWork {
  ts: number
  model: string
}
