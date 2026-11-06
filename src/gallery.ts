import type { GenMode } from './api'
import { isStyleKey, type StyleKey } from './types'

export interface GalleryItem {
  id: string
  prompt: string
  svg: string
  mode: GenMode
  style: StyleKey
  ts: number
}

export const MAX_ITEMS = 50

export type AddResult =
  | { ok: true; item: GalleryItem; count: number }
  | { ok: false; reason: 'full' | 'quota' | 'unavailable' }

const KEY = 'aigc_doodle_gallery'

/**
 * 读取并清洗画廊：非数组、缺 id/svg 的脏项一律丢弃，字段做类型归一。
 * FR-09 规则 3：缺 style / 非法 style 的 v0.2 旧数据一律按「极简线稿」兼容。
 */
export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: GalleryItem[] = []
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue
      const it = entry as Partial<GalleryItem>
      if (typeof it.id !== 'string' || it.id.length === 0) continue
      if (typeof it.svg !== 'string' || it.svg.length === 0) continue
      out.push({
        id: it.id,
        prompt: typeof it.prompt === 'string' ? it.prompt : '',
        svg: it.svg,
        mode: it.mode === 'stickman' ? 'stickman' : 'doodle',
        style: isStyleKey(it.style) ? it.style : 'minimal',
        ts: typeof it.ts === 'number' ? it.ts : 0
      })
    }
    return out
  } catch {
    return []
  }
}

/** setItem 的异常原样抛出，交给 addToGallery / removeFromGallery 分类。 */
export function saveGallery(items: GalleryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch (e) {
    throw e
  }
}

function isQuotaError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const x = e as { name?: unknown; code?: unknown }
  return x.name === 'QuotaExceededError' || x.code === 22
}

/**
 * 新增作品。满 50 张时前置拦截返回 full，绝不静默删除旧数据。
 * 任何写入失败路径都不保留内存中的半截数据，以 loadGallery() 重新读回为准。
 */
export function addToGallery(item: Omit<GalleryItem, 'id' | 'ts'>): AddResult {
  const items = loadGallery()
  if (items.length >= MAX_ITEMS) return { ok: false, reason: 'full' }

  const full: GalleryItem = {
    ...item,
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now()
  }
  items.unshift(full)

  try {
    saveGallery(items)
  } catch (e) {
    // 不写半截数据：丢弃本地副本，以存储中的真实内容为准
    loadGallery()
    if (isQuotaError(e)) return { ok: false, reason: 'quota' }
    return { ok: false, reason: 'unavailable' }
  }

  return { ok: true, item: full, count: loadGallery().length }
}

/** 删除作品；写入失败时返回删除前的数组，让调用方感知（长度未变）。 */
export function removeFromGallery(id: string): GalleryItem[] {
  const before = loadGallery()
  const items = before.filter((it) => it.id !== id)
  try {
    saveGallery(items)
  } catch {
    return before
  }
  return items
}

/**
 * FR-06 撤销：按原索引插回原 item（保留原 id / ts / style），不生成新 id、不排队首。
 * 写入失败（quota）返回 false，由调用方给出「恢复失败，作品未找回」。
 */
export function restoreGalleryItem(item: GalleryItem, index: number): boolean {
  const items = loadGallery()
  const at = Math.max(0, Math.min(index, items.length))
  items.splice(at, 0, item)
  try {
    saveGallery(items)
    return true
  } catch {
    return false
  }
}

/** FR-13：只清除本站 aigc_doodle_* 前缀键，不扩大到其他站点数据或无关键。 */
export function clearAigcStorageKeys(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('aigc_doodle_')) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // 隐私模式下静默忽略
  }
}

/** 当前作品数量，供计数显示。 */
export function countGallery(): number {
  return loadGallery().length
}
